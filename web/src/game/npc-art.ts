/**
 * Soul of Hero — NPC human sprite kit.
 *
 * Loads the six CC0 MetroCity base sheets (112x96, 7 cols x 3 rows of 16x32 frames). The same
 * recognizable body is used for every state; work/combat/health cues are sparse pixels layered on top.
 *
 * Provenance: MetroCity — Free Topdown Character Pack by JIK-A-4, CC0 1.0 Universal (public domain
 * dedication), mirrored from mhmmdglc/crewdesk. Action frames are original derivative pixel art in the
 * same 16x32 top-down scale. No approved-art bypass: the kit is a shared generic human body, not a
 * per-profession animation library. Art acceptability is the Creator's verdict only.
 */
import type { HumanRecord, HumanState } from './humanworld';
import type { Dir } from './core';

export interface NpcClipSpec { frames: number; fps: number; loop: boolean; }
export interface NpcAppearanceSpec {
  atlas: string; cellW: number; cellH: number; drawW: number; drawH: number;
  footOffsetY: number; headOffsetY: number; shadowRx: number; shadowRy: number;
  clips: { idle: NpcClipSpec; walk: NpcClipSpec };
}
export const NPC_APPEARANCES: Record<number, NpcAppearanceSpec> = {
  0: mkSpec('char_0.png'), 1: mkSpec('char_1.png'), 2: mkSpec('char_2.png'),
  3: mkSpec('char_3.png'), 4: mkSpec('char_4.png'), 5: mkSpec('char_5.png'),
};
function mkSpec(atlas: string): NpcAppearanceSpec {
  return {
    atlas, cellW: 16, cellH: 32, drawW: 16, drawH: 32,
    footOffsetY: 4, headOffsetY: 22, shadowRx: 6, shadowRy: 3,
    clips: {
      idle: { frames: 1, fps: 2, loop: true },
      walk: { frames: 6, fps: 9, loop: true },             // columns 1-6, direction selected by atlas row
    },
  };
}

export type NpcAnimClip = 'idle' | 'walk' | 'use' | 'attack' | 'hurt' | 'downed' | 'dead';
export const NPC_DIRECTIONS = ['down', 'left', 'right', 'up'] as const;

/** Resolve which overlay/locomotion clip a human shows from authoritative state.
 *  Every clip keeps the same MetroCity body underneath; no generic action tile replaces identity. */
export function resolveNpcClip(h: HumanRecord, simSec: number, moving: boolean): NpcAnimClip {
  if (h.state === 'DEAD') return 'dead';
  if (h.state === 'DOWNED') return 'downed';
  const now = simSec * 1000;
  if (h.lastDamageAt !== undefined && now >= h.lastDamageAt && now - h.lastDamageAt < 180) return 'hurt';
  if (moving) return 'walk';
  if (h.lastAttackAt !== undefined && now >= h.lastAttackAt && now - h.lastAttackAt < 240) return 'attack';
  if (h.state === 'WORKING' && h.intent?.kind === 'work' && (h.intent.target?.startsWith('harvest:') || !!h.intent.work && h.intent.work.phase !== 'machine')) return 'use';
  return moving ? 'walk' : 'idle';
}

const imageCache = new Map<string, HTMLImageElement | null>();
function getImage(file: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (imageCache.has(file)) return imageCache.get(file)!;
  const img = new Image();
  img.decoding = 'async';
  img.src = `${import.meta.env.BASE_URL || '/'}assets/npc/metrocity_v1/${file}`;
  imageCache.set(file, img);
  return img;
}

/** Prewarm all NPC images in browser environments. */
export function preloadNpcArt(): void {
  if (typeof Image === 'undefined') return;
  for (const spec of Object.values(NPC_APPEARANCES)) getImage(spec.atlas);
}

export interface ResolvedNpcFrame {
  file: string;          // the same identifiable MetroCity atlas in every state
  sx: number; sy: number; sw: number; sh: number;
  mirrorX: boolean;
  clip: NpcAnimClip;
  dir: Dir;
  appearance: number;
  row: number;
  frameIndex: number;
}

/** Resolve the exact atlas source rect + row orientation for a human at this instant. */
export function resolveNpcFrame(h: HumanRecord, simSec: number, moving: boolean): ResolvedNpcFrame | null {
  const clip = resolveNpcClip(h, simSec, moving);
  const dir: Dir = ((h.dir ?? 0) & 3) as Dir;
  const spec = NPC_APPEARANCES[h.appearance];
  if (!spec) return null;
  const clipSpec = clip === 'walk' ? spec.clips.walk : spec.clips.idle;
  // MetroCity atlas rows: 0 faces down/front, 1 faces up/back, 2 is the authored
  // right-facing profile. Left reuses row 2 with a horizontal reflection.
  const row = dir === 0 ? 0 : dir === 3 ? 1 : 2;
  const mirrorX = dir === 1;
  const rawIdx = clip === 'walk' ? Math.floor(Math.max(0, simSec) * clipSpec.fps) : 0;
  const frameIndex = clip === 'walk'
    ? (clipSpec.loop ? rawIdx % clipSpec.frames : Math.min(clipSpec.frames - 1, rawIdx))
    : 0;
  const col = clip === 'walk' ? 1 + frameIndex : 0;
  return {
    file: spec.atlas, sx: col * spec.cellW, sy: row * spec.cellH,
    sw: spec.cellW, sh: spec.cellH, mirrorX, clip, dir,
    appearance: h.appearance, row, frameIndex,
  };
}

