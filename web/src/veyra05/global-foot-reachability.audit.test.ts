/**
 * GLOBAL FOOT-REACHABILITY AUDIT — GEOMETRY ONLY. Read-only; no law, map or gameplay change.
 *
 * Question this answers (left explicitly NOT_RUN by the hazard-window spawn audit): the purple
 * access card is deployed by `engine.ts g1bEnsureSources` at global tile (2402,1843) — the
 * `po_slag` interior anchor, inside the Slag Flats region — and Cinder Isle hosts the Surtur elder
 * site. Neither region has a legal normal start ("No safe, resource-accessible spawn in this
 * region."). "Not startable" is NOT "not reachable": the 200x200 gameplay window slides across the
 * continuous 4000x2800 frame in 64-tile steps (`veyra05/continuity.ts`), so a player who starts
 * legally could in principle walk there. Existing coverage reaches `po_slag` by streaming the
 * window directly (tests/d1-d5-corrective.test.tsx D5), never by walking, and the added-ecology
 * survey checks LOCAL passability per site only. This audit builds the missing global picture.
 *
 * What it does
 *   1. Takes a REAL normal start: `startRun(gs,'female',EPOCH,null,seed)` on the title default
 *      layout `veyra05-world`, which runs `chooseGlobalVeyraStart` (mainland gate + exact
 *      `chooseLegalSpawn` + window-exit reach). `qaUsed` must be false; the BFS source is that
 *      player's global tile via `playerGlobalTile(r)`.
 *   2. Proves the sliding-window lattice is the real mechanism, not an assumption: calls
 *      `shiftVeyraWindowBy(gs, 64, 0, markDirty)` and requires the origin to move by exactly 64
 *      with the player's global tile preserved, and pins EDGE_MARGIN/SLIDE_STEP by reading them
 *      out of continuity.ts source text.
 *   3. Builds a global foot-passability mosaic of the WHOLE frame from compiled windows on that
 *      lattice. Every cell is read through the engine's own collision grid (`blockGrid` of a real
 *      run in that window), and each cell keeps the reading from the window where it is most
 *      interior (largest distance to a window edge) so seam artefacts cannot decide a route.
 *   4. Measures, cell by cell, whether overlapping windows AGREE — the tile-by-tile window
 *      agreement question this repo has never answered. A separate pass compares full 136-tile
 *      overlaps of real 64-stride neighbour pairs (including origins that are not multiples of the
 *      mosaic stride), and every mosaic overlap is counted too.
 *   5. Runs BFS from the legal start under three predicates, all derived from the engine's own
 *      movement rule `blockedAt` (blocks classes {1,2,3,5,6}, so free = {0,4}):
 *         foot      : class 0 or 4            (exactly `!blockedAt`; wading allowed, as in the
 *                                              engine's own `spawnWindowExitReachMask`)
 *         dry       : class 0 and the tile is not DEEP/SHALLOW/RIVER
 *         footDoors : foot, plus class-3 cells that are real POI door tiles (a walking player can
 *                                              open a door; `blockedAt` alone cannot express that)
 *   6. For each target reports reachability, shortest-path length in tiles/AU, the hazard and
 *      water composition OF THE PATH, how many window slides the walk needs (simulated with the
 *      real continuity rule), and an arithmetic walk-time estimate at BAL.player.speed.
 *
 * What it does NOT claim — read this before quoting any number
 *   - GEOMETRY ONLY. A reachable path proves the collision graph connects two tiles. It says
 *     nothing about surviving the walk: no hunger/thirst/warmth/radiation, no TOXIC/ASH/LAVA
 *     damage, no creatures, no stamina, no 14-day clock, no fuel, no ferry/vehicle, no return trip.
 *     Hazard composition along the path is reported precisely so the reader can see what a
 *     survival analysis would have to account for.
 *   - The mosaic reads PRISTINE compiled windows (no run deltas). A real walk writes deltas
 *     (depletion, terrain edits, opened doors, fog), which can only be assessed by playing it.
 *   - Windows are read with a QA inspection landing purely so a real RunState (and therefore the
 *     real `blockGrid`) exists in each window. `qaUsed` landings are never playable evidence; the
 *     ONLY player-route fact here is the start, which is a genuine normal start.
 *   - Software-rendered test environment, fixture build. Not a release-readiness claim.
 *
 * Run (this is what produced the committed manifest: the FULL 64-tile lattice, 2460 windows, 476 s):
 *   SOH_FOOT_REACHABILITY=1 SOH_FOOT_STRIDE=64 SOH_FOOT_SEEDS=901,902,903 SOH_FOOT_PAIRS=6 \
 *     npx vitest run --fileParallelism=false --testTimeout=3600000 \
 *     src/veyra05/global-foot-reachability.audit.test.ts
 * SOH_FOOT_STRIDE must be a multiple of the 64-tile slide step and smaller than the window. The
 * default 128 is a cheaper run that samples every OTHER lattice origin, so it reads fewer windows
 * per cell and its optimistic/conservative bounds are weaker; only stride 64 reads every window the
 * game can actually occupy. Probe (region-limited, no BFS): add SOH_FOOT_REGION=x0,y0,x1,y1.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { T, TERRAIN_NAME, WW, WH, TILE } from '../game/core';
import { C, blockGrid, blockedAt, clearInteraction, effTile, g1bGateOf, markDirty, newGame, startRun } from '../game/engine';
import { findInteract } from '../game/sim';
import { getWorld, setActiveLayout } from '../game/world';
import { getWindowWorld, getVeyraPlacementRules, resetWindowToGround, setVeyraPlacementRules } from './window';
import { U05_WORLD_LAYOUT_ID, VEYRA05_SCENES, layoutIdAt } from './scenes';
import { FRAME_H, FRAME_W, auToTile } from './frame';
import { maybeSlideVeyraWindow, playerGlobalTile, windowOrigin } from './continuity';
import { G1B_FIXTURES, G1B_GATES } from '../game/g1b-sources.generated';
import { REST48_SITES } from './arch/rest48';
import { f03Profiles } from './arch/f03';

type Entry = Record<string, unknown>;
type Gs = ReturnType<typeof newGame>;

const root = path.resolve(process.cwd(), 'evidence/veyra-foot-reachability');
const output = path.join(root, 'manifest.json');
const EPOCH = Date.UTC(2026, 10, 18, 12);
const N = FRAME_W * FRAME_H;                                   // 4000 x 2800 = 11,200,000 cells
const SEEDS = String(process.env.SOH_FOOT_SEEDS || '901,902,903').split(',').map(s => Number(s.trim())).filter(Number.isFinite);
const STRIDE = Number(process.env.SOH_FOOT_STRIDE || '128');    // must be a multiple of the 64-tile slide step and < window size
const REGION = process.env.SOH_FOOT_REGION ? String(process.env.SOH_FOOT_REGION).split(',').map(Number) : null;
const PAIR_SAMPLES = Number(process.env.SOH_FOOT_PAIRS || '6');
const TARGET_RADIUS = Number(process.env.SOH_FOOT_TARGET_RADIUS || '48');
const WET = new Set<number>([T.DEEP, T.SHALLOW, T.RIVER]);
/** Class written for cells inside a window that could not be compiled at all (no walkable terrain).
 *  Conservatively impassable: it can only ever reduce reachability, never invent a route. */
const UNREADABLE_CLASS = 9;
const FOOT_BIT = 1, DRY_BIT = 2, DOOR_BIT = 4;
/** Passability bits of one window reading of one cell, derived from the engine class. */
function bitsFor(c: number, t: number, d: number): number {
  const foot = c === 0 || c === 4;
  const dry = c === 0 && !WET.has(t);
  const doors = foot || (c === 3 && d === 1);
  return (foot ? FOOT_BIT : 0) | (dry ? DRY_BIT : 0) | (doors ? DOOR_BIT : 0);
}
const MARGIN_BUCKETS = ['0-2', '3-7', '8-23', '24-63', '64+'] as const;
function marginBucket(m: number): string {
  return m <= 2 ? '0-2' : m <= 7 ? '3-7' : m <= 23 ? '8-23' : m <= 63 ? '24-63' : '64+';
}
const HAZARD = new Set<number>([T.TOXIC, T.ASH, T.LAVA]);

/** The slide rule is module-private in continuity.ts, so it is read out of the source text and
 *  pinned: if the streaming step or the edge margin ever changes, this audit goes red instead of
 *  silently reporting reachability over a lattice the game no longer uses. */
function readContinuityConstants() {
  const file = path.resolve(process.cwd(), 'src/veyra05/continuity.ts');
  const src = fs.readFileSync(file, 'utf8');
  const step = Number(/const\s+SLIDE_STEP\s*=\s*(\d+)/.exec(src)?.[1] ?? NaN);
  const margin = Number(/const\s+EDGE_MARGIN\s*=\s*(\d+)/.exec(src)?.[1] ?? NaN);
  const clamped = /clamp\(ox \+ reqDx, 0, FRAME_W - WW\)/.test(src) && /clamp\(oy \+ reqDy, 0, FRAME_H - WH\)/.test(src);
  return { file: 'src/veyra05/continuity.ts', slideStep: step, edgeMargin: margin, originClampedToFrame: clamped };
}
const CONTINUITY = readContinuityConstants();
const SLIDE_STEP = CONTINUITY.slideStep;
const EDGE_MARGIN = CONTINUITY.edgeMargin;

