import {describe,it,expect} from 'vitest';
import {runSuite5EnergyAndFuel} from '../src/game/economic-sim-audit';
import {ITEMS,RECIPES,VENDOR_SPARES} from '../src/game/catalog';
import {isRetiredLive} from '../src/game/final-item-set';

describe('current energy audit uses current supply, not retired oil formulas',()=>{
  it('projects every live canister route and finite source outputs without treating a subset as all run fuel',()=>{
    // Controlled accounting input, NOT an actual world census/access certificate.
    const out=runSuite5EnergyAndFuel({shipping:{sourceYieldTotals:{probe:{expectedPrimary:{crude_petroleum:2},expectedBonus:{fuel_can:3}}},staticLootItems:{crude_petroleum:1,fuel_can:2}}});
    expect(out.fuelProductionRoutes.map(r=>r.id).sort()).toEqual(Object.entries(RECIPES).filter(([,r])=>r.out==='fuel_can').map(([id])=>id).sort());
    for(const route of out.fuelProductionRoutes){
      expect(route.fuelCansOut).toBe(RECIPES[route.id].qty);
      expect(route.inputs).toEqual(RECIPES[route.id].ins.map(([key,qty])=>({key,qty})));
      for(const input of route.inputs)expect(isRetiredLive(input.key),input.key).toBe(false);
    }
    expect(out.fuelProductionRoutes.some(r=>r.inputs.some(i=>i.key==='animal_fat'))).toBe(true);
    expect(out.refineryRatios.length).toBeGreaterThan(0);
    expect(out.refineryRatios.every(r=>r.inputs.some(i=>i.key==='crude_petroleum'))).toBe(true);
    expect(out.shippingOilAndFuelBudget.totalCrudePetroleumExpected).toBe(3+VENDOR_SPARES.crude_petroleum.stock*VENDOR_SPARES.crude_petroleum.qty);
    expect(out.shippingOilAndFuelBudget.directFuelCansExpected).toBe(5);
    expect(out.shippingOilAndFuelBudget.scope).toContain('NOT whole-run fuel supply');
    expect(JSON.stringify(out)).not.toMatch(/salvaged_oil|fuel_briquette|lubricant/);
    const finite=(value:unknown):void=>{
      if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);
      else if(value&&typeof value==='object')Object.values(value).forEach(finite);
    };finite(out);
  });
  it('only prices current fuels and measures the idle engine probe instead of hardcoding it',()=>{
    const out=runSuite5EnergyAndFuel({shipping:{sourceYieldTotals:{},staticLootItems:{}}});
    expect(out.fuelItems.map(f=>f.key)).not.toContain('coal');
    expect(out.baseGeneratorDemandVsCapacity.baseGeneratorCharcoalRuntimeSec).toBe(ITEMS.charcoal.fuel);
    for(const f of out.fuelItems)expect(out.baseGeneratorDemandVsCapacity.demand24hOneLoad[f.key]).toBe(86400/ITEMS[f.key].fuel!);
    expect(out.idleFuelLeakProbe.furnaceIdleWoodBurnedIn10Min).toBe(0);
    expect(out.shippingOilAndFuelBudget.directFuelCansExpected).toBe(0);
  });
});
