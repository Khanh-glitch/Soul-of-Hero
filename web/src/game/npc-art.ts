/**
 * Soul of Hero — NPC human sprite kit.
 *
 * Loads the six CC0 MetroCity base sheets (112x96, 7 cols x 3 rows of 16x32 frames) for idle + walk
 * in three directions (fourth facing derived by horizontal reflection), plus the authored derivative
 * action frames (use / attack / hurt / downed / dead) as standalone 16x32 PNGs.
 *
 * Provenance: MetroCity — Free Topdown Character Pack by JIK-A-4, CC0 1.0 Universal (public domain
 * dedication), mirrored from mhmmdglc/crewdesk. Action frames are original derivative pixel art in the
 * same 16x32 top-down scale. No approved-art bypass: the kit is a shared generic human body, not a
 * per-profession animation library. Art acceptability is the Creator's verdict only.
 */
import type { HumanRecord, HumanState } from './humanworld';
import type { Dir } from './core';

export interface NpcClipSpec { yRow: number; frames: number; fps: number; loop: boolean; }
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
      idle: { yRow: 0, frames: 1, fps: 6, loop: true },   // column 0 = idle (single stance)
      walk: { yRow: 0, frames: 6, fps: 9, loop: true },    // columns 1-6 walk, all in row 0 (down)
    },
  };
}

/** Action frames are standalone 16x32 PNGs, one per action, facing down (mirrored for left/right). */
const ACTION_FILES: Record<string, string> = {
  use: 'action_use.png', attack: 'action_attack.png', hurt: 'action_hurt.png',
  downed: 'action_downed.png', dead: 'action_dead.png',
};

export type NpcAnimClip = 'idle' | 'walk' | 'use' | 'attack' | 'hurt' | 'downed' | 'dead';

/** Resolve which clip a human shows right now from its authoritative state. */
export function resolveNpcClip(h: HumanRecord, simSec: number, moving: boolean): NpcAnimClip {
  if (h.state === 'DEAD') return 'dead';
  if (h.state === 'DOWNED') return 'downed';
  if (h.wounds.some(w => w.bleeding && !w.treated) || (h as any).flash > 45) return 'hurt';
  if (h.state === 'FIGHTING') return 'attack';
  if (h.state === 'WORKING') return 'use';
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
  for (const f of Object.values(ACTION_FILES)) getImage(f);
}

export interface ResolvedNpcFrame {
  file: string;          // atlas file or action file
  sx: number; sy: number; sw: number; sh: number;
  mirrorX: boolean;
  clip: NpcAnimClip;
}

/** Resolve the exact source rect + mirror for a human at this instant. */
export function resolveNpcFrame(h: HumanRecord, simSec: number, moving: boolean): ResolvedNpcFrame | null {
  const clip = resolveNpcClip(h, simSec, moving);
  const dir: Dir = ((h.dir ?? 0) & 3) as Dir;
  // action frames are single-frame, facing down; mirror for left, none for right/up
  if (clip !== 'idle' && clip !== 'walk') {
    return {
      file: ACTION_FILES[clip], sx: 0, sy: 0, sw: 16, sh: 32,
      mirrorX: dir === 1, clip,
    };
  }
  const spec = NPC_APPEARANCES[h.appearance];
  if (!spec) return null;
  const clipSpec = clip === 'walk' ? spec.clips.walk : spec.clips.idle;
  // MetroCity rows: 0=down, 1=side, 2=up. Columns: 0=idle, 1-6=walk.
  let subRow = 0, mirrorX = false, frameCount = clipSpec.frames;
  if (dir === 0) subRow = 0;
  else if (dir === 1) { subRow = 1; mirrorX = true; }
  else if (dir === 2) subRow = 1;
  else subRow = 2;
  const rawIdx = Math.floor(Math.max(0, simSec) * clipSpec.fps);
  const frameIndex = clipSpec.loop ? (rawIdx % frameCount) : Math.min(frameCount - 1, rawIdx);
  const col = clip === 'walk' ? 1 + frameIndex : 0;
  return {
    file: spec.atlas,
    sx: col * spec.cellW,
    sy: subRow * spec.cellH,
    sw: spec.cellW, sh: spec.cellH,
    mirrorX, clip,
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
  if (rf.mirrorX) {
    g.save();
    g.translate(X + rf.sw, Y);
    g.scale(-1, 1);
    g.drawImage(img, rf.sx, rf.sy, rf.sw, rf.sh, 0, 0, rf.sw, rf.sh);
    g.restore();
  } else {
    g.drawImage(img, rf.sx, rf.sy, rf.sw, rf.sh, X, Y, rf.sw, rf.sh);
  }
  return true;
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
