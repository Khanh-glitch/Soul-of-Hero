// ============================================================================
// SOUL OF HEROES — UNIFIED JOURNEY, FIELDCRAFT & DAILY PACT ENGINE
// Pure TypeScript module. Reconciles ONLY against committed engine receipts,
// physical entities, custody stacks, knowledge, and discovered cells.
// Never invents currency/items or reveals undiscovered map coordinates.
// ============================================================================
import {
  BAL,
  TILE,
  WW,
  WH,
  VIEW_W,
  VIEW_H,
  type GameState,
  type JourneyChronicleEntry,
  type JourneyDailyState,
  type JourneyFieldcraftProgress,
  type JourneyProfileSnapshot,
  type JourneyRunSnapshot,
  type RunState,
} from './core';
import { ACHIEVEMENTS, ACHIEVEMENT_META, ITEMS, RECIPES, SOURCES, STRUCTS, isRecipeKnown } from './catalog';
import { C, carryLimit, countItem, homeStatus, invWeight, isRagnarok, runHours } from './engine';
import { craftReadiness } from './action-readiness';
import { deathBagView } from './death-view';
import { evaluateFieldNotes, readFieldNoteStore, type FieldNoteDef } from './field-notes';
import { discoveredCell } from './map-notes';
import { getWorld } from './world';

export type JourneyCategory = 'survival' | 'craft' | 'shelter' | 'combat' | 'expedition';
export type FieldcraftStatus = 'unseen' | 'seen' | 'in_progress' | 'completed' | 'dismissed';

export interface FieldcraftStepDef {
  id: string;
  label: string;
  hint: string;
  verifiedBy: (r: RunState, now: number) => boolean;
}

export interface FieldcraftPathDef {
  id: string;
  title: string;
  category: JourneyCategory;
  icon: string;
  priority: number;
  summary: string;
  meaning: string;
  steps: FieldcraftStepDef[];
}

export interface DailyObjectiveDef {
  id: string;
  slotGroup: 'forage' | 'homestead' | 'expedition';
  category: JourneyCategory;
  title: string;
  desc: string;
  icon: string;
  points: number;
  target: number;
  eligible?: (r: RunState, now: number) => boolean;
  /** Returns incremental receipt count contribution for a newly observed receipt. */
  receiptDelta: (rc: { id: string; kind: string; detail: string }, r: RunState) => number;
  blockerHint?: (r: RunState, now: number) => string | null;
  actionHint: string;
  suggestedAction?: { label: string; panel?: 'inv' | 'craft' | 'map' | 'notes'; buildTool?: string };
}

export interface DailyMilestoneDef {
  id: 'tier1' | 'tier2' | 'tier3';
  points: number;
  title: string;
  sealName: string;
  icon: string;
  authenticReward: string;
  preservedAuthority?: { label: string; authorityRequired: string };
}

export interface JourneyTransitionEvent {
  id: string;
  level: 2 | 3 | 4 | 5;
  kind: 'fieldcraft_step' | 'fieldcraft_complete' | 'daily_complete' | 'daily_milestone' | 'core_discovered' | 'landmark_discovered';
  title: string;
  detail: string;
  icon?: string;
  accent?: string;
  meaning?: string;
  worldX?: number;
  worldY?: number;
}

export interface WayfinderWorldHint {
  x: number;
  y: number;
  tx: number;
  ty: number;
  label: string;
  distanceTiles: number;
  bearing: string;
  onScreen: boolean;
}

export interface WayfinderOption {
  id: string;
  kind: 'daily' | 'fieldcraft' | 'milestone';
  title: string;
  progressText: string;
  category: JourneyCategory;
  icon: string;
}

export interface WayfinderView {
  trackedId: string;
  hidden: boolean;
  kind: 'daily' | 'fieldcraft' | 'note' | 'milestone';
  kindLabel: string;
  category: JourneyCategory;
  icon: string;
  title: string;
  summary: string;
  current: number;
  target: number;
  pct: number;
  progressText: string;
  blocker: string | null;
  nextStep: string;
  meaning: string;
  action: { label: string; panel?: 'inv' | 'craft' | 'map' | 'notes'; recipe?: string; buildTool?: string } | null;
  worldHint: WayfinderWorldHint | null;
  completedJustNow: boolean;
  options: WayfinderOption[];
}

// ============================================================================
// FIELDCRAFT SURVIVAL PATHS — progress verified ONLY by real gameplay state
// ============================================================================
const hasReceipt = (r: RunState, pred: (kind: string, detail: string) => boolean) =>
  r.receipts.some(rc => pred(rc.kind, rc.detail));

const hasOwnedStruct = (r: RunState, types: string[]) =>
  Object.values(r.entities).some(e => e.kind === 'struct' && e.type && types.includes(e.type) && (e.owner === undefined || e.owner === 'player'));

