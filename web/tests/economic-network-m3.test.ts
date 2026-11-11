import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  M3_POLICY_VERSION,
  runFullM3BeforeAfterSimulation,
} from '../src/game/economic-rebalance-m3';

const REPORTS_DIR = resolve(process.cwd(), 'reports', 'economic-network');
const M3_SIM_PATH = resolve(REPORTS_DIR, 'M3_BEFORE_AFTER_SIM.json');

describe('SOH M3 Economic Tuning & Counterfactual Before/After Simulation', () => {
  it('Executes deterministic M3 rebalance policy counterfactuals, verifies LOCKED_CANON invariants & writes M3_BEFORE_AFTER_SIM.json', () => {
    const res = runFullM3BeforeAfterSimulation();
    mkdirSync(REPORTS_DIR, { recursive: true });
    writeFileSync(M3_SIM_PATH, JSON.stringify(res, null, 2) + '\n', 'utf8');

    expect(res.meta.version).toBe(M3_POLICY_VERSION);
    expect(res.lockedCanonVerification.allPassed).toBe(true);
    expect(res.lockedCanonVerification.checks.every((c) => c.verified)).toBe(true);

    // Territory upkeep autonomy gains across all 5 presets
    expect(res.territoryStressBeforeAfter).toHaveLength(5);
    const brickCitadel = res.territoryStressBeforeAfter.find((r) => r.preset === 'Brick_Citadel_6x6_Armed')!;
    expect(brickCitadel.before.autonomyHours24Slot).toBe(31.22);
    expect(brickCitadel.after.autonomyHours32SlotWeighted).toBeGreaterThanOrEqual(168);

    // Fuel & Base Generator rebalance
    expect(res.energyAndPowerBeforeAfter.before.fuelCanRuntimeSec).toBe(60);
    expect(res.energyAndPowerBeforeAfter.after.fuelCanRuntimeSec).toBe(360);
    expect(res.energyAndPowerBeforeAfter.after.idleZeroLoadDrainPer24hCans).toBe(0);
    expect(res.energyAndPowerBeforeAfter.after.idleCampfire10MinWoodLoss).toBe(0);
    expect(res.energyAndPowerBeforeAfter.after.activeRuntimeGainFactor).toBeGreaterThan(30);

    // Currency sinks & Research Core unlock unblock
    expect(res.currencyAndResearchBeforeAfter.currency.before.requisitionOverVendorCapRatio).toBe(7.74);
    expect(res.currencyAndResearchBeforeAfter.currency.after.requisitionOverVendorCapRatio).toBeLessThan(0.75);
    expect(res.currencyAndResearchBeforeAfter.researchMonteCarloN400.before.sparesToFirstCoreDist.p50).toBe(108);
    expect(res.currencyAndResearchBeforeAfter.researchMonteCarloN400.after.sparesToFirstCoreDist.p50).toBeLessThanOrEqual(40);

    // Veyra parity & Monte Carlo
    expect(res.veyraParityAndMonteCarloN400.poiAndItemCoverage.after.authoredMaterialized).toBe(24);
    expect(res.veyraParityAndMonteCarloN400.poiAndItemCoverage.after.archetypeMaterialized).toBe(58);
    expect(res.veyraParityAndMonteCarloN400.poiAndItemCoverage.after.missingVeyraRecipes).toHaveLength(0);
    expect(res.veyraParityAndMonteCarloN400.veyraLocalSpawnMonteCarloN200.after.spawnIronNodes.p50).toBeGreaterThanOrEqual(12);

    // Exploit, POI guard, BuildOrder & Anti-Arbitrage
    expect(res.exploitAndConservationChecks.poiDistanceGuard.beforeAllowedAtDist9).toBe(true);
    expect(res.exploitAndConservationChecks.poiDistanceGuard.afterAllowedAtDist9).toBe(false);
    expect(res.exploitAndConservationChecks.buildOrderParity.beforeMissingDefenseKeys).toEqual(['ir_sensor', 'bear_trap']);
    expect(res.exploitAndConservationChecks.buildOrderParity.afterMissingDefenseKeys).toHaveLength(0);
    expect(res.exploitAndConservationChecks.recyclerAntiArbitrage.overReturnsAfter).toBe(0);

    // All 16 findings mapped cleanly
    expect(res.findingResolutionMatrix).toHaveLength(16);
  });
});
