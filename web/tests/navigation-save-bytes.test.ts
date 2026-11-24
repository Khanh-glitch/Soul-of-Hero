// The navigation continuation is part of every save. Its encoder reuses the bytes of searches that did not change
// since the previous save; this file pins that the result is byte-for-byte the plain encoding, before and after
// every kind of change a search can go through, and that it still loads.
import { describe, expect, it } from 'vitest';
import type { RunState } from '../src/game/core';
import { componentFailures, failedSearches, loadNavigation, saveNavigation, searches } from '../src/game/navigation-save';

type Point = { tx: number; ty: number; floor: number };
const key = (p: Point) => `${p.floor}:${p.tx},${p.ty}`;

/** The encoder as it was before any caching: one pass, no reuse. */
function plainEncoding(r: RunState): string | undefined {
  const pending = searches.get(r), failed = failedSearches.get(r), components = componentFailures.get(r);
  if (!pending?.size && !failed?.size && !components?.length) return;
  const out: number[] = [];
  const n = (x: number) => { while (x >= 128) { out.push(128 + (x % 128)); x = Math.floor(x / 128); } out.push(x); };
  const signed = (x: number) => n(x < 0 ? -2 * x - 1 : 2 * x);
  const text = (s: string) => { const b = new TextEncoder().encode(s); n(b.length); for (const x of b) out.push(x); };
  const points = (ps: Point[]) => { n(ps.length); let x = 0, y = 0, z = 0; for (const p of ps) { signed(p.tx - x); signed(p.ty - y); signed(p.floor - z); x = p.tx; y = p.ty; z = p.floor; } };
  const toPoint = (k: string): Point => { const [floor, tx, ty] = k.split(/[:,]/).map(Number); return { tx, ty, floor }; };
  n(2); n(pending?.size ?? 0);
  for (const [id, s] of pending ?? []) {
    text(id); n(s.expanded); n(s.touched ?? 0);
    const keys = [...s.points.keys()], index = new Map(keys.map((k, i) => [k, i]));
    points([...s.points.values()]);
    for (const k of keys) { n(s.costs.get(k)!); n(s.parent.has(k) ? index.get(s.parent.get(k)!)! + 1 : 0); }
    n(s.heap.length); for (const h of s.heap) { n(index.get(key(h.p))!); n(h.g); n(h.score); }
    points([...s.blocked.values()]);
  }
  n(failed?.size ?? 0);
  for (const [id, s] of failed ?? []) { text(id); n(s.expanded); n(s.status === 'NO_PATH' ? 0 : 1); points(s.blocked); }
  n(components?.length ?? 0);
  for (const s of components ?? []) { text(s.access); n(s.expanded); points([...s.points].map(toPoint)); points(s.blocked); }
  let bin = ''; for (let i = 0; i < out.length; i += 8192) bin += String.fromCharCode(...out.slice(i, i + 8192));
  return btoa(bin);
}

let seed = 0x1234abcd;
const rnd = (m: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % m; };

