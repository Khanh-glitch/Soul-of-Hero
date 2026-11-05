import {supportsAirdrops, airdropTimes, airdropRewards, airdropStaticEligible} from './airdrop';
import { recoveryPlan } from './recycler';
import { poiContractDigest } from './poi-access';
import { LOOT_ECOLOGY_VERSION, lootClass, lootRoll, lootSiteIndex } from './loot-ecology';
import { creatorLootV1 } from './creator-loot';
// Local-first snapshots: one serialized profile + run + receipts per write.
// Checksums detect accidental damage, not malicious edits or rollback of all copies.
import { BAL, SAVE_VERSION, WW, WH, TILE, type GameState, type Stack } from './core';
import { ITEMS, RECIPES, STRUCTS, SOURCES, ELDERS, VENDOR_SPARES } from './catalog';
import { newGame, renewableLoot } from './engine';
import { getWorld, hasLayout, webRecyclerSite } from './world';
import { mapDigest } from './map-package';
import { sourceDigest } from './world-economy';
import { hasAuthorizedRecycler, wreckEconomy } from './wreck-economy';

const testMode = import.meta.env.VITE_FX_TEST === '1';
const DB = testMode ? 'soul-of-hero-vfx-test' : 'soul-of-hero', STORE = 'kv', KEY = 'state', LS = (testMode ? 'soh.vfx-test.v' : 'soh.state.v') + SAVE_VERSION;
const FORMAT = 'soh-snapshot-v1';
let dbp: Promise<IDBDatabase | null> | null = null;
let dbFailed = false;
// Never overwrite a store that could not be read on this page load.
let idbReadable = true, localReadable = true;
function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise(res => { try { const rq = indexedDB.open(DB, 1); rq.onupgradeneeded = () => rq.result.createObjectStore(STORE); rq.onsuccess = () => res(rq.result); rq.onerror = () => { dbFailed = true; res(null); }; } catch { if (typeof indexedDB !== 'undefined') dbFailed = true; res(null); } });
  return dbp;
}
export type LoadResult = { gs: GameState | null; note?: string };
const obj = (x: any) => x !== null && typeof x === 'object' && !Array.isArray(x);
const finite = (x: any) => typeof x === 'number' && Number.isFinite(x);
const integer = (x: any) => Number.isSafeInteger(x) && x >= 0;
const stringArray = (x: any) => Array.isArray(x) && x.every((v: any) => typeof v === 'string');
const has = (catalog: object, key: unknown) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(catalog, key);