export const FIELDCRAFT_PATHS: FieldcraftPathDef[] = [
  {
    id: 'first_landfall',
    title: 'Shorefall & Sustenance',
    category: 'survival',
    icon: 'berries',
    priority: 70,
    summary: 'Gather timber or wild forage, drink fresh water, and craft your first survival gear.',
    meaning: 'Island self-sufficiency established',
    steps: [
      {
        id: 'harvest_nature',
        label: 'Harvest from timber, stone, or forage',
        hint: 'Aim with cursor and swing [LMB] at a tree, rock, or berry bush.',
        verifiedBy: r => r.achievements.includes('first_harvest') || r.player.skills.gather > 0 || hasReceipt(r, k => k === 'harvest'),
      },
      {
        id: 'stay_hydrated',
        label: 'Drink fresh water or eat field provisions',
        hint: 'Press [E] beside a river/stream or use food/water flask on [1-8].',
        verifiedBy: r => hasReceipt(r, k => k === 'drink' || k === 'drink.flask' || k === 'consume' || k === 'barrel.drink'),
      },
      {
        id: 'craft_by_hand',
        label: 'Craft rope, torch, or stone tools',
        hint: 'Open Survivor Pack & Work [I / C] to craft Rope or a Stone Axe/Pickaxe.',
        verifiedBy: r => hasReceipt(r, k => k === 'craft.hand'),
      },
    ],
  },
  {
    id: 'ember_hearth',
    title: 'Hearth & Roofed Shelter',
    category: 'shelter',
    icon: 'st:campfire',
    priority: 76,
    summary: 'Build a Campfire for warmth & cooking, prepare food, and enclose a sheltered room.',
    meaning: 'Protected camp able to weather cold nights',
    steps: [
      {
        id: 'raise_campfire',
        label: 'Place a Campfire',
        hint: 'Press [I] → Stations (or Build) with 5 Wood + 3 Stone to place a Campfire.',
        verifiedBy: r => hasOwnedStruct(r, ['campfire']) || hasReceipt(r, (k, d) => k === 'build' && d.startsWith('campfire@')),
      },
      {
        id: 'tend_fire_job',
        label: 'Fuel & finish a Campfire cook or charcoal batch',
        hint: 'Interact [E] with Campfire, place Wood fuel, and queue Roast Meat or Charcoal.',
        verifiedBy: r => hasReceipt(r, (k, d) => k === 'job.done' && ['cooked_meat', 'herb_roast', 'salted_meat', 'charcoal', 'root_broth', 'stew'].some(rc => d.endsWith(':' + rc))),
      },
      {
        id: 'build_shelter',
        label: 'Complete an enclosed shelter with bed & roof',
        hint: 'Press [B] to build Floors, Walls, Door, Thatch Roof, and a Straw Bed inside.',
        verifiedBy: r => !!r.player.sheltered || r.achievements.includes('first_home'),
      },
    ],
  },
  {
    id: 'iron_craftworks',
    title: 'Ironworking & Research',
    category: 'craft',
    icon: 'iron_ingot',
    priority: 68,
    summary: 'Build a Furnace & Workbench, smelt iron ingots, and unlock new blueprints or upgrades.',
    meaning: 'Industrial iron tools & station upgrades opened',
    steps: [
      {
        id: 'build_workshop',
        label: 'Place a Furnace and Workbench',
        hint: 'Gather stone & wood, then craft & place a Furnace and Workbench via [I].',
        verifiedBy: r => hasOwnedStruct(r, ['furnace']) && hasOwnedStruct(r, ['workbench']),
      },
      {
        id: 'smelt_ingot',
        label: 'Smelt your first Iron Ingot',
        hint: 'Fuel a Furnace with Coal/Wood/Charcoal and smelt Iron Ore or Scrap Metal.',
        verifiedBy: r => r.achievements.includes('first_ingot') || hasReceipt(r, (k, d) => k === 'job.done' && (d.endsWith(':iron_ingot') || d.endsWith(':scrap_ingot'))),
      },
      {
        id: 'advance_knowledge',
        label: 'Learn a blueprint, study a specimen, or upgrade a station',
        hint: 'Use a Research Table [E] with Spares/Specimens or upgrade your Workbench.',
        verifiedBy: r => r.achievements.includes('first_research') || hasReceipt(r, k => k === 'learn.blueprint' || k === 'research.specimen' || k === 'station.upgrade' || k === 'furnace.upgrade'),
      },
    ],
  },
  {
    id: 'territory_bastion',
    title: 'Territory Claim & Upkeep',
    category: 'shelter',
    icon: 'st:claim',
    priority: 60,
    summary: 'Claim your compound with a Territory Cabinet and stock upkeep materials against decay.',
    meaning: 'Structures protected from passive decay',
    steps: [
      {
        id: 'place_cabinet',
        label: 'Place a Territory Cabinet on a floor',
        hint: 'Build a Floor, then place a Territory Cabinet ([B] slot 5) for 25-tile coverage.',
        verifiedBy: r => hasOwnedStruct(r, ['claim']),
      },
      {
        id: 'fund_cabinet',
        label: 'Fund Cabinet upkeep with wood, stone, or fiber',
        hint: 'Press [E] on your Cabinet and deposit upkeep materials so structures stay protected.',
        verifiedBy: r => homeStatus(r).cabinets.some(c => c.funded && c.state !== 'idle'),
      },
      {
        id: 'fortify_upgrade',
        label: 'Upgrade a structure or wire base defenses',
        hint: 'Press [U] in Build mode on wood walls/doors, or link a Generator/Trap.',
        verifiedBy: r => hasReceipt(r, k => k === 'structure.upgrade' || k === 'power.toggle' || k === 'trap.arm'),
      },
    ],
  },
  {
    id: 'arcana_expedition',
    title: 'Island Arcana & Crown',
    category: 'expedition',
    icon: 'core_dragon',
    priority: 64,
    summary: 'Chart distant landmarks, channel a Creator Core, and prepare for Ragnarok evacuation.',
    meaning: 'Ready to contest Elders and survive Ragnarok',
    steps: [
      {
        id: 'survey_landmark',
        label: 'Chart new sectors and discover a Point of Interest',
        hint: 'Explore beyond your landing shore and press [M] to inspect the Field Chart.',
        verifiedBy: r => r.poiSeen.length > 0 || r.discovered.filter(Boolean).length >= 260,
      },
      {
        id: 'channel_core',
        label: 'Wield or reload a Creator Core',
        hint: 'Equip a Core on [1-8], hold [Q] or [E] to cast, or press [R] to load energy.',
        verifiedBy: r => r.achievements.includes('first_core') || hasReceipt(r, k => k === 'core.commit' || k === 'core.load'),
      },
      {
        id: 'claim_endgame',
        label: 'Defeat an Elder, breach a Vault, or secure Ragnarok Cash',
        hint: 'Open sealed vaults during Ragnarok or confront an Elder Guardian.',
        verifiedBy: r => r.elderStones.length > 0 || r.deposited > 0 || r.achievements.includes('vault') || r.achievements.includes('elder_1'),
      },
    ],
  },
];

