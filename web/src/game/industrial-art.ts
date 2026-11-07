// B05 industrial + vehicle pixel art. Pure drawing helpers (no DOM) plus pure state→sprite key rules, so the
// rules are unit-testable under Node while art.ts owns canvas creation. Every sprite here is drawn on a fixed
// pixel grid; no recolours of unrelated sprites.
type G = CanvasRenderingContext2D;

const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
const P = (g: G, x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
const ell = (g: G, cx: number, cy: number, rx: number, ry: number, c: string) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); };

// ---- Vehicle state → view rule -------------------------------------------------------------------------
export type VehicleView = 'side' | 'front' | 'back';
/** Screen-space facing from the bike's stored angle (atan2(dy,dx), y grows downward). Side view is mirrored when heading left. */
export function vehicleView(angle: number): { view: VehicleView; mirror: boolean } {
  const c = Math.cos(angle), s = Math.sin(angle);
  if (Math.abs(c) >= Math.abs(s)) return { view: 'side', mirror: c < 0 };
  return { view: s > 0 ? 'front' : 'back', mirror: false };
}
/** Dead = out of fuel or broken: dark lamp, dulled tank, rust. Running = lamp lit. */
export function vehicleStateKey(fuel: number, hp: number): 'ok' | 'dead' { return fuel > 0 && hp > 0 ? 'ok' : 'dead'; }

/** Refinery sprite state: lit only while it is actually burning fuel for a queued job. */
export function refineryStateKey(burn: number | undefined, queueLength: number): 'idle' | 'lit' {
  return (burn ?? 0) > 0 && queueLength > 0 ? 'lit' : 'idle';
}

// ---- Vehicle sprites ----------------------------------------------------------------------------------
/** Sprite-selection only (does NOT change vehicleStateKey or any mechanic): READY / OUT OF FUEL / BROKEN.
 *  broken = hp 0 (takes precedence); empty = has hp but no fuel; ok = fuelled and running. */
export function vehicleVisualKey(fuel: number, hp: number): 'ok' | 'empty' | 'broken' {
  return hp <= 0 ? 'broken' : fuel <= 0 ? 'empty' : 'ok';
}
export type VehicleVariant = 'ok' | 'empty' | 'broken';
const BODY: Record<VehicleVariant, [string, string]> = { ok: ['#d0462a', '#ffa070'], empty: ['#6e7684', '#9aa2b0'], broken: ['#7a3424', '#a0503a'] };

/** Side view, 24×16, heading right. Motorcycle silhouette: two wheels with light rims, a raked fork and T-bar,
 *  a tank over the frame, a seat, an engine with an exhaust, and a rear rack. Rider only when mounted (seated, arms to the bar). */