/** Fail closed on broken references and duplicate physical/reserved identities. */
export function validate(raw: any): GameState | null {
  if (!obj(raw) || !integer(raw.version) || raw.version > SAVE_VERSION || !integer(raw.revision)) return null;
  const p = raw.profile;
  if (!obj(p) || !integer(p.securedCash) || !obj(p.achievements) || !Array.isArray(p.history) || !obj(p.settings) || !finite(p.settings.volume) || typeof p.settings.muted !== 'boolean' || !stringArray(p.profileReceipts)) return null;
  if (raw.run === null) return raw as GameState;
  const r = raw.run;
  if (!obj(r) || typeof r.id !== 'string' || !r.id || !integer(r.nextId) || r.nextId < 1 || !finite(r.startedAt) || !finite(r.qaOffset) || !integer(r.seed) || !integer(r.rng) || !integer(r.seq) || !obj(r.player) || !obj(r.custody) || !obj(r.entities) || !obj(r.clock)) return null;
  if (r.sourceLayoutVersion !== undefined && r.sourceLayoutVersion !== 2 && r.sourceLayoutVersion !== 3) return null;
  const layout = r.layoutId || 'shipping'; if (typeof layout !== 'string' || !hasLayout(layout)) return null;
  const world = getWorld(layout), fingerprint = mapDigest(world);
  // Snapshots written before mapDigest existed are accepted only against the
  // exact built-in geometry which shipped with PR #44, never an imported map.
  const baseline: Record<string,string> = { shipping:'f773dae0', dev_delta:'74b3ed67' };
  if (r.sourceLayoutVersion === 3) {
    const m=r.sourceMap; if (!obj(m) || m.id !== world.economyMap.id || m.revision !== world.economyMap.revision || m.rules !== 3 || m.seed !== world.economyMap.seed || m.digest !== sourceDigest(world.sourceV3)) return null;
    if (m.mapDigest === undefined ? baseline[layout] !== fingerprint : m.mapDigest !== fingerprint) return null;
    if (world.veyra && JSON.stringify(m.veyra)!==JSON.stringify(world.veyra)) return null;
    if (world.randomSpawn && (!obj(r.spawnChoice) || r.spawnChoice.contract!=='seeded-geographic-v1' || !Number.isInteger(r.spawnChoice.x) || !Number.isInteger(r.spawnChoice.y) || r.spawnChoice.x<1 || r.spawnChoice.y<1 || r.spawnChoice.x>=199 || r.spawnChoice.y>=199)) return null;
    if (!world.veyra && m.veyra!==undefined) return null;
  } else if (baseline[layout] !== fingerprint) return null;
  if (r.sourceLayoutVersion !== 3 && r.sourceMap !== undefined) return null;
  if ((r.player.iceUntil !== undefined && !finite(r.player.iceUntil)) || (r.player.channelUntil !== undefined && !finite(r.player.channelUntil)) || !['x','y','hp','stamina','hunger','thirst','warmth','rad','active'].every(k => finite(r.player[k])) || !obj(r.player.skills) || typeof r.player.dead !== 'boolean' || !finite(r.clock.lastSimAt) || !finite(r.clock.simMs) || !finite(r.clock.respawnAcc) || !finite(r.clock.weatherSlot)) return null;
  if (!Array.isArray(r.creatures) || !obj(r.sources) || !obj(r.terrain) || !obj(r.knowledge) || !stringArray(r.knowledge.recipes) || !stringArray(r.knowledge.studied) || !r.knowledge.recipes.every((k: string) => has(RECIPES, k)) || !Array.isArray(r.traces) || !Array.isArray(r.discovered) || !stringArray(r.poiSeen) || !stringArray(r.elderStones) || !stringArray(r.achievements) || !Array.isArray(r.receipts) || !stringArray(r.seenIntents) || !obj(r.vendorStock) || !Object.values(r.vendorStock).every(integer) || !integer(r.score) || !integer(r.deposited) || !Array.isArray(r.log)) return null;
  // Old saves have no combat record. New records preserve committed effects,
  // but malformed effects must not become executable hazards on load.
  if (r.combat !== undefined) {
    const c = r.combat;
    if (!obj(c) || !Array.isArray(c.projectiles) || !Array.isArray(c.hazards) || c.projectiles.length > 5000 || c.hazards.length > 5000) return null;
    if (c.projectiles.some((q: any) => !obj(q) || !['x','y','vx','vy','life','dmg','r'].every(k => finite(q[k])) || !['player','enemy'].includes(q.from) || typeof q.kind !== 'string' || (q.delay !== undefined && !finite(q.delay)) || (q.homing !== undefined && !finite(q.homing)))) return null;
    if (c.hazards.some((h: any) => !obj(h) || !['circle','line','ring','wave','sweep','pool'].includes(h.kind) || !['x','y','t','tell','dur','dmg'].every(k => finite(h[k])) || typeof h.style !== 'string' || (h.elder !== undefined && !has(ELDERS, h.elder)) || ['r','angle','len','w','tickAcc','a0','a1','expiresSimMs'].some(k => h[k] !== undefined && !finite(h[k])))) return null;
  }
  if (r.sourceLayoutVersion === 3) for (const [key, st] of Object.entries(r.sources) as [string, any][]) {
    const i=Number(key); if (!Number.isInteger(i) || String(i)!==key || i<0 || i>=world.sourceV3.length || !world.sourceV3[i] || !obj(st)) return null;
    const def=SOURCES[st.burnt ? 'deadtree' : world.sourceV3[i]!];
    if (!def || !finite(st.stock) || !Number.isInteger(st.stock) || st.stock<0 || st.stock>def.stock || !finite(st.hp) || st.hp<0 || st.hp>def.hp || (st.burnt!==undefined && typeof st.burnt!=='boolean') || (st.regrowAt!==undefined && (!finite(st.regrowAt)||st.regrowAt<0)) || (st.fire!==undefined && (!finite(st.fire)||st.fire<0)) || (st.fireSpreadAt!==undefined && (!finite(st.fireSpreadAt)||st.fireSpreadAt<0 || !st.fire || st.fireSpreadAt>st.fire)) || (st.fireDepth!==undefined && (!Number.isInteger(st.fireDepth)||st.fireDepth<0||st.fireDepth>BAL.fire.maxSpreadDepth))) return null;
  }
  if (!r.custody.inv || !r.custody.eq || r.custody.inv.kind !== 'inv' || r.custody.eq.kind !== 'eq' || (r.custody.inv.slots?.length !== 24 && !(testMode && r.qaUsed === true && r.custody.inv.slots?.length === 128)) || r.custody.eq.slots?.length !== 3) return null;
  if (!Number.isInteger(r.player.active) || r.player.active < 0 || r.player.active > 7 || !['vx','vy','dir','aim','invuln','deadT','stepAcc','lastTraceX','lastTraceY'].every(k => finite(r.player[k])) || !['gather','combat','craft','survival'].every(k => finite(r.player.skills[k]))) return null;
  const beforeNext = (id: string, re: RegExp) => { const m = re.exec(id); return !m || parseInt(m[1], 36) < r.nextId; };
  if (r.creatures.some((m: any) => !obj(m) || typeof m.id !== 'string' || !beforeNext(m.id, /^m([a-z0-9]+)$/) || typeof m.type !== 'string' || typeof m.state !== 'string' || !finite(m.x) || !finite(m.y) || !finite(m.hp) || (m.offlineUnresolvedAt !== undefined && !finite(m.offlineUnresolvedAt)) || (m.signatureBurnNext !== undefined && !finite(m.signatureBurnNext)) || (m.tornadoNext !== undefined && !finite(m.tornadoNext)) || (m.frozenUntil !== undefined && !finite(m.frozenUntil)) || (m.rootedUntil !== undefined && !finite(m.rootedUntil)) || (m.rootHitNext !== undefined && !finite(m.rootHitNext)) || (m.beamHitNext !== undefined && !finite(m.beamHitNext)))) return null;
  // Only the supported landing impulse may introduce new non-player knowledge.
  const stimulusId=(id:any,index:any)=>typeof id==='string'&&integer(index)&&index<(r.airdrops?.nextIndex??0)&&new RegExp(`^airdrop:${index}:e[0-9a-z]+$`).test(id)&&beforeNext(id.split(':')[2],/^e([a-z0-9]+)$/);
  const stimulusCoordinates=(x:any,y:any)=>finite(x)&&finite(y)&&Number.isInteger((x-8)/TILE)&&Number.isInteger((y-8)/TILE)&&airdropStaticEligible(world,(x-8)/TILE,(y-8)/TILE);
  if(r.worldStimuli!==undefined&&(!Array.isArray(r.worldStimuli)||r.worldStimuli.length>1||r.worldStimuli.some((s:any)=>{
    if(!obj(s)||s.version!=='world-stimulus-v1'||s.kind!=='airdrop-landing'||s.modality!=='sound'||s.eligibility!=='audible-landing-v1'||!stimulusId(s.sourceId,s.eventIndex)||s.id!==s.sourceId+':landing'||!stimulusCoordinates(s.x,s.y)||s.at!==airdropTimes(r,s.eventIndex).landAt||s.expiresAt!==s.at+BAL.worldStimulusV1.signalMs||s.range!==BAL.worldStimulusV1.landingSoundRange||s.strength!==1||r.clock.lastSimAt<s.at||r.clock.lastSimAt>=s.expiresAt)return true;
    const source=r.entities[s.sourceId.split(':')[2]];return !!source&&(source.kind!=='airdrop'||source.airdrop?.index!==s.eventIndex||source.x!==s.x||source.y!==s.y||!['locked','open','partial'].includes(source.airdrop?.phase));
  })))return null;
  for(const m of r.creatures){
    if(m.stimulusIgnore!==undefined){const parts=typeof m.stimulusIgnore==='string'?m.stimulusIgnore.split(':'):[];if(parts.length!==3||!stimulusId(m.stimulusIgnore,Number(parts[1])))return null;}
    if(m.stimulusRouteAt!==undefined&&!finite(m.stimulusRouteAt))return null;
    const k=m.knows;if(k?.kind==='stimulus'){
      if(!r.airdrops||m.elder||!obj(k)||!stimulusId(k.sourceId,k.eventIndex)||m.stimulusIgnore!==k.sourceId||!stimulusCoordinates(k.x,k.y)||k.at!==airdropTimes(r,k.eventIndex).landAt||k.expiresAt!==k.at+BAL.worldStimulusV1.memoryMs||r.clock.lastSimAt<k.at||r.clock.lastSimAt>=k.expiresAt||!finite(k.goalX)||!finite(k.goalY)||![[TILE,0],[-TILE,0],[0,TILE],[0,-TILE]].some(([x,y])=>k.goalX===k.x+x&&k.goalY===k.y+y))return null;
      const source=r.entities[k.sourceId.split(':')[2]];if(source&&(source.kind!=='airdrop'||source.airdrop?.index!==k.eventIndex||source.x!==k.x||source.y!==k.y))return null;
    }
  }
  if (r.dragonDive !== undefined && (!obj(r.dragonDive) || !Array.isArray(r.dragonDive.ids) || new Set(r.dragonDive.ids).size !== r.dragonDive.ids.length || r.dragonDive.ids.some((id: any) => typeof id !== 'string' || !id) || !finite(r.dragonDive.x) || !finite(r.dragonDive.y) || !finite(r.dragonDive.left) || r.dragonDive.left <= 0 || r.dragonDive.left > BAL.creatorCoreDragon.collectMs || (r.dragonDive.route !== undefined && (!Array.isArray(r.dragonDive.route) || r.dragonDive.route.length>500 || r.dragonDive.route.length!==r.dragonDive.ids.length || r.dragonDive.route.some((q:any,i:number)=>!obj(q)||q.id!==r.dragonDive.ids[i]||!finite(q.x)||!finite(q.y)) || !Number.isInteger(r.dragonDive.index) || r.dragonDive.index<0 || r.dragonDive.index>r.dragonDive.route.length || !finite(r.dragonDive.dragonX) || !finite(r.dragonDive.dragonY) || !['traverse','gather','dive'].includes(r.dragonDive.phase) || !Array.isArray(r.dragonDive.hitIds) || new Set(r.dragonDive.hitIds).size!==r.dragonDive.hitIds.length || r.dragonDive.hitIds.some((id:any)=>!r.dragonDive.ids.includes(id)))))) return null;
  if (r.natureTrees !== undefined && (!Array.isArray(r.natureTrees) || r.natureTrees.length>100 || new Set(r.natureTrees.map((q:any)=>`${q.tx},${q.ty}`)).size!==r.natureTrees.length || r.natureTrees.some((q:any)=>!obj(q)||!integer(q.tx)||!integer(q.ty)||q.tx<0||q.ty<0||q.tx>=WW||q.ty>=WW||!finite(q.until)||q.until<=0))) return null;
  if(r.spiritTransit!==undefined && (!obj(r.spiritTransit)||!finite(r.spiritTransit.x)||!finite(r.spiritTransit.y)||r.spiritTransit.x<TILE||r.spiritTransit.y<TILE||r.spiritTransit.x>=(WW-1)*TILE||r.spiritTransit.y>=(WW-1)*TILE||!finite(r.spiritTransit.arriveAt)||r.spiritTransit.arriveAt<r.startedAt-r.qaOffset||r.spiritTransit.arriveAt>r.clock.lastSimAt+BAL.creatorCoreDemon.teleportMs||typeof r.spiritTransit.uid!=='string'||!/^s[0-9a-z]+$/.test(r.spiritTransit.uid)||!beforeNext(r.spiritTransit.uid,/^s([a-z0-9]+)$/)))return null;
  const uids = new Set<string>(), ownedContainers = new Set<string>(['inv', 'eq']);
  const stack = (s: any): s is Stack => {
    if (!obj(s) || typeof s.uid !== 'string' || !s.uid || !beforeNext(s.uid, /^s([a-z0-9]+)$/) || uids.has(s.uid) || typeof s.key !== 'string' || !has(ITEMS, s.key) || !integer(s.qty) || s.qty < 1 || s.qty > ITEMS[s.key].max) return false;
    if (s.upgrade !== undefined && (s.key !== 'cart_kit' || s.upgrade !== 'freight')) return false;
    if(s.key==='keycard' && s.charge!==undefined && (!integer(s.charge)||s.charge<1||s.charge>100||s.qty!==1))return false;
    if(s.key==='motorbike_kit' && (!finite(s.dur)||s.dur<0||s.dur>BAL.motorbike.maxHp))return false;
    if (ITEMS[s.key].creatorCore ? (!obj(s.reserves) || Object.keys(s.reserves).sort().join(',') !== 'basic,refined,signature' || !['basic','refined','signature'].every(k => integer(s.reserves[k]) && s.reserves[k] >= 0 && s.reserves[k] <= ({basic:40,refined:12,signature:4} as any)[k])) : s.reserves !== undefined) return false;
    if ((s.dur !== undefined && (!finite(s.dur) || s.dur < 0)) || (s.charge !== undefined && (!finite(s.charge) || s.charge < 0)) || (s.meta !== undefined && typeof s.meta !== 'string') || (s.key === 'blueprint' && (!s.meta || !has(RECIPES, s.meta)))) return false;
    uids.add(s.uid); return true;
  };
  for (const [id, c] of Object.entries(r.custody) as [string, any][]) {
    if (!obj(c) || c.id !== id || (id !== 'inv' && id !== 'eq' && !beforeNext(id, /^c([a-z0-9]+)$/)) || !['inv','eq','drop','bag','cart','vehicle','loot','cash','chest','fuel','out','rest'].includes(c.kind) || !Array.isArray(c.slots)) return null;
    for (let i = 0; i < c.slots.length; i++) { const s = c.slots[i]; if (s !== null && (!stack(s) || (c.kind === 'eq' && ITEMS[s.key].slot !== ['head','body','back'][i]) || (c.kind === 'fuel' && !ITEMS[s.key].fuel))) return null; }
  }
  const jobIds = new Set<string>();
  const jobs = (queue: any, station: string): boolean => Array.isArray(queue) && queue.every((j: any) => {
    if (!obj(j) || typeof j.id !== 'string' || !j.id || jobIds.has(j.id) || !beforeNext(j.id, /^j([a-z0-9]+)$/) || typeof j.recipe !== 'string') return false;
    if(j.recipe==='X:recover-v1'){
      if(station!=='recycler'||!finite(j.left)||!finite(j.total)||j.left<0||j.left>j.total||!Array.isArray(j.reserved)||j.reserved.length!==1)return false;
      const plan=recoveryPlan(j.reserved[0]);if(!plan||plan.recipe!==j.recipe||j.total!==plan.total||!j.reserved.every(stack))return false;
      jobIds.add(j.id);return true;
    }
    const recycler = j.recipe==='X:drive';
    if(recycler){if(station!=='recycler'||!finite(j.left)||!finite(j.total)||j.total!==12000||j.left<0||j.left>j.total||!Array.isArray(j.reserved)||j.reserved.length!==1||j.reserved[0]?.key!=='damaged_drive'||j.reserved[0]?.qty!==1||!j.reserved.every(stack))return false;jobIds.add(j.id);return true;}
    const research = j.recipe.startsWith('R:'), recipe = research ? j.recipe.slice(2) : j.recipe;
    if (!has(RECIPES, recipe) || (station === 'research' ? !research : research || RECIPES[recipe].station !== station) || !finite(j.left) || !finite(j.total) || j.total <= 0 || j.left < 0 || j.left > j.total || (j.reserved !== undefined && (!Array.isArray(j.reserved) || !j.reserved.every(stack)))) return false;
    // Refinery jobs: the recipe is canonical. Time must be the recipe time and any recorded reservation must equal the recipe inputs exactly.
    if (station === 'refinery') {
      const canon = RECIPES[recipe];
      if (j.total !== canon.secs * 1000) return false;
      // New refinery jobs always hold paid reservations; there is no historical refinery save to migrate (feature is branch-local).
      if (!Array.isArray(j.reserved)) return false;
      {
        const want = new Map(canon.ins.map(([k, q]) => [k, q] as [string, number]));
        const got = new Map<string, number>();
        for (const st of j.reserved) got.set(st.key, (got.get(st.key) ?? 0) + st.qty);
        if (got.size !== want.size || [...want].some(([k, q]) => got.get(k) !== q)) return false;
      }
    }
    jobIds.add(j.id); return true;
  });
  for (const [id, e] of Object.entries(r.entities) as [string, any][]) {
    if (!obj(e) || e.id !== id || !beforeNext(id, /^(?:cart|[ebd])([a-z0-9]+)$/) || typeof e.kind !== 'string' || !finite(e.x) || !finite(e.y)) return null;
    if (!['drop','struct','bag','cart','vehicle','loot','cash','vendor','evac','door','gen','recycler','airdrop'].includes(e.kind)) return null;
    if (e.kind === 'struct' && !has(STRUCTS, e.type)) return null;
    if(e.kind==='airdrop'){
      const a=e.airdrop,d=r.airdrops;
      if(!d||!obj(a)||!integer(a.index)||a.index>=d.nextIndex||!integer(e.tx)||!integer(e.ty)||e.x!==e.tx*TILE+8||e.y!==e.ty*TILE+8||!airdropStaticEligible(world,e.tx,e.ty)||e.type!==undefined||!e.c||r.custody[e.c]?.kind!=='loot'||r.custody[e.c].slots.length!==3)return null;
      const times=airdropTimes(r,a.index);if(Object.entries(times).some(([k,v])=>a[k]!==v))return null;
      const t=r.clock.lastSimAt,phase=t<a.descentAt?'signal':t<a.landAt?'descending':t<a.unlockAt?'locked':'open';
      if(t<a.signalAt||t>=a.expiresAt||(a.phase!==phase&&!(phase==='open'&&a.phase==='partial')))return null;
      const slots=r.custody[e.c].slots, permitted=Object.fromEntries(airdropRewards(r,a.index));
      if((phase==='signal'||phase==='descending')&&slots.some(Boolean))return null;
      if((phase==='locked'||phase==='open')&&!slots.some(Boolean))return null;
      const sums:Record<string,number>={};for(const stack of slots)if(stack)sums[stack.key]=(sums[stack.key]||0)+stack.qty;
      if(Object.entries(sums).some(([key,q])=>!permitted[key]||q>permitted[key]))return null;
      const full=Object.entries(permitted).every(([key,q])=>sums[key]===q);if((phase==='locked'||a.phase==='open')&&!full||a.phase==='partial'&&full)return null;
    }else if(e.airdrop!==undefined)return null;
    if(e.kind==='recycler'){const site=webRecyclerSite(world,r.layoutId);if(!site||e.tx!==site.tx||e.ty!==site.ty||e.x!==site.tx*16+8||e.y!==site.ty*16+8||e.poi!=='factory'||e.type!==undefined||!e.station||e.station.queue?.length>1)return null;}
    if (e.deployed !== undefined && (!stack(e.deployed) || e.deployed.qty !== 1 || (e.kind === 'cart' ? e.deployed.key !== 'cart_kit' : e.kind === 'vehicle' ? e.deployed.key !== 'motorbike_kit' : e.kind !== 'struct' || STRUCTS[e.type]?.item !== e.deployed.key))) return null;
    if (['drop','bag','cart','vehicle','loot','cash'].includes(e.kind) && (!e.c || r.custody[e.c]?.kind !== e.kind)) return null;
    if(e.poiPower!==undefined){const p=e.poiPower;const valid=world.poiAccess?.doors.some(d=>d.generator?.tx===e.tx&&d.generator?.ty===e.ty);if(e.kind!=='gen'||!valid||!obj(p)||p.version!=='poi-access-v1'||!finite(p.fueledAt)||!finite(p.expiresAt)||!finite(p.budgetMs)||p.budgetMs<=0||p.budgetMs>86400000||!finite(p.runAt)||!finite(p.runMs)||p.runAt<p.fueledAt||p.runMs<=0||p.runMs>p.budgetMs||p.expiresAt!==p.runAt+p.runMs||![0,1].includes(e.power)||(p.pausedMs!==undefined&&(!finite(p.pausedMs)||p.pausedMs<=0||p.pausedMs>p.runMs||e.power!==0)))return null;}
    if(e.poiDoor!==undefined){const d=world.poiAccess?.doors.find(d=>d.tx===e.tx&&d.ty===e.ty);const p=e.poiDoor;if(e.kind!=='door'||!d||d.requirement!==e.locked||!obj(p)||p.version!=='poi-access-v1'||!finite(p.closeAt)||p.closeAt<r.startedAt||!integer(p.scans)||p.scans<0||(p.lastCardUid!==undefined&&(typeof p.lastCardUid!=='string'||!/^s[0-9a-z]+$/.test(p.lastCardUid)||!beforeNext(p.lastCardUid,/^s([a-z0-9]+)$/))))return null;}
    if(e.kind==='vehicle') {
      if(!e.deployed || !obj(e.vehicle) || e.vehicle.geometry!=='vehicle-geometry-v1' || !world.vehicleGeometry || !finite(e.vehicle.fuel) || e.vehicle.fuel<0 || e.vehicle.fuel>BAL.motorbike.tank || !finite(e.vehicle.angle) || !finite(e.vehicle.odometer) || e.vehicle.odometer<0 || (e.vehicle.lube!==undefined && (!finite(e.vehicle.lube) || e.vehicle.lube<0 || e.vehicle.lube>BAL.oilRefineryV1.lubricantDistancePx*1.5+1e-9)) || e.x<BAL.motorbike.radius || e.y<BAL.motorbike.radius || e.x>=WW*TILE-BAL.motorbike.radius || e.y>=WH*TILE-BAL.motorbike.radius || !finite(e.hp) || e.hp<0 || e.hp>BAL.motorbike.maxHp || e.maxHp!==BAL.motorbike.maxHp || e.deployed.dur!==e.hp || r.custody[e.c]?.slots.length!==BAL.motorbike.slots)return null;
      if(r.custody[e.c].slots.reduce((sum:number,s:any)=>sum+(s?ITEMS[s.key].w*s.qty:0),0)>BAL.motorbike.maxWeight+1e-8)return null;
    } else if(e.vehicle!==undefined)return null;
    if (e.kind === 'cart' && e.deployed?.upgrade === 'freight' && r.custody[e.c].slots.length !== BAL.cart.freightSlots) return null;
    if (e.kind === 'struct' && e.c && r.custody[e.c]?.kind !== 'chest') return null;
    const refs = [e.c, e.station?.fuelC, e.station?.outC].filter((v: any) => v !== undefined);
    for (const cid of refs) { if (typeof cid !== 'string' || !r.custody[cid] || ownedContainers.has(cid)) return null; ownedContainers.add(cid); }
    if (e.basePower !== undefined && (!obj(e.basePower) || e.type !== 'base_generator' || typeof e.basePower.enabled !== 'boolean' || !finite(e.basePower.energy) || e.basePower.energy < 0 || (e.basePower.capacity !== undefined && e.basePower.capacity !== 2) || (e.basePower.priority !== undefined && !['defense','production'].includes(e.basePower.priority)) || (e.basePower.network !== undefined && e.basePower.network!=='wire-v1') || !e.c)) return null;
    if(['power_cable','power_switch','pressure_switch','door_powered'].includes(e.type)) {
      if(e.kind!=='struct'||!integer(e.tx)||!integer(e.ty)||e.tx<1||e.ty<1||e.tx>=WW-1||e.ty>=WH-1||e.x!==e.tx*TILE+8||e.y!==e.ty*TILE+8)return null;
      if(e.type==='power_switch'&&(!obj(e.wireSwitch)||e.wireSwitch.version!=='wire-v1'||typeof e.wireSwitch.on!=='boolean'))return null;
      if(e.type==='door_powered'&&(!obj(e.electricDoor)||e.electricDoor.version!=='wire-v1'||!Array.isArray(e.electricDoor.interior)||e.electricDoor.interior.length!==2||![[1,0],[-1,0],[0,1],[0,-1]].some(v=>v[0]===e.electricDoor.interior[0]&&v[1]===e.electricDoor.interior[1])||(e.electricDoor.releaseUntil!==undefined&&(!finite(e.electricDoor.releaseUntil)||e.electricDoor.releaseUntil<r.startedAt))))return null;
    }
    if(e.wireSwitch!==undefined&&e.type!=='power_switch'||e.electricDoor!==undefined&&e.type!=='door_powered')return null;
    if(e.cabinet !== undefined && (!obj(e.cabinet) || e.type!=='claim' || !e.c || r.custody[e.c]?.slots.length!==24 || typeof e.cabinet.legacy!=='boolean' || !obj(e.cabinet.credit) || Object.entries(e.cabinet.credit).some(([k,v]:[string,any])=>!BAL.territory.materials.includes(k)||!finite(v)||v<0||v>1+1e-8)))return null;
    if(e.maintenance !== undefined && (!obj(e.maintenance) || e.type!=='claim' || typeof e.maintenance.enabled!=='boolean' || (e.maintenance.chestId!==undefined && (typeof e.maintenance.chestId!=='string'||!e.maintenance.chestId))))return null;
    if(e.industrial !== undefined && (!obj(e.industrial) || e.type!=='workbench' || !e.station || typeof e.industrial.enabled!=='boolean' || (e.industrial.generatorId!==undefined && (typeof e.industrial.generatorId!=='string'||!e.industrial.generatorId))))return null;
    if (e.turret !== undefined && (!obj(e.turret) || e.type !== 'arrow_turret' || typeof e.turret.enabled !== 'boolean' || !finite(e.turret.cooldown) || e.turret.cooldown < 0 || !finite(e.turret.angle) || (e.turret.tracking !== undefined && typeof e.turret.tracking !== 'boolean') || (e.turret.generatorId !== undefined && (typeof e.turret.generatorId !== 'string' || !e.turret.generatorId)) || !e.c)) return null;
    if (e.type === 'base_generator' && !e.basePower || e.type === 'arrow_turret' && !e.turret) return null;
    if(e.garden?.coldFrame !== undefined && (e.type !== 'garden' || e.garden.coldFrame !== true)) return null;
    if(e.farm !== undefined && (!obj(e.farm) || e.kind!=='struct' || e.type!=='farm_controller' || !e.c || r.custody[e.c]?.slots.length!==3 || typeof e.farm.enabled!=='boolean' || !['crop','herb'].includes(e.farm.crop) || !finite(e.farm.energy) || e.farm.energy<0 || e.farm.energy>90000 || ['gardenId','barrelId','chestId'].some(k=>e.farm[k]!==undefined && (typeof e.farm[k]!=='string'||!e.farm[k]))))return null;
    if(e.type==='farm_controller' && !e.farm)return null;
    if (e.station?.upgrade !== undefined && (e.type !== 'furnace' || e.station.upgrade !== 'kiln_lining')) return null;
    if (e.type === 'refinery' && (e.kind !== 'struct' || !finite(e.hp) || e.hp < 0 || e.hp > STRUCTS.refinery.hp || !e.station || e.station.level !== undefined)) return null;
    // Identity binds the station type: a refinery cannot be emptied and relabeled, and a non-refinery cannot claim refinery identity.
    if ((e.identity !== undefined && e.identity !== 'refinery-v1') || (e.identity === 'refinery-v1' && e.type !== 'refinery') || (e.type === 'refinery' && e.identity !== 'refinery-v1')) return null;
    if (e.station?.level !== undefined && (e.type !== 'workbench' || ![1, 2, 3].includes(e.station.level))) return null;
    if (e.station && (!obj(e.station) || !(e.kind==='recycler' || STRUCTS[e.type]?.station) || !finite(e.station.burn) || e.station.burn < 0 || r.custody[e.station.fuelC]?.kind !== 'fuel' || r.custody[e.station.outC]?.kind !== 'out' || !jobs(e.station.queue, e.kind==='recycler'?'recycler':STRUCTS[e.type].station!))) return null;
    if (e.legacyJobs && (e.kind !== 'bag' || !STRUCTS[e.legacyJobs.stationType]?.station || !jobs(e.legacyJobs.queue, STRUCTS[e.legacyJobs.stationType].station!) || e.legacyJobs.queue.some((j: any) => j.reserved !== undefined))) return null;
  }
  if(r.airdrops!==undefined && (!obj(r.airdrops)||r.airdrops.version!=='airdrop-v1'||!supportsAirdrops(r.layoutId)||r.sourceLayoutVersion!==3||r.airdrops.mapDigest!==r.sourceMap?.mapDigest||r.airdrops.mapDigest!==mapDigest(world)||r.airdrops.seed!==r.seed||r.airdrops.runId!==r.id||r.airdrops.startedAt!==r.startedAt||!integer(r.airdrops.nextIndex)||r.airdrops.nextIndex>BAL.airdropV1.maxEvents||r.airdrops.nextIndex!==Array.from({length:BAL.airdropV1.maxEvents},(_,i)=>airdropTimes(r,i).signalAt).filter(t=>t<=r.clock.lastSimAt).length))return null;
  if((Object.values(r.entities) as any[]).filter(e=>e.kind==='airdrop').length>1)return null;
  if(r.player.vehicle!==undefined) {const e=r.entities[r.player.vehicle];if(typeof r.player.vehicle!=='string'||!e||e.kind!=='vehicle'||r.player.dead||r.player.pulling||r.spiritTransit||r.player.x!==e.x||r.player.y!==e.y)return null;}
  if((Object.values(r.entities) as any[]).filter(e=>e.kind==='recycler').length>1)return null;
  for(const [key,offer] of Object.entries(VENDOR_SPARES)){const stock=r.vendorStock[`spares:${key}`];if(stock!==undefined && (!integer(stock) || stock>offer.stock))return null;}
  for(const g of Object.values(r.entities) as any[]) if(g.basePower&&g.basePower.network!=='wire-v1'){const links=(Object.values(r.entities) as any[]).filter(t=>t.turret?.generatorId===g.id).length;if(links>(g.basePower.capacity??1))return null;}
  if (r.wreckEconomy !== undefined && r.wreckEconomy !== 'direct-v1' && r.wreckEconomy !== 'recycler-v1') return null;
  if (r.wreckEconomy === 'recycler-v1' && !hasAuthorizedRecycler(r)) return null;
  // A retired site must be a real authored public loot site and cannot also
  // have a live instance. Absence of this additive ledger preserves old saves.
  const lootSites = new Set(world.statics.filter(s => s.kind === 'loot').map(s => s.ty * WW + s.tx));
  if (r.depletedLootSites !== undefined && (!Array.isArray(r.depletedLootSites) || r.depletedLootSites.some((i: any) => !integer(i) || !lootSites.has(i)) || new Set(r.depletedLootSites).size !== r.depletedLootSites.length)) return null;
  if (r.creatorLootV1 !== undefined && (r.creatorLootV1 !== true || !['shipping_fresh','dev_delta_fresh'].includes(r.layoutId) || r.sourceLayoutVersion!==3)) return null;
  if (r.renewedLootSites !== undefined && (!r.creatorLootV1 || !Array.isArray(r.renewedLootSites) || new Set(r.renewedLootSites).size!==r.renewedLootSites.length || r.renewedLootSites.some((i:any)=>!integer(i)||!lootSites.has(i)))) return null;
  if(r.poiAccessVersion!==undefined && r.poiAccessVersion!=='poi-access-v1')return null;
  if(r.poiAccessDigest!==undefined && (typeof r.poiAccessDigest!=='string'||r.poiAccessDigest!==poiContractDigest(world)))return null;
  if(r.poiAccessVersion==='poi-access-v1'&&world.poiAccess&&!r.poiAccessDigest)return null;
  if(r.poiAccessVersion==='poi-access-v1'){for(const s of world.statics.filter(s=>s.kind==='door'||s.kind==='gen')){const found=(Object.values(r.entities) as any[]).filter(e=>e.kind===s.kind&&e.tx===s.tx&&e.ty===s.ty);if(found.length!==1||found[0].x!==s.tx*TILE+TILE/2||found[0].y!==s.ty*TILE+TILE/2||(s.kind==='door'&&found[0].locked!==s.locked))return null;}}
  if(r.poiAccessVersion==='poi-access-v1'&&world.poiAccess){for(const d of world.poiAccess.doors){const doors=(Object.values(r.entities) as any[]).filter(e=>e.kind==='door'&&e.tx===d.tx&&e.ty===d.ty);if(doors.length!==1||doors[0].locked!==d.requirement)return null;if(d.generator&&(Object.values(r.entities) as any[]).filter(e=>e.kind==='gen'&&e.tx===d.generator!.tx&&e.ty===d.generator!.ty).length!==1)return null;}}
  if (r.lootEcology !== undefined) {
    const policy=r.lootEcology;
    if(!obj(policy) || policy.version!==LOOT_ECOLOGY_VERSION || !obj(policy.cycles) || !r.creatorLootV1 || !['shipping_fresh','dev_delta_fresh'].includes(r.layoutId))return null;
    for(const [key,value] of Object.entries(policy.cycles)) {
      if(!/^(0|[1-9][0-9]*)$/.test(key) || !Number.isSafeInteger(value) || (value as number)<1) return null;
      const site=world.statics.find(s=>s.kind==='loot' && lootSiteIndex(s)===Number(key));
      if(!site || !lootClass(site) || !r.renewedLootSites?.includes(Number(key)))return null;
    }
    for(const site of world.statics.filter(s=>lootClass(s))) {
      const index=lootSiteIndex(site);
      if(!!policy.cycles[index] !== !!r.renewedLootSites?.includes(index))return null;
    }
  }
  const depleted = new Set<number>(r.depletedLootSites || []);
  if (r.rest !== undefined && (!obj(r.rest) || r.rest.version !== 'rest-v1' || typeof r.rest.bedId !== 'string' || typeof r.rest.chestId !== 'string' || typeof r.rest.reserveId !== 'string' || !obj(r.custody[r.rest.reserveId]) || r.custody[r.rest.reserveId].kind !== 'rest' || !finite(r.rest.startedAt) || !finite(r.rest.targetAt) || r.rest.targetAt < r.rest.startedAt || !finite(r.rest.eatenHunger) || !finite(r.rest.drunkThirst))) return null;
  if (r.rest !== undefined) { if (ownedContainers.has(r.rest.reserveId)) return null; ownedContainers.add(r.rest.reserveId); }
  if (r.lootRespawnAt !== undefined && (!obj(r.lootRespawnAt) || Object.entries(r.lootRespawnAt).some(([key, value]) => !/^(0|[1-9][0-9]*)$/.test(key) || !depleted.has(Number(key)) || !finite(value) || (value as number) < r.startedAt))) return null;
  if ((Object.values(r.entities) as any[]).some(e => e.kind === 'loot' && depleted.has(e.ty * WW + e.tx))) return null;
  // New identity-pinned runs retain finite, map-authored cash and loot custody.
  // Older runs are not rewritten or guessed: their legacy history is preserved.
  if (r.sourceLayoutVersion === 3 && r.sourceMap?.mapDigest) {
    for (const site of world.statics.filter(s => s.kind === 'cash' || s.kind === 'loot')) {
      const matches=(Object.values(r.entities) as any[]).filter(e=>e.kind===site.kind && e.tx===site.tx && e.ty===site.ty);
      if (site.kind === 'loot' && depleted.has(site.ty * WW + site.tx)) { if (matches.length) return null; continue; }
      if (matches.length!==1) return null;
      const ent=matches[0], slots=r.custody[ent.c]?.slots; if (!Array.isArray(slots)) return null;
      if (site.kind==='cash') {
        if(typeof ent.minted!=='boolean' || !obj(ent.stock) || ent.stock.cash!==(ent.minted?0:site.cash) || slots.some((s:any)=>s && (s.key!=='rcash'||!ent.minted))) return null;
        if(slots.reduce((n:number,s:any)=>n+(s?.qty||0),0)>(site.cash||0))return null;
      } else {
        const cycle=r.lootEcology?.cycles[lootSiteIndex(site)] || 0;
        const base=r.lootEcology && lootClass(site) && cycle>0 ? renewableLoot(site) : site.loot || [];
        const available = new Map<string,number>(); for(const [k,q] of [...base,...lootRoll(r,site,cycle)]) available.set(k,(available.get(k)||0)+q); const unique=r.creatorLootV1 && !r.renewedLootSites?.includes(site.ty*WW+site.tx) && creatorLootV1(site);if(unique)available.set(unique,1);
        for(const stack of slots){if(!stack)continue;const key=stack.key==='blueprint'?`blueprint:${stack.meta}`:stack.key;const left=(available.get(key)||0)-stack.qty;if(left<0)return null;available.set(key,left);}
      }
    }
  }
  if (Object.keys(r.custody).some(id => !ownedContainers.has(id))) return null;
  return raw as GameState;
}

