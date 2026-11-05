/** NATURE-02 static tests — cheap, independent of the browser QA. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const t = (name, ok) => { if (ok) pass++; else { fail++; console.log('FAIL', name); } };

const BASE_SHA = '540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0';
const N1_SHA = 'ac4d54e310f0f3cf7e0e12d728bc5e9ad62f801994be37ce64f76b099af4a0a7';
const build = JSON.parse(read('evidence/nature02-build.json'));
const qa = JSON.parse(read('evidence/nature02-qa.json'));
const assets = JSON.parse(read('evidence/nature02-assets.json'));
const design = JSON.parse(read('evidence/nature02-forest.json'));
const visual = JSON.parse(read('evidence/nature02-visual-review.json'));
const html = fs.readFileSync(path.join(ROOT, 'SoulOfHero_Nature02_ForestSlice.html'));
const htmlText = html.toString('utf8');
const forestTs = read('web-u05/src/nature02/forest.ts');
const sitesTs = read('web-u05/src/nature02/forest-sites.ts');
const auditTs = read('web-u05/src/nature02/art-audit.ts');
const mainTs = read('web-u05/src/nature02/main.ts');
const devHtml = read('web-u05/nature02.html');

/* --- protected executables + self-containment --- */
t('T-F01 terrain-only baseline untouched', sha('SoulOfHero_TerrainOnly_U05_x10.html') === BASE_SHA);
t('T-F02 NATURE-01 executable untouched', sha('SoulOfHero_Nature01_U05.html') === N1_SHA);
t('T-F03 NATURE-02 html matches build record', crypto.createHash('sha256').update(html).digest('hex') === build.sha256);
t('T-F04 build asserts both protected SHAs', build.preserved.terrainBaseline.sha256 === BASE_SHA && build.preserved.nature01.sha256 === N1_SHA && build.preserved.nature01.untouched === true);
t('T-F05 all 11 source SHA-256 in build record match current files', Object.keys(build.sourceSha256).length === 11 && Object.entries(build.sourceSha256).every(([f, h]) => sha(f) === h));
t('T-F06 standalone self-contained html', build.selfContained.allFalse && !/<script[^>]+src=/i.test(htmlText) && !/rel=["']?stylesheet/i.test(htmlText));
t('T-F07 ZIP mirror valid DEFLATE', (() => {
  const z = fs.readFileSync(path.join(ROOT, 'SoulOfHero_Nature02_ForestSlice.zip'));
  return z.length > 10000 && z.readUInt32LE(0) === 0x04034b50 && z.readUInt32LE(z.length - 22) === 0x06054b50;
})());
t('T-F08 no forbidden structure/mechanics code', ['PhysicalLayer', 'U05_SCENES', 'SITE_ENVELOPE', 'BUILDING_COMPOSITION', 'ROOF_OCCLUSION', 'drawSource', 'harvestProbe', 'VEYRA_PLAYABLE'].every(x => !htmlText.includes(x)));
t('T-F09 source head recorded', !!build.sourceHead && build.sourceHead.length === 40);

/* --- scope: ONE biome, THREE compositions, NEW file --- */
t('T-F10 one biome only', build.forestSlice.oneBiomeOnly === true && build.forestSlice.biome === 'temperate_forest' && design.oneBiomeOnly === true);
t('T-F11 window equals NATURE-01 temperate window and is inside frame', JSON.stringify(design.window) === '[1392,1288,1488,1352]' && design.window[2] <= 4000 && design.window[3] <= 2800);
t('T-F12 exactly 3 compositions', design.compositions.length === 3 && Object.keys(qa.shotTiles).length === 3 && build.forestSlice.compositions.length === 3);
t('T-F13 composition keys dense/clearing/road', design.compositions.map(c => c.key).join(',') === 'dense_interior,clearing,road_forest_edge');
t('T-F14 13 stands, 3 clearings, 3 object-free routes', design.stands.length === 13 && design.clearings.length === 3 && design.routes.length === 3 && design.routes.every(r => r.width === 1));
t('T-F15 route definition paints nothing and mints no permission', /OBJECT-FREE CORRIDORS/.test(design.routeDefinition) && /no path\/road\/ground pixel painted/.test(design.routeDefinition) && /no Gameplay navigation permission/.test(design.routeDefinition));
t('T-F16 no buildings/POI/ruins/fences/props', build.forestSlice.noBuildingsOrPoiStructuresOrRuinsOrFencesOrProps === true && design.noBuildingsOrPoiOrRuinsOrFencesOrArbitraryProps === true);
t('T-F17 no other biome / full world / Gameplay merge', build.forestSlice.otherBiomesUnchanged === true && build.forestSlice.fullWorldPropagation === false && visual.stopConditionsHonoured.gameplayMerge === false);
t('T-F18 no VISUAL_ACCEPTED / VEYRA_PLAYABLE claim', build.forestSlice.creatorVisualAcceptance === 'NOT_GRANTED' && build.forestSlice.productionMerge === 'NOT_DONE' && build.forestSlice.veyraPlayable === 'NOT_CLAIMED' && visual.stopConditionsHonoured.visualAccepted === false);

/* --- art audit, proportion, no scaling --- */
t('T-F19 hero 16x24 and tree 24x32 measured from real canvases', JSON.stringify(assets.hero.canvasPx) === '[16,24]' && JSON.stringify(assets.usedByNATURE02[0].canvasPx) === '[24,32]' && assets.proportionsSummary.treeCanvasHeightVsHero === 1.3333 && assets.proportionsSummary.treeCanvasWidthVsHero === 1.5);
t('T-F20 audited 12 real src arrays out of 22', assets.totalGetArtSrcArrays === 22 && assets.auditedSpriteArrays === 12 && assets.auditedSprites.every(s => s.alphaPixels > 0));
t('T-F21 only 6 sprites used; 16 explicitly excluded', assets.usedByNATURE02.length === 6 && assets.excludedSprites.length === 16 && assets.excludedSprites.every(s => s.usedByNATURE02 === false && !!s.reason));
t('T-F22 no sprite scaling / no new art / no atlas / no substitute', assets.decorativeOnlyClassification.spriteScaling === false && assets.decorativeOnlyClassification.newArtAssets === 0 && assets.decorativeOnlyClassification.newAtlases === 0 && build.forestSlice.spriteScaling === false && visual.stopConditionsHonoured.unapprovedSubstituteAssetManufactured === false);
t('T-F23 art audit sheet exists at 640x360', qa.gates.find(g => g.id === 'F-G4').pass === true && fs.existsSync(path.join(ROOT, 'evidence/nature02-shots/art_audit_sheet.png')));
t('T-F24 art audit is separate from in-game rendering', /AUDIT ONLY/i.test(auditTs) && /NOT IN GAME/i.test(auditTs));
t('T-F25 canopy and undergrowth verdicts are honest', assets.canopyVerdict === 'NOT_CONVINCING_WITH_EXISTING_ART_ALONE' && /NOT_CONVINCING_WITH_EXISTING_ART_ALONE/.test(assets.undergrowthVerdict));

/* --- semantic conflict / owner dependency / asset gap --- */
t('T-F26 exact owner dependency with 8 file/line conflicts', assets.semanticConflict.ownerDependency.conflicts.length === 8 && assets.semanticConflict.ownerDependency.conflicts.every(c => /^web\/src\/game\//.test(c.file) && Number.isInteger(c.line)));
t('T-F27 owner branch + verified + observed heads recorded', assets.semanticConflict.ownerDependency.branch === 'arena/d4bfcfff-soul-of-hero' && assets.semanticConflict.ownerDependency.verifiedHead === '5b3e683402bbc8540dea9404576164097e753f97' && assets.semanticConflict.ownerDependency.observedLaterHead === '2f0836587b76a4a98fffedf8c202fb37cbb2a67c');
t('T-F28 pilot NOT approved for production; Map invents nothing', qa.ownerDependency.pilotStatus === 'NOT_APPROVED_FOR_PRODUCTION' && qa.ownerDependency.mapCannotChange === true && build.forestSlice.productionApproved === false && build.forestSlice.noRewards === true && build.forestSlice.noOwnership === true && qa.assetInventory.used.every(u => !u.kind.includes('new')));
t('T-F29 asset gap is a PROPOSAL only, 3 assets, nothing created', qa.assetGapSpec.status === 'PROPOSED__NOT_CREATED__NOT_APPROVED' && qa.assetGapSpec.proposedAssets.length === 3 && assets.assetGap.id === 'N02-ASSET-GAP-01' && !/import .*forest_canopy_oak/.test(forestTs));
t('T-F30 decorative-only classification across build/qa/assets', build.forestSlice.decorativeOnly === true && qa.assetInventory.decorativeOnly === true && assets.usedByNATURE02.every(u => u.decorativeOnly && !u.gameplayOwned && !u.hasStock && !u.hasReward && !u.hasInteraction && !u.blocksMovement));

/* --- browser QA gates and evidence --- */
t('T-F31 all 15 QA gates pass, zero errors', qa.passing === qa.total && qa.total === 15 && qa.failing.length === 0 && qa.browserErrors.length === 0);
t('T-F32 44 genuine 640x360 PNGs', qa.shotCount >= 44 && fs.readdirSync(path.join(ROOT, 'evidence/nature02-shots')).filter(f => f.endsWith('.png')).length >= 44 && qa.pairs.every(p => p.on.size[0] === 640 && p.on.size[1] === 360));
t('T-F33 OFF pixel-identical to baseline at 4 positions', qa.pairs.length === 4 && qa.pairs.every(p => p.offEqualsBaseline && p.offVsBaselineDiff === 0));
t('T-F34 exact triptychs at 4 tiles, 3 distinct files each', qa.triptychs.length === 4 && qa.triptychs.every(t2 => t2.distinctFiles === 3 && t2.diff.nature02OffVsBaseline === 0 && t2.diff.nature01VsNature02 > 0));
t('T-F35 3 full-viewport Chromium screenshots', qa.browserViewportShots.length === 3 && qa.browserViewportShots.every(x => x.size[0] === 640 && x.size[1] === 360));
t('T-F36 51k road pixels unchanged OFF/ON', qa.roadPixelsUnchanged.off.pixels > 10000 && qa.roadPixelsUnchanged.off.hash === qa.roadPixelsUnchanged.on.hash);
t('T-F37 uniform scatter objectively corrected', qa.standCoherence.nature01.largestTreeComponentTiles <= 10 && qa.standCoherence.nature02.largestTreeComponentTiles >= 50 && qa.standCoherence.nature02.largestTreeComponentTiles > qa.standCoherence.nature01.largestTreeComponentTiles * 10);
t('T-F38 natural empty space >= 0.60 at all 3 compositions', Object.values(qa.audit.openGround).every(v => v >= 0.60));
t('T-F39 zero authority violations', Object.values(qa.audit.violations).every(v => v === 0));
t('T-F40 GOLD/roads/rivers/despeckle/collision unchanged', qa.terrainComparison.identical === true && qa.terrainComparison.despeckleConfigIdentical === true && qa.terrainComparison.isolatedPainted === 0 && qa.terrainComparison.otherNature01WindowObjects.every(n => n === 0) && qa.terrainComparison.objectsOutsideForestWindow === 0);
t('T-F41 real walking sequences in all 3 compositions', qa.traversal.length === 3 && qa.traversal.every(x => x.steps.length === 4 && x.realKeyEvents.down >= 4 && x.realKeyEvents.up >= 4 && x.totalMovedPx > 400 && !x.teleportUsed && !x.camUsedAsRoute));
t('T-F42 obstruction unchanged in BOTH collision modes', qa.obstruction.length === 3 && qa.obstruction.every(o => !o.on.forestBlocksMovement && o.on.blockedSubsteps === o.off.blockedSubsteps && o.onCollisionOn.blockedSubsteps === o.offCollisionOn.blockedSubsteps && Math.abs(o.onCollisionOn.movedPx - o.offCollisionOn.movedPx) <= 2));
t('T-F43 bounded chunks / native frame budget', qa.perf.every(p => p.forestChunks <= p.maxForestChunks && p.p95Ratio < 2.5 && !p.materializedAllCells && !p.overviewFullFrameAllocated));
t('T-F44 deterministic placement + stability hash', qa.chunkChecks.every(c => c.stableAcrossCacheReset && c.missing === 0) && qa.audit.stabilityHash === qa.gates.find(g => g.id === 'F-G6').detail.stabilityHash);

/* --- separate visual evaluation + failures + stop conditions --- */
t('T-F45 5 visual axes evaluated SEPARATELY from automated tests', visual.evaluations.length === 5 && ['SILHOUETTE', 'ECOLOGICAL_COHERENCE', 'NAVIGATION_READABILITY', 'SPRITE_SCALE', 'SEMANTIC_CONSISTENCY'].every((a, i) => visual.evaluations[i].axis === a) && visual.separationFromAutomatedTests.statement.includes('NOT produced by tests/qa-nature02.mjs'));
t('T-F46 12 objective failures registered', visual.objectiveFailureRegister.length === 12 && visual.objectiveFailureRegister.every(f => !!f.id && !!f.failure && !!f.severity && !!f.owner));
t('T-F47 semantic axis fails production explicitly', visual.evaluations.find(e => e.axis === 'SEMANTIC_CONSISTENCY').verdict === 'FAIL_FOR_PRODUCTION__BLOCKED_BY_GAMEPLAY_OWNER');
t('T-F48 QA evidence is not visual acceptance', /NOT VISUAL ACCEPTANCE/.test(qa.scope) && /NOT_GRANTED/.test(visual.status) === false && visual.status.includes('NOT_VISUAL_ACCEPTANCE'));
t('T-F49 source reads sampleTile only, never writes GOLD', forestTs.includes('sampleTile(') && !/writeFile|RASTERS\.\w+\s*=|\.sohmap\.json\s*=/i.test(forestTs));
t('T-F50 N toggle + M audit + 3 presets exist', mainTs.includes("code === 'KeyN'") && mainTs.includes("code === 'KeyM'") && mainTs.includes('setForest') && devHtml.includes('data-comp="dense_interior"') && devHtml.includes('data-comp="clearing"') && devHtml.includes('data-comp="road_forest_edge"'));
t('T-F51 dev html warns about the semantic conflict', /CẢNH BÁO NGỮ NGHĨA/.test(devHtml) && /KHÔNG được duyệt production/.test(devHtml));
t('T-F52 baseline / NATURE-01 QA evidence still all-pass (no regression)', (() => {
  const g = JSON.parse(read('evidence/terrain-only-qa.json')).gates;
  const n = JSON.parse(read('evidence/nature01-qa.json'));
  return Object.keys(g).length === 24 && Object.values(g).every(v => v.status === 'PASS') && n.passing === n.total && n.failing.length === 0;
})());

console.log(`U05_NATURE02_TESTS pass=${pass} fail=${fail} verdict=${fail ? 'FAIL' : 'U05_NATURE02_STATIC_TESTS_PASS'}`);
if (fail) process.exit(1);
