// MAP-LR02 M4 — visual world production in the ESTABLISHED Web visual language.
//
// NOT a new game, NOT an independent flat-map renderer, NOT invented art.
//   1. Real 640x360 Web screenshots are preserved byte-for-byte with provenance.
//   2. A PORTABLE LR02 static-architecture art layer is built from M1 clipped
//      solids/openings, painted with the exact Web render.ts T.PWALL palette,
//      pixel-snapped, hard-edged, with door jambs at real static openings.
//   3. Genuine 640x360 before/after pairs are produced and classified.
//   4. Actual Web-rendered integration proof is explicitly NOT AVAILABLE.
//
// No external sprites, no noisy procedural grass, no generic polygon fill, no
// decorative debug overlay, no landmark substitution, no invented roof/canopy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { OUT, LR01, ROOT, readJson, sha256, r4 } from './lib/lr02.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.resolve(HERE, '../..');
const VDIR = path.join(OUT, 'visual');
const EVID = path.join(VDIR, 'web_evidence');
const LAYERS = path.join(VDIR, 'layers');
const COMP = path.join(VDIR, 'comparisons');
const SCRATCH = path.join('/tmp', 'lr02_m4_html');
for (const d of [VDIR, EVID, LAYERS, COMP, SCRATCH]) fs.mkdirSync(d, { recursive: true });

const W = 640, H = 360;
const GAMEPLAY_HEAD = '240db32a1a69211f87af161796498b82afcde20e';
const GAMEPLAY_EVIDENCE = 'web/evidence/veyra-lr02';
const WEB_ART_SOURCE = 'web/src/game/art.ts + web/src/game/render.ts';

const pg = readJson(path.join(OUT, 'portal_geometry.v1.json'));
const views = readJson(path.join(LR01, 'output/views_index.v1.json'));
const artManifest = readJson(path.join(LR01, 'output/art_manifest.v1.json'));
const afterViews = views.views.filter(v => v.mode === 'after');

// Exact terrain palette entries read from GAMEPLAY HEAD render.ts (read-only).
// These are the colours of an existing Web T.PWALL / T.FLOOR / shoreline; using
// them keeps the new layer inside the retained SOH Web identity.
const WEB_PAL = {
  source: `${WEB_ART_SOURCE}@${GAMEPLAY_HEAD}`,
  'T.PWALL': ['#4a4048', '#544a52', '#2e2830', '#6a5e66', '#7a5a4a'],
  'T.FLOOR': ['#9a6a3e', '#8a5e36', '#5a3a22', '#b0804a', '#7a7a7e'],
  'T.BRIDGE': ['#8a6038', '#7a5430', '#4a2e1a', '#a87a4a', '#3a2414'],
  'T.DEEP': ['#1e3c6a', '#22426e', '#183058', '#2a5288', '#3a6aa0'],
  'T.RIVER': ['#3478a8', '#3a80ae', '#2a6a9a', '#56a0c8', '#3a82a8'],
  shoreGlint: 'rgba(235,248,255,0.85)',
  waveSparkle: 'rgba(220,240,255,0.7)',
  note: 'Verified from render.ts PAL / SURFC / draw() at the named Gameplay HEAD. No third-party sprite or tile is used (web/THIRD_PARTY.md: "No third-party sprites, tiles or sound files are used").',
};

const REAL_WEB_FILES = [
  'select-veyra-greywater-u16-640.png', 'start-veyra-greywater-u16-640.png', 'walk-veyra-greywater-u16-640.png',
  'select-veyra-greywater-u20-640.png', 'start-veyra-greywater-u20-640.png', 'walk-veyra-greywater-u20-640.png',
];

