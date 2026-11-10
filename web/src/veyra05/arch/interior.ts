/**
 * INTERIOR DETAILING PASS — turns authored room shells into places.
 *
 * Research translation: survival POIs read as *inhabited* because structure and
 * clutter subdivide the floor plate — piers carry the roof, partitions make bays,
 * furniture hugs walls and leaves a walking spine. A bare 26x12 rectangle does
 * not. This pass adds, deterministically and without ever sealing a route:
 *   · structural piers on a 6-tile grid inside large halls
 *   · one partition with a doorway splitting over-wide rooms into two bays
 *   · programme-driven furnishing against the walls (beds, stacks, benches…)
 *   · rugs / floor wear so the plate is not a uniform grid
 * Doors, stairs, caches and their approach cells are protected before anything
 * is placed, and a flood-fill check rejects any partition that would cut a room.
 */
import { T, WW, WH } from '../../game/core';
import { getSolidPropFootprint, type FloorLayer, type LayerPlacementContext } from '../floors';

const KEY = (x: number, y: number) => y * WW + x;
const hash = (x: number, y: number, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

const PROGRAMME: { test: RegExp; wall: string[]; centre: string[] }[] = [
  { test: /loft|chamber|cottage|bed|quarters|cell$/i, wall: ['bed', 'bed', 'shelf', 'crate_stack', 'table'], centre: ['table', 'rug'] },
  { test: /library|stacks|archive|map room|scriptorium|vault/i, wall: ['bookshelf', 'bookshelf', 'desk'], centre: ['map_table', 'bookshelf'] },
  { test: /hall|nave|commons|refectory|green/i, wall: ['bench', 'bench', 'shelf', 'table', 'crate_stack'], centre: ['hearth', 'table'] },
  { test: /cellar|smoke|store|granary|pantry|grain|depot/i, wall: ['barrel_stack', 'crate_stack', 'grain_sack'], centre: ['crate_stack', 'barrel_stack'] },
  { test: /smith|forge|furnace|casting|foundry/i, wall: ['anvil', 'coal_pile', 'ingot_stack'], centre: ['forge', 'chain_hoist'] },
  { test: /adit|pump|sump|culvert|crane|catwalk|conveyor|screen|tipple/i, wall: ['pipes', 'rubble', 'ore_pile'], centre: ['pump', 'ore_cart'] },
  { test: /office|pay|vestry|instrument|observatory|drum/i, wall: ['desk', 'safe', 'shelf'], centre: ['orrery', 'desk'] },
  { test: /shed|boat|net|yard|service/i, wall: ['net_rack', 'barrel_stack', 'cart_broken'], centre: ['boat_hull', 'crate_stack'] },
];
const programme = (name: string) => PROGRAMME.find(p => p.test.test(name)) ?? { test: /./, wall: ['crate_stack', 'shelf'], centre: ['table'] };

function reachable(tiles: Uint8Array, from: number, to: number): boolean {
  if (from === to) return true;
  const seen = new Uint8Array(WW * WH); const q = new Int32Array(WW * WH);
  let h = 0, t = 0; q[t++] = from; seen[from] = 1;
  while (h < t) {
    const i = q[h++]; if (i === to) return true;
    const x = i % WW, y = (i / WW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue;
      const j = ny * WW + nx;
      if (!seen[j] && tiles[j] !== T.PWALL) { seen[j] = 1; q[t++] = j; }
    }
  }
  return false;
}

export function detailInteriors(layer: FloorLayer, placement?: LayerPlacementContext) {
  const tiles = layer.tiles;
  const protectedCells = new Set<number>();
  const guard = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (x + dx >= 0 && y + dy >= 0 && x + dx < WW && y + dy < WH) {
          protectedCells.add(KEY(x + dx, y + dy));
        }
      }
    }
  };
  for (const s of layer.statics) guard(s.tx, s.ty);
  for (const p of layer.props) {
    const fp = getSolidPropFootprint(p.kind);
    if (fp.length) {
      for (const [dx, dy] of fp) {
        if (p.x + dx >= 0 && p.y + dy >= 0 && p.x + dx < WW && p.y + dy < WH) {
          protectedCells.add(KEY(p.x + dx, p.y + dy));
        }
      }
    } else {
      protectedCells.add(KEY(p.x, p.y));
    }
  }
  for (const st of layer.stairs) { guard(st.x, st.y); guard(st.tx, st.ty); }

  const canPlaceInRoom = (inside: (x: number, y: number) => boolean, x: number, y: number, kind: string): boolean => {
    const fp = getSolidPropFootprint(kind);
    const cells = fp.length ? fp : ([[0, 0]] as const);
    for (const [dx, dy] of cells) {
      const cx = x + dx, cy = y + dy;
      if (cx <= 0 || cy <= 0 || cx >= WW - 1 || cy >= WH - 1) return false;
      const i = KEY(cx, cy);
      if (!inside(cx, cy) || tiles[i] !== T.FLOOR || protectedCells.has(i)) return false;
    }
    if (placement && !placement.stampProceduralSolidProp(x, y, kind)) return false;
    for (const [dx, dy] of cells) protectedCells.add(KEY(x + dx, y + dy));
    return true;
  };

  for (const r of layer.rooms) {
    if (r.open) continue;
    if (/catwalk|bridge|conveyor|roof deck|lane|avenue|green|quad|forecourt|yard|spur/i.test(r.name)) continue;
    const prog = programme(r.name);
    for (const [rx, ry, rw, rh] of r.rects) {
      if (rw < 5 || rh < 5) continue;
      const inside = (x: number, y: number) => r.rects.some(([a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h);

      // ── furnishing hugs the walls, leaving the middle of the room walkable
      let n = 0;
      for (let y = ry + 1; y < ry + rh - 1 && n < 14; y++) for (let x = rx + 1; x < rx + rw - 1 && n < 14; x++) {
        const againstWall = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
          || tiles[KEY(x - 1, y)] === T.PWALL || tiles[KEY(x + 1, y)] === T.PWALL || tiles[KEY(x, y - 1)] === T.PWALL;
        if (!againstWall) continue;
        if (r.name.match(/catwalk|bridge|conveyor|deck|lane|avenue|green|yard|forecourt|quad/i)) continue;
        if (hash(x, y, 7) > 0.55) continue;
        if (protectedCells.has(KEY(x + 1, y)) && protectedCells.has(KEY(x - 1, y))) continue;
        const kind = prog.wall[Math.floor(hash(x, y, 11) * prog.wall.length)];
        if (canPlaceInRoom(inside, x, y, kind)) {
          layer.props.push({ x, y, kind });
          n++;
        }
      }
      // one centre-piece for the larger rooms (falls back to 1x1 table/crate if a 3x1 centerpiece cannot fit without severing routes)
      if (rw * rh >= 90) {
        const cx = rx + (rw >> 1), cy = ry + (rh >> 1);
        const primaryKind = prog.centre[Math.floor(hash(cx, cy, 13) * prog.centre.length)];
        if (canPlaceInRoom(inside, cx, cy, primaryKind)) {
          layer.props.push({ x: cx, y: cy, kind: primaryKind });
        } else if (primaryKind !== 'table' && canPlaceInRoom(inside, cx, cy, 'table')) {
          layer.props.push({ x: cx, y: cy, kind: 'table' });
        }
      }
      // floor wear / rugs so the plate is not a uniform grid
      for (let y = ry + 1; y < ry + rh - 1; y++) for (let x = rx + 1; x < rx + rw - 1; x++) {
        if (!inside(x, y) || tiles[KEY(x, y)] !== T.FLOOR) continue;
        const h = hash(x, y, 23);
        if (h > 0.93) layer.props.push({ x, y, kind: 'floor_wear' });
        else if (h < 0.035 && rw * rh >= 70) layer.props.push({ x, y, kind: 'rug' });
      }
    }
  }
}
