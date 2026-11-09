import { landingStimulus } from './stimulus';
import { supportsAirdrops, airdropArea, airdropTimes, airdropRewards, chooseAirdropSite, airdropStaticEligible } from './airdrop';
import { recoveryPlan, recoveryPlanFor, recoveryFits, COMPONENT_RECIPES } from './recycler';
import { recordIntel, gateKey, placeOfPoi } from './expedition-intel';
import { poiPowerMissingReason, poiDoorContract, poiGeneratorContract, poiGenerator, poiPowered, interiorRelease, doorwayOccupied, advancePoiAccess, poiContractDigest } from './poi-access';
import { vehicleClear, vehicleExitPoint } from './motorbike';
import { LOOT_ECOLOGY_VERSION, LOOT_GRAMMAR_CURRENT, lootSlots, LOOT_CLASSES, lootClass, lootRoll, lootSiteIndex, lootSourceId } from './loot-ecology';
import { buildLootSourceContract, specForSite, type PhysicalAccess } from './loot-source-spec';
import { creatorLootV1 } from './creator-loot';
// Authoritative game engine: GameState + dispatch(intent) → committed state + receipt | rejection.
// Rule: validate EVERYTHING first, then commit. Failed preconditions never partially debit.
import { BAL, TILE, WW, WH, HOUR, SAVE_VERSION, WORLD_SEED, T, uid, rngNext, dist, clamp,
  type GameState, type Profile, type RunState, type Stack, type Container, type Entity, type Creature } from './core';
import { ALWAYS_KNOWN_RECIPES, stationBurnable, ITEMS, SOURCES, RECIPES, STRUCTS, CREATURES, ELDERS, VENDOR_SECURED, VENDOR_SPARES, SALVAGED_OIL_WRECK_CHANCE, ACHIEVEMENTS, CORE_STUDY, WORKBENCH_UPGRADE, WORKBENCH_UPGRADE_III, CART_FREIGHT_UPGRADE, GENERATOR_CAPACITY_UPGRADE, INDUSTRIAL_MODULE, GARDEN_CROPS, GARDEN_FRAME_COST, FURNACE_LINING, STRUCTURE_UPGRADES, permitsDirectedResearch, requiredStationLevel, isRecipeKnown } from './catalog';
import { getWorld, getActiveLayout, setActiveLayout, SRC_KEYS, tileAt, webRecyclerSite, type StaticEnt } from './world';import { sourceDigest } from './world-economy';
import { wreckBonuses, wreckEconomy } from './wreck-economy';
import { mapDigest } from './map-package';
// CAL-01: one authoritative two-year/eight-season calendar (pure; engine-free module).
import { CALENDAR_VERSION, runClockMs, calendarAt, climateAt, climateAtPx, cropSeasonFactor, normalizeCalendarLedger, phaseBoundaryAt, phaseMs, phaseCount, seasonTransitionsBetween, seasonWeatherWeights, seasonLabel, calendarView, seasonOfPhase, type Season, type CalendarLedgerV1 } from './calendar';

export type Intent = { id: string; type: string; [k: string]: any };
export type Result = { ok: true; receipt: string; msg?: string } | { ok: false; reason: string; dup?: boolean };

// ---------------- time & phases (K8, CAL-01) ----------------
// CAL-01: the run clock formula itself lives in calendar.ts (`runClockMs`) so that
// the two-year/eight-season calendar and the fixed run clock can never disagree.
export const runElapsedMs = (r: RunState, now: number) => runClockMs(r, now);
export const runHours = (r: RunState, now: number) => runElapsedMs(r, now) / HOUR;
export function phaseOf(r: RunState, now: number): 'calm' | 'danger' | 'awakening' | 'expired' {
  const h = runHours(r, now); const max = BAL.run.maxRunHours;
  if (h >= max) return 'expired';
  if (h >= (BAL.run.eldersAwakenDay - 1) * 24) return 'awakening';
  if (h >= max - BAL.run.ragnarokFinalHours) return 'danger';
  return 'calm';
}
export const isRagnarok = (r: RunState, now: number) => { const p = phaseOf(r, now); return p === 'danger' || p === 'awakening'; };
/** Fictional day/night — separate adjustable clock. Returns 0..1 (0 = midnight, .5 = noon). */
export function dayTime(r: RunState, now: number) { const len = BAL.dayNight.dayLengthMinutes * 60000; return (((runElapsedMs(r, now) + len * 0.3) % len) + len) % len / len; }
export function darkness(r: RunState, now: number) { const t = dayTime(r, now); const s = Math.cos((t - 0.5) * Math.PI * 2); return clamp(0.5 - s * 0.85, 0, 0.78); }
export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';
/** CAL-01: the weather family for a run-clock instant is chosen with the CURRENT
 * SEASON's weights (SOH_PROVISIONAL, spring == the legacy flat weights). The slot
 * index, the seed mixing and the five families are unchanged, so this stays one
 * weather authority anchored to the one run clock.
 * `season` is passed explicitly by chronological callers (settle/advanceWorld) so a
 * long settlement cannot sample the wrong season's distribution mid-slice. */
export function weatherAt(r: RunState, at: number): Weather {
  const slot = Math.floor(runElapsedMs(r, at) / (BAL.weather.slotMinutes * 60000));
  return weatherSlot(r.seed, slot, calendarAt(r, at).season);
}
export function weatherSlot(seed: number, slot: number, season: Season = 'spring'): Weather {
  const w = seasonWeatherWeights(season); const keys = Object.keys(w) as Weather[]; const tot = keys.reduce((a, k) => a + w[k], 0);
  let h = ((slot * 2654435761) ^ seed) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; let x = (h % 10000) / 10000 * tot;
  for (const k of keys) { x -= w[k]; if (x < 0) return k; } return 'clear';
}
export const isWet = (w: Weather) => w === 'rain' || w === 'storm';
/** Coarse outlook from the current global weather schedule, not a geographic climate model. */
export function wetOutlook(r: RunState, now: number) {
  const end = Math.min(now + 24 * HOUR, r.startedAt - r.qaOffset + BAL.run.maxRunHours * HOUR);
  const slotMs = BAL.weather.slotMinutes * 60000; let t = now, wet = 0;
  while (t < end) {
    const boundary = r.startedAt - r.qaOffset + (Math.floor(runElapsedMs(r, t) / slotMs) + 1) * slotMs;
    const next = Math.min(end, boundary); if (next <= t) break;
    if (isWet(weatherAt(r, t))) wet += next - t; t = next;
  }
  return { hours: Math.max(0, end - now) / HOUR, wetHours: wet / HOUR };
}

// ---------------- CAL-01 calendar read model for other owners ----------------
/** Typed, read-only calendar view (season/year/progress + local climate). Grants nothing. */
export function calendarViewForRun(r: RunState, at: number, tile?: { tx: number; ty: number }) {
  return calendarView(r, at, tile ?? { tx: Math.floor(r.player.x / TILE), ty: Math.floor(r.player.y / TILE) }, weatherAt(r, at));
}
/** Minimal season read model used by panels/reports; the same single authority. */
export function seasonInfo(r: RunState, at: number) {
  const c = calendarAt(r, at);
  return { season: c.season, year: c.year, phaseIndex: c.phaseIndex, phaseRemainingMs: c.phaseRemainingMs, ragnarok: c.ragnarok };
}

// ---------------- creation ----------------
export function newProfile(): Profile { return { securedCash: 0, achievements: {}, history: [], settings: { volume: 0.6, muted: false }, profileReceipts: [] }; }
export function newGame(): GameState { return { version: SAVE_VERSION, revision: 0, profile: newProfile(), run: null }; }

export function mkStack(r: RunState, key: string, qty: number, meta?: string): Stack {
  const d = ITEMS[key]; const s: Stack = { uid: uid(r, 's'), key, qty };
  if (d?.creatorCore) s.reserves = { basic: 0, refined: 0, signature: 0 };
  if (d?.dur) s.dur = d.dur; if (d?.charge) s.charge = d.initialCharge ?? d.charge; if(key==='keycard' && qty===1 && r.poiAccessVersion==='poi-access-v1') s.charge=BAL.poiAccess.cardUses; if (meta) s.meta = meta; return s;
}
export function mkContainer(r: RunState, kind: string, n: number): Container { const c = { id: uid(r, 'c'), kind, slots: Array(n).fill(null) }; r.custody[c.id] = c; return c; }

/** Random eligible cell, using real collision, current hazards and reachable local sources.
 * Compiler reachability anchors and Map sp_* are never player spawn authorities. */
export function chooseLegalSpawn(r:RunState): {tx:number;ty:number;name:string}|null {
  const w=getWorld(); markDirty();const grid=blockGrid(r), n=WW*WH;
  const safe=(x:number,y:number)=>{const i=y*WW+x;return x>2&&y>2&&x<WW-3&&y<WH-3&&grid[i]===0&&w.economyMap.walkable[i]&&![T.TOXIC,T.ASH,T.SNOW].includes(effTile(r,x,y))&&!r.sources[i]?.fire&&!Object.values(r.entities).some(e=>e.type==='spikes'&&e.tx===x&&e.ty===y)&&!r.creatures.some(m=>m.state!=='dead'&&Math.hypot(m.x-(x*TILE+8),m.y-(y*TILE+8))<10*TILE);};
  const eligible=(tx:number,ty:number)=>{if(w.spawnEligible&&!w.spawnEligible[ty*WW+tx])return false;if(!safe(tx,ty))return false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(!safe(tx+dx,ty+dy))return false;
    const seen=new Uint8Array(n),q=new Int32Array(n),depth=new Uint8Array(n);let head=0,tail=0;const start=ty*WW+tx;q[tail++]=start;seen[start]=1;let wood=false,stone=false,food=false,water=false,sites=0;
    while(head<tail){const i=q[head++],x=i%WW,y=Math.floor(i/WW);if(w.economyMap.buildable[i]&&!sourceAt(r,x,y))sites++;for(const [dx,dy]of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=WW-1||ny>=WH-1)continue;const j=ny*WW+nx;if(w.fresh[j])water=true;const src=sourceAt(r,nx,ny);if(src&&src.stock>0&&!src.fire){if(['oak','pine','snowpine','palm','willow'].includes(src.key))wood=true;if(src.key==='rock')stone=true;if(['bush','mushroom'].includes(src.key))food=true;}
      if((dx||dy)&&depth[i]<30&&!seen[j]&&grid[j]===0&&w.economyMap.walkable[j]){seen[j]=1;depth[j]=depth[i]+1;q[tail++]=j;}}
      if(wood&&stone&&food&&water&&sites>=9)return true;
    }return false;
  };
  // Seed determines a full, non-repeating traversal; no fixed fallback or spawn beacon.
  const count=(WW-6)*(WH-6),start=Math.floor(rngNext(r)*count),step=1+2*Math.floor(rngNext(r)*(count/2));let stride=step;while((function gcd(a:number,b:number):number{return b?gcd(b,a%b):a})(stride,count)!==1)stride+=2;
  for(let k=0;k<count;k++){const i=(start+k*stride)%count,tx=3+i%(WW-6),ty=3+Math.floor(i/(WW-6));if(eligible(tx,ty))return{tx,ty,name:w.veyra?(w.zoneNames?.[0]||'Veyra region'):'the island'};}return null;
}

export function startRun(gs: GameState, character: 'male' | 'female', now: number, region: number | null = null, seedOverride?: number): Result {
  if (gs.run && !gs.run.ended) return { ok: false, reason: 'A run is already active.' };
  if(getActiveLayout()==='shipping')setActiveLayout('shipping_fresh');
  if(getActiveLayout()==='dev_delta')setActiveLayout('dev_delta_fresh');
  if(getActiveLayout()==='veyra-greywater-u16')setActiveLayout('veyra-greywater-lr02-u16');
  if(getActiveLayout()==='veyra-greywater-u20')setActiveLayout('veyra-greywater-lr02-u20');
  if(getActiveLayout()==='veyra-oasis-u20')setActiveLayout('veyra-oasis-lr02-u20');
  const w = getWorld();
  const seed = seedOverride ?? ((now ^ 0x9e3779b9) >>> 0);
  const r: RunState = {
    id: 'run_' + seed.toString(36), seed, character, startedAt: now, qaOffset: 0, qaUsed: false, layoutId: getActiveLayout(), sourceLayoutVersion: 3, sourceMap: { id: w.economyMap.id, revision: w.economyMap.revision, seed: w.economyMap.seed, rules: 3, digest: sourceDigest(w.sourceV3), mapDigest: mapDigest(w), ...(w.veyra ? {veyra:w.veyra} : {}) }, spawnRegion: 0, ended: null,
    player: null as any, creatures: [], sources: {}, terrain: {}, entities: {}, custody: {}, knowledge: { recipes: Array.from(new Set([...Object.keys(RECIPES).filter(k => RECIPES[k].base), ...ALWAYS_KNOWN_RECIPES])), studied: [] },
    traces: [], discovered: [], poiSeen: [], intel: [], elderStones: [], achievements: [], score: 0, deposited: 0,
    clock: { lastSimAt: now, simMs: 0, respawnAcc: 0, weatherSlot: -1 }, rng: seed, nextId: 1, receipts: [], seenIntents: [], seq: 0,
    vendorStock: { escrow_chest: 4, ...Object.fromEntries(Object.entries(VENDOR_SECURED).map(([k, v]) => [k, v.stock])), ...Object.fromEntries(Object.entries(VENDOR_SPARES).map(([k,v]) => [`spares:${k}`,v.stock])) }, log: [],
  };
  if (supportsAirdrops(r.layoutId!)) r.airdrops={version:'airdrop-v1',mapDigest:r.sourceMap!.mapDigest!,seed:r.seed,runId:r.id,startedAt:r.startedAt,nextIndex:0};
  r.poiAccessVersion='poi-access-v1';
  r.poiAccessDigest=poiContractDigest(w);
  if (getActiveLayout()==='shipping_fresh' || getActiveLayout()==='dev_delta_fresh') { r.creatorLootV1=true; r.lootEcology={version:LOOT_ECOLOGY_VERSION,cycles:{},grammar:LOOT_GRAMMAR_CURRENT}; }
  const reg = 0; r.spawnRegion = reg; const sp = chooseLegalSpawn(r); if(!sp)return {ok:false,reason:'No safe, resource-accessible spawn in this region.'}; r.spawnChoice={x:sp.tx,y:sp.ty,contract:'seeded-geographic-v1'};
  r.custody.inv = { id: 'inv', kind: 'inv', slots: Array(24).fill(null) };
  r.custody.eq = { id: 'eq', kind: 'eq', slots: [null, null, null] };
  r.custody.inv.slots[0] = mkStack(r, 'knife', 1);
  const fl = mkStack(r, 'water_flask', 1); fl.charge = 2; r.custody.inv.slots[1] = fl;
  r.custody.inv.slots[2] = mkStack(r, 'berries', 3);
  r.player = { x: sp.tx * TILE + 8, y: sp.ty * TILE + 8, vx: 0, vy: 0, dir: 0, aim: Math.PI / 2, hp: BAL.player.maxHp, stamina: BAL.player.maxStamina, hunger: 85, thirst: 85, warmth: 100, rad: 0, active: 0, action: null, invuln: 0, dead: false, deadT: 0, pulling: null, skills: { gather: 0, combat: 0, craft: 0, survival: 0 }, stepAcc: 0, lastTraceX: 0, lastTraceY: 0, regionName: sp.name, sheltered: false };
  // statics → physical entities with real finite loot
  const pendingRolls: [StaticEnt, Container][] = [];
  for (const s of w.statics) {
    const e: Entity = { id: uid(r, 'e'), kind: s.kind as any, x: s.tx * TILE + 8, y: s.ty * TILE + 8, tx: s.tx, ty: s.ty, poi: s.poi, label: s.label };
    if (s.kind === 'loot') {
      const c = mkContainer(r, 'loot', lootSlots(r));
      s.loot!.forEach(([k, q], i) => {
        if (k.startsWith('blueprint:')) c.slots[i] = mkStack(r, 'blueprint', 1, k.slice(10));
        else { const stack=mkStack(r,k,q); if (['meteor','dragon','elsa'].includes(ITEMS[k]?.creatorCore || '') && stack.reserves) stack.reserves.signature=3; c.slots[i]=stack; }
      });
      const unique=r.creatorLootV1 && creatorLootV1(s);
      if(unique){const free=c.slots.findIndex(x=>!x);if(free>=0){const stack=mkStack(r,unique,1);stack.reserves!.signature=3;c.slots[free]=stack;}}
      // Initial rolls are deferred until the physical source contract is measured (B05 needs it).
      pendingRolls.push([s,c]);
      e.c = c.id;
    }
    if (s.kind === 'cash') { e.c = mkContainer(r, 'cash', 2).id; e.minted = false; e.stock = { cash: s.cash! }; }
    if (s.kind === 'door') { e.locked = s.locked; e.open = false; }
    if (s.kind === 'gen') e.power = 0;
    r.entities[e.id] = e;
  }
  // Provisional public machine in the existing Web Foundry. No Map/Veyra
  // placement is inferred; old runs without this adapter remain unchanged.
  const site=webRecyclerSite(w,getActiveLayout());
  if(site){const e:Entity={id:uid(r,'e'),kind:'recycler',x:site.tx*TILE+8,y:site.ty*TILE+8,tx:site.tx,ty:site.ty,poi:'factory',label:'Foundry Recycler',station:{queue:[],burn:0,fuelC:mkContainer(r,'fuel',0).id,outC:mkContainer(r,'out',4).id}};r.entities[e.id]=e;}
  // B05 (loot-source-v2): measure physical access once from the real collision grid, record it, then roll initial stock.
  if (r.lootEcology?.grammar === LOOT_GRAMMAR_CURRENT) r.lootEcology.sourceContract = buildLootSourceContract(w, site => lootSiteAccess(r, site));
  for (const [s, c] of pendingRolls) {
    for (const [key,qty] of lootRoll(r,s,0)) {
      const i=c.slots.findIndex(v=>!v); if(i<0)throw new Error('Loot ecology exceeded authored container capacity');
      c.slots[i]=mkStack(r,key,qty);
    }
    if(r.lootEcology && lootClass(s)) c.slots.forEach((stack,i)=>{
      if(stack)receipt(r,now,'loot.roll',`${lootSourceId(r,s)}:${LOOT_ECOLOGY_VERSION}:cycle0:slot${i}:${stack.key}${stack.meta?':'+stack.meta:''}x${stack.qty}:${stack.uid}`);
    });
  }
  r.wreckEconomy = wreckEconomy(r);
  // creatures (deterministic per run seed) + elders
  for (let k = 0; k < 900 && r.creatures.length < 150; k++) trySpawnCreature(r, now, sp.tx * TILE, sp.ty * TILE, 16);
  for (const p of w.elders) {
    const d = ELDERS[p.id];
    r.creatures.push(mkCreature(r, 'elder_' + p.id, p.tx * TILE + 8, p.ty * TILE + 8, d.hpLatent, { key: p.id, awake: false, phase: 0, pattern: 0, special: 0 }));
  }
  gs.run = r; markDirty(); gs.revision++;
  pushLog(r, now, `You wash up near ${sp.name}. No one is coming to tell you what to do.`, 'gold');
  return { ok: true, receipt: receipt(r, now, 'run.start', `${character}@${sp.name}`) };
}
export function mkCreature(r: RunState, type: string, x: number, y: number, hp: number, elder?: Creature['elder']): Creature {
  return { id: uid(r, 'm'), type, x, y, hp, maxHp: hp, homeX: x, homeY: y, state: elder ? 'sleep' : 'wander', t: 0, tx: x, ty: y, angle: 0, dir: 0, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0, elder };
}
const BIOME_CREATURE: Record<number, string[]> = { [T.FOREST]: ['wolf', 'boar'], [T.GRASS]: ['boar'], [T.MEADOW]: ['boar'], [T.MARSH]: ['toad'], [T.TOXIC]: ['crawler'], [T.ASH]: ['beetle'], [T.SAND]: ['crab'], [T.SNOW]: ['wolf'], [T.HILL]: ['wolf'] };
export function trySpawnCreature(r: RunState, _now: number, avoidX: number, avoidY: number, avoidTiles: number) {
  const w = getWorld();
  const tx = 3 + Math.floor(rngNext(r) * (WW - 6)), ty = 3 + Math.floor(rngNext(r) * (WH - 6));
  const t = effTile(r, tx, ty); const opts = BIOME_CREATURE[t]; if (!opts) return false;
  if (Math.hypot(tx * TILE - avoidX, ty * TILE - avoidY) < avoidTiles * TILE) return false;
  for (const s of w.starts) if (Math.hypot(s.tx - tx, s.ty - ty) < 12) return false;
  if (blockedAt(r, tx, ty)) return false;
  for (const e of Object.values(r.entities)) if (e.kind === 'struct' && e.type === 'claim' && Math.hypot(e.tx! - tx, e.ty! - ty) < BAL.economy.claimSpawnExclusionTiles) return false;
  const type = opts[Math.floor(rngNext(r) * opts.length)];
  const d = CREATURES[type];
  r.creatures.push(mkCreature(r, type, tx * TILE + 8, ty * TILE + 8, d.hp));
  return true;
}

// ---------------- receipts, log, idempotency ----------------
/** Ephemeral read-model sink: while a settle window is open, every committed receipt is
 * also appended here (not persisted). The 250-entry receipt log can drop old entries; this cannot. */
let receiptSink: { id: string; at: number; kind: string; detail: string }[] | null = null;
export function beginReceiptSink(): void { receiptSink = []; }
export function endReceiptSink(): { id: string; at: number; kind: string; detail: string }[] { const out = receiptSink ?? []; receiptSink = null; return out; }
export function receipt(r: RunState, now: number, kind: string, detail: string) {
  const id = `r${++r.seq}`; r.receipts.push({ id, seq: r.seq, at: now, kind, detail }); if (r.receipts.length > 250) r.receipts.splice(0, r.receipts.length - 250);
  if (receiptSink) receiptSink.push({ id, at: now, kind, detail });
  return id;
}
export function pushLog(r: RunState, now: number, msg: string, tone?: string) { r.log.push({ t: now, msg, tone }); if (r.log.length > 40) r.log.shift(); }

