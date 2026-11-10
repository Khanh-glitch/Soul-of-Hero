import { TILE, WW, WH, uid, clamp, type Creature, type Entity, type GameState, type RunState } from './core';
import { CREATURES, ITEMS } from './catalog';
import { FRAME_W, FRAME_H, U } from '../veyra05/frame';
import { isVeyra05Layout } from '../veyra05/scenes';

/** SOH_PROVISIONAL: Feed nutrition values per single item consumed from a pen's Feed & Water Trough. */
export const FEED_NUTRITION: Record<string, number> = {
  animal_feed: 38,
  crop: 34,
  berries: 18,
  herb: 16,
  mushroom: 14,
  seed: 12,
};

/** SOH_PROVISIONAL: Biologically grounded renewable pen yields deposited into the pen's Feed & Water Trough
 *  ONLY by fed, hydrated adult livestock inside a closed pen.
 *  Anatomical carcass parts (`hide`, `boar_tusk`, `meat`) NEVER drop passively into troughs — they require
 *  breeding & physical butchery (`BUTCHER_YIELDS`). */
export const HUSBANDRY_YIELDS: Record<
  string,
  { primary: [string, number]; secondary?: [string, number]; cycleHours: number; femaleOnlyPrimary?: boolean }
> = {
  grouse: { primary: ['grouse_egg', 1], secondary: ['feather', 2], cycleHours: 4.0, femaleOnlyPrimary: true },
  hare: { primary: ['fur', 1], cycleHours: 4.5 }, // Natural winter/seasonal coat molt
  boar: { primary: ['mushroom', 2], cycleHours: 5.0 }, // Rooted earth truffles in pen soil
  deer: { primary: ['fiber', 2], secondary: ['herb', 1], cycleHours: 5.5 }, // Shed winter undercoat tuft & cud forage
};

/** Sex-aware renewable pen yield resolver: only adult female ('f') grouse lay `grouse_egg`; adult male ('m') grouse molt `feather` only. */
export function resolveHusbandryYield(
  species: string,
  sex: 'f' | 'm',
): { primary: [string, number]; secondary?: [string, number]; cycleHours: number } | null {
  const spec = HUSBANDRY_YIELDS[species];
  if (!spec) return null;
  if (spec.femaleOnlyPrimary && sex !== 'f') {
    if (!spec.secondary) return null;
    return { primary: spec.secondary, cycleHours: spec.cycleHours };
  }
  return spec;
}

/** SOH_PROVISIONAL: Physical carcass yields when harvesting/butchering a tamed animal with a bladed tool.
 *  Breeding a male + female pair and harvesting surplus adults is the sustainable ranching loop for meat, hide, and tusks. */
export const BUTCHER_YIELDS: Record<string, { adult: [string, number][]; juvenile: [string, number][] }> = {
  boar: { adult: [['meat', 5], ['hide', 2], ['boar_tusk', 2]], juvenile: [['meat', 2], ['hide', 1]] },
  deer: { adult: [['meat', 5], ['hide', 3]], juvenile: [['meat', 2], ['hide', 1]] },
  hare: { adult: [['meat', 2], ['fur', 2]], juvenile: [['meat', 1], ['fur', 1]] },
  grouse: { adult: [['meat', 2], ['feather', 3]], juvenile: [['meat', 1], ['feather', 1]] },
};

/** SOH_PROVISIONAL: Intentional sexual reproduction contract for penned livestock. */
export const HUSBANDRY_BREEDING_RULES = {
  requiresOppositeSexPair: true,
  minParentHunger: 50,
  minParentHydration: 50,
  gestationHoursBySpecies: {
    hare: 6.0,
    grouse: 6.5,
    boar: 8.0,
    deer: 8.0,
  } as Record<string, number>,
  maternalHungerCost: 26,
  maternalHydrationCost: 20,
  paternalHungerCost: 16,
  paternalHydrationCost: 14,
} as const;

export const TAMABLE_SPECIES = new Set(['boar', 'deer', 'hare', 'grouse']);

export const TAMING_SPECIES: Record<string, { preferredFoods: string[]; feedingsToTame: number }> = {
  boar: { preferredFoods: ['animal_feed', 'mushroom', 'crop', 'berries'], feedingsToTame: 2 },
  deer: { preferredFoods: ['animal_feed', 'crop', 'herb', 'berries'], feedingsToTame: 2 },
  hare: { preferredFoods: ['animal_feed', 'crop', 'berries', 'herb'], feedingsToTame: 1 },
  grouse: { preferredFoods: ['animal_feed', 'seed', 'berries'], feedingsToTame: 1 },
};

