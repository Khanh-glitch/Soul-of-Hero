import { C } from './engine';
import { ITEMS } from './catalog';
import type { RunState } from './core';
import { getArt } from './art';

/** One palette/gear composition used by walking, mounted and inspection views. */
export type AvatarPose = 'idle' | 'ride' | 'vault';

export function drawAdventurer(g: CanvasRenderingContext2D, r: RunState, x: number, y: number, dir: number, pose: AvatarPose, frame: number) {
  const set = getArt().hero[r.character];
  const sprites = set[`${pose}${dir}`];
  const spr = sprites[Math.abs(frame) % sprites.length];
  const px = Math.round(x), py = Math.round(y);
  g.drawImage(spr, px - 8, py - 19);
  drawAdventurerEquipment(g, r, px, py, dir);
}

/** Equipment colors and silhouette come from real equipped Stack definitions. */
export function drawAdventurerEquipment(g: CanvasRenderingContext2D, r: RunState, x: number, y: number, dir: number) {
  const eq = C(r, 'eq')?.slots; if (!eq) return;
  const head = eq[0] && ITEMS[eq[0].key];
  const body = eq[1] && ITEMS[eq[1].key];
  const back = eq[2] && ITEMS[eq[2].key];
  const point = (dx: number, dy: number, color: string) => { g.fillStyle = color; g.fillRect(x + dx, y + dy, 1, 1); };
  const box = (dx: number, dy: number, w: number, h: number, color: string) => { g.fillStyle = color; g.fillRect(x + dx, y + dy, w, h); };

  if (back) {
    const side = dir === 1 || dir === 2;
    const at = side ? (dir === 2 ? -7 : 5) : dir === 3 ? 3 : 6;
    if (back.carryBonus) {
      box(at, -12, 3, 7, back.c1);
      box(at + 1, -12, 2, 1, back.c2); point(at + 1, -7, '#d8b86c');
    } else {
      box(at, -10, 2, 7, back.c1); box(at + 2, -9, 1, 5, back.c2);
    }
  }
  if (body?.armor) {
    box(-3, -11, 6, 5, body.c1);
    box(-2, -11, 4, 1, body.c2);
    point(-3, -7, body.c2); point(2, -7, body.c2);
  }
  if (head?.mask) {
    if (dir !== 3) {
      box(-3, -16, 6, 3, head.c1); box(-2, -16, 4, 1, head.c2);
      point(-1, -14, '#111820'); point(1, -14, '#111820');
    } else { box(-3, -18, 6, 1, head.c1); point(0, -18, head.c2); }
  } else if (head?.slot === 'head') {
    box(-4, -19, 8, 3, head.c1); box(-3, -19, 6, 1, head.c2);
    point(-4, -17, '#171c21'); point(3, -17, '#171c21');
  }
}