// ---------------- terrain / world queries ----------------
export function effTile(r: RunState, tx: number, ty: number) {
  const m = r.terrain[ty * WW + tx]; if (m && (!m.until || m.until > r.clock.simMs)) return m.t; return tileAt(getWorld(), tx, ty);
}
export function sourceAt(r: RunState, tx: number, ty: number, now?: number) {
  if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return null;
  const i = ty * WW + tx; const w = getWorld();
  const k = w.src[i] >= 0 ? w.src[i] : r.sourceLayoutVersion === 2 ? w.sourceOverlayV2[i] : -1;
  let key = r.sourceLayoutVersion === 3 ? w.sourceV3[i] : k >= 0 ? SRC_KEYS[k] : null; if (!key) return null;
  const st = r.sources[i];
  if (st?.burnt) key = 'deadtree';
  const def = SOURCES[key];
  let stock = st ? st.stock : def.stock, hp = st ? st.hp : def.hp;
  if (st && stock <= 0 && st.regrowAt && now !== undefined && now >= st.regrowAt) { st.stock = def.stock; st.hp = def.hp; delete st.regrowAt; stock = def.stock; hp = def.hp; }
  return { i, key, def, stock, hp, st, fire: (st as any)?.fire as number | undefined };
}
// collision cache — rebuilt when structures/sources/terrain change
// B04-P4: keyed by the RunState object itself (not run.id), like entsAt: a copied run with the same id must never reuse another copy's collision grid.
let blockCache: { run: RunState; layout: string; sourceVersion: number; arr: Uint8Array } | null = null; let blockDirty = true;
export function markDirty() { blockDirty = true; tileIndex = null; roomCache = null; }
/** 0 free, 1 terrain wall, 2 source, 3 structure, 4 shallow/river (wade), 5 lava */
let baseGrid: Uint8Array | null = null; let baseGridLayout = '';
function tileClass(t: number) { return (t === T.DEEP || t === T.CLIFF || t === T.PWALL) ? 1 : t === T.LAVA ? 5 : (t === T.SHALLOW || t === T.RIVER) ? 4 : 0; }
function cellClass(r: RunState | null, tx: number, ty: number) {
  const w = getWorld(); const i = ty * WW + tx; const t = r ? effTile(r, tx, ty) : w.tiles[i]; let c = tileClass(t);
  if (c === 0 && !(t === T.ICE && [T.DEEP,T.SHALLOW,T.RIVER].includes(w.tiles[i])) && (w.packageContract || w.enforceMasks) && !w.economyMap.walkable[i] && !w.statics.some(s => s.kind === 'door' && s.tx === tx && s.ty === ty)) c = 1;
  if (c === 0) { if (r) { const s = sourceAt(r, tx, ty); if (s && s.def.block && (s.stock > 0 || s.key === 'wreck')) c = 2; } else if (w.src[i] >= 0 && SOURCES[SRC_KEYS[w.src[i]]].block) c = 2; }
  return c;
}
export function blockGrid(r: RunState) {
  const layout = getActiveLayout();
  if (blockCache && blockCache.run === r && blockCache.layout === layout && blockCache.sourceVersion === (r.sourceLayoutVersion ?? 1) && !blockDirty) return blockCache.arr;
  if (!baseGrid || baseGridLayout !== layout) { baseGrid = new Uint8Array(WW * WH); for (let i = 0; i < WW * WH; i++) baseGrid[i] = cellClass(null, i % WW, (i / WW) | 0); baseGridLayout = layout; }
  const arr = r.sourceLayoutVersion === 3 ? new Uint8Array(WW * WH) : baseGrid.slice();
  if (r.sourceLayoutVersion === 3) { for (let i = 0; i < arr.length; i++) arr[i] = cellClass(r, i % WW, (i / WW) | 0); }
  if (r.sourceLayoutVersion === 2) { const overlay = getWorld().sourceOverlayV2; for (let i = 0; i < overlay.length; i++) if (overlay[i] >= 0) arr[i] = cellClass(r, i % WW, (i / WW) | 0); }
  for (const k in r.terrain) { const i = +k; arr[i] = cellClass(r, i % WW, (i / WW) | 0); }
  for (const k in r.sources) { const i = +k; arr[i] = cellClass(r, i % WW, (i / WW) | 0); }
  for (const tree of r.natureTrees || []) arr[tree.ty * WW + tree.tx] = 2;
  for (const e of Object.values(r.entities)) {
    if (e.tx === undefined) continue; const i = e.ty! * WW + e.tx;
    if (e.kind === 'struct') { const d = STRUCTS[e.type!]; if (d.block && !(e.type!.startsWith('door') && e.open)) arr[i] = 3; }
    else if (e.kind === 'door') { if (!e.open) arr[i] = 3; else if (!r.terrain[i] && getWorld().tiles[i]===T.PWALL && getWorld().statics.some(s=>s.kind==='door'&&s.tx===e.tx&&s.ty===e.ty)) arr[i]=0; }
    else if (e.kind === 'airdrop' && (e.airdrop?.phase==='locked'||e.airdrop?.phase==='open'||e.airdrop?.phase==='partial')) arr[i] = 3;
    else if (e.kind === 'loot' || e.kind === 'cash' || e.kind === 'vendor' || e.kind === 'gen' || e.kind === 'evac' || e.kind === 'recycler') arr[i] = 3;
  }
  blockCache = { run: r, layout, sourceVersion: r.sourceLayoutVersion ?? 1, arr }; blockDirty = false; return arr;
}
export function blockedAt(r: RunState, tx: number, ty: number) { if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return true; const b = blockGrid(r)[ty * WW + tx]; return b === 1 || b === 2 || b === 3 || b === 5; }
let tileIndex: Map<number, Entity[]> | null = null; let tileIndexRun: RunState | null = null;
export function entsAt(r: RunState, tx: number, ty: number): Entity[] {
  if (!tileIndex || tileIndexRun !== r) { tileIndex = new Map(); tileIndexRun = r; /* keyed by run object: a copied run with the same id must never reuse another copy's entities */ for (const e of Object.values(r.entities)) if (e.tx !== undefined && e.kind !== 'drop' && e.kind !== 'bag' && e.kind !== 'cart') { const i = e.ty! * WW + e.tx; const l = tileIndex.get(i); if (l) l.push(e); else tileIndex.set(i, [e]); } }
  return tileIndex.get(ty * WW + tx) || [];
}
/** Authoritative SOH coverage: nearest valid owned cabinet, stable ID tie-break. */
export function cabinetSupported(r: RunState, c: Entity) {
  return c.type==='claim' && c.kind==='struct' && owned(c) && (c.hp??0)>0 && (c.cabinet?.legacy === true || !c.cabinet || Object.values(r.entities).some(e=>e.kind==='struct' && ['floor_wood','floor_stone'].includes(e.type||'') && owned(e) && (e.hp??0)>0 && e.tx===c.tx && e.ty===c.ty));
}
function nearestCabinet(cabinets:Entity[],tx:number,ty:number) {
  let best:Entity|null=null, bestDistance=Infinity;
  for(const c of cabinets) {const d=Math.hypot(c.tx!-tx,c.ty!-ty);if(d<=BAL.economy.claimRadius+1e-9 && (d<bestDistance || (d===bestDistance && c.id.localeCompare(best!.id)<0))){best=c;bestDistance=d;}}
  return best;
}
export function claimAt(r: RunState, tx: number, ty: number) {
  return nearestCabinet(Object.values(r.entities).filter(e=>cabinetSupported(r,e)),tx,ty);
}
/** Synchronize legacy ownership hints with the same geometric coverage authority. */
export function refreshTerritoryLinks(r:RunState) {
  for(const e of Object.values(r.entities)) if(e.kind==='struct' && owned(e) && e.tx!==undefined && e.ty!==undefined) {
    const c=claimAt(r,e.tx,e.ty); if(c && c.id!==e.id)e.claim=c.id; else delete e.claim;
  }
}
/** Add empty storage to existing totems without moving a single old stack. */
export function initializeCabinets(r: RunState) {
  for (const e of Object.values(r.entities)) if(e.kind==='struct' && e.type==='claim' && !e.cabinet) {
    if(!e.c) e.c=mkContainer(r,'chest',24).id;
    e.cabinet={credit:{},legacy:true};
  }
}
type TerritoryPlan = { structures:Entity[]; cabinets:Entity[]; assigned:Map<string,Entity|null>; forecast:Map<string,{rates:Record<string,number>;hours:number;funded:boolean;count:number}> };
export function planTerritory(r:RunState):TerritoryPlan {
  const all=Object.values(r.entities), structures=all.filter(e=>e.kind==='struct'&&owned(e)&&(e.hp??0)>0&&(e.maxHp??0)>0&&e.tx!==undefined&&e.ty!==undefined);
  const cabinets=structures.filter(e=>cabinetSupported(r,e)), assigned=new Map<string,Entity|null>();
  const forecast=new Map<string,{rates:Record<string,number>;hours:number;funded:boolean;count:number}>();
  for(const c of cabinets)forecast.set(c.id,{rates:{},hours:0,funded:false,count:0});
  for(const e of structures){const c=nearestCabinet(cabinets,e.tx!,e.ty!);assigned.set(e.id,c);if(!c)continue;const f=forecast.get(c.id)!;f.count++;for(const [key,q] of STRUCTS[e.type!]?.cost||[])if(BAL.territory.materials.includes(key))f.rates[key]=(f.rates[key]||0)+q*BAL.territory.upkeepFractionPerDay/(24*HOUR);}
  for(const c of cabinets){const f=forecast.get(c.id)!;if(!c.c||!c.cabinet)continue;const entries=Object.entries(f.rates),ms=entries.length?Math.min(...entries.map(([k,rate])=>(countItem(r,c.c!,k)+(c.cabinet!.credit[k]||0))/rate)):Infinity;f.hours=ms/HOUR;f.funded=ms>=0.001;}
  return {structures,cabinets,assigned,forecast};
}
export function territoryRates(r: RunState,c:Entity):Record<string,number> {return planTerritory(r).forecast.get(c.id)?.rates||{};}
export function territoryForecast(r: RunState,c: Entity) {return planTerritory(r).forecast.get(c.id)||{rates:{},hours:0,funded:false,count:0};}
/** Read-only home maintenance view. Derived from the same planTerritory authority as upkeep and decay; never a second ledger. */
export type HomeStructureState = 'uncovered' | 'unfunded' | 'funded';
export type HomeCabinetState = 'idle' | 'unfunded' | 'low' | 'funded';
export const HOME_LOW_HOURS = 24;
export function homeStatus(r: RunState) {
  const plan = planTerritory(r);
  const cabinets = plan.cabinets.map(c => {
    const f = plan.forecast.get(c.id)!;
    const stock: Record<string, number> = {}, prepaid: Record<string, number> = {};
    for (const k of BAL.territory.materials) { const q = countItem(r, c.c!, k); if (q > 0) stock[k] = q; }
    for (const [k, q] of Object.entries(c.cabinet?.credit || {})) if (q > 1e-9) prepaid[k] = q;
    const per24h: Record<string, number> = {};
    for (const [k, rate] of Object.entries(f.rates)) per24h[k] = rate * 24 * HOUR;
    // The Cabinet is itself assigned to itself by planTerritory and pays its own upkeep (kept, not silently re-billed).
    // 'idle' means no OTHER structure is covered; self-only Cabinets therefore never report 'idle' while a foundation stands alone.
    const external = plan.structures.filter(e => e.id !== c.id && !(e.tx === c.tx && e.ty === c.ty) && plan.assigned.get(e.id)?.id === c.id).length; // foundation under the Cabinet supports it, it is not covered
    const state: HomeCabinetState = external === 0 ? 'idle' : !f.funded ? 'unfunded' : f.hours < HOME_LOW_HOURS ? 'low' : 'funded';
    return { id: c.id, tx: c.tx!, ty: c.ty!, state, hours: f.hours, funded: f.funded, count: f.count, external, selfOnly: external === 0, per24h, stock, prepaid };
  });
  const structures = plan.structures.map(e => {
    const c = plan.assigned.get(e.id) ?? null;
    const f = c ? plan.forecast.get(c.id)! : null;
    const funded = !!(c && f?.funded);
    const state: HomeStructureState = !c ? 'uncovered' : funded ? 'funded' : 'unfunded';
    const collapseHours = c ? BAL.territory.unfundedCollapseHours : BAL.territory.unprotectedCollapseHours;
    const hoursToCollapse = funded ? null : (e.hp! / e.maxHp!) * collapseHours;
    return { id: e.id, type: e.type!, name: STRUCTS[e.type!]?.name || e.type!, tx: e.tx!, ty: e.ty!, hp: e.hp!, maxHp: e.maxHp!, damaged: e.hp! < e.maxHp!, state, cabinetId: c?.id ?? null, hoursToCollapse, repairCost: structureRepairCost(e) };
  });
  return { cabinets, structures, uncoveredCount: structures.filter(s => s.state === 'uncovered').length };
}
/** Nearest owned structure to a tile, for the contextual HUD. */
export function nearestHomeStructure(r: RunState, tx: number, ty: number, maxTiles = 6) {
  let best: Entity | null = null, bestD = Infinity;
  for (const e of Object.values(r.entities)) {
    if (e.kind !== 'struct' || (e.owner !== undefined && e.owner !== 'player') || e.tx === undefined || e.ty === undefined || e.hp === undefined || STRUCTS[e.type!]?.item) continue;
    const d = Math.hypot(e.tx - tx, e.ty - ty);
    if (d <= maxTiles && (d < bestD || (d === bestD && e.id.localeCompare(best!.id) < 0))) { best = e; bestD = d; }
  }
  return best;
}
/** Bound at the first exhaustion or real structure collapse. */
export function territoryBoundary(r:RunState,limit:number) {
  let dt=limit;const plan=planTerritory(r);
  for(const f of plan.forecast.values()) if(f.funded && Number.isFinite(f.hours))dt=Math.min(dt,f.hours*HOUR);
  for(const e of plan.structures){const c=plan.assigned.get(e.id);if(!c||!plan.forecast.get(c.id)?.funded)dt=Math.min(dt,e.hp!/(e.maxHp!/(BAL.territory[c?'unfundedCollapseHours':'unprotectedCollapseHours']*HOUR)));}
  return dt;
}
/** Integrate one bounded interval, debiting whole stacks against fractional prepaid credit. */
export function stepTerritory(r:RunState,dt:number,now:number,report?:string[]) {
  if(dt<=0)return false; const plan=planTerritory(r);
  const funded=new Set<string>();
  for(const c of plan.cabinets) { const f=plan.forecast.get(c.id)!; if(!f.funded || !c.c || !c.cabinet)continue; funded.add(c.id);
    for(const [key,rate] of Object.entries(f.rates)) {const need=rate*dt, old=c.cabinet.credit[key]||0, n=Math.max(0,Math.ceil(need-old-1e-9));
      if(n>0){removeItem(r,c.c,key,n);receipt(r,now-dt,'territory.upkeep',`${c.id}:${key}x${n}`);if(report){const prefix=`Cabinet ${c.tx},${c.ty}: ${ITEMS[key].name} spent `;const i=report.findIndex(line=>line.startsWith(prefix));const total=n+(i>=0?Number(report[i].slice(prefix.length)):0);if(i>=0)report[i]=prefix+total;else report.push(prefix+total);}}
      const credit=Math.max(0,old+n-need); if(credit<1e-9) delete c.cabinet.credit[key];else c.cabinet.credit[key]=credit;
    }
  }
  const collapsed:Entity[]=[];
  for(const e of plan.structures) {const c=plan.assigned.get(e.id);if(c&&funded.has(c.id))continue;const before=e.hp!;e.hp=Math.max(0,before-e.maxHp!*dt/(BAL.territory[c?'unfundedCollapseHours':'unprotectedCollapseHours']*HOUR));if(e.hp<=1e-7)collapsed.push(e);}
  const reasons=new Map(collapsed.map(e=>[e.id,plan.assigned.get(e.id)?'unfunded upkeep':'no cabinet coverage']));
  const directlyReported=new Set<string>();
  for(const e of collapsed) if(r.entities[e.id]){directlyReported.add(e.id);const name=STRUCTS[e.type!]?.name||e.type,reason=reasons.get(e.id)!;destroyStructure(r,e,now);receipt(r,now,'territory.collapse',`${e.id}:${name}:${reason}`);if(report)report.push(`${name} collapsed: ${reason}.`);}
  if(report)for(const e of plan.structures)if(!r.entities[e.id]&&!directlyReported.has(e.id))report.push(`${STRUCTS[e.type!]?.name||e.type} was lost with its foundation.`);
  return collapsed.length>0;
}
/** Same materials and HP restored as manual repair; never pays for a destroyed structure. */
export function structureRepairCost(e: Entity): [string, number][] {
  return (STRUCTS[e.type!]?.cost || []).map(([k,q]) => [k, Math.max(1, Math.ceil(q * 0.25))]);
}
/** Rough neutral-exposure forecast; not a safety guarantee or a simulation of combat/environment.
 *
 * CAL-01 / CAL-01.1: thirst is drained at the SAME season-dependent rate the offline settle
 * loop applies — `BAL.player.offlineThirstPerHour x climateAt(player tile).thirstMultiplier` —
 * and the forecast walks that rate across every calendar phase boundary inside the run.
 * CAL-01 C3 keeps the ORIGINAL meaning of the two depletion fields: `hungerHours` and
 * `thirstHours` are "hours until that meter would empty", never "hours left in the run". A
 * logout at h334 with full meters therefore reports ~24 h / ~16 h of depletion and an
 * `emptiesBeforeRunEnd: false` status, because the run expires first — capping them at the
 * 2 h remaining would make the menu claim "hunger empty ~2 h" when nothing empties.
 * Only `survivalHours` is bounded by the remaining run clock, since settlement itself stops
 * at expiry. The estimate is still APPROXIMATE and still ignores what it always ignored:
 * combat, fire, cold/radiation damage, supplies eaten or drunk, weather-driven local events,
 * changing shelter and everything else that can end a run earlier. */
export function offlineSurvivalEstimate(r: RunState) {
  const p=r.player, sheltered=isSheltered(r,p.x,p.y), b=BAL.player;
  const tx=Math.floor(p.x/TILE), ty=Math.floor(p.y/TILE);
  const expiry=r.startedAt-r.qaOffset+BAL.run.maxRunHours*HOUR;
  const runHoursLeft=Math.max(0,(expiry-r.clock.lastSimAt)/HOUR);
  // Depletion time of hunger: the stationarity assumption is unchanged by the calendar.
  const hungerHours=Math.max(0,p.hunger)/b.offlineHungerPerHour;
  // Depletion time of thirst: integrate the real per-phase rate inside the run, then — if the
  // meter would need longer — continue at the rate of the FINAL season phase (the calendar is
  // clamped at phase 7, so no imaginary ninth season is invented and nothing is granted).
  const logoutMultiplier=climateAt(r,tx,ty,r.clock.lastSimAt,'clear').thirstMultiplier;
  let thirst=Math.max(0,p.thirst), at=r.clock.lastSimAt, withinRunHours=0;
  let multiplier=logoutMultiplier, worstMultiplier=logoutMultiplier, leftHours=runHoursLeft;
  for (let guard=0; guard<phaseCount()+2 && thirst>1e-9 && leftHours>1e-9; guard++) {
    multiplier=climateAt(r,tx,ty,at,'clear').thirstMultiplier;
    if (multiplier>worstMultiplier) worstMultiplier=multiplier;
    const rate=b.offlineThirstPerHour*multiplier;           // points per hour, this phase
    if (!(rate>0)) break;
    const boundaryAt=phaseBoundaryAt(r,calendarAt(r,at).phaseIndex+1);
    const hoursHere=Math.min(leftHours, boundaryAt>at ? (boundaryAt-at)/HOUR : leftHours, thirst/rate);
    if (hoursHere<=0) break;
    thirst-=rate*hoursHere; leftHours-=hoursHere; withinRunHours+=hoursHere; at+=hoursHere*HOUR;
  }
  // Counterfactual tail: the meter does not empty before expiry, so its depletion time is
  // extrapolated at the final phase's own rate and reported as beyond the run end.
  const finalMultiplier=climateAt(r,tx,ty,Math.max(r.clock.lastSimAt,expiry-1),'clear').thirstMultiplier;
  const thirstHours=withinRunHours+(thirst>1e-9 && finalMultiplier>0 ? thirst/(b.offlineThirstPerHour*finalMultiplier) : 0);
  const damagePerHour=b.starveDamagePerMin*b.offlineDrainFactor*60;
  let survivalHours: number;
  if (!sheltered) survivalHours=Math.min(hungerHours,thirstHours)+Math.max(0,p.hp)/damagePerHour;
  else { const hpAtThirst=hungerHours<thirstHours ? Math.max(1,p.hp-(thirstHours-hungerHours)*damagePerHour) : p.hp; survivalHours=thirstHours+Math.max(0,hpAtThirst)/damagePerHour; }
  const tolerance=1e-9;
  return {hungerHours,thirstHours,
    // Settlement ends at the fixed 336 h wall time, so survival can never exceed it.
    survivalHours:p.dead?0:Math.min(survivalHours,runHoursLeft),sheltered,
    /** Local seasonal water demand at logout (1 = neutral season, >=1 in a hot season). */
    thirstMultiplier:logoutMultiplier,
    /** Highest local water demand anywhere in the forecast window (1 when no boundary is crossed). */
    thirstMultiplierHorizon:worstMultiplier,
    /** Hours of run clock that remain at logout (the forecast never outlives it). */
    runHoursLeft,
    /** True when the meter would really reach zero before the run's own end. */
    hungerEmptiesBeforeRunEnd:hungerHours<=runHoursLeft+tolerance,
    thirstEmptiesBeforeRunEnd:thirstHours<=runHoursLeft+tolerance,
    /** Depletion extends past the run end: the reported hours are counterfactual, not capped. */
    depletionBeyondRunEnd:Math.min(hungerHours,thirstHours)>runHoursLeft+tolerance,
    /** Explicit scope note for UI/owner handoff; this estimate models thirst and hunger only. */
    scope:'thirst+hunger only; ignores combat, fire, cold/radiation, supplies and season events beyond thirst' as const};
}
/** Both adapters supply roof coverage to the same room traversal. */
export function roofAt(r: RunState, x: number, y: number) {
  if (x < 0 || y < 0 || x >= WW || y >= WH) return false;
  return entsAt(r, x, y).some(e => e.kind === 'struct' && !!STRUCTS[e.type!]?.shelter) ||
    getWorld().buildings.some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
}
function roomWall(r: RunState, x: number, y: number) {
  if (x < 0 || y < 0 || x >= WW || y >= WH) return false;
  const t = effTile(r, x, y); if (t === T.PWALL || t === T.CLIFF) { const door=entsAt(r,x,y).find(e=>e.kind==='door'&&e.open);if(t!==T.PWALL||!door||r.terrain[y*WW+x]||!getWorld().statics.some(s=>s.kind==='door'&&s.tx===x&&s.ty===y))return true; }
  return entsAt(r, x, y).some(e => e.kind === 'struct' && STRUCTS[e.type!]?.layer === 'wall' && !(e.type!.startsWith('door') && e.open) || e.kind === 'door' && !e.open);
}
let roomCache: { run: RunState; start: number; cells: Set<number>; enclosed: boolean } | null = null;
/** Roofed connected room, bounded by world cells rather than an arbitrary size limit.
 * Closed physical walls/doors split rooms; open doors connect or expose them. */
export function roofRoom(r: RunState, px: number, py: number) {
  const sx = Math.floor(px / TILE), sy = Math.floor(py / TILE), start = sy * WW + sx;
  if (roomCache?.run === r && roomCache.start === start) return roomCache;
  const cells = new Set<number>(); let enclosed = roofAt(r, sx, sy) && !roomWall(r, sx, sy);
  if (enclosed) {
    const queue = [start]; cells.add(start);
    for (let n = 0; n < queue.length; n++) {
      const i = queue[n], x = i % WW, y = Math.floor(i / WW);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) { enclosed = false; continue; }
        if (roomWall(r, nx, ny)) continue;
        if (!roofAt(r, nx, ny)) { enclosed = false; continue; }
        const j = ny * WW + nx; if (!cells.has(j)) { cells.add(j); queue.push(j); }
      }
    }
  }
  return roomCache = { run: r, start, cells, enclosed };
}
export function isSheltered(r: RunState, px: number, py: number) { return roofRoom(r, px, py).enclosed; }

/** Built wire-v1 nodes are physical tiles, not proximity links or POI circuits.
 * Player-only pressure plates are evaluated from actual position, including the
 * stationary saved player during offline settlement. No speculative AI movement. */
function wireNodeOn(r:RunState,e:Entity):boolean {
  if(e.kind!=='struct'||!['power_cable','power_switch','pressure_switch','ir_sensor'].includes(e.type||'')||!owned(e)||(e.hp??0)<=0||e.tx===undefined||e.ty===undefined)return false;
  const t=effTile(r,e.tx,e.ty),i=e.ty*WW+e.tx;if([T.DEEP,T.SHALLOW,T.RIVER,T.ICE,T.LAVA,T.CLIFF,T.PWALL].includes(t)||[1,2,3,4,5].includes(blockGrid(r)[i]))return false;
  if(e.type==='ir_sensor')return irSensorConducts(r,e);
  if(e.type==='power_switch')return !!e.wireSwitch?.on;
  if(e.type==='pressure_switch')return !r.player.dead&&Math.hypot(r.player.x-e.x,r.player.y-e.y)<=BAL.homeCircuit.plateRadius;
  return true;
}
/** B02-P1 infrared sensor (ir-v1). Cable-only relay BFS: sensors never relay for each other, so claim, path and
 * conduction never depend on each other (no recursion). Values are SOH_PROVISIONAL in balance irSensorV1. */
function wireRelayOn(r:RunState,n:Entity):boolean { return n.type!=='ir_sensor' && wireNodeOn(r,n); }
function generatorTouching(r:RunState,n:Entity):Entity[] {
  return Object.values(r.entities).filter(g=>g.basePower?.network==='wire-v1'&&owned(g)&&(g.hp??0)>0&&g.tx!==undefined&&g.ty!==undefined&&Math.abs(g.tx!-n.tx!)+Math.abs(g.ty!-n.ty!)===1).sort((a,b)=>a.id.localeCompare(b.id));
}
/** The generator whose cable path reaches this sensor (ignores sensor conduction). Prefers a fuelled, enabled one. */
export function sensorGenerator(r:RunState,sensor:Entity):Entity|undefined {
  if(sensor.tx===undefined||sensor.ty===undefined)return undefined;
  const relays=Object.values(r.entities).filter(n=>n.kind==='struct'&&n.tx!==undefined&&wireRelayOn(r,n));
  const cells=new Map(relays.map(n=>[`${n.tx},${n.ty}`,n]));
  const found:Entity[]=[];const q:Entity[]=[],seen=new Set<string>();
  for(const g of generatorTouching(r,sensor))found.push(g);
  for(const n of relays)if(Math.abs(n.tx!-sensor.tx)+Math.abs(n.ty!-sensor.ty)===1){q.push(n);seen.add(n.id);}
  for(let h=0;h<q.length;h++){const n=q[h];found.push(...generatorTouching(r,n));
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cells.get(`${n.tx!+dx},${n.ty!+dy}`);if(nx&&!seen.has(nx.id)){seen.add(nx.id);q.push(nx);}}}
  const uniq=[...new Map(found.map(g=>[g.id,g])).values()].sort((a,b)=>a.id.localeCompare(b.id));
  return uniq.find(g=>g.basePower?.enabled&&hasPowerFuel(r,g))??uniq[0];
}
/** Enabled sensors on this generator claim capacity in ID order, up to the generator's capacity. Fuel-gated. */
export function sensorClaims(r:RunState,g:Entity):Entity[] {
  if(!g.basePower?.enabled||!owned(g)||(g.hp??1)<=0||!hasPowerFuel(r,g))return [];
  return Object.values(r.entities).filter(e=>e.type==='ir_sensor'&&e.irSensor?.enabled&&owned(e)&&(e.hp??0)>0&&sensorGenerator(r,e)?.id===g.id)
    .sort((a,b)=>a.id.localeCompare(b.id)).slice(0,Math.floor((g.basePower.capacity??1)/BAL.irSensorV1.capacitySlots));
}
/** Line of sight and range only: walls and solid blocks stop it; sleeping and offline-unresolved monsters are never sensed. */
export function irSensorSees(r:RunState,e:Entity):{ visible:boolean; blockedInRange:boolean } {
  const range=BAL.irSensorV1.rangeTiles*TILE;let visible=false,blockedInRange=false;
  const check=(p:{x:number;y:number})=>{ if(dist(e.x,e.y,p.x,p.y)>range)return; if(clearPhysicalLine(r,e,p,true,true))visible=true; else blockedInRange=true; };
  if(!r.player.dead)check(r.player);
  for(const m of r.creatures) if(m.state!=='dead'&&m.state!=='sleep'&&m.offlineUnresolvedAt===undefined&&(CREATURES[m.type]?.aggro||(m as any).prov)) check(m);
  return { visible, blockedInRange };
}
export function irSensorConducts(r:RunState,e:Entity):boolean {
  if(!e.irSensor?.enabled)return false;
  const g=sensorGenerator(r,e);if(!g)return false;
  if(!sensorClaims(r,g).some(x=>x.id===e.id))return false;
  return irSensorSees(r,e).visible;
}
export function irSensorStatus(r:RunState,e:Entity):string {
  if(!e.irSensor)return 'Not installed';if(!e.irSensor.enabled)return 'Off';
  const g=sensorGenerator(r,e);if(!g)return 'No cable to a generator';
  if(!g.basePower?.enabled)return 'Generator off';if(!hasPowerFuel(r,g))return 'No fuel';
  if(!sensorClaims(r,g).some(x=>x.id===e.id))return 'Capacity full';
  const v=irSensorSees(r,e);return v.visible?'Target in clear line: conducting':v.blockedInRange?'Blocked by wall: not conducting':'Watching: clear';
}
/** B04-P3 downstream readout for the sensor prompt: only real powered doors on the same wire-v1 network, and only while conducting. */
/** B04-P4 sprite state for the sensor: same branches as irSensorStatus, returned as a key. */
export function irSensorVisual(r:RunState,e:Entity):'off'|'unpowered'|'ready'|'detect'|'blocked' {
  if(!e.irSensor||!e.irSensor.enabled)return 'off';
  const g=sensorGenerator(r,e);
  if(!g||!g.basePower?.enabled||!hasPowerFuel(r,g)||!sensorClaims(r,g).some(x=>x.id===e.id))return 'unpowered';
  const v=irSensorSees(r,e);return v.visible?'detect':v.blockedInRange?'blocked':'ready';
}
export function irSensorDownstream(r:RunState,e:Entity):string {
  if(!irSensorConducts(r,e))return '';
  // B04-P4: count only doors fed by THIS sensor's generator network (not any powered door in the run).
  const g=sensorGenerator(r,e);
  const doors=Object.values(r.entities).filter(d=>d.type==='door_powered'&&owned(d)&&(d.hp??0)>0&&electricDoorGenerator(r,d)?.id===g?.id&&electricDoorPowered(r,d)).length;
  return doors?`, powers ${doors} door${doors>1?'s':''}`:', no powered door on this network';
}
export function wireReachable(r:RunState,g:Entity,e:Entity):boolean {
  if(!g.basePower||g.basePower.network!=='wire-v1'||!owned(g)||!owned(e)||(g.hp??0)<=0||(e.hp??0)<=0||g.tx===undefined||g.ty===undefined||e.tx===undefined||e.ty===undefined)return false;
  const nodes=Object.values(r.entities).filter(n=>wireNodeOn(r,n));const cells=new Map(nodes.map(n=>[`${n.tx},${n.ty}`,n]));
  const q:Entity[]=[],seen=new Set<string>();for(const n of nodes)if(Math.abs(n.tx!-g.tx)+Math.abs(n.ty!-g.ty)===1){q.push(n);seen.add(n.id);}
  for(let head=0;head<q.length;head++){const n=q[head];if(Math.abs(n.tx!-e.tx)+Math.abs(n.ty!-e.ty)===1)return true;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=cells.get(`${n.tx!+dx},${n.ty!+dy}`);if(next&&!seen.has(next.id)){seen.add(next.id);q.push(next);}}
  }return false;
}
/** An electric door is assigned to the lowest stable connected generator ID. */
export function electricDoorGenerator(r:RunState,e:Entity):Entity|undefined {
  return Object.values(r.entities).filter(g=>g.basePower?.network==='wire-v1'&&wireReachable(r,g,e)).sort((a,b)=>a.id.localeCompare(b.id))[0];
}
export function electricDoorPowered(r:RunState,e:Entity,online=true):boolean {
  const g=electricDoorGenerator(r,e);return !!g&&powerAllocation(r,g,online).includes(e);
}
export function electricInterior(r:RunState,e:Entity):boolean {
  const v=e.electricDoor?.interior;if(!v)return false;const dx=r.player.x-e.x,dy=r.player.y-e.y;
  return dx*v[0]+dy*v[1]>=TILE*BAL.homeCircuit.interiorDepthTiles&&Math.abs(dx*v[1]-dy*v[0])<TILE*BAL.homeCircuit.interiorHalfWidthTiles;
}
export function syncElectricDoors(r:RunState,now:number,online=true):string[] {
  const closed:string[]=[];for(const e of Object.values(r.entities))if(e.electricDoor&&e.open&&!electricDoorPowered(r,e,online)&&(e.electricDoor.releaseUntil??0)<=now&&!doorwayOccupied(r,e)){e.open=false;closed.push(e.id);}
  if(closed.length)markDirty();return closed;
}

