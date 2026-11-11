// ============================================================================
// JOURNEY — Fieldcraft (guidance), Daily Objectives (Waypoints) and the
// Chronicle (achievements + journey-defining moments).
//
// Authority rules
//  · Progress comes ONLY from committed engine receipts (r.receipts, monotonic
//    seq) plus two observed, persisted state sets (r.poiSeen discoveries and
//    the Creator Core UIDs in custody). Opening a panel never completes a step.
//  · Each run has a cursor (last processed receipt seq). A receipt is ingested
//    exactly once; completions carry stable ids (`daily:<date>:<obj>`,
//    `fc:<lesson>:<step>`) held in claimed sets, so reload/replay cannot pay twice.
//  · The store is flushed to storage only when the game save itself succeeds
//    (see Game.tsx), so journey progress never runs ahead of the world it
//    describes after a crash/rollback.
//  · Nothing here grants items or currency. Milestone rewards that would need
//    economic authority are recorded as PENDING with the exact integration need.
// ============================================================================
import { ACHIEVEMENTS, ITEMS, SOURCES, STRUCTS, lookupElderDef } from './catalog';
import { BAL, type GameState, type RunState } from './core';
import type { Receipt } from './presentation-cues';
import { POIS } from '../veyra05/reader';

export type FeedbackLevel = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------
// Receipt helpers
// ---------------------------------------------------------------------------
const srcOf = (rc: Receipt) => rc.detail.split('@')[0];
const harvestUnits = (rc: Receipt) => { const m = / -(\d+)$/.exec(rc.detail); return m ? Math.max(1, +m[1]) : 1; };
const buildType = (rc: Receipt) => rc.detail.split('@')[0];
const isMat = (rc: Receipt, mat: string) => rc.kind === 'harvest' && SOURCES[srcOf(rc)]?.mat === mat;
/** Synthetic observation receipts (never written to the run) for persisted state growth. */
export const OBS_POI = 'obs.poi';
export const OBS_CORE = 'obs.core';

// ---------------------------------------------------------------------------
// FIELDCRAFT — optional survival lessons. Steps complete from receipts only.
// ---------------------------------------------------------------------------
export type AnchorHint =
  | { kind: 'source'; mat: string }
  | { kind: 'struct'; types: string[] }
  | { kind: 'water' }
  | { kind: 'deathbag' };

export interface FieldStep {
  id: string; title: string; target: number;
  /** One-line "how" shown when the tracker opens up. */
  how: string;
  /** Why it matters (shown in the ledger and when blocked). */
  why: string;
  icon: string;
  anchor?: AnchorHint;
  /** Context where the tracker should open up to the informative state. */
  focus?: ('craft' | 'build' | 'station' | 'explore')[];
  count: (rc: Receipt) => number;
  /** Absent/offline receipts count only when the player set the work in motion. */
  offlineOk?: boolean;
}
export interface FieldLesson { id: string; title: string; motto: string; icon: string; steps: FieldStep[] }

export const FIELDCRAFT: FieldLesson[] = [
  { id: 'landfall', title: 'Landfall', motto: 'Hands first, tools second.', icon: 'wood', steps: [
    { id: 'gather', title: 'Gather by hand', target: 3, icon: 'wood', how: 'Swing LMB at a tree, boulder or bush.', why: 'Every tool, wall and fire begins as raw timber, stone and fiber.', anchor: { kind: 'source', mat: 'wood' }, focus: ['explore'],
      count: rc => rc.kind === 'harvest' ? harvestUnits(rc) : 0 },
    { id: 'tool', title: 'Shape a tool', target: 1, icon: 'rope', how: 'Open Survivor [C] and craft anything you can afford.', why: 'Tools multiply what each swing yields and let you break stone and ore.', focus: ['craft'],
      count: rc => rc.kind === 'craft.hand' ? 1 : 0 },
    { id: 'sustain', title: 'Drink or eat', target: 1, icon: 'berries', how: 'E beside river water, or use food from Quickbar 1–8.', why: 'Hunger and thirst quietly drain stamina and, at the end, health.', anchor: { kind: 'water' },
      count: rc => ['drink', 'drink.flask', 'consume', 'barrel.drink', 'rest.eat', 'rest.drink'].includes(rc.kind) ? 1 : 0 },
  ] },
  { id: 'shelter', title: 'Hearth & Wall', motto: 'A roof is the first victory.', icon: 'st:wall_wood', steps: [
    { id: 'claim', title: 'Raise a Territory Cabinet', target: 1, icon: 'st:claim', how: 'B → pick the cabinet, click open ground.', why: 'Unclaimed structures decay in about two hours. The cabinet protects them.', focus: ['build'],
      count: rc => rc.kind === 'build' && buildType(rc) === 'claim' ? 1 : 0 },
    { id: 'walls', title: 'Raise four walls', target: 4, icon: 'st:wall_wood', how: 'B → Wood Wall. Each wall needs its own tile.', why: 'Walls keep creatures out and keep the warmth of a fire in.', focus: ['build'],
      count: rc => rc.kind === 'build' && buildType(rc).startsWith('wall') ? 1 : 0 },
    { id: 'home', title: 'Close a home', target: 1, icon: 'st:roof_thatch', how: 'Enclose walls, then add a roof or a straw bed inside.', why: 'A sealed home shelters you from cold and stops warmth loss at night.', focus: ['build'],
      count: rc => rc.kind === 'achievement' && rc.detail === 'first_home' ? 1 : 0 },
    { id: 'fire', title: 'Light a campfire', target: 1, icon: 'st:campfire', how: 'B → Campfire. Feed it wood or coal.', why: 'Fire is warmth at night and the first cooking station.', focus: ['build'],
      count: rc => rc.kind === 'build' && buildType(rc) === 'campfire' ? 1 : 0 },
  ] },
  { id: 'industry', title: 'Fire & Iron', motto: 'Stations do the waiting for you.', icon: 'iron_ingot', steps: [
    { id: 'bench', title: 'Build a Workbench', target: 1, icon: 'st:workbench', how: 'Craft or place a Workbench from Build [B].', why: 'Benches unlock the recipes your hands alone cannot make.', focus: ['build'],
      count: rc => rc.kind === 'build' && buildType(rc) === 'workbench' ? 1 : 0 },
    { id: 'furnace', title: 'Build a Furnace', target: 1, icon: 'st:furnace', how: 'Place a Furnace near your shelter.', why: 'Ore is worthless until fire turns it into ingots.', focus: ['build'],
      count: rc => rc.kind === 'build' && buildType(rc) === 'furnace' ? 1 : 0 },
    { id: 'smelt', title: 'Smelt an ingot', target: 1, icon: 'iron_ingot', how: 'E on the Furnace: fuel it, queue Iron Ingot, collect.', why: 'Iron is the gateway to stronger tools, plates and machines.', anchor: { kind: 'struct', types: ['furnace'] }, focus: ['station'], offlineOk: true,
      count: rc => rc.kind === 'achievement' && rc.detail === 'first_ingot' ? 1 : 0 },
    { id: 'study', title: 'Study or learn a recipe', target: 1, icon: 'blueprint', how: 'Research Table [R] with a sample, or use a Blueprint.', why: 'Knowledge is permanent for the run — it never breaks or decays.', anchor: { kind: 'struct', types: ['research'] }, focus: ['station', 'craft'], offlineOk: true,
      count: rc => rc.kind === 'learn.blueprint' || rc.kind === 'research.specimen' || (rc.kind === 'achievement' && rc.detail === 'first_research') ? 1 : 0 },
  ] },
  { id: 'expedition', title: 'Beyond the Treeline', motto: 'The map is earned, step by step.', icon: 'spares', steps: [
    { id: 'discover', title: 'Discover two places', target: 2, icon: 'spares', how: 'Travel until a place name rises on screen.', why: 'Places hold loot sites, vendors, vaults and Elders.', focus: ['explore'],
      count: rc => rc.kind === OBS_POI ? 1 : 0 },
    { id: 'scavenge', title: 'Search a loot site', target: 1, icon: 'scrap', how: 'E on a crate, cache or supply drop.', why: 'Scavenged parts skip hours of crafting.', focus: ['explore'],
      count: rc => ['intel.loot', 'airdrop.open', 'cash.view'].includes(rc.kind) ? 1 : 0 },
    { id: 'defend', title: 'Defend yourself', target: 1, icon: 'leather', how: 'LMB to strike, Space to dodge-roll away from tells.', why: 'Creatures guard the best ground. Learning their tells keeps you alive.',
      count: rc => rc.kind === 'creature.kill' ? 1 : 0 },
    { id: 'secure', title: 'Secure coins to your profile', target: 1, icon: 'rcash', how: 'Deposit cash in an Escrow chest (Rương ký gửi).', why: 'Secured coins survive death and the end of the run.',
      count: rc => rc.kind === 'escrow.deposit' ? 1 : 0 },
  ] },
];

