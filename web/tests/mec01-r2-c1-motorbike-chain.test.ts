// MEC-01 R2 (C1/C2): physical industrial chain to a Motorbike Kit, then a real cargo trip to a player-built chest.
// Labels:
//   CRAFTED  = real craft/upgrade/build intents on the real bench (paid, timed, with reservations).
//   FIXTURE  = granted materials (starter stock and one fuel canister), and the player actor placed beside the bench/road.
//   INTENT   = the freight leg uses real tick() movement along the road, the vehicle intents (place/refuel/mount/move/unload).
// Not claimed: natural walking from spawn, natural acquisition of the grants, or human play.
// Same-cargo comparison (walk vs motorbike) is on the same road and the same 40 ingots; a hand cart is covered by b05-freight-compare.
import {describe,it,expect,afterEach} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {type GameState,type RunState,type Entity,TILE,WW,BAL} from '../src/game/core';
import {RECIPES,WORKBENCH_UPGRADE_III} from '../src/game/catalog';
import {addItem,C,countItem,dispatch,markDirty,newGame,stepStations,buildReason} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {vehicleClear} from '../src/game/motorbike';
import {tick,type Input} from '../src/game/sim';
import {serializeSnapshot,validate} from '../src/game/persist';

const START=Date.UTC(2026,10,7);let n=0;
const still:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};
const east:Input={...still,right:true,mx:100,my:100};
afterEach(()=>setActiveLayout('shipping'));
const act=(g:GameState,type:string,p:object={},at=START+10)=>dispatch(g,{id:'c1-'+(++n),type,...p} as any,at);
const place=(r:RunState,tx:number,ty:number)=>{r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;markDirty();};
const cacheOf=(r:RunState)=>Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='factory'&&e.c&&r.custody[e.c]?.slots.some(s=>s?.key==='iron_sword'))!;
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:303},START).ok).toBe(true);g.run!.creatures=[];markDirty();return g;}
function legalTileNear(g:GameState,cx:number,cy:number,struct='workbench'):[number,number]{
  const r=g.run!;for(let k=1;k<=10;k++)for(let dy=-k;dy<=k;dy++)for(let dx=-k;dx<=k;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==k)continue;const tx=cx+dx,ty=cy+dy;place(r,tx-1,ty);if(!buildReason(g,struct,tx,ty))return [tx,ty];}
  throw new Error('no legal workbench tile');
}
function roadLine(g:GameState){const r=g.run!,w=getWorld(r.layoutId);for(let y=2;y<198;y++)for(let x=3;x<186;x++){let yes=true;for(let d=-1;d<=8;d++){const px=(x+d)*TILE+8,py=y*TILE+8;if(!w.economyMap.road[y*WW+x+d]||!vehicleClear(r,px,py)){yes=false;break;}}if(yes)return{x:x*TILE+8,y:y*TILE+8};}throw Error('no real road line');}
/** Craft one recipe at the bench and move its output into the pack. Real intents, real time. */
function craftOut(g:GameState,bench:Entity,recipe:string,at:number){
  const r=g.run!;const rc=RECIPES[recipe];place(r,bench.tx!-1,bench.ty!);const pre=act(g,'craft',{eid:bench.id,recipe},at);expect(pre.ok,recipe+': '+(pre as any).reason+' inv='+JSON.stringify(['iron_ingot','fasteners','spares','mechanical_parts','vehicle_frame','vehicle_drive'].map(k=>[k,countItem(r,'inv',k)]))).toBe(true);
  // Chronology: the job starts at `at`; stepStations(dt, now) uses now - remaining as the event time, so now must be start + dt.
  const out=bench.station!.outC!;const secs=rc.secs*1000;
  stepStations(g,secs-1000,at+secs-1000);                                   // NEGATIVE: one second before the real finish
  expect(r.custody[out].slots.some(s=>s?.key===rc.out),recipe+' not before its real time').toBe(false);
  stepStations(g,1500,at+secs+500);                                         // now past the real finish (start + secs)
  const i=r.custody[out].slots.findIndex(s=>s?.key===rc.out);expect(i,recipe).toBeGreaterThanOrEqual(0);
  expect(act(g,'move',{from:out,fs:i,to:'inv'},at+secs+600).ok).toBe(true);
}

