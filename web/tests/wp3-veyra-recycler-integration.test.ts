import { afterEach, describe, expect, it } from 'vitest';
import {
  T,
  TILE,
  WH,
  WW,
  type Entity,
  type GameState,
  type RunState,
} from '../src/game/core';
import { ITEMS } from '../src/game/catalog';
import {
  blockGrid,
  C,
  countItem,
  dispatch,
  effTile,
  entsAt,
  harvestHit,
  markDirty,
  newGame,
  sourceAt,
  startRun,
} from '../src/game/engine';
import { selectSnapshots, serializeSnapshot, validate } from '../src/game/persist';
import { FX, HAZ, PROJ, settle } from '../src/game/sim';
import { getWorld, setActiveLayout, VEYRA_RECYCLER_SITE } from '../src/game/world';
import { hasAuthorizedRecycler } from '../src/game/wreck-economy';
import { maybeSlideVeyraWindow, windowOrigin } from '../src/veyra05/continuity';
import { activeFloor, applyFloor, stairAt } from '../src/veyra05/floors';
import { getWindowWorld, resetWindowToGround } from '../src/veyra05/window';

const NOW = Date.UTC(2026, 10, 11, 13, 0, 0);

afterEach(() => {
  PROJ.length = 0;
  HAZ.length = 0;
  FX.length = 0;
  setActiveLayout('shipping');
});

/** Walk along real walkable, non-blocked tiles (opening closed authored doors on the path) — never teleports across walls. */
function walkPathTo(
  gs: GameState,
  goalTiles: Set<number>,
  nowRef: { t: number },
): { tx: number; ty: number } | null {
  const r = gs.run!;
  const sx = Math.floor(r.player.x / TILE);
  const sy = Math.floor(r.player.y / TILE);
  const startIdx = sy * WW + sx;
  if (goalTiles.has(startIdx)) return { tx: sx, ty: sy };

  const g = blockGrid(r);
  const closedDoors = new Map<number, Entity>();
  for (const e of Object.values(r.entities)) {
    if (e.kind === 'door' && !e.open && e.tx !== undefined && e.ty !== undefined && !e.locked) {
      closedDoors.set(e.ty * WW + e.tx, e);
    }
  }

  const prev = new Int32Array(WW * WH).fill(-1);
  const visited = new Uint8Array(WW * WH);
  const q: number[] = [startIdx];
  visited[startIdx] = 1;
  let found = -1;

  for (let head = 0; head < q.length; head++) {
    const cur = q[head];
    if (goalTiles.has(cur)) { found = cur; break; }
    const cx = cur % WW, cy = (cur / WW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1) continue;
      const ni = ny * WW + nx;
      if (visited[ni]) continue;
      const b = g[ni];
      const passable = (b === 0 || b === 4) || (b === 3 && closedDoors.has(ni));
      if (!passable) continue;
      visited[ni] = 1;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (found < 0) return null;

  const path: number[] = [];
  for (let c = found; c !== -1; c = prev[c]) path.push(c);
  path.reverse();

  for (const idx of path) {
    const tx = idx % WW, ty = (idx / WW) | 0;
    const door = closedDoors.get(idx);
    if (door && !door.open) {
      const openRes = dispatch(gs, { id: `open-${door.id}-${nowRef.t}`, type: 'door', eid: door.id }, nowRef.t);
      expect(openRes.ok).toBe(true);
      nowRef.t += 100;
    }
    r.player.x = tx * TILE + 8;
    r.player.y = ty * TILE + 8;
    nowRef.t += 120;
  }
  return { tx: found % WW, ty: (found / WW) | 0 };
}

function adjacentWalkableGoals(r: RunState, tx: number, ty: number): Set<number> {
  const g = blockGrid(r);
  const out = new Set<number>();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ax = tx + dx, ay = ty + dy;
    if (ax < 1 || ay < 1 || ax >= WW - 1 || ay >= WH - 1) continue;
    const b = g[ay * WW + ax];
    if (b === 0 || b === 4) out.add(ay * WW + ax);
  }
  return out;
}

