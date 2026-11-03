import { describe, expect, it } from 'vitest';
import { BAL, HOUR, TILE, WW, type GameState, type Entity } from '../src/game/core';
import { addItem, C, countItem, dispatch, markDirty, mkContainer, newGame, sourceAt, stepGardensBarrels, stepStations, weatherAt, isWet, mkCreature } from '../src/game/engine';
import { getWorld } from '../src/game/world';
import { ignite, settle, syncWorld, tick, type Input } from '../src/game/sim';
import { selectSnapshots, serializeSnapshot } from '../src/game/persist';

const T0 = Date.UTC(2026, 10, 1, 12);
let serial = 0;
function fresh() { const gs = newGame(); markDirty(); expect(dispatch(gs, { id: `chrono${++serial}`, type: 'startRun', character: 'female', region: 0, seed: 101 }, T0).ok).toBe(true); gs.run!.creatures = []; return gs; }
function station(gs: GameState, type = 'furnace', slots = 6) {
  const r = gs.run!, p = r.player, fuel = mkContainer(r, 'fuel', 3), out = mkContainer(r, 'out', slots);
  const e: Entity = { id: `station${++serial}`, kind: 'struct', type, x: p.x + 16, y: p.y, tx: Math.floor((p.x + 16) / TILE), ty: Math.floor(p.y / TILE), hp: 100, maxHp: 100, station: { fuelC: fuel.id, outC: out.id, burn: 0, queue: [] } };
  r.entities[e.id] = e; markDirty(); return e;
}
function job(gs: GameState, e: Entity, left = 10000) { e.station!.queue.push({ id: `job${++serial}`, recipe: 'iron_ingot', left, total: 10000, reserved: [] }); }
function garden(gs: GameState, water: number, growth = 0) { const r = gs.run!, p = r.player; const e: Entity = { id: `garden${++serial}`, kind: 'struct', type: 'garden', x: p.x + 32, y: p.y, tx: Math.floor((p.x + 32) / TILE), ty: Math.floor(p.y / TILE), garden: { crop: 'turnip', growth, water } }; r.entities[e.id] = e; markDirty(); return e; }
function scheduleRain(gs: GameState, boundary: number) { const r = gs.run!; r.startedAt = T0 - BAL.weather.slotMinutes * 60000 + boundary; for (let seed = 0; seed < 1000; seed++) { r.seed = seed; if (!isWet(weatherAt(r, T0)) && isWet(weatherAt(r, T0 + boundary))) return; } throw new Error('no weather schedule'); }
function fire(gs: GameState, end: number) { const r = gs.run!, w = getWorld(); for (let i = 0; i < w.src.length; i++) { const x = i % WW, y = Math.floor(i / WW), s = sourceAt(r, x, y); if (s?.def.mat === 'wood' && s.def.tall && s.stock > 0 && ignite(gs, x, y, T0)) { (r.sources[i] as any).fire = end; return i; } } throw new Error('no ignitable tree'); }
const idle: Input = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false };

