/**
 * Soul of Hero — THE LAST HUMANITY: authoritative run-local human society.
 *
 * One `HumanWorld` ledger lives on `RunState.humanWorld`. It is the SINGLE authority for every
 * human actor: identity, body, needs, custody, work, relations, incidents, combat state, companion
 * consent, evacuation and terminal outcome. Humans are NOT Creatures, NOT inventory items and NOT
 * cloned local entities. The ledger is projected into the active window exactly once per actor; the
 * renderer only draws the projection.
 *
 * Design law (Survivor Contract §§28–38 + Creator activation):
 *  - Veyra is humanity's last island; humans are a finite living workforce, not loot boxes.
 *  - Four source-authority classes: PLAYER_EXPLORATION (G1B + authored caches — NPCs never touch),
 *    SHARED_HARVEST (extractable nodes with real stock/regrowth), REGIONAL_HUMAN_ECONOMY (community
 *    stock), SPECIAL_AUTHORITY (Cores/cards/escrow). A source mints through exactly one class.
 *  - Real-hour needs (336h run); no 24-minute-sunrise ration. No invisible pantry, no teleport, no
 *    fabricated offscreen raid/death. Unprovable distant events stay PENDING with a reason.
 *  - One actor, one terminal outcome (EVACUATED | SURVIVED_ON_ISLAND | DEAD | UNRESOLVED).
 *  - Legacy runs without `humanWorld` remain solo-compatible; new runs seed finite source-authorized
 *    humans. No retroactive population/loot mint on old saves.
 */
import { BAL, TILE, WW, WH, HOUR, clamp, uid, type RunState, type Stack, type Container, type Entity, type Dir, type Creature } from './core';
import { RECIPES, ITEMS, ARMOR_CAP, wornProtection, CREATURES, ELDERS, lookupElderDef, PRIMORDIAL_ELDERS } from './catalog';
import { addItem, addStack, mkStack, mkContainer, receipt, pushLog, spawnDrop, C, sourceAt, effTile, entsAt, blockGrid, clearPhysicalLine, isSheltered, roofRoom } from './engine';
import { rngNext, mulberry, hash2 } from './core';
import { phaseOf, isRagnarok, runHours } from './engine';
import { executeHumanWork, planHumanOccupation, type HumanWorkTask } from './human-jobs';
import { humanShelter } from './human-shelter';
import { liveItemId, liveItemPer } from './final-item-set';

export const HUMAN_WORLD_VERSION = 'human-world-v1';

// ---------------------------------------------------------------------------
// Authority classes
// ---------------------------------------------------------------------------
export type SourceAuthority = 'PLAYER_EXPLORATION' | 'SHARED_HARVEST' | 'REGIONAL_HUMAN_ECONOMY' | 'SPECIAL_AUTHORITY';

// ---------------------------------------------------------------------------
// Occupations (the eight approved production roles)
// ---------------------------------------------------------------------------
export type Occupation = 'salvager' | 'mechanic' | 'cook' | 'gardener' | 'medic' | 'guard' | 'engineer' | 'builder';

// ---------------------------------------------------------------------------
// Physical/combat profiles (SOH_PROVISIONAL — independent of occupation & clothing)
// ---------------------------------------------------------------------------
export type ProfileKey = 'civilian' | 'laborer' | 'traveler' | 'guard' | 'raider' | 'veteran';
export interface Profile { maxHp: number; maxStamina: number; speed: number; }
export const PROFILES: Record<ProfileKey, Profile> = {
  civilian: { maxHp: 80, maxStamina: 85, speed: 68 },
  laborer: { maxHp: 95, maxStamina: 100, speed: 70 },
  traveler: { maxHp: 90, maxStamina: 105, speed: 76 },
  guard: { maxHp: 110, maxStamina: 110, speed: 72 },
  raider: { maxHp: 105, maxStamina: 110, speed: 76 },
  veteran: { maxHp: 125, maxStamina: 120, speed: 72 },
};

// ---------------------------------------------------------------------------
// Site classification (from the 81-POI / 811-space census geometry)
// ---------------------------------------------------------------------------
export type SiteClass = 'HABITABLE_COMMUNITY' | 'WORK_SITE' | 'TRADE_OR_TRANSIT' | 'HOSTILE_OR_DANGEROUS' | 'ABANDONED' | 'INACCESSIBLE_OR_UNVERIFIED';

// ---------------------------------------------------------------------------
// Human actor
// ---------------------------------------------------------------------------
export type HumanState = 'IDLE' | 'MOVING' | 'WORKING' | 'FIGHTING' | 'DOWNED' | 'DEAD' | 'EVACUATED' | 'BLOCKED';
export type HumanDisposition = 'protective' | 'neutral' | 'opportunistic' | 'predatory';
export type TerminalOutcome = 'EVACUATED' | 'SURVIVED_ON_ISLAND' | 'DEAD' | 'UNRESOLVED';

export interface HumanEquipSlots { head: Stack | null; body: Stack | null; legs: Stack | null; feet: Stack | null; weapon: Stack | null; }
/** Humans store only container IDs in the ledger — the containers themselves live in run custody.
 *  This keeps ONE reference after JSON save/reload (never two distinct objects that desync). */
export interface HumanInventory { packId: string; cartId: string; }
/** Resolve a human's pack container from run custody (the single authoritative reference). */
export function humanPack(r: RunState, h: HumanRecord): Container { return r.custody[h.inv.packId]!; }
/** Resolve a human's cart container from run custody. */
export function humanCart(r: RunState, h: HumanRecord): Container { return r.custody[h.inv.cartId]!; }
export interface HumanCore { uid: string; lvl: 1 | 2 | 3; dur: number; cd: { basic?: number; refined?: number; signature?: number }; }
export interface HumanWound { severity: number; bleeding: boolean; bleedingUntil?: number; treated: boolean; }
export interface HumanKnowledge {
  observedSources: string[];
  witnesses: string[];        // actorIds who witnessed an incident with this actor
  incidents: string[];        // incident ids this actor knows about
  knownPeople: string[];      // actorIds known
  playerHomeKnown: boolean;   // whether the actor has physically observed the player's base
}
export interface HumanIntent {
  work?: HumanWorkTask;
  intentId: string;
  actorId: string;
  kind: 'work' | 'move' | 'trade' | 'fight' | 'rest' | 'eat' | 'drink' | 'follow' | 'idle' | 'evacuate' | 'pursue';
  target?: string;            // sourceId / actorId / stationId / tripId
  preconditions: string[];
  reserved: string[];         // reserved resource/source ids
  startAt: number;
  dueAt: number;
  route?: { tx: number; ty: number; floor: number }[];
  commitReceipt?: string;
  blockReason?: string;
}
export interface HumanIncident {
  id: string;
  kind: 'assault' | 'theft' | 'robbery' | 'murder' | 'witness' | 'rescue' | 'trade';
  victim?: string;
  aggressor?: string;
  witnesses: string[];
  at: number;
  place: { tx: number; ty: number; floor: number };
  property?: string[];        // item UIDs / source ids involved
  injury?: boolean;
  death?: boolean;
  resolved: boolean;
}
export interface HumanRecord {
  actorId: string;
  runId: string;
  sourceId: string;           // unique originating source (finite arrival / community member)
  name: string;
  appearance: number;         // 0..5 MetroCity base sheet
  profile: ProfileKey;
  occupation: Occupation;
  combatProficiency: 0 | 1 | 2 | 3;   // untrained/trained/skilled/specialist
  disposition: HumanDisposition;
  // body / position
  gx: number; gy: number;      // global tile coords
  floor: number;
  dir: Dir;
  hp: number; maxHp: number;
  stamina: number; maxStamina: number;
  hunger: number; thirst: number; warmth: number; rad: number;
  rest: number;               // rest debt accumulator (0..1)
  wounds: HumanWound[];
  state: HumanState;
  downedAt?: number;
  deadAt?: number;
  evacuatedAt?: number;
  outcome?: TerminalOutcome;
  // identity / belongings
  home?: string;              // community id
  bedId?: string;
  community?: string;
  origin?: string;            // arrival source id
  equip: HumanEquipSlots;
  inv: HumanInventory;
  core?: HumanCore;
  // social / knowledge
  disposition_known: HumanKnowledge;
  protectedPeople: string[];  // actorIds this human will not harm
  // action
  intent?: HumanIntent;
  lastCommittedAt: number;
  lastSimAt: number;
  // companion
  following?: boolean;
  followOrder?: { orderId: string; result: OrderResult; reason: string; at: number };
  /** Persistent social standing with the player; changes only through witnessed social acts. */
  trust?: number;
  lastAttackAt?: number;
  lastDamageAt?: number;
  /** Throttled autonomous planner; movement interpolation is presentation of the tile-legal route. */
  nextThinkAt?: number;
  motion?: { fromGx: number; fromGy: number; toGx: number; toGy: number; elapsedMs: number; updatedAt?: number };
  workOutputs?: Record<string, number>;
  knownRecipes?: string[];
  patrolPostIndex?: number;
  lastWatchAt?: number;
  guardedEntityId?: string;
  nextPerceptionAt?: number;
  lastTalkAt?: number;
  lastWorkBlock?: string;
  tradeTrustReceipts?: Record<string, number>;
  confrontationAttempt?: { scene: string; at: number; attempts: number; demand: string; reaction: string; message: string };
}
export interface Community {
  id: string;
  poi: string;
  class: SiteClass;
  homeBeds: string[];         // bed container ids assigned
  waterSources: string[];     // source ids
  foodStores: string[];       // container ids
  workStations: string[];     // station entity ids
  storeContainers: string[];  // community store container ids
  /** Global tile backing the physical store entity and access check. */
  storeTile?: [number, number];
  storeEntityId?: string;
  memberIds: string[];
  threat: number;             // 0..1 local threat level
}
export interface ArrivalToken {
  sourceId: string;
  poi: string;
  at: number;
  consumed: boolean;
}
export interface EvacTrip {
  tripId: string;
  site: 'po_evac_west' | 'po_evac_south' | 'po_evac_hook';
  capacity: number;
  siteGx: number; siteGy: number;   // real boarding tile (from the POI bbox center)
  boarded: string[];          // actorIds
  departAt?: number;
  departed: boolean;
  receipt?: string;
}
export interface ElderAssault {
  elderId: string;            // Surtur/Typhon/Aion/Atlas/Argus/Anubis
  alive: boolean;
  awakenedAt?: number;
  lairGx: number; lairGy: number; lairFloor: number;
  routeTargets: { poi: string; gx: number; gy: number; floor: number; at: number }[];
  lastAttackAt?: number;
  defeatedAt?: number;
}
export interface HumanEvent {
  id: string;
  at: number;
  kind: string;
  detail: string;
  actorId?: string;
  resolved: boolean;
}
export interface HumanWorld {
  version: string;
  sourceLayout: number;
  people: Record<string, HumanRecord>;
  communities: Record<string, Community>;
  arrivals: Record<string, ArrivalToken>;
  evacuation: Record<string, EvacTrip>;
  elderPressure: Record<string, ElderAssault>;
  events: Record<string, HumanEvent>;
  incidents: Record<string, HumanIncident>;
  /** Legacy needs-clock field retained for save compatibility. */
  lastResolvedAt: number;
  /** Independent clocks prevent needs advancement from suppressing autonomous movement. */
  lastNeedsAt?: number;
  lastStepAt?: number;
  plannerCursor?: number;
  plannerAt?: number;
  nextActorSeq: number;
  nextIncidentSeq?: number;
}

// ---------------------------------------------------------------------------
// Companion order resolution (exact 5-way result)
// ---------------------------------------------------------------------------
export type OrderResult = 'OBEY' | 'REFUSE_WITH_REASON' | 'PROTECT_TARGET' | 'RETREAT_OR_HOLD' | 'CANNOT_EXECUTE';

// ---------------------------------------------------------------------------
// Ledger construction
// ---------------------------------------------------------------------------
export function newHumanWorld(runId: string, now: number): HumanWorld {
  // lastResolvedAt is seeded from the run-authoritative timestamp so the FIRST tick does not
  // compute a catastrophic (now - 0) delta that instantly zeroes hunger/thirst and downs people.
  return {
    version: HUMAN_WORLD_VERSION,
    sourceLayout: 1,
    people: {},
    communities: {},
    arrivals: {},
    evacuation: {},
    elderPressure: {},
    events: {},
    incidents: {},
    lastResolvedAt: now,
    lastNeedsAt: now,
    lastStepAt: now,
    nextActorSeq: 1,
  };
}

/** Seed the three evacuation trips (one per service site) with their real boarding tiles. */
export function seedEvacTrips(hw: HumanWorld, positions: Record<string, [number, number]>): void {
  for (const site of ['po_evac_west', 'po_evac_south', 'po_evac_hook'] as const) {
    const tripId = `evac:${site}`;
    const [gx, gy] = positions[site] ?? [0, 0];
    hw.evacuation[tripId] = { tripId, site, capacity: 6, siteGx: gx, siteGy: gy, boarded: [], departed: false };
  }
}

/** Seed the six canonical Elder assault authorities from the catalog. */
export function seedElderPressure(
  hw: HumanWorld,
  lairGx: number,
  lairGy: number,
  lairFloor: number,
  lairs?: Record<string, { gx: number; gy: number; floor: number }>,
): void {
  for (const id of Object.keys(PRIMORDIAL_ELDERS)) {
    const loc = lairs?.[id] ?? { gx: lairGx, gy: lairGy, floor: lairFloor };
    hw.elderPressure[id] = { elderId: id, alive: true, lairGx: loc.gx, lairGy: loc.gy, lairFloor: loc.floor, routeTargets: [] };
  }
}

// ---------------------------------------------------------------------------
// Deterministic appearance / naming
// ---------------------------------------------------------------------------
const APPEARANCE_NAMES = ['metrocity_0', 'metrocity_1', 'metrocity_2', 'metrocity_3', 'metrocity_4', 'metrocity_5'];
const REGION_NAMES = ['Veyran', 'Coastal', 'Highland', 'Frontier', 'Delta', 'Argus', 'Ironholm', 'Meridian'];
const ROLE_BY_OCC: Record<Occupation, string> = {
  salvager: 'Salvager', mechanic: 'Mechanic', cook: 'Cook', gardener: 'Gardener',
  medic: 'Medic', guard: 'Guard', engineer: 'Engineer', builder: 'Builder',
};