// Copy the real Web screenshots from the Gameplay HEAD using git show (no
// cross-branch checkout, no modification). They are unmodified bytes.
const { execFileSync } = await import('node:child_process');
const webEvidence = [];
for (const f of REAL_WEB_FILES) {
  const src = `${GAMEPLAY_HEAD}:${GAMEPLAY_EVIDENCE}/${f}`;
  const buf = execFileSync('git', ['show', src], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (w !== W || h !== H) throw new Error(`REAL_WEB_SCREENSHOT_NOT_640x360 ${f} ${w}x${h}`);
  fs.writeFileSync(path.join(EVID, f), buf);
  webEvidence.push({ file: `output/visual/web_evidence/${f}`, source: src, width: w, height: h, bytes: buf.length, sha256: sha256(buf), classification: 'REAL_WEB_SCREENSHOT', note: 'Unmodified bytes from Gameplay HEAD. NOT a Map render, NOT integration proof.' });
}

// ---- portable LR02 static-architecture art layer -------------------------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inWindow(p, win) {
  const m = 24;
  return p[0] >= win.x0 - m && p[0] <= win.x0 + win.wAu + m && p[1] >= win.y0 - m && p[1] <= win.y0 + win.hAu + m;
}
function buildLayer(win) {
  const X = x => (x - win.x0) * win.pxPerAu;
  const Y = y => (y - win.y0) * win.pxPerAu;
  const o = [];
  const S = s => o.push(s);
  S(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">`);
  S(`<!-- MAP-LR02 LR02_STATIC_ARCHITECTURE: portable art layer. Transparent background. -->`);
  let solids = 0, openings = 0, poiCount = 0;
  for (const p of pg.pois) {
    const ss = p.staticSolids.filter(s => inWindow(s.aAu, win) || inWindow(s.bAu, win));
    if (!ss.length) continue;
    poiCount++;
    for (const s of ss) {
      solids++;
      const x1 = r4(X(s.aAu[0])), y1 = r4(Y(s.aAu[1])), x2 = r4(X(s.bAu[0])), y2 = r4(Y(s.bAu[1]));
      const thick = Math.max(2, Math.round((s.thicknessAu ?? 2) * win.pxPerAu));
      // 1px ground shadow (same depth language as Web shadow()).
      S(`<line x1="${x1}" y1="${y1 + 1}" x2="${x2}" y2="${y2 + 1}" stroke="#0a0814" stroke-opacity="0.34" stroke-width="${thick + 2}" stroke-linecap="butt"/>`);
      // dark outline, main wall body, 1px top highlight: Web T.PWALL ramp.
      S(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${WEB_PAL['T.PWALL'][2]}" stroke-width="${thick + 2}" stroke-linecap="butt"/>`);
      S(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${WEB_PAL['T.PWALL'][0]}" stroke-width="${thick}" stroke-linecap="butt"/>`);
      S(`<line x1="${x1}" y1="${y1 - Math.max(1, Math.floor(thick / 2))}" x2="${x2}" y2="${y2 - Math.max(1, Math.floor(thick / 2))}" stroke="${WEB_PAL['T.PWALL'][3]}" stroke-opacity="0.8" stroke-width="1" stroke-linecap="butt"/>`);
    }
    // Real static openings: absence of stroke, plus a 1px door jamb at each end.
    for (const q of p.staticOpenings) {
      if (!inWindow(q.aAu, win) && !inWindow(q.bAu, win)) continue;
      openings++;
      for (const [px, py] of [q.aAu, q.bAu]) {
        S(`<rect x="${r4(X(px[0]) - 1)}" y="${r4(Y(py[1]) - Math.max(1, Math.round((q.thicknessAu ?? 2) * win.pxPerAu) / 2) - 1)}" width="1" height="${Math.max(2, Math.round((q.thicknessAu ?? 2) * win.pxPerAu) + 2)}" fill="${WEB_PAL['T.PWALL'][4]}"/>`);
      }
    }
  }
  S(`</svg>`);
  return { svg: o.join('\n'), solids, openings, poiCount };
}

// LR01 E writes its own debug header band. Map M4 strips ONLY that band from
// its analytical baseline so no decorative debug overlay is shipped; terrain,
// transitions, wave motifs and authored roads are left untouched.
function cleanBaselineSvg(regionId) {
  const svgPath = path.join(LR01, 'output/views', `${regionId}_after_640x360.svg`);
  let svg = fs.readFileSync(svgPath, 'utf8');
  const before = svg;
  svg = svg.replace(/<rect x="0" y="0" width="640" height="16" fill="#080e18" opacity="0\.88"\/>\s*/g, '');
  svg = svg.replace(/<text x="6" y="11\.5"[^>]*>[^<]*<\/text>\s*/g, '');
  if (svg === before) throw new Error(`LR01_DEBUG_HEADER_NOT_FOUND ${regionId}`);
  return svg;
}
function page(svgBody, overlay = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:${W}px;height:${H}px;background:#080e18;overflow:hidden}
svg{position:absolute;left:0;top:0;width:${W}px;height:${H}px;display:block;shape-rendering:crispEdges}
</style></head><body>${svgBody}${overlay}</body></html>`;
}

const require = createRequire(path.join(LAB, 'package.json'));
const puppeteer = require('puppeteer-core');
const comparisons = [];
const layers = [];
let errors = [];

const browser = await puppeteer.launch({
  executablePath: '/tmp/chromium', headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib' },
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files', '--font-render-hinting=none'],
});
try {
  const p = await browser.newPage();
  await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  p.on('pageerror', e => errors.push(String(e)));
  for (const view of afterViews) {
    const regionId = view.regionId;
    const win = view.window;
    const { svg, solids, openings, poiCount } = buildLayer(win);
    const layerPath = path.join(LAYERS, `${regionId}_lr02_static_walls.svg`);
    fs.writeFileSync(layerPath, svg);
    const baseline = cleanBaselineSvg(regionId);
    const baselinePath = path.join(LAYERS, `${regionId}_clean_baseline.svg`);
    fs.writeFileSync(baselinePath, baseline);

    // BEFORE and AFTER are BOTH class (2) MAP_ONLY_ANALYTICAL_PREVIEW. This is a
    // controlled before/after of the NEW Map art layer, not a claim that a flat
    // diagnostic is a Web screenshot or a Web-rendered improvement.
    const beforeHtml = path.join(SCRATCH, `${regionId}_before.html`);
    fs.writeFileSync(beforeHtml, page(baseline));
    const beforePath = path.join(COMP, `${regionId}_before_640x360.png`);
    await p.goto('file://' + beforeHtml, { waitUntil: 'load', timeout: 30000 });
    await p.screenshot({ path: beforePath });
    const beforeBuf = fs.readFileSync(beforePath);
    if (beforeBuf.readUInt32BE(16) !== W || beforeBuf.readUInt32BE(20) !== H) throw new Error(`BEFORE_NOT_640x360 ${regionId}`);

    const afterHtml = path.join(SCRATCH, `${regionId}_after.html`);
    fs.writeFileSync(afterHtml, page(baseline, svg));
    const afterPath = path.join(COMP, `${regionId}_after_640x360.png`);
    await p.goto('file://' + afterHtml, { waitUntil: 'load', timeout: 30000 });
    await p.screenshot({ path: afterPath });
    const afterBuf = fs.readFileSync(afterPath);
    if (afterBuf.readUInt32BE(16) !== W || afterBuf.readUInt32BE(20) !== H) throw new Error(`AFTER_NOT_640x360 ${regionId}`);

    const before = {
      file: `output/visual/comparisons/${regionId}_before_640x360.png`,
      source: `world_lab/lr01/output/views/${regionId}_after_640x360.svg (LR01 debug header stripped)`,
      sha256: sha256(beforeBuf), bytes: beforeBuf.length,
    };
    const beforeClass = 'MAP_ONLY_ANALYTICAL_PREVIEW';

    layers.push({
      regionId, file: `output/visual/layers/${path.basename(layerPath)}`,
      svgSha256: sha256(fs.readFileSync(layerPath)), width: W, height: H,
      transparentBackground: true, pixelSnapped: true, shapeRendering: 'crispEdges',
      staticSolidsDrawn: solids, staticOpeningsDrawn: openings, poiCount,
      window: win, source: 'world_lab/lr02/output/portal_geometry.v1.json',
      authorityDigest: pg.revisionDigest,
      usage: 'Composite AFTER the Web terrain chunks + animated water/shore glints and BEFORE the ground-structure/roof/entity passes. Draw at integer pixels with imageSmoothingEnabled=false; never resample. Openings are ABSENCE of stroke; Gameplay draws dynamic door sprites (A.st.poi_door / poi_door_open) at the opening centre and owns lock/power/destruction state.',
    });
    comparisons.push({
      regionId, kind: regionId === 'zone_bz_greywater' ? 'GREYWATER' : 'DISTINCT_REGION',
      before: { ...before, classification: beforeClass, note: 'Retained LR01 Web-baseline-style analytical preview, debug header removed. NOT a Web screenshot.' },
      preservedWebVisualBaseline: regionId === 'zone_bz_greywater'
        ? { classification: 'REAL_WEB_SCREENSHOT', files: webEvidence.map(x => x.file), note: 'Unmodified 640x360 Web screenshots from the observed Gameplay HEAD. These are the visual quality baseline to PRESERVE; they are deliberately NOT used as a compositing canvas because camera/transform alignment is Gameplay-owned and unverified.' }
        : { classification: 'REAL_WEB_SCREENSHOT', status: 'NOT_AVAILABLE', reason: 'Gameplay evidence at the observed HEAD contains only Veyra Greywater windows. No real Web screenshot exists for this region; Map does not fabricate one.' },
      after: { file: `output/visual/comparisons/${regionId}_after_640x360.png`, sha256: sha256(afterBuf), bytes: afterBuf.length, classification: 'MAP_ONLY_ANALYTICAL_PREVIEW', note: `Same analytical baseline + LR02 static wall art layer (${solids} solids, ${openings} openings, ${poiCount} POIs). NOT rendered by the Web game, NOT a visual-acceptance claim.` },
      actualWebRenderedIntegrationProof: { classification: 'ACTUAL_WEB_RENDERED_INTEGRATION_PROOF', status: 'NOT_AVAILABLE__GAMEPLAY_OWNED', reason: 'No Web-rendered integration of the M4 portable static-wall layers or of M1/M3/M3b physical geometry exists. Gameplay HAS separately pinned M0 Greywater clipped solids and M2 cell sets in its own diagnostic LR02/Oasis layouts (web/src/game/veyra/lr02.ts, eligibility.ts, PR44 6620726633); that is Gameplay evidence, not a rendering of these Map layers. Map does not modify Gameplay code and never labels a Map preview as Web proof.' },
      nativeResolution: [W, H],
    });
  }
} finally { await browser.close(); }

const method = {
  schema: 'soh.map.lr02.visual_layers.v1', version: 1, revision: 1,
  generatedBy: 'world_lab/lr02/src/m4_visual.mjs',
  status: 'PRODUCTION_METHOD_AND_PORTABLE_ART_LAYERS__NOT_WEB_RENDERED_INTEGRATION_PROOF',
  nativeResolution: [W, H],
  parent: { lr01ViewsIndex: 'world_lab/lr01/output/views_index.v1.json', lr01ArtManifest: 'world_lab/lr01/output/art_manifest.v1.json', lr02PortalGeometry: 'world_lab/lr02/output/portal_geometry.v1.json', portalGeometryDigest: pg.revisionDigest, gameplayHeadObserved: GAMEPLAY_HEAD },
  gameplayOwnIntegrationObserved: { head: 'bfbf44df9ebf403290dce45ff197327947762e8e', pr44Comment: 6620726633, files: ['web/src/game/veyra/lr02.ts', 'web/src/game/veyra/eligibility.ts', 'web/src/game/veyra/projection.ts'], status: 'SEPARATELY_VERSIONED_DIAGNOSTIC_LAYOUTS__GAMEPLAY_OWNED', note: 'Gameplay pins M0 raw/body SHA and M2 raw/body SHA and projects M0 clipped solids to T.PWALL tile centres in its own diagnostic layouts. This is NOT an integration of the M4 portable SVG layers or M1/M3/M3b geometry, and it is not creator visual approval.' },
  sourceArtAssessment: {
    primary: { file: WEB_ART_SOURCE, head: GAMEPLAY_HEAD, finding: 'All sprites, tile textures, icons and VFX are ORIGINAL pixel art painted pixel-by-pixel at boot; web/THIRD_PARTY.md states no third-party sprites/tiles/sounds are used.', disposition: 'RETAIN' },
    lr01MilestoneE: { decision: 'Web baseline kept; web_art_patch REJECT; A1/MAP-R01 art REFERENCE_ONLY; NO_EXTERNAL_ART_USED', disposition: 'RETAIN' },
    assessedBeforeReplacement: [
      { item: 'assets/environment/cainos_demo/THIRD_PARTY.md', disposition: 'NOT_ADOPTED' },
      { item: 'assets/environment/dungeon_0x72/THIRD_PARTY.md', disposition: 'NOT_ADOPTED' },
      { item: 'assets/environment/ocean_cainos/THIRD_PARTY.md', disposition: 'NOT_ADOPTED' },
      { item: 'web/THIRD_PARTY.md candidate list (NinjaAdventure, Kenney, simplex-noise, easystar, idb)', disposition: 'NOT_ADOPTED' },
    ],
    newExternalAssetsCreated: 0, replacedSprites: 0, replacedTiles: 0,
    note: 'No unverified sprite pack, no licensed atlas import, no GOLD 1024x768 bytes. The new layer reuses the existing Web palette and pixel-snap conventions only.',
  },
  webPalette: WEB_PAL,
  visualPreservationChecklist: {
    purpose: 'The attractive Web visuals are NOT redrawn, replaced or re-authored by Map. These are the exact primary-source locations Gameplay must retain while adding the LR02 static layer.',
    pixelTrees: { source: `${WEB_ART_SOURCE}@${GAMEPLAY_HEAD}`, location: 'art.ts buildSources/drawTree helpers + render.ts drawSource() (lines ~238-259), A.src.oak/pine/snowpine/palm/willow, deterministic per-source variants', action: 'RETAIN_VERBATIM' },
    terrainVariation: { source: 'render.ts texel() / PAL / fbm / hash2', location: 'lines ~24-68', action: 'RETAIN_VERBATIM' },
    oceanAndLargeWaveMotifs: { source: 'render.ts texel() case T.DEEP / T.SHALLOW', location: 'wv = Math.sin(wx*0.15 + Math.sin(wy*0.09)*2 + wy*0.05)', action: 'RETAIN_VERBATIM' },
    animatedShoreline: { source: 'render.ts draw()', location: 'wave = Math.sin(time/520 + tx*0.7 + ty*0.3); glint rgba(235,248,255,0.85); sparkle rgba(220,240,255,0.7)', action: 'RETAIN_IN_GAMEPLAY__NOT_SIMULATED_BY_MAP' },
    naturalTransitions: { source: 'render.ts renderChunk() / PRIO / texel()', location: 'neighbour-priority 4px fringe; ctx.sea<=1 sand darkening', action: 'RETAIN_VERBATIM' },
    native640x360: { source: 'core.ts VIEW_W/VIEW_H + art.ts mk()', location: 'imageSmoothingEnabled=false, TILE=16', action: 'RETAIN_VERBATIM' },
    sohIdentity: { source: 'web/THIRD_PARTY.md + art.ts', location: "OUT='#140c14' pixel outline, VT323/Pixelify Sans local fonts, original pixel art only", action: 'RETAIN_VERBATIM' },
  },
  visualLanguagePreserved: {
    pixelTreesAndTerrainVariation: 'Unmodified real Web screenshots (class 1) are preserved byte-for-byte as the quality baseline; the Web pixel trees are NOT re-authored by Map. Class-2 analytical previews keep the authored 12-code biome raster, hard-edged 1px transitions and authored roads. No new procedural grass.',
    oceanAndLargeWaveMotifs: 'Retained sparse large 3-cell wave motifs drawn ONLY where the next three cells are sea; no flat lake treated as ocean.',
    shoreGlints: 'Static previews keep the deterministic shore fringe; the Web runtime animated glint (render.ts draw() rgba(235,248,255,0.85) + rgba(220,240,255,0.7) sparkles) stays in Gameplay and is NOT simulated here.',
    naturalTransitions: 'PRIO-based neighbour fringe from ACTUAL neighbouring biome codes, not random noise.',
    nativePixelReadability: `All before/after files are exactly ${W}x${H}, integer px, shape-rendering=crispEdges, image-rendering=pixelated, no antialias/resample.`,
    sohIdentity: 'Web T.PWALL / T.FLOOR palette, door jamb colour from T.PWALL[4], existing Web shadow/depth convention.',
  },
  layerOrder: [
    { z: 1, name: 'terrain_chunks', owner: 'GAMEPLAY', source: 'render.ts getChunk/renderChunk' },
    { z: 2, name: 'animated_water_lava_and_shore_glints', owner: 'GAMEPLAY', source: 'render.ts draw()' },
    { z: 3, name: 'footprints', owner: 'GAMEPLAY', source: 'render.ts draw()' },
    { z: 4, name: 'lr02_static_architecture', owner: 'MAP_DATA__GAMEPLAY_DRAWS', source: 'output/visual/layers/*_lr02_static_walls.svg', note: 'NEW. Clipped solid spans + real static openings. Proposed placement: after footprints, before ground structures so roofs/entities sort correctly.' },
    { z: 5, name: 'ground_layer_structures_and_hazards', owner: 'GAMEPLAY', source: 'render.ts draw()' },
    { z: 6, name: 'buildings_and_roofs', owner: 'GAMEPLAY', source: 'render.ts draw()' },
    { z: 7, name: 'entities_and_actors', owner: 'GAMEPLAY', source: 'render.ts draw()' },
    { z: 8, name: 'dynamic_doors_locks_power_destruction', owner: 'GAMEPLAY', source: 'A.st.poi_door / poi_door_open at opening centres', status: 'UNKNOWN' },
    { z: 9, name: 'hud', owner: 'GAMEPLAY', source: 'render.ts + UI' },
  ],
  integrationInstructions: [
    'Read portal_geometry.v1.json at its pinned revisionDigest; do not read a preview PNG as geometry.',
    'For each staticSolid draw a pixel-snapped hard-edged wall segment at integer Web pixels using the existing T.PWALL ramp; blocksMovement/blocksSight come from the package, not from the picture.',
    'Do NOT draw a stroke inside any staticOpening interval. Openings are static holes; Gameplay owns doorState/lockedState/powerRequirement/destruction.',
    'Keep imageSmoothingEnabled=false; never scale the layer with smoothing; keep 640x360 native readability.',
    'Eligibility cellIndices are NOT a visual layer. Do not tint cells, draw grids, arrows, labels or any decorative debug overlay.',
    'Roof/canopy polygons remain UNRESOLVED; do not substitute a room polygon or landmark for a roof.',
  ],
  layerCount: layers.length,
  layers,
  comparisonCount: comparisons.length,
  comparisons,
  webEvidenceCount: webEvidence.length,
  webEvidence,
  qualityGates: {
    realWebScreenshotsPreserved: webEvidence.length === 6 && webEvidence.every(x => x.width === W && x.height === H),
    allComparisonsNative: comparisons.every(c => c.nativeResolution[0] === W && c.nativeResolution[1] === H),
    allComparisonsSameClass: comparisons.every(c => c.before.classification === 'MAP_ONLY_ANALYTICAL_PREVIEW' && c.after.classification === 'MAP_ONLY_ANALYTICAL_PREVIEW'),
    noClass1FabricatedForOtherRegions: comparisons.filter(c => c.kind === 'DISTINCT_REGION').every(c => c.preservedWebVisualBaseline.status === 'NOT_AVAILABLE'),
    noClass2LabelledAsClass3: comparisons.every(c => c.actualWebRenderedIntegrationProof.status === 'NOT_AVAILABLE__GAMEPLAY_OWNED'),
    debugHeaderRemoved: true,
    noExternalArt: true,
    noInventedCanopy: true,
    noProceduralGrass: true,
    noDecorativeDebugOverlay: true,
    browserErrors: errors,
  },
  noClaims: [
    'NO playable Veyra or final world', 'NO creator visual approval',
    'NO Web-rendered integration proof', 'NO approved au-to-tile/px scale',
    'NO animated shoreline simulated in Map previews', 'NO third-party or unverified art pack',
    'NO invented roof/canopy polygon', 'NO dynamic door, lock, power or destruction',
  ],
};

fs.writeFileSync(path.join(VDIR, 'visual_layers.v1.json'), JSON.stringify(method, null, 2) + '\n');
console.log(`M4_VISUAL_OK webEvidence=${webEvidence.length} regions=${layers.length} layers=${layers.length} comparisons=${comparisons.length} size=${W}x${H}`);
for (const l of layers) console.log(`  ${l.regionId.padEnd(22)} solids=${l.staticSolidsDrawn} openings=${l.staticOpeningsDrawn} pois=${l.poiCount}`);
console.log(`  browserErrors=${JSON.stringify(errors)} class1Preserved=${webEvidence.length} class2BeforeAfter=${comparisons.length} class3=NOT_AVAILABLE debugHeaderRemoved=true`);
if (errors.length) process.exitCode = 1;
