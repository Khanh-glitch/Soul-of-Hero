import {it,expect} from 'vitest';
import {buildWindowWorld as original} from './fixtures/veyra-window-751f80a';
import {buildWindowWorld,globalBaseGeometry} from '../src/veyra05/window';
import {measureWorldWork} from '../src/game/world-work';
import {WW} from '../src/game/core';
it('query regions preserve751f80a masks, all floors, source eligibility and authored statics without render materialization',()=>{
 for(const id of ['veyra05-greywater','veyra05-slag','veyra05-argus','veyra05-westmouth','veyra05-greyback'])for(const rules of [3,4] as const){
  const old=original(id,rules),render=buildWindowWorld(id,rules);
  expect(render.world.sourceV3).toEqual(old.world.sourceV3);
  const measured=measureWorldWork(()=>{
   for(const [floor,layer]of old.floors.layers){
    const actual=render.floors.layers.get(floor)!;
    for(const field of ['tiles','walkable','solidProps','sources'] as const)expect(actual[field]).toEqual(layer[field]);
    expect(actual.stairs).toEqual(layer.stairs);expect(actual.statics).toEqual(layer.statics);
    for(let i=0;i<40000;i+=37){const cell=globalBaseGeometry(old.win.originTx+i%WW,old.win.originTy+Math.floor(i/WW),floor,rules,id)!;
     expect([cell.biome,cell.temperature,cell.moisture,cell.slope]).toEqual([old.world.economyMap.biome[i],old.world.economyMap.temperature[i],old.world.economyMap.moisture[i],old.world.economyMap.slope[i]]);
     expect([cell.tile,cell.walkable,cell.solidProp,cell.source]).toEqual([layer.tiles[i],!!layer.walkable[i],!!layer.solidProps[i],layer.sources[i]]);
    }
   }
  });expect(measured.counts.renderCompilations).toBe(0);
 }
},90000);
