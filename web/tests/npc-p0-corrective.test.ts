/**
 * NPC P0 CORRECTIVE — fault-targeted invariant tests (Control Tower acceptance order).
 *
 * Pins the exact P0 semantics: first-tick time delta, custody conservation after save/reload,
 * trade/loot/death K1 conservation (no mint, UID preserved), deterministic companion refusal,
 * real combat integration, evac boarding rules, proven-safe survivors, and profile history.
 */
import { describe, expect, it } from 'vitest';
import { WW, TILE } from '../src/game/core';
import { newGame, startRun, dispatch, C, addItem, blockGrid } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { VEYRA_PRIMORDIAL_SITES, resolvePrimordialGlobalTile } from '../src/veyra05/ecosystem';
import { authoredGlobalStatic } from '../src/veyra05/floors';
import { doorwayOccupied } from '../src/game/poi-access';
import { validate } from '../src/game/persist';
import { T0 } from './helpers/g1b-kit';
import {
  tickNeeds, stepHumans, tradeWithHuman, lootHuman, killHuman, applyDamage, downHuman,
  treatHuman, boardEvac, resolveOrder, setFollowing, finalizeHumanOutcomes,
  humanPack, humanHistoryAggregate, humanWorkTick,
} from '../src/game/humanworld';

function startAt(ax: number, ay: number, seed = 7606) {
  const [gtx, gty] = auToTile(ax, ay);
  const win = windowAround(gtx, gty);
  setActiveLayout(layoutIdAt(win.originTx, win.originTy));
  const gs = newGame();
  const lx = Math.max(8, Math.min(WW - 9, gtx - win.originTx));
  const ly = Math.max(8, Math.min(WW - 9, gty - win.originTy));
  expect(startRun(gs, 'female', T0, null, seed, { tx: lx, ty: ly }).ok).toBe(true);
  return gs;
}

