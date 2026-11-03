#!/usr/bin/env node
// MAP-GEO-02: determinism, source linkage, ownership separation and
// no-invention gates. Fails loudly; never "passes" by inventing values.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readExcerpts, loadMapLabSource } from './lib/maplab_source.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'output');
const GEO01 = path.resolve(ROOT, '../geo01/output');
const sha = b => createHash('sha256').update(b).digest('hex');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
let n = 0;
const ok = (cond, name) => { n++; if (!cond) throw new Error(`FAIL: ${name}`); console.log(`PASS ${name}`); };

function main() {
  // ---- 1 source custody -------------------------------------------------
  const { verification } = readExcerpts();
  ok(Object.values(verification).every(v => v.verified === 'MATCH'), 'all 8 pinned MapLab source excerpts hash MATCH');
  const src = loadMapLabSource();
  ok(['VERIFIED', 'NOT_AVAILABLE_LOCALLY'].includes(src.zipChain.status), `git/ZIP custody chain ${src.zipChain.status}`);
  ok(src.semantics.BIOMES.length === 12 && src.semantics.BIOMES[11].key === 'beach', 'BIOMES legend parsed from source (12 codes, code 11 = beach)');
  ok(src.semantics.GRAPH.SNAP_TOL === 7 && src.semantics.GRAPH.ACCESS_R === 48 && src.semantics.GRAPH.BRIDGE_R === 22, 'graph constants parsed: SNAP_TOL=7 ACCESS_R=48 BRIDGE_R=22');
  ok(src.semantics.ROAD_RASTER.lineWidthAu === 9 && src.semantics.RIVER.maskMinAu === 9, 'road/river 9u editor strokes parsed');

  // ---- 2 encoding -------------------------------------------------------
  const enc = read(path.join(OUT, 'maplab_encoding.v1.json'));
  ok(enc.biomeLegend.length === 12 && enc.biomeLegend[0].key === 'meadow', 'biome legend resolved to 12 named codes');
  ok(enc.biomeLegendResolution.neverInferredFromAppearance === true, 'legend NEVER inferred from appearance');
  ok(enc.biomeLegend[0].seaCells === 28624 && /SENTINEL/.test(enc.biomeLegend[0].seaMeaning), 'code-0 sea sentinel caveat recorded');
  ok(enc.elevation.scalar.byteToScalar.includes('/ 255') && enc.elevation.physicalUnit.includes('UNDEFINED'), 'elevation unit = byte/255 abstract normalized height, no invented metres');
  ok(enc.widthSemantics.roads.authoredWidthField.includes('NOT_IN_SOURCE') && enc.widthSemantics.roads.physicalRoadWidth.includes('UNDEFINED'), 'road width stays NOT_IN_SOURCE / UNDEFINED');
  ok(enc.widthSemantics.roads.displayStrokesAu.cart === 3.4 && enc.widthSemantics.roads.analysisStrokeAu === 9, 'display vs analysis strokes are distinguished');
  ok(enc.widthSemantics.roads.sweptClearance.includes('UNVALIDATED'), 'swept clearance is UNVALIDATED');
  ok(enc.slope.authority.includes('NOT_GAMEPLAY_PASSABILITY_LAW'), 'MapLab slope heuristics are NOT Gameplay law');
  const man = read(path.join(OUT, 'rasters/manifest.v1.json'));
  ok(Object.keys(man.files).length === 5 && Object.values(man.files).every(f => f.bytes === 43750), '5 source-semantic 43,750-cell masks with manifest');

  // ---- 3 ownership correction ------------------------------------------
  const own = read(path.join(OUT, 'ownership_correction.v1.json'));
  ok(own.correctedClassification === 'MAP_RESPONSIBILITY_NOT_IN_SOURCE', 'ownership correction uses MAP_RESPONSIBILITY_NOT_IN_SOURCE');
  ok(own.mapOwns.some(f => f.field === 'pois[].doorOpenings') && own.gameplayOwns.includes('pois[].doors.lockedState'), 'door OPENINGS Map-owned; LOCKED STATE Gameplay-owned');
  ok(own.staleOwnerOccurrences.count === 243 && own.noCanonicalRewrite === true, '243 stale GEO-01 owner strings superseded by overlay, no canonical rewrite');
  ok(own.sourceInputs.geographyExport.sha256 === sha(fs.readFileSync(path.join(GEO01, 'geography.v1.json'))), 'accepted geography.v1.json is byte-for-byte unchanged');
  const contract = read(path.join(GEO01, 'contract_boundary.v1.json'));
  const mapRows = contract.fields.filter(f => f.classification === 'MAP_RESPONSIBILITY_NOT_IN_SOURCE');
  ok(mapRows.length === 7 && mapRows.every(f => /Map/.test(f.owner) && !/Gameplay/.test(f.owner)), 'contract_boundary.v1.json has 7 Map-owned NOT_IN_SOURCE rows');
  ok(contract.ownershipCorrection && contract.twoStageIntegrationSeam.stage1b.includes('Map'), 'contract carries explicit ownershipCorrection + Map stage1b');

  // ---- 4 corridor audit -------------------------------------------------
  const a = read(path.join(OUT, 'corridor_audit.v1.json'));
  const layers = a.connectivityLayers;
  ok(['SOURCE_AUTHORED', 'DERIVED_ROAD_GRAPH', 'RASTER_CANDIDATE', 'PHYSICAL_CLEARANCE'].every(k => k in layers) && layers.neverConflated, '4 connectivity layers are separate and never conflated');
  ok(layers.PHYSICAL_CLEARANCE.status === 'UNPROVEN' && layers.PHYSICAL_CLEARANCE.channelSpanFitVerified !== true, 'physical clearance UNPROVEN, channel span NOT verified');
  ok(a.noClaim.includes('NO_CLAIM_OF_PHYSICALLY_TRAVERSABLE_CART_ROUTES') && a.noInventedPassabilityRules === true, 'no cart-route claim, no invented passability rules');
  ok(a.audit.junctionTolerances.geo01JoinToleranceAu === 8 && a.audit.junctionTolerances.maplabSnapTolAu === 7 && a.audit.junctionTolerances.pairsMergedOnlyByGeo01Tolerance8.count === 4, 'junction tolerance 8 vs 7 audited with 4 GEO-01-only joins');
  ok(a.audit.bridgeCrossings.focusBridges.length === 2 && a.audit.bridgeCrossings.focusBridges.every(b => b.coveredIntersections.length > 0), 'both br_4 (cart) and br_a (foot) crossings audited');
  ok(a.audit.zeroClearance.zeroClearanceCellCount >= 1 && a.audit.zeroClearance.zeroClearanceCells[0].maplabClearanceAu === 0, 'zero-clearance cells reported with au clearance');
  ok(a.audit.riverWidths.every(r => r.physicalChannelWidth.includes('UNDEFINED')), 'river widths keep physicalChannelWidth UNDEFINED');
  ok(a.audit.derivedConnectors.length === 4 && a.audit.derivedConnectors.every(c => c.needsMapSpatialAuthoring), '4 derived connectors flagged NEEDS MAP AUTHORING');
  ok(a.audit.poiAccess.cartAccessWithinAccessR === false, 'no cart access to po_kilns within editor ACCESS_R=48');
  ok(a.failingOrNeedsAuthoring.length >= 8, 'failing / needs-authoring paths reported, not hidden');
  ok(a.connectivityLayers.RASTER_CANDIDATE.maplabStepMultDijkstra.cart.notAPhysicallyTraversableCartRoute === true, 'Dijkstra cart candidate explicitly NOT a physically traversable cart route');

  // ---- 5 PROPOSED POI design -------------------------------------------
  const d = read(path.join(OUT, 'poi_po_kilns.proposed.v1.json'));
  ok(d.status === 'PROPOSED' && d.canonical === false && d.scope === 'po_kilns ONLY', 'po_kilns design is PROPOSED, non-canonical, single-POI');
  ok(d.existingAuthored.length === 4 && d.existingAuthored.every(x => x.status === 'EXISTING_AUTHORED'), 'existing authored geometry separated and unmodified');
  ok(d.proposed.interiorWorkingSpaces.length === 4 && d.proposed.entranceOptions.length === 3 && d.proposed.circulation.paths.length === 5, 'footprint/approach/entrances/working space/circulation/retreat all present');
  ok(d.proposed.entranceOptions.every(e => e.status === 'PROPOSED' && e.physicalDoorOpeningOnly === true), 'entrances are physical openings only, no locks/power');
  const rawDesign = fs.readFileSync(path.join(OUT, 'poi_po_kilns.proposed.v1.json'), 'utf8');
  ok(!/"(recipes|lootSites|lockedState|powerNodes|interactiveMachinery|hazardIntensity)"\s*:/.test(rawDesign), 'no gameplay keys (recipes/loot/locks/power/machinery/hazard) in the design');
  ok(d.excludedFields.length >= 10 && d.noRuntimeMerge && d.noGameplayPopulation && d.noPhysicallyTraversableCartRouteClaim, 'explicit exclusions + gates');
  ok(d.sourceEvidence.poi.footAreaAu2 === 496.7424 && d.proposed.physicalFootprint.areaAu2 === 496.7424, 'verbatim source foot area 496.7424 au² preserved');
  ok(d.proposed.approach.existingAuthoredApproach.authoredControlPointsInsideFoot.length === 1, 'source conflict reported: rd_16 terminates inside the foot');

  // ---- 6 geometry package ----------------------------------------------
  const pk = read(path.join(OUT, 'geometry_package.v1.json'));
  ok(pk.howToRead.coordinates.includes('2000x1400') && pk.gates.authoredCoordinateSpacePreserved === '2000x1400', '2000x1400 authoring coordinate space preserved');
  ok(Object.keys(pk.exactSourceIds.roads).length === 5 && pk.exactSourceIds.bridges.length === 2, 'exact source ids for corridor roads + both bridges');
  ok(pk.existingAuthoredVsProposed.explicitDistinction && pk.existingAuthoredVsProposed.noRuntimeMerge, 'authored-vs-PROPOSED distinction explicit; no runtime merge');
  ok(pk.gates.visuallyInspectableBeforeAfterAudit === true && pk.gates.noPhysicalCartRouteClaim === true, 'before/after audit + no cart claim gates');
  ok(pk.unresolvedConstraints.length >= 8 && pk.nextExecutableSeam.length > 40, 'unresolved constraints + next executable seam reported');
  const svg = fs.readFileSync(path.join(OUT, 'audit_before_after.svg'), 'utf8');
  ok(svg.includes('BEFORE') && svg.includes('AFTER') && svg.includes('PROPOSED') && svg.includes('NEEDS AUTHORING'), 'before/after SVG shows both states, PROPOSED marker and needs-authoring flags');

  // ---- 7 full determinism ----------------------------------------------
  const files = [
    'maplab_encoding.v1.json', 'ownership_correction.v1.json', 'corridor_audit.v1.json',
    'poi_po_kilns.proposed.v1.json', 'geometry_package.v1.json',
    'rasters/manifest.v1.json', 'rasters/landMaplab.u8', 'rasters/lakeMaplab.u8',
    'rasters/riverMaplab.u8', 'rasters/roadFootMaplab.u8', 'rasters/roadCartMaplab.u8',
    'audit_before_after.svg', 'audit_before_after.html',
  ];
  const before = Object.fromEntries(files.map(f => [f, sha(fs.readFileSync(path.join(OUT, f)))]));
  for (const s of ['encoding.mjs', 'ownership.mjs', 'audit.mjs', 'poi_design.mjs', 'render.mjs', 'package.mjs'])
    execFileSync(process.execPath, [path.join(ROOT, 'src', s)], { cwd: ROOT, stdio: 'pipe' });
  let identical = true;
  for (const f of files) if (sha(fs.readFileSync(path.join(OUT, f))) !== before[f]) { identical = false; console.error(`  CHANGED: ${f}`); }
  ok(identical, `all ${files.length} derived outputs byte-identical after a full re-run`);
  const png = fs.readFileSync(path.join(OUT, 'audit_before_after.png'));
  ok(png.length > 100000 && png.subarray(1, 4).toString() === 'PNG', 'before/after PNG is a real, non-empty raster');

  console.log(`\nGEO02_TESTS ${n}/${n} passed`);
}
main();
