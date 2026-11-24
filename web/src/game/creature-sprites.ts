import type { Creature, Dir } from './core';

export type AnimClipName = 'idle' | 'walk' | 'run' | 'attack' | 'attack2' | 'hurt' | 'death';

export interface ClipSpec {
  yRow: number;
  frames: number;
  fps: number;
  loop: boolean;
  /** Optional per-direction frame counts when a 3-dir sheet has shorter Up rows (e.g., Water Warrior Idle Up = 4f). */
  framesBySubRow?: [number, number, number];
}

export interface CreatureAtlasSpec {
  atlas: string;
  cellW: number;
  cellH: number;
  /** Native 1:1 draw scale on the 640×360 pixel-art stage (16px = 1 tile). */
  drawW: number;
  drawH: number;
  /** Exact vertical offset from creature ground anchor `y` to bottom of cell (`bottomPad + 5`), grounding feet on `y + 4`. */
  footOffsetY: number;
  /** Distance from creature ground anchor `y` up to the top of its head (`visH - 4`) for crisp overhead UI placement. */
  headOffsetY: number;
  shadowRx: number;
  shadowRy: number;
  layout: '4dir' | '3dir_mirror_left';
  clips: Partial<Record<AnimClipName, ClipSpec>>;
}

/** Engine Dir: 0 = DOWN (+Y), 1 = LEFT (-X), 2 = RIGHT (+X), 3 = UP (-Y).
 *  Canonical 4dir atlas rows: 0 = DOWN, 1 = UP, 2 = LEFT, 3 = RIGHT. */
export const DIR_TO_4ROW: readonly [number, number, number, number] = [0, 2, 3, 1];

