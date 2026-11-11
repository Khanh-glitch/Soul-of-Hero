import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { TILE, WW, type Entity, type GameState, type RunState } from '../src/game/core';
import { ITEMS, RECIPES } from '../src/game/catalog';
import { addItem, blockGrid, C, dispatch, markDirty, mkContainer, mkStack, newGame } from '../src/game/engine';
import { getWorld, setActiveLayout } from '../src/game/world';
import { craftReadiness } from '../src/game/action-readiness';
import { deathBagView } from '../src/game/death-view';
import { addFieldMark, discoveredCell, readFieldMarks, storeFieldMarks } from '../src/game/map-notes';
import { experienceFromCue } from '../src/game/experience';

const NOW = Date.UTC(2026, 10, 8, 9);
let baseline: GameState;
let serial = 0;

beforeAll(() => {
  setActiveLayout('shipping_fresh');
  baseline = newGame();
  expect(dispatch(baseline, { id: 'visual-init', type: 'startRun', character: 'female', seed: 123 }, NOW).ok).toBe(true);
  const r = baseline.run!;
  r.creatures = [];
  const grid = blockGrid(r), w = getWorld();
  let found = false;
  for (let y = 20; y < 180 && !found; y++) for (let x = 20; x < 180 && !found; x++) {
    if ([[0, 0], [1, 0], [2, 0]].every(([dx, dy]) => grid[(y + dy) * WW + x + dx] === 0 && !w.sourceV3[(y + dy) * WW + x + dx])) {
      r.player.x = x * TILE + 8; r.player.y = y * TILE + 8;
      found = true;
    }
  }
  expect(found).toBe(true);
  C(r, 'inv').slots = Array(24).fill(null);
  markDirty();
});
afterAll(() => setActiveLayout('shipping'));

const fixture = () => { setActiveLayout('shipping_fresh'); const g = structuredClone(baseline); markDirty(); return { g, r: g.run! }; };
const action = (g: GameState, type: string, args: Record<string, unknown> = {}) => dispatch(g, { id: `visual-${++serial}`, type, ...args }, NOW + 1000 + serial);
function station(r: RunState, type: 'workbench' | 'refinery' | 'oil_pump', dx = 1, level: 1 | 2 | 3 = 1): Entity {
  const x = r.player.x + dx * TILE, y = r.player.y;
  const e: Entity = { id: `visual-${type}-${dx}`, kind: 'struct', type, x, y, tx: Math.floor(x / TILE), ty: Math.floor(y / TILE), hp: 160, maxHp: 160,
    station: { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 3).id, outC: mkContainer(r, 'out', 6).id, ...(type === 'workbench' ? { level } : {}) },
    ...(type === 'refinery' ? { identity: 'refinery-v1' as const } : {}) };
  r.entities[e.id] = e; markDirty(); return e;
}
const materials = (r: RunState, key: string) => { r.knowledge.recipes.push(key); for (const [k, q] of RECIPES[key].ins) expect(addItem(r, 'inv', k, q)).toBe(0); };

describe('same live readiness on recipe tile, detail, and station', () => {
  it('has materials but no reachable station: blocked, not green-ready', () => {
    const { g, r } = fixture(); materials(r, 'motorbike_kit');
    const v = craftReadiness(r, 'motorbike_kit', NOW + 10);
    expect(v.code).toBe('station'); expect(v.state).toBe('blocked'); expect(v.canSubmit).toBe(false);
    expect(action(g, 'craft', { recipe: 'motorbike_kit' }).ok).toBe(false);
  });
  it('chooses the reachable level-3 workbench over a level-1 bench; submits that exact ID', () => {
    const { g, r } = fixture(); materials(r, 'motorbike_kit');
    const low = station(r, 'workbench', 1, 1);
    expect(craftReadiness(r, 'motorbike_kit', NOW + 10).code).toBe('level');
    const high = station(r, 'workbench', 2, 3);
    const v = craftReadiness(r, 'motorbike_kit', NOW + 10);
    expect(v.station?.id).toBe(high.id); expect(v.state).toBe('ready');
    expect(action(g, 'craft', { recipe: 'motorbike_kit', eid: v.station?.id }).ok).toBe(true);
    expect(high.station!.queue).toHaveLength(1); expect(low.station!.queue).toHaveLength(0);
  });
  it('distinguishes accepting a queued job from actually working without fuel', () => {
    const { g, r } = fixture(); materials(r, 'refinery_industrial');
    const ref = station(r, 'refinery');
    const v = craftReadiness(r, 'refinery_industrial', NOW + 10, ref.id);
    expect(v.state).toBe('waiting'); expect(v.code).toBe('fuel'); expect(v.canSubmit).toBe(true); expect(v.canWork).toBe(false);
    expect(action(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }).ok).toBe(true);
    expect(ref.station!.queue).toHaveLength(1);
  });
  it('blocks a full queue and a multi-output batch that cannot land as a whole', () => {
    const { g, r } = fixture(); materials(r, 'refinery_industrial'); const ref = station(r, 'refinery'); ref.station!.burn = 60000;
    ref.station!.queue = Array.from({ length: 6 }, (_, i) => ({ id: `j${i}`, recipe: 'refinery_industrial', left: 10000, total: 10000, reserved: [] }));
    expect(craftReadiness(r, 'refinery_industrial', NOW + 10, ref.id).code).toBe('queue');
    expect(action(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }).ok).toBe(false);
    ref.station!.queue = [];
    C(r, ref.station!.outC).slots = Array(6).fill(null).map(() => mkStack(r, 'stone', ITEMS.stone.max));
    const v = craftReadiness(r, 'refinery_industrial', NOW + 10, ref.id);
    expect(v.code).toBe('output'); expect(v.canSubmit).toBe(false);
    expect(action(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }).ok).toBe(false);
  });
  it('single-output job may queue with full output, explicitly marked waiting', () => {
    const { g, r } = fixture(); materials(r, 'refinery_fuel'); const ref = station(r, 'refinery'); ref.station!.burn = 60000;
    C(r, ref.station!.outC).slots = Array(6).fill(null).map(() => mkStack(r, 'stone', ITEMS.stone.max));
    const v = craftReadiness(r, 'refinery_fuel', NOW + 10, ref.id);
    expect(v.state).toBe('waiting'); expect(v.code).toBe('output'); expect(v.canSubmit).toBe(true);
    expect(action(g, 'craft', { recipe: 'refinery_fuel', eid: ref.id }).ok).toBe(true);
  });
  it('hand recipe with a truly full pack is blocked even with enough inputs', () => {
    const { g, r } = fixture();
    C(r, 'inv').slots = Array(24).fill(null).map(() => mkStack(r, 'stone', 1));
    C(r, 'inv').slots[0] = mkStack(r, 'fiber', 9);
    expect(craftReadiness(r, 'rope', NOW + 10).code).toBe('pack');
    expect(action(g, 'craft', { recipe: 'rope' }).ok).toBe(false);
  });
  it('a physically busy input is blocked before the player spends it', () => {
    const { g, r } = fixture(); materials(r, 'rope');
    const slot = C(r, 'inv').slots.findIndex(s => s?.key === 'fiber');
    r.player.action = { kind: 'swing', t: 10, dur: 300, angle: 0, slot };
    expect(craftReadiness(r, 'rope', NOW + 10).code).toBe('busy');
    expect(action(g, 'craft', { recipe: 'rope' }).ok).toBe(false);
  });
});

