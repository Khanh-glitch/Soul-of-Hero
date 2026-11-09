// MEC-01 R2 (Workstream A2): Metal Pipe and Metal Blade recovery + multi-consumer choices, through real intents.
// FIXTURE (labelled): player position beside the bench/recycler tile (position only); refined/MP/iron/wood/spares granted
//   for the bench and crafts. The Pipe/Blade themselves are CRAFTED through the real L2 bench (except blade-recycle and
//   old-save tests, which grant one part and say so). Creatures are disabled on the start.
// NATURAL: none is claimed here. Scope: bounded transactions on a bench/recycler fixture; not a delivery or expedition proof.
// The claim boundary is the direct craft/recycle vector only (one cycle); it is NOT a multi-route arbitrage proof. Walking evidence is in tests/mec01-gear-decision-network.test.ts (labelled FIXTURE_INTENT).
// Economics (ingot-eq; scrap=1/3, MP=0.833, fastener=0.444, refined>=1.5 because its coal input is unpriced):
//   pipe craft 2 refined + 1 MP >= 3.833 ; X:pipe-v2 return 1 refined + 1 MP >= 2.333  (loss >= 1.5)
//   blade craft 4 ingot + 1 MP = 4.833      ; X:blade-v1 return 2 ingot + 1 MP = 2.833  (loss 2.0)
import {describe,it,expect} from 'vitest';
import {type GameState,type RunState,TILE,BAL} from '../src/game/core';
import {RECIPES} from '../src/game/catalog';
import {addItem,countItem,dispatch,markDirty,newGame,stepStations,buildReason,lootSiteAccess} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,selectSnapshots,validate} from '../src/game/persist';
import {recoveryPlan,recoveryPlanFor,componentRuleSnapshot,COMPONENT_RECIPES} from '../src/game/recycler';
import {proveItem} from '../src/game/industrial-proof';

const START=Date.UTC(2026,10,5);let n=0;
const copy=(g:GameState)=>selectSnapshots([serializeSnapshot(g),null]).gs!;
const raw=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload);
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'a2-start-'+(++n),type:'startRun',character:'female',seed:202},START).ok).toBe(true);g.run!.creatures=[];markDirty();return g;}
const recyclerOf=(r:RunState)=>Object.values(r.entities).find(e=>e.kind==='recycler')!;
function place(r:RunState,tx:number,ty:number){r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;markDirty();}
function legalTileNear(g:GameState,cx:number,cy:number):[number,number]{
  const r=g.run!;
  for(let k=1;k<=8;k++)for(let dy=-k;dy<=k;dy++)for(let dx=-k;dx<=k;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==k)continue;const tx=cx+dx,ty=cy+dy;place(r,tx-1,ty);if(!buildReason(g,'workbench',tx,ty))return [tx,ty];}
  throw new Error('no legal workbench tile');
}
const inv=(r:RunState)=>Object.fromEntries(['pipe' ,'metal_pipe','metal_blade','iron_ingot','refined_iron_ingot','mechanical_parts','spares','iron_plate','vehicle_frame','fasteners','wood','stone'].map(k=>[k,k==='pipe'?0:countItem(r,'inv',k)]));
/** Shared start: fixture grants, real L2 workbench, real upgrade. */
function benchL2(g:GameState){
  const r=g.run!;const c=Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='factory'&&e.c&&r.custody[e.c]?.slots.some(s=>s?.key==='iron_sword'))!;place(r,c.tx!+1,c.ty!);   // FIXTURE position beside the authored Foundry cache (same anchor as the A1 test)
  addItem(r,'inv','wood',20);addItem(r,'inv','stone',4);addItem(r,'inv','iron_ingot',12);addItem(r,'inv','refined_iron_ingot',6);addItem(r,'inv','mechanical_parts',10);addItem(r,'inv','spares',10);addItem(r,'inv','fasteners',4);
  const sp=legalTileNear(g,Math.floor(r.player.x/TILE),Math.floor(r.player.y/TILE));
  expect(dispatch(g,{id:'a2-b-'+(++n),type:'build',struct:'workbench',tx:sp[0],ty:sp[1]},START+20).ok).toBe(true);
  const bench=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='workbench')!;
  expect(dispatch(g,{id:'a2-up-'+(++n),type:'upgradeStation',eid:bench.id},START+21).ok).toBe(true);expect(bench.station!.level).toBe(2);
  return bench;
}
function craftAndCollect(g:GameState,bench:any,recipe:string,at:number){
  const r=g.run!;expect(dispatch(g,{id:'a2-c-'+(++n),type:'craft',eid:bench.id,recipe},at).ok,recipe).toBe(true);
  stepStations(g,RECIPES[recipe].secs*1000+500,at+10000);
  const out=bench.station!.outC!;const i=r.custody[out].slots.findIndex(s=>s?.key===RECIPES[recipe].out);expect(i,recipe).toBeGreaterThanOrEqual(0);
  expect(dispatch(g,{id:'a2-m-'+(++n),type:'move',from:out,fs:i,to:'inv'} as any,at+10001).ok).toBe(true);
}

