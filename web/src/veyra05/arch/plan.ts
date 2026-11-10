/**
 * VEYRA05 ARCHITECTURE PLAN DSL — multi-level compounds with validated circulation.
 *
 * Research translation (Last Island of Survival compounds, DayZ/Namalsk institutes,
 * 7DTD industrial POIs) into a top-down pixel survival RPG:
 *   · a STRUCTURE is a single building mass; rooms are named spaces inside it.
 *     Walls belong to the structure outline, not to every room, so neighbouring
 *     rooms share the wall instead of being sealed by two.
 *   · PARTITIONS are the only interior walls, authored where privacy/defence is
 *     believable (a bedchamber, a vault, a foreman's office) and always with a
 *     doorway that is checked.
 *   · verticality: cellars (-1), ground (0), upper storey (1), roof deck (2),
 *     linked by interior stairs, outside stairs, ladders and hatches. A vertical
 *     link is only valid if BOTH landings are on walkable floor of their level.
 *   · circulation is proven at compile time: one flood fill per structure level
 *     (doors treated as passable, as they are in play) must reach every room,
 *     stair landing and cache, and every structure must open onto outdoor ground.
 *   · the compiler refuses to hide a break: `planIssues()` reports it and the
 *     game exposes it in the inspector instead of pretending the route works.
 */
import { T } from '../../game/core';
import { FRAME_W } from '../frame';

export type Level = -1 | 0 | 1 | 2;
export type Rect = [number, number, number, number];
export type RoofStyle = 'thatch' | 'tile' | 'tin' | 'wood' | 'light' | 'hull';
export type Mat = 'wood' | 'stone' | 'brick';

export interface RoomSpec {
  id: string; name: string; level: Level; rects: Rect[]; struct: string;
  storey: string; secret?: boolean; hazard?: boolean; open?: boolean; carve?: boolean;
}
export interface StructureSpec {
  id: string; name: string; level: Level; mat: Mat; roof: RoofStyle | null;
  /** open-air yard: paving only, no outline wall */
  open?: boolean;
  /** barrier: a wall, fence or pylon — never entered, never validated for a door */
  barrier?: boolean;
}
export interface DoorSpec { x: number; y: number; level: Level; label: string; kind: 'main' | 'service' | 'interior' | 'hatch' | 'arch'; poi: string; struct: string }
export interface StairSpec { x: number; y: number; from: Level; to: Level; kind: 'interior' | 'exterior' | 'hatch' | 'ladder' | 'catwalk'; label: string; poi: string; tx: number; ty: number }
export interface PropSpec { x: number; y: number; level: Level; kind: string; note?: string }
export interface LootSpec { x: number; y: number; level: Level; poi: string; label: string; items: [string, number][] }
export interface NoteSpec { x: number; y: number; level: Level; text: string }

export interface ArchPlan {
  poi: string; title: string; subtitle: string; bounds: Rect;
  structures: StructureSpec[]; rooms: RoomSpec[]; partitions: { x: number; y: number; level: Level }[];
  doors: DoorSpec[]; stairs: StairSpec[]; props: PropSpec[]; loot: LootSpec[]; notes: NoteSpec[];
  levels: Level[];
}

