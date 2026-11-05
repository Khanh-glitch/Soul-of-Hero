import {describe,it,expect} from 'vitest';
import {RECIPES,ITEMS,CORE_STUDY,CREATURES,permitsDirectedResearch,requiredStationLevel} from '../src/game/catalog';

describe('knowledge complexity is not station capability',()=>{
 it('keeps all five tier-three recipes on level-one workbenches without granting knowledge or ingredients',()=>{
  const names=['chitin_armor','core_fire','core_earth','core_storm','core_frost'];expect(Object.keys(RECIPES).filter(k=>RECIPES[k].tier===3)).toEqual(expect.arrayContaining(names));expect(RECIPES.core_dragon.tier).toBe(3);expect(requiredStationLevel(RECIPES.core_dragon)).toBe(3);
  for(const name of names){const r=RECIPES[name];expect(r.station).toBe('workbench');expect(requiredStationLevel(r)).toBe(1);expect(permitsDirectedResearch(r)).toBe(false);expect(r.base).not.toBe(true);expect(r.ins.length).toBeGreaterThan(0);expect(ITEMS[r.out]).toBeDefined();}
  for(const name of names.filter(k=>k.startsWith('core_')))expect(CORE_STUDY[name]).toBe(name);
  expect(ITEMS.beetle_horn.specimen).toBe('chitin_armor');expect(CREATURES.beetle.drops.some(([k])=>k==='beetle_horn')).toBe(true);
  expect(RECIPES.industrial_pick.tier).toBe(2);expect(requiredStationLevel(RECIPES.industrial_pick)).toBe(2);expect(permitsDirectedResearch(RECIPES.industrial_pick)).toBe(true);
 });
});