function findReachableSources(r: RunState, keys: readonly string[], now: number): { tx: number; ty: number; key: string }[] {
  const g = blockGrid(r);
  const sx = Math.floor(r.player.x / TILE);
  const sy = Math.floor(r.player.y / TILE);
  const visited = new Uint8Array(WW * WH);
  const q: number[] = [sy * WW + sx];
  visited[sy * WW + sx] = 1;
  const want = new Set(keys);
  const found: { tx: number; ty: number; key: string }[] = [];
  const seenSrc = new Set<number>();

  for (let head = 0; head < q.length; head++) {
    const cur = q[head];
    const cx = cur % WW, cy = (cur / WW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1) continue;
      const ni = ny * WW + nx;
      const src = sourceAt(r, nx, ny, now);
      if (src && src.stock > 0 && want.has(src.key) && !seenSrc.has(ni)) {
        seenSrc.add(ni);
        found.push({ tx: nx, ty: ny, key: src.key });
      }
      if (!visited[ni] && (g[ni] === 0 || g[ni] === 4)) {
        visited[ni] = 1;
        q.push(ni);
      }
    }
  }
  return found;
}

/** Compact identical stackable slots in 'inv' via real 'move' intents (same as dragging partial stacks together in the UI). */
function compactInv(gs: GameState, nowRef: { t: number }) {
  const r = gs.run!;
  const slots = C(r, 'inv').slots;
  for (let i = 0; i < slots.length; i++) {
    const dst = slots[i];
    if (!dst || dst.meta !== undefined || dst.dur !== undefined || dst.charge !== undefined) continue;
    const max = ITEMS[dst.key].max;
    if (max <= 1 || dst.qty >= max) continue;
    for (let j = slots.length - 1; j > i; j--) {
      const src = slots[j];
      if (!src || src.key !== dst.key || src.meta !== undefined || src.dur !== undefined || src.charge !== undefined) continue;
      if (dst.qty >= max) break;
      const mv = dispatch(gs, { id: `cmp-${i}-${j}-${nowRef.t}`, type: 'move', from: 'inv', fs: j, to: 'inv', ts: i }, nowRef.t);
      if (mv.ok) nowRef.t += 20;
    }
  }
}

function harvestSourceNaturally(
  gs: GameState,
  tx: number,
  ty: number,
  toolKey: string,
  nowRef: { t: number },
  expectedKeys: readonly string[],
): { collectedDrives: number } {
  const r = gs.run!;
  let collectedDrives = 0;
  const goals = adjacentWalkableGoals(r, tx, ty);
  if (!goals.size) return { collectedDrives: 0 };
  if (!walkPathTo(gs, goals, nowRef)) return { collectedDrives: 0 };

  const power = ITEMS[toolKey].power || {};
  for (let hit = 0; hit < 40; hit++) {
    const res = harvestHit(gs, tx, ty, power, nowRef.t, r.player.x, r.player.y, { extraction: 'playerTool' });
    nowRef.t += 350;
    if (res.result !== 'yield' || res.depleted) break;
  }

  const want = new Set(expectedKeys);
  const drops = Object.values(r.entities)
    .filter((e) => e.kind === 'drop' && e.c && want.has(C(r, e.c).slots[0]?.key || ''))
    .sort((a, b) => {
      const ka = C(r, a.c!).slots[0]?.key === 'damaged_drive' ? 0 : 1;
      const kb = C(r, b.c!).slots[0]?.key === 'damaged_drive' ? 0 : 1;
      return ka - kb;
    });

  for (const e of drops) {
    const st = C(r, e.c!).slots[0];
    if (!st) continue;
    const dtx = Math.floor(e.x / TILE), dty = Math.floor(e.y / TILE);
    const pGoals = new Set<number>([
      ...(blockGrid(r)[dty * WW + dtx] === 0 ? [dty * WW + dtx] : []),
      ...adjacentWalkableGoals(r, dtx, dty),
    ]);
    if (pGoals.size && walkPathTo(gs, pGoals, nowRef)) {
      const prevDrives = countItem(r, 'inv', 'damaged_drive');
      const pk = dispatch(gs, { id: `pk-${e.id}-${nowRef.t}`, type: 'pickup', eid: e.id }, nowRef.t);
      if (pk.ok) {
        nowRef.t += 100;
        if (countItem(r, 'inv', 'damaged_drive') > prevDrives) collectedDrives++;
      }
    }
  }
  compactInv(gs, nowRef);
  return { collectedDrives };
}