// ---------------------------------------------------------------------------
// DAILY WAYPOINTS — optional, rotating, receipt-backed.
// ---------------------------------------------------------------------------
export type DailyCat = 'gather' | 'craft' | 'build' | 'explore' | 'survive' | 'hunt' | 'produce';
export interface DailyDef {
  id: string; cat: DailyCat; title: string; target: number; points: number; tier: 1 | 2 | 3;
  icon: string; how: string;
  count: (rc: Receipt, seen: Set<string>) => number;
  gate?: (r: RunState) => boolean;
  offlineOk?: boolean;
  anchor?: AnchorHint;
}
const owns = (r: RunState, types: string[]) => Object.values(r.entities).some(e => e.kind === 'struct' && types.includes(e.type || '') && (!e.owner || e.owner === 'player'));
const ownsAny = (r: RunState) => Object.values(r.entities).some(e => e.kind === 'struct' && (!e.owner || e.owner === 'player'));
/** distinct-key counter: rebuilding the same tile / re-harvesting cannot inflate variety goals */
const distinct = (seen: Set<string>, key: string) => { if (seen.has(key)) return 0; seen.add(key); return 1; };

export const DAILY_POOL: DailyDef[] = [
  { id: 'timber', cat: 'gather', title: 'Fell timber', target: 12, points: 10, tier: 1, icon: 'wood', how: 'Harvest wood from any tree.', anchor: { kind: 'source', mat: 'wood' }, count: rc => isMat(rc, 'wood') ? harvestUnits(rc) : 0 },
  { id: 'quarry', cat: 'gather', title: 'Break stone & ore', target: 10, points: 15, tier: 2, icon: 'stone', how: 'Boulders, iron veins and coal seams.', anchor: { kind: 'source', mat: 'stone' }, count: rc => isMat(rc, 'stone') || isMat(rc, 'ore') ? harvestUnits(rc) : 0 },
  { id: 'forage', cat: 'gather', title: 'Forage the wilds', target: 6, points: 10, tier: 1, icon: 'berries', how: 'Berry bushes and wild plants.', anchor: { kind: 'source', mat: 'plant' }, count: rc => isMat(rc, 'plant') ? harvestUnits(rc) : 0 },
  { id: 'variety', cat: 'gather', title: 'Harvest 3 kinds of source', target: 3, points: 20, tier: 2, icon: 'fiber', how: 'Trees, stones, ores, plants — different species count.', count: (rc, s) => rc.kind === 'harvest' ? distinct(s, `src:${srcOf(rc)}`) : 0 },
  { id: 'handcraft', cat: 'craft', title: 'Hand-craft 3 times', target: 3, points: 10, tier: 1, icon: 'rope', how: 'Survivor [C] — any recipe.', count: rc => rc.kind === 'craft.hand' ? 1 : 0 },
  { id: 'recipes', cat: 'craft', title: 'Craft 2 different recipes', target: 2, points: 15, tier: 2, icon: 'blueprint', how: 'Variety, not volume.', count: (rc, s) => rc.kind === 'craft.hand' ? distinct(s, `rec:${rc.detail}`) : 0 },
  { id: 'mend', cat: 'craft', title: 'Mend worn equipment', target: 1, points: 15, tier: 2, icon: 'mechanical_parts', how: 'Repair an item at a bench or with a kit.', gate: r => r.knowledge.recipes.length > 0, count: rc => rc.kind === 'item.repair' || rc.kind === 'item.fieldRepair' ? 1 : 0 },
  { id: 'raise', cat: 'build', title: 'Raise 5 structures', target: 5, points: 15, tier: 2, icon: 'st:wall_wood', how: 'Each must stand on a new tile.', count: (rc, s) => rc.kind === 'build' ? distinct(s, `tile:${rc.detail.split('@')[1]}`) : 0 },
  { id: 'fortify', cat: 'build', title: 'Fortify 2 structures', target: 2, points: 20, tier: 2, icon: 'st:wall_stone', how: 'Upgrade [U] or repair [V] what you own.', gate: ownsAny, count: rc => ['structure.upgrade', 'structure.repair', 'structure.repair.plate', 'territory.repair.batch'].includes(rc.kind) ? 1 : 0 },
  { id: 'chart', cat: 'explore', title: 'Discover a new place', target: 1, points: 25, tier: 3, icon: 'spares', how: 'Travel somewhere you have never been.', count: (rc, s) => (rc.kind === OBS_POI || rc.kind === 'poi.discover') ? distinct(s, `poi:${rc.detail}`) : 0 },
  { id: 'scavenge', cat: 'explore', title: 'Search 2 loot sites', target: 2, points: 15, tier: 2, icon: 'scrap', how: 'Crates, caches and drops.', count: (rc, s) => rc.kind === 'intel.loot' || rc.kind === 'airdrop.open' ? distinct(s, `loot:${rc.detail.split(':')[0]}`) : 0 },
  { id: 'hydrate', cat: 'survive', title: 'Eat or drink 4 times', target: 4, points: 10, tier: 1, icon: 'berries', how: 'Rivers, flasks, food.', anchor: { kind: 'water' }, count: rc => ['drink', 'drink.flask', 'consume', 'barrel.drink', 'rest.eat', 'rest.drink'].includes(rc.kind) ? 1 : 0 },
  { id: 'rest', cat: 'survive', title: 'Rest through a stretch', target: 1, points: 15, tier: 2, icon: 'st:bed_straw', how: 'Sleep in your own bed.', gate: r => owns(r, ['bed_straw']), anchor: { kind: 'struct', types: ['bed_straw'] }, count: rc => rc.kind === 'rest.end' ? 1 : 0 },
  { id: 'hunt2', cat: 'hunt', title: 'Defeat 2 creatures', target: 2, points: 20, tier: 2, icon: 'leather', how: 'Fight what threatens you.', count: rc => rc.kind === 'creature.kill' ? 1 : 0 },
  { id: 'hunt5', cat: 'hunt', title: 'Defeat 5 creatures', target: 5, points: 35, tier: 3, icon: 'leather', how: 'A proper hunt. Mind your stamina.', gate: r => r.knowledge.recipes.length >= 2, count: rc => rc.kind === 'creature.kill' ? 1 : 0 },
  { id: 'smelt', cat: 'produce', title: 'Finish 3 station jobs', target: 3, points: 20, tier: 2, icon: 'iron_ingot', how: 'Furnace, bench or recycler output.', gate: r => owns(r, ['furnace', 'workbench', 'campfire', 'recycler', 'refinery']), anchor: { kind: 'struct', types: ['furnace', 'workbench', 'campfire'] }, offlineOk: true, count: rc => rc.kind === 'job.done' || rc.kind === 'recycle.finish' ? 1 : 0 },
  { id: 'knowledge', cat: 'produce', title: 'Gain new knowledge', target: 1, points: 30, tier: 3, icon: 'blueprint', how: 'Study a specimen or learn a blueprint.', gate: r => owns(r, ['research']), anchor: { kind: 'struct', types: ['research'] }, count: rc => rc.kind === 'learn.blueprint' || rc.kind === 'research.specimen' ? 1 : 0 },
];
export const DAILY_BY_ID = Object.fromEntries(DAILY_POOL.map(d => [d.id, d])) as Record<string, DailyDef>;
export const CAT_LABEL: Record<DailyCat, string> = { gather: 'Gather', craft: 'Craft', build: 'Build', explore: 'Explore', survive: 'Endure', hunt: 'Hunt', produce: 'Produce' };