/** Deterministic actor name + appearance from sourceId (stable across reload). */
export function humanIdentity(sourceId: string, seq: number): { name: string; appearance: number } {
  const r = mulberry(hashInt(sourceId) ^ (seq * 2654435761));
  const surname = REGION_NAMES[Math.floor(r() * REGION_NAMES.length)];
  const given = ROLE_BY_OCC[OCCUPATIONS_LIST[Math.floor(r() * OCCUPATIONS_LIST.length)]];
  return { name: `${given} ${surname}`, appearance: Math.floor(r() * 6) };
}
const OCCUPATIONS_LIST: Occupation[] = ['salvager', 'mechanic', 'cook', 'gardener', 'medic', 'guard', 'engineer', 'builder'];
function hashInt(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

// ---------------------------------------------------------------------------
// Actor creation
// ---------------------------------------------------------------------------
export function makeHuman(r: RunState, hw: HumanWorld, opts: {
  sourceId: string; gx: number; gy: number; floor: number; profile: ProfileKey;
  occupation: Occupation; disposition: HumanDisposition; proficiency: 0 | 1 | 2 | 3;
  community?: string; home?: string; bedId?: string;
  equip?: Partial<HumanEquipSlots>; startingPack?: [string, number][]; core?: HumanCore;
  protectedPeople?: string[];
}): HumanRecord {
  const seq = hw.nextActorSeq++;
  const id = `h${seq.toString(36)}`;
  const { name, appearance } = humanIdentity(opts.sourceId, seq);
  const P = PROFILES[opts.profile];
  const invPack = mkContainer(r, 'bag', 12);
  const invCart = mkContainer(r, 'cart', 6);
  for (const [k, q] of opts.startingPack ?? []) addItem(r, invPack.id, k, q);
  const equip: HumanEquipSlots = { head: null, body: null, legs: null, feet: null, weapon: null, ...opts.equip };
  const h: HumanRecord = {
    actorId: id, runId: r.id, sourceId: opts.sourceId, name, appearance,
    profile: opts.profile, occupation: opts.occupation, combatProficiency: opts.proficiency,
    disposition: opts.disposition,
    gx: opts.gx, gy: opts.gy, floor: opts.floor, dir: 0,
    hp: P.maxHp, maxHp: P.maxHp, stamina: P.maxStamina, maxStamina: P.maxStamina,
    hunger: 80, thirst: 80, warmth: 100, rad: 0, rest: 0,
    wounds: [], state: 'IDLE',
    home: opts.home, bedId: opts.bedId, community: opts.community, origin: opts.sourceId,
    equip, inv: { packId: invPack.id, cartId: invCart.id },
    core: opts.core,
    disposition_known: { observedSources: [], witnesses: [], incidents: [], knownPeople: [], playerHomeKnown: false },
    protectedPeople: opts.protectedPeople ?? [],
    trust: 50,
    knownRecipes: opts.occupation === 'cook' ? Object.keys(RECIPES).filter(k => RECIPES[k].station === 'campfire' && RECIPES[k].tier <= 1 && ITEMS[RECIPES[k].out]?.food) : [],
    lastCommittedAt: r.clock.lastSimAt, lastSimAt: r.clock.lastSimAt,
  };
  hw.people[id] = h;
  return h;
}

/** Armor protection from a human's equipped slots (same law as player: cap 0.60). */
export function humanArmor(h: HumanRecord): { armor: number; steady: number; ground: number } {
  return wornProtection([h.equip.head, h.equip.body, h.equip.legs, h.equip.feet]);
}

/** Effective weapon damage/swing for a human's equipped weapon (same item law as player). */
export function humanWeapon(h: HumanRecord): { dmg: number; reach: number; arc: number; swing: number; dur: number } | null {
  const w = h.equip.weapon; if (!w) return null;
  const d = ITEMS[w.key]; if (!d || d.dmg == null) return null;
  return { dmg: d.dmg, reach: d.reach ?? 22, arc: d.arc ?? 1.4, swing: d.swing ?? 400, dur: d.dur ?? 200 };
}

/** Proficiency handling modifier on windup/recovery (NOT damage). */
export function proficiencyMul(p: 0 | 1 | 2 | 3): number {
  return p === 0 ? 1.15 : p === 1 ? 1.0 : p === 2 ? 0.92 : 0.85;
}

export { OCCUPATIONS_LIST };

// ---------------------------------------------------------------------------
// Population seeding — deterministic classification of the 81 POIs from the
// compiled census geometry + the physical-audit archetype. Density derives from
// real settlement function, capacity and danger — NOT one NPC per POI.
// ---------------------------------------------------------------------------
/** Full physical classification of every census archetype (24 observed). Each maps to a
 *  settlement FUNCTION, not a population quota. ABANDONED / INACCESSIBLE_OR_UNVERIFIED are
 *  legitimate empties — they are NOT defaulted-to-empty by an unrecognized archetype. */
const ARCH_CLASS: Record<string, SiteClass> = {
  // settlements
  village: 'HABITABLE_COMMUNITY',
  hamlet: 'HABITABLE_COMMUNITY',
  grove: 'HABITABLE_COMMUNITY',
  // trade & transit
  port: 'TRADE_OR_TRANSIT',
  pier: 'TRADE_OR_TRANSIT',
  warehouse: 'TRADE_OR_TRANSIT',
  roadstop: 'TRADE_OR_TRANSIT',
  chest_vendor: 'TRADE_OR_TRANSIT',
  gate: 'TRADE_OR_TRANSIT',
  evac: 'TRADE_OR_TRANSIT',
  // work sites
  mine: 'WORK_SITE',
  quarry: 'WORK_SITE',
  smelter: 'WORK_SITE',
  sawmill: 'WORK_SITE',
  mill: 'WORK_SITE',
  powerplant: 'WORK_SITE',
  facility: 'WORK_SITE',
  research: 'WORK_SITE',
  observatory: 'WORK_SITE',
  // hostile / dangerous
  tomb: 'HOSTILE_OR_DANGEROUS',
  elder_site: 'HOSTILE_OR_DANGEROUS',
  // abandoned
  ruins: 'ABANDONED',
  ragnarok_cache: 'ABANDONED',
  // unverified / inaccessible
  filter: 'INACCESSIBLE_OR_UNVERIFIED',
};

/** A deterministic community roster template by site class. Each site class gets a
 *  physically-justified set of occupations; count scales with compiled room count. */
function rosterFor(cls: SiteClass, rooms: number, rng: () => number): { occ: Occupation; profile: ProfileKey; disp: HumanDisposition; prof: 0 | 1 | 2 | 3 }[] {
  const base: Record<SiteClass, { occ: Occupation; profile: ProfileKey; disp: HumanDisposition; prof: 0 | 1 | 2 | 3 }[]> = {
    HABITABLE_COMMUNITY: [
      { occ: 'guard', profile: 'guard', disp: 'protective', prof: 2 },
      { occ: 'cook', profile: 'laborer', disp: 'neutral', prof: 1 },
      { occ: 'gardener', profile: 'laborer', disp: 'neutral', prof: 1 },
      { occ: 'medic', profile: 'laborer', disp: 'protective', prof: 1 },
      { occ: 'mechanic', profile: 'laborer', disp: 'neutral', prof: 1 },
      { occ: 'builder', profile: 'laborer', disp: 'neutral', prof: 1 },
      { occ: 'salvager', profile: 'laborer', disp: 'neutral', prof: 1 },
    ],
    WORK_SITE: [
      { occ: 'mechanic', profile: 'laborer', disp: 'neutral', prof: 2 },
      { occ: 'engineer', profile: 'laborer', disp: 'neutral', prof: 2 },
      { occ: 'salvager', profile: 'laborer', disp: 'neutral', prof: 1 },
      { occ: 'guard', profile: 'guard', disp: 'protective', prof: 1 },
    ],
    TRADE_OR_TRANSIT: [
      { occ: 'salvager', profile: 'traveler', disp: 'neutral', prof: 1 },
      { occ: 'mechanic', profile: 'traveler', disp: 'opportunistic', prof: 1 },
      { occ: 'guard', profile: 'guard', disp: 'protective', prof: 1 },
    ],
    HOSTILE_OR_DANGEROUS: [
      { occ: 'guard', profile: 'raider', disp: 'predatory', prof: 2 },
      { occ: 'salvager', profile: 'raider', disp: 'predatory', prof: 1 },
    ],
    ABANDONED: [],
    INACCESSIBLE_OR_UNVERIFIED: [],
  };
  const list = base[cls].slice();
  // scale: a community with more rooms may host a couple more hands, but bounded and finite
  const extra = cls === 'HABITABLE_COMMUNITY' ? Math.min(3, Math.floor(rooms / 8)) : 0;
  for (let i = 0; i < extra; i++) list.push({ ...list[i % list.length], profile: list[i % list.length].profile });
  // shuffle deterministically
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

/** Starting personal gear per occupation — finite, registered, physically justified.
 *  All item ids are LIVE catalog ids. Water flasks start with full charge (4 drinks). */
function startingGear(occ: Occupation, profile: ProfileKey): { equip?: Partial<HumanEquipSlots>; pack?: [string, number][] } {
  const gear: Record<Occupation, { equip?: Partial<HumanEquipSlots>; pack?: [string, number][] }> = {
    salvager: { equip: { weapon: null }, pack: [['knife', 1], ['cloth', 2], ['spares', 2]] },
    mechanic: { equip: { weapon: { uid: '', key: 'stone_pick', qty: 1, dur: 150 } as any }, pack: [['spares', 3], ['charcoal', 2]] },
    cook: { pack: [['berries', 4], ['charcoal', 2]] },
    gardener: { pack: [['seed', 3], ['water_flask', 1]] },
    medic: { pack: [['herb', 4], ['bandage', 2]] },
    guard: { equip: { weapon: { uid: '', key: 'wood_club', qty: 1, dur: 100 } as any, body: { uid: '', key: 'leather_armor', qty: 1 } as any }, pack: [['arrow', 6]] },
    engineer: { equip: { weapon: { uid: '', key: 'stone_pick', qty: 1, dur: 120 } as any }, pack: [['spares', 4], ['charcoal', 2]] },
    builder: { equip: { weapon: { uid: '', key: 'stone_axe', qty: 1, dur: 120 } as any }, pack: [['wood', 4], ['stone', 2]] },
  };
  void profile;
  return gear[occ];
}

/** Class-appropriate finite starting stock for a community. Varies by settlement function —
 *  NOT one identical pantry for every site. Water access is real (water_flask charge). */
function communityStock(cls: SiteClass, rooms: number): Record<string, number> {
  const base: Record<SiteClass, Record<string, number>> = {
    HABITABLE_COMMUNITY: { berries: 14, charcoal: 8, spares: 5, water_flask: 3, seed: 5, herb: 3, bandage: 2 },
    WORK_SITE: { spares: 10, charcoal: 8, water_flask: 4, wood: 6, stone: 4 },
    TRADE_OR_TRANSIT: { spares: 6, water_flask: 4, berries: 6, cloth: 3 },
    HOSTILE_OR_DANGEROUS: { water_flask: 2, berries: 4, arrow: 8 },
    ABANDONED: {},
    INACCESSIBLE_OR_UNVERIFIED: {},
  };
  const s = { ...base[cls] };
  // scale food/water stock mildly with room count (bounded, finite)
  const m = Math.min(2, Math.floor(rooms / 12));
  if (m > 0) { s.berries = (s.berries ?? 0) + 2 * m; s.water_flask = (s.water_flask ?? 0) + m; }
  return s;
}

/** Classify a POI from its archetype and seed a finite community.
 *  `sites` carries authored global bounds plus walkable room-interior spawn tiles. */
export function seedPopulation(r: RunState, hw: HumanWorld, sites: { id: string; name: string; archetype: string; rooms: number; bbox: [number, number, number, number]; spawnTiles?: [number, number][]; stationTiles?: { gx: number; gy: number; struct: string }[] }[], elderLairs?: Record<string, { gx: number; gy: number; floor: number }>, authoredEvacPositions?: Record<string, [number, number]>): void {
  // Boarding coordinates are global and keyed by authored POI identity, never active-window order.
  const evacPositions: Record<string, [number, number]> = { ...(authoredEvacPositions ?? {}) };
  if (!authoredEvacPositions) {
    const o = r.sourceMap?.veyra?.originAu;
    const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
    for (const e of Object.values(r.entities)) {
      if (e.kind === 'evac' && e.poi && e.tx !== undefined && e.ty !== undefined) evacPositions[e.poi] = [e.tx + ox, e.ty + oy];
    }
  }
  seedEvacTrips(hw, evacPositions);
  // Elder lair: use a real elder_site POI bbox center when present, else a fixed lair.
  const elderSite = sites.find(s => s.archetype === 'elder_site');
  const lair = elderSite ? [Math.round((elderSite.bbox[0] + elderSite.bbox[2]) / 2), Math.round((elderSite.bbox[1] + elderSite.bbox[3]) / 2), 0] : [0, 0, 0];
  seedElderPressure(hw, lair[0], lair[1], lair[2], elderLairs);
  const rng = mulberry(r.seed ^ 0x9e3779b9);
  const occupiedSpawnTiles = new Set<string>();
  for (const site of sites) {
    const cls = ARCH_CLASS[site.archetype] ?? 'INACCESSIBLE_OR_UNVERIFIED';
    if (cls === 'ABANDONED' || cls === 'INACCESSIBLE_OR_UNVERIFIED') {
      // Legitimate empty: record the classification, no population, no stock.
      hw.communities[site.id] = { id: site.id, poi: site.id, class: cls, homeBeds: [], waterSources: [], foodStores: [], workStations: [], storeContainers: [], memberIds: [], threat: 0 };
      continue;
    }
    const tiles = site.spawnTiles ?? [];
    const storeTile = tiles.find(([gx, gy]) => !occupiedSpawnTiles.has(`${gx},${gy}`));
    if (!storeTile) {
      hw.communities[site.id] = { id: site.id, poi: site.id, class: 'INACCESSIBLE_OR_UNVERIFIED', homeBeds: [], waterSources: [], foodStores: [], workStations: [], storeContainers: [], memberIds: [], threat: 0 };
      continue;
    }
    occupiedSpawnTiles.add(`${storeTile[0]},${storeTile[1]}`);
    // Community store (finite stock, registered origin) is a real container on a real POI tile.
    const communityId = `com:${site.id}`;
    const store = mkContainer(r, 'bag', 10);
    store.origin = { authority: 'REGIONAL_HUMAN_ECONOMY', sourceId: `regional-human-economy:${site.id}` };
    const bed = mkContainer(r, 'chest', 4);
    const stock = communityStock(cls, site.rooms);
    for (const [k, q] of Object.entries(stock)) addItem(r, store.id, k, q);
    const comm: Community = {
      id: communityId, poi: site.id, class: cls, homeBeds: [bed.id],
      waterSources: [store.id],  // physical container custody is the only stock authority
      foodStores: [store.id],
      workStations: [],
      storeContainers: [store.id], storeTile, memberIds: [], threat: cls === 'HOSTILE_OR_DANGEROUS' ? 0.7 : 0.2,
    };
    const storeEntityId = uid(r, 'e');
    comm.storeEntityId = storeEntityId;
    const origin = r.sourceMap?.veyra?.originAu;
    const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
    const lx = storeTile[0] - ox, ly = storeTile[1] - oy;
    const storeEntity: Entity = { id: storeEntityId, kind: 'bag', x: storeTile[0] * TILE + 8, y: storeTile[1] * TILE + 8, tx: storeTile[0], ty: storeTile[1], c: store.id, label: `${site.name} Community Store`, poi: site.id };
    if (lx >= 1 && ly >= 1 && lx < WW - 1 && ly < WH - 1) {
      storeEntity.x = lx * TILE + 8; storeEntity.y = ly * TILE + 8; storeEntity.tx = lx; storeEntity.ty = ly;
      r.entities[storeEntity.id] = storeEntity;
    } else {
      (r.veyraOffscreenEntities ??= {})[storeEntity.id] = storeEntity;
    }
    hw.communities[communityId] = comm;
    // Materialize each authored production prop as a real, finite station entity with
    // its own custody; NPC work and player craft use the same station authority.
    for (const authored of site.stationTiles ?? []) {
      const key = `${authored.gx},${authored.gy}`;
      if (occupiedSpawnTiles.has(key)) continue;
      if (!['campfire', 'furnace', 'large_furnace', 'workbench'].includes(authored.struct)) continue;
      occupiedSpawnTiles.add(key);
      const stationId = uid(r, 'e');
      const station: Entity = {
        id: stationId, kind: 'struct', type: authored.struct, tx: authored.gx, ty: authored.gy,
        x: authored.gx * TILE + 8, y: authored.gy * TILE + 8, hp: 180, maxHp: 180,
        poi: site.id, label: `${site.name} ${authored.struct.replace('_', ' ')}`,
        station: { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 3).id, outC: mkContainer(r, 'out', 6).id },
      };
      const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
      const lx = authored.gx - ox, ly = authored.gy - oy;
      if (lx >= 1 && ly >= 1 && lx < WW - 1 && ly < WH - 1) {
        station.tx = lx; station.ty = ly; station.x = lx * TILE + 8; station.y = ly * TILE + 8;
        r.entities[stationId] = station;
      } else (r.veyraOffscreenEntities ??= {})[stationId] = station;
      comm.workStations.push(stationId);
    }
    // Seed humans at walkable room-interior tiles on the ground floor.
    const roster = rosterFor(cls, site.rooms, rng);
    const [bx0, by0, bx1, by1] = site.bbox;
    let placed = 0;
    for (const member of roster) {
      let spawn: [number, number] | undefined;
      const tiles = site.spawnTiles ?? [];
      for (let attempt = 0; attempt < 24 && tiles.length; attempt++) {
        const candidate = tiles[Math.floor(rng() * tiles.length)];
        if (!occupiedSpawnTiles.has(`${candidate[0]},${candidate[1]}`)) { spawn = candidate; break; }
      }
      if (tiles.length && !spawn) continue; // do not stack people when a physical room has no free cell
      const gx = spawn?.[0] ?? (bx0 + 2 + Math.floor(rng() * Math.max(1, (bx1 - bx0 - 4))));
      const gy = spawn?.[1] ?? (by0 + 2 + Math.floor(rng() * Math.max(1, (by1 - by0 - 4))));
      occupiedSpawnTiles.add(`${gx},${gy}`);
      const srcId = `${site.id}:human:${placed}`;
      const g = startingGear(member.occ, member.profile);
      const equip: Partial<HumanEquipSlots> = {};
      if (g.equip) for (const k of Object.keys(g.equip) as (keyof HumanEquipSlots)[]) {
        const st = (g.equip as any)[k]; if (st) { st.uid = uid(r, 's'); (equip as any)[k] = st; }
      }
      const h = makeHuman(r, hw, {
        sourceId: srcId, gx, gy, floor: 0, profile: member.profile,
        occupation: member.occ, disposition: member.disp, proficiency: member.prof,
        community: communityId, home: communityId, bedId: bed.id,
        equip, startingPack: g.pack,
      });
      comm.memberIds.push(h.actorId);
      placed++;
    }
  }
}

// ---------------------------------------------------------------------------
// Survival needs — REAL-hour clock (no 24-minute-sunrise ration).
// ---------------------------------------------------------------------------
/** A custody chest is not a sleeping slot. Assignment must resolve to one actual bed,
 * with a single living claimant physically resting beside it on the same floor. */
function usingHumanBed(r: RunState, hw: HumanWorld, h: HumanRecord): boolean {
  if (h.state !== 'IDLE' || !h.bedId || h.floor !== (r.veyraFloor ?? 0)) return false;
  const bed = r.entities[h.bedId];
  if (!bed || bed.type !== 'bed' || (bed.floor ?? 0) !== h.floor || (bed.hp ?? 1) <= 0) return false;
  if (Object.values(hw.people).some(other => other !== h && other.bedId === h.bedId && other.state !== 'DEAD' && other.state !== 'EVACUATED')) return false;
  const o = r.sourceMap?.veyra?.originAu;
  const x = (h.gx - (o ? Math.round(o[0] / 0.5) : 0) + 0.5) * TILE;
  const y = (h.gy - (o ? Math.round(o[1] / 0.5) : 0) + 0.5) * TILE;
  return Math.hypot(x - bed.x, y - bed.y) <= TILE * 1.5 && clearPhysicalLine(r, { x, y }, bed, true);
}

/** Advance hunger/thirst/rest/wounds for every active human by elapsed real time. */
export function tickNeeds(r: RunState, hw: HumanWorld, now: number): void {
  const lastNeedsAt = hw.lastNeedsAt ?? hw.lastResolvedAt;
  const dtMs = now - lastNeedsAt;
  if (dtMs < 1000) return; // biological events accrue exactly; resolve at one-second boundaries, not render frequency
  const hours = dtMs / HOUR;
  const hungerRate = BAL.player.offlineHungerPerHour;
  const thirstRate = BAL.player.offlineThirstPerHour;
  for (const h of Object.values(hw.people)) {
    if (h.state === 'DEAD' || h.state === 'EVACUATED') continue;
    // Active humans consume faster when working/fighting; distant use the baseline rate.
    const active = h.state === 'WORKING' || h.state === 'FIGHTING' || h.state === 'MOVING';
    const m = active ? 1.25 : 1.0;
    h.hunger = clamp(h.hunger - hungerRate * hours * m, 0, 100);
    h.thirst = clamp(h.thirst - thirstRate * hours * m, 0, 100);
    h.warmth = clamp(h.warmth - (humanShelter(r, h.gx, h.gy, h.floor) ? 0 : 0.4 * hours), 20, 100);
    if (h.hunger <= 0 || h.thirst <= 0) {
      // starvation / dehydration: HP drain, work stops
      const drain = ((h.hunger <= 0 ? BAL.player.starveDamagePerMin : 0) + (h.thirst <= 0 ? BAL.player.starveDamagePerMin : 0)) * (dtMs / 60000);
      if (drain > 0) applyDamage(r, hw, h, drain, 0, now, 'starvation', undefined, h.floor);
      if (h.hunger <= 0 || h.thirst <= 0) {
        if (h.intent?.kind === 'work') { h.intent.blockReason = h.hunger <= 0 ? 'too hungry to work' : 'too thirsty to work'; }
      }
    }
    // rest debt: grows when not resting on a bed
    if (!usingHumanBed(r, hw, h)) h.rest = clamp(h.rest + dtMs / HOUR / 8, 0, 1);
    else h.rest = clamp(h.rest - dtMs / HOUR / 4, 0, 1);
    // bleeding escalation (provisional: 8 min stabilize window, ~20 min fatal)
    for (const w of h.wounds) {
      if (w.bleeding && !w.treated && w.bleedingUntil && now > w.bleedingUntil) {
        // untreated severe bleeding escalates
        if (now - (w.bleedingUntil - 8 * 60000) > 20 * 60000) {
          applyDamage(r, hw, h, 60, 0, now, 'untreated_bleeding', undefined, h.floor);
          w.bleeding = false;
        }
      }
    }
  }
  hw.lastNeedsAt = now;
  // Keep the legacy serialized clock monotonic for older readers and migrations.
  hw.lastResolvedAt = now;
}

/** Permission is not physical access. Distant logistics must deliver goods via real routes. */
function reachableHumanStores(r: RunState, hw: HumanWorld, h: HumanRecord): Container[] {
  const comm = h.community ? hw.communities[h.community] : undefined;
  if (!comm?.storeEntityId || h.floor !== (r.veyraFloor ?? 0)) return [];
  const e = r.entities[comm.storeEntityId];
  if (!e || !e.c || !comm.foodStores.includes(e.c) || (e.floor ?? 0) !== h.floor) return [];
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  const from = { x: (h.gx - ox + 0.5) * TILE, y: (h.gy - oy + 0.5) * TILE };
  if (Math.hypot(from.x - e.x, from.y - e.y) > TILE * 1.5 || !clearPhysicalLine(r, from, e, true)) return [];
  return r.custody[e.c] ? [r.custody[e.c]] : [];
}

/** Eat/drink from carried or community stock (real item custody).
 *  Water is consumed by CHARGE (a flask holds N drinks), not by qty; an empty flask grants no thirst. */
export function humanConsume(r: RunState, hw: HumanWorld, h: HumanRecord, kind: 'food' | 'water', now: number): boolean {
  if (h.state === 'DEAD' || h.state === 'DOWNED' || h.state === 'EVACUATED' || (kind === 'food' ? h.hunger : h.thirst) >= 100) return false;
  const containers: Container[] = [humanPack(r, h)];
  containers.push(...reachableHumanStores(r, hw, h));
  for (const c of containers) {
    for (const s of c.slots) {
      if (!s || s.qty <= 0) continue;
      const d = ITEMS[s.key];
      if (kind === 'food' && d.food?.hunger) {
        const want = 100 - h.hunger;
        const got = Math.min(want, d.food.hunger);
        h.hunger = clamp(h.hunger + got, 0, 100);
        if (d.food.thirst) h.thirst = clamp(h.thirst + d.food.thirst, 0, 100);
        if (d.food.hp) h.hp = clamp(h.hp + d.food.hp, 0, h.maxHp);
        s.qty--; if (s.qty <= 0) { const i = c.slots.indexOf(s); c.slots[i] = null; }
        receipt(r, now, 'human.eat', `${h.actorId}:${s.key}`);
        return true;
      }
      if (kind === 'water' && (d.food?.thirst || d.waterContainer)) {
        // A water container grants thirst only while it has charge.
        if (d.charge != null && (s.charge ?? 0) <= 0) continue;
        const want = 100 - h.thirst;
        const per = d.food?.thirst ?? 30;
        const got = Math.min(want, per);
        h.thirst = clamp(h.thirst + got, 0, 100);
        if (d.charge != null) s.charge = Math.max(0, (s.charge ?? 0) - 1);
        else { s.qty--; if (s.qty <= 0) c.slots[c.slots.indexOf(s)] = null; }
        receipt(r, now, 'human.drink', `${h.actorId}:${s.key}`);
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Work — eight occupations through existing stations/sources (actor-aware, no player XP).
// ---------------------------------------------------------------------------
/** Actor-aware harvest: decrements real source stock, attaches output to the actor's pack,
 *  does NOT award player gather XP (the player-only `harvestHit` is never reused for humans). */
function simulateHumanOutput(slots: (Stack | null)[], yields: [string, number][]): boolean {
  const trial = slots.map(s => s ? { ...s } : null);
  for (const [rawKey, rawQty] of yields) {
    const key = liveItemId(rawKey), d = ITEMS[key]; let qty = Math.ceil(rawQty * liveItemPer(rawKey));
    const mergeable = d.max > 1 && !d.dur && !d.charge;
    if (mergeable) for (const s of trial) {
      if (!s || s.key !== key || s.meta !== undefined || s.dur !== undefined || s.charge !== undefined || qty <= 0) continue;
      const moved = Math.min(qty, d.max - s.qty); s.qty += moved; qty -= moved;
    }
    for (let i = 0; i < trial.length && qty > 0; i++) if (!trial[i]) {
      const moved = Math.min(qty, d.max); trial[i] = { uid: 'capacity-probe', key, qty: moved }; qty -= moved;
    }
    if (qty > 0) return false;
  }
  slots.splice(0, slots.length, ...trial);
  return true;
}
export function humanHarvest(r: RunState, hw: HumanWorld, h: HumanRecord, tx: number, ty: number, now: number): { result: 'yield' | 'empty' | 'none' | 'blocked'; got?: number; key?: string; reason?: string } {
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED') return { result: 'blocked', reason: 'actor unavailable' };
  const s = sourceAt(r, tx, ty, now);
  if (!s) return { result: 'none', reason: 'source unavailable' };
  // PLAYER_EXPLORATION sources are never depleted by NPC autonomous scavenging.
  if (isPlayerExplorationSource(r, s.key, tx, ty)) return { result: 'blocked', key: s.key, reason: 'player-exploration cache protected' };
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  const from = { x: (h.gx - ox + 0.5) * TILE, y: (h.gy - oy + 0.5) * TILE };
  const to = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
  if (h.floor !== (r.veyraFloor ?? 0) || tx < 0 || ty < 0 || tx >= WW || ty >= WH ||
      Math.hypot(from.x - to.x, from.y - to.y) > TILE * 1.5 || !clearPhysicalLine(r, from, to, true, true))
    return { result: 'blocked', key: s.key, reason: 'source is not physically reachable on this floor' };
  const st = r.sources[s.i] || (r.sources[s.i] = { stock: s.stock, hp: s.hp });
  if (st.stock <= 0) return { result: 'empty', key: s.key, reason: 'source depleted' };
  const tool = h.equip.weapon;
  const toolKey = tool?.key;
  if (h.stamina < 2 || tool?.dur !== undefined && tool.dur <= 0) return { result: 'blocked', key: s.key, reason: 'exhausted or broken tool' };
  // Hand-gatherable plants are real shared sources; solid timber/ore/scrap still require an equipped tool.
  const power = s.def.harvestBy ? (toolKey ? (s.def.harvestBy[toolKey] ?? 0) : 0) : (toolKey ? (ITEMS[toolKey]?.power?.[s.def.mat] ?? 0) : s.def.mat === 'plant' ? 1 : 0);
  if (power <= 0) return { result: 'blocked', key: s.key, reason: 'required tool is unavailable' };
  const per = s.def.hp / s.def.stock;
  const pack = humanPack(r, h);
  const oneUnitProbe = pack.slots.map(s => s ? { ...s } : null);
  if (!simulateHumanOutput(oneUnitProbe, s.def.yields.map(([k, q]) => [k, q] as [string, number]))) return { result: 'blocked', key: s.key, reason: 'pack full; no harvest was taken' };
  const before = Math.ceil(st.hp / per - 1e-9);
  const wouldAfter = Math.ceil(Math.max(0, st.hp - power) / per - 1e-9);
  const potentialUnits = Math.min(st.stock, before - wouldAfter);
  if (potentialUnits <= 0) {
    // A valid strike advances real source damage but releases no item yet. No stock or pack output is claimed.
    st.hp = Math.max(0, st.hp - power);
    h.stamina -= 2;
    if (tool?.dur !== undefined) { tool.dur = Math.max(0, tool.dur - 1); if (tool.dur === 0) h.equip.weapon = null; }
    receipt(r, now, 'human.work', `${h.actorId}:strike:${s.key}@${tx},${ty}`);
    return { result: 'yield', got: 0, key: s.key };
  }
  let acceptedUnits = 0;
  // Simulate successive units on a private copy. Never mutate custody during admission:
  // physical output is committed exactly once below, after source damage is bounded.
  const capacityProbe = pack.slots.map(s => s ? { ...s } : null);
  for (let n = 1; n <= potentialUnits; n++) {
    if (!simulateHumanOutput(capacityProbe, s.def.yields.map(([k, q]) => [k, q] as [string, number]))) break;
    acceptedUnits++;
  }
  if (acceptedUnits <= 0) return { result: 'blocked', key: s.key, reason: 'pack full; no harvest was taken' };
  // Limit source damage to the last whole unit that the real pack can admit.
  const desiredHp = Math.max(0, (before - acceptedUnits) * per);
  const hitPower = Math.min(power, Math.max(0, st.hp - desiredHp));
  if (hitPower <= 0) return { result: 'blocked', key: s.key, reason: 'source cannot release an admissible unit' };
  st.hp = Math.max(0, st.hp - hitPower);
  const after = Math.ceil(st.hp / per - 1e-9);
  const units = Math.min(st.stock, before - after, acceptedUnits);
  // The capacity simulation is against the same normalized addItem laws. Any mismatch is an invariant failure.
  let got = 0;
  for (let u = 0; u < units; u++) for (const [k, q] of s.def.yields) {
    const left = addItem(r, pack.id, k, q);
    if (left > 0) throw new Error(`human harvest capacity invariant: ${left} ${k} could not enter ${pack.id}`);
    got += Math.ceil(q * liveItemPer(k));
  }
  st.stock -= units;
  h.stamina -= 2;
  if (tool?.dur !== undefined) { tool.dur = Math.max(0, tool.dur - 1); if (tool.dur === 0) h.equip.weapon = null; }
  if (st.stock <= 0 && s.def.regrow) { st.regrowFrom = now; st.regrowAcc = 0; }
  receipt(r, now, 'human.harvest', `${h.actorId}:${s.key}@${tx},${ty}:-${units}`);
  return { result: 'yield', got, key: s.key };
}

/** Whether a source is a PLAYER_EXPLORATION authority (G1B chests + authored static loot caches).
 *  NPCs never deplete these — they are the player's exploration reward, not a shared harvest node. */
function isPlayerExplorationSource(r: RunState, key: string, tx: number, ty: number): boolean {
  // G1B chest sources are keyed by their g1b sid; any source sitting on a G1B chest tile is protected.
  for (const e of Object.values(r.entities)) {
    if (e.g1b && e.tx === tx && e.ty === ty) return true;
    // Authored static loot caches (kind 'loot', not G1B-derived) are also player exploration.
    if (e.kind === 'loot' && !e.g1b && e.tx === tx && e.ty === ty) return true;
  }
  for (const e of Object.values(r.g1b?.far ?? {})) {
    if (e.g1b && e.tx === tx && e.ty === ty) return true;
  }
  void key;
  return false;
}

/** Work is deliberately fail-closed until the occupation has an authored physical
 * station, real input bill, and output contract. Never mint items from an abstract stock mirror. */
export function humanWorkTick(r: RunState, hw: HumanWorld, h: HumanRecord, now: number): { done: boolean; reason?: string } {
  if (!h.intent || h.intent.kind !== 'work') return { done: false, reason: 'no work order' };
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED') return { done: false, reason: 'incapacitated' };
  if (h.hunger <= 5 || h.thirst <= 5) return { done: false, reason: h.hunger <= 5 ? 'too hungry' : 'too thirsty' };
  return executeHumanWork(r, hw, h, now);
}

// ---------------------------------------------------------------------------
// Combat — shared K5 hit/LOS/floor/weapon/armor/Core law. DOWNED != DEAD.
// ---------------------------------------------------------------------------
export type DamageSource = 'player' | 'enemy' | 'human' | 'hazard' | 'starvation' | 'untreated_bleeding';

/** Apply damage to a human with the same armor/floor/weapon law as player combat.
 *  Returns true if the hit landed. A hit that crosses zero HP DOWNS the human (not auto-kill);
 *  only a genuinely lethal follow-up or untreated severe wound finalizes DEAD.
 *  Floor verification: the target must be on the SAME floor as the active window floor (or the
 *  attacker's floor when the attacker is a creature on a different storey). */
export function applyDamage(r: RunState, hw: HumanWorld, h: HumanRecord, dmg: number, angle: number, now: number, source: DamageSource, attackerId?: string, attackerFloor?: number): boolean {
  if (!Number.isFinite(dmg) || dmg <= 0) return false;
  if (h.state === 'DEAD' || h.state === 'EVACUATED') return false;
  const activeFloor = r.veyraFloor ?? 0;
  const sourceFloor = attackerFloor ?? activeFloor;
  if (h.floor !== sourceFloor && source !== 'hazard') return false;
  const worn = humanArmor(h);
  const biological = source === 'starvation' || source === 'untreated_bleeding';
  dmg = biological ? dmg : Math.max(1, Math.round(dmg * (1 - worn.armor)));
  h.hp -= dmg;
  h.lastDamageAt = now;
  if (attackerId && attackerId !== h.actorId) {
    const incident = recordIncident(r, hw, {
      kind: 'assault', victim: h.actorId, aggressor: attackerId, witnesses: [], at: now,
      place: { tx: h.gx, ty: h.gy, floor: h.floor }, injury: true, resolved: false,
    }, now);
    formGrievance(r, hw, h, attackerId, now, incident.id);
  }
  if (h.hp <= 0) {
    if (h.state === 'DOWNED') killHuman(r, hw, h, now, source);
    else downHuman(r, hw, h, now, source, attackerId);
  }
  return true;
}

/** DOWN a human: alive, incapacitated, one corpse-bag custody from carried stock.
 *  Timestamps use real `now` (ms) consistently with wound/bleeding logic. */
export function downHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, source: DamageSource, attackerId?: string): void {
  if (h.state === 'DOWNED' || h.state === 'DEAD') return;
  h.state = 'DOWNED';
  h.downedAt = now;
  h.motion = undefined;
  h.intent = undefined;
  h.hp = Math.max(1, h.hp);
  h.wounds.push({ severity: 0.7, bleeding: source === 'enemy' || source === 'human', bleedingUntil: now + 20 * 60000, treated: false });
  receipt(r, now, 'human.down', `${h.actorId} by ${source}${attackerId ? ':' + attackerId : ''}`);
}

/** Stabilize / treat a downed human with real medicine (Medic/player approach + item custody). */
export function treatHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number): { ok: boolean; reason?: string } {
  if (h.state !== 'DOWNED') return { ok: false, reason: 'not downed' };
  const containers: Container[] = [humanPack(r, h)];
  containers.push(...reachableHumanStores(r, hw, h));
  let used = false;
  for (const c of containers) {
    for (const s of c.slots) {
      if (!s) continue;
      if (s.key === 'bandage' || s.key === 'herb') {
        for (const w of h.wounds) { w.treated = true; w.bleeding = false; }
        h.hp = clamp(h.hp + 30, 1, h.maxHp);
        s.qty--; if (s.qty <= 0) { const i = c.slots.indexOf(s); c.slots[i] = null; }
        used = true; break;
      }
    }
    if (used) break;
  }
  if (!used) return { ok: false, reason: 'no medicine reachable' };
  h.state = 'IDLE';
  h.downedAt = undefined;
  receipt(r, now, 'human.treat', `${h.actorId}`);
  return { ok: true };
}

/** Final death: permanent for the run. One recoverable corpse/bag with carried + equipped items.
 *  Uses addStack so every stack keeps its UID (no re-mint); equipped weapon/armor transfer too. */
export function killHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, cause: string): void {
  if (h.state === 'DEAD') return;
  h.state = 'DEAD';
  h.deadAt = now;
  h.motion = undefined; h.intent = undefined;
  h.hp = 0;
  h.outcome = 'DEAD';
  // One recoverable corpse bag entity (kind 'bag') with its own custody container.
  const corpseC = mkContainer(r, 'bag', humanPack(r, h).slots.length + 5);
  const origin = r.sourceMap?.veyra?.originAu;
  const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
  const lx = h.gx - ox, ly = h.gy - oy;
  const bag: Entity = { id: uid(r, 'e'), kind: 'bag', x: lx * TILE + 8, y: ly * TILE + 8, tx: lx, ty: ly, c: corpseC.id, born: now };
  bag.floor = h.floor;
  if (h.floor === (r.veyraFloor ?? 0) && lx >= 1 && ly >= 1 && lx < WW - 1 && ly < WH - 1) r.entities[bag.id] = bag;
  else (r.veyraOffscreenEntities ??= {})[bag.id] = { ...bag, x: h.gx * TILE + 8, y: h.gy * TILE + 8, tx: h.gx, ty: h.gy };
  {
    // Transfer carried/equipped stacks by moving the same object and UID. addStack is
    // intentionally unsuitable here because K1 correctly rejects a UID still owned
    // by the source container.
    const sources: (Stack | null)[] = [...humanPack(r, h).slots];
    for (const slot of ['weapon', 'body', 'head', 'legs', 'feet'] as const) sources.push(h.equip[slot]);
    let dest = 0;
    for (const stack of sources) if (stack) corpseC.slots[dest++] = stack;
  }
  humanPack(r, h).slots.fill(null);
  h.equip = { head: null, body: null, legs: null, feet: null, weapon: null };
  receipt(r, now, 'human.death', `${h.actorId}:${cause}`);
  pushLog(r, now, `${h.name} has fallen.`, 'red');
}

// ---------------------------------------------------------------------------
// Trade — real item exchange through K1 custody; refusal by state.
// ---------------------------------------------------------------------------
export type TradeResult = { ok: boolean; reason?: string; transferred?: number };
export interface HumanTradeEvaluation { ok: boolean; reason: string; offeredName?: string; requestedName?: string; offeredValue?: number; requestedValue?: number; ratio?: number; }
function humanTradeItemValue(s: Stack, recipient: HumanRecord): number {
  const d = ITEMS[s.key], qty = Math.max(1, Math.min(d.max, s.qty));
  let unit = d?.creatorCore ? 95 + (s.lvl ?? 1) * 20 : d?.dmg ? 9 + d.dmg : d?.food?.thirst ? 8 : d?.food?.hunger ? 6 : d?.repair || d?.salvage ? 9 : d?.max === 1 ? 8 : 3;
  if (d?.dur) unit *= Math.max(0.12, Math.min(1, (s.dur ?? d.dur) / d.dur));
  if (d?.charge) unit *= Math.max(0.1, Math.min(1, (s.charge ?? d.charge) / d.charge));
  if (d?.food?.hunger && recipient.hunger < 65) unit *= 1 + (65 - recipient.hunger) / 28;
  if (d?.food?.thirst && recipient.thirst < 65) unit *= 1 + (65 - recipient.thirst) / 26;
  if ((s.key === 'bandage' || s.key === 'herb') && (recipient.hp < recipient.maxHp * 0.7 || recipient.wounds.some(w => w.bleeding && !w.treated))) unit *= 1.8;
  if (recipient.occupation === 'builder' && ['wood', 'stone'].includes(s.key)) unit *= 1.6;
  if (['mechanic', 'engineer'].includes(recipient.occupation) && ['spares', 'scrap', 'iron'].includes(s.key)) unit *= 1.5;
  if (recipient.occupation === 'gardener' && (s.key.startsWith('seed_') || s.key === 'water_flask')) unit *= 1.5;
  if (recipient.occupation === 'cook' && ['berries', 'meat', 'mushroom', 'charcoal'].includes(s.key)) unit *= 1.5;
  if (recipient.occupation === 'medic' && ['bandage', 'herb'].includes(s.key)) unit *= 1.6;
  return unit * qty;
}
export function evaluateHumanExchange(r: RunState, h: HumanRecord, playerSlot: number, humanSlot: number): HumanTradeEvaluation {
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED' || h.state === 'FIGHTING') return { ok: false, reason: 'It is not safe to barter right now.' };
  const player = r.custody.inv, pack = humanPack(r, h);
  if (playerSlot < 0 || humanSlot < 0 || playerSlot >= player.slots.length || humanSlot >= pack.slots.length) return { ok: false, reason: 'One of those items is no longer available.' };
  const offered = player.slots[playerSlot], requested = pack.slots[humanSlot];
  if (!offered || !requested) return { ok: false, reason: 'One of those items is no longer available.' };
  const offeredValue = humanTradeItemValue(offered, h), requestedBase = humanTradeItemValue(requested, h);
  const carried = pack.slots.reduce((n, s) => n + (s?.key === requested.key ? s.qty : 0), 0);
  const soleUsefulFood = (ITEMS[requested.key]?.food?.hunger && h.hunger < 45) || (ITEMS[requested.key]?.food?.thirst && h.thirst < 45);
  const reserve = soleUsefulFood && carried <= requested.qty ? 1.8 : 1;
  const requestedValue = requestedBase * reserve, ratio = offeredValue / Math.max(0.01, requestedValue);
  const offeredName = ITEMS[offered.key]?.name ?? offered.key, requestedName = ITEMS[requested.key]?.name ?? requested.key;
  if (ITEMS[requested.key]?.creatorCore && !ITEMS[offered.key]?.creatorCore && ratio < 0.9) return { ok: false, reason: 'I will not trade my Creator Core for this offer.', offeredName, requestedName, offeredValue, requestedValue, ratio };
  if (ratio < 0.85) {
    const gap = Math.max(1, Math.ceil(requestedValue * 0.85 - offeredValue));
    return { ok: false, reason: `Counter-offer: choose something less valuable from me, or add about ${gap} value points to your offer.`, offeredName, requestedName, offeredValue, requestedValue, ratio };
  }
  return { ok: true, reason: `That is a fair exchange: your ${offeredName} for my ${requestedName}.`, offeredName, requestedName, offeredValue, requestedValue, ratio };
}

/** Equal-stack barter. Both stacks move by identity; neither side mints or destroys stock. */
export function exchangeHumanStacks(r: RunState, hw: HumanWorld, h: HumanRecord, playerSlot: number, humanSlot: number, now: number): TradeResult {
  const evaluation = evaluateHumanExchange(r, h, playerSlot, humanSlot);
  if (!evaluation.ok) return { ok: false, reason: evaluation.reason };
  const player = r.custody.inv, pack = humanPack(r, h);
  const offered = player.slots[playerSlot], requested = pack.slots[humanSlot];
  if (!offered || !requested) return { ok: false, reason: 'selected stack is gone' };
  // Atomic slot-for-slot swap: same two Stack objects, same UIDs, no intermediate duplicate.
  player.slots[playerSlot] = requested; pack.slots[humanSlot] = offered;
  faceTowardPlayer(r, h);
  const pairKey = [offered.uid, requested.uid].sort().join('|');
  h.tradeTrustReceipts ??= {};
  const firstFairTrade = Object.keys(h.tradeTrustReceipts).length === 0;
  h.tradeTrustReceipts[pairKey] ??= now;
  // Barter is modest social evidence once, never a renewable trust source through item cycling.
  if (firstFairTrade) h.trust = clamp((h.trust ?? 50) + 1, 0, 100);
  recordIncident(r, hw, { kind: 'trade', victim: h.actorId, aggressor: 'player', witnesses: [], at: now, place: { tx: h.gx, ty: h.gy, floor: h.floor }, property: [offered.uid, requested.uid], resolved: true }, now);
  receipt(r, now, 'human.exchange', `${h.actorId}:${offered.uid}<->${requested.uid}`);
  return { ok: true, transferred: offered.qty + requested.qty };
}

/** Offer an item to a human (sell/give). The player's offered stacks are DEBITED from the
 *  player's custody and transferred to the human's pack by UID (K1 conservation — no free mint).
 *  `fromCid` is the player's source container id. */
export function tradeWithHuman(r: RunState, hw: HumanWorld, h: HumanRecord, fromCid: string, key: string, qty: number, now: number): TradeResult {
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED') return { ok: false, reason: 'incapacitated' };
  if (h.state === 'FIGHTING') return { ok: false, reason: 'too dangerous to trade' };
  const src = r.custody[fromCid]; if (!src) return { ok: false, reason: 'no source custody' };
  let transferred = 0;
  // Collect the player's stacks of this key and move them by UID into the human's pack.
  for (let i = 0; i < src.slots.length && qty > 0; i++) {
    const s = src.slots[i]; if (!s || s.key !== key) continue;
    const take = Math.min(qty, s.qty);
    const whole = take === s.qty;
    if (whole) {
      if (!addStack(r, humanPack(r, h).id, s)) return { ok: false, reason: 'no carrying capacity' };
      src.slots[i] = null;
    } else {
      const split: Stack = { ...s, uid: uid(r, 's'), qty: take };
      if (!addStack(r, humanPack(r, h).id, split)) return { ok: false, reason: 'no carrying capacity' };
      s.qty -= take;
    }
    qty -= take; transferred += take;
  }
  if (transferred === 0) return { ok: false, reason: 'nothing to trade' };
  receipt(r, now, 'human.trade', `${h.actorId}:+${transferred}:${key}`);
  return { ok: true, transferred };
}

/** Take an accessible item from a human's carried pack (robbery / loot).
 *  Transfers by UID via addStack (K1 conservation); a stack that cannot fit keeps its identity
 *  in the human's pack (never re-minted, never silently dropped). */
export function lootHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, intoContainerId: string): { taken: number; reason?: string } {
  if (h.state === 'DEAD' || h.state === 'EVACUATED') return { taken: 0, reason: 'no corpse here' };
  if (h.state !== 'DOWNED') return { taken: 0, reason: 'must be downed to loot' };
  const dst = r.custody[intoContainerId]; if (!dst) return { taken: 0, reason: 'no destination custody' };
  const pack = humanPack(r, h);
  let taken = 0;
  for (let i = 0; i < pack.slots.length; i++) {
    const s = pack.slots[i]; if (!s) continue;
    if (addStack(r, dst.id, s)) { pack.slots[i] = null; taken += s.qty; }
    // If addStack refused (no room / non-mergeable), the stack stays in the pack — identity preserved.
  }
  if (taken > 0) receipt(r, now, 'human.loot', `${h.actorId}:-${taken}`);
  return { taken };
}

// ---------------------------------------------------------------------------
// Companion — consent, follow, orders, 5-way resolution, carrying.
// ---------------------------------------------------------------------------
function faceTowardPlayer(r: RunState, h: HumanRecord): void {
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  faceHumanToward(h, ox + r.player.x / TILE, oy + r.player.y / TILE);
}
export type HumanTalkTopic = 'activity' | 'needs' | 'place' | 'goods' | 'accompany';
export function talkToHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, topic?: HumanTalkTopic): string {
  if (h.state === 'DEAD' || h.state === 'EVACUATED') return 'No response.';
  if (h.state === 'DOWNED') return `${h.name} is down and cannot answer.`;
  faceTowardPlayer(r, h);
  if (!h.disposition_known.knownPeople.includes('player')) h.disposition_known.knownPeople.push('player');
  h.lastTalkAt = now;
  const facts: string[] = [`${h.name} · ${h.occupation} · ${h.community ? hw.communities[h.community]?.poi ?? 'traveler' : 'traveler'}`];
  if (h.intent?.kind === 'work' && h.intent.target?.startsWith('harvest:')) {
    const m = h.intent.target.match(/^harvest:(\d+),(\d+)$/);
    const s = m ? sourceAt(r, Number(m[1]), Number(m[2]), now) : null;
    facts.push(h.state === 'WORKING' ? `Working at ${s?.def.name ?? 'a shared source'}.` : `Heading to ${s?.def.name ?? 'a shared source'}${h.intent.blockReason ? ` · ${h.intent.blockReason}` : '.'}`);
  } else if (h.following) facts.push(h.state === 'MOVING' ? 'Keeping pace with you.' : 'Waiting nearby for your next move.');
  else if (h.intent?.blockReason) facts.push(`Cannot continue: ${h.intent.blockReason}.`);
  else if (h.state === 'WORKING') facts.push(`Currently working as a ${h.occupation}.`);
  if (h.lastWorkBlock) facts.push(h.lastWorkBlock);
  if (h.hunger < 35) facts.push(`Hungry (${Math.round(h.hunger)}%).`);
  if (h.thirst < 35) facts.push(`Thirsty (${Math.round(h.thirst)}%).`);
  if (h.hp < h.maxHp * 0.5) facts.push(`Injured (${Math.round(h.hp)}/${h.maxHp} HP).`);
  const carried = humanPack(r, h).slots.filter((s): s is Stack => !!s).slice(0, 3).map(s => `${ITEMS[s.key]?.name ?? s.key} ×${s.qty}`);
  if (carried.length) facts.push(`Carrying: ${carried.join(', ')}.`);
  const knownIncidents = h.disposition_known.incidents.map(id => hw.incidents[id]).filter((x): x is HumanIncident => !!x);
  if (knownIncidents.length) facts.push(`Known incident: ${knownIncidents[knownIncidents.length - 1].kind}.`);
  const activity = facts.slice(0, 2).join(' ');
  const needs: string[] = [];
  if (h.hunger < 35) needs.push('I could use a proper meal.');
  if (h.thirst < 35) needs.push('I need clean water soon.');
  if (h.hp < h.maxHp * 0.5) needs.push('I am hurt and need treatment.');
  if (h.lastWorkBlock) needs.push(h.lastWorkBlock);
  if (!needs.length) needs.push('I have no urgent need right now.');
  const packSummary = carried.length ? `I am carrying ${carried.join(', ')}.` : 'I have nothing in my personal pack to offer.';
  const place = h.community ? `This is my community at ${hw.communities[h.community]?.poi ?? 'this settlement'}. I can only tell you what I have personally seen.` : 'I have not learned enough about this place to guide you yet.';
  const response = topic === 'activity' ? activity
    : topic === 'needs' ? needs.join(' ')
    : topic === 'place' ? place
    : topic === 'goods' ? packSummary
    : topic === 'accompany' ? (h.following ? 'I am already traveling with you.' : h.disposition === 'predatory' ? 'No. I will not travel with you.' : (h.trust ?? 50) < 55 ? 'I do not know you well enough to travel together. Show me I can rely on you first.' : 'I would consider traveling with you. Ask me to join when you are ready.')
    : facts.slice(0, 4).join(' ');
  receipt(r, now, 'human.talk', `${h.actorId}:${topic ?? 'status'}`);
  return response;
}

