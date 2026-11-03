#!/usr/bin/env node
// MAP-LR01 Milestone A — corrected per-POI scale benchmark.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVeyra, loadGeoInputs, writeJson, r4, ROOT } from './lib/veyra.mjs';
import {
  CANDIDATE_U, FOCUS_U, OPEN_AIR_ARCHES, ENCLOSED_ARCHES, poiGeometry, poiFit,
  aggregateFit, transformProfile, featureQuantization, travelAt, memoryAt, loadScale01a,
} from './lib/scale.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.LR01_OUT ? path.resolve(process.env.LR01_OUT) : path.resolve(HERE, '../output');
fs.mkdirSync(OUT, { recursive: true });

const V = loadVeyra();
const GEO = loadGeoInputs();
const S01 = loadScale01a();
const geoms = V.P.pois.map(poiGeometry);

const byU = [];
for (const U of CANDIDATE_U) {
  const fits = geoms.map(g => poiFit(g, U));
  const agg = aggregateFit(geoms, fits, U);
  const transform = transformProfile(U);
  const quantization = featureQuantization(U);
  const travel = travelAt(U, S01);
  const memory = memoryAt(U);
  const enclosedRate = agg.enclosedCount ? r4(agg.enclosedWithRoomAndEntrance / agg.enclosedCount) : null;
  const openRate = agg.openAirCount ? r4(agg.openAirWithYard / agg.openAirCount) : null;
  byU.push({
    U, focusBand: FOCUS_U.includes(U),
    status: 'BOUNDED_DIAGNOSTIC_PROFILE__NOT_APPROVED',
    transform, perPoi: agg, quantization, travel, memory,
    physicalFit: {
      enclosedFitRate: enclosedRate, openAirFitRate: openRate,
      allEnclosedFit: agg.enclosedFail === 0, allOpenAirFit: agg.openAirFail === 0,
      entranceCapacityNeverZero: agg.entranceCapacityZeroOpenTiles === 0,
      entranceCapacityCaveat: agg.entranceCapacityStatus,
      proposedEntranceOpenTiles: fits[0].proposedEntranceOpenTiles,
      proposedEntranceLost: fits[0].proposedEntranceOpenTiles === 0,
      note: 'Rates are computed ONLY over the relevant enclosure class, using each POI\'s own quad/deep polygon/edges. The 3.696 au PROPOSED entrance is a separate worked example: at U>=3.696 it quantizes to ZERO open tiles.',
    },
    resolution: {
      sourceRasterUpsampleFactor: r4((8 / U) ** 2), tilesPerSourceCellAxis: r4(8 / U),
      newAuthoredDetail: 'NONE: Veyra raster is 8 au/cell. U<8 duplicates/interpolates; U>8 loses authored cells.',
      fractionalRasterCellsRequiringResampling: transform.raster.fractionalSourceCellsRequiringResampling,
      runtimeTileStraddles: transform.raster.runtimeTileColumnsRowsStraddlingSourceCellBoundary,
    },
    uncertainty: [
      'Enclosure class is a DERIVED heuristic from canonical depth/deep/gate/arche fields, not a canonical field.',
      'Wall thickness = 1 runtime tile and room requirement = 5x4 tiles are assumptions anchored to PR44 smallest authored building; not approved Veyra dimensions.',
      'Entrance capacity is bounded by each POI\'s own shortest foot edge; canonical Veyra authors NO door openings.',
      'WW=WH=200, TILE=16, validateEconomyMap 1,000,000-cell cap and render.ts chunk key stride 100 are TEMPORARY engine constants (Gameplay ACK 6608030530), NOT permanent design laws.',
      'No streaming/LOD implementation was found in PR44 HEAD; chunk culling is not world streaming.',
      'Loaded-cart times are modelled on the foot route; RT-1 contains kind=trail segments and is NOT cart-passable.',
    ],
  });
}

