// OfflineReturnV1 (B03-C): typed, grouped read-model for the Continue -> settle -> report route.
// Built only from (a) receipts committed during this settle window and (b) before/after snapshots of
// real player, structure, station, tender and cabinet state. It never grants loot, never collects items,
// and never reveals enemy positions. Ephemeral: not persisted; rebuilt from receipts on each Continue.
import { BAL, HOUR, TILE, type GameState, type RunState } from './core';
import { ITEMS, STRUCTS, RECIPES } from './catalog';
import { C, countItem, territoryForecast, tenderState, weatherAt, beginReceiptSink, endReceiptSink, owned } from './engine';
import { settle } from './sim';

export type ReturnTone = 'ok' | 'gold' | 'warn' | 'bad' | 'muted';
export interface ReturnRow {
  id: string;
  tone: ReturnTone;
  text: string;
  /** Physical place to go (own structures only). Never a hidden enemy location. */
  where?: { tx: number; ty: number; name: string };
  /** Committed receipt ids that support this row (empty for live-state rows). */
  receipts: string[];
  /** 'event' = backed by a committed, timed receipt; 'state' = read-only reading of the world at Continue. */
  source: 'event' | 'state';
}
export type ReturnSectionId = 'body' | 'home' | 'production' | 'loss' | 'world';
export interface OfflineReturnV1 {
  version: 'offline-return-v1';
  away: { fromAt: number; toAt: number; gapMs: number; expired: boolean; quiet: boolean };
  summary: string;
  sections: Record<ReturnSectionId, ReturnRow[]>;
  next: string[];
  /** Number of committed receipts read for this window (for auditing duplicate-free Continue). */
  receiptCount: number;
}

interface Snap {
  at: number;
  player: { hp: number; hunger: number; thirst: number; warmth: number; sheltered: boolean; dead: boolean; food: number };
  structs: Record<string, { name: string; tx: number; ty: number; hp: number; maxHp: number }>;
  stations: Record<string, { name: string; tx: number; ty: number; state?: string; out: string[]; queue: string[] }>;
  tenders: Record<string, { tx: number; ty: number; code: string; label: string; paused: boolean; crop: string; growth: number; chest: string[] }>;
  cabinets: Record<string, { tx: number; ty: number; stock: Record<string, number>; hours: number; funded: boolean }>;
}