export type HumanDemand = 'item' | 'disarm' | 'back_off' | 'stop_attack';
export type ConfrontationResult = { ok: boolean; reason?: string; reaction?: 'COMPLY' | 'NEGOTIATE' | 'REFUSE' | 'FLEE' | 'CALL_FOR_HELP' | 'FIGHT'; msg?: string };
function retreatHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number): boolean {
  const origin = r.sourceMap?.veyra?.originAu;
  const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
  const px = ox + Math.floor(r.player.x / TILE), py = oy + Math.floor(r.player.y / TILE);
  const grid = blockGrid(r), occupied = new Set(Object.values(hw.people).filter(v => v.actorId !== h.actorId && v.state !== 'DEAD' && v.state !== 'EVACUATED').map(v => humanCellKey(v.floor, v.gx, v.gy)));
  const dx = Math.sign(h.gx - px) || (h.actorId.charCodeAt(1) % 2 ? 1 : -1), dy = Math.sign(h.gy - py);
  const options = [[dx * 6, dy * 6], [dx * 5, dy * 3], [dx * 4, dy * -2], [dx * 7, 0], [0, dy * 7]];
  for (const [sx, sy] of options) {
    const gx = h.gx + sx, gy = h.gy + sy, lx = gx - ox, ly = gy - oy;
    if (lx < 1 || ly < 1 || lx >= WW - 1 || ly >= WH - 1 || !(grid[ly * WW + lx] === 0 || grid[ly * WW + lx] === 4)) continue;
    const route = humanRouteToAdjacent(r, h, gx, gy, grid, ox, oy, occupied);
    if (!route?.length) continue;
    h.following = false; h.state = 'MOVING';
    h.intent = { intentId: `flee:${h.actorId}:${now}`, actorId: h.actorId, kind: 'move', target: 'retreat:player', preconditions: ['actor chose an open legal retreat path'], reserved: [], startAt: now, dueAt: now, route };
    return true;
  }
  return false;
}
export function threatenHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, demand: HumanDemand = 'back_off', stackUid?: string): ConfrontationResult {
  if (h.state === 'DEAD' || h.state === 'EVACUATED' || h.state === 'DOWNED') return { ok: false, reason: 'This person cannot answer a confrontation.' };
  const pack = humanPack(r, h);
  const demanded = demand === 'item' ? pack.slots.find(s => s?.uid === stackUid) ?? null : demand === 'disarm' ? h.equip.weapon : null;
  if (demand === 'item' && !demanded) return { ok: false, reason: 'That carried item is no longer accessible.' };
  if (demand === 'disarm' && !h.equip.weapon) return { ok: false, reason: 'They are not carrying an equipped weapon.' };
  if (demand === 'stop_attack' && h.state !== 'FIGHTING') return { ok: false, reason: 'They are not attacking anyone right now.' };
  faceTowardPlayer(r, h);
  const origin = r.sourceMap?.veyra?.originAu;
  const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
  const hx = (h.gx - ox + 0.5) * TILE, hy = (h.gy - oy + 0.5) * TILE;
  const witnesses = Object.values(hw.people).filter(other => {
    if (other.actorId === h.actorId || other.state === 'DEAD' || other.state === 'EVACUATED' || other.state === 'DOWNED' || other.floor !== h.floor) return false;
    const wx = (other.gx - ox + 0.5) * TILE, wy = (other.gy - oy + 0.5) * TILE;
    return Math.hypot(other.gx - h.gx, other.gy - h.gy) <= 8 && clearPhysicalLine(r, { x: wx, y: wy }, { x: hx, y: hy }, true);
  }).map(other => other.actorId);
  const playerWeapon = r.custody.inv.slots[r.player.active];
  const scene = JSON.stringify([h.gx, h.gy, h.floor, h.state, h.equip.weapon?.uid ?? '', h.equip.weapon?.dur ?? -1, Math.round(h.hp), witnesses.sort(), playerWeapon?.uid ?? '', playerWeapon?.dur ?? -1, Math.round(r.player.hp), r.player.active]);
  if (h.confrontationAttempt?.scene === scene && now - h.confrontationAttempt.at < 15000) {
    return { ok: false, reason: `${h.name} has already answered this threat. Give them time or change the situation before pressing again.` };
  }
  const attemptNo = (h.confrontationAttempt?.attempts ?? 0) + 1;
  const playerThreat = (playerWeapon ? ITEMS[playerWeapon.key]?.dmg ?? 0 : 0) + (r.player.hp < 30 ? 0 : 5);
  const valuable = demanded ? (ITEMS[demanded.key]?.creatorCore ? 50 : demanded.key.includes('weapon') || ITEMS[demanded.key]?.dmg ? 18 : ITEMS[demanded.key]?.food ? 7 : 3) * Math.max(1, Math.min(5, demanded.qty)) : 0;
  const resolve = (h.equip.weapon ? 20 : 0) + h.combatProficiency * 7 + (h.disposition === 'predatory' ? 10 : h.disposition === 'protective' ? 4 : 0) + witnesses.length * 8 + h.protectedPeople.length * 2 + (h.hp < h.maxHp * 0.35 ? -16 : 0) + ((h.trust ?? 50) - 50) * 0.2;
  const pressure = playerThreat + (demand === 'item' ? 20 + valuable : demand === 'disarm' ? 22 : 18);
  const roll = hashInt(`${h.actorId}:${scene}:${demand}:${stackUid ?? ''}:${attemptNo}`) % 100;
  let reaction: ConfrontationResult['reaction'];
  if (pressure - resolve >= 18 && (demand !== 'item' || valuable < 18) && roll < 78) reaction = 'COMPLY';
  else if (pressure - resolve >= 5 && roll < 42) reaction = 'NEGOTIATE';
  else if (witnesses.length && h.disposition === 'protective' && roll < 62) reaction = 'CALL_FOR_HELP';
  else if ((h.hp < h.maxHp * 0.45 || !h.equip.weapon) && roll < 70) reaction = 'FLEE';
  else if (h.equip.weapon && roll < 68) reaction = 'FIGHT';
  else reaction = 'REFUSE';
  // A failed capacity check is negotiation, not a deleted or duplicated UID.
  if (reaction === 'COMPLY' && demanded) {
    if (demand === 'item') {
      const i = pack.slots.indexOf(demanded); pack.slots[i] = null;
      if (!addStack(r, 'inv', demanded)) { pack.slots[i] = demanded; reaction = 'NEGOTIATE'; }
    } else if (!addStack(r, pack.id, demanded)) reaction = 'NEGOTIATE';
    else h.equip.weapon = null;
  }
  if (reaction === 'COMPLY' && (demand === 'back_off' || demand === 'stop_attack')) {
    if (demand === 'stop_attack') { h.state = 'IDLE'; h.intent = undefined; }
    else if (!retreatHuman(r, hw, h, now)) reaction = 'REFUSE';
  }
  if (reaction === 'FLEE' && !retreatHuman(r, hw, h, now)) reaction = 'REFUSE';
  if (reaction === 'FIGHT') { h.following = false; h.state = 'FIGHTING'; h.intent = { intentId: `retaliate:${h.actorId}:${now}`, actorId: h.actorId, kind: 'fight', target: 'player', preconditions: ['chose to resist this confrontation'], reserved: [], startAt: now, dueAt: now }; }
  if (reaction === 'COMPLY' || reaction === 'NEGOTIATE' || reaction === 'REFUSE' || reaction === 'CALL_FOR_HELP' || reaction === 'FIGHT' || reaction === 'FLEE') {
    h.trust = clamp((h.trust ?? 50) - (reaction === 'COMPLY' ? 8 : 22), 0, 100);
    const comm = h.community ? hw.communities[h.community] : null; if (comm) comm.threat = clamp(comm.threat + 0.12, 0, 1);
    recordIncident(r, hw, { kind: reaction === 'COMPLY' && demand === 'item' ? 'robbery' : 'assault', victim: h.actorId, aggressor: 'player', witnesses, at: now, place: { tx: h.gx, ty: h.gy, floor: h.floor }, property: reaction === 'COMPLY' && demanded ? [demanded.uid] : undefined, injury: false, resolved: reaction === 'COMPLY' }, now);
    if (reaction === 'CALL_FOR_HELP') for (const id of witnesses) {
      const ally = hw.people[id];
      if (!ally?.equip.weapon || (ally.community !== h.community && !ally.protectedPeople.includes(h.actorId))) continue;
      ally.state = 'FIGHTING'; ally.intent = { intentId: `help:${ally.actorId}:${now}`, actorId: ally.actorId, kind: 'fight', target: 'player', preconditions: [`witnessed confrontation with ${h.actorId}`], reserved: [], startAt: now, dueAt: now };
    }
    const reasons: Record<NonNullable<ConfrontationResult['reaction']>, string> = {
      COMPLY: demand === 'item' ? `Hands over ${ITEMS[demanded!.key]?.name ?? demanded!.key}.` : demand === 'disarm' ? 'Puts the equipped weapon away.' : demand === 'stop_attack' ? 'Stops the attack.' : 'Backs away along an open route.',
      NEGOTIATE: `Refuses the demand for now; ${demanded ? `${ITEMS[demanded.key]?.name ?? demanded.key} is valuable to them.` : 'they are weighing the risk.'}`,
      REFUSE: 'Refuses and holds position.', FLEE: 'Retreats along an open route.', CALL_FOR_HELP: `Calls out to ${witnesses.length} visible ally/allies.`, FIGHT: 'Raises their weapon and fights back.',
    };
    h.confrontationAttempt = { scene, at: now, attempts: attemptNo, demand, reaction, message: reasons[reaction] };
    receipt(r, now, 'human.threaten', `${h.actorId}:${demand}:${reaction}`);
    return { ok: true, reaction, msg: reasons[reaction] };
  }
  return { ok: false, reason: 'No feasible response.' };
}

