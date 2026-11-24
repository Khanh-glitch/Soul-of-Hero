import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {it,expect} from 'vitest';
import {selectSnapshots,serializeSnapshot} from '../src/game/persist';
import {setActiveLayout} from '../src/game/world';
import {beginReceiptSink,endReceiptSink} from '../src/game/engine';
import {settle} from '../src/game/sim';

it('a blocked Hook cook resumes through the ordinary scheduler, delivering the same paid lot',()=>{
 const gs=selectSnapshots([gunzipSync(readFileSync('evidence/npc-integration/coast-62c9dae/h8.save.gz')).toString()]).gs!;
 const r=gs.run!,hw=r.humanWorld!,h=hw.people.hm,comm=hw.communities[h.community!],start=r.clock.lastSimAt;
 expect(setActiveLayout(r.layoutId!)).toBe(true);expect(h.deliveryWait).toBeTruthy();expect(h.workOutputs).toMatchObject({saha:1});
 const events:ReturnType<typeof endReceiptSink>=[];
 for(let minute=5;minute<=60&&!comm.cargoLedger?.saha;minute+=5){
   beginReceiptSink();try{settle(gs,start+minute*60000,true);}finally{events.push(...endReceiptSink().filter(v=>v.kind==='human.pantry.repack'||v.kind==='human.cargo.lineage'&&v.detail.includes('saha')));}
 }
 const repack=events.filter(v=>v.kind==='human.pantry.repack'&&JSON.parse(v.detail).meal==='saha');expect(repack).toHaveLength(1);
 const line=comm.cargoLedger?.saha;expect(line).toHaveLength(1);expect(line![0]).toMatchObject({jobId:'jah5',workerId:'hm',fromUid:'saha',intoUid:'saha',key:'grilled_mushroom',qty:1});expect(h.workOutputs?.saha).toBeUndefined();
 const loaded=selectSnapshots([serializeSnapshot(gs)]).gs!;settle(loaded,r.clock.lastSimAt,true);expect(loaded.run!.humanWorld!.communities[comm.id].cargoLedger?.saha).toEqual(line);
 const evidence={seed:r.seed,run:r.id,start,at:r.clock.lastSimAt,repack,line,qa:!!r.qaUsed};console.log('HOOK_PANTRY',JSON.stringify(evidence));
 if(process.env.SOH_HOOK_REPORT)writeFileSync(process.env.SOH_HOOK_REPORT,JSON.stringify(evidence,null,2)+'\n');
},240000);
