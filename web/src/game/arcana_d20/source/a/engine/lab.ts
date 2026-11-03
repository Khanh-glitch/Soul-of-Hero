// ---------------------------------------------------------------------------
// ARCANA :: laboratory runtime.
// Fixed 1/60 s steps. Each step: real-time tick (camera keeps shaking during
// hit-stop) -> if not frozen: spell.update + choreography + world update at
// the speed-ramped dt. Deterministic, so any instant can be scrubbed to.
// ---------------------------------------------------------------------------

import { Framebuffer } from "./framebuffer";
import { VIEW_W, VIEW_H, buildFloor, drawCaster, drawDust } from "./arena";
import { SpellDef, SpellInstance } from "./types";
import { clamp } from "./math";
import { W } from "./world";
import { renderEnemies, renderOverlay } from "./enemies";
import { CHOREO } from "../spells/choreo";

export const DT = 1 / 60;

const SCHOOL_TRAIL: Record<string, [number, number]> = {
  PYRE: [0.35, 0.6],
  TIDE: [0.42, 0.66],
  TEMPEST: [0.6, 0.72],
  VERDANT: [0.3, 0.58],
  ASTRAL: [0.5, 0.74],
};

export class Lab {
  fb: Framebuffer;
  def: SpellDef | null = null;
  spell: SpellInstance | null = null;
  t = 0;
  acc = 0;
  speed = 1;
  showArena = true;
  showEnemies = true;
  advanced = true;

  constructor() {
    this.fb = new Framebuffer(VIEW_W, VIEW_H);
    buildFloor(this.fb);
  }

  private rebuild() {
    W.reset();
    this.spell = this.def!.make();
    this.t = 0;
    this.fb.resetTrail();
  }

  load(def: SpellDef, at = 0) {
    this.def = def;
    this.rebuild();
    this.acc = 0;
    if (at > 0) this.seek(at);
  }

  reset() {
    if (this.def) this.load(this.def, 0);
  }

  /** one fixed frame of the simulation */
  step() {
    if (!this.def || !this.spell) return;
    W.tick(DT);
    if (W.hitstop > 0) {
      W.hitstop -= DT;
      return;
    }
    const dt = DT * W.timeScale();
    this.t += dt;
    this.spell.update(dt, this.t);
    const ch = CHOREO[this.def.id];
    if (ch) ch(this.spell, this.t, dt);
    W.update(dt);
  }

  seek(target: number) {
    if (!this.def) return;
    const tt = clamp(target, 0, this.def.duration);
    if (tt < this.t) this.rebuild();
    let guard = 0;
    while (this.t < tt - 1e-6 && guard++ < 20000) this.step();
    this.acc = 0;
  }

  advance(real: number) {
    if (!this.def || !this.spell) return;
    this.acc += Math.min(real, 0.25) * this.speed;
    let guard = 0;
    this.advanced = false;
    while (this.acc >= DT && guard++ < 8) {
      this.acc -= DT;
      if (this.t > this.def.duration) {
        this.rebuild();
        continue;
      }
      this.step();
      this.advanced = true;
    }
  }

  stepFrame(dir = 1) {
    if (!this.def) return;
    if (dir > 0) {
      this.step();
      this.advanced = true;
    } else this.seek(Math.max(0, this.t - DT));
  }

  render(ctx: CanvasRenderingContext2D) {
    const { fb } = this;
    if (!this.def || !this.spell) return;
    fb.clear();
    const warp = this.spell.bgWarp ? this.spell.bgWarp(this.t) : null;
    fb.drawBackground(warp || undefined);
    if (W.inhaleAmt > 0.002) fb.scaleAll(1 - W.inhaleAmt * 0.55);
    if (this.showArena) {
      drawDust(fb, this.t);
      const lit = this.spell.casterLight ? this.spell.casterLight(this.t) : 0.3;
      drawCaster(fb, this.t, this.def.accent, clamp(lit, 0, 2.5), W.casterKick);
    }
    fb.markBase();
    this.spell.render(fb, this.t);
    // doctrine 2.4: screen flashes belong to the impact-frame system; legacy
    // per-spell flashes are kept only as a faint tint, and never while frozen
    const fk = W.hitstop > 0 ? 0.05 : 0.14;
    fb.flash[0] *= fk;
    fb.flash[1] *= fk;
    fb.flash[2] *= fk;
    const [persist, decay] = this.def.trail ?? SCHOOL_TRAIL[this.def.school] ?? [0.4, 0.62];
    fb.applyTrail(persist, decay, this.advanced);
    if (this.showEnemies) {
      renderEnemies(fb, W);
      renderOverlay(fb, W);
    }
    const cam = W.camera();
    fb.cam.x = cam.x;
    fb.cam.y = cam.y;
    fb.cam.zoom = cam.zoom;
    fb.cam.rot = cam.rot;
    fb.waves = W.waves;
    fb.chroma = W.chroma;
    fb.impactFrames = W.impactFrames;
    fb.impactTint = W.impactTint;
    fb.present(ctx);
  }
}