// ============================================================================
// DAILY OBJECTIVES ("DAILY PACT") — Anti-exploit receipt-backed daily activities
// ============================================================================
export const DAILY_OBJECTIVES: DailyObjectiveDef[] = [
  // Slot A: Land & Forage (25 DP)
  {
    id: 'daily_harvester',
    slotGroup: 'forage',
    category: 'survival',
    title: 'Timber & Stone Survey',
    desc: 'Harvest 6 natural resource yields from trees, stone, or coastal nodes.',
    icon: 'wood',
    points: 25,
    target: 6,
    receiptDelta: rc => {
      if (rc.kind !== 'harvest') return 0;
      const m = rc.detail.match(/-(\d+)$/);
      return m ? Math.max(1, Number(m[1])) : 1;
    },
    blockerHint: r => {
      const hasTool = C(r, 'inv').slots.some(s => s && ITEMS[s.key]?.power);
      return hasTool ? null : 'Craft or equip a Knife, Axe, or Pickaxe to harvest efficiently';
    },
    actionHint: 'Swing [LMB] at living trees, boulders, or bushes.',
  },
  {
    id: 'daily_forager',
    slotGroup: 'forage',
    category: 'survival',
    title: 'Island Forager',
    desc: 'Gather 4 wild berries, herbs, mushrooms, or harvest planted crops.',
    icon: 'berries',
    points: 25,
    target: 4,
    receiptDelta: rc => {
      if (rc.kind === 'garden.harvest' || rc.kind === 'tender.harvest') return 2;
      if (rc.kind === 'harvest' && /^(bush|herb|mushroom|cactus)@/.test(rc.detail)) {
        const m = rc.detail.match(/-(\d+)$/);
        return m ? Math.max(1, Number(m[1])) : 1;
      }
      return 0;
    },
    actionHint: 'Forage berry bushes/herbs [LMB] or harvest a watered Garden Plot.',
  },
  {
    id: 'daily_provisioner',
    slotGroup: 'forage',
    category: 'survival',
    title: 'Field Rations & Hydration',
    desc: 'Consume 3 cooked meals/berries or drink from fresh water & flasks.',
    icon: 'water_flask',
    points: 25,
    target: 3,
    receiptDelta: rc => (['consume', 'drink', 'drink.flask', 'barrel.drink'].includes(rc.kind) ? 1 : 0),
    actionHint: 'Press [E] by fresh river water or consume rations on [1-8].',
    suggestedAction: { label: 'Open Pack', panel: 'inv' },
  },
  {
    id: 'daily_prospector',
    slotGroup: 'forage',
    category: 'craft',
    title: 'Scrap & Ore Vein',
    desc: 'Extract 4 mineral, stone, salt, or wreck salvage yields.',
    icon: 'iron_ore',
    points: 25,
    target: 4,
    eligible: r => C(r, 'inv').slots.some(s => s && (ITEMS[s.key]?.power?.stone ?? 0) >= 2) || r.player.skills.gather >= 4,
    receiptDelta: rc => {
      if (rc.kind !== 'harvest') return 0;
      if (/^(rock|iron_vein|coal_vein|crystal_node|sulfur_node|wreck|salt_shale)@/.test(rc.detail)) {
        const m = rc.detail.match(/-(\d+)$/);
        return m ? Math.max(1, Number(m[1])) : 1;
      }
      return 0;
    },
    blockerHint: r => {
      const hasPick = C(r, 'inv').slots.some(s => s && (ITEMS[s.key]?.power?.stone ?? 0) >= 2);
      return hasPick ? null : 'Requires a Stone Pickaxe or better to mine ore & wrecks';
    },
    actionHint: 'Use a Pickaxe [LMB] on boulders, iron veins, or scrap wrecks.',
    suggestedAction: { label: 'Craft Pick', panel: 'craft' },
  },

  // Slot B: Craft & Homestead (30 DP)
  {
    id: 'daily_crafter',
    slotGroup: 'homestead',
    category: 'craft',
    title: 'Hands of Craft',
    desc: 'Complete 3 hand-crafted or workstation items.',
    icon: 'stone_axe',
    points: 30,
    target: 3,
    receiptDelta: rc => (rc.kind === 'craft.hand' || (rc.kind === 'job.done' && !rc.detail.includes(':R:')) ? 1 : 0),
    blockerHint: r => {
      const inv = C(r, 'inv').slots;
      return inv.some(Boolean) && inv.filter(Boolean).length >= inv.length ? 'Pack is full — free 1 slot before crafting by hand' : null;
    },
    actionHint: 'Open Survivor Work [I / C] or queue jobs at a Workbench/Campfire.',
    suggestedAction: { label: 'Open Work', panel: 'craft' },
  },
  {
    id: 'daily_smelter',
    slotGroup: 'homestead',
    category: 'craft',
    title: 'Stoked Hearth & Furnace',
    desc: 'Finish 2 station batches (cooking, smelting, refining, or recycling).',
    icon: 'st:furnace',
    points: 30,
    target: 2,
    eligible: r => hasOwnedStruct(r, ['campfire', 'furnace', 'workbench', 'refinery']),
    receiptDelta: rc => (rc.kind === 'job.done' && !rc.detail.includes(':R:') ? 1 : rc.kind === 'recycle.finish' || rc.kind === 'pump.extract' ? 1 : 0),
    blockerHint: r => {
      const stations = Object.values(r.entities).filter(e => e.station && e.type !== 'workbench' && e.type !== 'research' && (e.owner === undefined || e.owner === 'player'));
      if (!stations.length) return 'Build a Campfire or Furnace first to run timed batches';
      const stalledFuel = stations.find(e => e.station!.queue.length > 0 && e.station!.burn <= 0 && !C(r, e.station!.fuelC).slots.some(Boolean));
      if (stalledFuel) return `${STRUCTS[stalledFuel.type!]?.name || 'Station'} is paused — add burnable fuel`;
      return null;
    },
    actionHint: 'Fuel your Campfire or Furnace [E] and let queued batches complete.',
  },
  {
    id: 'daily_fortifier',
    slotGroup: 'homestead',
    category: 'shelter',
    title: 'Camp Engineer',
    desc: 'Build, repair, or upgrade 3 camp structures or fortifications.',
    icon: 'st:wall_wood',
    points: 30,
    target: 3,
    receiptDelta: rc => (['build', 'structure.upgrade', 'structure.repair', 'structure.repair.plate', 'territory.repair.batch', 'station.upgrade', 'furnace.upgrade'].includes(rc.kind) ? 1 : 0),
    actionHint: 'Press [B] to place structures, [V] to repair, or [U] to upgrade.',
    suggestedAction: { label: 'Build [B]', buildTool: 'wall_wood' },
  },
  {
    id: 'daily_scholar',
    slotGroup: 'homestead',
    category: 'craft',
    title: 'Blueprints & Upkeep',
    desc: 'Learn a blueprint, study a specimen, repair equipment, or service a vehicle.',
    icon: 'blueprint',
    points: 30,
    target: 2,
    eligible: r => hasOwnedStruct(r, ['research', 'workbench', 'claim']) || Object.values(r.entities).some(e => e.kind === 'vehicle'),
    receiptDelta: rc => (['learn.blueprint', 'research.specimen', 'research.directed', 'research.random', 'item.repair', 'item.fieldRepair', 'vehicle.refuel', 'vehicle.repair', 'territory.repair.batch', 'station.upgrade'].includes(rc.kind) ? 1 : 0),
    actionHint: 'Use a Research Table [E], repair worn tools, or reinforce your Workbench.',
  },

  // Slot C: Wilds, Relics & Vigilance (45 DP)
  {
    id: 'daily_cartographer',
    slotGroup: 'expedition',
    category: 'expedition',
    title: 'Horizon Surveyor',
    desc: 'Explore 12 new map sectors or discover a new Point of Interest.',
    icon: 'compass',
    points: 45,
    target: 12,
    receiptDelta: () => 0, // driven authentically by real newly discovered 4x4 fog cells + poiSeen delta!
    actionHint: 'Explore uncharted terrain and inspect Field Chart [M].',
    suggestedAction: { label: 'Open Map', panel: 'map' },
  },
  {
    id: 'daily_sentinel',
    slotGroup: 'expedition',
    category: 'combat',
    title: 'Island Sentinel',
    desc: 'Defeat 2 hostile island creatures or an Elder Guardian.',
    icon: 'iron_sword',
    points: 45,
    target: 2,
    receiptDelta: rc => (rc.kind === 'creature.defeat' || rc.kind === 'elder.defeat' ? 1 : 0),
    blockerHint: r => {
      const armed = C(r, 'inv').slots.some(s => s && ((ITEMS[s.key]?.dmg ?? 0) >= 10 || ITEMS[s.key]?.creatorCore));
      return armed ? null : 'Craft a Spear, Bow, or Sword before hunting dangerous beasts';
    },
    actionHint: 'Watch creature patterns and strike [LMB] or dodge-roll [Space].',
  },
  {
    id: 'daily_core_conduit',
    slotGroup: 'expedition',
    category: 'combat',
    title: 'Arcane Core Conduit',
    desc: 'Commit 3 Creator Core attacks/skills or reload Core reserves.',
    icon: 'core_meteor',
    points: 45,
    target: 3,
    eligible: r => C(r, 'inv').slots.some(s => s && !!ITEMS[s.key]?.creatorCore),
    receiptDelta: rc => (rc.kind === 'core.commit' || rc.kind === 'core.load' ? 1 : 0),
    actionHint: 'Select a Creator Core on [1-8]; cast [LMB/Q/E] or reload with [R].',
  },
  {
    id: 'daily_endgame_push',
    slotGroup: 'expedition',
    category: 'expedition',
    title: 'Ragnarok Reckoning',
    desc: 'Open an Airdrop, breach a Vault, secure Ragnarok coins, or engage an Elder.',
    icon: 'rcash',
    points: 45,
    target: 1,
    eligible: (r, now) => isRagnarok(r, now) || r.poiSeen.length >= 1 || Object.values(r.entities).some(e => e.kind === 'airdrop'),
    receiptDelta: rc => (['airdrop.open', 'poi.door.open', 'poi.card.scan', 'escrow.deposit', 'elder.engage', 'elder.defeat', 'cash.mint'].includes(rc.kind) ? 1 : 0),
    actionHint: 'Head to a public Airdrop, sealed POI vault, or Elder territory on Map [M].',
    suggestedAction: { label: 'Open Map', panel: 'map' },
  },
];

export const DAILY_MILESTONES: DailyMilestoneDef[] = [
  {
    id: 'tier1',
    points: 25,
    title: 'Ember Ration Seal',
    sealName: 'Wayfarer Tier I',
    icon: 'torch',
    authenticReward: 'Daily Pact Tier I Chronicle Seal + Ember Momentum recorded on profile.',
  },
  {
    id: 'tier2',
    points: 55,
    title: 'Forgewright Seal',
    sealName: 'Wayfarer Tier II',
    icon: 'spares',
    authenticReward: 'Daily Pact Tier II Seal recorded; Supply Parcel Stipend preserved.',
    preservedAuthority: {
      label: 'Supply Parcel Voucher (2× Spares · 1× Medkit)',
      authorityRequired: 'Requires authoritative `engine.ts` `grantDailyMilestoneReward` custody intent before minting run items.',
    },
  },
  {
    id: 'tier3',
    points: 100,
    title: 'Island Sovereign Crest',
    sealName: 'Wayfarer Tier III',
    icon: 'rcash',
    authenticReward: 'Full Daily Pact completed (+1 Daily Streak) & Sovereign Crest etched in Chronicle.',
    preservedAuthority: {
      label: '10 Secured Ragnarok Cash Stipend',
      authorityRequired: 'Requires authoritative `engine.ts` profile-custody grant + verification (never forged client-side).',
    },
  },
];

