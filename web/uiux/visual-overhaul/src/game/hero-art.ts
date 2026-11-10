// ============================================================================
// SOUL OF HEROES — VISUAL ARENA · hero animation reconstruction
// Original pixel artwork painted on a fixed 16x24 grid. No third-party sprites.
//
// Design notes (why these poses exist):
//  * The old set was idle[2] / walk[4] / wind[1] / hit[1] / roll[4] / dead[1].
//    The walk had no vertical hip transfer, so the body floated at a constant
//    height while the legs scissored — it read as skating at 1x.
//  * New walk is a 6-frame contact / down / pass cycle: the pelvis drops 1px on
//    contact, rises 1px on pass, and the boots land on a FIXED ground line so
//    the feet stop sliding. Stride length is symmetric across the two contacts.
//  * Attack is now anticipation -> contact -> follow-through -> recovery, keyed
//    off the engine's own act.contact timestamp (no new i-frames, no new hitbox).
//  * A dedicated `cast` pose (arms forward, cloak flare) separates Core casting
//    from melee windup, and `laden` gives heavy-load travel its own hunched gait.
//  * Silhouette: hooded field coat with an asymmetric shoulder cape and a bedroll
//    on the back, so the character is identifiable from the outline alone.
// ============================================================================
import { mk, type Sprite, type HeroSet } from './art';

type G = CanvasRenderingContext2D;
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
const P = (g: G, x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };

interface Pal {
  coat: string; coatD: string; coatL: string; hair: string; hairD: string;
  skin: string; skinD: string; pants: string; pantsD: string; boot: string;
  strap: string; brass: string; rim: string; eye: string;
}
const MALE: Pal = {
  coat: '#b4532a', coatD: '#6f3018', coatL: '#d8783c', hair: '#4a3320', hairD: '#2c1d12',
  skin: '#e8b48c', skinD: '#b07850', pants: '#343a4c', pantsD: '#232838', boot: '#241a14',
  strap: '#6a4a2a', brass: '#d8a44a', rim: '#ffd9a8', eye: '#1b1220',
};
const FEMALE: Pal = {
  coat: '#2f8f8a', coatD: '#1a555c', coatL: '#4cb8ae', hair: '#b4482a', hairD: '#7a2c18',
  skin: '#f0c09c', skinD: '#c08a68', pants: '#3a3450', pantsD: '#272238', boot: '#241a14',
  strap: '#8a6a3a', brass: '#e0c070', rim: '#ffe6c8', eye: '#1b1220',
};

export type Pose = 'idle' | 'walk' | 'wind' | 'strike' | 'recover' | 'hit' | 'cast' | 'laden' | 'pull' | 'work' | 'vault' | 'ride';

/** ground line the boots must touch every frame (sprite is 24 tall, drawn at Y-19) */
const FLOOR = 22;

// -- head -------------------------------------------------------------------
function head(g: G, ox: number, oy: number, dir: number, p: Pal, female: boolean, blink: boolean) {
  const side = dir === 1 || dir === 2, flip = dir === 1, back = dir === 3;
  const M = (x: number) => flip ? 9 - x : x;           // mirror inside the 10px head box
  const px = (x: number, y: number, c: string) => P(g, ox + (flip ? M(x) : x), oy + y, c);
  const rr = (x: number, y: number, w: number, h: number, c: string) => R(g, ox + (flip ? 9 - x - w + 1 : x), oy + y, w, h, c);

  // hood / hair mass — 9 wide, deliberately wider than the neck for silhouette
  rr(1, 0, 7, 1, p.hairD);
  rr(0, 1, 9, 5, p.hair);
  rr(0, 1, 9, 1, p.hairD);
  px(1, 1, p.rim); px(2, 0, p.rim);                    // NW rim light, one pixel only
  rr(0, 6, 9, 1, p.hairD);

  if (back) {
    rr(1, 2, 7, 5, p.hair);
    px(2, 3, p.hairD); px(6, 4, p.hairD);
    if (female) { rr(3, 6, 3, 5, p.hair); rr(4, 10, 1, 2, p.hairD); px(3, 11, p.brass); }
    return;
  }
  // face
  const fx = side ? 3 : 1, fw = side ? 6 : 7;
  rr(fx, 2, fw, 5, p.skin);
  rr(fx, 6, fw, 1, p.skinD);
  if (side) { rr(flip ? 0 : 7, 2, 2, 5, p.hair); }
  // eyes: 2px apart front, single eye in profile; blink closes to a lash line
  if (side) {
    const ex = 6;
    if (blink) px(ex, 4, p.skinD); else { px(ex, 4, p.eye); px(ex, 3, p.skinD); }
  } else {
    if (blink) { px(2, 4, p.skinD); px(6, 4, p.skinD); }
    else { px(2, 4, p.eye); px(6, 4, p.eye); px(2, 3, p.skinD); px(6, 3, p.skinD); }
    px(4, 5, p.skinD);                                  // nose shadow
  }
  // fringe over the brow keeps the hood read at 1x
  rr(fx, 1, fw, 1, p.hairD);
  if (female && side) { const bx = flip ? 8 : 0; rr(bx, 5, 1, 6, p.hair); px(bx, 11, p.brass); }
  if (female && !side && !back) { rr(0, 5, 1, 4, p.hair); rr(8, 5, 1, 4, p.hair); }
}

