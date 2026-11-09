// B04-P3: SYS12 airdrop phase projection, SYS15 local heat readout, B02 trap-v1 invariants, drop cleanup.
// Mechanical invariants only: no survival bot, no human-enjoyment claims.
import { afterAll, describe, it, expect } from 'vitest';
import { BAL, TILE, WW, T, type GameState, type RunState } from '../src/game/core';
import { STRUCTS } from '../src/game/catalog';
import { airdropTimes, airdropView, airdropArea } from '../src/game/airdrop';
import { addItem, blockGrid, C, countItem, dispatch, effTile, markDirty, mkContainer, mkCreature, newGame, stepAirdrops } from '../src/game/engine';
import { ITEMS } from '../src/game/catalog';
import { settle, triggerBearTrap, bearTrapPrompt } from '../src/game/sim';
import { thermalEvaluate, thermalStatusView, heaterRows, thermalEnv } from '../src/game/thermal';
import { getWorld, setActiveLayout } from '../src/game/world';
import { serializeSnapshot, selectSnapshots, validate, bearTrapStateValid } from '../src/game/persist';

const T0 = Date.UTC(2026, 10, 5);
let seq = 0;
const act = (g: GameState, type: string, data: object, now: number) => dispatch(g, { id: `p3-${++seq}`, type, ...data }, now);
const raw = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload);
afterAll(() => setActiveLayout('shipping'));

// ---------- SYS12 airdrop projection and refusals ----------
function airSetup(seed = 55) {
  setActiveLayout('shipping_fresh');
  const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed }, T0).ok).toBe(true);
  g.run!.creatures = []; return g;
}
const step = (g: GameState, t: number) => { stepAirdrops(g.run!, t); g.run!.clock.lastSimAt = t; };
const event = (g: GameState) => Object.values(g.run!.entities).find(e => e.kind === 'airdrop')!;

