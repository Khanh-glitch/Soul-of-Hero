/**
 * SOH — MAP-GEO-REJOIN-02 — static acceptance assertions.
 * NO browser, NO regeneration, NO writes. Reads only committed evidence and
 * immutable source files. Complements qa-mapgeo02-traversal.mjs (runtime).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const j = p => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));
const rj = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pngSize = p => { const b = fs.readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
let n = 0, failed = 0;
const t = (name, cond, extra = '') => { n++; if (!cond) { failed++; console.error('FAIL', name, extra); } };
const eq = (name, a, b) => t(name, a === b, `got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`);

const pre = rj('evidence/mapgeo02-preflight.json');
const build = rj('evidence/mapgeo02-build.json');
const geom = rj('evidence/mapgeo02-bridge-geometry.json');
const trav = rj('evidence/mapgeo02-traversal.json');
const road = rj('evidence/mapgeo02-road-water-classification.json');
const audit01 = rj('evidence/mapgeo01-physical-audit.json');
const GOLD = JSON.parse(fs.readFileSync(path.join(REPO, 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json'), 'utf8')).project;
const contract = fs.readFileSync(path.join(REPO, 'world_lab/src/gold/REAL_MAP_CONVERSION_CONTRACT.md'), 'utf8');
const deliverable = fs.readFileSync(path.join(ROOT, 'SoulOfHero_MapGeo02_CorrectedProjection.html'), 'utf8');
const correctedWorld = fs.readFileSync(path.join(ROOT, 'web-u05/src/mapgeo02/corrected-world.ts'), 'utf8');

/* ---- P: exact SHAs / live custody / PR44 ---- */
eq('P01 pinned Map HEAD', pre.pinnedHeads.map, '3e02fde05a24f6d645ea00ed5ab78900655e1272');
eq('P02 pinned Gameplay observed HEAD', pre.pinnedHeads.gameplayObserved, '6e7d116b4400ea3c24373fe884b7fad258f4f7bc');
eq('P03 local HEAD == pinned Map HEAD', pre.local.head, pre.pinnedHeads.map);
eq('P04 working branch', pre.local.branch, 'arena/2e3cfbd2-soul-of-hero');
eq('P05 live Map HEAD', pre.liveRefs.map, pre.pinnedHeads.map);
eq('P06 main HEAD', pre.liveRefs.main, '5214788933b1a827f3a177d11ff486433dfe5e8a');
eq('P07 PR44 live head reported', pre.liveRefs.pr44Head, pre.pr44.headRefOid);
eq('P08 PR44 OPEN', pre.pr44.state, 'OPEN');
t('P09 Gameplay drift detected and reported', pre.gameplayDrift.movedDuringTask === true &&
  pre.gameplayDrift.liveNow !== pre.gameplayDrift.pinnedObserved, JSON.stringify(pre.gameplayDrift));
t('P10 PR44 NOT edited/merged/closed', pre.pr44.state === 'OPEN' && pre.scope.not.includes('PR44 edit/merge'));
t('P11 painter byte-identical at 4 heads', pre.gameplaySourceProvenance.painterIdenticalAcrossAllHeads === true &&
  Object.values(pre.gameplaySourceProvenance.painterHeads).every(p => p.sha256 === pre.gameplaySourceProvenance.painterExpectedSha256 && p.bytes === 8276));
t('P12 no silent re-vendoring', pre.gameplaySourceProvenance.artTs.vendoredBlob !== pre.gameplaySourceProvenance.artTs.pr44LiveNow &&
  pre.gameplaySourceProvenance.bible.vendoredDiffersFromLive === true);
t('P13 three protected baselines unchanged', Object.values(pre.protectedExecutables).every(v => v.unchanged));
eq('P14 GOLD SHA', pre.goldSha256, '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256');
eq('P15 active revision', pre.activeAuthority.activeRevision, 'WMP-04R1');
t('P16 status remains GAMEPLAY_INTAKE_PENDING', pre.activeAuthority.status.includes('GAMEPLAY_INTAKE_PENDING'));
t('P17 production atlas NOT authorized', pre.activeAuthority.productionAtlas === 'NOT_AUTHORIZED');
t('P18 scope excludes new world / viewer / nature / roadmap', ['another world', 'geography viewer', 'nature system', 'product roadmap']
  .every(x => pre.scope.not.includes(x)));

