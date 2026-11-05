/** Small HTTP live-preview smoke for the NATURE-01 pilot (no visual claim). */
import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const b = await chromium.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib' }
});
const p = await (await b.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })).newPage();
const errors = [];
p.on('pageerror', e => errors.push(e.message));
await p.goto('http://127.0.0.1:5183/nature01', { waitUntil: 'load' });
await p.waitForFunction(() => window.__nature && window.__nature.ready === true, { timeout: 60000 });
const first = await p.evaluate(() => window.__nature.state());
await p.keyboard.press('n');
const off = await p.evaluate(() => window.__nature.state());
await p.locator('#sitePresets button[data-site="marsh"]').click();
await p.waitForTimeout(200);
const marsh = await p.evaluate(() => window.__nature.state());
await p.keyboard.press('n');
await p.waitForTimeout(200);
const on = await p.evaluate(() => window.__nature.state());
const record = {
  schema: 'soh.u05.nature01-preview.v1',
  generatedAt: new Date().toISOString(),
  url: 'http://127.0.0.1:5183/nature01',
  previewHost: 'https://5183-iedijpwzkleoc2bvjmqg0.e2b.app/nature01',
  ready: first.ready,
  viewport: first.viewport, dpr: first.dpr,
  nKeyToggle: [first.nature.enabled, off.nature.enabled, on.nature.enabled],
  siteButtonResultTile: marsh.player.tile,
  siteButtonExpectedShotTile: [2152, 828],
  natureObjectsAtMarsh: on.nature.drawnThisFrame,
  mode: on.mode,
  pageErrors: errors,
  pass: first.ready && errors.length === 0 &&
    first.nature.enabled === true && off.nature.enabled === false && on.nature.enabled === true &&
    JSON.stringify(marsh.player.tile) === JSON.stringify([2152, 828]) && on.nature.drawnThisFrame > 0,
  note: 'Live-preview route check only. NOT visual acceptance.'
};
fs.writeFileSync(path.join(ROOT, 'evidence/nature01-preview.json'), JSON.stringify(record, null, 2) + '\n');
console.log(`U05_NATURE01_PREVIEW ${record.pass ? 'PASS' : 'FAIL'} nToggle=${record.nKeyToggle.join('->')} siteTile=${marsh.player.tile.join(',')} objects=${on.nature.drawnThisFrame} errors=${errors.length}`);
await b.close();
if (!record.pass) process.exit(1);