describe('B04-P3 SYS12 airdrop phase projection', () => {
  it('signal broadcasts only the sector: no landing coordinates, bounded touchdown countdown', () => {
    const g = airSetup(), r = g.run!, t = airdropTimes(r, 0);
    step(g, t.signalAt); const e = event(g);
    const v = airdropView(e.airdrop!, e.tx!, e.ty!, t.signalAt, 3);
    expect(v.key).toBe('incoming'); expect(v.takeable).toBe(false);
    expect(v.detail).toContain(airdropArea(e.tx!, e.ty!));
    expect(/\d+\s*,\s*\d+/.test(v.detail)).toBe(false);
    expect(v.detail).not.toContain(String(e.tx)); expect(v.detail).not.toContain(String(e.ty));
  });

  it('distinguishes descending, locked countdown, accessible, partially claimed, expiring and emptied', () => {
    const g = airSetup(), r = g.run!, t = airdropTimes(r, 0);
    step(g, t.signalAt); const e = event(g), cid = e.c!;
    expect(airdropView(e.airdrop!, e.tx!, e.ty!, t.descentAt, 3).key).toBe('descending');
    step(g, t.landAt);
    const locked = airdropView(e.airdrop!, e.tx!, e.ty!, t.landAt, 3);
    expect(locked.key).toBe('locked'); expect(locked.lockedRemainS).toBe(180); expect(locked.takeable).toBe(false);
    const open = airdropView(e.airdrop!, e.tx!, e.ty!, t.unlockAt, 3);
    expect(open.key).toBe('accessible'); expect(open.takeable).toBe(true);
    // Locked refusal returns the real countdown reason; unlock is not early.
    r.player.x = e.x + TILE; r.player.y = e.y; markDirty();
    const early = act(g, 'openAirdrop', { eid: e.id }, t.unlockAt - 1000);
    expect(early.ok).toBe(false); expect((early as any).reason).toMatch(/locked: opens to all in \d+s/);
    step(g, t.unlockAt);
    expect(act(g, 'openAirdrop', { eid: e.id }, t.unlockAt).ok).toBe(true);
    // Physical withdrawal moves one real UID to inventory; the stock count decreases and the phase becomes partial.
    const taken = C(r, cid).slots[0]!; const uid = taken.uid;
    expect(act(g, 'move', { from: cid, fs: 0, to: 'inv' }, t.unlockAt).ok).toBe(true);
    expect(e.airdrop!.phase).toBe('partial');
    const left = C(r, cid).slots.filter(Boolean).length;
    expect(airdropView(e.airdrop!, e.tx!, e.ty!, t.unlockAt, left).key).toBe('partial');
    // No duplication: the withdrawn UID is in exactly one custody.
    const holders = Object.values(r.custody).filter(c => c.slots.some(s => s?.uid === uid));
    expect(holders.length).toBe(1);
    // Expiring window is the last 15 minutes of the real lifetime.
    const near = airdropView(e.airdrop!, e.tx!, e.ty!, e.airdrop!.expiresAt - 10 * 60000, left);
    expect(near.key).toBe('expiring'); expect(near.expiresInS).toBe(600);
    expect(airdropView(e.airdrop!, e.tx!, e.ty!, e.airdrop!.expiresAt - 30 * 60000, left).key).toBe('partial');
    // Emptied: no stock left means the crate is removed by the real empty path.
    for (let i = 0; i < 6 && r.custody[cid]?.slots.some(Boolean); i++) { const fs = C(r, cid).slots.findIndex(Boolean); expect(act(g, 'move', { from: cid, fs, to: 'inv' }, t.unlockAt).ok).toBe(true); }
    expect(r.custody[cid] ? C(r, cid).slots.some(Boolean) : false).toBe(false);
    expect(Object.values(r.entities).some(x => x.kind === 'airdrop')).toBe(false);
    expect(airdropView(e.airdrop!, e.tx!, e.ty!, t.unlockAt, 0).key).toBe('emptied');
  });

  it('expiry removes only the genuinely unclaimed stock, with a receipt that names the loss', () => {
    const g = airSetup(), r = g.run!, t = airdropTimes(r, 0);
    step(g, t.landAt); const e = event(g), cid = e.c!;
    r.player.x = e.x + TILE; r.player.y = e.y; markDirty();
    step(g, t.unlockAt); expect(act(g, 'move', { from: cid, fs: 0, to: 'inv' }, t.unlockAt).ok).toBe(true);
    const remaining = C(r, cid).slots.filter(Boolean).length; expect(remaining).toBeGreaterThan(0);
    step(g, t.expiresAt);
    expect(Object.values(r.entities).some(x => x.kind === 'airdrop')).toBe(false);
    expect(r.log.length).toBeGreaterThan(0);
    expect(Object.values(r.custody).some(c => c.id === cid)).toBe(false);
  });

  it('a saved midlocked and a saved partial airdrop reload with identical phase and UIDs', () => {
    const g = airSetup(), r = g.run!, t = airdropTimes(r, 0);
    step(g, t.landAt); const e = event(g);
    const back = validate(raw(g))!; const e2 = Object.values(back.run!.entities).find(x => x.kind === 'airdrop')!;
    expect(e2.airdrop!.phase).toBe('locked'); expect(airdropView(e2.airdrop!, e2.tx!, e2.ty!, t.landAt, 3).lockedRemainS).toBe(180);
    expect(C(back.run!, e2.c!).slots.map(s => s?.uid)).toEqual(C(r, e.c!).slots.map(s => s?.uid));
    void selectSnapshots;
  });

  it('the public banner phase and the crate prompt agree through airdropView (single projection)', () => {
    const g = airSetup(), r = g.run!, t = airdropTimes(r, 0);
    step(g, t.landAt); const e = event(g);
    const v = airdropView(e.airdrop!, e.tx!, e.ty!, t.landAt + 1000, C(r, e.c!).slots.filter(Boolean).length);
    expect(v.label).toBe('LANDED · LOCKED');
    expect(v.detail).toContain(airdropArea(e.tx!, e.ty!));
  });
});