const manifest: Entry = {
  schema: 'veyra-global-foot-reachability-v1',
  executedAt: new Date().toISOString(),
  engineRevision: process.env.SOH_ENGINE_REVISION ?? 'working tree',
  scope: 'GEOMETRY ONLY — collision-graph connectivity. No survival, hazard tolerance, hunger/thirst/warmth, creature, stamina, clock, vehicle/ferry or return-trip model.',
  frame: { FRAME_W, FRAME_H, cells: N, WINDOW_W: WW, WINDOW_H: WH, TILE_PX: TILE, AU_PER_TILE: 0.5 },
  continuityRule: { ...CONTINUITY, note: 'The window slides by SLIDE_STEP tiles when the player comes within EDGE_MARGIN tiles of an interior edge; origins are clamped to [0, FRAME-WINDOW].' },
  predicates: {
    foot: 'blockGrid class 0 or 4 — exactly the engine movement rule !blockedAt (blockedAt blocks {1,2,3,5,6}); wading allowed, same predicate as engine spawnWindowExitReachMask',
    dry: 'blockGrid class 0 and tile not in {DEEP, SHALLOW, RIVER}',
    footDoors: 'foot, plus class-3 cells that are real POI door tiles (a walking player can open a door)',
    source: 'per-cell class read from the engine blockGrid of a real RunState in the covering window',
  },
  config: { seeds: SEEDS, stride: STRIDE, regionLimit: REGION, pairSamples: PAIR_SAMPLES, targetRadius: TARGET_RADIUS, partialRegionRun: !!REGION },
  notes: [
    'Mosaic cells are PRISTINE compiled windows with no run deltas; each cell keeps the reading from the window where it is most interior.',
    'Windows are entered with a QA inspection landing (qaUsed=true) only so the real collision grid exists; the single player-route fact is the normal start, which must have qaUsed=false.',
    'A reachable path is NOT a survivable route and NOT a playable claim; hazard and water composition of every path is reported so the survival question stays visible.',
    'Software-rendered fixture build in a test environment: never release-readiness evidence.',
  ],
};

function save() {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
}

/** Lattice of window origins the game can actually occupy: multiples of the slide step, plus the
 *  clamped frame extreme. The mosaic stride must be a multiple of the slide step and smaller than
 *  the window, so consecutive windows overlap and no column or row is left uncovered. */
function originLattice(maxOrigin: number, stride: number): number[] {
  const out: number[] = [];
  for (let o = 0; o + stride <= maxOrigin; o += stride) out.push(o);
  const last = out.length ? out[out.length - 1] : 0;
  // Never leave a gap wider than the window before the clamped extreme origin.
  if (maxOrigin - last > WW) out.push(Math.max(last + stride, maxOrigin - stride));
  out.push(maxOrigin);
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Landing point chosen with the engine's own `inspectAt` criteria (walkable, not a solid prop, not
 *  DEEP/SHALLOW/RIVER/CLIFF/PWALL/LAVA, inside the safety margin), searched outward from the window
 *  centre. Returns null only if the window has no such cell at all. */
function pickLanding(layoutId: string): [number, number] | null {
  const ww = getWindowWorld(layoutId);
  const w = ww.world;
  const solid = ww.floors.ground.solidProps;
  const blocked = new Set<number>([T.DEEP, T.SHALLOW, T.RIVER, T.CLIFF, T.PWALL, T.LAVA]);
  const cx = WW >> 1, cy = WH >> 1;
  for (let radius = 0; radius <= Math.max(cx, cy); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const tx = cx + dx, ty = cy + dy;
        if (tx <= 2 || ty <= 2 || tx >= WW - 3 || ty >= WH - 3) continue;
        const i = ty * WW + tx;
        if (solid[i] || !w.economyMap.walkable[i] || blocked.has(w.tiles[i])) continue;
        return [tx, ty];
      }
    }
  }
  return null;
}

interface WindowRead {
  ok: boolean;
  reason: string | null;
  layoutId: string;
  origin: [number, number];
  ms: number;
  landing: [number, number] | null;
  cls: Uint8Array | null;
  tile: Uint8Array | null;
  door: Uint8Array | null;
  haz: Uint8Array | null;
}

/** Compile one window and read the engine's own collision grid for it. The QA landing exists only
 *  so a real RunState (and therefore the real `blockGrid`) exists in this window; it is never
 *  treated as a player route. */
function readWindow(layoutId: string, seed: number, origin: [number, number]): WindowRead {
  const t0 = performance.now();
  const base: WindowRead = { ok: false, reason: null, layoutId, origin, ms: 0, landing: null, cls: null, tile: null, door: null, haz: null };
  if (!setActiveLayout(layoutId)) return { ...base, reason: 'layout unavailable', ms: performance.now() - t0 };
  // A window can legitimately fail to compile: buildWindowWorld throws "No walkable terrain in this
  // Veyra window" for all-water/all-cliff slices, which is exactly why chooseGlobalVeyraStart wraps
  // its own compile in try/catch and treats such a window as an ineligible candidate. Recorded, not
  // swallowed: those cells are marked impassable in the mosaic.
  let landing: [number, number] | null = null;
  try {
    resetWindowToGround(getWindowWorld(layoutId));
    landing = pickLanding(layoutId);
  } catch (e) {
    return { ...base, reason: `compile threw: ${String((e as Error)?.message ?? e)}`, ms: performance.now() - t0 };
  }
  if (!landing) return { ...base, reason: 'no cell satisfies the engine inspectAt landing criteria', ms: performance.now() - t0 };
  const gs = newGame();
  const res = startRun(gs, 'female', EPOCH, null, seed, { tx: landing[0], ty: landing[1] }) as { ok: boolean; reason?: string };
  if (!res.ok || !gs.run) return { ...base, reason: res.reason ?? 'no run', ms: performance.now() - t0 };
  const r = gs.run;
  setActiveLayout(layoutId);
  markDirty();
  const grid = blockGrid(r);
  const w = getWorld();
  const n = WW * WH;
  const cls = new Uint8Array(n);
  const tile = new Uint8Array(n);
  const door = new Uint8Array(n);
  const haz = new Uint8Array(n);
  cls.set(grid);
  for (let i = 0; i < n; i++) {
    tile[i] = w.tiles[i];
    if (HAZARD.has(effTile(r, i % WW, (i / WW) | 0))) haz[i] = 1;
  }
  for (const s of w.statics) if (s.kind === 'door' && s.tx >= 0 && s.ty >= 0 && s.tx < WW && s.ty < WH) door[s.ty * WW + s.tx] = 1;
  r.ended = { at: EPOCH, reason: 'foot reachability audit cleanup' } as never;
  return { ok: true, reason: null, layoutId, origin, ms: performance.now() - t0, landing, cls, tile, door, haz };
}

