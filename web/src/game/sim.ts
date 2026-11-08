import { combatStimulus, pushCombatStimulus, type CombatKind } from './stimulus';
import { airdropBoundary, stepAirdrops } from './engine';
import { airdropView } from './airdrop';
import { advancePoiAccess, poiDoorLabel, poiGenLabel } from './poi-access';
import { vehicleClear, vehicleExitPoint } from './motorbike';
import { LOOT_CLASSES, lootClass } from './loot-ecology';
// Deterministic-ish real-time simulation layered on the engine authority. All state mutation goes through engine helpers.
import { BAL, TILE, WW, WH, HOUR, VIEW_W, VIEW_H, T, rngNext, uid, dist, clamp, angDiff, dirFromAngle, type GameState, type RunState, type Creature, type Entity, type Proj, type Haz } from './core';
import { thermalEnv, thermalEvaluate, thermalStep, thermalBoundaryMs, heatersInReach, coldDamageActive } from './thermal';
import { ITEMS, CREATURES, ELDERS, STRUCTS, SOURCES, stationBurnable } from './catalog';
import { getWorld } from './world';
import { irSensorStatus, irSensorDownstream, restStep, dispatch, effTile, blockGrid, harvestHit, killCreature, killPlayer, markDirty, sourceAt, stepStations, stepGardensBarrels, stepTenders, stepTenderStates, tenderBoundary, weatherAt, isWet, isSheltered, phaseOf, darkness, endRun, destroyStructure, receipt, pushLog, C, countItem, removeItem, award, trySpawnCreature, mkCreature, entsAt, isRagnarok, countStones, cartLimit, carryLimit, invWeight, clearInteraction, clearPhysicalLine, stepBasePower, basePowerBoundary, powerAllocation, turretStatus, syncElectricDoors, electricDoorPowered, electricInterior, stepLootRespawn, migrateLootRespawn, initializeCabinets, territoryBoundary, territoryForecast, stepTerritory, spawnDrop } from './engine';

export interface Input { up: boolean; down: boolean; left: boolean; right: boolean; mx: number; my: number; attack: boolean; attackPressed: boolean; roll: boolean; cancel: boolean; skill?: 'refined' | 'signature'; skillAim?: { uid:string; slot:number; mx:number; my:number; viewX:number; viewY:number }; viewX?: number; viewY?: number }
export const FX: any[] = []; // observed effects for renderer/audio (never authoritative)
let offlineQuiet = false;
const fx = (type: string, d: any = {}) => { if (!offlineQuiet && FX.length < 400) FX.push({ type, ...d }); };
export type { Proj, Haz } from './core';
export const PROJ: Proj[] = [];
export const HAZ: Haz[] = [];
let boundCombat: RunState | null = null;
/** Bind the renderer's arrays to this run, detaching the previous run first. */
export function bindCombat(r: RunState) {
  if (boundCombat === r) return;
  if (boundCombat) boundCombat.combat = { projectiles: [...PROJ], hazards: [...HAZ] };
  const saved = r.combat;
  PROJ.splice(0, PROJ.length, ...(saved?.projectiles || []));
  HAZ.splice(0, HAZ.length, ...(saved?.hazards || []));
  r.combat = { projectiles: PROJ, hazards: HAZ }; boundCombat = r;
}
let slowTimer = 0, rootTimer = 0, shelterAcc = 0, fireAcc = 0, lightningAcc = 0, discoverAcc = 0;
let ragAnnounced = '';

const FISTS = { name: 'Fists', dmg: 4, reach: 16, arc: 1.2, swing: 280, power: { plant: 1 } } as any;
const SURF: Record<number, string> = { [T.SNOW]: 'snow', [T.MARSH]: 'marsh', [T.SAND]: 'sand', [T.ASH]: 'ash', [T.GRASS]: 'grass', [T.MEADOW]: 'meadow', [T.FOREST]: 'forest', [T.HILL]: 'hill', [T.ROAD]: 'road', [T.BRIDGE]: 'bridge', [T.FLOOR]: 'floor', [T.BURNT]: 'burnt', [T.TOXIC]: 'toxic', [T.ICE]: 'ice' };
export const SPEED_KEY: Record<number, string> = { ...SURF, [T.SHALLOW]: 'shallow', [T.RIVER]: 'shallow' };

export function activeStack(r: RunState) { return C(r, 'inv').slots[r.player.active]; }
const tileOf = (v: number) => Math.floor(v / TILE);
function solidFor(r: RunState, x: number, y: number, who: 'player' | 'creature' | 'cart') {
  const tx = tileOf(x), ty = tileOf(y); if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return true;
  const b = blockGrid(r)[ty * WW + tx];
  if((who==='cart'||(who==='player'&&!r.player.vehicle)) && Object.values(r.entities).some(e=>e.kind==='vehicle' && Math.hypot(e.x-x,e.y-y)<BAL.motorbike.radius))return true;
  // Authored cargo constraints are additional to live collision, not a
  // substitute for opening a physical door or clearing a physical object.
  const w = getWorld(); const i=ty*WW+tx;
  if (who === 'cart' && (w.packageContract || w.enforceMasks) && !w.economyMap.cargoPassable[i] && !w.statics.some(s=>s.kind==='door' && s.tx===tx && s.ty===ty)) return true;
  if (b === 4) return who === 'cart' || (who === 'creature' && false);
  return b === 1 || b === 2 || b === 3 || b === 5;
}
function moveBody(r: RunState, o: { x: number; y: number }, dx: number, dy: number, rad: number, who: 'player' | 'creature' | 'cart') {
  if(o===r.player && r.player.vehicle)return false;
  let hit = false;
  const nx = o.x + dx; if (!solidFor(r, nx + Math.sign(dx) * rad, o.y - rad + 1, who) && !solidFor(r, nx + Math.sign(dx) * rad, o.y + rad - 1, who)) o.x = nx; else if (dx) hit = true;
  const ny = o.y + dy; if (!solidFor(r, o.x - rad + 1, ny + Math.sign(dy) * rad, who) && !solidFor(r, o.x + rad - 1, ny + Math.sign(dy) * rad, who)) o.y = ny; else if (dy) hit = true;
  return hit;
}
function los(r: RunState, ax: number, ay: number, bx: number, by: number, blockTrees = false) {
  return clearPhysicalLine(r, { x: ax, y: ay }, { x: bx, y: by }, blockTrees);
}
/** Shared sight authority: only an actual observation updates remembered position. */
function observePlayer(r: RunState, m: Creature, now: number, range: number, eligible: boolean) {
  const p = r.player; const seen = !p.dead && !r.spiritTransit && dist(m.x, m.y, p.x, p.y) < range && los(r, m.x, m.y, p.x, p.y);
  if (seen && eligible) { m.knows = { kind: 'sight', x: p.x, y: p.y, at: now }; delete m.traceIgnore; }
  else if (m.knows?.kind === 'sight' && now - m.knows.at > 4000) m.knows = null;
  return seen;
}
export function rayLen(r: RunState, x: number, y: number, a: number, max: number) { const g = blockGrid(r); for (let d = 8; d < max; d += 4) { const tx=tileOf(x+Math.cos(a)*d),ty=tileOf(y+Math.sin(a)*d); if(tx<0||ty<0||tx>=WW||ty>=WH)return d; const b=g[ty*WW+tx]; if (b === 1 || b === 2 || b === 3 || b === 5) return d; } return max; }

// ---------- player damage ----------
export function hurtPlayer(gs: GameState, dmg: number, fx0: number, fy0: number, cause: string, now: number, kb = 140) {
  const r = gs.run!; const p = r.player; if (p.dead) return false;
  if ((r.spiritTransit && now < r.spiritTransit.arriveAt) || p.invuln > 0 || (p.iceUntil !== undefined && now < p.iceUntil) || p.action?.kind === 'roll') { fx('dodge', { x: p.x, y: p.y }); return false; }
  let armor = 0; for (const s of C(r, 'eq').slots) if (s) armor += ITEMS[s.key].armor || 0;
  const d = Math.max(1, Math.round(dmg * (1 - Math.min(0.6, armor))));
  if((p.channelUntil||0)>now){delete p.channelUntil;fx('fizzle',{x:p.x,y:p.y});}
  p.hp -= d; p.invuln = 520; const a = Math.atan2(p.y - fy0, p.x - fx0);
  moveBody(r, p, Math.cos(a) * kb * 0.06, Math.sin(a) * kb * 0.06, 4, 'player');
  if (p.action?.kind === 'cast') { fx('fizzle', { x: p.x, y: p.y }); dispatch(gs, { id: 'cc' + now + Math.random(), type: 'castCancel' }, now); }
  p.action = { kind: 'hurt', t: 0, dur: 220, angle: a };
  fx('phit', { x: p.x, y: p.y, n: d, a }); fx('shake', { m: Math.min(4, 1 + d / 8) });
  if (p.hp <= 0) { killPlayer(gs, now, cause); fx('pdeath', { x: p.x, y: p.y }); }
  return true;
}
function damageCreature(gs: GameState, m: Creature, dmg: number, a: number, now: number, kb = 130) {
  if (m.state === 'dead' || m.elder?.submerged || m.atk?.burrow) return false;
  const r = gs.run!;
  if (m.type === 'crab' && m.atk?.tuck > 0) dmg *= 0.25;
  if (m.elder && m.atk?.vuln > 0) dmg *= 2;
  dmg = Math.round(dmg * (1 + r.player.skills.combat * 0.002));
  m.hp -= dmg; m.flash = 120; const kbm = m.elder ? 0.12 : 1; m.kbx += Math.cos(a) * kb * kbm; m.kby += Math.sin(a) * kb * kbm;
  (m as any).prov = true; // Damage alone does not reveal a remote player's location.
  if (m.type === 'crab') m.atk = { ...(m.atk || {}), tuck: 900 };
  if (m.elder && m.state === 'sleep') wakeElder(gs, m, now);
  fx('mhit', { x: m.x, y: m.y, n: dmg, a, big: !!m.elder }); fx('hitstop', { ms: m.elder ? 70 : 55 });
  if (m.hp <= 0) { killCreature(gs, m, now); fx('mdeath', { x: m.x, y: m.y, type: m.type }); fx('shake', { m: m.elder ? 6 : 2 }); }
  return true;
}
function wakeElder(gs: GameState, m: Creature, now: number) {
  if (m.state !== 'sleep') return; m.state = 'chase'; m.cd = 1200; const d = ELDERS[m.elder!.key];
  fx('banner', { text: `${d.name}`, sub: m.elder!.awake ? `${d.title} — AWAKENED` : `${d.title} — latent form` });
  receipt(gs.run!, now, 'elder.engage', m.elder!.key);
}

// ---------- fire (K2 terrain mutation with committed causes) ----------
export function ignite(gs: GameState, tx: number, ty: number, now: number, depth = 0, visual = true) {
  const r = gs.run!; if (tx<0||ty<0||tx>=WW||ty>=WH||isWet(weatherAt(r, now))) return false;
  const s = sourceAt(r, tx, ty, now); const i = ty * WW + tx;
  if (s && s.def.mat === 'wood' && s.def.tall) {
    if (s.stock <= 0 || s.st?.burnt || (s.fire && s.fire > r.clock.simMs)) return false;
    const st = r.sources[i] || (r.sources[i] = { stock: s.stock, hp: s.hp });
    st.fire = r.clock.simMs + 5000 + rngNext(r) * 3000; st.fireDepth = depth;
    if (depth < BAL.fire.maxSpreadDepth) st.fireSpreadAt = r.clock.simMs + BAL.fire.spreadDelayMs;
    if(visual) fx('ignite', { x: tx * TILE + 8, y: ty * TILE + 8 }); return true;
  }
  const t = effTile(r, tx, ty); if ((t === T.GRASS || t === T.MEADOW || t === T.FOREST) && !entsAt(r,tx,ty).some(e=>e.kind==='struct'&&(STRUCTS[e.type!].block||['floor','roof','wall'].includes(STRUCTS[e.type!].layer)))) { r.terrain[i] = { t: T.BURNT }; if(visual) fx('scorch', { x: tx * TILE + 8, y: ty * TILE + 8 }); markDirty(); receipt(r,now,'fire.scorch',`${tx},${ty}`); return true; }
  return false;
}
/** Burn and one bounded cardinal spread event are chronological world events.
 * Rain wins at equal timestamps. A cut tree cannot later create charcoal. */
function resolveFires(gs: GameState, now: number, visual = true) {
  const r = gs.run!, wet = isWet(weatherAt(r, now));
  // Source keys are canonical non-negative integer indices; JS enumerates them numerically.
  for (const k in r.sources) {
    const key=+k, st = r.sources[key]; if (!st.fire) continue; const tx = key % WW, ty = (key / WW) | 0;
    if (wet || st.stock<=0) { st.fire = 0; delete st.fireSpreadAt; delete st.fireDepth; if (wet && visual) fx('steam', { x: tx*TILE+8, y: ty*TILE+8 }); continue; }
    if (st.fireSpreadAt!==undefined && st.fireSpreadAt<=r.clock.simMs) {
      delete st.fireSpreadAt;
      const depth=st.fireDepth??0;
      if(depth<BAL.fire.maxSpreadDepth) for(const [dx,dy] of [[2,0],[-2,0],[0,2],[0,-2],[1,0],[-1,0],[0,1],[0,-1]]) {
        if(Math.abs(dx)+Math.abs(dy)===2){const mx=tx+dx/2,my=ty+dy/2,mid=sourceAt(r,mx,my,now),mt=effTile(r,mx,my);if(![T.GRASS,T.MEADOW,T.FOREST].includes(mt)||(mid&&(mid.stock<=0||mid.def.mat!=='wood'))||entsAt(r,mx,my).some(e=>e.kind==='struct'&&(STRUCTS[e.type!].block||['floor','roof','wall'].includes(STRUCTS[e.type!].layer))))continue;}
        const x=tx+dx,y=ty+dy;if(x<0||y<0||x>=WW||y>=WH)continue;const s=sourceAt(r,x,y,now);
        if(s && (s.def.mat!=='wood'||!s.def.tall||s.stock<=0||s.st?.burnt||s.fire))continue;
        // Stable per-cell choice: no frame-rate or offline-partition dependent RNG draw.
        const hash=(Math.imul(key+1,73856093)^Math.imul(y*WW+x+1,19349663)^r.seed)>>>0;
        if(hash%100 < BAL.fire.spreadChancePercent) ignite(gs,x,y,now,depth+1,visual);
      }
    }
    if (st.fire <= r.clock.simMs) { st.fire = 0; delete st.fireSpreadAt; delete st.fireDepth; st.burnt = true; st.stock = Math.min(st.stock,SOURCES.deadtree.stock); st.hp = SOURCES.deadtree.hp * st.stock / SOURCES.deadtree.stock; const t = effTile(r,tx,ty); if (t !== T.SAND && t !== T.SNOW) r.terrain[key] = { t: T.BURNT }; markDirty(); receipt(r,now,'fire.burnout',`${tx},${ty}`); }
  }
}
function stepFires(gs: GameState, now: number, dtMs: number) {
  const r = gs.run!; fireAcc += dtMs; if (fireAcc<=900) return; fireAcc=0;
  for (const k in r.sources) {
    const st=r.sources[k]; if (!st.fire || st.fire<=r.clock.simMs) continue; const i=+k,tx=i%WW,ty=(i/WW)|0;
    const p=r.player; if (dist(p.x,p.y,tx*TILE+8,ty*TILE+8)<18) hurtPlayer(gs,6,tx*TILE+8,ty*TILE+8,'fire',now,60);
    for (const m of r.creatures) if (m.state!=='dead' && dist(m.x,m.y,tx*TILE+8,ty*TILE+8)<18) damageCreature(gs,m,8,0,now,0);
  }
}

// ---------- traces (K2/K5) ----------
function surfaceLife(t: number) { const k = SURF[t]; return k ? (BAL.traces[k] ?? 120) * 1000 : 0; }
function traceMult(w: string, surf: number) { let m = 1; if (w === 'rain') m = BAL.traces.rainDecayMult; if (w === 'storm') m = BAL.traces.stormDecayMult; if (surf === T.FLOOR || surf === T.BRIDGE) m = Math.min(m, 2); return m; }
export function decayTraces(r: RunState, dtMs: number, weather: string) {
  for (const tr of r.traces) tr.life -= dtMs * traceMult(weather, tr.s);
  if (r.traces.some(t => t.life <= 0)) r.traces = r.traces.filter(t => t.life > 0);
}

/** A successor is valid only while the sensed predecessor itself still exists. */
export function nextContiguousTrace(traces: RunState['traces'], known: { traceId?: string; chainId?: string }) {
  if (!known.traceId || !known.chainId) return undefined;
  const previous = traces.find(t => t.id === known.traceId && t.chainId === known.chainId && t.life > 0);
  if (!previous) return undefined;
  return traces.find(t => t.life > 0 && t.id && t.chainId === known.chainId && t.prevId === previous.id && t.t >= previous.t && dist(previous.x, previous.y, t.x, t.y) <= 24);
}

// ---------- core effects (C03: charge debited at commit, not windup) ----------
function commitCore(gs: GameState, now: number, slot: number, a: number) {
  const r = gs.run!; const p = r.player; const s = C(r, 'inv').slots[slot];
  if (!s || !ITEMS[s.key].core || (s.charge ?? 0) <= 0) { fx('fizzle', { x: p.x, y: p.y }); return; }
  s.charge!--; receipt(r, now, 'core.commit', `${s.key} charge→${s.charge}`); award(gs, 'first_core', now);
  const core = ITEMS[s.key].core; const hx = p.x + Math.cos(a) * 10, hy = p.y + Math.sin(a) * 10;
  fx('cast', { x: hx, y: hy, core, a });
  if (core === 'fire') PROJ.push({ x: hx, y: hy, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 0.95, dmg: 45, from: 'player', kind: 'fireball', r: 5 });
  if (core === 'earth') { for (let k = 1; k <= 8; k++) HAZ.push({ kind: 'circle', x: p.x + Math.cos(a) * k * 15, y: p.y + Math.sin(a) * k * 15, r: 9, t: 0, tell: k * 55, dur: 120, dmg: 32, style: 'spike', effect: 'quake', owner: 'player' }); fx('shake', { m: 3 }); }
  if (core === 'storm') {
    const wet = isWet(weatherAt(r, now)); let fromX = p.x, fromY = p.y; const hitSet = new Set<string>(); let any = false;
    for (let j = 0; j < 4; j++) {
      let best: Creature | null = null, bd = j ? 80 : 140;
      for (const m of r.creatures) { if (m.state === 'dead' || hitSet.has(m.id)) continue; const d = dist(fromX, fromY, m.x, m.y); if (d < bd && (j || Math.abs(angDiff(Math.atan2(m.y - p.y, m.x - p.x), a)) < 0.9)) { bd = d; best = m; } }
      if (!best) break; hitSet.add(best.id); any = true; fx('bolt', { x0: fromX, y0: fromY, x1: best.x, y1: best.y }); damageCreature(gs, best, wet ? 45 : 30, Math.atan2(best.y - fromY, best.x - fromX), now, 60); fromX = best.x; fromY = best.y;
    }
    if (!any) { const tx = p.x + Math.cos(a) * 90, ty = p.y + Math.sin(a) * 90; fx('bolt', { x0: p.x, y0: p.y, x1: tx, y1: ty }); ignite(gs, tileOf(tx), tileOf(ty), now); }
  }
  if (core === 'frost') {
    HAZ.push({ kind: 'ring', x: p.x, y: p.y, r: 60, t: 0, tell: 0, dur: 380, dmg: 20, style: 'frostnova', effect: 'slowm', owner: 'player' });
    const cx = tileOf(p.x), cy = tileOf(p.y); let froze = 0;
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) { if (Math.hypot(x - cx, y - cy) > 4.2) continue; const t = effTile(r, x, y); if (t === T.SHALLOW || t === T.RIVER) { r.terrain[y * WW + x] = { t: T.ICE, until: r.clock.simMs + 90000 }; froze++; } if ((r.sources[y * WW + x] as any)?.fire) (r.sources[y * WW + x] as any).fire = 0; }
    if (froze) { markDirty(); pushLog(r, now, `The water freezes solid (${froze} tiles) — for now.`, 'blue'); }
  }
}

