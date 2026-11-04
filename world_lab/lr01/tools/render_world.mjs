#!/usr/bin/env node
// MAP-LR01 Milestone E — reproducible native 640x360 in-world region previews.
// BEFORE = flat GEO-01 raster diagnostic. AFTER = data-driven retained Web
// baseline visual language (hard-edged transitions, large ocean wave motifs,
// shore glints, authored roads, Map-owned POI/Elder landmarks). AFTER_UI adds a
// QA HUD overlay for readability inspection. NOT a playable scene.
// Static frames only: runtime animated shore glints stay in Web render.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadVeyra, loadGeoInputs, readJson, writeJson, sha256, r4, LAB, ROOT } from '../src/lib/veyra.mjs';
import { GW, GH, CELL, N, idx, centre, toCell } from '../src/lib/geo_compile.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.LR01_OUT ? path.resolve(process.env.LR01_OUT) : path.resolve(HERE, '../output');
const VDIR = path.join(OUT, 'views');
fs.mkdirSync(VDIR, { recursive: true });
const V = loadVeyra(), P = V.P, GEO = loadGeoInputs();
const ART = readJson(path.join(OUT, 'art_manifest.v1.json'));
const DL = readJson(path.join(OUT, 'poi_layouts.v1.json'));
const TR = readJson(path.join(OUT, 'transport.v1.json'));
const I = {};
for (const [k, v] of Object.entries(GEO.r1)) I[k] = v.data;
const PAL = ART.visualRules.palette;
const W = 640, H = 360;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Verified GEO-02 legend: 12 authoritative Editor biome codes.
const legend = Object.fromEntries(GEO.encoding.biomeLegend.map(x => [x.code, x]));
const BIOME_COLOR = {
  0: PAL.grass, 1: PAL.forest, 2: PAL.grassLight, 3: PAL.sand,
  4: PAL.marsh, 5: PAL.rock, 6: PAL.highland, 7: PAL.snow,
  8: PAL.sandLight, 9: PAL.marsh, 10: PAL.rock, 11: PAL.highland,
};
const DIAG_COLOR = {
  0: '#3a6b4a', 1: '#24543a', 2: '#4f8a5b', 3: '#c2a060', 4: '#4c7a6a', 5: '#6b7280',
  6: '#8b8b74', 7: '#d8e4e8', 8: '#d0b878', 9: '#5a8a7a', 10: '#7b8490', 11: '#9a9a84',
};
const biomeColor = (c, before) => (before ? DIAG_COLOR[c] : BIOME_COLOR[c]) || (before ? '#555' : PAL.grass);

function regionWindow(reg) {
  let bb = reg.geometry?.bboxAu || reg.geometry?.outer?.bboxAu || null;
  if (!bb) return null;
  const bw = bb[2] - bb[0], bh = bb[3] - bb[1];
  let wAu = Math.max(320, bw * 1.5, bh * 1.5 * 16 / 9);
  let hAu = wAu * 9 / 16;
  let cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
  cx = Math.max(wAu / 2, Math.min(2000 - wAu / 2, cx));
  cy = Math.max(hAu / 2, Math.min(1400 - hAu / 2, cy));
  return { x0: r4(cx - wAu / 2), y0: r4(cy - hAu / 2), wAu: r4(wAu), hAu: r4(hAu), pxPerAu: r4(W / wAu), cellPx: r4(W / wAu * CELL), bboxAu: bb.map(r4) };
}

const ringPts = (ring, T) => ring.map(p => `${T.X(p[0]).toFixed(1)},${T.Y(p[1]).toFixed(1)}`).join(' ');

