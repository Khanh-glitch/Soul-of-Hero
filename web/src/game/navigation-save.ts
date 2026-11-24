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
  /** Run seconds when an actor last asked about this search (0 in saves from wire version 1). */
  touched?: number;
};
type Failed = Checked & { blocked: Point[]; status: 'NO_PATH' | 'SEARCH_LIMIT'; expanded: number };
type Component = Checked & { access: string; points: Set<string>; blocked: Point[]; expanded: number };
/** One route search stops after examining this many cells (`SEARCH_LIMIT`); a call may overshoot by its own 256.
 *  A search for an evacuation berth may go on to BERTH_SEARCH_LIMIT_CELLS (see the memory law in human-navigation.ts);
 *  the loader refuses a larger count.
 *
 *  DECISION (Creator delegation on build 98ee24ac): 96,000 stays. Measured on seed 7606: 96,000 for every route made
 *  the first hour 30-40 % slower; 400,000 let one search hold 200k-400k cells in memory and in the save, which is
 *  already near the browser's 5 MB limit. KNOWN COST: a berth whose shortest road needs more than 96,000 cells
 *  examined (the south berth is the known case) is reported SEARCH_LIMIT and those residents use another berth or
 *  stay. A larger number is not the fix; a road-graph search between regions is, and that is not built.
 *  Creator, 2026-11-24: accepted for now; the road-graph search is work for a later round. */
export const SEARCH_LIMIT_CELLS = 48_000,
  BERTH_SEARCH_LIMIT_CELLS = 96_000;
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
/** Append-only byte stream. `n` is a little-endian base-128 varint; the stream of a list of values is the plain
 * concatenation of their streams, so an unchanged search can be appended from its last encoding (see the caches below). */
