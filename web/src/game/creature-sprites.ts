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
  /** Draw scale on the 640×360 pixel-art stage (16px = 1 tile). */
  drawW: number;
  drawH: number;
  /** Vertical foot-anchor offset from sprite center to ground contact (px in screen/world space). */
  footOffsetY: number;
  shadowRx: number;
  shadowRy: number;
  layout: '4dir' | '3dir_mirror_left';
  clips: Partial<Record<AnimClipName, ClipSpec>>;
}

/** Engine Dir: 0 = DOWN (+Y), 1 = LEFT (-X), 2 = RIGHT (+X), 3 = UP (-Y).
 *  Canonical 4dir atlas rows: 0 = DOWN, 1 = UP, 2 = LEFT, 3 = RIGHT. */
export const DIR_TO_4ROW: readonly [number, number, number, number] = [0, 2, 3, 1];

export const CREATURE_ATLAS_SPECS: Record<string, CreatureAtlasSpec> = {
  // ---- 9 Ordinary Creatures ----
  vampire_1: {
    atlas: 'vampire_1.png', cellW: 64, cellH: 64, drawW: 40, drawH: 40, footOffsetY: 5, shadowRx: 7, shadowRy: 3, layout: '4dir',
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
    atlas: 'vampire_2.png', cellW: 64, cellH: 64, drawW: 42, drawH: 42, footOffsetY: 5, shadowRx: 8, shadowRy: 3, layout: '4dir',
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
    atlas: 'vampire_3.png', cellW: 64, cellH: 64, drawW: 46, drawH: 46, footOffsetY: 6, shadowRx: 9, shadowRy: 4, layout: '4dir',
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
    atlas: 'orc_1.png', cellW: 64, cellH: 64, drawW: 40, drawH: 40, footOffsetY: 5, shadowRx: 8, shadowRy: 3, layout: '4dir',
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
    atlas: 'orc_2.png', cellW: 64, cellH: 64, drawW: 44, drawH: 44, footOffsetY: 6, shadowRx: 8, shadowRy: 3.5, layout: '4dir',
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
    atlas: 'orc_3.png', cellW: 64, cellH: 64, drawW: 48, drawH: 48, footOffsetY: 6, shadowRx: 9, shadowRy: 4, layout: '4dir',
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
    atlas: 'slime_1.png', cellW: 64, cellH: 64, drawW: 36, drawH: 36, footOffsetY: 3, shadowRx: 7, shadowRy: 3, layout: '4dir',
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
    atlas: 'slime_2.png', cellW: 64, cellH: 64, drawW: 40, drawH: 40, footOffsetY: 3, shadowRx: 8, shadowRy: 3.5, layout: '4dir',
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
    atlas: 'slime_3.png', cellW: 64, cellH: 64, drawW: 42, drawH: 42, footOffsetY: 4, shadowRx: 8, shadowRy: 3.5, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 6, fps: 8, loop: true },
      walk: { yRow: 4, frames: 8, fps: 10, loop: true },
      run: { yRow: 8, frames: 8, fps: 13, loop: true },
      attack: { yRow: 12, frames: 9, fps: 14, loop: false },
      hurt: { yRow: 16, frames: 5, fps: 12, loop: false },
      death: { yRow: 20, frames: 10, fps: 12, loop: false },
    },
  },

  // ---- 5 Living Wildlife Species ----
  boar: {
    atlas: 'wildlife_boar.png', cellW: 32, cellH: 32, drawW: 24, drawH: 24, footOffsetY: 3, shadowRx: 7, shadowRy: 3, layout: '4dir',
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
    atlas: 'wildlife_deer.png', cellW: 32, cellH: 32, drawW: 26, drawH: 26, footOffsetY: 4, shadowRx: 7, shadowRy: 3, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 6, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 6, fps: 14, loop: true },
      hurt: { yRow: 12, frames: 4, fps: 12, loop: false },
      death: { yRow: 16, frames: 7, fps: 10, loop: false },
    },
  },
  hare: {
    atlas: 'wildlife_hare.png', cellW: 32, cellH: 32, drawW: 18, drawH: 18, footOffsetY: 2, shadowRx: 4.5, shadowRy: 2, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 7, loop: true },
      walk: { yRow: 4, frames: 5, fps: 10, loop: true },
      run: { yRow: 8, frames: 6, fps: 15, loop: true },
      hurt: { yRow: 12, frames: 4, fps: 12, loop: false },
      death: { yRow: 16, frames: 6, fps: 10, loop: false },
    },
  },
  grouse: {
    atlas: 'wildlife_grouse.png', cellW: 32, cellH: 32, drawW: 20, drawH: 20, footOffsetY: 2, shadowRx: 5, shadowRy: 2.2, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 6, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 6, fps: 14, loop: true },
      hurt: { yRow: 12, frames: 4, fps: 12, loop: false },
      death: { yRow: 16, frames: 6, fps: 10, loop: false },
    },
  },
  fox: {
    atlas: 'wildlife_fox.png', cellW: 32, cellH: 32, drawW: 22, drawH: 22, footOffsetY: 2, shadowRx: 6, shadowRy: 2.5, layout: '4dir',
    clips: {
      idle: { yRow: 0, frames: 4, fps: 7, loop: true },
      walk: { yRow: 4, frames: 6, fps: 10, loop: true },
      run: { yRow: 8, frames: 6, fps: 14, loop: true },
      attack: { yRow: 12, frames: 6, fps: 15, loop: false },
      hurt: { yRow: 16, frames: 4, fps: 12, loop: false },
      death: { yRow: 20, frames: 6, fps: 10, loop: false },
    },
  },

  // ---- 4 Optional Side Bosses ----
  boss_greyback: {
    atlas: 'boss_rock.png', cellW: 64, cellH: 64, drawW: 60, drawH: 60, footOffsetY: 8, shadowRx: 14, shadowRy: 6, layout: '4dir',
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
    atlas: 'boss_water.png', cellW: 48, cellH: 48, drawW: 52, drawH: 52, footOffsetY: 8, shadowRx: 11, shadowRy: 5, layout: '3dir_mirror_left',
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
    atlas: 'boss_maid.png', cellW: 96, cellH: 96, drawW: 62, drawH: 62, footOffsetY: 8, shadowRx: 10, shadowRy: 4.5, layout: '4dir',
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
    atlas: 'boss_samurai.png', cellW: 96, cellH: 96, drawW: 72, drawH: 72, footOffsetY: 10, shadowRx: 12, shadowRy: 5, layout: '4dir',
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

/** Draw an animated 4-directional creature/wildlife/side-boss sprite onto `g`.
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

  const isJuvenile = m.husbandry?.stage === 'juvenile';
  const scale = isJuvenile ? 0.68 : 1;
  const dw = Math.round(rf.spec.drawW * scale);
  const dh = Math.round(rf.spec.drawH * scale);
  const footY = Math.round(rf.spec.footOffsetY * scale);

  // Ground contact shadow
  if (m.state !== 'dead') {
    g.fillStyle = m.sideBoss ? 'rgba(0,0,0,0.46)' : 'rgba(0,0,0,0.34)';
    g.beginPath();
    g.ellipse(x, y + 4, rf.spec.shadowRx * scale, rf.spec.shadowRy * scale, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.save();
  g.imageSmoothingEnabled = false;
  if (m.state === 'dead') {
    const age = m.deadAt !== undefined ? Math.max(0, simSec - m.deadAt) : m.t / 1000;
    if (age > 1.1) g.globalAlpha = Math.max(0.25, 1 - (age - 1.1) * 1.4);
  }
  if (rf.mirrorX) {
    g.translate(x, y + footY - dh / 2);
    g.scale(-1, 1);
    g.drawImage(img, rf.sx, rf.sy, rf.sw, rf.sh, -Math.floor(dw / 2), -Math.floor(dh / 2), dw, dh);
  } else {
    g.drawImage(
      img,
      rf.sx,
      rf.sy,
      rf.sw,
      rf.sh,
      Math.round(x - dw / 2),
      Math.round(y + footY - dh),
      dw,
      dh,
    );
  }

  // Crisp hit-flash silhouette overlay without losing sprite silhouette
  if (m.flash > 0 && m.state !== 'dead') {
    g.globalAlpha = Math.min(0.42, m.flash / 360);
    g.fillStyle = '#fff4e8';
    g.beginPath();
    g.arc(x, y - dh * 0.28, Math.max(6, dw * 0.22), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // Tamed indicator collar / heart pip for husbandry clarity
  if (m.husbandry?.tamed && m.state !== 'dead') {
    g.fillStyle = m.husbandry.following ? '#ffe27a' : '#8ef0a0';
    g.fillRect(x - 2, Math.round(y + footY - dh * 0.78), 4, 2);
  }
  return true;
}