const nm = (type?: string) => (type && STRUCTS[type]?.name) || type || 'Structure';
const stackList = (r: RunState, cid?: string) => {
  if (!cid) return [];
  const totals = new Map<string, number>();
  for (const s of C(r, cid).slots) if (s) { const n = ITEMS[s.key]?.name ?? s.key; totals.set(n, (totals.get(n) ?? 0) + s.qty); }
  return [...totals].map(([n, q]) => `${n} ×${q}`);
};
/** A real surviving container at a tile (dropped bag or drop), with its verified stack names. Null when none exists. */
const wreckageAt = (r: RunState, tx: number, ty: number): string[] | null => {
  const e = Object.values(r.entities).find(x => (x.kind === 'bag' || x.kind === 'drop') && x.c && Math.floor(x.x / TILE) === tx && Math.floor(x.y / TILE) === ty);
  return e && e.c ? stackList(r, e.c) : null;
};
const r1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** Captures the physical state a player can observe on return. Reads only; never mutates. */
export function captureReturnSnapshot(gs: GameState): Snap | null {
  const r = gs.run; if (!r) return null;
  const p = r.player;
  const snap: Snap = {
    at: r.clock.lastSimAt,
    player: { hp: p.hp, hunger: p.hunger, thirst: p.thirst, warmth: p.warmth, sheltered: !!p.sheltered, dead: !!p.dead, food: C(r, 'inv').slots.reduce((v, s) => v + (s && ITEMS[s.key]?.food ? s.qty : 0), 0) },
    structs: {}, stations: {}, tenders: {}, cabinets: {},
  };
  for (const e of Object.values(r.entities)) {
    const playerStruct = e.kind === 'struct' && !e.poi && owned(e);
    if (playerStruct && e.hp !== undefined && e.maxHp !== undefined)
      snap.structs[e.id] = { name: nm(e.type), tx: e.tx ?? 0, ty: e.ty ?? 0, hp: e.hp, maxHp: e.maxHp };
    if (playerStruct && e.station && e.type) snap.stations[e.id] = { name: nm(e.type), tx: e.tx ?? 0, ty: e.ty ?? 0, state: e.station.stateCode ?? (e.type === 'campfire' ? (stackList(r, e.station.fuelC).length ? 'fueled' : 'fuel_out') : undefined), out: stackList(r, e.station.outC), queue: e.station.queue.map(j => (RECIPES[j.recipe.replace(/^R:/, '')]?.out ? ITEMS[RECIPES[j.recipe.replace(/^R:/, '')].out].name : j.recipe)) };
    if (playerStruct && e.farm && e.type === 'farm_controller') {
      const st = tenderState(r, e);
      const gardenE = e.farm.gardenId ? r.entities[e.farm.gardenId] : undefined;
      const chestE = e.farm.chestId ? r.entities[e.farm.chestId] : undefined;
      snap.tenders[e.id] = { tx: e.tx ?? 0, ty: e.ty ?? 0, code: st.code, label: st.label, paused: st.paused, crop: gardenE?.garden?.crop ?? '', growth: gardenE?.garden?.growth ?? 0, chest: stackList(r, chestE?.c) };
    }
  }
  for (const c of Object.values(r.entities)) {
    if (c.type !== 'claim' || !c.c || !c.cabinet || !(c.kind === 'struct' && !c.poi && owned(c))) continue;
    const stock: Record<string, number> = {};
    for (const k of BAL.territory.materials as string[]) stock[k] = countItem(r, c.c, k);
    const f = territoryForecast(r, c);
    snap.cabinets[c.id] = { tx: c.tx ?? 0, ty: c.ty ?? 0, stock, hours: f.funded ? f.hours : 0, funded: f.funded };
  }
  return snap;
}

