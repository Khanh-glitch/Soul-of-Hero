// MEC-01 B/P1: (1) anchors the five SOH industrial chains to the live recipe registry; (2) proves recycler economics with
// src/game/industrial-proof.ts: cumulative base+mid+high outputs, cheapest non-salvage craft route per item, numeraire
// ingot-equivalent (1 ore = 1 ingot = 3 scrap, authored furnace recipes) plus per-material atoms. LI figures are context only.
import {describe,it,expect} from 'vitest';
import {RECIPES} from '../src/game/catalog';
import {proveItem,expand,routesFor,SALVAGE_ONLY} from '../src/game/industrial-proof';
import BAL from '../src/game/balance.v1.json';

const ins=(k:string)=>Object.fromEntries((RECIPES[k].ins as [string,number][]).map(([i,q])=>[i,q]));

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

// Pinned historical defect set: recyclerV2 keys that over-returned at the cumulative high (or mid) tier. Corrected for NEW jobs in recyclerV3.
const V2_OVER=['iron_axe','iron_pick','iron_sword','industrial_axe'];
const keysOf=(ver:string)=>Object.keys((BAL as any)[ver].rules);
const overItems=(recipe:'X:recover-v1'|'X:recover-v2'|'X:recover-v3',ver:string)=>keysOf(ver).filter(k=>proveItem(k,recipe).rows.some((r:any)=>r.verdict==='OVER_RETURN')).sort();

describe('recycler economic proof (cumulative tiers, actual recovery plans)', () => {
  it('recyclerV1 (immutable saved-job table): no over-return for any tabled item', () => {
    expect(overItems('X:recover-v1','recyclerV1')).toEqual([]);
  });
  it('recyclerV2 defect is proven and pinned: exactly the four keys corrected for new jobs in V3', () => {
    expect(overItems('X:recover-v2','recyclerV2')).toEqual([...V2_OVER].sort());
  });
  it('recyclerV3 (new jobs): no over-return for any key it lists, and every V3 key is one V2 over-returned', () => {
    expect(overItems('X:recover-v3','recyclerV3')).toEqual([]);
    expect(keysOf('recyclerV3').sort()).toEqual([...V2_OVER].sort());
  });
  it('iron_pick v2 high: the proof names the minted coal and the ingot excess (not hidden by a unit count)', () => {
    const r=proveItem('iron_pick','X:recover-v2').rows.find((x:any)=>x.tier==='high') as any;
    expect(r.verdict).toBe('OVER_RETURN'); expect(r.mintedNonNumeraire).toEqual(['coal:+1']); expect(r.ieRecovered).toBeGreaterThan(r.ieCraft);
  });
  it('craft cost never routes through the salvage-only damaged_drive (mechanical_parts uses the bench recipe, not recover_drive)', () => {
    const e=expand('mechanical_parts',1); expect(e!.route).toBe('mechanical_parts'); expect(e!.vec).toEqual({iron_ingot:0.5,scrap:1});
    expect(routesFor('mechanical_parts').map(r=>r.recipe).sort()).toEqual(['mechanical_parts','recover_drive']);
    expect(SALVAGE_ONLY.has('damaged_drive')).toBe(true);
  });
  it('scrap and coal are costed, not zero: scrap via furnace scrap_ingot (3:1), coal kept as its own atom', () => {
    expect(expand('iron_plate',1)!.vec.coal).toBe(1);
    expect(RECIPES.scrap_ingot.ins).toEqual([['scrap',3]]);
  });
});

