import {writeFileSync} from 'node:fs';
import {expect} from 'vitest';
import {C,beginReceiptSink,endReceiptSink} from '../../src/game/engine';
import type {GameState} from '../../src/game/core';
import {settle} from '../../src/game/sim';

/** Long opt-in observation, using the ordinary offline integrator. No edits to
 * needs, time scales, NPC orders or custody. A ten-minute snapshot can miss
 * BOTH an unloading and a meal, so keep receipts across each whole window. */
export function watchPantry(gs:GameState,worker:string,jobId:string,uid:string,output:string){
  const r=gs.run!,hw=r.humanWorld!,cook=hw.people[worker],community=hw.communities[cook.community!];
  const stock=C(r,community.storeContainers[0]),pack=C(r,cook.inv.packId);
  const inventory=()=>stock.slots.map(s=>s&&({uid:s.uid,key:s.key,qty:s.qty}));
  const start=r.clock.lastSimAt,until=r.startedAt+24*3600000;
  const production=pack.slots.find(s=>s?.uid===uid)?.production;
  expect(production).toMatchObject({workerId:worker,jobId,recipe:'stew'});
  for(let t=start;t<until;){
    const before=inventory(),from=t;
    t=Math.min(t+600000,until);beginReceiptSink();let events;
    try{settle(gs,t,true);}finally{events=endReceiptSink();}
    const ledger=Object.values(community.cargoLedger??{}).flat().filter(row=>row.jobId===jobId);
    if(!ledger.length){expect(pack.slots.find(s=>s?.uid===uid)?.production?.jobId).toBe(jobId);continue;}

    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({workerId:worker,fromUid:uid,intoUid:uid,qty:1,key:'stew',inputs:production!.inputs});
    const lineage=events.filter(e=>e.kind==='human.cargo.lineage').map(e=>({...e,detail:JSON.parse(e.detail)}))
      .filter(e=>e.detail.containerId===stock.id&&e.detail.transferUid===uid);
    expect(lineage).toHaveLength(1);expect(lineage[0].detail.lineage).toEqual(ledger);
    const delivered=events.filter(e=>e.kind==='human.cargo.deliver'&&e.detail===`work:${worker}:${uid}>${uid}:${stock.id}:1`);
    expect(delivered).toHaveLength(1);
    const consumed=events.filter(e=>e.kind==='human.consume').map(e=>({...e,detail:JSON.parse(e.detail)}))
      .filter(e=>e.detail.containerId===stock.id);
    const berries=before.find(s=>s?.key==='berries')!;
    expect(before.filter(Boolean)).toHaveLength(12);expect(berries.qty).toBe(2);
    const vacancy=consumed.filter(e=>e.detail.uid===berries.uid&&e.at<delivered[0].at);
    expect(vacancy.map(e=>[e.detail.actorId,e.detail.qty])).toEqual([['hq',1],[worker,1]]);
    const eaten=consumed.filter(e=>e.detail.uid===uid);
    expect(eaten).toHaveLength(1);expect(eaten[0].detail).toMatchObject({actorId:'hn',key:'stew',qty:1});
    expect(eaten[0].at).toBeGreaterThan(delivered[0].at);
    expect(pack.slots.some(s=>s?.uid===uid)).toBe(false);expect(stock.slots.some(s=>s?.uid===uid)).toBe(false);
    expect(r.qaUsed).toBeFalsy();
    writeFileSync(output,JSON.stringify({seed:r.seed,runStart:r.startedAt,watchStart:start,window:[from,t],jobId,worker,uid,container:stock.id,before,vacancy,ledger,lineage,delivered,eaten,after:inventory()},null,2)+'\n');
    return;
  }
  throw new Error('No verified stew delivery by 24 hours of run time');
}
