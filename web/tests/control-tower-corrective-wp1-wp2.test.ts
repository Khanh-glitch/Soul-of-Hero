import { describe, expect, it } from 'vitest';
import { BAL, TILE, WW, type GameState } from '../src/game/core';
import { ITEMS } from '../src/game/catalog';
import {
  addItem, blockGrid, C, countItem, dispatch, gardenEnvironment, harvestHit,
  isWet, markDirty, newGame, sourceAt, tenderStatus, weatherAt,
} from '../src/game/engine';
import {
  DAILY_BY_ID, dailySaltFor, dateKey, freshStore, generateDaily, ingestJourney, rerollDaily as uiReroll,
} from '../src/game/journey';
import { serializeSnapshot, validate } from '../src/game/persist';
import { settle, syncWorld, tick } from '../src/game/sim';
import { getWorld, setActiveLayout } from '../src/game/world';
import { U05_WORLD_LAYOUT_ID } from '../src/veyra05/scenes';
import { shiftVeyraWindowBy } from '../src/veyra05/continuity';

const T0 = Date.UTC(2026, 10, 9, 8, 0, 0); // 2026-11-09T08:00:00Z
const IDLE_INP = {
  up: false, down: false, left: false, right: false,
  mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false,
};

const cloneViaSave = (gs: GameState): GameState => {
  const snap = serializeSnapshot(gs);
  const outer = JSON.parse(snap);
  const parsed = validate(JSON.parse(outer.payload));
  expect(parsed).toBeTruthy();
  return parsed!;
};

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
      dispatch(gs, { id: `pickup-${now}-${++seq}`, type: 'move', from: d.c, fs: s, to: 'inv' }, now);
    }
  }
  return now;
}

/** Perform real gameplay actions (zero synthetic r.receipts injection!) to complete a Day-1 objective. */
function performLegitimateObjective(gs: GameState, objId: string, startNow: number): number {
  const r = gs.run!;
  let now = startNow;
  let seq = 0;
  const act = (type: string, extra: Record<string, any> = {}) => {
    now += 200;
    const res = dispatch(gs, { id: `legit-${objId}-${now}-${++seq}`, type, ...extra }, now);
    expect(res.ok, !res.ok ? `${type}: ${res.reason}` : '').toBe(true);
    return res;
  };

  const w = getWorld();
  const harvestPower = { wood: 50, stone: 50, ore: 50, plant: 50 };

  if (objId === 'timber' || objId === 'quarry' || objId === 'forage' || objId === 'variety') {
    const wantedMat =
      objId === 'timber' ? ['wood'] :
      objId === 'quarry' ? ['stone', 'ore'] :
      objId === 'forage' ? ['plant'] :
      ['wood', 'stone', 'plant'];
    const seenKinds = new Set<string>();
    let totalUnits = 0;
    const needed = DAILY_BY_ID[objId].target;
    for (let i = 0; i < WW * WW && totalUnits < needed; i++) {
      const tx = i % WW, ty = (i / WW) | 0;
      if (tx < 2 || ty < 2 || tx >= WW - 2 || ty >= WW - 2) continue;
      const s = sourceAt(r, tx, ty, now);
      if (!s || s.stock <= 0 || !wantedMat.includes(s.def.mat)) continue;
      if (objId === 'variety' && seenKinds.has(s.key)) continue;
      r.player.x = tx * TILE + 8;
      r.player.y = ty * TILE + 8;
      for (let swings = 0; swings < 12; swings++) {
        const before = sourceAt(r, tx, ty, now);
        if (!before || before.stock <= 0) break;
        const stockBefore = before.stock;
        now += 100;
        const hit = harvestHit(gs, tx, ty, harvestPower, now, r.player.x, r.player.y);
        if (hit.result !== 'yield') break;
        const after = sourceAt(r, tx, ty, now);
        const unitsDelta = Math.max(0, stockBefore - (after?.stock ?? 0));
        if (objId === 'variety' && unitsDelta > 0) {
          seenKinds.add(before.key);
          totalUnits = seenKinds.size;
          break;
        }
        totalUnits += unitsDelta;
        if (totalUnits >= needed) break;
      }
    }
    expect(totalUnits).toBeGreaterThanOrEqual(needed);
    return now;
  }

  if (objId === 'handcraft' || objId === 'recipes') {
    now = performLegitimateObjective(gs, 'timber', now);
    now = performLegitimateObjective(gs, 'quarry', now);
    // Harvest real grass/reeds on map for fiber
    for (let i = 0; i < WW * WW; i++) {
      const tx = i % WW, ty = (i / WW) | 0;
      const s = sourceAt(r, tx, ty, now);
      if (!s || s.stock <= 0 || !['grass', 'reed'].includes(s.key)) continue;
      r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8;
      for (let sw = 0; sw < 4; sw++) {
        now += 100;
        if (harvestHit(gs, tx, ty, harvestPower, now, r.player.x, r.player.y).result !== 'yield') break;
      }
      now = collectNearbyDrops(gs, now, ['wood', 'stone', 'fiber']);
      if (countItem(r, 'inv', 'fiber') >= 10) break;
    }
    now = collectNearbyDrops(gs, now, ['wood', 'stone', 'fiber']);
    act('craft', { recipe: 'rope' });
    act('craft', { recipe: 'torch' });
    if (objId === 'handcraft') act('craft', { recipe: 'energy_basic' });
    return now;
  }

  if (objId === 'raise') {
    now = performLegitimateObjective(gs, 'timber', now);
    now = performLegitimateObjective(gs, 'timber', now);
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
    now += 100;
    tick(gs, { ...IDLE_INP, mx: r.player.x, my: r.player.y }, 50, now);
    expect(r.poiSeen).toContain(unseen.id);
    return now;
  }

  if (objId === 'scavenge') {
    const loots = Object.values(r.entities).filter(e => e.kind === 'loot').slice(0, 2);
    expect(loots.length).toBe(2);
    for (const lt of loots) {
      const ltx = lt.tx!, lty = lt.ty!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) {
        if (w.economyMap.walkable[(lty + dy) * WW + (ltx + dx)]) {
          r.player.x = (ltx + dx) * TILE + 8;
          r.player.y = (lty + dy) * TILE + 8;
          break;
        }
      }
      act('observeLoot', { eid: lt.id });
    }
    return now;
  }

  throw new Error(`Unhandled objective helper for ${objId}`);
}