function drawScene(mode, reg, win) {
  const before = mode === 'before';
  const T = {
    X: x => (x - win.x0) * win.pxPerAu,
    Y: y => (y - win.y0) * win.pxPerAu,
  };
  const o = [];
  const S = s => o.push(s);
  S(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">`);
  S(`<rect width="${W}" height="${H}" fill="${before ? '#101820' : PAL.seaDeep}"/>`);
  // ---- raster terrain (real GEO-01 layers) ----
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const i = idx(gx, gy), x = T.X(gx * CELL), y = T.Y(gy * CELL);
    const s = CELL * win.pxPerAu;
    if (x + s < 0 || x > W || y + s < 0 || y > H) continue;
    const wc = I.waterClass[i];
    let col;
    if (wc === 1) col = before ? '#2d5570' : PAL.seaMid;
    else if (wc === 2) col = before ? '#24506a' : PAL.lake;
    else if (wc === 3) col = before ? '#2f6a88' : PAL.river;
    else col = biomeColor(I.biomeCode[i], before);
    S(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="${col}"/>`);
    if (before) continue;
    // hard-edged 1px transition fringe from ACTUAL neighbouring biome codes (NOT random grass noise)
    const right = gx + 1 < GW ? idx(gx + 1, gy) : -1, down = gy + 1 < GH ? idx(gx, gy + 1) : -1;
    if (right >= 0 && !I.waterClass[i] && !I.waterClass[right] && I.biomeCode[right] !== I.biomeCode[i]) S(`<rect x="${(x + s - 1).toFixed(1)}" y="${y.toFixed(1)}" width="1" height="${s.toFixed(1)}" fill="#101c18" opacity="0.55"/>`);
    if (down >= 0 && !I.waterClass[i] && !I.waterClass[down] && I.biomeCode[down] !== I.biomeCode[i]) S(`<rect x="${x.toFixed(1)}" y="${(y + s - 1).toFixed(1)}" width="${s.toFixed(1)}" height="1" fill="#101c18" opacity="0.55"/>`);
    // LARGE sparse ocean wave motifs (deterministic, original Web baseline language).
    // Only drawn when the next three cells are also sea, so motifs stay in water.
    const seaRun = wc === 1 && gx + 3 < GW && [1, 2, 3].every(k => I.waterClass[idx(gx + k, gy)] === 1);
    if (seaRun && gy % 3 === 0 && gx % 7 === (gy / 3 * 2) % 7) {
      const wx = x - s * 0.05, wy = y + s * 0.5, span = s * 3.1;
      S(`<path d="M${wx.toFixed(1)} ${wy.toFixed(1)} q${(span * 0.25).toFixed(1)} ${(-s * 0.34).toFixed(1)} ${(span * 0.5).toFixed(1)} 0 q${(span * 0.25).toFixed(1)} ${(s * 0.34).toFixed(1)} ${(span * 0.5).toFixed(1)} 0" fill="none" stroke="${PAL.wave}" stroke-width="1.8" opacity="0.9"/>`);
      S(`<path d="M${(wx + span * 0.2).toFixed(1)} ${(wy + s * 0.3).toFixed(1)} q${(span * 0.15).toFixed(1)} ${(-s * 0.18).toFixed(1)} ${(span * 0.3).toFixed(1)} 0" fill="none" stroke="${PAL.seaLight}" stroke-width="1.1" opacity="0.7"/>`);
    }
    // shore glints (static frame of the runtime animated glints)
    if (wc !== 1 && I.coast[i] && ((gx * 5 + gy * 11) % 3 === 0)) {
      S(`<rect x="${(x + s * 0.35).toFixed(1)}" y="${(y + s * 0.28).toFixed(1)}" width="${Math.max(1, s * 0.3).toFixed(1)}" height="1" fill="${PAL.shoreGlint}" opacity="0.9"/>`);
      S(`<rect x="${(x + s * 0.5).toFixed(1)}" y="${(y + s * 0.62).toFixed(1)}" width="${Math.max(1, s * 0.2).toFixed(1)}" height="1" fill="${PAL.shoreGlint}" opacity="0.65"/>`);
    }
  }
  // ---- authored rivers / roads ----
  for (const r of P.rivers) {
    const pts = r.points.map(p => `${T.X(p[0]).toFixed(1)},${T.Y(p[1]).toFixed(1)}`).join(' ');
    S(`<polyline points="${pts}" fill="none" stroke="${before ? '#4a7f9a' : PAL.river}" stroke-width="${before ? 1 : 2}" opacity="${before ? 0.7 : 0.9}"/>`);
  }
  for (const r of P.roads) {
    if (!r.points || r.points.length < 2) continue;
    const pts = r.points.map(p => `${T.X(p[0]).toFixed(1)},${T.Y(p[1]).toFixed(1)}`).join(' ');
    const isCart = r.kind === 'cart', isFerry = r.kind === 'ferry';
    if (!before) S(`<polyline points="${pts}" fill="none" stroke="#1a1712" stroke-width="${isCart ? 4 : 2.6}" opacity="0.75"/>`);
    S(`<polyline points="${pts}" fill="none" stroke="${before ? '#8a8f94' : (isCart ? PAL.cartRoad : PAL.trailRoad)}" stroke-width="${before ? 0.8 : (isCart ? 2.2 : 1.3)}" ${isFerry ? 'stroke-dasharray="4,3"' : ''} opacity="0.95"/>`);
  }
  // ---- zone / Elder outlines ----
  if (reg.geometry?.ringAu) S(`<polygon points="${ringPts(reg.geometry.ringAu, T)}" fill="none" stroke="${before ? '#999' : PAL.zone}" stroke-width="1" stroke-dasharray="3,2" opacity="0.85"/>`);
  if (reg.geometry?.ringsAu) for (const ring of reg.geometry.ringsAu) S(`<polygon points="${ringPts(ring, T)}" fill="none" stroke="${before ? '#888' : '#e0c890'}" stroke-width="${before ? 0.7 : 1}" opacity="0.6"/>`);
  if (reg.geometry?.outerAu) {
    S(`<polygon points="${ringPts(reg.geometry.outerAu, T)}" fill="none" stroke="${before ? '#aaa' : PAL.elder}" stroke-width="1.6" stroke-dasharray="5,3" opacity="0.95"/>`);
    S(`<polygon points="${ringPts(reg.geometry.coreAu, T)}" fill="${before ? 'none' : PAL.elder}" fill-opacity="0.08" stroke="${PAL.elder}" stroke-width="1.2"/>`);
    for (const a of reg.geometry.arenasAu || []) S(`<polygon points="${ringPts(a, T)}" fill="none" stroke="${PAL.elder}" stroke-width="0.9" opacity="0.8"/>`);
  }
  // ---- bridges (display glyph ONLY; not collision geometry) ----
  for (const b of P.bridges) {
    const x = T.X(b.at[0]), y = T.Y(b.at[1]);
    if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
    S(`<rect x="${(x - 3).toFixed(1)}" y="${(y - 1.5).toFixed(1)}" width="6" height="3" fill="${before ? '#888' : '#e8dcc0'}" stroke="#1a1712" stroke-width="0.6" transform="rotate(${r4(b.ang * 180 / Math.PI)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
  }
  // ---- POI landmarks from Milestone D static footprints ----
  for (const l of DL.layouts) {
    const x = T.X(l.atAu[0]), y = T.Y(l.atAu[1]);
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
    const col = l.enclosureClass.startsWith('ENCLOSED') ? PAL.poiEnclosed : PAL.poiOpen;
    if (before) {
      S(`<rect x="${(x - 2).toFixed(1)}" y="${(y - 2).toFixed(1)}" width="4" height="4" fill="#d8d8d8" stroke="#333" stroke-width="0.5"/>`);
    } else {
      S(`<polygon points="${ringPts(l.canonical.footPolygonAu, T)}" fill="${col}" fill-opacity="0.42" stroke="#140c14" stroke-width="1.2"/>`);
      for (const room of l.rooms.slice(0, 2)) if (room.roof.covered) S(`<polygon points="${ringPts(room.polygonAu, T)}" fill="${col}" fill-opacity="0.55" stroke="#140c14" stroke-width="0.7"/>`);
      const ex = T.X(l.entrance.atAu[0]), ey = T.Y(l.entrance.atAu[1]);
      S(`<rect x="${(ex - 1.5).toFixed(1)}" y="${(ey - 1.5).toFixed(1)}" width="3" height="3" fill="${PAL.shoreGlint}" stroke="#140c14" stroke-width="0.5"/>`);
    }
  }
  // ---- captions (QA, not gameplay HUD) ----
  const label = {
    before: 'BEFORE · GEO-01 FLAT RASTER DIAGNOSTIC',
    after: 'AFTER · MAP-LR01 DATA-DRIVEN WEB BASELINE STYLE',
    after_ui: 'AFTER + QA UI OVERLAY · READABILITY CHECK',
  }[mode];
  S(`<rect x="0" y="0" width="${W}" height="16" fill="#080e18" opacity="0.88"/>`);
  S(`<text x="6" y="11.5" fill="#dbe8f2" font-family="monospace" font-size="9">${esc(label)} · ${esc(reg.id)} · ${win.pxPerAu}px/au · cell ${win.cellPx}px</text>`);
  if (mode === 'after_ui') {
    // Representative UI frame to check terrain/landmark readability beneath UI.
    S(`<rect x="4" y="22" width="118" height="50" fill="#100c18" fill-opacity="0.88" stroke="#6a5a7a" stroke-width="1"/>`);
    for (let k = 0; k < 4; k++) { S(`<rect x="9" y="${27 + k * 10}" width="90" height="4" fill="#2a2030"/>`); S(`<rect x="9" y="${27 + k * 10}" width="${[76, 62, 84, 70][k]}" height="4" fill="${['#e04848', '#e0a040', '#48a0e0', '#c0c0c0'][k]}"/>`); }
    S(`<text x="9" y="68" fill="#d8c8e0" font-family="monospace" font-size="8">SPAWN · LOCAL</text>`);
    S(`<rect x="${W - 126}" y="22" width="122" height="42" fill="#100c18" fill-opacity="0.88" stroke="#6a5a7a" stroke-width="1"/>`);
    S(`<text x="${W - 120}" y="34" fill="#e8e0d0" font-family="monospace" font-size="8">DAY 1/14  06:00</text>`);
    S(`<text x="${W - 120}" y="46" fill="#a8b8c8" font-family="monospace" font-size="8">RUN 00:00:00</text>`);
    S(`<text x="${W - 120}" y="58" fill="#e8c060" font-family="monospace" font-size="8">MAP QA · NO GAMEPLAY</text>`);
    S(`<rect x="${W / 2 - 92}" y="${H - 30}" width="184" height="24" fill="#100c18" fill-opacity="0.9" stroke="#6a5a7a" stroke-width="1"/>`);
    for (let k = 0; k < 8; k++) S(`<rect x="${W / 2 - 86 + k * 22}" y="${H - 26}" width="16" height="16" fill="#241c30" stroke="#6a5a7a" stroke-width="0.5"/>`);
    S(`<rect x="0" y="${H - 9}" width="${W}" height="9" fill="#080e18" opacity="0.75"/>`);
    S(`<text x="4" y="${H - 2}" fill="#9fb0c0" font-family="monospace" font-size="7">STATIC GEOGRAPHY QA — NOT PLAYABLE SURVIVAL ACCEPTANCE</text>`);
  }
  S(`</svg>`);
  return o.join('\n');
}

const require = createRequire(path.join(LAB, 'package.json'));
const puppeteer = require('puppeteer-core');
const rows = [];
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/tmp/chromium', headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib' },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files', '--font-render-hinting=none'],
  });
  const errors = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(String(e)));
    for (const spec of ART.regions) {
      const reg = readJson(path.join(OUT, '..', spec.file));
      const win = regionWindow(reg);
      if (!win) throw new Error(`no window for ${spec.id}`);
      for (const mode of ['before', 'after', 'after_ui']) {
        const svg = drawScene(mode, reg, win);
        const base = `${spec.id}_${mode}_640x360`;
        const svgPath = path.join(VDIR, `${base}.svg`);
        const htmlPath = path.join(VDIR, `${base}.html`);
        const pngPath = path.join(VDIR, `${base}.png`);
        fs.writeFileSync(svgPath, svg);
        fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#080e18}svg{display:block}</style></head><body>${svg}</body></html>`);
        await page.goto('file://' + htmlPath, { waitUntil: 'load', timeout: 30000 });
        await page.screenshot({ path: pngPath });
        const svgBuf = fs.readFileSync(svgPath), pngBuf = fs.readFileSync(pngPath);
        rows.push({
          regionId: spec.id, mode, reason: spec.reason,
          file: `output/views/${base}.png`, svg: `output/views/${base}.svg`,
          width: W, height: H, bytes: pngBuf.length,
          svgSha256: sha256(svgBuf), pngSha256: sha256(pngBuf),
          window: win, transform: { authoringAuPerPreviewPx: r4(1 / win.pxPerAu), previewPxPerAu: win.pxPerAu, sourceCellPx: win.cellPx, runtimeScaleStatus: 'UNDECIDED', note: 'MAP geography QA view, not a native gameplay camera. cellPx=16 at pxPerAu=2 preserves Web 16px tile scale without canonizing U.' },
          sourceIds: { canon: V.fingerprint.sha256.slice(0, 16), geo01: GEO.fingerprints.geography.sha256.slice(0, 16), poiLayouts: 'poi_layouts.v1.json' },
          status: mode === 'before' ? ART.viewModes.before : mode === 'after' ? ART.viewModes.after : ART.viewModes.after_ui,
        });
      }
    }
  } finally { await browser.close(); }
  writeJson(path.join(OUT, 'views_index.v1.json'), {
    schema: 'soh.map.lr01.views_index.v1', status: 'STATIC_GEOGRAPHY_QA_VIEWS__NOT_PLAYABLE__NO_CREATOR_VISUAL_APPROVAL',
    nativeResolution: [W, H], regionCount: ART.regions.length, modes: ['before', 'after', 'after_ui'],
    viewCount: rows.length, errors, views: rows,
    inspectedByAgent: 'see docs/MILESTONE_E.md', reproducibility: 'node tools/render_world.mjs (deterministic SVG + Chromium screenshot)',
  });
  console.log(`E_RENDER_OK views=${rows.length} regions=${ART.regions.length} modes=3 size=${W}x${H} errors=${JSON.stringify(errors)}`);
  for (const r of rows.filter(x => x.mode === 'after')) console.log(`  ${r.regionId.padEnd(22)} pxPerAu=${r.window.pxPerAu} cellPx=${r.window.cellPx} window=${r.window.wAu}x${r.window.hAu}au png=${r.bytes}B`);
  if (errors.length) process.exitCode = 1;
})().catch(e => { console.error('E_RENDER_FAIL', e); process.exitCode = 1; });
