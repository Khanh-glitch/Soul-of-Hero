// SOH × PixelFX — FX Foundry Browser. Lazy-loads the registry and per-effect atlas pages produced by
// tools/pixelfx_foundry/intake.mjs. Presentation rules: original source frames only, extraShapes=false,
// effect composited AFTER the night overlay with bounded emission boost. The "SOH scene" is an isolated
// test environment built from real SOH game assets (stone-ground tileset, grass horizon, knight idle
// sprite) — production scenes untouched. Anchoring distinguishes source pivot / visual focal point /
// solid-core contact point (coreBounds bottom) / authored debris (visualBounds).
const qs = new URLSearchParams(location.search);
const ROOT = qs.get("root") || "../../../assets/pixelfx_foundry/";
const SOH = qs.get("soh") || "../../../assets/";
const $ = (id) => document.getElementById(id);
const view = $("view"), ctx = view.getContext("2d");

let index = null, current = null, pages = { combined: [], light: [], act: [] };
let playing = true, animT = 0, lastT = 0, night = false, sceneMode = true, lightMode = false, actMode = false, demoMode = false;
let anchor = "source", scale = 1, userScale = false;
let selGen = 0;
let warpCache = null, warpAt = 0;
let lastW = 0, lastH = 0, lastDpr = 0;
let sceneDay = null, sceneNight = null; // cached SOH scene renders (perf: one blit per frame, not a repaint)
let sohAssets = null;

// ---------- registry ----------
async function loadIndex() {
  const res = await fetch(ROOT + "index.json");
  if (!res.ok) throw new Error("registry fetch failed: " + res.status);
  index = await res.json();
  $("status-line").textContent =
    `${index.count} effects · ${Object.keys(index.categories).length} categories · upstream ${index.upstream_sha.slice(0, 10)} · ${index.upstream_license}`;
  buildNav("");
}
function buildNav(filter) {
  const nav = $("categories");
  nav.innerHTML = "";
  const q = filter.toLowerCase();
  for (const [cat, count] of Object.entries(index.categories)) {
    const fx = index.effects.filter((e) => e.category === cat && (!q || (e.id + " " + e.name + " " + e.tags.join(" ")).toLowerCase().includes(q)));
    if (!fx.length) continue;
    const div = document.createElement("div");
    div.className = "cat";
    const b = document.createElement("button");
    b.innerHTML = `<span>${cat}</span><span class="count">${fx.length}/${count}</span>`;
    b.onclick = () => { div.querySelectorAll(".fx").forEach((n) => (n.style.display = n.style.display === "none" ? "" : "none")); };
    div.appendChild(b);
    for (const e of fx) {
      const f = document.createElement("button");
      f.className = "fx" + (current === e ? " active" : "");
      const st = e.export.state === "PARITY_PASS" ? "✓" : e.export.state === "FAILED" ? "✗" : "·";
      f.innerHTML = `<span>${e.id.split("/")[1]}</span><span class="st">${st}</span>`;
      f.title = e.name;
      f.onclick = () => select(e);
      div.appendChild(f);
    }
    nav.appendChild(div);
  }
}
$("search").oninput = (ev) => buildNav(ev.target.value);