/** Fast O(1) seed finder without running 400 full startRun spawns. */
function findSeedWithRerollPair(today: string) {
  const supported = new Set(['timber', 'quarry', 'forage', 'variety', 'handcraft', 'recipes', 'raise', 'hydrate', 'chart', 'scavenge']);
  const probe = newGame();
  expect(dispatch(probe, { id: 'seed-probe', type: 'startRun', character: 'female', seed: 1 }, T0).ok).toBe(true);
  const pr = probe.run!;

  for (let seed = 1; seed <= 500; seed++) {
    pr.seed = seed;
    const base = generateDaily(today, dailySaltFor(pr), pr);
    const mockDaily = {
      date: today,
      runId: pr.id,
      objectives: base.map(id => ({ id, progress: 0, done: false, seen: [] as string[] })),
      points: 0,
      milestones: [] as string[],
      rerolled: false,
    };
    const mockStore = { ...freshStore(), daily: mockDaily };

    const partner = base.find(id => id === 'timber' || id === 'quarry' || id === 'forage' || id === 'hydrate');
    if (!partner || DAILY_BY_ID[partner].points >= 25) continue;

    for (const cand of base) {
      if (cand === partner || !['hunt2', 'scavenge', 'chart'].includes(cand)) continue;
      const swapped = uiReroll(mockStore, cand, pr);
      const rep = swapped.daily!.objectives.find(o => !base.includes(o.id))?.id;
      if (!rep || !supported.has(rep)) continue;
      // Avoid completing `cand` as a side effect of `rep`
      if (cand === 'chart' || cand === 'scavenge' || cand === 'hunt2') {
        if (rep === cand) continue;
        if (DAILY_BY_ID[partner].points + DAILY_BY_ID[rep].points >= 25) {
          return { seed, partner, swapFrom: cand, replacementId: rep };
        }
      }
    }
  }
  throw new Error('No matching seed found in 1..500');
}