export function recruitHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number): { ok: boolean; reason?: string } {
  if (h.following) return { ok: false, reason: 'already a companion' };
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED' || h.state === 'FIGHTING') return { ok: false, reason: 'not available to recruit' };
  if (h.disposition === 'predatory') return { ok: false, reason: 'this survivor will not join you' };
  if ((h.trust ?? 50) < 55) return { ok: false, reason: 'I do not know you well enough yet. Show that I can rely on you first.' };
  faceTowardPlayer(r, h);
  setFollowing(r, hw, h, true, now);
  return { ok: true };
}

export function setFollowing(r: RunState, hw: HumanWorld, h: HumanRecord, follow: boolean, now: number): void {
  h.following = follow;
  if (follow) {
    h.state = 'IDLE';
    h.intent = { intentId: `follow:${h.actorId}:${now}`, actorId: h.actorId, kind: 'follow', preconditions: ['accepted companion recruitment'], reserved: [], startAt: now, dueAt: now, route: [] };
  } else {
    h.followOrder = undefined;
    if (h.intent?.kind === 'follow') h.intent = undefined;
    if (h.state === 'MOVING') h.state = 'IDLE';
  }
  receipt(r, now, 'human.follow', `${h.actorId}:${follow ? 'on' : 'off'}`);
}

