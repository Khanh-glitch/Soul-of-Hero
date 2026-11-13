import { describe, expect, it } from 'vitest';
import { ITEMS, RECIPES, STRUCTS, CREATURES, SOURCES } from '../src/game/catalog';
import { TILE, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, harvestHit, gardenEnvironment, blockGrid, markDirty, mkContainer, mkCreature, newGame, stepStations, stepGardensBarrels } from '../src/game/engine';
import { getWorld, SRC_KEYS } from '../src/game/world';
import { tick, settle, type Input } from '../src/game/sim';
import { serializeSnapshot, validate } from '../src/game/persist';
const T = Date.UTC(2026, 10, 1); let n=0;
function act(g:GameState,type:string,p:object={},id=`economy-${++n}`,now=T+1){return dispatch(g,{id,type,...p},now);}
function fresh(){const g=newGame();expect(act(g,'startRun',{character:'male',region:0,seed:123}).ok).toBe(true);g.run!.creatures=[]; const r=g.run!, grid=blockGrid(r); for(let y=85;y<150;y++)for(let x=20;x<180;x++){const e:Entity={id:'climate-fixture',kind:'struct',type:'garden',x:x*TILE+8,y:y*TILE+8,tx:x,ty:y};if(!grid[y*200+x]&&!grid[y*200+x+1]&&gardenEnvironment(r,e,false,'crop').rate===1&&gardenEnvironment(r,e,true,'crop').rate===1){r.player.x=e.x;r.player.y=e.y;return g;}} throw new Error('No suitable climate fixture');}
function give(g:GameState,key:string,q=1){expect(addItem(g.run!,'inv',key,q)).toBe(0);}
function station(g:GameState,type:'workbench'|'furnace'|'campfire') {const r=g.run!,p=r.player,f=mkContainer(r,'fuel',3),o=mkContainer(r,'out',6);const e:Entity={id:`fixture-${++n}`,kind:'struct',type,x:p.x+16,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:100,maxHp:100,station:{fuelC:f.id,outC:o.id,burn:0,queue:[]}};r.entities[e.id]=e;markDirty();return e;}
const input=(x:number,y:number):Input=>({up:false,down:false,left:false,right:false,mx:x+40,my:y,attack:true,attackPressed:true,roll:false,cancel:false});
describe('connected economy',()=>{
 it('adds finite physical found parts and shore shell furnace alternative without a boss prerequisite',()=>{
  expect(getWorld('shipping').statics.some(e=>e.poi==='factory'&&e.loot?.some(([k,q])=>k==='mechanical_parts'&&q===2))).toBe(true);
  expect(SOURCES.wreck.bonus).toContainEqual(['mechanical_parts',0.08]);
  expect(CREATURES.crab.drops).toContainEqual(['shell',1,1]);expect(RECIPES.shell_glass.ins).toEqual([['stone',2],['shell',2]]);expect(RECIPES.gas_mask.ins).toContainEqual(['glass',1]);
  expect(RECIPES.industrial_pick.stationLevel).toBe(2);expect(ITEMS.industrial_pick.power!.ore!).toBeGreaterThan(ITEMS.iron_pick.power!.ore!);expect(ITEMS.industrial_axe.power!.wood!).toBeGreaterThan(ITEMS.iron_axe.power!.wood!);
 });
 it('wrecks produce rare physical parts only while finite source stock is harvested',()=>{
  const g=fresh(),r=g.run!,w=getWorld(),i=w.sourceV3.findIndex(k=>k==='wreck');expect(i).toBeGreaterThanOrEqual(0);
  r.rng=4;const tx=i%200,ty=Math.floor(i/200),x=tx*16+8,y=ty*16+8;r.player.x=x-15;r.player.y=y;
  const result=harvestHit(g,tx,ty,{scrap:100},T+10,r.player.x,r.player.y);expect(result.depleted).toBe(true);
  const pieces=Object.values(r.entities).filter(e=>e.kind==='drop').flatMap(e=>C(r,e.c!).slots.filter(s=>s?.key==='mechanical_parts'));expect(pieces.length).toBeGreaterThan(0);expect(pieces.length).toBeLessThanOrEqual(SOURCES.wreck.stock);
  expect(harvestHit(g,tx,ty,{scrap:100},T+11,r.player.x,r.player.y).result).toBe('empty');expect(validate(g)).toBeTruthy();
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
 it('real seed and flask water grow a crop that can fund a timed meal',()=>{
  const g=fresh(),r=g.run!,p=r.player,e=station(g,'campfire');
  const plot:Entity={id:'fixture-garden',kind:'struct',type:'garden',x:p.x+8,y:p.y+8,tx:Math.floor(p.x/16),ty:Math.floor(p.y/16),hp:60,maxHp:60,garden:{crop:null,growth:0,water:0}};r.entities[plot.id]=plot;markDirty();give(g,'seed');
  expect(act(g,'garden',{eid:plot.id}).ok).toBe(true);expect(countItem(r,'inv','seed')).toBe(0);expect(act(g,'garden',{eid:plot.id}).ok).toBe(true);expect(act(g,'garden',{eid:plot.id}).ok).toBe(true);
  stepGardensBarrels(g,300000,false);expect(plot.garden!.growth).toBe(1);expect(act(g,'garden',{eid:plot.id}).ok).toBe(true);expect(countItem(r,'inv','crop')).toBe(3);
  give(g,'herb');addItem(r,e.station!.fuelC,'wood',1);expect(act(g,'craft',{eid:e.id,recipe:'root_broth'}).ok).toBe(true);stepStations(g,12000,T+12000);expect(C(r,e.station!.outC).slots.some(s=>s?.key==='root_broth')).toBe(true);
 });
 it('the real equipped gas mask reduces foundry exposure during offline settlement',()=>{
  const unprotected=fresh(), protectedRun=structuredClone(unprotected), w=getWorld('shipping');
  const factory=w.places.find(p=>p.id==='factory')!;
  for(const g of [unprotected,protectedRun]){g.run!.player.x=factory.tx*16+8;g.run!.player.y=factory.ty*16+8;g.run!.player.rad=0;}
  give(protectedRun,'gas_mask');const idx=C(protectedRun.run!,'inv').slots.findIndex(s=>s?.key==='gas_mask');expect(act(protectedRun,'useItem',{slot:idx}).ok).toBe(true);
  settle(unprotected,T+60000);settle(protectedRun,T+60000);
  expect(unprotected.run!.player.rad).toBeGreaterThan(2);expect(protectedRun.run!.player.rad).toBeLessThan(unprotected.run!.player.rad/2);
 });
 it('salvage output is bounded below ingredient costs and no reciprocal crafting cycle is added',()=>{
  expect(ITEMS.iron_sword.salvage!.yields).toEqual([['iron_ingot',1]]);
  expect(RECIPES.iron_sword.ins.find(([k])=>k==='iron_ingot')![1]).toBeGreaterThan(1);
  expect(ITEMS.industrial_pick.salvage).toBeUndefined();expect(ITEMS.industrial_axe.salvage).toBeUndefined();
 });
 /** A placed structure that is NOT a packed device: the only thing the engine lets you patch with raw
  * materials in place (§24 device custody — a device's condition lives on the packed item). */
 function geo(g:GameState,type:string){const r=g.run!,p=r.player;const e:Entity={id:`fixture-geo-${++n}`,kind:'struct',type,x:p.x+16,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:STRUCTS[type].hp,maxHp:STRUCTS[type].hp};r.entities[e.id]=e;markDirty();return e;}
 it('repairs real owned geometry HP with bounded cost and rejects replay, range, ownership and full health',()=>{
  const g=fresh(),r=g.run!,e=geo(g,'wall_wood');e.hp=10;e.maxHp=160;give(g,'wood',6);const cmd={eid:e.id};
  // Wood Wall costs 5 wood to build, so one patch is ceil(5*0.25)=2 wood and restores ceil(160/4)=40 HP.
  expect(act(g,'repairStructure',cmd,'fix-structure').ok).toBe(true);expect(e.hp).toBe(50);expect(countItem(r,'inv','wood')).toBe(4);expect(act(g,'repairStructure',cmd,'fix-structure')).toMatchObject({ok:false,dup:true});
  // A second and third patch each cost the same bounded 2 wood and heal the same 40 HP...
  e.hp=20;expect(act(g,'repairStructure',cmd).ok).toBe(true);expect(e.hp).toBe(60);expect(countItem(r,'inv','wood')).toBe(2);
  expect(act(g,'repairStructure',cmd).ok).toBe(true);expect(e.hp).toBe(100);expect(countItem(r,'inv','wood')).toBe(0);
  // ...and with nothing left to pay, the repair refuses without healing or inventing a debt.
  expect(act(g,'repairStructure',cmd).ok).toBe(false);expect(e.hp).toBe(100);expect(countItem(r,'inv','wood')).toBe(0);
  give(g,'wood',2);e.owner='other';expect(act(g,'repairStructure',cmd).ok).toBe(false);e.owner=undefined;e.x+=200;expect(act(g,'repairStructure',cmd).ok).toBe(false);e.x-=200;e.hp=160;expect(act(g,'repairStructure',cmd).ok).toBe(false);
  expect(countItem(r,'inv','wood')).toBe(2);expect(validate(g)).toBeTruthy();   // the three guards above spent nothing
 });
 it('refuses in-place material repair for a packed device, and spends nothing when it refuses',()=>{
  const g=fresh(),r=g.run!,e=station(g,'workbench');e.hp=10;e.maxHp=160;give(g,'wood',4);give(g,'stone',1);
  // The pre-§24 version of this test expected a Workbench to be patched with wood and stone. It is a
  // deployable now: STRUCTS.workbench.item exists, so the engine refuses and the player repairs the
  // deploy_workbench item instead. Pinning the refusal is what keeps the two surfaces from drifting.
  const res=act(g,'repairStructure',{eid:e.id});
  expect(res.ok).toBe(false);expect((res as {reason?:string}).reason).toBe('This structure cannot be repaired.');
  expect(e.hp).toBe(10);expect(countItem(r,'inv','wood')).toBe(4);expect(countItem(r,'inv','stone')).toBe(1);
  expect(act(g,'repairStructure',{eid:e.id},'device-fix').ok).toBe(false);expect(validate(g)).toBeTruthy();
 });
});