describe('WP1 — Authoritative Daily Reroll (A1 Corrective)', () => {
  it('WP1-1/2 (RED->GREEN): rejects an uncommitted client rerolledFrom that would turn <25 base points into >=25 milestone points', () => {
    setActiveLayout('shipping_fresh');
    const today = dateKey(T0);
    const { seed, partner, swapFrom, replacementId } = findSeedWithRerollPair(today);

    const gs = newGame();
    expect(dispatch(gs, { id: 'wp1-neg-start', type: 'startRun', character: 'female', seed }, T0).ok).toBe(true);

    // Execute REAL gameplay actions for `partner` (<25 pts) + `replacementId` WITHOUT committing any reroll!
    // Base slate points = partner.points (< 25). Forged reroll slate points = partner.points + replacementId.points (>= 25).
    let now = T0 + 1000;
    now = performLegitimateObjective(gs, partner, now);
    now = performLegitimateObjective(gs, replacementId, now);

    const forged = dispatch(
      gs,
      { id: 'uncommitted-reroll-forge', type: 'journeyRequisition', date: today, milestone: 'ember', points: 99, rerolledFrom: swapFrom },
      now + 500,
    );
    expect(forged.ok).toBe(false);
    expect(gs.profile.securedCash).toBe(0);
  });

  it('WP1-3..6 (RED->GREEN): enforces run-authoritative once-per-UTC-day reroll, zero-progress restriction, duplicate rejection, save/reload, run restart, UTC rollover, and real-gameplay E2E claim', () => {
    setActiveLayout('shipping_fresh');
    const today = dateKey(T0);
    const { seed, partner, swapFrom, replacementId } = findSeedWithRerollPair(today);

    const gs = newGame();
    expect(dispatch(gs, { id: 'wp1-e2e-start', type: 'startRun', character: 'female', seed }, T0).ok).toBe(true);
    const r = gs.run!;
    let now = T0 + 1000;

    // 1. Make real progress on `partner` -> attempting to reroll `partner` MUST fail (zero-progress restriction)!
    now = performLegitimateObjective(gs, partner, now);
    expect(dispatch(gs, { id: 'reroll-nonzero', type: 'journeyReroll', date: today, from: partner }, now + 100).ok).toBe(false);

    // 2. Invalid date / non-existent objective MUST fail
    expect(dispatch(gs, { id: 'reroll-baddate', type: 'journeyReroll', date: '2026-11-08', from: swapFrom }, now + 150).ok).toBe(false);
    expect(dispatch(gs, { id: 'reroll-notinslate', type: 'journeyReroll', date: today, from: 'nonexistent_obj' }, now + 160).ok).toBe(false);

    // 3. Legitimate once-per-UTC-day authoritative reroll on untouched `swapFrom` SUCCEEDS and persists replacement!
    const okReroll = dispatch(gs, { id: 'reroll-valid-1', type: 'journeyReroll', date: today, from: swapFrom }, now + 200);
    expect(okReroll.ok).toBe(true);
    expect((r as any).dailyRerolls?.[today]).toMatchObject({ from: swapFrom, to: replacementId });

    // 4. Duplicate reroll attempt on the same UTC day MUST fail (even with distinct intent id and another untouched objective)!
    const otherUntouched = generateDaily(today, dailySaltFor(r), r).find(id => id !== partner && id !== swapFrom)!;
    expect(dispatch(gs, { id: 'reroll-dup-2', type: 'journeyReroll', date: today, from: otherUntouched }, now + 250).ok).toBe(false);

    // 5. Save & reload round-trip preserves committed reroll, syncs fresh JourneyStore UI, and still rejects duplicate reroll!
    now += 300;
    const reloaded = cloneViaSave(gs);
    expect((reloaded.run as any).dailyRerolls?.[today]).toMatchObject({ from: swapFrom, to: replacementId });
    const syncedUi = ingestJourney(freshStore(), reloaded, now).store;
    expect(syncedUi.daily?.rerolled).toBe(true);
    expect(syncedUi.daily?.rerolledFrom).toBe(swapFrom);
    expect(syncedUi.daily?.objectives.map(o => o.id)).toContain(replacementId);
    expect(dispatch(reloaded, { id: 'reroll-after-reload', type: 'journeyReroll', date: today, from: otherUntouched }, now + 50).ok).toBe(false);

    // 6. Before completing `replacementId`, claiming Ember (25 pts) fails since `partner` alone < 25 pts
    expect(dispatch(reloaded, { id: 'claim-too-early', type: 'journeyRequisition', date: today, milestone: 'ember' }, now + 80).ok).toBe(false);

    // 7. Complete `replacementId` via 100% legitimate gameplay actions (zero fake receipts!) -> claim Ember WITHOUT any client points/rerolledFrom!
    now = performLegitimateObjective(reloaded, replacementId, now + 100);
    const claimRes = dispatch(reloaded, { id: 'claim-ember-legit', type: 'journeyRequisition', date: today, milestone: 'ember' }, now + 200);
    expect(claimRes.ok, !claimRes.ok ? claimRes.reason : '').toBe(true);
    expect((BAL as any).journeyRequisitions.ember.securedCash).toBe(0);
    expect(reloaded.profile.securedCash).toBe(0);
    expect(countItem(reloaded.run!, 'inv', 'bandage')).toBe(3);

    // 8. Repeated claim on same UTC day (distinct intent id) MUST fail
    expect(dispatch(reloaded, { id: 'claim-ember-dup', type: 'journeyRequisition', date: today, milestone: 'ember' }, now + 250).ok).toBe(false);
    expect(reloaded.profile.securedCash).toBe(0);

    // 9. UTC rollover to next day (2026-11-10): yesterday's reroll does NOT carry over; new day allows a fresh once-per-day reroll!
    const day2At = Date.UTC(2026, 10, 10, 1, 0, 0);
    reloaded.run!.player.hunger = 100;
    reloaded.run!.player.thirst = 100;
    reloaded.run!.player.hp = 100;
    settle(reloaded, day2At, true);
    reloaded.run!.player.dead = false;
    reloaded.run!.player.hp = 100;
    const day2 = dateKey(day2At);
    expect(day2).toBe('2026-11-10');
    expect(dispatch(reloaded, { id: 'claim-stale-day1', type: 'journeyRequisition', date: today, milestone: 'hearth' }, day2At + 50).ok).toBe(false);
    const day2Slate = generateDaily(day2, dailySaltFor(reloaded.run!), reloaded.run!);
    expect(dispatch(reloaded, { id: 'reroll-day2', type: 'journeyReroll', date: day2, from: day2Slate[0] }, day2At + 100).ok).toBe(true);
    expect(dispatch(reloaded, { id: 'reroll-day2-dup', type: 'journeyReroll', date: day2, from: day2Slate[1] }, day2At + 150).ok).toBe(false);

    // 10. Run restart: abandon run 1 -> start run 2 -> run 2 starts with clean dailyRerolls!
    expect(dispatch(reloaded, { id: 'abandon-r1', type: 'abandon' }, day2At + 200).ok).toBe(true);
    expect(dispatch(reloaded, { id: 'start-r2', type: 'startRun', character: 'male', seed: 77 }, day2At + 300).ok).toBe(true);
    expect((reloaded.run as any).dailyRerolls).toBeUndefined();
    const r2Slate = generateDaily(day2, dailySaltFor(reloaded.run!), reloaded.run!);
    expect(dispatch(reloaded, { id: 'reroll-r2-day2', type: 'journeyReroll', date: day2, from: r2Slate[0] }, day2At + 350).ok).toBe(true);
  });
});

