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
 *  · source deltas, door states, and depleted loot are archived per floor & globally,
 *    so a chest opened in the cellar stays open/depleted when you return, and saves stay valid
 */
import { BAL, T, TILE, WW, WH, uid, hash2, type GameState, type RunState, type Entity, type Stack, type Container } from '../game/core';
import { ITEMS } from '../game/catalog';
import type { Building, StaticEnt, World } from '../game/world';
import { FRAME_W, U, type WindowSpec } from './frame';
import { sampleTile } from './reader';
import { compilePlan, roomAt, type ArchPlan, type CompiledPlan, type CompiledRoom, type Level, type StairSpec } from './arch/plan';
import { AUTHORED_SITES } from './arch/sites';
import { detailInteriors } from './arch/interior';
import type { WindowWorld } from './window';
import { syncVeyraEcosystemActors } from './ecosystem';
import { cleanupPrimordialBoss } from '../game/primordials/host-bridge';

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
  /** Physical collision footprint mask for non-decal architectural props & POI landmarks (1 = solid obstacle, 0 = passable). Kept separate from `walkable` so `mapDigest(world)` stays backward-compatible across saves. */
  solidProps: Uint8Array;
  sources: (string | null)[];
  buildings: Building[]; statics: StaticEnt[]; lootStatics: StaticEnt[]; rooms: CompiledRoom[]; stairs: StairSpec[];
  props: { x: number; y: number; kind: string }[];
  notes: { x: number; y: number; text: string }[];
  plan: ArchPlan | null;
}

/** Explicit non-solid ground decals, flat floor clutter, overhead hangings, and stair/ramp overlays. */
export const VEYRA_NON_SOLID_PROP_KINDS: ReadonlySet<string> = new Set([
  'rug', 'floor_wear', 'pier_shadow', 'bones', 'rubble', 'water_pool',
  'chain_hoist', 'banner', 'stair_up', 'stair_down', 'lookout', 'screen_mesh',
  'c01_city_banner', 'c01_cargo_hook', 'c01_white_salt_pan', 'c01_roof_dormer',
  'c02_chain_gantry', 'c02_steel_truss', 'c02_heat_grate', 'c02_tide_gate',
  'c04_rope_pulley', 'c04_signal', 'c04_tide_gate', 'c04_torn_notice',
  'c04_splinter_pile', 'c04_crow', 'c04_algae_sluice', 'c04_tern', 'signal_flag',
  'f03_gauge_panel', 'f03_glass_spoil', 'f03_ore_ramp', 'f03_sawdust',
  'f03_steel_gate', 'f03_chain_rail', 'f03_slag_pool',
  'elder_blue_rune',
]);

/** Explicit solid physical props (furniture, masonry wells, industrial machinery, stacks, carts & sanctuary monoliths). */
export const VEYRA_SOLID_PROP_KINDS: ReadonlySet<string> = new Set([
  'well', 'sundial', 'lantern', 'bench', 'bollard', 'market_stall', 'tree_stump', 'c04_quay_sign',
  'bed', 'table', 'shelf', 'bookshelf', 'desk', 'safe', 'hearth', 'lectern', 'orrery', 'telescope', 'map_table',
  'barrel_stack', 'crate_stack', 'grain_sack', 'smoke_rack', 'net_rack', 'fish_drying_rack', 'gear_rack', 'rope_coil',
  'c04_feather_basket', 'c04_bollard', 'c04_lamp', 'c04_broken_post', 'c04_warning', 'c04_reed_screen',
  'boat_hull', 'cart_broken', 'ore_cart',
  'forge', 'furnace_big', 'anvil', 'coal_pile', 'ore_pile', 'ingot_stack', 'pipes', 'crane_controls', 'pump',
  'c01_arched_gate', 'c01_canopy_market', 'c01_quay_lamp', 'c01_mooring', 'c01_rope_cart', 'c01_brine_pipe',
  'c02_ore_tipple', 'c02_rail_wagon', 'c02_industrial_chimney', 'c02_ore_bins', 'c02_warning_lamp', 'c02_counterweight',
  'f03_charcoal_rick', 'f03_chimney', 'f03_condenser', 'f03_crane', 'f03_crusher', 'f03_filter_tank',
  'f03_geo_manifold', 'f03_kiln_vat', 'f03_log_cradle', 'f03_ore_seam', 'f03_pipe_bundle', 'f03_rust_pipe',
  'f03_sawframe', 'f03_screen', 'f03_signal_lamp', 'f03_silo', 'f03_spoil_heap', 'f03_timber_pile',
  'f03_turbine', 'f03_valve', 'f03_vent_pipe', 'f03_waterwheel',
  'elder_surtur_forge', 'elder_surtur_spire', 'elder_typhon_shard', 'elder_typhon_pillar',
  'elder_aion_root', 'elder_aion_rune', 'elder_atlas_gate', 'elder_atlas_anchor',
  'elder_argus_eye', 'elder_argus_pillar', 'elder_anubis_sarc', 'elder_anubis_pylon',
]);

