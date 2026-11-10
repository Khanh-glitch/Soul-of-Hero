// ============================================================================
// SOUL OF HEROES — COHERENT ATTENTION COORDINATOR
// Pure coordination logic uniting:
//   * Persistent unresolved problems (fuel out, output full, cabinet decay, bag)
//   * 5-level accomplishment queue with coalescing, dedupe & deferral
//   * Priority arbitration during combatFocus & full-screen overlays
// ============================================================================
import { RECIPES, STRUCTS, stationBurnable } from './catalog';
import { TILE, type RunState } from './core';
import { deathBagView } from './death-view';
import { C, homeStatus, spaceFor } from './engine';
import type { ExperienceEvent } from './experience';
import { recoveryFits } from './recycler';

export interface PersistentWarning {
  id: string;
  kind: 'no_fuel' | 'output_full' | 'cabinet_unfunded' | 'death_bag';
  severity: 'warn' | 'bad';
  glyph: string;
  label: string;
  detail: string;
  fix: string;
  worldX?: number;
  worldY?: number;
}

export interface AttentionContext {
  combatFocus: boolean;
  fullScreen: boolean;
  modalOpen: boolean;
  playerDead: boolean;
  criticalHp: boolean;
}

export interface AttentionState {
  active: ExperienceEvent | null;
  queue: ExperienceEvent[];
  seenAt: Map<string, number>;
  feedHistory: { id: string; at: number; key: string }[];
  recentArchived: ExperienceEvent[];
}

export function createAttentionState(): AttentionState {
  return {
    active: null,
    queue: [],
    seenAt: new Map(),
    feedHistory: [],
    recentArchived: [],
  };
}

/**
 * Evaluate REAL, CURRENT unresolved problems in the world.
 * These NEVER auto-dismiss after a toast timeout — they remain until
 * the underlying physical entity/state is actually fixed.
 */
export function derivePersistentWarnings(r: RunState, _now: number): PersistentWarning[] {
  if (r.player.dead) return [];
  const out: PersistentWarning[] = [];

  // 1. Death bag awaiting recovery
  const bag = deathBagView(r);
  if (bag.status === 'present' && bag.bag) {
    const bx = Math.floor(bag.bag.x / TILE);
    const by = Math.floor(bag.bag.y / TILE);
    out.push({
      id: `warn:death-bag:${bag.bag.id}`,
      kind: 'death_bag',
      severity: 'bad',
      glyph: 'skull',
      label: 'DEATH BAG UNRECOVERED',
      detail: `(${bx}, ${by}) · ${bag.stacks.length} stack${bag.stacks.length === 1 ? '' : 's'}`,
      fix: 'Check Map [M]',
      worldX: bag.bag.x,
      worldY: bag.bag.y,
    });
  }

  // 2. Working stations actively paused due to fuel exhaustion or full output
  for (const e of Object.values(r.entities)) {
    if (e.kind !== 'struct' || !e.station || (e.owner !== undefined && e.owner !== 'player')) continue;
    const st = e.station;
    if (!st.queue.length) continue;
    const job = st.queue[0];
    const rc = RECIPES[job.recipe];
    const name = STRUCTS[e.type || '']?.name || e.type || 'Station';
    const isFuelledKind = ['campfire', 'furnace', 'refinery', 'oil_pump'].includes(e.type || '');

    if (job.left <= 0) {
      const hasRoom = rc
        ? rc.outs
          ? recoveryFits(C(r, st.outC), rc.outs)
          : spaceFor(r, st.outC, rc.out) >= rc.qty
        : job.recipe.startsWith('R:')
          ? spaceFor(r, st.outC, 'blueprint') >= 1
          : C(r, st.outC)?.slots.some(s => !s);
      if (!hasRoom) {
        out.push({
          id: `warn:output:${e.id}`,
          kind: 'output_full',
          severity: 'warn',
          glyph: 'warn',
          label: `${name.toUpperCase()} · OUTPUT FULL`,
          detail: `${st.queue.length} job${st.queue.length === 1 ? '' : 's'} paused`,
          fix: 'Collect output [E]',
          worldX: e.x,
          worldY: e.y,
        });
        continue;
      }
    }

    if (isFuelledKind && st.burn <= 0 && !C(r, st.fuelC)?.slots.some(s => s && stationBurnable(s.key))) {
      out.push({
        id: `warn:fuel:${e.id}`,
        kind: 'no_fuel',
        severity: 'warn',
        glyph: 'fuel',
        label: `${name.toUpperCase()} · NO FUEL`,
        detail: `${st.queue.length} job${st.queue.length === 1 ? '' : 's'} halted`,
        fix: 'Add wood/coal [E]',
        worldX: e.x,
        worldY: e.y,
      });
    }
  }

  // 3. Unfunded Territory Cabinet when owned structures are covered and decaying
  const hs = homeStatus(r);
  const unfunded = hs.cabinets.find(c => c.state === 'unfunded' && c.external > 0);
  if (unfunded) {
    const cabEnt = r.entities[unfunded.id];
    out.push({
      id: `warn:cabinet:${unfunded.id}`,
      kind: 'cabinet_unfunded',
      severity: 'bad',
      glyph: 'home',
      label: 'CABINET UNFUNDED',
      detail: `${unfunded.external} structure${unfunded.external === 1 ? '' : 's'} decaying`,
      fix: 'Stock Cabinet [E]',
      worldX: cabEnt?.x,
      worldY: cabEnt?.y,
    });
  }

  return out.slice(0, 4);
}

