/**
 * G1B — the 130 approved sources, three card cases, three generators and five gated doors, on REAL Veyra geometry.
 *
 * Default run: invariants of the frozen data (src/game/g1b-sources.generated.ts) measured against the compiled window
 * worlds the game itself uses, each object in two differently-placed streamed windows.
 * The slow resolver that produced the data lives in tests/g1b-resolve.test.ts (opt-in).
 */
import { describe, expect, it } from 'vitest';
import { probe } from './helpers/g1b-resolve';
// the frozen round-1 geometry: the 130 base sources (the batch-2 ecology is audited by tests/g1b-ecology*.test.ts)
import { G1B_BASE_SOURCE_SITES as G1B_SOURCE_SITES, G1B_GATES, G1B_FIXTURES, G1B_VARIANCES } from '../src/game/g1b-sources.generated';
import { FRAME_W, FRAME_H } from '../src/veyra05/frame';

type P = ReturnType<typeof probe>;
const probes: P[] = [];
/** Real collision data that contains a global tile with a margin (probes are reused: compiling a window is the cost). */
function at(gx: number, gy: number, margin = 24): P {
  const hit = probes.find(p => gx - p.ox >= margin && gy - p.oy >= margin && p.ox + 200 - gx > margin && p.oy + 200 - gy > margin); if (hit) return hit;
  const p = probe(gx, gy); probes.push(p); return p;
}
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const all = [...G1B_SOURCE_SITES.map(s => ({ id: s.id, gx: s.gx, gy: s.gy, gate: s.gate })), ...G1B_FIXTURES.map(f => ({ id: f.id, gx: f.gx, gy: f.gy, gate: undefined as string | undefined }))];

