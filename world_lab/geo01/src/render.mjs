#!/usr/bin/env node
// MAP-GEO-01 milestone B: geographic corridor inspection diagram.
// It draws ACTUAL Veyra polygons / polylines / routed corridor. It is NOT a
// game screenshot, NOT an art proposal and NOT gameplay validation.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadSource } from './lib/source.mjs';
import { parseArgs, ensureOut, DEFAULT_OUT, ROOT } from './lib/cli.mjs';
import { dist, ringCentroid, ringBBox, pathDistance } from './lib/geometry.mjs';

const require = createRequire(path.join(ROOT, 'package.json'));
const { PNG } = require('pngjs');
const puppeteer = require('puppeteer-core');

const VIEW = { x: 650, y: 510, w: 390, h: 410 }; // authoring units
const W = 1170, H = 1230;                         // svg pixels (3x view)
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ringPath = r => 'M' + r.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('L') + 'Z';
const linePath = p => 'M' + p.map(q => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join('L');
const label = (x, y, text, color = '#e9f2f7', size = 9, anchor = 'start', weight = 500) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${color}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" font-family="DejaVu Sans, Arial, sans-serif" paint-order="stroke" stroke="#08151f" stroke-width="2.2" stroke-linejoin="round">${esc(text)}</text>`;

function buildSvg(P, geo, corridor) {
  const g = geo.frame.grid;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}">`);
  out.push(`<rect x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.w}" height="${VIEW.h}" fill="#0d2739"/>`);
  // subtle source grid (one cell = 8 authoring units) — only a coarse 10-cell grid for readability
  for (let x = Math.ceil(VIEW.x / 80) * 80; x < VIEW.x + VIEW.w; x += 80)
    out.push(`<line x1="${x}" y1="${VIEW.y}" x2="${x}" y2="${VIEW.y + VIEW.h}" stroke="#ffffff" stroke-opacity="0.05" stroke-width="0.6"/>`);
  for (let y = Math.ceil(VIEW.y / 80) * 80; y < VIEW.y + VIEW.h; y += 80)
    out.push(`<line x1="${VIEW.x}" y1="${y}" x2="${VIEW.x + VIEW.w}" y2="${y}" stroke="#ffffff" stroke-opacity="0.05" stroke-width="0.6"/>`);

  // Land polygons (authored rings, holes honoured via fill-rule)
  for (const l of P.land) {
    const d = l.rings.map(ringPath).join(' ');
    out.push(`<path d="${d}" fill="#3c5d3a" fill-rule="evenodd" stroke="#8bb173" stroke-width="1.1"/>`);
  }
  // Lakes
  for (const l of P.lakes) {
    out.push(`<path d="${ringPath(l.ring)}" fill="#2b6d97" stroke="#79c3ec" stroke-width="1"/>`);
    const c = ringCentroid(l.ring);
    out.push(label(c[0], c[1], l.id, '#bfe6ff', 8, 'middle'));
  }
  // Rivers — stroke width is the RAW source width field (unit unestablished)
  for (const r of P.rivers) {
    out.push(`<path d="${linePath(r.points)}" fill="none" stroke="#48a6db" stroke-width="${Math.max(1.2, r.width)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`);
    for (const f of r.feats || []) out.push(`<circle cx="${f.at[0]}" cy="${f.at[1]}" r="3" fill="none" stroke="#ffd166" stroke-width="1"/>`);
  }
  // Buildable zone polygons
  for (const z of P.zones) {
    out.push(`<path d="${ringPath(z.ring)}" fill="#e8c46a" fill-opacity="0.10" stroke="#d9b76a" stroke-width="1" stroke-dasharray="4 3"/>`);
    const c = ringCentroid(z.ring);
    if (c[0] > VIEW.x && c[0] < VIEW.x + VIEW.w && c[1] > VIEW.y && c[1] < VIEW.y + VIEW.h) out.push(label(c[0], c[1] - 2, z.id, '#ffe6a3', 7, 'middle'));
  }
  // Roads by authored kind
  const rc = { cart: '#c98d55', trail: '#a9b58a', foot: '#d8d3c4', riverside: '#7fb6c9', ferry: '#b58ad8' };
  for (const r of P.roads) {
    const dash = r.kind === 'ferry' ? 'stroke-dasharray="7 5"' : '';
    out.push(`<path d="${linePath(r.points)}" fill="none" stroke="${rc[r.kind] || '#ffffff'}" stroke-width="${r.kind === 'cart' ? 2.4 : 1.4}" stroke-linecap="round" ${dash} opacity="0.9"/>`);
  }
  // Existing resource annotations (candidate suitability circles — NOT nodes)
  for (const r of corridor.resourceGeography.annotationGeometry) {
    out.push(`<circle cx="${r.at[0]}" cy="${r.at[1]}" r="${r.r}" fill="none" stroke="#9bd6a0" stroke-opacity="0.22" stroke-width="0.8"/>`);
  }
  // POI shells
  for (const p of P.pois) {
    if (p.at[0] < VIEW.x - 20 || p.at[0] > VIEW.x + VIEW.w + 20 || p.at[1] < VIEW.y - 20 || p.at[1] > VIEW.y + VIEW.h + 20) continue;
    out.push(`<path d="${ringPath(p.foot)}" fill="#e2b96f" fill-opacity="0.35" stroke="#ffdf9b" stroke-width="1"/>`);
    if (p.deep) out.push(`<path d="${ringPath(p.deep)}" fill="none" stroke="#ff9f68" stroke-width="0.9" stroke-dasharray="3 2"/>`);
    out.push(`<rect x="${p.at[0] - 2}" y="${p.at[1] - 2}" width="4" height="4" fill="#ffe2a8"/>`);
    if (dist(p.at, corridor.spawnSelection.candidates[0].at) < 230 || p.id === corridor.targetSelection.chosen)
      out.push(label(p.at[0] + 4, p.at[1] - 4, p.id, '#ffe9bb', 7.5));
  }
  // Bridges (load class)
  for (const b of P.bridges) {
    const col = b.load === 'cart' ? '#ff9f43' : '#f2f6f8';
    out.push(`<path d="M${b.at[0]},${b.at[1] - 4}L${b.at[0] + 4},${b.at[1]}L${b.at[0]},${b.at[1] + 4}L${b.at[0] - 4},${b.at[1]}Z" fill="${col}" stroke="#0d2739" stroke-width="0.8"/>`);
    if (b.at[0] > VIEW.x && b.at[0] < VIEW.x + VIEW.w && b.at[1] > VIEW.y && b.at[1] < VIEW.y + VIEW.h)
      out.push(label(b.at[0] + 5, b.at[1] + 3, `${b.id} (${b.load})`, col, 7));
  }
  // Docks
  for (const d of P.docks) out.push(`<circle cx="${d.at[0]}" cy="${d.at[1]}" r="2.2" fill="#7fd4c8" stroke="#0d2739" stroke-width="0.6"/>`);
  // Elders (outer/core) as thin outlines only
  for (const e of P.elders) {
    out.push(`<path d="${ringPath(e.outer)}" fill="none" stroke="#c78bd8" stroke-width="0.8" stroke-opacity="0.5"/>`);
  }

  // Derived physical BFS grid path (dots)
  for (const i of corridor.physicalConnectivity.pathCellList) {
    const gx = i % g.gw, gy = (i / g.gw) | 0;
    out.push(`<circle cx="${(gx + 0.5) * g.cell}" cy="${(gy + 0.5) * g.cell}" r="1.1" fill="#ffffff" opacity="0.75"/>`);
  }
  // Authorised / alternative routes
  const styles = [
    { r: corridor.routes.alternatives.find(x => x.id === 'RT-3'), color: '#4dd0e1', width: 2.6, dash: '9 5' },
    { r: corridor.routes.alternatives.find(x => x.id === 'RT-2'), color: '#ffe066', width: 2.6, dash: '5 4' },
    { r: corridor.routes.primary, color: '#ff6b4a', width: 4.2, dash: '' },
  ];
  for (const s of styles) if (s.r) out.push(`<path d="${linePath(s.r.geometryAu)}" fill="none" stroke="${s.color}" stroke-width="${s.width}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>`);

  // Spawn + target markers
  const sp = P.spawns.find(s => s.id === corridor.spawnSelection.chosen);
  const tp = P.pois.find(p => p.id === corridor.targetSelection.chosen);
  out.push(`<circle cx="${sp.at[0]}" cy="${sp.at[1]}" r="7" fill="none" stroke="#7dff9b" stroke-width="2"/>`);
  out.push(`<circle cx="${sp.at[0]}" cy="${sp.at[1]}" r="2.5" fill="#7dff9b"/>`);
  out.push(label(sp.at[0] + 9, sp.at[1] - 6, `${sp.id}  SPAWN`, '#a9ffc0', 11, 'start', 700));
  out.push(`<circle cx="${tp.at[0]}" cy="${tp.at[1]}" r="10" fill="none" stroke="#ff6b4a" stroke-width="2"/>`);
  out.push(label(tp.at[0] + 12, tp.at[1] + 12, `${tp.id}  POI SHELL`, '#ffb49c', 11, 'start', 700));
  // Key bridge + crossing callouts
  const br = P.bridges.find(b => b.id === 'br_4');
  out.push(label(br.at[0] + 6, br.at[1] + 20, 'rv_silver / br_4 crossing', '#ffcf9b', 8.5, 'start'));
  // 100 au scale bar
  const sx = VIEW.x + 16, sy = VIEW.y + VIEW.h - 18;
  out.push(`<line x1="${sx}" y1="${sy}" x2="${sx + 100}" y2="${sy}" stroke="#ffffff" stroke-width="2"/>`);
  out.push(`<line x1="${sx}" y1="${sy - 4}" x2="${sx}" y2="${sy + 4}" stroke="#ffffff" stroke-width="2"/>`);
  out.push(`<line x1="${sx + 100}" y1="${sy - 4}" x2="${sx + 100}" y2="${sy + 4}" stroke="#ffffff" stroke-width="2"/>`);
  out.push(label(sx, sy - 8, '100 authoring units', '#ffffff', 9));
  out.push(label(VIEW.x + VIEW.w - 8, VIEW.y + 16, 'authoring axes: +x →   +y ↓', '#ffffff', 8, 'end'));
  out.push('</svg>');
  return out.join('\n');
}