// Bounded band: physical fit is a continuous function of U, not a single magic integer.
const passing = byU.filter(p => p.physicalFit.allEnclosedFit && p.physicalFit.allOpenAirFit && p.physicalFit.entranceCapacityNeverZero && !p.physicalFit.proposedEntranceLost);
const band = passing.length ? { min: Math.min(...passing.map(p => p.U)), max: Math.max(...passing.map(p => p.U)), members: passing.map(p => p.U) } : null;
const defect = {
  id: 'SCALE01A-PER-POI-DEFECT',
  priorRule: 'poiFeetUnableToHostSmallestRoom used F.poiFoot.minEdgeAu (GLOBAL 11 au) for all 81 POIs plus a flat area threshold; reported 81/81 failures at U=4 and U=8.',
  correction: 'Each POI now measured with its own quad OBB, own edge lengths and own deep polygon; enclosure class separates open-air yards from enclosed rooms; only enclosed POIs are tested for a room.',
  priorCounts: Object.fromEntries([2, 4, 8].map(U => [U, S01.benchmark.candidates.find(c => c.u === U).spatial.poiFeetUnableToHostSmallestRoom])),
  correctedCounts: Object.fromEntries([2, 4, 8].map(U => [U, byU.find(p => p.U === U).perPoi.poiFeetUnableToHostSmallestRoom_CORRECTED])),
  enclosedPoICount: byU[0].perPoi.enclosedCount,
  openAirPoiCount: byU[0].perPoi.openAirCount,
  unresolvedPoiCount: byU[0].perPoi.unresolvedCount,
  note: 'The corrected count is NOT directly comparable to 81/81 because the population and the rule both changed. It is a per-POI measurement, not a global multiplication.',
};

const doc = {
  schema: 'soh.map.lr01.scale_corrected.v1',
  status: 'MILESTONE_A__CORRECTED_SCALE_METHODOLOGY__RUNTIME_SCALE_STILL_UNDECIDED',
  authority: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
  creatorRule: 'Full 2000x1400 authoring frame UNCHANGED. No rescale/crop/warp of canon. Transform metadata explicit; no premature runtime tile binding.',
  source: {
    veyra: V.fingerprint, geo01: GEO.fingerprints.geography, geo01Corridor: GEO.fingerprints.corridor,
    geo02Encoding: GEO.fingerprints.encoding, geo02Audit: GEO.fingerprints.audit,
    scale01aBenchmark: 'world_lab/scale01a/output/benchmark.v1.json @ 9e0f0805',
    gameplayAck: 'PR44 issue comment 6608030530 @ 0b2ba508 (two-stage geography/population; temporary engine constants)',
  },
  defectCorrection: defect,
  candidateU: CANDIDATE_U, focusBandU: FOCUS_U,
  boundedBand: band,
  boundedBandStatement: band
    ? `Physical-fit evidence supports a BOUNDED BAND U in [${band.min}, ${band.max}] among the tested candidates, not a single approved integer. U=2 is one member, NOT canonized. Fractional U within the band has explicit raster-coverage costs measured below.`
    : 'No tested U satisfies all physical-fit gates; see per-U profiles.',
  profiles: byU,
  frame: { authoring: [2000, 1400], sourceGrid: { gw: 250, gh: 175, cell: 8, cells: 43750 }, transformStatus: 'UNDECIDED' },
  noClaims: ['NO approved scale', 'NO canon edit', 'NO runtime merge', 'NO fabricated travel time', 'NO cart-passable trail', 'NO playable integration'],
};
writeJson(path.join(OUT, 'scale_corrected.v1.json'), doc);

// Flat machine-readable per-POI table for reuse by later milestones.
writeJson(path.join(OUT, 'poi_geometry.v1.json'), {
  schema: 'soh.map.lr01.poi_geometry.v1',
  status: 'SOURCE_AUTHORED_GEOMETRY_PLUS_DERIVED_CLASSIFICATION',
  sourceSha256: V.fingerprint.sha256,
  classification: { openAirArches: [...OPEN_AIR_ARCHES], enclosedArches: [...ENCLOSED_ARCHES] },
  pois: geoms,
});
console.log(`A_SCALE_OK pois=${geoms.length} candidates=${byU.length} band=${band ? `[${band.min},${band.max}]` : 'NONE'} enclosed=${defect.enclosedPoICount} openAir=${defect.openAirPoiCount} unresolved=${defect.unresolvedPoiCount}`);
for (const p of byU) console.log(`  U=${p.U} enclosedFit=${p.perPoi.enclosedWithRoomAndEntrance}/${p.perPoi.enclosedCount} openYard=${p.perPoi.openAirWithYard}/${p.perPoi.openAirCount} entrance0=${p.perPoi.entranceCapacityZeroOpenTiles} fractional=${p.transform.fractionalEdge} resampleCells=${p.transform.raster.fractionalSourceCellsRequiringResampling} straddles=${p.transform.raster.runtimeTileColumnsRowsStraddlingSourceCellBoundary} memMB=${p.memory.totalMBLowerBound} rt1route=${p.travel.rt1.geographicRouteSeconds}s`);