export const CREATURE_ATLAS_SPECS: Record<string, CreatureAtlasSpec> = {
  // ---- 9 Ordinary Creatures (native 64×64 cells, 1x pixel art) ----
  vampire_1: {
    atlas: 'vampire_1.png', cellW: 64, cellH: 64, drawW: 64, drawH: 64, footOffsetY: 25, headOffsetY: 22, shadowRx: 7, shadowRy: 3, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 7, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 8, fps: 13, loop: true },
      attack: { yRow: 12, frames: 12, fps: 15, loop: false },
      hurt: { yRow: 16, frames: 4, fps: 12, loop: false },
      death: { yRow: 20, frames: 11, fps: 12, loop: false },
    },
  },
  vampire_2: {
    atlas: 'vampire_2.png', cellW: 64, cellH: 64, drawW: 64, drawH: 64, footOffsetY: 25, headOffsetY: 24, shadowRx: 8, shadowRy: 3, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 7, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 8, fps: 13, loop: true },
      attack: { yRow: 12, frames: 12, fps: 15, loop: false },
      hurt: { yRow: 16, frames: 4, fps: 12, loop: false },
      death: { yRow: 20, frames: 11, fps: 12, loop: false },
    },
  },
  vampire_3: {
    atlas: 'vampire_3.png', cellW: 64, cellH: 64, drawW: 64, drawH: 64, footOffsetY: 25, headOffsetY: 23, shadowRx: 9, shadowRy: 4, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 7, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 8, fps: 13, loop: true },
      attack: { yRow: 12, frames: 12, fps: 15, loop: false },
      hurt: { yRow: 16, frames: 4, fps: 12, loop: false },
      death: { yRow: 20, frames: 11, fps: 12, loop: false },
    },
  },
  orc_1: {
    atlas: 'orc_1.png', cellW: 64, cellH: 64, drawW: 64, drawH: 64, footOffsetY: 27, headOffsetY: 24, shadowRx: 8, shadowRy: 3, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 7, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 8, fps: 13, loop: true },
      attack: { yRow: 12, frames: 8, fps: 14, loop: false },
      hurt: { yRow: 16, frames: 6, fps: 13, loop: false },
      death: { yRow: 20, frames: 8, fps: 11, loop: false },
    },
  },
  orc_2: {
    atlas: 'orc_2.png', cellW: 64, cellH: 64, drawW: 64, drawH: 64, footOffsetY: 27, headOffsetY: 26, shadowRx: 8, shadowRy: 3.5, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 7, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 8, fps: 13, loop: true },
      attack: { yRow: 12, frames: 8, fps: 14, loop: false },
      hurt: { yRow: 16, frames: 6, fps: 13, loop: false },
      death: { yRow: 20, frames: 8, fps: 11, loop: false },
    },
  },
  orc_3: {
    atlas: 'orc_3.png', cellW: 64, cellH: 64, drawW: 64, drawH: 64, footOffsetY: 27, headOffsetY: 31, shadowRx: 9, shadowRy: 4, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 7, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 8, fps: 13, loop: true },
      attack: { yRow: 12, frames: 8, fps: 14, loop: false },
      hurt: { yRow: 16, frames: 6, fps: 13, loop: false },
      death: { yRow: 20, frames: 8, fps: 11, loop: false },
    },
  },
  slime_1: {
    atlas: 'slime_1.png', cellW: 64, cellH: 64, drawW: 64, drawH: 64, footOffsetY: 29, headOffsetY: 16, shadowRx: 7, shadowRy: 3, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 6, fps: 8, loop: true },
      walk: { yRow: 4, frames: 8, fps: 10, loop: true },
      run: { yRow: 8, frames: 8, fps: 13, loop: true },
      attack: { yRow: 12, frames: 10, fps: 14, loop: false },
      hurt: { yRow: 16, frames: 5, fps: 12, loop: false },
      death: { yRow: 20, frames: 10, fps: 12, loop: false },
    },
  },
  slime_2: {
    atlas: 'slime_2.png', cellW: 64, cellH: 64, drawW: 64, drawH: 64, footOffsetY: 29, headOffsetY: 17, shadowRx: 8, shadowRy: 3.5, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 6, fps: 8, loop: true },
      walk: { yRow: 4, frames: 8, fps: 10, loop: true },
      run: { yRow: 8, frames: 8, fps: 13, loop: true },
      attack: { yRow: 12, frames: 11, fps: 14, loop: false },
      hurt: { yRow: 16, frames: 5, fps: 12, loop: false },
      death: { yRow: 20, frames: 10, fps: 12, loop: false },
    },
  },
  slime_3: {
    atlas: 'slime_3.png', cellW: 64, cellH: 64, drawW: 64, drawH: 64, footOffsetY: 29, headOffsetY: 21, shadowRx: 8, shadowRy: 3.5, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 6, fps: 8, loop: true },
      walk: { yRow: 4, frames: 8, fps: 10, loop: true },
      run: { yRow: 8, frames: 8, fps: 13, loop: true },
      attack: { yRow: 12, frames: 9, fps: 14, loop: false },
      hurt: { yRow: 16, frames: 5, fps: 12, loop: false },
      death: { yRow: 20, frames: 10, fps: 12, loop: false },
    },
  },

  // ---- 5 Living Wildlife Species (native 32×32 cells, 1x pixel art) ----
  boar: {
    atlas: 'wildlife_boar.png', cellW: 32, cellH: 32, drawW: 32, drawH: 32, footOffsetY: 11, headOffsetY: 17, shadowRx: 7, shadowRy: 3, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 6, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 5, fps: 13, loop: true },
      attack: { yRow: 12, frames: 5, fps: 13, loop: false },
      hurt: { yRow: 16, frames: 4, fps: 12, loop: false },
      death: { yRow: 20, frames: 6, fps: 10, loop: false },
    },
  },
  deer: {
    atlas: 'wildlife_deer.png', cellW: 32, cellH: 32, drawW: 32, drawH: 32, footOffsetY: 11, headOffsetY: 20, shadowRx: 7, shadowRy: 3, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 6, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 6, fps: 14, loop: true },
      hurt: { yRow: 12, frames: 4, fps: 12, loop: false },
      death: { yRow: 16, frames: 7, fps: 10, loop: false },
    },
  },
  hare: {
    atlas: 'wildlife_hare.png', cellW: 32, cellH: 32, drawW: 32, drawH: 32, footOffsetY: 9, headOffsetY: 17, shadowRx: 5, shadowRy: 2, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 7, loop: true },
      walk: { yRow: 4, frames: 5, fps: 10, loop: true },
      run: { yRow: 8, frames: 6, fps: 15, loop: true },
      hurt: { yRow: 12, frames: 4, fps: 12, loop: false },
      death: { yRow: 16, frames: 6, fps: 10, loop: false },
    },
  },
  grouse: {
    atlas: 'wildlife_grouse.png', cellW: 32, cellH: 32, drawW: 32, drawH: 32, footOffsetY: 12, headOffsetY: 15, shadowRx: 5, shadowRy: 2, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 6, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 6, fps: 14, loop: true },
      hurt: { yRow: 12, frames: 4, fps: 12, loop: false },
      death: { yRow: 16, frames: 6, fps: 10, loop: false },
    },
  },
  fox: {
    atlas: 'wildlife_fox.png', cellW: 32, cellH: 32, drawW: 32, drawH: 32, footOffsetY: 10, headOffsetY: 15, shadowRx: 6, shadowRy: 2.5, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 7, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 6, fps: 14, loop: true },
      attack: { yRow: 12, frames: 6, fps: 15, loop: false },
      hurt: { yRow: 16, frames: 4, fps: 12, loop: false },
      death: { yRow: 20, frames: 6, fps: 10, loop: false },
    },
  },

  // ---- 4 Optional Side Bosses (native 1:1 cells, 1x pixel art) ----
  boss_greyback: {
    atlas: 'boss_rock.png', cellW: 64, cellH: 64, drawW: 64, drawH: 64, footOffsetY: 12, headOffsetY: 38, shadowRx: 14, shadowRy: 5, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 7, fps: 8, loop: true },
      walk: { yRow: 4, frames: 10, fps: 11, loop: true },
      attack: { yRow: 8, frames: 10, fps: 13, loop: false },
      attack2: { yRow: 12, frames: 13, fps: 13, loop: false },
      hurt: { yRow: 16, frames: 4, fps: 12, loop: false },
      death: { yRow: 20, frames: 8, fps: 10, loop: false },
    },
  },
  boss_tidemarshal: {
    atlas: 'boss_water.png', cellW: 48, cellH: 48, drawW: 48, drawH: 48, footOffsetY: 8, headOffsetY: 34, shadowRx: 10, shadowRy: 4, layout: '3dir_mirror_left',
    clips: {
      idle: { yRow: 0, frames: 6, fps: 8, loop: true, framesBySubRow: [6, 6, 4] },
      walk: { yRow: 3, frames: 4, fps: 10, loop: true, framesBySubRow: [4, 4, 4] },
      attack: { yRow: 6, frames: 6, fps: 13, loop: false, framesBySubRow: [6, 6, 6] },
      attack2: { yRow: 6, frames: 6, fps: 14, loop: false, framesBySubRow: [6, 6, 6] },
      hurt: { yRow: 9, frames: 4, fps: 12, loop: false, framesBySubRow: [4, 4, 4] },
      death: { yRow: 12, frames: 4, fps: 9, loop: false, framesBySubRow: [4, 4, 4] },
    },
  },
  boss_custodian: {
    atlas: 'boss_maid.png', cellW: 96, cellH: 96, drawW: 96, drawH: 96, footOffsetY: 25, headOffsetY: 44, shadowRx: 10, shadowRy: 4, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 5, fps: 7, loop: true },
      walk: { yRow: 4, frames: 10, fps: 12, loop: true },
      run: { yRow: 8, frames: 10, fps: 15, loop: true },
      attack: { yRow: 12, frames: 8, fps: 14, loop: false },
      attack2: { yRow: 12, frames: 8, fps: 15, loop: false },
      hurt: { yRow: 16, frames: 4, fps: 12, loop: false },
      death: { yRow: 20, frames: 8, fps: 10, loop: false },
    },
  },
  boss_ronin: {
    atlas: 'boss_samurai.png', cellW: 96, cellH: 96, drawW: 96, drawH: 96, footOffsetY: 27, headOffsetY: 44, shadowRx: 10, shadowRy: 4, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 8, fps: 8, loop: true },
      walk: { yRow: 4, frames: 12, fps: 12, loop: true },
      run: { yRow: 4, frames: 12, fps: 15, loop: true },
      attack: { yRow: 8, frames: 12, fps: 15, loop: false },
      attack2: { yRow: 12, frames: 12, fps: 14, loop: false },
      hurt: { yRow: 16, frames: 4, fps: 12, loop: false },
      death: { yRow: 20, frames: 12, fps: 11, loop: false },
    },
  },
};