export function migrate(raw: any): LoadResult {
  if (raw.version === SAVE_VERSION) return { gs: raw };
  // Only structurally compatible older runs are resumed; never overwrite an incompatible one on load.
  const candidate = { ...raw, version: SAVE_VERSION };
  if (validate(candidate)) return { gs: candidate, note: `Save format v${raw.version} migrated with its run and profile intact.` };
  return { gs: null, note: `Save format v${raw.version} is incompatible; the original run and profile were left untouched for recovery.` };
}
function checksum(text: string) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); }
/** Each serialized snapshot gets a new sequence even when only the simulation changed. */
export function serializeSnapshot(gs: GameState): string {
  if (!validate(gs)) throw new Error('Refusing to save invalid game state.');
  if (gs.run && !gs.run.wreckEconomy) gs.run.wreckEconomy = wreckEconomy(gs.run);
  if (!Number.isSafeInteger(gs.revision + 1)) throw new Error('Snapshot sequence exhausted.');
  gs.revision++;
  const payload = JSON.stringify(gs);
  return JSON.stringify({ format: FORMAT, payload, checksum: checksum(payload) });
}
type Candidate = { gs: GameState; payload: string; legacy: boolean; index: number };
function decode(text: string, index: number): Candidate | null {
  try {
    const raw = JSON.parse(text);
    let payload = text, state = raw;
    if (raw?.format !== undefined) {
      if (raw.format !== FORMAT || typeof raw.payload !== 'string' || raw.checksum !== checksum(raw.payload)) return null;
      payload = raw.payload; state = JSON.parse(payload);
    }
    const v = validate(state); if (!v) return null;
    return { gs: v, payload: JSON.stringify(v), legacy: raw?.format === undefined, index };
  } catch { return null; }
}
/** Legacy writes did not increment revision for simulation. Same-run old copies can
 * therefore tie; use the later simulation timestamp and preserve the other bytes.
 * New-format ties or ties without an ordering signal remain ambiguous. */
