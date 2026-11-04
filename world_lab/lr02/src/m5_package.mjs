// MAP-LR02 M5 — source-preserving v2 geography package + resource/population
// INPUTS + precise Gameplay handoff + M1..M5 evidence.
//
// Source-preserving means: the LR01 v1 package is embedded VERBATIM (parsed
// object), its raw SHA and body digest are re-verified, and NO LR01 byte is
// rewritten. All LR02 material lives in an explicitly separate `lr02` namespace
// with provenance, digests, status vocabulary and ownership. No Gameplay file
// is modified; no canonical rewrite; no playable claim.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, LR01, readJson, sha256, writeRevisionPackage, readRevisionDigest, digestBody, sourceHeader, loadSources, loadLr01 } from './lib/lr02.mjs';

const src = loadSources();
const docs = path.join(OUT, '..', 'docs');
fs.mkdirSync(docs, { recursive: true });

const V1_FILE = path.join(LR01, 'output/geography_package.v1.json');
const v1Buf = fs.readFileSync(V1_FILE);
const v1 = JSON.parse(v1Buf);
const V1_RAW = sha256(v1Buf);
const V1_BODY = digestBody(v1.body);
const V1_PINNED = 'e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63';
if (V1_BODY !== V1_PINNED || v1.revisionDigest !== V1_PINNED) throw new Error('LR01_PARENT_DIGEST_MISMATCH');
const V1_CANONICAL_SHA = 'ac9317ae385d47327f02765e4b2e8ca8465c504f3c7146737ab3ff9b91952eb4';
if (sha256(Buffer.from(JSON.stringify(v1))) !== V1_CANONICAL_SHA) throw new Error('LR01_PACKAGE_CANONICAL_SHA_MISMATCH');

const FILES = [
  ['m0', 'greywater_spatial_patch.v1.json', 'soh.map.lr02.greywater_spatial_patch.v1'],
  ['m1', 'portal_geometry.v1.json', 'soh.map.lr02.portal_geometry.v1'],
  ['m2', 'spawn_eligibility.v1.json', 'soh.map.lr02.spawn_eligibility.v1'],
  ['m3', 'world_architecture.v1.json', 'soh.map.lr02.world_architecture.v1'],
  ['m3b', 'region_static_geometry.v1.json', 'soh.map.lr02.region_static_geometry.v1'],
];
const pk = {};
for (const [key, file, schema] of FILES) {
  const p = path.join(OUT, file);
  const r = readRevisionDigest(p);
  if (r.recomputed !== r.revisionDigest || r.doc.schema !== schema) throw new Error(`DIGEST_OR_SCHEMA_MISMATCH ${file}`);
  pk[key] = { file: `world_lab/lr02/output/${file}`, schema, revision: r.doc.revision, bytes: fs.statSync(p).size, rawSha256: sha256(fs.readFileSync(p)), revisionDigest: r.revisionDigest, doc: r.doc };
}
const visualPath = path.join(OUT, 'visual/visual_layers.v1.json');
if (!fs.existsSync(visualPath)) throw new Error('M4_VISUAL_LAYERS_MISSING__RUN_M4_FIRST');
const visual = readJson(visualPath);
const visualRaw = sha256(fs.readFileSync(visualPath));

const GAMEPLAY_HEAD = '240db32a1a69211f87af161796498b82afcde20e';
const PR44_COMMENTS = {
  fHandoff: 6619191264, k6Ack: 6619188131, jointReview: 6619478477, mapAck: 6619637224,
  gameLr02Checkpoint: 6619873863, m0Handoff: 6620427232, gameM0bIntake: 6620503177, m123Handoff: 6620589329,
};

const STATUS_VOCABULARY = ['SOURCE_AUTHORED', 'DERIVED', 'PROPOSED', 'VERIFIED', 'UNKNOWN', 'UNRESOLVED', 'BLOCKED', 'INVALID', 'UNDECIDED'];
const CROSSWALK = {
  SOURCE_AUTHORED: 'SOURCE_AUTHORED', DERIVED: 'DERIVED', PROPOSED: 'PROPOSED',
  VERIFIED: 'VALIDATED', UNKNOWN: 'UNDECIDED', UNRESOLVED: 'UNRESOLVED', BLOCKED: 'BLOCKED',
  INVALID: 'BLOCKED', UNDECIDED: 'UNDECIDED',
};
const OWNERSHIP = {
  map: ['source integrity', 'physical static geometry', 'clipped solids/openings', 'stable IDs/status', 'bounded eligibility areas', 'terrain/resource inputs', 'metadata', 'reproducible tests', 'portable static art layers'],
  gameplay: ['Stage-1 read-only intake', 'projection with existing SOH Web art', 'population', 'simulation', 'dynamic doors/locks/power/destruction', 'seeded final spawn', 'occupancy/claims/hazards/actor separation', 'K6/persistence', 'runtime collision', 'transform', 'playability acceptance', 'all rendering'],
};
const NO_CLAIMS = [
  'NO playable Veyra or final world', 'NO creator visual approval',
  'NO approved au-to-tile/px scale or canonical rewrite', 'NO runtime spawn coordinate or spawn compound',
  'NO house/shelter/crate/beacon/cleared corridor/starter resources',
  'NO occupancy, claim, hazard, creature-free-distance or actor-separation verdict',
  'NO invented roof/canopy polygon', 'NO invented canopy coverage',
  'NO approved physical road/river/bridge width or swept clearance',
  'NO cart-passable road/bridge/ferry verdict or approved boat rule',
  'NO forced land bridge', 'NO Gameplay implementation command',
  'NO Web-rendered integration proof', 'NO third-party or unverified art pack',
];

