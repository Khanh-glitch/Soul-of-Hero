/**
 * G1B source resolver (tooling + invariant test input). Resolves the 130 approved source ids, the three card cases
 * and the three circuit generators onto REAL Veyra tiles read from the compiled window worlds. It never trusts the
 * MapLab candidate centre: every tile is measured on the collision data the game itself uses.
 */
import contract from '../../evidence/g1b/approved/g1b-approved-runtime-contract-v1.json';
import { T, WW, WH } from '../../src/game/core';
import { getWindowWorld } from '../../src/veyra05/window';
import { layoutIdAt } from '../../src/veyra05/scenes';
import { getPoiLayout } from '../../src/veyra05/poi-kit';
import { POIS, GOLD } from '../../src/veyra05/reader';
import { FRAME_W, FRAME_H } from '../../src/veyra05/frame';

export interface ResolvedSource { id: string; site: string; zone: string; variant: string; gx: number; gy: number; place: string; gate?: string }
export interface ResolvedGate { id: string; site: string; building: string; door: [number, number]; interior: [number, number]; card?: 'green' | 'blue' | 'purple'; power?: string; ppe?: boolean }
export interface ResolvedFixture { id: string; kind: 'card' | 'gen'; site: string; gx: number; gy: number; card?: string; place: string }
export interface Resolution { sources: ResolvedSource[]; gates: ResolvedGate[]; fixtures: ResolvedFixture[]; variances: string[] }

const BAD = new Set<number>([T.DEEP, T.SHALLOW, T.RIVER, T.CLIFF, T.PWALL, T.LAVA, T.TOXIC, T.ICE]);
const clampO = (v: number, max: number) => Math.max(0, Math.min(max, v));

