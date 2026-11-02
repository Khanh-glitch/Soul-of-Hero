// SOH × PixelFX — FX Foundry Browser. Lazy-loads the registry and per-effect atlas pages produced by
// tools/pixelfx_foundry/intake.mjs. Presentation rules: original source frames only, extraShapes=false,
// effect composited AFTER the night overlay with bounded emission boost (light channel, never double-added
// to the combined frame which already contains it).
const qs = new URLSearchParams(location.search);
const ROOT = qs.get("root") || "../../../assets/pixelfx_foundry/";
const $ = (id) => document.getElementById(id);
const view = $("view"), ctx = view.getContext("2d");

let index = null, current = null, pages = { combined: [], light: [], act: [] };
let playing = true, frame = 0, lastT = 0, night = false, sceneMode = true, lightMode = false, actMode = false;
let anchor = "source", scale = 1;
let warpCache = null, warpAt = 0;

// ---------- registry ----------
async function loadIndex() {
  const res = await fetch(ROOT + "index.json");
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
  current = e;
  frame = 0;
  pages = { combined: [], light: [], act: [] };
  document.querySelectorAll(".fx").forEach((n) => n.classList.remove("active"));
  $("fx-title").textContent = `${e.id} — ${e.name}`;
  $("stage-hint").style.display = "none";
  $("mode-act").style.display = e.export.act ? "" : "none";
  $("sel-anchor").value = e.presentation.anchor === "screen" ? "screen" : e.presentation.anchor === "body" || e.presentation.anchor === "act" ? "source" : e.presentation.anchor;
  anchor = $("sel-anchor").value;
  renderMeta(e);
  pages.combined = await loadPages(e, "combined");
  pages.light = await loadPages(e, "light");
  if (e.export.act) pages.act = await loadPages(e, "act");
  const total = actMode && pages.act.length ? e.export.act.frames : e.export.frames;
  $("scrub").max = total - 1;
  buildThumbs();
  buildNav($("search").value);
}
function activePages() { return actMode && pages.act.length ? pages.act : pages.combined; }
function frameCount() { return actMode && pages.act.length ? current.export.act.frames : current.export.frames; }
function frameSize() { return actMode && pages.act.length ? current.export.act.frameSize : current.export.frameSize; }
function fpsOf() { return actMode && pages.act.length ? current.export.act.fps : current.export.fps; }

function frameImage(f) {
  const ps = activePages();
  for (const p of ps) if (f >= p.first && f < p.first + p.count) {
    const [fw, fh] = frameSize();
    return { img: p.img, x: (f - p.first) % p.columns * fw, y: Math.floor((f - p.first) / p.columns) * fh, w: fw, h: fh };
  }
  return null;
}

// ---------- transport ----------
$("btn-play").onclick = () => { playing = !playing; $("btn-play").textContent = playing ? "⏸" : "▶"; };
$("btn-restart").onclick = () => { frame = 0; };
$("scrub").oninput = () => { frame = Number($("scrub").value); playing = false; $("btn-play").textContent = "▶"; };
$("btn-night").onclick = () => { night = !night; $("btn-night").textContent = night ? "☾ night" : "☀ day"; $("btn-night").classList.toggle("on", !night); };
$("sel-anchor").onchange = () => { anchor = $("sel-anchor").value; };
$("rng-scale").oninput = () => { scale = Number($("rng-scale").value); $("scale-val").textContent = scale.toFixed(2) + "×"; };
$("mode-scene").onchange = () => { sceneMode = $("mode-scene").checked; };
$("mode-light").onchange = () => { lightMode = $("mode-light").checked; };
$("mode-act").onchange = () => { actMode = $("mode-act").checked; frame = 0; $("scrub").max = frameCount() - 1; buildThumbs(); };

