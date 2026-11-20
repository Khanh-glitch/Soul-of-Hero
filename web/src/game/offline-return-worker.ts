// One independent world per Continue. No storage writes in this worker: the
// title screen owns the save and can cancel without applying half a settlement.
import { selectSnapshots, serializeSnapshot } from './persist';
import { settleWithReturn } from './return-report';
import { setActiveLayout } from './world';
import { getWindowWorld } from '../veyra05/window';
import { isVeyra05Layout } from '../veyra05/scenes';
import { syncFloor } from '../veyra05/floors';
import { markDirty } from './engine';
export type ReturnMessage = {kind:'progress'; fraction:number} | {kind:'complete';snapshot:string;result:ReturnType<typeof settleWithReturn>} | {kind:'failed';reason:string};
self.onmessage = ({data}:{data:{snapshot:string;now:number}}) => {
  const send=(msg:ReturnMessage)=>self.postMessage(msg);
  try {
    const gs=selectSnapshots([data.snapshot]).gs;
    if(!gs?.run || !Number.isFinite(data.now))throw Error('Invalid Continue checkpoint.');
    const layout=gs.run.layoutId??'shipping';if(!setActiveLayout(layout))throw Error('Missing saved island.');
    if(isVeyra05Layout(layout)){const ww=getWindowWorld(layout);syncFloor(gs,ww,ww.floors,markDirty);}
    let last=-1;
    const result=settleWithReturn(gs,data.now,(fraction)=>{const pct=Math.floor(100*fraction);if(pct>last){last=pct;send({kind:'progress',fraction:pct/100});}});
    send({kind:'complete',snapshot:serializeSnapshot(gs),result});
  }catch(e){send({kind:'failed',reason:e instanceof Error?e.message:String(e)});}
};