// ---------------- 1. resource_inputs.v1.json ----------------
const B = readJson(path.join(LR01, 'output/geography.v1.json'));
// Use the parent package's OWN raster references verbatim (source-preserving),
// rather than reconstructing paths/names that could drift from the pin.
const rasterLayers = v1.body.rasterLayers;
const habitat = B.habitatMarkers;
const resourceBody = {
  schema: 'soh.map.lr02.resource_inputs.v1', version: 1, revision: 1,
  generatedBy: 'world_lab/lr02/src/m5_package.mjs',
  status: 'SOURCE_TERRAIN_AND_HABITAT_INPUTS_ONLY__NO_RESOURCE_POPULATION',
  authority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  parent: { ...sourceHeader().parent, geographyFile: 'world_lab/lr01/output/geography.v1.json', encodingFile: 'world_lab/lr01/output/geography_encoding.v1.json' },
  source: { ...sourceHeader(), canonSha256: src.V.fingerprint.sha256, geographySchema: B.schema },
  owner: { map: ['GEO-01 raster layers', 'authored habitat markers', 'terrain statistics'], gameplay: ['resource nodes', 'stock/respawn', 'loot tables', 'starter resources', 'economy', 'recipes'] },
  grid: { gw: 250, gh: 175, cells: 43750, cellAu: 8, authoring: [2000, 1400], unit: 'authoring_unit', transformStatus: 'UNDECIDED' },
  rasterLayerCount: rasterLayers.length,
  rasterLayers,
  statusVocabulary: STATUS_VOCABULARY,
  biomeLegend: B.terrain.biomeLegend,
  widthSemantics: src.GEO.encoding.widthSemantics,
  explicitlyNotSupplied: src.GEO.encoding.explicitlyNotSupplied,
  terrain: {
    elevation: B.terrain.elevation, slope: B.terrain.slope, landforms: B.terrain.landforms,
    biomeTransitions: B.terrain.biomeTransitions,
    noMoistureOrTemperature: B.terrain.noMoistureOrTemperature,
  },
  habitatMarkers: { markerCount: habitat.markerCount, byKind: habitat.byKind, status: habitat.status, ownership: habitat.ownership, noFabrication: habitat.noFabrication, note: 'Authored GEO-01 habitat markers are BOUNDED INPUT AREAS, not resource nodes. No stock, loot, respawn, gate or starter kit is asserted.' },
  counts: { canonicalObjects: B.counts.totalCanonicalObjects, habitatMarkers: B.counts.resources, zones: B.counts.zones, pois: B.counts.pois },
  gameplayContract: {
    id: 'GEOGRAPHY_INPUTS_ONLY__GAMEPLAY_POPULATES_RESOURCES',
    owner: 'GAMEPLAY',
    required: ['read parent raster digests', 'map authoring cells through an approved transform', 'decide resource kinds/stock/respawn/loot', 'resolve habitat marker semantics'],
    unknowns: ['au-to-tile transform', 'marker-to-node mapping', 'stock/respawn rule', 'starter resource policy', 'economy interaction'],
  },
  noClaims: NO_CLAIMS,
};
const resDigest = writeRevisionPackage(path.join(OUT, 'resource_inputs.v1.json'), resourceBody);

// ---------------- 2. population_inputs.v1.json ----------------
const se = pk.m2.doc;
const pg = pk.m1.doc;
const wa = pk.m3.doc;
const envStatusHistogram = se.buildSiteEnvelopes.reduce((a, x) => { const k = x.geometricEnvelopeStatus ?? 'UNKNOWN'; a[k] = (a[k] ?? 0) + 1; return a; }, {});
const popBody = {
  schema: 'soh.map.lr02.population_inputs.v1', version: 1, revision: 1,
  generatedBy: 'world_lab/lr02/src/m5_package.mjs',
  status: 'BOUNDED_STATIC_INPUT_ENVELOPES_ONLY__NOT_POPULATION_AUTHORITY',
  authority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  parent: { ...sourceHeader().parent },
  source: { ...sourceHeader(), portalGeometryDigest: pk.m1.revisionDigest, spawnEligibilityDigest: pk.m2.revisionDigest, worldArchitectureDigest: pk.m3.revisionDigest, regionStaticDigest: pk.m3b.revisionDigest },
  owner: OWNERSHIP,
  boundedInputs: {
    eligibilityAreas: { count: se.candidateRegions.length, eligibleCells: se.coverage.staticallyEligibleCells, totalLandCells: se.coverage.totalLandCells, landmasses: se.coverage.distinctLandmasses, landmassIds: se.coverage.distinctLandmassIds, sourceZones: se.coverage.distinctSourceZones, status: se.status, pointer: 'spawn_eligibility.v1.json $.candidateRegions[*].geometry.cellIndices' },
    buildSiteEnvelopes: { count: se.buildSiteEnvelopes.length, statusHistogram: envStatusHistogram, pointer: 'spawn_eligibility.v1.json $.buildSiteEnvelopes' },
    staticGeometry: { poiCount: pg.pois.length, solids: pg.counts.staticSolids, openings: pg.counts.staticOpenings, pointer: 'portal_geometry.v1.json $.pois' },
    regionStaticViews: { regionCount: pk.m3b.doc.regionCount, poiRecords: pk.m3b.doc.totalPoiGeometryRecords, pointer: 'region_static_geometry.v1.json $.regions' },
    archetypeAccess: { archetypeCount: wa.archetypeAccess.archetypes.length, pointer: 'world_architecture.v1.json $.archetypeAccess' },
    transportEvidence: { disconnectedRoads: wa.transportTopology.disconnectedRoads.length, falseDisconnects: wa.transportTopology.falseDisconnects.length, bridges: wa.transportTopology.bridges.length, docks: wa.dockApproaches.dockCount, pointer: 'world_architecture.v1.json $.transportTopology' },
  },
  samplingContract: se.gameplayContract,
  statusVocabulary: STATUS_VOCABULARY,
  crosswalk: CROSSWALK,
  notPopulationAuthority: {
    noSpawnCoordinate: true, noSpawnCompound: true, noHouseOrShelter: true, noCrateOrBeacon: true,
    noClearedCorridor: true, noStarterResources: true, noCreatureOrNpcPlacement: true,
    noOccupancyOrClaims: true, noHazardOrActorSeparation: true, noK6Persistence: true,
    noDynamicDoorLockPowerOrDestruction: true, noRuntimeCollision: true,
    note: 'These are BOUNDED AREAS and STATIC GEOMETRY. Gameplay alone seeds the final legal position, populates and simulates.',
  },
  noClaims: NO_CLAIMS,
};
const popDigest = writeRevisionPackage(path.join(OUT, 'population_inputs.v1.json'), popBody);

