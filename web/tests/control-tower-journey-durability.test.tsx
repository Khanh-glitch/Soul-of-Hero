// No-op canvas stub for static markup rendering in Node (matches gold-intake-integration.test.tsx).
const noop: any = new Proxy(function () {}, { get: (_t, k) => (k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : noop), apply: () => noop, set: () => true });
if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = { createElement: () => ({ getContext: () => noop, toDataURL: () => 'data:,', width: 0, height: 0 }) };
}

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { BAL, TILE, WW, type GameState } from '../src/game/core';
import {
  blockGrid, C, countItem, dispatch, harvestHit, newGame, sourceAt,
} from '../src/game/engine';
import {
  computeAuthoritativeDailyPoints, DAILY_BY_ID, dailySaltFor, dateKey, freshStore,
  generateDaily, ingestJourney, isMilestoneRequisitioned, MAX_DAILY_LEDGER_DAYS,
  measureDailyObjectiveProgress, rerollDaily as uiReroll, resolveRerollReplacement,
} from '../src/game/journey';
import { selectSnapshots, serializeSnapshot, validate } from '../src/game/persist';
import { FX, HAZ, PROJ, settle, tick } from '../src/game/sim';
import { getWorld, setActiveLayout } from '../src/game/world';
import { JourneyLedger } from '../src/ui/Journey';

const T0 = Date.UTC(2026, 10, 9, 8, 0, 0); // 2026-11-09T08:00:00Z (Day 1)
const IDLE_INP = {
  up: false, down: false, left: false, right: false,
  mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false,
};

afterEach(() => {
  PROJ.length = 0;
  HAZ.length = 0;
  FX.length = 0;
  setActiveLayout('shipping');
});

function reloadViaSnapshot(gs: GameState): GameState {
  const snap = serializeSnapshot(gs);
  const outer = JSON.parse(snap);
  expect(validate(JSON.parse(outer.payload))).toBeTruthy();
  const res = selectSnapshots([snap, null]);
  expect(res.gs).toBeTruthy();
  return res.gs!;
}

function collectNearbyDrops(gs: GameState, now: number, filterKeys?: string[]): number {
  const r = gs.run!;
  let seq = 0;
  for (const d of Object.values(r.entities)) {
    if (d.kind !== 'drop' || !d.c) continue;
    const slots = C(r, d.c).slots;
    for (let s = 0; s < slots.length; s++) {
      const st = slots[s];
      if (!st || (filterKeys && !filterKeys.includes(st.key))) continue;
      r.player.x = d.x;
      r.player.y = d.y;
      now += 20;
      dispatch(gs, { id: `dur-pickup-${now}-${++seq}`, type: 'move', from: d.c, fs: s, to: 'inv' }, now);
    }
  }
  return now;
}

/** Harvest exact material units via real `harvestHit` calls on map sources. */
function harvestRealUnits(gs: GameState, mats: string[], neededUnits: number, startNow: number, sourceKeys?: string[]): number {
  const r = gs.run!;
  let now = startNow;
  let totalUnits = 0;
  const harvestPower = { wood: 50, stone: 50, ore: 50, plant: 50 };
  for (let i = 0; i < WW * WW && totalUnits < neededUnits; i++) {
    const tx = i % WW, ty = (i / WW) | 0;
    if (tx < 2 || ty < 2 || tx >= WW - 2 || ty >= WW - 2) continue;
    const s = sourceAt(r, tx, ty, now);
    if (!s || s.stock <= 0 || !mats.includes(s.def.mat)) continue;
    if (sourceKeys && !sourceKeys.includes(s.key)) continue;
    r.player.x = tx * TILE + 8;
    r.player.y = ty * TILE + 8;
    for (let swings = 0; swings < 12 && totalUnits < neededUnits; swings++) {
      const before = sourceAt(r, tx, ty, now);
      if (!before || before.stock <= 0) break;
      const stockBefore = before.stock;
      now += 80;
      const hit = harvestHit(gs, tx, ty, harvestPower, now, r.player.x, r.player.y);
      if (hit.result !== 'yield') break;
      const after = sourceAt(r, tx, ty, now);
      totalUnits += Math.max(0, stockBefore - (after?.stock ?? 0));
    }
  }
  expect(totalUnits).toBeGreaterThanOrEqual(neededUnits);
  return now;
}

