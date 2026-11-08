/**
 * VEYRA05 MULTI-LEVEL POI RUNTIME.
 *
 * The live engine is a single-plane 200x200 world. Rather than fork it, a POI
 * compound is compiled into FLOOR LAYERS and the active layer is installed into
 * the same authoritative arrays the engine already reads (tiles / zone / masks /
 * buildings / statics / sources). Everything else — collision, roof occlusion,
 * doors, containers, saves, offline settlement — keeps using the real engine.
 *
 *  · levels: -1 cellar/adit, 0 ground, 1 upper storey, 2 roof deck
 *  · off-plan cells on an upper level stay visible as the ground far below but
 *    are non-walkable, so you cannot step off a gallery into thin air
 *  · source deltas and door states are archived per floor, so a chest opened in
 *    the cellar is still open when you come back down, and saves stay valid
 */
import { T, TILE, WW, WH, uid, type GameState, type RunState, type Entity } from '../game/core';
import type { Building, StaticEnt, World } from '../game/world';
import { FRAME_W, type WindowSpec } from './frame';
import { sampleTile } from './reader';
import { compilePlan, roomAt, type ArchPlan, type CompiledPlan, type CompiledRoom, type Level, type StairSpec } from './arch/plan';
import { AUTHORED_SITES } from './arch/sites';
import { detailInteriors } from './arch/interior';
import type { WindowWorld } from './window';

const N = WW * WH;
const cache = new Map<string, CompiledPlan>();
export function authoredPlan(poi: string): CompiledPlan | null {
  if (!AUTHORED_SITES[poi]) return null;
  let c = cache.get(poi);
  if (!c) { c = compilePlan(AUTHORED_SITES[poi]()); cache.set(poi, c); }
  return c;
}
export const authoredPoiIds = () => Object.keys(AUTHORED_SITES);

export interface FloorLayer {
  level: Level;
  tiles: Uint8Array; zone: Uint8Array; walkable: Uint8Array; protectedCells: Uint8Array; buildable: Uint8Array;
  sources: (string | null)[];
  buildings: Building[]; statics: StaticEnt[]; lootStatics: StaticEnt[]; rooms: CompiledRoom[]; stairs: StairSpec[];
  props: { x: number; y: number; kind: string }[];
  notes: { x: number; y: number; text: string }[];
  plan: ArchPlan | null;
}
export interface FloorStack { levels: Level[]; layers: Map<Level, FloorLayer>; pois: string[]; ground: FloorLayer }

const dry = (gx: number, gy: number) => { const s = sampleTile(gx, gy); return s.land && !s.river && !s.lake; };

