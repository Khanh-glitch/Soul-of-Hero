import { BAL, type RunState } from './core';
import { ITEMS } from './catalog';
import { C, carryLimit, dayTime, invWeight, isRagnarok, nearestHomeStructure, homeStatus, runHours } from './engine';
import { activeStack } from './sim';
import { deathBagView } from './death-view';

export type FieldNoteCategory = 'survival' | 'craft' | 'shelter' | 'combat' | 'expedition';

export interface FieldNoteDef {
  id: string;
  category: FieldNoteCategory;
  title: string;
  keyHint: string;
  body: string;
  priority: number;
  when: (ctx: FieldNoteCtx) => boolean;
  autoResolve?: (ctx: FieldNoteCtx) => boolean;
}

export interface FieldNoteCtx {
  r: RunState;
  now: number;
  hrs: number;
  actions: Set<string>;
}

export interface FieldNoteStore {
  dismissed: string[];
  resolved: string[];
  triggered: string[];
  muted: boolean;
}

const qaMemory = new WeakMap<RunState, FieldNoteStore>();

const DEFAULT_STORE = (): FieldNoteStore => ({ dismissed: [], resolved: [], triggered: [], muted: false });

function storageKey(r: RunState): string {
  return `soh.field-notes.v1:${r.id}`;
}

export function readFieldNoteStore(r: RunState, qaSession: boolean): FieldNoteStore {
  if (qaSession) return qaMemory.get(r) ?? DEFAULT_STORE();
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(r)) || 'null');
    if (!raw || typeof raw !== 'object') return DEFAULT_STORE();
    return {
      dismissed: Array.isArray(raw.dismissed) ? raw.dismissed.filter((x: unknown) => typeof x === 'string') : [],
      resolved: Array.isArray(raw.resolved) ? raw.resolved.filter((x: unknown) => typeof x === 'string') : [],
      triggered: Array.isArray(raw.triggered) ? raw.triggered.filter((x: unknown) => typeof x === 'string') : [],
      muted: !!raw.muted,
    };
  } catch {
    return DEFAULT_STORE();
  }
}

export function writeFieldNoteStore(r: RunState, qaSession: boolean, next: FieldNoteStore): FieldNoteStore {
  const clean: FieldNoteStore = {
    dismissed: [...new Set(next.dismissed)].slice(0, 32),
    resolved: [...new Set(next.resolved)].slice(0, 32),
    triggered: [...new Set(next.triggered)].slice(0, 32),
    muted: !!next.muted,
  };
  if (qaSession) qaMemory.set(r, clean);
  else {
    try { localStorage.setItem(storageKey(r), JSON.stringify(clean)); } catch { /* ignore storage quota */ }
  }
  return clean;
}

const hasAny = (r: RunState, keys: string[]) => C(r, 'inv').slots.some(s => !!s && keys.includes(s.key));

export const FIELD_NOTES: FieldNoteDef[] = [
  {
    id: 'death_bag',
    category: 'expedition',
    title: 'Recover Fallen Gear',
    keyHint: 'M',
    body: 'Your last death bag is charted on Field Chart [M]. Prepare food and tools before heading back for it.',
    priority: 95,
    when: ({ r }) => deathBagView(r).status === 'present',
    autoResolve: ({ r }) => deathBagView(r).status !== 'present' && r.receipts.some(rc => rc.kind === 'death'),
  },
  {
    id: 'overloaded_pack',
    category: 'survival',
    title: 'Pack Overloaded',
    keyHint: 'B · F',
    body: 'Weight above carry limit slows movement. Drop excess, store in a Chest [B], or haul it with a Cart [F].',
    priority: 88,
    when: ({ r }) => invWeight(r) > carryLimit(r),
  },
  {
    id: 'cold_night_shelter',
    category: 'shelter',
    title: 'Cold & Exposure',
    keyHint: 'B · I',
    body: 'Warmth is dropping without roofed shelter. Build a Campfire or enclosed Walls + Roof [B], or equip warm gear [I].',
    priority: 86,
    when: ({ r, now }) => {
      const dtm = dayTime(r, now);
      const night = dtm < 0.25 || dtm > 0.78;
      return !r.player.sheltered && (r.player.warmth < 58 || (night && r.player.warmth < 78));
    },
    autoResolve: ({ r }) => !!r.player.sheltered && r.player.warmth >= 70,
  },
  {
    id: 'hunger_thirst',
    category: 'survival',
    title: 'Hunger & Thirst',
    keyHint: '1-8 · E',
    body: 'Select food or a water flask on Quickbar 1–8 and click LMB/RMB to consume, or press E beside fresh river water.',
    priority: 82,
    when: ({ r }) => r.player.hunger < 62 || r.player.thirst < 62,
  },
  {
    id: 'worn_tool',
    category: 'craft',
    title: 'Worn Tool or Weapon',
    keyHint: 'I · C',
    body: 'A carried tool is near breaking or broken. Craft a replacement [C] or apply a Field Repair Kit inside Pack [I].',
    priority: 76,
    when: ({ r }) => C(r, 'inv').slots.some(s => !!s && !!ITEMS[s.key]?.dur && s.dur !== undefined && s.dur <= 4),
  },
  {
    id: 'spirit_blink',
    category: 'combat',
    title: 'Spirit Blink Destination',
    keyHint: 'M → E',
    body: 'Spirit Core signature needs a charted landing spot: open Field Chart [M], pick safe open ground, then hold and release E.',
    priority: 74,
    when: ({ r }) => activeStack(r)?.key === 'core_demon',
    autoResolve: ({ r }) => r.receipts.some(rc => rc.kind === 'core.commit' && rc.detail.includes('core_demon')),
  },
  {
    id: 'creator_core',
    category: 'combat',
    title: 'Creator Core Reserves',
    keyHint: 'Q · E · R',
    body: 'Hold Q (Refined) or E (Signature) to cast stronger modes; LMB fires Basic. Reload reserves with R, Shift+R, or Alt+R.',
    priority: 70,
    when: ({ r }) => C(r, 'inv').slots.some(s => !!s && !!ITEMS[s.key]?.creatorCore),
    autoResolve: ({ r }) => r.receipts.some(rc => rc.kind === 'core.commit' || rc.kind === 'core.load'),
  },
  {
    id: 'ragnarok_final',
    category: 'expedition',
    title: 'Ragnarok · Final 72h',
    keyHint: 'M · E',
    body: 'Sealed POI vaults are open and Elders stir. Secure Ragnarok coins in an Escrow Chest or reach the Evacuation Beacon.',
    priority: 68,
    when: ({ r, now }) => isRagnarok(r, now),
  },
  {
    id: 'base_and_cabinet',
    category: 'shelter',
    title: 'Territory & Stations',
    keyHint: 'E · V',
    body: 'Interact [E] with stations to fuel or queue work. Keep your Territory Cabinet stocked so walls do not decay; V repairs.',
    priority: 60,
    when: ({ r }) => {
      const ptx = Math.floor(r.player.x / 16), pty = Math.floor(r.player.y / 16);
      const near = nearestHomeStructure(r, ptx, pty, 7);
      if (!near) return false;
      const hs = homeStatus(r);
      return hs.cabinets.some(c => c.state !== 'funded') || hs.structures.some(s => s.state !== 'funded');
    },
  },
  {
    id: 'pack_and_craft',
    category: 'craft',
    title: 'Pack, Quickbar & Craft',
    keyHint: 'I · C',
    body: 'Open Survivor [I / C] to craft tools, inspect stats, or drag items onto Quickbar 1–8. Backpack sorts keep 1–8 safe.',
    priority: 52,
    when: ({ r, actions }) => !actions.has('survivor') && hasAny(r, ['wood', 'stone', 'fiber']),
    autoResolve: ({ actions, r }) => actions.has('survivor') || r.receipts.some(rc => rc.kind === 'craft.hand'),
  },
  {
    id: 'first_landfall',
    category: 'survival',
    title: 'First Landfall',
    keyHint: 'WASD · LMB · E',
    body: 'No quests here — choose your own survival path. Move with WASD, swing LMB to gather timber/berries, E to interact or drink.',
    priority: 40,
    when: ({ hrs, actions, r }) => hrs < 0.25 && !actions.has('harvested') && !r.receipts.some(rc => rc.kind === 'harvest' || rc.kind === 'craft.hand'),
    autoResolve: ({ actions, r }) => actions.has('harvested') || r.receipts.some(rc => rc.kind === 'harvest' || rc.kind === 'craft.hand'),
  },
];