describe('WP3: End-to-End Veyra Natural-Source -> Foundry Recycler -> Spend -> Floor -1 -> Save/Reload Integration Proof', () => {
  it('harvests natural Veyra wrecks/resources (zero item injection), recycles damaged_drive at po_slag into spares, spends spares in real craft/build, and survives mandatory Floor -1 reload', () => {
    // 1. Start a fresh canonical Veyra05 world run (region 1 = Greywater; zero qaUsed, zero inspectAt, zero addItem)
    setActiveLayout('veyra05-world');
    const gs = newGame();
    expect(startRun(gs, 'female', NOW, 1, 901).ok).toBe(true);
    const r = gs.run!;
    expect(r.qaUsed).toBe(false);
    expect(r.wreckEconomy).toBe('recycler-v1');
    expect(hasAuthorizedRecycler(r)).toBe(true);
    expect(countItem(r, 'inv', 'damaged_drive')).toBe(0);
    expect(countItem(r, 'inv', 'spares')).toBe(0);
    r.creatures = []; // isolate integration from random ambient combat interruptions

    const nowRef = { t: NOW + 1000 };

    // 2. Harvest natural wood, stone, and accessible wrecks in Greywater before hiking to Slag Flats (charred trees in Slag yield charcoal, not wood)
    const WOOD_SOURCES = ['oak', 'pine', 'snowpine', 'palm', 'willow'] as const;
    for (const src of findReachableSources(r, WOOD_SOURCES, nowRef.t)) {
      if (countItem(r, 'inv', 'wood') >= 46) break;
      harvestSourceNaturally(gs, src.tx, src.ty, 'knife', nowRef, ['wood']);
    }
    for (const src of findReachableSources(r, ['rock'], nowRef.t)) {
      if (countItem(r, 'inv', 'stone') >= 20) break;
      harvestSourceNaturally(gs, src.tx, src.ty, 'knife', nowRef, ['stone']);
    }

    const harvestNearby = (wantDrives: number, wantScrap: number) => {
      for (const w of findReachableSources(r, ['wreck'], nowRef.t)) {
        if (countItem(r, 'inv', 'damaged_drive') >= wantDrives && countItem(r, 'inv', 'scrap') >= wantScrap) break;
        harvestSourceNaturally(gs, w.tx, w.ty, 'knife', nowRef, ['damaged_drive', 'scrap', 'spares']);
      }
    };

    harvestNearby(3, 42);

    // Walk toward po_slag (2414, 1896) using real BFS + maybeSlideVeyraWindow until po_slag's Foundry Recycler is loaded in the active window AND >= 3 drives + >= 42 scrap collected
    const hasRecyclerInWindow = () => Object.values(r.entities).some((e) => e.kind === 'recycler');
    for (let step = 0; step < 30; step++) {
      const [ox, oy] = windowOrigin(r);
      const localRecX = VEYRA_RECYCLER_SITE.tx - ox;
      const localRecY = VEYRA_RECYCLER_SITE.ty - oy;
      const recCentered =
        hasRecyclerInWindow() &&
        localRecX >= 30 &&
        localRecX <= WW - 30 &&
        localRecY >= 30 &&
        localRecY <= WH - 30;
      if (recCentered && countItem(r, 'inv', 'damaged_drive') >= 3 && countItem(r, 'inv', 'scrap') >= 42) break;

      const curGlobX = ox + Math.floor(r.player.x / TILE);
      const curGlobY = oy + Math.floor(r.player.y / TILE);
      const dxGlob = VEYRA_RECYCLER_SITE.tx - curGlobX;
      const dyGlob = VEYRA_RECYCLER_SITE.ty - curGlobY;
      // If we haven't found 3 drives / 42 scrap yet even after reaching po_slag, keep sweeping nearby east/south/west windows
      const sweepDirX = dxGlob > 30 ? WW - 12 : dxGlob < -30 ? 12 : step % 2 === 0 ? WW - 12 : 100;
      const sweepDirY = dyGlob > 30 ? WH - 12 : dyGlob < -30 ? 12 : step % 2 === 1 ? WH - 12 : 100;
      const edgeTx = recCentered ? (step % 2 === 0 ? WW - 12 : 12) : sweepDirX;
      const edgeTy = recCentered ? 100 : sweepDirY;

      const g = blockGrid(r);
      const targets = new Set<number>();
      for (let rad = 0; rad < 32 && targets.size === 0; rad++) {
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            const tx = Math.max(2, Math.min(WW - 3, edgeTx + dx));
            const ty = Math.max(2, Math.min(WH - 3, edgeTy + dy));
            if (g[ty * WW + tx] === 0) targets.add(ty * WW + tx);
          }
        }
      }
      if (targets.size && walkPathTo(gs, targets, nowRef)) {
        const slid = maybeSlideVeyraWindow(gs, markDirty);
        r.creatures = []; // keep test deterministic (no ambient monster ambush while testing industrial flow)
        if (slid && (countItem(r, 'inv', 'damaged_drive') < 3 || countItem(r, 'inv', 'scrap') < 42)) {
          harvestNearby(3, 42);
        }
      }
    }

    const driveCount = countItem(r, 'inv', 'damaged_drive');
    expect(driveCount).toBeGreaterThanOrEqual(3);

    // Every natural damaged_drive must have a harvest.component receipt referencing its exact stack UID
    const driveStacks = C(r, 'inv').slots.filter((s): s is NonNullable<typeof s> => s?.key === 'damaged_drive');
    expect(driveStacks.length).toBeGreaterThanOrEqual(3);
    for (const ds of driveStacks) {
      expect(r.receipts.some((rc) => rc.kind === 'harvest.component' && rc.detail.includes(ds.uid))).toBe(true);
    }

    // 3. Top up wood/stone if any remains needed along walkable routes in current window
    for (const src of findReachableSources(r, WOOD_SOURCES, nowRef.t)) {
      if (countItem(r, 'inv', 'wood') >= 42) break;
      harvestSourceNaturally(gs, src.tx, src.ty, 'knife', nowRef, ['wood']);
    }
    for (const src of findReachableSources(r, ['rock'], nowRef.t)) {
      if (countItem(r, 'inv', 'stone') >= 20) break;
      harvestSourceNaturally(gs, src.tx, src.ty, 'knife', nowRef, ['stone']);
    }

    // 4. Locate po_slag's Foundry Recycler (already streamed into window via pure walking) and walk right through slag_sort's door to it
    const rec = Object.values(r.entities).find((e) => e.kind === 'recycler')!;
    expect(rec).toBeTruthy();
    const [curOx, curOy] = windowOrigin(r);
    expect(rec.tx).toBe(VEYRA_RECYCLER_SITE.tx - curOx);
    expect(rec.ty).toBe(VEYRA_RECYCLER_SITE.ty - curOy);

    const recGoals = adjacentWalkableGoals(r, rec.tx!, rec.ty!);
    expect(walkPathTo(gs, recGoals, nowRef)).not.toBeNull();

    // Record incidental spares (if any dropped from wrecks) to verify exact Recycler delta independently
    const incidentalSpares = countItem(r, 'inv', 'spares');

    // Synchronize simulation clock to current action timestamp before timed station processing
    r.creatures = [];
    settle(gs, nowRef.t, true);
    if (r.player.dead) {
      throw new Error(`Player died before recycling: ${JSON.stringify(r.receipts.filter(rc => rc.kind === 'death'))}`);
    }

    // Feed 3 natural damaged_drive stacks sequentially into Foundry Recycler -> 6 spares in outC
    for (let i = 0; i < 3; i++) {
      const slot = C(r, 'inv').slots.findIndex((s) => s?.key === 'damaged_drive');
      expect(slot).toBeGreaterThanOrEqual(0);
      const stack = C(r, 'inv').slots[slot]!;
      const startRec = dispatch(gs, { id: `rec-${i}-${nowRef.t}`, type: 'recycleItem', eid: rec.id, slot, uid: stack.uid }, nowRef.t);
      expect(startRec.ok, (startRec as any).reason).toBe(true);
      settle(gs, nowRef.t + 13000, true);
      if (r.player.dead) {
        throw new Error(`Player died during recycle #${i}: ${JSON.stringify(r.receipts.filter(rc => rc.kind === 'death'))}`);
      }
      nowRef.t += 13500;
    }

    const outC = rec.station!.outC;
    expect(countItem(r, outC, 'spares')).toBe(6);
    const outSlot = C(r, outC).slots.findIndex((s) => s?.key === 'spares');
    const colRes = dispatch(gs, { id: `col-spares-${nowRef.t}`, type: 'move', from: outC, fs: outSlot, to: 'inv' }, nowRef.t);
    expect(colRes.ok, (colRes as any).reason).toBe(true);
    expect(countItem(r, 'inv', 'spares')).toBe(incidentalSpares + 6);
    nowRef.t += 500;

    // 5. Spend spares in legitimate production/crafting on real buildable tiles just outside po_slag's protected apron:
    // Build furnace & workbench from natural wood/stone/scrap -> smelt iron_ingot (scrap_ingot) -> craft mechanical_parts -> spend 4 spares building base_generator!
    const buildOpenSpot = (structKey: string) => {
      const g = blockGrid(r);
      const w = getWorld();
      const sx0 = Math.floor(r.player.x / TILE), sy0 = Math.floor(r.player.y / TILE);
      const seen = new Uint8Array(WW * WH);
      const q: number[] = [sy0 * WW + sx0];
      seen[sy0 * WW + sx0] = 1;
      const badTiles = new Set<number>([T.DEEP, T.SHALLOW, T.RIVER, T.CLIFF, T.PWALL, T.LAVA, T.FLOOR, T.ICE, T.ROAD, T.BRIDGE]);
      let tries = 0;
      let lastReason = 'no-buildable-tile-found';

      for (let head = 0; head < q.length; head++) {
        const cur = q[head];
        const tx = cur % WW, ty = (cur / WW) | 0;
        if (
          tx > 2 && ty > 2 && tx < WW - 3 && ty < WH - 3 &&
          g[cur] === 0 &&
          w.economyMap.buildable[cur] &&
          !w.economyMap.protected[cur] &&
          !w.accessCorridors?.mask[cur] &&
          !badTiles.has(effTile(r, tx, ty)) &&
          !(sourceAt(r, tx, ty)?.stock ?? 0) &&
          entsAt(r, tx, ty).length === 0
        ) {
          const adj = adjacentWalkableGoals(r, tx, ty);
          if (adj.size && walkPathTo(gs, adj, nowRef)) {
            const b = dispatch(gs, { id: `b-${structKey}-${tx}-${ty}-${nowRef.t}`, type: 'build', struct: structKey, tx, ty }, nowRef.t);
            if (b.ok) {
              nowRef.t += 200;
              return Object.values(r.entities).find((e) => e.kind === 'struct' && e.type === structKey && e.tx === tx && e.ty === ty)!;
            }
            lastReason = `${(b as any).reason} (wood=${countItem(r, 'inv', 'wood')}, stone=${countItem(r, 'inv', 'stone')}, spares=${countItem(r, 'inv', 'spares')})`;
            if (++tries >= 5) throw new Error(`buildOpenSpot(${structKey}) failed at ${tx},${ty}: ${lastReason}`);
          }
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = tx + dx, ny = ty + dy;
          if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1) continue;
          const ni = ny * WW + nx;
          if (!seen[ni] && (g[ni] === 0 || g[ni] === 4)) {
            seen[ni] = 1;
            q.push(ni);
          }
        }
      }
      throw new Error(`buildOpenSpot(${structKey}) exhausted BFS: ${lastReason}`);
    };

    // Ensure enough wood/stone/scrap separately (never over-harvest one resource searching for another)
    if (countItem(r, 'inv', 'wood') < 30) {
      for (const s of findReachableSources(r, WOOD_SOURCES, nowRef.t)) {
        if (countItem(r, 'inv', 'wood') >= 32) break;
        harvestSourceNaturally(gs, s.tx, s.ty, 'knife', nowRef, ['wood']);
      }
    }
    if (countItem(r, 'inv', 'stone') < 22) {
      for (const s of findReachableSources(r, ['rock'], nowRef.t)) {
        if (countItem(r, 'inv', 'stone') >= 24) break;
        harvestSourceNaturally(gs, s.tx, s.ty, 'knife', nowRef, ['stone']);
      }
    }
    if (countItem(r, 'inv', 'scrap') < 41) {
      for (const s of findReachableSources(r, ['wreck'], nowRef.t)) {
        if (countItem(r, 'inv', 'scrap') >= 42) break;
        harvestSourceNaturally(gs, s.tx, s.ty, 'knife', nowRef, ['scrap']);
      }
    }

    const furnace = buildOpenSpot('furnace')!;
    expect(furnace).toBeTruthy();
    const bench = buildOpenSpot('workbench')!;
    expect(bench).toBeTruthy();

    // Fuel furnace with natural wood and smelt scrap -> 11 iron_ingots via scrap_ingot (base: true; max queue 6 per batch)
    expect(walkPathTo(gs, adjacentWalkableGoals(r, furnace.tx!, furnace.ty!), nowRef)).not.toBeNull();
    compactInv(gs, nowRef);
    const woodSlot = C(r, 'inv').slots.findIndex((s) => s?.key === 'wood' && s.qty >= 14);
    expect(woodSlot).toBeGreaterThanOrEqual(0);
    expect(dispatch(gs, { id: `fuel-furn-${nowRef.t}`, type: 'move', from: 'inv', fs: woodSlot, to: furnace.station!.fuelC, qty: 14 }, nowRef.t).ok).toBe(true);
    for (let i = 0; i < 6; i++) {
      expect(dispatch(gs, { id: `smelt-a-${i}-${nowRef.t}`, type: 'craft', recipe: 'scrap_ingot', eid: furnace.id }, nowRef.t).ok).toBe(true);
      nowRef.t += 50;
    }
    settle(gs, nowRef.t + 75_000, true);
    nowRef.t += 76_000;
    for (let i = 0; i < 5; i++) {
      expect(dispatch(gs, { id: `smelt-b-${i}-${nowRef.t}`, type: 'craft', recipe: 'scrap_ingot', eid: furnace.id }, nowRef.t).ok).toBe(true);
      nowRef.t += 50;
    }
    settle(gs, nowRef.t + 65_000, true);
    nowRef.t += 66_000;
    const furnOutSlot = C(r, furnace.station!.outC).slots.findIndex((s) => s?.key === 'iron_ingot');
    expect(furnOutSlot).toBeGreaterThanOrEqual(0);
    expect(dispatch(gs, { id: `col-ingot-${nowRef.t}`, type: 'move', from: furnace.station!.outC, fs: furnOutSlot, to: 'inv' }, nowRef.t).ok).toBe(true);
    expect(countItem(r, 'inv', 'iron_ingot')).toBeGreaterThanOrEqual(11);

    // Craft 8 mechanical_parts at workbench (4 jobs x 2 parts; cost 8 scrap + 4 iron_ingot)
    expect(walkPathTo(gs, adjacentWalkableGoals(r, bench.tx!, bench.ty!), nowRef)).not.toBeNull();
    for (let i = 0; i < 4; i++) {
      expect(dispatch(gs, { id: `mp-${i}-${nowRef.t}`, type: 'craft', recipe: 'mechanical_parts', eid: bench.id }, nowRef.t).ok).toBe(true);
      nowRef.t += 50;
    }
    settle(gs, nowRef.t + 52_000, true);
    nowRef.t += 53_000;
    const mpSlot = C(r, bench.station!.outC).slots.findIndex((s) => s?.key === 'mechanical_parts');
    expect(mpSlot).toBeGreaterThanOrEqual(0);
    expect(dispatch(gs, { id: `col-mp-${nowRef.t}`, type: 'move', from: bench.station!.outC, fs: mpSlot, to: 'inv' }, nowRef.t).ok).toBe(true);
    expect(countItem(r, 'inv', 'mechanical_parts')).toBeGreaterThanOrEqual(7);

    // Spend 4 recycled spares in a real BUILD sink: Field Generator (base_generator)
    const sparesBeforeSpend = countItem(r, 'inv', 'spares');
    expect(sparesBeforeSpend).toBeGreaterThanOrEqual(6);
    const gen = buildOpenSpot('base_generator')!;
    expect(gen).toBeTruthy();
    expect(countItem(r, 'inv', 'spares')).toBe(sparesBeforeSpend - 4);
    expect(gen.basePower?.network).toBe('wire-v1');

    // Upgrade workbench to Level 2 (cost 2 mechanical_parts + 1 iron_ingot) & spend 2 recycled spares in a real CRAFT sink: Utility Frame (vehicle_frame)
    expect(walkPathTo(gs, adjacentWalkableGoals(r, bench.tx!, bench.ty!), nowRef)).not.toBeNull();
    expect(dispatch(gs, { id: `upg-bench-${nowRef.t}`, type: 'upgradeStation', eid: bench.id }, nowRef.t).ok).toBe(true);
    expect(bench.station!.level).toBe(2);
    expect(dispatch(gs, { id: `craft-frame-${nowRef.t}`, type: 'craft', recipe: 'vehicle_frame', eid: bench.id }, nowRef.t).ok).toBe(true);
    settle(gs, nowRef.t + 26_000, true);
    nowRef.t += 27_000;
    const vfSlot = C(r, bench.station!.outC).slots.findIndex((s) => s?.key === 'vehicle_frame');
    expect(vfSlot).toBeGreaterThanOrEqual(0);
    expect(dispatch(gs, { id: `col-vf-${nowRef.t}`, type: 'move', from: bench.station!.outC, fs: vfSlot, to: 'inv' }, nowRef.t).ok).toBe(true);
    expect(countItem(r, 'inv', 'vehicle_frame')).toBe(1);
    expect(countItem(r, 'inv', 'spares')).toBe(sparesBeforeSpend - 6);

    // Zero QA/inspect/cheat tampering across the whole natural loop
    expect(r.qaUsed).toBe(false);
    expect(r.receipts.some((rc) => rc.kind.startsWith('qa') || rc.kind === 'inspect')).toBe(false);

    // 6. MANDATORY Floor -1 Descent, Save/Reload, and Return (NO `if` skip guards, NO window teleports!)
    // Walk inside po_slag to the Ground -> Floor -1 stair (`Quench drain service hatch`), descend, save/reload, and ascend back to Floor 0.
    const slagWw = getWindowWorld(r.layoutId!);
    const stairToB1 = slagWw.floors.ground.stairs.find((s) => s.to === -1 && s.from === 0)!;
    expect(stairToB1).toBeDefined();

    const [winOx, winOy] = windowOrigin(r);
    const sx = stairToB1.x - winOx;
    const sy = stairToB1.y - winOy;
    expect(walkPathTo(gs, new Set([sy * WW + sx]), nowRef)).not.toBeNull();

    // Verify stairAt recognizes the exact Ground -> -1 stair landing and descend cleanly
    const resolvedStair = stairAt(slagWw.floors, r, sx, sy);
    expect(resolvedStair).not.toBeNull();
    expect(resolvedStair!.to).toBe(-1);

    expect(
      applyFloor(
        gs,
        slagWw,
        slagWw.floors,
        -1,
        [stairToB1.tx - winOx, stairToB1.ty - winOy],
        markDirty,
      ),
    ).toBe(true);
    expect(activeFloor(r)).toBe(-1);
    expect(hasAuthorizedRecycler(r)).toBe(true);

    // Save & cold reload WHILE standing on Floor -1
    const snapB1 = serializeSnapshot(gs);
    const parsedB1 = JSON.parse(snapB1);
    expect(validate(JSON.parse(parsedB1.payload))).toBeTruthy();
    const reloaded = selectSnapshots([snapB1, null]).gs!;
    expect(reloaded).toBeTruthy();
    expect(activeFloor(reloaded.run!)).toBe(-1);
    expect(hasAuthorizedRecycler(reloaded.run!)).toBe(true);
    expect(reloaded.run!.wreckEconomy).toBe('recycler-v1');
    expect(reloaded.run!.qaUsed).toBe(false);
    // Built generator, crafted vehicle_frame & spares balance on Floor 0 remain intact across Floor -1 cold reload
    expect(reloaded.run!.entities[gen.id]?.type).toBe('base_generator');
    expect(countItem(reloaded.run!, 'inv', 'vehicle_frame')).toBe(1);
    expect(countItem(reloaded.run!, 'inv', 'spares')).toBe(sparesBeforeSpend - 6);

    // Ascend back to Floor 0 using the Floor -1 return stair
    const loadedWw = getWindowWorld(reloaded.run!.layoutId!);
    const returnStair = loadedWw.floors.layers.get(-1)!.stairs.find((s) => s.to === 0 || s.from === 0)!;
    const [lOx, lOy] = windowOrigin(reloaded.run!);
    const [upLx, upLy] =
      returnStair.to === 0
        ? [returnStair.tx - lOx, returnStair.ty - lOy]
        : [returnStair.x - lOx, returnStair.y - lOy];
    expect(applyFloor(reloaded, loadedWw, loadedWw.floors, 0, [upLx, upLy], markDirty)).toBe(true);
    expect(activeFloor(reloaded.run!)).toBe(0);
    expect(reloaded.run!.entities[gen.id]?.type).toBe('base_generator');

    resetWindowToGround(loadedWw);
  });
});
