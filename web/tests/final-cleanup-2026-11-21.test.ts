// Final-acceptance cleanup, 2026-11-21. Four defects found by playing commit 6d2dec8 in a browser:
//  1. picked-up wood took one slot per log instead of topping up the carried stack;
//  2. residents were named after a random trade ("Guard Highland" was the cook);
//  3. after a long absence the Chronicle and the death panel disagreed about the player's bag,
//     because the death receipt had rotated out of the 250-entry ledger;
//  4. the player-facing build offered QA Sandbox / Creator Inspector / an empty Classic Island.
import { describe, it, expect, beforeAll } from 'vitest';
import { newGame, startRun, dispatch, mkStack, mkContainer, C, countItem, killPlayer, addItem } from '../src/game/engine';
import { ITEMS } from '../src/game/catalog';
import { uid, type Entity, type RunState } from '../src/game/core';
import { setActiveLayout } from '../src/game/world';
import { deathBagView } from '../src/game/death-view';
import { serializeSnapshot, selectSnapshots } from '../src/game/persist';
import { humanIdentity } from '../src/game/humanworld';
import { QA_BUILD } from '../src/game/build-flags';

const T0 = Date.UTC(2026, 10, 15, 8);
function run(seed = 7606) {
  setActiveLayout('veyra05-world');
  const gs = newGame();
  expect(startRun(gs, 'female', T0, null, seed).ok).toBe(true);
  return { gs, r: gs.run! };
}
/** A loose stack lying at the player's feet, exactly as harvesting leaves it. */
function dropAtFeet(r: RunState, key: string, qty: number): Entity {
  const c = mkContainer(r, 'drop', 1);
  c.slots[0] = mkStack(r, key, qty);
  const e: Entity = { id: uid(r, 'd'), kind: 'drop', x: r.player.x, y: r.player.y, c: c.id } as Entity;
  r.entities[e.id] = e;
  return e;
}
const slotsOf = (r: RunState, key: string) => C(r, 'inv').slots.filter(s => s?.key === key);
let seq = 0;
const pickup = (gs: ReturnType<typeof newGame>, e: Entity) => dispatch(gs, { id: `fc-${++seq}`, type: 'pickup', eid: e.id }, T0 + seq);

// Compiling the Veyra layout the first time takes several seconds; do it outside any test's clock.
beforeAll(() => { run(); }, 120_000);

describe('1. gathered material stacks', () => {
  it('ten logs picked up one at a time become ONE stack of ten that keeps its identity', () => {
    const { gs, r } = run();
    C(r, 'inv').slots.fill(null);
    for (let i = 0; i < 10; i++) expect(pickup(gs, dropAtFeet(r, 'wood', 1)).ok).toBe(true);
    const wood = slotsOf(r, 'wood');
    expect(wood.length).toBe(1);
    expect(wood[0]!.qty).toBe(10);
    const firstUid = wood[0]!.uid;
    expect(pickup(gs, dropAtFeet(r, 'wood', 5)).ok).toBe(true);
    expect(slotsOf(r, 'wood').length).toBe(1);
    expect(slotsOf(r, 'wood')[0]!.uid).toBe(firstUid);          // the carried stack is the receiver
    expect(countItem(r, 'inv', 'wood')).toBe(15);
    expect(Object.values(r.entities).some(e => e.kind === 'drop' && e.x === r.player.x && e.y === r.player.y)).toBe(false);
  });
  it('fills the carried stack to its cap and only the remainder takes a new slot — nothing is lost or minted', () => {
    const { gs, r } = run();
    C(r, 'inv').slots.fill(null);
    const cap = ITEMS.wood.max;
    expect(addItem(r, 'inv', 'wood', cap - 3)).toBe(0);
    expect(pickup(gs, dropAtFeet(r, 'wood', 8)).ok).toBe(true);
    expect(slotsOf(r, 'wood').map(s => s!.qty).sort((a, b) => b - a)).toEqual([cap, 5]);
    expect(countItem(r, 'inv', 'wood')).toBe(cap + 5);
  });
  it('never merges things that carry their own state: a worn tool keeps its own slot and durability', () => {
    const { gs, r } = run();
    C(r, 'inv').slots.fill(null);
    const tool = Object.keys(ITEMS).find(k => ITEMS[k].dur && ITEMS[k].max === 1 && ITEMS[k].cat === 'tool')!;
    const a = dropAtFeet(r, tool, 1), b = dropAtFeet(r, tool, 1);
    C(r, a.c!).slots[0]!.dur = 7; C(r, b.c!).slots[0]!.dur = 3;
    const uids = [C(r, a.c!).slots[0]!.uid, C(r, b.c!).slots[0]!.uid];
    expect(pickup(gs, a).ok).toBe(true); expect(pickup(gs, b).ok).toBe(true);
    const held = slotsOf(r, tool);
    expect(held.map(s => s!.dur).sort()).toEqual([3, 7]);
    expect(held.map(s => s!.uid).sort()).toEqual([...uids].sort());
  });
});