export class Plan {
  p: ArchPlan;
  constructor(poi: string, title: string, subtitle: string, bounds: Rect) {
    this.p = { poi, title, subtitle, bounds, structures: [], rooms: [], partitions: [], doors: [], stairs: [], props: [], loot: [], notes: [], levels: [] };
  }
  structure(id: string, name: string, level: Level, o: { mat?: Mat; roof?: RoofStyle | null; open?: boolean; barrier?: boolean } = {}) {
    this.p.structures.push({ id: `${this.p.poi}.${id}`, name, level, mat: o.mat ?? 'wood', roof: o.roof === undefined ? 'wood' : o.roof, open: o.open, barrier: o.barrier });
    if (!this.p.levels.includes(level)) this.p.levels.push(level);
    return this;
  }
  room(id: string, name: string, level: Level, struct: string, rects: Rect[], o: { secret?: boolean; hazard?: boolean; open?: boolean; carve?: boolean } = {}) {
    this.p.rooms.push({
      id: `${this.p.poi}.${id}`, name, level, struct: `${this.p.poi}.${struct}`, rects,
      storey: level === -1 ? 'Cellar' : level === 0 ? 'Ground' : level === 1 ? 'Upper' : 'Roof',
      secret: o.secret, hazard: o.hazard, open: o.open, carve: o.carve,
    });
    return this;
  }
  partition(x0: number, y0: number, x1: number, y1: number, level: Level) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.p.partitions.push({ x, y, level });
    return this;
  }
  door(x: number, y: number, level: Level, struct: string, label: string, kind: DoorSpec['kind'] = 'interior') {
    this.p.doors.push({ x, y, level, label, kind, poi: this.p.poi, struct: `${this.p.poi}.${struct}` });
    return this;
  }
  stair(x: number, y: number, from: Level, to: Level, tx: number, ty: number, label: string, kind: StairSpec['kind'] = 'interior') {
    this.p.stairs.push({ x, y, from, to, tx, ty, label, kind, poi: this.p.poi });
    if (!this.p.levels.includes(from)) this.p.levels.push(from);
    if (!this.p.levels.includes(to)) this.p.levels.push(to);
    return this;
  }
  prop(x: number, y: number, level: Level, kind: string) { this.p.props.push({ x, y, level, kind }); return this; }
  cache(x: number, y: number, level: Level, label: string, items: [string, number][]) { this.p.loot.push({ x, y, level, poi: this.p.poi, label, items }); return this; }
  note(x: number, y: number, level: Level, text: string) { this.p.notes.push({ x, y, level, text }); return this; }
  build() { this.p.levels.sort((a, b) => a - b); return this.p; }
}

export interface CompiledRoom extends RoomSpec { cells: number[]; bbox: Rect; roof: RoofStyle | null; mat: Mat; structName: string }
export interface CompiledLevel {
  level: Level; tiles: Map<number, number>; stone: Set<number>;
  rooms: CompiledRoom[]; doors: DoorSpec[]; stairs: StairSpec[]; props: PropSpec[]; loot: LootSpec[]; notes: NoteSpec[];
}
export interface CompiledPlan { plan: ArchPlan; levels: Map<Level, CompiledLevel>; bounds: Rect; issues: string[] }
export interface PlanIssue { poi: string; code: string; detail: string }

const key = (x: number, y: number) => y * FRAME_W + x;
const unkey = (k: number): [number, number] => [k % FRAME_W, (k / FRAME_W) | 0];
const inRects = (rects: Rect[], x: number, y: number) => rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);

