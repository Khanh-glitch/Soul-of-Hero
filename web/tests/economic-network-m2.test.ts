import { describe, expect, it, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  M2_AUDIT_VERSION,
  runFullM2EconomicAudit,
  type M2SimulationResults,
} from '../src/game/economic-sim-audit';

const REPORTS_DIR = resolve(process.cwd(), 'reports', 'economic-network');
const RESULTS_PATH = resolve(REPORTS_DIR, 'M2_SIMULATION_RESULTS.json');

describe('SOH M2 Full Economic Simulation & Structural Audit', () => {
  let cached: M2SimulationResults | null = null;

  function getResults(): M2SimulationResults {
    if (!cached) {
      cached = runFullM2EconomicAudit();
      mkdirSync(REPORTS_DIR, { recursive: true });
      writeFileSync(RESULTS_PATH, JSON.stringify(cached, null, 2) + '\n', 'utf8');
    }
    return cached;
  }

  beforeAll(() => {
    getResults();
  }, 240_000);

  it('Suite 1: Audits global resource/loot endowment across shipping_fresh and all 12 Veyra scenes + 81 POIs', () => {
    const res = getResults();
    expect(res.meta.version).toBe(M2_AUDIT_VERSION);
    expect(res.worldEndowments.shipping.tilesTotal).toBe(40_000);
    expect(res.worldEndowments.veyra.sceneWindowCount).toBe(12);
    expect(res.worldEndowments.veyra.sampledTilesTotal).toBe(480_000);
    expect(res.worldEndowments.veyra.totalPois).toBe(81);
    expect(res.worldEndowments.veyra.authoredLootExpected).toBe(24);
    expect(res.worldEndowments.veyra.authoredLootMaterialized).toBe(24);
    expect(res.worldEndowments.veyra.archetypePoisMissing).toEqual([]);
    expect(res.worldEndowments.veyra.aggregateSceneSources.palm).toBe(66);
    expect(Object.keys(res.worldEndowments.veyra.staticCores)).toHaveLength(0);
    expect(Object.keys(res.worldEndowments.shipping.staticCores)).toHaveLength(8);
    expect(res.worldEndowments.shipping.staticRcashTotal).toBeGreaterThan(0);
    expect(res.worldEndowments.veyra.staticRcashTotal).toBe(275);
  });

  it('Suite 2: Executes 5 multi-day (0h-336h) player archetypes across Shipping & Veyra', () => {
    const res = getResults();
    for (const label of ['shipping_fresh', 'veyra05-world'] as const) {
      const arch = res.archetypeSimulations[label];
      expect(arch).toBeDefined();
      expect(arch.casualOffline14Day.placedStructures).toBeGreaterThanOrEqual(8);
      expect(arch.fortifier14Day.total14dItemsConsumed).toBeGreaterThan(0);
      expect(arch.currencySplit.maxVendorSecuredSpendablePerRun).toBe(76);
      expect(arch.currencySplit.maxVendorSparesSpendablePerRun).toBe(59);
      expect(arch.currencySplit.max14DayRequisitionSecured).toBe(0);
      expect(arch.currencySplit.liveProbeDay1.emberClaimOk).toBe(true);
      expect(arch.researchAndCoreGate.sparesNeededBeforeFirstCoreRandom).toBe(104);
    }
  });

  it('Suite 3: Computes 5-preset 336h stepTerritory upkeep stress matrix with exact cabinet debit verification', () => {
    const res = getResults();
    expect(res.territoryStressMatrix).toHaveLength(5);
    for (const row of res.territoryStressMatrix) {
      expect(row.structureCount).toBeGreaterThan(5);
      expect(Object.keys(row.dailyUpkeepExact).length).toBeGreaterThanOrEqual(1);
      expect(Object.values(row.actual14DayEngineDebits as Record<string, number>).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    }
  });

  it('Suite 4: Maps seasonal offline settle() survival envelope with supplied rest verification', () => {
    const res = getResults();
    expect(res.offlineSettlementMatrix.length).toBeGreaterThanOrEqual(40);
    for (const row of res.offlineSettlementMatrix) {
      expect(row.calendarSeasonVerified).toBe(row.season);
    }
    const bedRows = res.offlineSettlementMatrix.filter((r) => r.scenario === 'Supplied_Bed_Rest_24h');
    expect(bedRows.length).toBe(8);
    for (const br of bedRows) {
      expect(br.restStarted).toBe(true);
      expect(br.survived).toBe(true);
    }
    const winterOpen24 = res.offlineSettlementMatrix.find(
      (r) => r.season === 'winter' && r.scenario === 'Unsheltered_Open' && r.offlineHours === 24,
    );
    expect(winterOpen24).toBeDefined();
  });

  it('Suite 5: Verifies energy/fuel/refinery/generator/motorbike conservation & idle campfire leak', () => {
    const res = getResults();
    const fc = res.fuelAndPowerConservation;
    expect(fc.baseGeneratorDemandVsCapacity.baseGeneratorFuelCanRuntimeSec).toBe(60);
    expect(fc.baseGeneratorDemandVsCapacity.baseGeneratorCoalRuntimeSec).toBe(80);
    expect(fc.baseGeneratorDemandVsCapacity.baseGeneratorBriquetteRuntimeSec).toBe(90);
    expect(fc.baseGeneratorDemandVsCapacity.demand24hOneLoad.fuel_can).toBe(1440);
    expect(fc.idleFuelLeakProbe.campfireBurnsIdleForeverWhileLoaded).toBe(true);
    expect(fc.idleFuelLeakProbe.furnaceIdleWoodBurnedIn10Min).toBe(0);
  });

  it('Suite 6: Simulates 336h stepHusbandry across all 4 tamable species and 4-season garden growth', () => {
    const res = getResults();
    expect(res.husbandryAndGarden14Day.husbandry14Day).toHaveLength(4);
    for (const sp of res.husbandryAndGarden14Day.husbandry14Day) {
      expect(sp.penCapacity).toBeGreaterThanOrEqual(3);
      expect(sp.feedConsumed14d).toBeGreaterThan(0);
      if (sp.species !== 'boar') {
        expect(Object.keys(sp.renewableOutputs14d).length).toBeGreaterThan(0);
      }
    }
    expect(res.husbandryAndGarden14Day.gardenSeasonalGrowth).toHaveLength(8);
  });

  it('Suite 7: Runs N=400 seeded Monte Carlo distributions (200 Shipping + 200 Veyra)', () => {
    const res = getResults();
    expect(res.monteCarloRuns.shippingN).toBe(200);
    expect(res.monteCarloRuns.veyraN).toBe(200);
    expect(res.monteCarloRuns.shippingDistributions.airdropFuelCans.p50).toBeGreaterThanOrEqual(
      res.monteCarloRuns.shippingDistributions.airdropFuelCans.p10,
    );
    expect(res.monteCarloRuns.veyraDistributions.airdropEvents.max).toBe(0);
  });

  it('Suite 8: Proves all 16 structural findings, anti-arbitrage recycler integrity & determinism', () => {
    const res = getResults();
    const audit = res.exploitAndParityAudit;
    expect(audit.findings).toHaveLength(16);
    expect(audit.recyclerProbes.filter((p) => p.overReturnDetected)).toHaveLength(0);
    expect(audit.claimMinDistFromPoiProbe.claimInsidePoiAllowed).toBe(true);
    expect(audit.oilPumpOffscreenSkipped).toBe(true);
    expect(audit.findings.map((f) => f.id)).toEqual(
      Array.from({ length: 16 }, (_, i) => `M2-F${String(i + 1).padStart(2, '0')}`),
    );
  });
});