function receiptRows(gs: GameState, receipts: { id: string; at: number; kind: string; detail: string }[], start: number, out: Record<ReturnSectionId, Omit<ReturnRow, "source">[]>) {
  const r = gs.run!; const seen = new Set<string>();
  const rel = (at: number) => { const m = Math.max(0, Math.round((at - start) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  const structAt = (id: string) => { const e = r.entities[id]; return e ? { tx: e.tx ?? 0, ty: e.ty ?? 0, name: e.kind === 'bag' ? 'your bag' : nm(e.type) } : undefined; };
  const LOCATED = ['station.state', 'tender.state', 'tender.harvest', 'tender.plant', 'heat.out', 'territory.collapse', 'job.done'];
  // R3: a receipt that names an existing entity is shown only if that entity is a player-owned, non-POI structure.
  const hiddenSource = (x: { kind: string; detail: string }) => {
    if (!LOCATED.includes(x.kind)) return false;
    const e = r.entities[x.detail.split(':')[0]];
    return !!e && !(e.kind === 'struct' && !e.poi && owned(e));
  };
  for (const x of receipts) {
    if (hiddenSource(x)) continue;
    const key = `${x.kind}|${x.detail}|${x.at}`; if (seen.has(key)) continue; seen.add(key);
    const id = x.id;
    switch (x.kind) {
      case 'job.done': { const recipe = x.detail.slice(x.detail.indexOf(':') + 1); out.production.push({ id, tone: 'ok', text: `${rel(x.at)} in: a workshop job finished (${recipe}); output waits in its container.`, receipts: [id] }); break; }
      case 'vehicle.unload': { const [vuid, bagId, list] = x.detail.split(':'); const n = (list || '').split(',').filter(Boolean).length; out.loss.push({ id, tone: 'warn', text: `${rel(x.at)} in: motorbike ${vuid} cargo (${n} stack${n === 1 ? '' : 's'}) was unloaded into a ground bag beside it. Walk to the bag to take it back; nothing was copied.`, where: structAt(bagId), receipts: [id] }); break; }
      case 'station.state': {
        const [sid, change] = x.detail.split(':'); const [from, to] = (change || '').split('>');
        const e = r.entities[sid]; const w = e ? { tx: e.tx ?? 0, ty: e.ty ?? 0, name: nm(e.type) } : undefined;
        const text = to === 'output_full' ? `${rel(x.at)} in: paused — output container full.` : to === 'fuel_out' ? `${rel(x.at)} in: paused — fuel ran out.` : to === 'running' ? `${rel(x.at)} in: running again.` : `${rel(x.at)} in: ${to}.`;
        out.production.push({ id, tone: to === 'running' ? 'ok' : 'warn', text, where: w, receipts: [id] }); break;
      }
      case 'tender.state': {
        const [sid, change = ''] = x.detail.split(':'); const m = change.match(/^(.*)>(.*?)(?::(paused|running))?$/);
        const to = m?.[2] ?? change, paused = m?.[3] === 'paused';
        out.production.push({ id, tone: paused ? 'warn' : 'ok', text: `${rel(x.at)} in: Garden Tender ${paused ? 'paused' : 'running'} — ${to.replace(/_/g, ' ')}.`, where: structAt(sid), receipts: [id] });
        break;
      }
      case 'tender.harvest': out.production.push({ id, tone: 'ok', text: `${rel(x.at)} in: ripe crop harvested into the linked chest.`, where: structAt(x.detail.split(':')[0]), receipts: [id] }); break;
      case 'tender.plant': out.production.push({ id, tone: 'ok', text: `${rel(x.at)} in: planted with a paid seed.`, where: structAt(x.detail.split(':')[0]), receipts: [id] }); break;
      case 'heat.out': out.home.push({ id, tone: 'warn', text: `${rel(x.at)} in: your ${x.detail.split(':')[1] === 'furnace' ? 'furnace' : 'campfire'} went out — paid fuel exhausted; its warmth stopped.`, where: structAt(x.detail.split(':')[0]), receipts: [id] }); break;
      case 'heat.shelter_lost': out.home.push({ id, tone: 'bad', text: `${rel(x.at)} in: you lost your enclosed shelter (roof or wall lost); shelter warmth stopped.`, receipts: [id] }); break;
      case 'territory.upkeep': break; // summarized from cabinet stock deltas
      case 'territory.collapse': { const [sid, name, reason] = x.detail.split(':'); out.loss.push({ id, tone: 'bad', text: `${rel(x.at)} in: ${name} collapsed (${reason}).`, where: structAt(sid), receipts: [id] }); break; }
      case 'struct.destroyed': out.loss.push({ id, tone: 'bad', text: `${rel(x.at)} in: a structure was destroyed (${x.detail}). Its contents are not promised; check the site for any surviving bag.`, receipts: [id] }); break;
      case 'death': { const bag = x.detail.match(/bag=([^;]+)/)?.[1]; const b = bag && bag !== 'none' ? structAt(bag) : undefined; out.body.push({ id, tone: 'bad', text: `${rel(x.at)} in: you died (${x.detail.split(';')[0]}). ${bag && bag !== 'none' ? 'Your belongings are in a bag where you fell.' : 'No surviving bag is recorded for this death.'}`, where: b, receipts: [id] }); break; }
      case 'rest.end': out.body.push({ id, tone: 'ok', text: `${rel(x.at)} in: rest ended; you are awake.`, receipts: [id] }); break;
      case 'rest.eat': case 'rest.drink': case 'rest.drink.food': out.body.push({ id, tone: 'gold', text: `${rel(x.at)} in: rest consumed provisions (${x.detail}).`, receipts: [id] }); break;
      case 'offline.creature_death': {
        const n = parseInt(x.detail, 10) || 0;
        out.world.push({ id, tone: 'warn', text: `${rel(x.at)} in: ${n} creature${n === 1 ? '' : 's'} died while you were away (instrument not proven by this record). Anything they dropped lies where they fell — walk there to look.`, receipts: [id] });
        break;
      }
      case 'offline.hazards_cleared': {
        const n = parseInt(x.detail, 10) || 0;
        out.world.push({ id, tone: 'muted', text: `${rel(x.at)} in: ${n} hostile hazard${n === 1 ? '' : 's'} in flight at logout dissipated while you were away; none can strike you after return.`, receipts: [id] });
        break;
      }
      case 'offline.projectiles_cleared': {
        const n = parseInt(x.detail, 10) || 0;
        out.world.push({ id, tone: 'muted', text: `${rel(x.at)} in: ${n} hostile projectile${n === 1 ? '' : 's'} in flight at logout lost effect while you were away; none can strike you after return.`, receipts: [id] });
        break;
      }
      case 'airdrop.signal': case 'airdrop.descent': case 'airdrop.accessible': out.world.push({ id, tone: 'gold', text: `${rel(x.at)} in: public airdrop signal — ${x.kind.replace('airdrop.', '')}.`, receipts: [id] }); break;
      default: break;
    }
  }
}

/** Build OfflineReturnV1 from the window's receipts and the before/after snapshots. */
export function buildOfflineReturn(gs: GameState, before: Snap | null, receipts: { id: string; at: number; kind: string; detail: string }[], start: number, end: number, expired: boolean): OfflineReturnV1 {
  const out: Record<ReturnSectionId, Omit<ReturnRow, "source">[]> = { body: [], home: [], production: [], loss: [], world: [] };
  const r = gs.run; const after = captureReturnSnapshot(gs);
  const gapMs = Math.max(0, end - start);
  // A duration by itself never proves that something happened. Quiet is decided
  // after comparing actual physical snapshots and committed receipts below.
  let quiet = false;
  if (before && after) {
    const bp = before.player, ap = after.player;
    const vitalsDanger = ap.dead || ap.hp < 25 || ap.hunger < 20 || ap.thirst < 20 || ap.warmth < 25;
    const vitalsWarn = ap.hp < 50 || ap.hunger < 45 || ap.thirst < 45 || ap.warmth < 45;
    out.body.push({ id: 'vitals', tone: vitalsDanger ? 'bad' : vitalsWarn ? 'warn' : 'muted', text: `NOW · HP ${r1(ap.hp)} · Hunger ${r1(ap.hunger)} · Thirst ${r1(ap.thirst)} · Warmth ${r1(ap.warmth)}`, receipts: [] });
    // An actual before/after change is NOT a timed engine receipt. Distinguish
    // observed physical deterioration from a generic live reading.
    const shifts = ([['HP', bp.hp, ap.hp], ['Hunger', bp.hunger, ap.hunger], ['Thirst', bp.thirst, ap.thirst], ['Warmth', bp.warmth, ap.warmth]] as const)
      .filter(([, before, after]) => before - after >= 15);
    if (shifts.length) out.body.push({ id: 'shift:vitals', tone: vitalsDanger ? 'bad' : 'warn', text: `Observed decline: ${shifts.map(([name, before, after]) => `${name} ${r1(before)} → ${r1(after)}`).join(' · ')}`, receipts: [] });
    out.body.push({ id: 'shelter', tone: ap.sheltered ? 'ok' : 'warn', text: ap.sheltered ? 'Sheltered now (roofed, enclosed).' : 'Not sheltered now.', receipts: [] });
    if (ap.dead) {
      const deadBag = r && Object.values(r.entities).find(x => x.kind === 'bag' && x.c && Math.floor(x.x / TILE) === Math.floor(r.player.x / TILE) && Math.floor(x.y / TILE) === Math.floor(r.player.y / TILE));
      out.body.push({ id: 'dead', tone: 'bad', text: deadBag ? `You are dead. A bag (${deadBag.id}) is on the ground where you fell.` : 'You are dead. No surviving bag is confirmed at your death tile.', receipts: [] });
    }
    if (bp.food !== ap.food) out.body.push({ id: 'food', tone: 'gold', text: `Food items ${bp.food} → ${ap.food} (physical stacks only).`, receipts: [] });
    for (const [id, c] of Object.entries(after.cabinets)) {
      const b = before.cabinets[id];
      if (b) {
        const debits = (BAL.territory.materials as string[]).filter(k => (b.stock[k] ?? 0) !== (c.stock[k] ?? 0)).map(k => `${ITEMS[k].name} ${b.stock[k]} → ${c.stock[k]}`);
        out.home.push({ id: `cab:${id}`, tone: c.funded ? 'ok' : 'warn', text: `Cabinet ${c.tx},${c.ty}: ${debits.length ? debits.join(', ') : 'stock unchanged'}. ${c.funded ? `Forecast, not guaranteed: about ${Number.isFinite(c.hours) ? r1(c.hours) + ' h' : 'unlimited'} of upkeep at current stock.` : 'Unfunded: structures under this cabinet decay.'}`, where: { tx: c.tx, ty: c.ty, name: 'Cabinet' }, receipts: [] });
      }
    }
    for (const [id, s] of Object.entries(after.structs)) {
      const b = before.structs[id];
      if (b && s.hp < b.hp - 0.01) out.home.push({ id: `hp:${id}`, tone: s.hp < s.maxHp * 0.5 || b.hp - s.hp >= Math.max(8, s.maxHp * 0.15) ? 'bad' : 'warn', text: `${s.name} ${s.tx},${s.ty}: ${Math.round(b.hp)} → ${Math.round(s.hp)} HP.`, where: { tx: s.tx, ty: s.ty, name: s.name }, receipts: [] });
      if (s.hp < s.maxHp * 0.5 && s.hp > 0) out.home.push({ id: `rep:${id}`, tone: 'warn', text: `${s.name} ${s.tx},${s.ty} needs repair (${Math.round(s.hp)}/${s.maxHp} HP).`, where: { tx: s.tx, ty: s.ty, name: s.name }, receipts: [] });
      if (!b && s.hp <= 0) out.loss.push({ id: `gone:${id}`, tone: 'bad', text: `${s.name} at ${s.tx},${s.ty} is gone.`, receipts: [] });
    }
    for (const [id, b] of Object.entries(before.structs)) if (!after.structs[id] && !out.loss.some(x => x.id === `gone:${id}`)) { const w = wreckageAt(r!, b.tx, b.ty); out.loss.push({ id: `lost:${id}`, tone: 'bad', text: `${b.name} at ${b.tx},${b.ty} was lost. ${w ? `Items physically present at this tile (origin not verified): ${w.join(', ') || 'empty bag'}.` : 'No container is recorded at this tile, so no items are promised.'}`, where: { tx: b.tx, ty: b.ty, name: b.name }, receipts: [] }); }
    for (const [id, s] of Object.entries(after.stations)) {
      const detail = s.out.length ? `output container: ${s.out.join(', ')}` : 'output container empty';
      out.production.push({ id: `st:${id}`, tone: s.state === 'output_full' || s.state === 'fuel_out' ? 'warn' : 'muted', text: `${s.name} ${s.tx},${s.ty}: ${(s.state ?? 'idle').replace(/_/g, ' ')}; ${s.queue.length ? `queue ${s.queue.join(', ')}` : 'no job'}; ${detail}.`, where: { tx: s.tx, ty: s.ty, name: s.name }, receipts: [] });
    }
    for (const [id, t] of Object.entries(after.tenders)) {
      out.production.push({ id: `tn:${id}`, tone: t.paused ? 'warn' : 'ok', text: `Garden Tender ${t.tx},${t.ty}: ${t.label}${t.crop ? ` · plot ${t.crop} ${Math.round(t.growth * 100)}%` : ''} · chest: ${t.chest.join(', ') || 'empty'}.`, where: { tx: t.tx, ty: t.ty, name: 'Garden Tender' }, receipts: [] });
    }
  }
  if (r) receiptRows(gs, receipts, start, out);
  // Known-world rows: public signals and locally sensed footprints only (no hidden enemy positions).
  if (r) {
    const nearby = r.traces.filter(tr => Math.hypot(tr.x - r.player.x, tr.y - r.player.y) <= 64).length;
    out.world.push({ id: 'weather', tone: 'muted', text: `Weather now: ${weatherAt(r, end)}. ${nearby} footprint${nearby === 1 ? '' : 's'} visible in the immediate area.`, receipts: [] });
  }
  // Next physical actions (prioritize critical losses/body/stalls/unfunded cabinets before minor wear).
  const next: string[] = [];
  const pushNext = (line: string) => { if (!next.includes(line)) next.push(line); };
  for (const row of [...out.body, ...out.loss]) {
    if ((row.tone === 'bad' || row.tone === 'warn') && row.where) pushNext(`Go to ${row.where.name} ${row.where.tx},${row.where.ty}.`);
  }
  for (const row of out.production) if (row.tone === 'warn' && row.where) pushNext(`Walk to ${row.where.name} ${row.where.tx},${row.where.ty} and clear the pause.`);
  if (before && after) for (const [id, c] of Object.entries(after.cabinets)) if (!c.funded) pushNext(`Fund Cabinet ${c.tx},${c.ty} with materials on hand.`);
  for (const row of out.home) {
    if (!row.id.startsWith('rep:') && row.tone === 'bad' && row.where) pushNext(`Go to ${row.where.name} ${row.where.tx},${row.where.ty}.`);
  }
  const repCount = out.home.filter(row => row.id.startsWith('rep:')).length;
  if (repCount > 0) pushNext(`Repair ${repCount} worn base structure${repCount === 1 ? '' : 's'} below 50% HP.`);
  // No imaginary offline milestones: no receipt + no measured inventory/base
  // delta is a quiet return even after a long absence. Current shelter/station
  // warnings still appear under NOW and urgent HUD, but aren't forged events.
  const measuredChange = out.body.some(x => x.id === 'food' || x.id.startsWith('shift:')) ||
    out.home.some(x => x.id.startsWith('hp:') || (x.id.startsWith('cab:') && !x.text.includes('stock unchanged'))) ||
    out.loss.some(x => x.id.startsWith('lost:') || x.id.startsWith('gone:'));
  quiet = !expired && receipts.length === 0 && !measuredChange;
  // Tag provenance: rows with receipts are events; rows derived from the read-only snapshot are current state.
  for (const k of Object.keys(out) as ReturnSectionId[]) out[k] = out[k].map(row => ({ ...row, source: row.receipts.length ? 'event' : 'state' }));
  const summary = expired ? 'The 336-hour run ended while you were away.' : quiet ? `No recorded production or asset changes during ${gapMs >= HOUR ? (gapMs / HOUR).toFixed(1) + ' h' : Math.round(gapMs / 60000) + ' min'} away. Current condition is shown separately.` : `Away ${gapMs >= HOUR ? (gapMs / HOUR).toFixed(1) + ' h' : Math.round(gapMs / 60000) + ' min'}. ${receipts.length} timed event${receipts.length === 1 ? '' : 's'} recorded; observed changes and current conditions are separated below.`;
  return { version: 'offline-return-v1', away: { fromAt: start, toAt: end, gapMs, expired, quiet }, summary, sections: out as Record<ReturnSectionId, ReturnRow[]>, next: next.slice(0, 6), receiptCount: receipts.length };
}

export type ReturnSeverity = 'minimal' | 'notable' | 'critical';

/** Classify real offline report importance without inventing outcomes. */
export function classifyOfflineReturn(report: OfflineReturnV1): ReturnSeverity {
  if (report.away.expired) return 'critical';
  const hasCriticalBody = report.sections.body.some(r => r.tone === 'bad');
  const hasLoss = report.sections.loss.some(r => r.tone === 'bad');
  const hasSevereHome = report.sections.home.some(r => r.source === 'event' && r.tone === 'bad') || report.sections.home.some(r => r.id.startsWith('hp:') && r.tone === 'bad');
  if (hasCriticalBody || hasLoss || hasSevereHome) return 'critical';
  // A long absence, one routine receipt, or an already-unfunded Cabinet
  // must not hijack the whole screen. This threshold represents accumulated
  // *confirmed* events, not raw elapsed time or current-state warnings.
  const observedRisk = report.sections.body.some(r => r.id.startsWith('shift:') && r.tone === 'warn');
  const materialLoss = report.sections.loss.some(r => r.tone === 'warn');
  if (report.receiptCount >= 2 || observedRisk || materialLoss) return 'notable';
  return 'minimal';
}

export interface StoredReturnEntry {
  id: string;
  recordedAt: number;
  severity: ReturnSeverity;
  report: OfflineReturnV1;
}

const qaReturnHistory = new WeakMap<RunState, StoredReturnEntry[]>();

function historyKey(r: RunState): string {
  return `soh.return-history.v1:${r.id}`;
}

export function readReturnHistory(r: RunState, qaSession: boolean): StoredReturnEntry[] {
  if (qaSession) return qaReturnHistory.get(r) ?? [];
  try {
    const data = JSON.parse(localStorage.getItem(historyKey(r)) || '[]');
    return Array.isArray(data) ? data.filter((x: any) => x && x.report?.version === 'offline-return-v1').slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function recordReturnHistory(r: RunState | null, qaSession: boolean, report: OfflineReturnV1 | null): StoredReturnEntry[] {
  if (!r || !report) return [];
  const prev = readReturnHistory(r, qaSession);
  if (prev[0]?.report.away.fromAt === report.away.fromAt && prev[0]?.report.away.toAt === report.away.toAt && prev[0]?.report.receiptCount === report.receiptCount) {
    return prev;
  }
  const entry: StoredReturnEntry = {
    id: `ret-${report.away.toAt}-${report.receiptCount}`,
    recordedAt: report.away.toAt,
    severity: classifyOfflineReturn(report),
    report,
  };
  const next = [entry, ...prev].slice(0, 8);
  if (qaSession) qaReturnHistory.set(r, next);
  else {
    try { localStorage.setItem(historyKey(r), JSON.stringify(next)); } catch { /* ignore storage quota */ }
  }
  return next;
}

/** Continue route: runs the same settle() and returns both the legacy strings and the typed report. */
export function settleWithReturn(gs: GameState, now: number): { lines: string[]; report: OfflineReturnV1 | null } {
  const before = captureReturnSnapshot(gs);
  const start = gs.run?.clock.lastSimAt ?? now;
  beginReceiptSink();
  let lines: string[] = [];
  let receipts: { id: string; at: number; kind: string; detail: string }[] = [];
  try { lines = settle(gs, now, false); } finally { receipts = endReceiptSink(); }
  if (!before) return { lines, report: null };
  // settle() ends the run exactly at expiry (endRun clears gs.run); that is the only expiry signal used here.
  const expired = !gs.run;
  const report = buildOfflineReturn(gs, before, receipts, start, now, expired);
  return { lines, report };
}