/* ---- S: source files unchanged (only additive new files) ---- */
eq('S01 world.ts SHA', sha(path.join(ROOT, 'web-u05/src/u05/world.ts')), '78317efe40c18f7ed4bf7d3c129be4f423b6a7abaac7625e8f9938c73b2264fd');
eq('S02 terrain.ts SHA', sha(path.join(ROOT, 'web-u05/src/u05/terrain.ts')), '3d3fa1605a121ba2bcd8b26e0333cbf8a7ada71adfca67ce7e8e3ee3ca225bc4');
eq('S03 lw/geometry.ts SHA', sha(path.join(ROOT, 'web-u05/src/u05/lw/geometry.ts')), 'b10bab33d49c7c0f840722d815c7b7613f791f5c5c056643c9983dd95767da4e');
eq('S04 art.ts SHA', sha(path.join(ROOT, 'web-u05/src/game/art.ts')), '896aa51abfac516b4228994ae7a20a67c4644a587028146b5c79336103a1ec20');
eq('S05 GOLD SHA on disk', sha(path.join(REPO, 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json')), pre.goldSha256);
eq('S06 U05_GEOMETRY_CONFLICTS SHA', sha(path.join(ROOT, 'map-data/U05_GEOMETRY_CONFLICTS.json')), '2ac08fd0881a7a584ab321b303e9dd71b54296c02ab5cb89a4a890edd83b4abc');
t('S07 MAP-GEO-01 findings unchanged (62/62 classified, 0 GOLD amendments)', (() => {
  const f = rj('map-data/MAPGEO01_FINDINGS_RECONCILED.json');
  return f.summary && f.summary.totalFindings === 62 && f.summary.classified === 62 &&
    f.summary.goldAmendments === 0 && f.summary.mapGeometryCorrectionsApplied === 0;
})());
t('S08 terrain-only HTML unchanged on disk', sha(path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html')) === pre.protectedExecutables.terrainOnly.expected);
t('S09 NATURE-01 unchanged on disk', sha(path.join(ROOT, 'SoulOfHero_Nature01_U05.html')) === pre.protectedExecutables.nature01.expected);
t('S10 NATURE-02 unchanged on disk', sha(path.join(ROOT, 'SoulOfHero_Nature02_ForestSlice.html')) === pre.protectedExecutables.nature02.expected);
t('S11 original geometry.ts still has the 12 AU node / >=2 cliff rule (unchanged source)', (() => {
  const g = fs.readFileSync(path.join(ROOT, 'web-u05/src/u05/lw/geometry.ts'), 'utf8');
  return g.includes("kind: 'bridge', x: b.at[0], y: b.at[1], r: 12") && g.includes('cliff >= 2');
})());
t('S12 corrected overlay does NOT redefine the 12 AU node', !correctedWorld.includes('r: 12'));
t('S13 WMP03 bridge contract read', contract.includes('bridge') && contract.includes('span'));
t('S14 corrected overlay explicitly forbids marker radius as footprint', correctedWorld.includes('notMarkerRadius: true'));
t('S15 corrected overlay has explicit QA mode only', correctedWorld.includes('QA_CANDIDATE_CROSSING') &&
  correctedWorld.includes('PRODUCTION_NO_PERMISSION'));

/* ---- B: build evidence ---- */
eq('B01 build schema', build.schema, 'soh.mapgeo02.build.v1');
eq('B02 deliverable SHA matches file', build.deliverable.sha256, sha(path.join(ROOT, 'SoulOfHero_MapGeo02_CorrectedProjection.html')));
eq('B03 deliverable bytes', build.deliverable.bytes, Buffer.byteLength(deliverable));
eq('B04 GOLD SHA in build', build.sources.gold.sha256, pre.goldSha256);
eq('B05 crossing raster SHA', build.sources.crossingCandidate.sha256,
  sha(path.join(REPO, 'veyra-world-master/data/rasters/geo01/crossingCandidate.u8')));
eq('B06 12 bridge identities', build.bridgeIdentities.length, 12);
eq('B07 33 crossingCandidate cells', build.sources.crossingCandidate.nonZeroCells, 33);
eq('B08 crossing codes 1/2/3', JSON.stringify(build.sources.crossingCandidate.codes), JSON.stringify({ 1: 5, 2: 7, 3: 21 }));
t('B09 self-contained HTML', build.selfContained.externalScript === false &&
  build.selfContained.externalCss === false && build.selfContained.importFromUrl === false &&
  !/<script[^>]+src=/i.test(deliverable));
t('B10 protected baselines verified by builder', Object.values(build.protectedBaselines).every(v => v.unchanged));
eq('B11 default mode', build.defaultCandidateMode, 'PRODUCTION_NO_PERMISSION');
eq('B12 QA mode name', build.qaCandidateMode, 'QA_CANDIDATE_CROSSING');
t('B13 renderer U=0.5 / 640x360 / hero 16x24', build.renderer.U === 0.5 && build.renderer.TILE === 16 &&
  JSON.stringify(build.renderer.viewport) === '[640,360]' && JSON.stringify(build.renderer.heroPx) === '[16,24]' &&
  JSON.stringify(build.renderer.frameTiles) === '[4000,2800]');
t('B14 no production / visual / playable claims in build', ['NO production traversal permission',
  'NO full-world visual acceptance', 'NO VEYRA_PLAYABLE'].every(x => build.noClaims.includes(x)));
t('B15 generated file SHAs recorded', Object.keys(build.generated).length === 3 &&
  Object.values(build.generated).every(s => /^[0-9a-f]{64}$/.test(s)));
eq('B16 built HTML has no forbidden overlay', /PhysicalLayer|U05_SCENES|SITE_ENVELOPE|roofHiddenCount/.test(deliverable), false);
t('B17 required runtime markers present', ['QA_CANDIDATE_CROSSING', 'PRODUCTION_NO_PERMISSION',
  'UNRESOLVED__EXTERNAL_DECISION_REQUIRED', 'cliffCandidate', 'bridgeCandidates', 'MAP-GEO-REJOIN-02']
  .every(m => deliverable.includes(m)));

/* ---- G: bridge-by-bridge geometry ---- */
eq('G01 12 bridge records', geom.bridges.length, 12);
eq('G02 all GOLD ids in order', JSON.stringify(geom.bridges.map(b => b.id)), JSON.stringify(GOLD.bridges.map(b => b.id)));
eq('G03 10 resolved', geom.resolvedIds.length, 10);
eq('G04 exactly 2 unresolved', JSON.stringify(geom.unresolvedIds), JSON.stringify(['br_9', 'br_b']));
t('G05 NEVER forced 12 PASS', geom.unresolvedIds.length > 0);
t('G06 exact unresolved reasons and owners recorded', geom.bridges.filter(b => b.status.startsWith('UNRESOLVED'))
  .every(b => b.unresolvedReasons.length > 0 && b.owner.includes('CREATOR') && b.owner.includes('GAMEPLAY')));
t('G07 br_9 needs bearing owner review', geom.bridges.find(b => b.id === 'br_9').unresolvedReasons
  .includes('MULTIPLE_BOUNDED_CROSSING_AXES__OWNER_BEARING_REVIEW'));
t('G08 br_b has no verified second bank', geom.bridges.find(b => b.id === 'br_b').unresolvedReasons
  .includes('NO_VERIFIED_BOTH_BANKS'));
t('G09 unresolved bridges are never counted as resolved decks', geom.bridges
  .filter(b => b.status.startsWith('UNRESOLVED')).every(b => !geom.resolvedIds.includes(b.id)) &&
  geom.resolvedIds.every(id => !geom.unresolvedIds.includes(id)));
t('G10 all resolved decks measured', geom.bridges.filter(b => b.status.startsWith('CANDIDATE_DECK')).every(b =>
  b.deckTileCount > 0 && b.continuity === true && b.roadApproaches === true &&
  b.bankA.dryLand === true && b.bankB.dryLand === true && b.bankA.road === true && b.bankB.road === true &&
  b.bankSeams.connected === true && b.spanCoverage >= 0.90));
t('G11 resolved footprints are NOT the 12 AU marker radius', geom.bridges
  .filter(b => b.status.startsWith('CANDIDATE_DECK'))
  .every(b => b.deckFootprintAu.notMarkerRadius === true && b.deckFootprintAu.width === 3.0 &&
    b.deckFootprintAu.length < 12 && b.deckFootprintAu.length > b.waterSpanAu));
t('G11b unresolved br_b footprint is explicitly over the bounded guard (NO deck stamped)',
  geom.bridges.find(b => b.id === 'br_b').deckFootprintAu.length > 16 &&
  !geom.resolvedIds.includes('br_b'));
t('G12 water span bounded', geom.bridges.filter(b => b.status.startsWith('CANDIDATE_DECK')).every(b => b.waterSpanAu > 0 && b.waterSpanAu <= 16));
t('G13 authored at/ang/load preserved', geom.bridges.every(b => {
  const g = GOLD.bridges.find(x => x.id === b.id);
  return Math.abs(b.atAu[0] - g.at[0]) < 1e-4 && Math.abs(b.atAu[1] - g.at[1]) < 1e-4 &&
    Math.abs(b.authoredAngRad - g.ang) < 1e-6 && b.authoredLoad === g.load;
}));
t('G14 crossingCandidate code matches GOLD load', geom.bridges.every(b => b.crossingCandidateCode === (b.authoredLoad === 'cart' ? 2 : 1)));
t('G15 both banks / orientation / approaches / seams / continuity measured per bridge',
  geom.bridges.every(b => 'bankA' in b && 'bankB' in b && 'orientation' in b &&
    'roadApproaches' in b && 'bankSeams' in b && 'continuity' in b && 'sourceEvidence' in b));
t('G16 all source evidence flags true for resolved', geom.bridges.filter(b => b.status.startsWith('CANDIDATE_DECK'))
  .every(b => Object.values(b.sourceEvidence).every(Boolean)));
eq('G17 deck tile count', geom.deckTileCount, 596);
t('G18 bridge statuses are geometry-only', geom.bridges.every(b => b.status.includes('GAMEPLAY_PERMISSION_REQUIRED') ||
  b.status.includes('EXTERNAL_DECISION_REQUIRED')));
t('G19 Gameplay WorldTraversal intake named', geom.bridges.every(b => b.gameplayIntake.includes('WorldTraversal')));
eq('G20 executable SHA in geometry table', geom.executableSha256, build.deliverable.sha256);

/* ---- C: cliff candidate -> display / collision ---- */
eq('C01 candidate cells 305', geom.cliffStats.candidateCells, 305);
eq('C02 qualified cells 305', geom.cliffStats.qualifiedCells, 305);
t('C03 raster is BINARY and defect was >=2', geom.cliffStats.rasterContract.includes('BINARY') &&
  geom.cliffStats.consumerDefect.includes('>= 2'));
t('C04 repaired predicate uses >=1', geom.cliffStats.repairedPredicate.includes('cliffCandidate >= 1'));
t('C05 independent height/slope/relief evidence', geom.cliffStats.independentChecks.length >= 4 &&
  geom.cliffStats.independentChecks.some(x => x.includes('slopeClass')));
t('C06 thin jagged face, not filled slab', JSON.stringify(geom.cliffStats.faceBandTilesPerCellEdge) === '[2,4]' &&
  geom.cliffStats.filledSlabsProhibited === true && geom.cliffStats.projectedFractionOfCell < 0.3);
t('C07 no permanent impassable walls', geom.cliffStats.permanentImpassableWallsProhibited === true &&
  geom.cliffStats.productionCollisionCells === 0);
t('C08 QA candidate collision explicit & separate', geom.cliffStats.note.includes('explicit'));
t('C09 side histogram covers all 305', Object.values(geom.cliffStats.sideHistogram).reduce((a, b) => a + b, 0) === 305);
t('C10 MAP-GEO-01 measured 0 physical cliffs / binary 0-1 raster',
  audit01.terrain.cliffCandidateDiscrepancy.u05RuntimeCliffTilesInAllWindows === 0 &&
  audit01.terrain.cliffCandidateDiscrepancy.maxSourceCode === 1 &&
  JSON.stringify(audit01.terrain.cliffCandidateDiscrepancy.sourceRasterCodeCounts) === JSON.stringify({ 0: 43445, 1: 305 }) &&
  audit01.defects.some(d => d.id === 'MGP-D10'));
eq('C11 corrected runtime cliff candidate cells', trav.source.cliff.candidateCells, 305);

/* ---- R: road-water crossing classification ---- */
eq('R01 31 roads classified', road.total, 31);
eq('R02 8 ferry navigation references', road.counts.FERRY_NAVIGATION_REFERENCE, 8);
eq('R03 9 authored bridges', road.counts.AUTHORED_BRIDGE, 9);
eq('R04 8 unbridged land-road crossings', road.counts.UNBRIDGED_LAND_ROAD_CROSSING, 8);
eq('R05 6 ambiguous owner review', road.counts.AMBIGUOUS_OWNER_REVIEW, 6);
eq('R06 all categories sum to 31', Object.values(road.counts).reduce((a, b) => a + b, 0), 31);
t('R07 eight inherited ferry ids exact', JSON.stringify(road.ferryRouteIds) ===
  JSON.stringify(['rd_2c', 'rd_2d', 'rd_2e', 'rd_2f', 'rd_2g', 'rd_2h', 'rd_2i', 'rd_2j']));
t('R08 NO ferry is a dry-land road', road.rows.filter(r => r.category === 'FERRY_NAVIGATION_REFERENCE')
  .every(r => r.status === 'SOURCE_AUTHORED_GEOMETRY__NOT_A_LAND_ROAD' && r.note === 'NOT_A_DRY_LAND_ROAD'));
t('R09 exact unresolved road ids', JSON.stringify(road.unresolvedIds) ===
  JSON.stringify(['rd_a', 'rd_1g', 'rd_22', 'rd_23', 'rd_26', 'rd_28']));
t('R10 WMP03 evidence counts', road.wmp03Evidence.ferryRoutes === 8 &&
  road.wmp03Evidence.bridgeDeckProposals === 10 && road.wmp03Evidence.fordProposals === 19 &&
  road.wmp03Evidence.crossingCandidateCode3Cells === 21 && road.wmp03Evidence.waterRoadCellClassifications === 247);
t('R11 no approved traversal', road.wmp03Evidence.approvedTraversal.cellCount === 0);
t('R12 Beacon road not recoloured rule recorded', road.beacons.rule.includes('NOT widened'));
t('R13 no invented bridge / road change claims', ['NO invented bridge', 'NO road width or palette change', 'NO GOLD amendment']
  .every(x => road.noClaims.includes(x)));
t('R14 classification source SHAs verified', road.sources.gold.sha256 === pre.goldSha256 &&
  road.sources.crossingCandidate.sha256 === build.sources.crossingCandidate.sha256);

/* ---- T: real runtime / real-key evidence ---- */
eq('T01 traversal schema', trav.schema, 'soh.mapgeo02.traversal.v1');
eq('T02 executable SHA in traversal', trav.executable.sha256, build.deliverable.sha256);
eq('T03 all checks pass', trav.summary.fails, 0);
eq('T04 28 checks', trav.summary.checks, 28);
eq('T05 0 browser errors', trav.summary.browserErrors.length, 0);
eq('T06 17 real-key runs', trav.matchingCoordinateRuns.length + trav.bridgeRuns.length + trav.cliffRuns.length, 17);
t('T07 every run used real keys, no teleport/camera route', [...trav.matchingCoordinateRuns, ...trav.bridgeRuns, ...trav.cliffRuns]
  .every(r => r.realKeys.held > 0 && r.realKeys.inputLogEntries > 0 && !r.realKeys.teleportUsed &&
    !r.realKeys.camUsedAsRoute && !r.realKeys.collisionDisabled));
t('T08 six matching-coordinate comparisons exist', trav.matchingCoordinateRuns.length === 6 &&
  trav.matchingCoordinateRuns.every(r => r.exactCoordinate?.tileCodeComparison));
t('T09 T3 exact coordinate shows wood carpet -> bounded deck', (() => {
  const r = trav.matchingCoordinateRuns.find(x => x.id === 'match_T3_bridge_approach_crossing');
  const c = r.exactCoordinate.tileCodeComparison;
  return c.oldBridgeTiles > 500 && c.newBridgeTiles > 0 && c.newBridgeTiles < 100 && c.changedTiles > 500;
})());
t('T10 T1/T2/T5/T6 exact coordinates have ZERO changed tile codes',
  trav.matchingCoordinateRuns.filter(r => r.id !== 'match_T3_bridge_approach_crossing')
    .every(r => r.exactCoordinate.tileCodeComparison.changedTiles === 0));
t('T11 production traversal still blocked', (() => {
  const p = trav.bridgeRuns.find(r => r.id === 'B_br2_production');
  return p.movement.blockedSubsteps > 0 && p.movement.tilesTraversed < 10;
})());
t('T12 QA candidate crossing geometry verified (0 blocked, >20 tiles)', (() => {
  const q = trav.bridgeRuns.find(r => r.id === 'B_br2_qa_full_cross');
  return q.movement.blockedSubsteps === 0 && q.movement.tilesTraversed > 20;
})());
t('T13 br_1 QA reaches the measured deck', trav.bridgeRuns.find(r => r.id === 'B_br1_T3_qa').movement.endOnBridgeDeck === 'br_1');
t('T14 br_b unresolved gets NO deck', trav.bridgeRuns.find(r => r.id === 'B_brb_unresolved').movement.endOnBridgeDeck === null);
t('T15 cliff QA collision explicit, production has no cliff wall', (() => {
  const p = trav.cliffRuns.find(r => r.id === 'C_cliff_production');
  const q = trav.cliffRuns.find(r => r.id === 'C_cliff_qa_candidate');
  return p.movement.blockedSubsteps === 0 && q.movement.blockedSubsteps > 0;
})());
t('T16 alternative highland route uses real keys', trav.cliffRuns.find(r => r.id === 'C_cliff_qa_alternative').movement.movedPx > 1000);
t('T17 8 ferry centres remain water navigation references',
  trav.checks.find(c => c.id === 'D15_ferries_not_dry_land_roads').detail.every(f =>
    f.visibleTile !== 12 && f.waterTraversalClass === 2 && f.foot === false &&
    f.boat === false && f.swim === false && f.ferryFoot === false && f.productionBlocked === true));
t('T18 Beacon road tile codes identical old/new', (() => {
  const d = trav.checks.find(c => c.id === 'D16_beacon_road_unchanged').detail;
  return JSON.stringify(d.old) === JSON.stringify(d.corrected);
})());
t('T19 deterministic across reload', trav.checks.find(c => c.id === 'D18_deterministic').detail.reloadIdentical === true);
t('T20 no permission leakage over 10086 sampled tiles', (() => {
  const d = trav.checks.find(c => c.id === 'D20_no_permission_leakage').detail;
  return d.samples > 10000 && d.activePermissionTrue === 0 && d.waterFootTrue === 0 &&
    d.boatTrue === 0 && d.swimTrue === 0 && d.ferryFootTrue === 0 && d.buildTrue === 0;
})());
const shots = fs.readdirSync(path.join(ROOT, 'evidence/mapgeo02-shots')).filter(f => f.endsWith('.png'));
eq('T21 52 native screenshots', shots.length, 52);
t('T22 every screenshot exactly 640x360', shots.every(f =>
  JSON.stringify(pngSize(path.join(ROOT, 'evidence/mapgeo02-shots', f))) === '[640,360]'));
t('T23 before+after shots exist per run', [...trav.matchingCoordinateRuns, ...trav.bridgeRuns, ...trav.cliffRuns]
  .every(r => fs.existsSync(path.join(ROOT, 'evidence/mapgeo02-shots', r.before.file.split('/').pop())) &&
    fs.existsSync(path.join(ROOT, 'evidence/mapgeo02-shots', r.after.file.split('/').pop()))));
t('T24 four acceptance states separate', Object.keys(trav.acceptance).length >= 4 &&
  trav.acceptance.VISUAL === 'NOT_REQUESTED_AND_NOT_GRANTED' && trav.acceptance.GAMEPLAY === 'NOT_REQUESTED_AND_NOT_GRANTED');
t('T25 no VEYRA_PLAYABLE / production merge / full-world visual acceptance',
  trav.acceptance.veyraPlayable === false && trav.acceptance.productionMerge === false &&
  trav.acceptance.fullWorldVisualAcceptance === false);
t('T26 noClaims explicit', ['NO production traversal permission', 'NO GOLD amendment', 'NO new atlas/art/world',
  'NO PR44 edit/merge', 'NO full-world visual acceptance', 'NO VEYRA_PLAYABLE'].every(x => trav.noClaims.includes(x)));

/* ---- N: forbidden strings in the delivered executable / docs ---- */
t('N01 no VEYRA_PLAYABLE claim in HTML', !/VEYRA_PLAYABLE\s*=\s*true|status:\s*['"]?VEYRA_PLAYABLE/i.test(deliverable));
t('N02 no production merge claim in build evidence', !JSON.stringify(build).includes('MERGE_READY'));
t('N03 no full-world visual acceptance claim', !JSON.stringify(trav).includes('VISUAL_ACCEPTED'));

console.log(`U05_MAPGEO02_TESTS ${n - failed}/${n} PASS` + (failed ? ` (${failed} FAIL)` : ''));
process.exit(failed ? 1 : 0);