function freezeTile(r: RunState, tx:number, ty:number, ms:number) {
  if(tx<0||ty<0||tx>=WW||ty>=WH)return false;const t=effTile(r,tx,ty);
  if(![T.DEEP,T.SHALLOW,T.RIVER,T.GRASS,T.MEADOW,T.FOREST,T.MARSH,T.SAND,T.ROAD].includes(t))return false;
  r.terrain[ty*WW+tx]={t:T.ICE,until:r.clock.simMs+ms};return true;
}
function freezeAround(r: RunState, x:number, y:number, ms:number) {let changed=false;const cx=tileOf(x),cy=tileOf(y);for(let yy=cy-1;yy<=cy+1;yy++)for(let xx=cx-1;xx<=cx+1;xx++)changed=freezeTile(r,xx,yy,ms)||changed;if(changed)markDirty();}

/** Select ten genuinely vacant nearby tiles without overwriting map sources,
 * structures, creatures or the player; failure spends no reserve. */
export function groveCells(r:RunState,x:number,y:number) {
  const cx=tileOf(x),cy=tileOf(y),grid=blockGrid(r),cells:{tx:number;ty:number;d:number}[]=[];
  if(dist(r.player.x,r.player.y,x,y)<3*TILE)return []; // never cage the caster
  for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++) {const tx=cx+dx,ty=cy+dy,d=Math.hypot(dx,dy);if(d<2||d>5||tx<1||ty<1||tx>=WW-1||ty>=WH-1)continue;const i=ty*WW+tx;if(grid[i]!==0||!clearPhysicalLine(r,{x,y},{x:tx*TILE+8,y:ty*TILE+8},true)||entsAt(r,tx,ty).length||r.natureTrees?.some(q=>q.tx===tx&&q.ty===ty)||r.creatures.some(m=>m.state!=='dead'&&tileOf(m.x)===tx&&tileOf(m.y)===ty)||(tileOf(r.player.x)===tx&&tileOf(r.player.y)===ty))continue;cells.push({tx,ty,d});}
  const selected:typeof cells=[];const count=BAL.creatorCoreEarthmother.treeCount;for(let k=0;k<count;k++){const angle=2*Math.PI*k/count;const candidates=cells.filter(q=>!selected.includes(q)&&Math.abs(angDiff(Math.atan2(q.ty*TILE+8-y,q.tx*TILE+8-x),angle))<=Math.PI/count).sort((a,b)=>Math.abs(a.d-3)-Math.abs(b.d-3)||a.ty-b.ty||a.tx-b.tx);if(!candidates.length)return [];selected.push(candidates[0]);}return selected;
}
function stepNatureTrees(r:RunState,now:number){if(!r.natureTrees?.length)return;const ready=r.natureTrees.filter(q=>q.until<=r.clock.simMs);if(!ready.length)return;r.natureTrees=r.natureTrees.filter(q=>q.until>r.clock.simMs);for(const q of ready){spawnDrop(r,'wood',BAL.creatorCoreEarthmother.woodPerTree,q.tx*TILE+8,q.ty*TILE+8,now,undefined,false);receipt(r,now,'core.grove.wood',`${q.tx},${q.ty}`);}markDirty();}

/** Only an explored, reachable, clear safe cell may be selected. Flood-fill
 * checks the LIVE collision graph, including locked doors and player walls. */
export function spiritDestination(r:RunState,x:number,y:number):string|null {
  if(!Number.isFinite(x)||!Number.isFinite(y))return 'Choose a map destination.';const tx=tileOf(x),ty=tileOf(y),sx=tileOf(r.player.x),sy=tileOf(r.player.y);if(tx<1||ty<1||tx>=WW-1||ty>=WH-1)return 'Outside the map.';
  if(sx<1||sy<1||sx>=WW-1||sy>=WH-1)return 'Departure is outside the map.';
  const i=ty*WW+tx,w=getWorld(),grid=blockGrid(r),terrain=effTile(r,tx,ty);if(!r.discovered[(ty>>2)*50+(tx>>2)])return 'Explore this area first.';if(w.economyMap.protected[i])return 'Protected POI or road: choose open ground.';if(grid[i]!==0||[T.LAVA,T.TOXIC,T.SHALLOW,T.RIVER,T.DEEP].includes(terrain)||(r.sources[i]?.fire||0)>r.clock.simMs)return 'Destination is obstructed or hazardous.';
  if((r.combat?.hazards||[]).some(h=>h.owner!=='player' && h.t<h.tell+h.dur && (h.kind==='ring'?dist(h.x,h.y,x,y)<(h.r||0)+10:inHaz(h,x,y))))return 'Destination threatened by an active hazard.';
  // Match the survival system's actual adjacent lava and burning-source radii.
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=tx+dx,ny=ty+dy;if(nx<0||ny<0||nx>=WW||ny>=WH)continue;if(effTile(r,nx,ny)===T.LAVA)return 'Destination threatened by nearby lava.';const fire=r.sources[ny*WW+nx]?.fire;if(fire && fire>r.clock.simMs && dist(x,y,nx*TILE+8,ny*TILE+8)<18)return 'Destination threatened by nearby fire.';}
  if(r.creatures.some(m=>m.state!=='dead'&&dist(m.x,m.y,x,y)<16))return 'Destination occupied.';
  for(const [dx,dy] of [[-4,-4],[4,-4],[-4,4],[4,4]])if(solidFor(r,x+dx,y+dy,'player'))return 'Not enough landing clearance.';
  const start=sy*WW+sx,seen=new Uint8Array(WW*WH),q=new Int32Array(WW*WH);let head=0,tail=0;q[tail++]=start;seen[start]=1;while(head<tail){const p=q[head++];if(p===i)return null;const px=p%WW,py=Math.floor(p/WW);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=px+dx,ny=py+dy;if(nx<1||ny<1||nx>=WW-1||ny>=WH-1)continue;const v=ny*WW+nx;if(!seen[v]&&(grid[v]===0||grid[v]===4)){seen[v]=1;q[tail++]=v;}}}return 'No legal physical route; sealed areas cannot be bypassed.';
}
/** The physical UID captured at windup must still occupy the same slot at commit. */
function commitCreatorCore(gs: GameState, now: number, slot: number, uid0: string, mode: 'basic'|'refined'|'signature', a: number, aim: Input) {
  const r = gs.run!, p = r.player, s = C(r, 'inv').slots[slot];
  if (!s || p.active !== slot || s.uid !== uid0 || !ITEMS[s.key]?.creatorCore || !s.reserves || s.reserves[mode] <= 0) { fx('fizzle', {x:p.x,y:p.y}); return; }
  let grove:{tx:number;ty:number;d:number}[] | undefined;
  if(ITEMS[s.key].creatorCore==='earthmother' && mode==='refined') { const len=Math.min(BAL.creatorCoreEarthmother.groveRange,dist(p.x,p.y,aim.mx,aim.my),rayLen(r,p.x,p.y,a,BAL.creatorCoreEarthmother.groveRange));grove=groveCells(r,p.x+Math.cos(a)*len,p.y+Math.sin(a)*len);if(grove.length!==BAL.creatorCoreEarthmother.treeCount || (r.natureTrees?.length||0)+grove.length>100){fx('toast',{text:'Need open ground for all ten trees.'});return;} }
  if(ITEMS[s.key].creatorCore==='demon'&&mode==='signature'){const reason=spiritDestination(r,aim.mx,aim.my);if(reason){fx('toast',{text:reason});return;}}
  s.reserves[mode]--; receipt(r, now, 'core.commit', `${s.uid}:${mode}:${s.reserves[mode]}`); award(gs,'first_core',now);
  const b = BAL.creatorCoreBlast, hx=p.x+Math.cos(a)*10, hy=p.y+Math.sin(a)*10;
  const visualCore=ITEMS[s.key].essence==='water'?'frost':ITEMS[s.key].essence==='nature'?(ITEMS[s.key].creatorCore==='mjolnir'?'storm':'earth'):ITEMS[s.key].essence==='spirit'?'spirit':'fire';
  fx('cast',{x:hx,y:hy,core:visualCore,a});
  if(ITEMS[s.key].creatorCore==='demon') {const e=BAL.creatorCoreDemon;
    if(mode==='basic')PROJ.push({x:hx,y:hy,vx:Math.cos(a)*e.raySpeed,vy:Math.sin(a)*e.raySpeed,life:e.rayLife,dmg:e.rayDamage,from:'player',kind:'spirit_ray',r:3});
    if(mode==='refined'){const len=rayLen(r,p.x,p.y,a,e.beamRange);p.channelUntil=now+e.beamMs;HAZ.push({kind:'line',x:p.x,y:p.y,angle:a,len,w:e.beamWidth,t:0,tell:0,dur:e.beamMs,dmg:e.beamDamage,style:'beam',effect:'spiritBeam',owner:'player',expiresSimMs:r.clock.simMs+e.beamMs});}
    if(mode==='signature'){p.pulling=null;r.spiritTransit={x:aim.mx,y:aim.my,arriveAt:now+e.teleportMs,uid:s.uid};fx('spiritDepart',{x:p.x,y:p.y});receipt(r,now,'core.spirit.depart',s.uid);}
    return;
  }
  if(ITEMS[s.key].creatorCore==='mjolnir') {
    const e=BAL.creatorCoreMjolnir;
    if(mode==='basic') {let from={x:p.x,y:p.y};const hit=new Set<string>();for(let j=0;j<3;j++){const candidates=r.creatures.filter(m=>m.state!=='dead'&&!m.elder?.submerged&&!m.atk?.burrow&&!hit.has(m.id)&&dist(from.x,from.y,m.x,m.y)<(j?e.chainRange:e.punchRange)&&(j||Math.abs(angDiff(Math.atan2(m.y-p.y,m.x-p.x),a))<0.8)&&clearPhysicalLine(r,from,m,true)).sort((u,v)=>dist(from.x,from.y,u.x,u.y)-dist(from.x,from.y,v.x,v.y));const m=candidates[0];if(!m)break;hit.add(m.id);const wet=isWet(weatherAt(r,now))||[T.SHALLOW,T.RIVER].includes(effTile(r,tileOf(m.x),tileOf(m.y)));fx('bolt',{x0:from.x,y0:from.y,x1:m.x,y1:m.y});damageCreature(gs,m,(j?e.chainDamage:e.punchDamage)*(wet?e.wetMultiplier:1),a,now,j?25:130);from={x:m.x,y:m.y};} }
    if(mode==='refined'||mode==='signature'){const len=Math.min(e.targetRange,dist(p.x,p.y,aim.mx,aim.my),rayLen(r,p.x,p.y,a,e.targetRange)),x=p.x+Math.cos(a)*len,y=p.y+Math.sin(a)*len;
      if(mode==='refined')for(let i=0;i<e.strikeCount;i++)HAZ.push({kind:'circle',x,y,r:e.strikeRadius,t:0,tell:250+i*e.strikeIntervalMs,dur:100,dmg:e.strikeDamage,style:'lightning',effect:'mjolnirStrike',owner:'player'});
      else {emitCombatSound(r, now, 'signature', x, y); HAZ.push({kind:'pool',x,y,r:e.attractRadius,t:0,tell:0,dur:e.attractMs,dmg:0,style:'lightning',effect:'mjolnirPull',owner:'player',expiresSimMs:r.clock.simMs+e.attractMs});HAZ.push({kind:'circle',x,y,r:e.attractRadius,t:0,tell:e.attractMs,dur:150,dmg:e.burstDamage,style:'lightning',effect:'mjolnirStrike',owner:'player',expiresSimMs:r.clock.simMs+e.attractMs+150});}
    }return;
  }
  if(ITEMS[s.key].creatorCore==='earthmother') {
    const e=BAL.creatorCoreEarthmother;
    if(mode==='basic')PROJ.push({x:hx,y:hy,vx:Math.cos(a)*e.rockSpeed,vy:Math.sin(a)*e.rockSpeed,life:e.rockLife,dmg:e.rockDamage,from:'player',kind:'nature_rock',r:4});
    if(mode==='refined'){(r.natureTrees ??= []).push(...grove!.map(q=>({tx:q.tx,ty:q.ty,until:r.clock.simMs+e.treeMs})));markDirty();receipt(r,now,'core.grove.grow',`${s.uid}:${grove!.length}`);}
    if(mode==='signature'){const len=Math.min(e.groveRange,dist(p.x,p.y,aim.mx,aim.my),rayLen(r,p.x,p.y,a,e.groveRange)),x=p.x+Math.cos(a)*len,y=p.y+Math.sin(a)*len;HAZ.push({kind:'pool',x,y,r:e.rootRange,t:0,tell:0,dur:e.rootMs,dmg:e.rootDamage,style:'roots',effect:'natureRoot',owner:'player',expiresSimMs:r.clock.simMs+e.rootMs});let n=0;const cx=tileOf(x),cy=tileOf(y);for(let yy=cy-4;yy<=cy+4;yy++)for(let xx=cx-4;xx<=cx+4;xx++){if(xx<0||yy<0||xx>=WW||yy>=WH||dist(x,y,xx*TILE+8,yy*TILE+8)>e.rootRange)continue;const i=yy*WW+xx,t=effTile(r,xx,yy);if(!r.terrain[i]&&clearPhysicalLine(r,{x,y},{x:xx*TILE+8,y:yy*TILE+8},true)&&[T.SAND,T.MEADOW,T.FOREST,T.MARSH,T.HILL,T.BURNT].includes(t)){r.terrain[i]={t:T.GRASS,until:r.clock.simMs+e.rootMs};n++;}}if(n)markDirty();receipt(r,now,'core.roots',`${s.uid}:${n}`);}
    return;
  }
  if (ITEMS[s.key].creatorCore === 'elsa') {
    const e=BAL.creatorCoreElsa;
    if(mode==='basic') PROJ.push({x:hx,y:hy,vx:Math.cos(a)*e.shardSpeed,vy:Math.sin(a)*e.shardSpeed,life:e.shardLife,dmg:e.shardDamage,from:'player',kind:'elsa_shard',r:3});
    if(mode==='refined') { p.iceUntil=now+e.selfMs; fx('cast',{x:p.x,y:p.y,core:'frost',a}); }
    if(mode==='signature') {
      const vx=clamp(Number.isFinite(aim.viewX)?aim.viewX!:p.x-VIEW_W/2,0,WW*TILE-VIEW_W),vy=clamp(Number.isFinite(aim.viewY)?aim.viewY!:p.y-VIEW_H/2,0,WH*TILE-VIEW_H);
      for(const m of r.creatures)if(m.state!=='dead'&&!m.elder?.submerged&&!m.atk?.burrow&&m.x>=vx&&m.x<vx+VIEW_W&&m.y>=vy&&m.y<vy+VIEW_H&&clearPhysicalLine(r,p,m,true))m.frozenUntil=Math.max(m.frozenUntil||0,now+e.enemyMs);
      let cells=0; for(let y=Math.floor(vy/TILE);y<=Math.floor((vy+VIEW_H-1)/TILE);y++)for(let x=Math.floor(vx/TILE);x<=Math.floor((vx+VIEW_W-1)/TILE);x++)if(freezeTile(r,x,y,e.terrainMs))cells++;
      if(cells)markDirty();receipt(r,now,'core.elsa.freeze',`${s.uid}:${cells}`);fx('cast',{x:p.x,y:p.y,core:'frost',a});
    }
    return;
  }
  if (ITEMS[s.key].creatorCore === 'dragon') {
    const d=BAL.creatorCoreDragon;
    if(mode==='basic') { const len=rayLen(r,p.x,p.y,a,d.flameLength);HAZ.push({kind:'line',x:p.x,y:p.y,angle:a,len,w:d.flameWidth,t:0,tell:0,dur:180,dmg:d.flameDamage,style:'burn',effect:'flameLine',owner:'player'}); }
    if(mode==='refined') { const distance=Math.min(d.tornadoSpeed*d.tornadoSeconds,dist(p.x,p.y,aim.mx,aim.my));PROJ.push({x:hx,y:hy,vx:Math.cos(a)*d.tornadoSpeed,vy:Math.sin(a)*d.tornadoSpeed,life:Math.max(0.2,distance/d.tornadoSpeed),dmg:d.tornadoDamage,from:'player',kind:'fire_tornado',r:8}); }
    if(mode==='signature') {
      const vx=clamp(Number.isFinite(aim.viewX)?aim.viewX!:p.x-VIEW_W/2,0,WW*TILE-VIEW_W),vy=clamp(Number.isFinite(aim.viewY)?aim.viewY!:p.y-VIEW_H/2,0,WH*TILE-VIEW_H);
      // Route is built only from physically connected visible targets. Anchors
      // and order are captured once; later camera movement cannot change it.
      const visible=r.creatures.filter(m=>m.state!=='dead'&&!m.elder?.submerged&&!m.atk?.burrow&&m.hp>0&&m.x>=vx&&m.x<vx+VIEW_W&&m.y>=vy&&m.y<vy+VIEW_H);
      const remaining=[...visible], route:{id:string;x:number;y:number}[]=[];let cursor={x:p.x,y:p.y};
      while(remaining.length){const choices=remaining.filter(m=>clearPhysicalLine(r,cursor,m,true)).sort((u,v)=>dist(cursor.x,cursor.y,u.x,u.y)-dist(cursor.x,cursor.y,v.x,v.y)||u.id.localeCompare(v.id));if(!choices.length)break;const m=choices[0];route.push({id:m.id,x:m.x,y:m.y});remaining.splice(remaining.indexOf(m),1);cursor={x:m.x,y:m.y};}
      const last=route[route.length-1];if(last)r.dragonDive={ids:route.map(q=>q.id),x:last.x,y:last.y,left:d.collectMs,route,index:0,dragonX:p.x,dragonY:p.y,phase:'traverse',hitIds:[]};
      receipt(r,now,'core.dragon.collect',`${s.uid}:${visible.length}`);
    }
    return;
  }
  if (ITEMS[s.key].creatorCore === 'meteor') {
    const m=BAL.creatorCoreMeteor;
    if(mode==='basic') PROJ.push({x:hx,y:hy,vx:Math.cos(a)*190,vy:Math.sin(a)*190,life:0.95,dmg:m.fireballDamage,from:'player',kind:'fireball',r:5});
    if(mode==='refined') { const len=Math.min(m.targetRange,dist(p.x,p.y,aim.mx,aim.my),rayLen(r,p.x,p.y,a,m.targetRange)); HAZ.push({kind:'circle',x:p.x+Math.cos(a)*len,y:p.y+Math.sin(a)*len,r:m.radius,t:0,tell:m.tellMs,dur:120,dmg:m.targetDamage,style:'meteor',effect:'meteorBurn',owner:'player'}); }
    if(mode==='signature') { const vx=clamp(Number.isFinite(aim.viewX)?aim.viewX!:p.x-VIEW_W/2,0,WW*TILE-VIEW_W),vy=clamp(Number.isFinite(aim.viewY)?aim.viewY!:p.y-VIEW_H/2,0,WH*TILE-VIEW_H);for(let i=0;i<m.stormCount;i++)HAZ.push({kind:'circle',x:vx+rngNext(r)*VIEW_W,y:vy+rngNext(r)*VIEW_H,r:m.radius,t:0,tell:m.tellMs+i*m.staggerMs,dur:120,dmg:m.stormDamage,style:'meteor',effect:'meteorBurn',owner:'player'});receipt(r,now,'core.meteorStorm',`${s.uid}:${m.stormCount}`); }
    return;
  }
  if (mode === 'basic') { const angle=a+(rngNext(r)*2-1)*b.spreadRadians; PROJ.push({x:hx,y:hy,vx:Math.cos(angle)*b.basicSpeed,vy:Math.sin(angle)*b.basicSpeed,life:b.basicLife,dmg:b.basicDamage,from:'player',kind:'blast_round',r:2}); }
  if (mode === 'refined') PROJ.push({x:hx,y:hy,vx:Math.cos(a)*100,vy:Math.sin(a)*100,life:b.bombSeconds,dmg:b.bombDamage,from:'player',kind:'blast_bomb',r:4});
  if (mode === 'signature') PROJ.push({x:hx,y:hy,vx:Math.cos(a)*b.signatureSpeed,vy:Math.sin(a)*b.signatureSpeed,life:b.signatureLife,dmg:b.signatureDamage,from:'player',kind:'blast_signature',r:6});
}

