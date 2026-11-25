import { TILE, type RunState } from './core';
import { POIS, type GoldPoi } from '../veyra05/reader';
import { isVeyra05Layout } from '../veyra05/scenes';
import { windowOrigin } from '../veyra05/continuity';
import { FRAME_W, FRAME_H } from '../veyra05/frame';

// ---------------------------------------------------------------------------
// ATLAS — the places a traveller can aim for from the first minute.
//
// The chart used to draw only what the player had walked through, so a new run
// opened on a black sheet with nothing to choose. The atlas names every place on
// Veyra from the start: where it is, what kind of place it is, and one line on
// what that kind of place is for. It tells nothing about the inside (containers,
// gates, creatures): that still comes from going there.
//
// Presentation only, like field notes: nothing here is stored in GameState or
// read by the engine. A chosen destination lives in the browser, per run.
// ---------------------------------------------------------------------------

export type PlaceGroup = 'settlement' | 'harbour' | 'works' | 'science' | 'ruin' | 'wild' | 'road' | 'primordial' | 'trade' | 'cache';

export interface PlaceKind { group: PlaceGroup; label: string; blurb: string }

/** One entry per archetype in the Veyra canon. The blurb says what the place is, never what it holds. */
export const PLACE_KINDS: Record<string, PlaceKind> = {
  village:        { group: 'settlement', label: 'Village',          blurb: 'A cluster of homes with small stores, where goods change hands.' },
  hamlet:         { group: 'settlement', label: 'Homestead',        blurb: 'A lone house or two, near water or a road.' },
  port:           { group: 'harbour',    label: 'Port',             blurb: 'Where the roads meet the sea lanes to the outer isles.' },
  pier:           { group: 'harbour',    label: 'Pier',             blurb: 'A landing for small boats.' },
  evac:           { group: 'harbour',    label: 'Evacuation point', blurb: 'The way off the island. Leaving ends the run.' },
  roadstop:       { group: 'road',       label: 'Waystation',       blurb: 'A stop along the road, with scrap bins and tools.' },
  quarry:         { group: 'works',      label: 'Quarry',           blurb: 'Stone is cut here.' },
  mine:           { group: 'works',      label: 'Mine',             blurb: 'Ore diggings with deep tunnels.' },
  sawmill:        { group: 'works',      label: 'Sawmill',          blurb: 'Timber is worked here.' },
  smelter:        { group: 'works',      label: 'Smelter',          blurb: 'Ore is smelted here.' },
  mill:           { group: 'works',      label: 'Mill',             blurb: 'A water mill for grain.' },
  warehouse:      { group: 'works',      label: 'Depot',            blurb: 'Storage between the mines, the works and the docks.' },
  powerplant:     { group: 'works',      label: 'Power station',    blurb: 'Makes power for the deep facilities.' },
  filter:         { group: 'works',      label: 'Water works',      blurb: 'Filters and drains the low ground.' },
  research:       { group: 'science',    label: 'Research site',    blurb: 'Laboratories on several floors. The outer rooms are open; the core is locked.' },
  facility:       { group: 'science',    label: 'Facility',         blurb: 'A works on several floors. Parts of it are locked.' },
  observatory:    { group: 'science',    label: 'Lookout',          blurb: 'A high point with a long view.' },
  grove:          { group: 'wild',       label: 'Foraging ground',  blurb: 'A place to gather from the wild.' },
  ruins:          { group: 'ruin',       label: 'Ruins',            blurb: 'Old ruins with cellars below.' },
  tomb:           { group: 'ruin',       label: 'Tombs',            blurb: 'Ancient burial vaults.' },
  elder_site:     { group: 'primordial', label: 'Primordial ground', blurb: 'A Primordial holds this place. Come ready to fight.' },
  gate:           { group: 'primordial', label: 'Threshold',        blurb: 'A gate into another space of this world, with a way back.' },
  chest_vendor:   { group: 'trade',      label: 'Trading house',    blurb: 'A trader sells from this counter.' },
  ragnarok_cache: { group: 'cache',      label: 'Strongbox',        blurb: 'Cash put away for the last hours.' },
};
const UNKNOWN_KIND: PlaceKind = { group: 'road', label: 'Landmark', blurb: 'A named place on the old chart.' };

export const GROUP_COLOR: Record<PlaceGroup, string> = {
  settlement: '#f4d089', harbour: '#7fd8ff', works: '#d9a25f', science: '#c3b0ff', ruin: '#c4c2b0',
  wild: '#9ad07a', road: '#d8c9a4', primordial: '#ff7c66', trade: '#ffe08a', cache: '#ffe08a',
};

/** Archetypes that stay off the chart until the player has found the place: the Ragnarok strongboxes are meant to be hunted. */
const SECRET_ARCHES = new Set(['ragnarok_cache']);

export interface AtlasPlace {
  id: string; name: string; arche: string; kind: PlaceKind;
  /** Global tile position on the 4000 x 2800 continent frame. */
  gtx: number; gty: number;
  visited: boolean;
}

/** Canon names carry design tags such as " [ĐỀ XUẤT]"; the chart shows the name only. */
export const placeName = (po: Pick<GoldPoi, 'name'>): string => po.name.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();

const toPlace = (po: GoldPoi, visited: boolean): AtlasPlace => ({
  id: po.id, name: placeName(po), arche: po.arche, kind: PLACE_KINDS[po.arche] ?? UNKNOWN_KIND,
  gtx: po.at[0] * 2, gty: po.at[1] * 2, visited,
});