// ============================================================================
// ISOLATED STORAGE / PROFILE & QA MEMORY
// ============================================================================
const qaProfileMem = new WeakMap<RunState, JourneyProfileSnapshot>();
const qaRunMem = new WeakMap<RunState, JourneyRunSnapshot>();
const qaDiscoveryWatermark = new WeakMap<RunState, { cells: number; pois: number }>();
const prodDiscoveryWatermark = new WeakMap<RunState, { cells: number; pois: number }>();

export function localDayKey(now: number): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - 1);
  return localDayKey(dt.getTime());
}

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function defaultProfileJourney(): JourneyProfileSnapshot {
  return {
    version: 1,
    dailyHistory: [],
    streak: 0,
    bestStreak: 0,
    totalDailyPoints: 0,
    fieldcraftMastered: [],
    discoveredCores: [],
    chronicle: [],
  };
}

function defaultRunJourney(r: RunState): JourneyRunSnapshot {
  return {
    version: 1,
    lastSeq: 0,
    seenReceipts: [],
    fieldcraft: {},
    trackedId: 'auto',
    trackerExpanded: false,
    discoveredCoreUids: C(r, 'inv').slots.filter(s => s && ITEMS[s.key]?.creatorCore).map(s => s!.uid),
    timeline: [],
  };
}

export function getJourneyProfile(gs: GameState, qaMode: boolean): JourneyProfileSnapshot {
  if (qaMode && gs.run) {
    let mem = qaProfileMem.get(gs.run);
    if (!mem) {
      mem = defaultProfileJourney();
      qaProfileMem.set(gs.run, mem);
    }
    return mem;
  }
  if (!gs.profile.journey) gs.profile.journey = defaultProfileJourney();
  return gs.profile.journey;
}

export function getJourneyRun(r: RunState, qaMode: boolean): JourneyRunSnapshot {
  if (qaMode) {
    let mem = qaRunMem.get(r);
    if (!mem) {
      mem = defaultRunJourney(r);
      qaRunMem.set(r, mem);
    }
    return mem;
  }
  if (!r.journey) r.journey = defaultRunJourney(r);
  return r.journey;
}

function pickFromGroup(group: DailyObjectiveDef[], r: RunState, now: number, seed: number, excludeIds: string[] = []): DailyObjectiveDef {
  const pool = group.filter(o => !excludeIds.includes(o.id) && (!o.eligible || o.eligible(r, now)));
  const candidates = pool.length ? pool : group.filter(o => !excludeIds.includes(o.id));
  const list = candidates.length ? candidates : group;
  return list[seed % list.length];
}

export function generateDailySlate(dayKey: string, r: RunState, now: number, baseSeed = r.seed): JourneyDailyState {
  const seed = hashSeed(`${dayKey}:${baseSeed}`);
  const foragePool = DAILY_OBJECTIVES.filter(o => o.slotGroup === 'forage');
  const homePool = DAILY_OBJECTIVES.filter(o => o.slotGroup === 'homestead');
  const expPool = DAILY_OBJECTIVES.filter(o => o.slotGroup === 'expedition');

  const slotA = pickFromGroup(foragePool, r, now, seed);
  const slotB = pickFromGroup(homePool, r, now, seed >>> 5);
  const slotC = pickFromGroup(expPool, r, now, seed >>> 11);

  return {
    dayKey,
    seed,
    slots: [slotA, slotB, slotC].map(def => ({ id: def.id, progress: 0, target: def.target })),
    points: 0,
    claimedMilestones: [],
    preservedRewards: [],
    rerollsUsed: 0,
  };
}

export function ensureDailySlate(pj: JourneyProfileSnapshot, r: RunState, now: number): JourneyDailyState {
  const today = localDayKey(now);
  if (pj.daily && pj.daily.dayKey === today) return pj.daily;
  if (pj.daily && pj.daily.dayKey !== today) {
    const prev = pj.daily;
    const completedCount = prev.slots.filter(s => s.completedAt !== undefined).length;
    if (prev.points > 0 || completedCount > 0) {
      pj.dailyHistory = [
        { dayKey: prev.dayKey, points: prev.points, completedCount, milestones: [...prev.claimedMilestones] },
        ...pj.dailyHistory.filter(h => h.dayKey !== prev.dayKey),
      ].slice(0, 14);
    }
    // Gentle non-punitive streak check: if lastCompletedDay isn't yesterday or today, streak rests at 0 cleanly
    if (pj.lastCompletedDay && pj.lastCompletedDay !== today && pj.lastCompletedDay !== previousDayKey(today)) {
      pj.streak = 0;
    }
  }
  pj.daily = generateDailySlate(today, r, now);
  return pj.daily;
}

export function rerollDailySlot(gs: GameState, slotIdx: number, now: number, qaMode: boolean): { ok: boolean; reason?: string } {
  const r = gs.run;
  if (!r) return { ok: false, reason: 'No active run.' };
  const pj = getJourneyProfile(gs, qaMode);
  const daily = ensureDailySlate(pj, r, now);
  if (daily.rerollsUsed >= 1) return { ok: false, reason: 'Daily objective swap already used today.' };
  const slot = daily.slots[slotIdx];
  if (!slot) return { ok: false, reason: 'Invalid daily objective slot.' };
  if (slot.completedAt !== undefined) return { ok: false, reason: 'Completed objectives cannot be swapped.' };
  const curDef = DAILY_OBJECTIVES.find(d => d.id === slot.id);
  if (!curDef) return { ok: false, reason: 'Unknown objective.' };
  const group = DAILY_OBJECTIVES.filter(d => d.slotGroup === curDef.slotGroup);
  const nextDef = pickFromGroup(group, r, now, daily.seed + slotIdx + 7, [slot.id]);
  if (nextDef.id === slot.id) return { ok: false, reason: 'No alternate objective available right now.' };
  daily.slots[slotIdx] = { id: nextDef.id, progress: 0, target: nextDef.target, rerolled: true };
  daily.rerollsUsed += 1;
  return { ok: true };
}

function pushChronicle(pj: JourneyProfileSnapshot, rj: JourneyRunSnapshot, entry: JourneyChronicleEntry, runId: string) {
  if (!rj.timeline.some(x => x.id === entry.id)) {
    rj.timeline = [entry, ...rj.timeline].slice(0, 40);
  }
  if (!pj.chronicle.some(x => x.id === entry.id)) {
    pj.chronicle = [{ ...entry, runId }, ...pj.chronicle].slice(0, 48);
  }
}

