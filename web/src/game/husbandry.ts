import { TILE, WW, WH, uid, clamp, type Creature, type Entity, type GameState, type RunState } from './core';
import { CREATURES, ITEMS } from './catalog';

/** SOH_PROVISIONAL: Feed nutrition values per single item consumed from a pen's Feed & Water Trough. */
export const FEED_NUTRITION: Record<string, number> = {
  animal_feed: 38,
  crop: 34,
  berries: 18,
  herb: 16,
  mushroom: 14,
  seed: 12,
};

/** SOH_PROVISIONAL: Passive husbandry yields deposited into the pen's Feed & Water Trough by fed, watered adults. */
export const HUSBANDRY_YIELDS: Record<string, { primary: [string, number]; secondary?: [string, number]; cycleHours: number }> = {
  grouse: { primary: ['grouse_egg', 1], secondary: ['feather', 1], cycleHours: 4.5 },
  boar: { primary: ['mushroom', 1], secondary: ['boar_tusk', 1], cycleHours: 6.5 },
  deer: { primary: ['hide', 1], cycleHours: 7.0 },
  hare: { primary: ['fur', 1], secondary: ['seed', 2], cycleHours: 5.0 },
};

/** SOH_PROVISIONAL: Butcher yields when harvesting a tamed animal with a bladed tool. */
export const BUTCHER_YIELDS: Record<string, { adult: [string, number][]; juvenile: [string, number][] }> = {
  boar: { adult: [['meat', 4], ['hide', 2], ['boar_tusk', 1]], juvenile: [['meat', 1], ['hide', 1]] },
  deer: { adult: [['meat', 4], ['hide', 2]], juvenile: [['meat', 1], ['hide', 1]] },
  hare: { adult: [['meat', 2], ['fur', 2]], juvenile: [['meat', 1]] },
  grouse: { adult: [['meat', 2], ['feather', 3]], juvenile: [['meat', 1], ['feather', 1]] },
};

export const TAMABLE_SPECIES = new Set(['boar', 'deer', 'hare', 'grouse']);

export const TAMING_SPECIES: Record<string, { preferredFoods: string[]; feedingsToTame: number }> = {
  boar: { preferredFoods: ['animal_feed', 'mushroom', 'crop', 'berries'], feedingsToTame: 2 },
  deer: { preferredFoods: ['animal_feed', 'crop', 'herb', 'berries'], feedingsToTame: 2 },
  hare: { preferredFoods: ['animal_feed', 'crop', 'berries', 'herb'], feedingsToTame: 1 },
  grouse: { preferredFoods: ['animal_feed', 'seed', 'berries'], feedingsToTame: 1 },
};

