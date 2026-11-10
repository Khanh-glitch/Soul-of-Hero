/**
 * VEYRA Living Art — Elder monuments, redrawn (original art).
 * Same keys and pixel sizes as elder-art.ts so authored anchors, footprints and collision are unchanged.
 */
import { type Sprite } from '../../game/art';
import { HField, D, h2, vn, type Detail } from './hpaint';

const steps = (f: HField, cx: number, yb: number, w0: number, n: number, mat: string, det?: Detail) => { for (let i = 0; i < n; i++) { const w = w0 - i * 8; f.box(cx - w / 2, yb - (i + 1) * 5, w, 3, 2, i * 3, mat, det); } };
const glyphBand = (s: number): Detail => (x, y) => { const c = h2(x >> 1, y >> 2, s); return { d: (y % 6 === 0) ? -0.3 : c > 0.72 ? -0.22 : c < 0.1 ? 0.12 : 0 }; };

function aionRoot(): Sprite {
  const f = new HField(112, 128); const s = 7;
  // ceiling roots descending into the chamber (behind)
  for (const [x0, x1] of [[6, 30], [104, 82], [30, 44], [86, 70]]) f.stroke([[x0, 0], [(x0 + x1) / 2 + (h2(x0, 1) - 0.5) * 10, 26], [x1, 50]], 4, 6, 0, 'bark', D.bark(s + x0));
  // buttress roots sprawling over the floor
  const butt: [number, number][][] = [[[56, 112], [34, 116], [14, 121], [3, 126]], [[56, 112], [80, 117], [99, 121], [110, 126]], [[52, 108], [30, 104], [12, 110]], [[60, 108], [84, 103], [101, 109]], [[56, 114], [48, 122], [40, 127]], [[58, 114], [68, 122], [76, 127]]];
  butt.forEach((p, k) => f.stroke(p, 8 - (k > 3 ? 3 : 0), 2, 1, 'bark', D.bark(s + k)));
  // the bole: spiralling strands of heartwood (time wound around itself)
  f.column(56, 26, 116, 15, 21, 4, 'heartwood', D.grain(s));
  for (let k = 0; k < 5; k++) { const pts: [number, number][] = []; for (let y = 116; y >= 22; y -= 6) pts.push([56 + Math.sin(y / 15 + k * 1.26) * (14 + (116 - y) * 0.02), y]); f.stroke(pts, 3.4, 2.2, 14, 'bark', D.bark(s + 20 + k)); }
  // upper limbs grow into the ceiling
  f.stroke([[56, 34], [40, 18], [26, 4]], 7, 4, 10, 'bark', D.bark(s + 9)); f.stroke([[56, 34], [74, 16], [90, 3]], 7, 4, 10, 'bark', D.bark(s + 10)); f.stroke([[56, 30], [58, 12], [54, 0]], 6, 4, 12, 'bark', D.bark(s + 11));
  // the hollow heart: growth rings around an amber core, deliberately inset (lower z)
  for (let y = 56; y < 94; y++) for (let x = 40; x < 73; x++) { const dx = (x + 0.5 - 56.5) / 15, dy = (y + 0.5 - 75) / 18; const d = Math.hypot(dx, dy); if (d < 1) { const ring = Math.sin(d * 34) > 0.55; f.glow(x, y, 'gold', d < 0.28 ? 0.98 - d : ring ? 0.62 - d * 0.35 : 0.3 - d * 0.2); } }
  // moss and hanging sap beads
  for (let k = 0; k < 40; k++) { const x = 30 + (h2(k, 3) * 52 | 0), y = 96 + (h2(k, 4) * 24 | 0); if (f.m[y * 112 + x] >= 0) f.glow(x, y, 'sap', 0.35 + h2(k, 5) * 0.3); }
  return f.render();
}
function aionRune(): Sprite {
  const f = new HField(43, 73);
  f.box(9, 6, 25, 6, 58, 6, 'stone', D.strata(3, 0.7), 2);
  f.box(5, 64, 33, 4, 4, 0, 'stone', D.noise(0.12, 4));
  f.stroke([[4, 70], [10, 52], [8, 34], [14, 14], [20, 4]], 2.6, 1.6, 12, 'bark', D.bark(5));
  f.stroke([[40, 70], [33, 50], [36, 28], [27, 10]], 2.4, 1.4, 12, 'bark', D.bark(6));
  for (let a = 0; a < 26; a += 0.12) { const r = a * 0.42; const x = 21.5 + Math.cos(a) * r * 0.8, y = 36 + Math.sin(a) * r; f.glow(x, y, 'sap', 0.82 - a * 0.012); }
  return f.render();
}
function anubisPylon(): Sprite {
  const f = new HField(60, 106);
  steps(f, 30, 105, 58, 2, 'sandstone', D.bricks(12, 5, 1, 0.25));
  f.poly([[11, 22], [49, 22], [46, 95], [14, 95]], 18, 10, 'sandstone', D.bricks(9, 6, 2, 0.18));
  f.box(8, 15, 44, 4, 6, 20, 'sandstone', (x, y) => ({ d: y === 19 ? -0.3 : (x % 4 === 0 ? -0.1 : 0.05) })); // cavetto cornice
  // recessed relief panel: jackal-headed figure
  for (let y = 30; y < 84; y++) for (let x = 20; x < 41; x++) { const i = y * 60 + x; f.z[i] -= 3; }
  f.poly([[27, 40], [30, 34], [33, 40], [34, 56], [33, 80], [27, 80], [26, 56]], 15, 15, 'sandstone', glyphBand(9)); // figure body
  f.poly([[28, 34], [29, 28], [30, 32], [31, 28], [32, 34]], 16, 16, 'obsidian'); // jackal ears
  for (let y = 46; y < 49; y++) for (let x = 23; x < 38; x++) f.glow(x, y, 'gold', 0.55);
  // gilded pyramidion catching the sun
  f.poly([[22, 15], [30, 2], [38, 15]], 24, 22, 'brass');
  for (let y = 6; y < 13; y++) for (let x = 27; x < 34; x++) if (Math.hypot(x - 30, y - 10) < 3) f.glow(x, y, 'gold', 0.9);
  return f.render();
}
function anubisSarc(): Sprite {
  const f = new HField(54, 58);
  steps(f, 27, 57, 52, 2, 'sandstone', D.bricks(10, 5, 7, 0.2));
  f.box(9, 14, 36, 20, 16, 10, 'obsidian', (x, y) => ({ d: (y % 9 === 0) ? 0.25 : 0 }), 2);
  f.poly([[18, 15], [27, 11], [36, 15], [35, 32], [19, 32]], 16, 16, 'obsidian', D.noise(0.1, 2)); // mummiform lid
  for (let y = 14; y < 22; y++) for (let x = 22; x < 33; x++) if (Math.hypot((x - 27) / 5, (y - 17) / 4) < 1) f.glow(x, y, 'gold', 0.7); // mask
  f.poly([[22, 13], [23, 7], [25, 12]], 20, 20, 'brass'); f.poly([[29, 12], [31, 7], [32, 13]], 20, 20, 'brass');
  for (const y of [24, 28]) for (let x = 19; x < 36; x++) f.glow(x, y, 'gold', 0.45);
  for (let x = 9; x < 45; x++) f.glow(x, 34, 'gold', 0.4);
  return f.render();
}
function argusEye(): Sprite {
  const f = new HField(102, 110);
  steps(f, 51, 109, 98, 3, 'slate', (x, y) => ({ d: (x % 12 === 0) ? -0.2 : (y % 5 === 1 ? 0.1 : 0) }));
  // twin library pylons: shelves of books inside slate frames
  for (const x0 of [10, 72]) { f.box(x0, 12, 20, 4, 78, 10, 'slate', D.strata(x0, 0.4), 2);
    for (let r = 0; r < 7; r++) for (let x = x0 + 3; x < x0 + 17; x++) for (let y = 22 + r * 10; y < 29 + r * 10; y++) { const i = y * 102 + x; f.m[i] = f.mats.length; f.z[i] = 8; }
    (f as any).mats.push('book'); (f as any).det.push(((x: number, y: number) => ({ d: (h2(x, Math.floor((y - 2) / 10), 4) - 0.5) * 0.6 + (x % 2 ? -0.08 : 0.05), mat: ['book', 'cloth', 'jade', 'book', 'brass'][(h2(x, Math.floor(y / 10), 9) * 5) | 0] })) as Detail); }
  // brass lintel and armillary
  f.box(18, 4, 66, 5, 7, 16, 'brass', D.noise(0.12, 3));
  for (let a = 0; a < Math.PI * 2; a += 0.02) { f.put(51 + Math.cos(a) * 31, 55 + Math.sin(a) * 31, 20, f.mats.length, true); f.put(51 + Math.cos(a) * 31, 55 + Math.sin(a) * 10, 22, f.mats.length, true); f.put(51 + Math.cos(a) * 9, 55 + Math.sin(a) * 31, 22, f.mats.length, true); }
  (f as any).mats.push('brass'); (f as any).det.push(null);
  // the great eye: lens with iris and a pupil that looks back
  f.blob(51, 55, 20, 14, 12, 'marble', D.noise(0.08, 6)); f.base = 0;
  for (let y = 40; y < 70; y++) for (let x = 30; x < 72; x++) { const d = Math.hypot((x - 51) / 11, (y - 55) / 11); if (d < 1) f.glow(x, y, 'rune', d < 0.32 ? 0.12 : 0.95 - d * 0.55 + (Math.sin(Math.atan2(y - 55, x - 51) * 14) > 0.6 ? 0.12 : 0)); }
  for (let y = 50; y < 53; y++) for (let x = 45; x < 48; x++) f.glow(x, y, 'rune', 1);
  return f.render();
}
function argusPillar(): Sprite {
  const f = new HField(38, 86);
  f.box(4, 76, 30, 4, 5, 0, 'slate'); f.column(19, 14, 77, 9, 10, 2, 'slate', (x, y) => ({ d: (x % 3 === 0 ? -0.12 : 0) + (y % 16 === 0 ? -0.25 : 0) }));
  for (let r = 0; r < 4; r++) for (let y = 22 + r * 14; y < 30 + r * 14; y++) for (let x = 13; x < 26; x++) { const i = y * 38 + x; f.m[i] = f.mats.length; f.z[i] = 6; }
  (f as any).mats.push('book'); (f as any).det.push(((x: number, y: number) => ({ d: (h2(x, y >> 4, 2) - 0.5) * 0.7, mat: ['book', 'cloth', 'jade', 'book'][(h2(x, y >> 4, 7) * 4) | 0] })) as Detail);
  f.box(5, 6, 28, 5, 4, 14, 'brass', D.noise(0.1, 1)); f.blob(19, 5, 4, 3.5, 4, 'crystal', D.facets(2)); f.glow(18, 4, 'rune', 0.9);
  return f.render();
}
function atlasGate(): Sprite {
  const f = new HField(124, 135); const algae: Detail = (x, y, z, nx, ny) => { const fl = (x % 5 === 0 ? -0.16 : x % 5 === 1 ? 0.12 : 0); return y > 112 && vn(x * 0.3, y * 0.3, 2) > 0.4 ? { d: fl, mat: 'jade' } : { d: fl + (ny < -0.4 ? 0.08 : 0) }; };
  f.box(4, 120, 116, 6, 8, 0, 'marble', D.noise(0.15, 1));
  f.column(24, 34, 122, 11, 12, 4, 'marble', algae); f.column(100, 30, 122, 11, 12, 4, 'marble', algae);
  f.box(10, 26, 28, 6, 6, 16, 'marble', D.noise(0.1, 3)); f.box(86, 22, 28, 6, 6, 16, 'marble', D.noise(0.1, 4));
  // the arch voussoirs, displaced by the spatial fault: each stone drifts off its curve
  for (let k = 0; k < 9; k++) { const a = Math.PI + (k + 0.5) / 9 * Math.PI; const drift = (k === 4 ? -9 : k === 3 || k === 5 ? -4 : 0); const cx = 62 + Math.cos(a) * 40, cy = 34 + Math.sin(a) * 26 + drift; f.blob(cx, cy, 6.5, 5.5, 9, 'marble', D.strata(k, 1.2), 0.15, k + 3); }
  f.base = 0;
  // void seam across the open span (not a portal; light from elsewhere)
  for (let y = 22; y < 116; y++) for (let x = 38; x < 87; x++) { const ex = (x - 62) / 25, ey = (y - 72) / 46; const d = ex * ex + ey * ey; if (d < 1 && d > 0.82) f.glow(x, y, 'void', 0.5 + (h2(x, y, 3) - 0.5) * 0.3); }
  return f.render();
}
function atlasAnchor(): Sprite {
  const f = new HField(48, 74);
  f.box(6, 64, 36, 5, 5, 0, 'marble'); f.poly([[15, 18], [33, 18], [30, 66], [18, 66]], 14, 8, 'marble', D.strata(5, 0.8));
  f.blob(24, 12, 7, 6, 8, 'obsidian', D.facets(4), 0.12, 2); f.base = 0;
  for (let a = 0; a < Math.PI * 2; a += 0.03) if (Math.sin(a * 3) > -0.3) f.put(24 + Math.cos(a) * 18, 34 + Math.sin(a) * 6, 20, f.mats.length, true);
  (f as any).mats.push('brass'); (f as any).det.push(null);
  for (let y = 8; y < 17; y++) for (let x = 19; x < 30; x++) if (Math.hypot(x - 24, y - 12) < 3.5) f.glow(x, y, 'void', 0.8);
  return f.render();
}
function surturForge(): Sprite {
  const f = new HField(112, 106); const hex: Detail = (x, y) => { const c = (x + (Math.floor(y / 8) % 2) * 5) % 10; return { d: c === 0 ? -0.35 : c === 1 ? 0.15 : (y % 8 === 0 ? -0.25 : 0) }; };
  f.box(2, 86, 108, 8, 12, 0, 'basalt', hex);
  f.box(16, 30, 80, 8, 50, 8, 'iron', (x, y) => ({ d: (x % 10 === 0 ? -0.2 : 0) + (y % 12 === 0 ? 0.18 : 0) + (h2(x, y, 4) > 0.95 ? 0.2 : 0) }), 2);
  for (let x = 16; x < 96; x++) for (const y of [44, 60]) f.glow(x, y, 'gold', 0.25);
  // twin chimneys of basalt
  f.box(22, 4, 14, 4, 26, 18, 'basalt', hex); f.box(76, 0, 14, 4, 30, 18, 'basalt', hex);
  // the furnace mouth: arched, molten inside, with heat-darkened lips
  for (let y = 50; y < 86; y++) for (let x = 38; x < 74; x++) { const ex = (x - 56) / 18, ey = (y - 86) / 32; const d = ex * ex + ey * ey; if (d < 1) { const i = y * 112 + x; f.z[i] = 2; f.glow(x, y, 'lava', d < 0.6 ? 0.95 - ey * -0.1 - d * 0.3 : 0.4); } }
  // molten channel spilling forward
  for (let y = 86; y < 104; y++) for (let x = 48; x < 64; x++) { const w = 6 + Math.sin(y * 0.5) * 1.5; if (Math.abs(x - 56 + (y - 86) * 0.1) < w) f.glow(x, y, 'lava', 0.75 + (h2(x, y, 2) - 0.5) * 0.3); }
  return f.render();
}
function surturSpire(): Sprite {
  const f = new HField(49, 108);
  const cols: [number, number, number][] = [[14, 30, 6], [24, 6, 8], [35, 22, 6], [19, 50, 5], [31, 44, 5]];
  for (const [cx, top, r] of cols) f.box(cx - r, top, r * 2, 4, 104 - top - 4, 6 + (cx === 24 ? 6 : 0), 'basalt', (x, y) => ({ d: (x === Math.round(cx) ? -0.25 : 0) + (y % 13 === 0 ? -0.2 : 0) + (h2(x, y, cx) > 0.96 ? 0.25 : 0) }));
  for (let y = 10; y < 104; y++) { const x = 24 + Math.round(Math.sin(y * 0.21) * 3); f.glow(x, y, 'lava', 0.55 + Math.sin(y * 0.4) * 0.2); if (y > 60) f.glow(x + 1, y, 'lava', 0.4); }
  for (const y of [40, 72]) for (let x = 14; x < 36; x++) f.put(x, y, 18, f.mats.length, true);
  (f as any).mats.push('iron'); (f as any).det.push(null);
  return f.render();
}
function typhonShard(): Sprite {
  const f = new HField(106, 116); const iceDet: Detail = (x, y, z, nx) => { const crack = Math.abs(vn(x * 0.14, y * 0.07, 3) - 0.5) < 0.02; const inner = vn(x * 0.08, y * 0.08, 9); return { d: (crack ? 0.4 : 0) + (inner > 0.66 ? -0.2 : 0) + (nx < -0.5 ? 0.18 : 0) }; };
  f.blob(53, 106, 50, 10, 10, 'stone', D.strata(2, 0.9), 0.25, 3); f.base = 0;
  const shards: [number, number, number, number, number][] = [[52, 6, 15, 104, 30], [30, 30, 11, 104, 22], [76, 22, 12, 104, 24], [16, 56, 8, 106, 16], [92, 50, 8, 106, 16], [42, 46, 9, 106, 28], [64, 40, 9, 106, 28]];
  for (const [tx, ty, w, by, z] of shards) f.poly([[tx, ty], [tx + w, by - (by - ty) * 0.45], [tx + w * 0.7, by], [tx - w * 0.7, by], [tx - w, by - (by - ty) * 0.4]], z, z - 10, 'ice', iceDet);
  // rime and snow drift at the foot
  for (let x = 4; x < 102; x++) for (let y = 98 + Math.round(Math.sin(x * 0.2) * 2); y < 104; y++) f.put(x, y, 12, f.mats.length, false);
  (f as any).mats.push('snow'); (f as any).det.push(D.noise(0.15, 2));
  for (let k = 0; k < 18; k++) f.glow(30 + h2(k, 2) * 50, 20 + h2(k, 3) * 70, 'rune', 0.45);
  return f.render();
}
function typhonPillar(): Sprite {
  const f = new HField(43, 96);
  f.box(9, 18, 25, 4, 70, 4, 'stone', D.strata(6, 0.6), 2);
  f.poly([[6, 30], [20, 6], [37, 24], [38, 92], [5, 92]], 16, 10, 'ice', (x, y) => ({ d: (Math.abs(vn(x * 0.2, y * 0.1, 1) - 0.5) < 0.03 ? 0.4 : 0) + (x < 12 ? 0.12 : 0) }));
  for (let y = 0; y < 96; y++) for (let x = 0; x < 43; x++) { const i = y * 43 + x; if (f.m[i] >= 0 && f.mats[f.m[i]] === 'ice' && ((x + y) % 2 === 0) && y > 20 && x > 10 && x < 33) { f.m[i] = 0; } } // stone shows through clear ice
  for (let x = 3; x < 40; x++) for (let y = 88; y < 96; y++) f.put(x, y, 18, f.mats.length);
  (f as any).mats.push('snow'); (f as any).det.push(D.noise(0.12, 4));
  return f.render();
}
function blueRune(): Sprite {
  const f = new HField(53, 42);
  f.blob(26, 26, 24, 13, 6, 'marble', D.strata(8, 0.6), 0.08, 2); f.base = 0;
  for (let a = 0; a < Math.PI * 2; a += 0.01) { const r = 15 + (Math.sin(a * 6) > 0.9 ? -3 : 0); f.glow(26 + Math.cos(a) * r, 26 + Math.sin(a) * r * 0.5, 'rune', 0.7); }
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; for (let t = 0; t < 7; t++) f.glow(26 + Math.cos(a) * t, 26 + Math.sin(a) * t * 0.5, 'rune', 0.5); }
  return f.render();
}

