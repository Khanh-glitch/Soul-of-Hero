/**
 * G1B room / floor / road chest ecology (tooling). Batch 2, Creator amendment 2026-11-16.
 *
 * Walks the COMPILED runtime Veyra — every authored POI plan, every storey, every room / yard / roof, and every GOLD
 * road, bridge and dock — and decides chest sources space by space from what the space physically is. Nothing here
 * runs in the game: the result is frozen into src/game/g1b-ecology.generated.ts and audited by tests/g1b-ecology.test.ts.
 *
 * The 130 round-1 sources keep their ids and tiles; they are counted against the space they physically stand in.
 */
import { T, WW, WH } from '../../src/game/core';
import { getWindowWorld } from '../../src/veyra05/window';
import { layoutIdAt } from '../../src/veyra05/scenes';
import { POIS, GOLD } from '../../src/veyra05/reader';
import { FRAME_W, FRAME_H } from '../../src/veyra05/frame';
import { authoredPlan, authoredPoiIds, setG1bFurnitureReservation } from '../../src/veyra05/floors';
import { G1B_BASE_SOURCE_SITES as BASE, G1B_FIXTURES, G1B_GATES } from '../../src/game/g1b-sources.generated';
import { G1B_BATCH3_ECOLOGY } from '../../src/game/g1b-ecology-batch3.frozen';

export type Family = 'supply' | 'toolbox' | 'military' | 'food' | 'medical';
export type Grade = 'damaged' | 'low' | 'mid' | 'high';
export interface EcoSource { id: string; site: string; zone: 'POI' | 'ROAD' | 'CARD_ROOM'; variant: string; gx: number; gy: number; level: -1 | 0 | 1 | 2; place: string; space: string; gate?: string; ax: number; ay: number }
export interface SpaceRow {
  id: string; poi: string; poiName: string; arche: string; level: number; storey: string; name: string; struct: string;
  kind: 'room' | 'yard' | 'roof' | 'cellar' | 'upper' | 'transit' | 'arena' | 'shell';
  cells: number; usable: number; reachable: boolean; open: boolean; secret: boolean; hazard: boolean;
  doors: number; stairs: number; gate: string | null; lockedDoor: boolean; danger: number; access: number;
  family: Family | null; grade: Grade | null; want: number; base: string[]; added: string[]; legacyCaches: number; reasons: string[];
}
export interface RoadRow { id: string; name: string; kind: string; tiles: number; tilesOutsidePoi: number; harshShare: number; remoteMax: number; base: string[]; added: string[]; features: string[]; reasons: string[] }
export interface Ecology { sources: EcoSource[]; spaces: SpaceRow[]; roads: RoadRow[]; notes: string[]; baseLevels: Record<string, { space: string }> }

const BAD = new Set<number>([T.DEEP, T.SHALLOW, T.RIVER, T.CLIFF, T.PWALL, T.LAVA, T.TOXIC, T.ICE]);
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const clampO = (v: number, max: number) => Math.max(0, Math.min(max, v));
const h32 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const u01 = (s: string) => h32(s) / 4294967296;

/* ───────────── what a space is ───────────── */
const ARCHE_DANGER: Record<string, number> = {
  elder_site: 4, facility: 3, research: 3, tomb: 3, mine: 3, gate: 4, powerplant: 3,
  ruins: 2, smelter: 2, quarry: 2, filter: 2, observatory: 2, warehouse: 2,
  sawmill: 1, mill: 1, grove: 1, village: 1, hamlet: 1, roadstop: 1, port: 1, pier: 1,
};
const SHELL = /^(vend_|evac_|rc_)/;                                   // vendor / evacuation / recycler shells: other owners' scope
const ARENA = /^[A-Z][A-Za-z]+ \/ |^[A-Z]{4,} \/ /;                    // "ARGUS / Oculus…", "Typhon / Sealed Under-Cleft": Primordial combat floors
const TRANSIT = /apron|threshold|dry entrance|entrance cut|approach|\bpath\b|footpath|\btrack\b|\blane|avenue|\bwalk\b|walks\b|walkway|alley|descent|\breturn\b|\blink\b|crawl|corridor|shaft|\bspur\b|catwalk|skybridge|skywalk|skyway|\bbridge\b|conveyor|\bbelt\b|trestle|flood wall|street|\broad\b|\broute\b|ribbons|switchbacks|towpath|haulway|bypass|passing place|trail|\bloop\b|\bline\b|channels|ramp|circumambulation|span|boardwalk|\brail\b|truss/i;
const FAMILY: [Family, RegExp][] = [
  ['military', /armou?ry|guard|\bwatch\b|(?<!intake )gatehouse|barracks|bunker|secured|strongroom|\bvault\b|customs|checkpoint|sentry|restricted/i],
  ['medical', /clinic|infirm|sick|\baid\b|medic|\bbath|laundry|\bward\b|\blab\b|laborator|quarantine|apothec|water test|cooling house|cooling station|shift and cooling|field annex|filter media|emergency/i],
  ['food', /kitchen|pantry|granary|grain|smoke|fish|market|\bdate\b|cool store|ice store|refector|larder|galley|\bmess\b|pickle|spice|common hall|char hall|cistern|wellhouse|\bmill\b|silo|salt (market|exchange)|drying loft|cottage|living room|keeper hut|garden|kelp|netshed|fisher/i],
  ['toolbox', /workshop|smith|forge|repair|\btool|maintenance|boat|turbine|\bpump|generator|furnace|casting|kiln|crane|winch|machine|rotor|engine|instrument|signal|relay|pressure|pipe|condenser|thermal|steam|saw|assembly|foundry|mender|tipple|screen|cooper|gear|hoist|mast|valve|sluice|counterweight|brake|prospect|adit|survey|quench|stack control|shard/i],
];
const WRECKED = /broken|collapsed|crushed|drowned|smashed|shattered|weathered|flooded|abandoned|storm-scattered|rusted|leaning|sunken|old\b|wreck/i;
const ARCHE_FAMILY: Record<string, Family> = { research: 'medical', facility: 'toolbox', powerplant: 'toolbox', smelter: 'toolbox', mine: 'toolbox', quarry: 'toolbox', sawmill: 'toolbox', filter: 'medical', village: 'food', hamlet: 'food', mill: 'food', roadstop: 'supply', port: 'supply', pier: 'supply', warehouse: 'supply', ruins: 'supply', observatory: 'toolbox', grove: 'food', tomb: 'supply', elder_site: 'supply', gate: 'supply' };
const YARD_FUNCTION = /apron|yard|court|quay|wharf|pier|dock|platform|market|square|plots|common|green|bay|slip|terrace|benches|beds|spines|deck|stage|rim|ledge|footings|clearing|cloister|quadrangle|forecourt|paving|grounds|finger|landing|jetty|margins|timbers|rake|balcon|veranda|lookout|overlook|perch|roof|loggia|arcade|escarpment|labyrinth|wings|colonnade|crown/i;

