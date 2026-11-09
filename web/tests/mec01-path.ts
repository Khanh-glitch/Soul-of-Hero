// MEC-01 R2: shared helpers for the end-to-end freight delivery test.
// A* over the REAL shipping_fresh collision/terrain grids. Movement itself is produced by tick() with held
// direction keys in the test; nothing here teleports the player mid-haul, mutates the world or grants items.
// Cost model mirrors the engine's own speed tables (BAL.terrainSpeed for walking; cart 1.36 road / 0.72 off / 0.42 rough
// exactly as sim.ts applies it, WITHOUT the terrain table; motorbike 125 road / 52 ground / 35 rough on the authorized
// vehicle geometry). Each mode therefore gets its own optimum route over the same physical map - no invented road.
import { TILE, WW, WH, T, BAL, type RunState } from '../src/game/core';
import { blockGrid, effTile } from '../src/game/engine';
import { vehicleCell, vehicleExitPoint } from '../src/game/motorbike';
import { getWorld } from '../src/game/world';

const SURF: Record<number, string> = { [T.SNOW]: 'snow', [T.MARSH]: 'marsh', [T.SAND]: 'sand', [T.ASH]: 'ash', [T.GRASS]: 'grass', [T.MEADOW]: 'meadow', [T.FOREST]: 'forest', [T.HILL]: 'hill', [T.ROAD]: 'road', [T.BRIDGE]: 'bridge', [T.FLOOR]: 'floor', [T.BURNT]: 'burnt', [T.TOXIC]: 'toxic', [T.ICE]: 'ice' };
const ROUGH = new Set<number>([T.FOREST, T.MARSH, T.HILL, T.SNOW]);
const BLOCKED_TILES = new Set<number>([T.DEEP, T.SHALLOW, T.RIVER, T.LAVA, T.ICE, T.CLIFF, T.PWALL]);

export type Mode = 'walk' | 'cart' | 'bike';

/** Seconds to cross one tile for the mode (its real speed table). null = cannot enter. */
export function cellSeconds(r: RunState, tx: number, ty: number, mode: Mode): number | null {
  if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return null;
  const t = effTile(r, tx, ty);
  if (mode === 'bike') {
    if (!vehicleCell(r, tx * TILE + 8, ty * TILE + 8, 'passable')) return null;
    // The engine demands BOTH vehicleCell(passable) AND at least one viable exit point at EVERY driven sub-step. Measured
    // (seed 4242, row 109 near the factory): every exit candidate fails in that pocket, the machine froze in place, and the
    // held-key driver burned the whole 300-unit tank pacing back and forth (odometer 5517 px, cp stuck at 20). Route only
    // through cells whose CENTER position already yields a valid exit point; anything stricter can only prune artefacts.
    if (!vehicleExitPoint(r, tx * TILE + 8, ty * TILE + 8)) return null;

    const road = !!getWorld(r.layoutId || 'shipping').vehicleGeometry?.road[ty * WW + tx];
    const sp = road ? BAL.motorbike.roadSpeed : ROUGH.has(t) ? BAL.motorbike.roughSpeed : BAL.motorbike.groundSpeed;
    return 1 / sp;
  }
  const b = blockGrid(r)[ty * WW + tx];
  if (b !== 0) return null;                                   // water(1)/tree(2)/structure(3)/wade(4)/lava(5): blocked for walkers and pulled carts
  if (BLOCKED_TILES.has(t)) return null;
  if (mode === 'walk') return 1 / (BAL.player.speed * (BAL.terrainSpeed[SURF[t]] ?? 1));
  const onRoad = t === T.ROAD || t === T.BRIDGE || t === T.FLOOR;
  return 1 / (BAL.player.speed * (onRoad ? BAL.cart.speedOnRoad : ROUGH.has(t) ? BAL.cart.speedRough : BAL.cart.speedOffRoad));
}

/** A* (8-dir, no corner cutting; 4-dir for the bike) on tile cells. Returns tile-center points in order, or null if unreachable.
 *  Bike legs must be axis-aligned: the engine drives in 3 px sub-steps and every sub-step must clear vehicleClear AND
 *  vehicleExitPoint at its exact float position, which a 1-tile-wide corridor only allows straight through (corners clip otherwise). */
export function astar(r: RunState, sx: number, sy: number, gx: number, gy: number, mode: Mode): { x: number; y: number }[] | null {
  const start = sy * WW + sx, goal = gy * WW + gx;
  // Heuristic: optimistic time at max road speed (keeps the queue small; distances here are < 60 tiles).
  const h = (i: number) => { const dx = Math.abs((i % WW) - gx), dy = Math.abs(((i / WW) | 0) - gy); return mode === 'bike' ? (dx + dy) / BAL.motorbike.roadSpeed : (Math.max(dx, dy) + 0.4142 * Math.min(dx, dy)) / BAL.motorbike.roadSpeed; };
  // binary min-heap on f
  const nodes: { i: number; f: number }[] = [];
  const push = (i: number, f: number) => { nodes.push({ i, f }); let c = nodes.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (nodes[p].f <= nodes[c].f) break; const t = nodes[p]; nodes[p] = nodes[c]; nodes[c] = t; c = p; } };
  const pop = () => { const top = nodes[0], last = nodes.pop()!; if (nodes.length) { nodes[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, rr = l + 1; let m = c; if (l < nodes.length && nodes[l].f < nodes[m].f) m = l; if (rr < nodes.length && nodes[rr].f < nodes[m].f) m = rr; if (m === c) break; const t = nodes[m]; nodes[m] = nodes[c]; nodes[c] = t; c = m; } } return top.i; };
  const g = new Float64Array(WW * WH).fill(Infinity);
  const came = new Int32Array(WW * WH).fill(-1);
  const closed = new Uint8Array(WW * WH);
  g[start] = 0; push(start, h(start));
  // 8-dir for walkers and pulled carts. Vehicles are 4-dir: the bike is a 12 px box moving in 3 px sub-steps and its
  // corner clearance is only guaranteed on axis-aligned legs through cell centers - a diagonal leg, even between two
  // vehicleCell-passable cells, can clip a protruding edge (measured: stalls at two different diagonal legs, seed 4242).
  const DIRS = mode === 'bike'
    ? [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1]] as const
    : [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]] as const;
  while (nodes.length) {
    const cur = pop();
    if (cur === goal) {
      const out: { x: number; y: number }[] = [];
      for (let i = goal; i !== -1; i = came[i]) out.push({ x: (i % WW) * TILE + 8, y: ((i / WW) | 0) * TILE + 8 });
      return out.reverse();
    }
    if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % WW, cy = (cur / WW) | 0;
    const dirs = mode === 'bike' ? DIRS.slice(0, 4) : DIRS;
  for (const [dx, dy, w] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      const s = cellSeconds(r, nx, ny, mode);
      if (s === null) continue;
      if (dx && dy && (cellSeconds(r, cx + dx, cy, mode) === null || cellSeconds(r, cx, cy + dy, mode) === null)) continue; // no corner cutting
      const ni = ny * WW + nx, ng = g[cur] + s * w * TILE;
      if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ni, ng + h(ni)); }
    }
  }
  return null;
}

/** Thin out a tile path into checkpoints every `step` tiles (the follower still turns smoothly); always keeps the goal. */
export function checkpoints(path: { x: number; y: number }[], step = 2): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < path.length; i += step) out.push(path[i]);
  const last = path[path.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

export function pathLengthPx(path: { x: number; y: number }[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return d;
}