/** Build every floor layer for one window from the authored plans it contains. */
export function buildFloorStack(ww: WindowWorld): FloorStack {
  const { win, world } = ww;
  const base = world;
  const plans = ww.poiIds.map(authoredPlan).filter((p): p is CompiledPlan => !!p);
  const levelsSet = new Set<Level>([0]);
  for (const c of plans) for (const lv of c.plan.levels) levelsSet.add(lv);
  const levels = [...levelsSet].sort((a, b) => a - b);
  const layers = new Map<Level, FloorLayer>();

  for (const lv of levels) {
    const tiles = Uint8Array.from(base.tiles);
    const zone = Uint8Array.from(base.zone);
    const walkable = Uint8Array.from(base.economyMap.walkable);
    const prot = Uint8Array.from(base.economyMap.protected);
    const build = Uint8Array.from(base.economyMap.buildable);
    const sources: (string | null)[] = lv === 0 ? base.sourceV3.slice() : new Array(N).fill(null);
    const buildings: Building[] = lv === 0 ? base.buildings.slice() : [];
    const statics: StaticEnt[] = lv === 0 ? base.statics.slice() : [];
    const rooms: CompiledRoom[] = []; const stairs: StairSpec[] = [];
    const props: { x: number; y: number; kind: string }[] = [];
    const notes: { x: number; y: number; text: string }[] = [];
    const lootStatics: StaticEnt[] = [];

    if (lv !== 0) {
      // upper / lower storeys: the ground stays visible below, but is not standable
      walkable.fill(0); build.fill(0);
      for (let i = 0; i < N; i++) prot[i] = 1;
    }

    for (const c of plans) {
      const L = c.levels.get(lv); if (!L) continue;
      const [ox, oy] = [win.originTx, win.originTy];
      for (const [gk, t] of L.tiles) {
        const gx = gk % FRAME_W, gy = (gk / FRAME_W) | 0;
        const x = gx - ox, y = gy - oy;
        if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1) continue;
        if (!dry(gx, gy) && t !== T.FLOOR) continue;       // GOLD water is never paved over
        if (!dry(gx, gy)) continue;
        const i = y * WW + x;
        tiles[i] = t; zone[i] = L.stone.has(gk) ? 7 : 0;
        sources[i] = null;
        walkable[i] = t === T.PWALL ? 0 : 1;
        prot[i] = 1; build[i] = 0;
      }
      for (const r of L.rooms) {
        const [rx, ry, rw, rh] = r.bbox;
        const x0 = Math.max(0, rx - ox), y0 = Math.max(0, ry - oy);
        const x1 = Math.min(WW, rx + rw - ox), y1 = Math.min(WH, ry + rh - oy);
        if (x1 <= x0 || y1 <= y0) continue;
        rooms.push({ ...r, bbox: [x0, y0, x1 - x0, y1 - y0], rects: r.rects.map(([a, b, w, h]) => [a - ox, b - oy, w, h] as [number, number, number, number]) });
        if (r.hazard) for (const [a, b, w, h] of r.rects) for (let y = b; y < b + h; y++) for (let x = a; x < a + w; x++) {
          const lx = x - ox, ly = y - oy; if (lx >= 0 && ly >= 0 && lx < WW && ly < WH) zone[ly * WW + lx] = 7;
        }
        // one roof per room rect: L/T/U plans keep their real silhouette
        if (r.roof) for (const [a, b, w, h] of r.rects) {
          const bx = Math.max(0, a - ox), by = Math.max(0, b - oy);
          const bx1 = Math.min(WW, a + w - ox), by1 = Math.min(WH, b + h - oy);
          if (bx1 > bx && by1 > by) buildings.push({ id: `${r.id}:${a},${b}`, name: r.name, x: bx, y: by, w: bx1 - bx, h: by1 - by, roof: r.roof });
        }
      }
      for (const d of L.doors) {
        const x = d.x - ox, y = d.y - oy;
        if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1 || !dry(d.x, d.y)) continue;
        if (d.kind === 'arch') { tiles[y * WW + x] = T.FLOOR; walkable[y * WW + x] = 1; continue; }
        tiles[y * WW + x] = T.PWALL; walkable[y * WW + x] = 0;
        statics.push({ kind: 'door', tx: x, ty: y, poi: d.poi, label: d.label });
      }
      for (const s of L.stairs) {
        const here = s.from === lv ? [s.x, s.y] : [s.tx, s.ty];
        const x = here[0] - ox, y = here[1] - oy;
        if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1) continue;
        tiles[y * WW + x] = T.FLOOR; walkable[y * WW + x] = 1;
        stairs.push(s);
      }
      for (const c2 of L.loot) {
        const x = c2.x - ox, y = c2.y - oy;
        if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1 || !dry(c2.x, c2.y)) continue;
        tiles[y * WW + x] = T.FLOOR; walkable[y * WW + x] = 1;
        lootStatics.push({ kind: 'loot', tx: x, ty: y, poi: c2.poi, label: c2.label, loot: c2.items });
      }
      for (const p of L.props) {
        const x = p.x - ox, y = p.y - oy;
        if (x >= 0 && y >= 0 && x < WW && y < WH && dry(p.x, p.y)) props.push({ x, y, kind: p.kind });
      }
      for (const n of L.notes) {
        const x = n.x - ox, y = n.y - oy;
        if (x >= 0 && y >= 0 && x < WW && y < WH && dry(n.x, n.y)) notes.push({ x, y, text: n.text });
      }
    }
    const built: FloorLayer = { level: lv, tiles, zone, walkable, protectedCells: prot, buildable: build, sources, buildings, statics, lootStatics, rooms, stairs, props, notes, plan: plans[0]?.plan ?? null };
    if (plans.length) detailInteriors(built);
    layers.set(lv, built);
  }
  return { levels, layers, pois: plans.map(p => p.plan.poi), ground: layers.get(0)! };
}

/* ───────────────────────── runtime state ───────────────────────── */

export const activeFloor = (r: RunState): Level => ((r as any).veyraFloor ?? 0) as Level;
export const entityFloor = (e: Entity): Level => ((e as any).floor ?? 0) as Level;
export const onActiveFloor = (r: RunState, e: Entity) => entityFloor(e) === activeFloor(r);

function archiveFloorState(r: RunState) {
  const lv = activeFloor(r);
  const store = ((r as any).veyraFloorState ??= {});
  const s = (store[lv] ??= { sources: {}, doors: {} });
  s.sources = { ...r.sources };
  for (const e of Object.values(r.entities)) if (e.kind === 'door' && e.tx !== undefined && entityFloor(e) === lv) s.doors[`${e.tx},${e.ty}`] = !!e.open;
}

