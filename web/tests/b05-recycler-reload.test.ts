// B05-R C2: an in-flight X:pipe-v1 job survives save/reload, completes exactly once, and keeps the reserved pipe UID.
import { describe, it, expect } from 'vitest';
import type { GameState } from '../src/game/core';
import { TILE } from '../src/game/core';
import { addItem, C, countItem, dispatch, mkContainer, newGame, stepStations, markDirty } from '../src/game/engine';
import { getWorld, setActiveLayout, webRecyclerSite } from '../src/game/world';
import { serializeSnapshot, validate } from '../src/game/persist';

const T0 = Date.UTC(2026, 10, 7);
let n = 0;
const act = (g: GameState, p: any, now: number) => dispatch(g, { id: 'c2-' + ++n, ...p }, now);
const reloaded = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;

describe('B05-R C2 Recycler in-flight pipe job across save/reload', () => {
  it('completes once after reload, returns one ingot, and the reserved pipe UID is preserved in the saved job', () => {
    setActiveLayout('shipping_fresh');
    const g = newGame(); expect(act(g, { type: 'startRun', character: 'female', seed: 101 }, T0).ok).toBe(true);
    const r = g.run!;
    // The recycler must sit on the authored Foundry site (Map-owned). A recycler anywhere else is refused by validate().
    const site = webRecyclerSite(getWorld(r.layoutId), r.layoutId); expect(site).not.toBeNull();
    const tx = site!.tx, ty = site!.ty;
    // The Foundry Recycler is created by the engine at run start on the authored site (persist allows exactly one).
    const rc = Object.values(r.entities).find(e => e.kind === 'recycler')!; expect(rc).toBeDefined();
    const id = rc.id, out = { id: rc.station!.outC };
    expect(rc.tx).toBe(site!.tx); expect(rc.ty).toBe(site!.ty);
    r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty();
    addItem(r, 'inv', 'metal_pipe', 1);
    const slot = r.custody.inv.slots.findIndex(s => s?.key === 'metal_pipe'); const uid = r.custody.inv.slots[slot]!.uid;
    expect(act(g, { type: 'recycleItem', eid: id, slot, uid }, T0).ok).toBe(true);
    stepStations(g, 4000, T0 + 4000);                                   // mid-flight (4 of 10 s)
    const snap = reloaded(g);
    expect(validate(snap)).not.toBeNull();
    // a forged recycler off the authored site is refused (Map authority)
    const forged = reloaded(g) as any; forged.run.entities[id].tx = tx + 1; expect(validate(forged)).toBeNull();
    // a second recycler is refused as well
    const twice = reloaded(g) as any; twice.run.entities['eX'] = { ...twice.run.entities[id], id: 'eX' }; expect(validate(twice)).toBeNull();
    const job = snap.run!.entities[id].station!.queue[0];
    expect(job.recipe).toBe('X:pipe-v1');
    expect(job.reserved?.[0]?.uid).toBe(uid);                           // the same pipe UID is still reserved
    stepStations(snap, 6000, T0 + 10_000);                              // finish after reload
    expect(countItem(snap.run!, snap.run!.entities[id].station!.outC, 'refined_iron_ingot')).toBe(1);
    expect(snap.run!.entities[id].station!.queue.length).toBe(0);
    stepStations(snap, 60_000, T0 + 70_000);                            // more time: no second grant
    expect(countItem(snap.run!, snap.run!.entities[id].station!.outC, 'refined_iron_ingot')).toBe(1);
    expect(countItem(snap.run!, 'inv', 'metal_pipe')).toBe(0);          // the pipe is consumed exactly once
    void C;
  });
});