const fpRect = (x0: number, x1: number, y0: number, y1: number): readonly [number, number][] => {
  const out: [number, number][] = [];
  for (let dy = y0; dy <= y1; dy++) for (let dx = x0; dx <= x1; dx++) out.push([dx, dy]);
  return out;
};
const FP_1X1: readonly [number, number][] = [[0, 0]];

/** Authoritative physical tile footprints (`[dx, dy]` relative to prop anchor `(p.x, p.y)`) matching `decor-client` sprite bases (`X = tx*16 + 8 - (w>>1), Y = ty*16 + 15 - h`). */
export const VEYRA_PROP_SOLID_FOOTPRINTS: Readonly<Record<string, readonly [number, number][]>> = {
  // 7×2 monumental gate pedestal (124×135 px)
  elder_atlas_gate: fpRect(-3, 3, -1, 0),
  // 5×2 Primordial sanctuary monolith cores (102–112 px wide)
  elder_aion_root: fpRect(-2, 2, -1, 0),
  elder_surtur_forge: fpRect(-2, 2, -1, 0),
  elder_typhon_shard: fpRect(-2, 2, -1, 0),
  elder_argus_eye: fpRect(-2, 2, -1, 0),
  // 3×2 deep masonry / tank / sarcophagus bases (42–60 px wide × deep base)
  elder_anubis_pylon: fpRect(-1, 1, -1, 0),
  elder_anubis_sarc: fpRect(-1, 1, -1, 0),
  furnace_big: fpRect(-1, 1, -1, 0),
  f03_crusher: fpRect(-1, 1, -1, 0),
  f03_kiln_vat: fpRect(-1, 1, -1, 0),
  f03_condenser: fpRect(-1, 1, -1, 0),
  f03_silo: fpRect(-1, 1, -1, 0),
  f03_filter_tank: fpRect(-1, 1, -1, 0),
  // Split stone arch piers with walkable central archway (58×48 px)
  c01_arched_gate: [[-1, 0], [1, 0]],
  // 3×1 wide hulls, stalls, sanctuary pillars & industrial machinery (36–68 px wide)
  elder_aion_rune: fpRect(-1, 1, 0, 0),
  elder_argus_pillar: fpRect(-1, 1, 0, 0),
  elder_atlas_anchor: fpRect(-1, 1, 0, 0),
  elder_surtur_spire: fpRect(-1, 1, 0, 0),
  elder_typhon_pillar: fpRect(-1, 1, 0, 0),
  boat_hull: fpRect(-1, 1, 0, 0),
  market_stall: fpRect(-1, 1, 0, 0),
  c01_canopy_market: fpRect(-1, 1, 0, 0),
  c01_rope_cart: fpRect(-1, 1, 0, 0),
  c01_brine_pipe: fpRect(-1, 1, 0, 0),
  c02_ore_tipple: fpRect(-1, 1, 0, 0),
  c02_rail_wagon: fpRect(-1, 1, 0, 0),
  c02_industrial_chimney: fpRect(-1, 1, 0, 0),
  c02_ore_bins: fpRect(-1, 1, 0, 0),
  c02_counterweight: fpRect(-1, 1, 0, 0),
  c04_reed_screen: fpRect(-1, 1, 0, 0),
  fish_drying_rack: fpRect(-1, 1, 0, 0),
  f03_turbine: fpRect(-1, 1, 0, 0),
  f03_waterwheel: fpRect(-1, 1, 0, 0),
  f03_pipe_bundle: fpRect(-1, 1, 0, 0),
  f03_rust_pipe: fpRect(-1, 1, 0, 0),
  f03_log_cradle: fpRect(-1, 1, 0, 0),
  f03_timber_pile: fpRect(-1, 1, 0, 0),
  f03_sawframe: fpRect(-1, 1, 0, 0),
  f03_spoil_heap: fpRect(-1, 1, 0, 0),
  f03_ore_seam: fpRect(-1, 1, 0, 0),
  f03_screen: fpRect(-1, 1, 0, 0),
  f03_crane: fpRect(-1, 1, 0, 0),
  f03_charcoal_rick: fpRect(-1, 1, 0, 0),
  f03_chimney: fpRect(-1, 1, 0, 0),
  f03_geo_manifold: fpRect(-1, 1, 0, 0),
};