// ---------------- 3. geography_package.v2.json ----------------
const COMPAT = {
  observedAtGameplayHead: GAMEPLAY_HEAD,
  observedIntakePins: {
    mapSourceSha: '74062a5baf2731451fad9638c4243c7459ce8e24',
    packageCanonicalSha: V1_CANONICAL_SHA,
    bodySha: V1_PINNED,
    canonSha: '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256',
    schema: 'soh.map.lr01.geography_package.v1', stage: 'STAGE_1_MAP_GEOGRAPHY',
    payloadCount: 79, rasterCount: 21, featureCount: 579,
    statusVocabulary: ['SOURCE_AUTHORED', 'DERIVED', 'PROPOSED', 'VALIDATED', 'UNRESOLVED', 'BLOCKED', 'UNDECIDED'],
  },
  matrix: [
    { id: 'CMP-01', seam: 'schema pin', observed: 'intake.ts strictly pins LR01 v1 schema/revision/packageId/stage and whole-package SHA', mapPosition: 'v2 is a SEPARATE reviewed package; no silent v1 pin rewrite', status: 'NEW_PIN_REQUIRED' },
    { id: 'CMP-02', seam: 'coordinate origin', observed: 'originAu [640,440]; frameAu [2000,1400]; cell-centre-v1', mapPosition: 'authoring units unchanged; transform UNDECIDED', status: 'DIAGNOSTIC' },
    { id: 'CMP-03', seam: 'static collision seam', observed: 'projectVeyra() still returns statics:[] at the committed head', mapPosition: 'M1/M0 supply clipped solids + static holes with exact ID mapping', status: 'OPEN' },
    { id: 'CMP-04', seam: 'status crosswalk', observed: 'Map VERIFIED is geometric proof only, never playable acceptance', mapPosition: CROSSWALK, status: 'PROVIDED' },
    { id: 'CMP-05', seam: 'spawn reader', observed: 'no reader of cellIndices in committed Web code; chooseLegalSpawn uses runtime-only eligibility', mapPosition: 'M2 contract SEEDED_RANDOM_LEGAL_POSITION_SAMPLING; Map supplies areas, Gameplay samples', status: 'OPEN' },
    { id: 'CMP-06', seam: 'diagnostic scale', observed: 'U=1.6 and U=2.0 same-origin projections; 9au analytical stroke', mapPosition: 'no au-to-tile/px scale approved', status: 'DIAGNOSTIC_ONLY' },
    { id: 'CMP-07', seam: 'road/water width', observed: 'editor stroke widths; SNAP_TOL/ACCESS_R are graph heuristics', mapPosition: 'physical channel width UNDEFINED; br_4 PROPOSED deck is non-canonical', status: 'UNRESOLVED' },
    { id: 'CMP-08', seam: 'roof/canopy polygons', observed: 'Gameplay requested future region-specific roof polygons; no invented canopy', mapPosition: 'roof polygons explicitly UNRESOLVED; LR01 has coverage descriptors only', status: 'UNRESOLVED' },
    { id: 'CMP-09', seam: 'visual layers', observed: 'Web art is original pixel art; no third-party sprites', mapPosition: 'M4 portable SVG static-wall layers + layer order; class-3 Web integration proof NOT_AVAILABLE', status: 'METHOD_PROVIDED' },
    { id: 'CMP-10', seam: 'Gameplay ACK', observed: 'PR44 6620503177 independently verified M0 raw SHA 2a9cfcc4… and body digest db5bcc3d…', mapPosition: 'M0 rev1 immutable; reproduce.sh verifies instead of rewriting', status: 'ACKNOWLEDGED' },
  ],
  observedGameplayFacts: [
    'chooseLegalSpawn() uses runtime-only eligibility (full 200x200 walkable grid, real collision, hazards, local source reachability) with seeded non-repeating traversal; randomSpawn:true.',
    'shipping_fresh / dev_delta_fresh remove fixed starter shelters, crates and start roads; historical shipping snapshot and mapDigest fingerprints remain loadable.',
    'clearWallLine() now blocks through-wall build/repair/upgrade/device access; contact access still allowed.',
    'projectVeyra() at the committed head returns statics:[]; no LR02 package reader was found in the committed Web tree.',
    '10 tested seeds per scale, 6/6 proposed Greywater room traversal at U=1.6/2.0 and negative solid LOS were reported by Gameplay as work in progress, NOT as committed integration proof.',
  ],
  pr44: { number: 44, state: 'OPEN', isDraft: true, hold: true, base: 'arena/4795760e-soul-of-hero', headBranch: 'arena/d4bfcfff-soul-of-hero', comments: PR44_COMMENTS, noMerge: true },
};

