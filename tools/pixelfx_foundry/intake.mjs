#!/usr/bin/env node
// SOH × PixelFX — Universal FX Foundry intake: discover, export, verify, resume.
//
//   node tools/pixelfx_foundry/intake.mjs --upstream /path/to/pixelfx --out assets/pixelfx_foundry
//   node tools/pixelfx_foundry/intake.mjs --upstream /path/to/pixelfx --out assets/pixelfx_foundry --ids ice/ice-lance,fire/meteor
//   node tools/pixelfx_foundry/intake.mjs --upstream /path/to/pixelfx --out assets/pixelfx_foundry --report-only
//
// Pipeline per effect, using ONLY the official upstream renderer (tools/lib/fxlib.mjs @ pinned SHA):
//   renderFrames({bg:"none"})  -> canonical `clear` (combined color+light over transparency), raw color, additive light
//   renderAct({bg:"none"})     -> performed preview (stock stand-in actor) for effects exporting `act`
//   channels written as bounded atlas pages (combined / color / light / act), each page PNG + sha256
//   parity gate: atlas PNGs are decoded back with an independent decoder and compared byte-exact
//   against the in-memory source frames -> PARITY_PASS / PARITY_FAIL (never inferred from file existence)
//
// Statuses: DISCOVERED -> EXPORTED -> PARITY_PASS. VISUAL_REVIEWED / SOH_READY stay human/gated and are
// never set automatically. extraShapes is hard-false for every effect.
import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync, copyFileSync, statSync } from "node:fs";
import { resolve, join, dirname, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { decodePNG } from "./lib/png-decode.mjs";

const argv = process.argv.slice(2);
const flag = (name, d = "") => { const i = argv.indexOf(name); return i < 0 ? d : argv[i + 1]; };
const has = (name) => argv.includes(name);
const upstream = resolve(flag("--upstream", ""));
const out = resolve(flag("--out", "assets/pixelfx_foundry"));
const maxSide = Number(flag("--page", "2048"));
const select = flag("--ids", "");
const reportOnly = has("--report-only");

const digest = (b) => createHash("sha256").update(b).digest("hex");
const atomic = (file, data) => { mkdirSync(dirname(file), { recursive: true }); const t = file + ".tmp"; writeFileSync(t, JSON.stringify(data, null, 1)); renameSync(t, file); };
const git = (...args) => execFileSync("git", ["-C", upstream, ...args], { encoding: "utf8" }).trim();
const rel = (file) => relative(out, file).replaceAll("\\", "/");

// Uint32 ABGR word array -> RGBA bytes (little-endian memory order: R,G,B,A)
const rgba32 = (words) => {
  const d = new Uint8ClampedArray(words.length * 4);
  for (let i = 0; i < words.length; i++) { const w = words[i] >>> 0; d[i * 4] = w & 255; d[i * 4 + 1] = (w >>> 8) & 255; d[i * 4 + 2] = (w >>> 16) & 255; d[i * 4 + 3] = w >>> 24; }
  return d;
};
// Additive light words -> emission map RGBA: RGB kept, alpha 255 where any light, else 0
const lightRGBA = (words) => {
  const d = rgba32(words);
  for (let i = 0; i < words.length; i++) d[i * 4 + 3] = (words[i] & 0xffffff) ? 255 : 0;
  return d;
};

const saveFile = (entry, path, bytes) => {
  const b = Buffer.from(bytes);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, b);
  entry.export.files.push({ path: rel(path), sha256: digest(b), bytes: b.length });
};

// Data-driven presentation proposals (NOT facts; visual acceptance still required).
function proposePresentation(id, fx, isScreen) {
  const cat = id.split("/")[0], m = fx.meta, act = fx.mod.act;
  let anchor = "source", depth = "back-front", roleCandidate = "combat/ambient (TBD)", sceneInteraction = "none";
  if (isScreen || cat === "transitions" || cat === "weather" || cat === "ui") { anchor = "screen"; depth = "screen"; }
  if (cat === "ui") roleCandidate = "ui";
  else if (cat === "transitions") roleCandidate = "screen transition";
  else if (cat === "weather") roleCandidate = "environment";
  else if (cat === "pickups") roleCandidate = "pickup";
  else if (cat === "critters") roleCandidate = "ambient critter";
  else if (cat === "spawn") roleCandidate = "spawn/arrival";
  else if (cat === "status") roleCandidate = "on-body status";
  else if (cat === "moves" || cat === "melee") roleCandidate = "acted move";
  else if (cat === "projectiles") roleCandidate = "projectile";
  else if (cat === "explosions" || cat === "impacts") roleCandidate = "impact";
  if (act?.onBody) anchor = "body";
  else if (act && !isScreen) anchor = "act";
  else if (m.bg === "ground" && !isScreen) anchor = "ground";
  else if (cat === "projectiles" || cat === "arcane" || cat === "scifi") anchor = "air";
  if (id === "shadow/black-hole") sceneInteraction = "warp";
  return { roleCandidate, anchor, depth, emissiveNight: "post-night", sceneInteraction, extraShapes: false };
}

