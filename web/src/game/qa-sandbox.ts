// ============================================================================
// SOUL OF HEROES — VISUAL EXPERIENCE QA / FULL-GEAR SANDBOX
// Isolated fixture builder using ONLY genuine engine structures (newGame,
// startRun, mkStack, mkContainer, addItem, mkCreature, receipt, pushLog,
// settleWithReturn). Never modifies production saves on disk.
// ============================================================================

import { BAL, HOUR, TILE, WW, WH, T, type Entity, type GameState, type RunState } from './core';
import { ITEMS, RECIPES, STRUCTS, ELDERS, ALWAYS_KNOWN_RECIPES } from './catalog';
import { newGame, startRun, mkStack, mkContainer, addItem, C, markDirty, receipt, pushLog, dispatch, effTile, refreshTerritoryLinks } from './engine';
import { FX, HAZ } from './sim';
import { buildOfflineReturn, captureReturnSnapshot, type OfflineReturnV1 } from './return-report';
import { getWorld, setActiveLayout } from './world';
import { vehicleClear, vehicleExitPoint } from './motorbike';
import { setVfxTestKit } from './vfx/testkit';
import { U05_WORLD_LAYOUT_ID, isVeyra05Layout } from '../veyra05/scenes';
import { getWindowWorld } from '../veyra05/window';
import { syncFloor } from '../veyra05/floors';

export type QaPresetId =
  | 'fresh'
  | 'full_gear'
  | 'cores'
  | 'vfx_showcase'
  | 'elders'
  | 'industry'
  | 'vehicle'
  | 'offline_return'
  | 'ragnarok_economy'
  | 'research_access'
  | 'death_recovery';

export interface QaPresetMeta {
  id: QaPresetId;
  title: string;
  tag: string;
  desc: string;
}

export const QA_PRESETS: QaPresetMeta[] = [
  { id: 'full_gear', title: 'Full-Gear World · All Systems', tag: 'ALL-IN-ONE', desc: 'Full Core loadout, top gear, furnished home, live stations, research, garden, freight, vendor & test wildlife.' },
  { id: 'cores', title: 'All 7 Creator Cores + 4 Elemental', tag: 'CORES & VFX', desc: 'Every Core fully loaded (Basic/Refined/Signature) + sparring targets.' },
  { id: 'vfx_showcase', title: 'VFX Choreography Showcase · 68 Skills', tag: 'PIXELFX', desc: 'Veyra world + all 7 Creator Cores · F6 summons side boss · F7 heals & reloads · F8 Spirit warp.' },
  { id: 'elders', title: 'Six Elder Boss Arena', tag: 'BOSSES', desc: 'Fight any of the 6 Elders; direct phase/defeat controls are marked staged previews.' },
  { id: 'industry', title: 'Home, Power & Industrial Compound', tag: 'INDUSTRY', desc: 'Sheltered cabin, Cabinet, Lv3 Bench, Furnace, Refinery, Research, Garden, Generator & Turret.' },
  { id: 'vehicle', title: 'Utility Motorbike & Freight Convoy', tag: 'VEHICLE', desc: 'Fueled & lubricated motorbike, Hand Cart, Paid Parcel & automated drive demo.' },
  { id: 'offline_return', title: 'Offline Return · Engine Replay', tag: 'REAL SETTLE', desc: 'Run the engine settlement against real queued jobs, fuel, crops, home and receipts; no hand-authored report rows.' },
  { id: 'ragnarok_economy', title: 'Ragnarok, Escrow & Evacuation', tag: 'ENDGAME', desc: 'Hour 266 Ragnarok, Sealed Cash Chest, Mirela Trader, Escrow Chest & Evac Beacon.' },
  // PA1 P1 evidence fixture: ONE recovered device on open ground, so the browser gate that proves the
  // family ledger panel is reachable is not hostage to `industry`'s machine column, where every tile
  // within reach of the Research Table is also within reach of a nearer machine (findInteract keeps the
  // nearest interactable inside 30 px, so the prompt can name only one of them).
  { id: 'research_access', title: 'Recovered Research Table · Open Ground', tag: 'PA1 PANEL EVIDENCE', desc: 'A single authorized Research Table beside the spawn on free ground: walk up to it and press E for the technology families.' },
  { id: 'death_recovery', title: 'Death & Bag Recovery Preview', tag: 'STAGED PREVIEW', desc: 'Preassembled fallen-state overlay with recoverable bag; use Full Gear to test a natural combat death.' },
  { id: 'fresh', title: 'Fresh-Start Survival', tag: 'BASELINE', desc: 'Clean Day 1 wash-up with standard knife, flask & berries.' },
];

function placeStruct(r: RunState, type: string, tx: number, ty: number, extra: Partial<Entity> = {}): Entity {
  const d = STRUCTS[type];
  const e: Entity = {
    id: `qa_st_${r.nextId++}`,
    kind: 'struct',
    type,
    x: tx * TILE + 8,
    y: ty * TILE + 8,
    tx,
    ty,
    hp: d.hp,
    maxHp: d.hp,
    owner: 'player',
    ...extra,
  };
  if (d.slots && !e.c) e.c = mkContainer(r, 'chest', d.slots).id;
  if (d.station && !e.station) {
    e.station = {
      queue: [],
      burn: 0,
      fuelC: mkContainer(r, 'fuel', d.station === 'workbench' || d.station === 'research' ? 0 : 2).id,
      outC: mkContainer(r, 'out', 4).id,
      ...(d.station === 'workbench' ? { level: 3 as const } : {}),
    };
  }
  if (type === 'refinery') e.identity = 'refinery-v1';
  r.entities[e.id] = e;
  return e;
}