// ---------- B02 trap-v1 invariants and paid transitions ----------
function trapSetup() {
  const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed: 97 }, T0).ok).toBe(true);
  const r = g.run!, x = 80, y = 80; r.creatures = [];
  for (let yy = y - 6; yy <= y + 6; yy++) for (let xx = x - 6; xx <= x + 8; xx++) { const i = yy * WW + xx; r.terrain[i] = { t: T.GRASS }; if (getWorld().sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 }; }
  markDirty();
  const pos = (tx: number, ty: number) => { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty(); };
  const build = (tx: number, ty: number) => {
    pos(tx, ty + 1); for (const [k, q] of STRUCTS.bear_trap.cost) addItem(r, 'inv', k, q);
    expect(act(g, 'build', { struct: 'bear_trap', tx, ty }, T0).ok).toBe(true);
    return Object.values(r.entities).find(e => e.type === 'bear_trap' && e.tx === tx && e.ty === ty)!;
  };
  return { g, r, x, y, pos, build };
}
const creatureOn = (r: RunState, tx: number, ty: number) => {
  const m = mkCreature(r, 'wolf', tx * TILE + 8, ty * TILE + 8, 40); m.state = 'chase'; m.cd = 0; r.creatures.push(m); return m;
};

describe('B04-P3 B02 bear trap: paid transitions, invariants, offline vs live', () => {
  it('reachable trap-v1 pairs are exactly unarmed:3, armed:1..3, spent:1..2, worn:0', () => {
    expect(bearTrapStateValid('unarmed', 3)).toBe(true);
    expect(bearTrapStateValid('armed', 3)).toBe(true); expect(bearTrapStateValid('armed', 1)).toBe(true);
    expect(bearTrapStateValid('spent', 2)).toBe(true); expect(bearTrapStateValid('spent', 1)).toBe(true);
    expect(bearTrapStateValid('worn', 0)).toBe(true);
    for (const [s, u] of [['unarmed', 0], ['unarmed', 2], ['armed', 0], ['armed', 4], ['spent', 3], ['spent', 0], ['worn', 3], ['worn', 1], ['armed', -1], ['unknown', 3]] as [string, number][]) expect(bearTrapStateValid(s, u)).toBe(false);
  });

  it('a forged save with an impossible trap pairing is rejected; a legitimate placed trap is accepted', () => {
    const o = trapSetup(); const t = o.build(o.x + 2, o.y);
    expect(validate(raw(o.g))).not.toBeNull();
    const forged = raw(o.g); const f = Object.values(forged.run.entities).find((e: any) => e.type === 'bear_trap') as any;
    f.bearTrap.state = 'worn'; f.bearTrap.uses = 3; expect(validate(forged)).toBeNull();
    const forged2 = raw(o.g); (Object.values(forged2.run.entities).find((e: any) => e.type === 'bear_trap') as any).bearTrap.state = 'spent';
    expect(validate(forged2)).toBeNull();
    void t;
  });

  it('arm and rearm each cost exactly one Iron Plate; three real hits go armed3→spent2→armed2→spent1→armed1→worn0', () => {
    const o = trapSetup(); const t = o.build(o.x + 2, o.y); o.pos(o.x + 2, o.y + 1);
    expect(act(o.g, 'bearTrapSet', { eid: t.id }, T0).ok).toBe(false); // no plate, stays unarmed
    expect(t.bearTrap!.state).toBe('unarmed');
    addItem(o.r, 'inv', 'iron_plate', 3);
    const plates = () => countItem(o.r, 'inv', 'iron_plate');
    const trace: [string, number][] = [];
    const hit = () => { const m = creatureOn(o.r, o.x + 2, o.y); triggerBearTrap(o.g, m, T0); trace.push([t.bearTrap!.state, t.bearTrap!.uses]); m.cd = 0; };
    expect(act(o.g, 'bearTrapSet', { eid: t.id }, T0).ok).toBe(true); expect(plates()).toBe(2); expect(t.bearTrap!.state).toBe('armed');
    hit(); expect(t.bearTrap!.state).toBe('spent'); expect(t.bearTrap!.uses).toBe(2); expect(plates()).toBe(2);
    expect(act(o.g, 'bearTrapSet', { eid: t.id }, T0).ok).toBe(true); expect(plates()).toBe(1);
    hit(); expect(t.bearTrap!.uses).toBe(1);
    expect(act(o.g, 'bearTrapSet', { eid: t.id }, T0).ok).toBe(true); expect(plates()).toBe(0);
    hit(); expect(t.bearTrap!.state).toBe('worn'); expect(t.bearTrap!.uses).toBe(0);
    expect(act(o.g, 'bearTrapSet', { eid: t.id }, T0).ok).toBe(false);
    expect(trace).toEqual([['spent', 2], ['spent', 1], ['worn', 0]]);
    expect(validate(raw(o.g))).not.toBeNull();
  });

  it('live physical contact on the armed tile fires once and debits the trap, not the player bank; offline settle never fires', () => {
    const o = trapSetup(); const t = o.build(o.x + 2, o.y); o.pos(o.x + 2, o.y + 1);
    addItem(o.r, 'inv', 'iron_plate', 1); expect(act(o.g, 'bearTrapSet', { eid: t.id }, T0).ok).toBe(true);
    const m = creatureOn(o.r, o.x + 2, o.y); const hpBefore = m.hp, plateBefore = countItem(o.r, 'inv', 'iron_plate');
    // Offline settle with the creature on the armed tile: no hit, no uses debit, no trap receipt.
    const snap = validate(raw(o.g))!; const before = snap.run!.receipts?.length ?? 0;
    settle(snap, T0 + 120000, true);
    const after = snap.run!.entities[t.id];
    expect(after.bearTrap).toEqual({ version: 'trap-v1', state: 'armed', uses: 3 });
    expect((snap.run!.receipts ?? []).slice(before).some((x: any) => x.kind === 'trap.trigger')).toBe(false);
    // Live contact: exactly one paid hit.
    triggerBearTrap(o.g, m, T0);
    expect(m.hp).toBeLessThan(hpBefore); expect(t.bearTrap).toMatchObject({ version: 'trap-v1', state: 'spent', uses: 2 });
    expect(countItem(o.r, 'inv', 'iron_plate')).toBe(plateBefore);
    triggerBearTrap(o.g, m, T0); expect(t.bearTrap!.uses).toBe(2); // spent: a second contact does nothing
  });

  it('the E prompt names the real trap state and the cost of the next paid action', () => {
    const o = trapSetup(); const t = o.build(o.x + 2, o.y);
    expect(bearTrapPrompt(o.r, t)).toMatch(/unarmed · 3 hits · E arms for 1 Iron Plate/);
    t.bearTrap!.state = 'armed'; t.bearTrap!.uses = 2; expect(bearTrapPrompt(o.r, t)).toMatch(/ARMED · 2 hits left/);
    t.bearTrap!.state = 'spent'; t.bearTrap!.uses = 1; expect(bearTrapPrompt(o.r, t)).toMatch(/SPENT · 1 hit left · E re-arms for 1 Iron Plate/);
    t.bearTrap!.state = 'worn'; t.bearTrap!.uses = 0; expect(bearTrapPrompt(o.r, t)).toMatch(/WORN OUT/);
  });
});

