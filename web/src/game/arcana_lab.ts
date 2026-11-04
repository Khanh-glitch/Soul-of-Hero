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
import { RECIPES, recipeLabel, composeFusion } from './arcana_d20/source/fusionRecipe';
import { RedesignRunner, REDESIGNS } from './arcana_d20/source/redesign';
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
  artAcceptance: 'CREATOR_APPROVED_LEAD' | 'STUDY_NOT_APPROVED' | 'REDESIGN_IMPLEMENTED_CANDIDATE';
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
  14: 'REDESIGN_STUDY',
};
const FUSION_IDS = new Set([1, 5, 9, 11, 16, 20]);
const B_IDS = new Set([2, 3, 8]);
const REDESIGN_IDS = new Set(Object.keys(REDESIGNS).map(Number));
const C_IDS = new Set([7, 10, 15, 17]);
// Creator-directed salvage (2026-11-04): #7/#10/#16/#17 render their GOLD source-C
// spell directly through the proven opaque + edge-feathered window path (the same
// presentation the approved B leads #02/#03/#08 use); #18 renders the source-B CUBE
// Chronoshard instead of the redesign study. The signed-delta/influence-mask seam is
// bypassed for these five — that experimental path was the root cause of the broken
// pixels / flipped window / per-frame jank seen on this batch.
const SALVAGE_DIRECT = new Set([7, 10, 16, 17, 18]);


export const LAB_CATALOG: LabEntry[] = CATALOG.map((c) => {
  const lead = LEAD[c.id] ?? 'C';
  const rd = c.id === 18 ? undefined : REDESIGNS[c.id]; // #18 renders source-B cube; redesign slots use their AUTHORED clock, not the C catalog
  return {
    id: c.id, index: c.index, name: c.name, school: c.school, dur: rd?.dur ?? c.dur, climax: rd?.climax ?? c.climax,
    approvedVisualLead: lead,
    currentlyRenderedSource: sourceLabel(c.id, 'lead'),
    previewStatus: STATUS[c.id] ?? 'SOURCE_PREVIEW',
    fusionStatus: FUSION_IDS.has(c.id) ? 'CANDIDATE_ONLY_NOT_APPROVED' : 'NONE',
    artAcceptance: STATUS[c.id] === 'REDESIGN_STUDY' ? 'REDESIGN_IMPLEMENTED_CANDIDATE' : 'CREATOR_APPROVED_LEAD',
  };
});

export function sourceLabel(id: number, mode: RenderMode): string {
  if (mode === 'study') return 'C (study)';
  if (id === 19) return 'D (D19 bridge)';
  if (id === 20) return 'A+C (semantic bridge)';
  if (mode === 'fusion' && RECIPES[id]) return recipeLabel(RECIPES[id]) + ' (recipe)';
  if (id === 18) return 'B (khối lập phương)'; // salvaged to the source-B cube version
  if (id === 16) return 'C'; // salvaged to the gold source-C spell
  if (FUSION_IDS.has(id) && id !== 20) return 'A'; // lead mode = pure A structure
  if (B_IDS.has(id)) return 'B';
  if (REDESIGN_IDS.has(id)) return 'REDESIGN (new authored)';
  return 'C';
}

interface Cast { index: number; mode: RenderMode; wx: number; wy: number; startMs: number }

export class ArcanaLabClient implements comp.VfxClient {
  readonly id = 'arcana-lab';
  catalog = LAB_CATALOG;
  private cR = new CRunner();
  private rR = new RedesignRunner();
  private bR = new BRunner();
  private aR = new ARunner();
  private blend = new Uint8ClampedArray(Math.max(C_W, A_W) * Math.max(C_H, A_H) * 4);
  private deltaBuf = new Float32Array(C_W * C_H * 4); // signed frame delta (C/redesign path)
  private cast: Cast | null = null;
  private qaT = -1;
  private lastTick = -1;
  private lastAnchor = -1;
  private lastWorld = -1;

  qaCast(index: number, wx = 0, wy = 0, mode: RenderMode = 'lead') {
    this.stopBridges();
    this.cast = { index, mode, wx, wy, startMs: Date.now() };
    this.qaT = -1;
    this.lastTick = -1;
    this.lastAnchor = -1;
    this.lastWorld = -1;
  }
  qaStop() { this.cast = null; this.qaT = -1; this.lastTick = -1; this.lastAnchor = -1; this.lastWorld = -1; this.stopBridges(); }
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


    const useFusion = this.cast.mode === 'fusion' && !!RECIPES[entry.id];
    // salvage routing: #18 lead = source-B cube Chronoshard; #16 lead = gold C (not A)
    const useB = this.cast.mode === 'lead' && (B_IDS.has(entry.id) || entry.id === 18);
    const useR = this.cast.mode === 'lead' && REDESIGN_IDS.has(entry.id) && entry.id !== 18;
    const useA = this.cast.mode === 'lead' && (FUSION_IDS.has(entry.id) && entry.id !== 20) && entry.id !== 16;

    let W = C_W, H = C_H, out: Uint8ClampedArray = this.cR.out;
    if (useB) { W = B_W; H = B_H; }
    else if (useA || useFusion) { W = A_W; H = A_H; }

    const sx = Math.round(this.cast.wx - frame.cam.x - W / 2);
    const sy = Math.round(this.cast.wy - frame.cam.y - H / 2);
    const region = p.worldRegion(sx, sy, W, H);
    if (!region) return;