// ---------- player ----------
function tickPlayer(gs: GameState, inp: Input, dtMs: number, now: number) {
  const r = gs.run!; const p = r.player; const dt = dtMs / 1000; const B = BAL.player;
  if (p.dead) { delete r.spiritTransit; p.deadT += dtMs; delete r.traceWalk; return; }
  if(r.spiritTransit && now>=r.spiritTransit.arriveAt){const t=r.spiritTransit,reason=spiritDestination(r,t.x,t.y);delete r.spiritTransit;if(!reason){p.x=t.x;p.y=t.y;delete r.traceWalk;fx('spiritArrive',{x:p.x,y:p.y});receipt(r,now,'core.spirit.arrive',t.uid);}else fx('toast',{text:`Teleport aborted: ${reason}`});}
  const startX = p.x, startY = p.y;
  p.invuln = Math.max(0, p.invuln - dtMs);
  p.aim = Math.atan2(inp.my - p.y, inp.mx - p.x);
  let mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0); const ml = Math.hypot(mx, my); if (ml) { mx /= ml; my /= ml; }
  const act = p.action;
  // start actions
  const selfFrozen=(p.iceUntil||0)>now || (p.channelUntil||0)>now || !!r.spiritTransit;
  if ((p.iceUntil||0)>now) { for(const m of r.creatures)if(m.state!=='dead'&&!m.elder?.submerged&&!m.atk?.burrow&&dist(p.x,p.y,m.x,m.y)<BAL.creatorCoreElsa.auraRadius&&los(r,p.x,p.y,m.x,m.y,true))m.frozenUntil=Math.max(m.frozenUntil||0,now+BAL.creatorCoreElsa.enemyMs); }
  if (!p.vehicle && !selfFrozen && inp.roll && p.stamina >= B.rollCost && (!act || act.kind === 'hurt' || (act.kind === 'swing' && act.done))) {
    p.stamina -= B.rollCost; p.action = { kind: 'roll', t: 0, dur: B.rollMs, angle: ml ? Math.atan2(my, mx) : p.aim }; p.invuln = Math.max(p.invuln, B.rollMs - 40); fx('roll', { x: p.x, y: p.y });
  } else if (inp.cancel && act?.kind === 'cast') { dispatch(gs, { id: 'cc' + now, type: 'castCancel' }, now); p.action = null; fx('fizzle', { x: p.x, y: p.y }); }
  else if (!p.vehicle && !selfFrozen && inp.skill && !p.action) {
    const s = activeStack(r), mode=inp.skill, chosen=inp.skillAim;
    if (s && (!chosen || (chosen.uid===s.uid && chosen.slot===p.active)) && ITEMS[s.key]?.creatorCore && s.reserves && s.reserves[mode]>0) { const tx=chosen?.mx ?? inp.mx,ty=chosen?.my ?? inp.my; p.action={kind:'cast',t:0,dur:380,contact:300,angle:Math.atan2(ty-p.y,tx-p.x),slot:p.active,coreUid:s.uid,mode,targetX:tx,targetY:ty,viewX:chosen?.viewX ?? inp.viewX,viewY:chosen?.viewY ?? inp.viewY}; fx('windup',{x:p.x,y:p.y,core:ITEMS[s.key].essence==='water'?'frost':ITEMS[s.key].essence==='nature'?(ITEMS[s.key].creatorCore==='mjolnir'?'storm':'earth'):ITEMS[s.key].essence==='spirit'?'spirit':'fire'}); }
    else fx('toast',{text:'Creator Core reserve empty — reload with R.'});
  }
  else if (!p.vehicle && !selfFrozen && (inp.attackPressed || inp.attack) && !p.action) {
    const s = activeStack(r); const d = s ? ITEMS[s.key] : null;
    if (d?.repair && s?.dur !== undefined && s.dur <= 0) { if (inp.attackPressed) fx('toast', { text: `${d.name} is broken. Repair it at a workbench.` }); }
    else if (d?.creatorCore) { if (s!.reserves && s!.reserves.basic>0) { p.action={kind:'cast',t:0,dur:d.creatorCore==='meteor'?400:d.creatorCore==='dragon'?280:180,contact:d.creatorCore==='meteor'?300:d.creatorCore==='dragon'?170:100,angle:p.aim,slot:p.active,coreUid:s!.uid,mode:'basic'}; } else if(inp.attackPressed) fx('toast',{text:'Basic reserve empty — press R to reload.'}); }
    else if (d?.core) { if ((s!.charge ?? 0) > 0) { p.action = { kind: 'cast', t: 0, dur: 520, contact: 460, angle: p.aim, slot: p.active }; fx('windup', { x: p.x, y: p.y, core: d.core }); } else if (inp.attackPressed) fx('toast', { text: 'This Core is spent. Study it at a Research Table.' }); }
    else if (d && d.food && inp.attackPressed) { const res = dispatch(gs, { id: 'use' + now, type: 'useItem', slot: p.active }, now); fx(res.ok ? 'eat' : 'toast', { x: p.x, y: p.y, text: res.ok ? '' : (res as any).reason }); }
    else if (d && d.cat === 'bp' && inp.attackPressed) { const res = dispatch(gs, { id: 'use' + now, type: 'useItem', slot: p.active }, now); fx('toast', { text: res.ok ? res.msg : (res as any).reason }); }
    else if (s?.key === 'motorbike_kit' && inp.attackPressed) { const res=dispatch(gs,{id:'bike'+now,type:'placeMotorbike',x:inp.mx,y:inp.my},now);fx('toast',{text:res.ok?'Motorbike deployed. Open with E.':(res as any).reason}); }
    else if (s?.key === 'cart_kit' && inp.attackPressed) { const res = dispatch(gs, { id: 'cart' + now, type: 'placeCart', x: inp.mx, y: inp.my }, now); fx('toast', { text: res.ok ? 'Cart unpacked. Press F next to it to pull.' : (res as any).reason }); }
    else if (d && (d.slot || d.cat === 'kit' || d.cat === 'res' || d.cat === 'cash' || d.cat === 'stone' || d.cat === 'misc') && !d.dmg) { if (inp.attackPressed) { const tool = FISTS; p.action = { kind: 'swing', t: 0, dur: tool.swing, contact: tool.swing * 0.45, angle: p.aim, slot: -1 }; } }
    else if (d?.ranged) { if (countItem(r, 'inv', 'arrow') > 0) p.action = { kind: 'swing', t: 0, dur: d.swing!, contact: d.swing! * 0.62, angle: p.aim, slot: p.active }; else if (inp.attackPressed) fx('toast', { text: 'No arrows.' }); }
    else { const tool = d?.dmg ? d : FISTS; p.action = { kind: 'swing', t: 0, dur: tool.swing, contact: tool.swing * 0.45, angle: p.aim, slot: d?.dmg ? p.active : -1 }; fx('whoosh', { x: p.x, y: p.y }); }
  }
  // progress action
  let speedMul = selfFrozen ? 0 : 1; const a2 = p.action;
  if (a2) {
    a2.t += dtMs;
    if (a2.kind === 'swing') { speedMul = 0.45; if (!a2.done && a2.t >= (a2.contact || 0)) { a2.done = true; resolveSwing(gs, now, a2.slot ?? -1, a2.angle); } }
    if (a2.kind === 'cast') { speedMul = selfFrozen ? 0 : a2.mode==='basic' && C(r,'inv').slots[a2.slot!]?.key==='core_dragon' ? 0 : 0.3; if (!a2.coreUid || a2.mode==='basic') a2.angle = p.aim; if (!a2.done && a2.t >= (a2.contact || 0)) { a2.done = true; if (a2.coreUid && a2.mode) commitCreatorCore(gs, now, a2.slot!, a2.coreUid, a2.mode, a2.angle, {...inp,mx:a2.targetX ?? inp.mx,my:a2.targetY ?? inp.my,viewX:a2.viewX ?? inp.viewX,viewY:a2.viewY ?? inp.viewY}); else commitCore(gs, now, a2.slot!, a2.angle); } }
    if (a2.kind === 'hurt') speedMul = 0.6;
    if (a2.t >= a2.dur) p.action = null;
  }
  // terrain & load
  const t = effTile(r, tileOf(p.x), tileOf(p.y));
  if ((p.iceUntil||0)>now || (p.channelUntil||0)>now || r.spiritTransit) speedMul=0;
  let sp = B.speed * (BAL.terrainSpeed[SPEED_KEY[t]] ?? 1) * speedMul;
  const w = invWeight(r), limit = carryLimit(r), personalLoad = w > limit ? Math.max(0.35, 1 - (w - limit) / limit) : 1;
  let condition = 1; if (slowTimer > 0) { condition *= 0.5; slowTimer -= dtMs; } if (rootTimer > 0) { condition *= 0.15; rootTimer -= dtMs; }
  sp *= personalLoad * condition;
  let cart: Entity | null = p.pulling ? r.entities[p.pulling] : null; if (p.pulling && !cart) p.pulling = null;
  if (cart) { const ct = effTile(r, tileOf(cart.x), tileOf(cart.y)); const road = ct === T.ROAD || ct === T.BRIDGE || ct === T.FLOOR; const rough = ct === T.FOREST || ct === T.MARSH || ct === T.HILL || ct === T.SNOW;
    const base = road ? BAL.cart.speedOnRoad : rough ? BAL.cart.speedRough : BAL.cart.speedOffRoad; const cw = cartWeightOf(r, cart);
    sp = B.speed * speedMul * base * Math.max(0.25, 1 - cw / 100 * BAL.cart.weightPenaltyPer100) * (cw > cartLimit(cart) ? 0.4 : 1) * personalLoad * condition; }
  const bike=p.vehicle ? r.entities[p.vehicle] : undefined;
  if(bike?.kind==='vehicle' && bike.vehicle && bike.deployed) {
    const V=BAL.motorbike, load=cartWeightOf(r,bike)/V.maxWeight, road=!!getWorld(r.layoutId||'shipping').vehicleGeometry?.road[tileOf(bike.y)*WW+tileOf(bike.x)], rough=[T.FOREST,T.MARSH,T.HILL,T.SNOW].includes(t);
    sp=(road?V.roadSpeed:rough?V.roughSpeed:V.groundSpeed)*Math.max(.5,1-load*.35)*condition*speedMul;
    const baseWear=V.wearPerPixel*(rough?1.5:1)*(1+load*.5); const lubeReduced=baseWear*(1-BAL.oilRefineryV1.lubricantWearReduction); let lubeLeft=bike.vehicle.lube||0; let wearTotal=0; const rate=V.fuelPerPixel*(rough?V.roughFuelMultiplier:1)*(1+load*V.loadFuelMultiplier);
    let remaining=ml ? Math.min(sp*dt,bike.vehicle.fuel/rate,(bike.hp||0)/baseWear) : 0;
    const ox=bike.x,oy=bike.y;
    while(remaining>1e-8){const step=Math.min(remaining,3);const nx=bike.x+mx*step,ny=bike.y+my*step;if(!vehicleClear(r,nx,ny,bike.id)||!vehicleExitPoint(r,nx,ny,bike.id))break;bike.x=nx;bike.y=ny;remaining-=step;
      // Each step is charged at its own rate: protected while lubeLeft>0, full wear after the boundary.
      const protectedPart=Math.min(step,lubeLeft); wearTotal+=protectedPart*lubeReduced+(step-protectedPart)*baseWear; lubeLeft-=protectedPart;}
    const travelled=dist(ox,oy,bike.x,bike.y);if(travelled>0){bike.vehicle.fuel=Math.max(0,bike.vehicle.fuel-travelled*rate);bike.vehicle.odometer+=travelled;bike.hp=Math.max(0,(bike.hp||0)-wearTotal);bike.deployed.dur=bike.hp;bike.vehicle.angle=Math.atan2(my,mx); if((bike.vehicle.lube||0)>0) bike.vehicle.lube=lubeLeft;}
    p.x=bike.x;p.y=bike.y; if(ml)p.aim=bike.vehicle.angle;
  } else if (p.action?.kind === 'roll') { const ra = p.action.angle; moveBody(r, p, Math.cos(ra) * B.rollSpeed * dt, Math.sin(ra) * B.rollSpeed * dt, 4, 'player'); }
  else if (ml) { moveBody(r, p, mx * sp * dt, my * sp * dt, 4, 'player'); p.stepAcc += sp * dt; if (p.stepAcc > 13) { p.stepAcc = 0; fx('step', { x: p.x, y: p.y + 6, t }); } }
  const movedX = p.x, movedY = p.y;
  p.vx = ml ? mx * sp : 0; p.vy = ml ? my * sp : 0;
  p.dir = dirFromAngle(p.aim);
  // cart rope
  if (cart) {
    const d = dist(p.x, p.y, cart.x, cart.y);
    if (d > 15) { const a = Math.atan2(p.y - cart.y, p.x - cart.x); const step = d - 15; const ox = cart.x, oy = cart.y; moveBody(r, cart, Math.cos(a) * step, Math.sin(a) * step, 5, 'cart'); if (Math.hypot(cart.x - ox, cart.y - oy) < step * 0.3 && d > 26) { const b = Math.atan2(p.y - cart.y, p.x - cart.x); p.x = cart.x + Math.cos(b) * 26; p.y = cart.y + Math.sin(b) * 26; fx('toast', { text: 'The cart is stuck — carts cannot ford water or squeeze through.', key: 'cartstuck' }); } }
  }
  // stamina
  if (!p.action || p.action.kind === 'hurt') p.stamina = Math.min(B.maxStamina, p.stamina + B.staminaRegen * dt * (p.hunger > 10 ? 1 : 0.4));
  // A motorbike does not create human footprints.
  if(bike){delete r.traceWalk;return;}
  // One run-owned emission path: actual collision-resolved movement only.
  let walk = r.traceWalk;
  if (!walk || dist(startX, startY, walk.x, walk.y) > 0.01 || now < walk.at || now - walk.at > 1000) walk = { x: startX, y: startY, at: now, distance: 0 };
  const reset = () => { walk!.distance = 0; delete walk!.lastId; delete walk!.chainId; };
  // Cart snap is a discontinuity, not a traversed route.
  if (dist(movedX, movedY, p.x, p.y) > 0.01) reset();
  else {
    const dx = p.x - startX, dy = p.y - startY, travelled = Math.hypot(dx, dy);
    // Sample the actual axis-separated collision path, so a short unmarkable crossing breaks the chain.
    const paths = [[startX, startY, movedX, startY], [movedX, startY, movedX, movedY]];
    let markable = surfaceLife(effTile(r, tileOf(startX), tileOf(startY))) > 0;
    for (const [x0, y0, x1, y1] of paths) {
      const n = Math.max(1, Math.ceil(dist(x0, y0, x1, y1) / 2));
      for (let i = 1; i <= n; i++) if (!surfaceLife(effTile(r, tileOf(x0 + (x1 - x0) * i / n), tileOf(y0 + (y1 - y0) * i / n)))) markable = false;
    }
    if (!markable) reset();
    else if (travelled > 0) {
      walk.distance += travelled;
      if (walk.distance > 10) {
        walk.distance = 0;
        const previous = walk.lastId && r.traces.find(tr => tr.id === walk!.lastId && tr.chainId === walk!.chainId && tr.life > 0);
        const id = uid(r, 'tr'), chainId = previous ? previous.chainId! : id;
        const surf = effTile(r, tileOf(p.x), tileOf(p.y));
        r.traces.push({ id, chainId, prevId: previous ? previous.id : undefined, x: p.x, y: p.y + 5, t: now, life: surfaceLife(surf), a: Math.atan2(dy, dx), s: surf });
        walk.lastId = id; walk.chainId = chainId;
        if (r.traces.length > 2600) r.traces.splice(0, 200);
      }
    }
  }
  walk.x = p.x; walk.y = p.y; walk.at = now; r.traceWalk = walk;
}
function cartWeightOf(r: RunState, e: Entity) { return C(r, e.c!).slots.reduce((a, s) => a + (s ? ITEMS[s.key].w * s.qty : 0), 0); }

/** W08: a committed weapon release is a finite, source-identified sound at the release point. Quiet melee uses a short range. */
function emitCombatSound(r: RunState, now: number, kind: CombatKind, x: number, y: number) {
  // The receipt sequence is the event identity: read it after receipt() advances it, never predict it.
  receipt(r, now, 'stimulus.emit', `${kind}:${x},${y}`);
  const seq = r.seq;
  pushCombatStimulus(r, combatStimulus(seq, kind, x, y, now));
}
function resolveSwing(gs: GameState, now: number, slot: number, a: number) {
  const r = gs.run!; const p = r.player; const s = slot >= 0 ? C(r, 'inv').slots[slot] : null; const d = s ? ITEMS[s.key] : FISTS;
  if (s?.dur !== undefined && s.dur <= 0 && d.repair) return; // stale action cannot use a broken physical item
  if (d.ranged) { // bow: arrow consumed at release
    if (countItem(r, 'inv', 'arrow') < 1) return; removeItem(r, 'inv', 'arrow', 1); emitCombatSound(r, now, 'ranged', p.x, p.y);
    PROJ.push({ x: p.x + Math.cos(a) * 8, y: p.y + Math.sin(a) * 8, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 0.85, dmg: d.dmg, from: 'player', kind: 'arrow', r: 3 }); fx('bowshot', { x: p.x, y: p.y, a });
    wearTool(gs, slot, now); return;
  }
  const R = d.reach, A = d.arc; let hitAny = false;
  emitCombatSound(r, now, 'melee', p.x, p.y);
  fx('slash', { x: p.x, y: p.y - 2, a, reach: R, arc: A, key: s?.key || 'fists' });
  for (const m of r.creatures) {
    if (m.state === 'dead') continue; const dd = dist(p.x, p.y, m.x, m.y) - (m.elder ? ELDERS[m.elder.key].r : CREATURES[m.type]?.r || 6);
    if (dd > R) continue; const ang = Math.atan2(m.y - p.y, m.x - p.x); if (dd > 6 && Math.abs(angDiff(ang, a)) > A / 2 + 0.15) continue;
    if (!los(r, p.x, p.y, m.x, m.y)) continue;
    if (damageCreature(gs, m, d.dmg, a, now)) hitAny = true;
  }
  // structures (spikes etc. not hittable); sources — one per swing, nearest in arc
  let best: { tx: number; ty: number; d: number } | null = null, exhausted: { tx: number; ty: number; d: number } | null = null;
  for (let rr = 6; rr <= R + 4; rr += 5) for (let k = -2; k <= 2; k++) {
    const ang = a + (A / 2) * (k / 2); const x = p.x + Math.cos(ang) * rr, y = p.y + Math.sin(ang) * rr; const tx = tileOf(x), ty = tileOf(y);
    const src = sourceAt(r, tx, ty, now); if (!src) continue;
    const targetBlock = blockGrid(r)[ty * WW + tx];
    if (targetBlock === 1 || targetBlock === 3 || targetBlock === 5 || !clearInteraction(r, { x: tx * TILE + 8, y: ty * TILE + 8 })) continue;
    const dd = dist(p.x, p.y, tx * TILE + 8, ty * TILE + 8); if(src.stock<=0){if(!exhausted||dd<exhausted.d)exhausted={tx,ty,d:dd};continue;} if (!best || dd < best.d) best = { tx, ty, d: dd };
  }
  best ||= exhausted;
  if (best) {
    const res = harvestHit(gs, best.tx, best.ty, d.power || {}, now, p.x, p.y);
    const x = best.tx * TILE + 8, y = best.ty * TILE + 8;
    const ignited = s?.key === 'torch' && ignite(gs, best.tx, best.ty, now);
    if (res.result === 'yield') { fx('chip', { x, y, mat: res.mat, key: res.key, depleted: res.depleted }); hitAny = true; if (res.depleted) fx('fell', { x, y, key: res.key }); }
    else if (res.result === 'nopower' && !ignited) { fx('clank', { x, y, mat: res.mat }); fx('toast', { text: res.mat === 'wood' ? 'Too slow with this — an axe would fell it.' : res.mat === 'stone' || res.mat === 'ore' ? 'You need a pickaxe for this.' : 'Wrong tool for this.', key: 'tool' + res.mat }); }
    else if (res.result === 'empty') { fx('clank', { x, y, mat: res.mat, soft: true }); fx('toast', { text: SOURCES[res.key!]?.regrow ? 'Exhausted — this plant can regrow.' : 'Exhausted — no stock remains.', key: 'source-empty' }); }
    if (ignited) { hitAny = true; fx('toast', { text: 'Tree burning — E uses flask water to douse.', key: 'fire-danger' }); }
  }
  if (hitAny && slot >= 0) wearTool(gs, slot, now);
}
function wearTool(gs: GameState, slot: number, now: number) {
  const r = gs.run!; const s = C(r, 'inv').slots[slot]; if (!s || s.dur === undefined) return;
  s.dur = Math.max(0, s.dur - 1); if (s.dur === 0) { const repairable = !!ITEMS[s.key].repair; if (!repairable) C(r, 'inv').slots[slot] = null; fx('break', { x: r.player.x, y: r.player.y }); pushLog(r, now, `${ITEMS[s.key].name} broke.${repairable ? ' Repair it at a workbench.' : ''}`, 'red'); receipt(r, now, 'tool.break', `${s.key}:${s.uid}`); }
}