/** Every place the chart may show for this run: all of them, except secret ones not found yet. Empty off Veyra. */
export function atlasPlaces(r: RunState): AtlasPlace[] {
  if (!r.layoutId || !isVeyra05Layout(r.layoutId)) return [];
  const seen = new Set(r.poiSeen);
  const out: AtlasPlace[] = [];
  for (const po of POIS) {
    const visited = seen.has(po.id);
    if (!visited && SECRET_ARCHES.has(po.arche)) continue;
    out.push(toPlace(po, visited));
  }
  return out;
}

const POI_BY_ID = new Map<string, GoldPoi>(POIS.map(po => [po.id, po]));
/** One place by id, under the same rules as atlasPlaces (called every HUD frame, so no list is built). */
export function atlasPlace(r: RunState, id: string | null | undefined): AtlasPlace | null {
  if (!id || !r.layoutId || !isVeyra05Layout(r.layoutId)) return null;
  const po = POI_BY_ID.get(id);
  if (!po) return null;
  const visited = r.poiSeen.includes(id);
  if (!visited && SECRET_ARCHES.has(po.arche)) return null;
  return toPlace(po, visited);
}

/** The player's position in global tiles (fractional). */
export function playerGlobalTile(r: RunState): [number, number] {
  const [ox, oy] = windowOrigin(r);
  return [ox + r.player.x / TILE, oy + r.player.y / TILE];
}

/** Direction as a screen angle in radians (0 = east, a quarter turn = south): the UI draws an arrow turned by it.
 *  Letters are avoided on purpose: in Vietnamese N reads as Nam, south. */
export const bearing = (dx: number, dy: number): number => Math.atan2(dy, dx);

/** One tile reads as one metre everywhere on the HUD. */
export function formatDistance(tiles: number): string {
  const d = Math.max(0, tiles);
  if (d < 1000) return `${Math.round(d)} m`;
  return `${(Math.round(d / 100) / 10).toFixed(1)} km`;
}

export interface PlaceRange { place: AtlasPlace; dist: number; bearing: number }
/** Places ordered by walking-crow distance from the player. */
export function placesByDistance(r: RunState, places: AtlasPlace[] = atlasPlaces(r)): PlaceRange[] {
  const [px, py] = playerGlobalTile(r);
  return places
    .map(place => ({ place, dist: Math.hypot(place.gtx - px, place.gty - py), bearing: bearing(place.gtx - px, place.gty - py) }))
    .sort((a, b) => a.dist - b.dist || (a.place.id < b.place.id ? -1 : 1));
}

/** The place whose mark is nearest to a point on the continent frame, within `reach` tiles. */
export function placeNear(places: AtlasPlace[], gtx: number, gty: number, reach: number): AtlasPlace | null {
  let best: AtlasPlace | null = null; let bd = reach;
  for (const p of places) { const d = Math.hypot(p.gtx - gtx, p.gty - gty); if (d <= bd) { bd = d; best = p; } }
  return best;
}

// ---------------------------------------------------------------------------
// DESTINATION — one place the player has chosen to walk to.
// ---------------------------------------------------------------------------
/** Within this many tiles the player has arrived and the marker is put away. */
export const ARRIVE_TILES = 12;

const destKey = (r: RunState) => `soh.map-dest.v1:${r.id}:${r.sourceMap?.id ?? r.layoutId ?? 'shipping'}`;
const memory = new Map<string, string | null>();

/** The chosen destination's place id, or null. A stored id the chart no longer shows is ignored. */
export function readDestination(r: RunState, qaSession: boolean): string | null {
  const k = destKey(r);
  if (!memory.has(k)) {
    let id: string | null = null;
    if (!qaSession) { try { const raw = localStorage.getItem(k); id = raw && /^[a-z0-9_]{3,40}$/.test(raw) ? raw : null; } catch { id = null; } }
    memory.set(k, id);
  }
  const id = memory.get(k) ?? null;
  return id && atlasPlace(r, id) ? id : null;
}

/** Choose a destination (or clear it with null). QA sessions keep it in memory only. Returns what is now set. */
export function storeDestination(r: RunState, qaSession: boolean, id: string | null): string | null {
  const next = id && atlasPlace(r, id) ? id : null;
  const k = destKey(r);
  memory.set(k, next);
  if (!qaSession) { try { if (next) localStorage.setItem(k, next); else localStorage.removeItem(k); } catch { /* memory still holds it for this session */ } }
  return next;
}

export interface DestinationView {
  place: AtlasPlace;
  /** Position in the active window's pixel space; may lie far outside the window. */
  x: number; y: number;
  /** Straight-line distance in tiles. */
  dist: number; bearing: number;
  arrived: boolean;
}

export function destinationView(r: RunState, qaSession: boolean): DestinationView | null {
  const place = atlasPlace(r, readDestination(r, qaSession));
  if (!place) return null;
  const [ox, oy] = windowOrigin(r);
  const [px, py] = playerGlobalTile(r);
  const dist = Math.hypot(place.gtx - px, place.gty - py);
  return {
    place, x: (place.gtx - ox) * TILE + TILE / 2, y: (place.gty - oy) * TILE + TILE / 2,
    dist, bearing: bearing(place.gtx - px, place.gty - py), arrived: dist <= ARRIVE_TILES,
  };
}

/** Test seam: forget destinations held in memory. */
export function __resetDestinationMemory() { memory.clear(); }

export const ATLAS_FRAME = { w: FRAME_W, h: FRAME_H } as const;
