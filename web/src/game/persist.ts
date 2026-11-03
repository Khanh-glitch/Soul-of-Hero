// Local-first snapshots: one serialized profile + run + receipts per write.
// Checksums detect accidental damage, not malicious edits or rollback of all copies.
import { BAL, SAVE_VERSION, type GameState, type Stack } from './core';
import { ITEMS, RECIPES, STRUCTS, SOURCES } from './catalog';
import { newGame } from './engine';
import { getWorld, hasLayout } from './world';
import { mapDigest } from './map-package';
import { sourceDigest } from './world-economy';

const DB = 'soul-of-hero', STORE = 'kv', KEY = 'state', LS = 'soh.state.v' + SAVE_VERSION;
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
  } else if (baseline[layout] !== fingerprint) return null;
  if (r.sourceLayoutVersion !== 3 && r.sourceMap !== undefined) return null;
  if (!['x','y','hp','stamina','hunger','thirst','warmth','rad','active'].every(k => finite(r.player[k])) || !obj(r.player.skills) || typeof r.player.dead !== 'boolean' || !finite(r.clock.lastSimAt) || !finite(r.clock.simMs) || !finite(r.clock.respawnAcc) || !finite(r.clock.weatherSlot)) return null;
  if (!Array.isArray(r.creatures) || !obj(r.sources) || !obj(r.terrain) || !obj(r.knowledge) || !stringArray(r.knowledge.recipes) || !stringArray(r.knowledge.studied) || !r.knowledge.recipes.every((k: string) => has(RECIPES, k)) || !Array.isArray(r.traces) || !Array.isArray(r.discovered) || !stringArray(r.poiSeen) || !stringArray(r.elderStones) || !stringArray(r.achievements) || !Array.isArray(r.receipts) || !stringArray(r.seenIntents) || !obj(r.vendorStock) || !Object.values(r.vendorStock).every(integer) || !integer(r.score) || !integer(r.deposited) || !Array.isArray(r.log)) return null;
  if (r.sourceLayoutVersion === 3) for (const [key, st] of Object.entries(r.sources) as [string, any][]) {
    const i=Number(key); if (!Number.isInteger(i) || String(i)!==key || i<0 || i>=world.sourceV3.length || !world.sourceV3[i] || !obj(st)) return null;
    const def=SOURCES[st.burnt ? 'deadtree' : world.sourceV3[i]!];
    if (!def || !finite(st.stock) || !Number.isInteger(st.stock) || st.stock<0 || st.stock>def.stock || !finite(st.hp) || st.hp<0 || st.hp>def.hp || (st.burnt!==undefined && typeof st.burnt!=='boolean') || (st.regrowAt!==undefined && (!finite(st.regrowAt)||st.regrowAt<0)) || (st.fire!==undefined && (!finite(st.fire)||st.fire<0))) return null;
  }
  if (!r.custody.inv || !r.custody.eq || r.custody.inv.kind !== 'inv' || r.custody.eq.kind !== 'eq' || r.custody.inv.slots?.length !== 24 || r.custody.eq.slots?.length !== 3) return null;
  if (!Number.isInteger(r.player.active) || r.player.active < 0 || r.player.active > 7 || !['vx','vy','dir','aim','invuln','deadT','stepAcc','lastTraceX','lastTraceY'].every(k => finite(r.player[k])) || !['gather','combat','craft','survival'].every(k => finite(r.player.skills[k]))) return null;
  const beforeNext = (id: string, re: RegExp) => { const m = re.exec(id); return !m || parseInt(m[1], 36) < r.nextId; };
  if (r.creatures.some((m: any) => !obj(m) || typeof m.id !== 'string' || !beforeNext(m.id, /^m([a-z0-9]+)$/) || typeof m.type !== 'string' || typeof m.state !== 'string' || !finite(m.x) || !finite(m.y) || !finite(m.hp))) return null;
  const uids = new Set<string>(), ownedContainers = new Set<string>(['inv', 'eq']);
  const stack = (s: any): s is Stack => {
    if (!obj(s) || typeof s.uid !== 'string' || !s.uid || !beforeNext(s.uid, /^s([a-z0-9]+)$/) || uids.has(s.uid) || typeof s.key !== 'string' || !has(ITEMS, s.key) || !integer(s.qty) || s.qty < 1 || s.qty > ITEMS[s.key].max) return false;
    if (s.upgrade !== undefined && (s.key !== 'cart_kit' || s.upgrade !== 'freight')) return false;
    if ((s.dur !== undefined && (!finite(s.dur) || s.dur < 0)) || (s.charge !== undefined && (!finite(s.charge) || s.charge < 0)) || (s.meta !== undefined && typeof s.meta !== 'string') || (s.key === 'blueprint' && (!s.meta || !has(RECIPES, s.meta)))) return false;
    uids.add(s.uid); return true;
  };
  for (const [id, c] of Object.entries(r.custody) as [string, any][]) {
    if (!obj(c) || c.id !== id || (id !== 'inv' && id !== 'eq' && !beforeNext(id, /^c([a-z0-9]+)$/)) || !['inv','eq','drop','bag','cart','loot','cash','chest','fuel','out'].includes(c.kind) || !Array.isArray(c.slots)) return null;
    for (let i = 0; i < c.slots.length; i++) { const s = c.slots[i]; if (s !== null && (!stack(s) || (c.kind === 'eq' && ITEMS[s.key].slot !== ['head','body','back'][i]) || (c.kind === 'fuel' && !ITEMS[s.key].fuel))) return null; }
  }
  const jobIds = new Set<string>();
  const jobs = (queue: any, station: string): boolean => Array.isArray(queue) && queue.every((j: any) => {
    if (!obj(j) || typeof j.id !== 'string' || !j.id || jobIds.has(j.id) || !beforeNext(j.id, /^j([a-z0-9]+)$/) || typeof j.recipe !== 'string') return false;
    const research = j.recipe.startsWith('R:'), recipe = research ? j.recipe.slice(2) : j.recipe;
    if (!has(RECIPES, recipe) || (station === 'research' ? !research : research || RECIPES[recipe].station !== station) || !finite(j.left) || !finite(j.total) || j.total <= 0 || j.left < 0 || j.left > j.total || (j.reserved !== undefined && (!Array.isArray(j.reserved) || !j.reserved.every(stack)))) return false;
    jobIds.add(j.id); return true;
  });
  for (const [id, e] of Object.entries(r.entities) as [string, any][]) {
    if (!obj(e) || e.id !== id || !beforeNext(id, /^(?:cart|[ebd])([a-z0-9]+)$/) || typeof e.kind !== 'string' || !finite(e.x) || !finite(e.y)) return null;
    if (!['drop','struct','bag','cart','loot','cash','vendor','evac','door','gen'].includes(e.kind)) return null;
    if (e.kind === 'struct' && !has(STRUCTS, e.type)) return null;
    if (e.deployed !== undefined && (!stack(e.deployed) || e.deployed.qty !== 1 || (e.kind === 'cart' ? e.deployed.key !== 'cart_kit' : e.kind !== 'struct' || STRUCTS[e.type]?.item !== e.deployed.key))) return null;
    if (['drop','bag','cart','loot','cash'].includes(e.kind) && (!e.c || r.custody[e.c]?.kind !== e.kind)) return null;
    if (e.kind === 'cart' && e.deployed?.upgrade === 'freight' && r.custody[e.c].slots.length !== BAL.cart.freightSlots) return null;
    if (e.kind === 'struct' && e.c && r.custody[e.c]?.kind !== 'chest') return null;
    const refs = [e.c, e.station?.fuelC, e.station?.outC].filter((v: any) => v !== undefined);
    for (const cid of refs) { if (typeof cid !== 'string' || !r.custody[cid] || ownedContainers.has(cid)) return null; ownedContainers.add(cid); }
    if (e.station?.upgrade !== undefined && (e.type !== 'furnace' || e.station.upgrade !== 'kiln_lining')) return null;
    if (e.station?.level !== undefined && (e.type !== 'workbench' || ![1, 2].includes(e.station.level))) return null;
    if (e.station && (!obj(e.station) || !STRUCTS[e.type]?.station || !finite(e.station.burn) || e.station.burn < 0 || r.custody[e.station.fuelC]?.kind !== 'fuel' || r.custody[e.station.outC]?.kind !== 'out' || !jobs(e.station.queue, STRUCTS[e.type].station!))) return null;
    if (e.legacyJobs && (e.kind !== 'bag' || !STRUCTS[e.legacyJobs.stationType]?.station || !jobs(e.legacyJobs.queue, STRUCTS[e.legacyJobs.stationType].station!) || e.legacyJobs.queue.some((j: any) => j.reserved !== undefined))) return null;
  }
  // New identity-pinned runs retain finite, map-authored cash and loot custody.
  // Older runs are not rewritten or guessed: their legacy history is preserved.
  if (r.sourceLayoutVersion === 3 && r.sourceMap?.mapDigest) {
    for (const site of world.statics.filter(s => s.kind === 'cash' || s.kind === 'loot')) {
      const matches=(Object.values(r.entities) as any[]).filter(e=>e.kind===site.kind && e.tx===site.tx && e.ty===site.ty);
      if (matches.length!==1) return null;
      const ent=matches[0], slots=r.custody[ent.c]?.slots; if (!Array.isArray(slots)) return null;
      if (site.kind==='cash') {
        if(typeof ent.minted!=='boolean' || !obj(ent.stock) || ent.stock.cash!==(ent.minted?0:site.cash) || slots.some((s:any)=>s && (s.key!=='rcash'||!ent.minted))) return null;
        if(slots.reduce((n:number,s:any)=>n+(s?.qty||0),0)>(site.cash||0))return null;
      } else {
        const available = new Map<string,number>(); for(const [k,q] of site.loot || []) available.set(k,(available.get(k)||0)+q);
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
