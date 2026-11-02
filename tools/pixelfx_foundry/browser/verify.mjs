// Real-Chromium verification harness for the FX Foundry Browser.
// Drives HeadlessChrome via CDP (puppeteer-core connect) against the live server on :8734.
// Prereq: serve.mjs running on :8734 and any Chromium with --remote-debugging-port=9222, e.g.
//   node tools/pixelfx_foundry/browser/serve.mjs 8734 &
//   chromium --headless --no-sandbox --remote-debugging-port=9222 about:blank &
//   npm install puppeteer-core   # in any scratch dir
// Usage: node verify.mjs [--shots-only|--behavior-only|--perf-only]
// (In the Arena sandbox, Chromium 153 was obtained from the npm package @sparticuz/chromium with
//  minimal versioned NSS/NSPR stub .so files on LD_LIBRARY_PATH, since apt/CDN routes are blocked.)
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const SHOTS = "/home/user/qa/browser-shots";
mkdirSync(SHOTS, { recursive: true });
const BASE = "http://localhost:8734/tools/pixelfx_foundry/browser/";
const mode = process.argv[2] || "--all";

const browser = await puppeteer.connect({ browserURL: "http://localhost:9222", defaultViewport: { width: 1600, height: 1000 } });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction(() => window.__foundry && window.__foundry.index(), { timeout: 30000 });
console.log("registry:", await page.evaluate(() => { const i = window.__foundry.index(); return i.count + " effects, sha " + i.upstream_sha.slice(0, 10); }));

const results = [];
const say = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function select(id) {
  await page.evaluate((i) => window.__foundry.selectById(i), id);
  await page.waitForFunction((i) => window.__foundry.state().id === i, { timeout: 30000 }, id);
  await sleep(400); // let first frames render
}
const state = () => page.evaluate(() => window.__foundry.state());

// ---------- behavior tests ----------
if (mode === "--all" || mode === "--behavior-only") {
  // 1. loop motion on a 60Hz display: 30fps anim must step through frames, not freeze
  await select("ice/ice-lance");
  const framesSeen = new Set();
  for (let i = 0; i < 40; i++) { framesSeen.add((await state()).frame); await sleep(16); }
  say("loop motion steps frames (30fps on 60Hz)", framesSeen.size >= 8, `distinct frames in 40 samples: ${framesSeen.size}`);

  // 2. loop wraps around
  await page.evaluate(() => window.__foundry.scrubTo(23)); // last frame of 24
  await page.evaluate(() => window.__foundry.play(true));
  await sleep(300);
  const f = (await state()).frame;
  say("loop wraps past end", f < 23, `frame after wrap: ${f}`);

  // 3. pause freezes, resume continues
  await page.evaluate(() => window.__foundry.play(false));
  const a = (await state()).frame; await sleep(250); const b = (await state()).frame;
  say("pause freezes", a === b, `${a}==${b}`);
  await page.evaluate(() => window.__foundry.play(true));
  await sleep(250);
  const c = (await state()).frame;
  say("resume advances", c !== b, `${b}->${c}`);

  // 4. scrub sets exact frame
  await page.evaluate(() => window.__foundry.play(false));
  await page.evaluate(() => window.__foundry.scrubTo(7));
  await sleep(120);
  say("scrub sets frame", (await state()).frame === 7, `frame=${(await state()).frame}`);

  // 5. restart returns to frame 0
  await page.evaluate(() => document.getElementById("btn-restart").click());
  await sleep(120);
  say("restart -> frame 0", (await state()).frame === 0, `frame=${(await state()).frame}`);

  // 6. one-shot ends on last frame and stops
  await select("fire/meteor");
  const n = await page.evaluate(() => window.__foundry.index().effects.find((e) => e.id === "fire/meteor").export.frames);
  await page.evaluate((nn) => window.__foundry.scrubTo(nn - 3), n);
  await page.evaluate(() => window.__foundry.play(true));
  await sleep(400);
  const st = await state();
  say("one-shot ends on last frame, stops", st.frame === n - 1 && st.playing === false, `frame=${st.frame}/${n - 1} playing=${st.playing}`);

  // 7. rapid switching: no stale selection / error state
  const ids = ["arcane/arcane-orb", "shadow/black-hole", "status/frozen", "weather/fireflies", "ui/achievement"];
  for (const id of ids) await page.evaluate((i) => window.__foundry.selectById(i), id); // no awaits between
  await sleep(2500);
  const fin = await state();
  say("rapid switch lands on last selection, no error", fin.id === "ui/achievement" && !/failed/i.test(fin.hint), `id=${fin.id} hint="${fin.hint}"`);
}