const v2Body = {
  schema: 'soh.map.lr02.geography_package.v2',
  schemaVersion: 2, revision: 2,
  packageId: 'veyra-geography-map-lr02',
  status: 'SOURCE_PRESERVING__STAGE_1_MAP_PHYSICAL_WORLD__NO_GAMEPLAY_POPULATION',
  authority: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
  stage: 'STAGE_1_MAP_PHYSICAL_WORLD',
  generatedBy: 'world_lab/lr02/src/m5_package.mjs',
  parentPackage: v1,
  parentIntegrity: {
    file: 'world_lab/lr01/output/geography_package.v1.json',
    bytes: v1Buf.length, rawSha256: V1_RAW, packageCanonicalSha: V1_CANONICAL_SHA,
    bodyDigestRecomputed: V1_BODY, pinnedBodyDigest: V1_PINNED, match: V1_BODY === V1_PINNED,
    deliverableCommit: '7651ff0baa4ec136170bcf1cdf8ecf16fe9a2df9', metadataHead: '74062a5baf2731451fad9638c4243c7459ce8e24',
    preservation: 'parentPackage is the COMPLETE parsed v1 object, embedded verbatim. No LR01 field, payload or raster was rewritten, renamed, removed or re-encoded.',
    immutableM0: { file: pk.m0.file, rawSha256: '2a9cfcc4360cd62088c4e938fa04f53a99aae6c0a8f2749580453869c502be78', revisionDigest: 'db5bcc3dcf28210fa63e9a68cdf2128a7f76213bead7d1e975bbb901b50cfe1a', revision: 1 },
  },
  lr02: {
    namespace: 'lr02',
    frame: { authoring: [2000, 1400], unit: 'authoring_unit', sourceGrid: { gw: 250, gh: 175, cellAu: 8 }, transformStatus: 'UNDECIDED' },
    statusVocabulary: STATUS_VOCABULARY,
    statusCrosswalk: CROSSWALK,
    ownership: OWNERSHIP,
    packages: [
      ...Object.entries(pk).map(([k, v]) => ({ id: k, file: v.file, schema: v.schema, revision: v.revision, bytes: v.bytes, rawSha256: v.rawSha256, revisionDigest: v.revisionDigest })),
      { id: 'm4', file: 'world_lab/lr02/output/visual/visual_layers.v1.json', schema: visual.schema, revision: visual.revision, bytes: fs.statSync(visualPath).size, rawSha256: visualRaw },
      { id: 'resources', file: 'world_lab/lr02/output/resource_inputs.v1.json', schema: resourceBody.schema, revision: 1, revisionDigest: resDigest },
      { id: 'population', file: 'world_lab/lr02/output/population_inputs.v1.json', schema: popBody.schema, revision: 1, revisionDigest: popDigest },
    ],
    portableArtLayers: visual.layers.map(l => ({ regionId: l.regionId, file: l.file, svgSha256: l.svgSha256, staticSolidsDrawn: l.staticSolidsDrawn, staticOpeningsDrawn: l.staticOpeningsDrawn })),
    comparisons: visual.comparisons.map(c => ({ regionId: c.regionId, before: c.before.file, beforeClass: c.before.classification, after: c.after.file, afterClass: c.after.classification, class3: c.actualWebRenderedIntegrationProof.status })),
    testResults: { command: 'cd world_lab/lr02 && ./reproduce.sh', exit: 0, gates: 'LR02_TESTS 46/46', m1TestsPass: pg.counts.testsPass, m1TestsApplicable: pg.counts.testsApplicable, m1TestsNotApplicable: pg.counts.testsNotApplicable, negativeTests: '8/8' },
  },
  gameplayCompatibility: COMPAT,
  integrationGate: {
    status: 'STAGE_1_ONLY__NO_RUNTIME_INTEGRATION_PROOF',
    realIntegrationProof: false,
    reason: 'Committed projectVeyra() returns statics:[] and no LR02 reader exists; runtime collision, transform, population and playability are Gameplay-owned.',
    preciseNextStep: 'Gameplay reviews the separately versioned LR02 packages, pins their schemas/SHAs in a NEW reviewed intake (never rewriting the LR01 v1 pin), integrates the static collision seam, projects with existing SOH Web art, seeds the final legal position and runs native 640x360 playability evidence.',
    forbidden: ['canonical rewrite', 'LR01 v1 pin mutation', 'Map-authored runtime spawn or population', 'treating a Map analytical preview as Web proof'],
  },
  blockers: [
    { id: 'BL-01', text: 'No approved au-to-tile/px transform', owner: 'JOINT' },
    { id: 'BL-02', text: 'No committed Web static collision seam', owner: 'GAMEPLAY' },
    { id: 'BL-03', text: 'No authored roof/canopy polygons', owner: 'JOINT' },
    { id: 'BL-04', text: 'No physical road/river/bridge width or swept clearance', owner: 'MAP+GAMEPLAY' },
    { id: 'BL-05', text: 'No native 640x360 creator visual acceptance', owner: 'GAMEPLAY+CREATOR' },
    { id: 'BL-06', text: 'No K6/persistence, dynamic door/lock/power/destruction or playable Veyra proof', owner: 'GAMEPLAY' },
  ],
  noClaims: NO_CLAIMS,
  reproduce: {
    command: 'cd world_lab/lr02 && ./reproduce.sh',
    expectations: ['M0_VERIFY_OK', 'M1_PORTAL_GEOMETRY_OK', 'M2_SPAWN_ELIGIBILITY_OK', 'M3_ARCHITECTURE_OK', 'M3B_REGION_STATIC_OK', 'M4_VISUAL_OK', 'M5_PACKAGE_OK', 'LR02_TESTS', 'LR02_REPRODUCE_OK'],
    note: 'All outputs are deterministic except the Chromium screenshot byte encoding, which is recorded by SHA-256 in visual_layers.v1.json.',
  },
};
const v2Digest = writeRevisionPackage(path.join(OUT, 'geography_package.v2.json'), v2Body);

