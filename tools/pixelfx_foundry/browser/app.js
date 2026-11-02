// SOH × PixelFX — FX Foundry Browser. Lazy-loads the registry and per-effect atlas pages produced by
// tools/pixelfx_foundry/intake.mjs. Presentation rules: original source frames only, extraShapes=false,
// effect composited AFTER the night overlay with bounded emission boost (light channel, never double-added
// to the combined frame which already contains it). Ground anchoring uses the artwork's visual bounds
// (bottom edge = contact point), distinct from the source pivot.
const qs = new URLSearchParams(location.search);
const ROOT = qs.get("root") || "../../../assets/pixelfx_foundry/";
const $ = (id) => document.getElementById(id);
const view = $("view"), ctx = view.getContext("2d");

let index = null, current = null, pages = { combined: [], light: [], act: [] };
let playing = true, animT = 0, lastT = 0, night = false, sceneMode = true, lightMode = false, actMode = false;
let anchor = "source", scale = 1;
let selGen = 0; // selection generation: async loads from a previous selection are discarded
let warpCache = null, warpAt = 0;
let lastW = 0, lastH = 0, lastDpr = 0;

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
  const gen = ++selGen; // any in-flight selection before this one is now stale
  current = e;
  animT = 0;
  pages = { combined: [], light: [], act: [] };
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
    if (gen !== selGen) return; // user switched away while loading
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
// float animation time -> integer frame index (kept separate so 30 fps anims step correctly on 60 Hz displays)
function frameIndex() {
  const n = frameCount(), fps = fpsOf();
  if (isLoop()) return Math.floor(animT * fps) % n;
  return Math.min(n - 1, Math.floor(animT * fps)); // one-shot ends on the last frame
}
function frameImage(f) {
  const ps = activePages();
  for (const p of ps) if (f >= p.first && f < p.first + p.count) {
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
$("rng-scale").oninput = () => { scale = Number($("rng-scale").value); $("scale-val").textContent = scale.toFixed(2) + "×"; };
$("mode-scene").onchange = () => { sceneMode = $("mode-scene").checked; };
$("mode-light").onchange = () => { lightMode = $("mode-light").checked; };
$("mode-act").onchange = () => { actMode = $("mode-act").checked; animT = 0; $("scrub").max = frameCount() - 1; buildThumbs(); };

// ---------- scene ----------
function drawScene(W, H, groundY) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (night) { g.addColorStop(0, "#070a1c"); g.addColorStop(0.7, "#0d1230"); g.addColorStop(1, "#141031"); }
  else { g.addColorStop(0, "#7fb2e0"); g.addColorStop(0.7, "#a8c8e8"); g.addColorStop(1, "#c8b89a"); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = night ? "#191531" : "#6b5a48";
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = night ? "#242045" : "#7d6a54";
  ctx.fillRect(0, groundY, W, 2);
  ctx.strokeStyle = night ? "#100d24" : "#54463a"; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, groundY + 2); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = groundY + 26; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  if (night) { ctx.fillStyle = "rgba(8,10,40,0.55)"; ctx.fillRect(0, 0, W, H); } // dims the WORLD only
}
// where the effect frame goes for the active anchor. Distinct notions: source pivot, visual center,
// ground contact (bottom edge of the artwork's visual bounds).
function effectPlacement(cx, cy, groundY) {
  const [fw, fh] = frameSize();
  const pivot = actMode && pages.act.length ? current.export.act.pivot : current.export.pivot;
  const vb = current.export.visualBounds || [0, 0, fw - 1, fh - 1];
  if (anchor === "screen") return null; // handled by caller (fit whole frame)
  if (anchor === "ground") {
    const cxv = (vb[0] + vb[2]) / 2, bottom = vb[3] + 1;
    return { x: cx - cxv * scale, y: groundY - bottom * scale };
  }
  if (anchor === "air") return { x: cx - pivot[0] * scale, y: groundY - fh * 0.45 - pivot[1] * scale };
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
    if (li) { // bounded night emission boost, additive, after the night overlay
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, 0.52 * 0.55 + 0.25);
      ctx.drawImage(li.img, li.x, li.y, li.w, li.h, pl.x, pl.y, fw * scale, fh * scale);
      ctx.restore();
    }
  }
}
// localized cached scene warp (e.g. shadow/black-hole). captureWarp() samples the scene BEFORE FX artwork
// is drawn (call it before drawEffect), so original effect pixels stay intact; applyWarp() displaces the
// cached scene-only region. ~68px radius, refreshed at ~15 Hz, capped cells.
const WARP_R = 68, WARP_CELLS = 8, WARP_S = 2;
function warpGeom(pl) {
  const fxCx = pl.x + frameSize()[0] * scale / 2, fxCy = pl.y + frameSize()[1] * scale / 2;
  return { fxCx, fxCy, size: WARP_R * 2 };
}
function captureWarp(pl) {
  if (!sceneMode || current.presentation.sceneInteraction !== "warp" || anchor === "screen" || !pl) return;
  const now = performance.now();
  if (now - warpAt <= 1000 / 15 && warpCache?.off) return; // reuse cached scene sample between refreshes
  warpAt = now;
  const { fxCx, fxCy, size } = warpGeom(pl);
  const off = warpCache?.off || (warpCache = { off: document.createElement("canvas") }).off;
  off.width = size / WARP_S; off.height = size / WARP_S;
  const octx = off.getContext("2d");
  octx.drawImage(view, fxCx - WARP_R, fxCy - WARP_R, size, size, 0, 0, size / WARP_S, size / WARP_S); // scene only — FX not drawn yet
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
    const pull = Math.sin(t * 6 + d * 9) * 0.06 * (1 - d);
    const ox = (px - off.width / 2) * pull, oy = (py - off.height / 2) * pull;
    ctx.drawImage(off, gx * cw, gy * chh, cw, chh,
      fxCx - WARP_R + gx * cw * WARP_S + ox * WARP_S, fxCy - WARP_R + gy * chh * WARP_S + oy * WARP_S, cw * WARP_S, chh * WARP_S);
  }
  ctx.restore();
}

