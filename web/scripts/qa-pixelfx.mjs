// Real-browser QA for the PixelFX integration. Serves dist/ (+ pixelfx-assets when
// WITH_ASSETS=1), drives the real game in headless Chromium, saves screenshots.
// Usage: LD_LIBRARY_PATH=/home/user/qa/nss-stub WITH_ASSETS=1 node scripts/qa-pixelfx.mjs
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync, statSync, createReadStream } from 'fs';
import { join, extname } from 'path';

const WITH_ASSETS = process.env.WITH_ASSETS === '1';
const html = readFileSync('dist/index.html');
const MIME = { '.html': 'text/html', '.json': 'application/json', '.png': 'image/png' };
const srv = createServer((q, s) => {
  const url = (q.url || '/').split('?')[0];
  if (url.startsWith('/pixelfx-assets/') && WITH_ASSETS) {
    const p = join('pixelfx-assets', decodeURIComponent(url.slice('/pixelfx-assets/'.length)));
    if (existsSync(p) && statSync(p).isFile()) { s.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); createReadStream(p).pipe(s); return; }
    s.writeHead(404); s.end(); return;
  }
  s.writeHead(200, { 'content-type': 'text/html' }); s.end(html);
}).listen(4319);
mkdirSync('qa-pixelfx-shots', { recursive: true });
const errors = [];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/tmp/chromium', args: ['--no-sandbox', '--disable-gpu'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = async n => { await page.screenshot({ path: `qa-pixelfx-shots/${n}.png` }); console.log('shot', n); };
const wait = ms => page.waitForTimeout(ms);
const evalJs = (fn, arg) => page.evaluate(fn, arg);

console.log('mode:', WITH_ASSETS ? 'full pack (WITH_ASSETS)' : 'pilot only (standalone dist)');
await page.goto('http://localhost:4319/'); await wait(2500);
await page.getByText('New run').click(); await wait(400);
await page.getByText('Meadow Bay').click(); await page.getByText('Begin the 14 days').click(); await wait(2000);
await shot('01-world-baseline');

// stable-snapshot helper for non-mutation proof
const SNAP = `(() => { const r = window.__soh.run;
  return JSON.stringify({ inv: JSON.stringify(r.custody.inv.slots), eq: JSON.stringify(r.custody.eq.slots), hp: r.player.hp, stam: r.player.stamina,
    active: r.player.active, pos: [Math.round(r.player.x), Math.round(r.player.y)],
    terrCount: Object.keys(r.terrain||{}).length, entCount: Object.keys(r.entities).length, hazCount: (window.__soh.__haz ?? 0),
    logLen: r.log.length, cash: window.__soh.profile.securedCash, savedLen: (localStorage.getItem('soh.state.v3')||'').length }); })()`;

// ---- 1. FX Test Lab: black hole at player, day ----
await page.keyboard.press('F9'); await wait(600);
await page.fill('input[placeholder*="search"]', 'black-hole'); await wait(300);
await page.click('text=shadow/black-hole'); await wait(200);
await page.click('text=▶ at player'); await wait(900);
await shot('02-lab-blackhole-day');
const bhInfo = await evalJs(() => window.__pfx.listInstances().map(i => ({ id: i.id, warp: i.warp })));
console.log('instances after BH cast:', JSON.stringify(bhInfo));

// ---- 2. night compare (QA night override) ----
await page.click('text=☼ day'); await wait(700);
await shot('03-lab-blackhole-night');
await page.click('text=☾ night (QA)'); await wait(300); // back to day

// ---- 3. ice lance at mouse + arcane orb, multi-instance ----
await page.fill('input[placeholder*="search"]', 'ice-lance'); await wait(200);
await page.click('text=ice/ice-lance'); await wait(150);
await page.mouse.move(760, 300);
await page.click('text=▶ at mouse'); await wait(250);
await page.fill('input[placeholder*="search"]', 'arcane-orb'); await wait(200);
await page.click('text=arcane/arcane-orb'); await wait(150);
await page.click('text=▶ at player'); await wait(600);
await shot('04-lab-icelance-orb');

// ---- 4. non-mutation proof: lab casts leave game state + save untouched ----
const before = await evalJs(SNAP);
await page.click('text=↻ replay'); await wait(300);
await page.click('text=▶ at mouse'); await wait(500);
const after = await evalJs(SNAP);
console.log('NON-MUTATION:', before === after ? 'PASS' : 'FAIL\nbefore=' + before + '\nafter=' + after);
await shot('05-after-lab-casts');

// ---- 5. FPS with 1 / 3 / 10 simultaneous looping instances ----
const fpsSample = async (n) => {
  await evalJs(() => window.__pfx.clear());
  for (let i = 0; i < n; i++) await evalJs((k) => { const p = window.__soh.run.player; window.__pfx.spawn('arcane/arcane-orb', { x: p.x + (k % 5) * 14 - 28, y: p.y + Math.floor(k / 5) * 12 - 6, anchor: 'hover', loop: true }); }, i);
  await wait(2600);
  return evalJs(() => { const s = window.__pfx.getStats(); return { fps: +s.fps.toFixed(1), ms: +s.frameMs.toFixed(2), inst: s.instances }; });
};
for (const n of [1, 3, 10]) console.log(`FPS with ${n} FX:`, JSON.stringify(await fpsSample(n)));
await shot('06-ten-orbs');
await evalJs(() => window.__pfx.clear());

