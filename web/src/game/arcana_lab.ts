// ============================================================================
// ARCANA20 batch FX Lab client — source-vote-faithful batch registration.
// One shared packet/presentation contract; four native-semantic source runners:
//   A: aRunner (vendored A Lab, 416x234 HDR)   B: bRunner (vendored B, 384x216)
//   C: cRunner (vendored C Frame, 384x216)     D: existing D19 bridge (#19)
// #20 uses the dedicated A+C semantic bridge (arcana20.ts).
// All runners composite onto the REAL SOH world region (no lab background).
// Visual-only QA; read-only event contract; no HP/charge/save/gameplay changes.
// ============================================================================
import { CRunner, CATALOG, C_W, C_H } from './arcana_d20/source/cRunner';
import { BRunner, B_W, B_H, B_EFFECTS } from './arcana_d20/source/bRunner';
import { ARunner, A_W, A_H, A_SPELLS } from './arcana_d20/source/aRunner';
import { d19 } from './arcanaD19';
import { d20 } from './arcana20';
import * as comp from './compositor';
import { getPresenter } from './gpu/presenter';

export type RenderMode = 'lead' | 'study' | 'fusion';

export interface LabEntry {
  id: number; index: number; name: string; school: string;
  dur: number; climax: number;
  /** creator's approved visual lead from FUSION_DECISIONS votes */
  approvedVisualLead: string;
  /** what the current render mode actually draws */
  currentlyRenderedSource: string;
  previewStatus: 'SOURCE_PREVIEW' | 'FUSION_PREVIEW' | 'REDESIGN_STUDY';
  fusionStatus: 'NONE' | 'CANDIDATE_ONLY_NOT_APPROVED';
  artAcceptance: 'CREATOR_APPROVED_LEAD' | 'STUDY_NOT_APPROVED';
}

const LEAD: Record<number, string> = {
  1: 'A+C', 2: 'B', 3: 'B', 4: 'NEW', 5: 'A+C', 6: 'NEW', 7: 'C', 8: 'B',
  9: 'A+B+C', 10: 'C', 11: 'A(+C#9)', 12: 'NEW', 13: 'NEW', 14: 'NEW', 15: 'C',
  16: 'A+C', 17: 'C', 18: 'NEW', 19: 'D', 20: 'A+C',
};
const STATUS: Record<number, LabEntry['previewStatus']> = {
  1: 'FUSION_PREVIEW', 5: 'FUSION_PREVIEW', 9: 'FUSION_PREVIEW', 11: 'FUSION_PREVIEW',
  16: 'FUSION_PREVIEW', 20: 'FUSION_PREVIEW',
  4: 'REDESIGN_STUDY', 6: 'REDESIGN_STUDY', 12: 'REDESIGN_STUDY', 13: 'REDESIGN_STUDY',
  14: 'REDESIGN_STUDY', 18: 'REDESIGN_STUDY',
};
const FUSION_IDS = new Set([1, 5, 9, 11, 16, 20]);
const B_IDS = new Set([2, 3, 8]);
const C_IDS = new Set([7, 10, 15, 17]);
const A_IDS = new Set([11]);

export const LAB_CATALOG: LabEntry[] = CATALOG.map((c) => {
  const lead = LEAD[c.id] ?? 'C';
  return {
    id: c.id, index: c.index, name: c.name, school: c.school, dur: c.dur, climax: c.climax,
    approvedVisualLead: lead,
    currentlyRenderedSource: sourceLabel(c.id, 'lead'),
    previewStatus: STATUS[c.id] ?? 'SOURCE_PREVIEW',
    fusionStatus: FUSION_IDS.has(c.id) ? 'CANDIDATE_ONLY_NOT_APPROVED' : 'NONE',
    artAcceptance: STATUS[c.id] === 'REDESIGN_STUDY' ? 'STUDY_NOT_APPROVED' : 'CREATOR_APPROVED_LEAD',
  };
});

