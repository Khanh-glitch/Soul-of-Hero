/**
 * VEYRA05 SEAMLESS WINDOW CONTINUITY (TASK 3 — Remove Artificial World Fragmentation).
 *
 * Bridges the bounded 200x200 live Gameplay engine with the continuous 4000x2800
 * U=0.5 Veyra world:
 *   - Tracks global tile & AU coordinates for the player and all run deltas.
 *   - Automatically slides the 200x200 engine window by 64-tile (2-chunk) steps
 *     when the player walks within 24 tiles of an interior window edge, without
 *     any artificial T.CLIFF wall or camera jump.
 *   - Preserves global source depletion/regrowth, door open/close states, terrain
 *     mutations, 4x4 fog-of-war discovery, POI loot/cash/vendor/evac state,
 *     player-built structures/containers, run clock, weather, and player stats/UIDs.
 *   - Produces saves that pass persist.ts strict validation on both sides of
 *     every boundary.
 */
import { TILE, WW, WH, clamp, type GameState, type RunState } from '../game/core';
import { getWorld, setActiveLayout } from '../game/world';
import { sourceDigest } from '../game/world-economy';
import { mapDigest } from '../game/map-package';
import { poiContractDigest } from '../game/poi-access';
import { U, FRAME_W, FRAME_H, globalIndex } from './frame';
import { isVeyra05Layout, layoutIdAt } from './scenes';
import {
  syncFloor, entityFloor, activeFloor,
  instantiateVeyraStatic, syncDepletedLootToGlobal, projectDepletedLootFromGlobal,
} from './floors';
import { getWindowWorld, resetWindowToGround } from './window';

const EDGE_MARGIN = 24; // tiles from local window edge before sliding
const SLIDE_STEP = 64;  // 2 chunks (32 AU), leaving 136 tiles of overlap

type ShiftListener = (dxTiles: number, dyTiles: number) => void;
const shiftListeners = new Set<ShiftListener>();
export function onVeyraWindowShift(fn: ShiftListener): () => void {
  shiftListeners.add(fn);
  return () => { shiftListeners.delete(fn); };
}

/** Current window origin in global U=0.5 tiles. */
export function windowOrigin(r: RunState): [number, number] {
  const o = r.sourceMap?.veyra?.originAu;
  if (!o) return [0, 0];
  return [Math.round(o[0] / U), Math.round(o[1] / U)];
}

/** Player's true global U=0.5 tile coordinates across any window transition. */
export function playerGlobalTile(r: RunState): [number, number] {
  const [ox, oy] = windowOrigin(r);
  return [ox + Math.floor(r.player.x / TILE), oy + Math.floor(r.player.y / TILE)];
}

/** Player's true global AU coordinates across any window transition. */
export function playerGlobalAu(r: RunState): [number, number] {
  const [ox, oy] = windowOrigin(r);
  return [Number(((ox + r.player.x / TILE) * U).toFixed(2)), Number(((oy + r.player.y / TILE) * U).toFixed(2))];
}

/**
 * Shift the active 200x200 window by (reqDx, reqDy) global tiles while keeping
 * player world position, camera, entities, sources, doors, loot, and save validity continuous.
 */