// -- boots + legs -----------------------------------------------------------
/** legPhase: -1 back, 0 under, +1 forward. Feet always resolve onto FLOOR. */
function leg(g: G, x: number, top: number, phase: number, lift: number, p: Pal, dark: boolean) {
  const len = FLOOR - top - lift;
  const c = dark ? p.pantsD : p.pants;
  R(g, x + phase, top, 2, Math.max(2, len), c);
  if (!dark) P(g, x + phase, top, p.pants);
  // boot: 3px long, points in the travel direction, sole sits exactly on FLOOR
  R(g, x + phase - (phase < 0 ? 1 : 0), FLOOR - lift - 1, 3, 1, p.boot);
  P(g, x + phase + (phase > 0 ? 2 : phase < 0 ? -1 : 2), FLOOR - lift - 2, p.boot);
  P(g, x + phase, FLOOR - lift - 1, '#3a2c22');
}

function drawHero(g: G, dir: number, pose: Pose, f: number, female: boolean) {
  const p = female ? FEMALE : MALE;
  const side = dir === 1 || dir === 2, flip = dir === 1, back = dir === 3;

  // ---- timing curves -----------------------------------------------------
  // 6-frame walk: 0 contact(R fwd) 1 down 2 pass 3 contact(L fwd) 4 down 5 pass
  const wf = f % 6;
  const strideA = [2, 1, 0, -2, -1, 0][wf];
  const strideB = [-2, -1, 0, 2, 1, 0][wf];
  const liftA = [0, 0, 2, 0, 0, 0][wf];
  const liftB = [0, 0, 0, 0, 0, 2][wf];
  const hipBob = [0, 1, -1, 0, 1, -1][wf];            // pelvis: lowest on contact, highest on pass

  let bob = 0, lean = 0, crouch = 0, armSwing = 0;
  if (pose === 'walk') { bob = hipBob; armSwing = [1, 1, 0, -1, -1, 0][wf]; }
  else if (pose === 'laden') { bob = [0, 1, 0, 0, 1, 0][wf]; crouch = 1; armSwing = [1, 0, 0, -1, 0, 0][wf]; }
  else if (pose === 'pull') { bob = [0, 1, 0, 0, 1, 0][wf]; crouch = 1; lean = 2; armSwing = 0; }
  else if (pose === 'work') { crouch = 1; lean = 1; bob = f % 2; }
  else if (pose === 'vault') { crouch = 1; bob = -2; lean = 1; }
  else if (pose === 'ride') { crouch = 1; lean = 1; bob = [0, 0, 1][f % 3]; }
  else if (pose === 'idle') { bob = f === 1 ? 0 : 0; crouch = f === 1 ? 0 : 0; }
  else if (pose === 'wind') { lean = -1; crouch = 1; bob = 1; }
  else if (pose === 'strike') { lean = 2; crouch = f === 0 ? 0 : 1; bob = f === 0 ? -1 : 0; }
  else if (pose === 'recover') { lean = 1; crouch = 1; }
  else if (pose === 'hit') { lean = -2; crouch = 1; bob = 1; }
  else if (pose === 'cast') { lean = f === 0 ? -1 : 1; crouch = f === 0 ? 1 : 0; }

  // lean is applied in screen space along the facing axis
  const lx = side ? (flip ? -lean : lean) : 0;
  const ly = side ? 0 : (dir === 0 ? lean : -lean);
  const breathe = pose === 'idle' && f === 1 ? 1 : 0;

  const hipY = 15 + crouch + (pose === 'walk' || pose === 'laden' || pose === 'ride' ? bob : 0);
  const torsoY = 9 + crouch + ly + breathe + (pose === 'walk' || pose === 'laden' || pose === 'ride' ? Math.max(0, bob) : 0);
  const headY = 1 + crouch + ly + breathe + (pose === 'walk' || pose === 'laden' || pose === 'ride' ? Math.max(0, bob) : 0);

  // ---- legs (behind the coat) -------------------------------------------
  if (pose === 'vault') {
    // mid-vault over the saddle: knees tucked up off the floor
    R(g, 5 + lx, hipY - 1, 3, 3, p.pants); R(g, 9 + lx, hipY - 2, 3, 3, p.pantsD);
    R(g, 4 + lx, hipY + 2, 3, 1, p.boot); R(g, 10 + lx, hipY + 1, 3, 1, p.boot);
  } else if (pose === 'ride') {
    // Keep the same Adventurer silhouette, bending the knees over the tank and
    // tucking both feet onto the bike's foot pegs rather than hiding the legs.
    if (side) {
      R(g, 6 + lx, hipY - 1, 4, 3, p.pants);
      R(g, 9 + lx, hipY + 1, 3, 2, p.pantsD);
      R(g, 10 + lx, hipY + 3, 3, 1, p.boot);
      P(g, 12 + lx, hipY + 2, '#3a2c22');
    } else {
      R(g, 5 + lx, hipY - 1, 3, 3, p.pants);
      R(g, 9 + lx, hipY - 1, 3, 3, p.pantsD);
      R(g, 4 + lx, hipY + 2, 3, 1, p.boot);
      R(g, 10 + lx, hipY + 2, 3, 1, p.boot);
    }
  } else if (pose === 'walk' || pose === 'laden' || pose === 'pull') {
    const sp = pose === 'laden' || pose === 'pull' ? 0.65 : 1;
    if (side) {
      leg(g, 7 + lx, hipY, Math.round(strideB * sp), liftB, p, true);
      leg(g, 7 + lx, hipY, Math.round(strideA * sp), liftA, p, false);
    } else {
      const spread = dir === 0 ? 1 : 1;
      leg(g, 5 + lx, hipY, 0, liftA, p, false);
      leg(g, 9 + lx - spread + 1, hipY, 0, liftB, p, true);
      // vertical travel reads as toward/away: shorten the trailing leg
      if (liftA) R(g, 5 + lx, FLOOR - 1, 3, 1, p.boot);
    }
  } else if (pose === 'wind' || pose === 'cast') {
    // braced stance: back foot planted wide, front foot turned in
    if (side) { leg(g, 6 + lx, hipY, -2, 0, p, true); leg(g, 8 + lx, hipY, 1, 0, p, false); }
    else { leg(g, 4 + lx, hipY, 0, 0, p, false); leg(g, 10 + lx, hipY, 0, 0, p, true); }
  } else if (pose === 'strike') {
    if (side) { leg(g, 5 + lx, hipY, -2, 0, p, true); leg(g, 9 + lx, hipY, 2, 0, p, false); }
    else { leg(g, 4 + lx, hipY, 0, 0, p, false); leg(g, 10 + lx, hipY, 0, 1, p, true); }
  } else {
    if (side) { leg(g, 7 + lx, hipY, 0, 0, p, true); leg(g, 8 + lx, hipY, 0, 0, p, false); }
    else { leg(g, 5 + lx, hipY, 0, 0, p, false); leg(g, 9 + lx, hipY, 0, 0, p, true); }
  }

  // ---- coat / torso ------------------------------------------------------
  const tw = 8, tx = 4 + lx;
  R(g, tx, torsoY, tw, 7 - crouch, p.coat);
  R(g, tx, torsoY, tw, 1, p.coatL);                                  // lit shoulder line
  R(g, flip ? tx : tx + tw - 2, torsoY + 1, 2, 6 - crouch, p.coatD);  // shaded far side
  R(g, tx, torsoY + 5 - crouch, tw, 1, p.strap);                     // belt
  P(g, tx + (flip ? 5 : 2), torsoY + 5 - crouch, p.brass);           // buckle
  // asymmetric shoulder cape — the silhouette signature
  const capeX = flip ? tx + 5 : tx;
  R(g, capeX, torsoY, 3, 4, p.coatD);
  P(g, capeX + (flip ? 2 : 0), torsoY, p.rim);
  // coat tails split when moving so the legs stay visible
  if (pose === 'walk' || pose === 'laden' || pose === 'strike' || pose === 'ride') {
    R(g, tx, torsoY + 6 - crouch, 3, 2, p.coatD);
    R(g, tx + 5, torsoY + 6 - crouch, 3, 2, p.coat);
  } else R(g, tx, torsoY + 6 - crouch, tw, 1, p.coatD);

  if (back) {
    // bedroll + pack: makes the away-facing read instantly
    R(g, tx + 1, torsoY + 1, 6, 4, p.strap);
    R(g, tx + 1, torsoY + 1, 6, 1, '#8a6636');
    R(g, tx + 2, torsoY + 2, 4, 2, '#5a4028');
    P(g, tx + 1, torsoY + 5, p.brass); P(g, tx + 6, torsoY + 5, p.brass);
  } else if (!side) {
    P(g, tx + 3, torsoY + 2, p.brass); P(g, tx + 4, torsoY + 2, p.brass);
  }

  // ---- arms --------------------------------------------------------------
  const armY = torsoY + 1;
  const skinTip = (x: number, y: number) => { P(g, x, y, p.skin); P(g, x, y + 1, p.skinD); };
  if (pose === 'ride' && side) {
    // Hands meet the grips. The forearms connect to the same torso and palette
    // as the walking character; only the seated pose changes.
    if (flip) { R(g, 1 + lx, armY, 4, 2, p.coatD); skinTip(1 + lx, armY + 1); }
    else { R(g, 10 + lx, armY, 4, 2, p.coatD); skinTip(13 + lx, armY + 1); }
    R(g, flip ? 5 + lx : 8 + lx, armY + 3, 2, 2, p.coat);
  } else if (pose === 'ride') {
    // Front/back bars span both hands; wrists sit at handlebar height.
    R(g, 2 + lx, armY + 1, 3, 2, p.coatD); skinTip(2 + lx, armY + 2);
    R(g, 11 + lx, armY + 1, 3, 2, p.coatD); skinTip(13 + lx, armY + 2);
  } else if (pose === 'pull') {
    // reaching back to grip the cart shafts while leaning forward
    const reachX = flip ? 11 : 2;
    R(g, reachX, armY + 2, 3, 2, p.coatD); skinTip(flip ? 13 : 1, armY + 2);
  } else if (pose === 'work') {
    // hands forward operating a station or chest
    const nudge = f % 2;
    if (side) { const ax = (flip ? 3 : 10) + (flip ? -nudge : nudge); R(g, ax, armY + 1, 3, 2, p.coatD); skinTip(flip ? ax - 1 : ax + 3, armY + 1); }
    else { R(g, 3, armY + 1 + nudge, 2, 3, p.coatD); R(g, 11, armY + 2 - nudge, 2, 3, p.coatD); }
  } else if (pose === 'vault') {
    R(g, 3 + lx, armY + 2, 2, 3, p.coatD); R(g, 11 + lx, armY + 2, 2, 3, p.coatD);
  } else if (pose === 'cast') {
    // both arms forward, palms open — unmistakably not a melee windup
    const reach = f === 0 ? 1 : 3;
    if (side) { const ax = (flip ? 3 : 10) + (flip ? -reach : reach); R(g, Math.min(ax, flip ? ax : 9), armY + 1, reach + 2, 2, p.coatD); skinTip(flip ? ax - 1 : ax + reach + 1, armY + 1); }
    else { R(g, 2, armY + 1, 2, 2, p.coatD); R(g, 12, armY + 1, 2, 2, p.coatD); skinTip(2, armY + 3); skinTip(13, armY + 3); }
  } else if (pose === 'wind') {
    const ax = flip ? 11 : 3; R(g, ax, armY - 2, 2, 4, p.coatD); skinTip(ax, armY - 3);
    R(g, flip ? 4 : 10, armY + 1, 2, 4, p.coat);
  } else if (pose === 'strike') {
    const ax = flip ? 2 : 12; R(g, ax, armY + 1, 2, 3, p.coatD); skinTip(ax, armY + 4);
    R(g, flip ? 11 : 3, armY + 2, 2, 3, p.coat);
  } else if (pose === 'hit') {
    R(g, 2 + lx, armY - 1, 2, 4, p.coatD); R(g, 12 + lx, armY - 1, 2, 4, p.coatD);
    skinTip(2 + lx, armY - 2); skinTip(13 + lx, armY - 2);
  } else if (side) {
    const ax = (flip ? 5 : 9) + lx + armSwing;
    R(g, ax, armY, 2, 5, p.coatD); skinTip(ax, armY + 5);
  } else {
    R(g, 3 + lx, armY + armSwing, 1, 5, p.coatD); R(g, 12 + lx, armY - armSwing, 1, 5, p.coatD);
    skinTip(3 + lx, armY + 5 + armSwing); skinTip(12 + lx, armY + 5 - armSwing);
  }

  // ---- head --------------------------------------------------------------
  head(g, 3 + lx, headY, dir, p, female, pose === 'idle' && f === 1);

  // hurt flash accent: a couple of impact pixels, not a full white sprite
  if (pose === 'hit') { P(g, 2, headY + 2, '#ff8a6a'); P(g, 13, headY + 4, '#ff8a6a'); P(g, 1, headY + 6, '#ffb0a0'); }
}