/** Deterministic biological sex (`'f' | 'm'`) derived from actor ID so regional pairs (`:0` / `:1`, `b1` / `b2`) balance naturally. */
export function deterministicAnimalSex(actorId: string, seed = 0): 'f' | 'm' {
  const pairMatch = /:([0-9]+)$/.exec(actorId);
  if (pairMatch) return Number(pairMatch[1]) % 2 === 0 ? 'f' : 'm';
  let sum = seed & 1;
  for (let i = 0; i < actorId.length; i++) sum += actorId.charCodeAt(i);
  return sum % 2 === 0 ? 'f' : 'm';
}

export function ensureAnimalSex(m: Creature, seed = 0): 'f' | 'm' {
  if (m.husbandry?.sex === 'f' || m.husbandry?.sex === 'm') return m.husbandry.sex;
  const sex = deterministicAnimalSex(m.id, seed);
  if (m.husbandry) m.husbandry.sex = sex;
  return sex;
}

export function createTamedState(sex?: 'f' | 'm', fallbackId = 'a0', seed = 0): NonNullable<Creature['husbandry']> {
  return {
    tamed: true,
    following: false,
    penned: false,
    stage: 'adult',
    hunger: 75,
    hydration: 75,
    growth: 1,
    breedProgress: 0,
    produceProgress: 0,
    sex: sex ?? deterministicAnimalSex(fallbackId, seed),
  };
}

export interface PenInspection {
  enclosed: boolean;
  tiles: Set<number>;
  troughs: Entity[];
  barrels: Entity[];
  perimeterWalls: Entity[];
  capacity: number;
}

const PEN_WALL_TYPES = new Set(['wall_wood', 'wall_plank', 'wall_stone', 'wall_brick', 'barricade']);
const PEN_DOOR_TYPES = new Set(['door_wood', 'door_iron', 'door_powered']);
const MAX_PEN_INTERIOR_TILES = 144;

function isPenBarrierEntity(e: Entity): boolean {
  if (e.kind !== 'struct' || (e.hp ?? 1) <= 0 || !e.type) return false;
  if (PEN_WALL_TYPES.has(e.type)) return true;
  if (PEN_DOOR_TYPES.has(e.type)) return !e.open; // Open doors break pen containment!
  return false;
}

function getWindowOriginTiles(r: RunState): [number, number] {
  if (r.layoutId && isVeyra05Layout(r.layoutId) && r.sourceMap?.veyra?.originAu) {
    return [
      Math.round(r.sourceMap.veyra.originAu[0] / U),
      Math.round(r.sourceMap.veyra.originAu[1] / U),
    ];
  }
  return [0, 0];
}

function buildUnifiedGlobalStructIndex(r: RunState): {
  maxW: number;
  maxH: number;
  byFloorTile: Map<string, Entity[]>;
} {
  const isVeyra = !!r.layoutId && isVeyra05Layout(r.layoutId);
  const maxW = isVeyra ? FRAME_W : WW;
  const maxH = isVeyra ? FRAME_H : WH;
  const [ox, oy] = getWindowOriginTiles(r);
  const byFloorTile = new Map<string, Entity[]>();

  const addStruct = (e: Entity, gx: number, gy: number, floor: number) => {
    if (e.kind !== 'struct') return;
    const k = `${floor}:${gy * maxW + gx}`;
    let arr = byFloorTile.get(k);
    if (!arr) { arr = []; byFloorTile.set(k, arr); }
    arr.push(e);
  };

  for (const e of Object.values(r.entities)) {
    if (e.kind !== 'struct' || e.tx === undefined || e.ty === undefined) continue;
    const fl = ((e as any).floor ?? 0) as number;
    addStruct(e, ox + e.tx, oy + e.ty, fl);
  }
  if (isVeyra && r.veyraOffscreenEntities) {
    for (const oe of Object.values(r.veyraOffscreenEntities)) {
      if (oe.kind !== 'struct' || oe.tx === undefined || oe.ty === undefined) continue;
      const fl = ((oe as any).floor ?? 0) as number;
      addStruct(oe, oe.tx, oe.ty, fl);
    }
  }
  return { maxW, maxH, byFloorTile };
}