export interface ResolvedSpriteFrame {
  spec: CreatureAtlasSpec;
  clipName: AnimClipName;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  mirrorX: boolean;
  frameIndex: number;
  frameCount: number;
}

export function hasCreatureAtlas(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(CREATURE_ATLAS_SPECS, type);
}

/** Overhead UI anchor offset above `Y` (accounts for juvenile scale). */
export function creatureHeadTopY(m: Creature): number {
  const spec = CREATURE_ATLAS_SPECS[m.type];
  if (!spec) return 18;
  const scale = m.husbandry?.stage === 'juvenile' ? 0.75 : 1;
  return Math.round(spec.headOffsetY * scale);
}

/** Deterministically resolve which animation clip and source rect a creature displays right now. */
export function resolveCreatureSpriteFrame(m: Creature, simSec: number): ResolvedSpriteFrame | null {
  const spec = CREATURE_ATLAS_SPECS[m.type];
  if (!spec) return null;

  let desired: AnimClipName = 'idle';
  if (m.state === 'dead' || m.hp <= 0) {
    desired = 'death';
  } else if ((m.hurtUntil && simSec * 1000 < m.hurtUntil) || m.flash > 45) {
    desired = 'hurt';
  } else if (m.state === 'tell' || m.state === 'attack') {
    desired = m.animClip === 'attack2' && spec.clips.attack2 ? 'attack2' : 'attack';
  } else if (m.state === 'chase' || m.state === 'flee') {
    desired = spec.clips.run ? 'run' : 'walk';
  } else if (m.state === 'wander' || m.state === 'track' || m.husbandry?.following) {
    // Only play walk when moving toward a target; otherwise idle!
    const moving = Math.hypot((m.tx ?? m.x) - m.x, (m.ty ?? m.y) - m.y) > 2.0;
    desired = moving ? 'walk' : 'idle';
  } else {
    desired = 'idle';
  }

  const clipName: AnimClipName = spec.clips[desired]
    ? desired
    : desired === 'run' && spec.clips.walk
      ? 'walk'
      : desired === 'attack2' && spec.clips.attack
        ? 'attack'
        : 'idle';
  const clip = spec.clips[clipName]!;

  const dir: Dir = ((m.dir ?? 0) & 3) as Dir;
  let subRow = 0;
  let mirrorX = false;
  let frameCount = clip.frames;
  if (spec.layout === '3dir_mirror_left') {
    // 0=Down -> subRow 0; 1=Left -> subRow 1 (mirror); 2=Right -> subRow 1; 3=Up -> subRow 2
    if (dir === 0) subRow = 0;
    else if (dir === 1) { subRow = 1; mirrorX = true; }
    else if (dir === 2) subRow = 1;
    else subRow = 2;
    if (clip.framesBySubRow) frameCount = clip.framesBySubRow[subRow];
  } else {
    subRow = DIR_TO_4ROW[dir];
  }

  // Compute elapsed animation clock for non-looping vs looping clips
  let animElapsed = m.animTime ?? simSec;
  if (clipName === 'death') {
    const deadSec = m.deadAt !== undefined ? Math.max(0, simSec - m.deadAt) : Math.max(0, m.t / 1000);
    animElapsed = deadSec;
  } else if (clipName === 'hurt') {
    animElapsed = Math.max(0, (240 - Math.min(240, Math.max(0, m.flash))) / 1000);
  } else if (clipName === 'attack' || clipName === 'attack2') {
    // Progress smoothly across tell -> attack window
    animElapsed = m.animTime ?? (m.t / 1000);
  }

  const rawIdx = Math.floor(Math.max(0, animElapsed) * clip.fps);
  const frameIndex = clip.loop ? (rawIdx % frameCount) : Math.min(frameCount - 1, rawIdx);

  return {
    spec,
    clipName,
    sx: frameIndex * spec.cellW,
    sy: (clip.yRow + subRow) * spec.cellH,
    sw: spec.cellW,
    sh: spec.cellH,
    mirrorX,
    frameIndex,
    frameCount,
  };
}

