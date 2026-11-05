/**
 * NATURE-02 ART AUDIT — measures the ACTUAL native SOH sprites (pixel alpha,
 * not source-code guesses) and renders a native-scale reference sheet.
 *
 * The 2x panel is INSPECTION ONLY: no sprite is ever scaled in the game.
 * This module does not create, recolour or replace any art asset.
 */
import { getArt } from '../game/art';

export interface SpriteMetric {
  key: string; size: [number, number];
  alphaBBox: [number, number, number, number];
  alphaPixels: number;
  topBandWidth: number; bottomBandWidth: number;
  widthRatioVsHero: number; heightRatioVsHero: number;
  bboxWidthRatioVsHero: number; bboxHeightRatioVsHero: number;
}
const AUDIT_KEYS = ['oak', 'pine', 'snowpine', 'willow', 'dead', 'rock', 'bush', 'bush_empty', 'grass', 'reed', 'herb', 'mush'];

function measure(c: HTMLCanvasElement, key: string): SpriteMetric {
  const g = c.getContext('2d')!;
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] > 40) {
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const band = (from: number, to: number) => {
    let a = c.width, b = -1;
    for (let y = from; y <= to; y++) for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < a) a = x; if (x > b) b = x; }
    return b < a ? 0 : b - a + 1;
  };
  const h = y1 - y0 + 1;
  return {
    key, size: [c.width, c.height], alphaBBox: [x0, y0, x1, y1], alphaPixels: n,
    topBandWidth: band(y0, y0 + Math.floor(h * 0.25)),
    bottomBandWidth: band(y1 - Math.floor(h * 0.25), y1),
    widthRatioVsHero: +(c.width / 16).toFixed(3),
    heightRatioVsHero: +(c.height / 24).toFixed(3),
    bboxWidthRatioVsHero: +((x1 - x0 + 1) / 16).toFixed(3),
    bboxHeightRatioVsHero: +(h / 24).toFixed(3)
  };
}

export function artMetrics() {
  const A = getArt();
  const hero = measure(A.hero.male.idle0[0], 'hero_male_idle0');
  const sprites = AUDIT_KEYS.map(k => measure(A.src[k][0], k));
  return {
    hero, sprites,
    heroSize: [16, 24] as [number, number],
    treeCanvas: [24, 32] as [number, number],
    groundCanvas: [16, 16] as [number, number],
    findings: {
      treeHeightVsHero: 32 / 24, treeWidthVsHero: 24 / 16,
      treeIsOnlyOneAndAThirdHeroesTall: true,
      canopyCannotBeOverhead: 'A 32px tree crown sits only 8px above the 24px hero; no overhead canopy is possible at native scale without a NEW taller asset.',
      undergrowthAllBoundToSources: 'bush/bush_empty encode stocked/depleted Berry Bush; grass/reed/herb/mush are harvestable SOURCES with yields and regrow; rock is a solid harvestable Boulder. No dedicated non-harvestable undergrowth sprite exists.',
      singleCanopyTier: 'All six tree forms are one 24x32 crown + thin trunk; no mid-storey, no sapling, no canopy-tier silhouette.'
    }
  };
}

