/** Expedition intel: bounded, physically observed facts remembered per run. No POI spoilers, no hidden stock. */
import type { RunState } from './core';
import { ITEMS, RECIPES, STRUCTS, isRecipeKnown } from './catalog';
import { getWorld } from './world';

export const MAX_INTEL = 160;
export const MAX_INTEL_KEY = 64;
/** gate:<place>:power | gate:<place>:keycard_<class> | gen:<place> | opened:<place> | loot:<place>:<item|bp_recipe> */
const KEY = /^(gate:[a-z0-9]{1,24}:(power|keycard_[a-z]{1,16})|gen:[a-z0-9]{1,24}|opened:[a-z0-9]{1,24}|loot:[a-z0-9]{1,24}:(bp_[a-z0-9_]{1,36}|[a-z0-9_]{1,24}))$/;

export function validIntelKey(k: unknown): k is string {
  return typeof k === 'string' && k.length <= MAX_INTEL_KEY && KEY.test(k);
}
export function validIntel(v: unknown): v is string[] {
  return Array.isArray(v) && v.length <= MAX_INTEL && v.every(validIntelKey) && new Set(v).size === v.length;
}

/** Maps a static's POI tag (e.g. factory_vault, light_top) to its place id. */
export function placeOfPoi(r: RunState, poi?: string): string | undefined {
  if (!poi) return;
  return getWorld(r.layoutId || 'shipping').places.find(p => poi === p.id || poi.startsWith(p.id + '_'))?.id;
}

/** Adds only new valid keys; returns whether anything changed. */
export function recordIntel(r: RunState, keys: string[]): boolean {
  const list = (r.intel ??= []);
  let changed = false;
  for (const k of keys) {
    if (!validIntelKey(k) || list.includes(k)) continue;
    if (list.length >= MAX_INTEL) break;
    list.push(k); changed = true;
  }
  return changed;
}

export function gateKey(place: string, requirement: 'power' | 'keycard', cardClass = 'vault'): string {
  return requirement === 'power' ? `gate:${place}:power` : `gate:${place}:keycard_${cardClass}`;
}

/** Live carried quantity from the physical inventory only. */
function carriedCount(r: RunState, key: string, cardClass?: string): number {
  return (r.custody.inv?.slots ?? []).reduce((n, s) => {
    if (!s || s.key !== key) return n;
    if (key === 'keycard') return n + ((s.meta ?? 'vault') === cardClass && (s.charge === undefined || s.charge > 0) ? 1 : 0);
    return n + s.qty;
  }, 0);
}

export interface Ingredient { key: string; name: string; have: number; need: number }
export interface CraftNote { recipe: string; station: string; stationName: string; level: number; ingredients: Ingredient[]; missing: Ingredient[] }
export interface GateNote {
  requirement: 'power' | 'keycard'; cardClass?: string; item: 'fuel_can' | 'keycard';
  have: number; need: number; carried: boolean;
  /** Places where this item was physically seen in an opened container (historical, not current stock). */
  seenIn: string[];
  /** Legitimate known recipe, or undefined when the item has no recipe (keycards). */
  craft?: CraftNote;
}
export type BlueprintState = 'seen' | 'owned' | 'learned';
export interface BlueprintNote { recipe: string; name: string; state: BlueprintState }
export interface PlaceNote { place: string; name: string; gates: GateNote[]; blueprints: BlueprintNote[]; generatorSeen: boolean }

/** Read-only summary: observed facts joined with live inventory and known recipes. */
export function expeditionNotes(r: RunState): PlaceNote[] {
  const intel = r.intel ?? [];
  if (!intel.length) return [];
  const w = getWorld(r.layoutId || 'shipping');
  const places = [...new Set(intel.map(k => k.split(':')[1]))];
  const seenIn = (item: string) => [...new Set(intel.filter(k => k.startsWith('loot:') && k.endsWith(`:${item}`)).map(k => k.split(':')[1]))];
  const out: PlaceNote[] = [];
  for (const place of places) {
    const name = w.places.find(p => p.id === place)?.name ?? place;
    const gates: GateNote[] = [];
    for (const k of intel) {
      if (!k.startsWith(`gate:${place}:`)) continue;
      const req = k.slice(`gate:${place}:`.length);
      if (req === 'power') {
        const rc = RECIPES.fuel_can;
        const ingredients = rc.ins.map(([key, need]) => ({ key, name: ITEMS[key].name, have: carriedCount(r, key), need }));
        const craft: CraftNote | undefined = isRecipeKnown(r.knowledge.recipes, 'fuel_can') && rc.station ? {
          recipe: 'fuel_can', station: rc.station, stationName: STRUCTS[rc.station]?.name ?? rc.station, level: rc.stationLevel ?? 1,
          ingredients, missing: ingredients.filter(i => i.have < i.need),
        } : undefined;
        const have = carriedCount(r, 'fuel_can');
        gates.push({ requirement: 'power', item: 'fuel_can', have, need: 1, carried: have >= 1, seenIn: seenIn('fuel_can'), craft });
      } else {
        const cardClass = req.slice('keycard_'.length);
        const have = carriedCount(r, 'keycard', cardClass);
        gates.push({ requirement: 'keycard', cardClass, item: 'keycard', have, need: 1, carried: have >= 1, seenIn: seenIn('keycard') });
      }
    }
    const blueprints: BlueprintNote[] = intel.filter(k => k.startsWith(`loot:${place}:bp_`)).map(k => {
      const recipe = k.slice(`loot:${place}:bp_`.length);
      const owned = (r.custody.inv?.slots ?? []).some(s => !!s && s.key === 'blueprint' && s.meta === recipe);
      const state: BlueprintState = isRecipeKnown(r.knowledge.recipes, recipe) ? 'learned' : owned ? 'owned' : 'seen';
      return { recipe, name: ITEMS[RECIPES[recipe]?.out ?? '']?.name ?? recipe.replace(/_/g, ' '), state };
    });
    // Loot sightings alone are not preparation: a place appears only once a gate or blueprint is actionable.
    if (!gates.length && !blueprints.length) continue;
    out.push({ place, name, gates, blueprints, generatorSeen: intel.includes(`gen:${place}`) });
  }
  return out;
}