// ---------- selection / lazy atlas loading ----------
async function loadPages(e, channel) {
  const key = channel === "act" ? e.export.act?.pages : e.export.pages[channel];
  if (!key) return [];
  const out = [];
  for (const p of key) {
    const img = new Image();
    img.src = ROOT + p.path;
    await img.decode();
    out.push({ img, ...p });
  }
  return out;
}
async function select(e) {
  const gen = ++selGen;
  current = e;
  animT = 0;
  pages = { combined: [], light: [], act: [] };
  demoMode = false; $("mode-demo").checked = false;
  document.querySelectorAll(".fx").forEach((n) => n.classList.remove("active"));
  $("fx-title").textContent = `${e.id} — ${e.name}`;
  $("stage-hint").textContent = "loading atlas…";
  $("stage-hint").style.display = "";
  $("mode-act").style.display = e.export.act ? "" : "none";
  $("sel-anchor").value = e.presentation.anchor === "screen" ? "screen" : e.presentation.anchor === "body" || e.presentation.anchor === "act" ? "source" : e.presentation.anchor;
  anchor = $("sel-anchor").value;
  renderMeta(e);
  try {
    pages.combined = await loadPages(e, "combined");
    if (gen !== selGen) return;
    pages.light = await loadPages(e, "light");
    if (gen !== selGen) return;
    if (e.export.act) pages.act = await loadPages(e, "act");
    if (gen !== selGen) return;
  } catch (err) {
    if (gen !== selGen) return;
    $("stage-hint").textContent = "failed to load atlas: " + err.message;
    return;
  }
  $("stage-hint").style.display = "none";
  $("scrub").max = frameCount() - 1;
  buildThumbs();
  buildNav($("search").value);
}
function activePages() { return actMode && pages.act.length ? pages.act : pages.combined; }
function frameCount() { return actMode && pages.act.length ? current.export.act.frames : current.export.frames; }
function frameSize() { return actMode && pages.act.length ? current.export.act.frameSize : current.export.frameSize; }
function fpsOf() { return actMode && pages.act.length ? current.export.act.fps : current.export.fps; }
function isLoop() { return current.meta.loop; }
function frameIndex() {
  const n = frameCount(), fps = fpsOf();
  if (isLoop()) return Math.floor(animT * fps) % n;
  return Math.min(n - 1, Math.floor(animT * fps));
}
function frameImage(f) {
  for (const p of activePages()) if (f >= p.first && f < p.first + p.count) {
    const [fw, fh] = frameSize();
    return { img: p.img, x: (f - p.first) % p.columns * fw, y: Math.floor((f - p.first) / p.columns) * fh, w: fw, h: fh };
  }
  return null;
}
function lightFrameImage(f) {
  for (const p of pages.light) if (f >= p.first && f < p.first + p.count) {
    const [fw, fh] = frameSize();
    return { img: p.img, x: (f - p.first) % p.columns * fw, y: Math.floor((f - p.first) / p.columns) * fh, w: fw, h: fh };
  }
  return null;
}

// ---------- transport ----------
$("btn-play").onclick = () => { playing = !playing; $("btn-play").textContent = playing ? "⏸" : "▶"; };
$("btn-restart").onclick = () => { animT = 0; };
$("scrub").oninput = () => { animT = Number($("scrub").value) / fpsOf(); playing = false; $("btn-play").textContent = "▶"; };
$("btn-night").onclick = () => { night = !night; $("btn-night").textContent = night ? "☾ night" : "☀ day"; $("btn-night").classList.toggle("on", !night); };
$("sel-anchor").onchange = () => { anchor = $("sel-anchor").value; };
$("rng-scale").oninput = () => { scale = Number($("rng-scale").value); userScale = true; $("scale-val").textContent = scale.toFixed(2) + "×"; };
$("mode-scene").onchange = () => { sceneMode = $("mode-scene").checked; };
$("mode-light").onchange = () => { lightMode = $("mode-light").checked; };
$("mode-act").onchange = () => { actMode = $("mode-act").checked; animT = 0; $("scrub").max = frameCount() - 1; buildThumbs(); };
$("mode-demo").onchange = () => { demoMode = $("mode-demo").checked; if (demoMode) startDemo(); };