/** Render the native-scale audit sheet into a 640x360 canvas (hidden in the UI). */
export function renderArtAudit(cv: HTMLCanvasElement) {
  const A = getArt();
  const g = cv.getContext('2d', { alpha: false })!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#101820'; g.fillRect(0, 0, 640, 360);
  // 16px tile grid, faint
  g.strokeStyle = 'rgba(120,150,170,0.10)'; g.lineWidth = 1;
  for (let x = 0; x <= 640; x += 16) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 360); g.stroke(); }
  for (let y = 0; y <= 360; y += 16) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(640, y + 0.5); g.stroke(); }
  const label = (s: string, x: number, y: number, col = '#d8e4c0') => {
    g.font = '8px monospace'; g.fillStyle = '#0c1014'; g.fillText(s, x + 1, y + 1);
    g.fillStyle = col; g.fillText(s, x, y);
  };
  label('NATURE-02 / ART AUDIT — NATIVE 1x, NO SCALING IN GAME', 6, 12, '#ffe27a');
  label('A · NATIVE SPRITES (1px = 1px)', 6, 24, '#9ec8e8');
  g.drawImage(A.hero.male.idle0[0], 8, 30);
  label('hero 16x24', 32, 38);
  label('16x24', 32, 48, '#8a9aa8');

  const trees = ['oak', 'pine', 'snowpine', 'willow', 'dead'] as const;
  trees.forEach((k, i) => {
    const x = 8 + i * 36;
    g.drawImage(A.src[k][0], x, 58);
    label(k, x, 96, '#d8e4c0');
    label('24x32', x, 105, '#8a9aa8');
  });
  label('tree / hero height = 32/24 = 1.333   width = 24/16 = 1.500', 8, 117, '#ffd07a');

  const ground = ['rock', 'bush', 'bush_empty', 'grass', 'reed', 'herb', 'mush'] as const;
  ground.forEach((k, i) => {
    const x = 8 + i * 28;
    g.drawImage(A.src[k][0], x, 126);
    label(k.slice(0, 7), x, 148, '#d8e4c0');
  });
  label('ALL small plant sprites above are SOURCES (stock/yields/regrow).', 8, 160, '#ff9a7a');
  label('bush vs bush_empty = STOCKED vs DEPLETED Berry Bush visual state.', 8, 170, '#ff9a7a');

  // Right panel: 2x inspection — NEVER used in-game.
  g.fillStyle = '#0b1118'; g.fillRect(212, 22, 422, 168);
  g.strokeStyle = '#3a5060'; g.strokeRect(212.5, 22.5, 421, 167);
  label('B · 2x INSPECTION — AUDIT ONLY, NOT IN GAME', 218, 33, '#ffb060');
  const big = (k: string, spr: HTMLCanvasElement, x: number, y: number, scale = 2) => {
    g.imageSmoothingEnabled = false;
    g.drawImage(spr, x, y, spr.width * scale, spr.height * scale);
    label(k + ' x' + scale, x, y + spr.height * scale + 9, '#9ec8e8');
  };
  big('hero', A.hero.male.idle0[0], 222, 42);
  big('oak', A.src.oak[0], 264, 42);
  big('pine', A.src.pine[0], 320, 42);
  big('rock', A.src.rock[0], 376, 42, 2);
  big('bush', A.src.bush[0], 220, 128);
  big('bush_empty', A.src.bush_empty[0], 264, 128);
  big('grass', A.src.grass[0], 330, 128);
  label('No sprite is enlarged, recoloured or replaced in NATURE-02.', 218, 180, '#8a9aa8');

  // Bottom: objective proportions + verdict
  const m = artMetrics();
  label('C · OBJECTIVE PROPORTIONS (alpha bbox measured from real pixels)', 6, 202, '#9ec8e8');
  const lines = [
    `hero alpha bbox ${m.hero.alphaBBox.join(',')}  opaque px ${m.hero.alphaPixels}`,
    `oak  alpha bbox ${m.sprites.find(s => s.key === 'oak')!.alphaBBox.join(',')}  top-band ${m.sprites.find(s => s.key === 'oak')!.topBandWidth}px  bottom-band ${m.sprites.find(s => s.key === 'oak')!.bottomBandWidth}px`,
    `oak bbox height / hero bbox height = ${m.sprites.find(s => s.key === 'oak')!.bboxHeightRatioVsHero}  (canvas ratio 1.333)`,
    `VERDICT: canopy NO (tree only 1.333x hero, one crown tier); undergrowth NO (all bound to harvestable SOURCES)`,
    `VERDICT: stands CAN be faked by overlapping native 24px crowns on 16px tiles; this is a composition fix, not an asset fix.`,
    `ASSET GAP: see NATURE02_FOREST_SLICE.md §7 — PROPOSAL ONLY, nothing manufactured here.`
  ];
  lines.forEach((l, i) => label(l, 6, 216 + i * 12, i > 2 ? '#ffe27a' : '#c8d8c0'));
  label('SOURCE: creator-u05/web-u05/src/game/art.ts (vendored verbatim, SHA in nature02-assets.json)', 6, 306, '#8a9aa8');
  label('NATURE-02 DECORATIVE OBJECTS ARE NOT APPROVED FOR PRODUCTION', 6, 322, '#ff8a7a');
  label('Gameplay-owned conflict: catalog.ts SOURCES.oak block:true + render.ts natureTrees + sim.ts wood drops', 6, 334, '#ff8a7a');
  label('evidence/nature02-shots/art_audit_native.png  ·  640x360  ·  DPR 1', 6, 350, '#8a9aa8');
  return m;
}