export const isSolidVeyraProp = (kind: string): boolean =>
  VEYRA_SOLID_PROP_KINDS.has(kind) && !VEYRA_NON_SOLID_PROP_KINDS.has(kind);

export const getSolidPropFootprint = (kind: string): readonly [number, number][] =>
  isSolidVeyraProp(kind) ? (VEYRA_PROP_SOLID_FOOTPRINTS[kind] ?? FP_1X1) : [];

export interface LayerPlacementContext {
  solid: Uint8Array;
  doorCells: Set<number>;
  protectedThreshold: Set<number>;
  exactStaticOrStair: Set<number>;
  isPassable: (tx: number, ty: number) => boolean;
  canPlaceProceduralSolidProp: (x: number, y: number, kind: string) => boolean;
  stampProceduralSolidProp: (x: number, y: number, kind: string) => boolean;
}

function buildLayerPlacementContext(layer: FloorLayer, ox: number, oy: number): LayerPlacementContext {
  const solid = new Uint8Array(N);
  const doorCells = new Set<number>();
  const protectedThreshold = new Set<number>();
  const exactStaticOrStair = new Set<number>();

  for (const s of layer.statics) {
    const si = s.ty * WW + s.tx;
    exactStaticOrStair.add(si);
    protectedThreshold.add(si);
    if (s.kind === 'door') {
      doorCells.add(si);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = s.tx + dx, ny = s.ty + dy;
        if (nx >= 0 && ny >= 0 && nx < WW && ny < WH) protectedThreshold.add(ny * WW + nx);
      }
    }
  }
  for (const st of layer.stairs) {
    const here = st.from === layer.level ? [st.x - ox, st.y - oy] : [st.tx - ox, st.ty - oy];
    const sx = here[0], sy = here[1];
    if (sx < 0 || sy < 0 || sx >= WW || sy >= WH) continue;
    const si = sy * WW + sx;
    exactStaticOrStair.add(si);
    protectedThreshold.add(si);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = sx + dx, ny = sy + dy;
      if (nx >= 0 && ny >= 0 && nx < WW && ny < WH) protectedThreshold.add(ny * WW + nx);
    }
  }

  const isPassable = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return false;
    const i = ty * WW + tx;
    if (solid[i]) return false;
    if (doorCells.has(i)) return true;
    const t = layer.tiles[i];
    if (t === T.DEEP || t === T.RIVER || t === T.CLIFF || t === T.PWALL || t === T.LAVA) return false;
    return layer.walkable[i] === 1;
  };

  // Authoritative authored props (`L.props`) stamp their FULL multi-tile footprint atomically across
  // every non-static, non-stair cell (including cells abutting walls/cliffs/water/natural tufts)
  // so 0 partial footprints occur and 100% of authored props render with full collision.
  for (const p of layer.props) {
    const fp = getSolidPropFootprint(p.kind);
    if (!fp.length) continue;
    const blockedByStaticOrStair = fp.some(([dx, dy]) => {
      const cx = p.x + dx, cy = p.y + dy;
      return cx < 0 || cy < 0 || cx >= WW || cy >= WH || exactStaticOrStair.has(cy * WW + cx);
    });
    if (blockedByStaticOrStair) continue;
    for (const [dx, dy] of fp) {
      solid[(p.y + dy) * WW + (p.x + dx)] = 1;
    }
  }

  const wouldSeverFootprint = (cells: readonly [number, number][]): boolean => {
    let minFx = WW, maxFx = 0, minFy = WH, maxFy = 0;
    for (const [cx, cy] of cells) {
      solid[cy * WW + cx] = 1;
      if (cx < minFx) minFx = cx;
      if (cx > maxFx) maxFx = cx;
      if (cy < minFy) minFy = cy;
      if (cy > maxFy) maxFy = cy;
    }
    const border: [number, number][] = [];
    for (let y = minFy - 1; y <= maxFy + 1; y++) {
      for (let x = minFx - 1; x <= maxFx + 1; x++) {
        if ((x === minFx - 1 || x === maxFx + 1 || y === minFy - 1 || y === maxFy + 1) && isPassable(x, y)) {
          border.push([x, y]);
        }
      }
    }
    if (border.length <= 1) {
      for (const [cx, cy] of cells) solid[cy * WW + cx] = 0;
      return false;
    }
    const pad = 8;
    const minX = Math.max(0, minFx - pad), maxX = Math.min(WW - 1, maxFx + pad);
    const minY = Math.max(0, minFy - pad), maxY = Math.min(WH - 1, maxFy + pad);
    const wSpan = maxX - minX + 1, hSpan = maxY - minY + 1;
    const seen = new Uint8Array(wSpan * hSpan);
    const qx = new Int16Array(wSpan * hSpan);
    const qy = new Int16Array(wSpan * hSpan);
    let head = 0, tail = 0;
    qx[tail] = border[0][0]; qy[tail] = border[0][1]; tail++;
    seen[(border[0][1] - minY) * wSpan + (border[0][0] - minX)] = 1;
    let reached = 1;
    while (head < tail) {
      const x = qx[head], y = qy[head]; head++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        const si = (ny - minY) * wSpan + (nx - minX);
        if (seen[si] || !isPassable(nx, ny)) continue;
        seen[si] = 1;
        qx[tail] = nx; qy[tail] = ny; tail++;
      }
    }
    reached = 0;
    for (const [bx, by] of border) {
      if (seen[(by - minY) * wSpan + (bx - minX)]) reached++;
    }
    for (const [cx, cy] of cells) solid[cy * WW + cx] = 0;
    return reached < border.length;
  };

  const canPlaceProceduralSolidProp = (x: number, y: number, kind: string): boolean => {
    const fp = getSolidPropFootprint(kind);
    if (!fp.length) return true;
    const cells: [number, number][] = [];
    for (const [dx, dy] of fp) {
      const cx = x + dx, cy = y + dy;
      if (cx <= 1 || cy <= 1 || cx >= WW - 2 || cy >= WH - 2) return false;
      const i = cy * WW + cx;
      if (solid[i] || protectedThreshold.has(i) || layer.sources[i] || !isPassable(cx, cy)) return false;
      cells.push([cx, cy]);
    }
    return !wouldSeverFootprint(cells);
  };

  const stampProceduralSolidProp = (x: number, y: number, kind: string): boolean => {
    const fp = getSolidPropFootprint(kind);
    if (!fp.length) return true;
    if (!canPlaceProceduralSolidProp(x, y, kind)) return false;
    for (const [dx, dy] of fp) {
      solid[(y + dy) * WW + (x + dx)] = 1;
    }
    return true;
  };

  return {
    solid,
    doorCells,
    protectedThreshold,
    exactStaticOrStair,
    isPassable,
    canPlaceProceduralSolidProp,
    stampProceduralSolidProp,
  };
}
export interface FloorStack { levels: Level[]; layers: Map<Level, FloorLayer>; pois: string[]; ground: FloorLayer }

