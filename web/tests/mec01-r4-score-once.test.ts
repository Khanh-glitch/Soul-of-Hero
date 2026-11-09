// MEC-01 R4 P0-N1: C20 score-once semantics — the achievement-key guard, source-event credit separation,
// replay, restart and run-transition axes. The ONLY score door in the engine is award() (engine.ts);
// score credit = one achievement key, at most once per run; profile markers set once per profile.
// FIXTURE (labelled): r.player position; r.terrain flattened under fixtures; sources zeroed; claim/escrow/beacon
// entities placed directly (the claim CABINET itself still goes through the real build intent); six elder stones
// granted for the six_stones award path (the kill path is a single guarded award() call, engine.ts:814).
// NOT claimed here: any backend/verified layer (C21 stays unbuilt; history labels remain LOCAL/UNVERIFIED),
// or per-Elder kill-by-kill score granularity (the award fires once per run by key guard).
import { describe, it, expect } from 'vitest';
import { TILE, T, type GameState, type RunState } from '../src/game/core';
import { uid } from '../src/game/core';
import { newGame, dispatch, addItem, markDirty, award, C } from '../src/game/engine';
import { ACHIEVEMENTS } from '../src/game/catalog';
import { serializeSnapshot, selectSnapshots } from '../src/game/persist';
import { getWorld } from '../src/game/world';

const T0 = Date.UTC(2026, 10, 8, 12);
let serial = 0;
const act = (g: GameState, type: string, p: object = {}, now = T0) =>
  dispatch(g, { id: `n1x-${++serial}`, type, ...p }, now);

function placeAtBuildablePatch(gs: GameState) {
  const r = gs.run!;
  r.creatures = [];
  const w = getWorld();
  let px = 0, py = 0;
  for (let yy = 5; yy < 190 && !px; yy++) for (let xx = 5; xx < 190; xx++) {
    let ok = true;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2 && ok; dx++) {
      const i = (yy + dy) * 200 + xx + dx;
      if (w.economyMap.protected[i] || w.accessCorridors?.mask[i] || ((w.packageContract || w.enforceMasks) && !w.economyMap.buildable[i])) ok = false;
    }
    if (ok) { px = xx; py = yy; break; }
  }
  if (!px) throw new Error('no uncontrolled patch found');
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const i = (py + dy) * 200 + (px + dx);
    r.terrain[i] = { t: T.GRASS } as any;
    if (w.sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 };
  }
  r.player.x = (px - 1) * TILE + 8; r.player.y = (py + 1) * TILE + 8;
  markDirty();
}
function freshRun(seed = 4242) {
  const gs = newGame();
  expect(act(gs, 'startRun', { character: 'female', seed }, T0).ok).toBe(true);
  placeAtBuildablePatch(gs);
  return gs;
}
function buildOwnedClaim(gs: GameState, at = T0 + 1) {
  const r = gs.run!, p = r.player, tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  const bx = tx - 1, by = ty;                                            // floor+claim here; escrow injected at player tile
  addItem(r, 'inv', 'wood', 30); addItem(r, 'inv', 'stone', 10);        // FIXTURE grants
  const fb = act(gs, 'build', { struct: 'floor_wood', tx: bx, ty: by }, at);
  if (!fb.ok) console.log('FLOOR-REASON@' + bx + ',' + by + ': ' + (fb as any).reason);
  expect(fb.ok).toBe(true);
  expect(act(gs, 'build', { struct: 'claim', tx: bx, ty: by }, at + 1).ok).toBe(true);
  return Object.values(r.entities).find(e => e.kind === 'struct' && e.type === 'claim' && e.tx === bx && e.ty === by)!;
}
function injectEscrow(gs: GameState) {
  const r = gs.run!, p = r.player;
  const e = { id: uid(r, 'e'), kind: 'struct', type: 'escrow', x: p.x, y: p.y, tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE), hp: 120, maxHp: 120 } as any;
  r.entities[e.id] = e; markDirty(); return e;
}
const STONES = ['stone_frost', 'stone_magma', 'stone_bog', 'stone_grove', 'stone_tide', 'stone_rust'] as const;
function sixStones(gs: GameState) {
  const r = gs.run!;
  for (const k of STONES) expect(addItem(r, 'inv', k, 1)).toBe(0);
  r.elderStones = [...STONES];                                          // FIXTURE (sim derives this from custody on its next tick)
}
function injectEvacBeacon(gs: GameState) {
  const r = gs.run!, p = r.player;
  const e = { id: uid(r, 'e'), kind: 'evac', x: p.x, y: p.y, label: 'Fixture evacuation beacon' } as any;
  r.entities[e.id] = e; markDirty(); return e;
}
const slotOf = (r: RunState, key: string) => {
  const i = C(r, 'inv').slots.findIndex(s => s?.key === key);
  if (i < 0) throw new Error('slot not found: ' + key);
  return i;
};

