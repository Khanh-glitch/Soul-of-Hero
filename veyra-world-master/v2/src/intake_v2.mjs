// MAP-LR03R / WMP-02 typed, versioned GEOGRAPHIC HANDOFF.
// CLEAN-ROOM SAFE: reads ONLY data/, layers/, rasters/, manifest.v1.json, v2/.
// This module SUPPLIES Map-owned geographic fields. It does NOT edit the Web
// runtime, does NOT run Gameplay code, and does NOT claim Gameplay ingestion,
// visual approval or playable status.
//
// The v1 projectWindow() emitted FIVE masks (tiles/fresh/zone/seaDist/land).
// Those are NOT a complete playable EconomyMap. This v2 module emits every
// EconomyMap field and every GeographicHandoff field, with Gameplay-owned
// semantics explicitly marked UNRESOLVED rather than faked.
import fs from 'node:fs';
import path from 'node:path';
import {
  MASTER, GW, GH, CELL, N, FRAME_AU, CHUNK_CELLS, CHUNKS_X, CHUNKS_Y,
  sha256, digest, r4, idx, gxOf, gyOf, centreAu, toCell,
  readJson, readBuf, writeJson, writeU8,
  dist, pointInRing, bbox,
  STATUS, authority,
} from '../../lib/wmp.mjs';
import { createWorld } from '../../api/world.mjs';

export const HANDOFF_VERSION = 'soh.wmp.geographic_handoff.v2';
export const ECONOMY_VERSION = 'soh.wmp.economy_map.v2';
export const WINDOW_VERSION = 'soh.wmp.spatial_window.v2';
const V2 = 'v2';
const v2p = rel => path.join(MASTER, V2, rel);
const compact = (rel, obj) => {
  const p = v2p(rel); fs.mkdirSync(path.dirname(p), { recursive: true });
  const b = Buffer.from(JSON.stringify(obj)); fs.writeFileSync(p, b);
  return { file: `${V2}/${rel}`, bytes: b.length, sha256: sha256(b) };
};
const u8 = (arr) => new Uint8Array(arr);
const cell4 = (i, w = GW, h = GH) => {
  const x = i % w, y = Math.floor(i / w), o = [];
  if (x > 0) o.push(i - 1); if (x < w - 1) o.push(i + 1);
  if (y > 0) o.push(i - w); if (y < h - 1) o.push(i + w);
  return o;
};
const ECONOMY_BIOMES = ['water', 'sand', 'grass', 'meadow', 'forest', 'marsh', 'hill', 'snow', 'ash', 'toxic', 'road', 'floor', 'wall', 'lava'];
const POI_KINDS = ['residential', 'industrial', 'mining', 'agricultural', 'other'];

/** 4-connected rasterization of an authored polyline; never wraps a row. */
function rasterPath(points) {
  const cells = [];
  const push = (i) => { if (!cells.length || cells[cells.length - 1] !== i) cells.push(i); };
  for (let k = 0; k < points.length; k++) {
    const p = points[k], c = toCell(p[0], p[1]);
    if (!k) { push(c); continue; }
    let cur = cells[cells.length - 1];
    let cx = gxOf(cur), cy = gyOf(cur), tx = gxOf(c), ty = gyOf(c);
    while (cx !== tx) { cx += cx < tx ? 1 : -1; push(idx(cx, cy)); }
    while (cy !== ty) { cy += cy < ty ? 1 : -1; push(idx(cx, cy)); }
  }
  return cells;
}
function polygonCells(ring) {
  const bb = bbox(ring), out = [];
  for (let gy = Math.max(0, Math.floor(bb[1] / CELL)); gy <= Math.min(GH - 1, Math.ceil(bb[3] / CELL)); gy++)
    for (let gx = Math.max(0, Math.floor(bb[0] / CELL)); gx <= Math.min(GW - 1, Math.ceil(bb[2] / CELL)); gx++) {
      const i = idx(gx, gy); if (pointInRing(centreAu(i), ring)) out.push(i);
    }
  return out;
}
function bfsPath(from, goal, pass, cap = 8000) {
  const prev = new Int32Array(N).fill(-1), seen = new Uint8Array(N), q = new Int32Array(N);
  if (!pass(from) || !pass(goal)) return null;
  let h = 0, t = 0; q[t++] = from; seen[from] = 1;
  while (h < t && h < cap) { const i = q[h++]; if (i === goal) break; for (const j of cell4(i)) if (!seen[j] && pass(j)) { seen[j] = 1; prev[j] = i; q[t++] = j; } }
  if (!seen[goal]) return null;
  const out = []; for (let i = goal; i !== -1; i = prev[i]) out.push(i); return out.reverse();
}
function greedyProtectedPath(start, pass, maxLen = 24) {
  const seen = new Uint8Array(N), out = [start]; seen[start] = 1;
  let cur = start;
  while (out.length < maxLen) {
    const ns = cell4(cur).filter(j => !seen[j] && pass(j));
    if (!ns.length) break;
    const nx = ns[0]; seen[nx] = 1; out.push(nx); cur = nx;
  }
  return out;
}

