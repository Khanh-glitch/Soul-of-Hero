/**
 * SOH — MAP-GEO-REJOIN-02 — CORRECTED REAL BRIDGE & CLIFF PROJECTION
 * =====================================================================
 * This module is a VERIFICATION overlay on the existing U=0.5 terrain-only
 * renderer. It does NOT create a new world, a new geography viewer, a new atlas
 * or new art. Every visible tile still comes from the verbatim U05 terrain
 * painter (terrain.ts); the only changes are the two Map-derived defects:
 *
 *   MGP-D01  the 12 "12 AU circular bridge nodes" were used as a bridge DECK
 *            footprint. On land that produced a wood carpet; over water the
 *            GOLD lake/river branch won, leaving an empty gap. 12/12 centres
 *            were RIVER / blocked, 0 crossable. Here the marker radius is
 *            NEVER a deck. A bounded deck is derived from each GOLD bridge's
 *            own id/at/ang/load, the authored river banks and road approaches,
 *            and the WMP-03 crossingCandidate code. T.BRIDGE art is used ONLY
 *            on water tiles inside that measured rectangle.
 *
 *   MGP-D10  cliffCandidate.v3.u8 is a BINARY (0/1) connected steep-FACE
 *            proposal; the consumer used `cliff >= 2`, so 305 candidate cells
 *            produced 0 visible T.CLIFF tiles. Here the binary contract is
 *            honoured, with independent heightClass/slope/slopeClass evidence,
 *            and the face is projected as a THIN, deterministically broken
 *            downhill band (2..4 of 16 tiles of the 8 AU analysis cell), NOT
 *            as a filled gray slab and NOT as a permanent impassable wall.
 *
 * AUTHORITY BOUNDARY (never crossed here):
 *   MAP       = visible geometry, deck continuity, face placement, measured
 *               banks/approaches, source ids, save-compatible coordinates.
 *   GAMEPLAY  = walking, carts, load/bearing, collision law, climb rule,
 *               ferry/boat/swim, production traversal permissions.
 *   `PRODUCTION_NO_PERMISSION` is the DEFAULT. `QA_CANDIDATE_CROSSING` is an
 *   EXPLICIT, separately named QA mode used only to measure candidate geometry
 *   with real WASD input. Neither mode writes any permission into
 *   sampleTile().permissions; activeCollisionPermission stays FALSE everywhere.
 *
 * No GOLD geometry, resource placement, POI architecture, Beacon road,
 * production gameplay or protected baseline is changed.
 */
import { T, hash2 } from '../game/core';
import {
  sampleTile, u05Tile as baseU05Tile, u05TileRaw as baseU05TileRaw,
  PROFILE, nextTick, touchGeometryChunk, stats, resetCaches, despeckleStats,
  residentKeys, pointInPolygon, distToSegment
} from '../u05/world';
import {
  FRAME_W, FRAME_H, FRAME_AU, U, TILE, CONTRACT_INVARIANTS, inFrame
} from '../u05/contract';
import { RASTERS } from '../u05/lw/geometry';
import { BRIDGE_SOURCE } from './bridge-source.generated';

export {
  sampleTile, PROFILE, nextTick, touchGeometryChunk, stats, resetCaches,
  despeckleStats, residentKeys, pointInPolygon, distToSegment,
  FRAME_W, FRAME_H, FRAME_AU, U, TILE, CONTRACT_INVARIANTS
};

/* ───────────────────────── constants / measured guards ─────────────────── */
const W = BRIDGE_SOURCE.analysisGrid.w;          // 250 analysis cells
const H = BRIDGE_SOURCE.analysisGrid.h;          // 175
const CELL_AU = BRIDGE_SOURCE.analysisGrid.cellAu; // 8 AU
const TILES_PER_CELL = Math.round(CELL_AU / U); // 16 tiles at U=0.5 AU/tile
const SAMPLE_STEP_AU = 0.5;                     // one U=0.5 tile
const SAMPLE_REACH_AU = 30;                     // bounded bank search
const DECK_SEAM_AU = SAMPLE_STEP_AU;            // one tile of seam each bank
const DECK_HALF_WIDTH_AU = 1.5;                 // GOLD road width 3.0 AU / 2
const DECK_MAX_SPAN_AU = 16;                    // bounded-candidate guard
const FACE_BAND_MIN = 2;                        // thin jagged face, not a slab
const FACE_BAND_MAX = 4;                        // deterministic 2..4 tile depth
const FACE_BAND_TILES = 3;                      // nominal mean for reporting
const FACE_DROP_MIN = 12;                       // min observed downhill drop
                                                // among the 305 candidate cells
