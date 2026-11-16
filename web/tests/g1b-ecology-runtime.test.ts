/**
 * G1B batch 2 — the room / floor / road ecology in the REAL runtime: seeding on storeys, save migration from the
 * 130-source layout, and (opt-in, G1B_ECOLOGY=1) a walk-reachability audit of every added chest with furniture dressed.
 */
import { describe, expect, it } from 'vitest';
import { WW } from '../src/game/core';
import { C, blockGrid, g1bEntities, markDirty } from '../src/game/engine';
import { G1B_SOURCE_SITES, G1B_BASE_SOURCE_SITES, G1B_ECOLOGY_SOURCES, G1B_FIXTURES, G1B_LAYOUT_REVISION } from '../src/game/g1b';
import { serializeSnapshot, validate } from '../src/game/persist';
import { getWindowWorld } from '../src/veyra05/window';
import { applyFloor, activeFloor } from '../src/veyra05/floors';
import { G1bRun } from './helpers/g1b-kit';

const N = G1B_SOURCE_SITES.length + G1B_FIXTURES.length;
const payload = (k: G1bRun) => JSON.parse(JSON.parse(serializeSnapshot(k.gs)).payload);
const ecoIds = new Set(G1B_ECOLOGY_SOURCES.map(s => s.id));
/** What a save written by the round-1 build looked like: only the 130 + 6 objects, no layout stamp. */
function asRound1(save: any) {
  const r = save.run;
  for (const table of [r.entities, r.g1b.far]) for (const [id, e] of Object.entries(table) as [string, any][]) if (e.g1b && ecoIds.has(e.g1b.sid)) { delete r.custody[e.c]; delete table[id]; }
  delete r.g1b.layout; return save;
}
const g1bOf = (r: any) => [...Object.values(r.entities), ...Object.values(r.g1b.far)].filter((e: any) => e.g1b) as any[];
const worldItems = (r: any) => Object.values(r.custody).reduce((n: number, c: any) => n + c.slots.reduce((m: number, s: any) => m + (s ? s.qty : 0), 0), 0);