// ---------- creatures ----------
function astar(r: RunState, sx: number, sy: number, gx: number, gy: number, limit = 700): number[] | null {
  const g = blockGrid(r); const open: [number, number][] = [[0, sy * WW + sx]]; const came = new Map<number, number>(); const cost = new Map<number, number>([[sy * WW + sx, 0]]); const goal = gy * WW + gx; let n = 0;
  while (open.length && n++ < limit) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i; const [, cur] = open.splice(bi, 1)[0];
    if (cur === goal) { const path = [cur]; let c = cur; while (came.has(c)) { c = came.get(c)!; path.push(c); } return path.reverse(); }
    const cx = cur % WW, cy = (cur / WW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue; const j = ny * WW + nx; const b = g[j]; if ((b !== 0 && b !== 4) && j !== goal) continue;
      const nc = cost.get(cur)! + (b === 4 ? 3 : 1); if (nc < (cost.get(j) ?? 1e9)) { cost.set(j, nc); came.set(j, cur); open.push([nc + Math.abs(nx - gx) + Math.abs(ny - gy), j]); } }
  }
  return null;
}
function steer(gs: GameState, m: Creature, tx: number, ty: number, sp: number, dt: number, now: number) {
  const r = gs.run!; const d = dist(m.x, m.y, tx, ty); if (d < 2) return;
  let ax = tx, ay = ty;
  if (!los(r, m.x, m.y, tx, ty, true)) {
    m.pathT -= dt * 1000;
    if (!m.path || m.pathT <= 0 || m.path[m.path.length - 1] !== tileOf(ty) * WW + tileOf(tx)) { m.path = astar(r, tileOf(m.x), tileOf(m.y), tileOf(tx), tileOf(ty)); m.pathT = 900; }
    if (m.path && m.path.length > 1) { const nxt = m.path[1]; ax = (nxt % WW) * TILE + 8; ay = ((nxt / WW) | 0) * TILE + 8; if (dist(m.x, m.y, ax, ay) < 4) m.path.shift(); }
  }
  const a = Math.atan2(ay - m.y, ax - m.x); m.angle = a; m.dir = dirFromAngle(a);
  const hit = moveBody(r, m, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, 4, 'creature');
  if (hit) bashAhead(gs, m, a, now);
}
let offlineImpacts: Map<string, { name: string; before: number; after: number; destroyed: boolean }> | null = null;
let offlineStructureChange = 0;
function bashAhead(gs: GameState, m: Creature, a: number, now: number) {
  // Physical impact only: charge-capable trackers may batter a remembered obstruction,
  // and committed charges may hit it. Wandering and ordinary melee cannot.
  const canBash = m.elder ? !!m.knows : CREATURES[m.type]?.style === 'charge' && (m.state === 'attack' || m.knows?.kind === 'trace');
  const r = gs.run!; if (!canBash || (m.cd > 0 && m.state !== 'attack')) return; const tx = tileOf(m.x + Math.cos(a) * 10), ty = tileOf(m.y + Math.sin(a) * 10);
  const e = entsAt(r, tx, ty).find(e => e.kind === 'struct' && (STRUCTS[e.type!].block)); if (!e) return;
  const dmg = m.elder ? ELDERS[m.elder.key].dmg * 2 : CREATURES[m.type].dmg; const before = e.hp!; e.hp! = Math.max(0, before - dmg); m.cd = 900;
  if (offlineImpacts && (e.owner === undefined || e.owner === 'player')) { const prior = offlineImpacts.get(e.id); offlineImpacts.set(e.id, { name: STRUCTS[e.type!].name, before: prior?.before ?? before, after: e.hp!, destroyed: e.hp! <= 0 }); }
  (m as any).prov = true; // R5 law: battering a structure is hostility to the home — same eligibility source as being damaged.
  receipt(r, now, 'struct.hit', `${e.id}:${m.type}:${before - e.hp!}`); fx('structhit', { x: e.x, y: e.y, n: before - e.hp! });
  if (e.hp! <= 0) { if (offlineImpacts) offlineStructureChange++; destroyStructure(r, e, now); receipt(r, now, 'struct.destroyed', `${e.type} by ${m.type}`); pushLog(r, now, `${STRUCTS[e.type!].name} was smashed by a ${CREATURES[m.type]?.name || 'beast'}!`, 'red'); fx('structbreak', { x: e.x, y: e.y }); }
}

/** Spikes and their own wear are committed only on actual tile contact. */
function triggerSpikes(gs: GameState, m: Creature, now: number) {
  const r = gs.run!, trap = entsAt(r, tileOf(m.x), tileOf(m.y)).find(e => e.type === 'spikes' && (e.hp ?? 0) > 0);
  if (!trap || m.cd > 0) return;
  damageCreature(gs, m, 12, 0, now, 0); m.cd = 700; const before = trap.hp!; trap.hp = Math.max(0, before - 4);
  if (offlineImpacts && (trap.owner === undefined || trap.owner === 'player')) { const prior = offlineImpacts.get(trap.id); offlineImpacts.set(trap.id, { name: STRUCTS[trap.type!].name, before: prior?.before ?? before, after: trap.hp, destroyed: trap.hp <= 0 }); }
  if (trap.hp <= 0) { if (offlineImpacts) offlineStructureChange++; destroyStructure(r, trap, now); receipt(r, now, 'struct.destroyed', `${trap.type} by contact`); }
}

/** B02-P1-B bear trap: live only (never during offline settlement), one paid hit per arming, then spent or worn. */
export function triggerBearTrap(gs: GameState, m: Creature, now: number) {
  if (offlineImpacts || m.state === 'dead' || m.state === 'sleep' || m.cd > 0) return;
  const r = gs.run!, trap = entsAt(r, tileOf(m.x), tileOf(m.y)).find(e => e.type === 'bear_trap' && e.bearTrap?.state === 'armed' && (e.hp ?? 0) > 0);
  if (!trap || !trap.bearTrap) return;
  const b = BAL.bearTrapV1;
  damageCreature(gs, m, b.damage, 0, now, 0); m.cd = b.stunMs;
  trap.bearTrap.uses -= 1; trap.bearTrap.state = trap.bearTrap.uses > 0 ? 'spent' : 'worn'; trap.bearTrap.snapAt = now;
  trap.hp = Math.max(0, (trap.hp ?? 0) - b.wearPerTrigger);
  receipt(r, now, 'trap.trigger', `${trap.id}:${m.id}:uses${trap.bearTrap.uses}`);
  if (trap.hp <= 0) { destroyStructure(r, trap, now); receipt(r, now, 'struct.destroyed', 'bear_trap by use'); }
}

/** A footprint's direction can lead to a physically adjacent blocking structure.
 * This never inspects unseen successors or a home location. */
function traceBarrier(r: RunState, m: Creature) {
  const k = m.knows; if (!k || k.kind !== 'trace' || CREATURES[m.type]?.style !== 'charge') return null;
  const tr = r.traces.find(t => t.id === k.traceId && t.chainId === k.chainId && t.life > 0);
  if (!tr || !Number.isFinite(tr.a)) return null;
  const dx = Math.cos(tr.a), dy = Math.sin(tr.a), grid = blockGrid(r);
  // R5-SIM1: bounded forward scan — the first blocking cell along the evidence ray, up to 64px (4 tiles).
  // The old 18px window could never find a wall sitting behind a natural gap between footprint and obstacle.
  for (let d = 2; d <= 64; d += 2) {
    const x = tr.x + dx * d, y = tr.y + dy * d, tx = tileOf(x), ty = tileOf(y), b = grid[ty * WW + tx];
    if (!b || b === 4) continue;
    if (b !== 3) return null;
    const e = entsAt(r, tx, ty).find(e => e.kind === 'struct' && STRUCTS[e.type!]?.block && !(e.type!.startsWith('door') && e.open));
    if (!e || dist(m.x, m.y, x, y) > 26 || !clearPhysicalLine(r, m, { x, y }, true, true)) return null;
    return { x, y };
  }
  return null;
}
function trackEvidence(gs: GameState, m: Creature, speed: number, dt: number, now: number) {
  const r = gs.run!, k = m.knows; if (!k || k.kind !== 'trace') return;
  if (!r.traces.some(tr => tr.id === k.traceId && tr.chainId === k.chainId && tr.life > 0)) {
    m.traceIgnore = k.chainId; m.knows = null; m.state = 'wander'; m.path = null; return;
  }
  if (dist(m.x, m.y, k.x, k.y) >= 7) { steer(gs, m, k.x, k.y, speed * 0.8, dt, now); return; }
  const nxt = nextContiguousTrace(r.traces, k);
  if (nxt && nxt.t <= now && dist(m.x, m.y, nxt.x, nxt.y) <= BAL.ai.traceSenseRadius && los(r, m.x, m.y, nxt.x, nxt.y, true)) {
    m.knows = { kind: 'trace', x: nxt.x, y: nxt.y, at: nxt.t, traceId: nxt.id, chainId: nxt.chainId }; return;
  }
  // The terminal footprint may point at a real obstacle. Resolve the barrier first and close on it;
  // a committed contact stops the advance and resolves as a bash. The old order let the creature
  // ping-pong forever at dist ~2-3 from the anchor without ever registering the wall.
  const barrier = traceBarrier(r, m);
  if (barrier) {
    const a = Math.atan2(barrier.y - m.y, barrier.x - m.x); m.angle = a; m.dir = dirFromAngle(a);
    if (moveBody(r, m, Math.cos(a) * speed * 0.8 * dt, Math.sin(a) * speed * 0.8 * dt, 4, 'creature')) bashAhead(gs, m, a, now);
    return;
  }
  // Close on the already-sensed mark before deciding it is lost.
  if (dist(m.x, m.y, k.x, k.y) >= 2) { steer(gs, m, k.x, k.y, speed * 0.8, dt, now); return; }
  m.traceIgnore = k.chainId; m.knows = null; m.path = null; m.state = 'wander'; fx('lost', { x: m.x, y: m.y - 10 });
}
function encounteredTrace(r: RunState, m: Creature, now: number) {
  let best: RunState['traces'][number] | undefined;
  for (const tr of r.traces) {
    if (tr.life <= 0 || tr.t > now || !tr.id || !tr.chainId || tr.chainId === m.traceIgnore || dist(tr.x, tr.y, m.x, m.y) > BAL.ai.traceSenseRadius || !los(r, m.x, m.y, tr.x, tr.y, true)) continue;
    if (!best || tr.t > best.t) best = tr;
  }
  return best;
}
/** Find a reachable cardinal approach cell; the physical crate itself is solid. */
function stimulusApproach(r:RunState,m:Creature,x:number,y:number):{x:number;y:number}|null {
  const tx=tileOf(x),ty=tileOf(y),grid=blockGrid(r),options:{x:number;y:number;length:number}[]=[];
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=tx+dx,ny=ty+dy;if(nx<1||ny<1||nx>=WW-1||ny>=WH-1)continue;const b=grid[ny*WW+nx];if(b!==0&&b!==4)continue;const path=astar(r,tileOf(m.x),tileOf(m.y),nx,ny);if(path)options.push({x:nx*TILE+8,y:ny*TILE+8,length:path.length});}
  options.sort((a,b)=>a.length-b.length||a.y-b.y||a.x-b.x);return options[0]||null;
}
function endInvestigation(r:RunState,m:Creature,now:number,reason:string){const id=m.knows?.sourceId;m.knows=null;delete m.stimulusRouteAt;m.path=null;m.pathT=0;m.state='wander';m.t=0;m.tx=m.x;m.ty=m.y;receipt(r,now,'stimulus.lost',`${m.id}:${id}:${reason}`);fx('lost',{x:m.x,y:m.y-10});}
function noticeStimulus(r:RunState,m:Creature,now:number) {
  if(m.elder||m.knows||m.state==='sleep'||!['idle','wander','track','chase'].includes(m.state)||m.hp<=0)return;
  const hearing=(BAL.worldStimulusV1.hearing as Record<string,number>)[m.type]||0;if(!hearing)return;
  for(const s of r.worldStimuli||[]){if(now<s.at||now>=s.expiresAt||m.stimulusIgnore===s.sourceId||dist(m.x,m.y,s.x,s.y)>s.range*hearing||!clearPhysicalLine(r,m,s,false,true))continue;
    const goal=stimulusApproach(r,m,s.x,s.y);if(!goal)continue;
    m.stimulusIgnore=s.sourceId;m.knows={kind:'stimulus',x:s.x,y:s.y,at:s.at,sourceId:s.sourceId,eventIndex:s.eventIndex,expiresAt:s.at+BAL.worldStimulusV1.memoryMs,goalX:goal.x,goalY:goal.y};m.state='track';m.path=null;m.t=0;
    receipt(r,now,'stimulus.notice',`${m.id}:${s.id}`);return;
  }
}
function investigateStimulus(gs:GameState,m:Creature,speed:number,dt:number,now:number) {
  const r=gs.run!,k=m.knows;if(!k||k.kind!=='stimulus')return;
  if(now>=k.expiresAt!){endInvestigation(r,m,now,'expired');return;}
  const goalCell=tileOf(k.goalY!)*WW+tileOf(k.goalX!),grid=blockGrid(r);
  if(grid[goalCell]!==0 && grid[goalCell]!==4){const next=stimulusApproach(r,m,k.x,k.y);if(!next){endInvestigation(r,m,now,'blocked');return;}k.goalX=next.x;k.goalY=next.y;m.path=null;}
  if(dist(m.x,m.y,k.goalX!,k.goalY!)<=BAL.worldStimulusV1.arrivalPixels){endInvestigation(r,m,now,'arrived');return;}
  // Recheck reachability when geometry changes; never bash a home for an event.
  if(now >= (m.stimulusRouteAt||0)){if(!astar(r,tileOf(m.x),tileOf(m.y),tileOf(k.goalX!),tileOf(k.goalY!))){endInvestigation(r,m,now,'unreachable');return;}m.stimulusRouteAt=now+900;}
  steer(gs,m,k.goalX!,k.goalY!,speed*BAL.worldStimulusV1.speedMultiplier,dt,now);
}

/** Only established local evidence is simulated outside the active player area. */
function traceOnly(gs: GameState, m: Creature, dtMs: number, now: number): 'advanced' | 'defer' | 'done' {
  const r = gs.run!, p = r.player, d = CREATURES[m.type];
  if ((m.frozenUntil||0)>now || (m.rootedUntil||0)>now) return 'done';
  // A knockback impulse is an impulse, not a state: live play integrates it in place
  // (moveBody + 0.82/tick decay). Offline must do the same, or any hit taken — e.g. a
  // turret arrow — would otherwise freeze the creature out of the world forever.
  if (Math.abs(m.kbx) + Math.abs(m.kby) > 1) {
    moveBody(r, m, (m.kbx * dtMs) / 1000, (m.kby * dtMs) / 1000, 4, 'creature');
    m.kbx *= 0.82; m.kby *= 0.82;
    return 'advanced';
  }
  if (!d || m.elder || !['idle', 'wander', 'track', 'chase'].includes(m.state) || (m.knows && m.knows.kind !== 'trace')) return 'defer';
  // Player combat and in-flight effects require the full actor simulation, not a guess.
  const sight = (darkness(r, now) > 0.45 ? BAL.ai.sightNight : BAL.ai.sightDay) * (d.sight / 100) * (weatherAt(r, now) === 'fog' ? 0.6 : 1) * (p.sheltered ? 0.5 : 1);
  if (!p.dead && dist(m.x, m.y, p.x, p.y) < sight && los(r, m.x, m.y, p.x, p.y)) return 'defer';
  if (r.combat && (r.combat.projectiles.length || r.combat.hazards.length)) return 'defer';
  for (const key in r.sources) { const st = r.sources[key]; if (st.fire && st.fire > r.clock.simMs && dist(m.x, m.y, (+key % WW) * TILE + 8, Math.floor(+key / WW) * TILE + 8) < 26) return 'defer'; }
  const tr = m.knows?.kind === 'trace' ? null : encounteredTrace(r, m, now);
  if (!m.knows && !tr) return 'done';
  m.cd = Math.max(0, m.cd - dtMs); m.t += dtMs; if (m.slow) m.slow = Math.max(0, m.slow - dtMs);
  triggerSpikes(gs, m, now); triggerBearTrap(gs, m, now); if (m.state === 'dead') return 'done';
  const aggro = d.aggro || isRagnarok(r, now) || (m as any).prov || (darkness(r, now) > 0.45 && m.type === 'boar');
  if (!m.knows && tr && aggro) { m.knows = { kind: 'trace', x: tr.x, y: tr.y, at: tr.t, traceId: tr.id, chainId: tr.chainId }; m.state = 'track'; }
  if (m.knows?.kind === 'trace') trackEvidence(gs, m, d.speed * (isRagnarok(r, now) ? 1.2 : 1) * (m.slow ? 0.45 : 1), dtMs / 1000, now);
  return 'advanced';
}

