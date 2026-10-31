// ---------------------------------------------------------------------------
// ARCANA :: World — the "force" layer (see docs/VFX_DOCTRINE.md).
// Camera trauma / kick / zoom / focus, hit-stop, speed ramps, inhale,
// impact frames, refractive shockwaves, and the damage API that spells use
// to act on enemies. Fully deterministic: stepped by the Lab's fixed clock.
// ---------------------------------------------------------------------------

import { RGB, clamp, lerp, vnoise, hash2 } from "./math";
import { VIEW_W, VIEW_H } from "./arena";
import { Enemy, makeFormation, updateEnemy, damageEnemy, killEnemy, DeathKind } from "./enemies";

export type Element = "fire" | "water" | "ice" | "volt" | "verdant" | "astral";

export const ELEMENT_TINT: Record<Element, RGB> = {
  fire: [2.2, 0.85, 0.22],
  water: [0.45, 1.25, 2.2],
  ice: [1.1, 1.75, 2.5],
  volt: [1.1, 1.35, 2.9],
  verdant: [0.8, 2.0, 0.65],
  astral: [1.8, 0.85, 2.6],
};

export interface HitOpts {
  element: Element;
  dmg?: number;
  force?: number;
  dirx?: number;
  diry?: number;
  lift?: number;
  status?: number;
  hitstop?: number;
  cut?: number; // slice angle -> "cut" death
}
export interface ImpactOpts extends HitOpts {
  radius?: number;
  frame?: boolean;
  shake?: number;
  wave?: number;
  zoom?: number;
  ramp?: number;
}

export interface Wave {
  x: number;
  y: number;
  age: number;
  speed: number;
  width: number;
  amp: number;
  life: number;
  squash: number;
  tint: RGB;
}
export interface Popup {
  x: number;
  y: number;
  val: number;
  age: number;
  col: RGB;
  big: boolean;
}
export interface FxP {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  kind: number; // 0 ember 1 dust 2 spark 3 spore 4 droplet 5 frost
  seed: number;
}
export interface Zap {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  life: number;
  max: number;
  seed: number;
  tint: RGB;
}

export class World {
  simT = 0;
  clock = 0;
  hitstop = 0;
  stopDelay = 0;
  pendingStop = 0;
  rampFrom = 1;
  rampDur = 0;
  rampAge = 1;
  trauma = 0;
  kx = 0;
  ky = 0;
  kvx = 0;
  kvy = 0;
  zoomS = 0;
  zoomV = 0;
  focusX = VIEW_W / 2;
  focusY = VIEW_H / 2;
  focusAmt = 0;
  focusTarget = 0;
  focusHold = 0;
  inhaleAmt = 0;
  inhaleTarget = 0;
  inhaleHold = 0;
  impactFrames = 0;
  impactTint: RGB = [1, 1, 1];
  chroma = 0;
  casterKick = 0;
  casterKickV = 0;
  waves: Wave[] = [];
  popups: Popup[] = [];
  fx: FxP[] = [];
  zaps: Zap[] = [];
  enemies: Enemy[] = [];
  fired = new Set<string>();
  cds = new Map<string, number>();
  seedN = 1;

  reset() {
    this.simT = 0;
    this.clock = 0;
    this.hitstop = 0;
    this.stopDelay = 0;
    this.pendingStop = 0;
    this.rampAge = 1;
    this.rampDur = 0;
    this.trauma = 0;
    this.kx = this.ky = this.kvx = this.kvy = 0;
    this.zoomS = this.zoomV = 0;
    this.focusAmt = this.focusTarget = this.focusHold = 0;
    this.inhaleAmt = this.inhaleTarget = this.inhaleHold = 0;
    this.impactFrames = 0;
    this.chroma = 0;
    this.casterKick = this.casterKickV = 0;
    this.waves = [];
    this.popups = [];
    this.fx = [];
    this.zaps = [];
    this.fired.clear();
    this.cds.clear();
    this.seedN = 1;
    this.enemies = makeFormation();
  }

  rand() {
    return hash2(this.seedN++, 9173);
  }

