// MAP-LR02 M3 — broader physical architecture evidence package.
import path from 'node:path';
import { OUT, CONST, loadLr01, loadSources, writeRevisionPackage, sourceHeader, readJson } from './lib/lr02.mjs';
import { compileArchitecture } from './lib/world_architecture.mjs';
import { compileEligibility } from './lib/spawn_eligibility.mjs';

const lr = loadLr01();
const src = loadSources();
const sources = { I: src.I, P: src.P, V: src.V, GEO: src.GEO };
const portalPackage = readJson(path.join(OUT, 'portal_geometry.v1.json'));
const eligibility = readJson(path.join(OUT, 'spawn_eligibility.v1.json'));
const architecture = compileArchitecture(sources, lr, portalPackage, eligibility);

const body = {
  schema: 'soh.map.lr02.world_architecture.v1',
  version: 1, revision: 1,
  generatedBy: 'world_lab/lr02/src/m3_architecture.mjs',
  authority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  status: 'DERIVED_PHYSICAL_EVIDENCE_PLUS_PROPOSED_GEOMETRY__NOT_CANONICAL',
  parent: { ...sourceHeader().parent, transportFile: 'world_lab/lr01/output/transport.v1.json', geographyFile: 'world_lab/lr01/output/geography.v1.json', buildSitesFile: 'world_lab/lr01/output/build_sites.v1.json' },
  source: { ...sourceHeader(), canonSha256: src.V.fingerprint.sha256, portalGeometryDigest: portalPackage.revisionDigest, spawnEligibilityDigest: eligibility.revisionDigest, note: 'Source-of-truth for M1/M2 geometry is referenced by digest, not duplicated here.' },
  frame: { authoring: CONST.frame, unit: 'authoring_unit', transformStatus: 'UNDECIDED' },
  ownership: {
    map: ['static geometry proposals', 'measured raster clearance', 'road/bridge/dock approach geometry', 'regional spatial structure', 'terrain suitability'],
    gameplay: ['vehicle footprint and swept clearance', 'ferry/boat mechanics', 'runtime collision', 'placement and population'],
    proposalPolicy: 'Where source physical width is missing, an explicit PROPOSED geometry is bounded by surrounding raster/vector evidence. Proposals are NEVER canonized. Editor strokes, SNAP_TOL, display glyphs and ACCESS_R are diagnostics, not collision/passability laws. No forced land bridge is added to make a graph test pass.',
    statuses: ['SOURCE_AUTHORED', 'DERIVED', 'PROPOSED', 'UNRESOLVED', 'UNKNOWN', 'BLOCKED', 'UNDECIDED'],
  },
  ...architecture,
  coverage: {
    bridgeApproachTargets: 1, disconnectedRoads: architecture.transportTopology.disconnectedRoads.length,
    falseJoinsFlagged: architecture.transportTopology.falseJoinFlagged,
    unbridgedCrossings: architecture.transportTopology.unbridgedCrossings.length,
    bridgesAssessed: architecture.transportTopology.bridges.length,
    docksAssessed: architecture.dockApproaches.dockCount,
    loadingAreas: architecture.dockApproaches.loadingAreas.length,
    archetypes: architecture.archetypeAccess.archetypes.length,
    buildAreasAssessed: architecture.buildAreaSuitability.siteCount,
    distinctCandidateRegionsReferenced: architecture.buildAreaSuitability.distinctCandidateRegionsReferenced,
    representativeRegions: architecture.representativeRegions.regionCount,
    regionKinds: architecture.representativeRegions.kinds,
    status: 'REAL_REGIONAL_COVERAGE__NOT_FEATURE_COUNT_ONLY',
  },
  noClaims: [
    'NO canonical physical road/river/bridge width', 'NO cart-passable road, bridge or ferry verdict',
    'NO swept clearance for loaded cart/trailer', 'NO forced land bridge', 'NO approved ferry/boat rule',
    'NO playable Veyra, final world or runtime integration proof',
    'NO fabricated loot, economy, quest, weather, AI, dynamic doors or resource population',
  ],
};

const digest = writeRevisionPackage(path.join(OUT, 'world_architecture.v1.json'), body);
console.log(`M3_ARCHITECTURE_OK bridges=${architecture.bridgeApproach.proposedGeometry.deckPolygonAu.length}ptDeck disconnected=${architecture.transportTopology.disconnectedRoads.length} docks=${architecture.dockApproaches.dockCount} regions=${architecture.representativeRegions.regionCount}`);
console.log(`  regionKinds=${architecture.representativeRegions.kinds.join(',')} proposedBridgeWidthAu=${architecture.bridgeApproach.proposedGeometry.proposedWidthAu} kilnsAlternatives=${architecture.kilnsAccess.alternatives.length}`);
console.log(`  revisionDigest=${digest}`);
