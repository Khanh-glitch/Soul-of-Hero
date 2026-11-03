// ============================================================================
// ARCANA20 batch FX Lab client — registers all 20 source-backed previews.
// Visual-only QA: runs the vendored source-C spells (unmodified) on the C
// Frame with the REAL SOH world region as base, composited by the source
// equation and presented as one 'frame' layer through the single presenter.
// #20 keeps its dedicated A+C semantic bridge (arcana20.ts). No gameplay,
// HP, charge or save changes — this exposes the visual event surface only.
// ============================================================================
import { CRunner, CATALOG, C_W, C_H } from './arcana_d20/source/cRunner';
import * as comp from './compositor';
import { getPresenter } from './gpu/presenter';

interface Cast { index: number; wx: number; wy: number; startMs: number }

export class ArcanaLabClient implements comp.VfxClient {
  readonly id = 'arcana-lab';
  catalog = CATALOG;
  private runner = new CRunner();
  private cast: Cast | null = null;
  private qaT = -1;

  qaCast(index: number, wx = 0, wy = 0) {
    this.runner.cast(index);
    this.qaT = -1;
    this.cast = { index, wx, wy, startMs: Date.now() };
  }
  qaSeek(t: number, index?: number, wx = 0, wy = 0) {
    if (index !== undefined && (!this.cast || this.cast.index !== index)) this.qaCast(index, wx, wy);
    if (this.qaT >= 0 && t < this.qaT) this.runner.reset();
    this.qaT = t;
    if (!this.cast) this.cast = { index: 0, wx, wy, startMs: 0 };
  }
  qaInfo() {
    const c = this.cast;
    const e = c ? CATALOG[c.index] : null;
    return e ? { id: e.id, name: e.name, status: e.status, dur: e.dur, climax: e.climax } : null;
  }

  submitGpu(frame: comp.FrameCtx): void {
    const p = getPresenter();
    if (!p || !p.gl || !this.cast) return;
    const entry = CATALOG[this.cast.index];
    const t = this.qaT >= 0 ? this.qaT : (frame.now - this.cast.startMs) / 1000;
    if (t < 0 || t > entry.dur + 1.0) { if (t > entry.dur + 1.0) { this.cast = null; this.qaT = -1; } return; }
    const sx = Math.round(this.cast.wx - frame.cam.x - C_W / 2);
    const sy = Math.round(this.cast.wy - frame.cam.y - C_H / 2);
    const region = p.worldRegion(sx, sy, C_W, C_H);
    if (!region) return;
    this.runner.setWorld(region);
    this.runner.seek(t);
    p.uploadFrame(this.runner.out);
    comp.submitGpuPass({
      clientId: this.id, kind: 'frame',
      lightTex: p.lightTexture()!, frameTex: p.frameTexture()!, warp: new Float32Array(4), influence: new Uint8Array(4),
      region: { x: sx, y: sy, w: C_W, h: C_H },
      fade: 1, bloomGain: 1, time: t, tick: Math.floor(t * 60), seed: 1000 + this.cast.index * 7919,
      frameFlash: 0,
    } as any);
  }
}

export const arcanaLab = new ArcanaLabClient();
