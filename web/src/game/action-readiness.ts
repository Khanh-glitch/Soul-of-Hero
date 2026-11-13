// Read-only presentation projection. The engine remains the sole authority for
// costs, reach, reservation and completion. Never use this to commit a job.
import { BAL, TILE, type Entity, type RunState } from './core';
import { ITEMS, RECIPES, STRUCTS, isRecipeKnown, requiredStationLevel, stationBurnable } from './catalog';
import { C, anyAuthorizedOilSource, authorizedOilSource, clearInteraction, clearWallLine, countItem, phaseOf, spaceFor } from './engine';
import { recoveryFits } from './recycler';

export type ReadinessState = 'ready' | 'waiting' | 'blocked';
export type ReadinessCode = 'unknown' | 'dead' | 'resting' | 'expired' | 'busy' | 'materials' |
  'pack' | 'station' | 'level' | 'oil' | 'queue' | 'output' | 'fuel' | 'queued';

export interface CraftReadiness {
  state: ReadinessState;
  /** True if the engine may accept a queue/craft intent now; waiting jobs are explicitly marked. */
  canSubmit: boolean;
  /** True if a new job can begin working, not merely be reserved in a queue. */
  canWork: boolean;
  code: ReadinessCode;
  short: string;
  next: string;
  station: Entity | null;
  ingredients: { key: string; have: number; need: number }[];
  fuel: 'not-needed' | 'burning' | 'stocked' | 'empty';
  output: 'space' | 'full';
  queue: number;
  level: number;
}

const missingLabel = (key: string, have: number, need: number) => `Get ${need - have} ${ITEMS[key]?.name ?? key}`;

/** Select a physically reachable owned station. Pass the returned entity ID to craft, never rely on engine's first-match fallback. */
export function reachableStations(r: RunState, kind: string): Entity[] {
  return Object.values(r.entities).filter(e =>
    e.kind === 'struct' && !!e.station && STRUCTS[e.type ?? '']?.station === kind &&
    (e.owner === undefined || e.owner === 'player') && (e.hp ?? 1) > 0 &&
    Math.hypot(e.x - r.player.x, e.y - r.player.y) <= 3 * TILE &&
    clearWallLine(r, r.player, e)
  );
}

function fuelState(r: RunState, e: Entity | null, kind?: string | null): CraftReadiness['fuel'] {
  if (!kind || !['campfire', 'furnace', 'refinery', 'oil_pump'].includes(kind)) return 'not-needed';
  if (!e?.station) return 'empty';
  if (e.station.burn > 0) return 'burning';
  return C(r, e.station.fuelC).slots.some(s => s && stationBurnable(s.key)) ? 'stocked' : 'empty';
}

function outputState(r: RunState, e: Entity | null, rc: typeof RECIPES[string]): CraftReadiness['output'] {
  if (!e?.station) return 'space';
  if (rc.outs) return recoveryFits(C(r, e.station.outC), rc.outs) ? 'space' : 'full';
  return spaceFor(r, e.station.outC, rc.out) >= rc.qty ? 'space' : 'full';
}

