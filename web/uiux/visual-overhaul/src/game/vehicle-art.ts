// ============================================================================
// SOUL OF HEROES — VISUAL ARENA · motorbike silhouette reconstruction
// Original pixel artwork. Supersedes drawVehicleSide/Front/Back in
// industrial-art.ts (those are retained only because b05-industrial-art.test.ts
// pins them). ALL state selection still comes from the untouched pure rules
// vehicleView / vehicleVisualKey / vehicleStateKey — no mechanic changes.
//
// Why the old bike failed at 1x:
//   The side view filled the whole space between two large wheels with a solid
//   body, so the outline read "buggy". A motorcycle is recognised by the AIR
//   under the engine, the raked fork and the high T-bar. The live Adventurer is
//   composited from hero-art.ts by render.ts; no proxy rider is painted here.
//   READY / OUT OF FUEL / BROKEN now differ in lamp, stance, chrome and debris —
//   three separate silhouette cues, not one hue shift.
// ============================================================================
import type { VehicleVariant } from './industrial-art';

type G = CanvasRenderingContext2D;
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
const P = (g: G, x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };

const TANK: Record<VehicleVariant, [string, string, string]> = {
  ok: ['#c8402a', '#f07a52', '#7a2416'],
  empty: ['#5e6874', '#98a2ae', '#3a424c'],
  broken: ['#6e3222', '#96503a', '#3a1c12'],
};
const RIM = '#cdd6e0', RIM_D = '#79838f', TYRE = '#16181d', TYRE_E = '#0a0b0e', HUB = '#98a2ae';
const STEEL = '#9aa5b0', STEEL_D = '#5c666f', CHROME = '#d8e2ec';

/** spoked wheel, radius 4, ground contact at cy+4 */
function wheel(g: G, cx: number, cy: number, flat: boolean) {
  const ry = flat ? 3 : 4;
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    const d = (x * x) / 16 + (y * y) / (ry * ry);
    if (d > 1.02) continue;
    const c = d > 0.72 ? TYRE_E : d > 0.5 ? TYRE : d > 0.3 ? RIM_D : RIM;
    P(g, cx + x, cy + y, c);
  }
  // two spokes + hub keep the wheel from reading as a solid disc
  P(g, cx, cy - 2, RIM); P(g, cx, cy + 2, RIM); P(g, cx - 2, cy, RIM); P(g, cx + 2, cy, RIM);
  P(g, cx, cy, HUB);
  if (flat) { R(g, cx - 3, cy + 3, 7, 1, TYRE_E); }
}