// ---------- SOH test scene (real game assets, cached per size/night) ----------
async function loadSohAssets() {
  if (sohAssets) return sohAssets;
  const load = async (src) => { const img = new Image(); img.src = src; await img.decode(); return img; };
  sohAssets = {
    stone: await load(SOH + "environment/ocean_cainos/ocean_tileset_stone_ground.png"),
    grass: await load(SOH + "environment/ocean_cainos/ocean_tileset_grass.png"),
    knight: await load(SOH + "characters/knight/_Idle.png"),
  };
  return sohAssets;
}
const TILE = 32; // stone tiles drawn at 2x native 16px for readability
function renderScene(W, H, isNight) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const groundY = Math.floor(H * 0.66);
  // sky
  const sky = g.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, "#6ea3d8"); sky.addColorStop(1, "#cfe0ee");
  g.fillStyle = sky; g.fillRect(0, 0, W, groundY);
  // grass horizon strip (top row of the grass tileset), then stone ground tiled
  for (let x = 0; x < W; x += TILE) g.drawImage(sohAssets.grass, 0, 0, 16, 16, x, groundY - TILE, TILE, TILE);
  for (let y = groundY; y < H; y += TILE)
    for (let x = 0; x < W; x += TILE)
      g.drawImage(sohAssets.stone, 16, 16, 16, 16, x, y, TILE, TILE); // interior stone tile
  // darker edge line at the ground contact
  g.fillStyle = "rgba(20,16,28,0.55)"; g.fillRect(0, groundY, W, 2);
  // two knight idle actors as depth references, feet on the ground line
  const kf = 80, ks = 2;
  const drawKnight = (fx) => g.drawImage(sohAssets.knight, 0, 0, kf, kf, fx, groundY - kf * ks + 14 * ks, kf * ks, kf * ks);
  drawKnight(Math.floor(W * 0.14));
  drawKnight(Math.floor(W * 0.80));
  if (isNight) { // night overlay dims the WORLD only; FX is composited after it
    g.fillStyle = "rgba(10,12,44,0.58)";
    g.fillRect(0, 0, W, H);
  }
  return { canvas: c, groundY };
}
async function ensureScene(W, H) {
  if (!sceneMode || !sohAssets) return null;
  if (!sceneDay || sceneDay.canvas.width !== W || sceneDay.canvas.height !== H) {
    sceneDay = renderScene(W, H, false);
    sceneNight = renderScene(W, H, true);
  }
  return night ? sceneNight : sceneDay;
}

// ---------- placement: pivot vs focal point vs contact ----------
function effectPlacement(cx, cy, groundY) {
  const [fw, fh] = frameSize();
  const pivot = actMode && pages.act.length ? current.export.act.pivot : current.export.pivot;
  if (anchor === "screen") return null;
  if (anchor === "ground") {
    // contact point = bottom of the SOLID core (faint debris/glow excluded), sunk into the ground by a
    // fraction of the core height so the artwork reads as resting on the battlefield, not hovering on the line
    const core = current.export.coreBounds || current.export.visualBounds || [0, 0, fw - 1, fh - 1];
    const focal = current.export.focalPoint || [(core[0] + core[2]) / 2, (core[1] + core[3]) / 2];
    const sink = Math.max(3, Math.round(0.08 * (core[3] - core[1])));
    return { x: cx - focal[0] * scale, y: groundY - (core[3] + 1 - sink) * scale };
  }
  if (anchor === "air") return { x: cx - pivot[0] * scale, y: groundY - fh * 0.42 - pivot[1] * scale };
  return { x: cx - pivot[0] * scale, y: cy - pivot[1] * scale };
}
function drawEffect(f, cx, cy, groundY) {
  const fi = frameImage(f);
  if (!fi) return;
  const [fw, fh] = frameSize();
  ctx.imageSmoothingEnabled = false;
  if (anchor === "screen") {
    const s = Math.min(view.width / fw, view.height / fh) * 0.98;
    ctx.drawImage(fi.img, fi.x, fi.y, fw, fh, (view.width - fw * s) / 2, (view.height - fh * s) / 2, fw * s, fh * s);
    return;
  }
  const pl = effectPlacement(cx, cy, groundY);
  ctx.drawImage(fi.img, fi.x, fi.y, fw, fh, pl.x, pl.y, fw * scale, fh * scale);
  if (!lightMode && night && sceneMode && current.export.lightEnergy > 0.5) {
    const li = lightFrameImage(f);
    if (li) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, 0.52 * 0.58 + 0.25);
      ctx.drawImage(li.img, li.x, li.y, li.w, li.h, pl.x, pl.y, fw * scale, fh * scale);
      ctx.restore();
    }
  }
}

