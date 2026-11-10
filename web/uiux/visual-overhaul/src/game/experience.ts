import { ACHIEVEMENTS, ELDERS, GARDEN_CROPS, ITEMS, RECIPES, SOURCES, STRUCTS, stationBurnable } from './catalog';
import type { RunState } from './core';
import { C, recipeOutputs, spaceFor } from './engine';
import { recoveryFits } from './recycler';
import type { Cue } from './presentation-cues';

// ============================================================================
// EVENT VOCABULARY — icon first, number second, words last.
// Every event is derived from a committed receipt. `detail` is capped at a
// handful of words; the icon + title carry the meaning at 1x.
// ============================================================================
export type ExperienceKind = 'field' | 'forge' | 'research' | 'relic' | 'boss' | 'world' | 'warning' | 'ledger' | 'milestone' | 'ceremony';
/** feed = one small line at the edge; stage = centre plaque; ceremony = centre plaque + world dim + gear motion. */
export type ExperienceTier = 'feed' | 'stage' | 'ceremony';
export type ExperienceSource = 'engine' | 'staged';
export interface ExperienceEvent {
  id: string;
  kind: ExperienceKind;
  priority: number;
  title: string;
  detail: string;
  icon?: string;
  /** optional secondary icons (e.g. every co-product of a batch) */
  icons?: { key: string; qty?: number }[];
  accent?: string;
  duration: number;
  source: ExperienceSource;
  tier: ExperienceTier;
}

const name = (key?: string) => (key && ITEMS[key] ? ITEMS[key].name : key || '');
export const EVENT_ACCENT: Record<ExperienceKind, string> = {
  field: '#c4d4b0', forge: '#e6b45d', research: '#85d2df', relic: '#d99bff',
  boss: '#f1c16a', world: '#ff7650', warning: '#f09a6b', ledger: '#f1d184', milestone: '#93d8b4', ceremony: '#f4d089',
};

const STAGE_KINDS: ExperienceKind[] = ['relic', 'boss', 'world', 'milestone'];
function ev(id: string, kind: ExperienceKind, title: string, detail: string, icon?: string, priority = 40, duration = 2200, icons?: ExperienceEvent['icons']): ExperienceEvent {
  const tier: ExperienceTier = kind === 'ceremony' ? 'ceremony' : STAGE_KINDS.includes(kind) || priority >= 70 ? 'stage' : 'feed';
  return { id, kind, priority, title, detail, icon, icons, accent: EVENT_ACCENT[kind], duration: tier === 'feed' ? 4200 : duration, source: 'engine', tier };
}

