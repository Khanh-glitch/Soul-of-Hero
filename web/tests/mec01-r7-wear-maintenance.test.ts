// MEC-01 R7: wear must bite within one fuel tank, and repair must cost the physical parts it names.
// SIM_FIXTURE_MEASUREMENT: real tick() movement, real refuel/mount/cargo intents. Fixture: the road start, 3 fuel cans
// placed in inventory, 40 ingots placed in the bike cargo through real move intents. Wear and fuel come from the engine.
import {describe,it,expect} from 'vitest';
import {TILE,WW,type Entity,type GameState} from '../src/game/core';
import {addItem,C,countItem,dispatch,newGame} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {vehicleClear} from '../src/game/motorbike';
import {tick,type Input} from '../src/game/sim';
const T=Date.UTC(2026,10,10);let clock=T+1;let n=0;
const act=(g:GameState,type:string,p:object={})=>dispatch(g,{id:`r7-${++n}`,type,...p} as any,clock);
const still:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};
const east:Input={...still,right:true,mx:100,my:0};const west:Input={...still,left:true,mx:-100,my:0};
const LEN=28;
function loadedBike(){
  setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:85}).ok).toBe(true);g.run!.creatures=[];
  const r=g.run!;const road:any=(getWorld(r.layoutId) as any).vehicleGeometry.road;let q:{x:number,y:number}|undefined;
  outer: for(let y=2;y<198;y++)for(let x=3;x+LEN<=186;x++){let ok=true;for(let d=0;d<LEN;d++){const px=(x+d)*TILE+8,py=y*TILE+8;if(!road[y*WW+x+d]||!vehicleClear(r,px,py)){ok=false;break;}}if(ok){q={x:x*TILE+8,y:y*TILE+8};break outer;}}
  r.player.x=q!.x-TILE;r.player.y=q!.y;addItem(r,'inv','motorbike_kit',1);expect(act(g,'placeMotorbike',q).ok).toBe(true);
  const bike=Object.values(r.entities).find(e=>e.kind==='vehicle') as Entity;
  for(let k=0;k<3;k++){addItem(r,'inv','fuel_can',1);expect(act(g,'vehicleRefuel',{eid:bike.id}).ok).toBe(true);}
  expect(act(g,'vehicleMount',{eid:bike.id}).ok).toBe(true);
  addItem(r,'inv','iron_ingot',40);
  for(let i=0;i<40;i++){const s=C(r,'inv').slots.findIndex(x=>x?.key==='iron_ingot');if(s<0)break;if(!act(g,'move',{from:'inv',fs:s,to:bike.c}).ok)break;}
  return {g,r,bike};
}
function driveUntilEmpty(g:GameState,bike:Entity){
  const LEG=(LEN-2)*TILE;let guard=0;
  while(bike.vehicle!.fuel>0&&guard++<40){
    const start={x:bike.x,y:bike.y};let last={...start};
    const step=(inp:Input)=>{tick(g,inp,50,clock);clock+=50;last={x:bike.x,y:bike.y};};
    let t=0;while(Math.hypot(last.x-start.x,last.y-start.y)<LEG&&t++<4000&&bike.vehicle!.fuel>0)step(east);
    t=0;while(Math.hypot(last.x-start.x,last.y-start.y)>8&&t++<8000&&bike.vehicle!.fuel>0)step(west);
  }
}
describe('MEC-01 R7 wear and maintenance', () => {
  it('one full tank of loaded freight costs a real share of hull HP, and repair takes exactly one part-set', () => {
    const {g,r,bike}=loadedBike();const hp0=bike.hp!;
    driveUntilEmpty(g,bike);
    const lost=hp0-bike.hp!;
    expect(bike.vehicle!.fuel).toBe(0);
    expect(lost).toBeGreaterThan(40);   // measured 48 at wearPerPixel 0.008 (was 12 at 0.002)
    expect(lost).toBeLessThan(60);
    // Repair needs both named parts; a missing Fastener refuses and changes nothing (negative control).
    addItem(r,'inv','mechanical_parts',1);
    const hpBefore=bike.hp!;
    // Dismount next to the bike so the repair intent is legal
    expect(act(g,'vehicleExit',{eid:bike.id}).ok).toBe(true);
    const mp0=countItem(r,'inv','mechanical_parts');
    expect(act(g,'vehicleRepair',{eid:bike.id}).ok).toBe(false);
    expect(bike.hp!).toBe(hpBefore);expect(countItem(r,'inv','mechanical_parts')).toBe(mp0);
    addItem(r,'inv','fasteners',1);
    expect(act(g,'vehicleRepair',{eid:bike.id}).ok).toBe(true);
    expect(bike.hp!).toBeCloseTo(Math.min(200,hpBefore+50),1);
    expect(countItem(r,'inv','mechanical_parts')).toBe(mp0-1);
    expect(countItem(r,'inv','fasteners')).toBe(0);
  });
});