const CLIFF_HCLASS_MIN = 4;                     // v3 cliffRule
const CLIFF_SLOPE_MIN = 20;                     // v3 cliffRule (raw byte p95)
const BIOME_TILE: number[] = [
  T.MEADOW, T.FOREST, T.FOREST, T.FOREST, T.MARSH, T.SAND,
  T.HILL, T.HILL, T.SNOW, T.ASH, T.TOXIC, T.SAND
];
const BLOCKING_TERRAIN = new Set<number>([
  T.DEEP, T.SHALLOW, T.RIVER, T.CLIFF, T.PWALL, T.LAVA, T.ICE, T.BURNT
]);
const FACE_SIDES = ['N', 'S', 'W', 'E'] as const;
const FACE_DIRS: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

export type CandidateMode = 'PRODUCTION_NO_PERMISSION' | 'QA_CANDIDATE_CROSSING';
let candidateMode: CandidateMode = 'PRODUCTION_NO_PERMISSION';
export function setCandidateMode(m: CandidateMode): CandidateMode {
  if (m !== 'PRODUCTION_NO_PERMISSION' && m !== 'QA_CANDIDATE_CROSSING')
    throw Error('MAPGEO02_UNKNOWN_CANDIDATE_MODE ' + m);
  candidateMode = m;
  return candidateMode;
}
export function getCandidateMode(): CandidateMode { return candidateMode; }

/* ───────────────────────── small deterministic helpers ────────────────── */
const tkey = (tx: number, ty: number) => tx * 100000 + ty;
const auToTile = (auX: number, auY: number): [number, number] =>
  [Math.floor(auX * 2), Math.floor(auY * 2)];
function readAt(auX: number, auY: number) {
  const [tx, ty] = auToTile(auX, auY);
  return sampleTile(tx, ty);
}
const isWet = (q: any) => !q || !!q.water;
const isDryBank = (q: any) => !!q && !!q.authoredLand && !q.water;
function cellIndex(auX: number, auY: number) {
  const cx = Math.min(W - 1, Math.max(0, Math.floor(auX / CELL_AU)));
  const cy = Math.min(H - 1, Math.max(0, Math.floor(auY / CELL_AU)));
  return cy * W + cx;
}

/** Contiguous water run that CONTAINS the authored bridge centre, along `dir`. */
function measureWaterRun(at: [number, number], dir: [number, number]) {
  const samples: { s: number; wet: boolean; q: any }[] = [];
  for (let s = -SAMPLE_REACH_AU; s <= SAMPLE_REACH_AU + 1e-6; s += SAMPLE_STEP_AU) {
    const q = readAt(at[0] + dir[0] * s, at[1] + dir[1] * s);
    samples.push({ s: Number(s.toFixed(3)), wet: isWet(q), q });
  }
  const ci = samples.findIndex(x => x.s >= 0);
  let a = ci, b = ci;
  while (a > 0 && samples[a - 1].wet) a--;
  while (b < samples.length - 1 && samples[b + 1].wet) b++;
  const centreWet = ci >= 0 && samples[ci].wet;
  const from = samples[a].s, to = samples[b].s;
  const spanAu = Number((to - from + SAMPLE_STEP_AU).toFixed(3));
  const bankAindex = a - 1, bankBindex = b + 1;
  const bankA = bankAindex >= 0 ? samples[bankAindex] : null;
  const bankB = bankBindex < samples.length ? samples[bankBindex] : null;
  // Channel kind at the authored centre (independent evidence, not a new law).
  const q0 = samples[ci]?.q;
  const channelKind = !q0 ? 'UNKNOWN' : q0.river ? 'RIVER' : q0.lake ? 'LAKE'
    : q0.marineRegion > 0 ? 'MARINE' : q0.water ? 'WATER' : 'DRY';
  return {
    samples, from, to, spanAu, centreWet,
    hitsSearchEdge: !!(bankA && isWet(bankA.q)) || !!(bankB && isWet(bankB.q)),
    touchesSearchEdge: a === 0 || b === samples.length - 1,
    bankA: bankA && !isWet(bankA.q) ? bankA : null,
    bankB: bankB && !isWet(bankB.q) ? bankB : null,
    bankAOffsetAu: bankA ? bankA.s : null,
    bankBOffsetAu: bankB ? bankB.s : null,
    channelKind
  };
}

