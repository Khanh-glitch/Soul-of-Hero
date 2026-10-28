// GOLD93 Venomwright differential oracle driver.
//
// Executes the ORIGINAL TypeScript engine (`src/game/**`) headlessly in Node and
// emits per-tick SHA-256 of the scene and glow raster buffers plus every authored
// hit / status / camera cue. This file is copied NEXT TO the extracted original
// sources at build time (see build_venomwright_oracle.py); it never lives with
// them and the original source is never committed to this repository.
// Runs the ORIGINAL Venomwright TypeScript engine headlessly (no DOM) and emits
// per-tick SHA-256 of the scene and glow raster buffers, plus the authored hit /
// status / environment cue log. This is the authoritative reference the native
// Godot port must match.
import { createHash } from 'node:crypto';
import { Field, Layer, Rng, makeGround } from './game/pixel';
import { World, resetIds, ATK } from './game/world';
import { SKILL_BY_ID } from './game/skills';
import type { Cast } from './game/skills/lib';
import type { Gfx } from './game/fx';
import type { Enemy } from './game/world';

const F = 1 / 60;
const RW = 1200, RH = 680, K = 2;
const W = 600, H = 340;

function sha(u32: Uint32Array): string {
  return createHash('sha256').update(Buffer.from(u32.buffer, u32.byteOffset, u32.byteLength)).digest('hex');
}

interface Resolved { ang: number; tx: number; ty: number; target: Enemy | null; targets: Enemy[]; route: { x: number; y: number }[]; ok: boolean }

class Stage {
  world!: World; gfx!: Gfx; ground!: Uint32Array; field!: Field;
  id = 1; seed = 7; n = 0; castN = 18;
  scene: Uint32Array; glow: Uint32Array;
  hits: any[] = []; cues: any[] = [];

  constructor() {
    this.scene = new Uint32Array(RW * RH);
    this.glow = new Uint32Array(RW * RH);
    this.field = new Field(RW, RH, K);
    this.gfx = { s: new Layer(this.scene, RW, RH, K), l: new Layer(this.glow, RW, RH, K), f: this.field, t: 0, W: RW, H: RH, k: K };
    this.ground = new Uint32Array(RW * RH);
    makeGround(new Layer(this.ground, RW, RH, K), 17);
    this.world = new World(W, H);
  }

