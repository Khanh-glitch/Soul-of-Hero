// ============================================================================
// SFX director: turns the state of the running game into sound.
//
// It READS the run and never writes to it, and it draws its random numbers from
// Math.random, never from the run's seeded generator, so a game played with the
// sound on and one played with it off stay identical.
//
//   routeContext(gs)   read-only lookups the router needs
//   receiptSounds(...) one pass over receipts written since the last frame
//   watchSecond(...)   once a second: background layers, machine and fire loops, body warnings, wildlife
//   watchFast(...)     ten times a second: engine, cart, heartbeat (they follow speed and health closely)
// ============================================================================
import { BAL, T, TILE, WW, type RunState, type Entity } from '../core';
import { ITEMS, STRUCTS } from '../catalog';
import { getWorld } from '../world';
import { C, dayTime, effTile, entsAt, isRagnarok, phaseOf, weatherAt, workLightPowered } from '../engine';
import { activeFloor } from '../../veyra05/floors';
import { humanWorldPosition, playerAtSea } from '../humanworld';
import { isVeyra05Layout } from '../../veyra05/scenes';
import { windowOrigin } from '../../veyra05/continuity';
import { loopLevel, machineState, play, playAll, setBeds, setEnvironment, setMood, slotStatus, stopLoops, sweepLoops } from '../audio';
import { creatureSlot, receiptHasRoute, receiptRoute, type ItemClass, type RouteCtx } from './route';

// --- item and structure families (by name: the catalog has no "material" field) ---------------------------------
const LIQUID = /canteen|flask|water|broth|juice|petroleum|fuel|oil|lubric|tonic|brew/;
const METAL = /ingot|iron|steel|scrap|plate|nail|wire|gear|part|blade|sword|knife|cleaver|machete|axe|pick|hammer|can$|canned|cell|card|coin|key|trap|turret|generator|pump|bolt|spring|pipe|engine|chain|lock|nodachi|trident|lantern/;
const WOOD = /wood|plank|log|stick|bow|arrow|spear|torch|ladder|charcoal|barrel|chest|crate/;
const STONE = /stone|rock|ore|coal|flint|salt|clay|sulfur|crystal|shard|brick|glass|sand/;
const CLOTH = /fiber|cloth|hide|leather|rope|bandage|canvas|pelt|fur|wool|feather|thatch|straw|sack|bag|pack/;
const itemClassCache = new Map<string, ItemClass | null>();
export function itemClass(key: string): ItemClass | null {
  if (itemClassCache.has(key)) return itemClassCache.get(key)!;
  const d = ITEMS[key];
  const cls: ItemClass | null = !d ? null
    : d.cat === 'core' ? 'core'
      : LIQUID.test(key) ? 'liquid'
        : d.cat === 'food' ? (/syringe|bandage|medkit|salve|poultice/.test(key) ? 'cloth' : 'food')
          : d.cat === 'armor' ? 'cloth'
            : METAL.test(key) ? 'metal' : WOOD.test(key) ? 'wood' : STONE.test(key) || d.cat === 'stone' ? 'stone' : CLOTH.test(key) ? 'cloth' : null;
  itemClassCache.set(key, cls); return cls;
}
export function consumeKind(key: string): 'eat' | 'drink' | 'heal' {
  const f = (ITEMS[key] as any)?.food as Record<string, number> | undefined;
  if (!f) return 'eat';
  if (!f.hunger && f.thirst) return 'drink';
  if (!f.hunger && f.hp) return 'heal';
  return LIQUID.test(key) ? 'drink' : 'eat';
}
export function structMaterial(type: string): 'wood' | 'stone' | 'metal' | 'soft' | 'wire' {
  if (/cable|switch|sensor/.test(type)) return 'wire';
  if (/thatch|straw|garden|trough|bed_/.test(type)) return 'soft';
  if (/stone|tile|furnace|campfire/.test(type)) return 'stone';
  if (/iron|steel|generator|turret|trap|pump|refinery|powered|escrow|recycler/.test(type)) return 'metal';
  return 'wood';
}
const floorMaterial = (type: string | undefined): string | null => (!type ? null : /stone|tile/.test(type) ? 'stone' : /iron|steel|metal/.test(type) ? 'metal' : 'wood');

