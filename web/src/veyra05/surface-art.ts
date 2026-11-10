/**
 * VEYRA05 SEAMLESS WORLD-SPACE SURFACE & DECK PAINTERS
 *
 * Replaces repeating 16×16 box-grid tiles with continuous world-pixel textures:
 *   - Planks stagger seamlessly across tile borders with knots, nail heads & moisture.
 *   - Flagstones & cobbles follow continuous running-bond / Voronoi joints in world px.
 *   - Quarry terraces, salt evaporation pans, filter basins, rail spurs, and forest loam
 *     express real physical function & biome ecology.
 *   - Exterior edges (`edgeMask`: N=1, S=2, W=4, E=8) render raised pilings over water,
 *     beveled stone curbs, splintered broken ends (Drowned Pier), or upper-level railings.
 */
import { hash2 } from '../game/core';

export interface SurfacePaintOpts {
  id: string;        // e.g. 'po_falls.sluice_apron' or 'po_glade.woodland_path'
  poi?: string;      // e.g. 'po_falls'
  level?: number;    // -1, 0, 1, 2
  mat?: string;      // 'wood' | 'stone' | 'brick'
  open?: boolean;
  carve?: boolean;
  hazard?: boolean;
  overWater?: boolean;
  edges: number;     // bitmask: 1=N open edge, 2=S open edge, 4=W open edge, 8=E open edge
}

