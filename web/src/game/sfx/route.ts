// ============================================================================
// SFX routing. Pure functions: "this thing happened" -> "these slots play".
//
// Nothing here touches game state or the audio device. The three inputs are
// things the game already produces today:
//   * FX events the simulation pushes for the renderer (sim.ts `fx(...)`),
//   * receipts the engine writes for every committed action,
//   * the intent the player just sent (only for the few cases a receipt cannot tell apart).
// ============================================================================
import { CORE_KINDS, CREATURE_FAMILIES, ELDER_KEYS, SFX_SLOT } from './slots';

export interface SfxPlay {
  slot: string;
  /** World position in pixels; omitted = heard at full level in the centre. */
  x?: number; y?: number;
  /** Extra loudness factor for this one play. */
  gain?: number;
  /** Extra speed factor for this one play. */
  rate?: number;
  /** Chance 0..1 that this play happens at all (default 1). */
  chance?: number;
  /** True: when no file fills the slot, the old synthesized cue for the ORIGINAL event plays instead. */
  legacy?: boolean;
  /** True: an extra layer on top of the main sound. It plays only from a delivered file, never from a stand-in,
   *  so a game with no files sounds exactly as it did before. */
  layer?: boolean;
}

export type ItemClass = 'metal' | 'wood' | 'stone' | 'cloth' | 'food' | 'liquid' | 'core';
export interface RouteCtx {
  /** Creature closest to a point (within about two tiles), if any. */
  creatureNear(x: number, y: number): { type: string; elder?: string; boss?: boolean } | null;
  /** Item key in the player's hand, or null for bare hands. */
  heldKey(): string | null;
  /** Floor the player built or a building floor under a point: 'wood' | 'stone' | 'metal', else null. */
  floorAt(x: number, y: number): string | null;
  itemClass(key: string): ItemClass | null;
  /** How an item is consumed. */
  consumeKind(key: string): 'eat' | 'drink' | 'heal';
  /** Build sound family of a structure type. */
  structMaterial(type: string): 'wood' | 'stone' | 'metal' | 'soft' | 'wire';
  /** Entity by id: its type, kind and position. */
  entity(id: string): { type?: string; kind: string; x: number; y: number } | null;
  /** Position of a person by actor id. */
  human(id: string): { x: number; y: number } | null;
  player(): { x: number; y: number; character: 'male' | 'female' };
}

// --- small lookups ----------------------------------------------------------
// Terrain ids are core.ts `T`: DEEP 0, SHALLOW 1, SAND 2, GRASS 3, MEADOW 4, FOREST 5, MARSH 6, HILL 7, CLIFF 8,
// SNOW 9, ASH 10, TOXIC 11, ROAD 12, BRIDGE 13, FLOOR 14, PWALL 15, LAVA 16, BURNT 17, ICE 18, RIVER 19.
const STEP_BY_TILE: Record<number, string> = {
  0: 'water', 1: 'water', 2: 'sand', 3: 'grass', 4: 'grass', 5: 'forest', 6: 'mud', 7: 'stone', 8: 'stone',
  9: 'snow', 10: 'ash', 11: 'ash', 12: 'road', 13: 'wood', 14: 'stone', 15: 'stone', 16: 'ash', 17: 'ash', 18: 'ice', 19: 'water',
};
export const stepSurface = (tile: number | undefined): string => STEP_BY_TILE[tile ?? 3] ?? 'grass';

export function familyOf(type: string): string | null {
  if (CREATURE_FAMILIES[type]) return type;
  const base = type.replace(/_\d+$/, '').replace(/^boss_/, '');
  return CREATURE_FAMILIES[base] ? base : null;
}
const crSlot = (type: string | undefined, what: 'tell' | 'hurt' | 'die' | 'idle'): string => {
  const fam = type ? familyOf(type) : null;
  const id = fam ? `cr.${fam}.${what}` : '';
  return SFX_SLOT[id] ? id : `cr.${what}`;
};
export const creatureSlot = crSlot;