describe('C20 score-once (R4 N1): the award() achievement-key guard is the ONLY score door', () => {

  it('each C20-relevant key is credited at most once per run, even on direct double-award', () => {
    const gs = freshRun(11); const r = gs.run!;
    const keys = ['first_deposit', 'elder_1', 'vault', 'evacuated', 'six_stones', 'ragnarok'] as const;
    for (const key of keys) {
      award(gs, key, T0 + 1); award(gs, key, T0 + 2);                       // same source re-triggering the same credit
      expect(r.achievements.filter(a => a === key), key).toHaveLength(1);
      expect(gs.profile.achievements[key], key).toBeTruthy();
    }
    expect(r.score).toBe(keys.reduce((n, k) => n + ACHIEVEMENTS[k].score, 0));
    expect(Object.keys(gs.profile.achievements)).toHaveLength(keys.length); // profile marker set once each
  });

  it('deposit: one transfer, one credit; exact-intent replay refused; a FRESH intent id re-transfers but never re-credits', () => {
    const gs = freshRun(12); const r = gs.run!;
    buildOwnedClaim(gs); const e = injectEscrow(gs);
    addItem(r, 'inv', 'rcash', 6);                                           // FIXTURE grant
    const intent = { id: 'n1x-dep-a', type: 'deposit', eid: e.id };
    expect(dispatch(gs, intent, T0 + 10).ok).toBe(true);
    expect(gs.profile.securedCash).toBe(6); expect(r.deposited).toBe(6);
    expect(r.score).toBe(ACHIEVEMENTS.first_deposit.score);                 // exactly one credit
    const replay = dispatch(gs, { ...intent }, T0 + 11);                     // exact same intent id → profile receipt guard
    expect(replay.ok).toBe(false); expect((replay as any).dup).toBe(true);
    expect(gs.profile.securedCash).toBe(6); expect(r.score).toBe(ACHIEVEMENTS.first_deposit.score);
    addItem(r, 'inv', 'rcash', 4);                                           // second legal deposit exists…
    expect(dispatch(gs, { id: 'n1x-dep-b', type: 'deposit', eid: e.id }, T0 + 12).ok).toBe(true);   // …with a FRESH intent id
    expect(gs.profile.securedCash).toBe(10); expect(r.deposited).toBe(10);  // transfer re-executed (real items moved)…
    expect(r.score).toBe(ACHIEVEMENTS.first_deposit.score);                 // …but the credit CANNOT double
    expect(r.achievements.filter(a => a === 'first_deposit')).toHaveLength(1);
  });

  it('reload across the deposit boundary: resume pays out again, credit still cannot double', () => {
    const gs = freshRun(13); const r = gs.run!;
    buildOwnedClaim(gs); const e = injectEscrow(gs);
    addItem(r, 'inv', 'rcash', 6);                                           // FIXTURE grant
    expect(act(gs, 'deposit', { eid: e.id }, T0 + 10).ok).toBe(true);
    const snap = selectSnapshots([serializeSnapshot(gs), null]).gs!;          // SNAPSHOT_SAME_PROCESS (separate-process proof lives in c3 tests)
    const rr = snap.run!;
    expect(rr.score).toBe(ACHIEVEMENTS.first_deposit.score);                 // credit persisted through save
    expect(rr.achievements).toContain('first_deposit');
    const e2 = Object.values(rr.entities).find(x => x.kind === 'struct' && (x as any).type === 'escrow')!;
    addItem(rr, 'inv', 'rcash', 4);                                          // FIXTURE grant
    expect(act(snap, 'deposit', { eid: e2.id }, T0 + 20).ok).toBe(true);
    expect(snap.profile.securedCash).toBe(10);
    expect(snap.run!.score).toBe(ACHIEVEMENTS.first_deposit.score);          // resumed world still cannot re-credit
  });

  it('evacuation with six stones: evacuated + six_stones credit once; replays cannot double-credit; run ends once', () => {
    const gs = freshRun(14); const r = gs.run!;
    buildOwnedClaim(gs); const e = injectEscrow(gs);
    addItem(r, 'inv', 'rcash', 6);                                           // FIXTURE grant
    const depIntent = { id: 'n1x-dep-d', type: 'deposit', eid: e.id };
    expect(dispatch(gs, depIntent, T0 + 10).ok).toBe(true);
    sixStones(gs);
    const beacon = injectEvacBeacon(gs);
    const evacIntent = { id: 'n1x-evac-d', type: 'evacuate', eid: beacon.id };
    expect(dispatch(gs, evacIntent, T0 + 30).ok).toBe(true);
    expect(gs.run).toBeNull();                                               // finalize happened — exactly once (guards in dispatch)
    expect(gs.profile.history).toHaveLength(1);
    expect(gs.profile.history[0].ending).toBe('evacuated');
    expect(gs.profile.history[0].score).toBe(ACHIEVEMENTS.first_deposit.score + ACHIEVEMENTS.evacuated.score + ACHIEVEMENTS.six_stones.score);
    expect(gs.profile.history[0].verified).toBe('LOCAL/UNVERIFIED');
    const evacReplay = dispatch(gs, { ...evacIntent }, T0 + 31);             // profile receipt burned forever
    expect(evacReplay.ok).toBe(false); expect((evacReplay as any).dup).toBe(true);
    const depReplay = dispatch(gs, { ...depIntent }, T0 + 33);               // ditto for the deposit intent
    expect(depReplay.ok).toBe(false); expect((depReplay as any).dup).toBe(true);
    const freshEvac = act(gs, 'evacuate', { eid: beacon.id }, T0 + 32);      // fresh id — no run exists anymore
    expect(freshEvac.ok).toBe(false);
    expect(gs.profile.history).toHaveLength(1);                              // history was not double-written
    expect(gs.profile.achievements['six_stones'].runId).toBe(gs.profile.history[0].runId);
  });

  it('run transition: a fresh run re-earns per-run credit legitimately; profile markers stay single-attributed; run-1 receipts stay burned in run 2', () => {
    const gs = freshRun(15); const r1 = gs.run!;
    buildOwnedClaim(gs); const e = injectEscrow(gs);
    addItem(r1, 'inv', 'rcash', 6);                                          // FIXTURE grant
    const dep1 = { id: 'n1x-dep-run1', type: 'deposit', eid: e.id };
    expect(dispatch(gs, dep1, T0 + 10).ok).toBe(true);
    const run1FirstDeposit = { at: gs.profile.achievements['first_deposit'].at, runId: gs.profile.achievements['first_deposit'].runId };
    sixStones(gs); const beacon = injectEvacBeacon(gs);
    expect(dispatch(gs, { id: 'n1x-evac-run1', type: 'evacuate', eid: beacon.id }, T0 + 30).ok).toBe(true);
    expect(gs.profile.history).toHaveLength(1);

    // --- transition into run 2 ---
    expect(act(gs, 'startRun', { character: 'male', seed: 99 }, T0 + 40).ok).toBe(true);
    const r2 = gs.run!;
    placeAtBuildablePatch(gs);                                               // run 2 spawns at its own position — rebuild fixtures there
    expect(r2.score).toBe(0);                                                // per-run score resets completely
    // the EXACT run-1 deposit intent is still refused in run 2 (profileReceipts survive the boundary):
    const crossReplay = dispatch(gs, { ...dep1 }, T0 + 45);
    expect(crossReplay.ok).toBe(false); expect((crossReplay as any).dup).toBe(true);
    buildOwnedClaim(gs, T0 + 41); const e2 = injectEscrow(gs);
    addItem(r2, 'inv', 'rcash', 6);                                          // FIXTURE grant
    expect(act(gs, 'deposit', { eid: e2.id }, T0 + 50).ok).toBe(true);       // fresh intent → run 2 may legitimately credit again
    sixStones(gs); const beacon2 = injectEvacBeacon(gs);
    expect(act(gs, 'evacuate', { eid: beacon2.id }, T0 + 60).ok).toBe(true);
    expect(gs.profile.history).toHaveLength(2);
    expect(gs.profile.history[0].runId).toBe(r2.id);                          // newest run unshifted
    expect(gs.profile.achievements['first_deposit']).toMatchObject(run1FirstDeposit); // attributed ONCE, to run 1 forever
    expect(gs.profile.achievements['six_stones'].runId).toBe(gs.profile.history[1].runId);
  });

  it('an irrelevant intent (drop) never credits score, before or after replay of its own id', () => {
    const gs = freshRun(17); const r = gs.run!;
    addItem(r, 'inv', 'stone', 5);                                           // FIXTURE grant
    const slot = slotOf(r, 'stone');
    const intent = { id: 'n1x-drop-1', type: 'drop', c: 'inv', slot };
    expect(dispatch(gs, intent, T0 + 10).ok).toBe(true);
    expect(r.score).toBe(0);                                                 // control healthy
    const replay = dispatch(gs, { ...intent }, T0 + 11);                     // SAME intent id → seenIntents dup guard
    expect(replay.ok).toBe(false); expect((replay as any).dup).toBe(true);
    const emptySlot = dispatch(gs, { id: 'n1x-drop-2', type: 'drop', c: 'inv', slot }, T0 + 12);   // fresh id, slot now empty
    expect(emptySlot.ok).toBe(false);
    expect(r.score).toBe(0);
    expect(gs.profile.achievements).toEqual({});
  });

  it('full-arc spam cannot fabricate score: re-clicks on deposit/evacuate credit nothing beyond the once-each arc', () => {
    const gs = freshRun(18); const r = gs.run!;
    buildOwnedClaim(gs); const e = injectEscrow(gs);
    addItem(r, 'inv', 'rcash', 2);                                           // FIXTURE grant
    expect(act(gs, 'deposit', { eid: e.id }, T0 + 10).ok).toBe(true);
    const sAfterDeposit = r.score;
    for (let i = 0; i < 5; i++) act(gs, 'deposit', { eid: e.id }, T0 + 20 + i);  // fresh ids, empty wallet → all refused pre-receipt
    expect(r.score).toBe(sAfterDeposit);
    sixStones(gs); const beacon = injectEvacBeacon(gs);
    expect(act(gs, 'evacuate', { eid: beacon.id }, T0 + 40).ok).toBe(true);
    expect(gs.profile.history[0].score).toBe(sAfterDeposit + ACHIEVEMENTS.evacuated.score + ACHIEVEMENTS.six_stones.score);
  });
});