export function selectSnapshots(copies: (string | null)[]): { gs: GameState | null; bad: number[]; conflict: boolean; unsupported: boolean; legacyAlternate: number | null } {
  const bad: number[] = []; const valid: Candidate[] = []; let unsupported = false;
  copies.forEach((text, i) => { if (text === null) return; try { const outer = JSON.parse(text); const value = outer?.format === FORMAT && typeof outer.payload === 'string' ? JSON.parse(outer.payload) : outer; if (Number.isInteger(value?.version) && value.version > SAVE_VERSION) unsupported = true; } catch { /* reported as damaged */ } const v = decode(text, i); if (v) valid.push(v); else bad.push(i); });
  valid.sort((a, b) => b.gs.revision - a.gs.revision);
  let top = valid[0]; let conflict = false; let legacyAlternate: number | null = null;
  if (top && valid[1] && top.gs.revision === valid[1].gs.revision && top.payload !== valid[1].payload) {
    const other = valid[1], a = top.gs.run, b = other.gs.run;
    if (top.legacy && other.legacy && a && b && a.id === b.id && a.startedAt === b.startedAt && a.clock.lastSimAt !== b.clock.lastSimAt) {
      if (b.clock.lastSimAt > a.clock.lastSimAt) { legacyAlternate = top.index; top = other; }
      else legacyAlternate = other.index;
    } else conflict = true;
  }
  return { gs: conflict || unsupported ? null : top?.gs ?? null, bad, conflict, unsupported, legacyAlternate };
}
export async function load(): Promise<LoadResult> {
  let text: string | null = null; let readFailed = false;
  const d = await db();
  if (d) text = await new Promise(res => { try { const tx = d.transaction(STORE, 'readonly'); const rq = tx.objectStore(STORE).get(KEY); rq.onsuccess = () => res(rq.result ?? null); rq.onerror = () => { readFailed = true; res(null); }; } catch { readFailed = true; res(null); } });
  idbReadable = !(dbFailed || readFailed);
  let ls: string | null = null; localReadable = true;
  try { if (typeof localStorage !== 'undefined') ls = localStorage.getItem(LS); } catch { localReadable = false; }
  const copies = [text, ls]; const selected = selectSnapshots(copies);
  if (selected.unsupported) return { gs: null, note: 'A save was created by a newer version. No copy was overwritten or downgraded.' };
  if (selected.conflict) return { gs: null, note: 'Save copies have the same sequence but different contents. Neither copy was overwritten.' };
  if (!selected.gs) {
    if (!idbReadable || !localReadable) return { gs: null, note: 'Browser storage could not be read. Save copies were left untouched; retry.' };
    if (selected.bad.length) return { gs: null, note: 'No valid compatible save was found. Original copies were left untouched for recovery.' };
    return { gs: newGame() };
  }
  const preserve = [...selected.bad, ...(selected.legacyAlternate === null ? [] : [selected.legacyAlternate])];
  if (preserve.length) {
    // Do not overwrite the alternate old save or rejected bytes before preserving them.
    try { for (const i of preserve) { const prefix = `soh.quarantine.${Date.now()}.${i}`; let key = prefix, n = 0; while (localStorage.getItem(key) !== null) key = `${prefix}.${++n}`; localStorage.setItem(key, copies[i]!); } }
    catch { return { gs: null, note: 'A save copy could not be preserved. Original copies were left untouched; retry after freeing storage.' }; }
  }
  const m = migrate(selected.gs); const r = m.gs?.run;
  if (r && !r.wreckEconomy) r.wreckEconomy = wreckEconomy(r);
  const legacy = r && Object.values(r.entities).some(e => e.station?.queue.some(j => j.reserved === undefined) || e.legacyJobs?.queue.length);
  const notes = [selected.bad.length ? 'A damaged save copy was quarantined; a valid copy was recovered, but it may be older.' : '', selected.legacyAlternate !== null ? 'An older save copy was preserved; the later same-run snapshot was continued.' : '', !idbReadable || !localReadable ? 'A browser storage copy could not be read and will not be overwritten this session.' : '', m.note || '', legacy ? 'Older queued jobs have no recorded inputs: finish them before cancellation or reclaim; destroyed jobs can be resumed from their recovery bag.' : ''].filter(Boolean);
  return { gs: m.gs, note: notes.join(' ') || undefined };
}
let writeTail: Promise<unknown> = Promise.resolve();
export async function save(gs: GameState): Promise<boolean> {
  let text: string; try { text = serializeSnapshot(gs); } catch { return false; }
  let local = false; try { if (localReadable) { localStorage.setItem(LS, text); local = true; } } catch { /* quota */ }
  const write = async () => {
    if (!idbReadable) return false; const d = await db(); if (!d) return false;
    return await new Promise<boolean>(res => { try { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(text, KEY); tx.oncomplete = () => res(true); tx.onerror = () => res(false); tx.onabort = () => res(false); } catch { res(false); } });
  };
  const result = writeTail.then(write, write); writeTail = result;
  return local || await result;
}
export function saveSync(gs: GameState): boolean { try { if (!localReadable) return false; localStorage.setItem(LS, serializeSnapshot(gs)); return true; } catch { return false; } }
export async function wipeAll() { try { localStorage.removeItem(LS); } catch { /* */ } const d = await db(); if (d) await new Promise<void>(res => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(KEY); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
