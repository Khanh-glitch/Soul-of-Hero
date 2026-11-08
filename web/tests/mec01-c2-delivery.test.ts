// MEC-01 R2 — C2: actual single-haul freight delivery, authorized Shipping source -> player field depot.
// WHAT IS REAL HERE
//   The source is the authored factory exterior industrial-toolbox crate (poi 'factory', signature
//   scrapx6+sparesx3+iron_swordx1+mechanical_partsx2+fastenersx3 + B05-v1 high roll), an authorized loot-source-v2
//   cache. Cargo moves source -> transport container by real `move` intents (UIDs preserved byte-for-byte),
//   the haul runs on the actual 200x200 map through tick() with held direction keys (no teleport between the ends,
//   no invisible road), and unloading into the depot chest is again real `move` intents.
//   Vehicle modes use the real vehicle geometry (vehicleCell) for deployment and driving; fuel, wear, odometer and
//   the vehicle.exit receipt come from the engine. Same seed everywhere: the three mode runs face the same world.
// WHAT IS FIXTURE (labelled, never NATURAL_INPUT)
//   [F1] The player is fixture-placed beside the crate and beside the depot at the two ENDS only. The haul between
//        them is tick()-driven movement; no position is set except at the ends.
//   [F2] The Hand Cart (cart_kit) / packed Motorbike (motorbike_kit) and three Fuel Canisters are fixture grants.
//        A far haul outruns one 300-unit tank; the harness refuels through the engine's own vehicleRefuel intent
//        (mounted, real receipts) exactly when the tank drops below 120 — the intended use of the granted cans.
//        Producing the kit through the full chain is proven in tests/mec01-c1-motorbike-chain.test.ts; granting it
//        here keeps the freight comparison isolated from the build test.
//   [F3] Depot build materials (wood/ingot) are grants; the build itself is a real paid action.
//   [F4] Creatures are NOT cleared: exposure (damage taken) is recorded per row, not neutralized.
// ROUTE CLASSES: 'near' = depot in the [118..152]x[112..128] window (short haul); 'far' = whole-map scan, >=45 tiles from the
//   factory, the SAME three-mode-feasible cell for walk/cart/bike (long-haul class; the map has only 97 vehicleGeometry road
//   cells and a walk-reachable blob ~85 tiles across, so the far class is capped by geography, not by choice).
// TIMING SCOPE: SIM_FIXTURE_MEASUREMENT - seconds come from tick(50 ms) with scripted held-key input, not a human hand.
//   This file proves source->container->route->container->destination custody with real UIDs on real map geometry;
//   it is not a claim of human driving skill, balance enjoyment or NATURAL_INPUT play.
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { BAL, TILE, WW, WH, T, type Entity, type GameState, type Stack } from '../src/game/core';
import { addItem, C, dispatch, newGame, cartWeight, invWeight, carryLimit, buildReason, removeItem } from '../src/game/engine';
import { getWorld, setActiveLayout } from '../src/game/world';
import { weatherAt, isWet } from '../src/game/engine';
import { settle, tick, type Input } from '../src/game/sim';
import { astar, checkpoints, pathLengthPx, cellSeconds } from './mec01-path';

const SEED = 4242;
const T0 = Date.UTC(2026, 10, 8, 6, 0, 0);
let serial = 0;
const act = (g: GameState, type: string, data: object = {}, now = T0) => dispatch(g, { id: `c2-${++serial}`, type, ...data } as any, now);
const still: Input = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false };
afterEach(() => setActiveLayout('shipping_fresh'));

/** Fixed shipping_fresh POI coordinates (authored, from the live world). */
const FACTORY = { tx: 150, ty: 103 };
const CRATE_ADJ = { tx: 150, ty: 104 };       // walkable cell south of the crate

function freshRun() {
  setActiveLayout('shipping_fresh');
  const g = newGame();
  expect(act(g, 'startRun', { character: 'female', region: 0, seed: SEED }).ok).toBe(true);
  return g;
}
const worldStatics = () => getWorld('shipping_fresh').statics;

/** Deterministic farthest-from-factory buildable depot cell; tries neighbours on failure (creatures may block a tile).
 *  near (default): scan the authored near window [118..152]x[112..128] — the short-haul class.
 *  far: scan the whole map, cells at least 45 tiles from the factory, sorted by distance desc — the long-haul class.
 *  In both classes the candidate list is pre-checked for walk+cart+bike reachability before any chest is built. */