function inspectUnifiedPenAtGlobal(
  index: ReturnType<typeof buildUnifiedGlobalStructIndex>,
  floor: number,
  startGx: number,
  startGy: number,
): PenInspection {
  const empty: PenInspection = { enclosed: false, tiles: new Set(), troughs: [], barrels: [], perimeterWalls: [], capacity: 0 };
  const { maxW, maxH, byFloorTile } = index;
  if (startGx <= 0 || startGy <= 0 || startGx >= maxW - 1 || startGy >= maxH - 1) return empty;

  const keyOf = (gx: number, gy: number) => `${floor}:${gy * maxW + gx}`;
  const startIdx = startGy * maxW + startGx;
  if ((byFloorTile.get(keyOf(startGx, startGy)) || []).some(isPenBarrierEntity)) return empty;

  const visited = new Set<number>([startIdx]);
  const perimeterMap = new Map<string, Entity>();
  const queue: number[] = [startIdx];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const cx = cur % maxW, cy = Math.floor(cur / maxW);
    if (cx <= 0 || cy <= 0 || cx >= maxW - 1 || cy >= maxH - 1) {
      return empty;
    }
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbors) {
      const nIdx = ny * maxW + nx;
      if (visited.has(nIdx)) continue;
      const ents = byFloorTile.get(keyOf(nx, ny)) || [];
      const barriers = ents.filter(isPenBarrierEntity);
      if (barriers.length > 0) {
        for (const b of barriers) perimeterMap.set(b.id, b);
        continue;
      }
      visited.add(nIdx);
      if (visited.size > MAX_PEN_INTERIOR_TILES) {
        return empty;
      }
      queue.push(nIdx);
    }
  }

  if (visited.size < 2) return empty;

  const troughs: Entity[] = [];
  const barrels: Entity[] = [];
  for (const idx of visited) {
    const gx = idx % maxW, gy = Math.floor(idx / maxW);
    for (const e of byFloorTile.get(keyOf(gx, gy)) || []) {
      if ((e.hp ?? 1) <= 0) continue;
      if (e.type === 'feed_trough' && e.c) troughs.push(e);
      if (e.type === 'barrel') barrels.push(e);
    }
  }

  const capacity = Math.min(10, Math.max(3, Math.floor(visited.size / 3)));
  return {
    enclosed: true,
    tiles: visited,
    troughs,
    barrels,
    perimeterWalls: Array.from(perimeterMap.values()),
    capacity,
  };
}

/** Orthogonal flood-fill from local `(startTx, startTy)` on the active floor (also seam-aware across Veyra window edges). */
export function inspectPenAt(r: RunState, startTx: number, startTy: number): PenInspection {
  const empty: PenInspection = { enclosed: false, tiles: new Set(), troughs: [], barrels: [], perimeterWalls: [], capacity: 0 };
  if (startTx <= 0 || startTy <= 0 || startTx >= WW - 1 || startTy >= WH - 1) return empty;
  const index = buildUnifiedGlobalStructIndex(r);
  const [ox, oy] = getWindowOriginTiles(r);
  const fl = (r.veyraFloor ?? 0) as number;
  const res = inspectUnifiedPenAtGlobal(index, fl, ox + startTx, oy + startTy);
  if (!res.enclosed) return empty;
  // Re-map interior tile indices to local `ty * WW + tx` for local callers when inside window
  const localTiles = new Set<number>();
  for (const gIdx of res.tiles) {
    const gx = gIdx % index.maxW, gy = Math.floor(gIdx / index.maxW);
    const lx = gx - ox, ly = gy - oy;
    if (lx >= 0 && ly >= 0 && lx < WW && ly < WH) localTiles.add(ly * WW + lx);
  }
  return { ...res, tiles: localTiles.size > 0 ? localTiles : res.tiles };
}

function consumeOneFeedFromTroughs(r: RunState, troughs: Entity[]): number {
  for (const tr of troughs) {
    if (!tr.c || !r.custody[tr.c]) continue;
    const slots = r.custody[tr.c].slots;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s) continue;
      const nut = FEED_NUTRITION[s.key];
      if (!nut) continue;
      s.qty -= 1;
      if (s.qty <= 0) slots[i] = null;
      return nut;
    }
  }
  return 0;
}

