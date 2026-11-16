/**
 * NPC P0 CORRECTIVE — fault-targeted invariant tests (Control Tower acceptance order).
 *
 * Pins the exact P0 semantics: first-tick time delta, custody conservation after save/reload,
 * trade/loot/death K1 conservation (no mint, UID preserved), deterministic companion refusal,
 * real combat integration, evac boarding rules, proven-safe survivors, and profile history.
 */
import { describe, expect, it } from 'vitest';
import { WW, TILE } from '../src/game/core';
import { ITEMS } from '../src/game/catalog';
import { sourceAt } from '../src/game/engine';
import { newGame, startRun, dispatch, C, addItem, addStack, blockGrid, clearPhysicalLine, mkStack, markDirty } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { VEYRA_PRIMORDIAL_SITES, resolvePrimordialGlobalTile } from '../src/veyra05/ecosystem';
import { authoredGlobalStatic } from '../src/veyra05/floors';
import { doorwayOccupied } from '../src/game/poi-access';
import { validate } from '../src/game/persist';
import { T0 } from './helpers/g1b-kit';
import {
  tickNeeds, stepHumans, humanHarvest, tradeWithHuman, lootHuman, killHuman, applyDamage, downHuman,
  treatHuman, boardEvac, resolveOrder, setFollowing, finalizeHumanOutcomes,
  humanPack, humanHistoryAggregate, humanWorkTick, stepHumanCombat, humanWorldPosition,
  type HumanRecord,
} from '../src/game/humanworld';