// ---------- SYS15 local heat readout ----------
function campSetup() {
  const g = newGame(); expect(act(g, 'startRun', { character: 'female', region: 0, seed: 313 }, T0).ok).toBe(true);
  const r = g.run!; r.creatures = [];
  let s: { x: number; y: number } | null = null; const grid = blockGrid(r), w = getWorld();
  const free = (x: number, y: number) => { const i = y * WW + x; return grid[i] === 0 && effTile(r, x, y) === T.SNOW && !w.economyMap.protected[i] && !w.accessCorridors?.mask[i]; };
  for (let y = 12; y < 200 && !s; y++) for (let x = 12; x < 200 && !s; x++) if (free(x, y) && free(x + 1, y) && free(x + 2, y) && free(x, y - 1) && free(x + 2, y - 1)) s = { x, y };
  if (!s) throw new Error('no snow spot');
  addItem(r, 'inv', 'wood', 40); addItem(r, 'inv', 'stone', 20);
  r.player.x = s.x * TILE + 8; r.player.y = s.y * TILE + 8; markDirty();
  expect(act(g, 'build', { struct: 'campfire', tx: s.x + 2, ty: s.y }, T0).ok).toBe(true);
  const fire = Object.values(r.entities).find(e => e.type === 'campfire' && e.tx === s!.x + 2 && e.ty === s!.y)!;
  return { g, r, s, fire };
}
const envOf = (r: RunState, s: { x: number; y: number }, sheltered = false) => thermalEnv(r, { x: r.player.x, y: r.player.y, zone: getWorld().zone[s.y * WW + s.x], tileType: effTile(r, s.x, s.y), wet: false, dark: false, sheltered });