function consumeOneWaterFromPen(r: RunState, troughs: Entity[], barrels: Entity[]): number {
  for (const br of barrels) {
    if ((br.water ?? 0) >= 1) {
      br.water = (br.water ?? 0) - 1;
      return 32;
    }
  }
  for (const tr of troughs) {
    if (!tr.c || !r.custody[tr.c]) continue;
    const slots = r.custody[tr.c].slots;
    for (const s of slots) {
      if (!s) continue;
      const def = ITEMS[s.key];
      if (def?.waterContainer && (s.charge ?? 0) >= 1) {
        s.charge = (s.charge ?? 0) - 1;
        return def.food?.thirst ?? 30;
      }
    }
  }
  return 0;
}

function depositIntoTroughs(r: RunState, troughs: Entity[], itemKey: string, qty: number): boolean {
  const maxStack = ITEMS[itemKey]?.max ?? 20;
  for (const tr of troughs) {
    if (!tr.c || !r.custody[tr.c]) continue;
    const slots = r.custody[tr.c].slots;
    for (let i = 0; i < slots.length && qty > 0; i++) {
      const s = slots[i];
      if (s && s.key === itemKey && s.qty < maxStack) {
        const take = Math.min(qty, maxStack - s.qty);
        s.qty += take;
        qty -= take;
      }
    }
    for (let i = 0; i < slots.length && qty > 0; i++) {
      if (!slots[i]) {
        const take = Math.min(qty, maxStack);
        slots[i] = { uid: uid(r, 's'), key: itemKey, qty: take };
        qty -= take;
      }
    }
    if (qty <= 0) return true;
  }
  return false;
}

interface TamedRecordRef {
  m: Creature;
  offscreen: boolean;
  gxPx: number;
  gyPx: number;
  floor: number;
}

/** Deterministic world-global husbandry metabolic, growth, sexual breeding, and renewable yield step for `dtSec` seconds.
 *  Steps BOTH active-window (`r.creatures`) AND archived offscreen/off-storey (`r.veyraOffscreenCreatures`) tamed livestock
 *  against unified global pen enclosures (`r.entities` ∪ `r.veyraOffscreenEntities`) with exact online/offline parity
 *  and zero double-settlement across window shifts. */
