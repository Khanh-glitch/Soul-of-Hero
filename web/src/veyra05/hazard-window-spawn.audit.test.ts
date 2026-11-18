/**
 * HAZARD-WINDOW NORMAL-START AUDIT — read-only cause triage, no law or map change.
 *
 * Observation that prompted this: `startRun` on the two authored hazard windows
 * (`veyra05-slag` = toxic flats, `veyra05-cinder` = volcanic ash) returns
 * "No safe, resource-accessible spawn in this region." for every seed tried, while
 * `veyra05-greywater` starts normally. This audit quantifies WHICH gate of the real
 * `chooseLegalSpawn` contract rejects every candidate, so the fact can be classified
 * instead of guessed, and pins the classification with assertions:
 *
 *   1. It is NOT player-facing: the title screen only offers the unified world
 *      (`veyra05-world`) and `shipping`; hazard scenes are `firstHour: false` and are
 *      not in `VEYRA_SPAWN_LAYOUTS`, so no player route ever asks for a legal spawn there.
 *   2. It IS a QA/harness entry limitation: those windows are only enterable through the
 *      QA inspection landing (`inspectAt`), which sets `qaUsed = true` and therefore never
 *      counts as playable or legal-start evidence.
 *   3. Whether hazard regions should also be normal-startable is a Creator law decision,
 *      not an engineering fix; nothing here changes the spawn contract.
 *
 * The separate question this audit deliberately left open — can a player WALK there from a legal
 * start? — is now measured by `global-foot-reachability.audit.test.ts` (opt-in
 * SOH_FOOT_REACHABILITY=1), which builds a global foot-passability mosaic of the whole 4000x2800
 * frame from the engine's own collision grids on the real 64-tile slide lattice and BFS-es from a
 * genuine normal start. Result: Slag Flats is walk-reachable (wading only), Cinder Isle is not.
 *
 * The per-candidate predicate below is a TRACED COPY of engine.ts `chooseLegalSpawn`
 * (safe cell, 3x3 safe neighbourhood, spawnEligible prefilter, then a 30-step walk BFS
 * requiring wood + stone + food + freshwater + >=9 build sites). It is pinned to the
 * engine revision recorded in the manifest and must be updated if that contract changes.
 * The trace is validated against the engine itself: a window where the trace finds a
 * fully passing candidate while `startRun` failed (or vice versa) fails this audit.
 *
 * Run: SOH_HAZARD_SPAWN_AUDIT=1 npx vitest run --fileParallelism=false \
 *        --testTimeout=600000 src/veyra05/hazard-window-spawn.audit.test.ts
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { T, TERRAIN_NAME, WW, WH, TILE, type RunState } from '../game/core';
import { VEYRA_SPAWN_LAYOUTS, blockGrid, effTile, markDirty, newGame, sourceAt, startRun } from '../game/engine';
import { getWorld, setActiveLayout } from '../game/world';
import { getWindowWorld } from './window';
import { VEYRA05_SCENES, U05_WORLD_LAYOUT_ID } from './scenes';
import { FRAME_H, FRAME_W, auToTile, windowAround } from './frame';
import { unverifiedOffshoreExcluded } from './global-start-discovery';
import { activeFloor } from './floors';

type Entry = Record<string, unknown>;
const root = path.resolve(process.cwd(), 'evidence/veyra-hazard-spawn-audit');
const output = path.join(root, 'manifest.json');
const SEEDS = [901, 902, 903, 1234, 7, 424242, 8801, 9101];
const CANDIDATE_BUDGET = Number(process.env.SOH_HAZARD_SPAWN_CANDIDATES || '800');
const EPOCH = Date.UTC(2026, 10, 17, 12);

const WINDOWS = [
  { id: 'veyra05-slag', role: 'hazard-toxic', expectNormalStart: false },
  { id: 'veyra05-cinder', role: 'hazard-ash', expectNormalStart: false },
  { id: 'veyra05-greywater', role: 'control-first-hour', expectNormalStart: true },
] as const;

const manifest: Entry = {
  schema: 'veyra-hazard-window-spawn-v1',
  executedAt: new Date().toISOString(),
  engineRevision: process.env.SOH_ENGINE_REVISION ?? 'working tree',
  seeds: SEEDS,
  candidateBudget: CANDIDATE_BUDGET,
  evidence: {
    source: 'actual compiled Veyra 200x200 windows via getWindowWorld + real startRun/blockGrid/sourceAt',
    starts: 'normal (player-route) startRun only; QA landing used solely to build a RunState for diagnosis',
    fullWorldTravel: 'MEASURED_SEPARATELY (src/veyra05/global-foot-reachability.audit.test.ts)',
    movement: 'NOT_RUN',
  },
  notes: [
    'A QA inspection landing sets qaUsed=true and is NEVER playable or legal-start evidence; it is used here only so the real collision grid can be read in a window where the normal start fails.',
    'The traced predicate is a copy of engine.ts chooseLegalSpawn pinned to the recorded engine revision; it is validated against the engine outcome for every window in this audit.',
    'No physical map, source stock, spawn contract, hazard rule or gameplay code is modified. Read-only window data plus startRun outcomes.',
    'This audit does NOT prove or disprove that a player can WALK to these regions from a legal start; that was a separate, then-unrun question and is now measured read-only by src/veyra05/global-foot-reachability.audit.test.ts (evidence/veyra-foot-reachability/manifest.json): the Slag Flats focus IS foot-reachable from a legal normal start (1492 tiles, 21 window slides, crossing 163 toxic tiles, and only by wading — never dry-reachable), while Cinder Isle, po_surtur and po_obsq stay unreachable on foot under every predicate, consistent with the offshore veto. Geometry only: no survival claim.',
  ],
  windows: [] as Entry[],
};

function save() {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
}

/** Window composition: what the authored biome claim actually looks like in compiled tiles. */
function windowComposition(layoutId: string): Entry {
  const w = getWindowWorld(layoutId).world;
  const n = WW * WH;
  const tiles: Record<string, number> = {};
  let walkable = 0, fresh = 0, eligible = 0, hazard = 0, buildable = 0;
  const sources: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const t = w.tiles[i];
    const name = TERRAIN_NAME[t] ?? `tile:${t}`;
    tiles[name] = (tiles[name] ?? 0) + 1;
    if (w.economyMap.walkable[i]) walkable++;
    if (w.economyMap.buildable[i]) buildable++;
    if (w.fresh[i]) fresh++;
    if (w.spawnEligible?.[i]) eligible++;
    if (t === T.TOXIC || t === T.ASH || t === T.SNOW) hazard++;
    const key = w.sourceV3[i];
    if (key) sources[key] = (sources[key] ?? 0) + 1;
  }
  // The resource gates name specific keys, so record their availability directly: a window can be
  // rejected by an earlier gate and STILL be unable to satisfy wood/food if that gate were relaxed.
  const woodKeys = ['oak', 'pine', 'snowpine', 'palm', 'willow'];
  const foodKeys = ['bush', 'mushroom'];
  return {
    cells: n, walkable, buildable, freshwaterCells: fresh, spawnEligibleCells: eligible, hazardTiles: hazard,
    woodSourceCells: woodKeys.reduce((a, k) => a + (sources[k] ?? 0), 0),
    foodSourceCells: foodKeys.reduce((a, k) => a + (sources[k] ?? 0), 0),
    stoneSourceCells: sources.rock ?? 0,
    tileHistogram: tiles, sourceHistogram: sources,
  };
}