/** Optional industrial power shares real capacity with existing turret loads. */
export function connectedPower(r:RunState,g:Entity,e:Entity) {
  if(g.basePower?.network==='wire-v1')return wireReachable(r,g,e);
  return owned(e) && (e.hp??1)>0 && dist(e.x,e.y,g.x,g.y)<=BAL.industrialPower.connectionTiles*TILE && clearPhysicalLine(r,e,g,true,true);
}
function hasPowerFuel(r:RunState,g:Entity) {
  return !!g.basePower && !!g.c && (g.basePower.energy>1e-8 || C(r,g.c).slots.some(s=>s&&!!ITEMS[s.key]?.fuel));
}
/** Stable allocation order; priority is a player choice, not a magic extra load. */
export function powerAllocation(r:RunState,g:Entity,_online=true):Entity[] {
  if(!g.basePower?.enabled || !owned(g) || (g.hp??1)<=0 || !hasPowerFuel(r,g))return [];
  const sensors=sensorClaims(r,g);const freeCapacity=(g.basePower.capacity??1)-sensors.length;
  // W07 Network A: an armed, supplied, wired turret reserves capacity and burns fuel whether or not the player is online.
  // Firing stays online-only (tickTurrets), but the draw must not vanish when the player leaves: offline and online share one allocation.
  const choices=Object.values(r.entities).filter(e=>e.type!=='ir_sensor'&&connectedPower(r,g,e) && (
    e.turret?.enabled && e.turret.generatorId===g.id && !!e.c && countItem(r,e.c,'arrow')>0 ||
    e.type==='workbench' && e.industrial?.enabled && e.industrial.generatorId===g.id && !!e.station?.queue[0] && e.station.queue[0].left>0 ||
    !!e.electricDoor && electricDoorGenerator(r,e)?.id===g.id));
  const priority=g.basePower.priority??'defense';
  choices.sort((a,b)=>{const rank=(e:Entity)=>priority==='defense' ? (e.turret?0:e.electricDoor?1:2) : (e.industrial?0:e.electricDoor?1:2);return rank(a)-rank(b)||a.id.localeCompare(b.id);});
  return [...sensors, ...choices.slice(0,Math.max(0,freeCapacity))];
}
export function industrialStatus(r:RunState,e:Entity):string {
  if(!e.industrial)return 'Not installed';if(!e.industrial.enabled)return 'Off';
  const g=e.industrial.generatorId?r.entities[e.industrial.generatorId]:undefined;
  if(!g?.basePower || g.type!=='base_generator' || !owned(g))return 'No generator';
  if(!connectedPower(r,g,e))return 'Connection blocked';if(!g.basePower.enabled)return 'Generator off';
  if(!hasPowerFuel(r,g))return 'No power';if(!e.station?.queue[0] || e.station.queue[0].left<=0)return 'Idle';
  return powerAllocation(r,g).includes(e)?'Powered':'Capacity allocated elsewhere';
}
export function turretStatus(r: RunState, e: Entity): string {
  const t=e.turret; if (!t?.enabled) return 'Off'; const g=t.generatorId ? r.entities[t.generatorId] : undefined;
  if (!g?.basePower || g.type!=='base_generator' || !owned(g)) return 'No generator';
  if (!connectedPower(r,g,e)) return 'Connection blocked';
  if (!g.basePower.enabled) return 'Generator off'; if (!hasPowerFuel(r,g)) return 'No power';
  if (!e.c || countItem(r,e.c,'arrow')<1) return 'No arrows';
  if(!powerAllocation(r,g).includes(e))return 'Capacity allocated elsewhere'; return 'Ready';
}
/** Split the common timeline at the next generator fuel boundary. */
export function basePowerBoundary(r:RunState,limit:number,online=true):number {
  let result=limit;for(const g of Object.values(r.entities)){if(!g.basePower?.enabled||!g.c)continue;
    let fuel=g.basePower.energy;if(fuel<=1e-8){const s=C(r,g.c).slots.find(s=>s&&ITEMS[s.key]?.fuel);fuel=s?ITEMS[s.key].fuel!*1000:0;}
    if(fuel>1e-8)result=Math.min(result,fuel/Math.max(1,powerAllocation(r,g,online).length));
  }return result;
}
/** Fuel is consumed exactly once over each chronological interval. */
export function stepBasePower(r: RunState, dt: number, now: number, online=true) {
  for (const e of Object.values(r.entities)) { const power=e.basePower; if (!power?.enabled || !e.c) continue;
    const load=Math.max(1,powerAllocation(r,e,online).length);let left=dt*load;
    while(left>1e-8){if(power.energy<=1e-8){const slot=C(r,e.c).slots.find(s=>s&&ITEMS[s.key]?.fuel);if(!slot){power.energy=0;break;}power.energy=ITEMS[slot.key].fuel!*1000;const key=slot.key;removeItem(r,e.c,key,1);receipt(r,now-left/load,'power.fuel',`${e.id}:${key}`);}
      const used=Math.min(left,power.energy);power.energy-=used;left-=used;
    }
  }
}

// ---------------- custody (K1) ----------------
export const C = (r: RunState, id: string): Container => typeof id === 'string' && Object.prototype.hasOwnProperty.call(r.custody, id) ? r.custody[id] : undefined as unknown as Container;
export function countItem(r: RunState, cid: string, key: string) { return C(r, cid).slots.reduce((a, s) => a + (s && s.key === key ? s.qty : 0), 0); }
export function spaceFor(r: RunState, cid: string, key: string) {
  const d = ITEMS[key]; const uniqueCard=key==='keycard'&&r.poiAccessVersion==='poi-access-v1'; let n = 0; for (const s of C(r, cid).slots) { if (!s) n += uniqueCard?1:d.max; else if (!uniqueCard && s.key === key && d.max > 1 && s.meta === undefined && s.dur === undefined && s.charge === undefined && !d.dur && !d.charge) n += d.max - s.qty; } return n;
}
/** Adds qty; returns leftover that did not fit (caller decides what to do — never silently deleted). */
export function addItem(r: RunState, cid: string, key: string, qty: number, tmpl?: Partial<Stack>): number {
  const d = ITEMS[key]; const c = C(r, cid);
  if (!(key==='keycard'&&r.poiAccessVersion==='poi-access-v1') && d.max > 1 && !d.dur && !d.charge && tmpl?.meta === undefined && tmpl?.dur === undefined && tmpl?.charge === undefined) for (const s of c.slots) if (s && s.key === key && s.meta === undefined && s.dur === undefined && s.charge === undefined && s.qty < d.max && qty > 0) { const m = Math.min(qty, d.max - s.qty); s.qty += m; qty -= m; }
  for (let i = 0; i < c.slots.length && qty > 0; i++) if (!c.slots[i]) { const m = Math.min(qty, key==='keycard'&&r.poiAccessVersion==='poi-access-v1'?1:d.max); const s = mkStack(r, key, m, tmpl?.meta); if (tmpl?.charge !== undefined) s.charge = tmpl.charge; if (tmpl?.dur !== undefined) s.dur = tmpl.dur; c.slots[i] = s; qty -= m; }
  return qty;
}
/** K1 custody law: a whole stack moved into an EMPTY slot keeps its UID — the move is one custody
 * transfer, never a re-mint of the item. Only when no empty slot exists may a stackable stack merge
 * into receivers (receivers keep their UIDs; the source stack lineage retires entirely, never duplicated).
 * Sole caller: the pickup path (engine.ts, case 'pickup'). */
export function addStack(r: RunState, cid: string, s: Stack): boolean {
  const c = C(r, cid); const d = ITEMS[s.key];
  const i = c.slots.indexOf(null);
  if (i >= 0) { c.slots[i] = s; return true; }
  // No empty slot: legitimate merge-lineage for stackable stacks (exact material conservation;
  // the source stack is consumed by the caller after this returns true).
  if (s.key!=='keycard' && d.max > 1 && s.meta === undefined && s.dur === undefined && s.charge === undefined) { const room = spaceFor(r, cid, s.key); if (room >= s.qty) { addItem(r, cid, s.key, s.qty); return true; } }
  return false;
}
// Unique or stateful stacks must never be merged into a different instance.
function mergeable(a: Stack, b: Stack) {
  return a.key === b.key && a.key!=='keycard' && ITEMS[a.key].max > 1 && a.meta === undefined && b.meta === undefined &&
    a.dur === undefined && b.dur === undefined && a.charge === undefined && b.charge === undefined;
}
function portion(r: RunState, s: Stack, qty: number): Stack {
  return { ...s, uid: uid(r, 's'), qty };
}
/** Reserve exactly the paid physical stacks; split only when part of a stack is paid. */
/** Every output a recipe commits together (single-output recipes return one entry). */
export function recipeOutputs(rc: { out: string; qty: number; outs?: [string, number][] }): [string, number][] {
  return rc.outs ?? [[rc.out, rc.qty]];
}
function reserveInputs(r: RunState, ins: [string, number][]): Stack[] {
  const c = C(r, 'inv'); const reserved: Stack[] = [];
  for (const [key, amount] of ins) {
    let left = amount;
    for (let i = c.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = c.slots[i]; if (!s || s.key !== key) continue;
      const n = Math.min(left, s.qty);
      if (n === s.qty) { reserved.push(s); c.slots[i] = null; }
      else { reserved.push(portion(r, s, n)); s.qty -= n; }
      left -= n;
    }
    if (left) throw new Error('reservation underflow');
  }
  return reserved;
}
/** Return original instances without merging. Full inventories produce physical drops. */
function returnReservations(r: RunState, stacks: Stack[], x: number, y: number, now: number) {
  const inv = C(r, 'inv');
  for (const stack of stacks) {
    const slot = inv.slots.indexOf(null);
    if (slot >= 0) inv.slots[slot] = stack;
    else dropStackEntity(r, stack, x, y, now);
  }
}
export function removeItem(r: RunState, cid: string, key: string, qty: number) {
  const c = C(r, cid); for (let i = c.slots.length - 1; i >= 0 && qty > 0; i--) { const s = c.slots[i]; if (s && s.key === key) { const m = Math.min(qty, s.qty); s.qty -= m; qty -= m; if (s.qty <= 0) c.slots[i] = null; } }
  if (qty > 0) throw new Error('removeItem underflow — validation bug');
}
export function invWeight(r: RunState) { let w = 0; for (const cid of ['inv', 'eq']) for (const s of C(r, cid).slots) if (s) w += ITEMS[s.key].w * s.qty; return w; }
export function carryLimit(r: RunState) { return BAL.player.carryLimit + C(r, 'eq').slots.reduce((sum, s) => sum + (s ? ITEMS[s.key].carryBonus ?? 0 : 0), 0); }
export function cartLimit(e: Entity | undefined) { return e?.deployed?.upgrade === 'freight' ? BAL.cart.freightMaxWeight : BAL.cart.maxWeight; }
export function cartWeight(r: RunState, cid: string) { return C(r, cid).slots.reduce((a, s) => a + (s ? ITEMS[s.key].w * s.qty : 0), 0); }
export function hasAll(r: RunState, cid: string, ins: [string, number][]) { return ins.every(([k, q]) => countItem(r, cid, k) >= q); }
export function spawnDrop(r: RunState, key: string, qty: number, x: number, y: number, now: number, tmpl?: Partial<Stack>, burst = true): Entity {
  const max = key==='keycard'&&r.poiAccessVersion==='poi-access-v1' ? 1 : ITEMS[key].max;
  if (qty > max) { const first = spawnDrop(r, key, max, x, y, now, tmpl, burst); spawnDrop(r, key, qty - max, x, y, now, tmpl, burst); return first; }
  const c = mkContainer(r, 'drop', 1); const s = mkStack(r, key, qty, tmpl?.meta); if (tmpl?.charge !== undefined) s.charge = tmpl.charge; if (tmpl?.dur !== undefined) s.dur = tmpl.dur; c.slots[0] = s;
  const a = rngNext(r) * Math.PI * 2, sp = burst ? 30 + rngNext(r) * 40 : 0;
  const e: Entity = { id: uid(r, 'd'), kind: 'drop', x, y, c: c.id, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now }; r.entities[e.id] = e; return e;
}
function dropStackEntity(r: RunState, s: Stack, x: number, y: number, now: number) { const c = mkContainer(r, 'drop', 1); c.slots[0] = s; const e: Entity = { id: uid(r, 'd'), kind: 'drop', x, y, c: c.id, vx: 0, vy: 0, born: now }; r.entities[e.id] = e; return e; }
function giveOrDrop(r: RunState, key: string, qty: number, now: number, tmpl?: Partial<Stack>) { const left = addItem(r, 'inv', key, qty, tmpl); if (left > 0) spawnDrop(r, key, left, r.player.x, r.player.y, now, tmpl); }
/** Move an entire container's contents into a physical bag at (x,y) — used for death/reclaim/destroyed chests. No deletion, no duplication. */
export function bagContainers(r: RunState, cids: string[], x: number, y: number, now: number, label: string, extra: Stack[] = [], legacyJobs?: Entity['legacyJobs'], force = false) {
  const stacks: Stack[] = [...extra]; for (const cid of cids) { const c = C(r, cid); if (!c) continue; for (let i = 0; i < c.slots.length; i++) if (c.slots[i]) { stacks.push(c.slots[i]!); c.slots[i] = null; } }
  if (!stacks.length && !legacyJobs?.queue.length && !force) return null;
  const bag = mkContainer(r, 'bag', Math.max(8, stacks.length)); stacks.forEach((s, i) => (bag.slots[i] = s));
  const e: Entity = { id: uid(r, 'b'), kind: 'bag', x, y, c: bag.id, label, born: now, legacyJobs }; r.entities[e.id] = e; return e;
}
/** Station-owned reservations and contents leave together on reclaim or destruction. */
export function bagStation(r: RunState, e: Entity, now: number, label: string) {
  const queue = e.station?.queue || [];
  const reserved = queue.flatMap(j => j.reserved || []);
  const legacy = queue.filter(j => j.reserved === undefined);
  const bag = bagContainers(r, [e.c, e.station?.fuelC, e.station?.outC].filter(Boolean) as string[], e.x, e.y + 4, now, label, reserved,
    legacy.length ? { stationType: e.type!, queue: legacy } : undefined);
  if (e.station) e.station.queue = [];
  return bag;
}
function removeEntity(r: RunState, e: Entity) {  if (r.rest && (e.id === r.rest.bedId || e.id === r.rest.chestId)) endRest(r, r.clock.lastSimAt, 'bed or chest removed');  for(const other of Object.values(r.entities)) if(other.maintenance?.chestId===e.id) { delete other.maintenance.chestId; other.maintenance.enabled=false; } if(e.basePower)for(const other of Object.values(r.entities)){if(other.turret?.generatorId===e.id)delete other.turret.generatorId;if(other.industrial?.generatorId===e.id)delete other.industrial.generatorId;} delete r.entities[e.id]; for (const cid of [e.c, e.station?.fuelC, e.station?.outC]) if (cid) delete r.custody[cid]; if(e.type==='claim' || STRUCTS[e.type!]?.layer==='floor')refreshTerritoryLinks(r); markDirty(); }

/** Chronological event authority shared by online and offline advancement. */
export function airdropBoundary(r:RunState,t:number,dt:number):number {
  for(const s of r.worldStimuli||[])if(s.expiresAt>t)dt=Math.min(dt,s.expiresAt-t);
  for(const m of r.creatures)if(m.knows?.kind==='stimulus'&&m.knows.expiresAt!>t)dt=Math.min(dt,m.knows.expiresAt!-t);
  if(!r.airdrops)return dt;
  if(r.airdrops.nextIndex<BAL.airdropV1.maxEvents){const n=airdropTimes(r,r.airdrops.nextIndex).signalAt;if(n>t)dt=Math.min(dt,n-t);}
  for(const e of Object.values(r.entities))if(e.kind==='airdrop'&&e.airdrop){const a=e.airdrop;for(const n of [a.descentAt,a.landAt,a.unlockAt,a.expiresAt])if(n>t)dt=Math.min(dt,n-t);}
  return dt;
}
export function stepAirdrops(r:RunState,at:number,report?:string[]) {
  if(r.worldStimuli)r.worldStimuli=r.worldStimuli.filter(s=>s.expiresAt>at);
  for(const m of r.creatures)if(m.knows?.kind==='stimulus' && m.knows.expiresAt!<=at){const id=m.knows.sourceId;m.knows=null;delete m.stimulusRouteAt;m.path=null;if(m.state==='track'){m.state='wander';m.t=0;}receipt(r,at,'stimulus.lost',`${m.id}:${id}:expired`);}
  const d=r.airdrops;if(!d)return;
  const say=(msg:string)=>{pushLog(r,at,msg,'gold');if(report)report.push(msg);};
  while(d.nextIndex<BAL.airdropV1.maxEvents && airdropTimes(r,d.nextIndex).signalAt<=at){
    const index=d.nextIndex++, times=airdropTimes(r,index);markDirty();const site=chooseAirdropSite(r,index,blockGrid(r));
    if(!site){receipt(r,at,'airdrop.skipped',String(index));say(`Airdrop ${index+1} skipped: no reachable legal landing site.`);continue;}
    const c=mkContainer(r,'loot',3),e:Entity={id:uid(r,'e'),kind:'airdrop',tx:site.tx,ty:site.ty,x:site.tx*TILE+8,y:site.ty*TILE+8,c:c.id,airdrop:{index,phase:'signal',...times}};r.entities[e.id]=e;
    const zone=airdropArea(site.tx,site.ty);
    receipt(r,at,'airdrop.signal',`${index}:${zone}`);say(`Airdrop incoming near ${zone}; exact landing unknown.`);
  }
  for(const e of Object.values(r.entities)){if(e.kind!=='airdrop'||!e.airdrop)continue;const a=e.airdrop;
    if(a.phase==='signal'&&at>=a.descentAt){a.phase='descending';receipt(r,at,'airdrop.descent',String(a.index));}
    if(a.phase==='descending'&&at>=a.landAt){
      markDirty();const grid=blockGrid(r),rad=BAL.airdropV1.clearanceTiles,tx=e.tx!,ty=e.ty!;
      let clear=airdropStaticEligible(getWorld(r.layoutId||'shipping'),tx,ty);
      for(let dy=-rad;dy<=rad&&clear;dy++)for(let dx=-rad;dx<=rad;dx++){const i=(ty+dy)*WW+tx+dx;if([1,2,3,5].includes(grid[i])||Object.values(r.entities).some(v=>v.id!==e.id&&Math.floor(v.x/TILE)===tx+dx&&Math.floor(v.y/TILE)===ty+dy)||r.natureTrees?.some(v=>v.tx===tx+dx&&v.ty===ty+dy)){clear=false;break;}}
      if(!r.player.dead&&Math.abs(r.player.x-e.x)<(rad+1)*TILE&&Math.abs(r.player.y-e.y)<(rad+1)*TILE)clear=false;
      if(r.creatures.some(m=>m.state!=='dead'&&Math.abs(m.x-e.x)<(rad+1)*TILE&&Math.abs(m.y-e.y)<(rad+1)*TILE))clear=false;
      if(!clear){receipt(r,at,'airdrop.aborted',String(a.index));say(`Airdrop ${a.index+1} aborted: landing obstructed.`);removeEntity(r,e);continue;}
      const c=C(r,e.c!);airdropRewards(r,a.index).forEach(([key,qty],i)=>c.slots[i]=mkStack(r,key,qty));a.phase='locked';markDirty();receipt(r,at,'airdrop.landed',String(a.index));const cue=landingStimulus(r,e,a.landAt);r.worldStimuli??=[];if(!r.worldStimuli.some(s=>s.id===cue.id)){r.worldStimuli.push(cue);receipt(r,a.landAt,'stimulus.emit',`${cue.id}@${e.tx},${e.ty}`);}
    }
    if(a.phase==='locked'&&at>=a.unlockAt){a.phase='open';receipt(r,at,'airdrop.accessible',String(a.index));}
    if(at>=a.expiresAt){const missed=C(r,e.c!).slots.some(Boolean);receipt(r,at,'airdrop.expired',`${a.index}:${missed?'stock lost':'empty'}`);if(missed)say(`Airdrop ${a.index+1} expired with unclaimed stock.`);removeEntity(r,e);}
  }
}

/** Versioned SOH-only renewable stock policy. Unique technology, credentials,
 * equipment, and damaged drives remain finite; cash is never a loot site. */
export function renewableLoot(site: StaticEnt): [string, number][] {
  return (site.loot || []).filter(([k]) => k !== 'damaged_drive' && !!ITEMS[k] && ['res', 'food'].includes(ITEMS[k].cat));
}
/** Physical access to a static cache from the run spawn, using the real collision grid (blockedAt: terrain, buildings, closed doors).
 * 'open': a tile within interaction range is reachable with no door opened. 'door-required': only reachable if every door is opened.
 * 'unreachable': not reachable even then. Never grants access: this only measures geometry. */
export function lootSiteAccess(r: RunState, site: StaticEnt): PhysicalAccess {
  const doorTiles = new Set(Object.values(r.entities).filter(e => e.kind === 'door' && e.tx !== undefined && e.ty !== undefined).map(e => e.ty! * WW + e.tx!));
  const start = Math.floor(r.player.y / TILE) * WW + Math.floor(r.player.x / TILE);
  const near = (i: number) => { const x = i % WW, y = (i / WW) | 0; return Math.hypot(x - site.tx, y - site.ty) <= 2.2; };
  const reach = (allowDoors: boolean): boolean => {
    const seen = new Uint8Array(WW * WH); const q: number[] = [start]; seen[start] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h]; if (near(i)) return true;
      const x = i % WW, y = (i / WW) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue;
        const j = ny * WW + nx; if (seen[j]) continue;
        if (blockedAt(r, nx, ny) && !(allowDoors && doorTiles.has(j))) continue;
        seen[j] = 1; q.push(j);
      }
    }
    return false;
  };
  if (reach(false)) return 'open';
  if (reach(true)) return 'door-required';
  return 'unreachable';
}
export function lootCooldown(site: StaticEnt, r?:RunState): number {
  const spec = r?.lootEcology?.grammar === LOOT_GRAMMAR_CURRENT ? specForSite(site) : null; if (spec) return spec.cooldownHours*HOUR;
  const kind=r?.lootEcology && lootClass(site); if(kind)return LOOT_CLASSES[kind].hours*HOUR;
  const stock = renewableLoot(site);
  const industrial = stock.some(([k]) => ['spares', 'scrap', 'iron_ore', 'iron_ingot', 'coal', 'mechanical_parts', 'fasteners'].includes(k));
  const food = stock.some(([k]) => ITEMS[k]?.cat === 'food');
  return (industrial ? BAL.lootRespawn.industrialHours : food ? BAL.lootRespawn.supplyHours : BAL.lootRespawn.otherHours) * HOUR;
}
/** Ordinary replenishment is the old authored renewable stock plus a bounded W06 roll. */
/** W06 class renewal is pinned and unchanged. B05 'finite' stock governs only the grammar pool (see lootGrammarRoll). */
export function renewableStock(r:RunState,site:StaticEnt,cycle:number):[string,number][] {return [...renewableLoot(site),...lootRoll(r,site,cycle)];}
/** Retire an authored public loot instance only after an actual final withdrawal. */
function retireEmptyLoot(r: RunState, cid: string, now: number) {
  const e = Object.values(r.entities).find(v => v.kind === 'loot' && v.c === cid);
  const c = r.custody[cid];
  if (!e || !c || c.slots.some(Boolean) || !Number.isInteger(e.tx) || !Number.isInteger(e.ty)) return;
  const site = getWorld(r.layoutId || 'shipping').statics.find(s => s.kind === 'loot' && s.tx === e.tx && s.ty === e.ty);
  if (!site) return;
  const index = e.ty! * WW + e.tx!;
  (r.depletedLootSites ??= []).push(index);
  if (renewableStock(r,site,(r.lootEcology?.cycles[index]||0)+1).length) (r.lootRespawnAt ??= {})[index] = now + lootCooldown(site,r);
  removeEntity(r, e);
  receipt(r, now, 'loot.depleted', `${index}:${e.id}`);
}
/** W00 saves did not record depletion time: start a full cooldown at the
 * first observed time, not the old checkpoint time. */
