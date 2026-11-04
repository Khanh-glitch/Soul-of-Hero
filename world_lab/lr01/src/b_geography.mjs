#!/usr/bin/env node
// MAP-LR01 Milestone B — whole-Veyra deterministic geography compiler/export.
// Produces ONE versioned geography package + per-region exports + feature-status
// registry covering all 579 canonical objects + source-linked proposed changes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVeyra, loadGeoInputs, writeJson, r4, BASELINE, ROOT } from './lib/veyra.mjs';
import { compileGeography, STATUS, sourceRef } from './lib/geo_compile.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.LR01_OUT ? path.resolve(process.env.LR01_OUT) : path.resolve(HERE, '../output');
const REG = path.join(OUT, 'regions');
fs.mkdirSync(REG, { recursive: true });

const V = loadVeyra();
const GEO = loadGeoInputs();
const C = compileGeography(V, GEO);
const P = V.P;
const audit = GEO.audit;

// ---------- explicit status registry over EVERY canonical object ----------
const collections = [
  ['land', P.land], ['lakes', P.lakes], ['rivers', P.rivers], ['roads', P.roads],
  ['bridges', P.bridges], ['docks', P.docks], ['pois', P.pois], ['zones', P.zones],
  ['resources', P.resources], ['spawns', P.spawns], ['elders', P.elders], ['labels', P.labels],
];
const featureStatus = [];
for (const [name, arr] of collections) for (const o of arr) {
  const status = [STATUS.SOURCE];
  const derived = [];
  if (name === 'land') { status.push(STATUS.DERIVED, STATUS.VALIDATED); derived.push('world_lab/lr01/output/geography.v1.json landmasses'); }
  if (name === 'rivers') { status.push(STATUS.DERIVED, STATUS.UNRESOLVED); derived.push('watershed graph, width unit UNRESOLVED'); }
  if (name === 'roads') { status.push(STATUS.DERIVED, STATUS.UNRESOLVED); derived.push('transport audit at SNAP_TOL=7 in Milestone C; physical width UNRESOLVED'); }
  if (name === 'bridges') { status.push(STATUS.UNRESOLVED, STATUS.PROPOSED); derived.push('display glyph is NOT a physical deck; PROPOSED deck geometry'); }
  if (name === 'docks') { status.push(STATUS.UNRESOLVED); derived.push('berth geometry UNRESOLVED'); }
  if (name === 'pois') { status.push(STATUS.DERIVED, STATUS.PROPOSED); derived.push('poi_geometry.v1.json + PROPOSED interiors in Milestone D'); }
  if (name === 'zones') { status.push(STATUS.DERIVED, STATUS.PROPOSED); derived.push('build suitability / loading space / chokepoints'); }
  if (name === 'resources') { status.push(STATUS.SOURCE); derived.push('habitat marker only — NO stock/loot/instance'); }
  if (name === 'elders') { status.push(STATUS.DERIVED); derived.push('outer/core/arena/approach geometry + separation'); }
  if (name === 'spawns') { status.push(STATUS.DERIVED); derived.push('geometric accessibility'); }
  featureStatus.push({
    id: o.id, collection: name, name: o.name ?? o.text ?? null,
    status, sourceRef: sourceRef(name, o.id), conf: o.conf ?? null,
    derivedRefs: derived,
    ownership: name === 'resources'
      ? 'MAP owns habitat marker geometry; Gameplay owns resource instances, stock, loot, locks, respawn'
      : 'MAP owns static physical geometry; Gameplay owns dynamic state',
  });
}
featureStatus.sort((a, b) => a.collection.localeCompare(b.collection) || a.id.localeCompare(b.id));

