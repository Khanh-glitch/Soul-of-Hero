// Real-Chromium verification harness for the FX Foundry Browser (final presentation round).
// Drives HeadlessChrome via CDP (puppeteer-core connect) against the live server on :8734.
// Captures DELIBERATE authored timestamps (start / anticipation / release-impact / midpoint / decay / end)
// as canvas captures and assembles comparison strips. Also runs behavior tests, a pixel-level Black Hole
// grounding check, and real-playback perf (single + 3-FX combat demo, day/night, 3 resolutions).
// Prereq: node tools/pixelfx_foundry/browser/serve.mjs 8734  and  chromium --headless --remote-debugging-port=9222
// Usage: node verify.mjs [--all|--behavior|--shots|--perf]
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const SHOTS = "/home/user/qa/browser-shots";
const GALLERY = "/home/user/Soul-of-Hero/docs/pixelfx_foundry/qa/gallery";
mkdirSync(SHOTS, { recursive: true });
mkdirSync(GALLERY, { recursive: true });
const BASE = "http://localhost:8734/tools/pixelfx_foundry/browser/";
const mode = process.argv[2] || "--all";

const browser = await puppeteer.connect({ browserURL: "http://localhost:9222", defaultViewport: { width: 1600, height: 1000 } });
// close leftover pages from previous harness runs so they don't contend for the software rasterizer
const old = await browser.pages();
const page = await browser.newPage();
for (const p of old) { try { await p.close(); } catch {} }
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction(() => window.__foundry && window.__foundry.index(), { timeout: 30000 });
console.log("registry:", await page.evaluate(() => { const i = window.__foundry.index(); return i.count + " effects, sha " + i.upstream_sha.slice(0, 10); }));

const results = [];
const say = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function select(id) {
  await page.evaluate((i) => window.__foundry.selectById(i), id);
  await page.waitForFunction((i) => window.__foundry.state().id === i, { timeout: 30000 }, id);
  await sleep(400);
}
const state = () => page.evaluate(() => window.__foundry.state());

// authored capture fractions: start, anticipation, release/impact, midpoint, decay, ending
const FRACS = [0, 0.22, 0.45, 0.62, 0.8, 0.97];
async function captureStrip(id, anchor, night, name, opts = {}) {
  await select(id);
  await page.evaluate(([a, n]) => { window.__foundry.setAnchor(a); window.__foundry.setNight(n); }, [anchor, night]);
  if (opts.act) await page.evaluate(() => window.__foundry.setAct(true));
  if (opts.scale) await page.evaluate((s) => window.__foundry.setScale(s), opts.scale);
  await sleep(600);
  const n = await page.evaluate(() => { const i = window.__foundry.index().effects.find((e) => e.id === arguments[0]); return 0; }, id).catch(() => 0);
  const frames = await page.evaluate((id) => window.__foundry.index().effects.find((e) => e.id === id).export.frames, id);
  const picks = FRACS.map((f) => Math.min(frames - 1, Math.round(f * (frames - 1))));
  const dataUrls = [];
  for (const f of picks) dataUrls.push(await page.evaluate((ff) => window.__foundry.captureFrame(ff), f));
  // assemble strip in-page
  const strip = await page.evaluate(async (urls) => {
    const imgs = await Promise.all(urls.map((u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; })));
    const w = imgs[0].width, h = imgs[0].height, pad = 6, label = 18;
    const c = document.createElement("canvas");
    c.width = imgs.length * (w + pad) + pad; c.height = h + label + pad * 2;
    const g = c.getContext("2d");
    g.fillStyle = "#14121c"; g.fillRect(0, 0, c.width, c.height);
    imgs.forEach((im, i) => { g.drawImage(im, pad + i * (w + pad), label + pad); });
    return c.toDataURL("image/png");
  }, dataUrls);
  const buf = Buffer.from(strip.split(",")[1], "base64");
  writeFileSync(`${GALLERY}/${name}.png`, buf);
  writeFileSync(`${SHOTS}/${name}.png`, buf);
  console.log("strip", name, `${buf.length / 1024 | 0}KB`, "frames", picks.join(","));
  if (opts.act) await page.evaluate(() => window.__foundry.setAct(false));
}

