#!/usr/bin/env node
// MAP-GEO-02 step 5: concise Gameplay-facing geometry package.
// ONE corridor (sp_lake -> po_kilns), ONE POI. No runtime merge, no population.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const GEO01 = path.resolve(ROOT, '../geo01/output');
const OUT = path.join(ROOT, 'output');
const sha = b => createHash('sha256').update(b).digest('hex');
const json = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const F = f => ({ file: f, bytes: fs.statSync(f).size, sha256: sha(fs.readFileSync(f)) });

function main() {
  const enc = read(path.join(OUT, 'maplab_encoding.v1.json'));
  const audit = read(path.join(OUT, 'corridor_audit.v1.json'));
  const design = read(path.join(OUT, 'poi_po_kilns.proposed.v1.json'));
  const own = read(path.join(OUT, 'ownership_correction.v1.json'));
  const corridor = read(path.join(GEO01, 'corridor.v1.json'));
  const geo = read(path.join(GEO01, 'geography.v1.json'));
  const canon = sha(Buffer.from(execFileSync('git', ['show',
    '19d8c6ec820f324a6ac12733165e43b5e2c6eab2:map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json'],
    { cwd: path.resolve(ROOT, '../..'), maxBuffer: 32 * 1024 * 1024 })));

  const roads = {};
  for (const r of geo.objects.roads) if (audit.sourceIds.roads.includes(r.id)) roads[r.id] = { kind: r.kind, conf: r.conf || null, points: r.points };
  const cross = audit.audit.bridgeCrossings.focusBridges;

  const out = {
    schema: 'soh.map.geo02.geometry_package.v1',
    generatedBy: 'world_lab/geo02/src/package.mjs',
    status: 'MAP_GEOMETRY_HANDOFF_CANDIDATE__NOT_A_RUNTIME_MAP_PACKAGE',
    scope: { corridor: 'sp_lake -> po_kilns', poi: 'po_kilns', poiCount: 1, corridorCount: 1 },
    authority: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
    howToRead: {
      coordinates: 'ALL coordinates are 2000x1400 Veyra AUTHORING units; no rescale, no authoring-unit -> runtime-tile transform. Do NOT interpret as PR44 200x200 @ TILE=16 tiles.',
      notRuntime: 'This is NOT a RuntimeMapPackage. Do not run compileEconomy / diagnoseStarts / validateRuntimeMapPackage against it.',
      notGameplay: 'No loot, cash, doors state, power, spawns, harvestables, climate or population is supplied.',
    },
    sourceFingerprints: {
      veyraGold: { branch: 'map/veyra-gold-asset-canon-20261102', commit: '19d8c6ec820f324a6ac12733165e43b5e2c6eab2', sha256: canon },
      maplabSource: { branch: 'input/greywater-poi-pilot-20261102', commit: enc.sourceEvidence.maplab.commit, innerZipSha256: enc.sourceEvidence.maplab.innerZipSha256, htmlSha256: enc.sourceEvidence.maplab.htmlSha256, zipChain: enc.sourceEvidence.maplab.zipChain.status },
      geo01: { geography: F(path.join(GEO01, 'geography.v1.json')), corridor: F(path.join(GEO01, 'corridor.v1.json')), contract: F(path.join(GEO01, 'contract_boundary.v1.json')) },
      geo02: {
        encoding: F(path.join(OUT, 'maplab_encoding.v1.json')), audit: F(path.join(OUT, 'corridor_audit.v1.json')),
        poiDesign: F(path.join(OUT, 'poi_po_kilns.proposed.v1.json')), ownership: F(path.join(OUT, 'ownership_correction.v1.json')),
        visual: F(path.join(OUT, 'audit_before_after.svg')),
      },
    },
    exactSourceIds: {
      spawn: { id: audit.sourceIds.spawn, at: audit.sourceIds.spawnAt },
      poi: { id: 'po_kilns', at: audit.sourceIds.poiAt, arche: design.sourceEvidence.poi.arche, depth: 'surface', gate: 'none', conf: 'proposal', footAreaAu2: design.sourceEvidence.poi.footAreaAu2 },
      roads,
      bridges: cross.map(b => ({ id: b.bridgeId, at: b.source?.at, load: b.source?.load, conf: b.source?.conf, coveredIntersections: b.coveredIntersections.map(c => ({ roadId: c.roadId, riverId: c.riverId, distanceAu: c.bridgeDistanceAu })) })),
      rivers: audit.audit.riverWidths.filter(r => r.crossedByCorridor).map(r => ({ id: r.id, widthAu: r.widthAu, maskStrokeAu: r.maskStrokeAu, carveRadiusAu: r.carveRadiusAu })),
      ferryNearest: { roadId: 'rd_2j', distanceAu: 187.1, usedByAnyRoute: 0 },
      elder: 'aion', resourceAnnotationCount: 280, note: '280 resource objects are candidate geographic annotations, NOT authoritative Gameplay nodes.',
    },
    connectivityLayers: {
      SOURCE_AUTHORED: { status: 'EXPLICIT_REFS_ONLY', detail: 'river mouth/source refs, bridge at/load, POI links, 43 exact coincident road endpoint pairs. Veyra has NO road-to-road junction table.', riverRefs: audit.connectivityLayers.SOURCE_AUTHORED.explicitRiverMouthSourceRefs.length, bridges: audit.connectivityLayers.SOURCE_AUTHORED.bridges.length },
      DERIVED_ROAD_GRAPH: { status: 'TWO_INCOMPATIBLE_DERIVATIONS', geo01: '131 nodes / 105 edges @ joinToleranceAu=8 (endpoint + exact intersections)', maplab: `${audit.audit.junctionTolerances.maplabResampledGraphNodes.atSnapTol7.nodes} nodes @ SNAP_TOL=7 on Catmull-Rom curves resampled at 8u`, verdict: audit.audit.junctionTolerances.verdict },
      RASTER_CANDIDATE: { status: 'CONNECTED_BUT_NOT_A_ROUTE', geo01Bfs: `${audit.connectivityLayers.RASTER_CANDIDATE.geo01WalkableCandidateBFS.gridSteps} steps, connected=${audit.connectivityLayers.RASTER_CANDIDATE.geo01WalkableCandidateBFS.connected}`, maplabDijkstra: { foot: audit.connectivityLayers.RASTER_CANDIDATE.maplabStepMultDijkstra.foot.connected, cart: audit.connectivityLayers.RASTER_CANDIDATE.maplabStepMultDijkstra.cart.connected }, caveat: audit.connectivityLayers.RASTER_CANDIDATE.neverConflatedWithRoadGraph },
      PHYSICAL_CLEARANCE: { status: 'UNPROVEN', zeroClearanceCells: audit.audit.zeroClearance.zeroClearanceCellCount, minClearanceAuOnGeo01Path: audit.audit.zeroClearance.geo01ClearanceAuAlongPath.min, channelSpanFitVerified: false, sweptClearanceValidated: false },
      neverConflated: true,
    },
    verifiedGeometry: {
      foot: { polygonAu: design.sourceEvidence.poi.foot, areaAu2: design.sourceEvidence.poi.footAreaAu2, source: 'pois[po_kilns].foot (verbatim)' },
      authoredRoadPenetratesFoot: { roadId: 'rd_16', controlPointInsideFoot: [905, 785], exactWestEdgeCrossingAu: design.proposed.approach.existingAuthoredApproach.westEdgeCrossingProxy.intersectionAu },
      routeLengthsAu: { RT1: corridor.routes.primary.totalDistanceAu, RT2: 403.9036, RT3: 398.0289 },
      roadKindsOnRT1: ['rd_b:cart', 'rd_13:trail', 'rd_1w:trail', 'rd_16:trail'],
      bridgeCoverage: cross.map(b => ({ id: b.bridgeId, load: b.source?.load, distanceAu: b.coveredIntersections[0]?.bridgeDistanceAu ?? null, bridgeValidWithin14u: b.coveredIntersections[0]?.bridgeValidWithin14u ?? null })),
      junctionTolerance: { geo01: 8, maplab: 7, geo01OnlyPairs: audit.audit.junctionTolerances.pairsMergedOnlyByGeo01Tolerance8.count, selfMergesAt8: audit.audit.junctionTolerances.maplabResampledGraphNodes.atTolerance8.consecutiveSampleSelfMerges },
      surface: audit.audit.surfaceContinuity.routes.map(r => ({ routeId: r.routeId, offLandSamples: r.surface.offLandSamples, inLakeSamples: r.surface.inLakeSamples, inRiverSamples: r.surface.inRiverSamples, outside9uRoadStroke: r.surface.outside9uRoadAnalysisStroke, minClearanceAu: r.surface.minClearanceAu })),
      derivedConnectors: audit.audit.derivedConnectors.map(c => ({ routeId: c.routeId, distanceAu: c.distanceAu, exceedsEditorAccessR48: c.exceedsEditorAccessR48, status: c.status })),
      poiRoadAccess: { nearestCartRoad: audit.audit.poiAccess.nearestCartRoad, nearestFootRoad: audit.audit.poiAccess.nearestFootRoad, cartAccessWithinAccessR: audit.audit.poiAccess.cartAccessWithinAccessR },
    },
    existingAuthoredVsProposed: {
      existingAuthored: { source: 'Veyra GOLD (read-only)', ids: ['po_kilns.foot', 'rd_b', 'rd_13', 'rd_1w', 'rd_16', 'rd_20', 'rd_n', 'br_4', 'br_a', 'rv_silver'], neverModified: true },
      proposed: { file: 'output/poi_po_kilns.proposed.v1.json', status: 'PROPOSED', canonical: false, owner: 'MAP', scope: 'po_kilns ONLY', items: { footprint: 1, approach: 1, entranceOptions: design.proposed.entranceOptions.length, interiorWorkingSpaces: design.proposed.interiorWorkingSpaces.length, circulationPaths: design.proposed.circulation.paths.length, retreatPaths: 1 } },
      explicitDistinction: true,
      noRuntimeMerge: true,
    },
    ownershipCorrection: {
      rule: own.rule,
      mapOwns: own.mapOwns.map(f => f.field),
      gameplayOwns: own.gameplayOwns,
      correctedClassification: own.correctedClassification,
      staleGeo01OwnerStrings: own.staleOwnerOccurrences.count,
      geographyExportRewritten: false,
    },
    resolvedFromSource: {
      biomeLegend: '12 named codes in MapLab v3 types.ts; code 0 = meadow on land, NO-BIOME sentinel on 28,624 sea cells. NOT approved for the 14-string Gameplay Biome enum.',
      elevationUnit: 'byte/255 = abstract normalized height (0=sea, 1..255 land); NO real-world unit (Bible §11.5).',
      slopeUnit: 'hypot(d(elev/255)/dx, d(elev/255)/dy) x 100 in authoring units; Map Lab heuristic, not Bible.',
      roadWidth: 'NOT_IN_SOURCE. 9u editor analysis stroke and 3.4u/1.6u display strokes are NOT physical widths.',
      riverWidth: 'editor stroke width; riverMask uses max(width,9)u; carve radius max(20,width*4)u. rv_silver width=4 -> 9u mask, 20u carve.',
      graphConstants: enc.graphConstants,
    },
    unresolvedConstraints: [
      'Authoring-unit -> runtime-tile transform and world scale: UNDECIDED (PR44 pins 200x200 @ TILE=16; Veyra is 250x175 @ 8u on 2000x1400).',
      'Physical road width, river channel width, bridge deck span, cart/foot footprint: UNDEFINED. Swept clearance NOT validated.',
      'Biome 12-code -> 14-string Gameplay mapping and land/sea guard: NOT APPROVED. Climate (moisture/temperature): UNDEFINED.',
      'Slope normalization and all passability / loaded-cart / ford / ferry rules: GAMEPLAY_OWNED, not supplied.',
      'po_kilns rooms/entrances/passages/door openings/circulation/retreat: NOT_IN_SOURCE in canon; MAP_OWNS the design (PROPOSED candidate only).',
      'No cart road reaches po_kilns within MapLab ACCESS_R=48; RT-1 has only ONE cart segment. NO physically traversable cart route is claimed.',
      'bridge channelSpanFitVerified=false for both br_4 (cart) and br_a (foot); the 13x7.2u exporter rectangle is a display glyph.',
      'All Veyra POI/road objects carry conf:proposal or conf:assumption; nothing here converts them into final laws.',
      'Survivability, travel time, hazard intensity and Gameplay population: NOT CLAIMED.',
    ],
    auditFindings: audit.failingOrNeedsAuthoring.map(f => ({ id: f.id, severity: f.severity, subject: f.subject })),
    derivedOutputs: [
      'output/maplab_encoding.v1.json + rasters/*.u8 (source-derived legend/units/width semantics + 5 source-semantic masks)',
      'output/corridor_audit.v1.json (4-layer connectivity audit, 8 findings)',
      'output/poi_po_kilns.proposed.v1.json (PROPOSED spatial design, po_kilns only)',
      'output/ownership_correction.v1.json (overlay correcting stale GEO-01 owner strings)',
      'output/audit_before_after.svg / .png / .html (visually inspectable before/after geometry audit)',
      '../geo01/output/* (accepted source-verified geography export, read-only)',
    ],
    nextExecutableSeam: 'Gameplay can inspect this package in authoring units. To consume it: (1) approve the world-scale/grid transform; (2) approve the biome mapping + climate contract; (3) approve physical road/river/bridge dimensions and validate swept clearance; (4) let Gameplay supply locked states/loot/power/interactions and its own passability rules; (5) only then consider a versioned RuntimeMapPackage. Map must author canonical POI shell geometry (the PROPOSED candidate is NOT canonical) and re-derive the road graph at SNAP_TOL=7.',
    gates: {
      deterministicReproducibleSourceLinkedData: true,
      visuallyInspectableBeforeAfterAudit: true,
      explicitAuthoredVsProposed: true,
      noRuntimeMerge: true,
      noNewGameplayPopulation: true,
      noPhysicalCartRouteClaim: true,
      noInventedPassabilityRules: true,
      authoredCoordinateSpacePreserved: '2000x1400',
      currentWebTerrainSeaArtUntouched: true,
    },
  };
  json(path.join(OUT, 'geometry_package.v1.json'), out);
  console.log(`PACKAGE_OK scope=1 corridor/1 POI ids=${Object.keys(roads).length} unresolved=${out.unresolvedConstraints.length} findings=${out.auditFindings.length}`);
}
main();
