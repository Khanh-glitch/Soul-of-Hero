/** Exact compatibility bridge for 7d00481's six-cell Hook partition change.
 * Reconstructs ONLY the previous ground fingerprint; never accepts an arbitrary
 * mismatch or changes source IDs, stock, clocks, gates, or saved map provenance.
 */
import { T, TILE, WW, WH, type RunState } from '../game/core';
import { mapDigest } from '../game/map-package';
import type { World } from '../game/world';
import type { WindowWorld } from './window';
import { entityFloor } from './floors';

const legacyDigests = new WeakMap<World, string | null>();
export function preHookPartitionDigest(ww: WindowWorld): string | null {
  if (legacyDigests.has(ww.world)) return legacyDigests.get(ww.world)!;
  const { world: w, win, floors: { ground: g } } = ww;
  const tiles = g.tiles.slice(), walkable = g.walkable.slice();
  let changed = 0;
  for (const gy of [691, 692, 694]) for (const gx of [2598, 2599]) {
    const x = gx - win.originTx, y = gy - win.originTy;
    // Match the compiler's interior-window clipping, including partial windows.
    if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1) continue;
    const i = y * WW + x, current = gx === 2598 ? T.PWALL : T.FLOOR;
    if (tiles[i] !== current || walkable[i] !== (current === T.PWALL ? 0 : 1)) {
      legacyDigests.set(w, null); return null; // fail closed if the live geometry changes again
    }
    tiles[i] = gx === 2598 ? T.FLOOR : T.PWALL;
    walkable[i] = gx === 2598 ? 1 : 0;
    changed++;
  }
  // Ground arrays, not the mutable currently installed upper/cellar layer.
  const digest = !changed ? null : mapDigest({ ...w, tiles, zone: g.zone, sourceV3: g.sources,
    buildings: g.buildings, statics: g.statics,
    economyMap: { ...w.economyMap, walkable, protected: g.protectedCells, buildable: g.buildable },
  });
  legacyDigests.set(w, digest);
  return digest;
}

/** A legal old standing cell can become a wall. Plan bounded adjacent recovery
 * first, apply atomically only if every affected actor has a legal destination.
 * This is NOT a general teleport/un-stuck path and runs only for the exact old fingerprint.
 */
export function recoverHookPartitionActors(r: RunState, ww: WindowWorld): boolean {
  const g = ww.floors.ground, { originTx: ox, originTy: oy } = ww.win;
  const moves: { actor: { x: number; y: number }; x: number; y: number }[] = [];
  const actors = [...((r.veyraFloor ?? 0) === 0 ? [r.player] : []),
    ...r.creatures.filter(c => c.state !== 'dead' && (c.floor ?? 0) === 0)];
  for (const actor of actors) {
    const gx = Math.floor(actor.x / TILE) + ox, gy = Math.floor(actor.y / TILE) + oy;
    if (gx !== 2598 || ![691, 692, 694].includes(gy)) continue;
    if (actor === r.player && r.player.vehicle) return false; // do not detach a mounted player from their vehicle
    let found = false;
    // Prefer the original west side of the partition, never cross a closed door.
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const x = gx + dx - ox, y = gy + dy - oy, i = y * WW + x;
      if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1 || !g.walkable[i] || g.solidProps[i] || g.sources[i]) continue;
      if (Object.values(r.entities).some(e => entityFloor(e) === 0 && e.tx === x && e.ty === y &&
        (e.kind !== 'door' || !e.open))) continue;
      moves.push({ actor, x: x * TILE + 8, y: y * TILE + 8 }); found = true; break;
    }
    if (!found) return false;
  }
  for (const { actor, x, y } of moves) { actor.x = x; actor.y = y; }
  return true;
}
