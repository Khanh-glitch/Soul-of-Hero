/**
 * MAP-GEO-REJOIN-01 — static acceptance assertions over the generated evidence.
 * NO browser, NO regeneration, NO write to protected evidence.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const j = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pngSize = p => { const b = fs.readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
let n = 0, failed = 0;
const t = (name, cond, extra = '') => { n++; if (!cond) { failed++; console.error('FAIL', name, extra); } };
const eq = (name, a, b) => t(name, a === b, `got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`);

const pre = j('evidence/mapgeo01-preflight.json');
const audit = j('evidence/mapgeo01-physical-audit.json');
const rec = j('map-data/MAPGEO01_FINDINGS_RECONCILED.json');
const brief = j('evidence/mapgeo01-reconciliation.json');
const trav = j('evidence/mapgeo01-traversal.json');

/* ---- P: live refs, custody, protected executables ---- */
eq('P01 Map live ref', pre.liveRefs['arena/2e3cfbd2-soul-of-hero'], '99a196f3b601155ae216ba8968d4f94ee2d0a157');
eq('P02 main live ref', pre.liveRefs.main, '5214788933b1a827f3a177d11ff486433dfe5e8a');
eq('P03 local head == Map live ref', pre.local.head, pre.liveRefs['arena/2e3cfbd2-soul-of-hero']);
eq('P04 branch', pre.local.branch, 'arena/2e3cfbd2-soul-of-hero');
t('P05 Gameplay drift detected', pre.pinnedHeads.drift.gameplayHeadMoved === true,
  `live=${pre.pinnedHeads.drift.to}`);
