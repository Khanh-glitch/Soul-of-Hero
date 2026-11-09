// Soul of Hero — core types, constants, seeded RNG. Pure TS, no DOM.
import balanceJson from './balance.v1.json';
export const BAL = balanceJson as any;

export const TILE = 16;
export const WW = 200; // world width in tiles
export const WH = 200;
export const VIEW_W = 640;
export const VIEW_H = 360;
export const WORLD_SEED = 0x50f1; // LOCKED_CANON: stable geography across runs
export const SAVE_VERSION = 3;
export const HOUR = 3600_000;

// Committed physical combat effects are run-local and resume after an offline gap.
export interface Proj { x: number; y: number; vx: number; vy: number; life: number; dmg: number; from: 'player' | 'enemy'; kind: string; r: number; delay?: number; homing?: number; owner?: string }
export interface Haz { kind: 'circle' | 'line' | 'ring' | 'wave' | 'sweep' | 'pool'; x: number; y: number; r?: number; angle?: number; len?: number; w?: number; t: number; tell: number; dur: number; dmg: number; style: string; effect?: string; hit?: boolean; tickAcc?: number; a0?: number; a1?: number; done?: boolean; owner?: string; elder?: string; expiresSimMs?:number }

// ---------- Seeded RNG ----------
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash2(x: number, y: number, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Stateful RNG stored inside GameState so simulation stays deterministic across saves. */
export function rngNext(st: { rng: number }) {
  st.rng = (st.rng + 0x6d2b79f5) >>> 0;
  let t = st.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- Terrain ----------
export const enum T {
  DEEP = 0, SHALLOW, SAND, GRASS, MEADOW, FOREST, MARSH, HILL, CLIFF, SNOW, ASH, TOXIC, ROAD, BRIDGE, FLOOR, PWALL, LAVA, BURNT, ICE, RIVER,
}
export const TERRAIN_NAME = ['deep', 'shallow', 'sand', 'grass', 'meadow', 'forest', 'marsh', 'hill', 'cliff', 'snow', 'ash', 'toxic', 'road', 'bridge', 'floor', 'wall', 'lava', 'burnt', 'ice', 'shallow'];

// ---------- Items & custody ----------
export interface CoreReserve { basic: number; refined: number; signature: number }
export interface Stack { uid: string; key: string; qty: number; dur?: number; charge?: number; meta?: string; upgrade?: 'freight'; reserves?: CoreReserve }
export interface Container { id: string; kind: string; slots: (Stack | null)[] }

export type Dir = 0 | 1 | 2 | 3; // down, left, right, up

export interface Player {
  x: number; y: number; vx: number; vy: number; dir: Dir; aim: number;
  hp: number; stamina: number; hunger: number; thirst: number; warmth: number; rad: number;
  active: number; // quickbar index 0..7
  action: null | { kind: 'swing' | 'cast' | 'roll' | 'hurt'; t: number; dur: number; contact?: number; done?: boolean; angle: number; slot?: number; coreUid?: string; mode?: 'basic' | 'refined' | 'signature'; targetX?: number; targetY?: number; viewX?: number; viewY?: number };
  invuln: number; iceUntil?: number; channelUntil?:number; dead: boolean; deadT: number; pulling: string | null; vehicle?: string;
  skills: Record<string, number>; // xp
  stepAcc: number; lastTraceX: number; lastTraceY: number;
  regionName: string; sheltered: boolean;
}

export interface Creature {
  id: string; type: string; x: number; y: number; hp: number; maxHp: number;
  homeX: number; homeY: number; state: 'idle' | 'wander' | 'chase' | 'track' | 'tell' | 'attack' | 'recover' | 'flee' | 'sleep' | 'dead';
  t: number; tx: number; ty: number; angle: number; dir: Dir;
  /** knowledge is limited to what it physically sensed */
  knows: null | { kind: 'sight' | 'trace' | 'stimulus'; x: number; y: number; at: number; traceId?: string; chainId?: string; sourceId?: string; eventIndex?: number; expiresAt?: number; goalX?: number; goalY?: number };
  /** Last completed/lost chain, preventing repeated reacquisition of the same marks. */
  traceIgnore?: string;
  /** Most recently sensed world event, so arrival/reload cannot retrigger it. */
  stimulusIgnore?: string;
  stimulusRouteAt?: number;
  /** Last justified physical checkpoint after offline activity was deferred. */
  offlineUnresolvedAt?: number;
  path: number[] | null; pathT: number; cd: number; kbx: number; kby: number; flash: number;
  elder?: { key: string; awake: boolean; phase: number; pattern: number; special: number; shield?: number; submerged?: boolean };
  patternKey?: string; atk?: any; slow?: number; signatureBurnNext?: number; tornadoNext?: number; frozenUntil?: number; rootedUntil?:number; rootHitNext?:number; beamHitNext?:number;
}

export interface Entity {
  /** B04: provenance of an emergency motorbike cargo bag (optional; absent on all older saves and other bags). */
  vehicleSource?: { vehicleId: string; vehicleUid: string };
  /** B05-R freight: a paid-once vendor parcel (kind 'bag'). purchaseId binds it to one paid intent; item is the sold good. */
  parcel?: { purchaseId: string; item: string };
  id: string; kind: 'drop' | 'struct' | 'bag' | 'cart' | 'vehicle' | 'loot' | 'cash' | 'vendor' | 'evac' | 'door' | 'gen' | 'recycler' | 'airdrop';
  x: number; y: number; // px for drops/carts, tile*16+8 for structures
  tx?: number; ty?: number; type?: string; hp?: number; maxHp?: number;
  c?: string; // container id
  open?: boolean; locked?: string; poi?: string; label?: string; stock?: Record<string, number>;
  station?: { queue: Job[]; burn: number; fuelC: string; outC: string; level?: 1 | 2 | 3; upgrade?: 'kiln_lining'; stateCode?: string };
  garden?: { crop: string | null; growth: number; water: number; coldFrame?: boolean };
  farm?: { enabled: boolean; crop: 'crop' | 'herb'; energy: number; gardenId?: string; barrelId?: string; chestId?: string; lastCode?: string };
  irSensor?: { version: 'ir-v1'; enabled: boolean };
  bearTrap?: { version: 'trap-v1'; state: 'unarmed' | 'armed' | 'spent' | 'worn'; uses: number; snapAt?: number };
  basePower?: { enabled: boolean; energy: number; capacity?: 2; priority?: 'defense' | 'production'; network?: 'wire-v1' };
  wireSwitch?: {version:'wire-v1'; on:boolean};
  electricDoor?: {version:'wire-v1'; interior:[number,number]; releaseUntil?:number};
  cabinet?: { credit: Record<string, number>; legacy: boolean };
  maintenance?: { enabled: boolean; chestId?: string }; // opt-in claim reserve
  industrial?: { enabled: boolean; generatorId?: string }; // optional paid workbench module
  turret?: { enabled: boolean; generatorId?: string; cooldown: number; angle: number; tracking?: boolean };
  water?: number; minted?: boolean; claim?: string; vx?: number; vy?: number; born?: number; owner?: string;
  power?: number; fire?: number;
  /** The original deployable instance, retained until reclaim or destruction. */
  deployed?: Stack;
  vehicle?: { fuel:number; angle:number; odometer:number; geometry:'vehicle-geometry-v1'; lube?: number };
  /** Deterministic local identity marker for station types that must not be relabeled (refinery-v1). */
  identity?: 'refinery-v1';
  airdrop?: { index:number; phase:'signal'|'descending'|'locked'|'open'|'partial'; signalAt:number; descentAt:number; landAt:number; unlockAt:number; expiresAt:number };
  poiPower?: {version:'poi-access-v1'; fueledAt:number; expiresAt:number; budgetMs:number; runAt:number; runMs:number; pausedMs?:number};
  poiDoor?: {version:'poi-access-v1'; closeAt:number; scans:number; lastCardUid?:string};
  /** Legacy jobs with unknowable paid inputs, preserved after station destruction. */
  legacyJobs?: { stationType: string; queue: Job[] };
}
/** Undefined reserved means an older save whose paid inputs cannot be reconstructed safely. */
export interface Job { id: string; recipe: string; left: number; total: number; reserved?: Stack[] }

export interface WorldStimulus { version:'world-stimulus-v1'; id:string; sourceId:string; eventIndex:number; kind:'airdrop-landing'|'combat-sound'; modality:'sound'; eligibility:'audible-landing-v1'|'audible-ranged-v1'|'audible-melee-v1'; x:number; y:number; at:number; expiresAt:number; range:number; strength:number }

export interface Trace { x: number; y: number; t: number; life: number; a: number; s: number; id?: string; chainId?: string; prevId?: string }
/** Run-local movement continuity; absent in legacy saves. */
export interface TraceWalk { x: number; y: number; at: number; distance: number; lastId?: string; chainId?: string }

export interface Receipt { id: string; seq: number; at: number; kind: string; detail: string }

export interface RunRecord {
  runId: string; character: string; startedAt: number; endedAt: number; ending: 'evacuated' | 'abandoned' | 'expired';
  score: number; stones: number; deposited: number; achievements: string[]; qa: boolean; verified: 'LOCAL/UNVERIFIED';
}
export interface Profile {
  securedCash: number; achievements: Record<string, { at: number; score: number; runId: string }>;
  history: RunRecord[]; settings: { volume: number; muted: boolean }; profileReceipts: string[];
}
/** Physically supplied bed rest (SOH_PROVISIONAL). Reserve stacks are real custody, not copies. */
export interface RestState { version: 'rest-v1'; bedId: string; chestId: string; reserveId: string; startedAt: number; targetAt: number; eatenHunger: number; drunkThirst: number; }
export interface RunState {
  rest?: RestState;
  id: string; seed: number; character: 'male' | 'female'; startedAt: number; qaOffset: number; qaUsed: boolean;
  /** Added additively; absent legacy saves are interpreted as the canonical shipping layout. */
  layoutId?: string;
  /** Run-pinned additive source overlay; absent legacy runs keep v1 placements. */
  sourceLayoutVersion?: 2 | 3;
  /** Source map identity is mandatory for v3; older runs retain their own layout. */
  sourceMap?: { id: string; revision: number; seed: number; rules: 3; digest: string; mapDigest?: string; veyra?: {sourceCommit:string;sourceDigest:string;originAu:[number,number];unitsPerTile:1.6|2;frameAu:[number,number];projection:'cell-centre-v1'} };
  /** Additive, pinned when a run is created or first resumed/saved. */
  airdrops?: {version:'airdrop-v1'; mapDigest:string; seed:number; runId:string; startedAt:number; nextIndex:number};
  wreckEconomy?: 'direct-v1' | 'recycler-v1';
  spawnChoice?: { x:number; y:number; contract:'seeded-geographic-v1' };
  spawnRegion: number; ended: null | string;
  player: Player; creatures: Creature[];
  /** B05-R: oil sources keyed `oil:tx:ty`. Only a labelled test fixture authority exists today; production Map oil sites are NOT authorized (see balance oilPumpV1). */
  oilSources?: Record<string, { tx: number; ty: number; stock: number; authority: 'test-fixture-v1' }>;
  /** Domain marker: set ONLY by the test-only fixture registrar. A run without it cannot hold or validate oil sources.
   *  Future production sources must bind to a versioned Map site + map revision (authority not yet defined). */
  oilTestFixture?: true;
  sources: Record<number, { stock: number; hp: number; regrowAt?: number; regrowFrom?: number; regrowAcc?: number; regrowDoneAt?: number; burnt?: boolean; fire?: number; fireSpreadAt?: number; fireDepth?: number }>; // K3 deltas over base world
  /** Authored public loot sites emptied in this run (tile index). Absent on older saves. */
  depletedLootSites?: number[];
  /** Absolute due times for renewable authored loot; absent W00 entries migrate conservatively. */
  lootRespawnAt?: Record<number, number>;
  /** Gameplay-owned initial unique rewards, only on explicitly versioned fresh Web layouts. */
  creatorLootV1?: true;
  renewedLootSites?: number[];
  /** New-run pinned authored-site economy; old runs retain their original tables. */
  lootEcology?: { version: 'w06-v1'; cycles: Record<string,number>; /** B01 family×grade grammar; absent on pre-B01 runs (no reroll). */ grammar?: 'b01-v1' | 'b04-v1' | 'b05-v1'; /** B05 only: digest-pinned physical source contract measured at run start. */ sourceContract?: import('./loot-source-spec').LootSourceContract; /** B05 only: door-gated sources whose one-time grammar stock was already drawn (sourceIds). */ deferredLoot?: string[] };
  poiAccessVersion?: 'poi-access-v1';
  poiAccessDigest?: string;
  natureTrees?: {tx:number;ty:number;until:number}[];
  spiritTransit?: { x:number; y:number; arriveAt:number; uid:string };
  terrain: Record<number, { t: number; until?: number; untilAt?: number }>; // K2 terrain mutations (burns, ice)
  entities: Record<string, Entity>;
  custody: Record<string, Container>;
  knowledge: { recipes: string[]; studied: string[] };
  traces: Trace[];
  /** Bounded, ephemeral real event impulses; absent in legacy runs. */
  worldStimuli?: WorldStimulus[];
  /** Additive: absent in old saves; physical combat remains unresolved while away. */
  combat?: { projectiles: Proj[]; hazards: Haz[] };
  /** Committed Dragon collection continues only during physical combat frames. */
  dragonDive?: { ids: string[]; x: number; y: number; left: number; route?: { id:string; x:number; y:number }[]; index?: number; dragonX?:number; dragonY?:number; phase?: 'traverse'|'gather'|'dive'; hitIds?:string[] };
  traceWalk?: TraceWalk;
  discovered: number[]; // 4x4-tile cells
  poiSeen: string[];
  /** Additive: physically observed expedition facts; absent in old saves. See expedition-intel.ts. */
  intel?: string[];
  elderStones: string[];
  achievements: string[]; score: number; deposited: number;
  clock: { lastSimAt: number; simMs: number; respawnAcc: number; weatherSlot: number; defenseFrames?: number };
  /** CAL-01 world_calendar_v1 derived observation ledger (see calendar.ts).
   * It is NOT a time authority: the season is always recomputed from startedAt/qaOffset
   * and this record only prevents a season event from being announced twice.
   * Absent on pre-season saves, which are reconstructed from the run clock. */
  calendar?: import('./calendar').CalendarLedgerV1;
  rng: number; nextId: number;
  receipts: Receipt[]; seenIntents: string[]; seq: number;
  vendorStock: Record<string, number>;
  log: { t: number; msg: string; tone?: string }[];
}
export interface GameState { version: number; revision: number; profile: Profile; run: RunState | null; lastIntentAt?: number }

export function uid(run: RunState, p = 'i') { return `${p}${(run.nextId++).toString(36)}`; }
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export function angDiff(a: number, b: number) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
export function dirFromAngle(a: number): Dir {
  const c = Math.cos(a), s = Math.sin(a);
  if (Math.abs(c) > Math.abs(s)) return c > 0 ? 2 : 1;
  return s > 0 ? 0 : 3;
}