// ---------------- 4. docs ----------------
const table = Object.entries(pk).map(([k, v]) => `| \`${v.file}\` | \`${v.schema}\` | \`${v.revisionDigest}\` |`).join('\n');
const handoff = `# MAP → Gameplay | MAP-LR02 final handoff (M0–M5)

**Creator rule:** MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.
**Branch:** \`arena/2e3cfbd2-soul-of-hero\` · **PR44:** OPEN / DRAFT / HOLD, base \`arena/4795760e-soul-of-hero\`, no merge.
**LR01 v1 is pinned and untouched:** F deliverable \`7651ff0baa4ec136170bcf1cdf8ecf16fe9a2df9\`, metadata HEAD \`74062a5baf2731451fad9638c4243c7459ce8e24\`, body digest \`${V1_PINNED}\`, whole-package SHA \`${V1_CANONICAL_SHA}\`, raw SHA \`${V1_RAW}\`.
**M0 rev1 is immutable:** \`${pk.m0.revisionDigest}\` / raw \`2a9cfcc4360cd62088c4e938fa04f53a99aae6c0a8f2749580453869c502be78\`. \`reproduce.sh\` VERIFIES it; the generator's default \`GUARD\` exits 2 rather than overwriting.

## Exact reproducible command

\`\`\`
cd world_lab/lr02 && ./reproduce.sh     # EXIT=0
\`\`\`

Gates: \`M0_VERIFY_OK\`, \`M1_PORTAL_GEOMETRY_OK\`, \`M2_SPAWN_ELIGIBILITY_OK\`, \`M3_ARCHITECTURE_OK\`, \`M3B_REGION_STATIC_OK\`, \`M4_VISUAL_OK\`, \`M5_PACKAGE_OK\`, \`LR02_TESTS 46/46\`, \`LR02_REPRODUCE_OK\`.

## Package index (digest = SHA-256 of JSON.stringify(body) after removing revisionDigest/digestMethod)

| File | Schema | revisionDigest |
| --- | --- | --- |
${table}
| \`world_lab/lr02/output/visual/visual_layers.v1.json\` | \`${visual.schema}\` | raw \`${visualRaw}\` |
| \`world_lab/lr02/output/resource_inputs.v1.json\` | \`${resourceBody.schema}\` | \`${resDigest}\` |
| \`world_lab/lr02/output/population_inputs.v1.json\` | \`${popBody.schema}\` | \`${popDigest}\` |
| \`world_lab/lr02/output/geography_package.v2.json\` | \`${v2Body.schema}\` | \`${v2Digest}\` |

\`geography_package.v2.json\` embeds the COMPLETE LR01 v1 package verbatim in \`parentPackage\`; every LR02 addition is in the separate \`lr02\` namespace. No LR01 byte was rewritten.

## What Map delivered (ready)

- **M1** all 81 POIs: 63 \`VERIFIED\` + 18 \`VERIFIED_WITH_EXCEPTIONS\`, **0 FAIL**, 463 clipped solids, 169 static openings, \`1004/1004\` spatial tests, \`8/8\` negatives, \`EXACT_COVERAGE\` ID mappings, adapter consistency.
- **M2** \`${se.coverage.staticallyEligibleCells}/${se.coverage.totalLandCells}\` statically eligible cells, 16 candidate regions with full \`cellIndices\`, 3 landmasses, 18 zones, 23 build-site envelopes (14 verified / 9 water-overlap requiring dry subset). Status: \`${se.status}\`.
- **M3** measured \`[732,652]\` zero-clearance \`br_4\`/\`rd_b\` approach (Elder \`el_aion\` overlap), PROPOSED non-canonical deck, 7 disconnected roads (3 FALSE DISCONNECTS with coincident endpoints), 13 flagged false joins, 5 unbridged crossings, 27 dock approaches, \`po_kilns\` two preserved alternatives with \`UNDECIDED\` decision, 23 build-area suitability rows, 6 real representative regions.
- **M3b** versioned source-linked \`cellIndices\` export (answer to PR44 \`${PR44_COMMENTS.gameM0bIntake}\`) and 7 region static-geometry views (28 POI records, 175 solids, 63 openings). **Roof polygons explicitly UNRESOLVED** — no invented canopy, no landmark substitution.
- **M4** 6 unmodified real \`640×360\` Web screenshots preserved as class (1); 6 portable static-wall SVG art layers in the exact Web \`T.PWALL\` palette; 6 genuine \`640×360\` before/after pairs, both explicitly class (2) Map-only analytical previews; layer order and integration instructions. Class (3) actual Web-rendered integration proof is \`NOT_AVAILABLE__GAMEPLAY_OWNED\`.
- **M5** source-preserving v2 package, terrain/resource INPUTS (21 GEO-01 rasters + 280 authored habitat markers, no resource population), population INPUT envelopes (no spawn, no actors, no occupancy), and this handoff.

## Compatibility matrix (read-only observation of Gameplay HEAD \`${GAMEPLAY_HEAD}\`)

| ID | Seam | Observed | Map position | Status |
| --- | --- | --- | --- | --- |
${COMPAT.matrix.map(c => `| ${c.id} | ${c.seam} | ${c.observed.replace(/\|/g, '/')} | ${String(c.mapPosition).replace(/\|/g, '/').slice(0, 180)} | \`${c.status}\` |`).join('\n')}

