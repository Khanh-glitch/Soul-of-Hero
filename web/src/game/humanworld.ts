import {swingTiming,basicCastTiming} from './combat-timing';
import {observeRecipeSources,serviceRecipeBoard,recipeBoardDestination,requestedSourceReports,communityFoodDeficit,type FoodRequest,type SourceReport} from './human-procurement';
import {timedWorldWork} from './world-work';
import {globalSourceCandidates, globalBaseGeometry} from '../veyra05/window';
import {inFrame} from '../veyra05/frame';
import {isVeyra05Layout} from '../veyra05/scenes';
import {ensureArchivedElderActor} from '../veyra05/ecosystem';
import {countWorldWork} from './world-work';
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
import { SOURCES, STRUCTS, RECIPES, ITEMS, ARMOR_CAP, wornProtection, CREATURES, ELDERS, lookupElderDef, PRIMORDIAL_ELDERS } from './catalog';
import {basicCoreReach,type BasicCast} from './core-ray';
import {coreCastBlock,coreCastCommit, carryLimit, invWeight, addItem, addStack, removeItem, mkStack, mkContainer, receipt, pushLog, spawnDrop, C, sourceAt, effTile, entsAt, blockGrid, clearPhysicalLine, isSheltered, roofRoom, findRunEntity, markDirty, spaceFor, globalFreshWater, globalSourceAt, destroyStructure } from './engine';
import { rngNext, mulberry, hash2 } from './core';
import { phaseOf, isRagnarok, runHours } from './engine';
import { humanCanUseEntity, humanEntityTile, executeHumanWork, dispatchMedicalResponse, planHumanOccupation, type HumanWorkTask } from './human-jobs';
import { withHumanNavigationRead, humanNavigation } from './human-navigation';
import { humanShelter, humanShelterContext, type HumanShelterContext } from './human-shelter';
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
/** Physical human states. `ON_VESSEL` is an interim physical condition (aboard an operating
 *  evacuation service), NOT a terminal outcome: only confirmed arrival ashore may certify
 *  EVACUATED. Nothing may work, fight or claim a home bed while aboard. */