  // ---------------------------------------------------------------- timing
  once(key: string, cond = true) {
    if (!cond || this.fired.has(key)) return false;
    this.fired.add(key);
    return true;
  }
  timeScale() {
    if (this.stopDelay > 0) return 1;
    if (this.rampDur <= 0 || this.rampAge >= this.rampDur) return 1;
    const u = this.rampAge / this.rampDur;
    return lerp(this.rampFrom, 1, u * u);
  }
  /**
   * Hit-stop. With a delay, the release keeps exploding at full speed for a
   * few frames (under the impact frames) and the freeze then holds on the
   * first big drawing of the explosion, not on an empty onset frame.
   */
  freeze(sec: number, delay = 0) {
    if (delay > 0) {
      this.pendingStop = Math.max(this.pendingStop, sec);
      if (this.stopDelay <= 0) this.stopDelay = delay;
    } else this.hitstop = Math.max(this.hitstop, sec);
  }

  // ---------------------------------------------------------------- camera
  shake(a: number) {
    this.trauma = clamp(this.trauma + a, 0, 1);
  }
  /** tiny per-frame tremor during tension */
  tremor(dt: number, k: number) {
    this.trauma = clamp(Math.max(this.trauma, k), 0, 1);
    void dt;
  }
  kick(vx: number, vy: number) {
    this.kvx += vx;
    this.kvy += vy;
  }
  punch(z: number) {
    this.zoomV += z;
  }
  focus(x: number, y: number, amt: number) {
    this.focusX = x;
    this.focusY = y;
    this.focusTarget = clamp(amt, 0, 1);
    this.focusHold = 0.08;
  }
  inhale(k: number) {
    this.inhaleTarget = clamp(k, 0, 1);
    this.inhaleHold = 0.08;
  }
  camera() {
    const s = clamp(this.trauma) ** 2;
    const c = this.clock;
    const n1 = (vnoise(c * 26, 1.3) - 0.5) * 2;
    const n2 = (vnoise(c * 26, 7.7) - 0.5) * 2;
    const n3 = (vnoise(c * 19, 13.1) - 0.5) * 2;
    const fa = this.focusAmt;
    return {
      x: 10 * s * n1 + this.kx + (VIEW_W / 2 - this.focusX) * fa * 0.3,
      y: 7 * s * n2 + this.ky + (VIEW_H / 2 - this.focusY) * fa * 0.3,
      rot: 0.03 * s * n3,
      zoom: 1 + this.zoomS + fa * 0.07,
    };
  }