const SWING: Record<string, string> = {
  fists: 'fist', knife: 'blade', cleaver: 'blade', machete: 'blade', iron_sword: 'blade', ronin_nodachi: 'blade',
  wood_spear: 'spear', reinforced_spear: 'spear', tidemarshal_trident: 'spear', torch: 'torch', custodian_lantern: 'torch',
};
export const swingSlot = (key: string | undefined): string => `swing.${SWING[key ?? 'fists'] ?? 'heavy'}`;

const HAZ_STYLE: Record<string, string> = {
  burn: 'fire', magma: 'fire', meteor: 'fire', erupt: 'quake', quake: 'quake', charge: 'blade', slash: 'blade',
  frostnova: 'frost', spike: 'frost', shard: 'frost', tide: 'water', pool: 'water', bog: 'water', steam: 'water',
  root: 'root', roots: 'root', seed: 'root', beam: 'beam', lightning: 'beam',
};
const CORE_EL = (core: string | undefined): string => (core === 'frost' || core === 'storm' || core === 'spirit' ? core : core === 'earth' || core === 'nature' ? 'earth' : 'fire');

const GATHER: Record<string, string> = { wood: 'wood', stone: 'stone', ore: 'ore', scrap: 'scrap', plant: 'plant' };

/** FX types that are deliberately silent: they are camera, number or text effects with a sound owned by another event. */
export const SILENT_FX: readonly string[] = ['shake', 'hitstop', 'num', 'scorch'];