export function sourceLabel(id: number, mode: RenderMode): string {
  if (mode === 'study') return 'C (study)';
  if (id === 19) return 'D (D19 bridge)';
  if (id === 20) return 'A+C (semantic bridge)';
  if ((mode === 'fusion' || mode === 'lead') && FUSION_IDS.has(id) && id !== 20) return id === 9 ? 'A+B+C (candidate)' : 'A+C (candidate)';
  if (B_IDS.has(id)) return 'B';
  if (A_IDS.has(id)) return 'A';
  return 'C';
}

interface Cast { index: number; mode: RenderMode; wx: number; wy: number; startMs: number }

export class ArcanaLabClient implements comp.VfxClient {
  readonly id = 'arcana-lab';
  catalog = LAB_CATALOG;
  private cR = new CRunner();
  private bR = new BRunner();
  private aR = new ARunner();
  private blend = new Uint8ClampedArray(Math.max(C_W, A_W) * Math.max(C_H, A_H) * 4);
  private cast: Cast | null = null;
  private qaT = -1;
  private lastTick = -1;
  private lastAnchor = -1;

  qaCast(index: number, wx = 0, wy = 0, mode: RenderMode = 'lead') {
    this.stopBridges();
    this.cast = { index, mode, wx, wy, startMs: Date.now() };
    this.qaT = -1;
    this.lastTick = -1;
    this.lastAnchor = -1;
  }
  qaStop() { this.cast = null; this.qaT = -1; this.lastTick = -1; this.lastAnchor = -1; this.stopBridges(); }
  qaSeek(t: number, index?: number, wx = 0, wy = 0, mode?: RenderMode) {
    if (index !== undefined) {
      const m = mode ?? this.cast?.mode ?? 'lead';
      if (!this.cast || this.cast.index !== index || this.cast.mode !== m) this.qaCast(index, wx, wy, m);
    }
    this.qaT = t;
    if (!this.cast) this.cast = { index: 0, mode: 'lead', wx, wy, startMs: 0 };
  }
  qaInfo() {
    const c = this.cast;
    const e = c ? LAB_CATALOG[c.index] : null;
    if (!e) return null;
    return { ...e, mode: c!.mode, currentlyRenderedSource: sourceLabel(e.id, c!.mode) };
  }
  private stopBridges() { d19.qaStop(); d20.qaStop(); }

