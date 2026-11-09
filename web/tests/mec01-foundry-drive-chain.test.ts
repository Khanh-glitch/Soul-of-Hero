// MEC-01 P3: Foundry Gear -> Workbench L2 -> Motor Drive (geared), through real intents.
// NATURAL: moves out of the authored Foundry exterior cache (real move intent, cache reach measured by lootSiteAccess),
//   real build / upgradeStation / craft (paid queue) / output collection, with save/reload checkpoints.
// FIXTURE (labelled): the player is placed beside the cache, and later beside the bench (position only); wood 14, stone 4 and
//   iron ingot 2 are granted (no natural gather/smelt is walked here). The gear, fasteners, spares and parts are NOT granted.
import {describe,it,expect} from 'vitest';
import {type GameState,type RunState,TILE} from '../src/game/core';
import {RECIPES} from '../src/game/catalog';
import {addItem,countItem,dispatch,markDirty,newGame,stepStations,buildReason,lootSiteAccess} from '../src/game/engine';
import {setActiveLayout,getWorld} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {validLootSourceContractV3} from '../src/game/loot-source-v3';

const START=Date.UTC(2026,10,5);
let n=0;
const copy=(g:GameState)=>selectSnapshots([serializeSnapshot(g),null]).gs!;
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'p3-start-'+(++n),type:'startRun',character:'female',seed:101},START).ok).toBe(true);g.run!.creatures=[];markDirty();return g;}
const cacheOf=(r:RunState)=>Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='factory'&&e.c&&r.custody[e.c]?.slots.some(s=>s?.key==='iron_sword'))!;
function place(r:RunState,tx:number,ty:number){r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;markDirty();}
/** Legal workbench tile nearest a centre. buildReason has a reach rule, so the player is placed beside each candidate first (FIXTURE position). */
function legalTileNear(g:GameState,cx:number,cy:number):[number,number]{
  const r=g.run!;
  for (let k=1;k<=8;k++) for (let dy=-k;dy<=k;dy++) for (let dx=-k;dx<=k;dx++) { if (Math.max(Math.abs(dx),Math.abs(dy))!==k) continue; const tx=cx+dx,ty=cy+dy; place(r,tx-1,ty); if (!buildReason(g,'workbench',tx,ty)) return [tx,ty]; }
  throw new Error('no legal workbench tile');
}