describe('death receipt, not nearest bag; no invented stock', () => {
  it('shows the exact bag ID committed by the last death', () => {
    const { r } = fixture(); const trueC = mkContainer(r, 'bag', 2), otherC = mkContainer(r, 'bag', 2);
    trueC.slots[0] = mkStack(r, 'core_dragon', 1); otherC.slots[0] = mkStack(r, 'rcash', 99);
    r.entities.distant = { id: 'distant', kind: 'bag', x: r.player.x + 128, y: r.player.y, c: trueC.id };
    r.entities.nearest = { id: 'nearest', kind: 'bag', x: r.player.x + 8, y: r.player.y, c: otherC.id };
    r.receipts.push({ id: 'r-last-death', seq: 9000, at: NOW, kind: 'death', detail: 'cold; bag=distant' });
    const view = deathBagView(r);
    expect(view.status).toBe('present'); expect(view.bagId).toBe('distant');
    expect(view.stacks.map(s => s.key)).toEqual(['core_dragon']);
    delete r.entities.distant;
    expect(deathBagView(r).status).toBe('missing');
    expect(deathBagView(r).stacks).toEqual([]);
  });
  it('no bag, no receipt, and a removed bag each remain explicit', () => {
    const { r } = fixture(); expect(deathBagView(r).status).toBe('unverified');
    r.receipts.push({ id: 'r-death-none', seq: 9001, at: NOW, kind: 'death', detail: 'fire; bag=none' });
    expect(deathBagView(r).status).toBe('none');
    r.receipts.push({ id: 'r-death-gone', seq: 9002, at: NOW, kind: 'death', detail: 'fire; bag=b-missing' });
    expect(deathBagView(r).status).toBe('missing');
  });
});

describe('field notes never reveal unseen cells or write to the ordinary save in QA', () => {
  it('rejects unexplored terrain; accepts known ground and survives QA reopening only in memory', () => {
    const { r } = fixture(); r.discovered = Array(2500).fill(0); r.discovered[2 * 50 + 2] = 1;
    expect(discoveredCell(r, 9, 9)).toBe(true); expect(discoveredCell(r, 40, 40)).toBe(false);
    expect(addFieldMark(r, [], 40, 40, 'danger', 'secret').error).toMatch(/explored/i);
    const note = addFieldMark(r, [], 9, 9, 'return', 'Gathered wood'); expect(note.marks).toHaveLength(1);
    const old = (globalThis as any).localStorage;
    (globalThis as any).localStorage = { getItem: () => { throw Error('production key read'); }, setItem: () => { throw Error('production key write'); } };
    try { expect(storeFieldMarks(r, true, note.marks)).toBe(true); expect(readFieldMarks(r, true)).toEqual(note.marks); }
    finally { (globalThis as any).localStorage = old; }
  });
  it('a stale warning receipt disappears when the real machine has since been refuelled', () => {
    const { r } = fixture(); const ref = station(r, 'refinery'); ref.station!.burn = 10000;
    expect(experienceFromCue({ kind: 'station_state_changed', cause: 'station.state', subject: ref.id, receiptId: 'r9', at: NOW, detail: `${ref.id}:running>fuel_out` }, r)).toBeNull();
  });
});