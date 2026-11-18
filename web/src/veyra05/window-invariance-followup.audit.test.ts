/**
 * WINDOW-INVARIANCE FOLLOW-UP (Creator decision 2026-11-18, option E) — READ-ONLY diagnosis, harness only.
 *
 * This file changes nothing: no worldgen, engine, map, law or shipped-data line. It is not a fix and it
 * does not choose an option. It answers the three questions option E was approved for, in order:
 *
 *   E1  Why do source cells disagree between two windows that sliced the SAME POI set and whose own
 *       post-compile reachability floods BOTH reach the cell (the 25-cell residue of pass P6 in
 *       `window-content-origin-dependence.audit.test.ts`)? Hypothesis to prove or disprove: the compile's
 *       own eligibility flood is truncated at the padded rect (PAD = 8) and its anchor lattice is clipped
 *       to the window, so a bigger PAD would remove the disagreement.
 *       Method — no replica of `compileEconomy` is needed, and that is the point:
 *         · the per-cell draw is GLOBAL-keyed (`world-economy.ts` computes `gx = x + m.origin.x` and draws
 *           with `hash2(gx, gy, salt ^ stableHash(key))`), so the draw itself cannot differ per window;
 *         · the eligibility gate is `if (!m.walkable[i] || !reached[i] || ...) continue;`, where `reached`
 *           is the union of `reachable(m, s)` floods from `m.starts` — so `reached` depends ONLY on the
 *           padded walkable field and the padded anchor set, both of which this harness reconstructs
 *           exactly from `getChunk` + `slicePoisForWindow` + the pinned anchor rule;
 *         · therefore a disagreement in `reached` between two windows is a sufficient, checkable
 *           explanation for a source present in one and absent in the other, and sweeping PAD over the
 *           reconstruction prices the fix without touching shipped code.
 *       The reconstruction is validated two ways before it is believed: (a) NECESSITY — every non-salvage
 *       source the shipped window actually holds must sit on a cell this harness's `reached` marks 1, and
 *       (b) the reconstructed inner walkable field must equal the shipped `economyMap.walkable` except on
 *       cells an authored compound plan stamps (which `buildFloorStack` rewrites afterwards).
 *
 *   E2  How large is option B's blast radius? For EVERY authored POI in the frame, read the window that
 *       covers it and its +64 neighbour and count how many `solidProps` cells inside that POI's own bbox
 *       move when the window moves, plus how many rooms and props its compiled plan has. This turns
 *       "interior furniture is dressed per window" into a room count and a cell count, so option B can be
 *       priced instead of guessed.
 *
 *   E3  What does pass P1 cost a player? Mosaic the frame at the real slide stride, keep the source layer
 *       under both window bounds (optimistic = any covering window has it, conservative = every covering
 *       window has it), intersect with the legal start's reachable component measured by
 *       `global-foot-reachability.audit.test.ts`, and report how many harvestable nodes of each material
 *       flicker inside the region a player can actually walk to. Opt-in separately (SOH_WIF_E3=1) because
 *       it needs a full-frame mosaic.
 *
 * Run (E1 + E2, ~2 min):
 *   cd web && SOH_WINDOW_INVARIANCE_FOLLOWUP=1 npx vitest run --fileParallelism=false \
 *     --testTimeout=1800000 src/veyra05/window-invariance-followup.audit.test.ts
 * Run (E1 + E2 + E3 full-frame mosaic, ~15 min):
 *   cd web && SOH_WINDOW_INVARIANCE_FOLLOWUP=1 SOH_WIF_E3=1 npx vitest run --fileParallelism=false \
 *     --testTimeout=3600000 src/veyra05/window-invariance-followup.audit.test.ts
 *
 * OUTCOME (E1+E2 94 s, E3 full-frame mosaic 588.9 s, 1 test PASS; every reconstruction validated):
 *
 *   E1  The PAD-truncation hypothesis is DISPROVED. Raising PAD 8 -> 16 -> 24 -> 32 changes nothing at all:
 *       the compile-side flood still differs on exactly the same 239 cells at every PAD, because the anchor
 *       lattice spacing is 32 while the ring is only 8 wide, so a wider ring contains NO new lattice point.
 *       The real structure is the anchor loop, which is clipped to the INNER rect: it covers local [16,176]
 *       on each axis and leaves a 16-tile band and a 23-tile band with no anchor, and 807 of 1,105 sampled
 *       source disagreements (73%) sit in those anchor-free bands. Attribution ladder over 1,105 non-salvage
 *       source disagreements on 24 neighbour pairs: 239 (21.6%) the compile-side flood differs, 861 (77.9%)
 *       the POST-compile window-local filter differs (pass P1 of the previous audit), 5 (0.5%) neither, i.e.
 *       an extent-bound pass inside `compileEconomy` (blocker competition / isolation cleanup).
 *       Counterfactual, scored as a 2x2 against the shipped policy on those 239 cells: widening the anchor
 *       loop to the full padded rect at PAD 8 adds NO anchor (32 -> 32) and removes nothing; at PAD 16 it
 *       lifts anchors 32 -> 57 (+78%) for +15.36% compile area and removes 239/239 = 100%, never making a
 *       cell worse (0 regressions); PAD 24/32 add nothing beyond PAD 16 at +31.8%/+49.4% area. So PAD 16 is
 *       the cheapest sufficient setting for the compile-side part, and it does NOT touch the 861 filter cells.
 *   E2  Option B's blast radius, complete census of all 81 authored compounds (190 plan levels, 811 rooms,
 *       740 authored props): sliding the window by 64 moves 2,165 `solidProps` cells = 0.483% of the
 *       448,463 bbox cells read, in 79 of the 81 POIs, with the deepest moving cell 67 tiles inside BOTH
 *       windows. Worst: po_hook 111 cells, po_gulfhead 94, po_westmouth 91, po_saltharbor 83, po_sandgate 82.
 *       Measured at ONE offset per POI, so it is a lower bound on movement across all offsets.
 *   E3  Player impact of the source passes, full frame at stride 64 from the legal normal start
 *       (`veyra05-at-2560-704`, global (2568,716), qaUsed false — the same start the foot-reachability
 *       harness found, and the component sizes reproduce it EXACTLY: optimistic 2,997,383 cells,
 *       conservative 2,967,698, from an independently written mosaic). Frame-wide: 490,206 cells hold a
 *       source in at least one covering window and 36,523 of them (7.45%) are contested — 21,916 present in
 *       one window and absent in another, 14,607 a different key in another. Inside the region the player can
 *       actually walk to: 148,733 optimistic source cells, 117,400 uncontested (identical under both bounds),
 *       31,333 contested = 21.07% of the component's source cells (~1.05% of its area), of which 10,891 are
 *       `block: true`. By material: mixed keys 11,576, plant 8,866, wood 8,116, stone 1,644, ore 933.
 *       NOTE the denominators: 0.1209% (previous audit) counts disagreeing READINGS over 49M overlapping
 *       readings; 7.45%/21.07% here count CELLS that any covering window disagrees about. Both are true and
 *       they must never be quoted interchangeably.
 *
 * Reconstruction validation (all asserted, all zero violations): 212,804 non-salvage sources observed and
 * none on a cell the reconstructed compile-side flood cannot reach; none rejected by the reconstructed
 * post-compile filter; 1,920,000 inner walkable cells compared with 11,551 disagreements, every one of them
 * on a cell an authored compound plan stamps, 0 unexplained.
 *
 * NOT claimed: nothing here is release readiness, nothing is an experience judgement, and no option is
 * selected. Windows are read through QA inspection landings purely so a real `blockGrid` exists; a QA
 * landing is never playable evidence. The only player-route fact used is the legal normal start. The
 * counterfactual scores the FLOOD, not the final output: equal floods do not force equal sources, because
 * the blocker competition and isolation cleanup inside `compileEconomy` remain extent-bound.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { T, TERRAIN_NAME, WW, WH, TILE } from '../game/core';
import { blockGrid, markDirty, newGame, startRun } from '../game/engine';
import { getWorld, setActiveLayout } from '../game/world';
import { getWindowWorld, getVeyraPlacementRules, resetWindowToGround, setVeyraPlacementRules } from './window';
import { VEYRA05_SCENES, U05_WORLD_LAYOUT_ID, layoutIdAt } from './scenes';
import { CHUNK, FRAME_H, FRAME_W, auToTile } from './frame';
import { playerGlobalTile, windowOrigin } from './continuity';
import { getChunk } from './chunks';
import { POIS } from './reader';
import { getPoiLayout, slicePoisForWindow } from './poi-kit';
import { authoredPlan } from './floors';
import { SOURCES, isIndustrialSalvage } from '../game/catalog';

type Entry = Record<string, unknown>;
const root = path.resolve(process.cwd(), 'evidence/veyra-window-invariance-followup');
const output = path.join(root, 'manifest.json');
const EPOCH = Date.UTC(2026, 10, 18, 12);
const SEEDS = (process.env.SOH_WIF_SEEDS || '901').split(',').map(v => Number(v.trim())).filter(n => Number.isFinite(n));
const E1_PAIRS = Number(process.env.SOH_WIF_PAIRS || '48');
const E3_ON = process.env.SOH_WIF_E3 === '1';
const E3_STRIDE = Number(process.env.SOH_WIF_E3_STRIDE || '64');
const E3_SEED = Number(process.env.SOH_WIF_E3_SEED || '901');
const SLIDE_STEP = 64;
const PAD_SHIPPED = 8;
const PAD_SWEEP = [8, 16, 24, 32];
const maxX = FRAME_W - WW, maxY = FRAME_H - WH;

const manifest: Entry = {
  schema: 'veyra-window-invariance-followup-v1',
  executedAt: new Date().toISOString(),
  engineRevision: process.env.SOH_ENGINE_REVISION ?? 'working tree',
  scope: 'READ-ONLY follow-up diagnosis (Creator option E). No worldgen, engine, map, law or shipped-data change; no option chosen; no fix implemented.',
  config: {
    seeds: SEEDS.join(','), e1Pairs: E1_PAIRS, padShipped: PAD_SHIPPED, padSweep: PAD_SWEEP.join(','),
    slideStep: SLIDE_STEP, placementRules: null as number | null,
    e3: { enabled: E3_ON, stride: E3_STRIDE, seed: E3_SEED },
  },
  notes: [
    'Windows are entered through a QA inspection landing (qaUsed=true) purely so a real RunState and therefore the real blockGrid/source layer exist. QA landings are never playable evidence.',
    'E1 reconstructs only the two inputs of the compile eligibility flood (padded walkable, padded anchors) and never re-runs source drawing, because the draw is global-keyed and therefore cannot differ per window. The reconstruction is validated before it is believed.',
    'E2 reads every authored POI in the frame, so its blast-radius counts are complete for authored compounds and make no claim about procedural (non-authored) POIs beyond what it measures.',
  ],
};

function save() {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
}

/** Quote a line out of a shipped file, so no claim in this diagnosis can outlive the code it explains. */
function quote(rel: string, re: RegExp) {
  const ls = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8').split('\n');
  for (let i = 0; i < ls.length; i++) if (re.test(ls[i])) return { file: rel, line: i + 1, text: ls[i].trim().slice(0, 240) };
  return null;
}