/** Complete a Day-1 objective strictly via real gameplay actions (zero synthetic receipts). */
function performRealObjective(gs: GameState, objId: string, startNow: number): number {
  const r = gs.run!;
  const w = getWorld();
  let now = startNow;
  let seq = 0;
  const act = (type: string, extra: Record<string, any> = {}) => {
    now += 150;
    const res = dispatch(gs, { id: `dur-act-${objId}-${now}-${++seq}`, type, ...extra }, now);
    expect(res.ok, !res.ok ? `${type}: ${res.reason}` : '').toBe(true);
    return res;
  };

  if (objId === 'timber') return harvestRealUnits(gs, ['wood'], DAILY_BY_ID.timber.target, now);
  if (objId === 'quarry') return harvestRealUnits(gs, ['stone', 'ore'], DAILY_BY_ID.quarry.target, now);
  if (objId === 'forage') return harvestRealUnits(gs, ['plant'], DAILY_BY_ID.forage.target, now);

  if (objId === 'variety') {
    const harvestPower = { wood: 50, stone: 50, ore: 50, plant: 50 };
    const seenKinds = new Set<string>();
    for (let i = 0; i < WW * WW && seenKinds.size < DAILY_BY_ID.variety.target; i++) {
      const tx = i % WW, ty = (i / WW) | 0;
      if (tx < 2 || ty < 2 || tx >= WW - 2 || ty >= WW - 2) continue;
      const s = sourceAt(r, tx, ty, now);
      if (!s || s.stock <= 0 || seenKinds.has(s.key)) continue;
      r.player.x = tx * TILE + 8;
      r.player.y = ty * TILE + 8;
      for (let sw = 0; sw < 8; sw++) {
        const before = sourceAt(r, tx, ty, now);
        if (!before || before.stock <= 0) break;
        const stockBefore = before.stock;
        now += 80;
        const hit = harvestHit(gs, tx, ty, harvestPower, now, r.player.x, r.player.y);
        if (hit.result !== 'yield') break;
        const after = sourceAt(r, tx, ty, now);
        if (stockBefore - (after?.stock ?? 0) > 0) {
          seenKinds.add(before.key);
          break;
        }
      }
    }
    expect(seenKinds.size).toBeGreaterThanOrEqual(DAILY_BY_ID.variety.target);
    return now;
  }

  if (objId === 'handcraft' || objId === 'recipes') {
    now = harvestRealUnits(gs, ['wood'], 12, now);
    now = harvestRealUnits(gs, ['stone'], 10, now);
    now = harvestRealUnits(gs, ['plant'], 12, now, ['grass', 'reed']);
    now = collectNearbyDrops(gs, now, ['wood', 'stone', 'fiber']);
    act('craft', { recipe: 'rope' });
    act('craft', { recipe: 'torch' });
    if (objId === 'handcraft') act('craft', { recipe: 'energy_basic' });
    return now;
  }

  if (objId === 'raise') {
    now = harvestRealUnits(gs, ['wood'], 24, now);
    now = collectNearbyDrops(gs, now, ['wood']);
    const grid = blockGrid(r);
    let built = 0;
    for (let y = 20; y < WW - 20 && built < 5; y++) {
      for (let x = 20; x < WW - 20 && built < 5; x++) {
        const idx = y * WW + x;
        if (grid[idx] !== 0 || w.sourceV3[idx] || !w.economyMap.buildable[idx] || w.economyMap.protected[idx]) continue;
        if (w.accessCorridors?.mask[idx]) continue;
        r.player.x = x * TILE + 8;
        r.player.y = y * TILE + 8;
        act('build', { struct: 'floor_wood', tx: x, ty: y });
        built++;
      }
    }
    expect(built).toBe(5);
    return now;
  }

  if (objId === 'hydrate') {
    let fx = -1, fy = -1;
    outer: for (let y = 5; y < WW - 5; y++) {
      for (let x = 5; x < WW - 5; x++) {
        if (w.fresh[y * WW + x]) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (w.economyMap.walkable[(y + dy) * WW + (x + dx)]) {
              fx = x; fy = y;
              r.player.x = (x + dx) * TILE + 8;
              r.player.y = (y + dy) * TILE + 8;
              break outer;
            }
          }
        }
      }
    }
    expect(fx).toBeGreaterThan(0);
    for (let k = 0; k < 4; k++) {
      r.player.thirst = 50;
      act('drink', { x: fx * TILE + 8, y: fy * TILE + 8 });
    }
    return now;
  }

  if (objId === 'chart') {
    const unseen = w.places.find(p => p.kind === 'poi' && !r.poiSeen.includes(p.id))!;
    expect(unseen).toBeDefined();
    r.player.x = unseen.tx * TILE + 8;
    r.player.y = unseen.ty * TILE + 8;
    for (let k = 0; k < 12 && !r.poiSeen.includes(unseen.id); k++) {
      now += 50;
      tick(gs, { ...IDLE_INP, mx: r.player.x, my: r.player.y }, 50, now);
    }
    expect(r.poiSeen).toContain(unseen.id);
    return now;
  }

  if (objId === 'scavenge') {
    const seenPois = new Set<string>();
    const loots = Object.values(r.entities).filter(e => {
      if (e.kind !== 'loot' || !e.poi || seenPois.has(e.poi)) return false;
      if (!(C(r, e.c!)?.slots ?? []).some(Boolean)) return false;
      seenPois.add(e.poi);
      return true;
    }).slice(0, 2);
    expect(loots.length).toBe(2);
    for (const lt of loots) {
      const ltx = lt.tx!, lty = lt.ty!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) {
        if (w.economyMap.walkable[(lty + dy) * WW + (ltx + dx)] && blockGrid(r)[(lty + dy) * WW + (ltx + dx)] === 0) {
          r.player.x = (ltx + dx) * TILE + 8;
          r.player.y = (lty + dy) * TILE + 8;
          break;
        }
      }
      const res = act('observeLoot', { eid: lt.id });
      if (res.ok) expect(res.receipt).not.toBe('intel.none');
    }
    return now;
  }

  throw new Error(`Unhandled objective helper for ${objId}`);
}

