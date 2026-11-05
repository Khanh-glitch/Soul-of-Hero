import { describe, expect, it } from 'vitest';
import { BAL, TILE, WW, T as Terrain, type Entity, type GameState } from '../src/game/core';
import { ITEMS, RECIPES, SOURCES } from '../src/game/catalog';
import { addItem, C, carryLimit, countItem, dispatch, markDirty, mkContainer, newGame, stepStations } from '../src/game/engine';
import { getWorld } from '../src/game/world';
import { tick, settle, type Input } from '../src/game/sim';
import { serializeSnapshot, validate } from '../src/game/persist';
const T=Date.UTC(2026,10,1);let n=0;
const act=(g:GameState,type:string,p:object={},id=`prod-${++n}`,now=T+1)=>dispatch(g,{id,type,...p},Math.max(now,g.run?.clock.lastSimAt??now));
function fresh(){const g=newGame();expect(act(g,'startRun',{character:'female',region:0,seed:91}).ok).toBe(true);g.run!.creatures=[];return g;}
function give(g:GameState,key:string,q=1){expect(addItem(g.run!,'inv',key,q)).toBe(0);}
function station(g:GameState,type:'workbench'|'campfire'|'furnace'|'research',level:1|2=1){const r=g.run!,p=r.player,f=mkContainer(r,'fuel',3),o=mkContainer(r,'out',6),e:Entity={id:`fixture-${++n}`,kind:'struct',type,x:p.x+16,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:160,maxHp:160,station:{fuelC:f.id,outC:o.id,burn:0,queue:[],...(type==='workbench'?{level}:{})}};r.entities[e.id]=e;markDirty();return e;}
function take(g:GameState,e:Entity,key:string){const c=C(g.run!,e.station!.outC),slot=c.slots.findIndex(s=>s?.key===key);expect(slot).toBeGreaterThanOrEqual(0);expect(act(g,'move',{from:c.id,fs:slot,to:'inv'}).ok).toBe(true);}
function snap(g:GameState){return JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;}