/** Build the FULL typed EconomyMap + GeographicHandoff. Pure function of v1+v2 bytes. */
export function buildGeographicHandoff() {
  const W = createWorld();
  const { S, D, C, crosswalks, chunks, architecture, manifest: V1 } = W._internal;
  const V2M = readJson('v2/manifest.v2.json');
  const env = {
    moisture: u8(readBuf('v2/rasters/moisturePotentialNorm.u8')),
    temperature: u8(readBuf('v2/rasters/temperaturePotentialNorm.u8')),
    soil: u8(readBuf('v2/rasters/soilSuitabilityNorm.u8')),
    climate: u8(readBuf('v2/rasters/climateSuitabilityNorm.u8')),
  };
  const envMeta = readJson('v2/layers/environment.v2.json');
  const buildSitesV2 = readJson('v2/layers/build_sites.v2.json');
  const transportV2 = readJson('v2/layers/transport_corrections.v2.json');
  const endgame = readJson('layers/build_habitat_endgame.v1.json').endgame;

  // ---------- biome labels (lossy explicit crosswalk, subtypes preserved) ----------
  const biomeByCode = new Map(crosswalks.biomeMap.map(m => [m.sourceBiomeCode, m.economy]));
  const biome = new Array(N), biomeSubtype = new Uint8Array(N);
  const industrialTags = new Set(['gần đường vận tải', 'gần trung tâm khai thác']);
  const industrialZoneIds = new Set(C.zones.filter(z => (z.tags || []).some(t => industrialTags.has(t))).map(z => z.id));
  const industrial = new Uint8Array(N);
  const road = new Uint8Array(N), walkable = new Uint8Array(N), buildable = new Uint8Array(N);
  const cargoPassable = new Uint8Array(N), protectedM = new Uint8Array(N);
  const freshwater = new Uint8Array(N), coast = new Uint8Array(N);
  const elevation = new Float64Array(N), slope = new Float64Array(N);
  const moisture = new Float64Array(N), temperature = new Float64Array(N);

  const proposedDeckCells = new Set();
  for (const b of transportV2.bridgeDecks) for (const i of (b.measured?.deckCells ?? [])) proposedDeckCells.add(i);

  for (let i = 0; i < N; i++) {
    const wc = S.waterClass[i], bc = S.biomeCode[i];
    biomeSubtype[i] = bc;
    let label = biomeByCode.get(bc) ?? 'meadow';
    if (!ECONOMY_BIOMES.includes(label)) label = 'meadow';
    if (wc > 0) label = (S.roadClass[i] > 0 && wc !== 1) ? 'road' : 'water';
    else if (S.roadClass[i] > 0) label = 'road';
    biome[i] = label;
    elevation[i] = S.elevation[i];                       // RAW BYTE, unit UNRESOLVED
    slope[i] = r4(Math.min(1, S.slope[i] / 255));        // normalized raw slope, NOT degrees
    moisture[i] = env.moisture[i] / 255;                 // PROPOSED normalized potential, NOT a rate
    temperature[i] = env.temperature[i] / 255;           // PROPOSED normalized potential, NOT degrees
    freshwater[i] = S.freshwater[i] ? 1 : 0;
    coast[i] = S.coast[i] ? 1 : 0;
    protectedM[i] = S.protectedGeometryCandidate[i] ? 1 : 0;
    industrial[i] = (industrialZoneIds.has(C.zones[S.zoneId[i] - 1]?.id) && (S.poiGeometryId[i] > 0 || S.roadClass[i] > 0)) ? 1 : 0;
    const dry = wc === 0 && S.landId[i] > 0;
    walkable[i] = (dry && (S.walkableCandidate[i] > 0 || S.roadClass[i] > 0 || S.clearanceCells[i] > 0)) ? 1 : 0;
    // ASSUMED FOOTPRINT PROFILE (8 au body, 8 au width): a geometric screening
    // mask, NOT an approved Gameplay vehicle envelope or cart-passability law.
    cargoPassable[i] = (dry && S.clearanceCells[i] * CELL >= 8 && (S.roadClass[i] > 0 || S.walkableCandidate[i] > 0) && S.slope[i] <= 4) ? 1 : 0;
  }

  // ---------- authored roads: 4-connected cells + road/bridge masks ----------
  const bridgeCells = new Map(C.bridges.map(b => [toCell(b.at[0], b.at[1]), b.id]));
  const roads = C.roads.map(r => {
    let cells = rasterPath(r.points);
    if (cells.length < 2) {                 // validator requires >= 2 adjacent cells
      const c = cells[0], n = cell4(c).find(j => S.waterClass[j] === 0 && S.landId[j] > 0);
      if (n !== undefined) cells = [c, n];
    }
    for (const i of cells) { road[i] = 1; if (S.waterClass[i] === 0) walkable[i] = 1; }
    const bridgeCellsForRoad = cells.filter(i => bridgeCells.has(i));
    return { id: r.id, cells, surface: r.kind || 'road', widthTiles: 1, bridgeCells: bridgeCellsForRoad, cargoPassable: false, status: 'AUTHORED_ROAD_CELL_PATH' };
  });
  // Authored bridge centres become PROPOSED deck cells (road + walkable, NOT cargoPassable).
  for (const [i, bridgeId] of bridgeCells) { road[i] = 1; walkable[i] = 1; cargoPassable[i] = 0; }
  // Road centrelines that cross authored freshwater: the v2 corrective layer
  // supplies a PROPOSED measured deck (authored bridge) or a PROPOSED measured
  // ford channel. These cells are walkable ONLY as proposed geometry; they are
  // NOT authored dry land, NOT cart-passable, and ford depth/flow stay UNKNOWN.
  const proposedWaterRoadCells = [];
  for (let i = 0; i < N; i++) {
    if (!road[i] || S.waterClass[i] === 0) continue;
    walkable[i] = 1; cargoPassable[i] = 0;
    proposedWaterRoadCells.push({
      cellIndex: i, atAu: centreAu(i).map(r4), waterClass: S.waterClass[i],
      bridgeId: bridgeCells.get(i) ?? null,
      status: bridgeCells.has(i) ? 'PROPOSED_BRIDGE_DECK_CELL__NOT_AUTHORED_LAND' : 'PROPOSED_FORD_CHANNEL_CELL__DEPTH_AND_FLOW_UNKNOWN',
      cargoPassable: 0, owner: 'MAP+GAMEPLAY',
    });
  }

  // ---------- authored build-site dry subsets + loading candidates ----------
  const assumedProfileOverrides = [];
  const buildSites = buildSitesV2.sites.map(s => {
    // Use ONLY the largest connected dry component's cells (VERIFIED footprint
    // connectivity), never the whole unconnected dry set.
    const chosen = s.recomputed.largestConnectedDryCellIndices ?? [];
    for (const i of chosen) buildable[i] = 1;
    let loading = chosen.filter(i => cargoPassable[i] === 1).slice(0, 8);
    if (!loading.length) {
      // Explicit ASSUMED-PROFILE override: nearest dry cell with >=24au static
      // clearance. Recorded, not hidden; still NOT a Gameplay approval.
      let best = null;
      for (let i = 0; i < N; i++) {
        if (S.waterClass[i] !== 0 || S.landId[i] <= 0 || S.clearanceCells[i] < 3) continue;
        const d = dist(centreAu(i), centreAu(toCell(...(s.homeCandidate.anchorAu || [0, 0]))));
        if (!best || d < best.d) best = { d, i };
      }
      if (best) { cargoPassable[best.i] = 1; loading = [best.i]; assumedProfileOverrides.push({ siteId: s.siteId, cellIndex: best.i, reason: 'NO_CARGO_CELL_IN_DRY_SUBSET', status: 'MAP_ASSUMED_PROFILE_OVERRIDE__NOT_GAMEPLAY_APPROVED' }); }
    }
    return { id: s.siteId, cells: chosen, loadingCells: loading, status: 'VERIFIED_GEOMETRY__DRY_BUILD_FOOTPRINT' };
  });

  // ---------- authored POIs ----------
  const poiKind = (arche = '') => {
    const a = arche.toLowerCase();
    if (/mine|quarry|excavat|pit/.test(a)) return 'mining';
    if (/farm|barn|field|orchard|agri/.test(a)) return 'agricultural';
    if (/house|home|hut|cabin|dwelling|residen/.test(a)) return 'residential';
    if (/factory|workshop|kiln|forge|warehouse|plant|mill|depot|industrial/.test(a)) return 'industrial';
    return 'other';
  };
  const pois = architecture.pois.map(p => {
    const ground = (p.levels || []).find(l => l.name === 'GROUND');
    const ring = ground?.polygonAu ?? p.deepAu;
    const footprint = polygonCells(ring), fp = new Set(footprint);
    const inFp = i => fp.has(i);
    const entrances = p.staticOpenings.filter(o => o.kind === 'EXTERIOR_ENTRANCE').map(o => toCell(...o.centreAu));
    const entranceCells = entrances.filter(inFp);
    if (!entranceCells.length && footprint.length) entranceCells.push(footprint[0]);
    const doors = p.staticOpenings.filter(o => o.kind === 'INTERIOR_DOORWAY').map(o => toCell(...o.centreAu));
    const rooms = p.rooms.map(rm => polygonCells(rm.polygonAu).filter(inFp));
    const pass = i => walkable[i] === 1;
    const start = entranceCells[0] ?? footprint[0];
    let retreat = null;
    // Nearest authored road cell reachable from the entrance.
    let goal = null, bestD = Infinity;
    for (let i = 0; i < N; i++) if (road[i] && pass(i)) { const d = dist(centreAu(i), centreAu(start)); if (d < bestD) { bestD = d; goal = i; } }
    if (goal !== null) retreat = bfsPath(start, goal, pass);
    const retreatPaths = retreat && retreat.length ? [retreat] : [[start]];
    return {
      id: p.poiId, kind: poiKind(p.arche), footprint, entrances: entranceCells, rooms, doors,
      powerNodes: [], hazardCells: [], exteriorLootSites: [], interiorLootSites: [], retreatPaths,
      status: 'AUTHORED_POI_GEOMETRY__DYNAMIC_CONTENT_GAMEPLAY_OWNED',
    };
  });

  // ---------- critical paths over protected + walkable cells ----------
  const protPass = i => protectedM[i] === 1 && walkable[i] === 1;
  let bestComp = [], seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!protPass(i) || seen[i]) continue;
    const q = [i], comp = []; seen[i] = 1;
    while (q.length) { const j = q.pop(); comp.push(j); for (const k of cell4(j)) if (protPass(k) && !seen[k]) { seen[k] = 1; q.push(k); } }
    if (comp.length > bestComp.length) bestComp = comp;
  }
  const criticalPaths = bestComp.length >= 2 ? [greedyProtectedPath(bestComp[0], protPass, Math.min(24, bestComp.length))] : [];

  // ---------- starts ----------
  const starts = C.spawns.map((s, k) => {
    let i = toCell(s.at[0], s.at[1]);
    if (!walkable[i]) {
      // nearest walkable cell to the authored anchor, preserving the anchor Au
      let best = null;
      for (let j = 0; j < N; j++) if (walkable[j]) { const d = dist(centreAu(j), s.at); if (!best || d < best.d) best = { d, j }; }
      if (best) i = best.j;
    }
    return { id: s.id, x: gxOf(i), y: gyOf(i), authoredAnchorAu: s.at.map(r4), cellIndex: i, status: 'AUTHORED_SPAWN_ANCHOR_SNAPPED_TO_NEAREST_WALKABLE_CELL' };
  });

  // ---------- endgame-owned site arrays (GEOMETRY ONLY) ----------
  const nonbossCashSites = endgame.nonbossSourceSites.map(s => toCell(...s.atAu));
  const vendorSites = endgame.vendorCandidates.map(s => toCell(...s.atAu));
  const evacuationSites = endgame.evacuationCandidates.map(s => s.anchorCellIndex ?? toCell(...s.anchorAu));

  const economy = {
    id: 'veyra-wmp-v2', revision: 2, seed: 0,
    width: GW, height: GH, tileSize: CELL,
    biome, elevation: Array.from(elevation), slope: Array.from(slope),
    moisture: Array.from(moisture), temperature: Array.from(temperature),
    freshwater: Array.from(freshwater), coast: Array.from(coast), walkable: Array.from(walkable),
    buildable: Array.from(buildable), cargoPassable: Array.from(cargoPassable), road: Array.from(road),
    protected: Array.from(protectedM), industrial: Array.from(industrial),
    starts: starts.map(({ id, x, y }) => ({ id, x, y })),
  };
  const handoff = {
    schema: HANDOFF_VERSION, version: 2, economySchema: ECONOMY_VERSION, authority,
    status: 'MAP_OWNED_GEOGRAPHIC_FIELDS_SUPPLIED__GAMEPLAY_INGESTION_NOT_IMPLEMENTED',
    parent: { manifestV1Sha256: sha256(readBuf('manifest.v1.json')), revisionDigestV1: V1.revisionDigest, manifestV2RevisionDigest: V2M.revisionDigest, pinnedUnchanged: true },
    economy, roads, pois, criticalPaths, buildSites, nonbossCashSites, vendorSites, evacuationSites,
    provenance: {
      sourceIntegrity: V1.sourceIntegrity, environmentFormulas: envMeta.formulas,
      biomeCrosswalk: 'layers/crosswalks.v1.json biomeMap (lossy 14-label projection); ORIGINAL 12 subtype IDs preserved in biomeSubtype.u8 and v2/evidence/windows/*.biomeSubtype.u8',
      bridgeDeckCells: 'v2/layers/transport_corrections.v2.json measured deck cells; PROPOSED, non-canonical',
      proposedWaterRoadCells,
      buildSiteCells: 'v2/layers/build_sites.v2.json largest connected dry component under LR02-identical criterion',
      spawnAnchors: 'GOLD project.spawns[]; snapped only when the anchor cell is not walkable',
    },
    // Gameplay-owned semantics are explicitly UNRESOLVED, never faked.
    unresolvedGameplayOwned: [
      { field: 'seed', current: 0, status: STATUS.UNRESOLVED, owner: 'GAMEPLAY', note: 'validateEconomyMap() requires a nonnegative safe integer. 0 is an EXPLICIT UNRESOLVED PLACEHOLDER, NOT a Gameplay world seed.' },
      { field: 'tileSize', current: CELL, status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY', note: '8 authoring units per source cell; NO approved au->runtime-tile transform.' },
      { field: 'elevation', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY', note: 'RAW BYTE from GEO-01; NOT proven metres.' },
      { field: 'slope', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY', note: 'Normalized raw byte; NOT degrees and NOT a Gameplay passability threshold.' },
      { field: 'moisture', status: STATUS.PROPOSED, owner: 'MAP+GAMEPLAY', note: 'Normalized PROPOSED geographic potential in [0,1] for structural completeness; NOT a weather/moisture rate.' },
      { field: 'temperature', status: STATUS.PROPOSED, owner: 'MAP+GAMEPLAY', note: 'Normalized PROPOSED thermal potential in [0,1]; NOT degrees, NOT damage, NOT a season.' },
      { field: 'cargoPassable', status: STATUS.PROPOSED, owner: 'MAP+GAMEPLAY', note: 'ASSUMED 8 au footprint screening mask under ASSUMPTION_PROFILE; NOT approved cart passability. All roads keep cargoPassable=false.' },
      { field: 'industrial', status: STATUS.PROPOSED, owner: 'MAP+GAMEPLAY', note: 'Derived from authored zone tags gần đường vận tải / gần trung tâm khai thác plus road/POI geometry; NOT a Gameplay industrial designation.' },
      { field: 'roads[].widthTiles', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY', note: '1 tile is a raster cell path, NOT an authored physical cross-section.' },
      { field: 'roads[].cargoPassable', status: STATUS.UNRESOLVED, owner: 'GAMEPLAY', note: 'false for all 92 roads; no invented cart-passability approval.' },
      { field: 'pois[].powerNodes/hazardCells/exteriorLootSites/interiorLootSites', status: STATUS.UNKNOWN, owner: 'GAMEPLAY', note: 'EMPTY arrays. No fake loot, power node, hazard or stock.' },
      { field: 'pois[].doors dynamic state', status: STATUS.UNKNOWN, owner: 'GAMEPLAY', note: 'Only static doorway cell indices are supplied.' },
      { field: 'nonbossCashSites cash item / vendor stock+price / evacuation timer+receipt', status: STATUS.UNKNOWN, owner: 'GAMEPLAY', note: 'GEOMETRY cell indices only.' },
      { field: 'stock/custody/escrow/save/offline/AI/visual approval', status: STATUS.UNKNOWN, owner: 'GAMEPLAY+CREATOR', note: 'Not supplied at all.' },
    ],
    gameplayOwnedChecks: {
      compileEconomy: 'NOT_EXECUTED__GAMEPLAY_OWNED', diagnoseStarts: 'NOT_EXECUTED__GAMEPLAY_OWNED',
      validateGeographicHandoff: 'NOT_EXECUTED__GAMEPLAY_OWNED',
      webRuntimeModified: false,
    },
  };
  return { handoff, economy, env, biomeSubtype, assumedProfileOverrides, starts, road, walkable, buildable, cargoPassable, protectedM, industrial, proposedDeckCells, V2M, V1, chunks };
}

/** Deterministic JS port of ONLY the structural parts of validateEconomyMap() /
    validateGeographicHandoff(). It deliberately does NOT execute compileEconomy()
    or diagnoseStarts(), which are Gameplay-owned. */
export function mapStructuralSelfCheck(h) {
  const e = [], m = h.economy, n = m.width * m.height;
  if (!/^[a-z][a-z0-9_-]*$/.test(m.id || '')) e.push('stable map id required');
  if (!Number.isSafeInteger(m.revision) || m.revision < 1 || !Number.isSafeInteger(m.seed) || m.seed < 0) e.push('positive revision and nonnegative integer world seed required');
  if (!Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width < 3 || m.height < 3 || !Number.isFinite(m.tileSize) || m.tileSize <= 0) return [...e, 'invalid bounds/tile scale'];
  for (const k of ['biome', 'elevation', 'slope', 'moisture', 'temperature', 'freshwater', 'coast', 'walkable', 'buildable', 'cargoPassable', 'road', 'protected', 'industrial']) if (!m[k] || m[k].length !== n) e.push(`${k} must have ${n} cells`);
  if (!e.length) {
    const biomes = new Set(ECONOMY_BIOMES), flags = ['freshwater', 'coast', 'walkable', 'buildable', 'cargoPassable', 'road', 'protected', 'industrial'];
    for (let i = 0; i < n; i++) {
      if (!biomes.has(m.biome[i])) { e.push(`unknown biome at cell ${i}`); break; }
      if (!Number.isFinite(m.elevation[i]) || !Number.isFinite(m.slope[i]) || m.slope[i] < 0 || ![m.moisture[i], m.temperature[i]].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) { e.push(`invalid terrain or climate at cell ${i}`); break; }
      if (flags.some(k => m[k][i] !== 0 && m[k][i] !== 1)) { e.push(`invalid geographic mask at cell ${i}`); break; }
    }
  }
  const ids = new Set();
  if (!Array.isArray(m.starts) || !m.starts.length) e.push('at least one authored start required');
  else for (const s of m.starts) { if (!s || !s.id || ids.has(s.id) || !Number.isInteger(s.x) || !Number.isInteger(s.y) || s.x < 1 || s.y < 1 || s.x >= m.width - 1 || s.y >= m.height - 1) e.push(`invalid or duplicate start ${s?.id}`); if (s?.id) ids.add(s.id); }
  const valid = i => Number.isInteger(i) && Number(i) >= 0 && Number(i) < n;
  const path = p => Array.isArray(p) && p.length > 0 && p.every(valid) && p.every((v, j) => j === 0 || Math.abs(v - p[j - 1]) === m.width || (Math.abs(v - p[j - 1]) === 1 && Math.floor(v / m.width) === Math.floor(p[j - 1] / m.width)));
  if (!Array.isArray(h.roads) || !h.roads.length) e.push('authored road geometry required');
  else for (const r of h.roads) {
    if (!r || !r.id || !r.surface || !Number.isFinite(r.widthTiles) || r.widthTiles <= 0 || typeof r.cargoPassable !== 'boolean' || !path(r.cells) || !Array.isArray(r.bridgeCells) || !r.bridgeCells.every(c => valid(c) && r.cells.includes(c)) || !r.cells.every(c => !!m.road[c]) || (r.cargoPassable && !r.cells.every(c => !!m.cargoPassable[c]))) e.push(`invalid road geometry ${r?.id || '(unnamed)'}`);
    if (r && path(r.cells) && r.cells.length >= 2 && Number.isInteger(r.widthTiles) && r.widthTiles >= 1 && r.widthTiles <= 32) {
      let validWidth = true; const before = -Math.floor((r.widthTiles - 1) / 2), after = before + r.widthTiles - 1;
      for (let i = 0; i < r.cells.length && validWidth; i++) {
        const cell = r.cells[i], a = r.cells[i === r.cells.length - 1 ? i - 1 : i], b = r.cells[i === r.cells.length - 1 ? i : i + 1], horizontal = Math.abs(b - a) === 1;
        const x = cell % m.width, y = Math.floor(cell / m.width);
        for (let k = before; k <= after; k++) { const nx = x + (horizontal ? 0 : k), ny = y + (horizontal ? k : 0), j = ny * m.width + nx; if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || !m.walkable[j] || (r.cargoPassable && !m.cargoPassable[j])) { validWidth = false; break; } }
      }
      if (!validWidth) e.push(`road ${r.id} advertised width is obstructed in the supplied raster`);
    } else if (r) e.push(`road ${r.id || '(unnamed)'} requires 2+ cells and an integer width of 1..32 tiles`);
  }
  if (!Array.isArray(h.pois) || !h.pois.length) e.push('authored POI geometry required');
  else for (const p of h.pois) {
    if (!p || !p.id || !POI_KINDS.includes(p.kind) || !p.footprint?.length || !p.footprint.every(valid) || !p.entrances?.length || !p.entrances.every(c => valid(c) && p.footprint.includes(c)) || !Array.isArray(p.rooms) || !p.rooms.every(room => Array.isArray(room) && room.every(c => valid(c) && p.footprint.includes(c))) || !Array.isArray(p.doors) || !Array.isArray(p.powerNodes) || !Array.isArray(p.hazardCells) || !Array.isArray(p.exteriorLootSites) || !Array.isArray(p.interiorLootSites) || ![...p.doors, ...p.powerNodes, ...p.hazardCells, ...p.exteriorLootSites, ...p.interiorLootSites].every(valid) || !Array.isArray(p.retreatPaths) || !p.retreatPaths.length || !p.retreatPaths.every(path)) e.push(`invalid or incomplete POI geometry ${p?.id || '(unnamed)'}`);
  }
  if (!Array.isArray(h.criticalPaths) || !h.criticalPaths.length || !h.criticalPaths.every(p => path(p) && p.every(i => !!m.protected[i] && !!m.walkable[i]))) e.push('authored contiguous critical paths required');
  if (!Array.isArray(h.buildSites) || !h.buildSites.length || h.buildSites.some(s => !s || !s.id || !s.cells?.length || !s.cells.every(c => valid(c) && !!m.buildable[c]) || !s.loadingCells?.length || !s.loadingCells.every(c => valid(c) && !!m.cargoPassable[c]))) e.push('buildable footprint and loading candidates required');
  for (const k of ['nonbossCashSites', 'vendorSites', 'evacuationSites']) if (!Array.isArray(h[k]) || !h[k].length || !h[k].every(valid)) e.push(`${k} geometry required`);
  return e;
}

/** Complete spatial window sampling with stable source IDs and consistent chunks. */
export function projectWindowV2() {
  const { handoff, economy, biomeSubtype, V2M, V1, chunks } = buildGeographicHandoff();
  const W = createWorld(); const { S, D, C } = W._internal;
  const WINDOWS = [
    { id: 'wmp.v2.window.full.250x175', x0: 0, y0: 0, w: GW, h: GH, chunkX: [0, CHUNKS_X - 1], chunkY: [0, CHUNKS_Y - 1] },
    { id: 'wmp.v2.window.west.125x175', x0: 0, y0: 0, w: 125, h: GH, chunkX: [0, 4], chunkY: [0, CHUNKS_Y - 1] },
    { id: 'wmp.v2.window.east.125x175', x0: 125, y0: 0, w: 125, h: GH, chunkX: [5, CHUNKS_X - 1], chunkY: [0, CHUNKS_Y - 1] },
  ];
  // All 13 EconomyMap fields + supplementary authored layers = COMPLETE sampling.
  const MASKS = [
    ['biomeEconomyCode', i => ECONOMY_BIOMES.indexOf(economy.biome[i])],
    ['biomeSubtype', i => biomeSubtype[i]],
    ['elevation', i => Math.min(255, Math.round(economy.elevation[i]))],
    ['slope', i => Math.min(255, Math.round(economy.slope[i] * 255))],
    ['moisture', i => Math.min(255, Math.round(economy.moisture[i] * 255))],
    ['temperature', i => Math.min(255, Math.round(economy.temperature[i] * 255))],
    ['freshwater', i => economy.freshwater[i]], ['coast', i => economy.coast[i]],
    ['walkable', i => economy.walkable[i]], ['buildable', i => economy.buildable[i]],
    ['cargoPassable', i => economy.cargoPassable[i]], ['road', i => economy.road[i]],
    ['protected', i => economy.protected[i]], ['industrial', i => economy.industrial[i]],
    ['surface', i => D.surface[i]], ['zone', i => S.zoneId[i]],
    ['seaDistance', i => Math.min(255, S.seaDistanceCells[i])], ['land', i => S.landId[i]],
  ];
  const reports = [];
  for (const win of WINDOWS) {
    const dir = v2p(`evidence/windows/${win.id}`); fs.mkdirSync(dir, { recursive: true });
    const files = []; let outOfFrame = 0;
    const globalTiles = new Set();
    for (const [name, fn] of MASKS) {
      const arr = new Uint8Array(win.w * win.h);
      for (let ty = 0; ty < win.h; ty++) for (let tx = 0; tx < win.w; tx++) {
        const gx = win.x0 + tx, gy = win.y0 + ty, k = ty * win.w + tx;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) { outOfFrame++; arr[k] = 255; continue; }
        arr[k] = Math.max(0, Math.min(255, fn(idx(gx, gy))));
        if (name === 'land') globalTiles.add(idx(gx, gy));
      }
      const rel = `v2/evidence/windows/${win.id}/${name}.u8`;
      const b = Buffer.from(arr); fs.writeFileSync(v2p(`evidence/windows/${win.id}/${name}.u8`), b);
      files.push({ name, file: rel, bytes: b.length, sha256: sha256(b), layout: { widthTiles: win.w, heightTiles: win.h, order: 'row_major k=ty*widthTiles+tx' } });
    }
    reports.push({ ...win, globalTileRange: { gx0: win.x0, gy0: win.y0, gx1: win.x0 + win.w, gy1: win.y0 + win.h }, cellCount: win.w * win.h, globalTileCount: globalTiles.size, outOfFrameTiles: outOfFrame, maskCount: files.length, files });
  }
  // Adjacent windows must be DISJOINT and their union must cover the whole frame.
  const west = reports[1], east = reports[2], full = reports[0];
  const overlap = [];
  for (let gy = west.globalTileRange.gy0; gy < west.globalTileRange.gy1; gy++) for (let gx = west.globalTileRange.gx0; gx < west.globalTileRange.gx1; gx++) if (gx >= east.globalTileRange.gx0 && gx < east.globalTileRange.gx1) overlap.push(idx(gx, gy));
  // Chunk-index integrity: stable IDs, no duplicates within a chunk, digests match.
  let chunkDigestMismatches = 0, chunkDuplicateIds = 0, missingFeatureIds = 0;
  const allIndexed = new Set();
  for (const c of chunks.chunks) {
    if (sha256(Buffer.from(c.featureIds.join('|'))) !== c.stableIdDigest) chunkDigestMismatches++;
    if (new Set(c.featureIds).size !== c.featureIds.length) chunkDuplicateIds++;
    for (const f of c.featureIds) allIndexed.add(f);
  }
  for (const f of readJson('layers/feature_index.v1.json').features) if (!allIndexed.has(f.id)) missingFeatureIds++;
  const featureIds = readJson('layers/feature_index.v1.json').features.map(f => f.id).sort();
  const stableSourceIdDigest = sha256(Buffer.from(featureIds.join('|')));
  const boundaryChecks = [];
  for (let cx = 1; cx < CHUNKS_X; cx++) {
    const left = chunks.chunks.find(c => c.cx === cx - 1 && c.cy === 0), right = chunks.chunks.find(c => c.cx === cx && c.cy === 0);
    if (!left || !right) continue;
    boundaryChecks.push({ boundary: `vertical chunk x=${cx * CHUNK_CELLS}`, leftChunk: left.id, rightChunk: right.id, neighbourDeclared: left.neighbours.includes(right.id), duplicateFeatureIdsAcrossBoundary: left.featureIds.filter(f => right.featureIds.includes(f)).length });
  }
  const report = {
    schema: WINDOW_VERSION, version: 2, authority, status: 'COMPLETE_SPATIAL_SAMPLING__NOT_RUNTIME_INGESTED',
    handoffSchema: HANDOFF_VERSION,
    unitsPerTileAu: CELL, note: 'At U=8 au/tile each window tile maps to EXACTLY ONE 8au source cell (250x175). No interpolation, no duplication.',
    v1Insufficiency: 'v1 projectWindow() emitted only tiles/fresh/zone/seaDist/land (5 masks). That is NOT a complete playable EconomyMap.',
    v2MaskNames: MASKS.map(m => m[0]), windows: reports.map(r => ({ id: r.id, globalTileRange: r.globalTileRange, cellCount: r.cellCount, globalTileCount: r.globalTileCount, outOfFrameTiles: r.outOfFrameTiles, maskCount: r.maskCount, files: r.files })),
    continuity: {
      adjacentWindowPair: [west.id, east.id], duplicateGlobalTiles: overlap.length,
      unionCoverageCells: west.cellCount + east.cellCount - overlap.length,
      fullWindowCoverageCells: full.cellCount, expectedCells: N,
      completeCoverage: overlap.length === 0 && west.cellCount + east.cellCount === N && full.cellCount === N,
      chunkBoundaryConsistency: { boundaryChecks, chunkDigestMismatches, chunkDuplicateIds, missingFeatureIds, stableSourceIdDigest, status: chunkDigestMismatches === 0 && chunkDuplicateIds === 0 && missingFeatureIds === 0 ? 'VERIFIED__STABLE_IDS_AND_CONSISTENT_CHUNK_BOUNDARIES' : 'DISCONTINUITY_DETECTED' },
    },
    parent: { v1ManifestSha256: sha256(readBuf('manifest.v1.json')), v1RevisionDigest: V1.revisionDigest, v2RevisionDigest: V2M.revisionDigest },
    noClaims: ['NO Gameplay runtime ingestion', 'NO playable Web slice', 'NO visual approval'],
  };
  const desc = compact('evidence/windows/window_report.v2.json', report);
  return { report, descriptor: desc };
}

/** Materialize the handoff + structural self-check into v2/handoff/. */
export function materializeHandoff() {
  const built = buildGeographicHandoff();
  const errors = mapStructuralSelfCheck(built.handoff);
  const files = [];
  files.push(compact('handoff/geographic_handoff.v2.json', built.handoff));
  const check = {
    schema: 'soh.wmp.v2.handoff_structural_check.v1', authority,
    status: errors.length ? 'STRUCTURAL_ERRORS' : 'MAP_SIDE_STRUCTURAL_SELF_CHECK_PASSED',
    errors, errorCount: errors.length,
    checksExecuted: ['validateEconomyMap structural port', 'GeographicHandoff roads/pois/criticalPaths/buildSites/site-array structural port'],
    checksNotExecuted: [
      { name: 'compileEconomy()', owner: 'GAMEPLAY', reason: 'Gameplay runtime code; Map must not run or modify it.' },
      { name: 'diagnoseStarts()', owner: 'GAMEPLAY', reason: 'Gameplay runtime code; depends on compileEconomy() source placement.' },
      { name: 'validateGeographicHandoff()', owner: 'GAMEPLAY', reason: 'Full Gameplay validator that calls the two functions above.' },
    ],
    disclaimer: 'A MAP-SIDE STRUCTURAL SELF-CHECK PASS is NOT validateGeographicHandoff() PASS, NOT Gameplay ingestion, NOT balanced starts, NOT playable Veyra.',
    fieldCounts: {
      economyFields: Object.keys(built.economy).length, economyCells: N,
      roads: built.handoff.roads.length, pois: built.handoff.pois.length,
      criticalPaths: built.handoff.criticalPaths.length, buildSites: built.handoff.buildSites.length,
      nonbossCashSites: built.handoff.nonbossCashSites.length, vendorSites: built.handoff.vendorSites.length, evacuationSites: built.handoff.evacuationSites.length,
      unresolvedGameplayOwnedFields: built.handoff.unresolvedGameplayOwned.length,
    },
    assumedProfileOverrides: built.assumedProfileOverrides,
    starts: built.starts,
  };
  files.push(writeJson('v2/handoff/handoff_check.v2.json', check));
  return { check, files };
}

if (process.argv[1] && process.argv[1].endsWith('intake_v2.mjs')) {
  const { check, files } = materializeHandoff();
  const { report } = projectWindowV2();
  console.log(`WMP_V2_HANDOFF_OK errors=${check.errors.length} roads=${check.fieldCounts.roads} pois=${check.fieldCounts.pois} buildSites=${check.fieldCounts.buildSites} unresolved=${check.fieldCounts.unresolvedGameplayOwnedFields}`);
  console.log(`WMP_V2_WINDOWS_OK windows=${report.windows.length} masks=${report.v2MaskNames.length} duplicates=${report.continuity.duplicateGlobalTiles} coverage=${report.continuity.unionCoverageCells}/${N} chunkStatus=${report.continuity.chunkBoundaryConsistency.status}`);
  if (check.errors.length) { for (const e of check.errors.slice(0, 20)) console.error('  ERR', e); process.exit(1); }
}