// ---------- localized warp (black hole): samples the SCENE canvas (pre-FX) ----------
const WARP_R = 72, WARP_CELLS = 8, WARP_S = 2;
function warpGeom(pl) {
  return { fxCx: pl.x + frameSize()[0] * scale / 2, fxCy: pl.y + frameSize()[1] * scale / 2, size: WARP_R * 2 };
}
function captureWarp(pl, scene) {
  if (!sceneMode || current.presentation.sceneInteraction !== "warp" || anchor === "screen" || !pl || !scene) return;
  const now = performance.now();
  if (now - warpAt <= 1000 / 15 && warpCache?.off) return;
  warpAt = now;
  const { fxCx, fxCy, size } = warpGeom(pl);
  const off = warpCache?.off || (warpCache = { off: document.createElement("canvas") }).off;
  off.width = size / WARP_S; off.height = size / WARP_S;
  const octx = off.getContext("2d");
  octx.drawImage(scene.canvas, fxCx - WARP_R, fxCy - WARP_R, size, size, 0, 0, size / WARP_S, size / WARP_S);
  warpCache.off = off;
}
function applyWarp(f, pl) {
  if (!warpCache?.off || !pl || current.presentation.sceneInteraction !== "warp") return;
  const { fxCx, fxCy } = warpGeom(pl);
  const off = warpCache.off, t = f / fpsOf();
  const n = WARP_CELLS, cw = off.width / n, chh = off.height / n;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
    const px = gx * cw + cw / 2, py = gy * chh + chh / 2;
    const d = Math.hypot(px - off.width / 2, py - off.height / 2) / (off.width / 2);
    const pull = Math.sin(t * 6 + d * 9) * 0.07 * (1 - d);
    const ox = (px - off.width / 2) * pull, oy = (py - off.height / 2) * pull;
    ctx.drawImage(off, gx * cw, gy * chh, cw, chh,
      fxCx - WARP_R + gx * cw * WARP_S + ox * WARP_S, fxCy - WARP_R + gy * chh * WARP_S + oy * WARP_S, cw * WARP_S, chh * WARP_S);
  }
  ctx.restore();
}

// ---------- combat demo: 3 registered effects at once ----------
const DEMO_IDS = ["ice/ice-lance", "arcane/arcane-orb", "shadow/black-hole"];
let demo = null;
async function startDemo() {
  demo = null;
  const entries = DEMO_IDS.map((id) => index.effects.find((e) => e.id === id));
  const loaded = [];
  for (const e of entries) loaded.push({ e, pages: await loadPages(e, "combined"), light: await loadPages(e, "light"), t: Math.random() });
  demo = loaded;
}
function drawDemo(now) {
  if (!demo) return;
  const W = view.width, H = view.height, groundY = Math.floor(H * 0.66);
  demo.forEach((d, i) => {
    const n = d.e.export.frames, fps = d.e.export.fps;
    const f = Math.floor((animT + i * 0.7) * fps) % n;
    const [fw, fh] = d.e.export.frameSize;
    let pl;
    if (d.e.id === "shadow/black-hole") {
      const core = d.e.export.coreBounds, focal = d.e.export.focalPoint;
      pl = { x: W * (0.68) - focal[0] * scale, y: groundY - (core[3] + 3) * scale };
    } else if (d.e.id === "arcane/arcane-orb") {
      pl = { x: W * 0.38 - d.e.export.pivot[0] * scale, y: groundY - fh * 0.45 - d.e.export.pivot[1] * scale };
    } else {
      pl = { x: W * 0.12 - d.e.export.pivot[0] * scale, y: groundY - fh * 0.55 - d.e.export.pivot[1] * scale };
    }
    const p = d.pages.find((pg) => f >= pg.first && f < pg.first + pg.count);
    if (!p) return;
    const fi = { img: p.img, x: (f - p.first) % p.columns * fw, y: Math.floor((f - p.first) / p.columns) * fh, w: fw, h: fh };
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fi.img, fi.x, fi.y, fw, fh, pl.x, pl.y, fw * scale, fh * scale);
    if (night && d.e.export.lightEnergy > 0.5) {
      const lp = d.light.find((pg) => f >= pg.first && f < pg.first + pg.count);
      if (lp) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5; ctx.drawImage(lp.img, fi.x, fi.y, fw, fh, pl.x, pl.y, fw * scale, fh * scale); ctx.restore(); }
    }
  });
}