export function migrateLootRespawn(r: RunState, now: number) {
  if (!r.depletedLootSites?.length) return;
  const world = getWorld(r.layoutId || 'shipping');
  for (const index of r.depletedLootSites) {
    const site = world.statics.find(s => s.kind === 'loot' && s.ty * WW + s.tx === index);
    if (!site || !renewableStock(r,site,(r.lootEcology?.cycles[index]||0)+1).length) continue;
    const timers = r.lootRespawnAt ??= {};
    if (timers[index] === undefined) timers[index] = now + lootCooldown(site,r);
  }
}
/** Called by the same run-clock settlement path for online and offline time. */
export function stepLootRespawn(r: RunState, now: number) {
  if (!r.depletedLootSites?.length) return;
  const world = getWorld(r.layoutId || 'shipping');
  for (const index of [...r.depletedLootSites]) {
    const site = world.statics.find(s => s.kind === 'loot' && s.ty * WW + s.tx === index);
    if (!site) continue;
    const cycle=(r.lootEcology?.cycles[index]||0)+1; const stock = renewableStock(r,site,cycle); if (!stock.length) continue;
    const timers = r.lootRespawnAt ??= {};
    if (timers[index] === undefined) continue;
    if (timers[index] > now) continue;
    // Never spawn on a newly built physical object; retry at later settlement.
    if (Object.values(r.entities).some(e => e.tx === site.tx && e.ty === site.ty && ['loot','struct','door','gen','recycler'].includes(e.kind))) continue;
    const e: Entity = { id: uid(r, 'e'), kind: 'loot', x: site.tx * TILE + 8, y: site.ty * TILE + 8, tx: site.tx, ty: site.ty, poi: site.poi, label: site.label };
    const c = mkContainer(r, 'loot', lootSlots(r)); e.c = c.id;
    stock.forEach(([key, qty], i) => { c.slots[i] = mkStack(r, key, qty); if(r.lootEcology && lootClass(site)) receipt(r,now,'loot.roll',`${lootSourceId(r,site)}:${LOOT_ECOLOGY_VERSION}:cycle${cycle}:slot${i}:${key}x${qty}:${c.slots[i]!.uid}`); });
    if(r.lootEcology && lootClass(site))r.lootEcology.cycles[lootSiteIndex(site)]=cycle;
    r.entities[e.id] = e; delete timers[index];
    if(r.creatorLootV1 && !(r.renewedLootSites||[]).includes(index)) (r.renewedLootSites ??= []).push(index);
    r.depletedLootSites = r.depletedLootSites.filter(i => i !== index);
    markDirty(); receipt(r, now, 'loot.respawn', `${index}:${e.id}`);
  }
}
/** Destruction and reclaim share the same custody transition. */
export function destroyStructure(r: RunState, e: Entity, now: number) {
  if (r.entities[e.id] !== e || e.kind !== 'struct') return null;
  if (r.rest && (e.id === r.rest.bedId || e.id === r.rest.chestId)) endRest(r, now, 'bed or chest destroyed');
  if (STRUCTS[e.type!]?.layer === 'floor') for (const cabinet of [...entsAt(r,e.tx!,e.ty!)]) if(cabinet.type==='claim' && cabinet.cabinet?.legacy!==true) { destroyStructure(r,cabinet,now); receipt(r,now,'territory.collapse',`${cabinet.id}:lost foundation`); }
  if (STRUCTS[e.type!]?.layer === 'floor') for (const roof of [...entsAt(r, e.tx!, e.ty!)]) if (roof.kind === 'struct' && STRUCTS[roof.type!]?.layer === 'roof') { destroyStructure(r, roof, now); receipt(r, now, 'struct.destroyed', `${roof.type}:lost support`); }
  const bag = bagStation(r, e, now, 'Wreckage'); removeEntity(r, e); return bag;
}

// ---------------- achievements & score (C20/C21) ----------------
export function award(gs: GameState, key: string, now: number) {
  const r = gs.run!; if (r.achievements.includes(key)) return;
  const a = ACHIEVEMENTS[key]; r.achievements.push(key); r.score += a.score;
  if (!gs.profile.achievements[key]) gs.profile.achievements[key] = { at: now, score: a.score, runId: r.id };
  receipt(r, now, 'achievement', key); pushLog(r, now, `Achievement — ${a.name} (+${a.score} local score)`, 'gold');
}

// ---------------- combat / harvesting shared hit rules (C05) ----------------
export function harvestHit(gs: GameState, tx: number, ty: number, power: Partial<Record<string, number>>, now: number, fromX: number, fromY: number): { result: 'yield' | 'nopower' | 'empty' | 'none'; key?: string; got?: number; mat?: string; depleted?: boolean } {
  const r = gs.run!; const s = sourceAt(r, tx, ty, now); if (!s) return { result: 'none' };
  if (s.stock <= 0) return { result: 'empty', key: s.key, mat: s.def.mat };
  const p = power[s.def.mat] || 0; if (p <= 0) return { result: 'nopower', key: s.key, mat: s.def.mat };
  const st = r.sources[s.i] || (r.sources[s.i] = { stock: s.stock, hp: s.hp, burnt: s.st?.burnt });
  const per = s.def.hp / s.def.stock; const before = Math.ceil(st.hp / per - 1e-9);
  st.hp = Math.max(0, st.hp - p); const after = Math.ceil(st.hp / per - 1e-9); let units = Math.min(st.stock, before - after);
  let got = 0; const cx = tx * TILE + 8, cy = ty * TILE + 8;
  const ox = (fromX - cx) * 0.3, oy = (fromY - cy) * 0.3;
  for (let u = 0; u < units; u++) {
    st.stock--; for (const [k, q] of s.def.yields) { spawnDrop(r, k, q, cx + ox, cy + oy, now); got += q; }
    for (const [k, ch] of (s.key === 'wreck' ? wreckBonuses(r) : s.def.bonus || [])) if (rngNext(r) < ch) { const drop=spawnDrop(r, k, 1, cx + ox, cy + oy, now); if(k==='damaged_drive')receipt(r,now,'harvest.component',`${s.key}@${tx},${ty}:${C(r,drop.c!).slots[0]!.uid}`); }
    // SOH_NEW_TUNED v1: only modern source layouts yield this additional,
    // finite wreck salvage; never modify legacy tables or invent new Map cells.
    if (s.key==='wreck' && r.sourceLayoutVersion===3 && rngNext(r)<SALVAGED_OIL_WRECK_CHANCE) spawnDrop(r,'salvaged_oil',1,cx+ox,cy+oy,now);
  }
  r.player.skills.gather += units;
  const depleted = st.stock <= 0;
  if (depleted) { if (st.fire) { st.fire = 0; delete st.fireSpreadAt; delete st.fireDepth; } if (s.def.regrow) st.regrowAt = now + s.def.regrow * 1000; markDirty(); }
  if (units) receipt(r, now, 'harvest', `${s.key}@${tx},${ty} -${units}`);
  return { result: 'yield', key: s.key, got, mat: s.def.mat, depleted };
}

export function killCreature(gs: GameState, m: Creature, now: number) {
  const r = gs.run!; m.state = 'dead'; m.t = 0;
  if (m.elder) {
    const d = ELDERS[m.elder.key]; spawnDrop(r, d.stone, 1, m.x, m.y, now);
    spawnDrop(r, 'spares', 6, m.x, m.y, now); spawnDrop(r, 'crystal', 2, m.x, m.y, now);
    receipt(r, now, 'elder.defeat', m.elder.key); pushLog(r, now, `${d.name} falls. Its stone lies in the dust.`, 'gold'); award(gs, 'elder_1', now);
  } else {
    const d = CREATURES[m.type]; if (!d) return;
    for (const [k, q, ch] of d.drops) if (rngNext(r) < ch) spawnDrop(r, k, q, m.x, m.y, now);
    r.player.skills.combat += 2;
  }
}

// ---------------- death & respawn (C10) ----------------
// ---------------- physically supplied bed rest (SOH_PROVISIONAL, restV1) ----------------
// Reserve stacks are REAL custody moved out of the chest with their UIDs and charges. Consumption happens
// only at the trigger threshold inside restStep(), which runs in the same chronological settle() path online
// and offline. Ending the rest always returns leftovers to the chest, or to a bag if the chest is gone.
/** Safe, real provisions only: no raw meat, no irradiated food. */
function restSafe(d: { food?: { hp?: number; rad?: number } }) { return ((d.food?.hp ?? 0) >= 0) && ((d.food?.rad ?? 0) <= 0); }
export function restEligible(s: Stack | null | undefined): 'food' | 'water' | null {
  if (!s) return null; const d = ITEMS[s.key]; if (!d?.food || !restSafe(d)) return null;
  if (d.waterContainer) return (s.charge ?? 0) > 0 ? 'water' : null;
  if ((d.food.hunger ?? 0) > 0) return 'food';
  if ((d.food.thirst ?? 0) > 0) return 'water';
  return null;
}
/** Hunger and thirst the given stacks can still supply. Flasks count per charge. */
export function restSupply(stacks: (Stack | null)[]) {
  let hunger = 0, thirst = 0;
  for (const s of stacks) {
    if (!s) continue; const d = ITEMS[s.key]; if (!d?.food || !restSafe(d)) continue;
    if (d.waterContainer) thirst += Math.max(0, s.charge ?? 0) * (d.food.thirst ?? 0);
    else { hunger += (d.food.hunger ?? 0) * s.qty; thirst += (d.food.thirst ?? 0) * s.qty; }
  }
  return { hunger, thirst };
}
/** Forecast from the same offline rates the simulator uses. Honest about its limit: a wake happens when supplies run out. */
export function restForecast(r: RunState, stacks: (Stack | null)[], hours: number) {
  const B = BAL.player, trig = BAL.restV1.triggerStat, sup = restSupply(stacks);
  const foodHours = (Math.max(0, r.player.hunger - trig) + sup.hunger) / B.offlineHungerPerHour;
  const waterHours = (Math.max(0, r.player.thirst - trig) + sup.thirst) / B.offlineThirstPerHour;
  const coveredHours = Math.min(hours, foodHours, waterHours);
  const limitedBy = hours <= Math.min(foodHours, waterHours) + 1e-9 ? 'duration' : foodHours <= waterHours ? 'food' : 'water';
  return { hungerSupply: sup.hunger, thirstSupply: sup.thirst, foodHours, waterHours, coveredHours, limitedBy };
}
export function endRest(r: RunState, now: number, reason: string) {
  const rs = r.rest; if (!rs) return; delete r.rest;
  const reserve = r.custody[rs.reserveId]; const chest = r.entities[rs.chestId]; const bed = r.entities[rs.bedId];
  let returned = 0, bagId = 'none';
  if (reserve) {
    const dest = chest?.c ? C(r, chest.c) : null;
    if (dest) for (let i = 0; i < reserve.slots.length; i++) {
      const st = reserve.slots[i]; if (!st) continue; const j = dest.slots.findIndex(x => x === null);
      if (j < 0) break; dest.slots[j] = st; reserve.slots[i] = null; returned++;
    }
    if (reserve.slots.some(Boolean)) { const at = bed ?? { x: r.player.x, y: r.player.y }; bagId = bagContainers(r, [reserve.id], at.x, at.y, now, 'Rest supplies')?.id ?? 'none'; }
    delete r.custody[reserve.id];
  }
  markDirty(); receipt(r, now, 'rest.end', `${reason}; returned=${returned}; bag=${bagId}`);
  pushLog(r, now, reason === 'rested' ? 'You wake rested. Leftover supplies are back in the chest.' : `You wake: ${reason}.`, 'gold');
}
/** Shared chronological step. Called after every settle slice and by the online tick while resting. */
export function restStep(r: RunState, now: number) {
  const rs = r.rest; if (!rs) return; const p = r.player, cfg = BAL.restV1, trig = cfg.triggerStat;
  if (p.dead) { endRest(r, now, 'death'); return; }
  const bed = r.entities[rs.bedId];
  if (!bed || bed.kind !== 'struct' || !((bed.hp ?? 0) > 0)) { endRest(r, now, 'bed lost'); return; }
  if (!roofRoom(r, bed.x!, bed.y!).enclosed) { endRest(r, now, 'shelter lost'); return; }
  if (dist(p.x, p.y, bed.x!, bed.y!) > cfg.wakeRadiusTiles * TILE) { endRest(r, now, 'left the bed'); return; }
  const rc = r.custody[rs.reserveId]; if (!rc) { endRest(r, now, 'supplies lost'); return; }
  let guard = 0;
  while (p.hunger <= trig + 1e-6 && guard++ < 20) {
    const i = rc.slots.findIndex(s => s && restEligible(s) === 'food');
    if (i < 0) { endRest(r, now, 'food out'); return; }
    const st = rc.slots[i]!, d = ITEMS[st.key].food!, before = p.hunger;
    p.hunger = clamp(p.hunger + (d.hunger || 0), 0, 100); p.thirst = clamp(p.thirst + (d.thirst || 0), 0, 100);
    p.hp = clamp(p.hp + (d.hp || 0), 1, BAL.player.maxHp); p.warmth = clamp(p.warmth + (d.warmth || 0), 0, 100); p.rad = clamp(p.rad + (d.rad || 0), 0, 100);
    rs.eatenHunger += p.hunger - before;
    if (st.qty > 1) st.qty--; else rc.slots[i] = null;
    receipt(r, now, 'rest.eat', `${st.uid}:${st.key}`);
  }
  guard = 0;
  while (p.thirst <= trig + 1e-6 && guard++ < 40) {
    let i = rc.slots.findIndex(s => s && ITEMS[s.key].waterContainer && restEligible(s) === 'water');
    if (i >= 0) {
      const st = rc.slots[i]!, before = p.thirst; p.thirst = clamp(p.thirst + (ITEMS[st.key].food?.thirst || 0), 0, 100);
      rs.drunkThirst += p.thirst - before; st.charge = (st.charge ?? 1) - 1;
      receipt(r, now, 'rest.drink', `${st.uid}:charge=${st.charge}`); continue;
    }
    i = rc.slots.findIndex(s => s && !ITEMS[s.key].waterContainer && restEligible(s) === 'water');
    if (i < 0) { endRest(r, now, 'water out'); return; }
    const st = rc.slots[i]!, before = p.thirst; p.thirst = clamp(p.thirst + (ITEMS[st.key].food?.thirst || 0), 0, 100);
    p.hunger = clamp(p.hunger + (ITEMS[st.key].food?.hunger || 0), 0, 100);
    rs.drunkThirst += p.thirst - before;
    if (st.qty > 1) st.qty--; else rc.slots[i] = null;
    receipt(r, now, 'rest.drink.food', `${st.uid}:${st.key}`);
  }
  if (now >= rs.targetAt) endRest(r, now, 'rested');
}
function startRest(gs: GameState, it: Intent, now: number): Result {
  const r = gs.run!, p = r.player, cfg = BAL.restV1;
  const ok = (kind: string, detail: string, msg?: string): Result => ({ ok: true, receipt: receipt(r, now, kind, detail), msg });
  if (r.rest) return { ok: false, reason: 'You are already resting.' };
  if (p.dead) return { ok: false, reason: 'You are dead.' };
  const bed = r.entities[it.eid];
  if (!bed || bed.kind !== 'struct' || bed.type !== 'bed_straw' || !owned(bed) || !((bed.hp ?? 0) > 0)) return { ok: false, reason: 'Use an intact owned straw bed.' };
  if (!near(r, bed, 2.2)) return { ok: false, reason: 'Too far from the bed.' };
  if (!roofRoom(r, bed.x!, bed.y!).enclosed) return { ok: false, reason: 'The bed needs an enclosed, roofed shelter.' };
  const chest = r.entities[it.chestId];
  if (!chest || chest.kind !== 'struct' || !['chest_small', 'chest_large'].includes(chest.type!) || !owned(chest) || !((chest.hp ?? 0) > 0) || !chest.c) return { ok: false, reason: 'Choose an intact owned chest.' };
  if (dist(chest.x!, chest.y!, bed.x!, bed.y!) > cfg.bedChestRadiusTiles * TILE) return { ok: false, reason: `The chest must be within ${cfg.bedChestRadiusTiles} tiles of the bed.` };
  const room = roofRoom(r, bed.x!, bed.y!);
  if (!room.cells.has(Math.floor(chest.y! / TILE) * WW + Math.floor(chest.x! / TILE))) return { ok: false, reason: 'The chest must be inside the same shelter.' };
  if (!cfg.durationsHours.includes(it.hours)) return { ok: false, reason: 'Choose 1, 8 or 24 hours.' };
  const ids: string[] = Array.isArray(it.items) ? it.items : [];
  if (!ids.length) return { ok: false, reason: 'Choose food or charged water from the chest.' };
  if (new Set(ids).size !== ids.length || ids.length > cfg.reserveSlots) return { ok: false, reason: `Choose up to ${cfg.reserveSlots} distinct stacks.` };
  const cc = C(r, chest.c);
  const picks: number[] = [];
  for (const uid of ids) {
    const i = cc.slots.findIndex(s => s && s.uid === uid);
    if (i < 0) return { ok: false, reason: 'That item is not in the chest.' };
    const s = cc.slots[i]!;
    if (!restEligible(s)) return { ok: false, reason: `${ITEMS[s.key].name} is not safe food or charged water.` };
    picks.push(i);
  }
  const rc = mkContainer(r, 'rest', cfg.reserveSlots);
  picks.forEach((i, k) => { rc.slots[k] = cc.slots[i]; cc.slots[i] = null; });
  r.rest = { version: 'rest-v1', bedId: bed.id, chestId: chest.id, reserveId: rc.id, startedAt: now, targetAt: now + it.hours * HOUR, eatenHunger: 0, drunkThirst: 0 };
  markDirty(); pushLog(r, now, `You lie down on the straw bed. ${ids.length} supply stack${ids.length === 1 ? '' : 's'} set beside you.`, 'gold');
  return ok('rest.start', `${bed.id}:${chest.id}:${it.hours}h:${ids.join(',')}`, `Resting ${it.hours} h.`);
}
export function killPlayer(gs: GameState, now: number, cause: string) {
  const r = gs.run!; const p = r.player; if (p.dead) return;
  if (r.rest) endRest(r, now, 'death'); // reserve returns to the chest before the bag is formed
  p.dead = true; p.deadT = 0; p.hp = 0; p.action = null; p.pulling = null; delete p.vehicle;
  const bag = bagContainers(r, ['inv', 'eq'], p.x, p.y, now, 'Your bag', [], undefined, true);
  receipt(r, now, 'death', `${cause}; bag=${bag?.id ?? 'none'}`);
  pushLog(r, now, `You died (${cause}). Your belongings lie in a bag where you fell.`, 'red');
}
export function respawn(gs: GameState, now: number): Result {
  const r = gs.run!; const p = r.player; if (!p.dead) return { ok: false, reason: 'Not dead.' };
  const beds = Object.values(r.entities).filter(e => e.kind === 'struct' && e.type === 'bed_straw' && owned(e) && (e.hp ?? 0) > 0);
  // Preserve the bed as the preferred wake point, but never wake inside a
  // newly placed wall, burning source, live creature, or adjacent trap.
  markDirty(); const grid=blockGrid(r);
  const safeBedPoint=(x:number,y:number) => {
    for(const [dx,dy] of [[-3,-3],[3,-3],[-3,3],[3,3]]) { const tx=Math.floor((x+dx)/TILE),ty=Math.floor((y+dy)/TILE); if(tx<1||ty<1||tx>=WW-1||ty>=WH-1)return false;const i=ty*WW+tx,t=effTile(r,tx,ty);if([1,2,3,5].includes(grid[i])||[T.DEEP,T.LAVA,T.TOXIC].includes(t)||(r.sources[i]?.fire??0)>r.clock.simMs||Object.values(r.entities).some(e=>e.type==='spikes'&&e.tx===tx&&e.ty===ty))return false; }
    return !r.creatures.some(m=>m.state!=='dead'&&Math.hypot(m.x-x,m.y-y)<12);
  };
  let wake:{x:number;y:number}|undefined;
  for(const bed of beds){for(const [dx,dy] of [[0,10],[0,0],[0,-16],[16,0],[-16,0],[0,16]]){const candidate={x:bed.x+dx,y:bed.y+dy};if(safeBedPoint(candidate.x,candidate.y)&&clearWallLine(r,bed,candidate)){wake=candidate;break;}}if(wake)break;}
  if(!wake){const s=chooseLegalSpawn(r);if(!s)return {ok:false,reason:'No safe spawn is currently available.'};wake={x:s.tx*TILE+8,y:s.ty*TILE+8};}
  const {x,y}=wake;
  Object.assign(p, { x, y, dead: false, hp: 60, stamina: 60, hunger: Math.max(p.hunger, 40), thirst: Math.max(p.thirst, 40), warmth: 80, rad: Math.min(p.rad, 20), invuln: 2000 });
  return { ok: true, receipt: receipt(r, now, 'respawn', `${Math.round(x)},${Math.round(y)}`) };
}

// ---------------- run end (C22/C23) ----------------
export function endRun(gs: GameState, ending: 'evacuated' | 'abandoned' | 'expired', now: number): Result {
  const r = gs.run; if (!r || r.ended) return { ok: false, reason: 'No active run.' };
  if (ending === 'evacuated') award(gs, 'evacuated', now);
  if (ending === 'evacuated' && r.elderStones.length >= 6) award(gs, 'six_stones', now);
  r.ended = ending;
  gs.profile.history.unshift({ runId: r.id, character: r.character, startedAt: r.startedAt, endedAt: now, ending, score: r.score, stones: countStones(r), deposited: r.deposited, achievements: [...r.achievements], qa: r.qaUsed, verified: 'LOCAL/UNVERIFIED' });
  gs.profile.profileReceipts.push(`end:${r.id}:${ending}`);
  gs.run = null; // total run-local wipe: inventory, cores, recipes, buildings, cargo, physical cash, sources, bags, POIs, stones
  markDirty(); gs.revision++;
  return { ok: true, receipt: `end:${r.id}` };
}
export function countStones(r: RunState) { const keys = Object.values(ELDERS).map(e => e.stone); let n = 0; for (const c of Object.values(r.custody)) for (const s of c.slots) if (s && keys.includes(s.key)) n++; return n; }

// ---------------- build validation (C07) ----------------

// ---------------- B05-R oil pump source adapter ----------------
/** Source key for the oil site on a tile. */
export const oilSourceKey = (tx: number, ty: number) => `oil:${tx}:${ty}`;
/** The authorized, non-empty oil source under a pump tile. Production placement has no authority (Map owner pending). */
/** Any run-local authorized (test-fixture) source with stock. Production Map sources will be added here only via a versioned Map site. */
export function anyAuthorizedOilSource(r: RunState): boolean {
  return r.oilTestFixture === true && Object.values(r.oilSources ?? {}).some(src => src.authority === 'test-fixture-v1' && src.stock > 0);
}
export function authorizedOilSource(r: RunState, tx: number, ty: number) {
  const src = r.oilSources?.[oilSourceKey(tx, ty)];
  return r.oilTestFixture === true && src && src.authority === 'test-fixture-v1' && src.tx === tx && src.ty === ty && src.stock > 0 ? src : null;
}
/** TEST-ONLY FIXTURE: registers a labelled temporary oil source. Never called by any shipping action or map loader. */
export function registerTestOilSource(r: RunState, tx: number, ty: number, stock: number) {
  if (!Number.isInteger(stock) || stock < 0 || stock > BAL.oilPumpV1.maxSourceStock) throw new Error('bad fixture stock');
  r.oilSources = r.oilSources ?? {};
  r.oilTestFixture = true;
  r.oilSources[oilSourceKey(tx, ty)] = { tx, ty, stock, authority: 'test-fixture-v1' };
}

export function buildReason(gs: GameState, type: string, tx: number, ty: number): string | null {
  const r = gs.run!; if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(STRUCTS, type)) return 'Unknown structure.'; const d = STRUCTS[type];
  const w = getWorld(); const p = r.player;
  if(p.vehicle)return 'Exit the motorbike before building.';
  if (Object.values(r.entities).some(e=>e.kind==='vehicle' && Math.abs(e.x-(tx*TILE+8))<TILE && Math.abs(e.y-(ty*TILE+8))<TILE)) return 'Move the motorbike away before building here.';
  if (type === 'farm_controller' && !Object.values(r.entities).some(e=>e.kind==='struct' && e.type==='workbench' && e.station && owned(e) && (e.station.level ?? 1)>=2 && near(r,e,3) && dist(e.x,e.y,tx*TILE+8,ty*TILE+8)<=3*TILE)) return 'Build near your level 2 workbench.';
  if (type === 'oil_pump' && !authorizedOilSource(r, tx, ty)) return 'No authorized oil site here. Oil pumps need Map-authorized placement.';
  if (type === 'oil_pump' && !Object.values(r.entities).some(e=>e.kind==='struct' && e.type==='workbench' && e.station && owned(e) && (e.station.level ?? 1)>=BAL.oilPumpV1.requiresWorkbenchLevel && near(r,e,3) && dist(e.x,e.y,tx*TILE+8,ty*TILE+8)<=3*TILE)) return 'Build near your level 2 workbench.';
  if (type === 'refinery' && !Object.values(r.entities).some(e=>e.kind==='struct' && e.type==='workbench' && e.station && owned(e) && (e.station.level ?? 1)>=BAL.oilRefineryV1.requiresWorkbenchLevel && near(r,e,3) && dist(e.x,e.y,tx*TILE+8,ty*TILE+8)<=3*TILE)) return 'Build near your level 2 workbench.';
  if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 1 || ty < 1 || tx >= WW - 1 || ty >= WH - 1) return 'Out of bounds.';
  if (dist(p.x, p.y, tx * TILE + 8, ty * TILE + 8) > 4.6 * TILE) return 'Too far away.';
  if (!clearWallLine(r, p, {x:tx*TILE+8,y:ty*TILE+8})) return 'A wall blocks access to that tile.';
  const t = effTile(r, tx, ty);
  if ([T.DEEP, T.SHALLOW, T.RIVER, T.CLIFF, T.PWALL, T.LAVA, T.FLOOR, T.ICE].includes(t)) return 'Ground is not buildable here.';
  if (t === T.ROAD || t === T.BRIDGE) return 'Keep roads clear — build beside them.';
  if (w.economyMap.protected[ty * WW + tx] || w.accessCorridors?.mask[ty * WW + tx]) return 'Keep entrances, loading areas and routes clear.';
  if ((w.packageContract || w.enforceMasks) && !w.economyMap.buildable[ty * WW + tx]) return 'This map does not permit building here.';
  const s = sourceAt(r, tx, ty); if (s && s.stock > 0) return `Clear the ${s.def.name} first.`;
  const here = entsAt(r, tx, ty);
  if (here.some(e => e.kind !== 'struct')) return 'Something is already here.';
  const layers = here.map(e => STRUCTS[e.type!].layer);
  if (d.layer === 'floor' && layers.includes('floor')) return 'Already floored.';
  if (d.layer === 'roof' && layers.includes('roof')) return 'Already roofed.';
  if (d.layer === 'roof' && !layers.includes('floor')) return 'A roof needs a floor beneath it.';
  if ((d.layer === 'wall' || d.layer === 'obj') && (layers.includes('wall') || layers.includes('obj'))) return 'Tile occupied.';
  if (d.block && Math.hypot(p.x - (tx * TILE + 8), p.y - (ty * TILE + 8)) < 11) return 'You are standing there.';
  if (d.block && r.creatures.some(m => m.state !== 'dead' && Math.hypot(m.x - (tx * TILE + 8), m.y - (ty * TILE + 8)) < 12)) return 'A creature is in the way.';
  if (type === 'escrow' && !claimAt(r,tx,ty)) return 'Escrow requires an owned territory cabinet.';
  if (type === 'claim' && !here.some(e=>e.kind==='struct' && ['floor_wood','floor_stone'].includes(e.type||'') && owned(e) && (e.hp??0)>0)) return 'Place the cabinet on an intact owned foundation.';
  if (d.need === 'free') {
    const claims = Object.values(r.entities).filter(e => e.kind === 'struct' && e.type === 'claim');
    if (claims.length >= BAL.economy.maxClaims) return `Claim limit reached (${BAL.economy.maxClaims}).`;
    if (claims.some(c => c.tx===tx && c.ty===ty)) return 'A cabinet already occupies this tile.';
  }
  const cost = d.cost; if (!hasAll(r, 'inv', cost)) return 'Missing materials: ' + cost.filter(([k, q]) => countItem(r, 'inv', k) < q).map(([k, q]) => `${ITEMS[k].name} ${countItem(r, 'inv', k)}/${q}`).join(', ');
  return null;
}