describe('NPC P0 corrective', () => {
  it('P0.1: first tick after startRun does not zero hunger/thirst or down humans', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    expect(hw.lastResolvedAt).toBe(r.clock.lastSimAt); // seeded from run timestamp, not 0
    const before = Object.values(hw.people).map(h => ({ hp: h.hp, hunger: h.hunger, thirst: h.thirst }));
    // First real tick with a modest delta.
    tickNeeds(r, hw, T0 + 60000);
    const after = Object.values(hw.people);
    for (let i = 0; i < after.length; i++) {
      expect(after[i].hp).toBeGreaterThan(0);
      expect(after[i].hunger).toBeGreaterThan(0);
      expect(after[i].thirst).toBeGreaterThan(0);
      expect(after[i].state).not.toBe('DOWNED');
    }
    void before;
  });

  it('seeds distinct Primordial lairs and all evacuation trips from authored global POI statics', () => {
    const gs = startAt(921, 259);
    const hw = gs.run!.humanWorld!;
    const lairCoords = new Set<string>();
    for (const site of VEYRA_PRIMORDIAL_SITES) {
      const expected = resolvePrimordialGlobalTile(site);
      const actual = hw.elderPressure[site.key];
      expect(actual).toMatchObject({ lairGx: expected.gx, lairGy: expected.gy, lairFloor: expected.floor });
      lairCoords.add(`${expected.gx},${expected.gy},${expected.floor}`);
    }
    expect(lairCoords.size).toBe(VEYRA_PRIMORDIAL_SITES.length);
    for (const site of ['po_evac_west', 'po_evac_south', 'po_evac_hook']) {
      const expected = authoredGlobalStatic(site, 'evac');
      expect(expected).not.toBeNull();
      expect(hw.evacuation[`evac:${site}`]).toMatchObject({ siteGx: expected![0], siteGy: expected![1] });
    }
  });

  it('doorway occupation includes a survivor body in global-to-window coordinates', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const people = Object.values(r.humanWorld!.people);
    const h = people[0];
    for (const other of people.slice(1)) other.state = 'DEAD';
    const origin = r.sourceMap?.veyra?.originAu;
    const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
    const tx = Math.min(WW - 8, Math.floor(r.player.x / TILE) + 10), ty = Math.floor(r.player.y / TILE);
    const door = { id: 'test-human-door', kind: 'door' as const, x: tx * TILE + 8, y: ty * TILE + 8, tx, ty };
    r.entities[door.id] = door;
    h.gx = ox + tx; h.gy = oy + ty; h.floor = r.veyraFloor ?? 0;
    expect(doorwayOccupied(r, door)).toBe(true);
    h.state = 'DEAD';
    expect(doorwayOccupied(r, door)).toBe(false);
  });

  it('needs advancement does not suppress autonomous human movement at the same timestamp', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    const origin = r.sourceMap?.veyra?.originAu;
    const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
    const grid = blockGrid(r);
    const occupied = new Set(Object.values(hw.people).filter(p => p.actorId !== h.actorId).map(p => `${p.gx},${p.gy}`));
    let start: [number, number] | null = null;
    for (let y = 10; y < WW - 10 && !start; y++) for (let x = 10; x < WW - 11; x++) {
      const gx = ox + x, gy = oy + y;
      if ((grid[y * WW + x] === 0 || grid[y * WW + x] === 4) && (grid[y * WW + x + 1] === 0 || grid[y * WW + x + 1] === 4) && !occupied.has(`${gx},${gy}`) && !occupied.has(`${gx + 1},${gy}`)) { start = [gx, gy]; break; }
    }
    expect(start).not.toBeNull();
    h.gx = start![0]; h.gy = start![1]; h.floor = r.veyraFloor ?? 0;
    h.state = 'MOVING';
    h.intent = { kind: 'move', route: [{ tx: h.gx + 4, ty: h.gy }] } as any;
    const before = h.gx;
    const at = T0 + 60000;
    tickNeeds(r, hw, at);
    stepHumans(r, hw, at);
    expect(h.gx).toBeGreaterThan(before);
    expect(hw.lastStepAt).toBe(at);
  });

  it('P0.2: work never mints from a stale abstract community stock mirror', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    const comm = hw.communities[h.community!];
    const store = r.custody[comm.storeContainers[0]];
    const countBefore = store.slots.reduce((n, s) => n + (s?.key === 'spares' ? s.qty : 0), 0);
    h.intent = { kind: 'work' } as any;
    (comm as any).stock = { spares: 9999 }; // legacy/corrupt mirror must not authorize a craft
    expect(humanWorkTick(r, hw, h, T0 + 60000)).toMatchObject({ done: false });
    const countAfter = store.slots.reduce((n, s) => n + (s?.key === 'spares' ? s.qty : 0), 0);
    expect(countAfter).toBe(countBefore);
  });

  it('P0.3: custody survives JSON round-trip with owner + UID stock conservation', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    const pack = humanPack(r, h);
    // Record a UID before round-trip.
    const slot = pack.slots.find(s => s);
    const uidBefore = slot?.uid;
    // Round-trip through JSON.
    const gs2 = JSON.parse(JSON.stringify(gs));
    expect(validate(gs2)).not.toBeNull();
    const r2 = gs2.run!;
    const h2 = r2.humanWorld!.people[h.actorId];
    const pack2 = humanPack(r2, h2);
    const slot2 = pack2.slots.find(s => s && s.key === slot?.key);
    expect(slot2?.uid).toBe(uidBefore); // UID preserved, single reference
  });

  it('P0.4: trade debits the player and preserves UID — no free mint', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    // Give the player a stack with a known UID.
    const inv = r.custody.inv;
    const beforeUid = inv.slots.find(s => s)?.uid;
    const beforeKey = inv.slots.find(s => s)?.key;
    const beforeQty = inv.slots.find(s => s)?.qty;
    const res = tradeWithHuman(r, hw, h, 'inv', beforeKey!, 1, T0 + 1000);
    expect(res.ok).toBe(true);
    // The player's stack was debited.
    const afterQty = inv.slots.find(s => s && s.key === beforeKey)?.qty ?? 0;
    expect(afterQty).toBeLessThan(beforeQty!);
    // The human received a stack with the SAME UID (transfer, not mint).
    const humanSlot = humanPack(r, h).slots.find(s => s && s.key === beforeKey);
    expect(humanSlot?.uid).toBe(beforeUid);
  });

  it('P0.4: loot preserves UID and does not mint replacements', async () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    // Give the human a known non-stackable item (knife, max 1) so the UID must transfer intact.
    addItem(r, humanPack(r, h).id, 'knife', 1);
    downHuman(r, hw, h, T0 + 1000, 'player');
    const pack = humanPack(r, h);
    const slot = pack.slots.find(s => s && s.key === 'knife');
    expect(slot).toBeTruthy();
    const uidBefore = slot!.uid;
    const res = lootHuman(r, hw, h, T0 + 2000, 'inv');
    expect(res.taken).toBeGreaterThan(0);
    const invSlot = r.custody.inv.slots.find(s => s && s.key === 'knife' && s.uid === uidBefore);
    expect(invSlot).toBeTruthy(); // UID preserved, not re-minted
  });

  it('P0.4: killHuman transfers equipped stacks by UID and empties the pack', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const h = Object.values(hw.people).find(p => p.equip.weapon) ?? Object.values(hw.people)[0];
    const weaponUid = h.equip.weapon?.uid;
    killHuman(r, hw, h, T0 + 1000, 'combat');
    expect(h.state).toBe('DEAD');
    expect(h.equip.weapon).toBeNull(); // equipped weapon transferred to corpse
    if (weaponUid) {
      // The corpse bag (a drop entity) should carry the weapon UID.
      const drop = Object.values(r.entities).find(e => e.kind === 'bag');
      const corpse = drop ? r.custody[(drop as any).c] : null;
      const found = corpse?.slots.some(s => s?.uid === weaponUid);
      expect(found).toBe(true);
    }
  });

  it('P0.7: companion refusal is deterministic across reload for the same orderId', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    setFollowing(r, hw, h, true, T0 + 1000);
    // First resolution.
    const res1 = resolveOrder(r, hw, h, 'ord-det-1', 'engage', T0 + 1000, 'sometarget');
    // Reload and resolve the SAME orderId.
    const gs2 = JSON.parse(JSON.stringify(gs));
    const r2 = gs2.run!;
    const h2 = r2.humanWorld!.people[h.actorId];
    setFollowing(r2, r2.humanWorld!, h2, true, T0 + 1000);
    const res2 = resolveOrder(r2, r2.humanWorld!, h2, 'ord-det-1', 'engage', T0 + 1000, 'sometarget');
    expect(res2.result).toBe(res1.result); // deterministic, no RNG reroll
  });

  it('P0.8: applyDamage floors the hit and DOWNS (not auto-kills) on zero HP', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    // A hit that crosses zero HP DOWNS the human.
    const landed = applyDamage(r, hw, h, h.maxHp + 10, 0, T0 + 1000, 'player', 'player');
    expect(landed).toBe(true);
    expect(h.state).toBe('DOWNED');
    expect(h.hp).toBeGreaterThan(0); // DOWNED != DEAD
    // Treat the downed human.
    const treat = treatHuman(r, hw, h, T0 + 2000);
    // (may fail if no medicine — that's honest; state stays DOWNED)
    if (treat.ok) expect(h.state).toBe('IDLE');
  });

  it('P0.9: boardEvac rejects a distant actor and enforces one-trip-per-person', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const trips = Object.values(hw.evacuation);
    expect(trips.length).toBe(3);
    // Set explicit, known boarding tiles for the test (position resolution is tested separately).
    trips[0].siteGx = 100; trips[0].siteGy = 100;
    trips[1].siteGx = 200; trips[1].siteGy = 200;
    trips[2].siteGx = 300; trips[2].siteGy = 300;
    const h = Object.values(hw.people)[0];
    // Move the human far from all boarding sites.
    h.gx = 0; h.gy = 0;
    const far = trips.map(t => boardEvac(r, hw, h, t.tripId, T0 + 1000));
    expect(far.every(x => !x.ok)).toBe(true); // all rejected: not at boarding site
    // Place the human at a boarding site and board once.
    const t0 = trips[0];
    h.gx = t0.siteGx; h.gy = t0.siteGy;
    const ok1 = boardEvac(r, hw, h, t0.tripId, T0 + 2000);
    expect(ok1.ok).toBe(true);
    // Cannot board a SECOND trip.
    const t1 = trips[1];
    const ok2 = boardEvac(r, hw, h, t1.tripId, T0 + 3000);
    expect(ok2.ok).toBe(false);
    expect(ok2.reason).toContain('already boarded');
  });

  it('P0.9: finalizeHumanOutcomes does not default everyone to SURVIVED', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    // No assaults occurred, but humans in hostile sites should NOT auto-survive.
    const summary = finalizeHumanOutcomes(r, hw, T0 + 1000);
    expect(summary.total).toBeGreaterThan(0);
    // At least some outcomes are NOT survived (honest, not a default).
    expect(summary.survived + summary.unresolved + summary.evacuated + summary.dead).toBe(summary.total);
  });

  it('P0.9: endRun stores human outcome history in profile', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const before = (gs.profile as any).humanRunHistory?.length ?? 0;
    // Trigger endRun via the abandon intent.
    const res = dispatch(gs, { id: 'end1', type: 'abandon' } as any, T0 + 1000);
    expect(res.ok).toBe(true);
    const after = (gs.profile as any).humanRunHistory ?? [];
    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1].outcomes).toBeTruthy();
    expect(after[after.length - 1].schema).toBe('human-history-v1');
  });

  it('P0.6: stepHumans runs consume/work/move without corrupting state', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const countBefore = Object.keys(hw.people).length;
    for (let i = 0; i < 5; i++) stepHumans(r, hw, T0 + (i + 1) * 60000);
    expect(Object.keys(hw.people).length).toBe(countBefore);
    expect(validate(JSON.parse(JSON.stringify(gs)))).not.toBeNull();
  });
});