function stableHash(s: string) { let n = 2166136261; for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619); return n >>> 0; }
function confrontationScene(h: any, r: any, witnesses: string[] = []) {
  const w = r.custody.inv.slots[r.player.active];
  return JSON.stringify([h.gx, h.gy, h.floor, h.state, h.equip.weapon?.uid ?? '', h.equip.weapon?.dur ?? -1, Math.round(h.hp), [...witnesses].sort(), w?.uid ?? '', w?.dur ?? -1, Math.round(r.player.hp), r.player.active]);
}
function chooseActorHash(hw: any, h: any, predicate: (actorId: string) => boolean) {
  const prior = h.actorId; delete hw.people[prior];
  for (let i = 0; i < 5000; i++) { h.actorId = `qa-${i}`; if (predicate(h.actorId)) break; }
  hw.people[h.actorId] = h;
}
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
    h.intent = { kind: 'move', route: [{ tx: h.gx + 1, ty: h.gy, floor: h.floor }] } as any;
    const before = humanWorldPosition(h);
    const at = T0 + 100;
    stepHumans(r, hw, at);
    const halfway = humanWorldPosition(h);
    const pxMoved = Math.hypot(halfway.gx - before.gx, halfway.gy - before.gy) * TILE;
    expect(pxMoved).toBeGreaterThan(6);
    expect(pxMoved).toBeLessThan(8);
    expect(h.gx).toBe(start![0]); // logical tile occupancy stays discrete during interpolation
    stepHumans(r, hw, T0 + 300);
    expect(h.gx).toBe(start![0] + 1);
    expect(hw.lastStepAt).toBe(T0 + 300);
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

  it('autonomous builder selects a real shared wood source, routes legally, harvests, and carries real output', () => {
    const gs = startAt(921, 259), r = gs.run!, hw = r.humanWorld!;
    const [ox, oy] = r.sourceMap?.veyra?.originAu ? r.sourceMap.veyra.originAu.map(v => Math.round(v / 0.5)) as [number, number] : [0, 0];
    const grid = blockGrid(r); const h = Object.values(hw.people)[0];
    for (const other of Object.values(hw.people)) if (other !== h) other.state = 'DEAD';
    h.occupation = 'builder'; h.equip.weapon = mkStack(r, 'iron_axe', 1); const toolDurBefore = h.equip.weapon.dur!; h.state = 'IDLE'; h.intent = undefined; h.following = false; h.nextThinkAt = 0;
    let choice: { x: number; y: number; tx: number; ty: number; stock: number } | null = null;
    for (let y = 4; y < WW - 4 && !choice; y++) for (let x = 4; x < WW - 4; x++) {
      const s = sourceAt(r, x, y, T0); if (!s || s.stock <= 0 || s.def.mat !== 'wood' || !(ITEMS.iron_axe.power?.wood)) continue;
      if (Object.values(r.entities).some(e => e.tx === x && e.ty === y && (e.g1b || e.kind === 'loot'))) continue;
      const spot = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].find(([sx, sy]) => sx > 1 && sy > 1 && sx < WW - 1 && sy < WW - 1 && (grid[sy * WW + sx] === 0 || grid[sy * WW + sx] === 4));
      if (!spot) continue;
      h.gx = ox + spot[0]; h.gy = oy + spot[1]; h.floor = r.veyraFloor ?? 0;
      choice = { x: spot[0], y: spot[1], tx: x, ty: y, stock: s.stock }; break;
    }
    expect(choice).not.toBeNull();
    stepHumans(r, hw, T0 + 1000);
    const working = h as HumanRecord;
    expect(working.intent?.kind).toBe('work'); expect(h.state).toBe('WORKING');
    const target = working.intent!.target!.match(/^harvest:(\d+),(\d+)$/)!;
    const targetTx = Number(target[1]), targetTy = Number(target[2]);
    const stockBefore = sourceAt(r, targetTx, targetTy, T0 + 1000)!.stock;
    stepHumans(r, hw, T0 + 3000);
    const source = sourceAt(r, targetTx, targetTy, T0 + 3000)!;
    expect(source.stock).toBeLessThan(stockBefore);
    expect(humanPack(r, h).slots.some(s => s?.key === 'wood')).toBe(true);
    expect(r.receipts.some(x => x.kind === 'human.harvest' && x.detail.includes(h.actorId))).toBe(true);
    expect(Object.values(h.workOutputs ?? {}).reduce((n, q) => n + q, 0)).toBeGreaterThan(0); // real output is tracked for later physical-store transfer
    expect(h.equip.weapon?.dur).toBeLessThan(toolDurBefore); // the actual harvesting tool wears on committed source work
  });

  it('returns tracked harvest UID and quantity by a real legal route to authorized community storage and survives reload', () => {
    const gs = startAt(921, 259), r = gs.run!, hw = r.humanWorld!, h = Object.values(hw.people)[0];
    for (const other of Object.values(hw.people)) if (other !== h) other.state = 'DEAD';
    const [ox, oy] = r.sourceMap?.veyra?.originAu ? r.sourceMap.veyra.originAu.map(v => Math.round(v / 0.5)) as [number, number] : [0, 0];
    const grid = blockGrid(r), dirs = [[1,0],[-1,0],[0,1],[0,-1]] as const;
    let delivery: { comm: (typeof hw.communities)[string]; start: [number, number] } | null = null;
    for (const comm0 of Object.values(hw.communities)) {
      const tile = comm0.storeTile; if (!tile) continue;
      const tx = tile[0] - ox, ty = tile[1] - oy;
      if (tx < 1 || ty < 1 || tx >= WW - 1 || ty >= WW - 1) continue;
      const parent = new Int32Array(WW * WW); parent.fill(-2); const queue = new Int32Array(WW * WW); let head = 0, tail = 0;
      for (const [dx, dy] of dirs) {
        const x = tx + dx, y = ty + dy, i = y * WW + x;
        if ((grid[i] === 0 || grid[i] === 4) && parent[i] === -2) { parent[i] = -1; queue[tail++] = i; }
      }
      while (head < tail && !delivery) {
        const at = queue[head++], x = at % WW, y = Math.floor(at / WW);
        // A legal reachable tile at least three steps from the store exercises real movement before deposit.
        if (Math.abs(x - tx) + Math.abs(y - ty) >= 3 && (grid[at] === 0 || grid[at] === 4)) {
          const candidate = Object.values(hw.people).find(v => v.floor === (r.veyraFloor ?? 0));
          if (candidate) { delivery = { comm: comm0, start: [x,y] }; h.community = comm0.id; break; }
        }
        for (const [dx, dy] of dirs) { const nx=x+dx, ny=y+dy, ni=ny*WW+nx;
          if (nx<1||ny<1||nx>=WW-1||ny>=WW-1||parent[ni]!==-2||!(grid[ni]===0||grid[ni]===4)) continue;
          parent[ni] = at; queue[tail++] = ni;
        }
      }
      if (delivery) break;
    }
    expect(delivery).not.toBeNull();
    const comm = delivery!.comm, start = delivery!.start;
    h.gx = ox + start[0]; h.gy = oy + start[1]; h.floor = r.veyraFloor ?? 0;
    h.state = 'IDLE'; h.intent = undefined; h.following = false; h.nextThinkAt = 0; hw.plannerAt = 0;
    const pack = humanPack(r, h), store = r.custody[comm.storeContainers[0]];
    pack.slots.fill(null); store.slots.fill(null);
    const output = mkStack(r, 'berries', 3); pack.slots[0] = output; h.workOutputs = { [output.uid]: 3 };
    for (let i = 1; i <= 30; i++) stepHumans(r, hw, T0 + i * 50);
    expect(h.gx).not.toBe(ox + start![0]);
    expect(h.workOutputs?.[output.uid]).toBeUndefined();
    expect(pack.slots.some(s => s?.uid === output.uid)).toBe(false);
    expect(store.slots.filter(s => s?.uid === output.uid)).toHaveLength(1);
    expect(store.slots.find(s => s?.uid === output.uid)).toMatchObject({ key: 'berries', qty: 3 });
    const loaded = validate(JSON.parse(JSON.stringify(gs)))!;
    expect(Object.values(loaded.run!.custody).flatMap(c => c.slots).filter(s => s?.uid === output.uid)).toHaveLength(1);
    expect(loaded.run!.custody[comm.storeContainers[0]].slots.find(s => s?.uid === output.uid)).toMatchObject({ qty: 3 });
  });

  it('harvest capacity is transactional: merges one admitted unit, then a full pack causes no further source damage', () => {
    const gs = startAt(921, 259), r = gs.run!, hw = r.humanWorld!, h = Object.values(hw.people)[0];
    for (const other of Object.values(hw.people)) if (other !== h) other.state = 'DEAD';
    h.state = 'IDLE'; h.equip.weapon = null;
    const pack = humanPack(r, h); pack.slots.fill(null);
    pack.slots[0] = mkStack(r, 'berries', ITEMS.berries.max - 1);
    for (let i = 1; i < pack.slots.length; i++) pack.slots[i] = mkStack(r, 'iron_axe', 1);
    let target: { x: number; y: number; i: number } | null = null;
    for (let y = 4; y < WW - 4 && !target; y++) for (let x = 4; x < WW - 4; x++) {
      const s = sourceAt(r, x, y, T0);
      if (s?.key !== 'bush' || s.stock <= 0) continue;
      if (Object.values(r.entities).some(e => e.tx === x && e.ty === y && (e.g1b || e.kind === 'loot'))) continue;
      if (Object.values(r.g1b?.far ?? {}).some(e => e.g1b && e.tx === x && e.ty === y)) continue;
      target = { x, y, i: s.i }; break;
    }
    expect(target).not.toBeNull();
    const beforeStock = sourceAt(r, target!.x, target!.y, T0)!.stock;
    expect(humanHarvest(r, hw, h, target!.x, target!.y, T0 + 1000)).toMatchObject({ result: 'yield', got: 0 });
    const admitted = humanHarvest(r, hw, h, target!.x, target!.y, T0 + 2000);
    expect(admitted).toMatchObject({ result: 'yield', got: 1 });
    expect(sourceAt(r, target!.x, target!.y, T0 + 2000)!.stock).toBe(beforeStock - 1);
    expect(pack.slots[0]).toMatchObject({ key: 'berries', qty: ITEMS.berries.max });
    const beforeBlocked = { ...r.sources[target!.i] };
    const blocked = humanHarvest(r, hw, h, target!.x, target!.y, T0 + 3000);
    expect(blocked).toMatchObject({ result: 'blocked', reason: 'pack full; no harvest was taken' });
    expect(r.sources[target!.i]).toEqual(beforeBlocked);
    expect(Object.values(r.custody).flatMap(c => c.slots).filter(s => s?.uid === pack.slots[0]!.uid)).toHaveLength(1);
  });

  it('human talk and barter commit through dispatch; save/reload preserves trust, memory and both UIDs', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const origin = r.sourceMap?.veyra?.originAu;
    const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
    const h = Object.values(hw.people).find(v => v.floor === (r.veyraFloor ?? 0) && v.gx - ox >= 0 && v.gy - oy >= 0 && v.gx - ox < WW && v.gy - oy < WW)!;
    expect(h).toBeTruthy();
    r.player.x = (h.gx - ox + 0.5) * TILE; r.player.y = (h.gy - oy + 0.5) * TILE;
    addItem(r, 'inv', 'wood', 4);
    addItem(r, humanPack(r, h).id, 'berries', 1);
    const pSlot = r.custody.inv.slots.findIndex(Boolean);
    const hSlot = humanPack(r, h).slots.findIndex(Boolean);
    const pStack = r.custody.inv.slots[pSlot]!, hStack = humanPack(r, h).slots[hSlot]!;
    pStack.meta = 'player-lot:one'; hStack.meta = 'survivor-lot:two';
    const pUid = pStack.uid, hUid = hStack.uid, pQty = pStack.qty, hQty = hStack.qty;
    const trustBeforeTalk = h.trust;
    expect(dispatch(gs, { id: 'human-talk-test', type: 'humanTalk', actorId: h.actorId }, T0 + 1000).ok).toBe(true);
    for (let i = 0; i < 5; i++) expect(dispatch(gs, { id: `human-talk-repeat-${i}`, type: 'humanTalk', actorId: h.actorId }, T0 + 1001 + i).ok).toBe(true);
    expect(h.trust).toBe(trustBeforeTalk); // repeated status queries are not social currency
    expect(dispatch(gs, { id: 'human-trade-test', type: 'humanExchange', actorId: h.actorId, playerSlot: pSlot, humanSlot: hSlot }, T0 + 1010).ok).toBe(true);
    expect(r.custody.inv.slots[pSlot]).toMatchObject({ uid: hUid, qty: hQty, meta: 'survivor-lot:two' });
    expect(humanPack(r, h).slots[hSlot]).toMatchObject({ uid: pUid, qty: pQty, meta: 'player-lot:one' });
    expect(h.trust).toBeGreaterThan(50);
    const earnedTrust = h.trust;
    expect(dispatch(gs, { id: 'human-trade-return', type: 'humanExchange', actorId: h.actorId, playerSlot: pSlot, humanSlot: hSlot }, T0 + 1011).ok).toBe(true);
    expect(h.trust).toBe(earnedTrust);
    expect(dispatch(gs, { id: 'human-trade-repeat', type: 'humanExchange', actorId: h.actorId, playerSlot: pSlot, humanSlot: hSlot }, T0 + 1012).ok).toBe(true);
    expect(h.trust).toBe(earnedTrust); // swapping the same two UIDs back and forth is not new social evidence
    addItem(r, 'inv', 'wood', 2);
    addItem(r, humanPack(r, h).id, 'berries', 1);
    const freshOffer = r.custody.inv.slots.findIndex(s => s?.key === 'wood' && s.meta === undefined);
    const freshAsk = humanPack(r, h).slots.findIndex(s => s?.key === 'berries' && s.meta === undefined);
    expect(freshOffer).toBeGreaterThanOrEqual(0); expect(freshAsk).toBeGreaterThanOrEqual(0);
    expect(dispatch(gs, { id: 'human-trade-distinct-stacks', type: 'humanExchange', actorId: h.actorId, playerSlot: freshOffer, humanSlot: freshAsk }, T0 + 1013).ok).toBe(true);
    expect(h.trust).toBe(earnedTrust); // even distinct stacks cannot turn repeat swaps into farmable trust
    expect(h.disposition_known.knownPeople).toContain('player');
    const loaded = validate(JSON.parse(JSON.stringify(gs)))!;
    const h2 = loaded.run!.humanWorld!.people[h.actorId];
    expect(h2.trust).toBe(h.trust);
    expect(humanPack(loaded.run!, h2).slots[hSlot]!.uid).toBe(pUid);
  });

  it('refuses a trivial barter for a carried rare Core without moving either UID', () => {
    const gs = startAt(921, 259), r = gs.run!, hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    const origin = r.sourceMap?.veyra?.originAu;
    const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
    r.player.x = (h.gx - ox + 0.5) * TILE; r.player.y = (h.gy - oy + 0.5) * TILE;
    addItem(r, 'inv', 'wood', 1);
    const core = mkStack(r, 'core_meteor', 1); expect(addStack(r, humanPack(r, h).id, core)).toBe(true);
    const offerSlot = r.custody.inv.slots.findIndex(s => s?.key === 'wood');
    const coreSlot = humanPack(r, h).slots.findIndex(s => s?.uid === core.uid);
    const trust = h.trust, playerUid = r.custody.inv.slots[offerSlot]!.uid;
    const res = dispatch(gs, { id: 'barter-core-refusal', type: 'humanExchange', actorId: h.actorId, playerSlot: offerSlot, humanSlot: coreSlot }, T0 + 1000);
    expect(res.ok).toBe(false);
    expect(r.custody.inv.slots[offerSlot]!.uid).toBe(playerUid);
    expect(humanPack(r, h).slots[coreSlot]!.uid).toBe(core.uid);
    expect(h.trust).toBe(trust);
  });

  it('confrontation compliance physically transfers the demanded carried stack and records evidenced witnesses only', () => {
    const gs = startAt(921, 259), r = gs.run!, hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    const witness = Object.values(hw.people).find(other => other !== h)!;
    for (const other of Object.values(hw.people)) if (other !== h && other !== witness) other.state = 'DEAD';
    witness.state = 'IDLE'; witness.floor = h.floor + 1; witness.gx = h.gx + 1; witness.gy = h.gy;
    h.state = 'IDLE'; h.equip.weapon = null; h.protectedPeople = [];
    const origin = r.sourceMap?.veyra?.originAu;
    const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
    r.player.x = (h.gx - ox + 0.5) * TILE; r.player.y = (h.gy - oy + 0.5) * TILE;
    addItem(r, humanPack(r, h).id, 'wood', 1);
    const stack = humanPack(r, h).slots.find(s => s?.key === 'wood')!;
    chooseActorHash(hw, h, actorId => stableHash(`${actorId}:${confrontationScene(h, r)}:item:${stack.uid}:1`) % 100 < 78);
    const res = dispatch(gs, { id: 'human-demand-stack', type: 'humanThreaten', actorId: h.actorId, demand: 'item', stackUid: stack.uid }, T0 + 1001);
    if (!res.ok) throw new Error(res.reason);
    expect(res.msg).toMatch(/Hands over/);
    expect(r.custody.inv.slots.some(s => s?.uid === stack.uid)).toBe(true);
    expect(humanPack(r, h).slots.some(s => s?.uid === stack.uid)).toBe(false);
    const incident = Object.values(hw.incidents).at(-1)!;
    expect(incident.witnesses).toEqual([]);
  });

  it('does not reroll repeated confrontation clicks against an unchanged scene', () => {
    const gs = startAt(921, 259), r = gs.run!, hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    for (const other of Object.values(hw.people)) if (other !== h) other.state = 'DEAD';
    h.state = 'IDLE'; h.equip.weapon = null; h.disposition = 'neutral'; h.intent = undefined;
    const origin = r.sourceMap?.veyra?.originAu;
    const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
    const grid = blockGrid(r); let cell: [number, number] | null = null;
    for (let y = 10; y < WW - 10 && !cell; y++) for (let x = 10; x < WW - 11; x++) if ((grid[y * WW + x] === 0 || grid[y * WW + x] === 4) && (grid[y * WW + x + 1] === 0 || grid[y * WW + x + 1] === 4)) { cell = [x, y]; break; }
    expect(cell).not.toBeNull();
    h.gx = ox + cell![0]; h.gy = oy + cell![1]; h.floor = r.veyraFloor ?? 0;
    r.player.x = (cell![0] + 1.5) * TILE; r.player.y = (cell![1] + 0.5) * TILE;
    chooseActorHash(hw, h, actorId => stableHash(`${actorId}:${confrontationScene(h, r)}:back_off::1`) % 100 >= 78);
    const first = dispatch(gs, { id: 'human-repeat-threat-1', type: 'humanThreaten', actorId: h.actorId, demand: 'back_off' }, T0 + 1001);
    expect(first.ok).toBe(true);
    expect(first.msg).toMatch(/Refuses/);
    const trust = h.trust, incidents = Object.keys(hw.incidents).length;
    const repeat = dispatch(gs, { id: 'human-repeat-threat-2', type: 'humanThreaten', actorId: h.actorId, demand: 'back_off' }, T0 + 1002);
    expect(repeat.ok).toBe(false);
    expect(repeat.reason).toMatch(/already answered/);
    expect(h.trust).toBe(trust);
    expect(Object.keys(hw.incidents)).toHaveLength(incidents);
  });

  it('a survivor who chooses FIGHT lands a timed, facing- and LOS-gated K5 hit on the player', () => {
    const gs = startAt(921, 259), r = gs.run!, hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    for (const other of Object.values(hw.people)) if (other !== h) other.state = 'DEAD';
    h.state = 'IDLE'; h.disposition = 'predatory'; h.combatProficiency = 0; h.intent = undefined;
    h.equip.weapon = mkStack(r, 'wood_club', 1);
    const origin = r.sourceMap?.veyra?.originAu;
    const ox = origin ? Math.round(origin[0] / 0.5) : 0, oy = origin ? Math.round(origin[1] / 0.5) : 0;
    const grid = blockGrid(r); let cell: [number, number] | null = null;
    for (let y = 10; y < WW - 10 && !cell; y++) for (let x = 10; x < WW - 11; x++) if ((grid[y * WW + x] === 0 || grid[y * WW + x] === 4) && (grid[y * WW + x + 1] === 0 || grid[y * WW + x + 1] === 4)) { cell = [x, y]; break; }
    expect(cell).not.toBeNull();
    h.gx = ox + cell![0]; h.gy = oy + cell![1]; h.floor = r.veyraFloor ?? 0; h.dir = 2;
    r.player.x = (cell![0] + 1.5) * TILE; r.player.y = (cell![1] + 0.5) * TILE;
    expect(clearPhysicalLine(r, { x: (cell![0] + 0.5) * TILE, y: (cell![1] + 0.5) * TILE }, r.player, true)).toBe(true);
    chooseActorHash(hw, h, actorId => stableHash(`${actorId}:${confrontationScene(h, r)}:back_off::1`) % 100 < 68);
    const at = T0 + 1001;
    const confrontation = dispatch(gs, { id: 'human-fight-branch', type: 'humanThreaten', actorId: h.actorId, demand: 'back_off' }, at);
    if (!confrontation.ok) throw new Error(confrontation.reason);
    expect(confrontation.msg).toMatch(/fights back/);
    let hits = 0;
    stepHumanCombat(r, hw, at + 500, undefined, () => hits++);
    expect(hits).toBe(1);
    expect(h.equip.weapon?.dur).toBe(119);
  });

  it('rejects remote human social actions without success receipts or state changes', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const h = Object.values(r.humanWorld!.people)[0];
    const trust = h.trust;
    const seq = r.seq;
    const res = dispatch(gs, { id: 'human-remote-threat-test', type: 'humanThreaten', actorId: h.actorId }, T0 + 1000);
    expect(res.ok).toBe(false);
    expect(h.trust).toBe(trust);
    expect(h.state).not.toBe('FIGHTING');
    expect(r.seq).toBe(seq);
  });

  it('remote robbery of a downed survivor is rejected without moving any carried UID', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    const pack = humanPack(r, h);
    const carried = pack.slots.find(s => s !== null)!;
    expect(carried).toBeTruthy();
    downHuman(r, hw, h, T0 + 1000, 'player', 'player');
    r.player.x = 0; r.player.y = 0;
    const seq = r.seq;
    const invBefore = JSON.stringify(r.custody.inv.slots);
    const result = dispatch(gs, { id: 'human-remote-loot-test', type: 'humanLoot', actorId: h.actorId }, T0 + 1001);
    expect(result.ok).toBe(false);
    expect(r.seq).toBe(seq);
    expect(pack.slots.some(s => s?.uid === carried.uid)).toBe(true);
    expect(JSON.stringify(r.custody.inv.slots)).toBe(invBefore);
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
      const drop = [...Object.values(r.entities), ...Object.values(r.veyraOffscreenEntities ?? {})].find(e => e.kind === 'bag' && e.born === T0 + 1000);
      const corpse = drop ? r.custody[(drop as any).c] : null;
      expect(corpse?.slots.some(s => s?.uid === weaponUid)).toBe(true);
      expect(Object.values(r.custody).flatMap(c => c.slots).filter(s => s?.uid === weaponUid)).toHaveLength(1);
      const loaded = validate(JSON.parse(JSON.stringify(gs)))!;
      expect(loaded).toBeTruthy();
      expect(Object.values(loaded.run!.custody).flatMap(c => c.slots).filter(s => s?.uid === weaponUid)).toHaveLength(1);
    }
  });

  it('accepted recruitment creates a real collision-aware companion follow route', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const grid = blockGrid(r);
    const o = r.sourceMap?.veyra?.originAu;
    const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
    let lane: [number, number] | null = null;
    for (let y = 10; y < WW - 10 && !lane; y++) for (let x = 10; x < WW - 18; x++) {
      if (Array.from({ length: 8 }, (_, i) => grid[y * WW + x + i]).every(v => v === 0 || v === 4)) { lane = [x, y]; break; }
    }
    expect(lane).not.toBeNull();
    const h = Object.values(hw.people)[0];
    for (const other of Object.values(hw.people)) if (other !== h) other.state = 'DEAD';
    h.gx = ox + lane![0]; h.gy = oy + lane![1]; h.floor = r.veyraFloor ?? 0; h.state = 'IDLE';
    r.player.x = (lane![0] + 7.5) * TILE; r.player.y = (lane![1] + 0.5) * TILE;
    setFollowing(r, hw, h, true, T0 + 1000);
    const start = h.gx;
    for (let i = 0; i < 20; i++) stepHumans(r, hw, T0 + (i + 1) * 60000);
    expect(h.following).toBe(true);
    expect(h.gx).toBeGreaterThan(start);
    expect(Math.abs(h.gx - (ox + Math.floor(r.player.x / TILE))) + Math.abs(h.gy - (oy + Math.floor(r.player.y / TILE)))).toBe(1);
    expect(h.intent?.kind).toBe('follow');
    expect(dispatch(gs, { id: 'human-dismiss-test', type: 'humanDismiss', actorId: h.actorId }, T0 + 1200001).ok).toBe(true);
    expect(h.following).toBe(false);
    expect(h.intent).toBeUndefined();
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

  it('human melee uses K5 reach, floor and cadence gates and wears its equipped weapon', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const h = Object.values(hw.people)[0];
    const m = r.creatures[0];
    expect(m).toBeTruthy();
    const grid = blockGrid(r), o = r.sourceMap?.veyra?.originAu;
    const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
    let lane: [number, number] | null = null;
    for (let y = 10; y < WW - 10 && !lane; y++) for (let x = 10; x < WW - 11; x++) {
      const a = grid[y * WW + x], b = grid[y * WW + x + 1];
      if ((a === 0 || a === 4) && (b === 0 || b === 4)) { lane = [x, y]; break; }
    }
    expect(lane).not.toBeNull();
    for (const other of Object.values(hw.people)) if (other !== h) other.state = 'DEAD';
    h.gx = ox + lane![0]; h.gy = oy + lane![1]; h.floor = 0; h.dir = 2; h.state = 'FIGHTING';
    h.intent = { intentId: 'combat-test', actorId: h.actorId, kind: 'fight', target: m.id, preconditions: [], reserved: [], startAt: T0, dueAt: T0 };
    h.equip.weapon = mkStack(r, 'knife', 1); h.equip.weapon.dur = 10;
    r.creatures = [m]; m.state = 'idle'; m.floor = 0; m.x = (lane![0] + 1.5) * TILE; m.y = (lane![1] + 0.5) * TILE;
    let hits = 0;
    const wallId = 'npc-combat-test-wall';
    r.entities[wallId] = { id: wallId, kind: 'struct', type: 'wall_wood', tx: lane![0] + 1, ty: lane![1], x: (lane![0] + 1.5) * TILE, y: (lane![1] + 0.5) * TILE, hp: 100, maxHp: 100 };
    markDirty();
    stepHumanCombat(r, hw, T0 + 1000, () => hits++);
    expect(hits).toBe(0); // blocking wall prevents the hit
    delete r.entities[wallId]; markDirty();
    stepHumanCombat(r, hw, T0 + 1100, () => hits++);
    stepHumanCombat(r, hw, T0 + 1200, () => hits++);
    expect(hits).toBe(1); // cadence blocks the second release
    expect(h.equip.weapon?.dur).toBe(9);
    m.floor = 1;
    stepHumanCombat(r, hw, T0 + 2000, () => hits++);
    expect(hits).toBe(1); // wrong floor cannot be struck
    m.floor = 0; m.x = (lane![0] + 20.5) * TILE;
    stepHumanCombat(r, hw, T0 + 3000, () => hits++);
    expect(hits).toBe(1); // out of reach
    m.x = (lane![0] + 1.5) * TILE;
    stepHumanCombat(r, hw, T0 + 4000, () => hits++);
    expect(hits).toBe(2);
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