describe('MEC-01 P3: Foundry Gear -> Workbench L2 -> Motor Drive (geared)', () => {
  it('the authored cache is physically reachable from spawn, the contract is valid, and the gear comes from it at cycle 0', () => {
    const g=start();const r=g.run!;
    expect(validLootSourceContractV3(r.lootEcology!.sourceContract as any)).toBe(true);   // WEC-01: V3 contract
    const spec=getWorld('shipping_fresh').statics.find(s=>s.kind==='loot'&&s.poi==='factory'&&s.loot?.some(([k])=>k==='iron_sword'))!;
    expect(lootSiteAccess(r,spec)).toBe('open');
    expect(r.custody[cacheOf(r).c!].slots.some(s=>s?.key==='mechanical_gear')).toBe(true);
  });

  it('full natural-intent chain with save/reload at each step', () => {
    const g=start();const r=g.run!;const c=cacheOf(r);
    const spawnTx=Math.floor(r.player.x/TILE), spawnTy=Math.floor(r.player.y/TILE);
    // FIXTURE position: beside the cache (reach is measured above).
    place(r,c.tx!+1,c.ty!);
    // NATURAL: take the parts from the cache with real move intents.
    for (const k of ['mechanical_gear','mechanical_parts','fasteners','spares']) {
      const fs=r.custody[c.c!].slots.findIndex(s=>s?.key===k);expect(fs,k).toBeGreaterThanOrEqual(0);
      expect(dispatch(g,{id:'p3-mv-'+(++n),type:'move',from:c.c,fs,to:'inv'} as any,START+5).ok,k).toBe(true);
    }
    expect(countItem(r,'inv','mechanical_gear')).toBe(1);expect(countItem(r,'inv','mechanical_parts')).toBe(2);
    // FIXTURE materials: wood, stone and iron for the bench and one drive input.
    addItem(r,'inv','wood',14);addItem(r,'inv','stone',4);addItem(r,'inv','iron_ingot',2);
    // FIXTURE position: stand beside a legal tile near spawn (the Foundry floor is not buildable).
    const [bx,by]=legalTileNear(g,spawnTx,spawnTy);place(r,bx-1,by);
    // REAL: build the workbench, then upgrade it to L2 (2 mechanical parts + 1 iron ingot).
    expect(dispatch(g,{id:'p3-build-'+(++n),type:'build',struct:'workbench',tx:bx,ty:by},START+10).ok).toBe(true);
    const bench=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='workbench')!;
    expect(bench.station!.level ?? 1).toBe(1);
    expect(dispatch(g,{id:'p3-up-'+(++n),type:'upgradeStation',eid:bench.id},START+11).ok).toBe(true);
    expect(bench.station!.level).toBe(2);
    expect(countItem(r,'inv','mechanical_parts')).toBe(0);expect(countItem(r,'inv','iron_ingot')).toBe(1);
    // Save before consumption.
    const s1=copy(g);expect(s1.run!.entities[bench.id].station!.level).toBe(2);expect(countItem(s1.run!,'inv','mechanical_gear')).toBe(1);
    // REAL: craft the geared drive (paid queue).
    const fast0=countItem(r,'inv','fasteners'),spares0=countItem(r,'inv','spares');
    expect(dispatch(g,{id:'p3-craft-'+(++n),type:'craft',eid:bench.id,recipe:'vehicle_drive_geared'},START+12).ok).toBe(true);
    expect(countItem(r,'inv','mechanical_gear')).toBe(0);expect(countItem(r,'inv','iron_ingot')).toBe(0);
    expect(countItem(r,'inv','fasteners')).toBe(fast0-2);expect(countItem(r,'inv','spares')).toBe(spares0-2);
    expect(bench.station!.queue[0].recipe).toBe('vehicle_drive_geared');
    // Save while queued.
    const s2=copy(g);expect(s2.run!.entities[bench.id].station!.queue[0].recipe).toBe('vehicle_drive_geared');
    // Time passes at the real rate; the drive lands in the bench output.
    stepStations(g,RECIPES.vehicle_drive_geared.secs*1000+1000,START+13000);
    const outC=bench.station!.outC!;expect(countItem(r,outC,'vehicle_drive')).toBe(1);
    // REAL: collect the drive from the bench output into the pack (same UID).
    const fs=r.custody[outC].slots.findIndex(s=>s?.key==='vehicle_drive');const uid=r.custody[outC].slots[fs]!.uid;
    expect(dispatch(g,{id:'p3-collect-'+(++n),type:'move',from:outC,fs,to:'inv'} as any,START+14000).ok).toBe(true);
    expect(r.custody.inv.slots.some(s=>s?.key==='vehicle_drive'&&s.uid===uid)).toBe(true);
    // Save after the output is carried: drive present, gear and iron stay consumed.
    const s3=copy(g);expect(countItem(s3.run!,'inv','vehicle_drive')).toBe(1);expect(countItem(s3.run!,'inv','mechanical_gear')).toBe(0);
  });

  it('refused without the gear: no drive is made from nothing; refused craft consumes nothing', () => {
    const g=start();const r=g.run!;
    const spawnTx=Math.floor(r.player.x/TILE), spawnTy=Math.floor(r.player.y/TILE);
    addItem(r,'inv','wood',14);addItem(r,'inv','stone',4);addItem(r,'inv','iron_ingot',3);addItem(r,'inv','mechanical_parts',2);addItem(r,'inv','fasteners',4);addItem(r,'inv','spares',4);
    const [bx,by]=legalTileNear(g,spawnTx,spawnTy);place(r,bx-1,by);
    dispatch(g,{id:'p3n-build',type:'build',struct:'workbench',tx:bx,ty:by},START+10);
    const bench=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='workbench')!;
    dispatch(g,{id:'p3n-up',type:'upgradeStation',eid:bench.id},START+11);
    const res=dispatch(g,{id:'p3n-craft',type:'craft',eid:bench.id,recipe:'vehicle_drive_geared'},START+12);
    expect(res.ok).toBe(false);expect(JSON.stringify(res)).toMatch(/Mechanical Gear 0\/1/);
    expect(countItem(r,'inv','iron_ingot')).toBe(2);expect(countItem(r,'inv','fasteners')).toBe(4);
  });

  it('refused below Level 2 (honest refusal) even with every input carried', () => {
    const g=start();const r=g.run!;
    const spawnTx=Math.floor(r.player.x/TILE), spawnTy=Math.floor(r.player.y/TILE);
    addItem(r,'inv','mechanical_gear',1);addItem(r,'inv','iron_ingot',1);addItem(r,'inv','fasteners',2);addItem(r,'inv','spares',2);
    addItem(r,'inv','wood',14);addItem(r,'inv','stone',4);
    const [bx,by]=legalTileNear(g,spawnTx,spawnTy);place(r,bx-1,by);
    dispatch(g,{id:'p3l1-build',type:'build',struct:'workbench',tx:bx,ty:by},START+10);
    const bench=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='workbench')!;
    const res=dispatch(g,{id:'p3l1-craft',type:'craft',eid:bench.id,recipe:'vehicle_drive_geared'},START+12);
    expect(res.ok).toBe(false);expect(JSON.stringify(res)).toMatch(/level 2/);
    expect(countItem(r,'inv','mechanical_gear')).toBe(1);
  });
});
