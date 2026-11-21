/** Fixture helper for the PA1 placement law (design ledger §24, commit 99ed3c4): a deployable device
 *  is a packed inventory item first and a structure second. A fixture that wants a structure on a
 *  tile must therefore carry what a player would carry — the intact packed device when the
 *  structure has one, otherwise its building materials. Nothing here bypasses `build` validation. */
import { appendFileSync } from 'node:fs';
import { STRUCTS, ITEMS } from '../../src/game/catalog';
import { addItem, dispatch } from '../../src/game/engine';
import type { RunState } from '../../src/game/core';

/** What a `build` of `type` consumes from the builder's inventory under the current rules. */
export function buildInputs(type: string): [string, number][] {
  const d = STRUCTS[type];
  if (!d) throw Error(`unknown structure ${type}`);
  return d.item ? [[d.item, 1]] : d.cost;
}
/** Put exactly one build's worth of inputs for `type` into `cid` (default: the player's pack). */
export function grantBuildKit(r: RunState, type: string, cid = 'inv'): void {
  for (const [key, qty] of buildInputs(type)) {
    if (!ITEMS[key]) throw Error(`build input ${key} of ${type} is not an item`);
    const left = addItem(r, cid, key, qty);
    if (left) throw Error(`no room for ${qty} ${key} to build ${type}`);
  }
}
/** Make sure the player carries one intact pack for a deployable `type` (no-op for plain geometry
 *  and when a pack is already carried). For fixtures that stock bulk materials once and then place
 *  several things: the materials still pay for walls and floors, the pack pays for the device. */
export function ensurePack(r: RunState, type: string): void {
  const item = STRUCTS[type]?.item;
  if (!item || !ITEMS[item]?.dur) return;
  const inv = r.custody.inv;
  if (inv.slots.some(s => s?.key === item && s.qty === 1 && (s.dur ?? 0) > 0)) return;
  if (addItem(r, 'inv', item, 1)) throw Error(`no room for a packed ${type}`);
}
/** `dispatch` for fixtures written before PA1: a `build` of a deployable is preceded by handing the
 *  player the intact pack that a real player would have crafted first. Every other action, and every
 *  other refusal of `build` (range, tile, claim, foundation…), is untouched. Tests ABOUT packs,
 *  crafting cost or missing materials must keep calling `dispatch` directly.
 *  Set SOH_REFUSALS=/path/to/file to log every refused action with its reason while debugging a fixture. */
export const dispatchCarryingPack: typeof dispatch = (g, action, now) => {
  const a = action as { type?: string; struct?: string };
  if (a.type === 'build' && g.run && typeof a.struct === 'string') ensurePack(g.run, a.struct);
  const res = dispatch(g, action, now);
  if (!res.ok && process.env.SOH_REFUSALS) appendFileSync(process.env.SOH_REFUSALS, `${(action as any).type} ${JSON.stringify(action).slice(0, 160)} => ${(res as any).reason}\n`);
  return res;
};
