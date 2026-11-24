// Frame-cost benchmark: deterministic clock, N frames at 16.67 ms, wall time per frame + CPU profile.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import chromium from '@sparticuz/chromium'; import { chromium as pw } from 'playwright-core';
const dir = path.resolve(process.argv[2]); const label = process.argv[3] ?? path.basename(dir);
const FRAMES = Number(process.env.FRAMES ?? 600), WARM = Number(process.env.WARM ?? 180), PROFILE = process.env.PROFILE !== '0';
const SCEN = process.env.SCEN ?? 'idle'; const out = process.env.OUT ?? `/home/user/acc/fps/out/${label}-${SCEN}`; fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.zip': 'application/zip' };
const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': mime[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${srv.address().port}/`;
const browser = await pw.launch({ executablePath: await chromium.executablePath(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--autoplay-policy=no-user-gesture-required', ...(process.env.GPU === 'swift' ? ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] : ['--disable-gpu', '--disable-accelerated-2d-canvas'])] });
const ctx = await browser.newContext({ viewport: { width: Number(process.env.VW ?? 1280), height: Number(process.env.VH ?? 720) }, deviceScaleFactor: 1 }); const p = await ctx.newPage(); p.setDefaultTimeout(120000);
const errors = []; p.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
if (process.env.SAVE) await p.addInitScript(at0 => { window.__AT0 = at0; }, Date.UTC(2026, 10, 15, 8) + Number(process.env.HOUR ?? 8) * 3600000 + 20000);
if (process.env.NOREGION) await p.addInitScript(() => { const W = window.Worker; window.Worker = function (u, o) { if (String(u).includes('region-prebuild')) return { postMessage() {}, terminate() {}, addEventListener() {}, onmessage: null, onerror: null }; return new W(u, o); }; });
await p.addInitScript(() => {
  const realNow = performance.now.bind(performance); let seed = 0x5eed1234; Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let at = window.__AT0 ?? Date.UTC(2026, 10, 20, 8, 0, 0), anim = 0, seq = 0; const next = new Map();
  Date.now = () => at; Object.defineProperty(performance, 'now', { value: () => anim });
  const realRaf = window.requestAnimationFrame.bind(window);
  window.stepPaced = async (n, ms) => { const cb = [], gap = []; let prev = await new Promise(realRaf); window.__starts = []; for (let i = 0; i < n; i++) { at += ms; anim += ms; const jobs = [...next]; next.clear(); const t0 = realNow(); window.__starts.push(t0); for (const [, f] of jobs) f(anim); cb.push(realNow() - t0); const t = await new Promise(realRaf); gap.push(t - prev); prev = t; } return { cb, gap }; };
  window.requestAnimationFrame = cb => { next.set(++seq, cb); return seq; }; window.cancelAnimationFrame = id => next.delete(id);
  window.stepFrames = (n, ms, timed) => { const ts = []; for (let i = 0; i < n; i++) { at += ms; anim += ms; const jobs = [...next]; next.clear(); const t0 = realNow(); for (const [, cb] of jobs) cb(anim); if (timed) { ts.push(realNow() - t0); (window.__starts ??= []).push(t0); } } return timed ? ts : at; };
  const CNT = window.__cnt = { on: false, ops: {}, px: {}, newCanvas: 0, newImage: 0 };
  const P = CanvasRenderingContext2D.prototype;
  for (const m of ['drawImage', 'fillRect', 'clearRect', 'strokeRect', 'fill', 'stroke', 'clip', 'save', 'restore', 'getImageData', 'putImageData', 'createImageData', 'fillText', 'arc', 'beginPath', 'setTransform', 'createRadialGradient', 'createLinearGradient', 'createPattern']) {
    const o = P[m]; if (!o) continue; P[m] = function (...a) { if (CNT.on) { CNT.ops[m] = (CNT.ops[m] ?? 0) + 1;
      if (m === 'drawImage') { const src = a[0]; const w = a.length >= 9 ? a[7] : a.length >= 5 ? a[3] : (src.width ?? 0), h = a.length >= 9 ? a[8] : a.length >= 5 ? a[4] : (src.height ?? 0); const k = (src instanceof HTMLCanvasElement ? 'canvas' : src instanceof HTMLImageElement ? 'img' : src?.constructor?.name) + (this.canvas === document.querySelector('canvas') ? '>main' : '>off'); CNT.px[k] = (CNT.px[k] ?? 0) + Math.abs(w * h); CNT.ops['drawImage:' + k] = (CNT.ops['drawImage:' + k] ?? 0) + 1; }
      else if (m === 'fillRect' || m === 'clearRect') { const k = m + (this.canvas === document.querySelector('canvas') ? '>main' : '>off'); CNT.px[k] = (CNT.px[k] ?? 0) + Math.abs(a[2] * a[3]); }
      else if (m === 'getImageData') CNT.px.getImageData = (CNT.px.getImageData ?? 0) + Math.abs(a[2] * a[3]); }
      return o.apply(this, a); }; }
  const ce = document.createElement.bind(document); document.createElement = function (t, ...r) { if (CNT.on && String(t).toLowerCase() === 'canvas') CNT.newCanvas++; return ce(t, ...r); };
  const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (...a) { if (CNT.on) CNT.ops.getContext = (CNT.ops.getContext ?? 0) + 1; return gc.apply(this, a); };
  for (const m of ['toDataURL', 'toBlob']) { const o = HTMLCanvasElement.prototype[m]; HTMLCanvasElement.prototype[m] = function (...a) { if (CNT.on) CNT.ops[m] = (CNT.ops[m] ?? 0) + 1; return o.apply(this, a); }; }
  window.countFrames = n => { CNT.on = true; CNT.ops = {}; CNT.px = {}; CNT.newCanvas = 0; window.stepFrames(n, 1000 / 60); CNT.on = false; const per = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +(v / n).toFixed(1)]).sort((a, b) => b[1] - a[1])); return { ops: per(CNT.ops), px: per(CNT.px), newCanvas: +(CNT.newCanvas / n).toFixed(2) }; };
  window.readRun = () => { const c = document.querySelector('canvas'); let n = c?.[Object.keys(c).find(k => k.startsWith('__reactFiber'))]; while (n && !n.memoizedProps?.gs?.run) n = n.return; return n?.memoizedProps.gs ?? null; };
  window.census = () => { const r = window.readRun()?.run; if (!r) return null; const ent = Object.values(r.entities); const kinds = {}; for (const e of ent) kinds[e.kind + ':' + (e.type ?? '')] = (kinds[e.kind + ':' + (e.type ?? '')] ?? 0) + 1;
    return { entities: ent.length, creatures: r.creatures?.length, people: r.humanWorld ? Object.keys(r.humanWorld.people).length : 0, offscreen: r.veyraOffscreenEntities ? Object.keys(r.veyraOffscreenEntities).length : 0, weather: document.body.innerText.match(/\b(CLEAR|RAIN|STORM|FOG|CLOUDY|SNOW|HEAT|COLD)\b/i)?.[0], saveKB: Math.round(Object.keys(localStorage).reduce((n, k) => n + localStorage.getItem(k).length, 0) / 1024), receipts: r.receipts.length, seq: r.seq, x: Math.round(r.player.x), y: Math.round(r.player.y), layout: r.layoutId, top: Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 8), dom: document.querySelectorAll('*').length, canvas: (() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height, c.clientWidth, c.clientHeight] : null; })() }; };
});
const step = (n, ms = 1000 / 60, timed = false) => p.evaluate(([n, ms, timed]) => window.stepFrames(n, ms, timed), [n, ms, timed]);
const T0 = Date.now(); await p.goto(url); await step(30); console.error("loaded", Date.now()-T0);
const names = async () => p.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 30));
const click = async re => { const b = p.getByRole('button', { name: re }).first(); if (await b.count()) { await b.click({ force: true }); await step(8); return true; } return false; };
let started = false;
if (process.env.SAVE) {
  const text = fs.readFileSync(process.env.SAVE, 'utf8'); const put = await p.evaluate(s => { try { localStorage.setItem('soh.state.v3', s); return localStorage.getItem('soh.state.v3') === s; } catch (e) { return String(e); } }, text); console.error('inject', put, text.length);
  await p.reload(); await step(20); if (process.env.DWELL) await p.waitForTimeout(+process.env.DWELL); await click(/Continue/);
  for (let i = 0; i < 200 && !started; i++) { await p.waitForTimeout(1500); await step(3); started = await p.evaluate(() => { const r = window.readRun?.()?.run; return !!r && Math.abs(Date.now() - r.clock.lastSimAt) < 5000; }); }
  await p.keyboard.press('Escape'); await step(10); console.error('continued', started, JSON.stringify(await p.evaluate(() => { const r = window.readRun()?.run; return r && { hour: (r.clock.lastSimAt - r.startedAt) / 3600000, dead: r.player.dead }; })));
} else