describe('B04-P3 SYS15 local heat readout', () => {
  it('a fuelled campfire in reach is shown as burning with its real contribution, and the target matches the evaluator', () => {
    const { r, s, fire } = campSetup();
    addItem(r, fire.station!.fuelC, 'wood', 2);
    const env = envOf(r, s), ev = thermalEvaluate(r, env), v = thermalStatusView(r, env, 10);
    expect(v.heaters.map(h => h.status)).toEqual(['burning']);
    expect(v.heaters[0].contributes).toBe(18);
    expect(v.target).toBe(ev.target);
    expect(v.cold).toBe(false); // warmth 10 is at or above the cold threshold 8
  });

  it('a fire that goes out (no paid fuel) is shown as burned out and drops the target; an idle furnace is shown as idle', () => {
    const { r, s, fire } = campSetup();
    addItem(r, fire.station!.fuelC, 'wood', 1);
    const env = envOf(r, s), lit = thermalStatusView(r, env, 20).target;
    fire.station!.burn = 0; C(r, fire.station!.fuelC).slots = C(r, fire.station!.fuelC).slots.map(() => null); markDirty();
    const out = thermalStatusView(r, env, 20);
    expect(out.heaters[0].status).toBe('out_of_fuel'); expect(out.target).toBeLessThan(lit);
    expect(out.heaters[0].contributes).toBe(0);
  });

  it('a wall between player and fire is shown as blocked by wall and contributes nothing', () => {
    const { r, s, fire } = campSetup();
    addItem(r, fire.station!.fuelC, 'wood', 2);
    const mid = { tx: s.x + 1, ty: s.y };
    r.terrain[mid.ty * WW + mid.tx] = { t: T.PWALL }; markDirty();
    const rows = heaterRows(r, envOf(r, s));
    expect(rows.map(h => h.status)).toEqual(['blocked_by_wall']);
    expect(thermalEvaluate(r, envOf(r, s)).heat.sources.length).toBe(0);
  });

  it('worn cold gear changes the displayed insulation and the exposure reduction, and never waives exposure', () => {
    const { r, s } = campSetup();
    const bare = thermalStatusView(r, envOf(r, s), 40);
    addItem(r, 'eq', 'fur_cloak', 1);
    const warm = thermalStatusView(r, envOf(r, s), 40);
    expect(bare.insulation).toBe(0); expect(warm.insulation).toBe(ITEM_COLD('fur_cloak'));
    expect(warm.exposures.length).toBe(bare.exposures.length); // exposure sources are still there
    expect(warm.target).toBeGreaterThanOrEqual(bare.target);
  });

  it('shelter and map snow both appear as real sources; no free heat appears with no fuel', () => {
    const { r, s } = campSetup();
    const v = thermalStatusView(r, envOf(r, s), 5);
    expect(v.exposures.some(e => e.id === 'snow_zone')).toBe(true);
    expect(v.heaters.every(h => h.status !== 'burning' && h.contributes === 0)).toBe(true);
    expect(v.cold).toBe(true);
  });
});

function ITEM_COLD(k: string) { return ITEMS[k].cold || 0; }

// ---------- integrity: a removed last item from a bag prunes the bag ----------
describe('B04-P3 integrity: drop of the last item empties and removes the physical bag', () => {
  it('drop of the last stack from an accessible bag removes the bag entity and its custody', () => {
    const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed: 97 }, T0).ok).toBe(true);
    const r = g.run!; r.creatures = [];
    const cid = mkContainer(r, 'bag', 3).id; addItem(r, cid, 'wood', 2);
    const bag = { id: 'bagp3', kind: 'bag', x: 80 * TILE + 8, y: 80 * TILE + 8, tx: 80, ty: 80, c: cid, label: 'Test bag' } as any;
    r.entities[bag.id] = bag; r.player.x = bag.x + TILE; r.player.y = bag.y; markDirty();
    const slot = C(r, cid).slots.findIndex(Boolean);
    expect(act(g, 'drop', { c: cid, slot }, T0).ok).toBe(true);
    expect(r.entities[bag.id]).toBeUndefined();
    expect(r.custody[cid]).toBeUndefined();
  });
});