/** Engine-aligned availability for a known recipe. `preferredEid` keeps StationConsole tied to its actual machine. */
export function craftReadiness(r: RunState, key: string, now: number, preferredEid?: string): CraftReadiness {
  const rc = RECIPES[key];
  const ingredients = rc?.ins.filter(([, qty]) => qty > 0).map(([item, need]) => ({ key: item, need, have: countItem(r, 'inv', item) })) ?? [];
  const stations = rc?.station ? (preferredEid ? reachableStations(r, rc.station).filter(e => e.id === preferredEid) : reachableStations(r, rc.station)) : [];
  // Prefer a capable machine with room/fuel; this ID is the same one the button submits.
  stations.sort((a, b) => {
    const score = (e: Entity) =>
      Number((e.station?.level ?? 1) >= requiredStationLevel(rc)) * 8 +
      Number((e.station?.queue.length ?? 6) < 6) * 4 +
      Number(outputState(r, e, rc) === 'space') * 2 +
      Number(fuelState(r, e, rc.station) !== 'empty');
    return score(b) - score(a) || Math.hypot(a.x - r.player.x, a.y - r.player.y) - Math.hypot(b.x - r.player.x, b.y - r.player.y);
  });
  const station = stations[0] ?? null;
  const fuel = fuelState(r, station, rc?.station);
  const output = rc ? outputState(r, station, rc) : 'space';
  const queue = station?.station?.queue.length ?? 0;
  const level = station?.station?.level ?? 1;
  const base = { station, ingredients, fuel, output, queue, level };
  const state = (code: ReadinessCode, short: string, next: string, kind: ReadinessState = 'blocked', canSubmit = false): CraftReadiness =>
    ({ ...base, state: kind, canSubmit, canWork: kind === 'ready', code, short, next });

  if (!rc || !isRecipeKnown(r.knowledge.recipes, key)) return state('unknown', 'Undiscovered', 'Find or study the recipe');
  if (r.player.dead) return state('dead', 'Fallen', 'Rise again first');
  if (r.rest) return state('resting', 'Resting', 'Wake before working');
  if ((now - r.startedAt + r.qaOffset) / 3600000 >= BAL.run.maxRunHours || phaseOf(r, now) === 'expired')
    return state('expired', 'Run ended', 'Begin a new run');
  const active = r.player.action?.slot !== undefined && r.player.action.slot >= 0 ? C(r, 'inv').slots[r.player.action.slot] : null;
  if (active && ingredients.some(i => i.key === active.key)) return state('busy', 'Item in use', 'Finish the current action');
  const lacking = ingredients.find(i => i.have < i.need);
  if (lacking) return state('materials', 'Needs materials', missingLabel(lacking.key, lacking.have, lacking.need));
  if (!rc.station) {
    const freesSlot = ingredients.some(i => i.have === i.need);
    if (spaceFor(r, 'inv', rc.out) < rc.qty && !freesSlot) return state('pack', 'Pack full', 'Move or drop an item');
    return state('unknown', 'Make now', 'Craft from your pack', 'ready', true);
  }
  if (!station) return state('station', 'No station nearby', `Reach a ${STRUCTS[rc.station].name}`);
  if (key === 'recover_drive' && !clearInteraction(r, station)) return state('station', 'Access blocked', 'Stand beside the Workbench');
  if (level < requiredStationLevel(rc)) return state('level', `Needs L${requiredStationLevel(rc)}`, `Upgrade ${STRUCTS[rc.station].name}`);
  if (rc.station === 'oil_pump' && !authorizedOilSource(r, station.tx!, station.ty!)) return state('oil', 'Source dry', 'Find an authorized oil source');
  if (queue >= 6) return state('queue', 'Queue full', 'Wait or cancel a job');
  // Multi-output bundles are rejected at queue time by the engine; single outputs can queue but will pause at completion.
  if (rc.outs && output === 'full') return state('output', 'Output full', 'Collect station output');
  if (fuel === 'empty') return state('fuel', 'Will pause · no fuel', 'Add burnable fuel to this station', 'waiting', true);
  if (output === 'full') return state('output', 'Will pause · output full', 'Collect station output', 'waiting', true);
  if (queue > 0) return state('queued', `${queue} job${queue > 1 ? 's' : ''} ahead`, 'Wait for the existing queue', 'waiting', true);
  return state('unknown', 'Work now', 'Reserve inputs and start work', 'ready', true);
}

export interface StructurePreparation {
  materials: boolean;
  missing: { key: string; have: number; need: number }[];
  sourceBlocked: boolean;
  next: string;
  /** Present for a crafted device: what the placement actually consumes is the PACK. */
  pack?: { key: string; name: string; carried: number; intact: boolean; craftCost: [string, number][] };
}

/** A structure cannot claim "build ready" until the player has selected a legal tile.
 *
 * PA1 device custody: a device that owns a packed item is placed BY SPENDING THAT ITEM, never by
 * paying its raw material list a second time. If this projection reported the raw list as
 * "prepared", the Deploy screen would promise a placement the engine then refuses with
 * "No valid packed device in inventory." — so the pack, not the ore, is the readiness authority. */
export function structurePreparation(r: RunState, type: string): StructurePreparation {
  const d = STRUCTS[type];
  const missing = d?.cost.filter(([k, q]) => countItem(r, 'inv', k) < q).map(([k, q]) => ({ key: k, have: countItem(r, 'inv', k), need: q })) ?? [];
  const sourceBlocked = type === 'oil_pump' && !anyAuthorizedOilSource(r);
  if (d?.item) {
    const packKey = d.item;
    const carried = (C(r, 'inv').slots.filter(s => s?.key === packKey));
    const hpOf = ITEMS[packKey]?.dur;
    const intact = carried.some(s => s && s.qty === 1 && (!hpOf || (Number.isFinite(s.dur) && (s.dur as number) > 0 && (s.dur as number) <= d.hp)));
    const next = sourceBlocked ? 'No authorized oil site on this map'
      : intact ? 'Placement spends the packed device, not its materials — choose a legal site'
      : carried.length ? `The packed ${d.name} is damaged — repair it before placing`
      : `Craft the packed ${d.name} first${missing.length ? ' · ' + missingLabel(missing[0].key, missing[0].have, missing[0].need) : ''}`;
    return { materials: !sourceBlocked && intact, missing, sourceBlocked, next,
      pack: { key: packKey, name: d.name, carried: carried.length, intact, craftCost: d.cost } };
  }
  return { materials: missing.length === 0, missing, sourceBlocked, next: sourceBlocked ? 'No authorized oil site on this map' : missing.length ? missingLabel(missing[0].key, missing[0].have, missing[0].need) : 'Materials ready · choose a legal site' };
}