// WMP-01 shared primitives. CLEAN-ROOM SAFE: reads ONLY from data/, never GOLD.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const MASTER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = path.join(MASTER, 'data');
export const LAYERS = path.join(MASTER, 'layers');
export const DERIVED = path.join(MASTER, 'rasters');
export const EVIDENCE = path.join(MASTER, 'evidence');
export const DOCS = path.join(MASTER, 'docs');

export const GW = 250, GH = 175, CELL = 8, N = GW * GH;
export const FRAME_AU = [2000, 1400];
export const CHUNK_CELLS = 25, CHUNK_AU = CHUNK_CELLS * CELL, CHUNKS_X = Math.ceil(GW / CHUNK_CELLS), CHUNKS_Y = Math.ceil(GH / CHUNK_CELLS);

export const sha256 = b => createHash('sha256').update(b).digest('hex');
export const digest = o => sha256(Buffer.from(JSON.stringify(o)));
export const r4 = v => (v === null || v === undefined || !Number.isFinite(v)) ? null : +v.toFixed(4);
export const idx = (gx, gy) => gy * GW + gx;
export const gxOf = i => i % GW, gyOf = i => Math.floor(i / GW);
export const centreAu = i => [(gxOf(i) + 0.5) * CELL, (gyOf(i) + 0.5) * CELL];
export const toCell = (x, y) => idx(Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), Math.max(0, Math.min(GH - 1, Math.floor(y / CELL))));
export const inFrame = (x, y) => x >= 0 && x < FRAME_AU[0] && y >= 0 && y < FRAME_AU[1];

export function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(MASTER, rel), 'utf8')); }
export function readBuf(rel) { return fs.readFileSync(path.join(MASTER, rel)); }
export function writeJson(rel, obj) {
  const p = path.join(MASTER, rel); fs.mkdirSync(path.dirname(p), { recursive: true });
  const b = Buffer.from(JSON.stringify(obj, null, 2) + '\n'); fs.writeFileSync(p, b);
  return { file: rel, bytes: b.length, sha256: sha256(b) };
}
export function writeU8(rel, arr) {
  const p = path.join(MASTER, rel); fs.mkdirSync(path.dirname(p), { recursive: true });
  const b = Buffer.from(arr); if (b.length !== N) throw new Error(`WRITE_U8_BAD_LENGTH ${rel} ${b.length}`);
  fs.writeFileSync(p, b);
  return { file: rel, bytes: b.length, sha256: sha256(b), dtype: 'u8', grid: { gw: GW, gh: GH, cellAu: CELL, order: 'row_major i=gy*250+gx' } };
}
export function readU8(rel) {
  const b = fs.readFileSync(path.join(MASTER, rel));
  if (b.length !== N) throw new Error(`READ_U8_BAD_LENGTH ${rel} ${b.length}`);
  return new Uint8Array(b.buffer, b.byteOffset, b.length);
}
export function loadRasters() {
  const man = readJson('data/source_manifest.v1.json');
  const r = {};
  for (const l of man.rasterLayers) {
    const a = readU8(l.file);
    if (sha256(Buffer.from(a)) !== l.sha256) throw new Error(`SOURCE_RASTER_DIGEST_MISMATCH ${l.name}`);
    r[l.name] = a;
  }
  return r;
}
/** Load all compiler-produced u8 rasters and verify them against the master manifest. */
export function loadDerivedRasters() {
  const m = readJson('manifest.v1.json');
  const r = {};
  for (const c of m.components) {
    if (c.kind !== 'derived_raster') continue;
    const name = path.basename(c.file, '.u8');
    const a = readU8(c.file);
    if (sha256(Buffer.from(a)) !== c.sha256) throw new Error(`DERIVED_RASTER_DIGEST_MISMATCH ${name}`);
    r[name] = a;
  }
  return r;
}

// ---------------- geometry primitives (authoring units) ----------------
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function pointInRings(p, rings) { return !!rings?.length && pointInRing(p, rings[0]) && !rings.slice(1).some(h => pointInRing(p, h)); }
export function ringSignedArea(ring) {
  let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
export function ringArea(ring) { return Math.abs(ringSignedArea(ring)); }
export function ringCentroid(ring) {
  let a2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length], c = p[0] * q[1] - q[0] * p[1]; a2 += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; }
  if (Math.abs(a2) < 1e-9) return [ring[0][0], ring[0][1]];
  return [cx / (3 * a2), cy / (3 * a2)];
}
export function ringPerimeter(ring) { let s = 0; for (let i = 1; i < ring.length; i++) s += dist(ring[i - 1], ring[i]); if (ring.length > 1) s += dist(ring[ring.length - 1], ring[0]); return s; }
export function bbox(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return [r4(x0), r4(y0), r4(x1), r4(y1)];
}
export function scaleRingAbout(ring, c, f) { return ring.map(p => [r4(c[0] + (p[0] - c[0]) * f), r4(c[1] + (p[1] - c[1]) * f)]); }
export function polylineLength(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); return r4(s); }
export function nearestOnPolyline(p, pts) {
  let best = { d: Infinity, at: null, segment: -1, t: 0 };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)) : 0;
    const q = [a[0] + t * vx, a[1] + t * vy], d = dist(p, q);
    if (d < best.d) best = { d: r4(d), at: q.map(r4), segment: i - 1, t: r4(t) };
  }
  return best;
}
export function distPointSegment(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)) : 0;
  return dist(p, [a[0] + t * vx, a[1] + t * vy]);
}
/** Does the segment p-q intersect the thick wall segment a-b (half-thickness h)? */
export function segmentHitsWall(p, q, a, b, h) {
  const steps = Math.max(2, Math.ceil(dist(p, q) / 1));
  for (let k = 0; k <= steps; k++) { const t = k / steps, s = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; if (distPointSegment(s, a, b) <= h) return true; }
  return false;
}
export const roundTrip = (x, U) => r4((Math.floor(x / U) + 0.5) * U);

export const STATUS = Object.freeze({
  SOURCE_AUTHORED: 'SOURCE_AUTHORED', DERIVED: 'DERIVED', PROPOSED: 'PROPOSED',
  VERIFIED: 'VERIFIED', UNKNOWN: 'UNKNOWN', UNRESOLVED: 'UNRESOLVED',
  BLOCKED: 'BLOCKED', INVALID: 'INVALID', UNDECIDED: 'UNDECIDED',
});
export const authority = 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT';
