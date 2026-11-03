#!/usr/bin/env node
// MAP-GEO-02 step 6: visually inspectable BEFORE / AFTER geometry audit.
// BEFORE = MAP-GEO-01 accepted export (straight control polylines, tol=8,
//          foot-only POI, "cart corridor" label, hidden zero-clearance).
// AFTER  = MAP-GEO-02 (MapLab SNAP_TOL=7 resampled geometry, both bridges,
//          9u source-semantic masks, zero-clearance cell, derived connectors
//          flagged, and a clearly separated PROPOSED po_kilns shell).
// This is a geographic diagram, NOT a game screenshot, NOT art, NOT gameplay validation.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { catmull, resample } from './lib/maplab.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'output');
const GEO01 = path.resolve(ROOT, '../geo01/output');
const require = createRequire(path.resolve(ROOT, '../package.json'));
const { PNG } = require('pngjs');
const puppeteer = require('puppeteer-core');

const W = 1800, H = 1240, S = 3;
const VIEW = { x: 700, y: 550, w: 290, h: 276 };
const PANELS = [
  { id: 'before', x: 20, y: 90, w: VIEW.w * S, h: VIEW.h * S, title: 'BEFORE — MAP-GEO-01 (accepted export)' },
  { id: 'after', x: 910, y: 90, w: VIEW.w * S, h: VIEW.h * S, title: 'AFTER — MAP-GEO-02 (audited + PROPOSED)' },
];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = (q, panel) => [+(panel.x + (q[0] - VIEW.x) * S).toFixed(2), +(panel.y + (q[1] - VIEW.y) * S).toFixed(2)];
const poly = (pts, panel, close = false) => 'M' + pts.map(q => P(q, panel).join(',')).join('L') + (close ? 'Z' : '');
const txt = (x, y, s, color = '#eaf2f7', size = 12, anchor = 'start', weight = 500, stroke = '#08151f') =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" font-family="DejaVu Sans, Arial, sans-serif" paint-order="stroke" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round">${esc(s)}</text>`;

function readU8(f) { return Uint8Array.from(fs.readFileSync(f)); }
function cells(panel, colourFor, masks, gw, gh, cell) {
  const o = [];
  const x0 = Math.floor(VIEW.x / cell), x1 = Math.ceil((VIEW.x + VIEW.w) / cell);
  const y0 = Math.floor(VIEW.y / cell), y1 = Math.ceil((VIEW.y + VIEW.h) / cell);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    if (gx < 0 || gx >= gw || gy < 0 || gy >= gh) continue;
    const c = colourFor(gx, gy, gy * gw + gx);
    if (!c) continue;
    const q = P([gx * cell, gy * cell], panel);
    o.push(`<rect x="${q[0]}" y="${q[1]}" width="${cell * S}" height="${cell * S}" fill="${c}"/>`);
  }
  return o.join('');
}

const INS_VIEW = { x: 882, y: 766, w: 48, h: 38 }, INS_S = 5.2;
function inset(panel, title, design, proposed, foot) {
  const bx = panel.x + 20, by = panel.y + panel.h - 280, bw = 288, bh = 270;
  const I = q => [+(bx + 20 + (q[0] - INS_VIEW.x) * INS_S).toFixed(2), +(by + 34 + (q[1] - INS_VIEW.y) * INS_S).toFixed(2)];
  const ip = (pts, close = false) => 'M' + pts.map(q => I(q).join(',')).join('L') + (close ? 'Z' : '');
  const o = [];
  o.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#07121c" fill-opacity="0.97" stroke="${proposed ? '#e07aff' : '#e8b878'}" stroke-width="1.8"/>`);
  o.push(txt(bx + 10, by + 22, title, proposed ? '#f0b8ff' : '#ffe1a1', 12, 'start', 700));
  o.push(`<clipPath id="clipIns${panel.id}"><rect x="${bx + 12}" y="${by + 28}" width="${bw - 24}" height="${INS_VIEW.h * INS_S + 8}"/></clipPath>`);
  o.push(`<g clip-path="url(#clipIns${panel.id})">`);
  o.push(`<rect x="${bx + 12}" y="${by + 28}" width="${bw - 24}" height="${INS_VIEW.h * INS_S + 8}" fill="#12293a"/>`);
  o.push(`<path d="${ip(foot, true)}" fill="${proposed ? '#e07aff' : '#d9a066'}" fill-opacity="0.12" stroke="#f0c26a" stroke-width="2" ${proposed ? 'stroke-dasharray="5 3"' : ''}/>`);
  if (proposed) {
    for (const ws of design.proposed.interiorWorkingSpaces) o.push(`<path d="${ip(ws.polygonAu, true)}" fill="#b455e8" fill-opacity="0.42" stroke="#e07aff" stroke-width="1.4"/>`);
    for (const e of design.proposed.entranceOptions) o.push(`<path d="${ip(e.openingAu)}" fill="none" stroke="#ff5fa2" stroke-width="7" stroke-linecap="round"/>`);
    for (const c of design.proposed.circulation.paths) o.push(`<path d="${ip(c.centrelineAu)}" fill="none" stroke="#e07aff" stroke-width="1.8" stroke-dasharray="4 3"/>`);
    o.push(`<path d="${ip(design.proposed.approach.proposedApproachCentrelineAu)}" fill="none" stroke="#ff5fa2" stroke-width="2"/>`);
    o.push(`<path d="${ip(design.proposed.retreat.centrelineAu)}" fill="none" stroke="#ff5fa2" stroke-width="2" stroke-dasharray="7 4"/>`);
    const lbl = (q, s, c = '#ffd8f5') => { const p = I(q); o.push(txt(p[0], p[1], s, c, 8.5, 'middle', 700)); };
    lbl([891.4, 786.2], 'EN-A'); lbl([911.5, 776.2], 'EN-B'); lbl([903.6, 794.2], 'EN-C');
    lbl([898, 781], 'WS1'); lbl([911, 781], 'WS2'); lbl([898, 790], 'WS3'); lbl([911, 790], 'WS4');
  }
  o.push(`</g>`);
  if (proposed) {
    o.push(txt(bx + 12, by + 246, 'PROPOSED · non-canonical · MAP-owned', '#f0b8ff', 10.5, 'start', 700));
    o.push(txt(bx + 12, by + 260, 'no recipes / loot / locks / power / machinery', '#d9a8ef', 10, 'start', 400, 'none'));
  } else {
    o.push(txt(bx + 12, by + 246, 'rooms / entrances / circulation NOT_IN_SOURCE', '#ffe1a1', 10.5, 'start', 700));
    o.push(txt(bx + 12, by + 260, 'previously misclassified as GAMEPLAY-owned', '#ffb3a3', 10, 'start', 400, 'none'));
  }
  return o.join('\n');
}