// ---------- source-linked genuine contradictions / proposed changes ----------
const zero = audit.audit.zeroClearance.zeroClearanceCells[0];
const brA = audit.audit.bridgeCrossings.allCrossings.find(x => x.bridgeId === 'br_a');
const kilns = audit.audit.poiAccess;
const proposedChanges = [
  {
    id: 'PC-B-01', featureIds: ['rd_all'], sourceRef: 'world_lab/geo02/source_excerpt/graph.ts :: SNAP_TOL=7',
    expected: 'Transport graph junction tolerance equals the verified Editor tolerance 7 au.',
    actual: 'GEO-01 used joinToleranceAu=8; at 8 the 8 au resample self-merges consecutive nodes and deletes road edges (773 self-merges); four endpoint joins exist only at 8.',
    proposal: 'Re-derive the whole 92-road graph at SNAP_TOL=7 on Catmull-Rom smoothed curves; do not preserve tolerance-8 joins. Implemented in Milestone C.',
    status: STATUS.PROPOSED, owner: 'MAP', blocks: 'any cart/foot continuity claim',
  },
  {
    id: 'PC-B-02', featureIds: [brA?.bridgeId ?? 'br_a', brA?.roadId ?? 'rd_20', brA?.riverId ?? 'rv_silver'],
    sourceRef: `world_lab/geo02/output/corridor_audit.v1.json :: bridgeCrossings.allCrossings bridgeId=br_a`,
    expected: 'A river crossing on a transport route has a physical deck span, width and swept clearance.',
    actual: `br_a is load=foot at ${brA?.bridgeDistanceAu}au from the crossing; bridge glyph 13×7.2au is Editor display geometry; cartBlocked=true; no physical deck dimensions are authored.`,
    proposal: 'Author a PROPOSED physical deck polygon + clearance envelope at the crossing; keep load classification source-authored. No cart-passable claim.',
    status: STATUS.PROPOSED, owner: 'MAP', blocks: 'cart route continuity at rv_silver',
  },
  {
    id: 'PC-B-03', featureIds: ['po_kilns', kilns.nearestCartRoad.roadId, kilns.nearestFootRoad.roadId],
    sourceRef: 'world_lab/geo02/output/corridor_audit.v1.json :: poiAccess',
    expected: `A POI with cart logistics is within Editor ACCESS_R=48au of a cart road.`,
    actual: `nearest cart road ${kilns.nearestCartRoad.roadId} is ${kilns.nearestCartRoad.d}au away; nearest foot/trail ${kilns.nearestFootRoad.roadId} is ${kilns.nearestFootRoad.d}au.`,
    proposal: 'PROPOSED Map-authored cart connector centreline + surface + physical width, OR retain po_kilns as foot-access-only. Both are alternatives; macro geography unchanged.',
    status: STATUS.PROPOSED, owner: 'MAP', blocks: 'cart route to po_kilns',
  },
  {
    id: 'PC-B-04', featureIds: ['br_4', 'rd_b', 'rv_grey_low'],
    sourceRef: 'world_lab/geo02/output/corridor_audit.v1.json :: zeroClearance',
    expected: 'A bridge approach has a measurable swept-clearance envelope.',
    actual: `Zero clearance at cell ${zero.cell} / authoring ${JSON.stringify(zero.authoringAu)}; road width, river channel width, bridge deck span and cart footprint are all UNDEFINED.`,
    proposal: 'Author PROPOSED deck span, deck width and road/river physical widths; then validate swept clearance. Until then clearance stays UNKNOWN.',
    status: STATUS.PROPOSED, owner: 'MAP', blocks: 'any cart-passable RT-1 claim',
  },
  {
    id: 'PC-B-05', featureIds: P.roads.filter(x => x.kind === 'ferry').map(x => x.id),
    sourceRef: 'project.roads[] where kind=ferry',
    expected: 'A ferry road has an approved Gameplay boat/ferry rule and a physical loading geometry.',
    actual: '8 authored kind=ferry roads exist; PR44 HEAD has NO ferry/boat rule, and docks have no berth geometry.',
    proposal: 'Record ferry centrelines as SOURCE_AUTHORED transport geometry with traversal status BLOCKED until Gameplay supplies the rule; Map supplies dock approach/loading space only.',
    status: STATUS.BLOCKED, owner: 'GAMEPLAY', blocks: 'water-crossing connectivity in runtime',
  },
  {
    id: 'PC-B-06', featureIds: ['rv_grey_low'],
    sourceRef: sourceRef('rivers', 'rv_grey_low'),
    expected: 'A river has a resolved downstream outlet.',
    actual: 'mouth.kind="none"; three distributaries (rv_d1/d2/d3) reference rv_grey_low as their source.',
    proposal: 'Retain the authored reference as-is; mark outlet UNRESOLVED rather than inventing a sea mouth. No macro-geography rewrite.',
    status: STATUS.UNRESOLVED, owner: 'MAP', blocks: 'complete watershed closure',
  },
  {
    id: 'PC-B-07', featureIds: P.rivers.map(x => x.id),
    sourceRef: 'project.rivers[].width',
    expected: 'River width is a physical channel dimension.',
    actual: 'width is an authored number (2.5–7) with NO unit; GEO-01 rasterizes a centreline only, not a channel.',
    proposal: 'Keep width as SOURCE_AUTHORED number; physicalChannelWidthAu = null / UNRESOLVED until a creator-approved unit and transform exist.',
    status: STATUS.UNRESOLVED, owner: 'MAP', blocks: 'bridge span fit, swept clearance',
  },
  {
    id: 'PC-B-08', featureIds: P.bridges.map(x => x.id),
    sourceRef: 'world_lab/geo02/output/maplab_encoding.v1.json :: widthSemantics.roads.bridgeDisplayGlyphAu',
    expected: 'Bridge geometry describes a physical deck.',
    actual: 'Canonical bridges are point+angle+load; the 13×7.2 au glyph is an Editor display primitive.',
    proposal: 'Author PROPOSED deck polygons per bridge from the crossing geometry; never treat the glyph as a collision dimension.',
    status: STATUS.PROPOSED, owner: 'MAP', blocks: 'bridge deck / clearance evidence',
  },
];

