// R6.1 — K1 custody: whole-stack pickup UID continuity, merge-lineage, split traceability.
// Order: Control Tower 6722812147 finding 1 ("UID continuity not proven by R6 … Make the K1 policy
// explicit: preserve the source UID when moving one whole stack to an empty slot; for legitimate
// merges/splits, test exact material conservation, no duplicate live UID and traceable retirement").
// Fixture scope: a fresh run + spawned drops only. Real movement is NOT exercised here (unit custody law).
import { describe, it, expect, beforeAll } from 'vitest';
import { TILE, type GameState } from '../src/game/core';
import { newGame, dispatch, addItem, mkContainer, C, countItem, spawnDrop } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { ITEMS } from '../src/game/catalog';

const T0 = Date.UTC(2026, 10, 8, 12);
let serial = 0;
const act = (g: GameState, type: string, p: object = {}, now = T0) =>
  dispatch(g, { id: `r61-${++serial}`, type, ...p } as any, now);

beforeAll(() => setActiveLayout('shipping_fresh'));

const freshRun = (seed: number) => {
  const gs = newGame();
  expect(act(gs, 'startRun', { character: 'female', seed }, T0).ok).toBe(true);
  return gs;
};
const inv = (r: any) => C(r, 'inv');
const liveUids = (r: any) => (Object.values(r.custody as Record<string, any>) as any[]).flatMap((c: any) => c.slots.filter(Boolean).map((s: any) => s.uid as string));
const allUidsUnique = (r: any) => { const u = liveUids(r); return new Set(u).size === u.length; };
/** Fill the 21 empty starter-inv slots deterministically. Starter inv: knife, water_flask, berries. */
const fillStarterGaps = (r: any, key: string, qtyOf: (i: number) => number) => {
  let i = 0;
  for (let slot = 0; slot < inv(r).slots.length && i < 21; slot++) {
    if (inv(r).slots[slot]) continue;
    inv(r).slots[slot] = { uid: `fill-${key}-${i}`, key, qty: qtyOf(i) };
    i++;
  }
  return i;
};

describe('R6.1 — K1 custody law for whole-stack pickup into empty slots', () => {
  it('whole stackable stack into an empty slot keeps its UID — never re-minted', () => {
    const gs = freshRun(6101);
    const r = gs.run!;
    const { x, y } = r.player;
    const drop = spawnDrop(r, 'meat', 2, x, y, T0);
    const srcUid = C(r, drop.c!).slots[0]!.uid;
    const res = act(gs, 'pickup', { eid: drop.id }, T0);
    expect(res.ok).toBe(true);
    const moved = inv(r).slots.find((s: any) => s && s.uid === srcUid)!;
    expect(moved).toBeTruthy();                        // the source stack itself landed in the inventory
    expect(moved.key).toBe('meat');
    expect(moved.qty).toBe(2);
    expect(r.entities[drop.id]).toBeUndefined();       // consumed, not duplicated
    expect(countItem(r, 'inv', 'meat')).toBe(2);
    expect(liveUids(r).filter(u => u === srcUid)).toHaveLength(1);
    expect(allUidsUnique(r)).toBe(true);
  });

  it('charged stateful stack (water_flask) moves whole — UID and charge preserved, never merged', () => {
    const gs = freshRun(6102);
    const r = gs.run!;
    const { x, y } = r.player;
    const drop = spawnDrop(r, 'water_flask', 1, x, y, T0, { charge: 3 });
    const srcUid = C(r, drop.c!).slots[0]!.uid;
    const res = act(gs, 'pickup', { eid: drop.id }, T0);
    expect(res.ok).toBe(true);
    const moved = inv(r).slots.find((s: any) => s && s.uid === srcUid)!;
    expect(moved.charge).toBe(3);                      // the charge survived the custody transfer intact
    expect(countItem(r, 'inv', 'water_flask')).toBeGreaterThanOrEqual(1);
    expect(liveUids(r).filter(u => u === srcUid)).toHaveLength(1);
    expect(allUidsUnique(r)).toBe(true);
  });

  it('no empty slot, stackable with merge room: exact material conservation, source UID fully retired, receivers untouched', () => {
    const gs = freshRun(6103);
    const r = gs.run!;
    const MEAT_MAX = ITEMS.meat.max!;
    const filled = fillStarterGaps(r, 'meat', () => MEAT_MAX - 1);
    expect(filled).toBe(21);
    expect(inv(r).slots.every((s: any) => s !== null)).toBe(true);          // zero empty slots → merge path
    const beforeTotal = countItem(r, 'inv', 'meat');                        // 21 × (max−1)
    const receiverUids = inv(r).slots.filter((s: any) => s.key === 'meat').map((s: any) => s.uid);
    const { x, y } = r.player;
    const drop = spawnDrop(r, 'meat', 2, x, y, T0);
    const srcUid = C(r, drop.c!).slots[0]!.uid;
    const res = act(gs, 'pickup', { eid: drop.id }, T0);
    expect(res.ok).toBe(true);
    expect(countItem(r, 'inv', 'meat')).toBe(beforeTotal + 2);              // exact material conservation
    expect(liveUids(r)).not.toContain(srcUid);                              // the source lineage is fully retired
    for (const u of receiverUids) expect(liveUids(r)).toContain(u);         // receiver UIDs unchanged
    expect(r.entities[drop.id]).toBeUndefined();
    expect(allUidsUnique(r)).toBe(true);                                    // no duplicate live UID
  });

  it('partial room: split keeps the remainder in the drop with the source UID; overflow fails closed without destroying it', () => {
    const gs = freshRun(6104);
    const r = gs.run!;
    // Fill the 21 gaps with one short slot (spaceFor = 1) and the rest full (60): spaceFor(meat) = 1 < 2.
    fillStarterGaps(r, 'meat', i => (i === 0 ? ITEMS.meat.max! - 1 : ITEMS.meat.max!));   // legal stacks only
    expect(inv(r).slots.every((s: any) => s !== null)).toBe(true);
    const beforeTotal = countItem(r, 'inv', 'meat');
    const { x, y } = r.player;
    const drop = spawnDrop(r, 'meat', 2, x, y, T0);
    const srcUid = C(r, drop.c!).slots[0]!.uid;
    const res = act(gs, 'pickup', { eid: drop.id }, T0);
    expect(res.ok).toBe(true);                                              // partial pickup accepted
    expect(countItem(r, 'inv', 'meat')).toBe(beforeTotal + 1);              // exactly the room that existed
    const remnant = r.entities[drop.id];
    expect(remnant, 'the drop must survive with the unmerged remainder').toBeTruthy();
    expect(C(r, remnant.c!).slots[0]!.qty).toBe(1);
    expect(C(r, remnant.c!).slots[0]!.uid).toBe(srcUid);                    // remainder keeps the source UID (traceable lineage)
    expect(countItem(r, 'inv', 'meat') + C(r, remnant.c!).slots[0]!.qty).toBe(beforeTotal + 2);   // nothing minted, nothing lost
    expect(allUidsUnique(r)).toBe(true);
    // A second pickup now has exactly zero room — it must FAIL without destroying the remnant.
    const again = act(gs, 'pickup', { eid: drop.id }, T0);
    expect(again.ok).toBe(false);
    expect(r.entities[drop.id]).toBeTruthy();
    expect(C(r, r.entities[drop.id].c!).slots[0]!.uid).toBe(srcUid);
    expect(countItem(r, 'inv', 'meat')).toBe(beforeTotal + 1);
  });
});
