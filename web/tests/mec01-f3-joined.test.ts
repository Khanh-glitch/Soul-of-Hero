// MEC-01 F3 joined boundary: REAL deposit (escrow-route-physical flow) -> lawful evacuation -> save/reload -> run 2.
// FIXTURE (labelled): qaOffset 264h phase control (not a natural 336h end), fixture wood/stone, fixture evacuation beacon.
// NOT injected: profile.securedCash. The 6 Ragnarok cash that reaches the profile is produced by the real deposit intent.
import {describe,it,expect} from 'vitest';
import {HOUR,TILE,WW,type Entity} from '../src/game/core';
import {getWorld,setActiveLayout} from '../src/game/world';
import {newGame,dispatch,blockGrid,markDirty,addItem,C,countItem,buildReason} from '../src/game/engine';
import {tick,type Input} from '../src/game/sim';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
const T=Date.UTC(2026,10,3);
const neutral:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};
describe('F3 joined: deposit -> evacuate -> save/reload -> run 2', () => {
 it('carries the real deposit receipt through evacuation and reload into run 2 with zero run-local cash', () => {
  setActiveLayout('shipping');const g=newGame();let time=T,seq=0;const act=(type:string,fields:object={})=>dispatch(g,{id:`joined-${++seq}`,type,...fields},time);
  expect(act('startRun',{character:'female',region:0,seed:1987}).ok).toBe(true);const r=g.run!;r.creatures=[];r.qaOffset=264*HOUR;
  addItem(r,'inv','wood',14);addItem(r,'inv','stone',5);
  const w=getWorld();const cash=Object.values(r.entities).find(e=>e.kind==='cash'&&e.poi==='tp')!,vendor=Object.values(r.entities).find(e=>e.kind==='vendor')!;
  function walkTo(e:Entity){
   const grid=blockGrid(r),from=new Int32Array(grid.length).fill(-2),queue=new Int32Array(grid.length);let head=0,tail=0,end=-1;const start=Math.floor(r.player.y/TILE)*WW+Math.floor(r.player.x/TILE);from[start]=-1;queue[tail++]=start;
   const doors=new Map<number,Entity>();for(const d of Object.values(r.entities))if(d.kind==='door'&&!d.locked&&!d.open)doors.set(d.ty!*WW+d.tx!,d);
   while(head<tail){const i=queue[head++],x=i%WW,y=Math.floor(i/WW);if(Math.hypot(x*TILE+8-e.x,y*TILE+8-e.y)<1.75*TILE){end=i;break;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*WW+nx;if(nx<0||ny<0||nx>=WW||ny>=WW||from[j]!==-2||([1,2,3,5].includes(grid[j])&&!doors.has(j)))continue;from[j]=i;queue[tail++]=j;}}
   expect(end).toBeGreaterThanOrEqual(0);const path:number[]=[];for(let i=end;i!==-1;i=from[i])path.push(i);path.reverse();
   for(const i of path.slice(1)){const door=doors.get(i);if(door&&!door.open){expect(act('door',{eid:door.id}).ok).toBe(true);markDirty();}const x=(i%WW)*TILE+8,y=Math.floor(i/WW)*TILE+8;let k=0;while(Math.hypot(r.player.x-x,r.player.y-y)>3.5&&k++<20){const dx=x-r.player.x,dy=y-r.player.y,inp={...neutral,left:dx< -2,right:dx>2,up:dy< -2,down:dy>2};time+=40;tick(g,inp,40,time);}expect(Math.hypot(r.player.x-x,r.player.y-y)).toBeLessThanOrEqual(3.5);}
  }
  walkTo(cash);expect(act('openCash',{eid:cash.id}).ok).toBe(true);const slot=C(r,cash.c!).slots.findIndex(s=>s?.key==='rcash');expect(act('move',{from:cash.c,fs:slot,to:'inv'}).ok).toBe(true);expect(countItem(r,'inv','rcash')).toBe(36);
  walkTo(vendor);expect(act('buy',{eid:vendor.id,item:'escrow_chest'}).ok).toBe(true);expect(countItem(r,'inv','rcash')).toBe(6);
  const post=w.buildings.find(b=>b.id==='b_tp')!;walkTo({x:(post.x+5)*TILE+8,y:(post.y+post.h+4)*TILE+8} as Entity);const px=Math.floor(r.player.x/TILE),py=Math.floor(r.player.y/TILE);let claim:[number,number]|undefined;for(let y=py-4;y<=py+4&&!claim;y++)for(let x=px-4;x<=px+4&&!claim;x++)if(!buildReason(g,'floor_wood',x,y))claim=[x,y];expect(claim).toBeDefined();expect(act('build',{struct:'floor_wood',tx:claim![0],ty:claim![1]}).ok).toBe(true);expect(act('build',{struct:'claim',tx:claim![0],ty:claim![1]}).ok).toBe(true);
  let spot:[number,number]|undefined;for(let y=py-4;y<=py+4&&!spot;y++)for(let x=px-4;x<=px+4&&!spot;x++)if(!buildReason(g,'escrow',x,y))spot=[x,y];expect(spot).toBeDefined();expect(act('build',{struct:'escrow',tx:spot![0],ty:spot![1]}).ok).toBe(true);
  const escrow=Object.values(r.entities).find(e=>e.type==='escrow')!;if(Math.hypot(escrow.x-r.player.x,escrow.y-r.player.y)>2.6*TILE)walkTo(escrow);
  expect(act('deposit',{eid:escrow.id}).ok).toBe(true);expect(g.profile.securedCash).toBe(6);expect(countItem(r,'inv','rcash')).toBe(0);
  // Negative: a second deposit with no physical cash must not credit the profile again.
  expect(act('deposit',{eid:escrow.id}).ok).toBe(false);expect(g.profile.securedCash).toBe(6);
  // Run-1 learned-recipe sentinel: a recipe the run learned (not in the base list) must not survive into run 2.
  r.knowledge.recipes.push('motorbike_kit');expect(r.knowledge.recipes.includes('motorbike_kit')).toBe(true);
  // Lawful evacuation: a beacon the player stands on (fixture entity), not a remote evacuation.
  const beacon={id:'fx-evac',kind:'evac',x:r.player.x,y:r.player.y,label:'Fixture evacuation beacon'} as any;r.entities[beacon.id]=beacon;markDirty();
  expect(act('evacuate',{eid:beacon.id}).ok).toBe(true);expect(g.run).toBeNull();expect(g.profile.securedCash).toBe(6);
  // Save / reload through the real snapshot path, then start run 2 on the reloaded state.
  const reloaded=selectSnapshots([serializeSnapshot(g),null]).gs!;
  expect(reloaded.profile.securedCash).toBe(6);expect(reloaded.profile.history.length).toBe(1);
  const g2=reloaded as any;const s2=dispatch(g2,{id:'joined-run2',type:'startRun',character:'female',seed:1988} as any,time+HOUR);
  expect(s2.ok).toBe(true);expect(g2.profile.securedCash).toBe(6);
  expect(countItem(g2.run,'inv','rcash')).toBe(0);expect(countItem(g2.run,'inv','escrow_chest')).toBe(0);
  expect(g2.run.knowledge.recipes.includes('motorbike_kit')).toBe(false);   // run-1 learned sentinel wiped
  expect(g2.run.id).not.toBe(r.id);
 });
});
