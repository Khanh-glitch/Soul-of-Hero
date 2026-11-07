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
/** Side view, 24×16, heading right. Rider space above the seat; cargo rack behind the seat. */
export function drawVehicleSide(g: G, state: 'ok' | 'dead') {
  const dead = state === 'dead';
  const tyre = '#1b1d24', hub = '#7a808c';
  // wheels: light rim ring so the tyres separate from dark grass and night overlay; tread highlight; hub
  ell(g, 6, 11, 3.8, 3.8, '#59606e'); ell(g, 6, 11, 3.0, 3.0, tyre); P(g, 4, 9, '#8a92a0'); ell(g, 6, 11, 1.4, 1.4, hub);
  ell(g, 18, 11, 3.8, 3.8, '#59606e'); ell(g, 18, 11, 3.0, 3.0, tyre); P(g, 16, 9, '#8a92a0'); ell(g, 18, 11, 1.4, 1.4, hub);
  R(g, 9, 9, 6, 3, '#3a3f4a');                                  // engine block
  R(g, 2, 9, 5, 1, '#5a5f68'); P(g, 1, 10, '#3a3a40');           // exhaust
  R(g, 6, 8, 12, 2, '#4e7280'); R(g, 6, 8, 12, 1, '#7ea4b4');    // frame
  R(g, 4, 5, 5, 1, '#8a8f98');                                  // cargo rack
  R(g, 8, 6, 5, 2, '#23232b');                                  // seat
  R(g, 9, 3, 7, 3, dead ? '#6a3a2c' : '#c8502e');                // tank
  R(g, 9, 3, 7, 1, dead ? '#8a5040' : '#f08a5a');
  if (dead) { P(g, 12, 4, '#5a3020'); P(g, 14, 5, '#5a3020'); }  // rust
  R(g, 18, 4, 1, 5, '#9aa3ad'); R(g, 17, 3, 3, 1, '#9aa3ad');    // fork + bar
  R(g, 19, 6, 2, 2, dead ? '#3a3a42' : '#ffe27a');                 // headlamp
  if (!dead) P(g, 20, 6, '#fff8d0');
}
/** Head-on view (heading down, toward the viewer), 12×22. Headlamp at the bottom end. */
export function drawVehicleFront(g: G, state: 'ok' | 'dead') {
  const dead = state === 'dead';
  const tyre = '#1b1d24', hub = '#7a808c';
  ell(g, 6, 4, 3, 2.5, tyre); ell(g, 6, 4, 1.2, 1.2, hub);          // rear wheel (far, top)
  R(g, 5, 6, 2, 7, '#4e7280'); R(g, 5, 6, 1, 7, '#7ea4b4');          // frame
  R(g, 4, 6, 4, 2, '#23232b');                                      // seat
  R(g, 3, 8, 6, 4, dead ? '#6a3a2c' : '#c8502e');                    // tank
  R(g, 3, 8, 6, 1, dead ? '#8a5040' : '#f08a5a');
  R(g, 4, 12, 4, 1, '#9aa3ad');                                     // bar
  R(g, 5, 13, 2, 2, '#3a3f4a');                                     // engine
  ell(g, 6, 18, 3, 2.5, tyre); ell(g, 6, 18, 1.2, 1.2, hub);        // front wheel
  R(g, 4, 14, 4, 2, dead ? '#3a3a42' : '#ffe27a');                   // headlamp at the nose
  if (!dead) P(g, 5, 14, '#fff8d0');
}
/** Tail view (heading up, away from the viewer): same silhouette, red taillight at the far end. */
export function drawVehicleBack(g: G, state: 'ok' | 'dead') {
  const dead = state === 'dead';
  const tyre = '#1b1d24', hub = '#7a808c';
  ell(g, 6, 18, 3, 2.5, tyre); ell(g, 6, 18, 1.2, 1.2, hub);        // rear wheel (near, bottom)
  R(g, 5, 9, 2, 7, '#4e7280'); R(g, 5, 9, 1, 7, '#7ea4b4');
  R(g, 4, 14, 4, 2, '#23232b');
  R(g, 3, 10, 6, 4, dead ? '#6a3a2c' : '#c8502e');
  R(g, 3, 13, 6, 1, dead ? '#8a5040' : '#f08a5a');
  R(g, 4, 8, 4, 1, '#9aa3ad');
  R(g, 5, 6, 2, 2, '#3a3f4a');
  ell(g, 6, 4, 3, 2.5, tyre); ell(g, 6, 4, 1.2, 1.2, hub);          // front wheel (far, top)
  R(g, 4, 6, 4, 2, dead ? '#3a1a1a' : '#d03a2a');                    // taillight
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