// ---------------- dispatcher ----------------
export function dispatch(gs: GameState, it: Intent, now: number): Result {
  if (!it || typeof it.id !== 'string' || !it.id.trim() || typeof it.type !== 'string' || !Number.isFinite(now)) return { ok: false, reason: 'Invalid request.' };
  if (gs.profile.profileReceipts.includes(`intent:${it.id}`)) return { ok: false, reason: 'Duplicate request ignored.', dup: true };
  const r = gs.run;
  if (it.type === 'startRun') {
    if (!['male', 'female'].includes(it.character) || (it.region != null && (!Number.isInteger(it.region) || it.region < 0)) || (it.seed !== undefined && (!Number.isSafeInteger(it.seed) || it.seed < 0 || it.seed > 0xffffffff))) return { ok: false, reason: 'Invalid start.' };
    const res = startRun(gs, it.character, now, it.region ?? null, it.seed); if (res.ok) gs.profile.profileReceipts.push(`intent:${it.id}`); return res;
  }
  if (!r) return { ok: false, reason: 'No active run.' };
  if (r.seenIntents.includes(it.id)) return { ok: false, reason: 'Duplicate request ignored.', dup: true };
  if (r.rest && !['restCancel'].includes(it.type)) return { ok: false, reason: 'You are resting. Wake up first.' };
  if (now < r.clock.lastSimAt) return { ok: false, reason: 'Command predates the committed world clock.' };
  // No command can transact after the run boundary while the caller awaits settlement.
  if (phaseOf(r, now) === 'expired') return { ok: false, reason: 'Run has expired.' };
  const res = apply(gs, r, it, now);
  if (res.ok) {
    // Only a successful withdrawal/use/drop can empty a public crate. Its authored
    // site remains recorded even after the physical entity and container disappear.
    const source = it.type === 'move' ? it.from : (it.type === 'drop' || it.type === 'useItem') ? it.c : undefined;
    if (typeof source === 'string') { retireEmptyLoot(r, source, now); const e=Object.values(r.entities).find(e=>e.kind==='airdrop'&&e.c===source);if(e){if(!C(r,source).slots.some(Boolean)){receipt(r,now,'airdrop.empty',String(e.airdrop!.index));removeEntity(r,e);}else if(e.airdrop!.phase==='open'){e.airdrop!.phase='partial';receipt(r,now,'airdrop.partial',String(e.airdrop!.index));}} }
    // The receipt ring is intentionally bounded for UI/history, but irreversible command
    // identity is durable run state and must never be evicted: an old replay is still a replay.
    r.seenIntents.push(it.id);
    if (['deposit', 'buy', 'abandon', 'evacuate'].includes(it.type)) gs.profile.profileReceipts.push(`intent:${it.id}`);
    gs.revision++;
  }
  return res;
}
const fail = (reason: string): Result => ({ ok: false, reason });
function near(r: RunState, e: { x: number; y: number }, tiles = 2.2) { return dist(r.player.x, r.player.y, e.x, e.y) <= tiles * TILE && clearWallLine(r, r.player, e); }
/** Grid traversal visits every crossed cell, including both sides of a corner.
 * Interaction targets may themselves occupy a blocking cell; intervening cells never may. */
export function clearPhysicalLine(r: RunState, p: { x: number; y: number }, e: { x: number; y: number }, blockTrees = true, excludeEnd = false, wallsOnly = false): boolean {
  const grid = blockGrid(r), sx = Math.floor(p.x / TILE), sy = Math.floor(p.y / TILE);
  const ex = Math.floor(e.x / TILE), ey = Math.floor(e.y / TILE);
  let x = sx, y = sy; const dx = e.x - p.x, dy = e.y - p.y, stepx = Math.sign(dx), stepy = Math.sign(dy);
  const txStep = dx ? TILE / Math.abs(dx) : Infinity, tyStep = dy ? TILE / Math.abs(dy) : Infinity;
  let tx = dx ? ((stepx > 0 ? (x + 1) * TILE : x * TILE) - p.x) / dx : Infinity;
  let ty = dy ? ((stepy > 0 ? (y + 1) * TILE : y * TILE) - p.y) / dy : Infinity;
  const clear = (cx: number, cy: number) => {
    if (cx === sx && cy === sy || excludeEnd && cx === ex && cy === ey) return true;
    if (cx < 0 || cy < 0 || cx >= WW || cy >= WH) return false;
    if (wallsOnly) return !roomWall(r, cx, cy) && effTile(r, cx, cy) !== T.LAVA;
    const b = grid[cy * WW + cx]; return b !== 1 && b !== 3 && b !== 5 && (!blockTrees || b !== 2);
  };
  while (x !== ex || y !== ey) {
    if (Math.abs(tx - ty) < 1e-10) {
      if (!clear(x + stepx, y) || !clear(x, y + stepy)) return false;
      x += stepx; y += stepy; tx += txStep; ty += tyStep;
    } else if (tx < ty) { x += stepx; tx += txStep; }
    else { y += stepy; ty += tyStep; }
    if (!clear(x, y)) return false;
  }
  return true;
}
export function clearSegment(r: RunState, p: { x: number; y: number }, e: { x: number; y: number }) {
  return clearPhysicalLine(r, p, e, true, true);
}
export function clearWallLine(r: RunState, p: {x:number;y:number}, e: {x:number;y:number}) { return clearPhysicalLine(r, p, e, false, true, true); }
export function clearInteraction(r:RunState,e:{x:number;y:number}) { return clearSegment(r,r.player,e); }

