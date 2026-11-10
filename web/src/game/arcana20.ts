// ============================================================================
// ARCANA #20 "Reality Ripper" (A+C fusion) — second GPU client of the unified
// compositor. C contour/timeline (seed 151461) from the P0 donor; the world
// interaction runs as a bounded GPU field in the presenter (A-style world pull,
// chromatic split, void tear with rim, restitch restore). QA visual-only:
// no HP/charge/knockback/terrain-save changes — Gameplay owns those.
// ============================================================================

import { RipperContour, buildContourField, smoothstep, seg, F20_W, F20_H } from './arcana_d20/contour';
import { RipperContent } from './arcana_d20/content';
import { SemanticRipper, SF_W, SF_H } from './arcana_d20/source/semantic';
import { DRaster } from './arcana_d19/raster';
import * as comp from './compositor';
import { getPresenter } from './gpu/presenter';

export const D20_DUR = 10.4, D20_CLIMAX = 6.3;

interface Cast { wx: number; wy: number; startMs: number }

export class D20Client implements comp.VfxClient {
  readonly id = 'arcana-20';
  mode: 'current' | 'restored' = 'restored';
  private content = new RipperContent();
  private sem = new SemanticRipper();
  private raster: DRaster | null = null;
  private contour = new RipperContour();
  private field: Float32Array | null = null;
  private cast: Cast | null = null;
  private qaT = -1;

  private ensureField() { if (!this.field) this.field = buildContourField(this.contour); return this.field; }

  /** QA-only: play #20 from t=0 at a world position (visual only). */
  qaStop() { this.cast = null; this.qaT = -1; }
  qaPlay(wx: number, wy: number) { this.qaT = -1; this.cast = { wx, wy, startMs: Date.now() }; this.content.reset(); this.sem.reset(); }
  /** QA-only: freeze/seek to source time t (seconds). */
  qaSeek(t: number, wx = 0, wy = 0) { if (this.qaT >= 0 && t < this.qaT) { this.content.reset(); this.sem.reset(); } this.qaT = t; this.cast = { wx, wy, startMs: 0 }; }

  /** QA-only: render the semantic bridge at source time t into a visible
   *  #d20sem canvas (works without WebGL — pure CPU source frame). */
  qaSemFrame(t: number) {
    const p = getPresenter();
    const r = (window as any).__soh?.run;
    const wx = r?.player.x ?? 0, wy = r?.player.y ?? 0;
    const cam = (window as any).__cam ?? { x: 0, y: 0 };
    const fsx = Math.round(wx - cam.x - SF_W / 2), fsy = Math.round(wy - cam.y - SF_H / 2);
    const region = p?.worldRegion(fsx, fsy, SF_W, SF_H);
    if (region) {
      this.sem.setWorld(region);
      this.sem.stepTo(t);
      let cv = document.getElementById('d20sem') as HTMLCanvasElement | null;
      if (!cv) { cv = document.createElement('canvas'); cv.id = 'd20sem'; cv.width = SF_W; cv.height = SF_H; cv.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:9999;width:768px;height:432px;image-rendering:pixelated;border:1px solid #456'; document.body.appendChild(cv); }
      const ctx = cv.getContext('2d')!;
      ctx.putImageData(new ImageData(this.sem.out.slice(), SF_W, SF_H), 0, 0);
    }
  }

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
    let flash = (t >= 6.6 && t < 6.7) ? 0.35 : 0; // source collision beat at TCOL=6.6
    // source window (480x270) anchored at cast point, screen space
    const sx = Math.round(this.cast.wx - frame.cam.x - F20_W / 2);
    const sy = Math.round(this.cast.wy - frame.cam.y - F20_H / 2);
    // Source draw order = compositing order (single-framebuffer semantics):
    // 1) rift pass: world warp + void tear + rim (overwrites interior)
    // 2) glow pass: source in-tear geometry/sparkles ON TOP of the void
    // 3) blit pass: world-sampled fragments (f.blitBase) on top of everything
    if (this.mode === 'restored' && p && p.gl) {
      const pp = p;
      // SEMANTIC BRIDGE: run the unmodified P0 donor spell on the C Frame with
      // the REAL world region as base; composite with the source equation and
      // present the result as one 'frame' layer. No re-interpreted passes.
      const fsx = Math.round(this.cast.wx - frame.cam.x - SF_W / 2);
      const fsy = Math.round(this.cast.wy - frame.cam.y - SF_H / 2);
      const region = pp.worldRegion(fsx, fsy, SF_W, SF_H);
      if (region) {
        this.sem.setWorld(region);
        this.sem.stepTo(t);
        pp.uploadFrame(this.sem.out);
        comp.submitGpuPass({
          clientId: this.id, kind: 'frame',
          lightTex: pp.lightTexture()!, frameTex: pp.frameTexture()!, warp: field, influence: new Uint8Array(4),
          region: { x: fsx, y: fsy, w: SF_W, h: SF_H },
          fade: 1, bloomGain: 1, time: t, tick: Math.floor(t * 60), seed: 151461,
          frameFlash: this.sem.flash,
        } as any);
      }
      return;
    }
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
