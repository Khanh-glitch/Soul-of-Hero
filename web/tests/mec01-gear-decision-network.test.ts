// MEC-01 R2 (Workstream A1): one legitimately found Mechanical Gear -> three different useful actions, through real intents.
// FIXTURE_INTENT (not NATURAL_INPUT): the 'move' intent transfers the gear out of the authored Foundry cache custody; the player's
//   actor is NOT walked from spawn. Reach is a grid BFS classifier (lootSiteAccess), not an input or LOS trace. SNAPSHOT_SAME_PROCESS for saves.
// FIXTURE (labelled): the player actor is placed beside the bench/recycler tile (position only), and wood 20, stone 4, leather 1,
//   iron ingot 5 are granted. The gear itself is NOT granted. Each branch starts from the same save point (snapshot clone).
// Branches (same carried gear, UID-tracked):
//   A  Geared Motor Drive (workbench L2 craft, paid queue)     -> vehicle_drive; spends 2 spares + 2 fasteners + 1 ingot.
//   B  Salvager Pick (geared) (iron pick -> geared upgrade)   -> industrial_pick; spends 2 spares; keeps an L2 bench.
//   C  Foundry Recycler (X:gear-v1, real time, physical output) -> 2 Mechanical Parts + 1 Iron Ingot; spends no spares.
import {describe,it,expect} from 'vitest';
import {type GameState,type RunState,TILE} from '../src/game/core';
import {RECIPES,ITEMS} from '../src/game/catalog';
import {addItem,countItem,dispatch,markDirty,newGame,stepStations,buildReason,lootSiteAccess} from '../src/game/engine';
import {setActiveLayout,getWorld} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {recoveryPlan,recoveryPlanFor} from '../src/game/recycler';
import {BAL} from '../src/game/core';

const START=Date.UTC(2026,10,5);
let n=0;
const copy=(g:GameState)=>selectSnapshots([serializeSnapshot(g),null]).gs!;
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'a1-start-'+(++n),type:'startRun',character:'female',seed:101},START).ok).toBe(true);g.run!.creatures=[];markDirty();return g;}
const cacheOf=(r:RunState)=>Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='factory'&&e.c&&r.custody[e.c]?.slots.some(s=>s?.key==='iron_sword'))!;
const recyclerOf=(r:RunState)=>Object.values(r.entities).find(e=>e.kind==='recycler')!;
function place(r:RunState,tx:number,ty:number){r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;markDirty();}
function legalTileNear(g:GameState,cx:number,cy:number):[number,number]{
  const r=g.run!;
  for (let k=1;k<=8;k++) for (let dy=-k;dy<=k;dy++) for (let dx=-k;dx<=k;dx++) { if (Math.max(Math.abs(dx),Math.abs(dy))!==k) continue; const tx=cx+dx,ty=cy+dy; place(r,tx-1,ty); if (!buildReason(g,'workbench',tx,ty)) return [tx,ty]; }
  throw new Error('no legal workbench tile');
}
function invSnapshot(r:RunState){const keys=['mechanical_gear','mechanical_parts','iron_ingot','fasteners','spares','iron_pick','wood','stone','leather','refined_iron_ingot','vehicle_drive','industrial_pick'];return Object.fromEntries(keys.map(k=>[k,countItem(r,'inv',k)]));}
function moveOut(g:GameState,from:string,key:string,at:number){const r=g.run!;const fs=r.custody[from].slots.findIndex(s=>s?.key===key);expect(fs,key).toBeGreaterThanOrEqual(0);return dispatch(g,{id:'a1-mv-'+(++n),type:'move',from,fs,to:'inv'} as any,at);}
/** Shared save point: the gear is taken from the authored cache by real moves; fixture materials are granted. */
function savePoint(){
  const g=start();const r=g.run!;const c=cacheOf(r);
  place(r,c.tx!+1,c.ty!);                       // FIXTURE position beside the cache; reach measured below
  expect(lootSiteAccess(r,getWorld('shipping_fresh').statics.find(s=>s.kind==='loot'&&s.poi==='factory'&&s.loot?.some(([k])=>k==='iron_sword'))!)).toBe('open');
  for (const k of ['mechanical_gear','mechanical_parts','fasteners','spares']) expect(moveOut(g,c.c!,k,START+5).ok,k).toBe(true);   // NATURAL
  expect(countItem(r,'inv','mechanical_gear')).toBe(1);
  addItem(r,'inv','wood',20);addItem(r,'inv','stone',4);addItem(r,'inv','leather',1);addItem(r,'inv','iron_ingot',5);  // FIXTURE grants (wood: bench + pick)
  return {g:copy(g),spawn:{tx:Math.floor(r.player.x/TILE),ty:Math.floor(r.player.y/TILE)}};
}
function gearUid(r:RunState){const s=r.custody.inv.slots.find(s=>s?.key==='mechanical_gear');return s!.uid;}

