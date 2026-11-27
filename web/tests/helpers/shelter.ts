// A real straw-bed shelter for tests: floor, roof, walls, bed and chest are all placed by the game's own build
// command, on a site the game's own climate rules call temperate. Taken from tests/rest-supply.test.ts, which keeps
// its own copy; the two must stay the same.
import {expect} from 'vitest';
import {dispatchCarryingPack} from './build-kit';
import {HOUR,TILE,WW,T as TILE_T,type GameState,type RunState} from '../../src/game/core';
import {getWorld} from '../../src/game/world';
import {newGame,addItem,C,blockGrid,weatherAt,isWet,darkness} from '../../src/game/engine';
import {thermalEnv,thermalEvaluate} from '../../src/game/thermal';

export const SHELTER_T=Date.UTC(2026,0,1);const T=SHELTER_T;let seq=0;
export const shelterAct=(g:GameState,type:string,data:object={},now=T)=>dispatchCarryingPack(g,{id:`resttest-${++seq}`,type,...data},now);

// Real world conditions only (no heat grant): a candidate tile is a TEMPERATE rest site when the game's own shared thermal
// authority, with NO heat source and NO insulation, keeps a sheltered sleeper's target >= 50 at every 30-minute sample of the 12 h
// window (zone, weather slots and night are all the real ones). The frigid negative case uses the same authority, not a special rule.
const TEMPERATE_MIN_TARGET=50;
const HALF_HOUR=30*60000;
const climateTargets=(r:RunState,xx:number,yy:number,hours:number)=>{const zone=getWorld().zone[yy*WW+xx];const out:number[]=[];for(let t=T;t<=T+hours*HOUR;t+=HALF_HOUR)out.push(thermalEvaluate(r,thermalEnv(r,{x:xx*TILE+8,y:yy*TILE+8,zone,tileType:TILE_T.FLOOR,wet:isWet(weatherAt(r,t)),dark:darkness(r,t)>0.45,sheltered:true})).target);return out;};
const isTemperate=(r:RunState,xx:number,yy:number)=>Math.min(...climateTargets(r,xx,yy,12))>=TEMPERATE_MIN_TARGET;
function site(g:GameState,pred:(r:RunState,x:number,y:number)=>boolean=isTemperate){
  const r=g.run!,w=getWorld(),grid=blockGrid(r);
  for(let yy=20;yy<180;yy++)for(let xx=20;xx<180;xx++){
    const cells=[];for(let dy=-1;dy<=2;dy++)for(let dx=-1;dx<=2;dx++)cells.push([dx,dy]);
    if(cells.every(([dx,dy])=>{const i=(yy+dy)*WW+xx+dx;return grid[i]===0&&!w.sourceV3[i]&&w.economyMap.buildable[i]&&!w.economyMap.protected[i]&&!w.accessCorridors?.mask[i];}) && pred(r,xx,yy))return {x:xx,y:yy};
  }
  throw new Error('no open site');
}
// Builds a real 2x2 wooden shelter (floor, roof, walls) with a Cabinet-free bed and chest inside.
export function shelter(seed:number,pred?:(r:RunState,x:number,y:number)=>boolean){
  const g=newGame();expect(shelterAct(g,'startRun',{character:'female',region:0,seed}).ok).toBe(true);
  const r=g.run!;r.creatures=[];
  const {x,y}=site(g,pred);
  r.player.x=x*TILE+8;r.player.y=(y+1)*TILE+8;
  addItem(r,'inv','wood',400);addItem(r,'inv','fiber',200);addItem(r,'inv','stone',60);
  const build=(struct:string,tx:number,ty:number)=>{const res=shelterAct(g,"build",{struct,tx,ty});expect({s:struct,tx,ty,why:res.ok?"":(res as any).reason}).toEqual({s:struct,tx,ty,why:""});};
  for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)build('floor_wood',x+dx,y+dy);
  for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)build('roof_thatch',x+dx,y+dy);
  // Walls are placed from just outside each ring tile (line of sight from inside would cross the ring).
  for(let dx=-1;dx<=2;dx++)for(let dy=-1;dy<=2;dy++){
    if(dx>=0&&dx<=1&&dy>=0&&dy<=1)continue;
    const ox=dx<0?-1:dx>1?1:0, oy=dy<0?-1:dy>1?1:0;
    r.player.x=(x+dx+ox)*TILE+8;r.player.y=(y+dy+oy)*TILE+8;
    build('wall_wood',x+dx,y+dy);
  }
  r.player.x=x*TILE+8;r.player.y=(y+1)*TILE+8;
  build('bed_straw',x,y);build('chest_small',x+1,y+1);
  const bed=Object.values(r.entities).find(e=>e.type==='bed_straw')!;
  const chest=Object.values(r.entities).find(e=>e.type==='chest_small')!;
  r.player.x=x*TILE+8;r.player.y=(y+1)*TILE+8;
  // Provisions: real safe food, real charged flask, and a raw meat that must be refused.
  addItem(r,chest.c!,'cooked_meat',3);addItem(r,chest.c!,'meat',1);addItem(r,chest.c!,'water_flask',1);
  const flask=C(r,chest.c!).slots.find(s=>s?.key==='water_flask')!;flask.charge=4;
  return {g,r,bed,chest,flask};
}