  resolve(def: any, mx: number, my: number): Resolved {
    const w = this.world, p = w.player, ai = def.aim;
    const dx = mx - p.x, dy = my - p.y, d = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx), dd = Math.min(d, ai.range);
    const r: Resolved = { ang, tx: p.x + (dx / d) * dd, ty: p.y + (dy / d) * dd, target: null, targets: [], route: [], ok: true };
    const alive = w.enemies.filter(e => e.dying <= 0);
    if (ai.kind === 'target') {
      let best: Enemy | null = null, bd = 1e9;
      for (const e of alive) { const dm = Math.hypot(e.x - mx, e.y - my) - e.r; if (dm < bd && dm < 26) { bd = dm; best = e; } }
      if (best && Math.hypot(best.x - p.x, best.y - p.y) - best.r > ai.range + 4) best = null;
      r.target = best; r.ok = !!best;
    } else if (ai.kind === 'multi') {
      r.targets = alive.filter(e => Math.hypot(e.x - p.x, e.y - p.y) - e.r < ai.range)
        .sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my)).slice(0, ai.n ?? 3);
      r.ok = r.targets.length > 0;
    } else if (ai.kind === 'dir' || ai.kind === 'path' || ai.kind === 'cone') { r.tx = p.x + Math.cos(ang) * ai.range; r.ty = p.y + Math.sin(ang) * ai.range; }
    else if (ai.kind === 'drag') { r.route = []; r.tx = mx; r.ty = my; }
    else if (ai.kind === 'self') { r.tx = p.x; r.ty = p.y; }
    return r;
  }

  autoAim(def: any): Resolved {
    const w = this.world, p = w.player, alive = w.enemies.filter(e => e.dying <= 0);
    let cx = p.x + 120, cy = p.y;
    if (alive.length) {
      let bn = -1, bi = 0;
      alive.forEach((e, i) => { let n = 0; for (const o of alive) if (Math.hypot(o.x - e.x, o.y - e.y) < 55) n++; if (n > bn) { bn = n; bi = i; } });
      const c0 = alive[bi]; let sx = 0, sy = 0, n = 0;
      for (const o of alive) if (Math.hypot(o.x - c0.x, o.y - c0.y) < 55) { sx += o.x; sy += o.y; n++; }
      cx = sx / n; cy = sy / n;
    }
    const dist = Math.hypot(cx - p.x, cy - p.y);
    if (def.aim.kind === 'ground' && dist > def.aim.range) { const k = def.aim.range / dist; cx = p.x + (cx - p.x) * k; cy = p.y + (cy - p.y) * k; }
    return this.resolve(def, cx, cy);
  }

  cast(def: any, r: Resolved) {
    const w = this.world, p = w.player;
    const id = w.uid++;
    const rng = new Rng((w.seed * 1315423911 + id * 2654435761 + def.id * 97) >>> 0);
    const c: Cast = { w, id, def, ox: p.x, oy: p.y, ang: r.ang, tx: r.tx, ty: r.ty, target: r.target, targets: r.targets, route: r.route, rng, d: (pct: number) => (ATK * pct) / 100, dx: Math.cos(r.ang), dy: Math.sin(r.ang) } as any;
    p.face = r.ang; p.cast = def.cast + 0.15; p.castMax = p.cast;
    w.run(def.run(c), def.name);
    w.castLog.push({ t: w.time, id: def.id });
  }

  start(id: number, seed = 7) {
    const def = SKILL_BY_ID[id], w = this.world;
    const dens = parseInt(process.env.GOLD93_DENSITY ?? '16', 10);
    const keep = parseInt(process.env.GOLD93_KEEP ?? '0', 10);
    const formation = (process.env.GOLD93_FORMATION ?? '1') === '1';
    w.cfg.density = dens;
    resetIds(); w.uid = 1; w.reset(seed, formation); w.lab = true;
    if (keep > 0) w.enemies = w.enemies.slice(0, keep);
    w.stats = { total: 0, kills: 0, hits: 0, ev: [] };
    const p = w.player; p.form = def.form === 'venom' ? 'venom' : 'vessel'; p.venomT = 999; p.cat = 100;
    if (def.form !== 'venom') p.venomT = 0;
    this.id = id; this.seed = seed; this.n = 0;
    // Default matches the documented protocol (`cast_tick: 1`). Whatever value
    // is used is echoed into the output as `cast_tick` so the record can never
    // disagree with the run.
    this.castN = parseInt(process.env.GOLD93_CAST_TICK ?? '1', 10);
    this.hits = []; this.cues = [];
    this.installProbes();
  }

  // Capture every authored damage / status / knock event without altering them.
  installProbes() {
    const w = this.world as any;
    const self = this;
    if (!w.__probed) {
      const oh = w.hit.bind(w), om = w.mark.bind(w), op = w.poison.bind(w),
        os = w.shake.bind(w), ok = w.shock.bind(w), of = w.screenFlash.bind(w);
      w.hit = (e: any, amt: number, o: any) => {
        const r = oh(e, amt, o);
        self.hits.push({ t: +w.time.toFixed(6), e: e.id, amt: +amt.toFixed(4), kind: o?.kind ?? 'impact', src: o?.src, at: o?.at ?? null, kx: o?.kx ?? 0, ky: o?.ky ?? 0, stag: o?.stagger ?? 0, big: !!o?.big, heal: o?.heal ?? 0, killed: !!r });
        return r;
      };
      w.mark = (e: any, key: any, dur: number, k = 1) => { self.cues.push({ t: +w.time.toFixed(6), k: 'mark', e: e.id, key, dur }); return om(e, key, dur, k); };
      w.poison = (e: any, total: number, dur: number, key: number, src: number, every = 0.5) => { self.cues.push({ t: +w.time.toFixed(6), k: 'poison', e: e.id, total, dur, src }); return op(e, total, dur, key, src, every); };
      w.shake = (m: number, d = 0.25) => { self.cues.push({ t: +w.time.toFixed(6), k: 'shake', m, d }); return os(m, d); };
      w.shock = (x: number, y: number, max: number, dur: number, amp = 3) => { self.cues.push({ t: +w.time.toFixed(6), k: 'shock', x: +x.toFixed(3), y: +y.toFixed(3), max, dur, amp }); return ok(x, y, max, dur, amp); };
      w.screenFlash = (c: number, a: number, dur = 0.2) => { self.cues.push({ t: +w.time.toFixed(6), k: 'flash', c: c >>> 0, a, dur }); return of(c, a, dur); };
      w.__probed = true;
    }
  }

  simStep() {
    const w = this.world;
    w.step(F);
    this.n++;
    if (this.n === this.castN) { const def = SKILL_BY_ID[this.id]; this.cast(def, this.autoAim(def)); }
  }

  render() {
    const g = this.gfx, w = this.world;
    g.s.d.set(this.ground); g.l.d.fill(0xff000000); g.s.reset(); g.l.reset();
    w.draw(g);
  }

  run(ticks: number, sampleTicks: number[]) {
    const out: any[] = [];
    const all = process.env.GOLD93_ALL_TICKS === '1';
    for (let i = 1; i <= ticks; i++) {
      this.simStep();
      this.render();
      if (all || sampleTicks.includes(i)) {
        out.push({
          tick: i,
          scene_sha256: sha(this.scene).slice(0, 32),
          glow_sha256: sha(this.glow).slice(0, 32),
          fx: this.world.fx.length,
          parts: this.world.parts.list.length,
          enemies: this.world.enemies.filter(e => e.dying <= 0).length,
        });
      }
    }
    return out;
  }
}

const argId = parseInt(process.argv[2] ?? '1', 10);
const argTicks = parseInt(process.argv[3] ?? '600', 10);
const samples = (process.argv[4] ?? '').split(',').filter(Boolean).map(Number);
// The world seed is an input, not a constant: `Stage.start` always took it, but
// the entry point hardcoded 7, so an oracle could only ever be produced for the
// default seed. GOLD93_SEED selects it and is echoed into the output, so a
// record can never claim a seed it was not generated with.
const argSeed = parseInt(process.env.GOLD93_SEED ?? '7', 10);
const st = new Stage();
st.start(argId, argSeed);
const def = SKILL_BY_ID[argId];
const rows = st.run(argTicks, samples);
// `cast_tick` is reported from the value the run ACTUALLY used (Stage.castN,
// read from GOLD93_CAST_TICK), never a hardcoded literal. A generator that is
// cast at a different tick than it advertises is useless as an equality oracle,
// and this field previously claimed 18 while the builder drove it with 1.
console.log(JSON.stringify({
  schema: 'gold93/venomwright-oracle/v1',
  skill: argId, name: def.name, duration: def.dur, total: def.total,
  seed: argSeed, logical: [W, H], native: [RW, RH], k: K, hz: 60,
  cast_tick: st.castN, ticks: argTicks, sampled_ticks: rows.length,
  rows, hits: st.hits, cues: st.cues,
}));
