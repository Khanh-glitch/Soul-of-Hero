// MAP-LR02 M3b — versioned, source-linked REGION static geometry export.
// Answers PR44 6620503177: other candidate-region cellIndices + per-region
// static geometry, WITHOUT inventing roof/canopy polygons or substituting
// landmarks. M1/M2 remain the single source of truth; this is a derived view.
import path from 'node:path';
import { OUT, CONST, loadLr01, loadSources, writeRevisionPackage, sourceHeader, readJson, sha256, r4 } from './lib/lr02.mjs';

const lr = loadLr01();
const src = loadSources();
const pg = readJson(path.join(OUT, 'portal_geometry.v1.json'));
const se = readJson(path.join(OUT, 'spawn_eligibility.v1.json'));
const wa = readJson(path.join(OUT, 'world_architecture.v1.json'));
const layouts = lr.layouts.layouts;

const poiByIndex = new Map(pg.pois.map((p, i) => [p.poiId, i]));
const sha = o => sha256(Buffer.from(JSON.stringify(o)));

// Candidate region cell indices: M2 IS the versioned source-linked export.
const candidateRegionCellIndicesExport = {
  status: 'PROVIDED_BY_M2__NO_DUPLICATE_SOURCE_OF_TRUTH',
  file: 'world_lab/lr02/output/spawn_eligibility.v1.json',
  schema: se.schema, revision: se.revision, revisionDigest: se.revisionDigest,
  jsonPointer: '$.candidateRegions[*].geometry.cellIndices',
  regionCount: se.candidateRegions.length,
  totalCells: se.coverage.staticallyEligibleCells,
  regions: se.candidateRegions.map(r => ({
    candidateId: r.candidateId, cellCount: r.geometry.cellCount,
    cellIndicesDigest: sha(r.geometry.cellIndices), bboxAu: r.geometry.bboxAu,
    landmassIds: r.parentGeographicIds.landmassIds, zoneIds: r.parentGeographicIds.zoneIds,
    status: r.status,
  })),
  note: 'Gameplay requested a versioned source-linked export of the other region cellIndices in PR44 6620503177. The full arrays live ONLY in spawn_eligibility.v1.json at the pinned digest; this index gives per-region digests for drift detection. No landmarks are substituted.',
};

// Per-region static geometry: a DERIVED consumer view of M1 (authority by digest).
function regionGeometry(region) {
  const windowAu = region.windowAu;
  const poiIds = region.poiGeometry?.map(p => p.poiId) ?? [];
  const pois = poiIds.map(id => {
    const i = poiByIndex.get(id);
    const p = i === undefined ? null : pg.pois[i];
    if (!p) return { poiId: id, status: 'MISSING_FROM_M1' };
    const layout = layouts.find(l => l.poiId === id);
    const roofs = layout?.rooms?.map(r0 => ({
      roomId: r0.id, levelId: r0.levelId, covered: r0.roof?.covered ?? null,
      coverageFractionOfRoom: r0.roof?.coverageFractionOfRoom ?? null,
      canopyOnly: r0.roof?.canopyOnly ?? null, roofStatus: r0.roof?.status ?? null,
      note: r0.roof?.note ?? null,
    })) ?? [];
    return {
      poiId: id, arche: p.arche, enclosurePolicy: p.policy.id, verdict: p.verdict,
      m1Pointer: `$.pois[${i}]`, m1PoiGeometryDigest: sha(p),
      parentIds: p.parentIds, idMapping: p.idMapping,
      staticSolids: p.staticSolids, staticOpenings: p.staticOpenings,
      nonSolidBoundary: p.openBoundary,
      collisionAdapter: p.collisionAdapter, losAdapter: p.losAdapter,
      circulation: { physicallyReachableRoomCount: p.circulation.physicallyReachableRoomCount, groundRoomCount: p.circulation.groundRoomCount, graphOnlyRooms: p.circulation.graphOnlyRooms },
      roofCoverage: p.roofCoverage,
      roofDescriptors: roofs,
      roofPolygons: [],
      roofPolygonStatus: 'UNRESOLVED__NO_AUTHORED_ROOF_POLYGONS_IN_LR01',
      roofPolygonNote: 'LR01 records roof coverage as a DESCRIPTOR (coverageFractionOfRoom, canopyOnly, status PROPOSED), not a polygon. Map does NOT invent canopy coverage or substitute a landmark/polygon. An actual canopy polygon would require a separately PROPOSED geometry with an explicit source basis.',
      status: 'DERIVED_CONSUMER_VIEW__AUTHORITY_IS_M1',
    };
  });
  return {
    regionId: region.id, kind: region.kind, label: region.label,
    windowAu, sourceRef: region.sourceRef,
    candidateRegionIds: se.candidateRegions.filter(r => r.geometry.bboxAu[0] <= windowAu[2] && r.geometry.bboxAu[2] >= windowAu[0] && r.geometry.bboxAu[1] <= windowAu[3] && r.geometry.bboxAu[3] >= windowAu[1]).map(r => r.candidateId),
    poiCount: pois.length, pois,
    proposedGeometries: region.proposedGeometries,
    physicalIssues: region.physicalIssues,
    authority: { file: 'world_lab/lr02/output/portal_geometry.v1.json', revisionDigest: pg.revisionDigest },
    status: 'DERIVED_REGION_STATIC_GEOMETRY__ROOFS_UNRESOLVED',
  };
}