function awardDailyPointsAndMilestones(
  pj: JourneyProfileSnapshot,
  rj: JourneyRunSnapshot,
  daily: JourneyDailyState,
  slot: JourneyDailyState['slots'][number],
  def: DailyObjectiveDef,
  now: number,
  runId: string,
  events: JourneyTransitionEvent[],
) {
  if (slot.completedAt !== undefined || slot.progress < slot.target) return;
  slot.completedAt = now;
  daily.points += def.points;
  pj.totalDailyPoints += def.points;

  const evId = `daily:${daily.dayKey}:${def.id}`;
  events.push({
    id: evId,
    level: 2,
    kind: 'daily_complete',
    title: 'DAILY PACT FULFILLED',
    detail: `${def.title} · +${def.points} DP (${daily.points}/100)`,
    icon: def.icon,
    accent: '#93d8b4',
    meaning: `${def.points} Daily Points added to today's Pact`,
  });
  pushChronicle(pj, rj, {
    id: evId,
    at: now,
    level: 2,
    kind: 'daily',
    title: def.title,
    detail: `+${def.points} DP · ${def.desc}`,
    icon: def.icon,
  }, runId);

  for (const m of DAILY_MILESTONES) {
    if (daily.points >= m.points && !daily.claimedMilestones.includes(m.id)) {
      daily.claimedMilestones.push(m.id);
      if (m.preservedAuthority) {
        const rewardId = `daily:${daily.dayKey}:${m.id}`;
        if (!daily.preservedRewards.some(p => p.id === rewardId)) {
          daily.preservedRewards.push({
            id: rewardId,
            milestone: m.title,
            label: m.preservedAuthority.label,
            authorityRequired: m.preservedAuthority.authorityRequired,
            recordedAt: now,
          });
        }
      }
      if (m.id === 'tier3' && pj.lastCompletedDay !== daily.dayKey) {
        pj.streak = pj.lastCompletedDay === previousDayKey(daily.dayKey) ? pj.streak + 1 : 1;
        pj.bestStreak = Math.max(pj.bestStreak, pj.streak);
        pj.lastCompletedDay = daily.dayKey;
      }
      const mId = `milestone:${daily.dayKey}:${m.id}`;
      events.push({
        id: mId,
        level: 3,
        kind: 'daily_milestone',
        title: m.title.toUpperCase(),
        detail: `${m.sealName} (${m.points} DP) · ${m.preservedAuthority ? 'Seal & Voucher preserved' : 'Daily Seal unlocked'}`,
        icon: m.icon,
        accent: '#f4d089',
        meaning: m.authenticReward,
      });
      pushChronicle(pj, rj, {
        id: mId,
        at: now,
        level: 3,
        kind: 'milestone',
        title: `${m.title} (${m.points} DP)`,
        detail: m.authenticReward,
        icon: m.icon,
      }, runId);
    }
  }
}

/**
 * Reconcile Fieldcraft, Daily Pact, Discoveries, and Chronicle strictly from
 * genuine engine receipts & world state. Safe to call every UI heartbeat — zero
 * duplicate credit or duplicate claims across save/reload.
 */
export function reconcileJourney(
  gs: GameState,
  now: number,
  opts: { qaMode?: boolean; suppressPresentations?: boolean } = {},
): JourneyTransitionEvent[] {
  const r = gs.run;
  if (!r) return [];
  const qaMode = !!opts.qaMode;
  const pj = getJourneyProfile(gs, qaMode);
  const rj = getJourneyRun(r, qaMode);
  const daily = ensureDailySlate(pj, r, now);
  const events: JourneyTransitionEvent[] = [];

  // 1. Reconcile new receipts strictly after watermark & not in seenReceipts
  const seen = new Set(rj.seenReceipts);
  const newReceipts = r.receipts.filter(rc => rc.seq > rj.lastSeq && !seen.has(rc.id));
  if (newReceipts.length) {
    for (const rc of newReceipts) {
      seen.add(rc.id);
      rj.lastSeq = Math.max(rj.lastSeq, rc.seq);

      for (const slot of daily.slots) {
        if (slot.completedAt !== undefined) continue;
        const def = DAILY_OBJECTIVES.find(d => d.id === slot.id);
        if (!def) continue;
        const delta = def.receiptDelta(rc, r);
        if (delta > 0) {
          slot.progress = Math.min(slot.target, slot.progress + delta);
          awardDailyPointsAndMilestones(pj, rj, daily, slot, def, now, r.id, events);
        }
      }

      if (rc.kind === 'achievement') {
        const a = ACHIEVEMENTS[rc.detail];
        const meta = ACHIEVEMENT_META[rc.detail];
        if (a) {
          pushChronicle(pj, rj, {
            id: `ach:${r.id}:${rc.detail}`,
            at: rc.at,
            level: meta?.level ?? 3,
            kind: 'achievement',
            title: a.name,
            detail: meta?.meaning || `+${a.score} local score`,
            icon: meta?.icon,
          }, r.id);
        }
      } else if (rc.kind === 'learn.blueprint' && RECIPES[rc.detail]) {
        const outKey = RECIPES[rc.detail].out;
        pushChronicle(pj, rj, {
          id: `bp:${r.id}:${rc.detail}`,
          at: rc.at,
          level: 3,
          kind: 'recipe',
          title: `Recipe: ${ITEMS[outKey]?.name || rc.detail}`,
          detail: `Unlocked for ${RECIPES[rc.detail].station ? STRUCTS[RECIPES[rc.detail].station!]?.name : 'Hand craft'}`,
          icon: outKey,
        }, r.id);
      } else if (rc.kind === 'elder.defeat') {
        pushChronicle(pj, rj, {
          id: `elder:${r.id}:${rc.detail}`,
          at: rc.at,
          level: 5,
          kind: 'elder',
          title: `Vanquished Elder (${rc.detail})`,
          detail: 'Elder Stone dropped on the battlefield',
          icon: `stone_${rc.detail}`,
        }, r.id);
      }
    }
    rj.seenReceipts = [...seen].slice(-300);
  }

  // 2. Reconcile real exploration deltas for daily_cartographer without double counting
  const wmMap = qaMode ? qaDiscoveryWatermark : prodDiscoveryWatermark;
  const cellsNow = r.discovered.reduce((acc, v) => acc + (v ? 1 : 0), 0);
  const poisNow = r.poiSeen.length;
  const prevWm = wmMap.get(r);
  if (!prevWm) {
    wmMap.set(r, { cells: cellsNow, pois: poisNow });
  } else {
    const cellDelta = Math.max(0, cellsNow - prevWm.cells);
    const poiDelta = Math.max(0, poisNow - prevWm.pois);
    if (cellDelta > 0 || poiDelta > 0) {
      wmMap.set(r, { cells: cellsNow, pois: poisNow });
      const carto = daily.slots.find(s => s.id === 'daily_cartographer' && s.completedAt === undefined);
      if (carto) {
        const def = DAILY_OBJECTIVES.find(d => d.id === carto.id)!;
        carto.progress = Math.min(carto.target, carto.progress + cellDelta + poiDelta * 6);
        awardDailyPointsAndMilestones(pj, rj, daily, carto, def, now, r.id, events);
      }
      if (poiDelta > 0) {
        const world = getWorld(r.layoutId || 'shipping');
        const newestId = r.poiSeen[r.poiSeen.length - 1];
        const pl = world.places.find(p => p.id === newestId);
        if (pl) {
          const lmId = `poi:${r.id}:${pl.id}`;
          events.push({
            id: lmId,
            level: 4,
            kind: 'landmark_discovered',
            title: pl.name.toUpperCase(),
            detail: `Charted at (${pl.tx}, ${pl.ty})`,
            icon: 'compass',
            accent: '#5fc8e0',
            meaning: 'Site permanently recorded on your Field Chart [M]',
          });
          pushChronicle(pj, rj, {
            id: lmId,
            at: now,
            level: 4,
            kind: 'landmark',
            title: `Charted ${pl.name}`,
            detail: `Discovered sector (${pl.tx}, ${pl.ty})`,
            icon: 'compass',
          }, r.id);
        }
      }
    }
  }

  // 3. Reconcile Creator Core UIDs entering custody
  for (const sl of C(r, 'inv').slots) {
    if (sl && ITEMS[sl.key]?.creatorCore && !rj.discoveredCoreUids.includes(sl.uid)) {
      rj.discoveredCoreUids = [...rj.discoveredCoreUids, sl.uid].slice(-64);
      if (!pj.discoveredCores.includes(sl.key)) pj.discoveredCores = [...pj.discoveredCores, sl.key];
      const def = ITEMS[sl.key];
      const coreEvId = `core:${sl.uid}`;
      events.push({
        id: coreEvId,
        level: 4,
        kind: 'core_discovered',
        title: def.name.toUpperCase(),
        detail: `${def.essence ? def.essence.toUpperCase() + ' ESSENCE' : 'CREATOR CORE'} · Hold Q / E · Reload R`,
        icon: sl.key,
        accent: def.essence === 'fire' ? '#ff8a3a' : def.essence === 'water' ? '#7fd8ff' : def.essence === 'spirit' ? '#d99bff' : '#91d66d',
        meaning: 'Relic Core added to Expedition Chronicle',
      });
      pushChronicle(pj, rj, {
        id: `chron-core:${sl.key}:${r.id}`,
        at: now,
        level: 4,
        kind: 'core',
        title: def.name,
        detail: def.desc,
        icon: sl.key,
      }, r.id);
    }
  }

  // 4. Reconcile Fieldcraft Paths against live state & receipts
  for (const path of FIELDCRAFT_PATHS) {
    const cur: JourneyFieldcraftProgress = rj.fieldcraft[path.id] ?? (rj.fieldcraft[path.id] = { stepsDone: [] });
    const hadAll = cur.completedAt !== undefined;
    let newlyDoneSteps = 0;

    for (const step of path.steps) {
      if (!cur.stepsDone.includes(step.id) && step.verifiedBy(r, now)) {
        cur.stepsDone = [...cur.stepsDone, step.id];
        if (!cur.seenAt) cur.seenAt = now;
        newlyDoneSteps++;
      }
    }

    if (!hadAll && cur.stepsDone.length >= path.steps.length) {
      cur.completedAt = now;
      if (!pj.fieldcraftMastered.includes(path.id)) pj.fieldcraftMastered = [...pj.fieldcraftMastered, path.id];
      const fcId = `fieldcraft:${r.id}:${path.id}`;
      events.push({
        id: fcId,
        level: 2,
        kind: 'fieldcraft_complete',
        title: `FIELDCRAFT · ${path.title.toUpperCase()}`,
        detail: path.meaning,
        icon: path.icon,
        accent: '#93d8b4',
        meaning: `${path.steps.length}/${path.steps.length} skills verified by real gameplay`,
      });
      pushChronicle(pj, rj, {
        id: fcId,
        at: now,
        level: 2,
        kind: 'fieldcraft',
        title: `Mastered: ${path.title}`,
        detail: path.meaning,
        icon: path.icon,
      }, r.id);
    } else if (newlyDoneSteps > 0 && cur.stepsDone.length < path.steps.length) {
      const doneCount = cur.stepsDone.length;
      const stepEvId = `fc-step:${r.id}:${path.id}:${doneCount}`;
      events.push({
        id: stepEvId,
        level: 2,
        kind: 'fieldcraft_step',
        title: `${path.title}`,
        detail: `Step ${doneCount}/${path.steps.length} complete`,
        icon: path.icon,
        accent: '#85d2df',
      });
    }
  }

  return opts.suppressPresentations ? [] : events;
}

