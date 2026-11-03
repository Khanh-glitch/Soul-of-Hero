#!/usr/bin/env node
// Milestone A visual: real 81-POI footprints (own quads) + corrected fit curves
// + explicit fractional raster-coverage diagram. SVG is the reproducible source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadVeyra, readJson, LAB } from '../src/lib/veyra.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.LR01_OUT ? path.resolve(process.env.LR01_OUT) : path.resolve(HERE, '../output');
fs.mkdirSync(path.join(OUT, 'views'), { recursive: true });
const V = loadVeyra();
const A = readJson(path.join(OUT, 'scale_corrected.v1.json'));
const PG = readJson(path.join(OUT, 'poi_geometry.v1.json'));

const W = 1900, H = 1120;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const out = [];
const P = s => out.push(s);
P(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-monospace,Menlo,Consolas,monospace">`);
P(`<rect width="${W}" height="${H}" fill="#0f1620"/>`);
P(`<text x="26" y="36" fill="#e8eef5" font-size="23" font-weight="700">MAP-LR01 / A — CORRECTED PER-POI GEOMETRY &amp; SCALE</text>`);
P(`<text x="26" y="60" fill="#93a6b8" font-size="13">Canonical Veyra GOLD ${V.fingerprint.sha256.slice(0, 16)}… · full 2000×1400 authoring frame · runtime scale UNDECIDED · diagnostic only</text>`);

// ---------- panel 1: all 81 POI footprints at true relative scale ----------
const px0 = 26, py0 = 86, pw = 900, ph = 630;
P(`<rect x="${px0}" y="${py0}" width="${pw}" height="${ph}" fill="#16202c" stroke="#2a3a4a"/>`);
P(`<text x="${px0 + 12}" y="${py0 + 22}" fill="#cfe0ef" font-size="14" font-weight="700">ALL 81 POI FOOT QUADS · true authoring coordinates (no rescale)</text>`);
const sx = pw / 2000, sy = ph / 1400;
const X = x => px0 + x * sx, Y = y => py0 + y * sy;
// land outlines
for (const l of V.P.land) {
  for (let ri = 0; ri < l.rings.length; ri++) {
    const ring = l.rings[ri];
    P(`<polygon points="${ring.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="${ri === 0 ? '#22384a' : '#16202c'}" fill-opacity="${ri === 0 ? 0.55 : 0.85}" stroke="#3d627e" stroke-width="1"/>`);
  }
}
for (const l of V.P.lakes) P(`<polygon points="${l.ring.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="#1c4e6b" stroke="#397ea3" stroke-width="0.8"/>`);
// roads
for (const r of V.P.roads) {
  if (!r.points) continue;
  const col = r.kind === 'cart' ? '#7a6a52' : '#4a5460';
  P(`<polyline points="${r.points.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="${r.kind === 'cart' ? 1.3 : 0.8}" opacity="0.85"/>`);
}
// rivers
for (const r of V.P.rivers) {
  if (!r.points) continue;
  P(`<polyline points="${r.points.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="#2f8fbd" stroke-width="${Math.max(1.2, r.width * sx)}" opacity="0.9"/>`);
}
// POI quads, each with its OWN geometry
for (const g of PG.pois) {
  const foot = V.P.pois.find(p => p.id === g.id).foot;
  const col = g.enclosure.startsWith('ENCLOSED') ? '#e9a15c' : '#57c98a';
  P(`<polygon points="${foot.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="${col}" fill-opacity="0.52" stroke="${col}" stroke-width="0.9"/>`);
  if (g.deep) {
    const deep = V.P.pois.find(p => p.id === g.id).deep;
    P(`<polygon points="${deep.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="#ffd9a0" stroke-width="0.8" stroke-dasharray="2,1.5"/>`);
  }
}
P(`<text x="${px0 + 12}" y="${py0 + ph - 34}" fill="#e9a15c" font-size="12">■ ENCLOSED (38: 18 multi-layer + 20 single)</text>`);
P(`<text x="${px0 + 12}" y="${py0 + ph - 16}" fill="#57c98a" font-size="12">■ OPEN-AIR YARD (43) — judged on yard, not a room</text>`);
P(`<text x="${px0 + pw - 10}" y="${py0 + ph - 12}" fill="#7f94a7" font-size="11" text-anchor="end">dashed = canonical deep polygon · derived classification, NOT canonical</text>`);

// ---------- panel 2: corrected fit curves ----------
const cx0 = 950, cy0 = 86, cw = 924, ch = 340;
P(`<rect x="${cx0}" y="${cy0}" width="${cw}" height="${ch}" fill="#16202c" stroke="#2a3a4a"/>`);
P(`<text x="${cx0 + 12}" y="${cy0 + 22}" fill="#cfe0ef" font-size="14" font-weight="700">CORRECTED FIT — per-POI own quad/deep/edges (SCALE-01A global-11au defect removed)</text>`);
const gx = u => cx0 + 50 + (Math.log(u / 1) / Math.log(8)) * (cw - 90);
const gy = v => cy0 + 60 + (1 - v) * (ch - 105);
for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  P(`<line x1="${cx0 + 50}" y1="${gy(t)}" x2="${cx0 + cw - 40}" y2="${gy(t)}" stroke="#28394a" stroke-width="1"/>`);
  P(`<text x="${cx0 + 44}" y="${gy(t) + 4}" fill="#7f94a7" font-size="10" text-anchor="end">${Math.round(t * 100)}%</text>`);
}
for (const u of [1, 1.5, 1.68, 2, 2.25, 3, 4, 8]) P(`<text x="${gx(u)}" y="${cy0 + ch - 22}" fill="#7f94a7" font-size="9" text-anchor="middle">${u}</text>`);
P(`<text x="${cx0 + cw / 2}" y="${cy0 + ch - 6}" fill="#93a6b8" font-size="10" text-anchor="middle">U = authoring units per runtime tile (log axis) · shaded band = physically viable among tested candidates</text>`);
if (A.boundedBand) {
  const x1 = gx(A.boundedBand.min), x2 = gx(A.boundedBand.max);
  P(`<rect x="${x1}" y="${cy0 + 60}" width="${x2 - x1}" height="${ch - 105}" fill="#3d7a58" opacity="0.14"/>`);
  P(`<text x="${(x1 + x2) / 2}" y="${cy0 + 78}" fill="#7fd6a2" font-size="11" text-anchor="middle">BOUNDED BAND ${A.boundedBand.min}–${A.boundedBand.max} (NOT a single approved scale)</text>`);
}
const curve = (key, color) => {
  const pts = A.profiles.map(p => `${gx(p.U).toFixed(1)},${gy(key(p)).toFixed(1)}`).join(' ');
  P(`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.4"/>`);
  for (const p of A.profiles) P(`<circle cx="${gx(p.U)}" cy="${gy(key(p))}" r="3" fill="${color}"/>`);
};
curve(p => p.physicalFit.enclosedFitRate, '#e9a15c');
curve(p => p.physicalFit.openAirFitRate, '#57c98a');
curve(p => p.perPoi.proposedEntranceLostCount === 0 ? 1 : 0, '#d76a7a');
P(`<rect x="${cx0 + cw - 352}" y="${cy0 + 30}" width="342" height="52" fill="#16202c" opacity="0.94" stroke="#2a3a4a"/>`);
P(`<text x="${cx0 + cw - 20}" y="${cy0 + 46}" fill="#e9a15c" font-size="10" text-anchor="end">— enclosed room + entrance capacity</text>`);
P(`<text x="${cx0 + cw - 20}" y="${cy0 + 61}" fill="#57c98a" font-size="10" text-anchor="end">— open-air 3×3 yard envelope</text>`);
P(`<text x="${cx0 + cw - 20}" y="${cy0 + 76}" fill="#d76a7a" font-size="10" text-anchor="end">— PROPOSED 3.696au opening survives</text>`);