// ---------- behavior ----------
if (mode === "--all" || mode === "--behavior") {
  await select("ice/ice-lance");
  const seen = new Set();
  for (let i = 0; i < 40; i++) { seen.add((await state()).frame); await sleep(16); }
  say("loop motion on 60Hz display", seen.size >= 8, `distinct=${seen.size}`);
  await page.evaluate(() => window.__foundry.scrubTo(23));
  await page.evaluate(() => window.__foundry.play(true));
  await sleep(300);
  say("loop wraps", (await state()).frame < 23);
  await page.evaluate(() => window.__foundry.play(false));
  const a = (await state()).frame; await sleep(250); const b = (await state()).frame;
  say("pause freezes", a === b);
  await page.evaluate(() => window.__foundry.play(true)); await sleep(250);
  say("resume advances", (await state()).frame !== b);
  await page.evaluate(() => window.__foundry.scrubTo(7)); await sleep(150);
  say("scrub exact", (await state()).frame === 7);
  await page.evaluate(() => document.getElementById("btn-restart").click()); await sleep(150);
  say("restart -> 0", (await state()).frame === 0);
  await select("fire/meteor");
  const nf = await page.evaluate(() => window.__foundry.index().effects.find((e) => e.id === "fire/meteor").export.frames);
  await page.evaluate((nn) => window.__foundry.scrubTo(nn - 3), nf);
  await page.evaluate(() => window.__foundry.play(true)); await sleep(400);
  const st = await state();
  say("one-shot ends on last frame", st.frame === nf - 1 && !st.playing, `frame=${st.frame}/${nf - 1}`);
  for (const id of ["arcane/arcane-orb", "shadow/black-hole", "status/frozen", "weather/fireflies", "ui/achievement"])
    await page.evaluate((i) => window.__foundry.selectById(i), id);
  await sleep(2500);
  const fin = await state();
  say("rapid switch -> last, no error", fin.id === "ui/achievement" && !/failed/i.test(fin.hint), `id=${fin.id}`);
  // combat demo: 3 effects playing simultaneously
  await page.evaluate(() => { window.__foundry.play(true); window.__foundry.setDemo(true); });
  await sleep(1200);
  const d1 = await state();
  await sleep(500);
  const d2 = await state();
  say("combat demo animates (3 FX)", d1.demoMode && d2.animT > d1.animT, `animT ${d1.animT.toFixed(2)} -> ${d2.animT.toFixed(2)}`);
  await page.evaluate(() => window.__foundry.setDemo(false));
}

