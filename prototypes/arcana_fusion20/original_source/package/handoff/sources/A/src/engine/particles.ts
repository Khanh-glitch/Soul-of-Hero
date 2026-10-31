// ---------------------------------------------------------------------------
// ARCANA :: compact particle pool shared by many spells.
// Particles are plain objects in a pool; each system supplies its own update
// and draw so visually unrelated spells never look alike.
// ---------------------------------------------------------------------------

import { Framebuffer } from "./framebuffer";
import { RGB } from "./math";

export interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  seed: number;
  k: number; // generic scalar (heat, charge, mass...)
  a: number; // generic angle
  av: number; // angular velocity
  dead: boolean;
  px: number; // previous position for streaks
  py: number;
  tag: number;
}

export class Pool {
  items: P[] = [];
  spawn(o: Partial<P>): P {
    let p = this.items.find((q) => q.dead);
    if (!p) {
      p = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 1,
        max: 1,
        size: 1,
        seed: 0,
        k: 1,
        a: 0,
        av: 0,
        dead: false,
        px: 0,
        py: 0,
        tag: 0,
      };
      this.items.push(p);
    }
    Object.assign(p, {
      vx: 0,
      vy: 0,
      size: 1,
      k: 1,
      a: 0,
      av: 0,
      tag: 0,
      dead: false,
    });
    Object.assign(p, o);
    p.max = p.life;
    p.px = p.x;
    p.py = p.y;
    return p;
  }
  get alive() {
    return this.items.filter((p) => !p.dead);
  }
  each(fn: (p: P) => void) {
    for (const p of this.items) if (!p.dead) fn(p);
  }
  count() {
    let n = 0;
    for (const p of this.items) if (!p.dead) n++;
    return n;
  }
  /** basic integrate + lifetime; systems usually do their own thing */
  step(dt: number, drag = 0, gx = 0, gy = 0) {
    for (const p of this.items) {
      if (p.dead) continue;
      p.px = p.x;
      p.py = p.y;
      p.vx += gx * dt;
      p.vy += gy * dt;
      if (drag) {
        const d = Math.exp(-drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a += p.av * dt;
      p.life -= dt;
      if (p.life <= 0) p.dead = true;
    }
  }
  clear() {
    for (const p of this.items) p.dead = true;
  }
}

/** draw a particle as a short motion-streak between prev and current pos */
export function streakP(fb: Framebuffer, p: P, c: RGB, k: number) {
  const dx = p.x - p.px,
    dy = p.y - p.py;
  const n = Math.max(1, Math.min(12, Math.ceil(Math.hypot(dx, dy))));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const f = (0.35 + 0.65 * u) * k;
    fb.add(p.px + dx * u, p.py + dy * u, c[0], c[1], c[2], f);
  }
}