// ---------- main loop ----------
function tick(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  if (current && playing) {
    animT += dt; // float time accumulates; frame index is derived, never floored back into animT
    const n = frameCount();
    if (!isLoop() && animT * fpsOf() >= n) { animT = (n - 1) / fpsOf(); playing = false; $("btn-play").textContent = "▶"; } // one-shot ends on last frame
  }
  if (current) {
    const frame = frameIndex();
    $("scrub").value = frame;
    $("frame-label").textContent = `${frame}/${frameCount() - 1} · ${fpsOf()}fps`;
    // resize backing store only when the display size actually changes
    const cw = view.clientWidth, ch = view.clientHeight, dpr = devicePixelRatio;
    if (cw !== lastW || ch !== lastH || dpr !== lastDpr) {
      lastW = cw; lastH = ch; lastDpr = dpr;
      view.width = Math.max(1, Math.floor(cw * dpr));
      view.height = Math.max(1, Math.floor(ch * dpr));
    }
    const W = view.width, H = view.height;
    ctx.imageSmoothingEnabled = false;
    const groundY = Math.floor(H * 0.72);
    if (sceneMode) drawScene(W, H, groundY);
    else { ctx.fillStyle = night ? "#0a0918" : "#0b0a12"; ctx.fillRect(0, 0, W, H); }
    if (lightMode) {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      const fi = lightFrameImage(frame);
      if (fi) { const s = Math.min(W / fi.w, H / fi.h) * 0.9 * scale; ctx.drawImage(fi.img, fi.x, fi.y, fi.w, fi.h, (W - fi.w * s) / 2, (H - fi.h * s) / 2, fi.w * s, fi.h * s); }
    } else {
      const pl = anchor === "screen" ? null : effectPlacement(W / 2, H / 2, groundY);
      captureWarp(pl);   // sample scene region BEFORE any FX artwork is drawn
      applyWarp(frame, pl); // distort the cached scene-only environment
      drawEffect(frame, W / 2, H / 2, groundY); // original FX pixels composited on top, intact
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
    <div class="row"><div class="k">animation</div><div class="v">${e.export.frames || "?"} frames @ ${m.fps}fps · ${m.duration}s · ${m.loop ? "loop" : "one-shot"} · ${m.size[0]}×${m.size[1]} · pivot ${m.origin} · visual bounds ${e.export.visualBounds || "?"}</div></div>
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

// test hook (used by tools/pixelfx_foundry/browser verification harness; harmless in production)
window.__foundry = {
  selectById: (id) => { const e = index?.effects.find((x) => x.id === id); if (e) return select(e); return Promise.resolve(false); },
  state: () => ({ id: current?.id, frame: current ? frameIndex() : -1, playing, night, anchor, animT, hint: $("stage-hint").textContent, title: $("fx-title").textContent }),
  setNight: (v) => { if (night !== v) $("btn-night").click(); },
  setAnchor: (v) => { $("sel-anchor").value = v; anchor = v; },
  setAct: (v) => { if (actMode !== v) $("mode-act").click(); },
  play: (v) => { if (playing !== v) $("btn-play").click(); },
  scrubTo: (f) => { $("scrub").value = f; $("scrub").dispatchEvent(new Event("input")); },
  index: () => index,
};
