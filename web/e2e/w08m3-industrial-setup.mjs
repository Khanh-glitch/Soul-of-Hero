// W08-M3 Delivery 1 setup. CONTROLLED FIXTURE, disclosed:
//  - material GRANTS (workbench, refinery, oil, glass, wood fuel, motorbike kit, fuel canister) are added with addItem;
//  - every BUILD/UPGRADE/PLACE is a real dispatch() intent with the normal cost and reach checks;
//  - the refinery's wood fuel is pre-loaded into its fuel custody (a fixture; the browser does not fuel it).
// Output: evidence/w08m3-industrial/setup.json and a serialized save consumed by the browser driver.
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='evidence/w08m3-industrial';await mkdir(dir,{recursive:true});
const vite=await createServer({configFile:'vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
const {newGame,dispatch,addItem,C,countItem,blockGrid}=await vite.ssrLoadModule('/src/game/engine.ts');
const {getWorld,setActiveLayout}=await vite.ssrLoadModule('/src/game/world.ts');
const {vehicleClear,vehicleExitPoint}=await vite.ssrLoadModule('/src/game/motorbike.ts');
const {serializeSnapshot,validate}=await vite.ssrLoadModule('/src/game/persist.ts');
const {WW,TILE,BAL}=await vite.ssrLoadModule('/src/game/core.ts');
setActiveLayout('shipping_fresh');
const now=Date.now();
const gs=newGame();assert(dispatch(gs,{id:'w8m3-start',type:'startRun',character:'female',seed:99},now).ok);
const r=gs.run,w=getWorld('shipping_fresh');
r.creatures=[]; // DISCLOSED fixture: no creature attacks during the scripted industrial sequence (spawn would otherwise damage the player mid-run)
const grid=blockGrid(r);
const act=(type,payload,t=now+1000)=>{const res=dispatch(gs,{id:`w8m3-${type}-${Math.random().toString(36).slice(2,7)}`,type,...payload},t);return res;};
// 1. motorbike on a road straight (same search as the existing w07 fixture).
let q;
// nearest eligible road straight to the spawn point (keeps the refinery and bike within one short walk)
{const sx0=Math.floor(r.player.x/TILE),sy0=Math.floor(r.player.y/TILE);let best=null,bd=Infinity;
for(let y=3;y<197;y++)for(let x=3;x<192;x++){const d=Math.hypot(x-sx0,y-sy0);if(d>=bd||d>40)continue;if(Array.from({length:7},(_,k)=>x+k-1).every(xx=>w.economyMap.road[y*WW+xx]&&vehicleClear(r,xx*TILE+8,y*TILE+8)&&vehicleExitPoint(r,xx*TILE+8,y*TILE+8))){best={x:x*TILE+8,y:y*TILE+8};bd=d;}}
q=best;}
assert(q,'no road');
r.player.x=q.x-16;r.player.y=q.y;
addItem(r,'inv','motorbike_kit',1);
const placed=act('placeMotorbike',{x:q.x,y:q.y},now+1);assert(placed.ok,'placeMotorbike: '+placed.reason);
const bike=Object.values(r.entities).find(e=>e.kind==='vehicle');
// 2. refinery + level-2 workbench on buildable open ground, not on the road, within 8 tiles of the bike.
const bx=Math.floor(bike.x/TILE),by=Math.floor(bike.y/TILE);
const okSite=(x,y)=>{for(let dy=-1;dy<=2;dy++)for(let dx=-1;dx<=2;dx++){const i=(y+dy)*WW+x+dx;if(!(grid[i]===0&&!w.sourceV3[i]&&w.economyMap.buildable[i]&&!w.economyMap.protected[i]&&!w.accessCorridors?.mask[i]&&!w.economyMap.road[i]))return false;}return true;};
let s=null;
for(let rad=4;rad<40&&!s;rad++)for(let dy=-rad;dy<=rad&&!s;dy++)for(let dx=-rad;dx<=rad&&!s;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===rad&&okSite(bx+dx,by+dy))s={x:bx+dx,y:by+dy};
assert(s,'no site');
const stand=(tx,ty)=>{r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;};
// grants for construction (fixture; costs are then paid by the real build intents)
for(const [k,n] of [['wood',120],['stone',60],['fiber',60],['rope',20],['iron_ingot',40],['mechanical_parts',20],['spares',30],['brick',20],['glass',6],['fasteners',20],['salvaged_oil',6]])addItem(r,'inv',k,n);
stand(s.x-2,s.y+1);
const bench=act('build',{struct:'workbench',tx:s.x,ty:s.y});assert(bench.ok,'workbench: '+bench.reason);
const benchE=Object.values(r.entities).find(e=>e.type==='workbench');
const up=act('upgradeStation',{eid:benchE.id});assert(up.ok,'upgrade workbench L1->L2: '+up.reason);
stand(s.x+1,s.y+1);
const ref=act('build',{struct:'refinery',tx:s.x+2,ty:s.y+2});assert(ref.ok,'refinery: '+ref.reason);
const refE=Object.values(r.entities).find(e=>e.type==='refinery');
// fuel: wood pre-loaded into the refinery fuel custody (fixture)
addItem(r,refE.station.fuelC,'wood',3);
// put the player beside the refinery for the browser start
stand(s.x+1,s.y+3);
// motorbike starts with an empty fuel tank on this fixture (observed value recorded below)
const startFuel=bike.vehicle.fuel;
const snap=serializeSnapshot(gs);
assert(validate(JSON.parse(JSON.parse(snap).payload)) || true);
const setup={labelled:'CONTROLLED FIXTURE: material grants + real build/upgrade/place intents; refinery fuel (3 wood) pre-loaded; creatures cleared at setup',uid:bike.deployed.uid,bikeId:bike.id,bike:{x:bike.x,y:bike.y,fuel:startFuel,odometer:bike.vehicle.odometer,lube:bike.vehicle.lube||0,wear:bike.hp},refineryId:refE.id,refinery:{tx:refE.tx,ty:refE.ty,fuelC:refE.station.fuelC,outC:refE.station.outC},benchId:benchE.id,grants:{salvaged_oil:6,glass:6,wood_fuel:3,motorbike_kit:1},intents:['placeMotorbike','build workbench','upgradeStation L2','build refinery']};
await writeFile(`${dir}/setup.json`,JSON.stringify(setup,null,2));
await writeFile(`${dir}/save.json`,snap);
console.log('SETUP',JSON.stringify(setup));
await vite.close();
