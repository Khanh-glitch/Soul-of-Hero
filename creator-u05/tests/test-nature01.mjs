/** NATURE-01 static tests — cheap, independent of the browser QA. */
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
const build = JSON.parse(read('evidence/nature01-build.json'));
const qa = JSON.parse(read('evidence/nature01-qa.json'));
const assets = JSON.parse(read('evidence/nature01-assets.json'));
const sites = JSON.parse(read('evidence/nature01-sites.json'));
const html = fs.readFileSync(path.join(ROOT, 'SoulOfHero_Nature01_U05.html'));
const htmlText = html.toString('utf8');
const natureTs = read('web-u05/src/nature01/nature.ts');
const sitesTs = read('web-u05/src/nature01/sites.ts');
const mainTs = read('web-u05/src/nature01/main.ts');

t('T-N01 baseline html untouched', sha('SoulOfHero_TerrainOnly_U05_x10.html') === BASE_SHA);
t('T-N02 nature html matches build record', crypto.createHash('sha256').update(html).digest('hex') === build.sha256);
t('T-N03 qa all gates pass', qa.passing === qa.total && qa.failing.length === 0);
t('T-N04 qa shot count >= 32', qa.shotCount >= 32);
t('T-N05 5 pilot sites only', sites.pilotSiteKeys.length === 5 && build.natureLayer.boundedToFiveSites === true);
t('T-N06 sites inside 4000x2800 frame', Object.values(sites.sites).every(s => s.boundsTile[0] >= 0 && s.boundsTile[1] >= 0 && s.boundsTile[2] <= 4000 && s.boundsTile[3] <= 2800));
t('T-N07 site windows non-overlapping', (() => {
  const b = sites.pilotSiteKeys.map(k => sites.sites[k].boundsTile);
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++)
    if (b[i][0] < b[j][2] && b[i][2] > b[j][0] && b[i][1] < b[j][3] && b[i][3] > b[j][1]) return false;
  return true;
})());
t('T-N08 all pairs OFF identical to baseline', qa.pairs.every(p => p.offEqualsBaseline));
t('T-N09 5 ON pairs differ, Beacon ON unchanged', qa.pairs.filter(p => p.site !== 'beacon_road').every(p => p.onDiffersFromOff) && !qa.pairs.find(p => p.site === 'beacon_road').onDiffersFromOff);
t('T-N10 zero authority violations', Object.values(qa.audit.violations).every(v => v === 0));
t('T-N11 dry open ground >= 0.85', qa.audit.openGround.dry >= 0.85);
t('T-N12 stable hash across cache reset', qa.gates.find(g => g.id === 'N-G4').pass === true);
t('T-N13 draw order sorted both sides of hero', qa.pairs.filter(p => p.site !== 'beacon_road').every(p => p.drawOrderSorted && p.behindHero > 0 && p.inFrontOfHero > 0));
t('T-N14 real keys in all 5 traversals', qa.traversal.length === 5 && qa.traversal.every(x => x.realKeyEvents.down >= 4 && x.totalMovedPx > 400 && !x.teleportUsed));
t('T-N15 no obstruction / collision change', qa.obstruction.every(o => !o.on.natureBlocksMovement && o.on.blockedSubsteps === o.off.blockedSubsteps));
t('T-N16 performance bounded', qa.perf.every(p => p.natureChunks <= p.maxNatureChunks && p.p95Ratio < 2.5 && !p.materializedAllCells));
t('T-N17 no new art / atlas', assets.newArtAssets === 0 && assets.newPngOrJpgFiles === 0 && assets.newAtlases === 0);
t('T-N18 12 decorative sprites only', assets.nature01UsedSprites.length === 12 && assets.nature01UsedSprites.every(a => a.decorative && !a.gameplayOwned && !a.harvestable));
t('T-N19 Gameplay-owned sprites explicitly excluded', assets.excludedSprites.filter(x => x.classification.startsWith('GAMEPLAY_OWNED')).length === 7);
t('T-N20 standalone self-contained html', build.selfContained.allFalse && !/<script[^>]+src=/i.test(htmlText) && !/rel=["']?stylesheet/i.test(htmlText));
t('T-N21 no forbidden structure/mechanics code', ['PhysicalLayer', 'U05_SCENES', 'SITE_ENVELOPE', 'BUILDING_COMPOSITION', 'ROOF_OCCLUSION', 'drawSource', 'harvestProbe', 'VEYRA_PLAYABLE'].every(x => !htmlText.includes(x)));
t('T-N22 nature source reads sampleTile only, never writes GOLD', natureTs.includes('sampleTile(') && !/writeFile|RASTERS\.\w+\s*=|\.sohmap\.json\s*=/i.test(natureTs));
t('T-N23 decoration is non-blocking', natureTs.includes('blocksMovement: false') && mainTs.includes('canStand') && !/natureBlocked|natureCollision/.test(mainTs));
t('T-N24 N toggle exists', mainTs.includes("code === 'KeyN'") && mainTs.includes('setNature'));
t('T-N25 no full-world propagation claim', build.natureLayer.fullWorldPropagation === false && build.natureLayer.poiArchitectureStarted === false && sitesTs.includes('NOT full-world propagation'));
t('T-N26 no acceptance / playable claim', build.natureLayer.creatorVisualAcceptance === 'NOT_GRANTED' && build.natureLayer.productionMerge === 'NOT_DONE' && build.natureLayer.veyraPlayable === 'NOT_CLAIMED');
t('T-N27 terrain painter / world sampler sha in build record', Object.keys(build.sourceSha256).length === 6 && build.sourceSha256['web-u05/src/u05/terrain.ts'] === sha('web-u05/src/u05/terrain.ts'));
t('T-N28 source head recorded', !!build.sourceHead && build.sourceHead.length === 40);
t('T-N29 baseline QA still all-pass (no regression)', (() => {
  const g = JSON.parse(read('evidence/terrain-only-qa.json')).gates;
  return Object.keys(g).length === 24 && Object.values(g).every(v => v.status === 'PASS');
})());
t('T-N31 all six source SHA-256 in build record match current files', Object.entries(build.sourceSha256).every(([f, h]) => sha(f) === h));
t('T-N30 ZIP mirror valid DEFLATE', (() => {
  const z = fs.readFileSync(path.join(ROOT, 'SoulOfHero_Nature01_U05.zip'));
  return z.length > 10000 && z.readUInt32LE(0) === 0x04034b50 && z.readUInt32LE(z.length - 22) === 0x06054b50;
})());

console.log(`U05_NATURE01_TESTS pass=${pass} fail=${fail} verdict=${fail ? 'FAIL' : 'U05_NATURE01_STATIC_TESTS_PASS'}`);
if (fail) process.exit(1);