export function drawVehicleSide(g: G, variant: VehicleVariant = 'ok', rider = false) {
  const [tank, hi] = BODY[variant]; const shade = '#00000055';
  const rim = '#c8d0dc', tyre = '#1a1c22', tyreEdge = '#0c0d11', hub = '#8a929e', metal = '#9aa3ad';
  // wheels: dark outline, light rim ring (separates from grass, road and night), dark tyre, hub
  ell(g, 5, 11, 4, 4, tyreEdge); ell(g, 5, 11, 3.2, 3.2, rim); ell(g, 5, 11, 2.2, 2.2, tyre); P(g, 5, 11, hub); P(g, 5, 9, rim);
  ell(g, 19, 11, 4, 4, tyreEdge); ell(g, 19, 11, 3.2, 3.2, rim); ell(g, 19, 11, 2.2, 2.2, tyre); P(g, 19, 11, hub); P(g, 19, 9, rim);
  // rear rack (cargo sits on it) and exhaust
  R(g, 1, 5, 4, 1, '#c4ccd8'); P(g, 1, 6, metal); P(g, 4, 6, metal);
  R(g, 4, 12, 4, 1, '#5a5f68'); P(g, 8, 12, '#3a3f4a');
  // engine and frame
  R(g, 9, 9, 5, 3, '#4a4f5a'); P(g, 9, 9, '#7a808c'); P(g, 13, 11, '#2a2d36');
  R(g, 7, 8, 10, 1, '#7ea4b4'); R(g, 13, 9, 1, 3, '#4e7280');
  // seat
  R(g, 6, 5, 4, 2, '#1d1d24'); P(g, 6, 5, '#3a3a46');
  // tank: rounded top, lit highlight, shaded lower side (empty tank is pale; broken tank is rust-dented)
  R(g, 10, 3, 6, 4, tank); R(g, 11, 2, 4, 1, tank); R(g, 10, 3, 6, 1, hi); R(g, 10, 6, 6, 1, shade);
  if (variant === 'empty') { P(g, 14, 3, '#c8d0dc'); P(g, 13, 2, '#c8d0dc'); }      // fuel cap glint on a dry tank
  if (variant === 'broken') { P(g, 12, 4, '#4a2418'); P(g, 14, 5, '#4a2418'); P(g, 11, 5, '#4a2418'); }
  // head tube, raked fork to the front hub, T-bar
  R(g, 16, 3, 1, 3, metal);
  P(g, 16, 6, metal); P(g, 17, 7, metal); P(g, 17, 8, metal); P(g, 18, 9, metal); P(g, 18, 10, metal);
  if (variant === 'broken') { R(g, 13, 2, 4, 1, metal); P(g, 13, 1, '#2a2a30'); }   // bar bent down-back
  else { R(g, 14, 2, 3, 1, metal); P(g, 14, 2, '#2a2a30'); }
  // headlamp: lit when ready; dark glass when out of fuel; missing with a cracked socket when broken
  if (variant === 'ok') { R(g, 19, 4, 2, 2, '#ffe27a'); P(g, 20, 4, '#fff8d0'); }
  else if (variant === 'empty') R(g, 19, 4, 2, 2, '#3a3a42');
  else { R(g, 19, 4, 2, 2, '#2a2220'); P(g, 20, 5, '#7a6a50'); }
  if (variant === 'broken') { P(g, 11, 0, '#8a8f98'); P(g, 12, 0, '#8a8f98'); P(g, 10, 1, '#8a8f98'); }   // smoke wisp
  // rider only while mounted: helmet with visor, torso on the seat, arm reaching to the bar
  if (rider) { R(g, 8, 0, 3, 2, '#2e5aa0'); P(g, 10, 1, '#9ad0ff'); R(g, 7, 2, 3, 3, '#2a4f86'); R(g, 10, 2, 3, 1, '#2a4f86'); R(g, 6, 4, 2, 1, '#2a4f86'); }
}
/** Head-on view, 12×22 (heading toward the viewer). Wide T-bar with grips, tank, headlamp at the nose, two fork legs, front wheel at the bottom, rear wheel peeking above. */
export function drawVehicleFront(g: G, variant: VehicleVariant = 'ok', rider = false) {
  const [tank, hi] = BODY[variant];
  const rim = '#c8d0dc', tyre = '#1a1c22', tyreEdge = '#0c0d11', metal = '#9aa3ad';
  ell(g, 6, 3, 3.5, 2.5, tyreEdge); ell(g, 6, 3, 2.6, 1.6, rim); ell(g, 6, 3, 1.5, 0.9, tyre);          // rear wheel behind
  R(g, 4, 5, 4, 1, '#1d1d24');                                                                          // seat
  R(g, 3, 6, 6, 4, tank); R(g, 3, 6, 6, 1, hi); R(g, 3, 9, 6, 1, '#00000055');                          // tank
  if (rider) { R(g, 4, 2, 4, 3, '#2e5aa0'); P(g, 5, 3, '#9ad0ff'); R(g, 4, 4, 4, 2, '#2a4f86'); }      // rider head and torso
  R(g, 1, 8, 10, 1, '#c4ccd8'); P(g, 1, 8, '#2a2a30'); P(g, 10, 8, '#2a2a30'); P(g, 4, 7, metal); P(g, 7, 7, metal);  // T-bar + grips
  if (variant === 'ok') { R(g, 4, 11, 4, 2, '#ffe27a'); P(g, 5, 11, '#fff8d0'); }
  else if (variant === 'empty') R(g, 4, 11, 4, 2, '#3a3a42');
  else { R(g, 4, 11, 4, 2, '#2a2220'); P(g, 5, 12, '#7a6a50'); }
  R(g, 4, 13, 4, 2, '#3a3f4a');                                                                         // engine nose
  P(g, 4, 15, metal); P(g, 4, 16, metal); P(g, 3, 17, metal); P(g, 7, 15, metal); P(g, 7, 16, metal); P(g, 8, 17, metal);  // fork legs
  ell(g, 6, 19, 3.5, 2.5, tyreEdge); ell(g, 6, 19, 2.6, 1.6, rim); ell(g, 6, 19, 1.5, 0.9, tyre);       // front wheel
}
/** Rear view, 12×22 (heading away). Rear rack and cargo position, taillight, exhaust, near rear wheel at the bottom. */
export function drawVehicleBack(g: G, variant: VehicleVariant = 'ok', rider = false) {
  const [tank, hi] = BODY[variant];
  const rim = '#c8d0dc', tyre = '#1a1c22', tyreEdge = '#0c0d11', metal = '#9aa3ad';
  ell(g, 6, 3, 3.5, 2.5, tyreEdge); ell(g, 6, 3, 2.6, 1.6, rim); ell(g, 6, 3, 1.5, 0.9, tyre);          // front wheel far, top
  R(g, 4, 5, 4, 1, '#1d1d24');                                                                          // seat
  if (rider) { R(g, 4, 2, 4, 3, '#2e5aa0'); P(g, 5, 3, '#9ad0ff'); R(g, 4, 4, 4, 2, '#2a4f86'); }
  R(g, 3, 6, 6, 4, tank); R(g, 3, 6, 6, 1, hi);                                                          // tank
  R(g, 2, 11, 8, 1, '#c4ccd8'); P(g, 2, 12, metal); P(g, 9, 12, metal);                                  // rear rack (cargo sits on it)
  if (variant === 'broken') { R(g, 4, 13, 4, 1, '#5a2a20'); } else { R(g, 4, 13, 4, 1, variant === 'ok' ? '#d03a2a' : '#5a2a2a'); }  // taillight
  R(g, 5, 14, 2, 2, '#5a5f68');                                                                          // exhaust
  ell(g, 6, 19, 3.5, 2.5, tyreEdge); ell(g, 6, 19, 2.6, 1.6, rim); ell(g, 6, 19, 1.5, 0.9, tyre);       // near rear wheel
}
/** Cargo crate strapped to the rack: 7×5, wooden, pixel-straps. Drawn over the bike when it carries cargo. */
export function drawVehicleCrate(g: G) {
  R(g, 0, 0, 7, 5, '#8a5e30'); R(g, 0, 0, 7, 1, '#b8864a'); R(g, 0, 4, 7, 1, '#5a3a22');
  R(g, 3, 0, 1, 5, '#6a4424'); P(g, 1, 2, '#c89a60');
}

