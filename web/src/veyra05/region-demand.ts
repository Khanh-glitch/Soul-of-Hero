/**
 * Which world regions the residents of a run are about to ask the compiler for. Pure reads of run state.
 *
 * Most urgent first:
 *   1. the region under each living resident,
 *   2. the region at the far end of each route search in progress,
 *   3. neighbouring regions, nearest first, up to `NEIGHBOUR_REACH` tiles from a resident.
 *
 * Measured on new games (three seeds, four minutes each, player standing still): residents asked for about 100
 * regions of class 1 and about 50 neighbouring ones. Of the neighbouring ones a resident stood within 8 tiles of
 * 25 to 37, within 16 tiles of another 12 or 13, within 24 tiles of another 3 or 4, and farther away from 0 to 3.
 * Residents look for work and for a way round obstacles well beyond the edge of the region they stand in, also
 * while idle. Every region left out is compiled on the game thread when asked, a stall of 0.1 to 0.3 s.
 */
import type { RunState } from '../game/core';
import { WW, WH } from '../game/core';
import { searches } from '../game/navigation-save';
import { FRAME_W, FRAME_H } from './frame';
import { layoutIdAt } from './scenes';

/** A neighbouring region counts only while a resident stands this close (tiles) to it. */
const NEIGHBOUR_REACH = 24;
const originOf = (g: number, frame: number, span: number) => Math.max(0, Math.min(frame - span, Math.floor((g - 68) / 64) * 64));

/** `urgent`: classes 1 and 2 above; `nearby`: class 3, nearest first. */
export function regionsWanted(r: RunState): { urgent: string[]; nearby: string[] } {
  const people = r.humanWorld?.people; if (!people) return { urgent: [], nearby: [] };
  const first = new Set<string>(), second = new Set<string>(), near = new Map<string, number>();
  for (const id in people) {
    const h = people[id]; if (h.state === 'DEAD' || h.state === 'EVACUATED') continue;
    const ox = originOf(h.gx, FRAME_W, WW), oy = originOf(h.gy, FRAME_H, WH);
    first.add(layoutIdAt(ox, oy));
    // Each region answers for the 64 x 64 tiles starting 68 tiles inside its origin.
    const left = h.gx - (ox + 68), right = ox + 131 - h.gx, up = h.gy - (oy + 68), down = oy + 131 - h.gy;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = ox + dx * 64, ny = oy + dy * 64; if (nx < 0 || ny < 0 || nx > FRAME_W - WW || ny > FRAME_H - WH) continue;
      const d = Math.max(dx < 0 ? left + 1 : dx > 0 ? right + 1 : 0, dy < 0 ? up + 1 : dy > 0 ? down + 1 : 0);
      if (d > NEIGHBOUR_REACH) continue;
      const lid = layoutIdAt(nx, ny), known = near.get(lid);
      if (known === undefined || d < known) near.set(lid, d);
    }
  }
  for (const id of searches.get(r)?.keys() ?? []) {
    const m = /^-?\d+:(-?\d+),(-?\d+)/.exec(id.slice(id.lastIndexOf('>') + 1)); if (!m) continue;
    second.add(layoutIdAt(originOf(+m[1], FRAME_W, WW), originOf(+m[2], FRAME_H, WH)));
  }
  const urgent = [...first];
  for (const lid of second) if (!first.has(lid)) urgent.push(lid);
  const nearby: string[] = [];
  for (const [lid] of [...near].sort((a, b) => a[1] - b[1])) if (!first.has(lid) && !second.has(lid)) nearby.push(lid);
  return { urgent, nearby };
}

/** For each region: tiles from the nearest living resident to the ground it answers for (0: one stands on it;
 * Infinity: no residents, or not a region id). */
export function residentDistance(r: RunState, layoutIds: readonly string[]): number[] {
  const people = r.humanWorld?.people, at: number[] = [];
  if (people) for (const id in people) { const h = people[id]; if (h.state !== 'DEAD' && h.state !== 'EVACUATED') at.push(h.gx, h.gy); }
  return layoutIds.map(lid => {
    const m = /-at-(\d+)-(\d+)$/.exec(lid); if (!m) return Infinity;
    const x0 = +m[1] + 68, x1 = x0 + 63, y0 = +m[2] + 68, y1 = y0 + 63;
    let best = Infinity;
    for (let i = 0; i < at.length; i += 2) {
      const gx = at[i], gy = at[i + 1], d = Math.max(gx < x0 ? x0 - gx : gx > x1 ? gx - x1 : 0, gy < y0 ? y0 - gy : gy > y1 ? gy - y1 : 0);
      if (d < best) best = d;
    }
    return best;
  });
}