/**
 * Road / footpath approach. The GOLD road centreline may meet the deck at a
 * slight angle, so probe outward along the authored span axis AND a ±1.5 AU
 * perpendicular band (GOLD road width), up to 8 AU from the measured bank.
 */
function approachRoad(at: [number, number], dir: [number, number], perp: [number, number], bankS: number | null) {
  if (bankS === null) return { found: false, roadAtBank: false, nearestAu: null };
  const perpBands = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
  let roadAtBank = false, nearestAu: number | null = null;
  for (let d = 0; d <= 8 + 1e-6; d += SAMPLE_STEP_AU) {
    const s = bankS + Math.sign(bankS || 1) * d;
    let hit = false;
    for (const u of perpBands) {
      const q = readAt(at[0] + dir[0] * s + perp[0] * u, at[1] + dir[1] * s + perp[1] * u);
      if (q && q.road) { hit = true; break; }
    }
    if (hit) { nearestAu = Number(d.toFixed(3)); if (d === 0) roadAtBank = true; break; }
  }
  return { found: nearestAu !== null, roadAtBank, nearestAu };
}

export interface BridgeCandidate {
  id: string;
  name: string;
  atAu: [number, number];
  atTile: [number, number];
  authoredAngRad: number;
  authoredLoad: string;
  crossingCandidateCode: number;
  crossingCellIndex: number;
  authoredSpanAxis: [number, number];
  channelKind: string;
  waterSpanAu: number | null;
  waterRunFromAu: number | null;
  waterRunToAu: number | null;
  perpendicularWaterSpanAu: number | null;
  orientation: string;
  bankA: { offsetAu: number | null; dryLand: boolean; road: boolean; roadDistanceAu: number | null };
  bankB: { offsetAu: number | null; dryLand: boolean; road: boolean; roadDistanceAu: number | null };
  deckFootprintAu: { length: number | null; width: number; notMarkerRadius: boolean };
  deckTileCount: number;
  deckTiles8NeighbourConnected: boolean | null;
  spanCoverage: number | null;
  centrelineContinuous: boolean | null;
  bankSeams: { a: number; b: number; connected: boolean };
  continuity: boolean | null;
  roadApproaches: boolean | null;
  sourceEvidence: Record<string, boolean>;
  unresolvedReasons: string[];
  status: string;
  owner: string;
  gameplayIntake: string;
}

/** Measured deck tiles per GOLD bridge id; filled by deriveBridgeCandidates(). */
const DECK_TILES_BY_BRIDGE = new Map<string, [number, number][]>();