describe('G1B frozen geometry', () => {
  it('every source id and fixture has one distinct in-world tile', () => {
    expect(G1B_SOURCE_SITES).toHaveLength(130); expect(G1B_FIXTURES).toHaveLength(6); expect(G1B_GATES).toHaveLength(5);
    expect(new Set(all.map(v => v.id)).size).toBe(136); expect(new Set(all.map(v => v.gx + ',' + v.gy)).size).toBe(136);
    for (const v of all) { expect(Number.isInteger(v.gx) && Number.isInteger(v.gy), v.id).toBe(true); expect(v.gx > 2 && v.gy > 2 && v.gx < FRAME_W - 2 && v.gy < FRAME_H - 2, v.id).toBe(true); }
    // solid objects never touch edge-to-edge (a touching pair would make a wall the player cannot pass)
    const taken = new Set(all.map(v => v.gx + ',' + v.gy)); const touching = all.filter(v => N4.some(([dx, dy]) => taken.has((v.gx + dx) + ',' + (v.gy + dy)))).map(v => v.id);
    expect(touching).toEqual([]);
  });

  it('every chest, card case and generator stands on free walkable ground with a free tile to stand on beside it', () => {
    const bad: string[] = [];
    // Interior furniture is dressed per streamed window, so every object is measured in TWO differently-placed windows.
    const second: P[] = []; const at2 = (gx: number, gy: number) => { const hit = second.find(p => gx - p.ox >= 24 && gy - p.oy >= 24 && p.ox + 200 - gx > 24 && p.oy + 200 - gy > 24 && (gx - p.ox !== 100 || gy - p.oy !== 100)); if (hit) return hit; const p = probe(gx + 37, gy - 29); second.push(p); return p; };
    for (const v of all) for (const p of [at(v.gx, v.gy), at2(v.gx, v.gy)]) {
      if (!p.pass(v.gx, v.gy)) bad.push(`${v.id}@${v.gx},${v.gy}: tile is not free walkable ground`);
      if (p.isDoor(v.gx, v.gy)) bad.push(`${v.id}: on a door`);
      if (p.isStair(v.gx, v.gy)) bad.push(`${v.id}: on a stair`);
      if (p.src(v.gx, v.gy)) bad.push(`${v.id}: on a harvest source`);
      if (!N4.some(([dx, dy]) => p.pass(v.gx + dx, v.gy + dy) && !p.isDoor(v.gx + dx, v.gy + dy) && !all.some(o => o.gx === v.gx + dx && o.gy === v.gy + dy))) bad.push(`${v.id}: no free tile to stand on`);
      // never plugs a doorway: no door directly beside the object
      if (N4.some(([dx, dy]) => p.isDoor(v.gx + dx, v.gy + dy))) bad.push(`${v.id}: directly beside a door`);
    }
    expect(bad).toEqual([]);
  }, 600_000);

  it('every gate is a real door; its room is sealed by that one door and holds exactly its gated chests', () => {
    const solid = new Set(all.map(v => v.gx + ',' + v.gy)); const bad: string[] = [];
    for (const g of G1B_GATES) {
      const [dx0, dy0] = g.door, p = at(dx0, dy0, 40);
      if (!p.isDoor(dx0, dy0)) { bad.push(`${g.id}: ${dx0},${dy0} is not a door`); continue; }
      // flood the room from the cell just inside the door; doors are closed, chests are solid
      const start: [number, number] = [dx0 + g.interior[0], dy0 + g.interior[1]]; const seen = new Set<string>([start.join(',')]); const q = [start]; const doors = new Set<string>(); let escaped = false;
      while (q.length) { const [x, y] = q.pop()!; if (seen.size > 6000) { escaped = true; break; }
        for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (seen.has(k)) continue; if (p.isDoor(nx, ny)) { doors.add(k); continue; } if (!p.walk(nx, ny) || p.isStatic(nx, ny)) continue; seen.add(k); if (!solid.has(k)) q.push([nx, ny]); } }
      if (escaped) bad.push(`${g.id}: the room behind the door is not enclosed`);
      if (doors.size !== 1 || !doors.has(dx0 + ',' + dy0)) bad.push(`${g.id}: room has doors ${[...doors].join(' ')} (wanted only ${dx0},${dy0})`);
      const inside = G1B_SOURCE_SITES.filter(s => seen.has(s.gx + ',' + s.gy)).map(s => s.id).sort(), want = G1B_SOURCE_SITES.filter(s => s.gate === g.id).map(s => s.id).sort();
      if (JSON.stringify(inside) !== JSON.stringify(want)) bad.push(`${g.id}: chests inside ${inside.length} ≠ gated ${want.length}`);
      if (g.power && !G1B_FIXTURES.some(f => f.id === g.power && f.kind === 'gen')) bad.push(`${g.id}: no generator ${g.power}`);
      if (g.power && seen.has((() => { const f = G1B_FIXTURES.find(v => v.id === g.power)!; return f.gx + ',' + f.gy; })())) bad.push(`${g.id}: its generator is locked inside its own room`);
      if (g.card && seen.has((() => { const f = G1B_FIXTURES.find(v => v.card === g.card + '_card')!; return f.gx + ',' + f.gy; })())) bad.push(`${g.id}: its card is locked inside its own room`);
    }
    expect(bad).toEqual([]);
    // all 19 card-room chests and every DEEP chest are behind a gate; nothing else is
    expect(G1B_SOURCE_SITES.filter(s => s.zone === 'CARD_ROOM').every(s => !!s.gate)).toBe(true);
    expect(G1B_SOURCE_SITES.filter(s => s.gate).length).toBe(23);
    const colour = (c: string) => G1B_SOURCE_SITES.filter(s => s.gate && G1B_GATES.find(g => g.id === s.gate)!.card === c && s.zone === 'CARD_ROOM').length;
    expect([colour('green'), colour('blue'), colour('purple')]).toEqual([6, 6, 7]);
  }, 600_000);

  it('the measured variances from the approved intent are recorded, not hidden', () => {
    expect(G1B_VARIANCES.length).toBe(9);
    for (const id of ['rd_19', 'rd_1b', 'rd_1c', 'po_meridian', 'po_academy:room_green', 'po_archive:deep']) expect(G1B_VARIANCES.some(v => v.includes(id)), id).toBe(true);
  });
});