/** Find an open dry tile near (cx, cy) for placing test structures/vehicles cleanly. */
function findOpenTile(r: RunState, cx: number, cy: number, radius = 6): { tx: number; ty: number } {
  const occupied = new Set(Object.values(r.entities).map(e => `${Math.floor(e.x / TILE)},${Math.floor(e.y / TILE)}`));
  for (let rad = 1; rad <= radius; rad++) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const tx = cx + dx, ty = cy + dy;
        if (tx < 4 || ty < 4 || tx >= WW - 4 || ty >= WH - 4) continue;
        if (occupied.has(`${tx},${ty}`)) continue;
        const t = effTile(r, tx, ty);
        if ([T.GRASS, T.MEADOW, T.ROAD, T.SAND, T.FLOOR, T.ASH, T.SNOW].includes(t)) return { tx, ty };
      }
    }
  }
  return { tx: cx + 2, ty: cy };
}

function learnAllRecipes(r: RunState) {
  r.knowledge.recipes = Array.from(new Set([...Object.keys(RECIPES), ...ALWAYS_KNOWN_RECIPES]));
}

function equipFullGear(r: RunState) {
  const inv = C(r, 'inv');
  const eq = C(r, 'eq');
  inv.slots = Array(24).fill(null);
  eq.slots = [mkStack(r, 'gas_mask', 1), mkStack(r, 'chitin_armor', 1), mkStack(r, 'trail_pack', 1)];
  const gear: [string, number][] = [
    ['iron_sword', 1],
    ['bow', 1],
    ['industrial_axe', 1],
    ['industrial_pick', 1],
    ['stew', 4],
    ['trail_canteen', 1],
    ['medkit', 4],
    ['field_repair_kit', 4],
    ['arrow', 40],
    ['spares', 30],
    ['fuel_can', 4],
    ['lubricant', 3],
    ['wood', 30],
    ['stone', 25],
    ['iron_ingot', 16],
    ['mechanical_parts', 10],
    ['fasteners', 12],
    ['coal', 15],
  ];
  gear.forEach(([k, q], idx) => {
    const st = mkStack(r, k, q);
    if (k === 'trail_canteen') st.charge = 8;
    inv.slots[idx] = st;
  });
}

function loadAllCores(r: RunState) {
  const inv = C(r, 'inv');
  inv.slots = Array(24).fill(null);
  const creators = ['core_dragon', 'core_meteor', 'core_elsa', 'core_mjolnir', 'core_demon', 'core_blast', 'core_earthmother'];
  const elementals = ['core_fire', 'core_frost', 'core_storm', 'core_earth'];
  creators.forEach((k, idx) => {
    const st = mkStack(r, k, 1);
    if (st.reserves) st.reserves = { basic: 40, refined: 12, signature: 4 };
    inv.slots[idx] = st;
  });
  elementals.forEach((k, idx) => {
    const st = mkStack(r, k, 1);
    st.charge = ITEMS[k].charge ?? 3;
    inv.slots[7 + idx] = st;
  });
  inv.slots[11] = mkStack(r, 'stew', 5);
  inv.slots[12] = mkStack(r, 'medkit', 5);
  inv.slots[13] = mkStack(r, 'energy_basic', 80);
  inv.slots[14] = mkStack(r, 'energy_refined', 40);
  inv.slots[15] = mkStack(r, 'essence_fire', 12);
  inv.slots[16] = mkStack(r, 'essence_water', 12);
  inv.slots[17] = mkStack(r, 'essence_nature', 12);
  inv.slots[18] = mkStack(r, 'essence_spirit', 12);
}

let qaIntentSerial = 0;
function qaAction(gs: GameState, type: string, payload: Record<string, unknown>, now: number) {
  const r = gs.run!;
  return dispatch(gs, { id: `qa-${r.id}-${qaIntentSerial++}`, type, ...payload } as any, now);
}

function loadFullGear(r: RunState) {
  loadAllCores(r);
  const inv = C(r, 'inv');
  const cores = inv.slots.slice(0, 11);
  inv.slots = Array(24).fill(null);
  cores.forEach((s, i) => { inv.slots[i] = s; });
  const pack: [string, number][] = [
    ['iron_sword', 1], ['bow', 1], ['industrial_axe', 1], ['industrial_pick', 1],
    ['arrow', 60], ['stew', 5], ['trail_canteen', 1], ['medkit', 5],
    ['field_repair_kit', 4],
  ];
  pack.forEach(([key, qty], i) => {
    const s = mkStack(r, key, qty);
    if (key === 'trail_canteen') s.charge = 8;
    inv.slots[11 + i] = s;
  });
}

