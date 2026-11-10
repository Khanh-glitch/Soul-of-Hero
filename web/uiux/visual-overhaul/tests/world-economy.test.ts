import { describe,it,expect } from 'vitest';
import { compileEconomy, validateEconomyMap, diagnoseStarts, type Biome } from '../src/game/world-economy';
import { fixture } from './fixtures/isthmus';
describe('map-independent source rules v3',()=>{
 it('is deterministic and obeys bounds, road, protected, water and authored industrial semantics',()=>{const m=fixture(),a=compileEconomy(m),b=compileEconomy(m);expect(a.errors).toEqual([]);expect(a.sources).toEqual(b.sources);expect(a.sources.filter(Boolean).length).toBeGreaterThan(20);for(let i=0;i<a.sources.length;i++)if(a.sources[i]){expect(m.walkable[i]).toBeTruthy();expect(m.road[i]).toBeFalsy();expect(m.protected[i]).toBeFalsy();expect(m.biome[i]).not.toBe('water');}expect(a.sources).not.toContain('iron');expect(a.sources).not.toContain('coalv');expect(a.sources).not.toContain('sulfur');});
 it('reports missing water and never invents industrial rewards on a map with no industry',()=>{const m=fixture();(m.industrial as Uint8Array).fill(0);const placed=compileEconomy(m);expect(diagnoseStarts(m,placed.sources).some(e=>e.includes('fresh water'))).toBe(true);expect(placed.sources.filter(Boolean).every(k=>!['mechanical_parts','rcash','core_fire'].includes(k!))).toBe(true);});
 it('rejects incomplete map data rather than inventing missing semantics',()=>{const m=fixture();(m as any).road=undefined;expect(validateEconomyMap(m)).toContain('road must have 3456 cells');expect(compileEconomy(m).sources).toEqual([]);});
});

describe('future playable map contract',()=>{
 it('explicitly rejects a raster-only handoff instead of inventing POIs, roads or endgame sites',async()=>{
  const {validateGeographicHandoff}=await import('../src/game/geography-contract');const errors=validateGeographicHandoff({economy:fixture()});
  expect(errors).toContain('authored road geometry, width and cargo access required');expect(errors).toContain('authored POI footprints, access, rooms, hazards and loot sites required');expect(errors).toContain('nonbossCashSites geometry required');expect(errors).toContain('vendorSites geometry required');
 });
});

describe('distinct topology: authored contract fixture',()=>{
 it('runs the same rules on a complete, materially different descriptor without coordinate patches',async()=>{
  const {validateGeographicHandoff}=await import('../src/game/geography-contract');const m=fixture(),n=m.width;
  // Separate freshwater pools, one each side of the bridge, plus authored POI masks.
  for(const [x,y] of [[12,23],[62,23]]){const i=y*n+x;(m.freshwater as Uint8Array)[i]=1;(m.biome as Biome[])[i]='water';(m.cargoPassable as Uint8Array)[i]=0;(m.buildable as Uint8Array)[i]=0;}
  const poi=[20*n+58,20*n+59];for(const i of poi)(m.protected as Uint8Array)[i]=1;
  const road=Array.from({length:70},(_,i)=>24*n+i+1);
  const handoff={economy:m,roads:[{id:'crossing',cells:road,surface:'road',widthTiles:1,bridgeCells:road.filter(i=>i%n>=33&&i%n<=35),cargoPassable:true}],
    pois:[{id:'works',kind:'industrial' as const,footprint:poi,entrances:[poi[0]],rooms:[[poi[1]]],doors:[poi[0]],powerNodes:[poi[1]],hazardCells:[],exteriorLootSites:[19*n+58],interiorLootSites:[poi[1]],retreatPaths:[[poi[0],21*n+58,22*n+58,23*n+58,24*n+58]]}],
    criticalPaths:[road],buildSites:[{id:'west-plot',cells:[22*n+10,22*n+11],loadingCells:[24*n+10]}],nonbossCashSites:[23*n+20],vendorSites:[23*n+15],evacuationSites:[23*n+65]};
  expect(validateGeographicHandoff(handoff)).toEqual([]);const result=compileEconomy(m);expect(result.errors).toEqual([]);expect(result.sources).not.toContain('iron');expect(result.sources).not.toContain('sulfur');
 });
});

describe('semantic input integrity',()=>{
 it('fails closed on invalid climate and malformed masks',()=>{
  const m=fixture();(m.temperature as Float32Array)[8]=NaN;expect(compileEconomy(m).errors.some(e=>e.includes('invalid terrain or climate'))).toBe(true);
  const m2=fixture();(m2.road as Uint8Array)[10]=2;expect(compileEconomy(m2).errors.some(e=>e.includes('invalid geographic mask'))).toBe(true);
 });
});
