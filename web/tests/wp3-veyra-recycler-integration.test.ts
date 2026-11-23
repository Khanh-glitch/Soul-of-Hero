import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TILE,
  WH,
  WW,
  type Entity,
  type GameState,
  type RunState,
} from '../src/game/core';
import { ITEMS, RECIPES, SOURCES } from '../src/game/catalog';
import {
  blockGrid,
  C,
  countItem,
  dispatch,
  harvestHit,
  markDirty,
  newGame,
  sourceAt,
  startRun,
} from '../src/game/engine';
import { selectSnapshots, serializeSnapshot, validate } from '../src/game/persist';
import { FX, HAZ, PROJ, findInteract, settle } from '../src/game/sim';
import { recoveryPlan } from '../src/game/recycler';
import { setActiveLayout, VEYRA_RECYCLER_SITE } from '../src/game/world';
import { hasAuthorizedRecycler } from '../src/game/wreck-economy';
import { maybeSlideVeyraWindow, windowOrigin } from '../src/veyra05/continuity';
import { activeFloor, applyFloor, stairAt } from '../src/veyra05/floors';
import { getWindowWorld, resetWindowToGround } from '../src/veyra05/window';

const NOW = process.env.SOH_WP3_SNAP_DIR ? Date.now() - 1_200_000 : Date.UTC(2026, 10, 11, 13, 0, 0);

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
    const res = harvestHit(gs, tx, ty, power, nowRef.t, r.player.x, r.player.y, { extraction: 'playerTool', tool: toolKey });
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