// ---- 6. REAL Core casts: windup -> release -> impact, charge accounting ----
// give the player cores (test-side state setup via QA hook; combat itself is real)
await evalJs(() => { const r = window.__soh.run; r.custody.inv.slots[0] = { key: 'core_fire', qty: 1, charge: 3 }; r.custody.inv.slots[1] = { key: 'core_earth', qty: 1, charge: 3 }; r.custody.inv.slots[2] = { key: 'core_storm', qty: 1, charge: 4 }; r.custody.inv.slots[3] = { key: 'core_frost', qty: 1, charge: 3 }; r.player.active = 0; });
await page.keyboard.press('F9'); await wait(200); // close lab
await page.keyboard.press('Digit1'); await wait(150);
await page.mouse.move(900, 260);
const chargeBefore = await evalJs(() => window.__soh.run.custody.inv.slots[0].charge);
await page.mouse.down(); await wait(200); await shot('07-core-windup'); await wait(120); await page.mouse.up(); await wait(300); // quick click = ONE cast
await shot('08-core-fireball-flight');
const chargeAfter = await evalJs(() => window.__soh.run.custody.inv.slots[0].charge);
console.log('CORE CHARGE:', chargeBefore, '->', chargeAfter, chargeBefore - chargeAfter === 1 ? 'PASS (exactly one debit)' : 'FAIL');
await wait(900); await shot('09-core-fireball-impact');

// storm chain lightning
await page.keyboard.press('Digit3'); await wait(150);
await page.mouse.move(850, 420); await page.mouse.down(); await wait(120); await page.mouse.up(); await wait(700);
await shot('10-core-storm-bolt');
// quake line
await page.keyboard.press('Digit2'); await wait(150);
await page.mouse.move(950, 380); await page.mouse.down(); await wait(120); await page.mouse.up(); await wait(700);
await shot('11-core-quake');
// frost nova
await page.keyboard.press('Digit4'); await wait(150);
await page.mouse.move(640, 380); await page.mouse.down(); await wait(120); await page.mouse.up(); await wait(360);
await shot('12-core-frostnova'); await wait(500);
const charges = await evalJs(() => [0, 1, 2, 3].map(i => window.__soh.run.custody.inv.slots[i]?.charge));
console.log('charges after 4 casts [fire,earth,storm,frost]:', JSON.stringify(charges), JSON.stringify(charges) === '[2,2,3,2]' ? 'PASS' : 'FAIL');

// ---- 7. real night (qaOffset) with FX emission ----
await evalJs(() => { const r = window.__soh.run; r.qaOffset = (1008000 + 20 * 1440000) - (Date.now() - r.startedAt); window.__pfx.clear(); window.__pfx.spawn('arcane/arcane-orb', { x: r.player.x, y: r.player.y, anchor: 'hover', loop: true }); window.__pfx.spawn('ice/ice-lance', { x: r.player.x + 34, y: r.player.y, anchor: 'ground', angle: -0.4 }); window.__pfx.spawn('shadow/black-hole', { x: r.player.x - 40, y: r.player.y + 6, anchor: 'ground' }); });
await wait(1200); await shot('13-real-night-emission');
await evalJs(() => { const r = window.__soh.run; r.qaOffset = 0; });

// ---- 9. full-pack lazy load of a NON-pilot effect ----
if (WITH_ASSETS) {
  await evalJs(() => { const r = window.__soh.run; window.__pfx.clear(); window.__pfx.spawn('holy/heal', { x: r.player.x, y: r.player.y, anchor: 'ground', loop: true }); window.__pfx.spawn('fire/meteor', { x: r.player.x + 60, y: r.player.y - 20, anchor: 'ground', angle: 2.4 }); });
  await wait(1500);
  const st9 = await evalJs(() => ({ inst: window.__pfx.listInstances().map(i => i.id), cat: window.__pfx.catalog().length, loaded: window.__pfx.catalog().filter(c => c.loaded).length }));
  console.log('FULL PACK:', JSON.stringify(st9), st9.cat === 244 ? 'PASS (244 in catalog)' : 'FAIL');
  await shot('15-fullpack-holy-meteor');
}

// ---- 8. save/reload invariants ----
await page.keyboard.press('Escape'); await wait(300);
const savedBefore = await evalJs(() => localStorage.getItem('soh.state.v3')?.length);
await page.reload(); await wait(2500);
await page.getByText(/Continue/).click(); await wait(1800);
const savedAfter = await evalJs(() => localStorage.getItem('soh.state.v3')?.length);
console.log('SAVE/RELOAD:', savedBefore, '->', savedAfter, savedAfter > 1000 ? 'PASS' : 'FAIL');
await shot('14-reloaded');

console.log('ERRORS', JSON.stringify(errors.slice(0, 8), null, 1));
await b.close(); srv.close();