/** Build a real physical homestead on Veyra U=0.5 using actual engine `dispatch` actions (`build`, `upgradeStation`, `move`, `fillBarrel`, `farmConfigure`). */
function buildRealVeyraHomestead(seed = 404) {
  setActiveLayout(U05_WORLD_LAYOUT_ID);
  const gs = newGame();
  expect(dispatch(gs, { id: 'vy-start', type: 'startRun', character: 'female', seed }, T0).ok).toBe(true);
  const r = gs.run!;
  for (let s = seed; s < seed + 500; s++) {
    r.seed = s;
    if (!isWet(weatherAt(r, T0)) && !isWet(weatherAt(r, T0 + 15 * 60_000)) && !isWet(weatherAt(r, T0 + 30 * 60_000))) break;
  }
  r.creatures = [];

  const w = getWorld(), grid = blockGrid(r);
  let hx = 0, hy = 0;
  outer: for (let yy = 50; yy < 150; yy++) {
    for (let xx = 45; xx < 85; xx++) {
      const cells = [[-2, -2], [2, 0], [0, 1], [-1, 1], [0, 2], [1, 1], [0, 0], [0, -1]];
      if (cells.every(([dx, dy]) => {
        const i = (yy + dy) * WW + (xx + dx);
        return grid[i] === 0 && !w.sourceV3[i] && w.economyMap.buildable[i] && !w.economyMap.protected[i];
      })) {
        hx = xx; hy = yy;
        break outer;
      }
    }
  }
  expect(hx).toBeGreaterThan(0);

  let now = T0 + 500;
  let seq = 0;
  const act = (type: string, extra: Record<string, any> = {}) => {
    now += 50;
    const res = dispatch(gs, { id: `vy-farm-${++seq}`, type, ...extra }, now);
    expect(res.ok, !res.ok ? `${type}: ${res.reason}` : '').toBe(true);
    return res;
  };

  r.player.x = hx * TILE + 8;
  r.player.y = hy * TILE + 8;

  for (const [k, n] of [
    ['wood', 100], ['stone', 40], ['fiber', 30], ['rope', 8],
    ['iron_ingot', 10], ['mechanical_parts', 10], ['fasteners', 8], ['spares', 8],
    ['seed', 6],
  ] as const) {
    addItem(r, 'inv', k, n);
  }

  const buildAt = (struct: string, dx: number, dy: number) => {
    r.player.x = hx * TILE + 8;
    r.player.y = hy * TILE + 8;
    act('build', { struct, tx: hx + dx, ty: hy + dy });
    return Object.values(r.entities).find(e => e.type === struct && e.tx === hx + dx && e.ty === hy + dy)!;
  };

  buildAt('floor_wood', -2, -2);
  const cabinet = buildAt('claim', -2, -2);
  for (const [k, n] of [['wood', 80], ['stone', 80], ['fiber', 40], ['rope', 20], ['iron_ingot', 20], ['spares', 20], ['mechanical_parts', 20], ['fasteners', 20]] as const) {
    addItem(r, cabinet.c!, k, n);
  }

  const bench = buildAt('workbench', 2, 0);
  act('upgradeStation', { eid: bench.id });

  const tender = buildAt('farm_controller', 0, 1);
  const garden = buildAt('garden', -1, 1);
  const barrel = buildAt('barrel', 0, 2);
  const chest = buildAt('chest_small', 1, 1);

  const seedSlot = C(r, 'inv').slots.findIndex(s => s?.key === 'seed');
  expect(seedSlot).toBeGreaterThanOrEqual(0);
  r.player.x = chest.x; r.player.y = chest.y - TILE;
  act('move', { from: 'inv', fs: seedSlot, to: chest.c!, qty: 6 });

  const woodSlot = C(r, 'inv').slots.findIndex(s => s?.key === 'wood');
  expect(woodSlot).toBeGreaterThanOrEqual(0);
  r.player.x = tender.x; r.player.y = tender.y - TILE;
  act('move', { from: 'inv', fs: woodSlot, to: tender.c!, qty: 6 });

  const flask = C(r, 'inv').slots.find(s => s?.key === 'water_flask')!;
  expect(flask).toBeDefined();
  r.player.x = barrel.x; r.player.y = barrel.y - TILE;
  for (let i = 0; i < 8; i++) {
    flask.charge = ITEMS.water_flask.charge!;
    act('fillBarrel', { eid: barrel.id });
  }
  expect(barrel.water).toBe(8);

  r.player.x = tender.x; r.player.y = tender.y - TILE;
  act('farmConfigure', { eid: tender.id, field: 'gardenId', value: garden.id });
  act('farmConfigure', { eid: tender.id, field: 'barrelId', value: barrel.id });
  act('farmConfigure', { eid: tender.id, field: 'chestId', value: chest.id });
  act('farmConfigure', { eid: tender.id, field: 'crop', value: 'crop' });
  act('farmConfigure', { eid: tender.id, field: 'enabled', value: true });

  r.player.hunger = 100;
  r.player.thirst = 100;
  r.player.hp = 100;
  if (r.airdrops) r.airdrops.seed = r.seed;
  syncWorld(gs, now + 100);
  now += 100;

  return {
    gs, r, now, hx, hy,
    ids: { tender: tender.id, garden: garden.id, barrel: barrel.id, chest: chest.id, cabinet: cabinet.id },
    containers: { tenderC: tender.c!, chestC: chest.c!, cabinetC: cabinet.c! },
  };
}