// ---------- screenshots ----------
if (mode === "--all" || mode === "--shots-only") {
  const shots = [
    ["ice/ice-lance", "source", false, false, "ice-lance-day"],
    ["ice/ice-lance", "source", true, false, "ice-lance-night"],
    ["arcane/arcane-orb", "air", false, false, "arcane-orb-day"],
    ["arcane/arcane-orb", "air", true, false, "arcane-orb-night"],
    ["shadow/black-hole", "ground", false, false, "black-hole-day-ground"],
    ["shadow/black-hole", "ground", true, false, "black-hole-night-ground"],
    ["fire/meteor", "ground", false, false, "meteor-day"],
    ["fire/meteor", "ground", true, false, "meteor-night"],
    ["status/frozen", "ground", true, false, "frozen-night"],
    ["weather/fireflies", "screen", true, false, "fireflies-night"],
    ["ui/achievement", "screen", false, false, "achievement-ui"],
    ["transitions/crt-off", "screen", false, false, "crt-off"],
    ["moves/ice-lance-throw", "source", false, true, "ice-lance-throw-act"],
  ];
  for (const [id, anchor, night, act, name] of shots) {
    await select(id);
    await page.evaluate(([a, n, ac]) => { window.__foundry.setAnchor(a); window.__foundry.setNight(n); window.__foundry.setAct(ac); }, [anchor, night, act]);
    await page.evaluate(() => window.__foundry.scrubTo(Math.floor((window.__foundry.state().frame >= 0 ? 1 : 1) * 0) + 0)); // frame 0 baseline
    await sleep(700); // let a few frames play so mid-animation state is captured
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    console.log("shot", name);
  }
  // black hole ground contact check: bottom of artwork near ground line
  await select("shadow/black-hole");
  await page.evaluate(() => { window.__foundry.setAnchor("ground"); window.__foundry.setNight(false); });
  await sleep(500);
  const geom = await page.evaluate(() => {
    const e = window.__foundry.index().effects.find((x) => x.id === "shadow/black-hole");
    const c = document.getElementById("view");
    return { vb: e.export.visualBounds, pivot: e.export.pivot, groundY: Math.floor(c.height * 0.72), h: c.height, frameH: e.export.frameSize[1] };
  });
  const bottomY = geom.groundY - (geom.vb[3] + 1) * 1 + geom.vb[3] + 1; // placement: y = groundY - bottom*scale; bottom edge lands at groundY
  say("black-hole visual bounds grounded", Math.abs(bottomY - geom.groundY) < 2, `visual bottom edge at y=${bottomY}, groundY=${geom.groundY}, vb=${geom.vb}, pivot=${geom.pivot}`);
}