const dry = (gx: number, gy: number) => { const s = sampleTile(gx, gy); return s.land && !s.river && !s.lake; };

const RCASH_BY_POI: Record<string, number> = {
  po_rc_meridian: 45,
  po_rc_ironvein: 45,
  po_rc_kestrel: 40,
  po_rc_dam: 50,
  po_rc_sandgate: 45,
  po_rc_salt: 50,
};
const VENDOR_POIS = new Set(['po_vend_gulf', 'po_vend_strait']);
const EVAC_POIS = new Set(['po_evac_west', 'po_evac_south', 'po_evac_hook']);
const ELDER_POIS = new Set<string>(['po_elderwood', 'po_necropolis', 'po_hall_eyes', 'po_gate', 'po_surtur', 'po_typhon']);

const ARCHETYPE_LOOT: readonly [string, number][][] = [
  [['scrap', 6], ['rope', 2], ['bandage', 2]],
  [['cloth', 4], ['spares', 3], ['torch', 1]],
  [['iron_ore', 5], ['coal', 4], ['fasteners', 2]],
  [['rope', 3], ['treated_canvas', 1], ['herb', 3]],
  [['scrap', 5], ['mechanical_parts', 1], ['bandage', 2]],
  [['iron_ingot', 2], ['fasteners', 3], ['fuel_can', 1]],
  [['seed', 4], ['berries', 4], ['cloth', 3]],
  [['arrow', 8], ['bandage', 2], ['blueprint:bow', 1]],
  [['spares', 4], ['field_repair_kit', 1], ['torch', 1]],
  [['herb', 4], ['medkit', 1], ['blueprint:stew', 1]],
  [['cloth', 4], ['rope', 2], ['blueprint:leather_armor', 1]],
  [['coal', 5], ['scrap', 5], ['blueprint:fur_cloak', 1]],
  [['spares', 3], ['mechanical_parts', 1], ['blueprint:gas_mask', 1]],
];

