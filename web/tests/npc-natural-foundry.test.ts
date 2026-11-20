import { it, expect } from 'vitest';
import { newGame, startRun, C, beginReceiptSink, endReceiptSink, findRunEntity } from '../src/game/engine';
import { setActiveLayout, VEYRA_RECYCLER_SITE } from '../src/game/world';
import { humanEntityTile } from '../src/game/human-jobs';
import { recoveryPlan } from '../src/game/recycler';
import { settle } from '../src/game/sim';
import { T0 } from './helpers/g1b-kit';

// Full island, ordinary geographic start, fixed seed for reproducibility. The only
// clock driver is settle; no inspection landing, actor edits, injected loot or jobs.
it('a Slagworks salvager delivers a naturally extracted component and brings back its paid metal',()=>{
  setActiveLayout('veyra05-world'); const gs=newGame();
  expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
  const r=gs.run!,hw=r.humanWorld!,comm=hw.communities['com:po_slag'];
  const h=comm.memberIds.map(id=>hw.people[id]).find(h=>h.occupation==='salvager')!;
  const store=C(r,comm.storeContainers[0]),pack=C(r,h.inv.packId);
  expect(r.qaUsed).toBe(false);
  expect([...pack.slots,...store.slots].some(s=>s && recoveryPlan({...s,qty:1}))).toBe(false);
  const rows=()=>Object.values(comm.cargoLedger??{}).flat();
  const result=()=>rows().find(x=>x.workerId===h.actorId && x.recipe?.startsWith('X:'));
  const events:ReturnType<typeof endReceiptSink>=[];
  for(let sec=30;sec<=600&&!result();sec+=30){
    beginReceiptSink();try{settle(gs,T0+sec*1000,true);}finally{
      events.push(...endReceiptSink().filter(e=>e.detail.includes(`"${h.actorId}"`)));
    }
  }
  const final=result();expect(final,h.lastWorkBlock).toBeDefined();
  const records=(kind:string)=>events.filter(e=>e.kind===kind).map(e=>({...JSON.parse(e.detail),at:e.at}));
  const payment=records('human.production.pay').filter(e=>e.jobId===final!.jobId);expect(payment).toHaveLength(1);
  const [pay]=payment, [input]=pay.inputs;
  const machine=findRunEntity(r,pay.stationId)!;expect(machine.kind).toBe('recycler');
  expect(humanEntityTile(r,machine)).toEqual([VEYRA_RECYCLER_SITE.tx,VEYRA_RECYCLER_SITE.ty]);
  const fetch=records('human.work.input').find(e=>e.receivedUid===input.uid);
  expect(fetch).toMatchObject({containerId:store.id,into:pack.id});
  const raw=rows().find(row=>row.workerId===h.actorId && row.sourceId && row.intoUid===fetch.inputs[0].uid);
  expect(raw).toMatchObject({key:input.key,qty:1});
  const yields=records('human.harvest.output').filter(e=>e.uid===raw!.fromUid);expect(yields).toHaveLength(1);
  const extraction=records('human.salvage.extract').find(e=>e.jobId===raw!.jobId);
  expect(extraction).toMatchObject({sourceId:raw!.sourceId,floor:0});expect(extraction.stockAfter).toBe(extraction.stockBefore-1);
  expect(extraction.hpAfter).toBeLessThan(extraction.hpBefore);expect(extraction.durAfter).toBe(extraction.durBefore-1);
  const finish=records('human.production.finish').filter(e=>e.jobId===pay.jobId);expect(finish).toHaveLength(1);
  expect(finish[0].at-pay.at).toBeGreaterThanOrEqual(pay.totalMs-1);
  expect(finish[0].outputs).toContainEqual({uid:final!.fromUid,key:final!.key,qty:final!.qty});
  expect(records('human.production.pickup').filter(e=>e.uid===final!.fromUid)).toHaveLength(1);
  expect(store.slots.find(s=>s?.uid===final!.intoUid)).toMatchObject({key:final!.key,qty:final!.qty});
  console.log('NATURAL_FOUNDRY',JSON.stringify({seed:r.seed,population:Object.keys(hw.people).length,storeId:store.id,extraction,raw,fetch,pay,finish:finish[0],final}));
},360000);
