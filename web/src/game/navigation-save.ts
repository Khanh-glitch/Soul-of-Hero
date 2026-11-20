/** The bounded A* budget makes frontier order and exhausted-component proofs
 * observable on the next simulation slice. Save these, not the terrain read
 * caches. Point deltas and local parent indices avoid serializing entire Maps
 * of repeated coordinate strings. No compression library / async save step. */
import type { RunState } from './core';
import type { HumanWaypoint as Point } from './human-navigation';
const key = (p: Point) => `${p.floor}:${p.tx},${p.ty}`;
type Node = { p: Point; g: number; score: number };
type Checked = { checked: string; resources?: string };
type Pending = Checked & {
  heap: Node[];
  costs: Map<string, number>;
  parent: Map<string, string>;
  points: Map<string, Point>;
  expanded: number;
  blocked: Map<string, Point>;
};
type Failed = Checked & { blocked: Point[]; status: 'NO_PATH' | 'SEARCH_LIMIT'; expanded: number };
type Component = Checked & { access: string; points: Set<string>; blocked: Point[]; expanded: number };
export const searches = new WeakMap<RunState, Map<string, Pending>>();
export const failedSearches = new WeakMap<RunState, Map<string, Failed>>();
export const componentFailures = new WeakMap<RunState, Component[]>();

function check(ok: unknown): asserts ok {
  if (!ok) throw Error('Invalid navigation continuation');
}
// Cache counts and per-search expansions are already capped by the planner.
// Also bound total codec allocation on both sides of the wire.
const MAX_POINTS = 4_000_000,
  MAX_BYTES = 48 * 1024 * 1024,
  MAX_LIST = 300_000;
