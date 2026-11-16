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
import { BAL, TILE, WW, WH, HOUR, clamp, type RunState, type Stack, type Container, type Dir } from './core';
import { ITEMS, ARMOR_CAP, wornProtection, CREATURES, ELDERS, lookupElderDef, PRIMORDIAL_ELDERS } from './catalog';
import { addItem, mkStack, mkContainer, receipt, pushLog, spawnDrop, C, sourceAt, effTile, entsAt, blockGrid, isSheltered, roofRoom } from './engine';
import { rngNext, mulberry, hash2 } from './core';
import { phaseOf, isRagnarok, runHours } from './engine';

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
export interface HumanInventory { pack: Container; cart: Container; }
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
  memberIds: string[];
  stock: Record<string, number>;  // finite community stock ledger (key->qty)
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
  lastResolvedAt: number;
  nextActorSeq: number;
}

// ---------------------------------------------------------------------------
// Companion order resolution (exact 5-way result)
// ---------------------------------------------------------------------------
export type OrderResult = 'OBEY' | 'REFUSE_WITH_REASON' | 'PROTECT_TARGET' | 'RETREAT_OR_HOLD' | 'CANNOT_EXECUTE';

// ---------------------------------------------------------------------------
// Ledger construction
// ---------------------------------------------------------------------------
export function newHumanWorld(runId: string): HumanWorld {
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
    lastResolvedAt: 0,
    nextActorSeq: 1,
  };
}

/** Seed the three evacuation trips (one per service site). */
export function seedEvacTrips(hw: HumanWorld): void {
  for (const site of ['po_evac_west', 'po_evac_south', 'po_evac_hook'] as const) {
    const tripId = `evac:${site}`;
    hw.evacuation[tripId] = { tripId, site, capacity: 6, boarded: [], departed: false };
  }
}