function buildIndustrialCompound(gs: GameState, ptx: number, pty: number) {
  const r = gs.run!;
  const bx = Math.max(8, ptx - 2), by = Math.max(8, pty - 3);
  for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
    placeStruct(r, 'floor_stone', bx + dx, by + dy);
    placeStruct(r, 'roof_tile', bx + dx, by + dy);
  }
  for (let dx = 0; dx < 4; dx++) {
    placeStruct(r, 'wall_stone', bx + dx, by);
    if (dx === 2) placeStruct(r, 'door_iron', bx + dx, by + 3, { open: true });
    else placeStruct(r, 'wall_stone', bx + dx, by + 3);
  }
  for (let dy = 1; dy < 3; dy++) { placeStruct(r, 'wall_stone', bx, by + dy); placeStruct(r, 'wall_stone', bx + 3, by + dy); }

  const cab = placeStruct(r, 'claim', bx + 1, by + 1, { cabinet: { credit: {}, legacy: false } });
  addItem(r, cab.c!, 'wood', 30); addItem(r, cab.c!, 'stone', 25); addItem(r, cab.c!, 'fiber', 30);
  placeStruct(r, 'bed_straw', bx + 2, by + 1);
  const chest = placeStruct(r, 'chest_large', bx + 1, by + 2);
  addItem(r, chest.c!, 'stew', 8); addItem(r, chest.c!, 'water_flask', 3);

  const wb = placeStruct(r, 'workbench', bx + 5, by); wb.station!.level = 3;
  // A second, level-1 bench so the creator can perform a REAL upgrade (engine `upgradeStation`, real cost) and see its ceremony.
  const wbOld = placeStruct(r, 'workbench', bx + 6, by + 1); wbOld.station!.level = 1;
  const furnace = placeStruct(r, 'furnace', bx + 5, by + 1);
  const refinery = placeStruct(r, 'refinery', bx + 5, by + 2);
  const research = placeStruct(r, 'research', bx + 5, by + 3);
  addItem(r, furnace.station!.fuelC, 'coal', 12);
  addItem(r, refinery.station!.fuelC, 'coal', 12);
  addItem(r, furnace.station!.outC, 'iron_ingot', 3);
  addItem(r, 'inv', 'iron_ore', 2);
  addItem(r, 'inv', 'iron_ore', 2);
  addItem(r, 'inv', 'salvaged_oil', 12);
  addItem(r, 'inv', 'glass', 4);
  addItem(r, 'inv', 'spares', 12);
  addItem(r, 'inv', 'wolf_fang', 1);
  addItem(r, 'inv', 'crawler_optic', 1);

  const garden = placeStruct(r, 'garden', bx + 7, by + 1, { garden: { crop: 'crop', growth: 0.96, water: 2.5, coldFrame: true } });
  const barrel = placeStruct(r, 'barrel', bx + 7, by + 2, { water: 10 });
  placeStruct(r, 'farm_controller', bx + 7, by + 3, { farm: { enabled: true, crop: 'crop', energy: 45000, gardenId: garden.id, barrelId: barrel.id, chestId: chest.id } });
  const gen = placeStruct(r, 'base_generator', bx + 7, by, { basePower: { enabled: true, energy: 120000, capacity: 2, priority: 'defense', network: 'wire-v1' } });
  placeStruct(r, 'power_cable', bx + 8, by);
  const tur = placeStruct(r, 'arrow_turret', bx + 9, by, { turret: { enabled: true, cooldown: 0, angle: 0, generatorId: gen.id } });
  addItem(r, tur.c!, 'arrow', 40);
  const escrowClaimX = bx + 1, escrowClaimY = by + 1;
  placeStruct(r, 'escrow', escrowClaimX + 1, escrowClaimY);
  // Same post-placement step the real 'build' intent performs for a Cabinet: link coverage so upkeep/protection is real.
  refreshTerritoryLinks(r);

  // The workshop actions below use real dispatch costs, reservations and job IDs.
  r.player.x = (bx + 4) * TILE + 8; r.player.y = (by + 2) * TILE + 8;
  const ironJob = qaAction(gs, 'craft', { recipe: 'iron_ingot', eid: furnace.id }, r.clock.lastSimAt);
  const refineryJob = qaAction(gs, 'craft', { recipe: 'refinery_industrial', eid: refinery.id }, r.clock.lastSimAt);
  const specimenSlot = C(r, 'inv').slots.findIndex(s => s?.key === 'wolf_fang');
  const researchJob = specimenSlot >= 0 ? qaAction(gs, 'research', { mode: 'specimen', eid: research.id, slot: specimenSlot, uid: C(r, 'inv').slots[specimenSlot]?.uid }, r.clock.lastSimAt) : null;
  return { bx, by, cab, chest, wb, furnace, refinery, research, garden, ironJob, refineryJob, researchJob };
}