export function routeContext(get: () => RunState | null | undefined): RouteCtx {
  return {
    creatureNear(x, y) {
      const r = get(); if (!r) return null;
      let best: RunState['creatures'][number] | null = null, bd = 34 * 34;
      for (const m of r.creatures) { const d = (m.x - x) * (m.x - x) + (m.y - y) * (m.y - y); if (d < bd) { bd = d; best = m; } }
      return best ? { type: best.type, elder: best.elder?.key, boss: !!best.sideBoss } : null;
    },
    heldKey() { const r = get(); return r ? C(r, 'inv').slots[r.player.active]?.key ?? null : null; },
    floorAt(x, y) {
      const r = get(); if (!r) return null;
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      for (const e of entsAt(r, tx, ty)) if (e.kind === 'struct' && STRUCTS[e.type!]?.layer === 'floor') return floorMaterial(e.type);
      const t = effTile(r, tx, ty);
      return t === T.BRIDGE ? 'wood' : t === T.FLOOR && getWorld().zone[ty * WW + tx] === 7 ? 'metal' : null;
    },
    itemClass, consumeKind, structMaterial,
    entity(id) { const e = get()?.entities[id]; return e ? { type: e.type, kind: e.kind, x: e.x, y: e.y } : null; },
    human(id) {
      const r = get(); const h = r?.humanWorld?.people[id]; if (!r || !h || h.floor !== activeFloor(r)) return null;
      const [ox, oy] = isVeyra05Layout(r.layoutId || '') ? windowOrigin(r) : [0, 0];
      const pos = humanWorldPosition(h); return { x: (pos.gx - ox) * TILE, y: (pos.gy - oy) * TILE };
    },
    player() { const r = get(); return r ? { x: r.player.x, y: r.player.y, character: r.character === 'female' ? 'female' : 'male' } : { x: 0, y: 0, character: 'male' }; },
  };
}

// --- receipts -----------------------------------------------------------------------------------------------------
/** Plays the sound of every routed receipt after `afterSeq`; returns the new cursor. A flood (returning from a long
 *  absence, a bulk action) is not replayed: only the latest few speak. */
export function receiptSounds(r: RunState, afterSeq: number, ctx: RouteCtx, skip?: ReadonlySet<string>): number {
  const list = r.receipts; const last = list.at(-1)?.seq ?? afterSeq;
  if (last <= afterSeq) return afterSeq;
  let from = list.length; while (from > 0 && list[from - 1].seq > afterSeq) from--;
  const fresh = list.length - from;
  for (let i = Math.max(from, list.length - 8); i < list.length; i++) {
    const rc = list[i];
    if (skip?.has(rc.id) || !receiptHasRoute(rc.kind)) continue;
    const plays = receiptRoute(rc.kind, String(rc.detail ?? ''), ctx);
    playAll(fresh > 8 ? plays.map(p => ({ ...p, gain: (p.gain ?? 1) * 0.7 })) : plays);
  }
  return last;
}

// --- once a second ---------------------------------------------------------------------------------------------------
export interface WatchState {
  runId: string; primed: boolean;
  night: boolean; rag: boolean; low: Record<string, boolean>; at: Record<string, number>;
  nextAmb: number; nextVoice: number; idleMs: number; biome: string; biomeAt: number; active: number;
}
export const newWatch = (): WatchState => ({ runId: '', primed: false, night: false, rag: false, low: {}, at: {}, nextAmb: 0, nextVoice: 0, idleMs: 0, biome: 'meadow', biomeAt: 0, active: -1 });

