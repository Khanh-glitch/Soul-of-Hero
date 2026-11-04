import {afterAll,describe,expect,it} from 'vitest';
import {T,TILE,WW} from '../src/game/core';
import {dispatch,newGame,respawn,killPlayer,sourceAt} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {globalFromTile,tileFromGlobal} from '../src/game/veyra/projection';
import {serializeSnapshot,validate} from '../src/game/persist';
const t=1800000000000;afterAll(()=>setActiveLayout('shipping'));
describe('bounded real Veyra diagnostic runtime',()=>{
 for(const layout of ['veyra-greywater-u16','veyra-greywater-u20'])it(`${layout}: source projection, diverse deterministic seeded spawns and save identity`,()=>{
  setActiveLayout(layout);const w=getWorld(),seen=new Set<string>();expect(w.veyra?.originAu).toEqual([640,440]);expect(w.starts).toEqual([]);expect(w.buildings).toEqual([]);expect(w.statics).toEqual([]);expect(w.sourceV3.filter(Boolean).length).toBeGreaterThan(1000);expect(w.economyMap.buildable.reduce((a,b)=>a+b,0)).toBeGreaterThan(100);
  for(const seed of [1,2,3,4,5,55,71,190,214,999]){const g=newGame();expect(dispatch(g,{id:'start',type:'startRun',character:'female',seed},t).ok).toBe(true);const r=g.run!,spawn=r.spawnChoice!;seen.add(`${spawn.x},${spawn.y}`);expect(w.tiles[spawn.y*WW+spawn.x]).not.toBe(T.SHALLOW);expect(sourceAt(r,spawn.x,spawn.y)?.def.block??false).toBe(false);expect(r.creatures.every(m=>Math.hypot(m.x-r.player.x,m.y-r.player.y)>15*TILE)).toBe(true);const [ax,ay]=globalFromTile(w.veyra!,spawn.x,spawn.y);expect(tileFromGlobal(w.veyra!,ax,ay)).toEqual([spawn.x,spawn.y]);const snap=serializeSnapshot(g),saved=JSON.parse(JSON.parse(snap).payload);expect(validate(saved)).not.toBeNull();const bad=structuredClone(saved);bad.run.sourceMap.veyra.originAu[0]++;expect(validate(bad)).toBeNull();const again=newGame();expect(dispatch(again,{id:'start',type:'startRun',character:'female',seed},t).ok).toBe(true);expect(again.run!.spawnChoice).toEqual(spawn);
  }expect(seen.size).toBeGreaterThanOrEqual(8);
 });
 it('default respawn chooses a legal runtime location, not a Map provenance point',()=>{setActiveLayout('veyra-greywater-u16');const g=newGame();expect(dispatch(g,{id:'start',type:'startRun',character:'female',seed:55},t).ok).toBe(true);const r=g.run!;killPlayer(g,'test',t);expect(respawn(g,t+1).ok).toBe(true);expect(r.player.dead).toBe(false);expect(getWorld().starts).toEqual([]);expect(r.player.x).toBeGreaterThan(0);});
});