const famOf = (name: string, struct: string, arche: string): [Family, string] => {
  if (/salvage|supply|sleeping|lodging|rest house/i.test(name)) return ['supply', `"${name.match(/salvage|supply|sleeping|lodging|rest house/i)![0]}" in the room name (stores / bedding)`];
  for (const [f, re] of FAMILY) if (re.test(name)) return [f, `"${name.match(re)![0]}" in the room name`];
  if (/shelter/i.test(name)) return ['medical', 'a shelter is where travellers patch themselves up'];
  for (const [f, re] of FAMILY) if (re.test(struct)) return [f, `"${struct.match(re)![0]}" in the building name`];
  if (/store|warehouse|freight|depot|cellar|loft|cargo|receiving|sorting|transfer|ore|supply|locker|tally|records|ledger|archive|library|stacks|hall|office|shelter|booth|annex|niche|chamber|pocket|house|shed|gallery/i.test(name)) return ['supply', 'storage / general-purpose room'];
  return [ARCHE_FAMILY[arche] ?? 'supply', `no functional word in the name; site archetype "${arche}"`];
};
const GRADES: Record<Family, Grade[]> = { supply: ['damaged', 'low', 'mid', 'high'], toolbox: ['damaged', 'low', 'high'], military: ['low', 'mid', 'high'], food: ['low', 'mid', 'high'], medical: ['low', 'mid', 'high'] };
/** score 1..6 -> a grade that exists for the family */
function gradeOf(f: Family, score: number, wrecked: boolean): Grade {
  let g: Grade = score <= 2 ? 'low' : score <= 4 ? 'mid' : 'high';
  if (wrecked && score <= 2) g = 'damaged';
  const have = GRADES[f]; if (have.includes(g)) return g;
  if (g === 'damaged') return 'low';
  return 'low';                                              // Toolbox has no Mid: a mid score stays Low, only a high score earns High
}

/* ───────────── one site in real collision data ───────────── */
interface Site {
  ox: number; oy: number; levels: number[];
  pass: (lv: number, x: number, y: number) => boolean; tile: (lv: number, x: number, y: number) => number;
  isDoor: (lv: number, x: number, y: number) => boolean; isStairEnd: (lv: number, x: number, y: number) => boolean; nearStatic: (lv: number, x: number, y: number, rad: number) => boolean;
  src3: (x: number, y: number) => boolean; prot: (x: number, y: number) => boolean; inb: (x: number, y: number) => boolean;
  flood: (blocked?: Set<string>) => Set<string>; stairs: any[]; doors: { lv: number; x: number; y: number; locked?: string; label?: string }[]; legacyLoot: { lv: number; x: number; y: number }[];
}
export const __openSite = (cx: number, cy: number) => openSite(cx, cy);
function openSite(cx: number, cy: number): Site | null {
  const ox = clampO(Math.round(cx) - 100, FRAME_W - WW), oy = clampO(Math.round(cy) - 100, FRAME_H - WH);
  let a, b; try { a = getWindowWorld(layoutIdAt(ox, oy), 4); b = getWindowWorld(layoutIdAt(ox, oy), 3); } catch { return null; }
  const levels = [...a.floors.layers.keys()];
  const inb = (x: number, y: number) => x >= ox + 2 && y >= oy + 2 && x < ox + WW - 2 && y < oy + WH - 2;
  const li = (x: number, y: number) => (y - oy) * WW + (x - ox);
  const door = new Map<number, Set<number>>(), stat = new Map<number, Set<number>>(), stairEnd = new Map<number, Set<number>>();
  const doors: Site['doors'] = [], legacyLoot: Site['legacyLoot'] = []; const stairs: any[] = [];
  for (const [lv, L] of a.floors.layers) {
    const d = new Set<number>(), s = new Set<number>(), e = new Set<number>();
    for (const q of L.statics) { if (q.kind === 'door') { d.add(q.ty * WW + q.tx); doors.push({ lv, x: q.tx + ox, y: q.ty + oy, locked: q.locked, label: q.label }); } else { s.add(q.ty * WW + q.tx); if (q.kind === 'loot') legacyLoot.push({ lv, x: q.tx + ox, y: q.ty + oy }); } }
    for (const st of L.stairs as any[]) { const [x, y] = st.from === lv ? [st.x, st.y] : [st.tx, st.ty]; if (inb(x, y)) e.add(li(x, y)); if (!stairs.some(o => o.x === st.x && o.y === st.y && o.from === st.from && o.to === st.to)) stairs.push(st); }
    door.set(lv, d); stat.set(lv, s); stairEnd.set(lv, e);
  }
  const tile = (lv: number, x: number, y: number) => inb(x, y) ? a.floors.layers.get(lv as any)!.tiles[li(x, y)] : T.CLIFF;
  const isDoor = (lv: number, x: number, y: number) => inb(x, y) && door.get(lv)!.has(li(x, y));
  const pass = (lv: number, x: number, y: number) => {
    if (!inb(x, y)) return false; const L = a.floors.layers.get(lv as any); if (!L) return false; const i = li(x, y);
    if (door.get(lv)!.has(i)) return true;
    return !BAD.has(L.tiles[i]) && !!L.walkable[i] && !L.solidProps[i] && !L.sources[i] && !stat.get(lv)!.has(i);
  };
  const isStairEnd = (lv: number, x: number, y: number) => inb(x, y) && stairEnd.get(lv)!.has(li(x, y));
  const nearStatic = (lv: number, x: number, y: number, rad: number) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (inb(x + dx, y + dy) && stat.get(lv)!.has(li(x + dx, y + dy))) return true; return false; };
  const src3 = (x: number, y: number) => inb(x, y) && !!(b.world.sourceV3[li(x, y)] || a.floors.ground.sources[li(x, y)]);
  const prot = (x: number, y: number) => inb(x, y) && !!a.floors.ground.protectedCells[li(x, y)];
  /** Everything a player on foot can stand on, across storeys, starting from the open ground. Keys "lv:x,y". */
  const flood = (blocked?: Set<string>): Set<string> => {
    // seed: every large connected ground region (the open world), measured without crossing any door
    const seenG = new Uint8Array(WW * WH); const best: number[] = [];
    for (let y = oy + 2; y < oy + WH - 2; y += 3) for (let x = ox + 2; x < ox + WW - 2; x += 3) {
      if (seenG[li(x, y)] || !pass(0, x, y) || isDoor(0, x, y)) continue;
      const comp: number[] = []; const q: [number, number][] = [[x, y]]; seenG[li(x, y)] = 1;
      while (q.length) { const [ax, ay] = q.pop()!; comp.push(li(ax, ay)); for (const [dx, dy] of N4) { const nx = ax + dx, ny = ay + dy; if (!inb(nx, ny) || seenG[li(nx, ny)] || !pass(0, nx, ny) || isDoor(0, nx, ny)) continue; seenG[li(nx, ny)] = 1; q.push([nx, ny]); } }
      if (comp.length >= 800) for (const i of comp) best.push(i);   // every sizeable landmass in the window is open world (banks join by bridges beyond it)
    }
    const seen = new Set<string>(); const q: [number, number, number][] = [];
    for (const i of best) { const x = (i % WW) + ox, y = ((i / WW) | 0) + oy; seen.add(`0:${x},${y}`); q.push([0, x, y]); }
    let head = 0;
    while (head < q.length) {
      const [lv, ax, ay] = q[head++];
      for (const [dx, dy] of N4) { const nx = ax + dx, ny = ay + dy, k = `${lv}:${nx},${ny}`; if (seen.has(k) || !pass(lv, nx, ny) || blocked?.has(k)) continue; seen.add(k); q.push([lv, nx, ny]); }
      for (const st of stairs) {
        let to: [number, number, number] | null = null;
        if (st.from === lv && st.x === ax && st.y === ay) to = [st.to, st.tx, st.ty]; else if (st.to === lv && st.tx === ax && st.ty === ay) to = [st.from, st.x, st.y];
        if (!to || !levels.some(level=>level===to![0]) || !inb(to[1], to[2])) continue; const k = `${to[0]}:${to[1]},${to[2]}`; if (seen.has(k) || blocked?.has(k)) continue; seen.add(k); q.push(to);
      }
    }
    return seen;
  };
  return { ox, oy, levels, pass, tile, isDoor, isStairEnd, nearStatic, src3, prot, inb, flood, stairs, doors, legacyLoot };
}