describe('production, repair and expedition network',()=>{
 it('learns fasteners from an actually consumed specimen, then produces a paid multi-use batch',()=>{
  const g=fresh(),r=g.run!,research=station(g,'research'),bench=station(g,'workbench');give(g,'fasteners');const slot=C(r,'inv').slots.findIndex(s=>s?.key==='fasteners'),specimen=C(r,'inv').slots[slot]!;
  expect(act(g,'research',{eid:research.id,mode:'specimen',slot,uid:'stale'}).ok).toBe(false);expect(act(g,'research',{eid:research.id,mode:'specimen',slot,uid:specimen.uid}).ok).toBe(true);expect(countItem(r,'inv','fasteners')).toBe(0);stepStations(g,30000,T+30000);take(g,research,'blueprint');const bp=C(r,'inv').slots.findIndex(s=>s?.key==='blueprint');expect(act(g,'useItem',{slot:bp}).ok).toBe(true);expect(r.knowledge.recipes).toContain('fasteners');
  give(g,'scrap');give(g,'iron_ingot');expect(act(g,'craft',{eid:bench.id,recipe:'fasteners'}).ok).toBe(true);stepStations(g,10000,T+10000);take(g,bench,'fasteners');expect(countItem(r,'inv','fasteners')).toBe(3);expect(SOURCES.wreck.bonus).toContainEqual(['fasteners',0.12]);expect(SOURCES.wreck.bonus).toContainEqual(['field_repair_kit',0.04]);expect(validate(snap(g))).toBeTruthy();
 });
 it('sacrifices a physical canister as a sample to learn generator fuel instead of opening the gate immediately',()=>{
  const g=fresh(),r=g.run!,table=station(g,'research');give(g,'fuel_can');const slot=C(r,'inv').slots.findIndex(s=>s?.key==='fuel_can'),s=C(r,'inv').slots[slot]!;expect(act(g,'research',{eid:table.id,mode:'specimen',slot,uid:s.uid}).ok).toBe(true);expect(countItem(r,'inv','fuel_can')).toBe(0);stepStations(g,30000,T+30000);take(g,table,'blueprint');const bp=C(r,'inv').slots.findIndex(s=>s?.key==='blueprint'&&s.meta==='fuel_can');expect(act(g,'useItem',{slot:bp}).ok).toBe(true);expect(r.knowledge.recipes).toContain('fuel_can');expect(validate(snap(g))).toBeTruthy();
 });
 it('fueled canvas stalls, progresses once offline, and is shared by two level-2 expedition outputs',()=>{
  const g=fresh(),r=g.run!,fire=station(g,'campfire'),bench=station(g,'workbench');r.knowledge.recipes.push('treated_canvas','trail_pack','trail_canteen');give(g,'cloth');give(g,'raw_salt');give(g,'herb');
  expect(act(g,'craft',{eid:fire.id,recipe:'treated_canvas'}).ok).toBe(true);stepStations(g,20000,T+20000);expect(fire.station!.queue[0].left).toBe(12000);addItem(r,fire.station!.fuelC,'wood',1);
  const saved=snap(g);settle(saved,T+15000);const rr=saved.run!,ff=rr.entities[fire.id],bb=rr.entities[bench.id];expect(countItem(rr,ff.station!.outC,'treated_canvas')).toBe(2);settle(saved,T+15000);expect(countItem(rr,ff.station!.outC,'treated_canvas')).toBe(2);take(saved,ff,'treated_canvas');give(saved,'leather',2);give(saved,'fasteners',2);give(saved,'rope',2);
  expect(act(saved,'craft',{eid:bb.id,recipe:'trail_pack'}).ok).toBe(false);bb.station!.level=2;expect(act(saved,'craft',{eid:bb.id,recipe:'trail_pack'}).ok).toBe(true);stepStations(saved,22000,T+22000);take(saved,bb,'trail_pack');expect(countItem(rr,'inv','treated_canvas')).toBe(1);expect(validate(saved)).toBeTruthy();
 });
 it('repairs carried UID with a physical kit in the field, rejects stale/action/full/replay and never recharges a Core',()=>{
  const g=fresh(),r=g.run!,tool=C(r,'inv').slots[0]!;tool.dur=0;give(g,'field_repair_kit',2);const kitSlot=C(r,'inv').slots.findIndex(s=>s?.key==='field_repair_kit'),kit=C(r,'inv').slots[kitSlot]!,cmd={slot:0,uid:tool.uid,kitSlot,kitUid:kit.uid};
  expect(act(g,'fieldRepair',{...cmd,kitUid:'old'}).ok).toBe(false);r.player.action={kind:'swing',slot:0,t:0,dur:300,angle:0};expect(act(g,'fieldRepair',cmd).ok).toBe(false);r.player.action=null;
  expect(act(g,'fieldRepair',cmd,'repair-once').ok).toBe(true);expect(tool.dur).toBe(100);expect(tool.uid).toBe(cmd.uid);expect(kit.qty).toBe(1);expect(act(g,'fieldRepair',cmd,'repair-once')).toMatchObject({ok:false,dup:true});tool.dur=ITEMS.knife.dur;expect(act(g,'fieldRepair',cmd).ok).toBe(false);give(g,'core_fire');const ci=C(r,'inv').slots.findIndex(s=>s?.key==='core_fire'),core=C(r,'inv').slots[ci]!;core.charge=0;expect(act(g,'fieldRepair',{...cmd,slot:ci,uid:core.uid}).ok).toBe(false);expect(core.charge).toBe(0);expect(kit.qty).toBe(1);expect(validate(snap(g))).toBeTruthy();
 });
 it('trail pack changes actual walking speed under load while replacing warm back equipment',()=>{
  const g=fresh(),r=g.run!;give(g,'trail_pack');give(g,'wood',60);give(g,'stone',10);const noPack=structuredClone(g);const slot=C(r,'inv').slots.findIndex(s=>s?.key==='trail_pack');expect(act(g,'useItem',{slot}).ok).toBe(true);expect(carryLimit(r)).toBe(BAL.player.carryLimit+20);expect(ITEMS.trail_pack.slot).toBe(ITEMS.fur_cloak.slot);expect(ITEMS.fur_cloak.cold).toBeGreaterThan(0);expect(ITEMS.trail_pack.cold).toBeUndefined();
  const p=r.player,input:Input={up:false,down:false,left:true,right:false,mx:p.x-50,my:p.y,attack:false,attackPressed:false,roll:false,cancel:false};tick(g,input,50,T+50);tick(noPack,input,50,T+50);expect(Math.abs(p.vx)).toBeGreaterThan(Math.abs(noPack.run!.player.vx));expect(validate(g)).toBeTruthy();
 });
 it('a newly crafted eight-charge canteen starts empty, refills from real water, can water a garden and spends charges',()=>{
  const g=fresh(),r=g.run!,b=station(g,'workbench',2);r.knowledge.recipes.push('trail_canteen');give(g,'treated_canvas',2);give(g,'leather');give(g,'glass');give(g,'fasteners');expect(act(g,'craft',{eid:b.id,recipe:'trail_canteen'}).ok).toBe(true);stepStations(g,20000,T+20000);take(g,b,'trail_canteen');const canteen=C(r,'inv').slots.find(s=>s?.key==='trail_canteen')!,slot=C(r,'inv').slots.indexOf(canteen);expect(canteen.charge).toBe(0);expect(act(g,'useItem',{slot}).ok).toBe(false);
  // Fill the starter flask before choosing the next non-full container.
  C(r,'inv').slots.find(s=>s?.key==='water_flask')!.charge=4;const w=getWorld(),i=w.fresh.findIndex((v,i)=>!!v && [Terrain.SHALLOW,Terrain.RIVER].includes(w.tiles[i]));expect(i).toBeGreaterThanOrEqual(0);r.player.x=(i%WW)*TILE+8;r.player.y=Math.floor(i/WW)*TILE+8;
  expect(act(g,'drink',{x:r.player.x,y:r.player.y}).ok).toBe(true);expect(canteen.charge).toBe(8);r.player.thirst=0;expect(act(g,'useItem',{slot}).ok).toBe(true);expect(canteen.charge).toBe(7);expect(r.player.thirst).toBe(30);
  C(r,'inv').slots.find(s=>s?.key==='water_flask')!.charge=0;const e:Entity={id:'fixture-plot',kind:'struct',type:'garden',x:r.player.x,y:r.player.y,tx:i%WW,ty:Math.floor(i/WW),garden:{crop:'crop',water:0,growth:0},hp:60,maxHp:60};r.entities[e.id]=e;markDirty();expect(act(g,'garden',{eid:e.id}).ok).toBe(true);expect(canteen.charge).toBe(6);expect(e.garden!.water).toBe(1);expect(validate(snap(g))).toBeTruthy();
 });
 it('a paid furnace lining improves actual fuel use without changing work time or multiplying outputs offline',()=>{
  const g=fresh(),r=g.run!,bench=station(g,'workbench',2),f=station(g,'furnace');give(g,'brick',2);give(g,'fasteners',3);give(g,'mechanical_parts');const cmd={eid:f.id,benchId:bench.id};
  bench.station!.level=1;expect(act(g,'upgradeFurnace',cmd).ok).toBe(false);bench.station!.level=2;f.owner='other';expect(act(g,'upgradeFurnace',cmd).ok).toBe(false);f.owner=undefined;expect(act(g,'upgradeFurnace',cmd,'line').ok).toBe(true);expect(act(g,'upgradeFurnace',cmd,'line')).toMatchObject({ok:false,dup:true});expect(act(g,'upgradeFurnace',cmd).ok).toBe(false);expect(countItem(r,'inv','brick')).toBe(0);
  const baseline=structuredClone(g);delete baseline.run!.entities[f.id].station!.upgrade;for(const run of [g,baseline]){const rr=run.run!,ff=rr.entities[f.id];addItem(rr,ff.station!.fuelC,'wood',1);give(run,'iron_ore');expect(act(run,'craft',{eid:ff.id,recipe:'iron_ingot'}).ok).toBe(true);stepStations(run,10000,T+10000);expect(countItem(rr,ff.station!.outC,'iron_ingot')).toBe(1);}
  expect(f.station!.burn).toBe(12000);expect(baseline.run!.entities[f.id].station!.burn).toBe(10000);give(g,'iron_ore');expect(act(g,'craft',{eid:f.id,recipe:'iron_ingot'}).ok).toBe(true);const saved=snap(g);settle(saved,T+12000);const ff=saved.run!.entities[f.id];expect(countItem(saved.run!,ff.station!.outC,'iron_ingot')).toBe(2);const burn=ff.station!.burn;settle(saved,T+12000);expect(countItem(saved.run!,ff.station!.outC,'iron_ingot')).toBe(2);expect(ff.station!.burn).toBe(burn);expect(validate(saved)).toBeTruthy();
 });
 it('lined furnace runs exactly 25 seconds per wood and stalls before the unfunded third job',()=>{
  const g=fresh(),r=g.run!,bench=station(g,'workbench',2),f=station(g,'furnace');give(g,'brick',2);give(g,'fasteners',3);give(g,'mechanical_parts');expect(act(g,'upgradeFurnace',{eid:f.id,benchId:bench.id}).ok).toBe(true);addItem(r,f.station!.fuelC,'wood',1);give(g,'iron_ore',3);for(let i=0;i<3;i++)expect(act(g,'craft',{eid:f.id,recipe:'iron_ingot'}).ok).toBe(true);
  stepStations(g,30000,T+30000);expect(countItem(r,f.station!.outC,'iron_ingot')).toBe(2);expect(f.station!.queue).toHaveLength(1);expect(f.station!.queue[0].left).toBeCloseTo(5000);expect(f.station!.burn).toBe(0);const saved=snap(g);settle(saved,T+30000);expect(countItem(saved.run!,saved.run!.entities[f.id].station!.outC,'iron_ingot')).toBe(2);addItem(saved.run!,saved.run!.entities[f.id].station!.fuelC,'wood',1);stepStations(saved,5000,T+35000);expect(countItem(saved.run!,saved.run!.entities[f.id].station!.outC,'iron_ingot')).toBe(3);
 });
 it('fills the canteen only with available barrel water and retains the container identity',()=>{
  const g=fresh(),r=g.run!;give(g,'trail_canteen');const c=C(r,'inv').slots.find(s=>s?.key==='trail_canteen')!,uid=c.uid;C(r,'inv').slots.find(s=>s?.key==='water_flask')!.charge=4;const p=r.player,e:Entity={id:'fixture-barrel',kind:'struct',type:'barrel',x:p.x,y:p.y,tx:Math.floor(p.x/TILE),ty:Math.floor(p.y/TILE),hp:80,maxHp:80,water:3};r.entities[e.id]=e;
  expect(c.charge).toBe(0);expect(act(g,'barrel',{eid:e.id}).ok).toBe(true);expect(c.charge).toBe(3);expect(c.uid).toBe(uid);expect(e.water).toBe(0);expect(act(g,'barrel',{eid:e.id}).ok).toBe(false);expect(validate(snap(g))).toBeTruthy();
 });
 it('turns costly compact fuel and a crafted canister into real burn and optional lighthouse power',()=>{
  const g=fresh(),r=g.run!,b=station(g,'workbench',2),f=station(g,'furnace');r.knowledge.recipes.push('fuel_briquette','fuel_can');give(g,'charcoal',3);give(g,'fiber');give(g,'sulfur');give(g,'glass');
  expect(act(g,'craft',{eid:b.id,recipe:'fuel_briquette'}).ok).toBe(true);expect(act(g,'craft',{eid:b.id,recipe:'fuel_can'}).ok).toBe(true);stepStations(g,30000,T+30000);take(g,b,'fuel_briquette');take(g,b,'fuel_can');expect(ITEMS.fuel_briquette.fuel).toBeLessThan(2*ITEMS.charcoal.fuel!);expect(ITEMS.fuel_briquette.w).toBeLessThan(2*ITEMS.charcoal.w);
  const fuelSlot=C(r,'inv').slots.findIndex(s=>s?.key==='fuel_briquette');expect(act(g,'move',{from:'inv',fs:fuelSlot,to:f.station!.fuelC}).ok).toBe(true);give(g,'iron_ore');expect(act(g,'craft',{eid:f.id,recipe:'iron_ingot'}).ok).toBe(true);stepStations(g,10000,T+10000);expect(countItem(r,f.station!.outC,'iron_ingot')).toBe(1);expect(f.station!.burn).toBe(80000);
  const gen=Object.values(r.entities).find(e=>e.kind==='gen'&&e.poi==='light')!;r.player.x=gen.x;r.player.y=gen.y;const door=Object.values(r.entities).find(e=>e.kind==='door'&&e.poi==='light')!;expect(door.locked).toBe('power');expect(act(g,'generator',{eid:gen.id},'power').ok).toBe(true);expect(door.locked).toBe('power');expect(gen.poiPower!.expiresAt).toBeGreaterThan(gen.poiPower!.fueledAt);expect(countItem(r,'inv','fuel_can')).toBe(0);expect(act(g,'generator',{eid:gen.id},'power')).toMatchObject({ok:false,dup:true});expect(validate(snap(g))).toBeTruthy();
 });
});