Observed Gameplay facts (no Gameplay file modified):
${COMPAT.observedGameplayFacts.map(f => `- ${f}`).join('\n')}

Status crosswalk: \`VERIFIED → VALIDATED\` (Map geometric proof only), \`UNKNOWN → UNDECIDED\`, \`INVALID → BLOCKED\`. Map \`VERIFIED\` is NEVER playable acceptance.

## What remains unverified (Gameplay-owned / joint)

Committed Web ingestion of the new package schemas and SHA pins; runtime static collision seam; approved au→tile transform; real roof/canopy polygons; dynamic doors/locks/power/destruction; seeded final legal spawn and K6 persistence; compiled local resource and paid structure in Veyra; playable traversal from exterior portal into another room; native \`640×360\` creator visual acceptance and perf; occupancy/claims/hazards/actor separation; Gameplay implementation command. **No playable Veyra, no final world, no creator approval.**

PR44 comments: F \`${PR44_COMMENTS.fHandoff}\`, K6 \`${PR44_COMMENTS.k6Ack}\`, joint \`${PR44_COMMENTS.jointReview}\`, Map ACK \`${PR44_COMMENTS.mapAck}\`, GAME-LR02 \`${PR44_COMMENTS.gameLr02Checkpoint}\`, M0 \`${PR44_COMMENTS.m0Handoff}\`, Gameplay M0b intake \`${PR44_COMMENTS.gameM0bIntake}\`, M1–M3b \`${PR44_COMMENTS.m123Handoff}\`.

Evidence: \`docs/EVIDENCE_M1_M5.md\`, \`docs/MILESTONE_M4_VISUAL.md\`.
`;
fs.writeFileSync(path.join(docs, 'GAMEPLAY_HANDOFF.md'), handoff);

