/** Bounded mechanical access proof, not a natural journey or enjoyment test.
 * Starts an explicit QA inspection fixture on exterior ground, then uses real tick collision and door intents.
 */
import { afterEach, expect, it } from 'vitest';
import { getWindowWorld } from '../src/veyra05/window';
import { layoutIdAt } from '../src/veyra05/scenes';
import { hookVillage } from '../src/veyra05/arch/sites';
import { compilePlan } from '../src/veyra05/arch/plan';
import { FRAME_W } from '../src/veyra05/frame';
import { T, TILE, WW, WH } from '../src/game/core';
import { newGame, startRun, blockGrid, markDirty, dispatch, g1bEntities } from '../src/game/engine';
import { tick, type Input } from '../src/game/sim';
import { serializeSnapshot, validate } from '../src/game/persist';
import { G1B_SOURCE_SITES } from '../src/game/g1b';
import { setActiveLayout } from '../src/game/world';

const ox = 2500, oy = 600, layout = layoutIdAt(ox, oy), time0 = Date.UTC(2026, 10, 17);
const ix = (gx: number, gy: number) => (gy - oy) * WW + gx - ox;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
afterEach(() => { setActiveLayout('shipping'); markDirty(); });

it('the inherited partition edit changes only its six intended wall cells', () => {
  const current = hookVillage(), old = structuredClone(current);
  for (const p of old.partitions) if (p.level === 0 && p.x === 2598 && p.y >= 691 && p.y <= 694) p.x = 2599;
  old.doors.find(d => d.label === 'Garden Cottage Partition')!.x = 2599;
  const before = compilePlan(old).levels.get(0)!.tiles, after = compilePlan(current).levels.get(0)!.tiles;
  const delta = [...after].filter(([i, t]) => before.get(i) !== t).map(([i]) => [i % FRAME_W, Math.floor(i / FRAME_W)]);
  expect(delta.sort()).toEqual([[2598, 691], [2598, 692], [2598, 694], [2599, 691], [2599, 692], [2599, 694]].sort());
  // Both old and new arch openings are FLOOR; only six actual tiles change, not eight.
  expect(before.get(691 * FRAME_W + 2599)).toBe(T.PWALL);
  expect(after.get(691 * FRAME_W + 2599)).toBe(T.FLOOR);
  expect(current.rooms).toEqual(old.rooms); expect(current.props).toEqual(old.props);
  expect(G1B_SOURCE_SITES).toHaveLength(738);
  // Census excluded this room before the fix. No source is invented or relocated for this test.
  expect(G1B_SOURCE_SITES.filter(s => s.space === 'po_hook/0/garden_cottage')).toEqual([]);
});

it('walks exterior → closed door refusal → legal opening → both cottage sides → retreat; persists the door', () => {
  setActiveLayout(layout);
  const gs = newGame();
  expect(startRun(gs, 'male', time0, null, 101, { tx: 99, ty: 87 }).ok).toBe(true);
  const r = gs.run!, ww = getWindowWorld(layout, 4), ground = ww.floors.ground;
  let time = time0, seq = 0;
  const act = (type: string, payload: object = {}) => dispatch(gs, { id: `hook-${++seq}`, type, ...payload }, ++time);
  const door = Object.values(r.entities).find(e => e.kind === 'door' && e.tx === 99 && e.ty === 90)!;
  expect(door).toBeTruthy(); expect(door.locked).toBeUndefined(); expect(door.open).toBeFalsy();
  const sourceIds = g1bEntities(r).map(e => e.g1b!.sid).sort();
  const neutral: Input = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false };
  function step(input: Partial<Input>) { time += 30; tick(gs, { ...neutral, ...input }, 30, time); }
  function walk(gx: number, gy: number) {
    const target = ix(gx, gy), grid = blockGrid(r), from = new Int32Array(grid.length).fill(-2), queue: number[] = [];
    const start = Math.floor(r.player.y / TILE) * WW + Math.floor(r.player.x / TILE); from[start] = -1; queue.push(start);
    for (let h = 0; h < queue.length && from[target] === -2; h++) {
      const i = queue[h], x = i % WW, y = Math.floor(i / WW);
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy, j = ny * WW + nx;
        if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1 || grid[j] !== 0 || from[j] !== -2) continue;
        from[j] = i; queue.push(j);
      }
    }
    expect(from[target], `path to ${gx},${gy}`).not.toBe(-2);
    const path: number[] = []; for (let i = target; i !== -1; i = from[i]) path.push(i);
    for (const i of path.reverse().slice(1)) {
      const x = (i % WW) * TILE + 8, y = Math.floor(i / WW) * TILE + 8;
      for (let k = 0; Math.hypot(r.player.x - x, r.player.y - y) > 2.5 && k < 30; k++) {
        const dx = x - r.player.x, dy = y - r.player.y; step({ left: dx < -1.5, right: dx > 1.5, up: dy < -1.5, down: dy > 1.5 });
      }
      expect(Math.hypot(r.player.x - x, r.player.y - y), `physical movement to ${i}`).toBeLessThanOrEqual(2.5);
    }
  }
  walk(2599, 689);
  for (let i = 0; i < 18; i++) step({ down: true });
  expect(r.player.y).toBeLessThan((690 - oy) * TILE); // closed leaf physically blocks entry
  expect(blockGrid(r)[ix(2599, 690)]).toBe(3);
  expect(act('door', { eid: door.id }).ok).toBe(true);
  walk(2599, 690); expect(act('door', { eid: door.id }).ok).toBe(false); // occupied threshold cannot close
  walk(2602, 696); walk(2594, 692); // both sides of the relocated partition, using its real opening/route
  const grid = blockGrid(r), seen = new Set<number>(), q = [ix(2594, 692)]; seen.add(q[0]);
  for (let h = 0; h < q.length; h++) for (const [dx, dy] of N4) {
    const i = q[h], x = i % WW + dx, y = Math.floor(i / WW) + dy, j = y * WW + x;
    if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1 || seen.has(j) || grid[j] !== 0) continue;
    seen.add(j); q.push(j);
  }
  for (let y = 691; y < 698; y++) for (let x = 2593; x < 2605; x++) if (grid[ix(x, y)] === 0) expect(seen.has(ix(x, y)), `standable room tile ${x},${y}`).toBe(true);
  walk(2599, 691);
  expect(act('door', { eid: door.id }).ok).toBe(true);
  expect(act('door', { eid: door.id }).ok).toBe(true); // ordinary inside handle
  walk(2599, 688);
  const snap = JSON.parse(JSON.parse(serializeSnapshot(gs)).payload);
  const restored = validate(snap); expect(restored).not.toBeNull();
  expect(restored!.run!.entities[door.id].open).toBe(true);
  expect(g1bEntities(restored!.run!).map(e => e.g1b!.sid).sort()).toEqual(sourceIds);
  expect(ground.solidProps[ix(2599, 691)]).toBe(0);
  // Same coordinates on another floor must not remotely toggle this ground-floor leaf.
  r.veyraFloor = 1; markDirty(); expect(act('door', { eid: door.id }).ok).toBe(false);
}, 20000);
