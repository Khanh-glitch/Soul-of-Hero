// MEC-01 (partial): anchors the five SOH industrial benchmark chains to the live recipe registry, and asserts that no
// recycler rule returns more units than the craft that produced its item consumed (no profitable recycle→recraft loop).
// LI historical figures are reference only (see PR handoff); they are not balance inputs here.
import {describe,it,expect} from 'vitest';
import {RECIPES} from '../src/game/catalog';
import BAL from '../src/game/balance.v1.json';

const ins=(k:string)=>Object.fromEntries((RECIPES[k].ins as [string,number][]).map(([i,q])=>[i,q]));
const units=(a:[string,number][]|undefined|null)=>(a??[]).reduce((n,[,q])=>n+q,0);

describe('MEC-01 five-chain SOH benchmark is anchored to the registry', () => {
  it('metal blade: 4 iron + 1 mechanical part at bench II', () => {
    expect(ins('metal_blade')).toEqual({iron_ingot:4,mechanical_parts:1}); expect(RECIPES.metal_blade.stationLevel).toBe(2);
  });
  it('metal pipe: 2 refined iron + 1 mechanical part at bench II', () => {
    expect(ins('metal_pipe')).toEqual({refined_iron_ingot:2,mechanical_parts:1}); expect(RECIPES.metal_pipe.stationLevel).toBe(2);
  });
  it('mechanical gear: 2 iron + 2 mechanical parts + 1 fastener at bench II', () => {
    expect(ins('mechanical_gear')).toEqual({iron_ingot:2,mechanical_parts:2,fasteners:1}); expect(RECIPES.mechanical_gear.stationLevel).toBe(2);
  });
  it('iron plate: 2 refined iron + 1 pipe + 1 mechanical part → 2 plates', () => {
    expect(ins('iron_plate')).toEqual({refined_iron_ingot:2,metal_pipe:1,mechanical_parts:1}); expect(RECIPES.iron_plate.qty).toBe(2);
  });
  it('utility frame: 3 iron + 2 mechanical parts + 2 spares at bench II', () => {
    expect(ins('vehicle_frame')).toEqual({iron_ingot:3,mechanical_parts:2,spares:2}); expect(RECIPES.vehicle_frame.stationLevel).toBe(2);
  });
});

describe('no profitable recycle→recraft loop in the recycler tables', () => {
  for (const ver of ['recyclerV1','recyclerV2'] as const) {
    it(`${ver}: every recovered output set is no larger than the craft input that produced the item`, () => {
      const rules=(BAL as any)[ver].rules as Record<string,{base?:[string,number][];mid?:[string,number][];high?:[string,number][]}>;
      for (const [item,rule] of Object.entries(rules)) {
        const rc=Object.values(RECIPES).find(x=>x.out===item&&!x.alias) as any;
        if (!rc) continue;                       // unrecoverable-by-craft items (e.g. drive) are covered by their own rule
        const cost=units(rc.ins)*1;
        for (const tier of ['base','mid','high'] as const) expect(units(rule[tier]), `${item}.${tier}`).toBeLessThanOrEqual(cost);
      }
    });
  }
});