/** Milestones: four objectives typically offer 55–95 points; Beacon needs most of a day, never all of it.
 *  Each milestone awards +1 Wayfarer Mark AND an authoritative `journeyRequisition` bundle (Secured Cash + supplies). */
export const DAILY_MILESTONES = [
  { at: 25, id: 'ember', name: 'Ember', marks: 1, pending: null as null | string },
  { at: 50, id: 'hearth', name: 'Hearth', marks: 1, pending: null as null | string },
  { at: 75, id: 'beacon', name: 'Beacon', marks: 1, pending: null as null | string },
] as const;

export function milestoneRewardSpec(id: string): { points: number; securedCash: number; items: [string, number][] } | null {
  const table = (BAL as any).journeyRequisitions as Record<string, { points: number; securedCash: number; items: [string, number][] }> | undefined;
  return table && Object.prototype.hasOwnProperty.call(table, id) ? table[id] : null;
}
export function milestoneRewardLabel(id: string): string {
  const sp = milestoneRewardSpec(id);
  if (!sp) return '';
  const items = sp.items.map(([k, q]) => `${q}× ${ITEMS[k]?.name ?? k}`).join(' · ');
  return `+${sp.securedCash} Secured Cash · ${items}`;
}
export function isMilestoneRequisitioned(gs: GameState, date: string, id: string): boolean {
  const prefix = `req:${date}:${id}:`;
  return gs.profile.profileReceipts.some(x => x.startsWith(prefix));
}
/** Wayfarer rank: a journey record built from Marks. It has no economic value by design. */
export const WAYFARER_RANKS = [
  { at: 0, name: 'Castaway' }, { at: 4, name: 'Forager' }, { at: 12, name: 'Pathfinder' }, { at: 30, name: 'Wayfarer' }, { at: 60, name: 'Warden of Veyra' },
];
export const rankFor = (marks: number) => { let i = 0; WAYFARER_RANKS.forEach((r, k) => { if (marks >= r.at) i = k; }); return { ...WAYFARER_RANKS[i], index: i, next: WAYFARER_RANKS[i + 1] ?? null }; };