/** A square of real collision data around a global tile, valid for both placement rules. */
export function probe(cx: number, cy: number) {
  const ox = clampO(cx - 100, FRAME_W - WW), oy = clampO(cy - 100, FRAME_H - WH);
  const a = getWindowWorld(layoutIdAt(ox, oy), 4), b = getWindowWorld(layoutIdAt(ox, oy), 3);
  const g = a.floors.ground;
  const stair = new Set<number>(); for (const lv of a.floors.layers.values()) for (const s of lv.stairs as any[]) { for (const [x, y] of [[s.x, s.y], [s.tx, s.ty]]) if (Number.isFinite(x)) stair.add((y - oy) * WW + (x - ox)); }
  const stat = new Set<number>(), door = new Set<number>();
  for (const w of [a.world, b.world]) for (const s of w.statics) { (s.kind === 'door' ? door : stat).add(s.ty * WW + s.tx); }
  const inb = (x: number, y: number) => x >= ox + 2 && y >= oy + 2 && x < ox + WW - 2 && y < oy + WH - 2;
  const li = (x: number, y: number) => (y - oy) * WW + (x - ox);
  const tile = (x: number, y: number) => inb(x, y) ? a.world.tiles[li(x, y)] : T.CLIFF;
  const src = (x: number, y: number) => inb(x, y) && !!(a.world.sourceV3[li(x, y)] || b.world.sourceV3[li(x, y)]);
  const isDoor = (x: number, y: number) => inb(x, y) && door.has(li(x, y));
  /** Walkable for a player on foot (doors count as passable: they open). */
  const pass = (x: number, y: number) => inb(x, y) && (isDoor(x, y) || (!BAD.has(tile(x, y)) && !!a.world.economyMap.walkable[li(x, y)] && !src(x, y) && !g.solidProps[li(x, y)] && !stat.has(li(x, y))));
  const prot = (x: number, y: number) => inb(x, y) && !!a.world.economyMap.protected[li(x, y)];
  const isStair = (x: number, y: number) => inb(x, y) && stair.has(li(x, y));
  const isStatic = (x: number, y: number) => inb(x, y) && stat.has(li(x, y));
  const nearStatic = (x: number, y: number, rad = 2) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (isStatic(x + dx, y + dy)) return true; return false; };
  /** Standable ground ignoring furniture and legacy statics (room topology). */
  const walk = (x: number, y: number) => inb(x, y) && !BAD.has(tile(x, y)) && !!a.world.economyMap.walkable[li(x, y)];
  /** Can another storey be used to enter this room without its ground door? (any stair of the room whose far storey reaches a foreign stair) */
  const bypass = (room: Set<string>): boolean => {
    const stairs: any[] = []; for (const lv of a.floors.layers.values()) for (const s of lv.stairs as any[]) if (!stairs.some(q => q.x === s.x && q.y === s.y && q.from === s.from && q.to === s.to)) stairs.push(s);
    const endAt = (s: any, level: number): [number, number] => level === s.to ? [s.tx, s.ty] : [s.x, s.y];
    const mine = stairs.filter(s => (s.from === 0 && room.has(s.x + ',' + s.y)) || (s.to === 0 && room.has(s.tx + ',' + s.ty)));
    for (const s0 of mine) {
      const level = s0.from === 0 ? s0.to : s0.from; const layer = a.floors.layers.get(level); if (!layer) continue;
      const ldoor = new Set(layer.statics.filter(q => q.kind === 'door').map(q => q.ty * WW + q.tx));
      const ok = (x: number, y: number) => inb(x, y) && (ldoor.has(li(x, y)) || (layer.tiles[li(x, y)] !== T.PWALL && !!layer.walkable[li(x, y)]));
      const st = endAt(s0, level); const seen = new Set<string>([st.join(',')]); const q: [number, number][] = [st];
      while (q.length && seen.size < 20000) { const [ax, ay] = q.pop()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = ax + dx, ny = ay + dy, k = nx + ',' + ny; if (seen.has(k) || !ok(nx, ny)) continue; seen.add(k); q.push([nx, ny]); } }
      for (const o of stairs) { if (o === s0 || (o.from !== level && o.to !== level)) continue; const e = endAt(o, level); if (!seen.has(e.join(','))) continue;
        const far = o.from === level ? o.to : o.from; const fe = endAt(o, far); if (far === 0 && room.has(fe.join(','))) continue; return true; }
    }
    return false;
  };
  return { ox, oy, tile, src, isDoor, pass, prot, isStair, isStatic, nearStatic, walk, inb, bypass };
}
type Probe = ReturnType<typeof probe>;
const POI_BOXES: [number, number, number, number][] = POIS.map(q => { try { return getPoiLayout(q.id).bbox; } catch { return null; } }).filter((b): b is [number, number, number, number] => !!b);
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Would blocking `taken ∪ {x,y}` keep every free neighbour joined to the open world? */
function keepsWorldJoined(p: Probe, taken: Set<string>, x: number, y: number, needSouth = true): boolean {
  const blocked = (ax: number, ay: number) => (ax === x && ay === y) || taken.has(ax + ',' + ay) || !p.pass(ax, ay);
  const starts = N4.map(([dx, dy]) => [x + dx, y + dy] as [number, number]).filter(([ax, ay]) => !blocked(ax, ay));
  if (!starts.length || (needSouth && blocked(x, y + 1))) return false;
  // flood from the first neighbour; all other neighbours must be met and the flood must be large (open world)
  const seen = new Set<string>([starts[0].join(',')]); const q = [starts[0]]; let head = 0;
  while (head < q.length && seen.size < 6000) { const [ax, ay] = q[head++]; for (const [dx, dy] of N4) { const nx = ax + dx, ny = ay + dy, k = nx + ',' + ny; if (seen.has(k) || blocked(nx, ny)) continue; seen.add(k); q.push([nx, ny]); } }
  return seen.size >= 3000 && starts.every(s => seen.has(s.join(',')));
}
const farFrom = (list: { gx: number; gy: number }[], x: number, y: number, d: number) => list.every(o => Math.max(Math.abs(o.gx - x), Math.abs(o.gy - y)) >= d);
const nearDoorOrStair = (p: Probe, x: number, y: number, rad = 2) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (p.isDoor(x + dx, y + dy) || p.isStair(x + dx, y + dy)) return true; return false; };
const noSolidNeighbourSource = (p: Probe, x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (p.src(x + dx, y + dy)) return false; return true; };

