/**
 * VEYRA05 ARCHITECTURAL BUILDING PAINTER (2.5D Top-Down Pixel Art).
 *
 * Enhances SOH `w.buildings` rendering with genuine pitched/hipped roof slopes,
 * ridge caps, gable bargeboards, eaves shadows, masonry chimneys, industrial
 * smokestacks, laboratory skylights, lighthouse lantern rooms, and south-wall
 * casement windows (warmly lit at dusk/night) — while 100% preserving
 * `room.cells.has(...) ? 0.12 : 1` roof fade when the player enters a room!
 *
 * Pure rendering only: never mutates GameState, collision, or building bounds.
 */
import { TILE, WW, hash2 } from '../game/core';
import type { Building } from '../game/world';
import type { ArtSet } from '../game/art';

export interface BuildingPaintContext {
  g: CanvasRenderingContext2D;
  b: Building;
  art: ArtSet;
  roomCells: Set<number>;
  darknessAlpha: number;
  stoneZone: Uint8Array;
  doorSet: Set<number>;
}

const RIDGE_COLORS: Record<string, { main: string; hi: string; sh: string; trim: string }> = {
  thatch: { main: '#8a6828', hi: '#d8b464', sh: '#5a4018', trim: '#6a4a24' },
  tile:   { main: '#863422', hi: '#e08a68', sh: '#4c1a12', trim: '#5e241a' },
  tin:    { main: '#545c64', hi: '#a4aeb6', sh: '#32383e', trim: '#3e444c' },
  wood:   { main: '#54361e', hi: '#9c6c42', sh: '#2e1c0e', trim: '#3e2614' },
  hull:   { main: '#3c2618', hi: '#7a543a', sh: '#20120a', trim: '#2c1a10' },
  light:  { main: '#a82e22', hi: '#f4f4f4', sh: '#5c1812', trim: '#3a3a44' },
};