function tickCreatures(gs: GameState, dtMs: number, now: number) {
  const r = gs.run!; const p = r.player; const dt = dtMs / 1000; const ACT = BAL.ai.activeRadiusTiles * TILE;
  const night = darkness(r, now) > 0.45; const rag = isRagnarok(r, now); const w = weatherAt(r, now);
  const g = blockGrid(r);
  for (let i = r.creatures.length - 1; i >= 0; i--) {
    const m = r.creatures[i];
    if (m.state === 'dead') { m.t += dtMs; if (!m.elder && m.t > 1600) r.creatures.splice(i, 1); continue; }
    if ((m.frozenUntil||0)>now || (m.rootedUntil||0)>now) continue;
    const dp = dist(m.x, m.y, p.x, p.y); if (dp > ACT) { if (m.offlineUnresolvedAt === undefined && (m.knows?.kind === 'trace' || (!m.knows && encounteredTrace(r, m, now)))) { if (traceOnly(gs, m, dtMs, now) === 'defer') m.offlineUnresolvedAt = now - dtMs; } continue; }
    delete m.offlineUnresolvedAt; // resume from the last justified checkpoint in live play
    m.cd = Math.max(0, m.cd - dtMs); m.flash = Math.max(0, m.flash - dtMs); m.t += dtMs; if (m.slow) m.slow = Math.max(0, m.slow - dtMs);
    if (m.atk?.tuck) m.atk.tuck -= dtMs; if (m.atk?.vuln) m.atk.vuln -= dtMs;
    if (Math.abs(m.kbx) + Math.abs(m.kby) > 1) { moveBody(r, m, m.kbx * dt, m.kby * dt, 4, 'creature'); m.kbx *= 0.82; m.kby *= 0.82; }
    if (m.elder) { tickElder(gs, m, dtMs, now, dp); continue; }
    const d = CREATURES[m.type]; const spd = d.speed * (rag ? 1.2 : 1) * (m.slow ? 0.45 : 1);
    // spike traps
    triggerSpikes(gs, m, now); triggerBearTrap(gs, m, now); if (m.hp <= 0) continue;
    // in water? creatures avoid deep water — stuck ones wade
    const aggro = d.aggro || rag || (m as any).prov || (night && m.type === 'boar');
    // sensing
    const sight = (night ? BAL.ai.sightNight : BAL.ai.sightDay) * (d.sight / 100) * (w === 'fog' ? 0.6 : 1) * (p.sheltered ? 0.5 : 1);
    const seesPlayer = observePlayer(r, m, now, sight, aggro);
    if (!seesPlayer && aggro && (!m.knows || m.knows.kind==='stimulus') && ['idle', 'wander', 'track', 'chase'].includes(m.state) && (m.t % 500) < dtMs) {
      // Independent encounter: live, identified mark in circular range and line of sight.
      const R = BAL.ai.traceSenseRadius; let best: RunState['traces'][number] | undefined;
      for (const tr of r.traces) { if (tr.life <= 0 || tr.t > now || !tr.id || !tr.chainId || tr.chainId === m.traceIgnore || dist(tr.x, tr.y, m.x, m.y) > R || !los(r, m.x, m.y, tr.x, tr.y, true)) continue; if (!best || tr.t > best.t) best = tr; }
      if (best) { fx('sniff', { x: m.x, y: m.y - 10 }); m.knows = { kind: 'trace', x: best.x, y: best.y, at: best.t, traceId: best.id, chainId: best.chainId }; m.state = 'track'; }
    }
    if (!seesPlayer && !m.knows) noticeStimulus(r,m,now);
    if (m.knows?.kind === 'trace' && !r.traces.some(tr => tr.id && tr.id === m.knows!.traceId && tr.chainId === m.knows!.chainId && tr.life > 0)) { m.traceIgnore = m.knows.chainId; m.knows = null; if (m.state === 'track') m.state = 'wander'; }
    // state machine
    switch (m.state) {
      case 'idle': case 'wander': case 'track': case 'chase': {
        if (m.knows) {
          if (m.knows.kind === 'sight') {
            m.state = 'chase'; const range = d.style === 'shoot' ? 110 : d.style === 'tongue' ? 74 : d.style === 'burrow' ? 100 : d.style === 'charge' ? 90 : d.style === 'lunge' ? 56 : 18;
            const target = m.knows; const knownDist = dist(m.x, m.y, target.x, target.y);
            if (seesPlayer && dp < range && m.cd <= 0 && los(r, m.x, m.y, p.x, p.y, d.style !== 'burrow')) { m.state = 'tell'; m.t = 0; m.angle = Math.atan2(p.y - m.y, p.x - m.x); if (d.style === 'burrow') m.atk = { ...(m.atk || {}), target: { x: p.x, y: p.y } }; m.dir = dirFromAngle(m.angle); fx('tell', { x: m.x, y: m.y - 10, style: d.style }); }
            else if (d.style === 'shoot' && knownDist < 70) steer(gs, m, m.x - (target.x - m.x), m.y - (target.y - m.y), spd, dt, now);
            else if (d.style === 'lunge' && knownDist < 70) { const a = Math.atan2(m.y - target.y, m.x - target.x) + 0.9 * dt * 2; steer(gs, m, target.x + Math.cos(a) * 46, target.y + Math.sin(a) * 46, spd, dt, now); }
            else steer(gs, m, target.x, target.y, spd, dt, now);
          } else if(m.knows.kind==='stimulus') {
            investigateStimulus(gs,m,spd,dt,now);
          } else {
            trackEvidence(gs, m, spd, dt, now);
          }
        } else {
          m.state = 'wander';
          if (dist(m.x, m.y, m.tx, m.ty) < 4 || m.t > 5000) { m.t = 0; const a = rngNext(r) * Math.PI * 2, rr = rngNext(r) * 70; m.tx = m.homeX + Math.cos(a) * rr; m.ty = m.homeY + Math.sin(a) * rr; const b = g[tileOf(m.ty) * WW + tileOf(m.tx)]; if (b) { m.tx = m.x; m.ty = m.y; } }
          steer(gs, m, m.tx, m.ty, spd * 0.35, dt, now);
          if (seesPlayer && (m.type === 'boar' || m.type === 'crab') && dp < 26 && !(m as any).prov && !night) { /* skittish */ steer(gs, m, m.x + (m.x - p.x), m.y + (m.y - p.y), spd * 0.6, dt, now); }
        }
        break;
      }
      case 'tell': {
        // Telegraph angle remains locked at the observed target.
        if (d.style === 'burrow' && !m.atk?.burrow) { m.atk = { ...(m.atk || {}), burrow: true, bt: 0, target: m.atk?.target || (m.knows?.kind === 'sight' ? { x: m.knows.x, y: m.knows.y } : { x: m.x, y: m.y }) }; }
        if (m.t >= d.tell) { m.state = 'attack'; m.t = 0; m.atk = { ...(m.atk || {}), hit: false };
          if (d.style === 'shoot') { PROJ.push({ x: m.x, y: m.y - 4, vx: Math.cos(m.angle) * 150, vy: Math.sin(m.angle) * 150, life: 1.6, dmg: d.dmg, from: 'enemy', kind: 'bolt', r: 3 }); fx('zap', { x: m.x, y: m.y }); }
          if (d.style === 'tongue') fx('tongue', { x: m.x, y: m.y, a: m.angle });
          if (d.style === 'burrow') { HAZ.push({ kind: 'circle', x: m.atk.target.x, y: m.atk.target.y, r: 18, t: 0, tell: 800, dur: 120, dmg: d.dmg, style: 'erupt', owner: m.id }); }
        }
        break;
      }
      case 'attack': {
        const st = d.style;
        if (st === 'charge' || st === 'lunge') {
          const dur = st === 'charge' ? 560 : 230, s2 = st === 'charge' ? 215 : 250;
          const blocked = moveBody(r, m, Math.cos(m.angle) * s2 * dt, Math.sin(m.angle) * s2 * dt, 4, 'creature');
          if (!m.atk.hit && dist(m.x, m.y, p.x, p.y) < d.r + 7 && los(r, m.x, m.y, p.x, p.y)) { m.atk.hit = true; hurtPlayer(gs, d.dmg, m.x, m.y, d.name, now, 200); }
          if (blocked && st === 'charge') { const tx = tileOf(m.x + Math.cos(m.angle) * 9), ty = tileOf(m.y + Math.sin(m.angle) * 9); const src = sourceAt(r, tx, ty, now);
            if (src && blockGrid(r)[ty * WW + tx] === 2 && src.def.mat === 'wood' && src.stock > 0) { harvestHit(gs, tx, ty, { wood: 4 }, now, m.x, m.y); fx('chip', { x: tx * TILE + 8, y: ty * TILE + 8, mat: 'wood' }); }
            bashAhead(gs, m, m.angle, now); m.state = 'recover'; m.t = -900; fx('stun', { x: m.x, y: m.y - 10 }); fx('shake', { m: 2 }); break; }
          if (m.t >= dur) { m.state = 'recover'; m.t = 0; }
        } else if (st === 'tongue') {
          if (!m.atk.hit && m.t > 60) { const len = 84; const px = p.x - m.x, py = p.y - m.y; const along = px * Math.cos(m.angle) + py * Math.sin(m.angle); const perp = Math.abs(-px * Math.sin(m.angle) + py * Math.cos(m.angle));
            if (along > 0 && along < len && perp < 8 && los(r, m.x, m.y, p.x, p.y)) { m.atk.hit = true; if (hurtPlayer(gs, d.dmg, m.x, m.y, d.name, now, 0)) { const a = Math.atan2(m.y - p.y, m.x - p.x); moveBody(r, p, Math.cos(a) * 26, Math.sin(a) * 26, 4, 'player'); } } }
          if (m.t >= 260) { m.state = 'recover'; m.t = 0; }
        } else if (st === 'burrow') {
          if (m.t < 900) steer(gs, m, m.atk.target.x, m.atk.target.y, 90, dt, now);
          if (m.t >= 950) { m.atk.burrow = false; m.state = 'recover'; m.t = 0; fx('emerge', { x: m.x, y: m.y }); }
        } else if (st === 'pinch') {
          if (!m.atk.hit && m.t > 40) { m.atk.hit = true; if (dist(m.x, m.y, p.x, p.y) < 22 && Math.abs(angDiff(Math.atan2(p.y - m.y, p.x - m.x), m.angle)) < 1.1 && los(r, m.x, m.y, p.x, p.y)) hurtPlayer(gs, d.dmg, m.x, m.y, d.name, now); fx('snip', { x: m.x + Math.cos(m.angle) * 10, y: m.y + Math.sin(m.angle) * 10 }); }
          if (m.t > 200) { m.state = 'recover'; m.t = 0; }
        } else { if (m.t > 300) { m.state = 'recover'; m.t = 0; } }
        break;
      }
      case 'recover': if (m.t > 650) { m.state = 'chase'; m.cd = 500 + rngNext(r) * 700; m.t = 0; } break;
      case 'sleep': break;
    }
  }
}

// ---------- Elders ----------
function tickElder(gs: GameState, m: Creature, dtMs: number, now: number, dp: number) {
  const r = gs.run!; const p = r.player; const e = m.elder!; const d = ELDERS[e.key]; const dt = dtMs / 1000;
  const awakePhase = phaseOf(r, now) === 'awakening';
  if (awakePhase && !e.awake) { e.awake = true; const f = m.hp / m.maxHp; m.maxHp = d.hpAwake; m.hp = Math.round(d.hpAwake * f); fx('banner', { text: `${d.name} AWAKENS`, sub: d.region }); pushLog(r, now, `Day 14: ${d.name} has awakened in ${d.region}.`, 'red'); }
  // Elders use the same observed/last-known model; existing ranges and patterns remain.
  const sightRange = m.state === 'sleep' ? (e.awake ? 120 : 56) : 230;
  const seesPlayer = observePlayer(r, m, now, sightRange, true);
  if (m.state === 'sleep') { if (seesPlayer) wakeElder(gs, m, now); return; }
  const leash = dist(m.x, m.y, m.homeX, m.homeY);
  // Submerge/dive is already committed: follow the stored cast target, not live coordinates.
  if (e.submerged) { const target = m.atk?.target || (m.knows?.kind === 'sight' ? m.knows : m); steer(gs, m, target.x, target.y, d.speed * 1.6, dt, now); if (m.t > (m.atk?.subT || 1300)) { e.submerged = false; m.t = 0; fx('emerge', { x: m.x, y: m.y, big: true }); } return; }
  if (m.state === 'tell') { if (m.t >= (m.atk?.tell || 700)) { m.state = 'recover'; m.t = 0; } return; }
  const target = m.knows?.kind === 'sight' ? m.knows : null;
  if (p.dead || !target || leash > 220) {
    steer(gs, m, m.homeX, m.homeY, d.speed, dt, now); if (leash < 10) { m.hp = Math.min(m.maxHp, m.hp + dtMs * 0.01); if (!target || p.dead) { m.state = 'sleep'; e.submerged = false; } } return;
  }
  const knownDist = dist(m.x, m.y, target.x, target.y);
  m.angle = Math.atan2(target.y - m.y, target.x - m.x); m.dir = dirFromAngle(m.angle);
  if (knownDist > 60) steer(gs, m, target.x, target.y, d.speed * (e.awake ? 1.25 : 1), dt, now); else if (knownDist < 30) steer(gs, m, m.x - (target.x - m.x), m.y - (target.y - m.y), d.speed * 0.6, dt, now);
  if (seesPlayer && dp < d.r + 10 && m.cd <= 0) { hurtPlayer(gs, d.dmg * 0.6, m.x, m.y, d.name, now, 220); m.cd = 700; }
  if (m.state === 'recover' && m.t < (e.awake ? 900 : 1500)) return;
  m.state = 'chase';
  if (!seesPlayer) return; // Never start a new aimed pattern through cover.
  const list = e.awake ? d.awakePatterns : d.patterns; const pat = list[e.pattern % list.length]; e.pattern += 1 + (rngNext(r) < 0.3 ? 1 : 0);
  castPattern(gs, m, pat, now);
}
function castPattern(gs: GameState, m: Creature, pat: string, now: number) {
  const r = gs.run!; const p = r.player; const e = m.elder!; const d = ELDERS[e.key]; const a = Math.atan2(p.y - m.y, p.x - m.x); const dmg = d.dmg * (e.awake ? 1.25 : 1);
  m.state = 'tell'; m.t = 0; m.atk = { tell: 800, pat }; fx('etell', { x: m.x, y: m.y, key: e.key, pat });
  const H = (h: Partial<Haz>) => HAZ.push({ kind: 'circle', x: m.x, y: m.y, t: 0, tell: 800, dur: 160, dmg, style: e.key, elder: e.key, owner: m.id, ...h } as Haz);
  const P = (ang: number, sp: number, kind: string, delay = 0, extra: Partial<Proj> = {}) => PROJ.push({ x: m.x, y: m.y - 6, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 2.2, dmg: dmg * 0.7, from: 'enemy', kind, r: 4, delay, ...extra });
  switch (pat) {
    case 'shardFan': for (let k = -3; k <= 3; k++) P(a + k * 0.2, 140, 'shard', 600); m.atk.tell = 700; break;
    case 'shardSpiral': for (let w = 0; w < 3; w++) for (let k = 0; k < 10; k++) P(k * Math.PI / 5 + w * 0.3, 110, 'shard', 600 + w * 320); m.atk.tell = 1500; break;
    case 'frostRing': H({ kind: 'ring', r: 110, tell: 750, dur: 900, effect: 'slow' }); m.atk.tell = 900; break;
    case 'icePillars': for (let k = 0; k < 6; k++) { const b = k / 6 * Math.PI * 2; H({ x: p.x + Math.cos(b) * 34, y: p.y + Math.sin(b) * 34, r: 9, tell: 850, dur: 100, effect: 'pillar' }); } m.atk.tell = 900; break;
    case 'fissure': H({ kind: 'line', angle: a, len: 180, w: 13, tell: 800, dur: 220, effect: 'burnline' }); break;
    case 'fissureTriple': for (const o of [-0.45, 0, 0.45]) H({ kind: 'line', angle: a + o, len: 170, w: 12, tell: 850, dur: 220, effect: 'burnline' }); m.atk.tell = 950; break;
    case 'slam': H({ r: 58, tell: 900, dur: 140, effect: 'knock' }); m.atk.tell = 1000; break;
    case 'meteors': for (let k = 0; k < 7; k++) H({ x: p.x + (rngNext(r) - 0.5) * 140, y: p.y + (rngNext(r) - 0.5) * 140, r: 16, tell: 900 + k * 150, dur: 120, effect: 'ignite', style: 'meteor' }); H({ x: p.x, y: p.y, r: 16, tell: 1000, dur: 120, effect: 'ignite', style: 'meteor' }); m.atk.tell = 900; break;
    case 'spitPools': for (let k = 0; k < 3; k++) H({ x: p.x + (rngNext(r) - 0.5) * 70, y: p.y + (rngNext(r) - 0.5) * 70, r: 20, tell: 900, dur: 100, effect: 'pool' }); break;
    case 'brood': for (let k = 0; k < 3; k++) { const c = mkCreature(r, 'toad', m.x + (k - 1) * 18, m.y + 16, 14); (c as any).prov = true; r.creatures.push(c); } fx('brood', { x: m.x, y: m.y }); m.atk.tell = 600; break;
    case 'submerge': case 'dive': e.submerged = true; m.state = 'chase'; m.t = 0; m.atk = { subT: 1300, target: { x: p.x, y: p.y } }; fx('submerge', { x: m.x, y: m.y }); setTimeoutHaz(gs, m, dmg); break;
    case 'tongueSweep': H({ kind: 'sweep', len: 120, w: 9, a0: a - 1.1, a1: a + 1.1, tell: 650, dur: 800 }); m.atk.tell = 1400; break;
    case 'rootLine': for (let k = 1; k <= 9; k++) H({ x: m.x + Math.cos(a) * k * 18, y: m.y + Math.sin(a) * k * 18, r: 10, tell: 500 + k * 70, dur: 260, effect: 'root', style: 'root' }); m.atk.tell = 1000; break;
    case 'seedBombs': for (let k = 0; k < 4; k++) H({ x: p.x + (rngNext(r) - 0.5) * 90, y: p.y + (rngNext(r) - 0.5) * 90, r: 20, tell: 1100, dur: 120, style: 'seed' }); break;
    case 'rootCage': { const cx = tileOf(p.x), cy = tileOf(p.y); const gap = Math.floor(rngNext(r) * 12); for (let k = 0; k < 12; k++) { if (k === gap) continue; const b = k / 12 * Math.PI * 2; H({ x: (cx + Math.round(Math.cos(b) * 3)) * TILE + 8, y: (cy + Math.round(Math.sin(b) * 3)) * TILE + 8, r: 7, tell: 800, dur: 80, effect: 'cage', style: 'root' }); } m.atk.tell = 900; break; }
    case 'drainTrees': { // heals from living trees nearby — player can deny by felling them (C05/C14 world interplay)
      let n = 0; const cx = tileOf(m.x), cy = tileOf(m.y);
      for (let y = cy - 7; y <= cy + 7 && n < 5; y++) for (let x = cx - 7; x <= cx + 7 && n < 5; x++) { const s = sourceAt(r, x, y, now); if (s && s.def.mat === 'wood' && s.def.tall && s.stock > 0 && !s.st?.burnt) { const st = r.sources[s.i] || (r.sources[s.i] = { stock: s.stock, hp: s.hp }); st.stock--; st.hp = Math.max(0, st.hp - s.def.hp / s.def.stock); if (st.stock <= 0) markDirty(); n++; fx('drain', { x0: x * TILE + 8, y0: y * TILE + 8, x1: m.x, y1: m.y }); } }
      m.hp = Math.min(m.maxHp, m.hp + n * 28); if (n) receipt(r, now, 'elder.drain', `${n} trees`); else fx('toast', { text: 'The Treant reaches for trees — but none stand near it.' }); m.atk.tell = 900; break; }
    case 'spit': for (let k = -1; k <= 1; k++) P(a + k * 0.25, 160, 'spit', 500); m.atk.tell = 600; break;
    case 'wave': H({ kind: 'wave', angle: a, len: 170, w: 12, tell: 700, dur: 1500, x: m.x - Math.cos(a) * 20, y: m.y - Math.sin(a) * 20 }); m.atk.tell = 900; break;
    case 'whirl': H({ r: 26, x: p.x, y: p.y, tell: 1200, dur: 200, effect: 'pull' }); m.atk.tell = 900; break;
    case 'beam': H({ kind: 'line', angle: a, len: rayLen(r, m.x, m.y, a, 230), w: 8, tell: 900, dur: 600, effect: 'dot', style: 'beam' }); m.atk.tell = 1500; break;
    case 'beamSweep': H({ kind: 'sweep', len: 200, w: 8, a0: a - 1.3, a1: a + 1.3, tell: 800, dur: 1600, style: 'beam' }); m.atk.tell = 2400; break;
    case 'mines': for (let k = 0; k < 4; k++) P(a + (k - 1.5) * 0.6, 45, 'mine', 300, { life: 5, homing: 1, r: 6 }); m.atk.tell = 500; break;
    case 'overload': H({ kind: 'ring', r: 70, tell: 900, dur: 700, style: 'steam' }); m.atk = { tell: 1000, vuln: 3200, pat }; fx('toast', { text: 'The Colossus vents and overheats — strike now!' }); break;
  }
}
function setTimeoutHaz(gs: GameState, m: Creature, dmg: number) { const p = gs.run!.player; HAZ.push({ kind: 'circle', x: p.x, y: p.y, r: 30, t: 0, tell: 1300, dur: 140, dmg, style: m.elder!.key, owner: m.id, effect: 'emergeAt' }); }