// ---------- scene ----------
function drawScene(W, H, groundY) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (night) { g.addColorStop(0, "#070a1c"); g.addColorStop(0.7, "#0d1230"); g.addColorStop(1, "#141031"); }
  else { g.addColorStop(0, "#7fb2e0"); g.addColorStop(0.7, "#a8c8e8"); g.addColorStop(1, "#c8b89a"); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // ground band with simple brick lines — abstract SOH battlefield stand-in, not game art
  ctx.fillStyle = night ? "#191531" : "#6b5a48";
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = night ? "#242045" : "#7d6a54";
  ctx.fillRect(0, groundY, W, 2);
  ctx.strokeStyle = night ? "#100d24" : "#54463a"; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, groundY + 2); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = groundY + 26; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  if (night) { // night overlay dims the WORLD only; effects are drawn after it
    ctx.fillStyle = "rgba(8,10,40,0.55)";
    ctx.fillRect(0, 0, W, H);
  }
}
// bounded emission boost: light channel drawn additively after the night overlay, factor 1+0.52*darkness capped
function drawEffect(f, cx, cy, groundY) {
  const fi = frameImage(f);
  if (!fi) return;
  const [fw, fh] = frameSize();
  const pivot = actMode && pages.act.length ? current.export.act.pivot : current.export.pivot;
  let dx, dy;
  if (anchor === "screen") {
    const s = Math.min(view.width / fw, view.height / fh) * 0.98;
    ctx.drawImage(fi.img, fi.x, fi.y, fw, fh, (view.width - fw * s) / 2, (view.height - fh * s) / 2, fw * s, fh * s);
    return;
  }
  if (anchor === "ground") { dx = cx - pivot[0] * scale; dy = groundY - pivot[1] * scale; } // source pivot lands on the ground line
  else if (anchor === "air") { dx = cx - pivot[0] * scale; dy = groundY - fh * 0.45 - pivot[1] * scale; }
  else { dx = cx - pivot[0] * scale; dy = cy - pivot[1] * scale; }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(fi.img, fi.x, fi.y, fw, fh, dx, dy, fw * scale, fh * scale);
  if (lightMode) return; // emission-map view replaces the composite
  if (night && sceneMode && current.export.lightEnergy > 0.5) {
    const li = lightFrameImage(f);
    if (li) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, 0.52 * 0.55 + 0.25); // bounded: 1+0.52*darkness on top of the light already in `combined`
      ctx.drawImage(li.img, li.x, li.y, li.w, li.h, dx, dy, fw * scale, fh * scale);
      ctx.restore();
    }
  }
  // localized cached scene warp for effects flagged warp (e.g. shadow/black-hole) — secondary interaction only
  if (sceneMode && current.presentation.sceneInteraction === "warp" && anchor !== "screen") {
    const now = performance.now();
    const R = 68, cells = 8;
    if (!warpCache || now - warpAt > 1000 / 15) {
      warpAt = now;
      const t = f / fpsOf();
      const off = warpCache?.off || (warpCache = { off: document.createElement("canvas") }).off;
      const S = 2, size = R * 2;
      off.width = size / S; off.height = size / S;
      const octx = off.getContext("2d");
      octx.imageSmoothingEnabled = true;
      const srcX = dx + fw * scale / 2 - R, srcY = dy + fh * scale / 2 - R;
      octx.drawImage(view, srcX, srcY, size, size, 0, 0, size / S, size / S);
      warpCache.data = octx.getImageData(0, 0, off.width, off.height);
      warpCache.t = t;
    }
    if (warpCache?.data) {
      const { off, data, t } = warpCache;
      const S = 2, size = R * 2, n = cells, cw = off.width / n, chh = off.height / n;
      ctx.save();
      for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
        const px = gx * cw + cw / 2, py = gy * chh + chh / 2;
        const d = Math.hypot(px - off.width / 2, py - off.height / 2) / (off.width / 2);
        const pull = Math.sin(t * 6 + d * 9) * 0.06 * (1 - d);
        const ox = (px - off.width / 2) * pull, oy = (py - off.height / 2) * pull;
        ctx.drawImage(off, gx * cw, gy * chh, cw, chh,
          dx + fw * scale / 2 - R + gx * cw * S + ox * S, dy + fh * scale / 2 - R + gy * chh * S + oy * S, cw * S, chh * S);
      }
      ctx.restore();
    }
  }
}
function lightFrameImage(f) {
  for (const p of pages.light) if (f >= p.first && f < p.first + p.count) {
    const [fw, fh] = frameSize();
    return { img: p.img, x: (f - p.first) % p.columns * fw, y: Math.floor((f - p.first) / p.columns) * fh, w: fw, h: fh };
  }
  return null;
}