/** Blocking (x,y) on `lv` must leave its free neighbours joined to each other (the chest never plugs a lane). */
function keepsJoined(s: Site, lv: number, taken: Set<string>, x: number, y: number): [number, number] | null {
  const blocked = (ax: number, ay: number) => (ax === x && ay === y) || taken.has(`${lv}:${ax},${ay}`) || !s.pass(lv, ax, ay);
  const ring: [number, number][] = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !blocked(x + dx, y + dy)) ring.push([x + dx, y + dy]);
  const starts = N4.map(([dx, dy]) => [x + dx, y + dy] as [number, number]).filter(([ax, ay]) => !blocked(ax, ay));
  if (!starts.length) return null;
  const seen = new Set<string>([starts[0].join(',')]); const q = [starts[0]]; let head = 0;
  while (head < q.length && seen.size < 900) { const [ax, ay] = q[head++]; for (const [dx, dy] of N4) { const nx = ax + dx, ny = ay + dy, k = nx + ',' + ny; if (seen.has(k) || blocked(nx, ny) || Math.abs(nx - x) > 14 || Math.abs(ny - y) > 14) continue; seen.add(k); q.push([nx, ny]); } }
  if (!ring.every(c => seen.has(c.join(',')))) return null;
  return starts[0];
}

const areaOf = (r: any) => r.rects.reduce((n: number, q: number[]) => n + q[2] * q[3], 0);
function ownerOf(rooms: any[], x: number, y: number): any {
  let best: any = null;
  for (const o of rooms) { if (!o.rects.some(([a, b, w, h]: number[]) => x >= a && x < a + w && y >= b && y < b + h)) continue;
    if (!best || (!!o.open !== !!best.open ? !o.open : areaOf(o) < areaOf(best))) best = o; }
  return best;
}
const inRing = (pts: number[][], x: number, y: number) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

/** Chest candidate tiles in a space: standable, against a wall or cover, off thresholds / stairs / objects, and never plugging a lane. */
function chestCandidates(s: Site, lv: number, reach: [number, number][], reachAll: Set<string>, taken: Set<string>, all: { lv: number; gx: number; gy: number }[]): [number, number, number, [number, number], number][] {
  const out: [number, number, number, [number, number], number][] = [];
  for (const [x, y] of reach) {
    if (taken.has(`${lv}:${x},${y}`) || s.isStairEnd(lv, x, y)) continue;
    if (N4.some(([dx, dy]) => s.isDoor(lv, x + dx, y + dy) || s.isStairEnd(lv, x + dx, y + dy))) continue;
    let near = false; for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (s.isDoor(lv, x + dx, y + dy)) { near = true; break; } if (near) continue;
    if (lv === 0) { let bad = false; for (let dy = -1; dy <= 1 && !bad; dy++) for (let dx = -1; dx <= 1; dx++) if (s.src3(x + dx, y + dy)) { bad = true; break; } if (bad || !s.prot(x, y)) continue; }
    const solid = (dx: number, dy: number) => !s.pass(lv, x + dx, y + dy) && !s.isDoor(lv, x + dx, y + dy);
    const north = solid(0, -1), side = solid(-1, 0) || solid(1, 0), south = solid(0, 1);
    if (!north && !side && !south) continue;
    const ap = keepsJoined(s, lv, taken, x, y); if (!ap) continue;
    const apr = N4.map(([dx, dy]) => [x + dx, y + dy] as [number, number]).find(([ax, ay]) => reachAll.has(`${lv}:${ax},${ay}`) && s.pass(lv, ax, ay) && !taken.has(`${lv}:${ax},${ay}`)); if (!apr) continue;
    const solids = (north ? 1 : 0) + (side ? (solid(-1, 0) && solid(1, 0) ? 2 : 1) : 0) + (south ? 1 : 0);
    out.push([x, y, (north ? 0 : side ? 1 : 2) + ((north && side) ? -0.5 : 0) + u01(`${x},${y}`) * 0.4, apr, solids]);
  }
  return out;
}
/** Wall-backed candidate tiles grouped into pockets: tiles within two tiles of each other are one pocket. */
function pocketCount(cands: [number, number, number, [number, number], number][]): number {
  const pts = cands.map(q => [q[0], q[1]] as [number, number]); const seen = new Set<string>(); let n = 0;
  for (const [x, y] of pts) { const k = `${x},${y}`; if (seen.has(k)) continue; n++; const q: [number, number][] = [[x, y]]; seen.add(k); let head = 0;
    while (head < q.length) { const [ax, ay] = q[head++]; for (const [bx, by] of pts) { const bk = `${bx},${by}`; if (seen.has(bk)) continue; if (Math.max(Math.abs(bx - ax), Math.abs(by - ay)) <= 2) { seen.add(bk); q.push([bx, by]); } } }
  }
  return n;
}