/** Commit `count` real, unrelated engine actions (`sort` + melee swing stimuli) that legitimately call `receipt()` and evict the 250-entry ring buffer. */
function commitUnrelatedGameplayEvents(gs: GameState, count: number, startNow: number, tag = 'evict'): number {
  let now = startNow;
  for (let i = 0; i < count; i++) {
    now += 60;
    const res = dispatch(gs, { id: `${tag}-sort-${now}-${i}`, type: 'sort', c: 'inv' }, now);
    expect(res.ok).toBe(true);
    if (i % 25 === 0) {
      now += 400;
      tick(gs, { ...IDLE_INP, mx: gs.run!.player.x + 16, my: gs.run!.player.y, attack: true, attackPressed: true }, 50, now);
    }
  }
  return now;
}

function findEmberSeed(today: string) {
  const supported = new Set(['timber', 'quarry', 'forage', 'variety', 'hydrate', 'chart', 'scavenge']);
  const probe = newGame();
  expect(dispatch(probe, { id: 'dur-probe', type: 'startRun', character: 'female', seed: 1 }, T0).ok).toBe(true);
  const pr = probe.run!;
  for (let seed = 1; seed <= 300; seed++) {
    pr.seed = seed;
    pr.id = `run_${seed.toString(36)}_${Math.floor(T0).toString(36)}`;
    const base = generateDaily(today, dailySaltFor(pr), pr);
    const doable = base.filter(id => supported.has(id));
    let pts = 0;
    const chosen: string[] = [];
    for (const id of doable) {
      chosen.push(id);
      pts += DAILY_BY_ID[id].points;
      if (pts >= 25) break;
    }
    const partialCand = base.find(id => !chosen.includes(id) && (id === 'timber' || id === 'quarry' || id === 'forage' || id === 'hydrate'));
    if (pts >= 25 && partialCand) return { seed, chosen, expectedMinPts: pts, partialCand };
  }
  throw new Error('No Ember seed found in 1..300');
}

function findRerollDurabilitySeed(today: string) {
  const supported = new Set(['timber', 'quarry', 'forage', 'variety', 'handcraft', 'recipes', 'raise', 'hydrate', 'chart', 'scavenge']);
  const probe = newGame();
  expect(dispatch(probe, { id: 'dur-reroll-probe', type: 'startRun', character: 'female', seed: 1 }, T0).ok).toBe(true);
  const pr = probe.run!;
  for (let seed = 1; seed <= 500; seed++) {
    pr.seed = seed;
    pr.id = `run_${seed.toString(36)}_${Math.floor(T0).toString(36)}`;
    const base = generateDaily(today, dailySaltFor(pr), pr);
    const mockStore = {
      ...freshStore(),
      daily: {
        date: today,
        runId: pr.id,
        objectives: base.map(id => ({ id, progress: 0, done: false, seen: [] as string[] })),
        points: 0,
        milestones: [] as string[],
        rerolled: false,
      },
    };
    const partner = base.find(id => id === 'timber' || id === 'quarry' || id === 'forage' || id === 'hydrate');
    if (!partner || DAILY_BY_ID[partner].points >= 25) continue;
    for (const cand of base) {
      if (cand === partner || !['hunt2', 'scavenge', 'chart'].includes(cand)) continue;
      const swapped = uiReroll(mockStore, cand, pr);
      const rep = swapped.daily!.objectives.find(o => !base.includes(o.id))?.id;
      if (!rep || !supported.has(rep) || rep === cand) continue;
      if (DAILY_BY_ID[partner].points + DAILY_BY_ID[rep].points >= 25) {
        return { seed, partner, swapFrom: cand, replacementId: rep };
      }
    }
  }
  throw new Error('No reroll durability seed found in 1..500');
}

