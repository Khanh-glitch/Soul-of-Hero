// W07-R: same funded refinery job, same time window: online 1 s steps vs one offline settlement.
// Fixtures (disclosed): a level-2 workbench and a refinery placed as stations; wood fuel; salvaged oil and glass injected.
// The craft action itself is the real engine path.
import { describe, it, expect } from 'vitest';
import { TILE, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, markDirty, mkContainer, newGame } from '../src/game/engine';
import { settle, syncWorld } from '../src/game/sim';
import { serializeSnapshot, selectSnapshots } from '../src/game/persist';

const T0 = Date.UTC(2026, 0, 1);
let n = 0;
const act = (g: GameState, type: string, p: object = {}, now = T0) => dispatch(g, { id: 'w07r-' + ++n, type, ...p }, now);
function station(g: GameState, type: string, level?: number): Entity {
  const r = g.run!, p = r.player;
  const f = mkContainer(r, 'fuel', 3), o = mkContainer(r, 'out', 6);
  const e: Entity = { id: `w07r-${type}-${++n}`, kind: 'struct', type, x: p.x + 8, y: p.y, tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE), hp: 200, maxHp: 200, station: { fuelC: f.id, outC: o.id, burn: 0, queue: [], ...(level ? { level: level as any } : {}) } };
  if (type === 'refinery') e.identity = 'refinery-v1';
  r.entities[e.id] = e; return e;
}
function fundedRefinery(wood = 3) {
  const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed: 77 }, T0).ok).toBe(true);
  const r = g.run!; r.creatures = [];
  const bench = station(g, 'workbench', 2), ref = station(g, 'refinery');
  addItem(r, ref.station!.fuelC, 'wood', wood);
  addItem(r, 'inv', 'salvaged_oil', 6); addItem(r, 'inv', 'glass', 1);
  markDirty();
  expect(act(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }, T0).ok).toBe(true);
  return { g, r, ref, bench };
}
const project = (g: GameState, id: string) => {
  const r = g.run!, e = r.entities[id];
  return { fuel: countItem(r, e.station!.fuelC, 'wood'), burn: Math.round(e.station!.burn), job: e.station!.queue.map(j => Math.round(j.left)), out: { canister: countItem(r, e.station!.outC, 'fuel_can'), lube: countItem(r, e.station!.outC, 'lubricant') }, jobDone: r.receipts.filter(x => x.kind === 'job.done').map(x => x.detail), oilLeft: countItem(r, 'inv', 'salvaged_oil') };
};

describe('W07-R refinery chronology: online steps equal one offline settlement', () => {
  it('a funded industrial batch with finite wood fuel gives identical fuel, output and job state', () => {
    const { g, ref } = fundedRefinery();
    const snap = serializeSnapshot(g);
    const online = selectSnapshots([snap, null]).gs!, offline = selectSnapshots([snap, null]).gs!;
    const T = T0 + 40000;
    for (let t = T0 + 1000; t <= T; t += 1000) syncWorld(online, t);
    settle(offline, T, true);
    expect(project(offline, ref.id)).toEqual(project(online, ref.id));
    const p = project(online, ref.id);
    expect(p.jobDone).toHaveLength(1); expect(p.out.canister).toBe(2); expect(p.out.lube).toBe(1);
    expect(p.oilLeft).toBe(0); expect(p.job).toEqual([]);
  });
  it('fuel runs out mid-job: the job pauses at the same boundary online and offline, and resumes only with new fuel', () => {
    const { g, ref, r } = fundedRefinery(1);   // 1 wood = 20 s of burn; the batch needs 26 s
    const snap = serializeSnapshot(g);
    const online = selectSnapshots([snap, null]).gs!, offline = selectSnapshots([snap, null]).gs!;
    const T = T0 + 40000;
    for (let t = T0 + 1000; t <= T; t += 1000) syncWorld(online, t);
    settle(offline, T, true);
    expect(project(offline, ref.id)).toEqual(project(online, ref.id));
    const p = project(online, ref.id);
    expect(p.jobDone).toHaveLength(0); expect(p.out.canister).toBe(0);
    expect(p.job[0]).toBeGreaterThan(0);                       // paused, not completed
    expect(p.fuel).toBe(0);
    expect(online.run!.receipts.some(x => x.kind === 'station.state' && x.detail.includes('fuel_out'))).toBe(true);
    // Real refill then continuation: the same funded job completes online with one more wood.
    addItem(online.run!, ref.station!.fuelC, 'wood', 2); syncWorld(online, T + 20000);
    expect(project(online, ref.id).jobDone).toHaveLength(1);
  });
});