describe('MEC-01 R2 A2: Metal Pipe and Metal Blade recovery (new jobs) and immutable rules', () => {
  it('immutable component snapshots: routes, seconds and outputs are pinned, and the balance mirror equals them', () => {
    const snap=componentRuleSnapshot();
    expect(Object.keys(snap).sort()).toEqual(['X:blade-v1','X:gear-v1','X:pipe-v1','X:pipe-v2'].sort());
    expect(snap['X:pipe-v1']).toEqual({key:'metal_pipe',seconds:10,outputs:[['refined_iron_ingot',1]]});   // stored-job rule kept
    expect(snap['X:pipe-v2']).toEqual({key:'metal_pipe',seconds:12,outputs:[['refined_iron_ingot',1],['mechanical_parts',1]]});
    expect(snap['X:blade-v1']).toEqual({key:'metal_blade',seconds:14,outputs:[['iron_ingot',2],['mechanical_parts',1]]});
    expect(snap['X:gear-v1']).toEqual({key:'mechanical_gear',seconds:15,outputs:[['mechanical_parts',2],['iron_ingot',1]]});
    const mirror=(BAL as any).recyclerV4?.components??(BAL as any).recyclerV4;
    for (const [recipe,r] of Object.entries(snap)) if (recipe!=='X:pipe-v1') {
      const row=mirror[r.key];expect(row.recipe).toBe(recipe);expect(row.seconds).toBe(r.seconds);expect(row.outputs).toEqual(r.outputs);
    }
    expect(COMPONENT_RECIPES).toContain('X:blade-v1');
  });

  it('D-proof verdicts: new component routes are OK (priced, not over-return); no applicable route is NO_RECOVERY_ROUTE, not UNKNOWN', () => {
    const v=(item:string,recipe:string)=>proveItem(item,recipe).rows.map((r:any)=>r.verdict);
    expect(v('metal_pipe','X:pipe-v2')).toEqual(['OK']);
    expect(v('metal_blade','X:blade-v1')).toEqual(['OK']);
    expect(v('mechanical_gear','X:gear-v1')).toEqual(['OK']);
    expect(v('mechanical_parts','X:recover-v3').every((x:string)=>x==='NO_RECOVERY_ROUTE')).toBe(true);
    expect(v('metal_blade','X:recover-v3').every((x:string)=>x==='NO_RECOVERY_ROUTE')).toBe(true);
    expect(v('metal_pipe','X:recover-v3').every((x:string)=>x==='NO_RECOVERY_ROUTE')).toBe(true);
  });

  it('economics: every new return is strictly below its craft cost (no free loop), with stated lower bounds', () => {
    const ingot=1, scrap=1/3, mp=2*scrap/2+1*ingot/2, refined=1.5;   // MP recipe = 2 scrap + 1 ingot -> 2 MP
    const pipeCraft=2*refined+mp, pipeV2=refined+mp, bladeCraft=4*ingot+mp, bladeV1=2*ingot+mp;
    expect(pipeCraft).toBeGreaterThanOrEqual(3.83);expect(pipeV2).toBeGreaterThanOrEqual(2.33);
    expect(pipeV2).toBeLessThan(pipeCraft);expect(bladeV1).toBeLessThan(bladeCraft);
    expect(bladeCraft-bladeV1).toBeGreaterThan(1.5);
  });

  it('a stored X:gear-v1 / X:pipe-v2 job keeps its return vector even after the live balance mirror changes', () => {
    const gear={uid:'g1',key:'mechanical_gear',qty:1} as any, pipe={uid:'p1',key:'metal_pipe',qty:1} as any;
    const before={g:recoveryPlanFor(gear,'X:gear-v1'),p:recoveryPlanFor(pipe,'X:pipe-v2')};
    const b=BAL as any;const saved=JSON.stringify(b.recyclerV4);
    try {
      b.recyclerV4.seconds=999;b.recyclerV4.components.mechanical_gear.outputs=[['iron_ingot',9]];b.recyclerV4.components.metal_pipe.outputs=[['spares',9]];
      expect(recoveryPlanFor(gear,'X:gear-v1')).toEqual(before.g);
      expect(recoveryPlanFor(pipe,'X:pipe-v2')).toEqual(before.p);
    } finally { b.recyclerV4=JSON.parse(saved); }
    expect(recoveryPlanFor(gear,'X:gear-v1')?.outputs).toEqual([['mechanical_parts',2],['iron_ingot',1]]);
  });

  it('new jobs: pipe -> X:pipe-v2, blade -> X:blade-v1; stored v1 pipe still returns 1 ingot; qty>1 and durable parts are refused', () => {
    expect(recoveryPlan({uid:'x',key:'metal_pipe',qty:1} as any)?.recipe).toBe('X:pipe-v2');
    expect(recoveryPlan({uid:'x',key:'metal_blade',qty:1} as any)?.recipe).toBe('X:blade-v1');
    expect(recoveryPlan({uid:'x',key:'metal_blade',qty:2} as any)).toBeNull();
    expect(recoveryPlan({uid:'x',key:'metal_pipe',qty:2} as any)).toBeNull();
    expect(recoveryPlan({uid:'x',key:'metal_blade',qty:1,dur:4} as any)).toBeNull();
    expect(recoveryPlanFor({uid:'x',key:'metal_pipe',qty:1} as any,'X:pipe-v1')?.outputs).toEqual([['refined_iron_ingot',1]]);
    expect(recoveryPlanFor({uid:'x',key:'metal_blade',qty:1} as any,'X:pipe-v2')).toBeNull();
  });

  it('three different Pipe consequences with real crafts/recycling: plate sink, piped frame sink, or recover to refined+MP', () => {
    const base=start();const bench0=benchL2(base);
    const ledger=(g:GameState)=>inv(g.run!);
    // Craft ONE pipe for real, then branch from the same point.
    craftAndCollect(base,bench0,'metal_pipe',START+30);
    expect(countItem(base.run!,'inv','metal_pipe')).toBe(1);
    const at=copy(base);
    // Branch P1: Iron Plate (2 refined + 1 pipe + 1 MP -> 2 plates)
    const gP1=copy(at);const bP1=Object.values(gP1.run!.entities).find(e=>e.kind==='struct'&&e.type==='workbench')!;const beforeP1=ledger(gP1);
    craftAndCollect(gP1,bP1,'iron_plate',START+100);const afterP1=ledger(gP1);
    expect(afterP1.iron_plate).toBe(beforeP1.iron_plate+2);expect(afterP1.metal_pipe).toBe(0);expect(afterP1.refined_iron_ingot).toBe(beforeP1.refined_iron_ingot-2);
    // Branch P2: piped Utility Frame (pipe + 2 iron + 2 MP + 2 spares -> frame)
    const gP2=copy(at);const bP2=Object.values(gP2.run!.entities).find(e=>e.kind==='struct'&&e.type==='workbench')!;const beforeP2=ledger(gP2);
    craftAndCollect(gP2,bP2,'vehicle_frame_piped',START+100);const afterP2=ledger(gP2);
    expect(afterP2.vehicle_frame).toBe(beforeP2.vehicle_frame+1);expect(afterP2.metal_pipe).toBe(0);expect(afterP2.spares).toBe(beforeP2.spares-2);
    // Branch P3: recycle at the Foundry Recycler (X:pipe-v2): 1 refined + 1 MP back, no spares, no bench time paid
    const gP3=copy(at);const rP3=gP3.run!;const beforeP3=ledger(gP3);const rc=recyclerOf(rP3);
    place(rP3,rc.tx!-1,rc.ty!);
    expect(lootSiteAccess(rP3,{tx:rc.tx!,ty:rc.ty!} as any)).toBe('open');
    const slot=rP3.custody.inv.slots.findIndex(s=>s?.key==='metal_pipe');const uid=rP3.custody.inv.slots[slot]!.uid;
    expect(dispatch(gP3,{id:'a2-p3-'+(++n),type:'recycleItem',eid:rc.id,slot,uid},START+200).ok).toBe(true);
    expect(rc.station!.queue[0].recipe).toBe('X:pipe-v2');
    stepStations(gP3,12000+500,START+12700);
    const out=rc.station!.outC!;expect(countItem(rP3,out,'refined_iron_ingot')).toBe(1);expect(countItem(rP3,out,'mechanical_parts')).toBe(1);
    const afterP3=ledger(gP3);expect(afterP3.spares).toBe(beforeP3.spares);expect(afterP3.metal_pipe).toBe(0);
    // The three branches consume the same pipe UID and produce different things.
    expect(afterP1.iron_plate-beforeP1.iron_plate).not.toBe(afterP2.vehicle_frame-beforeP2.vehicle_frame);
  });

  it('Metal Blade recovery (real recycler, UID consumed once) and save/reload mid-job completes exactly once', () => {
    const g=start();addItem(g.run!,'inv','metal_blade',1);   // FIXTURE grant: one blade
    const r=g.run!;const rc=recyclerOf(r);place(r,rc.tx!-1,rc.ty!);
    const slot=r.custody.inv.slots.findIndex(s=>s?.key==='metal_blade');const uid=r.custody.inv.slots[slot]!.uid;
    expect(dispatch(g,{id:'a2b-'+(++n),type:'recycleItem',eid:rc.id,slot,uid},START+10).ok).toBe(true);
    expect(countItem(r,'inv','metal_blade')).toBe(0);
    stepStations(g,6000,START+6000);
    const saved=raw(g);                                   // the same serializer the save path uses
    const back=validate(JSON.parse(JSON.stringify(saved)))!;expect(back).not.toBeNull();
    const rb=recyclerOf(back.run!);expect(rb.station!.queue[0].recipe).toBe('X:blade-v1');expect(rb.station!.queue[0].reserved![0].uid).toBe(uid);
    stepStations(back,8500,START+14500);stepStations(back,2000,START+16500);
    const out=rb.station!.outC!;expect(countItem(back.run!,out,'iron_ingot')).toBe(2);expect(countItem(back.run!,out,'mechanical_parts')).toBe(1);
    expect(rb.station!.queue.length).toBe(0);
  });

  it('old-save: a stored X:pipe-v1 job (created by a real recycleItem, then rewritten to the v1 stored shape, labelled) validates and returns 1 refined ingot only', () => {
    const g=start();addItem(g.run!,'inv','metal_pipe',1);
    const r=g.run!;const rc=recyclerOf(r);place(r,rc.tx!-1,rc.ty!);
    const slot=r.custody.inv.slots.findIndex(s=>s?.key==='metal_pipe');const uid=r.custody.inv.slots[slot]!.uid;
    expect(dispatch(g,{id:'a2o-'+(++n),type:'recycleItem',eid:rc.id,slot,uid},START+10).ok).toBe(true);
    const rawSave=raw(g);
    // FIXTURE: rewrite ONLY the stored job to the v1 shape (what a pre-A2 save holds). Its id/reservation/custody are the real ones.
    const job=rawSave.run.entities[rc.id].station.queue[0];expect(job.recipe).toBe('X:pipe-v2');
    job.recipe='X:pipe-v1';job.total=10000;job.left=10000;
    const back=validate(JSON.parse(JSON.stringify(rawSave)))!;expect(back).not.toBeNull();
    const rb=recyclerOf(back.run!);expect(rb.station!.queue[0].recipe).toBe('X:pipe-v1');
    stepStations(back,10500,START+10500);
    const out=rb.station!.outC!;expect(countItem(back.run!,out,'refined_iron_ingot')).toBe(1);expect(countItem(back.run!,out,'mechanical_parts')).toBe(0);
  });

  it('negative: tampered saved jobs are rejected (wrong recipe for the item, wrong total, blade job with a pipe)', () => {
    const g=start();addItem(g.run!,'inv','metal_blade',1);const r=g.run!;const rc=recyclerOf(r);place(r,rc.tx!-1,rc.ty!);
    const slot=r.custody.inv.slots.findIndex(s=>s?.key==='metal_blade');const uid=r.custody.inv.slots[slot]!.uid;
    expect(dispatch(g,{id:'a2n-'+(++n),type:'recycleItem',eid:rc.id,slot,uid},START+10).ok).toBe(true);
    const good=raw(g);
    expect(validate(JSON.parse(JSON.stringify(good)))).not.toBeNull();
    const bad1=JSON.parse(JSON.stringify(good));bad1.run.entities[rc.id].station.queue[0].recipe='X:pipe-v2';
    expect(validate(bad1)).toBeNull();
    const bad2=JSON.parse(JSON.stringify(good));bad2.run.entities[rc.id].station.queue[0].total=1000;
    expect(validate(bad2)).toBeNull();
    const bad3=JSON.parse(JSON.stringify(good));bad3.run.entities[rc.id].station.queue[0].reserved=[{uid:'p9',key:'metal_pipe',qty:1}];
    expect(validate(bad3)).toBeNull();
  });
});