/** Resolve one companion order. Hard physical impossibility and protected relations are checked
 *  BEFORE risk/obedience. The decision persists for one orderId (no per-frame reroll). */
export function resolveOrder(r: RunState, hw: HumanWorld, h: HumanRecord, orderId: string, order: 'follow' | 'hold' | 'defend' | 'engage' | 'retreat' | 'home' | 'carry', now: number, targetActorId?: string): { result: OrderResult; reason: string } {
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED') return { result: 'CANNOT_EXECUTE', reason: 'incapacitated' };
  if (!h.following) return { result: 'REFUSE_WITH_REASON', reason: 'not a companion' };
  if ((order === 'engage' || order === 'defend') && targetActorId && h.protectedPeople.includes(targetActorId)) {
    return { result: 'PROTECT_TARGET', reason: `refuses to harm ${targetActorId}, whom they protect` };
  }
  if (order === 'home' && !h.home) return { result: 'CANNOT_EXECUTE', reason: 'no home to return to' };
  if (order === 'carry' && humanCart(r, h).slots.every(s => s)) return { result: 'CANNOT_EXECUTE', reason: 'cart full' };
  if (order === 'engage' && h.disposition === 'protective' && !h.protectedPeople.includes(targetActorId ?? '')) {
    if (h.community && hw.communities[h.community]?.threat < 0.5) return { result: 'RETREAT_OR_HOLD', reason: 'cautious; holds position' };
  }
  // Deterministic refusal: stable hash of orderId+actorId+target — NOT global RNG.
  // A neutral's engage refusal is decided once per orderId and persists (no per-frame reroll).
  if (order === 'engage' && h.disposition === 'neutral' && !h.protectedPeople.includes(targetActorId ?? '')) {
    const verdict = hashInt(`${h.actorId}:${orderId}:${targetActorId ?? ''}`) % 100;
    if (verdict < 30) {
      const res: OrderResult = 'REFUSE_WITH_REASON';
      h.followOrder = { orderId, result: res, reason: 'unwilling to attack a stranger', at: now };
      receipt(r, now, 'human.order', `${h.actorId}:${order}:${res}`);
      return { result: res, reason: 'unwilling to attack a stranger' };
    }
  }
  const result: OrderResult = 'OBEY';
  const reason = 'accepts the order';
  h.followOrder = { orderId, result, reason, at: now };
  receipt(r, now, 'human.order', `${h.actorId}:${order}:${result}`);
  return { result, reason };
}