interface Compartment { cells: [number, number][]; set: Set<string>; doors: [number, number][]; enclosed: boolean; stairs: number; statics: number; cx: number; cy: number }
/** Real enclosed interiors of a site: connected FLOOR cells, split at door statics. Measured, never assumed from a kit plan. */
function compartments(p: Probe, bbox: [number, number, number, number]): Compartment[] {
  const [x0, y0, x1, y1] = bbox; const seen = new Set<string>(); const out: Compartment[] = [];
  const floor = (x: number, y: number) => x >= x0 && y >= y0 && x <= x1 && y <= y1 && p.tile(x, y) === T.FLOOR && !p.isDoor(x, y) && p.walk(x, y);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!floor(x, y) || seen.has(x + ',' + y)) continue;
    const cells: [number, number][] = []; const q: [number, number][] = [[x, y]]; seen.add(x + ',' + y); const doors = new Map<string, [number, number]>(); let enclosed = true, stairs = 0, statics = 0;
    while (q.length) { const [ax, ay] = q.pop()!; cells.push([ax, ay]); if (p.isStair(ax, ay)) stairs++; if (p.isStatic(ax, ay)) statics++;
      for (const [dx, dy] of N4) { const nx = ax + dx, ny = ay + dy, k = nx + ',' + ny;
        if (p.isDoor(nx, ny)) { doors.set(k, [nx, ny]); continue; }
        if (floor(nx, ny)) { if (!seen.has(k)) { seen.add(k); q.push([nx, ny]); } continue; }
        if (p.tile(nx, ny) !== T.PWALL && p.walk(nx, ny)) enclosed = false;
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) { if (p.tile(nx, ny) === T.FLOOR) enclosed = false; } } }
    if (cells.length < 12) continue;
    out.push({ cells, set: new Set(cells.map(c => c.join(','))), doors: [...doors.values()], enclosed, stairs, statics, cx: cells.reduce((n, c) => n + c[0], 0) / cells.length, cy: cells.reduce((n, c) => n + c[1], 0) / cells.length });
  }
  return out;
}
function wallCells(p: Probe, c: Compartment, south = false): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const [x, y] of c.cells) {
    if (!p.pass(x, y)) continue;
    const north = p.tile(x, y - 1) === T.PWALL, side = p.tile(x - 1, y) === T.PWALL || p.tile(x + 1, y) === T.PWALL;
    const sth = south && p.tile(x, y + 1) === T.PWALL;
    if (!north && !side && !sth) continue; out.push([x, y, north ? 0 : side ? 1 : 2]);
  }
  return out.sort((u, v) => u[2] - v[2] || u[1] - v[1] || u[0] - v[0]);
}
function exteriorCells(p: Probe, site: string, comps: Compartment[]): [number, number, number][] {
  const L = getPoiLayout(site); const out: [number, number, number][] = []; const [x0, y0, x1, y1] = L.bbox;
  const inside = (x: number, y: number) => comps.some(c => c.enclosed && c.set.has(x + ',' + y));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (inside(x, y) || !p.pass(x, y) || p.isDoor(x, y) || !p.prot(x, y)) continue;
    const t = p.tile(x, y); if (t !== T.FLOOR && t !== T.ROAD) continue;
    const wallN = p.tile(x, y - 1) === T.PWALL; // stands against the south face of a wall: readable from the yard
    const d = Math.abs(x - L.atTile[0]) + Math.abs(y - L.atTile[1]);
    out.push([x, y, (wallN ? 0 : 1000) + d]);
  }
  return out.sort((u, v) => u[2] - v[2] || u[1] - v[1] || u[0] - v[0]);
}