/** Derive every deck from source evidence. Pure / deterministic / no randomness. */
function deriveBridgeCandidates(): BridgeCandidate[] {
  const out: BridgeCandidate[] = [];
  for (const b of BRIDGE_SOURCE.bridges) {
    const at: [number, number] = [b.at[0], b.at[1]];
    const dir: [number, number] = [Math.cos(b.ang), Math.sin(b.ang)];
    const perp: [number, number] = [-dir[1], dir[0]];
    const along = measureWaterRun(at, dir);
    const across = measureWaterRun(at, perp);
    const unresolved: string[] = [];

    const centreWet = along.centreWet;
    if (!centreWet) unresolved.push('AUTHORED_CENTRE_NOT_ON_WATER');
    const bothBanks = !!along.bankA && !!along.bankB;
    if (!bothBanks) unresolved.push('NO_VERIFIED_BOTH_BANKS');
    if (along.touchesSearchEdge || along.hitsSearchEdge)
      unresolved.push('WATER_RUN_UNBOUNDED_AT_30_AU_SEARCH');
    const span = along.spanAu;
    if (!(span > 0 && span <= DECK_MAX_SPAN_AU))
      unresolved.push('WATER_SPAN_EXCEEDS_BOUNDED_CANDIDATE_GUARD');

    const orientation = along.spanAu <= across.spanAu
      ? 'AUTHORED_ANG_IS_CROSSING_AXIS'
      : 'AUTHORED_ANG_LONGER_THAN_PERPENDICULAR__CHANNEL_NARROW_BOTH_AXES';
    // Two bounded crossing axes => GOLD `ang` alone cannot pick a bearing.
    // Do NOT silently choose one: report the exact id for owner review.
    if (along.spanAu > across.spanAu)
      unresolved.push('MULTIPLE_BOUNDED_CROSSING_AXES__OWNER_BEARING_REVIEW');

    const bankA = {
      offsetAu: along.bankAOffsetAu,
      dryLand: !!along.bankA && isDryBank(along.bankA.q),
      road: false, roadDistanceAu: null as number | null
    };
    const bankB = {
      offsetAu: along.bankBOffsetAu,
      dryLand: !!along.bankB && isDryBank(along.bankB.q),
      road: false, roadDistanceAu: null as number | null
    };
    const apA = approachRoad(at, dir, perp, bankA.offsetAu);
    const apB = approachRoad(at, dir, perp, bankB.offsetAu);
    bankA.road = apA.found; bankA.roadDistanceAu = apA.nearestAu;
    bankB.road = apB.found; bankB.roadDistanceAu = apB.nearestAu;
    const roadApproaches = apA.found && apB.found;
    if (!roadApproaches) unresolved.push('ROAD_OR_FOOTPATH_APPROACH_MISSING');

    // Bounded rectangle: the measured water run + exactly one seam tile per
    // bank, GOLD road-centreline width. NEVER the 12 AU marker radius.
    const s0 = along.from - DECK_SEAM_AU;
    const s1 = along.to + DECK_SEAM_AU;
    const deckTiles: [number, number][] = [];
    const corners = [
      [at[0] + dir[0] * s0 + perp[0] * -DECK_HALF_WIDTH_AU, at[1] + dir[1] * s0 + perp[1] * -DECK_HALF_WIDTH_AU],
      [at[0] + dir[0] * s0 + perp[0] * DECK_HALF_WIDTH_AU, at[1] + dir[1] * s0 + perp[1] * DECK_HALF_WIDTH_AU],
      [at[0] + dir[0] * s1 + perp[0] * -DECK_HALF_WIDTH_AU, at[1] + dir[1] * s1 + perp[1] * -DECK_HALF_WIDTH_AU],
      [at[0] + dir[0] * s1 + perp[0] * DECK_HALF_WIDTH_AU, at[1] + dir[1] * s1 + perp[1] * DECK_HALF_WIDTH_AU]
    ];
    const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
    const minTx = Math.floor(Math.min(...xs) * 2) - 1, maxTx = Math.ceil(Math.max(...xs) * 2) + 1;
    const minTy = Math.floor(Math.min(...ys) * 2) - 1, maxTy = Math.ceil(Math.max(...ys) * 2) + 1;
    for (let ty = minTy; ty <= maxTy; ty++) for (let tx = minTx; tx <= maxTx; tx++) {
      const q = sampleTile(tx, ty);
      if (!q) continue;
      const dx = q.au[0] - at[0], dy = q.au[1] - at[1];
      const sv = dx * dir[0] + dy * dir[1];
      const uv = dx * perp[0] + dy * perp[1];
      if (sv < s0 || sv > s1 || Math.abs(uv) > DECK_HALF_WIDTH_AU) continue;
      if (q.water) deckTiles.push([tx, ty]); // T.BRIDGE art ONLY over water
    }

    // Continuity measured ON the derived deck tile set (not on arbitrary
    // rotated sample points, which would create false gaps).
    const set = new Set<number>(deckTiles.map(([x, y]) => tkey(x, y)));
    let connected: boolean | null = null;
    let spanCoverage: number | null = null;
    let centrelineContinuous: boolean | null = null;
    const sBins = new Set<number>();
    const totalBins = Math.round((s1 - s0) / SAMPLE_STEP_AU) + 1;
    let seamAcount = 0, seamBcount = 0;
    for (const [tx, ty] of deckTiles) {
      const q = sampleTile(tx, ty); if (!q) continue;
      const dx = q.au[0] - at[0], dy = q.au[1] - at[1];
      const sv = dx * dir[0] + dy * dir[1];
      sBins.add(Math.round((sv - s0) / SAMPLE_STEP_AU));
      // Bank seams: a deck tile touching authored dry land on either side.
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nq = sampleTile(tx + ox, ty + oy);
        if (!nq || !isDryBank(nq)) continue;
        const ndx = nq.au[0] - at[0], ndy = nq.au[1] - at[1];
        const ns = ndx * dir[0] + ndy * dir[1];
        if (ns < along.from - 1e-6) seamAcount++;
        else if (ns > along.to + 1e-6) seamBcount++;
      }
    }
    const bankSeams = { a: seamAcount, b: seamBcount, connected: seamAcount > 0 && seamBcount > 0 };
    if (deckTiles.length) {
      const start = tkey(deckTiles[0][0], deckTiles[0][1]);
      const seen = new Set<number>([start]); const queue: number[] = [start];
      while (queue.length) {
        const k = queue.shift()!;
        const x = Math.floor(k / 100000), y = k - x * 100000;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = tkey(x + ox, y + oy);
          if (set.has(nk) && !seen.has(nk)) { seen.add(nk); queue.push(nk); }
        }
      }
      connected = seen.size === set.size;
      spanCoverage = Number((sBins.size / totalBins).toFixed(4));
      // 0.90 tolerance: a rotated rectangle can have NO tile centre in the
      // extreme 0.5 AU endpoint bin. That is a rounding effect, not a gap —
      // 4-connectivity and the two bank seams are the actual continuity law.
      centrelineContinuous = spanCoverage >= 0.90;
    }
    DECK_TILES_BY_BRIDGE.set(b.id, deckTiles);
    const continuity = deckTiles.length > 0 && connected === true && centrelineContinuous === true && bankSeams.connected;
    if (deckTiles.length === 0) unresolved.push('NO_DECK_TILES_OVER_WATER');
    if (connected === false) unresolved.push('DECK_TILES_DISCONNECTED');
    if (centrelineContinuous === false) unresolved.push('SPAN_COVERAGE_BELOW_0_90');
    if (!bankSeams.connected) unresolved.push('BANK_SEAMS_NOT_CONNECTED');

    const sourceEvidence: Record<string, boolean> = {
      goldBridgeId: !!b.id,
      goldAuthoredAt: Number.isFinite(at[0]) && Number.isFinite(at[1]),
      goldAuthoredAng: Number.isFinite(b.ang),
      goldAuthoredLoad: b.load === 'cart' || b.load === 'foot',
      crossingCandidateCode: b.crossingCode === 1 || b.crossingCode === 2,
      authoredRiverBanksMeasured: bothBanks && bankA.dryLand && bankB.dryLand,
      authoredRoadConnectionsMeasured: roadApproaches,
      boundedChannelSpanMeasured: !!span && span <= DECK_MAX_SPAN_AU
    };
    const evidenceComplete = Object.values(sourceEvidence).every(Boolean);
    if (!evidenceComplete) unresolved.push('SOURCE_EVIDENCE_INSUFFICIENT');

    const status = unresolved.length
      ? 'UNRESOLVED__EXTERNAL_DECISION_REQUIRED'
      : 'CANDIDATE_DECK__MAP_PHYSICAL_GEOMETRY_ONLY__GAMEPLAY_PERMISSION_REQUIRED';
    out.push({
      id: b.id, name: b.name, atAu: at,
      atTile: auToTile(at[0], at[1]),
      authoredAngRad: b.ang, authoredLoad: b.load,
      crossingCandidateCode: b.crossingCode, crossingCellIndex: b.crossingCellIndex,
      authoredSpanAxis: [Number(dir[0].toFixed(6)), Number(dir[1].toFixed(6))],
      channelKind: along.channelKind,
      waterSpanAu: span, waterRunFromAu: along.from, waterRunToAu: along.to,
      perpendicularWaterSpanAu: across.spanAu,
      orientation,
      bankA, bankB,
      deckFootprintAu: {
        length: Number((s1 - s0).toFixed(3)),
        width: DECK_HALF_WIDTH_AU * 2,
        notMarkerRadius: true
      },
      deckTileCount: deckTiles.length,
      deckTiles8NeighbourConnected: connected,
      spanCoverage,
      centrelineContinuous,
      bankSeams,
      continuity,
      roadApproaches,
      sourceEvidence,
      unresolvedReasons: unresolved,
      status,
      owner: unresolved.length ? 'CREATOR/GAMEPLAY (exact id reported)' : 'MAP geometry + GAMEPLAY WorldTraversal',
      gameplayIntake: 'WorldTraversal must decide bearing/load/cart clearance/walk collision; NOT granted here'
    });
  }
  return out;
}