/** Deploys packed kits through the real engine intents; only the test stock itself is staged. */
function provisionVehicles(gs: GameState, r: RunState, now: number) {
  const inv = C(r, 'inv');
  if (!inv.slots.some(s => s?.key === 'motorbike_kit')) addItem(r, 'inv', 'motorbike_kit', 1);
  addItem(r, 'inv', 'fuel_can', 2); addItem(r, 'inv', 'lubricant', 1);
  const cx = Math.floor(r.player.x / TILE), cy = Math.floor(r.player.y / TILE);
  // Candidate tiles within the engine's 3-tile deploy reach, nearest first. A spot is only used if the
  // SAME checks vehicleMount will later apply (passable clearance + a safe exit) already hold there.
  const ring: { x: number; y: number }[] = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx || dy) ring.push({ x: (cx + dx) * TILE + 8, y: (cy + dy) * TILE + 8 });
  ring.sort((a, b) => Math.hypot(a.x - r.player.x, a.y - r.player.y) - Math.hypot(b.x - r.player.x, b.y - r.player.y));
  let bike: Entity | undefined;
  for (const spot of ring) {
    if (bike) break;
    if (!vehicleClear(r, spot.x, spot.y, undefined, 'parking') || !vehicleClear(r, spot.x, spot.y, undefined, 'passable') || !vehicleExitPoint(r, spot.x, spot.y)) continue;
    const res = qaAction(gs, 'placeMotorbike', { x: spot.x, y: spot.y }, now);
    if (res.ok) bike = Object.values(r.entities).find(e => e.kind === 'vehicle' && e.vehicle);
  }
  if (bike?.vehicle) {
    for (let i = 0; i < 2; i++) qaAction(gs, 'vehicleRefuel', { eid: bike.id }, now + i);
    qaAction(gs, 'vehicleLubricate', { eid: bike.id }, now + 3);
  }

  if (!inv.slots.some(s => s?.key === 'cart_kit')) addItem(r, 'inv', 'cart_kit', 1);
  let cart: Entity | undefined;
  const farFromBike = (x: number, y: number, min: number) => !bike || Math.hypot(bike.x - x, bike.y - y) >= min;
  for (const spot of [...ring].reverse()) {
    if (cart) break;
    if (!farFromBike(spot.x, spot.y, 40)) continue;
    const res = qaAction(gs, 'placeCart', { x: spot.x, y: spot.y }, now + 4);
    if (res.ok) cart = Object.values(r.entities).find(e => e.kind === 'cart');
  }
  if (cart?.c) addItem(r, cart.c, 'wood', 20);
  // The bike must still be mountable after the cart landed; otherwise the setup is reported, never faked.
  if (bike && (!vehicleClear(r, bike.x, bike.y, bike.id) || !vehicleExitPoint(r, bike.x, bike.y, bike.id))) pushLog(r, now, 'QA note: deployed bike is obstructed at this spawn; move the cart or redeploy.', 'red');

  let vendorSpot = findOpenTile(r, cx + 4, cy + 3, 4);
  if (!farFromBike(vendorSpot.tx * TILE + 8, vendorSpot.ty * TILE + 8, 56)) vendorSpot = findOpenTile(r, cx - 5, cy + 3, 4);
  const vendor: Entity = { id: `qa_vendor_${r.nextId++}`, kind: 'vendor', x: vendorSpot.tx * TILE + 8, y: vendorSpot.ty * TILE + 8, tx: vendorSpot.tx, ty: vendorSpot.ty, label: 'Mirela the Trader' };
  r.entities[vendor.id] = vendor;
  if (gs.profile.securedCash < 12) gs.profile.securedCash = 120;
  qaAction(gs, 'buy', { eid: vendor.id, item: 'iron_pick', id: `qa-freight-${r.id}`, freight: true }, now + 5);
  return { bike, cart, vendor };
}

function fillAssetWarehouse(r: RunState, nearX: number, nearY: number) {
  const keys = Object.keys(ITEMS).filter(k => !ITEMS[k].creatorCore && !ITEMS[k].core && ITEMS[k].cat !== 'cash');
  const boxes: Entity[] = [];
  for (let i = 0; i < 5; i++) { const spot = findOpenTile(r, nearX + 3 + i * 2, nearY + 5, 4); boxes.push(placeStruct(r, 'chest_large', spot.tx, spot.ty)); }
  let boxIndex = 0;
  for (const key of keys) {
    const def = ITEMS[key]; const qty = Math.min(def.max, def.cat === 'food' ? 8 : def.cat === 'res' ? 20 : 1);
    let left = qty;
    for (let guard = 0; left > 0 && guard < boxes.length; guard++) {
      const box = boxes[boxIndex % boxes.length]; boxIndex++;
      left = addItem(r, box.c!, key, left);
    }
  }
  return boxes;
}

export function resetQaSandboxFlags(): void {
  setVfxTestKit(false);
}

