// MEC-01 R5 — LIVE BUILD demonstration: a real player walks, saves, quits to title,
// the browser reloads, the run resumes via the shipped Continue path (settleWithReturn).
// Everything below uses the CURRENT dist/ build and real keyboard/mouse input only —
// no QA teleports, no state injection. Claims are limited to what a shipping build does.
// Usage (browser-enabled machine): npm run build && node scripts/e2e-r5.mjs
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, mkdirSync } from 'fs';

const html = readFileSync('dist/index.html');
const srv = createServer((q, s) => { s.writeHead(200, { 'content-type': 'text/html' }); s.end(html); }).listen(4320);
mkdirSync('qa-shots', { recursive: true });
const errors = [];
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = async n => { await page.screenshot({ path: `qa-shots/r5-${n}.png` }); console.log('shot r5-' + n); };
const wait = ms => page.waitForTimeout(ms);
const pos = () => page.evaluate(() => { const r = window.__soh.run; return { x: Math.round(r.player.x), y: Math.round(r.player.y), traces: r.traces.length, chainIds: new Set(r.traces.map(t => t.chainId)).size, hp: r.player.hp }; });

await page.goto('http://localhost:4320/'); await wait(2500); await shot('01-title');
await page.getByText('New run').click(); await wait(300); await shot('02-select');
await page.getByText('Meadow Bay').first().click(); await page.getByText('Begin the 14 days').click(); await wait(1800); await shot('03-world');

const before = await pos();
console.log('spawn', JSON.stringify(before));
// real movement: hold D and S/W — collision-resolved walking, emitting real footprints
await page.keyboard.down('KeyD'); await wait(1200); await page.keyboard.up('KeyD');
await page.keyboard.down('KeyW'); await wait(350); await page.keyboard.up('KeyW');
await page.keyboard.down('KeyD'); await wait(700); await page.keyboard.up('KeyD');
await wait(400); await shot('04-walked');
const mid = await pos();
console.log('after walk', JSON.stringify(mid));
if (!(mid.x > before.x + 20)) throw new Error('player did not advance — real movement broken');
if (!(mid.traces > 0)) throw new Error('no footprints were emitted by real walking');

// let some real absence accumulate, then quit to title (the real settlement hook path)
await page.keyboard.press('Escape'); await wait(300); await shot('05-menu');
await page.getByText('Save & quit to title').click(); await wait(600); await shot('06-title-after-save');
await page.reload(); await wait(2500); await shot('07-reloaded-title');
const savedRaw = await page.evaluate(() => localStorage.getItem('soh.state.v3'));
if (!savedRaw) throw new Error('nothing persisted to localStorage');
console.log('save bytes', savedRaw.length);
await page.getByText(/Continue —/).click(); await wait(2200); await shot('08-continued');
const after = await pos();
console.log('after Continue', JSON.stringify(after));
if (!(after.traces > 0)) throw new Error('the trail did not survive save/reload through the real build');
console.log('DEMO-OK traces survived the real save/reload:', after.traces, 'in', after.chainIds, 'chain(s)');
console.log('ERRORS', JSON.stringify(errors, null, 1));
await b.close(); srv.close();
process.exit(errors.length ? 1 : 0);