export function resolveG1b(): Resolution {
  const variances: string[] = []; const sources: ResolvedSource[] = []; const gates: ResolvedGate[] = []; const fixtures: ResolvedFixture[] = [];
  const slots = (contract as any).sourceSlots as any[];
  const taken = new Set<string>(); const all: { gx: number; gy: number }[] = [];
  const take = (x: number, y: number) => { taken.add(x + ',' + y); all.push({ gx: x, gy: y }); };
  const bySite = new Map<string, any[]>(); for (const s of slots) { if (!bySite.has(s.site_id)) bySite.set(s.site_id, []); bySite.get(s.site_id)!.push(s); }
  const fits = (p: Probe, c: Compartment, n: number, spacing: number): [number, number][] | null => {
    for (const relax of [0, 1]) {
      const got: [number, number][] = []; const t2 = new Set(taken); const a2 = [...all]; const rad = relax ? 1 : 2;
      for (const [x, y] of wallCells(p, c, !!relax)) { if (got.length >= n) break;
        if (t2.has(x + ',' + y) || nearDoorOrStair(p, x, y, rad) || p.nearStatic(x, y, rad) || !farFrom(a2, x, y, spacing) || !keepsWorldJoined(p, t2, x, y, !relax)) continue;
        got.push([x, y]); t2.add(x + ',' + y); a2.push({ gx: x, gy: y }); }
      if (got.length >= n) return got;
    }
    return null;
  };
  const gatePlan: Record<string, { room?: 'green' | 'blue' | 'purple'; roomPower?: boolean; roomPpe?: boolean; deep?: { card?: 'green' | 'blue' | 'purple'; power: boolean; ppe: boolean } }> = {
    po_academy: { room: 'green' },
    po_meridian: { room: 'blue', deep: { card: 'blue', power: true, ppe: false } },
    po_archive: { room: 'purple', roomPower: true, roomPpe: true, deep: { card: 'purple', power: true, ppe: true } },
    po_falls: { deep: { power: true, ppe: false } },
  };
  const siteComps = new Map<string, Compartment[]>(); const gatedComp = new Map<Compartment, ResolvedGate>();
  const siteGates: Record<string, { room?: Compartment; deep?: Compartment }> = {};
  const compName = (site: string, c: Compartment) => `${site}@${Math.round(c.cx)},${Math.round(c.cy)}`;
  for (const [site, list] of bySite) {
    if (site.startsWith('rd_')) continue;
    const L = getPoiLayout(site); const p = probe(L.atTile[0], L.atTile[1]); const comps = compartments(p, [L.bbox[0] - 16, L.bbox[1] - 16, L.bbox[2] + 16, L.bbox[3] + 16]); siteComps.set(site, comps);
    const plan = gatePlan[site]; if (!plan) continue;
    const g = POIS.find(q => q.id === site)!; const deep = g.deep; const dc = deep ? [deep.reduce((n, q) => n + q[0], 0) / deep.length * 2, deep.reduce((n, q) => n + q[1], 0) / deep.length * 2] : L.atTile;
    const nRoom = list.filter(s => s.zone === 'CARD_ROOM').length, nDeep = list.filter(s => String(s.access_gate).startsWith('DEEP')).length;
    const inBox = (c: Compartment) => c.cx >= L.bbox[0] && c.cx <= L.bbox[2] && c.cy >= L.bbox[1] && c.cy <= L.bbox[3];
    const cands = comps.filter(c => c.enclosed && c.doors.length === 1 && inBox(c) && !p.bypass(c.set)).sort((u, v) => (u.stairs ? 1 : 0) - (v.stairs ? 1 : 0) || Math.hypot(u.cx - dc[0], u.cy - dc[1]) - Math.hypot(v.cx - dc[0], v.cy - dc[1]));
    siteGates[site] = {};
    const mk = (c: Compartment, id: string, o: { card?: any; power?: boolean; ppe?: boolean }) => {
      const d = c.doors[0]; const inner = N4.find(([dx, dy]) => c.set.has((d[0] + dx) + ',' + (d[1] + dy)))!;
      if (c.stairs) variances.push(`${id}: the only single-door enclosed room that fits contains ${c.stairs} internal stair cell(s) to its own other storey`);
      const gate: ResolvedGate = { id, site, building: compName(site, c), door: [d[0], d[1]], interior: [inner[0], inner[1]], ...(o.card ? { card: o.card } : {}), ...(o.power ? { power: `veyra.g1b:gen:${site}` } : {}), ...(o.ppe ? { ppe: true } : {}) };
      gates.push(gate); gatedComp.set(c, gate);
    };
    if (plan.room) { const c = cands.find(q => fits(p, q, nRoom, 2)); if (c) { siteGates[site].room = c; mk(c, `veyra.g1b:gate:${site}:room_${plan.room}`, { card: plan.room, power: plan.roomPower, ppe: plan.roomPpe }); } else variances.push(`${site}: no single-door enclosed room fits ${nRoom} card-room chests`); }
    if (plan.deep && nDeep) {
      const c = cands.find(q => !gatedComp.has(q) && fits(p, q, nDeep, 2));
      const same = !plan.room || (plan.deep.card === plan.room && !!plan.deep.power === !!plan.roomPower && !!plan.deep.ppe === !!plan.roomPpe);
      const roomC = siteGates[site].room;
      if (same && roomC && fits(p, roomC, nRoom + nDeep, 2) && !c) siteGates[site].deep = roomC;
      else if (c) { siteGates[site].deep = c; mk(c, `veyra.g1b:gate:${site}:deep`, plan.deep); }
      else if (same && roomC && fits(p, roomC, nRoom + nDeep, 2)) siteGates[site].deep = roomC;
      else if (roomC && fits(p, roomC, nRoom + nDeep, 2)) {
        // one real enclosed room only: it carries the stricter of the two approved gates so no source is easier than approved
        const g0 = gatedComp.get(roomC)!; if (plan.deep.power) g0.power = `veyra.g1b:gen:${site}`; if (plan.deep.ppe) g0.ppe = true; siteGates[site].deep = roomC;
        variances.push(`${site}: the real geometry has one single-door enclosed room; the ${nDeep} DEEP source(s) share the card room and its door carries the stricter gate (${[g0.card && g0.card + ' card', g0.power && 'power', g0.ppe && 'PPE'].filter(Boolean).join(' + ')})`);
      }
      else variances.push(`${site}: no single-door enclosed room for the ${nDeep} DEEP source(s)`);
    }
  }

  const placeIn = (p: Probe, c: Compartment, spacing: number): [number, number] | null => { const r = fits(p, c, 1, spacing); return r ? r[0] : null; };

  for (const [site, list] of bySite) {
    if (site.startsWith('rd_')) continue;
    const L = getPoiLayout(site); const p = probe(L.atTile[0], L.atTile[1]); const comps = siteComps.get(site)!;
    const free = comps.filter(c => !gatedComp.has(c));
    let rr = 0; const ext = exteriorCells(p, site, comps);
    const yard = (): [number, number] | null => { for (const [x, y] of ext) { if (taken.has(x + ',' + y) || nearDoorOrStair(p, x, y) || p.nearStatic(x, y) || !farFrom(all, x, y, 4) || !noSolidNeighbourSource(p, x, y) || !keepsWorldJoined(p, taken, x, y)) continue; return [x, y]; } return null; };
    for (const s of list) {
      const deep = String(s.access_gate).startsWith('DEEP'); const room = s.zone === 'CARD_ROOM';
      let at: [number, number] | null = null, place = '', gate: string | undefined;
      if (room || deep) {
        const c = room ? siteGates[site]?.room : siteGates[site]?.deep;
        if (c) { at = placeIn(p, c, 2); place = `interior:${compName(site, c)}`; gate = gatedComp.get(c)!.id; }
        if (!at) { variances.push(`${s.source_id}: no gated interior cell available (${site})`); continue; }
      } else {
        const wantInterior = free.length > 0 && (rr % 2 === 0);
        if (wantInterior) for (let k = 0; k < free.length && !at; k++) { const c = free[(rr / 2 + k) % free.length | 0]; at = placeIn(p, c, 4); if (at) place = `interior:${compName(site, c)}`; }
        if (!at) { at = yard(); if (at) place = 'yard'; }
        if (!at) for (let k = 0; k < free.length && !at; k++) { const c = free[k]; at = placeIn(p, c, 2); if (at) place = `interior:${compName(site, c)}`; }
        rr++;
        if (!at) { variances.push(`${s.source_id}: no free protected walkable cell at ${site}`); continue; }
      }
      take(at[0], at[1]); sources.push({ id: s.source_id, site, zone: s.zone, variant: s.variant, gx: at[0], gy: at[1], place, ...(gate ? { gate } : {}) });
    }
  }

  // ---- roads: an edge tile of the real road surface, spread along the GOLD polyline ----
  const roads = (GOLD as any).project.roads as { id: string; points: [number, number][] }[];
  for (const [site, list] of bySite) {
    if (!site.startsWith('rd_')) continue;
    const road = roads.find(q => q.id === site); if (!road) { for (const s of list) variances.push(`${s.source_id}: GOLD road ${site} does not exist`); continue; }
    const pts = road.points.map(q => [q[0] * 2, q[1] * 2] as [number, number]); const seg: number[] = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(d); total += d; }
    const at = (f: number): [number, number] => { let d = f * total; for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const t = seg[i] ? d / seg[i] : 0; return [Math.round(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t), Math.round(pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t)]; } d -= seg[i]; } return pts[pts.length - 1].map(Math.round) as [number, number]; };
    list.forEach((s, n) => {
      let found: [number, number] | null = null, insidePoi = false;
      const inPoi = (x: number, y: number) => POI_BOXES.some(B => x >= B[0] && x <= B[2] && y >= B[1] && y <= B[3]);
      for (const pass of [0, 1]) {
        for (const off of [0, 0.03, -0.03, 0.06, -0.06, 0.1, -0.1, 0.15, -0.15, 0.22, -0.22, 0.3, -0.3]) {
          const f = Math.min(0.95, Math.max(0.05, (n + 1) / (list.length + 1) + off)); const [cx, cy] = at(f); const p = probe(cx, cy);
          const cand: [number, number, number][] = [];
          for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
            const x = cx + dx, y = cy + dy; if (p.tile(x, y) !== T.ROAD || !p.pass(x, y) || !p.prot(x, y)) continue;
            const edge = N4.some(([ax, ay]) => { const t = p.tile(x + ax, y + ay); return t !== T.ROAD && t !== T.BRIDGE && t !== T.FLOOR; }); if (!edge) continue;
            if (pass === 0 && inPoi(x, y)) continue;
            cand.push([x, y, Math.abs(dx) + Math.abs(dy)]);
          }
          cand.sort((u, v) => u[2] - v[2] || u[1] - v[1] || u[0] - v[0]);
          for (const [x, y] of cand) { if (taken.has(x + ',' + y) || nearDoorOrStair(p, x, y) || p.nearStatic(x, y) || !farFrom(all, x, y, pass ? 6 : 12) || !noSolidNeighbourSource(p, x, y) || !keepsWorldJoined(p, taken, x, y)) continue; found = [x, y]; insidePoi = inPoi(x, y); break; }
          if (found) break;
        }
        if (found) break;
      }
      if (!found) { variances.push(`${s.source_id}: no free road-edge tile on ${site}`); return; }
      if (insidePoi) variances.push(`${s.source_id}: GOLD road ${site} has no free edge tile outside a POI footprint; placed on its real road edge inside the footprint at ${found[0]},${found[1]}`);
      take(found[0], found[1]); sources.push({ id: s.source_id, site, zone: s.zone, variant: s.variant, gx: found[0], gy: found[1], place: insidePoi ? 'road-edge-in-poi' : 'road-edge' });
    });
  }

  // ---- fixtures: three finite card cases and the circuit generators ----
  const cardSites: [string, string, 'yard' | 'interior', string][] = [['green_card', 'po_kestrel', 'yard', 'exterior case'], ['blue_card', 'po_freightyard', 'interior', 'freight yard office'], ['purple_card', 'po_slag', 'interior', 'operations area']];
  for (const [card, site, want, label] of cardSites) {
    const L = getPoiLayout(site); const p = probe(L.atTile[0], L.atTile[1]); let at: [number, number] | null = null, place = '';
    const comps = siteComps.get(site) ?? compartments(p, [L.bbox[0] - 16, L.bbox[1] - 16, L.bbox[2] + 16, L.bbox[3] + 16]);
    if (want === 'interior') { for (const c of comps.filter(q => q.enclosed && !gatedComp.has(q)).sort((u, v) => v.cells.length - u.cells.length)) { at = placeIn(p, c, 3); if (at) { place = `interior:${compName(site, c)}`; break; } } if (!at) variances.push(`${card}: ${site} has no enclosed ${label} with a free cell in the real geometry; case placed in the open yard instead`); }
    if (!at) for (const [x, y] of exteriorCells(p, site, comps)) { if (taken.has(x + ',' + y) || nearDoorOrStair(p, x, y) || p.nearStatic(x, y) || !farFrom(all, x, y, 4) || !noSolidNeighbourSource(p, x, y) || !keepsWorldJoined(p, taken, x, y)) continue; at = [x, y]; place = 'yard'; break; }
    if (!at) { variances.push(`${card}: no cell for the card case at ${site}`); continue; }
    take(at[0], at[1]); fixtures.push({ id: `veyra.g1b:card:${card.replace('_card', '')}`, kind: 'card', site, gx: at[0], gy: at[1], card, place });
  }
  for (const site of [...new Set(gates.filter(g => g.power).map(g => g.site))]) {
    const L = getPoiLayout(site); const p = probe(L.atTile[0], L.atTile[1]); const g = gates.find(q => q.site === site && q.power)!; let at: [number, number] | null = null;
    const comps = siteComps.get(site)!; const inside = (x: number, y: number) => comps.some(c => c.set.has(x + ',' + y));
    const [dx, dy] = g.door; const cand: [number, number, number][] = [];
    for (let y = dy - 7; y <= dy + 7; y++) for (let x = dx - 7; x <= dx + 7; x++) {
      if (inside(x, y) || !p.pass(x, y) || !p.prot(x, y) || p.isDoor(x, y)) continue;
      const d = Math.abs(x - dx) + Math.abs(y - dy); if (d < 3) continue; cand.push([x, y, (p.tile(x, y - 1) === T.PWALL ? 0 : 100) + d]);
    }
    cand.sort((u, v) => u[2] - v[2] || u[1] - v[1] || u[0] - v[0]);
    for (const [x, y] of cand) { if (taken.has(x + ',' + y) || nearDoorOrStair(p, x, y, 1) || !farFrom(all, x, y, 3) || !noSolidNeighbourSource(p, x, y) || !keepsWorldJoined(p, taken, x, y)) continue; at = [x, y]; break; }
    if (!at) { variances.push(`generator: no exterior cell at ${site}`); continue; }
    take(at[0], at[1]); fixtures.push({ id: `veyra.g1b:gen:${site}`, kind: 'gen', site, gx: at[0], gy: at[1], place: 'yard' });
  }
  sources.sort((a, b) => slots.findIndex(s => s.source_id === a.id) - slots.findIndex(s => s.source_id === b.id));
  return { sources, gates, fixtures, variances };
}