class Writer {
  private chunk = new Uint8Array(8192);
  private cursor = 0;
  private parts: string[] = [];
  private pointBudget = MAX_POINTS;
  private byte(x: number) {
    if (this.cursor === this.chunk.length) {
      this.parts.push(String.fromCharCode(...this.chunk));
      check(this.parts.length * this.chunk.length < MAX_BYTES);
      this.cursor = 0;
    }
    this.chunk[this.cursor++] = x;
  }
  n(x: number) {
    check(Number.isSafeInteger(x) && x >= 0 && x <= 0x7fffffff);
    while (x >= 128) {
      this.byte(128 + (x % 128));
      x = Math.floor(x / 128);
    }
    this.byte(x);
  }
  signed(x: number) {
    this.n(x < 0 ? -2 * x - 1 : 2 * x);
  }
  text(s: string) {
    const b = new TextEncoder().encode(s);
    check(b.length <= 2048);
    this.n(b.length);
    for (const x of b) this.byte(x);
  }
  points(ps: Point[]) {
    this.pointBudget -= ps.length;
    check(ps.length <= MAX_LIST && this.pointBudget >= 0);
    this.n(ps.length);
    let x = 0,
      y = 0,
      z = 0;
    for (const p of ps) {
      this.signed(p.tx - x);
      this.signed(p.ty - y);
      this.signed(p.floor - z);
      x = p.tx;
      y = p.ty;
      z = p.floor;
    }
  }
  finish() {
    this.parts.push(String.fromCharCode(...this.chunk.subarray(0, this.cursor)));
    return btoa(this.parts.join(''));
  }
}
class Reader {
  i = 0;
  private pointBudget = MAX_POINTS;
  constructor(readonly bytes: string) {}
  n(max = 0x7fffffff) {
    let x = 0;
    for (let k = 0; k <= 28; k += 7) {
      check(this.i < this.bytes.length);
      const b = this.bytes.charCodeAt(this.i++);
      x += (b % 128) * 2 ** k;
      if (b < 128) {
        check(x <= max);
        return x;
      }
    }
    throw Error('Invalid navigation integer');
  }
  signed() {
    const x = this.n();
    return x % 2 ? -(x + 1) / 2 : x / 2;
  }
  text() {
    const n = this.n(2048);
    check(this.i + n <= this.bytes.length);
    const v = this.bytes.slice(this.i, this.i + n);
    this.i += n;
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(v, (c) => c.charCodeAt(0)));
  }
  points() {
    const ps: Point[] = [];
    let tx = 0,
      ty = 0,
      floor = 0;
    const count = this.n(MAX_LIST);
    this.pointBudget -= count;
    check(this.pointBudget >= 0);
    for (let n = count; n; n--) {
      tx += this.signed();
      ty += this.signed();
      floor += this.signed();
      check(Math.abs(tx) < 100000 && Math.abs(ty) < 100000 && Math.abs(floor) < 1000);
      ps.push({ tx, ty, floor });
    }
    return ps;
  }
}
const toPoint = (k: string): Point => {
  const [floor, tx, ty] = k.split(/[:,]/).map(Number);
  return { tx, ty, floor };
};
export function saveNavigation(r: RunState): string | undefined {
  const pending = searches.get(r),
    failed = failedSearches.get(r),
    components = componentFailures.get(r);
  if (!pending?.size && !failed?.size && !components?.length) return;
  const w = new Writer();
  w.n(1);
  w.n(pending?.size ?? 0);
  for (const [id, s] of pending ?? []) {
    w.text(id);
    w.n(s.expanded);
    const keys = [...s.points.keys()],
      index = new Map(keys.map((k, i) => [k, i]));
    w.points([...s.points.values()]);
    for (const k of keys) {
      w.n(s.costs.get(k)!);
      w.n(s.parent.has(k) ? index.get(s.parent.get(k)!)! + 1 : 0);
    }
    check(s.heap.length <= MAX_LIST);
    w.n(s.heap.length);
    for (const n of s.heap) {
      w.n(index.get(key(n.p))!);
      w.n(n.g);
      w.n(n.score);
    }
    w.points([...s.blocked.values()]);
  }
  w.n(failed?.size ?? 0);
  for (const [id, s] of failed ?? []) {
    w.text(id);
    w.n(s.expanded);
    w.n(s.status === 'NO_PATH' ? 0 : 1);
    w.points(s.blocked);
  }
  w.n(components?.length ?? 0);
  for (const s of components ?? []) {
    w.text(s.access);
    w.n(s.expanded);
    w.points([...s.points].map(toPoint));
    w.points(s.blocked);
  }
  return w.finish();
}
export function loadNavigation(r: RunState, encoded: unknown) {
  check(typeof encoded === 'string' && encoded.length > 0 && encoded.length <= (MAX_BYTES * 4) / 3);
  const b = new Reader(atob(encoded));
  check(b.n() === 1);
  const pending = new Map<string, Pending>(),
    failed = new Map<string, Failed>(),
    components: Component[] = [];
  // Physical/resource signatures intentionally start invalid: freshly check the
  // observed boundary on next use. A restored route still cannot enter a wall.
  for (let count = b.n(512); count; count--) {
    const id = b.text(),
      expanded = b.n(48256),
      ps = b.points(),
      keys = ps.map(key),
      points = new Map(ps.map((p, i) => [keys[i], p]));
    check(
      ps.length &&
        points.size === ps.length &&
        !pending.has(id) &&
        id.slice(0, id.lastIndexOf('>')).endsWith(':' + keys[0]),
    );
    const costs = new Map<string, number>(),
      parent = new Map<string, string>();
    for (let i = 0; i < ps.length; i++) {
      const g = b.n(),
        pi = b.n(ps.length);
      check(i === 0 ? pi === 0 && g === 0 : pi !== 0 && g > 0);
      costs.set(keys[i], g);
      if (pi) parent.set(keys[i], keys[pi - 1]);
    }
    for (const [k, p] of parent) check(costs.get(p)! < costs.get(k)!); // No cyclic or disconnected parent chains.
    const heap: Node[] = [];
    for (let n = b.n(MAX_LIST); n; n--) heap.push({ p: ps[b.n(ps.length - 1)], g: b.n(), score: b.n() });
    const blocked = new Map(b.points().map((p) => [key(p), p]));
    pending.set(id, { expanded, points, costs, parent, heap, blocked, checked: '' });
  }
  for (let n = b.n(512); n; n--) {
    const id = b.text(),
      expanded = b.n(48256),
      status = b.n(1) === 0 ? 'NO_PATH' : 'SEARCH_LIMIT';
    check(!failed.has(id));
    failed.set(id, { expanded, status, blocked: b.points(), checked: '' });
  }
  for (let n = b.n(64); n; n--) {
    const access = b.text(),
      expanded = b.n(48256),
      points = new Set(b.points().map(key));
    components.push({ access, expanded, points, blocked: b.points(), checked: '' });
  }
  check(b.i === b.bytes.length);
  searches.set(r, pending);
  failedSearches.set(r, failed);
  componentFailures.set(r, components);
}