// ---------------------------------------------------------------------------
// Crime, witnesses, retaliation — bounded incident ledger (no GPS, no morale currency).
// ---------------------------------------------------------------------------
export function recordIncident(r: RunState, hw: HumanWorld, inc: Omit<HumanIncident, 'id'>, now: number): HumanIncident {
  let id: string;
  do { const n = hw.nextIncidentSeq ?? 0; hw.nextIncidentSeq = n + 1; id = `inc:${r.id}:${n}`; } while (hw.incidents[id]);
  const full: HumanIncident = { id, ...inc };
  hw.incidents[id] = full;
  if (inc.victim && hw.people[inc.victim]) {
    const v = hw.people[inc.victim];
    if (!v.disposition_known.incidents.includes(id)) v.disposition_known.incidents.push(id);
    if (inc.aggressor && !v.disposition_known.knownPeople.includes(inc.aggressor)) v.disposition_known.knownPeople.push(inc.aggressor);
  }
  for (const w of inc.witnesses) {
    const wit = hw.people[w]; if (!wit) continue;
    if (!wit.disposition_known.incidents.includes(id)) wit.disposition_known.incidents.push(id);
    if (inc.aggressor && !wit.disposition_known.knownPeople.includes(inc.aggressor)) wit.disposition_known.knownPeople.push(inc.aggressor);
  }
  receipt(r, now, 'human.incident', `${id}:${inc.kind}`);
  return full;
}

/** A directly attacked/wounded survivor forms a persistent retaliatory intent. */
export function formGrievance(_r: RunState, hw: HumanWorld, h: HumanRecord, aggressorId: string, _now: number, incidentId: string): void {
  const inc = hw.incidents[incidentId];
  if (!inc || inc.victim !== h.actorId || inc.aggressor !== aggressorId || h.state === 'DEAD') return;
  if (!h.disposition_known.incidents.includes(inc.id)) h.disposition_known.incidents.push(inc.id);
}

// ---------------------------------------------------------------------------
// Evacuation — one shared transport/departure law for humans and the player.
// ---------------------------------------------------------------------------
export function boardEvac(r: RunState, hw: HumanWorld, h: HumanRecord, tripId: string, now: number): { ok: boolean; reason?: string } {
  const trip = hw.evacuation[tripId];
  if (!trip) return { ok: false, reason: 'no such trip' };
  if (trip.departed) return { ok: false, reason: 'trip has departed' };
  // One person, one trip: reject if already boarded anywhere.
  for (const t of Object.values(hw.evacuation)) {
    if (t.boarded.includes(h.actorId)) return { ok: false, reason: 'already boarded on another trip' };
  }
  // Position check: the human must be within boarding range of the trip's real boarding tile.
  const dx = (h.gx + 0.5) - trip.siteGx, dy = (h.gy + 0.5) - trip.siteGy;
  if (Math.hypot(dx, dy) > 6) return { ok: false, reason: 'not at the boarding site' };
  if (trip.boarded.length >= trip.capacity) return { ok: false, reason: 'trip full' };
  if (h.state === 'DEAD') return { ok: false, reason: 'cannot board a corpse' };
  if (h.state === 'DOWNED') return { ok: false, reason: 'too injured to board' };
  trip.boarded.push(h.actorId);
  receipt(r, now, 'human.board', `${h.actorId}:${tripId}`);
  return { ok: true };
}

/** Depart a trip: marks humans EVACUATED, removes them from the island. Does NOT end the player's run. */
export function departEvac(r: RunState, hw: HumanWorld, tripId: string, now: number): { ok: boolean; reason?: string } {
  const trip = hw.evacuation[tripId];
  if (!trip) return { ok: false, reason: 'no such trip' };
  if (trip.departed) return { ok: false, reason: 'already departed' };
  if (trip.boarded.length === 0) return { ok: false, reason: 'nothing boarded' };
  trip.departed = true;
  trip.departAt = now;
  trip.receipt = `depart:${tripId}:${now}`;
  for (const actorId of trip.boarded) {
    const h = hw.people[actorId]; if (!h || actorId === 'player') continue;
    h.state = 'EVACUATED';
    h.evacuatedAt = now;
    h.outcome = 'EVACUATED';
    if (h.community && hw.communities[h.community]) {
      const comm = hw.communities[h.community];
      comm.memberIds = comm.memberIds.filter(m => m !== actorId);
    }
  }
  receipt(r, now, 'evac.depart', `${tripId}:${trip.boarded.length}`);
  pushLog(r, now, `The evacuation vessel departs from ${trip.site}.`, 'gold');
  return { ok: true };
}

/** Player evacuation: the player must be AT the boarding site. On boarding, the trip departs
 *  and the run ends via the existing endRun('evacuated') path (integrated in engine.ts). */
export function playerEvacuate(r: RunState, hw: HumanWorld, tripId: string, now: number): { ok: boolean; reason?: string } {
  const trip = hw.evacuation[tripId];
  if (!trip) return { ok: false, reason: 'no such trip' };
  if (trip.departed) return { ok: false, reason: 'trip has departed' };
  // Player position check: must be within boarding range of the real boarding tile.
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  const px = ox + Math.floor(r.player.x / TILE), py = oy + Math.floor(r.player.y / TILE);
  const dx = (px + 0.5) - trip.siteGx, dy = (py + 0.5) - trip.siteGy;
  if (Math.hypot(dx, dy) > 6) return { ok: false, reason: 'not at the boarding site' };
  trip.boarded.push('player');
  return departEvac(r, hw, tripId, now);
}

// ---------------------------------------------------------------------------
// Elder assault — one global authority per canonical Elder; causal offscreen advance.
// ---------------------------------------------------------------------------
/** Advance Elder pressure: h312 awakening, h336 final. A defeated Elder cannot attack later. */
export function advanceElderPressure(r: RunState, hw: HumanWorld, now: number): void {
  const hours = runHours(r, now);
  for (const elder of Object.values(hw.elderPressure)) {
    if (!elder.alive) continue;
    if (elder.defeatedAt) { elder.alive = false; continue; }
    if (hours >= 312 && elder.awakenedAt === undefined) {
      elder.awakenedAt = now;
      receipt(r, now, 'elder.awaken', elder.elderId);
    }
    // Awakening is not an attack; only physical contact can stamp lastAttackAt.
  }
}

/** Mark an Elder defeated. Cancels future events for that source. */
export function defeatElder(r: RunState, hw: HumanWorld, elderId: string, now: number): void {
  const elder = hw.elderPressure[elderId];
  if (!elder || !elder.alive) return;
  elder.alive = false;
  elder.defeatedAt = now;
  receipt(r, now, 'elder.defeat', elderId);
}

// ---------------------------------------------------------------------------
// Run-end finalization — distinct terminal outcomes, atomic before K8 wipe.
// ---------------------------------------------------------------------------
export interface HumanOutcomeSummary { total: number; evacuated: number; survived: number; dead: number; unresolved: number; }

/** Finalize every human's terminal outcome before the run wipe. No double-counting.
 *  SURVIVED_ON_ISLAND requires causal survival evidence through h336; otherwise the outcome stays UNRESOLVED — never a default "everyone survived". */
export function finalizeHumanOutcomes(r: RunState, hw: HumanWorld, now: number): HumanOutcomeSummary {
  const summary: HumanOutcomeSummary = { total: 0, evacuated: 0, survived: 0, dead: 0, unresolved: 0 };
  for (const h of Object.values(hw.people)) {
    summary.total++;
    if (h.outcome) {
      if (h.outcome === 'EVACUATED') summary.evacuated++;
      else if (h.outcome === 'DEAD') summary.dead++;
      else if (h.outcome === 'SURVIVED_ON_ISLAND') summary.survived++;
      else summary.unresolved++;
      continue;
    }
    if (h.state === 'EVACUATED') { h.outcome = 'EVACUATED'; summary.evacuated++; }
    else if (h.state === 'DEAD') { h.outcome = 'DEAD'; summary.dead++; }
    else if (h.state === 'DOWNED') { h.outcome = 'UNRESOLVED'; summary.unresolved++; }
    else {
      // Absence of damage is NOT proof of surviving the final assault interval.
      // Until the assault authority supplies causal interval coverage, remain unresolved.
      h.outcome = 'UNRESOLVED'; summary.unresolved++;
    }
  }
  receipt(r, now, 'human.finalize', `total=${summary.total} evac=${summary.evacuated} surv=${summary.survived} dead=${summary.dead} unres=${summary.unresolved}`);
  return summary;
}