  /** real-time tick: runs during hit-stop too (shake keeps going) */
  tick(dt: number) {
    this.clock += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.35);
    this.kvx += (-260 * this.kx - 16 * this.kvx) * dt;
    this.kvy += (-260 * this.ky - 16 * this.kvy) * dt;
    this.kx += this.kvx * dt;
    this.ky += this.kvy * dt;
    this.zoomV += (-300 * this.zoomS - 18 * this.zoomV) * dt;
    this.zoomS += this.zoomV * dt;
    this.casterKickV += (-320 * this.casterKick - 18 * this.casterKickV) * dt;
    this.casterKick += this.casterKickV * dt;
    this.focusHold -= dt;
    if (this.focusHold <= 0) this.focusTarget = 0;
    const fr = this.focusTarget > this.focusAmt ? 2.4 : 5;
    this.focusAmt += (this.focusTarget - this.focusAmt) * Math.min(1, dt * fr);
    this.inhaleHold -= dt;
    if (this.inhaleHold <= 0) this.inhaleTarget = 0;
    const ir = this.inhaleTarget > this.inhaleAmt ? 6 : 9;
    this.inhaleAmt += (this.inhaleTarget - this.inhaleAmt) * Math.min(1, dt * ir);
    if (this.impactFrames > 0) this.impactFrames--;
    this.chroma *= Math.exp(-dt * 7);
    if (this.stopDelay > 0) {
      this.stopDelay -= dt;
      if (this.stopDelay <= 0) {
        this.hitstop = Math.max(this.hitstop, this.pendingStop);
        this.pendingStop = 0;
      }
    }
    if (this.hitstop <= 0 && this.stopDelay <= 0) this.rampAge += dt;
  }

  /** simulation update (frozen during hit-stop, scaled by speed ramp) */
  update(dt: number) {
    this.simT += dt;
    for (const w of this.waves) w.age += dt;
    this.waves = this.waves.filter((w) => w.age < w.life);
    for (const e of this.enemies) updateEnemy(e, dt, this);
    for (const p of this.popups) p.age += dt;
    this.popups = this.popups.filter((p) => p.age < 1.0);
    for (const p of this.fx) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.kind === 0 || p.kind === 3) {
        p.vy -= 18 * dt;
        p.vx *= Math.exp(-1.4 * dt);
      } else if (p.kind === 1) {
        p.vx *= Math.exp(-3 * dt);
        p.vy *= Math.exp(-3 * dt);
      } else {
        p.vz -= 320 * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz = -p.vz * 0.3;
          p.vx *= 0.5;
          p.vy *= 0.5;
        }
      }
    }
    this.fx = this.fx.filter((p) => p.life > 0);
    for (const z of this.zaps) z.life -= dt;
    this.zaps = this.zaps.filter((z) => z.life > 0);
  }

  // ---------------------------------------------------------------- beats
  /** TELL: the caster's hand snaps, a tiny freeze, a small refraction */
  castSnap(el: Element, k = 1, x = 111, y = 142) {
    this.casterKickV -= 70 * k;
    this.shake(0.12 * k);
    this.freeze(0.03 * k);
    this.chroma = Math.max(this.chroma, 0.8 * k);
    this.wave(x, y, 1.6 * k, 160, 6, 0.35, el);
    this.punch(0.25 * k);
  }
  /** LAST BEAT */
  settle(k = 1) {
    this.shake(0.07 * k);
    this.punch(-0.2 * k);
  }
  wave(x: number, y: number, amp: number, speed: number, width: number, life: number, el: Element, squash = 1.45) {
    this.waves.push({ x, y, age: 0, speed, width, amp, life, squash, tint: ELEMENT_TINT[el] });
  }
  zap(x0: number, y0: number, x1: number, y1: number, life: number, el: Element = "volt") {
    this.zaps.push({ x0, y0, x1, y1, life, max: life, seed: this.seedN++, tint: ELEMENT_TINT[el] });
  }
  emit(p: Omit<FxP, "max" | "seed">) {
    if (this.fx.length > 900) return;
    this.fx.push({ ...p, max: p.life, seed: this.seedN++ });
  }

  /** the central STRIKE call */
  impact(x: number, y: number, o: ImpactOpts) {
    const f = o.force ?? 1;
    this.freeze(o.hitstop ?? 0.03 + f * 0.09, f >= 0.6 ? 0.05 : 0);
    this.rampFrom = o.ramp ?? clamp(0.62 - f * 0.18, 0.3, 0.9);
    this.rampDur = 0.1 + f * 0.12;
    this.rampAge = 0;
    this.shake(o.shake ?? 0.2 + f * 0.4);
    const dx = VIEW_W / 2 - x,
      dy = VIEW_H / 2 - y;
    const dl = Math.hypot(dx, dy) || 1;
    this.kick((dx / dl) * f * 110 + (o.dirx ?? 0) * f * 60, (dy / dl) * f * 80 + (o.diry ?? 0) * f * 60);
    this.punch(o.zoom ?? f * 0.9);
    if (o.frame ?? f >= 1) {
      this.impactFrames = 3;
      this.impactTint = ELEMENT_TINT[o.element];
    }
    this.chroma = Math.max(this.chroma, 1 + f * 2.2);
    const wa = o.wave ?? 1;
    if (wa > 0) this.wave(x, y, wa * (2 + f * 4), 230 + f * 160, 8 + f * 8, 0.55 + f * 0.3, o.element);
    const R = o.radius ?? 80;
    if (R > 0 && (o.dmg ?? 0) > 0)
      for (const e of this.enemies) {
        if (e.dead) continue;
        const ex = e.x - x,
          ey = (e.y - y) * 1.3;
        const d = Math.hypot(ex, ey);
        if (d > R + 6) continue;
        const fall = 1 - Math.pow(d / (R + 6), 2) * 0.7;
        const nd = d || 1;
        this.hit(
          e,
          {
            ...o,
            dmg: (o.dmg ?? 0) * fall,
            force: f * fall,
            dirx: o.dirx ?? ex / nd,
            diry: o.diry ?? ey / nd,
          },
          false
        );
      }
    // dust kicked up from the floor
    for (let i = 0; i < 10 + f * 16; i++) {
      const a = this.rand() * Math.PI * 2;
      const sp = 30 + this.rand() * 120 * f;
      this.emit({ x, y, z: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 0, life: 0.5 + this.rand() * 0.7, kind: 1 });
    }
  }
  /** a strike without damage — a beat for structure / tells */
  thump(x: number, y: number, force: number, el: Element, extra: Partial<ImpactOpts> = {}) {
    this.impact(x, y, { element: el, force, radius: 0, dmg: 0, frame: false, ...extra });
  }

  hit(e: Enemy, o: HitOpts, solo = true) {
    if (e.dead) return;
    if (solo) {
      const f = o.force ?? 0.4;
      this.freeze(o.hitstop ?? 0.02 + f * 0.04);
      this.shake(0.05 + f * 0.12);
    }
    damageEnemy(e, o, this);
  }
  sweep(key: string, x: number, y: number, r: number, o: HitOpts, cd = 0.4) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, e.y - 6 - y) > r + 6) continue;
      const k = key + ":" + e.id;
      const last = this.cds.get(k);
      if (last !== undefined && this.simT - last < cd) continue;
      this.cds.set(k, this.simT);
      this.hit(e, o, true);
    }
  }
  lineHit(key: string, x0: number, y0: number, x1: number, y1: number, w: number, o: HitOpts, solo = false) {
    const dx = x1 - x0,
      dy = y1 - y0;
    const l2 = dx * dx + dy * dy || 1;
    const hits: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const k = key + ":" + e.id;
      if (this.cds.has(k)) continue;
      const py = e.y - 5;
      const u = clamp(((e.x - x0) * dx + (py - y0) * dy) / l2);
      const qx = x0 + dx * u,
        qy = y0 + dy * u;
      const d = Math.hypot(e.x - qx, py - qy);
      if (d > w + 5) continue;
      this.cds.set(k, this.simT);
      let nx = -dy,
        ny = dx;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      const side = (e.x - qx) * nx + (py - qy) * ny >= 0 ? 1 : -1;
      this.hit(e, { dirx: nx * side, diry: ny * side, ...o }, solo);
      hits.push(e);
    }
    return hits;
  }
  pull(x: number, y: number, R: number, str: number, swirl: number, dt: number, el?: Element) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = x - e.x,
        dy = y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > R) continue;
      const f = (1 - d / R) * (e.root > 0.4 ? 0.25 : 1);
      e.vx += ((dx / d) * str - (dy / d) * swirl) * f * dt / Math.sqrt(e.mass);
      e.vy += ((dy / d) * str + (dx / d) * swirl) * f * dt / Math.sqrt(e.mass);
      e.stagger = Math.max(e.stagger, 0.1);
      if (el === "astral") e.warp = Math.min(1, e.warp + f * dt * 2);
      if (el === "water") e.wet = 1;
    }
  }
  still(dt: number) {
    for (const e of this.enemies) {
      e.vx *= Math.exp(-30 * dt);
      e.vy *= Math.exp(-30 * dt);
    }
  }
  status(x: number, y: number, R: number, el: Element, amt: number) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, (e.y - y) * 1.2) > R) continue;
      applyStatus(e, el, amt);
    }
  }
  kill(e: Enemy, kind: DeathKind) {
    killEnemy(e, kind, this);
  }
  alive() {
    return this.enemies.filter((e) => !e.dead);
  }
  nearest(x: number, y: number) {
    let best: Enemy | null = null,
      bd = 1e9;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }
  popup(x: number, y: number, val: number, el: Element, big: boolean) {
    this.popups.push({ x, y, val, age: 0, col: ELEMENT_TINT[el], big });
  }
}

/** sets a status to at least `amt` (used for sustained fields like frost) */
export function applyStatus(e: Enemy, el: Element, amt: number) {
  switch (el) {
    case "fire":
      e.burn = Math.max(e.burn, amt);
      break;
    case "water":
      e.wet = Math.max(e.wet, amt);
      break;
    case "ice":
      e.freeze = Math.max(e.freeze, amt);
      break;
    case "volt":
      e.shock = Math.max(e.shock, amt);
      break;
    case "verdant":
      e.root = Math.max(e.root, amt);
      break;
    case "astral":
      e.warp = Math.max(e.warp, amt);
      break;
  }
}

export const W = new World();