interface GlobalExtraStatic {
  lv: Level;
  gx: number;
  gy: number;
  spec: Omit<StaticEnt, 'tx' | 'ty'>;
}
const extraCache = new Map<string, GlobalExtraStatic[]>();

function globalExtraStatics(c: CompiledPlan): GlobalExtraStatic[] {
  const id = c.plan.poi;
  const hit = extraCache.get(id);
  if (hit) return hit;
  const out: GlobalExtraStatic[] = [];
  if (ELDER_POIS.has(id)) { extraCache.set(id, out); return out; }
  const L0 = c.levels.get(0);
  if (!L0) { extraCache.set(id, out); return out; }

  const avoid = new Set<number>();
  const markNear = (gx: number, gy: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) avoid.add((gy + dy) * FRAME_W + (gx + dx));
  };
  for (const d of L0.doors) markNear(d.x, d.y, 1);
  for (const s of L0.stairs) { markNear(s.x, s.y, 1); markNear(s.tx, s.ty, 1); }
  for (const l of L0.loot) markNear(l.x, l.y, 0);
  const propsAt = new Set<number>();
  for (const p of L0.props) {
    const fp = getSolidPropFootprint(p.kind);
    if (fp.length) {
      for (const [dx, dy] of fp) propsAt.add((p.y + dy) * FRAME_W + (p.x + dx));
    } else {
      propsAt.add(p.y * FRAME_W + p.x);
    }
  }

  const pickCell = (preferOpen: boolean): [number, number] | null => {
    const orderedRooms = [...L0.rooms].sort((a, b) => (preferOpen ? (a.roof ? 1 : 0) - (b.roof ? 1 : 0) : (b.roof ? 1 : 0) - (a.roof ? 1 : 0)));
    for (const pass of [0, 1]) {
      for (const rm of orderedRooms) {
        for (const [rx, ry, rw, rh] of rm.rects) {
          const cx = rx + rw / 2, cy = ry + rh / 2;
          let best: [number, number] | null = null, bestD = Infinity;
          for (let gy = ry + 1; gy < ry + rh - 1; gy++) {
            for (let gx = rx + 1; gx < rx + rw - 1; gx++) {
              const gk = gy * FRAME_W + gx;
              if (L0.tiles.get(gk) !== T.FLOOR || !dry(gx, gy) || avoid.has(gk)) continue;
              if (pass === 0 && propsAt.has(gk)) continue;
              const d = Math.hypot(gx - cx, gy - cy);
              if (d < bestD) { bestD = d; best = [gx, gy]; }
            }
          }
          if (best) return best;
        }
      }
    }
    for (const [gk, t] of L0.tiles) {
      if (t !== T.FLOOR || avoid.has(gk)) continue;
      const gx = gk % FRAME_W, gy = (gk / FRAME_W) | 0;
      if (dry(gx, gy)) return [gx, gy];
    }
    return null;
  };

  if (RCASH_BY_POI[id] !== undefined) {
    const cell = pickCell(false);
    if (cell) out.push({ lv: 0, gx: cell[0], gy: cell[1], spec: { kind: 'cash', poi: id, label: c.plan.title, cash: RCASH_BY_POI[id] } });
  } else if (VENDOR_POIS.has(id)) {
    const cell = pickCell(false);
    if (cell) out.push({ lv: 0, gx: cell[0], gy: cell[1], spec: { kind: 'vendor', poi: id, label: c.plan.title } });
  } else if (EVAC_POIS.has(id)) {
    const cell = pickCell(true);
    if (cell) out.push({ lv: 0, gx: cell[0], gy: cell[1], spec: { kind: 'evac', poi: id, label: c.plan.title } });
  } else if ([...c.levels.values()].every(lev => lev.loot.length === 0)) {
    const cell = pickCell(false);
    if (cell) {
      let h = 2166136261;
      for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
      const idx = Math.floor(hash2(cell[0], cell[1], h) * ARCHETYPE_LOOT.length) % ARCHETYPE_LOOT.length;
      const items = ARCHETYPE_LOOT[idx].map(([k, q]) => [k, q] as [string, number]);
      out.push({ lv: 0, gx: cell[0], gy: cell[1], spec: { kind: 'loot', poi: id, label: `${c.plan.title} Cache`, loot: items } });
    }
  }
  extraCache.set(id, out);
  return out;
}

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
    const statics: StaticEnt[] = [];
    const occupiedStatic = new Set<number>();
    for (const bs of (lv === 0 ? base.statics : [])) {
      const li = bs.ty * WW + bs.tx;
      if (!occupiedStatic.has(li)) { occupiedStatic.add(li); statics.push(bs); }
    }
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
        const li = y * WW + x;
        if (occupiedStatic.has(li)) continue;
        occupiedStatic.add(li);
        tiles[li] = T.PWALL; walkable[li] = 0; sources[li] = null;
        statics.push({ kind: 'door', tx: x, ty: y, poi: d.poi, label: d.label });
      }
      for (const s of L.stairs) {
        const here = s.from === lv ? [s.x, s.y] : [s.tx, s.ty];
        const x = here[0] - ox, y = here[1] - oy;
        if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1) continue;
        const li = y * WW + x;
        tiles[li] = T.FLOOR; walkable[li] = 1; sources[li] = null;
        occupiedStatic.add(li);
        stairs.push(s);
      }
      for (const c2 of L.loot) {
        const x = c2.x - ox, y = c2.y - oy;
        if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1 || !dry(c2.x, c2.y)) continue;
        const li = y * WW + x;
        if (occupiedStatic.has(li)) continue;
        occupiedStatic.add(li);
        tiles[li] = T.FLOOR; walkable[li] = 1; sources[li] = null;
        const st: StaticEnt = { kind: 'loot', tx: x, ty: y, poi: c2.poi, label: c2.label, loot: c2.items };
        lootStatics.push(st);
        statics.push(st);
      }
      for (const ex of globalExtraStatics(c)) {
        if (ex.lv !== lv) continue;
        const x = ex.gx - ox, y = ex.gy - oy;
        if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1 || !dry(ex.gx, ex.gy)) continue;
        const li = y * WW + x;
        if (occupiedStatic.has(li)) continue;
        occupiedStatic.add(li);
        tiles[li] = T.FLOOR; walkable[li] = 1; sources[li] = null;
        const st: StaticEnt = { ...ex.spec, tx: x, ty: y };
        if (st.kind === 'loot') lootStatics.push(st);
        statics.push(st);
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
    const built: FloorLayer = { level: lv, tiles, zone, walkable, protectedCells: prot, buildable: build, solidProps: new Uint8Array(N), sources, buildings, statics, lootStatics, rooms, stairs, props, notes, plan: plans[0]?.plan ?? null };
    const ctx = buildLayerPlacementContext(built, win.originTx, win.originTy);
    if (plans.length) detailInteriors(built, ctx);
    if (lv === 0) {
      for (const lm of ww.landmarks) {
        ctx.stampProceduralSolidProp(lm.tx, lm.ty, lm.kind);
      }
    }
    built.solidProps = ctx.solid;
    layers.set(lv, built);
  }
  return { levels, layers, pois: plans.map(p => p.plan.poi), ground: layers.get(0)! };
}