describe('WP3: End-to-End Veyra Natural-Source -> Foundry Recycler -> Floor -1 -> Save/Reload Integration Proof (item set v3)', () => {
  it('knaps a Stone Pickaxe by hand, pries natural Veyra wrecks for Spare Parts and machine parts (zero item injection, zero Damaged Drives), recycles one machine part at po_slag, and survives mandatory Floor -1 reload', () => {
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

    // 2. Natural tool (Creator ruling 2026-11-23, follow Last Island): the run starts with a Stone Axe, which fells trees
    //    and chips stone slowly. Gather wood, stone and fiber with it, twist rope and knap a Stone Pickaxe by hand — no item injection.
    expect(C(r, 'inv').slots[0]?.key).toBe('stone_axe');
    expect(ITEMS.stone_axe.power).toMatchObject({ wood: 3, stone: 1, ore: 1 });
    const WOOD_SOURCES = ['oak', 'pine', 'snowpine', 'palm', 'willow'] as const;
    const pickBill = new Map<string, number>(RECIPES.stone_pick.ins);
    const ropeBill = new Map<string, number>(RECIPES.rope.ins);
    const gather = (keys: readonly string[], item: string, want: number) => {
      for (const src of findReachableSources(r, keys, nowRef.t)) {
        if (countItem(r, 'inv', item) >= want) break;
        harvestSourceNaturally(gs, src.tx, src.ty, 'stone_axe', nowRef, [item]);
      }
      expect(countItem(r, 'inv', item), `natural ${item}`).toBeGreaterThanOrEqual(want);
    };
    gather(WOOD_SOURCES, 'wood', pickBill.get('wood') ?? 0);
    gather(['rock'], 'stone', pickBill.get('stone') ?? 0);
    gather(['grass', 'reed'], 'fiber', (ropeBill.get('fiber') ?? 0) * (pickBill.get('rope') ?? 0));
    for (let i = 0; i < (pickBill.get('rope') ?? 0); i++) {
      const rope = dispatch(gs, { id: `rope-${i}-${nowRef.t}`, type: 'craft', recipe: 'rope' }, nowRef.t);
      expect(rope.ok, (rope as any).reason).toBe(true);
      nowRef.t += 1100;
    }
    const pick = dispatch(gs, { id: `pick-${nowRef.t}`, type: 'craft', recipe: 'stone_pick' }, nowRef.t);
    expect(pick.ok, (pick as any).reason).toBe(true);
    nowRef.t += 2100;
    expect(countItem(r, 'inv', 'stone_pick')).toBe(1);
    expect(ITEMS.stone_pick.power?.scrap ?? 0).toBeGreaterThan(0);

    // 3. Item set v3 / G1A: Veyra's salvage stands at the roadside (Relay Wrecks, Salvage Bales). Each unit pays Spare
    //    Parts directly and, on a bonus roll, a whole machine part. The Damaged Drive is retired, so the Recycler's
    //    natural input is one of those machine parts. Both sources answer only to their per-tool table (G1A_HARVEST).
    const SALVAGE_SOURCES = ['road_relay_wreck', 'road_salvage_bale'] as const;
    for (const k of SALVAGE_SOURCES) {
      expect(SOURCES[k].harvestBy?.stone_pick ?? 0, `${k} answers to the Stone Pickaxe`).toBeGreaterThan(0);
      expect(SOURCES[k].harvestBy?.wood_club ?? 0, `${k} answers to the Wood Club (the melee line works the roadside)`).toBe(2);
    }
    const RECYCLABLE = ['mechanical_gear', 'metal_pipe', 'iron_plate'] as const;
    const WANT_SPARES = 6;
    const recyclableHeld = () => RECYCLABLE.reduce((n, k) => n + countItem(r, 'inv', k), 0);
    const enough = () => recyclableHeld() >= 1 && countItem(r, 'inv', 'spares') >= WANT_SPARES;
    const harvestNearby = () => {
      for (const w of findReachableSources(r, SALVAGE_SOURCES, nowRef.t)) {
        if (enough()) break;
        harvestSourceNaturally(gs, w.tx, w.ty, 'stone_pick', nowRef, ['spares', ...RECYCLABLE]);
      }
    };

    harvestNearby();

    // Walk toward po_slag using real BFS + maybeSlideVeyraWindow until the Foundry Recycler is loaded in the active
    // window AND the pack holds a recyclable machine part plus the spares.
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
      if (recCentered && enough()) break;

      const curGlobX = ox + Math.floor(r.player.x / TILE);
      const curGlobY = oy + Math.floor(r.player.y / TILE);
      const dxGlob = VEYRA_RECYCLER_SITE.tx - curGlobX;
      const dyGlob = VEYRA_RECYCLER_SITE.ty - curGlobY;
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
        if (slid && !enough()) harvestNearby();
      }
    }

    expect(countItem(r, 'inv', 'spares'), 'natural spares').toBeGreaterThanOrEqual(WANT_SPARES);
    expect(recyclableHeld(), 'natural recyclable machine parts').toBeGreaterThanOrEqual(1);
    // The retired drive is never issued: not in the pack, not on the ground, no receipt.
    expect(countItem(r, 'inv', 'damaged_drive')).toBe(0);
    expect(Object.values(r.entities).some((e) => e.kind === 'drop' && e.c && C(r, e.c).slots.some((s) => s?.key === 'damaged_drive'))).toBe(false);
    expect(r.receipts.some((rc) => rc.kind === 'harvest.component')).toBe(false);

    // 4. Locate po_slag's Foundry Recycler (already streamed into window via pure walking) and walk right through slag_sort's door to it
    const rec = Object.values(r.entities).find((e) => e.kind === 'recycler')!;
    expect(rec).toBeTruthy();
    const [curOx, curOy] = windowOrigin(r);
    expect(rec.tx).toBe(VEYRA_RECYCLER_SITE.tx - curOx);
    expect(rec.ty).toBe(VEYRA_RECYCLER_SITE.ty - curOy);

    const recGoals = adjacentWalkableGoals(r, rec.tx!, rec.ty!);
    expect(walkPathTo(gs, recGoals, nowRef)).not.toBeNull();

    // Synchronize simulation clock to current action timestamp before timed station processing
    r.creatures = [];
    settle(gs, nowRef.t, true);
    if (r.player.dead) {
      throw new Error(`Player died before recycling: ${JSON.stringify(r.receipts.filter(rc => rc.kind === 'death'))}`);
    }

    const snapDir = process.env.SOH_WP3_SNAP_DIR;
    if (snapDir) {
      mkdirSync(snapDir, { recursive: true });
      r.player.aim = Math.atan2(rec.y - r.player.y, rec.x - r.player.x);
      expect(findInteract(gs, nowRef.t)?.kind).toBe('recycler');
      writeFileSync(resolve(snapDir, 'po-slag-recycler.json'), serializeSnapshot(gs), 'utf8');
    }

    // Feed one natural machine part into the Foundry Recycler. A stacked part is split by a real `split` intent first
    // (the Recycler takes exactly one unit); the output must equal the live recovery plan for that part.
    const isPart = (s: { key: string } | null | undefined) => !!s && (RECYCLABLE as readonly string[]).includes(s.key);
    let slot = C(r, 'inv').slots.findIndex((s) => isPart(s) && s!.qty === 1);
    if (slot < 0) {
      const stacked = C(r, 'inv').slots.findIndex((s) => isPart(s));
      expect(stacked).toBeGreaterThanOrEqual(0);
      const sp = dispatch(gs, { id: `split-${nowRef.t}`, type: 'split', c: 'inv', slot: stacked, qty: 1 }, nowRef.t);
      expect(sp.ok, (sp as any).reason).toBe(true);
      nowRef.t += 100;
      slot = C(r, 'inv').slots.findIndex((s) => isPart(s) && s!.qty === 1);
    }
    expect(slot).toBeGreaterThanOrEqual(0);
    const part = C(r, 'inv').slots[slot]!;
    const partKey = part.key;
    const plan = recoveryPlan(part)!;
    expect(plan, `live recovery plan for ${partKey}`).toBeTruthy();
    expect(plan.outputs.length).toBeGreaterThan(0);
    const heldBefore = new Map(plan.outputs.map(([k]) => [k, countItem(r, 'inv', k)]));
    const partsBefore = countItem(r, 'inv', partKey);
    const sparesBeforeRecycle = countItem(r, 'inv', 'spares');

    const startRec = dispatch(gs, { id: `rec-${nowRef.t}`, type: 'recycleItem', eid: rec.id, slot, uid: part.uid }, nowRef.t);
    expect(startRec.ok, (startRec as any).reason).toBe(true);
    expect(countItem(r, 'inv', partKey)).toBe(partsBefore - 1);
    settle(gs, nowRef.t + plan.total + 1000, true);
    if (r.player.dead) {
      throw new Error(`Player died during recycle: ${JSON.stringify(r.receipts.filter(rc => rc.kind === 'death'))}`);
    }
    nowRef.t += plan.total + 1500;

    const outC = rec.station!.outC;
    expect(rec.station!.queue.length).toBe(0);
    for (const [k, q] of plan.outputs) expect(countItem(r, outC, k), `recycler output ${k}`).toBe(q);
    for (const [k] of plan.outputs) {
      const outSlot = C(r, outC).slots.findIndex((s) => s?.key === k);
      const colRes = dispatch(gs, { id: `col-${k}-${nowRef.t}`, type: 'move', from: outC, fs: outSlot, to: 'inv' }, nowRef.t);
      expect(colRes.ok, (colRes as any).reason).toBe(true);
      nowRef.t += 200;
    }
    for (const [k, q] of plan.outputs) expect(countItem(r, 'inv', k), `collected ${k}`).toBe((heldBefore.get(k) ?? 0) + q);
    // Recycling a machine part never mints Spare Parts (finite salvage; bible K4).
    expect(plan.outputs.some(([k]) => k === 'spares')).toBe(false);
    expect(countItem(r, 'inv', 'spares')).toBe(sparesBeforeRecycle);
    const held = Object.fromEntries(['spares', 'stone_pick', ...RECYCLABLE, ...plan.outputs.map(([k]) => k)].map((k) => [k, countItem(r, 'inv', k)]));

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
    if (snapDir) {
      writeFileSync(resolve(snapDir, 'floor-minus1.json'), snapB1, 'utf8');
    }
    const parsedB1 = JSON.parse(snapB1);
    expect(validate(JSON.parse(parsedB1.payload))).toBeTruthy();
    const reloaded = selectSnapshots([snapB1, null]).gs!;
    expect(reloaded).toBeTruthy();
    expect(activeFloor(reloaded.run!)).toBe(-1);
    expect(hasAuthorizedRecycler(reloaded.run!)).toBe(true);
    expect(reloaded.run!.wreckEconomy).toBe('recycler-v1');
    expect(reloaded.run!.qaUsed).toBe(false);
    // The hand-made pick, the natural spares, the remaining machine parts and the recycled output all survive the
    // Floor -1 cold reload, and the Recycler is left idle and empty.
    for (const [k, q] of Object.entries(held)) expect(countItem(reloaded.run!, 'inv', k), `reloaded ${k}`).toBe(q);
    expect(countItem(reloaded.run!, 'inv', 'damaged_drive')).toBe(0);

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
    const recAfter = Object.values(reloaded.run!.entities).find((e) => e.kind === 'recycler');
    expect(recAfter?.station?.queue.length).toBe(0);
    for (const [k, q] of Object.entries(held)) expect(countItem(reloaded.run!, 'inv', k), `back on ground ${k}`).toBe(q);

    resetWindowToGround(loadedWw);
  });
});