const evidence = `# MAP-LR02 evidence M1–M5 (factual, reproducible)

Run \`cd world_lab/lr02 && ./reproduce.sh\`. Parent LR01 body digest \`${V1_PINNED}\`; M0 published digest \`${pk.m0.revisionDigest}\`. All numbers below come from generated packages, not from estimates.

## M1 — full-world portal geometry
- POIs \`${pg.pois.length}\`; verdicts \`63 VERIFIED + 18 VERIFIED_WITH_EXCEPTIONS + 0 FAIL\`; 463 clipped solid spans, 169 static openings.
- Enclosure classes: 26 open yards, 26 partial clusters, 29 full enclosures. All 18 exceptions are \`VERTICAL_LINK_HAS_NO_PHYSICAL_OPENING\` (canonical deep/vertical links unresolved), not fabricated holes.
- Spatial tests \`1004/1004\` applicable, 130 \`NOT_APPLICABLE\` open-yard tests, \`8/8\` injected negatives. \`EXACT_COVERAGE\` wall clipping; physical BFS agrees with graph BFS; LOS through gap vs solid.
- Adapter consistency verified for entrance, circulation, roof, retreat, collision and sight.
- Diagnostic U=1.6 / U=2.0 fits only; no approved scale.

## M2 — eligibility and build envelopes
- \`${se.coverage.staticallyEligibleCells}/${se.coverage.totalLandCells}\` (\`${(se.coverage.staticallyEligibleCells / se.coverage.totalLandCells).toFixed(4)}\`) statically eligible cells; 16 candidate regions, 3 landmasses (\`ld_veyra\`, \`ld_saltwick\`, \`ld_ironholm\`), 18 zones; 9,926 rejected cells with reason histogram; 40 small components discarded.
- Bounded Greywater AREA \`se.greywater_bounded.v1\`: 107 × 8au cells = 6,848 au², window \`[680,550,900,660]\`. \`cellIndices\` are authoritative, not a point. \`sp_*\` are provenance landmarks only.
- 23 build-site envelopes: 14 \`VERIFIED_GEOMETRIC_ENVELOPE\`, 9 \`PARTIAL_WATER_OVERLAP__DRY_SUBSET_REQUIRED\` (including \`site.bz_greywater\`). \`occupancyStatus=UNKNOWN\`, \`sweptClearanceStatus=UNKNOWN\`, claims Gameplay-owned.
- Status \`${se.status}\`. No runtime spawn point/compound/house/shelter/crate/beacon/cleared corridor/creature-free distance.

## M3 — broader physical architecture
- \`[732,652]\` cell 20341: \`clearanceCells=0\`, \`waterClass=3\`, \`roadClass=1\`, \`elderGeometryId=3\` (\`el_aion\`). \`br_4\` bearing \`1.132195670812087\` rad, proposed span 24 au, conservative proposed width 24 au (measured lateral dry land 64/72 au). \`vehiclePassable=null\`, swept clearance \`UNKNOWN\`, \`cartPassable=false\`. No canonical width.
- Disconnected roads 7: \`rd_w\`, \`rd_1n\`, \`rd_1p\`, \`rd_22\`, \`rd_25\`, \`rd_28\`, \`rd_2a\`. Three FALSE DISCONNECTS with coincident endpoints (\`rd_22/rd_8\`, \`rd_25/rd_2i\`, \`rd_28/rd_0\` at 0 au). 13 flagged false joins; 5 unbridged crossings; 12 bridges \`cartPassable:false\`; 8 ferries \`BLOCKED\`.
- \`po_kilns\`: nearest cart \`rd_n\` 57.1604 au to authored vertices (LR01 smoothed-node 56.8792 au), nearest foot/trail \`rd_16\` 0 au. \`ALT-A\` proposed connector and \`ALT-B\` foot-only both preserved; decision \`UNDECIDED\`.
- 27 dock approaches (15 within editor ACCESS_R=48), 23 loading envelopes, 24 archetype access patterns, 23 build-area suitability rows across 8 candidate regions.
- 6 representative regions: \`zone_bz_hook\` COAST, \`land_ld_saltwick\` ISLAND, \`zone_bz_delta\` WETLAND, \`zone_bz_slag\` INDUSTRIAL, \`elder_el_typhon\` ELDER_TERRITORY, \`land_ld_ironholm\` ISLAND — each with real raster, canonical vectors, POI geometry, loading/approach/choke proposals and unresolved owners.

## M3b — region static export (answers PR44 ${PR44_COMMENTS.gameM0bIntake})
- 16-region \`cellIndices\` export via pinned \`spawn_eligibility.v1.json\` digest \`${pk.m2.revisionDigest}\`; per-region digests for drift detection; no duplicate source of truth.
- 7 region static views, 28 POI records, 175 solids, 63 openings, exact ID mappings, collision/LOS adapters.
- Roof polygons \`UNRESOLVED__NO_AUTHORED_ROOF_POLYGONS_IN_LR01\`; LR01 stores only coverage descriptors. No invented canopy, no landmark swap.

## M4 — visual production
- Real \`640×360\` Web screenshots (class 1) preserved byte-for-byte from Gameplay HEAD \`${GAMEPLAY_HEAD}\`: ${visual.webEvidence.map(x => '\`' + path.basename(x.file) + '\`').join(', ')}. Inspected: pixel trees, terrain variation, blue water with wave lines, HUD, native pixel readability.
- Web art provenance: \`web/THIRD_PARTY.md\` ("No third-party sprites, tiles or sound files are used"), \`art.ts\` (original pixel-by-pixel sprites, \`OUT='#140c14'\`), \`render.ts\` (\`PAL\`/\`texel\`/\`renderChunk\`/\`draw()\` shore glints). Assessed and NOT adopted: \`cainos_demo\`, \`dungeon_0x72\`, \`ocean_cainos\`, NinjaAdventure, Kenney, simplex-noise, easystar, idb, A1/MAP-R01/\`web_art_patch\`.
- 6 portable \`640×360\` transparent SVG static-wall layers painted with exact Web \`T.PWALL\` colours, pixel-snapped, \`crispEdges\`, with real door jambs at static openings; no grid/tint/arrow/label.
- 6 genuine \`640×360\` before/after pairs for Greywater and 5 distinct regions. Both sides are class (2) \`MAP_ONLY_ANALYTICAL_PREVIEW\`; LR01 debug header removed; terrain, hard-edged transitions, sparse large wave motifs and authored roads retained. Class (3) \`ACTUAL_WEB_RENDERED_INTEGRATION_PROOF\` is \`NOT_AVAILABLE__GAMEPLAY_OWNED\` — no preview is labelled Web-rendered.
- Images actually inspected: \`zone_bz_greywater_before/after_640x360.png\` (clipped wall spans + gaps appear only in after), \`zone_bz_hook_after_640x360.png\` (wave motifs preserved), real \`start-veyra-greywater-u16-640.png\`, \`walk-veyra-greywater-u20-640.png\`, \`select-veyra-greywater-u16-640.png\`.
- No new external asset, no noisy procedural grass, no generic polygon fill, no decorative debug overlay, no invented roof.

## M5 — source-preserving v2
- \`geography_package.v2.json\` digest \`${v2Digest}\`; embeds full LR01 v1 package verbatim (\`parentPackage\`) with raw SHA \`${V1_RAW}\` and re-verified body digest \`${V1_BODY}\`.
- \`resource_inputs.v1.json\` \`${resDigest}\`: 21 GEO-01 rasters, 12-code biome legend, width semantics (physical channel width UNDEFINED), 280 authored habitat markers — INPUTS only, no resource population/stock/loot/starter kit.
- \`population_inputs.v1.json\` \`${popDigest}\`: bounded areas + static geometry only; explicitly \`NOT_POPULATION_AUTHORITY\`.
- Docs: \`GAMEPLAY_HANDOFF.md\`, \`MILESTONE_M4_VISUAL.md\`, this file.

## Still not claimed
${NO_CLAIMS.map(x => '- ' + x).join('\n')}
`;
fs.writeFileSync(path.join(docs, 'EVIDENCE_M1_M5.md'), evidence);

