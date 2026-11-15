// MEC-01 B/P1: (1) anchors the five SOH industrial chains to the live recipe registry; (2) proves recycler economics with
// src/game/industrial-proof.ts: cumulative base+mid+high outputs, cheapest non-salvage craft route per item, numeraire
// ingot-equivalent (1 ore = 1 ingot = 3 scrap, authored furnace recipes) plus per-material atoms. LI figures are context only.
import {describe,it,expect} from 'vitest';
import {RECIPES} from '../src/game/catalog';
import {recyclerV4Rules} from '../src/game/recycler';
import {proveItem,expand,routesFor,SALVAGE_ONLY} from '../src/game/industrial-proof';
import BAL from '../src/game/balance.v1.json';

const ins=(k:string)=>Object.fromEntries((RECIPES[k].ins as [string,number][]).map(([i,q])=>[i,q]));

// Item set v3 (recipe revision 5): Machine Parts, Fasteners, Coal and Scrap Metal are retired. Every chain below is priced in
// Parts and Charcoal; the pre-cutover shapes stay frozen in the migration ledger for queued jobs (pa1-rev1-queued-jobs.test.ts).
describe('MEC-01 five-chain SOH benchmark is anchored to the registry', () => {
  it('metal blade: 4 iron + 1 Parts at bench II', () => {
    expect(ins('metal_blade')).toEqual({iron_ingot:4,spares:1}); expect(RECIPES.metal_blade.stationLevel).toBe(2); expect(RECIPES.metal_blade.rev).toBe(5);
  });
  it('metal pipe: 2 refined iron + 2 Parts -> 2 sections at bench II', () => {
    expect(ins('metal_pipe')).toEqual({refined_iron_ingot:2,spares:2}); expect(RECIPES.metal_pipe.qty).toBe(2); expect(RECIPES.metal_pipe.stationLevel).toBe(2);
  });
  it('mechanical gear: 2 iron + 3 Parts at bench II (LI: iron + Parts, Parts-heavy)', () => {
    expect(ins('mechanical_gear')).toEqual({iron_ingot:2,spares:3}); expect(RECIPES.mechanical_gear.stationLevel).toBe(2);
    expect(RECIPES.mechanical_gear.rev).toBe(5);
  });
  it('iron plate: 2 refined iron + 2 Parts → 2 plates (no pipe sink)', () => {
    expect(ins('iron_plate')).toEqual({refined_iron_ingot:2,spares:2}); expect(RECIPES.iron_plate.qty).toBe(2);
    expect(RECIPES.iron_plate.rev).toBe(5);
  });
  it('utility frame (rev 5): 1 pipe + 4 iron + 2 refined + 4 Parts at bench II', () => {
    expect(ins('vehicle_frame')).toEqual({metal_pipe:1,iron_ingot:4,refined_iron_ingot:2,spares:4}); expect(RECIPES.vehicle_frame.rev).toBe(5); expect(RECIPES.vehicle_frame.stationLevel).toBe(2);
  });
});

const keysOf=(ver:string)=>Object.keys((BAL as any)[ver].rules);
const overItems=(recipe:string,keys:string[])=>keys.filter(k=>proveItem(k,recipe).rows.some((r:any)=>r.verdict==='OVER_RETURN')).sort();
const notOk=(recipe:string,keys:string[])=>keys.filter(k=>proveItem(k,recipe).rows.some((r:any)=>r.verdict!=='OK')).sort();

describe('recycler economic proof (cumulative tiers, actual recovery plans)', () => {
  it('recyclerV4 (every NEW job): priced OK at every tier for every tool, and never pays out Parts', () => {
    const keys=Object.keys(recyclerV4Rules());
    expect(keys.sort()).toEqual(['industrial_axe','industrial_pick','iron_axe','iron_pick','machete','reinforced_spear']);
    expect(notOk('X:recover-v4',keys)).toEqual([]);
    for(const r of Object.values(recyclerV4Rules()))for(const [k] of [...r.base,...r.mid,...r.high])expect(['wood','iron_ingot','refined_iron_ingot']).toContain(k);
  });
  it('new component jobs are priced OK: gear-v2, blade-v2, pipe-v3, plate-v1', () => {
    for(const [k,rc] of [['mechanical_gear','X:gear-v2'],['metal_blade','X:blade-v2'],['metal_pipe','X:pipe-v3'],['iron_plate','X:plate-v1']] as const)expect(proveItem(k,rc).rows.map((r:any)=>r.verdict),rc).toEqual(['OK']);
  });
  it('KNOWN, BOUNDED: frozen tables read through the retirement ratios over-return Parts — they can only pay a job that was already queued', () => {
    // A stored v1/v2/v3 (or gear-v1 / blade-v1) job pays Scrap Metal and Machine Parts. Those ids are retired, so the job
    // hands out their successors at the save-migration ratio (1 Scrap -> 1 Parts, 1 Machine Part -> 2 Parts). Read that way
    // the frozen rows return more Parts than the tool's live formula holds. This is pinned, not hidden: it is a one-time
    // payout bounded by the jobs sitting in a recycler queue when the save was migrated; recoveryPlan() never selects
    // these versions for a new job (asserted in sys03-recycler and b01-industrial-loot).
    expect(overItems('X:recover-v1',keysOf('recyclerV1'))).toEqual(['industrial_axe','iron_axe','iron_pick','reinforced_spear']);
    expect(overItems('X:recover-v2',keysOf('recyclerV2'))).toEqual(['industrial_axe','iron_axe','iron_pick']);
    expect(overItems('X:recover-v3',keysOf('recyclerV3'))).toEqual(['industrial_axe','iron_axe','iron_pick']);
    expect(proveItem('mechanical_gear','X:gear-v1').rows.map((r:any)=>r.verdict)).toEqual(['OVER_RETURN']);
    expect(proveItem('metal_blade','X:blade-v1').rows.map((r:any)=>r.verdict)).toEqual(['OVER_RETURN']);
    const r=proveItem('iron_pick','X:recover-v2').rows.find((x:any)=>x.tier==='high') as any;
    expect(r.mintedNonNumeraire).toEqual(['spares:+2','charcoal:+1']); expect(r.ieRecovered).toBeGreaterThan(r.ieCraft);
  });
  it('craft cost is priced in live atoms only: no route through a retired id', () => {
    for(const k of ['mechanical_gear','metal_pipe','metal_blade','iron_plate','vehicle_frame']){const e=expand(k,1)!;expect(e.route).toBe(k);for(const atom of Object.keys(e.vec))expect(['iron_ingot','charcoal','spares','wood']).toContain(atom);}
    expect(expand('mechanical_gear',1)!.vec).toEqual({iron_ingot:2,spares:3});
    for(const dead of ['mechanical_parts','fasteners','recover_drive','scrap_ingot'])expect(RECIPES[dead],dead).toBeUndefined();
    expect(routesFor('mechanical_parts')).toEqual([]);
    expect(SALVAGE_ONLY.has('damaged_drive')).toBe(true);
  });
  it('charcoal is costed, not zero: a plate and a pipe section each carry one charcoal and one Parts', () => {
    expect(expand('iron_plate',1)!.vec).toEqual({iron_ingot:1.5,charcoal:1,spares:1});
    expect(expand('metal_pipe',1)!.vec).toEqual({iron_ingot:1.5,charcoal:1,spares:1});
    expect(RECIPES.refined_iron_ingot.ins).toEqual([['iron_ingot',3],['charcoal',2]]);
  });
});