describe('G1B ecology in the runtime', () => {
  it('a new run seeds every source once on its own storey; upper / cellar chests cannot be opened from the ground', () => {
    const k = new G1bRun(303); const all = g1bEntities(k.r); expect(all).toHaveLength(N); expect(k.r.g1b!.layout).toBe(G1B_LAYOUT_REVISION);
    for (const s of G1B_ECOLOGY_SOURCES) { const e = k.ent(s.id); expect((e as any).floor ?? 0, s.id).toBe(s.level ?? 0); expect(e.g1b!.state).toBe('closed'); expect(C(k.r, e.c!).slots.some(Boolean)).toBe(false); }
    expect(k.valid()).toBe(true);
    for (const level of [1, -1, 2] as const) {
      const s = G1B_ECOLOGY_SOURCES.find(q => q.level === level && !q.gate)!; k.bring(s.gx, s.gy);
      const e = k.live(s.id); const [ox, oy] = k.origin(); const p = k.r.player;
      // same x,y on the ground storey: the chest is neither solid nor usable there
      p.x = (s.ax! - ox) * 16 + 8; p.y = (s.ay! - oy) * 16 + 8;
      expect(activeFloor(k.r)).toBe(0); expect(blockGrid(k.r)[e.ty! * WW + e.tx!], `${s.id} is not solid on the ground`).not.toBe(3);
      expect(k.act('g1bOpen', { eid: e.id }).ok, `${s.id} cannot be opened from another storey`).toBe(false); expect(e.g1b!.state).toBe('closed');
      // on its own storey, standing on the approach tile the survey kept clear
      const ww = getWindowWorld(k.r.layoutId!); expect(applyFloor(k.gs, ww, ww.floors, level, [s.ax! - ox, s.ay! - oy], markDirty)).toBe(true);
      const grid = blockGrid(k.r); expect(grid[e.ty! * WW + e.tx!]).toBe(3); expect(grid[(s.ay! - oy) * WW + (s.ax! - ox)], `${s.id} approach tile is free`).toBe(0);
      const rc = k.act('g1bOpen', { eid: e.id }); expect(rc.ok, `${s.id}: ${rc.msg}`).toBe(true); expect(e.g1b!.state).toBe('opened'); expect(C(k.r, e.c!).slots.some(Boolean)).toBe(true);
      expect(k.valid(), 'a run with an opened upper-storey chest saves').toBe(true);
      const dn = getWindowWorld(k.r.layoutId!); applyFloor(k.gs, dn, dn.floors, 0, undefined, markDirty);
    }
  }, 240000);

  it('a save from the 130-source layout gains the new sources closed, keeps every old chest as it was, and migrates once', () => {
    const k = new G1bRun(404);
    // one base chest partly looted, one emptied and waiting to restock
    const a = G1B_BASE_SOURCE_SITES.find(s => s.zone === 'POI' && !s.gate && s.variant === 'supply_low')!; k.standBy(a.gx, a.gy); const ea = k.live(a.id);
    expect(k.act('g1bOpen', { eid: ea.id }).ok).toBe(true); expect(k.act('move', { from: ea.c, fs: 0, to: 'inv' }).ok).toBe(true); k.step();
    const b = G1B_BASE_SOURCE_SITES.find(s => s.zone === 'POI' && !s.gate && s.site === a.site && s.id !== a.id)!; k.standBy(b.gx, b.gy); const eb = k.live(b.id);
    expect(k.act('g1bOpen', { eid: eb.id }).ok).toBe(true); const cb = C(k.r, eb.c!); for (let i = 0; i < cb.slots.length; i++) if (cb.slots[i]) { const rc = k.act('move', { from: eb.c, fs: i, to: 'inv' }); if (!rc.ok) cb.slots[i] = null; } k.step();
    expect(eb.g1b!.state).toBe('empty'); expect(ea.g1b!.state).toBe('opened');
    const old = asRound1(payload(k)); expect(g1bOf(old.run)).toHaveLength(136); const itemsBefore = worldItems(old.run);
    const before = Object.fromEntries(g1bOf(old.run).map(e => [e.g1b.sid, JSON.stringify([e.g1b, old.run.custody[e.c].slots])]));

    const gs = validate(JSON.parse(JSON.stringify(old))); expect(gs, 'a round-1 save loads').not.toBeNull(); const r: any = gs!.run;
    expect(r.g1b.layout).toBe(G1B_LAYOUT_REVISION); const now = g1bOf(r); expect(now).toHaveLength(N); expect(new Set(now.map(e => e.g1b.sid)).size).toBe(N);
    for (const e of now) {
      if (before[e.g1b.sid]) expect(JSON.stringify([e.g1b, r.custody[e.c].slots]), `${e.g1b.sid} is exactly as saved`).toBe(before[e.g1b.sid]);
      else { expect(ecoIds.has(e.g1b.sid)).toBe(true); expect(e.g1b).toEqual({ sid: e.g1b.sid, kind: 'chest', state: 'closed', cycle: 0 }); expect(r.custody[e.c].slots.some(Boolean), 'a new source holds nothing until opened').toBe(false); }
    }
    expect(worldItems(r), 'migration creates no item').toBe(itemsBefore);
    // saving and loading the migrated run again changes nothing
    const again = validate(JSON.parse(JSON.parse(serializeSnapshot(gs!)).payload)); expect(again).not.toBeNull();
    expect(g1bOf(again!.run).map(e => JSON.stringify(e.g1b)).sort()).toEqual(now.map(e => JSON.stringify(e.g1b)).sort()); expect(worldItems(again!.run)).toBe(itemsBefore);

    // fail closed: a round-1 save missing one of its own chests, a stamped save missing a source, a layout from the future
    const missing = asRound1(payload(k)); const victim = g1bOf(missing.run).find(e => e.g1b.sid === a.id)!; for (const t of [missing.run.entities, missing.run.g1b.far]) delete t[victim.id]; delete missing.run.custody[victim.c];
    expect(validate(missing)).toBeNull();
    const holed = payload(k); const v2 = g1bOf(holed.run).find(e => ecoIds.has(e.g1b.sid))!; for (const t of [holed.run.entities, holed.run.g1b.far]) delete t[v2.id]; delete holed.run.custody[v2.c];
    expect(validate(holed)).toBeNull();
    const future = payload(k); future.run.g1b.layout = G1B_LAYOUT_REVISION + 1; expect(validate(future)).toBeNull();
    // a chest moved to another storey is not accepted
    const moved = payload(k); const up = g1bOf(moved.run).find(e => e.floor === 1)!; delete up.floor; expect(validate(moved)).toBeNull();
  }, 240000);
});

describe.runIf(process.env.G1B_ECOLOGY === '1')('G1B ecology reachability (furniture dressed, two window origins per site)', () => {
  it('every added chest stands on a free tile with a walkable approach joined to the open ground', async () => {
    const { __openSite } = await import('./helpers/g1b-ecology');
    const bySite = new Map<string, typeof G1B_ECOLOGY_SOURCES[number][]>(); for (const s of G1B_ECOLOGY_SOURCES) { const k = s.zone === 'ROAD' ? `road:${Math.floor(s.gx / 64)},${Math.floor(s.gy / 64)}` : s.site; if (!bySite.has(k)) bySite.set(k, []); bySite.get(k)!.push(s); }
    const bad: string[] = []; let checked = 0;
    for (const [, list] of bySite) {
      const cx = list.reduce((n, s) => n + s.gx, 0) / list.length, cy = list.reduce((n, s) => n + s.gy, 0) / list.length;
      for (const [dx, dy] of [[0, 0], [17, 9]]) {
        const site = __openSite(cx + dx, cy + dy); if (!site) { bad.push(`${list[0].site}: window does not compile`); continue; }
        const reach = site.flood();
        for (const s of list) {
          const lv = s.level ?? 0; if (!site.inb(s.gx, s.gy) || !site.inb(s.ax!, s.ay!)) continue; checked++;
          if (!site.pass(lv, s.gx, s.gy)) bad.push(`${s.id}: chest tile ${s.gx},${s.gy} is not free at origin +${dx},${dy}`);
          else if (!site.pass(lv, s.ax!, s.ay!) || !reach.has(`${lv}:${s.ax},${s.ay}`)) bad.push(`${s.id}: approach ${s.ax},${s.ay} not reachable at origin +${dx},${dy}`);
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(G1B_ECOLOGY_SOURCES.length);
    expect(bad).toEqual([]);
  }, 1800000);
});