const greywaterRegion = {
  id: 'greywater_bounded.v1', kind: 'GREYWATER_DIAGNOSTIC', label: 'Bounded Greywater physical region (M0)',
  windowAu: [680, 550, 900, 660], sourceRef: 'world_lab/lr02/output/greywater_spatial_patch.v1.json',
  poiGeometry: [{ poiId: 'po_greywater', arche: 'village', verdict: 'VERIFIED', staticSolids: 15, staticOpenings: 8, exceptions: 0 }],
  proposedGeometries: [], physicalIssues: [],
};

const regions = [greywaterRegion, ...wa.representativeRegions.regions].map(regionGeometry);

const body = {
  schema: 'soh.map.lr02.region_static_geometry.v1',
  version: 1, revision: 1,
  generatedBy: 'world_lab/lr02/src/m3b_regions.mjs',
  authority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  status: 'DERIVED_CONSUMER_EXPORT__NOT_A_SECOND_SOURCE_OF_TRUTH',
  parent: { ...sourceHeader().parent, layoutFile: 'world_lab/lr01/output/poi_layouts.v1.json' },
  source: { ...sourceHeader(), canonSha256: src.V.fingerprint.sha256, portalGeometryDigest: pg.revisionDigest, spawnEligibilityDigest: se.revisionDigest, worldArchitectureDigest: wa.revisionDigest },
  frame: { authoring: CONST.frame, unit: 'authoring_unit', transformStatus: 'UNDECIDED' },
  respondsTo: { pr44Comment: 6620503177, request: 'versioned source-linked export of the other candidate-region cellIndices + future region-specific static geometry/roof polygons; do not substitute landmarks or invent canopy coverage', answer: 'cellIndices export provided by pinned M2 package; per-region static geometry provided as a derived view of pinned M1; roof polygons explicitly UNRESOLVED because LR01 has no authored roof polygon.' },
  candidateRegionCellIndicesExport,
  regionCount: regions.length,
  regionKinds: [...new Set(regions.map(r => r.kind))],
  totalPoiGeometryRecords: regions.reduce((s, r) => s + r.poiCount, 0),
  totalStaticSolids: regions.reduce((s, r) => s + r.pois.reduce((a, p) => a + (p.staticSolids?.length ?? 0), 0), 0),
  totalStaticOpenings: regions.reduce((s, r) => s + r.pois.reduce((a, p) => a + (p.staticOpenings?.length ?? 0), 0), 0),
  roofPolygonPolicy: 'NO invented canopy. LR01 roof coverage is a descriptor only. Room polygons are NOT roof polygons.',
  regions,
  noClaims: [
    'NO invented roof/canopy polygon', 'NO landmark substituted for geometry',
    'NO second source of truth (M1/M2 digests are authoritative)',
    'NO runtime collision, dynamic door, lock, power or destruction',
    'NO approved scale, no playable Veyra, no creator approval',
  ],
};

const digest = writeRevisionPackage(path.join(OUT, 'region_static_geometry.v1.json'), body);
console.log(`M3B_REGION_STATIC_OK regions=${regions.length} kinds=${body.regionKinds.join(',')} poiRecords=${body.totalPoiGeometryRecords} solids=${body.totalStaticSolids} openings=${body.totalStaticOpenings}`);
console.log(`  cellIndicesExport=${candidateRegionCellIndicesExport.file} digest=${se.revisionDigest} regions=${candidateRegionCellIndicesExport.regionCount}`);
console.log(`  roofPolygons=0 (UNRESOLVED, no invented canopy) revisionDigest=${digest}`);