// ---------- panel 3: transform / raster coverage table ----------
const tx0 = 950, ty0 = 446, tw = 924, th = 270;
P(`<rect x="${tx0}" y="${ty0}" width="${tw}" height="${th}" fill="#16202c" stroke="#2a3a4a"/>`);
P(`<text x="${tx0 + 12}" y="${ty0 + 22}" fill="#cfe0ef" font-size="14" font-weight="700">EXPLICIT TRANSFORM &amp; RASTER COVERAGE · 250×175 × 8au source cells</text>`);
const cols = ['U', 'world tiles', 'partial edge tiles', '8au cells needing resample', 'tile straddles', 'memory MB lower', 'RT-1 route s'];
const colX = [tx0 + 14, tx0 + 74, tx0 + 214, tx0 + 364, tx0 + 584, tx0 + 712, tx0 + 838];
P(`<text x="${colX[0]}" y="${ty0 + 44}" fill="#93a6b8" font-size="10">${cols.map((c, i) => `<tspan x="${colX[i]}">${esc(c)}</tspan>`).join('')}</text>`);
let yy = ty0 + 62;
for (const p of A.profiles) {
  const frac = p.transform.fractionalEdge;
  P(`<rect x="${tx0 + 8}" y="${yy - 11}" width="${tw - 16}" height="15" fill="${frac ? '#243447' : '#1b2835'}" opacity="${frac ? 0.75 : 0.4}"/>`);
  const vals = [
    String(p.U),
    `${p.transform.worldTilesExact[0]}×${p.transform.worldTilesExact[1]}`,
    String(p.transform.coverage.partialEdgeTileCount),
    String(p.transform.raster.fractionalSourceCellsRequiringResampling),
    String(p.transform.raster.runtimeTileColumnsRowsStraddlingSourceCellBoundary),
    String(p.memory.totalMBLowerBound),
    String(p.travel.rt1.geographicRouteSeconds),
  ];
  P(`<text y="${yy}" fill="${frac ? '#cfe0ef' : '#9fb2c3'}" font-size="10">${vals.map((v, i) => `<tspan x="${colX[i]}">${esc(v)}</tspan>`).join('')}</text>`);
  yy += 15;
}
P(`<text x="${tx0 + 12}" y="${ty0 + th - 10}" fill="#7f94a7" font-size="10">Blue rows = fractional world dimensions. Even U=2.5 divides the FRAME evenly, yet 8/2.5 is fractional so all 43,750 source cells need a resampling rule.</text>`);