class Writer {
  private buf = new Uint8Array(8192);
  private len = 0;
  /** Points written through this writer (the caller charges them to the save-wide budget). */
  pointCount = 0;
  private room(add: number) {
    check(this.len + add <= MAX_BYTES);
    if (this.len + add <= this.buf.length) return;
    const next = new Uint8Array(Math.max(this.buf.length * 2, this.len + add));
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  n(x: number) {
    check(Number.isSafeInteger(x) && x >= 0 && x <= 0x7fffffff);
    this.room(5);
    const buf = this.buf;
    while (x >= 128) {
      buf[this.len++] = 128 + (x & 127);
      x >>>= 7;
    }
    buf[this.len++] = x;
  }
  signed(x: number) {
    this.n(x < 0 ? -2 * x - 1 : 2 * x);
  }
  text(s: string) {
    const b = textEncoder.encode(s);
    check(b.length <= 2048);
    this.n(b.length);
    this.bytes(b);
  }
  bytes(b: Uint8Array) {
    this.room(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  points(ps: Iterable<Point>, count: number) {
    this.pointCount += count;
    check(count <= MAX_LIST && this.pointCount <= MAX_POINTS);
    this.n(count);
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
  /** The bytes written so far, detached from this writer. */
  take() {
    return this.buf.slice(0, this.len);
  }
  finish() {
    const parts: string[] = [];
    for (let i = 0; i < this.len; i += 8192) parts.push(String.fromCharCode(...this.buf.subarray(i, Math.min(this.len, i + 8192))));
    return btoa(parts.join(''));
  }
}
const textEncoder = new TextEncoder();
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
// ---- encodings of searches that did not change since the previous save ---------------------------------------------
// A save happens every few seconds; almost every stored search is untouched between two of them. Each cache entry is
// keyed by the object itself plus every saved field that can change, so a hit is byte-for-byte what a fresh encoding
// would produce:
//  * Pending: heap, costs, parent, points and blocked are written only inside the two expansion loops of
//    human-navigation.ts (the owner's, and `help`, which advances another resident's search), and every pass of
//    either loop increments `expanded` together with its pop. `touched` is the only saved field that moves on its
//    own, so it stays outside the cached body. The collection sizes are part of the key as well (the first frontier
//    node is pushed while `expanded` is still 0). A search emptied to a ticket, or a ticket started again, is a NEW
//    object (`emptySearch`), never a rewrite in place — the same counts on the same object always mean the same bytes.
//  * Failed and Component records are created once and only their unsaved `checked` / `resources` are rewritten.
type Encoded = { bytes: Uint8Array; points: number };
const pendingBodies = new WeakMap<Pending, Encoded & { expanded: number; sizes: string }>();
const failedBodies = new WeakMap<Failed, Encoded & { expanded: number; status: Failed['status']; blocked: Point[]; count: number }>();
const componentBodies = new WeakMap<Component, Encoded & { expanded: number; access: string; points0: Set<string>; size: number; blocked: Point[]; count: number }>();
function pendingBody(s: Pending): Encoded {
  const hit = pendingBodies.get(s),
    sizes = `${s.points.size}/${s.costs.size}/${s.parent.size}/${s.heap.length}/${s.blocked.size}`;
  if (hit && hit.expanded === s.expanded && hit.sizes === sizes) return hit;
  const w = new Writer();
  const index = new Map<string, number>();
  let i = 0;
  for (const k of s.points.keys()) index.set(k, i++);
  w.points(s.points.values(), s.points.size);
  for (const k of s.points.keys()) {
    w.n(s.costs.get(k)!);
    const parent = s.parent.get(k);
    w.n(parent !== undefined ? index.get(parent)! + 1 : 0);
  }
  check(s.heap.length <= MAX_LIST);
  w.n(s.heap.length);
  for (const n of s.heap) {
    w.n(index.get(key(n.p))!);
    w.n(n.g);
    w.n(n.score);
  }
  w.points(s.blocked.values(), s.blocked.size);
  const made = { bytes: w.take(), points: w.pointCount, expanded: s.expanded, sizes };
  pendingBodies.set(s, made);
  return made;
}
function failedBody(s: Failed): Encoded {
  const hit = failedBodies.get(s);
  if (hit && hit.expanded === s.expanded && hit.status === s.status && hit.blocked === s.blocked && hit.count === s.blocked.length) return hit;
  const w = new Writer();
  w.n(s.expanded);
  w.n(s.status === 'NO_PATH' ? 0 : 1);
  w.points(s.blocked, s.blocked.length);
  const made = { bytes: w.take(), points: w.pointCount, expanded: s.expanded, status: s.status, blocked: s.blocked, count: s.blocked.length };
  failedBodies.set(s, made);
  return made;
}
function componentBody(s: Component): Encoded {
  const hit = componentBodies.get(s);
  if (hit && hit.expanded === s.expanded && hit.access === s.access && hit.points0 === s.points && hit.size === s.points.size && hit.blocked === s.blocked && hit.count === s.blocked.length) return hit;
  const w = new Writer();
  w.text(s.access);
  w.n(s.expanded);
  w.points([...s.points].map(toPoint), s.points.size);
  w.points(s.blocked, s.blocked.length);
  const made = { bytes: w.take(), points: w.pointCount, expanded: s.expanded, access: s.access, points0: s.points, size: s.points.size, blocked: s.blocked, count: s.blocked.length };
  componentBodies.set(s, made);
  return made;
}
export function saveNavigation(r: RunState): string | undefined {
  const pending = searches.get(r),
    failed = failedSearches.get(r),
    components = componentFailures.get(r);
  if (!pending?.size && !failed?.size && !components?.length) return;
  const w = new Writer();
  let pointBudget = MAX_POINTS;
  const append = (e: Encoded) => {
    pointBudget -= e.points;
    check(pointBudget >= 0);
    w.bytes(e.bytes);
  };
  w.n(2);
  w.n(pending?.size ?? 0);
  for (const [id, s] of pending ?? []) {
    w.text(id);
    w.n(s.expanded);
    w.n(s.touched ?? 0);
    append(pendingBody(s));
  }
  w.n(failed?.size ?? 0);
  for (const [id, s] of failed ?? []) {
    w.text(id);
    append(failedBody(s));
  }
  w.n(components?.length ?? 0);
  for (const s of components ?? []) append(componentBody(s));
  return w.finish();
}
export function loadNavigation(r: RunState, encoded: unknown) {
  check(typeof encoded === 'string' && encoded.length > 0 && encoded.length <= (MAX_BYTES * 4) / 3);
  const b = new Reader(atob(encoded));
  const version = b.n();
  check(version === 1 || version === 2);
  const pending = new Map<string, Pending>(),
    failed = new Map<string, Failed>(),
    components: Component[] = [];
  // Physical/resource signatures intentionally start invalid: freshly check the
  // observed boundary on next use. A restored route still cannot enter a wall.
  for (let count = b.n(512); count; count--) {
    const id = b.text(),
      expanded = b.n(BERTH_SEARCH_LIMIT_CELLS + 256),
      touched = version >= 2 ? b.n() : 0,
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
    pending.set(id, { expanded, points, costs, parent, heap, blocked, checked: '', touched });
  }
  for (let n = b.n(512); n; n--) {
    const id = b.text(),
      expanded = b.n(BERTH_SEARCH_LIMIT_CELLS + 256),
      status = b.n(1) === 0 ? 'NO_PATH' : 'SEARCH_LIMIT';
    check(!failed.has(id));
    failed.set(id, { expanded, status, blocked: b.points(), checked: '' });
  }
  for (let n = b.n(64); n; n--) {
    const access = b.text(),
      expanded = b.n(BERTH_SEARCH_LIMIT_CELLS + 256),
      points = new Set(b.points().map(key));
    components.push({ access, expanded, points, blocked: b.points(), checked: '' });
  }
  check(b.i === b.bytes.length);
  searches.set(r, pending);
  failedSearches.set(r, failed);
  componentFailures.set(r, components);
}