function apply(gs: GameState, r: RunState, it: Intent, now: number): Result {
  const p = r.player; const ok = (kind: string, detail: string, msg?: string): Result => ({ ok: true, receipt: receipt(r, now, kind, detail), msg });
  if (p.dead && !['respawn', 'abandon', 'qaAdvance'].includes(it.type)) return fail('You are dead.');
  switch (it.type) {
    case 'respawn': return respawn(gs, now);
    case 'restStart': return startRest(gs, it, now);
    case 'restCancel': { if (!r.rest) return { ok: false, reason: 'You are not resting.' }; endRest(r, now, 'woke by choice'); return { ok: true, receipt: receipt(r, now, 'rest.cancel', it.id), msg: 'You wake up.' }; }
    case 'loadCore': {
      if (!Number.isInteger(it.slot) || it.slot < 0 || it.slot >= 8 || !['basic','refined','signature'].includes(it.mode)) return fail('Invalid Core reload.');
      if (p.action) return fail('Finish your current action first.');
      const s = C(r, 'inv').slots[it.slot];
      if (!s || s.uid !== it.uid || !ITEMS[s.key]?.creatorCore || !s.reserves) return fail('Select the same physical Creator Core.');
      const mode = it.mode as 'basic'|'refined'|'signature';
      const caps = { basic: 40, refined: 12, signature: 4 }; const room = caps[mode] - s.reserves[mode];
      const energy = mode === 'basic' ? 'energy_basic' : 'energy_refined';
      const essence = `essence_${ITEMS[s.key].essence}`;
      const n = Math.min(room, countItem(r, 'inv', energy), mode === 'signature' ? countItem(r, 'inv', essence) : room);
      if (n <= 0) return fail(room <= 0 ? 'Reserve is full.' : `Missing ${mode === 'signature' ? 'Refined Energy or matching Essence' : ITEMS[energy].name}.`);
      removeItem(r, 'inv', energy, n); if (mode === 'signature') removeItem(r, 'inv', essence, n);
      s.reserves[mode] += n;
      return ok('core.load', `${s.uid}:${mode}+${n}`);
    }
    case 'pickup': {
      const e = r.entities[it.eid]; if (!e || e.kind !== 'drop' || !owned(e)) return fail('Nothing to pick up.');
      if (!near(r, e, 2.5)) return fail('Too far.');
      const s = C(r, e.c!).slots[0]; if (!s) return fail('Empty.');
      const room = ITEMS[s.key].max > 1 && s.meta === undefined && s.dur === undefined && s.charge === undefined ? spaceFor(r, 'inv', s.key) : (C(r, 'inv').slots.includes(null) ? s.qty : 0);
      if (room <= 0) return fail('Inventory full.');
      if (room >= s.qty) { if (!addStack(r, 'inv', s)) return fail('Inventory full.'); removeEntity(r, e); return ok('pickup', `${s.key}x${s.qty}`); }
      addItem(r, 'inv', s.key, room); s.qty -= room; return ok('pickup', `${s.key}x${room} (partial)`);
    }
    case 'move': {
      const from = C(r, it.from), to = C(r, it.to);
      if (!from || !to || !canAccess(r, it.from) || !canAccess(r, it.to)) return fail('Invalid or out of reach container.');
      if (!validSlot(from, it.fs) || (it.ts !== undefined && !validSlot(to, it.ts))) return fail('Invalid slot.');
      const s = from.slots[it.fs]; if (!s) return fail('Empty slot.');
      if (isStationFuel(r, to.id) && !stationBurnable(s.key)) return fail(s.key === 'fuel_can' ? 'Fuel Canisters are not station fuel: the station never burns them. Carry them to a generator or motorbike.' : 'That is not station fuel.');
      if (it.qty !== undefined && (!Number.isSafeInteger(it.qty) || it.qty <= 0 || it.qty > s.qty)) return fail('Invalid quantity.');
      const qty = it.qty ?? s.qty;
      if (from === to && (it.ts === undefined || it.ts === it.fs)) return fail('Choose a different slot.');
      if(to.kind==='vehicle' && from!==to) { const target=it.ts===undefined?null:to.slots[it.ts]; const swap=target && !mergeable(target,s) ? ITEMS[target.key].w*target.qty : 0; if(cartWeight(r,to.id)+ITEMS[s.key].w*qty-swap>BAL.motorbike.maxWeight+1e-9)return fail('Vehicle cargo exceeds weight capacity.'); }
      if(from.kind==='vehicle' && from!==to && it.ts!==undefined) { const target=to.slots[it.ts]; if(target && !mergeable(target,s) && cartWeight(r,from.id)-ITEMS[s.key].w*qty+ITEMS[target.key].w*target.qty>BAL.motorbike.maxWeight+1e-9)return fail('Vehicle cargo exceeds weight capacity.'); }
      if (it.ts !== undefined) {
        const tgt = to.slots[it.ts];
        if (!accepts(to, it.ts, s)) return fail('Cannot store item there.');
        if (!tgt) {
          if (qty === s.qty) { to.slots[it.ts] = s; from.slots[it.fs] = null; }
          else { to.slots[it.ts] = portion(r, s, qty); s.qty -= qty; }
        } else if (mergeable(tgt, s)) {
          const n = Math.min(qty, ITEMS[s.key].max - tgt.qty); if (n <= 0) return fail('Stack full.');
          tgt.qty += n; s.qty -= n; if (!s.qty) from.slots[it.fs] = null;
        } else {
          if (qty !== s.qty || !accepts(from, it.fs, tgt)) return fail('Cannot swap these items.');
          to.slots[it.ts] = s; from.slots[it.fs] = tgt;
        }
      } else {
        if (['loot', 'cash', 'out'].includes(to.kind)) return fail('Cannot store items there.');
        let remaining = qty;
        // Preflight capacity; never partially modify a failed request.
        let room = 0;
        for (let i = 0; i < to.slots.length; i++) {
          if (!accepts(to, i, s)) continue;
          const t = to.slots[i]; if (!t) room += ITEMS[s.key].max;
          else if (mergeable(t, s)) room += ITEMS[s.key].max - t.qty;
        }
        if (!room) return fail('No room.');
        remaining = Math.min(remaining, room); const moved = remaining;
        for (const t of to.slots) if (t && mergeable(t, s) && remaining > 0) {
          const n = Math.min(remaining, ITEMS[s.key].max - t.qty); t.qty += n; s.qty -= n; remaining -= n;
        }
        for (let i = 0; i < to.slots.length && remaining > 0; i++) if (!to.slots[i] && accepts(to, i, s)) {
          const n = Math.min(remaining, ITEMS[s.key].max);
          if (n === s.qty) { to.slots[i] = s; from.slots[it.fs] = null; }
          else { to.slots[i] = portion(r, s, n); s.qty -= n; }
          remaining -= n;
        }
        if (s.qty === 0) from.slots[it.fs] = null;
        if (to.kind === 'cart' && cartWeight(r, to.id) > cartLimit(Object.values(r.entities).find(e => e.kind === 'cart' && e.c === to.id))) pushLog(r, now, 'The cart is overloaded — it will crawl.', 'red');
        pruneEmptyBag(r, from.id);
        return ok('move', `${s.key}x${moved} ${from.id}->${to.id}`);
      }
      pruneEmptyBag(r, from.id);
      return ok('move', `${s.key} ${from.id}->${to.id}`);
    }
    case 'split': { const c = C(r, it.c); if (!c || !canAccess(r, it.c) || !validSlot(c, it.slot)) return fail('Invalid or out of reach container.');
      const s = c.slots[it.slot]; if (!s || s.qty < 2) return fail('Cannot split.'); const i = c.slots.findIndex((v, n) => !v && accepts(c, n, s)); if (i < 0) return fail('No free slot.'); const h = Math.floor(s.qty / 2); s.qty -= h; c.slots[i] = portion(r, s, h); return ok('split', `${s.key} ${h}`); }
    case 'sort': { const c = C(r, it.c); if (!c || !canAccess(r, it.c) || c.kind === 'eq') return fail('Cannot sort.'); const items = c.slots.filter(Boolean) as Stack[]; const merged: Stack[] = [];
      for (const s of items) { const m = merged.find(x => mergeable(x, s) && x.qty < ITEMS[s.key].max); if (m) { const k = Math.min(s.qty, ITEMS[s.key].max - m.qty); m.qty += k; s.qty -= k; if (s.qty > 0) merged.push(s); } else merged.push(s); }
      const keep = it.c === 'inv' ? c.slots.slice(0, 8) : []; const rest = merged.filter(s => !keep.includes(s));
      const order = ['tool', 'weapon', 'core', 'armor', 'food', 'res', 'kit', 'bp', 'misc', 'stone', 'cash'];
      rest.sort((a, b) => order.indexOf(ITEMS[a.key].cat) - order.indexOf(ITEMS[b.key].cat) || a.key.localeCompare(b.key));
      const out = it.c === 'inv' ? [...keep.map(s => (s && s.qty > 0 ? s : null))] : []; while (out.length < c.slots.length) out.push(rest.shift() || null); c.slots = out; return ok('sort', c.id); }
    case 'drop': { const c = C(r, it.c); const s = c && validSlot(c, it.slot) ? c.slots[it.slot] : null; if (!s || !canAccess(r, it.c)) return fail('Nothing to drop.'); c.slots[it.slot] = null; if (p.pulling && s.key === 'x') p.pulling = null; dropStackEntity(r, s, p.x + Math.cos(p.aim) * 12, p.y + Math.sin(p.aim) * 12, now); pruneEmptyBag(r, it.c); return ok('drop', `${s.key}x${s.qty}`); }
    case 'upgradeStructure': {
      const e = r.entities[it.eid];
      if (!e || e.kind !== 'struct' || !owned(e) || !near(r, e, 3)) return fail('Use your structure within reach.');
      const target = STRUCTURE_UPGRADES[e.type!], next = target && STRUCTS[target];
      if (!next || e.deployed || e.station || e.farm || e.garden || !Number.isFinite(e.hp) || !Number.isFinite(e.maxHp) || e.hp! <= 0 || e.maxHp! <= 0) return fail('No in-place upgrade for this structure.');
      const chest = e.c ? C(r, e.c) : null;
      if (next.slots && (!chest || chest.kind !== 'chest' || chest.slots.length > next.slots)) return fail('Storage is invalid; no materials spent.');
      if (!hasAll(r, 'inv', next.cost)) return fail('Missing upgrade materials: ' + next.cost.filter(([k,q]) => countItem(r,'inv',k) < q).map(([k,q]) => `${ITEMS[k].name} ${countItem(r,'inv',k)}/${q}`).join(', '));
      for (const [k,q] of next.cost) removeItem(r, 'inv', k, q);
      const old = e.type, fraction = Math.min(1, e.hp! / e.maxHp!); e.type = target; e.maxHp = next.hp; e.hp = Math.max(1, Math.floor(next.hp * fraction));
      if (chest && next.slots) while (chest.slots.length < next.slots) chest.slots.push(null);
      markDirty(); return ok('structure.upgrade', `${e.id}:${old}->${target}`, `${next.name}: ${Math.round(e.hp)}/${e.maxHp} HP (condition preserved).`);
    }
    case 'upgradeGenerator': {
      const e=r.entities[it.eid], bench=r.entities[it.benchId];
      if(!e || e.kind!=='struct' || e.type!=='base_generator' || !e.basePower || !owned(e) || !near(r,e,3)) return fail('Use your generator within reach.');
      if(e.basePower.capacity===2) return fail('Generator is already reinforced.');
      if(!bench || bench.kind!=='struct' || bench.type!=='workbench' || !bench.station || !owned(bench) || !near(r,bench,3) || dist(bench.x,bench.y,e.x,e.y)>3*TILE || (bench.station.level??1)<GENERATOR_CAPACITY_UPGRADE.benchLevel) return fail('A level 2 workbench must be within reach of you and the generator.');
      if(!hasAll(r,'inv',GENERATOR_CAPACITY_UPGRADE.cost)) return fail('Missing generator upgrade materials.');
      for(const [k,q] of GENERATOR_CAPACITY_UPGRADE.cost) removeItem(r,'inv',k,q);
      e.basePower.capacity=2;return ok('power.upgrade',e.id,'Generator reinforced for two linked turrets. Two active loads burn fuel twice as fast.');
    }
    case 'installIndustrial': {
      const e=r.entities[it.eid];if(!e || e.kind!=='struct' || e.type!=='workbench' || !e.station || !owned(e) || !near(r,e,3))return fail('Use your workbench within reach.');
      if(e.industrial)return fail('Industrial module already installed.');
      if((e.station.level??1)<INDUSTRIAL_MODULE.benchLevel)return fail('Requires a level 2 workbench.');
      if(!hasAll(r,'inv',INDUSTRIAL_MODULE.cost))return fail('Missing industrial module materials.');
      for(const [k,q] of INDUSTRIAL_MODULE.cost)removeItem(r,'inv',k,q);
      e.industrial={enabled:false};return ok('industrial.install',e.id,'Industrial workbench module installed. Manual production still works.');
    }
    case 'industrialConfigure': {
      const e=r.entities[it.eid];if(!e?.industrial || e.type!=='workbench' || !owned(e) || !near(r,e,3))return fail('Use your upgraded workbench within reach.');
      if(it.field==='enabled' && typeof it.value==='boolean')e.industrial.enabled=it.value;
      else if(it.field==='generatorId' && typeof it.value==='string'){
        if(it.value){const g=r.entities[it.value];if(!g?.basePower||g.type!=='base_generator'||!owned(g)||!connectedPower(r,g,e))return fail('Generator must be connected by a clear valid power route.');}
        e.industrial.generatorId=it.value||undefined;
      } else return fail('Invalid industrial setting.');
      return ok('industrial.configure',`${e.id}:${it.field}`);
    }
    case 'powerPriority': {
      const e=r.entities[it.eid];if(!e?.basePower||!owned(e)||!near(r,e,2.2))return fail('Use your generator within reach.');
      if(it.value!=='defense'&&it.value!=='production')return fail('Invalid power priority.');
      e.basePower.priority=it.value;return ok('power.priority',`${e.id}:${it.value}`);
    }
    case 'basePower': {
      const e = r.entities[it.eid]; if (!e?.basePower || e.type !== 'base_generator' || !owned(e) || !near(r,e,2.2)) return fail('Use your generator within reach.');
      if (typeof it.enabled !== 'boolean') return fail('Invalid power setting.');
      e.basePower.enabled = it.enabled; return ok('power.toggle', `${e.id}:${it.enabled}`, it.enabled ? 'Generator switched on.' : 'Generator switched off.');
    }
    case 'turretConfigure': {
      const e = r.entities[it.eid]; if (!e?.turret || e.type !== 'arrow_turret' || !owned(e) || !near(r,e,2.2)) return fail('Use your turret within reach.');
      if (it.field === 'enabled' && typeof it.value === 'boolean') e.turret.enabled = it.value;
      else if (it.field === 'generatorId' && typeof it.value === 'string') {
        if (it.value) { const gen = r.entities[it.value]; if (!gen?.basePower || gen.type !== 'base_generator' || !owned(gen) || !connectedPower(r,gen,e)) return fail('Generator must be connected by a clear valid power route.');
          if (gen.basePower.network!=='wire-v1' && Object.values(r.entities).filter(o=>o.id!==e.id && o.turret?.generatorId===gen.id).length >= (gen.basePower.capacity??1)) return fail('Generator capacity is full.'); }
        e.turret.generatorId = it.value || undefined;
      } else return fail('Invalid turret setting.');
      return ok('turret.configure', `${e.id}:${it.field}`);
    }
    case 'repairStructure': {
      const e = r.entities[it.eid];
      if (!e || e.kind !== 'struct' || !owned(e) || !near(r, e, 3)) return fail('Use your structure within reach.');
      const def = STRUCTS[e.type!];
      if (!def || def.item || !Number.isFinite(e.hp) || !Number.isFinite(e.maxHp) || e.hp! <= 0 || e.hp! >= e.maxHp!) return fail('This structure cannot be repaired.');
      // B01: one Iron Plate fully restores a wall-layer structure (reinforcement role, distinct from wood patching).
      if (it.material === 'iron_plate') {
        if (def.layer !== 'wall') return fail('Iron plate patches wall or door structures only.');
        if (countItem(r, 'inv', 'iron_plate') < 1) return fail('Missing repair materials: Iron Plate 0/1.');
        removeItem(r, 'inv', 'iron_plate', 1);
        const beforePlate = e.hp!; const patch = Math.min(e.maxHp! - beforePlate, Math.ceil(e.maxHp! * BAL.ironPlatePatchV1.fraction));
        e.hp = beforePlate + patch;
        return ok('structure.repair.plate', `${e.id}:${beforePlate}->${e.hp}:iron_platex1`, `${def.name} plate-patched: +${Math.round(patch)} HP, now ${Math.round(e.hp)}/${e.maxHp}. One plate is spent per patch (up to 25% of max HP).`);      }
      const cost = structureRepairCost(e);
      if (!hasAll(r, 'inv', cost)) return fail('Missing repair materials: ' + cost.filter(([key, qty]) => countItem(r, 'inv', key) < qty).map(([key, qty]) => `${ITEMS[key].name} ${countItem(r, 'inv', key)}/${qty}`).join(', '));
      for (const [key, qty] of cost) removeItem(r, 'inv', key, qty);
      const before = e.hp!; e.hp = Math.min(e.maxHp!, e.hp! + Math.ceil(e.maxHp! / 4));
      return ok('structure.repair', `${e.id}:${before}->${e.hp}`, `${def.name} repaired to ${Math.round(e.hp)}/${e.maxHp} HP.`);
    }
    case 'upgradeStation': {
      const e = r.entities[it.eid];
      if (!e || e.kind !== 'struct' || e.type !== 'workbench' || !e.station || !owned(e) || !near(r, e, 3)) return fail('Use your workbench within reach.');
      const level=e.station.level ?? 1;
      if (level >= 3) return fail('Workbench already at level 3.');
      const upgrade=level===1 ? WORKBENCH_UPGRADE : WORKBENCH_UPGRADE_III;
      if (!hasAll(r, 'inv', upgrade.cost)) return fail('Missing upgrade materials.');
      for (const [key, qty] of upgrade.cost) removeItem(r, 'inv', key, qty);
      e.station.level = upgrade.toLevel;
      return ok('station.upgrade', `${e.id}:${upgrade.toLevel}`, `Workbench improved to level ${upgrade.toLevel}. Knowledge is unchanged.`);
    }
    case 'upgradeFurnace': {
      const e = r.entities[it.eid], bench = r.entities[it.benchId];
      if (!e || e.kind !== 'struct' || e.type !== 'furnace' || !e.station || !owned(e) || !near(r, e, 3)) return fail('Use your furnace within reach.');
      if (e.station.upgrade) return fail('Furnace already lined.');
      if (!bench || bench.kind !== 'struct' || bench.type !== 'workbench' || !bench.station || !owned(bench) || !near(r, bench, 3) || dist(bench.x, bench.y, e.x, e.y) > 3 * TILE || (bench.station.level ?? 1) < FURNACE_LINING.benchLevel) return fail('A level 2 workbench must be within reach of you and the furnace.');
      if (!hasAll(r, 'inv', FURNACE_LINING.cost)) return fail('Missing lining materials.');
      for (const [key, qty] of FURNACE_LINING.cost) removeItem(r, 'inv', key, qty);
      e.station.upgrade = 'kiln_lining';
      return ok('furnace.upgrade', e.id, 'Furnace lined: future jobs use less fuel for the same work.');
    }
    case 'fieldRepair': {
      const inv = C(r, 'inv');
      if (!validSlot(inv, it.slot) || !validSlot(inv, it.kitSlot)) return fail('Invalid inventory slot.');
      const item = inv.slots[it.slot], kit = inv.slots[it.kitSlot];
      if (!item || item.uid !== it.uid || !kit || kit.uid !== it.kitUid || kit.key !== 'field_repair_kit') return fail('The selected item or kit has changed.');
      const def = ITEMS[item.key];
      if (!def.repair || !def.dur || item.dur === undefined || item.dur < 0 || item.dur >= def.dur) return fail('This item cannot be field repaired.');
      if (p.action) return fail('Finish your current action first.');
      const before = item.dur; item.dur = Math.min(def.dur, item.dur + BAL.player.fieldRepairDurability);
      if (--kit.qty === 0) inv.slots[it.kitSlot] = null;
      return ok('item.fieldRepair', `${item.uid}:${before}->${item.dur}`, `${def.name} field repaired to ${item.dur}/${def.dur}.`);
    }
    case 'maintainItem': {
      const e = r.entities[it.eid], inv = C(r, 'inv');
      if (!e || e.kind !== 'struct' || !e.station || !owned(e) || !near(r, e, 3)) return fail('Use your station within reach.');
      if (!validSlot(inv, it.slot)) return fail('Invalid inventory slot.');
      const item = inv.slots[it.slot];
      if (!item || item.uid !== it.uid || item.qty !== 1) return fail('That item is no longer in this slot.');
      if (p.action && p.action.slot === it.slot) return fail('Finish your current action first.');
      const def = ITEMS[item.key];
      if (it.mode === 'repair') {
        const rule = def.repair;
        if (!rule || e.type !== rule.station || item.dur === undefined || !def.dur || item.dur < 0 || item.dur >= def.dur) return fail('This item cannot be repaired here.');
        if (!hasAll(r, 'inv', rule.cost)) return fail('Missing repair materials.');
        for (const [key, qty] of rule.cost) removeItem(r, 'inv', key, qty);
        const old = item.dur; item.dur = def.dur;
        return ok('item.repair', `${item.uid}:${old}->${item.dur}`, `${def.name} repaired to ${item.dur}/${def.dur}.`);
      }
      if (it.mode === 'salvage') {
        const rule = def.salvage;
        if (!rule || e.type !== rule.station) return fail('This item cannot be dismantled here.');
        inv.slots[it.slot] = null;
        for (const [key, qty] of rule.yields) giveOrDrop(r, key, qty, now);
        return ok('item.salvage', `${item.uid}:${item.key}`, `${def.name} dismantled. Materials are in your pack or on the ground.`);
      }
      return fail('Unknown maintenance action.');
    }
    case 'useItem': return useItem(gs, r, it, now, ok);
    case 'craft': return craft(gs, r, it, now, ok);
    case 'recycleDrive': case 'recycleItem': {
      const e=r.entities[it.eid];if(!e||e.kind!=='recycler'||!e.station||!near(r,e,2.8)||!clearInteraction(r,e))return fail('Stand at the Foundry Recycler with a clear path.');
      const inv=C(r,'inv');if(!validSlot(inv,it.slot))return fail('Choose a carried recyclable item.');const s=inv.slots[it.slot];
      if(!s||s.uid!==it.uid)return fail('That item is no longer carried.');
      const plan=recoveryPlan(s);if(!plan&&(s.key==='metal_pipe'||s.key==='metal_blade'||s.key==='mechanical_gear')&&s.qty!==1)return fail(`Split one ${ITEMS[s.key].name} off the stack first (Split in the inventory), then recycle that single part.`);
      if(!plan||(it.type==='recycleDrive'&&s.key!=='damaged_drive'))return fail('This item is not an eligible Recycler input.');
      if(p.action?.slot===it.slot)return fail('Finish your current action.');if(e.station.queue.length>=1)return fail('Recycler is already processing an item.');
      if(!recoveryFits(C(r,e.station.outC),plan.outputs))return fail('Recycler output cannot hold all results; collect items first.');
      inv.slots[it.slot]=null;e.station.queue.push({id:uid(r,'j'),recipe:plan.recipe,left:plan.total,total:plan.total,reserved:[s]});
      return ok('recycle.start',`${s.uid}:${s.key}@${e.id}`,`Recycling ${ITEMS[s.key].name}: ${plan.total/1000} seconds.`);
    }
    case 'cancelJob': { const e = r.entities[it.eid]; if (!e?.station || !((e.kind === 'struct' && owned(e)) || (e.kind === 'recycler' && clearInteraction(r,e))) || !near(r, e, e.kind==='recycler'?2.8:3)) return fail('Not here.'); const j = e.station.queue.findIndex(q => q.id === it.jobId); if (j < 0) return fail('No such job.');
      const job = e.station.queue[j]; if (!job.reserved) return fail('Legacy job has no recoverable input record; let it finish.');
      e.station.queue.splice(j, 1); returnReservations(r, job.reserved, p.x, p.y, now); return ok('job.cancel', job.recipe, 'Reserved inputs returned to inventory or dropped nearby.'); }
    case 'recoverLegacyJobs': {
      const bag = r.entities[it.eid], station = r.entities[it.stationId];
      if (!bag || bag.kind !== 'bag' || !bag.legacyJobs || !near(r, bag, 2.8)) return fail('Recovery bag is out of reach.');
      if (!station || station.kind !== 'struct' || !owned(station) || !station.station || station.type !== bag.legacyJobs.stationType || !near(r, station, 3)) return fail('Use a matching station within reach.');
      const max = STRUCTS[station.type!].station === 'research' ? 3 : 6;
      if (station.station.queue.length + bag.legacyJobs.queue.length > max) return fail('Not enough queue space.');
      station.station.queue.push(...bag.legacyJobs.queue); delete bag.legacyJobs;
      return ok('job.legacy.restore', bag.id, 'Legacy jobs resumed at the matching station.');
    }
    case 'build': {
      const why = buildReason(gs, it.struct, it.tx, it.ty); if (why) return fail(why);
      const d = STRUCTS[it.struct];
      const deployed = d.item ? reserveInputs(r, d.cost)[0] : undefined;
      if (!d.item) for (const [k, q] of d.cost) removeItem(r, 'inv', k, q);
      const e: Entity = { id: uid(r, 'e'), kind: 'struct', type: it.struct, tx: it.tx, ty: it.ty, x: it.tx * TILE + 8, y: it.ty * TILE + 8, hp: d.hp, maxHp: d.hp, born: now, deployed };
      if (d.slots) e.c = mkContainer(r, 'chest', d.slots).id;
      if (d.station && d.station !== 'research') e.station = { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 3).id, outC: mkContainer(r, 'out', 6).id };
      if (d.station === 'research') e.station = { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 0).id, outC: mkContainer(r, 'out', 4).id };
      if (it.struct === 'refinery') e.identity = 'refinery-v1';
      if (it.struct === 'claim') e.cabinet = {credit:{},legacy:false};
      if (it.struct === 'base_generator') e.basePower = { enabled: false, energy: 0, network:'wire-v1' };
      if (it.struct === 'power_switch') e.wireSwitch={version:'wire-v1',on:false};
      if (it.struct === 'ir_sensor') e.irSensor={version:'ir-v1',enabled:false};
      if (it.struct === 'bear_trap') e.bearTrap={version:'trap-v1',state:'unarmed',uses:BAL.bearTrapV1.uses};
      if (it.struct === 'door_powered') {const dx=p.x-e.x,dy=p.y-e.y;const outside:[number,number]=Math.abs(dx)>Math.abs(dy)?[Math.sign(dx)||1,0]:[0,Math.sign(dy)||1];e.electricDoor={version:'wire-v1',interior:[outside[0] ? -outside[0] : 0,outside[1] ? -outside[1] : 0]};}
      if (it.struct === 'arrow_turret') e.turret = { enabled: false, cooldown: 0, angle: 0 };
      if (it.struct === 'farm_controller') e.farm = { enabled:false, crop:'crop', energy:0 };
      if (it.struct === 'garden') e.garden = { crop: null, growth: 0, water: 0 };
      if (it.struct === 'barrel') e.water = 0;
      if (it.struct.startsWith('door')) e.open = false;
      const cl = claimAt(r, it.tx, it.ty); if (cl) e.claim = cl.id;
      r.entities[e.id] = e; markDirty(); if(it.struct==='claim')refreshTerritoryLinks(r);
      if ((it.struct === 'bed_straw' || it.struct.startsWith('roof')) && homeComplete(r)) award(gs, 'first_home', now);
      return ok('build', `${it.struct}@${it.tx},${it.ty}`);
    }
    case 'placeMotorbike': {
      const inv=C(r,'inv'), idx=inv.slots[p.active]?.key==='motorbike_kit'?p.active:inv.slots.findIndex(v=>v?.key==='motorbike_kit');
      if(idx<0 || p.vehicle || p.pulling) return fail('Need a packed motorbike and free hands.');
      if(!Number.isFinite(it.x)||!Number.isFinite(it.y)||dist(p.x,p.y,it.x,it.y)>3*TILE || !clearPhysicalLine(r,p,{x:it.x,y:it.y},true))return fail('Choose reachable open ground.');
      if(!getWorld(r.layoutId||'shipping').vehicleGeometry)return fail('This map has no eligible vehicle geometry.');
      if(!vehicleClear(r,it.x,it.y,undefined,'parking')||!vehicleExitPoint(r,it.x,it.y))return fail('Motorbike needs clear dry ground and a safe exit.');
      const deployed=inv.slots[idx]!;if(!Number.isFinite(deployed.dur)||deployed.dur!<=0||deployed.dur!>BAL.motorbike.maxHp)return fail('Packed motorbike condition is invalid or broken.');
      const c=mkContainer(r,'vehicle',BAL.motorbike.slots);inv.slots[idx]=null;
      const e:Entity={id:uid(r,'e'),kind:'vehicle',x:it.x,y:it.y,c:c.id,hp:deployed.dur,maxHp:BAL.motorbike.maxHp,deployed,vehicle:{fuel:0,angle:p.aim,odometer:0,geometry:'vehicle-geometry-v1'}};r.entities[e.id]=e;
      return ok('vehicle.deploy',`${deployed.uid}:${e.id}@${Math.round(e.x)},${Math.round(e.y)}`,'Motorbike deployed. Add fuel and drive.');
    }
    case 'vehicleMount': {
      const e=r.entities[it.eid];if(!e||e.kind!=='vehicle'||!e.vehicle||!owned(e)||!near(r,e,1.7)||!clearPhysicalLine(r,p,e,true))return fail('Motorbike out of reach.');
      if(p.vehicle||p.pulling||p.action||p.dead||r.spiritTransit)return fail('Finish your action and release the cart first.');
      if(!vehicleClear(r,e.x,e.y,e.id)||!vehicleExitPoint(r,e.x,e.y,e.id))return fail('Vehicle is obstructed or has no safe exit.');
      p.vehicle=e.id;p.x=e.x;p.y=e.y;p.vx=p.vy=0;delete r.traceWalk;return ok('vehicle.mount',e.deployed!.uid,'WASD to drive; F to exit.');
    }
    case 'vehicleExit': {
      const e=p.vehicle&&r.entities[p.vehicle];if(!e||e.kind!=='vehicle')return fail('Not driving.');
      const spot=vehicleExitPoint(r,e.x,e.y,e.id);
      if(!spot)return fail('No safe exit beside vehicle.');
      delete p.vehicle;p.x=spot.x;p.y=spot.y;p.vx=p.vy=0;delete r.traceWalk;return ok('vehicle.exit',`${e.deployed!.uid}@${Math.round(e.x)},${Math.round(e.y)}:distance=${e.vehicle!.odometer.toFixed(1)}:fuel=${e.vehicle!.fuel.toFixed(2)}:hp=${e.hp!.toFixed(2)}`);
    }
    case 'vehicleRefuel': {
      const e=r.entities[it.eid];if(!e||e.kind!=='vehicle'||!e.vehicle||!owned(e)||!near(r,e,2))return fail('Motorbike out of reach.');
      if(e.vehicle.fuel+BAL.motorbike.canFuel>BAL.motorbike.tank)return fail('Not enough tank space for a whole Fuel Canister.');
      if(countItem(r,'inv','fuel_can')<1)return fail('Need one physical Fuel Canister.');
      removeItem(r,'inv','fuel_can',1);e.vehicle.fuel+=BAL.motorbike.canFuel;return ok('vehicle.refuel',`${e.deployed!.uid}:fuel_canx1:+${BAL.motorbike.canFuel}`);
    }
    case 'vehicleRepair': {
      const e=r.entities[it.eid];if(!e||e.kind!=='vehicle'||!e.vehicle||!e.deployed||!owned(e)||!near(r,e,2)||p.vehicle)return fail('Dismount near your motorbike.');
      if((e.hp??0)>=BAL.motorbike.maxHp)return fail('Motorbike is already sound.');
      const cost:[string,number][]=[['mechanical_parts',1],['fasteners',1]];if(!hasAll(r,'inv',cost))return fail('Repair needs 1 Mechanical Part and 1 Fastener.');
      for(const [key,qty] of cost)removeItem(r,'inv',key,qty);const before=e.hp||0;e.hp=Math.min(BAL.motorbike.maxHp,before+BAL.motorbike.repairHp);e.deployed.dur=e.hp;
      return ok('vehicle.repair',`${e.deployed.uid}:${before.toFixed(2)}->${e.hp.toFixed(2)}:mechanical_partsx1,fastenersx1`);
    }
    case 'vehicleUnloadBag': {
      // B04: a broken or out-of-fuel motorbike keeps its UID and cargo; the player moves its real cargo stacks (same objects,
      // same UIDs, charges and durability) into ONE physical ground bag at the motorbike's tile. No copy, no reward, no remote access.
      const e=r.entities[it.eid];
      if(!e||e.kind!=='vehicle'||!e.vehicle||!e.deployed||!owned(e)) return fail('That motorbike is not yours.');
      if(p.vehicle===e.id) return fail('Dismount before unloading cargo.');
      if(!near(r,e,2)||!clearPhysicalLine(r,p,e,true)) return fail('Motorbike out of reach or no clear line to it.');
      const broken=(e.hp??0)<=0, dry=(e.vehicle.fuel??0)<=0;
      if(!broken&&!dry) return fail('The motorbike can still run. Unload only when it is broken or out of fuel.');
      const cargo=C(r,e.c!);
      const picks:number[]=[];
      if(Array.isArray(it.uids)&&it.uids.length){ for(const u of it.uids){ const i=cargo.slots.findIndex(sl=>sl?.uid===u); if(i<0) return fail('That cargo is not in this motorbike.'); if(!picks.includes(i)) picks.push(i); } }
      else cargo.slots.forEach((sl,i)=>{ if(sl) picks.push(i); });
      if(!picks.length) return fail('Nothing in the motorbike to unload.');
      // The bag sits on a clear cell beside the bike (never under it), so the player can stand next to the bag and E-open it.
      const spot=vehicleExitPoint(r,e.x,e.y,e.id);
      if(!spot) return fail('No clear ground beside the motorbike. Nothing was moved.');
      const tx=Math.floor(spot.x/TILE), ty=Math.floor(spot.y/TILE), gi=ty*WW+tx;
      if(blockGrid(r)[gi]!==0 || [T.DEEP,T.SHALLOW,T.RIVER].includes(effTile(r,tx,ty))) return fail('The ground beside the motorbike cannot hold a bag. Nothing was moved.');
      // Source provenance: only a bag created by THIS motorbike (same entity and UID) may take its cargo. Other bags are never mixed in.
      const src={vehicleId:e.id,vehicleUid:e.deployed.uid};
      const sameSrc=(b:Entity)=>b.vehicleSource?.vehicleId===src.vehicleId&&b.vehicleSource?.vehicleUid===src.vehicleUid;
      const onSpot=Object.values(r.entities).filter(x=>x.kind==='bag'&&x.c&&Math.floor(x.x/TILE)===tx&&Math.floor(x.y/TILE)===ty);
      if(onSpot.some(b=>!sameSrc(b))) return fail('Another bag is on the ground beside the motorbike. Nothing was moved.');
      const existing=onSpot.find(sameSrc);
      if(existing){ const free=C(r,existing.c!).slots.filter(sl=>!sl).length; if(free<picks.length) return fail('This motorbike bag is full. Take items out first; nothing was moved.'); }
      let bag:Entity;
      if(existing) bag=existing;
      else { const cont=mkContainer(r,'bag',Math.max(8,picks.length)); bag={id:uid(r,'b'),kind:'bag',x:spot.x,y:spot.y,c:cont.id,label:'Motorbike cargo',born:now,vehicleSource:src}; r.entities[bag.id]=bag; }
      const bc=C(r,bag.c!); const moved:string[]=[];
      for(const i of picks){ const stack=cargo.slots[i]!; cargo.slots[i]=null; const slot=bc.slots.findIndex(sl=>!sl); bc.slots[slot]=stack; moved.push(stack.uid); }
      return ok('vehicle.unload',`${e.deployed.uid}:${bag.id}:${moved.join(',')}`,`Moved ${moved.length} stack${moved.length===1?'':'s'} from the motorbike into a ground bag beside it.`);
    }
    case 'vehicleLubricate': {
      const e=r.entities[it.eid];if(!e||e.kind!=='vehicle'||!e.vehicle||!e.deployed||!owned(e)||!near(r,e,2)||p.vehicle)return fail('Dismount near your motorbike.');
      if(!Number.isFinite(e.vehicle.lube)) e.vehicle.lube=0;
      if((e.vehicle.lube||0) >= BAL.oilRefineryV1.lubricantDistancePx) return fail('Motorbike already fully lubricated.');
      if(countItem(r,'inv','lubricant')<1) return fail('Need 1 Machine Lubricant from the Oil Refinery.');
      removeItem(r,'inv','lubricant',1); const add=BAL.oilRefineryV1.lubricantDistancePx; e.vehicle.lube=Math.min(BAL.oilRefineryV1.lubricantDistancePx*BAL.oilRefineryV1.lubricantOverCapFactor, (e.vehicle.lube||0)+add);
      return ok('vehicle.lubricate',`${e.deployed.uid}:lube+${add}->${e.vehicle.lube}`,`Lubricated: wear halved for next ${(e.vehicle.lube/TILE).toFixed(0)} tiles.`);
    }
    case 'placeCart': {
      if(p.vehicle)return fail('Exit the vehicle first.');
      const slots = C(r, 'inv').slots; const idx = slots[p.active]?.key === 'cart_kit' ? p.active : slots.findIndex(s => s?.key === 'cart_kit'); if (idx < 0) return fail('No packed cart.');
      if (!Number.isFinite(it.x) || !Number.isFinite(it.y)) return fail('Invalid location.');
      const tx = Math.floor(it.x / TILE), ty = Math.floor(it.y / TILE); if (blockedAt(r, tx, ty) || [T.SHALLOW, T.RIVER].includes(effTile(r, tx, ty))) return fail('Cart needs open dry ground.');
      if (dist(p.x, p.y, it.x, it.y) > 3 * TILE) return fail('Too far.');
      const deployed = C(r, 'inv').slots[idx]!; C(r, 'inv').slots[idx] = null; const c = mkContainer(r, 'cart', deployed.upgrade === 'freight' ? BAL.cart.freightSlots : BAL.cart.slots);
      const e: Entity = { id: uid(r, 'cart'), kind: 'cart', x: it.x, y: it.y, c: c.id, hp: 200, maxHp: 200, deployed }; r.entities[e.id] = e; award(gs, 'cart', now); return ok('cart.place', e.id);
    }
    case 'upgradeCart': {
      const e = r.entities[it.eid];
      if (!e || e.kind !== 'cart' || !owned(e) || !near(r, e, 3)) return fail('Use your cart within reach.');
      if (!e.deployed || e.deployed.key !== 'cart_kit') return fail('Pack and redeploy this legacy cart before upgrading.');
      if (it.uid !== e.deployed.uid) return fail('This cart has changed.');
      if (e.deployed.upgrade === 'freight') return fail('This cart is already reinforced.');
      const bench = r.entities[it.benchId];
      if (!bench || bench.kind !== 'struct' || bench.type !== 'workbench' || !bench.station || !owned(bench) || !near(r, bench, 3) || dist(bench.x, bench.y, e.x, e.y) > 3 * TILE || (bench.station.level ?? 1) < CART_FREIGHT_UPGRADE.benchLevel) return fail('Bring the cart to your level 2 workbench.');
      const cargo = e.c && C(r, e.c); if (!cargo || cargo.kind !== 'cart' || cargo.slots.length !== BAL.cart.slots) return fail('Invalid cart cargo.');
      if (!hasAll(r, 'inv', CART_FREIGHT_UPGRADE.cost)) return fail('Missing reinforcement materials.');
      for (const [key, qty] of CART_FREIGHT_UPGRADE.cost) removeItem(r, 'inv', key, qty);
      e.deployed.upgrade = 'freight';
      while (cargo.slots.length < BAL.cart.freightSlots) cargo.slots.push(null);
      return ok('cart.upgrade', `${e.deployed.uid}:freight`, 'Cart reinforced: 32 slots and a higher overload threshold.');
    }
    case 'cabinetRepair': {
      const c=r.entities[it.eid]; if(!c || !cabinetSupported(r,c) || !c.c || !near(r,c,2.2) || !clearInteraction(r,c))return fail('Use your supported cabinet within reach.');
      let repaired=0; for(const e of Object.values(r.entities).sort((a,b)=>a.id.localeCompare(b.id))) {
        if(e.kind!=='struct'||!owned(e)||!e.hp||!e.maxHp||e.hp>=e.maxHp||STRUCTS[e.type!]?.item||claimAt(r,e.tx!,e.ty!)?.id!==c.id)continue;
        const cost=structureRepairCost(e);if(!cost.length||!hasAll(r,c.c,cost))continue;
        for(const [k,q] of cost)removeItem(r,c.c,k,q);const before=e.hp;e.hp=Math.min(e.maxHp,e.hp+Math.ceil(e.maxHp/4));repaired++;receipt(r,now,'territory.repair',`${e.id}:${before}->${e.hp}:${cost.map(([k,q])=>`${k}x${q}`).join(',')}`);
      }
      if(!repaired)return fail('No eligible damaged structure with affordable cabinet materials.');
      return ok('territory.repair.batch',`${c.id}:${repaired}`,`Repaired ${repaired} structures using cabinet materials.`);
    }
    case 'reclaim': {
      const e = r.entities[it.eid]; if (!e || !owned(e) || !near(r, e, 3)) return fail('Out of reach or not owned.');
      if (e.kind === 'cart') { if (C(r, e.c!).slots.some(Boolean)) return fail('Unload the cart first.'); if (C(r, 'inv').slots.indexOf(null) < 0) return fail('Inventory full.'); if (p.pulling === e.id) p.pulling = null; removeEntity(r, e); if (e.deployed) returnReservations(r, [e.deployed], e.x, e.y, now); else addItem(r, 'inv', 'cart_kit', 1); return ok('cart.pack', e.id); }
      if (e.kind !== 'struct') return fail('Cannot reclaim that.');
      if (STRUCTS[e.type!].layer === 'floor' && entsAt(r,e.tx!,e.ty!).some(o=>o.type==='claim')) return fail('Remove the cabinet on this foundation first.');
      const d = STRUCTS[e.type!];
      if (entsAt(r, e.tx!, e.ty!).some(o => o.id !== e.id && STRUCTS[o.type!]?.layer === 'roof') && d.layer === 'floor') return fail('Remove the roof above first.');
      if (e.station?.queue.some(j => j.reserved === undefined)) return fail('Legacy job has no recoverable input record; let it finish before reclaiming.');
      const bag = bagStation(r, e, now, 'Reclaimed contents');
      removeEntity(r, e);
      if (d.item) { if (e.deployed) returnReservations(r, [e.deployed], e.x, e.y, now); else giveOrDrop(r, d.item, 1, now); }
      else for (const [k, q] of d.cost) { const back = Math.floor(q * BAL.economy.reclaimRefund); if (back > 0) giveOrDrop(r, k, back, now); }
      return ok('reclaim', `${e.type}${bag ? ' contents→' + bag.id : ''}`);
    }
    case 'wireSwitch': {
      const e=r.entities[it.eid];if(!e||e.type!=='power_switch'||!e.wireSwitch||!owned(e)||!near(r,e,2)||!clearInteraction(r,e))return fail('Switch out of reach.');
      e.wireSwitch.on=!e.wireSwitch.on;return ok('circuit.switch',`${e.id}:${e.wireSwitch.on?'on':'off'}`,`Switch ${e.wireSwitch.on?'on':'off'}.`);
    }
    case 'bearTrapSet': {
      const e=r.entities[it.eid];if(!e||e.type!=='bear_trap'||!e.bearTrap||!owned(e)||!near(r,e,2))return fail('Trap out of reach.');
      if((e.hp??0)<=0)return fail('This trap is destroyed.');
      const st=e.bearTrap.state;
      if(st==='armed')return fail('Trap is already armed.');
      if(st==='worn')return fail('Trap is worn out: reclaim it to recover what it still returns.');
      const cost=st==='unarmed'?BAL.bearTrapV1.armCost:BAL.bearTrapV1.rearmCost;
      if(!hasAll(r,'inv',cost as [string,number][]))return fail('Missing: '+(cost as [string,number][]).filter(([k,q])=>countItem(r,'inv',k)<q).map(([k,q])=>`${ITEMS[k].name} ${countItem(r,'inv',k)}/${q}`).join(', '));
      for(const [k,q] of cost as [string,number][])removeItem(r,'inv',k,q);
      e.bearTrap.state='armed';return ok(st==='unarmed'?'trap.arm':'trap.rearm',`${e.id}:${e.bearTrap.uses}`,`Bear trap armed (${e.bearTrap.uses} hits left).`);
    }
    case 'irSensorToggle': {
      const e=r.entities[it.eid];if(!e||e.type!=='ir_sensor'||!e.irSensor||!owned(e)||!near(r,e,2)||!clearInteraction(r,e))return fail('Sensor out of reach.');
      e.irSensor.enabled=!e.irSensor.enabled;return ok('circuit.irSensor',`${e.id}:${e.irSensor.enabled?'on':'off'}`,`Infrared sensor ${e.irSensor.enabled?'armed':'off'}: ${irSensorStatus(r,e)}.`);
    }
    case 'wireGenerator': {
      const e=r.entities[it.eid];if(!e?.basePower||e.type!=='base_generator'||!owned(e)||!near(r,e,2)||!clearInteraction(r,e))return fail('Generator out of reach.');
      if(e.basePower.network==='wire-v1')return fail('Generator already uses cables.');
      e.basePower.network='wire-v1';return ok('circuit.migrate',e.id,'Cable mode enabled; old direct links now need a physical wire route.');
    }
    case 'door': {
      const e = r.entities[it.eid]; if (!e || !near(r, e, 2) || !clearInteraction(r,e)) return fail('Door is out of reach or blocked.');
      if(e.kind!=='door' && (e.kind!=='struct'||!e.type?.startsWith('door')))return fail('Not a door.');
      if(e.open) {
        if(doorwayOccupied(r,e))return fail('Doorway occupied. Step clear before closing.');
        e.open=false;markDirty();return ok('door',`${e.id}:closed`);
      }
      if(e.electricDoor){
        const emergency=electricInterior(r,e);if(!emergency&&!electricDoorPowered(r,e))return fail('Powered door: no connected allocated power. Interior handle is on the other side.');
        e.electricDoor.releaseUntil=emergency?now+BAL.homeCircuit.emergencyReleaseMs:undefined;e.open=true;markDirty();return ok('circuit.door',`${e.id}:${emergency?'interior-release':'powered'}`,emergency?'Interior handle opened the door.':'Powered door opened.');
      }
      const d=e.kind==='door'?poiDoorContract(r,e):undefined;
      // A prior save whose authored lock was already removed keeps its prior access.
      // Locked imported gates require explicit spatial metadata, never POI-name inference.
      if(e.kind==='door' && e.locked) {
        if(!d||d.requirement!==e.locked)return fail('Access disabled: this gate lacks an authorized exit/circuit contract.');
        const exit=interiorRelease(r,e,d);
        if(!exit && d.requirement==='power') {
          if(!poiGenerator(r,d))return fail('Circuit has no authorized generator.');
          if(!poiPowered(r,d,now))return fail(poiPowerMissingReason(poiGenerator(r,d),now));
        }
        let cardUid:string|undefined, remaining=0;
        if(!exit && d.requirement==='keycard') {
          const inv=C(r,'inv'),i=inv.slots.findIndex(s=>s?.key==='keycard' && (s.meta??'vault')===(d.cardClass??'vault') && (s.charge===undefined||s.charge>0));
          if(i<0)return fail(inv.slots.some(s=>s?.key==='keycard')?'Sealed. Carried card is incompatible or exhausted.':`Sealed. A ${d.cardClass??'vault'} keycard is required.`);
          const card=inv.slots[i]!;cardUid=card.uid;
          if(card.charge===undefined){card.qty--;if(!card.qty)inv.slots[i]=null;}
          else {card.charge--;remaining=card.charge;if(card.charge===0)inv.slots[i]=null;}
          award(gs,'vault',now);
        }
        r.poiAccessDigest=poiContractDigest(getWorld(r.layoutId||'shipping'));
        e.poiDoor={version:'poi-access-v1',closeAt:now+BAL.poiAccess.doorOpenMs,scans:(e.poiDoor?.scans||0)+(cardUid?1:0),...(cardUid?{lastCardUid:cardUid}:e.poiDoor?.lastCardUid?{lastCardUid:e.poiDoor.lastCardUid}:{})};
        e.open=true;markDirty();
        return ok(cardUid?'poi.card.scan':'poi.door.open',`${e.id}:${exit?'interior-release':cardUid?`${cardUid}:remaining=${remaining}`:'powered'}`,cardUid?`${(d.cardClass??'vault')[0].toUpperCase()+(d.cardClass??'vault').slice(1)} card scanned; ${remaining} uses remain.`:exit?'Interior release opened the door.':'Powered gate opened.');
      }
      e.open=true;markDirty();return ok('door',`${e.id}:open`);
    }
    case 'generator': {
      const e = r.entities[it.eid]; if (!e || e.kind !== 'gen' || !near(r, e, 2.2) || !clearInteraction(r,e)) return fail('Generator out of reach or blocked.');
      if(!poiGeneratorContract(r,e))return fail('No authorized local circuit for this generator.');
      if(e.power===1&&!e.poiPower&&getWorld(r.layoutId||'shipping').poiAccess?.doors.some(d=>d.generator?.tx===e.tx&&d.generator?.ty===e.ty&&Object.values(r.entities).some(o=>o.kind==='door'&&o.tx===d.tx&&o.ty===d.ty&&!o.locked)))return fail('Legacy circuit already unlocked; existing access is preserved.');
      if(e.poiPower && e.power===1 && e.poiPower.expiresAt>now){e.poiPower.pausedMs=e.poiPower.expiresAt-now;e.power=0;const change=advancePoiAccess(r,now);if(change.closed.length)markDirty();for(const id of change.closed)receipt(r,now,'poi.door.close',id);return ok('poi.power.pause',`${e.id}:remaining=${e.poiPower.pausedMs}`,`Generator off; ${Math.ceil(e.poiPower.pausedMs/1000)} seconds reserved.`);}
      if(e.poiPower?.pausedMs){e.poiPower.runAt=now;e.poiPower.runMs=e.poiPower.pausedMs;e.poiPower.expiresAt=now+e.poiPower.pausedMs;delete e.poiPower.pausedMs;e.power=1;return ok('poi.power.resume',`${e.id}:until=${e.poiPower.expiresAt}`,'Generator resumed without another canister.');}
      if (countItem(r, 'inv', 'fuel_can') < 1) return fail('Generator needs one physical Fuel Canister.');
      r.poiAccessDigest=poiContractDigest(getWorld(r.layoutId||'shipping'));
      const fuel=[...C(r,'inv').slots].reverse().find(s=>s?.key==='fuel_can')!; const fuelUid=fuel.uid;
      removeItem(r, 'inv', 'fuel_can', 1); e.power=1;e.poiPower={version:'poi-access-v1',fueledAt:now,expiresAt:now+BAL.poiAccess.fuelRuntimeMs,budgetMs:BAL.poiAccess.fuelRuntimeMs,runAt:now,runMs:BAL.poiAccess.fuelRuntimeMs};
      return ok('poi.power.fuel',`${e.id}:fuel_can:${fuelUid}:until=${e.poiPower.expiresAt}`,`Generator running for ${BAL.poiAccess.fuelRuntimeMs/1000} seconds.`);
    }
    case 'openAirdrop': { const e=r.entities[it.eid]; if(!e || e.kind!=='airdrop' || !e.airdrop) return fail('No airdrop here.'); const a=e.airdrop; if(a.phase==='signal'||a.phase==='descending') return fail('Airdrop is still in the air.'); if(a.phase==='locked') return fail(`Airdrop locked: opens to all in ${Math.max(0,Math.ceil((a.unlockAt-now)/1000))}s.`); if(!e.c || !canAccess(r,e.c)) return fail('Airdrop out of reach: walk up to it.'); return ok('airdrop.open',String(a.index)); }
    // Separate, committed observations. They never change the outcome of the gate, generator or container intent.
    case 'observeGate': {
      const e = r.entities[it.eid];
      if (!e || (e.kind !== 'door' && e.kind !== 'gen')) return fail('Not a gate or generator.');
      if (!near(r, e, e.kind === 'door' ? 2 : 2.2) || !clearInteraction(r, e)) return fail('Out of reach.');
      const place = placeOfPoi(r, e.poi); if (!place) return { ok: true, receipt: 'intel.none' };
      let key: string | undefined;
      if (e.kind === 'door') { const d = poiDoorContract(r, e); if (d && e.locked && d.requirement === e.locked) key = gateKey(place, d.requirement, d.cardClass); }
      else if (poiGeneratorContract(r, e)) key = `gen:${place}`;
      if (!key || !recordIntel(r, [key])) return { ok: true, receipt: 'intel.none' };
      markDirty();
      return ok('intel.gate', `${e.id}:${key}`, 'Noted in Map · Intel.');
    }
    case 'observeLoot': { // Same reach rule as normal container interaction (near + clear line).
      const e = r.entities[it.eid]; if (!e || e.kind !== 'loot' || !e.c || !near(r, e, 2.2) || !clearInteraction(r, e)) return fail('Container out of reach.');
      const place = placeOfPoi(r, e.poi); if (!place) return { ok: true, receipt: 'intel.none' };
      const keys = [`opened:${place}`];
      for (const s of C(r, e.c)?.slots ?? []) if (s) keys.push(`loot:${place}:${s.key === 'blueprint' ? `bp_${s.meta}` : s.key}`);
      if (!recordIntel(r, keys)) return { ok: true, receipt: 'intel.none' };
      markDirty();
      return ok('intel.loot', `${e.id}:${place}`);
    }
    case 'openCash': { // C15: special finite POI chest mints physical cash ONCE, only during the final 72h
      const e = r.entities[it.eid]; if (!e || e.kind !== 'cash' || !near(r, e, 2.2) || !clearInteraction(r,e)) return fail('Out of reach.');
      if (!isRagnarok(r, now)) return fail('Sealed with a Ragnarok glyph. It will open only in the final 72 hours.');
      if (e.minted) return ok('cash.view', e.id);
      addItem(r, e.c!, 'rcash', e.stock!.cash); e.minted = true; e.stock!.cash = 0;
      return ok('cash.mint', `${e.id}:${countItem(r, e.c!, 'rcash')}`);
    }
    case 'deposit': { // C17 atomic debit physical → credit profile
      const e = r.entities[it.eid]; if (!e || e.type !== 'escrow' || !owned(e) || !near(r, e, 2.7)) return fail('Stand next to your Rương ký gửi.');
      const claim = claimAt(r, e.tx!, e.ty!); if (!claim || !owned(claim)) return fail('Escrow chest is not on owned land.');
      const n = countItem(r, 'inv', 'rcash'); if (n <= 0) return fail('You carry no physical Ragnarok cash.');
      if (!Number.isSafeInteger(gs.profile.securedCash + n) || !Number.isSafeInteger(r.deposited + n)) return fail('Cash total exceeds the supported range.');
      removeItem(r, 'inv', 'rcash', n); gs.profile.securedCash += n; r.deposited += n;
      gs.profile.profileReceipts.push(`dep:${r.id}:${it.id}:${n}`);
      award(gs, 'first_deposit', now);
      return ok('escrow.deposit', `${n}`, `Secured ${n} cash to your profile.`);
    }
    case 'buySpares': {
      const e=r.entities[it.eid]; if(!e || e.kind!=='vendor' || !near(r,e,2.6) || !clearInteraction(r,e)) return fail('Walk up to the trader.');
      const item=it.item; if(typeof item!=='string' || !Object.prototype.hasOwnProperty.call(VENDOR_SPARES,item)) return fail('Not sold for Spares.');
      const offer=VENDOR_SPARES[item], stockKey=`spares:${item}`;
      if((r.vendorStock[stockKey]??0)<=0) return fail('Out of stock this run.');
      if(countItem(r,'inv','spares')<offer.price) return fail(`Needs ${offer.price} Spares.`);
      // Physical overflow is dropped at the trader, never deleted. No sell path.
      removeItem(r,'inv','spares',offer.price); r.vendorStock[stockKey]--; giveOrDrop(r,item,offer.qty,now);
      return ok('vendor.spares',`${item}x${offer.qty} -${offer.price} spares`, `Bought ${offer.qty} ${ITEMS[item].name} for ${offer.price} Spares.`);
    }
    case 'buy': { // physical vendor
      const e = r.entities[it.eid]; if (!e || e.kind !== 'vendor' || !near(r, e, 2.6) || !clearInteraction(r,e)) return fail('Walk up to the trader.');
      const item = it.item as string; if ((r.vendorStock[item] ?? 0) <= 0) return fail('Out of stock this run.');
      if (item === 'escrow_chest') {
        const price = BAL.economy.escrowChestPrice; if (countItem(r, 'inv', 'rcash') < price) return fail(`Needs ${price} physical Ragnarok cash.`);
        if (C(r, 'inv').slots.indexOf(null) < 0 && countItem(r, 'inv', 'rcash') !== price) return fail('Inventory full.');
        removeItem(r, 'inv', 'rcash', price); r.vendorStock[item]--; giveOrDrop(r, 'escrow_chest', 1, now); return ok('vendor.buy', `escrow_chest -${price} cash`);
      }
      const v = VENDOR_SECURED[item]; if (!v) return fail('Not sold here.');
      if (it.freight === true) {
        // B05-R freight: same price, stock and secured-cash debit as a pack purchase, but the good lands as a physical parcel at the trader.
        // It never needs pack room, so a full inventory cannot destroy or refuse a paid item.
        if (typeof it.id !== 'string' || !it.id) return fail('Purchase needs an id.');
        const receipt = `spend:${r.id}:${it.id}:${v.price}`;
        if (gs.profile.profileReceipts.includes(receipt) || Object.values(r.entities).some(x => x.parcel?.purchaseId === it.id)) return fail('This purchase was already paid.');
        if (gs.profile.securedCash < v.price) return fail(`Needs ${v.price} secured cash (you have ${gs.profile.securedCash}).`);
        gs.profile.securedCash -= v.price; r.vendorStock[item]--; gs.profile.profileReceipts.push(receipt);
        spawnParcel(r, e.x, e.y, now, item, it.id);
        return ok('vendor.parcel', `${item} -${v.price} secured`, `Paid ${v.price} secured cash. ${ITEMS[item].name} is waiting in a parcel at the trader: collect it, or load it into a cart in reach.`);
      }
      if (gs.profile.securedCash < v.price) return fail(`Needs ${v.price} secured cash (you have ${gs.profile.securedCash}).`);
      if (spaceFor(r, 'inv', item) < 1) return fail('Inventory full.');
      gs.profile.securedCash -= v.price; r.vendorStock[item]--; addItem(r, 'inv', item, 1); gs.profile.profileReceipts.push(`spend:${r.id}:${it.id}:${v.price}`);
      return ok('vendor.secured', `${item} -${v.price} secured`);
    }
    case 'research': return research(gs, r, it, now, ok);
    case 'drink': {
      const tx = Math.floor(it.x / TILE), ty = Math.floor(it.y / TILE); if (dist(p.x, p.y, it.x, it.y) > 2 * TILE) return fail('Too far.');
      if (!getWorld().fresh[ty * WW + tx] || effTile(r, tx, ty) === T.ICE) return fail('Not fresh water (sea water would make you sick).');
      p.thirst = Math.min(100, p.thirst + 25);
      const fi = C(r, 'inv').slots.findIndex(s => s && ITEMS[s.key].waterContainer && (s.charge ?? 0) < ITEMS[s.key].charge!); if (fi >= 0) { const flask = C(r, 'inv').slots[fi]!; flask.charge = ITEMS[flask.key].charge!; }
      return ok('drink', `${tx},${ty}`, fi >= 0 ? 'You drink and refill your flask.' : 'You drink deeply.');
    }
    case 'farmConfigure': {
      const e=r.entities[it.eid], f=e?.farm;
      if(!e || e.kind!=='struct' || e.type!=='farm_controller' || !f || !owned(e) || !near(r,e,3) || !clearInteraction(r,e)) return fail('Use your Garden Tender within reach.');
      if(it.field==='enabled' && typeof it.value==='boolean') f.enabled=it.value;
      else if(it.field==='crop' && (it.value==='crop'||it.value==='herb')) f.crop=it.value;
      else if(['gardenId','barrelId','chestId'].includes(it.field)) {
        const field=it.field as 'gardenId'|'barrelId'|'chestId';
        if(it.value === '') delete f[field];
        else {const target=r.entities[it.value]; const typeOK=field==='gardenId'? target?.type==='garden' : field==='barrelId'? target?.type==='barrel' : ['chest_small','chest_large'].includes(target?.type || '');
          if(!target || target.kind!=='struct' || !owned(target) || !typeOK || dist(e.x,e.y,target.x,target.y)>BAL.garden.tenderLinkTiles*TILE || !clearSegment(r,e,target)) return fail('Choose an owned, unobstructed matching structure within three tiles.');
          if(Object.values(r.entities).some(other=>other.id!==e.id && other.farm?.[field]===target.id))return fail('That structure is already linked to another tender.');
          f[field]=target.id;
        }
      } else return fail('Invalid tender setting.');
      return ok('farm.configure',`${e.id}:${it.field}`);
    }
    case 'fillBarrel': {
      const e=r.entities[it.eid]; if(!e || e.kind!=='struct' || e.type!=='barrel' || !owned(e) || !near(r,e,2.2) || !clearInteraction(r,e))return fail('Stand near your barrel.');
      if((e.water||0)>11)return fail('Barrel has less than one unit of space.');
      const f=C(r,'inv').slots.find(s=>s && ITEMS[s.key].waterContainer && (s.charge||0)>0);if(!f)return fail('Carry a filled water flask or canteen.');
      f.charge!--;e.water=(e.water||0)+1;return ok('barrel.pour',e.id,'Poured one water charge into the barrel.');
    }
    case 'barrel': { const e = r.entities[it.eid]; if (!e || e.type !== 'barrel' || !near(r, e)) return fail('Out of reach.'); if ((e.water || 0) < 1) return fail('The barrel is dry. Wait for rain.');
      const fi = C(r, 'inv').slots.findIndex(s => s && ITEMS[s.key].waterContainer && (s.charge ?? 0) < ITEMS[s.key].charge!);
      if (fi >= 0) { const s = C(r, 'inv').slots[fi]!; const m = Math.min(ITEMS[s.key].charge! - (s.charge || 0), Math.floor(e.water!)); s.charge = (s.charge || 0) + m; e.water! -= m; return ok('barrel.fill', `${m}`); }
      p.thirst = Math.min(100, p.thirst + 25); e.water! -= 1; return ok('barrel.drink', '1'); }
    case 'douseTree': {
      const tx=it.tx,ty=it.ty;if(!Number.isInteger(tx)||!Number.isInteger(ty)||tx<0||ty<0||tx>=WW||ty>=WH)return fail('Invalid target.');
      const target={x:tx*TILE+8,y:ty*TILE+8},source=sourceAt(r,tx,ty),st=source?.st;
      if(!source||!st?.fire||st.fire<=r.clock.simMs||!near(r,target,2.2)||!clearInteraction(r,target))return fail('No reachable burning tree.');
      const flask=C(r,'inv').slots.find(s=>s&&ITEMS[s.key].waterContainer&&(s.charge??0)>0);if(!flask)return fail('Needs one flask charge of water.');
      flask.charge!--;st.fire=0;delete st.fireSpreadAt;delete st.fireDepth;return ok('fire.douse',`${tx},${ty}:${flask.uid}`,'Fire doused with one flask charge.');
    }
    case 'restoreGardenSoil': {
      const e=r.entities[it.eid];if(!e||e.kind!=='struct'||e.type!=='garden'||!e.garden||!owned(e)||!near(r,e,2.2)||!clearInteraction(r,e))return fail('Use your garden within reach.');
      const i=e.ty!*WW+e.tx!,ground=r.terrain[i];if(!ground||ground.t!==T.BURNT||ground.until)return fail('This soil is not scorched.');
      if(!hasAll(r,'inv',[['fiber',2],['herb',1]]))return fail('Needs 2 fiber and 1 Bitterleaf.');
      removeItem(r,'inv','fiber',2);removeItem(r,'inv','herb',1);delete r.terrain[i];markDirty();return ok('garden.restore',e.id,'Scorched soil restored with fiber and Bitterleaf.');
    }
    case 'gardenFrame': {
      const e=r.entities[it.eid];if(!e || e.kind!=='struct' || e.type!=='garden' || !e.garden || !owned(e) || !near(r,e,2.2) || !clearInteraction(r,e)) return fail('Use your garden within reach.');
      if(it.remove===true){if(!e.garden.coldFrame)return fail('No frame installed.');delete e.garden.coldFrame;giveOrDrop(r,'wood',2,now);giveOrDrop(r,'fiber',2,now);return ok('garden.frame.remove',e.id,'Frame dismantled; some wood and fiber recovered.');}
      if(e.garden.coldFrame)return fail('Frame already installed.');if(!hasAll(r,'inv',GARDEN_FRAME_COST))return fail('Needs wood, fiber, glass and Bitterleaf.');
      for(const [k,q] of GARDEN_FRAME_COST)removeItem(r,'inv',k,q);e.garden.coldFrame=true;return ok('garden.frame.install',e.id,'Cold frame and raised soil installed; rain will no longer water this plot.');
    }
    case 'garden': {
      const e = r.entities[it.eid]; if (!e || e.kind !== 'struct' || e.type !== 'garden' || !e.garden || !owned(e) || !near(r, e)) return fail('Use your garden within reach.'); const g = e.garden;
      if (!g.crop) {
        const crop: unknown = it.crop ?? 'crop'; // Old commands still plant Sunroot.
        if (crop !== 'crop' && crop !== 'herb') return fail('Unknown planting choice.');
        const rule = GARDEN_CROPS[crop];
        if (!hasAll(r, 'inv', rule.inputs)) return fail('Missing planting materials.');
        for (const [key, qty] of rule.inputs) removeItem(r, 'inv', key, qty);
        g.crop = crop; g.growth = 0; return ok('garden.plant', `${e.id}:${crop}`, `${rule.name} planted. Water keeps it growing.`);
      }
      if (g.growth >= 1) {
        if (g.crop !== 'crop' && g.crop !== 'herb') return fail('Unknown crop.');
        const crop = g.crop, rule = GARDEN_CROPS[crop]; g.crop = null; g.growth = 0;
        for (const [key, qty] of rule.output) giveOrDrop(r, key, qty, now);
        return ok('garden.harvest', `${e.id}:${crop}`, `${rule.name} harvested into your pack or on the ground.`);
      }
      if (g.water >= 3) return fail('The plot is already fully watered.');
      const fi = C(r, 'inv').slots.findIndex(s => s && ITEMS[s.key].waterContainer && (s.charge ?? 0) > 0); if (fi < 0) return fail('Needs water (flask) — or wait for rain.');
      C(r, 'inv').slots[fi]!.charge! -= 1; g.water = Math.min(3, g.water + 1); return ok('garden.water', e.id);
    }
    case 'grabCart': { if(p.vehicle)return fail('Exit the vehicle first.'); const e = r.entities[it.eid]; if (!e || e.kind !== 'cart' || !owned(e) || !near(r, e, 2)) return fail('Out of reach.'); p.pulling = p.pulling === e.id ? null : e.id; return ok('cart.grab', `${e.id}:${!!p.pulling}`); }
    case 'evacuate': {
      const e = r.entities[it.eid]; if (!e || e.kind !== 'evac' || !near(r, e, 2.5)) return fail('You must be at the evacuation beacon.');
      return endRun(gs, 'evacuated', now);
    }
    case 'abandon': return endRun(gs, 'abandoned', now);
    case 'qaAdvance': { if (!Number.isFinite(it.hours) || it.hours < 0 || !Number.isFinite(r.qaOffset + it.hours * HOUR)) return fail('Invalid time advance.'); r.qaOffset += it.hours * HOUR; r.qaUsed = true; return ok('qa.advance', `+${it.hours}h (LOCAL/UNVERIFIED)`); }
    case 'castCancel': return ok('cast.cancel', 'no charge used');
  }
  return fail('Unknown action.');
}