function buildHtml(svg, corridor) {
  const rows = [
    ['RT-1 primary (cart corridor)', '#ff6b4a'],
    ['RT-2 alternative (full rd_13)', '#ffe066'],
    ['RT-3 alternative (riverside rd_20)', '#4dd0e1'],
    ['white dots = derived land-BFS path', '#ffffff'],
    ['land / coast', '#3c5d3a'], ['lake / river', '#2b6d97'],
    ['cart road', '#c98d55'], ['trail', '#a9b58a'], ['foot path', '#d8d3c4'],
    ['riverside path', '#7fb6c9'], ['ferry (dashed, not on corridor)', '#b58ad8'],
    ['buildable zone (dashed)', '#d9b76a'], ['POI foot / deep', '#e2b96f'],
    ['resource suitability circles (candidate)', '#9bd6a0'],
    ['Elder outer territory (thin)', '#c78bd8'],
    ['cart bridge / foot bridge', '#ff9f43'],
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;background:#08151f;color:#e9f2f7;font-family:DejaVu Sans,Arial,sans-serif}
  .wrap{display:flex;gap:14px;padding:14px;align-items:flex-start}
  h1{font-size:19px;margin:0 0 6px}h2{font-size:13px;margin:14px 0 6px;color:#9fd3ff}
  p{font-size:11px;line-height:1.5;margin:4px 0;color:#b9cbd6}
  .side{width:370px;flex:none}.legend{display:grid;grid-template-columns:18px 1fr;gap:4px 8px;font-size:11px;align-items:center}
  .sw{height:11px;border-radius:2px}.warn{border:1px solid #ff6b4a;background:#2a1512;padding:8px;margin-top:10px;font-size:11px;line-height:1.5}
  .ok{border:1px solid #3c8f6a;background:#10251e;padding:8px;margin-top:10px;font-size:11px;line-height:1.5}
  table{border-collapse:collapse;font-size:11px;width:100%}td,th{border-bottom:1px solid #243a49;padding:3px 5px;text-align:left}th{color:#9fd3ff}
  svg{display:block;border:1px solid #2c4b5e}
  </style></head><body><div class="wrap">
  <div>${svg}</div>
  <div class="side">
   <h1>MAP-GEO-01 — Veyra geographic corridor</h1>
   <p><b>${esc(corridor.spawnSelection.chosen)}</b> → <b>${esc(corridor.targetSelection.chosen)}</b> (${esc(corridor.targetSelection.poiShell.name)}). All polygons, polylines, points and ids are read verbatim from <code>VEYRA_GOLD_MAP.sohmap.json</code> @ <code>19d8c6ec</code>.</p>
   <div class="ok"><b>GEOGRAPHIC PROOF</b><br>Physical land connectivity: <b>${corridor.physicalConnectivity.connected ? 'CONNECTED' : 'NOT CONNECTED'}</b>, ${corridor.physicalConnectivity.gridSteps} grid steps = ${corridor.physicalConnectivity.gridStepDistanceAu} authoring units (4-neighbour lower bound). One authored crossing: <b>br_4</b> (load cart) over <b>rv_silver</b>.</div>
   <h2>Authored routes (distance in authoring units)</h2>
   <table><tr><th>Route</th><th>Au</th><th>Roads</th></tr>
   ${[corridor.routes.primary, ...corridor.routes.alternatives].map(r => `<tr><td>${esc(r.id)}</td><td>${r.totalDistanceAu}</td><td>${esc(r.sourceIds.join(', '))}</td></tr>`).join('')}
   </table>
   <h2>Legend</h2><div class="legend">${rows.map(([t, c]) => `<div class="sw" style="background:${c}"></div><div>${esc(t)}</div>`).join('')}</div>
   <h2>Reading notes</h2>
   <p>River stroke width is the raw source <code>width</code> field; its physical unit is UNKNOWN. Road width is NOT authored. Green circles are the 50 existing Veyra <b>candidate geographic annotations</b> near the spawn — not harvestable nodes.</p>
   <p>Clearance along RT-1: min ${corridor.physicalConnectivity.clearanceAlongAuthoredPrimaryRouteAu.min} au, mean ${corridor.physicalConnectivity.clearanceAlongAuthoredPrimaryRouteAu.mean} au. Raw slope along RT-1: ${corridor.physicalConnectivity.slopeAlongAuthoredPrimaryRouteRaw.min}..${corridor.physicalConnectivity.slopeAlongAuthoredPrimaryRouteRaw.max} byte deltas (no threshold supplied).</p>
   <div class="warn"><b>NOT GAMEPLAY VALIDATION.</b> This is a static geographic diagram. No harvestable instances, loot, stock, yields, survival rules, day/night, weather, creatures or population algorithm were applied. The corridor is NOT claimed to be naturally survivable.</div>
   <p>Source: ${esc(corridor.canonicalSourceSha256.slice(0, 24))}… · derived corridor: <code>corridor.v1.json</code> · no rescale to 200×200.</p>
  </div></div></body></html>`;
}

async function main() {
  const args = parseArgs();
  const out = ensureOut(args.out ? path.resolve(args.out) : DEFAULT_OUT);
  const P = loadSource({ sourcePath: args.source || null }).project;
  const geo = JSON.parse(fs.readFileSync(path.join(out, 'geography.v1.json'), 'utf8'));
  const corridor = JSON.parse(fs.readFileSync(path.join(out, 'corridor.v1.json'), 'utf8'));
  const svg = buildSvg(P, geo, corridor);
  const svgPath = path.join(out, 'corridor.svg');
  fs.writeFileSync(svgPath, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
  const html = buildHtml(svg, corridor);
  fs.writeFileSync(path.join(out, 'corridor.html'), html);

  const browser = await puppeteer.launch({
    executablePath: '/tmp/chromium',
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib' },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1300, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('file://' + path.join(out, 'corridor.html'), { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 350));
    const pngPath = path.join(out, 'corridor.png');
    await page.screenshot({ path: pngPath, fullPage: true });
    const png = PNG.sync.read(fs.readFileSync(pngPath));
    console.log(`RENDER_OK ${png.width}x${png.height} ${fs.statSync(pngPath).size} bytes svg=${fs.statSync(svgPath).size} bytes errors=${JSON.stringify(errors)}`);
  } finally { await browser.close(); }
}
main().catch(e => { console.error('RENDER_FAIL', e); process.exitCode = 1; });