/** A search that has examined `cells` cells from `start`, grown the way the planner grows one (parents precede children). */
function growSearch(s: NonNullable<ReturnType<typeof searches.get>> extends Map<string, infer P> ? P : never, cells: number) {
  const list = [...s.points.values()];
  for (let i = 0; i < cells; i++) {
    const from = list[rnd(list.length)], p = { tx: from.tx + rnd(3) - 1, ty: from.ty + rnd(3) - 1, floor: from.floor + (rnd(40) === 0 ? 1 : 0) }, k = key(p);
    s.expanded++;
    if (s.points.has(k)) { if (rnd(3) === 0) s.blocked.set(k + 'b', { tx: p.tx + 500, ty: p.ty - 500, floor: p.floor }); continue; }
    const g = s.costs.get(key(from))! + 1 + rnd(2) * 4;
    s.points.set(k, p); s.costs.set(k, g); s.parent.set(k, key(from)); list.push(p);
    s.heap.push({ p, g, score: g + rnd(200) });
    if (rnd(4) === 0) s.heap.shift();
  }
}
function world() {
  const r = {} as RunState;
  const pending = new Map(), failed = new Map(), components: any[] = [];
  for (let a = 0; a < 6; a++) {
    const start = { tx: 3000 + rnd(900), ty: 2000 + rnd(900), floor: rnd(2) }, id = `h${a}:${key(start)}>0:${start.tx + 40},${start.ty + 7}`;
    const s = { heap: [{ p: start, g: 0, score: 9 }], costs: new Map([[key(start), 0]]), parent: new Map(), points: new Map([[key(start), start]]), expanded: 0, checked: 'x', blocked: new Map(), touched: 100 + a };
    pending.set(id, s); growSearch(s, 200 + rnd(3000));
  }
  for (let a = 0; a < 5; a++) failed.set(`f${a}:0:${a},${a}>0:9,9`, { checked: 'x', status: a % 2 ? 'NO_PATH' : 'SEARCH_LIMIT', expanded: 100 + rnd(40000), blocked: Array.from({ length: rnd(200) }, () => ({ tx: rnd(9000), ty: rnd(9000), floor: rnd(3) })) });
  for (let a = 0; a < 4; a++) { const points = new Set<string>(); for (let i = 0; i < 50 + rnd(2000); i++) points.add(key({ tx: rnd(9000), ty: rnd(9000), floor: rnd(3) })); components.push({ access: `acc${a}:énergie`, checked: 'x', expanded: rnd(48000), points, blocked: Array.from({ length: rnd(300) }, () => ({ tx: rnd(9000), ty: rnd(9000), floor: rnd(3) })) }); }
  searches.set(r, pending); failedSearches.set(r, failed); componentFailures.set(r, components);
  return { r, pending, failed, components };
}

describe('navigation save bytes', () => {
  it('writes the plain encoding, on the first save and on every later one', () => {
    const { r, pending, failed, components } = world();
    const same = () => { const got = saveNavigation(r); expect(got).toBe(plainEncoding(r)); return got!; };
    const first = same();
    expect(same()).toBe(first);                                                    // nothing changed: identical bytes again
    const [idA, a] = [...pending.entries()][1];
    growSearch(a, 500); expect(same()).not.toBe(first);                           // a search advanced
    a.touched = 99999; same();                                                     // only the last-asked stamp moved
    const fresh = { heap: [] as any[], costs: new Map([['0:1,1', 0]]), parent: new Map(), points: new Map([['0:1,1', { tx: 1, ty: 1, floor: 0 }]]), expanded: 0, checked: '', blocked: new Map(), touched: 5 };
    pending.set('n:0:1,1>0:5,5', fresh); same();
    fresh.heap.push({ p: { tx: 1, ty: 1, floor: 0 }, g: 0, score: 4 }); same();    // first frontier node, expanded still 0
    pending.delete(idA); same();                                                   // a search finished or was dropped
    pending.set(idA, { ...a, points: new Map(a.points), costs: new Map(a.costs), parent: new Map(a.parent), heap: [...a.heap], blocked: new Map(a.blocked) }); same();
    failed.set('f9:0:1,2>0:3,4', { checked: '', status: 'NO_PATH', expanded: 7, blocked: [{ tx: 4, ty: -4, floor: 1 }] }); same();
    failed.delete([...failed.keys()][0]); same();
    components.shift(); components.push({ access: 'late', checked: '', expanded: 12, points: new Set(['0:5,5', '1:6,7']), blocked: [] }); same();
    for (let i = 0; i < 12; i++) { growSearch([...pending.values()][rnd(pending.size)], 1 + rnd(300)); same(); }
  });
  it('loads what it wrote, and the loaded state writes the same bytes', () => {
    const { r } = world();
    const text = saveNavigation(r)!;
    const again = {} as RunState; loadNavigation(again, text);
    expect(saveNavigation(again)).toBe(text);
    expect(saveNavigation(again)).toBe(plainEncoding(again));
  });
});