if (process.env.DWELL && !process.env.SAVE) await p.waitForTimeout(+process.env.DWELL);
for (let i = 0; i < 6 && !started; i++) { await click(/^New run|^New Run|^NEW RUN|^Start|^Play/i) ; await click(/Begin the 14 days|^Begin|^Embark|^Start run/i); await step(10); started = await p.evaluate(() => !!window.readRun?.()); if (!started) await p.waitForTimeout(1500); }
if (!started) { console.log(label, 'NOT STARTED; buttons:', JSON.stringify(await names())); await p.screenshot({ path: out + '/notstarted.png' }); await browser.close(); srv.close(); process.exit(2); }
await p.waitForFunction(() => !!window.readRun(), {}, { polling: 200, timeout: 240000 }); await step(WARM);
const stats = ts => { const a = [...ts].sort((x, y) => x - y); const q = f => a[Math.min(a.length - 1, Math.floor(f * a.length))]; return { mean: +(ts.reduce((s, v) => s + v, 0) / ts.length).toFixed(2), p50: +q(.5).toFixed(2), p95: +q(.95).toFixed(2), p99: +q(.99).toFixed(2), max: +a.at(-1).toFixed(2), over16: ts.filter(v => v > 16.7).length, over33: ts.filter(v => v > 33.3).length }; };
console.error("warm done", Date.now() - T0);
const cdp = await ctx.newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
if (process.env.WALK) await p.keyboard.down(process.env.WALK);
const PH = (process.env.PHASES ?? '0,3600,7200,10800').split(',').map(Number); const rows = []; let done = WARM;
for (const extra of PH) {
  for (let k = 0; k < extra; k += 600) { await step(Math.min(600, extra - k)); } done += extra;
  await cdp.send('Profiler.start'); const r = await p.evaluate(n => window.stepPaced(n, 1000 / 60), FRAMES); const { profile } = await cdp.send('Profiler.stop'); done += FRAMES;
  const byId = new Map(profile.nodes.map(n => [n.id, n])); const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const incl = {}; profile.samples.forEach((id, i) => { const d = (profile.timeDeltas[i + 1] ?? 0) / 1000; const seen = new Set(); for (let c = id; c !== undefined; c = parent.get(c)) { const k = byId.get(c).callFrame.functionName || '(anon)'; if (!seen.has(k)) { seen.add(k); incl[k] = (incl[k] ?? 0) + d; } } });
  const pick = k => +((incl[k] ?? 0) / FRAMES).toFixed(2); const c = await p.evaluate(() => window.census());
  const row = { atMin: +((done - FRAMES) / 3600).toFixed(1), fps: +(1000 / (r.gap.reduce((a, b) => a + b, 0) / r.gap.length)).toFixed(1), cb: stats(r.cb), tick: pick('tick'), stepHumans: pick('stepHumans'), tickNeeds: pick('tickNeeds'), plan: pick('planAutonomousWork'), compileGeo: pick('compileCanonicalGeometryRegion'), route: pick('route'), boundary: pick('humanEventBoundary'), entityRead: pick('withRunEntityRead'), draw: pick('draw'), save: pick('saveDetailed'), react: pick('performWorkUntilDeadline'), gc: pick('(garbage collector)'), entities: c.entities, offscreen: c.offscreen, receipts: c.receipts, weather: c.weather, saveKB: c.saveKB };
  row.regions = await p.evaluate(() => window.__sohView?.().regions ?? null); rows.push(row); console.log(JSON.stringify({ label, ...row })); fs.writeFileSync(out + `/phase-${rows.length}.json`, JSON.stringify({ pstarts: await p.evaluate(() => window.__starts), pseries: r.cb })); fs.writeFileSync(out + `/phase-${rows.length}.cpuprofile`, JSON.stringify(profile));
}
fs.writeFileSync(out + '/timeline.json', JSON.stringify(rows, null, 1)); await p.screenshot({ path: out + '/end.png' }); await browser.close(); srv.close();