// ---------- authored-timestamp gallery ----------
if (mode === "--all" || mode === "--shots") {
  await page.evaluate(() => window.__foundry.setScene(true));
  await captureStrip("ice/ice-lance", "source", false, "soh-ice-lance-day");
  await captureStrip("ice/ice-lance", "source", true, "soh-ice-lance-night");
  await captureStrip("arcane/arcane-orb", "air", false, "soh-arcane-orb-day");
  await captureStrip("arcane/arcane-orb", "air", true, "soh-arcane-orb-night");
  await captureStrip("shadow/black-hole", "ground", false, "soh-black-hole-day-ground");
  await captureStrip("shadow/black-hole", "ground", true, "soh-black-hole-night-ground");
  await captureStrip("fire/meteor", "ground", false, "soh-meteor-day-ground");
  await captureStrip("fire/meteor", "ground", true, "soh-meteor-night-ground");
  await captureStrip("status/frozen", "ground", true, "soh-frozen-night");
  await captureStrip("weather/fireflies", "screen", true, "soh-fireflies-night");
  await captureStrip("moves/ice-lance-throw", "source", false, "soh-ice-lance-throw-act", { act: true });
  await captureStrip("explosions/big-explosion", "ground", true, "soh-big-explosion-night");

  // grounding check: probe the actual drawImage rect and verify the solid-core bottom edge lands on the
  // ground line (within the authored sink), i.e. the disk rests on the battlefield instead of hovering
  await select("shadow/black-hole");
  await page.evaluate(() => { window.__foundry.setAnchor("ground"); window.__foundry.setNight(false); });
  await sleep(600);
  const g = await page.evaluate(async () => {
    const c = document.getElementById("view");
    const ctx = c.getContext("2d");
    const orig = ctx.drawImage.bind(ctx);
    let last = null;
    ctx.drawImage = (...a) => { if (a.length === 9 && a[3] > 100 && a[4] > 100) last = { sw: a[3], sh: a[4], dy: a[6], dh: a[8] }; return orig(...a); };
    await new Promise((r) => setTimeout(r, 400));
    const e = window.__foundry.index().effects.find((x) => x.id === "shadow/black-hole");
    return { last, core: e.export.coreBounds, fh: e.export.frameSize[1], groundY: Math.floor(c.height * 0.66) };
  });
  const coreBottom = g.last.dy + ((g.core[3] + 1) / g.fh) * g.last.dh;
  const sinkPx = (g.last.dh / g.fh) * Math.max(3, Math.round(0.08 * (g.core[3] - g.core[1])));
  const rest = coreBottom - g.groundY; // should be within [0, sinkPx]
  say("black-hole solid core rests on ground line", g.last && rest >= -2 && rest <= sinkPx + 2,
    `core bottom y=${coreBottom.toFixed(1)}, groundY=${g.groundY}, rests ${rest.toFixed(1)}px into ground (sink=${sinkPx.toFixed(1)})`);
}

// ---------- perf: real playback, cached scene, 1 and 3 instances, day/night, 3 resolutions ----------
if (mode === "--all" || mode === "--perf") {
  await page.evaluate(async () => {
    const F = window.__foundry;
    await F.selectById("shadow/black-hole");
    await new Promise((r) => setTimeout(r, 800));
    F.setAnchor("ground");
  });
  const perf = [];
  for (const [W, H] of [[1280, 720], [1920, 1080], [2560, 1440]]) {
    await page.setViewport({ width: W + 560, height: H + 130 }); // stage canvas ~= target resolution
    await sleep(800);
    for (const night of [false, true]) {
      for (const demo of [false, true]) {
        const row = await page.evaluate(async (night, demo) => {
          const F = window.__foundry;
          F.setNight(night);
          if (demo) F.setDemo(true); else F.setDemo(false);
          await new Promise((r) => setTimeout(r, 700)); // warmup + scene cache
          const c = document.getElementById("view");
          const raf = [];
          await new Promise((done) => {
            let count = 0, last = performance.now();
            const loop = (t) => { raf.push(t - last); last = t; if (++count < 60) requestAnimationFrame(loop); else done(); };
            requestAnimationFrame(loop);
          });
          raf.shift();
          raf.sort((a, b) => a - b);
          const p = (q) => raf[Math.min(raf.length - 1, Math.floor(q * raf.length))];
          return { res: `${c.width}x${c.height}`, night, fx: demo ? 3 : 1, rafP50ms: +p(0.5).toFixed(1), rafP95ms: +p(0.95).toFixed(1) };
        }, night, demo);
        perf.push(row);
        console.log("perf", JSON.stringify(row));
      }
    }
  }
  await page.evaluate(() => { window.__foundry.setDemo(false); window.__foundry.setNight(false); });
  await page.setViewport({ width: 1600, height: 1000 });
  console.log("REAL CHROMIUM live playback (rAF delta ms, software GL, 60 frames; scene is a cached blit):");
  console.table(perf);
  writeFileSync(`${GALLERY}/perf-chromium-final.json`, JSON.stringify(perf, null, 1));
  writeFileSync(`${SHOTS}/perf-chromium-final.json`, JSON.stringify(perf, null, 1));
}

const failed = results.filter((r) => !r.ok);
console.log(`\nBEHAVIOR: ${results.length - failed.length}/${results.length} passed`);
await browser.disconnect();
process.exit(failed.length ? 1 : 0);
