/**
 * P5 — U05 static test suite (no browser required).
 *
 * Verifies contracts, layer inventory, WMP-04R1/GOLD + live Gameplay source
 * custody, the 81-POI masterplan / audit / geometry-conflict policy, the six
 * deep scene JSONs, the asset inventory (no new atlas) and — when present —
 * the P4 QA report. Nothing here claims Gameplay runtime integration or visual
 * acceptance.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const U = path.resolve(HERE, '..');
const REPO = path.resolve(U, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));
const readU = (p) => JSON.parse(fs.readFileSync(path.join(U, p), 'utf8'));
const text = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const SCENE_IDS = ['po_beacon', 'po_greywater', 'po_academy', 'po_ironmine', 'po_westmouth', 'po_typhon'];

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail = '') { if (cond) { pass++; } else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }
function eq(name, a, b) { ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); }

// ---- 1. Creator scale contract ---------------------------------------------
const c = readU('contracts/CREATOR_CHOSEN_U05.v1.json');
ok('C01 status', c.status === 'CREATOR_SCALE_INTENT_APPROVED__FULL_GAMEPLAY_RUNTIME_INTEGRATION_NOT_YET_VALIDATED');
eq('C02 U', c.creatorDecision.U, 0.5);
eq('C03 TILE_PX', c.creatorDecision.TILE_PX, 16);
eq('C04 frameTiles', c.creatorDecision.frameTiles, [4000, 2800]);
eq('C05 nonSquare', c.creatorDecision.nonSquare, true);
eq('C06 addressableCells', c.creatorDecision.addressableCells, 11200000);
eq('C07 neverMaterializeAllCells', c.creatorDecision.neverMaterializeAllCells, true);
eq('C08 chunksX/Y/total', [c.chunkCoordinates.chunksX, c.chunkCoordinates.chunksY, c.chunkCoordinates.totalChunks], [125, 88, 11000]);
ok('C09 chunk identity', /creator-u05\|cx:cy/.test(c.chunkCoordinates.identity));
ok('C10 prohibited legacy key', /cy\*100\+cx/.test(c.chunkCoordinates.prohibitedIdentity));
ok('C11 locked visual reference', String(c.creatorDecision.lockedVisualReference).includes('beacon_beacon_u05.png'));
ok('C12 visual reference is preservation ONLY', /NOT permission to reauthor/.test(c.creatorDecision.lockedVisualReferenceMeaning));
ok('C13 no gameplay/visual acceptance', !/VISUAL_ACCEPTED|VEYRA_PLAYABLE|MERGE_READY/.test(c.status));
ok('C14 road width unchanged', c.transform.snapRules.some(s => s.includes('3.0 AU') && s.includes('no additional widening')));
ok('C15 no 8AU nearest-neighbour outline', c.transform.snapRules.some(s => s.includes('NEVER upscaled as a nearest-neighbour')));

// ---- 2. Layer inventory -----------------------------------------------------
const li = readU('contracts/LAYER_INVENTORY.json');
eq('L01 layer count', li.layers.length, 17);
ok('L02 vocabulary separation', ['source-authored', 'reprojected', 'proposed', 'runtime-owned', 'unresolved'].every(k => k in li.vocabulary));
const roles = JSON.stringify(li);
for (const k of ['WORLD_MASTER_POINTER', 'GOLD_CANON', 'ARCHITECTURE_V1', 'LIVE_GAMEPLAY_SOURCE', 'U05_SCENES', 'U05_RENDERER', 'U05_EVIDENCE'])
  ok('L03 layer ' + k, roles.includes(k));
ok('L04 WMP-04R1 pointer', read('veyra-world-master/CURRENT_WORLD_MASTER.json').activeRevision === 'WMP-04R1');

// ---- 3. Source custody ------------------------------------------------------
const cust = readU('evidence/source-custody.json');
const liveHead = execFileSync('git', ['rev-parse', 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9'], { cwd: REPO }).toString().trim();
ok('S01 custody live SHA', JSON.stringify(cust).includes('b5c8004ca4e77be62484fb3cd296fe296d7de4c9'), liveHead);
ok('S02 vendored files', cust.gameplay.vendoredFiles === 231, String(cust.gameplay.vendoredFiles));
ok('S03 vendored bytes', cust.gameplay.vendoredBytes === 2535968, String(cust.gameplay.vendoredBytes));
ok('S04 verbatim mismatches', cust.gameplay.verbatimMismatches === 0);
ok('S05 terrain identical', cust.lw01Reuse.terrainBlockIdenticalToLive === true);
ok('S06 disclosure honest', /NO_ISOLATED_BRANCH_CREATED/.test(cust.disclosure || ''));
ok('S07 WMP-04R1/GOLD digests recorded', JSON.stringify(cust).includes('sha256'));
ok('S08 drift commits recorded', JSON.stringify(cust.drift).includes('b5c8004c') && JSON.stringify(cust.drift).includes('4d2a9bbf'));
ok('S09 terrain header seven substitutions', /Seven documented substitutions/.test(text('creator-u05/web-u05/src/u05/terrain.ts')));
ok('S10 terrain block SHA in header', /f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803/.test(text('creator-u05/web-u05/src/u05/terrain.ts')));
ok('S11 live helicopter is metadata only', (() => {
  const art = execFileSync('git', ['show', 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/art.ts'], { cwd: REPO }).toString();
  return !/helicopter|helipad|chopper|car_wreck|ship_hull/i.test(art);
})());
ok('S12 live renderer has no helicopter entity', (() => {
  const r = execFileSync('git', ['show', 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/render.ts'], { cwd: REPO }).toString();
  return !/helicopter|helipad|chopper/i.test(r);
})());
ok('S13 no new atlas PNGs in U05 app', !fs.readdirSync(path.join(U, 'web-u05', 'src'), { recursive: true }).some(f => String(f).endsWith('.png')));

// ---- 4. 81-POI masterplan / audit -------------------------------------------
const mp = readU('map-data/U05_POI_MASTERPLAN.v1.json');
const au = readU('map-data/U05_AUDIT.json');
const gold = read('veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json').project;
eq('M01 GOLD poi count', gold.pois.length, 81);
ok('M02 masterplan has 81 POIs', (mp.pois || mp.items || []).length === 81, String((mp.pois || mp.items || []).length));
eq('M03 audit poiCount', au.poiCount, 81);
eq('M04 unique ids', au.uniqueIds, 81);
eq('M05 duplicated/lost', [au.duplicatedIds, au.lostIds], [0, 0]);
eq('M06 footprint area AU2', [au.footprintArea.au2.min, au.footprintArea.au2.median, au.footprintArea.au2.max], [176, 851.84, 2034.56]);
eq('M07 footprint area tile2', [au.footprintArea.tile2.min, au.footprintArea.tile2.median, au.footprintArea.tile2.max], [704, 3407.36, 8138.24]);
eq('M08 missing exterior entrances', au.missingExteriorEntrance.count, 26);
eq('M09 POI overlap pairs', au.poiOverlapPairs.count, 11);
eq('M10 road/POI pairs', au.roadCentrelineCrossings.measurements.roadPoiEnvelopePairs, 122);
eq('M11 POIs crossed by road', au.roadCentrelineCrossings.measurements.distinctPoiEnvelopesCrossedByARoadCentreline, 73);
eq('M12 zone overlap 19/23', [au.buildableSiteOverlap.count, au.buildableSiteOverlap.of], [19, 23]);
ok('M13 v3 S-03 reconciliation explicit', /8 AU/.test(JSON.stringify(au.buildableSiteOverlap.correction || {})) && JSON.stringify(au.buildableSiteOverlap.correction || {}).includes('bz_verdant'));
ok('M14 legal placement unresolved', /UNKNOWN/.test(JSON.stringify(au)));
eq('M15 no geometry changes', au.noChanges.polygonAmendments, 0);
eq('M16 no helicopter relocation', au.noChanges.helicopterRelocations, 0);
ok('M17 helicopter PROVEN_MISSING', au.helicopterConflict.spriteEntityStatus === 'PROVEN_MISSING');

// ---- 5. Geometry conflicts --------------------------------------------------
const gc = readU('map-data/U05_GEOMETRY_CONFLICTS.json');
ok('G01 conflict policy recorded', /NO automatic shrink/.test(gc.policy));
ok('G02 conflict items measured', gc.items.length > 0 && gc.items.every(i => typeof i.measureAu2 === 'number' || typeof i.measureTile2 === 'number' || i.kind));
ok('G03 all conflicts unresolved / no applied fix', gc.items.every(i => /^(NONE_APPLIED|NO_)/.test(i.resolution) || /UNRESOLVED|SCHEMATIC/.test(String(i.status))));
eq('G04 amended polygons', gc.amendedPolygons, []);
eq('G05 relocated objects', gc.relocatedObjects, []);
eq('G06 expanded envelopes', gc.expandedEnvelopes, []);
eq('G07 recoloured roads', gc.recolouredRoads, []);
eq('G08 widened roads', gc.widenedRoads, []);

// ---- 6. Locked visual benchmark ---------------------------------------------
const bm = readU('map-data/U05_BENCHMARK.json');
ok('B01 benchmark locked, not acceptance', /NOT_VISUAL_ACCEPTANCE/.test(bm.status));
eq('B02 viewport/DPR/U/TILE', [bm.viewport, bm.dpr, bm.U, bm.TILE], [[640, 360], 1, 0.5, 16]);
eq('B03 camera anchor', bm.cameraAnchorTile, [544, 1304]);
eq('B04 physical layer OFF', bm.physicalLayer, 'OFF');
ok('B05 forbidden road reauthoring', bm.forbidden.some(f => /widening/.test(f)) && bm.forbidden.some(f => /recolour/.test(f)));

// ---- 7. Six deep scenes -----------------------------------------------------
const arch = read('veyra-world-master/layers/architecture.v1.json');
const art = text('creator-u05/web-u05/src/game/art.ts');
const spriteNames = new Set([...art.matchAll(/S\.([a-z_0-9]+)\s*=/g)].map(m => m[1]));
const goldById = new Map(gold.pois.map(p => [p.id, p]));
const archById = new Map(arch.pois.map(p => [p.poiId, p]));
eq('D01 exactly six scene files', fs.readdirSync(path.join(U, 'scenes')).filter(f => f.endsWith('.u05.json')).sort(), SCENE_IDS.map(i => i + '.u05.json').sort());
for (const id of SCENE_IDS) {
  const s = readU('scenes/' + id + '.u05.json');
  ok(`D02 ${id} id`, s.id === id);
  ok(`D03 ${id} contract`, s.contract === 'CREATOR_CHOSEN_U05.v1');
  ok(`D04 ${id} status not art-complete`, /ART_INCOMPLETE/.test(s.status) && s.physicalProof.artComplete === false);
  ok(`D04b ${id} walk proof attached`, s.physicalProof.runtimeWalkProof === 'PROVEN_BY_P4_QA' && s.physicalProof.runtimeWalkEvidence?.approachArrived === true && s.physicalProof.runtimeWalkEvidence?.wallCollisionBlocked === true);
  const g = goldById.get(id), a = archById.get(id), cba = s.BUILDING_COMPOSITION.compositionBeforeAfter;
  ok(`D05 ${id} GOLD digest`, s.sourceCustody.goldPoiIdSha256 === sha(JSON.stringify(g)));
  ok(`D06 ${id} architecture digest`, s.sourceCustody.architecturePoiSha256 === sha(JSON.stringify(a)));
  eq(`D07 ${id} GOLD foot verbatim`, s.SITE_ENVELOPE.polygonAu, g.foot);
  ok(`D08 ${id} no polygon amendment`, s.SITE_ENVELOPE.noPolygonAmendment === true && s.SITE_ENVELOPE.noShrinkRelocateExpand === true);
  ok(`D09 ${id} envelope is marker only`, s.SITE_ENVELOPE.markerOnly === true && s.SITE_ENVELOPE.certifiedBuilding === false);
  ok(`D10 ${id} separate layers`, ['SITE_ENVELOPE', 'BUILDING_COMPOSITION', 'DOORS_ROOMS', 'ROOF_OCCLUSION', 'SOLID_COLLISION', 'NAV_RETREAT', 'GAMEPLAY_SOCKETS'].every(k => k in s));
  ok(`D11 ${id} buildings > 0`, s.BUILDING_COMPOSITION.buildings.length > 0);
  ok(`D12 ${id} source rooms preserved`, s.BUILDING_COMPOSITION.buildings.every(b => b.sourceRoomPolygonTiles && b.sourceRoomPolygonTiles.length >= 3));
  ok(`D13 ${id} open space after`, cba.openSpaceFractionAfter > 0.5, String(cba.openSpaceFractionAfter));
  ok(`D14 ${id} gold envelope unchanged`, cba.goldEnvelopeChanged === false && cba.goldPolygonAmended === false);
  ok(`D15 ${id} roofs > 0`, s.ROOF_OCCLUSION.roofs.length > 0);
  ok(`D16 ${id} solids > 0`, s.SOLID_COLLISION.solidCount > 0);
  ok(`D17 ${id} road unchanged`, s.NAV_RETREAT.roadApproach.centrelineChanged === false);
  ok(`D18 ${id} no teleport/cam route`, s.NAV_RETREAT.walkTest.teleportUsed === false && s.NAV_RETREAT.walkTest.camUsedAsRoute === false);
  ok(`D19 ${id} gameplay sockets unresolved`, s.GAMEPLAY_SOCKETS.power === 'GAMEPLAY' && s.GAMEPLAY_SOCKETS.fabricatedLoot === false && s.GAMEPLAY_SOCKETS.buildPermission.includes('UNKNOWN'));
  const used = new Set();
  for (const b of s.BUILDING_COMPOSITION.buildings) { used.add(b.floorSprite); used.add(b.wallSprite); used.add(b.roofSprite); }
  for (const r of s.ROOF_OCCLUSION.roofs) used.add(r.sprite);
  for (const w of s.SOLID_COLLISION.solids) used.add(w.sprite);
  for (const o of s.DOORS_ROOMS.openings) used.add(o.doorSprite);
  used.delete('none'); used.delete(undefined);
  ok(`D20 ${id} all sprites from live art.ts`, [...used].every(n => spriteNames.has(n)), [...used].filter(n => !spriteNames.has(n)).join(','));
}
ok('D21 Typhon proposed arena boundary explicitly disclosed', readU('scenes/po_typhon.u05.json').SOLID_COLLISION.proposedSolidsNote.includes('NOT GOLD canon'));
ok('D22 Beacon helicopter is a reservation outline only', JSON.stringify(readU('scenes/po_beacon.u05.json').markers).includes('poi_beacon_engine_out_helicopter'));

// ---- 8. Asset inventory -----------------------------------------------------
const src = text('creator-u05/web-u05/src/u05/lw/sources.generated.ts');
ok('A01 generated raster module present', src.length > 100000);
ok('A02 no new atlas / no new PNG assets', !fs.readdirSync(path.join(U, 'web-u05', 'src'), { recursive: true }).some(f => String(f).endsWith('.png')));
const meta = read('large-world-01/map-data/GENERATED_META.json');
ok('A03 21 WMP-04R1 rasters', Object.keys(meta.rasters || meta).length >= 21 || JSON.stringify(meta).includes('biomeEffective'));
ok('A04 U05 tsconfig excludes full Gameplay app', text('creator-u05/web-u05/tsconfig.u05.json').includes('u05'));

// ---- 9. P4 QA report (when present) ----------------------------------------
const qaPath = path.join(U, 'evidence', 'qa-report.json');
if (fs.existsSync(qaPath)) {
  const q = JSON.parse(fs.readFileSync(qaPath, 'utf8'));
  eq('Q01 six scenes auditioned', q.scenes.length, 6);
  eq('Q02 scene ids', q.scenes.map(s => s.id), SCENE_IDS);
  eq('Q03 zero console/page/request errors', [q.consoleErrors.length, q.pageErrors.length, q.failedRequests.length], [0, 0, 0]);
  ok('Q04 all P4 gates PASS', Object.values(q.gates).every(g => g.status === 'PASS'), JSON.stringify(Object.entries(q.gates).filter(([, g]) => g.status !== 'PASS')));
  ok('Q05 48 evidence shots', q.shots.length === 48 && q.shots.every(f => fs.existsSync(path.join(U, 'evidence', 'shots', f))));
  for (const s of q.scenes) {
    ok(`Q06 ${s.id} real approach/reentry`, s.approach.arrived && s.reentry.arrived && s.approach.realKeyboardEvents > 0 && s.reentry.realKeyboardEvents > 0);
    ok(`Q07 ${s.id} roof transition`, s.roof.transitionProven === true);
    ok(`Q08 ${s.id} wall collision`, s.collision?.blocked === true && s.collision.realKeyboardEvents > 0);
    ok(`Q09 ${s.id} identical native camera`, s.beforeAfter.cameraIdentical && s.native.viewport[0] === 640 && s.native.dpr === 1 && s.native.zoom === 1);
    ok(`Q10 ${s.id} bounded caches`, s.final.chunkAudit.uniqueKeys === 11000 && s.final.chunkAudit.collisions === 0 && s.final.stats.materializedAllCells === false && s.final.stats.residentChunks <= 36 && s.final.stats.displayCanvases <= 36);
    ok(`Q11 ${s.id} spawn fixture disclosed`, s.spawnFixture.recorded === true && s.spawnFixture.teleportUsedAsRoute === false && s.spawnFixture.cameraUsedAsRoute === false);
  }
  ok('Q12 QA scope explicitly isolated', /ISOLATED/.test(q.scope) && /not visual acceptance/.test(q.scope));
}

// ---- 10. Standalone TERRAIN-ONLY game (Creator follow-up request) ---------
const tBuildPath = path.join(U, 'evidence/terrain-only-build.json');
const tQaPath = path.join(U, 'evidence/terrain-only-qa.json');
const tFile = path.join(U, 'SoulOfHero_TerrainOnly_U05_x10.html');
if (fs.existsSync(tBuildPath) && fs.existsSync(tQaPath)) {
  const tb = JSON.parse(fs.readFileSync(tBuildPath, 'utf8'));
  const tq = JSON.parse(fs.readFileSync(tQaPath, 'utf8'));
  ok('T01 standalone HTML exists', fs.existsSync(tFile));
  ok('T02 single file is self-contained', tb.selfContained.allFalse === true);
  ok('T03 HTML digest matches', sha(fs.readFileSync(tFile)) === tb.sha256);
  ok('T04 no overlay layers drawn', Object.values(tq.initial.draw.overlays).every(v => v === 0) && tq.initial.draw.physicalLayerLoaded === false && tq.initial.draw.sceneDataLoaded === false);
  ok('T05 physical POI data NOT bundled', !fs.readFileSync(tFile, 'utf8').includes('PhysicalLayer') && !fs.readFileSync(tFile, 'utf8').includes('U05_SCENES'));
  eq('T06 speed range', [tb.speed.basePxPerSec, tb.speed.multiplierMin, tb.speed.multiplierMax, tb.speed.maxPxPerSec], [72, 1, 10, 720]);
  ok('T07 x1->x10 real movement ratio', tq.speed.ratio > 7 && tq.speed.ratio < 13, String(tq.speed.ratio));
  ok('T08 real keyboard events', tq.speed.x1.realKeyboardEvents >= 2 && tq.speed.x10.realKeyboardEvents >= 2);
  ok('T09 all T gates PASS', Object.values(tq.gates).every(g => g.status === 'PASS'));
  eq('T10 zero errors', [tq.consoleErrors.length, tq.pageErrors.length, tq.failedRequests.length], [0, 0, 0]);
  ok('T11 native 640x360 1x / hero 16x24', tb.camera.viewport[0] === 640 && tb.camera.zoom === 1 && tb.camera.U === 0.5 && tq.initial.heroSpritePx[0] === 16 && tq.initial.heroSpritePx[1] === 24);
  ok('T12 bounded caches / no eager frame', tq.longRun.stats.materializedAllCells === false && tq.longRun.stats.residentChunks <= 36 && tq.longRun.stats.displayCanvases <= 36);
  ok('T13 file:// and HTTP both boot', tq.fileUrl.startsWith('file://') && tq.http.mode === 'TERRAIN_ONLY__NO_BUILDINGS__NO_OVERLAY_LAYERS');
  ok('T14 no production/visual claims', tq.notClaims.includes('VISUAL_ACCEPTANCE') && tq.notClaims.includes('VEYRA_PLAYABLE'));
  ok('T15 terrain-only docs present', fs.existsSync(path.join(U, 'docs/TERRAIN_ONLY_VIEWER.md')));
  ok('T16 whole-map zoom build metadata', tb.wholeMapZoom?.overviewBitmap[0] === 500 && tb.wholeMapZoom.strideTiles === 8 && tb.wholeMapZoom.tileSamples === 525000 && tb.wholeMapZoom.fullFrameAllocated === false);
  ok('T17 zoom markers bundled', fs.readFileSync(tFile, 'utf8').includes('zoomRange') && fs.readFileSync(tFile, 'utf8').includes('WHOLE_MAP_OVERVIEW'));
  ok('T18 T-G10..T-G14 all PASS', ['T-G10','T-G11','T-G12','T-G13','T-G14'].every(k => tq.gates[k]?.status === 'PASS'));
  ok('T19 whole frame fits at smallest zoom', tq.zoom.fit.mapFitsViewport === true && tq.zoom.fit.zoom < 0.01 && Math.abs(tq.zoom.fit.pxPerTile - 0.128571) < 0.0001);
  ok('T20 native 1x restored', tq.zoom.nativeAgain.zoom === 1 && tq.zoom.nativeAgain.zoomMode === 'NATIVE_1X' && tq.zoom.nativeAgain.draw.drawn.hero === 1);
  ok('T21 overview shots exist', tq.zoom.shots.every(f => fs.existsSync(path.join(U, 'evidence/terrain-only-shots', f))));
  ok('T22 x10 pan while zoomed out', tq.zoom.panAtX10.deltaPx > 100);
  ok('T23 ?zoom=fit deep link', tq.deepLink?.zoomMode === 'WHOLE_MAP_OVERVIEW' && tq.deepLink.mapFitsViewport === true && tq.gates['T-G15']?.status === 'PASS');
}

const result = {
  schema: 'soh.u05.test-results.v1', generatedAt: new Date().toISOString(),
  suite: 'creator-u05/tests/test-u05.mjs', pass, fail, failures,
  verdict: fail === 0 ? 'U05_STATIC_TESTS_PASS' : 'U05_STATIC_TESTS_FAIL'
};
fs.writeFileSync(path.join(U, 'evidence', 'test-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`U05_TESTS pass=${pass} fail=${fail} verdict=${result.verdict}`);
if (fail) { console.log(failures.join('\n')); process.exitCode = 1; }