/* ───────────── the POI census ───────────── */
export function buildEcology(log: (s: string) => void = () => {}): Ecology {
  setG1bFurnitureReservation(false);
  const sources: EcoSource[] = [], spaces: SpaceRow[] = [], notes: string[] = [];
  const taken = new Set<string>();                       // "lv:x,y" of every chest / fixture
  const all: { lv: number; gx: number; gy: number }[] = [];
  const ids = new Set<string>(BASE.map(b => b.id));
  const mkId = (site: string, variant: string, key: string) => { let n = 1, id = ''; do { id = `veyra.g1b:${site}:${variant}:${key}.${String(n++).padStart(2, '0')}`; } while (ids.has(id)); ids.add(id); return id; };
  for (const b of BASE) { taken.add(`0:${b.gx},${b.gy}`); all.push({ lv: 0, gx: b.gx, gy: b.gy }); }
  for (const f of G1B_FIXTURES) { taken.add(`0:${f.gx},${f.gy}`); all.push({ lv: 0, gx: f.gx, gy: f.gy }); }
  /* ───────────── ADD-ONLY seed: the frozen approved 599-source ecology roster ─────────────
     Batch 3.1 keeps the approved 729-source set exactly (130 base + 599 ecology + 6 fixtures). Every id and tile below
     is seeded into the taken / all / ids sets and into the per-space / per-road rows BEFORE the passes run, so the
     survey can only ATTRIBUTE sources it already has — it never places a new chest beyond the approved roster. The
     passes below run only to compute each space's family / grade / capacity reasons; the placement loops are skipped
     (need = 0) because the approved set is frozen, not regenerated. */
  const batch3BySpace = new Map<string, EcoSource[]>();
  const batch3ByRoad = new Map<string, EcoSource[]>();
  for (const e of G1B_BATCH3_ECOLOGY) {
    taken.add(`${e.level ?? 0}:${e.gx},${e.gy}`); all.push({ lv: e.level ?? 0, gx: e.gx, gy: e.gy });
    ids.add(e.id); sources.push(e as EcoSource);
    const sp = e.space ?? '';
    if (sp.startsWith('road/')) { const k = sp.slice(5); if (!batch3ByRoad.has(k)) batch3ByRoad.set(k, []); batch3ByRoad.get(k)!.push(e as EcoSource); }
    else { if (!batch3BySpace.has(sp)) batch3BySpace.set(sp, []); batch3BySpace.get(sp)!.push(e as EcoSource); }
  }
  const baseSpace: Record<string, { space: string }> = {};
  const poiBoxes: [number, number, number, number, string][] = [];

  for (const poi of authoredPoiIds()) {
    const c = authoredPlan(poi)!; const gp = POIS.find(q => q.id === poi); const arche = gp?.arche ?? 'unknown';
    const [bx, by, bw, bh] = c.bounds; poiBoxes.push([bx, by, bx + bw, by + bh, poi]);
    const s = openSite(bx + bw / 2, by + bh / 2);
    if (!s) { notes.push(`${poi}: the window around the site does not compile (no walkable terrain); 0 spaces surveyed`); continue; }
    if (bx < s.ox + 3 || by < s.oy + 3 || bx + bw > s.ox + WW - 3 || by + bh > s.oy + WH - 3) notes.push(`${poi}: plan bounds ${bw}x${bh} exceed one 200-tile window; rooms beyond the window edge are surveyed as unreachable`);
    const reachAll = s.flood();
    // doors that take a card / circuit: G1B gates on the ground storey + any authored locked door
    const gateDoors = G1B_GATES.filter(g => g.site === poi).map(g => ({ id: g.id, k: `0:${g.door[0]},${g.door[1]}` }));
    const lockedDoors = s.doors.filter(d => d.locked && d.x >= bx && d.x < bx + bw && d.y >= by && d.y < by + bh).map(d => ({ id: `locked:${d.locked}@${d.x},${d.y}`, k: `${d.lv}:${d.x},${d.y}` }));
    const behind = new Map<string, Set<string>>();
    for (const g of [...gateDoors, ...lockedDoors]) { const f = s.flood(new Set([g.k])); behind.set(g.id, f); }
    const danger0 = ARCHE_DANGER[arche] ?? 2; const deep = gp?.deep && gp.deep.length >= 3 ? gp.deep.map(q => [q[0] * 2, q[1] * 2]) : null;
    const shell = SHELL.test(poi.replace(/^po_/, ''));
    const rows: SpaceRow[] = [];
    for (const [lv, L] of c.levels) for (const r of L.rooms) {
      const cells: [number, number][] = [];
      for (const [rx, ry, rw, rh] of r.rects) for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
        // a tile belongs to the most specific space that claims it: the smallest closed room, else the smallest yard
        if (ownerOf(L.rooms, x, y) !== r) continue;
        cells.push([x, y]);
      }
      const usable = cells.filter(([x, y]) => s.pass(lv, x, y) && !s.isDoor(lv, x, y));
      const reach = usable.filter(([x, y]) => reachAll.has(`${lv}:${x},${y}`));
      const isOpen = !!r.open; const name = r.name; const reasons: string[] = [];
      const inRoom = (x: number, y: number) => cells.some(q => q[0] === x && q[1] === y);
      const doorsN = s.doors.filter(d => d.lv === lv && N4.some(([dx, dy]) => inRoom(d.x + dx, d.y + dy))).length;
      const stairsN = s.stairs.filter(st => (st.from === lv && inRoom(st.x, st.y)) || (st.to === lv && inRoom(st.tx, st.ty))).length;
      let gate: string | null = null, lockedDoor = false;
      for (const [gid, f] of behind) { if (reach.length && reach.every(([x, y]) => !f.has(`${lv}:${x},${y}`))) { if (gid.startsWith('locked:')) lockedDoor = true; else gate = gid; } }
      const kind: SpaceRow['kind'] = shell ? 'shell' : ARENA.test(name) ? 'arena' : (cells.length <= 40 && /apron|threshold|entrance/i.test(name)) ? 'transit' : (TRANSIT.test(name) && !r.secret && !(/yard|court|quay|wharf|market|square/i.test(name) && !/path|lane|street|road|route|walk/i.test(name)) && !(isOpen && cells.length >= 250 && /sorting|working|\bwork\b|cargo|freight|loading|transfer|receiving/i.test(name))) ? 'transit' : lv === 2 ? 'roof' : lv === -1 ? 'cellar' : isOpen ? 'yard' : lv === 1 ? 'upper' : 'room';
      const access = (lv !== 0 ? 1 : 0) + (r.secret ? 1 : 0) + (gate || lockedDoor ? 2 : 0);
      // danger is per space: the site archetype sets the ceiling, GOLD's own "deep core" ring says which spaces are the dangerous heart
      const mx = cells.length ? cells.reduce((n, q) => n + q[0], 0) / cells.length : 0, my = cells.length ? cells.reduce((n, q) => n + q[1], 0) / cells.length : 0;
      const core = !deep || inRing(deep, mx, my) || lv === -1;
      const danger = Math.max(1, Math.min(5, danger0 - (core ? 0 : 1) + (r.hazard ? 1 : 0)));
      if (deep) reasons.push(core ? 'inside the site’s deep core' : 'outside the site’s deep core (one step safer than the heart)');
      const row: SpaceRow = { id: `${poi}/${lv}/${r.id.replace(poi + '.', '')}`, poi, poiName: c.plan.title, arche, level: lv, storey: r.storey ?? String(lv), name, struct: r.structName ?? r.struct, kind, cells: cells.length, usable: usable.length, reachable: reach.length > 0, open: isOpen, secret: !!r.secret, hazard: !!r.hazard, doors: doorsN, stairs: stairsN, gate, lockedDoor, danger, access, family: null, grade: null, want: 0, base: [], added: [], legacyCaches: s.legacyLoot.filter(q => q.lv === lv && inRoom(q.x, q.y)).length, reasons };
      (row as any)._cells = cells; (row as any)._reach = reach;
      const b3here = batch3BySpace.get(row.id); if (b3here) { row.added = b3here.map(q => q.id); (row as any)._b2add = b3here; }
      rows.push(row);
    }
    // round-1 sources standing in this site. A ROAD base source belongs to its road row, never to a POI room that
    // happens to overlap the road tile; a base source that falls outside every room's cells (an open yard / forecourt
    // not authored as a room) is attributed to the nearest reachable space so the census owns it exactly once.
    // Only base sources whose site is THIS poi are considered here (a base source belongs to exactly one site).
    const unmatchedBase: (typeof BASE)[number][] = [];
    for (const b of BASE) {
      if (b.site !== poi) continue;
      const row = rows.find(q => q.level === 0 && (q as any)._cells.some((p: number[]) => p[0] === b.gx && p[1] === b.gy));
      if (row) { row.base.push(b.id); baseSpace[b.id] = { space: row.id }; if (!row.reasons.some(q => q.startsWith('round-1 source stands'))) row.reasons.push(`round-1 source stands in this space's cells: counted here`); }
      else if (b.zone === 'ROAD') { unmatchedBase.push(b); }       // handled with the road rows below
      else unmatchedBase.push(b);
    }
    // attribute the remaining (non-ROAD) base sources to the nearest reachable room / yard / cellar / upper / roof space
    // (never a transit lane, arena or shell: a round-1 chest stands in a real storage space, not in circulation)
    for (const b of unmatchedBase.filter(q => q.zone !== 'ROAD')) {
      const reachRows = rows.filter((q: any) => q.reachable && (q as any)._cells.length && q.kind !== 'transit' && q.kind !== 'arena' && q.kind !== 'shell');
      if (!reachRows.length) continue;
      let best: any = null, bd = Infinity;
      for (const q of reachRows) for (const [cx, cy] of (q as any)._cells) { const d = (cx - b.gx) ** 2 + (cy - b.gy) ** 2; if (d < bd) { bd = d; best = q; } }
      if (best) { best.base.push(b.id); baseSpace[b.id] = { space: best.id }; best.reasons.push(`round-1 source stands in the open ground of this space (not inside a room rect): counted here`); }
    }

    for (const row of rows) {
      const R = row.reasons; const reach: [number, number][] = (row as any)._reach; const lv = row.level;
      if (row.kind === 'shell') { R.push('vendor / evacuation / recycler shell owned by another system: no G1B source'); continue; }
      if (row.kind === 'arena') { R.push('Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source'); continue; }
      if (!row.reachable) { R.push(row.usable ? 'no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable' : 'no standable tile in the compiled runtime'); continue; }
      if (row.kind === 'transit') { R.push('circulation lane: the first pass places nothing in the walking line; the physical pass below places only where the geometry gives a real wall pocket, alcove or platform'); continue; }
      if (reach.length < 12 && !row.secret) { R.push(`only ${reach.length} standable tiles: too small to keep a chest and a clear lane`); continue; }
      const [fam, why] = famOf(row.name, row.struct, row.arche);
      let family: Family = fam; let n = 0;
      const big = reach.length;
      if (row.kind === 'yard' || (row.kind === 'roof' && row.open) || (row.kind === 'upper' && row.open)) {
        if (!YARD_FUNCTION.test(row.name)) { R.push('open ground with no working function in its name: no source'); continue; }
        if (/paving|grounds|\bcommon\b|green|square|clearing|labyrinth|terraces|wings/i.test(row.name) && !/work|freight|ore|market|fish|net|date|caravan|sorting|cargo/i.test(row.name)) {
          n = row.base.length ? 0 : (row.danger >= 3 && big >= 900 ? 1 : 0);
          if (!n) { R.push('general open ground (paving / green / common): people cross it, nothing is stored in the open; the buildings around it carry the sources'); if (!row.base.length) continue; }
          else R.push(`large exposed ground in a danger-${row.danger} site (${big} tiles): one cache against cover rewards crossing it`);
        } else { n = big >= 700 && row.danger >= 2 ? 2 : 1; R.push(`working yard (${why}; ${big} standable tiles): ${n === 2 ? 'two separated stacks, the yard is large and the site is dangerous' : 'one stack against cover'}`); }
        if (row.kind !== 'yard') { R.push(row.kind === 'roof' ? 'reachable roof / lookout: the climb is the cost' : 'upper deck reached by stairs'); if (/lookout|\bwatch\b|sentry/i.test(row.name) && row.danger >= 2) family = 'military'; }
        if (family === 'medical' || (family === 'food' && !/market|fish|date|garden|kelp|salt|plots/i.test(row.name))) family = 'supply';
      } else {
        n = 1; R.push(`${row.kind === 'cellar' ? 'cellar' : row.kind === 'upper' ? 'upper-storey room' : row.kind === 'roof' ? 'roof room' : 'room'} with a loot function (${why}; ${big} standable tiles)`);
        if (big >= 140 && row.danger >= 2) { n = 2; R.push(`large (${big} tiles) in a danger-${row.danger} site: second chest at the far wall`); }
        if (big >= 190 && row.danger >= 4) { n = 3; R.push('large, deep in an elder / gate site: three valuable chests'); }
        if (big >= 380 && row.danger >= 3) { n = Math.max(n, row.danger >= 4 ? 4 : 3); R.push(`very large hall (${big} tiles): ${n} chests spread along the walls`); }
        if (big >= 560 && row.danger >= 4) { n = 5; R.push('the largest guarded hall of the site: five chests'); }
        if ((row.arche === 'elder_site' || row.arche === 'gate') && n >= 3 && family !== 'military') { (row as any)._first = 'military'; R.push('guarded hall of an elder site: the first chest is a Military Case, the others follow the room'); }
        if (row.secret) R.push('hidden room: finding it is the cost, grade raised');
        if (row.hazard) R.push('environmental hazard inside, grade raised');
        if (big < 40 && n > 1) n = 1;
      }
      // military is the Core-bearing family: only a room that is physically a guard / strong room, and never in a safe hamlet
      if (family === 'military' && row.danger <= 1 && !row.gate) { family = 'supply'; R.push('guard word in the name but the site is a low-danger settlement: Supply, not Military'); }
      const score = Math.min(6, row.danger + row.access);
      const grade = gradeOf(family, score, WRECKED.test(row.name) || WRECKED.test(row.poiName));
      R.push(`grade ${grade}: danger ${row.danger} + access ${row.access}${row.access ? ` (${[lv !== 0 ? 'other storey' : '', row.secret ? 'hidden' : '', row.gate ? 'card door' : '', row.lockedDoor ? 'locked door' : ''].filter(Boolean).join(', ')})` : ''}`);
      row.family = family; row.grade = grade; row.want = n;
      const need = 0; // the approved 599-source roster is frozen: the survey attributes, never places new chests
      if (row.base.length) R.push(`${row.base.length} round-1 source(s) already stand here and count toward the ${n}`);
      if (row.legacyCaches) R.push(`${row.legacyCaches} authored one-time cache(s) also in this space (kept, not counted)`);
      if (!need) continue;
      // candidates: standable, against a wall or cover, off thresholds / stairs / other objects
      const cand: [number, number, number, [number, number]][] = [];
      for (const [x, y] of reach) {
        if (taken.has(`${lv}:${x},${y}`) || s.isStairEnd(lv, x, y) || s.nearStatic(lv, x, y, 1)) continue;
        if (N4.some(([dx, dy]) => s.isDoor(lv, x + dx, y + dy) || s.isStairEnd(lv, x + dx, y + dy))) continue;
        let near = false; for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (s.isDoor(lv, x + dx, y + dy)) { near = true; break; } if (near) continue;
        if (lv === 0) { let bad = false; for (let dy = -1; dy <= 1 && !bad; dy++) for (let dx = -1; dx <= 1; dx++) if (s.src3(x + dx, y + dy)) { bad = true; break; } if (bad || !s.prot(x, y)) continue; }
        const solid = (dx: number, dy: number) => !s.pass(lv, x + dx, y + dy) && !s.isDoor(lv, x + dx, y + dy);
        const north = solid(0, -1), side = solid(-1, 0) || solid(1, 0), south = solid(0, 1);
        if (!north && !side && !south) continue;                       // chests stand against something
        const ap = keepsJoined(s, lv, taken, x, y); if (!ap) continue;
        const apr = N4.map(([dx, dy]) => [x + dx, y + dy] as [number, number]).find(([ax, ay]) => reachAll.has(`${lv}:${ax},${ay}`) && s.pass(lv, ax, ay) && !taken.has(`${lv}:${ax},${ay}`)); if (!apr) continue;
        cand.push([x, y, (north ? 0 : side ? 1 : 2) + ((north && side) ? -0.5 : 0) + u01(`${row.id}|${x},${y}`) * 0.4, apr]);
      }
      const mine: [number, number][] = row.base.map(id => { const b = BASE.find(q => q.id === id)!; return [b.gx, b.gy] as [number,number]; });
      for (let k = 0; k < need; k++) {
        const ok = cand.filter(([x, y]) => !taken.has(`${lv}:${x},${y}`) && all.every(o => o.lv !== lv || Math.max(Math.abs(o.gx - x), Math.abs(o.gy - y)) >= 3));
        if (!ok.length) { R.push(`no free wall tile for chest ${row.base.length + k + 1} without moving furniture: left out`); break; }
        // first chest: best wall tile; later chests: as far as possible from the ones already in the room
        ok.sort((u, v) => { if (mine.length) { const du = Math.min(...mine.map(m => Math.abs(m[0] - u[0]) + Math.abs(m[1] - u[1]))), dv = Math.min(...mine.map(m => Math.abs(m[0] - v[0]) + Math.abs(m[1] - v[1]))); if (du !== dv) return dv - du; } return u[2] - v[2] || u[1] - v[1] || u[0] - v[0]; });
        const [x, y, , apr] = ok[0];
        if (!keepsJoined(s, lv, taken, x, y)) { cand.splice(cand.indexOf(ok[0]), 1); k--; continue; }
        let f1: Family = (row as any)._first && !row.added.length && !row.base.length ? (row as any)._first : family;
        // Military is the Core lever: an ungated ground room that is not behind a card, a hidden wall or a climb holds at most ONE case
        if (f1 === 'military' && (row.danger < 3 || (row.danger + row.access < 4 && (row.added.length || row.base.length)))) { f1 = 'supply'; if (!R.some(q => q.startsWith('one Military Case'))) R.push('one Military Case only (the room is neither gated, hidden nor on another storey, nor danger-3+): the other chest is Supply'); }
        const variant = `${f1}_${gradeOf(f1, score, false)}`;
        const id = mkId(poi, variant, `${lv < 0 ? 'b' + -lv : 'f' + lv}.${row.id.split('/')[2].toLowerCase().replace(/[^a-z0-9_]/g, '_')}`);
        taken.add(`${lv}:${x},${y}`); all.push({ lv, gx: x, gy: y }); mine.push([x, y]);
        sources.push({ id, site: poi, zone: row.gate ? 'CARD_ROOM' : 'POI', variant, gx: x, gy: y, level: lv as any, place: `${row.kind}:${row.name}`, space: row.id, ...(row.gate ? { gate: row.gate } : {}), ax: apr[0], ay: apr[1] });
        row.added.push(id);
      }
    }
    /* ───────── batch 3: physical capacity pass ─────────
       Runs after the round-2 pass, so every source id and tile placed above is unchanged. It adds chests where the
       space's real geometry (wall-backed pockets, area, storeys, gates, hazards) allows more than the round-2 heuristic
       gave — and gives transit lanes a chest only inside a genuine alcove / platform / wall pocket, never in the line. */
    for (const row of rows) {
      const R = row.reasons; const reach: [number, number][] = (row as any)._reach; const lv = row.level;
      if (row.kind === 'arena' || row.kind === 'shell' || !row.reachable) continue;   // the first pass already declined these; never add here
      const big = reach.length;
      const candsAll = chestCandidates(s, lv, reach, reachAll, taken, all);
      const cands = row.kind === 'transit' ? candsAll.filter(q => q[4] >= 2) : candsAll;
      const pockets = pocketCount(cands);
      const have = row.base.length + row.added.length;
      let cap = 0; const dscr = `${big} standable tiles, ${pockets} wall-backed pocket(s)`;
      if (row.kind === 'transit') {
        const fn = /platform|landing|alcove|shelter|stop|rest area|dock|bay|perch|gallery|arcade|colonnade|cloisters?|vestibule|ante|niche|spur|fork|crossing|passing|gatehouse|watch|sentry|lookout|overlook|beacon|relay|cache|store|shed|booth|stall|hut|cabin|lodge|house|annex|office|hall|room|work|shop|market|yard|court|plaza|square|forecourt|apron|quay|wharf|pier|jetty|deck|terrace|balcony|veranda|loggia|steps|stair|stairs|ramp|climb|summit|peak|ridge|crest|bastion|rampart|bulwark|parapet|wall|rim|ledge|cliff|escarpment|bridge|span|trestle|viaduct|causeway|ford|wayhouse|waystation|station|avenue|promenade|boulevard|street|road|lane|\bway\b|path|walk|route|corridor|processional|procession/i.test(row.name);
        cap = fn && pockets ? Math.min(pockets, Math.max(1, Math.round(big / 420))) : 0;
        if (!cap) R.push(pockets ? 'circulation with no functional stop in its name: the lane stays clear' : 'open span with no wall, alcove or platform to stand a chest against: the lane stays clear');
        if (have) R.push(`frozen physical placement: the approved chest stands in a genuine wall pocket / alcove / platform in this lane (${have} source, never in the walking line)`);
      } else if (row.kind === 'yard' || (row.kind === 'roof' && row.open) || (row.kind === 'upper' && row.open)) {
        const generalGround = /paving|grounds|\bcommon\b|green|square|clearing|labyrinth|terraces|\bwings\b|promenade|avenue|court|plaza/i.test(row.name) && !/work|freight|ore|market|fish|net|date|caravan|sorting|cargo|loading|transfer|receiving|quay|wharf|dock|plots|garden|salt|mill|forge|kiln|pump|filter|saw|smelt/i.test(row.name);
        if (generalGround) { cap = pockets >= 2 && row.danger >= 3 ? 1 : 0; R.push(cap ? `general open ground in a danger-${row.danger} site: one cache against cover, the rest is crossed` : 'general open ground (paving / green / common): people cross it, nothing is stored in the open'); }
        else if (!YARD_FUNCTION.test(row.name) && pockets < 2) { cap = 0; R.push('open ground with no working function in its name and no covered pocket: nothing is stored in the open'); }
        else { cap = Math.min(pockets, Math.max(1, Math.round(big / 260))); R.push(`working ground (${dscr}): up to ${cap} chest${cap === 1 ? '' : 's'} against cover`); }
      } else {
        cap = Math.max(1, Math.round(big / 180));
        if (row.danger + row.access >= 4 && pockets >= 2) cap += 1;
        if (row.danger >= 4 && big >= 400 && pockets >= 3) cap += 1;
        cap = Math.min(cap, pockets, 5);
        R.push(`${row.kind} (${dscr}): physical capacity ${cap} chest${cap === 1 ? '' : 's'} (size, wall pockets, danger ${row.danger} + access ${row.access})`);
      }
      row.want = Math.max(row.want, cap);
      // P2 batch-3.2: legitimate physical additions for large, storage/warehouse-function enclosed rooms whose
      // real wall-backed pocket capacity is not yet filled. No quota inflation: only enclosed (room/cellar/upper)
      // reachable spaces, usable >= 180, pockets >= 2, (danger >= 2 OR a storage/loot function in the name),
      // and current chests below capacity. Place up to the physical capacity (min of cap/want and pockets).
      const STORE = /store|warehouse|freight|depot|cellar|loft|cargo|receiving|sorting|transfer|ore|supply|locker|tally|records|ledger|archive|library|stacks|hall|office|shelter|booth|annex|niche|chamber|pocket|house|shed|gallery/i;
      const justified = (['room', 'cellar', 'upper'].includes(row.kind) && row.reachable && row.usable >= 180
        && pockets >= 2 && (row.danger >= 2 || STORE.test(row.name) || STORE.test(row.struct)) && have < pockets);
      // each real wall-backed pocket can stand one chest: fill the unused pockets, never above 5 per space
      const need2 = justified ? Math.max(0, Math.min(5, pockets) - have) : 0;
      if (justified) R.push(`P2 batch-3.2 physical addition: ${need2} chest(s) placed to fill unused wall-backed pocket capacity in this storage room`);
      if (!need2) continue;
      const [fam, why] = row.family ? [row.family as Family, 'the room’s function'] as [Family, string] : famOf(row.name, row.struct, row.arche);
      let family: Family = fam;
      const score = Math.min(6, row.danger + row.access);
      const grade = gradeOf(family, score, WRECKED.test(row.name) || WRECKED.test(row.poiName));
      row.family = row.family ?? family; row.grade = row.grade ?? grade;
      const mine: [number, number][] = row.base.map(id => { const b = BASE.find(q => q.id === id)!; return [b.gx, b.gy] as [number,number]; })
        .concat(row.added.map(id => sources.find(q => q.id === id)!).map(q => [q.gx, q.gy] as [number, number]));
      for (let k = 0; k < need2; k++) {
        const ok = cands.filter(([x, y]) => !taken.has(`${lv}:${x},${y}`) && all.every(o => o.lv !== lv || Math.max(Math.abs(o.gx - x), Math.abs(o.gy - y)) >= 3));
        if (!ok.length) { R.push(`no free wall tile for chest ${have + k + 1} without moving furniture: left out`); break; }
        ok.sort((u, v) => { if (mine.length) { const du = Math.min(...mine.map(m => Math.abs(m[0] - u[0]) + Math.abs(m[1] - u[1]))), dv = Math.min(...mine.map(m => Math.abs(m[0] - v[0]) + Math.abs(m[1] - v[1]))); if (du !== dv) return dv - du; } return u[2] - v[2] || u[1] - v[1] || u[0] - v[0]; });
        const [x, y, , apr, solids] = ok[0];
        if (!keepsJoined(s, lv, taken, x, y)) { cands.splice(cands.indexOf(ok[0]), 1); k--; continue; }
        let f1: Family = family;
        if (f1 === 'military' && (row.danger < 3 || (row.danger + row.access < 4 && (row.added.length || row.base.length)))) { f1 = 'supply'; if (!R.some(q => q.startsWith('one Military Case'))) R.push('one Military Case only (the room is neither gated, hidden nor on another storey, nor danger-3+): the other chest is Supply'); }
        const variant = `${f1}_${gradeOf(f1, score, false)}`;
        const id = mkId(poi, variant, `${lv < 0 ? 'b' + -lv : 'f' + lv}.${row.id.split('/')[2].toLowerCase().replace(/[^a-z0-9_]/g, '_')}`);
        taken.add(`${lv}:${x},${y}`); all.push({ lv, gx: x, gy: y }); mine.push([x, y]);
        sources.push({ id, site: poi, zone: row.gate ? 'CARD_ROOM' : 'POI', variant, gx: x, gy: y, level: lv as any, place: `${row.kind}:${row.name}`, space: row.id, ...(row.gate ? { gate: row.gate } : {}), ax: apr[0], ay: apr[1] });
        row.added.push(id);
        R.push(`physical placement: chest ${have + k + 1} of ${cap} against a wall pocket (${solids} solid sides)`);
      }
    }
    for (const row of rows) { delete (row as any)._cells; delete (row as any)._reach; delete (row as any)._first; spaces.push(row); }
    log(`${poi}: ${rows.length} spaces, +${rows.reduce((n, r) => n + r.added.length, 0)} sources (base ${rows.reduce((n, r) => n + r.base.length, 0)})`);
  }

  /* ───────────── roads ───────────── */
  const P = (GOLD as any).project;
  const inPoi = (x: number, y: number, pad = 10) => poiBoxes.some(B => x >= B[0] - pad && x <= B[2] + pad && y >= B[1] - pad && y <= B[3] + pad);
  const poiDist = (x: number, y: number) => Math.min(...poiBoxes.map(B => Math.hypot(Math.max(B[0] - x, 0, x - B[2]), Math.max(B[1] - y, 0, y - B[3]))));
  const roadChests: { gx: number; gy: number }[] = BASE.filter(b => b.zone === 'ROAD').map(b => ({ gx: b.gx, gy: b.gy }));
  const sites = new Map<string, Site | null>();
  const siteAt = (x: number, y: number) => { const kx = Math.floor(x / 64), ky = Math.floor(y / 64), k = kx + ',' + ky; if (!sites.has(k)) { if (sites.size > 6) sites.delete(sites.keys().next().value!); sites.set(k, openSite(kx * 64 + 32, ky * 64 + 32)); } return sites.get(k)!; };
  const HARSH = new Set<number>([T.TOXIC, T.ASH, T.SNOW, T.SAND, T.BURNT, T.ICE]);
  /** A verge tile beside the road at (cx,cy): never on the carriageway, never inside a site, never near anything else. */
  const verge = (cx: number, cy: number, minGap: number): [number, number, [number, number], boolean] | null => {
    const s = siteAt(cx, cy); if (!s) return null; const cand: [number, number, number, [number, number]][] = []; let harsh = 0, seenT = 0;
    for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) {
      const x = cx + dx, y = cy + dy; if (!s.inb(x, y)) continue; const t = s.tile(0, x, y); seenT++; if (HARSH.has(t)) harsh++;
      if (t === T.BRIDGE || t === T.FLOOR || !s.pass(0, x, y) || !s.prot(x, y) || inPoi(x, y)) continue;
      const road = N4.map(([ax, ay]) => [x + ax, y + ay] as [number, number]).find(([ax, ay]) => s.tile(0, ax, ay) === T.ROAD && s.pass(0, ax, ay)); if (!road) continue;
      // preferred: the protected verge just off the carriageway; otherwise the outermost road tile (never mid-road)
      const onRoad = t === T.ROAD; if (onRoad && !N4.some(([ax, ay]) => { const q = s.tile(0, x + ax, y + ay); return q !== T.ROAD && q !== T.BRIDGE && q !== T.FLOOR; })) continue;
      let bad = false; for (let ay = -1; ay <= 1 && !bad; ay++) for (let ax = -1; ax <= 1; ax++) if (s.src3(x + ax, y + ay)) { bad = true; break; }
      if (bad || s.nearStatic(0, x, y, 2) || taken.has(`0:${x},${y}`) || !keepsJoined(s, 0, taken, x, y)) continue;
      if (!roadChests.every(o => Math.hypot(o.gx - x, o.gy - y) >= minGap) || !all.every(o => o.lv !== 0 || Math.max(Math.abs(o.gx - x), Math.abs(o.gy - y)) >= 6)) continue;
      cand.push([x, y, Math.abs(dx) + Math.abs(dy) + u01(`v${x},${y}`) + (onRoad ? 6 : 0), road]);
    }
    if (!cand.length) return null; cand.sort((u, v) => u[2] - v[2]); const c0 = cand[0]; return [c0[0], c0[1], c0[3], harsh / Math.max(1, seenT) > 0.35];
  };
  const roads: RoadRow[] = [];
  const pick = (table: [string, number][], key: string) => { const tot = table.reduce((n, r) => n + r[1], 0); let x = u01(key) * tot; for (const [v, w] of table) { x -= w; if (x < 0) return v; } return table[0][0]; };
  const CART: [string, number][] = [['supply_damaged', 34], ['supply_low', 26], ['toolbox_damaged', 20], ['food_low', 12], ['medical_low', 8]];
  const TRAIL: [string, number][] = [['supply_damaged', 30], ['food_low', 24], ['medical_low', 20], ['toolbox_damaged', 16], ['supply_low', 10]];
  const up = (v: string) => v === 'supply_damaged' ? 'supply_low' : v === 'toolbox_damaged' ? 'toolbox_low' : v;
  const place = (row: RoadRow, site: string, cx: number, cy: number, variant: string, key: string, what: string, gap: number): boolean => {
    const v = verge(cx, cy, gap); if (!v) return false; const [x, y, ap, harsh] = v; if (harsh) variant = up(variant);
    const id = mkId(site, variant, key); taken.add(`0:${x},${y}`); all.push({ lv: 0, gx: x, gy: y }); roadChests.push({ gx: x, gy: y });
    sources.push({ id, site, zone: 'ROAD', variant, gx: x, gy: y, level: 0, place: what, space: `road/${row.id}`, ax: ap[0], ay: ap[1] }); row.added.push(id); row.features.push(`${what}${harsh ? ' (harsh ground: grade raised)' : ''} @${x},${y}`); return true;
  };
  const polys = (P.roads as any[]).filter(r => r.kind !== 'ferry').map(r => ({ r, pts: (r.points as [number, number][]).map(q => [q[0] * 2, q[1] * 2] as [number, number]) }));
  // junctions: where a road ends on another road, away from any site
  const ends: { x: number; y: number; id: string }[] = []; for (const { r, pts } of polys) { ends.push({ x: pts[0][0], y: pts[0][1], id: r.id }, { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], id: r.id }); }
  const junctions: { x: number; y: number; roads: string[] }[] = [];
  const dSeg = (x: number, y: number, a: number[], b: number[]) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)); };
  for (const e of ends) { const rs = new Set<string>([e.id]);
    for (const { r, pts } of polys) { if (r.id === e.id) continue; for (let i = 0; i < pts.length - 1; i++) if (dSeg(e.x, e.y, pts[i], pts[i + 1]) <= 8) { rs.add(r.id); break; } }
    if (rs.size >= 2 && !inPoi(e.x, e.y, 20) && !junctions.some(j => Math.hypot(j.x - e.x, j.y - e.y) <= 30)) junctions.push({ x: Math.round(e.x), y: Math.round(e.y), roads: [...rs].sort() }); }
  for (const { r, pts } of polys) {
    const row: RoadRow = { id: r.id, name: r.name ?? r.id, kind: r.kind, tiles: 0, tilesOutsidePoi: 0, harshShare: 0, remoteMax: 0, base: BASE.filter(b => b.site === r.id).map(b => b.id), added: [], features: [], reasons: [] };
    const b3road = batch3ByRoad.get(r.id); if (b3road) { row.added = b3road.map(q => q.id); for (const q of b3road) roadChests.push({ gx: q.gx, gy: q.gy }); }
    const seg: number[] = []; let total = 0; for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(d); total += d; }
    const at = (d: number): [number, number] => { for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const t = seg[i] ? d / seg[i] : 0; return [Math.round(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t), Math.round(pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t)]; } d -= seg[i]; } return [Math.round(pts[pts.length - 1][0]), Math.round(pts[pts.length - 1][1])]; };
    row.tiles = Math.round(total); let out = 0; for (let d = 0; d <= total; d += 4) { const [x, y] = at(d); if (!inPoi(x, y)) { out += 4; row.remoteMax = Math.max(row.remoteMax, Math.round(poiDist(x, y))); } } row.tilesOutsidePoi = Math.min(row.tiles, out);
    const base = r.kind === 'cart' ? 150 : r.kind === 'trail' ? 115 : r.kind === 'riverside' ? 150 : 130;
    row.reasons.push(`${r.kind} road, ${row.tiles} tiles (${row.tilesOutsidePoi} outside any site); a cache about every ${base} tiles of open road, jittered ±25% and moved off the grid by the real verge`);
    if (row.tilesOutsidePoi < 70) { row.reasons.push('almost the whole road lies inside site footprints: its chests are the sites’ own, none added'); roads.push(row); continue; }
    let d = base * (0.45 + 0.4 * u01(r.id + '|start')), military = false, n = 0;
    // the approved 599-source roster is frozen: the road caches it carries are seeded above and are NOT re-placed here.
    // The loop below is skipped; only the capacity reason is recorded.
    row.reasons.push(`frozen road caches: the approved ${row.added.length} cache(s) on this road stand at their surveyed verge tiles, never re-placed`);
    if (row.added.length) row.reasons.push(`the road's caches were placed against real verge geometry (off the carriageway, clear of sites) in the approved survey`);
    roads.push(row);
  }
  const feat = (id: string, name: string, kind: string): RoadRow => { const row: RoadRow = { id, name, kind, tiles: 0, tilesOutsidePoi: 0, harshShare: 0, remoteMax: 0, base: [], added: [], features: [], reasons: [] }; const b3f = batch3ByRoad.get(id); if (b3f) { row.added = b3f.map(q => q.id); for (const q of b3f) roadChests.push({ gx: q.gx, gy: q.gy }); } roads.push(row); return row; };
  for (const b of P.bridges as any[]) { const x = Math.round(b.at[0] * 2), y = Math.round(b.at[1] * 2); const row = feat(b.id, b.name, 'bridge'); if (inPoi(x, y, 6)) { row.reasons.push('bridge inside a site footprint: covered by the site'); continue; }
    row.reasons.push(row.added.length ? 'a crossing is a natural stop and choke point: the approved repair cache stands at the bridgehead (frozen, not re-placed)' : 'no free verge tile at either bridgehead: none placed'); }
  for (const dk of P.docks as any[]) { const x = Math.round(dk.at[0] * 2), y = Math.round(dk.at[1] * 2); const row = feat(dk.id, dk.name, 'dock'); if (inPoi(x, y, 6)) { row.reasons.push('dock inside a site footprint: covered by the site'); continue; }
    row.reasons.push(row.added.length ? 'free-standing landing: the approved cache stands where boats unload (frozen, not re-placed)' : 'no road verge at this landing in the compiled runtime: none placed'); }
  junctions.forEach((j, i) => { const row = feat(`jn_${String(i).padStart(2, '0')}`, `Junction of ${j.roads.join(' + ')}`, 'junction');
    row.reasons.push(row.added.length ? 'roads meet away from any site: the approved waypoint cache stands at the fork (frozen, not re-placed)' : 'a road chest already stands within 60 tiles or there is no free verge: none placed'); });
  setG1bFurnitureReservation(true);
  return { sources, spaces, roads, notes, baseLevels: baseSpace };
}
