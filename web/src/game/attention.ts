// ============================================================================
// ATTENTION DIRECTOR — one small policy, not a framework.
//
//  Lanes (each owns one screen region, so nothing collides):
//   SAFETY  top-left   UrgentAlerts + Standing Issues. Never deferred, never timed out.
//   STAGE   top-centre Boss HUD > L5 cinematic > L4 reveal (one at a time).
//   WAYMARK right edge tracker; hosts every L2 stamp + daily milestone.
//   WORLD   in-scene   L1 pickups, L3 capability flares anchored to the real thing.
//   FEED    low-left   L1 routine lines (merged ×N) + one-shot warning lines.
//
//  Deferral: L2–L4 wait while combat / a full-screen surface / death owns the
//  moment; they are recorded in the Chronicle immediately, so a delayed
//  animation never loses the outcome. L5 plays when nothing full-screen is open
//  (combat shrinks it to a strip rather than hiding it).
//  Grouping: cues from one receipt batch fold together (e.g. job.done +
//  first_ingot → one "First Smelt" flare at that furnace; elder.defeat +
//  elder_1 → one cinematic).
// ============================================================================
import { ACHIEVEMENTS, ELDERS, ITEMS, RECIPES, STRUCTS, stationBurnable } from './catalog';
import type { RunState } from './core';
import { C, homeStatus } from './engine';
import type { Cue } from './presentation-cues';
import { ACH_META, type FeedbackLevel } from './journey';

export interface Flare { id: string; title: string; detail: string; icon?: string; x: number; y: number; born: number; accent: string }
export interface Cinematic { id: string; eyebrow: string; title: string; detail: string; icon?: string; accent: string; tone: 'elder' | 'world' | 'crown' | 'evac' }
export interface Direction {
  /** receipt ids whose generic feed/stage line must be suppressed (folded into something bigger) */
  absorb: Set<string>;
  flares: Omit<Flare, 'born'>[];
  cinematics: Cinematic[];
  /** level per receipt id (for sound + chronicle) */
  levels: Map<string, FeedbackLevel>;
}

const STATION_TYPES = ['furnace', 'workbench', 'research', 'campfire', 'recycler', 'refinery', 'claim'];

export function directCues(cues: Cue[], r: RunState, firstBuild: (type: string) => boolean): Direction {
  const d: Direction = { absorb: new Set(), flares: [], cinematics: [], levels: new Map() };
  const ach = cues.filter(c => c.kind === 'achievement');
  const P = r.player;
  const at = (eid?: string) => { const e = eid ? r.entities[eid] : undefined; return e ? { x: e.x, y: e.y } : { x: P.x, y: P.y }; };

  for (const c of cues) {
    switch (c.kind) {
      case 'elder_defeated': {
        const e = ELDERS[c.subject];
        d.cinematics.push({ id: c.receiptId, eyebrow: 'ELDER DEFEATED', title: `${(e?.name ?? 'The Elder').toUpperCase()} FALLS`, detail: e ? `${ITEMS[e.stone]?.name ?? 'Its stone'} lies in the dust` : '', icon: e?.stone, accent: '#f1c16a', tone: 'elder' });
        d.absorb.add(c.receiptId); d.levels.set(c.receiptId, 5);
        for (const a of ach) if (a.subject === 'elder_1') d.absorb.add(a.receiptId);
        break;
      }
      case 'station_upgraded': {
        const p = at(c.subject);
        const title = c.cause === 'furnace.upgrade' ? 'FURNACE LINED' : c.cause === 'power.upgrade' ? 'GENERATOR REINFORCED' : c.cause === 'cart.upgrade' ? 'CART REINFORCED' : c.cause === 'industrial.install' ? 'POWER MODULE' : `WORKBENCH LV ${c.detail.split(':')[1] || ''}`.trim();
        d.flares.push({ id: c.receiptId, title, detail: 'new capability', icon: c.cause === 'furnace.upgrade' ? 'st:furnace' : c.cause === 'cart.upgrade' ? 'cart_kit' : 'st:workbench', ...p, accent: '#e6b45d' });
        d.absorb.add(c.receiptId); d.levels.set(c.receiptId, 3);
        break;
      }
      case 'recipe_learned': {
        const out = RECIPES[c.detail]?.out;
        d.flares.push({ id: c.receiptId, title: 'NEW RECIPE', detail: out ? ITEMS[out]?.name ?? '' : '', icon: out ?? 'blueprint', x: P.x, y: P.y, accent: '#85d2df' });
        d.absorb.add(c.receiptId); d.levels.set(c.receiptId, 3);
        break;
      }
      case 'structure_built': {
        const [type, pos] = c.detail.split('@');
        if (STATION_TYPES.includes(type) && firstBuild(type)) {
          const [tx, ty] = (pos || '').split(',').map(Number);
          d.flares.push({ id: c.receiptId, title: `FIRST ${STRUCTS[type]?.name.toUpperCase() ?? type}`, detail: type === 'claim' ? 'territory protected' : 'station online', icon: `st:${type}`, x: Number.isFinite(tx) ? tx * 16 + 8 : P.x, y: Number.isFinite(ty) ? ty * 16 + 8 : P.y, accent: '#e6b45d' });
          d.absorb.add(c.receiptId); d.levels.set(c.receiptId, 3);
        } else d.levels.set(c.receiptId, 1);
        break;
      }
      default: break;
    }
  }

  for (const a of ach) {
    if (d.absorb.has(a.receiptId)) continue;
    const meta = ACH_META[a.subject]; const def = ACHIEVEMENTS[a.subject]; if (!meta || !def) continue;
    d.levels.set(a.receiptId, meta.level);
    if (meta.level === 3) {
      // fold into the station job that produced it, anchored at that station
      const job = cues.find(c => c.kind === 'station_job_done' && !d.absorb.has(c.receiptId));
      const p = job ? at(job.subject) : { x: P.x, y: P.y };
      if (job) d.absorb.add(job.receiptId);
      d.flares.push({ id: a.receiptId, title: def.name.toUpperCase(), detail: `achievement · +${def.score}`, icon: meta.icon, ...p, accent: '#93d8b4' });
      d.absorb.add(a.receiptId);
    } else if (meta.level === 5) {
      if (a.subject === 'ragnarok') { d.absorb.add(a.receiptId); continue; } // the phase cinematic owns this moment
      d.cinematics.push({ id: a.receiptId, eyebrow: a.subject === 'six_stones' ? 'JOURNEY COMPLETE' : 'EVACUATED', title: def.name.toUpperCase(), detail: meta.tale, icon: meta.icon, accent: a.subject === 'six_stones' ? '#ffe28a' : '#9fe0ff', tone: a.subject === 'six_stones' ? 'crown' : 'evac' });
      d.absorb.add(a.receiptId);
      if (a.subject === 'six_stones') for (const b of ach) if (b.subject === 'evacuated') { d.absorb.add(b.receiptId); d.cinematics = d.cinematics.filter(x => x.id !== b.receiptId); }
    } else if (meta.level === 4) {
      // vault / first deposit keep the centre reveal; a same-batch cash line is folded in
      if (a.subject === 'first_deposit') for (const c of cues) if (c.kind === 'cash_secured') d.absorb.add(c.receiptId);
    }
  }
  return d;
}