async function run() {
  if (!upstream || !existsSync(join(upstream, "tools/lib/fxlib.mjs"))) throw new Error("Provide a clean OFFICIAL PixelFX checkout via --upstream /path/to/pixelfx");
  if (!Number.isInteger(maxSide) || maxSide < 256 || maxSide > 8192) throw new Error("Invalid --page");
  const sha = git("rev-parse", "HEAD");
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Upstream checkout lacks a complete 40-char git SHA");
  if (git("status", "--porcelain") && !has("--allow-dirty")) throw new Error("Upstream is dirty; supply a clean pinned git checkout");
  const fxlib = await import(pathToFileURL(join(upstream, "tools/lib/fxlib.mjs")).href);
  const core = await import(pathToFileURL(join(upstream, "src/core/index.js")).href);
  const { encodePNG } = await import(pathToFileURL(join(upstream, "tools/lib/png.mjs")).href);
  // Byte-exact atlas writer: unlike fxlib.canvas().paste (which alpha-blends), this copies frame
  // pixels verbatim so the parity gate can compare decoded PNG bytes against source frames 1:1.
  const atlasPNG = (w, h, put) => {
    const data = new Uint8ClampedArray(w * h * 4);
    put(data, w);
    return encodePNG(w, h, data);
  };
  const pasteFrame = (data, W, frame, fw, fh, x, y) => {
    for (let yy = 0; yy < fh; yy++) {
      const s = yy * fw * 4, d = ((y + yy) * W + x) * 4;
      for (let xx = 0; xx < fw * 4; xx++) data[d + xx] = frame[s + xx];
    }
  };

  // G0 — provenance gate: the pinned source must expose exactly 244 unique IDs in 21 categories.
  const ids = fxlib.allIds();
  if (ids.length !== 244 || new Set(ids).size !== 244) throw new Error(`G0 FAIL: expected 244 unique FX IDs, found ${ids.length}/${new Set(ids).size} @ ${sha}`);
  const catCount = new Set(ids.map((i) => i.split("/")[0])).size;
  if (catCount !== 21) throw new Error(`G0 FAIL: expected 21 categories, found ${catCount} @ ${sha}`);
  const wanted = select ? select.split(",").map((x) => x.trim()).filter(Boolean) : ids;
  for (const id of wanted) if (!ids.includes(id)) throw new Error("Unknown ID: " + id);

  const indexPath = join(out, "index.json");
  const old = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : null;
  if (old && old.upstream_sha !== sha) throw new Error("Existing output belongs to a different upstream SHA; wipe --out or change source");
  const previous = new Map((old?.effects || []).map((e) => [e.id, e]));

  const categories = {};
  for (const id of ids) { const c = id.split("/")[0]; categories[c] = (categories[c] || 0) + 1; }
  const index = {
    schema: "soh.pixelfx.foundry.v1",
    generated: "universal intake via official upstream renderer",
    upstream: "https://github.com/patch-gg/pixelfx",
    upstream_sha: sha,
    upstream_license: "MIT (see LICENSE / NOTICE.md)",
    node: process.version,
    count: ids.length,
    categories,
    effects: [],
    updated: new Date().toISOString(),
    notes: "DISCOVERED/EXPORTED/PARITY_PASS are machine-verified. VISUAL_REVIEWED and SOH_READY are human/gated and never inferred. extraShapes=false everywhere.",
  };

  // ---- discovery pass (metadata only) ----
  // exact visual-bounds backfill for verified exports produced before this field existed
  const backfillBounds = (e) => {
    const [w, h] = e.export.frameSize;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (const p of e.export.pages.combined) {
      const dec = decodePNG(readFileSync(join(out, p.path)));
      for (let j = 0; j < p.count; j++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (dec.data[((Math.floor(j / p.columns) * h + y) * dec.w + (j % p.columns) * w + x) * 4 + 3] > 0) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; // frame-space bounds
        }
      }
    }
    if (x1 >= 0) { e.export.visualBounds = [x0, y0, x1, y1]; e.export.visualCenter = [(x0 + x1) / 2, (y0 + y1) / 2]; }
  };
  for (const id of ids) {
    const prev = previous.get(id);
    if (prev && old.upstream_sha === sha) { // keep prior per-effect state on resume
      if (prev.export?.state === "PARITY_PASS" && !prev.export.visualBounds && prev.export.pages?.combined) backfillBounds(prev);
      index.effects.push(prev); continue;
    }
    const fx = await fxlib.loadEffect(id), m = fx.meta;
    const isScreen = m.size[0] >= 320 && Math.abs(m.size[0] / m.size[1] - 16 / 9) < 0.05;
    const e = {
      id, category: id.split("/")[0], name: m.name, desc: m.desc || "", tags: m.tags || [],
      implementation: fx.mod.create ? "simulated" : "pure",
      hasAct: !!fx.mod.act, onBody: !!fx.mod.act?.onBody, screen: isScreen,
      actor: m.actor || 0,
      meta: { fps: m.fps, duration: m.duration, loop: m.loop, size: m.size, origin: m.origin, bg: m.bg },
      act: fx.mod.act ? core.actTiming(fx.mod) : null,
      presentation: proposePresentation(id, fx, isScreen),
      provenance: { repo: "https://github.com/patch-gg/pixelfx", commit: sha, license: "MIT" },
      export: { state: "DISCOVERED", files: [] },
      qa: { parity: "UNTESTED", visual: "PENDING", sohReady: false, exceptions: [] },
    };
    index.effects.push(e);
  }
  if (Object.keys(index.categories).length !== 21) throw new Error("G0 FAIL: category count drifted during discovery");
  atomic(indexPath, index);
  console.log(`G0 PASS: ${ids.length} unique IDs / 21 categories @ ${sha}`);
  if (reportOnly) return;

  // ---- export pass ----
  let exported = 0, cached = 0, failed = 0;
  for (const id of wanted) {
    const e = index.effects.find((x) => x.id === id);
    // resume: keep prior PARITY_PASS exports whose files still verify
    if (e.export?.state === "PARITY_PASS" && e.export.files.every((f) => existsSync(join(out, f.path)) && digest(readFileSync(join(out, f.path))) === f.sha256)) {
      cached++; console.log("CACHED", id); continue;
    }
    const t0 = Date.now();
    try {
      const fx = await fxlib.loadEffect(id);
      const m = fx.meta;
      const r = fxlib.renderFrames(fx, { bg: "none" });
      if (r.w > maxSide || r.h > maxSide) throw new Error(`frame ${r.w}x${r.h} exceeds page ${maxSide}`);

      // channel sanity: recomposing raw+light through the official compositor must equal canonical `clear`
      for (const i of [0, Math.floor(r.n / 2), r.n - 1]) {
        const ff = core.createFrame(r.w, r.h);
        ff.color.set(r.frames[i].raw); ff.light.set(r.frames[i].light);
        const re = core.composite(ff, new Uint8ClampedArray(r.w * r.h * 4), null);
        if (Buffer.compare(Buffer.from(re), Buffer.from(r.frames[i].clear)) !== 0)
          throw new Error(`channel recomposition mismatch at frame ${i}`);
      }

      e.export = { state: "EXPORTED", files: [], frames: r.n, fps: r.fps, frameSize: [r.w, r.h], pivot: m.origin, frameHashes: r.frames.map((f) => digest(Buffer.from(f.clear))), pages: {} };
      const channels = {
        combined: (f) => f.clear,
        color: (f) => rgba32(f.raw),
        light: (f) => lightRGBA(f.light),
      };
      const cols = Math.max(1, Math.floor(maxSide / r.w));
      const perPage = cols * Math.max(1, Math.floor(maxSide / r.h));
      for (const [ch, fn] of Object.entries(channels)) {
        e.export.pages[ch] = [];
        for (let base = 0; base < r.n; base += perPage) {
          const n = Math.min(perPage, r.n - base);
          const rows = Math.ceil(n / cols);
          const png = atlasPNG(cols * r.w, rows * r.h, (data, W) => {
            for (let j = 0; j < n; j++) pasteFrame(data, W, fn(r.frames[base + j]), r.w, r.h, (j % cols) * r.w, Math.floor(j / cols) * r.h);
          });
          const p = join(out, "assets", id, `${ch}-${Math.floor(base / perPage)}.png`);
          saveFile(e, p, png);
          e.export.pages[ch].push({ path: rel(p), first: base, count: n, columns: cols, rows, dimensions: [cols * r.w, rows * r.h] });
        }
      }
      // performed preview for acted effects (stock stand-in actor; NEVER to be baked into SOH sprites)
      if (fx.mod.act) {
        const ra = fxlib.renderAct(fx, { bg: "none", fps: Math.min(30, m.fps), seconds: m.loop ? m.duration * 2 : Math.max(8, m.duration + 1) });
        const colsA = Math.max(1, Math.floor(maxSide / ra.w));
        const perA = colsA * Math.max(1, Math.floor(maxSide / ra.h));
        e.export.act = { frames: ra.n, fps: ra.fps, frameSize: [ra.w, ra.h], pivot: ra.pivot, pages: [] };
        for (let base = 0; base < ra.n; base += perA) {
          const n = Math.min(perA, ra.n - base);
          const rows = Math.ceil(n / colsA);
          const png = atlasPNG(colsA * ra.w, rows * ra.h, (data, W) => {
            for (let j = 0; j < n; j++) pasteFrame(data, W, ra.frames[base + j].clear, ra.w, ra.h, (j % colsA) * ra.w, Math.floor(j / colsA) * ra.h);
          });
          const p = join(out, "assets", id, `act-${Math.floor(base / perA)}.png`);
          saveFile(e, p, png);
          e.export.act.pages.push({ path: rel(p), first: base, count: n, columns: colsA, rows, dimensions: [colsA * ra.w, rows * ra.h] });
        }
      }
      // emission energy (mean light luminance) — drives night emphasis, source-derived only
      let lum = 0;
      for (const f of r.frames) for (let i = 0; i < f.light.length; i++) { const l = f.light[i] & 0xffffff; if (l) lum += Math.max(l & 255, (l >>> 8) & 255, (l >>> 16) & 255); }
      e.export.lightEnergy = +(lum / Math.max(1, r.frames.length * r.w * r.h)).toFixed(4);
      // visual bounds of the actual artwork (union of non-transparent pixels over all frames), so anchoring
      // can distinguish source pivot vs visual center vs ground contact point without per-effect constants
      let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
      for (const f of r.frames) for (let i = 0; i < f.clear.length; i += 4)
        if (f.clear[i + 3] > 0) {
          const x = (i / 4) % r.w, y = Math.floor(i / 4 / r.w);
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      e.export.visualBounds = x1 >= 0 ? [x0, y0, x1, y1] : [0, 0, r.w - 1, r.h - 1];
      e.export.visualCenter = [(x0 + x1) / 2, (y0 + y1) / 2];

      // G1 — independent parity gate: decode every written page back and compare byte-exact to source frames
      const checkChannel = (ch, fn) => {
        for (const page of e.export.pages[ch]) {
          const dec = decodePNG(readFileSync(join(out, page.path)));
          if (dec.w !== page.dimensions[0] || dec.h !== page.dimensions[1]) throw new Error(`${ch} page ${page.path} size mismatch`);
          for (let j = 0; j < page.count; j++) {
            const f = r.frames[page.first + j];
            const src = fn(f);
            for (let y = 0; y < r.h; y++) {
              const so = (y * r.w) * 4, drow = ((Math.floor(j / page.columns) * r.h + y) * dec.w + (j % page.columns) * r.w) * 4;
              for (let x = 0; x < r.w * 4; x++) if (dec.data[drow + x] !== src[so + x]) throw new Error(`${ch} pixel mismatch ${id} frame ${page.first + j}`);
            }
          }
        }
      };
      checkChannel("combined", (f) => f.clear);
      checkChannel("color", (f) => rgba32(f.raw));
      checkChannel("light", (f) => lightRGBA(f.light));
      e.qa.parity = "PARITY_PASS";
      e.export.state = "PARITY_PASS";
      atomic(indexPath, index);
      exported++;
      console.log(`PARITY_PASS ${id}  ${r.n}f ${r.w}x${r.h} @${r.fps}fps  ${(Date.now() - t0)}ms  light=${e.export.lightEnergy}`);
    } catch (err) {
      failed++;
      e.export.state = "FAILED";
      e.qa.parity = "PARITY_FAIL";
      e.qa.exceptions.push(String(err.message || err));
      atomic(indexPath, index);
      console.error(`FAILED ${id}: ${err.message}`);
    }
  }
  for (const f of ["LICENSE", "NOTICE.md"]) { const s = join(upstream, f); if (existsSync(s)) copyFileSync(s, join(out, f)); }
  atomic(indexPath, index);
  const done = index.effects.filter((e) => e.export.state === "PARITY_PASS").length;
  console.log(`FINISHED: ${done}/${index.effects.length} PARITY_PASS (${exported} exported this run, ${cached} resumed, ${failed} failed) @ ${sha}`);
}
run().catch((e) => { console.error("INTAKE FAILURE", e.message); process.exitCode = 1; });