export function shiftVeyraWindowBy(
  gs: GameState,
  reqDx: number,
  reqDy: number,
  markDirtyFn: () => void,
): boolean {
  const r = gs.run;
  if (!r || !r.layoutId || !isVeyra05Layout(r.layoutId) || r.ended) return false;
  if (activeFloor(r) !== 0) return false;
  const [ox, oy] = windowOrigin(r);
  const newOx = clamp(ox + reqDx, 0, FRAME_W - WW);
  const newOy = clamp(oy + reqDy, 0, FRAME_H - WH);
  const dx = newOx - ox;
  const dy = newOy - oy;
  if (dx === 0 && dy === 0) return false;

  const oldWw = getWindowWorld(r.layoutId);
  syncDepletedLootToGlobal(r, ox, oy, 0, oldWw.floors.ground.statics);

  // 1. Archive current window deltas into global run ledgers
  const gSources = (r.veyraGlobalSources ??= {});
  for (const [kStr, st] of Object.entries(r.sources)) {
    const li = Number(kStr), lx = li % WW, ly = (li / WW) | 0;
    gSources[globalIndex(ox + lx, oy + ly)] = st;
  }

  const gTerrain = (r.veyraGlobalTerrain ??= {});
  for (const [kStr, tm] of Object.entries(r.terrain)) {
    const li = Number(kStr), lx = li % WW, ly = (li / WW) | 0;
    gTerrain[globalIndex(ox + lx, oy + ly)] = tm;
  }

  const gDoors = (r.veyraGlobalDoors ??= {});
  for (const e of Object.values(r.entities)) {
    if (e.kind === 'door' && e.poi && entityFloor(e) === 0 && e.tx !== undefined && e.ty !== undefined) {
      gDoors[globalIndex(ox + e.tx, oy + e.ty)] = !!e.open;
    }
  }

  const gDisc = (r.veyraGlobalDiscovered ??= {});
  for (let cy4 = 0; cy4 < 50; cy4++) {
    for (let cx4 = 0; cx4 < 50; cx4++) {
      if (r.discovered[cy4 * 50 + cx4]) {
        gDisc[`${(ox >> 2) + cx4}:${(oy >> 2) + cy4}`] = 1;
      }
    }
  }

  // Clear local storey-specific caches before binding to the new window
  delete r.veyraFloorState;

  // 2. Materialise/fetch new 200x200 window world (ensuring ground level is active)
  const newLayout = layoutIdAt(newOx, newOy);
  const nww = getWindowWorld(newLayout);
  resetWindowToGround(nww);
  setActiveLayout(newLayout);
  const nw = getWorld(newLayout);
  r.layoutId = newLayout;
  r.sourceMap = {
    id: nw.economyMap.id,
    revision: nw.economyMap.revision,
    seed: nw.economyMap.seed,
    rules: 3,
    digest: sourceDigest(nw.sourceV3),
    mapDigest: mapDigest(nw),
    ...(nw.veyra ? { veyra: nw.veyra } : {}),
  };
  r.poiAccessDigest = poiContractDigest(nw);
  if (r.spawnChoice) {
    r.spawnChoice = {
      x: clamp(r.spawnChoice.x - dx, 1, WW - 2),
      y: clamp(r.spawnChoice.y - dy, 1, WH - 2),
      contract: 'seeded-geographic-v1',
    };
  }
  r.player.regionName = nw.zoneNames?.[0] || r.player.regionName;

  // 3. Re-project player, traces, creatures, and entities by (-dx, -dy)
  const pxShift = dx * TILE, pyShift = dy * TILE;
  r.player.x = clamp(r.player.x - pxShift, 8, WW * TILE - 8);
  r.player.y = clamp(r.player.y - pyShift, 8, WH * TILE - 8);
  r.player.lastTraceX -= pxShift;
  r.player.lastTraceY -= pyShift;
  if (r.player.action?.targetX !== undefined) r.player.action.targetX -= pxShift;
  if (r.player.action?.targetY !== undefined) r.player.action.targetY -= pyShift;
  if (r.traceWalk) { r.traceWalk.x -= pxShift; r.traceWalk.y -= pyShift; }

  r.traces = r.traces
    .map(tr => ({ ...tr, x: tr.x - pxShift, y: tr.y - pyShift }))
    .filter(tr => tr.x >= 0 && tr.y >= 0 && tr.x < WW * TILE && tr.y < WH * TILE);

  r.creatures = r.creatures
    .map(m => ({
      ...m,
      x: m.x - pxShift,
      y: m.y - pyShift,
      homeX: m.homeX - pxShift,
      homeY: m.homeY - pyShift,
      tx: m.tx - dx,
      ty: m.ty - dy,
      path: null,
    }))
    .filter(m => m.x >= -12 * TILE && m.y >= -12 * TILE && m.x < (WW + 12) * TILE && m.y < (WH + 12) * TILE);

  // Entities: remove old ground POI doors; shift or archive non-door entities; restore re-entering entities
  const offscreen = (r.veyraOffscreenEntities ??= {});
  for (const [id, e] of Object.entries(r.entities)) {
    const fl = entityFloor(e);
    if (e.kind === 'door' && e.poi && fl === 0) {
      delete r.entities[id];
      continue;
    }
    const nx = e.x - pxShift, ny = e.y - pyShift;
    const ntx = e.tx !== undefined ? e.tx - dx : undefined;
    const nty = e.ty !== undefined ? e.ty - dy : undefined;
    const inside = (ntx !== undefined && nty !== undefined)
      ? (ntx >= 1 && nty >= 1 && ntx < WW - 1 && nty < WH - 1)
      : (nx >= TILE && ny >= TILE && nx < (WW - 1) * TILE && ny < (WH - 1) * TILE);
    if (inside) {
      e.x = nx; e.y = ny;
      if (ntx !== undefined) e.tx = ntx;
      if (nty !== undefined) e.ty = nty;
    } else {
      offscreen[id] = {
        ...e,
        x: ox * TILE + e.x,
        y: oy * TILE + e.y,
        ...(e.tx !== undefined && e.ty !== undefined ? { tx: ox + e.tx, ty: oy + e.ty } : {}),
      };
      delete r.entities[id];
    }
  }

  for (const [id, oe] of Object.entries(offscreen)) {
    const lx = oe.x - newOx * TILE, ly = oe.y - newOy * TILE;
    const ltx = oe.tx !== undefined ? oe.tx - newOx : undefined;
    const lty = oe.ty !== undefined ? oe.ty - newOy : undefined;
    const inside = (ltx !== undefined && lty !== undefined)
      ? (ltx >= 1 && lty >= 1 && ltx < WW - 1 && lty < WH - 1)
      : (lx >= TILE && ly >= TILE && lx < (WW - 1) * TILE && ly < (WH - 1) * TILE);
    if (inside) {
      r.entities[id] = {
        ...oe,
        x: lx,
        y: ly,
        ...(ltx !== undefined ? { tx: ltx, ty: lty } : {}),
      };
      delete offscreen[id];
    }
  }
  if (!Object.keys(offscreen).length) delete r.veyraOffscreenEntities;

  // Re-project depleted loot ledger for the new window BEFORE instantiating statics
  projectDepletedLootFromGlobal(r, newOx, newOy, 0, nw.statics);
  const depleted = new Set(r.depletedLootSites || []);

  // Instantiate newly entered ground-level statics once (doors, loot, cash, vendor, evac, gen)
  for (const s of nw.statics) {
    if (s.kind === 'loot' && depleted.has(s.ty * WW + s.tx)) continue;
    if (s.kind !== 'door') {
      const exists = Object.values(r.entities).some(
        e => entityFloor(e) === 0 && e.kind === s.kind && e.tx === s.tx && e.ty === s.ty,
      );
      if (exists) continue;
    }
    const gi = globalIndex(newOx + s.tx, newOy + s.ty);
    const doorOpen = s.kind === 'door' ? !!gDoors[gi] : false;
    const e = instantiateVeyraStatic(r, s, 0, doorOpen);
    r.entities[e.id] = e;
  }

  // 4. Restore global sources, terrain, and fog-of-war discovery for the new window
  r.sources = {};
  for (const [giStr, st] of Object.entries(gSources)) {
    const gi = Number(giStr), gx = gi % FRAME_W, gy = (gi / FRAME_W) | 0;
    const lx = gx - newOx, ly = gy - newOy;
    if (lx >= 0 && ly >= 0 && lx < WW && ly < WH) {
      const li = ly * WW + lx;
      if (nw.sourceV3[li]) r.sources[li] = st;
    }
  }

  r.terrain = {};
  for (const [giStr, tm] of Object.entries(gTerrain)) {
    const gi = Number(giStr), gx = gi % FRAME_W, gy = (gi / FRAME_W) | 0;
    const lx = gx - newOx, ly = gy - newOy;
    if (lx >= 0 && ly >= 0 && lx < WW && ly < WH) {
      r.terrain[ly * WW + lx] = tm;
    }
  }

  r.discovered = Array(2500).fill(0);
  for (let cy4 = 0; cy4 < 50; cy4++) {
    for (let cx4 = 0; cx4 < 50; cx4++) {
      if (gDisc[`${(newOx >> 2) + cx4}:${(newOy >> 2) + cy4}`]) {
        r.discovered[cy4 * 50 + cx4] = 1;
      }
    }
  }

  // 4b. VEYRA05: reinstall the active storey of the new window
  syncFloor(gs, nww, nww.floors, markDirtyFn);
  // 5. Mark collision dirty & shift camera seamlessly
  markDirtyFn();
  for (const fn of shiftListeners) fn(dx, dy);
  return true;
}

/** Check if the player walked near an interior window boundary and slide smoothly if so. */
export function maybeSlideVeyraWindow(gs: GameState, markDirtyFn: () => void): boolean {
  const r = gs.run;
  if (!r || !r.layoutId || !isVeyra05Layout(r.layoutId) || r.ended) return false;
  if (activeFloor(r) !== 0) return false;
  const [ox, oy] = windowOrigin(r);
  const ltx = Math.floor(r.player.x / TILE);
  const lty = Math.floor(r.player.y / TILE);
  let shiftX = 0, shiftY = 0;
  if (ltx < EDGE_MARGIN && ox > 0) shiftX = -SLIDE_STEP;
  else if (ltx >= WW - EDGE_MARGIN && ox < FRAME_W - WW) shiftX = SLIDE_STEP;
  if (lty < EDGE_MARGIN && oy > 0) shiftY = -SLIDE_STEP;
  else if (lty >= WH - EDGE_MARGIN && oy < FRAME_H - WH) shiftY = SLIDE_STEP;
  if (shiftX === 0 && shiftY === 0) return false;
  return shiftVeyraWindowBy(gs, shiftX, shiftY, markDirtyFn);
}
