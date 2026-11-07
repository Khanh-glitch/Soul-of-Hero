/** Expedition intel: bounded, physically observed facts remembered per run. No POI spoilers. */
import type { RunState } from './core';
import { ITEMS, RECIPES, isRecipeKnown } from './catalog';
import { getWorld } from './world';

export const MAX_INTEL = 160;
/** gate:<place>:power | gate:<place>:keycard_<class> | gen:<place> | opened:<place> | loot:<place>:<item|bp_recipe> */
const KEY = /^(gate:[a-z0-9]+:(power|keycard_[a-z]+)|gen:[a-z0-9]+|opened:[a-z0-9]+|loot:[a-z0-9]+:(bp_[a-z0-9_]+|[a-z0-9_]+))$/;

export function validIntel(v: unknown): v is string[] {
  return Array.isArray(v) && v.length <= MAX_INTEL && v.every(k => typeof k === 'string' && KEY.test(k)) && new Set(v).size === v.length;
}

/** Maps a static's POI tag (e.g. factory_vault, light_top) to its place id. */
export function placeOfPoi(r: RunState, poi?: string): string | undefined {
  if (!poi) return;
  const places = getWorld(r.layoutId || 'shipping').places;
  return places.find(p => poi === p.id || poi.startsWith(p.id + '_'))?.id;
}

export function recordIntel(r: RunState, keys: string[]): boolean {
  const list = (r.intel ??= []);
  let changed = false;
  for (const k of keys) {
    if (!KEY.test(k) || list.includes(k)) continue;
    if (list.length >= MAX_INTEL) break;
    list.push(k); changed = true;
  }
  return changed;
}

export function gateKey(place: string, requirement: 'power' | 'keycard', cardClass = 'vault'): string {
  return requirement === 'power' ? `gate:${place}:power` : `gate:${place}:keycard_${cardClass}`;
}

/** Physically carried items that satisfy a gate requirement. */
function carries(r: RunState, item: 'fuel_can' | 'keycard', cardClass = 'vault'): boolean {
  const slots = r.custody.inv?.slots ?? [];
  return slots.some(s => !!s && s.key === item && (item !== 'keycard' || ((s.meta ?? 'vault') === cardClass && (s.charge === undefined || s.charge > 0))));
}

export interface GateNote { requirement: 'power' | 'keycard'; cardClass?: string; item: 'fuel_can' | 'keycard'; carried: boolean; sources: string[]; craft?: string }
export interface PlaceNote { place: string; name: string; gates: GateNote[]; blueprints: { recipe: string; name: string; learned: boolean }[]; generatorSeen: boolean }

/** Read-only expedition summary for the map: what the player has actually observed, against live inventory and known recipes. */
export function expeditionNotes(r: RunState): PlaceNote[] {
  const intel = r.intel ?? [];
  if (!intel.length) return [];
  const w = getWorld(r.layoutId || 'shipping');
  const places = [...new Set(intel.map(k => k.split(':')[1]))];
  const sourcesOf = (item: string) => [...new Set(intel.filter(k => k.endsWith(`:${item}`) && k.startsWith('loot:')).map(k => k.split(':')[1]))];
  const out: PlaceNote[] = [];
  for (const place of places) {
    const name = w.places.find(p => p.id === place)?.name ?? place;
    const gates: GateNote[] = [];
    for (const k of intel) {
      if (!k.startsWith(`gate:${place}:`)) continue;
      const req = k.slice(`gate:${place}:`.length);
      if (req === 'power') {
        const craftRecipe = RECIPES.fuel_can;
        gates.push({ requirement: 'power', item: 'fuel_can', carried: carries(r, 'fuel_can'), sources: sourcesOf('fuel_can'), craft: craftRecipe && isRecipeKnown(r.knowledge.recipes, 'fuel_can') ? `Workbench L${craftRecipe.stationLevel ?? 1}` : undefined });
      } else {
        const cardClass = req.slice('keycard_'.length);
        gates.push({ requirement: 'keycard', cardClass, item: 'keycard', carried: carries(r, 'keycard', cardClass), sources: sourcesOf('keycard') });
      }
    }
    const blueprints = intel.filter(k => k.startsWith(`loot:${place}:bp_`)).map(k => {
      const recipe = k.slice(`loot:${place}:bp_`.length);
      return { recipe, name: ITEMS[RECIPES[recipe]?.out ?? '']?.name ?? recipe.replace(/_/g, ' '), learned: isRecipeKnown(r.knowledge.recipes, recipe) };
    });
    out.push({ place, name, gates, blueprints, generatorSeen: intel.includes(`gen:${place}`) });
  }
  return out;
}