/* ───────────────────────── runtime state ───────────────────────── */

export const activeFloor = (r: RunState): Level => (r.veyraFloor ?? 0) as Level;
export const entityFloor = (e: Entity): Level => ((e as any).floor ?? 0) as Level;
export const onActiveFloor = (r: RunState, e: Entity) => entityFloor(e) === activeFloor(r);

function makeValidStack(r: RunState, rawKey: string, qty: number): Stack {
  const isBp = rawKey.startsWith('blueprint:');
  const key = isBp ? 'blueprint' : rawKey;
  const meta = isBp ? rawKey.slice(10) : undefined;
  const d = ITEMS[key];
  const s: Stack = { uid: uid(r, 's'), key, qty: isBp ? 1 : qty };
  if (d?.creatorCore) s.reserves = { basic: 0, refined: 0, signature: 0 };
  if (d?.dur) s.dur = d.dur;
  if (d?.charge) s.charge = d.initialCharge ?? d.charge;
  if (key === 'keycard' && s.qty === 1 && r.poiAccessVersion === 'poi-access-v1') s.charge = BAL.poiAccess.cardUses;
  if (meta) s.meta = meta;
  return s;
}

export function instantiateVeyraStatic(r: RunState, s: StaticEnt, level: Level, doorOpen = false): Entity {
  const e: Entity = {
    id: uid(r, 'e'),
    kind: s.kind as any,
    x: s.tx * TILE + 8,
    y: s.ty * TILE + 8,
    tx: s.tx,
    ty: s.ty,
    poi: s.poi,
    label: s.label,
  };
  (e as any).floor = level;
  if (s.kind === 'door') {
    e.locked = s.locked;
    e.open = doorOpen;
  } else if (s.kind === 'loot') {
    const c: Container = { id: uid(r, 'c'), kind: 'loot', slots: Array(8).fill(null) };
    (s.loot || []).forEach(([k, q], i) => {
      if (i < c.slots.length) c.slots[i] = makeValidStack(r, k, q);
    });
    r.custody[c.id] = c;
    e.c = c.id;
  } else if (s.kind === 'cash') {
    const c: Container = { id: uid(r, 'c'), kind: 'cash', slots: Array(2).fill(null) };
    r.custody[c.id] = c;
    e.c = c.id;
    e.minted = false;
    e.stock = { cash: s.cash! };
  } else if (s.kind === 'gen') {
    e.power = 0;
  }
  return e;
}