/** Aggregate history to preserve across the K8 wipe (no humans/Core/cash, only permitted summary). */
export function humanHistoryAggregate(hw: HumanWorld): { schema: string; total: number; outcomes: HumanOutcomeSummary } {
  return { schema: 'human-history-v1', total: Object.keys(hw.people).length, outcomes: countOutcomes(hw) };
}
function countOutcomes(hw: HumanWorld): HumanOutcomeSummary {
  const s: HumanOutcomeSummary = { total: 0, evacuated: 0, survived: 0, dead: 0, unresolved: 0 };
  for (const h of Object.values(hw.people)) {
    s.total++;
    const o = h.outcome ?? (h.state === 'EVACUATED' ? 'EVACUATED' : h.state === 'DEAD' ? 'DEAD' : 'UNRESOLVED');
    if (o === 'EVACUATED') s.evacuated++; else if (o === 'DEAD') s.dead++; else if (o === 'SURVIVED_ON_ISLAND') s.survived++; else s.unresolved++;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Integrated human simulation step — consume, work, move, evacuate.
// Called once per sim tick from sim.ts. Actor-aware, no player XP, no teleport.
// ---------------------------------------------------------------------------
/** Advance every human's autonomous behavior for one tick. Does NOT touch player XP or
 *  player-exploration loot. Movement is tile-step toward an intent target (no teleport). */
function humanCellKey(floor: number, gx: number, gy: number): string { return `${floor}:${gx}:${gy}`; }
/** Render/query position in global tile coordinates. Logical occupancy remains tile-authoritative. */
export function humanWorldPosition(h: HumanRecord, at?: number): { gx: number; gy: number } {
  const m = h.motion;
  if (!m) return { gx: h.gx + 0.5, gy: h.gy + 0.5 };
  // Render may interpolate only the small uncommitted remainder since the latest simulation
  // update. Tile occupancy/route legality remains authoritative and never advances here.
  const extrapolation = at === undefined || m.updatedAt === undefined ? 0 : clamp(at - m.updatedAt, 0, 50);
  const travelMs = TILE / PROFILES[h.profile].speed * 1000;
  const t = clamp((m.elapsedMs + extrapolation) / travelMs, 0, 1);
  return { gx: m.fromGx + 0.5 + (m.toGx - m.fromGx) * t, gy: m.fromGy + 0.5 + (m.toGy - m.fromGy) * t };
}
function faceHumanToward(h: HumanRecord, gx: number, gy: number): void {
  const dx = gx - (h.gx + 0.5), dy = gy - (h.gy + 0.5);
  h.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
}
function humanRouteToAdjacent(r: RunState, h: HumanRecord, targetGx: number, targetGy: number, grid: Uint8Array, ox: number, oy: number, occupied: Set<string>): { tx: number; ty: number; floor: number }[] | null {
  const floor = r.veyraFloor ?? 0;
  if (h.floor !== floor) return null;
  const sx = h.gx - ox, sy = h.gy - oy, tx = targetGx - ox, ty = targetGy - oy;
  if (sx < 0 || sy < 0 || tx < 0 || ty < 0 || sx >= WW || tx >= WW || sy >= WH || ty >= WH) return null;
  const size = WW * WH, parent = new Int32Array(size); parent.fill(-2);
  const queue = new Int32Array(size); let head = 0, tail = 0;
  const start = sy * WW + sx; parent[start] = -1; queue[tail++] = start;
  let goal = -1;
  while (head < tail) {
    const at = queue[head++], x = at % WW, y = Math.floor(at / WW);
    if (Math.abs(x - tx) + Math.abs(y - ty) <= 1) { goal = at; break; }
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1) continue;
      const ni = ny * WW + nx;
      if (parent[ni] !== -2 || !(grid[ni] === 0 || grid[ni] === 4) || occupied.has(humanCellKey(floor, ox + nx, oy + ny))) continue;
      parent[ni] = at; queue[tail++] = ni;
    }
  }
  if (goal < 0 || goal === start) return goal === start ? [] : null;
  const path: number[] = [];
  for (let at = goal; at !== start; at = parent[at]) path.push(at);
  path.reverse();
  return path.map(i => ({ tx: ox + i % WW, ty: oy + Math.floor(i / WW), floor }));
}
function companionRoute(r: RunState, h: HumanRecord, grid: Uint8Array, ox: number, oy: number, occupied: Set<string>): { tx: number; ty: number; floor: number }[] | null {
  const floor = r.veyraFloor ?? 0;
  if (h.floor !== floor) return null;
  const sx = h.gx - ox, sy = h.gy - oy;
  const px = Math.floor(r.player.x / TILE), py = Math.floor(r.player.y / TILE);
  if (sx < 0 || sy < 0 || sx >= WW || sy >= WH || px < 0 || py < 0 || px >= WW || py >= WH) return null;
  const size = WW * WH, parent = new Int32Array(size); parent.fill(-2);
  const queue = new Int32Array(size); let head = 0, tail = 0;
  const start = sy * WW + sx; parent[start] = -1; queue[tail++] = start;
  let goal = -1;
  while (head < tail) {
    const at = queue[head++], x = at % WW, y = Math.floor(at / WW);
    if (Math.abs(x - px) + Math.abs(y - py) === 1) { goal = at; break; }
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1) continue;
      const ni = ny * WW + nx;
      if (parent[ni] !== -2 || !(grid[ni] === 0 || grid[ni] === 4) || occupied.has(humanCellKey(floor, ox + nx, oy + ny))) continue;
      parent[ni] = at; queue[tail++] = ni;
    }
  }
  if (goal < 0 || goal === start) return goal === start ? [] : null;
  const path: number[] = [];
  for (let at = goal; at !== start; at = parent[at]) path.push(at);
  path.reverse();
  return path.map(i => ({ tx: ox + i % WW, ty: oy + Math.floor(i / WW), floor }));
}
function canHumanOccupy(r: RunState, h: HumanRecord, gx: number, gy: number, grid: Uint8Array, ox: number, oy: number, occupied: Set<string>): boolean {
  if (h.floor !== (r.veyraFloor ?? 0) || occupied.has(humanCellKey(h.floor, gx, gy))) return false;
  const lx = gx - ox, ly = gy - oy;
  if (lx < 0 || ly < 0 || lx >= WW || ly >= WH) return false;
  const px = (lx + 0.5) * TILE, py = (ly + 0.5) * TILE;
  if (!r.player.dead && Math.hypot(px - r.player.x, py - r.player.y) < TILE * 0.7) return false;
  if (r.creatures.some(m => m.state !== 'dead' && (m.floor ?? 0) === h.floor && Math.hypot(px - m.x, py - m.y) < TILE * 0.7)) return false;
  const cell = grid[ly * WW + lx];
  return cell === 0 || cell === 4;
}
function occupationCanHarvest(h: HumanRecord, key: string, mat: string): boolean {
  if (h.occupation === 'guard') return false;
  if (h.occupation === 'salvager') return mat === 'scrap' || key === 'scrap' || key === 'wreck' || key.startsWith('road_');
  if (h.occupation === 'mechanic' || h.occupation === 'engineer') return mat === 'scrap' || mat === 'ore';
  if (h.occupation === 'builder') return mat === 'wood' || mat === 'stone';
  if (h.occupation === 'cook') return ['bush', 'herb', 'mushroom'].includes(key);
  if (h.occupation === 'gardener') return ['bush', 'grass', 'reed', 'herb', 'mushroom'].includes(key);
  if (h.occupation === 'medic') return ['herb', 'mushroom'].includes(key);
  return false;
}
function canHarvestSource(h: HumanRecord, s: NonNullable<ReturnType<typeof sourceAt>>): boolean {
  const tool = h.equip.weapon?.key;
  if (!tool) return s.def.mat === 'plant' && occupationCanHarvest(h, s.key, s.def.mat);
  const power = s.def.harvestBy ? (s.def.harvestBy[tool] ?? 0) : (ITEMS[tool]?.power?.[s.def.mat] ?? 0);
  return power > 0 && occupationCanHarvest(h, s.key, s.def.mat);
}
function plannerSources(r: RunState): Set<string> {
  const protectedTiles = new Set<string>();
  for (const e of Object.values(r.entities)) if (e.tx !== undefined && e.ty !== undefined && (e.g1b || (e.kind === 'loot' && !e.g1b))) protectedTiles.add(`${e.tx}:${e.ty}`);
  for (const e of Object.values(r.g1b?.far ?? {})) if (e.g1b && e.tx !== undefined && e.ty !== undefined) protectedTiles.add(`${e.tx}:${e.ty}`);
  return protectedTiles;
}
function planAutonomousWork(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, grid: Uint8Array, ox: number, oy: number, occupied: Set<string>, protectedTiles: Set<string>): void {
  if (h.intent?.work?.phase === 'travel' && h.state === 'IDLE') {
    planHumanOccupation(r, hw, h, now, (gx,gy) => humanRouteToAdjacent(r,h,gx,gy,grid,ox,oy,occupied));
    h.nextThinkAt = now + 3000; return;
  }
  if (h.following || h.state !== 'IDLE' || h.intent || (h.nextThinkAt ?? 0) > now) return;
  h.nextThinkAt = now + 6000;
  if (h.floor !== (r.veyraFloor ?? 0) || h.hp < 30 || h.stamina < 12) return;
  if (!h.community) return;
  const comm = hw.communities[h.community]; if (!comm) return;
  const need = h.thirst < 40 ? 'drink' : h.hunger < 40 ? 'eat' : undefined;
  if (need && comm.storeTile) {
    const stock = comm.foodStores.flatMap(id => r.custody[id]?.slots ?? []);
    const hasSupply = stock.some(s => s && (need === 'eat' ? (ITEMS[s.key].food?.hunger ?? 0) > 0 : (ITEMS[s.key].food?.thirst ?? 0) > 0 && (ITEMS[s.key].charge == null || (s.charge ?? 0) > 0)));
    if (hasSupply && !reachableHumanStores(r, hw, h).length) {
      const route = humanRouteToAdjacent(r, h, comm.storeTile[0], comm.storeTile[1], grid, ox, oy, occupied);
      if (route?.length) {
        h.intent = { intentId: `supply:${h.actorId}:${now}`, actorId: h.actorId, kind: need, target: comm.storeEntityId, preconditions: ['authorized finite stock'], reserved: [], startAt: now, dueAt: now, route };
        h.state = 'MOVING'; return;
      }
      h.lastWorkBlock = 'I need supplies, but cannot reach our store.';
    }
  }
  if (h.hunger < 25 || h.thirst < 25) return;
  const pack = humanPack(r, h);
  if (h.workOutputs && Object.values(h.workOutputs).some(q => q > 0) && comm.storeTile) {
    const route = humanRouteToAdjacent(r, h, comm.storeTile[0], comm.storeTile[1], grid, ox, oy, occupied);
    if (!route) return;
    h.intent = { intentId: `store:${h.actorId}:${now}`, actorId: h.actorId, kind: 'work', target: 'store', preconditions: ['carry output from shared harvest', 'physical community store'], reserved: [], startAt: now, dueAt: now, route };
    h.state = route.length ? 'MOVING' : 'IDLE';
    if (!route.length) { depositHumanOutputs(r, h, now); h.intent = undefined; h.nextThinkAt = now + 6000; }
    return;
  }
  if (planHumanOccupation(r,hw,h,now,(gx,gy)=>humanRouteToAdjacent(r,h,gx,gy,grid,ox,oy,occupied))) return;
  const lx = h.gx - ox, ly = h.gy - oy;
  if (lx < 1 || ly < 1 || lx >= WW - 1 || ly >= WH - 1) return;
  let best: { tx: number; ty: number; score: number } | null = null, spaceBlocked = false;
  for (let y = Math.max(1, ly - 24); y <= Math.min(WH - 2, ly + 24); y++) for (let x = Math.max(1, lx - 24); x <= Math.min(WW - 2, lx + 24); x++) {
    const s = sourceAt(r, x, y, now);
    if (!s || s.stock <= 0 || protectedTiles.has(`${x}:${y}`) || !canHarvestSource(h, s)) continue;
    if (!simulateHumanOutput(pack.slots.map(v => v ? { ...v } : null), s.def.yields)) { spaceBlocked = true; continue; }
    const score = Math.abs(x - lx) + Math.abs(y - ly) + (s.stock <= 1 ? 4 : 0);
    if (!best || score < best.score) best = { tx: x, ty: y, score };
  }
  if (!best) { if (spaceBlocked) h.lastWorkBlock = 'My pack is full; I cannot take another source unit until I make room.'; return; }
  const targetGx = ox + best.tx, targetGy = oy + best.ty;
  const route = humanRouteToAdjacent(r, h, targetGx, targetGy, grid, ox, oy, occupied);
  if (!route) { h.lastWorkBlock = 'I cannot reach a suitable shared source by a legal route from here.'; return; }
  h.lastWorkBlock = undefined;
  h.intent = { intentId: `work:${h.actorId}:${now}`, actorId: h.actorId, kind: 'work', target: `harvest:${best.tx},${best.ty}`, preconditions: ['shared source in active window', 'occupation and equipped tool can extract source', 'pack has room', 'player-exploration caches excluded'], reserved: [], startAt: now, dueAt: now, route };
  h.state = route.length ? 'MOVING' : 'WORKING';
  if (!route.length) h.intent.dueAt = now + 1500;
}
function performHumanHarvest(r: RunState, hw: HumanWorld, h: HumanRecord, now: number): boolean {
  const m = h.intent?.target?.match(/^harvest:(\d+),(\d+)$/);
  if (!m) return false;
  const tx = Number(m[1]), ty = Number(m[2]);
  const before = new Map(humanPack(r, h).slots.filter((s): s is Stack => !!s).map(s => [s.uid, s.qty]));
  const result = humanHarvest(r, hw, h, tx, ty, now);
  if (result.result !== 'yield') { h.lastWorkBlock = result.reason; h.intent = undefined; h.state = 'IDLE'; h.nextThinkAt = now + 10000; return false; }
  if ((result.got ?? 0) <= 0) {
    // The source took a real strike, but no whole stock unit crossed the extraction threshold yet.
    // Continue the same work commitment; do not record output or claim production.
    if (h.intent) { h.intent.dueAt = now + 900; h.intent.blockReason = 'working the source; no full unit released yet'; }
    return false;
  }
  h.lastWorkBlock = undefined;
  h.workOutputs ??= {};
  for (const s of humanPack(r, h).slots) if (s) {
    const delta = s.qty - (before.get(s.uid) ?? 0);
    if (delta > 0) h.workOutputs[s.uid] = (h.workOutputs[s.uid] ?? 0) + delta;
  }
  h.lastCommittedAt = now;
  h.state = 'IDLE';
  h.intent = undefined;
  receipt(r, now, 'human.work', `${h.actorId}:harvest:${result.key}:${result.got}`);
  return true;
}
function depositHumanOutputs(r: RunState, h: HumanRecord, now: number): void {
  if (!h.community || !h.workOutputs) return;
  const comm = r.humanWorld?.communities[h.community]; if (!comm) return;
  if (!reachableHumanStores(r, r.humanWorld!, h).length) return;
  const dstId = comm.storeContainers.find(id => r.custody[id]); if (!dstId) return;
  const pack = humanPack(r, h), dst = r.custody[dstId]; let moved = 0;
  for (const [stackUid, qty] of Object.entries(h.workOutputs)) {
    const i = pack.slots.findIndex(s => s?.uid === stackUid); if (i < 0 || qty <= 0) { delete h.workOutputs[stackUid]; continue; }
    const s = pack.slots[i]!; const take = Math.min(qty, s.qty);
    const transfer = take === s.qty ? s : { ...s, uid: uid(r, 's'), qty: take };
    const whole = take === s.qty;
    if (whole) pack.slots[i] = null; else s.qty -= take;
    if (!addStack(r, dstId, transfer)) { if (whole) pack.slots[i] = s; else s.qty += take; continue; }
    moved += take; if (qty <= take) delete h.workOutputs[stackUid]; else h.workOutputs[stackUid] = qty - take;
  }
  if (moved) receipt(r, now, 'human.store', `${h.actorId}:${moved}`);
}
export function stepHumans(r: RunState, hw: HumanWorld, now: number): void {
  const lastStepAt = hw.lastStepAt ?? hw.lastResolvedAt;
  const dtMs = now - lastStepAt;
  if (dtMs <= 0) return;
  hw.lastStepAt = now;
  const actors = Object.values(hw.people);
  const wantsPlan = now >= (hw.plannerAt ?? 0) && actors.some(h => !h.following && h.state === 'IDLE' && (!h.intent || h.intent.work?.phase === 'travel') && (h.nextThinkAt ?? 0) <= now);
  const hasMovement = actors.some(h => h.state === 'MOVING' && !!h.intent?.route?.length) || actors.some(h => h.following && h.state === 'IDLE') || wantsPlan || actors.some(h => h.state === 'FIGHTING');
  const grid = hasMovement ? blockGrid(r) : new Uint8Array(0);
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  const occupied = hasMovement ? new Set(actors.filter(h => h.state !== 'DEAD' && h.state !== 'EVACUATED').map(h => humanCellKey(h.floor, h.gx, h.gy))) : new Set<string>();
  const playerGx = ox + Math.floor(r.player.x / TILE), playerGy = oy + Math.floor(r.player.y / TILE);
  for(const h of actors) {
    if(h.occupation!=='guard' || h.floor!==(r.veyraFloor??0) || h.following || ['DOWNED','DEAD','EVACUATED','FIGHTING'].includes(h.state) || (h.nextPerceptionAt??0)>now)continue;
    h.nextPerceptionAt=now+1000;
    const p={x:(h.gx-ox+.5)*TILE,y:(h.gy-oy+.5)*TILE};
    const enemy=r.creatures.find(m=>!m.husbandry?.tamed && (m.floor??0)===h.floor && ['attack','chase'].includes(m.state) && Math.hypot(m.x-p.x,m.y-p.y)<TILE*8 && clearPhysicalLine(r,p,m,true));
    if(!enemy)continue;
    h.motion=undefined;
    h.intent={intentId:`defend:${h.actorId}:${now}`,actorId:h.actorId,kind:'fight',target:enemy.id,preconditions:['direct sight of nearby threat'],reserved:[],startAt:now,dueAt:now};h.state='FIGHTING';
  }
  if (wantsPlan) {
    const protectedTiles = plannerSources(r);
    let cursor = (hw.plannerCursor ?? 0) % Math.max(1, actors.length), planned = 0;
    for (let n = 0; n < actors.length && planned < 8; n++) {
      const i = (cursor + n) % actors.length, h = actors[i];
      if (!h.following && h.state === 'IDLE' && (!h.intent || h.intent.work?.phase === 'travel') && (h.nextThinkAt ?? 0) <= now) {
        planAutonomousWork(r, hw, h, now, grid, ox, oy, occupied, protectedTiles);
        if ((h.nextThinkAt ?? 0) > now) planned++;
      }
      cursor = (i + 1) % actors.length;
    }
    hw.plannerCursor = cursor; hw.plannerAt = now + 1000;
  }
  // Combat locomotion uses the same cardinal route executor and occupancy as work/follow.
  // Limit new searches per update; do not perform an island-wide BFS per hostile per frame.
  let combatRoutes = 0;
  for (const h of actors) {
    if (h.state !== 'FIGHTING' || h.intent?.kind !== 'fight' || h.floor !== (r.veyraFloor ?? 0)) continue;
    const enemy = h.intent.target === 'player' ? (r.player.dead ? null : r.player)
      : r.creatures.find(m => m.id === h.intent?.target && m.state !== 'dead' && (m.floor ?? 0) === h.floor);
    if (!enemy) { h.intent.blockReason = 'target is no longer visible on this floor'; continue; }
    faceHumanToward(h, ox + enemy.x / TILE, oy + enemy.y / TILE);
    const weapon = humanWeapon(h);
    if (!weapon) { h.intent.blockReason = 'no usable weapon'; continue; }
    const distance = Math.hypot((h.gx - ox + 0.5) * TILE - enemy.x, (h.gy - oy + 0.5) * TILE - enemy.y);
    if (distance <= weapon.reach + 8) continue;
    if ((h.nextThinkAt ?? 0) > now || combatRoutes >= 4) continue;
    h.nextThinkAt = now + 750; combatRoutes++;
    // No psychic pursuit: the approach must begin with actual line of sight.
    if (distance > TILE * 18 || !clearPhysicalLine(r, { x: (h.gx - ox + 0.5) * TILE, y: (h.gy - oy + 0.5) * TILE }, enemy, true)) {
      h.intent.blockReason = 'lost sight of the target'; continue;
    }
    const route = humanRouteToAdjacent(r, h, ox + Math.floor(enemy.x / TILE), oy + Math.floor(enemy.y / TILE), grid, ox, oy, occupied);
    if (!route?.length) { h.intent.blockReason = 'no accessible approach'; continue; }
    // One step at a time prevents chasing a stale destination after the target moves.
    h.intent.route = route.slice(0, 1); h.intent.startAt = now;
    h.intent.blockReason = undefined; h.state = 'MOVING';
  }
  for (const h of actors) {
    if (!h.following || h.state !== 'IDLE' || h.intent?.kind !== 'follow') continue;
    if (h.floor !== (r.veyraFloor ?? 0)) { h.intent.blockReason = 'cannot follow across floors yet'; continue; }
    if (Math.abs(h.gx - playerGx) + Math.abs(h.gy - playerGy) <= 1) { h.intent.route = []; h.intent.blockReason = undefined; continue; }
    const route = companionRoute(r, h, grid, ox, oy, occupied);
    if (!route) { h.intent.blockReason = 'no walkable route to the player in this window'; continue; }
    h.intent.route = route; h.state = route.length ? 'MOVING' : 'IDLE'; h.intent.blockReason = undefined;
  }
  for (const h of Object.values(hw.people)) {
    if (h.state === 'DEAD' || h.state === 'EVACUATED') continue;
    // 1. Survival consume: eat when hungry, drink when thirsty.
    if (h.hunger < 40) humanConsume(r, hw, h, 'food', now);
    if (h.thirst < 40) humanConsume(r, hw, h, 'water', now);
    if (h.state === 'WORKING' && h.intent?.work) humanWorkTick(r, hw, h, now);
    // 2. A work action commits only after arrival and a visible work duration; no output is animated or minted in transit.
    if (h.state === 'WORKING' && h.intent?.kind === 'work' && h.intent.target?.startsWith('harvest:') && now >= h.intent.dueAt) performHumanHarvest(r, hw, h, now);
    if (h.intent?.kind === 'work' && h.intent.target === 'store' && h.state === 'IDLE') {
      depositHumanOutputs(r, h, now); h.intent = undefined; h.nextThinkAt = now + 6000;
    }
    // 3. Evacuation: if intent is evacuate and near a boarding site, board.
    if (h.intent?.kind === 'evacuate' && h.state === 'IDLE') {
      for (const trip of Object.values(hw.evacuation)) {
        if (trip.departed) continue;
        const dx = (h.gx + 0.5) - trip.siteGx, dy = (h.gy + 0.5) - trip.siteGy;
        if (Math.hypot(dx, dy) <= 6) { boardEvac(r, hw, h, trip.tripId, now); h.intent = undefined; break; }
      }
    }
    // 4. Continuous movement along a legal cardinal tile route. Logical occupancy changes only
    // at tile boundaries; rendered motion advances at the profile's physical px/s speed.
    const moveIntent = h.intent, moveRoute = moveIntent?.route;
    if (h.state === 'MOVING' && moveIntent && moveRoute?.length) {
      const next = moveRoute[0];
      let beganStep = false;
      if (!h.motion) {
        const dx = next.tx - h.gx, dy = next.ty - h.gy;
        const key = humanCellKey(h.floor, h.gx, h.gy); occupied.delete(key);
        if (next.floor !== h.floor || Math.abs(dx) + Math.abs(dy) !== 1 || !canHumanOccupy(r, h, next.tx, next.ty, grid, ox, oy, occupied)) {
          occupied.add(key); moveIntent.blockReason = 'blocked by a wall, closed door, or another survivor';
          if (moveIntent.kind === 'follow') moveRoute.length = 0;
          else if (moveIntent.kind === 'fight') { h.state = 'FIGHTING'; h.motion = undefined; moveRoute.length = 0; h.nextThinkAt = now + 750; }
          else { h.intent = undefined; h.state = 'IDLE'; h.nextThinkAt = now + 3000; }
        } else {
          const intentStart = Number.isFinite(moveIntent.startAt) ? Math.max(lastStepAt, moveIntent.startAt) : lastStepAt;
          const initialElapsed = clamp(now - intentStart, 0, 250);
          h.motion = { fromGx: h.gx, fromGy: h.gy, toGx: next.tx, toGy: next.ty, elapsedMs: initialElapsed, updatedAt: now };
          beganStep = true;
          h.dir = dy > 0 ? 0 : dy < 0 ? 3 : dx > 0 ? 2 : 1;
        }
      }
      if (h.motion) {
        if (!beganStep) h.motion.elapsedMs += Math.min(dtMs, 250);
        h.motion.updatedAt = now;
        const travelMs = TILE / PROFILES[h.profile].speed * 1000;
        if (h.motion.elapsedMs >= travelMs) {
          const key = humanCellKey(h.floor, h.gx, h.gy); occupied.delete(key);
          h.gx = h.motion.toGx; h.gy = h.motion.toGy; h.motion = undefined; moveRoute.shift();
          h.lastSimAt = now; occupied.add(humanCellKey(h.floor, h.gx, h.gy));
          if (!moveRoute.length) {
            if (moveIntent.kind === 'fight') { h.state = 'FIGHTING'; h.nextThinkAt = now; }
            else if (moveIntent.kind === 'follow') { h.state = 'IDLE'; moveRoute.length = 0; }
            else if (moveIntent.work) { h.state = 'WORKING'; moveIntent.dueAt = now + (moveIntent.work.phase === 'fetch' ? 800 : moveIntent.work.duration); }
            else if (moveIntent.kind === 'work' && moveIntent.target?.startsWith('harvest:')) {
              const target = moveIntent.target.match(/^harvest:(\d+),(\d+)$/);
              if (target) faceHumanToward(h, Number(target[1]) + ox, Number(target[2]) + oy);
              h.state = 'WORKING'; moveIntent.dueAt = now + 1500;
            }
            else if (moveIntent.kind === 'work' && moveIntent.target === 'store') { h.state = 'IDLE'; depositHumanOutputs(r, h, now); h.intent = undefined; h.nextThinkAt = now + 6000; }
            else { h.state = 'IDLE'; h.intent = undefined; }
          }
        }
      }
    }
    // Stamina recovers while actually idle/resting.
    if (h.state === 'IDLE') h.stamina = clamp(h.stamina + dtMs / HOUR * 4, 0, h.maxStamina);
  }
}