/** Install a floor layer into the authoritative world arrays and move the player. */
export function applyFloor(gs: GameState, ww: WindowWorld, stack: FloorStack, level: Level, moveTo?: [number, number], markDirtyFn?: () => void): boolean {
  const r = gs.run; if (!r) return false;
  const layer = stack.layers.get(level); if (!layer) return false;
  archiveFloorState(r);
  const w: World = ww.world;
  w.tiles.set(layer.tiles);
  w.zone.set(layer.zone);
  (w.economyMap.walkable as Uint8Array).set(layer.walkable);
  (w.economyMap.protected as Uint8Array).set(layer.protectedCells);
  (w.economyMap.buildable as Uint8Array).set(layer.buildable);
  for (let i = 0; i < N; i++) w.sourceV3[i] = layer.sources[i];
  w.buildings = layer.buildings;
  w.statics = r.qaUsed ? layer.statics.concat(layer.lootStatics) : layer.statics.slice();
  (r as any).veyraFloor = level;

  const store = (r as any).veyraFloorState?.[level];
  r.sources = store?.sources ? { ...store.sources } : {};
  for (const k of Object.keys(r.sources)) if (!w.sourceV3[+k]) delete r.sources[+k];

  // instantiate this floor's authored statics once; preserve prior door/loot state
  for (const s of w.statics) {
    const exists = Object.values(r.entities).some(e => e.tx === s.tx && e.ty === s.ty && e.kind === s.kind && entityFloor(e) === level);
    if (exists) continue;
    const e: Entity = { id: uid(r, 'e'), kind: s.kind as any, x: s.tx * TILE + 8, y: s.ty * TILE + 8, tx: s.tx, ty: s.ty, poi: s.poi, label: s.label };
    (e as any).floor = level;
    if (s.kind === 'door') { e.open = !!store?.doors?.[`${s.tx},${s.ty}`]; }
    if (s.kind === 'loot') {
      const c = { id: uid(r, 'c'), kind: 'loot', slots: Array(8).fill(null) as any };
      s.loot!.forEach(([k, q], i) => {
        c.slots[i] = k.startsWith('blueprint:')
          ? { uid: uid(r, 's'), key: 'blueprint', qty: 1, meta: k.slice(10) }
          : { uid: uid(r, 's'), key: k, qty: q };
      });
      r.custody[c.id] = c; e.c = c.id;
    }
    r.entities[e.id] = e;
  }
  if (moveTo) { r.player.x = moveTo[0] * TILE + 8; r.player.y = moveTo[1] * TILE + 8; }
  markDirtyFn?.();
  return true;
}

/** Restore the saved floor after load / window slide (idempotent). */
export function syncFloor(gs: GameState, ww: WindowWorld, stack: FloorStack, markDirtyFn?: () => void) {
  const r = gs.run; if (!r) return;
  const lv = activeFloor(r);
  if (!stack.layers.has(lv)) { (r as any).veyraFloor = 0; }
  const target = activeFloor(r);
  const layer = stack.layers.get(target)!;
  const w = ww.world;
  if (w.tiles[0] === layer.tiles[0] && w.buildings === layer.buildings) return;
  const store = ((r as any).veyraFloorState ??= {});
  store[target] ??= { sources: { ...r.sources }, doors: {} };
  w.tiles.set(layer.tiles); w.zone.set(layer.zone);
  (w.economyMap.walkable as Uint8Array).set(layer.walkable);
  (w.economyMap.protected as Uint8Array).set(layer.protectedCells);
  (w.economyMap.buildable as Uint8Array).set(layer.buildable);
  for (let i = 0; i < N; i++) w.sourceV3[i] = layer.sources[i];
  w.buildings = layer.buildings; w.statics = layer.statics;
  markDirtyFn?.();
}

export function stairAt(stack: FloorStack, r: RunState, tx: number, ty: number): StairSpec | null {
  const layer = stack.layers.get(activeFloor(r)); if (!layer) return null;
  const ox = Math.round((r.sourceMap?.veyra?.originAu?.[0] ?? 0) / 0.5);
  const oy = Math.round((r.sourceMap?.veyra?.originAu?.[1] ?? 0) / 0.5);
  for (const s of layer.stairs) {
    const here = s.from === activeFloor(r) ? [s.x, s.y] : [s.tx, s.ty];
    if (here[0] - ox === tx && here[1] - oy === ty) return s;
  }
  return null;
}

export function currentRoom(stack: FloorStack, r: RunState): CompiledRoom | null {
  const layer = stack.layers.get(activeFloor(r)); if (!layer) return null;
  const tx = Math.floor(r.player.x / TILE), ty = Math.floor(r.player.y / TILE);
  for (const room of layer.rooms) if (room.rects.some(([x, y, w, h]) => tx >= x && tx < x + w && ty >= y && ty < y + h)) return room;
  return null;
}

export function storeyLabel(stack: FloorStack, r: RunState): string {
  const lv = activeFloor(r);
  const room = currentRoom(stack, r);
  if (room) return `${room.name} · ${room.storey}`;
  return lv === -1 ? 'Below ground' : lv === 0 ? 'Ground level' : lv === 1 ? 'Upper storey' : 'Roof deck';
}

export { roomAt };
export type { Level, StairSpec, CompiledRoom, WindowSpec };