function pickDepotCells(far = false): { x: number; y: number }[] {
  const w = getWorld('shipping_fresh'), em = w.economyMap;
  const okTile = new Set<number>([T.GRASS, T.MEADOW, T.SAND, T.HILL, T.BURNT]);
  const cand: { x: number; y: number; d: number }[] = [];
  const [x0, x1, y0, y1] = far ? [0, WW - 1, 0, WH - 1] : [118, 152, 112, 128];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * WW + x;
    if (em.protected[i]) continue;
    if (w.accessCorridors?.mask[i]) continue;
    if (w.sourceV3?.[i]) continue;
    if (worldStatics().some(s => s.tx === x && s.ty === y)) continue;
    if (!okTile.has(w.tiles[i])) continue;
    const d = Math.hypot(x - FACTORY.tx, y - FACTORY.ty);
    if (far && d < 45) continue;   // the far class must be genuinely long, not a slightly-extended near run
    cand.push({ x, y, d });
  }
  cand.sort((a, b) => b.d - a.d);
  return cand;
}
/** 4-dir BFS reachability mask from `from` for a mode (cellSeconds !== null). The shipping_fresh reachable blob from the
 *  factory is only ~5927 cells across ~85 tiles, so scanning unfiltered farthest cells first would drown the scan in
 *  water/cliff-locked corners for no gain; the mask skips them before a single A* or build is attempted. */
function reachableMask(r: import('../src/game/core').RunState, fx: number, fy: number, mode: 'walk' | 'cart' | 'bike'): Uint8Array {
  const seen = new Uint8Array(WW * WH);
  const q = [fy * WW + fx];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % WW, y = (i / WW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue;
      const j = ny * WW + nx;
      if (seen[j] || cellSeconds(r, nx, ny, mode) === null) continue;
      seen[j] = 1; q.push(j);
    }
  }
  return seen;
}
/** Pre-check: some neighbour of the cell is reachable by every mode (walk, cart, bike) from the crate's adjacent cell.
 *  Runs BEFORE the real build action so a corridor-hostile candidate never wastes a chest or gets built at all. */
function threeModeReachable(r: import('../src/game/core').RunState, cell: { x: number; y: number }): boolean {
  for (const [dx, dy] of GOAL_NEIGHBOURS) {
    const tx = cell.x + dx, ty = cell.y + dy;
    if (astar(r, CRATE_ADJ.tx, CRATE_ADJ.ty, tx, ty, 'walk') && astar(r, CRATE_ADJ.tx, CRATE_ADJ.ty, tx, ty, 'cart') && astar(r, CRATE_ADJ.tx, CRATE_ADJ.ty, tx, ty, 'bike')) return true;
  }
  return false;
}
const snapshotStacks = (g: GameState, cid: string) => C(g.run!, cid).slots.filter(Boolean).map(s => ({ uid: s!.uid, key: s!.key, qty: s!.qty, dur: s!.dur, meta: s!.meta })) as Stack[];
/** First empty slot accepting `s` — explicit-slot placement preserves UIDs 1:1 end-to-end (no stack merges). */
function emptyTs(g: GameState, cid: string, s: { key: string }): number {
  const slots = C(g.run!, cid).slots;
  for (let i = 0; i < slots.length; i++) if (!slots[i]) return i;
  throw new Error('no empty slot in ' + cid);
}
const totalQty = (stacks: { qty: number }[]) => stacks.reduce((a, s) => a + s.qty, 0);
const totalKg = (stacks: { key: string; qty: number }[]) => stacks.reduce((a, s) => a + (s.key ? itemW(s.key) * s.qty : 0), 0);
import { ITEMS } from '../src/game/catalog';
const itemW = (k: string) => ITEMS[k].w;

