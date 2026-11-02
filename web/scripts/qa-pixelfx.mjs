// ============================================================================
// Real-browser visual + functional QA for the PixelFX compositor (v2).
// Enforced assertions: any FAIL sets a nonzero exit code.
//   LD_LIBRARY_PATH=<nss> WITH_ASSETS=1 node scripts/qa-pixelfx.mjs  (full pack)
//   LD_LIBRARY_PATH=<nss> node scripts/qa-pixelfx.mjs                (standalone pilot)
// ============================================================================
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

let failures = 0;
const errors = [];
const ok = (cond, name, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); if (!cond) failures++; };

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/tmp/chromium', args: ['--no-sandbox', '--disable-gpu'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = async n => { await page.screenshot({ path: `qa-pixelfx-shots/${n}.png` }); };
const wait = ms => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);

console.log('mode:', WITH_ASSETS ? 'full pack' : 'standalone pilot (dist only)');
await page.goto('http://localhost:4319/'); await wait(2500);
await page.getByText('New run').click(); await wait(400);
await page.getByText('Meadow Bay').click(); await page.getByText('Begin the 14 days').click(); await wait(2000);
await shot('01-world-baseline');

// freeze-ish helper: stable snapshot of fields that lab casts must NOT change
const SNAP = `(() => { const r = window.__soh.run;
  return JSON.stringify({ inv: JSON.stringify(r.custody.inv.slots), eq: JSON.stringify(r.custody.eq.slots),
    hp: r.player.hp, stam: Math.round(r.player.stamina), active: r.player.active, pos: [Math.round(r.player.x), Math.round(r.player.y)],
    terrCount: Object.keys(r.terrain||{}).length, entCount: Object.keys(r.entities).length,
    logLen: r.log.length, cash: window.__soh.profile.securedCash, savedLen: (localStorage.getItem('soh.state.v3')||'').length }); })()`;

// ============ V5 VISUAL GATE: 3 effects x day/QA-night x 3 phases, lab hidden ============
await page.keyboard.press('F9'); await wait(500);
await page.keyboard.press('KeyH'); await wait(200); // collapse lab -> unobstructed viewport
ok(await ev(() => document.querySelectorAll('.panel').length >= 1), 'lab opened');
const gateFx = [
  { id: 'ice/ice-lance', family: 'proj', name: 'icelance' },
  { id: 'arcane/arcane-orb', family: 'hover', name: 'orb' },
  { id: 'shadow/black-hole', family: 'ground', name: 'blackhole' },
];
for (const fx of gateFx) {
  for (const night of [false, true]) {
    await ev((n) => window.__qaNight(n), night); // QA-only darkness override (labeled qanight)
    await wait(250);
    await ev(() => window.__pfx.clear());
    await ev((f) => { const r = window.__soh.run; const p = r.player; window.__pfx.spawn(f.id, { x: p.x + 26, y: p.y - 4, family: f.family, loop: true }); }, fx);
    await wait(200); await shot(`gate-${fx.name}-${night ? 'qanight' : 'day'}-a-spawn`);
    await wait(500); await shot(`gate-${fx.name}-${night ? 'qanight' : 'day'}-b-active`);
    await wait(700); await shot(`gate-${fx.name}-${night ? 'qanight' : 'day'}-c-peak`);
    const inst = await ev(() => window.__pfx.listInstances().map(i => i.id));
    ok(inst.includes(fx.id), `gate ${fx.id} instance alive`);
  }
}
// NOTE: the qanight shots above use the same daytime clock; true matched night pair below.
await ev(() => window.__qaNight(false)); await ev(() => window.__pfx.clear());

// ---- matched REAL day vs REAL night pair (same position, qaOffset clock) ----
const nightShot = async (tag) => {
  await ev((h) => { const r = window.__soh.run; r.qaOffset = h; }, tag);
  await wait(900);
};
await ev(() => { const r = window.__soh.run; r.qaOffset = 0; });
await ev(() => { const r = window.__soh.run; const p = r.player; window.__pfx.spawn('shadow/black-hole', { x: p.x - 34, y: p.y + 4, family: 'ground', loop: true }); window.__pfx.spawn('arcane/arcane-orb', { x: p.x + 20, y: p.y - 8, family: 'hover', loop: true }); });
await wait(1000); await shot('gate-real-DAY-blackhole-orb');
await ev(() => { const r = window.__soh.run; r.qaOffset = (1008000 + 20 * 1440000) - (Date.now() - r.startedAt); }); // dayTime t=0 = max darkness
await wait(1200); await shot('gate-real-NIGHT-blackhole-orb');
const darkNow = await ev(() => { const r = window.__soh.run; const len = 24 * 60000; const t = (((Date.now() - r.startedAt + r.qaOffset) + len * 0.3) % len) / len; return t; });
ok(Math.abs(darkNow) < 0.06 || Math.abs(darkNow - 1) < 0.06, 'real night clock at max darkness', 'dayTime=' + darkNow.toFixed(3));
await ev(() => { const r = window.__soh.run; r.qaOffset = 0; });
await ev(() => window.__pfx.clear());