/** Build a complete, isolated QA GameState for the chosen preset. */
export function buildQaSandbox(
  preset: QaPresetId,
  character: 'male' | 'female' = 'female',
  now = Date.now(),
): { gs: GameState; report: { lines: string[]; report: OfflineReturnV1 | null } | null; banner?: { text: string; sub: string } } {
  setVfxTestKit(preset === 'vfx_showcase');
  const targetLayout = preset === 'vfx_showcase' ? U05_WORLD_LAYOUT_ID : 'shipping_fresh';
  setActiveLayout(targetLayout);
  getWorld(targetLayout);
  const gs = newGame();
  gs.profile.securedCash = 120;
  startRun(gs, character, now, null, 0x50f1aa);
  const r = gs.run!;
  r.qaUsed = true;
  if (r.layoutId && isVeyra05Layout(r.layoutId)) {
    const ww = getWindowWorld(r.layoutId);
    syncFloor(gs, ww, ww.floors, markDirty);
  }
  const p = r.player;
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);

  let report: { lines: string[]; report: OfflineReturnV1 | null } | null = null;
  let banner: { text: string; sub: string } | undefined;

  if (preset === 'fresh') {
    pushLog(r, now, 'QA Sandbox: Fresh-Start Survival ready.', 'gold');
    return { gs, report };
  }

  if (preset === 'vfx_showcase') {
    learnAllRecipes(r);
    C(r, 'eq').slots = [mkStack(r, 'gas_mask', 1), mkStack(r, 'chitin_armor', 1), mkStack(r, 'trail_pack', 1)];
    const inv = C(r, 'inv');
    inv.slots[8] = mkStack(r, 'stew', 8);
    inv.slots[9] = mkStack(r, 'medkit', 8);
    inv.slots[10] = mkStack(r, 'energy_basic', 80);
    inv.slots[11] = mkStack(r, 'energy_refined', 40);
    r.creatures.push(
      { id: `qa_m_${r.nextId++}`, type: 'boar', x: p.x + 88, y: p.y - 12, hp: 140, maxHp: 140, homeX: p.x + 88, homeY: p.y - 12, state: 'wander', t: 0, tx: p.x + 88, ty: p.y - 12, angle: Math.PI, dir: 1, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0 },
    );
    banner = { text: 'VFX CHOREOGRAPHY SHOWCASE', sub: 'Slots 2–8 = 7 Creator Cores · LMB Basic · Hold Q Refined · Hold E Signature · F6 Side Boss · F7 Heal/Reload' };
    pushLog(r, now, 'QA Sandbox: VFX Showcase active on Veyra. Press F6 to summon Side Bosses, F7 to heal & reload Cores.', 'gold');
    markDirty();
    return { gs, report, banner };
  }

  if (preset !== 'industry' && preset !== 'offline_return') learnAllRecipes(r);
  equipFullGear(r);

  if (preset === 'full_gear') {
    const compound = buildIndustrialCompound(gs, ptx, pty);
    // Keep one real specimen study available in the full-gear workshop.
    r.knowledge.recipes = r.knowledge.recipes.filter(k => k !== 'fur_cloak');
    loadFullGear(r);
    const convoy = provisionVehicles(gs, r, now);
    fillAssetWarehouse(r, compound.bx, compound.by);
    const vendor = convoy.vendor;
    const cashId = `qa-cash-${r.id}`;
    const cashBox = mkContainer(r, 'cash', 2);
    cashBox.slots[0] = mkStack(r, 'rcash', 35);
    r.entities[cashId] = { id: cashId, kind: 'cash', x: vendor.x + 18, y: vendor.y + 6, tx: vendor.tx, ty: vendor.ty, c: cashBox.id, minted: true, stock: { cash: 35 }, label: 'Ragnarok Cash cache · staged' };
    addItem(r, 'inv', 'rcash', 45);
    const evacSpot = findOpenTile(r, ptx, pty, 5);
    r.entities[`qa_evac_${r.nextId++}`] = { id: `qa_evac_${r.nextId}`, kind: 'evac', x: evacSpot.tx * TILE + 8, y: evacSpot.ty * TILE + 8, tx: evacSpot.tx, ty: evacSpot.ty, label: 'Evacuation Beacon · QA' };

    // Targets are QA-only sparring fixtures. Their combat, hitboxes and damage are live sim behavior.
    r.creatures.push(
      { id: `qa_m_${r.nextId++}`, type: 'wolf', x: p.x + 86, y: p.y - 18, hp: 30, maxHp: 30, homeX: p.x + 86, homeY: p.y - 18, state: 'wander', t: 0, tx: p.x + 86, ty: p.y - 18, angle: Math.PI, dir: 1, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0 },
      { id: `qa_m_${r.nextId++}`, type: 'boar', x: p.x + 98, y: p.y + 32, hp: 40, maxHp: 40, homeX: p.x + 98, homeY: p.y + 32, state: 'wander', t: 0, tx: p.x + 98, ty: p.y + 32, angle: Math.PI, dir: 1, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0 },
    );
    const airdrop = mkContainer(r, 'airdrop', 4);
    airdrop.slots[0] = mkStack(r, 'core_meteor', 1);
    airdrop.slots[1] = mkStack(r, 'spares', 12);
    const adX = Math.floor((p.x + 72) / TILE), adY = Math.floor((p.y - 30) / TILE);
    const drop: Entity = { id: `qa_airdrop_${r.nextId++}`, kind: 'airdrop', x: adX * TILE + 8, y: adY * TILE + 8, tx: adX, ty: adY, c: airdrop.id, airdrop: { index: 91, phase: 'descending', signalAt: now - 2000, descentAt: now, landAt: now + 6500, unlockAt: now + 16000, expiresAt: now + 900000 } };
    r.entities[drop.id] = drop;
    banner = { text: 'FULL-GEAR · ASHFALL COMPOUND', sub: 'Live work queues, 11 Cores, six-state tests, freight, research & an airdrop visual preview' };
    pushLog(r, now, 'QA fixture: one all-in-one world is ready. Actions you perform still use the live engine.', 'gold');
  }

  if (preset === 'cores') {
    loadAllCores(r);
    // Spawn 3 sparring creatures within view so Q/E/LMB Core skills can be tested immediately
    const types = ['boar', 'crawler', 'beetle'];
    types.forEach((tp, idx) => {
      const cx = p.x + 95 + idx * 14, cy = p.y - 36 + idx * 36;
      r.creatures.push({ id: `qa_m_${r.nextId++}`, type: tp, x: cx, y: cy, hp: 140, maxHp: 140, homeX: cx, homeY: cy, state: 'wander', t: 0, tx: cx, ty: cy, angle: Math.PI, dir: 1, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0 });
    });
    banner = { text: 'ALL 11 CORES LOADED', sub: 'Hold Q (Refined) or E (Signature) · LMB Basic · R Reload' };
    pushLog(r, now, 'QA Sandbox: All 7 Creator Cores + 4 Elemental Cores loaded.', 'gold');
  }

  if (preset === 'elders') {
    loadAllCores(r);
    C(r, 'inv').slots[20] = mkStack(r, 'iron_sword', 1);
    C(r, 'inv').slots[21] = mkStack(r, 'bow', 1);
    C(r, 'inv').slots[22] = mkStack(r, 'arrow', 60);
    // Move Rust Colossus (or summon a fresh Elder) 6 tiles east of the player, awake and ready to fight
    const existing = r.creatures.find(m => m.elder?.key === 'rust');
    const d = ELDERS.rust;
    if (existing) {
      existing.x = p.x + 92; existing.y = p.y; existing.homeX = existing.x; existing.homeY = existing.y;
      existing.state = 'chase'; existing.elder!.awake = true; existing.maxHp = d.hpAwake; existing.hp = d.hpAwake;
    }
    banner = { text: 'ELDER BOSS ARENA', sub: 'Rust Colossus awakened — open QA Lab [F9] to switch any of the 6 Elders' };
    pushLog(r, now, 'QA Sandbox: Elder Boss Arena active. Use QA Lab [F9] to summon any of the 6 Elders.', 'red');
  }

  if (preset === 'industry') {
    const compound = buildIndustrialCompound(gs, ptx, pty);
    fillAssetWarehouse(r, compound.bx, compound.by);
    banner = { text: 'HOME & INDUSTRIAL YARD', sub: 'Real jobs are queued through the engine; open a station to inspect or cancel.' };
    pushLog(r, now, 'QA setup: supplied compound placed. Station actions, queue costs and completion use the live engine.', 'gold');
  }

  if (preset === 'vehicle') {
    const convoy = provisionVehicles(gs, r, now);
    banner = { text: 'MOTORBIKE & FREIGHT CONVOY', sub: convoy.bike ? 'Bike & cart were deployed/refuelled by real engine actions. Walk to mount · no auto-positioning.' : 'Deployment conditions blocked the bike. Inspect the packed kit and site; no vehicle was fabricated.' };
    pushLog(r, now, 'QA setup: vehicle kits were deployed through engine intents; use WASD to approach, mount and drive.', 'gold');
  }

  if (preset === 'offline_return') {
    const compound = buildIndustrialCompound(gs, ptx, pty);
    fillAssetWarehouse(r, compound.bx, compound.by);
    banner = { text: 'OFFLINE RETURN · ENGINE REPLAY', sub: 'Use F9 → Events → Run real 6.5h settle. Rows are generated from live settlement receipts & snapshots.' };
    pushLog(r, now, 'QA setup: real furnace, refinery and research jobs queued. F9 → Events can replay a 6.5h engine settlement.', 'gold');
  }

  if (preset === 'ragnarok_economy') {
    // Advance run clock to Hour 266 (inside the final 72h Ragnarok window!)
    r.qaOffset = 266.2 * HOUR;
    addItem(r, 'inv', 'rcash', 45);
    const chestSpot = findOpenTile(r, ptx, pty, 5);
    const cashC = mkContainer(r, 'cash', 2);
    cashC.slots[0] = mkStack(r, 'rcash', 35);
    r.entities[`qa_cash_${r.nextId++}`] = { id: `qa_cash_${r.nextId}`, kind: 'cash', x: chestSpot.tx * TILE + 8, y: chestSpot.ty * TILE + 8, tx: chestSpot.tx, ty: chestSpot.ty, c: cashC.id, minted: true, stock: { cash: 35 } };

    // Spawn Mirela Trader, an owned Cabinet + Escrow Chest, and an Evacuation Beacon nearby
    const vSpot = findOpenTile(r, ptx, pty, 6);
    r.entities[`qa_vendor_${r.nextId++}`] = { id: `qa_vendor_${r.nextId}`, kind: 'vendor', x: vSpot.tx * TILE + 8, y: vSpot.ty * TILE + 8, tx: vSpot.tx, ty: vSpot.ty, label: 'Mirela the Trader' };

    placeStruct(r, 'claim', ptx - 2, pty + 1, { cabinet: { credit: {}, legacy: false } });
    placeStruct(r, 'escrow', ptx - 1, pty + 1);

    const evSpot = findOpenTile(r, ptx, pty, 7);
    r.entities[`qa_evac_${r.nextId++}`] = { id: `qa_evac_${r.nextId}`, kind: 'evac', x: evSpot.tx * TILE + 8, y: evSpot.ty * TILE + 8, tx: evSpot.tx, ty: evSpot.ty, label: 'Evacuation Beacon' };

    r.elderStones = ['stone_frost', 'stone_magma', 'stone_grove'];
    r.elderStones.forEach(sk => addItem(r, 'inv', sk, 1));
    banner = { text: 'RAGNAROK · FINAL 72 HOURS', sub: 'Sealed Cash, Mirela Trader, Escrow Chest & Evacuation Beacon in reach' };
    pushLog(r, now, 'QA Sandbox: Ragnarok economy & evacuation scenario active (Hour 266/336).', 'red');
  }

  if (preset === 'death_recovery') {
    placeStruct(r, 'bed_straw', ptx - 1, pty);
    // Drop a real Ground Death Bag 10 tiles east containing high-value Cores & Ragnarok Cash
    const bx = Math.min(WW - 6, ptx + 10), by = pty;
    const bagC = mkContainer(r, 'bag', 12);
    const dragon = mkStack(r, 'core_dragon', 1); dragon.reserves = { basic: 40, refined: 12, signature: 4 };
    bagC.slots[0] = dragon;
    bagC.slots[1] = mkStack(r, 'rcash', 60);
    bagC.slots[2] = mkStack(r, 'iron_sword', 1);
    const bagId = `qa_bag_${r.nextId++}`;
    r.entities[bagId] = { id: bagId, kind: 'bag', x: bx * TILE + 8, y: by * TILE + 8, c: bagC.id, label: 'Fallen Adventurer Bag (staged)', born: now };
    receipt(r, now, 'death', `QA staged preview; bag=${bagId}`);
    p.dead = true;
    p.deadT = 1500;
    p.hp = 0;
    pushLog(r, now, `QA Sandbox: Fallen state active. Your bag lies at (${bx}, ${by}).`, 'red');
  }

  if (preset === 'research_access') {
    // Nothing else is placed near the player: on free ground the table is unavoidably the nearest
    // interactable, so "press E" is a real, repeatable route to the panel rather than a tie to win.
    // Radius 1 around one tile south of the spawn: the table is then at most ~2 tiles away, so the
    // prompt reaches it after a single step, whatever the terrain looks like at the start position.
    const spot = findOpenTile(r, ptx, pty + 1, 1);
    placeStruct(r, 'research', spot.tx, spot.ty);
    // The family ledger is reached with no knowledge grant: every family row must still be legible,
    // decided or undecided, exactly as the shipped build states it.
    // The pack key is `deploy_` + the structure type (catalog.ts deployable synthesis) — 'research',
    // not a noun phrase; addItem would hand back the whole qty if the item did not exist.
    const left = addItem(r, 'inv', 'deploy_research', 1);
    if (left > 0) throw new Error('qa preset research_access: deploy_research is not a real item key');
    banner = { text: 'RECOVERED RESEARCH TABLE · OPEN GROUND', sub: 'One authorized table south of the spawn · a packed spare in slot 1 · E opens the technology families' };
    pushLog(r, now, 'QA Sandbox: a Research Table stands on free ground nearby. Select the packed spare to place a second, or press E at the table.', 'gold');
  }

  markDirty();
  return { gs, report, banner };
}