export function syncDepletedLootToGlobal(r: RunState, ox: number, oy: number, lv: Level, statics: StaticEnt[]) {
  const gDep = (r.veyraGlobalDepletedLoot ??= {});
  const localDep = new Set(r.depletedLootSites || []);
  for (const s of statics) {
    if (s.kind !== 'loot') continue;
    const li = s.ty * WW + s.tx;
    const gk = `${lv}:${ox + s.tx}:${oy + s.ty}`;
    if (localDep.has(li)) {
      gDep[gk] = r.lootRespawnAt?.[li] ?? 0;
    } else {
      delete gDep[gk];
    }
  }
}

export function projectDepletedLootFromGlobal(r: RunState, ox: number, oy: number, lv: Level, statics: StaticEnt[]) {
  const gDep = r.veyraGlobalDepletedLoot;
  if (!gDep) {
    delete r.depletedLootSites;
    delete r.lootRespawnAt;
    return;
  }
  const dep: number[] = [];
  const timers: Record<number, number> = {};
  for (const s of statics) {
    if (s.kind !== 'loot') continue;
    const gk = `${lv}:${ox + s.tx}:${oy + s.ty}`;
    if (gk in gDep) {
      const li = s.ty * WW + s.tx;
      dep.push(li);
      if (gDep[gk] >= r.startedAt) timers[li] = gDep[gk];
    }
  }
  if (dep.length) r.depletedLootSites = dep;
  else delete r.depletedLootSites;
  if (Object.keys(timers).length) r.lootRespawnAt = timers;
  else delete r.lootRespawnAt;
}

function runOrigin(r: RunState): [number, number] {
  const o = r.sourceMap?.veyra?.originAu;
  return o ? [Math.round(o[0] / U), Math.round(o[1] / U)] : [0, 0];
}

function archiveFloorState(r: RunState, ww: WindowWorld) {
  const lv = activeFloor(r);
  const [ox, oy] = runOrigin(r);
  const curLayer = ww.floors.layers.get(lv);
  if (curLayer) syncDepletedLootToGlobal(r, ox, oy, lv, curLayer.statics);
  const store = (r.veyraFloorState ??= {});
  const s = (store[lv] ??= { sources: {}, doors: {} });
  s.sources = { ...r.sources };
  for (const e of Object.values(r.entities)) {
    if (e.kind === 'door' && e.tx !== undefined && entityFloor(e) === lv) {
      s.doors[`${e.tx},${e.ty}`] = !!e.open;
    }
  }
}

