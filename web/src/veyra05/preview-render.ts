/**
 * REPRESENTATIVE ACTUAL-GAME VISUAL PREVIEW (TASK 2.10).
 * Renders a genuine 1x native SOH pixel-art viewport (320x180 = 20x11.25 tiles at
 * TILE=16px) around any global (tx, ty) on the 4000x2800 frame using the live
 * SOH art.ts sprites, decorKit sprites, and drawArchitecturalBuilding() — never
 * flat palette squares or reskinned boxes.
 */
import { T, TILE, WW, WH, hash2 } from '../game/core';
import { getArt } from '../game/art';
import { SOURCES } from '../game/catalog';
import { FRAME_W, FRAME_H, CHUNK, windowAround } from './frame';
import { getChunk } from './chunks';
import { decorKit } from './art-nature';
import { slicePoisForWindow } from './poi-kit';
import { drawArchitecturalBuilding } from './building-art';

const BASE_COL: Record<number, string> = {
  [T.DEEP]: '#1e3c6a', [T.SHALLOW]: '#2e6ea0', [T.RIVER]: '#3478a8',
  [T.SAND]: '#dcc68e', [T.GRASS]: '#4f8a3a', [T.MEADOW]: '#7aa84a',
  [T.FOREST]: '#3a6e30', [T.MARSH]: '#4a6a3e', [T.HILL]: '#8a7a62',
  [T.CLIFF]: '#6e6a66', [T.SNOW]: '#e6eef6', [T.ASH]: '#4a4044',
  [T.TOXIC]: '#6a7038', [T.ROAD]: '#a08060', [T.BRIDGE]: '#8a6038',
  [T.FLOOR]: '#9a6a3e', [T.PWALL]: '#4a4048', [T.LAVA]: '#c83a1e',
  [T.BURNT]: '#2e2826', [T.ICE]: '#b8e0f0',
};

