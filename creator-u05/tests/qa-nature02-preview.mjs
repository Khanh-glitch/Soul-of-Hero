/** Small HTTP live-preview smoke for NATURE-02 (no visual-acceptance claim).
 *  Verifies the two NEW routes without changing the four pre-existing ones. */
import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const BASE_SHA = '540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0';
const N1_SHA = 'ac4d54e310f0f3cf7e0e12d728bc5e9ad62f801994be37ce64f76b099af4a0a7';
const N2_SHA = sha(fs.readFileSync(path.join(ROOT, 'SoulOfHero_Nature02_ForestSlice.html')));
const ORIGIN = 'http://127.0.0.1:5183';

const routes = [
  { path: '/', expect: BASE_SHA, download: false },
  { path: '/download', expect: BASE_SHA, download: true },
  { path: '/nature01', expect: N1_SHA, download: false },
  { path: '/nature01-download', expect: N1_SHA, download: true },
  { path: '/nature02', expect: N2_SHA, download: false },
  { path: '/nature02-download', expect: N2_SHA, download: true }
];
const routeResults = [];
for (const r of routes) {
  const res = await fetch(ORIGIN + r.path);
  const buf = Buffer.from(await res.arrayBuffer());
  routeResults.push({ path: r.path, status: res.status, bytes: buf.length, sha256: sha(buf),
    contentDisposition: res.headers.get('content-disposition'),
    contentType: res.headers.get('content-type'),
    matchesOnDisk: sha(buf) === r.expect,
    downloadHeaderOk: r.download ? /attachment/.test(res.headers.get('content-disposition') || '') : !/attachment/.test(res.headers.get('content-disposition') || '') });
}

const b = await chromium.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib' }
});
const p = await (await b.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })).newPage();
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await p.goto(ORIGIN + '/nature02', { waitUntil: 'load' });
await p.waitForFunction(() => window.__nature02 && window.__nature02.ready === true, { timeout: 60000 });
const first = await p.evaluate(() => window.__nature02.state());
await p.keyboard.press('n');
const off = await p.evaluate(() => window.__nature02.state());
await p.keyboard.press('n');
const on = await p.evaluate(() => window.__nature02.state());
await p.keyboard.press('m');
const auditOpen = await p.evaluate(() => document.getElementById('artAudit').classList.contains('audit-open'));
const auditSheetNonBlank = await p.evaluate(() => {
  const c = document.getElementById('artAudit');
  const d = c.getContext('2d').getImageData(0, 0, 640, 360).data;
  const s = new Set();
  for (let i = 0; i < d.length; i += 4000) s.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
  return s.size > 3;
});
await p.keyboard.press('m');
const auditClosed = await p.evaluate(() => !document.getElementById('artAudit').classList.contains('audit-open'));
const presets = {};
for (const [key, tile] of Object.entries({ dense_interior: [1416, 1320], clearing: [1408, 1332], road_forest_edge: [1452, 1316] })) {
  await p.locator(`#sitePresets button[data-comp="${key}"]`).click();
  await p.waitForTimeout(180);
  const st = await p.evaluate(() => window.__nature02.state());
  presets[key] = { tile: st.player.tile, expected: tile, objects: st.forest.drawnThisFrame,
    composition: st.forest.compositions.length, productionApproved: st.forest.productionApproved };
}
const pass =
  routeResults.every(r => r.status === 200 && r.matchesOnDisk && r.downloadHeaderOk) &&
  first.ready && errors.length === 0 &&
  first.forest.enabled === true && off.forest.enabled === false && on.forest.enabled === true &&
  auditOpen === true && auditClosed === true && auditSheetNonBlank === true &&
  Object.entries(presets).every(([k, v]) => JSON.stringify(v.tile) === JSON.stringify(v.expected) && v.objects > 0 && v.composition === 3 && v.productionApproved === false);
const record = {
  schema: 'soh.u05.nature02-preview.v1',
  generatedAt: new Date().toISOString(),
  url: ORIGIN + '/nature02',
  previewHost: 'https://5183-iedijpwzkleoc2bvjmqg0.e2b.app/nature02',
  downloadHost: 'https://5183-iedijpwzkleoc2bvjmqg0.e2b.app/nature02-download',
  ready: first.ready, viewport: first.viewport, dpr: first.dpr,
  routes: routeResults,
  nKeyToggle: [first.forest.enabled, off.forest.enabled, on.forest.enabled],
  mKeyArtAuditToggle: [auditOpen, auditClosed], artAuditSheetNonBlank: auditSheetNonBlank,
  presets, pilotStatus: first.forest.ownerDependency.pilotStatus,
  pageErrors: errors, pass,
  note: 'Live-preview route + UI smoke only. NOT visual acceptance, NOT production approval.'
};
fs.writeFileSync(path.join(ROOT, 'evidence/nature02-preview.json'), JSON.stringify(record, null, 2) + '\n');
console.log(`U05_NATURE02_PREVIEW ${pass ? 'PASS' : 'FAIL'} routes=${routeResults.length}/6 nToggle=${record.nKeyToggle.join('->')} mToggle=${auditOpen}->${auditClosed} presets=${Object.keys(presets).length} errors=${errors.length}`);
await b.close();
if (!pass) process.exit(1);