// ---------------------------------------------------------------------------
// Human combat integration — real damage routes, not an unattached function.
// ---------------------------------------------------------------------------
/** Resolve human combat for one tick: creatures in range damage nearby humans (applyDamage
 *  with the creature's floor), and fighting humans strike their selected creature/player target.
 *  This is the bidirectional combat law the main K5 routes call into. */
export function stepHumanCombat(r: RunState, hw: HumanWorld, now: number, hitCreature?: (creature: Creature, damage: number, angle: number, attacker: HumanRecord) => void, hitPlayer?: (attacker: HumanRecord, damage: number, angle: number) => void): void {
  const activeFloor = r.veyraFloor ?? 0;
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  // 1. Creatures damage humans in their attack range.
  for (const m of r.creatures) {
    if (m.state !== 'attack') continue;
    const cFloor = m.floor ?? activeFloor;
    const cDmg = CREATURES[m.type]?.dmg ?? 10;
    for (const h of Object.values(hw.people)) {
      if (h.state === 'DEAD' || h.state === 'EVACUATED' || h.floor !== cFloor || m.atk?.humanVictims?.includes(h.actorId)) continue;
      const dx = (h.gx + 0.5) * TILE - ox * TILE - m.x, dy = (h.gy + 0.5) * TILE - oy * TILE - m.y;
      const reach = (CREATURES[m.type]?.r ?? 16) + TILE * 0.5;
      const from = { x: m.x, y: m.y }, to = { x: m.x + dx, y: m.y + dy };
      if (Math.hypot(dx, dy) <= reach && clearPhysicalLine(r, from, to, true)) {
        const landed = applyDamage(r, hw, h, cDmg, Math.atan2(dy, dx), now, 'enemy', m.id, cFloor);
        if (landed) {
          h.lastDamageAt = now;
          m.atk ??= {}; (m.atk.humanVictims ??= []).push(h.actorId);
        }
      }
    }
  }
  // 2. Humans use the same physical range/cone/LOS and weapon cadence as player melee.
  for (const h of Object.values(hw.people)) {
    if (h.state !== 'FIGHTING' || h.floor !== activeFloor || h.stamina < 3) continue;
    const w = humanWeapon(h); if (!w) continue;
    if (now - (h.lastAttackAt ?? -Infinity) < w.swing * proficiencyMul(h.combatProficiency)) continue;
    const hx = (h.gx - ox + 0.5) * TILE, hy = (h.gy - oy + 0.5) * TILE;
    const seenTarget = h.intent?.target === 'player' ? (r.player.dead ? undefined : r.player)
      : r.creatures.find(m => m.id === h.intent?.target && m.state !== 'dead' && (m.floor ?? activeFloor) === h.floor);
    if (seenTarget && clearPhysicalLine(r, { x: hx, y: hy }, seenTarget, true)) faceHumanToward(h, ox + seenTarget.x / TILE, oy + seenTarget.y / TILE);
    const facing = h.dir === 0 ? Math.PI / 2 : h.dir === 1 ? Math.PI : h.dir === 2 ? 0 : -Math.PI / 2;
    if (h.intent?.target === 'player') {
      const dx = r.player.x - hx, dy = r.player.y - hy, distance = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
      const inArc = Math.abs(Math.atan2(Math.sin(angle - facing), Math.cos(angle - facing))) <= w.arc / 2 + 0.15;
      if (distance <= w.reach + 8 && inArc && clearPhysicalLine(r, { x: hx, y: hy }, r.player, true)) {
        h.lastAttackAt = now; h.stamina = clamp(h.stamina - 3, 0, h.maxStamina);
        const weapon = h.equip.weapon!; if (weapon.dur !== undefined) { weapon.dur = Math.max(0, weapon.dur - 1); if (weapon.dur === 0) h.equip.weapon = null; }
        hitPlayer?.(h, w.dmg, angle);
      }
      continue;
    }
    const target = r.creatures.filter(m => m.state !== 'dead' && (m.floor ?? activeFloor) === h.floor && (!h.intent?.target || h.intent.target === m.id))
      .map(m => ({ m, dx: m.x - hx, dy: m.y - hy, d: Math.hypot(m.x - hx, m.y - hy) }))
      .filter(v => v.d <= w.reach + (CREATURES[v.m.type]?.r ?? 6) && Math.abs(Math.atan2(Math.sin(Math.atan2(v.dy, v.dx) - facing), Math.cos(Math.atan2(v.dy, v.dx) - facing))) <= w.arc / 2 + 0.15 && clearPhysicalLine(r, { x: hx, y: hy }, v.m, true))
      .sort((a, b) => a.d - b.d)[0];
    if (!target) continue;
    h.lastAttackAt = now;
    h.stamina = clamp(h.stamina - 3, 0, h.maxStamina);
    const weapon = h.equip.weapon!;
    if (weapon.dur !== undefined) { weapon.dur = Math.max(0, weapon.dur - 1); if (weapon.dur === 0) h.equip.weapon = null; }
    hitCreature?.(target.m, w.dmg, Math.atan2(target.dy, target.dx), h);
  }
}