/** Determine whether a Level 2-5 stage/ceremony event must defer to current player focus. */
export function shouldDeferEvent(event: ExperienceEvent, ctx: AttentionContext): boolean {
  if (ctx.playerDead) return true;
  if (ctx.fullScreen || ctx.modalOpen) return true;
  // During active Elder fight / aiming / low HP:
  //   - Level 5 World Crisis ('world') transforms into slim combat alert bar (NOT deferred, never blocks!)
  //   - Level 5 Elder Defeat ('boss') can show once Elder is vanquished; Level 2-4 wait calmly until combat eases!
  if (ctx.combatFocus || ctx.criticalHp) {
    if (event.kind === 'world' && event.level === 5) return false;
    if (event.kind === 'boss' && event.level === 5) return false;
    return event.level <= 4 || event.level === 5;
  }
  return false;
}

/**
 * Enqueue a Level 2-5 event into the coherent queue with:
 *   - 30s dedupe by id and dedupeKey
 *   - Coalescing when a same-moment lower/equal achievement/fieldcraft event arrives
 *   - Strict priority ordering (Level 5 > 4 > 3 > 2)
 */
export function enqueueCoordinatedEvent(
  queue: ExperienceEvent[],
  seenAt: Map<string, number>,
  incoming: ExperienceEvent,
  now: number,
  active?: ExperienceEvent | null,
): { queue: ExperienceEvent[]; accepted: boolean; coalescedOntoActive?: ExperienceEvent } {
  // Prune old seen timestamps
  for (const [k, at] of seenAt) {
    if (now - at > 30_000) seenAt.delete(k);
  }
  if (seenAt.has(incoming.id)) return { queue, accepted: false };
  if (incoming.dedupeKey && seenAt.has(incoming.dedupeKey)) return { queue, accepted: false };

  seenAt.set(incoming.id, now);
  if (incoming.dedupeKey) seenAt.set(incoming.dedupeKey, now);

  // Coalesce Level 2 Fieldcraft/Daily completions directly onto a higher-level active or queued event
  // when they occur within the same gameplay moment, avoiding stacked popups.
  if (incoming.level === 2 && active && active.level >= 3 && active.level <= 4) {
    const label = `${incoming.title}: ${incoming.detail}`.slice(0, 54);
    const prev = active.attached ?? [];
    if (!prev.some(p => p.label === label) && prev.length < 3) {
      const updated: ExperienceEvent = {
        ...active,
        attached: [...prev, { label, tone: incoming.kind === 'daily' ? 'good' : 'info' }],
      };
      return { queue, accepted: true, coalescedOntoActive: updated };
    }
  }

  if (incoming.level === 2 && queue.some(q => q.level >= 3 && q.level <= 4)) {
    const nextQueue = queue.map((q, idx) => {
      if (idx !== 0 || q.level < 3) return q;
      const label = `${incoming.title}: ${incoming.detail}`.slice(0, 54);
      const prev = q.attached ?? [];
      if (prev.some(p => p.label === label) || prev.length >= 3) return q;
      return { ...q, attached: [...prev, { label, tone: (incoming.kind === 'daily' ? 'good' : 'info') as 'good' | 'info' }] };
    });
    return { queue: nextQueue, accepted: true };
  }

  const next = [...queue.filter(q => q.id !== incoming.id), incoming]
    .sort((a, b) => b.level - a.level || b.priority - a.priority)
    .slice(0, 6);
  return { queue: next, accepted: true };
}

/** Pop the next eligible event from the queue when no active event is playing and context permits. */
export function popNextCoordinatedEvent(
  queue: ExperienceEvent[],
  active: ExperienceEvent | null,
  ctx: AttentionContext,
): { active: ExperienceEvent | null; queue: ExperienceEvent[] } {
  if (active) return { active, queue };
  if (!queue.length) return { active: null, queue };
  const idx = queue.findIndex(ev => !shouldDeferEvent(ev, ctx));
  if (idx < 0) return { active: null, queue };
  const chosen = queue[idx];
  const rest = [...queue.slice(0, idx), ...queue.slice(idx + 1)];
  return { active: chosen, queue: rest };
}