/** One shared targeting law for online frames and offline settlement — never a divergent copy. */
function turretTargets(r: RunState, e: Entity, now: number, active: number, range: number): Creature[] {
  const targets=r.creatures.filter(m=>m.state!=='dead' && m.state!=='sleep' && m.offlineUnresolvedAt===undefined && dist(m.x,m.y,r.player.x,r.player.y)<=active && dist(e.x,e.y,m.x,m.y)<=range && (CREATURES[m.type]?.aggro || (m as any).prov || isRagnarok(r,now)) && clearPhysicalLine(r,e,m,true,true));
  targets.sort((a,b)=>dist(e.x,e.y,a.x,a.y)-dist(e.x,e.y,b.x,b.y)); return targets;
}
function turretContactWindow(r: RunState, now: number): boolean {
  const active=BAL.ai.activeRadiusTiles*TILE; const range = weatherAt(r,now)==='fog' ? 60 : weatherAt(r,now)==='storm' ? 72 : 96;
  for (const e of Object.values(r.entities)) { if (!e.turret) continue; if (turretStatus(r,e)!=='Ready') continue; if (turretTargets(r,e,now,active,range).length) return true; }
  return false;
}
function tickTurrets(gs: GameState, dtMs: number, now: number) {
  const r=gs.run!, active=BAL.ai.activeRadiusTiles*TILE;
  for (const e of Object.values(r.entities)) { const t=e.turret; if (!t) continue; t.cooldown=Math.max(0,t.cooldown-dtMs); t.tracking=false; if (turretStatus(r,e)!=='Ready') continue;
    const range = weatherAt(r,now)==='fog' ? 60 : weatherAt(r,now)==='storm' ? 72 : 96;
    const targets=turretTargets(r,e,now,active,range); const m=targets[0]; if (!m) continue; t.tracking=true;
    const a=Math.atan2(m.y-e.y,m.x-e.x); t.angle=a; if (t.cooldown>0) continue;
    const sx=e.x+Math.cos(a)*12, sy=e.y+Math.sin(a)*12; if (blockedAtTurret(r,sx,sy)) continue;
    removeItem(r,e.c!,'arrow',1); t.cooldown=1000; PROJ.push({x:sx,y:sy,vx:Math.cos(a)*260,vy:Math.sin(a)*260,life:.5,dmg:16,from:'player',kind:'arrow',r:3});
    receipt(r,now,'turret.fire',`${e.id}:${m.id}`); fx('bowshot',{x:sx,y:sy,a}); fx('turretshot',{x:sx,y:sy,a});
  }
}
function blockedAtTurret(r: RunState,x:number,y:number) { const b=blockGrid(r)[tileOf(y)*WW+tileOf(x)]; return b===1||b===2||b===3||b===5; }

// ---------- projectiles & hazards ----------
function impactRock(gs:GameState,pr:Proj,now:number){if((pr as any).exploded)return;(pr as any).exploded=true;const r=gs.run!;for(const m of r.creatures)if(m.state!=='dead'&&dist(m.x,m.y,pr.x,pr.y)<BAL.creatorCoreEarthmother.rockRadius&&clearPhysicalLine(r,pr,m,true))damageCreature(gs,m,pr.dmg,Math.atan2(m.y-pr.y,m.x-pr.x),now,190);fx('chip',{x:pr.x,y:pr.y,mat:'stone'});}
function tickProj(gs: GameState, dtMs: number, now: number) {
  const r = gs.run!; const p = r.player; const dt = dtMs / 1000; const g = blockGrid(r);
  for (let i = PROJ.length - 1; i >= 0; i--) {
    const pr = PROJ[i];
    if (pr.delay && pr.delay > 0) { pr.delay -= dtMs; continue; }
    if (pr.homing && !p.dead && los(r, pr.x, pr.y, p.x, p.y, true)) { const a = Math.atan2(p.y - pr.y, p.x - pr.x); const sp = Math.hypot(pr.vx, pr.vy); pr.vx += (Math.cos(a) * sp - pr.vx) * dt * 1.5; pr.vy += (Math.sin(a) * sp - pr.vy) * dt * 1.5; }
    // Sweep the projectile: a fast shot cannot skip a one-cell wall in one frame.
    const ox = pr.x, oy = pr.y, nx = ox + pr.vx * dt, ny = oy + pr.vy * dt;
    const steps = Math.max(1, Math.ceil(dist(ox, oy, nx, ny) / 2)); let blocked = false, b = 0;
    for (let j = 1; j <= steps; j++) {
      const x = ox + (nx - ox) * j / steps, y = oy + (ny - oy) * j / steps;
      b = g[tileOf(y) * WW + tileOf(x)];
      if (b === 1 || b === 2 || b === 3 || b === 5 || !clearPhysicalLine(r, pr, { x, y }, true)) { blocked = true; break; }
      pr.x = x; pr.y = y;
    }
    if(pr.kind==='fire_tornado') { for(const m of r.creatures){if(m.state==='dead'||m.elder?.submerged||m.atk?.burrow||dist(m.x,m.y,pr.x,pr.y)>BAL.creatorCoreDragon.tornadoRadius||!los(r,m.x,m.y,pr.x,pr.y,true))continue;const a=Math.atan2(pr.y-m.y,pr.x-m.x);moveBody(r,m,Math.cos(a)*20*dt,Math.sin(a)*20*dt,5,'creature');if(now>=(m.tornadoNext||0)){m.tornadoNext=now+500;damageCreature(gs,m,pr.dmg,a,now,0);}}ignite(gs,tileOf(pr.x),tileOf(pr.y),now); }
    if (pr.kind === 'blast_signature') {
      const trailSteps=Math.max(1,Math.ceil(dist(ox,oy,pr.x,pr.y)/12));
      for(let k=1;k<=trailSteps;k++){const x=ox+(pr.x-ox)*k/trailSteps,y=oy+(pr.y-oy)*k/trailSteps;ignite(gs,tileOf(x),tileOf(y),now);HAZ.push({kind:'pool',x,y,r:8,t:0,tell:0,dur:BAL.creatorCoreBlast.signatureBurnMs,dmg:BAL.creatorCoreBlast.signatureBurnDamage,style:'burn',owner:'player'});}
    }
    pr.life -= dt; let dead = pr.life <= 0;
    if (pr.kind === 'blast_bomb' && blocked && !dead) { pr.vx=0; pr.vy=0; blocked=false; }
    if (blocked) { dead = true; if(pr.kind==='nature_rock')impactRock(gs,pr,now); else if (pr.kind === 'fireball' || pr.kind === 'blast_signature') explode(gs, pr, now); else fx('ping', { x: pr.x, y: pr.y, kind: pr.kind }); }
    else if (pr.from === 'enemy' && dist(pr.x, pr.y, p.x, p.y) < pr.r + 4) { dead = true; if (pr.kind === 'mine') { fx('boom', { x: pr.x, y: pr.y, small: true }); } hurtPlayer(gs, pr.dmg, pr.x - pr.vx, pr.y - pr.vy, 'projectile', now, 100); }
    else if (pr.from === 'player' && pr.kind !== 'blast_bomb' && pr.kind !== 'fire_tornado') { for (const m of r.creatures) { if (m.state === 'dead') continue; const rr = m.elder ? ELDERS[m.elder.key].r : 6; if (dist(pr.x, pr.y, m.x, m.y) < rr + pr.r) { dead = true; if(pr.kind==='nature_rock')impactRock(gs,pr,now); else if (pr.kind === 'fireball' || pr.kind === 'blast_signature') explode(gs, pr, now); else { damageCreature(gs, m, pr.dmg, Math.atan2(pr.vy, pr.vx), now, 80); if(pr.kind==='elsa_shard' && m.hp>0 && rngNext(r)<BAL.creatorCoreElsa.freezeChance)m.frozenUntil=now+BAL.creatorCoreElsa.enemyMs; } break; } } }
    if (dead && (pr.kind === 'fireball' || pr.kind === 'blast_signature') && pr.life <= 0) explode(gs, pr, now);
    if (dead && pr.kind === 'nature_rock') impactRock(gs,pr,now);
    if (dead && pr.kind === 'elsa_shard') {freezeAround(r,pr.x,pr.y,BAL.creatorCoreElsa.terrainMs);fx('cast',{x:pr.x,y:pr.y,core:'frost',a:0});}
    if (dead && pr.kind === 'blast_bomb' && pr.life <= 0) {
      explode(gs,pr,now); const base=rngNext(r)*Math.PI*2;
      for(let k=0;k<BAL.creatorCoreBlast.fragmentCount;k++){const angle=base+k*Math.PI*2/BAL.creatorCoreBlast.fragmentCount;PROJ.push({x:pr.x,y:pr.y,vx:Math.cos(angle)*120,vy:Math.sin(angle)*120,life:0.65,dmg:BAL.creatorCoreBlast.fragmentDamage,from:'player',kind:'blast_round',r:2});}
    }
    if (dead && pr.kind === 'mine' && pr.life <= 0) fx('boom', { x: pr.x, y: pr.y, small: true });
    if (dead) PROJ.splice(i, 1);
  }
}
function explode(gs: GameState, pr: Proj, now: number) {
  const r = gs.run!; if ((pr as any).exploded) return; (pr as any).exploded = true; fx('boom', { x: pr.x, y: pr.y }); fx('shake', { m: 4 });
  for (const m of r.creatures) if (m.state !== 'dead' && dist(pr.x, pr.y, m.x, m.y) < 30) damageCreature(gs, m, pr.dmg, Math.atan2(m.y - pr.y, m.x - pr.x), now, 160);
  const cx = tileOf(pr.x), cy = tileOf(pr.y); for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) ignite(gs, x, y, now);
}
function inHaz(h: Haz, x: number, y: number) {
  if (h.kind === 'circle' || h.kind === 'pool') return dist(x, y, h.x, h.y) < h.r!;
  if (h.kind === 'ring') { const prog = (h.t - h.tell) / h.dur; const rr = h.r! * Math.min(1, prog); const d = dist(x, y, h.x, h.y); return Math.abs(d - rr) < 9; }
  let a = h.angle!; if (h.kind === 'sweep') a = h.a0! + (h.a1! - h.a0!) * clamp((h.t - h.tell) / h.dur, 0, 1);
  let ox = h.x, oy = h.y; let len = h.len!;
  if (h.kind === 'wave') { const prog = (h.t - h.tell) / 1000 * 130; ox = h.x + Math.cos(h.angle!) * prog; oy = h.y + Math.sin(h.angle!) * prog; const px = x - ox, py = y - oy; const along = px * Math.cos(a) + py * Math.sin(a); const perp = -px * Math.sin(a) + py * Math.cos(a); return Math.abs(along) < h.w! && Math.abs(perp) < len / 2; }
  const px = x - ox, py = y - oy; const along = px * Math.cos(a) + py * Math.sin(a); const perp = Math.abs(-px * Math.sin(a) + py * Math.cos(a)); return along > 0 && along < len && perp < h.w! / 2 + 3;
}
function tickHaz(gs: GameState, dtMs: number, now: number) {
  const r = gs.run!; const p = r.player;
  for (let i = HAZ.length - 1; i >= 0; i--) {
    const h = HAZ[i]; if(h.expiresSimMs!==undefined && r.clock.simMs>=h.expiresSimMs){HAZ.splice(i,1);continue;} h.t += dtMs; if (h.t < h.tell) continue;
    const first = !h.done; h.done = true;
    if (first) onHazActivate(gs, h, now);
    if(h.owner==='player' && h.effect==='spiritBeam'){if(p.dead || (p.channelUntil||0)<=now){HAZ.splice(i,1);continue;}for(const m of r.creatures)if(m.state!=='dead'&&inHaz(h,m.x,m.y)&&clearPhysicalLine(r,h,m,true)&&now>=(m.beamHitNext||0)){m.beamHitNext=now+BAL.creatorCoreDemon.beamTickMs;if(damageCreature(gs,m,h.dmg,h.angle||0,now,0))fx('spiritHit',{x:m.x,y:m.y});}}
    else if(h.owner==='player' && h.effect==='mjolnirPull'){for(const m of r.creatures)if(m.state!=='dead'&&!m.elder?.submerged&&!m.atk?.burrow&&inHaz(h,m.x,m.y)&&clearPhysicalLine(r,h,m,true)){const a=Math.atan2(h.y-m.y,h.x-m.x),step=Math.min(dist(h.x,h.y,m.x,m.y),BAL.creatorCoreMjolnir.attractSpeed*dtMs/1000*(m.elder?0.15:1));moveBody(r,m,Math.cos(a)*step,Math.sin(a)*step,5,'creature');}}
    else if(h.owner==='player' && h.effect==='natureRoot'){for(const m of r.creatures)if(m.state!=='dead'&&!m.elder?.submerged&&!m.atk?.burrow&&inHaz(h,m.x,m.y)&&clearPhysicalLine(r,h,m,true)){m.rootedUntil=Math.max(m.rootedUntil||0,Math.min(now+150,now+Math.max(0,h.tell+h.dur-h.t)));if(now >= (m.rootHitNext||0)){m.rootHitNext=now+BAL.creatorCoreEarthmother.rootTickMs;damageCreature(gs,m,h.dmg,0,now,0);}}}
    else if (h.owner === 'player' && h.kind === 'pool' && h.style === 'burn') { h.tickAcc=(h.tickAcc||0)-dtMs; if(h.tickAcc<=0){h.tickAcc=500;for(const m of r.creatures)if(m.state!=='dead'&&inHaz(h,m.x,m.y)&&now >= (m.signatureBurnNext||0)){m.signatureBurnNext=now+500;damageCreature(gs,m,h.dmg,Math.atan2(m.y-h.y,m.x-h.x),now,10);}} }
    else if (h.owner === 'player') { if (first || h.kind === 'ring') for (const m of r.creatures) { if (m.state === 'dead' || (h as any)['h_' + m.id]) continue; if (inHaz(h, m.x, m.y)) { (h as any)['h_' + m.id] = 1; damageCreature(gs, m, h.dmg * (h.effect==='mjolnirStrike' && (isWet(weatherAt(r,now)) || [T.SHALLOW,T.RIVER].includes(effTile(r,tileOf(m.x),tileOf(m.y)))) ? BAL.creatorCoreMjolnir.wetMultiplier : 1), Math.atan2(m.y - h.y, m.x - h.x), now, 90); if (h.effect === 'slowm') m.slow = 3000; } } }
    else {
      const dot = h.kind === 'pool' || h.effect === 'dot' || h.kind === 'sweep' || h.style === 'burn';
      if (dot) { h.tickAcc = (h.tickAcc || 0) - dtMs; if (h.tickAcc <= 0 && inHaz(h, p.x, p.y)) { h.tickAcc = h.kind === 'pool' ? 500 : 220; hurtPlayer(gs, h.kind === 'pool' ? 5 : h.dmg * 0.45, h.x, h.y, h.elder ? ELDERS[h.elder].name : 'hazard', now, 30); if (h.kind === 'pool') p.rad = Math.min(100, p.rad + 4); } }
      else if (!h.hit && inHaz(h, p.x, p.y)) { if (hurtPlayer(gs, h.dmg, h.x, h.y, h.elder ? ELDERS[h.elder].name : 'hazard', now, h.effect === 'knock' ? 320 : 140)) { h.hit = true; if (h.effect === 'slow') slowTimer = 2200; if (h.effect === 'root') rootTimer = 900; if (h.effect === 'pull') { const a = Math.atan2(h.y - p.y, h.x - p.x); moveBody(r, p, Math.cos(a) * 14, Math.sin(a) * 14, 4, 'player'); } } }
    }
    if (h.t >= h.tell + h.dur) HAZ.splice(i, 1);
  }
}
function onHazActivate(gs: GameState, h: Haz, now: number) {
  const r = gs.run!;
  fx('hazfire', { x: h.x, y: h.y, style: h.style, kind: h.kind, r: h.r, angle: h.angle, len: h.len });
  if(h.effect==='mjolnirStrike'){fx('lightning',{x:h.x,y:h.y});receipt(r,now,'core.mjolnir.strike',`${h.x},${h.y}`);}
  if (h.effect === 'quake') { const res = harvestHit(gs, tileOf(h.x), tileOf(h.y), { stone: 6, ore: 5 }, now, h.x, h.y); if (res.result === 'yield') fx('chip', { x: h.x, y: h.y, mat: res.mat }); }
  if (h.effect === 'ignite' || h.effect === 'burnline') { if (h.kind === 'line') { for (let d = 10; d < h.len!; d += 14) { const x = h.x + Math.cos(h.angle!) * d, y = h.y + Math.sin(h.angle!) * d; ignite(gs, tileOf(x), tileOf(y), now); } HAZ.push({ ...h, t: 0, tell: 0, dur: 3000, style: 'burn', effect: undefined, done: false, hit: false, dmg: 10 }); } else ignite(gs, tileOf(h.x), tileOf(h.y), now); }
  if (h.effect === 'flameLine') for(let d=10;d<(h.len||0);d+=14) ignite(gs,tileOf(h.x+Math.cos(h.angle!)*d),tileOf(h.y+Math.sin(h.angle!)*d),now);
  if (h.effect === 'meteorBurn') { ignite(gs,tileOf(h.x),tileOf(h.y),now); HAZ.push({kind:'pool',x:h.x,y:h.y,r:h.r,t:0,tell:0,dur:BAL.creatorCoreMeteor.burnMs,dmg:BAL.creatorCoreMeteor.burnDamage,style:'burn',owner:'player'}); }
  if (h.effect === 'pool') HAZ.push({ kind: 'pool', x: h.x, y: h.y, r: h.r, t: 0, tell: 0, dur: 6500, dmg: 5, style: 'pool', owner: h.owner, done: false });
  if (h.effect === 'pillar' || h.effect === 'cage') { const tx = tileOf(h.x), ty = tileOf(h.y); const t = effTile(r, tx, ty); const p = r.player;
    if (![T.DEEP, T.PWALL, T.CLIFF].includes(t) && !(tileOf(p.x) === tx && tileOf(p.y) === ty)) { r.terrain[ty * WW + tx] = { t: T.PWALL, until: r.clock.simMs + (h.effect === 'cage' ? 7000 : 11000), ...({ by: h.elder } as any) }; markDirty(); } }
  if (h.effect === 'emergeAt') { const m = r.creatures.find(c => c.id === h.owner); if (m) { m.x = h.x; m.y = h.y; if (m.elder) m.elder.submerged = false; fx('emerge', { x: h.x, y: h.y, big: true }); fx('shake', { m: 4 }); } }
  if (h.style === 'meteor' || h.effect === 'knock') fx('shake', { m: 3 });
}

