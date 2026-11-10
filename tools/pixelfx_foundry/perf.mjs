#!/usr/bin/env node
// Headless performance harness for the FX Foundry presentation path. It decodes the EXPORTED atlas
// pages and times the same per-frame compositing the browser performs (scene fill + optional night
// overlay + N effect instances drawn from atlas frames + bounded additive emission pass), measured in
// pure JS on this CPU. These are honest ms/frame numbers for the compositing workload — not browser FPS
// promises; run the browser for the interactive result.
//
//   node tools/pixelfx_foundry/perf.mjs [--assets assets/pixelfx_foundry] [--ids ice/ice-lance,...] [--instances 1,3,10]
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { decodePNG } from "./lib/png-decode.mjs";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const assets = resolve(flag("--assets", "assets/pixelfx_foundry"));
const ids = flag("--ids", "ice/ice-lance,arcane/arcane-orb,shadow/black-hole,fire/meteor,explosions/big-explosion,status/frozen,weather/fireflies").split(",");
const instanceCounts = flag("--instances", "1,3,10").split(",").map(Number);
const RES = [[1280, 720], [1920, 1080], [2560, 1440]];

const index = JSON.parse(readFileSync(join(assets, "index.json"), "utf8"));
function loadFrames(e, ch) {
  const frames = [];
  for (const p of e.export.pages[ch]) {
    const dec = decodePNG(readFileSync(join(assets, p.path)));
    const [fw, fh] = e.export.frameSize;
    for (let j = 0; j < p.count; j++) {
      const f = new Uint8ClampedArray(fw * fh * 4);
      for (let y = 0; y < fh; y++) {
        const s = ((Math.floor(j / p.columns) * fh + y) * dec.w + (j % p.columns) * fw) * 4;
        f.set(dec.data.subarray(s, s + fw * 4), y * fw * 4);
      }
      frames.push(f);
    }
  }
  return frames;
}
const fx = {};
for (const id of ids) {
  const e = index.effects.find((x) => x.id === id);
  if (!e || e.export.state !== "PARITY_PASS") { console.error("skip (not PARITY_PASS):", id); continue; }
  fx[id] = { e, combined: loadFrames(e, "combined"), light: loadFrames(e, "light") };
}

function drawOver(dst, W, frame, fw, fh, x, y) {
  for (let yy = 0; yy < fh; yy++) {
    const dy = y + yy; if (dy < 0 || dy >= dst.h) continue;
    for (let xx = 0; xx < fw; xx++) {
      const dx = x + xx; if (dx < 0 || dx >= W) continue;
      const s = (yy * fw + xx) * 4, d = (dy * W + dx) * 4;
      const a = frame[s + 3]; if (!a) continue;
      const af = a / 255;
      for (let k = 0; k < 3; k++) dst.buf[d + k] = Math.min(255, frame[s + k] * af + dst.buf[d + k] * (1 - af));
      dst.buf[d + 3] = 255;
    }
  }
}
function drawAdd(dst, W, frame, fw, fh, x, y, k) {
  for (let yy = 0; yy < fh; yy++) {
    const dy = y + yy; if (dy < 0 || dy >= dst.h) continue;
    for (let xx = 0; xx < fw; xx++) {
      const dx = x + xx; if (dx < 0 || dx >= W) continue;
      const s = (yy * fw + xx) * 4; if (!frame[s + 3]) continue;
      const d = (dy * W + dx) * 4;
      for (let c = 0; c < 3; c++) dst.buf[d + c] = Math.min(255, dst.buf[d + c] + frame[s + c] * k);
    }
  }
}
function runFrame(W, H, night, active) {
  const dst = { w: W, h: H, buf: new Uint8ClampedArray(W * H * 4) };
  // scene fill (day gradient / night overlay approximation: flat fills, the cheap part of the path)
  const base = night ? [10, 12, 40] : [150, 190, 220];
  for (let i = 0; i < W * H; i++) { dst.buf[i * 4] = base[0]; dst.buf[i * 4 + 1] = base[1]; dst.buf[i * 4 + 2] = base[2]; dst.buf[i * 4 + 3] = 255; }
  if (night) for (let i = 0; i < W * H; i++) { dst.buf[i * 4] = dst.buf[i * 4] * 0.45; dst.buf[i * 4 + 1] = dst.buf[i * 4 + 1] * 0.45 + 10; dst.buf[i * 4 + 2] = dst.buf[i * 4 + 2] * 0.6 + 20; }
  const groundY = Math.floor(H * 0.72);
  for (let i = 0; i < W * H; i++) { /* ground band */ }
  for (const { id, f } of active) {
    const { e, combined, light } = fx[id];
    const [fw, fh] = e.export.frameSize;
    const fr = combined[f % combined.length];
    const anchor = e.presentation.anchor;
    const x = Math.floor(W / 2 - fw / 2), y = anchor === "ground" ? groundY - fh : Math.floor(H / 2 - fh / 2);
    drawOver(dst, W, fr, fw, fh, x, y);
    if (night && e.export.lightEnergy > 0.5) drawAdd(dst, W, light[f % light.length], fw, fh, x, y, 0.53);
  }
}

const results = [];
for (const [W, H] of RES) {
  for (const n of instanceCounts) {
    for (const night of [false, true]) {
      const active = Array.from({ length: n }, (_, i) => ({ id: ids[i % ids.length], f: 0 }));
      // warmup
      for (let i = 0; i < 5; i++) { for (const a of active) a.f++; runFrame(W, H, night, active); }
      const times = [];
      const FRAMES = 60;
      for (let i = 0; i < FRAMES; i++) {
        for (const a of active) a.f++;
        const t0 = performance.now();
        runFrame(W, H, night, active);
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      const p = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
      results.push({ res: `${W}x${H}`, instances: n, night, p50: +p(0.5).toFixed(2), p95: +p(0.95).toFixed(2), mean: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2) });
    }
  }
}
console.log("headless compositing cost per frame (ms) — scene + night overlay + N atlas instances + bounded emission");
console.table(results);