/** Draw a human sprite at crisp 1:1 pixel scale. Returns true if drawn, false if still loading. */
export function drawNpcSprite(
  g: CanvasRenderingContext2D, h: HumanRecord, x: number, y: number, simSec: number, moving: boolean,
): boolean {
  const rf = resolveNpcFrame(h, simSec, moving);
  if (!rf) return false;
  const img = getImage(rf.file);
  if (!img || !img.complete || !img.naturalWidth) return false;
  const X = Math.round(x - 8), Y = Math.round(y - 28);
  if (rf.clip === 'downed' || rf.clip === 'dead') {
    // Collapse the same 1×16×32 body using a quarter-turn; cloth, hair and silhouette remain visible.
    g.save(); g.translate(X + 8, Y + 24); g.rotate(Math.PI / 2);
    g.drawImage(img, rf.sx, rf.sy, rf.sw, rf.sh, -8, -16, rf.sw, rf.sh); g.restore();
  } else if (rf.mirrorX) {
    g.save();
    g.translate(X + rf.sw, Y);
    g.scale(-1, 1);
    g.drawImage(img, rf.sx, rf.sy, rf.sw, rf.sh, 0, 0, rf.sw, rf.sh);
    g.restore();
  } else {
    g.drawImage(img, rf.sx, rf.sy, rf.sw, rf.sh, X, Y, rf.sw, rf.sh);
  }
  drawNpcActionMark(g, h, X, Y, rf, simSec);
  return true;
}

/** Tiny semantic pixels decorate, but never replace or recolor, the person's full body. */
function drawNpcActionMark(g: CanvasRenderingContext2D, h: HumanRecord, X: number, Y: number, rf: ResolvedNpcFrame, simSec: number): void {
  const face: Record<Dir, [number, number]> = { 0: [0, 1], 1: [-1, 0], 2: [1, 0], 3: [0, -1] };
  const [fx, fy] = face[rf.dir];
  g.save();
  g.imageSmoothingEnabled = false;
  if (rf.clip === 'use') {
    // A real WORKING state gets a visible hand tool. Bare-hand gathering has no fake tool.
    const tool = h.equip.weapon?.key;
    const hx = X + 8 + (fx < 0 ? -4 : fx > 0 ? 4 : 0);
    const hy = Y + 18 + (fy > 0 ? 4 : fy < 0 ? -3 : 0);
    if (tool) {
      g.fillStyle = '#785331'; g.fillRect(hx, hy, 1, 7);
      g.fillStyle = tool.includes('pick') ? '#c9d2d2' : '#b8a077';
      if (tool.includes('pick')) { g.fillRect(hx - 2, hy - 1, 5, 1); g.fillRect(hx - 1, hy - 2, 1, 2); }
      else { g.fillRect(hx - 1, hy - 2, 4, 2); g.fillStyle = '#e1dfd2'; g.fillRect(hx + (fx < 0 ? -1 : 2), hy - 2, 1, 2); }
    } else {
      g.fillStyle = '#7eaa58'; g.fillRect(hx + fx, hy + fy, 2, 2);
    }
  } else if (rf.clip === 'attack') {
    // The equipped item's hand remains attached to the same body; unarmed strikes show no weapon.
    if (h.equip.weapon) {
      const hx = X + 8 + fx * 5, hy = Y + 19 + fy * 3;
      g.fillStyle = '#9e7847'; g.fillRect(hx, hy, 1, 5);
      g.fillStyle = '#e3dfca'; g.fillRect(hx + fx * 2, hy + fy * 2, 2, 1);
    }
    if (h.lastAttackAt !== undefined && simSec * 1000 - h.lastAttackAt < 90) {
      g.fillStyle = '#ffc468'; g.fillRect(X + 8 + fx * 10, Y + 17 + fy * 5, 2, 2);
      g.fillStyle = '#fff0bb'; g.fillRect(X + 8 + fx * 12, Y + 16 + fy * 6, 1, 1);
    }
  } else if (rf.clip === 'hurt') {
    g.fillStyle = '#f05f55'; g.fillRect(X + 13, Y + 8, 2, 2);
  } else if (rf.clip === 'downed') {
    g.fillStyle = '#d9c277'; g.fillRect(X + 6, Y + 4, 4, 1); g.fillRect(X + 7, Y + 3, 2, 3);
  } else if (rf.clip === 'dead') {
    g.fillStyle = '#c96d60'; g.fillRect(X + 5, Y + 5, 4, 1); g.fillRect(X + 6, Y + 4, 1, 3); g.fillRect(X + 8, Y + 4, 1, 3);
  }
  g.restore();
}

/** Pixel-snapped contact shadow for a human. */
export function drawNpcShadow(g: CanvasRenderingContext2D, x: number, y: number, rx = 6, ry = 3, alpha = 0.32): void {
  const X = Math.round(x), Y = Math.round(y);
  const rxi = Math.max(3, Math.round(rx)), ryi = Math.max(1, Math.round(ry * 0.65));
  g.fillStyle = `rgba(10,6,14,${alpha})`;
  for (let dy = -ryi; dy <= ryi; dy++) {
    const frac = Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ryi + 0.65) * (ryi + 0.65))));
    const hw = Math.max(2, Math.round(rxi * frac));
    g.fillRect(X - hw, Y + dy, hw * 2, 1);
  }
}
