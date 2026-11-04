#!/usr/bin/env node
// MAP-LR01 Milestone D — systematic 81-POI / 24-archetype spatial authoring.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVeyra, loadGeoInputs, writeJson, readJson, r4 } from './lib/veyra.mjs';
import { toCell, STATUS as GSTATUS } from './lib/geo_compile.mjs';
import { authorPoi, ARCHETYPE_TEMPLATES, STATUS } from './lib/poi_layout.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.LR01_OUT ? path.resolve(process.env.LR01_OUT) : path.resolve(HERE, '../output');
const EX = path.join(OUT, 'poi_examples');
fs.mkdirSync(EX, { recursive: true });

const V = loadVeyra(), P = V.P;
const GEO = loadGeoInputs();
const PG = readJson(path.join(OUT, 'poi_geometry.v1.json'));
const I = {};
for (const [k, v] of Object.entries(GEO.r1)) I[k] = v.data;

const footRings = {}, deepRings = {}, retreats = {};
for (const p of P.pois) {
  footRings[p.id] = p.foot;
  if (Array.isArray(p.deep) && p.deep.length >= 3) deepRings[p.id] = p.deep;
  if (Array.isArray(p.retreat) && p.retreat.length) retreats[p.id] = p.retreat;
}
const ctx = { P, I, toCell, footRings, deepRings, retreats };

const layouts = PG.pois.map(g => authorPoi(g, ctx));

// ---- stable-ID integrity ----
const idKinds = ['rooms', 'walls', 'entrances', 'portals', 'sockets', 'levels', 'floors'];
const allIds = [];
for (const l of layouts) for (const k of idKinds) for (const id of l.stableIds[k]) allIds.push({ id, poiId: l.poiId, kind: k });
const dup = allIds.filter((x, i) => allIds.findIndex(y => y.id === x.id) !== i);
if (dup.length) throw new Error(`duplicate stable IDs: ${dup.slice(0, 5).map(d => d.id).join(', ')}`);

const summary = layouts.map(l => ({
  poiId: l.poiId, arche: l.arche, enclosureClass: l.enclosureClass,
  template: l.template.pattern, rows: l.template.instantiatedRows, cols: l.template.instantiatedCols,
  levels: l.levels.length, rooms: l.rooms.length, walls: l.walls.length,
  portals: l.portals.length, entrances: 1, sockets: l.sockets.length,
  roofFraction: l.roofCoverage.fractionOfFoot, enclosureFraction: l.geometryAdapters.enclosure.enclosureFraction,
  interiorDepthAu: l.circulation.interiorDepthAu, maxCirculationDepth: l.circulation.maxDepth,
  retreatStatus: l.retreat.status, entranceOpeningAu: l.entrance.openingAu,
  context: { landId: l.context.landId, zoneId: l.context.zoneId, biomeCode: l.context.biomeCode, nearestRoadKind: l.context.nearestRoad?.kind ?? null },
}));
const byArche = {};
for (const s of summary) {
  byArche[s.arche] = byArche[s.arche] || { count: 0, patterns: new Set(), levels: 0, rooms: 0, sockets: 0, roofFractionSum: 0 };
  const b = byArche[s.arche]; b.count++; b.patterns.add(s.template); b.levels += s.levels; b.rooms += s.rooms; b.sockets += s.sockets; b.roofFractionSum += s.roofFraction;
}
const archetypeCoverage = Object.entries(byArche).sort((a, b) => a[0].localeCompare(b[0])).map(([arche, b]) => ({
  arche, poiCount: b.count, patterns: [...b.patterns], template: ARCHETYPE_TEMPLATES[arche],
  totalLevels: b.levels, totalRooms: b.rooms, totalSockets: b.sockets, meanRoofFraction: r4(b.roofFractionSum / b.count),
}));

// ---- representative examples (distinct archetypes, distinct contexts) ----
const REPRESENTATIVE_ARCHES = ['smelter', 'research', 'quarry', 'port', 'ragnarok_cache', 'elder_site', 'warehouse', 'pier'];
const examples = [];
for (const arche of REPRESENTATIVE_ARCHES) {
  const l = layouts.find(x => x.arche === arche);
  if (!l) continue;
  const reason = {
    smelter: 'GEO-02 PROPOSED 3.696 au west opening (po_kilns); enclosed multi-bay with yard',
    research: 'enclosed 2x2 study cells; deep level present',
    quarry: 'fully open-air terrace/pit; no roof, no enclosed-room claim',
    port: 'coastal dockside loading strip; mixed shelter + yard',
    ragnarok_cache: 'deep vault geometry with NO loot authored',
    elder_site: 'open arena ring, radial sockets, source-authored approach',
    warehouse: 'long roofed aisle with repeated bays, highest roof coverage',
    pier: 'linear open deck with berth-side fit sockets',
  }[arche];
  writeJson(path.join(EX, `${l.poiId}.v1.json`), { schema: 'soh.map.lr01.poi_example.v1', reason, layout: l });
  examples.push({ poiId: l.poiId, arche, reason, file: `output/poi_examples/${l.poiId}.v1.json` });
}