eq('P06 Gameplay observed head', pre.pinnedHeads.gameplayObservedInTask, '2f0836587b76a4a98fffedf8c202fb37cbb2a67c');
eq('P07 Creator-verified head', pre.pinnedHeads.gameplayCreatorVerified, '5b3e683402bbc8540dea9404576164097e753f97');
eq('P08 U05 source pin', pre.pinnedHeads.u05SourcePin, 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9');
eq('P09 active revision', pre.activeAuthority.activeRevision, 'WMP-04R1');
eq('P10 active manifest', pre.activeAuthority.activeManifest, 'v4/r1/manifest.r1.json');
t('P11 status = GAMEPLAY_INTAKE_PENDING', pre.activeAuthority.status.includes('GAMEPLAY_INTAKE_PENDING'));
eq('P12 terrain-only SHA', pre.protectedExecutables.terrainOnly.sha256, pre.protectedExecutables.terrainOnly.expected);
eq('P13 NATURE-01 SHA', pre.protectedExecutables.nature01.sha256, pre.protectedExecutables.nature01.expected);
eq('P14 NATURE-02 SHA', pre.protectedExecutables.nature02.sha256, pre.protectedExecutables.nature02.expected);
eq('P15 terrain-only file unchanged on disk', sha(path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html')), pre.protectedExecutables.terrainOnly.expected);
t('P16 bible §V read', pre.bible.sectionV.found && pre.bible.sectionV.bytes > 1000);
t('P17 bible §11.5 read', pre.bible.section115.found && pre.bible.section115.bytes > 1000);
t('P18 web/ref/bible.md absent in Map worktree', pre.bible.worktreePathPresent === false);
t('P19 vendored bible differs from live', pre.bible.vendoredDiffersFromLive === true);
eq('P20 live bible file SHA', pre.bible.liveFileSha256, '9851ad25a1389029dd83f448dc77b6670c1b3548e962e951ba9e34f4f5e0bed3');
eq('P21 terrain painter block SHA at live head', pre.gameplaySourceProvenance.terrainPainterBlock.live.sha256,
  'f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803');
t('P22 painter byte-identical across all heads', pre.gameplaySourceProvenance.terrainPainterBlock.byteIdenticalAcrossAllHeads === true);
t('P23 art.ts drift recorded (vendored != live)',
  pre.gameplaySourceProvenance.artTs.vendoredBlob !== pre.gameplaySourceProvenance.artTs.liveBlob);
t('P24 required files present', Object.values(pre.requiredFiles).every(x => !x.missing));
eq('P25 GOLD roads', pre.goldCounts.roads, 92);
eq('P26 GOLD bridges', pre.goldCounts.bridges, 12);
eq('P27 GOLD docks', pre.goldCounts.docks, 27);
eq('P28 GOLD spawns', pre.goldCounts.spawns, 4);
eq('P29 GOLD POIs', pre.goldCounts.pois, 81);
eq('P30 GOLD rivers', pre.goldCounts.rivers, 17);

/* ---- A: physical audit ---- */
eq('A01 audit viewer SHA = protected', audit.method.viewerSha256, pre.protectedExecutables.terrainOnly.sha256);
eq('A02 no browser errors', audit.method.browserErrors.length, 0);
eq('A03 U', audit.contract.U, 0.5);
eq('A04 TILE_PX', audit.contract.TILE_PX, 16);
t('A05 viewport 640x360', JSON.stringify(audit.contract.viewport) === '[640,360]');
eq('A06 12 bridges', audit.connections.bridges.count, 12);
eq('A07 0 physically crossable bridges', audit.connections.bridges.physicallyCrossable, 0);
eq('A08 12 bridge centres on RIVER', audit.connections.bridges.allCentresAreRiverTile, 12);
eq('A09 12 bridge centres blocked', audit.connections.bridges.allCentresBlocked, 12);
eq('A10 92 roads', audit.roads.goldRoadCount, 92);
eq('A11 all road centrelines continuous', audit.roads.roadsFullyContinuous, 92);
t('A12 water overrides measured', audit.roads.roadsWithWaterOverride > 0);
eq('A13 27 docks', audit.connections.docks.count, 27);
t('A14 docks have land approaches', audit.connections.docks.withLandApproach > 0);
eq('A15 4 spawns', audit.spawns.count, 4);
t('A16 all spawns dry + walkable', audit.spawns.allOnDryWalkableLand === true);
t('A17 all spawns have a road within 120 tiles',
  audit.spawns.items.every(s => s.nearestRenderedRoadTileDistUpTo120 !== null));
eq('A18 81 POIs', audit.poiAccess.poiCount, 81);
eq('A19 18 POIs with retreat polyline', audit.poiAccess.poiWithRetreatPolyline, 18);
t('A20 retreat endpoints measured in runtime', audit.poiAccess.retreatEndpointsTotal > 0);
eq('A21 17 rivers', audit.hydrography.goldCounts.rivers, 17);
t('A22 all river centrelines continuous', audit.hydrography.rivers.every(r => r.continuity === 1));
t('A23 river mouths reach water', audit.hydrography.rivers.every(r => r.mouthWater === true));
eq('A24 cliff raster max code', audit.terrain.cliffCandidateDiscrepancy.maxSourceCode, 1);
eq('A25 zero physical CLIFF tiles at stride 8', audit.terrain.cliffCandidateDiscrepancy.u05RuntimeCliffTilesAtStride8, 0);
eq('A26 build permission always false', audit.globalScan.flags.build, 0);
eq('A27 boat permission always false', audit.globalScan.flags.boat, 0);
eq('A28 swim permission always false', audit.globalScan.flags.swim, 0);
eq('A29 ferryFoot permission always false', audit.globalScan.flags.ferryFoot, 0);
t('A30 permissions are candidates only', audit.globalScan.permissionsAreCandidates === true);
eq('A31 10 named defects', audit.defects.length, 10);
t('A32 every defect has owner + severity', audit.defects.every(d => d.owner && d.severity));
t('A33 no defect was silently corrected', audit.defects.every(d => d.mapOwnedGeometryCorrectionApplied === false));
eq('A34 zero GOLD amendments', audit.mapOwnedGeometryAmendments.amendedPolygons, 0);
eq('A35 zero relocated objects', audit.mapOwnedGeometryAmendments.relocatedObjects, 0);
eq('A36 zero new buildings', audit.mapOwnedGeometryAmendments.newBuildings, 0);
eq('A37 zero new doors', audit.mapOwnedGeometryAmendments.newDoors, 0);
eq('A38 zero new props', audit.mapOwnedGeometryAmendments.newProps, 0);
eq('A39 zero new atlas', audit.mapOwnedGeometryAmendments.newAtlas, 0);
t('A40 coarse scan did not materialise 11.2M cells', audit.globalScan.samples < 200000);
t('A41 hydrography section present', !!audit.hydrography && !!audit.hydrography.confluence);
t('A42 separation triple present', !!audit.separation.visibleSurface && !!audit.separation.physicalGeometry && !!audit.separation.gameplayPermission);

/* ---- R: 62-finding reconciliation ---- */
eq('R01 62 items', rec.items.length, 62);
eq('R02 all classified', rec.summary.classified, 62);
eq('R03 5 categories declared', Object.keys(rec.categories).length, 5);
eq('R04 zero genuine Map geometry defects', rec.summary.genuineMapGeometryDefectsCorrectable, 0);
eq('R05 12 intentional overlaps', rec.summary.intentionalOverlaps, 12);
eq('R06 46 Gameplay/A8 decisions', rec.summary.gameplayA8Decisions, 46);
eq('R07 1 Creator decision', rec.summary.creatorDecisions, 1);
eq('R08 3 missing-evidence findings', rec.summary.missingEvidence, 3);
t('R09 category counts sum to 62', Object.values(rec.categories).reduce((a, b) => a + b.count, 0) === 62);
eq('R10 30 polygon findings remeasured at U=0.5', rec.summary.polygonFindingsRemeasuredAtU05, 30);
t('R11 double counting measured in 7 zones', rec.summary.zonesWithDoubleCountedOriginalMeasurement === 7);
eq('R12 zero Map geometry corrections applied', rec.summary.mapGeometryCorrectionsApplied, 0);
eq('R13 zero GOLD amendments', rec.summary.goldAmendments, 0);
t('R14 every item has an owner/severity/decision', rec.items.every(i => i.owner && i.severity && i.decisionRequired));
t('R15 every item has U05 evidence', rec.items.every(i => Object.keys(i.u05Evidence).length > 0));
eq('R16 original findings register unchanged', rec.provenance.originalFindings.sha256,
  '2ac08fd0881a7a584ab321b303e9dd71b54296c02ab5cb89a4a890edd83b4abc');
eq('R17 GOLD SHA pinned', rec.provenance.gold.sha256, '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256');
t('R18 immutable GOLD assertions all zero',
  Object.entries(rec.provenance.immutableGoldAssertions).filter(([k, v]) => typeof v === 'number').every(([, v]) => v === 0));
eq('R19 3 evidence-layer corrections', rec.corrections.length, 3);
t('R20 no correction changed geometry', rec.corrections.every(c => c.geometryChanged === false));
eq('R21 reconciliation brief total', brief.total, 62);
t('R22 example remeasurement is real', rec.corrections[0].measured.example.afterNativeTiles === 5505);

/* ---- T: real traversals + screenshots ---- */
eq('T01 runtime executable SHA = protected', trav.runtime.sha256, pre.protectedExecutables.terrainOnly.sha256);
eq('T02 no browser errors', trav.runtime.browserErrors.length, 0);
t('T03 native canvas 640x360', JSON.stringify(trav.runtime.nativeCanvas) === '[640,360]');
eq('T04 6 traversals', trav.traversals.length, 6);
t('T05 no camera teleport called traversal', trav.rule.noCameraTeleportCalledTraversal === true);
t('T06 every run used real keys', trav.traversals.every(r => r.measurement.realKeyDownEvents > 0 && r.measurement.distancePx > 0));
t('T07 every run used NATURAL_TERRAIN_ONLY collision', trav.traversals.every(r => r.runtime.collision === 'NATURAL_TERRAIN_ONLY'));
t('T08 every run at native 1x', trav.traversals.every(r => r.runtime.zoomMode === 'NATIVE_1X' && r.runtime.viewport[0] === 640 && r.runtime.viewport[1] === 360));
t('T09 spawn control only at start', trav.traversals.every(r => r.spawn.resetOnlyAtStart && r.spawn.cameraTeleportUsed === false && r.spawn.cameraUsedAsRoute === false));
t('T10 bridge crossing records a FAIL, not a PASS', trav.traversals.find(r => r.id === 'T3_bridge_approach_crossing').result.includes('FAIL'));
t('T11 bridge crossing was physically blocked', trav.traversals.find(r => r.id === 'T3_bridge_approach_crossing').measurement.blockedSubsteps > 0);
t('T12 highland route records PARTIAL', trav.traversals.find(r => r.id === 'T4_highland_and_alternative').result.includes('PARTIAL'));
t('T13 road traversal ends on an authored road tile', trav.traversals.find(r => r.id === 'T2_road_biome_transition').measurement.endTileIsAuthoredRoad === true);
t('T14 road traversal observed a biome transition', trav.traversals.find(r => r.id === 'T2_road_biome_transition').measurement.biomeTransitionObserved === true);
t('T15 spawn traversal ends on a road tile', trav.traversals.find(r => r.id === 'T1_spawn_to_route').measurement.endTileIsAuthoredRoad === true);
t('T16 dock traversal reached the dock tile',
  JSON.stringify(trav.traversals.find(r => r.id === 'T5_coastal_dock_approach').measurement.endTile) === '[3130,1769]');
t('T17 POI traversal returned near its start',
  Math.abs(trav.traversals.find(r => r.id === 'T6_poi_exterior_return').measurement.tileDelta[0]) <= 2);
eq('T18 physical before/after pair', trav.physicalBeforeAfterPair.length, 2);
const off = trav.physicalBeforeAfterPair.find(p => p.id === 'physical_free_roam');
const on = trav.physicalBeforeAfterPair.find(p => p.id === 'physical_natural_collision');
t('T19 free-roam diagnostic is not a traversal proof', off.collision === 'FREE_ROAM__NO_COLLISION');
t('T20 physical state blocked the crossing', on.blockedSubsteps > 0 && on.distancePx < off.distancePx);
const shots = fs.readdirSync(path.join(ROOT, 'evidence/mapgeo01-shots')).filter(f => f.endsWith('.png'));
eq('T21 16 native screenshots', shots.length, 16);
t('T22 every screenshot is exactly 640x360', shots.every(f => JSON.stringify(pngSize(path.join(ROOT, 'evidence/mapgeo01-shots', f))) === '[640,360]'));
t('T23 before+after per traversal exist', trav.traversals.every(r => fs.existsSync(path.join(ROOT, 'evidence/mapgeo01-shots', r.before.file.split('/').pop())) && fs.existsSync(path.join(ROOT, 'evidence/mapgeo01-shots', r.after.file.split('/').pop()))));
t('T24 isolated-viewer / full-runtime boundary recorded', !!trav.proofBoundary.provenInIsolatedViewer.length && !!trav.proofBoundary.requiresFullGameplayRuntime.length);
t('T25 4 separate acceptance statuses', Object.keys(trav.acceptanceSeparation).length === 4);
t('T26 VISUAL not granted', trav.acceptanceSeparation.VISUAL.includes('NOT_REQUESTED'));
t('T27 GAMEPLAY not granted', trav.acceptanceSeparation.GAMEPLAY.includes('NOT_REQUESTED'));
t('T28 notClaims includes VEYRA_PLAYABLE', audit.notClaims.includes('No VEYRA_PLAYABLE'));
t('T29 no visual acceptance claim in audit', audit.acceptance.VISUAL === 'NOT_REQUESTED');

/* ---- S: source files untouched, no new standalone product ---- */
eq('S01 world.ts SHA unchanged', sha(path.join(ROOT, 'web-u05/src/u05/world.ts')), '78317efe40c18f7ed4bf7d3c129be4f423b6a7abaac7625e8f9938c73b2264fd');
eq('S02 terrain.ts SHA unchanged', sha(path.join(ROOT, 'web-u05/src/u05/terrain.ts')), '3d3fa1605a121ba2bcd8b26e0333cbf8a7ada71adfca67ce7e8e3ee3ca225bc4');
eq('S03 geometry.ts SHA unchanged', sha(path.join(ROOT, 'web-u05/src/u05/lw/geometry.ts')), 'b10bab33d49c7c0f840722d815c7b7613f791f5c5c056643c9983dd95767da4e');
eq('S04 art.ts SHA unchanged', sha(path.join(ROOT, 'web-u05/src/game/art.ts')), '896aa51abfac516b4228994ae7a20a67c4644a587028146b5c79336103a1ec20');
eq('S05 GOLD SHA unchanged', sha(path.join(REPO, 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json')), '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256');
eq('S06 original findings SHA unchanged', sha(path.join(ROOT, 'map-data/U05_GEOMETRY_CONFLICTS.json')), '2ac08fd0881a7a584ab321b303e9dd71b54296c02ab5cb89a4a890edd83b4abc');
t('S07 no new HTML executable produced', !fs.readdirSync(ROOT).some(f => f.toLowerCase().includes('mapgeo') && f.endsWith('.html')));

console.log(`U05_MAPGEO01_TESTS ${n - failed}/${n} PASS` + (failed ? ` (${failed} FAIL)` : ''));
process.exit(failed ? 1 : 0);