/** SIDE · 24x16, heading right. The character is layered by render.ts. */
export function drawBikeSide(g: G, variant: VehicleVariant = 'ok') {
  const [tank, hi, dark] = TANK[variant];
  const broken = variant === 'broken', dry = variant === 'empty';
  const tilt = broken ? 1 : 0;

  wheel(g, 5, 11 + tilt, false);
  wheel(g, 19, 11, broken);

  // swingarm + exhaust low, but the centre stays OPEN (the buggy fix)
  R(g, 7, 11 + tilt, 3, 1, STEEL_D);
  R(g, 6, 13 + tilt, 5, 1, '#4a525c'); P(g, 5, 13 + tilt, '#6e7883');

  // engine: a compact block, not a full belly pan
  R(g, 10, 9, 4, 3, '#3e444e'); P(g, 10, 9, '#6e7883'); P(g, 13, 11, '#22262c');
  P(g, 11, 10, '#59626d');

  // frame spine from the seat down to the engine and up to the head tube
  P(g, 9, 8, STEEL); P(g, 10, 8, STEEL); R(g, 11, 8, 4, 1, STEEL);
  P(g, 14, 9, STEEL_D);

  // seat + tail hump
  R(g, 6, 6 + tilt, 5, 2, '#191b21'); R(g, 6, 6 + tilt, 5, 1, '#33373f');
  R(g, 4, 6 + tilt, 2, 1, dark);

  // tank: rounded, lit on top, shaded underneath
  R(g, 10, 4, 6, 4, tank); R(g, 11, 3, 4, 1, tank);
  R(g, 10, 4, 6, 1, hi); R(g, 10, 7, 6, 1, dark);
  P(g, 12, 5, hi);
  if (dry) { P(g, 14, 3, CHROME); P(g, 15, 2, CHROME); }                 // filler cap glint on a dry tank
  if (broken) { P(g, 12, 5, '#3a1c12'); P(g, 13, 6, '#3a1c12'); P(g, 11, 6, '#3a1c12'); }

  // raked fork: head tube -> front hub, two visible pixels of trail
  R(g, 16, 4, 1, 3, STEEL);
  P(g, 17, 7, STEEL); P(g, 17, 8, STEEL); P(g, 18, 9, STEEL); P(g, 18, 10, STEEL);
  P(g, 16, 7, STEEL_D); P(g, 17, 9, STEEL_D);

  // T-bar: high and wide — the strongest motorcycle cue in profile
  if (broken) { R(g, 14, 3, 4, 1, STEEL_D); P(g, 13, 4, '#2a2a30'); }
  else { R(g, 15, 2, 4, 1, CHROME); P(g, 15, 1, STEEL_D); P(g, 18, 1, STEEL_D); }

  // headlamp — three physically different states
  if (variant === 'ok') { R(g, 19, 4, 3, 3, '#ffe27a'); R(g, 20, 5, 2, 1, '#fffbe0'); P(g, 21, 4, '#fff6c0'); }
  else if (dry) { R(g, 19, 4, 3, 3, '#2e333b'); P(g, 20, 5, '#59626d'); P(g, 19, 4, '#4a525c'); }
  else { R(g, 19, 4, 3, 3, '#241d1a'); P(g, 20, 5, '#6a5a44'); P(g, 21, 6, '#6a5a44'); P(g, 19, 6, '#3a2a22'); }

  // rear rack (the cargo crate straps here)
  R(g, 2, 5 + tilt, 4, 1, CHROME); P(g, 2, 6 + tilt, STEEL_D); P(g, 5, 6 + tilt, STEEL_D);

  if (broken) {
    // smoke wisp + a dropped bolt: read as "will not start" without any text
    P(g, 12, 1, '#8a8f98'); P(g, 13, 0, '#6e737c'); P(g, 11, 0, '#5a5f68');
    P(g, 8, 15, '#6e7883'); P(g, 15, 15, '#5a5f68');
  }
}

/** FRONT · 12x22, heading toward the viewer. Narrow: a bike is not a car. */
export function drawBikeFront(g: G, variant: VehicleVariant = 'ok') {
  const [tank, hi, dark] = TANK[variant];
  const broken = variant === 'broken', dry = variant === 'empty';
  // far wheel peeking above the tail
  R(g, 5, 2, 3, 2, TYRE); P(g, 6, 2, RIM_D);
  // tail + seat
  R(g, 4, 4, 5, 1, '#191b21');
  // tank between the knees
  R(g, 3, 6, 7, 4, tank); R(g, 3, 6, 7, 1, hi); R(g, 3, 9, 7, 1, dark);
  P(g, 4, 7, hi);
  if (broken) { P(g, 6, 8, '#3a1c12'); P(g, 8, 7, '#3a1c12'); }
  // T-bar with grips — widest element, 11px
  if (broken) { R(g, 1, 6, 10, 1, STEEL_D); P(g, 1, 7, '#2a2a30'); }
  else { R(g, 0, 5, 12, 1, CHROME); P(g, 0, 6, STEEL_D); P(g, 11, 6, STEEL_D); }
  P(g, 0, 5, '#2a2a30'); P(g, 11, 5, '#2a2a30');
  // headlamp
  if (variant === 'ok') { R(g, 4, 10, 5, 3, '#ffe27a'); R(g, 5, 11, 3, 1, '#fffbe0'); }
  else if (dry) { R(g, 4, 10, 5, 3, '#2e333b'); P(g, 6, 11, '#59626d'); }
  else { R(g, 4, 10, 5, 3, '#241d1a'); P(g, 5, 12, '#6a5a44'); P(g, 7, 10, '#3a2a22'); }
  // engine + fork legs
  R(g, 4, 13, 5, 2, '#3e444e'); P(g, 4, 13, '#6e7883');
  for (let y = 15; y < 19; y++) { P(g, 4, y, STEEL); P(g, 8, y, STEEL); P(g, 3, y, STEEL_D); }
  // near wheel, head-on: narrow, tall
  for (let y = -3; y <= 3; y++) for (let x = -2; x <= 2; x++) {
    const d = (x * x) / 4 + (y * y) / 9; if (d > 1.05) continue;
    P(g, 6 + x, 19 + y, d > 0.6 ? TYRE_E : d > 0.3 ? TYRE : RIM_D);
  }
  P(g, 6, 19, HUB);
  if (broken) { P(g, 5, 0, '#8a8f98'); P(g, 7, 0, '#6e737c'); }
}