// ---- Industrial: refinery column --------------------------------------------------------------------------
/** Oil refinery, 16×24: a distillation column on a skirt, a copper-teal shell with rings and a sight glass. */
export function drawRefinery(g: G, state: 'idle' | 'lit') {
  const lit = state === 'lit';
  R(g, 2, 19, 12, 4, '#4a5258');                                    // skirt
  R(g, 4, 4, 8, 16, '#3f7f7a'); R(g, 4, 4, 2, 16, '#5fa39c'); R(g, 10, 4, 2, 16, '#2c5a57'); // column
  R(g, 3, 7, 10, 1, '#23403e'); R(g, 3, 13, 10, 1, '#23403e');     // rings
  ell(g, 8, 4, 4, 2, '#8fc2b8');                                    // cap
  R(g, 6, 9, 4, 3, '#16262a');                                      // sight glass
  if (lit) { R(g, 6, 9, 4, 3, '#8fd19b'); P(g, 7, 10, '#e4ffe8'); }
  R(g, 12, 10, 3, 2, '#9aa3ad'); R(g, 14, 10, 1, 6, '#9aa3ad');    // outlet pipe
  R(g, 1, 12, 3, 1, '#c03a2a'); P(g, 2, 11, '#c03a2a');             // valve wheel
  if (lit) { R(g, 6, 20, 4, 3, '#ff8a2a'); R(g, 7, 21, 2, 1, '#ffe070'); }  // burner
  else R(g, 6, 20, 4, 3, '#2a1a14');
}

// ---- Icon: machine lubricant jug (distinct from the can used by oil/canister) ---------------------------------
export function drawLubricantJug(g: G, c1: string, c2: string) {
  R(g, 6, 2, 4, 2, '#4a4e56');                                      // cap
  R(g, 7, 4, 2, 1, '#9aa3ad');                                      // neck
  R(g, 4, 5, 8, 9, c1); R(g, 5, 6, 2, 7, c2);                       // body + gloss
  R(g, 11, 7, 2, 5, c1); R(g, 12, 8, 1, 3, '#16241c');              // handle hole
  R(g, 4, 12, 8, 1, '#1a2e24');                                     // base shade
  P(g, 7, 9, '#e4ffe8');
}

// ---- B05-R oil pump: pump-jack on an authorized source ---------------------------------------------------
/** Pump state from real state only: dry = its source is empty; run = fuelled and a cycle is queued; idle otherwise. */
export function pumpStateKey(burn: number | undefined, queueLength: number, sourceStock: number | undefined): 'idle' | 'run' | 'dry' {
  if (!sourceStock || sourceStock <= 0) return 'dry';
  return (burn ?? 0) > 0 && queueLength > 0 ? 'run' : 'idle';
}
/** Pump jack, 20×24: A-frame on a pad, walking beam pivoting on top, horse head at the left end, counterweight at the right.
 *  Running = the beam seesaws one pixel between frames; dry = red lamp and a rust-dulled head; idle = amber lamp, still beam. */
