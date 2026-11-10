import { describe, expect, it } from 'vitest';
import { T } from '../../game/core';
import { FRAME_W } from '../frame';
import { compilePlan, type Level } from './plan';
import { makeRest48Plan, REST48_SITES } from './rest48';

/** Authored 1× tile-geometry checks, not browser/gameplay/visual acceptance. */
const cases = [
  { id: 'po_elderwood', kind: 'elder_aion_root', level: -1, lair: 'roots_below', minSteps: 16 },
  { id: 'po_necropolis', kind: 'elder_anubis_sarc', level: -1, lair: 'crypt_descent', minSteps: 18 },
  { id: 'po_hall_eyes', kind: 'elder_argus_eye', level: -1, lair: 'blind_archive', minSteps: 18 },
  { id: 'po_gate', kind: 'elder_atlas_gate', level: -1, lair: 'anchor_vault', minSteps: 18 },
  { id: 'po_surtur', kind: 'elder_surtur_forge', level: -1, lair: 'below_embers', minSteps: 18 },
  { id: 'po_typhon', kind: 'elder_typhon_shard', level: 0, lair: 'power_heart', minSteps: 20 },
] as const;

function key(x: number, y: number) { return y * FRAME_W + x; }
function walkable(t: number | undefined) { return t !== undefined && t !== T.PWALL && t !== T.DEEP && t !== T.RIVER && t !== T.LAVA && t !== T.CLIFF; }
function pathLength(tiles: Map<number, number>, sx: number, sy: number, tx: number, ty: number): number {
  const start = key(sx, sy), dest = key(tx, ty), q = [start], depth = new Map<number, number>([[start, 0]]);
  for (let h = 0; h < q.length; h++) {
    const at = q[h];
    if (at === dest) return depth.get(at)!;
    const x = at % FRAME_W, y = Math.floor(at / FRAME_W);
    for (const [dx, dy] of [[1, 0],[-1, 0],[0, 1],[0, -1]]) {
      const nx = x + dx, ny = y + dy, n = key(nx, ny);
      if (nx < 0 || nx >= FRAME_W || ny < 0 || depth.has(n) || !walkable(tiles.get(n))) continue;
      depth.set(n, depth.get(at)! + 1); q.push(n);
    }
  }
  return -1;
}

describe('VEYRA R5 Elder lairs — isolated source geometry contract', () => {
  for (const c of cases) {
    it(`${c.id}: true enclosed/pressure core, accessible and non-trivial route`, () => {
      const site = REST48_SITES[c.id];
      const plan = makeRest48Plan(c.id);
      expect(plan.poi).toBe(c.id);
      expect(plan.levels).toEqual([-1, 0, 1, 2]);
      expect(plan.stairs).toHaveLength(3);
      const landmark = plan.props.filter(p => p.kind === c.kind);
      expect(landmark).toHaveLength(1);
      const boss = landmark[0];
      expect(boss.level).toBe(c.level);
      const body = plan.structures.find(q => q.id === c.id + '.' + c.lair);
      expect(body).toBeDefined();
      expect(body!.open).not.toBe(true);
      expect(body!.roof).toBeNull();
      const chamber = plan.rooms.find(q => q.struct === body!.id && q.level === c.level && !q.open);
      expect(chamber).toBeDefined();
      expect(chamber!.rects.some(([x, y, w, h]) => boss.x > x && boss.x < x + w - 1 && boss.y > y && boss.y < y + h - 1)).toBe(true);
      const compiled = compilePlan(plan);
      expect(compiled.issues).toEqual([]);
      const layer = compiled.levels.get(c.level as Level);
      expect(layer).toBeDefined();
      expect(walkable(layer!.tiles.get(key(boss.x, boss.y)))).toBe(true);
      let start: [number, number];
      if (c.level === -1) {
        const entry = plan.stairs.find(s => s.from === 0 && s.to === -1)!;
        expect(entry).toBeDefined();
        expect(walkable(compiled.levels.get(0)!.tiles.get(key(entry.x, entry.y)))).toBe(true);
        start = [entry.tx, entry.ty];
      } else {
        const entrance = plan.doors.find(d => d.label === 'Southern pressure slit')!;
        expect(entrance).toBeDefined();
        start = [entrance.x, entrance.y + 1]; // Falls Road side of the sole canyon entrance
        expect(walkable(layer!.tiles.get(key(...start)))).toBe(true);
      }
      const len = pathLength(layer!.tiles, start[0], start[1], boss.x, boss.y);
      expect(len).toBeGreaterThanOrEqual(c.minSteps);
      expect(pathLength(layer!.tiles, boss.x, boss.y, start[0], start[1])).toBe(len);
      const ex = c.level === -1 ? plan.stairs.find(s => s.from === 0 && s.to === -1)! : null;
      expect(Math.abs(boss.x - site.cx) < 18 && Math.abs(boss.y - site.cy) < 24).toBe(true);
      if (ex) expect([ex.tx, ex.ty]).not.toEqual([boss.x, boss.y]);
    });
  }
});
