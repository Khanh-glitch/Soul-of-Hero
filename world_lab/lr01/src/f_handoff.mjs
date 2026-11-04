#!/usr/bin/env node
// MAP-LR01 Milestone F — versioned GEOGRAPHY-ONLY handoff package.
// STAGE 1 MAP GEOGRAPHY vs STAGE 2 GAMEPLAY POPULATION/SIMULATION stay distinct.
// No runtime resources, loot, money, generators, locks, weather, door states or
// economy population is fabricated to satisfy PR44's mixed GeographicHandoff.
// Deterministic: no live git HEAD, no network, no timestamps in the digest.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVeyra, loadGeoInputs, readJson, writeJson, sha256, r4, BASELINE, ROOT } from './lib/veyra.mjs';
import { STATUS } from './lib/geo_compile.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.LR01_OUT ? path.resolve(process.env.LR01_OUT) : path.resolve(HERE, '../output');
const V = loadVeyra();
const GEO = loadGeoInputs();

const GP44_LIVE_HEAD = 'f8010ec973095c88f3c462a68116c169b61237a3';
const GP44_ACK = '6608030530';
const GP44_BENCH = '6606283007';
const GP44_K6_HANDOFF = '6619055192';
const GP44_K6_DEEP_ACCEPT = '6619188131';
const MAP_HANDOFF_COMMENT = '6619191264';
const MAP_HANDOFF_COMMENT_UTC = '2026-11-04T00:33:40Z';
const COORDINATION_UTC = '2026-11-04T00:25:11Z'; // PR44 HEAD read checkpoint; package provenance pin (do not change after publication)

const digestFile = rel => {
  const f = path.join(OUT, '..', rel);
  if (!fs.existsSync(f)) return { file: rel, present: false };
  const b = fs.readFileSync(f);
  return { file: rel, present: true, bytes: b.length, sha256: sha256(b) };
};

const BG = readJson(path.join(OUT, 'geography.v1.json'));
const FS = readJson(path.join(OUT, 'feature_status.v1.json'));
const TR = readJson(path.join(OUT, 'transport.v1.json'));
const DL = readJson(path.join(OUT, 'poi_layouts.v1.json'));
const AM = readJson(path.join(OUT, 'art_manifest.v1.json'));
const VI = readJson(path.join(OUT, 'views_index.v1.json'));
const A = readJson(path.join(OUT, 'scale_corrected.v1.json'));
const RG = readJson(path.join(OUT, 'route_graph.v1.json'));
const BS = readJson(path.join(OUT, 'build_sites.v1.json'));

const PAYLOADS = [
  'output/scale_corrected.v1.json', 'output/poi_geometry.v1.json',
  'output/geography.v1.json', 'output/feature_status.v1.json',
  'output/transport.v1.json', 'output/route_graph.v1.json',
  'output/build_sites.v1.json', 'output/transport_failures.v1.json',
  'output/poi_layouts.v1.json', 'output/poi_summary.v1.json',
  'output/art_manifest.v1.json', 'output/views_index.v1.json',
];
const payloads = PAYLOADS.map(digestFile);
const regionFiles = fs.readdirSync(path.join(OUT, 'regions')).filter(f => f.endsWith('.v1.json')).sort().map(f => digestFile(`output/regions/${f}`));
const exampleFiles = fs.readdirSync(path.join(OUT, 'poi_examples')).filter(f => f.endsWith('.v1.json')).sort().map(f => digestFile(`output/poi_examples/${f}`));
const viewFiles = fs.readdirSync(path.join(OUT, 'views')).filter(f => f.endsWith('_640x360.png')).sort().map(f => digestFile(`output/views/${f}`));

// ---- compact self-contained raster masks (row-major RLE, no new data invented) ----
const rle = arr => {
  const runs = [];
  let start = 0, val = arr[0];
  for (let i = 1; i <= arr.length; i++) {
    if (i === arr.length || arr[i] !== val) { runs.push([val, i - start]); if (i < arr.length) { start = i; val = arr[i]; } }
  }
  return runs;
};
const landWater = Uint8Array.from({ length: 43750 }, (_, i) => GEO.r1.waterClass.data[i] ? (GEO.r1.waterClass.data[i] === 1 ? 1 : 2) : 0);
const biome = GEO.r1.biomeCode.data;
const roadClass = GEO.r1.roadClass.data;
const elevation = GEO.r1.elevation.data;

const rasterLayers = GEO.rasterManifest.layers.map(l => ({
  name: l.name, file: `world_lab/geo01/output/${l.file}`, sha256: l.sha256, bytes: l.bytes ?? null,
  dtype: 'u8', grid: { gw: 250, gh: 175, cellAu: 8, order: 'row_major i=gy*250+gx' },
  semantics: l.semantics ?? l.description ?? 'see world_lab/geo01 output manifest',
}));