const imageCache = new Map<string, HTMLImageElement | null>();
let flashScratch: HTMLCanvasElement | null = null;

function getAtlasImage(atlasFile: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (imageCache.has(atlasFile)) return imageCache.get(atlasFile)!;
  const img = new Image();
  img.decoding = 'async';
  img.src = `${import.meta.env.BASE_URL || '/'}sprites/creatures/${atlasFile}`;
  imageCache.set(atlasFile, img);
  return img;
}

/** Prewarm creature & boss sprite atlases in browser environments. */
export function preloadCreatureAtlases(): void {
  if (typeof Image === 'undefined') return;
  for (const spec of Object.values(CREATURE_ATLAS_SPECS)) {
    getAtlasImage(spec.atlas);
  }
}

/** Pixel-snapped stepped contact shadow centered at `(cx, cy)` so silhouettes sit firmly on the tile grid. */
function drawPixelContactShadow(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, alpha: number) {
  const X = Math.round(cx), Y = Math.round(cy);
  const rxi = Math.max(3, Math.round(rx));
  const ryi = Math.max(1, Math.round(ry * 0.65));
  g.fillStyle = `rgba(10,6,14,${alpha})`;
  for (let dy = -ryi; dy <= ryi; dy++) {
    const frac = Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ryi + 0.65) * (ryi + 0.65))));
    const hw = Math.max(2, Math.round(rxi * frac));
    g.fillRect(X - hw, Y + dy, hw * 2, 1);
  }
}