/** BACK · 12x22, heading away. Rack, taillight and twin pipes. */
export function drawBikeBack(g: G, variant: VehicleVariant = 'ok') {
  const [tank, hi] = TANK[variant];
  const broken = variant === 'broken', dry = variant === 'empty';
  R(g, 5, 2, 3, 2, TYRE); P(g, 6, 2, RIM_D);                        // far front wheel
  R(g, 4, 4, 5, 1, '#191b21');                                      // seat
  R(g, 3, 6, 7, 3, tank); R(g, 3, 6, 7, 1, hi);
  // rack + straps: this is where the crate visibly sits
  R(g, 1, 9, 10, 1, CHROME); P(g, 1, 10, STEEL_D); P(g, 10, 10, STEEL_D);
  R(g, 3, 10, 1, 2, '#6a4a2a'); R(g, 8, 10, 1, 2, '#6a4a2a');
  // taillight: bright red running, dead glass dry, smashed broken
  if (variant === 'ok') { R(g, 4, 11, 4, 2, '#e03a2a'); P(g, 5, 11, '#ff9a80'); }
  else if (dry) R(g, 4, 11, 4, 2, '#4a2220');
  else { R(g, 4, 11, 4, 2, '#2a1a18'); P(g, 6, 12, '#7a4030'); }
  // twin pipes
  R(g, 2, 13, 2, 3, '#5a626c'); R(g, 8, 13, 2, 3, '#5a626c');
  P(g, 2, 15, '#2a2f36'); P(g, 9, 15, '#2a2f36');
  // near rear wheel
  for (let y = -3; y <= 3; y++) for (let x = -2; x <= 2; x++) {
    const d = (x * x) / 4 + (y * y) / 9; if (d > 1.05) continue;
    P(g, 6 + x, 19 + y, d > 0.6 ? TYRE_E : d > 0.3 ? TYRE : RIM_D);
  }
  P(g, 6, 19, HUB);
  if (broken) { R(g, 3, 21, 7, 1, TYRE_E); P(g, 4, 0, '#8a8f98'); P(g, 7, 1, '#6e737c'); }
}

/** Cargo crate strapped to the rack (7x5). Unchanged geometry, warmer straps. */
export function drawBikeCrate(g: G) {
  R(g, 0, 0, 7, 5, '#8a5e30'); R(g, 0, 0, 7, 1, '#c08a4c'); R(g, 0, 4, 7, 1, '#4e3218');
  R(g, 3, 0, 1, 5, '#5e3c1e'); P(g, 1, 2, '#d8a860'); P(g, 5, 2, '#d8a860');
  R(g, 0, 2, 7, 1, '#3a4a52');
}
