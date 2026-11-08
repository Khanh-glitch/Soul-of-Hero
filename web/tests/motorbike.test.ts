import {afterEach,describe,expect,it} from 'vitest';
import {BAL,TILE,WW,type Entity,type GameState} from '../src/game/core';
import {addItem,C,countItem,dispatch,markDirty,mkContainer,newGame,stepStations,harvestHit,killPlayer} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {vehicleClear} from '../src/game/motorbike';
import {WORKBENCH_UPGRADE_III} from '../src/game/catalog';
import {tick,settle,type Input} from '../src/game/sim';
import {serializeSnapshot,validate} from '../src/game/persist';
const T=Date.UTC(2026,10,5);let serial=0;
const act=(g:GameState,type:string,p:object={},id=`bike-${++serial}`,now=T+1)=>dispatch(g,{id,type,...p},now);
function setup(){setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:99},'start',T).ok).toBe(true);return g;}
const snapshot=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
const inp:Input={up:false,down:false,left:false,right:true,mx:100,my:100,attack:false,attackPressed:false,roll:false,cancel:false};
// Controlled proximity and inventory fixtures; no claim of natural acquisition or travel.
function line(g:GameState){const r=g.run!,w=getWorld(r.layoutId);for(let y=2;y<198;y++)for(let x=3;x<194;x++){let yes=true;for(let d=-1;d<=4;d++){const px=(x+d)*TILE+8,py=y*TILE+8;if(!w.economyMap.road[y*WW+x+d]||!vehicleClear(r,px,py)){yes=false;break;}}if(yes)return{x:x*TILE+8,y:y*TILE+8};}throw Error('no real road line');}
function deploy(g:GameState){const r=g.run!,q=line(g);r.player.x=q.x-TILE;r.player.y=q.y;addItem(r,'inv','motorbike_kit',1);expect(act(g,'placeMotorbike',q).ok).toBe(true);const e=Object.values(r.entities).find(e=>e.kind==='vehicle')!;return {r,e,q};}
function drive(g:GameState,frames:number,start=T+100){for(let i=0;i<frames;i++)tick(g,inp,50,start+i*50);}
afterEach(()=>setActiveLayout('shipping'));
describe('physical motorbike',()=>{
 it('uses paid research and timed workbench reservations to assemble exactly one deployable unit',()=>{
  const g=setup(),r=g.run!,p=r.player;const make=(type:'research'|'workbench'):Entity=>{const f=mkContainer(r,'fuel',3),o=mkContainer(r,'out',6),e:Entity={id:`fixture-${type}`,kind:'struct',type,x:p.x+8,y:p.y,tx:Math.floor(p.x/TILE),ty:Math.floor(p.y/TILE),hp:160,maxHp:160,station:{fuelC:f.id,outC:o.id,burn:0,queue:[],...(type==='workbench'?{level:2 as const}:{})}};r.entities[e.id]=e;return e;};const table=make('research'),bench=make('workbench');
  for(const [key,n] of [['spares',20],['iron_ingot',7],['mechanical_parts',4],['fasteners',4]] as const)addItem(r,'inv',key,n);
  expect(act(g,'research',{eid:table.id,mode:'directed',recipe:'motorbike_kit'}).ok).toBe(true);expect(countItem(r,'inv','motorbike_kit')).toBe(0);stepStations(g,BAL.research.directedSeconds*1000,T+50000);let out=C(r,table.station!.outC),i=out.slots.findIndex(s=>s?.key==='blueprint'&&s.meta==='motorbike_kit');expect(i).toBeGreaterThanOrEqual(0);expect(act(g,'move',{from:out.id,fs:i,to:'inv'}).ok).toBe(true);i=C(r,'inv').slots.findIndex(s=>s?.key==='blueprint'&&s.meta==='motorbike_kit');expect(act(g,'useItem',{slot:i}).ok).toBe(true);
  for(const key of ['vehicle_frame','vehicle_drive','motorbike_kit']){if(key==='motorbike_kit'){expect(act(g,'craft',{eid:bench.id,recipe:key}).ok).toBe(false);for(const [material,n] of WORKBENCH_UPGRADE_III.cost)addItem(r,'inv',material,n);expect(act(g,'upgradeStation',{eid:bench.id}).ok).toBe(true);expect(bench.station!.level).toBe(3);}expect(act(g,'craft',{eid:bench.id,recipe:key}).ok).toBe(true);expect(countItem(r,'inv',key)).toBe(0);stepStations(g,50000,T+100000);out=C(r,bench.station!.outC);i=out.slots.findIndex(s=>s?.key===key);expect(i).toBeGreaterThanOrEqual(0);expect(act(g,'move',{from:out.id,fs:i,to:'inv'}).ok).toBe(true);}
  expect(countItem(r,'inv','motorbike_kit')).toBe(1);expect(countItem(r,'inv','iron_ingot')).toBe(0);expect(countItem(r,'inv','mechanical_parts')).toBe(0);expect(countItem(r,'inv','fasteners')).toBe(0);expect(validate(snapshot(g))).toBeTruthy();
 });
 it('consumes physical fuel only on movement, retains identity/cargo across save, repairs and parks',()=>{
  const g=setup(),{r,e}=deploy(g),uid=e.deployed!.uid;addItem(r,'inv','fuel_can',1);const fuelId='fuel-once';expect(act(g,'vehicleRefuel',{eid:e.id},fuelId).ok).toBe(true);expect(act(g,'vehicleRefuel',{eid:e.id},fuelId)).toMatchObject({ok:false,dup:true});expect(countItem(r,'inv','fuel_can')).toBe(0);expect(e.vehicle!.fuel).toBe(100);
  addItem(r,'inv','core_fire',1);addItem(r,'inv','fasteners',1);const inv=C(r,'inv'),i=inv.slots.findIndex(s=>s?.key==='core_fire'),cargoUid=inv.slots[i]!.uid;expect(act(g,'move',{from:'inv',fs:i,to:e.c}).ok).toBe(true);const parts=inv.slots.findIndex(s=>s?.key==='fasteners');expect(act(g,'move',{from:'inv',fs:parts,to:e.c}).ok).toBe(true);expect(act(g,'vehicleMount',{eid:e.id}).ok).toBe(true);const startX=e.x;drive(g,10);expect(e.x).toBeGreaterThan(startX);expect(e.vehicle!.fuel).toBeLessThan(100);expect(e.hp).toBeLessThan(200);expect(e.deployed!.uid).toBe(uid);const fuel=e.vehicle!.fuel;drive(g,2,T+1000);expect(e.vehicle!.fuel).toBeLessThan(fuel);const saved=snapshot(g);expect(validate(saved)).toBeTruthy();const se=saved.run!.entities[e.id];expect(se.deployed!.uid).toBe(uid);expect(C(saved.run!,se.c!).slots.some(s=>s?.uid===cargoUid)).toBe(true);
  expect(act(saved,'vehicleExit',{},'exit',T+1200).ok).toBe(true);const parked={x:se.x,y:se.y,fuel:se.vehicle!.fuel};settle(saved,T+5000);expect([se.x,se.y,se.vehicle!.fuel]).toEqual([parked.x,parked.y,parked.fuel]);addItem(saved.run!,'inv','mechanical_parts',1);const carried=C(saved.run!,se.c!).slots.findIndex(s=>s?.key==='fasteners');expect(act(saved,'move',{from:se.c,fs:carried,to:'inv'},'unload-fasteners',T+5001).ok).toBe(true);expect(act(saved,'vehicleRepair',{eid:se.id},'repair',T+5001).ok).toBe(true);expect(se.deployed!.uid).toBe(uid);expect(countItem(saved.run!,'inv','mechanical_parts')).toBe(0);const slot=C(saved.run!,se.c!).slots.findIndex(s=>s?.uid===cargoUid);expect(act(saved,'move',{from:se.c,fs:slot,to:'inv'},'unload',T+5002).ok).toBe(true);expect(C(saved.run!,'inv').slots.some(s=>s?.uid===cargoUid)).toBe(true);expect(validate(snapshot(saved))).toBeTruthy();
 });
 it('blocks empty tanks, obstacles and invalid or unsafe map deployment without consuming goods',()=>{
  const g=setup(),{r,e}=deploy(g);r.spiritTransit={x:e.x+16,y:e.y,arriveAt:T+100,uid:'fixture'};expect(act(g,'vehicleMount',{eid:e.id}).ok).toBe(false);delete r.spiritTransit;expect(act(g,'vehicleMount',{eid:e.id}).ok).toBe(true);expect(act(g,'build',{struct:'wall_wood',tx:Math.floor(e.x/TILE)+1,ty:Math.floor(e.y/TILE)}).ok).toBe(false);const x=e.x,y=e.y;drive(g,5);expect([e.x,e.y]).toEqual([x,y]);expect(e.vehicle!.fuel).toBe(0);expect(validate(snapshot(g))).toBeTruthy();
  expect(act(g,'vehicleExit',{},'exit1',T+500).ok).toBe(true);addItem(r,'inv','fuel_can',1);expect(act(g,'vehicleRefuel',{eid:e.id},'fill',T+501).ok).toBe(true);expect(act(g,'vehicleMount',{eid:e.id},'mount2',T+502).ok).toBe(true);
  const barrier:Entity={id:'fixture-wall',kind:'struct',type:'wall_wood',tx:Math.floor(e.x/TILE)+1,ty:Math.floor(e.y/TILE),x:e.x+TILE,y:e.y,hp:100,maxHp:100};r.entities[barrier.id]=barrier;markDirty();const before=e.vehicle!.fuel;drive(g,20,T+550);expect(e.x).toBeLessThan(barrier.tx!*TILE-5);expect(e.vehicle!.fuel).toBeLessThanOrEqual(before);expect(e.vehicle!.fuel).toBeGreaterThanOrEqual(0);expect(validate(snapshot(g))).toBeTruthy();
 });
 it('keeps parked vehicle and cargo on death and removes them at run end',()=>{
  const g=setup(),{r,e}=deploy(g);addItem(r,'inv','core_fire',1);const slot=C(r,'inv').slots.findIndex(s=>s?.key==='core_fire'),uid=C(r,'inv').slots[slot]!.uid;expect(act(g,'move',{from:'inv',fs:slot,to:e.c}).ok).toBe(true);const position=[e.x,e.y];killPlayer(g,T+50,'fixture');expect(r.entities[e.id]).toBe(e);expect([e.x,e.y]).toEqual(position);expect(C(r,e.c!).slots.some(s=>s?.uid===uid)).toBe(true);expect(validate(snapshot(g))).toBeTruthy();expect(act(g,'abandon',{},'end',T+100).ok).toBe(true);expect(g.run).toBeNull();expect(g.profile.history[0].ending).toBe('abandoned');
 });
 it('replays actual wreck salvage through a funded furnace into the same canister used by a vehicle',()=>{
  const g=setup(),r=g.run!,w=getWorld(r.layoutId);let scanned=0;
  for(let i=0;i<w.sourceV3.length && countItem(r,'inv','salvaged_oil')<4;i++)if(w.sourceV3[i]==='wreck'){
    const tx=i%WW,ty=Math.floor(i/WW),x=tx*TILE+8,y=ty*TILE+8;r.player.x=x;r.player.y=y;harvestHit(g,tx,ty,{scrap:30},T+1,x,y);scanned++;
    for(const e of Object.values(r.entities).filter(e=>e.kind==='drop'&&Math.hypot(e.x-x,e.y-y)<30))act(g,'pickup',{eid:e.id});
    if(scanned>=12)break;
  }
  expect(countItem(r,'inv','salvaged_oil')).toBeGreaterThanOrEqual(4);expect(act(g,'sort',{c:'inv'}).ok).toBe(true); // the player compacts a full pack (real Sort action) — whole-stack custody moves from R6.1 leave more slots occupied, so compact first
  const p=r.player;
  const station=(type:'research'|'furnace'):Entity=>{const f=mkContainer(r,'fuel',3),o=mkContainer(r,'out',6),e:Entity={id:`fixture-${type}`,kind:'struct',type,x:p.x,y:p.y,tx:Math.floor(p.x/TILE),ty:Math.floor(p.y/TILE),hp:160,maxHp:160,station:{fuelC:f.id,outC:o.id,burn:0,queue:[]}};r.entities[e.id]=e;return e;};
  const table=station('research'), furnace=station('furnace');addItem(r,'inv','glass',1);addItem(r,furnace.station!.fuelC,'wood',1);let slot=C(r,'inv').slots.findIndex(s=>s?.key==='salvaged_oil'),oil=C(r,'inv').slots[slot]!;expect(act(g,'research',{eid:table.id,mode:'specimen',slot,uid:oil.uid}).ok).toBe(true);stepStations(g,30000,T+30000);let out=C(r,table.station!.outC);slot=out.slots.findIndex(s=>s?.key==='blueprint'&&s.meta==='refine_salvaged_oil');expect(act(g,'move',{from:out.id,fs:slot,to:'inv'}).ok).toBe(true);slot=C(r,'inv').slots.findIndex(s=>s?.key==='blueprint'&&s.meta==='refine_salvaged_oil');expect(act(g,'useItem',{slot}).ok).toBe(true);expect(act(g,'craft',{eid:furnace.id,recipe:'refine_salvaged_oil'}).ok).toBe(true);stepStations(g,18000,T+50000);out=C(r,furnace.station!.outC);slot=out.slots.findIndex(s=>s?.key==='fuel_can');expect(slot).toBeGreaterThanOrEqual(0);expect(act(g,'move',{from:out.id,fs:slot,to:'inv'}).ok).toBe(true);
  markDirty();const q=line(g);p.x=q.x-TILE;p.y=q.y;addItem(r,'inv','motorbike_kit',1);expect(act(g,'placeMotorbike',q).ok).toBe(true);const bike=Object.values(r.entities).find(e=>e.kind==='vehicle')!;const cansBefore=countItem(r,'inv','fuel_can');expect(act(g,'vehicleRefuel',{eid:bike.id}).ok).toBe(true);expect(bike.vehicle!.fuel).toBe(100);expect(countItem(r,'inv','fuel_can')).toBe(cansBefore-1);expect(validate(snapshot(g))).toBeTruthy();
 });

 it('enforces bounded freight, including swaps and forged saved fuel',()=>{
  const g=setup(),{r,e}=deploy(g);addItem(r,'inv','iron_ingot',80);for(let n=0;n<2;n++){const i=C(r,'inv').slots.findIndex(s=>s?.key==='iron_ingot');expect(act(g,'move',{from:'inv',fs:i,to:e.c}).ok).toBe(true);}addItem(r,'inv','stone',1);let i=C(r,'inv').slots.findIndex(s=>s?.key==='stone');expect(act(g,'move',{from:'inv',fs:i,to:e.c}).ok).toBe(false);expect(countItem(r,'inv','stone')).toBe(1);const cargo=C(r,e.c!),ci=cargo.slots.findIndex(Boolean);expect(act(g,'move',{from:e.c,fs:ci,to:'inv',ts:i}).ok).toBe(true); // swapping 40kg for 1.2kg is legal
  addItem(r,'inv','iron_ingot',40);i=C(r,'inv').slots.findIndex(s=>s?.key==='iron_ingot'&&s.qty===40);expect(i).toBeGreaterThanOrEqual(0);expect(act(g,'move',{from:'inv',fs:i,to:e.c}).ok).toBe(false);
  const bad=snapshot(g);bad.run!.entities[e.id].vehicle!.fuel=-1;expect(validate(bad)).toBeNull();const bad2=snapshot(g);bad2.run!.entities[e.id].vehicle!.fuel=301;expect(validate(bad2)).toBeNull();
 });
 it('compares walking, empty hand cart, and empty versus loaded motorbike on the same real road',()=>{
  const g=setup(),{r,e,q}=deploy(g);addItem(r,'inv','fuel_can',1);expect(act(g,'vehicleRefuel',{eid:e.id}).ok).toBe(true);expect(act(g,'vehicleMount',{eid:e.id}).ok).toBe(true);const base=snapshot(g),bike=structuredClone(base),loaded=structuredClone(base),walk=structuredClone(base),cart=structuredClone(base);
  const le=loaded.run!.entities[e.id];addItem(loaded.run!,le.c!,'iron_ingot',40);addItem(loaded.run!,le.c!,'iron_ingot',40);
  for(const other of [walk,cart]){const rr=other.run!;delete rr.player.vehicle;delete rr.entities[e.id];delete rr.custody[e.c!];rr.player.x=q.x;rr.player.y=q.y;markDirty();}
  addItem(cart.run!,'inv','cart_kit',1);expect(act(cart,'placeCart',{x:q.x-TILE,y:q.y},'compare-cart').ok).toBe(true);const ce=Object.values(cart.run!.entities).find(v=>v.kind==='cart')!;expect(act(cart,'grabCart',{eid:ce.id},'compare-grab').ok).toBe(true);
  const dist=(run:GameState)=>{markDirty();const x=run.run!.player.x;drive(run,8);return run.run!.player.x-x;};const bd=dist(bike),ld=dist(loaded),wd=dist(walk),cd=dist(cart);
  expect(bd).toBeGreaterThan(cd);expect(cd).toBeGreaterThan(wd);expect(ld).toBeLessThan(bd);expect(bike.run!.entities[e.id].vehicle!.fuel).toBeLessThan(100);expect(loaded.run!.entities[e.id].vehicle!.fuel).toBeLessThan(100);
 });

 it('rejects deployment on uncontracted Veyra and failed/replayed transactions without a debit',()=>{
  const g=setup(),{r,e,q}=deploy(g);addItem(r,'inv','motorbike_kit',1);expect(act(g,'vehicleMount',{eid:e.id},'once-mount').ok).toBe(true);const before=countItem(r,'inv','motorbike_kit');expect(act(g,'vehicleMount',{eid:e.id},'once-mount')).toMatchObject({ok:false,dup:true});expect(act(g,'placeMotorbike',{x:q.x+32,y:q.y}).ok).toBe(false);expect(countItem(r,'inv','motorbike_kit')).toBe(before);expect(Object.values(r.entities).filter(e=>e.kind==='vehicle')).toHaveLength(1);
  expect(getWorld('veyra-greywater-lr02-u16').vehicleGeometry).toBeUndefined();setActiveLayout('veyra-greywater-lr02-u16');const v=newGame();expect(act(v,'startRun',{character:'female',seed:19},'veyra-start',T).ok).toBe(true);addItem(v.run!,'inv','motorbike_kit',1);const vp=v.run!.player;expect(act(v,'placeMotorbike',{x:vp.x,y:vp.y}).ok).toBe(false);expect(countItem(v.run!,'inv','motorbike_kit')).toBe(1);
 });

 it('carries actual Foundry loot over a real road and spends the unloaded parts on vehicle repair',()=>{
  const g=setup(),r=g.run!,source=Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='factory'&&C(r,e.c!).slots.some(s=>s?.key==='mechanical_parts'))!,box=C(r,source.c!);r.player.x=source.x;r.player.y=source.y;const originals:Record<string,string>={};
  for(const key of ['mechanical_parts','fasteners']){const i=box.slots.findIndex(s=>s?.key===key);originals[key]=box.slots[i]!.uid;expect(act(g,'move',{from:box.id,fs:i,to:'inv'}).ok).toBe(true);}
  const q=line(g);r.player.x=q.x-TILE;r.player.y=q.y;addItem(r,'inv','motorbike_kit',1);addItem(r,'inv','fuel_can',1);expect(act(g,'placeMotorbike',q).ok).toBe(true);const e=Object.values(r.entities).find(e=>e.kind==='vehicle')!;
  for(const key of ['mechanical_parts','fasteners']){const i=C(r,'inv').slots.findIndex(s=>s?.key===key);expect(act(g,'move',{from:'inv',fs:i,to:e.c}).ok).toBe(true);expect(C(r,e.c!).slots.some(s=>s?.uid===originals[key])).toBe(true);}
  expect(act(g,'vehicleRefuel',{eid:e.id}).ok).toBe(true);expect(act(g,'vehicleMount',{eid:e.id}).ok).toBe(true);drive(g,8);expect(act(g,'vehicleExit',{},'loot-exit',T+1000).ok).toBe(true);
  for(const key of ['mechanical_parts','fasteners']){const i=C(r,e.c!).slots.findIndex(s=>s?.uid===originals[key]);expect(act(g,'move',{from:e.c,fs:i,to:'inv'},`take-${key}`,T+1001).ok).toBe(true);expect(C(r,'inv').slots.some(s=>s?.uid===originals[key])).toBe(true);}
  expect(act(g,'vehicleRepair',{eid:e.id},'loot-repair',T+1002).ok).toBe(true);expect(countItem(r,'inv','mechanical_parts')).toBe(1);expect(countItem(r,'inv','fasteners')).toBe(2);expect(validate(snapshot(g))).toBeTruthy();
 });

});