/** Draw an animated 4-directional creature/wildlife/side-boss sprite onto `g` at crisp 1:1 pixel scale.
 *  Returns `true` if drawn from its verified PNG atlas, `false` if still loading or non-atlas creature. */
export function drawCreatureAtlasSprite(
  g: CanvasRenderingContext2D,
  m: Creature,
  x: number,
  y: number,
  simSec: number,
): boolean {
  const rf = resolveCreatureSpriteFrame(m, simSec);
  if (!rf) return false;
  const img = getAtlasImage(rf.spec.atlas);
  if (!img || !img.complete || img.naturalWidth === 0) return false;

  const X = Math.round(x), Y = Math.round(y);
  // Adult wildlife/creatures/bosses render at exact 1:1 native pixel grid (scale = 1);
  // juveniles snap to clean 0.75x even-integer cell size (24×24 from 32×32) with nearest-neighbor.
  const isJuvenile = m.husbandry?.stage === 'juvenile';
  const scale = isJuvenile ? 0.75 : 1;
  const dw = Math.round(rf.spec.drawW * scale);
  const dh = Math.round(rf.spec.drawH * scale);
  // Lowest foot pixel row = (cellH - 1 - bottomPad) = cellH - footOffsetY + 4;
  // placing cell bottom at Y + 4 + (footOffsetY - 4) * scale keeps lowest foot pixel glued to Y + 4!
  const bottomPad = rf.spec.footOffsetY - 5;
  const footBottom = Y + 4 + Math.round((bottomPad + 1) * scale);
  const topY = footBottom - dh;
  const leftX = X - Math.floor(dw / 2);

  // Single crisp grounded contact shadow directly under the feet (Y + 4)
  if (m.state !== 'dead') {
    drawPixelContactShadow(g, X, Y + 4, rf.spec.shadowRx * scale, rf.spec.shadowRy * scale, m.sideBoss ? 0.44 : 0.34);
  }

  g.save();
  g.imageSmoothingEnabled = false;
  if (m.state === 'dead') {
    const age = m.deadAt !== undefined ? Math.max(0, simSec - m.deadAt) : m.t / 1000;
    if (age > 1.1) g.globalAlpha = Math.max(0.25, 1 - (age - 1.1) * 1.4);
  }
  if (rf.mirrorX) {
    g.translate(X, topY);
    g.scale(-1, 1);
    g.drawImage(img, rf.sx, rf.sy, rf.sw, rf.sh, -Math.ceil(dw / 2), 0, dw, dh);
  } else {
    g.drawImage(img, rf.sx, rf.sy, rf.sw, rf.sh, leftX, topY, dw, dh);
  }

  // Crisp pixel-silhouette hit flash (no blurry floating circle)
  if (m.flash > 0 && m.state !== 'dead' && typeof document !== 'undefined') {
    if (!flashScratch) flashScratch = document.createElement('canvas');
    if (flashScratch.width < dw || flashScratch.height < dh) {
      flashScratch.width = Math.max(flashScratch.width, dw);
      flashScratch.height = Math.max(flashScratch.height, dh);
    }
    const fg = flashScratch.getContext('2d');
    if (fg) {
      fg.imageSmoothingEnabled = false;
      fg.clearRect(0, 0, dw, dh);
      fg.globalCompositeOperation = 'source-over';
      if (rf.mirrorX) {
        fg.save();
        fg.translate(dw, 0);
        fg.scale(-1, 1);
        fg.drawImage(img, rf.sx, rf.sy, rf.sw, rf.sh, 0, 0, dw, dh);
        fg.restore();
      } else {
        fg.drawImage(img, rf.sx, rf.sy, rf.sw, rf.sh, 0, 0, dw, dh);
      }
      fg.globalCompositeOperation = 'source-in';
      fg.fillStyle = '#fff4e8';
      fg.fillRect(0, 0, dw, dh);
    }
  }
  g.restore();

  if (m.flash > 0 && m.state !== 'dead' && flashScratch) {
    g.save();
    g.imageSmoothingEnabled = false;
    g.globalAlpha = Math.min(0.65, m.flash / 220);
    g.drawImage(flashScratch, 0, 0, dw, dh, rf.mirrorX ? X - Math.floor(dw / 2) : leftX, topY, dw, dh);
    g.restore();
  }
  return true;
}
