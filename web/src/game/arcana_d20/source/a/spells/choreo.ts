// ---------------------------------------------------------------------------
// ARCANA :: the impact score.
// For every spell, the TELL / GATHER / COMMIT / STRIKE / RELEASE / RESIDUE /
// LAST BEAT structure of docs/VFX_DOCTRINE.md, written like a musical score
// and kept separate from the drawing code. Each function runs after the
// spell's own update, in simulation time.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
import { W, applyStatus } from "../engine/world";
import { ARENA_C as C, ANCHORS, CASTER } from "../engine/arena";
import { seg, clamp, lerp, easeOut, catmull } from "../engine/math";

type Score = (s: any, t: number, dt: number) => void;
const HAND = { x: CASTER.x + 7, y: CASTER.y - 8 };
const chest = (e: any) => ({ x: e.x, y: e.y - e.z - e.spr.h * 0.55 });

export const CHOREO: Record<number, Score> = {
  // ===================================================================== PYRE
  1: (_s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("fire");
    if (t > 0.3 && t < 3.92) W.focus(C.x, C.y, 0.2 + 0.8 * seg(t, 1.0, 3.85));
    if (W.once("lock", t >= 1.55)) {
      W.shake(0.14);
      W.punch(0.35);
      W.wave(C.x, C.y, 1.5, 200, 6, 0.4, "fire");
    }
    if (t > 3.0 && t < 3.93) {
      const k = seg(t, 3.0, 3.86);
      W.inhale(k);
      W.tremor(dt, 0.18 * k);
      W.pull(C.x, C.y, 170, 260 * k, 40 * k, dt);
    }
    if (W.once("strike", t >= 3.95))
      W.impact(C.x, C.y, { element: "fire", force: 1.3, radius: 140, dmg: 85, hitstop: 0.17, lift: 0.9 });
    if (W.once("petals", t >= 4.3))
      W.impact(C.x, C.y, { element: "fire", force: 0.45, radius: 200, dmg: 16, hitstop: 0, frame: false, wave: 0.7, shake: 0.12, zoom: 0.2 });
    if (W.once("end", t >= 6.1)) W.settle();
  },

  2: (s, t) => {
    if (W.once("tell", t > 0.01)) W.castSnap("fire");
    if (W.once("crack", t >= 0.38)) W.thump(CASTER.x + 10, CASTER.y + 3, 0.5, "fire", { hitstop: 0.06 });
    const h = s.head;
    if (t > 0.9 && s.impactT < 0) {
      const sp = t > 4.55 ? 1 : 0.55;
      W.sweep("head", h.x, h.y, 13, { element: "fire", dmg: 9, force: sp, dirx: Math.cos(h.a), diry: Math.sin(h.a), status: 0.45, lift: 0.4 }, 0.6);
      for (const k of [50, 120, 190]) {
        const p = s.hist[k];
        if (p) W.sweep("body" + k, p.x, p.y, 8, { element: "fire", dmg: 4, force: 0.25, dirx: 0, diry: -1, status: 0.3 }, 0.5);
      }
    }
    if (t > 4.2 && s.impactT < 0) W.focus(ANCHORS[0].x, ANCHORS[0].y, seg(t, 4.2, 4.7));
    if (s.impactT > 0 && W.once("bite"))
      W.impact(ANCHORS[0].x, ANCHORS[0].y, { element: "fire", force: 1.4, radius: 85, dmg: 120, hitstop: 0.18, lift: 1.0 });
    if (W.once("end", t >= 6.5)) W.settle();
  },

  3: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("fire", 0.8);
    s.ms.forEach((m: any, i: number) => {
      const u = seg(t, m.t0, m.t0 + m.dur);
      if (u > 0.6 && u < 1) W.tremor(dt, 0.05 + m.size * 0.006);
      if (W.once("m" + i, m.hit === 1))
        W.impact(m.tx, m.ty, {
          element: "fire",
          force: 0.35 + m.size / 24,
          radius: m.size * 4.2,
          dmg: m.size * 3,
          hitstop: 0.03 + m.size * 0.005,
          frame: m.size >= 15,
          lift: 0.7,
        });
    });
    if (t > 4.9 && t < 5.45) {
      W.inhale(seg(t, 4.9, 5.4) * 0.8);
      W.focus(C.x, C.y, seg(t, 4.9, 5.4) * 0.6);
    }
    if (W.once("sigil", t >= 5.45))
      W.impact(C.x, C.y, { element: "fire", force: 1.15, radius: 210, dmg: 40, hitstop: 0.14, frame: true, lift: 0.6 });
    if (W.once("end", t >= 6.6)) W.settle();
  },

  4: (s, t, dt) => {
    // restraint: almost no tell at all
    if (W.once("tell", t > 0.01)) W.castSnap("fire", 0.3);
    const cut = s.CUT_T;
    if (t > 0.2 && t < cut) {
      W.focus(208, s.cutY, 0.15 + 0.85 * seg(t, 1.2, cut));
      W.inhale(seg(t, 2.0, cut) * 0.9);
      if (t > 2.3) W.tremor(dt, 0.12 * seg(t, 2.3, cut));
      // bodies are drawn toward the slit, as the embers are
      W.pull(208, s.cutY, 140, 40 * seg(t, 0.5, cut), 0, dt);
    }
    if (W.once("cut", t >= cut)) {
      const ca = Math.cos(s.cutA),
        sa = Math.sin(s.cutA);
      W.impact(208, s.cutY, { element: "fire", force: 1.6, radius: 0, hitstop: 0.24, frame: true, wave: 0.4, shake: 0.55 });
      W.kick(-sa * 160, ca * 160);
      W.lineHit("blade", 18, s.lineY(18), 400, s.lineY(400), 9, { element: "fire", dmg: 150, force: 0.9, cut: s.cutA, status: 0.9, lift: 0.2 });
      void ca;
    }
    s.sections.forEach((sec: any, i: number) => {
      if (W.once("sec" + i, t >= cut + 0.12 + sec.delay / 1.5 + 0.25)) {
        const x = (sec.x0 + sec.x1) / 2;
        W.impact(x, s.lineY(x), { element: "fire", force: 0.25 + sec.depth * 0.25, radius: 34, dmg: 14, hitstop: 0.012, frame: false, wave: 0.6, shake: 0.08, zoom: 0.1, lift: 0.6 });
      }
    });
    if (W.once("end", t >= 6.6)) W.settle(0.6);
  },

  // ===================================================================== TIDE
  5: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("water");
    if (t > 0.8 && t < 4.3) {
      W.focus(C.x, C.y, 0.2 + 0.6 * seg(t, 0.8, 4.2));
      // the membranes push bodies outward as they unfold
      W.pull(C.x, C.y, 90 * seg(t, 0.8, 3.6) + 20, -60, 30, dt, "water");
    }
    if (t >= 4.3 && t < s.BURST) {
      W.inhale(0.7);
      W.still(dt);
      W.focus(C.x, C.y, 1);
    }
    if (W.once("strike", t >= s.BURST))
      W.impact(C.x, C.y, { element: "water", force: 1.25, radius: 150, dmg: 75, hitstop: 0.16, lift: 1.1 });
    if (W.once("end", t >= 6.4)) W.settle();
  },

  6: (s, t) => {
    if (W.once("tell", t > 0.01)) W.castSnap("water");
    s.strokes.forEach((st: any, si: number) => {
      const u = seg(t, st.t0, st.t0 + st.dur);
      if (W.once("stk" + si, u > 0)) {
        W.shake(0.06);
        W.casterKickV -= 30;
      }
      if (u > 0 && u < 1) {
        const p = catmull(st.ctrl, u),
          q = catmull(st.ctrl, Math.max(0, u - 0.04));
        const dx = p.x - q.x,
          dy = p.y - q.y,
          dl = Math.hypot(dx, dy) || 1;
        W.sweep("st" + si, p.x, p.y, 9, { element: "water", dmg: 7, force: 0.45, dirx: dx / dl, diry: dy / dl }, 1);
      }
    });
    if (t > 4.75 && t < s.WAVE) {
      W.inhale(seg(t, 4.75, s.WAVE) * 0.6);
      W.focus(C.x, C.y, 0.6);
    }
    if (W.once("strike", t >= s.WAVE)) W.thump(C.x, C.y, 1.1, "water", { hitstop: 0.12, frame: true });
    const waves = seg(t, s.WAVE, s.WAVE + 1.7);
    for (let w = 0; w < 3; w++) {
      const u = clamp((waves - w * 0.14) * 1.5);
      if (u <= 0 || u >= 1) continue;
      const ang = -0.5 + w * 0.55;
      const dirx = Math.cos(ang),
        diry = Math.sin(ang) * 0.5;
      const travel = lerp(-60, 480, easeOut(u, 1.6));
      const ox = 20 + dirx * travel,
        oy = 60 + diry * travel + w * 40;
      const P = (i: number) => {
        const curve = (i * i) / 300;
        return { x: ox - curve * dirx * 1.4 - diry * i * 1.6, y: oy - curve * diry + dirx * i };
      };
      const a = P(-70),
        m = P(0),
        b = P(70);
      const dl = Math.hypot(dirx, diry);
      const o = { element: "water" as const, dmg: 30, force: 0.95, dirx: dirx / dl, diry: diry / dl, lift: 0.5 };
      const hits = [...W.lineHit("wave" + w, a.x, a.y, m.x, m.y, 8, o), ...W.lineHit("wave" + w, m.x, m.y, b.x, b.y, 8, o)];
      if (hits.length) {
        W.freeze(0.05);
        W.shake(0.12);
      }
    }
    if (W.once("end", t >= 6.5)) W.settle();
  },

  7: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("ice");
    // the growing frost locks bodies in place
    const reach = 26 + 110 * seg(t, 0.4, 3.6);
    if (t > 0.3 && t < s.BREAK) W.status(C.x, C.y, reach, "ice", Math.min(0.9, 0.35 + seg(t, 0.4, 3.0) * 0.6));
    if (t > 1.0 && t < s.BREAK) W.focus(C.x, C.y, 0.2 + 0.5 * seg(t, 1, 4.5));
    s.pieces.forEach((p: any, i: number) => {
      if (p.tier >= 1 && W.once("pc" + i, t >= p.delay)) W.shake(0.025);
    });
    if (t > 4.2 && t < s.BREAK) {
      const k = seg(t, 4.2, s.BREAK);
      W.inhale(k * 0.7);
      W.tremor(dt, 0.2 * k);
      W.focus(C.x + 40, C.y, 0.8);
    }
    if (W.once("strike", t >= s.BREAK))
      W.impact(C.x + 40, C.y, { element: "ice", force: 1.25, radius: 190, dmg: 70, hitstop: 0.2, lift: 0.5 });
    if (W.once("end", t >= 7.0)) W.settle();
  },

  8: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("water");
    const rage = seg(t, 2.4, s.STOP);
    if (t > 0.6 && t < s.STOP) {
      W.pull(C.x, C.y, 180, 50 + 150 * rage, 70 + 170 * rage, dt, "water");
      W.focus(C.x, C.y, 0.2 + 0.6 * seg(t, 0.6, s.STOP));
      W.tremor(dt, 0.04 + 0.16 * rage);
      // bodies dragged into the throat take pressure damage
      for (const e of W.alive())
        if (Math.hypot(e.x - C.x, (e.y - C.y) * 1.5) < 30) W.sweep("throat", e.x, e.y - 6, 4, { element: "water", dmg: 6, force: 0.1 }, 0.35);
    }
    if (t >= s.STOP && t < s.SURGE) {
      W.still(dt);
      W.inhale(1);
      W.focus(C.x, C.y, 1);
    }
    if (W.once("stop", t >= s.STOP)) W.trauma = 0;
    if (W.once("strike", t >= s.SURGE))
      W.impact(C.x, C.y, { element: "water", force: 1.55, radius: 220, dmg: 90, hitstop: 0.22, lift: 1.2 });
    if (W.once("end", t >= 6.5)) W.settle();
  },

  // ===================================================================== TEMPEST
  9: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("volt", 0.7);
    s.events.forEach((ev: any, k: number) => {
      if (ev.fail) return;
      if (W.once("ev" + k, t >= ev.t0)) {
        const en = W.enemies[s.enemyOf[ev.b]];
        if (en && !en.dead) {
          const A = s.nodes[ev.a],
            B = s.nodes[ev.b];
          const dx = B.x - A.x,
            dy = B.y - A.y,
            dl = Math.hypot(dx, dy) || 1;
          W.hit(en, { element: "volt", dmg: 16, force: 0.3, dirx: dx / dl, diry: dy / dl, status: 0.6, hitstop: 0.05 });
        }
        W.chroma = Math.max(W.chroma, 1.2);
      }
    });
    if (t > s.FINAL - 0.5 && t < s.FINAL) {
      W.inhale(seg(t, s.FINAL - 0.5, s.FINAL) * 0.7);
      W.tremor(dt, 0.12);
    }
    if (W.once("final", t >= s.FINAL)) W.thump(C.x, C.y, 1.2, "volt", { hitstop: 0.14, frame: true });
    const succ = s.events.filter((e: any) => !e.fail);
    const fin = seg(t, s.FINAL, s.FINAL + 1.0);
    succ.forEach((ev: any, i: number) => {
      if (W.once("fin" + i, t > s.FINAL && fin >= i * 0.028 + 0.02)) {
        const en = W.enemies[s.enemyOf[ev.b]];
        if (en) W.hit(en, { element: "volt", dmg: 22, force: 0.55, dirx: 0, diry: -0.3, status: 0.8, lift: 0.3 }, false);
      }
    });
    if (W.once("end", t >= 6.3)) W.settle();
  },

  10: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("volt", 0.7);
    const T = s.T;
    const wind = seg(t, 3.2, 4.45);
    if (t > 0.2 && t < s.STRIKE) {
      W.status(T.x, T.y, 90, "volt", 0.15 + 0.35 * wind);
      W.pull(T.x, T.y, 110, 30 + 60 * wind, 40 * wind, dt);
      W.focus(T.x, T.y, 0.15 + 0.6 * seg(t, 0.5, 4.4));
      W.tremor(dt, 0.04 + 0.12 * wind);
    }
    if (t >= 4.45 && t < s.STRIKE) {
      W.inhale(seg(t, 4.45, s.STRIKE));
      W.focus(T.x, T.y, 1);
    }
    if (W.once("strike", t >= s.STRIKE)) {
      W.impact(T.x, T.y, { element: "volt", force: 1.65, radius: 55, dmg: 150, hitstop: 0.22, lift: 0.4 });
      W.impact(T.x, T.y, { element: "volt", force: 0.3, radius: 150, dmg: 15, hitstop: 0, frame: false, wave: 0, shake: 0 });
    }
    s.relight.forEach((r: any, i: number) => {
      if (W.once("rl" + i, t >= r.t0))
        W.impact(r.x, r.y, { element: "volt", force: 0.2, radius: 18, dmg: 6, hitstop: 0.01, frame: false, wave: 0.3, shake: 0.04, zoom: 0.05 });
    });
    if (W.once("end", t >= 6.5)) W.settle();
  },

  11: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("volt");
    const energy = seg(t, 1.5, s.SYNC);
    if (t > 1.6 && t < s.SYNC) {
      const slot = Math.floor(t / (0.42 - energy * 0.25));
      if (W.once("arc" + slot)) {
        const al = W.alive().filter((e) => Math.hypot(e.x - C.x, e.y - C.y) < 160);
        if (al.length) {
          const e = al[slot % al.length];
          const a = slot * 2.39;
          const c = chest(e);
          W.zap(C.x + Math.cos(a) * 50, C.y + Math.sin(a) * 30, c.x, c.y, 0.14);
          W.hit(e, { element: "volt", dmg: 5, force: 0.15, status: 0.4, hitstop: 0.015, dirx: (e.x - C.x) / 100, diry: 0 });
        }
      }
      W.focus(C.x, C.y, 0.2 + 0.6 * energy);
      W.tremor(dt, 0.1 * energy);
    }
    if (t > s.SYNC - 0.35 && t < s.SYNC) W.inhale(seg(t, s.SYNC - 0.35, s.SYNC));
    if (W.once("strike", t >= s.SYNC))
      W.impact(C.x, C.y, { element: "volt", force: 1.3, radius: 190, dmg: 70, hitstop: 0.17, lift: 0.5 });
    if (W.once("end", t >= 6.8)) W.settle();
  },

  12: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("volt", 0.8);
    s.E.forEach((e: any, i: number) => {
      if (e.instant && W.once("draw" + i, t >= e.t0)) {
        W.shake(0.05);
        W.chroma = Math.max(W.chroma, 0.8);
      }
      if (W.once("blow" + i, e.blow > 0)) {
        const A = s.N[e.a],
          B = s.N[e.b];
        W.impact((A.x + B.x) / 2, (A.y + B.y) / 2, { element: "volt", force: 0.3, radius: 26, dmg: 14, hitstop: 0.012, frame: false, wave: 0.4, shake: 0.05, zoom: 0.05 });
      }
    });
    if (t > s.CIRCUIT && t < s.RUPTURE) W.focus(C.x, C.y, 0.3 + 0.6 * seg(t, s.CIRCUIT, s.RUPTURE));
    if (t > s.RUPTURE - 0.4 && t < s.RUPTURE) {
      W.inhale(seg(t, s.RUPTURE - 0.4, s.RUPTURE));
      W.tremor(dt, 0.2);
    }
    if (W.once("strike", t >= s.RUPTURE))
      W.impact(C.x, C.y, { element: "volt", force: 1.45, radius: 210, dmg: 85, hitstop: 0.2, lift: 0.6 });
    if (W.once("end", t >= 7.1)) W.settle();
  },

  // ===================================================================== VERDANT
  13: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("verdant", 0.8);
    if (t < s.SNAP)
      for (const b of s.roots) {
        if (b.grow <= 0) continue;
        const p = b.pts[Math.min(b.pts.length - 1, Math.floor(b.grow * (b.pts.length - 1)))];
        W.status(p.x, p.y, 14, "verdant", 1);
      }
    s.flowers.forEach((f: any, i: number) => {
      if (W.once("fl" + i, t >= f.t0)) {
        W.shake(0.03);
        W.wave(f.x, f.y, 1.2, 120, 5, 0.3, "verdant");
      }
    });
    if (t > 2 && t < s.SNAP) W.focus(C.x - 20, C.y, 0.2 + 0.5 * seg(t, 2, s.SNAP));
    if (t > s.SNAP - 0.5 && t < s.SNAP) {
      W.inhale(seg(t, s.SNAP - 0.5, s.SNAP) * 0.8);
      W.tremor(dt, 0.15);
      // the network tightens: rooted bodies are crushed down
      for (const e of W.alive()) if (e.root > 0.3) e.sq = -0.12 * seg(t, s.SNAP - 0.5, s.SNAP);
    }
    if (W.once("snap", t >= s.SNAP)) {
      W.thump(CASTER.x + 60, CASTER.y - 10, 1.15, "verdant", { hitstop: 0.17, frame: true });
      for (const e of W.alive())
        if (e.root > 0.25) W.hit(e, { element: "verdant", dmg: 75, force: 0.8, dirx: 0, diry: -0.2, lift: 1.5, status: 0 }, false);
    }
    if (W.once("end", t >= 7.0)) W.settle(0.6);
  },

  14: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("verdant", 0.5);
    if (t < s.BLOOM)
      for (const c of s.colonies) {
        if (t - c.born < 0.4) continue;
        for (const e of W.alive()) if (Math.hypot(e.x - c.x, e.y - 6 - c.y) < 24) e.spore = Math.max(e.spore, 0.85);
      }
    if (t > 3.2 && t < s.BLOOM) W.focus(C.x, C.y, 0.15 + 0.45 * seg(t, 3.2, s.BLOOM));
    if (t > s.BLOOM - 0.45 && t < s.BLOOM) {
      W.inhale(seg(t, s.BLOOM - 0.45, s.BLOOM) * 0.8);
      W.tremor(dt, 0.08);
    }
    if (W.once("bloom", t >= s.BLOOM))
      W.impact(C.x, C.y, { element: "verdant", force: 0.8, radius: 240, dmg: 30, hitstop: 0.13, frame: true, lift: 0.6 });
    if (W.once("end", t >= 7.0)) W.settle(0.5);
  },

  15: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("verdant");
    s.tendrils.forEach((td: any, i: number) => {
      const h = td.pts[0];
      const sp = Math.hypot(h.vx, h.vy);
      if (sp > 160 && t > 0.6)
        W.sweep("td" + i, h.x, h.y, 9, { element: "verdant", dmg: 9, force: clamp(sp / 600, 0.25, 0.9), dirx: h.vx / sp, diry: h.vy / sp, status: 0.25 }, 0.5);
    });
    if (t > s.CURL && t < s.OPEN) {
      const k = seg(t, s.CURL, s.OPEN);
      W.focus(C.x, C.y, 0.3 + 0.7 * k);
      W.inhale(k * 0.8);
      W.tremor(dt, 0.14 * k);
      W.pull(C.x, C.y, 150, 120 * k, 0, dt);
    }
    if (W.once("open", t >= s.OPEN))
      W.impact(C.x, C.y, { element: "verdant", force: 1.2, radius: 175, dmg: 60, hitstop: 0.17, lift: 0.9 });
    if (W.once("end", t >= 6.8)) W.settle();
  },

  16: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("verdant", 0.4);
    if (t < s.CRACK) W.focus(C.x, C.y, 0.5 * seg(t, 0.3, s.CRACK));
    if (t > s.CRACK - 0.4 && t < s.CRACK) W.inhale(seg(t, s.CRACK - 0.4, s.CRACK) * 0.6);
    if (W.once("crack", t >= s.CRACK)) W.thump(C.x, C.y, 0.55, "verdant", { hitstop: 0.1, frame: false, zoom: 0.6 });
    if (t > s.CRACK && t < s.BLOOM) {
      W.pull(C.x, C.y, 30 + 110 * seg(t, s.CRACK, s.BLOOM), -70, 15, dt);
      W.focus(C.x, C.y, 0.3 + 0.4 * seg(t, s.CRACK, s.BLOOM));
    }
    if (t > s.BLOOM - 0.4 && t < s.BLOOM) {
      W.inhale(seg(t, s.BLOOM - 0.4, s.BLOOM));
      W.tremor(dt, 0.12);
    }
    if (W.once("bloom", t >= s.BLOOM))
      W.impact(C.x, C.y, { element: "verdant", force: 0.95, radius: 210, dmg: 50, hitstop: 0.15, frame: true, lift: 1.2 });
    if (t > s.FOLD) W.pull(C.x, C.y, 220, 60, 20, dt);
    if (W.once("end", t >= 7.7)) W.settle(0.5);
  },

  // ===================================================================== ASTRAL
  17: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("astral", 0.6);
    const k = seg(t, 0.6, s.COLLAPSE);
    if (t > 0.4 && t < s.REBOUND) {
      const col = seg(t, s.COLLAPSE, s.REBOUND);
      W.pull(C.x, C.y, 230, 70 + 170 * k + 600 * col, 60 + 90 * k, dt, "astral");
      W.focus(C.x, C.y, 0.2 + 0.7 * k);
      W.tremor(dt, 0.05 + 0.15 * k);
      const rh = s.rh(t);
      for (const e of W.alive()) if (Math.hypot(e.x - C.x, (e.y - 6 - C.y) * 1.5) < rh + 4) W.kill(e, "astral");
    }
    if (t > s.COLLAPSE && t < s.REBOUND) W.inhale(1);
    if (W.once("strike", t >= s.REBOUND))
      W.impact(C.x, C.y, { element: "astral", force: 1.65, radius: 260, dmg: 90, hitstop: 0.22, lift: 1.0 });
    if (W.once("end", t >= 7.0)) W.settle();
  },

  18: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("astral");
    const tgt = W.nearest(s.P1.x, s.P1.y);
    // the future echo lands before the real projectile: the body flinches early
    if (tgt && W.once("echo", t >= (1 - 0.48) / 0.55)) {
      W.hit(tgt, { element: "astral", dmg: 8, force: 0.35, dirx: 1, diry: 0, hitstop: 0.06 });
      W.wave(s.P1.x, s.P1.y, 1.8, 160, 6, 0.4, "astral");
    }
    if (W.once("real", t >= 1 / 0.55))
      W.impact(s.P1.x, s.P1.y, { element: "astral", force: 0.75, radius: 34, dmg: 26, hitstop: 0.08, frame: false });
    if (t > s.FREEZE && t < s.SYNC) {
      // time is held: every body hangs in its last instant, doubled by echoes
      W.still(dt);
      for (const e of W.alive()) e.warp = Math.max(e.warp, 0.35);
      W.focus(C.x, C.y, 0.3 + 0.5 * seg(t, s.FREEZE, s.SYNC));
    }
    s.crystals.forEach((c: any, i: number) => {
      const act = t - c.fire;
      if (!tgt) return;
      if (c.mode === 0 && W.once("fwd" + i, act > 0 && c.s + act * 0.9 >= 1))
        W.hit(tgt, { element: "astral", dmg: 12, force: 0.4, dirx: 1, diry: 0, hitstop: 0.04 });
      if (c.mode === 1 && W.once("rev" + i, act > 0)) {
        // reversed causality: the body is pulled *back* along the hit
        tgt.vx -= 120;
        tgt.flash = 0.1;
        W.shake(0.06);
      }
      if (c.mode === 2 && W.once("rel" + i, act > 0))
        W.impact(c.x + c.ox, c.y + c.oy, { element: "astral", force: 0.3, radius: 40, dmg: 10, hitstop: 0.02, frame: false, wave: 0.6, shake: 0.06 });
    });
    if (t > s.SYNC - 0.4 && t < s.SYNC) {
      W.inhale(seg(t, s.SYNC - 0.4, s.SYNC));
      W.tremor(dt, 0.15);
    }
    if (W.once("sync", t >= s.SYNC))
      W.impact(C.x, C.y, { element: "astral", force: 1.15, radius: 200, dmg: 60, hitstop: 0.16, lift: 0.7 });
    if (W.once("end", t >= 7.0)) W.settle();
  },

  19: (s, t, dt) => {
    if (W.once("tell", t > 0.01)) W.castSnap("astral", 0.5);
    if (t > 1.6 && t < s.FINAL) W.focus(C.x, C.y, 0.15 + 0.5 * seg(t, 1.6, s.FINAL));
    if (W.once("lock1", t >= 3.0)) {
      W.shake(0.08);
      W.punch(0.25);
    }
    if (W.once("lock2", t >= 4.6)) {
      W.shake(0.1);
      W.punch(0.3);
    }
    if (t > s.FINAL && t < s.FINAL + 0.85) {
      W.inhale(seg(t, s.FINAL, s.FINAL + 0.85));
      W.tremor(dt, 0.12);
      W.focus(C.x, C.y, 1);
      for (const e of W.alive()) applyStatus(e, "astral", 0.4);
    }
    const B = s.FINAL + 0.85;
    if (W.once("burst", t >= B)) W.impact(C.x, C.y, { element: "astral", force: 1.25, radius: 60, dmg: 30, hitstop: 0.16, frame: true });
    const burst = seg(t, B, s.FINAL + 1.9);
    for (let i = 0; i < 5; i++) {
      if (burst <= i * 0.07 || burst > 0.9) continue;
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const ex = C.x + Math.cos(a) * 260,
        ey = C.y + (Math.sin(a) * 260) / 1.5;
      const hits = W.lineHit("str" + i, C.x, C.y, ex, ey, 9, { element: "astral", dmg: 55, force: 0.9, dirx: Math.cos(a), diry: Math.sin(a), lift: 0.4 });
      if (hits.length) W.freeze(0.05);
    }
    if (W.once("end", t >= 7.6)) W.settle();
  },

  20: (s, t, dt) => {
    // no snap: the opening must read as a rendering artifact
    if (W.once("tell", t > 0.35)) W.chroma = 0.9;
    if (W.once("open", t >= s.OPEN)) W.thump(C.x, C.y, 0.35, "astral", { hitstop: 0.05, wave: 0 });
    const pull = seg(t, 1.2, s.COLLIDE);
    if (t > s.OPEN && t < s.CLOSE) {
      W.focus(C.x, C.y, 0.15 + 0.6 * pull);
      W.tremor(dt, 0.03 + 0.12 * pull);
      for (const e of W.alive()) {
        const n = s.near(e.x, e.y - 6);
        if (n.d > 90) continue;
        const f = (1 - n.d / 90) * (40 + 140 * pull);
        const dx = n.px - e.x,
          dy = n.py - (e.y - 6),
          dl = Math.hypot(dx, dy) || 1;
        e.vx += (dx / dl) * f * dt;
        e.vy += (dy / dl) * f * dt;
        e.warp = Math.max(e.warp, (1 - n.d / 90) * pull);
        e.stagger = Math.max(e.stagger, 0.1);
        if (n.d < s.halfW(n.u, t) - 1) W.kill(e, "astral");
      }
    }
    if (t > s.COLLIDE - 0.4 && t < s.COLLIDE) W.inhale(seg(t, s.COLLIDE - 0.4, s.COLLIDE));
    if (W.once("collide", t >= s.COLLIDE)) {
      const mid = s.path[Math.floor(s.path.length / 2)];
      W.thump(mid.x, mid.y, 1.65, "astral", { hitstop: 0.22, frame: true });
      for (const e of W.alive()) {
        const n = s.near(e.x, e.y - 6);
        if (n.d > 80) continue;
        const dx = e.x - n.px,
          dy = e.y - 6 - n.py,
          dl = Math.hypot(dx, dy) || 1;
        W.hit(e, { element: "astral", dmg: 90 * (1 - n.d / 120), force: 1.1, dirx: dx / dl, diry: dy / dl, lift: 0.7 }, false);
      }
    }
    // stitching: irregular little beats as bands snap shut
    s.bands.forEach((b: any, i: number) => {
      if (i % 8 === 0 && W.once("stitch" + i, t >= s.CLOSE + 0.25 + b.close * 1.5)) W.shake(0.04);
    });
    if (W.once("last", t >= s.CLOSE + 2.75)) W.settle(0.7);
  },
};

void HAND;