type RGB = readonly [number, number, number];
const H = (s: string): RGB => {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const C = (r: number, g: number, b: number) => `rgb(${r | 0},${g | 0},${b | 0})`;

// Pre-parsed cohesive palettes
const P_TIMBER_WARM = ['#2e1b10', '#54341e', '#784c2b', '#94623a', '#b88350'].map(H);
const P_TIMBER_WEATH = ['#242220', '#48423a', '#685e50', '#847864', '#a4967e'].map(H);
const P_TIMBER_DRIFT = ['#22282a', '#3e484a', '#5a6666', '#768482', '#9aa6a0'].map(H);
const P_TIMBER_HULL = ['#22150e', '#402719', '#5c3823', '#784b2e', '#996540'].map(H);
const P_STONE_WARM = ['#2f2c32', '#524e52', '#706c6c', '#8c8680', '#ada496'].map(H);
const P_STONE_SLATE = ['#222730', '#3d4552', '#566170', '#707e8c', '#94a2ae'].map(H);
const P_STONE_SALT = ['#48525a', '#7c878a', '#aab2ac', '#cfd2c4', '#ecead8'].map(H);
const P_STONE_ASH = ['#1e1b1f', '#353036', '#4c454a', '#665d60', '#887c7c'].map(H);
const P_STONE_SAND = ['#4f3d28', '#866946', '#b08e60', '#ceb07c', '#e8cfa0'].map(H);
const P_STONE_OBS = ['#12121a', '#212232', '#32364c', '#4c5c7a', '#8ab4cf'].map(H);
const P_STEEL_DECK = ['#1b2028', '#2f3844', '#465260', '#647482', '#92a4b2'].map(H);
const P_BRICK_KILN = ['#2c1616', '#562922', '#7c3c30', '#9c523c', '#bf7454'].map(H);
const P_FOREST_LOAM = ['#24301c', '#3c482a', '#565c36', '#726c44', '#8e8458'].map(H);
const P_SALT_PAN = ['#2b5470', '#407c98', '#78b0ba', '#cedcd4', '#f4f6ea'].map(H);

/** World-space staggered plank surface (never repeats on 16px seams). */
function texPlank(wx: number, wy: number, pal: RGB[], vertical = false, broken = false): RGB {
  const u = vertical ? wy : wx;
  const v = vertical ? wx : wy;
  const plankH = 5;
  const row = Math.floor(v / plankH);
  const inRow = ((v % plankH) + plankH) % plankH;
  const rowShift = ((hash2(row, 11, 7) * 23) | 0);
  const segLen = 22 + ((hash2(row, 19, 3) * 14) | 0);
  const segIdx = Math.floor((u + rowShift) / segLen);
  const inSeg = (((u + rowShift) % segLen) + segLen) % segLen;

  // Gap between planks
  if (inRow === plankH - 1 || inSeg === 0) return pal[0];
  // Broken / missing plank sections on derelict piers
  if (broken && hash2(segIdx, row, 91) < 0.14 && inSeg > 2 && inSeg < segLen - 3) {
    return inRow === 0 ? pal[0] : pal[1];
  }
  const plankTone = hash2(segIdx, row, 17);
  let idx = plankTone < 0.25 ? 1 : plankTone < 0.72 ? 2 : 3;
  // Top edge bevel highlight on upper pixel of plank
  if (inRow === 0 && hash2(u >> 1, row, 29) > 0.28) idx = Math.min(4, idx + 1);
  // Subtle longitudinal wood grain streak
  if (inRow === 2 && hash2(u >> 2, row, 43) < 0.24) idx = Math.max(1, idx - 1);
  // Twin iron nail heads near plank butt joint
  if (inSeg === 2 && (inRow === 1 || inRow === 3)) return pal[0];
  if (inSeg === segLen - 2 && (inRow === 1 || inRow === 3)) return pal[0];
  return pal[idx];
}

/** World-space dressed flagstone / cobble masonry (continuous across tile seams). */
function texFlagstone(wx: number, wy: number, pal: RGB[], style: 'ashlar' | 'cobble' | 'strata' | 'obsidian', moss = 0, accentCol?: RGB, accentRate = 0): RGB {
  if (style === 'strata') {
    // Stepped angular geological quarry ledges & horizontal cleavage blocks (no ramen waves)
    const row = Math.floor(wy / 12);
    const stepShift = ((hash2(row, 3, 19) * 5) | 0) - 2;
    const bx = Math.floor((wx + row * 5) / 18);
    const ix = (((wx + row * 5) % 18) + 18) % 18;
    const iy = (((wy + (bx & 1) * 2 + stepShift) % 12) + 12) % 12;
    if (iy === 11 || (ix === 0 && (iy < 5 || iy > 7))) return pal[0];
    if (iy === 0) return pal[3];
    const blockTone = hash2(bx, row, 31);
    let idx = blockTone < 0.24 ? 1 : blockTone < 0.8 ? 2 : 3;
    // Calm negative space with occasional stratified grain cluster
    if (hash2(wx >> 2, wy >> 1, 41) > 0.88 && iy > 2 && iy < 9) idx = Math.max(1, idx - 1);
    if (accentCol && hash2(wx >> 1, wy >> 1, 73) < accentRate && iy > 3 && iy < 8) return accentCol;
    return pal[idx];
  }
  if (style === 'obsidian') {
    // Sharp angular volcanic glass cleavage polygons (straight facets, razor specular edges)
    const cellX = Math.floor((wx + (wy >> 1)) / 14);
    const cellY = Math.floor((wy - (wx >> 2)) / 12);
    const fx = (((wx + (wy >> 1)) % 14) + 14) % 14;
    const fy = (((wy - (wx >> 2)) % 12) + 12) % 12;
    if (fx === 0 || fy === 0) return pal[0];
    if ((fx === 1 && fy < 8) || (fy === 1 && fx < 9)) return pal[4]; // crisp conchoidal glass glint
    const t = hash2(cellX, cellY, 61);
    return pal[t < 0.35 ? 1 : t < 0.8 ? 2 : 3];
  }
  if (style === 'cobble') {
    const row = Math.floor(wy / 6);
    const iy = ((wy % 6) + 6) % 6;
    const w = 7 + (row & 1);
    const shift = (row % 2) * 4 + ((hash2(row, 3, 5) * 3) | 0);
    const col = Math.floor((wx + shift) / w);
    const ix = (((wx + shift) % w) + w) % w;
    if (iy === 5 || ix === 0) {
      if (moss > 0 && hash2(wx >> 1, wy >> 1, 88) < moss) return H('#487d32');
      return pal[0];
    }
    const tone = hash2(col, row, 19);
    let idx = tone < 0.25 ? 1 : tone < 0.78 ? 2 : 3;
    if (iy === 0 && ix > 0 && ix < w - 1) idx = Math.min(4, idx + 1);
    if (accentCol && hash2(wx >> 1, wy >> 1, 53) < accentRate) return accentCol;
    return pal[idx];
  }
  // Ashlar flagstones: larger irregular slabs (12–17px wide × 8px high) with natural L-cracks
  const slabH = 8;
  const row = Math.floor(wy / slabH);
  const iy = ((wy % slabH) + slabH) % slabH;
  const slabW = 12 + ((hash2(row, 7, 13) * 6) | 0);
  const shift = (row & 1) * 7;
  const col = Math.floor((wx + shift) / slabW);
  const ix = (((wx + shift) % slabW) + slabW) % slabW;
  const ch = hash2(col, row, 41);
  const crack = ch > 0.78 && ((ix === (slabW >> 1) && iy >= 3 && iy <= 5) || (iy === 5 && ix >= (slabW >> 1) && ix <= (slabW >> 1) + 2));
  if (iy === slabH - 1 || ix === 0 || crack) {
    if (moss > 0 && hash2(wx >> 1, wy >> 1, 88) < moss) return H('#487d32');
    return pal[0];
  }
  const tone = hash2(col, row, 23);
  let idx = tone < 0.2 ? 1 : tone < 0.78 ? 2 : 3;
  if (iy === 0 || ix === 1) idx = Math.min(4, idx + 1);
  if (accentCol && hash2(wx >> 1, wy >> 1, 57) < accentRate) return accentCol;
  return pal[idx];
}

/** World-space staggered industrial steel deck plates / catwalk grating. */
function texSteelPlate(wx: number, wy: number, pal: RGB[], grate = false, thermal = false): RGB {
  if (grate) {
    const gx = ((wx % 4) + 4) % 4, gy = ((wy % 4) + 4) % 4;
    if (gx === 0 || gy === 0) return (wx + wy) % 8 === 0 ? pal[4] : pal[3];
    if ((gx === 2 && gy === 2) || (gx === 1 && gy === 3)) return pal[1];
    return pal[0];
  }
  const plateH = 12, plateW = 24;
  const row = Math.floor(wy / plateH);
  const py = ((wy % plateH) + plateH) % plateH;
  const shift = (row & 1) * 12;
  const col = Math.floor((wx + shift) / plateW);
  const px = (((wx + shift) % plateW) + plateW) % plateW;
  if (px === 0 || py === 0) return pal[0];
  if (px === 1 || py === 1) return pal[3];
  // Corner rivets (quiet inner plate!)
  if ((px === 3 || px === plateW - 2) && (py === 3 || py === plateH - 2)) return pal[4];
  // Occasional warm copper access hatch panel in thermal stations
  if (thermal && hash2(col, row, 19) > 0.84 && px >= 8 && px <= 16 && py >= 4 && py <= 8) {
    return (px === 8 || py === 4) ? H('#67a89f') : (px === 16 || py === 8) ? H('#1b3336') : H('#3d7c77');
  }
  const tone = hash2(col, row, 21);
  return tone < 0.25 ? pal[1] : pal[2];
}

/** World-space packed forest earth + organic clustered moss + stepping flagstones (calm, zero confetti). */
function texForestTrail(wx: number, wy: number, pal: RGB[]): RGB {
  // Multi-pixel clustered moss pads via coarse 3x3 cell hash
  const mx = Math.floor(wx / 4), my = Math.floor(wy / 4);
  const mossCore = hash2(mx, my, 107);
  if (mossCore > 0.78) {
    const lx = ((wx % 4) + 4) % 4, ly = ((wy % 4) + 4) % 4;
    if (!((lx === 0 || lx === 3) && (ly === 0 || ly === 3))) {
      return ly === 0 || lx === 0 ? H('#70ad48') : H('#487d32');
    }
  }
  // Occasional embedded natural stepping stone (6x5 smooth cluster)
  const sx = Math.floor(wx / 14), sy = Math.floor(wy / 12);
  if (hash2(sx, sy, 113) > 0.76) {
    const ix = ((wx % 14) + 14) % 14, iy = ((wy % 12) + 12) % 12;
    if (ix >= 4 && ix <= 9 && iy >= 3 && iy <= 7 && !(ix === 4 && iy === 3) && !(ix === 9 && iy === 7)) {
      if (iy === 7 || ix === 9) return P_STONE_WARM[0];
      if (iy === 3 || ix === 4) return P_STONE_WARM[4];
      return P_STONE_WARM[2];
    }
  }
  // Quiet, low-contrast forest loam base
  const h = hash2(wx >> 1, wy >> 1, 105);
  return h < 0.16 ? pal[0] : h < 0.42 ? pal[1] : h > 0.88 ? pal[3] : pal[2];
}

/** World-space salt evaporation pan (large 32×24 pans, calm brine, corner salt crystal crusts). */
function texSaltPan(wx: number, wy: number): RGB {
  const pw = 32, ph = 24;
  const cx = Math.floor(wx / pw), cy = Math.floor(wy / ph);
  const px = ((wx % pw) + pw) % pw, py = ((wy % ph) + ph) % ph;
  // Wide mud-and-timber pan dike border
  if (px === 0 || py === 0) return P_STONE_SALT[0];
  if (px === 1 || py === 1) return P_STONE_SALT[2];
  // Some pans are dried crystalline salt beds, others hold shallow turquoise brine
  const dryStage = hash2(cx, cy, 71) > 0.52;
  if (dryStage) {
    if (px === 2 || py === 2 || px === pw - 1 || py === ph - 1) return P_SALT_PAN[4];
    const h = hash2(wx >> 1, wy >> 1, 79);
    return h > 0.7 ? P_SALT_PAN[4] : h < 0.2 ? P_SALT_PAN[2] : P_SALT_PAN[3];
  }
  // Wet evaporation pan: salt crust rings along rim, calm shimmering brine inside
  if ((px <= 3 || py <= 3 || px >= pw - 2 || py >= ph - 2) && hash2(wx, wy, 75) > 0.25) return P_SALT_PAN[4];
  const shimmer = Math.sin(wy * 0.45 + Math.sin(wx * 0.18));
  return shimmer > 0.86 ? P_SALT_PAN[3] : shimmer < -0.55 ? P_SALT_PAN[0] : P_SALT_PAN[1];
}

/** World-space shallow settling filter basin water inside tank cells. */
function texFilterBasin(wx: number, wy: number, clean: boolean): RGB {
  const ripple = Math.sin(wx * 0.18 + wy * 0.1) + (hash2(wx >> 1, wy >> 1, 44) - 0.5) * 0.45;
  if (clean) return ripple > 0.65 ? H('#9ad8ff') : ripple < -0.35 ? H('#214d7c') : H('#3074a6');
  return ripple > 0.65 ? H('#709184') : ripple < -0.35 ? H('#253b3a') : H('#3d5e58');
}

export type SurfaceCategory =
  | 'quarry_limestone' | 'quarry_slate' | 'quarry_obsidian'
  | 'timber_deck' | 'timber_yard' | 'mill_stone'
  | 'water_masonry' | 'old_pump_ruin'
  | 'kiln_brick' | 'slag_basalt' | 'sulfur_crust'
  | 'silo_cobble' | 'filter_basin' | 'geo_steel'
  | 'harbor_cobble' | 'harbor_pier' | 'salt_harbor' | 'salt_pan'
  | 'rail_ballast' | 'steel_gantry' | 'drowned_pier' | 'gull_boardwalk'
  | 'forest_loam' | 'academy_ashlar' | 'crypt_ancient' | 'tomb_sand' | 'surtur_ash'
  | 'interior_wood' | 'interior_stone' | 'cellar_vault' | 'upper_catwalk';

/** Classify any VEYRA room/surface ID into its authentic material category. */
export function classifySurface(opts: SurfacePaintOpts): SurfaceCategory {
  const id = (opts.id || '').toLowerCase();
  const poi = (opts.poi || (id.includes('.') ? id.split('.')[0] : '')).toLowerCase();
  const lv = opts.level ?? 0;

  if (lv === -1) return 'cellar_vault';
  if (lv >= 1 && (opts.carve || /catwalk|skywalk|gantry|truss|bridge|trestle|balcony|walk|perch|lookout|deck|veranda|draft|draught|lip/.test(id))) {
    if (/iron|slag|ember|sandgate|falls|geo|siloc|filter|kestrel|dpier/.test(id)) return 'steel_gantry';
    return 'upper_catwalk';
  }
  if (!opts.open && lv >= 0) {
    if (/forge|furnace|kiln|smelt|foundry|slag/.test(id)) return 'slag_basalt';
    return opts.mat === 'wood' ? 'interior_wood' : 'interior_stone';
  }

  // F03 POIs
  if (poi === 'po_fracquarry' || id.startsWith('po_fracquarry.')) return 'quarry_limestone';
  if (poi === 'po_greyquarry' || id.startsWith('po_greyquarry.')) return 'quarry_slate';
  if (poi === 'po_obsq' || id.startsWith('po_obsq.')) return 'quarry_obsidian';
  if (poi === 'po_sawaion' || id.startsWith('po_sawaion.')) return /track|rail|return|branch/.test(id) ? 'timber_deck' : 'timber_yard';
  if (poi === 'po_mill' || id.startsWith('po_mill.')) return /wheel|bridge/.test(id) ? 'timber_deck' : 'mill_stone';
  if (poi === 'po_timberyard' || id.startsWith('po_timberyard.')) return 'timber_yard';
  if (poi === 'po_falls' || id.startsWith('po_falls.')) return /waterfall|sluice/.test(id) ? 'timber_deck' : 'water_masonry';
  if (poi === 'po_pumphouse' || id.startsWith('po_pumphouse.')) return /reservoir|sluice/.test(id) ? 'timber_deck' : 'water_masonry';
  if (poi === 'po_oldpump' || id.startsWith('po_oldpump.')) return 'old_pump_ruin';
  if (poi === 'po_kilns' || id.startsWith('po_kilns.')) return /firebox|retort/.test(id) ? 'kiln_brick' : 'slag_basalt';
  if (poi === 'po_slag' || id.startsWith('po_slag.') || poi === 'po_ember' || id.startsWith('po_ember.')) {
    return /quay|boom|dock/.test(id) ? 'steel_gantry' : 'slag_basalt';
  }
  if (poi === 'po_sulfur' || id.startsWith('po_sulfur.')) return 'sulfur_crust';
  if (poi === 'po_siloc' || id.startsWith('po_siloc.')) return 'silo_cobble';
  // Playable filter service corridors must be solid, damp masonry; the water lives inside tank sprites.
  if (poi === 'po_filter' || id.startsWith('po_filter.')) return 'water_masonry';
  if (poi === 'po_geo' || id.startsWith('po_geo.')) return 'geo_steel';

  // C01 / C02 / C04 Harbor POIs
  if (poi === 'po_dpier' || id.startsWith('po_dpier.')) return /pier|head|rake|truss|catwalk|perch/.test(id) ? 'drowned_pier' : 'harbor_cobble';
  if (poi === 'po_gullpier' || id.startsWith('po_gullpier.')) return /quay|float|trestle|platform|perch/.test(id) ? 'gull_boardwalk' : 'harbor_cobble';
  if (poi === 'po_westbank' || id.startsWith('po_westbank.')) return /wharf|finger|skyway|veranda/.test(id) ? 'harbor_pier' : 'harbor_cobble';
  if (poi === 'po_saltharbor' || id.startsWith('po_saltharbor.')) return /evaporation|pan/.test(id) ? 'salt_pan' : /quay|float|balcony|skywalk/.test(id) ? 'harbor_pier' : 'salt_harbor';
  if (poi === 'po_gulfhead' || poi === 'po_westmouth' || id.startsWith('po_gulfhead.') || id.startsWith('po_westmouth.')) {
    return /quay|finger|pier|dock|berth/.test(id) ? 'harbor_pier' : 'harbor_cobble';
  }
  if (poi === 'po_ironharbor' || id.startsWith('po_ironharbor.')) {
    if (/track|rail|spur/.test(id)) return 'rail_ballast';
    if (/quay|barge|overhead|bridge|truss/.test(id)) return 'steel_gantry';
    return 'slag_basalt';
  }
  if (poi === 'po_sandgate' || id.startsWith('po_sandgate.')) {
    return /dock|landing|gatewalk|bridge|deck/.test(id) ? 'steel_gantry' : 'water_masonry';
  }

  // REST48 + H01
  if (/po_glade|po_elderwood|po_sapgrove|po_ranger|po_westwood/.test(poi) || /woodland|grove|trail|forest/.test(id)) return 'forest_loam';
  if (poi === 'po_saltpans' || /drying_beds/.test(id)) return 'salt_pan';
  if (poi === 'po_racks') return 'gull_boardwalk';
  if (poi === 'po_tidecamp' || poi === 'po_netcamp' || poi === 'po_fishcamp') return 'gull_boardwalk';
  if (poi === 'po_surtur' || poi === 'po_cindercamp' || poi === 'po_emberwatch') return 'surtur_ash';
  if (poi === 'po_tombs' || poi === 'po_oasis') return 'tomb_sand';
  if (poi === 'po_necropolis' || poi === 'po_cairns') return 'crypt_ancient';
  if (poi === 'po_academy' || poi === 'po_observatory' || poi === 'po_archive' || poi === 'po_hall_eyes' || poi === 'po_meridian') return 'academy_ashlar';
  if (poi === 'po_freightyard' || poi === 'po_ironmine' || poi === 'po_ironvein' || poi === 'po_ironwh') return /rail|spur/.test(id) ? 'rail_ballast' : 'slag_basalt';
  if (poi === 'po_wreck' || poi === 'po_gullwreck') return 'drowned_pier';
  if (poi === 'po_typhon' || poi === 'po_viaduct') return 'quarry_slate';

  return opts.mat === 'wood' ? 'timber_deck' : 'harbor_cobble';
}

/** Compute exact RGB for one pixel `(wx, wy)` inside tile `(tx, ty)`. */
export function sampleSurfaceRGB(tx: number, ty: number, px: number, py: number, opts: SurfacePaintOpts): RGB {
  const wx = tx * 16 + px;
  const wy = ty * 16 + py;
  const cat = classifySurface(opts);
  const e = opts.edges;

  // Raised edges / pilings / curbs / railings along open borders
  const onN = (e & 1) && py === 0;
  const onS = (e & 2) && py >= 14;
  const onW = (e & 4) && px === 0;
  const onE = (e & 8) && px === 15;
  const isRaised = (opts.level ?? 0) >= 1 || opts.overWater || /quay|pier|finger|float|trestle|catwalk|bridge|skyway|gantry|deck/.test(opts.id);

  if (isRaised) {
    if (onN) return cat === 'steel_gantry' ? P_STEEL_DECK[3] : P_TIMBER_WARM[3];
    if (onS) {
      // South facade thickness + vertical support pilings every 8px
      if (py === 15) return ((wx % 8 === 3 || wx % 8 === 4)) ? P_TIMBER_WARM[0] : [14, 18, 28];
      return P_TIMBER_WARM[1];
    }
    if ((opts.level ?? 0) >= 1 && (onW || onE)) {
      return (wy % 6 < 2) ? P_TIMBER_WARM[4] : P_TIMBER_WARM[1]; // railing post rhythm
    }
    if (onW || onE) return P_TIMBER_WARM[0];
  } else {
    // Ground-level clean bevel border (1px only at actual room boundary)
    if (onN && cat !== 'forest_loam') return P_STONE_WARM[3];
    if (onS && cat !== 'forest_loam') return P_STONE_WARM[0];
    if ((onW || onE) && cat !== 'forest_loam') return P_STONE_WARM[1];
  }

  switch (cat) {
    case 'quarry_limestone': return texFlagstone(wx, wy, P_STONE_WARM, 'strata', 0, H('#c4aa74'), 0.04);
    case 'quarry_slate': return texFlagstone(wx, wy, P_STONE_SLATE, 'strata', 0.03, H('#94a2ae'), 0.03);
    case 'quarry_obsidian': return texFlagstone(wx, wy, P_STONE_OBS, 'obsidian');
    case 'timber_deck': return texPlank(wx, wy, P_TIMBER_WARM, false, false);
    case 'timber_yard': {
      // Compacted bark/sawdust yard with sparse embedded plank skids
      const skid = (wy % 16 >= 5 && wy % 16 <= 9) && (hash2(tx, ty, 33) > 0.45);
      if (skid) return texPlank(wx, wy, P_TIMBER_WARM, false, false);
      const h = hash2(wx, wy, 51);
      return h < 0.14 ? P_TIMBER_WARM[0] : h > 0.88 ? H('#b88a3e') : P_FOREST_LOAM[1];
    }
    case 'mill_stone': return texFlagstone(wx, wy, P_STONE_WARM, 'ashlar', 0.04, H('#e6d8b4'), 0.03);
    case 'water_masonry': return texFlagstone(wx, wy, P_STONE_SLATE, 'ashlar', 0.16, P_STONE_SLATE[1], 0.04);
    case 'old_pump_ruin': return texFlagstone(wx, wy, P_STONE_SLATE, 'cobble', 0.25, H('#8f4730'), 0.05);
    case 'kiln_brick': return texFlagstone(wx, wy, P_BRICK_KILN, 'cobble', 0, H('#242024'), 0.10);
    case 'slag_basalt': return texFlagstone(wx, wy, P_STONE_ASH, 'ashlar', 0, H('#a25a3c'), 0.04);
    case 'sulfur_crust': return texFlagstone(wx, wy, P_STONE_ASH, 'cobble', 0, H('#bba426'), 0.10);
    case 'silo_cobble': return texFlagstone(wx, wy, P_STONE_WARM, 'cobble', 0, H('#d9ad4e'), 0.03);
    case 'filter_basin': {
      // World-space 24x24 settling tank cells: turbid inflow (left) -> clear filtered water (right)
      const cellX = Math.floor(wx / 24), cellY = Math.floor(wy / 24);
      const bx = ((wx % 24) + 24) % 24, by = ((wy % 24) + 24) % 24;
      if (bx < 3 || by < 3) return texFlagstone(wx, wy, P_STONE_SLATE, 'ashlar', 0.05);
      if (bx === 3 || by === 3) return P_STONE_SLATE[0];
      if (bx === 23 || by === 23) return P_STONE_SLATE[3];
      return texFilterBasin(wx, wy, (cellX + cellY) % 2 === 1);
    }
    case 'geo_steel': return texSteelPlate(wx, wy, P_STEEL_DECK, false, true);
    case 'steel_gantry': return texSteelPlate(wx, wy, P_STEEL_DECK, (opts.level ?? 0) >= 1, false);
    case 'rail_ballast': {
      // One crisp track corridor every 32px with heavy creosote sleepers & calm crushed slag ballast
      const ry = ((wy % 32) + 32) % 32;
      if (ry === 11 || ry === 20) return P_STEEL_DECK[4];
      if (ry === 12 || ry === 21) return P_STEEL_DECK[1];
      if (ry >= 9 && ry <= 22 && (((wx % 6) + 6) % 6) < 2) return ry === 9 || ry === 22 ? P_TIMBER_HULL[0] : P_TIMBER_HULL[1];
      const h = hash2(wx >> 1, wy >> 1, 29);
      return h < 0.22 ? P_STONE_ASH[0] : h > 0.86 ? P_STONE_ASH[3] : P_STONE_ASH[1];
    }
    case 'harbor_cobble': return texFlagstone(wx, wy, P_STONE_WARM, 'cobble', 0.02);
    case 'harbor_pier': return texPlank(wx, wy, P_TIMBER_WARM, false, false);
    case 'salt_harbor': return texFlagstone(wx, wy, P_STONE_SALT, 'ashlar', 0, H('#faf8ee'), 0.05);
    case 'salt_pan': return texSaltPan(wx, wy);
    case 'drowned_pier': return texPlank(wx, wy, P_TIMBER_DRIFT, false, true);
    case 'gull_boardwalk': return texPlank(wx, wy, P_TIMBER_WEATH, true, false);
    case 'forest_loam': return texForestTrail(wx, wy, P_FOREST_LOAM);
    case 'academy_ashlar': return texFlagstone(wx, wy, P_STONE_SALT, 'ashlar', 0.06);
    case 'crypt_ancient': return texFlagstone(wx, wy, P_STONE_SLATE, 'ashlar', 0.10);
    case 'tomb_sand': return texFlagstone(wx, wy, P_STONE_SAND, 'ashlar', 0, H('#e8cfa0'), 0.08);
    case 'surtur_ash': return texFlagstone(wx, wy, P_STONE_ASH, 'strata', 0, H('#d4521c'), 0.04);
    case 'interior_wood': return texPlank(wx, wy, P_TIMBER_WARM, false, false);
    case 'interior_stone': return texFlagstone(wx, wy, P_STONE_WARM, 'ashlar', 0);
    case 'cellar_vault': return texFlagstone(wx, wy, P_STONE_SLATE, 'cobble', 0.08);
    case 'upper_catwalk': return texPlank(wx, wy, P_TIMBER_WEATH, false, false);
  }
}

/** Paint a single 16×16 tile directly to a Canvas2D context (compatible with existing draw*DeckTile API). */
export function drawDeckTileCanvas(g: CanvasRenderingContext2D, x: number, y: number, opts: SurfacePaintOpts): void {
  const X = x * 16, Y = y * 16;
  for (let py = 0; py < 16; py++) {
    for (let px = 0; px < 16; px++) {
      const [r, gr, b] = sampleSurfaceRGB(x, y, px, py, opts);
      g.fillStyle = C(r, gr, b);
      g.fillRect(X + px, Y + py, 1, 1);
    }
  }
}