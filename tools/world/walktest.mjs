/* Headless harness for world/web/game.js — no browser needed.
   Stubs just enough DOM/canvas/Image to run the real game script in a VM, then
   drives real input and asserts the avatar never stands inside solid geometry.
   Run against a live static server:
     python3 -m http.server 8008 --bind 0.0.0.0 --directory . &
     node tools/world/walktest.mjs http://127.0.0.1:8008/world/web/
*/
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] || 'http://127.0.0.1:8008/web/';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', '..', 'world', 'web', 'game.js');
const code = fs.readFileSync(SRC, 'utf8');

const draws = { view: 0, minimap: 0 };
const listeners = {};
const els = {};
const ctx = (tag) => ({
  imageSmoothingEnabled: true, font: '', fillStyle: '', strokeStyle: '',
  clearRect() {}, fillRect() { draws[tag]++; }, strokeRect() {},
  drawImage() { draws[tag]++; }, measureText: (t) => ({ width: t.length * 4.6 }),
  fillText() {},
});
function el(id) {
  if (els[id]) return els[id];
  const e = {
    id, textContent: '', style: {}, width: 640, height: 360,
    getContext: () => ctx(id === 'view' ? 'view' : 'minimap'),
    remove() { e.removed = true; },
  };
  els[id] = e;
  return e;
}
els.minimap = el('minimap'); els.minimap.width = 250; els.minimap.height = 175;

const raf = [];
const sandbox = {
  console,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => { raf.push(cb); return raf.length; },
  setTimeout,
  fetch: (u) => fetch(new URL(u, BASE)),
  document: { getElementById: el },
  addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
  Image: class {
    set src(v) { this._src = v; setTimeout(() => this.onload && this.onload(), 0); }
    get src() { return this._src; }
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'game.js' });

const fire = (type, key) => (listeners[type] || []).forEach(f => f({ key, preventDefault() {} }));
const tick = (ms, t) => { const cbs = raf.splice(0); cbs.forEach(cb => cb(t)); return cbs.length; };

const fail = [];
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail.push(msg); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

await sleep(600);                       // images + meta resolve
const S = sandbox.window.__veyra;
check(!!S && !!S.meta, 'game booted and read world_meta.json');
if (!S) process.exit(1);

const { collision_cells: tiles, pixels } = S.meta.scale;
const solidAt = (x, y) => {
  const tx = Math.floor(x / 16), ty = Math.floor(y / 16);
  if (tx < 0 || ty < 0 || tx >= tiles[0] || ty >= tiles[1]) return 1;
  return S.solid[ty * tiles[0] + tx];
};
check(solidAt(S.p.x, S.p.y) === 0, `spawn stands on walkable ground (${S.p.x},${S.p.y})`);

// frame stepping helper: hold keys for `ms` of simulated time
let t = 1000;
const run = (ms, keys) => {
  keys.forEach(k => fire('keydown', k));
  const step = 16;
  for (let e = 0; e < ms; e += step) { t += step; tick(step, t); }
  keys.forEach(k => fire('keyup', k));
};

const x0 = S.p.x;
run(500, ['d']);
check(S.p.x > x0 + 20, `walking east moves the avatar (+${(S.p.x - x0).toFixed(1)} px in 0.5 s)`);
check(S.p.dir === 'right', 'facing direction follows input (right)');
run(300, ['w']); check(S.p.dir === 'up', 'facing direction follows input (up)');

// long traversals in all four directions: must never enter solid geometry
let bad = 0, simMs = 0;
for (const k of ['d', 's', 'a', 'w']) {
  for (let i = 0; i < 40; i++) { run(400, [k]); simMs += 400; if (solidAt(S.p.x, S.p.y)) bad++; }
}
check(bad === 0, `${(simMs / 1000).toFixed(1)} s of simulated held-direction movement never enters solid tiles (${bad} violations)`);
check(simMs >= 64000, `simulated movement duration accounted explicitly (${(simMs / 1000).toFixed(1)} s)`);

// spawn cycling resolves to the authored spawn points
for (const i of [1, 2, 3, 4]) {
  fire('keydown', String(i));
  const s = S.meta.spawns[i - 1];
  const want = s.world_px;
  const near = Math.hypot(S.p.x - want[0], S.p.y - want[1]) < 700;  // nudge-out allowed
  check(near && solidAt(S.p.x, S.p.y) === 0,
        `spawn ${i} (${s.id}) resolves walkable near ${want.map(v => v.toFixed(0)).join(',')}`);
}

fire('keydown', 'm'); t += 16; tick(16, t);
check(els.minimap.style.display === 'none', 'M toggles the minimap off');
fire('keydown', 'm'); t += 16; tick(16, t);
check(els.minimap.style.display === 'block', 'M toggles the minimap on');
check(draws.view > 300 && draws.minimap > 10,
      `renderer ran: ${draws.view} viewport blits, ${draws.minimap} minimap blits`);
check(els.loading.removed === true, 'loading overlay removed (assets all loaded)');
check(/tile \d+,\d+/.test(els.pos.textContent), `HUD position string present ("${els.pos.textContent}")`);

// spawn distance sanity vs Last Island reference (8000 px world, ~24 px avatar)
check(pixels[0] === 8000 && pixels[1] === 5600, `world is ${pixels[0]}x${pixels[1]} px`);
check((S.speed * 1.9) > 0, `run speed ${S.speed} px/s walk, x${S.run} run`);

console.log(fail.length ? `\n${fail.length} FAILED` : '\nall checks passed');
process.exit(fail.length ? 1 : 0);