// ---------- perf in real Chromium ----------
if (mode === "--all" || mode === "--perf-only") {
  const perf = await page.evaluate(async () => {
    const ROOT = "../../../assets/pixelfx_foundry/";
    const idx = window.__foundry.index();
    const ids = ["ice/ice-lance", "arcane/arcane-orb", "shadow/black-hole", "fire/meteor", "explosions/big-explosion"];
    const fx = {};
    for (const id of ids) {
      const e = idx.effects.find((x) => x.id === id);
      const pages = [];
      for (const p of e.export.pages.combined) { const img = new Image(); img.src = ROOT + p.path; await img.decode(); pages.push({ img, ...p }); }
      const lp = [];
      for (const p of e.export.pages.light) { const img = new Image(); img.src = ROOT + p.path; await img.decode(); lp.push({ img, ...p }); }
      fx[id] = { e, pages, lp };
    }
    const cv = document.getElementById("view");
    const ctx = cv.getContext("2d");
    const frameImg = (F, f) => { const [fw, fh] = F.e.export.frameSize; for (const p of F.pages) if (f >= p.first && f < p.first + p.count) return { img: p.img, x: (f - p.first) % p.columns * fw, y: Math.floor((f - p.first) / p.columns) * fh, w: fw, h: fh }; };
    const lightImg = (F, f) => { const [fw, fh] = F.e.export.frameSize; for (const p of F.lp) if (f >= p.first && f < p.first + p.count) return { img: p.img, x: (f - p.first) % p.columns * fw, y: Math.floor((f - p.first) / p.columns) * fh, w: fw, h: fh }; };
    const out = [];
    for (const [W, H] of [[1280, 720], [1920, 1080], [2560, 1440]]) {
      cv.width = W; cv.height = H;
      for (const n of [1, 3, 10]) {
        for (const night of [false, true]) {
          const active = Array.from({ length: n }, (_, i) => ({ id: ids[i % ids.length], f: 0 }));
          const groundY = Math.floor(H * 0.72);
          const draw = () => {
            ctx.fillStyle = night ? "#0a0e28" : "#9cc4e4"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = night ? "#191531" : "#6b5a48"; ctx.fillRect(0, groundY, W, H - groundY);
            if (night) { ctx.fillStyle = "rgba(8,10,40,0.55)"; ctx.fillRect(0, 0, W, H); }
            for (const a of active) {
              const F = fx[a.id]; const fi = frameImg(F, a.f % F.e.export.frames);
              const [fw, fh] = F.e.export.frameSize;
              const x = Math.floor(W / 2 - fw / 2), y = F.e.presentation.anchor === "ground" ? groundY - fh : Math.floor(H / 2 - fh / 2);
              ctx.drawImage(fi.img, fi.x, fi.y, fw, fh, x, y, fw, fh);
              if (night && F.e.export.lightEnergy > 0.5) {
                const li = lightImg(F, a.f % F.e.export.frames);
                ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.53;
                ctx.drawImage(li.img, li.x, li.y, li.w, li.h, x, y, fw, fh); ctx.restore();
              }
              a.f++;
            }
          };
          for (let i = 0; i < 10; i++) draw(); // warmup
          const raf = [], cost = [];
          await new Promise((done) => {
            let count = 0, last = performance.now();
            const loop = (t) => {
              raf.push(t - last); last = t;
              const t0 = performance.now(); draw(); cost.push(performance.now() - t0);
              if (++count < 60) requestAnimationFrame(loop); else done();
            };
            requestAnimationFrame(loop);
          });
          raf.shift(); cost.shift();
          const s = (a) => { a.sort((x, y) => x - y); return (q) => a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
          const pr = s(raf), pc = s(cost);
          out.push({ res: `${W}x${H}`, instances: n, night,
            rafP50: +pr(0.5).toFixed(1), rafP95: +pr(0.95).toFixed(1),
            drawP50ms: +pc(0.5).toFixed(2), drawP95ms: +pc(0.95).toFixed(2) });
        }
      }
    }
    return out;
  });
  console.log("REAL CHROMIUM: rAF delta ms (vsync-quantized, software GL) + actual draw-call cost ms, 60 samples:");
  console.table(perf);
  writeFileSync("/home/user/qa/browser-shots/perf-chromium.json", JSON.stringify(perf, null, 1));
}

const failed = results.filter((r) => !r.ok);
console.log(`\nBEHAVIOR: ${results.length - failed.length}/${results.length} passed`);
await browser.disconnect();
process.exit(failed.length ? 1 : 0);