describe('MEC-01 R2 A1: one found Mechanical Gear, three competing actions', () => {
  it('Workstream A1 static contract: recycling is a loss vs craft; the recovery is versioned and gear-only', () => {
    const ingot=1, scrap=1/3, mp=0.5*ingot+1*scrap, fast=1/3*ingot+1/3*scrap;
    const gearCraft=2*ingot+2*mp+fast;
    const ret=BAL.recyclerV4.components.mechanical_gear.outputs.reduce((a:number,[k,q]:any)=>a+q*(k==='mechanical_parts'?mp:k==='iron_ingot'?ingot:0),0);
    expect(ret).toBeLessThan(gearCraft);                                // no loop: ~2.67 < ~4.11 ingot-eq
    expect(gearCraft-ret).toBeGreaterThan(1);
    const plan=recoveryPlan({uid:'x',key:'mechanical_gear',qty:1} as any);
    expect(plan?.recipe).toBe('X:gear-v1');expect(plan?.total).toBe(BAL.recyclerV4.seconds*1000);
    expect(recoveryPlan({uid:'x',key:'mechanical_gear',qty:2} as any)).toBeNull();          // split first
    expect(recoveryPlan({uid:'x',key:'mechanical_gear',qty:1,dur:3} as any)).toBeNull();    // not a durable part
    expect(recoveryPlanFor({uid:'x',key:'mechanical_gear',qty:1} as any,'X:gear-v1')).not.toBeNull();
    expect(recoveryPlanFor({uid:'x',key:'metal_pipe',qty:1} as any,'X:gear-v1')).toBeNull();
    // Old tables keep their old keys: no v1/v2/v3 route returns gear.
    expect(BAL.recyclerV3.rules).not.toHaveProperty('mechanical_gear');
    expect(BAL.recyclerV2.rules).not.toHaveProperty('mechanical_gear');
    expect(BAL.recyclerV1.rules).not.toHaveProperty('mechanical_gear');
  });

  it('branch C (recycle) is real (FIXTURE_INTENT): one gear UID is consumed, the recycler works for real time, and two parts + one ingot come out', () => {
    const {g:base}=savePoint();const g=copy(base);const r=g.run!;
    const rc=recyclerOf(r);const uid=gearUid(r);const before=invSnapshot(r);
    place(r,rc.tx!-1,rc.ty!);                    // FIXTURE position beside the Foundry Recycler (site access measured below; the walk itself is not claimed as natural)
    expect(lootSiteAccess(r,{tx:rc.tx!,ty:rc.ty!} as any)).toBe('open');
    const slot=r.custody.inv.slots.findIndex(s=>s?.key==='mechanical_gear');
    expect(dispatch(g,{id:'a1c-rc-'+(++n),type:'recycleItem',eid:rc.id,slot,uid},START+10).ok).toBe(true);
    expect(countItem(r,'inv','mechanical_gear')).toBe(0);
    const job=rc.station!.queue[0];expect(job.recipe).toBe('X:gear-v1');expect(job.reserved![0].uid).toBe(uid);
    stepStations(g,14000,START+10000);expect(countItem(r,rc.station!.outC!,'mechanical_parts')).toBe(0);   // not before 15 s
    stepStations(g,1500,START+15500);
    const out=rc.station!.outC!;
    expect(countItem(r,out,'mechanical_parts')).toBe(2);expect(countItem(r,out,'iron_ingot')).toBe(1);
    expect(countItem(r,'inv','spares')).toBe(before.spares);expect(countItem(r,'inv','fasteners')).toBe(before.fasteners);
    expect(countItem(r,'inv','iron_pick')).toBe(0);      // no tool was touched
    expect(rc.station!.queue.length).toBe(0);
  });

  it('branch A (drive) and branch B (geared Salvager Pick) both need the real L2 bench, and cost different things', () => {
    const {g:base}=savePoint();
    // PA1 §24: pay for the packed Workbench before looking for a site — buildReason demands the pack,
    // not the ore, so the scan below would otherwise never return. (This is why the test failed at 023ec62.)
    const runBench=(g:GameState)=>{const r=g.run!;expect(dispatch(g,{id:'a1-pack-'+(++n),type:'craft',recipe:'deploy_workbench'},START+19).ok).toBe(true);const sp=legalTileNear(g,Math.floor(r.player.x/TILE),Math.floor(r.player.y/TILE));
      expect(dispatch(g,{id:'a1-b-'+(++n),type:'build',struct:'workbench',tx:sp[0],ty:sp[1]},START+20).ok).toBe(true);
      const bench=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='workbench')!;
      expect(dispatch(g,{id:'a1-up-'+(++n),type:'upgradeStation',eid:bench.id},START+21).ok).toBe(true);expect(bench.station!.level).toBe(2);return bench;};
    // ---- A: drive
    const gA=copy(base);const rA=gA.run!;const beforeA=invSnapshot(rA);const benchA=runBench(gA);
    expect(dispatch(gA,{id:'a1-craftA-'+(++n),type:'craft',eid:benchA.id,recipe:'vehicle_drive_geared'},START+22).ok).toBe(true);
    stepStations(gA,RECIPES.vehicle_drive_geared.secs*1000+500,START+30000);
    const outA=benchA.station!.outC!;expect(countItem(rA,outA,'vehicle_drive')).toBe(1);
    const afterA=invSnapshot(rA);
    expect(afterA.mechanical_gear).toBe(0);expect(beforeA.spares-afterA.spares).toBe(2);expect(beforeA.fasteners-afterA.fasteners).toBe(2);
    // ---- B: geared Salvager Pick (needs an Iron Pickaxe first, then the upgrade)
    const gB=copy(base);const rB=gB.run!;const beforeB=invSnapshot(rB);const benchB=runBench(gB);
    const ipr=dispatch(gB,{id:'a1-ip-'+(++n),type:'craft',eid:benchB.id,recipe:'iron_pick'},START+22);expect((ipr as any).reason??'ok').toBe('ok');
    stepStations(gB,RECIPES.iron_pick.secs*1000+500,START+30000);
    expect(countItem(rB,benchB.station!.outC!,'iron_pick')).toBe(1);
    const fsP=rB.custody[benchB.station!.outC!].slots.findIndex(s=>s?.key==='iron_pick');
    expect(dispatch(gB,{id:'a1-ipc-'+(++n),type:'move',from:benchB.station!.outC!,fs:fsP,to:'inv'} as any,START+31000).ok).toBe(true);
    expect(dispatch(gB,{id:'a1-pk-'+(++n),type:'craft',eid:benchB.id,recipe:'industrial_pick_geared'},START+32000).ok).toBe(true);
    stepStations(gB,RECIPES.industrial_pick_geared.secs*1000+500,START+70000);
    expect(countItem(rB,benchB.station!.outC!,'industrial_pick')).toBe(1);
    const afterB=invSnapshot(rB);
    expect(afterB.mechanical_gear).toBe(0);expect(beforeB.spares-afterB.spares).toBe(2);expect(afterB.iron_pick).toBe(0);
    expect(ITEMS.industrial_pick.power!.ore).toBeGreaterThan(ITEMS.iron_pick.power!.ore!);
    // A yields a drive (a vehicle component, no pick); B yields a pick and consumes the old iron pick UID.
    expect(afterA.vehicle_drive).toBe(0);                 // the drive sits in the bench output, not the pack
    expect(countItem(rA,outA,'vehicle_drive')).toBe(1);
    expect(beforeB.iron_pick).toBe(0);expect(afterB.industrial_pick).toBe(0);
  });

  it('save/reload while the recycler job is in flight (SNAPSHOT_SAME_PROCESS, not a separate-process reload): the reserved gear UID completes exactly once', () => {
    const {g:base}=savePoint();const g=copy(base);const r=g.run!;
    const rc=recyclerOf(r);const uid=gearUid(r);
    place(r,rc.tx!-1,rc.ty!);
    const slot=r.custody.inv.slots.findIndex(s=>s?.key==='mechanical_gear');
    expect(dispatch(g,{id:'a1r-rc-'+(++n),type:'recycleItem',eid:rc.id,slot,uid},START+10).ok).toBe(true);
    stepStations(g,6000,START+6000);
    const saved=copy(g);
    const rr=saved.run!;const rc2=recyclerOf(rr);
    expect(rc2.station!.queue[0].recipe).toBe('X:gear-v1');expect(rc2.station!.queue[0].reserved![0].uid).toBe(uid);
    stepStations(saved,9500,START+15500);stepStations(saved,5000,START+20500);     // keeps running after reload, finishes once
    expect(countItem(rr,rc2.station!.outC!,'mechanical_parts')).toBe(2);expect(countItem(rr,rc2.station!.outC!,'iron_ingot')).toBe(1);
    expect(rc2.station!.queue.length).toBe(0);
    const again=copy(saved);expect(countItem(again.run!,recyclerOf(again.run!).station!.outC!,'mechanical_parts')).toBe(2);
  });

  it('negative: a full output refuses the recycle without consuming the gear; freeing room accepts the same UID', () => {
    const {g:base}=savePoint();const g=copy(base);const r=g.run!;
    const rc=recyclerOf(r);const uid=gearUid(r);place(r,rc.tx!-1,rc.ty!);
    const out=rc.station!.outC!;
    // FIXTURE: fill every output slot with a different non-stacking-compatible item so no room is left for 2 parts + 1 ingot
    const slots=r.custody[out].slots;for(let i=0;i<slots.length;i++)slots[i]={uid:'fill-'+i,key:'wood',qty:ITEMS.wood.max};
    const slot=r.custody.inv.slots.findIndex(s=>s?.key==='mechanical_gear');
    const refused=dispatch(g,{id:'a1n-rc-'+(++n),type:'recycleItem',eid:rc.id,slot,uid},START+10);
    expect(refused.ok).toBe(false);expect(countItem(r,'inv','mechanical_gear')).toBe(1);   // refusal consumes nothing
    // Make room and retry: the same gear UID is accepted.
    for(let i=0;i<slots.length;i++)slots[i]=null;
    expect(dispatch(g,{id:'a1n-rc2-'+(++n),type:'recycleItem',eid:rc.id,slot,uid},START+11).ok).toBe(true);
    stepStations(g,15500,START+15500);
    const outState=countItem(r,out,'mechanical_parts');expect(outState).toBe(2);
  });
});
