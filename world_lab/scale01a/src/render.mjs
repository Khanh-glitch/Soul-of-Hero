#!/usr/bin/env node
// MAP-SCALE-01A — visual comparison of the four DIAGNOSTIC scale candidates.
// Geographic maps show the SAME 64x64 au window at the SAME screen scale; only
// the runtime tile grid changes. This is a benchmark diagram, NOT art, NOT a
// game screenshot, NOT a scale approval.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadInputs } from './lib/geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'output');
const require = createRequire(path.resolve(ROOT, '../package.json'));
const { PNG } = require('pngjs');
const puppeteer = require('puppeteer-core');

const W = 1900, H = 1470;
const B = json('comparison.v1.json'), D = json('benchmark.v1.json'), M = json('metrics.v1.json');
function json(f) { return JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const txt = (x, y, s, color = '#dce9f2', size = 12, anchor = 'start', weight = 500, stroke = 'none') =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" font-family="DejaVu Sans, Arial, sans-serif" paint-order="stroke" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round">${esc(s)}</text>`;
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, stroke, sw = 1, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
const f1 = v => (v === null || v === undefined) ? '—' : (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v));

const I = loadInputs();
const G = I.geography, r1 = I.r1, r2 = I.r2;
const gw = 250, cell = 8;
const WIN = { cx: 905, cy: 785, side: 64, scale: 3.55 };
const winPx = WIN.side * WIN.scale;
const poi = G.objects.pois.find(p => p.id === 'po_kilns');
const west = D.measured.featureSizes.proposedEntrances.find(e => e.face === 'west');

const BIOME_COL = ['#9ab864', '#5e864a', '#347440', '#4e7260', '#708862', '#dbc47c', '#beb270', '#928a80', '#eaeef2', '#584846', '#aca84c', '#e2d4a4'];
function pip(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function colourAt(x, y) {
  const gx = Math.max(0, Math.min(gw - 1, Math.floor(x / cell))), gy = Math.max(0, Math.min(174, Math.floor(y / cell)));
  const i = gy * gw + gx;
  if (!r2.landMaplab.data[i]) return '#17384c';
  if (r1.crossingCandidate.data[i]) return '#f0c04a';
  if (r2.lakeMaplab.data[i] || r2.riverMaplab.data[i]) return '#2e6b8e';
  if (pip([x, y], poi.foot)) return '#9a6fd0';
  if (r2.roadCartMaplab.data[i]) return '#c8894e';
  if (r2.roadFootMaplab.data[i]) return '#a98258';
  return BIOME_COL[r1.biomeCode.data[i]] || '#7d9c62';
}
function mapPanel(x, y, u, cand) {
  const o = [];
  o.push(rect(x, y, 448, 282, '#0d1e2a', 'rx="6" stroke="#2b4557"'));
  o.push(txt(x + 12, y + 22, `U = ${u} au / tile`, '#f3f8fb', 15, 'start', 700));
  o.push(txt(x + 436, y + 22, `${cand.worldTiles[0]}x${cand.worldTiles[1]} tiles`, '#9fc4dd', 11.5, 'end', 600));
  const mx = x + 14, my = y + 32;
  const x0 = WIN.cx - WIN.side / 2, y0 = WIN.cy - WIN.side / 2;
  // quantized tiles: sample the source raster at each tile centre
  const nT = Math.ceil(WIN.side / u), tpx = WIN.scale * u;
  for (let ty = 0; ty < nT; ty++) for (let tx = 0; tx < nT; tx++) {
    const ax = x0 + (tx + 0.5) * u, ay = y0 + (ty + 0.5) * u;
    if (ax > x0 + WIN.side || ay > y0 + WIN.side) continue;
    o.push(rect(+(mx + tx * tpx).toFixed(2), +(my + ty * tpx).toFixed(2), +tpx.toFixed(2), +tpx.toFixed(2), colourAt(ax, ay)));
  }
  if (tpx >= 3.2) {
    for (let k = 0; k <= nT; k++) {
      o.push(line(+(mx + k * tpx).toFixed(2), my, +(mx + k * tpx).toFixed(2), my + winPx, 'rgba(255,255,255,0.17)', 0.6));
      o.push(line(mx, +(my + k * tpx).toFixed(2), mx + winPx, +(my + k * tpx).toFixed(2), 'rgba(255,255,255,0.17)', 0.6));
    }
  }
  // PROPOSED west opening (non-canonical) shown at real authoring scale
  const P = q => [+(mx + (q[0] - x0) * WIN.scale).toFixed(2), +(my + (q[1] - y0) * WIN.scale).toFixed(2)];
  if (west?.openingAu) {
    const a = P(west.openingAu[0]), b = P(west.openingAu[1]);
    o.push(line(a[0], a[1], b[0], b[1], '#45e0e0', 3.4));
    o.push(txt(a[0] - 4, a[1] - 6, `entrance ${f1(west.openingWidthAu)} au → ${cand.spatial.quantizedOpenTiles.entranceOpenTiles} open tile(s)`, '#7df1f1', 9.5, 'start', 700, '#08151f'));
  }
  // POI foot outline + player/cart footprints at this U
  o.push(`<path d="M${poi.foot.map(q => P(q).join(',')).join('L')}Z" fill="none" stroke="#e2b6ff" stroke-width="1.6" stroke-dasharray="4 3"/>`);
  const fx = mx + winPx - 26, fy = my + winPx - 26;
  o.push(`<circle cx="${fx}" cy="${fy}" r="${Math.max(2, 4 * 2 * WIN.scale / 16)}" fill="none" stroke="#ffffff" stroke-width="1.6"/>`);
  o.push(`<circle cx="${fx}" cy="${fy}" r="${Math.max(2.5, 5 * 2 * WIN.scale / 16)}" fill="none" stroke="#ffb36b" stroke-width="1.6"/>`);
  // legend / key facts
  o.push(txt(x + 12, y + 250, `world ${f1(cand.cells)} cells · mem ≥${f1(cand.memory.totalMBLowerBound)} MB · entrance ${cand.spatial.quantizedOpenTiles.entranceOpenTiles} tile(s)`, cand.feasibility.hardRejections.length ? '#ffb3a3' : '#a8e6b0', 10.6, 'start', 700));
  const hr = cand.feasibility.hardRejections;
  o.push(txt(x + 12, y + 269, hr.length ? `REJECT (${hr.length}): ${hr.slice(0, 2).join(', ')}${hr.length > 2 ? ` +${hr.length - 2}` : ''}` : 'PASS: all gating spatial + engine tests', hr.length ? '#ff9b86' : '#9ce8a8', 10.4, 'start', 600));
  return o.join('\n');
}

function heatmap(x, y) {
  const o = [rect(x, y, 910, 560, '#0d1e2a', 'rx="6" stroke="#2b4557"')];
  o.push(txt(x + 14, y + 24, 'SPATIAL / ENGINE FEASIBILITY — gating tests + measured blockers', '#f3f8fb', 14, 'start', 700));
  const tests = D.candidates[0].feasibility.tests.map(t => t.id);
  const us = D.candidates.map(c => c.u);
  const colW = 150, rowH = 24, gx = x + 330;
  us.forEach((u, ci) => o.push(txt(gx + ci * colW + colW / 2, y + 48, `U=${u}`, '#9fc4dd', 11.5, 'middle', 700)));
  tests.forEach((id, ri) => {
    const yy = y + 62 + ri * rowH;
    if (ri % 2 === 0) o.push(rect(x + 10, yy - 15, 890, rowH - 2, '#12293a'));
    o.push(txt(x + 16, yy, id.replace(/_/g, ' ').toLowerCase(), '#c5d8e6', 10.6, 'start', 500));
    us.forEach((u, ci) => {
      const t = D.candidates[ci].feasibility.tests.find(z => z.id === id);
      const gating = t.gating;
      const c = (t.ok && !t.measuredOnly) ? '#57c98a' : (!t.ok ? (gating ? '#e5645c' : '#d9a441') : '#d9a441');
      o.push(rect(gx + ci * colW + 8, yy - 13, colW - 20, 19, c, 'rx="3" opacity="0.9"'));
      const label = t.measuredOnly ? 'measured' : (t.ok ? 'PASS' : (gating ? 'REJECT' : (t.id === 'CARGO_CORRIDOR_AUTHORING' ? 'blocked' : 'global')));
      o.push(txt(gx + ci * colW + colW / 2, yy + 1, label, '#071722', 10, 'middle', 700));
    });
  });
  const by = y + 62 + tests.length * rowH + 10;
  o.push(txt(x + 16, by, 'Cells & runtime limits (linear scale)', '#f3f8fb', 13, 'start', 700));
  const maxCells = 2800000, bx = x + 16, bw = 878, bh = 96, byy = by + 12;
  o.push(rect(bx, byy, bw, bh, '#102334', 'rx="4"'));
  const frac = v => v / maxCells;
  const barX = bx + 96, barW = bw - 116;
  const limitX = barX + barW * frac(1000000);
  o.push(line(limitX, byy + 6, limitX, byy + bh - 4, '#ffd166', 2, 'stroke-dasharray="5 4"'));
  o.push(txt(limitX + 5, byy + bh - 5, '1,000,000-cell cap', '#ffd166', 9.5, 'start', 600));
  us.forEach((u, ci) => {
    const c = D.candidates[ci], yy = byy + 12 + ci * 20;
    const w = Math.max(4, barW * frac(c.cells));
    const label = `${c.cells.toLocaleString()} cells · ${f1(c.memory.totalMBLowerBound)} MB`;
    o.push(txt(bx + 10, yy + 10, `U=${u}`, '#c5d8e6', 10, 'start', 700));
    o.push(rect(barX, yy, +w.toFixed(1), 13, c.feasibility.hardRejections.length ? '#e5645c' : '#57c98a', 'rx="2"'));
    if (w > 470) o.push(txt(barX + 8, yy + 10, label, '#071722', 9.5, 'start', 700));
    else o.push(txt(barX + w + 6, yy + 10, label, '#c5d8e6', 9.5, 'start', 500));
  });
  return o.join('\n');
}

function timeChart(x, y) {
  const o = [rect(x, y, 910, 350, '#0d1e2a', 'rx="6" stroke="#2b4557"')];
  o.push(txt(x + 14, y + 24, 'MODELLED TRAVEL TIME — RT-1 corridor sp_lake → po_kilns (199.4843 au straight)', '#f3f8fb', 14, 'start', 700));
  const id = 'corridor.RT-1';
  const us = D.candidates.map(c => c.u);
  const series = [
    { key: 'straight', label: 'straight-line theoretical (neutral terrain)', col: '#6fb7e8' },
    { key: 'route', label: 'geographic raster route (terrain-weighted)', col: '#7ad29a' },
    { key: 'cart', label: 'loaded cart cw=240 (MODELED, NOT passability)', col: '#e9b05b' },
  ];
  const vals = us.map(u => {
    const t = M.byScale[u].find(z => z.journeyId === id);
    return [t.straightLineTheoreticalSeconds, t.geographicRouteSeconds, t.loadedCartCases.loadedMax.seconds];
  });
  const max = Math.max(...vals.flat().filter(Number.isFinite)) * 1.15;
  const bx = x + 18, by = y + 250, bw = 600, bh = 190;
  o.push(line(bx, by, bx + bw, by, '#4b6b80', 1.2));
  for (let k = 0; k <= 4; k++) {
    const yy = by - bh * k / 4;
    o.push(line(bx, yy, bx + bw, yy, '#234055', 0.7, 'stroke-dasharray="3 5"'));
    o.push(txt(bx - 6, yy + 3, `${f1(max * k / 4)}s`, '#8fb0c4', 9.5, 'end', 500));
  }
  us.forEach((u, ci) => {
    const gx = bx + 24 + ci * (bw - 40) / 4;
    series.forEach((s, si) => {
      const v = vals[ci][si], h = v === null ? 0 : bh * v / max;
      o.push(rect(+(gx + si * 26).toFixed(1), +(by - h).toFixed(1), 22, +h.toFixed(1), s.col, 'rx="2"'));
      o.push(txt(+(gx + si * 26 + 11).toFixed(1), +(by - h - 4).toFixed(1), v === null ? '—' : `${f1(v)}`, '#dce9f2', 9, 'middle', 700, '#08151f'));
    });
    o.push(txt(gx + 39, by + 18, `U=${u}`, '#9fc4dd', 11, 'middle', 700));
  });
  series.forEach((s, si) => {
    const yy = y + 48 + si * 19;
    o.push(rect(x + 640, yy - 10, 13, 13, s.col));
    o.push(txt(x + 660, yy + 1, s.label, '#c5d8e6', 10.6));
  });
  o.push(txt(x + 640, y + 116, 'Cross-world width 2000 au (neutral terrain):', '#f3f8fb', 11.5, 'start', 700));
  us.forEach((u, ci) => {
    const c = D.candidates[ci];
    o.push(txt(x + 640, y + 136 + ci * 19, `U=${u}: ${f1(c.traversal.crossWorldWidthSeconds)} s = ${f1(c.traversal.crossWorldWidthFractionOfFictionalDay * 100)}% of a 24-min fictional day`, ci === 1 ? '#9ce8a8' : '#c5d8e6', 10.6));
  });
  o.push(txt(x + 640, y + 222, 'Even U=1 crosses the whole world in <8 real min', '#ffd166', 10.6, 'start', 700));
  o.push(txt(x + 640, y + 240, 'under PR44 72 px/s: journey cost must come from', '#ffd166', 10.6, 'start', 700));
  o.push(txt(x + 640, y + 258, 'cargo, terrain, exposure & risk — not distance alone.', '#ffd166', 10.6, 'start', 700));
  o.push(txt(x + 14, y + 332, 'Straight-line = unobstructed lower bound. Route = Dijkstra on accepted GEO-01/02 masks. Cart = PR44 speed/weight profile on the SAME foot route; NO cart-passability claim.', '#9fc4dd', 10, 'start', 500));
  return o.join('\n');
}

function summary(x, y) {
  const o = [rect(x, y, 1860, 250, '#0d1e2a', 'rx="6" stroke="#2b4557"')];
  o.push(txt(x + 16, y + 26, 'COMPACT COMPARISON', '#f3f8fb', 14, 'start', 700));
  const cols = [
    ['U', 40], ['world tiles', 160], ['cells', 280], ['mem MB', 400], ['entrance open tiles', 520],
    ['smallest POI tiles²', 710], ['road / river tiles', 890], ['POI feet losing a room', 1070],
    ['RT-1 route s', 1250], ['cross-world s', 1390], ['gating failures', 1550], ['verdict', 1700],
  ];
  cols.forEach(([h, dx]) => o.push(txt(x + dx, y + 52, h, '#9fc4dd', 10.5, 'start', 700)));
  D.candidates.forEach((c, i) => {
    const yy = y + 78 + i * 34, row = B.rows[i];
    const t = M.byScale[c.u].find(z => z.journeyId === 'corridor.RT-1');
    const cells = [c.u, `${c.worldTiles[0]}x${c.worldTiles[1]}`, c.cells.toLocaleString(), f1(c.memory.totalMBLowerBound),
      String(c.spatial.quantizedOpenTiles.entranceOpenTiles), f1(c.spatial.featureTiles.minPOIAreaTiles),
      `${c.spatial.quantizedOpenTiles.roadOpenTiles} / ${c.spatial.quantizedOpenTiles.riverOpenTiles}`,
      String(c.spatial.poiFeetUnableToHostSmallestRoom), f1(t.geographicRouteSeconds), f1(c.traversal.crossWorldWidthSeconds),
      String(c.feasibility.hardRejections.length), c.feasibility.hardRejections.length ? 'REJECT' : 'SHORTLIST'];
    if (i % 2 === 0) o.push(rect(x + 12, yy - 19, 1836, 30, '#12293a'));
    cols.forEach(([, dx], k) => o.push(txt(x + dx, yy, cells[k], k === 11 ? (c.feasibility.hardRejections.length ? '#ff9b86' : '#9ce8a8') : '#dce9f2', 10.8, 'start', k === 0 || k === 11 ? 700 : 500)));
  });
  const by = y + 222;
  o.push(txt(x + 16, by, `SHORTLIST: U=${D.recommendation.shortlist.join(',')} (diagnostic only, NOT approved). U=8 reproduces the 250x175 source raster but quantizes the 3.696 au entrance to ZERO open tiles and destroys POI rooms.`, '#9ce8a8', 11.4, 'start', 700));
  o.push(txt(x + 16, by + 20, 'ALL four candidates fail validateRuntimeMapPackage() (exact 200x200 @ TILE=16) and core.ts fixed 40,000-cell grid. Missing: approved biome mapping, swept clearance, cart/ferry rules, exposure sim, streaming, human 640x360 test.', '#ffd166', 10.6, 'start', 600));
  return o.join('\n');
}

function journeyPanel(x, y) {
  const o = [rect(x, y, 910, 332, '#0d1e2a', 'rx="6" stroke="#2b4557"')];
  o.push(txt(x + 14, y + 24, 'SOURCE-LINKED JOURNEYS (U=2 shown; all four scales in metrics.v1.json)', '#f3f8fb', 14, 'start', 700));
  const reps = B.representativeJourneys;
  const heads = [['journey', 14], ['straight au', 400], ['route au', 510], ['straight s', 620], ['route s', 710], ['loaded cart s', 800]];
  heads.forEach(([h, dx]) => o.push(txt(x + dx, y + 48, h, '#9fc4dd', 10.5, 'start', 700)));
  reps.forEach((r, i) => {
    const yy = y + 70 + i * 27;
    const j = D.journeys.find(z => z.id === r.id) || {};
    const t = M.byScale[2].find(z => z.journeyId === r.id) || {};
    if (i % 2 === 0) o.push(rect(x + 10, yy - 16, 890, 25, '#12293a'));
    const unresolved = !j.routeStatus?.startsWith('GEOGRAPHIC');
    const vals = [r.label.slice(0, 46), f1(j.straightAu), unresolved ? 'UNRESOLVED' : f1(j.routeAu),
      f1(t.straightLineTheoreticalSeconds), unresolved ? '—' : f1(t.geographicRouteSeconds),
      unresolved ? '—' : f1(t.loadedCartCases?.loadedMax?.seconds)];
    heads.forEach(([, dx], k) => o.push(txt(x + dx, yy, vals[k], (unresolved && k >= 2) ? '#ff9b86' : '#dce9f2', 10.2, 'start', k === 0 ? 500 : 600)));
  });
  o.push(txt(x + 14, y + 316, 'UNRESOLVED = separate landmass / unbridged channel; Veyra has kind=ferry roads but PR44 HEAD has NO approved ferry rule. NO time is fabricated.', '#ffd166', 10, 'start', 600));
  return o.join('\n');
}

function main() {
  const O = [];
  O.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  O.push(rect(0, 0, W, H, '#08151f'));
  O.push(rect(0, 0, W, 74, '#102a3b'));
  O.push(txt(20, 30, 'MAP-SCALE-01A — VEYRA SCALE & GAMEPLAY FIT BENCHMARK', '#f3f8fb', 21, 'start', 700));
  O.push(txt(20, 56, 'DIAGNOSTIC CANDIDATES 1 / 2 / 4 / 8 authoring units per runtime tile · full 2000x1400 authoring geometry UNCHANGED · PR44 HEAD d80ad1b5', '#9fc4dd', 11.5, 'start', 500));
  O.push(txt(W - 20, 30, 'NO APPROVED SCALE', '#ffb3a3', 15, 'end', 700));
  O.push(txt(W - 20, 56, 'DECISION SUPPORT — NOT A PLAYABLE FULL-WORLD INTEGRATION', '#ffd166', 11, 'end', 600));

  O.push(txt(20, 98, 'SAME 64x64 au WINDOW AT SAME SCREEN SCALE — po_kilns / RT-1 area. Grid = runtime tiles; white/orange circles = px-fixed player/cart collision diameters. Dashed = canonical POI foot; cyan = PROPOSED 3.696 au entrance.', '#f3f8fb', 11.5, 'start', 700));
  const cand = D.candidates;
  O.push(mapPanel(20, 110, 1, cand[0]));
  O.push(mapPanel(480, 110, 2, cand[1]));
  O.push(mapPanel(20, 404, 4, cand[2]));
  O.push(mapPanel(480, 404, 8, cand[3]));
  O.push(heatmap(950, 110));
  O.push(journeyPanel(20, 700));
  O.push(timeChart(950, 682));
  O.push(summary(20, 1046));
  O.push(rect(20, 1306, 1860, 150, '#0d1e2a', 'rx="6" stroke="#2b4557"'));
  O.push(txt(36, 1330, 'WHAT IS MEASURED / ASSUMED / STILL MISSING', '#f3f8fb', 14, 'start', 700));
  const cols = [
    ['MEASURED', '#9ce8a8', [
      '51 journeys; 41 terrain-weighted routes; 10 UNRESOLVED (no ferry rule).',
      '4 spawns, 3 home zones, 6 Elders, near/far POIs, RT-1/2/3; cart network = 6 components.',
      'PR44 HEAD balance, 14 speed keys, 5x4..17x12 tile buildings, 1M-cell cap, chunk stride 100.',
    ]],
    ['ASSUMPTION', '#ffd166', [
      '12 biome codes -> PR44 speed keys (GEO-02: NOT approved).',
      '9 au road/river strokes + 13x7.2 au bridge glyph = EDITOR geometry, NOT physical widths.',
      '3.696 au entrance / 57.4232 au² workspace = GEO-02 PROPOSED, NOT canonical.',
    ]],
    ['MISSING', '#ff9b86', [
      'Swept clearance, cart slope/bridge/water rules, ferry rule, exposure_time.',
      'Approved biome mapping; MAP-U4 seller/price/stock; 3 built houses; human 640x360 test.',
      'WW/WH + validator + chunk key + seaDist BFS + streaming/LOD/save budget.',
    ]],
  ];
  cols.forEach(([h, c, lines], ci) => {
    const x = 36 + ci * 620;
    O.push(txt(x, 1354, h, c, 12, 'start', 700));
    lines.forEach((l, li) => O.push(txt(x, 1374 + li * 21, `• ${l}`, '#c5d8e6', 9.8, 'start', 500)));
  });
  O.push(txt(20, H - 8, 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT. · No fabricated travel time, no invented collision rule, no incomplete trail labelled cart-passable.', '#7fa8be', 10.5, 'start', 600));
  O.push('</svg>');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n${O.join('\n')}\n`;
  fs.writeFileSync(path.join(OUT, 'scale_comparison.svg'), svg);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MAP-SCALE-01A scale comparison</title>
<style>html,body{margin:0;padding:0;background:#08151f;color:#c9d9e5;font-family:DejaVu Sans,Arial,sans-serif}svg{display:block}</style></head>
<body>${svg}</body></html>`;
  fs.writeFileSync(path.join(OUT, 'scale_comparison.html'), html);

  return (async () => {
    const browser = await puppeteer.launch({
      executablePath: '/tmp/chromium', headless: true,
      env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib' },
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files', '--font-render-hinting=none'],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto('file://' + path.join(OUT, 'scale_comparison.html'), { waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 400));
      const pngPath = path.join(OUT, 'scale_comparison.png');
      await page.screenshot({ path: pngPath, fullPage: true });
      const png = PNG.sync.read(fs.readFileSync(pngPath));
      console.log(`RENDER_OK ${png.width}x${png.height} ${fs.statSync(pngPath).size} bytes svg=${fs.statSync(path.join(OUT, 'scale_comparison.svg')).size} bytes errors=${JSON.stringify(errors)}`);
      if (errors.length) process.exitCode = 1;
    } finally { await browser.close(); }
  })();
}
main().catch(e => { console.error('RENDER_FAIL', e); process.exitCode = 1; });
