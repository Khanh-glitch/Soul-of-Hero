import {afterEach,describe,it,expect} from 'vitest';
import {TILE,WW,type Entity,type GameState} from '../src/game/core';
import {addItem,C,countItem,dispatch,harvestHit,markDirty,mkContainer,newGame,stepStations,sourceAt} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {RECIPES} from '../src/game/catalog';
import {serializeSnapshot,validate} from '../src/game/persist';
import {settle} from '../src/game/sim';
const T=Date.UTC(2026,10,5);let seq=0;
const act=(g:GameState,type:string,data:object={},now=T+10)=>dispatch(g,{id:`oil-${++seq}`,type,...data},Math.max(now,g.run?.clock.lastSimAt??now));
function station(g:GameState,type:'furnace'|'research'|'refinery'){const r=g.run!,p=r.player,f=mkContainer(r,'fuel',3),o=mkContainer(r,'out',6),e:Entity={id:`oil-machine-${++seq}`,kind:'struct',type,x:p.x+16,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:160,maxHp:160,station:{fuelC:f.id,outC:o.id,burn:0,queue:[]}};if(type==='refinery')e.identity='refinery-v1';r.entities[e.id]=e;markDirty();return e;}
const snap=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
afterEach(()=>setActiveLayout('shipping'));
// ITEM SET V3: Salvaged Oil is retired into Crude Petroleum. Wrecks no longer leak oil, the oil specimen study and the
// furnace recipe `refine_salvaged_oil` are gone; oil becomes fuel only as Crude Petroleum + Glass at an Oil Refinery.
// The crude here is a FIXTURE grant: Shipping has no seep (the Veyra seep -> pump route is in arena1-round2-mechanics).
describe('oil causal chain (item set v3)',()=>{
 it('finite wrecks yield no oil; crude refines with fuel at a Refinery, settles once offline, and opens the actual lighthouse generator',()=>{
  setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:314},T).ok).toBe(true);const r=g.run!;r.creatures=[];const w=getWorld();
  // Authoritative source cells, genuine harvest: three wrecks are emptied and nothing oily ever drops.
  let wrecks=0;
  for(let i=0;i<w.sourceV3.length && wrecks<3;i++){
   if(w.sourceV3[i]!=='wreck')continue;wrecks++;const tx=i%WW,ty=Math.floor(i/WW);r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;
   while((sourceAt(r,tx,ty)?.stock||0)>0)harvestHit(g,tx,ty,{scrap:30},T+50,r.player.x,r.player.y);
  }
  expect(wrecks).toBe(3);
  const dropped=Object.values(r.entities).filter(e=>e.kind==='drop'&&e.c).map(e=>C(r,e.c!).slots[0]?.key);
  expect(dropped).toContain('spares');for(const k of ['salvaged_oil','crude_petroleum','lubricant','scrap'])expect(dropped,k).not.toContain(k);
  expect(RECIPES.refine_salvaged_oil).toBeUndefined();
  // a granted Salvaged Oil arrives as crude, 1:1
  addItem(r,'inv','salvaged_oil',3);expect(countItem(r,'inv','salvaged_oil')).toBe(0);expect(countItem(r,'inv','crude_petroleum')).toBe(3);
  // the furnace refuses; the Refinery (FIXTURE entity) accepts, stalls without fuel, then works
  const f=station(g,'furnace');addItem(r,'inv','glass',1);expect(act(g,'craft',{eid:f.id,recipe:'refinery_fuel'}).ok).toBe(false);expect(countItem(r,'inv','crude_petroleum')).toBe(3);
  const ref=station(g,'refinery');expect(act(g,'craft',{eid:ref.id,recipe:'refinery_fuel'}).ok).toBe(true);expect(countItem(r,'inv','crude_petroleum')).toBe(0);
  const total=RECIPES.refinery_fuel.secs*1000;stepStations(g,total,T+48000);expect(ref.station!.queue[0].left).toBe(total);addItem(r,ref.station!.fuelC,'wood',1);
  const saved=snap(g);expect(validate(saved)).toBeTruthy();settle(saved,T+48000+total+10,true);const rr=saved.run!,ff=rr.entities[ref.id];expect(countItem(rr,ff.station!.outC,'fuel_can')).toBe(1);settle(saved,T+48000+total+10,true);expect(countItem(rr,ff.station!.outC,'fuel_can')).toBe(1);const o=C(rr,ff.station!.outC);expect(act(saved,'move',{from:o.id,fs:o.slots.findIndex(s=>s?.key==='fuel_can'),to:'inv'}).ok).toBe(true);
  const gen=Object.values(rr.entities).find(e=>e.kind==='gen'&&e.poi==='light')!;const door=Object.values(rr.entities).find(e=>e.kind==='door'&&e.poi==='light')!;rr.player.x=gen.x;rr.player.y=gen.y;expect(act(saved,'generator',{eid:gen.id}).ok).toBe(true);expect(door.locked).toBe('power');expect(gen.poiPower!.expiresAt).toBeGreaterThan(gen.poiPower!.fueledAt);expect(countItem(rr,'inv','fuel_can')).toBe(0);expect(validate(snap(saved))).toBeTruthy();setActiveLayout('shipping');
 });
});
