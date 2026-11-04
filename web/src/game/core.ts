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
export interface Haz { kind: 'circle' | 'line' | 'ring' | 'wave' | 'sweep' | 'pool'; x: number; y: number; r?: number; angle?: number; len?: number; w?: number; t: number; tell: number; dur: number; dmg: number; style: string; effect?: string; hit?: boolean; tickAcc?: number; a0?: number; a1?: number; done?: boolean; owner?: string; elder?: string }

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
  invuln: number; dead: boolean; deadT: number; pulling: string | null;
  skills: Record<string, number>; // xp
  stepAcc: number; lastTraceX: number; lastTraceY: number;
  regionName: string; sheltered: boolean;
}

export interface Creature {
  id: string; type: string; x: number; y: number; hp: number; maxHp: number;
  homeX: number; homeY: number; state: 'idle' | 'wander' | 'chase' | 'track' | 'tell' | 'attack' | 'recover' | 'flee' | 'sleep' | 'dead';
  t: number; tx: number; ty: number; angle: number; dir: Dir;
  /** knowledge is limited to what it physically sensed */
  knows: null | { kind: 'sight' | 'trace'; x: number; y: number; at: number; traceId?: string; chainId?: string };
  /** Last completed/lost chain, preventing repeated reacquisition of the same marks. */
  traceIgnore?: string;
  /** Last justified physical checkpoint after offline activity was deferred. */
  offlineUnresolvedAt?: number;
  path: number[] | null; pathT: number; cd: number; kbx: number; kby: number; flash: number;
  elder?: { key: string; awake: boolean; phase: number; pattern: number; special: number; shield?: number; submerged?: boolean };
  patternKey?: string; atk?: any; slow?: number; signatureBurnNext?: number; tornadoNext?: number;
}

export interface Entity {
  id: string; kind: 'drop' | 'struct' | 'bag' | 'cart' | 'loot' | 'cash' | 'vendor' | 'evac' | 'door' | 'gen' | 'recycler';
  x: number; y: number; // px for drops/carts, tile*16+8 for structures
  tx?: number; ty?: number; type?: string; hp?: number; maxHp?: number;
  c?: string; // container id
  open?: boolean; locked?: string; poi?: string; label?: string; stock?: Record<string, number>;
  station?: { queue: Job[]; burn: number; fuelC: string; outC: string; level?: 1 | 2 | 3; upgrade?: 'kiln_lining' };
  garden?: { crop: string | null; growth: number; water: number; coldFrame?: boolean };
  farm?: { enabled: boolean; crop: 'crop' | 'herb'; energy: number; gardenId?: string; barrelId?: string; chestId?: string };
  basePower?: { enabled: boolean; energy: number };
  turret?: { enabled: boolean; generatorId?: string; cooldown: number; angle: number; tracking?: boolean };
  water?: number; minted?: boolean; claim?: string; vx?: number; vy?: number; born?: number; owner?: string;
  power?: number; fire?: number;
  /** The original deployable instance, retained until reclaim or destruction. */
  deployed?: Stack;
  /** Legacy jobs with unknowable paid inputs, preserved after station destruction. */
  legacyJobs?: { stationType: string; queue: Job[] };
}
/** Undefined reserved means an older save whose paid inputs cannot be reconstructed safely. */
export interface Job { id: string; recipe: string; left: number; total: number; reserved?: Stack[] }

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
export interface RunState {
  id: string; seed: number; character: 'male' | 'female'; startedAt: number; qaOffset: number; qaUsed: boolean;
  /** Added additively; absent legacy saves are interpreted as the canonical shipping layout. */
  layoutId?: string;
  /** Run-pinned additive source overlay; absent legacy runs keep v1 placements. */
  sourceLayoutVersion?: 2 | 3;
  /** Source map identity is mandatory for v3; older runs retain their own layout. */
  sourceMap?: { id: string; revision: number; seed: number; rules: 3; digest: string; mapDigest?: string; veyra?: {sourceCommit:string;sourceDigest:string;originAu:[number,number];unitsPerTile:1.6|2;frameAu:[number,number];projection:'cell-centre-v1'} };
  /** Additive, pinned when a run is created or first resumed/saved. */
  wreckEconomy?: 'direct-v1' | 'recycler-v1';
  spawnChoice?: { x:number; y:number; contract:'seeded-geographic-v1' };
  spawnRegion: number; ended: null | string;
  player: Player; creatures: Creature[];
  sources: Record<number, { stock: number; hp: number; regrowAt?: number; burnt?: boolean; fire?: number; fireSpreadAt?: number; fireDepth?: number }>; // K3 deltas over base world
  /** Authored public loot sites emptied in this run (tile index). Absent on older saves. */
  depletedLootSites?: number[];
  /** Absolute due times for renewable authored loot; absent W00 entries migrate conservatively. */
  lootRespawnAt?: Record<number, number>;
  terrain: Record<number, { t: number; until?: number }>; // K2 terrain mutations (burns, ice)
  entities: Record<string, Entity>;
  custody: Record<string, Container>;
  knowledge: { recipes: string[]; studied: string[] };
  traces: Trace[];
  /** Additive: absent in old saves; physical combat remains unresolved while away. */
  combat?: { projectiles: Proj[]; hazards: Haz[] };
  /** Committed Dragon collection continues only during physical combat frames. */
  dragonDive?: { ids: string[]; x: number; y: number; left: number };
  traceWalk?: TraceWalk;
  discovered: number[]; // 4x4-tile cells
  poiSeen: string[];
  elderStones: string[];
  achievements: string[]; score: number; deposited: number;
  clock: { lastSimAt: number; simMs: number; respawnAcc: number; weatherSlot: number };
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