const BRIDGES = deriveBridgeCandidates();
/** Only RESOLVED candidates get T.BRIDGE art. Unresolved ids get NO stamping. */
const DECK = new Map<number, string>();
for (const b of BRIDGES) {
  if (!b.status.startsWith('CANDIDATE_DECK')) continue;
  for (const [tx, ty] of DECK_TILES_BY_BRIDGE.get(b.id) || []) DECK.set(tkey(tx, ty), b.id);
}
export function bridgeCandidates(): BridgeCandidate[] {
  return JSON.parse(JSON.stringify(BRIDGES));
}
export function deckTileCount(): number { return DECK.size; }

/* ───────────────────────── cliff-face projection ──────────────────────── */
export interface CliffFace {
  cellIndex: number;
  side: string;
  downhillDropRaw: number;
  heightClass: number;
  slopeRaw: number;
  cliffCandidate: number;
  localTile: [number, number];
}
/** BINARY candidate contract + independent height/slope evidence + thin band. */
export function cliffFaceAt(tx: number, ty: number, sampled?: ReturnType<typeof sampleTile>): CliffFace | null {
  const q = sampled === undefined ? sampleTile(tx, ty) : sampled;
  if (!q || q.water || !q.authoredLand || q.road) return null; // never repaint Beacon road
  const [auX, auY] = q.au;
  const ci = cellIndex(auX, auY);
  const cx = ci % W, cy = Math.floor(ci / W);
  const candidate = RASTERS.cliffCandidate[ci];
  if (candidate < 1) return null;                 // MGP-D10 root cause: was >= 2
  if (q.heightClass < CLIFF_HCLASS_MIN) return null;
  const slope = RASTERS.slope[ci];
  if (slope < CLIFF_SLOPE_MIN) return null;
  const e = RASTERS.elevation[ci];
  let bestDrop = -Infinity, sideIdx = 1;
  for (let k = 0; k < FACE_DIRS.length; k++) {
    const nx = cx + FACE_DIRS[k][0], ny = cy + FACE_DIRS[k][1];
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const d = e - RASTERS.elevation[ny * W + nx];
    if (d > bestDrop) { bestDrop = d; sideIdx = k; }
  }
  if (!(bestDrop >= FACE_DROP_MIN)) return null;
  const lx = tx - cx * TILES_PER_CELL, ly = ty - cy * TILES_PER_CELL;
  const side = FACE_SIDES[sideIdx];
  const d = side === 'N' ? ly : side === 'S' ? TILES_PER_CELL - 1 - ly
    : side === 'W' ? lx : TILES_PER_CELL - 1 - lx;
  // Deterministic broken rocky edge, NOT a machine-stamped straight slab.
  // Uses the SAME hash2 noise the verbatim U05 painter already uses; no new
  // art, no new geometry, no randomness. Depth varies 2..4 tiles per column
  // of the face; ~6% holes and sparse one-tile "teeth" break the silhouette.
  const along = (side === 'N' || side === 'S') ? tx : ty;
  const depth = FACE_BAND_MIN + Math.floor(hash2(along, ci, 0x5a17) * (FACE_BAND_MAX - FACE_BAND_MIN + 1));
  const n = hash2(tx, ty, 0x1c3f);
  const inBand = d < depth && n > 0.06;
  const rockTooth = d === depth && n > 0.93;
  if (!inBand && !rockTooth) return null;
  return {
    cellIndex: ci, side, downhillDropRaw: bestDrop,
    heightClass: q.heightClass, slopeRaw: slope,
    cliffCandidate: candidate, localTile: [lx, ly]
  };
}