function drawRoll(g: G, f: number, female: boolean) {
  const p = female ? FEMALE : MALE;
  // 6-frame tuck: compress -> rotate -> extend, with a directional dust smear
  const t = f / 6, r = 6 - Math.abs(3 - f) * 0.35;
  const cy = 16 - Math.sin(t * Math.PI) * 2;
  for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
    const nx = x / r, ny = y / (r * 0.86); const d = nx * nx + ny * ny;
    if (d > 1) continue;
    const a = Math.atan2(ny, nx) + t * Math.PI * 2;
    const band = Math.sin(a * 2);
    const c = d > 0.78 ? p.coatD : band > 0.45 ? p.coatL : band > -0.2 ? p.coat : p.pants;
    P(g, 8 + x, cy + y, c);
  }
  // boot kicking out of the tuck on the extension frames
  if (f >= 3) { R(g, 11 + (f - 3), cy + 2, 3, 2, p.boot); }
  P(g, 6, cy - 4, p.rim);
}

function drawDead(g: G, female: boolean) {
  const p = female ? FEMALE : MALE;
  R(g, 2, 18, 5, 4, p.hair); R(g, 3, 19, 3, 2, p.skinD);
  R(g, 6, 17, 8, 5, p.coat); R(g, 6, 17, 8, 1, p.coatD);
  R(g, 13, 19, 3, 3, p.pants); R(g, 15, 20, 2, 2, p.boot);
  P(g, 7, 19, p.brass);
}

/** Pose set consumed by render.ts. Keys are stable; frame counts are declared
 *  here so the renderer never hard-codes an animation length again. */
export const HERO_FRAMES = { idle: 2, walk: 6, wind: 2, strike: 2, recover: 1, hit: 1, cast: 2, laden: 6, pull: 6, work: 2, vault: 1, ride: 3, roll: 6, dead: 1 } as const;

export function buildHeroV2(female: boolean): HeroSet {
  const set: HeroSet = {};
  const poses: Pose[] = ['idle', 'walk', 'wind', 'strike', 'recover', 'hit', 'cast', 'laden', 'pull', 'work', 'vault', 'ride'];
  for (let dir = 0; dir < 4; dir++) {
    for (const pose of poses) {
      const n = HERO_FRAMES[pose as keyof typeof HERO_FRAMES];
      set[pose + dir] = Array.from({ length: n }, (_, f) => mk(16, 24, g => drawHero(g, dir, pose, f, female)));
    }
  }
  set.roll = Array.from({ length: HERO_FRAMES.roll }, (_, f) => mk(16, 24, g => drawRoll(g, f, female)));
  set.dead = [mk(16, 24, g => drawDead(g, female))];
  return set;
}