/** Install a floor layer into the authoritative world arrays and move the player. */
export function applyFloor(gs: GameState, ww: WindowWorld, stack: FloorStack, level: Level, moveTo?: [number, number], markDirtyFn?: () => void): boolean {
  const r = gs.run; if (!r) return false;
  const prevLevel = activeFloor(r);
  if (r.player.vehicle && (level !== prevLevel || moveTo)) return false;
  const layer = stack.layers.get(level); if (!layer) return false;
  if (level !== prevLevel) {
    r.player.pulling = null;
    if (r.spiritTransit) delete r.spiritTransit;
    if (r.dragonDive) delete r.dragonDive;
  }
  archiveFloorState(r, ww);
  const w: World = ww.world;
  w.tiles.set(layer.tiles);
  w.zone.set(layer.zone);
  (w.economyMap.walkable as Uint8Array).set(layer.walkable);
  (w.economyMap.protected as Uint8Array).set(layer.protectedCells);
  (w.economyMap.buildable as Uint8Array).set(layer.buildable);
  for (let i = 0; i < N; i++) w.sourceV3[i] = layer.sources[i];
  w.buildings = layer.buildings;
  w.statics = layer.statics.slice();
  r.veyraFloor = level;

  const store = r.veyraFloorState?.[level];
  r.sources = store?.sources ? { ...store.sources } : {};
  for (const k of Object.keys(r.sources)) if (!w.sourceV3[+k]) delete r.sources[+k];

  const [ox, oy] = runOrigin(r);
  projectDepletedLootFromGlobal(r, ox, oy, level, w.statics);
  const depleted = new Set(r.depletedLootSites || []);

  // Instantiate this floor's authored statics once; preserve prior door/loot/cash state
  for (const s of w.statics) {
    if (s.kind === 'loot' && depleted.has(s.ty * WW + s.tx)) continue;
    const exists = Object.values(r.entities).some(e => e.tx === s.tx && e.ty === s.ty && e.kind === s.kind && entityFloor(e) === level);
    if (exists) continue;
    const doorOpen = s.kind === 'door' ? !!store?.doors?.[`${s.tx},${s.ty}`] : false;
    const e = instantiateVeyraStatic(r, s, level, doorOpen);
    r.entities[e.id] = e;
  }
  if (moveTo) { r.player.x = moveTo[0] * TILE + 8; r.player.y = moveTo[1] * TILE + 8; }
  cleanupPrimordialBoss(r, undefined, 'floor transition');
  syncVeyraEcosystemActors(r, ww, ox, oy, ox, oy);
  markDirtyFn?.();
  return true;
}

/** Restore the saved floor after load / window slide (idempotent). */
export function syncFloor(gs: GameState, ww: WindowWorld, stack: FloorStack, markDirtyFn?: () => void) {
  const r = gs.run; if (!r) return;
  const lv = activeFloor(r);
  if (!stack.layers.has(lv)) r.veyraFloor = 0;
  const target = activeFloor(r);
  const layer = stack.layers.get(target)!;
  const w = ww.world;
  if (w.tiles[0] === layer.tiles[0] && w.buildings === layer.buildings && w.statics.length === layer.statics.length) return;
  const store = (r.veyraFloorState ??= {});
  store[target] ??= { sources: { ...r.sources }, doors: {} };
  w.tiles.set(layer.tiles); w.zone.set(layer.zone);
  (w.economyMap.walkable as Uint8Array).set(layer.walkable);
  (w.economyMap.protected as Uint8Array).set(layer.protectedCells);
  (w.economyMap.buildable as Uint8Array).set(layer.buildable);
  for (let i = 0; i < N; i++) w.sourceV3[i] = layer.sources[i];
  w.buildings = layer.buildings;
  w.statics = layer.statics.slice();
  markDirtyFn?.();
}

export function stairAt(stack: FloorStack, r: RunState, tx: number, ty: number): StairSpec | null {
  const layer = stack.layers.get(activeFloor(r)); if (!layer) return null;
  const [ox, oy] = runOrigin(r);
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