/** Static, source-derived counts. Runtime window counts come from QA. */
export function cliffStats() {
  let candidateCells = 0, qualified = 0;
  const sideHistogram: Record<string, number> = { N: 0, S: 0, W: 0, E: 0 };
  for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
    const ci = cy * W + cx;
    if (RASTERS.cliffCandidate[ci] < 1) continue;
    candidateCells++;
    if (RASTERS.heightClass[ci] < CLIFF_HCLASS_MIN) continue;
    if (RASTERS.slope[ci] < CLIFF_SLOPE_MIN) continue;
    const e = RASTERS.elevation[ci];
    let bestDrop = -Infinity, sideIdx = 1;
    for (let k = 0; k < FACE_DIRS.length; k++) {
      const nx = cx + FACE_DIRS[k][0], ny = cy + FACE_DIRS[k][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const d = e - RASTERS.elevation[ny * W + nx];
      if (d > bestDrop) { bestDrop = d; sideIdx = k; }
    }
    if (bestDrop >= FACE_DROP_MIN) { qualified++; sideHistogram[FACE_SIDES[sideIdx]]++; }
  }
  return {
    rasterContract: 'cliffCandidate.v3.u8 = BINARY connected steep FACE (0/1); PROPOSED; no metres/degrees/climb/collision law',
    consumerDefect: 'cliff >= 2 can never match a 0/1 raster (MGP-D10)',
    repairedPredicate: 'cliffCandidate >= 1 AND heightClass >= 4 AND slopeRaw >= 20 AND 4-neighbour downhill drop >= 12',
    independentChecks: ['heightClass.v3.u8', 'slope.u8 (raw source byte)', 'elevation.u8 4-neighbour downhill drop', 'slopeClass.v3.u8 (QA file-level check)', 'activeCollisionPermission.v3.u8 (all zero)'],
    candidateCells, qualifiedCells: qualified, sideHistogram,
    faceBandTilesPerCellEdge: [FACE_BAND_MIN, FACE_BAND_MAX],
    faceEdge: 'deterministic hash2 jitter + ~6% holes + sparse one-tile rock teeth; NEVER a filled 16x16 slab',
    tilesPerAnalysisCell: TILES_PER_CELL * TILES_PER_CELL,
    projectedFractionOfCell: Number((FACE_BAND_TILES / TILES_PER_CELL).toFixed(4)),
    filledSlabsProhibited: true,
    permanentImpassableWallsProhibited: true,
    mode: getCandidateMode(),
    productionCollisionCells: 0,
    note: 'QA candidate collision is explicit and separate; Gameplay-approved collision is NOT granted.'
  };
}