function setupDepot(g: GameState, far = false) {
  const r = g.run!;
  const w = getWorld('shipping_fresh');
  // far: pre-filter by the actual walk+bike reachable blobs (cart shares the walk block grid), so only real candidates are tried.
  // Among masked candidates, prefer cells within 2 tiles of the vehicleGeometry road network: the authorized long-haul
  // corridor (97 cells, x[101..176] y[14..120]) is what a freight run is FOR, and the bike's speed table only wins on road.
  // Fallback to the masked list if no road-adjacent buildable cell qualifies — measured either way, never hidden.
  const cellsRaw = pickDepotCells(far);
  const cells = far ? (() => {
    const road = (w as any).vehicleGeometry?.road as ArrayLike<number> | undefined;
    const nearRoad = (c: { x: number; y: number }) => {
      if (!road) return false;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue;
        if (road[ny * WW + nx]) return true;
      }
      return false;
    };
    const walkMask = reachableMask(r, CRATE_ADJ.tx, CRATE_ADJ.ty, 'walk');
    const bikeMask = reachableMask(r, CRATE_ADJ.tx, CRATE_ADJ.ty, 'bike');
    // a candidate qualifies when ANY neighbour is reachable by walk AND bike (the depot cell itself need not be drivable/walkable - the haul ends at a chest)
    const masked = cellsRaw.filter(c => GOAL_NEIGHBOURS.some(([dx, dy]) => {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) return false;
      return walkMask[ny * WW + nx] && bikeMask[ny * WW + nx];
    }));
    const roadish = masked.filter(nearRoad);
    console.warn(`[C2 far] masked candidates=${masked.length} road-adjacent=${roadish.length} farthestMasked=${masked[0]?.x},${masked[0]?.y} d=${masked[0] ? Math.hypot(masked[0].x - FACTORY.tx, masked[0].y - FACTORY.ty).toFixed(1) : '-'}`);
    if (roadish.length === 0) console.warn('[C2 far] no buildable road-adjacent far depot cell; falling back to masked scan');
    return roadish.length ? roadish : masked;
  })() : cellsRaw;
  for (const cell of cells.slice(0, far ? 150 : undefined)) {   // cap the far scan even after masking
    if (!threeModeReachable(r, cell)) continue;   // no real build happens for a corridor-hostile cell
    r.player.x = cell.x * TILE + 8 + TILE; r.player.y = cell.y * TILE + 8;  // stand EAST of the chest tile, never on it
    addItem(r, 'inv', 'wood', 12); addItem(r, 'inv', 'iron_ingot', 2);
    const why = buildReason(g, 'chest_large', cell.x, cell.y);               // real rule check with cost visible in inv
    if (why) { removeItem(r, 'inv', 'wood', 12); removeItem(r, 'inv', 'iron_ingot', 2); continue; }
    const res = act(g, 'build', { struct: 'chest_large', tx: cell.x, ty: cell.y });
    if (res.ok) {
      const chest = Object.values(r.entities).find(e => e.kind === 'struct' && e.type === 'chest_large' && e.tx === cell.x && e.ty === cell.y)!;
      return { chest, cell, builtWith: { wood: 12, iron_ingot: 2 } };
    }
    removeItem(r, 'inv', 'wood', 12); removeItem(r, 'inv', 'iron_ingot', 2);
  }
  throw new Error('no buildable three-mode-reachable depot cell found (all candidates rejected before a single build)');
}
const GOAL_NEIGHBOURS = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const;
function goalFor(r: import('../src/game/core').RunState, depot: { x: number; y: number }, mode: 'walk' | 'cart' | 'bike') {
  for (const [dx, dy] of GOAL_NEIGHBOURS) {
    const tx = depot.x + dx, ty = depot.y + dy;
    if (astar(r, CRATE_ADJ.tx, CRATE_ADJ.ty, tx, ty, mode)) return { tx, ty };
  }
  throw new Error('depot not reachable by ' + mode);
}

interface ModeResult {
  mode: 'walk' | 'cart' | 'bike';
  routeClass: 'near' | 'far';
  depot: { x: number; y: number };
  crateStacks: { uid: string; key: string; qty: number }[];
  deliveredStacks: { uid: string; key: string; qty: number }[];
  totalQty: number; totalKg: number;
  pathPx: number; ticks: number; seconds: number;
  fuelUsed: number; wearHp: number; odometerPx?: number; cartWeightBefore?: number; carryBeforeKg?: number;
  creaturesInHaulBox: number; damageTaken: number; hungerDelta: number; thirstDelta: number;
  routeSecondsModel: number; startKitKg: number; exitReceipt?: string;
}
const results: ModeResult[] = [];
const resultsFar: ModeResult[] = [];

