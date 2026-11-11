import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ITEMS, RECIPES, STRUCTS, permitsDirectedResearch } from '../src/game/catalog';
import { BAL, HOUR, TILE, WW } from '../src/game/core';
import { dispatch, newGame, addItem, countItem, sourceAt } from '../src/game/engine';
import { sourceDigest } from '../src/game/world-economy';
import { getWorld } from '../src/game/world';
import {
  M3_POLICY_VERSION,
  runFullM3BeforeAfterSimulation,
  validateAuthoritativeLockedCanon,
} from '../src/game/economic-rebalance-m3';

const REPORTS_DIR = resolve(process.cwd(), 'reports', 'economic-network');
const M3_SIM_PATH = resolve(REPORTS_DIR, 'M3_BEFORE_AFTER_SIM.json');
const T0 = Date.UTC(2026, 0, 1);

describe('SOH M3 Counterfactual Study (DESIGN_PROPOSED / Non-Authoritative) & Authoritative LOCKED_CANON Guards', () => {
  it('Executes counterfactual study with honest PROPOSED_AFTER / CANON_REJECTED labels & writes M3_BEFORE_AFTER_SIM.json', () => {
    const res = runFullM3BeforeAfterSimulation();
    mkdirSync(REPORTS_DIR, { recursive: true });
    writeFileSync(M3_SIM_PATH, JSON.stringify(res, null, 2) + '\n', 'utf8');

    expect(res.meta.version).toBe(M3_POLICY_VERSION);
    expect(res.lockedCanonVerification.allPassed).toBe(true);
    expect(res.lockedCanonVerification.checks.every((c) => c.verified)).toBe(true);

    // Every M3 finding matrix status must be honest (no false FIXED_BY_SPEC / PRODUCTION_FIXED labels)
    expect(res.findingResolutionMatrix).toHaveLength(16);
    expect(res.findingResolutionMatrix.every((f) => ['PROPOSED_AFTER', 'CANON_REJECTED', 'VERIFIED_INVARIANT'].includes(f.status))).toBe(true);
    const rejectedIds = res.findingResolutionMatrix.filter((f) => f.status === 'CANON_REJECTED').map((f) => f.findingId);
    expect(rejectedIds).toEqual(expect.arrayContaining(['M2-F01', 'M2-F03', 'M2-F04', 'M2-F06', 'M2-F09', 'M2-F10', 'M2-F13']));

    // Existing counterfactual metrics remain reproducible
    const brickCitadel = res.territoryStressBeforeAfter.find((r) => r.preset === 'Brick_Citadel_6x6_Armed')!;
    expect(brickCitadel.before.autonomyHours24Slot).toBe(31.22);
    expect(brickCitadel.after.autonomyHours32SlotWeighted).toBeGreaterThanOrEqual(168);
    expect(res.exploitAndConservationChecks.recyclerAntiArbitrage.overReturnsAfter).toBe(0);
  });

  it('Enforces LOCKED_CANON Corrective invariants (24-slot cabinet, 7 Creator vs 4 Legacy Cores, biome drops, Tier-3 research lock)', () => {
    const canon = validateAuthoritativeLockedCanon();
    expect(canon.allPassed).toBe(true);
    expect(canon.checks.every((c) => c.verified)).toBe(true);

    // Explicit Creator-locked 24-slot cabinet check
    expect(STRUCTS.claim.slots).toBe(24);

    // Explicit 7 Creator Core Gold SKUs vs 4 Legacy Cores check
    const creatorCores = Object.keys(ITEMS).filter((k) => Boolean(ITEMS[k]?.creatorCore));
    const legacyCores = Object.keys(ITEMS).filter((k) => Boolean(ITEMS[k]?.core) && !ITEMS[k]?.creatorCore);
    expect(creatorCores).toHaveLength(7);
    expect(legacyCores).toHaveLength(4);
    for (const lk of legacyCores) expect(ITEMS[lk].creatorCore).toBeUndefined();

    // Random / directed research Tier-3 Core gate
    expect(permitsDirectedResearch(RECIPES.core_dragon)).toBe(false);
    expect(permitsDirectedResearch(RECIPES.core_fire)).toBe(false);
    expect(permitsDirectedResearch(RECIPES.chitin_armor)).toBe(false);
  });

  it('Enforces LOCKED_CANON Ragnarok full wipe & finite non-plant source identity', () => {
    const gs = newGame();
    expect(dispatch(gs, { id: 'lc-start1', type: 'startRun', character: 'female', region: 0, seed: 101 }, T0).ok).toBe(true);
    const r = gs.run!;
    addItem(r, 'inv', 'iron_ingot', 5);
    addItem(r, 'inv', 'rcash', 4);
    expect(countItem(r, 'inv', 'iron_ingot')).toBe(5);

    // Finite non-plant source layout identity (sourceLayoutVersion === 3) & non-regrowing finite mineral check
    expect(r.sourceLayoutVersion).toBe(3);
    expect(r.sourceMap?.digest).toBe(sourceDigest(getWorld().sourceV3));
    const mineralIdx = getWorld().sourceV3.findIndex((k) => k === 'rock' || k === 'iron' || k === 'coal');
    expect(mineralIdx).toBeGreaterThanOrEqual(0);
    r.sources[mineralIdx] = { stock: 0, hp: 0 };
    expect(sourceAt(r, mineralIdx % WW, Math.floor(mineralIdx / WW), T0 + 200 * HOUR)?.stock).toBe(0);
    expect(BAL.run.maxRunHours).toBe(336);
    expect(BAL.run.ragnarokFinalHours).toBe(72);

    // Build a structure at walkable tile & verify abandon / wipe drops run items & buildings cleanly
    const tx = Math.floor(r.player.x / TILE);
    const ty = Math.floor(r.player.y / TILE) + 1;
    r.entities['lc_tmp'] = { id: 'lc_tmp', kind: 'struct', type: 'wall_wood', tx, ty, x: tx * TILE + 8, y: ty * TILE + 8, hp: 100, maxHp: 100 };
    expect(dispatch(gs, { id: 'lc-abandon', type: 'abandon' }, T0 + 1000).ok).toBe(true);
    expect(gs.run).toBeNull();
    // Un-escrowed rcash & run items do NOT convert into profile securedCash on wipe
    expect(gs.profile.securedCash).toBe(0);
    expect(dispatch(gs, { id: 'lc-start2', type: 'startRun', character: 'female', region: 0, seed: 102 }, T0 + 2000).ok).toBe(true);
    expect(countItem(gs.run!, 'inv', 'iron_ingot')).toBe(0);
    expect(gs.run!.entities['lc_tmp']).toBeUndefined();
  });
});