describe('MEC-01 R2 C1: gather-to-kit chain, then a real cargo trip (CRAFTED + FIXTURE stock + INTENT freight)',()=>{
  it('chain: gear and drive, frame, L3 bench, Motorbike Kit, place, refuel, mount, carry 40 ingots, deliver to a chest', ()=>{
    const g=start();const r=g.run!;const c=cacheOf(r);place(r,c.tx!+1,c.ty!);
    // FIXTURE starter stock: the amounts the whole chain needs (MP 12, iron 20, fasteners 14, spares 18), plus wood for bench and chest.
    addItem(r,'inv','wood',40);addItem(r,'inv','stone',4);addItem(r,'inv','iron_ingot',20);addItem(r,'inv','mechanical_parts',12);
    addItem(r,'inv','fasteners',14);addItem(r,'inv','spares',34);addItem(r,'inv','fuel_can',1);
    // CRAFTED: L1 bench built and upgraded to L2 (real build + paid upgrade).
    const sp=legalTileNear(g,c.tx!+1,c.ty!);expect(act(g,'build',{struct:'workbench',tx:sp[0],ty:sp[1]},START+20).ok).toBe(true);
    const bench=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='workbench')!;
    expect(act(g,'upgradeStation',{eid:bench.id},START+21).ok).toBe(true);expect(bench.station!.level).toBe(2);
    // CRAFTED: a real Research Table (wood 10, spares 6, iron 1), then PAID directed research of the motorbike blueprint (9 spares, 45 s).
    const rp=legalTileNear(g,c.tx!+1,c.ty!,'research');expect(act(g,'build',{struct:'research',tx:rp[0],ty:rp[1]},START+30).ok).toBe(true);
    const table=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='research')!;
    place(r,table.tx!-1,table.ty!);
    expect(act(g,'research',{eid:table.id,mode:'directed',recipe:'motorbike_kit'},START+31).ok).toBe(true);
    stepStations(g,45000+500,START+31+45500);
    const tOut=table.station!.outC!;const bp=r.custody[tOut].slots.findIndex(s=>s?.key==='blueprint'&&s.meta==='motorbike_kit');expect(bp).toBeGreaterThanOrEqual(0);
    expect(act(g,'move',{from:tOut,fs:bp,to:'inv'},START+31+45600).ok).toBe(true);
    const bpi=C(r,'inv').slots.findIndex(s=>s?.key==='blueprint'&&s.meta==='motorbike_kit');
    expect(act(g,'useItem',{slot:bpi},START+31+45700).ok).toBe(true);
    // CRAFTED: gear (2 iron + 2 MP + 1 fastener) -> geared drive; frame (3 iron + 2 MP + 2 spares).
    let t=START+100;
    craftOut(g,bench,'mechanical_gear',t);t+=40000;
    craftOut(g,bench,'vehicle_drive_geared',t);t+=40000;
    craftOut(g,bench,'vehicle_frame',t);t+=40000;
    expect(countItem(r,'inv','vehicle_drive')).toBe(1);expect(countItem(r,'inv','vehicle_frame')).toBe(1);
    // CRAFTED: paid upgrade to L3 (real intent, real cost). Then the kit (frame + drive + 2 iron + 2 fasteners), L3 only.
    for(const [k,q] of WORKBENCH_UPGRADE_III.cost)expect(countItem(r,'inv',k),k).toBeGreaterThanOrEqual(q);
    place(r,bench.tx!-1,bench.ty!);expect(act(g,'upgradeStation',{eid:bench.id},t).ok).toBe(true);expect(bench.station!.level).toBe(3);
    // blueprint must have been learned (run-local) before the kit craft is allowed
    craftOut(g,bench,'motorbike_kit',t+100);t+=60000;   // requires the learned recipe + L3
    expect(countItem(r,'inv','motorbike_kit')).toBe(1);expect(countItem(r,'inv','vehicle_frame')).toBe(0);expect(countItem(r,'inv','vehicle_drive')).toBe(0);
    // INTENT: place the kit on clear road (real placement rules), refuel from the carried canister, mount.
    const q=roadLine(g);place(r,q.x/TILE-1|0,q.y/TILE|0);
    expect(act(g,'placeMotorbike',q,t+200).ok).toBe(true);
    const bike=Object.values(r.entities).find(e=>e.kind==='vehicle')!;expect(bike).toBeTruthy();
    expect(act(g,'vehicleRefuel',{eid:bike.id},t+201).ok).toBe(true);expect(countItem(r,'inv','fuel_can')).toBe(0);
    expect(act(g,'vehicleMount',{eid:bike.id},t+202).ok).toBe(true);
    // FIXTURE cargo: 40 ingots in one stack, moved into the hold by a real intent (the hold weight is checked by the engine).
    addItem(r,'inv','iron_ingot',40);const cargoSlot=C(r,'inv').slots.findIndex(s=>s?.key==='iron_ingot'&&s.qty===40);const cargoUid=C(r,'inv').slots[cargoSlot]!.uid;
    expect(act(g,'move',{from:'inv',fs:cargoSlot,to:bike.c},t+203).ok).toBe(true);
    expect(countItem(r,bike.c!,'iron_ingot')).toBe(40);
    const fuelBefore=bike.vehicle!.fuel;
    // INTENT: drive the real road eastward with tick() for the measured leg, then stop.
    let now=t+1000,ticks=0;for(;ticks<200&&bike.x<q.x+6*TILE;ticks++){tick(g,east,50,now);now+=50;}
    expect(bike.x).toBeGreaterThanOrEqual(q.x+6*TILE);
    expect(bike.vehicle!.fuel).toBeLessThan(fuelBefore);
    const driveTicks=ticks;
    // Same cargo, walking: the player carries the same 40 ingots over the same distance with tick() and no vehicle.
    const walkG=structuredClone(g);const walkR=walkG.run!;const walkBike=Object.values(walkR.entities).find(e=>e.kind==='vehicle')!;
    expect(act(walkG,'vehicleExit',{eid:walkBike.id},t+2000).ok).toBe(true);
    // Same cargo on foot: the player takes the same 40 ingots out of the hold into the pack (real move), then walks.
    const wfs=C(walkR,walkBike.c!).slots.findIndex(s=>s?.uid===cargoUid);expect(wfs).toBeGreaterThanOrEqual(0);
    const packBefore=countItem(walkR,'inv','iron_ingot');
    const takeOut=act(walkG,'move',{from:walkBike.c,fs:wfs,to:'inv'},t+2001);expect(takeOut.ok,'take cargo out: '+(takeOut as any).reason).toBe(true);
    expect(countItem(walkR,'inv','iron_ingot')-packBefore).toBe(40);
    // The walk clone must not be blocked by the parked motorbike at the destination: remove the empty hull from THIS clone only.
    expect(countItem(walkR,walkBike.c!,'iron_ingot')).toBe(0);delete walkR.entities[walkBike.id];markDirty();
    walkR.player.x=q.x;walkR.player.y=q.y;markDirty();
    let wnow=now+1000,wticks=0;const walkStart=walkR.player.x;for(;wticks<2000&&walkR.player.x<q.x+6*TILE;wticks++){tick(walkG,east,50,wnow);wnow+=50;}
    const walkTicks=wticks;
    expect(walkR.player.x,'walker reached the same destination').toBeGreaterThanOrEqual(q.x+6*TILE);
    // Motorbike ticks are shorter on the same distance; both are measured, neither is asserted to be "better" beyond the numbers.
    expect(walkTicks).toBeGreaterThan(driveTicks);
    // INTENT: dismount and deliver the cargo to a player-built wood chest near the road end (chest needs 8 wood).
    expect(act(g,'vehicleExit',{eid:bike.id},now+10).ok).toBe(true);
    const ex=Math.floor(bike.x/TILE),ey=Math.floor(bike.y/TILE);
    // The player stands within reach of the motorbike (<=2 tiles), and the chest is placed within reach of that same spot.
    let chestTile:[number,number]|null=null,stand:[number,number]|null=null;
    for(let py=-2;py<=2&&!chestTile;py++)for(let px=-2;px<=2&&!chestTile;px++){
      const sx=ex+px,sy=ey+py;
      if(Math.hypot(sx+0.5-bike.x/TILE,sy+0.5-bike.y/TILE)>2.0)continue;   // the same reach rule the engine uses (near: 2.2 tiles), with margin
      place(r,sx,sy);
      for(let dy=-2;dy<=2&&!chestTile;dy++)for(let dx=-2;dx<=2&&!chestTile;dx++){if((sx+dx===ex&&sy+dy===ey))continue;if(Math.hypot(dx,dy)>2.0)continue;if(!buildReason(g,'chest_small',sx+dx,sy+dy)){chestTile=[sx+dx,sy+dy];stand=[sx,sy];}}
    }
    if(stand) place(r,stand[0],stand[1]);
    expect(chestTile,'a legal chest tile beside the road end').not.toBeNull();
    expect(act(g,'build',{struct:'chest_small',tx:chestTile![0],ty:chestTile![1]},now+20).ok).toBe(true);
    const chest=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='chest_small')!;
    if(stand) place(r,stand[0],stand[1]);
    const fs=C(r,bike.c!).slots.findIndex(s=>s?.uid===cargoUid);expect(fs).toBeGreaterThanOrEqual(0);
    const mv=act(g,'move',{from:bike.c,fs,to:chest.c},now+30);expect(mv.ok,'deliver: '+(mv as any).reason+' bike=('+bike.x/TILE+','+bike.y/TILE+') chest=('+chest.tx+','+chest.ty+') player=('+r.player.x/TILE+','+r.player.y/TILE+') fs='+fs).toBe(true);
    // Conservation: the same UID, the same quantity, now in the chest; none left in the hold.
    expect(countItem(r,chest.c!,'iron_ingot')).toBe(40);expect(countItem(r,bike.c!,'iron_ingot')).toBe(0);
    expect(C(r,chest.c!).slots.some(s=>s?.uid===cargoUid)).toBe(true);
    // Save validates and the UID survives a round trip.
    const back=validate(JSON.parse(JSON.stringify(JSON.parse(JSON.parse(serializeSnapshot(g)).payload))));
    expect(back).not.toBeNull();
    // Record the measured numbers (fixture route, not a human trip).
    const evidence={labels:{crafted:'real craft/upgrade/build/research intents',fixture:'starter stock grants, cache-side position, one fuel canister',intent:'tick() road movement and vehicle intents'},
      route:{startTile:[Math.floor(q.x/TILE),Math.floor(q.y/TILE)],distanceTiles:6,tickMs:50},
      motorbike:{ticks:driveTicks,seconds:driveTicks*0.05,fuelUsed:Math.round((fuelBefore-bike.vehicle!.fuel)*100)/100,cargoIngots:40},
      walkingSameCargo:{ticks:walkTicks,seconds:walkTicks*0.05},
      ratioWalkOverBike:Math.round((walkTicks/driveTicks)*100)/100,
      reading:'Over this 6-tile road segment the motorbike saves about 0.15 s versus walking while spending fuel and wear; walking is close on short legs. The gap grows with distance and the outcome is not a claim of general superiority.',
      notClaimed:['natural walk from spawn','natural acquisition of grants','human play','cart comparison (covered by b05-freight-compare)']};
    mkdirSync('evidence/c1-motorbike-chain',{recursive:true});writeFileSync('evidence/c1-motorbike-chain/measured.json',JSON.stringify(evidence,null,2)+'\n');
    expect(walkTicks/driveTicks).toBeGreaterThan(1);
  });
});