function haul(mode: 'walk' | 'cart' | 'bike', far = false): ModeResult {
  const g = freshRun();
  const r = g.run!;
  const t0 = T0 + 1;
  // ---- end 1: build the depot (real action, fixture materials) ----
  const { chest, cell: depot } = setupDepot(g, far);
  const depotName = `chest_large@${depot.x},${depot.y}`;
  // ---- the authorized source: factory exterior industrial-toolbox crate ----
  const crate = Object.values(r.entities).find(e => e.kind === 'loot' && e.tx === FACTORY.tx && e.ty === FACTORY.ty)!;
  expect(crate, 'factory exterior industrial-toolbox crate entity').toBeTruthy();
  r.player.x = CRATE_ADJ.tx * TILE + 8; r.player.y = CRATE_ADJ.ty * TILE + 8;
  const cargo = snapshotStacks(g, crate.c!);
  expect(cargo.length).toBeGreaterThan(3);                    // authored 7 stack kinds minus merges; never zero
  const kg = totalKg(cargo);
  const qty = totalQty(cargo);
  const startKitKg = +invWeight(r).toFixed(2);
  // exposure figures recorded from the actual world state
  const haulBox = { x0: Math.min(depot.x, FACTORY.tx) * TILE - 32, x1: (Math.max(depot.x, FACTORY.tx) + 1) * TILE + 32, y0: Math.min(depot.y, FACTORY.ty) * TILE - 32, y1: (Math.max(depot.y, FACTORY.ty) + 1) * TILE + 32 };
  const creaturesInHaulBox = r.creatures.filter(m => m.state !== 'dead' && m.x >= haulBox.x0 && m.x <= haulBox.x1 && m.y >= haulBox.y0 && m.y <= haulBox.y1).length;
  const hp0 = r.player.hp, hunger0 = r.player.hunger, thirst0 = r.player.thirst;
  const wet0 = isWet(weatherAt(r, t0));
  // ---- fixture transport staging ----
  let vehicle: Entity | undefined, cart: Entity | undefined, bikeStartFuel = 0, bikeStartHp = 0, cartKg = 0;
  let target: 'inv' | string = 'inv';
  const loadStart = t0;
  if (mode === 'cart') {
    addItem(r, 'inv', 'cart_kit', 1);
    let cartPlaced = false;
    for (const [dx, dy] of [[-1, 0], [1, 0], [-1, -1], [2, 0]] as const) {
      const res = act(g, 'placeCart', { x: (CRATE_ADJ.tx + dx) * TILE + 8, y: (CRATE_ADJ.ty + dy) * TILE + 8 }, t0);
      if (res.ok) { cartPlaced = true; break; }
    }
    expect(cartPlaced, 'cart deployed on open dry ground near the crate').toBe(true);
    cart = Object.values(r.entities).find(e => e.kind === 'cart')!;
    target = cart.c!;
  } else if (mode === 'bike') {
    addItem(r, 'inv', 'motorbike_kit', 1);
    // fixture kit; real deployment with real clearance rules
    let placed = false;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1], [0, -1], [-1, -1], [1, -1]] as const) {
      const res = act(g, 'placeMotorbike', { x: (CRATE_ADJ.tx + dx) * TILE + 8, y: (CRATE_ADJ.ty + dy) * TILE + 8 }, t0);
      if (res.ok) { placed = true; break; }
    }
    expect(placed, 'motorbike deployed on real eligible ground near the crate').toBe(true);
    vehicle = Object.values(r.entities).find(e => e.kind === 'vehicle')!;
    addItem(r, 'inv', 'fuel_can', 3);   // fixture: 3 cans fill the 300-unit tank; the corridor route needs more than the single can the near haul used
    for (let n = 0; n < 3; n++) expect(act(g, 'vehicleRefuel', { eid: vehicle.id }, t0 + n).ok, `vehicleRefuel can #${n + 1}`).toBe(true);
    bikeStartFuel = vehicle.vehicle!.fuel; bikeStartHp = vehicle.hp!;
    target = vehicle.c!;
  }
  // ---- load: the same physical stacks, source -> transport ----
  const crateSlots = C(r, crate.c!).slots;
  let moves = 0;
  for (let i = 0; i < crateSlots.length; i++) {
    const stack = crateSlots[i];
    if (!stack) continue;
    const ts = emptyTs(g, target, stack);
    const res = act(g, 'move', { from: crate.c, fs: i, to: target, ts }, t0 + 1 + moves);
    expect(res.ok, `move crate->${target} slot ${i}`).toBe(true);
    moves++;
  }
  // Emptying a public crate through real moves retires its entity and container (salt-real engine behaviour):
  // the site is recorded as depleted and the renewable 24 h cooldown is armed. Assert that instead of poking custody.
  expect(r.depletedLootSites ?? [], 'crate site recorded depleted after real emptying').toContain(FACTORY.ty * WW + FACTORY.tx);
  expect(r.receipts.some(x => x.kind === 'loot.depleted')).toBe(true);
  const cargoUids0 = new Set(cargo.map(s => s.uid));
  const loaded = snapshotStacks(g, target).filter(s => cargoUids0.has(s.uid));  // walk mode: survival kit stays; cargo is compared UID-set to UID-set
  expect(loaded.map(s => s.uid).sort()).toEqual(cargo.map(s => s.uid).sort());
  if (cart) { cartKg = cartWeight(r, cart.c!); expect(act(g, 'grabCart', { eid: cart.id }, t0 + 1 + moves).ok).toBe(true); expect(r.player.pulling).toBe(cart.id); }
  if (vehicle) { expect(act(g, 'vehicleMount', { eid: vehicle.id }, t0 + 1 + moves).ok).toBe(true); expect(r.player.vehicle).toBe(vehicle.id); }
  if (mode === 'walk') expect(invWeight(r) - startKitKg).toBeCloseTo(kg, 5);
  // ---- the haul: A* over real geometry, walked/pulled/driven with held keys ----
  const goal = goalFor(r, depot, mode);
  const full = astar(r, CRATE_ADJ.tx, CRATE_ADJ.ty, goal.tx, goal.ty, mode)!;
  const cps = mode === 'walk' ? checkpoints(full, 2) : checkpoints(full, 1);  // bike+cart: axis-aligned legs through 1-cell corridors; no corner cutting
  let t = t0 + 100, cp = 0, ticks = 0, lastPos = { x: r.player.x, y: r.player.y }, stuck = 0;
  const posOf = () => (vehicle ? { x: vehicle!.x, y: vehicle!.y } : { x: r.player.x, y: r.player.y });
  // Bike legs are axis-aligned corridors; a sub-4px perpendicular error must NOT produce diagonal held keys -
  // that is how the bike crept into the wall row and wedged. Walkers keep the original thresholds.
  // Bike steering is anchored to the LEG's axis, not to instantaneous error components: classifying by
  // |dx| vs |dy| re-derives the wrong class the moment the cross-axis drift exceeds the along-axis error,
  // which suppressed the steering keys needed to close out a leg and froze the bike with fuel burning.
  const input = (dxRaw: number, dyRaw: number, ux: number, uy: number, mx: number, my: number, legHoriz: boolean): Input => {
    if (mode !== 'bike') return { ...still, up: uy < -0.35, down: uy > 0.35, left: ux < -0.35, right: ux > 0.35, mx, my };
    const PERP = 2.0;   // raw px deadzone; the 12px box needs |perp| <= 2 to keep corners inside a 16px cell
    let k: Input = legHoriz
      ? { ...still, left: dxRaw < -0.1, right: dxRaw > 0.1, up: dyRaw < -PERP, down: dyRaw > PERP, mx, my }
      : { ...still, up: dyRaw < -0.1, down: dyRaw > 0.1, left: dxRaw < -PERP, right: dxRaw > PERP, mx, my };
    // Invariant: a checkpoint remains, so SOME key must be held. Any residual pocket where the deadzones
    // suppress everything (along-axis eps vs cross-axis PERP vs the 1.5px advance radius) is closed by
    // falling back to the along-axis sign of the raw error.
    if (!k.left && !k.right && !k.up && !k.down) {
      if (legHoriz) k = { ...still, right: dxRaw >= 0, left: dxRaw < 0, mx, my };
      else k = { ...still, down: dyRaw >= 0, up: dyRaw < 0, mx, my };
    }
    return k;
  };
  const startPos = posOf();
  // Advance a checkpoint when the mover has CROSSED the perpendicular plane through the checkpoint (projection test),
  // or is within 1.5 px of it. A radial window both overshoots on roads (6.25 px per tick) and advances too early for
  // corner-sensitive legs; the plane test is exact for axis-aligned vehicle legs and safe for walkers.
  const bikeEid = (r as any).player?.vehicle as string | undefined;
  while (cp < cps.length && ticks < 4000) {
    const p = posOf();
    if (mode === 'bike' && bikeEid) {
      const bn = (r.entities as any)[bikeEid]; const f = bn?.vehicle?.fuel ?? 0;
      const cans = (C(r, 'inv').slots as any[]).filter(sl => sl?.key === 'fuel_can').reduce((n: number, sl: any) => n + (sl.qty ?? 1), 0);
      if (f < 120 && cans > 0) { const before = f; const res = act(g, 'vehicleRefuel', { eid: bikeEid }, t); console.warn(`[C2 refuel] tick=${ticks} fuel=${before.toFixed(1)} cans=${cans} -> ${JSON.stringify((res as any).ok !== false ? 'ok' : (res as any).reason)}`); }
    }
    const targetCp = cps[cp];
    const prevCp = cp > 0 ? cps[cp - 1] : startPos;
    const legHoriz = Math.abs(targetCp.x - prevCp.x) >= Math.abs(targetCp.y - prevCp.y);
    const legLen = Math.hypot(targetCp.x - prevCp.x, targetCp.y - prevCp.y) || 1;
    const leg = { x: (targetCp.x - prevCp.x) / legLen, y: (targetCp.y - prevCp.y) / legLen };
    const dx = targetCp.x - p.x, dy = targetCp.y - p.y, d = Math.hypot(dx, dy);
    const passed = (p.x - targetCp.x) * leg.x + (p.y - targetCp.y) * leg.y >= 0;
    // Vehicles advance on plane crossings like everything else. A perpendicular-alignment gate here deadlocks the
    // bang-bang controller (per-tick step 6.25 px >> alignment gap); the box only ever needs |perp| <= 2 px to stay
    // inside the corridor cell, which the bike's axis-priority steering preserves by construction.
    if (d < 1.5 || passed) { cp++; continue; }
    const inp = input(dx, dy, dx / d, dy / d, p.x + dx, p.y + dy, legHoriz) as any;
    tick(g, inp, 50, t);
    t += 50; ticks++;
    const nowP = posOf();
    if (Math.hypot(nowP.x - lastPos.x, nowP.y - lastPos.y) < 0.25) stuck++; else stuck = 0;
    if (stuck > 400) break;
    lastPos = nowP;
  }
  if (cp < cps.length) {
    const tail = cps.slice(Math.max(0, cp - 2), cp + 4).map(p => ({ x: +p.x.toFixed(1), y: +p.y.toFixed(1), tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE) }));
    const bikeNow = (r.player.vehicle ? r.entities[r.player.vehicle] : undefined) as any;
    const hazers = (g.run!.haz ?? []).length;
    console.warn(`[C2 stall] mode=${mode} far=${far} cp=${cp}/${cps.length} pos=${posOf().x.toFixed(1)},${posOf().y.toFixed(1)} tile=${Math.floor(posOf().x / TILE)},${Math.floor(posOf().y / TILE)} dead=${r.player.dead} php=${r.player.hp} mounted=${!!r.player.vehicle} bikeFuel=${bikeNow?.vehicle?.fuel} odometer=${bikeNow?.vehicle?.odometer} bikeHp=${bikeNow?.hp} action=${r.player.action?.kind ?? 'none'} haz=${hazers} startFuel=${bikeStartFuel} ticks=${ticks} nextLegs=${JSON.stringify(tail)}`);
  }
  expect(cp >= cps.length, `haul completed (stalled at cp ${cp}/${cps.length}, pos ${posOf().x.toFixed(0)},${posOf().y.toFixed(0)})`).toBe(true);
  expect(r.player.dead).toBe(false);
  const endPos = posOf();
  const goalDist = Math.hypot(endPos.x - (depot.x * TILE + 8), endPos.y - (depot.y * TILE + 8));
  expect(goalDist).toBeLessThan(4 * TILE);
  const seconds = ticks * 0.05;
  // ---- exit + unload into the depot chest by real actions ----
  let exitReceipt: string | undefined;
  if (vehicle) { const res = act(g, 'vehicleExit', {}, t); expect(res.ok).toBe(true); exitReceipt = (res as any).receipt ? `${(res as any).receipt}` : undefined; }
  if (cart) { expect(act(g, 'grabCart', { eid: cart.id }, t).ok).toBe(true); expect(r.player.pulling).toBeFalsy(); }  // un-pull before unloading
  const tU = t + 1;
  // stand beside the chest for unloading (already there); move every stack transport -> chest
  const cargoUids = new Set(cargo.map(s => s.uid));
  const from = vehicle ? vehicle.c! : cart ? cart.c! : 'inv';
  const srcSlots = C(r, from).slots;
  let outMoves = 0;
  for (let i = 0; i < srcSlots.length; i++) {
    const st = srcSlots[i];
    if (!st || !cargoUids.has(st.uid)) continue;              // walk mode: leave the survival kit in the inv, deliver cargo only
    const ts = emptyTs(g, chest.c!, st as any);
    const res = act(g, 'move', { from, fs: i, to: chest.c!, ts }, tU + outMoves);
    expect(res.ok, `move ${from}->chest slot ${i}`).toBe(true);
    outMoves++;
  }
  expect(outMoves).toBe(cargo.length);
  const delivered = snapshotStacks(g, chest.c!).filter(s => cargoUids.has(s.uid));
  // ---- results ----
  const res: ModeResult = {
    mode, routeClass: far ? 'far' : 'near', depot: { x: depot.x, y: depot.y },
    crateStacks: cargo.map(s => ({ uid: s.uid, key: s.key, qty: s.qty })),
    deliveredStacks: delivered.map(s => ({ uid: s.uid, key: s.key, qty: s.qty })),
    totalQty: qty, totalKg: +kg.toFixed(2),
    pathPx: Math.round(pathLengthPx(full)), ticks, seconds: +seconds.toFixed(2),
    fuelUsed: vehicle ? +(bikeStartFuel - vehicle.vehicle!.fuel).toFixed(2) : 0,
    wearHp: vehicle ? +(bikeStartHp - vehicle.hp!).toFixed(2) : 0,
    odometerPx: vehicle ? +vehicle.vehicle!.odometer.toFixed(1) : undefined,
    cartWeightBefore: cart ? +cartKg.toFixed(2) : undefined,
    carryBeforeKg: mode === 'walk' ? +kg.toFixed(2) : undefined,
    creaturesInHaulBox, damageTaken: +(hp0 - r.player.hp).toFixed(1),
    hungerDelta: +(hunger0 - r.player.hunger).toFixed(2), thirstDelta: +(thirst0 - r.player.thirst).toFixed(2),
    routeSecondsModel: +(pathLengthPx(full) / (mode === 'walk' ? BAL.player.speed : mode === 'cart' ? BAL.player.speed * BAL.cart.speedOnRoad : BAL.motorbike.roadSpeed)).toFixed(2),
    startKitKg, exitReceipt,
  };
  (far ? resultsFar : results).push(res);
  return res;
}