describe('WP2 — Complete Veyra Offscreen Garden Tender (B6 Corrective)', () => {
  it('WP2-1..5 & 8 (RED->GREEN): completes full offscreen plant->grow->harvest->chest-transfer->replant cycles across repeated window shifts, save/reload, overnight settle, and full storage', () => {
    const h = buildRealVeyraHomestead(404);
    const { gs, r, ids, containers } = h;
    let now = h.now;

    expect(r.entities[ids.garden].garden?.crop).toBe('crop');
    expect(countItem(r, containers.chestC, 'seed')).toBe(5);

    // Install cold frame before leaving so rain cannot water the plot directly — every cycle MUST pump physical barrel water!
    addItem(r, 'inv', 'glass', 1);
    addItem(r, 'inv', 'herb', 1);
    r.player.x = r.entities[ids.garden].x;
    r.player.y = r.entities[ids.garden].y - TILE;
    expect(dispatch(gs, { id: 'wp2-frame', type: 'gardenFrame', eid: ids.garden }, now + 50).ok).toBe(true);
    now += 50;

    // Shift Veyra window EAST twice (+128, +128 = +256 tiles) so ALL 4 structures + cabinet become offscreen!
    expect(shiftVeyraWindowBy(gs, 128, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(gs, 128, 0, markDirty)).toBe(true);
    for (const id of [ids.tender, ids.garden, ids.barrel, ids.chest, ids.cabinet]) {
      expect(r.entities[id]).toBeUndefined();
      expect(r.veyraOffscreenEntities?.[id]).toBeDefined();
    }

    // Advance 25 minutes online while offscreen (>= 2 full offscreen harvest+replant cycles!)
    for (let step = 0; step < 150; step++) {
      now += 10_000;
      r.player.hunger = 100; r.player.thirst = 100;
      syncWorld(gs, now);
    }

    // Show the existing failure explicitly: crop matured to growth === 1, yet harvest + transfer + replant stopped!
    const harvestsAfterOnline = r.receipts.filter(rc => rc.kind === 'tender.harvest').length;
    const plantsAfterOnline = r.receipts.filter(rc => rc.kind === 'tender.plant').length;
    expect(harvestsAfterOnline, `offscreen plot growth=${r.veyraOffscreenEntities![ids.garden].garden?.growth}, chestCrop=${countItem(r, containers.chestC, 'crop')}`).toBeGreaterThanOrEqual(2);
    expect(countItem(r, containers.chestC, 'crop')).toBe(harvestsAfterOnline * 3);
    expect(countItem(r, containers.chestC, 'seed')).toBe(6 - plantsAfterOnline + harvestsAfterOnline * 2);
    expect(r.receipts.filter(rc => rc.kind === 'tender.water').length).toBeGreaterThanOrEqual(1);
    expect(countItem(r, containers.tenderC, 'wood')).toBeLessThan(5);

    // Zero-water physical cost check while offscreen: empty barrel + plot water -> pauses with no free growth!
    const savedBarrelWater = r.veyraOffscreenEntities![ids.barrel].water!;
    const savedPlotWater = r.veyraOffscreenEntities![ids.garden].garden!.water;
    const growthBeforeDry = r.veyraOffscreenEntities![ids.garden].garden!.growth;
    r.veyraOffscreenEntities![ids.barrel].water = 0;
    r.veyraOffscreenEntities![ids.garden].garden!.water = 0;
    syncWorld(gs, now + 5_000);
    now += 5_000;
    expect(r.veyraOffscreenEntities![ids.garden].garden!.growth).toBe(growthBeforeDry);
    expect(tenderStatus(r, r.veyraOffscreenEntities![ids.tender])).toMatch(/Waiting for water|Barrel needs water/);
    r.veyraOffscreenEntities![ids.barrel].water = Math.max(6, savedBarrelWater);
    r.veyraOffscreenEntities![ids.garden].garden!.water = savedPlotWater;

    // Save/reload while offscreen, then run offline catch-up (`settle` 20 minutes)!
    const saved = cloneViaSave(gs);
    const sr = saved.run!;
    settle(saved, now + 20 * 60_000, true);
    now += 20 * 60_000;
    const harvestsAfterSettle = sr.receipts.filter(rc => rc.kind === 'tender.harvest').length;
    expect(harvestsAfterSettle).toBeGreaterThan(harvestsAfterOnline);
    expect(countItem(sr, containers.chestC, 'crop')).toBe(harvestsAfterSettle * 3);
    expect(sr.veyraOffscreenEntities![ids.garden].hp).toBe(sr.veyraOffscreenEntities![ids.garden].maxHp);

    // Full storage pause check while offscreen
    addItem(sr, containers.tenderC, 'wood', 6);
    const chestSlots = C(sr, containers.chestC).slots;
    for (let i = 0; i < chestSlots.length; i++) {
      if (!chestSlots[i]) addItem(sr, containers.chestC, 'cart_kit', 1);
      else chestSlots[i]!.qty = ITEMS[chestSlots[i]!.key].max;
    }
    sr.veyraOffscreenEntities![ids.garden].garden!.crop = 'crop';
    sr.veyraOffscreenEntities![ids.garden].garden!.growth = 1;
    const energyBeforeFull = sr.veyraOffscreenEntities![ids.tender].farm!.energy;
    const woodBeforeFull = countItem(sr, containers.tenderC, 'wood');
    syncWorld(saved, now + 10_000);
    now += 10_000;
    expect(tenderStatus(sr, sr.veyraOffscreenEntities![ids.tender])).toMatch(/Storage full/);
    expect(sr.veyraOffscreenEntities![ids.garden].garden!.growth).toBe(1);
    expect(sr.veyraOffscreenEntities![ids.tender].farm!.energy).toBe(energyBeforeFull);
    expect(countItem(sr, containers.tenderC, 'wood')).toBe(woodBeforeFull);

    // Unfunded upkeep physical cost check while offscreen: empty cabinet -> structure loses HP -> tender pauses (`structure_decayed`)!
    const cabCopy = cloneViaSave(saved);
    const cabR = cabCopy.run!;
    C(cabR, containers.cabinetC).slots.fill(null);
    cabR.veyraOffscreenEntities![ids.cabinet].cabinet!.credit = {};
    cabR.player.hunger = 100; cabR.player.thirst = 100; cabR.player.hp = 100;
    settle(cabCopy, now + 15 * 60_000, true);
    expect(cabR.veyraOffscreenEntities![ids.garden].hp!).toBeLessThan(cabR.veyraOffscreenEntities![ids.garden].maxHp!);
    expect(tenderStatus(cabR, cabR.veyraOffscreenEntities![ids.tender])).toMatch(/decayed or unfunded/);

    // Return to original window (-128, -128) -> structures re-enter r.entities with zero duplication
    expect(shiftVeyraWindowBy(saved, -128, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(saved, -128, 0, markDirty)).toBe(true);
    for (const id of [ids.tender, ids.garden, ids.barrel, ids.chest, ids.cabinet]) {
      expect(sr.entities[id]).toBeDefined();
      expect(sr.veyraOffscreenEntities?.[id]).toBeUndefined();
    }
    for (let i = 0; i < chestSlots.length; i++) {
      if (chestSlots[i]?.key === 'cart_kit') chestSlots[i] = null;
    }
    syncWorld(saved, now + 5_000);
    expect(sr.entities[ids.garden].garden!.crop).toBe('crop');
    expect(sr.entities[ids.garden].garden!.growth).toBeLessThan(1);
    expect(validate(cloneViaSave(saved))).toBeTruthy();
  }, 30_000);

  it('WP2-6,7,9 (RED->GREEN): enforces exact onscreen vs offscreen parity (Map climate, soil, cold-frame, roof, evaporation, links across window edge)', () => {
    const base = buildRealVeyraHomestead(515);
    let now = base.now;
    const { ids, containers } = base;

    addItem(base.r, 'inv', 'glass', 1);
    addItem(base.r, 'inv', 'herb', 1);
    base.r.player.x = base.r.entities[ids.garden].x;
    base.r.player.y = base.r.entities[ids.garden].y - TILE;
    expect(dispatch(base.gs, { id: 'install-frame', type: 'gardenFrame', eid: ids.garden }, now + 50).ok).toBe(true);
    syncWorld(base.gs, now + 100);
    now += 100;

    const stayGs = cloneViaSave(base.gs);
    const awayGs = cloneViaSave(base.gs);
    expect(shiftVeyraWindowBy(awayGs, 128, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(awayGs, 128, 0, markDirty)).toBe(true);

    const wetNow = isWet(weatherAt(stayGs.run!, now));
    const envOn = gardenEnvironment(stayGs.run!, stayGs.run!.entities[ids.garden], wetNow, 'crop', now);
    const envOff = gardenEnvironment(awayGs.run!, awayGs.run!.veyraOffscreenEntities![ids.garden], wetNow, 'crop', now);
    expect(envOff).toEqual(envOn);

    // Straddling window shift: garden (hx - 1) stays onscreen (tx === 1), while tender (hx) / chest (hx + 1)?
    // Wait: shift west by -(hx - 2) -> Wait: shifting east by +(hx - 1) makes old hx - 1 become ltx = 0 -> offscreen (< 1!), while old hx becomes ltx = 1 (onscreen) and old hx + 1 becomes ltx = 2 (onscreen)!
    const straddleShift = base.hx - 1;
    const straddleGs = cloneViaSave(base.gs);
    expect(shiftVeyraWindowBy(straddleGs, straddleShift, 0, markDirty)).toBe(true);
    expect(Boolean(straddleGs.run!.veyraOffscreenEntities?.[ids.garden])).toBe(true);
    expect(Boolean(straddleGs.run!.entities[ids.tender])).toBe(true);
    expect(Boolean(straddleGs.run!.entities[ids.chest])).toBe(true);

    setActiveLayout(stayGs.run!.layoutId!);
    settle(stayGs, now + 20 * 60_000, true);
    setActiveLayout(awayGs.run!.layoutId!);
    settle(awayGs, now + 20 * 60_000, true);
    setActiveLayout(straddleGs.run!.layoutId!);
    settle(straddleGs, now + 20 * 60_000, true);
    for (let step = 1; step <= 60; step++) {
      const t = now + 20 * 60_000 + step * 10_000;
      stayGs.run!.player.hunger = 100; stayGs.run!.player.thirst = 100;
      awayGs.run!.player.hunger = 100; awayGs.run!.player.thirst = 100;
      straddleGs.run!.player.hunger = 100; straddleGs.run!.player.thirst = 100;
      setActiveLayout(stayGs.run!.layoutId!);
      syncWorld(stayGs, t);
      setActiveLayout(awayGs.run!.layoutId!);
      syncWorld(awayGs, t);
      setActiveLayout(straddleGs.run!.layoutId!);
      syncWorld(straddleGs, t);
    }

    expect(shiftVeyraWindowBy(awayGs, -128, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(awayGs, -128, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(straddleGs, -straddleShift, 0, markDirty)).toBe(true);

    const summarize = (g: GameState) => {
      const r = g.run!;
      return {
        crop: countItem(r, containers.chestC, 'crop'),
        seed: countItem(r, containers.chestC, 'seed'),
        wood: countItem(r, containers.tenderC, 'wood'),
        energy: r.entities[ids.tender].farm!.energy,
        barrelWater: r.entities[ids.barrel].water,
        plotWater: r.entities[ids.garden].garden!.water,
        plotGrowth: r.entities[ids.garden].garden!.growth,
        plotCrop: r.entities[ids.garden].garden!.crop,
        tenderEvents: r.receipts
          .filter(rc => rc.kind.startsWith('tender.'))
          .map(rc => [rc.kind, rc.detail, Math.round(rc.at)]),
      };
    };

    const sStay = summarize(stayGs);
    const sAway = summarize(awayGs);
    const sStraddle = summarize(straddleGs);

    expect(sStay.crop).toBeGreaterThanOrEqual(6);
    expect(sAway).toEqual(sStay);
    expect(sStraddle).toEqual(sStay);
  }, 30_000);
});