describe('B2-B chronology', () => {
  it('limits dry crop growth to the time covered by available water', () => {
    const gs = fresh(), e = garden(gs, 0.05); stepGardensBarrels(gs, 60000, false);
    expect(e.garden!.water).toBeCloseTo(0); expect(e.garden!.growth).toBeCloseTo(12000 / 300000);
  });
  it('rain intake and crop growth are partition-invariant even after the crop matures', () => {
    const a = fresh(); const e = garden(a, 0); const b = structuredClone(a); markDirty();
    stepGardensBarrels(a, 600000, true); for (let i = 0; i < 10; i++) stepGardensBarrels(b, 60000, true);
    expect(e.garden!.growth).toBeCloseTo(b.run!.entities[e.id].garden!.growth); expect(e.garden!.water).toBeCloseTo(b.run!.entities[e.id].garden!.water);
  });
  it('a furnace with a completed job and full output does not repeatedly consume fuel across calls', () => {
    const gs = fresh(), r = gs.run!, e = station(gs, 'furnace', 1); addItem(r, e.station!.fuelC, 'wood', 1); addItem(r, e.station!.outC, 'iron_ingot', 40); job(gs, e);
    stepStations(gs, 10000, T0 + 10000); const burn = e.station!.burn; expect(e.station!.queue[0].left).toBe(0);
    for (let i = 1; i <= 10; i++) stepStations(gs, 1000, T0 + 10000 + i * 1000);
    expect(e.station!.burn).toBe(burn); expect(countItem(r, e.station!.outC, 'iron_ingot')).toBe(40);
  });
  it('rain arriving before burnout extinguishes, rather than converting the tree to burnt', () => {
    const gs = fresh(); scheduleRain(gs, 5000); const r = gs.run!, i = fire(gs, 7500);
    settle(gs, T0 + 12000); expect((r.sources[i] as any).fire).toBe(0); expect(r.sources[i].burnt).not.toBe(true); expect(r.receipts.filter(x => x.kind === 'fire.burnout')).toHaveLength(0);
  });
  it('burnout before rain is a real burnout with the normal receipt', () => {
    const gs = fresh(); scheduleRain(gs, 9000); const r = gs.run!, i = fire(gs, 5000);
    settle(gs, T0 + 12000); expect(r.sources[i].burnt).toBe(true); expect(r.receipts.filter(x => x.kind === 'fire.burnout')).toHaveLength(1);
  });
  it('stops production exactly at expiry even if Continue happens later', () => {
    const gs = fresh(), r = gs.run!, e = station(gs); addItem(r, e.station!.fuelC, 'wood', 1); job(gs, e);
    const expiry = r.startedAt + BAL.run.maxRunHours * HOUR - r.qaOffset; r.clock.lastSimAt = expiry - 5000;
    settle(gs, expiry + 10000); expect(countItem(r, e.station!.outC, 'iron_ingot')).toBe(0); expect(e.station!.queue[0].left).toBe(5000); expect(gs.profile.history[0].endedAt).toBe(expiry);
  });
  it('recovers throttled autonomous time without replaying held movement', () => {
    const gs = fresh(), r = gs.run!, e = station(gs); addItem(r, e.station!.fuelC, 'wood', 1); job(gs, e);
    const x = r.player.x; tick(gs, { ...idle, right: true }, 50, T0 + 10050);
    expect(countItem(r, e.station!.outC, 'iron_ingot')).toBe(1); expect(r.player.x - x).toBeLessThanOrEqual(4); expect(r.clock.simMs).toBe(10050);
    tick(gs, idle, 50, T0 + 10100); expect(countItem(r, e.station!.outC, 'iron_ingot')).toBe(1); expect(r.receipts.filter(x => x.kind === 'job.done')).toHaveLength(1);
  });
  it('continues a saved finished job twice without duplicating the output or receipt', () => {
    const gs = fresh(), r = gs.run!, e = station(gs); addItem(r, e.station!.fuelC, 'wood', 1); job(gs, e);
    settle(gs, T0 + 20000); let loaded = selectSnapshots([serializeSnapshot(gs), null]).gs!;
    settle(loaded, T0 + 20000); loaded = selectSnapshots([serializeSnapshot(loaded), null]).gs!; settle(loaded, T0 + 20000);
    expect(countItem(loaded.run!, e.station!.outC, 'iron_ingot')).toBe(1); expect(loaded.run!.receipts.filter(x => x.kind === 'job.done')).toHaveLength(1);
  });
  it('preserves ordered world results and output identity across large versus partitioned settlement', () => {
    const a = fresh(), r = a.run!, first = station(a), second = station(a); addItem(r, first.station!.fuelC, 'wood', 2); addItem(r, second.station!.fuelC, 'wood', 1);
    job(a, first, 10000); job(a, first, 10000); job(a, second, 6000); const bed = garden(a, 0.3);
    scheduleRain(a, 20000); const tree = fire(a, 7000);
    r.traces = [{ id: 'tr-a', chainId: 'tr-a', x: r.player.x, y: r.player.y, t: T0, life: 900000, a: 0, s: 3 }];
    const b = structuredClone(a); markDirty();
    settle(a, T0 + 180000); for (let t = 17000; t < 180000; t += 17000) settle(b, T0 + t); settle(b, T0 + 180000);
    const project = (g: GameState) => { const q = g.run!; return { stations: [first.id, second.id].map(id => { const st = q.entities[id].station!; return { queue: st.queue, burn: st.burn, fuel: C(q, st.fuelC).slots, out: C(q, st.outC).slots }; }), garden: q.entities[bed.id].garden, tree: q.sources[tree], traces: q.traces, simMs: q.clock.simMs, rng: q.rng, events: q.receipts.filter(z => z.kind === 'job.done' || z.kind === 'fire.burnout').map(z => ({ kind: z.kind, detail: z.detail, at: z.at })) }; };
    const one = project(a), many = project(b); expect(one.stations).toEqual(many.stations); expect(one.tree).toEqual(many.tree); expect(one.traces).toEqual(many.traces); expect(one.events).toEqual(many.events); expect(one.simMs).toBe(many.simMs); expect(one.rng).toBe(many.rng); expect(one.garden!.growth).toBeCloseTo(many.garden!.growth, 8); expect(one.garden!.water).toBeCloseTo(many.garden!.water, 8);
    expect(one.events.map(x => x.at)).toEqual([T0 + 6000, T0 + 7000, T0 + 10000, T0 + 20000]);
  });
  it('normal online ticks and settlement advance the same autonomous stations and garden for the same dry interval', () => {
    const a = fresh(), r = a.run!, e = station(a), bed = garden(a, 1); addItem(r, e.station!.fuelC, 'wood', 1); job(a, e);
    for (let seed = 0; seed < 1000; seed++) { r.seed = seed; if (!isWet(weatherAt(r, T0)) && !isWet(weatherAt(r, T0 + 12000))) break; }
    const b = structuredClone(a); markDirty(); settle(a, T0 + 12000); for (let i = 1; i <= 240; i++) tick(b, idle, 50, T0 + i * 50);
    expect(b.run!.entities[e.id].station).toEqual(a.run!.entities[e.id].station);
    expect(C(b.run!, e.station!.outC).slots).toEqual(C(a.run!, e.station!.outC).slots);
    expect(b.run!.entities[bed.id].garden!.growth).toBeCloseTo(a.run!.entities[bed.id].garden!.growth, 7);
    expect(b.run!.entities[bed.id].garden!.water).toBeCloseTo(a.run!.entities[bed.id].garden!.water, 7);
    expect(b.run!.clock.simMs).toBe(a.run!.clock.simMs);
  });
  it('uses wall time for autonomous work during hitstop while physical movement stays slowed', () => {
    const gs = fresh(), r = gs.run!, e = station(gs); addItem(r, e.station!.fuelC, 'wood', 1); job(gs, e, 100);
    const x = r.player.x; tick(gs, { ...idle, right: true }, 4, T0 + 50); tick(gs, { ...idle, right: true }, 4, T0 + 100);
    expect(countItem(r, e.station!.outC, 'iron_ingot')).toBe(1); expect(r.clock.simMs).toBe(100); expect(Math.abs(r.player.x - x)).toBeLessThan(1);
  });
  it('retains an unexpired dry fire and resolves simultaneous rain and burnout as wet', () => {
    const gs = fresh(), r = gs.run!; scheduleRain(gs, 6000); const i = fire(gs, 6000);
    settle(gs, T0 + 4000); expect((r.sources[i] as any).fire).toBe(6000); expect(r.sources[i].burnt).not.toBe(true);
    settle(gs, T0 + 10000); expect((r.sources[i] as any).fire).toBe(0); expect(r.sources[i].burnt).not.toBe(true);
  });
  it('commits an already-finished, newly-unblocked job without extra fuel or work', () => {
    const gs = fresh(), r = gs.run!, e = station(gs, 'furnace', 1); addItem(r, e.station!.fuelC, 'wood', 1); addItem(r, e.station!.outC, 'iron_ingot', 40); job(gs, e, 10000);
    stepStations(gs, 10000, T0 + 10000); const left = e.station!.burn; C(r, e.station!.outC).slots[0] = null;
    stepStations(gs, 0, T0 + 10000); expect(e.station!.burn).toBe(left); expect(countItem(r, e.station!.outC, 'iron_ingot')).toBe(1); expect(e.station!.queue).toHaveLength(0);
  });
  it('keeps offline survival depletion and death consistent across partitions', () => {
    const a = fresh(), r = a.run!; r.player.hunger = 0.1; r.player.thirst = 100; r.player.hp = 20;
    const b = structuredClone(a); markDirty(); settle(a, T0 + 20 * 60000);
    for (let t = 37000; t < 20 * 60000; t += 37000) settle(b, T0 + t); settle(b, T0 + 20 * 60000);
    expect(r.player.dead).toBe(true); expect(b.run!.player.dead).toBe(true); expect(r.player.hunger).toBeCloseTo(b.run!.player.hunger, 6); expect(r.player.thirst).toBeCloseTo(b.run!.player.thirst, 6);
    const da = r.receipts.find(x => x.kind === 'death')!, db = b.run!.receipts.find(x => x.kind === 'death')!; expect(Math.abs(da.at - db.at)).toBeLessThan(2);
    expect(Object.values(r.entities).filter(e => e.kind === 'bag')).toHaveLength(1); expect(Object.values(b.run!.entities).filter(e => e.kind === 'bag')).toHaveLength(1);
  });
  it('processes the maximum run duration in bounded minute/event steps, not frame replay', () => {
    const gs = fresh(); gs.run!.player.dead = true; const begin = performance.now(); settle(gs, T0 + BAL.run.maxRunHours * HOUR + 10000);
    expect(gs.run).toBeNull(); expect(gs.profile.history[0].endedAt).toBe(T0 + BAL.run.maxRunHours * HOUR); expect(performance.now() - begin).toBeLessThan(15000);
  });

  it('real reserved inputs survive mid-job Continue and yield one output per job with stable UIDs', () => {
    const gs = fresh(), r = gs.run!, e = station(gs); addItem(r, e.station!.fuelC, 'wood', 1); addItem(r, 'inv', 'iron_ore', 2);
    for (let k = 0; k < 2; k++) expect(dispatch(gs, { id: `paid${++serial}`, type: 'craft', eid: e.id, recipe: 'iron_ingot' }, T0).ok).toBe(true);
    const reserved = e.station!.queue.map(j => j.reserved![0].uid); expect(new Set(reserved).size).toBe(2);
    settle(gs, T0 + 5000); let resumed = selectSnapshots([serializeSnapshot(gs), null]).gs!; settle(resumed, T0 + 5000);
    expect(resumed.run!.entities[e.id].station!.queue.map(j => j.reserved![0].uid)).toEqual(reserved);
    settle(resumed, T0 + 20000); resumed = selectSnapshots([serializeSnapshot(resumed), null]).gs!; settle(resumed, T0 + 20000);
    expect(countItem(resumed.run!, e.station!.outC, 'iron_ingot')).toBe(2);
    expect(resumed.run!.receipts.filter(x => x.kind === 'job.done')).toHaveLength(2);
    expect(resumed.run!.entities[e.id].station!.queue).toHaveLength(0);
    const uids = Object.values(resumed.run!.custody).flatMap(c => c.slots.filter(Boolean).map(s => s!.uid)); expect(new Set(uids).size).toBe(uids.length); expect(reserved.every(id => !uids.includes(id))).toBe(true);
  });

  it('does not simulate fire spread, attacks or wildlife during offline catch-up', () => {
    const gs = fresh(), r = gs.run!; scheduleRain(gs, 20000); const i = fire(gs, 7000), x = (i % WW) * TILE + 8, y = Math.floor(i / WW) * TILE + 8;
    r.player.x = x; r.player.y = y; const m = mkCreature(r, 'wolf', x, y, 100); r.creatures.push(m);
    const rng = r.rng, creature = structuredClone(m), sourceCount = Object.keys(r.sources).length;
    const control = structuredClone(gs); (control.run!.sources[i] as any).fire = 0; markDirty();
    settle(gs, T0 + 10000); settle(control, T0 + 10000); expect(r.rng).toBe(rng); expect(r.player.hp).toBe(control.run!.player.hp); expect(m).toEqual(creature); expect(Object.keys(r.sources)).toHaveLength(sourceCount);
  });
  it('roof blocks rain intake while existing garden water still feeds the crop', () => {
    const gs = fresh(), r = gs.run!, e = garden(gs, 0.05);
    const roof: Entity = { id: `roof${++serial}`, kind: 'struct', type: 'roof_thatch', x: e.x, y: e.y, tx: e.tx, ty: e.ty }; r.entities[roof.id] = roof; markDirty();
    stepGardensBarrels(gs, 60000, true); expect(e.garden!.water).toBeCloseTo(0); expect(e.garden!.growth).toBeCloseTo(12000 / 300000);
  });
  it('does not replay a backwards clock and bounds a pre-run legacy checkpoint', () => {
    const gs = fresh(), r = gs.run!, e = station(gs); addItem(r, e.station!.fuelC, 'wood', 1); job(gs, e);
    settle(gs, T0 + 5000); const before = e.station!.queue[0].left; settle(gs, T0 + 4000); expect(e.station!.queue[0].left).toBe(before); expect(r.clock.lastSimAt).toBe(T0 + 5000);
    r.clock.lastSimAt = 0; r.clock.simMs = 0; settle(gs, T0 + 1000); expect(r.clock.lastSimAt).toBe(T0 + 1000);
  });

  it('a throttled frame crossing expiry cannot advance a job beyond it', () => {
    const gs = fresh(), r = gs.run!, e = station(gs); addItem(r, e.station!.fuelC, 'wood', 1); job(gs, e);
    const expiry = r.startedAt + BAL.run.maxRunHours * HOUR - r.qaOffset; r.clock.lastSimAt = expiry - 5000;
    tick(gs, { ...idle, right: true }, 50, expiry + 10000);
    expect(gs.run).toBeNull(); expect(gs.profile.history[0].endedAt).toBe(expiry); expect(e.station!.queue[0].left).toBe(5000); expect(countItem(r, e.station!.outC, 'iron_ingot')).toBe(0);
  });
  it('finishes work exactly at expiry before the run-local wipe, never after it', () => {
    const gs = fresh(), r = gs.run!, e = station(gs); addItem(r, e.station!.fuelC, 'wood', 1); job(gs, e, 5000);
    const expiry = r.startedAt + BAL.run.maxRunHours * HOUR - r.qaOffset; r.clock.lastSimAt = expiry - 5000;
    settle(gs, expiry + 5000); expect(gs.run).toBeNull(); expect(r.receipts.find(x => x.kind === 'job.done')?.at).toBe(expiry); expect(countItem(r, e.station!.outC, 'iron_ingot')).toBe(1);
  });

  it('synchronizes elapsed time before an input so a newly queued job cannot run retroactively', () => {
    const gs = fresh(), r = gs.run!, e = station(gs); addItem(r, e.station!.fuelC, 'wood', 1); addItem(r, 'inv', 'iron_ore', 1);
    expect(syncWorld(gs, T0 + 10000)).toBe(true);
    expect(dispatch(gs, { id: `queued-now${++serial}`, type: 'craft', eid: e.id, recipe: 'iron_ingot' }, T0 + 10000).ok).toBe(true);
    tick(gs, idle, 16, T0 + 10016); expect(e.station!.queue[0].left).toBe(9984); expect(countItem(r, e.station!.outC, 'iron_ingot')).toBe(0);
  });

  it('rejects an engine transaction at expiry before the next settlement frame', () => {
    const gs = fresh(), r = gs.run!, e = station(gs); addItem(r, 'inv', 'iron_ore', 1);
    const expiry = r.startedAt + BAL.run.maxRunHours * HOUR - r.qaOffset;
    expect(dispatch(gs, { id: `expired${++serial}`, type: 'craft', eid: e.id, recipe: 'iron_ingot' }, expiry).ok).toBe(false);
    expect(countItem(r, 'inv', 'iron_ore')).toBe(1); expect(e.station!.queue).toHaveLength(0);
    settle(gs, expiry); expect(gs.run).toBeNull();
  });

  it('keeps the existing always-burning campfire rule while output is blocked, independent of partition size', () => {
    const a = fresh(), r = a.run!, e = station(a, 'campfire', 1); addItem(r, e.station!.fuelC, 'wood', 2); addItem(r, e.station!.outC, 'stone_axe', 1);
    e.station!.queue.push({ id: `cjob${++serial}`, recipe: 'cooked_meat', left: 8000, total: 8000, reserved: [] });
    const b = structuredClone(a); markDirty(); stepStations(a, 30000, T0 + 30000);
    for (let n = 1; n <= 6; n++) stepStations(b, 5000, T0 + n * 5000);
    const st = b.run!.entities[e.id].station!; expect(e.station!.burn).toBe(10000); expect(st.burn).toBe(10000);
    expect(e.station!.queue[0].left).toBe(0); expect(st.queue[0].left).toBe(0); expect(C(r, e.station!.fuelC).slots).toEqual(C(b.run!, st.fuelC).slots);
  });

});