// ---------------------------------------------------------------------------
// ACHIEVEMENT presentation metadata (extends, never duplicates, ACHIEVEMENTS)
// ---------------------------------------------------------------------------
export const ACH_META: Record<string, { level: FeedbackLevel; icon: string; hint: string; tale: string }> = {
  first_home: { level: 3, icon: 'st:roof_thatch', hint: 'Enclose a space and roof it or bed it.', tale: 'Four walls, one roof. The wind stopped at the door.' },
  first_ingot: { level: 3, icon: 'iron_ingot', hint: 'Smelt iron at a furnace.', tale: 'The first ingot cooled in the dark — and everything changed.' },
  first_research: { level: 3, icon: 'blueprint', hint: 'Finish a Research Table job.', tale: 'A puzzle turned into a plan.' },
  first_core: { level: 4, icon: 'core_dragon', hint: 'Spend a Creator Core charge.', tale: 'Old power answered your hand.' },
  cart: { level: 3, icon: 'cart_kit', hint: 'Deploy a cart.', tale: 'Now the land could carry what your back could not.' },
  recover_bag: { level: 3, icon: 'scrap', hint: 'Recover your fallen gear.', tale: 'Nothing was left behind.' },
  vault: { level: 4, icon: 'rcash', hint: 'Open a sealed vault during Ragnarok.', tale: 'The vault breathed out a century of dust.' },
  first_deposit: { level: 4, icon: 'rcash', hint: 'Secure coins in escrow.', tale: 'Something of this run will outlive it.' },
  ragnarok: { level: 5, icon: 'coal', hint: 'Survive into the final 72 hours.', tale: 'The sky split. You were there to see it.' },
  elder_1: { level: 5, icon: 'crystal', hint: 'Defeat an Elder.', tale: 'A legend fell, and you were still standing.' },
  evacuated: { level: 5, icon: 'fuel_can', hint: 'Reach the Evacuation Beacon.', tale: 'You got out.' },
  six_stones: { level: 5, icon: 'crystal', hint: 'Evacuate carrying all six Elder stones.', tale: 'The Crown of Six Stones. Few will believe you.' },
};

// ---------------------------------------------------------------------------
// STORE
// ---------------------------------------------------------------------------
export interface DailyObjectiveState { id: string; progress: number; done: boolean; doneAt?: number; seen: string[] }
export interface DailyState { date: string; runId?: string; objectives: DailyObjectiveState[]; points: number; milestones: string[]; rerolled: boolean; rerolledFrom?: string }
export interface ChronicleEntry { id: string; at: number; level: FeedbackLevel; title: string; detail: string; icon?: string; runId: string; kind: 'achievement' | 'lesson' | 'daily' | 'discovery' | 'relic' | 'elder' | 'world' | 'capability'; away?: boolean; seen?: boolean }
export type TrackRef = { type: 'lesson'; id: string } | { type: 'daily'; id: string } | null;
export interface LessonState { status: 'unseen' | 'seen' | 'dismissed'; steps: Record<string, number>; done: string[]; completedAt?: number }
export interface JourneyStore {
  v: 1; salt: string;
  cursors: Record<string, number>;
  poiSeen: Record<string, string[]>;
  coreSeen: Record<string, string[]>;
  lessons: Record<string, LessonState>;
  daily: DailyState | null;
  history: { date: string; points: number; milestones: string[]; completed: number }[];
  claimed: string[];
  marks: number;
  pendingRewards: { id: string; date: string; milestone: string; requirement: string }[];
  chronicle: ChronicleEntry[];
  tracked: TrackRef;
  /** the player explicitly untracked; suggestions stay quiet until they choose again */
  trackQuiet: boolean;
}
export interface JourneyEvent {
  id: string; level: FeedbackLevel; kind: ChronicleEntry['kind'] | 'step' | 'progress' | 'milestone';
  title: string; detail: string; icon?: string; away?: boolean;
  /** world anchor (px) when the moment belongs to a place */
  at?: { x: number; y: number };
  ref?: TrackRef;
}

const KEY = 'soh.journey.v1';
const qaMem = new WeakMap<GameState, JourneyStore>();
export const freshStore = (): JourneyStore => ({ v: 1, salt: Math.random().toString(36).slice(2, 10), cursors: {}, poiSeen: {}, coreSeen: {}, lessons: {}, daily: null, history: [], claimed: [], marks: 0, pendingRewards: [], chronicle: [], tracked: null, trackQuiet: false });

export function loadJourney(gs: GameState, qa: boolean): JourneyStore {
  if (qa) { const m = qaMem.get(gs); if (m) return m; const s = freshStore(); qaMem.set(gs, s); return s; }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || raw.v !== 1 || typeof raw.salt !== 'string') return freshStore();
    return { ...freshStore(), ...raw, claimed: Array.isArray(raw.claimed) ? raw.claimed : [], chronicle: Array.isArray(raw.chronicle) ? raw.chronicle : [] };
  } catch { return freshStore(); }
}
/** Called only after a successful game save (or for QA, in memory). */
export function flushJourney(gs: GameState, qa: boolean, s: JourneyStore) {
  if (qa) { qaMem.set(gs, s); return; }
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota: next save retries */ }
}