/** Trigger live staged events inside an active QA run without breaking rules. */
export function triggerQaEvent(
  gs: GameState,
  event: 'ragnarok' | 'awaken_elder' | 'overheat_elder' | 'defeat_elder' | 'discover_core' | 'spawn_airdrop' | 'unlock_airdrop' | 'fall_down' | 'bike_states',
  now: number,
  elderKey = 'rust',
): { banner?: { text: string; sub: string }; coreKey?: string; offlineReport?: { lines: string[]; report: OfflineReturnV1 | null } } {
  const r = gs.run; if (!r) return {};
  const p = r.player;
  r.qaUsed = true;

  switch (event) {
    case 'ragnarok': {
      if (r.startedAt + r.qaOffset > now - 264 * HOUR) r.qaOffset = 264.1 * HOUR;
      FX.push({ type: 'shake', m: 5 });
      receipt(r, now, 'qa.ragnarok', 'Ragnarok triggered');
      pushLog(r, now, 'The sky tears open — RAGNAROK has begun. 72 hours remain.', 'red');
      return { banner: { text: 'RAGNAROK HAS BEGUN', sub: 'Final 72 hours · Sealed Vaults unseal · Elders stir' } };
    }
    case 'awaken_elder': {
      const d = ELDERS[elderKey] || ELDERS.rust;
      let m = r.creatures.find(c => c.elder?.key === elderKey);
      if (!m) {
        m = { id: `qa_elder_${r.nextId++}`, type: 'elder_' + elderKey, x: p.x + 88, y: p.y, hp: d.hpAwake, maxHp: d.hpAwake, homeX: p.x + 88, homeY: p.y, state: 'chase', t: 0, tx: p.x + 88, ty: p.y, angle: Math.PI, dir: 1, knows: { kind: 'sight', x: p.x, y: p.y, at: now }, path: null, pathT: 0, cd: 600, kbx: 0, kby: 0, flash: 0, elder: { key: elderKey, awake: true, phase: 1, pattern: 0, special: 0 } };
        r.creatures.push(m);
      } else {
        m.x = p.x + 88; m.y = p.y; m.homeX = m.x; m.homeY = m.y;
        m.state = 'chase'; m.elder!.awake = true; m.maxHp = d.hpAwake; m.hp = d.hpAwake;
        m.knows = { kind: 'sight', x: p.x, y: p.y, at: now };
      }
      FX.push({ type: 'shake', m: 4 });
      return { banner: { text: `${d.name.toUpperCase()} AWAKENS`, sub: `${d.title} · ${d.region}` } };
    }
    case 'overheat_elder': {
      const m = r.creatures.find(c => c.elder && c.state !== 'dead');
      if (m) {
        m.atk = { tell: 400, vuln: 4500, pat: 'overload' };
        HAZ.push({ kind: 'ring', x: m.x, y: m.y, r: 64, t: 0, tell: 400, dur: 600, dmg: 0, style: 'steam', elder: m.elder!.key, owner: m.id } as any);
        pushLog(r, now, `${ELDERS[m.elder!.key].name} is exposed — 2× vulnerability window!`, 'gold');
      }
      return {};
    }
    case 'defeat_elder': {
      const m = r.creatures.find(c => c.elder && c.state !== 'dead') || r.creatures.find(c => c.elder);
      const key = m?.elder?.key || elderKey;
      const d = ELDERS[key];
      if (m) { m.hp = 0; m.state = 'dead'; m.t = 0; }
      const dropC = mkContainer(r, 'drop', 1);
      dropC.slots[0] = mkStack(r, d.stone, 1);
      r.entities[`qa_stone_${r.nextId++}`] = { id: `qa_stone_${r.nextId}`, kind: 'drop', x: p.x + 36, y: p.y, c: dropC.id, born: now };
      FX.push({ type: 'boom', x: p.x + 56, y: p.y });
      receipt(r, now, 'elder.defeat', key);
      return { banner: { text: `${d.name.toUpperCase()} VANQUISHED`, sub: `${ITEMS[d.stone].name} dropped · Claim it for the Crown of Six` } };
    }
    case 'discover_core': {
      const st = mkStack(r, 'core_dragon', 1);
      if (st.reserves) st.reserves = { basic: 40, refined: 12, signature: 4 };
      addItem(r, 'inv', 'energy_basic', 20);
      const inv = C(r, 'inv');
      const free = inv.slots.findIndex(x => !x);
      if (free >= 0) { inv.slots[free] = st; if (free < 8) p.active = free; }
      FX.push({ type: 'discover', name: ITEMS.core_dragon.name });
      return { coreKey: 'core_dragon' };
    }
    case 'spawn_airdrop': {
      const tx = Math.floor(p.x / TILE) + 3, ty = Math.floor(p.y / TILE) - 1;
      const c = mkContainer(r, 'airdrop', 4);
      c.slots[0] = mkStack(r, 'core_meteor', 1);
      c.slots[1] = mkStack(r, 'spares', 10);
      c.slots[2] = mkStack(r, 'medkit', 3);
      const e: Entity = {
        id: `qa_drop_${r.nextId++}`,
        kind: 'airdrop',
        x: tx * TILE + 8,
        y: ty * TILE + 8,
        tx,
        ty,
        c: c.id,
        airdrop: { index: 99, phase: 'descending', signalAt: now - 5000, descentAt: now, landAt: now + 3500, unlockAt: now + 14000, expiresAt: now + 900000 },
      };
      r.entities[e.id] = e;
      return { banner: { text: 'AIRDROP DESCENDING', sub: 'Watch the chute touchdown nearby · unlocks in 14s' } };
    }
    case 'unlock_airdrop': {
      const ad = Object.values(r.entities).find(e => e.kind === 'airdrop' && e.airdrop);
      if (ad?.airdrop) {
        ad.airdrop.phase = 'open';
        ad.airdrop.landAt = now - 5000;
        ad.airdrop.unlockAt = now - 1000;
        FX.push({ type: 'airdropImpact', x: ad.x, y: ad.y });
      }
      return { banner: { text: 'AIRDROP UNLOCKED', sub: 'Walk up and press E to inspect & claim supplies' } };
    }
    case 'fall_down': {
      p.dead = true; p.deadT = 1500; p.hp = 0;
      return {};
    }
    case 'bike_states': {
      const bike = Object.values(r.entities).find(e => e.kind === 'vehicle' && e.vehicle);
      if (bike?.vehicle) {
        if ((bike.hp ?? 0) <= 0) { bike.hp = BAL.motorbike.maxHp; bike.vehicle.fuel = 80; }
        else if (bike.vehicle.fuel > 0) { bike.vehicle.fuel = 0; }
        else { bike.hp = 0; }
      }
      return {};
    }
  }
}

/** Helper to mount/dismount or cycle states cleanly in QA Animation Lab. */
export function qaCycleBikeState(r: RunState): string {
  const bike = Object.values(r.entities).find(e => e.kind === 'vehicle' && e.vehicle);
  if (!bike?.vehicle) return 'No bike deployed';
  if ((bike.hp ?? 0) <= 0) { bike.hp = BAL.motorbike.maxHp; bike.vehicle.fuel = 80; return 'READY (Fueled & Sound)'; }
  if (bike.vehicle.fuel > 0) { bike.vehicle.fuel = 0; return 'OUT OF FUEL (Dry Tank)'; }
  bike.hp = 0; return 'BROKEN (0 HP · Flat Front Tyre)';
}
void dispatch;
