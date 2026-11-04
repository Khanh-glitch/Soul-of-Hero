// Authoritative game engine: GameState + dispatch(intent) → committed state + receipt | rejection.
// Rule: validate EVERYTHING first, then commit. Failed preconditions never partially debit.
import { BAL, TILE, WW, WH, HOUR, SAVE_VERSION, WORLD_SEED, T, uid, rngNext, dist, clamp,
  type GameState, type Profile, type RunState, type Stack, type Container, type Entity, type Creature } from './core';
import { ITEMS, SOURCES, RECIPES, STRUCTS, CREATURES, ELDERS, VENDOR_SECURED, ACHIEVEMENTS, CORE_STUDY, WORKBENCH_UPGRADE, CART_FREIGHT_UPGRADE, GARDEN_CROPS, GARDEN_FRAME_COST, FURNACE_LINING, STRUCTURE_UPGRADES, permitsDirectedResearch, requiredStationLevel } from './catalog';
import { getWorld, getActiveLayout, setActiveLayout, SRC_KEYS, tileAt } from './world';
import { sourceDigest } from './world-economy';
import { mapDigest } from './map-package';

export type Intent = { id: string; type: string; [k: string]: any };
export type Result = { ok: true; receipt: string; msg?: string } | { ok: false; reason: string; dup?: boolean };

// ---------------- time & phases (K8) ----------------
export const runElapsedMs = (r: RunState, now: number) => now - r.startedAt + r.qaOffset;
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
export function weatherAt(r: RunState, at: number): Weather {
  const slot = Math.floor(runElapsedMs(r, at) / (BAL.weather.slotMinutes * 60000));
  return weatherSlot(r.seed, slot);
}
export function weatherSlot(seed: number, slot: number): Weather {
  const w = BAL.weather.weights; const keys = Object.keys(w) as Weather[]; const tot = keys.reduce((a, k) => a + w[k], 0);
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

// ---------------- creation ----------------
export function newProfile(): Profile { return { securedCash: 0, achievements: {}, history: [], settings: { volume: 0.6, muted: false }, profileReceipts: [] }; }
export function newGame(): GameState { return { version: SAVE_VERSION, revision: 0, profile: newProfile(), run: null }; }

export function mkStack(r: RunState, key: string, qty: number, meta?: string): Stack {
  const d = ITEMS[key]; const s: Stack = { uid: uid(r, 's'), key, qty };
  if (d?.dur) s.dur = d.dur; if (d?.charge) s.charge = d.initialCharge ?? d.charge; if (meta) s.meta = meta; return s;
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
    player: null as any, creatures: [], sources: {}, terrain: {}, entities: {}, custody: {}, knowledge: { recipes: Object.keys(RECIPES).filter(k => RECIPES[k].base), studied: [] },
    traces: [], discovered: [], poiSeen: [], elderStones: [], achievements: [], score: 0, deposited: 0,
    clock: { lastSimAt: now, simMs: 0, respawnAcc: 0, weatherSlot: -1 }, rng: seed, nextId: 1, receipts: [], seenIntents: [], seq: 0,
    vendorStock: { escrow_chest: 4, ...Object.fromEntries(Object.entries(VENDOR_SECURED).map(([k, v]) => [k, v.stock])) }, log: [],
  };
  const reg = 0; r.spawnRegion = reg; const sp = chooseLegalSpawn(r); if(!sp)return {ok:false,reason:'No safe, resource-accessible spawn in this region.'}; r.spawnChoice={x:sp.tx,y:sp.ty,contract:'seeded-geographic-v1'};
  r.custody.inv = { id: 'inv', kind: 'inv', slots: Array(24).fill(null) };
  r.custody.eq = { id: 'eq', kind: 'eq', slots: [null, null, null] };
  r.custody.inv.slots[0] = mkStack(r, 'knife', 1);
  const fl = mkStack(r, 'water_flask', 1); fl.charge = 2; r.custody.inv.slots[1] = fl;
  r.custody.inv.slots[2] = mkStack(r, 'berries', 3);
  r.player = { x: sp.tx * TILE + 8, y: sp.ty * TILE + 8, vx: 0, vy: 0, dir: 0, aim: Math.PI / 2, hp: BAL.player.maxHp, stamina: BAL.player.maxStamina, hunger: 85, thirst: 85, warmth: 100, rad: 0, active: 0, action: null, invuln: 0, dead: false, deadT: 0, pulling: null, skills: { gather: 0, combat: 0, craft: 0, survival: 0 }, stepAcc: 0, lastTraceX: 0, lastTraceY: 0, regionName: sp.name, sheltered: false };
  // statics → physical entities with real finite loot
  for (const s of w.statics) {
    const e: Entity = { id: uid(r, 'e'), kind: s.kind as any, x: s.tx * TILE + 8, y: s.ty * TILE + 8, tx: s.tx, ty: s.ty, poi: s.poi, label: s.label };
    if (s.kind === 'loot') { const c = mkContainer(r, 'loot', 8); s.loot!.forEach(([k, q], i) => { if (k.startsWith('blueprint:')) c.slots[i] = mkStack(r, 'blueprint', 1, k.slice(10)); else c.slots[i] = mkStack(r, k, q); }); e.c = c.id; }
    if (s.kind === 'cash') { e.c = mkContainer(r, 'cash', 2).id; e.minted = false; e.stock = { cash: s.cash! }; }
    if (s.kind === 'door') { e.locked = s.locked; e.open = false; }
    if (s.kind === 'gen') e.power = 0;
    r.entities[e.id] = e;
  }
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
  for (const e of Object.values(r.entities)) if (e.kind === 'struct' && e.type === 'claim' && Math.hypot(e.tx! - tx, e.ty! - ty) < BAL.economy.claimRadius + 6) return false;
  const type = opts[Math.floor(rngNext(r) * opts.length)];
  const d = CREATURES[type];
  r.creatures.push(mkCreature(r, type, tx * TILE + 8, ty * TILE + 8, d.hp));
  return true;
}

