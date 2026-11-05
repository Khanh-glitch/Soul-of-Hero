/**
 * SOH — MAP-GEO-REJOIN-02 · task C
 * Reclassify the 31 GOLD roads whose centrelines were water-overridden in
 * MAP-GEO-REJOIN-01 (MGP-D02) into four, mutually exclusive, source-backed
 * categories. Pure evidence work: NO geometry, road width, palette or GOLD
 * amendment; NO ferry route may become a dry-land road.
 *
 * Priority (first match wins):
 *   1 FERRY_NAVIGATION_REFERENCE      GOLD roads[kind=ferry] (8 inherited routes)
 *   2 AUTHORED_BRIDGE                WMP-03 BRIDGE_DECK_PROPOSAL cells
 *   3 UNBRIDGED_LAND_ROAD_CROSSING   WMP-03 FORD_PROPOSAL / crossingCandidate=3
 *   4 AMBIGUOUS_OWNER_REVIEW         no source-backed crossing evidence
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => fs.readFileSync(path.join(REPO, p));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

const auditBytes = rd('creator-u05/evidence/mapgeo01-physical-audit.json');
const audit = JSON.parse(auditBytes.toString('utf8'));
const goldBytes = rd('veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json');
const gold = JSON.parse(goldBytes.toString('utf8')).project;
const wtBytes = rd('veyra-world-master/v3/layers/water_traversal.v3.json');
const wt = JSON.parse(wtBytes.toString('utf8'));
const crossBytes = rd('veyra-world-master/data/rasters/geo01/crossingCandidate.u8');

const wetRoads = audit.roads.roads.filter(r => (r.waterOverrideSamples ?? 0) > 0);
const ferryIds = new Set(gold.roads.filter(r => r.kind === 'ferry').map(r => r.id));
const ferryRouteIds = new Set(wt.ferryRoutes.map(f => f.id));
const bridgeDeckIds = new Set(wt.bridgeDeckProposals.map(b => b.id));
const fordRoadIds = new Set(wt.fordProposals.map(f => f.roadId));
const bridgeCellIndices = new Set(wt.bridgeDeckProposals.flatMap(b => b.cells));
const fordCellIndices = new Set(wt.fordProposals.flatMap(f => f.cells));
const cellsByRoad = new Map();
for (const c of wt.waterRoadCellClassifications) {
  if (!cellsByRoad.has(c.roadId)) cellsByRoad.set(c.roadId, []);
  cellsByRoad.get(c.roadId).push(c);
}
const crossingCode3Cells = [];
for (let i = 0; i < crossBytes.length; i++) if (crossBytes[i] === 3) crossingCode3Cells.push(i);

const rows = [];
for (const r of wetRoads) {
  const cells = cellsByRoad.get(r.id) ?? [];
  const kinds = cells.reduce((a, c) => { a[c.surfaceKind] = (a[c.surfaceKind] || 0) + 1; return a; }, {});
  const hasBridge = (kinds.BRIDGE_DECK_PROPOSAL ?? 0) > 0;
  const hasFord = (kinds.FORD_PROPOSAL ?? 0) > 0;
  const isFerry = ferryIds.has(r.id) || ferryRouteIds.has(r.id);
  let category, owner, status, reason;
  if (isFerry) {
    category = 'FERRY_NAVIGATION_REFERENCE';
    owner = 'GAMEPLAY (boat/ferry mechanic)';
    status = 'SOURCE_AUTHORED_GEOMETRY__NOT_A_LAND_ROAD';
    reason = 'GOLD kind=ferry; WMP-03 FERRY_ROUTE cells, landWalkable=false, activeCollisionPermission=false. Must NEVER become a dry-land road.';
  } else if (hasBridge) {
    category = 'AUTHORED_BRIDGE';
    owner = 'MAP geometry + GAMEPLAY WorldTraversal';
    status = 'BRIDGE_DECK_PROPOSAL__GEOMETRY_ONLY__NO_COLLISION_PERMISSION';
    reason = 'WMP-03 BRIDGE_DECK_PROPOSAL cell(s) at this road crossing; any extra FORD cells are recorded, not promoted.';
  } else if (hasFord || fordRoadIds.has(r.id)) {
    category = 'UNBRIDGED_LAND_ROAD_CROSSING';
    owner = 'MAP+GAMEPLAY (depth/flow UNKNOWN)';
    status = 'FORD_PROPOSAL__DEPTH_AND_FLOW_UNKNOWN';
    reason = 'WMP-03 FORD_PROPOSAL / crossingCandidate=3. Road centreline crosses water with NO authored bridge deck; no dry-land road or bridge is invented.';
  } else {
    category = 'AMBIGUOUS_OWNER_REVIEW';
    owner = 'CREATOR / GAMEPLAY owner';
    status = 'UNRESOLVED__NO_SOURCE_BACKED_CROSSING_EVIDENCE';
    reason = 'Water override measured at U=0.5 tile centres but NO WMP-03 water-road cell classification exists for this road at 8 AU analysis resolution. Exact id reported; no geometry guessed.';
  }
  rows.push({
    id: r.id, name: r.name, kind: r.kind,
    mapgeo01WaterOverrideSamples: r.waterOverrideSamples,
    blockedCentrelineSamples: r.blockedCentrelineSamples,
    category, owner, status, reason,
    wmp03WaterRoadCells: cells.length,
    wmp03SurfaceKinds: kinds,
    ferry: isFerry,
    mixedBridgeAndFordCells: hasBridge && hasFord,
    note: isFerry ? 'NOT_A_DRY_LAND_ROAD' : 'NO_NEW_GEOMETRY__NO_RECOLOUR__NO_WIDTH_CHANGE'
  });
}
const counts = rows.reduce((a, r) => { a[r.category] = (a[r.category] || 0) + 1; return a; }, {});
if (rows.length !== 31) throw Error('MAPGEO02_WET_ROAD_COUNT ' + rows.length);
if (Object.values(counts).reduce((a, b) => a + b, 0) !== 31) throw Error('MAPGEO02_CLASSIFICATION_INCOMPLETE');
const ferryRows = rows.filter(r => r.category === 'FERRY_NAVIGATION_REFERENCE');
if (ferryRows.length !== 8) throw Error('MAPGEO02_FERRY_ROUTE_COUNT ' + ferryRows.length);
for (const r of ferryRows)
  if (r.status !== 'SOURCE_AUTHORED_GEOMETRY__NOT_A_LAND_ROAD') throw Error('MAPGEO02_FERRY_LEAK ' + r.id);

const out = {
  schema: 'soh.mapgeo02.road-water-classification.v1',
  task: 'SOH — MAP-GEO-REJOIN-02 / C',
  method: 'MAP-GEO-01 measured water overrides reclassified with GOLD kind=ferry + WMP-03 water_traversal.v3 + crossingCandidate.u8; NO geometry was changed',
  sources: {
    mapgeo01Audit: { path: 'creator-u05/evidence/mapgeo01-physical-audit.json', sha256: sha(auditBytes) },
    gold: { path: 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json', sha256: sha(goldBytes) },
    waterTraversalV3: { path: 'veyra-world-master/v3/layers/water_traversal.v3.json', sha256: sha(wtBytes) },
    crossingCandidate: { path: 'veyra-world-master/data/rasters/geo01/crossingCandidate.u8', sha256: sha(crossBytes) }
  },
  wmp03Evidence: {
    ferryRoutes: wt.ferryRoutes.length,
    ferryCellCount: wt.corrected.ferryCellCount,
    bridgeDeckProposals: wt.bridgeDeckProposals.length,
    bridgeProposalIds: [...bridgeDeckIds],
    bridgeCellIndices: [...bridgeCellIndices],
    fordProposals: wt.fordProposals.length,
    fordRoadIds: [...fordRoadIds],
    fordCellIndices: [...fordCellIndices],
    crossingCandidateCode3Cells: crossingCode3Cells.length,
    waterRoadCellClassifications: wt.waterRoadCellClassifications.length,
    approvedTraversal: wt.approvedTraversal
  },
  counts,
  total: rows.length,
  ferryRouteIds: ferryRows.map(r => r.id),
  unresolvedIds: rows.filter(r => r.category === 'AMBIGUOUS_OWNER_REVIEW').map(r => r.id),
  rows,
  beacons: {
    rule: 'Creator-approved Beacon road was NOT widened, recoloured or redrawn; verified by an independent old/new tile-code comparison in the QA runtime.'
  },
  noClaims: [
    'NO dry-land ferry road', 'NO invented bridge', 'NO road width or palette change',
    'NO GOLD amendment', 'NO Gameplay traversal permission', 'NO VEYRA_PLAYABLE'
  ]
};
const dest = path.join(REPO, 'creator-u05/evidence/mapgeo02-road-water-classification.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log('MAPGEO02_CLASSIFY_OK total=31 counts=' + JSON.stringify(counts) +
  ' ferries=' + ferryRows.length + ' unresolved=' + out.unresolvedIds.join(','));