export function ragnarokCinematic(runId: string): Cinematic {
  return { id: `${runId}:ragnarok`, eyebrow: 'DAY 11 · THE FINAL 72 HOURS', title: 'RAGNAROK', detail: 'Sealed vaults open. Elders stir. Secure what you can — or get out.', accent: '#ff7650', tone: 'world' };
}
export function eldersWakeCinematic(runId: string): Cinematic {
  return { id: `${runId}:awakening`, eyebrow: 'DAY 14', title: 'THE ELDERS WAKE', detail: 'Six legends walk the island.', accent: '#f1c16a', tone: 'elder' };
}

// ---------------------------------------------------------------------------
// STANDING ISSUES — persistent problems derived from live state, so they stay
// until actually resolved (never a timed toast). Snoozing hides one until its
// state changes.
// ---------------------------------------------------------------------------
export interface Issue { id: string; sig: string; label: string; fix: string; icon: string; x: number; y: number; severity: 1 | 2 | 3 }
export function standingIssues(r: RunState): Issue[] {
  const out: Issue[] = [];
  for (const e of Object.values(r.entities)) {
    if (e.kind !== 'struct' || (e.owner && e.owner !== 'player')) continue;
    const st = e.station; const name = STRUCTS[e.type || '']?.name ?? 'Station';
    if (st && st.queue.length) {
      if (st.stateCode === 'fuel_out' && st.burn <= 0 && !C(r, st.fuelC)?.slots.some(s => s && stationBurnable(s.key)))
        out.push({ id: `fuel:${e.id}`, sig: 'fuel_out', label: 'NO FUEL', fix: `${name} paused`, icon: 'coal', x: e.x, y: e.y, severity: 2 });
      else if (st.stateCode === 'output_full' && !C(r, st.outC)?.slots.some(s => !s))
        out.push({ id: `full:${e.id}`, sig: 'output_full', label: 'OUTPUT FULL', fix: `collect at ${name}`, icon: 'gear', x: e.x, y: e.y, severity: 2 });
    }
    if (e.hp !== undefined && e.maxHp && e.hp / e.maxHp < 0.3 && e.hp > 0)
      out.push({ id: `dmg:${e.id}`, sig: `dmg${Math.ceil(e.hp / e.maxHp * 10)}`, label: 'SEVERE DAMAGE', fix: `${name} · repair [V]`, icon: `st:${e.type}`, x: e.x, y: e.y, severity: 3 });
  }
  try {
    for (const c of homeStatus(r).cabinets as any[]) if (c.state && c.state !== 'funded') {
      const ent = r.entities[c.id];
      out.push({ id: `upkeep:${c.id}`, sig: String(c.state), label: 'UPKEEP DUE', fix: 'stock the cabinet', icon: 'st:claim', x: ent?.x ?? r.player.x, y: ent?.y ?? r.player.y, severity: 2 });
    }
  } catch { /* territory plan unavailable for this layout */ }
  return out.sort((a, b) => b.severity - a.severity);
}