/** Seed the six canonical Elder assault authorities from the catalog. */
export function seedElderPressure(hw: HumanWorld, lairGx: number, lairGy: number, lairFloor: number): void {
  for (const [id, p] of Object.entries(PRIMORDIAL_ELDERS)) {
    hw.elderPressure[id] = { elderId: id, alive: true, lairGx, lairGy, lairFloor, routeTargets: [] };
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
    equip, inv: { pack: invPack, cart: invCart },
    core: opts.core,
    disposition_known: { observedSources: [], witnesses: [], incidents: [], knownPeople: [], playerHomeKnown: false },
    protectedPeople: opts.protectedPeople ?? [],
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
const ARCH_CLASS: Record<string, SiteClass> = {
  village: 'HABITABLE_COMMUNITY',
  port: 'TRADE_OR_TRANSIT',
  coast: 'TRADE_OR_TRANSIT',
  mine: 'WORK_SITE',
  industrial: 'WORK_SITE',
  factory: 'WORK_SITE',
  research: 'WORK_SITE',
  archive: 'WORK_SITE',
  signal: 'TRADE_OR_TRANSIT',
  way: 'TRADE_OR_TRANSIT',
  wild: 'HABITABLE_COMMUNITY',
  crypt: 'HOSTILE_OR_DANGEROUS',
  rupture: 'ABANDONED',
  utility: 'WORK_SITE',
  service: 'TRADE_OR_TRANSIT',
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

/** Starting personal gear per occupation — finite, registered, physically justified. */
function startingGear(occ: Occupation, profile: ProfileKey): { equip?: Partial<HumanEquipSlots>; pack?: [string, number][] } {
  const gear: Record<Occupation, { equip?: Partial<HumanEquipSlots>; pack?: [string, number][] }> = {
    salvager: { equip: { weapon: null }, pack: [['knife', 1], ['cloth', 2], ['spares', 2]] },
    mechanic: { equip: { weapon: { uid: '', key: 'stone_pick', qty: 1, dur: 150 } as any }, pack: [['spares', 3], ['charcoal', 2]] },
    cook: { pack: [['berries', 4], ['charcoal', 2]] },
    gardener: { pack: [['seed', 3], ['water_flask', 1]] },
    medic: { pack: [['herb', 4], ['bandage', 2]] },
    guard: { equip: { weapon: { uid: '', key: 'wood_club', qty: 1, dur: 100 } as any, body: { uid: '', key: 'leather_jerkin', qty: 1 } as any }, pack: [['arrow', 6]] },
    engineer: { equip: { weapon: { uid: '', key: 'stone_pick', qty: 1, dur: 120 } as any }, pack: [['spares', 4], ['charcoal', 2]] },
    builder: { equip: { weapon: { uid: '', key: 'stone_axe', qty: 1, dur: 120 } as any }, pack: [['wood', 4], ['stone', 2]] },
  };
  void profile;
  return gear[occ];
}

/** Classify a POI from its archetype name and seed a community + finite humans.
 *  `poiBox` is the POI's global tile bounding box (from the census). */
export function seedPopulation(r: RunState, hw: HumanWorld, sites: { id: string; name: string; archetype: string; rooms: number; bbox: [number, number, number, number] }[]): void {
  seedEvacTrips(hw);
  // Elder lair: use the first canonical elder's POI if present, else a fixed lair.
  seedElderPressure(hw, 0, 0, 0);
  const rng = mulberry(r.seed ^ 0x9e3779b9);
  for (const site of sites) {
    const cls = ARCH_CLASS[site.archetype] ?? 'ABANDONED';
    if (cls === 'ABANDONED' || cls === 'INACCESSIBLE_OR_UNVERIFIED') {
      // Some areas are appropriately empty. Record the classification.
      hw.communities[site.id] = { id: site.id, poi: site.id, class: cls, homeBeds: [], waterSources: [], foodStores: [], workStations: [], storeContainers: [], memberIds: [], stock: {}, threat: 0 };
      continue;
    }
    // Create a community record with finite starting stock (registered origin).
    const communityId = `com:${site.id}`;
    const store = mkContainer(r, 'loot', 8);
    const stock: Record<string, number> = { berries: 12, charcoal: 6, spares: 4, water_flask: 2, seed: 4 };
    for (const [k, q] of Object.entries(stock)) addItem(r, store.id, k, q);
    const comm: Community = {
      id: communityId, poi: site.id, class: cls, homeBeds: [], waterSources: [], foodStores: [store.id],
      workStations: [], storeContainers: [store.id], memberIds: [], stock, threat: cls === 'HOSTILE_OR_DANGEROUS' ? 0.7 : 0.2,
    };
    hw.communities[communityId] = comm;
    // Seed humans at a standable tile inside the POI bbox (ground floor).
    const roster = rosterFor(cls, site.rooms, rng);
    const [bx0, by0, bx1, by1] = site.bbox;
    let placed = 0;
    for (const member of roster) {
      const gx = bx0 + 2 + Math.floor(rng() * Math.max(1, (bx1 - bx0 - 4)));
      const gy = by0 + 2 + Math.floor(rng() * Math.max(1, (by1 - by0 - 4)));
      const srcId = `${site.id}:human:${placed}`;
      const g = startingGear(member.occ, member.profile);
      // assign a unique uid to equip stacks
      const equip: Partial<HumanEquipSlots> = {};
      if (g.equip) for (const k of Object.keys(g.equip) as (keyof HumanEquipSlots)[]) {
        const st = (g.equip as any)[k]; if (st) { st.uid = `eq${hw.nextActorSeq}${placed}${k.length}`; (equip as any)[k] = st; }
      }
      const h = makeHuman(r, hw, {
        sourceId: srcId, gx, gy, floor: 0, profile: member.profile,
        occupation: member.occ, disposition: member.disp, proficiency: member.prof,
        community: communityId, home: communityId,
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
/** Advance hunger/thirst/rest/wounds for every active human by elapsed real time. */
export function tickNeeds(r: RunState, hw: HumanWorld, now: number): void {
  const dtMs = now - hw.lastResolvedAt;
  if (dtMs <= 0) return;
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
    h.warmth = clamp(h.warmth - (isSheltered(r, h.gx * TILE + 8, h.gy * TILE + 8) ? 0 : 0.4 * hours), 20, 100);
    if (h.hunger <= 0 || h.thirst <= 0) {
      // starvation / dehydration: HP drain, work stops
      const drain = (h.hunger <= 0 ? BAL.player.starveDamagePerMin : 0 + (h.thirst <= 0 ? BAL.player.starveDamagePerMin : 0)) * (dtMs / 60000);
      if (drain > 0) applyDamage(r, hw, h, drain, 0, now, 'starvation');
      if (h.hunger <= 0 || h.thirst <= 0) {
        if (h.intent?.kind === 'work') { h.intent.blockReason = h.hunger <= 0 ? 'too hungry to work' : 'too thirsty to work'; }
      }
    }
    // rest debt: grows when not resting on a bed
    if (!(h.state === 'IDLE' && h.bedId)) h.rest = clamp(h.rest + dtMs / HOUR / 8, 0, 1);
    else h.rest = clamp(h.rest - dtMs / HOUR / 4, 0, 1);
    // bleeding escalation (provisional: 8 min stabilize window, ~20 min fatal)
    for (const w of h.wounds) {
      if (w.bleeding && !w.treated && w.bleedingUntil && now > w.bleedingUntil) {
        // untreated severe bleeding escalates
        if (now - (w.bleedingUntil - 8 * 60000) > 20 * 60000) {
          applyDamage(r, hw, h, 60, 0, now, 'untreated_bleeding');
          w.bleeding = false;
        }
      }
    }
  }
  hw.lastResolvedAt = now;
}

/** Eat/drink from carried or community stock (real item custody). */
export function humanConsume(r: RunState, hw: HumanWorld, h: HumanRecord, kind: 'food' | 'water', now: number): boolean {
  const containers: Container[] = [h.inv.pack];
  if (h.community && hw.communities[h.community]) containers.push(...hw.communities[h.community].foodStores.map(id => r.custody[id]).filter(Boolean) as Container[]);
  for (const c of containers) {
    for (const s of c.slots) {
      if (!s) continue;
      const d = ITEMS[s.key];
      if (kind === 'food' && d.food?.hunger) {
        const want = 100 - h.hunger;
        const got = Math.min(want, d.food.hunger * s.qty);
        h.hunger = clamp(h.hunger + got, 0, 100);
        if (d.food.thirst) h.thirst = clamp(h.thirst + d.food.thirst * s.qty, 0, 100);
        if (d.food.hp) h.hp = clamp(h.hp + d.food.hp * s.qty, 0, h.maxHp);
        s.qty--; if (s.qty <= 0) { const i = c.slots.indexOf(s); c.slots[i] = null; }
        receipt(r, now, 'human.eat', `${h.actorId}:${s.key}`);
        return true;
      }
      if (kind === 'water' && (d.food?.thirst || d.waterContainer)) {
        const want = 100 - h.thirst;
        const got = Math.min(want, (d.food?.thirst ?? 30) * s.qty);
        h.thirst = clamp(h.thirst + got, 0, 100);
        if (d.charge != null) { s.charge = Math.max(0, (s.charge ?? 0) - 1); if (s.charge <= 0) { const i = c.slots.indexOf(s); c.slots[i] = null; } }
        else { s.qty--; if (s.qty <= 0) { const i = c.slots.indexOf(s); c.slots[i] = null; } }
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
export function humanHarvest(r: RunState, hw: HumanWorld, h: HumanRecord, tx: number, ty: number, now: number): { result: 'yield' | 'empty' | 'none' | 'blocked'; got?: number; key?: string } {
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED') return { result: 'blocked' };
  const s = sourceAt(r, tx, ty, now);
  if (!s) return { result: 'none' };
  // PLAYER_EXPLORATION sources are never depleted by NPC autonomous scavenging.
  if (isPlayerExplorationSource(r, s.key, tx, ty)) return { result: 'blocked', key: s.key };
  const st = r.sources[s.i] || (r.sources[s.i] = { stock: s.stock, hp: s.hp });
  if (st.stock <= 0) return { result: 'empty', key: s.key };
  const tool = h.equip.weapon;
  const toolKey = tool?.key;
  const power = s.def.harvestBy ? (toolKey ? (s.def.harvestBy[toolKey] ?? 0) : 0) : (toolKey ? (ITEMS[toolKey]?.power?.[s.def.mat] ?? 0) : 0);
  if (power <= 0) return { result: 'blocked', key: s.key };
  const per = s.def.hp / s.def.stock;
  const before = Math.ceil(st.hp / per - 1e-9);
  st.hp = Math.max(0, st.hp - power);
  const after = Math.ceil(st.hp / per - 1e-9);
  const units = Math.min(st.stock, before - after);
  st.stock -= units;
  let got = 0;
  for (let u = 0; u < units; u++) {
    for (const [k, q] of s.def.yields) { addItem(r, h.inv.pack.id, k, q); got += q; }
  }
  if (st.stock <= 0) { if (s.def.regrow) { st.regrowFrom = now; st.regrowAcc = 0; } }
  receipt(r, now, 'human.harvest', `${h.actorId}:${s.key}@${tx},${ty}:-${units}`);
  return { result: 'yield', got, key: s.key };
}

/** Whether a source is a PLAYER_EXPLORATION authority (G1B chests + authored caches). */
function isPlayerExplorationSource(r: RunState, key: string, tx: number, ty: number): boolean {
  // G1B chest sources are keyed by their g1b sid; any source sitting on a G1B chest tile is protected.
  for (const e of Object.values(r.entities)) {
    if (e.g1b && e.tx === tx && e.ty === ty) return true;
  }
  for (const e of Object.values(r.g1b?.far ?? {})) {
    if (e.g1b && e.tx === tx && e.ty === ty) return true;
  }
  // Authored static loot caches (kind 'loot') are also player exploration.
  void key; void r;
  return false;
}

/** One work tick for a human at a station: validate, reserve, advance, commit once. */
export function humanWorkTick(r: RunState, hw: HumanWorld, h: HumanRecord, now: number): { done: boolean; reason?: string } {
  if (!h.intent || h.intent.kind !== 'work') return { done: false, reason: 'no work order' };
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED') return { done: false, reason: 'incapacitated' };
  if (h.hunger <= 5 || h.thirst <= 5) return { done: false, reason: h.hunger <= 5 ? 'too hungry' : 'too thirsty' };
  // occupation-specific: the human tends its real station/source. For the integrated minimum,
  // a worker at a community store consumes nothing and produces nothing without a real station;
  // blocked honestly when no authorized station/source is reachable.
  const comm = h.community ? hw.communities[h.community] : null;
  if (!comm || comm.workStations.length === 0) {
    h.intent.blockReason = 'no authorized work station reachable';
    return { done: false, reason: h.intent.blockReason };
  }
  // Advance work progress on the real clock; commit output once per interval.
  const dt = now - h.lastCommittedAt;
  if (dt < 60000) return { done: false };
  h.lastCommittedAt = now;
  h.stamina = clamp(h.stamina - 2, 0, h.maxStamina);
  receipt(r, now, 'human.work', `${h.actorId}:${h.occupation}`);
  return { done: true };
}

// ---------------------------------------------------------------------------
// Combat — shared K5 hit/LOS/floor/weapon/armor/Core law. DOWNED != DEAD.
// ---------------------------------------------------------------------------
export type DamageSource = 'player' | 'enemy' | 'human' | 'hazard' | 'starvation' | 'untreated_bleeding';

/** Apply damage to a human with the same armor/floor/weapon law as player combat.
 *  Returns true if the hit landed. A hit that crosses zero HP DOWNS the human (not auto-kill);
 *  only a genuinely lethal follow-up or untreated severe wound finalizes DEAD. */
export function applyDamage(r: RunState, hw: HumanWorld, h: HumanRecord, dmg: number, angle: number, now: number, source: DamageSource, attackerId?: string): boolean {
  if (h.state === 'DEAD' || h.state === 'EVACUATED') return false;
  if (h.floor !== (r.veyraFloor ?? 0) && source !== 'hazard') return false;
  const worn = humanArmor(h);
  dmg = Math.max(1, Math.round(dmg * (1 - worn.armor)));
  h.hp -= dmg;
  if (attackerId && attackerId !== h.actorId) {
    recordIncident(r, hw, {
      kind: 'assault', victim: h.actorId, aggressor: attackerId, witnesses: [], at: now,
      place: { tx: h.gx, ty: h.gy, floor: h.floor }, injury: true, resolved: false,
    }, now);
  }
  if (h.hp <= 0 && h.state !== 'DOWNED') downHuman(r, hw, h, now, source, attackerId);
  return true;
}

/** DOWN a human: alive, incapacitated, one corpse-bag custody from carried stock. */
export function downHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, source: DamageSource, attackerId?: string): void {
  if (h.state === 'DOWNED' || h.state === 'DEAD') return;
  h.state = 'DOWNED';
  h.downedAt = r.clock.simMs / 1000;
  h.hp = Math.max(1, h.hp);
  h.wounds.push({ severity: 0.7, bleeding: source === 'enemy' || source === 'human', bleedingUntil: now + 20 * 60000, treated: false });
  receipt(r, now, 'human.down', `${h.actorId} by ${source}${attackerId ? ':' + attackerId : ''}`);
}

/** Stabilize / treat a downed human with real medicine (Medic/player approach + item custody). */
export function treatHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number): { ok: boolean; reason?: string } {
  if (h.state !== 'DOWNED') return { ok: false, reason: 'not downed' };
  const containers: Container[] = [h.inv.pack];
  if (h.community && hw.communities[h.community]) containers.push(...hw.communities[h.community].foodStores.map(id => r.custody[id]).filter(Boolean) as Container[]);
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

/** Final death: permanent for the run. One recoverable corpse/bag with carried items. */
export function killHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, cause: string): void {
  if (h.state === 'DEAD') return;
  h.state = 'DEAD';
  h.deadAt = r.clock.simMs / 1000;
  h.hp = 0;
  h.outcome = 'DEAD';
  const bag = spawnDrop(r, 'bag', 0, h.gx * TILE + 8, h.gy * TILE + 8, now);
  bag.c = mkContainer(r, 'bag', 8).id;
  for (const s of [...h.inv.pack.slots]) {
    if (s) addItem(r, bag.c!, s.key, s.qty, { dur: s.dur, charge: s.charge, lvl: s.lvl, meta: s.meta });
  }
  h.inv.pack.slots.fill(null);
  receipt(r, now, 'human.death', `${h.actorId}:${cause}`);
  pushLog(r, now, `${h.name} has fallen.`, 'red');
}

// ---------------------------------------------------------------------------
// Trade — real item exchange through K1 custody; refusal by state.
// ---------------------------------------------------------------------------
export type TradeResult = { ok: boolean; reason?: string; transferred?: number };

/** Offer an item to a human (sell/give). Transfers via custody; the human's pack must have room. */
export function tradeWithHuman(r: RunState, hw: HumanWorld, h: HumanRecord, key: string, qty: number, now: number): TradeResult {
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED') return { ok: false, reason: 'incapacitated' };
  if (h.state === 'FIGHTING') return { ok: false, reason: 'too dangerous to trade' };
  const left = addItem(r, h.inv.pack.id, key, qty);
  if (left > 0) return { ok: false, reason: 'no carrying capacity' };
  receipt(r, now, 'human.trade', `${h.actorId}:+${qty}:${key}`);
  return { ok: true, transferred: qty };
}

/** Take an accessible item from a human's carried pack (robbery / loot). */
export function lootHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, intoContainerId: string): { taken: number; reason?: string } {
  if (h.state === 'DEAD' || h.state === 'EVACUATED') return { taken: 0, reason: 'no corpse here' };
  if (h.state !== 'DOWNED') return { taken: 0, reason: 'must be downed to loot' };
  let taken = 0;
  for (let i = 0; i < h.inv.pack.slots.length; i++) {
    const s = h.inv.pack.slots[i]; if (!s) continue;
    const left = addItem(r, intoContainerId, s.key, s.qty, { dur: s.dur, charge: s.charge, lvl: s.lvl, meta: s.meta });
    taken += s.qty - left;
    h.inv.pack.slots[i] = null;
  }
  receipt(r, now, 'human.loot', `${h.actorId}:-${taken}`);
  return { taken };
}

// ---------------------------------------------------------------------------
// Companion — consent, follow, orders, 5-way resolution, carrying.
// ---------------------------------------------------------------------------
export function setFollowing(r: RunState, hw: HumanWorld, h: HumanRecord, follow: boolean, now: number): void {
  h.following = follow;
  if (!follow) h.followOrder = undefined;
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
  if (order === 'carry' && h.inv.cart.slots.every(s => s)) return { result: 'CANNOT_EXECUTE', reason: 'cart full' };
  if (order === 'engage' && h.disposition === 'protective' && !h.protectedPeople.includes(targetActorId ?? '')) {
    if (h.community && hw.communities[h.community]?.threat < 0.5) return { result: 'RETREAT_OR_HOLD', reason: 'cautious; holds position' };
  }
  if (order === 'engage' && h.disposition === 'neutral' && rngNext(r) < 0.3) {
    return { result: 'REFUSE_WITH_REASON', reason: 'unwilling to attack a stranger' };
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
let incidentSeq = 0;
export function recordIncident(r: RunState, hw: HumanWorld, inc: Omit<HumanIncident, 'id'>, now: number): HumanIncident {
  const id = `inc${(incidentSeq++).toString(36)}${(hw.nextActorSeq++).toString(36)}`;
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
export function formGrievance(r: RunState, hw: HumanWorld, h: HumanRecord, aggressorId: string, now: number): void {
  if (h.state === 'DEAD') return;
  const inc = recordIncident(r, hw, {
    kind: 'assault', victim: h.actorId, aggressor: aggressorId,
    witnesses: [], at: now, place: { tx: h.gx, ty: h.gy, floor: h.floor }, injury: true, resolved: false,
  }, now);
  if (!h.disposition_known.incidents.includes(inc.id)) h.disposition_known.incidents.push(inc.id);
}

// ---------------------------------------------------------------------------
// Evacuation — one shared transport/departure law for humans and the player.
// ---------------------------------------------------------------------------
export function boardEvac(r: RunState, hw: HumanWorld, h: HumanRecord, tripId: string, now: number): { ok: boolean; reason?: string } {
  const trip = hw.evacuation[tripId];
  if (!trip) return { ok: false, reason: 'no such trip' };
  if (trip.departed) return { ok: false, reason: 'trip has departed' };
  if (trip.boarded.includes(h.actorId)) return { ok: false, reason: 'already boarded' };
  if (trip.boarded.length >= trip.capacity) return { ok: false, reason: 'trip full' };
  if (h.state === 'DEAD') return { ok: false, reason: 'cannot board a corpse' };
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

/** Player evacuation: lawful departure triggers endRun only AFTER the player actually boards. */
export function playerEvacuate(r: RunState, hw: HumanWorld, tripId: string, now: number): { ok: boolean; reason?: string } {
  const trip = hw.evacuation[tripId];
  if (!trip) return { ok: false, reason: 'no such trip' };
  if (trip.departed) return { ok: false, reason: 'trip has departed' };
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
    if (elder.awakenedAt && hours >= 312) {
      elder.lastAttackAt = now;
    }
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

/** Finalize every human's terminal outcome before the run wipe. No double-counting. */
export function finalizeHumanOutcomes(r: RunState, hw: HumanWorld, now: number): HumanOutcomeSummary {
  const hours = runHours(r, now);
  const summary: HumanOutcomeSummary = { total: 0, evacuated: 0, survived: 0, dead: 0, unresolved: 0 };
  for (const h of Object.values(hw.people)) {
    summary.total++;
    if (h.outcome) {
      if (h.outcome === 'EVACUATED') summary.evacuated++;
      else if (h.outcome === 'DEAD') summary.dead++;
      continue;
    }
    if (h.state === 'EVACUATED') { h.outcome = 'EVACUATED'; summary.evacuated++; }
    else if (h.state === 'DEAD') { h.outcome = 'DEAD'; summary.dead++; }
    else if (hours >= 336 && h.state !== 'DOWNED') {
      h.outcome = 'SURVIVED_ON_ISLAND'; summary.survived++;
    } else {
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