/** Traced copy of the engine predicate; returns the reason each candidate is rejected. */
function traceCandidates(r: RunState, budget: number) {
  const w = getWorld();
  const grid = blockGrid(r);
  const fl = activeFloor(r);
  const n = WW * WH;
  const safe = (x: number, y: number) => {
    if (x <= 2 || y <= 2 || x >= WW - 3 || y >= WH - 3) return false;
    const i = y * WW + x;
    if (grid[i] !== 0 || !w.economyMap.walkable[i]) return false;
    if ([T.TOXIC, T.ASH, T.SNOW].includes(effTile(r, x, y))) return false;
    if ((r.sources[i] as { fire?: number } | undefined)?.fire) return false;
    if (Object.values(r.entities).some(e => e.type === 'spikes' && e.tx === x && e.ty === y)) return false;
    return !r.creatures.some(m => m.state !== 'dead' && ((m as unknown as { floor?: number }).floor ?? 0) === fl
      && Math.hypot(m.x - (x * TILE + 8), m.y - (y * TILE + 8)) < 10 * TILE);
  };
  const mask = w.spawnEligible;
  const gateMissing: Record<string, number> = {};
  let prefilterCells = 0, safeCell = 0, safeNeighbourhood = 0, traced = 0, passed = 0, budgetExhausted = false;
  const examples: Entry[] = [];
  for (let i = 0; i < n; i++) {
    if (!mask?.[i]) continue;
    prefilterCells++;
    const tx = i % WW, ty = (i / WW) | 0;
    if (!safe(tx, ty)) continue;
    safeCell++;
    let neighbourhood = true;
    for (let dy = -1; dy <= 1 && neighbourhood; dy++) for (let dx = -1; dx <= 1; dx++) if (!safe(tx + dx, ty + dy)) { neighbourhood = false; break; }
    if (!neighbourhood) continue;
    safeNeighbourhood++;
    if (traced >= budget) { budgetExhausted = true; continue; }
    traced++;
    // 30-step walk BFS over the real collision grid, tracking each required gate.
    const seen = new Uint8Array(n), depth = new Uint8Array(n), q = new Int32Array(n);
    let head = 0, tail = 0;
    const start = ty * WW + tx;
    q[tail++] = start; seen[start] = 1;
    let wood = false, stone = false, food = false, water = false, sites = 0;
    while (head < tail) {
      const cell = q[head++], x = cell % WW, y = (cell / WW) | 0;
      if (w.economyMap.buildable[cell] && !sourceAt(r, x, y)) sites++;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1) continue;
        const j = ny * WW + nx;
        if (w.fresh[j]) water = true;
        const src = sourceAt(r, nx, ny);
        if (src && src.stock > 0 && !src.fire) {
          if (['oak', 'pine', 'snowpine', 'palm', 'willow'].includes(src.key)) wood = true;
          if (src.key === 'rock') stone = true;
          if (['bush', 'mushroom'].includes(src.key)) food = true;
        }
        if ((dx || dy) && depth[cell] < 30 && !seen[j] && grid[j] === 0 && w.economyMap.walkable[j]) { seen[j] = 1; depth[j] = depth[cell] + 1; q[tail++] = j; }
      }
      if (wood && stone && food && water && sites >= 9) break;
    }
    const missing = [!wood && 'wood', !stone && 'stone', !food && 'food', !water && 'freshwater', sites < 9 && 'buildSites>=9'].filter(Boolean) as string[];
    if (!missing.length) {
      passed++;
      if (examples.length < 5) examples.push({ tx, ty, reachedCells: tail, sites });
    } else {
      const key = missing.sort().join('+');
      gateMissing[key] = (gateMissing[key] ?? 0) + 1;
      if (examples.length < 5) examples.push({ tx, ty, missing, reachedCells: tail, sites });
    }
  }
  return { rejectionStage: '', prefilterCells, safeCell, safeNeighbourhood, traced, budgetExhausted, fullyPassingCandidates: passed, firstMissingGateHistogram: gateMissing, examples };
}