/** Draw one architectural building roof + facade details at native 1x pixel scale. */
export function drawArchitecturalBuilding(ctx: BuildingPaintContext) {
  const { g, b, art, roomCells, darknessAlpha, stoneZone, doorSet } = ctx;
  const spr = art.st['roof_' + b.roof] || art.st.roof_wood;
  const x0 = b.x * TILE;
  const y0 = b.y * TILE - 10;
  const wPx = b.w * TILE;
  const hPx = b.h * TILE;

  // Check if player is inside this building's roofed room
  let inside = false;
  for (let y = 0; y < b.h && !inside; y++) {
    for (let x = 0; x < b.w; x++) {
      if (roomCells.has((b.y + y) * WW + b.x + x)) { inside = true; break; }
    }
  }

  const baseAlpha = inside ? 0.12 : 1.0;
  const pal = RIDGE_COLORS[b.roof] || RIDGE_COLORS.wood;
  const isStone = stoneZone[b.y * WW + b.x] === 7;
  const idLower = (b.id + ' ' + b.name).toLowerCase();
  const isIndustrial = b.roof === 'tin' && /mine|smelter|kiln|foundry|factory|plant|power|warehouse|filter|sawmill|mill|iron|slag|harbor|port/.test(idLower);
  const isLab = /academy|meridian|archive|observatory|research|lab|hall/.test(idLower);
  const isLighthouse = b.roof === 'light';

  g.save();

  // 1. South wall facade details (windows & corner quoins) drawn BEFORE roof overhang so eaves shade them naturally
  const southWallY = b.y + b.h - 1;
  const wallFaceY = southWallY * TILE + 6; // visible south wall face below roof bottom (y0 + hPx = southWallY*16 + 6)
  if (!inside) {
    // Corner stone quoins on stone buildings
    if (isStone) {
      g.fillStyle = '#b4b4be';
      for (let qy = 0; qy < 10; qy += 3) {
        g.fillRect(x0 + 1, wallFaceY + qy, 3, 2);
        g.fillRect(x0 + wPx - 4, wallFaceY + qy, 3, 2);
      }
    }

    // Framed casement windows along the south facade (skip door tiles & outer corners)
    const lit = darknessAlpha > 0.22;
    for (let tx = b.x + 1; tx < b.x + b.w - 1; tx++) {
      if (doorSet.has(southWallY * WW + tx)) {
        // Entrance porch lintel / lantern over the doorway
        const dx = tx * TILE;
        g.fillStyle = isStone ? '#8a8a94' : '#6a4426';
        g.fillRect(dx + 1, wallFaceY - 2, 14, 3);
        g.fillStyle = '#ffe082';
        g.fillRect(dx + 7, wallFaceY + 1, 2, 2);
        continue;
      }
      // Place windows rhythmically (every 2nd tile on wide walls, or centered on narrow walls)
      const relX = tx - b.x;
      if (b.w >= 7 && relX % 2 === 0 && relX < b.w - 1) continue;
      const wx = tx * TILE + 4;
      const wy = wallFaceY + 2;
      // Outer stone/timber frame
      g.fillStyle = isStone ? '#52525c' : '#3a2212';
      g.fillRect(wx, wy, 8, 7);
      // Window sill
      g.fillStyle = isStone ? '#b8b8c2' : '#9a6a3e';
      g.fillRect(wx - 1, wy + 7, 10, 1);
      // Glass panes (warm lantern glow at dusk/night, sky reflection by day)
      g.fillStyle = lit ? '#ffcf6e' : '#6da4c8';
      g.fillRect(wx + 1, wy + 1, 6, 5);
      if (lit) {
        g.fillStyle = '#fff4b8';
        g.fillRect(wx + 2, wy + 2, 2, 2);
      }
      // Cross-mullions
      g.fillStyle = isStone ? '#42424c' : '#2c180c';
      g.fillRect(wx + 3, wy + 1, 2, 5);
      g.fillRect(wx + 1, wy + 3, 6, 1);
    }
  }

  // 2. Base roof tiles
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      g.globalAlpha = roomCells.has((b.y + y) * WW + b.x + x) ? 0.12 : 1;
      g.drawImage(spr, (b.x + x) * TILE, (b.y + y) * TILE - 10);
    }
  }

  g.globalAlpha = baseAlpha;

  // 3. Pitched Roof Slope Shading (sunlit north pitch, shaded south pitch)
  const ridgeY = y0 + Math.floor(hPx * 0.45);
  g.fillStyle = 'rgba(255, 246, 220, 0.10)';
  g.fillRect(x0 + 2, y0 + 2, wPx - 4, Math.max(2, ridgeY - y0 - 2));
  g.fillStyle = 'rgba(12, 8, 18, 0.16)';
  g.fillRect(x0 + 2, ridgeY + 2, wPx - 4, Math.max(2, y0 + hPx - ridgeY - 4));

  // 4. Gable Bargeboards (left/right edges) & Top Eave Trim
  g.fillStyle = pal.trim;
  g.fillRect(x0, y0, 2, hPx);
  g.fillRect(x0 + wPx - 2, y0, 2, hPx);
  g.fillRect(x0, y0, wPx, 2);
  g.fillStyle = pal.hi;
  g.fillRect(x0 + 2, y0 + 1, wPx - 4, 1);

  // 5. Horizontal Roof Ridge Beam / Crest
  g.fillStyle = pal.sh;
  g.fillRect(x0 + 1, ridgeY - 1, wPx - 2, 4);
  g.fillStyle = pal.main;
  g.fillRect(x0 + 1, ridgeY, wPx - 2, 2);
  g.fillStyle = pal.hi;
  g.fillRect(x0 + 2, ridgeY, wPx - 4, 1);
  if (b.roof === 'thatch') {
    g.fillStyle = pal.sh;
    for (let rx = x0 + 5; rx < x0 + wPx - 4; rx += 6) g.fillRect(rx, ridgeY - 1, 1, 4);
  } else if (b.roof === 'tin') {
    g.fillStyle = '#dce4ec';
    for (let rx = x0 + 4; rx < x0 + wPx - 4; rx += 8) g.fillRect(rx, ridgeY, 1, 1);
  }

  // 6. Front Eaves Fascia & Cast Drop Shadow on South Wall
  g.fillStyle = pal.trim;
  g.fillRect(x0, y0 + hPx - 3, wPx, 3);
  g.fillStyle = pal.hi;
  g.fillRect(x0 + 1, y0 + hPx - 3, wPx - 2, 1);
  g.fillStyle = 'rgba(10, 6, 14, 0.42)';
  g.fillRect(x0, y0 + hPx, wPx, 3);

  // 7. Architectural Roof Features (Chimneys, Smokestacks, Lab Skylights, Lighthouse Lantern)
  const h = hash2(b.x, b.y, b.w * 31 + b.h);
  if (isLighthouse) {
    // Glazed octagonal lighthouse lantern room at crown
    const lx = x0 + Math.floor(wPx / 2) - 10;
    const ly = y0 + Math.floor(hPx / 2) - 10;
    g.fillStyle = '#24242c';
    g.fillRect(lx - 1, ly - 1, 22, 20);
    g.fillStyle = '#ffe27a';
    g.fillRect(lx + 2, ly + 3, 16, 12);
    g.fillStyle = '#ffffff';
    g.fillRect(lx + 6, ly + 6, 8, 6);
    g.fillStyle = '#c03a2a';
    g.fillRect(lx, ly, 20, 3);
    g.fillStyle = '#ffd040';
    g.fillRect(lx + 8, ly - 3, 4, 3);
  } else if (isIndustrial) {
    // Riveted iron smokestack + roof vent monitor
    const sx = x0 + (h > 0.5 ? wPx - 22 : 14);
    const sy = y0 + 6;
    g.fillStyle = '#22262c';
    g.fillRect(sx, sy, 8, 15);
    g.fillStyle = '#4c545e';
    g.fillRect(sx + 1, sy + 1, 6, 13);
    g.fillStyle = '#7c8692';
    g.fillRect(sx + 2, sy + 2, 2, 11);
    g.fillStyle = '#14161a';
    g.fillRect(sx + 1, sy, 6, 2);
    // Clerestory roof vent monitor
    if (b.w >= 9) {
      const vx = x0 + Math.floor(wPx / 2) - 12;
      g.fillStyle = '#383e46';
      g.fillRect(vx, ridgeY - 4, 24, 7);
      g.fillStyle = '#8c96a0';
      g.fillRect(vx + 1, ridgeY - 3, 22, 2);
    }
  } else if (isLab && b.w >= 8) {
    // Glazed conservatory / observatory skylight cupola + stone chimney
    const kx = x0 + Math.floor(wPx / 2) - 11;
    const ky = ridgeY - 5;
    g.fillStyle = '#3a424c';
    g.fillRect(kx, ky, 22, 9);
    g.fillStyle = darknessAlpha > 0.22 ? '#ffcf6e' : '#8ad0f0';
    g.fillRect(kx + 2, ky + 2, 18, 5);
    g.fillStyle = '#5a6470';
    g.fillRect(kx + 7, ky + 2, 1, 5);
    g.fillRect(kx + 14, ky + 2, 1, 5);
    // Stone chimney on wing end
    const cx = x0 + (h > 0.5 ? 12 : wPx - 20);
    g.fillStyle = '#5a5a64';
    g.fillRect(cx, y0 + 6, 8, 12);
    g.fillStyle = '#9a9aa4';
    g.fillRect(cx + 1, y0 + 7, 6, 9);
    g.fillStyle = '#2e2e36';
    g.fillRect(cx + 2, y0 + 6, 4, 2);
  } else if (b.w >= 6) {
    // Residential / village masonry hearth chimney
    const cx = x0 + (h > 0.5 ? wPx - 20 : 12);
    const cy = y0 + 6;
    g.fillStyle = '#3c2c28';
    g.fillRect(cx, cy, 8, 12);
    g.fillStyle = '#8e5446';
    g.fillRect(cx + 1, cy + 2, 6, 9);
    g.fillStyle = '#b47462';
    g.fillRect(cx + 2, cy + 3, 2, 7);
    g.fillStyle = '#241816';
    g.fillRect(cx + 1, cy, 6, 2);
  }

  g.restore();
}
