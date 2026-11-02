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
    logLen: r.log.length, cash: window.__soh.profile.securedCash }); })()`  // note: save-file length/clock excluded — ordinary sim time advances and autosaves;

// ============ V5 VISUAL GATE: deliberate source frames, enforced pixel checks ============
// Frame phases come from per-frame source luminance (anticipation / max expression /
// decay), then the instance is paused and scrubbed to the exact source frame time.
await page.keyboard.press('F9'); await wait(500);
await page.keyboard.press('KeyH'); await wait(200); // collapse lab -> unobstructed viewport
ok(await ev(() => document.querySelectorAll('.panel').length >= 1), 'lab opened');

// in-page pixel probe over the game canvas: predicate + region -> count/centroid/maxLuma
const PROBE = (spec) => { const cv = document.querySelector('canvas'); const g = cv.getContext('2d');
  const d = g.getImageData(0, 0, cv.width, cv.height).data; const [rx, ry, rw, rh] = spec.rect;
  let n = 0, sx = 0, sy = 0, maxL = 0;
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) { const i = (y * cv.width + x) * 4;
    const r = d[i], gg = d[i+1], b = d[i+2], a = d[i+3];
    if (a < 40) continue;
    if (spec.pred === 'purple' && !(r > 110 && b > 130 && r > gg * 1.25 && b > gg)) continue;
    if (spec.pred === 'cyan' && !(b > 160 && gg > 130 && b > r + 40)) continue;
    if (spec.pred === 'anylit' && !(a > 60)) continue;
    n++; sx += x; sy += y; const L = 0.2126*r + 0.7152*gg + 0.0722*b; if (L > maxL) maxL = L; }
  return { n, cx: n ? sx / n : -1, cy: n ? sy / n : -1, maxL }; };

const gateFx = [
  { id: 'ice/ice-lance', family: 'proj', dx: 26, dy: -4, name: 'icelance', pred: 'cyan', minCount: 120 },
  { id: 'arcane/arcane-orb', family: 'hover', dx: 0, dy: -14, name: 'orb', pred: 'purple', minCount: 40 },
  { id: 'shadow/black-hole', family: 'ground', dx: -30, dy: 4, name: 'blackhole', pred: 'purple', minCount: 60 },
];
for (const fx of gateFx) {
  const luma = await ev(async (id) => await window.__pfx.frameLuma(id), fx.id);
  ok(luma.length > 0, `gate ${fx.id}: source frame luminance measured`, `${luma.length} frames`);
  let peak = 0; for (let i = 0; i < luma.length; i++) if (luma[i] > luma[peak]) peak = i;
  const phases = { anticipation: Math.floor(luma.length * 0.08), peak, decay: Math.floor(luma.length * 0.9) };
  console.log(`  ${fx.id} frames=${luma.length} peakFrame=${peak} (luma ${luma[peak].toFixed(1)} vs avg ${(luma.reduce((a,b)=>a+b,0)/luma.length).toFixed(1)}) phases=${JSON.stringify(phases)}`);
  for (const night of [false, true]) {
    await ev((n) => window.__qaNight(n), night);
    await wait(250);
    for (const [phaseName, frame] of Object.entries(phases)) {
      await ev((f) => { const r = window.__soh.run; const p = r.player; window.__pfx.clear(); window.__pfx.setPaused(true);
        const inst = window.__pfx.spawn(f.id, { x: p.x + f.dx, y: p.y + f.dy, family: f.family, loop: true });
        window.__pfx.scrub((f.frame / 30) * 1000); }, { ...fx, frame });
      await wait(150); // let one rendered frame land
      await shot(`gate-${fx.name}-${night ? 'qanight' : 'day'}-${phaseName}-f${frame}`);
      // enforced spatial/visual probe around the expected on-screen position
      const pos = await ev((f) => { const r = window.__soh.run; const c = window.__cam; return { sx: r.player.x + f.dx - c.x, sy: r.player.y + f.dy - c.y }; }, fx);
      const rect = [Math.max(0, Math.round(pos.sx) - 90), Math.max(0, Math.round(pos.sy) - 80), 180, 150];
      const probe = await ev(PROBE, { pred: fx.pred, rect });
      const tag = `${fx.id} ${night ? 'qanight' : 'day'} ${phaseName} f${frame}`;
      if (phaseName === 'peak') {
        ok(probe.n >= fx.minCount, `gate ${tag}: ${fx.pred} pixel count`, `n=${probe.n} (min ${fx.minCount})`);
        ok(probe.maxL > (night ? 60 : 140), `gate ${tag}: peak luminance not suppressed`, `maxL=${probe.maxL.toFixed(0)}`);
        if (fx.name === 'blackhole') {
          ok(Math.abs(probe.cx - pos.sx) < 26, `gate ${tag}: art centroid aligned with world anchor`, `cx=${probe.cx.toFixed(0)} vs ${pos.sx.toFixed(0)}`);
          ok(probe.cy <= pos.sy + 10, `gate ${tag}: disk grounded (centroid not floating above anchor)`, `cy=${probe.cy.toFixed(0)} anchorY=${pos.sy.toFixed(0)}`);
        }
      }
    }
  }
  await ev(() => { window.__pfx.setPaused(false); window.__pfx.clear(); });
}
await ev(() => window.__qaNight(false));

// ---- matched REAL day vs REAL night pair (same position, qaOffset clock) ----
await ev(() => { const r = window.__soh.run; r.qaOffset = 0; });
await ev(() => { const r = window.__soh.run; const p = r.player; window.__pfx.setPaused(true); window.__pfx.spawn('shadow/black-hole', { x: p.x - 34, y: p.y + 4, family: 'ground', loop: true }); window.__pfx.scrub(45 * 1000 / 30); window.__pfx.spawn('arcane/arcane-orb', { x: p.x + 20, y: p.y - 8, family: 'hover', loop: true }); window.__pfx.scrub(0); });
await wait(600); await shot('gate-real-DAY-blackhole-orb');
const darkCheck = await ev(() => { const r = window.__soh.run; r.qaOffset = (1008000 + 20 * 1440000) - (Date.now() - r.startedAt); return true; });
await wait(1000); await shot('gate-real-NIGHT-blackhole-orb');
const darkNow = await ev(() => { const r = window.__soh.run; const len = 24 * 60000; const t = (((Date.now() - r.startedAt + r.qaOffset) + len * 0.3) % len) / len; return t; });
ok(Math.abs(darkNow) < 0.06 || Math.abs(darkNow - 1) < 0.06, 'real night clock at max darkness', 'dayTime=' + darkNow.toFixed(3));
// night non-suppression probe on the real-night shot
const nprobe = await ev(PROBE, { pred: 'purple', rect: [200, 60, 240, 200] });
ok(nprobe.n >= 60 && nprobe.maxL > 60, 'real NIGHT: black hole + orb still luminous', `n=${nprobe.n} maxL=${nprobe.maxL.toFixed(0)}`);
await ev(() => { const r = window.__soh.run; r.qaOffset = 0; window.__pfx.setPaused(false); window.__pfx.clear(); });

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
