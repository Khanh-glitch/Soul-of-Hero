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
  ell(g, 6, 11, 3.2, 3.2, tyre); ell(g, 6, 11, 1.4, 1.4, hub);
  ell(g, 18, 11, 3.2, 3.2, tyre); ell(g, 18, 11, 1.4, 1.4, hub);
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
