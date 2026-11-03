// ============================================================================
// ARCANA #19 "Constellation Engine" (D lead) — first GPU client of the unified
// compositor. Source choreography/geometry/timing ported UNCHANGED from the
// AVFX handoff (d8d62ec, P0 baseline b9b8cfa): ConstellationState seed 97,
// constellationCommands, DWarp, DRaster (vendor batches). What changed is ONLY
// the world interaction: instead of the Gold lab-floor LDR tone-delta (which
// produced hard bands on bright SOH terrain), the presenter applies a bounded
// material-aware response (see gpu/presenter.ts COMPOSITE_FS).
//
// QA-only bridge: window.__d19qa exposes cast/seek for visual verification.
// This is NOT an authentic #19 gameplay event; Gameplay (PR #38) remains the
// sole authority for cast/charge/HP. No engine.ts/sim.ts changes.
// ============================================================================

import { ConstellationState } from './arcana_d19/constellationState';
import { constellationCommands } from './arcana_d19/commands';
import { DWarp } from './arcana_d19/warp';
import { dInfluence } from './arcana_d19/influence';
import { DRaster, D19_SRC_W, D19_SRC_H } from './arcana_d19/raster';
import * as comp from './compositor';
import { getPresenter } from './gpu/presenter';

export const D19_SEED = 97;

interface Cast { wx: number; wy: number; scale: number; startMs: number }

export class D19Client implements comp.VfxClient {
  readonly id = 'arcana-d19';
  private state = new ConstellationState();
  private warp = new DWarp();
  private raster: DRaster | null = null;
  private cast: Cast | null = null;
  private lastTick = -1;
  /** QA-only: force a deterministic cast+seek (NOT a gameplay event) */
  qaCast = false; qaTick = 0;

  ensureRaster() {
    const p = getPresenter();
    if (p?.gl && !this.raster) this.raster = new DRaster(p.gl);
    if (p && this.raster && this.raster.needsRestore) this.raster.restore();
    return this.raster;
  }

  /** QA-only deterministic cast at world position, seeked to `seconds`. Labelled, not gameplay. */
  qaSeek(seconds: number, wx = 0, wy = 0) {
    this.qaCast = true;
    this.state = new ConstellationState();
    this.warp = new DWarp();
    this.lastTick = -1;
    this.state.advanceTo(seconds);
    this.qaTick = this.state.tick;
    this.warp.step(this.state.tick / 60);
    this.cast = { wx, wy, scale: 1, startMs: 0 };
  }

  submitGpu(frame: comp.FrameCtx): void {
    const p = getPresenter();
    const raster = this.ensureRaster();
    if (!p || !raster || !this.cast) return;
    const tick = this.qaCast ? this.qaTick : Math.floor((frame.now - this.cast.startMs) / (1000 / 60));
    if (tick < 0 || tick === this.lastTick) { if (tick !== this.lastTick && tick >= 0) { /* re-render same tick for camera move */ } else return; }
    if (tick < this.lastTick) return;
    this.lastTick = tick;
    if (tick / 60 > 10.2) { this.cast = null; this.lastTick = -1; return; } // natural OUT, no leftover FX
    this.state.advanceTo(tick / 60);
    const t = tick / 60;
    this.warp.step(t);
    const frameData = constellationCommands(this.state);
    raster.render(frameData.commands, frameData.rendererTime, p.lightTarget(), 'none');
    // place the 480x270 source window centered on the cast world position, screen space
    const scale = this.cast.scale * (D19_SRC_W / 480);
    const sx = Math.round(this.cast.wx - frame.cam.x - (D19_SRC_W * scale) / 2);
    const sy = Math.round(this.cast.wy - frame.cam.y - (D19_SRC_H * scale) / 2);
    comp.submitGpuPass({
      clientId: this.id, kind: 'd19',
      lightTex: p.lightTexture()!,
      warp: this.warp.data,
      influence: dInfluence(frameData.commands, this.warp),
      region: { x: sx, y: sy, w: Math.round(D19_SRC_W * scale), h: Math.round(D19_SRC_H * scale) },
      fade: frameData.warpFade, bloomGain: frameData.bloomGain, time: frameData.time,
      tick, seed: D19_SEED,
    });
  }
}

export const d19 = new D19Client();
