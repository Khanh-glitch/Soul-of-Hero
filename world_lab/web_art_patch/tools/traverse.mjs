// Focused browser traversal: real keyboard movement + real HUD panels, no teleport.
//   GAME_URL=http://127.0.0.1:4181 ART_OUT=evidence/after node traverse.mjs
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const URL = process.env.GAME_URL || 'http://127.0.0.1:4181';
const OUT = path.resolve(process.env.ART_OUT || 'art-shots/after');
const b = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
p.on('pageerror', e => errors.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const st = () => p.evaluate(() => {
  const r = window.__soh.run;
  return { x: r.player.x, y: r.player.y, hp: r.player.hp, dead: r.player.dead, region: r.player.regionName, entities: Object.keys(r.entities).length, sources: Object.keys(r.sources).length };
});
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };
await p.goto(URL, { waitUntil: 'networkidle' });
await p.getByRole('button', { name: 'New run' }).click(); await p.waitForTimeout(350);
await p.getByRole('button', { name: "Fisher's Point", exact: true }).click(); await p.waitForTimeout(350);
await p.getByRole('button', { name: /Begin the 14 days/ }).click();
await p.waitForFunction(() => Boolean(window.__soh?.run)); await p.waitForTimeout(700);
const start = await st();
const steps = [['KeyS', 2800], ['KeyA', 2200], ['KeyA', 1200], ['KeyD', 1400], ['KeyW', 1200], ['KeyD', 900], ['KeyW', 900]];
let prev = start, pathPx = 0; const waypoints = [];
for (const [k, ms] of steps) {
  await hold(k, ms); const s2 = await st();
  pathPx += Math.hypot(s2.x - prev.x, s2.y - prev.y);
  waypoints.push({ key: k, ms, x: Math.round(s2.x * 100) / 100, y: Math.round(s2.y * 100) / 100 });
  prev = s2;
}
const end = await st();
for (const k of ['KeyI', 'Escape', 'KeyM', 'Escape', 'KeyB', 'Escape', 'KeyC', 'Escape']) { await p.keyboard.press(k); await p.waitForTimeout(180); }
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(OUT, 'route-panels-640x360.png'), animations: 'disabled' });
const result = {
  url: URL, start, end,
  netDisplacementPx: Math.round(Math.hypot(end.x - start.x, end.y - start.y) * 100) / 100,
  walkedPathPx: Math.round(pathPx * 100) / 100, waypoints,
  panels: 'I/M/B/C opened and closed with Escape', errors,
  pass: pathPx > 500 && !end.dead && end.hp === 100 && errors.length === 0,
};
await fs.writeFile(path.join(OUT, 'traverse.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await b.close();
if (!result.pass) process.exitCode = 1;
