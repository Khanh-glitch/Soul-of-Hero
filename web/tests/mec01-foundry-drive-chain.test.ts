// Foundry exterior gear is still a physical input, but the geared drive recipe is
// retired. Cover its explicit refusal and the live L2 geared pick transaction.
// FIXTURE: player positions, bench materials, iron pick and spares. Never grant
// the cache gear in the successful chain. All transfers/upgrades/jobs are paid intents.
import {describe,it,expect} from 'vitest';
import {type GameState,type RunState,TILE} from '../src/game/core';
import {RECIPES} from '../src/game/catalog';
import {addItem,countItem,dispatch,markDirty,newGame,stepStations,buildReason,lootSiteAccess} from '../src/game/engine';
import {setActiveLayout,getWorld} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {validLootSourceContract} from '../src/game/loot-source-spec';

const START=Date.UTC(2026,10,5);
let n=0;
const copy=(g:GameState)=>selectSnapshots([serializeSnapshot(g),null]).gs!;
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'p3-start-'+(++n),type:'startRun',character:'female',seed:101},START).ok).toBe(true);g.run!.creatures=[];markDirty();return g;}
const cacheOf=(r:RunState)=>Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='factory'&&e.c&&r.custody[e.c]?.slots.some(s=>s?.key==='machete'))!;
function place(r:RunState,tx:number,ty:number){r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;markDirty();}
/** Legal workbench tile nearest a centre. buildReason has a reach rule, so the player is placed beside each candidate first (FIXTURE position). */
function legalTileNear(g:GameState,cx:number,cy:number):[number,number]{
  const r=g.run!;
  for (let k=1;k<=8;k++) for (let dy=-k;dy<=k;dy++) for (let dx=-k;dx<=k;dx++) { if (Math.max(Math.abs(dx),Math.abs(dy))!==k) continue; const tx=cx+dx,ty=cy+dy; place(r,tx-1,ty); if (!buildReason(g,'workbench',tx,ty)) return [tx,ty]; }
  throw new Error('no legal workbench tile');
}

const act=(g:GameState,type:string,args:Record<string,unknown>)=>dispatch(g,{id:`p3-${++n}`,type,...args},START+n);
function benchAtSpawn(g:GameState,tx:number,ty:number,upgrade:boolean){
  const r=g.run!;for(const [key,qty] of [['wood',14],['stone',4],['iron_ingot',2],['spares',6],['iron_pick',1]] as const)expect(addItem(r,'inv',key,qty)).toBe(0);
  expect(act(g,'craft',{recipe:'deploy_workbench'}).ok).toBe(true);
  const [x,y]=legalTileNear(g,tx,ty);expect(act(g,'build',{struct:'workbench',tx:x,ty:y}).ok).toBe(true);
  const bench=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='workbench'&&e.tx===x&&e.ty===y)!;
  if(upgrade)expect(act(g,'upgradeStation',{eid:bench.id}).ok).toBe(true);
  return bench;
}
describe('Foundry cache gear and the paid L2 chain after drive retirement',()=>{
 it('keeps the exterior gear foot-accessible under its registered source contract',()=>{
  const r=start().run!;expect(validLootSourceContract(r.lootEcology!.sourceContract)).toBe(true);
  const spec=getWorld().statics.find(s=>s.kind==='loot'&&s.poi==='factory'&&s.loot?.some(([k])=>k==='iron_sword'))!;
  expect(lootSiteAccess(r,spec)).toBe('open');expect(countItem(r,cacheOf(r).c!,'mechanical_gear')).toBe(1);
 });
 it('takes the authored gear, refuses retired work, queues a real tool, and retrieves the same output UID after restart',()=>{
  let g=start();const r=g.run!,cx=Math.floor(r.player.x/TILE),cy=Math.floor(r.player.y/TILE),cache=cacheOf(r),fs=r.custody[cache.c!].slots.findIndex(s=>s?.key==='mechanical_gear');
  place(r,cache.tx!+1,cache.ty!);expect(act(g,'move',{from:cache.c,fs,to:'inv'}).ok).toBe(true);expect(countItem(r,cache.c!,'mechanical_gear')).toBe(0);
  const b=benchAtSpawn(g,cx,cy,true),out=b.station!.outC!;g=copy(g);
  expect(act(g,'craft',{eid:b.id,recipe:'vehicle_drive_geared'})).toMatchObject({ok:false,reason:expect.stringContaining('Retired')});
  expect(countItem(g.run!,'inv','mechanical_gear')).toBe(1);expect(act(g,'craft',{eid:b.id,recipe:'industrial_pick_geared'}).ok).toBe(true);
  g=copy(g);expect(g.run!.entities[b.id].station!.queue[0].recipe).toBe('industrial_pick_geared');
  for(const key of ['mechanical_gear','iron_pick','spares'])expect(countItem(g.run!,'inv',key)).toBe(0);
  stepStations(g,RECIPES.industrial_pick_geared.secs*1000+1000,START+60000);g=copy(g);
  const slot=g.run!.custody[out].slots.findIndex(s=>s?.key==='industrial_pick');expect(slot).toBeGreaterThanOrEqual(0);
  const uid=g.run!.custody[out].slots[slot]!.uid;expect(dispatch(g,{id:`collect-${++n}`,type:'move',from:out,fs:slot,to:'inv'},START+61000).ok).toBe(true);
  g=copy(g);expect(g.run!.custody.inv.slots.some(s=>s?.uid===uid&&s.key==='industrial_pick')).toBe(true);expect(countItem(g.run!,out,'industrial_pick')).toBe(0);
 });
 it.each([true,false])('does not charge a refused geared tool (level two: %s)',upgrade=>{
  const g=start(),r=g.run!,b=benchAtSpawn(g,Math.floor(r.player.x/TILE),Math.floor(r.player.y/TILE),upgrade);
  if(!upgrade)addItem(r,'inv','mechanical_gear',1);
  const stock=structuredClone(r.custody.inv.slots);expect(act(g,'craft',{eid:b.id,recipe:'industrial_pick_geared'})).toMatchObject({ok:false,reason:expect.stringMatching(upgrade?/Gear 0\/1/i:/level 2/i)});
  expect(r.custody.inv.slots).toEqual(stock);expect(b.station!.queue).toEqual([]);
 });
});