describe('2. a resident is named after the work they do', () => {
  it('every seeded resident: first word of the name is their occupation', () => {
    const { r } = run();
    const people = Object.values(r.humanWorld!.people);
    expect(people.length).toBeGreaterThan(200);
    const wrong = people.filter(h => h.name.split(' ')[0].toLowerCase() !== h.occupation);
    expect(wrong.map(h => `${h.name}/${h.occupation}`)).toEqual([]);
  });
  it('the surname and the look of a person do not depend on the occupation', () => {
    const plain = humanIdentity('src:test', 3), cook = humanIdentity('src:test', 3, 'cook');
    expect(cook.name.split(' ')[0]).toBe('Cook');
    expect(cook.name.split(' ').slice(1)).toEqual(plain.name.split(' ').slice(1));
    expect(cook.appearance).toBe(plain.appearance);
  });
  it('an older save keeps every surname and only has a wrong role word corrected on load', () => {
    const { gs, r } = run();
    const people = Object.values(r.humanWorld!.people);
    const cook = people.find(h => h.occupation === 'cook')!, guard = people.find(h => h.occupation === 'guard')!;
    const surname = cook.name.split(' ').slice(1).join(' ');
    cook.name = `Guard ${surname}`;                              // what 6d2dec8 could have written
    const guardName = guard.name;
    const back = selectSnapshots([serializeSnapshot(gs)]).gs!.run!.humanWorld!.people;
    expect(back[cook.actorId].name).toBe(`Cook ${surname}`);
    expect(back[guard.actorId].name).toBe(guardName);
  });
});

describe('3. one authority for "where is my bag"', () => {
  it('a death is bound to its bag on the player, so the answer survives the receipt ledger rotating', () => {
    const { gs, r } = run();
    C(r, 'inv').slots.fill(null);
    addItem(r, 'inv', 'wood', 4);
    killPlayer(gs, T0 + 1000, 'Starvation');
    expect(r.player.dead).toBe(true);
    const bound = r.player.deathBag!;
    expect(bound.cause).toBe('Starvation');
    expect(typeof bound.id).toBe('string');
    const first = deathBagView(r);
    expect(first.status).toBe('present');
    r.receipts.length = 0;                                       // 250 later events have pushed the death out
    const later = deathBagView(r);
    expect(later.status).toBe('present');
    expect(later.bagId).toBe(first.bagId);
    expect(later.cause).toBe('Starvation');
    const reloaded = selectSnapshots([serializeSnapshot(gs)]).gs!.run!;
    expect(deathBagView(reloaded).bagId).toBe(first.bagId);
  });
  it('dying empty-handed says so instead of pointing at somebody else\'s bag', () => {
    const { gs, r } = run();
    C(r, 'inv').slots.fill(null);
    killPlayer(gs, T0 + 1000, 'Cold');
    r.receipts.length = 0;
    const v = deathBagView(r);
    if (r.player.deathBag!.id === null) expect(v.status).toBe('none');
    else expect(v.status).toBe('present');                        // starting kit that cannot be emptied here
    expect(v.cause).toBe('Cold');
  });
  it('a save written before the binding existed still finds the bag lying under the body', () => {
    const { gs, r } = run();
    C(r, 'inv').slots.fill(null);
    addItem(r, 'inv', 'stone', 2);
    killPlayer(gs, T0 + 1000, 'Starvation');
    const id = r.player.deathBag!.id!;
    delete r.player.deathBag; r.receipts.length = 0;             // the shape of the h264 endurance save
    const v = deathBagView(r);
    expect(v.status).toBe('present');
    expect(v.bagId).toBe(id);
  });
});

describe('4. the player build has no QA doors', () => {
  it('QA entry points are off unless the build is made with VITE_SOH_QA=1', () => {
    expect(QA_BUILD).toBe(import.meta.env.VITE_SOH_QA === '1');
    expect(QA_BUILD).toBe(false);
  });
});
