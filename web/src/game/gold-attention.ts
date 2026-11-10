/* Creator Gold (3) derived persistent warnings selector; source-authored logic is unchanged.
 * Other donor attention queue types depend on discontinued Daily Pact and are excluded. */
import { RECIPES, STRUCTS, stationBurnable } from './catalog';
import { TILE, type RunState } from './core';
import { deathBagView } from './death-view';
import { C, homeStatus, spaceFor } from './engine';
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