export function owned(e: Entity) { return e.owner === undefined || e.owner === 'player'; }
function validSlot(c: Container, slot: unknown): slot is number { return Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) < c.slots.length; }
/** True when a container is some station's fuel input (not a generator's). Stations and generators share the 'fuel' kind. */
export function isStationFuel(r: RunState, cid: string): boolean {
  return Object.values(r.entities).some(e => e.station?.fuelC === cid && !e.basePower);
}
function accepts(c: Container, slot: number, s: Stack) {
  if (['loot', 'cash', 'out'].includes(c.kind)) return false;
  if (c.kind === 'fuel') return !!ITEMS[s.key]?.fuel;
  if (c.kind === 'eq') return ITEMS[s.key]?.slot === ['head', 'body', 'back'][slot];
  return true;
}
/** B04: a bag emptied by a legal physical withdrawal disappears (no ghost). A bag with pending legacy recovery jobs is kept. */
/** B05-R freight: one paid parcel = a ground bag holding exactly one real stack (UID) of the purchased good, placed beside the trader. */
function spawnParcel(r: RunState, x: number, y: number, now: number, item: string, purchaseId: string): Entity {
  const bag = mkContainer(r, 'bag', 1); bag.slots[0] = mkStack(r, item, 1);
  const e: Entity = { id: uid(r, 'b'), kind: 'bag', x: x + 14, y: y + 14, c: bag.id, label: `Parcel · ${ITEMS[item].name}`, born: now, parcel: { purchaseId, item } };
  r.entities[e.id] = e; return e;
}
function pruneEmptyBag(r: RunState, cid: string) {
  const bag = Object.values(r.entities).find(e => e.kind === 'bag' && e.c === cid);
  if (!bag || bag.legacyJobs?.queue.length || C(r, cid).slots.some(Boolean)) return;
  delete r.entities[bag.id]; delete r.custody[cid]; markDirty();
}
function canAccess(r: RunState, cid: string) {
  if (cid === 'inv' || cid === 'eq') return true;
  for (const e of Object.values(r.entities)) if ((e.kind!=='airdrop'||e.airdrop?.phase==='open'||e.airdrop?.phase==='partial') && (e.c === cid || e.station?.fuelC === cid || e.station?.outC === cid) && (owned(e) || e.kind==='recycler')) return dist(r.player.x, r.player.y, e.x, e.y) <= 2.8 * TILE && (e.kind==='recycler'||e.kind==='airdrop'?clearInteraction(r,e):clearWallLine(r,r.player,e));
  return false;
}
export function homeComplete(r: RunState) {
  return Object.values(r.entities).some(e => e.kind === 'struct' && e.type === 'bed_straw' && isSheltered(r, e.x, e.y));
}

function useItem(gs: GameState, r: RunState, it: Intent, now: number, ok: (k: string, d: string, m?: string) => Result): Result {
  const cid = it.c ?? 'inv'; const c = C(r, cid); if (!c || !canAccess(r, cid) || !validSlot(c, it.slot)) return fail('Invalid or out of reach container.');
  const s = c.slots[it.slot]; if (!s) return fail('Empty.');
  const d = ITEMS[s.key]; const p = r.player;
  if (d.cat === 'bp') { const rec = s.meta!; if (!RECIPES[rec]) return fail('Invalid blueprint.'); if (isRecipeKnown(r.knowledge.recipes, rec)) return fail('You already know this recipe.'); r.knowledge.recipes.push(rec); c.slots[it.slot] = null; return ok('learn.blueprint', rec, `Learned: ${ITEMS[RECIPES[rec].out].name}`); }
  if (d.slot) { const idx = ['head', 'body', 'back'].indexOf(d.slot); const eq = C(r, 'eq'); if (c === eq) return fail('Already equipped.'); const prev = eq.slots[idx]; if (prev && !accepts(c, it.slot, prev)) return fail('Move the old equipment to inventory first.'); eq.slots[idx] = s; c.slots[it.slot] = prev; return ok('equip', s.key); }
  if (d.food) {
    if (d.waterContainer) { if ((s.charge ?? 0) <= 0) return fail('Flask is empty.'); s.charge!--; p.thirst = Math.min(100, p.thirst + (d.food.thirst ?? 0)); return ok('drink.flask', `${s.uid}:${s.charge}`); }
    const f = d.food; p.hunger = clamp(p.hunger + (f.hunger || 0), 0, 100); p.thirst = clamp(p.thirst + (f.thirst || 0), 0, 100); p.hp = clamp(p.hp + (f.hp || 0), 1, BAL.player.maxHp); p.warmth = clamp(p.warmth + (f.warmth || 0), 0, 100); p.rad = clamp(p.rad + (f.rad || 0), 0, 100);
    s.qty--; if (s.qty <= 0) c.slots[it.slot] = null; return ok('consume', s.key);
  }
  if (d.place === 'cart') return fail('Use build mode or click the ground to place the cart.');
  return fail('Select it on the quickbar to use.');
}