export const dateKey = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};
export function isValidDateKey(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
export const dailySaltFor = (r: RunState | null) => (r ? `run:${r.id}:${r.seed}` : 'norun');
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let x = seed || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

/** Day-invariant capability gate evaluated strictly as of 00:00 UTC of `date` so mid-day builds/research never mutate today's objective slate. */
function dailyGateAtDayStart(def: DailyDef, r: RunState | null, date: string): boolean {
  if (!def.gate) return true;
  if (!r) return false;
  if (date <= dateKey(r.startedAt)) return false;
  const hasRunStart = r.receipts.some(rc => rc.kind === 'run.start');
  if (!hasRunStart) return def.gate(r);
  const prior = r.receipts.filter(rc => dateKey(rc.at) < date);
  if (!prior.length) return false;
  const learnedCount = new Set(
    prior.filter(rc => rc.kind === 'learn.blueprint' || rc.kind === 'research.specimen').map(rc => rc.detail),
  ).size;
  const builtTypes = new Set(
    prior.filter(rc => rc.kind === 'build').map(rc => rc.detail.split('@')[0]),
  );
  if (def.id === 'mend') return learnedCount >= 1;
  if (def.id === 'hunt5') return learnedCount >= 2;
  if (def.id === 'fortify') return builtTypes.size > 0;
  if (def.id === 'rest') return builtTypes.has('bed_straw');
  if (def.id === 'smelt') return ['furnace', 'workbench', 'campfire', 'recycler', 'refinery'].some(t => builtTypes.has(t));
  if (def.id === 'knowledge') return builtTypes.has('research');
  return def.gate(r);
}

/** Four objectives from four different categories, capability-gated, with one easy and one demanding. */
export function generateDaily(date: string, salt: string, r: RunState | null, exclude: string[] = []): string[] {
  const rand = rng(hash(`${date}|${salt}`));
  const pool = DAILY_POOL.filter(d => !exclude.includes(d.id) && dailyGateAtDayStart(d, r, date));
  const cats = [...new Set(pool.map(d => d.cat))].sort(() => rand() - 0.5);
  const pick: DailyDef[] = [];
  for (const c of cats) {
    if (pick.length >= 4) break;
    const opts = pool.filter(d => d.cat === c);
    const needEasy = pick.length === 3 && !pick.some(p => p.tier === 1);
    const needHard = pick.length === 3 && !pick.some(p => p.tier === 3);
    const pref = opts.filter(o => needEasy ? o.tier === 1 : needHard ? o.tier === 3 : true);
    const from = pref.length ? pref : opts;
    pick.push(from[Math.floor(rand() * from.length)]);
  }
  return pick.map(p => p.id);
}

export function resolveRerollReplacement(date: string, salt: string, taken: string[], objId: string, r: RunState | null): DailyDef | null {
  const cats = new Set(taken.map(id => DAILY_BY_ID[id]?.cat));
  const rand = rng(hash(`${date}|${salt}|reroll`));
  const opts = DAILY_POOL.filter(p => !taken.includes(p.id) && dailyGateAtDayStart(p, r, date) && (!cats.has(p.cat) || p.cat === DAILY_BY_ID[objId]?.cat));
  if (!opts.length) return null;
  return opts[Math.floor(rand() * opts.length)];
}

/** Measure authoritative progress for a single daily objective on `date` from committed `r.receipts` strictly after `afterSeq`. */
export function measureDailyObjectiveProgress(r: RunState, date: string, objId: string, afterSeq = 0): number {
  const def = DAILY_BY_ID[objId];
  if (!def || !isValidDateKey(date)) return 0;
  const seen = new Set<string>();
  let progress = 0;
  for (const rc of r.receipts as Receipt[]) {
    if (rc.seq <= afterSeq || dateKey(rc.at) !== date) continue;
    const inc = def.count(rc, seen);
    if (inc > 0) progress = Math.min(def.target, progress + inc);
    if (progress >= def.target) break;
  }
  return progress;
}

/** Recompute authoritative Daily Waypoint points exclusively from committed `r.dailyRerolls` and committed `r.receipts` on `date`. */
export function computeAuthoritativeDailyPoints(r: RunState, date: string): number {
  if (!isValidDateKey(date)) return 0;
  const salt = dailySaltFor(r);
  const baseIds = generateDaily(date, salt, r);
  const committed = r.dailyRerolls?.[date];
  const validReroll = committed
    && baseIds.includes(committed.from)
    && resolveRerollReplacement(date, salt, baseIds, committed.from, r)?.id === committed.to
    ? committed
    : null;
  const activeIds = validReroll
    ? baseIds.map(id => (id === validReroll.from ? validReroll.to : id))
    : baseIds;

  let points = 0;
  for (const id of activeIds) {
    const def = DAILY_BY_ID[id];
    if (!def) continue;
    const afterSeq = validReroll && id === validReroll.to ? validReroll.seq : 0;
    if (measureDailyObjectiveProgress(r, date, id, afterSeq) >= def.target) points += def.points;
  }
  return points;
}

function newDay(date: string, _s: JourneyStore, r: RunState | null): DailyState {
  const salt = dailySaltFor(r);
  const baseIds = generateDaily(date, salt, r);
  const committed = r?.dailyRerolls?.[date];
  const validReroll = committed
    && baseIds.includes(committed.from)
    && resolveRerollReplacement(date, salt, baseIds, committed.from, r)?.id === committed.to
    ? committed
    : null;
  const ids = validReroll ? baseIds.map(id => (id === validReroll.from ? validReroll.to : id)) : baseIds;
  return {
    date,
    runId: r?.id,
    objectives: ids.map(id => ({ id, progress: 0, done: false, seen: [] })),
    points: 0,
    milestones: [],
    rerolled: !!validReroll,
    ...(validReroll ? { rerolledFrom: validReroll.from } : {}),
  };
}

/** Swap one untouched objective for another eligible one (once per day). */
export function rerollDaily(s: JourneyStore, objId: string, r: RunState | null): JourneyStore {
  const d = s.daily; if (!d || d.rerolled) return s;
  const o = d.objectives.find(x => x.id === objId); if (!o || o.progress > 0 || o.done) return s;
  const taken = d.objectives.map(x => x.id);
  const next = resolveRerollReplacement(d.date, dailySaltFor(r), taken, objId, r);
  if (!next) return s;
  const tracked = s.tracked?.type === 'daily' && s.tracked.id === objId ? { type: 'daily' as const, id: next.id } : s.tracked;
  return { ...s, tracked, daily: { ...d, rerolled: true, rerolledFrom: objId, objectives: d.objectives.map(x => x.id === objId ? { id: next.id, progress: 0, done: false, seen: [] } : x) } };
}

export const lessonState = (s: JourneyStore, id: string): LessonState => s.lessons[id] ?? { status: 'unseen', steps: {}, done: [] };
export function currentStep(s: JourneyStore, lesson: FieldLesson) {
  const ls = lessonState(s, lesson.id);
  return lesson.steps.find(st => !ls.done.includes(st.id)) ?? null;
}
export const lessonComplete = (s: JourneyStore, l: FieldLesson) => l.steps.every(st => lessonState(s, l.id).done.includes(st.id));

// ---------------------------------------------------------------------------
// INGEST — the only place journey progress moves.
// ---------------------------------------------------------------------------
export interface IngestResult { store: JourneyStore; events: JourneyEvent[]; changed: boolean }

export function ingestJourney(prev: JourneyStore, gs: GameState, now: number): IngestResult {
  const r = gs.run; if (!r) return { store: prev, events: [], changed: false };
  let s = prev; let changed = false; const events: JourneyEvent[] = [];
  const mut = () => { if (!changed) { s = { ...s, lessons: { ...s.lessons }, cursors: { ...s.cursors }, poiSeen: { ...s.poiSeen }, coreSeen: { ...s.coreSeen }, claimed: [...s.claimed], chronicle: [...s.chronicle], history: [...s.history], pendingRewards: [...s.pendingRewards] }; changed = true; } };
  const today = dateKey(now);

  // Day roll-over or run switch on the same day. A clock moved backwards freezes daily progress rather than regenerating.
  if (!s.daily || today > s.daily.date || (today === s.daily.date && s.daily.runId !== r.id)) {
    mut();
    if (s.daily && today > s.daily.date) {
      s.history = [{ date: s.daily.date, points: s.daily.points, milestones: s.daily.milestones, completed: s.daily.objectives.filter(o => o.done).length }, ...s.history].slice(0, 14);
    }
    s.daily = newDay(today, s, r);
    if (s.tracked?.type === 'daily') s.tracked = null;
  }
  const dailyLive = s.daily!.date === today;
  if (dailyLive && !s.daily!.rerolled && r.dailyRerolls?.[today]) {
    const swapped = rerollDaily(s, r.dailyRerolls[today].from, r);
    if (swapped !== s) {
      mut();
      s.daily = swapped.daily;
      s.tracked = swapped.tracked;
    }
  }

  // First sight of a run: fresh runs replay from the start; resumed runs begin at
  // the current receipt (no retroactive daily credit), but Fieldcraft may learn
  // from receipts still in the run log — those really happened.
  let firstSight = false;
  if (s.cursors[r.id] === undefined) {
    mut(); firstSight = true;
    const fresh = r.receipts.some(rc => rc.kind === 'run.start');
    s.cursors[r.id] = fresh ? 0 : (r.receipts.at(-1)?.seq ?? 0);
    s.poiSeen[r.id] = fresh ? [] : [...r.poiSeen];
    // Cores already in custody at first sight (presets, loaded saves) are never discoveries.
    s.coreSeen[r.id] = Object.values(r.custody).flatMap(c => c.slots).filter(x => x && ITEMS[x.key]?.creatorCore).map(x => x!.uid);
    if (!fresh) for (const rc of r.receipts) applyFieldcraft(rc as Receipt, true, true);
  }

  const cursor = s.cursors[r.id];
  const batch: Receipt[] = (r.receipts as Receipt[]).filter(rc => rc.seq > cursor);
  // observed state growth → synthetic, stable receipts
  const knownPoi = new Set(s.poiSeen[r.id] ?? []);
  for (const id of r.poiSeen) if (!knownPoi.has(id)) batch.push({ id: `poi:${id}`, seq: -1, at: now, kind: OBS_POI, detail: id });
  const knownCore = new Set(s.coreSeen[r.id] ?? []);
  const inv = r.custody['inv']?.slots ?? [];
  for (const st of inv) if (st && ITEMS[st.key]?.creatorCore && !knownCore.has(st.uid)) batch.push({ id: `core:${st.uid}`, seq: -1, at: now, kind: OBS_CORE, detail: `${st.key}:${st.uid}` });
  if (!batch.length) return { store: s, events, changed };
  mut();

  for (const rc of batch) {
    const away = now - rc.at > 5000;
    if (rc.kind === OBS_POI) s.poiSeen[r.id] = [...(s.poiSeen[r.id] ?? []), rc.detail];
    if (rc.kind === OBS_CORE) s.coreSeen[r.id] = [...(s.coreSeen[r.id] ?? []), rc.detail.split(':')[1]];
    applyFieldcraft(rc, away, false);
    if (dailyLive && dateKey(rc.at) === today) applyDaily(rc, away);
    chronicleFrom(rc, away);
  }
  const maxSeq = batch.reduce((m, rc) => Math.max(m, rc.seq), cursor);
  s.cursors[r.id] = maxSeq;
  void firstSight;
  return { store: s, events, changed };

  function chron(e: ChronicleEntry) {
    if (s.chronicle.some(c => c.id === e.id)) return false;
    s.chronicle = [e, ...s.chronicle].slice(0, 160); return true;
  }

  function applyFieldcraft(rc: Receipt, away: boolean, silent: boolean) {
    for (const lesson of FIELDCRAFT) {
      const ls0 = lessonState(s, lesson.id);
      if (ls0.status === 'dismissed' && !silent) { /* dismissed lessons still learn quietly */ }
      const step = lesson.steps.find(st => !ls0.done.includes(st.id));
      if (!step) continue;
      if (away && !step.offlineOk) continue;
      const inc = step.count(rc); if (!inc) continue;
      const ls: LessonState = { ...ls0, steps: { ...ls0.steps }, done: [...ls0.done] };
      ls.steps[step.id] = Math.min(step.target, (ls.steps[step.id] ?? 0) + inc);
      const cid = `fc:${lesson.id}:${step.id}`;
      if (ls.steps[step.id] >= step.target && !s.claimed.includes(cid)) {
        s.claimed.push(cid); ls.done.push(step.id);
        const complete = lesson.steps.every(st => ls.done.includes(st.id));
        if (complete) ls.completedAt = rc.at;
        if (!silent) {
          const quiet = ls0.status === 'dismissed';
          events.push({ id: cid, level: 2, kind: 'step', title: step.title, detail: complete ? `${lesson.title} mastered` : lesson.title, icon: step.icon, away, ref: { type: 'lesson', id: lesson.id } });
          if (complete) chron({ id: `lesson:${lesson.id}`, at: rc.at, level: 2, title: `${lesson.title} mastered`, detail: lesson.motto, icon: lesson.icon, runId: r!.id, kind: 'lesson', away, seen: quiet });
        } else if (complete) chron({ id: `lesson:${lesson.id}`, at: rc.at, level: 2, title: `${lesson.title} mastered`, detail: 'Recognised from your run log', icon: lesson.icon, runId: r!.id, kind: 'lesson', seen: true });
      } else if (!silent) {
        events.push({ id: `${cid}:p${ls.steps[step.id]}`, level: 1, kind: 'progress', title: step.title, detail: `${ls.steps[step.id]}/${step.target}`, icon: step.icon, ref: { type: 'lesson', id: lesson.id } });
      }
      s.lessons[lesson.id] = ls;
    }
  }

  function applyDaily(rc: Receipt, away: boolean) {
    const d = s.daily!;
    const committedReroll = r!.dailyRerolls?.[d.date];
    let dd = d;
    for (const o of d.objectives) {
      if (o.done) continue;
      if (committedReroll && o.id === committedReroll.to && rc.seq <= committedReroll.seq) continue;
      const def = DAILY_BY_ID[o.id]; if (!def) continue;
      if (away && !def.offlineOk) continue;
      const seen = new Set(o.seen);
      const inc = def.count(rc, seen); if (!inc) continue;
      const progress = Math.min(def.target, o.progress + inc);
      const cid = `daily:${d.date}:${o.id}`;
      const done = progress >= def.target && !s.claimed.includes(cid);
      if (done) s.claimed.push(cid);
      dd = { ...dd, objectives: dd.objectives.map(x => x.id === o.id ? { ...x, progress, done: x.done || done, doneAt: done ? rc.at : x.doneAt, seen: [...seen].slice(0, 40) } : x) };
      if (done) {
        dd = { ...dd, points: dd.points + def.points };
        events.push({ id: cid, level: 2, kind: 'daily', title: def.title, detail: `+${def.points} pts`, icon: def.icon, away, ref: { type: 'daily', id: o.id } });
        for (const m of DAILY_MILESTONES) {
          const mid = `milestone:${d.date}:${m.id}`;
          if (dd.points >= m.at && !s.claimed.includes(mid)) {
            s.claimed.push(mid); dd = { ...dd, milestones: [...dd.milestones, m.id] };
            s.marks += m.marks;
            if (m.pending) s.pendingRewards = [{ id: mid, date: d.date, milestone: m.name, requirement: m.pending }, ...s.pendingRewards].slice(0, 30);
            const sp = milestoneRewardSpec(m.id);
            events.push({ id: mid, level: 3, kind: 'milestone', title: `${m.name} reached`, detail: `${dd.points} pts · +${m.marks} Mark${sp ? ` · +${sp.securedCash} Secured` : ''}`, icon: m.id === 'beacon' ? 'crystal' : m.id === 'hearth' ? 'st:campfire' : 'coal', away });
            chron({ id: mid, at: rc.at, level: 3, title: `Daily ${m.name}`, detail: `${dd.points} waypoint points on ${d.date}${sp ? ` · ${milestoneRewardLabel(m.id)}` : ''}`, icon: 'coal', runId: r!.id, kind: 'daily', away });
          }
        }
      } else {
        events.push({ id: `${cid}:p${progress}`, level: 1, kind: 'progress', title: def.title, detail: `${progress}/${def.target}`, icon: def.icon, ref: { type: 'daily', id: o.id } });
      }
    }
    s.daily = dd;
  }

  function chronicleFrom(rc: Receipt, away: boolean) {
    if (rc.kind === 'achievement') {
      const a = ACHIEVEMENTS[rc.detail]; const m = ACH_META[rc.detail]; if (!a || !m) return;
      chron({ id: `ach:${r!.id}:${rc.detail}`, at: rc.at, level: m.level, title: a.name, detail: m.tale, icon: m.icon, runId: r!.id, kind: 'achievement', away });
    } else if (rc.kind === 'elder.defeat') {
      const e = lookupElderDef(rc.detail);
      chron({ id: `elder:${r!.id}:${rc.id}`, at: rc.at, level: 5, title: `${e?.name ?? 'Elder'} defeated`, detail: e ? `${ITEMS[e.stone]?.name ?? 'Stone'} recovered from the dust` : '', icon: e?.stone, runId: r!.id, kind: 'elder', away });
    } else if (rc.kind === OBS_POI) {
      const veyraPoi = POIS.find(p => p.id === rc.detail);
      chron({ id: `poi:${r!.id}:${rc.detail}`, at: rc.at, level: 1, title: 'Place discovered', detail: veyraPoi ? veyraPoi.name : rc.detail.replace(/[_-]/g, ' '), icon: 'spares', runId: r!.id, kind: 'discovery', seen: true });
    } else if (rc.kind === OBS_CORE) {
      const key = rc.detail.split(':')[0];
      chron({ id: `core:${rc.detail.split(':')[1]}`, at: rc.at, level: 4, title: `${ITEMS[key]?.name ?? 'Creator Core'} recovered`, detail: 'All three reserves remain physical.', icon: key, runId: r!.id, kind: 'relic', away });
    } else if (rc.kind === 'learn.blueprint') {
      chron({ id: `learn:${r!.id}:${rc.detail}`, at: rc.at, level: 3, title: 'Recipe learned', detail: rc.detail.replace(/_/g, ' '), icon: 'blueprint', runId: r!.id, kind: 'capability', away, seen: true });
    } else if (['station.upgrade', 'furnace.upgrade', 'power.upgrade', 'industrial.install', 'cart.upgrade'].includes(rc.kind)) {
      chron({ id: `upg:${r!.id}:${rc.id}`, at: rc.at, level: 3, title: rc.kind === 'furnace.upgrade' ? 'Furnace lined' : rc.kind === 'power.upgrade' ? 'Generator reinforced' : rc.kind === 'cart.upgrade' ? 'Cart reinforced' : rc.kind === 'industrial.install' ? 'Power module fitted' : `Workbench level ${rc.detail.split(':')[1] ?? ''}`, detail: 'New capability unlocked', icon: rc.kind === 'furnace.upgrade' ? 'st:furnace' : 'st:workbench', runId: r!.id, kind: 'capability', away, seen: true });
    } else if (rc.kind === 'build' && ['furnace', 'workbench', 'research', 'claim', 'campfire', 'recycler', 'refinery'].includes(buildType(rc))) {
      const t = buildType(rc);
      chron({ id: `firstbuild:${r!.id}:${t}`, at: rc.at, level: 3, title: `First ${STRUCTS[t]?.name ?? t}`, detail: 'A new station stands in your territory', icon: `st:${t}`, runId: r!.id, kind: 'capability', away, seen: true });
    }
  }
}

/** Ragnarok / evacuation are not receipts with achievements in every path; record the phase change itself. */
export function recordWorldMoment(s: JourneyStore, runId: string, id: string, title: string, detail: string, at: number): JourneyStore {
  const cid = `world:${runId}:${id}`;
  if (s.chronicle.some(c => c.id === cid)) return s;
  const entry: ChronicleEntry = { id: cid, at, level: 5, title, detail, runId, kind: 'world', icon: 'coal' };
  return { ...s, chronicle: [entry, ...s.chronicle].slice(0, 160) };
}

export function markChronicleSeen(s: JourneyStore): JourneyStore {
  if (!s.chronicle.some(c => !c.seen)) return s;
  return { ...s, chronicle: s.chronicle.map(c => c.seen ? c : { ...c, seen: true }) };
}

// ---------------------------------------------------------------------------
// TRACKING — resolve what the Waymark should show (explicit choice first).
// ---------------------------------------------------------------------------
export interface TrackView {
  ref: Exclude<TrackRef, null>; suggested: boolean;
  title: string; group: string; icon: string; how: string; why: string;
  progress: number; target: number; done: boolean;
  pips: { done: boolean; current: boolean }[];
  anchor?: AnchorHint; focus?: FieldStep['focus']; points?: number;
}
export function resolveTrack(s: JourneyStore, hrs: number): TrackView | null {
  const t = s.tracked;
  if (t?.type === 'lesson') {
    const l = FIELDCRAFT.find(x => x.id === t.id); if (!l) return null;
    const step = currentStep(s, l); const ls = lessonState(s, l.id);
    if (!step) return { ref: t, suggested: false, title: `${l.title} mastered`, group: 'Fieldcraft', icon: l.icon, how: 'Choose another path in the Journey ledger [J].', why: l.motto, progress: 1, target: 1, done: true, pips: l.steps.map(() => ({ done: true, current: false })) };
    return { ref: t, suggested: false, title: step.title, group: l.title, icon: step.icon, how: step.how, why: step.why, progress: ls.steps[step.id] ?? 0, target: step.target, done: false, anchor: step.anchor, focus: step.focus,
      pips: l.steps.map(st => ({ done: ls.done.includes(st.id), current: st.id === step.id })) };
  }
  if (t?.type === 'daily' && s.daily) {
    const o = s.daily.objectives.find(x => x.id === t.id); const d = DAILY_BY_ID[t.id]; if (!o || !d) return null;
    const focus: FieldStep['focus'] = d.cat === 'craft' ? ['craft'] : d.cat === 'build' ? ['build'] : d.cat === 'explore' ? ['explore'] : undefined;
    return { ref: t, suggested: false, title: d.title, group: `Waypoint · ${CAT_LABEL[d.cat]}`, icon: d.icon, how: d.how, why: `${d.points} points toward today's milestones.`, progress: o.progress, target: d.target, done: o.done, anchor: d.anchor, focus, points: d.points,
      pips: s.daily.objectives.map(x => ({ done: x.done, current: x.id === t.id })) };
  }
  // Suggestion: only for genuinely new survivors, only Landfall, never after an explicit untrack.
  if (!t && !s.trackQuiet && hrs < 6) {
    const l = FIELDCRAFT[0]; const ls = lessonState(s, l.id);
    if (ls.status !== 'dismissed' && !lessonComplete(s, l)) {
      const v = resolveTrack({ ...s, tracked: { type: 'lesson', id: l.id } }, hrs);
      return v ? { ...v, suggested: true } : null;
    }
  }
  return null;
}

/** Count consecutive active days with at least one completed Waypoint or Milestone (purely celebratory, never punitive). */
export function streakDays(s: JourneyStore): number {
  const days = [
    ...(s.daily ? [{ date: s.daily.date, active: s.daily.points > 0 || s.daily.milestones.length > 0 }] : []),
    ...s.history.map(h => ({ date: h.date, active: h.points > 0 || h.milestones.length > 0 || h.completed > 0 })),
  ];
  let streak = 0;
  let prevMs: number | null = null;
  for (const row of days) {
    if (!row.active) {
      if (streak === 0 && prevMs === null) { prevMs = Date.parse(row.date + 'T00:00:00Z'); continue; }
      break;
    }
    const ms = Date.parse(row.date + 'T00:00:00Z');
    if (!Number.isFinite(ms)) break;
    if (prevMs !== null && Math.round((prevMs - ms) / 86400000) > 1) break;
    streak++;
    prevMs = ms;
  }
  return streak;
}

export type QuickJumpTarget = 'craft' | 'build' | 'map';
export function jumpTargetFor(focus?: FieldStep['focus']): { target: QuickJumpTarget; label: string } | null {
  if (!focus?.length) return null;
  if (focus.includes('craft')) return { target: 'craft', label: 'Craft [C]' };
  if (focus.includes('build')) return { target: 'build', label: 'Build [B]' };
  if (focus.includes('explore')) return { target: 'map', label: 'Chart [M]' };
  return null;
}