export const FIELD_REFERENCE_GROUPS: { title: string; items: [string, string][] }[] = [
  { title: 'Movement & Action', items: [['WASD / Arrows', 'Move'], ['LMB', 'Swing tool / Attack / Use'], ['Space', 'Dodge roll'], ['E', 'Interact / Drink / Open'], ['F', 'Grab Cart / Mount or Exit Bike']] },
  { title: 'Quickbar & Pack', items: [['1–8 / Wheel', 'Select Quickbar slot'], ['I / C', 'Survivor Pack & Crafting'], ['Hover + 1–8', 'Assign slot to Quickbar'], ['Sort Pack', 'Sorts slots 9–24; protects 1–8']] },
  { title: 'Build & Base', items: [['B', 'Toggle Build Mode'], ['U / V / X', 'Upgrade / Repair / Dismantle'], ['G', 'Cycle structure layer'], ['E on Cabinet', 'Deposit upkeep materials']] },
  { title: 'Cores & Navigation', items: [['Q / E (hold)', 'Refined / Signature Core skill'], ['R / ⇧R / Alt+R', 'Reload Basic / Refined / Sig'], ['M', 'Field Chart (Continent ↔ Sector)'], ['J / N / Esc', 'Journey Ledger / Notes / Menu']] },
  { title: 'Husbandry & Waymark', items: [['T (near animal)', 'Feed / Tame / Command animal'], ['⇧T (near tamed)', 'Toggle Follow / Stay'], ['T (open field)', 'Peek Journey Waymark'], ['Walk on Stairs', 'Change floor (B1 · F1 · F2)']] },
];

export function evaluateFieldNotes(
  r: RunState,
  now: number,
  actions: Set<string>,
  store: FieldNoteStore,
): { active: FieldNoteDef | null; matching: FieldNoteDef[]; nextStore: FieldNoteStore } {
  const ctx: FieldNoteCtx = { r, now, hrs: runHours(r, now), actions };
  let changed = false;
  const resolved = new Set(store.resolved);
  const triggered = new Set(store.triggered);

  for (const note of FIELD_NOTES) {
    if (note.autoResolve?.(ctx) && !resolved.has(note.id)) {
      resolved.add(note.id);
      changed = true;
    }
  }

  const matching = FIELD_NOTES.filter(n => n.when(ctx)).sort((a, b) => b.priority - a.priority);
  for (const m of matching) {
    if (!triggered.has(m.id)) {
      triggered.add(m.id);
      changed = true;
    }
  }

  const active = store.muted
    ? null
    : matching.find(n => !store.dismissed.includes(n.id) && !resolved.has(n.id)) ?? null;

  const nextStore = changed
    ? { ...store, resolved: [...resolved], triggered: [...triggered] }
    : store;

  return { active, matching, nextStore };
}

export function clearFieldNoteQaMemory(r: RunState) {
  qaMemory.delete(r);
}
void BAL;