const pkg = {
  schema: 'soh.map.lr01.poi_layouts.v1', version: 1,
  status: 'MILESTONE_D__81_POI_STATIC_SPATIAL_LAYOUTS__INTERIORS_PROPOSED_NOT_CANON',
  authority: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
  stage: 'STAGE_1_MAP_GEOGRAPHY',
  generatedBy: 'world_lab/lr01/src/d_poi.mjs + src/lib/poi_layout.mjs',
  source: {
    canon: V.fingerprint,
    poiGeometry: 'world_lab/lr01/output/poi_geometry.v1.json @ Milestone A',
    geo02ProposedKilns: GEO.fingerprints.proposed,
    geo01Rasters: GEO.fingerprints.rasterManifest,
    gameplayAck: 'PR44 issue comment 6608030530 :: shared K6 spatial kernel is a TARGET, not source truth',
  },
  frame: { authoring: [2000, 1400], unit: 'authoring_unit', transformStatus: 'UNDECIDED', note: 'All shell/room/wall/socket geometry is in the unchanged authoring frame. No runtime tiles are bound.' },
  ownership: {
    MAP: ['footprint shells', 'static walls', 'rooms', 'floors', 'levels', 'static portals / openings', 'circulation geometry', 'roof coverage', 'sockets (spatial fit)', 'approach / retreat geometry'],
    GAMEPLAY: ['dynamic door state', 'locks / keys / power', 'destruction', 'player construction', 'devices / machines', 'loot / chests / vendors / economy', 'weather / environmental effects', 'AI', 'persistence', 'runtime collision / reach / LOS rules'],
    SHARED_KERNEL_TARGET: 'collision, enclosure, reach, LOS, roof coverage, portal passability adapters are exported as a CONSISTENT STATIC VIEW; Gameplay owns the dynamic half.',
  },
  counts: {
    pois: layouts.length, archetypes: archetypeCoverage.length,
    rooms: layouts.reduce((s, l) => s + l.rooms.length, 0),
    walls: layouts.reduce((s, l) => s + l.walls.length, 0),
    portals: layouts.reduce((s, l) => s + l.portals.length, 0),
    entrances: layouts.length, sockets: layouts.reduce((s, l) => s + l.sockets.length, 0),
    levels: layouts.reduce((s, l) => s + l.levels.length, 0),
    deepLevels: layouts.filter(l => l.levels.length > 1).length,
    stableIds: allIds.length, duplicateStableIds: dup.length,
  },
  archetypeCoverage,
  representativeExamples: examples,
  summary,
  layouts,
  adapterVocabulary: ['collision', 'enclosure', 'reach', 'lineOfSight', 'roofCoverage', 'portalPassability'],
  proposedChanges: [
    { id: 'PC-D-01', subject: 'proposed interiors for all 81 POIs', status: STATUS.PROPOSED, owner: 'MAP', detail: 'Rooms/walls/floors/portals/sockets are derived from canonical foot quads + archetype templates. NOT written to canon.' },
    { id: 'PC-D-02', subject: 'entrance openings', status: STATUS.PROPOSED, owner: 'MAP', detail: 'Canonical Veyra authors no doors. One PROPOSED entrance per POI on the road-facing edge; po_kilns uses the GEO-02 PROPOSED 3.696 au west opening.' },
    { id: 'PC-D-03', subject: 'vertical relationships', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY', detail: '18 canonical deep polygons become a DEEP level, but verticalSeparationAu is UNKNOWN and no stair/ladder is authored.' },
    { id: 'PC-D-04', subject: 'spatial sockets', status: STATUS.PROPOSED, owner: 'MAP', detail: 'Sockets are fit envelopes with gameplayObject=null. They do NOT assert generators, loot, locks, vendors or machines.' },
  ],
  unresolved: [
    { id: 'UN-D-01', subject: 'runtime au->tile transform and wall thickness in tiles', status: STATUS.UNRESOLVED, owner: 'CREATOR/GAMEPLAY_INTEGRATION' },
    { id: 'UN-D-02', subject: 'vertical unit / floor height / stair geometry', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY' },
    { id: 'UN-D-03', subject: 'dynamic door state and portal passability rules', status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
    { id: 'UN-D-04', subject: 'room/roof/door collision adapter intake schema', status: STATUS.UNRESOLVED, owner: 'GAMEPLAY' },
  ],
  noClaims: [
    'NO canonical Veyra rewrite', 'NO authored interior in source (all PROPOSED)',
    'NO loot, chest contents, vendor inventory or economy', 'NO locked-door, key, card or power rule',
    'NO generator, machine, recipe, quest or device', 'NO dynamic door state, destruction or player construction',
    'NO approved vertical scale or runtime tile binding', 'NO playable survival acceptance',
    'NO one-generic-room-applied-to-81-POIs (24 archetype templates + 8 representative examples)',
  ],
};
writeJson(path.join(OUT, 'poi_layouts.v1.json'), pkg);
writeJson(path.join(OUT, 'poi_summary.v1.json'), {
  schema: 'soh.map.lr01.poi_summary.v1', sourceSha256: V.fingerprint.sha256,
  counts: pkg.counts, archetypeCoverage, representativeExamples: examples, summary,
});

console.log(`D_POI_OK pois=${layouts.length} archetypes=${archetypeCoverage.length} rooms=${pkg.counts.rooms} walls=${pkg.counts.walls} portals=${pkg.counts.portals} sockets=${pkg.counts.sockets} levels=${pkg.counts.levels} deep=${pkg.counts.deepLevels} stableIds=${pkg.counts.stableIds} dup=${dup.length} examples=${examples.length}`);
for (const a of archetypeCoverage) console.log(`  ${a.arche.padEnd(16)} pois=${String(a.poiCount).padStart(2)} pattern=${a.template.pattern.padEnd(24)} rooms=${String(a.totalRooms).padStart(3)} roofMean=${a.meanRoofFraction}`);