export function createTamedState(sex?: 'f' | 'm'): NonNullable<Creature['husbandry']> {
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
    ...(sex ? { sex } : {}),
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

/** Orthogonal flood-fill from `(startTx, startTy)` checking whether walls + CLOSED doors enclose a bounded pen. */
export function inspectPenAt(r: RunState, startTx: number, startTy: number): PenInspection {
  const empty: PenInspection = { enclosed: false, tiles: new Set(), troughs: [], barrels: [], perimeterWalls: [], capacity: 0 };
  if (startTx <= 0 || startTy <= 0 || startTx >= WW - 1 || startTy >= WH - 1) return empty;

  const byTile = new Map<number, Entity[]>();
  for (const e of Object.values(r.entities)) {
    if (e.kind !== 'struct' || e.tx === undefined || e.ty === undefined) continue;
    const idx = e.ty * WW + e.tx;
    let arr = byTile.get(idx);
    if (!arr) { arr = []; byTile.set(idx, arr); }
    arr.push(e);
  }

  const startIdx = startTy * WW + startTx;
  if ((byTile.get(startIdx) || []).some(isPenBarrierEntity)) return empty;

  const visited = new Set<number>([startIdx]);
  const perimeterMap = new Map<string, Entity>();
  const queue: number[] = [startIdx];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const cx = cur % WW, cy = (cur / WW) | 0;
    if (cx <= 0 || cy <= 0 || cx >= WW - 1 || cy >= WH - 1) {
      return empty;
    }
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbors) {
      const nIdx = ny * WW + nx;
      if (visited.has(nIdx)) continue;
      const ents = byTile.get(nIdx) || [];
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
    for (const e of byTile.get(idx) || []) {
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
    // Try stacking first
    for (let i = 0; i < slots.length && qty > 0; i++) {
      const s = slots[i];
      if (s && s.key === itemKey && s.qty < maxStack) {
        const take = Math.min(qty, maxStack - s.qty);
        s.qty += take;
        qty -= take;
      }
    }
    // Then empty slot
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

/** Deterministic husbandry metabolic, growth, breeding, and yield step for `dtSec` seconds.
 *  Safe to call at 60 Hz online OR in bounded chunks (e.g. 900s) during 8h/24h/48h offline `settle()`. */
export function stepHusbandry(gs: GameState, dtSec: number, _now: number, isRaining: boolean): void {
  const r = gs.run;
  if (!r || dtSec <= 0) return;

  const dtHours = dtSec / 3600;
  if (dtHours <= 0) return;

  const tamedList = r.creatures.filter(m => m.state !== 'dead' && m.husbandry?.tamed);
  if (tamedList.length === 0) return;

  // Group non-following tamed animals by pen interior
  const penGroups = new Map<string, { pen: PenInspection; members: Creature[] }>();

  for (const m of tamedList) {
    const h = m.husbandry!;
    if (h.following) {
      h.penned = false;
      // Mild drain while on lead
      h.hunger = clamp(h.hunger - 2.0 * dtHours, 0, 100);
      h.hydration = clamp(h.hydration + (isRaining ? 8.0 : -2.5) * dtHours, 0, 100);
      continue;
    }

    const tx = clamp(Math.floor(m.x / TILE), 1, WW - 2);
    const ty = clamp(Math.floor(m.y / TILE), 1, WH - 2);
    const pen = inspectPenAt(r, tx, ty);
    if (!pen.enclosed) {
      h.penned = false;
      h.hunger = clamp(h.hunger - 3.5 * dtHours, 0, 100);
      h.hydration = clamp(h.hydration + (isRaining ? 10.0 : -4.0) * dtHours, 0, 100);
      continue;
    }

    h.penned = true;
    const minTile = Math.min(...pen.tiles);
    const key = `pen:${minTile}`;
    let grp = penGroups.get(key);
    if (!grp) {
      grp = { pen, members: [] };
      penGroups.set(key, grp);
    }
    grp.members.push(m);
  }

  const newborns: Creature[] = [];

  for (const { pen, members } of penGroups.values()) {
    // 1. Metabolic drain + real inventory feed/water debit
    for (const m of members) {
      const h = m.husbandry!;
      h.hunger = clamp(h.hunger - 4.5 * dtHours, 0, 100);
      if (isRaining) {
        h.hydration = clamp(h.hydration + 14.0 * dtHours, 0, 100);
      } else {
        h.hydration = clamp(h.hydration - 5.0 * dtHours, 0, 100);
      }

      // Eat from trough if hungry (loop handles larger offline substeps cleanly)
      let guard = 0;
      while (h.hunger <= 62 && guard++ < 6) {
        const gained = consumeOneFeedFromTroughs(r, pen.troughs);
        if (gained <= 0) break;
        h.hunger = clamp(h.hunger + gained, 0, 100);
      }

      guard = 0;
      while (h.hydration <= 62 && !isRaining && guard++ < 6) {
        const gained = consumeOneWaterFromPen(r, pen.troughs, pen.barrels);
        if (gained <= 0) break;
        h.hydration = clamp(h.hydration + gained, 0, 100);
      }

      // Malnutrition floors HP at 25% maxHp (never conjures free yield, never deletes penned livestock unfairly)
      if (h.hunger <= 0 || h.hydration <= 0) {
        m.hp = Math.max(Math.ceil(m.maxHp * 0.25), m.hp - 1.5 * dtHours);
        continue;
      }

      // Healthy & fed -> slowly mend bruises
      if (h.hunger >= 50 && h.hydration >= 50 && m.hp < m.maxHp) {
        m.hp = Math.min(m.maxHp, m.hp + 4.0 * dtHours);
      }

      // 2. Juvenile -> Adult growth (6 hours of sustained feed & water)
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

      // 3. Adult passive yield into trough (requires sustained feed & water >= 35 and trough slot space)
      const yieldSpec = HUSBANDRY_YIELDS[m.type];
      if (yieldSpec && h.hunger >= 35 && h.hydration >= 35 && pen.troughs.length > 0) {
        h.produceProgress += dtHours / yieldSpec.cycleHours;
        while (h.produceProgress >= 1) {
          const ok = depositIntoTroughs(r, pen.troughs, yieldSpec.primary[0], yieldSpec.primary[1]);
          if (!ok) {
            h.produceProgress = 0.99; // Trough full — pause cleanly without losing progress or littering lag bags
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

    // 4. Breeding: 2+ well-fed, watered adults of the same species in an enclosed pen with free capacity
    const bySpecies = new Map<string, Creature[]>();
    for (const m of members) {
      const h = m.husbandry!;
      if (h.stage === 'adult' && h.hunger >= 45 && h.hydration >= 45) {
        let arr = bySpecies.get(m.type);
        if (!arr) { arr = []; bySpecies.set(m.type, arr); }
        arr.push(m);
      }
    }

    let currentTotal = members.length;
    for (const [species, adults] of bySpecies.entries()) {
      if (adults.length < 2 || currentTotal >= pen.capacity) continue;
      const pA = adults[0], pB = adults[1];
      pA.husbandry!.breedProgress += dtHours / 8.0;
      pB.husbandry!.breedProgress = pA.husbandry!.breedProgress;
      if (pA.husbandry!.breedProgress >= 1 && currentTotal < pen.capacity) {
        pA.husbandry!.breedProgress = 0;
        pB.husbandry!.breedProgress = 0;
        pA.husbandry!.hunger = clamp(pA.husbandry!.hunger - 22, 0, 100);
        pB.husbandry!.hunger = clamp(pB.husbandry!.hunger - 22, 0, 100);
        pA.husbandry!.hydration = clamp(pA.husbandry!.hydration - 18, 0, 100);
        pB.husbandry!.hydration = clamp(pB.husbandry!.hydration - 18, 0, 100);

        const def = CREATURES[species];
        const bx = clamp((pA.x + pB.x) * 0.5, TILE * 2, (WW - 2) * TILE);
        const by = clamp((pA.y + pB.y) * 0.5, TILE * 2, (WH - 2) * TILE);
        const baby: Creature = {
          id: uid(r, 'm'),
          type: species,
          x: bx,
          y: by,
          hp: Math.max(8, Math.round(def.hp * 0.6)),
          maxHp: def.hp,
          homeX: bx,
          homeY: by,
          state: 'wander',
          t: 0.8,
          tx: bx,
          ty: by,
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
          },
        };
        newborns.push(baby);
        currentTotal += 1;
      }
    }
  }

  for (const nb of newborns) {
    r.creatures.push(nb);
  }
}
