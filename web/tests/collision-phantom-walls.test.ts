// Nothing may stop the player where the screen shows open ground.
//
// The fault this pins: every Veyra place is hand-authored, but the economy masks of a window (`walkable`, `cargoPassable`,
// `slope`) were still compiled against the generic kit layout of the place. The kit building is never drawn; its wall ring
// stayed in the masks as a closed box of open-looking ground that feet, carts, wheels, creatures, arrows and sight all
// stopped at. The masks are part of `mapDigest`, so they cannot be edited without refusing every existing save: movement
// now trusts the tile on the ground floor (`veyraOpenGround`).
import { describe, it, expect } from 'vitest';
import { buildQaSandbox } from '../src/game/qa-sandbox';
import { T, TILE, WW, WH, type GameState, type RunState } from '../src/game/core';
import { setActiveLayout, getWorld } from '../src/game/world';
import { blockGrid, blockedAt, markDirty, veyraOpenGround, globalCellTileAndClass } from '../src/game/engine';
import { solidFor } from '../src/game/core-sites';
import { vehicleCell } from '../src/game/motorbike';
import { mapDigest } from '../src/game/map-package';
import { POIS } from '../src/veyra05/reader';
import { getWindowWorld } from '../src/veyra05/window';
import { shiftVeyraWindowBy, windowOrigin } from '../src/veyra05/continuity';
import { applyFloor, activeFloor } from '../src/veyra05/floors';
import { FRAME_W, FRAME_H } from '../src/veyra05/frame';

const NOW = 1_800_000_000_000;
let built: GameState | null = null;
/** One run, moved from window to window the way a long walk moves it. */
function runAt(ox: number, oy: number): { gs: GameState; r: RunState } {
  if (!built) built = buildQaSandbox('fresh', 'female', NOW).gs;
  const gs = built, r = gs.run!;
  setActiveLayout(r.layoutId!);
  if (activeFloor(r) !== 0) { const ww = getWindowWorld(r.layoutId!); applyFloor(gs, ww, ww.floors, 0, undefined, markDirty); }
  const [cx, cy] = windowOrigin(r);
  if (cx !== ox || cy !== oy) expect(shiftVeyraWindowBy(gs, ox - cx, oy - cy, markDirty)).toBe(true);
  expect(windowOrigin(r)).toEqual([ox, oy]);
  r.player.x = 100 * TILE + 8; r.player.y = 100 * TILE + 8;
  return { gs, r };
}
/** The window the game itself picks for a global tile (64-tile grid). */
const originFor = (gx: number, gy: number): [number, number] => [
  Math.max(0, Math.min(FRAME_W - WW, Math.floor((gx - 68) / 64) * 64)),
  Math.max(0, Math.min(FRAME_H - WH, Math.floor((gy - 68) / 64) * 64)),
];
const OPEN = (t: number) => t !== T.DEEP && t !== T.CLIFF && t !== T.PWALL && t !== T.LAVA && t !== T.SHALLOW && t !== T.RIVER;
const centre = (tx: number, ty: number): [number, number] => [tx * TILE + 8, ty * TILE + 8];

