#!/usr/bin/env node
// QA evidence generator: for every one of the 21 categories, render (a) the official source contact
// sheet and (b) a SOH-style day/night presentation strip composited from the EXPORTED atlas frames
// with the same presentation rules as the browser (scene -> night overlay -> effect after overlay with
// bounded emission boost). Output: qa/pixelfx_foundry/*.png
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { decodePNG } from "./lib/png-decode.mjs";

const upstream = resolve(process.argv[2] || "/home/user/pixelfx/repo");
const out = resolve(process.argv[3] || "/home/user/qa/pixelfx_foundry");
const assets = resolve(process.argv[4] || "assets/pixelfx_foundry");
const repoRoot = resolve(process.argv[5] || ".");
const fxlib = await import(pathToFileURL(join(upstream, "tools/lib/fxlib.mjs")).href);
const index = JSON.parse(readFileSync(join(resolve(repoRoot, assets), "index.json"), "utf8"));

const W = 640, H = 360, GROUND = Math.floor(H * 0.72);
function sceneCanvas(night) {
  const c = fxlib.canvas(W, H, [0, 0, 0, 255]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let col;
    if (night) col = y < GROUND ? mix3([7, 10, 28], [13, 18, 48], y / GROUND) : mix3([25, 21, 49], [16, 13, 36], (y - GROUND) / (H - GROUND));
    else col = y < GROUND ? mix3([127, 178, 224], [168, 200, 232], y / GROUND) : mix3([107, 90, 72], [84, 70, 58], (y - GROUND) / (H - GROUND));
    c.data.set([...col, 255], (y * W + x) * 4);
  }
  c.rect(0, GROUND, W, 2, night ? [36, 32, 69, 255] : [125, 106, 84, 255]);
  if (night) { for (let i = 0; i < W * H; i++) { c.data[i * 4] = c.data[i * 4] * 0.45; c.data[i * 4 + 1] = c.data[i * 4 + 1] * 0.45 + 10; c.data[i * 4 + 2] = c.data[i * 4 + 2] * 0.6 + 20; } }
  return c;
}
function mix3(a, b, t) { return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * Math.min(1, Math.max(0, t)))); }

function loadFrames(e, ch) {
  const exact = [];
  for (const p of e.export.pages[ch]) {
    const dec = decodePNG(readFileSync(join(resolve(repoRoot, assets), p.path)));
    const [fw, fh] = e.export.frameSize;
    for (let j = 0; j < p.count; j++) {
      const f = new Uint8ClampedArray(fw * fh * 4);
      for (let y = 0; y < fh; y++) {
        const s = ((Math.floor(j / p.columns) * fh + y) * dec.w + (j % p.columns) * fw) * 4;
        f.set(dec.data.subarray(s, s + fw * 4), y * fw * 4);
      }
      exact.push(f);
    }
  }
  return exact;
}
function pasteOver(c, frame, fw, fh, x, y, alpha = 1) {
  for (let yy = 0; yy < fh; yy++) for (let xx = 0; xx < fw; xx++) {
    const s = (yy * fw + xx) * 4, d = ((y + yy) * c.w + x + xx) * 4;
    const a = frame[s + 3] / 255 * alpha;
    if (a <= 0) continue;
    for (let k = 0; k < 3; k++) c.data[d + k] = Math.min(255, frame[s + k] * a + c.data[d + k] * (1 - a));
    c.data[d + 3] = Math.max(c.data[d + 3], frame[s + 3] * alpha);
  }
}
function pasteAdd(c, frame, fw, fh, x, y, k) { // additive light, bounded
  for (let yy = 0; yy < fh; yy++) for (let xx = 0; xx < fw; xx++) {
    const s = (yy * fw + xx) * 4, d = ((y + yy) * c.w + x + xx) * 4;
    if (frame[s + 3] === 0) continue;
    for (let ch = 0; ch < 3; ch++) c.data[d + ch] = Math.min(255, c.data[d + ch] + frame[s + ch] * k);
  }
}

// marquee picks per category where the mission names them; otherwise first verified effect
const MARQUEE = { ice: "ice/ice-lance", fire: "fire/meteor", shadow: "shadow/black-hole", arcane: "arcane/arcane-orb", moves: "moves/ice-lance-throw", status: "status/frozen", weather: "weather/fireflies", ui: "ui/achievement", transitions: "transitions/crt-off" };
const catPick = {};
for (const e of index.effects) if (e.export.state === "PARITY_PASS" && !catPick[e.category]) catPick[e.category] = e;
for (const [cat, id] of Object.entries(MARQUEE)) {
  const e = index.effects.find((x) => x.id === id);
  if (e?.export.state === "PARITY_PASS") catPick[cat] = e;
}
mkdirSync(out, { recursive: true });
const summary = [];
for (const [cat, e] of Object.entries(catPick)) {
  const fx = await fxlib.loadEffect(e.id);
  const src = fxlib.renderFrames(fx, { bg: "dark" });
  const sheet = fxlib.contactSheet(fx, src, { max: 6, width: 1500 });
  writeFileSync(join(out, `source-${cat}.png`), sheet);
  // SOH day/night strip from exported atlas, 4 frames
  const combined = loadFrames(e, "combined");
  const light = loadFrames(e, "light");
  const [fw, fh] = e.export.frameSize;
  const n = combined.length;
  const picks = [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1];
  const strip = fxlib.canvas(4 * (W / 2) + 50, H + 56, [10, 9, 16, 255]);
  strip.text(`${e.id} — SOH presentation (day top / night bottom)`, 8, 8, 2, [200, 196, 214]);
  const day = sceneCanvas(false), nightC = sceneCanvas(true);
  picks.forEach((f, i) => {
    const x = 8 + i * (W / 2 + 4), y = 28;
    // day
    const half = (src) => { // 2x nearest downscale of the full scene
      const d = fxlib.canvas(W / 2, H / 2, [0, 0, 0, 0]);
      for (let yy = 0; yy < H / 2; yy++) for (let xx = 0; xx < W / 2; xx++) { const s = (yy * 2 * W + xx * 2) * 4, dd = (yy * (W / 2) + xx) * 4; for (let k = 0; k < 4; k++) d.data[dd + k] = src.data[s + k]; }
      return d;
    };
    const d = half(day);
    const anchor = e.presentation.anchor;
    let ox = Math.floor(W / 4 - fw / 2), oy = anchor === "ground" ? Math.floor((GROUND / 2) - fh * 0.98) : Math.floor(H / 4 - fh / 2);
    pasteOver(d, combined[f], fw, fh, ox, oy);
    strip.paste(d.data, W / 2, H / 2, x, y);
    // night: scene -> night overlay already in sceneCanvas -> effect AFTER overlay + bounded emission
    const nc = half(nightC);
    pasteOver(nc, combined[f], fw, fh, ox, oy);
    if (e.export.lightEnergy > 0.5) pasteAdd(nc, light[f], fw, fh, ox, oy, Math.min(1, 0.52 * 0.55 + 0.25));
    strip.paste(nc.data, W / 2, H / 2, x, y + H / 2 + 8);
  });
  writeFileSync(join(out, `soh-day-night-${cat}.png`), strip.png());
  summary.push(`${cat}: ${e.id} (${e.export.frames}f)`);
  console.log("qa", cat, e.id);
}
console.log("DONE", summary.length, "categories ->", out);