function stationNear(r: RunState, kind: string, eid?: string) {
  if (eid) { const e = r.entities[eid]; if (e?.kind === 'struct' && e.station && owned(e) && STRUCTS[e.type!]?.station === kind && near(r, e, 3)) return e; return null; }
  return Object.values(r.entities).find(e => e.kind === 'struct' && owned(e) && STRUCTS[e.type!].station === kind && near(r, e, 3)) || null;
}
function craft(gs: GameState, r: RunState, it: Intent, now: number, ok: (k: string, d: string, m?: string) => Result): Result {
  if (typeof it.recipe !== 'string' || !Object.prototype.hasOwnProperty.call(RECIPES, it.recipe)) return fail('Unknown recipe.'); const rc = RECIPES[it.recipe];
  if (!isRecipeKnown(r.knowledge.recipes, it.recipe)) return fail('You have not learned this recipe.');
  const ins = rc.ins.filter(([, q]) => q > 0);
  const activeAction = r.player.action; const activeInput = activeAction?.slot !== undefined && activeAction.slot >= 0 ? C(r, 'inv').slots[activeAction.slot] : null;
  if (activeInput && ins.some(([key]) => key === activeInput.key)) return fail('Finish using that item before crafting.');
  if (!hasAll(r, 'inv', ins)) return fail('Missing: ' + ins.filter(([k, q]) => countItem(r, 'inv', k) < q).map(([k, q]) => `${ITEMS[k].name} ${countItem(r, 'inv', k)}/${q}`).join(', '));
  if (!rc.station) {
    if (spaceFor(r, 'inv', rc.out) < rc.qty && !ins.some(([k, q]) => countItem(r, 'inv', k) === q)) return fail('Inventory full.');
    for (const [k, q] of ins) removeItem(r, 'inv', k, q);
    giveOrDrop(r, rc.out, rc.qty, now); r.player.skills.craft += 1;
    return ok('craft.hand', it.recipe, `Crafted ${ITEMS[rc.out].name}`);
  }
  const st = stationNear(r, rc.station, it.eid); if (!st) return fail(`Requires a ${STRUCTS[rc.station].name} within reach.`);
  if (it.recipe === 'recover_drive' && !clearInteraction(r, st)) return fail('A wall blocks access to the workbench.');
  if ((st.station!.level ?? 1) < requiredStationLevel(rc)) return fail(`Requires workbench level ${rc.stationLevel}.`);
  if (rc.station === 'oil_pump' && !authorizedOilSource(r, st.tx!, st.ty!)) return fail('This pump has no oil left in its source (or no authorized source).');
  if (st.station!.queue.length >= 6) return fail('Station queue is full.');
  // Multi-output bundles are preflighted at queue time too, so no paid inputs are reserved for a batch that cannot land.
  if (rc.outs && !recoveryFits(C(r, st.station!.outC), rc.outs)) return fail('Refinery output cannot hold the whole batch; collect items first.');
  const reserved = reserveInputs(r, ins);
  st.station!.queue.push({ id: uid(r, 'j'), recipe: it.recipe, left: rc.secs * 1000, total: rc.secs * 1000, reserved });
  return ok('job.queue', `${it.recipe}@${st.id}`, `${recipeOutputs(rc).map(([k, q]) => `${q} ${ITEMS[k].name}`).join(' + ')} queued at ${STRUCTS[st.type!].name}.`);
}

function research(gs: GameState, r: RunState, it: Intent, now: number, ok: (k: string, d: string, m?: string) => Result): Result {
  const st = stationNear(r, 'research', it.eid); if (!st) return fail('Requires a Research Table within reach.');
  if (st.station!.queue.length >= 3) return fail('Research queue is full.');
  const known = new Set(r.knowledge.recipes); const pending = new Set(st.station!.queue.map(j => j.recipe.split(':')[1]));
  const unknown = Object.keys(RECIPES).filter(k => !known.has(k) && !pending.has(k));
  const B = BAL.research;
  if (it.mode === 'random') {
    if (!unknown.length) return fail('Nothing left to discover.');
    if (countItem(r, 'inv', 'spares') < B.randomSparesCost) return fail(`Needs ${B.randomSparesCost} Spares.`);
    const pool = unknown.filter(k => !k.startsWith('core_')); const pick = (pool.length ? pool : unknown)[Math.floor(rngNext(r) * (pool.length || unknown.length))];
    const reserved = reserveInputs(r, [['spares', B.randomSparesCost]]); st.station!.queue.push({ id: uid(r, 'j'), recipe: 'R:' + pick, left: B.randomSeconds * 1000, total: B.randomSeconds * 1000, reserved });
    return ok('research.random', pick, 'Tinkering with Spares… a blueprint will appear in the table output.');
  }
  if (it.mode === 'directed') {
    const k = it.recipe; if (!unknown.includes(k)) return fail('Already known or in progress.');
    if (!permitsDirectedResearch(RECIPES[k])) return fail('Too advanced to reverse-engineer from Spares — study a Core or find a blueprint.');
    if (countItem(r, 'inv', 'spares') < B.directedSparesCost) return fail(`Needs ${B.directedSparesCost} Spares.`);
    const reserved = reserveInputs(r, [['spares', B.directedSparesCost]]); st.station!.queue.push({ id: uid(r, 'j'), recipe: 'R:' + k, left: B.directedSeconds * 1000, total: B.directedSeconds * 1000, reserved });
    return ok('research.directed', k);
  }
  if (it.mode === 'specimen') {
    const inv = C(r, 'inv'); if (!validSlot(inv, it.slot)) return fail('Pick a specimen.'); const s = inv.slots[it.slot]; if (!s) return fail('Pick a specimen.');
    if ((ITEMS[s.key].studyRecipe && it.uid !== s.uid) || (it.uid !== undefined && it.uid !== s.uid)) return fail('That item is no longer in this slot.');
    if (r.player.action && r.player.action.slot === it.slot) return fail('Finish your current action first.');
    const target = ITEMS[s.key].specimen || CORE_STUDY[s.key] || ITEMS[s.key].studyRecipe; if (!target) return fail('Nothing to learn from that.');
    if (known.has(target) || pending.has(target)) return fail('You already know what it can teach.');
    const reserved = s.qty > 1 ? [portion(r, s, 1)] : [s];
    if (s.qty > 1) s.qty--; else inv.slots[it.slot] = null;
    st.station!.queue.push({ id: uid(r, 'j'), recipe: 'R:' + target, left: B.specimenSeconds * 1000, total: B.specimenSeconds * 1000, reserved });
    return ok('research.specimen', `${s.key}->${target}`, 'Specimen dissected. Notes forming…');
  }
  return fail('Unknown research mode.');
}

// ---------------- station work (C06) — shared by online tick and offline settle ----------------
/** Workshop state transitions (B03-B): one receipt per real change; first observation is silent. */
function stationState(r: RunState, e: Entity, code: string, at: number) {
  const st = e.station!; if (st.stateCode === code) return;
  const prev = st.stateCode; st.stateCode = code;
  if (prev !== undefined) receipt(r, at, 'station.state', `${e.id}:${prev}>${code}`);
}
export function stepStations(gs: GameState, dtMs: number, now: number, report?: string[], powered:ReadonlySet<string>=new Set()) {
  const r = gs.run!;
  const note = (message: string) => { if (report && !report.includes(message)) report.push(message); };
  for (const e of Object.values(r.entities)) {
    const st = e.station; if (!st) continue; const kind = e.kind==='recycler'?'recycler':STRUCTS[e.type!].station!;
    const needsFuel = kind === 'campfire' || kind === 'furnace' || kind === 'refinery' || kind === 'oil_pump';
    let t = dtMs, blocked = false;
    while (t > 0 || (!blocked && !!st.queue[0] && st.queue[0].left <= 0)) {
      const job = blocked ? undefined : st.queue[0];
      // A finished job is committed at its event time without requiring extra work or fuel.
      if (job && job.left <= 0) {
        const at = now - t;
        if (job.recipe==='X:drive'||job.recipe==='X:recover-v1'||job.recipe==='X:recover-v2'||job.recipe==='X:recover-v3'||COMPONENT_RECIPES.includes(job.recipe)) {
          // Outputs are fixed by the job's stored recipe version (v1 jobs never change when v2 is added).
          const plan=job.reserved?.length===1?recoveryPlanFor(job.reserved[0],job.recipe):null;
          if(e.kind!=='recycler'||!plan||plan.recipe!==job.recipe||!recoveryFits(C(r,st.outC),plan.outputs)){blocked=true;note('Recycler: output full or invalid reservation.');stationState(r,e,'output_full',at);continue;}
          // Capacity was checked for the whole set before any output is committed.
          for(const [key,qty] of plan.outputs)addItem(r,st.outC,key,qty);
          if(job.recipe!=='X:drive')receipt(r,at,'recycle.finish',`${job.reserved![0].uid}:${job.reserved![0].key}:${plan.outputs.map(([key,qty])=>`${key}x${qty}`).join(',')}`);
          note(`Recycler finished: ${plan.outputs.map(([key,qty])=>`${qty} ${ITEMS[key].name}`).join(', ')} in output.`);
        } else if (job.recipe === 'pump_crude') {
          // B05-R: a pump cycle is committed only if its own source still has stock and the output has room. Stock and output change together.
          const src = e.kind==='struct' && e.type==='oil_pump' && e.tx!==undefined && e.ty!==undefined ? authorizedOilSource(r, e.tx, e.ty) : null;
          if (!src) { blocked = true; note('Oil pump: the source is empty or not authorized.'); stationState(r,e,'source_empty',at); continue; }
          if (spaceFor(r, st.outC, 'crude_petroleum') < 1) { blocked = true; note('Oil pump: output full.'); stationState(r,e,'output_full',at); continue; }
          src.stock -= 1; addItem(r, st.outC, 'crude_petroleum', 1);
          receipt(r, at, 'pump.extract', `${oilSourceKey(src.tx, src.ty)}:crude_petroleum x1 stock=${src.stock}`);
          note('Oil pump: 1 Crude Petroleum in output.');
        } else if (job.recipe.startsWith('R:')) {
          const k = job.recipe.slice(2);
          if (addItem(r, st.outC, 'blueprint', 1, { meta: k }) > 0) { blocked = true; note('Research table: output slots full.'); stationState(r,e,'output_full',at); continue; }
          note(`Research table: blueprint for ${ITEMS[RECIPES[k].out].name} is ready.`); award(gs, 'first_research', at);
        } else {
          const rc = RECIPES[job.recipe]; const outs = recipeOutputs(rc);
          // Single-output recipes keep their original capacity rule. Multi-output bundles are
          // preflighted as a whole: either every co-product is committed or none is.
          if (rc.outs ? !recoveryFits(C(r, st.outC), outs) : spaceFor(r, st.outC, rc.out) < rc.qty) { blocked = true; note(`${STRUCTS[e.type!].name}: output slots full.`); stationState(r,e,'output_full',at); continue; }
          for (const [key, qty] of outs) addItem(r, st.outC, key, qty);
          if (outs.some(([key]) => key === 'iron_ingot')) award(gs, 'first_ingot', at);
          note(`${STRUCTS[e.type!].name} finished ${outs.map(([key, qty]) => `${qty} ${ITEMS[key].name}`).join(', ')}.`);
        }
        receipt(r, at, 'job.done', `${e.id}:${job.recipe}`); st.queue.shift(); continue;
      }
      if (blocked && kind !== 'campfire') break;
      if (!job && kind !== 'campfire') stationState(r,e,'idle',now-t);
      if (needsFuel) {
        const burning = kind === 'campfire' || !!job;
        if (!burning) break;
        if (st.burn <= 0) {
          // B05-R free-energy guard (policy: stationBurnable): a station never burns Fuel Canisters. Canisters are the refinery/furnace product, worth 60 s of
          // burn per 12–26 s cycle; burning them lets a station pay for its own output (a self-feeding loop). Generators and motorbikes still use them.
          const fc = C(r, st.fuelC); const fi = fc.slots.findIndex(s => s && stationBurnable(s.key));
          if (fi < 0) { if (job) { const key = job.recipe.startsWith('R:') ? job.recipe.slice(2) : job.recipe; note(`${STRUCTS[e.type!].name}: fuel ran out — ${ITEMS[RECIPES[key].out].name} paused.`); stationState(r,e,'fuel_out',now-t); } break; }
          const s = fc.slots[fi]!; st.burn += ITEMS[s.key].fuel! * 1000; s.qty--; if (s.qty <= 0) fc.slots[fi] = null;
        }
      }
      if (job && kind !== 'campfire') stationState(r,e,'running',now-t);
      const fuelRate = kind === 'furnace' && st.upgrade === 'kiln_lining' ? BAL.fuel.linedFurnaceFuelMultiplier : 1;
      const speed=kind==='workbench' && powered.has(e.id) ? BAL.industrialPower.workSpeedMultiplier : 1;
      let step = needsFuel ? Math.min(t, st.burn / fuelRate) : t; if (job) step = Math.min(step, job.left / speed);
      if (needsFuel) st.burn = Math.max(0, st.burn - step * fuelRate);
      t -= step;
      if (job) job.left = Math.max(0, job.left - step * speed);
    }
  }
}
export function stepGardensBarrels(gs: GameState, dtMs: number, wet: boolean, at: number = gs.run!.clock.lastSimAt) {
  const r = gs.run!; const G = BAL.garden;
  for (const e of Object.values(r.entities)) {
    if (!e.garden && e.type !== 'barrel') continue;
    const env = gardenEnvironment(r, e, wet, e.garden?.crop === 'herb' ? 'herb' : 'crop', at);
    // CAL-01: only LIQUID precipitation is caught; snow lands on top of the plot and
    // does not water it. A cold frame (or a roof) keeps its cover either way.
    const rain = wet && !isRoofed(r, e) && !e.garden?.coldFrame && env.catch > 0;
    if (e.garden) {
      const g = e.garden; const growSeconds = g.crop === 'herb' ? GARDEN_CROPS.herb.seconds : GARDEN_CROPS.crop.seconds; const rate = g.crop === 'crop' || g.crop === 'herb' ? env.rate : 1;
      const incoming = rain ? env.catch / 60000 : 0; const use = env.evaporation / (G.waterSecondsPerUnit * 1000);
      let growing = g.crop && g.growth < 1 && rate>0 ? Math.min(dtMs, (1 - g.growth) * growSeconds * 1000 / rate) : 0;
      if (use > incoming) growing = Math.min(growing, g.water / (use - incoming));
      if (growing > 0) { g.growth = Math.min(1, g.growth + growing * rate / (growSeconds * 1000)); if (g.growth >= 1 - 1e-12) g.growth = 1; g.water = Math.min(3, Math.max(0, g.water + (incoming - use) * growing)); }
      g.water = Math.min(3, g.water + incoming * (dtMs - growing));
    }
    if (e.type === 'barrel' && rain) e.water = Math.min(12, (e.water || 0) + dtMs / 20000);
  }
}
/** Local normalized climate/soil inputs are Map-owned. CAL-01 adds the seasonal
 * DEVIATION to the Map's own temperature/moisture (`climateAt`), never new terrain:
 * a cold frame stays a real paid structure that protects against the seasonal cold
 * and against rain/snow water, and an exposed plot in a cold/dry season really
 * grows slower. Wet weather still cools uncovered plots at slot boundaries. */
export function gardenEnvironment(r:RunState,e:Entity,wet:boolean,crop:'crop'|'herb' = e.garden?.crop==='herb'?'herb':'crop', at:number = r.clock.lastSimAt) {
  const m=getWorld().economyMap, x=e.tx??Math.floor(e.x/TILE), y=e.ty??Math.floor(e.y/TILE), i=y*WW+x;
  const biome=m.biome[i], mapMoisture=m.moisture[i], slope=m.slope[i], frame=!!e.garden?.coldFrame;
  const local=climateAt(r,x,y,at,isWet(weatherAt(r,at))?'rain':'clear');
  // The cold frame warms a plot whose local (Map + season) temperature is cold.
  const seasonTemperature=local.temperature;
  const temperature=Math.min(1,Math.max(0,seasonTemperature+(frame&&seasonTemperature<0.4?BAL.garden.coldFrameWarming:0)-(wet&&!frame&&!isRoofed(r,e)?BAL.garden.wetCooling:0)));
  const low=crop==='herb'?0.34:0.22,high=crop==='herb'?0.78:0.82;
  const climate=Math.max(0.15,Math.min(1,temperature<low?1-(low-temperature)*4:temperature>high?1-(temperature-high)*3:1));
  const ground:Record<string,number>={snow:0.65,sand:0.8,ash:0.55,toxic:0.4,hill:0.8,marsh:0.8};
  const fertility=Math.min(1,Math.max(0.3,(ground[biome]??1)+(frame?BAL.garden.coldFrameSoilBonus:0)-(mapMoisture<0.3||mapMoisture>0.75?0.1:0)-Math.min(0.2,slope*0.3)));
  const scorched=effTile(r,x,y)===T.BURNT;
  // Per-crop seasonal suitability: the same plot is a better Sunroot or Bitterleaf
  // investment depending on the season (competing outputs, SYS15-C10).
  const seasonal=cropSeasonFactor(local.season,crop);
  return {rate:climate*fertility*seasonal*(scorched?BAL.garden.scorchedSoilMultiplier:1),temperature,moisture:mapMoisture,biome,frame,scorched,covered:frame||isRoofed(r,e),climate:temperature<low?'cold':temperature>high?'hot':'suitable',season:local.season,seasonal,evaporation:local.evaporationMultiplier,catch:local.catchMultiplier,snowing:local.snowing};
}
function isRoofed(r: RunState, e: Entity) { return entsAt(r, e.tx!, e.ty!).some(o => o.kind === 'struct' && STRUCTS[o.type!].shelter); }

// Optional, explicit one-plot production network. All resources remain in
// physical linked structures; no global chest search or login-time grants.
function tenderLinks(r:RunState,e:Entity) {
  const f=e.farm; if(!f || !owned(e) || (e.hp??0)<=0 || !e.c) return null;
  const garden=f.gardenId && r.entities[f.gardenId], barrel=f.barrelId && r.entities[f.barrelId], chest=f.chestId && r.entities[f.chestId];
  if(!garden || garden.type!=='garden' || !garden.garden || !barrel || barrel.type!=='barrel' || !chest || !['chest_small','chest_large'].includes(chest.type||'') || !chest.c) return null;
  if(Object.values(r.entities).some(o=>o.id!==e.id && o.farm && (o.farm.gardenId===garden.id || o.farm.barrelId===barrel.id || o.farm.chestId===chest.id)))return null;
  if([garden,barrel,chest].some(o=>o.kind!=='struct'||!owned(o)||(o.hp??0)<=0||dist(e.x,e.y,o.x,o.y)>BAL.garden.tenderLinkTiles*TILE||!clearSegment(r,e,o)))return null;
  return {garden,barrel,chest};
}
function tenderEnergyAvailable(r:RunState,e:Entity) { return e.farm!.energy + C(r,e.c!).slots.reduce((v,s)=>v+(s ? (ITEMS[s.key].fuel||0)*1000*s.qty:0),0); }
function tenderSpend(r:RunState,e:Entity,cost:number) {
  const f=e.farm!,c=C(r,e.c!); if(tenderEnergyAvailable(r,e)<cost)return false;
  while(f.energy<cost){const i=c.slots.findIndex(s=>s && ITEMS[s.key].fuel);const s=c.slots[i]!;f.energy+=ITEMS[s.key].fuel!*1000;if(--s.qty===0)c.slots[i]=null;}
  f.energy-=cost;return true;
}
function tenderFits(r:RunState,cid:string,output:[string,number][]) {
  const slots=C(r,cid).slots.map(s=>s?{...s}:null);
  for(const [key,amount] of output){let n=amount;const d=ITEMS[key];for(const s of slots)if(s&&s.key===key&&s.meta===undefined&&s.dur===undefined&&s.charge===undefined){const take=Math.min(n,d.max-s.qty);s.qty+=take;n-=take;}for(let i=0;i<slots.length&&n>0;i++)if(!slots[i]){const take=Math.min(n,d.max);slots[i]={uid:'preview',key,qty:take};n-=take;}if(n>0)return false;}
  return true;
}
/** Coded tender state (B03-B). `paused` = a real condition blocks the next operation. */
export type TenderCode = 'stopped' | 'unlinked' | 'unsupported' | 'structure_decayed' | 'storage_full' | 'fuel_harvest' | 'ready_harvest' | 'seed_missing' | 'barrel_dry' | 'fuel_plant' | 'ready_plant' | 'dry' | 'fuel_pump' | 'growing' | 'slow';
export interface TenderState { code: TenderCode; label: string; paused: boolean }
const TENDER_LABEL: Record<TenderCode, string> = {
  stopped: 'Stopped', unlinked: 'Missing, blocked or out-of-range link', unsupported: 'Unsupported crop', structure_decayed: 'Linked structure decayed or unfunded',
  storage_full: 'Storage full — ripe crop waiting', fuel_harvest: 'Fuel needed to harvest', ready_harvest: 'Ready to harvest',
  seed_missing: 'Planting material needed in linked chest', barrel_dry: 'Barrel needs water', fuel_plant: 'Fuel needed to plant', ready_plant: 'Ready to plant',
  dry: 'Waiting for water (rain may grow crop)', fuel_pump: 'Fuel needed to pump (rain may grow crop)', growing: 'Growing', slow: 'Slow growth — inspect climate and soil',
};
const TENDER_PAUSED = new Set<TenderCode>(['stopped', 'unlinked', 'unsupported', 'structure_decayed', 'storage_full', 'fuel_harvest', 'seed_missing', 'barrel_dry', 'fuel_plant', 'dry', 'fuel_pump']);
export function tenderState(r:RunState,e:Entity):TenderState {
  const code = tenderCode(r, e); return { code, label: TENDER_LABEL[code], paused: TENDER_PAUSED.has(code) };
}
export function tenderStatus(r:RunState,e:Entity):string { return tenderState(r,e).label; }
function tenderCode(r:RunState,e:Entity):TenderCode {
  const f=e.farm;if(!f)return 'stopped';if(!f.enabled)return 'stopped';const links=tenderLinks(r,e);if(!links)return 'unlinked';
  const {garden,barrel,chest}=links, g=garden.garden!;
  if(g.crop && !GARDEN_CROPS[g.crop as 'crop'|'herb'])return 'unsupported';
  // Upkeep-decayed structure: an unfunded linked structure that has already lost HP.
  const plan=planTerritory(r);
  const decayed=[garden,barrel,chest,e].some(o=>o.hp!==undefined&&o.maxHp!==undefined&&o.hp<o.maxHp&&!(plan.assigned.get(o.id)&&plan.forecast.get(plan.assigned.get(o.id)!.id)?.funded));
  if(decayed)return 'structure_decayed';
  if(g.crop&&g.growth>=1){if(!tenderFits(r,chest.c!,GARDEN_CROPS[g.crop as 'crop'|'herb'].output))return 'storage_full';if(tenderEnergyAvailable(r,e)<BAL.garden.tenderHarvestEnergySeconds*1000)return 'fuel_harvest';return 'ready_harvest';}
  if(!g.crop){if(!hasAll(r,chest.c!,GARDEN_CROPS[f.crop].inputs))return 'seed_missing';if(g.water<1 && (barrel.water||0)<1)return 'barrel_dry';if(tenderEnergyAvailable(r,e)<BAL.garden.tenderPlantEnergySeconds*1000)return 'fuel_plant';return 'ready_plant';}
  if(g.water<=1e-10 && (barrel.water||0)<1)return 'dry';
  if(g.water<=1e-10 && tenderEnergyAvailable(r,e)<BAL.garden.tenderPumpEnergySeconds*1000)return 'fuel_pump';
  if(g.crop&&gardenEnvironment(r,garden,isWet(weatherAt(r,r.clock.lastSimAt)),g.crop as 'crop'|'herb').rate<0.7)return 'slow';
  return 'growing';
}
/** Transition receipts only on a real state change (never per tick). The last coded state is persisted on the
 * tender, so a reload or a repeated Continue cannot repeat it. The first observation of a tender is silent. */
export function stepTenderStates(r:RunState,now:number) {
  for(const e of Object.values(r.entities)){ if(!e.farm) continue;
    const st=tenderState(r,e), prev=e.farm.lastCode;
    if(prev===undefined){ e.farm.lastCode=st.code; continue; }
    if(prev!==st.code){ e.farm.lastCode=st.code; receipt(r,now,'tender.state',`${e.id}:${prev}>${st.code}:${st.paused?'paused':'running'}`); }
  }
}
/** Instantaneous events at the current world timestamp; order is harvest,
 * planting, then irrigation. Fuel is only consumed on an actual operation. */
export function stepTenders(gs:GameState,now:number) {
  const r=gs.run!;
  for(const e of Object.values(r.entities)) {const f=e.farm;if(!f?.enabled)continue;const links=tenderLinks(r,e);if(!links)continue;const {garden,barrel,chest}=links,g=garden.garden!,cid=chest.c!;
    if(g.crop && !GARDEN_CROPS[g.crop as 'crop'|'herb'])continue;
    if(g.crop&&g.growth>=1){const rule=GARDEN_CROPS[g.crop as 'crop'|'herb'];if(!rule||!tenderFits(r,cid,rule.output)||!tenderSpend(r,e,BAL.garden.tenderHarvestEnergySeconds*1000))continue;const crop=g.crop;for(const [key,qty] of rule.output)addItem(r,cid,key,qty);g.crop=null;g.growth=0;receipt(r,now,'tender.harvest',`${e.id}:${crop}`);}
    if(!g.crop){const rule=GARDEN_CROPS[f.crop];if(!hasAll(r,cid,rule.inputs)||(g.water<1&&(barrel.water||0)<1)||!tenderSpend(r,e,BAL.garden.tenderPlantEnergySeconds*1000))continue;for(const [key,qty] of rule.inputs)removeItem(r,cid,key,qty);if(g.water<1){barrel.water!-=1;g.water=Math.min(3,g.water+1);}g.crop=f.crop;g.growth=0;receipt(r,now,'tender.plant',`${e.id}:${f.crop}`);}
    if(g.crop&&g.growth<1&&g.water<=1e-10&&(barrel.water||0)>=1&&tenderSpend(r,e,BAL.garden.tenderPumpEnergySeconds*1000)){barrel.water!-=1;g.water+=1;receipt(r,now,'tender.water',e.id);}
  }
}
/** Earliest maturity, dry-out or rain-fed barrel refill for a linked plot.
 * CAL-01: the slice limits use the SAME seasonal evaporation and liquid-precipitation
 * catch as stepGardensBarrels/gardenEnvironment, so a seasonal boundary can never
 * make an offline slice overshoot maturity or under-count water loss. */
export function tenderBoundary(r:RunState,wet:boolean,limit:number,at:number = r.clock.lastSimAt):number {
  let dt=limit;for(const e of Object.values(r.entities)){if(!e.farm?.enabled)continue;const l=tenderLinks(r,e);if(!l)continue;
    const g=l.garden.garden!;
    const env=gardenEnvironment(r,l.garden,wet,g.crop==='herb'?'herb':'crop',at);
    const incoming=wet&&!isRoofed(r,l.garden)&&!g.coldFrame?env.catch/60000:0, use=env.evaporation/(BAL.garden.waterSecondsPerUnit*1000);
    if(g.crop && !GARDEN_CROPS[g.crop as 'crop'|'herb'])continue;
    if(g.crop&&g.growth<1&&(g.water>1e-10||incoming>=use)){dt=Math.min(dt,(1-g.growth)*GARDEN_CROPS[g.crop as 'crop'|'herb'].seconds*1000/env.rate);if(use>incoming&&g.water>1e-10)dt=Math.min(dt,g.water/(use-incoming));}
    if(wet&&!isRoofed(r,l.barrel)&&(l.barrel.water||0)<1&&env.catch>0)dt=Math.min(dt,(1-(l.barrel.water||0))*20000);
  }return dt;
}