/* ───────────────────────── visible tile code ──────────────────────────── */
/** Restore the authored surface hidden by the legacy 12 AU circular node. */
function restoreLegacyBridgeNode(q: any): number {
  if (!q.authoredLand || q.lake || q.river) return q.coast ? T.SHALLOW : T.DEEP;
  if (q.road) return T.ROAD;
  if (q.coast) return T.SAND;
  return BIOME_TILE[q.biomeCode] ?? T.MEADOW;
}
function correctedFromBase(tx: number, ty: number, baseCode: number): number {
  const id = DECK.get(tkey(tx, ty));
  if (id) return T.BRIDGE;                    // MEASURED deck only
  const q = sampleTile(tx, ty);
  if (!q) return T.DEEP;
  if (cliffFaceAt(tx, ty, q)) return T.CLIFF;   // thin measured face only
  if (baseCode === T.BRIDGE) return restoreLegacyBridgeNode(q);
  return baseCode;
}
export function u05Tile(tx: number, ty: number): number {
  if (!inFrame(tx, ty)) return T.DEEP;
  return correctedFromBase(tx, ty, baseU05Tile(tx, ty));
}
export function u05TileRaw(tx: number, ty: number): number {
  if (!inFrame(tx, ty)) return T.DEEP;
  return correctedFromBase(tx, ty, baseU05TileRaw(tx, ty));
}