function pinQuotes() {
  return {
    // The compile's own eligibility gate and its global-keyed draw.
    compileReachedGate: quote('src/game/world-economy.ts', /if\(!m\.walkable\[i\]\|\|!reached\[i\]\|\|m\.protected\[i\]\|\|m\.road\[i\]\|/),
    compileReachedIsUnionOfAnchorFloods: quote('src/game/world-economy.ts', /const reached=new Uint8Array\(n\); for\(const s of m\.starts\)/),
    compileDrawIsGlobalKeyed: quote('src/game/world-economy.ts', /const gx=x\+\(m\.origin\?\.x\?\?0\),gy=y\+\(m\.origin\?\.y\?\?0\);/),
    compileDrawHashUsesGlobal: quote('src/game/world-economy.ts', /hash2\(gx,gy,salt \^ stableHash\(key\)\)/),
    compileBlockerCompetitionIsExtentBound: quote('src/game/world-economy.ts', /if\(OFFSETS\.some\(\(\[dx,dy\]\)=>accepted\[\(y\+dy\)\*m\.width\+x\+dx\]\)\)out\[i\]=null;else accepted\[i\]=1;/),
    compileIsolationCleanupFloodsFromStarts: quote('src/game/world-economy.ts', /const accessible = new Uint8Array\(n\); for \(const start of m\.starts\)/),
    // The padded anchor lattice: global-aligned by intent, but clipped to the INNER window rows/cols.
    padConstant: quote('src/veyra05/window.ts', /const PAD = 8, PW = WW \+ PAD \* 2/),
    pAnchorLoopIsClippedToInnerRect: quote('src/veyra05/window.ts', /for \(let py = 8; py < PH - 8; py\+\+\) \{/),
    pAnchorGlobalLatticeRule: quote('src/veyra05/window.ts', /if \(\(gy & 31\) !== 16\) continue;/),
    pAnchorRequiresWalkable: quote('src/veyra05/window.ts', /if \(pWalk\[py \* PW \+ px\]\) pAnchors\.push/),
    pWalkDefinition: quote('src/veyra05/window.ts', /pWalk\[pi\] = \+\(!water && !isCliff\);/),
    paddedPoiTileClip: quote('src/veyra05/window.ts', /if \(px >= 0 && py >= 0 && px < PW && py < PH\) paddedPoiTiles\.set/),
    paddedOrigin: quote('src/veyra05/window.ts', /originTx: win\.originTx - PAD, originTy: win\.originTy - PAD/),
    postCompileFilter: quote('src/veyra05/window.ts', /if \(sk && wReached\[i\]\) sourceV3\[i\] = sk;/),
    // E2's mechanism: interior dressing keyed on window-local coordinates.
    interiorHashIsLocal: quote('src/veyra05/arch/interior.ts', /^const hash = \(x: number, y: number/),
    interiorLocalKey: quote('src/veyra05/arch/interior.ts', /^const KEY = \(x: number, y: number\)/),
    landmarkRejectedNearBorder: quote('src/veyra05/floors.ts', /if \(cx <= 1 \|\| cy <= 1 \|\| cx >= WW - 2 \|\| cy >= WH - 2\) return false;/),
    floorStackCopiesWorldTiles: quote('src/veyra05/floors.ts', /const tiles = Uint8Array\.from\(base\.tiles\);/),
    // E3's consumer facts.
    spawnEligibleIsTheOnlyConsumer: quote('src/game/engine.ts', /const mask=candidateMask \?\? w\.spawnEligible;/),
    solidPropMakesClass2: quote('src/game/engine.ts', /if \(layer\.solidProps\[i\]\) c = 2;/),
  };
}

/* ------------------------------------------------------------------ shared window reading */

interface WinRead {
  ok: boolean;
  reason: string | null;
  layoutId: string;
  origin: [number, number];
  ms: number;
  /** shipped, post-`resetWindowToGround` */
  cls: Uint8Array;
  tile: Uint8Array;
  src: (string | null)[];
  walkable: Uint8Array;
  solidProps: Uint8Array;
  /** reconstructed padded walkable field for the shipped PAD */
  padWalk: Uint8Array;
  padW: number;
  padH: number;
  /** reconstructed padded anchors under the shipped rule (lattice inside the inner rect, walkable) */
  anchorsPad: [number, number][];
  /** reconstructed PRE-floor inner walkable: `pWalk` sampled at the PAD offset, i.e. what the compile saw */
  innerWalkPre: Uint8Array;
  /** reconstructed post-compile filter flood: window-local `compiler_x_y` anchors over innerWalkPre */
  wReachedRecon: Uint8Array;
  innerAnchors: [number, number][];
  /** authored-plan stamped cells in inner coordinates (what `buildFloorStack` rewrites after the compile) */
  authoredStamps: Set<number>;
  poiIds: string[];
  poiBoxes: { id: string; box: [number, number, number, number] }[];
}

const EMPTY_READ: Omit<WinRead, 'layoutId' | 'origin' | 'ms' | 'reason'> = {
  ok: false, cls: new Uint8Array(0), tile: new Uint8Array(0), src: [], walkable: new Uint8Array(0),
  solidProps: new Uint8Array(0), padWalk: new Uint8Array(0), padW: 0, padH: 0, anchorsPad: [],
  innerWalkPre: new Uint8Array(0), wReachedRecon: new Uint8Array(0), innerAnchors: [],
  authoredStamps: new Set<number>(), poiIds: [], poiBoxes: [],
};

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

/** Reconstruct the padded walkable field exactly as `buildWindowWorld` computes `pWalk`. */
function reconstructPadWalk(origin: [number, number], pad: number, poiIds: string[]) {
  const PW = WW + pad * 2, PH = WH + pad * 2;
  const ox = origin[0] - pad, oy = origin[1] - pad;
  const padWalk = new Uint8Array(PW * PH);
  // POI tile overrides, built from the INNER window's slice exactly like `paddedPoiTiles`.
  const overrides = new Map<number, number>();
  for (const pid of poiIds) {
    const l = getPoiLayout(pid);
    for (const [gk, t] of l.tiles) {
      const gx = gk % FRAME_W, gy = (gk / FRAME_W) | 0;
      const px = gx - ox, py = gy - oy;
      if (px >= 0 && py >= 0 && px < PW && py < PH) overrides.set(py * PW + px, t);
    }
  }
  const chunkCache = new Map<string, ReturnType<typeof getChunk>>();
  for (let py = 0; py < PH; py++) {
    for (let px = 0; px < PW; px++) {
      const gx = ox + px, gy = oy + py;
      // Frame-edge cells keep pWalk = 0 in the shipped loop (the branch `continue`s before assigning it).
      if (gx <= 0 || gy <= 0 || gx >= FRAME_W - 1 || gy >= FRAME_H - 1) continue;
      const cx = Math.floor(gx / CHUNK), cy = Math.floor(gy / CHUNK), k = cx + ':' + cy;
      let c = chunkCache.get(k);
      if (!c) { c = getChunk(cx, cy); chunkCache.set(k, c); }
      const ci = (gy - cy * CHUNK) * CHUNK + (gx - cx * CHUNK);
      const ov = overrides.get(py * PW + px);
      const t = ov !== undefined ? ov : c.tile[ci];
      const water = t === T.DEEP || t === T.SHALLOW || t === T.RIVER;
      const isCliff = t === T.CLIFF || t === T.PWALL;
      padWalk[py * PW + px] = water || isCliff ? 0 : 1;
    }
  }
  return { padWalk, PW, PH, ox, oy };
}

/** The shipped padded anchor lattice: global `& 31 === 16`, clipped to the INNER rect, walkable only. */
function paddedAnchors(padWalk: Uint8Array, PW: number, PH: number, ox: number, oy: number, pad: number, innerOnly: boolean) {
  const out: [number, number][] = [];
  const from = innerOnly ? pad : 0, toX = innerOnly ? PW - pad : PW, toY = innerOnly ? PH - pad : PH;
  for (let py = from; py < toY; py++) {
    const gy = oy + py;
    if ((gy & 31) !== 16) continue;
    for (let px = from; px < toX; px++) {
      const gx = ox + px;
      if ((gx & 31) !== 16) continue;
      if (padWalk[py * PW + px]) out.push([px, py]);
    }
  }
  return out;
}

/** Union of 4-neighbour floods over the padded walkable field from the given anchors. */
function floodUnion(padWalk: Uint8Array, PW: number, PH: number, anchors: [number, number][]) {
  const reached = new Uint8Array(PW * PH);
  const q = new Int32Array(PW * PH);
  for (const [ax, ay] of anchors) {
    let head = 0, tail = 0;
    const seen = new Uint8Array(PW * PH);
    const s = ay * PW + ax;
    if (!padWalk[s] || seen[s]) continue;
    seen[s] = 1; q[tail++] = s;
    while (head < tail) {
      const i = q[head++];
      reached[i] = 1;
      const x = i % PW, y = (i / PW) | 0;
      if (x > 0 && !seen[i - 1] && padWalk[i - 1]) { seen[i - 1] = 1; q[tail++] = i - 1; }
      if (x + 1 < PW && !seen[i + 1] && padWalk[i + 1]) { seen[i + 1] = 1; q[tail++] = i + 1; }
      if (y > 0 && !seen[i - PW] && padWalk[i - PW]) { seen[i - PW] = 1; q[tail++] = i - PW; }
      if (y + 1 < PH && !seen[i + PW] && padWalk[i + PW]) { seen[i + PW] = 1; q[tail++] = i + PW; }
    }
  }
  return reached;
}

function readWindow(layoutId: string, origin: [number, number], seed: number): WinRead {
  const t0 = performance.now();
  if (!setActiveLayout(layoutId)) return { ...EMPTY_READ, reason: 'layout unavailable', layoutId, origin, ms: 0 };
  let ww;
  let landing: [number, number] | null = null;
  try {
    ww = getWindowWorld(layoutId);
    resetWindowToGround(ww);
    landing = pickLanding(layoutId);
  } catch (e) {
    return { ...EMPTY_READ, reason: `compile threw: ${String((e as Error)?.message ?? e)}`, layoutId, origin, ms: performance.now() - t0 };
  }
  if (!landing) return { ...EMPTY_READ, reason: 'no cell satisfies the engine inspectAt landing criteria', layoutId, origin, ms: performance.now() - t0 };
  const gs = newGame();
  const res = startRun(gs, 'female', EPOCH, null, seed, { tx: landing[0], ty: landing[1] }) as { ok: boolean; reason?: string };
  if (!res.ok || !gs.run) return { ...EMPTY_READ, reason: res.reason ?? 'no run', layoutId, origin, ms: performance.now() - t0 };
  const r = gs.run;
  setActiveLayout(layoutId);
  markDirty();
  const n = WW * WH;
  const w = getWorld();
  const cls = new Uint8Array(n);
  cls.set(blockGrid(r));
  const tile = new Uint8Array(n);
  tile.set(w.tiles);
  const slice = slicePoisForWindow({ originTx: origin[0], originTy: origin[1], w: WW, h: WH });
  const { padWalk, PW, PH, ox, oy } = reconstructPadWalk(origin, PAD_SHIPPED, slice.poiIds);
  const anchorsPad = paddedAnchors(padWalk, PW, PH, ox, oy, PAD_SHIPPED, true);
  // The compile's own view of the inner window: pWalk sampled at the PAD offset. This is PRE-floor-stack,
  // unlike the shipped `economyMap.walkable`, which `resetWindowToGround` overwrites with authored stamps.
  const innerWalkPre = new Uint8Array(WW * WH);
  for (let y = 0; y < WH; y++) {
    for (let x = 0; x < WW; x++) innerWalkPre[y * WW + x] = padWalk[(y + PAD_SHIPPED) * PW + (x + PAD_SHIPPED)];
  }
  // The post-compile filter's anchors, reconstructed from the pinned rule (local 20..180 step 40, walkable).
  const innerAnchors: [number, number][] = [];
  for (let y = 20; y < WH - 20; y += 40) for (let x = 20; x < WW - 20; x += 40) if (innerWalkPre[y * WW + x]) innerAnchors.push([x, y]);
  const wReachedRecon = new Uint8Array(WW * WH);
  {
    const q = new Int32Array(WW * WH);
    for (const [ax, ay] of innerAnchors) {
      let head = 0, tail = 0;
      const seen = new Uint8Array(WW * WH);
      const s0 = ay * WW + ax;
      if (seen[s0]) continue;
      seen[s0] = 1; q[tail++] = s0;
      while (head < tail) {
        const i = q[head++];
        wReachedRecon[i] = 1;
        const x = i % WW, y = (i / WW) | 0;
        if (x > 0 && !seen[i - 1] && innerWalkPre[i - 1]) { seen[i - 1] = 1; q[tail++] = i - 1; }
        if (x + 1 < WW && !seen[i + 1] && innerWalkPre[i + 1]) { seen[i + 1] = 1; q[tail++] = i + 1; }
        if (y > 0 && !seen[i - WW] && innerWalkPre[i - WW]) { seen[i - WW] = 1; q[tail++] = i - WW; }
        if (y + 1 < WH && !seen[i + WW] && innerWalkPre[i + WW]) { seen[i + WW] = 1; q[tail++] = i + WW; }
      }
    }
  }
  // Cells an authored compound plan stamps: `buildFloorStack` rewrites tiles/walkable/sources there AFTER
  // the compile, so they are the only legitimate place the reconstruction may disagree with the shipped map.
  const authoredStamps = new Set<number>();
  for (const pid of slice.poiIds) {
    const plan = authoredPlan(pid);
    if (!plan) continue;
    for (const [, L] of plan.levels) {
      for (const [gk] of L.tiles) {
        const gx = gk % FRAME_W, gy = (gk / FRAME_W) | 0;
        const x = gx - origin[0], y = gy - origin[1];
        if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
        authoredStamps.add(y * WW + x);
      }
    }
  }
  r.ended = { at: EPOCH, reason: 'window-invariance follow-up diagnosis cleanup' } as never;
  return {
    ok: true, reason: null, layoutId, origin, ms: performance.now() - t0,
    cls, tile, src: w.sourceV3.slice(),
    walkable: Uint8Array.from(w.economyMap.walkable),
    solidProps: Uint8Array.from(ww.floors.ground.solidProps),
    padWalk, padW: PW, padH: PH, anchorsPad, innerWalkPre, wReachedRecon, innerAnchors, authoredStamps,
    poiIds: slice.poiIds,
    poiBoxes: slice.poiIds.map(id => {
      const l = getPoiLayout(id);
      return { id, box: [l.bbox[0], l.bbox[1], l.bbox[2], l.bbox[3]] as [number, number, number, number] };
    }),
  };
}

/* ------------------------------------------------------------------ E1 pair sample */

function e1PairPlan(count: number) {
  const out: { a: [number, number]; b: [number, number]; axis: 'x' | 'y'; stratum: string }[] = [];
  const clampO = (v: number, max: number) => Math.max(0, Math.min(max - SLIDE_STEP, Math.round(v / SLIDE_STEP) * SLIDE_STEP));
  const push = (gx: number, gy: number, axis: 'x' | 'y', stratum: string, jitter = 0) => {
    const ox = clampO(gx - WW / 2 + jitter, maxX);
    const oy = clampO(gy - WH / 2 + jitter, maxY);
    const b: [number, number] = axis === 'x' ? [Math.min(maxX, ox + SLIDE_STEP), oy] : [ox, Math.min(maxY, oy + SLIDE_STEP)];
    if (b[0] === ox && b[1] === oy) return;
    out.push({ a: [ox, oy], b, axis, stratum });
  };
  for (const s of VEYRA05_SCENES) {
    const [gx, gy] = auToTile(s.focusAu[0], s.focusAu[1]);
    push(gx, gy, 'x', `scene:${s.short}`);
    push(gx, gy, 'y', `scene:${s.short}`, SLIDE_STEP);
  }
  // The exact cells the previous audit could not explain, so the residue is re-read deliberately.
  push(3267, 1665, 'y', 'residue:cinder-ash');
  push(519, 1280, 'y', 'residue:westmouth-sand');
  push(1731, 1109, 'x', 'residue:greywater-pumphouse');
  let state = (901 * 2654435761) >>> 0;
  const rnd = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    push(Math.floor(rnd() * FRAME_W), Math.floor(rnd() * FRAME_H), rnd() < 0.5 ? 'x' : 'y', 'frame-spread', Math.floor(rnd() * 3) * SLIDE_STEP);
  }
  return out.slice(0, count);
}

describe('Window-invariance follow-up (read-only, Creator option E)', () => {
  it.skipIf(process.env.SOH_WINDOW_INVARIANCE_FOLLOWUP !== '1')(
    'answers E1 (why the source residue disagrees, and what a bigger PAD would buy) and E2 (option B blast radius) without changing any shipped line',
    { timeout: Number(process.env.SOH_WIF_TIMEOUT ?? 1800000) },
    () => {
      const q = pinQuotes();
      manifest.quotes = q;
      for (const [name, val] of Object.entries(q)) {
        expect(val, `this diagnosis quotes ${name}, which no longer exists in the shipped source`).toBeTruthy();
      }
      setVeyraPlacementRules(4);
      (manifest.config as Entry).placementRules = getVeyraPlacementRules();

      /* ------------------------------------------------------------ E1 */
      const plan = e1PairPlan(E1_PAIRS);
      const e1 = {
        pairsPlanned: plan.length, pairsRead: 0, pairsFailed: 0,
        // reconstruction validation
        validation: {
          windowsValidated: 0,
          nonSalvageSources: 0,
          sourcesOnUnreachedCells: 0,
          sourcesOnUnreachedCellsExamples: [] as Entry[],
          sourcesRejectedByReconstructedPostFilter: 0,
          sourcesRejectedByReconstructedPostFilterExamples: [] as Entry[],
          innerAnchorsPerWindow: [] as number[],
          innerWalkableCells: 0,
          innerWalkableDisagreements: 0,
          innerWalkableDisagreementsOnAuthoredStamps: 0,
          innerWalkableUnexplained: 0,
          innerWalkableUnexplainedExamples: [] as Entry[],
        },
        // anchor geometry, measured rather than assumed
        anchors: { perWindow: [] as number[], latticeSpanLocal: [16, 176] as [number, number], anchorFreeBandLow: 16, anchorFreeBandHigh: 23 },
        sourceDisagreements: 0,
        residueIdenticalSlice: 0,
        byExplanation: {
          step1_compileSideFloodDiffers: 0,
          step2_postCompileFilterDiffers: 0,
          step3_neitherSoALaterPassInsideTheCompileDiffers: 0,
        } as Record<string, number>,
        // Counterfactual grid: what a wider anchor lattice and/or a bigger PAD would change about the
        // compile-side flood. Read as an UPPER BOUND on what such a change would fix, not a guarantee:
        // the per-cell draw is global-keyed, but the blocker competition and the isolation cleanup inside
        // `compileEconomy` are still extent-bound, so equal floods do not by themselves force equal output.
        counterfactual: {} as Entry,
        byBand: { insideAnchorLattice: 0, inAnchorFreeBand: 0 } as Record<string, number>,
        paddedMarginOfDisagreements: { '8-10': 0, '11-15': 0, '16-23': 0, '24-31': 0, '32+': 0 } as Record<string, number>,
        padSweep: {} as Entry,
        examples: [] as Entry[],
      };
      const sweepTotals: Record<number, { reachedDiffers: number; disagreementsStillUnexplained: number }> = {};
      for (const pad of PAD_SWEEP) sweepTotals[pad] = { reachedDiffers: 0, disagreementsStillUnexplained: 0 };
      // Anchor-policy counterfactual. The shipped loop clips the global lattice to the INNER rect; the
      // alternative keeps the same lattice but lets it cover the whole padded rect. Because the lattice
      // spacing is 32 and PAD is 8, an 8-tile ring contains NO lattice point at all, so widening the loop
      // at PAD 8 must add zero anchors — which is itself a finding, and is measured here rather than assumed.
      const POLICIES: { name: string; pad: number; innerOnly: boolean }[] = [
        { name: 'shipped_innerOnly_pad8', pad: 8, innerOnly: true },
        { name: 'fullPaddedRect_pad8', pad: 8, innerOnly: false },
        { name: 'fullPaddedRect_pad16', pad: 16, innerOnly: false },
        { name: 'fullPaddedRect_pad24', pad: 24, innerOnly: false },
        { name: 'fullPaddedRect_pad32', pad: 32, innerOnly: false },
      ];
      type CfCell = { A: Uint8Array; B: Uint8Array; PW: number; pad: number };
      const counterfactual: Record<string, { bothAgree: number; shippedDiffersPolicyAgrees: number; shippedAgreesPolicyDiffers: number; bothDiffer: number; anchorsA: number[]; anchorsB: number[]; flood: Record<string, CfCell | null> }> = {};
      for (const pol of POLICIES) counterfactual[pol.name] = { bothAgree: 0, shippedDiffersPolicyAgrees: 0, shippedAgreesPolicyDiffers: 0, bothDiffer: 0, anchorsA: [], anchorsB: [], flood: {} };
      const t0 = performance.now();

      for (const p of plan) {
        const A = readWindow(layoutIdAt(p.a[0], p.a[1]), p.a, SEEDS[0]);
        const B = readWindow(layoutIdAt(p.b[0], p.b[1]), p.b, SEEDS[0]);
        if (!A.ok || !B.ok) { e1.pairsFailed++; continue; }
        e1.pairsRead++;
        e1.anchors.perWindow.push(A.anchorsPad.length, B.anchorsPad.length);

        // ---- validate the reconstruction on BOTH windows before using it ----
        for (const W of [A, B]) {
          e1.validation.windowsValidated++;
          e1.validation.innerAnchorsPerWindow.push(W.innerAnchors.length);
          const reached = floodUnion(W.padWalk, W.padW, W.padH, W.anchorsPad);
          for (let y = 0; y < WH; y++) {
            for (let x = 0; x < WW; x++) {
              const i = y * WW + x, pi = (y + PAD_SHIPPED) * W.padW + (x + PAD_SHIPPED);
              // (a) NECESSITY: a source the shipped window holds must sit on a cell the compile could reach.
              const key = W.src[i];
              if (key && !isIndustrialSalvage(key)) {
                e1.validation.nonSalvageSources++;
                if (!reached[pi]) {
                  e1.validation.sourcesOnUnreachedCells++;
                  if (e1.validation.sourcesOnUnreachedCellsExamples.length < 6) {
                    e1.validation.sourcesOnUnreachedCellsExamples.push({ window: W.layoutId, local: [x, y], global: [W.origin[0] + x, W.origin[1] + y], source: key });
                  }
                }
              }
              // (a2) the post-compile filter must also accept every source the shipped window holds.
              if (key && !isIndustrialSalvage(key) && !W.wReachedRecon[i]) {
                e1.validation.sourcesRejectedByReconstructedPostFilter++;
                if (e1.validation.sourcesRejectedByReconstructedPostFilterExamples.length < 6) {
                  e1.validation.sourcesRejectedByReconstructedPostFilterExamples.push({ window: W.layoutId, local: [x, y], source: key });
                }
              }
              // (b) the reconstructed inner walkable must equal the shipped one except under authored stamps.
              e1.validation.innerWalkableCells++;
              if (W.padWalk[pi] !== W.walkable[i]) {
                e1.validation.innerWalkableDisagreements++;
                if (W.authoredStamps.has(i)) e1.validation.innerWalkableDisagreementsOnAuthoredStamps++;
                else {
                  e1.validation.innerWalkableUnexplained++;
                  if (e1.validation.innerWalkableUnexplainedExamples.length < 6) {
                    e1.validation.innerWalkableUnexplainedExamples.push({ window: W.layoutId, local: [x, y], reconstructed: W.padWalk[pi], shipped: W.walkable[i], tile: TERRAIN_NAME[W.tile[i]] ?? W.tile[i], poiIds: W.poiIds });
                  }
                }
              }
            }
          }
        }

        // ---- PAD sweep. The sweep needs NO run and NO compile: `reached` depends only on the padded
        // walkable field and the padded anchor set, both reconstructed from chunks + the POI slice.
        // One reconstruction per PAD is shared by the sweep and by the anchor-policy counterfactual.
        type PadField = { padWalk: Uint8Array; PW: number; PH: number };
        const recon: Record<number, { ka: PadField; kb: PadField }> = {};
        for (const pad of PAD_SWEEP) {
          recon[pad] = {
            ka: pad === PAD_SHIPPED ? { padWalk: A.padWalk, PW: A.padW, PH: A.padH } : reconstructPadWalk(p.a, pad, A.poiIds),
            kb: pad === PAD_SHIPPED ? { padWalk: B.padWalk, PW: B.padW, PH: B.padH } : reconstructPadWalk(p.b, pad, B.poiIds),
          };
        }
        const floodFor = (pad: number, innerOnly: boolean) => {
          const { ka, kb } = recon[pad];
          return {
            A: floodUnion(ka.padWalk, ka.PW, ka.PH, paddedAnchors(ka.padWalk, ka.PW, ka.PH, p.a[0] - pad, p.a[1] - pad, pad, innerOnly)),
            B: floodUnion(kb.padWalk, kb.PW, kb.PH, paddedAnchors(kb.padWalk, kb.PW, kb.PH, p.b[0] - pad, p.b[1] - pad, pad, innerOnly)),
            PW: ka.PW,
          };
        };
        const sweep: Record<number, { A: Uint8Array; B: Uint8Array; PW: number }> = {};
        for (const pad of PAD_SWEEP) sweep[pad] = floodFor(pad, true);

        // Per-policy floods for this pair (the shipped policy is PAD 8 with the lattice clipped to the
        // inner rect; the alternatives let the same global lattice cover the whole padded rect).
        for (const pol of POLICIES) {
          const cell = pol.innerOnly ? sweep[PAD_SHIPPED] : floodFor(pol.pad, false);
          counterfactual[pol.name].flood['this'] = { ...cell, pad: pol.pad };
          const { ka, kb } = recon[pol.pad];
          counterfactual[pol.name].anchorsA.push(paddedAnchors(ka.padWalk, ka.PW, ka.PH, p.a[0] - pol.pad, p.a[1] - pol.pad, pol.pad, pol.innerOnly).length);
          counterfactual[pol.name].anchorsB.push(paddedAnchors(kb.padWalk, kb.PW, kb.PH, p.b[0] - pol.pad, p.b[1] - pol.pad, pol.pad, pol.innerOnly).length);
        }
        const sameSlice = A.poiIds.join('|') === B.poiIds.join('|');
        const x0 = Math.max(p.a[0], p.b[0]), x1 = Math.min(p.a[0], p.b[0]) + WW;
        const y0 = Math.max(p.a[1], p.b[1]), y1 = Math.min(p.a[1], p.b[1]) + WH;
        for (let gy = y0; gy < y1; gy++) {
          for (let gx = x0; gx < x1; gx++) {
            const ia = (gy - p.a[1]) * WW + (gx - p.a[0]);
            const ib = (gy - p.b[1]) * WW + (gx - p.b[0]);
            const srcA = A.src[ia], srcB = B.src[ib];
            if (srcA === srcB) continue;
            if ((srcA && isIndustrialSalvage(srcA)) || (srcB && isIndustrialSalvage(srcB))) continue; // P5, already named
            e1.sourceDisagreements++;
            if (sameSlice) e1.residueIdenticalSlice++;
            const lxa = gx - p.a[0], lya = gy - p.a[1];
            const inLattice = lxa >= 16 && lxa <= 176 && lya >= 16 && lya <= 176;
            e1.byBand[inLattice ? 'insideAnchorLattice' : 'inAnchorFreeBand']++;
            const pm = Math.min(
              Math.min(lxa, lya, WW - 1 - lxa, WH - 1 - lya) + PAD_SHIPPED,
              Math.min(gx - p.b[0], gy - p.b[1], WW - 1 - (gx - p.b[0]), WH - 1 - (gy - p.b[1])) + PAD_SHIPPED);
            e1.paddedMarginOfDisagreements[pm <= 10 ? '8-10' : pm <= 15 ? '11-15' : pm <= 23 ? '16-23' : pm <= 31 ? '24-31' : '32+']++;

            let explainedAt: number | null = null;
            for (const pad of PAD_SWEEP) {
              const s = sweep[pad];
              if (!s) continue;
              const ra = s.A[(gy - p.a[1] + pad) * s.PW + (gx - p.a[0] + pad)] === 1;
              const rb = s.B[(gy - p.b[1] + pad) * s.PW + (gx - p.b[0] + pad)] === 1;
              if (ra !== rb) { sweepTotals[pad].reachedDiffers++; if (explainedAt === null) explainedAt = pad; }
              else sweepTotals[pad].disagreementsStillUnexplained++;
            }
            // Anchor-policy counterfactual, scored as a 2x2 against the shipped policy so a policy can
            // never look better by being measured on cells the shipped policy already agreed on.
            const at = (c: CfCell, side: 'A' | 'B') => {
              const [lx, ly] = side === 'A' ? [gx - p.a[0], gy - p.a[1]] : [gx - p.b[0], gy - p.b[1]];
              return c[side][(ly + c.pad) * c.PW + (lx + c.pad)] === 1;
            };
            const shippedCell = counterfactual['shipped_innerOnly_pad8'].flood['this']!;
            const shippedDiffers = at(shippedCell, 'A') !== at(shippedCell, 'B');
            for (const pol of POLICIES) {
              const cf = counterfactual[pol.name];
              const c = cf.flood['this']!;
              const differs = at(c, 'A') !== at(c, 'B');
              if (shippedDiffers && differs) cf.bothDiffer++;
              else if (shippedDiffers && !differs) cf.shippedDiffersPolicyAgrees++;
              else if (!shippedDiffers && differs) cf.shippedAgreesPolicyDiffers++;
              else cf.bothAgree++;
            }
            // Ordered ladder: compile-side flood, then the post-compile window-local filter, then residue.
            const reachPadA = sweep[PAD_SHIPPED]!.A[(gy - p.a[1] + PAD_SHIPPED) * sweep[PAD_SHIPPED]!.PW + (gx - p.a[0] + PAD_SHIPPED)] === 1;
            const reachPadB = sweep[PAD_SHIPPED]!.B[(gy - p.b[1] + PAD_SHIPPED) * sweep[PAD_SHIPPED]!.PW + (gx - p.b[0] + PAD_SHIPPED)] === 1;
            const filtA = A.wReachedRecon[ia] === 1, filtB = B.wReachedRecon[ib] === 1;
            if (reachPadA !== reachPadB) e1.byExplanation.step1_compileSideFloodDiffers++;
            else if (filtA !== filtB) e1.byExplanation.step2_postCompileFilterDiffers++;
            else e1.byExplanation.step3_neitherSoALaterPassInsideTheCompileDiffers++;

            if (e1.examples.length < 24) {
              e1.examples.push({
                globalTile: [gx, gy], stratum: p.stratum, samePoiSlice: sameSlice,
                windowA: A.layoutId, windowB: B.layoutId, localA: [lxa, lya], localB: [gx - p.b[0], gy - p.b[1]],
                sourceA: srcA, sourceB: srcB, tile: TERRAIN_NAME[A.tile[ia]] ?? A.tile[ia],
                classA: A.cls[ia], classB: B.cls[ib],
                insideAnchorLattice: inLattice, paddedMargin: pm,
                reachedExplainedAtPad: explainedAt,
                poiIdsA: A.poiIds, poiIdsB: B.poiIds,
              });
            }
          }
        }
        save();
      }
      e1.padSweep = Object.fromEntries(PAD_SWEEP.map(pad => [String(pad), {
        paddedRectCells: (WW + pad * 2) * (WH + pad * 2),
        growthVsShippedPct: Number((((WW + pad * 2) * (WH + pad * 2)) / ((WW + PAD_SHIPPED * 2) * (WH + PAD_SHIPPED * 2)) * 100 - 100).toFixed(2)),
        ...sweepTotals[pad],
      }]));
      const shippedCf = counterfactual['shipped_innerOnly_pad8'];
      const shippedDiffersTotal = shippedCf.bothDiffer + shippedCf.shippedDiffersPolicyAgrees;
      e1.counterfactual = {
        scoredOn: 'every sampled non-salvage source disagreement cell, as a 2x2 against the shipped policy',
        cellsWhereShippedCompileFloodDiffers: shippedDiffersTotal,
        policies: Object.fromEntries(POLICIES.map(pol => {
          const v = counterfactual[pol.name];
          return [pol.name, {
            pad: pol.pad, anchorLoopClippedToInnerRect: pol.innerOnly,
            anchorsPerWindowMedianA: v.anchorsA.slice().sort((a, b) => a - b)[v.anchorsA.length >> 1] ?? null,
            anchorsPerWindowMedianB: v.anchorsB.slice().sort((a, b) => a - b)[v.anchorsB.length >> 1] ?? null,
            compileAreaCells: (WW + pol.pad * 2) * (WH + pol.pad * 2),
            compileAreaGrowthVsShippedPct: Number((((WW + pol.pad * 2) * (WH + pol.pad * 2)) / 46656 * 100 - 100).toFixed(2)),
            shippedDiffersAndPolicyStillDiffers: v.bothDiffer,
            shippedDiffersButPolicyAgrees: v.shippedDiffersPolicyAgrees,
            shippedAgreesButPolicyDiffers: v.shippedAgreesPolicyDiffers,
            shareOfShippedDifferencesRemovedPct: Number((v.shippedDiffersPolicyAgrees / Math.max(1, shippedDiffersTotal) * 100).toFixed(2)),
          }];
        })),
        reading: 'This scores only the COMPILE-SIDE flood, which the ladder below shows is the smaller part of the problem. A policy that removes a compile-side flood difference does not by itself guarantee identical output: the per-cell draw is global-keyed, but the blocker competition and the isolation cleanup inside compileEconomy remain extent-bound.',
      };
      manifest.e1 = e1;
      (manifest.e1 as Entry).totalMs = Number((performance.now() - t0).toFixed(1));

      /* ------------------------------------------------------------ E2 */
      const e2 = {
        authoredPoisInFrame: 0, poisRead: 0, poisFailed: 0,
        roomsTotal: 0, propsTotal: 0, planLevelsTotal: 0,
        bboxCellsTotal: 0, solidPropsCellsThatMove: 0,
        shareOfBboxCellsThatMovePct: 0,
        poisWithAnyMovingProp: 0,
        deepestMarginOfMovingCells: 0,
        perPoi: [] as Entry[],
        ms: 0,
      };
      const t2 = performance.now();
      const authored = POIS.map(gp => ({ gp, l: getPoiLayout(gp.id) })).filter(x => !!authoredPlan(x.gp.id));
      e2.authoredPoisInFrame = authored.length;
      for (const { gp, l } of authored) {
        const [gx, gy] = [l.atTile[0], l.atTile[1]];
        const oxA = Math.max(0, Math.min(maxX, Math.floor((gx - WW / 2) / SLIDE_STEP) * SLIDE_STEP));
        const oyA = Math.max(0, Math.min(maxY, Math.floor((gy - WH / 2) / SLIDE_STEP) * SLIDE_STEP));
        const oxB = Math.min(maxX, oxA + SLIDE_STEP), oyB = Math.min(maxY, oyA + SLIDE_STEP);
        const axis = oxB !== oxA ? 'x' : 'y';
        const bOrigin: [number, number] = axis === 'x' ? [oxB, oyA] : [oxA, oyB];
        const A = readWindow(layoutIdAt(oxA, oyA), [oxA, oyA], SEEDS[0]);
        const B = readWindow(layoutIdAt(bOrigin[0], bOrigin[1]), bOrigin, SEEDS[0]);
        if (!A.ok || !B.ok) { e2.poisFailed++; continue; }
        e2.poisRead++;
        const plan = authoredPlan(gp.id)!;
        let rooms = 0, props = 0;
        for (const [, L] of plan.levels) { rooms += L.rooms.length; props += L.props.length; }
        e2.roomsTotal += rooms; e2.propsTotal += props; e2.planLevelsTotal += plan.levels.size;
        const [bx0, by0, bx1, by1] = [l.bbox[0], l.bbox[1], l.bbox[2], l.bbox[3]];
        let bboxCells = 0, moving = 0, deepest = 0;
        for (let gyy = Math.max(by0, oyA); gyy <= Math.min(by1, oyA + WH - 1); gyy++) {
          for (let gxx = Math.max(bx0, oxA); gxx <= Math.min(bx1, oxA + WW - 1); gxx++) {
            const ia = (gyy - oyA) * WW + (gxx - oxA);
            const ib = (gyy - bOrigin[1]) * WW + (gxx - bOrigin[0]);
            if (ib < 0 || ib >= WW * WH) continue;
            if (gxx - bOrigin[0] < 0 || gxx - bOrigin[0] >= WW || gyy - bOrigin[1] < 0 || gyy - bOrigin[1] >= WH) continue;
            bboxCells++;
            if (A.solidProps[ia] !== B.solidProps[ib]) {
              moving++;
              const mA = Math.min(gxx - oxA, gyy - oyA, WW - 1 - (gxx - oxA), WH - 1 - (gyy - oyA));
              const mB = Math.min(gxx - bOrigin[0], gyy - bOrigin[1], WW - 1 - (gxx - bOrigin[0]), WH - 1 - (gyy - bOrigin[1]));
              deepest = Math.max(deepest, Math.min(mA, mB));
            }
          }
        }
        e2.bboxCellsTotal += bboxCells;
        e2.solidPropsCellsThatMove += moving;
        e2.deepestMarginOfMovingCells = Math.max(e2.deepestMarginOfMovingCells, deepest);
        if (moving > 0) e2.poisWithAnyMovingProp++;
        e2.perPoi.push({
          poi: gp.id, name: l.name, arche: l.arche, atTile: l.atTile, bbox: l.bbox,
          windows: [A.layoutId, B.layoutId], axis,
          levels: plan.levels.size, rooms, authoredProps: props,
          bboxCellsInsideWindowA: bboxCells, solidPropsCellsThatMove: moving,
          sharePct: Number((moving / Math.max(1, bboxCells) * 100).toFixed(2)),
          deepestMarginOfMovingCells: deepest,
        });
        save();
      }
      e2.shareOfBboxCellsThatMovePct = Number((e2.solidPropsCellsThatMove / Math.max(1, e2.bboxCellsTotal) * 100).toFixed(3));
      e2.perPoi.sort((a, b) => Number(b.solidPropsCellsThatMove) - Number(a.solidPropsCellsThatMove));
      e2.ms = Number((performance.now() - t2).toFixed(1));
      manifest.e2 = e2;
      save();

      /* ------------------------------------------------------------ honesty assertions */
      expect(e1.pairsRead, 'E1 needs readable neighbour pairs').toBeGreaterThan(0);
      expect(e1.validation.nonSalvageSources, 'E1 must observe real sources to validate the reconstruction').toBeGreaterThan(0);
      expect(e1.validation.sourcesOnUnreachedCells,
        `the reconstructed compile flood must be able to reach every non-salvage source the shipped window holds, otherwise the reconstruction is wrong and every E1 number below is meaningless, e.g. ${JSON.stringify(e1.validation.sourcesOnUnreachedCellsExamples.slice(0, 3))}`).toBe(0);
      expect(e1.validation.sourcesRejectedByReconstructedPostFilter,
        `every non-salvage source the shipped window holds must also pass the reconstructed post-compile filter, otherwise the reconstructed anchor rule is wrong, e.g. ${JSON.stringify(e1.validation.sourcesRejectedByReconstructedPostFilterExamples.slice(0, 3))}`).toBe(0);
      expect(e1.validation.innerWalkableUnexplained,
        `the reconstructed padded walkable must equal the shipped inner walkable except under authored compound stamps, e.g. ${JSON.stringify(e1.validation.innerWalkableUnexplainedExamples.slice(0, 3))}`).toBe(0);
      expect(e2.poisRead, 'E2 needs authored POIs to price option B').toBeGreaterThan(0);

      /* ------------------------------------------------------------ E3 (opt-in, full frame) */
      if (E3_ON) {
        // Mosaic the frame at the real slide stride. Per global cell, count how many readable windows cover
        // it and how many of those call it passable, plus which source keys were seen and whether the
        // covering windows agree. Optimistic = ANY covering window; conservative = EVERY covering window;
        // uncovered cells are impassable under both bounds (the same conservative policy the foot-reachability
        // mosaic uses). Then take the only player-route fact available — a normal startRun on the title
        // default layout with qaUsed === false — flood its component under each bound, and count how many
        // harvestable nodes inside the region a player can actually walk to flicker between the bounds.
        const NF = FRAME_W * FRAME_H;
        const coverCount = new Uint16Array(NF);
        const passCount = new Uint16Array(NF);
        const anyKey = new Uint8Array(NF);
        const keyIdx = new Int16Array(NF).fill(-1);
        const conflictEmpty = new Uint8Array(NF);   // one window has the source, another has nothing there
        const conflictKey = new Uint8Array(NF);     // two windows both have a source, but different keys
        const keys: string[] = [];
        const keyOf = (k: string) => { let x = keys.indexOf(k); if (x < 0) { keys.push(k); x = keys.length - 1; } return x; };
        const passableClass = (c: number) => c === 0 || c === 4;

        const e3: Entry = {
          stride: E3_STRIDE, seed: E3_SEED, windowsPlanned: 0, windowsRead: 0, windowsUnreadable: 0,
          cellsCovered: 0, cellsUncovered: 0, sourceKeyAlphabet: keys,
          start: null as Entry | null, frame: {} as Entry, component: {} as Entry,
          contestedByMaterial: {} as Entry, contestedBlockingByMaterial: {} as Entry,
          ms: 0,
        };
        manifest.e3 = e3;
        const t3 = performance.now();
        const cols = Math.ceil(maxX / E3_STRIDE) + 1, rows = Math.ceil(maxY / E3_STRIDE) + 1;
        for (let ry = 0; ry < rows; ry++) {
          for (let cx = 0; cx < cols; cx++) {
            const ox = Math.min(maxX, cx * E3_STRIDE), oy = Math.min(maxY, ry * E3_STRIDE);
            e3.windowsPlanned = Number(e3.windowsPlanned) + 1;
            const W = readWindow(layoutIdAt(ox, oy), [ox, oy], E3_SEED);
            if (!W.ok) { e3.windowsUnreadable = Number(e3.windowsUnreadable) + 1; continue; }
            e3.windowsRead = Number(e3.windowsRead) + 1;
            for (let y = 0; y < WH; y++) {
              for (let x = 0; x < WW; x++) {
                const i = y * WW + x, g = (oy + y) * FRAME_W + (ox + x);
                coverCount[g]++;
                if (passableClass(W.cls[i])) passCount[g]++;
                const key = W.src[i];
                if (key) {
                  anyKey[g] = 1;
                  const ki = keyOf(key);
                  if (keyIdx[g] === -1) keyIdx[g] = ki;
                  else if (keyIdx[g] !== ki) conflictKey[g] = 1;
                } else if (keyIdx[g] === -1) keyIdx[g] = -2;
                else if (keyIdx[g] >= 0) conflictEmpty[g] = 1;
              }
            }
            if (Number(e3.windowsRead) % 25 === 0) { e3.ms = Number((performance.now() - t3).toFixed(1)); save(); }
          }
        }

        // The single player-route fact: a normal start, never a QA landing.
        setActiveLayout(U05_WORLD_LAYOUT_ID);
        const gs0 = newGame();
        const res0 = startRun(gs0, 'female', EPOCH, null, E3_SEED) as { ok: boolean; reason?: string };
        expect(res0.ok, `E3 needs a legal normal start on ${U05_WORLD_LAYOUT_ID}`).toBeTruthy();
        const r0 = gs0.run!;
        expect(r0.qaUsed, 'E3 start must be a normal spawn, not a QA landing').toBe(false);
        const start = playerGlobalTile(r0);
        const startWin = windowOrigin(r0);
        e3.start = { layoutId: r0.layoutId, playerGlobalTile: start, windowOrigin: startWin, qaUsed: r0.qaUsed };
        r0.ended = { at: EPOCH, reason: 'window-invariance follow-up E3 cleanup' } as never;

        const gOf = (tx: number, ty: number) => ty * FRAME_W + tx;
        const flood = (conservative: boolean) => {
          const inComp = new Uint8Array(NF);
          const q = new Int32Array(NF);
          let head = 0, tail = 0, cells = 0;
          const ok = (g: number) => coverCount[g] > 0 && (conservative ? passCount[g] === coverCount[g] : passCount[g] > 0);
          const sg = gOf(start![0], start![1]);
          if (!ok(sg)) return { inComp, cells: 0, startPassable: false };
          inComp[sg] = 1; q[tail++] = sg; cells++;
          while (head < tail) {
            const g = q[head++];
            const x = g % FRAME_W, y = (g / FRAME_W) | 0;
            if (x > 0 && !inComp[g - 1] && ok(g - 1)) { inComp[g - 1] = 1; q[tail++] = g - 1; cells++; }
            if (x + 1 < FRAME_W && !inComp[g + 1] && ok(g + 1)) { inComp[g + 1] = 1; q[tail++] = g + 1; cells++; }
            if (y > 0 && !inComp[g - FRAME_W] && ok(g - FRAME_W)) { inComp[g - FRAME_W] = 1; q[tail++] = g - FRAME_W; cells++; }
            if (y + 1 < FRAME_H && !inComp[g + FRAME_W] && ok(g + FRAME_W)) { inComp[g + FRAME_W] = 1; q[tail++] = g + FRAME_W; cells++; }
          }
          return { inComp, cells, startPassable: true };
        };
        const opt = flood(false), cons = flood(true);

        let covered = 0, contested = 0, contestedBlocking = 0, conservativeSources = 0, optimisticSources = 0;
        const byMat: Record<string, number> = {}, byMatBlocking: Record<string, number> = {};
        const countIn = (inComp: Uint8Array) => {
          let src = 0;
          for (let g = 0; g < NF; g++) {
            if (!inComp[g]) continue;
            if (anyKey[g] && !conflictEmpty[g] && !conflictKey[g]) src++;
          }
          return src;
        };
        for (let g = 0; g < NF; g++) {
          if (coverCount[g] > 0) covered++;
          if (!opt.inComp[g]) continue;
          const isContested = anyKey[g] === 1 && (conflictEmpty[g] === 1 || conflictKey[g] === 1);
          if (anyKey[g]) optimisticSources++;
          if (anyKey[g] && !isContested) conservativeSources++;
          if (!isContested) continue;
          contested++;
          const k = keyIdx[g] >= 0 ? keys[keyIdx[g]] : 'mixed';
          const def = (SOURCES as Record<string, { mat?: string; block?: boolean }>)[k];
          const mat = def?.mat ?? (conflictKey[g] ? 'mixed-keys' : 'unclassified');
          byMat[mat] = (byMat[mat] ?? 0) + 1;
          if (def?.block) { contestedBlocking++; byMatBlocking[mat] = (byMatBlocking[mat] ?? 0) + 1; }
        }
        e3.cellsCovered = covered;
        e3.cellsUncovered = NF - covered;
        e3.frame = {
          cellsWithAnySource: 0, cellsContested: 0, contestedEmptyVsKey: 0,
        };
        let frameAny = 0, frameContested = 0, frameEmpty = 0;
        for (let g = 0; g < NF; g++) {
          if (!anyKey[g]) continue;
          frameAny++;
          if (conflictEmpty[g] || conflictKey[g]) { frameContested++; if (conflictEmpty[g]) frameEmpty++; }
        }
        e3.frame = { cellsWithAnySource: frameAny, cellsContested: frameContested, contestedPresentVsAbsent: frameEmpty, contestedDifferentKeys: frameContested - frameEmpty };
        e3.component = {
          optimisticCells: opt.cells, conservativeCells: cons.cells, startPassableOptimistic: opt.startPassable, startPassableConservative: cons.startPassable,
          sourcesUncontestedInsideOptimisticComponent: countIn(opt.inComp),
          sourcesUncontestedInsideConservativeComponent: countIn(cons.inComp),
          optimisticSourceCellsInsideComponent: optimisticSources,
          contestedSourceCellsInsideComponent: contested,
          contestedBlockingSourceCellsInsideComponent: contestedBlocking,
          contestedShareOfComponentSourcesPct: Number((contested / Math.max(1, optimisticSources) * 100).toFixed(3)),
        };
        e3.contestedByMaterial = byMat;
        e3.contestedBlockingByMaterial = byMatBlocking;
        e3.ms = Number((performance.now() - t3).toFixed(1));
        expect(opt.startPassable, 'the legal start must be passable under the optimistic bound').toBeTruthy();
        expect(cons.startPassable, 'the legal start must be passable under the conservative bound too, otherwise the component comparison is meaningless').toBeTruthy();
        save();
      }

      save();
    });
});
