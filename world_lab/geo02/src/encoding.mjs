#!/usr/bin/env node
// MAP-GEO-02 step 1: resolve Veyra's biome legend, elevation unit and
// road/river width semantics from the ACTUAL Map Lab Studio v3 source that
// wrote the canonical arrays. Writes a source-linked semantic encoding layer
// plus source-faithful geometry masks. No legend is inferred from appearance.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadMapLabSource, sha256 } from './lib/maplab_source.mjs';
import { landMask, lakeMask, riverMask, roadFootMask, roadCartMask } from './lib/maplab.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'output');
const RAS = path.join(OUT, 'rasters');
const CANON = { commit: '19d8c6ec820f324a6ac12733165e43b5e2c6eab2', path: 'map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json' };
const sha = b => createHash('sha256').update(b).digest('hex');
const json = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');

function main() {
  fs.mkdirSync(RAS, { recursive: true });
  const raw = Buffer.from(execFileSync('git', ['show', `${CANON.commit}:${CANON.path}`],
    { cwd: path.resolve(ROOT, '../..'), maxBuffer: 32 * 1024 * 1024 }));
  const doc = JSON.parse(raw.toString('utf8'));
  if (doc.format !== 'soh-maplab' || doc.version !== 1) throw new Error('unexpected Veyra source format');
  const p = doc.project;
  const t = p.terrain;
  const elev = Uint8Array.from(Buffer.from(t.elev, 'base64'));
  const biome = Uint8Array.from(Buffer.from(t.biome, 'base64'));
  if (elev.length !== t.gw * t.gh || biome.length !== t.gw * t.gh) throw new Error('terrain array length mismatch');

  const src = loadMapLabSource();
  const S = src.semantics;

  // ---- biome legend: source-derived, split by land/sea sentinel ----
  const landBiomeCounts = new Array(12).fill(0), seaBiomeCounts = new Array(12).fill(0);
  for (let k = 0; k < biome.length; k++) (elev[k] > 0 ? landBiomeCounts : seaBiomeCounts)[biome[k]]++;
  const BIOME_LEGEND = S.BIOMES.map(b => ({
    code: b.id, key: b.key, name: b.name, sourceColor: b.color,
    landCells: landBiomeCounts[b.id], seaCells: seaBiomeCounts[b.id],
    landMeaning: b.name,
    seaMeaning: b.id === 0
      ? 'SEA SENTINEL / no biome (generateTerrain forces biome=0 outside the land mask); code 0 is NOT necessarily "meadow" on water'
      : `${b.name} (stored on a sea cell; source does not assign a separate water code)`,
    sourceRef: 'source_excerpt/types.ts :: BIOMES[]',
  }));

  // ---- elevation units ----
  let emin = 255, emax = 0; const elevBytes = {};
  for (const v of elev) { emin = Math.min(emin, v); emax = Math.max(emax, v); elevBytes[v] = (elevBytes[v] || 0) + 1; }
  const ELEVATION = {
    byteEncoding: S.SERIALIZATION,
    scalar: S.ELEV,
    rawRange: [emin, emax], byteDistinct: Object.keys(elevBytes).length,
    seaCells: seaBiomeCounts.reduce((a, b) => a + b, 0),
    landCells: landBiomeCounts.reduce((a, b) => a + b, 0),
    derivedScalar: { min: +(emin / 255).toFixed(6), max: +(emax / 255).toFixed(6) },
    physicalUnit: 'UNDEFINED__ABSTRACT_NORMALIZED_HEIGHT_ONLY',
    status: 'RESOLVED_FROM_SOURCE__NO_APPROVED_WORLD_SCALE',
  };
  const SLOPE_INFO = { ...S.SLOPE, thresholds: S.RULES, biomeCostMultipliers: { FOOT_B: S.FOOT_B, CART_B: S.CART_B }, badBuildBiomeCodes: S.BAD_BUILD,
    authority: 'MAPLAB_EDITOR_HEURISTIC__NOT_GAMEPLAY_PASSABILITY_LAW' };

  // ---- width semantics ----
  const WIDTHS = {
    rivers: p.rivers.map(r => ({
      id: r.id, name: r.name, kind: r.kind, widthAu: r.width,
      authoredWidthSemantics: 'editor stroke width in abstract authoring units (types.ts River.width)',
      maskStrokeAu: Math.max(r.width, S.RIVER.maskMinAu),
      carveRadiusAu: r.kind === 'canal' ? S.RIVER.carveCanalAu : Math.max(S.RIVER.carveMinAu, r.width * S.RIVER.carveWidthFactor),
      fordWidthHeuristic: r.kind !== 'canal' && r.width <= S.RIVER.fordWidthThresholdAu,
      physicalChannelWidth: 'UNDEFINED__NOT_AUTHORED',
    })),
    roads: {
      authoredWidthField: 'NOT_IN_SOURCE (types.ts Road has no width field)',
      analysisStrokeAu: S.ROAD_RASTER.lineWidthAu,
      analysisNote: S.ROAD_RASTER.note,
      displayStrokesAu: S.DISPLAY_ONLY.roadSvgStrokeAu,
      displayNote: S.DISPLAY_ONLY.roadSvgNote,
      bridgeDisplayGlyphAu: S.DISPLAY_ONLY.bridgeGlyphAu,
      bridgeDisplayNote: S.DISPLAY_ONLY.bridgeGlyphNote,
      physicalRoadWidth: 'UNDEFINED__NOT_AUTHORED',
      sweptClearance: 'UNVALIDATED__NO_CART_OR_FOOT_FOOTPRINT_DIMENSION_EXISTS_IN_SOURCE',
    },
  };

  // ---- source-faithful masks (MapLab semantics, analytic cell-centre reproduction) ----
  const masks = {
    landMaplab: landMask(p), lakeMaplab: lakeMask(p), riverMaplab: riverMask(p, S.RIVER.maskMinAu),
    roadFootMaplab: roadFootMask(p, S.ROAD_RASTER.lineWidthAu),
    roadCartMaplab: roadCartMask(p, S.ROAD_RASTER.lineWidthAu),
  };
  const manifest = {
    schema: 'soh.map.geo02.raster_manifest.v1', generatedBy: 'world_lab/geo02/src/encoding.mjs',
    method: 'analytic cell-centre reproduction of terrain.ts maskFromDraw() / analysis.ts rasterRoads(); canvas antialiasing may differ by <=1 boundary cell',
    grid: { gw: t.gw, gh: t.gh, cell: t.cell, cells: t.gw * t.gh },
    authoringSpace: [p.world.w, p.world.h],
    files: {},
  };
  for (const [name, arr] of Object.entries(masks)) {
    const file = `${name}.u8`, buf = Buffer.from(arr);
    fs.writeFileSync(path.join(RAS, file), buf);
    manifest.files[file] = { bytes: buf.length, sha256: sha(buf), cellCount: arr.reduce((a, b) => a + b, 0), semantics: name };
  }
  json(path.join(RAS, 'manifest.v1.json'), manifest);

  const out = {
    schema: 'soh.map.geo02.maplab_encoding.v1',
    generatedBy: 'world_lab/geo02/src/encoding.mjs',
    authority: 'SOURCE_DERIVED_ENCODING__NOT_A_GAMEPLAY_APPROVED_MAPPING',
    statement: 'Veyra GOLD stores raw uint8 arrays. The legend, normalized height unit and width semantics below come from the pinned Map Lab Studio v3 reference source that wrote those arrays, NOT from the appearance of the map, NOT from the canonical JSON, and NOT from invented values.',
    sourceEvidence: {
      veyra: { branch: 'map/veyra-gold-asset-canon-20261102', commit: CANON.commit, path: CANON.path, bytes: raw.length, sha256: sha256(raw) },
      maplab: { ...src.provenance, excerptVerification: src.verification, zipChain: src.zipChain },
      generationLink: '04_map_studio_default_seed.sohmap.json in the input package has byte-identical terrain.elev / terrain.biome / gw / gh / cell / seed and identical object arrays to Veyra GOLD; only project.name and project.meta differ. Verified by zipChain when git objects are available.',
    },
    biomeLegend: BIOME_LEGEND,
    biomeLegendResolution: {
      previousGeo01Status: 'NO_LEGEND_COMMITTED_IN_CANONICAL_JSON (true for the JSON, incomplete for the project)',
      currentStatus: 'LEGEND_FOUND_IN_MAPLAB_V3_REFERENCE_SOURCE; NOT_EMBEDDED_IN_CANONICAL_JSON; NOT_APPROVED_FOR_THE_14_STRING_GAMEPLAY_BIOME_ENUM',
      neverInferredFromAppearance: true,
      remainingBlocker: 'Gameplay must approve a 12-code -> 14-string mapping (or add an UNKNOWN member) and a verified grid transform.',
      seaCodeZeroCaveat: 'Code 0 on land = meadow; code 0 on sea = "no biome" sentinel. A flat code->Biome table without a land/sea guard would mislabel 28,624 sea cells as meadow.',
    },
    elevation: ELEVATION,
    slope: SLOPE_INFO,
    graphConstants: S.GRAPH,
    widthSemantics: WIDTHS,
    serialization: S.SERIALIZATION,
    smelterArchetypeLibraryDefault: S.ARCHETYPE,
    rasters: { manifest: 'rasters/manifest.v1.json', files: Object.keys(manifest.files) },
    explicitlyNotSupplied: ['moisture', 'temperature', 'physical road width', 'physical river channel width', 'cart/foot swept clearance envelope', 'authoring-unit -> runtime-tile transform', 'any Gameplay passability law'],
  };
  json(path.join(OUT, 'maplab_encoding.v1.json'), out);
  console.log(`ENCODING_OK legend=${BIOME_LEGEND.length} codes landCells=${ELEVATION.landCells} seaCells=${ELEVATION.seaCells} elevRaw=${emin}..${emax} graphSNAP_TOL=${S.GRAPH.SNAP_TOL} roadStroke=${S.ROAD_RASTER.lineWidthAu} riverMaskMin=${S.RIVER.maskMinAu} zipChain=${src.zipChain.status}`);
  console.log(`  output/maplab_encoding.v1.json ${fs.statSync(path.join(OUT, 'maplab_encoding.v1.json')).size} bytes; rasters=${Object.keys(masks).length}`);
}
main();