describe('no wall where the ground looks open', () => {
  it('every place on Veyra: a terrain wall only stands on a wall, a cliff or deep water', () => {
    const windows = new Map<string, string[]>();
    for (const p of POIS) { const [ox, oy] = originFor(Math.round(p.at[0] / 0.5), Math.round(p.at[1] / 0.5)); const k = `${ox},${oy}`; windows.set(k, [...(windows.get(k) ?? []), p.id]); }
    expect(POIS.length).toBe(81);
    const phantom: string[] = []; let maskedOpen = 0, walls = 0, wallsOpen = 0;
    for (const [key, ids] of windows) {
      const [ox, oy] = key.split(',').map(Number);
      const { r } = runAt(ox, oy); const w = getWorld(), grid = blockGrid(r);
      for (let i = 0; i < WW * WH; i++) {
        const t = w.tiles[i];
        if (OPEN(t)) {
          if (!w.economyMap.walkable[i]) maskedOpen++;                       // the mask still says no here (it is not edited)
          if (grid[i] === 1) phantom.push(`${ids[0]} window ${key} tile ${i % WW},${(i / WW) | 0}`);
        } else if (t === T.DEEP || t === T.CLIFF || t === T.PWALL) {
          walls++; if (grid[i] === 0 || grid[i] === 4) wallsOpen++;          // a real wall never opened (3 = a door stands there, 6 = a ladder)
        }
      }
    }
    expect(phantom.slice(0, 12)).toEqual([]);
    expect(phantom.length).toBe(0);
    // The check above bites: the masks really do carry the kit walls, in thousands of cells.
    expect(maskedOpen).toBeGreaterThan(2000);
    expect(walls).toBeGreaterThan(10000);
    expect(wallsOpen).toBe(0);
  }, 900_000);

  it('Meridian: the road north of the archive and the meadow box south of it let feet, carts and wheels through', () => {
    const { r } = runAt(2112, 1280); const w = getWorld();
    // (150,58) lies on the road, (148,106) on the top edge of a 13 by 10 kit box in open meadow, (142,110) on its west edge.
    for (const [tx, ty, tile] of [[150, 58, T.ROAD], [148, 106, T.MEADOW], [142, 110, T.MEADOW]] as const) {
      const i = ty * WW + tx, [x, y] = centre(tx, ty);
      expect(w.tiles[i], `tile ${tx},${ty}`).toBe(tile);
      expect(w.economyMap.walkable[i], `mask ${tx},${ty}`).toBe(0);
      expect(w.economyMap.cargoPassable[i]).toBe(0);
      expect(veyraOpenGround(r, i)).toBe(true);
      expect(blockedAt(r, tx, ty), `foot ${tx},${ty}`).toBe(false);
      expect(solidFor(r, x, y, 'player')).toBe(false);
      expect(solidFor(r, x, y, 'creature')).toBe(false);
      expect(solidFor(r, x, y, 'cart'), `cart ${tx},${ty}`).toBe(false);
      expect(vehicleCell(r, x, y, 'passable'), `wheels ${tx},${ty}`).toBe(true);
      expect(vehicleCell(r, x, y, 'exit')).toBe(true);
    }
    // The archive itself keeps its walls.
    const wall = w.tiles.findIndex(t => t === T.PWALL); expect(wall).toBeGreaterThan(0);
    expect(veyraOpenGround(r, wall)).toBe(false);
    expect(solidFor(r, ...centre(wall % WW, (wall / WW) | 0), 'player')).toBe(true);
  }, 300_000);

  it('the same cells are open when the place is off screen, so nobody who walked in is shut in once the window moves on', () => {
    const { r } = runAt(576, 1024);                                           // far from Meridian (window 2112,1280) and the Timberyard (1920,832)
    for (const [tx, ty] of [[150, 58], [148, 106], [142, 110]]) expect(globalCellTileAndClass(r, 2112 + tx, 1280 + ty, 0).cls, `meridian ${tx},${ty}`).toBe(0);
    // A real wall of the archive, read the same way, still stands.
    const there = getWindowWorld('veyra05-at-2112-1280').floors.ground; const wall = there.tiles.findIndex(t => t === T.PWALL && !there.statics.some(st => st.kind === 'door' && st.ty * WW + st.tx === there.tiles.indexOf(t)));
    expect(globalCellTileAndClass(r, 2112 + (wall % WW), 1280 + ((wall / WW) | 0), 0)).toEqual({ tile: T.PWALL, cls: 1 });
    // Upper storey of the gantry: every cell off the deck is a wall for the off-screen reader too, river included.
    const loft = getWindowWorld('veyra05-at-1920-832').floors.layers.get(1)!; let river = 0;
    for (let i = 0; i < WW * WH; i++) {
      if (loft.walkable[i] || (loft.tiles[i] !== T.RIVER && loft.tiles[i] !== T.SHALLOW)) continue;
      river++; if (river % 7) continue;                                       // a sample: every seventh water cell
      expect(globalCellTileAndClass(r, 1920 + (i % WW), 832 + ((i / WW) | 0), 1).cls).toBe(1);
    }
    expect(river).toBeGreaterThan(100);
  }, 300_000);

  it('the masks are left as compiled, so the map digest a save is checked against does not move', () => {
    const { r } = runAt(2112, 1280);
    expect(r.layoutId).toBe('veyra05-at-2112-1280');
    expect(mapDigest(getWorld())).toBe(r.sourceMap!.mapDigest);
    expect(mapDigest(getWorld())).toBe('f6d24108');
  }, 300_000);

  it('an upper storey still ends at its edge, and the river below is not a way off it', () => {
    const { gs, r } = runAt(1920, 832);                                       // Verdant Timberyard: the log count gantry
    const ww = getWindowWorld(r.layoutId!);
    expect(applyFloor(gs, ww, ww.floors, 1, [138, 89], markDirty)).toBe(true);
    expect(activeFloor(r)).toBe(1);
    const layer = ww.floors.layers.get(1)!, w = getWorld(); const grid = blockGrid(r);
    let deck = 0, off = 0, offWater = 0; const leaks: string[] = [];
    for (let i = 0; i < WW * WH; i++) {
      if (layer.walkable[i]) { deck++; continue; }
      off++; const t = w.tiles[i]; if (t === T.RIVER || t === T.SHALLOW) offWater++;
      expect(veyraOpenGround(r, i)).toBe(false);
      if (grid[i] === 0 || grid[i] === 4) leaks.push(`${i % WW},${(i / WW) | 0}`);
    }
    expect(deck).toBeGreaterThan(20);
    expect(offWater).toBeGreaterThan(100);                                    // the river runs under this window
    expect(leaks.slice(0, 12)).toEqual([]);
    expect(blockedAt(r, 138, 89)).toBe(false);                                // the landing itself is free
    applyFloor(gs, ww, ww.floors, 0, [138, 89], markDirty);
  }, 300_000);
});