export function drawOilPump(g: G, state: 'idle' | 'run' | 'dry', frame: 0 | 1 = 0) {
  const run = state === 'run', dry = state === 'dry';
  const steel = '#7a828a', dark = '#3a3f4a', head = dry ? '#6a3a2a' : '#c8502e';
  R(g, 1, 21, 18, 3, '#4a5258'); R(g, 2, 20, 16, 1, '#5b636b');                 // pad
  R(g, 4, 16, 2, 5, '#5b636b'); R(g, 14, 16, 2, 5, '#5b636b');                  // feet
  // A-frame: two legs meeting at the apex (x 9-10, y 9)
  for (let k = 0; k < 8; k++) { R(g, 5 + k, 16 - k, 1, 2, steel); R(g, 14 - k, 16 - k, 1, 2, steel); }
  R(g, 9, 8, 2, 2, steel); R(g, 8, 9, 4, 1, '#2a2f35');                          // apex + pivot bearing
  // walking beam: rocks about the pivot. Frame 1 lowers the head end by one pixel and raises the counterweight.
  const dy = run ? (frame === 0 ? 0 : 1) : 0;
  R(g, 2, 7 + dy, 16, 2, '#9aa3ad');                                             // beam
  R(g, 0, 5 + dy, 4, 6, head); P(g, 1, 6 + dy, dry ? '#8a5040' : '#f08a5a');   // horse head (left)
  R(g, 16, 9 - dy, 3, 3, dark);                                                  // counterweight (right)
  R(g, 17, 12 - dy, 1, 4, dark);                                                 // counterweight rod
  // polished rod + wellhead down to the output valve
  R(g, 6, 10 + dy, 1, 8, '#9aa3ad');
  R(g, 5, 18, 5, 2, '#2a2f35'); R(g, 10, 18, 1, 3, '#9aa3ad'); R(g, 10, 19, 4, 1, '#9aa3ad');  // outlet
  R(g, 12, 17, 2, 3, '#2a2f35');                                                 // output valve
  // status lamp on the apex: amber idle, green running, red dry (from state, not text)
  R(g, 9, 4, 2, 3, dry ? '#ff5a4a' : run ? '#8fd19b' : '#d8a040');
  P(g, 9, 4, dry ? '#ffd0c8' : '#f4ffe8');
}
/** Crude drum (16×16): a cylindrical steel drum. Rounded ends, a bulged body, four light hoops, cylinder shading
 *  (lit left, shaded right), and a crude-coloured body with a gold sheen. Not a box: no label, no latch. */
export function drawCrudeDrum(g: G, c1: string, c2: string) {
  const outline = '#0c0a08', hoop = '#c4ccd4', hoopDk = '#6b7480', lit = '#9a7f5e';
  R(g, 5, 1, 6, 1, outline);                       // top cap curve
  R(g, 3, 2, 10, 1, outline);
  R(g, 2, 3, 1, 9, outline); R(g, 13, 3, 1, 9, outline); // bulged sides
  R(g, 3, 12, 10, 1, outline);                     // bottom curve
  R(g, 5, 13, 6, 1, outline);
  R(g, 3, 3, 10, 9, c2);                           // body
  R(g, 11, 3, 2, 9, c1);                           // shaded cylinder side
  R(g, 3, 4, 1, 7, lit);                           // lit cylinder edge
  R(g, 3, 3, 10, 1, hoop); R(g, 3, 6, 10, 1, hoop); R(g, 3, 9, 10, 1, hoop); R(g, 3, 11, 10, 1, hoop); // four hoops
  R(g, 3, 7, 10, 1, hoopDk); R(g, 3, 10, 10, 1, hoopDk);
  P(g, 5, 4, '#e8c070'); P(g, 6, 4, '#e8c070');     // gold crude sheen on the lit side
  R(g, 7, 13, 2, 2, hoop);                         // tap
}

/** Paid parcel (16×16): a light kraft shipping box with a dark outline, a darker top flap, a white tape strip and a white address label.
 *  Lighter and taller than the round brown loot bag, so it stands out on the brown building floor and on grass. */
export function drawParcel(g: G) {
  const edge = '#2a1a10', kraft = '#e8bf7e', flap = '#c48a4c', shade = '#a46a36', tape = '#f6f0d8', label = '#fffdf2', ink = '#2e5a8a';
  R(g, 1, 3, 14, 12, edge);                      // dark outline
  R(g, 2, 4, 12, 10, kraft);                     // box body (light kraft)
  R(g, 2, 4, 12, 3, flap);                       // top flap, darker band
  R(g, 7, 4, 2, 10, tape);                       // white tape strip down the centre
  R(g, 2, 12, 12, 2, shade);                     // bottom shade
  R(g, 3, 8, 4, 3, label); P(g, 4, 9, ink); P(g, 5, 9, ink); P(g, 4, 10, ink); // address label with ink
  R(g, 10, 8, 3, 3, label);                      // second label stub
}