/** Receipt-backed presentation only. Nothing here invents an outcome. */
export function experienceFromCue(c: Cue, r: RunState): ExperienceEvent | null {
  const id = c.receiptId;
  switch (c.kind) {
    case 'station_job_done': {
      const recipeId = c.detail.slice(c.detail.indexOf(':') + 1);
      if (recipeId.startsWith('R:')) {
        const out = RECIPES[recipeId.slice(2)]?.out;
        const station = r.entities[c.subject];
        const inOutput = station?.station && C(r, station.station.outC)?.slots.some(s => s?.key === 'blueprint' && s.meta === recipeId.slice(2));
        return ev(id, 'research', inOutput ? 'BLUEPRINT READY' : 'RESEARCH COMPLETED', name(out), 'blueprint', 66, 3000);
      }
      const recipe = RECIPES[recipeId]; if (!recipe) return null;
      const outs = recipeOutputs(recipe);
      return ev(id, 'forge', 'DONE', outs.map(([k, q]) => `${q} ${name(k)}`).join(' + '), outs[0]?.[0], 58, 2600, outs.map(([key, qty]) => ({ key, qty })));
    }
    case 'hand_craft': {
      const recipe = RECIPES[c.detail]; if (!recipe) return null;
      const outs = recipeOutputs(recipe);
      return ev(id, 'forge', 'CRAFTED', outs.map(([k, q]) => `${q} ${name(k)}`).join(' + '), recipe.out, 48, 2000, outs.map(([key, qty]) => ({ key, qty })));
    }
    case 'job_queued': {
      const recipeId = c.detail.split('@')[0]; const recipe = RECIPES[recipeId];
      return recipe ? ev(id, 'forge', 'JOB RESERVED', name(recipe.out), recipe.out, 37, 1700) : null;
    }
    case 'recipe_learned': {
      const recipe = RECIPES[c.detail]; if (!recipe) return null;
      return ev(id, 'research', 'NEW RECIPE', name(recipe.out), recipe.out, 70, 3200);
    }
    case 'research_started': {
      const [sample, taught] = c.detail.split('->');
      return ev(id, 'research', 'STUDYING', `${name(sample)} → ${name(RECIPES[taught]?.out) || taught}`, sample, 36, 1900);
    }
    case 'structure_built': {
      const [type] = c.detail.split('@');
      return ev(id, 'field', 'BUILT', STRUCTS[type]?.name || type, `st:${type}`, 44, 1800);
    }
    case 'garden_harvested': {
      const crop = c.detail.split(':')[1] as 'crop' | 'herb';
      const out = GARDEN_CROPS[crop]?.output?.[0];
      return ev(id, 'field', 'HARVEST', out ? `${out[1]} ${name(out[0])}` : '', out?.[0], 42, 1900);
    }
    case 'harvested': {
      const src = SOURCES[c.subject]; const y = src?.yields?.[0]?.[0];
      return y ? ev(id, 'field', src.name.toUpperCase(), `+ ${name(y)}`, y, 30, 1300) : null;
    }
    case 'achievement': {
      const a = ACHIEVEMENTS[c.subject]; if (!a) return null;
      const major = ['elder_1', 'six_stones', 'evacuated', 'ragnarok', 'first_deposit', 'vault'].includes(c.subject);
      if (!major) return { ...ev(id, 'field', a.name.toUpperCase(), `+${a.score}`, undefined, 40), accent: EVENT_ACCENT.milestone };
      return ev(id, 'milestone', a.name.toUpperCase(), `+${a.score}`, undefined, 75, 3200);
    }
    case 'cash_secured': return ev(id, 'ledger', 'SECURED', `${c.detail} coins → profile`, 'rcash', 76, 3200);
    case 'freight_paid': return ev(id, 'ledger', 'PARCEL PAID', name(c.subject.split(' ')[0]), c.subject.split(' ')[0], 48, 2000);
    case 'vehicle_mounted': return ev(id, 'field', 'RIDING', 'WASD · F to dismount', undefined, 26, 1400);
    case 'vehicle_exited': return ev(id, 'field', 'DISMOUNTED', '', undefined, 24, 1100);
    case 'vehicle_refueled': return ev(id, 'field', 'REFUELLED', '−1 Fuel Canister', 'fuel_can', 34, 1600);
    case 'vehicle_repaired': return ev(id, 'field', 'REPAIRED', '−1 Parts · −1 Fasteners', 'mechanical_parts', 46, 1900);
    case 'cash_unsealed': return ev(id, 'ledger', 'CACHE OPENED', 'coins are unsecured', 'rcash', 72, 2800);
    case 'airdrop_opened': return ev(id, 'world', 'CRATE OPEN', 'take what you can carry', 'airdrop_open', 56, 2200);
    case 'airdrop_landed': return ev(id, 'world', 'SUPPLY DROP', 'landed · locked for now', 'airdrop_locked', 64, 2800);
    case 'elder_defeated': {
      const elder = ELDERS[c.subject]; if (!elder) return null;
      return ev(id, 'boss', `${elder.name.toUpperCase()} FALLS`, name(elder.stone), elder.stone, 92, 4200);
    }
    case 'tool_broke': return ev(id, 'warning', 'BROKEN', name(c.detail.split(':')[0]), c.detail.split(':')[0], 66, 2400);
    case 'heat_out': return ev(id, 'warning', 'FIRE OUT', 'no fuel', 'coal', 72, 2600);
    case 'station_state_changed': {
      const to = c.detail.split(':')[1]?.split('>')[1];
      const station = r.entities[c.subject]?.station;
      if (!station) return null;
      if (to === 'fuel_out') {
        if (station.burn > 0 || C(r, station.fuelC)?.slots.some(s => s && stationBurnable(s.key))) return null;
        return ev(id, 'warning', 'NO FUEL', 'job paused', 'coal', 64, 2500);
      }
      if (to === 'output_full') {
        const job = station.queue[0], rc = job && RECIPES[job.recipe];
        const hasRoom = rc
          ? rc.outs ? recoveryFits(C(r, station.outC), rc.outs) : spaceFor(r, station.outC, rc.out) >= rc.qty
          : job?.recipe.startsWith('R:') ? spaceFor(r, station.outC, 'blueprint') >= 1
          : C(r, station.outC)?.slots.some(s => !s);
        if (hasRoom) return null;
        return ev(id, 'warning', 'OUTPUT FULL', 'collect to resume', 'gear', 64, 2500);
      }
      return null;
    }
    case 'structure_destroyed': return ev(id, 'warning', 'DESTROYED', STRUCTS[c.subject]?.name || c.subject, 'scrap', 72, 2600);
    case 'territory_collapsed': return ev(id, 'warning', 'COLLAPSED', 'cabinet unfunded', 'st:claim', 78, 3000);
    case 'recycle_finished': return ev(id, 'forge', 'RECYCLED', 'job finished', 'spares', 54, 2300);
    case 'station_upgraded': {
      const kind = c.cause === 'furnace.upgrade' ? 'FURNACE LINED' : c.cause === 'power.upgrade' ? 'GENERATOR REINFORCED' : c.cause === 'cart.upgrade' ? 'CART REINFORCED' : c.cause === 'industrial.install' ? 'POWER MODULE FITTED' : `WORKBENCH LEVEL ${c.detail.split(':')[1] || ''}`.trim();
      const icon = c.cause === 'furnace.upgrade' ? 'st:furnace' : c.cause === 'power.upgrade' ? 'st:base_generator' : c.cause === 'cart.upgrade' ? 'cart_kit' : 'st:workbench';
      return ev(id, 'ceremony', kind, 'new capability unlocked', icon, 88, 2600);
    }
    case 'structure_upgraded': {
      const to = c.detail.split('->')[1];
      return ev(id, 'field', 'UPGRADED', STRUCTS[to]?.name || to || '', to ? `st:${to}` : undefined, 40, 1800);
    }
    case 'item_repaired': return ev(id, 'field', 'REPAIRED', name(c.subject.split(':')[0]) || '', undefined, 36, 1800);
    case 'oil_extracted': return ev(id, 'forge', 'CRUDE', '+1', 'crude_petroleum', 50, 1900);
    default: return null;
  }
}

export function stagedExperience(id: string, kind: ExperienceKind, title: string, detail: string, icon?: string): ExperienceEvent {
  return { id, kind, priority: 50, title, detail, icon, accent: EVENT_ACCENT[kind], duration: 2800, source: 'staged', tier: kind === 'ceremony' ? 'ceremony' : 'stage' };
}

export function experienceForPhase(next: string, runId: string, now: number): ExperienceEvent | null {
  if (next === 'danger') return { id: `${runId}:ragnarok:${now}`, kind: 'world', priority: 100, title: 'RAGNAROK', detail: 'final 72 hours', accent: EVENT_ACCENT.world, duration: 5200, source: 'engine', tier: 'stage' };
  if (next === 'awakening') return { id: `${runId}:elders-awake:${now}`, kind: 'boss', priority: 96, title: 'THE ELDERS WAKE', detail: 'day 14', accent: EVENT_ACCENT.boss, duration: 4600, source: 'engine', tier: 'stage' };
  return null;
}
