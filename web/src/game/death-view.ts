import { TILE, type Entity, type RunState, type Stack } from './core';
import { windowOrigin } from '../veyra05/continuity';

/** Only the engine's death receipt binds a bag to a death. Never search by distance. */
export type DeathBagView =
  | { status: 'unverified'; bagId: null; bag: null; stacks: []; cause: string | null }
  | { status: 'none' | 'missing'; bagId: string | null; bag: null; stacks: []; cause: string }
  | { status: 'present'; bagId: string; bag: Entity; stacks: Stack[]; cause: string };

export function deathBagView(r: RunState): DeathBagView {
  const latest = [...r.receipts].reverse().find(v => v.kind === 'death');
  if (!latest) return { status: 'unverified', bagId: null, bag: null, stacks: [], cause: null };
  const match = /(?:^|;)\s*bag=([^;]+)/.exec(latest.detail);
  const cause = latest.detail.split(';')[0] || 'Unknown cause';
  if (!match) return { status: 'unverified', bagId: null, bag: null, stacks: [], cause };
  const id = match[1].trim();
  if (id === 'none') return { status: 'none', bagId: null, bag: null, stacks: [], cause };
  let bag: Entity | undefined = r.entities[id];
  if (!bag && r.veyraOffscreenEntities?.[id]) {
    const oe = r.veyraOffscreenEntities[id];
    const [ox, oy] = windowOrigin(r);
    bag = {
      ...oe,
      x: oe.x - ox * TILE,
      y: oe.y - oy * TILE,
    };
  }
  const container = bag?.c ? r.custody[bag.c] : undefined;
  if (!bag || bag.kind !== 'bag' || bag.parcel || !container || container.kind !== 'bag') {
    return { status: 'missing', bagId: id, bag: null, stacks: [], cause };
  }
  return { status: 'present', bagId: id, bag, stacks: container.slots.filter((s): s is Stack => !!s), cause };
}