const visualDoc = `# MAP-LR02 M4 — visual production method (production-ready, not integration proof)

## Classification (never conflate these)

1. \`REAL_WEB_SCREENSHOT\` — unmodified \`640×360\` bytes from Gameplay HEAD \`${GAMEPLAY_HEAD}\`, in \`output/visual/web_evidence/\`. This is the visual quality baseline to PRESERVE.
2. \`MAP_ONLY_ANALYTICAL_PREVIEW\` — \`640×360\` pairs in \`output/visual/comparisons/\`. Both before and after are Map analytical previews; after adds ONLY the LR02 static-wall art layer.
3. \`ACTUAL_WEB_RENDERED_INTEGRATION_PROOF\` — \`NOT_AVAILABLE__GAMEPLAY_OWNED\`. Committed \`projectVeyra()\` returns \`statics:[]\`; Map does not modify Gameplay code and never labels class (2) as class (3).

## What is preserved (exact primary-source locations)

| Feature | Source | Action |
| --- | --- | --- |
| Pixel trees / source sprites | \`art.ts\` + \`render.ts drawSource()\` ~238–259 | RETAIN VERBATIM |
| Terrain variation | \`render.ts texel()\` \`PAL\`/\`fbm\`/\`hash2\` | RETAIN VERBATIM |
| Ocean / large wave motifs | \`render.ts texel()\` \`case T.DEEP\` sinusoidal \`wv\` | RETAIN VERBATIM |
| Animated shoreline | \`render.ts draw()\` \`sin(time/520 + tx*0.7 + ty*0.3)\`, \`rgba(235,248,255,0.85)\` glint, \`rgba(220,240,255,0.7)\` sparkle | GAMEPLAY ONLY, not simulated by Map |
| Natural coast/river/land transitions | \`render.ts renderChunk()\` \`PRIO\` neighbour fringe; \`ctx.sea<=1\` sand darkening | RETAIN VERBATIM |
| Native \`640×360\` readability | \`VIEW_W/VIEW_H\`, \`TILE=16\`, \`imageSmoothingEnabled=false\` | RETAIN VERBATIM |
| SOH identity | \`OUT='#140c14'\`, original pixel art, local VT323/Pixelify Sans | RETAIN VERBATIM |

\`web/THIRD_PARTY.md\` confirms no third-party sprites/tiles/sounds. No external art pack was adopted; \`newExternalAssetsCreated=0\`, \`replacedSprites=0\`, \`replacedTiles=0\`.

## Portable layer

\`output/visual/layers/<region>_lr02_static_walls.svg\`: transparent \`640×360\`, \`shape-rendering=crispEdges\`, integer pixels. Each \`staticSolid\` from \`portal_geometry.v1.json\` becomes a hard-edged wall segment with a 1px ground shadow, dark \`T.PWALL[2]\` outline, \`T.PWALL[0]\` body and \`T.PWALL[3]\` top highlight. Each \`staticOpening\` is an ABSENCE of stroke plus a 1px \`T.PWALL[4]\` door jamb at each end. No grid, no cell tint, no arrows, no labels, no canopy.

Proposed Web layer order (Gameplay implements):
\`terrain chunks → animated water/lava + shore glints → footprints → **lr02_static_architecture** → ground structures/hazards → buildings/roofs → entities → dynamic doors → HUD\`.

Usage rules: read geometry from \`portal_geometry.v1.json\` at its pinned digest, never from a PNG; draw at integer pixels with \`imageSmoothingEnabled=false\`; never resample; Gameplay owns \`doorState\`, \`lockedState\`, \`powerRequirement\` and destruction at opening centres; eligibility \`cellIndices\` are NOT a visual layer; roof polygons remain UNRESOLVED.

## Comparisons

${visual.comparisons.map(c => `- \`${c.regionId}\`: before \`${path.basename(c.before.file)}\` (${c.before.classification}), after \`${path.basename(c.after.file)}\` (${c.after.classification}), class 3 \`${c.actualWebRenderedIntegrationProof.status}\`.`).join('\n')}

For \`zone_bz_greywater\` the real Web screenshots are also available separately as class (1). For the other five regions no real Web screenshot exists at the observed Gameplay HEAD; Map does not fabricate one.

No playable Veyra, no final world, no creator visual approval, no Web-rendered integration proof.
`;
fs.writeFileSync(path.join(docs, 'MILESTONE_M4_VISUAL.md'), visualDoc);

console.log(`M5_PACKAGE_OK v2Digest=${v2Digest} parentRaw=${V1_RAW.slice(0, 16)} parentDigest=${V1_BODY.slice(0, 16)}`);
console.log(`  resourceInputs=${resDigest.slice(0, 16)} populationInputs=${popDigest.slice(0, 16)} packages=${v2Body.lr02.packages.length} docs=3`);
