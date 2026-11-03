import { describe, expect, it } from 'vitest';
import { ITEMS, RECIPES, CREATURES } from '../src/game/catalog';
import { TILE, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, markDirty, mkContainer, mkCreature, newGame, stepStations } from '../src/game/engine';
import { getWorld } from '../src/game/world';
import { tick, settle, type Input } from '../src/game/sim';
import { serializeSnapshot, validate } from '../src/game/persist';
const T = Date.UTC(2026, 10, 1); let n=0;
function act(g:GameState,type:string,p:object={},id=`economy-${++n}`,now=T+1){return dispatch(g,{id,type,...p},now);}
function fresh(){const g=newGame();expect(act(g,'startRun',{character:'male',region:0,seed:123}).ok).toBe(true);g.run!.creatures=[];return g;}
function give(g:GameState,key:string,q=1){expect(addItem(g.run!,'inv',key,q)).toBe(0);}
function station(g:GameState,type:'workbench'|'furnace'|'campfire') {const r=g.run!,p=r.player,f=mkContainer(r,'fuel',3),o=mkContainer(r,'out',6);const e:Entity={id:`fixture-${++n}`,kind:'struct',type,x:p.x+16,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:100,maxHp:100,station:{fuelC:f.id,outC:o.id,burn:0,queue:[]}};r.entities[e.id]=e;markDirty();return e;}
const input=(x:number,y:number):Input=>({up:false,down:false,left:false,right:false,mx:x+40,my:y,attack:true,attackPressed:true,roll:false,cancel:false});
describe('connected economy',()=>{
 it('adds finite physical found parts and shore shell furnace alternative without a boss prerequisite',()=>{
  expect(getWorld('shipping').statics.some(e=>e.poi==='factory'&&e.loot?.some(([k,q])=>k==='mechanical_parts'&&q===2))).toBe(true);
  expect(CREATURES.crab.drops).toContainEqual(['shell',1,1]);expect(RECIPES.shell_glass.ins).toEqual([['stone',2],['shell',2]]);expect(RECIPES.gas_mask.ins).toContainEqual(['glass',1]);
  expect(RECIPES.industrial_pick.stationLevel).toBe(2);expect(ITEMS.industrial_pick.power!.ore!).toBeGreaterThan(ITEMS.iron_pick.power!.ore!);expect(ITEMS.industrial_axe.power!.wood!).toBeGreaterThan(ITEMS.iron_axe.power!.wood!);
 });
 it('retains broken repairable UID, blocks attacks, survives save and pays for repair',()=>{
  const g=fresh(),r=g.run!,p=r.player,s=C(r,'inv').slots[0]!;const id=s.uid;s.dur=1;
  // Resolve an actual swing into a creature in the ordinary simulation.
  const m=mkCreature(r,'boar',p.x+16,p.y,40);m.state='idle';r.creatures.push(m);markDirty();
  const controls=input(p.x,p.y);for(let k=1;k<=5;k++) tick(g,controls,50,T+k*50);
  expect(s.dur).toBe(0);expect(C(r,'inv').slots[0]?.uid).toBe(id);const hp=m.hp;
  p.action=null;for(let k=6;k<=10;k++)tick(g,controls,50,T+k*50);expect(m.hp).toBe(hp);
  const saved=JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;expect(validate(saved)).toBeTruthy();
  const bench=station(saved,'workbench');give(saved,'scrap');give(saved,'fiber');expect(act(saved,'maintainItem',{eid:bench.id,slot:0,uid:id,mode:'repair'},'broken-repair',T+1000).ok).toBe(true);
  expect(C(saved.run!,'inv').slots[0]).toMatchObject({uid:id,dur:300});expect(countItem(saved.run!,'inv','scrap')).toBe(0);expect(act(saved,'maintainItem',{eid:bench.id,slot:0,uid:id,mode:'repair'},'broken-repair',T+1001)).toMatchObject({ok:false,dup:true});
 });
 it('level 2 and knowledge gate industrial jobs; reserve and cancel returns exact tool identity and durability',()=>{
  const g=fresh(),r=g.run!,e=station(g,'workbench');give(g,'iron_pick');give(g,'mechanical_parts',2);give(g,'spares',2);
  const pick=C(r,'inv').slots.find(s=>s?.key==='iron_pick')!;pick.dur=99;r.knowledge.recipes.push('industrial_pick');
  expect(act(g,'craft',{eid:e.id,recipe:'industrial_pick'}).ok).toBe(false);e.station!.level=2;
  r.player.action={kind:'swing',slot:C(r,'inv').slots.indexOf(pick),t:0,dur:300,angle:0};expect(act(g,'craft',{eid:e.id,recipe:'industrial_pick'}).ok).toBe(false);r.player.action=null;
  expect(act(g,'craft',{eid:e.id,recipe:'industrial_pick'}).ok).toBe(true);const job=e.station!.queue[0];expect(job.reserved).toContainEqual(pick);
  const saved=JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;expect(validate(saved)).toBeTruthy();expect(act(saved,'cancelJob',{eid:e.id,jobId:job.id}).ok).toBe(true);
  expect(C(saved.run!,'inv').slots.find(s=>s?.uid===pick.uid)).toMatchObject({key:'iron_pick',dur:99});expect(countItem(saved.run!,'inv','mechanical_parts')).toBe(2);
  expect(act(saved,'craft',{eid:e.id,recipe:'industrial_pick'}).ok).toBe(true);stepStations(saved,25000,T+25000);expect(C(saved.run!,saved.run!.entities[e.id].station!.outC).slots.some(s=>s?.key==='industrial_pick')).toBe(true);
 });
 it('fuelled shell glass stalls without fuel, consumes inputs, settles offline once and enables mask',()=>{
  const g=fresh(),r=g.run!,e=station(g,'furnace');give(g,'shell',2);give(g,'stone',2);expect(act(g,'craft',{eid:e.id,recipe:'shell_glass'}).ok).toBe(true);
  stepStations(g,30000,T+30000);expect(e.station!.queue[0].left).toBe(16000);expect(countItem(r,'inv','shell')).toBe(0);
  addItem(r,e.station!.fuelC,'wood',1);const saved=JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;settle(saved,T+30000);const out=C(saved.run!,saved.run!.entities[e.id].station!.outC);expect(out.slots.filter(s=>s?.key==='glass')).toHaveLength(1);settle(saved,T+30000);expect(out.slots.filter(s=>s?.key==='glass')).toHaveLength(1);
 });
 it('funded crop and herb broth is timed physical home food',()=>{
  const g=fresh(),r=g.run!,e=station(g,'campfire');give(g,'crop',2);give(g,'herb');addItem(r,e.station!.fuelC,'wood',1);
  expect(act(g,'craft',{eid:e.id,recipe:'root_broth'}).ok).toBe(true);expect(countItem(r,'inv','crop')).toBe(0);
  const saved=JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;settle(saved,T+15000);const out=C(saved.run!,saved.run!.entities[e.id].station!.outC);expect(out.slots.some(s=>s?.key==='root_broth')).toBe(true);expect(ITEMS.root_broth.food!.thirst).toBeGreaterThan(0);
 });
 it('repairs real owned structure HP with bounded cost and rejects replay, range, ownership and full health',()=>{
  const g=fresh(),r=g.run!,e=station(g,'workbench');e.hp=10;e.maxHp=160;give(g,'wood',4);give(g,'stone',1);const cmd={eid:e.id};
  expect(act(g,'repairStructure',cmd,'fix-structure').ok).toBe(true);expect(e.hp).toBe(50);expect(countItem(r,'inv','wood')).toBe(0);expect(countItem(r,'inv','stone')).toBe(0);expect(act(g,'repairStructure',cmd,'fix-structure')).toMatchObject({ok:false,dup:true});
  give(g,'wood',4);give(g,'stone',1);e.owner='other';expect(act(g,'repairStructure',cmd).ok).toBe(false);e.owner=undefined;e.x+=200;expect(act(g,'repairStructure',cmd).ok).toBe(false);e.x-=200;e.hp=160;expect(act(g,'repairStructure',cmd).ok).toBe(false);
  expect(countItem(r,'inv','wood')).toBe(4);expect(validate(g)).toBeTruthy();
 });
});