// ---------- panel 4: per-POI edge distribution (the defect) ----------
const dx0 = 26, dy0 = 736, dw = 900, dh = 358;
P(`<rect x="${dx0}" y="${dy0}" width="${dw}" height="${dh}" fill="#16202c" stroke="#2a3a4a"/>`);
P(`<text x="${dx0 + 12}" y="${dy0 + 22}" fill="#cfe0ef" font-size="14" font-weight="700">THE DEFECT: SCALE-01A applied the GLOBAL 11au minimum edge to all 81 POIs</text>`);
const hist = {};
for (const g of PG.pois) { const k = g.foot.minEdgeAu; hist[k] = (hist[k] || 0) + 1; }
const keys = Object.keys(hist).map(Number).sort((a, b) => a - b);
const bx = i => dx0 + 56 + i * (dw - 100) / keys.length;
const bw = (dw - 100) / keys.length - 6;
const maxN = Math.max(...Object.values(hist));
for (let i = 0; i < keys.length; i++) {
  const k = keys[i], n = hist[k], h = (n / maxN) * (dh - 100);
  const col = k === 11 ? '#d76a7a' : '#4b90c4';
  P(`<rect x="${bx(i)}" y="${dy0 + dh - 54 - h}" width="${bw}" height="${h}" fill="${col}" opacity="0.85"/>`);
  P(`<text x="${bx(i) + bw / 2}" y="${dy0 + dh - 58 - h}" fill="#cfe0ef" font-size="10" text-anchor="middle">${n}</text>`);
  P(`<text x="${bx(i) + bw / 2}" y="${dy0 + dh - 38}" fill="#93a6b8" font-size="9" text-anchor="middle">${k}</text>`);
}
P(`<text x="${dx0 + 12}" y="${dy0 + dh - 14}" fill="#7f94a7" font-size="10">x = each POI's OWN shortest foot edge (au) · y = number of POIs · red = only 4/81 actually own 11au · 13 distinct edge sizes</text>`);
P(`<text x="${dx0 + 12}" y="${dy0 + 48}" fill="#d76a7a" font-size="11">Prior SCALE-01A: poiFeetUnableToHostSmallestRoom = 81/81 at U=4 and U=8 (flat rule + global edge)</text>`);
P(`<text x="${dx0 + 12}" y="${dy0 + 66}" fill="#7fd6a2" font-size="11">Corrected: enclosed POIs only, own quad OBB &amp; deep polygon, open-air POIs judged on yards → U=4 fails 17/38 enclosed, U=8 fails 38/38</text>`);