// ============ lab usability: search/select/cast does not mutate state ============
await page.keyboard.press('F9'); await wait(300); // reopen
await page.fill('input[placeholder*="search"]', 'black-hole'); await wait(200);
await page.click('text=shadow/black-hole'); await wait(150);
const before = await ev(SNAP);
await page.click('text=▶ player'); await wait(400);
await page.click('text=↻ last'); await wait(400);
await page.click('text=▶ mouse'); await wait(400);
const after = await ev(SNAP);
ok(before === after, 'lab casts non-mutating (state+save identical)');
await page.keyboard.press('KeyH'); await wait(150);

// ============ FPS p50/p95 with 1/3/10 simultaneous effects ============
const fpsSample = async (n) => {
  await ev(() => { window.__pfx.clear(); window.__pfx.setPaused(false); });
  for (let i = 0; i < n; i++) await ev((k) => { const p = window.__soh.run.player; window.__pfx.spawn('arcane/arcane-orb', { x: p.x + ((k % 5) * 16 - 32), y: p.y + (Math.floor(k / 5) * 14 - 7), family: 'hover', loop: true }); }, i);
  await wait(3000);
  return ev(() => window.__pfx.getStats());
};
for (const n of [1, 3, 10]) { const s = await fpsSample(n); console.log(`perf ${n} FX: fps=${s.fps.toFixed(1)} p50=${s.p50.toFixed(2)}ms p95=${s.p95.toFixed(2)}ms`); if (n === 10) await shot('06-ten-orbs'); }
await ev(() => window.__pfx.clear());

// ============ real Core casts: windup->release->impact, exactly one charge ============
await ev(() => { const r = window.__soh.run; r.custody.inv.slots[0] = { key: 'core_fire', qty: 1, charge: 3 }; r.custody.inv.slots[1] = { key: 'core_earth', qty: 1, charge: 3 }; r.custody.inv.slots[2] = { key: 'core_storm', qty: 1, charge: 4 }; r.custody.inv.slots[3] = { key: 'core_frost', qty: 1, charge: 3 }; r.player.active = 0; });
await page.keyboard.press('Digit1'); await wait(150);
await page.mouse.move(900, 260);
const c0 = await ev(() => window.__soh.run.custody.inv.slots[0].charge);
await page.mouse.down(); await wait(200); await shot('07-core-windup'); await wait(120); await page.mouse.up(); await wait(300);
await shot('08-core-fireball-flight');
const c1 = await ev(() => window.__soh.run.custody.inv.slots[0].charge);
ok(c0 - c1 === 1, 'one Core cast = exactly one charge debit', `${c0}->${c1}`);
await wait(900); await shot('09-core-fireball-impact');
await page.keyboard.press('Digit3'); await wait(150); await page.mouse.move(850, 420); await page.mouse.down(); await wait(120); await page.mouse.up(); await wait(500); await shot('10-core-storm-bolt');
await page.keyboard.press('Digit2'); await wait(150); await page.mouse.move(950, 380); await page.mouse.down(); await wait(120); await page.mouse.up(); await wait(650); await shot('11-core-quake');
await page.keyboard.press('Digit4'); await wait(150); await page.mouse.move(640, 380); await page.mouse.down(); await wait(120); await page.mouse.up(); await wait(400); await shot('12-core-frostnova');
const charges = await ev(() => [0, 1, 2, 3].map(i => window.__soh.run.custody.inv.slots[i]?.charge));
ok(JSON.stringify(charges) === '[2,2,3,2]', 'four cores, one cast each', JSON.stringify(charges));

// ============ full pack (only when WITH_ASSETS) ============
if (WITH_ASSETS) {
  await ev(() => { const r = window.__soh.run; const p = r.player; window.__pfx.clear(); window.__pfx.spawn('holy/heal', { x: p.x, y: p.y, family: 'ground', loop: true }); window.__pfx.spawn('fire/meteor', { x: p.x + 60, y: p.y - 20, family: 'ground', angle: 2.4 }); });
  await wait(1500);
  const fp = await ev(() => ({ cat: window.__pfx.catalog().length, inst: window.__pfx.listInstances().map(i => i.id), loaded: window.__pfx.catalog().filter(c => c.loaded).length }));
  ok(fp.cat === 244, 'full pack catalog = 244', JSON.stringify(fp));
  await shot('15-fullpack-holy-meteor');
  await ev(() => window.__pfx.clear());
}

// ============ save/reload ============
await page.keyboard.press('Escape'); await wait(300);
await page.reload(); await wait(2500);
const cont = await page.getByText(/Continue/).count();
ok(cont > 0, 'continue available after reload');
if (cont) { await page.getByText(/Continue/).click(); await wait(1800); await shot('14-reloaded'); }

ok(errors.length === 0, 'zero uncaught browser errors', errors.slice(0, 3).join(' | '));
console.log(failures === 0 ? 'ALL QA CHECKS PASSED' : `${failures} QA CHECK(S) FAILED`);
await b.close(); srv.close();
process.exit(failures === 0 ? 0 : 1);