// ---- feature index with stable IDs / status / source refs (no Gameplay fields) ----
const featureIndex = FS.features.map(f => ({
  id: f.id, collection: f.collection, name: f.name ?? null,
  sourceRef: f.sourceRef, status: f.status, ownership: f.ownership ?? null,
  geometryPayload: {
    land: 'output/geography.v1.json :: landmasses[]',
    lakes: 'output/geography.v1.json :: hydrography.lakes[]',
    rivers: 'output/geography.v1.json :: hydrography.rivers[]',
    roads: 'output/geography.v1.json :: transport.roads[]',
    bridges: 'output/transport.v1.json :: bridges[]',
    docks: 'output/geography.v1.json :: transport.docks[]',
    pois: 'output/poi_layouts.v1.json :: layouts[]',
    zones: 'output/build_sites.v1.json :: sites[]',
    resources: 'output/geography.v1.json :: habitatMarkers (WHERE only)',
    spawns: 'output/geography.v1.json :: spawns[]',
    elders: 'output/geography.v1.json :: elders[]',
    labels: 'project.labels[] (source-authored, no runtime field authored here)',
  }[f.collection] ?? 'project (see sourceRef)',
}));

const unknowns = [
  { id: 'UN-F-01', subject: 'authoring-unit -> runtime-tile transform', unit: 'authoring_unit / runtime_tile', status: STATUS.UNDECIDED, owner: 'CREATOR/GAMEPLAY_INTEGRATION', evidence: 'Milestone A bounded diagnostic band U∈[1,2.5]; transformStatus UNDECIDED.' },
  { id: 'UN-F-02', subject: 'physical road widths / swept clearance / cart footprint', unit: 'authoring_unit', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY', evidence: 'transport.roadPhysicalProposals[*].physicalWidthAu=null; sweptClearanceAu=null.' },
  { id: 'UN-F-03', subject: 'bridge deck span / channel fit', unit: 'authoring_unit', status: STATUS.UNRESOLVED, owner: 'MAP', evidence: 'transport.bridges[*].physicalDeckSpanAu=null; channelFitVerified=false.' },
  { id: 'UN-F-04', subject: 'river channel width unit', unit: 'UNKNOWN_UNIT', status: STATUS.UNRESOLVED, owner: 'MAP', evidence: 'project.rivers[].width has no unit.' },
  { id: 'UN-F-05', subject: 'vertical floor separation / stair geometry', unit: 'authoring_unit', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY', evidence: 'poi_layouts vertical portals have verticalSeparationAu=null.' },
  { id: 'UN-F-06', subject: 'dynamic door state, lock, power, destruction', unit: 'n/a', status: STATUS.UNKNOWN, owner: 'GAMEPLAY', evidence: 'All portals have doorStateOwner=GAMEPLAY, lockedState=UNKNOWN, powerRequirement=UNKNOWN.' },
  { id: 'UN-F-07', subject: 'runtime resource instances, source stock, loot, cash, vendors, weather', unit: 'n/a', status: 'GAMEPLAY_OWNED__NOT_IN_THIS_PACKAGE', owner: 'GAMEPLAY', evidence: 'habitatMarkers record WHERE source-authored habitat markers are; no instance/stock/loot/weather is produced.' },
  { id: 'UN-F-08', subject: 'ferry / boat traversal rule', unit: 'n/a', status: STATUS.BLOCKED, owner: 'GAMEPLAY', evidence: '8 authored ferry centrelines; PR44 HEAD has no boat rule; transport.ferries stay BLOCKED.' },
  { id: 'UN-F-09', subject: '12-code biome -> 14-string Gameplay Biome mapping', unit: 'code/string', status: STATUS.UNRESOLVED, owner: 'GAMEPLAY', evidence: 'GEO-02 legend verified for Editor; Gameplay mapping not approved.' },
  { id: 'UN-F-10', subject: 'creator visual approval / human 640x360 playtest', unit: 'n/a', status: 'NOT_PERFORMED', owner: 'CREATOR', evidence: 'views_index status STATIC_GEOGRAPHY_QA_VIEWS__NOT_PLAYABLE.' },
];

const proposed = [
  'All 81 POI interiors, walls, rooms, floors, portals, entrances, circulation, sockets and roofs (Milestone D).',
  '12 bridge deck polygons from measured raster chords + 92 road centreline buffers bounded by GEO-01 clearance (Milestone C).',
  '23 build sites / loading envelopes (Milestones B, C).',
  'po_kilns 3.696 au west entrance (GEO-02 PROPOSED, non-canonical).',
  'Bounded diagnostic scale band U∈[1,2.5]; U=2 NOT canonized.',
];

const fieldOwnership = {
  MAP: [
    'stable IDs and sourceRef for 579 canonical objects', '2000x1400 authoring frame + explicit transform metadata',
    'land / water / coastline / islands / beaches / wetlands / lakes / rivers / watershed',
    'elevation raw bytes, slope raw deltas, 12-code biome legend, biome transitions',
    'suitability / practical corridors / choke clusters / build-site + loading geometry',
    'road/trail/bridge/dock/ferry centreline geometry and source-authored classification',
    'route graph at SNAP_TOL=7, crossing audit, alternate centreline routes',
    'POI shells, static walls, rooms, floors, levels, entrances, static portals, circulation, sockets, roof coverage',
    'Elder outer/core/arenas/approach geometry and separation',
    'explicit UNKNOWN / PROPOSED / BLOCKED / UNRESOLVED / DERIVED / SOURCE_AUTHORED status',
  ],
  GAMEPLAY: [
    'procedural resource population, source stock, respawn, loot tables, money, vendors, economy simulation',
    'locks, keys, cards, power requirements, generators, machines, devices, recipes, quests',
    'dynamic door states, destruction, player construction, building rules, placement',
    'weather, environmental effects, exposure, AI, creature spawns, survival balance',
    'vehicle speeds, weights, load penalties, cart passability, swept clearance rules, ferry/boat rule',
    'persistence, save schema, runtime collision/reach/LOS rules, streaming and rendering',
    'RuntimeMapPackage compilation and runtime cell/tile binding',
  ],
  JOINT: ['agree the au->tile transform and transform mode', 'agree the geography-only intake seam', 'agree room/roof/portal adapter schema', 'agree bridge/road clearance evidence standard'],
};

const compatibility = {
  checkedAtGp44Head: GP44_LIVE_HEAD,
  sourceFiles: [
    'web/src/game/geography-contract.ts :: GeographicHandoff / validateGeographicHandoff',
    'web/src/game/map-package.ts :: RuntimeMapPackage / validateRuntimeMapPackage',
  ],
  finding: 'NOT_A_LEGAL_GEOGRAPHY_ONLY_VALIDATOR',
  details: [
    'GeographicHandoff requires economy:EconomyMap and calls validateEconomyMap, compileEconomy, diagnoseStarts — Gameplay economy population.',
    'GeographicHandoff requires nonbossCashSites, vendorSites, evacuationSites, PoiGeometry.powerNodes, hazardCells, exteriorLootSites, interiorLootSites, doors and retreatPaths — Gameplay-owned dynamic/economic fields.',
    'RoadGeometry requires widthTiles, surface and cargoPassable booleans; Map has NO approved physical width, swept clearance or cart-passability rule.',
    'RuntimeMapPackage requires exactly 200x200 tiles of 16 pixels, plus populated buildings, statics (loot/cash/vendor/door/gen), places and elders — a populated runtime package, not Stage 1 geography.',
    'PR44 K6 handoff (comment 6619055192) states verbatim: current mixed GeographicHandoff / populated RuntimeMapPackage are not the agreed geography-only contract.',
  ],
  mapDecision: 'Do NOT fabricate Gameplay-owned fields to pass validateGeographicHandoff. This package remains Stage 1 geography-only.',
  correctNextStep: 'Joint follow-up: Map exports pure stable-ID geography; Gameplay validates/populates it and compiles a RuntimeMapPackage after the creator approves the transform.',
  fieldOwnership,
};

const blockers = [
  { id: 'BL-F-01', featureIds: ['au_to_tile_transform'], unit: 'authoring_unit / runtime_tile', coordinate: null, sourceFile: 'world_lab/lr01/output/scale_corrected.v1.json', sha: payloads.find(p => p.file.endsWith('scale_corrected.v1.json'))?.sha256?.slice(0, 16) ?? null, expected: 'An approved transform and mode for the full 2000x1400 frame.', actual: 'transformStatus UNDECIDED; bounded diagnostic band U∈[1,2.5] only.', owner: 'CREATOR/GAMEPLAY_INTEGRATION' },
  { id: 'BL-F-02', featureIds: ['br_4', 'br_a', 'rd_b', 'rv_grey_low'], unit: 'authoring_unit', coordinate: [732, 652], sourceFile: 'world_lab/lr01/output/transport_failures.v1.json', sha: null, expected: 'Measured deck span, road width and swept clearance for a cart-passable route.', actual: 'physicalDeckSpanAu=null, physicalWidthAu=null, sweptClearanceAu=null; zero clearance at [732,652].', owner: 'MAP+GAMEPLAY' },
  { id: 'BL-F-03', featureIds: ['po_kilns', 'rd_n', 'rd_16'], unit: 'authoring_unit', coordinate: [905, 785], sourceFile: 'world_lab/geo02/output/corridor_audit.v1.json', sha: GEO.fingerprints.audit.sha256.slice(0, 16), expected: 'Cart road within Editor ACCESS_R=48au.', actual: 'nearest cart road rd_n at 56.8792au; nearest foot trail rd_16 at 0au.', owner: 'MAP' },
  { id: 'BL-F-04', featureIds: ['ferry_roads'], unit: 'authoring_unit', coordinate: null, sourceFile: 'PR44 issue comment 6606283007', sha: null, expected: 'Approved Gameplay boat/ferry traversal rule.', actual: '8 authored ferry centrelines; no boat rule in PR44 HEAD.', owner: 'GAMEPLAY' },
  { id: 'BL-F-05', featureIds: ['GeographicHandoff', 'RuntimeMapPackage'], unit: 'schema', coordinate: null, sourceFile: `PR44 ${GP44_LIVE_HEAD}: web/src/game/geography-contract.ts; web/src/game/map-package.ts`, sha: GP44_LIVE_HEAD.slice(0, 16), expected: 'A pure geography-only intake seam accepting stable-ID Stage 1 data.', actual: 'Mixed validator requires economy/loot/cash/vendor/power/doors and a populated 200x200 runtime package.', owner: 'GAMEPLAY+MAP' },
  { id: 'BL-F-06', featureIds: ['branch_permissions'], unit: 'n/a', coordinate: null, sourceFile: 'Gameplay ACK 6608030530', sha: null, expected: 'Authorized exact-SHA worktree / handoff patch for a real Web integration proof.', actual: 'No cross-branch write authorization; PR44 remains DRAFT/HOLD; cross-branch push intentionally NOT attempted.', owner: 'CREATOR' },
];

const adapterSpec = {
  name: 'SOH Map->Gameplay geography adapter (MINIMAL SPEC; NOT IMPLEMENTED)',
  input: 'soh.map.lr01.geography_package.v1',
  inputVerification: ['verify source canon SHA-256', 'verify revisionDigest over body', 'verify every payload SHA-256', 'verify schemaVersion/revision/payload count'],
  stageBoundary: 'Adapter consumes STAGE 1 geography. It MUST NOT invent STAGE 2 population/simulation fields, and MUST NOT call validateGeographicHandoff() as a geography validator.',
  transformRules: [
    'transform.status is UNDECIDED: do not assume U, do not reinterpret 8 authoring units as 16 runtime pixels, do not crop/warp/rescale the 2000x1400 frame.',
    'If a runtime tile grid is later approved, choose an explicit documented mode (FLOOR_DROPS_PARTIAL_EDGE_STRIP / CEIL_PADS_BEYOND_FRAME / NONUNIFORM_RESAMPLE_REQUIRED) and record fractional raster coverage.',
    'WW=WH=200, TILE=16, 1M-cell economy cap and cy*100+cx chunk stride are TEMPORARY engine constants, not Veyra design laws.',
  ],
  stableIds: ['canonical feature IDs', 'room.<poi>.<r>.<c>', 'wall.<poi>.<n>', 'entrance.<poi>.1', 'portal.<poi>.<...>', 'socket.<poi>.<n>', 'level.<poi>.<0|-1>', 'floor.<poi>.<...>', 'site.<zoneId>', 'graph nodes from SNAP_TOL=7'],
  staticVsDynamic: {
    MAP_STATIC: ['walls', 'rooms', 'floors', 'roof coverage', 'static portal openings', 'sockets (fit envelopes)', 'circulation geometry', 'terrain/raster', 'route topology', 'build/loading envelopes'],
    GAMEPLAY_DYNAMIC: ['door open/closed/locked/destroyed', 'power/device state', 'loot/cash/vendor instances', 'resource stock', 'weather', 'AI', 'player construction', 'runtime collision/reach/LOS rules', 'persistence'],
  },
  adapters: ['collision', 'enclosure', 'reach', 'lineOfSight', 'roofCoverage', 'portalPassability'],
  requiredGameplayProviders: ['approved transform + mode', 'biome 12-code -> runtime terrain mapping', 'physical width / swept clearance / cart footprint rules', 'ferry rule', 'dynamic door & device state', 'resource population and economy', 'RuntimeMapPackage compiler'],
  validationGates: ['source integrity / 579 IDs', 'coast-water / raster transform / regional coverage', 'physical widths & crossings & build-site / room / portal / retreat', 'field ownership / stable identity / persistence prerequisites / placement', 'GEO-01/GEO-02/SCALE regressions', 'native 640x360 visual inspection'],
  forbidden: ['fabricate loot/cash/vendor/generator/lock/weather', 'treat sockets as objects', 'treat bridge display glyph as collision', 'claim cart-passable without clearance', 'call static geography QA playable survival acceptance', 'mutate Gameplay production branches'],
};

const integrationGate = {
  status: 'OPEN__WEB_PLAYABILITY_NOT_PROVEN',
  realIntegrationProof: 'NOT_ATTEMPTED__NO_COMPATIBLE_GEOGRAPHY_ONLY_INTAKE_SEAM_AND_NO_CROSS_BRANCH_WRITE_AUTHORIZATION',
  reason: 'PR44 HEAD has no pure geography-only intake; GeographicHandoff/RuntimeMapPackage are mixed/populated validators. Cross-branch push to Gameplay was intentionally NOT attempted (Gameplay ACK 6608030530: each agent pushes only its own branch).',
  deliveredInstead: ['compiled geometry', 'verified explicit transform metadata (UNDECIDED, not applied)', 'minimal adapter spec', 'executable isolated tests', '18 inspected static 640x360 views'],
  preciseNextStep: 'Creator approves the au->tile transform; Gameplay implements a geography-only intake seam that verifies this package digest and stable IDs, then Gameplay populates/simulates and compiles RuntimeMapPackage. Only after that can an exact-SHA worktree integration proof be attempted.',
  noClaims: ['NO playable full-world integration', 'NO runtime merge', 'NO parallel fake survival game', 'NO fabricated Gameplay fields', 'NO acknowledgement of any MAP-LR01 handoff yet'],
};

const body = {
  packageId: 'veyra-geography-map-lr01',
  frame: BG.frame,
  statusVocabulary: BG.statusVocabulary,
  counts: { ...BG.counts, featureIndex: featureIndex.length, routeGraphNodes: RG.nodeCount, routeGraphFootEdges: RG.footEdges.length, routeGraphCartEdges: RG.cartEdges.length, buildSites: BS.count, poiLayouts: DL.layouts.length, poiStableIds: DL.counts.stableIds, regionExports: regionFiles.length, representativeExamples: exampleFiles.length, views: viewFiles.length },
  featureIndex,
  landmasses: BG.landmasses.map(l => ({ id: l.id, name: l.name, kind: l.kind, sourceRef: l.sourceRef, status: l.status, geometry: l.geometry, coastline: l.coastline, wetlands: l.wetlands, relief: l.relief, contains: l.contains, rasterCells: l.rasterCells })),
  coastline: BG.coastline,
  hydrography: BG.hydrography,
  terrain: BG.terrain,
  transport: {
    roads: BG.transport.roads, bridges: TR.bridges, docks: BG.transport.docks,
    roadClassById: BG.transport.roadClassById,
    routeGraph: { schema: RG.schema, tol: RG.tol, nodeCount: RG.nodeCount, footEdgeCount: RG.footEdges.length, cartEdgeCount: RG.cartEdges.length, components: RG.components, file: 'output/route_graph.v1.json' },
    crossings: TR.crossings, roadPhysicalProposals: TR.roadPhysicalProposals, ferries: TR.ferries,
    poiAccess: TR.poiAccess, alternateRoutes: TR.alternateRoutes,
    status: 'SOURCE_AUTHORED_CLASSIFICATION_PLUS_DERIVED_TOPOLOGY__PHYSICAL_WIDTHS_UNRESOLVED',
  },
  construction: { zones: BG.construction.zones, buildSites: BS.sites, chokeClusters: BG.construction.chokeClusters, status: 'DERIVED_GEOMETRY_PLUS_PROPOSED_ENVELOPES__GAMEPLAY_OWNS_PLACEMENT' },
  spawns: BG.spawns,
  practicalCorridors: BG.practicalCorridors,
  habitatMarkers: { ...BG.habitatMarkers, packageNote: 'WHERE source-authored habitat markers are; NO runtime instance, stock, loot or spawn rate.' },
  elders: BG.elders,
  elderSeparation: BG.elderSeparation,
  connectivity: BG.connectivity,
  poiLayouts: {
    schema: DL.schema, status: DL.status, ownership: DL.ownership, counts: DL.counts,
    archetypeCoverage: DL.archetypeCoverage, representativeExamples: DL.representativeExamples,
    adapterVocabulary: DL.adapterVocabulary,
    layoutsRef: 'output/poi_layouts.v1.json :: layouts[] (all 81 full static layouts, stable IDs, 6 geometry adapters)',
    note: 'Interiors are PROPOSED, never canonical. Sockets are fit envelopes with gameplayObject=null.',
  },
  rasterLayers,
  compactMasks: {
    landWaterRle: rle(landWater), biomeRle: rle(biome), roadClassRle: rle(roadClass), elevationRle: rle(elevation),
    encoding: 'row-major RLE over 43750 cells; each run = [value, count]; 0 land, 1 sea, 2 lake/river for landWater.',
    status: 'VERBATIM_DECODE_OF_GEO01_RASTERS__NO_NEW_DETAIL',
  },
  scaleEvidence: {
    schema: A.schema, status: A.status, boundedBand: A.boundedBand,
    boundedBandStatement: A.boundedBandStatement, focusBandU: A.focusBandU,
    transformStatus: 'UNDECIDED', note: 'U=2 is NOT canonized; 250x175 raster supplies geography, not final detail.',
  },
  art: {
    manifestRef: 'output/art_manifest.v1.json', viewsRef: 'output/views_index.v1.json',
    nativeResolution: VI.nativeResolution, viewCount: VI.viewCount,
    status: 'STATIC_GEOGRAPHY_QA_VIEWS__NO_CREATOR_VISUAL_APPROVAL',
  },
  unknowns,
  proposed,
  proposedChanges: [...BG.proposedChanges, ...TR.proposedChanges, ...DL.proposedChanges],
  noClaims: [
    'NO runtime resource instances / source stock / loot / money / vendors',
    'NO generators, locks, keys, power, recipes, quests, machines or devices',
    'NO weather, environmental effects, exposure, AI or survival simulation',
    'NO dynamic door state, destruction or player construction',
    'NO cart-passable claim without physical clearance evidence',
    'NO canonical Veyra rewrite or macro-geography rewrite',
    'NO approved runtime scale / transform / runtime merge',
    'NO playable survival acceptance or Web playability proof',
  ],
};

const revisionDigest = sha256(Buffer.from(JSON.stringify(body)));
const pkg = {
  schema: 'soh.map.lr01.geography_package.v1',
  schemaVersion: 1,
  revision: 1,
  packageId: body.packageId,
  revisionDigest,
  digestAlgorithm: 'SHA-256 over JSON.stringify(body) with stable insertion order',
  status: 'GEOGRAPHY_ONLY__STAGE_1__NO_GAMEPLAY_POPULATION',
  authority: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
  stage: 'STAGE_1_MAP_GEOGRAPHY',
  generatedBy: 'world_lab/lr01/src/f_handoff.mjs',
  provenance: {
    canon: V.fingerprint,
    geo01Geography: GEO.fingerprints.geography, geo01Corridor: GEO.fingerprints.corridor,
    geo01RasterManifest: GEO.fingerprints.rasterManifest,
    geo02Encoding: GEO.fingerprints.encoding, geo02Audit: GEO.fingerprints.audit,
    geo02ProposedKilns: GEO.fingerprints.proposed,
    scale01aBenchmark: 'world_lab/scale01a/output/benchmark.v1.json @ 9e0f0805',
    mapBranch: BASELINE.mapBranch, mapBranchStartHead: BASELINE.startHead,
    gp44Branch: BASELINE.gp44Branch, gp44LiveHeadAtCoordination: GP44_LIVE_HEAD,
    gp44AckComment: GP44_ACK, gp44BenchmarkComment: GP44_BENCH, gp44K6HandoffComment: GP44_K6_HANDOFF,
    coordinationUtc: COORDINATION_UTC,
    sourceIdsPreserved: true, canonicalFrameUnchanged: true,
  },
  body,
  fieldOwnership,
  compatibility,
  adapterSpec,
  integrationGate,
  blockers,
  payloads: { primary: payloads, regions: regionFiles, poiExamples: exampleFiles, views: viewFiles },
  isolatedTests: [
    { command: 'node src/test.mjs', expected: 'LR01_TESTS 90/90 (+ F gates)', status: 'EXECUTED_IN_REPRODUCE' },
    { command: './reproduce.sh', expected: 'MAP-LR01_REPRODUCE_OK incl GEO-01/GEO-02 regressions', status: 'EXECUTED' },
    { command: 'node src/a_scale.mjs', expected: 'A_SCALE_OK 81 POIs, 13 candidates, bounded band', status: 'EXECUTED' },
    { command: 'node src/b_geography.mjs', expected: 'B_GEOGRAPHY_OK 579 objects, 41 region exports', status: 'EXECUTED' },
    { command: 'node src/c_transport.mjs', expected: 'C_TRANSPORT_OK SNAP_TOL=7, 18 crossings, no cart claim', status: 'EXECUTED' },
    { command: 'node src/d_poi.mjs', expected: 'D_POI_OK 81 layouts, 1701 stable IDs, 0 duplicates', status: 'EXECUTED' },
    { command: 'node tools/render_world.mjs', expected: 'E_RENDER_OK 18 native 640x360 views', status: 'EXECUTED' },
  ],
};
writeJson(path.join(OUT, 'geography_package.v1.json'), pkg);

const handoff = {
  schema: 'soh.map.lr01.handoff.v1', version: 1,
  status: 'STAGE_1_MAP_GEOGRAPHY_HANDOFF__STAGE_2_GAMEPLAY_POPULATION_NOT_PERFORMED__WEB_PLAYABILITY_GATE_OPEN',
  authority: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
  package: { schema: pkg.schema, schemaVersion: pkg.schemaVersion, revision: pkg.revision, packageId: pkg.packageId, revisionDigest, file: 'output/geography_package.v1.json' },
  coordination: {
    checkedAtUtc: COORDINATION_UTC, mapBranch: BASELINE.mapBranch,
    gp44Head: GP44_LIVE_HEAD, gp44State: 'OPEN / DRAFT / HOLD',
    commentsRead: [GP44_ACK, GP44_BENCH, GP44_K6_HANDOFF, GP44_K6_DEEP_ACCEPT],
    commentInterface: {
      status: 'AUTHORIZED__POST_SUCCEEDED',
      handoffCommentId: MAP_HANDOFF_COMMENT,
      handoffCommentUtc: MAP_HANDOFF_COMMENT_UTC,
      handoffCommentUrl: `https://github.com/Khanh-glitch/Soul-of-Hero/pull/44#issuecomment-${MAP_HANDOFF_COMMENT}`,
      note: 'Concise factual exact-SHA geography handoff posted. A posted comment is NOT an acknowledgement.',
    },
    postHandoffCreatorComment: {
      id: GP44_K6_DEEP_ACCEPT, utc: '2026-11-04T00:33:29Z',
      decision: 'Gameplay K6 bounded long-run ACCEPTED as retained work; PR #44 DRAFT/HOLD; no merge.',
      mapRelevant: 'GEO-02/SCALE-01 and MAP-LR01 remain separate Map Tower responsibilities; GeographicHandoff still mixes geometry and gameplay; runtime 200x200; source Veyra 2000x1400 not mapped or compressed; "Do NOT announce playable Veyra"; no demand to rewrite Map aesthetics; do not require Map scale or rewrite Veyra to fix Gameplay-local issues.',
      isAcknowledgementOfMapHandoff: false,
      note: 'This is a Gameplay K6 decision, not a Map stop command and not a receipt of the Map geography handoff.',
    },
    acknowledgementOfMapLr01Handoff: 'NONE__HANDOFF_COMMENT_6619191264_POSTED_BUT_NO_CORRESPONDING_ACKNOWLEDGEMENT',
  },
  compatibility, fieldOwnership, adapterSpec, integrationGate,
  blockers, unknowns,
  milestones: {
    A: { status: 'COMPLETE', capability: 'corrected per-POI geometry/scale tool, 13 fractional candidates, bounded diagnostic band [1,2.5], U=2 NOT canonized' },
    B: { status: 'COMPLETE', capability: 'whole-Veyra deterministic geography compiler, 579 IDs, 41 region exports, all 8 landmasses/6 Elders/23 zones/4 spawns' },
    C: { status: 'COMPLETE', capability: 'SNAP_TOL=7 transport audit, 18 crossings, 23 build sites, 7 source-linked failures, NO cart-passable claim' },
    D: { status: 'COMPLETE', capability: '81 POI static layouts / 24 archetypes / 1701 stable IDs / 6 geometry adapters / 8 examples' },
    E: { status: 'COMPLETE', capability: '11 individually assessed assets, 18 inspected native 640x360 before/after/UI views, no visual approval claim' },
    F: { status: 'COMPLETE_AS_GEOGRAPHY_ONLY_PACKAGE', capability: 'versioned digest-verified Stage 1 package + adapter spec + compatibility report; Web integration proof BLOCKED' },
  },
  schemaCompatibility: {
    geographyOnly: true,
    satisfiesGeographicHandoff: false, satisfiesRuntimeMapPackage: false,
    reason: 'Those are mixed/populated Gameplay validators; satisfying them would require fabricating Gameplay-owned fields.',
    requiredFromGameplay: adapterSpec.requiredGameplayProviders,
  },
  outstandingCreatorDecisions: [
    'Approve (or reject) an authoring-unit -> runtime-tile transform and fractional transform mode.',
    'Approve a geography-only intake seam (not GeographicHandoff) and the minimal adapter spec.',
    'Approve physical road/bridge width + swept clearance evidence standard.',
    'Approve any art change; no creator visual approval has occurred.',
    'Authorize any exact-SHA cross-branch integration worktree / PR comment acknowledgement.',
  ],
  preciseNextIntegrationStep: integrationGate.preciseNextStep,
  noClaims: integrationGate.noClaims.concat(['NO world finished', 'NO visually approved', 'NO playable survival acceptance']),
};
writeJson(path.join(OUT, 'handoff.v1.json'), handoff);

const md = `# MAP → Gameplay · MAP-LR01 Stage 1 geography handoff (Map-owned file)

**Status:** geography-only package, NOT a playable world. PR #44 remains DRAFT / HOLD; no merge, command or cross-branch write is authorized.

| pin | value |
|---|---|
| Map branch | \`${BASELINE.mapBranch}\` (this file is committed on that branch) |
| Geography package | \`output/geography_package.v1.json\`, schema \`${pkg.schema}\`, revision ${pkg.revision} |
| Revision digest | \`${revisionDigest}\` (SHA-256 over \`body\`) |
| Canonical Veyra | \`${V.fingerprint.commit}\` · \`${V.fingerprint.sha256}\` |
| GEO-01 / GEO-02 | \`${GEO.fingerprints.geography.sha256.slice(0, 16)}…\` / \`${GEO.fingerprints.audit.sha256.slice(0, 16)}…\` |
| PR #44 HEAD read at checkpoint | \`${GP44_LIVE_HEAD}\` (\`${COORDINATION_UTC}\`) |
| Comments read | ${GP44_ACK} (architecture ACK), ${GP44_BENCH} (benchmark), ${GP44_K6_HANDOFF} (K6 handoff) |

**What Map supplies:** full 2000×1400 authoring frame (unchanged) with explicit
transform metadata (\`UNDECIDED\`); 579 stable source IDs and per-feature status;
8 landmasses / coastline / islands / beaches / wetlands / 5 lakes / 17 rivers /
watershed; elevation, slope, 12-code biome legend and transitions; 92 roads,
12 bridges, 27 docks, route graph at \`SNAP_TOL=7\`, 18 crossings, physical
road/deck/clearance PROPOSALS; 23 build sites + loading envelopes; 81 POI shells
with rooms, walls, floors, levels, entrances, portals, circulation, roof coverage
and spatial sockets (1701 stable IDs); 6 Elder territories/approaches/arenas and
15 separations; explicit UNKNOWN / PROPOSED / BLOCKED / UNRESOLVED states;
18 static 640×360 before/after/UI views and 11 individually assessed assets.

**What Gameplay owns and is NOT fabricated here:** resource population, source
stock, loot, cash, vendors, economy, locks/keys/power, generators, machines,
recipes, quests, weather, AI, dynamic door states, destruction, player
construction, vehicle/passability rules, persistence and \`RuntimeMapPackage\`
compilation.

**Compatibility:** PR #44 \`GeographicHandoff\` requires economy population,
cash/vendor/loot/power/door fields and calls \`compileEconomy\`; \`RuntimeMapPackage\`
requires a populated 200×200×16px runtime. Neither is the agreed geography-only
intake. The K6 handoff comment ${GP44_K6_HANDOFF} confirms this. Map does NOT
fabricate those fields. \`docs/ADAPTER_SPEC.md\` is the minimal later-adapter spec.

**Integration gate: OPEN.** No compatible geography-only intake seam and no
cross-branch write authorization; cross-branch push was intentionally NOT
attempted. Delivered instead: compiled geometry, verified transform metadata,
minimal adapter spec and executable isolated tests (\`./reproduce.sh\`).
**No acknowledgement of this MAP-LR01 handoff exists yet** — do not assume
receipt.

**Precise next step:** ${integrationGate.preciseNextStep}

No cart-passable claim without clearance evidence; no approved scale (U=2 is
diagnostic only); no canonical rewrite; no visual approval; no playable
survival acceptance.
`;
fs.writeFileSync(path.join(OUT, 'pr44_handoff.md'), md);

console.log(`F_HANDOFF_OK package=${pkg.schema} rev=${pkg.revision} digest=${revisionDigest.slice(0, 16)}… payloads=${payloads.length} regions=${regionFiles.length} examples=${exampleFiles.length} views=${viewFiles.length} blockers=${blockers.length}`);
console.log(`  gate=${integrationGate.status} compat=${compatibility.finding} seam=${integrationGate.realIntegrationProof.slice(0, 40)}…`);