// ---------- main loop ----------
async function tick(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  if (current && playing) {
    animT += dt;
    const n = frameCount();
    if (!demoMode && !isLoop() && animT * fpsOf() >= n) { animT = (n - 1) / fpsOf(); playing = false; $("btn-play").textContent = "▶"; }
  }
  if (current) {
    const frame = frameIndex();
    $("scrub").value = frame;
    $("frame-label").textContent = `${frame}/${frameCount() - 1} · ${fpsOf()}fps`;
    const cw = view.clientWidth, ch = view.clientHeight, dpr = devicePixelRatio;
    if (cw !== lastW || ch !== lastH || dpr !== lastDpr) {
      lastW = cw; lastH = ch; lastDpr = dpr;
      view.width = Math.max(1, Math.floor(cw * dpr));
      view.height = Math.max(1, Math.floor(ch * dpr));
      sceneDay = sceneNight = null; // scene caches are per-size
    }
    const W = view.width, H = view.height;
    ctx.imageSmoothingEnabled = false;
    const groundY = Math.floor(H * 0.66);
    if (demoMode) {
      await loadSohAssets();
      const scene = await ensureScene(W, H);
      if (scene) ctx.drawImage(scene.canvas, 0, 0); else { ctx.fillStyle = "#0b0a12"; ctx.fillRect(0, 0, W, H); }
      if (!userScale && sceneMode) { scale = Math.max(0.5, Math.min(4, (H * 0.42) / frameSize()[1])); $("rng-scale").value = scale; $("scale-val").textContent = scale.toFixed(2) + "×"; }
      drawDemo(now);
    } else if (sceneMode) {
      await loadSohAssets();
      const scene = await ensureScene(W, H);
      if (scene) {
        ctx.drawImage(scene.canvas, 0, 0); // one cached blit instead of repainting the world every frame
        if (!userScale) { scale = Math.max(0.5, Math.min(4, (H * 0.42) / frameSize()[1])); $("rng-scale").value = scale; $("scale-val").textContent = scale.toFixed(2) + "×"; }
      } else { ctx.fillStyle = night ? "#0a0918" : "#0b0a12"; ctx.fillRect(0, 0, W, H); }
      if (lightMode) {
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        const fi = lightFrameImage(frame);
        if (fi) { const s = Math.min(W / fi.w, H / fi.h) * 0.9 * scale; ctx.drawImage(fi.img, fi.x, fi.y, fi.w, fi.h, (W - fi.w * s) / 2, (H - fi.h * s) / 2, fi.w * s, fi.h * s); }
      } else {
        const pl = anchor === "screen" ? null : effectPlacement(W / 2, H / 2, groundY);
        captureWarp(pl, night ? sceneNight : sceneDay);
        applyWarp(frame, pl);
        drawEffect(frame, W / 2, H / 2, groundY);
      }
    } else {
      ctx.fillStyle = night ? "#0a0918" : "#0b0a12"; ctx.fillRect(0, 0, W, H);
      if (lightMode) {
        const fi = lightFrameImage(frame);
        if (fi) { const s = Math.min(W / fi.w, H / fi.h) * 0.9 * scale; ctx.drawImage(fi.img, fi.x, fi.y, fi.w, fi.h, (W - fi.w * s) / 2, (H - fi.h * s) / 2, fi.w * s, fi.h * s); }
      } else drawEffect(frame, W / 2, H / 2, groundY);
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function buildThumbs() {
  const box = $("thumbs");
  box.innerHTML = "";
  if (!current) return;
  const n = frameCount();
  const picks = n <= 12 ? [...Array(n).keys()] : Array.from({ length: 12 }, (_, i) => Math.round(i * (n - 1) / 11));
  for (const f of picks) {
    const fi = frameImage(f);
    if (!fi) continue;
    const c = document.createElement("canvas");
    c.width = fi.w; c.height = fi.h;
    c.getContext("2d").drawImage(fi.img, fi.x, fi.y, fi.w, fi.h, 0, 0, fi.w, fi.h);
    c.onclick = () => { animT = f / fpsOf(); $("scrub").value = f; playing = false; $("btn-play").textContent = "▶"; };
    box.appendChild(c);
  }
}

// ---------- metadata ----------
function renderMeta(e) {
  const p = e.presentation, m = e.meta, badge = (v) => {
    const cls = v === "PARITY_PASS" ? "pass" : v === "FAILED" || v === "PARITY_FAIL" ? "fail" : v === "DISCOVERED" ? "disc" : "pend";
    return `<span class="badge ${cls}">${v}</span>`;
  };
  $("meta-body").innerHTML = `
    <div class="row"><div class="k">id</div><div class="v">${e.id}</div></div>
    <div class="row"><div class="k">name</div><div class="v">${e.name}</div></div>
    <div class="row"><div class="k">description</div><div class="v">${e.desc || "—"}</div></div>
    <div class="row"><div class="k">tags</div><div class="v">${e.tags.map((t) => `<span class="tag">${t}</span>`).join("") || "—"}</div></div>
    <div class="row"><div class="k">implementation</div><div class="v">${e.implementation}${e.hasAct ? " · act" : ""}${e.onBody ? " · on-body" : ""}${e.screen ? " · screen" : ""}</div></div>
    <div class="row"><div class="k">animation</div><div class="v">${e.export.frames || "?"} frames @ ${m.fps}fps · ${m.duration}s · ${m.loop ? "loop" : "one-shot"} · ${m.size[0]}×${m.size[1]}</div></div>
    <div class="row"><div class="k">placement (source-derived)</div><div class="v">pivot ${m.origin} · focal ${e.export.focalPoint || "?"} · core ${e.export.coreBounds || "?"} · visual ${e.export.visualBounds || "?"}</div></div>
    <div class="row"><div class="k">proposed presentation (not accepted)</div><div class="v">role: ${p.roleCandidate} · anchor: ${p.anchor} · depth: ${p.depth} · night: ${p.emissiveNight} · interaction: ${p.sceneInteraction} · <b>extraShapes: ${p.extraShapes}</b></div></div>
    ${e.act ? `<div class="row"><div class="k">act timing</div><pre>${JSON.stringify({ windup: e.act.windup, recovery: e.act.recovery, onBody: e.act.onBody, targets: e.act.targets, hits: e.act.hits }, null, 1)}</pre></div>` : ""}
    <div class="row"><div class="k">provenance</div><div class="v">${e.provenance.repo}<br>commit <code>${e.provenance.commit.slice(0, 12)}</code><br>${e.provenance.license}</div></div>
    <div class="row"><div class="k">export status</div><div class="v">${badge(e.export.state)} ${badge(e.qa.parity)} visual: ${badge(e.qa.visual)} soh-ready: ${e.qa.sohReady ? "yes" : "no"}</div></div>
    <div class="row"><div class="k">files (${e.export.files?.length || 0})</div><div class="v" style="font-size:10px">${(e.export.files || []).map((f) => `${f.path} <span style="color:var(--dim)">${(f.bytes / 1024).toFixed(0)}KB ${f.sha256.slice(0, 8)}</span>`).join("<br>") || "—"}</div></div>
    ${e.qa.exceptions?.length ? `<div class="row"><div class="k">exceptions</div><div class="v" style="color:var(--warn)">${e.qa.exceptions.join("; ")}</div></div>` : ""}
  `;
}

loadIndex().then(() => {
  const first = index.effects.find((e) => e.export.state === "PARITY_PASS") || index.effects[0];
  if (first) select(first);
}).catch((e) => { $("status-line").textContent = "registry load failed: " + e.message; });

// test hook (used by tools/pixelfx_foundry/browser/verify.mjs; harmless in production)
window.__foundry = {
  selectById: (id) => { const e = index?.effects.find((x) => x.id === id); if (e) return select(e); return Promise.resolve(false); },
  state: () => ({ id: current?.id, frame: current ? frameIndex() : -1, playing, night, anchor, animT, hint: $("stage-hint").textContent, title: $("fx-title").textContent, demoMode, scale }),
  setNight: (v) => { if (night !== v) $("btn-night").click(); },
  setAnchor: (v) => { $("sel-anchor").value = v; anchor = v; },
  setAct: (v) => { if (actMode !== v) $("mode-act").click(); },
  setDemo: (v) => { if (demoMode !== v) $("mode-demo").click(); },
  setScene: (v) => { if (sceneMode !== v) $("mode-scene").click(); },
  setScale: (v) => { userScale = true; scale = v; $("rng-scale").value = v; $("scale-val").textContent = v.toFixed(2) + "×"; },
  play: (v) => { if (playing !== v) $("btn-play").click(); },
  scrubTo: (f) => { $("scrub").value = f; $("scrub").dispatchEvent(new Event("input")); },
  // deterministic frame capture for the evidence harness: set exact frame, render one tick, return canvas data
  captureFrame: (f) => new Promise((res) => { animT = f / fpsOf(); playing = false; requestAnimationFrame(() => requestAnimationFrame(() => res(view.toDataURL("image/png")))); }),
  index: () => index,
};