describe('Global foot-reachability audit (geometry only, read-only)', () => {
  it.skipIf(process.env.SOH_FOOT_REACHABILITY !== '1')(
    'builds a global foot-passability mosaic from real window collision grids and measures walking routes from a legal normal start to authored progression targets',
    () => {
      expect(CONTINUITY.slideStep, 'continuity.ts SLIDE_STEP must be readable and positive').toBeGreaterThan(0);
      expect(CONTINUITY.edgeMargin, 'continuity.ts EDGE_MARGIN must be readable and positive').toBeGreaterThan(0);
      expect(CONTINUITY.originClampedToFrame, 'continuity.ts must still clamp slide origins to the frame').toBe(true);
      expect(SLIDE_STEP, 'the slide step must divide the mosaic stride, otherwise the mosaic uses origins the game never occupies').toBeGreaterThan(0);
      expect(STRIDE % SLIDE_STEP, `mosaic stride ${STRIDE} must be a multiple of slide step ${SLIDE_STEP}`).toBe(0);
      expect(STRIDE < WW, `mosaic stride ${STRIDE} must be smaller than the window width ${WW} so the frame is covered without gaps`).toBe(true);

      // ---------- 1. A real normal start (the only player-route fact in this audit) ----------
      const maxX = FRAME_W - WW, maxY = FRAME_H - WH;   // continuity clamps slide origins to these
      setVeyraPlacementRules(4);                 // engine: every NEW Veyra run is created under rules 4
      const starts: Entry[] = [];
      let startGs: Gs | null = null;
      let startGlobal: [number, number] | null = null;
      let startOrigin: [number, number] | null = null;
      for (const seed of SEEDS) {
        if (!setActiveLayout(U05_WORLD_LAYOUT_ID)) { starts.push({ seed, ok: false, reason: 'layout unavailable' }); continue; }
        const gs = newGame();
        const res = startRun(gs, 'female', EPOCH, null, seed) as { ok: boolean; reason?: string };
        const r = gs.run;
        const origin = r ? windowOrigin(r) : null;
        const global = r ? playerGlobalTile(r) : null;
        starts.push({
          seed, ok: !!res.ok, reason: res.reason ?? null,
          requestedLayout: U05_WORLD_LAYOUT_ID,
          runLayoutId: r?.layoutId ?? null,
          windowOrigin: origin, playerGlobalTile: global,
          qaUsed: r?.qaUsed ?? null,
          windowOriginIsOnSlideLattice: origin ? origin[0] % SLIDE_STEP === 0 && origin[1] % SLIDE_STEP === 0 : null,
        });
        if (res.ok && r && !startGs && r.qaUsed === false) { startGs = gs; startGlobal = global; startOrigin = origin; }
        else if (r && r !== startGs?.run) r.ended = { at: EPOCH, reason: 'foot reachability audit cleanup' } as never;
      }
      manifest.normalStarts = starts;
      manifest.placementRules = getVeyraPlacementRules();
      expect(startGs?.run, `at least one seed must produce a genuine normal start on ${U05_WORLD_LAYOUT_ID}`).toBeTruthy();
      expect(startGs!.run!.qaUsed, 'the BFS source must be a player-route start, never a QA landing').toBe(false);
      expect(startOrigin, 'the start window origin must be readable').toBeTruthy();
      expect(startOrigin![0] % SLIDE_STEP, 'the discovered start origin must sit on the slide lattice (multiples of SLIDE_STEP)').toBe(0);
      expect(startOrigin![1] % SLIDE_STEP, 'the discovered start origin must sit on the slide lattice (multiples of SLIDE_STEP)').toBe(0);
      save();

      // ---------- 2. The slide mechanism itself, exercised through the real game entry point ----------
      // The lattice the mosaic uses must be the lattice a walking player actually occupies, so the
      // real trigger (`maybeSlideVeyraWindow`, called by the game each tick) is exercised once from
      // the legal start. If that start happens to sit in the window interior, the player position is
      // moved to within EDGE_MARGIN of an edge — a position-only manipulation that simulates having
      // walked there; no world content, source, terrain or entity is modified.
      {
        const r0 = startGs!.run!;
        const expectedShift = (ox: number, oy: number, ltx: number, lty: number): [number, number] => {
          let sx = 0, sy = 0;
          if (ltx < EDGE_MARGIN && ox > 0) sx = -SLIDE_STEP;
          else if (ltx >= WW - EDGE_MARGIN && ox < maxX) sx = SLIDE_STEP;
          if (lty < EDGE_MARGIN && oy > 0) sy = -SLIDE_STEP;
          else if (lty >= WH - EDGE_MARGIN && oy < maxY) sy = SLIDE_STEP;
          return [sx, sy];
        };
        const beforeOrigin = windowOrigin(r0);
        let beforeGlobal = playerGlobalTile(r0);
        let nudge: Entry | null = null;
        let [sx, sy] = expectedShift(beforeOrigin[0], beforeOrigin[1], beforeGlobal[0] - beforeOrigin[0], beforeGlobal[1] - beforeOrigin[1]);
        if (sx === 0 && sy === 0) {
          const from = { x: r0.player.x, y: r0.player.y, globalTile: beforeGlobal };
          r0.player.x = 10 * TILE + 8;                     // local tile 10: inside the 24-tile edge margin
          markDirty();
          beforeGlobal = playerGlobalTile(r0);
          nudge = { reason: 'the legal start sat in the window interior, so the player position was moved near an edge to exercise the real slide trigger', from, toLocalTileX: 10, toGlobalTile: beforeGlobal };
          [sx, sy] = expectedShift(beforeOrigin[0], beforeOrigin[1], beforeGlobal[0] - beforeOrigin[0], beforeGlobal[1] - beforeOrigin[1]);
        }
        const slid = maybeSlideVeyraWindow(startGs!, markDirty);
        const afterOrigin = windowOrigin(r0);
        const afterGlobal = playerGlobalTile(r0);
        manifest.slideMechanism = {
          called: 'maybeSlideVeyraWindow(gs, markDirty) — the function the game calls each tick',
          returned: slid,
          expectedShiftFromContinuityRule: [sx, sy],
          originBefore: beforeOrigin, originAfter: afterOrigin,
          originDelta: [afterOrigin[0] - beforeOrigin[0], afterOrigin[1] - beforeOrigin[1]],
          playerGlobalTileBefore: beforeGlobal, playerGlobalTileAfter: afterGlobal,
          playerGlobalTileDelta: [afterGlobal[0] - beforeGlobal[0], afterGlobal[1] - beforeGlobal[1]],
          playerPositionNudged: nudge,
          runLayoutIdAfter: r0.layoutId,
          expectedLayoutIdAfter: layoutIdAt(Math.max(0, Math.min(maxX, beforeOrigin[0] + sx)), Math.max(0, Math.min(maxY, beforeOrigin[1] + sy))),
          note: 'Proves the mosaic lattice is the real streaming lattice: origins move in SLIDE_STEP quanta and the player global tile is preserved across the boundary.',
        };
        expect(slid, 'the real slide trigger must move the window from a legal start position near an edge').toBe(true);
        expect(afterOrigin[0] - beforeOrigin[0], 'the origin must move by exactly the slide step the continuity rule asks for (x)').toBe(sx);
        expect(afterOrigin[1] - beforeOrigin[1], 'the origin must move by exactly the slide step the continuity rule asks for (y)').toBe(sy);
        expect(afterGlobal[0] - beforeGlobal[0], 'the player global tile must be preserved across a window shift (x)').toBe(0);
        expect(afterGlobal[1] - beforeGlobal[1], 'the player global tile must be preserved across a window shift (y)').toBe(0);
        expect(r0.layoutId, 'the run layout must become the inspector id of the new origin').toBe(layoutIdAt(afterOrigin[0], afterOrigin[1]));
        r0.ended = { at: EPOCH, reason: 'foot reachability audit cleanup' } as never;
      }
      save();

      // ---------- 3. Lattice ----------
      let xs = originLattice(maxX, STRIDE);
      let ys = originLattice(maxY, STRIDE);
      if (REGION) {
        const [rx0, ry0, rx1, ry1] = REGION;
        xs = xs.filter(ox => ox + WW > rx0 && ox < rx1);
        ys = ys.filter(oy => oy + WH > ry0 && oy < ry1);
      }
      const maxGapX = Math.max(...xs.slice(1).map((v, i) => v - xs[i]));
      const maxGapY = Math.max(...ys.slice(1).map((v, i) => v - ys[i]));
      manifest.lattice = {
        stride: STRIDE, slideStep: SLIDE_STEP,
        originsX: xs.length, originsY: ys.length, windows: xs.length * ys.length,
        firstX: xs[0], lastX: xs[xs.length - 1], firstY: ys[0], lastY: ys[ys.length - 1],
        maxGapX, maxGapY,
        fullFrame: !REGION && xs[0] === 0 && ys[0] === 0 && xs[xs.length - 1] === maxX && ys[ys.length - 1] === maxY,
      };
      expect(maxGapX < WW, 'consecutive x origins must overlap, otherwise the mosaic has uncovered columns').toBe(true);
      expect(maxGapY < WH, 'consecutive y origins must overlap, otherwise the mosaic has uncovered rows').toBe(true);
      save();

      // ---------- 4. Window agreement on real 64-stride neighbour overlaps ----------
      // Samples deliberately include origins that are NOT multiples of the mosaic stride, so the
      // agreement measurement covers the lattice the game occupies rather than only the mosaic's.
      const anchorTiles: [number, number][] = [
        startGlobal!,
        [2402, 1843],                                  // purple card fixture (po_slag)
        [REST48_SITES.po_surtur.cx, REST48_SITES.po_surtur.cy],
      ];
      const pairRecords: Entry[] = [];
      {
        const clampO = (v: number, max: number) => Math.max(0, Math.min(max - SLIDE_STEP, Math.round(v / SLIDE_STEP) * SLIDE_STEP));
        let made = 0;
        for (let k = 0; k < PAIR_SAMPLES && made < PAIR_SAMPLES; k++) {
          const anchor = anchorTiles[k % anchorTiles.length];
          // Offstride on purpose: shift the sampled origin by one slide step so it is not a
          // multiple of STRIDE when STRIDE > SLIDE_STEP.
          const jitter = (k % 3) * SLIDE_STEP;
          const ox = clampO(anchor[0] - WW / 2 + jitter, maxX);
          const oy = clampO(anchor[1] - WH / 2 + jitter, maxY);
          for (const axis of ['x', 'y'] as const) {
            const a: [number, number] = [ox, oy];
            const b: [number, number] = axis === 'x' ? [Math.min(maxX, ox + SLIDE_STEP), oy] : [ox, Math.min(maxY, oy + SLIDE_STEP)];
            if (a[0] === b[0] && a[1] === b[1]) continue;
            const ra = readWindow(layoutIdAt(a[0], a[1]), SEEDS[0], a);
            const rb = readWindow(layoutIdAt(b[0], b[1]), SEEDS[0], b);
            if (!ra.ok || !rb.ok) { pairRecords.push({ axis, originA: a, originB: b, ok: false, reasonA: ra.reason, reasonB: rb.reason }); continue; }
            const x0 = Math.max(a[0], b[0]), x1 = Math.min(a[0], b[0]) + WW;
            const y0 = Math.max(a[1], b[1]), y1 = Math.min(a[1], b[1]) + WH;
            let compared = 0, classMismatch = 0, tileMismatch = 0;
            const buckets: Record<string, number> = Object.fromEntries(MARGIN_BUCKETS.map(b => [b, 0]));
            const pairs: Record<string, number> = {};
            const examples: Entry[] = [];
            for (let gy = y0; gy < y1; gy++) {
              for (let gx = x0; gx < x1; gx++) {
                const ia = (gy - a[1]) * WW + (gx - a[0]);
                const ib = (gy - b[1]) * WW + (gx - b[0]);
                compared++;
                const dc = ra.cls![ia] !== rb.cls![ib];
                const dt = ra.tile![ia] !== rb.tile![ib];
                if (dc) {
                  classMismatch++;
                  const mA = Math.min(gx - a[0], gy - a[1], WW - 1 - (gx - a[0]), WH - 1 - (gy - a[1]));
                  const mB = Math.min(gx - b[0], gy - b[1], WW - 1 - (gx - b[0]), WH - 1 - (gy - b[1]));
                  buckets[marginBucket(Math.min(mA, mB))]++;
                  const key = `${ra.cls![ia]}->${rb.cls![ib]}`;
                  pairs[key] = (pairs[key] ?? 0) + 1;
                }
                if (dt) tileMismatch++;
                if ((dc || dt) && examples.length < 8) {
                  examples.push({
                    gx, gy,
                    classFromA: ra.cls![ia], classFromB: rb.cls![ib],
                    tileFromA: TERRAIN_NAME[ra.tile![ia]] ?? ra.tile![ia], tileFromB: TERRAIN_NAME[rb.tile![ib]] ?? rb.tile![ib],
                    marginInA: Math.min(gx - a[0], gy - a[1], WW - 1 - (gx - a[0]), WH - 1 - (gy - a[1])),
                    marginInB: Math.min(gx - b[0], gy - b[1], WW - 1 - (gx - b[0]), WH - 1 - (gy - b[1])),
                  });
                }
              }
            }
            pairRecords.push({
              axis, originA: a, originB: b, ok: true,
              layoutA: ra.layoutId, layoutB: rb.layoutId,
              originAOnMosaicStride: a[0] % STRIDE === 0 && a[1] % STRIDE === 0,
              overlapCells: compared, overlapWidth: x1 - x0, overlapHeight: y1 - y0,
              classMismatches: classMismatch, tileMismatches: tileMismatch,
              classMismatchShare: Number((classMismatch / Math.max(1, compared)).toFixed(6)),
              classMismatchByMarginBucket: buckets, classMismatchClassPairs: pairs, examples,
            });
            made++;
          }
        }
      }
      manifest.windowAgreementPairs = pairRecords;
      manifest.windowAgreement = {
        pairs: pairRecords.filter(p => p.ok).length,
        overlapCellsCompared: pairRecords.reduce((a: number, p: Entry) => a + Number(p.overlapCells ?? 0), 0),
        classMismatches: pairRecords.reduce((a: number, p: Entry) => a + Number(p.classMismatches ?? 0), 0),
        tileMismatches: pairRecords.reduce((a: number, p: Entry) => a + Number(p.tileMismatches ?? 0), 0),
        classMismatchShare: Number((pairRecords.reduce((a: number, p: Entry) => a + Number(p.classMismatches ?? 0), 0)
          / Math.max(1, pairRecords.reduce((a: number, p: Entry) => a + Number(p.overlapCells ?? 0), 0))).toFixed(6)),
        classMismatchByMarginBucket: MARGIN_BUCKETS.reduce((acc: Entry, b) => {
          acc[b] = pairRecords.reduce((a: number, p: Entry) => a + Number((p.classMismatchByMarginBucket as Entry | undefined)?.[b] ?? 0), 0);
          return acc;
        }, {}),
        interpretation: 'A mismatch means the SAME global tile compiles to a different engine collision class in two windows that both cover it, i.e. the continuous world is not perfectly origin-independent. The margin buckets say whether that is a window-seam artefact (margin 0-2) or spread through the overlap.',
        note: 'Full-overlap comparison of real 64-tile-stride neighbour windows (136x200 or 200x136 cells each), read through the engine collision grid of a real run in each window.',
      };
      save();

      // ---------- 5. Mosaic (with optimistic/conservative bounds over window disagreement) ----------
      const cls = new Uint8Array(N);        // 0 = no reading yet; classes are stored +1
      const tile = new Uint8Array(N);
      const door = new Uint8Array(N);
      const haz = new Uint8Array(N);
      const bestMargin = new Uint8Array(N);
      const readings = new Uint8Array(N);   // how many windows reported this cell
      const anyBits = new Uint8Array(N);    // passable in AT LEAST ONE covering window
      const allBits = new Uint8Array(N);    // passable in EVERY covering window
      const overlapDisagreements: Entry[] = [];
      let overlapCompared = 0, overlapClassMismatch = 0, repeatReadings = 0, disagreeCells = 0;
      let reads = 0, failedReads = 0;
      const readMs: number[] = [];
      const unreadable: Entry[] = [];
      const failedRects: [number, number][] = [];
      manifest.unreadableWindows = unreadable;
      const mosaicBuckets: Record<string, number> = Object.fromEntries(MARGIN_BUCKETS.map(b => [b, 0]));
      const mosaicClassPairs: Record<string, number> = {};
      const mosaicTerrainPairs: Record<string, number> = {};
      const t0mosaic = performance.now();
      for (const oy of ys) {
        for (const ox of xs) {
          const layoutId = layoutIdAt(ox, oy);
          const rd = readWindow(layoutId, SEEDS[0], [ox, oy]);
          reads++;
          readMs.push(rd.ms);
          if (!rd.ok || !rd.cls) {
            failedReads++;
            failedRects.push([ox, oy]);
            unreadable.push({ layoutId, origin: [ox, oy], reason: rd.reason });
            continue;
          }
          for (let ly = 0; ly < WH; ly++) {
            const gy = oy + ly;
            if (gy >= FRAME_H) break;
            const rowG = gy * FRAME_W;
            const rowL = ly * WW;
            for (let lx = 0; lx < WW; lx++) {
              const gx = ox + lx;
              if (gx >= FRAME_W) break;
              const gi = rowG + gx;
              const i = rowL + lx;
              const wc = rd.cls, wt = rd.tile!, wd = rd.door!, wh = rd.haz!;
              const c: number = wc[i];
              const t: number = wt[i];
              const d: number = wd[i];
              const bits = bitsFor(c, t, d);
              const m = Math.min(lx, ly, WW - 1 - lx, WH - 1 - ly) + 1;   // 1..100, larger = more interior
              if (readings[gi] === 0) {
                readings[gi] = 1;
                bestMargin[gi] = m;
                cls[gi] = c + 1;
                tile[gi] = t;
                door[gi] = d;
                haz[gi] = wh[i];
                anyBits[gi] = bits;
                allBits[gi] = bits;
                continue;
              }
              readings[gi]++;
              repeatReadings++;
              overlapCompared++;
              anyBits[gi] |= bits;
              allBits[gi] &= bits;
              if (cls[gi] !== c + 1) {
                overlapClassMismatch++;
                disagreeCells++;
                mosaicBuckets[marginBucket(Math.min(bestMargin[gi], m))]++;
                const ck = `${cls[gi] - 1}->${c}`;
                mosaicClassPairs[ck] = (mosaicClassPairs[ck] ?? 0) + 1;
                const tk = `${TERRAIN_NAME[tile[gi]] ?? tile[gi]}<->${TERRAIN_NAME[t] ?? t}`;
                mosaicTerrainPairs[tk] = (mosaicTerrainPairs[tk] ?? 0) + 1;
                if (overlapDisagreements.length < 16) {
                  overlapDisagreements.push({
                    gx, gy, keptClass: cls[gi] - 1, newClass: c, keptMargin: bestMargin[gi], newMargin: m, readings: readings[gi],
                    newWindow: layoutId, keptTile: TERRAIN_NAME[tile[gi]] ?? tile[gi], newTile: TERRAIN_NAME[t] ?? t,
                  });
                }
              }
              if (m > bestMargin[gi]) {
                bestMargin[gi] = m;
                cls[gi] = c + 1;
                tile[gi] = t;
                door[gi] = d;
                haz[gi] = wh[i];
              }
            }
          }
        }
        save();   // checkpoint per row so a long run is never all-or-nothing
      }
      // Cells no readable window covers (inside windows whose compile threw, e.g. all-water slices)
      // are marked with UNREADABLE_CLASS: conservatively impassable, never silently walkable.
      let sentinelCells = 0;
      for (const [ox, oy] of failedRects) {
        for (let ly = 0; ly < WH; ly++) {
          const gy = oy + ly;
          if (gy >= FRAME_H) break;
          for (let lx = 0; lx < WW; lx++) {
            const gx = ox + lx;
            if (gx >= FRAME_W) break;
            const gi = gy * FRAME_W + gx;
            if (readings[gi] === 0) { readings[gi] = 1; bestMargin[gi] = 1; cls[gi] = UNREADABLE_CLASS + 1; tile[gi] = T.DEEP; anyBits[gi] = 0; allBits[gi] = 0; sentinelCells++; }
          }
        }
      }
      let uncovered = 0, multiReadCells = 0;
      const classHistogram: Record<string, number> = {};
      const histCount = new Array(12).fill(0);
      const readCountHist: Record<string, number> = {};
      let wetCells = 0, hazardCells = 0, doorCells = 0, cellsWithAnyReading = 0;
      for (let gi = 0; gi < N; gi++) {
        if (readings[gi] === 0) { uncovered++; continue; }
        cellsWithAnyReading++;
        const c = cls[gi] - 1;
        histCount[c] = (histCount[c] ?? 0) + 1;
        if (c === 4 || WET.has(tile[gi])) wetCells++;
        if (haz[gi]) hazardCells++;
        if (door[gi]) doorCells++;
        if (readings[gi] > 1) multiReadCells++;
        const rk = `readings${readings[gi]}`;
        readCountHist[rk] = (readCountHist[rk] ?? 0) + 1;
      }
      for (let c = 0; c < histCount.length; c++) if (histCount[c]) classHistogram[`class${c}`] = histCount[c];
      readMs.sort((a, b) => a - b);
      manifest.mosaic = {
        windows: reads, unreadableWindows: failedReads, unreadableReasons: [...new Set(unreadable.map(u => String(u.reason)))],
        cellsMarkedImpassableBecauseNoWindowCompiled: sentinelCells, unreadableClass: UNREADABLE_CLASS,
        coverageCells: cellsWithAnyReading, uncoveredCells: uncovered,
        coverageShare: Number((cellsWithAnyReading / N).toFixed(6)),
        fullFrame: !REGION,
        stride: STRIDE,
        overlapComparisons: overlapCompared, overlapClassMismatches: overlapClassMismatch,
        overlapClassMismatchShare: Number((overlapClassMismatch / Math.max(1, overlapCompared)).toFixed(6)),
        cellsWithMoreThanOneReading: multiReadCells, additionalReadingsCompared: repeatReadings, disagreeingReadings: disagreeCells,
        classMismatchByMarginBucket: mosaicBuckets,
        classMismatchClassPairs: mosaicClassPairs,
        classMismatchTerrainPairs: Object.fromEntries(Object.entries(mosaicTerrainPairs).sort((a, b) => b[1] - a[1]).slice(0, 16)),
        overlapDisagreementExamples: overlapDisagreements,
        classHistogram, readingsHistogram: readCountHist,
        wetOrWaterCells: wetCells, hazardCells, doorCells,
        perWindowReadMs: { min: readMs[0] ?? null, median: readMs[readMs.length >> 1] ?? null, max: readMs[readMs.length - 1] ?? null, total: Number(readMs.reduce((a, b) => a + b, 0).toFixed(1)) },
        mosaicMs: Number((performance.now() - t0mosaic).toFixed(1)),
        cellRule: 'each cell keeps the class/terrain reading from the window where it is most interior (largest distance to a window edge); passability is additionally tracked as ANY-window and EVERY-window bounds',
      };
      save();
      if (!REGION) expect(uncovered, 'every frame cell must be covered by the mosaic').toBe(0);

      if (REGION) {
        manifest.bfs = 'SKIPPED_REGION_PROBE';
        save();
        return;
      }

      // ---------- 6. Predicate equivalence with the engine's own movement rule ----------
      // Verify, in a real run, that class {0,4} is exactly "!blockedAt" — the mosaic predicate must
      // be the engine's movement predicate, not an invented one.
      {
        const layoutId = layoutIdAt(startOrigin![0], startOrigin![1]);
        setActiveLayout(layoutId);
        const gs = newGame();
        const res = startRun(gs, 'female', EPOCH, null, SEEDS[0], { tx: 100, ty: 100 }) as { ok: boolean; reason?: string };
        expect(res.ok, 'the predicate check window must be enterable for diagnosis').toBe(true);
        const r = gs.run!;
        markDirty();
        const grid = blockGrid(r);
        const perClass: Record<string, { cells: number; blocked: number }> = {};
        let mismatches = 0;
        for (let y = 3; y < WH - 3; y++) {
          for (let x = 3; x < WW - 3; x++) {
            const i = y * WW + x;
            const c = grid[i];
            const key = `class${c}`;
            (perClass[key] ??= { cells: 0, blocked: 0 });
            perClass[key].cells++;
            const blocked = blockedAt(r, x, y);
            if (blocked) perClass[key].blocked++;
            if (blocked !== (c === 1 || c === 2 || c === 3 || c === 5 || c === 6)) mismatches++;
          }
        }
        manifest.predicateEquivalence = {
          window: layoutId, cellsChecked: Object.values(perClass).reduce((a, b) => a + b.cells, 0),
          mismatches, perClass,
          rule: 'blockedAt(r,x,y) === (class in {1,2,3,5,6}); therefore free = class {0,4}, which is the mosaic foot predicate',
        };
        expect(mismatches, 'the mosaic foot predicate must equal the engine movement predicate blockedAt').toBe(0);
        gs.run!.ended = { at: EPOCH, reason: 'foot reachability audit cleanup' } as never;
        save();
      }

      // ---------- 6b. The targets are really there: live-run deployment, E prompt and card gate ----------
      // Geometry alone would leave two gaps: (a) is the purple card actually DEPLOYED as an entity a
      // player can open, on the ground floor, at the tile the route reaches; (b) does any real door
      // declare a purple-card lock (the pre-G1B ledger note says none does). Both are checked with
      // the engine's own runtime, in QA-entered runs, labelled as such.
      function windowCovering(gx: number, gy: number): { layoutId: string; origin: [number, number]; local: [number, number] } {
        const ox = Math.max(0, Math.min(maxX, Math.round((gx - WW / 2) / SLIDE_STEP) * SLIDE_STEP));
        const oy = Math.max(0, Math.min(maxY, Math.round((gy - WH / 2) / SLIDE_STEP) * SLIDE_STEP));
        return { layoutId: layoutIdAt(ox, oy), origin: [ox, oy], local: [gx - ox, gy - oy] };
      }
      function inspectG1b(sid: string, gx: number, gy: number): Entry {
        const cov = windowCovering(gx, gy);
        const out: Entry = { sid, globalTile: [gx, gy], window: cov.layoutId, windowOrigin: cov.origin, localTile: cov.local };
        if (!setActiveLayout(cov.layoutId)) { out.ok = false; out.reason = 'layout unavailable'; return out; }
        let ww;
        try { ww = getWindowWorld(cov.layoutId); resetWindowToGround(ww); } catch (e) { out.ok = false; out.reason = `compile threw: ${String((e as Error)?.message ?? e)}`; return out; }
        const landing = pickLanding(cov.layoutId);
        if (!landing) { out.ok = false; out.reason = 'no landable cell'; return out; }
        const gs = newGame();
        const res = startRun(gs, 'female', EPOCH, null, SEEDS[0], { tx: landing[0], ty: landing[1] }) as { ok: boolean; reason?: string };
        if (!res.ok || !gs.run) { out.ok = false; out.reason = res.reason ?? 'no run'; return out; }
        const r = gs.run;
        out.qaUsed = r.qaUsed;
        const [lx, ly] = cov.local;
        const onscreen = Object.values(r.entities).find(e => e.g1b?.sid === sid) ?? null;
        const offscreen = Object.values(r.g1b?.far ?? {}).find(e => e.g1b?.sid === sid) ?? null;
        const ent = onscreen ?? offscreen ?? null;
        out.ok = !!ent;
        out.deployedOnscreenInThisWindow = !!onscreen;
        out.waitingInOffscreenTable = !!offscreen && !onscreen;
        markDirty();
        const grid = blockGrid(r);
        out.classAtTargetTile = grid[ly * WW + lx];
        out.entityAtTargetTile = Object.values(r.entities).find(e => e.tx === lx && e.ty === ly)?.kind ?? null;
        if (ent) {
          const slot0 = ent.c ? C(r, ent.c)?.slots[0] ?? null : null;
          out.entity = {
            kind: ent.kind, globalTile: [cov.origin[0] + (ent.tx ?? -1), cov.origin[1] + (ent.ty ?? -1)],
            localTile: [ent.tx, ent.ty], floor: (ent as unknown as Entry).floor ?? 0, label: ent.label ?? null,
            g1bKind: ent.g1b?.kind ?? null, g1bState: ent.g1b?.state ?? null,
            containerSlot0: slot0 ? { key: slot0.key, qty: slot0.qty } : null,
          };
        }
        // The real E-prompt finder: stand the player on each passable neighbour of the case, aim at
        // it, and ask the engine what interaction it offers. Position-only manipulation of a QA run.
        const prompts: Entry[] = [];
        if (onscreen) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as [number, number][]) {
            const tx = lx + dx, ty = ly + dy;
            if (tx < 1 || ty < 1 || tx >= WW - 1 || ty >= WH - 1) continue;
            const i = ty * WW + tx;
            const c = grid[i];
            if (!(c === 0 || c === 4)) { prompts.push({ standAt: [tx, ty], classAtStand: c, prompt: null, blocked: 'standing cell not passable' }); continue; }
            r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8;
            r.player.aim = Math.atan2(onscreen.y - r.player.y, onscreen.x - r.player.x);
            markDirty();
            const hit = findInteract(gs, EPOCH);
            prompts.push({
              standAt: [tx, ty], classAtStand: c,
              prompt: hit ? { kind: hit.kind, label: hit.label, eid: hit.eid ?? null } : null,
              namesThisCase: !!hit && hit.eid === onscreen.id,
              clearInteraction: clearInteraction(r, onscreen),
            });
          }
          out.adjacentStandCells = prompts;
          out.promptFiresFromAnAdjacentCell = prompts.some(pp => pp.namesThisCase === true);
          out.promptLabels = [...new Set(prompts.filter(pp => pp.namesThisCase).map(pp => String((pp.prompt as Entry | null)?.label)))];
        }
        r.ended = { at: EPOCH, reason: 'foot reachability audit cleanup' } as never;
        return out;
      }
      const purpleFx = G1B_FIXTURES.find(f => f.id === 'veyra.g1b:card:purple');
      if (!purpleFx) throw Error('the purple card fixture must exist in G1B_FIXTURES');
      const presence: Entry[] = [inspectG1b(purpleFx.id, purpleFx.gx, purpleFx.gy)];
      for (const id of ['veyra.g1b:card:green', 'veyra.g1b:card:blue']) {
        const f = G1B_FIXTURES.find(x => x.id === id);
        if (f) presence.push(inspectG1b(f.id, f.gx, f.gy));
      }
      // Purple-card door locks: find a real gate declaring card 'purple' and read its contract from a
      // live run through the engine's own g1bGateOf.
      const purpleGates = G1B_GATES.filter(g => g.card === 'purple');
      const gateChecks: Entry[] = [];
      for (const g of purpleGates.slice(0, 3)) {
        const [gx, gy] = g.door;
        const cov = windowCovering(gx, gy);
        const rec: Entry = { gateId: g.id, site: g.site, doorGlobalTile: [gx, gy], card: g.card, power: g.power ?? null, window: cov.layoutId };
        if (setActiveLayout(cov.layoutId)) {
          try {
            resetWindowToGround(getWindowWorld(cov.layoutId));
            const landing = pickLanding(cov.layoutId);
            if (landing) {
              const gs = newGame();
              const res = startRun(gs, 'female', EPOCH, null, SEEDS[0], { tx: landing[0], ty: landing[1] }) as { ok: boolean; reason?: string };
              if (res.ok && gs.run) {
                const r = gs.run;
                rec.qaUsed = r.qaUsed;
                const [lx, ly] = cov.local;
                const doorEnt = Object.values(r.entities).find(e => e.kind === 'door' && e.tx === lx && e.ty === ly) ?? null;
                rec.doorEntityFound = !!doorEnt;
                rec.doorEntityFloor = doorEnt ? (doorEnt as unknown as Entry).floor ?? 0 : null;
                const gate = doorEnt ? g1bGateOf(r, doorEnt) : undefined;
                rec.gateFromEngine = gate ? { id: gate.id, card: gate.card, power: gate.power ?? null, ppe: gate.ppe ?? false } : null;
                gs.run!.ended = { at: EPOCH, reason: 'foot reachability audit cleanup' } as never;
              } else rec.reason = res.reason ?? 'no run';
            } else rec.reason = 'no landable cell';
          } catch (e) { rec.reason = `compile threw: ${String((e as Error)?.message ?? e)}`; }
        } else rec.reason = 'layout unavailable';
        gateChecks.push(rec);
      }
      manifest.targetPresence = presence;
      manifest.purpleCardGates = { declaredInG1B_GATES: purpleGates.length, liveDoorChecks: gateChecks };
      save();
      expect(presence[0].ok, 'the purple card fixture must be deployed as a real entity in a window that covers it').toBe(true);
      expect((presence[0] as Entry).deployedOnscreenInThisWindow, 'the purple card case must be an onscreen ground-floor entity in the window that covers its tile').toBe(true);
      expect(((presence[0].entity as Entry).containerSlot0 as Entry).key, 'the case must actually hold the purple_card item').toBe('purple_card');
      expect((presence[0].entity as Entry).floor, 'the case must sit on the ground floor (g1bEnsureSources deploys fixtures at floor 0)').toBe(0);
      expect(purpleGates.length, 'G1B_GATES must declare at least one purple-card door lock').toBeGreaterThan(0);

      // ---------- 7. BFS under three predicates, each with optimistic and conservative bounds ----------
      // Overlapping windows disagree about some global tiles (measured above), so every route is
      // computed twice: OPTIMISTIC = a cell counts as passable if ANY covering window says so;
      // CONSERVATIVE = only if EVERY covering window says so. A target reachable under the
      // conservative bound is reachable regardless of which window the game happens to stream; a
      // target reachable only under the optimistic bound is a route that window disagreement puts
      // in doubt, and is reported as such rather than as a fact.
      const pass = new Uint8Array(N);
      const dist = new Int32Array(N);
      const queue = new Int32Array(N);
      const srcGi = startGlobal![1] * FRAME_W + startGlobal![0];
      const bitOf = (mode: 0 | 1 | 2) => (mode === 0 ? FOOT_BIT : mode === 1 ? DRY_BIT : DOOR_BIT);
      function buildPass(mode: 0 | 1 | 2, bounds: 'optimistic' | 'conservative') {
        const bit = bitOf(mode);
        const src = bounds === 'optimistic' ? anyBits : allBits;
        for (let gi = 0; gi < N; gi++) pass[gi] = (src[gi] & bit) !== 0 ? 1 : 0;
        // A real normal start put the player on this exact cell, so it is passable by observation
        // even if some covering window compiled it differently. Recorded, never silent.
        const forced = pass[srcGi] === 0;
        if (forced) pass[srcGi] = 1;
        return forced;
      }
      function bfs(mode: 0 | 1 | 2, bounds: 'optimistic' | 'conservative') {
        const t0 = performance.now();
        const forced = buildPass(mode, bounds);
        dist.fill(-1);
        let head = 0, tail = 0, reached = 0, reachedHazard = 0, reachedWading = 0, reachedUnreadable = 0;
        const take = (gi: number, d: number) => {
          dist[gi] = d; queue[tail++] = gi; reached++;
          if (haz[gi]) reachedHazard++;
          const c = cls[gi] - 1;
          if (c === UNREADABLE_CLASS) reachedUnreadable++;
          else if (c === 4 || WET.has(tile[gi])) reachedWading++;
        };
        take(srcGi, 0);
        while (head < tail) {
          const gi = queue[head++];
          const d = dist[gi];
          const x = gi % FRAME_W;
          const y = (gi - x) / FRAME_W;
          if (x > 0) { const j = gi - 1; if (pass[j] && dist[j] < 0) take(j, d + 1); }
          if (x < FRAME_W - 1) { const j = gi + 1; if (pass[j] && dist[j] < 0) take(j, d + 1); }
          if (y > 0) { const j = gi - FRAME_W; if (pass[j] && dist[j] < 0) take(j, d + 1); }
          if (y < FRAME_H - 1) { const j = gi + FRAME_W; if (pass[j] && dist[j] < 0) take(j, d + 1); }
        }
        return {
          mode: mode === 0 ? 'foot' : mode === 1 ? 'dry' : 'footDoors', bounds, forcedSourceCellPassable: forced,
          reachedCells: reached, shareOfFrame: Number((reached / N).toFixed(6)),
          reachedHazardCells: reachedHazard, reachedWadingCells: reachedWading, reachedUnreadableClassCells: reachedUnreadable,
          bfsMs: Number((performance.now() - t0).toFixed(1)),
        };
      }

      /** Shortest path from the legal start to the nearest reached cell beside a target, described
       *  honestly: hazard/water composition, seam proximity, window-slide count, walk-time estimate. */
      function describePath(target: [number, number], mode: 0 | 1 | 2, bounds: 'optimistic' | 'conservative') {
        const bit = bitOf(mode);
        const src = bounds === 'optimistic' ? anyBits : allBits;
        const [tgx, tgy] = target;
        const tgi = tgy * FRAME_W + tgx;
        let best: { gi: number; d: number; gx: number; gy: number } | null = null;
        for (let gy = Math.max(0, tgy - TARGET_RADIUS); gy <= Math.min(FRAME_H - 1, tgy + TARGET_RADIUS); gy++) {
          for (let gx = Math.max(0, tgx - TARGET_RADIUS); gx <= Math.min(FRAME_W - 1, tgx + TARGET_RADIUS); gx++) {
            const gi = gy * FRAME_W + gx;
            if (dist[gi] < 0) continue;
            if (!best || dist[gi] < best.d) best = { gi, d: dist[gi], gx, gy };
          }
        }
        const out: Entry = {
          targetTile: target,
          targetTileClass: cls[tgi] === 0 ? null : cls[tgi] - 1,
          targetTileTerrain: TERRAIN_NAME[tile[tgi]] ?? tile[tgi],
          targetTileHazard: haz[tgi] === 1,
          targetTilePassableInAnyWindow: (anyBits[tgi] & bit) !== 0,
          targetTilePassableInEveryWindow: (allBits[tgi] & bit) !== 0,
          targetTileReachableItself: dist[tgi] >= 0,
          reachable: !!best,
          nearestReachableCell: best ? [best.gx, best.gy] : null,
          nearestReachableCellOffsetTiles: best ? Math.max(Math.abs(best.gx - tgx), Math.abs(best.gy - tgy)) : null,
          closestReachableCellByOffset: (() => {
            let bo: { gx: number; gy: number; off: number; d: number } | null = null;
            for (let gy2 = Math.max(0, tgy - TARGET_RADIUS); gy2 <= Math.min(FRAME_H - 1, tgy + TARGET_RADIUS); gy2++) {
              for (let gx2 = Math.max(0, tgx - TARGET_RADIUS); gx2 <= Math.min(FRAME_W - 1, tgx + TARGET_RADIUS); gx2++) {
                const gi2 = gy2 * FRAME_W + gx2;
                if (dist[gi2] < 0) continue;
                const off = Math.max(Math.abs(gx2 - tgx), Math.abs(gy2 - tgy));
                if (!bo || off < bo.off || (off === bo.off && dist[gi2] < bo.d)) bo = { gx: gx2, gy: gy2, off, d: dist[gi2] };
              }
            }
            return bo ? { cell: [bo.gx, bo.gy], offsetTiles: bo.off, pathTiles: bo.d } : null;
          })(),
          pathTiles: best ? best.d : null,
          pathAu: best ? Number((best.d * 0.5).toFixed(1)) : null,
          searchRadius: TARGET_RADIUS,
          readingsAtTarget: readings[tgi],
          note: 'the target tile itself is usually blocked (a loot entity, POI wall or door is class 3), so reachability means the player can stand on a cell within the search radius',
        };
        if (!best) return out;
        const cells: number[] = [];
        let cur = best.gi;
        while (cur !== srcGi && dist[cur] > 0) {
          cells.push(cur);
          const d = dist[cur];
          const x = cur % FRAME_W, y = (cur - x) / FRAME_W;
          let next = -1;
          if (x > 0 && dist[cur - 1] === d - 1) next = cur - 1;
          else if (x < FRAME_W - 1 && dist[cur + 1] === d - 1) next = cur + 1;
          else if (y > 0 && dist[cur - FRAME_W] === d - 1) next = cur - FRAME_W;
          else if (y < FRAME_H - 1 && dist[cur + FRAME_W] === d - 1) next = cur + FRAME_W;
          if (next < 0) break;
          cur = next;
        }
        cells.push(srcGi);
        cells.reverse();
        let hazardTiles = 0, wadingTiles = 0, doorTilesUsed = 0, lowMarginTiles = 0, contestedTiles = 0, multiReadingTiles = 0;
        const pathTerrain: Record<string, number> = {};
        const bbox = { minX: FRAME_W, maxX: 0, minY: FRAME_H, maxY: 0 };
        for (const gi of cells) {
          const gx = gi % FRAME_W, gy = (gi - gx) / FRAME_W;
          if (gx < bbox.minX) bbox.minX = gx;
          if (gx > bbox.maxX) bbox.maxX = gx;
          if (gy < bbox.minY) bbox.minY = gy;
          if (gy > bbox.maxY) bbox.maxY = gy;
          const c = cls[gi] - 1;
          if (haz[gi]) hazardTiles++;
          if (c === 4 || WET.has(tile[gi])) wadingTiles++;
          if (c === 3 && door[gi]) doorTilesUsed++;
          if (bestMargin[gi] < 8) lowMarginTiles++;
          if (readings[gi] > 1) multiReadingTiles++;
          if (readings[gi] > 1 && ((anyBits[gi] & bit) !== 0) !== ((allBits[gi] & bit) !== 0)) contestedTiles++;
          const name = TERRAIN_NAME[tile[gi]] ?? `tile:${tile[gi]}`;
          pathTerrain[name] = (pathTerrain[name] ?? 0) + 1;
        }
        // Simulate the real continuity slide rule along the path (EDGE_MARGIN / SLIDE_STEP / clamp).
        let ox = startOrigin![0], oy = startOrigin![1], slides = 0, guard = 0;
        for (const gi of cells) {
          const gx = gi % FRAME_W, gy = (gi - gx) / FRAME_W;
          for (let iter = 0; iter < 8; iter++) {
            const ltx = gx - ox, lty = gy - oy;
            let sx = 0, sy = 0;
            if (ltx < EDGE_MARGIN && ox > 0) sx = -SLIDE_STEP;
            else if (ltx >= WW - EDGE_MARGIN && ox < maxX) sx = SLIDE_STEP;
            if (lty < EDGE_MARGIN && oy > 0) sy = -SLIDE_STEP;
            else if (lty >= WH - EDGE_MARGIN && oy < maxY) sy = SLIDE_STEP;
            if (!sx && !sy) break;
            ox = Math.max(0, Math.min(maxX, ox + sx));
            oy = Math.max(0, Math.min(maxY, oy + sy));
            slides++;
            if (++guard > 200000) break;
          }
        }
        const speedTilesPerSec = 72 / TILE;   // BAL.player.speed = 72 px/s, TILE = 16 px
        out.path = {
          cells: cells.length,
          hazardTiles, wadingTiles, doorTilesUsed,
          cellsNearWindowSeam: lowMarginTiles,
          cellsReadByMoreThanOneWindow: multiReadingTiles,
          cellsWhosePassabilityDependsOnWhichWindowIsStreamed: contestedTiles,
          terrainHistogram: pathTerrain,
          boundingBox: bbox,
          windowSlidesSimulated: slides,
          slideRule: `EDGE_MARGIN=${EDGE_MARGIN}, SLIDE_STEP=${SLIDE_STEP}, origins clamped to the frame (continuity.ts)`,
          estimatedWalkSecondsAtBaseSpeed: Number((cells.length / speedTilesPerSec).toFixed(1)),
          estimateCaveat: 'arithmetic from BAL.player.speed over a shortest geometric path: no shallow-water slowdown, no stamina, hunger, thirst, warmth, radiation, hazard damage, creatures, turns, the 14-day clock, and no return trip',
          firstCell: [cells[0] % FRAME_W, (cells[0] - cells[0] % FRAME_W) / FRAME_W],
          lastCell: [best.gx, best.gy],
        };
        return out;
      }

      const modes: { name: 'foot' | 'dry' | 'footDoors'; mode: 0 | 1 | 2 }[] = [
        { name: 'foot', mode: 0 }, { name: 'dry', mode: 1 }, { name: 'footDoors', mode: 2 },
      ];
      const f03 = f03Profiles();
      const cardFx = (id: string) => {
        const f = G1B_FIXTURES.find(x => x.id === id);
        if (!f) throw Error(`G1B fixture ${id} must exist`);
        return f;
      };
      const sceneTile = (sid: string) => { const sc = VEYRA05_SCENES.find(x => x.id === sid); if (!sc) throw Error(`scene ${sid}`); return auToTile(sc.focusAu[0], sc.focusAu[1]); };
      const purple = cardFx('veyra.g1b:card:purple');
      const targetSpecs: { id: string; kind: string; tile: [number, number]; note: string }[] = [
        { id: 'veyra.g1b:card:purple', kind: 'access-card-fixture', tile: [purple.gx, purple.gy], note: `purple_card case deployed by g1bEnsureSources at floor 0; authored place "${purple.place}"` },
        { id: 'veyra.g1b:card:green', kind: 'access-card-fixture', tile: [cardFx('veyra.g1b:card:green').gx, cardFx('veyra.g1b:card:green').gy], note: 'green_card case (comparison target)' },
        { id: 'veyra.g1b:card:blue', kind: 'access-card-fixture', tile: [cardFx('veyra.g1b:card:blue').gx, cardFx('veyra.g1b:card:blue').gy], note: 'blue_card case (comparison target)' },
        { id: 'po_slag', kind: 'poi-site', tile: [f03.po_slag.cx, f03.po_slag.cy], note: 'Slagworks Foundry — the site whose interior anchors the purple card' },
        { id: 'po_surtur', kind: 'elder-site', tile: [REST48_SITES.po_surtur.cx, REST48_SITES.po_surtur.cy], note: 'Foundry of the First Fire (Surtur), the Cinder Isle elder site' },
        { id: 'po_obsq', kind: 'poi-site', tile: [f03.po_obsq.cx, f03.po_obsq.cy], note: 'Obsidian Quarry, beside the cinder region' },
        { id: 'veyra05-slag', kind: 'hazard-window-focus', tile: sceneTile('veyra05-slag'), note: 'Slag Flats scene focus (toxic flats, firstHour:false, no legal normal start)' },
        { id: 'veyra05-cinder', kind: 'hazard-window-focus', tile: sceneTile('veyra05-cinder'), note: 'Cinder Isle scene focus (volcanic ash, firstHour:false, no legal normal start)' },
        { id: 'veyra05-greywater', kind: 'control-window-focus', tile: sceneTile('veyra05-greywater'), note: 'Greywater Hamlet scene focus (first-hour control)' },
      ];
      // The locks the purple card exists to open: real G1B gates declaring card 'purple'. Reaching the
      // card but not its lock (or the reverse) would leave the progression chain open, so both ends are
      // measured in the same mosaic and the same component.
      for (const g of G1B_GATES.filter(x => x.card === 'purple')) {
        targetSpecs.push({
          id: g.id, kind: 'purple-card-door', tile: [g.door[0], g.door[1]],
          note: `door of ${g.site} at ${g.building ?? 'n/a'}, card purple${g.power ? `, requires power ${g.power}` : ''}`,
        });
      }
      targetSpecs.push({ id: 'po_archive', kind: 'poi-site', tile: [REST48_SITES.po_archive.cx, REST48_SITES.po_archive.cy], note: 'Argus Archive Vaults — the site that carries both purple-card doors' });

      const results: Entry = {};
      for (const bounds of ['optimistic', 'conservative'] as const) {
        results[bounds] = {};
        for (const { name, mode } of modes) {
          const summary = bfs(mode, bounds);
          const targets = targetSpecs.map(spec => ({ id: spec.id, kind: spec.kind, note: spec.note, ...describePath(spec.tile, mode, bounds) }));
          (results[bounds] as Entry)[name] = {
            summary, targets,
            otherNormalStarts: starts.filter(st => st.ok).map(st => {
              const g = st.playerGlobalTile as [number, number];
              const gi = g[1] * FRAME_W + g[0];
              return { seed: st.seed, layoutId: st.runLayoutId, playerGlobalTile: g, distanceFromPrimaryStart: dist[gi] };
            }),
          };
          save();
        }
      }
      manifest.bfs = results;
      manifest.targets = targetSpecs.map(t => ({ id: t.id, kind: t.kind, tile: t.tile, note: t.note }));
      save();

      // ---------- 8. Assertions that keep the artifact honest ----------
      const sum = (bounds: string, mode: string) => ((results[bounds] as Entry)[mode] as Entry).summary as Entry;
      const tg = (bounds: string, mode: string, id: string) => {
        const list = ((results[bounds] as Entry)[mode] as Entry).targets as Entry[];
        const found = list.find(t => t.id === id);
        if (!found) throw Error(`target ${id} missing`);
        return found;
      };
      for (const bounds of ['optimistic', 'conservative'] as const) {
        for (const { name } of modes) {
          const s = sum(bounds, name);
          expect(Number(s.reachedCells) > 0, `${bounds}/${name}: the legal start must at least reach its own cell`).toBe(true);
          expect(Number(s.reachedCells) <= N, `${bounds}/${name}: reached cells cannot exceed the frame`).toBe(true);
        }
        // dry ⊆ foot ⊆ footDoors by construction; a violation means the predicates are broken.
        expect(Number(sum(bounds, 'dry').reachedCells) <= Number(sum(bounds, 'foot').reachedCells),
          `${bounds}: the dry-only component must be a subset of the foot component`).toBe(true);
        expect(Number(sum(bounds, 'foot').reachedCells) <= Number(sum(bounds, 'footDoors').reachedCells),
          `${bounds}: the foot component must be a subset of foot-plus-openable-doors`).toBe(true);
        for (const spec of targetSpecs) {
          if (tg(bounds, 'foot', spec.id).reachable) {
            expect(tg(bounds, 'footDoors', spec.id).reachable, `${bounds}/${spec.id}: foot-reachable implies door-reachable`).toBe(true);
          }
          if (tg(bounds, 'dry', spec.id).reachable) {
            expect(tg(bounds, 'foot', spec.id).reachable, `${bounds}/${spec.id}: dry-reachable implies foot-reachable`).toBe(true);
          }
        }
      }
      // conservative ⊆ optimistic for the same predicate.
      for (const { name } of modes) {
        expect(Number(sum('conservative', name).reachedCells) <= Number(sum('optimistic', name).reachedCells),
          `${name}: the conservative component must be a subset of the optimistic one`).toBe(true);
        for (const spec of targetSpecs) {
          if (tg('conservative', name, spec.id).reachable) {
            expect(tg('optimistic', name, spec.id).reachable, `${spec.id}: conservatively reachable implies optimistically reachable`).toBe(true);
          }
        }
      }
      // Mosaic sanity: the first-hour control scene must be foot-reachable from a legal start under
      // BOTH bounds, otherwise the mosaic (not the world) is broken.
      for (const bounds of ['optimistic', 'conservative'] as const) {
        expect(tg(bounds, 'foot', 'veyra05-greywater').reachable,
          `${bounds}: the first-hour control scene must be foot-reachable from a legal start, otherwise the mosaic is broken`).toBe(true);
      }
      // ---------- 8b. Measured conclusions, pinned ----------
      // These are the decision-relevant facts. If worldgen changes so that any of them flips, this
      // audit goes red and the classification must be re-derived from a fresh run, not assumed.
      const purpleOpt = tg('optimistic', 'foot', 'veyra.g1b:card:purple');
      const purpleCon = tg('conservative', 'foot', 'veyra.g1b:card:purple');
      expect(purpleOpt.reachable, 'the purple card tile must be foot-reachable (wading allowed) from a legal normal start in the optimistic mosaic').toBe(true);
      expect(purpleCon.reachable, 'the purple card route must survive the conservative bound, i.e. it must not depend on a contested cell').toBe(true);
      expect(Number((purpleCon.path as Entry).cellsWhosePassabilityDependsOnWhichWindowIsStreamed),
        'the purple card route must not rely on any cell whose passability differs between overlapping windows').toBe(0);
      expect(Number((purpleOpt.path as Entry).wadingTiles), 'the purple card route crosses shallow water: it is a wading route, not a dry one').toBeGreaterThan(0);
      // Hazard exposure along A shortest path is path-selection dependent (the reconstruction picks
      // one of possibly many equal-length paths), so it is recorded, not asserted. What IS asserted is
      // the frame-level fact that the legal start's own component contains hazard cells, i.e. hazard
      // exposure is somewhere on the reachable mainland and survivability stays unproven.
      expect(Number((sum('optimistic', 'foot') as Entry).reachedHazardCells), 'the legal start foot component must contain hazard tiles, so this audit can never be read as a survival claim').toBeGreaterThan(0);
      expect(Number((purpleOpt.path as Entry).windowSlidesSimulated), 'the route must cross real window slides, otherwise it is not a global route').toBeGreaterThan(0);
      for (const bounds of ['optimistic', 'conservative'] as const) {
        expect(tg(bounds, 'dry', 'veyra.g1b:card:purple').reachable, `${bounds}: the purple card must NOT be reachable on a dry-only route — the wading requirement is the finding`).toBe(false);
        expect(tg(bounds, 'dry', 'po_slag').reachable, `${bounds}: po_slag must not be dry-reachable either`).toBe(false);
        expect(tg(bounds, 'foot', 'po_slag').reachable, `${bounds}: po_slag must be foot-reachable`).toBe(true);
        expect(tg(bounds, 'foot', 'veyra05-slag').reachable, `${bounds}: the Slag Flats scene focus must be foot-reachable, so "no legal start" is not "no route"`).toBe(true);
        for (const id of ['po_surtur', 'veyra05-cinder', 'po_obsq']) {
          for (const mode of ['foot', 'dry', 'footDoors'] as const) {
            expect(tg(bounds, mode, id).reachable, `${bounds}/${mode}: ${id} must stay unreachable on foot — Cinder Isle is offshore and no land route exists`).toBe(false);
          }
        }
        // The other two access cards are dry-reachable, which is what makes the purple card different.
        expect(tg(bounds, 'dry', 'veyra.g1b:card:green').reachable, `${bounds}: the green card must be dry-reachable`).toBe(true);
        expect(tg(bounds, 'dry', 'veyra.g1b:card:blue').reachable, `${bounds}: the blue card must be dry-reachable`).toBe(true);
        // All three normal starts in this run share one component, so the finding is not seed-local.
        for (const st of ((results[bounds] as Entry).foot as Entry).otherNormalStarts as Entry[]) {
          expect(Number(st.distanceFromPrimaryStart) >= 0, `${bounds}: every legal normal start must sit in the same foot component as the primary start`).toBe(true);
        }
      }
      // The purple card and the doors it opens must sit in the SAME foot component, otherwise the
      // chain is only half-built: a reachable card with an unreachable lock is not a progression route.
      const purpleDoors = targetSpecs.filter(t => t.kind === 'purple-card-door');
      expect(purpleDoors.length, 'G1B_GATES must declare purple-card doors to test the chain').toBeGreaterThan(0);
      for (const bounds of ['optimistic', 'conservative'] as const) {
        for (const d of purpleDoors) {
          expect(tg(bounds, 'foot', d.id).reachable,
            `${bounds}: the purple-card door ${d.id} must be foot-reachable from a legal normal start, otherwise the purple card has no reachable lock`).toBe(true);
        }
        expect(tg(bounds, 'foot', 'po_archive').reachable, `${bounds}: po_archive must be foot-reachable`).toBe(true);
      }
      expect(presence[0].promptFiresFromAnAdjacentCell,
        'the engine must offer the access-card case interaction when the player stands on a passable cell beside it (real findInteract, QA-entered run)').toBe(true);
      const gateProven = (manifest.purpleCardGates as Entry).liveDoorChecks as Entry[];
      expect(gateProven.some(g => (g.gateFromEngine as Entry | null)?.card === 'purple'),
        'at least one real door entity must resolve to a purple-card gate through the engine g1bGateOf').toBe(true);

      // Unreadable windows are legitimate (all-water slices throw at compile), but only for the two
      // recorded reasons, and their cells must be conservatively impassable rather than assumed free.
      const badReasons = unreadable.filter(u => !/compile threw: .*No walkable terrain|no cell satisfies the engine inspectAt landing criteria/.test(String(u.reason)));
      expect(badReasons, `every unreadable window must fail for a recorded, benign reason; got ${JSON.stringify(badReasons.slice(0, 3))}`).toEqual([]);
      save();
    },
  );
});