describe('MEC-01 R2 C2: same physical cargo, factory toolbox -> field depot, three freight modes', () => {
  it('delivers the full crate by walking (inventory carry)', () => {
    const res = haul('walk');
    expect(res.deliveredStacks.map(s => s.uid).sort()).toEqual(res.crateStacks.map(s => s.uid).sort());
    expect(res.totalQty).toBe(res.deliveredStacks.reduce((a, s) => a + s.qty, 0));
    expect(res.fuelUsed).toBe(0);
    expect(res.carryBeforeKg!).toBeLessThanOrEqual(carryLimit(freshRun().run!));
  });
  it('delivers the full crate by hand cart on the same route class', () => {
    const res = haul('cart');
    expect(res.deliveredStacks.map(s => s.uid).sort()).toEqual(res.crateStacks.map(s => s.uid).sort());
    expect(res.fuelUsed).toBe(0);
    expect(res.cartWeightBefore!).toBeLessThanOrEqual(BAL.cart.maxWeight);
  });
  it('delivers the full crate by motorbike with measured fuel and wear', () => {
    const res = haul('bike');
    expect(res.deliveredStacks.map(s => s.uid).sort()).toEqual(res.crateStacks.map(s => s.uid).sort());
    expect(res.fuelUsed).toBeGreaterThan(0);
    expect(res.wearHp).toBeGreaterThan(0);
    expect(res.odometerPx!).toBeGreaterThan(0);
  });
  it('the same cargo UIDs left the crate in all three runs (same seed, same world)', () => {
    expect(results.length).toBe(3);
    const [a, b, c] = results.map(r => r.crateStacks.map(s => s.uid).sort().join(','));
    expect(a).toBe(b); expect(b).toBe(c);
    expect(results.map(r => r.deliveredStacks.map(s => s.uid).sort().join(','))).toEqual([a, b, c]);
    expect(new Set(results.map(r => `${r.depot.x},${r.depot.y}`)).size, 'all three near runs used the SAME depot cell').toBe(1);
  });
  // ---- far haul: the same cargo, same authorized source, ONE far buildable depot cell (>=45 tiles, three-mode feasible) shared by all three modes ----
  it('delivers the full crate to the SAME far depot in all three modes (long corridor route class)', () => {
    const w = haul('walk', true), c = haul('cart', true), b = haul('bike', true);
    const cells = new Set([w.depot, c.depot, b.depot].map(d => `${d.x},${d.y}`));
    expect(cells.size, 'all three far runs built/used the SAME depot cell').toBe(1);
    const d0 = Math.hypot(w.depot.x - FACTORY.tx, w.depot.y - FACTORY.ty);
    expect(d0, 'the far class is genuinely long (>=45 tiles from the factory)').toBeGreaterThanOrEqual(45);
    expect(b.routeClass).toBe('far');
    for (const res of [w, c, b]) {
      expect(res.deliveredStacks.map(s => s.uid).sort()).toEqual(res.crateStacks.map(s => s.uid).sort());
      expect(res.totalKg).toBe(w.totalKg);
    }
    expect(b.crateStacks.map(s => s.uid).sort()).toEqual(results[0].crateStacks.map(s => s.uid).sort());   // same cargo across the near AND far classes
    expect(b.fuelUsed).toBeGreaterThan(0);
    expect(b.wearHp).toBeGreaterThan(0);
    expect(b.odometerPx!).toBeGreaterThan(0);
    // Long-haul comparison, MEASURED only (no gate, no invented weighting): foot/cart rationality vs motorbike net gain.
    console.log('[C2 far corridor]', JSON.stringify({ depot: w.depot, distTiles: +d0.toFixed(1), walkSeconds: w.seconds, cartSeconds: c.seconds, bikeSeconds: b.seconds, bikeFuel: b.fuelUsed, bikeWearHp: b.wearHp, bikeFasterThanFoot: b.seconds < w.seconds, bikeFasterThanCart: b.seconds < c.seconds }));
  }, 600_000);
  it('writes the delivery evidence JSON (SIM_FIXTURE_MEASUREMENT timing; real custody)', () => {
    mkdirSync('evidence/mec01-c2', { recursive: true });
    const strip = (r: ModeResult) => ({ ...r, crateStacks: undefined, deliveredStacks: undefined, deliveredCount: r.deliveredStacks.length });
    const rows = results.map(strip), farRows = resultsFar.map(strip);
    const nearW = results.find(r => r.mode === 'walk'), nearC = results.find(r => r.mode === 'cart'), nearB = results.find(r => r.mode === 'bike');
    const farW = resultsFar.find(r => r.mode === 'walk'), farC = resultsFar.find(r => r.mode === 'cart'), farB = resultsFar.find(r => r.mode === 'bike');
    writeFileSync('evidence/mec01-c2/delivery.json', JSON.stringify({
      note: 'REAL: same crate UID cargo -> real route on real shipping_fresh geometry -> real chest, per mode. TWO route classes: near (depot in the [118..152]x[112..128] window) and far (whole map, >=45 tiles from the factory, the SAME cell for all three modes, pre-checked for walk+cart+bike reachability). Timing is SIM_FIXTURE_MEASUREMENT (tick 50ms, scripted held keys), not human input. Creatures not cleared; weather/exposure recorded. Kit/fuel/cart granted as labelled fixtures (see test header).',
      seed: SEED,
      source: 'factory exterior industrial-toolbox (authorized loot-source-v2)',
      destination: 'depot chest_large built by the player (real build action) at a buildable non-protected cell; class-consistent per table',
      rows, farRows,
      verdict: {
        near: { walkSeconds: nearW?.seconds, cartSeconds: nearC?.seconds, bikeSeconds: nearB?.seconds, bikeFuel: nearB?.fuelUsed, bikeWearHp: nearB?.wearHp, footRational: !!(nearW && nearB) && nearW.seconds < nearB.seconds },
        far: farW && farC && farB ? { walkSeconds: farW.seconds, cartSeconds: farC.seconds, bikeSeconds: farB.seconds, bikeFuel: farB.fuelUsed, bikeWearHp: farB.wearHp, bikeFasterThanFoot: farB.seconds < farW.seconds, bikeFasterThanCart: farB.seconds < farC.seconds } : 'unmeasured',
      },
    }, null, 2));
    expect(results.length).toBe(3);
    expect(resultsFar.length).toBe(3);
  });
});