// ---------- survival & environment ----------
function tickSurvival(gs: GameState, dtMs: number, now: number) {
  const r = gs.run!; const p = r.player; if (p.dead) return; const B = BAL.player; const min = dtMs / 60000; const w = getWorld();
  const tx = tileOf(p.x), ty = tileOf(p.y); const t = effTile(r, tx, ty); const zone = w.zone[ty * WW + tx]; const weather = weatherAt(r, now);
  shelterAcc += dtMs; if (shelterAcc > 400) { shelterAcc = 0; p.sheltered = isSheltered(r, p.x, p.y); }
  p.hunger = Math.max(0, p.hunger - B.hungerDrainPerMin * min);
  p.thirst = Math.max(0, p.thirst - B.thirstDrainPerMin * min * (zone === 6 ? 1.9 : 1));
  // K5/K8 (Bible): a sheltered player is never killed by hunger ALONE (1 HP floor). Thirst and any other cause still kill.
  const thirstyNow = p.thirst <= 0, hungryNow = p.hunger <= 0, hungerOnlyShelter = hungryNow && !thirstyNow && p.sheltered;
  if ((p.iceUntil||0)<=now && (thirstyNow || hungryNow)) { if (hungerOnlyShelter) p.hp = Math.max(1, p.hp - B.starveDamagePerMin * min); else { p.hp -= B.starveDamagePerMin * min; if (p.hp <= 0) { killPlayer(gs, now, hungryNow ? 'starvation' : 'thirst'); return; } } }
  // warmth: shared physical evaluator (B03-A). Same target and integrator as offline settle.
  const thermal = thermalEvaluate(r, thermalEnv(r, { x: p.x, y: p.y, zone, tileType: t, wet: isWet(weather), dark: darkness(r, now) > 0.45, sheltered: p.sheltered }));
  p.warmth = thermalStep(p.warmth, thermal.target, min);
  if ((p.iceUntil||0)<=now && coldDamageActive(p.warmth)) { p.hp -= B.coldDamagePerMin * min; if (p.hp <= 0) { killPlayer(gs, now, 'cold'); return; } }
  // radiation
  const mask = C(r, 'eq').slots.some(s => s && ITEMS[s.key].mask);
  if (t === T.TOXIC || (zone === 7 && t === T.FLOOR)) p.rad = Math.min(100, p.rad + (mask ? 0.8 : 7) * min); else p.rad = Math.max(0, p.rad - 1.5 * min);
  if ((p.iceUntil||0)<=now && p.rad > 50) { p.hp -= B.radDamagePerMinOver50 * min * (p.rad / 50); if (p.hp <= 0) { killPlayer(gs, now, 'radiation'); return; } }
  // lava heat
  let lava = false; for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (effTile(r, x, y) === T.LAVA) lava = true;
  if (lava && (r.clock.simMs % 700) < dtMs) hurtPlayer(gs, 5, p.x, p.y + 10, 'lava', now, 60);
  if (p.hunger > 60 && p.thirst > 60 && p.rad < 30 && p.warmth > 30) p.hp = Math.min(B.maxHp, p.hp + 1.2 * min * 10 / 10 * 4);
}

/** Advance existing autonomous helpers at weather and finite fire/terrain boundaries.
 * Physical actors, spread, damage, lightning and player input are deliberately not replayed. */
function advanceWorld(gs: GameState, start: number, end: number, report?: string[], visual = true) {
  const r = gs.run!; let t = start; const slotMs = BAL.weather.slotMinutes * 60000;
  initializeCabinets(r);
  const syncPoi=(at:number)=>{const events=advancePoiAccess(r,at);if(events.closed.length)markDirty();for(const id of events.expired)receipt(r,at,'poi.power.expire',id);for(const id of events.closed)receipt(r,at,'poi.door.close',id);};
  const syncHome=(at:number)=>{for(const id of syncElectricDoors(r,at,visual))receipt(r,at,'circuit.door.close',id);};
  const syncDrops=(at:number)=>{const before=new Set((r.worldStimuli||[]).map(s=>s.id));stepAirdrops(r,at,report);if(visual)for(const s of r.worldStimuli||[])if(!before.has(s.id)&&dist(r.player.x,r.player.y,s.x,s.y)<=s.range&&clearPhysicalLine(r,r.player,s,false,true))fx('airdropImpact',{x:s.x,y:s.y});};
  syncPoi(t); syncHome(t);
  resolveFires(gs, t, visual);
  stepLootRespawn(r, t);
  syncDrops(t);
  stepNatureTrees(r,t);
  while (t < end) {
    // Commit already-finished jobs first; their next jobs determine the next boundary.
    stepStations(gs, 0, t, report);
    stepTenders(gs, t);
    stepTenderStates(r, t);
    const weather = weatherAt(r, t);
    const slot = Math.floor((t - r.startedAt + r.qaOffset) / slotMs);
    const nextWeather = r.startedAt - r.qaOffset + (slot + 1) * slotMs;
    let dt = Math.min(end - t, nextWeather - t);
    const powered=new Set(Object.values(r.entities).filter(e=>e.basePower).flatMap(g=>powerAllocation(r,g,visual).filter(e=>e.industrial).map(e=>e.id)));
    for (const e of Object.values(r.entities)) {
      const st = e.station; if (!st) continue; const kind = e.kind==='recycler'?'recycler':STRUCTS[e.type!].station; const job = st.queue[0];
      const fuelled = kind === 'campfire' || kind === 'furnace';
      if (kind === 'furnace' && (!job || job.left <= 0)) continue;
      if (!job && kind !== 'campfire') continue;
      let fuel = st.burn;
      // W07: boundary uses the same burnable rule as stepStations (canisters are never station fuel).
      if (fuelled && fuel <= 0) { const next = C(r, st.fuelC).slots.find(s => s && stationBurnable(s.key)); if (!next) continue; fuel = ITEMS[next.key].fuel! * 1000; }
      if (fuelled) dt = Math.min(dt, fuel);
      if (job && job.left > 0) dt = Math.min(dt, job.left / (powered.has(e.id) ? BAL.industrialPower.workSpeedMultiplier : 1));
    }
    dt = airdropBoundary(r,t,dt);
    dt = basePowerBoundary(r, dt, visual);
    dt = territoryBoundary(r, dt);
    dt = tenderBoundary(r, isWet(weather), dt);
    for (const tree of r.natureTrees||[]) if(tree.until>r.clock.simMs)dt=Math.min(dt,tree.until-r.clock.simMs);
    for(const e of Object.values(r.entities)){if(e.poiPower&&e.power===1&&e.poiPower.expiresAt>t)dt=Math.min(dt,e.poiPower.expiresAt-t);if(e.open&&e.poiDoor&&e.poiDoor.closeAt>t)dt=Math.min(dt,e.poiDoor.closeAt-t);if(e.open&&e.electricDoor?.releaseUntil&&e.electricDoor.releaseUntil>t)dt=Math.min(dt,e.electricDoor.releaseUntil-t);}
    for (const due of Object.values(r.lootRespawnAt || {})) if (due > t) dt = Math.min(dt, due - t);
    for (const st of Object.values(r.sources)) { if (st.fire && st.fire > r.clock.simMs) dt = Math.min(dt, st.fire - r.clock.simMs); if(st.fireSpreadAt && st.fireSpreadAt > r.clock.simMs) dt = Math.min(dt, st.fireSpreadAt - r.clock.simMs); }
    for (const terrain of Object.values(r.terrain)) if (terrain.until && terrain.until > r.clock.simMs) dt = Math.min(dt, terrain.until - r.clock.simMs);
    if (!(dt > 0)) break;
    dt = Math.min(end - t, Math.max(dt, 0.001)); // avoid sub-millisecond timestamp stalls
    stepBasePower(r, dt, t + dt, visual);
    stepStations(gs, dt, t + dt, report, powered);
    stepGardensBarrels(gs, dt, isWet(weather));
    decayTraces(r, dt, weather);
    if(stepTerritory(r,dt,t+dt,report)) offlineStructureChange++;
    r.clock.simMs += dt; t += dt;
    syncPoi(t); syncHome(t);
    // Offline time cannot confirm a fresh sighting or retain an expired mark.
    // Keep committed tells/attacks intact; they resume, not resolve speculatively.
    if (!visual) {
      const live = new Set(r.traces.filter(tr => tr.id && tr.chainId).map(tr => `${tr.chainId}:${tr.id}`));
      for (const m of r.creatures) {
        const k = m.knows;
        if (k && (k.kind === 'sight' ? t - k.at > 4000 : k.kind === 'trace' ? !k.traceId || !k.chainId || !live.has(`${k.chainId}:${k.traceId}`) : false)) {
          if (k.kind === 'trace') m.traceIgnore = k.chainId;
          m.knows = null; m.path = null;
          if (m.state === 'track' || m.state === 'chase') { m.state = 'wander'; m.t = 0; }
        }
      }
    }
    let dirty = false; for (const k in r.terrain) { const m = r.terrain[k]; if (m.until && m.until <= r.clock.simMs) { delete r.terrain[k]; dirty = true; } } if (dirty) markDirty();
    resolveFires(gs, t, visual);
    stepLootRespawn(r, t);
    syncDrops(t);
    stepNatureTrees(r,t);
  }
  stepTenders(gs, end);
  stepTenderStates(r, end);
}

/** Bring the single run clock forward before a frame or an input transaction. */
export function syncWorld(gs: GameState, now: number): boolean {
  const r = gs.run; if (!r || r.ended || now < r.clock.lastSimAt) return false;
  const expiry = r.startedAt - r.qaOffset + BAL.run.maxRunHours * HOUR;
  migrateLootRespawn(r, Math.min(now, expiry));
  if (now >= expiry) { settle(gs, now, true); if (gs.run) endRun(gs, 'expired', expiry); return false; }
  const activeStart = Math.max(r.clock.lastSimAt, now - 50);
  if (activeStart > r.clock.lastSimAt) settle(gs, activeStart, true, false);
  if (!gs.run || r.clock.lastSimAt < activeStart) return false;
  advanceWorld(gs, r.clock.lastSimAt, now);
  r.clock.lastSimAt = now;
  return true;
}

/** Collect only targets that can be physically brought to the final point.
 * The second impact debits precisely 20% of their then-current HP, bypassing
 * unrelated combat multipliers so the locked group-total remains exact. */
function tickDragonDive(gs: GameState, dtMs: number, now: number) {
  const r=gs.run!,d=r.dragonDive;if(!d)return;const b=BAL.creatorCoreDragon;
  // Pre-V14 saves retain their already-committed collection without minting
  // a second first-hit pass. New casts persist every route and hit receipt.
  if(d.phase==='traverse' && d.route && d.index!==undefined) {
    const q=d.route[d.index];if(!q){d.phase='gather';d.left=b.collectMs;}
    else {
      const from={x:d.dragonX!,y:d.dragonY!},target={x:q.x,y:q.y};
      if(!clearPhysicalLine(r,from,target,true)){d.index++;receipt(r,now,'core.dragon.blocked',q.id);return;}
      const distance=dist(from.x,from.y,target.x,target.y),step=Math.min(distance,b.traverseSpeed*dtMs/1000),a=Math.atan2(target.y-from.y,target.x-from.x);
      d.dragonX=from.x+Math.cos(a)*step;d.dragonY=from.y+Math.sin(a)*step;
      if(distance<=step+0.001){const m=r.creatures.find(m=>m.id===q.id);if(m&&m.hp>0&&m.state!=='dead'&&dist(m.x,m.y,q.x,q.y)<(m.elder?28:16)&&clearPhysicalLine(r,target,m,true)&&damageCreature(gs,m,b.firstDamage,a,now,0)){d.hitIds!.push(m.id);receipt(r,now,'core.dragon.first',m.id);}d.index++;}
      return;
    }
  }
  const eligibleIds=d.hitIds ?? d.ids;
  const selected=eligibleIds.map(id=>r.creatures.find(m=>m.id===id)).filter((m):m is Creature=>!!m&&m.state!=='dead'&&!m.elder?.submerged&&!m.atk?.burrow&&m.hp>0);
  if(d.phase!=='dive'){
    for(const m of selected){const a=Math.atan2(d.y-m.y,d.x-m.x),distance=dist(m.x,m.y,d.x,d.y),step=Math.min(distance,220*(m.elder?0.15:1)*dtMs/1000);if(clearPhysicalLine(r,m,d,true))moveBody(r,m,Math.cos(a)*step,Math.sin(a)*step,5,'creature');}
    d.left-=dtMs;if(d.left>0)return;
    if(d.phase==='gather'){d.phase='dive';d.left=b.diveMs;return;}
  }else {d.left-=dtMs;if(d.left>0)return;}
  const included=selected.filter(m=>dist(m.x,m.y,d.x,d.y)<=30&&clearPhysicalLine(r,m,d,true));
  const total=included.reduce((n,m)=>n+m.hp,0), fraction=b.impactFraction;
  for(const m of included){const hit=m.hp*fraction;m.hp-=hit;m.flash=120;(m as any).prov=true;fx('mhit',{x:m.x,y:m.y,n:hit,a:0,big:!!m.elder});}
  fx('boom',{x:d.x,y:d.y});fx('shake',{m:5});receipt(r,now,'core.dragon.impact',`${included.length}:${total}:${total*fraction}`);delete r.dragonDive;
}

// ---------- main tick ----------
export function tick(gs: GameState, inp: Input, dtMs: number, now: number) {
  const r = gs.run; if (!r || r.ended) return;
  bindCombat(r);
  dtMs = Math.max(0, Math.min(dtMs, 50));
  if (!syncWorld(gs, now)) { if (!gs.run) fx('banner', { text: 'The run has ended', sub: 'Ragnarok consumed the island.' }); return; }
  // Resting hands the online clock to the same chronological settlement used offline (no online drain while asleep).
  if (r.rest) { settle(gs, now, true); return; }
  const ph = phaseOf(r, now);
  if (ph !== 'calm' && ragAnnounced !== r.id + ph) { ragAnnounced = r.id + ph; if (ph === 'danger') { award(gs, 'ragnarok', now); fx('banner', { text: 'RAGNAROK', sub: 'The final 72 hours. Sealed chests can now be opened.' }); } if (ph === 'awakening') fx('banner', { text: 'DAY 14', sub: 'The six Elders awaken.' }); }
  const weather = weatherAt(r, now);
  const slot = Math.floor((now - r.startedAt + r.qaOffset) / (BAL.weather.slotMinutes * 60000));
  if (slot !== r.clock.weatherSlot) { r.clock.weatherSlot = slot; fx('weather', { w: weather }); }
  tickPlayer(gs, inp, dtMs, now);
  tickCreatures(gs, dtMs, now);
  tickDragonDive(gs, dtMs, now);
  tickTurrets(gs, dtMs, now);
  tickProj(gs, dtMs, now);
  tickHaz(gs, dtMs, now);
  tickSurvival(gs, dtMs, now);
  stepFires(gs, now, dtMs);
  // drops: physics + magnet + auto pickup through the dispatcher
  const p = r.player;
  for (const e of Object.values(r.entities)) {
    if (e.kind !== 'drop') continue;
    if (e.vx || e.vy) { e.x += e.vx! * dtMs / 1000; e.y += e.vy! * dtMs / 1000; e.vx! *= 0.88; e.vy! *= 0.88; if (Math.abs(e.vx!) + Math.abs(e.vy!) < 2) { e.vx = 0; e.vy = 0; } }
    if (p.dead) continue; const d = dist(e.x, e.y, p.x, p.y); const age = now - (e.born || 0);
    if (age > 380 && d < 30) { const s = C(r, e.c!)?.slots[0]; if (!s) continue; const full = ITEMS[s.key].max > 1 && !s.meta ? false : !C(r, 'inv').slots.includes(null);
      if (full) continue; e.x += (p.x - e.x) * Math.min(1, dtMs / 90); e.y += (p.y - e.y) * Math.min(1, dtMs / 90);
      if (d < 9) { const key = s.key, q = s.qty; const res = dispatch(gs, { id: 'ap_' + e.id + '_' + q, type: 'pickup', eid: e.id }, now); if (res.ok) fx('pickup', { x: p.x, y: p.y, key, q }); else e.born = now + 1500; } }
  }
  // bag recovery achievement
  // legal renewing population
  r.clock.respawnAcc += dtMs;
  if (r.clock.respawnAcc > BAL.ai.respawnIntervalSec * 1000) { r.clock.respawnAcc = 0; const alive = r.creatures.filter(c => !c.elder && c.state !== 'dead').length; const cap = 150 * (isRagnarok(r, now) ? BAL.ai.ragnarokCapMult : 1); for (let k = 0; k < 40 && alive + k < cap; k++) trySpawnCreature(r, now, p.x, p.y, 25); }
  // storm lightning strikes (committed cause → real fire)
  if (weather === 'storm') { lightningAcc += dtMs; if (lightningAcc > 14000) { lightningAcc = 0; const tx = tileOf(p.x) + Math.floor((rngNext(r) - 0.5) * 30), ty = tileOf(p.y) + Math.floor((rngNext(r) - 0.5) * 20); fx('lightning', { x: tx * TILE + 8, y: ty * TILE + 8 }); const s = sourceAt(r, tx, ty, now); if (s && s.def.tall) { const st = r.sources[s.i] || (r.sources[s.i] = { stock: s.stock, hp: s.hp }); (st as any).fire = r.clock.simMs + 6000; } } }
  // discovery & region
  discoverAcc += dtMs; if (discoverAcc > 500) { discoverAcc = 0; discover(gs, now); }
}
function discover(gs: GameState, now: number) {
  const r = gs.run!; const p = r.player; const w = getWorld(); if (!r.discovered.length) r.discovered = Array(2500).fill(0);
  const cx = tileOf(p.x) >> 2, cy = tileOf(p.y) >> 2; for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 5; x <= cx + 5; x++) if (x >= 0 && y >= 0 && x < 50 && y < 50) r.discovered[y * 50 + x] = 1;
  const zi = w.zone[tileOf(p.y) * WW + tileOf(p.x)]; const ZN = ['Heartland', 'Meadow Bay', "Fisher's Point", 'Pinewatch', 'Eastcove', 'Frostcrown Peaks', 'Caldera Wastes', 'Dead Foundry', 'Drowned Fen', 'Oldgrowth', 'Lighthouse Spit', 'Harbor Reach', 'Serpent Strand', 'Wreck Coast', 'Old Mill', 'The Sea'];
  const regionName=(w.zoneNames || ZN)[zi]; if (regionName !== p.regionName) { p.regionName = regionName; fx('region', { name: regionName }); }
  for (const pl of w.places) if (!r.poiSeen.includes(pl.id) && Math.hypot(pl.tx * TILE - p.x, pl.ty * TILE - p.y) < 13 * TILE) { r.poiSeen.push(pl.id); pushLog(r, now, `Discovered: ${pl.name}`, 'gold'); fx('discover', { name: pl.name }); }
  // stones
  r.elderStones = []; for (const s of C(r, 'inv').slots) if (s && s.key.startsWith('stone_')) r.elderStones.push(s.key);
  void countStones;
}