const unresolved = [
  { id: 'UN-B-01', subject: 'authoring-unit -> runtime-tile transform', status: STATUS.UNDECIDED, owner: 'CREATOR/GAMEPLAY_INTEGRATION', note: 'Milestone A bounded band [1,2.5] is diagnostic only. Full 2000×1400 frame retained.' },
  { id: 'UN-B-02', subject: '12-code biome -> 14-string Gameplay Biome mapping', status: STATUS.UNRESOLVED, owner: 'GAMEPLAY', note: 'GEO-02 legend is verified Editor source; Gameplay mapping not approved.' },
  { id: 'UN-B-03', subject: 'climate moisture / temperature / hazard intensity', status: STATUS.UNRESOLVED, owner: 'GAMEPLAY', note: 'Veyra source has no such arrays; supplying values would be fabrication.' },
  { id: 'UN-B-04', subject: 'physical widths, swept clearance, cart footprint', status: STATUS.UNRESOLVED, owner: 'MAP+ GAMEPLAY', note: 'Map authors geometry; Gameplay owns passability rules.' },
  { id: 'UN-B-05', subject: 'Elder arena combat behaviour and environmental effects', status: STATUS.UNRESOLVED, owner: 'GAMEPLAY', note: 'Map supplies territory/approach/arena geometry only.' },
];