export type Biome = 'meadow' | 'forest' | 'marsh' | 'snow' | 'ash' | 'ruins';
export function biomeOf(zone: number, tile: number): Biome {
  if (zone === 5 || tile === T.SNOW || tile === T.ICE) return 'snow';
  if (zone === 7 || tile === T.TOXIC) return 'ruins';
  if (zone === 6 || tile === T.ASH || tile === T.LAVA || tile === T.BURNT) return 'ash';
  if (zone === 8 || tile === T.MARSH) return 'marsh';
  if (tile === T.FOREST) return 'forest';
  return 'meadow';
}
/** Levels 0..1 of every background layer for a situation. Pure, so the mix can be tested without an audio device. */
export function bedLevels(s: { biome: Biome; night: boolean; indoors: boolean; atSea: boolean; rain: number; wind: number; coast: number; rag: boolean; danger: boolean }): Record<string, number> {
  const out: Record<string, number> = { 'bed.meadow': 0, 'bed.forest': 0, 'bed.night': 0, 'bed.marsh': 0, 'bed.snow': 0, 'bed.ash': 0, 'bed.ruins': 0, 'bed.rain': 0, 'bed.rain.roof': 0, 'bed.wind': 0, 'bed.surf': 0, 'bed.room': 0, 'bed.ragnarok': 0, 'bed.sea': 0 };
  if (s.atSea) { out['bed.sea'] = 1; out['bed.wind'] = 0.5; return out; }
  const open = s.indoors ? 0.18 : 1;           // the world heard through walls
  const wet = 1 - 0.6 * Math.min(1, s.rain);    // birds and insects fall quiet in the rain
  const green = s.biome === 'meadow' || s.biome === 'forest';
  if (green) out[s.night ? 'bed.night' : `bed.${s.biome}`] = open * wet;
  else {
    out[`bed.${s.biome}`] = open;
    if (s.biome === 'marsh' && s.night) out['bed.night'] = open * wet * 0.5;
  }
  out['bed.rain'] = s.indoors ? 0 : Math.min(1, s.rain);
  out['bed.rain.roof'] = s.indoors ? Math.min(1, s.rain) : 0;
  out['bed.wind'] = Math.min(1, (s.indoors ? 0.1 : s.wind) * (s.biome === 'snow' && !s.indoors ? 1.3 : 1));
  out['bed.surf'] = s.indoors ? 0 : Math.max(0, 1 - s.coast / 6);
  out['bed.room'] = s.indoors ? 1 : 0;
  out['bed.ragnarok'] = s.rag ? 1 : s.danger ? 0.4 : 0;
  return out;
}
/** Which wildlife or place sound may be heard now, with weights. Pure. */
export function ambienceChoices(s: { biome: Biome; night: boolean; indoors: boolean; rain: number; storm: boolean; wind: number; coast: number; rag: boolean; nearWater: boolean }): [string, number][] {
  if (s.indoors) return s.storm ? [['amb.house', 2], ['amb.thunder', 2]] : [['amb.house', 1]];
  const c: [string, number][] = [];
  const green = s.biome === 'meadow' || s.biome === 'forest';
  if (s.storm) c.push(['amb.thunder', 4]);
  if (s.rag) c.push(['amb.rag', 3]);
  if (green && !s.night && s.rain <= 0) c.push(['amb.bird', 4]);
  if (green && s.night) c.push(['amb.owl', 3]);
  if (s.night && s.biome !== 'ruins') c.push(['amb.howl', 0.6]);
  if (s.biome === 'marsh' || (s.night && s.nearWater)) c.push(['amb.frog', 3]);
  if (!s.night && s.coast < 4) c.push(['amb.gull', 3]);
  if (s.biome === 'snow' || s.wind > 0.8) c.push(['amb.gust', 3]);
  if (s.biome === 'ruins') c.push(['amb.creak', 3]);
  if (s.biome === 'ash') c.push(['amb.volcano', 2]);
  if (s.biome === 'forest') c.push(['amb.twig', 1.5]);
  return c;
}
function pick<V>(list: [V, number][]): V | null {
  let total = 0; for (const [, w] of list) total += w;
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const [v, w] of list) { roll -= w; if (roll <= 0) return v; }
  return list[list.length - 1][0];
}
/** Body warnings (slot `warn.<key>`) and machine loops (slot `loop.<kind>`) this file can ask for. */
export const WARN_KEYS = ['hp', 'hunger', 'thirst', 'cold', 'stamina', 'rad', 'lowfuel'] as const;
export const MACHINE_KINDS = ['campfire', 'furnace', 'refinery', 'pump', 'generator', 'recycler'] as const;
const LOW = { hp: 28, hunger: 18, thirst: 18, warmth: 20, stamina: 8, rad: 25, fuel: 0.15 };
const REPEAT: Record<string, number> = { hunger: 60000, thirst: 60000, cold: 45000 };

function machineKind(e: Entity): { kind: string; run: boolean; hum?: boolean } | null {
  if (e.kind === 'recycler') return { kind: 'recycler', run: !!e.station && e.station.queue.length > 0 };
  if (e.station) {
    const working = e.station.burn > 0 && e.station.queue.length > 0;
    if (e.type === 'campfire') return { kind: 'campfire', run: e.station.burn > 0, hum: working };
    return { kind: e.type === 'refinery' ? 'refinery' : e.type === 'oil_pump' ? 'pump' : 'furnace', run: working };
  }
  if (e.basePower) return { kind: 'generator', run: !!e.basePower.enabled && e.basePower.energy > 0 };
  return null;
}