/** QA-only landing so a real RunState (and therefore the real grid) exists in a window
 * where the normal start fails. Recorded as QA, never as a legal start. */
function qaLanding(layoutId: string, seed: number) {
  const scene = VEYRA05_SCENES.find(s => s.id === layoutId);
  const [gx, gy] = scene ? auToTile(scene.focusAu[0], scene.focusAu[1]) : [WW / 2, WH / 2];
  const win = windowAround(Math.round(gx), Math.round(gy));
  const lx = Math.min(WW - 9, Math.max(8, Math.round(gx) - win.originTx));
  const ly = Math.min(WH - 9, Math.max(8, Math.round(gy) - win.originTy));
  if (!setActiveLayout(layoutId)) return { ok: false, reason: 'layout unavailable' as string | null, gs: null as ReturnType<typeof newGame> | null };
  const gs = newGame();
  const res = startRun(gs, 'female', EPOCH, null, seed, { tx: lx, ty: ly });
  return { ok: !!res.ok, reason: (res as { reason?: string }).reason ?? null, gs: res.ok ? gs : null, landing: { tx: lx, ty: ly }, qaUsed: gs.run?.qaUsed ?? null };
}

describe('Hazard-window normal-start audit (read-only cause triage)', () => {
  it.skipIf(process.env.SOH_HAZARD_SPAWN_AUDIT !== '1')(
    'quantifies which chooseLegalSpawn gate rejects every candidate in the hazard windows, with a first-hour control',
    () => {
      for (const spec of WINDOWS) {
        const scene = VEYRA05_SCENES.find(s => s.id === spec.id);
        expect(scene, `scene ${spec.id} must exist in the authored scene list`).toBeTruthy();
        const [gx, gy] = auToTile(scene!.focusAu[0], scene!.focusAu[1]);
        const record: Entry = {
          id: spec.id, role: spec.role, short: scene!.short, biome: scene!.biome, firstHour: scene!.firstHour,
          focusAu: scene!.focusAu, focusTile: [gx, gy],
          insideGlobalFrame: gx >= 0 && gy >= 0 && gx < FRAME_W && gy < FRAME_H,
          // POLARITY, read from global-start-discovery.ts and its caller: the function returns
          // TRUE when the global tile is inside the verified mainland polygon and not inside one
          // of its water holes, and `chooseGlobalVeyraStart` does `if(!unverifiedOffshoreExcluded(...))continue;`
          // — so TRUE means "the mainland gate ALLOWS this cell as a random global start" and FALSE
          // means offshore/unverified (or inland water) and therefore vetoed until real sea
          // traversal is certified. Recorded so a hazard window's rejection can be told apart from
          // an offshore veto instead of being blamed on the wrong gate.
          mainlandGateAllowsRandomStart: unverifiedOffshoreExcluded(gx, gy),
          playerSelectableSpawnLayout: (VEYRA_SPAWN_LAYOUTS as readonly string[]).includes(spec.id),
          unifiedWorldLayoutIsThePlayerDefault: U05_WORLD_LAYOUT_ID === 'veyra05-world',
        };

        // 1) Player-route starts across seeds.
        const starts: Entry[] = [];
        for (const seed of SEEDS) {
          if (!setActiveLayout(spec.id)) { starts.push({ seed, ok: false, reason: 'layout unavailable' }); continue; }
          const gs = newGame();
          const res = startRun(gs, 'female', EPOCH, null, seed);
          starts.push({ seed, ok: !!res.ok, reason: (res as { reason?: string }).reason ?? null, layoutId: gs.run?.layoutId ?? null, qaUsed: gs.run?.qaUsed ?? null });
          if (gs.run) gs.run.ended = { at: EPOCH, reason: 'hazard spawn audit cleanup' } as never;
        }
        record.normalStarts = starts;
        record.normalStartOk = starts.filter(s => s.ok).length;
        record.normalStartReasons = [...new Set(starts.filter(s => !s.ok).map(s => s.reason))];

        // 2) Window composition.
        record.composition = windowComposition(spec.id);

        // 3) QA landing + traced candidate gates (diagnosis only).
        const qa = qaLanding(spec.id, SEEDS[0]);
        record.qaLanding = { ok: qa.ok, reason: qa.reason, landing: qa.landing ?? null, qaUsed: qa.qaUsed };
        if (qa.ok && qa.gs?.run) {
          setActiveLayout(spec.id);
          markDirty();
          const trace = traceCandidates(qa.gs.run, CANDIDATE_BUDGET);
          // Name the FIRST gate of the real contract that rejects everything, instead of
          // reporting an undifferentiated "no spawn": prefilter (freshwater distance 10..42),
          // single-cell safety (collision/hazard tile/fire), the 3x3 safe neighbourhood, or the
          // walk-BFS resource gates (wood + stone + food + freshwater + >=9 build sites).
          trace.rejectionStage = trace.prefilterCells === 0 ? 'freshwaterPrefilter:windowHasNoEligibleCell'
            : trace.safeCell === 0 ? 'safeCell:collisionOrHazardTileOrFire'
            : trace.safeNeighbourhood === 0 ? 'safe3x3Neighbourhood:noIsolatedSafeCellHasSafeNeighbours'
            : trace.traced > 0 && trace.fullyPassingCandidates === 0 ? 'resourceGates:woodStoneFoodWaterOrBuildSites'
            : 'none:traceFoundAPassingCandidate';
          record.candidateTrace = trace;
          qa.gs.run.ended = { at: EPOCH, reason: 'hazard spawn audit cleanup' } as never;
        } else {
          record.candidateTrace = null;
        }
        (manifest.windows as Entry[]).push(record);
        save();
      }

      // --- Classification assertions (mechanical, no experience claim) ---
      for (const record of manifest.windows as Entry[]) {
        const spec = WINDOWS.find(w => w.id === record.id)!;
        const scene = VEYRA05_SCENES.find(s => s.id === record.id)!;
        const trace = record.candidateTrace as Entry | null;
        expect(record.insideGlobalFrame, `${record.id}: authored focus must sit inside the continuous global frame`).toBe(true);
        expect(record.playerSelectableSpawnLayout, `${record.id}: hazard/late scenes must not be player spawn layouts`).toBe(false);
        expect(record.qaLanding && (record.qaLanding as Entry).ok, `${record.id}: QA inspection landing must be able to build a RunState for diagnosis`).toBe(true);
        expect((record.qaLanding as Entry).qaUsed, `${record.id}: the diagnostic landing must be flagged qaUsed`).toBe(true);
        expect(trace, `${record.id}: candidate trace requires a RunState`).toBeTruthy();

        if (spec.expectNormalStart) {
          expect((record.normalStartOk as number) > 0, `${record.id}: control window must start normally on at least one seed`).toBe(true);
          expect((trace!.fullyPassingCandidates as number) > 0,
            `${record.id}: trace/engine disagreement — startRun succeeded but the traced predicate found no fully passing candidate (trace drifted from engine.ts)`).toBe(true);
          expect(trace!.rejectionStage, `${record.id}: control window must not report a rejection stage`).toBe('none:traceFoundAPassingCandidate');
          expect(scene.firstHour, `${record.id}: control must be an authored first-hour scene`).toBe(true);
        } else {
          expect(record.normalStartOk, `${record.id}: expected no normal-route start to succeed`).toBe(0);
          expect(trace!.fullyPassingCandidates,
            `${record.id}: trace/engine disagreement — startRun failed on every seed but the traced predicate found a fully passing candidate (trace drifted from engine.ts)`).toBe(0);
          expect(String(trace!.rejectionStage).startsWith('none'),
            `${record.id}: the audit must name the rejecting stage of the real contract, not just report failure`).toBe(false);
          expect(scene.firstHour, `${record.id}: hazard windows must not be authored first-hour scenes`).toBe(false);
        }
      }

      // The two hazard windows must actually be hazard-dominated, otherwise the biome claim
      // and the rejection cause would not line up.
      const slag = (manifest.windows as Entry[]).find(w => w.id === 'veyra05-slag')!;
      const cinder = (manifest.windows as Entry[]).find(w => w.id === 'veyra05-cinder')!;
      expect((slag.composition as Entry).hazardTiles as number).toBeGreaterThan(0);
      expect((cinder.composition as Entry).hazardTiles as number).toBeGreaterThan(0);
      // The two hazard windows fail at DIFFERENT gates. Pinning both keeps the diagnosis honest:
      // if worldgen ever gives Slag Flats freshwater, or Cinder's safe cells gain a safe 3x3
      // neighbourhood, this audit goes red and the classification must be re-derived, not assumed.
      expect((slag.composition as Entry).freshwaterCells, 'Slag Flats must still have no freshwater cell (the prefilter gate)').toBe(0);
      expect((slag.composition as Entry).woodSourceCells, 'Slag Flats has no living wood source (deadtree only)').toBe(0);
      expect((slag.composition as Entry).foodSourceCells, 'Slag Flats has no bush/mushroom food source').toBe(0);
      expect(slag.mainlandGateAllowsRandomStart, 'Slag Flats is mainland: the offshore gate is NOT its rejection cause').toBe(true);
      expect(cinder.mainlandGateAllowsRandomStart, 'Cinder Isle is offshore: the mainland gate vetoes it as a random start too').toBe(false);
      expect((slag.candidateTrace as Entry).rejectionStage, 'Slag Flats rejection stage').toBe('freshwaterPrefilter:windowHasNoEligibleCell');
      expect(((cinder.candidateTrace as Entry).prefilterCells as number) > 0, 'Cinder Isle must still have some prefilter-eligible cell').toBe(true);
      expect((cinder.candidateTrace as Entry).rejectionStage, 'Cinder Isle rejection stage').toBe('safe3x3Neighbourhood:noIsolatedSafeCellHasSafeNeighbours');
      save();
    },
  );
});