export function compilePlan(plan: ArchPlan): CompiledPlan {
  const levels = new Map<Level, CompiledLevel>();
  for (const lv of plan.levels) levels.set(lv, { level: lv, tiles: new Map(), stone: new Set(), rooms: [], doors: [], stairs: [], props: [], loot: [], notes: [] });

  for (const lv of plan.levels) {
    const L = levels.get(lv)!;
    const structs = plan.structures.filter(s => s.level === lv);
    const roomsOf = (sid: string) => plan.rooms.filter(r => r.level === lv && r.struct === sid && !r.open);

    for (const st of structs) {
      const rooms = roomsOf(st.id);
      if (!rooms.length) continue;
      const own = new Set<number>();
      for (const r of rooms) for (const [x, y, w, h] of r.rects) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) own.add(key(xx, yy));
      for (const k of own) {
        const [x, y] = unkey(k);
        const edge = st.open ? false : !own.has(key(x - 1, y)) || !own.has(key(x + 1, y)) || !own.has(key(x, y - 1)) || !own.has(key(x, y + 1));
        const carve = rooms.some(r => r.carve && r.rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh));
        L.tiles.set(k, st.open ? (st.mat === 'wood' ? T.FLOOR : T.ROAD) : carve ? T.FLOOR : edge ? T.PWALL : T.FLOOR);
        if (st.mat !== 'wood') L.stone.add(k);
      }
    }

    // open yards: paving under everything, never over an existing wall or interior
    const openStructs = structs.filter(s => s.open);
    for (const st of openStructs) {
      for (const r of plan.rooms.filter(r => r.level === lv && r.struct === st.id)) {
        for (const [x, y, w, h] of r.rects) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
          const k = key(xx, yy); const cur = L.tiles.get(k);
          if (cur === T.PWALL) continue;
          if (cur === undefined) { L.tiles.set(k, st.mat === 'stone' ? T.ROAD : T.FLOOR); if (st.mat !== 'wood') L.stone.add(k); }
        }
      }
    }

    // room metadata (cells only where the structure built floor)
    for (const r of plan.rooms.filter(r => r.level === lv)) {
      const cells: number[] = []; let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y, w, h] of r.rects) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        const k = key(xx, yy);
        if ((L.tiles.get(k) ?? T.PWALL) === T.PWALL) continue;
        cells.push(k);
        minX = Math.min(minX, xx); minY = Math.min(minY, yy); maxX = Math.max(maxX, xx); maxY = Math.max(maxY, yy);
      }
      if (!cells.length) continue;
      const st = plan.structures.find(q => q.id === r.struct);
      L.rooms.push({ ...r, cells, bbox: [minX, minY, maxX - minX + 1, maxY - minY + 1], roof: st?.roof ?? null, mat: st?.mat ?? 'wood', structName: st?.name ?? r.name });
    }

    // interior partitions — a wall only where the author wanted privacy
    for (const pt of plan.partitions.filter(q => q.level === lv)) {
      const k = key(pt.x, pt.y);
      if (L.tiles.get(k) === T.FLOOR) L.tiles.set(k, T.PWALL);
    }

    // doors carve outline or partition; arcs stay open
    for (const d of plan.doors.filter(q => q.level === lv)) {
      L.tiles.set(key(d.x, d.y), d.kind === 'arch' ? T.FLOOR : T.PWALL);
      L.doors.push(d);
    }

    // verticals are floor sockets on BOTH levels
    for (const s of plan.stairs) {
      if (s.from === lv) { L.tiles.set(key(s.x, s.y), T.FLOOR); L.stairs.push(s); }
      if (s.to === lv) { L.tiles.set(key(s.tx, s.ty), T.FLOOR); L.stairs.push(s); }
    }
    for (const p of plan.props.filter(q => q.level === lv)) L.props.push(p);
    for (const n of plan.notes.filter(q => q.level === lv)) L.notes.push(n);
    for (const c of plan.loot.filter(q => q.level === lv)) { L.tiles.set(key(c.x, c.y), T.FLOOR); L.loot.push(c); }

    // hazard rooms reuse the engine's existing radiation zone; no new law
    for (const r of L.rooms.filter(q => q.hazard)) for (const [x, y, w, h] of r.rects) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) L.tiles.set(key(xx, yy), L.tiles.get(key(xx, yy)) === T.PWALL ? T.PWALL : T.FLOOR);
  }

  const issues: string[] = [];
  for (const lv of plan.levels) {
    const L = levels.get(lv)!;
    const allRooms = L.rooms;
    const ownOf = (sid: string) => {
      const set = new Set<number>();
      for (const r of allRooms.filter(q => q.struct === sid)) for (const k of r.cells) set.add(k);
      return set;
    };
    // passable on this level = any room floor + any door leaf (doors open in play)
    const passable = new Set<number>();
    for (const r of allRooms) for (const k of r.cells) passable.add(k);
    for (const d of L.doors) passable.add(key(d.x, d.y));

    for (const st of plan.structures.filter(q => q.level === lv && !q.open && !q.barrier)) {
      const own = ownOf(st.id);
      if (!own.size) continue;
      const doors = L.doors.filter(d => d.struct === st.id);
      const roomCells = new Set<number>(); for (const k of own) roomCells.add(k);
      for (const d of doors) roomCells.add(key(d.x, d.y));
      const anchor: { label: string; k: number }[] = [];
      for (const r of allRooms.filter(q => q.struct === st.id)) anchor.push({ label: `room ${r.name}`, k: r.cells[0] });
      for (const d of doors) anchor.push({ label: `door ${d.label}`, k: key(d.x, d.y) });
      for (const st2 of L.stairs) {
        const a = st2.from === lv ? [st2.x, st2.y] : st2.to === lv ? [st2.tx, st2.ty] : null;
        if (a && roomCells.has(key(a[0], a[1]))) anchor.push({ label: `stair ${st2.label}`, k: key(a[0], a[1]) });
      }
      for (const c of L.loot) if (roomCells.has(key(c.x, c.y))) anchor.push({ label: `cache ${c.label}`, k: key(c.x, c.y) });
      if (!anchor.length) continue;
      const seen = new Set<number>([anchor[0].k]); const q = [anchor[0].k];
      for (let h = 0; h < q.length; h++) {
        const k = q[h], [x, y] = unkey(k);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = key(x + dx, y + dy);
          if (roomCells.has(nk) && !seen.has(nk)) { seen.add(nk); q.push(nk); }
        }
      }
      for (const a of anchor) if (!seen.has(a.k)) issues.push(`${st.name} @${lv}: ${a.label} is walled off from the entrance`);
      if (!doors.length && lv === 0) issues.push(`${st.name} @${lv}: no door`);

      if (lv === 0) {
        for (const d of doors.filter(q => q.kind === 'main' || q.kind === 'service' || q.kind === 'hatch')) {
          const [x, y] = [d.x, d.y];
          const inner = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => own.has(key(x + dx, y + dy)));
          if (!inner) issues.push(`${st.name}: door "${d.label}" has no interior side`);
          const outer = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
            const nk = key(x + dx, y + dy);
            return !own.has(nk) && passable.has(nk);
          });
          if (!outer) issues.push(`${st.name}: door "${d.label}" does not open onto paved ground`);
        }
      }
    }

    if (lv === 0) {
      const solid: number[] = [];
      for (const st of plan.structures.filter(q => q.level === 0 && !q.open && !q.barrier)) {
        for (const r of allRooms.filter(q => q.struct === st.id)) solid.push(r.cells[0]);
        for (const d of L.doors.filter(q => q.struct === st.id)) solid.push(key(d.x, d.y));
      }
      for (const st2 of L.stairs) { const a = st2.from === 0 ? [st2.x, st2.y] : st2.to === 0 ? [st2.tx, st2.ty] : null; if (a) solid.push(key(a[0], a[1])); }
      for (const c of L.loot) solid.push(key(c.x, c.y));
      const seen = new Set<number>([solid[0]]); const q = [solid[0]];
      for (let h = 0; h < q.length; h++) {
        const k = q[h], [x, y] = unkey(k);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = key(x + dx, y + dy);
          if (passable.has(nk) && !seen.has(nk)) { seen.add(nk); q.push(nk); }
        }
      }
      for (const k of solid) if (!seen.has(k)) { const [x, y] = unkey(k); issues.push(`ground level: ${x},${y} is cut off from the compound entrance`); }
    }

    // every stair landing has floor on its own level and a neighbouring floor to stand on
    for (const s of plan.stairs) {
      const a = levels.get(s.from), b2 = levels.get(s.to);
      if (!a || !b2) { issues.push(`stair ${s.label}: missing level`); continue; }
      for (const [L2, x, y, side] of [[a, s.x, s.y, 'lower'], [b2, s.tx, s.ty, 'upper']] as [CompiledLevel, number, number, string][]) {
        if (L2.tiles.get(key(x, y)) === T.PWALL) issues.push(`stair ${s.label}: ${side} landing is a wall`);
        const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => L2.tiles.get(key(x + dx, y + dy)) === T.FLOOR);
        if (!near) issues.push(`stair ${s.label}: no floor beside the ${side} landing`);
      }
    }
    // every cache stands on real floor
    for (const c of L.loot) if (L.tiles.get(key(c.x, c.y)) !== T.FLOOR) issues.push(`cache ${c.label} @${lv}: not on a floor tile`);
  }

  for (const L of levels.values()) {
    L.rooms.sort((a, b) => (a.open ? 2 : a.secret ? 1 : 0) - (b.open ? 2 : b.secret ? 1 : 0));
  }
  return { plan, levels, bounds: plan.bounds, issues };
}

export function roomAt(c: CompiledPlan, level: Level, gx: number, gy: number): CompiledRoom | null {
  const L = c.levels.get(level); if (!L) return null;
  for (const r of L.rooms) if (inRects(r.rects, gx, gy)) return r;
  return null;
}
