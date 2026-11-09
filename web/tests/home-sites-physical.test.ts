import {describe,it,expect} from 'vitest';
import {TILE,WW} from '../src/game/core';
import {getWorld,setActiveLayout} from '../src/game/world';
import {newGame,dispatch,blockGrid,addItem,buildReason} from '../src/game/engine';
import {tick,type Input} from '../src/game/sim';
const T=Date.UTC(2026,10,3), neutral:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};

describe('physical owned home choices',()=>{
 it('reaches and claims three distinct clear sites, then places owned storage',()=>{
  setActiveLayout('shipping');const chosen:number[]=[];
  for(const region of [0,1,2]){const g=newGame();let time=T,seq=region*1000;const act=(type:string,fields:object={})=>dispatch(g,{id:`home-${++seq}`,type,...fields},time);expect(act('startRun',{character:'female',region,seed:200+region}).ok).toBe(true);const r=g.run!,w=getWorld();r.creatures=[];addItem(r,'inv','wood',22);addItem(r,'inv','stone',5); // construction-material fixture
   const grid=blockGrid(r),parent=new Int32Array(grid.length).fill(-2),distance=new Int32Array(grid.length),queue=new Int32Array(grid.length);let head=0,tail=0,stand=-1,site=-1;const start=Math.floor(r.player.y/TILE)*WW+Math.floor(r.player.x/TILE);parent[start]=-1;queue[tail++]=start;
   while(head<tail&&site<0){const i=queue[head++],x=i%WW,y=Math.floor(i/WW);if(distance[i]>=12)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const j=(y+dy)*WW+x+dx;if(j>=0&&j<grid.length&&grid[j]===0&&w.economyMap.buildable[j]&&!w.economyMap.protected[j]&&!w.accessCorridors?.mask[j]&&!w.sourceV3[j]){stand=i;site=j;break;}}if(distance[i]>=30)continue;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*WW+nx;if(nx<1||ny<1||nx>=WW-1||ny>=WW-1||parent[j]!==-2||[1,2,3,5].includes(grid[j]))continue;parent[j]=i;distance[j]=distance[i]+1;queue[tail++]=j;}}
   expect(site).toBeGreaterThan(0);const path:number[]=[];for(let i=stand;i!==-1;i=parent[i])path.push(i);path.reverse();for(const i of path.slice(1)){const tx=(i%WW)*TILE+8,ty=Math.floor(i/WW)*TILE+8;let k=0;while(Math.hypot(r.player.x-tx,r.player.y-ty)>3.5&&k++<20){const dx=tx-r.player.x,dy=ty-r.player.y;time+=40;tick(g,{...neutral,left:dx< -2,right:dx>2,up:dy< -2,down:dy>2},40,time);}expect(Math.hypot(r.player.x-tx,r.player.y-ty)).toBeLessThanOrEqual(3.5);}
   expect(act('build',{struct:'floor_wood',tx:site%WW,ty:Math.floor(site/WW)}).ok).toBe(true);expect(act('build',{struct:'claim',tx:site%WW,ty:Math.floor(site/WW)}).ok).toBe(true);const px=Math.floor(r.player.x/TILE),py=Math.floor(r.player.y/TILE);let storage:[number,number]|undefined;for(let y=py-4;y<=py+4&&!storage;y++)for(let x=px-4;x<=px+4&&!storage;x++)if(!buildReason(g,'chest_small',x,y))storage=[x,y];expect(storage).toBeDefined();expect(act('build',{struct:'chest_small',tx:storage![0],ty:storage![1]}).ok).toBe(true);expect(Object.values(r.entities).some(e=>e.type==='claim')).toBe(true);chosen.push(site);
  }
  expect(new Set(chosen).size).toBe(3);
 });
});