export function fieldcraftStatusOf(path: FieldcraftPathDef, progress?: JourneyFieldcraftProgress): FieldcraftStatus {
  if (progress?.completedAt !== undefined || (progress?.stepsDone.length ?? 0) >= path.steps.length) return 'completed';
  if (progress?.dismissed) return 'dismissed';
  if ((progress?.stepsDone.length ?? 0) > 0) return 'in_progress';
  if (progress?.seenAt !== undefined) return 'seen';
  return 'unseen';
}

export function markFieldcraftSeen(gs: GameState, pathId: string, now: number, qaMode: boolean) {
  if (!gs.run) return;
  const rj = getJourneyRun(gs.run, qaMode);
  const cur = rj.fieldcraft[pathId] ?? (rj.fieldcraft[pathId] = { stepsDone: [] });
  if (!cur.seenAt) cur.seenAt = now;
}

export function setFieldcraftDismissed(gs: GameState, pathId: string, dismissed: boolean, qaMode: boolean) {
  if (!gs.run) return;
  const rj = getJourneyRun(gs.run, qaMode);
  const cur = rj.fieldcraft[pathId] ?? (rj.fieldcraft[pathId] = { stepsDone: [] });
  cur.dismissed = dismissed;
  if (!dismissed && !cur.seenAt) cur.seenAt = Date.now();
}

export function setTrackedJourneyTarget(gs: GameState, trackedId: string | null, qaMode: boolean) {
  if (!gs.run) return;
  const rj = getJourneyRun(gs.run, qaMode);
  rj.trackedId = trackedId ?? 'auto';
}

// ============================================================================
// LEGITIMATE WORLD-ANCHORED HINT DISCOVERY (ZERO FOG SPOILERS)
// ============================================================================
function bearingText(dxPx: number, dyPx: number): string {
  const tiles = Math.round(Math.hypot(dxPx, dyPx) / TILE);
  if (tiles < 2) return 'Here';
  const a = (Math.atan2(dyPx, dxPx) * 180) / Math.PI;
  const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  return `${tiles}t ${dirs[Math.round(((a + 360) % 360) / 45) % 8]}`;
}

function makeWorldHint(
  r: RunState,
  x: number,
  y: number,
  label: string,
  camX: number,
  camY: number,
): WayfinderWorldHint {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  const sx = x - camX, sy = y - camY;
  const onScreen = sx >= 16 && sx <= VIEW_W - 16 && sy >= 18 && sy <= VIEW_H - 22;
  return {
    x,
    y,
    tx,
    ty,
    label,
    distanceTiles: Math.round(Math.hypot(x - r.player.x, y - r.player.y) / TILE),
    bearing: bearingText(x - r.player.x, y - r.player.y),
    onScreen,
  };
}

function findNearestOwnedEntity(r: RunState, types: string[]): { x: number; y: number; label: string } | null {
  let best: { x: number; y: number; label: string; d: number } | null = null;
  for (const e of Object.values(r.entities)) {
    if (e.kind !== 'struct' || !e.type || !types.includes(e.type)) continue;
    if (e.owner !== undefined && e.owner !== 'player') continue;
    const d = Math.hypot(e.x - r.player.x, e.y - r.player.y);
    if (!best || d < best.d) best = { x: e.x, y: e.y, label: STRUCTS[e.type]?.name || e.type, d };
  }
  return best ? { x: best.x, y: best.y, label: best.label } : null;
}

function findVisibleExploredSource(r: RunState, keys: string[], camX: number, camY: number): { x: number; y: number; label: string } | null {
  const w = getWorld(r.layoutId || 'shipping');
  const x0 = Math.max(0, Math.floor(camX / TILE) + 1);
  const x1 = Math.min(WW - 1, Math.floor((camX + VIEW_W) / TILE) - 1);
  const y0 = Math.max(0, Math.floor(camY / TILE) + 1);
  const y1 = Math.min(WH - 1, Math.floor((camY + VIEW_H) / TILE) - 1);
  let best: { x: number; y: number; label: string; d: number } | null = null;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!discoveredCell(r, tx, ty)) continue;
      const idx = ty * WW + tx;
      const k = w.sourceV3[idx];
      if (!k || !keys.includes(k)) continue;
      const st = r.sources[idx];
      if (st && st.stock <= 0) continue;
      const x = tx * TILE + 8, y = ty * TILE + 8;
      const d = Math.hypot(x - r.player.x, y - r.player.y);
      if (!best || d < best.d) best = { x, y, label: SOURCES[k]?.name || k, d };
    }
  }
  return best ? { x: best.x, y: best.y, label: best.label } : null;
}

function findVisibleFreshWater(r: RunState, camX: number, camY: number): { x: number; y: number; label: string } | null {
  const w = getWorld(r.layoutId || 'shipping');
  const x0 = Math.max(0, Math.floor(camX / TILE) + 1);
  const x1 = Math.min(WW - 1, Math.floor((camX + VIEW_W) / TILE) - 1);
  const y0 = Math.max(0, Math.floor(camY / TILE) + 1);
  const y1 = Math.min(WH - 1, Math.floor((camY + VIEW_H) / TILE) - 1);
  let best: { x: number; y: number; d: number } | null = null;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!discoveredCell(r, tx, ty)) continue;
      if (!w.fresh[ty * WW + tx]) continue;
      const x = tx * TILE + 8, y = ty * TILE + 8;
      const d = Math.hypot(x - r.player.x, y - r.player.y);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best ? { x: best.x, y: best.y, label: 'Fresh Water' } : null;
}

