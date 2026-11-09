// MEC-01 R6 P0: same straight road, same 40-ingot physical load, out-and-back trip, walking vs pulled cart vs motorbike.
// SIM_FIXTURE_MEASUREMENT: real tick() movement, fuel and wear from the engine. Fixture = the road position/start
// and the injected 40 ingots (labelled), the vehicle is placed by real kit placement and refuelled by a real fuel canister.
// Output: evidence/mec01-r6/freight-speed-<LABEL>.json (LABEL env, default 'current').
import {describe,it,expect,afterEach} from 'vitest';
import {writeFileSync} from 'node:fs';
import {BAL,TILE,WW,type Entity,type GameState} from '../src/game/core';
import {addItem,C,dispatch,newGame,cartWeight} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {vehicleClear} from '../src/game/motorbike';
import {tick,type Input} from '../src/game/sim';
const T=Date.UTC(2026,10,9);let clock=T+1;let serial=0;
const act=(g:GameState,type:string,p:object={})=>dispatch(g,{id:`r6-${++serial}`,type,...p} as any,clock);
const still:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};
const east:Input={...still,right:true,mx:100,my:0};const west:Input={...still,left:true,mx:-100,my:0};
afterEach(()=>setActiveLayout('shipping'));
const LEN=28; // tiles of straight, clear road required
function setup(seed=85){setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed}).ok).toBe(true);g.run!.creatures=[];return g;}
function roadRun(g:GameState){
  const r=g.run!,w=getWorld(r.layoutId);const road:any=(w as any).vehicleGeometry?.road??w.economyMap.road;
  for(let y=2;y<198;y++)for(let x=3;x+LEN<=186;x++){
    let ok=true;
    for(let d=0;d<LEN;d++){const px=(x+d)*TILE+8,py=y*TILE+8;if(!road[y*WW+x+d]||!vehicleClear(r,px,py)){ok=false;break;}}
    if(ok)return {x:x*TILE+8,y:y*TILE+8};
  }
  throw Error('no straight road run of '+LEN+' tiles');
}
/** one-way out (east) then back (west); returns time, path, fuel, wear. */
function trip(g:GameState,mover:()=>{x:number,y:number},mount:Entity|null,leg:number){
  const r=g.run!;const f0=mount?.vehicle?.fuel??0,h0=mount?.hp??0;
  let t=clock+1000,ticks=0,path=0,last=mover();const start=last;let turnAt:{x:number,y:number}|null=null;
  const step=(inp:Input)=>{tick(g,inp,50,t);t+=50;ticks++;const n=mover();path+=Math.hypot(n.x-last.x,n.y-last.y);last=n;};
  while(Math.hypot(last.x-start.x,last.y-start.y)<leg&&ticks<4000)step(east);
  turnAt={...last};
  while(Math.hypot(last.x-start.x,last.y-start.y)>8&&ticks<8000)step(west);
  return {seconds:+(ticks*0.05).toFixed(2),outTiles:Math.round(leg/TILE),pathPx:Math.round(path),returnedToStart:Math.hypot(last.x-start.x,last.y-start.y)<=8,avgPxPerSec:+(path/(ticks*0.05)).toFixed(1),fuelUsed:mount?+(f0-(mount.vehicle?.fuel??0)).toFixed(2):0,wearHp:mount?+(h0-(mount.hp??0)).toFixed(2):0,turnAt:{x:Math.round(turnAt.x),y:Math.round(turnAt.y)}};
}
const LEG=(LEN-2)*TILE;
const rows:Record<string,any>={};
describe('MEC-01 R6 P0 freight speed (same road, same 40-ingot load)',()=>{
  it('walking empty and loaded, cart empty and loaded, motorbike empty and loaded', ()=>{
    for(const loaded of [false,true]){
      const g=setup(),r=g.run!,q=roadRun(g);r.player.x=q.x;r.player.y=q.y;
      if(loaded){addItem(r,'inv','iron_ingot',40);}
      const w=cartWeight(r,'inv');
      rows[loaded?'walk_loaded':'walk_empty']={carriedKg:+w.toFixed(1),...trip(g,()=>({x:r.player.x,y:r.player.y}),null,LEG)};
    }
    for(const loaded of [false,true]){
      const g=setup(),r=g.run!,q=roadRun(g);
      r.player.x=q.x-TILE;r.player.y=q.y;addItem(r,'inv','cart_kit',1);expect(act(g,'placeCart',{x:q.x,y:q.y}).ok).toBe(true);
      const cart=Object.values(r.entities).find(e=>e.kind==='cart')!;r.player.x=cart.x-TILE;r.player.y=cart.y;expect(act(g,'grabCart',{eid:cart.id}).ok).toBe(true);
      if(loaded){addItem(r,cart.c!,'iron_ingot',40);}
      rows[loaded?'cart_loaded':'cart_empty']={cartKg:+cartWeight(r,cart.c!).toFixed(1),...trip(g,()=>({x:cart.x,y:cart.y}),null,LEG)};
    }
    for(const loaded of [false,true]){
      const g=setup(),r=g.run!,q=roadRun(g);
      r.player.x=q.x-TILE;r.player.y=q.y;addItem(r,'inv','motorbike_kit',1);expect(act(g,'placeMotorbike',q).ok).toBe(true);
      const bike=Object.values(r.entities).find(e=>e.kind==='vehicle')!;
      addItem(r,'inv','fuel_can',1);expect(act(g,'vehicleRefuel',{eid:bike.id}).ok).toBe(true);
      expect(act(g,'vehicleMount',{eid:bike.id}).ok).toBe(true);
      if(loaded){addItem(r,'inv','iron_ingot',40);let guard=0;while(guard++<60){const i=C(r,'inv').slots.findIndex(s=>s?.key==='iron_ingot');if(i<0)break;const b=act(g,'move',{from:'inv',fs:i,to:bike.c});if(!b.ok)break;}}
      rows[loaded?'bike_loaded':'bike_empty']={cargoKg:+cartWeight(r,bike.c!).toFixed(1),maxKg:BAL.motorbike.maxWeight,fuelBefore:BAL.motorbike.tank,...trip(g,()=>({x:bike.x,y:bike.y}),bike,LEG)};
    }
    writeFileSync(`evidence/mec01-r6/freight-speed-${process.env.LABEL||'current'}.json`,JSON.stringify({sha:process.env.SHA||'',roadTiles:LEN,leg:LEG,rows},null,1));
    console.log('R6ROWS '+JSON.stringify(rows));
    expect(rows.walk_loaded.returnedToStart).toBe(true);
    expect(rows.bike_loaded.returnedToStart).toBe(true);
  });
});