export function renderGamePreview(cv: HTMLCanvasElement, centerTx: number, centerTy: number) {
  const W = 320, H = 180; // 20 x 11.25 tiles at 1x native 16px scale
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#120c18';
  g.fillRect(0, 0, W, H);

  const art = getArt();
  const kit = decorKit();
  const win = windowAround(centerTx, centerTy);
  const slice = slicePoisForWindow(win);
  const doorCoordSet = new Set(slice.statics.filter(s => s.kind === 'door').map(s => `${s.tx},${s.ty}`));
  const doorIdxSet = new Set(slice.statics.filter(s => s.kind === 'door').map(s => s.ty * WW + s.tx));
  const stoneZone = new Uint8Array(WW * WH);
  for (const idx of slice.stoneCells) stoneZone[idx] = 7;

  const tilesW = Math.ceil(W / TILE) + 2;
  const tilesH = Math.ceil(H / TILE) + 2;
  const x0 = Math.max(0, Math.min(FRAME_W - tilesW, Math.round(centerTx - tilesW / 2)));
  const y0 = Math.max(0, Math.min(FRAME_H - tilesH, Math.round(centerTy - tilesH / 2)));

  const tileAt = (gx: number, gy: number): { t: number; stone: boolean; feat: number } => {
    if (gx < 0 || gy < 0 || gx >= FRAME_W || gy >= FRAME_H) return { t: T.DEEP, stone: false, feat: 0 };
    const cx = Math.floor(gx / CHUNK), cy = Math.floor(gy / CHUNK);
    const c = getChunk(cx, cy);
    const ci = (gy - cy * CHUNK) * CHUNK + (gx - cx * CHUNK);
    const lx = gx - win.originTx, ly = gy - win.originTy;
    const li = ly * win.w + lx;
    const ov = (lx >= 0 && ly >= 0 && lx < win.w && ly < win.h) ? slice.tileOverrides.get(li) : undefined;
    const stone = (lx >= 0 && ly >= 0 && lx < win.w && ly < win.h) && slice.stoneCells.has(li);
    return { t: ov !== undefined ? ov : c.tile[ci], stone, feat: c.feature[ci] };
  };

  // 1. Ground & 3D walls / floors
  for (let dy = 0; dy < tilesH; dy++) {
    for (let dx = 0; dx < tilesW; dx++) {
      const gx = x0 + dx, gy = y0 + dy;
      const px = dx * TILE, py = dy * TILE;
      const { t, stone } = tileAt(gx, gy);
      const south = tileAt(gx, gy + 1).t;
      const lx = gx - win.originTx, ly = gy - win.originTy;
      const isDoor = doorCoordSet.has(`${lx},${ly}`);

      if (t === T.FLOOR || isDoor) {
        g.drawImage(stone ? art.st.floor_stone : art.st.floor_wood, px, py);
      } else if (t === T.BRIDGE) {
        g.fillStyle = '#8a6038';
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle = '#4a2e1a';
        for (let bx = 3; bx < 16; bx += 4) g.fillRect(px + bx, py, 1, TILE);
      } else if (t === T.PWALL) {
        g.fillStyle = stone ? '#4a5058' : '#4a4048';
        g.fillRect(px, py, TILE, TILE);
        if (south !== T.PWALL && south !== T.CLIFF) {
          g.fillStyle = stone ? '#6a7280' : '#7a5a4a';
          g.fillRect(px, py + 6, TILE, 10);
          g.fillStyle = '#2e2830';
          g.fillRect(px, py + 5, TILE, 1);
        }
      } else if (t === T.CLIFF) {
        g.fillStyle = '#6e6a66';
        g.fillRect(px, py, TILE, TILE);
        if (south !== T.CLIFF && south !== T.PWALL) {
          g.fillStyle = '#4e4a48';
          g.fillRect(px, py + 7, TILE, 9);
        }
      } else {
        g.fillStyle = BASE_COL[t] || '#4f8a3a';
        g.fillRect(px, py, TILE, TILE);
        const h = hash2(gx, gy, t + 5);
        if (t === T.ROAD) {
          g.fillStyle = '#7a5e40';
          if (tileAt(gx, gy - 1).t !== T.ROAD) g.fillRect(px, py, TILE, 1);
          if (south !== T.ROAD) g.fillRect(px, py + 15, TILE, 1);
        } else if (h > 0.72) {
          g.fillStyle = 'rgba(255,255,255,0.08)';
          g.fillRect(px + ((h * 11) | 0), py + ((h * 7) | 0), 2, 2);
        }
      }

      if (isDoor) {
        g.drawImage(art.st.poi_door, px, py - 8);
      }
    }
  }

  // 1b. POI architectural landmark props (well, lanterns, sundial, forge, ore_cart, bench, bollard)
  for (const lm of slice.landmarks) {
    const gx = win.originTx + lm.tx, gy = win.originTy + lm.ty;
    const dx = gx - x0, dy = gy - y0;
    if (dx < 0 || dy < 0 || dx >= tilesW || dy >= tilesH) continue;
    const px = dx * TILE, py = dy * TILE;
    if (lm.kind === 'well') {
      g.fillStyle = '#5a5a64'; g.fillRect(px + 1, py + 5, 14, 9);
      g.fillStyle = '#24486e'; g.fillRect(px + 4, py + 7, 8, 3);
      g.fillStyle = '#9a6a3e'; g.fillRect(px, py, 16, 3);
    } else if (lm.kind === 'lantern') {
      g.fillStyle = '#3a3e46'; g.fillRect(px + 7, py + 5, 2, 10);
      g.fillStyle = '#ffe27a'; g.fillRect(px + 6, py + 2, 4, 3);
    } else if (lm.kind === 'sundial') {
      g.fillStyle = '#8a8a94'; g.fillRect(px + 3, py + 7, 10, 7);
      g.fillStyle = '#d4aa48'; g.fillRect(px + 4, py + 4, 8, 3);
    } else if (lm.kind === 'ore_cart') {
      g.fillStyle = '#4a4e56'; g.fillRect(px + 2, py + 5, 12, 7);
      g.fillStyle = '#b87a4a'; g.fillRect(px + 4, py + 3, 8, 3);
    } else if (lm.kind === 'forge') {
      g.fillStyle = '#4a4e56'; g.fillRect(px + 2, py + 6, 12, 8);
      g.fillStyle = '#ff7a2a'; g.fillRect(px + 10, py + 8, 3, 3);
    }
  }

  // 2. Decor & representative trees/sources outside POI buildings
  for (let dy = 0; dy < tilesH; dy++) {
    for (let dx = 0; dx < tilesW; dx++) {
      const gx = x0 + dx, gy = y0 + dy;
      const px = dx * TILE, py = dy * TILE;
      const { t, feat } = tileAt(gx, gy);
      if (t === T.FLOOR || t === T.PWALL || t === T.ROAD || t === T.DEEP || t === T.SHALLOW || t === T.BRIDGE) continue;
      if (feat) {
        const a = kit.get(feat);
        if (a) {
          const v = a.variants[0];
          g.drawImage(v, px + a.anchor[0], py + a.anchor[1] + (TILE - a.h));
          continue;
        }
      }
      const h = hash2(gx, gy, 0x331);
      if (t === T.FOREST && h < 0.22) {
        const spr = art.src.oak[0];
        g.drawImage(spr, px + 8 - spr.width / 2, py + 16 - spr.height);
      } else if (t === T.HILL && h < 0.12) {
        const spr = art.src.rock[0];
        g.drawImage(spr, px + 8 - spr.width / 2, py + 16 - spr.height);
      }
    }
  }

  // 3. Architectural roofs & facades translated into preview viewport coordinates
  const emptyRoom = new Set<number>();
  for (const b of slice.buildings) {
    const localB = {
      ...b,
      x: win.originTx + b.x - x0,
      y: win.originTy + b.y - y0,
    };
    if (localB.x + localB.w < -1 || localB.x > tilesW + 1 || localB.y + localB.h < -1 || localB.y > tilesH + 1) continue;
    // Remap stoneZone & doorIdxSet into local preview grid so facade windows & quoins render identically
    const pStone = new Uint8Array(WW * WH);
    const pDoors = new Set<number>();
    for (let ry = 0; ry < b.h; ry++) {
      for (let rx = 0; rx < b.w; rx++) {
        const wx = b.x + rx, wy = b.y + ry;
        const px = localB.x + rx, py = localB.y + ry;
        if (px < 0 || py < 0 || px >= WW || py >= WH) continue;
        if (stoneZone[wy * WW + wx] === 7) pStone[py * WW + px] = 7;
        if (doorIdxSet.has(wy * WW + wx)) pDoors.add(py * WW + px);
      }
    }
    drawArchitecturalBuilding({
      g,
      b: localB,
      art,
      roomCells: emptyRoom,
      darknessAlpha: 0.3,
      stoneZone: pStone,
      doorSet: pDoors,
    });
  }

  // 4. Center reticle showing the exact focus tile
  const cx = (centerTx - x0) * TILE + 8;
  const cy = (centerTy - y0) * TILE + 8;
  g.strokeStyle = 'rgba(255, 226, 122, 0.85)';
  g.lineWidth = 1;
  g.strokeRect(cx - 8.5, cy - 8.5, 17, 17);
  void SOURCES;
}
