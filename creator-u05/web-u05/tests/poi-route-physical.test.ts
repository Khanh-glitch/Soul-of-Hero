import {describe,it,expect} from 'vitest';
import {TILE,WW,type Entity} from '../src/game/core';
import {MAP_CONTENT_PACKS} from '../src/game/content';
import {getWorld,setActiveLayout} from '../src/game/world';
import {newGame,dispatch,blockGrid,C,countItem} from '../src/game/engine';
import {tick,type Input} from '../src/game/sim';
import {serializeSnapshot,validate} from '../src/game/persist';
const T=Date.UTC(2026,10,3), neutral:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};

describe('physical POI layering on the existing development layout',()=>{
 it('rejects vault transfers through a closed wall even when within interaction radius',()=>{
  setActiveLayout('dev_delta');try{const g=newGame();expect(dispatch(g,{id:'wall-start',type:'startRun',character:'female',region:3,seed:17},T).ok).toBe(true);const r=g.run!,q=MAP_CONTENT_PACKS.dev_delta.pois[0],vx=q.tx-(q.width>>1)+q.vaultCache.x,vy=q.ty-(q.height>>1)+q.vaultCache.y;const vault=Object.values(r.entities).find(e=>e.kind==='loot'&&e.tx===vx&&e.ty===vy)!;r.player.x=(vx-3)*TILE+14;r.player.y=vy*TILE+8;const slot=C(r,vault.c!).slots.findIndex(s=>s?.key==='iron_ingot');expect(Math.hypot(r.player.x-vault.x,r.player.y-vault.y)).toBeLessThan(2.8*TILE);expect(dispatch(g,{id:'through-wall',type:'move',from:vault.c,fs:slot,to:'inv'},T+1).ok).toBe(false);expect(C(r,vault.c!).slots[slot]?.qty).toBe(4);}finally{setActiveLayout('shipping');}
 });
 it('walks exterior to finite access items, keycard, powered door, vault and retreats',()=>{
  setActiveLayout('dev_delta');try{const g=newGame();let time=T,seq=0;const act=(type:string,fields:object={})=>dispatch(g,{id:`poi-route-${++seq}`,type,...fields},time);expect(act('startRun',{character:'female',region:3,seed:17}).ok).toBe(true);const r=g.run!;r.creatures=[]; // controlled AI fixture; not a human or full survival run
  const q=MAP_CONTENT_PACKS.dev_delta.pois[0],off=(p:{x:number,y:number})=>({x:q.tx-(q.width>>1)+p.x,y:q.ty-(q.height>>1)+p.y});
  const outer=r.entities[Object.keys(r.entities).find(id=>{const e=r.entities[id];const a=off(q.outerCache);return e.kind==='loot'&&e.tx===a.x&&e.ty===a.y;})!]!;
  const vault=Object.values(r.entities).find(e=>e.kind==='loot'&&e.tx===off(q.vaultCache).x&&e.ty===off(q.vaultCache).y)!;
  const gen=Object.values(r.entities).find(e=>e.kind==='gen'&&e.poi===q.id)!;expect(outer&&vault&&gen).toBeTruthy();
  function walkTo(x:number,y:number){const target=y*WW+x,grid=blockGrid(r),from=new Int32Array(grid.length).fill(-2),queue=new Int32Array(grid.length);let head=0,tail=0;const start=Math.floor(r.player.y/TILE)*WW+Math.floor(r.player.x/TILE);from[start]=-1;queue[tail++]=start;
   const doors=new Map<number,Entity>();for(const d of Object.values(r.entities))if(d.kind==='door'&&!d.open&&(!d.locked||(d.locked==='keycard'&&countItem(r,'inv','keycard')>0)))doors.set(d.ty!*WW+d.tx!,d);
   while(head<tail&&from[target]===-2){const i=queue[head++],x=i%WW,y=Math.floor(i/WW);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*WW+nx;if(nx<0||ny<0||nx>=WW||ny>=WW||from[j]!==-2||([1,2,3,5].includes(grid[j])&&!doors.has(j)))continue;from[j]=i;queue[tail++]=j;}}
   expect(from[target]).not.toBe(-2);const path:number[]=[];for(let i=target;i!==-1;i=from[i])path.push(i);path.reverse();for(const i of path.slice(1)){const door=doors.get(i);if(door&&!door.open)expect(act('door',{eid:door.id}).ok).toBe(true);const tx=(i%WW)*TILE+8,ty=Math.floor(i/WW)*TILE+8;let k=0;while(Math.hypot(r.player.x-tx,r.player.y-ty)>3.5&&k++<20){const dx=tx-r.player.x,dy=ty-r.player.y;time+=40;tick(g,{...neutral,left:dx< -2,right:dx>2,up:dy< -2,down:dy>2},40,time);}expect(Math.hypot(r.player.x-tx,r.player.y-ty)).toBeLessThanOrEqual(3.5);}}
  const o=off(q.outerCache);walkTo(o.x+1,o.y);for(const key of ['keycard','fuel_can']){const slot=C(r,outer.c!).slots.findIndex(s=>s?.key===key);expect(slot).toBeGreaterThanOrEqual(0);expect(act('move',{from:outer.c,fs:slot,to:'inv'}).ok).toBe(true);}expect(countItem(r,'inv','keycard')).toBe(1);
  const p=off(q.generator);walkTo(p.x+1,p.y);expect(countItem(r,'inv','keycard')).toBe(0);expect(act('generator',{eid:gen.id}).ok).toBe(true);expect(countItem(r,'inv','fuel_can')).toBe(0);
  const v=off(q.vaultCache);walkTo(v.x-1,v.y);const item=C(r,vault.c!).slots.findIndex(s=>s?.key==='iron_ingot');expect(item).toBeGreaterThanOrEqual(0);expect(act('move',{from:vault.c,fs:item,to:'inv'}).ok).toBe(true);expect(countItem(r,'inv','iron_ingot')).toBe(4);
  const entry=off(q.entry);walkTo(entry.x,entry.y+1);const snap=JSON.parse(JSON.parse(serializeSnapshot(g)).payload);expect(validate(snap)).toBeTruthy();expect(countItem(snap.run,'inv','iron_ingot')).toBe(4);expect(snap.run.entities[gen.id].power).toBe(1);
 }finally{setActiveLayout('shipping');}
 });
});