  submitGpu(frame: comp.FrameCtx): void {
    const p = getPresenter();
    if (!p || !p.gl || !this.cast) return;
    const entry = LAB_CATALOG[this.cast.index];
    const t = this.qaT >= 0 ? this.qaT : (frame.now - this.cast.startMs) / 1000;
    const dur = entry.dur + 1.0;
    if (t < 0 || t > dur) { if (t > dur) { this.cast = null; this.qaT = -1; this.stopBridges(); } return; }
    const tick = Math.floor(t * 60);

    // D (#19) and A+C #20 route to their dedicated bridges — no frame pass here.
    if (this.cast.mode !== 'study' && (entry.id === 19 || entry.id === 20)) {
      if (tick !== this.lastTick) {
        this.lastTick = tick;
        if (entry.id === 19) d19.qaSeek(Math.min(t, 10.2), this.cast.wx, this.cast.wy);
        else d20.qaSeek(Math.min(t, 10.4), this.cast.wx, this.cast.wy);
      }
      return;
    }


    const useFusion = (this.cast.mode === 'fusion' || this.cast.mode === 'lead') && FUSION_IDS.has(entry.id) && entry.id !== 20;
    const useB = this.cast.mode !== 'study' && this.cast.mode !== 'fusion' && B_IDS.has(entry.id);
    const useA = this.cast.mode !== 'study' && this.cast.mode !== 'fusion' && A_IDS.has(entry.id);

    let W = C_W, H = C_H, out: Uint8ClampedArray = this.cR.out;
    if (useB) { W = B_W; H = B_H; }
    else if (useA) { W = A_W; H = A_H; }

    const sx = Math.round(this.cast.wx - frame.cam.x - W / 2);
    const sy = Math.round(this.cast.wy - frame.cam.y - H / 2);
    const region = p.worldRegion(sx, sy, W, H);
    if (!region) return;

    const anchor = sx * 4096 + sy;
    const needRender = tick !== this.lastTick || anchor !== this.lastAnchor;
    if (useFusion) {
      // recipe composition: render each elected source component and blend
      const parts: Uint8ClampedArray[] = [];
      if (needRender) {
        const aRegion = p.worldRegion(Math.round(this.cast.wx - frame.cam.x - A_W / 2), Math.round(this.cast.wy - frame.cam.y - A_H / 2), A_W, A_H);
        this.aR.setWorld(aRegion && aRegion.length >= A_W * A_H * 4 ? aRegion : region);
        this.aR.cast(entry.index); this.aR.seek(Math.min(t, this.aR.duration));
        parts.push(this.aR.out);
        const cRegion = p.worldRegion(Math.round(this.cast.wx - frame.cam.x - C_W / 2), Math.round(this.cast.wy - frame.cam.y - C_H / 2), C_W, C_H) ?? region;
        this.cR.setWorld(cRegion); this.cR.cast(entry.index); this.cR.seek(Math.min(t, entry.dur));
        parts.push(this.cR.out);
        if (entry.id === 9) {
          const bRegion = p.worldRegion(Math.round(this.cast.wx - frame.cam.x - B_W / 2), Math.round(this.cast.wy - frame.cam.y - B_H / 2), B_W, B_H) ?? region;
          this.bR.setWorld(bRegion); this.bR.cast(entry.index); this.bR.seek(Math.min(t, this.bR.duration));
          parts.push(this.bR.out);
        }
      } else {
        parts.push(this.aR.out, this.cR.out);
        if (entry.id === 9) parts.push(this.bR.out);
      }
      const n = parts.length, bw = C_W, bh = C_H;
      for (let i = 0; i < bw * bh * 4; i++) this.blend[i] = 0;
      for (const part of parts) {
        const pw = part === this.aR.out ? A_W : part === this.bR.out ? B_W : C_W;
        const ph = part === this.aR.out ? A_H : part === this.bR.out ? B_H : C_H;
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const si = ((Math.min(y, ph - 1)) * pw + Math.min(x, pw - 1)) * 4, di = (y * bw + x) * 4;
          this.blend[di] += part[si] / n; this.blend[di + 1] += part[si + 1] / n;
          this.blend[di + 2] += part[si + 2] / n; this.blend[di + 3] = 255;
        }
      }
      out = this.blend;
    } else if (useB) {
      if (needRender) { this.bR.setWorld(region); this.bR.cast(entry.index); this.bR.seek(t); }
      out = this.bR.out;
    } else if (useA) {
      if (needRender) { this.aR.setWorld(region); this.aR.cast(entry.index); this.aR.seek(Math.min(t, this.aR.duration)); }
      out = this.aR.out;
    } else {
      if (needRender) { this.cR.setWorld(region); this.cR.cast(entry.index); this.cR.seek(t); }
      out = this.cR.out;
    }

    p.uploadFrame(out, W, H);
    this.lastTick = tick;
    this.lastAnchor = anchor;
    comp.submitGpuPass({
      clientId: this.id, kind: 'frame',
      lightTex: p.lightTexture()!, frameTex: p.frameTexture()!, warp: new Float32Array(4), influence: new Uint8Array(4),
      region: { x: sx, y: sy, w: W, h: H },
      fade: 1, bloomGain: 1, time: t, tick: Math.floor(t * 60), seed: 1000 + entry.id * 7919,
      frameFlash: 0,
    } as any);
  }
}

export const arcanaLab = new ArcanaLabClient();
export { B_EFFECTS, A_SPELLS };