// ---------------- receipts, log, idempotency ----------------
export function receipt(r: RunState, now: number, kind: string, detail: string) {
  const id = `r${++r.seq}`; r.receipts.push({ id, seq: r.seq, at: now, kind, detail }); if (r.receipts.length > 250) r.receipts.splice(0, r.receipts.length - 250); return id;
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
let blockCache: { run: string; layout: string; sourceVersion: number; arr: Uint8Array } | null = null; let blockDirty = true;
export function markDirty() { blockDirty = true; tileIndex = null; roomCache = null; }
/** 0 free, 1 terrain wall, 2 source, 3 structure, 4 shallow/river (wade), 5 lava */
let baseGrid: Uint8Array | null = null; let baseGridLayout = '';
function tileClass(t: number) { return (t === T.DEEP || t === T.CLIFF || t === T.PWALL) ? 1 : t === T.LAVA ? 5 : (t === T.SHALLOW || t === T.RIVER) ? 4 : 0; }
function cellClass(r: RunState | null, tx: number, ty: number) {
  const w = getWorld(); const i = ty * WW + tx; const t = r ? effTile(r, tx, ty) : w.tiles[i]; let c = tileClass(t);
  if (c === 0 && (w.packageContract || w.enforceMasks) && !w.economyMap.walkable[i] && !w.statics.some(s => s.kind === 'door' && s.tx === tx && s.ty === ty)) c = 1;
  if (c === 0) { if (r) { const s = sourceAt(r, tx, ty); if (s && s.def.block && (s.stock > 0 || s.key === 'wreck')) c = 2; } else if (w.src[i] >= 0 && SOURCES[SRC_KEYS[w.src[i]]].block) c = 2; }
  return c;
}
export function blockGrid(r: RunState) {
  const layout = getActiveLayout();
  if (blockCache && blockCache.run === r.id && blockCache.layout === layout && blockCache.sourceVersion === (r.sourceLayoutVersion ?? 1) && !blockDirty) return blockCache.arr;
  if (!baseGrid || baseGridLayout !== layout) { baseGrid = new Uint8Array(WW * WH); for (let i = 0; i < WW * WH; i++) baseGrid[i] = cellClass(null, i % WW, (i / WW) | 0); baseGridLayout = layout; }
  const arr = r.sourceLayoutVersion === 3 ? new Uint8Array(WW * WH) : baseGrid.slice();
  if (r.sourceLayoutVersion === 3) { for (let i = 0; i < arr.length; i++) arr[i] = cellClass(r, i % WW, (i / WW) | 0); }
  if (r.sourceLayoutVersion === 2) { const overlay = getWorld().sourceOverlayV2; for (let i = 0; i < overlay.length; i++) if (overlay[i] >= 0) arr[i] = cellClass(r, i % WW, (i / WW) | 0); }
  for (const k in r.terrain) { const i = +k; arr[i] = cellClass(r, i % WW, (i / WW) | 0); }
  for (const k in r.sources) { const i = +k; arr[i] = cellClass(r, i % WW, (i / WW) | 0); }
  for (const e of Object.values(r.entities)) {
    if (e.tx === undefined) continue; const i = e.ty! * WW + e.tx;
    if (e.kind === 'struct') { const d = STRUCTS[e.type!]; if (d.block && !(e.type!.startsWith('door') && e.open)) arr[i] = 3; }
    else if (e.kind === 'door') { if (!e.open) arr[i] = 3; }
    else if (e.kind === 'loot' || e.kind === 'cash' || e.kind === 'vendor' || e.kind === 'gen' || e.kind === 'evac') arr[i] = 3;
  }
  blockCache = { run: r.id, layout, sourceVersion: r.sourceLayoutVersion ?? 1, arr }; blockDirty = false; return arr;
}
export function blockedAt(r: RunState, tx: number, ty: number) { if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return true; const b = blockGrid(r)[ty * WW + tx]; return b === 1 || b === 2 || b === 3 || b === 5; }
let tileIndex: Map<number, Entity[]> | null = null; let tileIndexRun = '';
export function entsAt(r: RunState, tx: number, ty: number): Entity[] {
  if (!tileIndex || tileIndexRun !== r.id) { tileIndex = new Map(); tileIndexRun = r.id; for (const e of Object.values(r.entities)) if (e.tx !== undefined && e.kind !== 'drop' && e.kind !== 'bag' && e.kind !== 'cart') { const i = e.ty! * WW + e.tx; const l = tileIndex.get(i); if (l) l.push(e); else tileIndex.set(i, [e]); } }
  return tileIndex.get(ty * WW + tx) || [];
}
export function claimAt(r: RunState, tx: number, ty: number) {
  const R = BAL.economy.claimRadius;
  for (const e of Object.values(r.entities)) if (e.kind === 'struct' && e.type === 'claim' && Math.hypot(e.tx! - tx, e.ty! - ty) <= R + 0.01) return e; return null;
}
/** Both adapters supply roof coverage to the same room traversal. */
export function roofAt(r: RunState, x: number, y: number) {
  if (x < 0 || y < 0 || x >= WW || y >= WH) return false;
  return entsAt(r, x, y).some(e => e.kind === 'struct' && !!STRUCTS[e.type!]?.shelter) ||
    getWorld().buildings.some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
}
function roomWall(r: RunState, x: number, y: number) {
  if (x < 0 || y < 0 || x >= WW || y >= WH) return false;
  const t = effTile(r, x, y); if (t === T.PWALL || t === T.CLIFF) return true;
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

/** One generator powers one locally wired turret; blocked/destroyed links fail closed. */
export function turretStatus(r: RunState, e: Entity): string {
  const t=e.turret; if (!t?.enabled) return 'Off'; const g=t.generatorId ? r.entities[t.generatorId] : undefined;
  if (!g?.basePower || g.type!=='base_generator' || !owned(g)) return 'No generator';
  if (dist(e.x,e.y,g.x,g.y)>3*TILE || !clearPhysicalLine(r,e,g,true,true)) return 'Connection blocked';
  if (!g.basePower.enabled) return 'Generator off'; if (g.basePower.energy<=0) return 'No power';
  if (!e.c || countItem(r,e.c,'arrow')<1) return 'No arrows'; return 'Ready';
}
/** Fuel is real, local and consumed while switched on, online or offline. */
export function stepBasePower(r: RunState, dt: number, now: number) {
  for (const e of Object.values(r.entities)) { const power=e.basePower; if (!power?.enabled || !e.c) continue; let left=dt;
    while (left>1e-8) { if (power.energy<=1e-8) { const slot=C(r,e.c).slots.find(s=>s && ITEMS[s.key]?.fuel); if (!slot) {power.energy=0; break;} power.energy=ITEMS[slot.key].fuel!*1000; const key=slot.key; removeItem(r,e.c,key,1); receipt(r,now-left,'power.fuel',`${e.id}:${key}`); }
      const used=Math.min(left,power.energy); power.energy-=used; left-=used;
    }
  }
}

// ---------------- custody (K1) ----------------
export const C = (r: RunState, id: string): Container => typeof id === 'string' && Object.prototype.hasOwnProperty.call(r.custody, id) ? r.custody[id] : undefined as unknown as Container;
export function countItem(r: RunState, cid: string, key: string) { return C(r, cid).slots.reduce((a, s) => a + (s && s.key === key ? s.qty : 0), 0); }
export function spaceFor(r: RunState, cid: string, key: string) {
  const d = ITEMS[key]; let n = 0; for (const s of C(r, cid).slots) { if (!s) n += d.max; else if (s.key === key && d.max > 1 && s.meta === undefined && s.dur === undefined && s.charge === undefined && !d.dur && !d.charge) n += d.max - s.qty; } return n;
}
/** Adds qty; returns leftover that did not fit (caller decides what to do — never silently deleted). */
export function addItem(r: RunState, cid: string, key: string, qty: number, tmpl?: Partial<Stack>): number {
  const d = ITEMS[key]; const c = C(r, cid);
  if (d.max > 1 && !d.dur && !d.charge && tmpl?.meta === undefined && tmpl?.dur === undefined && tmpl?.charge === undefined) for (const s of c.slots) if (s && s.key === key && s.meta === undefined && s.dur === undefined && s.charge === undefined && s.qty < d.max && qty > 0) { const m = Math.min(qty, d.max - s.qty); s.qty += m; qty -= m; }
  for (let i = 0; i < c.slots.length && qty > 0; i++) if (!c.slots[i]) { const m = Math.min(qty, d.max); const s = mkStack(r, key, m, tmpl?.meta); if (tmpl?.charge !== undefined) s.charge = tmpl.charge; if (tmpl?.dur !== undefined) s.dur = tmpl.dur; c.slots[i] = s; qty -= m; }
  return qty;
}
export function addStack(r: RunState, cid: string, s: Stack): boolean {
  const c = C(r, cid); const d = ITEMS[s.key];
  if (d.max > 1 && s.meta === undefined && s.dur === undefined && s.charge === undefined) { const room = spaceFor(r, cid, s.key); if (room >= s.qty) { addItem(r, cid, s.key, s.qty); return true; } }
  const i = c.slots.indexOf(null); if (i < 0) return false; c.slots[i] = s; return true;
}
// Unique or stateful stacks must never be merged into a different instance.
function mergeable(a: Stack, b: Stack) {
  return a.key === b.key && ITEMS[a.key].max > 1 && a.meta === undefined && b.meta === undefined &&
    a.dur === undefined && b.dur === undefined && a.charge === undefined && b.charge === undefined;
}
function portion(r: RunState, s: Stack, qty: number): Stack {
  return { ...s, uid: uid(r, 's'), qty };
}
/** Reserve exactly the paid physical stacks; split only when part of a stack is paid. */
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
  if (qty > ITEMS[key].max) { const first = spawnDrop(r, key, ITEMS[key].max, x, y, now, tmpl, burst); spawnDrop(r, key, qty - ITEMS[key].max, x, y, now, tmpl, burst); return first; }
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
function removeEntity(r: RunState, e: Entity) { delete r.entities[e.id]; for (const cid of [e.c, e.station?.fuelC, e.station?.outC]) if (cid) delete r.custody[cid]; markDirty(); }
/** Destruction and reclaim share the same custody transition. */
export function destroyStructure(r: RunState, e: Entity, now: number) {
  if (r.entities[e.id] !== e || e.kind !== 'struct') return null;
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
    for (const [k, ch] of s.def.bonus || []) if (rngNext(r) < ch) spawnDrop(r, k, 1, cx + ox, cy + oy, now);
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
export function killPlayer(gs: GameState, now: number, cause: string) {
  const r = gs.run!; const p = r.player; if (p.dead) return;
  p.dead = true; p.deadT = 0; p.hp = 0; p.action = null; p.pulling = null;
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
export function buildReason(gs: GameState, type: string, tx: number, ty: number): string | null {
  const r = gs.run!; if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(STRUCTS, type)) return 'Unknown structure.'; const d = STRUCTS[type];
  const w = getWorld(); const p = r.player;
  if (type === 'farm_controller' && !Object.values(r.entities).some(e=>e.kind==='struct' && e.type==='workbench' && e.station && owned(e) && (e.station.level ?? 1)>=2 && near(r,e,3) && dist(e.x,e.y,tx*TILE+8,ty*TILE+8)<=3*TILE)) return 'Build near your level 2 workbench.';
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
  if (d.need === 'claim' && (!claimAt(r, tx, ty) || !owned(claimAt(r, tx, ty)!))) return 'Must be inside your claimed land (place a Claim Totem).';
  if (d.need === 'free') {
    const claims = Object.values(r.entities).filter(e => e.kind === 'struct' && e.type === 'claim');
    if (claims.length >= BAL.economy.maxClaims) return `Claim limit reached (${BAL.economy.maxClaims}).`;
    if (claims.some(c => Math.hypot(c.tx! - tx, c.ty! - ty) < BAL.economy.claimRadius * 2 + 1)) return 'Too close to your other claim.';
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
  // No command can transact after the run boundary while the caller awaits settlement.
  if (phaseOf(r, now) === 'expired') return { ok: false, reason: 'Run has expired.' };
  if (r.seenIntents.includes(it.id)) return { ok: false, reason: 'Duplicate request ignored.', dup: true };
  const res = apply(gs, r, it, now);
  if (res.ok) {
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
function clearSegment(r: RunState, p: { x: number; y: number }, e: { x: number; y: number }) {
  return clearPhysicalLine(r, p, e, true, true);
}
export function clearWallLine(r: RunState, p: {x:number;y:number}, e: {x:number;y:number}) { return clearPhysicalLine(r, p, e, false, true, true); }
export function clearInteraction(r:RunState,e:{x:number;y:number}) { return clearSegment(r,r.player,e); }

function apply(gs: GameState, r: RunState, it: Intent, now: number): Result {
  const p = r.player; const ok = (kind: string, detail: string, msg?: string): Result => ({ ok: true, receipt: receipt(r, now, kind, detail), msg });
  if (p.dead && !['respawn', 'abandon', 'qaAdvance'].includes(it.type)) return fail('You are dead.');
  switch (it.type) {
    case 'respawn': return respawn(gs, now);
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
      if (it.qty !== undefined && (!Number.isSafeInteger(it.qty) || it.qty <= 0 || it.qty > s.qty)) return fail('Invalid quantity.');
      const qty = it.qty ?? s.qty;
      if (from === to && (it.ts === undefined || it.ts === it.fs)) return fail('Choose a different slot.');
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
        return ok('move', `${s.key}x${moved} ${from.id}->${to.id}`);
      }
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
    case 'drop': { const c = C(r, it.c); const s = c && validSlot(c, it.slot) ? c.slots[it.slot] : null; if (!s || !canAccess(r, it.c)) return fail('Nothing to drop.'); c.slots[it.slot] = null; if (p.pulling && s.key === 'x') p.pulling = null; dropStackEntity(r, s, p.x + Math.cos(p.aim) * 12, p.y + Math.sin(p.aim) * 12, now); return ok('drop', `${s.key}x${s.qty}`); }
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
    case 'basePower': {
      const e = r.entities[it.eid]; if (!e?.basePower || e.type !== 'base_generator' || !owned(e) || !near(r,e,2.2)) return fail('Use your generator within reach.');
      if (typeof it.enabled !== 'boolean') return fail('Invalid power setting.');
      e.basePower.enabled = it.enabled; return ok('power.toggle', `${e.id}:${it.enabled}`, it.enabled ? 'Generator switched on.' : 'Generator switched off.');
    }
    case 'turretConfigure': {
      const e = r.entities[it.eid]; if (!e?.turret || e.type !== 'arrow_turret' || !owned(e) || !near(r,e,2.2)) return fail('Use your turret within reach.');
      if (it.field === 'enabled' && typeof it.value === 'boolean') e.turret.enabled = it.value;
      else if (it.field === 'generatorId' && typeof it.value === 'string') {
        if (it.value) { const gen = r.entities[it.value]; if (!gen?.basePower || gen.type !== 'base_generator' || !owned(gen) || dist(e.x,e.y,gen.x,gen.y) > 3*TILE || !clearPhysicalLine(r,e,gen,true,true)) return fail('Generator must be owned, within 3 tiles and unobstructed.');
          if (Object.values(r.entities).some(o=>o.id!==e.id && o.turret?.generatorId===gen.id)) return fail('Generator already connected to another turret.'); }
        e.turret.generatorId = it.value || undefined;
      } else return fail('Invalid turret setting.');
      return ok('turret.configure', `${e.id}:${it.field}`);
    }
    case 'repairStructure': {
      const e = r.entities[it.eid];
      if (!e || e.kind !== 'struct' || !owned(e) || !near(r, e, 3)) return fail('Use your structure within reach.');
      const def = STRUCTS[e.type!];
      if (!def || def.item || !Number.isFinite(e.hp) || !Number.isFinite(e.maxHp) || e.hp! <= 0 || e.hp! >= e.maxHp!) return fail('This structure cannot be repaired.');
      const cost: [string, number][] = def.cost.map(([key, qty]) => [key, Math.max(1, Math.ceil(qty / 4))]);
      if (!hasAll(r, 'inv', cost)) return fail('Missing repair materials: ' + cost.filter(([key, qty]) => countItem(r, 'inv', key) < qty).map(([key, qty]) => `${ITEMS[key].name} ${countItem(r, 'inv', key)}/${qty}`).join(', '));
      for (const [key, qty] of cost) removeItem(r, 'inv', key, qty);
      const before = e.hp!; e.hp = Math.min(e.maxHp!, e.hp! + Math.ceil(e.maxHp! / 4));
      return ok('structure.repair', `${e.id}:${before}->${e.hp}`, `${def.name} repaired to ${Math.round(e.hp)}/${e.maxHp} HP.`);
    }
    case 'upgradeStation': {
      const e = r.entities[it.eid];
      if (!e || e.kind !== 'struct' || e.type !== 'workbench' || !e.station || !owned(e) || !near(r, e, 3)) return fail('Use your workbench within reach.');
      if ((e.station.level ?? 1) >= WORKBENCH_UPGRADE.toLevel) return fail('Workbench already upgraded.');
      if (!hasAll(r, 'inv', WORKBENCH_UPGRADE.cost)) return fail('Missing upgrade materials.');
      for (const [key, qty] of WORKBENCH_UPGRADE.cost) removeItem(r, 'inv', key, qty);
      e.station.level = WORKBENCH_UPGRADE.toLevel;
      return ok('station.upgrade', `${e.id}:2`, 'Workbench improved. Its new capabilities are available.');
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
    case 'cancelJob': { const e = r.entities[it.eid]; if (!e?.station || e.kind !== 'struct' || !owned(e) || !near(r, e, 3)) return fail('Not here.'); const j = e.station.queue.findIndex(q => q.id === it.jobId); if (j < 0) return fail('No such job.');
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
      if (it.struct === 'base_generator') e.basePower = { enabled: false, energy: 0 };
      if (it.struct === 'arrow_turret') e.turret = { enabled: false, cooldown: 0, angle: 0 };
      if (it.struct === 'farm_controller') e.farm = { enabled:false, crop:'crop', energy:0 };
      if (it.struct === 'garden') e.garden = { crop: null, growth: 0, water: 0 };
      if (it.struct === 'barrel') e.water = 0;
      if (it.struct.startsWith('door')) e.open = false;
      const cl = claimAt(r, it.tx, it.ty); if (cl) e.claim = cl.id;
      r.entities[e.id] = e; markDirty();
      if ((it.struct === 'bed_straw' || it.struct.startsWith('roof')) && homeComplete(r)) award(gs, 'first_home', now);
      return ok('build', `${it.struct}@${it.tx},${it.ty}`);
    }
    case 'placeCart': {
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
    case 'reclaim': {
      const e = r.entities[it.eid]; if (!e || !owned(e) || !near(r, e, 3)) return fail('Out of reach or not owned.');
      if (e.kind === 'cart') { if (C(r, e.c!).slots.some(Boolean)) return fail('Unload the cart first.'); if (C(r, 'inv').slots.indexOf(null) < 0) return fail('Inventory full.'); if (p.pulling === e.id) p.pulling = null; removeEntity(r, e); if (e.deployed) returnReservations(r, [e.deployed], e.x, e.y, now); else addItem(r, 'inv', 'cart_kit', 1); return ok('cart.pack', e.id); }
      if (e.kind !== 'struct') return fail('Cannot reclaim that.');
      if (e.type === 'claim' && Object.values(r.entities).some(o => o.kind === 'struct' && o.claim === e.id)) return fail('Remove the structures on this claim first.');
      const d = STRUCTS[e.type!];
      if (entsAt(r, e.tx!, e.ty!).some(o => o.id !== e.id && STRUCTS[o.type!]?.layer === 'roof') && d.layer === 'floor') return fail('Remove the roof above first.');
      if (e.station?.queue.some(j => j.reserved === undefined)) return fail('Legacy job has no recoverable input record; let it finish before reclaiming.');
      const bag = bagStation(r, e, now, 'Reclaimed contents');
      removeEntity(r, e);
      if (d.item) { if (e.deployed) returnReservations(r, [e.deployed], e.x, e.y, now); else giveOrDrop(r, d.item, 1, now); }
      else for (const [k, q] of d.cost) { const back = Math.floor(q * BAL.economy.reclaimRefund); if (back > 0) giveOrDrop(r, k, back, now); }
      return ok('reclaim', `${e.type}${bag ? ' contents→' + bag.id : ''}`);
    }
    case 'door': {
      const e = r.entities[it.eid]; if (!e || !near(r, e, 2) || !clearInteraction(r,e)) return fail('Door is out of reach or blocked.');
      if (e.kind === 'door' && e.locked && !e.open) {
        if (e.locked === 'keycard') { if (countItem(r, 'inv', 'keycard') < 1) return fail('Sealed. A keycard reader blinks red.'); removeItem(r, 'inv', 'keycard', 1); e.locked = undefined; award(gs, 'vault', now); }
        else if (e.locked === 'power') return fail('No power. The generator outside is dry.');
      }
      if (e.kind === 'struct' && !e.type!.startsWith('door')) return fail('Not a door.');
      if (e.open && Math.hypot(p.x - e.x, p.y - e.y) < 9) return fail('Step out of the doorway.');
      e.open = !e.open; markDirty(); return ok('door', `${e.id}:${e.open ? 'open' : 'closed'}`);
    }
    case 'generator': {
      const e = r.entities[it.eid]; if (!e || e.kind !== 'gen' || !near(r, e, 2.2) || !clearInteraction(r,e)) return fail('Out of reach.');
      if ((e.power || 0) > 0) return fail('Already running.');
      if (countItem(r, 'inv', 'fuel_can') < 1) return fail('Needs a Fuel Canister.');
      removeItem(r, 'inv', 'fuel_can', 1); e.power = 1;
      for (const d of Object.values(r.entities)) if (d.kind === 'door' && d.poi === e.poi && d.locked === 'power') { d.locked = undefined; }
      markDirty(); return ok('gen.power', e.poi!, 'The generator coughs alive. A lock clunks open.');
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
    case 'buy': { // physical vendor
      const e = r.entities[it.eid]; if (!e || e.kind !== 'vendor' || !near(r, e, 2.6) || !clearInteraction(r,e)) return fail('Walk up to the trader.');
      const item = it.item as string; if ((r.vendorStock[item] ?? 0) <= 0) return fail('Out of stock this run.');
      if (item === 'escrow_chest') {
        const price = BAL.economy.escrowChestPrice; if (countItem(r, 'inv', 'rcash') < price) return fail(`Needs ${price} physical Ragnarok cash.`);
        if (C(r, 'inv').slots.indexOf(null) < 0 && countItem(r, 'inv', 'rcash') !== price) return fail('Inventory full.');
        removeItem(r, 'inv', 'rcash', price); r.vendorStock[item]--; giveOrDrop(r, 'escrow_chest', 1, now); return ok('vendor.buy', `escrow_chest -${price} cash`);
      }
      const v = VENDOR_SECURED[item]; if (!v) return fail('Not sold here.');
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
    case 'grabCart': { const e = r.entities[it.eid]; if (!e || e.kind !== 'cart' || !owned(e) || !near(r, e, 2)) return fail('Out of reach.'); p.pulling = p.pulling === e.id ? null : e.id; return ok('cart.grab', `${e.id}:${!!p.pulling}`); }
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

function owned(e: Entity) { return e.owner === undefined || e.owner === 'player'; }
function validSlot(c: Container, slot: unknown): slot is number { return Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) < c.slots.length; }
function accepts(c: Container, slot: number, s: Stack) {
  if (['loot', 'cash', 'out'].includes(c.kind)) return false;
  if (c.kind === 'fuel') return !!ITEMS[s.key]?.fuel;
  if (c.kind === 'eq') return ITEMS[s.key]?.slot === ['head', 'body', 'back'][slot];
  return true;
}
function canAccess(r: RunState, cid: string) {
  if (cid === 'inv' || cid === 'eq') return true;
  for (const e of Object.values(r.entities)) if ((e.c === cid || e.station?.fuelC === cid || e.station?.outC === cid) && owned(e)) return dist(r.player.x, r.player.y, e.x, e.y) <= 2.8 * TILE && clearWallLine(r,r.player,e);
  return false;
}
export function homeComplete(r: RunState) {
  return Object.values(r.entities).some(e => e.kind === 'struct' && e.type === 'bed_straw' && isSheltered(r, e.x, e.y));
}

function useItem(gs: GameState, r: RunState, it: Intent, now: number, ok: (k: string, d: string, m?: string) => Result): Result {
  const cid = it.c ?? 'inv'; const c = C(r, cid); if (!c || !canAccess(r, cid) || !validSlot(c, it.slot)) return fail('Invalid or out of reach container.');
  const s = c.slots[it.slot]; if (!s) return fail('Empty.');
  const d = ITEMS[s.key]; const p = r.player;
  if (d.cat === 'bp') { const rec = s.meta!; if (!RECIPES[rec]) return fail('Invalid blueprint.'); if (r.knowledge.recipes.includes(rec)) return fail('You already know this recipe.'); r.knowledge.recipes.push(rec); c.slots[it.slot] = null; return ok('learn.blueprint', rec, `Learned: ${ITEMS[RECIPES[rec].out].name}`); }
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
  if (eid) { const e = r.entities[eid]; if (e?.station && owned(e) && STRUCTS[e.type!].station === kind && near(r, e, 3)) return e; return null; }
  return Object.values(r.entities).find(e => e.kind === 'struct' && owned(e) && STRUCTS[e.type!].station === kind && near(r, e, 3)) || null;
}
function craft(gs: GameState, r: RunState, it: Intent, now: number, ok: (k: string, d: string, m?: string) => Result): Result {
  if (typeof it.recipe !== 'string' || !Object.prototype.hasOwnProperty.call(RECIPES, it.recipe)) return fail('Unknown recipe.'); const rc = RECIPES[it.recipe];
  if (!r.knowledge.recipes.includes(it.recipe)) return fail('You have not learned this recipe.');
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
  if ((st.station!.level ?? 1) < requiredStationLevel(rc)) return fail(`Requires workbench level ${rc.stationLevel}.`);
  if (st.station!.queue.length >= 6) return fail('Station queue is full.');
  const reserved = reserveInputs(r, ins);
  st.station!.queue.push({ id: uid(r, 'j'), recipe: it.recipe, left: rc.secs * 1000, total: rc.secs * 1000, reserved });
  return ok('job.queue', `${it.recipe}@${st.id}`, `${ITEMS[rc.out].name} queued at ${STRUCTS[st.type!].name}.`);
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
export function stepStations(gs: GameState, dtMs: number, now: number, report?: string[]) {
  const r = gs.run!;
  const note = (message: string) => { if (report && !report.includes(message)) report.push(message); };
  for (const e of Object.values(r.entities)) {
    const st = e.station; if (!st) continue; const kind = STRUCTS[e.type!].station!;
    const needsFuel = kind === 'campfire' || kind === 'furnace';
    let t = dtMs, blocked = false;
    while (t > 0 || (!blocked && !!st.queue[0] && st.queue[0].left <= 0)) {
      const job = blocked ? undefined : st.queue[0];
      // A finished job is committed at its event time without requiring extra work or fuel.
      if (job && job.left <= 0) {
        const at = now - t;
        if (job.recipe.startsWith('R:')) {
          const k = job.recipe.slice(2);
          if (addItem(r, st.outC, 'blueprint', 1, { meta: k }) > 0) { blocked = true; note('Research table: output slots full.'); continue; }
          note(`Research table: blueprint for ${ITEMS[RECIPES[k].out].name} is ready.`); award(gs, 'first_research', at);
        } else {
          const rc = RECIPES[job.recipe];
          if (spaceFor(r, st.outC, rc.out) < rc.qty) { blocked = true; note(`${STRUCTS[e.type!].name}: output slots full.`); continue; }
          addItem(r, st.outC, rc.out, rc.qty); if (rc.out === 'iron_ingot') award(gs, 'first_ingot', at); note(`${STRUCTS[e.type!].name} finished ${ITEMS[rc.out].name}.`);
        }
        receipt(r, at, 'job.done', job.recipe); st.queue.shift(); continue;
      }
      if (blocked && kind !== 'campfire') break;
      if (needsFuel) {
        const burning = kind === 'campfire' || !!job;
        if (!burning) break;
        if (st.burn <= 0) {
          const fc = C(r, st.fuelC); const fi = fc.slots.findIndex(s => s && ITEMS[s.key].fuel);
          if (fi < 0) { if (job) { const key = job.recipe.startsWith('R:') ? job.recipe.slice(2) : job.recipe; note(`${STRUCTS[e.type!].name}: fuel ran out — ${ITEMS[RECIPES[key].out].name} paused.`); } break; }
          const s = fc.slots[fi]!; st.burn += ITEMS[s.key].fuel! * 1000; s.qty--; if (s.qty <= 0) fc.slots[fi] = null;
        }
      }
      const fuelRate = kind === 'furnace' && st.upgrade === 'kiln_lining' ? BAL.fuel.linedFurnaceFuelMultiplier : 1;
      let step = needsFuel ? Math.min(t, st.burn / fuelRate) : t; if (job) step = Math.min(step, job.left);
      if (needsFuel) st.burn = Math.max(0, st.burn - step * fuelRate);
      t -= step;
      if (job) job.left -= step;
    }
  }
}
export function stepGardensBarrels(gs: GameState, dtMs: number, wet: boolean) {
  const r = gs.run!; const G = BAL.garden;
  for (const e of Object.values(r.entities)) {
    if (!e.garden && e.type !== 'barrel') continue;
    const rain = wet && !isRoofed(r, e) && !e.garden?.coldFrame;
    if (e.garden) {
      const g = e.garden; const growSeconds = g.crop === 'herb' ? GARDEN_CROPS.herb.seconds : GARDEN_CROPS.crop.seconds; const rate = g.crop === 'crop' || g.crop === 'herb' ? gardenEnvironment(r,e,wet,g.crop).rate : 1;
      const incoming = rain ? 1 / 60000 : 0; const use = 1 / (G.waterSecondsPerUnit * 1000);
      let growing = g.crop && g.growth < 1 && rate>0 ? Math.min(dtMs, (1 - g.growth) * growSeconds * 1000 / rate) : 0;
      if (use > incoming) growing = Math.min(growing, g.water / (use - incoming));
      if (growing > 0) { g.growth = Math.min(1, g.growth + growing * rate / (growSeconds * 1000)); if (g.growth >= 1 - 1e-12) g.growth = 1; g.water = Math.min(3, Math.max(0, g.water + (incoming - use) * growing)); }
      g.water = Math.min(3, g.water + incoming * (dtMs - growing));
    }
    if (e.type === 'barrel' && rain) e.water = Math.min(12, (e.water || 0) + dtMs / 20000);
  }
}
/** Local normalized climate/soil inputs are Map-owned; no terrain mutation or
 * invented season clock. Wet weather cools uncovered plots at slot boundaries. */
export function gardenEnvironment(r:RunState,e:Entity,wet:boolean,crop:'crop'|'herb' = e.garden?.crop==='herb'?'herb':'crop') {
  const m=getWorld().economyMap, x=e.tx??Math.floor(e.x/TILE), y=e.ty??Math.floor(e.y/TILE), i=y*WW+x;
  const biome=m.biome[i], moisture=m.moisture[i], slope=m.slope[i], frame=!!e.garden?.coldFrame;
  const temperature=Math.min(1,Math.max(0,m.temperature[i]+(frame&&m.temperature[i]<0.4?BAL.garden.coldFrameWarming:0)-(wet&&!frame&&!isRoofed(r,e)?BAL.garden.wetCooling:0)));
  const low=crop==='herb'?0.34:0.22,high=crop==='herb'?0.78:0.82;
  const climate=Math.max(0.15,Math.min(1,temperature<low?1-(low-temperature)*4:temperature>high?1-(temperature-high)*3:1));
  const ground:Record<string,number>={snow:0.65,sand:0.8,ash:0.55,toxic:0.4,hill:0.8,marsh:0.8};
  const fertility=Math.min(1,Math.max(0.3,(ground[biome]??1)+(frame?BAL.garden.coldFrameSoilBonus:0)-(moisture<0.3||moisture>0.75?0.1:0)-Math.min(0.2,slope*0.3)));
  const scorched=effTile(r,x,y)===T.BURNT;
  return {rate:climate*fertility*(scorched?BAL.garden.scorchedSoilMultiplier:1),temperature,moisture,biome,frame,scorched,covered:frame||isRoofed(r,e),climate:temperature<low?'cold':temperature>high?'hot':'suitable'};
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
export function tenderStatus(r:RunState,e:Entity):string {
  const f=e.farm;if(!f)return 'Not a tender';if(!f.enabled)return 'Stopped';const links=tenderLinks(r,e);if(!links)return 'Missing, blocked or out-of-range link';
  const {garden,barrel,chest}=links, g=garden.garden!;
  if(g.crop && !GARDEN_CROPS[g.crop as 'crop'|'herb'])return 'Unsupported crop';
  if(g.crop&&g.growth>=1){if(!tenderFits(r,chest.c!,GARDEN_CROPS[g.crop as 'crop'|'herb'].output))return 'Storage full — ripe crop waiting';if(tenderEnergyAvailable(r,e)<BAL.garden.tenderHarvestEnergySeconds*1000)return 'Fuel needed to harvest';return 'Ready to harvest';}
  if(!g.crop){if(!hasAll(r,chest.c!,GARDEN_CROPS[f.crop].inputs))return 'Planting material needed in linked chest';if(g.water<1 && (barrel.water||0)<1)return 'Barrel needs water';if(tenderEnergyAvailable(r,e)<BAL.garden.tenderPlantEnergySeconds*1000)return 'Fuel needed to plant';return 'Ready to plant';}
  if(g.water<=1e-10 && (barrel.water||0)<1)return 'Waiting for water (rain may grow crop)';
  if(g.water<=1e-10 && tenderEnergyAvailable(r,e)<BAL.garden.tenderPumpEnergySeconds*1000)return 'Fuel needed to pump (rain may grow crop)';
  if(g.crop&&gardenEnvironment(r,garden,isWet(weatherAt(r,r.clock.lastSimAt)),g.crop as 'crop'|'herb').rate<0.7)return 'Slow growth — inspect climate and soil';
  return 'Growing';
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
/** Earliest maturity, dry-out or rain-fed barrel refill for a linked plot. */
export function tenderBoundary(r:RunState,wet:boolean,limit:number):number {
  let dt=limit;for(const e of Object.values(r.entities)){if(!e.farm?.enabled)continue;const l=tenderLinks(r,e);if(!l)continue;const g=l.garden.garden!, incoming=wet&&!isRoofed(r,l.garden)&&!g.coldFrame?1/60000:0,use=1/(BAL.garden.waterSecondsPerUnit*1000);
    if(g.crop && !GARDEN_CROPS[g.crop as 'crop'|'herb'])continue;
    if(g.crop&&g.growth<1&&(g.water>1e-10||incoming>=use)){dt=Math.min(dt,(1-g.growth)*GARDEN_CROPS[g.crop as 'crop'|'herb'].seconds*1000/gardenEnvironment(r,l.garden,wet,g.crop as 'crop'|'herb').rate);if(use>incoming&&g.water>1e-10)dt=Math.min(dt,g.water/(use-incoming));}
    if(wet&&!isRoofed(r,l.barrel)&&(l.barrel.water||0)<1)dt=Math.min(dt,(1-(l.barrel.water||0))*20000);
  }return dt;
}
