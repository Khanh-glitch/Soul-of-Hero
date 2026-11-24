import { TILE, type Entity, type RunState, type Stack } from './core';
import { windowOrigin } from '../veyra05/continuity';

/** A bag is bound to a death by the engine alone: `player.deathBag`, written by `killPlayer`, or
 *  (saves from before that field) the death receipt. Never by distance to some other bag.
 *
 *  The receipt ledger keeps only its newest 250 entries, so on a long run the death receipt rotates
 *  out and the panel used to lose a bag that was still lying there ("No recoverable bag…" beside a
 *  chronicle that could see it). For such a save the one remaining lawful witness is the bag the
 *  engine itself labelled as the player's own, ownerless, on the exact tile the body lies on. */
export type DeathBagView =
  | { status: 'unverified'; bagId: null; bag: null; stacks: []; cause: string | null }
  | { status: 'none' | 'missing'; bagId: string | null; bag: null; stacks: []; cause: string }
  | { status: 'present'; bagId: string; bag: Entity; stacks: Stack[]; cause: string };

export function deathBagView(r: RunState): DeathBagView {
  const latest = [...r.receipts].reverse().find(v => v.kind === 'death');
  const bound = r.player.deathBag;
  let id: string, cause: string;
  if (bound) { id = bound.id ?? 'none'; cause = bound.cause || 'Unknown cause'; }
  else if (latest) {
    const match = /(?:^|;)\s*bag=([^;]+)/.exec(latest.detail);
    cause = latest.detail.split(';')[0] || 'Unknown cause';
    if (!match) return { status: 'unverified', bagId: null, bag: null, stacks: [], cause };
    id = match[1].trim();
  } else {
    if (!r.player.dead) return { status: 'unverified', bagId: null, bag: null, stacks: [], cause: null };
    const [ox, oy] = windowOrigin(r);
    const tx = Math.floor(r.player.x / TILE), ty = Math.floor(r.player.y / TILE);
    const own = (e: Entity, gx: number, gy: number) => e.kind === 'bag' && e.label === 'Your bag' && !e.owner && !e.parcel && !!e.c
      && Math.floor(e.x / TILE) === gx && Math.floor(e.y / TILE) === gy;
    const here = Object.values(r.entities).find(e => own(e, tx, ty))
      ?? Object.values(r.veyraOffscreenEntities ?? {}).find(e => own(e, tx + ox, ty + oy));
    if (!here) return { status: 'unverified', bagId: null, bag: null, stacks: [], cause: null };
    id = here.id; cause = 'Unknown cause';
  }
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