export type HumanState = 'IDLE' | 'MOVING' | 'WORKING' | 'FIGHTING' | 'DOWNED' | 'DEAD' | 'EVACUATED' | 'BLOCKED' | 'ON_VESSEL';
export type HumanDisposition = 'protective' | 'neutral' | 'opportunistic' | 'predatory';
export type CompanionCommand = 'follow' | 'hold' | 'defend' | 'engage' | 'retreat' | 'home' | 'carry';
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
  testimony?:Record<string,{from:string;at:number}>;
  observedSources: string[];
  witnesses: string[];        // actorIds who witnessed an incident with this actor
  incidents: string[];        // incident ids this actor knows about
  knownPeople: string[];      // actorIds known
  playerHomeKnown: boolean;   // whether the actor has physically observed the player's base
}
export interface HumanIntent {
  guardPlayer?: boolean;
  swing?: {uid:string;victim:string;floor:number;angle:number;distance:number;contactAt:number};
  coreCast?: {uid:string;victim:string;readyAt:number;floor:number;angle:number};
  delivery?: {storeId:string;containerId:string;cargo:{uid:string;qty:number}[]};
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
export interface HumanThreatCoverage {
  waves: number;        // assault waves that reached this body's settlement
  hit: number;          // strikes that actually damaged this body
  guarded: number;      // strikes a guard took on this body's behalf
  lastThreatAt?: number;
  lastWaveId?: string;
}
export interface HumanIncident {
  id: string;
  kind: 'assault' | 'theft' | 'robbery' | 'murder' | 'witness' | 'rescue' | 'trade';
  victim?: string;
  aggressor?: string;
  witnesses: string[];
  at: number;
  place: { tx: number; ty: number; floor: number };
  robbedQuantity?: number;
  recoveredAt?: number;
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
  civilDecision?: {kind:"stay"|"seek_berth";reason:string};
  berthRetryAt?:Record<string,number>;
  reportIncident?:string; // freshest first-hand event to tell a local guard
  recoveryLead?: {incidentId:string;uid:string;chestId:string;containerId:string;tx:number;ty:number;floor:number;seenAt:number};
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
  followOrder?: { orderId: string; result: OrderResult; reason: string; at: number; order?: CompanionCommand; target?: string };
  orderDecisions?: Record<string, {orderId:string;result:OrderResult;reason:string;at:number;order:CompanionCommand;target?:string}>;
  /** Persistent social standing with the player; changes only through witnessed social acts. */
  trust?: number;
  attackReadyAt?:number; // recovery follows the body across a change of intent
  lastAttackAt?: number;
  lastDamageAt?: number;
  /** Throttled autonomous planner; movement interpolation is presentation of the tile-legal route. */
  nextThinkAt?: number;
  /** Consecutive unavailable livelihood reviews; bounded retry, never a frozen actor. */
  blockedPlanCount?: number;
  routeSearch?: {status:'FOUND'|'PENDING_SEARCH'|'NO_PATH'|'SEARCH_LIMIT';target:string;expanded:number};
  motion?: { fromGx: number; fromGy: number; toGx: number; toGy: number; toFloor?: number; elapsedMs: number; updatedAt?: number };
  workOutputs?: Record<string, number>;
  deliveryWait?:{containerId:string;signature:string};
  workOutputSources?:Record<string,{sourceId?:string;jobId:string;recipe?:string;inputs?:{uid:string;key:string;qty:number;containerId:string}[];stationId?:string}>;
  harvestJob?: {id:string;sourceId:string;gx:number;gy:number;floor:number;key:string;phase:'source'|'delivery';storeId?:string;startedAt:number};
  knownRecipes?: string[];
  recipeBoardAt?:number;
  recipeBoardPending?:boolean;
  procurementSourceKeys?:string[];
  recipeSourceReports?:SourceReport[];
  recipeKnownReports?:SourceReport[];
  recipeKnownRequestId?:string;
  patrolPostIndex?: number;
  lastWatchAt?: number;
  guardedEntityId?: string;
  nextPerceptionAt?: number;
  lastTalkAt?: number;
  gameDrop?: {entityId:string;stackUid:string;creatureId:string};
  nextMedicalReviewAt?: number;
  lastWorkBlock?: string;
  tradeTrustReceipts?: Record<string, number>;
  helpTrustReceipts?: Partial<Record<'food'|'water'|'medical',string>>;
  confrontationAttempt?: { scene: string; at: number; attempts: number; demand: string; reaction: string; message: string };
  /** Threat-coverage evidence: what this body actually lived through during the final assault
   *  interval. Presence here never implies survival; it records reached threats and who absorbed them. */
  threat?: HumanThreatCoverage;
  /** Physical seat on an operating evacuation service. Presence here is EVIDENCE of boarding,
   *  never an outcome: the human is still alive, still on this run's ledger and still carries
   *  their own pack until a confirmed arrival ashore. */
  transit?: { tripId: string; seat: number; boardedAt: number };
}
export interface Community {
  lostWorksites?:Record<string,{type:string;tx:number;ty:number;floor:number}>;
  foodRequest?:FoodRequest;
  recipeSourceReports?:SourceReport[];
  id: string;
  poi: string;
  class: SiteClass;
  homeBeds: string[];         // actual single-sleeper bed ENTITY ids (never a chest)
  legacyHouseholdContainers?: string[];
  waterSources: string[];     // source ids
  foodStores: string[];       // container ids
  workStations: string[];     // station entity ids
  cargoLedger?:Record<string,{at:number;jobId:string;sourceId?:string;recipe?:string;inputs?:{uid:string;key:string;qty:number;containerId:string}[];stationId?:string;workerId:string;fromUid:string;intoUid:string;qty:number;key:string}[]>;
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
/** Physical service phases of ONE vessel at ONE approved boarding site. There are only three
 *  authored services (po_evac_west / po_evac_south / po_evac_hook); no service may be invented.
 *  STAGING  — before the service opens (h288): no boarding, vessel not operating yet.
 *  BOARDING — berth open: legal contact + a free seat commits one embark receipt.
 *  BERTHED  — vessel present but the boarding window is closed until `dockUntil` (reopens).
 *  IN_TRANSIT — physically away from the island; passengers are aboard, not yet evacuated.
 *  SERVICE_ENDED — last lawful departure has gone; nobody else can board this run.
 *  FAILED   — the voyage failed; living passengers are released at the berth (no outcome).
 */
export type EvacPhase = 'STAGING' | 'BOARDING' | 'BERTHED' | 'DEPARTING' | 'IN_TRANSIT' | 'SERVICE_ENDED' | 'FAILED';
export interface EvacManifestEntry {
  actorId: string;
  seat: number;
  boardedAt: number;
  /** Carried property snapshot at boarding (UIDs), so the voyage manifest is real evidence. */
  cargo?: { uid: string; key: string; qty: number }[];
  carryWeight?: number;
}
export interface EvacDepartureLog {
  round: number;
  departAt: number;
  arriveAt: number;
  departedReceipt: string;
  passengers: EvacManifestEntry[];
  arrivedAt?: number;
  arrivalReceipt?: string;
}
export interface EvacTrip {
  tripId: string;
  site: 'po_evac_west' | 'po_evac_south' | 'po_evac_hook';
  capacity: number;
  siteGx: number; siteGy: number;   // real boarding tile derived from the authored evac entity
  boarded: string[];          // actorIds physically aboard RIGHT NOW (synchronized with `manifest`)
  departed: boolean;          // legacy-present flag: true while the vessel is away from her berth
  receipt?: string;
  phase?: EvacPhase;          // absent on legacy saves -> derived from the run hour on first read
  phaseAt?: number;
  round?: number;             // 1-based service rotation
  dockUntil?: number;         // absolute deadline: boarding closes (BOARDING) / reopens (BERTHED)
  departAt?: number;
  arriveAt?: number;
  manifest?: EvacManifestEntry[];
  departures?: EvacDepartureLog[];
  arrivalReceipt?: string;
  playerAboard?: boolean;
  failureReason?: string;
  vessel?: { holdId:string; hull:number; helm?:string; wearAt?:number; stranded?:boolean };
}
export interface ElderAssault {
  elderId: string;            // Surtur/Typhon/Aion/Atlas/Argus/Anubis
  alive: boolean;
  awakenedAt?: number;
  lairGx: number; lairGy: number; lairFloor: number;
  routeTargets: { poi: string; gx: number; gy: number; floor: number; at: number }[];
  lastAttackAt?: number;
  defeatedAt?: number;
  /** Current physical position: changes ONLY at a resolved arrival (no teleport). */
  gx?: number; gy?: number;
  /** Absolute instant of the next lawful approach wave. */
  nextWaveAt?: number;
  /** Timed approach/contact ledger (one entry per wave). Never a damage multiplier. */
  events?: ElderAssaultEvent[];
  /** Bounty of a body that fell outside the loaded window; landed when that ground is loaded. */
  pendingLoot?: ElderPendingLoot;
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
  playerAid?: {id:string;actorId:string;stackUid:string;kind:'food'|'water'|'medical';startedAt:number;dueAt:number;floor:number;px:number;py:number;hp:number};
  version: string;
  sourceLayout: number;
  people: Record<string, HumanRecord>;
  communities: Record<string, Community>;
  arrivals: Record<string, ArrivalToken>;
  evacuation: Record<string, EvacTrip>;
  elderPressure: Record<string, ElderAssault>;
  events: Record<string, HumanEvent>;
  incidents: Record<string, HumanIncident>;
  robberyByUid?: Record<string,string>;
  /** Legacy needs-clock field retained for save compatibility. */
  lastResolvedAt: number;
  /** Independent clocks prevent needs advancement from suppressing autonomous movement. */
  lastNeedsAt?: number;
  lastStepAt?: number;
  plannerCursor?: number;
  plannerAt?: number;
  nextActorSeq: number;
  nextIncidentSeq?: number;
  /** Set exactly once when the player's vessel has physically ARRIVED offshore. The run is
   *  ended by the world clock (engine.endRun) from this receipt; boarding alone never ends it. */
  playerEvacArrivedAt?: number;
  playerEvacTripId?: string;
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
export const EVAC_SITES = ['po_evac_west', 'po_evac_south', 'po_evac_hook'] as const;
/** One shared schedule authority for every service (absolute run-clock law, never per-call drift). */
export function evacSchedule() {
  const s = BAL.evacuation ?? {};
  return {
    openHour: Number(s.serviceOpensHour ?? 288),
    lastDepartureHour: Number(s.lastDepartureHour ?? 324),
    dockMs: Number(s.dockHours ?? 2) * HOUR,
    transitMs: Number(s.transitHours ?? 4) * HOUR,
    returnMs: Number(s.returnHours ?? 2) * HOUR,
    seats: Number(s.seatsPerTrip ?? 6),
    boardingRadius: Number(s.boardingRadiusTiles ?? 1.5),
    playerRadius: Number(s.playerBoardingRadiusTiles ?? 2.5),
  };
}
/** Absolute time of a given real run hour (same arithmetic the world clock uses). */
function evacHourAt(r: RunState, hour: number): number { return r.startedAt - (r.qaOffset ?? 0) + hour * HOUR; }
export function seedEvacTrips(hw: HumanWorld, positions: Record<string, [number, number]>): void {
  const seats = evacSchedule().seats;
  for (const site of EVAC_SITES) {
    const tripId = `evac:${site}`;
    if(!positions[site])continue;
    const [gx, gy] = positions[site];
    hw.evacuation[tripId] = {
      tripId, site, capacity: seats, siteGx: gx, siteGy: gy, boarded: [], departed: false,
      phase: 'STAGING', round: 0, manifest: [], departures: [],
    };
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
    hw.elderPressure[id] = { elderId: id, alive: true, lairGx: loc.gx, lairGy: loc.gy, lairFloor: loc.floor, routeTargets: [], gx: loc.gx, gy: loc.gy, events: [] };
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
  const w = h.equip.weapon; if (!w || w.dur===0) return null;
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
// site function templates; capacity/supply certification is still outstanding, NOT one NPC per POI.
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
export function seedPopulation(r: RunState, hw: HumanWorld, sites: { id: string; name: string; archetype: string; rooms: number; bbox: [number, number, number, number]; spawnTiles?: [number, number][]; stationTiles?: { gx: number; gy: number; struct: string }[]; bedTiles?: {gx:number;gy:number;floor:number;approach:[number,number]}[] }[], elderLairs?: Record<string, { gx: number; gy: number; floor: number }>, authoredEvacPositions?: Record<string, [number, number]>): void {
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
    const stock = communityStock(cls, site.rooms);
    // At genesis the berth's regional allocation is stowed in two places.
    // Rowing/sailing consumes travel rations, not anonymous fuel. No load path
    // allocates a hull, a container or a missing ration to an older run.
    const trip=hw.evacuation[`evac:${site.id}`];
    if(trip){
      const hold=mkContainer(r,'bag',6);trip.vessel={holdId:hold.id,hull:100};
      for(const [key,limit] of [['berries',4],['water_flask',1],['spares',2]] as const){
        const qty=Math.min(limit,stock[key]??0);if(qty){addItem(r,hold.id,key,qty);stock[key]-=qty;}
      }
    }
    for (const [k, q] of Object.entries(stock)) if(q>0)addItem(r, store.id, k, q);
    const comm: Community = {
      id: communityId, poi: site.id, class: cls, homeBeds: [],
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
    const storeEntity: Entity = { id: storeEntityId, owner:communityId, floor:0, kind: 'bag', hp:60,maxHp:60, x: storeTile[0] * TILE + 8, y: storeTile[1] * TILE + 8, tx: storeTile[0], ty: storeTile[1], c: store.id, label: `${site.name} Community Store`, poi: site.id };
    if (lx >= 1 && ly >= 1 && lx < WW - 1 && ly < WH - 1) {
      storeEntity.x = lx * TILE + 8; storeEntity.y = ly * TILE + 8; storeEntity.tx = lx; storeEntity.ty = ly;
      r.entities[storeEntity.id] = storeEntity;
    } else {
      (r.veyraOffscreenEntities ??= {})[storeEntity.id] = storeEntity;
    }
    hw.communities[communityId] = comm;
    // Functional registration of actual authored bed props, not a residential quota.
    // A resident without an available slot remains unhoused; no invisible rest credit.
    for (const slot of site.bedTiles ?? []) {
      const id=uid(r,'e'),lx=slot.gx-ox,ly=slot.gy-oy;
      const bed:Entity={id,kind:'struct',type:'bed_straw',floor:slot.floor,tx:slot.gx,ty:slot.gy,x:slot.gx*TILE+8,y:slot.gy*TILE+8,hp:STRUCTS.bed_straw.hp,maxHp:STRUCTS.bed_straw.hp,owner:communityId,poi:site.id,label:`${site.name} sleeping place`};
      if(lx>=1&&ly>=1&&lx<WW-1&&ly<WH-1){bed.tx=lx;bed.ty=ly;bed.x=lx*TILE+8;bed.y=ly*TILE+8;r.entities[id]=bed;}
      else(r.veyraOffscreenEntities??={})[id]=bed;
      comm.homeBeds.push(id);
    }

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
        owner: communityId, poi: site.id, label: `${site.name} ${authored.struct.replace('_', ' ')}`,
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
        community: communityId, home: communityId, bedId: comm.homeBeds[placed],
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
/** A needs read transaction owns a single bed-claim index. It is deliberately not
 * retained across calls: migration/tests can edit assignments without markDirty. */
export interface HumanNeedsContext { shelter: HumanShelterContext; bedClaims: Map<string, number> }
export function humanNeedsContext(r: RunState, hw: HumanWorld): HumanNeedsContext {
  const bedClaims = new Map<string, number>();
  for (const h of Object.values(hw.people)) if (h.bedId && h.state !== 'DEAD' && h.state !== 'EVACUATED')
    bedClaims.set(h.bedId, (bedClaims.get(h.bedId) ?? 0) + 1);
  return { shelter: humanShelterContext(r), bedClaims };
}
/** A custody chest is not a sleeping slot. Assignment must resolve to one actual bed,
 * with a single living claimant physically resting beside it on the same floor. */
export function usingHumanBed(r: RunState, hw: HumanWorld, h: HumanRecord, context?:HumanShelterContext, claims?:Map<string,number>): boolean {
  if (h.state !== 'IDLE' || h.following || !h.bedId) return false;
  const bed = findRunEntity(r,h.bedId);
  if (!bed || bed.type !== 'bed_straw' || (bed.floor ?? 0) !== h.floor || (bed.hp ?? 0) <= 0 || bed.owner!==h.community) return false;
  if ((claims ?? humanNeedsContext(r,hw).bedClaims).get(h.bedId) !== 1) return false;
  const [gx,gy]=humanEntityTile(r,bed);
  if(Math.hypot(h.gx-gx,h.gy-gy)>1.5 || !humanShelter(r,h.gx,h.gy,h.floor,context))return false;
  const o=r.sourceMap?.veyra?.originAu,ox=o?Math.round(o[0]/.5):0,oy=o?Math.round(o[1]/.5):0;
  if(r.entities[bed.id]===bed && h.floor===(r.veyraFloor??0)) return clearPhysicalLine(r,{x:(h.gx-ox+.5)*TILE,y:(h.gy-oy+.5)*TILE},bed,true);
  // Outside the camera, the sleeper must be cardinally adjacent to the same real
  // bed and inside its actual enclosure. No distance-free community rest.
  return Math.abs(h.gx-gx)+Math.abs(h.gy-gy)<=1;
}

/** Advance hunger/thirst/rest/wounds for every active human by elapsed real time. */
export function tickNeeds(r: RunState, hw: HumanWorld, now: number): void {return timedWorldWork('tickNeeds',()=>{
  const lastNeedsAt = hw.lastNeedsAt ?? hw.lastResolvedAt;
  const dtMs = now - lastNeedsAt;
  if (dtMs <= 0) return; // every physical interval is integrated before an actor changes activity
  const context=humanNeedsContext(r,hw),shelterContext=context.shelter;
  const hours = dtMs / HOUR;
  const hungerRate = BAL.player.offlineHungerPerHour;
  const thirstRate = BAL.player.offlineThirstPerHour;
  for (const h of Object.values(hw.people)) {
    if (h.state === 'DEAD' || h.state === 'EVACUATED') continue;
    // Active humans consume faster when working/fighting; distant use the baseline rate.
    const active = h.state === 'WORKING' || h.state === 'FIGHTING' || h.state === 'MOVING';
    const m = active ? 1.25 : 1.0;
    const hungerBefore=h.hunger, thirstBefore=h.thirst;
    h.hunger = clamp(h.hunger - hungerRate * hours * m, 0, 100);
    h.thirst = clamp(h.thirst - thirstRate * hours * m, 0, 100);
    if ((hungerBefore>40&&h.hunger<=40)||(hungerBefore>25&&h.hunger<=25)||(hungerBefore>5&&h.hunger<=5)||(thirstBefore>40&&h.thirst<=40)||(thirstBefore>25&&h.thirst<=25)||(thirstBefore>5&&h.thirst<=5)) {
      h.nextThinkAt=now; h.blockedPlanCount=0;
    }
    h.warmth = clamp(h.warmth - (humanShelter(r, h.gx, h.gy, h.floor,shelterContext) ? 0 : 0.4 * hours), 20, 100);
    if (h.hunger <= 0 || h.thirst <= 0) {
      // starvation / dehydration: HP drain, work stops
      // Charge only the elapsed portion AFTER exhaustion, never the whole offline interval.
      const exhaustedMs=(before:number,rate:number)=>Math.max(0,dtMs-(before<=0?0:rate>0?before/rate*HOUR:Infinity));
      const drain = BAL.player.starveDamagePerMin / 60000 * (exhaustedMs(hungerBefore,hungerRate*m)+exhaustedMs(thirstBefore,thirstRate*m));
      if (drain > 0) applyDamage(r, hw, h, drain, 0, now, 'starvation', undefined, h.floor);
      if (h.hunger <= 0 || h.thirst <= 0) {
        if (h.intent?.kind === 'work') { h.intent.blockReason = h.hunger <= 0 ? 'too hungry to work' : 'too thirsty to work'; }
      }
    }
    // rest debt: grows when not resting on a bed
    if (!usingHumanBed(r, hw, h,shelterContext,context.bedClaims)) h.rest = clamp(h.rest + dtMs / HOUR / 8, 0, 1);
    else h.rest = clamp(h.rest - dtMs / HOUR / 4, 0, 1);
    // bleeding escalation (provisional: 8 min stabilize window, ~20 min fatal)
    for (const w of h.wounds) {
      if (w.bleeding && !w.treated && w.bleedingUntil && now >= w.bleedingUntil) {
        // untreated severe bleeding escalates
        if (now - (w.bleedingUntil - 8 * 60000) >= 20 * 60000) {
          applyDamage(r, hw, h, 60, 0, now, 'untreated_bleeding', undefined, h.floor);
          w.bleeding = false;
        }
      }
    }
  }
  hw.lastNeedsAt = now;
  // Keep the legacy serialized clock monotonic for older readers and migrations.
  hw.lastResolvedAt = now;
});}

/** Permission is not physical access. Distant logistics must deliver goods via real routes. */
function reachableHumanStores(r: RunState, hw: HumanWorld, h: HumanRecord): Container[] {
  const comm = h.community ? hw.communities[h.community] : undefined;
  if (!comm?.storeEntityId||['DEAD','DOWNED','EVACUATED'].includes(h.state)) return [];
  const e=findRunEntity(r,comm.storeEntityId);
  if(!e?.c||!comm.storeContainers.includes(e.c)||!comm.foodStores.includes(e.c)||!r.custody[e.c]||!humanCanUseEntity(r,h,e))return [];
  if(e.owner?e.owner!==h.community:r.custody[e.c].origin?.sourceId!==`regional-human-economy:${comm.poi}`)return [];
  const nav=humanNavigation(r),[gx,gy]=humanEntityTile(r,e);
  if(!nav.free({tx:h.gx,ty:h.gy,floor:h.floor},h,true)||[1,5].includes(nav.cell({tx:gx,ty:gy,floor:h.floor}).cls))return [];
  return [r.custody[e.c]];
}

/** Eat/drink from carried or community stock (real item custody).
 *  Water is consumed by CHARGE (a flask holds N drinks), not by qty; an empty flask grants no thirst. */
export function humanConsume(r: RunState, hw: HumanWorld, h: HumanRecord, kind: 'food' | 'water', now: number): boolean {
  if (h.state === 'DEAD' || h.state === 'DOWNED' || h.state === 'EVACUATED' || (kind === 'food' ? h.hunger : h.thirst) >= 100) return false;
  const containers: Container[] = [humanPack(r, h)];
  // Do not construct physical navigation for a stock that cannot satisfy this
  // need. This is a live custody read each call, not a stale failed-plan cache.
  const edible=(s:Stack|null)=>!!s&&!s.production&&s.qty>0&&(kind==='food'?!!ITEMS[s.key].food?.hunger:!!(ITEMS[s.key].food?.thirst||ITEMS[s.key].waterContainer)&&(ITEMS[s.key].charge==null||(s.charge??0)>0));
  if(!containers[0].slots.some(edible)){
    const comm=h.community?hw.communities[h.community]:undefined;
    if(comm?.foodStores.some(id=>r.custody[id]?.slots.some(edible)))containers.push(...reachableHumanStores(r,hw,h));
  }
  for (const c of containers) {
    for (const s of c.slots) {
      if (!s || s.production || s.qty <= 0) continue;
      const d = ITEMS[s.key];
      if (kind === 'food' && d.food?.hunger) {
        const want = 100 - h.hunger;
        const got = Math.min(want, d.food.hunger);
        h.hunger = clamp(h.hunger + got, 0, 100);
        if (d.food.thirst) h.thirst = clamp(h.thirst + d.food.thirst, 0, 100);
        if (d.food.hp) h.hp = clamp(h.hp + d.food.hp, 0, h.maxHp);
        s.qty--; if (s.qty <= 0) { const i = c.slots.indexOf(s); c.slots[i] = null; }
        h.blockedPlanCount=0;h.nextThinkAt=now;
        receipt(r, now, 'human.eat', `${h.actorId}:${s.key}`);
        receipt(r,now,'human.consume',JSON.stringify({actorId:h.actorId,uid:s.uid,key:s.key,containerId:c.id,qty:1}));
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
        h.blockedPlanCount=0;h.nextThinkAt=now;
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
function simulateHumanOutput(slots: (Stack | null)[], yields: [string, number][],claim?:{jobId:string;workerId:string}): boolean {
  const trial = slots.map(s => s ? { ...s } : null);
  for (const [rawKey, rawQty] of yields) {
    const key = liveItemId(rawKey), d = ITEMS[key]; let qty = Math.ceil(rawQty * liveItemPer(rawKey));
    const mergeable = !claim && d.max > 1 && !d.dur && !d.charge;
    if (mergeable) for (const s of trial) {
      if (!s || s.key !== key || s.meta !== undefined || s.dur !== undefined || s.charge !== undefined || qty <= 0) continue;
      const moved = Math.min(qty, d.max - s.qty); s.qty += moved; qty -= moved;
    }
    for (let i = 0; i < trial.length && qty > 0; i++) if (!trial[i]) {
      const moved = Math.min(qty, d.max); trial[i] = { uid: 'capacity-probe', key, qty: moved,production:claim }; qty -= moved;
    }
    if (qty > 0) return false;
  }
  slots.splice(0, slots.length, ...trial);
  return true;
}
export function humanHarvest(r: RunState, hw: HumanWorld, h: HumanRecord, tx: number, ty: number, now: number, global=false): { result: 'yield' | 'empty' | 'none' | 'blocked'; got?: number; key?: string; reason?: string } {
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED') return { result: 'blocked', reason: 'actor unavailable' };
  const s = global?globalSourceAt(r,tx,ty,h.floor,now):sourceAt(r, tx, ty, now);
  if (!s) return { result: 'none', reason: 'source unavailable' };
  // PLAYER_EXPLORATION sources are never depleted by NPC autonomous scavenging.
  if ((global&&'protected' in s&&s.protected)||(!global&&isPlayerExplorationSource(r,s.key,tx,ty))) return { result: 'blocked', key: s.key, reason: 'player-exploration cache protected' };
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  const targetGx=global?tx:ox+tx,targetGy=global?ty:oy+ty;
  const localX=targetGx-ox,localY=targetGy-oy;
  const unavailable=()=>({ result:'blocked' as const,key:s.key,reason:'source is not physically reachable on this floor'});
  if(Math.hypot(h.gx-targetGx,h.gy-targetGy)>1.5)return unavailable();
  if(global){
    const nav=humanNavigation(r);
    if(!nav.free({tx:h.gx,ty:h.gy,floor:h.floor},h,true)||[1,3,5].includes(nav.cell({tx:targetGx,ty:targetGy,floor:h.floor}).cls))return unavailable();
    if(h.gx!==targetGx&&h.gy!==targetGy&&(!nav.free({tx:h.gx,ty:targetGy,floor:h.floor},h,true)||!nav.free({tx:targetGx,ty:h.gy,floor:h.floor},h,true)))return unavailable();
  } else {
    const from={x:(h.gx-ox+.5)*TILE,y:(h.gy-oy+.5)*TILE},to={x:(localX+.5)*TILE,y:(localY+.5)*TILE};
    if(h.floor!==(r.veyraFloor??0)||localX<0||localY<0||localX>=WW||localY>=WH||!clearPhysicalLine(r,from,to,true,true))return unavailable();
  }
  const states='states' in s?s.states:r.sources;
  const st=states[s.i]??(states[s.i]={stock:s.stock,hp:s.hp});
  if('localSources' in s&&s.localSources)s.localSources[s.localIndex]=st;
  if (st.stock <= 0) return { result: 'empty', key: s.key, reason: 'source depleted' };
  const tool = h.equip.weapon;
  const toolKey = tool?.key;
  if (h.stamina < 2 || tool?.dur !== undefined && tool.dur <= 0) return { result: 'blocked', key: s.key, reason: 'exhausted or broken tool' };
  // Hand-gatherable plants are real shared sources; solid timber/ore/scrap still require an equipped tool.
  const power = s.def.harvestBy ? (toolKey ? (s.def.harvestBy[toolKey] ?? 0) : 0) : (toolKey ? (ITEMS[toolKey]?.power?.[s.def.mat] ?? 0) : s.def.mat === 'plant' ? 1 : 0);
  if (power <= 0) return { result: 'blocked', key: s.key, reason: 'required tool is unavailable' };
  const claim=global&&h.harvestJob?{jobId:h.harvestJob.id,workerId:h.actorId}:undefined;
  const per = s.def.hp / s.def.stock;
  const pack = humanPack(r, h);
  const oneUnitProbe = pack.slots.map(s => s ? { ...s } : null);
  if (!simulateHumanOutput(oneUnitProbe, s.def.yields.map(([k, q]) => [k, q] as [string, number]),claim)) return { result: 'blocked', key: s.key, reason: 'pack full; no harvest was taken' };
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
    if (!simulateHumanOutput(capacityProbe, s.def.yields.map(([k, q]) => [k, q] as [string, number]),claim)) break;
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
    const left = addItem(r, pack.id, k, q,claim?{production:claim}:undefined);
    if (left > 0) throw new Error(`human harvest capacity invariant: ${left} ${k} could not enter ${pack.id}`);
    got += Math.ceil(q * liveItemPer(k));
  }
  st.stock -= units;
  if(st.stock<=0&&s.def.block)markDirty();
  h.stamina -= 2;
  if (tool?.dur !== undefined) { tool.dur = Math.max(0, tool.dur - 1); if (tool.dur === 0) h.equip.weapon = null; }
  if (st.stock <= 0 && s.def.regrow) { st.regrowFrom = now; st.regrowAcc = 0; }
  receipt(r, now, 'human.harvest', `${h.actorId}:${s.key}@${tx},${ty}:-${units}`);
  // WORK ACCIDENT: solid material can hurt the hand that works it. Deterministic on the actor, the
  // node and the moment (no Math.random in the sim), small, and it wounds rather than kills — so a
  // real injury exists in the world that a real medic has to treat.
  if (s.def.mat !== 'plant') {
    let hash = 0x9e3779b9 ^ h.actorId.length;
    for (const ch of `${h.actorId}:${tx},${ty}:${Math.floor(now / 60000)}`) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    const roll = (hash >>> 0) % 23;
    if (roll === 0) {
      // Minor accident: a cut or a wrenched wrist.
      applyDamage(r, hw, h, 6, 0, now, 'hazard', h.actorId, h.floor);
      receipt(r, now, 'human.harvest.accident', `${h.actorId}:${s.key}@${tx},${ty}`);
    } else if (roll === 1) {
      // Serious accident: a slab or a load comes down on the worker. This downs them where they
      // stand, which is the ONLY way a real untreated patient exists for a medic to reach.
      applyDamage(r, hw, h, h.hp + 1, 0, now, 'hazard', h.actorId, h.floor);
      receipt(r, now, 'human.harvest.crush', `${h.actorId}:${s.key}@${tx},${ty}`);
    }
  }
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
  // A body aboard a vessel at sea is out of reach of island weapons. While berthed they are
  // still a physical target at the quay (no invulnerability is granted by boarding alone).
  if (h.transit) { const trip = hw.evacuation[h.transit.tripId]; if (trip && (trip.phase === 'IN_TRANSIT'||trip.phase==='BERTHED'&&trip.vessel?.helm||trip.vessel?.stranded)) return false; }
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
      kind: 'assault', victim: h.actorId, aggressor: attackerId, witnesses: incidentWitnesses(r,hw,h,attackerId), at: now,
      place: { tx: h.gx, ty: h.gy, floor: h.floor }, injury: true, resolved: false,
    }, now);
    formGrievance(r, hw, h, attackerId, now, incident.id);
  }
  if(h.hp>0 && attackerId && (source==='human'||source==='player'||source==='enemy') && h.state!=='DOWNED' && (humanWeapon(h)||readyCore(r,h,now))) {
    h.motion=undefined;h.state='FIGHTING';h.intent={intentId:`defend:${h.actorId}:${now}`,actorId:h.actorId,kind:'fight',target:attackerId,preconditions:['direct physical assault'],reserved:[],startAt:now,dueAt:now};
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
  releaseEvacSeat(r, hw, h, now, 'downed at the berth');
  h.state = 'DOWNED';
  h.downedAt = now;
  h.nextMedicalReviewAt = now;
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
  containers.push(...reachableHumanStores(r,hw,h));
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
  releaseEvacSeat(r, hw, h, now, 'died at the berth');
  h.state = 'DEAD';
  h.deadAt = now;
  if(h.harvestJob){receipt(r,now,'human.harvest.cancel',`${h.harvestJob.id}:worker died; cargo stays with corpse`);delete h.harvestJob;}
  h.motion = undefined; h.intent = undefined;
  h.hp = 0;
  h.outcome = 'DEAD';
  // One recoverable corpse bag entity (kind 'bag') with its own custody container.
  const corpseC = mkContainer(r, 'bag', humanPack(r, h).slots.length + humanCart(r,h).slots.length + 5);
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
    const sources: (Stack | null)[] = [...humanPack(r, h).slots,...humanCart(r,h).slots];
    for (const slot of ['weapon', 'body', 'head', 'legs', 'feet'] as const) sources.push(h.equip[slot]);
    let dest = 0;
    for (const stack of sources) if (stack) corpseC.slots[dest++] = stack;
  }
  humanPack(r, h).slots.fill(null);humanCart(r,h).slots.fill(null);
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

export type BarterLine = { uid: string; qty: number };
/** Selection is keyed by physical UID, never by a slot that might now hold another item. */
function planBarter(r: RunState, h: HumanRecord, offer: BarterLine[], ask: BarterLine[]) {
  const player = r.custody.inv, pack = humanPack(r, h);
  if (['DOWNED','DEAD','EVACUATED','ON_VESSEL','FIGHTING'].includes(h.state)) return {ok:false as const, reason:'It is not safe to barter right now.'};
  if (!Array.isArray(offer) || !Array.isArray(ask) || !offer.length || !ask.length) return {ok:false as const, reason:'Choose at least one item from each pack.'};
  // Only two small containers participate. Stage withdrawals first (full packs
  // can swap), then use the real empty-slot/merge rules. Failed quotes allocate
  // no persistent identity, consume no goods, and never reward Trust.
  const copy = (c: Container): Container => ({...c, slots:c.slots.map(s=>s?{...s}:null)});
  const src=copy(player), dst=copy(pack), draft={...r, custody:{[src.id]:src,[dst.id]:dst}};
  const withdraw=(c:Container, lines:BarterLine[])=>{
    if(lines.length>c.slots.length)return null;
    const seen=new Set<string>(), moved:Stack[]=[];
    for(const l of lines){
      if(!l || !Number.isSafeInteger(l.qty) || l.qty<1 || seen.has(l.uid))return null;
      const i=c.slots.findIndex(s=>s?.uid===l.uid), s=c.slots[i];
      if(!s || l.qty>s.qty || s.production)return null;
      seen.add(l.uid);
      if(l.qty===s.qty){moved.push(s);c.slots[i]=null;}
      else{moved.push({...s,uid:uid(draft,'s'),qty:l.qty});s.qty-=l.qty;}
    }
    return moved;
  };
  const give=withdraw(src,offer), take=withdraw(dst,ask);
  if(!give||!take)return {ok:false as const,reason:'A selected item or quantity is unavailable, or reserved for work.'};
  const offeredValue=give.reduce((n,s)=>n+humanTradeItemValue(s,h),0);
  const requestedValue=take.reduce((n,s)=>{
    const lastNeeded=!dst.slots.some(v=>v?.key===s.key)&&((ITEMS[s.key].food?.hunger&&h.hunger<45)||(ITEMS[s.key].food?.thirst&&h.thirst<45));
    return n+humanTradeItemValue(s,h)*(lastNeeded?1.8:1);
  },0);
  const corePremium=take.some(s=>ITEMS[s.key].creatorCore)&&!give.some(s=>ITEMS[s.key].creatorCore);
  const gap=Math.ceil(requestedValue*(corePremium?0.9:0.85)-offeredValue);
  if(gap>0)return {ok:false as const,gap,offeredValue,requestedValue,reason:`Counter-offer: add ${gap} value points or ask for fewer goods.`};
  const lineage:{from:string;parent:string;portion:string;to:string;uid:string;qty:number}[]=[];
  function deposit(c:Container,from:Container,stacks:Stack[],lines:BarterLine[]){
    return stacks.every((s,i)=>{
      const before=new Map(c.slots.flatMap(v=>v?[[v.uid,v.qty] as const]:[]));
      if(!addStack(draft,c.id,s))return false;
      for(const v of c.slots){if(!v)continue;const qty=v.qty-(before.get(v.uid)??0);if(qty>0)lineage.push({from:from.id,parent:lines[i].uid,portion:s.uid,to:c.id,uid:v.uid,qty});}
      return true;
    });
  }
  if(!deposit(dst,src,give,offer)||!deposit(src,dst,take,ask))return {ok:false as const,reason:'Not enough room in both packs for this exchange.'};
  const mass=(stacks:Stack[])=>stacks.reduce((n,s)=>n+ITEMS[s.key].w*s.qty,0);
  const delta=mass(take)-mass(give), worn=Object.values(h.equip).filter((s):s is Stack=>!!s);
  const humanLimit=BAL.player.carryLimit+worn.reduce((n,s)=>n+(ITEMS[s.key].carryBonus??0),0);
  const humanMass=mass(pack.slots.filter((s):s is Stack=>!!s))+mass(worn);
  if((delta>0 && invWeight(r)+delta>carryLimit(r)+1e-6) || (delta<0 && humanMass-delta>humanLimit+1e-6))return {ok:false as const,reason:'The added weight is more than one of us can carry.'};
  return {ok:true as const,reason:'Both packs can make this exchange.', offeredValue,requestedValue,src,dst,lineage,nextId:draft.nextId};
}
function barterRevision(r:RunState,h:HumanRecord,offer:BarterLine[],ask:BarterLine[],offeredValue:number,requestedValue:number) {
  return JSON.stringify([r.id,h.actorId,h.floor,h.gx,h.gy,r.custody.inv.id,h.inv.packId,r.custody.inv.slots,humanPack(r,h).slots,offer,ask,offeredValue,requestedValue]);
}
export function quoteHumanBarter(r:RunState,h:HumanRecord,offer:BarterLine[],ask:BarterLine[]):HumanTradeEvaluation & {revision?:string} {
  const plan=planBarter(r,h,offer,ask);const {ok,reason,offeredValue,requestedValue}=plan;
  return {ok,reason,offeredValue,requestedValue,revision:plan.ok?barterRevision(r,h,offer,ask,plan.offeredValue,plan.requestedValue):undefined};
}
/** Return a proposal, never a transfer. Only ask for items already selected by the player. */
export function counterHumanBarter(r:RunState,h:HumanRecord,offer:BarterLine[],ask:BarterLine[]) {
  const initial=planBarter(r,h,offer,ask);
  if(initial.ok||!initial.gap)return null;
  const more=offer.map(l=>({...l}));
  for(const l of more){const stack=r.custody.inv.slots.find(s=>s?.uid===l.uid);if(!stack) return null;
    const unit=humanTradeItemValue({...stack,qty:1},h), gap=initial.gap;
    l.qty=Math.min(stack.qty,l.qty+Math.max(1,Math.ceil(gap/unit)));
    if(planBarter(r,h,more,ask).ok)return {offer:more,ask:ask.map(l=>({...l}))};
  }
  for(const l of ask){const less=[{uid:l.uid,qty:1}];if(planBarter(r,h,offer,less).ok)return {offer:offer.map(l=>({...l})),ask:less};}
  return null;
}
export function commitHumanBarter(r:RunState,hw:HumanWorld,h:HumanRecord,offer:BarterLine[],ask:BarterLine[],now:number,revision:unknown):TradeResult {
  const plan=planBarter(r,h,offer,ask);if(!plan.ok)return {ok:false,reason:plan.reason};
  if(revision!==barterRevision(r,h,offer,ask,plan.offeredValue,plan.requestedValue))return {ok:false,reason:'The quoted goods or terms changed. Review the offer again.'};
  r.custody.inv.slots=plan.src.slots;humanPack(r,h).slots=plan.dst.slots;r.nextId=plan.nextId;
  faceTowardPlayer(r,h);const ids=[...offer,...ask].map(l=>l.uid);
  h.tradeTrustReceipts??={};if(!Object.keys(h.tradeTrustReceipts).length)h.trust=clamp((h.trust??50)+1,0,100);
  h.tradeTrustReceipts[ids.slice().sort().join('|')]??=now;
  recordIncident(r,hw,{kind:'trade',victim:h.actorId,aggressor:'player',witnesses:[],at:now,place:{tx:h.gx,ty:h.gy,floor:h.floor},property:ids,resolved:true},now);
  receipt(r,now,'human.exchange',JSON.stringify({actor:h.actorId,lines:plan.lineage}));
  return {ok:true,transferred:[...offer,...ask].reduce((n,l)=>n+l.qty,0)};
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

/** Trade MANY kinds in one committed transaction. Either every line moves or none does: the source
 *  is debited only by what actually landed in the human's pack, and a failed transfer puts back
 *  exactly what it took (same slot, same UID) before reporting the refusal. */
export function tradeBasketWithHuman(r: RunState, hw: HumanWorld, h: HumanRecord, fromCid: string,
  lines: { key: string; qty: number }[], now: number): { ok: boolean; reason?: string; transferred?: { key: string; qty: number }[] } {
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED') return { ok: false, reason: 'incapacitated' };
  if (h.state === 'FIGHTING') return { ok: false, reason: 'too dangerous to trade' };
  const src = r.custody[fromCid]; if (!src) return { ok: false, reason: 'no source custody' };
  const pack = humanPack(r, h);
  if (src === pack) return { ok: false, reason: 'source and destination are the same pack' };
  const want = new Map<string, number>();
  for (const l of lines) {
    if (!Number.isSafeInteger(l.qty) || l.qty <= 0) return { ok: false, reason: 'invalid basket quantity' };
    want.set(l.key, (want.get(l.key) ?? 0) + l.qty);
  }
  if (!want.size) return { ok: false, reason: 'empty basket' };
  for (const [key, qty] of want) {
    let have = 0; for (const s of src.slots) if (s?.key === key) have += s.qty;
    if (have < qty) return { ok: false, reason: `not enough ${key}` };
  }
  // A later line can fail *after* addStack placed or merged an earlier
  // line. Restore both containers, including receiver quantities and split
  // UID allocation. Keep original objects for other live custody readers.
  const beforeId = r.nextId;
  const before = [src, pack].map(c => ({ c, slots: c.slots.slice(), quantities: c.slots.map(s => s?.qty) }));
  const rollback = () => {
    for (const { c, slots, quantities } of before) {
      slots.forEach((s, i) => { if (s) s.qty = quantities[i]!; c.slots[i] = s; });
    }
    r.nextId = beforeId;
  };
  const moved: { key: string; qty: number }[] = [];
  for (const [key, qtyWant] of want) {
    let left = qtyWant;
    for (let i = 0; i < src.slots.length && left > 0; i++) {
      const s = src.slots[i]; if (!s || s.key !== key) continue;
      const take = Math.min(left, s.qty);
      const stack: Stack = take === s.qty ? s : { ...s, uid: uid(r, 's'), qty: take };
      if (!addStack(r, pack.id, stack)) { rollback(); return { ok: false, reason: 'no carrying capacity' }; }
      if (take === s.qty) src.slots[i] = null;
      else s.qty -= take;
      left -= take;
    }
    if (left > 0) { rollback(); return { ok: false, reason: `not enough ${key}` }; }
    moved.push({ key, qty: qtyWant });
  }
  receipt(r, now, 'human.trade.basket', `${h.actorId}:${moved.map(m => `${m.key}x${m.qty}`).join('+')}`);
  return { ok: true, transferred: moved };
}

/** Take an accessible item from a human's carried pack (robbery / loot).
 *  Transfers by UID via addStack (K1 conservation); a stack that cannot fit keeps its identity
 *  in the human's pack (never re-minted, never silently dropped). */
export function lootHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, intoContainerId: string): { taken: number; reason?: string } {
  if (h.state === 'DEAD' || h.state === 'EVACUATED') return { taken: 0, reason: 'no corpse here' };
  if (h.state !== 'DOWNED') return { taken: 0, reason: 'must be downed to loot' };
  const dst = r.custody[intoContainerId]; if (!dst) return { taken: 0, reason: 'no destination custody' };
  const pack = humanPack(r, h);
  let taken = 0;const property:string[]=[];
  for (let i = 0; i < pack.slots.length; i++) {
    const s = pack.slots[i]; if (!s) continue;
    if (addStack(r, dst.id, s)) { pack.slots[i] = null; taken += s.qty;property.push(s.uid); }
    // If addStack refused (no room / non-mergeable), the stack stays in the pack — identity preserved.
  }
  if(taken>0){
    if(intoContainerId==='inv')recordIncident(r,hw,{kind:'theft',victim:h.actorId,aggressor:'player',witnesses:incidentWitnesses(r,hw,h,'player'),property,at:now,place:{tx:h.gx,ty:h.gy,floor:h.floor},resolved:false},now);
    receipt(r, now, 'human.loot', `${h.actorId}:-${taken}`);
  }
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
export function startHumanAid(r:RunState,hw:HumanWorld,h:HumanRecord,id:string,stackUid:string,now:number): {ok:boolean;reason?:string;msg?:string} {
  if(hw.playerAid)return {ok:false,reason:'Finish or cancel your current aid first.'};
  if(['DEAD','EVACUATED','FIGHTING'].includes(h.state))return {ok:false,reason:'It is not safe to help right now.'};
  const s=C(r,'inv').slots.find(s=>s?.uid===stackUid);if(!s)return {ok:false,reason:'Choose supplies from your own pack.'};
  const d=ITEMS[s.key];
  const kind=(['bandage','herb'].includes(s.key)&&(h.state==='DOWNED'||h.wounds.some(w=>!w.treated)))?'medical':d.waterContainer&&(s.charge??0)>0&&h.thirst<35?'water':d.food?.hunger&&h.hunger<35&&h.state!=='DOWNED'?'food':undefined;
  if(!kind)return {ok:false,reason:'That item does not meet a current urgent need.'};
  if(h.state==='DOWNED'&&kind!=='medical')return {ok:false,reason:'Stabilize the patient before feeding them.'};
  hw.playerAid={id,actorId:h.actorId,stackUid,kind,startedAt:now,dueAt:now+(kind==='medical'?6000:1500),floor:h.floor,px:r.player.x,py:r.player.y,hp:r.player.hp};
  receipt(r,now,'human.aid.start',`${id}:${h.actorId}:${kind}:${stackUid}`);
  return {ok:true,msg:kind==='medical'?'Treating · stay beside the patient for six seconds.':'Offering supplies · stay nearby.'};
}
export function stepPlayerHumanAid(r:RunState,hw:HumanWorld,now:number):void {
  const a=hw.playerAid;if(!a)return;
  const h=hw.people[a.actorId],s=C(r,'inv').slots.find(s=>s?.uid===a.stackUid);
  const o=r.sourceMap?.veyra?.originAu,ox=o?Math.round(o[0]/.5):0,oy=o?Math.round(o[1]/.5):0;
  const dest=h?{x:(h.gx-ox+.5)*TILE,y:(h.gy-oy+.5)*TILE}:undefined;
  if(!h||!s||r.player.dead||r.player.hp<a.hp||['DEAD','EVACUATED','FIGHTING'].includes(h.state)||h.floor!==(r.veyraFloor??0)||a.floor!==h.floor||Math.hypot(r.player.x-a.px,r.player.y-a.py)>TILE||!dest||Math.hypot(r.player.x-dest.x,r.player.y-dest.y)>TILE*3.2||!clearPhysicalLine(r,r.player,dest,true)){
    delete hw.playerAid;receipt(r,now,'human.aid.cancel',a.id);return;
  }
  if(now<a.dueAt)return;
  delete hw.playerAid;
  const d=ITEMS[s.key];let useful=false;
  if(a.kind==='medical'&&['bandage','herb'].includes(s.key)&&(h.state==='DOWNED'||h.wounds.some(w=>!w.treated))){h.wounds.forEach(w=>{w.treated=true;w.bleeding=false;});h.hp=Math.min(h.maxHp,h.hp+30);h.state='IDLE';h.downedAt=undefined;useful=true;}
  if(a.kind==='water'&&d.waterContainer&&(s.charge??0)>0&&h.thirst<35){h.thirst=Math.min(100,h.thirst+(d.food?.thirst??30));s.charge!--;useful=true;}
  if(a.kind==='food'&&d.food?.hunger&&h.hunger<35&&h.state!=='DOWNED'){h.hunger=Math.min(100,h.hunger+d.food.hunger);h.thirst=Math.min(100,h.thirst+(d.food.thirst??0));useful=true;}
  if(!useful){receipt(r,now,'human.aid.cancel',`${a.id}:need changed`);return;}
  if(a.kind!=='water'&&--s.qty===0)C(r,'inv').slots[C(r,'inv').slots.indexOf(s)]=null;
  const selfCaused=h.disposition_known.incidents.some(id=>{const i=hw.incidents[id];return i?.aggressor==='player'&&i.kind!=='trade';});
  h.helpTrustReceipts??={};
  if(!selfCaused&&!h.helpTrustReceipts[a.kind]){h.trust=clamp((h.trust??50)+(a.kind==='medical'?5:3),0,100);h.helpTrustReceipts[a.kind]=a.id;}
  receipt(r,now,'human.aid.commit',`${a.id}:${h.actorId}:${a.kind}:${s.uid}`);
}
export type HumanTalkTopic = 'activity' | 'needs' | 'place' | 'goods' | 'accompany';
export function talkToHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, topic?: HumanTalkTopic): string {
  if (h.state === 'DEAD' || h.state === 'EVACUATED') return 'No response.';
  if (h.state === 'DOWNED') return `${h.name} is down and cannot answer.`;
  faceTowardPlayer(r, h);
  if (!h.disposition_known.knownPeople.includes('player')) h.disposition_known.knownPeople.push('player');
  h.lastTalkAt = now;
  const facts: string[] = [`${h.name} · ${h.occupation} · ${h.community ? hw.communities[h.community]?.poi ?? 'traveler' : 'traveler'}`];
  if(h.civilDecision)facts.push(h.civilDecision.reason);
  if (h.intent?.kind === 'work' && h.intent.target?.match(/^(global-harvest|harvest):/)) {
    const m=h.intent.target.match(/^(?:global-harvest:(-?\d+):|harvest:)(\d+),(\d+)$/);
    const s=m?(m[1]!==undefined?globalSourceAt(r,Number(m[2]),Number(m[3]),Number(m[1]),now):sourceAt(r,Number(m[2]),Number(m[3]),now)):null;
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
  const latest=knownIncidents.filter(i=>['theft','assault','robbery','murder'].includes(i.kind)).at(-1);
  const heard=latest && h.disposition_known.testimony?.[latest.id];
  const news=latest?(heard?`${hw.people[heard.from]?.name??'A witness'} told me about the ${latest.kind}. I did not see it myself.`:latest.witnesses.includes(h.actorId)?`I saw the ${latest.kind} here.`:undefined):undefined;
  const response = topic === 'activity' ? activity
    : topic === 'needs' ? needs.join(' ')
    : topic === 'place' ? news??place
    : topic === 'goods' ? packSummary
    : topic === 'accompany' ? (h.following ? 'I am already traveling with you.' : h.disposition === 'predatory' ? 'No. I will not travel with you.' : recentWarning(hw,h,now)??((h.trust ?? 50) < 55 ? 'I do not know you well enough to travel together. Show me I can rely on you first.' : 'I would consider traveling with you. Ask me to join when you are ready.'))
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
  const demandedQuantity=demanded?.qty;
  if (demand === 'item' && (!demanded || demanded.production)) return { ok: false, reason: 'That carried item is no longer accessible.' };
  if (demand === 'disarm' && !h.equip.weapon) return { ok: false, reason: 'They are not carrying an equipped weapon.' };
  if (demand === 'stop_attack' && h.state !== 'FIGHTING') return { ok: false, reason: 'They are not attacking anyone right now.' };
  faceTowardPlayer(r, h);
  const witnesses=incidentWitnesses(r,hw,h,'player');
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
    recordIncident(r, hw, { kind: reaction === 'COMPLY' && demand === 'item' ? 'robbery' : 'assault', victim: h.actorId, aggressor: 'player', witnesses, at: now, place: { tx: h.gx, ty: h.gy, floor: h.floor }, property: reaction === 'COMPLY' && demanded ? [demanded.uid] : undefined, robbedQuantity:reaction==='COMPLY'&&demand==='item'?demandedQuantity:undefined, injury: false, resolved: reaction === 'COMPLY' && demand!=='item' }, now);
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

function recentWarning(hw:HumanWorld,h:HumanRecord,now:number){
  if(h.disposition!=='protective'&&h.occupation!=='guard')return;
  for(const id of Object.keys(h.disposition_known.testimony??{}).reverse()){
    const i=hw.incidents[id],victim=i?.victim?hw.people[i.victim]:null;
    if(i?.aggressor==='player' && !i.resolved && victim && (victim.community===h.community || h.protectedPeople.includes(victim.actorId)) && now-i.at<=30*60000)return 'Someone here reported that you hurt or robbed one of ours. I am staying with them.';
  }
}
export function recruitHuman(r: RunState, hw: HumanWorld, h: HumanRecord, now: number): { ok: boolean; reason?: string } {
  if (h.following) return { ok: false, reason: 'already a companion' };
  if (h.state === 'DOWNED' || h.state === 'DEAD' || h.state === 'EVACUATED' || h.state === 'FIGHTING') return { ok: false, reason: 'not available to recruit' };
  if(h.transit||h.state==='ON_VESSEL')return {ok:false,reason:'I am already aboard.'};
  const warning=recentWarning(hw,h,now);if(warning)return {ok:false,reason:warning};
  if (h.disposition === 'predatory') return { ok: false, reason: 'this survivor will not join you' };
  if ((h.trust ?? 50) < 55) return { ok: false, reason: 'I do not know you well enough yet. Show that I can rely on you first.' };
  faceTowardPlayer(r, h);
  setFollowing(r, hw, h, true, now);
  return { ok: true };
}

export function setFollowing(r: RunState, hw: HumanWorld, h: HumanRecord, follow: boolean, now: number): void {
  if(h.harvestJob){receipt(r,now,'human.harvest.cancel',`${h.harvestJob.id}:companion assignment changed; owned cargo retained`);delete h.harvestJob;}
  h.following = follow; h.motion=undefined;
  if (follow) {
    h.state = 'IDLE';
    h.intent = { intentId: `follow:${h.actorId}:${now}`, actorId: h.actorId, kind: 'follow', preconditions: ['accepted companion recruitment'], reserved: [], startAt: now, dueAt: now, route: [] };
  } else {
    h.followOrder = undefined;
    h.intent = undefined;
    if (h.state === 'MOVING') h.state = 'IDLE';
  }
  receipt(r, now, 'human.follow', `${h.actorId}:${follow ? 'on' : 'off'}`);
}

/** Resolve one companion order. Hard physical impossibility and protected relations are checked
 *  BEFORE risk/obedience. The decision persists for one orderId (no per-frame reroll). */
export function resolveOrder(r: RunState, hw: HumanWorld, h: HumanRecord, orderId: string, order: CompanionCommand, now: number, targetActorId?: string): { result: OrderResult; reason: string } {
  const prior=h.orderDecisions?.[orderId];
  if(prior)return {result:prior.result,reason:prior.reason};
  const finish=(result:OrderResult,reason:string)=>{
    const decision={orderId,order,target:targetActorId,result,reason,at:now};
    (h.orderDecisions??={})[orderId]=decision;h.followOrder=decision;
    receipt(r,now,'human.order',`${h.actorId}:${orderId}:${order}:${result}:${reason}`);
    return {result,reason};
  };
  if (['DOWNED','DEAD','EVACUATED'].includes(h.state)) return finish('CANNOT_EXECUTE','incapacitated');
  // A companion aboard an evacuation vessel is physically at sea (or holding a seat at the quay):
  // no order can be executed from there, and the honest answer says so.
  if (h.state === 'ON_VESSEL' || h.transit) return finish('CANNOT_EXECUTE', 'aboard the evacuation vessel');
  if (!h.following) return finish('REFUSE_WITH_REASON','not a companion');
  if (order === 'home' && !h.home) return finish('CANNOT_EXECUTE','no home to return to');
  if (order === 'carry' && !targetActorId && humanCart(r,h).slots.every(Boolean)) return finish('CANNOT_EXECUTE','cart full');
  if (order==='carry' && targetActorId) {
    const store=deliveryStore(r,hw,h,targetActorId);
    if(!store)return finish('CANNOT_EXECUTE','That is not an operating warehouse of my community.');
    if(!humanCart(r,h).slots.some(Boolean))return finish('CANNOT_EXECUTE','Load goods into my cart first.');
  }
  if(order==='defend'){
    const blocked=combatEquipmentBlock(r,h,now);if(blocked)return finish('CANNOT_EXECUTE',blocked);
    if(h.hp<h.maxHp*.3 || h.stamina<6 || h.rest>.9)return finish('RETREAT_OR_HOLD','I cannot protect you in this condition.');
    return finish('OBEY','stay near the player and watch for threats');
  }
  if(order==='engage') {
    const p=targetActorId ? hw.people[targetActorId] : undefined;
    const m=r.creatures.find(m=>m.id===targetActorId && m.state!=='dead');
    if(!p&&!m)return finish('CANNOT_EXECUTE','identify a visible target first');
    const floor=p?.floor ?? m!.floor ?? r.veyraFloor ?? 0;
    if(floor!==h.floor || h.floor!==(r.veyraFloor??0))return finish('CANNOT_EXECUTE','cannot reach that floor');
    const o=r.sourceMap?.veyra?.originAu,ox=o?Math.round(o[0]/.5):0,oy=o?Math.round(o[1]/.5):0;
    const origin={x:(h.gx-ox+.5)*TILE,y:(h.gy-oy+.5)*TILE};
    const dest=p?{x:(p.gx-ox+.5)*TILE,y:(p.gy-oy+.5)*TILE}:m!;
    if(Math.hypot(dest.x-origin.x,dest.y-origin.y)>TILE*10 || !clearPhysicalLine(r,origin,dest,true))return finish('CANNOT_EXECUTE','target is not in sight');
    if(p && (h.protectedPeople.includes(p.actorId)||!!h.community&&p.community===h.community))return finish('PROTECT_TARGET',"I will not harm someone I protect.");
    if(p && ['DOWNED','DEAD','EVACUATED'].includes(p.state))return finish('REFUSE_WITH_REASON','I will not attack an incapacitated person.');
    const blocked=combatEquipmentBlock(r,h,now);if(blocked)return finish('CANNOT_EXECUTE',blocked);
    const knownAttack=p ? p.intent?.kind==='fight' && (p.intent.target==='player'||p.intent.target===h.actorId||h.protectedPeople.includes(p.intent.target??'')) || h.disposition_known.incidents.some(id=>{const i=hw.incidents[id];return i?.aggressor===p.actorId && (i.victim===h.actorId||i.victim==='player'||h.protectedPeople.includes(i.victim??''));}) : ['attack','chase'].includes(m!.state);
    if(!knownAttack && (h.disposition==='neutral'||h.disposition==='protective'))return finish('REFUSE_WITH_REASON','I will not start a fight with someone who has not threatened us.');
    if(h.hp<h.maxHp*.3 || h.stamina<6 || h.rest>.9)return finish('RETREAT_OR_HOLD','I cannot survive that fight in this condition.');
    if(p && p.hp>h.hp*2 && h.combatProficiency<2 && h.disposition!=='predatory')return finish('RETREAT_OR_HOLD','That opponent is too strong for me.');
  }
  return finish('OBEY','accepts the order');
}

function deliveryStore(r:RunState,hw:HumanWorld,h:HumanRecord,id:string){
  const c=h.community?hw.communities[h.community]:undefined;
  if(c?.storeEntityId!==id)return;
  const e=findRunEntity(r,id);
  if(e?.c && r.custody[e.c] && e.owner===c.id && c.storeContainers.includes(e.c) && (e.hp??1)>0)return e;
}
/** Reach the actual warehouse first. Stage the entire load so a full last slot
 * or a changed manifest never leaves half a delivery behind. */
function stepCompanionDelivery(r:RunState,hw:HumanWorld,h:HumanRecord,now:number,occupied:Set<string>){
  const intent=h.intent!, job=intent.delivery!;
  if(intent.dueAt>now)return;
  intent.dueAt=now+1000;
  const store=deliveryStore(r,hw,h,job.storeId);
  if(!store || store.c!==job.containerId){intent.blockReason='My warehouse is unavailable; cargo stays in the cart.';return;}
  if(!humanCanUseEntity(r,h,store)){
    const [tx,ty]=humanEntityTile(r,store),route=humanNavigation(r,occupied,true).route(h,{tx,ty,floor:store.floor??0});
    if(!route?.length){intent.blockReason='No confirmed access to the warehouse yet.';return;}
    intent.route=route;intent.startAt=now;intent.blockReason=undefined;h.state='MOVING';return;
  }
  const cart=humanCart(r,h),dest=r.custody[job.containerId];
  const staged={...dest,slots:dest.slots.map(s=>s?{...s}:null)}, draft={...r,custody:{[dest.id]:staged}};
  const indices:number[]=[];
  for(const line of job.cargo){
    const i=cart.slots.findIndex(s=>s?.uid===line.uid),stack=cart.slots[i];
    if(!stack || stack.qty!==line.qty || indices.includes(i) || stack.production){intent.blockReason='The loaded goods changed; cancel and select a new delivery.';return;}
    if(!addStack(draft,dest.id,{...stack})){intent.blockReason='Warehouse full; the entire load is still in my cart.';return;}
    indices.push(i);
  }
  dest.slots=staged.slots;r.nextId=draft.nextId;for(const i of indices)cart.slots[i]=null;
  receipt(r,now,'human.companion.deliver',JSON.stringify({actor:h.actorId,order:intent.intentId,from:cart.id,to:dest.id,cargo:job.cargo}));
  h.intent=undefined;h.state='IDLE';
  if(h.followOrder)h.followOrder.reason='Delivered the cart load. Holding at the warehouse.';
}

/** Commit the resolved command to the same locomotion/combat intent as autonomous actors. */
export function commandHuman(r:RunState,hw:HumanWorld,h:HumanRecord,id:string,order:CompanionCommand,now:number,target?:string): {ok:boolean;reason?:string;msg?:string} {
  if(h.orderDecisions?.[id]){const d=h.orderDecisions[id];return {ok:d.result==='OBEY',reason:d.reason,msg:d.reason};}
  const result=resolveOrder(r,hw,h,id,order,now,target);
  const hold=()=>{h.motion=undefined;h.intent=undefined;h.state='IDLE';};
  if(result.result!=='OBEY') {
    if(h.following && !['DOWNED','DEAD','EVACUATED'].includes(h.state) && ['PROTECT_TARGET','RETREAT_OR_HOLD'].includes(result.result))hold();
    return {ok:false,reason:result.reason};
  }
  const begin=(kind:HumanIntent['kind'],target?:string,route:HumanIntent['route']=[])=>{h.motion=undefined;h.intent={intentId:id,actorId:h.actorId,kind,target,route,preconditions:['consented companion command'],reserved:[],startAt:now,dueAt:now};h.state=route?.length?'MOVING':kind==='fight'?'FIGHTING':'IDLE';};
  if(order==='defend'){
    begin('follow');h.intent!.guardPlayer=true;
    return {ok:true,msg:'Guarding you. I will not chase a retreating threat.'};
  }
  if(order==='carry' && target){
    const store=deliveryStore(r,hw,h,target)!;
    begin('move',target);h.intent!.delivery={storeId:target,containerId:store.c!,cargo:humanCart(r,h).slots.flatMap(s=>s?[{uid:s.uid,qty:s.qty}]:[])};
    return {ok:true,msg:'Taking the loaded cart to our warehouse.'};
  }
  if(order==='follow'||order==='carry'){begin('follow');return {ok:true,msg:order==='carry'?'Ready to carry your supplies; use the cargo transfer below.':'Following by the open path.'};}
  if(order==='hold'){hold();return {ok:true,msg:'Holding this position.'};}
  if(order==='engage'){begin('fight',target);return {ok:true,msg:'Approaching the visible threat.'};}
  const o=r.sourceMap?.veyra?.originAu,ox=o?Math.round(o[0]/.5):0,oy=o?Math.round(o[1]/.5):0;
  const grid=blockGrid(r),occupied=new Set(Object.values(hw.people).filter(p=>p!==h&&p.state!=='DEAD'&&p.state!=='EVACUATED').map(p=>humanCellKey(p.floor,p.gx,p.gy)));
  let route:HumanIntent['route']|null=null;
  if(order==='home') {
    const bed=findRunEntity(r,h.bedId),comm=h.home?hw.communities[h.home]:undefined;
    const dest=bed?humanEntityTile(r,bed):comm?.storeTile;
    if(dest)route=humanRouteToAdjacent(r,h,dest[0],dest[1],grid,ox,oy,occupied,bed?.floor??h.floor);
  } else {
    // Retreat is a real walk to a reachable nearby tile farther from perceived danger.
    const threats=r.creatures.filter(m=>['attack','chase'].includes(m.state)&&(m.floor??0)===h.floor);
    const score=(gx:number,gy:number)=>threats.length?Math.min(...threats.map(m=>Math.hypot(gx-ox-m.x/TILE,gy-oy-m.y/TILE))):Math.hypot(gx-ox-r.player.x/TILE,gy-oy-r.player.y/TILE);
    const current=score(h.gx,h.gy);
    const options=[] as {gx:number;gy:number;score:number}[];
    for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){if(Math.abs(dx)+Math.abs(dy)<3)continue;const gx=h.gx+dx,gy=h.gy+dy;if(canHumanOccupy(r,h,gx,gy,grid,ox,oy,occupied)&&score(gx,gy)>current+2)options.push({gx,gy,score:score(gx,gy)});}
    options.sort((a,b)=>b.score-a.score);
    for(const p of options.slice(0,8)){route=humanRouteToAdjacent(r,h,p.gx,p.gy,grid,ox,oy,occupied);if(route?.length)break;}
  }
  if(!route){hold();const d=h.orderDecisions![id];d.result='CANNOT_EXECUTE';d.reason='No legal route to that destination is currently known.';receipt(r,now,'human.order.blocked',`${h.actorId}:${id}:${order}`);return {ok:false,reason:d.reason};}
  begin('move',order,route);
  return {ok:true,msg:order==='home'?'Walking home; I will resume my own duties when I arrive.':'Withdrawing along an open route.'};
}

// ---------------------------------------------------------------------------
// Crime, witnesses, retaliation — bounded incident ledger (no GPS, no morale currency).
// ---------------------------------------------------------------------------
/** Only identify an aggressor if both bodies can be seen from the witness.
 * No remote-window raycasts and no inference from an unexplained impact. */
function incidentWitnesses(r:RunState,hw:HumanWorld,victim:HumanRecord,aggressor:string){
  if(victim.floor!==(r.veyraFloor??0))return [];
  const o=r.sourceMap?.veyra?.originAu,ox=o?o[0]*2:0,oy=o?o[1]*2:0;
  const pos=(h:HumanRecord)=>({x:(h.gx-ox+.5)*TILE,y:(h.gy-oy+.5)*TILE});
  const v=pos(victim),attacker=hw.people[aggressor];
  const a=aggressor==='player'?r.player:attacker?.floor===victim.floor&&!attacker.transit?pos(attacker):undefined;
  const local=(p:{x:number;y:number})=>p.x>=0&&p.y>=0&&p.x<WW*TILE&&p.y<WH*TILE;
  if(!a || !local(v) || !local(a))return [];
  return Object.values(hw.people).filter(h=>{
    if(h===victim || h===attacker || h.floor!==victim.floor || h.transit || ['DEAD','DOWNED','ON_VESSEL','EVACUATED'].includes(h.state) || Math.hypot(h.gx-victim.gx,h.gy-victim.gy)>8)return false;
    const w=pos(h);return local(w)&&Math.hypot(w.x-a.x,w.y-a.y)<=8*TILE&&clearPhysicalLine(r,w,v,true)&&clearPhysicalLine(r,w,a,true);
  }).map(h=>h.actorId);
}
/** First-hand reports travel with the witness. A listener never becomes a
 * witness, learns current coordinates, or starts a fight on hearsay. */
function reportToGuard(r:RunState,hw:HumanWorld,h:HumanRecord,now:number,occupied:Set<string>){
  const inc=h.reportIncident?hw.incidents[h.reportIncident]:undefined;
  if(!inc || !inc.witnesses.includes(h.actorId) || inc.resolved || now-inc.at>30*60000){delete h.reportIncident;return false;}
  const comm=h.community?hw.communities[h.community]:null;if(!comm || h.floor!==(r.veyraFloor??0))return false;
  const o=r.sourceMap?.veyra?.originAu,ox=o?o[0]*2:0,oy=o?o[1]*2:0;
  const x=(h.gx-ox+.5)*TILE,y=(h.gy-oy+.5)*TILE;if(x<0||y<0||x>=WW*TILE||y>=WH*TILE)return false;
  const guard=comm.memberIds.map(id=>hw.people[id]).filter(p=>p && p!==h && p.actorId!==inc.aggressor && p.occupation==='guard' && p.state==='IDLE' && !p.following && !p.transit && p.floor===h.floor && !p.disposition_known.incidents.includes(inc.id) && Math.abs(p.gx-h.gx)+Math.abs(p.gy-h.gy)<=8 && clearPhysicalLine(r,{x,y},{x:(p.gx-ox+.5)*TILE,y:(p.gy-oy+.5)*TILE},true)).sort((a,b)=>Math.hypot(a.gx-h.gx,a.gy-h.gy)-Math.hypot(b.gx-h.gx,b.gy-h.gy))[0];
  if(!guard)return false;
  if(Math.abs(guard.gx-h.gx)+Math.abs(guard.gy-h.gy)>1){
    const route=humanNavigation(r,occupied,true).route(h,{tx:guard.gx,ty:guard.gy,floor:h.floor});if(!route?.length)return false;
    h.intent={intentId:`report:${inc.id}:${h.actorId}`,actorId:h.actorId,kind:'move',target:guard.actorId,preconditions:['saw the incident and a guard'],reserved:[],startAt:now,dueAt:now,route};h.state='MOVING';return true;
  }
  guard.disposition_known.incidents.push(inc.id);(guard.disposition_known.testimony??={})[inc.id]={from:h.actorId,at:now};delete h.reportIncident;
  receipt(r,now,'human.incident.report',`${inc.id}:${h.actorId}->${guard.actorId}`);return true;
}
export function recordIncident(r: RunState, hw: HumanWorld, inc: Omit<HumanIncident, 'id'>, now: number): HumanIncident {
  let id: string;
  do { const n = hw.nextIncidentSeq ?? 0; hw.nextIncidentSeq = n + 1; id = `inc:${r.id}:${n}`; } while (hw.incidents[id]);
  const full: HumanIncident = { id, ...inc };
  hw.incidents[id] = full;
  if(inc.kind==='robbery' && inc.robbedQuantity && inc.aggressor==='player')for(const uid of inc.property??[])(hw.robberyByUid??={})[uid]=id;
  if (inc.victim && hw.people[inc.victim] && !(inc.kind==='theft'&&hw.people[inc.victim].state==='DOWNED')) {
    const v = hw.people[inc.victim];
    if (!v.disposition_known.incidents.includes(id)) v.disposition_known.incidents.push(id);
    if (inc.aggressor && !v.disposition_known.knownPeople.includes(inc.aggressor)) v.disposition_known.knownPeople.push(inc.aggressor);
  }
  for (const w of inc.witnesses) {
    const wit = hw.people[w]; if (!wit) continue;
    if(!inc.resolved && ['theft','robbery','assault','murder'].includes(inc.kind)){wit.reportIncident=id;if(wit.state==='IDLE')wit.nextThinkAt=Math.min(wit.nextThinkAt??now,now);}
    if (!wit.disposition_known.incidents.includes(id)) wit.disposition_known.incidents.push(id);
    if (inc.aggressor && !wit.disposition_known.knownPeople.includes(inc.aggressor)) wit.disposition_known.knownPeople.push(inc.aggressor);
  }
  receipt(r, now, 'human.incident', `${id}:${inc.kind}`);
  return full;
}

function isRecoveryChest(e:Entity){
  // Not community stock, G1B treasure, or an unowned scenery prop. A placed
  // player chest has build provenance; legacy ownerless scenery need not.
  return e.kind==='struct' && (e.type==='chest_small'||e.type==='chest_large') &&
    (e.owner==='player'||(e.owner===undefined&&e.born!==undefined)) && !e.g1b && !e.locked && (e.hp??0)>0;
}
/** Only the victim actually watching the player put the recognizable UID away
 * learns a destination. No search over private containers or player GPS. */
export function observeRobbedDeposit(r:RunState,cid:string,itemUid:string,now:number){
  const hw=r.humanWorld, id=hw?.robberyByUid?.[itemUid];
  if(!hw || !id)return;
  const inc=hw.incidents[id],h=inc?.victim?hw.people[inc.victim]:null;
  if(!h || inc.recoveredAt!==undefined || !inc.property?.includes(itemUid) || h.transit || ['DEAD','DOWNED','EVACUATED'].includes(h.state))return;
  const chest=Object.values(r.entities).find(e=>e.c===cid&&isRecoveryChest(e));
  if(!chest || !r.custody[cid]?.slots.some(s=>s?.uid===itemUid&&s.qty===inc.robbedQuantity))return;
  const [tx,ty]=humanEntityTile(r,chest),floor=chest.floor??0;
  if(h.floor!==floor || floor!==(r.veyraFloor??0) || Math.hypot(h.gx-tx,h.gy-ty)>8)return;
  const origin={x:chest.x+(h.gx-tx)*TILE,y:chest.y+(h.gy-ty)*TILE};
  if(!clearPhysicalLine(r,origin,r.player,true)||!clearPhysicalLine(r,origin,chest,true,true))return;
  h.recoveryLead={incidentId:inc.id,uid:itemUid,chestId:chest.id,containerId:cid,tx,ty,floor,seenAt:now};
  h.nextThinkAt=Math.min(h.nextThinkAt??now,now);receipt(r,now,'human.grievance.sighting',`${inc.id}:${h.actorId}:${chest.id}`);
}

function pursueProperty(r:RunState,hw:HumanWorld,h:HumanRecord,now:number,occupied:Set<string>){
  const lead=h.recoveryLead;if(!lead)return false;
  const inc=hw.incidents[lead.incidentId];
  if(!inc || inc.kind!=='robbery' || inc.victim!==h.actorId || !inc.property?.includes(lead.uid) || inc.recoveredAt!==undefined || now-lead.seenAt>30*60000){delete h.recoveryLead;return false;}
  if(h.floor!==lead.floor || Math.abs(h.gx-lead.tx)+Math.abs(h.gy-lead.ty)>1){
    const route=humanNavigation(r,occupied,true).route(h,{tx:lead.tx,ty:lead.ty,floor:lead.floor});
    if(route?.length){h.intent={intentId:`recover:${inc.id}`,actorId:h.actorId,kind:'pursue',target:lead.chestId,preconditions:['witnessed deposit of my property'],reserved:[],startAt:now,dueAt:now,route};h.state='MOVING';return true;}
    if(h.routeSearch?.status==='PENDING_SEARCH'){h.nextThinkAt=now+1000;return true;}
    delete h.recoveryLead;h.lastWorkBlock='I cannot reach the place I saw my goods.';return false;
  }
  // The remembered location, not its current contents, was known at planning time.
  const chest=findRunEntity(r,lead.chestId),pack=humanPack(r,h),src=r.custody[lead.containerId];
  const i=src?.slots.findIndex(s=>s?.uid===lead.uid)??-1,stack=src?.slots[i];
  delete h.recoveryLead;
  if(!chest || !isRecoveryChest(chest) || chest.c!==lead.containerId || !humanCanUseEntity(r,h,chest) || !stack || stack.production || stack.qty!==(inc.robbedQuantity??0)){
    h.lastWorkBlock='My goods are gone, changed or inaccessible.';return false;
  }
  if(!addStack(r,pack.id,stack)){h.lastWorkBlock='No room to recover my goods.';return false;}
  src.slots[i]=null;inc.recoveredAt=now;inc.resolved=true;
  if(hw.robberyByUid)delete hw.robberyByUid[lead.uid];
  receipt(r,now,'human.grievance.recover',JSON.stringify({incident:inc.id,actor:h.actorId,uid:lead.uid,from:src.id,to:pack.id,qty:inc.robbedQuantity}));
  return true;
}

/** A directly attacked/wounded survivor forms a persistent retaliatory intent. */
export function formGrievance(_r: RunState, hw: HumanWorld, h: HumanRecord, aggressorId: string, _now: number, incidentId: string): void {
  const inc = hw.incidents[incidentId];
  if (!inc || inc.victim !== h.actorId || inc.aggressor !== aggressorId || h.state === 'DEAD') return;
  if (!h.disposition_known.incidents.includes(inc.id)) h.disposition_known.incidents.push(inc.id);
}

// ---------------------------------------------------------------------------
// Evacuation — ONE physical transport law for humans and the player.
// A trip record is not a ship: boarding is a physical commit at the authored berth, departure
// and arrival are timed voyages, and only a confirmed arrival ashore certifies EVACUATED.
// ---------------------------------------------------------------------------
const EVAC_SITE_NAMES: Record<string, string> = { po_evac_west: 'the western quay', po_evac_south: 'the southern slip', po_evac_hook: 'the hook jetty' };
export function evacSiteName(site: string): string { return EVAC_SITE_NAMES[site] ?? site; }
/** Absolute instant of a lawful service opening/departure hour (never measured from `now`). */
function evacWindowAt(r: RunState, hour: number): number { return evacHourAt(r, hour); }

/** Legacy/absent phases get a lawful starting point derived from the run clock only.
 *  A pre-state-machine save whose vessel already "departed" keeps its committed terminal
 *  outcomes (history is not rewritten) but can never board anyone again. */
function ensureEvacPhase(r: RunState, trip: EvacTrip, now: number): void {
  trip.manifest ??= [];
  trip.departures ??= [];
  if (!trip.phase) {
    if (trip.departed) { trip.phase = 'SERVICE_ENDED'; trip.phaseAt = now; receipt(r, now, 'evac.migrate.legacy', `${trip.tripId}:committed departure preserved`); }
    else if (runHours(r, now) >= evacSchedule().openHour) { trip.phase = 'BOARDING'; trip.phaseAt = now; trip.round = Math.max(1, trip.round ?? 1); trip.dockUntil = evacWindowAt(r, evacSchedule().lastDepartureHour); }
    else { trip.phase = 'STAGING'; trip.phaseAt = now; trip.round = trip.round ?? 0; }
  }
}

/** Physical boarding: berth open, real contact at the authored tile, a free seat, a living body. */
export function boardEvac(r: RunState, hw: HumanWorld, h: HumanRecord, tripId: string, now: number): { ok: boolean; reason?: string } {
  const trip = hw.evacuation[tripId];
  if (!trip) return { ok: false, reason: 'no such service' };
  ensureEvacPhase(r, trip, now);
  if (trip.phase !== 'BOARDING') return { ok: false, reason: trip.phase === 'IN_TRANSIT' ? 'the vessel is at sea' : trip.phase === 'SERVICE_ENDED' || trip.phase === 'FAILED' ? 'this service is no longer operating' : 'the berth is not open for boarding' };
  if (h.state === 'DEAD') return { ok: false, reason: 'cannot board a corpse' };
  if (h.state === 'DOWNED') return { ok: false, reason: 'too injured to board' };
  if (h.state === 'EVACUATED') return { ok: false, reason: 'already evacuated' };
  if (h.transit || trip.boarded.includes(h.actorId)) return { ok: false, reason: 'already aboard' };
  for (const t of Object.values(hw.evacuation)) if (t !== trip && (t.manifest ?? []).some(p => p.actorId === h.actorId)) return { ok: false, reason: 'already aboard another vessel' };
  if (h.floor !== 0) return { ok: false, reason: 'the berth is on the surface' };
  const dx = h.gx - trip.siteGx, dy = h.gy - trip.siteGy;
  if (Math.hypot(dx, dy) > evacSchedule().boardingRadius) return { ok: false, reason: 'not at the boarding berth' };
  const manifest = trip.manifest!;
  if (manifest.length >= trip.capacity) return { ok: false, reason: 'no free seat' };
  if (h.state === 'FIGHTING') return { ok: false, reason: 'cannot board while fighting' };
  const seat = freeEvacSeat(manifest, trip.capacity);
  if (seat < 0) return { ok: false, reason: 'no free seat' };
  const pack = humanPack(r, h);
  const cargo = [...pack.slots,...humanCart(r,h).slots,...Object.values(h.equip)].filter((s): s is Stack => !!s).map(s => ({ uid: s.uid, key: s.key, qty: s.qty }));
  const entry: EvacManifestEntry = { actorId: h.actorId, seat, boardedAt: now, cargo, carryWeight: cargo.reduce((n, c) => n + (ITEMS[c.key]?.w ?? 0) * c.qty, 0) };
  manifest.push(entry);
  trip.boarded.push(h.actorId);
  h.transit = { tripId, seat, boardedAt: now };
  h.state = 'ON_VESSEL';
  h.motion = undefined; h.intent = undefined; h.following = false; h.deliveryWait = undefined;
  if (h.harvestJob) { receipt(r, now, 'human.harvest.cancel', `${h.harvestJob.id}:worker boarded the evacuation vessel`); delete h.harvestJob; }
  receipt(r, now, 'human.board', `${h.actorId}:${tripId}:seat${seat}:${cargo.length}uids`);
  return { ok: true };
}

/** A body that is incapacitated at the berth no longer holds a seat: it is laid on the quay.
 *  Used by DOWNED/DEAD transitions so a saved manifest can never carry an unconscious passenger. */
function releaseEvacSeat(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, why: string): void {
  if (!h.transit) return;
  const trip = hw.evacuation[h.transit.tripId];
  if (trip) {
    trip.manifest = (trip.manifest ?? []).filter(p => p.actorId !== h.actorId);
    trip.boarded = trip.boarded.filter(id => id !== h.actorId);
  }
  delete h.transit;
  receipt(r, now, 'human.evac.release', `${h.actorId}:${why}`);
}

function freeEvacSeat(manifest: EvacManifestEntry[], capacity: number): number {
  const taken = new Set(manifest.map(p => p.seat));
  for (let i = 0; i < capacity; i++) if (!taken.has(i)) return i;
  return -1;
}

/** Physical seat for the player at the same berth law. Boarding does NOT end the run:
 *  the voyage must actually arrive (see advanceEvacuation -> playerEvacArrivedAt). */
export function playerBoardEvac(r: RunState, hw: HumanWorld, tripId: string, now: number): { ok: boolean; reason?: string; msg?: string } {
  const trip = hw.evacuation[tripId];
  if (!trip) return { ok: false, reason: 'no such service' };
  ensureEvacPhase(r, trip, now);
  if ((r.veyraFloor??0)!==0)return {ok:false,reason:'The berth is on the surface.'};
  if (Object.values(hw.evacuation).some(t=>t.playerAboard || t.manifest?.some(p=>p.actorId==='player'))) return { ok: false, reason: 'You are already aboard.' };
  if (trip.phase === 'IN_TRANSIT') return { ok: false, reason: 'The vessel is already at sea.' };
  if (trip.phase !== 'BOARDING') return { ok: false, reason: trip.phase === 'STAGING' ? 'This service has not opened yet.' : 'This service is no longer taking passengers.' };
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  const dx = ox+r.player.x/TILE-trip.siteGx-.5, dy = oy+r.player.y/TILE-trip.siteGy-.5;
  if (Math.hypot(dx, dy) > evacSchedule().playerRadius) return { ok: false, reason: 'You are not at the boarding berth.' };
  if (r.player.dead) return { ok: false, reason: 'The dead cannot board.' };
  const manifest = trip.manifest!;
  if (manifest.length >= trip.capacity) return { ok: false, reason: 'No free seat on this vessel.' };
  const seat = freeEvacSeat(manifest, trip.capacity);
  if (seat < 0) return { ok: false, reason: 'No free seat on this vessel.' };
  const pack = C(r, 'inv');
  const cargo = [...pack.slots,...C(r,'eq').slots].filter((s): s is Stack => !!s).map(s => ({ uid: s.uid, key: s.key, qty: s.qty }));
  manifest.push({ actorId: 'player', seat, boardedAt: now, cargo, carryWeight: cargo.reduce((n, c) => n + (ITEMS[c.key]?.w ?? 0) * c.qty, 0) });
  trip.boarded.push('player'); trip.playerAboard = true;
  receipt(r, now, 'player.board', `${tripId}:seat${seat}`);
  const departs = trip.dockUntil !== undefined ? Math.max(0, trip.dockUntil - now) / HOUR : 0;
  return { ok: true, msg: manifest.length >= trip.capacity
    ? 'You take the last free seat. The vessel casts off as soon as the crew is ready.'
    : `You are aboard. This vessel sails within ${Math.max(1, Math.round(departs))} h — you may step ashore until then.` };
}

/** Step ashore voluntarily. Only legal while the vessel is still berthed. */
export function leaveEvacBerth(r: RunState, hw: HumanWorld, tripId: string, now: number): { ok: boolean; reason?: string } {
  const trip = hw.evacuation[tripId];
  if (!trip) return { ok: false, reason: 'no such service' };
  ensureEvacPhase(r, trip, now);
  if (trip.phase === 'IN_TRANSIT'||trip.vessel?.stranded) return { ok: false, reason: 'The vessel is at sea.' };
  const manifest = trip.manifest ?? [];
  const entry = manifest.find(p => p.actorId === 'player');
  if (!entry) return { ok: false, reason: 'You are not aboard.' };
  trip.manifest = manifest.filter(p => p.actorId !== 'player');
  trip.boarded = trip.boarded.filter(id => id !== 'player');
  trip.playerAboard = false;
  receipt(r, now, 'player.disembark', `${tripId}:seat${entry.seat}`);
  return { ok: true };
}

/** Cast off: one manifest, one departure receipt, one real transit duration. */
function departEvacTrip(r: RunState, hw:HumanWorld, trip: EvacTrip, now: number): boolean {
  const S = evacSchedule();
  const manifest = (trip.manifest ?? []).map(p => ({ ...p }));
  const round = trip.round ?? 1;
  const vessel=trip.vessel,hold=vessel && r.custody[vessel.holdId];
  const volunteers=manifest.filter(p=>hw.people[p.actorId]?.occupation==='guard');
  const helm=[...volunteers,...manifest].find(p=>p.actorId==='player'?trip.playerAboard && !r.player.dead:hw.people[p.actorId]?.state==='ON_VESSEL' && hw.people[p.actorId].transit?.tripId===trip.tripId)?.actorId;
  const reject=(why:string)=>{failEvacTrip(r,hw,trip.tripId,now,why);return false;};
  if(!helm || !hold || !vessel)return reject('No physical helm or vessel stores at this berth.');
  const food=hold.slots.find(s=>s?.key==='berries' && !s.production),water=hold.slots.find(s=>s?.key==='water_flask' && !s.production && (s.charge??0)>0);
  if(!food||!water)return reject('Not enough rations or drinking water in the hold.');
  if(vessel.hull<25){
    const spare=hold.slots.find(s=>s?.key==='spares'&&!s.production);
    if(!spare || vessel.hull<=0)return reject('Hull unseaworthy; repair material unavailable.');
    if(--spare.qty===0)hold.slots[hold.slots.indexOf(spare)]=null;vessel.hull+=25;
    receipt(r,now,'evac.repair',`${trip.tripId}:${helm}:${spare.uid}:${vessel.hull}`);
  }
  if(--food.qty===0)hold.slots[hold.slots.indexOf(food)]=null;water.charge!--;
  vessel.helm=helm;vessel.wearAt=now;
  receipt(r,now,'evac.provision',`${trip.tripId}:${round}:${helm}:${hold.id}:${food.uid}:${water.uid}`);
  const arriveAt = now + S.transitMs;
  const log: EvacDepartureLog = { round, departAt: now, arriveAt, departedReceipt: `evac.depart:${trip.tripId}:${round}:${Math.round(now)}`, passengers: manifest };
  (trip.departures ??= []).push(log);
  trip.phase = 'IN_TRANSIT'; trip.phaseAt = now; trip.departAt = now; trip.arriveAt = arriveAt;
  trip.departed = true; trip.receipt = log.departedReceipt;
  receipt(r, now, 'evac.depart', `${trip.tripId}:round${round}:${manifest.length}/${trip.capacity}:arrive@${Math.round(arriveAt)}`);
  pushLog(r, now, `An evacuation vessel leaves ${evacSiteName(trip.site)} with ${manifest.length} aboard.`, 'gold');
  return true;
}

/** Land the vessel: every passenger still aboard becomes EVACUATED exactly once, at arrival. */
function arriveEvacTrip(r: RunState, hw: HumanWorld, trip: EvacTrip, now: number): void {
  const S = evacSchedule();
  const logs = trip.departures ?? [];
  const log = [...logs].reverse().find(l => l.arrivedAt === undefined);
  // A guard at the helm can volunteer to bring the ship back. If everybody
  // disembarks there is no uncrewed return voyage and no more berths here.
  const v=trip.vessel;
  const returnPilot=v && log?.passengers.find(p=>p.actorId===v.helm && hw.people[p.actorId]?.occupation==='guard' &&
    hw.people[p.actorId]?.state==='ON_VESSEL' && log.passengers.length>1 && runHours(r,now+S.returnMs)<S.lastDepartureHour);
  let playerLanded = false;
  if (log) {
    for (const p of log.passengers) {
      if(returnPilot && p.actorId===returnPilot.actorId)continue;
      if (p.actorId === 'player') { playerLanded = true; continue; }
      const h = hw.people[p.actorId]; if (!h) continue;
      if (h.state === 'EVACUATED' || h.state === 'DEAD') { delete h.transit; continue; }
      if (h.state === 'DOWNED') { receipt(r, now, 'human.evac.downed_aboard', p.actorId); delete h.transit; continue; }
      h.state = 'EVACUATED'; h.evacuatedAt = now; h.outcome = 'EVACUATED';
      h.motion = undefined; h.intent = undefined; h.following = false; delete h.transit;
      if (h.harvestJob) { receipt(r, now, 'human.harvest.cancel', `${h.harvestJob.id}:worker left the island`); delete h.harvestJob; }
      const comm = h.community ? hw.communities[h.community] : undefined;
      if (comm) comm.memberIds = comm.memberIds.filter(id => id !== h.actorId);
      receipt(r, now, 'human.evac.arrive', `${h.actorId}:${trip.tripId}:round${log.round}:${p.cargo?.length ?? 0}uids`);
    }
    log.arrivedAt = now;
    log.arrivalReceipt = `evac.arrive:${trip.tripId}:${log.round}:${Math.round(now)}`;
    trip.arrivalReceipt = log.arrivalReceipt;
    receipt(r, now, 'evac.arrive', `${trip.tripId}:round${log.round}:${log.passengers.length}`);
    pushLog(r, now, `The evacuation vessel from ${evacSiteName(trip.site)} reaches safe water.`, 'gold');
  }
  trip.manifest = []; trip.boarded = []; trip.playerAboard = false; trip.departed = false;
  if (playerLanded) { hw.playerEvacArrivedAt ??= now; hw.playerEvacTripId = trip.tripId; }
  if(trip.vessel){delete trip.vessel.helm;delete trip.vessel.wearAt;}
  // The vessel steams home empty. A further rotation is lawful only before the last sailing hour.
  const nextOpen = now + S.returnMs;
  trip.round = (trip.round ?? 1) + 1;
  if ((!v || returnPilot) && runHours(r, nextOpen) < S.lastDepartureHour) {
    if(v && returnPilot){trip.manifest=[returnPilot];trip.boarded=[returnPilot.actorId];v.helm=returnPilot.actorId;v.wearAt=now;}
    trip.phase = 'BERTHED'; trip.phaseAt = now; trip.dockUntil = nextOpen;
  } else {
    trip.phase = 'SERVICE_ENDED'; trip.phaseAt = now; trip.dockUntil = undefined;
    receipt(r, now, 'evac.service.end', trip.tripId);
  }
}

/** Advance every service to the current world instant. Pure causal time: calling this twice at
 *  the same instant changes nothing (idempotent), because each transition is guarded by its own
 *  absolute receipt/deadline. Returns the trip the player arrived on, if any. */
export function advanceEvacuation(r: RunState, hw: HumanWorld, now: number): { playerArrived?: string } {
  const S = evacSchedule();
  const hours = runHours(r, now);
  for (const trip of Object.values(hw.evacuation)) {
    ensureEvacPhase(r, trip, now);
    for (let guard = 0; guard < 8; guard++) {
      const phase = trip.phase;
      if (phase === 'STAGING') {
        if (hours < S.openHour) break;
        trip.phase = 'BOARDING'; trip.phaseAt = now; trip.round = Math.max(1, trip.round ?? 1);
        trip.dockUntil = evacWindowAt(r, S.lastDepartureHour);
        receipt(r, now, 'evac.open', `${trip.tripId}:round${trip.round}`);
        pushLog(r, now, `A vessel is taking passengers at ${evacSiteName(trip.site)}.`, 'gold');
        continue;
      }
      if (phase === 'BOARDING') {
        const manifest = trip.manifest!;
        const lastCall = trip.dockUntil !== undefined && now >= trip.dockUntil;
        if (manifest.length >= trip.capacity) { departEvacTrip(r, hw, trip, now); continue; }
        if (lastCall) {
          if (manifest.length > 0) { departEvacTrip(r, hw, trip, now); continue; }
          trip.phase = 'SERVICE_ENDED'; trip.phaseAt = now; trip.dockUntil = undefined;
          receipt(r, now, 'evac.service.end', trip.tripId);
        }
        break;
      }
      if (phase === 'BERTHED') {
        if(trip.vessel?.helm && trip.vessel.wearAt!==undefined && trip.dockUntil!==undefined){
          const v=trip.vessel,hours=Math.floor((Math.min(now,trip.dockUntil)-v.wearAt!)/HOUR);
          if(hours>0){v.hull=Math.max(0,v.hull-hours*4);v.wearAt!+=hours*HOUR;}
          if(!v.hull){failEvacTrip(r,hw,trip.tripId,now,'Return hull lost at sea');break;}
        }
        if (trip.dockUntil === undefined || now < trip.dockUntil) break;
        if(trip.vessel?.helm){
          const pilot=hw.people[trip.vessel.helm];if(pilot?.transit?.tripId===trip.tripId){delete pilot.transit;pilot.state='IDLE';pilot.nextThinkAt=now;}
          delete trip.vessel.helm;delete trip.vessel.wearAt;trip.manifest=[];trip.boarded=[];
        }
        trip.phase = 'BOARDING'; trip.phaseAt = now; trip.dockUntil = evacWindowAt(r, S.lastDepartureHour);
        receipt(r, now, 'evac.berth.open', `${trip.tripId}:round${trip.round}`);
        continue;
      }
      if (phase === 'IN_TRANSIT') {
        const v=trip.vessel;
        if(v && v.wearAt!==undefined && trip.arriveAt!==undefined){
          const hours=Math.floor((Math.min(now,trip.arriveAt)-v.wearAt)/HOUR);
          if(hours>0){v.hull=Math.max(0,v.hull-hours*4);v.wearAt+=hours*HOUR;}
          if(!v.hull){failEvacTrip(r,hw,trip.tripId,now,'Hull lost at sea');break;}
        }
        if (trip.arriveAt === undefined || now < trip.arriveAt) break;
        arriveEvacTrip(r, hw, trip, now);
        continue;
      }
      break;
    }
  }
  return hw.playerEvacArrivedAt !== undefined ? { playerArrived: hw.playerEvacTripId ?? 'evacuation' } : {};
}

/** One shared departure authority used by tests/tools and for a full berth that must sail now. */
export function departEvac(r: RunState, hw: HumanWorld, tripId: string, now: number): { ok: boolean; reason?: string } {
  const trip = hw.evacuation[tripId];
  if (!trip) return { ok: false, reason: 'no such service' };
  ensureEvacPhase(r, trip, now);
  if (trip.phase !== 'BOARDING') return { ok: false, reason: 'the vessel is not at the berth' };
  if ((trip.manifest ?? []).length === 0) return { ok: false, reason: 'nothing boarded' };
  trip.phase = 'BOARDING';
  return departEvacTrip(r, hw, trip, now)?{ok:true}:{ok:false,reason:trip.failureReason};
}

/** A failed/cancelled voyage releases living passengers at the berth they boarded from.
 *  Nobody is teleported home and nobody is certified evacuated by a failure. */
export function failEvacTrip(r: RunState, hw: HumanWorld, tripId: string, now: number, reason: string): { ok: boolean; released: number } {
  const trip = hw.evacuation[tripId];
  if (!trip) return { ok: false, released: 0 };
  ensureEvacPhase(r, trip, now);
  if(trip.vessel?.stranded)return {ok:false,released:0};
  if((trip.phase==='IN_TRANSIT'||trip.phase==='BERTHED'&&trip.vessel?.helm) && trip.vessel){
    // No imaginary tow back to the quay. The failed voyage keeps its manifest.
    trip.vessel.stranded=true;trip.phase='FAILED';trip.failureReason=reason;trip.phaseAt=now;
    receipt(r,now,'evac.failed',`${tripId}:at sea:${reason}`);return {ok:true,released:0};
  }
  let released = 0;
  for (const p of trip.manifest ?? []) {
    if (p.actorId === 'player') { delete hw.playerEvacArrivedAt; trip.playerAboard = false; released++; continue; }
    const h = hw.people[p.actorId]; if (!h) continue;
    if (h.transit?.tripId === tripId) delete h.transit;
    if (h.state === 'ON_VESSEL') { h.state = 'IDLE'; h.lastWorkBlock = reason; h.nextThinkAt = now + 1000; }
    released++;
  }
  trip.manifest = []; trip.boarded = []; trip.departed = false; trip.playerAboard = false;
  trip.phase = 'FAILED'; trip.phaseAt = now; trip.failureReason = reason; trip.dockUntil = undefined;
  receipt(r, now, 'evac.failed', `${tripId}:${released}:${reason}`);
  pushLog(r, now, `The evacuation service at ${evacSiteName(trip.site)} has failed: ${reason}`, 'red');
  return { ok: true, released };
}

/** The nearest open berth with a free seat, or null. Knowledge is physical: only services that
 *  are actually taking passengers right now are candidates. */
export function openEvacBerth(r: RunState, hw: HumanWorld, h: HumanRecord, now: number): EvacTrip | null {
  let best: EvacTrip | null = null, bestD = Infinity;
  for (const trip of Object.values(hw.evacuation)) {
    ensureEvacPhase(r, trip, now);
    if (trip.phase !== 'BOARDING' || (h.berthRetryAt?.[trip.tripId]??0)>now || (trip.dockUntil??Infinity)<=now) continue;
    if ((trip.manifest ?? []).length >= trip.capacity) continue;
    const d = Math.abs(h.gx - trip.siteGx) + Math.abs(h.gy - trip.siteGy);
    if (d < bestD) { bestD = d; best = trip; }
  }
  return best;
}

/** Resolve the service whose berth is nearest a real world coordinate (never invents one). */
export function nearestEvacTrip(hw: HumanWorld, gx: number, gy: number): EvacTrip | undefined {
  let best: EvacTrip | undefined, bestD = Infinity;
  for (const trip of Object.values(hw.evacuation)) {
    const d = Math.hypot((gx + 0.5) - trip.siteGx, (gy + 0.5) - trip.siteGy);
    if (d < bestD) { bestD = d; best = trip; }
  }
  return best;
}

/** True while the player is physically aboard a vessel that is at sea (island input is suspended). */
export function playerAtSea(r: RunState): boolean {
  const hw = r.humanWorld; if (!hw) return false;
  for (const trip of Object.values(hw.evacuation)) if (trip.playerAboard && (trip.phase === 'IN_TRANSIT'||trip.vessel?.stranded)) return true;
  return false;
}

/** Player-facing status line for the current berth (truthful, no invented capacity). */
export function evacBerthStatus(trip: EvacTrip): string {
  const aboard = (trip.manifest ?? []).length;
  const phase = trip.phase ?? 'STAGING';
  if (phase === 'STAGING') return 'Service not open yet.';
  if (phase === 'BOARDING') return `Taking passengers · ${aboard}/${trip.capacity} aboard`;
  if (phase === 'BERTHED') return `Vessel returning · ${aboard}/${trip.capacity} aboard`;
  if (phase === 'IN_TRANSIT') return `At sea · ${aboard}/${trip.capacity} aboard`;
  if (phase === 'FAILED') return `Service failed: ${trip.failureReason ?? 'unknown'}`;
  return 'No further sailings this run.';
}

// ---------------------------------------------------------------------------
// Elder assault — ONE global authority per canonical Elder; causal offscreen advance.
// The canonical creature (Creature.elder.key, catalog HP/patterns) is the ONLY health/identity
// authority. This layer never stores a second Elder HP: it reads the canonical body, launches
// timed approach waves from the Elder's current physical position, resolves contact with the
// shared K5 damage law, and cancels only the defeated Elder's own future waves.
// ---------------------------------------------------------------------------
/** Loot that a fallen Elder still owes the world. Drops are physical entities in WINDOW pixels, so a
 *  body that died outside the loaded window banks its bounty here and the world lands it the first
 *  time that ground is actually loaded — no teleport, no silent loss. */
export interface ElderPendingLoot { gx: number; gy: number; keys: [string, number][] }

export interface ElderAssaultEvent {
  id: string;
  elderId: string;
  wave: number;
  launchedAt: number;
  fromGx: number; fromGy: number;
  targetPoi?: string;
  targetGx: number; targetGy: number;
  arriveAt: number;
  state: 'APPROACH' | 'CONTACT' | 'PENDING_LOCAL' | 'BLOCKED';
  blockReason?: string;
  contactReceipt?: string;
  affected?: { humans: number; structures: number; downed: number; skippedLocal: number; interposed: number; ammoSpent: number };
}
/** Canonical Elder body for one identity — the single source of HP/death (never a second copy). */
export function elderCanonicalCreature(r: RunState, elderId: string): Creature | undefined {
  const hit = r.creatures.find(m => m.elder?.key === elderId);
  if (hit) return hit;
  return Object.values(r.veyraOffscreenCreatures ?? {}).find(m => m.elder?.key === elderId);
}
/** Global tile of a canonical Elder body. Archived bodies store GLOBAL pixels; a body projected in
 *  the active window stores window pixels, so its global tile needs the run's window origin. */
function canonicalElderGlobalTile(r: RunState, m: Creature): { gx: number; gy: number; archived: boolean } {
  const archived = Object.values(r.veyraOffscreenCreatures ?? {}).includes(m);
  if (archived) return { gx: Math.floor(m.x / TILE), gy: Math.floor(m.y / TILE), archived };
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  return { gx: ox + Math.floor(m.x / TILE), gy: oy + Math.floor(m.y / TILE), archived };
}
/** Move a window-projected canonical body into the archived (GLOBAL pixel) list at `gx,gy`.
 *  Streaming promotes it back into `r.creatures` when the player's window covers that ground, so
 *  there is exactly one body at all times and no duplicate. */
function archiveCanonicalElderBody(r: RunState, m: Creature, gx: number, gy: number, now: number, elderId: string): void {
  const at = r.creatures.indexOf(m);
  if (at >= 0) r.creatures.splice(at, 1);
  const gxPx = gx * TILE + 8, gyPx = gy * TILE + 8;
  m.x = gxPx; m.y = gyPx; m.tx = gxPx; m.ty = gyPx;
  m.homeX = gxPx; m.homeY = gyPx;
  m.floor = 0; m.path = null;
  (r.veyraOffscreenCreatures ??= {})[m.id] = m;
  receipt(r, now, 'elder.position.archived', `${elderId}:${gx},${gy}:${m.id}`);
}

/** The canonical body is the single position authority: it moves only at a resolved arrival, and
 *  a destination the loaded window cannot express is archived rather than invented. */
function syncCanonicalElderPosition(r: RunState, m: Creature, gx: number, gy: number, now: number, elderId: string): 'moved' | 'deferred' {
  const at = canonicalElderGlobalTile(r, m);
  if (at.gx === gx && at.gy === gy) return 'moved';
  if (at.archived) {
    m.x = gx * TILE + 8; m.y = gy * TILE + 8; m.floor = 0;
    receipt(r, now, 'elder.position', `${elderId}:archived:${at.gx},${at.gy}->${gx},${gy}`);
    return 'moved';
  }
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  const lx = gx - ox, ly = gy - oy;
  if (lx < 0 || ly < 0 || lx >= WW || ly >= WH) {
    // The destination is outside the loaded window. The body does not stay behind and it does not
    // get an invented pixel position: it is ARCHIVED at global pixels — the representation the
    // window-streaming code already maintains — so the arrival is expressible and truthful.
    archiveCanonicalElderBody(r, m, gx, gy, now, elderId);
    return 'moved';
  }
  m.x = lx * TILE + 8; m.y = ly * TILE + 8; m.floor = 0;
  receipt(r, now, 'elder.position', `${elderId}:window:${at.gx},${at.gy}->${gx},${gy}`);
  return 'moved';
}

/** SOH_PROVISIONAL threat reach: how far a walking Elder can lawfully threaten a settlement.
 *  Bounded so no Elder "reaches" the whole island, and every corridor is sampled physically. */
function elderReachTiles(): number { return 64; }
function elderTravelTilesPerHour(): number { return 6; }
function elderWaveHours(): number { return 4; }
function elderImpactTiles(): number { return 8; }
function elderAwakenHour(): number { return (BAL.run.eldersAwakenDay - 1) * 24; }

/** Bounds are the GLOBAL canonical frame, never the loaded window: settlements and lairs are
 *  addressed in global tiles, and a window-sized bound silently excluded the whole island. */
function elderTargetInBounds(toGx: number, toGy: number): boolean { return inFrame(toGx, toGy); }
/** An Elder may only strike a settlement it can actually cross to. The corridor is sampled on the
 *  canonical compiled terrain query (the same geometry the world is built from); unknown geometry
 *  is treated as NOT crossable, so nothing is fabricated. */
function elderCrossingOpen(r: RunState, fromGx: number, fromGy: number, toGx: number, toGy: number): boolean {
  if (!r.sourceMap || !isVeyra05Layout(r.layoutId || '')) return true;   // legacy island: no global geometry
  const rules = r.sourceMap.rules === 4 ? 4 : 3;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(toGx - fromGx), Math.abs(toGy - fromGy))));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const gx = Math.round(fromGx + (toGx - fromGx) * t), gy = Math.round(fromGy + (toGy - fromGy) * t);
    if (!elderTargetInBounds(gx, gy)) return false;
    const cell = globalBaseGeometry(gx, gy, 0, rules);
    if (!cell || !cell.walkable) return false;
  }
  return true;
}

/** A bounded 4-neighbour search over the compiled canonical terrain. The Elder walks ground, so a
 *  dog-leg around a wall is a lawful crossing — but an unwalkable or unknown corridor never is. The
 *  search is capped, and exhaustion is a refusal, not an optimistic yes. */
function elderRouteExists(r: RunState, fromGx: number, fromGy: number, toGx: number, toGy: number, budget = 3000, maxSteps = 160): boolean {
  if (!r.sourceMap || !isVeyra05Layout(r.layoutId || '')) return true;   // legacy island: no global geometry
  const rules = r.sourceMap.rules === 4 ? 4 : 3;
  const walkable = (x: number, y: number): boolean => {
    if (!elderTargetInBounds(x, y)) return false;
    const c = globalBaseGeometry(x, y, 0, rules);
    return !!c && c.walkable;
  };
  const reached = (x: number, y: number) => Math.abs(x - toGx) <= 1 && Math.abs(y - toGy) <= 1;
  const h = (x: number, y: number) => Math.max(Math.abs(x - toGx), Math.abs(y - toGy));
  const key = (x: number, y: number) => (y + 4096) * 100000 + (x + 4096);
  const g = new Map<number, number>([[key(fromGx, fromGy), 0]]);
  const open: { k: number; x: number; y: number; f: number }[] = [
    { k: key(fromGx, fromGy), x: fromGx, y: fromGy, f: h(fromGx, fromGy) },
  ];
  let expanded = 0;
  while (open.length && expanded < budget) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const n = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    const gn = g.get(n.k) ?? 0;
    if (gn > (g.get(n.k) ?? gn)) continue;
    expanded++;
    if (reached(n.x, n.y)) return true;
    if (gn >= maxSteps) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = n.x + dx, y = n.y + dy;
      if (!walkable(x, y)) continue;
      const k = key(x, y), ng = gn + 1;
      if (ng >= (g.get(k) ?? Infinity)) continue;
      g.set(k, ng);
      open.push({ k, x, y, f: ng + h(x, y) });
    }
  }
  return false;
}

/** Launch one physical approach wave toward the nearest reachable inhabited settlement. */
function launchElderWave(r: RunState, hw: HumanWorld, elder: ElderAssault, now: number, wave: number, finalAt: number): void {
  // The canonical body is the position authority. The ledger only records where that body has
  // actually been, so a move can never make the ledger claim ground the body never took. If the
  // window has never covered its lair the body is materialised in archived form, so an Elder that
  // threatens the island always has exactly one physical body to threaten it with.
  let body = elderCanonicalCreature(r, elder.elderId);
  if (!body || body.state !== 'dead') body = body ?? ensureArchivedElderActor(r, elder.elderId) ?? body;
  const bodyAt = body && body.state !== 'dead' ? canonicalElderGlobalTile(r, body) : undefined;
  const fromGx = bodyAt?.gx ?? elder.gx ?? elder.lairGx, fromGy = bodyAt?.gy ?? elder.gy ?? elder.lairGy;
  const reach = elderReachTiles();
  const candidates = Object.values(hw.communities)
    .map(c => {
      // The wave walks toward PEOPLE, not toward a storehouse tile: members drift tens of tiles from
      // their community's store while working, and a strike on an empty tile would hit nobody.
      const living = c.memberIds
        .map(id => hw.people[id])
        .filter((h): h is HumanRecord => !!h && h.state !== 'DEAD' && h.state !== 'EVACUATED' && h.state !== 'ON_VESSEL' && h.floor === 0);
      if (!living.length) return null;
      // Medoid of the living members: the densest inhabited point of that settlement today.
      let centre = living[0], best = Infinity;
      for (const a of living) {
        let sum = 0;
        for (const b of living) sum += Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy);
        if (sum < best) { best = sum; centre = a; }
      }
      const d = Math.abs(centre.gx - fromGx) + Math.abs(centre.gy - fromGy);
      return { poi: c.poi, gx: centre.gx, gy: centre.gy, d, living: living.length };
    })
    .filter((c): c is { poi: string; gx: number; gy: number; d: number; living: number } => !!c && c.d <= reach)
    .sort((a, b) => a.d - b.d || (a.poi < b.poi ? -1 : 1));
  const event: ElderAssaultEvent = {
    id: `elder-ev:${elder.elderId}:${wave}`, elderId: elder.elderId, wave,
    launchedAt: now, fromGx, fromGy, targetGx: fromGx, targetGy: fromGy,
    arriveAt: now, state: 'BLOCKED',
  };
  const target = candidates.slice(0, 3).find(c => elderTargetInBounds(c.gx, c.gy) && elderRouteExists(r, fromGx, fromGy, c.gx, c.gy));
  if (!target) {
    event.blockReason = candidates.length
      ? 'every settlement in range is behind terrain this Elder cannot cross'
      : `no inhabited settlement within ${reach} tiles of its current position`;
    (elder.events ??= []).push(event);
    elder.lastAttackAt = undefined; // no contact happened; nothing may look like an attack
    receipt(r, now, 'elder.assault.blocked', `${elder.elderId}:${wave}:${event.blockReason}`);
    return;
  }
  const distance = Math.max(1, Math.hypot(target.gx - fromGx, target.gy - fromGy));
  const travelMs = Math.max(HOUR, distance / elderTravelTilesPerHour() * HOUR);
  if (now + travelMs > finalAt) {
    // An attack that cannot physically cross before the final hour is never launched: the world
    // never leaves an unresolvable strike hanging over the ending.
    event.blockReason = 'no time to cross before the final hour';
    (elder.events ??= []).push(event);
    receipt(r, now, 'elder.assault.blocked', `${elder.elderId}:${wave}:${event.blockReason}`);
    return;
  }
  event.state = 'APPROACH';
  event.targetPoi = target.poi; event.targetGx = target.gx; event.targetGy = target.gy;
  event.arriveAt = now + travelMs;
  (elder.events ??= []).push(event);
  receipt(r, now, 'elder.assault.launch', `${elder.elderId}:${wave}:${target.poi}:arrive@${Math.round(event.arriveAt)}`);
}

/** After a contact the settlement's guards do the real work a garrison does: treat their wounded
 *  from supplies somebody actually made, and refill empty quivers from the community store. Every
 *  unit moved is removed from a real container, so nothing is granted out of nothing. */
function guardAfterContact(r: RunState, hw: HumanWorld, elder: ElderAssault, ev: ElderAssaultEvent, now: number, touched: HumanRecord[]): void {
  const comm = ev.targetPoi ? hw.communities[ev.targetPoi] : undefined;
  const defenders = new Map<string, HumanRecord>();
  for (const h of touched) if (h.occupation === 'guard') defenders.set(h.actorId, h);
  if (comm) for (const id of comm.memberIds) {
    const h = hw.people[id];
    if (!h || h.occupation !== 'guard') continue;
    if (h.state === 'DEAD' || h.state === 'EVACUATED' || h.state === 'ON_VESSEL') continue;
    if (h.floor !== 0 || Math.hypot(h.gx - ev.targetGx, h.gy - ev.targetGy) > 24) continue;
    defenders.set(h.actorId, h);
  }
  const list = [...defenders.values()].sort((a, b) => (a.actorId < b.actorId ? -1 : 1));
  const wounded = (h: HumanRecord) => h.state === 'DOWNED' || h.hp < h.maxHp * 0.7 || h.wounds.some(w => w.bleeding && !w.treated);
  const supplyOf = (h: HumanRecord, key: string) => humanPack(r, h).slots.reduce((n, s) => n + (s?.key === key ? s.qty : 0), 0);
  // Treatment first: a standing guard treats a downed comrade beside them, otherwise tends itself.
  for (const patient of list) {
    if (!wounded(patient)) continue;
    const treater = patient.state === 'DOWNED'
      ? list.find(g => g.actorId !== patient.actorId && g.state !== 'DOWNED' && Math.hypot(g.gx - patient.gx, g.gy - patient.gy) <= 2 && (supplyOf(g, 'bandage') > 0 || supplyOf(g, 'herb') > 0))
      : (supplyOf(patient, 'bandage') > 0 || supplyOf(patient, 'herb') > 0 ? patient : undefined);
    if (!treater) continue;
    const key = supplyOf(treater, 'bandage') > 0 ? 'bandage' : 'herb';
    const pack = humanPack(r, treater);
    const stack = pack.slots.find(s => s?.key === key && s.qty > 0);
    if (!stack || stack.qty <= 0) continue;
    stack.qty--; if (stack.qty <= 0) pack.slots[pack.slots.indexOf(stack)] = null;
    patient.wounds.forEach(w => { w.treated = true; w.bleeding = false; });
    patient.hp = Math.min(patient.maxHp, patient.hp + 30);
    if (patient.state === 'DOWNED') { patient.state = 'IDLE'; patient.downedAt = undefined; }
    receipt(r, now, 'human.guard.treat', `${treater.actorId}->${patient.actorId}:${key}:${Math.round(patient.hp)}hp`);
  }
  // Then resupply: empty quivers draw from the settlement's own store, never from nowhere.
  for (const g of list) {
    if (g.state === 'DOWNED' || g.state === 'DEAD') continue;
    const weapon = humanWeapon(g);
    if (!weapon || !ITEMS[g.equip.weapon?.key ?? '']?.ranged) continue;
    const have = supplyOf(g, 'arrow');
    if (have >= 6) continue;
    let want = 6 - have;
    if(!comm || (findRunEntity(r,comm.storeEntityId)?.hp??1)<=0)continue;
    for (const cid of comm.storeContainers) {
      if (want <= 0) break;
      const c = C(r, cid); if (!c) continue;
      const avail = c.slots.reduce((n, s) => n + (s?.key === 'arrow' ? s.qty : 0), 0);
      if (avail <= 0) continue;
      const qty = Math.min(want, avail);
      if (!addStack(r, humanPack(r, g).id, mkStack(r, 'arrow', qty))) break;   // pack full: no teleport
      removeItem(r, cid, 'arrow', qty);
      want -= qty;
      receipt(r, now, 'human.guard.resupply', `${elder.elderId}:${g.actorId}:${qty}arrow:${cid}`);
    }
  }
}

/** Resolve one arrival: real bodies, real structures, real receipts, one time only. */
/** One committed ranged shot: who fired it, from where (GLOBAL tile), and the damage it carries. The
 *  flight itself belongs to the projectile layer — this layer only proves the shot was lawful. */
export interface ElderVolleyShot { guardId: string; gx: number; gy: number; dmg: number }
type VolleyHandler = (elderId: string, shots: ElderVolleyShot[], now: number) => void;

function resolveElderContact(r: RunState, hw: HumanWorld, elder: ElderAssault, ev: ElderAssaultEvent, now: number, onVolley?: VolleyHandler): void {
  const def = PRIMORDIAL_ELDERS[elder.elderId];
  const dmg = def?.dmg ?? 18;
  const radius = elderImpactTiles();
  // If the canonical boss body is loaded in the active window, local combat owns the loaded area:
  // the same swing must not be applied twice to a body the player can see.
  const canonical = elderCanonicalCreature(r, elder.elderId);
  const moved = canonical && canonical.state !== 'dead'
    ? syncCanonicalElderPosition(r, canonical, ev.targetGx, ev.targetGy, now, elder.elderId) : 'moved';
  if (moved === 'deferred') {
    // The canonical body cannot be expressed at this settlement in the active window, so the world
    // has no lawful source for a strike here. Refuse it rather than damage a place the body is not.
    ev.state = 'BLOCKED';
    ev.blockReason = 'canonical body cannot be represented at the target in the active window';
    elder.lastAttackAt = undefined;
    receipt(r, now, 'elder.contact.deferred', `${elder.elderId}:${ev.wave}:${ev.targetGx},${ev.targetGy}`);
    pushLog(r, now, `${def?.name ?? elder.elderId} cannot close on ${ev.targetPoi ?? 'the settlement'}.`, 'dim');
    return;
  }
  ev.state = 'CONTACT';
  elder.gx = ev.targetGx; elder.gy = ev.targetGy; elder.lastAttackAt = now;
  // Only a body loaded in the ACTIVE window hands authority to local combat; an archived body does not.
  const localBody = r.creatures.find(m => m.elder?.key === elder.elderId && m.state !== 'dead');
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  let humans = 0, structures = 0, downed = 0, skippedLocal = 0, interposed = 0, ammoSpent = 0;
  const inBlast: HumanRecord[] = [];
  for (const h of Object.values(hw.people)) {
    if (h.state === 'DEAD' || h.state === 'EVACUATED' || h.state === 'ON_VESSEL') continue;
    if (h.floor !== 0) continue;
    if (Math.hypot(h.gx - ev.targetGx, h.gy - ev.targetGy) > radius) continue;
    if (localBody && h.gx >= ox && h.gy >= oy && h.gx < ox + WW && h.gy < oy + WH) { skippedLocal++; (h.threat ??= { waves: 0, hit: 0, guarded: 0 }).lastThreatAt = now; continue; }
    inBlast.push(h);
  }
  // Coverage evidence is stamped for every body the wave actually reached.
  for (const h of inBlast) {
    const cov = (h.threat ??= { waves: 0, hit: 0, guarded: 0 });
    cov.waves++; cov.lastThreatAt = now; cov.lastWaveId = ev.id;
  }
  const volleyShots: ElderVolleyShot[] = [];
  // Guards standing in the blast interpose: each armed guard covers one civilian and pays for it
  // with their own body and one OWNED ranged round. A guard with no arrow cannot cover anyone.
  const able = (g: HumanRecord) => g.hp > g.maxHp * 0.3;
  const guards = inBlast.filter(h => h.occupation === 'guard' && h.state !== 'DOWNED' && !!humanWeapon(h))
    .sort((a, b) => (Number(able(b)) - Number(able(a))) || (b.hp - a.hp) || (a.actorId < b.actorId ? -1 : 1));
  const spentGuards = new Set<string>();
  const covered = new Set<string>();          // civilians a guard physically shielded this wave
  for (const civilian of inBlast) {
    if (civilian.occupation === 'guard' || civilian.state === 'DOWNED') continue;
    const guard = guards.find(g => !spentGuards.has(g.actorId) && g.hp > 0 && g.state !== 'DOWNED');
    if (!guard) continue;
    const weapon = humanWeapon(guard);
    if (!weapon) continue;
    const ranged = !!ITEMS[guard.equip.weapon?.key ?? '']?.ranged;
    if (ranged) {
      const round = humanPack(r, guard).slots.find(s => s?.key === 'arrow');
      if (!round || round.qty <= 0) continue;            // no manufactured ammunition
      round.qty--; ammoSpent++;
      if (round.qty <= 0) { const i = humanPack(r, guard).slots.indexOf(round); humanPack(r, guard).slots[i] = null; }
    }
    spentGuards.add(guard.actorId);
    interposed++;
    // A wounded guard is not ordered forward while a fit body is still standing. When the line is
    // spent, the last body holds it — and that decision is recorded, not hidden.
    if (!able(guard)) receipt(r, now, 'human.guard.withdraw', `${guard.actorId}:last-line:${elder.elderId}`);
    if (ranged) {
      // A volley needs the canonical body within a real ranged reach of THIS guard; an Elder whose
      // body is provably elsewhere cannot be shot from here.
      const body = canonical && canonical.state !== 'dead' ? canonicalElderGlobalTile(r, canonical) : undefined;
      const reach = 40;
      if (!body || Math.hypot(body.gx - guard.gx, body.gy - guard.gy) > reach) {
        receipt(r, now, 'elder.volley.out_of_range', `${elder.elderId}:${guard.actorId}:${body ? `${body.gx},${body.gy}` : 'no-body'}`);
      } else if (!elderCrossingOpen(r, guard.gx, guard.gy, body.gx, body.gy)) {
        receipt(r, now, 'elder.volley.no_line', `${elder.elderId}:${guard.actorId}:terrain`);
      } else volleyShots.push({ guardId: guard.actorId, gx: guard.gx, gy: guard.gy, dmg: weapon.dmg * proficiencyMul(guard.combatProficiency) });
    }
    covered.add(civilian.actorId);
    (civilian.threat ??= { waves: 1, hit: 0, guarded: 0 }).guarded++;
    const wasDownGuard = guard.state === 'DOWNED';
    if (applyDamage(r, hw, guard, dmg, Math.atan2(ev.targetGy - guard.gy, ev.targetGx - guard.gx), now, 'enemy', `elder:${elder.elderId}`, 0)) {
      humans++;
      (guard.threat ??= { waves: 1, hit: 0, guarded: 0 }).hit++;
      if (!wasDownGuard && guard.state === 'DOWNED') downed++;
    }
    receipt(r, now, 'elder.guard.interpose', `${elder.elderId}:${guard.actorId}:cover:${civilian.actorId}${ranged ? ':1arrow' : ':melee'}`);
    civilian.lastWorkBlock = 'A guard took the blow that was meant for me.';
  }
  for (const h of inBlast) {
    if (spentGuards.has(h.actorId)) continue;            // already struck while interposing
    if (covered.has(h.actorId)) continue;                // a guard took this blow instead
    const wasDown = h.state === 'DOWNED';
    if (applyDamage(r, hw, h, dmg, Math.atan2(ev.targetGy - h.gy, ev.targetGx - h.gx), now, 'enemy', `elder:${elder.elderId}`, 0)) {
      humans++;
      (h.threat ??= { waves: 1, hit: 0, guarded: 0 }).hit++;
      if (!wasDown && h.state === 'DOWNED') downed++;
    }
  }
  // Guard volleys are real ranged attacks by real armed bodies; the canonical Elder body and its
  // canonical death path stay the property of the engine (see sim.ts), never a second HP table.
  if (volleyShots.length && onVolley) {
    // The world layer launches the actual arrows; damage only exists once a projectile lands.
    onVolley(elder.elderId, volleyShots, now);
    receipt(r, now, 'elder.volley', `${elder.elderId}:${volleyShots.length}guards:${Math.round(volleyShots.reduce((n, s) => n + s.dmg, 0))}dmg:${volleyShots.map(s => s.guardId).join(',')}`);
  }
  const impacted: Entity[] = [];
  for (const e of [...Object.values(r.entities), ...Object.values(r.veyraOffscreenEntities ?? {})]) {
    const isStore=e.kind==='bag' && !!e.owner && hw.communities[e.owner]?.storeEntityId===e.id;
    if ((!isStore && e.kind!=='struct') || e.hp===undefined || e.hp<=0)continue;
    if ((e.floor ?? 0) !== 0) continue;
    if (e.tx === undefined || e.ty === undefined) continue;
    const [gx,gy]=humanEntityTile(r,e);
    if (Math.hypot(gx - ev.targetGx, gy - ev.targetGy) <= radius) impacted.push(e);
  }
  for (const e of impacted) {
    const before = e.hp!;
    e.hp = Math.max(0, before - dmg * 2);
    receipt(r, now, 'elder.structure', `${elder.elderId}:${e.id}:${before}->${e.hp}`);
    if(e.hp===0 && e.kind==='bag' && e.owner){
      // The collapsed store and its contents stay on their original tile. No
      // remote rerouting of stacks: a builder must reach and brace it first.
      receipt(r,now,'human.store.collapsed',`${e.owner}:${e.id}`);
      for(const id of hw.communities[e.owner].memberIds){const h=hw.people[id];if(h?.occupation==='builder')h.nextThinkAt=now;}
    }else if (e.hp <= 0) { destroyStructure(r, e, now); receipt(r, now, 'elder.structure.destroyed', `${elder.elderId}:${e.id}`); }
    structures++;
  }
  guardAfterContact(r, hw, elder, ev, now, inBlast);
  ev.affected = { humans, structures, downed, skippedLocal, interposed, ammoSpent };
  ev.contactReceipt = `elder.contact:${elder.elderId}:${ev.wave}:${Math.round(now)}:${humans}h/${structures}s`;
  receipt(r, now, 'elder.contact', `${elder.elderId}:wave${ev.wave}:${ev.targetPoi ?? ''}:${humans}hurt/${downed}downed/${structures}structures/${interposed}interposed/${ammoSpent}ammo/${skippedLocal}local`);
  if (humans > 0 || structures > 0) pushLog(r, now, `${def?.name ?? elder.elderId} strikes ${ev.targetPoi ?? 'the settlement'}.`, 'red');
}

/** True when the canonical Elder body is currently in the archived (global-pixel) representation. */
export function elderBodyArchived(r: RunState, m: Creature): boolean {
  return Object.values(r.veyraOffscreenCreatures ?? {}).includes(m);
}

/** Land an archived Elder's bounty when the player's window finally covers the ground it fell on. */
function materialiseElderLoot(r: RunState, hw: HumanWorld, now: number): void {
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  for (const elder of Object.values(hw.elderPressure)) {
    const loot = elder.pendingLoot;
    if (!loot) continue;
    const lx = loot.gx - ox, ly = loot.gy - oy;
    if (lx < 1 || ly < 1 || lx >= WW - 1 || ly >= WH - 1) continue;
    for (const [key, qty] of loot.keys) {
      if (!ITEMS[key] || !(qty > 0)) continue;
      spawnDrop(r, key, qty, lx * TILE + 8, ly * TILE + 8, now, undefined, false);
    }
    delete elder.pendingLoot;
    receipt(r, now, 'elder.loot.landed', `${elder.elderId}:${loot.gx},${loot.gy}:${loot.keys.map(([k, q]) => `${k}x${q}`).join('|')}`);
    pushLog(r, now, `${PRIMORDIAL_ELDERS[elder.elderId]?.name ?? elder.elderId}'s remains are found where it fell.`, 'gold');
  }
}

/** An archived canonical body cannot use the local drop path (it lives in global pixels), so its
 *  defeat is booked here: the body dies once, the ledger records the defeat, and the bounty is
 *  banked on the Elder until the ground is loaded. */
export function recordArchivedElderDefeat(r: RunState, hw: HumanWorld, elderId: string, body: Creature, now: number): void {
  if (body.state === 'dead') return;
  const g = canonicalElderGlobalTile(r, body);      // read the GLOBAL tile while it is still archived
  body.state = 'dead'; body.t = 0; body.deadAt = r.clock.simMs / 1000;
  delete r.veyraOffscreenCreatures?.[body.id];
  const def = lookupElderDef(elderId);
  const keys: [string, number][] = [];
  if (def?.stone) keys.push([def.stone, 1]);
  keys.push(['spares', 6], ['crystal', 2]);
  const elder = hw.elderPressure[elderId];
  if (elder) elder.pendingLoot = { gx: g.gx, gy: g.gy, keys };
  defeatElder(r, hw, elderId, now);
  receipt(r, now, 'elder.defeat.archived', `${elderId}:${g.gx},${g.gy}:${keys.map(([k, q]) => `${k}x${q}`).join('|')}`);
  pushLog(r, now, `${def?.name ?? elderId} falls where no one is standing to see it.`, 'gold');
}

/** Advance Elder pressure: awakening at the canonical hour, timed approach waves to h336, real
 *  contact, and defeat driven by the canonical body — never a second Elder health table. */
export function advanceElderPressure(r: RunState, hw: HumanWorld, now: number, onVolley?: VolleyHandler): void {
  const hours = runHours(r, now);
  const maxHours = BAL.run.maxRunHours;
  const awaken = elderAwakenHour();
  materialiseElderLoot(r, hw, now);
  for (const elder of Object.values(hw.elderPressure)) {
    const canonical = elderCanonicalCreature(r, elder.elderId);
    if (elder.alive && !elder.defeatedAt && canonical && canonical.state === 'dead') defeatElder(r, hw, elder.elderId, now);
    if (!elder.alive) continue;
    if (elder.defeatedAt) { elder.alive = false; continue; }
    if (hours >= awaken && elder.awakenedAt === undefined) {
      elder.awakenedAt = now;
      elder.nextWaveAt ??= now;
      // An awakened Elder always has exactly one physical body, materialised in archived form until
      // the player's window covers its lair. No assault is ever booked against a body that is not.
      ensureArchivedElderActor(r, elder.elderId);
      receipt(r, now, 'elder.awaken', elder.elderId);
      const def = PRIMORDIAL_ELDERS[elder.elderId];
      pushLog(r, now, `${def?.name ?? elder.elderId} rises over ${def?.region ?? 'Veyra'}.`, 'red');
    }
    if (elder.awakenedAt === undefined || hours >= maxHours) continue;
    // Resolve every arrival that is due, at its own absolute instant (idempotent).
    for (const ev of elder.events ?? []) {
      if (ev.state === 'APPROACH' && now >= ev.arriveAt) resolveElderContact(r, hw, elder, ev, Math.max(now, ev.arriveAt), onVolley);
    }
    // One wave in flight per Elder; a defeated Elder never launches again.
    const inFlight = (elder.events ?? []).some(ev => ev.state === 'APPROACH');
    const nextWaveAt = elder.nextWaveAt ?? now;
    if (!inFlight && now >= nextWaveAt && hours < maxHours) {
      const wave = (elder.events ?? []).length + 1;
      const finalAt = r.startedAt - (r.qaOffset ?? 0) + maxHours * HOUR;
      launchElderWave(r, hw, elder, now, wave, finalAt);
      elder.nextWaveAt = now + elderWaveHours() * HOUR;
    }
  }
}

/** Mark an Elder defeated. Cancels future events for that source only. */
export function defeatElder(r: RunState, hw: HumanWorld, elderId: string, now: number): void {
  const elder = hw.elderPressure[elderId];
  if (!elder || !elder.alive) return;
  elder.alive = false;
  elder.defeatedAt = now;
  let cancelled = 0;
  for (const ev of elder.events ?? []) if (ev.state === 'APPROACH') { ev.state = 'BLOCKED'; ev.blockReason = 'the Elder was destroyed before contact'; cancelled++; }
  receipt(r, now, 'elder.defeat', `${elderId}:cancelled${cancelled}`);
  const def = PRIMORDIAL_ELDERS[elderId];
  pushLog(r, now, `${def?.name ?? elderId} is destroyed. Its threat ends.`, 'gold');
}

/** Threat-coverage ledger: is every scheduled assault resolved by this instant?
 *  APPROACH still in flight ⇒ NOT covered (a person alive during an unresolved attack is not
 *  proven to have survived it). BLOCKED is resolved WITH A REASON and never damages anyone. */
export function elderCoverage(hw: HumanWorld): { complete: boolean; pending: string[]; events: number } {
  const pending: string[] = [];
  let events = 0;
  for (const elder of Object.values(hw.elderPressure)) {
    const own = elder.events ?? [];
    for (const ev of own) {
      events++;
      if (ev.state === 'APPROACH') pending.push(ev.id);
    }
    // An awakened, undefeated Elder with no resolved wave is an UNPROVEN threat (a legacy save
    // loaded straight into the assault window), never a silent "no danger today".
    if (elder.alive && !elder.defeatedAt && elder.awakenedAt !== undefined && own.length === 0) pending.push(`${elder.elderId}:no-wave`);
  }
  return { complete: pending.length === 0, pending, events };
}

// ---------------------------------------------------------------------------
// Run-end finalization — distinct terminal outcomes, atomic before K8 wipe.
// ---------------------------------------------------------------------------
export interface HumanOutcomeSummary { total: number; evacuated: number; survived: number; dead: number; unresolved: number; }

/** Finalize every human's terminal outcome before the run wipe. No double-counting.
 *  SURVIVED_ON_ISLAND requires causal survival evidence through h336; otherwise the outcome stays UNRESOLVED — never a default "everyone survived". */
export function finalizeHumanOutcomes(r: RunState, hw: HumanWorld, now: number): HumanOutcomeSummary {
  const summary: HumanOutcomeSummary = { total: 0, evacuated: 0, survived: 0, dead: 0, unresolved: 0 };
  // Survival on the island requires the run to have actually reached the 336-hour wall AND every
  // assault wave to be resolved. An early end (evacuation/abandon) never certifies those left behind.
  const atRunEnd = runHours(r, now) >= BAL.run.maxRunHours - 1e-9;
  const coverage = elderCoverage(hw);
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
    else if (h.state === 'ON_VESSEL') { h.outcome = 'UNRESOLVED'; summary.unresolved++; }
    else if (atRunEnd && coverage.complete) {
      // Every scheduled assault wave was resolved (contact or recorded unreachable) by the final
      // instant, and the run actually reached h336: this body is proven to have survived it.
      h.outcome = 'SURVIVED_ON_ISLAND'; summary.survived++;
      // The receipt carries what this body actually lived through, not a blanket "safe".
      receipt(r, now, 'human.survive', `${h.actorId}:h336:${coverage.events}events:${h.threat?.waves ?? 0}waves/${h.threat?.hit ?? 0}hit/${h.threat?.guarded ?? 0}guarded`);
    }
    else {
      // Absence of damage is NOT proof of surviving the final assault interval.
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
function humanRouteToAdjacent(r: RunState, h: HumanRecord, targetGx: number, targetGy: number, grid: Uint8Array, ox: number, oy: number, occupied: Set<string>, targetFloor = h.floor): { tx: number; ty: number; floor: number }[] | null {
  // Camera placement must not select a second, unbounded 40,000-cell BFS.
  // Use the same resumable physical search, access rules and component proofs
  // for local workers as for archived workers. Bodies are admitted at execution.
  return humanNavigation(r,occupied).route(h,{tx:targetGx,ty:targetGy,floor:targetFloor});
}

function canHumanOccupy(r: RunState, h: HumanRecord, gx: number, gy: number, grid: Uint8Array, ox: number, oy: number, occupied: Set<string>): boolean {
  if (occupied.has(humanCellKey(h.floor, gx, gy))) return false;
  const lx = gx - ox, ly = gy - oy;
  if (h.floor !== (r.veyraFloor??0) || lx < 0 || ly < 0 || lx >= WW || ly >= WH) return true; // caller checked the global collision adapter
  const px = (lx + 0.5) * TILE, py = (ly + 0.5) * TILE;
  if (!r.player.dead && Math.hypot(px - r.player.x, py - r.player.y) < TILE * 0.7) return false;
  if (r.creatures.some(m => m.state !== 'dead' && (m.floor ?? 0) === h.floor && Math.hypot(px - m.x, py - m.y) < TILE * 0.7)) return false;
  const cell = grid[ly * WW + lx];
  return cell === 0 || cell === 4;
}
/** Move the existing stack between personal pack and equipment, never mint a
 * replacement. The old tool must fit the vacated slot; broken/claimed tools are
 * not eligible. Shares the same stack authority used by combat and harvest. */
export function equipHumanTool(r:RunState,h:HumanRecord,stackUid:string|undefined,now:number):boolean {
 if(['DEAD','DOWNED','EVACUATED'].includes(h.state))return false;
 const pack=humanPack(r,h),old=h.equip.weapon;
 if(stackUid===undefined){if(!old)return true;const i=pack.slots.indexOf(null);if(i<0)return false;pack.slots[i]=old;h.equip.weapon=null;receipt(r,now,'human.equipment',JSON.stringify({actorId:h.actorId,uid:old.uid,from:'weapon',into:pack.id}));return true;}
 const i=pack.slots.findIndex(s=>s?.uid===stackUid),s=pack.slots[i];
 if(!s||s.production||s.qty!==1||s.dur===0||!ITEMS[s.key]?.power)return false;
 pack.slots[i]=old;h.equip.weapon=s;
 receipt(r,now,'human.equipment',JSON.stringify({actorId:h.actorId,uid:s.uid,from:pack.id,into:'weapon',previousUid:old?.uid}));return true;
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
function harvestToolPower(h:HumanRecord,key:string):number {const d=SOURCES[key],t=h.equip.weapon;if(t?.dur===0)return 0;return d.harvestBy?(t?d.harvestBy[t.key]??0:0):(t?ITEMS[t.key]?.power?.[d.mat]??0:d.mat==='plant'?1:0);}
function canHarvestSource(h: HumanRecord, s: NonNullable<ReturnType<typeof sourceAt>>): boolean {
  if(h.procurementSourceKeys?.includes(s.key)&&harvestToolPower(h,s.key)>0)return true;
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
/** Next proven human event bounds the shared world integrator; distant movement uses
 * the same tile duration as visible movement, never one tile per weather slot. */
export function humanEventBoundary(r:RunState,hw:HumanWorld,at:number,maximum:number):number {return timedWorldWork('humanEventBoundary',()=>{
 let dt=maximum;
 for(const h of Object.values(hw.people)){
  if(h.state==='DEAD'||h.state==='EVACUATED')continue;
  // These are causal thresholds, not an arbitrary periodic needs tick. Continuous
  // rates are integrated by tickNeeds before movement/work can change the rate.
  const m=(h.state==='WORKING'||h.state==='FIGHTING'||h.state==='MOVING')?1.25:1;
  // Only the nearest lower threshold can be the next boundary. Avoid
  // constructing eight temporary tuples/arrays per actor on every move slice.
  const hungerThreshold=h.hunger>40?40:h.hunger>25?25:h.hunger>5?5:0;
  const thirstThreshold=h.thirst>40?40:h.thirst>25?25:h.thirst>5?5:0;
  if(h.hunger>0&&BAL.player.offlineHungerPerHour>0)dt=Math.min(dt,(h.hunger-hungerThreshold)/(BAL.player.offlineHungerPerHour*m)*HOUR);
  if(h.thirst>0&&BAL.player.offlineThirstPerHour>0)dt=Math.min(dt,(h.thirst-thirstThreshold)/(BAL.player.offlineThirstPerHour*m)*HOUR);
  const starving=(h.hunger<=0?1:0)+(h.thirst<=0?1:0);
  if(starving&&BAL.player.starveDamagePerMin>0)dt=Math.min(dt,Math.max(1,h.hp)/(starving*BAL.player.starveDamagePerMin)*60000);
  for(const w of h.wounds)if(w.bleeding&&!w.treated&&w.bleedingUntil){const due=w.bleedingUntil+12*60000;if(due>at)dt=Math.min(dt,due-at);}
  if(h.rest<.5)dt=Math.min(dt,(.5-h.rest)*8*HOUR);
  if(h.state==='DOWNED' && h.nextMedicalReviewAt!==undefined && h.nextMedicalReviewAt>at)dt=Math.min(dt,h.nextMedicalReviewAt-at);
  if(h.state==='MOVING'&&h.intent?.route?.length)dt=Math.min(dt,Math.max(.001,TILE/PROFILES[h.profile].speed*1000-(h.motion?.elapsedMs??0)));
  if(h.state==='WORKING'&&h.intent&&h.intent.dueAt>at)dt=Math.min(dt,h.intent.dueAt-at);
  if(!h.following&&h.state==='IDLE'&&(!h.intent||!!h.intent.work)){
   const due=Math.max(hw.plannerAt??at,h.nextThinkAt??at);dt=Math.min(dt,Math.max(1,due-at));
  }
 }
 // An Elder approach arrival or the next lawful wave is a causal instant of the same clock.
 for(const elder of Object.values(hw.elderPressure ?? {})){
  if(!elder.alive)continue;
  for(const ev of elder.events ?? [])if(ev.state==='APPROACH'&&ev.arriveAt>at)dt=Math.min(dt,ev.arriveAt-at);
  if(elder.awakenedAt!==undefined&&elder.nextWaveAt!==undefined&&elder.nextWaveAt>at)dt=Math.min(dt,elder.nextWaveAt-at);
 }
 // Vessel deadlines are causal instants of the same clock: a berth opening/closing or a voyage
 // arrival must be settled exactly at its own timestamp, including offline.
 for(const trip of Object.values(hw.evacuation ?? {})){
  if((trip.phase==='BOARDING'||trip.phase==='BERTHED')&&trip.dockUntil!==undefined&&trip.dockUntil>at)dt=Math.min(dt,trip.dockUntil-at);
  if(trip.vessel?.wearAt!==undefined && (trip.phase==='IN_TRANSIT'||trip.phase==='BERTHED') && trip.vessel.wearAt+HOUR>at)dt=Math.min(dt,trip.vessel.wearAt+HOUR-at);
  if(trip.phase==='IN_TRANSIT'&&trip.arriveAt!==undefined&&trip.arriveAt>at)dt=Math.min(dt,trip.arriveAt-at);
 }
 return dt;
});}
/**
 * SOH_PROVISIONAL civil-defence behaviour (no Bible number exists for who chooses to leave).
 * Once a service is operating, civilians who are neither guards nor medics may ask to go. The
 * decision is personal and deterministic per identity; the journey is always a real walk to the
 * authored berth, and a seat is only ever committed by boardEvac at contact. Nobody is deleted,
 * teleported or granted a seat by this planner.
 */
function planEvacuation(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, occupied: Set<string>): boolean {
  const S = evacSchedule();
  if (runHours(r, now) < S.openHour) return false;
  // Conditions of this body and nearby people override a stable personal
  // preference. A profession alone neither abandons nor imprisons a survivor.
  const trip=openEvacBerth(r,hw,h,now);if(!trip)return false;
  const comm=h.community?hw.communities[h.community]:undefined;
  const casualty=comm?.memberIds.some(id=>{const p=hw.people[id];return p?.state==='DOWNED' && p.floor===h.floor && Math.abs(p.gx-h.gx)+Math.abs(p.gy-h.gy)<=5;});
  let reason:string,leave:boolean;
  if(casualty && (h.occupation==='medic'||h.disposition==='protective')){leave=false;reason='I am staying to help an injured neighbor.';}
  else if(h.hp<h.maxHp*.55 || !!h.threat?.hit && h.warmth<40){leave=true;reason='I need a passage out; I cannot weather another attack here.';}
  else if(h.occupation==='guard' && h.hp>=h.maxHp*.6 && !combatEquipmentBlock(r,h,now)){leave=false;reason='I can still defend this place.';}
  else if(h.hunger>=50 && h.thirst>=50 && h.bedId && humanShelter(r,h.gx,h.gy,h.floor)){leave=false;reason='I am fed and sheltered. I will stay here.';}
  else {leave=hashInt(`${h.actorId}:leave-island`)%100<55;reason=leave?'I will try to reach the berth.':'I would rather remain on the island.';}
  h.civilDecision={kind:leave?'seek_berth':'stay',reason};if(!leave)return false;
  const route=humanNavigation(r,occupied,true).route(h,{tx:trip.siteGx,ty:trip.siteGy,floor:0});
  if(!route){
    if(h.routeSearch?.status==='PENDING_SEARCH'){h.nextThinkAt=now+1000;return true;}
    (h.berthRetryAt??={})[trip.tripId]=now+300000;
    h.lastWorkBlock='I cannot reach that berth; I will reconsider the other services.';return false;
  }
  h.intent = {
    intentId: `evacuate:${h.actorId}:${now}`, actorId: h.actorId, kind: 'evacuate', target: trip.tripId,
    preconditions: ['operating evacuation service', 'real route to the berth', 'free physical seat'],
    reserved: [], startAt: now, dueAt: now, route,
  };
  h.state = route.length ? 'MOVING' : 'IDLE';
  receipt(r, now, 'human.evac.intent', `${h.actorId}:${trip.tripId}:${route.length}`);
  if (!route.length) { h.intent = undefined; boardEvac(r, hw, h, trip.tripId, now); }
  return true;
}
function planHumanWater(r:RunState,h:HumanRecord,now:number,occupied:Set<string>):boolean {
 if(h.floor!==0 || h.thirst>=40)return false;
 const candidates:{gx:number;gy:number;distance:number}[]=[];
 // A local known catchment, not psychic island-wide water knowledge. Search and travel are separate.
 waterSearch:for(let distance=0;distance<=24;distance++)for(let dy=-distance;dy<=distance;dy++){
  const dx=distance-Math.abs(dy);
  for(let side=0;side<(dx?2:1);side++){
   const gx=h.gx+(side?dx:-dx),gy=h.gy+dy;
   if(globalFreshWater(r,gx,gy,h.floor)){candidates.push({gx,gy,distance});if(candidates.length===8)break waterSearch;}
  }
 }
 const nav=humanNavigation(r,occupied);
 for(const p of candidates.slice(0,8)){
  const route=nav.route(h,{tx:p.gx,ty:p.gy,floor:0},3000);if(!route)continue;
  h.intent={intentId:`water:${h.actorId}:${now}`,actorId:h.actorId,kind:'drink',target:`water:${p.gx},${p.gy}`,preconditions:['actual mapped potable source','physical bank contact','timed drink/refill'],reserved:[],startAt:now,dueAt:now+2000,route};
  h.state=route.length?'MOVING':'WORKING';return true;
 }
 h.lastWorkBlock='I need water; no reachable potable bank was found in my local catchment.';return false;
}
function commitHumanWater(r:RunState,h:HumanRecord,now:number):boolean {
 const intent=h.intent,m=intent?.target?.match(/^water:(\d+),(\d+)$/);if(!intent||!m||now<intent.dueAt)return false;
 const gx=Number(m[1]),gy=Number(m[2]);
 if(h.floor!==0||Math.abs(h.gx-gx)+Math.abs(h.gy-gy)>1||!globalFreshWater(r,gx,gy,0)){h.lastWorkBlock='Water access changed before the drink completed.';h.intent=undefined;h.state='IDLE';return false;}
 h.thirst=Math.min(100,h.thirst+25);
 const flask=humanPack(r,h).slots.find(s=>s&&ITEMS[s.key].waterContainer&&(s.charge??0)<ITEMS[s.key].charge!);
 if(flask)flask.charge=ITEMS[flask.key].charge!;
 receipt(r,now,'human.water',`${h.actorId}:${gx},${gy}:${flask?.uid??'direct-drink'}`);
 h.intent=undefined;h.state='IDLE';h.nextThinkAt=now+1000;return true;
}
function planAutonomousWork(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, grid: Uint8Array, ox: number, oy: number, occupied: Set<string>, protectedTiles: Set<string>): void {return timedWorldWork('planAutonomousWork',()=>{
  if(h.state==='IDLE'&&Object.values(h.workOutputs??{}).some(q=>q>0)){
    if(h.intent?.work?.phase==='travel'){receipt(r,now,'human.work.defer',`${h.actorId}:${h.intent.intentId}:deliver committed output first`);h.intent=undefined;}
    if(h.harvestJob?.phase==='source'){receipt(r,now,'human.harvest.cancel',`${h.harvestJob.id}:deliver prior committed output first`);delete h.harvestJob;}
  }
  if (h.intent?.work?.phase === 'travel' && h.state === 'IDLE') {
    planHumanOccupation(r, hw, h, now, (gx,gy,floor) => humanRouteToAdjacent(r,h,gx,gy,grid,ox,oy,occupied,floor));
    h.nextThinkAt = now + 3000; return;
  }
  if(h.harvestJob && !h.deliveryWait && !h.following && h.state==='IDLE' && !h.intent){resumeHarvestJob(r,hw,h,now,occupied);return;}
  if (h.following || h.state !== 'IDLE' || h.intent || (h.nextThinkAt ?? 0) > now) return;
  h.nextThinkAt = now + 6000;
  if (h.hp < 30 || h.stamina < 12) return;
  // An operating evacuation service takes precedence over ordinary work for those who chose it.
  if (planEvacuation(r, hw, h, now, occupied)) return;
  if (!h.community) return;
  const comm = hw.communities[h.community]; if (!comm) return;
  const need = h.thirst < 40 ? 'drink' : h.hunger < 40 ? 'eat' : undefined;
  if (need && comm.storeTile) {
    const stock = comm.foodStores.flatMap(id => r.custody[id]?.slots ?? []);
    const hasSupply = stock.some(s => s && (need === 'eat' ? (ITEMS[s.key].food?.hunger ?? 0) > 0 : (ITEMS[s.key].food?.thirst ?? 0) > 0 && (ITEMS[s.key].charge == null || (s.charge ?? 0) > 0)));
    if (hasSupply && !reachableHumanStores(r, hw, h).length) {
      const route = humanRouteToAdjacent(r, h, comm.storeTile[0], comm.storeTile[1], grid, ox, oy, occupied,findRunEntity(r,comm.storeEntityId)?.floor??0);
      if (route?.length) {
        h.intent = { intentId: `supply:${h.actorId}:${now}`, actorId: h.actorId, kind: need, target: comm.storeEntityId, preconditions: ['authorized finite stock'], reserved: [], startAt: now, dueAt: now, route };
        h.state = 'MOVING'; return;
      }
      h.lastWorkBlock = 'I need supplies, but cannot reach our store.';
    }
  }
  if(planHumanWater(r,h,now,occupied))return;
  if (h.hunger < 25 || h.thirst < 25) return;
  if(h.reportIncident && reportToGuard(r,hw,h,now,occupied))return;
  if(h.recoveryLead && pursueProperty(r,hw,h,now,occupied))return;
  if(h.deliveryWait){h.nextThinkAt=Number.MAX_SAFE_INTEGER;return;}
  const pack = humanPack(r, h);
  if(!h.equip.weapon||h.equip.weapon.dur===0){const tool=pack.slots.find(s=>s&&!s.production&&s.dur!==0&&!!ITEMS[s.key]?.power);if(tool)equipHumanTool(r,h,tool.uid,now);}
  if (h.workOutputs && Object.values(h.workOutputs).some(q => q > 0) && comm.storeTile) {
    const route = humanRouteToAdjacent(r, h, comm.storeTile[0], comm.storeTile[1], grid, ox, oy, occupied,findRunEntity(r,comm.storeEntityId)?.floor??0);
    if (!route) return;
    h.intent = { intentId: `store:${h.actorId}:${now}`, actorId: h.actorId, kind: 'work', target: 'store', preconditions: ['carry output from shared harvest', 'physical community store'], reserved: [], startAt: now, dueAt: now, route };
    h.state = route.length ? 'MOVING' : 'IDLE';
    if (!route.length) { depositHumanOutputs(r, h, now); if((h as HumanRecord).state==='IDLE')h.intent = undefined; h.nextThinkAt = Math.max(h.nextThinkAt??0,now + 6000); }
    return;
  }
  if(h.rest>=.5 && h.bedId) {
    if(usingHumanBed(r,hw,h)){h.nextThinkAt=now+10000;return;}
    const bed=findRunEntity(r,h.bedId);
    if(bed && (bed.hp??0)>0) {
      const [gx,gy]=humanEntityTile(r,bed),route=humanRouteToAdjacent(r,h,gx,gy,grid,ox,oy,occupied,bed.floor??0);
      if(route){h.intent={intentId:`rest:${h.actorId}:${now}`,actorId:h.actorId,kind:'rest',target:bed.id,preconditions:['owned physical sleeping slot'],reserved:[],startAt:now,dueAt:now,route};h.state=route.length?'MOVING':'IDLE';if(!route.length)h.intent=undefined;return;}
    }
    h.lastWorkBlock='My sleeping place is missing or unreachable.';
  }
  if (planHumanOccupation(r,hw,h,now,(gx,gy,floor)=>humanRouteToAdjacent(r,h,gx,gy,grid,ox,oy,occupied,floor))) return;
  observeRecipeSources(r,h,now);
  const visitBoard=()=>{
   const board=recipeBoardDestination(r,hw,h,now);if(!board)return false;
   h.recipeBoardPending=true;
   if(serviceRecipeBoard(r,hw,h,now)){h.recipeBoardPending=false;return true;}
   const route=humanRouteToAdjacent(r,h,board.gx,board.gy,grid,ox,oy,occupied,board.floor);
   if(route){h.intent={intentId:`board:${h.actorId}:${now}`,actorId:h.actorId,kind:'work',target:'recipe-board',preconditions:['physical community request board'],reserved:[],startAt:now,dueAt:now,route};h.state=route.length?'MOVING':'IDLE';return true;}
   return h.routeSearch?.status==='PENDING_SEARCH';
  };
  // Procurement complements each profession; it must not displace an already
  // available lawful local task merely to force a particular food trajectory.
  // A repeat board visit must not starve a cook's own ingredient run.


  h.procurementSourceKeys=[];
  let allowed=new Set(Object.keys(SOURCES).filter(key=>canHarvestSource(h,{key,def:SOURCES[key]} as NonNullable<ReturnType<typeof sourceAt>>)));
  const wantedGoods=new Set(communityFoodDeficit(r,hw,h).map(v=>v.key));
  if(['salvager','gardener','mechanic','builder','engineer'].includes(h.occupation))for(const [key,def]of Object.entries(SOURCES))if(def.yields.some(([k])=>wantedGoods.has(k))&&harvestToolPower(h,key)>0){allowed.add(key);h.procurementSourceKeys.push(key);}
  const ordinarySources=allowed;
  if(h.occupation==='builder'){
    const missing=new Set<string>();
    for(const site of Object.values(comm.lostWorksites??{}))for(const [key,qty] of RECIPES[STRUCTS[site.type]?.item??'']?.ins??[]){
      const available=[...pack.slots,...comm.storeContainers.flatMap(cid=>r.custody[cid]?.slots??[])].reduce((n,s)=>n+(s?.key===key&&!s.production?s.qty:0),0);
      if(available<qty)missing.add(key);
    }
    const materials=new Set(Object.keys(SOURCES).filter(k=>harvestToolPower(h,k)>0 && SOURCES[k].yields.some(([key])=>missing.has(key))));
    if(materials.size){allowed=materials;h.procurementSourceKeys.push(...materials);}
  }
  // A trained cook's known station recipe gives ingredient purpose to lawful
  // gathering. Still bounded to the existing known catchment; never invent stock.
  if(h.occupation==='cook'&&comm.workStations.some(id=>findRunEntity(r,id)?.type==='campfire')){
    const wanted=new Set((h.knownRecipes??[]).flatMap(k=>RECIPES[k]?.ins.length===1?RECIPES[k].ins.map(([key])=>key):[]));
    const ingredientSources=new Set([...allowed].filter(k=>SOURCES[k].yields.some(([key])=>wanted.has(key))));
    if(ingredientSources.size)allowed=ingredientSources;
  }
  countWorldWork('sourceIndexReads');
  const local=h.gx>=ox&&h.gy>=oy&&h.gx<ox+WW&&h.gy<oy+WH;
  let candidates=globalSourceCandidates(h.gx,h.gy,h.floor,r.sourceMap?.rules===4?4:3,allowed,local?r.layoutId:undefined);
  // Check the adjoining field catchments for a known kitchen ingredient. Each
  // survey is a sparse geometry query, not a stock read or a player window load.
  // The live ledger, protection, reservation and route are checked below.
  if (!candidates.length && (allowed !== ordinarySources || h.occupation === 'gardener' && wantedGoods.size)) {
    const ingredients = allowed !== ordinarySources ? allowed : new Set([...allowed].filter(k=>SOURCES[k].yields.some(([key])=>wantedGoods.has(key))));
    for (const [dx,dy] of [[-24,0],[0,-24],[24,0],[0,24]]) {
      const gx=h.gx+dx, gy=h.gy+dy;
      if (!inFrame(gx,gy)) continue;
      const inside=gx>=ox && gy>=oy && gx<ox+WW && gy<oy+WH;
      candidates.push(...globalSourceCandidates(gx,gy,h.floor,r.sourceMap?.rules===4?4:3,ingredients,inside?r.layoutId:undefined)
        .map(p=>({...p,distance:Math.abs(p.gx-h.gx)+Math.abs(p.gy-h.gy)})));
    }
  }
  if(h.occupation==='cook' && (!candidates.length || allowed===ordinarySources) && visitBoard())return;
  if(!candidates.length&&allowed!==ordinarySources){h.lastWorkBlock='Known recipe ingredients absent from bounded catchment; continuing lawful general food gathering.';candidates=globalSourceCandidates(h.gx,h.gy,h.floor,r.sourceMap?.rules===4?4:3,ordinarySources,local?r.layoutId:undefined);}
  if(h.occupation==='cook'&&!candidates.length)h.lastWorkBlock='No known harvestable recipe ingredient in the bounded catchment; no food or station was fabricated.';
  const reports=requestedSourceReports(r,hw,h).filter(p=>allowed.has(p.key)).map(p=>({...p,distance:Math.abs(p.gx-h.gx)+Math.abs(p.gy-h.gy)}));
  candidates=[...reports,...candidates].sort((a,b)=>Number(!SOURCES[a.key].yields.some(([k])=>wantedGoods.has(k)))-Number(!SOURCES[b.key].yields.some(([k])=>wantedGoods.has(k)))||a.distance-b.distance);
  for(const p of candidates){
    if(Object.values(hw.people).some(other=>other.actorId!==h.actorId&&other.harvestJob?.phase==='source'&&other.harvestJob.gx===p.gx&&other.harvestJob.gy===p.gy&&other.harvestJob.floor===h.floor&&!['DEAD','EVACUATED','DOWNED'].includes(other.state)))continue;
    const s=globalSourceAt(r,p.gx,p.gy,h.floor,now);if(!s||s.key!==p.key||s.protected||!canHarvestSource(h,s))continue;
    if(s.stock<=0){h.lastWorkBlock='Known source is depleted';continue;}
    // Carry admission is immediate; warehouse admission is checked at physical
    // delivery. A full warehouse must retain/wait on real cargo, not prevent
    // otherwise legal professional source work before any output exists.
    if(!simulateHumanOutput(pack.slots.map(v=>v?{...v}:null),s.def.yields,{jobId:'admission',workerId:h.actorId}))continue;
    h.harvestJob={id:uid(r,'hj'),sourceId:s.sourceId,gx:p.gx,gy:p.gy,floor:h.floor,key:s.key,phase:'source',startedAt:now};
    receipt(r,now,'human.harvest.select',`${h.harvestJob.id}:${h.actorId}:${s.sourceId}:${s.key}`);
    resumeHarvestJob(r,hw,h,now,occupied);return;
  }
  visitBoard();
});}
function resumeHarvestJob(r:RunState,hw:HumanWorld,h:HumanRecord,now:number,occupied:Set<string>):void {return timedWorldWork('resumeHarvestJob',()=>{
  const job=h.harvestJob;if(!job)return;
  h.nextThinkAt=now+3000;
  if(job.phase==='source'){
    const s=globalSourceAt(r,job.gx,job.gy,job.floor,now);
    if(h.floor!==job.floor||!s||s.key!==job.key||s.protected||s.stock<=0||!canHarvestSource(h,s)||h.stamina<2){receipt(r,now,'human.harvest.cancel',`${job.id}:source/tool/access changed`);delete h.harvestJob;return;}
    if(!simulateHumanOutput(humanPack(r,h).slots.map(v=>v?{...v}:null),s.def.yields,{jobId:job.id,workerId:h.actorId})){h.lastWorkBlock='Pack full before extraction';delete h.harvestJob;return;}
    const route=humanNavigation(r,occupied,true).route(h,{tx:job.gx,ty:job.gy,floor:job.floor});if(!route){if(h.routeSearch?.status==='NO_PATH'){receipt(r,now,'human.harvest.cancel',`${job.id}:no legal route`);delete h.harvestJob;}return;}
    h.intent={intentId:job.id,actorId:h.actorId,kind:'work',target:`global-harvest:${job.floor}:${job.gx},${job.gy}`,preconditions:['known source','timed physical shared harvest'],reserved:[job.sourceId],startAt:now,dueAt:now+1500,route};
    h.state=route.length?'MOVING':'WORKING';
  }else{
    const comm=h.community?hw.communities[h.community]:undefined,store=comm?.storeEntityId?findRunEntity(r,comm.storeEntityId):undefined;
    if(!store?.c||!comm?.storeContainers.includes(store.c)||(store.owner&&store.owner!==h.community)||(store.hp??1)<=0){h.lastWorkBlock='Authorized output store unavailable';
      if(store?.hp===0 && h.occupation==='builder')planHumanOccupation(r,hw,h,now,(tx,ty,floor)=>humanNavigation(r,occupied,true).route(h,{tx,ty,floor}));
      return;}
    job.storeId=store.id;
    const [gx,gy]=humanEntityTile(r,store),route=humanNavigation(r,occupied,true).route(h,{tx:gx,ty:gy,floor:store.floor??0});if(!route){if(h.routeSearch?.status==='NO_PATH'||h.routeSearch?.status==='SEARCH_LIMIT')h.nextThinkAt=now+30000;return;}
    h.lastWorkBlock=undefined;
    h.intent={intentId:job.id,actorId:h.actorId,kind:'work',target:'store',preconditions:['owned output','exact destination contact'],reserved:[],startAt:now,dueAt:now,route};h.state=route.length?'MOVING':'IDLE';
    if(!route.length){depositHumanOutputs(r,h,now);if(h.state==='IDLE')h.intent=undefined;h.nextThinkAt=Math.max(h.nextThinkAt??0,now+10000);}
  }
});}

function performHumanHarvest(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, occupied=new Set<string>()): boolean {
  const m = h.intent?.target?.match(/^(?:global-harvest:(-?\d+):|harvest:)(\d+),(\d+)$/);
  if (!m) return false;
  const global=m[1]!==undefined,tx=Number(m[2]),ty=Number(m[3]);
  if(global&&h.floor!==Number(m[1])){h.intent=undefined;h.state='IDLE';delete h.harvestJob;return false;}
  if(global&&h.harvestJob){const s=globalSourceAt(r,tx,ty,h.floor,now);if(!s||s.key!==h.harvestJob.key||!canHarvestSource(h,s)){delete h.harvestJob;h.intent=undefined;h.state='IDLE';return false;}}
  const before = new Map(humanPack(r, h).slots.filter((s): s is Stack => !!s).map(s => [s.uid, s.qty]));
  const result = humanHarvest(r, hw, h, tx, ty, now,global);
  if (result.result !== 'yield') { h.lastWorkBlock = result.reason; h.intent = undefined; h.state = 'IDLE'; h.nextThinkAt = now + 10000; delete h.harvestJob;return false; }
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
    if (delta > 0){h.workOutputs[s.uid] = (h.workOutputs[s.uid] ?? 0) + delta;
      if(h.harvestJob){(h.workOutputSources??={})[s.uid]={sourceId:h.harvestJob.sourceId,jobId:h.harvestJob.id};receipt(r,now,'human.harvest.output',JSON.stringify({jobId:h.harvestJob.id,sourceId:h.harvestJob.sourceId,workerId:h.actorId,uid:s.uid,key:s.key,qty:delta}));}
    }
  }
  if(h.harvestJob)h.harvestJob.phase='delivery';
  h.lastCommittedAt = now;
  // The strike released real cargo, but a crushed worker cannot walk it home.
  if(h.state==='DOWNED')return true;
  h.state = 'IDLE';
  h.intent = undefined;
  h.nextThinkAt=now;
  receipt(r, now, 'human.work', `${h.actorId}:harvest:${result.key}:${result.got}`);
  // Arrival/work completion is already a scheduled event: begin the bounded
  // return search now, rather than queue cargo behind a fresh island census.
  if(h.harvestJob)resumeHarvestJob(r,hw,h,now,occupied);
  return true;
}
export function depositHumanOutputs(r: RunState, h: HumanRecord, now: number): void {return timedWorldWork('depositHumanOutputs',()=>{
  if (!h.community || !h.workOutputs||['DOWNED','DEAD','EVACUATED'].includes(h.state)) return;
  const comm = r.humanWorld?.communities[h.community]; if (!comm) return;
  const reached=reachableHumanStores(r,r.humanWorld!,h)[0];if(!reached)return;
  if(h.harvestJob?.storeId&&h.harvestJob.storeId!==comm.storeEntityId)return;
  // At its board the cook may collect the ordinary field ration before unloading.
  // This uses a real flask and the normal admission rules, not extra pantry slots.
  if(h.occupation==='cook' && h.harvestJob?.phase==='delivery' && !reached.slots.includes(null))serviceRecipeBoard(r,r.humanWorld!,h,now);
  const dstId=reached.id;
  const pack = humanPack(r, h), dst = r.custody[dstId]; let moved = 0;
  for (const [stackUid, qty] of Object.entries(h.workOutputs)) {
    const i = pack.slots.findIndex(s => s?.uid === stackUid); if (i < 0 || qty <= 0) { delete h.workOutputs[stackUid]; continue; }
    const s = pack.slots[i]!;
    const ownedOutput=s.production?.workerId===h.actorId&&!!h.workOutputSources?.[s.uid];
    const room=dst.slots.includes(null)?s.qty:((s.production&&!ownedOutput)||s.meta!==undefined||s.dur!==undefined||s.charge!==undefined?0:spaceFor(r,dstId,s.key));
    const take=Math.min(qty,s.qty,room);if(take<=0){h.lastWorkBlock='Reached output store is full; cargo remains in my pack.';continue;}
    const transfer=take===s.qty&&!ownedOutput?s:{...s,uid:take===s.qty?s.uid:uid(r,'s'),qty:take,...(ownedOutput?{production:undefined}:{})};
    const whole = take === s.qty;
    const destinationBefore=new Map(dst.slots.filter((v):v is Stack=>!!v).map(v=>[v.uid,v.qty]));
    if (whole) pack.slots[i] = null; else s.qty -= take;
    if (!addStack(r, dstId, transfer)) { if (whole) pack.slots[i] = s; else s.qty += take; continue; }
    const origin=h.workOutputSources?.[stackUid];
    const lineage=dst.slots.filter((v):v is Stack=>!!v).flatMap(v=>{const qty=v.qty-(destinationBefore.get(v.uid)??0);return qty>0?[{at:now,jobId:origin?.jobId??h.harvestJob?.id??'work',sourceId:origin?.sourceId,recipe:origin?.recipe,inputs:origin?.inputs?.map(v=>({...v})),stationId:origin?.stationId,workerId:h.actorId,fromUid:stackUid,intoUid:v.uid,qty,key:v.key}]:[];});
    (comm.cargoLedger??={})[transfer.uid]=[...(comm.cargoLedger?.[transfer.uid]??[]),...lineage];
    receipt(r,now,'human.cargo.lineage',JSON.stringify({containerId:dstId,transferUid:transfer.uid,lineage}));
    receipt(r,now,'human.cargo.deliver',`${h.harvestJob?.id??'work'}:${h.actorId}:${stackUid}>${transfer.uid}:${dstId}:${take}`);
    moved += take; if (qty <= take){delete h.workOutputs[stackUid];if(h.workOutputSources)delete h.workOutputSources[stackUid];} else h.workOutputs[stackUid] = qty - take;
  }
  if (moved) {receipt(r, now, 'human.store', `${h.actorId}:${moved}`);serviceRecipeBoard(r,r.humanWorld!,h,now);}
  if(Object.values(h.workOutputs).some(q=>q>0)&&!moved){h.deliveryWait={containerId:dstId,signature:JSON.stringify(dst.slots)};h.nextThinkAt=Number.MAX_SAFE_INTEGER;}else delete h.deliveryWait;
  if(h.harvestJob?.phase==='delivery'&&Object.values(h.workOutputs).some(q=>q>0)&&!moved){
    h.nextThinkAt=Number.MAX_SAFE_INTEGER;
    const e=comm.storeEntityId?findRunEntity(r,comm.storeEntityId):undefined;
    if(e){const [sx,sy]=humanEntityTile(r,e),occupied=new Set(Object.values(r.humanWorld!.people).filter(p=>p.actorId!==h.actorId&&!['DEAD','EVACUATED'].includes(p.state)).map(p=>humanCellKey(p.floor,p.gx,p.gy))),nav=humanNavigation(r,occupied);
      const step=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({tx:h.gx+dx,ty:h.gy+dy,floor:h.floor})).find(p=>Math.abs(p.tx-sx)+Math.abs(p.ty-sy)>=2&&nav.legalEdge(h,p));
      if(step){h.intent={intentId:h.harvestJob.id,actorId:h.actorId,kind:'move',target:'store-wait',preconditions:['full store; carry goods while leaving access clear'],reserved:[],startAt:now,dueAt:now,route:[step]};h.state='MOVING';}
    }
  }
  if(h.harvestJob?.phase==='delivery'&&!Object.values(h.workOutputs).some(q=>q>0)){receipt(r,now,'human.harvest.complete',`${h.harvestJob.id}:${h.actorId}:${dstId}`);delete h.harvestJob;
    // An arrived ingredient is a physical planning event, not a timer. The
    // forager at the store can fetch the next paid bill without waiting for
    // another island-wide discretionary turn.
    if(h.occupation==='cook' && moved && h.state==='IDLE'){
      h.intent=undefined;
      planHumanOccupation(r,r.humanWorld!,h,now,(tx,ty,floor)=>humanNavigation(r).route(h,{tx,ty,floor}));
    }
  }
});}
function humanCombatTarget(r:RunState,hw:HumanWorld,id:string|undefined,floor:number): {x:number;y:number;human?:HumanRecord}|null {
  if(id==='player')return r.player.dead||playerAtSea(r)?null:r.player;
  const h=id?hw.people[id]:undefined;
  if(h){if(h.transit||h.floor!==floor||['DEAD','EVACUATED','DOWNED','ON_VESSEL'].includes(h.state))return null;const o=r.sourceMap?.veyra?.originAu,ox=o?Math.round(o[0]/.5):0,oy=o?Math.round(o[1]/.5):0;return {x:(h.gx-ox+.5)*TILE,y:(h.gy-oy+.5)*TILE,human:h};}
  return r.creatures.find(m=>m.id===id && m.state!=='dead' && (m.floor??0)===floor)??null;
}
/** A guard leash is relative to the protected player, not to the camera or
 * a remembered enemy ID. Never turn an idle passerby into an engage target. */
function readyCore(r:RunState,h:HumanRecord,now:number){
  return humanPack(r,h).slots.find(s=>s && basicCoreReach(s.key) && !coreCastBlock(r,s,'basic',now,h.inv.packId));
}
function combatEquipmentBlock(r:RunState,h:HumanRecord,now:number){
  const w=humanWeapon(h),ranged=w&&ITEMS[h.equip.weapon!.key].ranged;
  if(w && (!ranged || humanPack(r,h).slots.some(s=>s?.key==='arrow'&&!s.production&&s.qty>0)))return;
  if(!readyCore(r,h,now))return w?'no ammunition':'no usable weapon';
}
function threatensPlayer(r:RunState,hw:HumanWorld,h:HumanRecord,id:string,now:number){
  if(h.floor!==(r.veyraFloor??0)||r.player.dead||h.hp<h.maxHp*.3 || h.stamina<3)return false;
  const target=humanCombatTarget(r,hw,id,h.floor);
  if(!target || Math.hypot(target.x-r.player.x,target.y-r.player.y)>4*TILE)return false;
  const enemy=target.human;
  if(enemy){
    if(enemy.intent?.kind!=='fight' || enemy.intent.target!=='player' || h.protectedPeople.includes(id) || (h.community&&enemy.community===h.community))return false;
  }else{
    const m=r.creatures.find(m=>m.id===id);
    if(!m || m.husbandry?.tamed || m.knows?.kind!=='sight' || Math.hypot(m.knows.x-r.player.x,m.knows.y-r.player.y)>2*TILE || !['attack','chase','tell'].includes(m.state))return false;
  }
  const o=r.sourceMap?.veyra?.originAu,x=(h.gx-(o?o[0]*2:0)+.5)*TILE,y=(h.gy-(o?o[1]*2:0)+.5)*TILE;
  return Math.hypot(x-r.player.x,y-r.player.y)<=6*TILE && !combatEquipmentBlock(r,h,now) && clearPhysicalLine(r,{x,y},target,true) && clearPhysicalLine(r,r.player,target,true);
}
/** A failed resource/path review is not a new physical event every six seconds.
 * Pending searches keep their short bounded service slot; genuinely unavailable
 * livelihoods back off to at most five real minutes. Needs thresholds and actual
 * successful intake reset the wait. Motion, wounds and work never use this delay. */
export function finishHumanPlanReview(h:HumanRecord,now:number):void {
  if(h.state!=='IDLE'||h.intent||h.routeSearch?.status==='PENDING_SEARCH') {h.blockedPlanCount=0;return;}
  h.blockedPlanCount=Math.min(7,(h.blockedPlanCount??0)+1);
  h.nextThinkAt=Math.max(h.nextThinkAt??now,now+Math.min(300000,6000*2**(h.blockedPlanCount-1)));
}
export function stepHumans(r: RunState, hw: HumanWorld, now: number): void {return timedWorldWork('stepHumans',()=>{
  const lastStepAt = hw.lastStepAt ?? hw.lastResolvedAt;
  const dtMs = now - lastStepAt;
  if (dtMs <= 0) return;
  hw.lastStepAt = now;
  stepPlayerHumanAid(r,hw,now);
  const actors = Object.values(hw.people);
  for(const patient of actors){
    if(patient.state!=='DOWNED'||!patient.community||(patient.nextMedicalReviewAt??0)>now)continue;
    patient.nextMedicalReviewAt=now+30000;
    if(actors.some(h=>h.intent?.work?.patientId===patient.actorId))continue;
    const occupied=new Set(actors.filter(h=>!['DEAD','EVACUATED','ON_VESSEL'].includes(h.state)).map(h=>humanCellKey(h.floor,h.gx,h.gy)));
    const nav=humanNavigation(r,occupied,true);
    dispatchMedicalResponse(r,hw,patient,now,(h,tx,ty,floor)=>nav.route(h,{tx,ty,floor}));
  }
  for(const h of actors){if(!h.intent?.target?.startsWith('harvest:'))continue;const m=h.intent.target.match(/^harvest:(\d+),(\d+)$/);if(!m)continue;
    const o=r.sourceMap?.veyra?.originAu,gx=Number(m[1])+(o?o[0]*2:0),gy=Number(m[2])+(o?o[1]*2:0),source=globalSourceAt(r,gx,gy,h.floor,now);
    if(!source){h.intent=undefined;h.motion=undefined;h.state='IDLE';continue;}
    h.harvestJob??={id:h.intent!.intentId,sourceId:source.sourceId,gx,gy,floor:h.floor,key:source.key,phase:'source',startedAt:h.intent!.startAt};
    h.intent!.target=`global-harvest:${h.floor}:${gx},${gy}`;
  }
  // Full-store work is waiting on a custody change, not a physical action every
  // thirty seconds. Direct edits, consumption and restored saves all re-read the
  // actual container; urgent needs continue to own their biological boundaries.
  for(const h of actors)if(h.deliveryWait){const wait=h.deliveryWait,c=r.custody[wait.containerId],comm=h.community?hw.communities[h.community]:undefined,e=comm?.storeEntityId?findRunEntity(r,comm.storeEntityId):undefined;if(!c||!comm?.storeContainers.includes(wait.containerId)||!e||e.owner!==comm.id||(e.hp??1)<=0||JSON.stringify(c.slots)!==wait.signature){delete h.deliveryWait;h.nextThinkAt=now;}}
  // A selected physical commitment owns its retry deadline. Do not enqueue an
  // interrupted delivery/source/board visit behind another complete census of
  // discretionary jobs. Same route authority and physical entry checks apply.
  const commitments=actors.filter(h=>h.state==='IDLE'&&(!h.intent||!!h.intent.work)&&!h.deliveryWait&&!h.following&&(h.nextThinkAt??0)<=now&&(h.harvestJob||h.recipeBoardPending||!!h.intent?.work||Object.values(h.workOutputs??{}).some(q=>q>0)));
  if(commitments.length)withHumanNavigationRead(r,()=>{for(const h of commitments){
   if(h.intent?.work){h.nextThinkAt=now+3000;planHumanOccupation(r,hw,h,now,(gx,gy,floor)=>humanNavigation(r).route(h,{tx:gx,ty:gy,floor}));continue;}
   if(!h.harvestJob&&Object.values(h.workOutputs??{}).some(q=>q>0)){
    h.nextThinkAt=now+3000;const c=h.community?hw.communities[h.community]:undefined,e=c?.storeEntityId?findRunEntity(r,c.storeEntityId):undefined;
    if(!e||(e.hp??1)<=0)continue;const [gx,gy]=humanEntityTile(r,e),route=humanNavigation(r).route(h,{tx:gx,ty:gy,floor:e.floor??0});
    if(route){h.intent={intentId:`store:${h.actorId}:${now}`,actorId:h.actorId,kind:'work',target:'store',preconditions:['deliver committed paid output'],reserved:[],startAt:now,dueAt:now,route};h.state=route.length?'MOVING':'IDLE';if(!route.length){depositHumanOutputs(r,h,now);h.intent=undefined;}}
    continue;
   }
   if(h.harvestJob){resumeHarvestJob(r,hw,h,now,new Set(actors.filter(p=>p.actorId!==h.actorId&&!['DEAD','EVACUATED','ON_VESSEL'].includes(p.state)).map(p=>humanCellKey(p.floor,p.gx,p.gy))));continue;}
   const comm=h.community?hw.communities[h.community]:undefined,store=comm?.storeEntityId?findRunEntity(r,comm.storeEntityId):undefined;
   h.nextThinkAt=now+3000;
   if(!store||(store.hp??1)<=0){h.recipeBoardPending=false;continue;}
   if(serviceRecipeBoard(r,hw,h,now)){h.recipeBoardPending=false;h.nextThinkAt=now;continue;}
   const [gx,gy]=humanEntityTile(r,store),route=humanNavigation(r).route(h,{tx:gx,ty:gy,floor:store.floor??0});
   if(route){h.intent={intentId:`board:${h.actorId}:${now}`,actorId:h.actorId,kind:'work',target:'recipe-board',preconditions:['resume physical request board visit'],reserved:[],startAt:now,dueAt:now,route};h.state=route.length?'MOVING':'IDLE';}
   else if(h.routeSearch?.status==='NO_PATH'||h.routeSearch?.status==='SEARCH_LIMIT'){h.recipeBoardPending=false;h.nextThinkAt=now+30000;}
  }});
  const wantsPlan = now >= (hw.plannerAt ?? 0) && actors.some(h => !h.following && h.state === 'IDLE' && (!h.intent || h.intent.work?.phase === 'travel') && (h.nextThinkAt ?? 0) <= now);
  const hasMovement = actors.some(h => h.state === 'MOVING' && !!h.intent?.route?.length) || actors.some(h => h.following && h.state === 'IDLE') || wantsPlan || actors.some(h => h.state === 'FIGHTING');
  const grid = hasMovement ? blockGrid(r) : new Uint8Array(0);
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  const occupied=new Set<string>();
  if(hasMovement)for(const h of actors){if(h.state==='DEAD'||h.state==='EVACUATED'||h.state==='ON_VESSEL')continue;occupied.add(humanCellKey(h.floor,h.gx,h.gy));if(h.motion)occupied.add(humanCellKey(h.motion.toFloor??h.floor,h.motion.toGx,h.motion.toGy));}
  const playerGx = ox + Math.floor(r.player.x / TILE), playerGy = oy + Math.floor(r.player.y / TILE);
  if(hasMovement){
    if(!r.player.dead)occupied.add(humanCellKey(r.veyraFloor??0,playerGx,playerGy));
    for(const m of r.creatures)if(m.state!=='dead')occupied.add(humanCellKey(m.floor??0,ox+Math.floor(m.x/TILE),oy+Math.floor(m.y/TILE)));
  }
  for(const h of actors) {
    if(h.occupation!=='guard' || h.floor!==(r.veyraFloor??0) || h.following || ['DOWNED','DEAD','EVACUATED','ON_VESSEL','FIGHTING'].includes(h.state) || (h.nextPerceptionAt??0)>now)continue;
    h.nextPerceptionAt=now+1000;
    const p={x:(h.gx-ox+.5)*TILE,y:(h.gy-oy+.5)*TILE};
    const enemy=r.creatures.find(m=>!m.husbandry?.tamed && (m.floor??0)===h.floor && ['attack','chase'].includes(m.state) && Math.hypot(m.x-p.x,m.y-p.y)<TILE*8 && clearPhysicalLine(r,p,m,true));
    if(!enemy)continue;
    h.motion=undefined;
    h.intent={intentId:`defend:${h.actorId}:${now}`,actorId:h.actorId,kind:'fight',target:enemy.id,preconditions:['direct sight of nearby threat'],reserved:[],startAt:now,dueAt:now};h.state='FIGHTING';
  }
  if (wantsPlan) withHumanNavigationRead(r,()=>{
    countWorldWork('plannerActivations');
    const protectedTiles = plannerSources(r);
    let cursor = (hw.plannerCursor ?? 0) % Math.max(1, actors.length), planned = 0, distantPlanned=0;
    const startCursor=cursor;let deferredCursor:number|undefined;
    for (let n = 0; n < actors.length && planned < 8; n++) {
      const i = (startCursor + n) % actors.length, h = actors[i];
      if (!h.following && h.state === 'IDLE' && (!h.intent || h.intent.work?.phase === 'travel') && (h.nextThinkAt ?? 0) <= now) {
        const distant=h.floor!==(r.veyraFloor??0)||h.gx<ox||h.gy<oy||h.gx>=ox+WW||h.gy>=oy+WH;
        if(distant&&distantPlanned>=1){deferredCursor??=i;continue;}
        if(distant)distantPlanned++;
        countWorldWork('actorPlans');
        h.routeSearch=undefined;
        planAutonomousWork(r, hw, h, now, grid, ox, oy, occupied, protectedTiles);
        finishHumanPlanReview(h,now);
        if ((h.nextThinkAt ?? 0) > now) planned++;
        cursor = (i + 1) % actors.length;
      }
    }
    // The earliest quota-deferred actor owns the next turn; a later local actor
    // must not move the cursor past a whole remote region indefinitely.
    hw.plannerCursor = deferredCursor??cursor; hw.plannerAt = now + 1000;
  });
  for(const h of actors){
    const intent=h.intent;
    if(!h.following || !intent?.guardPlayer || !['IDLE','MOVING','FIGHTING'].includes(h.state))continue;
    if(intent.kind==='fight'){
      if(intent.target && threatensPlayer(r,hw,h,intent.target,now))continue;
      h.motion=undefined;delete intent.coreCast;delete intent.swing;intent.kind='follow';intent.target=undefined;intent.route=[];h.state='IDLE';intent.dueAt=now;
    }
    if((h.nextPerceptionAt??0)>now || h.floor!==(r.veyraFloor??0))continue;
    h.nextPerceptionAt=now+500;
    if(Math.hypot(h.gx-playerGx,h.gy-playerGy)>7)continue;
    const threat=r.creatures.find(m=>['chase','tell','attack'].includes(m.state)&&threatensPlayer(r,hw,h,m.id,now))?.id ?? actors.find(p=>p.intent?.target==='player'&&threatensPlayer(r,hw,h,p.actorId,now))?.actorId;
    if(!threat)continue;
    h.motion=undefined;intent.kind='fight';intent.target=threat;intent.route=[];h.state='FIGHTING';h.nextThinkAt=now;
  }
  // Combat locomotion uses the same cardinal route executor and occupancy as work/follow.
  // Limit new searches per update; do not perform an island-wide BFS per hostile per frame.
  let combatRoutes = 0;
  for (const h of actors) {
    if (h.state !== 'FIGHTING' || h.intent?.kind !== 'fight' || h.floor !== (r.veyraFloor ?? 0)) continue;
    const enemy=humanCombatTarget(r,hw,h.intent.target,h.floor);
    if (!enemy) { h.intent= h.following?{intentId:`follow:${h.actorId}:${now}`,actorId:h.actorId,kind:'follow',preconditions:[],reserved:[],startAt:now,dueAt:now}:undefined;h.state='IDLE';continue; }
    if(h.intent.swing || h.intent.coreCast)continue; // committed aim: do not turn or chase through windup
    faceHumanToward(h, ox + enemy.x / TILE, oy + enemy.y / TILE);
    const weapon = humanWeapon(h);
    const core=readyCore(r,h,now), coreReach=core?basicCoreReach(core.key):0;
    if (!weapon && !coreReach) { h.intent.blockReason = 'no usable weapon'; continue; }
    const distance = Math.hypot((h.gx - ox + 0.5) * TILE - enemy.x, (h.gy - oy + 0.5) * TILE - enemy.y);
    if (h.intent.coreCast || distance <= Math.max(weapon?weapon.reach+8:0,coreReach)) continue;
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
    if(h.following && h.state==='IDLE' && h.intent?.delivery){stepCompanionDelivery(r,hw,h,now,occupied);continue;}
    if (!h.following || h.state !== 'IDLE' || h.intent?.kind !== 'follow') continue;
    if (h.floor===(r.veyraFloor??0) && Math.abs(h.gx - playerGx) + Math.abs(h.gy - playerGy) <= 1) { h.intent.route = []; h.intent.blockReason = undefined; continue; }
    if(h.intent.dueAt>now)continue;
    const route=humanNavigation(r,occupied,true).route(h,{tx:playerGx,ty:playerGy,floor:r.veyraFloor??0});
    h.intent.dueAt=now+(route?0:750);
    if (!route) { h.intent.blockReason = 'No certified physical route to the player within the current search budget.'; continue; }
    h.intent.route = route; h.state = route.length ? 'MOVING' : 'IDLE'; h.intent.blockReason = undefined;
  }
  let navigation: ReturnType<typeof humanNavigation>|undefined;
  for (const h of actors) {
    if (h.state === 'DEAD' || h.state === 'EVACUATED' || h.state === 'ON_VESSEL') continue;
    // 1. Survival consume: eat when hungry, drink when thirsty.
    if (h.hunger < 40) humanConsume(r, hw, h, 'food', now);
    if (h.thirst < 40) humanConsume(r, hw, h, 'water', now);
    if(h.state==='WORKING'&&h.intent?.kind==='drink'&&h.intent.target?.startsWith('water:'))commitHumanWater(r,h,now);
    if (h.state === 'WORKING' && h.intent?.work) humanWorkTick(r, hw, h, now);
    // 2. A work action commits only after arrival and a visible work duration; no output is animated or minted in transit.
    if (h.state === 'WORKING' && h.intent?.kind === 'work' && h.intent.target?.match(/^(global-harvest|harvest):/) && now >= h.intent.dueAt) performHumanHarvest(r, hw, h, now,occupied);
    if (h.intent?.kind === 'work' && h.intent.target === 'store' && h.state === 'IDLE') {
      depositHumanOutputs(r, h, now); if((h as HumanRecord).state==='IDLE')h.intent = undefined; h.nextThinkAt = Math.max(h.nextThinkAt??0,now + 6000);
    }
    // 3. Evacuation: the named service must actually be berthed and taking passengers, and the
    //    body must stand at its berth. A closed window is an honest failure, never a silent seat.
    if (h.intent?.kind === 'evacuate' && h.state === 'IDLE') {
      const tripId = h.intent.target, trip = tripId ? hw.evacuation[tripId] : undefined;
      if (trip) {
        const res = boardEvac(r, hw, h, tripId!, now);
        h.intent = undefined;
        if (!res.ok) { h.lastWorkBlock = res.reason ?? 'cannot board'; h.nextThinkAt = now + 2000; }
      } else h.intent = undefined;
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
        if (!((navigation??=humanNavigation(r,occupied)).enter(h,next,now)) || (next.floor===h.floor && !canHumanOccupy(r, h, next.tx, next.ty, blockGrid(r), ox, oy, occupied))) {
          occupied.add(key); moveIntent.blockReason = 'blocked by a wall, closed door, or another survivor';
          // Cooperate at a shared access point without swapping/teleporting bodies.
          // Only an idle colleague with no committed action can accept a sidestep.
          const colleague=actors.find(p=>p.actorId!==h.actorId&&p.community===h.community&&p.floor===next.floor&&p.gx===next.tx&&p.gy===next.ty&&p.state==='IDLE'&&!p.intent&&!p.following);
          if(colleague){const nav=humanNavigation(r,occupied),side=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({tx:colleague.gx+dx,ty:colleague.gy+dy,floor:colleague.floor})).filter(p=>nav.legalEdge(colleague,p)).sort((a,b)=>(Math.abs(b.tx-h.gx)+Math.abs(b.ty-h.gy))-(Math.abs(a.tx-h.gx)+Math.abs(a.ty-h.gy)))[0];
           if(side){colleague.intent={intentId:`yield:${colleague.actorId}:${now}`,actorId:colleague.actorId,kind:'move',target:'colleague-yield',preconditions:['physical sidestep for a blocked community colleague'],reserved:[],startAt:now,dueAt:now,route:[side]};colleague.state='MOVING';receipt(r,now,'human.access.yield',JSON.stringify({actorId:colleague.actorId,for:h.actorId,from:[colleague.gx,colleague.gy],into:side}));}
          }

          if (moveIntent.kind === 'follow' || moveIntent.delivery){moveRoute.length=0;h.state='IDLE';moveIntent.dueAt=now+750;}
          else if (moveIntent.kind === 'fight') { h.state = 'FIGHTING'; h.motion = undefined; moveRoute.length = 0; h.nextThinkAt = now + 750; }
          else { if(moveIntent.work){if(moveIntent.work.phase==='act')moveIntent.work.phase='travel';moveRoute.length=0;}else h.intent=undefined;h.state='IDLE';h.nextThinkAt=now+3000; }
        } else {
          const intentStart = Number.isFinite(moveIntent.startAt) ? Math.max(lastStepAt, moveIntent.startAt) : lastStepAt;
          const initialElapsed = clamp(now - intentStart, 0, TILE / PROFILES[h.profile].speed * 1000);
          h.motion = { fromGx: h.gx, fromGy: h.gy, toGx: next.tx, toGy: next.ty, toFloor:next.floor, elapsedMs: initialElapsed, updatedAt: now };
          occupied.add(key);occupied.add(humanCellKey(next.floor,next.tx,next.ty));
          beganStep = true;
          h.dir = dy > 0 ? 0 : dy < 0 ? 3 : dx > 0 ? 2 : 1;
        }
      }
      if (h.motion) {
        if (!beganStep) h.motion.elapsedMs += dtMs;
        h.motion.updatedAt = now;
        const travelMs = TILE / PROFILES[h.profile].speed * 1000;
        if (h.motion.elapsedMs >= travelMs) {
          const destinationKey=humanCellKey(next.floor,next.tx,next.ty);occupied.delete(destinationKey);
          if(!(navigation??=humanNavigation(r,occupied)).enter(h,next,now)){
            h.motion=undefined;h.state='IDLE';moveIntent.blockReason='The physical step became blocked before arrival.';h.lastWorkBlock=moveIntent.blockReason;if(moveIntent.delivery || moveIntent.kind==='follow'){moveRoute.length=0;moveIntent.dueAt=now+750;}else if(moveIntent.work){if(moveIntent.work.phase==='act')moveIntent.work.phase='travel';moveRoute.length=0;}else h.intent=undefined;h.nextThinkAt=now+3000;
            continue;
          }
          const key = humanCellKey(h.floor, h.gx, h.gy); occupied.delete(key);
          h.gx = h.motion.toGx; h.gy = h.motion.toGy; h.floor = h.motion.toFloor ?? h.floor; h.motion = undefined; moveRoute.shift();
          h.lastSimAt = now; occupied.add(humanCellKey(h.floor, h.gx, h.gy));
          if (!moveRoute.length) {
            if (moveIntent.kind === 'fight') { h.state = 'FIGHTING'; h.nextThinkAt = now; }
            else if (moveIntent.kind === 'follow' || moveIntent.delivery) { h.state = 'IDLE'; moveRoute.length = 0; }
            else if(moveIntent.kind==='drink'&&moveIntent.target?.startsWith('water:')){h.state='WORKING';moveIntent.dueAt=now+2000;}
            else if (moveIntent.work) { h.state = 'WORKING'; moveIntent.dueAt = now + (moveIntent.work.phase === 'fetch' ? 800 : moveIntent.work.duration); }
            else if (moveIntent.kind === 'work' && moveIntent.target?.match(/^(global-harvest|harvest):/)) {
              const target = moveIntent.target.match(/^(?:global-harvest:(-?\d+):|harvest:)(\d+),(\d+)$/);
              if (target) faceHumanToward(h, Number(target[2])+(target[1]===undefined?ox:0),Number(target[3])+(target[1]===undefined?oy:0));
              h.state = 'WORKING'; moveIntent.dueAt = now + 1500;
            }
            else if(moveIntent.kind==='evacuate'){h.state='IDLE';const tid=moveIntent.target;const trip=tid?hw.evacuation[tid]:undefined;const boarded=trip?boardEvac(r,hw,h,tid!,now):{ok:false,reason:'the service closed before you arrived'};h.intent=undefined;if(!boarded.ok){h.lastWorkBlock=boarded.reason??'cannot board';h.nextThinkAt=now+2000;}}
            else if(moveIntent.target==='recipe-board'){h.state='IDLE';h.intent=undefined;serviceRecipeBoard(r,hw,h,now);h.recipeBoardPending=false;h.nextThinkAt=now;}
            else if (moveIntent.kind === 'work' && moveIntent.target === 'store') { h.state = 'IDLE'; depositHumanOutputs(r, h, now); if((h as HumanRecord).state==='IDLE')h.intent = undefined; h.nextThinkAt = Math.max(h.nextThinkAt??0,now + 6000); }
            else { if(moveIntent.target==='home')h.following=false; h.state = 'IDLE'; h.intent = undefined; }
          }
        }
      }
    }
    // Stamina recovers while actually idle/resting.
    if (h.state === 'IDLE') h.stamina = clamp(h.stamina + dtMs / HOUR * 4, 0, h.maxStamina);
  }
});}

// ---------------------------------------------------------------------------
// Human combat integration — real damage routes, not an unattached function.
// ---------------------------------------------------------------------------
/** Resolve human combat for one tick: creatures in range damage nearby humans (applyDamage
 *  with the creature's floor), and fighting humans strike their selected creature/player target.
 *  This is the bidirectional combat law the main K5 routes call into. */
/** A committed ranged attack by a survivor. The world layer turns it into a real projectile; damage
 *  exists only on impact, so a shot can miss, be blocked, or be outrun. */
export interface HumanShot { shooterId: string; gx: number; gy: number; dmg: number; victim: string; tx: number; ty: number }

export function stepHumanCombat(r: RunState, hw: HumanWorld, now: number, hitCreature?: (creature: Creature, damage: number, angle: number, attacker: HumanRecord) => void, hitPlayer?: (attacker: HumanRecord, damage: number, angle: number) => void, spawnShot?: (shot: HumanShot) => boolean, emitCore?: (cast:BasicCast)=>void): void {
  const activeFloor = r.veyraFloor ?? 0;
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
  const people=Object.values(hw.people);
  // 1. Creatures damage humans in their attack range.
  for (const m of r.creatures) {
    if (m.state !== 'attack') continue;
    const cFloor = m.floor ?? activeFloor;
    const cDmg = CREATURES[m.type]?.dmg ?? 10;
    for (const h of people) {
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
  for (const h of people) {
    const intent=h.intent;
    if(!intent || intent.kind!=='fight' || !intent.target)continue;
    if(h.state!=='FIGHTING' || h.transit || h.floor!==activeFloor || h.stamina<3 || h.gx<ox || h.gy<oy || h.gx>=ox+WW || h.gy>=oy+WH || (intent.guardPlayer&&!threatensPlayer(r,hw,h,intent.target,now))){
      delete intent.swing;delete intent.coreCast;continue;
    }
    if((h.attackReadyAt??0)>now)continue;
    if(emitCore && !intent.swing){
      const pending=intent.coreCast, pack=humanPack(r,h), core=pending?pack.slots.find(s=>s?.uid===pending.uid):readyCore(r,h,now);
      const reach=core?basicCoreReach(core.key):0,target=humanCombatTarget(r,hw,intent.target,h.floor);
      const x=(h.gx-ox+.5)*TILE,y=(h.gy-oy+.5)*TILE;
      if(core && reach && target && (!target.human || (!h.protectedPeople.includes(intent.target)&&(!h.community||target.human.community!==h.community))) &&
        (!pending || (pending.victim===intent.target&&pending.floor===h.floor)) && Math.hypot(target.x-x,target.y-y)<=reach && clearPhysicalLine(r,{x,y},target,true) && !coreCastBlock(r,core,'basic',now,pack.id)){
        if(!pending){faceHumanToward(h,ox+target.x/TILE,oy+target.y/TILE);intent.coreCast={uid:core.uid,victim:intent.target,floor:h.floor,angle:Math.atan2(target.y-y,target.x-x),readyAt:now+basicCastTiming(ITEMS[core.key].creatorCore!).contact};continue;}
        if(now<pending.readyAt)continue;
        delete intent.coreCast;
        if(coreCastCommit(r,core,'basic',now,pack.id)){
          emitCore({key:core.key,uid:core.uid,x,y,angle:pending.angle,owner:h.actorId,victim:intent.target});
          const timing=basicCastTiming(ITEMS[core.key].creatorCore!);h.attackReadyAt=now+timing.dur-timing.contact;
          h.lastAttackAt=now;h.stamina-=3;receipt(r,now,'human.core.commit',`${h.actorId}:${core.uid}:basic:${intent.target}`);continue;
        }
      }
      if(pending){delete intent.coreCast;continue;}
    }
    const weapon=h.equip.weapon, w=humanWeapon(h), pending=intent.swing;
    const target=humanCombatTarget(r,hw,intent.target,h.floor);
    if(!weapon || !w || !target || (pending && (pending.uid!==weapon.uid || pending.floor!==h.floor || pending.victim!==intent.target))){delete intent.swing;continue;}
    if(target.human && (h.protectedPeople.includes(intent.target)||!!h.community&&target.human.community===h.community)){h.intent=undefined;h.state='IDLE';continue;}
    const x=(h.gx-ox+.5)*TILE,y=(h.gy-oy+.5)*TILE,dx=target.x-x,dy=target.y-y;
    const angle=Math.atan2(dy,dx),distance=Math.hypot(dx,dy),ranged=!!ITEMS[weapon.key].ranged;
    const radius=target.human || intent.target==='player'?8:CREATURES[(target as Creature).type]?.r??6;
    const timing=swingTiming(w.swing,ranged,proficiencyMul(h.combatProficiency));
    const ammo=ranged?humanPack(r,h).slots:undefined,round=ammo?.findIndex(s=>s?.key==='arrow'&&!s.production&&s.qty>0)??-1;
    if(ranged && round<0){delete intent.swing;intent.blockReason='no arrows';continue;}
    if(!pending){
      if(distance>w.reach+radius || !clearPhysicalLine(r,{x,y},target,true))continue;
      faceHumanToward(h,ox+target.x/TILE,oy+target.y/TILE);
      intent.swing={uid:weapon.uid,victim:intent.target,floor:h.floor,angle,distance,contactAt:now+timing.contact};
      delete intent.blockReason;continue;
    }
    if(now<pending.contactAt)continue;
    delete intent.swing; // consume the windup exactly once, including misses and refused launches
    const a=pending.angle;
    if(ranged){
      if(!spawnShot?.({shooterId:h.actorId,gx:h.gx,gy:h.gy,dmg:w.dmg,victim:intent.target,tx:x+Math.cos(a)*pending.distance,ty:y+Math.sin(a)*pending.distance})){
        intent.blockReason='cannot launch a projectile here';continue;
      }
      if(--ammo![round]!.qty===0)ammo![round]=null;
    }
    h.lastAttackAt=now;h.attackReadyAt=now+timing.dur-timing.contact;h.stamina-=3;
    if(!ranged){
      if(distance>w.reach+radius || Math.abs(Math.atan2(Math.sin(angle-a),Math.cos(angle-a)))>w.arc/2 || !clearPhysicalLine(r,{x,y},target,true))continue;
      if(target.human)applyDamage(r,hw,target.human,w.dmg,a,now,'human',h.actorId,h.floor);
      else if(intent.target==='player')hitPlayer?.(h,w.dmg,a);
      else hitCreature?.(target as Creature,w.dmg,a,h);
    }
    if(weapon.dur!==undefined && (weapon.dur=Math.max(0,weapon.dur-1))===0)h.equip.weapon=null;
  }
}