// ---------- panel 5: uncertainty / no-claims ----------
const ux0 = 950, uy0 = 736, uw = 924, uh = 358;
P(`<rect x="${ux0}" y="${uy0}" width="${uw}" height="${uh}" fill="#16202c" stroke="#2a3a4a"/>`);
P(`<text x="${ux0 + 12}" y="${uy0 + 22}" fill="#cfe0ef" font-size="14" font-weight="700">UNCERTAINTY · NO PREMATURE CANON · NO PLAYABILITY CLAIM</text>`);
const notes = [
  '· Enclosure class is DERIVED from canonical depth/deep/gate/arche fields; not a canonical field.',
  '· Wall = 1 runtime tile and room ≥5×4 tiles are ASSUMPTIONS anchored to PR44 smallest building.',
  '· Canonical Veyra authors NO door openings. Entrance capacity here is each POI\'s own shortest-edge UPPER BOUND.',
  '· 3.696 au opening is a GEO-02 PROPOSED po_kilns example, NON-CANONICAL. At U≥3.696 it quantizes to 0 tiles.',
  '· U=2 is one member of a bounded diagnostic band, NOT canonized because it is an integer.',
  '· WW=WH=200, TILE=16, 1,000,000-cell economy cap and chunk-key stride are TEMPORARY engine constants.',
  '· 2000×1400 authoring frame is UNCHANGED; any runtime intake needs explicit FLOOR / CEIL / NONUNIFORM mode.',
  '· U<8 adds NO new authored detail: source raster is 8 au/cell; U>8 loses cells.',
  '· RT-1 contains kind=trail segments; loaded-cart times are modelled on a FOOT route, NOT cart-passable.',
  '· Memory is a LOWER-BOUND model, not a measured runtime heap. Chunk culling ≠ world streaming.',
  '· NO approved scale · NO canonical edit · NO runtime merge · NO Gameplay population · NO playable acceptance.',
];
let ny = uy0 + 48;
for (const n of notes) { P(`<text x="${ux0 + 14}" y="${ny}" fill="#a9bccd" font-size="11">${esc(n)}</text>`); ny += 25; }
P(`<text x="${ux0 + 14}" y="${uy0 + uh - 32}" fill="#7fd6a2" font-size="11" font-weight="700">Physical-fit evidence supports a BOUNDED BAND U ∈ [${A.boundedBand.min}, ${A.boundedBand.max}] among tested candidates.</text>`);
P(`<text x="${ux0 + 14}" y="${uy0 + uh - 14}" fill="#7fd6a2" font-size="11" font-weight="700">U=2 is one member, NOT canonized. Fractional transforms have explicit raster-coverage costs above.</text>`);
P(`</svg>`);
const svg = out.join('\n');
const svgPath = path.join(OUT, 'views/scale_corrected.svg');
fs.writeFileSync(svgPath, svg);
const htmlPath = path.join(OUT, 'views/scale_corrected.html');
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#0f1620}svg{display:block}</style></head><body>${svg}</body></html>`);
const require = createRequire(path.join(LAB, 'package.json'));
const puppeteer = require('puppeteer-core');
(async () => {
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
    await page.goto('file://' + htmlPath, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 300));
    const pngPath = path.join(OUT, 'views/scale_corrected.png');
    await page.screenshot({ path: pngPath, fullPage: true });
    console.log(`A_RENDER_OK ${svgPath} ${fs.statSync(svgPath).size}B png=${fs.statSync(pngPath).size}B errors=${JSON.stringify(errors)}`);
    if (errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error('A_RENDER_FAIL', e); process.exitCode = 1; });