export function watchSecond(r: RunState, now: number, w: WatchState): void {
  const p = r.player; const world = getWorld();
  if (w.runId !== r.id) { Object.assign(w, newWatch(), { runId: r.id }); stopLoops('m:'); stopLoops('fire:'); }
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE), idx = ty * WW + tx;
  const zone = world.zone[idx] ?? 0; const tile = effTile(r, tx, ty);
  const weather = weatherAt(r, now); const storm = weather === 'storm';
  const rain = storm ? 1 : weather === 'rain' ? 0.6 : 0;
  const wind = (zone === 5 ? 0.9 : 0.25) + (storm ? 0.6 : 0);
  const rag = isRagnarok(r, now); const phase = phaseOf(r, now);
  const dt = dayTime(r, now); const night = dt < 0.25 || dt > 0.78;
  const indoors = !!p.sheltered; const atSea = playerAtSea(r);
  const coast = world.seaDist[idx] ?? 9;
  const perfNow = performance.now();

  // -- machines, fires and lights within reach: each keeps its own looping voice --
  let nearMachine = 0;
  if (!atSea) for (const eid in r.entities) {
    const e = r.entities[eid];
    if (Math.abs(e.x - p.x) > 420 || Math.abs(e.y - p.y) > 420) continue;
    if (e.kind === 'struct' && e.type === 'torch_post') {
      loopLevel(`fire:${eid}`, 'loop.campfire', !e.workLight || workLightPowered(r, e) ? 0.55 : 0, { x: e.x, y: e.y });
      continue;
    }
    const m = machineKind(e); if (!m) continue;
    if (m.run && m.kind !== 'campfire') nearMachine++;
    if (m.kind === 'campfire') {
      // the fire crackles from a file; without one a COOKING campfire keeps the low hum it always had
      if (!loopLevel(`fire:${eid}`, 'loop.campfire', m.run ? 1 : 0, { x: e.x, y: e.y })) machineState(eid, 'furnace', !!m.hum, e.x, e.y);
      else machineState(eid, 'furnace', false, e.x, e.y);
    } else machineState(eid, m.kind, m.run, e.x, e.y);
  }
  sweepLoops('m:', 2500); sweepLoops('fire:', 2500);

  // -- wildfire: the nearest burning tiles --
  if (slotStatus('loop.wildfire') === 'file' || slotStatus('loop.wildfire') === 'borrowed') {
    let burning = 0, bx = 0, by = 0, bd = Infinity;
    for (const k in r.sources) {
      const st = r.sources[+k]; if (!st.fire || st.fire <= r.clock.simMs) continue;
      const x = (+k % WW) * TILE + 8, y = ((+k / WW) | 0) * TILE + 8; const d = Math.hypot(x - p.x, y - p.y);
      if (d > 360) continue;
      burning++; if (d < bd) { bd = d; bx = x; by = y; }
    }
    loopLevel('wildfire', 'loop.wildfire', burning ? Math.min(1, 0.45 + burning * 0.08) : 0, burning ? { x: bx, y: by } : undefined);
  }

  // -- background layers --
  const biome = biomeOf(zone, tile);
  if (biome !== w.biome && perfNow - w.biomeAt > 3000) { w.biome = biome; w.biomeAt = perfNow; }   // no flutter on a patchy border
  setEnvironment({ zone, indoors, sheltered: indoors, night, rag, phase, nearMachine: Math.min(3, nearMachine), coast }, rain, wind);
  setBeds(bedLevels({ biome: w.biome as Biome, night, indoors, atSea, rain, wind, coast, rag, danger: phase === 'danger' }));

  // -- music mood: real state only, and silence is allowed --
  const threat = r.creatures.some(m => (m.state === 'chase' || m.state === 'attack' || m.state === 'tell') && Math.hypot(m.x - p.x, m.y - p.y) < 190);
  const elder = r.creatures.some(m => m.elder && m.state !== 'sleep' && m.state !== 'dead' && Math.hypot(m.x - p.x, m.y - p.y) < 260);
  const moving = Math.hypot(p.vx, p.vy) > 6;
  if (moving || threat) w.idleMs = 0; else w.idleMs += 1000;
  setMood(p.dead ? 'aftermath' : rag ? 'ragnarok' : elder ? 'elder' : threat ? 'combat'
    : indoors ? 'home' : zone === 7 || zone === 6 ? 'ruins' : night ? 'night' : w.idleMs > 22000 ? 'silence' : 'wild', now);

  // -- turning points of the day (never on the first look after loading) --
  if (w.primed) {
    if (night !== w.night && !atSea) play(night ? 'amb.dusk' : 'amb.dawn');
  }
  w.night = night; w.rag = rag;

  // -- the body: a sound when a need crosses its line, a reminder while it stays there --
  const bike = p.vehicle ? r.entities[p.vehicle] : undefined;
  const lows: Record<string, boolean> = {
    hp: p.hp < LOW.hp, hunger: p.hunger < LOW.hunger, thirst: p.thirst < LOW.thirst, cold: p.warmth < LOW.warmth,
    stamina: p.stamina < LOW.stamina, rad: p.rad >= LOW.rad, lowfuel: !!bike?.vehicle && bike.vehicle.fuel < BAL.motorbike.tank * LOW.fuel,
  };
  if (!p.dead) for (const k in lows) {
    const was = !!w.low[k], is = lows[k];
    if (is && w.primed && (!was || (REPEAT[k] && perfNow - (w.at[k] ?? 0) > REPEAT[k]))) { play(`warn.${k}`); w.at[k] = perfNow; }
    if (is && !was && !w.primed) w.at[k] = perfNow;
  }
  w.low = lows;
  const toxic = tile === T.TOXIC || (zone === 7 && tile === T.FLOOR);
  loopLevel('geiger', 'loop.geiger', !p.dead && (toxic || p.rad >= LOW.rad) ? Math.min(1, 0.35 + p.rad / 100) : 0, undefined, toxic ? 1.15 : 0.9);

  // -- wildlife and the place itself, at irregular intervals; nothing chirps over a fight --
  if (!w.nextAmb) w.nextAmb = perfNow + 4000 + Math.random() * 6000;
  if (perfNow > w.nextAmb && !p.dead && !atSea) {
    w.nextAmb = perfNow + (storm ? 9000 : 12000) + Math.random() * (storm ? 16000 : 22000);
    if (!threat && !elder) {
      const nearWater = coast < 3 || tile === T.SHALLOW || tile === T.RIVER || tile === T.MARSH;
      const slot = pick(ambienceChoices({ biome: w.biome as Biome, night, indoors, rain, storm, wind, coast, rag, nearWater }));
      if (slot) { const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * 160; play(slot, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.6, gain: 0.7 + Math.random() * 0.3 }); }
    }
  }
  // -- a creature nearby that has not noticed the player makes itself heard now and then --
  if (!w.nextVoice) w.nextVoice = perfNow + 6000 + Math.random() * 6000;
  if (perfNow > w.nextVoice && !atSea) {
    w.nextVoice = perfNow + 7000 + Math.random() * 11000;
    const calm = r.creatures.filter(m => (m.state === 'idle' || m.state === 'wander') && !m.elder && Math.abs(m.x - p.x) < 260 && Math.abs(m.y - p.y) < 180);
    const m = calm[Math.floor(Math.random() * calm.length)];
    if (m) play(creatureSlot(m.type, 'idle'), { x: m.x, y: m.y });
  }
  w.primed = true;
}

