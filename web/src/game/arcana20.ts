// ============================================================================
// ARCANA #20 "Reality Ripper" (A+C fusion) — second GPU client of the unified
// compositor. C contour/timeline (seed 151461) from the P0 donor; the world
// interaction runs as a bounded GPU field in the presenter (A-style world pull,
// chromatic split, void tear with rim, restitch restore). QA visual-only:
// no HP/charge/knockback/terrain-save changes — Gameplay owns those.
// ============================================================================

import { RipperContour, buildContourField, smoothstep, seg, F20_W, F20_H } from './arcana_d20/contour';
import * as comp from './compositor';
import { getPresenter } from './gpu/presenter';

export const D20_DUR = 10.4, D20_CLIMAX = 6.3;

interface Cast { wx: number; wy: number; startMs: number }

export class D20Client implements comp.VfxClient {
  readonly id = 'arcana-20';
  private contour = new RipperContour();
  private field: Float32Array | null = null;
  private cast: Cast | null = null;
  private qaT = -1;

  private ensureField() { if (!this.field) this.field = buildContourField(this.contour); return this.field; }

  /** QA-only: play #20 from t=0 at a world position (visual only). */
  qaPlay(wx: number, wy: number) { this.qaT = -1; this.cast = { wx, wy, startMs: Date.now() }; }
  /** QA-only: freeze/seek to source time t (seconds). */
  qaSeek(t: number, wx = 0, wy = 0) { this.qaT = t; this.cast = { wx, wy, startMs: 0 }; }

  submitGpu(frame: comp.FrameCtx): void {
    const p = getPresenter();
    if (!p || !this.cast) return;
    const t = this.qaT >= 0 ? this.qaT : (frame.now - this.cast.startMs) / 1000;
    if (t < 0 || t > D20_DUR) { if (t > D20_DUR) { this.cast = null; this.qaT = -1; } return; } // natural OUT, terrain untouched
    const field = this.ensureField();
    const atime = this.contour.aTime(Math.min(t, 10.4));
    const pull = smoothstep(1.2, 5.3, atime) * (atime > 6.1 ? 1 - seg(atime, 6.1, 8.3) : 1);
    const span = Math.min(1, Math.max(0, (t - 1.6) / (3.0 - 1.6)));
    const wt = new Float32Array(257);
    for (let i = 0; i <= 256; i++) wt[i] = this.contour.width(i / 256, t);
    const flash = (t >= 6.6 && t < 6.7) ? 0.35 : 0; // source collision beat at TCOL=6.6
    // source window (480x270) anchored at cast point, screen space
    const sx = Math.round(this.cast.wx - frame.cam.x - F20_W / 2);
    const sy = Math.round(this.cast.wy - frame.cam.y - F20_H / 2);
    comp.submitGpuPass({
      clientId: this.id, kind: 'rift',
      lightTex: (p.lightTexture() ?? null) as any,
      warp: field, // reused as the rift field channel for 'rift' layers
      influence: new Uint8Array(4),
      region: { x: sx, y: sy, w: F20_W, h: F20_H },
      fade: 1, bloomGain: 1, time: t, tick: Math.floor(t * 60), seed: 151461,
      rift: { wt, pull, span, flash },
    } as any);
  }
}

export const d20 = new D20Client();