// ============================================================================
// SMART WAYFINDER STATE BUILDER
// ============================================================================
export function computeWayfinderState(
  gs: GameState,
  now: number,
  opts: {
    qaMode: boolean;
    actions: Set<string>;
    camX: number;
    camY: number;
    recentCompletedId?: string | null;
  },
): WayfinderView | null {
  const r = gs.run;
  if (!r) return null;
  const pj = getJourneyProfile(gs, opts.qaMode);
  const rj = getJourneyRun(r, opts.qaMode);
  const daily = ensureDailySlate(pj, r, now);
  const fnStore = readFieldNoteStore(r, opts.qaMode);
  const noteEval = evaluateFieldNotes(r, now, opts.actions, fnStore);

  // Build available switch options
  const options: WayfinderOption[] = [];
  daily.slots.forEach((sl, idx) => {
    const def = DAILY_OBJECTIVES.find(d => d.id === sl.id);
    if (!def) return;
    options.push({
      id: `daily:${idx}`,
      kind: 'daily',
      title: def.title,
      progressText: sl.completedAt ? 'DONE' : `${sl.progress}/${sl.target}`,
      category: def.category,
      icon: def.icon,
    });
  });
  for (const fp of FIELDCRAFT_PATHS) {
    const st = rj.fieldcraft[fp.id];
    const status = fieldcraftStatusOf(fp, st);
    if (status === 'completed' || status === 'dismissed') continue;
    options.push({
      id: `field:${fp.id}`,
      kind: 'fieldcraft',
      title: fp.title,
      progressText: `${st?.stepsDone.length ?? 0}/${fp.steps.length}`,
      category: fp.category,
      icon: fp.icon,
    });
  }
  options.push({
    id: 'goal:crown',
    kind: 'milestone',
    title: 'Crown & Evacuation',
    progressText: `${r.elderStones.length}/6`,
    category: 'expedition',
    icon: 'compass',
  });

  if (rj.trackedId === 'none') {
    return {
      trackedId: 'none',
      hidden: true,
      kind: 'milestone',
      kindLabel: 'WAYFINDER PAUSED',
      category: 'expedition',
      icon: 'compass',
      title: 'Free Exploration',
      summary: 'Wayfinder tucked away.',
      current: 0,
      target: 1,
      pct: 0,
      progressText: '',
      blocker: null,
      nextStep: 'Open Codex [N] or tap to resume tracking.',
      meaning: '',
      action: { label: 'Codex [N]', panel: 'notes' },
      worldHint: null,
      completedJustNow: false,
      options,
    };
  }

  // Decide active target when trackedId is 'auto' or invalid
  let chosen = rj.trackedId && rj.trackedId !== 'auto' ? rj.trackedId : null;
  if (chosen && !options.some(o => o.id === chosen) && !chosen.startsWith('note:')) {
    chosen = null;
  }

  // High-priority situational field notes always surface automatically in 'auto' mode!
  const urgentNote: FieldNoteDef | null = noteEval.active && noteEval.active.priority >= 74 ? noteEval.active : null;
  if ((!chosen || chosen === 'auto') && urgentNote) {
    const death = urgentNote.id === 'death_bag' ? deathBagView(r) : null;
    const bagLoc = death?.status === 'present' ? makeWorldHint(r, death.bag.x, death.bag.y, 'Death Bag', opts.camX, opts.camY) : null;
    const blocker = urgentNote.id === 'overloaded_pack'
      ? `Pack weight ${invWeight(r).toFixed(0)}/${carryLimit(r)}kg slows movement`
      : urgentNote.id === 'worn_tool'
        ? 'A carried tool/weapon is near breaking'
        : urgentNote.id === 'cold_night_shelter'
          ? `Warmth ${Math.round(r.player.warmth)} — unsheltered`
          : urgentNote.id === 'hunger_thirst'
            ? `Hunger ${Math.round(r.player.hunger)} · Thirst ${Math.round(r.player.thirst)}`
            : null;
    return {
      trackedId: `note:${urgentNote.id}`,
      hidden: false,
      kind: 'note',
      kindLabel: 'FIELD ALERT',
      category: urgentNote.category,
      icon: urgentNote.id === 'death_bag' ? 'trail_pack' : urgentNote.id === 'spirit_blink' ? 'core_demon' : 'torch',
      title: urgentNote.title,
      summary: urgentNote.body,
      current: 0,
      target: 1,
      pct: 0,
      progressText: urgentNote.keyHint,
      blocker,
      nextStep: urgentNote.body,
      meaning: 'Situational survival alert',
      action: ['death_bag', 'spirit_blink'].includes(urgentNote.id)
        ? { label: 'Map [M]', panel: 'map' }
        : ['worn_tool', 'hunger_thirst', 'overloaded_pack'].includes(urgentNote.id)
          ? { label: 'Pack [I]', panel: 'inv' }
          : { label: 'Codex [N]', panel: 'notes' },
      worldHint: bagLoc,
      completedJustNow: false,
      options,
    };
  }

  if (!chosen) {
    // Prefer an active/incomplete Fieldcraft path early on, or a nearly-done Daily objective
    const inProgField = FIELDCRAFT_PATHS.find(fp => {
      const st = rj.fieldcraft[fp.id];
      const s = fieldcraftStatusOf(fp, st);
      return s === 'in_progress';
    });
    const nextField = inProgField ?? FIELDCRAFT_PATHS.find(fp => {
      const s = fieldcraftStatusOf(fp, rj.fieldcraft[fp.id]);
      return s !== 'completed' && s !== 'dismissed';
    });
    const bestDailyIdx = daily.slots.findIndex(sl => sl.completedAt === undefined);
    if (inProgField) chosen = `field:${inProgField.id}`;
    else if (nextField && runHours(r, now) < 6) chosen = `field:${nextField.id}`;
    else if (bestDailyIdx >= 0) chosen = `daily:${bestDailyIdx}`;
    else if (nextField) chosen = `field:${nextField.id}`;
    else chosen = 'goal:crown';
  }

  // Render Daily Pact target
  if (chosen.startsWith('daily:')) {
    const idx = Number(chosen.slice(6));
    const slot = daily.slots[idx];
    const def = slot ? DAILY_OBJECTIVES.find(d => d.id === slot.id) : null;
    if (slot && def) {
      let worldHint: WayfinderWorldHint | null = null;
      if (def.id === 'daily_harvester') {
        const src = findVisibleExploredSource(r, ['oak', 'pine', 'palm', 'snowpine', 'willow', 'rock', 'bush'], opts.camX, opts.camY);
        if (src) worldHint = makeWorldHint(r, src.x, src.y, src.label, opts.camX, opts.camY);
      } else if (def.id === 'daily_forager') {
        const src = findVisibleExploredSource(r, ['bush', 'herb', 'mushroom'], opts.camX, opts.camY);
        if (src) worldHint = makeWorldHint(r, src.x, src.y, src.label, opts.camX, opts.camY);
      } else if (def.id === 'daily_prospector') {
        const src = findVisibleExploredSource(r, ['rock', 'iron_vein', 'coal_vein', 'wreck', 'salt_shale'], opts.camX, opts.camY);
        if (src) worldHint = makeWorldHint(r, src.x, src.y, src.label, opts.camX, opts.camY);
      } else if (def.id === 'daily_smelter') {
        const st = findNearestOwnedEntity(r, ['furnace', 'campfire', 'refinery']);
        if (st) worldHint = makeWorldHint(r, st.x, st.y, st.label, opts.camX, opts.camY);
      } else if (def.id === 'daily_provisioner') {
        const fw = findVisibleFreshWater(r, opts.camX, opts.camY);
        if (fw) worldHint = makeWorldHint(r, fw.x, fw.y, fw.label, opts.camX, opts.camY);
      }
      const pct = Math.min(100, Math.round((slot.progress / Math.max(1, slot.target)) * 100));
      return {
        trackedId: chosen,
        hidden: false,
        kind: 'daily',
        kindLabel: `DAILY PACT · +${def.points} DP`,
        category: def.category,
        icon: def.icon,
        title: def.title,
        summary: def.desc,
        current: slot.progress,
        target: slot.target,
        pct,
        progressText: slot.completedAt ? 'COMPLETE' : `${slot.progress}/${slot.target}`,
        blocker: def.blockerHint ? def.blockerHint(r, now) : null,
        nextStep: def.actionHint,
        meaning: `+${def.points} DP toward Daily Milestones (${daily.points}/100 DP)`,
        action: def.suggestedAction ?? { label: 'Codex [N]', panel: 'notes' },
        worldHint,
        completedJustNow: opts.recentCompletedId === `daily:${daily.dayKey}:${def.id}` || slot.completedAt !== undefined,
        options,
      };
    }
  }

  // Render Fieldcraft Path target
  if (chosen.startsWith('field:')) {
    const pathId = chosen.slice(6);
    const path = FIELDCRAFT_PATHS.find(p => p.id === pathId);
    if (path) {
      const prog = rj.fieldcraft[path.id];
      const doneSet = new Set(prog?.stepsDone ?? []);
      const curStep = path.steps.find(st => !doneSet.has(st.id)) ?? path.steps[path.steps.length - 1];
      const done = doneSet.size;
      const total = path.steps.length;
      const pct = Math.round((done / total) * 100);

      let blocker: string | null = null;
      let action: WayfinderView['action'] = { label: 'Codex [N]', panel: 'notes' };
      let worldHint: WayfinderWorldHint | null = null;

      if (curStep.id === 'harvest_nature') {
        const src = findVisibleExploredSource(r, ['oak', 'pine', 'bush', 'rock'], opts.camX, opts.camY);
        if (src) worldHint = makeWorldHint(r, src.x, src.y, src.label, opts.camX, opts.camY);
      } else if (curStep.id === 'stay_hydrated') {
        const fw = findVisibleFreshWater(r, opts.camX, opts.camY);
        if (fw) worldHint = makeWorldHint(r, fw.x, fw.y, fw.label, opts.camX, opts.camY);
        action = { label: 'Pack [I]', panel: 'inv' };
      } else if (curStep.id === 'craft_by_hand') {
        const cr = craftReadiness(r, 'rope', now);
        if (!cr.canSubmit && countItem(r, 'inv', 'fiber') < 3) blocker = 'Gather 3 Plant Fiber first';
        action = { label: 'Craft [C]', panel: 'craft', recipe: 'rope' };
      } else if (curStep.id === 'raise_campfire') {
        const wood = countItem(r, 'inv', 'wood'), stone = countItem(r, 'inv', 'stone');
        if (wood < 5 || stone < 3) blocker = `Need ${Math.max(0, 5 - wood)} Wood & ${Math.max(0, 3 - stone)} Stone`;
        action = { label: 'Stations [C]', panel: 'craft' };
      } else if (curStep.id === 'tend_fire_job') {
        const cf = findNearestOwnedEntity(r, ['campfire']);
        if (cf) worldHint = makeWorldHint(r, cf.x, cf.y, cf.label, opts.camX, opts.camY);
        else blocker = 'Build a Campfire first';
      } else if (curStep.id === 'build_shelter') {
        blocker = !r.player.sheltered ? 'Enclose Floor + Walls + Door + Roof' : null;
        action = { label: 'Build [B]', buildTool: 'wall_wood' };
      } else if (curStep.id === 'build_workshop') {
        const hasF = hasOwnedStruct(r, ['furnace']), hasW = hasOwnedStruct(r, ['workbench']);
        if (!hasF || !hasW) blocker = `Missing: ${[!hasF && 'Furnace', !hasW && 'Workbench'].filter(Boolean).join(' & ')}`;
        action = { label: 'Stations [C]', panel: 'craft' };
      } else if (curStep.id === 'smelt_ingot') {
        const fu = findNearestOwnedEntity(r, ['furnace']);
        if (fu) worldHint = makeWorldHint(r, fu.x, fu.y, fu.label, opts.camX, opts.camY);
        const cr = craftReadiness(r, 'iron_ingot', now);
        if (!cr.canWork && cr.code !== 'unknown') blocker = cr.next;
      } else if (curStep.id === 'place_cabinet' || curStep.id === 'fund_cabinet') {
        const cab = findNearestOwnedEntity(r, ['claim']);
        if (cab) worldHint = makeWorldHint(r, cab.x, cab.y, cab.label, opts.camX, opts.camY);
        if (curStep.id === 'fund_cabinet' && cab) blocker = 'Cabinet needs Wood, Stone, or Fiber upkeep';
      } else if (curStep.id === 'survey_landmark') {
        action = { label: 'Map [M]', panel: 'map' };
      } else if (curStep.id === 'channel_core') {
        const hasCore = C(r, 'inv').slots.some(s => s && !!ITEMS[s.key]?.creatorCore);
        if (!hasCore) blocker = 'Find a Creator Core inside island POIs or Airdrops';
        action = { label: 'Pack [I]', panel: 'inv' };
      }

      return {
        trackedId: chosen,
        hidden: false,
        kind: 'fieldcraft',
        kindLabel: `FIELDCRAFT · ${done}/${total}`,
        category: path.category,
        icon: path.icon,
        title: path.title,
        summary: curStep.label,
        current: done,
        target: total,
        pct,
        progressText: `${done}/${total}`,
        blocker,
        nextStep: curStep.hint,
        meaning: path.meaning,
        action,
        worldHint,
        completedJustNow: opts.recentCompletedId === `fieldcraft:${r.id}:${path.id}` || done >= total,
        options,
      };
    }
  }

  // Fallback: Crown & Evacuation Milestone
  const w = getWorld(r.layoutId || 'shipping');
  const evacPlace = r.poiSeen.includes('evac') ? w.places.find(p => p.id === 'evac') : null;
  const rag = isRagnarok(r, now);
  return {
    trackedId: 'goal:crown',
    hidden: false,
    kind: 'milestone',
    kindLabel: rag ? 'RAGNAROK ENDGAME' : 'ISLAND RECKONING',
    category: 'expedition',
    icon: r.elderStones.length >= 6 ? 'stone_dragon' : 'compass',
    title: r.elderStones.length >= 6 ? 'Evacuate with Six Stones' : rag ? 'Secure Cash & Evacuate' : 'Crown of Six Stones',
    summary: r.elderStones.length >= 6
      ? 'Carry all 6 Elder Stones to the Evacuation Beacon.'
      : `Elder Stones ${r.elderStones.length}/6 · ${rag ? 'Sealed Vaults & Elders awake' : 'Prepare gear & explore POIs'}`,
    current: r.elderStones.length,
    target: 6,
    pct: Math.round((r.elderStones.length / 6) * 100),
    progressText: `${r.elderStones.length}/6`,
    blocker: r.elderStones.length === 0 ? 'Optional path: challenge Elders or prepare for Day 11 Ragnarok' : null,
    nextStep: evacPlace ? `Evacuation Beacon charted at (${evacPlace.tx}, ${evacPlace.ty}).` : 'Survey the island via Field Chart [M] and prepare gear.',
    meaning: 'Six Elder Stones + Evacuation earns the Sovereign Ending',
    action: { label: 'Map [M]', panel: 'map' },
    worldHint: evacPlace ? makeWorldHint(r, evacPlace.tx * TILE + 8, evacPlace.ty * TILE + 8, evacPlace.name, opts.camX, opts.camY) : null,
    completedJustNow: false,
    options,
  };
}

export function clearJourneyQaMemory(r: RunState) {
  qaProfileMem.delete(r);
  qaRunMem.delete(r);
  qaDiscoveryWatermark.delete(r);
}
void BAL; void isRecipeKnown;