// --- ten times a second -------------------------------------------------------------------------------------------
export function watchFast(r: RunState, w: WatchState): void {
  const p = r.player; const speed = Math.hypot(p.vx, p.vy);
  const bike = p.vehicle ? r.entities[p.vehicle] : undefined;
  const riding = !!bike && !p.dead;
  const top = BAL.motorbike.roadSpeed as number;
  loopLevel('bike.idle', 'loop.bike.idle', riding && speed < 10 ? 1 : 0, undefined, 1, 0.15);
  loopLevel('bike.run', 'loop.bike.run', riding && speed >= 10 ? Math.min(1, 0.55 + speed / top) : 0, undefined, 0.8 + Math.min(1, speed / top) * 0.7, 0.15);
  loopLevel('cart', 'loop.cart', p.pulling && !riding && speed > 6 ? Math.min(1, 0.4 + speed / 90) : 0, undefined, 0.9 + Math.min(1, speed / 90) * 0.25, 0.12);
  const frail = !p.dead && p.hp < LOW.hp ? (LOW.hp - p.hp) / LOW.hp : 0;
  loopLevel('heartbeat', 'loop.heartbeat', frail > 0 ? 0.45 + frail * 0.55 : 0, undefined, 1 + frail * 0.35, 0.3);
  if (w.active !== p.active) { if (w.active >= 0 && w.runId === r.id) play('ui.hotbar'); w.active = p.active; }
}