describe('Final Journey Durability Corrective — Durable Run-Authoritative Daily Ledger', () => {
  it('RED-1: preserves unclaimed Ember milestone and partial-progress reroll lock after >250 unrelated same-day events evict earlier receipts', () => {
    setActiveLayout('shipping_fresh');
    const today = dateKey(T0);
    const { seed, chosen, expectedMinPts, partialCand } = findEmberSeed(today);

    const gs = newGame();
    expect(dispatch(gs, { id: 'red1-start', type: 'startRun', character: 'female', seed }, T0).ok).toBe(true);
    const r = gs.run!;
    let now = T0 + 1000;

    // Complete Ember-qualifying objective(s) through 100% real gameplay
    for (const id of chosen) {
      now = performRealObjective(gs, id, now);
    }
    const earnedBeforeEvict = computeAuthoritativeDailyPoints(r, today);
    expect(earnedBeforeEvict).toBeGreaterThanOrEqual(Math.max(25, expectedMinPts));

    // Also make real non-zero partial progress (< target) on `partialCand` so reroll must remain locked
    if (partialCand === 'hydrate') {
      const w = getWorld();
      outer: for (let y = 5; y < WW - 5; y++) {
        for (let x = 5; x < WW - 5; x++) {
          if (w.fresh[y * WW + x] && w.economyMap.walkable[y * WW + x + 1]) {
            r.player.x = (x + 1) * TILE + 8;
            r.player.y = y * TILE + 8;
            r.player.thirst = 50;
            now += 150;
            expect(dispatch(gs, { id: 'red1-drink-1', type: 'drink', x: x * TILE + 8, y: y * TILE + 8 }, now).ok).toBe(true);
            break outer;
          }
        }
      }
    } else {
      const mat = partialCand === 'timber' ? ['wood'] : partialCand === 'quarry' ? ['stone', 'ore'] : ['plant'];
      now = harvestRealUnits(gs, mat, 2, now);
    }
    expect(measureDailyObjectiveProgress(r, today, partialCand, 0)).toBeGreaterThan(0);

    const seqAfterProgress = r.seq;

    // Commit > 250 unrelated real gameplay events during the SAME UTC day!
    now = commitUnrelatedGameplayEvents(gs, 280, now + 500, 'red1');
    expect(dateKey(now)).toBe(today);
    expect(r.receipts.length).toBe(250);
    expect(r.receipts[0].seq).toBeGreaterThan(seqAfterProgress);
    expect(r.receipts.some(rc => rc.kind === 'run.start')).toBe(false);

    // Earned authoritative points and unclaimed Ember milestone MUST remain intact and claimable!
    const claim = dispatch(gs, { id: 'red1-claim-ember', type: 'journeyRequisition', date: today, milestone: 'ember' }, now + 100);
    expect(claim.ok, !claim.ok ? claim.reason : '').toBe(true);
    expect(computeAuthoritativeDailyPoints(r, today)).toBe(earnedBeforeEvict);
    expect(gs.profile.securedCash).toBe(BAL.journeyRequisitions.ember.securedCash);
    expect(countItem(r, 'inv', 'bandage')).toBe(3);
    expect(countItem(r, 'inv', 'cooked_meat')).toBe(3);

    // Partial progress on `partialCand` MUST still block `journeyReroll` even after receipt eviction!
    expect(measureDailyObjectiveProgress(r, today, partialCand, 0)).toBeGreaterThan(0);
    expect(dispatch(gs, { id: 'red1-reroll-partial', type: 'journeyReroll', date: today, from: partialCand }, now + 200).ok).toBe(false);
  });

  it('RED-2: keeps Day 2+ objective slate unchanged when run.start is evicted and gated capabilities are built/learned after midnight', () => {
    setActiveLayout('shipping_fresh');
    const day2At = Date.UTC(2026, 10, 10, 0, 15, 0); // Day 2: 2026-11-10T00:15:00Z
    const day2 = dateKey(day2At);
    expect(day2).toBe('2026-11-10');

    // Deterministically pick a seed where unlocking workbench + bed_straw + fortify would alter Day 2's pool/slate if evaluated live
    let chosenSeed = 1;
    {
      const pNoCap = newGame();
      expect(dispatch(pNoCap, { id: 'p-nocap', type: 'startRun', character: 'female', seed: 1 }, T0).ok).toBe(true);
      const pWithCap = newGame();
      expect(dispatch(pWithCap, { id: 'p-cap', type: 'startRun', character: 'female', seed: 1 }, T0).ok).toBe(true);
      // Simulate live capability state with `run.start` absent on baseline
      pWithCap.run!.receipts = [];
      pWithCap.run!.knowledge.recipes.push('iron_sword', 'iron_pick');
      pWithCap.run!.entities['cap_wb'] = { id: 'cap_wb', kind: 'struct', type: 'workbench', x: 100, y: 100, tx: 6, ty: 6, hp: 160, maxHp: 160 };
      pWithCap.run!.entities['cap_bed'] = { id: 'cap_bed', kind: 'struct', type: 'bed_straw', x: 116, y: 100, tx: 7, ty: 6, hp: 60, maxHp: 60 };
      for (let s = 1; s <= 200; s++) {
        pNoCap.run!.seed = s;
        pWithCap.run!.seed = s;
        const a = generateDaily(day2, dailySaltFor(pNoCap.run!), pNoCap.run!);
        const b = generateDaily(day2, dailySaltFor(pWithCap.run!), pWithCap.run!);
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          chosenSeed = s;
          break;
        }
      }
    }

    const gs = newGame();
    expect(dispatch(gs, { id: 'red2-start', type: 'startRun', character: 'female', seed: chosenSeed }, T0).ok).toBe(true);
    const r = gs.run!;

    // Evict `run.start` with >260 unrelated events on Day 1
    let now = commitUnrelatedGameplayEvents(gs, 270, T0 + 1000, 'red2-d1');
    expect(r.receipts.some(rc => rc.kind === 'run.start')).toBe(false);

    // Cross UTC midnight to Day 2 (`2026-11-10T00:15:00Z`) with NO gated capabilities built or learned yet
    r.player.hunger = 100;
    r.player.thirst = 100;
    r.player.hp = 100;
    settle(gs, day2At, true);
    r.player.dead = false;
    r.player.hp = 100;
    now = day2At + 1000;

    // Record Day 2's authoritative slate right after midnight
    const day2SlateAtStart = generateDaily(day2, dailySaltFor(r), r);
    const uiAtStart = ingestJourney(freshStore(), gs, now).store;
    expect(uiAtStart.daily?.objectives.map(o => o.id)).toEqual(day2SlateAtStart);

    // Now AFTER midnight on Day 2, harvest real materials and build gated structures (`workbench` + `bed_straw`)!
    now = harvestRealUnits(gs, ['wood'], 20, now);
    now = harvestRealUnits(gs, ['stone'], 6, now);
    now = harvestRealUnits(gs, ['plant'], 14, now, ['grass', 'reed']);
    now = collectNearbyDrops(gs, now, ['wood', 'stone', 'fiber']);

    const w = getWorld();
    const grid = blockGrid(r);
    const spots: [number, number][] = [];
    for (let y = 20; y < WW - 20 && spots.length < 2; y++) {
      for (let x = 20; x < WW - 20 && spots.length < 2; x++) {
        const idx = y * WW + x;
        const adj = y * WW + (x + 1);
        if (grid[idx] !== 0 || grid[adj] !== 0 || w.sourceV3[idx] || w.sourceV3[adj]) continue;
        if (!w.economyMap.buildable[idx] || w.economyMap.protected[idx] || !w.economyMap.walkable[adj]) continue;
        if (w.accessCorridors?.mask[idx] || w.accessCorridors?.mask[adj]) continue;
        spots.push([x, y]);
      }
    }
    expect(spots.length).toBe(2);
    // Stand on adjacent walkable tile `(tx + 1, ty)` so `block: true` workbench is not obstructed by player body
    r.player.x = (spots[0][0] + 1) * TILE + 8;
    r.player.y = spots[0][1] * TILE + 8;
    now += 200;
    expect(dispatch(gs, { id: 'red2-build-wb', type: 'build', struct: 'workbench', tx: spots[0][0], ty: spots[0][1] }, now).ok).toBe(true);

    r.player.x = (spots[1][0] + 1) * TILE + 8;
    r.player.y = spots[1][1] * TILE + 8;
    now += 200;
    expect(dispatch(gs, { id: 'red2-build-bed', type: 'build', struct: 'bed_straw', tx: spots[1][0], ty: spots[1][1] }, now).ok).toBe(true);

    // Also loot & learn real blueprint(s) from authored map loot crates after midnight so recipe-gated objectives unlock live too
    for (const lt of Object.values(r.entities)) {
      if (lt.kind !== 'loot' || !lt.c || r.knowledge.recipes.length >= 2) continue;
      const slots = C(r, lt.c).slots;
      const bpIdx = slots.findIndex(s => s?.key === 'blueprint' && s.meta && !r.knowledge.recipes.includes(s.meta));
      if (bpIdx < 0) continue;
      const ltx = lt.tx!, lty = lt.ty!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) {
        if (w.economyMap.walkable[(lty + dy) * WW + (ltx + dx)] && blockGrid(r)[(lty + dy) * WW + (ltx + dx)] === 0) {
          r.player.x = (ltx + dx) * TILE + 8;
          r.player.y = (lty + dy) * TILE + 8;
          break;
        }
      }
      now += 100;
      if (dispatch(gs, { id: `red2-take-bp-${now}`, type: 'move', from: lt.c, fs: bpIdx, to: 'inv' }, now).ok) {
        const invIdx = C(r, 'inv').slots.findIndex(s => s?.key === 'blueprint');
        if (invIdx >= 0) {
          now += 100;
          dispatch(gs, { id: `red2-use-bp-${now}`, type: 'use', slot: invIdx }, now);
        }
      }
    }

    // Emit another >260 unrelated events on Day 2 so even the Day-2 build receipts are evicted
    now = commitUnrelatedGameplayEvents(gs, 270, now + 500, 'red2-d2');
    expect(r.receipts.some(rc => rc.kind === 'run.start')).toBe(false);

    // Day 2's objective slate MUST remain 100% unchanged in BOTH engine and fresh JourneyStore UI!
    expect(generateDaily(day2, dailySaltFor(r), r)).toEqual(day2SlateAtStart);
    const uiAfterCapabilities = ingestJourney(freshStore(), gs, now).store;
    expect(uiAfterCapabilities.daily?.objectives.map(o => o.id)).toEqual(day2SlateAtStart);

    // AND after crossing to Day 3 (`2026-11-11`), Day 3 legitimately unlocks capabilities built on Day 2!
    const day3At = Date.UTC(2026, 10, 11, 0, 15, 0);
    const day3 = dateKey(day3At);
    r.player.hunger = 100;
    r.player.thirst = 100;
    r.player.hp = 100;
    settle(gs, day3At, true);
    r.player.dead = false;
    r.player.hp = 100;
    const day3PoolHasWorkbenchGate = (() => {
      // Find any seed on Day 3 where `smelt` or `rest` or `fortify` appears on `r`
      const origSeed = r.seed;
      let sawGated = false;
      for (let s = 1; s <= 80; s++) {
        r.seed = s;
        const ids = generateDaily(day3, dailySaltFor(r), r);
        if (ids.some(id => id === 'smelt' || id === 'rest' || id === 'fortify')) {
          sawGated = true;
          break;
        }
      }
      r.seed = origSeed;
      return sawGated;
    })();
    expect(day3PoolHasWorkbenchGate).toBe(true);
  });

  it('RED-3: preserves earned points, committed rerolls, UI slate, and unclaimed milestones across receipt eviction + save/reload + offline catch-up', () => {
    setActiveLayout('shipping_fresh');
    const today = dateKey(T0);
    const { seed, partner, swapFrom, replacementId } = findRerollDurabilitySeed(today);

    const gs = newGame();
    expect(dispatch(gs, { id: 'red3-start', type: 'startRun', character: 'female', seed }, T0).ok).toBe(true);
    const r = gs.run!;
    let now = T0 + 1000;

    // 1. Complete `partner`, commit `journeyReroll` (`swapFrom -> replacementId`), and complete `replacementId` (>= 25 pts)
    now = performRealObjective(gs, partner, now);
    expect(dispatch(gs, { id: 'red3-reroll', type: 'journeyReroll', date: today, from: swapFrom }, now + 150).ok).toBe(true);
    now = performRealObjective(gs, replacementId, now + 300);

    const expectedPts = computeAuthoritativeDailyPoints(r, today);
    expect(expectedPts).toBeGreaterThanOrEqual(25);
    const expectedSlate = ingestJourney(freshStore(), gs, now).store.daily!.objectives.map(o => o.id);
    expect(expectedSlate).toContain(replacementId);
    expect(expectedSlate).not.toContain(swapFrom);

    // 2. Evict ALL prior receipts (`run.start`, `journey.reroll`, objective completions) with >270 unrelated events
    const seqBeforeEvict = r.seq;
    now = commitUnrelatedGameplayEvents(gs, 280, now + 500, 'red3-evict');
    expect(r.receipts.length).toBe(250);
    expect(r.receipts[0].seq).toBeGreaterThan(seqBeforeEvict);
    expect(r.receipts.some(rc => rc.kind === 'journey.reroll')).toBe(false);

    // 3. Save & reload + 15-minute offline `settle` catch-up (still same UTC day, milestone still unclaimed!)
    const reloaded = reloadViaSnapshot(gs);
    const afterSettle = now + 15 * 60_000;
    reloaded.run!.player.hunger = 100;
    reloaded.run!.player.thirst = 100;
    settle(reloaded, afterSettle, true);

    // 4. Engine AND fresh JourneyStore UI MUST agree on saved slate, reroll state, earned points, and unclaimed Ember!
    expect(computeAuthoritativeDailyPoints(reloaded.run!, today)).toBe(expectedPts);
    const uiRes = ingestJourney(freshStore(), reloaded, afterSettle);
    const uiDaily = uiRes.store.daily!;
    expect(uiDaily.rerolled).toBe(true);
    expect(uiDaily.rerolledFrom).toBe(swapFrom);
    expect(uiDaily.objectives.map(o => o.id)).toEqual(expectedSlate);
    expect(uiDaily.points).toBe(expectedPts);
    expect(uiDaily.milestones).toContain('ember');
    expect(isMilestoneRequisitioned(reloaded, today, 'ember')).toBe(false);

    const htmlBeforeClaim = renderToStaticMarkup(
      <JourneyLedger
        gs={reloaded}
        store={uiRes.store}
        now={afterSettle}
        initial="daily"
        onTrack={() => {}}
        onLesson={() => {}}
        onReroll={() => {}}
        onSeen={() => {}}
        onClose={() => {}}
        onOpenNotes={() => {}}
        onClaimRequisition={() => {}}
      />,
    );
    expect(htmlBeforeClaim).toContain('Claim Supply');

    // 5. Claiming the unclaimed Ember milestone after reload + eviction SUCCEEDS!
    const claim = dispatch(reloaded, { id: 'red3-claim-after-reload', type: 'journeyRequisition', date: today, milestone: 'ember' }, afterSettle + 100);
    expect(claim.ok, !claim.ok ? claim.reason : '').toBe(true);
    expect(reloaded.profile.securedCash).toBe(BAL.journeyRequisitions.ember.securedCash);
    expect(isMilestoneRequisitioned(reloaded, today, 'ember')).toBe(true);
  });

  it('RED-4: blocks duplicate milestone rewards, retroactive pre-reroll point creation, cross-run replay, and tampered dailyLedger snapshots', () => {
    setActiveLayout('shipping_fresh');
    const today = dateKey(T0);
    const { seed, partner, swapFrom, replacementId } = findRerollDurabilitySeed(today);
    const expectedRep = resolveRerollReplacement(
      today,
      `run:probe:${seed}`,
      [],
      swapFrom,
      null,
    );
    void expectedRep;

    const gs = newGame();
    expect(dispatch(gs, { id: 'red4-start', type: 'startRun', character: 'female', seed }, T0).ok).toBe(true);
    const r = gs.run!;
    let now = T0 + 1000;

    // A) Retroactive point creation check: perform `replacementId` BEFORE swapping `swapFrom -> replacementId`, then evict >260 receipts!
    now = performRealObjective(gs, partner, now);
    now = performRealObjective(gs, replacementId, now + 200);
    now = commitUnrelatedGameplayEvents(gs, 270, now + 400, 'red4-preroll');

    expect(dispatch(gs, { id: 'red4-reroll', type: 'journeyReroll', date: today, from: swapFrom }, now + 100).ok).toBe(true);
    // Pre-reroll `replacementId` work MUST NOT retroactively count after the swap!
    expect(measureDailyObjectiveProgress(r, today, replacementId, 0)).toBe(0);
    expect(computeAuthoritativeDailyPoints(r, today)).toBe(DAILY_BY_ID[partner].points);
    expect(dispatch(gs, { id: 'red4-premature-claim', type: 'journeyRequisition', date: today, milestone: 'ember' }, now + 200).ok).toBe(false);
    expect(gs.profile.securedCash).toBe(0);

    // Now genuinely complete `replacementId` AFTER the reroll cutover, evict >260 receipts, and claim Ember once
    now = performRealObjective(gs, replacementId, now + 300);
    now = commitUnrelatedGameplayEvents(gs, 270, now + 400, 'red4-postroll');
    expect(dispatch(gs, { id: 'red4-valid-claim', type: 'journeyRequisition', date: today, milestone: 'ember' }, now + 100).ok).toBe(true);
    const cashAfterEmber = gs.profile.securedCash;
    expect(cashAfterEmber).toBe(BAL.journeyRequisitions.ember.securedCash);

    // B) Duplicate milestone reward check (after further >260 receipt eviction + save/reload + repeated UI ingest)
    now = commitUnrelatedGameplayEvents(gs, 270, now + 200, 'red4-dup');
    const reloaded = reloadViaSnapshot(gs);
    expect(dispatch(reloaded, { id: 'red4-dup-claim', type: 'journeyRequisition', date: today, milestone: 'ember' }, now + 300).ok).toBe(false);
    expect(reloaded.profile.securedCash).toBe(cashAfterEmber);

    const s1 = ingestJourney(freshStore(), reloaded, now + 350).store;
    const marksAfterFirstIngest = s1.marks;
    const s2 = ingestJourney(s1, reloaded, now + 400).store;
    expect(s2.marks).toBe(marksAfterFirstIngest);

    // C) Cross-run replay check: abandon Run 1 -> start Run 2 on the same UTC day
    expect(dispatch(reloaded, { id: 'red4-abandon', type: 'abandon' }, now + 500).ok).toBe(true);
    const r2StartAt = now + 600;
    // Pick a Run-2 seed whose own Day-1 slate has >=25 doable points
    let r2Seed = 1;
    let r2Objectives: string[] = [];
    {
      const supported = new Set(['timber', 'quarry', 'forage', 'variety', 'handcraft', 'recipes', 'raise', 'hydrate', 'chart', 'scavenge']);
      const p2 = newGame();
      expect(dispatch(p2, { id: 'r2-probe', type: 'startRun', character: 'male', seed: 1 }, r2StartAt).ok).toBe(true);
      for (let s = 1; s <= 200; s++) {
        p2.run!.seed = s;
        p2.run!.id = `run_${s.toString(36)}_${Math.floor(r2StartAt).toString(36)}`;
        const ids = generateDaily(today, dailySaltFor(p2.run!), p2.run!).filter(id => supported.has(id));
        const pts = ids.reduce((sum, id) => sum + DAILY_BY_ID[id].points, 0);
        if (pts >= 25) {
          r2Seed = s;
          r2Objectives = ids;
          break;
        }
      }
      expect(r2Objectives.length).toBeGreaterThan(0);
    }
    expect(dispatch(reloaded, { id: 'red4-start-r2', type: 'startRun', character: 'male', seed: r2Seed }, r2StartAt).ok).toBe(true);
    // Run 2 starts at 0 points (no cross-run point carryover from Run 1)
    expect(computeAuthoritativeDailyPoints(reloaded.run!, today)).toBe(0);
    // Even if Run 2 earns >=25 points via real gameplay + >260 evicted receipts, same-day Ember cannot pay twice!
    let now2 = r2StartAt + 100;
    let earnedR2 = 0;
    for (const oid of r2Objectives) {
      if (earnedR2 >= 25) break;
      now2 = performRealObjective(reloaded, oid, now2 + 100);
      earnedR2 += DAILY_BY_ID[oid].points;
    }
    now2 = commitUnrelatedGameplayEvents(reloaded, 270, now2 + 300, 'red4-r2-evict');
    expect(computeAuthoritativeDailyPoints(reloaded.run!, today)).toBeGreaterThanOrEqual(25);
    expect(dispatch(reloaded, { id: 'red4-r2-dup-ember', type: 'journeyRequisition', date: today, milestone: 'ember' }, now2 + 100).ok).toBe(false);
    expect(reloaded.profile.securedCash).toBe(cashAfterEmber);

    // D) Save validator rejects tampered `dailyLedger` points while accepting legacy `dailyLedger === undefined`
    const validSnap = JSON.parse(JSON.parse(serializeSnapshot(reloaded)).payload);
    const legacyCopy = structuredClone(validSnap);
    delete legacyCopy.run.dailyLedger;
    expect(validate(legacyCopy)).toBeTruthy();

    if (validSnap.run.dailyLedger) {
      const tampered = structuredClone(validSnap);
      tampered.run.dailyLedger.days[today].points = 999;
      expect(validate(tampered)).toBeNull();
    }
  });

  it('enforces bounded <=32 ledger days across multi-day UTC rollovers and preserves offlineOk station completions past >250 receipt eviction', () => {
    setActiveLayout('shipping_fresh');
    const day1Late = Date.UTC(2026, 10, 9, 23, 50, 0);
    const day2At = Date.UTC(2026, 10, 10, 0, 5, 0);
    const day2 = dateKey(day2At);

    // Probe a deterministic seed where Day 2 rerolls into `smelt` (`produce`, `offlineOk: true`) once `furnace` was built on Day 1
    const probe = newGame();
    expect(dispatch(probe, { id: 'bound-probe', type: 'startRun', character: 'female', seed: 1 }, day1Late).ok).toBe(true);
    const pr = probe.run!;
    pr.dailyLedger!.capabilities.stationDate = dateKey(day1Late);
    pr.dailyLedger!.capabilities.anyStructDate = dateKey(day1Late);
    let chosenSeed = -1;
    let rerollFrom = '';
    outerSeed: for (let s = 1; s <= 200; s++) {
      pr.seed = s;
      pr.id = `run_${s.toString(36)}_${Math.floor(day1Late).toString(36)}`;
      const base = generateDaily(day2, dailySaltFor(pr), pr);
      for (const cand of base) {
        if (resolveRerollReplacement(day2, dailySaltFor(pr), base, cand, pr)?.id === 'smelt') {
          chosenSeed = s;
          rerollFrom = cand;
          break outerSeed;
        }
      }
    }
    expect(chosenSeed).toBeGreaterThan(0);

    const gs = newGame();
    expect(dispatch(gs, { id: 'bound-start', type: 'startRun', character: 'female', seed: chosenSeed }, day1Late).ok).toBe(true);
    const r = gs.run!;

    // Build a real workbench on Day 1 from real harvested wood & stone so Day 2 unlocks `smelt`
    let now = harvestRealUnits(gs, ['wood'], 16, day1Late + 1000);
    now = harvestRealUnits(gs, ['stone'], 8, now + 200);
    now = collectNearbyDrops(gs, now, ['wood', 'stone']);
    const w = getWorld();
    const grid = blockGrid(r);
    let ftx = -1, fty = -1;
    outer: for (let y = 20; y < WW - 20; y++) {
      for (let x = 20; x < WW - 20; x++) {
        const idx = y * WW + x, adj = y * WW + (x + 1);
        if (grid[idx] !== 0 || grid[adj] !== 0 || w.sourceV3[idx] || w.sourceV3[adj]) continue;
        if (!w.economyMap.buildable[idx] || w.economyMap.protected[idx] || !w.economyMap.walkable[adj]) continue;
        if (w.accessCorridors?.mask[idx] || w.accessCorridors?.mask[adj]) continue;
        ftx = x; fty = y;
        break outer;
      }
    }
    expect(ftx).toBeGreaterThan(0);
    r.player.x = (ftx + 1) * TILE + 8;
    r.player.y = fty * TILE + 8;
    now += 200;
    expect(dispatch(gs, { id: 'bound-build-bench', type: 'build', struct: 'workbench', tx: ftx, ty: fty }, now).ok).toBe(true);
    const bench = Object.values(r.entities).find(e => e.kind === 'struct' && e.type === 'workbench')!;
    expect(bench).toBeDefined();

    // Advance to Day 2 (`2026-11-10`) and commit reroll into `smelt`
    r.player.hunger = 100; r.player.thirst = 100; r.player.hp = 100;
    settle(gs, day2At, true);
    r.player.dead = false; r.player.hp = 100;
    const rerollAt = Math.max(day2At, r.clock.lastSimAt) + 100;
    const rr = dispatch(gs, { id: 'bound-reroll-smelt', type: 'journeyReroll', date: day2, from: rerollFrom }, rerollAt);
    expect(rr.ok, !rr.ok ? rr.reason : '').toBe(true);
    expect(r.dailyRerolls?.[day2]?.to).toBe('smelt');

    // Harvest real wood, queue 3 `plank` jobs at the workbench, and complete them during offline `settle`!
    now = harvestRealUnits(gs, ['wood'], 12, rerollAt + 400);
    now = collectNearbyDrops(gs, now, ['wood']);
    r.player.x = (ftx + 1) * TILE + 8;
    r.player.y = fty * TILE + 8;
    for (let j = 0; j < 3; j++) {
      now += 100;
      const qRes = dispatch(gs, { id: `bound-q-plank-${j}`, type: 'craft', eid: bench.id, recipe: 'plank' }, now);
      expect(qRes.ok, !qRes.ok ? qRes.reason : '').toBe(true);
    }

    const settleEnd = now + 5 * 60_000;
    r.player.hunger = 100; r.player.thirst = 100; r.player.hp = 100;
    settle(gs, settleEnd, true);
    r.player.dead = false; r.player.hp = 100;

    // Evict >270 receipts AFTER offline settle so `job.done` receipts are completely gone from `r.receipts`
    now = commitUnrelatedGameplayEvents(gs, 280, Math.max(settleEnd, r.clock.lastSimAt) + 200, 'bound-evict');
    expect(r.receipts.some(rc => rc.kind === 'job.done')).toBe(false);

    // Durable ledger + fresh UI store BOTH retain `smelt` completion (`20 pts`)!
    expect(measureDailyObjectiveProgress(r, day2, 'smelt', 0)).toBe(DAILY_BY_ID.smelt.target);
    expect(computeAuthoritativeDailyPoints(r, day2)).toBeGreaterThanOrEqual(DAILY_BY_ID.smelt.points);
    const uiAfterOffline = ingestJourney(freshStore(), gs, now).store;
    expect(uiAfterOffline.daily?.objectives.find(o => o.id === 'smelt')?.done).toBe(true);
    expect(uiAfterOffline.daily?.points).toBe(computeAuthoritativeDailyPoints(r, day2));

    // Roll across 40 distinct UTC dates to verify strict <= MAX_DAILY_LEDGER_DAYS cap + valid snapshot!
    for (let d = 0; d < 40; d++) {
      const futureAt = T0 + d * 86_400_000;
      ingestJourney(freshStore(), gs, futureAt);
    }
    expect(Object.keys(r.dailyLedger!.days).length).toBeLessThanOrEqual(MAX_DAILY_LEDGER_DAYS);
    expect(reloadViaSnapshot(gs).run?.dailyLedger).toBeTruthy();
  });
});