// ---------- master package ----------
const pkg = {
  schema: 'soh.map.lr01.geography.v1',
  version: 1,
  status: 'MILESTONE_B__WHOLE_WORLD_GEOGRAPHY_COMPILED__SOURCE_AUTHORED_IDS_PRESERVED',
  authority: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
  stage: 'STAGE_1_MAP_GEOGRAPHY',
  generatedBy: 'world_lab/lr01/src/b_geography.mjs + src/lib/geo_compile.mjs',
  source: {
    canon: V.fingerprint, geo01Geography: GEO.fingerprints.geography, geo01Corridor: GEO.fingerprints.corridor,
    geo01RasterManifest: GEO.fingerprints.rasterManifest, geo02Encoding: GEO.fingerprints.encoding,
    geo02Audit: GEO.fingerprints.audit, geo02MaplabRasters: GEO.fingerprints.maplabRasterManifest,
    gameplayAck: 'PR44 issue comment 6608030530 @ 0b2ba508',
    scale01a: `${BASELINE.mapBranch} @ ${BASELINE.startHead}`,
  },
  frame: {
    authoring: { w: 2000, h: 1400, unit: 'authoring_unit', source: 'project.world' },
    sourceGrid: { gw: 250, gh: 175, cell: 8, cells: 43750, order: 'row_major i=gy*250+gx' },
    transform: { status: 'UNDECIDED', mode: 'NONE_APPLIED', fullFrameRetained: true, note: '250×175 raster supplies geography but NOT final detail. No rescale/crop/warp. Explicit transform metadata only.' },
    runtimeReference: { status: 'TEMPORARY_ENGINE_CONSTANTS_NOT_DESIGN_LAWS', WW: 200, WH: 200, TILE: 16, source: 'PR44 d80ad1b5 web/src/game/core.ts; Gameplay ACK 6608030530' },
  },
  statusVocabulary: Object.values(STATUS).concat(['UNDECIDED']),
  counts: {
    land: P.land.length, lakes: P.lakes.length, rivers: P.rivers.length, roads: P.roads.length,
    bridges: P.bridges.length, docks: P.docks.length, pois: P.pois.length, zones: P.zones.length,
    resources: P.resources.length, spawns: P.spawns.length, elders: P.elders.length, labels: P.labels.length,
    totalCanonicalObjects: featureStatus.length,
    rasterLayersUsed: C.layerNames.length,
  },
  layersUsed: C.layerNames,
  landmasses: C.landmasses,
  coastline: C.coastline,
  hydrography: { lakes: C.lakes, rivers: C.rivers, watershed: C.watershed },
  terrain: C.terrain,
  transport: { roads: C.roads, bridges: C.bridges, docks: C.docks, roadClassById: C.roadClassById, status: 'SOURCE_AUTHORED_CLASSIFICATION__PHYSICAL_WIDTHS_UNRESOLVED' },
  construction: { zones: C.zones, chokeClusters: C.connectivity.chokeClusters, status: 'DERIVED_SUITABILITY_PLUS_PROPOSED_LOADING_SPACE' },
  spawns: C.spawns,
  habitatMarkers: C.habitats,
  elders: C.elders,
  elderSeparation: C.elderSeparation,
  connectivity: C.connectivity,
  practicalCorridors: C.corridors,
  proposedChanges, unresolved,
  noClaims: [
    'NO macro-geography rewrite', 'NO canonical Veyra edit', 'NO approved runtime scale',
    'NO fabricated climate/moisture/temperature/hazard values', 'NO runtime resource instances, stock, loot, locks or economy',
    'NO cart-passable claim without physical clearance evidence', 'NO playable survival acceptance',
    'NO 200×200 / 1M-cell / chunk-stride design law',
  ],
};
writeJson(path.join(OUT, 'geography.v1.json'), pkg);
writeJson(path.join(OUT, 'feature_status.v1.json'), {
  schema: 'soh.map.lr01.feature_status.v1', sourceSha256: V.fingerprint.sha256,
  vocabulary: pkg.statusVocabulary, count: featureStatus.length, features: featureStatus,
});

// ---------- per-region reproducible exports ----------
for (const l of C.landmasses) writeJson(path.join(REG, `land_${l.id}.v1.json`), { schema: 'soh.map.lr01.region.v1', kind: 'landmass', ...l });
for (const e of C.elders) writeJson(path.join(REG, `elder_${e.id}.v1.json`), { schema: 'soh.map.lr01.region.v1', kind: 'elder', separation: C.elderSeparation.filter(s => s.a === e.id || s.b === e.id), ...e });
for (const z of C.zones) writeJson(path.join(REG, `zone_${z.id}.v1.json`), { schema: 'soh.map.lr01.region.v1', kind: 'construction_zone', ...z });
for (const s of C.spawns) writeJson(path.join(REG, `spawn_${s.id}.v1.json`), { schema: 'soh.map.lr01.region.v1', kind: 'spawn', corridor: C.corridors[s.id], ...s });

const zoneBuildable = C.zones.reduce((s, z) => s + z.buildSuitability.buildableCells, 0);
const loadCells = C.zones.reduce((s, z) => s + z.loadingSpace.cells, 0);
console.log(`B_GEOGRAPHY_OK objects=${featureStatus.length} lands=${C.landmasses.length} rivers=${C.rivers.length} roads=${C.roads.length} zones=${C.zones.length} buildableCells=${zoneBuildable} loadingCells=${loadCells}`);
console.log(`  walkableComponents=${C.connectivity.walkable.componentCount} cargoComponents=${C.connectivity.cargo.componentCount} chokeClusters=${C.connectivity.chokeClusters.count} elderPairs=${C.elderSeparation.length}`);
console.log(`  coastCells=${C.coastline.totalCoastCells} islands=${C.coastline.islands.length} watershedComponents=${C.watershed.components.length} danglingRefs=${C.watershed.danglingReferenceCount} outletGaps=${C.watershed.authoredOutletGaps.length}`);
for (const s of C.spawns) console.log(`  ${s.id}: land=${s.landId} walk=${s.walkableAtSpawn} comp=${s.walkableComponent} zonesReachable=${C.corridors[s.id].zonesReachable}/${C.corridors[s.id].zonesTotal} nearestCart=${s.nearestCartRoad?.id}:${s.nearestCartRoad?.d}au`);