    const anchor = sx * 4096 + sy;
    // world snapshot revision participates in cache validity: same tick+camera
    // with a changed world (day/night, recast elsewhere) must re-render.
    let wsum = 0;
    for (let i = 0; i < region.length; i += 389) wsum = (wsum * 31 + region[i]) | 0;
    const needRender = tick !== this.lastTick || anchor !== this.lastAnchor || wsum !== this.lastWorld;
    if (useFusion) {
      // semantic source-contribution contract: authored arc packets / light
      // channels extracted per recipe, bound to the lead's moving anchors.
      // FAIL CLOSED: the CURRENT world snapshot is mandatory; invalid recipe or
      // missing world aborts the pass (no stale frame is ever presented).
      if (needRender) {
        const recipe = RECIPES[entry.id];
        const cx = Math.round(this.cast.wx - frame.cam.x), cy = Math.round(this.cast.wy - frame.cam.y);
        const worldFor = (w: number, h: number): Uint8ClampedArray => {
          const r = p.worldRegion(cx - Math.round(w / 2), cy - Math.round(h / 2), w, h);
          if (!r || r.length !== w * h * 4) throw new Error(`arcana-lab: current world snapshot missing/wrong size for ${w}x${h}`);
          return r;
        };
        try {
          composeFusion(recipe, { a: this.aR, b: this.bR, c: this.cR }, worldFor,
            Math.min(t, entry.dur) / Math.max(entry.dur, 1e-6), this.blend);
        } catch (err: any) {
          (window as any).__arcanaLabError = `recipe #${entry.id}: ${err.message}`;
          this.lastTick = tick; this.lastAnchor = anchor;
          return; // fail closed: skip this frame's pass entirely
        }
      }
      out = this.blend;
    } else if (useB) {
      if (needRender) {
        this.bR.setWorld(region);
        // no per-frame re-cast (same guard as the C branch): recast only on spell
        // change, seek() advances incrementally. Bit-identical while the world is
        // static because recast is deterministic; this removes the O(n^2) re-sim.
        if (this.bR.current !== entry.index) this.bR.cast(entry.index);
        this.bR.seek(t);
      }
      out = this.bR.out;
    } else if (useR) {
      if (needRender) {
        this.rR.setWorld(region);
        if (this.rR.currentId !== entry.id) this.rR.cast(entry.id); // no per-frame re-cast
        this.rR.seek(t);
      }
      out = this.rR.out;
    } else if (useA) {
      if (needRender) { this.aR.setWorld(region); this.aR.cast(entry.index); this.aR.seek(Math.min(t, this.aR.duration)); }
      out = this.aR.out;
    } else {
      if (needRender) {
        this.cR.setWorld(region);
        // no per-frame re-cast: cast() resets the sim to t=0 and seek(t) would replay
        // the WHOLE spell every tick (O(n^2) full-frame composites = the lag on
        // #7/#10/#16/#17). Re-cast only on spell change; seek() advances incrementally
        // (and still rebuilds deterministically on backward scrub).
        if (this.cR.current !== entry.index) this.cR.cast(entry.index);
        this.cR.seek(t);
      }
      out = this.cR.out;
    }

    // AVFX active-frame closure: the C/redesign frame path submits a SIGNED,
    // effect-local contribution instead of pasting the composited source window.
    // delta = activeFrame - noEffectBaseline; the no-effect baseline through this
    // same compositor is bit-exact equal to the raw world sample `region`
    // (asserted in tests), so delta == out - region. The presenter renders
    // scene + delta * influenceMask, where the mask comes from the live source
    // Frame channels (light incl. negative, ink, displacement, ground decals) —
    // full-frame screen ops (flash/shake/kick) are NOT in the mask, so they can
    // no longer leak a straight-edged rectangle over the real terrain.
    // salvaged skills present the gold source frame directly (opaque + feather);
    // only non-salvaged C/redesign paths keep the signed-delta seam.
    const signed = !SALVAGE_DIRECT.has(entry.id) && (useR || (!useB && !useA && !useFusion));
    if (signed) {
      const runner = useR ? this.rR : this.cR;
      const infl = runner.influenceMask(3);
      const d = this.deltaBuf;
      for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        d[o] = out[o] - region[o];
        d[o + 1] = out[o + 1] - region[o + 1];
        d[o + 2] = out[o + 2] - region[o + 2];
        d[o + 3] = 0;
      }
      p.uploadFrameDelta(d, infl, W, H);
    } else {
      // legacy opaque window (B/A/fusion leads): feather the source window into the
      // real world so no hard rectangle edge survives (unchanged control behavior)
      const F = 14;
      for (let y = 0; y < H; y++) {
        const dy = Math.min(y, H - 1 - y);
        for (let x = 0; x < W; x++) {
          const dx = Math.min(x, W - 1 - x);
          const dd = Math.min(dx, dy);
          if (dd >= F) continue;
          const ramp = dd / F, k = ramp * ramp * (3 - 2 * ramp);
          const di = (y * W + x) * 4;
          for (let c = 0; c < 3; c++) out[di + c] = Math.round(region[di + c] * (1 - k) + out[di + c] * k);
        }
      }
      p.uploadFrame(out, W, H);
    }
    this.lastTick = tick;
    this.lastAnchor = anchor;
    this.lastWorld = wsum;
    comp.submitGpuPass({
      clientId: this.id, kind: 'frame',
      lightTex: p.lightTexture()!, frameTex: p.frameTexture()!, warp: new Float32Array(4), influence: new Uint8Array(4),
      region: { x: sx, y: sy, w: W, h: H },
      fade: 1, bloomGain: 1, time: t, tick: Math.floor(t * 60), seed: 1000 + entry.id * 7919,
      frameFlash: 0, signedDelta: signed ? 1 : 0,
    } as any);
  }
}

export const arcanaLab = new ArcanaLabClient();
export { B_EFFECTS, A_SPELLS };
