// One independent world per Continue. No storage writes in this worker: the
// title screen owns the save and can cancel without applying half a settlement.
// (It reads this build's kept regions, region-store.ts; it keeps none itself.)
//
// The absence is replayed on a thread that has compiled nothing yet, and residents ask for well over a hundred world
// regions in its first simulated minutes. `packs` are regions the title screen already had compiled ahead of need
// (region-prebuild.ts); a pack is the compiler's own output for its region, so using one changes nothing but the wait.
// Regions not among them compile here as before. `regions` in a progress message counts regions made ready so far.
import { selectSnapshots, serializeSnapshot } from './persist';
import { settleWithReturn } from './return-report';
import { setActiveLayout } from './world';
import { getWindowWorld, setPrebuiltRegionSource, type GeometryRegionPack, type VeyraPlacementRules } from '../veyra05/window';
import { regionStore } from '../veyra05/region-store';
import { isVeyra05Layout } from '../veyra05/scenes';
import { syncFloor } from '../veyra05/floors';
import { markDirty } from './engine';
/** `kept`: regions to read back from this build's region store before the replay starts (region-store.ts). */
export type ReturnRequest = {snapshot:string;now:number;packs?:GeometryRegionPack[];kept?:{build:string;wanted:[string,VeyraPlacementRules][]}};
/** `regions`: world regions made ready so far; `packsUsed`: how many of them came ready from the title screen. */
export type ReturnMessage = {kind:'progress'; fraction:number; regions:number} | {kind:'complete';snapshot:string;result:ReturnType<typeof settleWithReturn>;regions:number;packsUsed:number} | {kind:'failed';reason:string};
/** The whole job, apart from the worker plumbing, so a test can run it on its own thread. */
export function runReturn(data:ReturnRequest,send:(msg:ReturnMessage)=>void):void {
  try {
    const gs=selectSnapshots([data.snapshot]).gs;
    if(!gs?.run || !Number.isFinite(data.now))throw Error('Invalid Continue checkpoint.');
    const layout=gs.run.layoutId??'shipping';if(!setActiveLayout(layout))throw Error('Missing saved island.');
    let last=0,regions=0,packsUsed=0;
    const ready=new Map<string,GeometryRegionPack>();
    for(const pack of data.packs??[])ready.set(`${pack.rules}:${pack.layoutId}`,pack);
    // Asked once per region this thread does not have yet: hand over a ready pack, or let it compile here.
    setPrebuiltRegionSource((layoutId,rules)=>{
      const key=`${rules}:${layoutId}`,pack=ready.get(key);ready.delete(key);
      regions++;if(pack)packsUsed++;send({kind:'progress',fraction:last/100,regions});
      return pack;
    });
    if(isVeyra05Layout(layout)){const ww=getWindowWorld(layout);syncFloor(gs,ww,ww.floors,markDirty);}
    const result=settleWithReturn(gs,data.now,(fraction)=>{const pct=Math.floor(100*fraction);if(pct>last){last=pct;send({kind:'progress',fraction:pct/100,regions});}});
    send({kind:'complete',snapshot:serializeSnapshot(gs),result,regions,packsUsed});
  }catch(e){send({kind:'failed',reason:e instanceof Error?e.message:String(e)});}
}
/** The packs to start with: those handed over, then those this build kept from an earlier visit. Reading the store
 * can only add packs; if it fails or is empty the regions compile during the replay as before. */
export async function withKeptRegions(data:ReturnRequest,store=data.kept?regionStore(data.kept.build):undefined):Promise<ReturnRequest> {
  if(!data.kept||!store)return data;
  const kept=(await store.load(data.kept.wanted)).filter((p):p is GeometryRegionPack=>!!p);
  return kept.length?{...data,packs:[...(data.packs??[]),...kept]}:data;
}
if(typeof self!=='undefined'&&typeof (self as unknown as {document?:unknown}).document==='undefined')self.onmessage=({data}:{data:ReturnRequest})=>{
  const send=(msg:ReturnMessage)=>self.postMessage(msg);
  withKeptRegions(data).catch(()=>data).then(ready=>runReturn(ready,send));
};