export function stepHusbandry(gs: GameState, dtSec: number, _now: number, isRaining: boolean): void {
  const r = gs.run;
  if (!r || dtSec <= 0) return;

  const dtHours = dtSec / 3600;
  if (dtHours <= 0) return;

  const [ox, oy] = getWindowOriginTiles(r);
  let allTamed: TamedRecordRef[] | null = null;
  let seenIds: Set<string> | null = null;

  for (let i = 0; i < r.creatures.length; i++) {
    const m = r.creatures[i];
    if (m.state === 'dead' || !m.husbandry?.tamed) continue;
    if (!seenIds) { seenIds = new Set<string>(); allTamed = []; }
    if (seenIds.has(m.id)) continue;
    seenIds.add(m.id);
    ensureAnimalSex(m, r.seed);
    allTamed!.push({
      m,
      offscreen: false,
      gxPx: ox * TILE + m.x,
      gyPx: oy * TILE + m.y,
      floor: (m.floor ?? 0) as number,
    });
  }

  if (r.veyraOffscreenCreatures) {
    for (const k in r.veyraOffscreenCreatures) {
      const om = r.veyraOffscreenCreatures[k];
      if (!om || om.state === 'dead' || !om.husbandry?.tamed) continue;
      if (!seenIds) { seenIds = new Set<string>(); allTamed = []; }
      if (seenIds.has(om.id)) continue;
      seenIds.add(om.id);
      ensureAnimalSex(om, r.seed);
      allTamed!.push({
        m: om,
        offscreen: true,
        gxPx: om.x,
        gyPx: om.y,
        floor: (om.floor ?? 0) as number,
      });
    }
  }

  if (!allTamed || allTamed.length === 0) return;

  const structIndex = buildUnifiedGlobalStructIndex(r);
  const penCache = new Map<string, PenInspection>();
  const penGroups = new Map<string, { pen: PenInspection; floor: number; members: TamedRecordRef[] }>();

  for (const rec of allTamed) {
    const h = rec.m.husbandry!;
    const rainApplies = isRaining && rec.floor === 0;
    if (h.following) {
      h.penned = false;
      h.hunger = clamp(h.hunger - 2.0 * dtHours, 0, 100);
      h.hydration = clamp(h.hydration + (rainApplies ? 8.0 : -2.5) * dtHours, 0, 100);
      continue;
    }

    const gx = clamp(Math.floor(rec.gxPx / TILE), 1, structIndex.maxW - 2);
    const gy = clamp(Math.floor(rec.gyPx / TILE), 1, structIndex.maxH - 2);
    const tileKey = `${rec.floor}:${gy * structIndex.maxW + gx}`;

    let pen = penCache.get(tileKey);
    if (!pen) {
      pen = inspectUnifiedPenAtGlobal(structIndex, rec.floor, gx, gy);
      if (pen.enclosed) {
        for (const ti of pen.tiles) penCache.set(`${rec.floor}:${ti}`, pen);
      } else {
        penCache.set(tileKey, pen);
      }
    }

    if (!pen.enclosed) {
      h.penned = false;
      h.hunger = clamp(h.hunger - 3.5 * dtHours, 0, 100);
      h.hydration = clamp(h.hydration + (rainApplies ? 10.0 : -4.0) * dtHours, 0, 100);
      continue;
    }

    h.penned = true;
    const minTile = Math.min(...pen.tiles);
    const grpKey = `gpen:${rec.floor}:${minTile}`;
    let grp = penGroups.get(grpKey);
    if (!grp) {
      grp = { pen, floor: rec.floor, members: [] };
      penGroups.set(grpKey, grp);
    }
    grp.members.push(rec);
  }

  for (const { pen, floor, members } of penGroups.values()) {
    const rainApplies = isRaining && floor === 0;

    // 1. Metabolic drain + real physical inventory feed/water debit from trough/barrel
    for (const { m } of members) {
      const h = m.husbandry!;
      h.hunger = clamp(h.hunger - 4.5 * dtHours, 0, 100);
      if (rainApplies) {
        h.hydration = clamp(h.hydration + 14.0 * dtHours, 0, 100);
      } else {
        h.hydration = clamp(h.hydration - 5.0 * dtHours, 0, 100);
      }

      let guard = 0;
      while (h.hunger <= 62 && guard++ < 6) {
        const gained = consumeOneFeedFromTroughs(r, pen.troughs);
        if (gained <= 0) break;
        h.hunger = clamp(h.hunger + gained, 0, 100);
      }

      guard = 0;
      while (h.hydration <= 62 && !rainApplies && guard++ < 6) {
        const gained = consumeOneWaterFromPen(r, pen.troughs, pen.barrels);
        if (gained <= 0) break;
        h.hydration = clamp(h.hydration + gained, 0, 100);
      }

      if (h.hunger <= 0 || h.hydration <= 0) {
        m.hp = Math.max(Math.ceil(m.maxHp * 0.25), m.hp - 1.5 * dtHours);
        continue;
      }

      if (h.hunger >= 50 && h.hydration >= 50 && m.hp < m.maxHp) {
        m.hp = Math.min(m.maxHp, m.hp + 4.0 * dtHours);
      }

      // 2. Juvenile -> Adult maturation (6 hours of sustained feed & water)
      if (h.stage === 'juvenile') {
        if (h.hunger >= 35 && h.hydration >= 35) {
          h.growth = clamp(h.growth + dtHours / 6.0, 0, 1);
          if (h.growth >= 1) {
            h.stage = 'adult';
            h.growth = 1;
          }
        }
        continue;
      }

      // 3. Adult renewable biological yield into trough (requires sustained feed & water >= 35 and trough space)
      const sex = ensureAnimalSex(m, r.seed);
      const yieldSpec = resolveHusbandryYield(m.type, sex);
      if (yieldSpec && h.hunger >= 35 && h.hydration >= 35 && pen.troughs.length > 0) {
        h.produceProgress += dtHours / yieldSpec.cycleHours;
        while (h.produceProgress >= 1) {
          const ok = depositIntoTroughs(r, pen.troughs, yieldSpec.primary[0], yieldSpec.primary[1]);
          if (!ok) {
            h.produceProgress = 0.99;
            break;
          }
          if (yieldSpec.secondary) {
            depositIntoTroughs(r, pen.troughs, yieldSpec.secondary[0], yieldSpec.secondary[1]);
          }
          h.produceProgress -= 1;
          h.hunger = clamp(h.hunger - 8, 0, 100);
          h.hydration = clamp(h.hydration - 6, 0, 100);
          if (h.hunger < 35 || h.hydration < 35) break;
        }
      }
    }

    // 4. Sexual Reproduction: requires >=1 adult female ('f') + >=1 adult male ('m') of the same species,
    //    both >= minParentHunger/Hydration, and pen occupancy < pen.capacity!
    const bySpecies = new Map<string, { females: TamedRecordRef[]; males: TamedRecordRef[] }>();
    for (const rec of members) {
      const h = rec.m.husbandry!;
      if (
        h.stage === 'adult' &&
        h.hunger >= HUSBANDRY_BREEDING_RULES.minParentHunger &&
        h.hydration >= HUSBANDRY_BREEDING_RULES.minParentHydration
      ) {
        const sex = ensureAnimalSex(rec.m, r.seed);
        let bucket = bySpecies.get(rec.m.type);
        if (!bucket) { bucket = { females: [], males: [] }; bySpecies.set(rec.m.type, bucket); }
        if (sex === 'f') bucket.females.push(rec);
        else bucket.males.push(rec);
      }
    }

    let currentTotal = members.length;
    for (const [species, { females, males }] of bySpecies.entries()) {
      if (females.length < 1 || males.length < 1 || currentTotal >= pen.capacity) continue;
      const mother = females[0];
      const father = males[0];
      const gestHours = HUSBANDRY_BREEDING_RULES.gestationHoursBySpecies[species] ?? 8.0;
      mother.m.husbandry!.breedProgress += dtHours / gestHours;
      father.m.husbandry!.breedProgress = mother.m.husbandry!.breedProgress;

      if (mother.m.husbandry!.breedProgress >= 1 && currentTotal < pen.capacity) {
        mother.m.husbandry!.breedProgress = 0;
        father.m.husbandry!.breedProgress = 0;
        mother.m.husbandry!.hunger = clamp(mother.m.husbandry!.hunger - HUSBANDRY_BREEDING_RULES.maternalHungerCost, 0, 100);
        mother.m.husbandry!.hydration = clamp(mother.m.husbandry!.hydration - HUSBANDRY_BREEDING_RULES.maternalHydrationCost, 0, 100);
        father.m.husbandry!.hunger = clamp(father.m.husbandry!.hunger - HUSBANDRY_BREEDING_RULES.paternalHungerCost, 0, 100);
        father.m.husbandry!.hydration = clamp(father.m.husbandry!.hydration - HUSBANDRY_BREEDING_RULES.paternalHydrationCost, 0, 100);

        const def = CREATURES[species];
        const babyId = uid(r, 'm');
        const gBx = (mother.gxPx + father.gxPx) * 0.5;
        const gBy = (mother.gyPx + father.gyPx) * 0.5;
        const activeFl = (r.veyraFloor ?? 0) as number;
        const lBx = gBx - ox * TILE;
        const lBy = gBy - oy * TILE;
        const placeInLocalWindow =
          !mother.offscreen &&
          floor === activeFl &&
          lBx >= TILE * 2 &&
          lBy >= TILE * 2 &&
          lBx < (WW - 2) * TILE &&
          lBy < (WH - 2) * TILE;

        const px = placeInLocalWindow ? clamp(lBx, TILE * 2, (WW - 2) * TILE) : gBx;
        const py = placeInLocalWindow ? clamp(lBy, TILE * 2, (WH - 2) * TILE) : gBy;

        const baby: Creature = {
          id: babyId,
          type: species,
          x: px,
          y: py,
          hp: Math.max(8, Math.round(def.hp * 0.6)),
          maxHp: def.hp,
          homeX: px,
          homeY: py,
          state: 'wander',
          t: 0.8,
          tx: px,
          ty: py,
          angle: 0,
          dir: 0,
          knows: null,
          path: null,
          pathT: 0,
          cd: 0,
          kbx: 0,
          kby: 0,
          flash: 0,
          animTime: 0,
          floor: floor as -1 | 0 | 1 | 2,
          husbandry: {
            tamed: true,
            following: false,
            penned: true,
            stage: 'juvenile',
            hunger: 68,
            hydration: 68,
            growth: 0,
            breedProgress: 0,
            produceProgress: 0,
            sex: deterministicAnimalSex(babyId, r.seed),
          },
        };

        if (placeInLocalWindow) {
          r.creatures.push(baby);
        } else {
          const off = (r.veyraOffscreenCreatures ??= {});
          off[baby.id] = baby;
        }
        currentTotal += 1;
      }
    }
  }
}
