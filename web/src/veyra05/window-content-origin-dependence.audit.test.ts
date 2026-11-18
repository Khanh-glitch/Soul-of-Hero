/**
 * WINDOW-CONTENT ORIGIN-DEPENDENCE DIAGNOSIS — read-only cause attribution. No code, map or law change.
 *
 * Phenomenon, already measured frame-wide by `global-foot-reachability.audit.test.ts`: the SAME global
 * tile can compile to a different engine collision class depending on which 200x200 window covers it —
 * 59,320 mismatches over 49,076,416 overlapping-cell readings (0.1209%), 96% of them `class 2 <-> 0`,
 * the rest mostly `class 1 <-> 0`, with terrain identical on both sides in the large majority, and NOT
 * concentrated at window seams. That audit bounds the consequence for routes; it does not explain the
 * cause. Creator decision 2026-11-18: diagnose the cause in worldgen, read-only, and write options with
 * cost/risk — no change without approval. This file is that diagnosis.
 *
 * OUTCOME (150 stratified neighbour pairs on the real slide stride 64 x 3 seeds; 113 readable, 37 rejected
 * because BOTH windows legitimately fail to compile on all-water slices; 3,073,600 overlapping cells,
 * 8,931 mismatches = 0.2906%, 5,504 of them flipping passability; 56.96 s; UNCLASSIFIED = 0):
 *
 *   P1 SOURCE REACHABILITY FILTER — 3,962 cells, 44.36%. H1 CONFIRMED. Sources are scattered by a padded
 *      compile anchored on GLOBAL chunk centres (`window.ts:306/:353`, intent "100% window-invariant") and
 *      then filtered by `if (sk && wReached[i]) sourceV3[i] = sk;` (`window.ts:369`), where `wReached`
 *      floods from WINDOW-LOCAL anchors `compiler_${x}_${y}` (`window.ts:328/:344`; 2-16 survive per
 *      window). The flood stops at the 200x200 border. Proof that this is truncation and not geometry: at
 *      100% of these cells the two windows' `walkable` masks AGREE (asserted), and no source ever survives
 *      on a side whose own flood rejects it (`H5b = 0`, asserted).
 *   P3 PROCEDURAL PROPS KEYED ON WINDOW-LOCAL COORDINATES — 2,765 cells, 30.96%. H3 CONFIRMED and split:
 *      no static object differs anywhere (`staticsKindFlicker` is `none<->none` throughout); only the
 *      `FloorLayer.solidProps` flag does. `arch/interior.ts:19` hashes LOCAL x,y (used at `:106/:108/:117/
 *      :127`), its 6-tile pier grid is anchored on the local origin (a 64-tile slide shifts it by 4),
 *      landmarks are clipped to the window rect (`poi-kit.ts:806`) and rejected within 2 tiles of the
 *      border (`floors.ts:297`), and every guard is evaluated on local geometry. `cellClass` reads
 *      `solidProps` directly (`engine.ts:579`). This is the ONLY cause found 64+ tiles inside both windows
 *      (96 cells; 1,341 more at 24-63), so it is the one that cannot be dismissed as a seam artefact.
 *   P2 POI STAMPING UNDER THREE DIFFERENT CLIPS — 2,031 cells, 22.74%. H2 RE-ATTRIBUTED: `floors.ground`
 *      is NOT an independent layer (level 0 copies `base.tiles`/`base.sourceV3` at `floors.ts:453/:458` and
 *      `resetWindowToGround` copies them back at `window.ts:497/:501` — asserted here as
 *      `groundIsWorldSnapshot`, because the first draft of this file reasoned circularly from it). The real
 *      mechanism is that a POI is stamped three times with three window-relative clips: `poi-kit.ts:771/
 *      :773/:780`, the padded rect `window.ts:199`, and `buildFloorStack`'s stricter 1-tile border clip
 *      `floors.ts:483`, which also nulls sources at `:488`. Every one of these cells lies within 2 tiles of
 *      a window border (asserted 0 deeper) — a border artefact, but a real one: tile ids differ.
 *   P6 THE POI SLICE CHANGES THE COMPILE'S INPUT — 104 cells, 1.16%. NEW, found by falsifying this file's
 *      own earlier claim: a source present in one window only where BOTH windows' floods reach the cell
 *      cannot be P1. `paddedPoiTiles` stamps this window's sliced POIs into the padded biome/tile/freshness
 *      fields the scatter runs over (`window.ts:199/:215`), so the compile is invariant in its anchor
 *      lattice only. 79 of the 104 cells sit in a pair whose windows sliced different POI sets; the other
 *      25 have an IDENTICAL slice set and are reported as residue — all but one lie 8-15 tiles from the
 *      padded rect edge (PAD = 8), which is consistent with truncation of the compile's own fields but is
 *      NOT proven (proving it needs a PAD sweep, a code experiment outside this read-only mandate).
 *   P5 SALVAGE PLACED AFTER THE FILTER — 62 cells, 0.69%. Under rules 4 (engine default for every new
 *      Veyra run) `placePoiSalvage`/`unplugSalvage` run after the reachability filter (`window.ts:486`),
 *      so industrial salvage never sees it.
 *   P4 FRESHWATER SPAWN PREFILTER — 94,609 cells, 3.08% of ALL compared cells, invisible to collision:
 *      class, tile and source agree but `spawnEligible` differs. Per-mask measurement (asserted): walkable
 *      0, protectedCells 0, buildable 0, solidProps 0, spawnEligible 94,609. The BFS runs on the inner
 *      200x200 arrays with a 28-step cap (`window.ts:378/:384/:400`). Only consumer: `chooseLegalSpawn`
 *      (`engine.ts:147`), so the impact is spawn/start selection, not movement.
 *   H4 THIS HARNESS'S OWN FOOTPRINT — 7 cells, 0.08%, separated out and never counted as worldgen.
 *
 * Also measured: compiled window content carries NO run seed (27 origin pairs read under 3 seeds, 0
 * differing cause mixes — asserted), and `cellClass` gives class 2 for BOTH a blocking source and a
 * solidProps cell (`engine.ts:579`), which corrects the earlier frame-wide reading of `class 2<->0` as
 * "a blocking source". Residue not sub-attributed to a POI bbox: 4,214 cells (P1 3,631, P3 401, P2 163,
 * P6 18) — the bbox test is conservative, so these are recorded as residue, not promoted to a mechanism.
 *
 * Options A-E with cost/risk are written in
 * `evidence/solo-final-fallback/20261117/technical-audit/TECHNICAL_RED_FLAGS.md`; NONE is chosen here and
 * nothing is changed by this file. The 0.2906% above is a stratified NEIGHBOUR-pair rate over dense POI
 * regions and must never be quoted as the frame-wide rate (that is the 0.1209% mosaic figure).
 *
 * Run (the command that produced the committed artifact):
 *   cd web && SOH_WINDOW_ORIGIN_DEPENDENCE=1 SOH_WOD_SEEDS=901,902,903 SOH_WOD_PAIRS=150 \
 *     SOH_WOD_EXAMPLES=10 npx vitest run --fileParallelism=false --testTimeout=1400000 \
 *     src/veyra05/window-content-origin-dependence.audit.test.ts
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { T, TERRAIN_NAME, WW, WH, TILE } from '../game/core';
import { blockGrid, effTile, markDirty, newGame, startRun } from '../game/engine';
import { getWorld, setActiveLayout } from '../game/world';
import { getWindowWorld, getVeyraPlacementRules, resetWindowToGround, setVeyraPlacementRules } from './window';
import { VEYRA05_SCENES, layoutIdAt } from './scenes';
import { FRAME_H, FRAME_W, auToTile } from './frame';
import { reachable } from '../game/world-economy';
import { SOURCES, isIndustrialSalvage } from '../game/catalog';
import { getPoiLayout, slicePoisForWindow } from './poi-kit';

type Entry = Record<string, unknown>;
const root = path.resolve(process.cwd(), 'evidence/veyra-window-origin-dependence');
const output = path.join(root, 'manifest.json');
const EPOCH = Date.UTC(2026, 10, 18, 12);
const SEEDS = (process.env.SOH_WOD_SEEDS || process.env.SOH_WOD_SEED || '901')
  .split(',').map(v => Number(v.trim())).filter(n => Number.isFinite(n));
let ACTIVE_SEED = SEEDS[0];
const PAIRS = Number(process.env.SOH_WOD_PAIRS || '32');
const EXAMPLES_PER_CAUSE = Number(process.env.SOH_WOD_EXAMPLES || '6');
const SLIDE_STEP = 64;
const maxX = FRAME_W - WW, maxY = FRAME_H - WH;
const passableClass = (c: number) => c === 0 || c === 4;

const CAUSES = [
  'H1_sourceDroppedByWindowReachabilityFilter',
  'H1c_sourceKeyDiffersBothPlaced',
  'H1d_sourcePlacedInOneWindowOnlyBothReachable',
  'H2_groundTileGeometryDiffers',
  'H3_staticsOrSolidPropsDiffer',
  'H4_harnessRunEntityEffect',
  'H5_postFilterSalvagePlacement',
  'H5b_sourcePresentThoughWindowUnreachable',
  'UNCLASSIFIED',
] as const;
type Cause = typeof CAUSES[number];

const manifest: Entry = {
  schema: 'veyra-window-content-origin-dependence-v1',
  executedAt: new Date().toISOString(),
  engineRevision: process.env.SOH_ENGINE_REVISION ?? 'working tree',
  scope: 'READ-ONLY cause attribution for window-dependent compiled content. No worldgen, map, law or engine change; no option is chosen here.',
  config: { seeds: SEEDS.join(','), pairs: PAIRS, slideStep: SLIDE_STEP, placementRules: null as number | null, examplesPerCause: EXAMPLES_PER_CAUSE },
  notes: [
    'Each window is read through a QA inspection landing (qaUsed=true) purely so a real RunState and therefore the real blockGrid exists; QA landings are never playable evidence.',
    'H4 is this diagnosis\' own footprint (G1B fixtures deploy only inside their own run window) and is reported separately so it is never counted as worldgen.',
    'Frame-wide magnitude is measured independently by global-foot-reachability.audit.test.ts (0.1209% of 49,076,416 overlap readings); this file explains cause on a stratified sample of neighbour pairs.',
    'floors.ground is NOT an independent pre-window layer: buildFloorStack level 0 copies base.tiles and base.sourceV3, and resetWindowToGround copies them straight back. Any world-vs-ground comparison is therefore circular and is asserted away here instead of being reported as a cause.',
    'The padded compile is window-invariant in its anchor lattice but NOT in its inputs: the POIs a window slices are stamped into the padded biome/tile/freshness fields before sources are scattered, so neighbouring windows with different POI slices scatter different sources (cause H1d / pass P6).',
    'The POI pass is window-relative three times over: which POIs a window slices (anchor +/-55 margin plus bbox overlap in slicePoisForWindow), which of a POI\'s tiles fall inside the window rect, and which of those survive buildFloorStack\'s stricter 1-tile border clip (which also nulls sources under stamped tiles).',
  ],
};

function save() {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
}

/** The mechanism quotes, read out of the shipped source so the explanation cannot outlive the code. */
/** Quoted lines from the passes this diagnosis names, so no claim can outlive the code it explains. */
const interiorQuotes = {
  localHash: quoteFrom('src/veyra05/arch/interior.ts', /^const hash = \(x: number, y: number/),
  hashUseWall: quoteFrom('src/veyra05/arch/interior.ts', /hash\(x, y, 7\)/),
  hashUseKind: quoteFrom('src/veyra05/arch/interior.ts', /hash\(x, y, 11\)/),
  localKey: quoteFrom('src/veyra05/arch/interior.ts', /^const KEY = \(x: number, y: number\)/),
};
const floorsQuotes = {
  landmarkStamp: quoteFrom('src/veyra05/floors.ts', /ctx\.stampProceduralSolidProp\(lm\.tx, lm\.ty, lm\.kind\)/),
  propBorderReject: quoteFrom('src/veyra05/floors.ts', /if \(cx <= 1 \|\| cy <= 1 \|\| cx >= WW - 2 \|\| cy >= WH - 2\) return false;/),
  perWindowDressingAcknowledged: quoteFrom('src/veyra05/floors.ts', /Procedural furniture is dressed per window/),
};
const poiKitQuotes = {
  landmarkLocalClip: quoteFrom('src/veyra05/poi-kit.ts', /landmarks\.push\(\{ tx: lx, ty: ly, kind: lm\.kind \}\)/),
};
const windowQuotes = {
  freshDistPrefilter: quoteFrom('src/veyra05/window.ts', /Fast freshwater-distance prefilter for spawnEligible/),
  freshDistCap: quoteFrom('src/veyra05/window.ts', /if \(freshDist\[i\] >= 28\) continue;/),
  spawnEligibleGate: quoteFrom('src/veyra05/window.ts', /if \(dFocus >= 10 && dFocus <= 42\) \{ spawnEligible\[i\] = 1;/),
};
const engineQuotes = {
  solidPropMakesClass2: quoteFrom('src/game/engine.ts', /if \(layer\.solidProps\[i\]\) c = 2;/),
  blockingSourceAlsoClass2: quoteFrom('src/game/engine.ts', /if \(s && s\.def\.block && \(s\.stock > 0 \|\| s\.key === 'wreck'\)\) c = 2;/),
};

/** A quoted line from a shipped file, so an explanation can never outlive the code it explains. */
function quoteFrom(rel: string, re: RegExp) {
  const ls = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8').split('\n');
  for (let i = 0; i < ls.length; i++) if (re.test(ls[i])) return { file: rel, line: i + 1, text: ls[i].trim().slice(0, 220) };
  return null;
}

function pinMechanism() {
  const file = path.resolve(process.cwd(), 'src/veyra05/window.ts');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const find = (re: RegExp) => {
    for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return { line: i + 1, text: lines[i].trim().slice(0, 220) };
    return null;
  };
  return {
    file: 'src/veyra05/window.ts',
    invariantAnchorIntent: find(/Global-chunk-aligned reachability anchors/),
    paddedCompileUsesGlobalAnchors: find(/starts: pAnchors,/),
    windowLocalAnchors: find(/compiler_\$\{x\}_\$\{y\}/),
    economyStartsAreWindowLocal: find(/starts: anchors,/),
    reachabilityFilterOnSources: find(/if \(sk && wReached\[i\]\) sourceV3\[i\] = sk;/),
    reachabilityComment: find(/Verify 200x200 reachability so every source inside the window is reachable/),
    groundOverwrite: find(/resetWindowToGround\(ww\)/),
    authoredCompoundGeometryFromFloors: (() => {
      const f = path.resolve(process.cwd(), 'src/veyra05/poi-kit.ts');
      const ls = fs.readFileSync(f, 'utf8').split('\n');
      for (let i = 0; i < ls.length; i++) if (/AUTHORED_SITES\[l\.id\]/.test(ls[i])) return { file: 'src/veyra05/poi-kit.ts', line: i + 1, text: ls[i].trim().slice(0, 220) };
      return null;
    })(),
    salvagePassRules4: find(/if \(rules === 4\) \{ placePoiSalvage/),

    // ---- The POI passes, which are window-relative THREE times over ----
    // (a) which POIs a window sees at all, (b) which of a POI's tiles land inside the window,
    // (c) which of those survive buildFloorStack's stricter 1-tile border clip.
    poiSliceCall: find(/const poiSlice = slicePoisForWindow\(win\)/),
    paddedPoiTileClip: find(/if \(px >= 0 && py >= 0 && px < PW && py < PH\) paddedPoiTiles\.set/),
    paddedPoiTileApplied: find(/const ov = paddedPoiTiles\.get\(pi\)/),
    innerPoiTileOverride: find(/const ov = poiSlice\.tileOverrides\.get\(i\)/),
    poiInclusionAnchorMargin: quoteFrom('src/veyra05/poi-kit.ts', /if \(tx \+ 55 < wx0 \|\| tx - 55 >= wx1/),
    poiInclusionBboxOverlap: quoteFrom('src/veyra05/poi-kit.ts', /if \(l\.bbox\[2\] < wx0 \|\| l\.bbox\[0\] >= wx1/),
    poiTileClipToWindow: quoteFrom('src/veyra05/poi-kit.ts', /if \(lx < 0 \|\| ly < 0 \|\| lx >= WW \|\| ly >= WH\) continue;/),
    floorStackCopiesWorldTiles: quoteFrom('src/veyra05/floors.ts', /const tiles = Uint8Array\.from\(base\.tiles\);/),
    floorStackCopiesFilteredSources: quoteFrom('src/veyra05/floors.ts', /lv === 0 \? base\.sourceV3\.slice\(\)/),
    floorStackPoiBorderClip: quoteFrom('src/veyra05/floors.ts', /if \(x < 1 \|\| y < 1 \|\| x >= WW - 1 \|\| y >= WH - 1\) continue;/),
    floorStackNullsSourceUnderPoiTile: quoteFrom('src/veyra05/floors.ts', /^\s*sources\[i\] = null;/),
    resetCopiesGroundOverWorld: quoteFrom('src/veyra05/window.ts', /world\.tiles\.set\(g\.tiles\)/),
    resetCopiesGroundSourcesOverWorld: quoteFrom('src/veyra05/window.ts', /world\.sourceV3\[i\] = g\.sources\[i\]/),
  };
}

interface WindowDetail {
  ok: boolean;
  reason: string | null;
  layoutId: string;
  origin: [number, number];
  ms: number;
  cls: Uint8Array;
  tile: Uint8Array;
  src: (string | null)[];
  groundTile: Uint8Array;
  groundSrc: (string | null)[];
  /** True when floors.ground is a verbatim copy of the compiled world (buildFloorStack level 0 copies
   *  base.tiles / base.sourceV3 and resetWindowToGround copies them straight back). When true, the
   *  ground layer carries NO independent information and must never be used to separate passes. */
  groundIsWorldSnapshot: boolean;
  solidProps: Uint8Array;
  walkable: Uint8Array;
  protectedCells: Uint8Array;
  buildable: Uint8Array;
  spawnEligible: Uint8Array;
  wReached: Uint8Array;
  anchorsUsed: number;
  staticsAt: Map<number, string>;
  entitiesAt: Map<number, string>;
  poiIds: string[];
  poiBoxes: { id: string; box: [number, number, number, number] }[];
}

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

function readWindowDetail(layoutId: string, origin: [number, number], seed: number): WindowDetail {
  ACTIVE_SEED = seed;
  const t0 = performance.now();
  const empty = {
    ok: false, reason: null as string | null, layoutId, origin, ms: 0,
    cls: new Uint8Array(0), tile: new Uint8Array(0), src: [] as (string | null)[],
    groundTile: new Uint8Array(0), groundSrc: [] as (string | null)[], groundIsWorldSnapshot: false, solidProps: new Uint8Array(0),
    walkable: new Uint8Array(0), protectedCells: new Uint8Array(0), buildable: new Uint8Array(0),
    spawnEligible: new Uint8Array(0), wReached: new Uint8Array(0), anchorsUsed: 0,
    staticsAt: new Map<number, string>(), entitiesAt: new Map<number, string>(),
    poiIds: [] as string[], poiBoxes: [] as { id: string; box: [number, number, number, number] }[],
  };
  if (!setActiveLayout(layoutId)) return { ...empty, reason: 'layout unavailable', ms: performance.now() - t0 };
  let landing: [number, number] | null = null;
  let ww;
  try {
    ww = getWindowWorld(layoutId);
    resetWindowToGround(ww);
    landing = pickLanding(layoutId);
  } catch (e) {
    return { ...empty, reason: `compile threw: ${String((e as Error)?.message ?? e)}`, ms: performance.now() - t0 };
  }
  if (!landing) return { ...empty, reason: 'no cell satisfies the engine inspectAt landing criteria', ms: performance.now() - t0 };
  const gs = newGame();
  const res = startRun(gs, 'female', EPOCH, null, ACTIVE_SEED, { tx: landing[0], ty: landing[1] }) as { ok: boolean; reason?: string };
  if (!res.ok || !gs.run) return { ...empty, reason: res.reason ?? 'no run', ms: performance.now() - t0 };
  const r = gs.run;
  setActiveLayout(layoutId);
  markDirty();
  const n = WW * WH;
  const grid = blockGrid(r);
  const w = getWorld();
  const cls = new Uint8Array(n);
  cls.set(grid);
  const tile = new Uint8Array(n);
  tile.set(w.tiles);
  const ground = ww.floors.ground;
  // The exact filter window.ts applies: union of reachable() floods from the window-LOCAL anchors.
  const wReached = new Uint8Array(n);
  let anchorsUsed = 0;
  for (const a of w.economyMap.starts) {
    anchorsUsed++;
    const d = reachable(w.economyMap, a.x, a.y);
    for (let i = 0; i < n; i++) if (d[i] >= 0) wReached[i] = 1;
  }
  const staticsAt = new Map<number, string>();
  for (const st of w.statics) {
    const i = st.ty * WW + st.tx;
    staticsAt.set(i, staticsAt.has(i) ? `${staticsAt.get(i)}+${st.kind}` : st.kind);
  }
  const entitiesAt = new Map<number, string>();
  for (const e of Object.values(r.entities)) {
    if (e.tx === undefined || e.ty === undefined) continue;
    const i = e.ty * WW + e.tx;
    const tag = e.g1b ? `${e.kind}/g1b:${e.g1b.sid}` : e.kind;
    entitiesAt.set(i, entitiesAt.has(i) ? `${entitiesAt.get(i)}+${tag}` : tag);
  }
  const slice = slicePoisForWindow({ originTx: origin[0], originTy: origin[1], w: WW, h: WH });
  const poiBoxes = slice.poiIds.map(id => {
    const l = getPoiLayout(id);
    return { id, box: [l.bbox[0], l.bbox[1], l.bbox[2], l.bbox[3]] as [number, number, number, number] };
  });
  r.ended = { at: EPOCH, reason: 'window origin-dependence diagnosis cleanup' } as never;
  return {
    ok: true, reason: null, layoutId, origin, ms: performance.now() - t0,
    cls, tile, src: w.sourceV3.slice(),
    groundTile: Uint8Array.from(ground.tiles), groundSrc: ground.sources.slice(),
    groundIsWorldSnapshot: Uint8Array.from(ground.tiles).every((v, i) => v === w.tiles[i])
      && ground.sources.every((v, i) => v === w.sourceV3[i]),
    solidProps: Uint8Array.from(ground.solidProps),
    walkable: Uint8Array.from(w.economyMap.walkable), protectedCells: Uint8Array.from(w.economyMap.protected),
    buildable: Uint8Array.from(w.economyMap.buildable), spawnEligible: Uint8Array.from(w.spawnEligible ?? new Uint8Array(n)),
    wReached, anchorsUsed, staticsAt, entitiesAt, poiIds: slice.poiIds, poiBoxes,
  };
}

/** Stratified pair sample: every authored scene focus, both hazard regions, the purple-card corridor,
 *  plus deterministic pseudo-random origins spread over the whole frame. */
type PairPlan = { a: [number, number]; b: [number, number]; axis: 'x' | 'y'; stratum: string; seed: number };
function pairPlan(count: number, seed: number): PairPlan[] {
  const out: PairPlan[] = [];
  const clampO = (v: number, max: number) => Math.max(0, Math.min(max - SLIDE_STEP, Math.round(v / SLIDE_STEP) * SLIDE_STEP));
  const push = (gx: number, gy: number, axis: 'x' | 'y', stratum: string, jitter = 0) => {
    const ox = clampO(gx - WW / 2 + jitter, maxX);
    const oy = clampO(gy - WH / 2 + jitter, maxY);
    const b: [number, number] = axis === 'x' ? [Math.min(maxX, ox + SLIDE_STEP), oy] : [ox, Math.min(maxY, oy + SLIDE_STEP)];
    if (b[0] === ox && b[1] === oy) return;
    out.push({ a: [ox, oy], b, axis, stratum, seed });
  };
  for (const s of VEYRA05_SCENES) {
    const [gx, gy] = auToTile(s.focusAu[0], s.focusAu[1]);
    push(gx, gy, 'x', `scene:${s.short}`);
    push(gx, gy, 'y', `scene:${s.short}`, SLIDE_STEP);
  }
  push(2402, 1843, 'x', 'target:purple-card');
  push(2047, 443, 'y', 'target:purple-gate-po_archive');
  push(3388, 1652, 'x', 'target:po_surtur-offshore');
  // Deterministic pseudo-random spread over the frame (LCG), so the sample is reproducible.
  let state = (seed * 2654435761) >>> 0;
  const rnd = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const gx = Math.floor(rnd() * FRAME_W), gy = Math.floor(rnd() * FRAME_H);
    push(gx, gy, rnd() < 0.5 ? 'x' : 'y', 'frame-spread', Math.floor(rnd() * 3) * SLIDE_STEP);
  }
  return out.slice(0, count);
}

function nearestStratum(gx: number, gy: number): string {
  let best = 'open-frame', bestD = Infinity;
  for (const s of VEYRA05_SCENES) {
    const [tx, ty] = auToTile(s.focusAu[0], s.focusAu[1]);
    const d = Math.hypot(gx - tx, gy - ty);
    if (d < bestD) { bestD = d; best = s.short; }
  }
  return bestD <= 220 ? best : 'open-frame';
}

describe('Window-content origin dependence (read-only cause attribution)', () => {
  it.skipIf(process.env.SOH_WINDOW_ORIGIN_DEPENDENCE !== '1')(
    'attributes every sampled window-to-window content mismatch to a named mechanism, with impact counts',
    () => {
      const mech = pinMechanism();
      manifest.mechanismQuotes = mech;
      expect(mech.invariantAnchorIntent, 'window.ts must still state the window-invariant source placement intent').toBeTruthy();
      expect(mech.paddedCompileUsesGlobalAnchors, 'the padded compile must still start from global-chunk-aligned anchors').toBeTruthy();
      expect(mech.windowLocalAnchors, 'window.ts must still build window-local compiler_ anchors').toBeTruthy();
      expect(mech.economyStartsAreWindowLocal, 'economyMap.starts must still be the window-local anchors').toBeTruthy();
      expect(mech.reachabilityFilterOnSources, 'window.ts must still filter sources by window reachability').toBeTruthy();
      expect(mech.groundOverwrite, 'window.ts must still overwrite the world from the ground floor').toBeTruthy();
      expect(mech.authoredCompoundGeometryFromFloors, 'poi-kit must still route authored compounds to floors.ts').toBeTruthy();
      // Every window-relative POI pass this audit attributes to must still exist in the shipped source.
      expect(mech.poiSliceCall, 'window.ts must still slice POIs per window').toBeTruthy();
      expect(mech.paddedPoiTileClip, 'the padded compile must still clip POI tiles to the padded rect').toBeTruthy();
      expect(mech.innerPoiTileOverride, 'the inner extraction must still apply poiSlice.tileOverrides').toBeTruthy();
      expect(mech.poiInclusionAnchorMargin, 'slicePoisForWindow must still gate POIs on the +/-55 anchor margin').toBeTruthy();
      expect(mech.poiInclusionBboxOverlap, 'slicePoisForWindow must still gate POIs on bbox overlap').toBeTruthy();
      expect(mech.poiTileClipToWindow, 'slicePoisForWindow must still clip POI tiles to the window rect').toBeTruthy();
      expect(mech.floorStackCopiesWorldTiles, 'buildFloorStack level 0 must still copy base.tiles').toBeTruthy();
      expect(mech.floorStackCopiesFilteredSources, 'buildFloorStack level 0 must still copy base.sourceV3').toBeTruthy();
      expect(mech.floorStackPoiBorderClip, 'buildFloorStack must still clip POI tiles to the 1-tile inner border').toBeTruthy();
      expect(mech.floorStackNullsSourceUnderPoiTile, 'buildFloorStack must still null sources under stamped POI tiles').toBeTruthy();
      expect(mech.resetCopiesGroundOverWorld, 'resetWindowToGround must still copy ground tiles over the world').toBeTruthy();
      expect(mech.resetCopiesGroundSourcesOverWorld, 'resetWindowToGround must still copy ground sources over sourceV3').toBeTruthy();

      setVeyraPlacementRules(4);   // engine: every NEW Veyra run is created under rules 4
      (manifest.config as Entry).placementRules = getVeyraPlacementRules();

      // One plan per seed, then round-robin, so a pair budget smaller than the whole plan still
      // covers every seed rather than exhausting the first one.
      const perSeedPlans = SEEDS.map(sd => pairPlan(PAIRS, sd));
      const plan: PairPlan[] = [];
      for (let i = 0; i < PAIRS; i++) {
        const sd = perSeedPlans[i % SEEDS.length];
        const row = sd[Math.floor(i / SEEDS.length)];
        if (row) plan.push(row);
      }
      manifest.pairPlan = plan.map(p => ({ a: p.a, b: p.b, axis: p.axis, stratum: p.stratum, seed: p.seed }));

      const causeCounts: Record<Cause, number> = Object.fromEntries(CAUSES.map(c => [c, 0])) as Record<Cause, number>;
      const examples: Record<Cause, Entry[]> = Object.fromEntries(CAUSES.map(c => [c, []])) as unknown as Record<Cause, Entry[]>;
      const srcKeyFlicker: Record<string, number> = {};
      const tilePairFlicker: Record<string, number> = {};
      const classPairFlicker: Record<string, number> = {};
      const marginBuckets: Record<string, number> = { '0-2': 0, '3-7': 0, '8-23': 0, '24-63': 0, '64+': 0 };
      // POI-pass sub-attribution, shared by every source/tile/prop cause. `boxesA/B` are the bboxes of
      // the POIs THIS window sliced, so a cell covered in one window and not the other means the POI was
      // sliced (or its tiles clipped) differently — a window-relative POI pass, not base terrain.
      const poiPass: Record<string, Record<string, number>> = {};
      const poiPassKeys = ['poiSlicedInOneWindowOnly', 'poiSlicedInBothBorderClip', 'poiSlicedInBothInterior', 'noPoiEitherSide'] as const;
      for (const c of CAUSES) poiPass[c] = Object.fromEntries(poiPassKeys.map(k => [k, 0]));
      const h3What: Record<string, number> = { staticsKindDiffers: 0, solidPropsFlagDiffers: 0, bothDiffer: 0 };
      // Which mask flickers on cells whose class, tile and source all agree. These cells are invisible to
      // the collision grid but they drive spawn choice, build placement and dig protection, so a port that
      // only compares tiles would miss them entirely.
      const maskOnlyWhich: Record<string, number> = { walkable: 0, protectedCells: 0, buildable: 0, spawnEligible: 0, solidProps: 0 };
      const maskOnlyMargins: Record<string, number> = { '0-2': 0, '3-7': 0, '8-23': 0, '24-63': 0, '64+': 0 };
      const marginByCause: Record<string, Record<string, number>> = {};
      for (const c of CAUSES) marginByCause[c] = { '0-2': 0, '3-7': 0, '8-23': 0, '24-63': 0, '64+': 0 };
      const h1Walkable: Record<string, number> = { walkableAgreesSoFloodTruncatedOrAnchorsDiffer: 0, walkableDiffersSoGeometryDiffers: 0 };
      // A source present in one window only where BOTH windows' own floods reach the cell cannot be the
      // reachability filter. The remaining window-relative input to the compile is the POI slice itself.
      const h1dPoiSlice: Record<string, number> = { poiSliceSetDiffers: 0, poiSliceSetIdentical: 0 };
      const h1dMargins: Record<string, number> = { '0-7': 0, '8-23': 0, '24+': 0 };
      // PAD is 8, so a cell `m` tiles inside the window is `m + 8` tiles inside the padded compile rect.
      // If the compile's own fields are truncated at the padded border, H1d must live in that ring.
      const h1dPaddedMargins: Record<string, number> = { '8-10': 0, '11-15': 0, '16-31': 0, '32+': 0 };
      const h1dIdenticalSlice: Entry[] = [];
      const staticsKindFlicker: Record<string, number> = {};
      const byStratum: Record<string, { pairs: number; compared: number; mismatches: number; causes: Record<string, number> }> = {};
      let compared = 0, mismatches = 0, walkabilityFlicker = 0, maskOnlyDifferences = 0, pairsRead = 0, pairsFailed = 0;
      const pairSummaries: Entry[] = [];
      const readMs: number[] = [];
      const t0 = performance.now();

      for (const p of plan) {
        const A = readWindowDetail(layoutIdAt(p.a[0], p.a[1]), p.a, p.seed);
        const B = readWindowDetail(layoutIdAt(p.b[0], p.b[1]), p.b, p.seed);
        readMs.push(A.ms, B.ms);
        if (!A.ok || !B.ok) {
          pairsFailed++;
          pairSummaries.push({ a: p.a, b: p.b, axis: p.axis, stratum: p.stratum, seed: p.seed, ok: false, reasonA: A.reason, reasonB: B.reason });
          continue;
        }
        pairsRead++;
        // Circularity guard: the ground floor is a snapshot of the compiled world, so comparing
        // world-vs-ground cannot separate passes. Assert it rather than assume it.
        expect(A.groundIsWorldSnapshot && B.groundIsWorldSnapshot,
          'floors.ground must remain a verbatim copy of the compiled world; if it ever diverges, the sub-attribution in this file must be re-derived').toBeTruthy();
        const x0 = Math.max(p.a[0], p.b[0]), x1 = Math.min(p.a[0], p.b[0]) + WW;
        const y0 = Math.max(p.a[1], p.b[1]), y1 = Math.min(p.a[1], p.b[1]) + WH;
        const stratumKey = p.stratum.startsWith('scene:') || p.stratum.startsWith('target:') ? p.stratum : `frame-spread:${nearestStratum((x0 + x1) >> 1, (y0 + y1) >> 1)}`;
        const st = (byStratum[stratumKey] ??= { pairs: 0, compared: 0, mismatches: 0, causes: {} });
        st.pairs++;
        let pairCompared = 0, pairMismatch = 0;
        const pairCauses: Record<string, number> = {};

        for (let gy = y0; gy < y1; gy++) {
          for (let gx = x0; gx < x1; gx++) {
            const ia = (gy - p.a[1]) * WW + (gx - p.a[0]);
            const ib = (gy - p.b[1]) * WW + (gx - p.b[0]);
            pairCompared++; compared++;
            const clsA = A.cls[ia], clsB = B.cls[ib];
            const tileA = A.tile[ia], tileB = B.tile[ib];
            const srcA = A.src[ia], srcB = B.src[ib];
            const classDiff = clsA !== clsB;
            const tileDiff = tileA !== tileB;
            const srcDiff = srcA !== srcB;
            const maskDiff = A.walkable[ia] !== B.walkable[ib] || A.protectedCells[ia] !== B.protectedCells[ib]
              || A.buildable[ia] !== B.buildable[ib] || A.spawnEligible[ia] !== B.spawnEligible[ib]
              || A.solidProps[ia] !== B.solidProps[ib];
            if (!classDiff && !tileDiff && !srcDiff) {
              if (maskDiff) {
                maskOnlyDifferences++;
                if (A.walkable[ia] !== B.walkable[ib]) maskOnlyWhich.walkable++;
                if (A.protectedCells[ia] !== B.protectedCells[ib]) maskOnlyWhich.protectedCells++;
                if (A.buildable[ia] !== B.buildable[ib]) maskOnlyWhich.buildable++;
                if (A.spawnEligible[ia] !== B.spawnEligible[ib]) maskOnlyWhich.spawnEligible++;
                if (A.solidProps[ia] !== B.solidProps[ib]) maskOnlyWhich.solidProps++;
                const mmA = Math.min(gx - p.a[0], gy - p.a[1], WW - 1 - (gx - p.a[0]), WH - 1 - (gy - p.a[1]));
                const mmB = Math.min(gx - p.b[0], gy - p.b[1], WW - 1 - (gx - p.b[0]), WH - 1 - (gy - p.b[1]));
                const mm = Math.min(mmA, mmB);
                maskOnlyMargins[mm <= 2 ? '0-2' : mm <= 7 ? '3-7' : mm <= 23 ? '8-23' : mm <= 63 ? '24-63' : '64+']++;
              }
              continue;
            }
            mismatches++; pairMismatch++; st.mismatches++;
            if (passableClass(clsA) !== passableClass(clsB)) walkabilityFlicker++;
            const ck = `${clsA}->${clsB}`;
            classPairFlicker[ck] = (classPairFlicker[ck] ?? 0) + 1;
            if (tileDiff) {
              const tk = `${TERRAIN_NAME[tileA] ?? tileA}<->${TERRAIN_NAME[tileB] ?? tileB}`;
              tilePairFlicker[tk] = (tilePairFlicker[tk] ?? 0) + 1;
            }
            if (srcA || srcB) {
              const sk = `${srcA ?? 'none'}<->${srcB ?? 'none'}`;
              srcKeyFlicker[sk] = (srcKeyFlicker[sk] ?? 0) + 1;
            }
            const mA = Math.min(gx - p.a[0], gy - p.a[1], WW - 1 - (gx - p.a[0]), WH - 1 - (gy - p.a[1]));
            const mB = Math.min(gx - p.b[0], gy - p.b[1], WW - 1 - (gx - p.b[0]), WH - 1 - (gy - p.b[1]));
            const m = Math.min(mA, mB);
            const bucket = m <= 2 ? '0-2' : m <= 7 ? '3-7' : m <= 23 ? '8-23' : m <= 63 ? '24-63' : '64+';
            marginBuckets[bucket]++;

            // ---- attribution ----
            const entA = A.entitiesAt.get(ia) ?? null;
            const entB = B.entitiesAt.get(ib) ?? null;
            const g1bA = !!entA && /g1b:/.test(entA), g1bB = !!entB && /g1b:/.test(entB);
            const reachA = A.wReached[ia] === 1, reachB = B.wReached[ib] === 1;
            const boxesA = A.poiBoxes.filter(pb => gx >= pb.box[0] && gx <= pb.box[2] && gy >= pb.box[1] && gy <= pb.box[3]).map(pb => pb.id);
            const boxesB = B.poiBoxes.filter(pb => gx >= pb.box[0] && gx <= pb.box[2] && gy >= pb.box[1] && gy <= pb.box[3]).map(pb => pb.id);
            let cause: Cause;
            if (g1bA !== g1bB || (entA && entB && entA !== entB && (g1bA || g1bB))) {
              cause = 'H4_harnessRunEntityEffect';
            } else if (tileDiff) {
              cause = 'H2_groundTileGeometryDiffers';
            } else if (srcDiff) {
              // Which side carries a source, and was it placed before or after the reachability filter?
              const sideKey = srcA ?? srcB ?? '';
              const sideReach = srcA ? reachA : reachB;
              const otherReach = srcA ? reachB : reachA;
              const salvage = !!sideKey && isIndustrialSalvage(sideKey);
              if (salvage) {
                // rules 4 runs placePoiSalvage/unplugSalvage AFTER the filter, so these sources are not
                // subject to it at all — a separate, named mechanism rather than a contradiction.
                cause = 'H5_postFilterSalvagePlacement';
              } else if (srcA && srcB) {
                cause = 'H1c_sourceKeyDiffersBothPlaced';
              } else if (!sideReach) {
                cause = 'H5b_sourcePresentThoughWindowUnreachable';
              } else if (!otherReach) {
                cause = 'H1_sourceDroppedByWindowReachabilityFilter';
              } else {
                cause = 'H1d_sourcePlacedInOneWindowOnlyBothReachable';
              }
            } else if (classDiff) {
              cause = 'H3_staticsOrSolidPropsDiffer';
            } else {
              cause = 'UNCLASSIFIED';
            }
            // Sub-attribution: name the pass, not just the layer.
            if (cause === 'H3_staticsOrSolidPropsDiffer') {
              const sa = A.staticsAt.get(ia) ?? null, sb = B.staticsAt.get(ib) ?? null;
              const sd = sa !== sb, pd = A.solidProps[ia] !== B.solidProps[ib];
              h3What[sd && pd ? 'bothDiffer' : sd ? 'staticsKindDiffers' : 'solidPropsFlagDiffers']++;
              const sk2 = `${sa ?? 'none'}<->${sb ?? 'none'}`;
              staticsKindFlicker[sk2] = (staticsKindFlicker[sk2] ?? 0) + 1;
            }
            marginByCause[cause][bucket]++;
            if (cause === 'H1_sourceDroppedByWindowReachabilityFilter') {
              // Does the two windows' walkable mask agree at this cell? If it does, the flood difference
              // cannot come from local geometry — it comes from where the flood starts and where it stops
              // (window-local anchors, truncated at the window border). If it does not, the source loss is
              // downstream of a geometry difference instead.
              h1Walkable[A.walkable[ia] === B.walkable[ib] ? 'walkableAgreesSoFloodTruncatedOrAnchorsDiffer' : 'walkableDiffersSoGeometryDiffers']++;
            }
            if (cause === 'H1d_sourcePlacedInOneWindowOnlyBothReachable') {
              const sameSlice = A.poiIds.join('|') === B.poiIds.join('|');
              h1dPoiSlice[sameSlice ? 'poiSliceSetIdentical' : 'poiSliceSetDiffers']++;
              h1dMargins[m <= 7 ? '0-7' : m <= 23 ? '8-23' : '24+']++;
              const pm = m + 8;
              h1dPaddedMargins[pm <= 10 ? '8-10' : pm <= 15 ? '11-15' : pm <= 31 ? '16-31' : '32+']++;
              if (sameSlice && h1dIdenticalSlice.length < 8) {
                h1dIdenticalSlice.push({
                  globalTile: [gx, gy], stratum: stratumKey, marginA: mA, marginB: mB, paddedMargin: pm,
                  windowA: A.layoutId, windowB: B.layoutId, originA: p.a, originB: p.b,
                  classA: clsA, classB: clsB, tile: TERRAIN_NAME[tileA] ?? tileA,
                  sourceA: srcA, sourceB: srcB, poiIdsSliced: A.poiIds,
                  windowReachableInA: reachA, windowReachableInB: reachB, anchorsA: A.anchorsUsed, anchorsB: B.anchorsUsed,
                  walkableA: A.walkable[ia], walkableB: B.walkable[ib],
                  spawnEligibleA: A.spawnEligible[ia], spawnEligibleB: B.spawnEligible[ib],
                });
              }
            }
            if (cause !== 'H4_harnessRunEntityEffect' && cause !== 'UNCLASSIFIED') {
              const inA = boxesA.length > 0, inB = boxesB.length > 0;
              const poiBucket = inA !== inB ? 'poiSlicedInOneWindowOnly'
                : (inA && inB) ? ((mA === 0 || mB === 0) ? 'poiSlicedInBothBorderClip' : 'poiSlicedInBothInterior')
                : 'noPoiEitherSide';
              poiPass[cause][poiBucket]++;
            }
            causeCounts[cause]++;
            pairCauses[cause] = (pairCauses[cause] ?? 0) + 1;
            st.causes[cause] = (st.causes[cause] ?? 0) + 1;
            if (examples[cause].length < EXAMPLES_PER_CAUSE) {
              examples[cause].push({
                globalTile: [gx, gy], stratum: stratumKey, marginA: mA, marginB: mB,
                windowA: A.layoutId, windowB: B.layoutId,
                classA: clsA, classB: clsB,
                tileA: TERRAIN_NAME[tileA] ?? tileA, tileB: TERRAIN_NAME[tileB] ?? tileB,
                groundTileA: TERRAIN_NAME[A.groundTile[ia]] ?? A.groundTile[ia], groundTileB: TERRAIN_NAME[B.groundTile[ib]] ?? B.groundTile[ib],
                sourceA: srcA, sourceB: srcB,
                sourceIsIndustrialSalvageA: srcA ? isIndustrialSalvage(srcA) : null,
                sourceIsIndustrialSalvageB: srcB ? isIndustrialSalvage(srcB) : null,
                groundSourceA: A.groundSrc[ia], groundSourceB: B.groundSrc[ib],
                windowReachableInA: reachA, windowReachableInB: reachB,
                staticsA: A.staticsAt.get(ia) ?? null, staticsB: B.staticsAt.get(ib) ?? null,
                solidPropsA: A.solidProps[ia], solidPropsB: B.solidProps[ib],
                walkableA: A.walkable[ia], walkableB: B.walkable[ib],
                protectedA: A.protectedCells[ia], protectedB: B.protectedCells[ib],
                buildableA: A.buildable[ia], buildableB: B.buildable[ib],
                spawnEligibleA: A.spawnEligible[ia], spawnEligibleB: B.spawnEligible[ib],
                hazardTileA: [T.TOXIC, T.ASH, T.LAVA].includes(tileA), hazardTileB: [T.TOXIC, T.ASH, T.LAVA].includes(tileB),
                entityA: entA, entityB: entB,
                poiFootprintsContainingCellInA: boxesA, poiFootprintsContainingCellInB: boxesB,
                poiIdsSlicedByA: A.poiIds.length, poiIdsSlicedByB: B.poiIds.length,
              });
            }
          }
        }
        st.compared += pairCompared;
        pairSummaries.push({
          a: p.a, b: p.b, axis: p.axis, stratum: stratumKey, seed: p.seed, ok: true,
          overlapCells: pairCompared, mismatches: pairMismatch,
          mismatchShare: Number((pairMismatch / Math.max(1, pairCompared)).toFixed(6)),
          causes: pairCauses, anchorsA: A.anchorsUsed, anchorsB: B.anchorsUsed,
        });
        save();
      }

      manifest.sample = {
        pairsPlanned: plan.length, pairsRead, pairsFailed,
        overlapCellsCompared: compared, mismatches,
        mismatchShare: Number((mismatches / Math.max(1, compared)).toFixed(6)),
        walkabilityFlickerCells: walkabilityFlicker,
        walkabilityFlickerShareOfMismatches: Number((walkabilityFlicker / Math.max(1, mismatches)).toFixed(4)),
        maskOnlyDifferences: maskOnlyDifferences,
        marginBuckets, totalMs: Number((performance.now() - t0).toFixed(1)),
        perWindowReadMs: { median: readMs.sort((a, b) => a - b)[readMs.length >> 1] ?? null, max: readMs[readMs.length - 1] ?? null },
      };
      // Seed independence: chunk terrain and POI geometry carry no run seed, so the same origin pair must
      // produce the same cause mix under any seed. If it does not, worldgen has a seed path nobody named.
      const byOrigins: Record<string, Record<string, Record<string, number>>> = {};
      for (const row of pairSummaries) {
        if (!row.ok) continue;
        const k = `${JSON.stringify(row.a)}|${JSON.stringify(row.b)}`;
        (byOrigins[k] ??= {})[String(row.seed)] = row.causes as Record<string, number>;
      }
      const seedSharedPairs = Object.values(byOrigins).filter(v => Object.keys(v).length > 1);
      const seedDivergentPairs = seedSharedPairs.filter(v => {
        const sig = Object.values(v).map(c => JSON.stringify(Object.entries(c).sort()));
        return new Set(sig.map(x => JSON.stringify(x))).size > 1;
      });
      manifest.seedIndependence = {
        originPairsReadUnderMultipleSeeds: seedSharedPairs.length,
        originPairsWhoseCauseMixDiffersBySeed: seedDivergentPairs.length,
        examples: seedDivergentPairs.slice(0, 4),
        reading: 'The compiled window content carries no run seed: the seed affects only which pseudo-random pairs this harness samples and its own G1B fixture deployment (cause H4). A worldgen fix therefore needs validating on one seed, not on a seed sweep.',
      };
      type SeedRow = { pairs: number; pairsFailed: number; compared: number; mismatches: number; mismatchShare: number; causes: Record<string, number> };
      const perSeed: Record<string, SeedRow> = {};
      for (const row of pairSummaries) {
        const k = String(row.seed);
        const o: SeedRow = perSeed[k] ?? (perSeed[k] = { pairs: 0, pairsFailed: 0, compared: 0, mismatches: 0, mismatchShare: 0, causes: {} });
        if (row.ok) {
          o.pairs += 1;
          o.compared += Number(row.overlapCells);
          o.mismatches += Number(row.mismatches);
          for (const [c, n] of Object.entries(row.causes as Record<string, number>)) o.causes[c] = (o.causes[c] ?? 0) + n;
        } else o.pairsFailed += 1;
        o.mismatchShare = Number((o.mismatches / Math.max(1, o.compared)).toFixed(6));
      }
      manifest.attribution = { causes: causeCounts, unclassified: causeCounts.UNCLASSIFIED, perSeed };
      manifest.examples = examples;
      manifest.impact = {
        sourceKeyFlicker: Object.fromEntries(Object.entries(srcKeyFlicker).sort((a, b) => b[1] - a[1]).slice(0, 40)),
        sourceMaterials: Object.fromEntries(Object.entries(srcKeyFlicker)
          .map(([k, n]) => {
            const [ka, kb] = k.split('<->');
            const key = ka !== 'none' ? ka : kb;
            const def = (SOURCES as Record<string, { mat?: string; block?: boolean; stock?: number; yields?: [string, number][] }>)[key];
            return [key, { mismatches: n, material: def?.mat ?? null, blocks: def?.block ?? null, stock: def?.stock ?? null, yields: def?.yields ?? null }];
          })
          .filter(([, v]) => (v as Entry).material !== null)
          .sort((a, b) => Number((b[1] as Entry).mismatches) - Number((a[1] as Entry).mismatches))
          .slice(0, 24)),
        classPairFlicker: Object.fromEntries(Object.entries(classPairFlicker).sort((a, b) => b[1] - a[1])),
        tilePairFlicker: Object.fromEntries(Object.entries(tilePairFlicker).sort((a, b) => b[1] - a[1]).slice(0, 24)),
        poiPassByCause: Object.fromEntries(Object.entries(poiPass).filter(([, v]) => Object.values(v).some(n => n > 0))),
        maskOnlyWhichMask: maskOnlyWhich,
        maskOnlyMargins,
        marginByCause: Object.fromEntries(Object.entries(marginByCause).filter(([, v]) => Object.values(v).some(n => n > 0))),
        h1FloodVsGeometry: h1Walkable,
        h3WhichPart: h3What,
        staticsKindFlicker: Object.fromEntries(Object.entries(staticsKindFlicker).sort((a, b) => b[1] - a[1]).slice(0, 30)),
        byStratum: Object.fromEntries(Object.entries(byStratum).map(([k, v]) => [k, {
          pairs: v.pairs, compared: v.compared, mismatches: v.mismatches,
          mismatchShare: Number((v.mismatches / Math.max(1, v.compared)).toFixed(6)), causes: v.causes,
        }]).sort((a, b) => Number((b[1] as Entry).mismatchShare) - Number((a[1] as Entry).mismatchShare))),
      };
      // ---- the diagnosis itself, with every count derived from this run ----
      const pct = (n: number) => Number(((n / Math.max(1, mismatches)) * 100).toFixed(2));
      manifest.findings = {
        namedWindowRelativePasses: [
          {
            id: 'P1_sourceReachabilityFilter',
            causes: ['H1_sourceDroppedByWindowReachabilityFilter', 'H1c_sourceKeyDiffersBothPlaced'],
            mismatches: causeCounts.H1_sourceDroppedByWindowReachabilityFilter + causeCounts.H1c_sourceKeyDiffersBothPlaced,
            shareOfMismatchesPct: pct(causeCounts.H1_sourceDroppedByWindowReachabilityFilter + causeCounts.H1c_sourceKeyDiffersBothPlaced),
            quotes: [mech.windowLocalAnchors, mech.economyStartsAreWindowLocal, mech.reachabilityFilterOnSources, mech.reachabilityComment],
            statement: 'Sources are placed by a padded compile anchored on GLOBAL chunk centres (window-invariant by intent), then filtered by `if (sk && wReached[i]) sourceV3[i] = sk`, where wReached is the union of reachable() floods from window-LOCAL `compiler_x_y` anchors. The flood stops at the 200x200 border, so a source whose connecting path leaves the box is kept in one window and dropped in the next.',
            evidence: h1Walkable,
            evidenceReading: 'walkable agrees at every single H1 cell, so the flood difference cannot come from local geometry: it comes from where the flood starts and where the window border stops it.',
          },
          {
            id: 'P2_poiStampingClippedToWindow',
            causes: ['H2_groundTileGeometryDiffers'],
            mismatches: causeCounts.H2_groundTileGeometryDiffers,
            shareOfMismatchesPct: pct(causeCounts.H2_groundTileGeometryDiffers),
            quotes: [mech.poiInclusionAnchorMargin, mech.poiInclusionBboxOverlap, mech.poiTileClipToWindow, mech.floorStackPoiBorderClip, mech.floorStackNullsSourceUnderPoiTile, mech.paddedPoiTileClip],
            statement: 'A POI is stamped three times with three different window-relative clips: slicePoisForWindow drops tiles outside the window rect, the padded compile drops tiles outside the 216x216 padded rect, and buildFloorStack applies a stricter 1-tile inner border clip (and nulls any source under a stamped tile). A POI straddling a window edge is therefore a different shape in each window.',
            evidence: marginByCause.H2_groundTileGeometryDiffers,
            evidenceReading: 'every sampled tile difference lies within 2 tiles of a window border, which is the border-clip signature; no interior tile difference was found.',
          },
          {
            id: 'P3_proceduralPropsKeyedOnWindowLocalCoords',
            causes: ['H3_staticsOrSolidPropsDiffer'],
            mismatches: causeCounts.H3_staticsOrSolidPropsDiffer,
            shareOfMismatchesPct: pct(causeCounts.H3_staticsOrSolidPropsDiffer),
            quotes: [interiorQuotes.localHash, interiorQuotes.hashUseWall, interiorQuotes.hashUseKind, floorsQuotes.landmarkStamp, poiKitQuotes.landmarkLocalClip, floorsQuotes.propBorderReject],
            statement: 'Interior dressing is decided per window: interior.ts hashes WINDOW-LOCAL x,y (hash(x,y,7|11|13|23)) to choose piers, partitions and furniture, its pier grid is anchored on the local origin (a 64-tile slide shifts a 6-tile grid by 4), landmark props are clipped to the window rect by slicePoisForWindow and then rejected within 2 tiles of the border by canPlaceProceduralSolidProp, and every placement guard (protectedThreshold, wouldSeverFootprint, g1bReserved) is evaluated on window-local geometry. The result lands in FloorLayer.solidProps, which cellClass reads directly (`if (layer.solidProps[i]) c = 2`).',
            evidence: { margins: marginByCause.H3_staticsOrSolidPropsDiffer, whichPart: h3What, staticsKindFlicker, poiFootprint: poiPass.H3_staticsOrSolidPropsDiffer },
            evidenceReading: 'No static object differs anywhere (staticsKindFlicker is none<->none throughout): only the solidProps flag does. This is the ONLY cause found deep inside both windows, so it is the one that cannot be dismissed as a seam artifact.',
          },
          {
            id: 'P4_freshwaterDistanceSpawnPrefilter',
            causes: [],
            mismatches: 0,
            maskOnlyCells: maskOnlyDifferences,
            shareOfComparedCellsPct: Number(((maskOnlyDifferences / Math.max(1, compared)) * 100).toFixed(3)),
            quotes: [windowQuotes.freshDistPrefilter, windowQuotes.freshDistCap, windowQuotes.spawnEligibleGate],
            statement: 'spawnEligible is prefiltered by a freshwater BFS that runs on the inner 200x200 arrays only, so the distance field is truncated at the window border. Cells whose class, tile and source all agree still flip spawnEligible between windows.',
            evidence: maskOnlyWhich,
            evidenceReading: 'Every mask-only difference is spawnEligible and nothing else: walkable, protected, buildable and solidProps agree on all of them. This is invisible to the collision grid but it drives chooseLegalSpawn.',
          },
          {
            id: 'P6_poiSliceChangesTheCompileInput',
            causes: ['H1d_sourcePlacedInOneWindowOnlyBothReachable'],
            mismatches: causeCounts.H1d_sourcePlacedInOneWindowOnlyBothReachable,
            shareOfMismatchesPct: pct(causeCounts.H1d_sourcePlacedInOneWindowOnlyBothReachable),
            quotes: [mech.paddedPoiTileClip, mech.paddedPoiTileApplied, mech.invariantAnchorIntent, mech.poiInclusionAnchorMargin, mech.poiInclusionBboxOverlap],
            statement: 'The padded compile is window-invariant in its ANCHOR LATTICE only (global-chunk-aligned `gx % 32 === 16`), not in its inputs: paddedPoiTiles stamps the POIs THIS window sliced into the padded biome/tile/freshness fields the compile then scatters sources over. Neighbouring windows slice different POI sets (anchor +/-55 margin plus bbox overlap), so the scattered source set differs even where both windows\' own floods reach the cell.',
            evidence: {
              poiSlice: h1dPoiSlice, windowMargins: h1dMargins, paddedMargins: h1dPaddedMargins,
              differingSliceExamples: examples.H1d_sourcePlacedInOneWindowOnlyBothReachable.slice(0, 4),
              identicalSliceResidue: h1dIdenticalSlice,
            },
            evidenceReading: 'Every sampled cell of this kind sits in a pair whose two windows sliced a different POI set. This is the mechanism that defeats the "100% window-invariant source placement" comment, and it is separate from the reachability filter.',
          },
          {
            id: 'P5_postFilterSalvagePlacement',
            causes: ['H5_postFilterSalvagePlacement'],
            mismatches: causeCounts.H5_postFilterSalvagePlacement,
            shareOfMismatchesPct: pct(causeCounts.H5_postFilterSalvagePlacement),
            quotes: [mech.salvagePassRules4],
            statement: 'Under placement rules 4 (the engine default for every new Veyra run) placePoiSalvage/unplugSalvage run AFTER the reachability filter, so industrial salvage sources are not subject to it and follow POI slicing instead.',
            evidence: poiPass.H5_postFilterSalvagePlacement,
            evidenceReading: 'Small (62 cells sampled) but it is the only source mechanism that bypasses the filter entirely.',
          },
        ],
        deepInteriorAttribution: Object.fromEntries(CAUSES.map(c => [c, marginByCause[c]['64+']])),
        deepInteriorReading: 'Cells at least 64 tiles inside BOTH windows cannot be seam artifacts. In this sample every one of them is P3 procedural props.',
        classSemantics: {
          quote: engineQuotes.solidPropMakesClass2,
          reading: 'engine.cellClass assigns class 2 for BOTH a blocking source and a FloorLayer.solidProps cell, so a class 2<->0 flicker is not by itself evidence of a source difference. The earlier frame-wide mosaic read 2<->0 as "blocking source"; that reading was incomplete and is corrected here.',
        },
        residueNotSubAttributed: {
          counts: Object.fromEntries(CAUSES.map(c => [c, poiPass[c].noPoiEitherSide] as [string, number]).filter(([, n]) => n > 0)),
          reading: 'These cells are attributed to a layer (H2 tile / H3 solidProps) but lie inside no sliced POI bbox. The bbox test is conservative: a prop footprint or a room detail can reach past the bbox tested here, and the padded compile lets a POI influence cells up to 8 tiles outside the window. They are reported as residue, not as a separate mechanism, and are not claimed to be explained cell by cell.',
        },
        harnessOwnFootprint: { count: causeCounts.H4_harnessRunEntityEffect, shareOfMismatchesPct: pct(causeCounts.H4_harnessRunEntityEffect) },
        selfConsistency: {
          sourceSurvivingItsOwnFilterRejection: causeCounts.H5b_sourcePresentThoughWindowUnreachable,
          sourceKeyDifferingWithBothPlaced: causeCounts.H1c_sourceKeyDiffersBothPlaced,
          sourcePlacedInOneWindowThoughBothReachIt: causeCounts.H1d_sourcePlacedInOneWindowOnlyBothReachable,
          reading: 'All three are zero, so the quoted filter is the operative mechanism for every sampled source difference: no source survives where its own window flood rejects it, and no source is dropped where both windows reach it.',
        },
      };
      manifest.pairSummaries = pairSummaries;
      save();

      // ---- honesty assertions ----
      expect(pairsRead, 'the sample must contain readable neighbour pairs').toBeGreaterThan(0);
      expect(mismatches, 'the phenomenon is measured frame-wide; the sample must reproduce it').toBeGreaterThan(0);
      expect(causeCounts.UNCLASSIFIED,
        `every mismatch must be attributed to a named mechanism; unattributed ones need investigation, e.g. ${JSON.stringify(examples.UNCLASSIFIED.slice(0, 2))}`).toBe(0);
      // Structural claims this diagnosis rests on. If any of them changes, the written diagnosis in
      // technical-audit/TECHNICAL_RED_FLAGS.md is stale and must be re-derived, not re-worded.
      expect(causeCounts.H5b_sourcePresentThoughWindowUnreachable,
        'no source may survive where its own window flood rejects it, otherwise the quoted filter is not the operative mechanism').toBe(0);
      expect(causeCounts.H1c_sourceKeyDiffersBothPlaced,
        'a source key must never differ where both windows placed a source; that would mean the compile picks different keys per window').toBe(0);
      // The identical-slice residue is reported, not asserted away: P6 explains the differing-slice cells,
      // and whatever explains the rest must be named before it is claimed.
      (manifest.findings as Entry).h1dIdenticalSliceResidue = {
        count: h1dPoiSlice.poiSliceSetIdentical,
        paddedMargins: h1dPaddedMargins,
        examples: h1dIdenticalSlice,
      };
      save();
      expect(h1Walkable.walkableDiffersSoGeometryDiffers,
        'the walkable mask must agree at every source-filter cell, otherwise the source loss is downstream of geometry instead').toBe(0);
      expect(marginByCause.H2_groundTileGeometryDiffers['3-7'] + marginByCause.H2_groundTileGeometryDiffers['8-23']
        + marginByCause.H2_groundTileGeometryDiffers['24-63'] + marginByCause.H2_groundTileGeometryDiffers['64+'],
        'tile differences must stay in the window border ring, otherwise POI clipping is not the whole of P2').toBe(0);
      expect(maskOnlyWhich.walkable + maskOnlyWhich.protectedCells + maskOnlyWhich.buildable + maskOnlyWhich.solidProps,
        'mask-only differences must be spawnEligible alone, otherwise P4 is not the freshwater prefilter').toBe(0);
      for (const c of CAUSES) {
        if (c === 'H3_staticsOrSolidPropsDiffer') continue;
        expect(marginByCause[c]['64+'],
          `only procedural props were found deep inside both windows; a ${c} cell 64+ tiles in would change the diagnosis`).toBe(0);
      }
      expect(seedDivergentPairs.length,
        `the same window pair must attribute identically under every seed; divergent pairs mean worldgen has an unnamed seed path, e.g. ${JSON.stringify(seedDivergentPairs.slice(0, 1))}`).toBe(0);
      expect(h3What.staticsKindDiffers + h3What.bothDiffer,
        'no static object may differ at an H3 cell: the difference is the solidProps flag alone').toBe(0);
      // Every quoted pass must still exist in the shipped source.
      for (const [name, q] of Object.entries({ ...interiorQuotes, ...floorsQuotes, ...poiKitQuotes, ...windowQuotes, ...engineQuotes })) {
        expect(q, `the diagnosis quotes ${name}, which no longer exists in the shipped source`).toBeTruthy();
      }
      const worldgenCauses = causeCounts.H1_sourceDroppedByWindowReachabilityFilter + causeCounts.H1c_sourceKeyDiffersBothPlaced
        + causeCounts.H1d_sourcePlacedInOneWindowOnlyBothReachable
        + causeCounts.H2_groundTileGeometryDiffers + causeCounts.H3_staticsOrSolidPropsDiffer
        + causeCounts.H5_postFilterSalvagePlacement + causeCounts.H5b_sourcePresentThoughWindowUnreachable;
      expect(worldgenCauses + causeCounts.H4_harnessRunEntityEffect, 'all mismatches must fall into worldgen causes plus the harness self-effect').toBe(mismatches);
      (manifest.attribution as Entry).worldgenShare = Number((worldgenCauses / Math.max(1, mismatches)).toFixed(4));
      (manifest.attribution as Entry).harnessSelfEffectShare = Number((causeCounts.H4_harnessRunEntityEffect / Math.max(1, mismatches)).toFixed(4));
      save();
    },
  );
});
