import {afterAll,describe,expect,it} from 'vitest';
import {T,TILE,WW} from '../src/game/core';
import {dispatch,newGame,respawn,killPlayer,sourceAt} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {globalFromTile,tileFromGlobal} from '../src/game/veyra/projection';
import {serializeSnapshot,validate} from '../src/game/persist';
import rawEligibility from '../geography/veyra-lr02/spawn_eligibility.v1.json?raw';
import {eligibleRegions,validateEligibility,ELIGIBILITY_BODY_SHA} from '../src/game/veyra/eligibility';
const t=1800000000000;afterAll(()=>setActiveLayout('shipping'));
describe('bounded real Veyra diagnostic runtime',()=>{
 for(const layout of ['veyra-greywater-lr02-u16','veyra-greywater-lr02-u20'])it(`${layout}: source projection, diverse deterministic seeded spawns and save identity`,()=>{
  setActiveLayout(layout);const w=getWorld(),seen=new Set<string>();expect(w.veyra?.originAu).toEqual([640,440]);expect(w.starts).toEqual([]);expect(w.buildings).toEqual([]);expect(w.statics).toEqual([]);expect(w.sourceV3.filter(Boolean).length).toBeGreaterThan(1000);expect((w.economyMap.buildable as any as number[]).reduce((a:number,b:number)=>a+b,0)).toBeGreaterThan(100);
  for(const seed of [1,2,3,4,5,55,71,190,214,999]){const g=newGame();expect(dispatch(g,{id:'start',type:'startRun',character:'female',seed},t).ok).toBe(true);const r=g.run!,spawn=r.spawnChoice!;seen.add(`${spawn.x},${spawn.y}`);expect(w.tiles[spawn.y*WW+spawn.x]).not.toBe(T.SHALLOW);expect(sourceAt(r,spawn.x,spawn.y)?.def.block??false).toBe(false);expect(r.creatures.every(m=>Math.hypot(m.x-r.player.x,m.y-r.player.y)>15*TILE)).toBe(true);const [ax,ay]=globalFromTile(w.veyra!,spawn.x,spawn.y);expect(tileFromGlobal(w.veyra!,ax,ay)).toEqual([spawn.x,spawn.y]);const snap=serializeSnapshot(g),saved=JSON.parse(JSON.parse(snap).payload);expect(validate(saved)).not.toBeNull();const bad=structuredClone(saved);bad.run.sourceMap.veyra.originAu[0]++;expect(validate(bad)).toBeNull();const again=newGame();expect(dispatch(again,{id:'start',type:'startRun',character:'female',seed},t).ok).toBe(true);expect(again.run!.spawnChoice).toEqual(spawn);
  }expect(seen.size).toBeGreaterThanOrEqual(8);
 });
 it('default respawn chooses a legal runtime location, not a Map provenance point',()=>{setActiveLayout('veyra-greywater-lr02-u16');const g=newGame();expect(dispatch(g,{id:'start',type:'startRun',character:'female',seed:55},t).ok).toBe(true);const r=g.run!;killPlayer(g,t,'test');expect(respawn(g,t+1).ok).toBe(true);expect(r.player.dead).toBe(false);expect(getWorld().starts).toEqual([]);expect(r.player.x).toBeGreaterThan(0);});
});
describe('separate Veyra Oasis window (not streaming)',()=>{
 it('retains its own pinned origin, biome diversity and save identity',()=>{
  setActiveLayout('veyra-oasis-lr02-u20');const w=getWorld();expect(w.veyra?.originAu).toEqual([400,840]);expect(w.veyra?.unitsPerTile).toBe(2);expect(w.economyMap.biome.filter(b=>b==='sand').length).toBeGreaterThan(1000);expect(w.economyMap.biome.filter(b=>b==='meadow').length).toBeGreaterThan(1000);const seen=new Set<string>();
  const allowed=new Set(eligibleRegions.candidateRegions.flatMap(r=>r.geometry.cellIndices));expect(w.veyra?.patchDigest).toBe(ELIGIBILITY_BODY_SHA);expect(w.spawnEligible?.reduce((a:number,b:number)=>a+b,0)).toBeGreaterThan(100);expect(()=>validateEligibility(rawEligibility.replace('se.1.000','se.1.999'))).toThrow();for(let seed=1;seed<=10;seed++){const g=newGame();expect(dispatch(g,{id:'start',type:'startRun',character:'female',seed},t).ok).toBe(true);const r=g.run!,s=r.spawnChoice!;seen.add(`${s.x},${s.y}`);const [gx,gy]=globalFromTile(w.veyra!,s.x,s.y);expect(allowed.has(Math.floor(gy/8)*250+Math.floor(gx/8))).toBe(true);expect(tileFromGlobal(w.veyra!,...globalFromTile(w.veyra!,s.x,s.y))).toEqual([s.x,s.y]);const saved=JSON.parse(JSON.parse(serializeSnapshot(g)).payload);expect(validate(saved)).toBeTruthy();saved.run.sourceMap.veyra.originAu[1]--;expect(validate(saved)).toBeNull();}expect(seen.size).toBeGreaterThanOrEqual(8);
 });
});