// ---------------------------------------------------------------------------
// simulation FX event -> plays. The first play carries `legacy` so today's synthesized cue stays as the stand-in.
// ---------------------------------------------------------------------------
export function fxRoute(e: any, ctx: RouteCtx): SfxPlay[] {
  const at = (slot: string, extra: Partial<SfxPlay> = {}): SfxPlay => ({ slot, x: e.x, y: e.y, legacy: true, ...extra });
  switch (e?.type) {
    // ---- body -------------------------------------------------------------
    case 'step': return [at(`step.${ctx.floorAt(e.x, e.y) ?? stepSurface(e.t)}`)];
    case 'roll': return [at('player.roll')];
    case 'dodge': return [at('player.dodge')];
    case 'phit': return [at('player.hurt'), { slot: `player.grunt.${ctx.player().character === 'female' ? 'f' : 'm'}`, chance: 0.5, layer: true }];
    case 'pdeath': return [at('player.fall')];
    // ---- weapons ----------------------------------------------------------
    case 'whoosh': return [at(ctx.heldKey() === 'bow' ? 'swing.bow.draw' : 'swing.start')];
    case 'slash': return [at(swingSlot(e.key))];
    case 'bowshot': return [at('swing.bow.shot')];
    case 'turretshot': return [at('station.turret')];
    case 'ping': return [at('hit.arrow')];
    case 'rockhit': return [at('hit.rock')];
    case 'stun': return [at('hit.stun')];
    case 'hit': return [at('hit.flesh')];
    case 'mhit': {
      const c = ctx.creatureNear(e.x, e.y);
      return [at(e.big ? 'hit.big' : 'hit.flesh'), { slot: crSlot(c?.type, 'hurt'), x: e.x, y: e.y, chance: 0.5, layer: true }];
    }
    case 'mdeath': return [at(crSlot(e.type, 'die')), { slot: 'hit.kill', x: e.x, y: e.y, layer: true }];
    case 'structhit': return [at('build.hit')];
    case 'structbreak': return [at('build.break')];
    // ---- gathering --------------------------------------------------------
    case 'chip': {
      const out = [at(`gather.${GATHER[e.mat] ?? 'plant'}`)];
      if (e.depleted) out.push({ slot: 'gather.deplete', x: e.x, y: e.y, layer: true });
      return out;
    }
    case 'fell': return [at('gather.fell')];
    case 'clank': return [at('gather.clank', e.soft ? { gain: 0.6 } : {})];
    case 'break': return [at('gather.toolbreak')];
    case 'pickup': {
      const cls = e.key ? ctx.itemClass(e.key) : null;
      return cls ? [at('item.pickup'), { slot: `item.${cls}`, gain: 0.7, layer: true }] : [at('item.pickup')];
    }
    // ---- creatures --------------------------------------------------------
    case 'tell': return [at(crSlot(ctx.creatureNear(e.x, e.y + 10)?.type, 'tell'))];
    case 'etell': return [at(ELDER_KEYS[e.key] ? `elder.${e.key}.tell` : 'elder.tell')];
    case 'sniff': return [at('cr.sniff')];
    case 'lost': return [at('cr.lost')];
    case 'zap': return [at('cr.shoot')];
    case 'tongue': return [at('cr.tongue')];
    case 'snip': return [at('cr.snip')];
    case 'emerge': return [at(e.big ? 'elder.emerge' : 'cr.emerge')];
    case 'submerge': return [at('elder.submerge')];
    case 'brood': return [at('elder.brood')];
    case 'drain': return [at('elder.drain', { x: e.x1, y: e.y1 })];
    case 'hazfire': return [at(`haz.${HAZ_STYLE[e.style] ?? 'hit'}`)];
    // ---- Cores ------------------------------------------------------------
    case 'windup': return [at(`core.windup.${CORE_EL(e.core)}`)];
    case 'cast': {
      if (e.sub) return [at('core.elsa.shard')];
      const own = e.ck && CORE_KINDS[e.ck] && (e.mode === 'basic' || e.mode === 'refined' || e.mode === 'signature') ? `core.${e.ck}.${e.mode}` : '';
      return [at(SFX_SLOT[own] ? own : `core.cast.${CORE_EL(e.core)}`)];
    }
    case 'fizzle': return [at('core.fizzle')];
    case 'bolt': return [at('core.bolt', { x: e.x1, y: e.y1 })];
    case 'spiritDepart': return [at('core.spirit.depart')];
    case 'spiritArrive': return [at('core.spirit.arrive')];
    case 'spiritHit': return [at('core.spirit.hit')];
    // ---- fire, blast, sky -------------------------------------------------
    case 'boom': return [at(e.small ? 'fire.boom.small' : 'fire.boom')];
    case 'lightning': return [at('fire.lightning')];
    case 'ignite': return [at('fire.ignite')];
    case 'steam': return [at('fire.steam')];
    case 'airdropImpact': return [at('box.airdrop.land')];
    case 'weather': return e.w === 'rain' ? [at('amb.rain.start')] : e.w === 'storm' ? [at('amb.storm.start')] : e.w === 'clear' ? [at('amb.clear')] : [];
    // ---- banners and discoveries -------------------------------------------
    case 'banner': {
      const text = String(e.text ?? '');
      const sub = String(e.sub ?? '');
      return [at(text.includes('AWAKENS') ? 'elder.awaken' : /AWAKENED|latent form/.test(sub) ? 'elder.engage' : text === 'RAGNAROK' ? 'prog.ragnarok'
        : text.startsWith('DAY 14') ? 'prog.day14' : text.startsWith('The run has ended') ? 'prog.runend' : 'prog.banner')];
    }
    case 'discover': return [at('prog.discover')];
    case 'region': return [at('prog.region')];
    case 'toast': return typeof e.key === 'string' && e.key.startsWith('sb_p2_') ? [at('elder.phase')] : e.text === 'No arrows.' ? [at('ui.deny')] : [];
    // ---- names the screens already use when they ask for a sound directly --
    case 'ui': return [at('ui.click')];
    case 'uiBack': return [at('ui.back')];
    case 'pin': return [at('ui.pin')];
    case 'tab': return [at('ui.tab')];
    case 'deny': return [at('ui.deny')];
    case 'coin': return [at('ui.coin')];
    case 'craft': return [at('station.craft')];
    case 'build': return [at('build.wood')];
    case 'eat': return [at('player.drink')];
    case 'jtick': return [at('prog.tick')];
    case 'jstamp': return [at('prog.stamp')];
    case 'jmilestone': return [at('prog.milestone')];
    case 'jcapability': return [at('prog.capability')];
    case 'jrelic': return [at('prog.relic')];
    case 'jepic': return [at('prog.epic')];
    case 'rare': return [at('prog.rare')];
    case 'death': return [at('player.death')];
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// engine receipt -> plays. Receipts are written once per committed action, so each plays exactly once.
// ---------------------------------------------------------------------------
type R = (detail: string, ctx: RouteCtx) => SfxPlay[];
const one = (slot: string): R => () => [{ slot }];
/** Sound placed at the entity whose id starts the detail; dropped when that entity is gone (it may be far away or on another floor). */
const atEntity = (slot: string | ((type: string | undefined, detail: string) => string | null)): R => (detail, ctx) => {
  const e = ctx.entity(detail.split(':')[0]);
  if (!e) return [];
  const id = typeof slot === 'string' ? slot : slot(e.type, detail);
  return id ? [{ slot: id, x: e.x, y: e.y }] : [];
};
const STATION_DONE: Record<string, string> = {
  furnace: 'furnace', large_furnace: 'furnace', campfire: 'campfire', workbench: 'workbench', refinery: 'refinery', oil_pump: 'oil_pump', research: 'research',
};
const itemKeyOf = (detail: string): string => /^([a-z0-9_]+?)(?:x\d+)?(?:\s|$)/.exec(detail)?.[1] ?? '';
/** Wooden doors the player built sound like wood; iron doors and the doors of ruins sound like iron. */
const doorSlot = (type: string | undefined, closing: boolean): string => `door.${type === 'door_wood' ? 'wood' : 'iron'}.${closing ? 'close' : 'open'}`;

const RECEIPTS: Record<string, R> = {
  // build
  build: (d, ctx) => { const [type, pos] = d.split('@'); const [tx, ty] = (pos ?? '').split(',').map(Number); const p = { slot: `build.${ctx.structMaterial(type)}` } as SfxPlay; if (Number.isFinite(tx) && Number.isFinite(ty)) { p.x = tx * 16 + 8; p.y = ty * 16 + 8; } return [p]; },
  reclaim: one('build.reclaim'),
  'structure.repair': atEntity('build.repair'), 'structure.repair.plate': one('build.repair'), 'territory.repair.batch': one('build.repair'),
  'structure.upgrade': atEntity('build.upgrade'), 'station.upgrade': one('build.upgrade'), 'furnace.upgrade': one('build.upgrade'), 'power.upgrade': one('build.upgrade'),
  'cart.upgrade': one('build.upgrade'), 'industrial.install': one('build.upgrade'), 'garden.frame.install': one('build.upgrade'), 'vehicle.deploy': one('build.metal'),
  'territory.collapse': one('build.collapse'),
  // doors
  door: (d, ctx) => { const e = ctx.entity(d.split(':')[0]); return [{ slot: doorSlot(e?.type, d.endsWith(':closed')), x: e?.x, y: e?.y }]; },
  'g1b.door.open': one('door.powered'), 'g1b.door.exit': one('door.powered'), 'circuit.door': atEntity('door.powered'),
  'poi.door.close': atEntity('door.auto.close'), 'g1b.door.close': atEntity('door.auto.close'), 'circuit.door.close': atEntity('door.auto.close'),
  // body
  consume: (d, ctx) => [{ slot: `player.${ctx.consumeKind(itemKeyOf(d))}` }],
  drink: one('player.drink'), 'drink.flask': one('player.drink'), 'barrel.drink': one('player.drink'),
  respawn: one('player.respawn'),
  // items
  move: (d, ctx) => { const cls = ctx.itemClass(itemKeyOf(d)); return [{ slot: cls ? `item.${cls}` : 'item.move' }]; },
  pickup: (d, ctx) => { const cls = ctx.itemClass(itemKeyOf(d)); return cls ? [{ slot: 'item.pickup' }, { slot: `item.${cls}`, gain: 0.7, layer: true }] : [{ slot: 'item.pickup' }]; },
  'vehicle.unload': one('item.move'), drop: one('item.drop'), equip: one('item.equip'), sort: one('item.sort'), split: one('item.sort'),
  'item.repair': one('item.repair'), 'core.repair': one('item.repair'), 'item.salvage': one('item.repair'),
  // stations
  'craft.hand': one('station.craft'), 'job.queue': one('station.queue'), 'recycle.start': one('station.recycle.start'),
  // A finished job is news wherever the player stands: close by it sounds at the station, far away it is a quiet chime.
  'job.done': (d, ctx) => {
    const e = ctx.entity(d.split(':')[0]); const p = ctx.player();
    const own = `station.done.${e?.kind === 'recycler' ? 'recycler' : STATION_DONE[e?.type ?? ''] ?? ''}`;
    const slot = SFX_SLOT[own] ? own : 'station.done';
    return e && Math.hypot(e.x - p.x, e.y - p.y) < 380 ? [{ slot, x: e.x, y: e.y }] : [{ slot: 'station.done', gain: 0.45 }];
  },
  'recycle.finish': one('station.done.recycler'), 'pump.extract': one('station.done.oil_pump'),
  'station.state': atEntity((_t, d) => { const code = d.slice(d.lastIndexOf('>') + 1); return code === 'running' ? 'station.on' : code === 'fuel_out' ? 'station.off' : code === 'idle' ? null : 'station.stall'; }),
  'heat.out': atEntity('station.off'),
  'power.toggle': atEntity((_t, d) => (d.endsWith(':true') ? 'station.on' : 'station.off')),
  'g1b.power': one('station.on'), 'poi.power.fuel': atEntity('station.on'), 'poi.power.resume': atEntity('station.on'), 'poi.power.pause': atEntity('station.off'),
  'poi.power.expire': atEntity('station.poi.expire'),
  'circuit.switch': atEntity('station.switch'), 'power.priority': one('station.switch'), 'turret.configure': one('station.switch'), 'farm.configure': one('station.switch'),
  'industrial.configure': one('station.switch'), 'circuit.irSensor': one('station.switch'),
  'trap.arm': atEntity('station.trap.set'), 'trap.rearm': atEntity('station.trap.set'), 'trap.trigger': atEntity('station.trap.snap'),
  // knowledge and money
  'learn.blueprint': one('prog.recipe'), 'research.family.done': one('prog.recipe'),
  'research.specimen': one('prog.research'), 'research.directed': one('prog.research'), 'research.random': one('prog.research'), 'research.family.queue': one('prog.research'),
  achievement: one('prog.achievement'), 'season.begin': one('prog.season'),
  'escrow.deposit': one('ui.coin'), 'vendor.buy': one('ui.buy'), 'vendor.parcel': one('ui.buy'), 'vendor.secured': one('ui.buy'), 'vendor.spares': one('ui.buy'), 'journey.requisition': one('ui.buy'),
  // chests and supply drops
  'tool.break': one('gather.toolbreak'), 'airdrop.landed': one('box.airdrop.land'),
  'cash.mint': one('box.cash.open'), 'airdrop.open': one('box.airdrop.open'), 'g1b.open': one('box.rag.open'),
  'airdrop.signal': one('box.airdrop.signal'), 'airdrop.descent': one('box.airdrop.descent'),
  // garden, water, animals, rest
  'garden.plant': one('farm.plant'), 'garden.restore': one('farm.plant'), 'garden.water': one('farm.water'), 'garden.harvest': one('farm.harvest'),
  'barrel.fill': one('farm.fill'), 'barrel.pour': one('farm.water'), 'fire.douse': one('farm.douse'),
  'husbandry.tame': one('farm.tame'), 'husbandry.feed': one('farm.feed'), 'husbandry.lead': one('farm.lead'), 'husbandry.release': one('farm.lead'),
  'husbandry.butcher': one('gather.carcass'), harvest: one('gather.carcass'),
  'rest.start': one('farm.rest.start'), 'rest.end': one('farm.rest.end'), 'rest.cancel': one('farm.rest.end'),
  // cart, bike, boat
  'cart.grab': d => [{ slot: d.endsWith(':true') ? 'ride.cart.grab' : 'ride.cart.release' }], 'cart.place': one('ride.cart.release'), 'cart.pack': one('ride.cart.release'),
  'vehicle.mount': one('ride.bike.mount'), 'vehicle.exit': one('ride.bike.exit'), 'vehicle.refuel': one('ride.bike.refuel'), 'vehicle.repair': one('ride.bike.repair'),
  'evac.open': one('ride.evac.open'), 'evac.berth.open': one('ride.evac.open'), 'evac.arrive': one('ride.evac.open'), 'evac.depart': one('ride.evac.depart'),
  'evac.board': one('ride.evac.board'), 'evac.leave': one('ride.evac.board'), 'evac.load': one('ride.evac.board'), 'player.board': one('ride.evac.board'), 'player.disembark': one('ride.evac.board'),
  // bosses and people
  'elder.defeat': one('elder.defeat'), 'boss.defeat': one('elder.defeat'),
  'human.down': (d, ctx) => nearHuman(d.split(/[ :]/)[0], ctx), 'human.death': (d, ctx) => nearHuman(d.split(':')[0], ctx),
};
function nearHuman(id: string, ctx: RouteCtx): SfxPlay[] {
  const h = ctx.human(id); if (!h) return [];
  const p = ctx.player();
  return Math.hypot(h.x - p.x, h.y - p.y) < 420 ? [{ slot: 'npc.down', x: h.x, y: h.y }] : [];
}
export const ROUTED_RECEIPT_KINDS: readonly string[] = Object.keys(RECEIPTS);
export const receiptHasRoute = (kind: string | undefined): boolean => !!kind && kind in RECEIPTS;
export function receiptRoute(kind: string, detail: string, ctx: RouteCtx): SfxPlay[] {
  const r = RECEIPTS[kind];
  return r ? r(detail, ctx) : [];
}

// ---------------------------------------------------------------------------
// the player's own request. Used only where the receipt belongs to someone else's bookkeeping (people) or
// where the request FAILED and the reason says which sound fits.
// ---------------------------------------------------------------------------
const INTENTS: Record<string, string> = {
  humanTalk: 'npc.talk', humanRecruit: 'npc.recruit', humanOrder: 'npc.order', humanDismiss: 'npc.order', humanThreaten: 'npc.threaten',
  humanAid: 'npc.aid', humanRepair: 'npc.aid', humanExchange: 'npc.trade', humanLoot: 'npc.trade', humanCargo: 'npc.trade', kitchenContribution: 'npc.trade',
};
export const ROUTED_INTENTS: readonly string[] = Object.keys(INTENTS);
/** A request the engine accepted. Empty = let the receipt speak, or fall back to the plain click. */
export function intentRoute(type: string): SfxPlay[] {
  const slot = INTENTS[type];
  return slot ? [{ slot }] : [];
}
/** A request the engine refused. */
export function refusalRoute(type: string, reason: string): SfxPlay[] {
  if (type === 'door' && /Sealed|Locked|locked|Powered door|requires|no connected/.test(reason)) return [{ slot: 'door.locked' }];
  return [{ slot: 'ui.deny' }];
}

/** Requests that only write down what the player saw. They make no sound of their own. */
export const QUIET_INTENTS: readonly string[] = ['observeGate', 'observeLoot'];

// ---------------------------------------------------------------------------
// screens: a panel opened, closed or changed; build mode entered or left
// ---------------------------------------------------------------------------
export interface PanelView { kind: string | null; eid?: string; build: boolean }
export interface PanelEntity { kind: string; station: boolean }
const BOOKS = ['journey', 'notes', 'research', 'report'];
export function panelSound(prev: PanelView, next: PanelView, prevEnt: PanelEntity | null, nextEnt: PanelEntity | null): SfxPlay[] {
  if (prev.build !== next.build) return [{ slot: next.build ? 'ui.build.enter' : 'ui.build.exit' }];
  if (prev.kind === next.kind && prev.eid === next.eid) return [];
  if (!next.kind) return [{ slot: prev.kind === 'map' ? 'ui.map.close' : prev.kind === 'container' && !prevEnt?.station ? 'box.chest.close' : 'ui.panel.close' }];
  if (next.kind === 'map') return [{ slot: 'ui.map.open' }];
  if (BOOKS.includes(next.kind)) return [{ slot: 'ui.book.open' }];
  if (next.kind !== 'container') return [{ slot: 'ui.panel.open' }];
  const k = nextEnt?.kind;
  return [{ slot: k === 'bag' ? 'box.bag.open' : k === 'recycler' || k === 'vehicle' ? 'box.machine.open' : k === 'loot' || k === 'cash' || k === 'airdrop' ? 'box.loot.open' : nextEnt?.station ? 'ui.panel.open' : 'box.chest.open' }];
}