// ---------- main loop ----------
function tick(now) {
  if (current && playing) {
    const fps = fpsOf();
    frame = (frame + Math.max(0, (now - lastT) / 1000) * fps) % frameCount();
    frame = Math.floor(frame);
    $("scrub").value = frame;
  }
  lastT = now;
  if (current) {
    const n = frameCount();
    $("frame-label").textContent = `${frame}/${n - 1} · ${fpsOf()}fps`;
    const W = view.width = view.clientWidth * devicePixelRatio;
    const H = view.height = view.clientHeight * devicePixelRatio;
    ctx.imageSmoothingEnabled = false;
    const groundY = Math.floor(H * 0.72);
    if (sceneMode) drawScene(W, H, groundY);
    else { ctx.fillStyle = night ? "#0a0918" : "#0b0a12"; ctx.fillRect(0, 0, W, H); }
    if (lightMode) {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      const fi = lightFrameImage(frame);
      if (fi) { const s = Math.min(W / fi.w, H / fi.h) * 0.9 * scale; ctx.drawImage(fi.img, fi.x, fi.y, fi.w, fi.h, (W - fi.w * s) / 2, (H - fi.h * s) / 2, fi.w * s, fi.h * s); }
    } else {
      drawEffect(Math.floor(frame), W / 2, H / 2, groundY);
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
    const c2 = c.getContext("2d");
    c2.drawImage(fi.img, fi.x, fi.y, fi.w, fi.h, 0, 0, fi.w, fi.h);
    c.onclick = () => { frame = f; $("scrub").value = f; playing = false; $("btn-play").textContent = "▶"; };
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
    <div class="row"><div class="k">animation</div><div class="v">${e.export.frames || "?"} frames @ ${m.fps}fps · ${m.duration}s · ${m.loop ? "loop" : "one-shot"} · ${m.size[0]}×${m.size[1]} · pivot ${m.origin}</div></div>
    <div class="row"><div class="k">proposed presentation (not accepted)</div><div class="v">role: ${p.roleCandidate} · anchor: ${p.anchor} · depth: ${p.depth} · night: ${p.emissiveNight} · interaction: ${p.sceneInteraction} · <b>extraShapes: ${p.extraShapes}</b></div></div>
    ${e.act ? `<div class="row"><div class="k">act timing</div><pre>${JSON.stringify({ windup: e.act.windup, recovery: e.act.recovery, onBody: e.act.onBody, targets: e.act.targets, hits: e.act.hits }, null, 1)}</pre></div>` : ""}
    <div class="row"><div class="k">provenance</div><div class="v">${e.provenance.repo}<br>commit <code>${e.provenance.commit.slice(0, 12)}</code><br>${e.provenance.license}</div></div>
    <div class="row"><div class="k">export status</div><div class="v">${badge(e.export.state)} ${badge(e.qa.parity)} visual: ${badge(e.qa.visual)} soh-ready: ${e.qa.sohReady ? "yes" : "no"}</div></div>
    <div class="row"><div class="k">files (${e.export.files?.length || 0})</div><div class="v" style="font-size:10px">${(e.export.files || []).map((f) => `${f.path} <span style="color:var(--dim)">${(f.bytes / 1024).toFixed(0)}KB ${f.sha256.slice(0, 8)}</span>`).join("<br>") || "—"}</div></div>
    ${e.qa.exceptions?.length ? `<div class="row"><div class="k">exceptions</div><div class="v" style="color:var(--warn)">${e.qa.exceptions.join("; ")}</div></div>` : ""}
  `;
}

loadIndex().then(() => {
  // open the first PARITY_PASS effect by default
  const first = index.effects.find((e) => e.export.state === "PARITY_PASS") || index.effects[0];
  if (first) select(first);
});