export function makeElderSprites2(): Record<string, Sprite> {
  return {
    elder_aion_root: aionRoot(), elder_aion_rune: aionRune(), elder_anubis_pylon: anubisPylon(), elder_anubis_sarc: anubisSarc(),
    elder_argus_eye: argusEye(), elder_argus_pillar: argusPillar(), elder_atlas_gate: atlasGate(), elder_atlas_anchor: atlasAnchor(),
    elder_surtur_forge: surturForge(), elder_surtur_spire: surturSpire(), elder_typhon_shard: typhonShard(), elder_typhon_pillar: typhonPillar(), elder_blue_rune: blueRune(),
  };
}
/** Emissive light sources carried by each monument (offsets from sprite base centre), consumed by the occluded light pass. */
export const ELDER_LIGHTS: Record<string, [number, number, number, string][]> = {
  elder_aion_root: [[0, -52, 70, '#ffc860']], elder_aion_rune: [[0, -37, 26, '#a8f0a0']], elder_anubis_pylon: [[0, -96, 30, '#ffd070']], elder_anubis_sarc: [[0, -40, 30, '#ffd070']],
  elder_argus_eye: [[0, -55, 64, '#7ae0ff']], elder_argus_pillar: [[0, -82, 22, '#9ae8f6']], elder_atlas_gate: [[0, -64, 70, '#a890ff']], elder_atlas_anchor: [[0, -62, 30, '#a890ff']],
  elder_surtur_forge: [[0, -30, 96, '#ff7a2a']], elder_surtur_spire: [[0, -50, 40, '#ff6a1e']], elder_typhon_shard: [[0, -60, 50, '#bfefff']], elder_blue_rune: [[0, -16, 36, '#7ad8ff']],
};
