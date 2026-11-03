import {describe,it,expect} from 'vitest';
import {HOUR,TILE,WW,type Entity} from '../src/game/core';
import {getWorld,setActiveLayout} from '../src/game/world';
import {newGame,dispatch,blockGrid,markDirty,addItem,C,countItem,buildReason} from '../src/game/engine';
import {tick,type Input} from '../src/game/sim';
import {serializeSnapshot,validate} from '../src/game/persist';
const T=Date.UTC(2026,10,3);
const neutral:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};

describe('short physical nonboss cash to escrow route',()=>{
 it('walks using collision-resolved ticks, opens any unlocked doors, purchases, builds and deposits',()=>{
  setActiveLayout('shipping');const g=newGame();let time=T,seq=0;const act=(type:string,fields:object={})=>dispatch(g,{id:`route-${++seq}`,type,...fields},time);
  expect(act('startRun',{character:'female',region:0,seed:1987}).ok).toBe(true);const r=g.run!;r.creatures=[];r.qaOffset=264*HOUR; // controlled phase, not a natural 11-day playthrough
  // Isolate logistics from gathering for this short test; the claim inputs are injected.
  addItem(r,'inv','wood',10);addItem(r,'inv','stone',5);
  const w=getWorld();const cash=Object.values(r.entities).find(e=>e.kind==='cash'&&e.poi==='tp')!,vendor=Object.values(r.entities).find(e=>e.kind==='vendor')!;
  function walkTo(e:Entity){
   const grid=blockGrid(r),from=new Int32Array(grid.length).fill(-2),queue=new Int32Array(grid.length);let head=0,tail=0,end=-1;const start=Math.floor(r.player.y/TILE)*WW+Math.floor(r.player.x/TILE);from[start]=-1;queue[tail++]=start;
   const doors=new Map<number,Entity>();for(const d of Object.values(r.entities))if(d.kind==='door'&&!d.locked&&!d.open)doors.set(d.ty!*WW+d.tx!,d);
   while(head<tail){const i=queue[head++],x=i%WW,y=Math.floor(i/WW);if(Math.hypot(x*TILE+8-e.x,y*TILE+8-e.y)<1.75*TILE){end=i;break;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*WW+nx;if(nx<0||ny<0||nx>=WW||ny>=WW||from[j]!==-2||([1,2,3,5].includes(grid[j])&&!doors.has(j)))continue;from[j]=i;queue[tail++]=j;}}
   expect(end).toBeGreaterThanOrEqual(0);const path:number[]=[];for(let i=end;i!==-1;i=from[i])path.push(i);path.reverse();
   for(const i of path.slice(1)){const door=doors.get(i);if(door&&!door.open){expect(act('door',{eid:door.id}).ok).toBe(true);markDirty();}const x=(i%WW)*TILE+8,y=Math.floor(i/WW)*TILE+8;let k=0;while(Math.hypot(r.player.x-x,r.player.y-y)>3.5&&k++<20){const dx=x-r.player.x,dy=y-r.player.y,inp={...neutral,left:dx< -2,right:dx>2,up:dy< -2,down:dy>2};time+=40;tick(g,inp,40,time);}expect(Math.hypot(r.player.x-x,r.player.y-y)).toBeLessThanOrEqual(3.5);}
  }
  walkTo(cash);expect(act('openCash',{eid:cash.id}).ok).toBe(true);const slot=C(r,cash.c!).slots.findIndex(s=>s?.key==='rcash');expect(slot).toBeGreaterThanOrEqual(0);expect(act('move',{from:cash.c,fs:slot,to:'inv'}).ok).toBe(true);expect(countItem(r,'inv','rcash')).toBe(36);
  walkTo(vendor);expect(act('buy',{eid:vendor.id,item:'escrow_chest'}).ok).toBe(true);expect(countItem(r,'inv','rcash')).toBe(6);
  const px=Math.floor(r.player.x/TILE),py=Math.floor(r.player.y/TILE);let claim: [number,number]|undefined;for(let y=py-4;y<=py+4&&!claim;y++)for(let x=px-4;x<=px+4&&!claim;x++)if(!buildReason(g,'claim',x,y))claim=[x,y];expect(claim).toBeDefined();expect(act('build',{struct:'claim',tx:claim![0],ty:claim![1]}).ok).toBe(true);
  let spot:[number,number]|undefined;for(let y=py-4;y<=py+4&&!spot;y++)for(let x=px-4;x<=px+4&&!spot;x++)if(!buildReason(g,'escrow',x,y))spot=[x,y];expect(spot).toBeDefined();expect(act('build',{struct:'escrow',tx:spot![0],ty:spot![1]}).ok).toBe(true);const escrow=Object.values(r.entities).find(e=>e.type==='escrow')!;if(Math.hypot(escrow.x-r.player.x,escrow.y-r.player.y)>2.6*TILE)walkTo(escrow);expect(act('deposit',{eid:escrow.id}).ok).toBe(true);expect(g.profile.securedCash).toBe(6);expect(countItem(r,'inv','rcash')).toBe(0);const snap=JSON.parse(JSON.parse(serializeSnapshot(g)).payload);expect(validate(snap)).toBeTruthy();expect(snap.profile.securedCash).toBe(6);snap.run.entities[cash.id].stock.cash=36;expect(validate(snap)).toBeNull();
 });
});