// ---------- offline settlement (C09) ----------
export function settle(gs: GameState, now: number, silent = false, interruptTransit = true): string[] {
  const r = gs.run; if (!r) return [];
  const expiry = r.startedAt - r.qaOffset + BAL.run.maxRunHours * HOUR;
  if (now < r.clock.lastSimAt || (now === r.clock.lastSimAt && now < expiry)) return []; // never replay time
  // A corrupt/legacy pre-run checkpoint cannot cause more than one run's duration of replay.
  const start = Math.max(r.clock.lastSimAt, expiry - BAL.run.maxRunHours * HOUR);
  const end = Math.min(now, expiry), gap = Math.max(0, end - start);
  migrateLootRespawn(r, end);
  if (start > r.clock.lastSimAt && now >= start) r.clock.lastSimAt = start;
  const report: string[] = []; const B = BAL.player; const p = r.player;
  if(interruptTransit && r.spiritTransit && gap>BAL.creatorCoreDemon.teleportMs){delete r.spiritTransit;receipt(r,start,'core.spirit.offline_abort','Transit interrupted while away');if(!silent)report.push('Teleport interrupted while away; you remained at the departure point.');}
  initializeCabinets(r);
  markDirty(); // Continue may replace the run object while retaining its ID.
  let sheltered = isSheltered(r, p.x, p.y); p.sheltered = sheltered;
  for (const e of Object.values(r.entities)) if (e.turret) e.turret.tracking = false;
  // Bounded, deterministic playback starts only at saved positions with actual
  // local evidence. Other roaming/combat remains unresolved, not fabricated.
  const eligible = r.creatures.filter(m => m.offlineUnresolvedAt === undefined && !m.elder && ['idle', 'wander', 'track', 'chase'].includes(m.state) && (!m.knows || m.knows.kind === 'trace') && (m.knows?.kind === 'trace' || !!encounteredTrace(r, m, start)));
  // Combat/last-sight checkpoints cannot be reconstructed by trace-only playback.
  for (const m of r.creatures) if (m.state !== 'dead' && m.offlineUnresolvedAt === undefined && (m.knows?.kind === 'sight' || m.knows?.kind === 'stimulus' || ['tell', 'attack', 'recover'].includes(m.state) || Math.abs(m.kbx) + Math.abs(m.kby) > 1)) m.offlineUnresolvedAt = start;
  const pending = eligible.slice(0, 24);
  for (const m of eligible.slice(24)) m.offlineUnresolvedAt = start;
  const impacts = new Map<string, { name: string; before: number; after: number; destroyed: boolean }>();
  let frames = 0, structureEpoch = offlineStructureChange;
  let defenseFrames = 0;   // R5: fine slices spent resolving a live defense contact (bounded work)

  let t = start, wetMs = 0; const zone = getWorld().zone[tileOf(p.y) * WW + tileOf(p.x)];
  // B03-A: heat/shelter transitions observed chronologically (receipts are written at the exact boundary).
  const thermalEnvAt = (at: number, sh: boolean) => thermalEnv(r, { x: p.x, y: p.y, zone, tileType: effTile(r, tileOf(p.x), tileOf(p.y)), wet: isWet(weatherAt(r, at)), dark: darkness(r, at) > 0.45, sheltered: sh });
  let heatPrev = new Map(heatersInReach(r, { x: p.x, y: p.y }).map(h => [h.e.id, h.st.active] as const));
  let shelterPrev = sheltered;
  const startHp = p.hp, startHunger = p.hunger, startThirst = p.thirst;
  // W07-R: turrets that were armed, supplied and wired when the player left (evaluated at the start, not at return).
  const standbyTurrets = Object.values(r.entities).filter(t => t.turret?.enabled && t.c && countItem(r, t.c, 'arrow') > 0).filter(t => Object.values(r.entities).some(g => g.basePower && powerAllocation(r, g, false).includes(t)));
  const territoryBefore = new Map(Object.values(r.entities).filter(e=>e.kind==='struct' && (e.owner===undefined||e.owner==='player') && e.hp!==undefined).map(e=>[e.id,{name:STRUCTS[e.type!]?.name||e.type||'Structure',hp:e.hp!}]));
  // Minute-sized survival integration, not frame replay; world helper splits further at weather/fire boundaries.
  while (t < end) {
    const slotMs = BAL.weather.slotMinutes * 60000;
    const nextWeather = r.startedAt - r.qaOffset + (Math.floor((t - r.startedAt + r.qaOffset) / slotMs) + 1) * slotMs;
    let dtMs = Math.min(60000, end - t, nextWeather - t);
    if (pending.length && frames < 2400) dtMs = Math.min(dtMs, 50);
    // R5-SIM2: bounded defense contact window — a ready, supplied turret that can legally see a target,
    // or arrows already in flight, force fine-grained slices so offline defense uses the identical online law.
    const inFlight = PROJ.some(pr => pr.from === 'player' && !(pr.delay && pr.delay > 0));
    const contact = inFlight || turretContactWindow(r, t);
    if (contact && defenseFrames < 14400) dtMs = Math.min(dtMs, 50);
    dtMs = territoryBoundary(r,dtMs);
    // Integrate the existing offline drains at their actual depletion/death boundaries.
    // Hunger follows the sourced 24h baseline; thirst is an explicit provisional SOH assumption.
    // Resolve only already-committed source fire; the stationary offline body is
    // exposed at the existing fire radius. Continuous damage approximates online
    // ticks; knockback/combat cannot be reconstructed from an absent input stream.
    resolveFires(gs,t,false);
    for (const st of Object.values(r.sources)) {
      if (st.fire && st.fire > r.clock.simMs) dtMs=Math.min(dtMs,st.fire-r.clock.simMs);
      if (st.fireSpreadAt && st.fireSpreadAt > r.clock.simMs) dtMs=Math.min(dtMs,st.fireSpreadAt-r.clock.simMs);
    }
    if ((p.iceUntil||0)>t) dtMs=Math.min(dtMs,p.iceUntil!-t);
    const activeFire = !isWet(weatherAt(r,t)) && Object.entries(r.sources).some(([key,st])=>!!st.fire && st.fire>r.clock.simMs && dist(p.x,p.y,(+key%WW)*TILE+8,Math.floor(+key/WW)*TILE+8)<18);
    const armor = C(r,'eq').slots.reduce((n,s)=>n+(s ? ITEMS[s.key].armor||0 : 0),0);
    const fireRate = activeFire && (p.iceUntil||0)<=t ? Math.max(1,Math.round(B.offlineFireHitDamage*(1-Math.min(0.6,armor))))/B.offlineFireHitMs : 0;
    const unit = B.offlineDrainFactor / 60000;
    const hungerRate = B.offlineHungerPerHour / HOUR, thirstRate = B.offlineThirstPerHour / HOUR;
    // The same equipped protection used online also applies during chronological offline exposure.
    const protectedByMask = C(r, 'eq').slots.some(s => s && ITEMS[s.key].mask);
    const radRate = zone === 7 ? 6 * (protectedByMask ? 0.8 / 7 : 1) * unit : 0;
    let damageRate = 0;
    if (!p.dead) {
      if (p.hunger < 1e-9) p.hunger = 0; if (p.thirst < 1e-9) p.thirst = 0;
      if (p.hunger > 0) dtMs = Math.min(dtMs, p.hunger / hungerRate);
      if (p.thirst > 0) dtMs = Math.min(dtMs, p.thirst / thirstRate);
      // Rest consumes provisions exactly at the trigger, so the slice must end there.
      if (r.rest) { const trig = BAL.restV1.triggerStat; if (p.hunger > trig) dtMs = Math.min(dtMs, (p.hunger - trig) / hungerRate); if (p.thirst > trig) dtMs = Math.min(dtMs, (p.thirst - trig) / thirstRate); dtMs = Math.min(dtMs, Math.max(0.001, r.rest.targetAt - t)); }
      if (radRate && p.rad < 50) dtMs = Math.min(dtMs, (50 - p.rad) / radRate);
      const thirsty = p.thirst <= 0, hungry = p.hunger <= 0;
      if (thirsty || (hungry && (!sheltered || p.hp > 1 + 1e-9))) damageRate += B.starveDamagePerMin * unit;
      damageRate += fireRate;
      if ((p.iceUntil||0)<=t && coldDamageActive(p.warmth)) damageRate += B.coldDamagePerMin * unit;
      if (zone === 7 && p.rad >= 50 - 1e-9) damageRate += B.radDamagePerMinOver50 * unit;
      if (damageRate > 0) {
        if (sheltered && hungry && !thirsty && p.hp > 1 + 1e-9) dtMs = Math.min(dtMs, (p.hp - 1) / damageRate);
        else dtMs = Math.min(dtMs, Math.max(0, p.hp) / damageRate);
      }
    }
    // B03-A: the thermal target is constant inside a slice; heater exhaustion and cold crossings end it.
    const thermalNow = thermalEvaluate(r, thermalEnvAt(t, sheltered));
    if (!p.dead) dtMs = Math.min(dtMs, thermalBoundaryMs(r, thermalEnvAt(t, sheltered), p.warmth, thermalNow.target));
    // Date.now has finite precision; avoid a non-advancing sub-millisecond loop.
    const until = Math.min(end, nextWeather, t + Math.max(dtMs, 0.001)); dtMs = until - t;
    if (isWet(weatherAt(r, t))) wetMs += dtMs;
    advanceWorld(gs, t, until, silent ? undefined : report, false);
    if (dtMs <= 50 && defenseFrames < 14400 && (PROJ.some(pr => pr.from === 'player') || turretContactWindow(r, until))) {
      // Turret resolution shares the exact online functions: same range, same LOS, same cooldown, same ammo cost (1 arrow per shot).
      tickTurrets(gs, dtMs, until);
      tickProj(gs, dtMs, until);
      defenseFrames++;
    } else if (dtMs > 50) {
      for (const e of Object.values(r.entities)) { const tc = e.turret; if (tc) tc.cooldown = Math.max(0, tc.cooldown - dtMs); }
    }
    if (r.rest) restStep(r, until);
    if (!p.dead) p.warmth = thermalStep(p.warmth, thermalNow.target, dtMs / 60000);
    for (const { e, st } of heatersInReach(r, { x: p.x, y: p.y })) {
      const was = heatPrev.get(e.id);
      if (was && !st.active) receipt(r, until, 'heat.out', `${e.id}:${st.kind}:${st.code}`);
      heatPrev.set(e.id, st.active);
    }
    if (shelterPrev && !isSheltered(r, p.x, p.y)) receipt(r, until, 'heat.shelter_lost', `${p.x.toFixed(0)},${p.y.toFixed(0)}`);
    if (pending.length && frames < 2400) {
      frames++; offlineImpacts = impacts; offlineQuiet = true;
      try {
        for (let i = pending.length - 1; i >= 0; i--) {
          const m = pending[i], outcome = traceOnly(gs, m, dtMs, until);
          if (outcome !== 'advanced') { if (outcome === 'defer') m.offlineUnresolvedAt = t; pending.splice(i, 1); }
        }
      } finally { offlineQuiet = false; offlineImpacts = null; }
      if (frames === 2400) for (const m of pending) m.offlineUnresolvedAt = until;
    }
    t = until; r.clock.lastSimAt = t;
    if (structureEpoch !== offlineStructureChange) { structureEpoch = offlineStructureChange; sheltered = isSheltered(r, p.x, p.y); p.sheltered = sheltered; }
    shelterPrev = sheltered;
    if (p.dead) continue;
    p.hunger = Math.max(0, p.hunger - hungerRate * dtMs); p.thirst = Math.max(0, p.thirst - thirstRate * dtMs);
    if (radRate) p.rad = Math.min(100, p.rad + radRate * dtMs);
    p.hp -= damageRate * dtMs;
    if (Math.abs(p.hp - 1) < 1e-8) p.hp = 1;
    if (p.hp <= 1e-8) { killPlayer(gs, t, 'exposure while offline'); if (!silent) report.push('You did not survive the time away. Your bag lies where you rested.'); }
  }
  if (!silent) for(const [id,before] of territoryBefore) { const e=r.entities[id]; if(e && e.hp!==undefined && e.hp<before.hp-0.01) report.push(`${before.name}: ${Math.round(before.hp)} → ${Math.round(e.hp)} HP while away (upkeep decay or actual impact).`); }
  if (!silent) for(const c of Object.values(r.entities)) if(c.type==='claim' && c.c && c.cabinet) {
    const amounts=BAL.territory.materials.map((k:string)=>[k,countItem(r,c.c!,k)] as const).filter(([,q]:readonly [string,number])=>q>0);
    const credit=Object.entries(c.cabinet.credit).filter(([,q])=>q>1e-9).map(([k,q])=>`${q.toFixed(2)} ${ITEMS[k].name}`).join(', ');
    const f=territoryForecast(r,c), remaining=f.funded?(Number.isFinite(f.hours)?`${f.hours.toFixed(1)} h`:'unlimited'):'unfunded';
    report.push(`Cabinet ${c.tx},${c.ty} physical stock: ${amounts.map(([k,q]:readonly [string,number])=>`${q} ${ITEMS[k].name}`).join(', ') || 'none'}; prepaid credit: ${credit || 'none'}; upkeep ${remaining}.`);
  }
  if (now >= expiry) {
    if (!silent) for (const impact of impacts.values()) report.push(impact.destroyed ? `${impact.name} was destroyed while away.` : `${impact.name}: ${Math.round(impact.before)} → ${Math.round(impact.after)} HP while away.`);
    endRun(gs, 'expired', expiry); if (!silent) report.push('The run reached its 336-hour end while you were away.'); return report;
  }
  if (silent || (gap < 4000 && impacts.size === 0)) return [];
  const hrs = gap / 3600000;
  report.unshift(`Away for ${hrs >= 1 ? hrs.toFixed(1) + ' h' : gap >= 60000 ? Math.round(gap / 60000) + ' min' : Math.round(gap / 1000) + ' sec'}.`);
  report.push('Nearby evidenced trails may be followed while away; other encounters remain unresolved.');
  for (const t of standbyTurrets) report.push(`Turret ${t.tx},${t.ty} was armed on a generator with fuel when you left: it kept its power reservation while fuel lasted. While away it engages lawful targets — same sight, range, cooldown and arrow cost as while you play.`);
  for (const impact of impacts.values()) report.push(impact.destroyed ? `${impact.name} was destroyed while away.` : `${impact.name}: ${Math.round(impact.before)} → ${Math.round(impact.after)} HP while away.`);
  if (!p.dead) {
    const nearby = r.traces.filter(tr => dist(p.x, p.y, tr.x, tr.y) <= 64 && los(r, p.x, p.y, tr.x, tr.y, true)).length;
    report.push(`Here: ${sheltered ? 'sheltered' : 'not sheltered'}; ${weatherAt(r, end)}; ${nearby} visible nearby footprint${nearby === 1 ? '' : 's'}.`);
  }
  if (wetMs) report.push(`Rain fell for ~${wetMs >= 60000 ? Math.round(wetMs / 60000) + ' min' : Math.round(wetMs / 1000) + ' sec'}, accelerating footprint decay; exposed gardens and barrels could collect water.`);
  if (Math.round(startHunger - p.hunger) > 0) report.push(`Hunger ${Math.round(startHunger)} → ${Math.round(p.hunger)}${sheltered ? ' (sheltered: hunger cannot kill you)' : ''}.`);
  if (Math.round(startThirst - p.thirst) > 0) report.push(`Thirst ${Math.round(startThirst)} → ${Math.round(p.thirst)} (shelter does not prevent thirst death).`);
  if (!p.dead && startHp - p.hp >= 1) report.push(`HP ${Math.round(startHp)} → ${Math.round(p.hp)}.`);
  receipt(r, now, 'offline.settle', `${Math.round(gap / 1000)}s`);
  return report;
}

// ---------- interaction finder (for E prompts) ----------
export interface Interact { kind: string; label: string; eid?: string; x: number; y: number }
/** B04-P3 bear trap readout. Costs come from balance; the states mirror persist.ts trap-v1 invariants. */
export function bearTrapPrompt(r: RunState, e: Entity): string {
  const t = e.bearTrap; if (!t) return 'Bear trap: not installed';
  const plate = ITEMS[BAL.bearTrapV1.armCost[0][0] as string].name;
  if ((e.hp ?? 0) <= 0) return 'Bear trap: destroyed';
  if (t.state === 'armed') return `Bear trap ARMED · ${t.uses} hit${t.uses === 1 ? '' : 's'} left · live contact fires it`;
  if (t.state === 'spent') return `Bear trap SPENT · ${t.uses} hit${t.uses === 1 ? '' : 's'} left · E re-arms for 1 ${plate}`;
  if (t.state === 'worn') return 'Bear trap WORN OUT · reclaim to recover materials';
  return `Bear trap unarmed · ${t.uses} hits · E arms for 1 ${plate}`;
}
export function findInteract(gs: GameState, now: number): Interact | null {
  const r = gs.run!; const p = r.player; if (p.dead) return null; let best: Interact | null = null; let bd = 30;
  const fx0 = p.x + Math.cos(p.aim) * 6, fy0 = p.y + Math.sin(p.aim) * 6;
  for (const e of Object.values(r.entities)) {
    if (e.kind === 'drop') continue; const d = dist(fx0, fy0, e.x, e.y); if (d > bd || !clearInteraction(r, e)) continue;
    let label = ''; let kind = e.kind as string;
    if (e.kind === 'bag') { if (!C(r,e.c!).slots.some(Boolean) && !e.legacyJobs?.queue.length) continue; label = `Open ${e.label || 'bag'}`; }
    else if (e.kind === 'airdrop') { if(!e.airdrop || ['signal','descending'].includes(e.airdrop.phase))continue; const v=airdropView(e.airdrop,e.tx!,e.ty!,now,C(r,e.c!).slots.filter(Boolean).length); label = v.key==='locked' ? `Airdrop locked · opens in ${v.lockedRemainS}s` : v.key==='emptied' ? 'Airdrop empty' : v.key==='partial' ? 'Airdrop partly claimed · take only' : v.key==='expiring' ? `Airdrop expiring · take only` : 'Search airdrop · take only'; }
    else if (e.kind === 'loot') { const site=r.lootEcology && getWorld(r.layoutId||'shipping').statics.find(s=>s.kind==='loot'&&s.tx===e.tx&&s.ty===e.ty);const cls=site && lootClass(site);label=C(r,e.c!).slots.some(Boolean) ? `Search ${cls ? LOOT_CLASSES[cls].name : 'crate'}` : 'Empty crate'; }
    else if (e.kind === 'cash') label = isRagnarok(r, now) ? (e.minted ? 'Ragnarok chest' : 'Break the Ragnarok seal') : 'Sealed Ragnarok chest';
    else if (e.kind === 'vendor') label = `Trade with ${e.label}`;
    else if (e.kind === 'door') label = e.locked || e.poiDoor ? poiDoorLabel(r,e,now) : e.open ? 'Close door' : 'Open door';
    else if (e.kind === 'recycler') label = 'Use Foundry Recycler';
    else if (e.kind === 'gen') label = poiGenLabel(r,e,now);
    else if (e.type === 'ir_sensor') label = `Infrared sensor ${e.irSensor?.enabled ? 'ON' : 'OFF'}: ${irSensorStatus(r, e)}${irSensorDownstream(r, e)} (E toggles)`;
    else if (e.type === 'bear_trap') label = bearTrapPrompt(r, e);
    else if (e.kind === 'evac') label = 'Evacuation beacon';
    else if (e.kind === 'cart') label = 'Cart cargo  [Shift+F] pull';
    else if (e.kind === 'vehicle') label = r.player.vehicle===e.id ? 'Exit motorbike' : 'Motorbike cargo and controls';
    else if (e.kind === 'struct') { const d2 = STRUCTS[e.type!]; kind = 'struct:' + e.type; if (e.type!.startsWith('door')) label = e.electricDoor ? (e.open ? 'Close powered door' : electricDoorPowered(r,e) ? 'Open powered door' : electricInterior(r,e) ? 'Open interior release' : 'Powered door · no power') : e.open ? 'Close door' : 'Open door'; else if(e.wireSwitch) label=`Switch ${e.wireSwitch.on?'on':'off'} · toggle`; else if (e.type === 'claim') label = 'Open Territory Cabinet'; else if (e.type === 'bed_straw') label = e.hp && e.hp > 0 ? 'Rest on straw bed' : 'Broken straw bed'; else if (d2.station) label = `Use ${d2.name}`; else if (e.turret) label = `Turret: ${turretStatus(r,e)}${e.turret.tracking ? ' · target' : ''}`; else if (e.basePower) label = `Generator: ${e.basePower.enabled && e.basePower.energy>0 ? 'running' : e.basePower.enabled ? 'no fuel' : 'off'}`; else if (d2.slots) label = `Open ${d2.name}`; else if (e.type === 'escrow') label = 'Rương ký gửi'; else if (e.type === 'garden') label = 'Tend garden'; else if (e.type === 'barrel') label = `Rain barrel (${Math.floor(e.water || 0)})`; else continue; }
    else continue;
    if((e.kind==='door'||e.kind==='gen') && (effTile(r,tileOf(p.x),tileOf(p.y))===T.TOXIC || (getWorld().zone[tileOf(p.y)*WW+tileOf(p.x)]===7 && effTile(r,tileOf(p.x),tileOf(p.y))===T.FLOOR)))label+=' · radiation exposure';
    bd = d; best = { kind, label, eid: e.id, x: e.x, y: e.y };
  }
  for (const key in r.sources) { const st=r.sources[key]; if(!st.fire || st.fire<=r.clock.simMs)continue; const i=+key,x=(i%WW)*TILE+8,y=Math.floor(i/WW)*TILE+8,d=dist(fx0,fy0,x,y); if(d<bd && dist(p.x,p.y,x,y)<=2.2*TILE && clearInteraction(r,{x,y})){bd=d;best={kind:'fire',label:'Douse burning tree (1 flask water)',x,y};} }
  if (!best) { const w = getWorld(); for (const [dx, dy] of [[0, 0], [Math.cos(p.aim) * 14, Math.sin(p.aim) * 14], [0, 12], [0, -12], [12, 0], [-12, 0]]) { const tx = tileOf(p.x + dx), ty = tileOf(p.y + dy); if (w.fresh[ty * WW + tx] && effTile(r, tx, ty) !== T.ICE && [T.SHALLOW, T.RIVER].includes(effTile(r, tx, ty))) return { kind: 'water', label: 'Drink fresh water', x: tx * TILE + 8, y: ty * TILE + 8 }; } }
  return best;
}
