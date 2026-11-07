import {afterEach,describe,it,expect} from 'vitest';
import {TILE,WW,type Entity,type GameState} from '../src/game/core';
import {addItem,C,countItem,dispatch,harvestHit,markDirty,mkContainer,newGame,stepStations,sourceAt} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {serializeSnapshot,validate} from '../src/game/persist';
import {settle} from '../src/game/sim';
const T=Date.UTC(2026,10,5);let seq=0;
const act=(g:GameState,type:string,data:object={},now=T+10)=>dispatch(g,{id:`oil-${++seq}`,type,...data},Math.max(now,g.run?.clock.lastSimAt??now));
function station(g:GameState,type:'furnace'|'research'){const r=g.run!,p=r.player,f=mkContainer(r,'fuel',3),o=mkContainer(r,'out',6),e:Entity={id:`oil-machine-${++seq}`,kind:'struct',type,x:p.x+16,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:160,maxHp:160,station:{fuelC:f.id,outC:o.id,burn:0,queue:[]}};r.entities[e.id]=e;markDirty();return e;}
const snap=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
afterEach(()=>setActiveLayout('shipping'));
describe('salvaged oil causal chain',()=>{
 it('harvests finite physical wrecks, studies oil, refines with fuel, and opens the actual lighthouse generator',()=>{
  setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:314},T).ok).toBe(true);const r=g.run!;r.creatures=[];const w=getWorld();
  // Authoritative source cells, genuine harvest and pickup; player relocation and
  // stations are fixtures, so this is not an end-to-end natural travel journey.
  for(let i=0;i<w.sourceV3.length && countItem(r,'inv','salvaged_oil')<4;i++){
   if(w.sourceV3[i]!=='wreck')continue;const tx=i%WW,ty=Math.floor(i/WW);r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;
   while((sourceAt(r,tx,ty)?.stock||0)>0)harvestHit(g,tx,ty,{scrap:30},T+50,r.player.x,r.player.y);
   for(const e of Object.values(r.entities))if(e.kind==='drop'&&e.c&&C(r,e.c).slots[0]?.key==='salvaged_oil'&&Math.hypot(e.x-r.player.x,e.y-r.player.y)<30)expect(act(g,'pickup',{eid:e.id}).ok).toBe(true);
  }
  expect(countItem(r,'inv','salvaged_oil')).toBeGreaterThanOrEqual(4);const table=station(g,'research');const slot=C(r,'inv').slots.findIndex(s=>s?.key==='salvaged_oil');const uid=C(r,'inv').slots[slot]!.uid;
  expect(act(g,'research',{eid:table.id,mode:'specimen',slot,uid}).ok).toBe(true);stepStations(g,30000,T+30000);let o=C(r,table.station!.outC);let bp=o.slots.findIndex(s=>s?.key==='blueprint'&&s.meta==='refine_salvaged_oil');expect(bp).toBeGreaterThanOrEqual(0);expect(act(g,'move',{from:o.id,fs:bp,to:'inv'}).ok).toBe(true);bp=C(r,'inv').slots.findIndex(s=>s?.key==='blueprint'&&s.meta==='refine_salvaged_oil');expect(act(g,'useItem',{slot:bp}).ok).toBe(true);
  const f=station(g,'furnace');addItem(r,'inv','glass',1);expect(act(g,'craft',{eid:f.id,recipe:'refine_salvaged_oil'}).ok).toBe(true);stepStations(g,18000,T+48000);expect(f.station!.queue[0].left).toBe(18000);addItem(r,f.station!.fuelC,'wood',1);
  const saved=snap(g);expect(validate(saved)).toBeTruthy();settle(saved,T+18010,true);const rr=saved.run!,ff=rr.entities[f.id];expect(countItem(rr,ff.station!.outC,'fuel_can')).toBe(1);settle(saved,T+18010,true);expect(countItem(rr,ff.station!.outC,'fuel_can')).toBe(1);o=C(rr,ff.station!.outC);expect(act(saved,'move',{from:o.id,fs:o.slots.findIndex(s=>s?.key==='fuel_can'),to:'inv'}).ok).toBe(true);
  const gen=Object.values(rr.entities).find(e=>e.kind==='gen'&&e.poi==='light')!;const door=Object.values(rr.entities).find(e=>e.kind==='door'&&e.poi==='light')!;rr.player.x=gen.x;rr.player.y=gen.y;expect(act(saved,'generator',{eid:gen.id}).ok).toBe(true);expect(door.locked).toBe('power');expect(gen.poiPower!.expiresAt).toBeGreaterThan(gen.poiPower!.fueledAt);expect(countItem(rr,'inv','fuel_can')).toBe(0);expect(validate(snap(saved))).toBeTruthy();setActiveLayout('shipping');
 });
});