/* ───────────────────────── collision / permission boundary ────────────── */
/**
 * PRODUCTION mode: a visible deck is still BLOCKED (no Gameplay crossing law),
 * and a visible cliff face is NOT a wall (no Gameplay climb/collision law).
 * QA mode: decks become crossable and faces become blockers, ONLY so geometry
 * can be measured with real WASD. No permission field is ever written.
 */
export function terrainBlocked(tx: number, ty: number): boolean {
  if (!inFrame(tx, ty)) return true;
  const deckId = DECK.get(tkey(tx, ty));
  if (deckId) return candidateMode === 'PRODUCTION_NO_PERMISSION';
  if (cliffFaceAt(tx, ty)) return candidateMode === 'QA_CANDIDATE_CROSSING';
  return BLOCKING_TERRAIN.has(baseU05Tile(tx, ty));
}
export function candidateInfo(tx: number, ty: number) {
  const q = sampleTile(tx, ty);
  const deckId = DECK.get(tkey(tx, ty)) ?? null;
  const face = cliffFaceAt(tx, ty);
  return {
    mode: getCandidateMode(),
    visibleTile: inFrame(tx, ty) ? u05Tile(tx, ty) : T.DEEP,
    baseTile: inFrame(tx, ty) ? baseU05Tile(tx, ty) : T.DEEP,
    rawTile: q ? q.tile : null,
    bridgeDeckId: deckId,
    cliffFace: face,
    productionBlocked: terrainBlockedIn('PRODUCTION_NO_PERMISSION', tx, ty),
    qaBlocked: terrainBlockedIn('QA_CANDIDATE_CROSSING', tx, ty),
    activeCollisionPermission: false,
    permissions: q ? q.permissions : null,
    sourceId: deckId ? `GOLD.bridges[id=${deckId}]` : q?.sourceId ?? null,
    waterTraversalClass: q?.waterTraversalClass ?? null,
    au: q ? [Number(q.au[0].toFixed(4)), Number(q.au[1].toFixed(4))] : null,
    authority: 'MAP_VISIBLE_GEOMETRY_ONLY__GAMEPLAY_TRAVERSAL_NOT_GRANTED'
  };
}
function terrainBlockedIn(mode: CandidateMode, tx: number, ty: number): boolean {
  if (!inFrame(tx, ty)) return true;
  if (DECK.get(tkey(tx, ty))) return mode === 'PRODUCTION_NO_PERMISSION';
  if (cliffFaceAt(tx, ty)) return mode === 'QA_CANDIDATE_CROSSING';
  return BLOCKING_TERRAIN.has(baseU05Tile(tx, ty));
}

/* ───────────────────────── source / determinism proof ─────────────────── */
export function mapgeo02Source() {
  return {
    task: 'SOH — MAP-GEO-REJOIN-02',
    goldSha256: BRIDGE_SOURCE.goldSha256,
    crossingRasterSha256: BRIDGE_SOURCE.crossingRasterSha256,
    analysisGrid: BRIDGE_SOURCE.analysisGrid,
    bridgeIds: BRIDGES.map(b => b.id),
    resolvedBridgeIds: BRIDGES.filter(b => b.status.startsWith('CANDIDATE_DECK')).map(b => b.id),
    unresolvedBridgeIds: BRIDGES.filter(b => !b.status.startsWith('CANDIDATE_DECK')).map(b => b.id),
    deckTileCount: DECK.size,
    faceBandTiles: [FACE_BAND_MIN, FACE_BAND_MAX],
    faceDropMinRaw: FACE_DROP_MIN,
    deckHalfWidthAu: DECK_HALF_WIDTH_AU,
    deckMaxSpanAu: DECK_MAX_SPAN_AU,
    deterministic: true,
    productionMerge: false,
    gameplayPermissionGranted: false,
    veyraPlayable: false
  };
}