function main() {
  const Pcanon = JSON.parse(Buffer.from(execFileSync('git', ['show',
    '19d8c6ec820f324a6ac12733165e43b5e2c6eab2:map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json'],
    { cwd: path.resolve(ROOT, '../..'), maxBuffer: 32 * 1024 * 1024 })).toString('utf8')).project;
  const corridor = JSON.parse(fs.readFileSync(path.join(GEO01, 'corridor.v1.json'), 'utf8'));
  const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'corridor_audit.v1.json'), 'utf8'));
  const design = JSON.parse(fs.readFileSync(path.join(OUT, 'poi_po_kilns.proposed.v1.json'), 'utf8'));
  const gw = Pcanon.terrain.gw, gh = Pcanon.terrain.gh, cell = Pcanon.terrain.cell;

  const g1 = {
    land: readU8(path.join(GEO01, 'rasters/landId.u8')),
    lake: readU8(path.join(GEO01, 'rasters/lakeId.u8')),
    river: readU8(path.join(GEO01, 'rasters/riverId.u8')),
    water: readU8(path.join(GEO01, 'rasters/waterClass.u8')),
  };
  const g2 = {
    land: readU8(path.join(OUT, 'rasters/landMaplab.u8')),
    lake: readU8(path.join(OUT, 'rasters/lakeMaplab.u8')),
    river: readU8(path.join(OUT, 'rasters/riverMaplab.u8')),
    roadFoot: readU8(path.join(OUT, 'rasters/roadFootMaplab.u8')),
    roadCart: readU8(path.join(OUT, 'rasters/roadCartMaplab.u8')),
  };
  const O = [];
  O.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  O.push(`<rect width="${W}" height="${H}" fill="#08151f"/>`);
  O.push(txt(24, 34, 'MAP-GEO-02 · Veyra spatial geometry audit · sp_lake → po_kilns', '#f3f8fb', 22, 'start', 700));
  O.push(txt(24, 60, '2000×1400 authoring units · view window x 700..990, y 550..826 · no rescale · NOT a game screenshot / NOT gameplay validation', '#9fb6c6', 12));
  O.push(txt(W - 24, 60, 'EXISTING AUTHORED  |  DERIVED  |  PROPOSED (never merged)', '#9fb6c6', 12, 'end'));

  // ---------------- BEFORE ----------------
  const A = PANELS[0];
  O.push(`<rect x="${A.x}" y="${A.y}" width="${A.w}" height="${A.h}" fill="#0d2739" stroke="#34536b" stroke-width="1.5"/>`);
  O.push(`<clipPath id="clipBefore"><rect x="${A.x}" y="${A.y}" width="${A.w}" height="${A.h}"/></clipPath>`);
  O.push(`<g clip-path="url(#clipBefore)">`);
  O.push(cells(A, (gx, gy, k) => g1.water[k] === 1 ? '#102f4a' : g1.land[k] ? '#3b5a39' : g1.lake[k] ? '#2b6d97' : g1.river[k] ? '#3f8fbe' : null, g1, gw, gh, cell));
  for (const r of Pcanon.roads) {
    if (r.kind === 'ferry') continue;
    const col = { cart: '#c98d55', trail: '#9cae84', foot: '#d8d3c4', riverside: '#7fb6c9' }[r.kind] || '#a9b58a';
    O.push(`<path d="${poly(r.points, A)}" fill="none" stroke="${col}" stroke-width="${r.kind === 'cart' ? 3 : 2}" opacity="0.9"/>`);
  }
  for (const r of Pcanon.rivers) O.push(`<path d="${poly(r.points, A)}" fill="none" stroke="#48a6db" stroke-width="${Math.max(2, r.width)}" stroke-linecap="round" opacity="0.75"/>`);
  // GEO-01 route as straight control polylines
  const rt1 = corridor.routes.primary;
  O.push(`<path d="${poly(rt1.geometryAu, A)}" fill="none" stroke="#ffd166" stroke-width="5" stroke-linejoin="round" opacity="0.95"/>`);
  for (const c of rt1.connectors || []) {
    const from = c.from.startsWith('spawn:') ? c.from.slice(6).split(',').map(Number) : null;
    if (!from) continue;
    const to = c.to.split('@')[1].split(',').map(Number);
    O.push(`<path d="${poly([from, to], A)}" fill="none" stroke="#ff8f6b" stroke-width="2" stroke-dasharray="8 5"/>`);
  }
  // POI foot only
  const foot = design.sourceEvidence.poi.foot;
  O.push(`<path d="${poly(foot, A, true)}" fill="#d9a066" fill-opacity="0.16" stroke="#e8b878" stroke-width="2"/>`);
  // zero clearance cell highlighted as a plain square (GEO-01 only reported a mean)
  const z = audit.audit.zeroClearance.zeroClearanceCells[0];
  if (z) { const q = P([z.authoringAu[0] - cell / 2, z.authoringAu[1] - cell / 2], A); O.push(`<rect x="${q[0]}" y="${q[1]}" width="${cell * S}" height="${cell * S}" fill="#ff4d4d" fill-opacity="0.42" stroke="#ff8080" stroke-width="1.5"/>`); }
  // junction tolerance markers
  O.push(`<circle cx="${P([732, 652], A)[0]}" cy="${P([732, 652], A)[1]}" r="7" fill="none" stroke="#ff4d4d" stroke-width="2"/>`);
  O.push(`</g>`);
  O.push(txt(A.x + 12, A.y + 24, A.title, '#ffe1a1', 18, 'start', 700));
  O.push(txt(A.x + 12, A.y + 45, 'Straight control polylines · endpoint+intersection graph @ tol=8 · foot-only POI', '#c9d9e5', 12));
  O.push(txt(A.x + 12, A.y + 63, 'GEO-01 label: "Authored cart corridor via br_4"', '#ff9f8a', 12, 'start', 700));
  O.push(txt(A.x + A.w - 12, A.y + 24, 'BEFORE', '#ffd166', 14, 'end', 700));
  O.push(txt(P([905, 785], A)[0] + 12, P([905, 785], A)[1] - 12, 'po_kilns → see inset', '#ffe1a1', 12));
  O.push(txt(P([732, 652], A)[0] + 12, P([732, 652], A)[1] - 12, 'br_4 · clearance 0 cells', '#ff9f8a', 12));
  O.push(txt(P([790, 622], A)[0] + 8, P([790, 622], A)[1] + 4, 'sp_lake', '#ffe1a1', 12));
  O.push(inset(A, 'BEFORE: foot only', design, false, foot));

  // ---------------- AFTER ----------------
  const B = PANELS[1];
  O.push(`<rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}" fill="#0d2739" stroke="#34536b" stroke-width="1.5"/>`);
  O.push(`<clipPath id="clipAfter"><rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}"/></clipPath>`);
  O.push(`<g clip-path="url(#clipAfter)">`);
  O.push(cells(B, (gx, gy, k) => !g2.land[k] ? '#102f4a' : g2.lake[k] ? '#2b6d97' : g2.river[k] ? '#3f8fbe' : '#3b5a39', g2, gw, gh, cell));
  O.push(`<g opacity="0.48">`);
  O.push(cells(B, (gx, gy, k) => g2.roadCart[k] ? '#e0913f' : g2.roadFoot[k] ? '#a87a4c' : null, g2, gw, gh, cell));
  O.push(`</g>`);
  // MapLab smoothed roads & rivers (source geometry, 8u resampled)
  for (const r of Pcanon.roads) {
    if (r.kind === 'ferry') continue;
    const pts = resample(catmull(r.points).pts, 8).pts;
    const col = { cart: '#d99a5c', trail: '#a9bd8e', foot: '#ddd8c9', riverside: '#8cc4d7' }[r.kind] || '#a9bd8e';
    O.push(`<path d="${poly(pts, B)}" fill="none" stroke="${col}" stroke-width="${r.kind === 'cart' ? 2.6 : 1.6}" opacity="0.95"/>`);
  }
  for (const r of Pcanon.rivers) O.push(`<path d="${poly(catmull(r.points).pts, B)}" fill="none" stroke="#5ab3e2" stroke-width="2" opacity="0.9"/>`);
  // SNAP_TOL=7 junction markers on the corridor roads
  for (const id of audit.sourceIds.roads) {
    const r = Pcanon.roads.find(q => q.id === id); if (!r) continue;
    for (const q of resample(catmull(r.points).pts, 8).pts) {
      const p = P(q, B); O.push(`<circle cx="${p[0]}" cy="${p[1]}" r="1.8" fill="#7fe0c0" fill-opacity="0.8"/>`);
    }
  }
  // derived connectors flagged
  const conns = audit.audit.derivedConnectors;
  conns.forEach((c, ci) => {
    const from = c.from.startsWith('spawn:') ? c.from.slice(6).split(',').map(Number) : c.from.split('@')[1].split(',').map(Number);
    const to = c.to.startsWith('poi:') ? c.to.slice(4).split(',').map(Number) : c.to.split('@')[1].split(',').map(Number);
    O.push(`<path d="${poly([from, to], B)}" fill="none" stroke="#ff9f43" stroke-width="2.4" stroke-dasharray="9 5"/>`);
    const m = P([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], B);
    O.push(txt(m[0], m[1] - 5 + (ci % 2) * 14, `${c.routeId} NEEDS AUTHORING`, '#ffb865', 10, 'middle', 700));
  });
  // bridges
  for (const br of audit.audit.bridgeCrossings.focusBridges) {
    const c = br.coveredIntersections[0]; if (!c) continue;
    const p = P(c.intersectionAu, B);
    O.push(`<circle cx="${p[0]}" cy="${p[1]}" r="9" fill="none" stroke="${br.bridgeId === 'br_4' ? '#7fe0c0' : '#ff9f43'}" stroke-width="2.5"/>`);
    O.push(`<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="${br.bridgeId === 'br_4' ? '#7fe0c0' : '#ff9f43'}"/>`);
    O.push(txt(p[0] + 14, p[1] - 18, `${br.bridgeId} · load=${br.source.load} · ${c.bridgeDistanceAu}au`, br.bridgeId === 'br_4' ? '#9ff0d4' : '#ffc078', 11));
  }
  // zero clearance ring
  if (z) {
    const p = P(z.authoringAu, B);
    O.push(`<circle cx="${p[0]}" cy="${p[1]}" r="13" fill="none" stroke="#ff4d4d" stroke-width="2.5"/>`);
    O.push(txt(p[0] + 14, p[1] + 38, '0 au clearance · swept clearance UNVALIDATED', '#ff9f8a', 11, 'start'));
  }
  // ---- PROPOSED po_kilns geometry (magenta/violet, clearly separated) ----
  const VIOLET = '#e07aff', VIOLET2 = '#b455e8';
  O.push(`<path d="${poly(foot, B, true)}" fill="${VIOLET}" fill-opacity="0.10" stroke="#f0c26a" stroke-width="2.4" stroke-dasharray="7 4"/>`);
  for (const ws of design.proposed.interiorWorkingSpaces) O.push(`<path d="${poly(ws.polygonAu, B, true)}" fill="${VIOLET2}" fill-opacity="0.30" stroke="${VIOLET}" stroke-width="1.6"/>`);
  for (const e of design.proposed.entranceOptions) O.push(`<path d="${poly(e.openingAu, B)}" fill="none" stroke="#ff5fa2" stroke-width="6" stroke-linecap="round"/>`);
  for (const c of design.proposed.circulation.paths) O.push(`<path d="${poly(c.centrelineAu, B)}" fill="none" stroke="${VIOLET}" stroke-width="2" stroke-dasharray="4 3"/>`);
  O.push(`<path d="${poly(design.proposed.retreat.centrelineAu, B)}" fill="none" stroke="#ff5fa2" stroke-width="2.4" stroke-dasharray="9 4"/>`);
  O.push(`<path d="${poly(design.proposed.approach.proposedApproachCentrelineAu, B)}" fill="none" stroke="#ff5fa2" stroke-width="2.4"/>`);
  O.push(`</g>`);
  O.push(txt(B.x + 12, B.y + 24, B.title, '#c9ffe6', 18, 'start', 700));
  O.push(txt(B.x + 12, B.y + 45, 'MapLab SNAP_TOL=7 · Catmull-Rom 8u samples · 9u road/river masks · both bridges', '#c9d9e5', 12));
  O.push(txt(B.x + 12, B.y + 63, 'Violet = PROPOSED (not canonical) · orange dashed = DERIVED connector', '#e0b8ff', 12, 'start', 700));
  O.push(txt(B.x + B.w - 12, B.y + 24, 'AFTER', '#7fe0c0', 14, 'end', 700));
  const fp = P([905, 785], B);
  O.push(txt(fp[0] - 14, fp[1] - 22, 'po_kilns → see inset', '#f0a8ff', 12, 'end', 700));
  O.push(txt(P([790, 622], B)[0] + 8, P([790, 622], B)[1] + 4, 'sp_lake', '#ffe1a1', 12));
  O.push(inset(B, 'AFTER: PROPOSED po_kilns shell', design, true, foot));

  // ---------------- bottom legend + findings ----------------
  const by = 945;
  O.push(`<rect x="20" y="${by}" width="${W - 40}" height="${H - by - 20}" fill="#0c2030" stroke="#34536b" stroke-width="1.2"/>`);
  O.push(txt(36, by + 26, 'LEGEND', '#f3f8fb', 14, 'start', 700));
  const legend = [
    ['#3b5a39', 'land (source)'], ['#3f8fbe', 'river mask (9u min)'], ['#7b5c3c', 'roadFoot 9u analysis stroke'],
    ['#b9783c', 'roadCart 9u analysis stroke'], ['#f0c26a', 'EXISTING po_kilns foot'], ['#e07aff', 'PROPOSED geometry'],
    ['#ff5fa2', 'PROPOSED openings / retreat'], ['#ff9f43', 'DERIVED connector'], ['#ff4d4d', '0 clearance / unvalidated'],
    ['#7fe0c0', 'MapLab resampled 8u node'],
  ];
  legend.forEach(([c, t], i) => {
    const col = i % 5, row = Math.floor(i / 5), x = 150 + col * 330, y = by + 22 + row * 24;
    O.push(`<rect x="${x}" y="${y - 11}" width="14" height="14" fill="${c}"/>`);
    O.push(txt(x + 20, y + 1, t, '#c9d9e5', 11, 'start', 400, 'none'));
  });
  O.push(txt(36, by + 92, 'KEY FINDINGS (see corridor_audit.v1.json for full evidence)', '#f3f8fb', 14, 'start', 700));
  const findings = audit.failingOrNeedsAuthoring.map(f => `${f.id} [${f.severity}] ${f.subject}`);
  findings.forEach((f, i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 36 + col * 880, y = by + 116 + row * 22;
    O.push(txt(x, y, f, col === 0 ? '#ffd8b0' : '#c9e6ff', 11.5, 'start', 500, 'none'));
  });
  O.push(txt(36, H - 28, 'NO claim of physically traversable cart routes: road/river width, deck span and swept clearance remain UNDEFINED. NO runtime merge, NO Gameplay population. Current Web terrain/sea art untouched.', '#ffb3a3', 12, 'start', 700));
  O.push(`</svg>`);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n${O.join('\n')}\n`;
  fs.writeFileSync(path.join(OUT, 'audit_before_after.svg'), svg);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MAP-GEO-02 before/after geometry audit</title>
<style>html,body{margin:0;padding:0;background:#08151f;color:#c9d9e5;font-family:DejaVu Sans,Arial,sans-serif}svg{display:block}</style></head>
<body>${svg}</body></html>`;
  fs.writeFileSync(path.join(OUT, 'audit_before_after.html'), html);

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
      await page.goto('file://' + path.join(OUT, 'audit_before_after.html'), { waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 350));
      const pngPath = path.join(OUT, 'audit_before_after.png');
      await page.screenshot({ path: pngPath, fullPage: true });
      const png = PNG.sync.read(fs.readFileSync(pngPath));
      console.log(`RENDER_OK ${png.width}x${png.height} ${fs.statSync(pngPath).size} bytes svg=${fs.statSync(path.join(OUT, 'audit_before_after.svg')).size} bytes errors=${JSON.stringify(errors)}`);
    } finally { await browser.close(); }
  })();
}
main().catch(e => { console.error('RENDER_FAIL', e); process.exitCode = 1; });
