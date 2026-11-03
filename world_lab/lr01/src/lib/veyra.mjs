// MAP-LR01 shared source loader + geometry primitives.
// Reads canonical Veyra GOLD from a PINNED git object. Never writes canon.
// Every coordinate stays in the unchanged 2000x1400 authoring frame.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../../..');
export const LAB = path.resolve(HERE, '../../..');
export const sha256 = buf => createHash('sha256').update(buf).digest('hex');
export const r4 = v => (v === null || v === undefined || !Number.isFinite(v)) ? null : +v.toFixed(4);

export const CANON = Object.freeze({
  branch: 'map/veyra-gold-asset-canon-20261102',
  commit: '19d8c6ec820f324a6ac12733165e43b5e2c6eab2',
  path: 'map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json',
  bytes: 332249,
  sha256: '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256',
});
export const BASELINE = Object.freeze({
  mapBranch: 'arena/2e3cfbd2-soul-of-hero',
  startHead: '9e0f08055a93ccf6cbd4657c4fc5c128385eb90a',
  gp44Branch: 'arena/d4bfcfff-soul-of-hero',
  gp44Head: '0b2ba508cba71e48242f871e4a47c8506165dd20',
  web38Branch: 'arena/4795760e-soul-of-hero',
  web38Head: '8421b9c3335c7648488ce8ae5dab43eb5787977e',
  geo01Head: '6364c893',
  geo02Head: 'c6a900ae39fb05a83058606a80035a34021cd69d',
});

export function gitShow(spec) {
  return Buffer.from(execFileSync('git', ['show', spec], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }));
}
export function gitText(spec) { return gitShow(spec).toString('utf8'); }

export function loadVeyra() {
  const raw = gitShow(`${CANON.commit}:${CANON.path}`);
  const fp = { ...CANON, actualBytes: raw.length, actualSha256: sha256(raw), verified: false };
  if (fp.actualBytes !== CANON.bytes || fp.actualSha256 !== CANON.sha256) throw new Error('canonical Veyra fingerprint mismatch');
  fp.verified = true;
  const doc = JSON.parse(raw.toString('utf8'));
  const P = doc.project;
  if (doc.format !== 'soh-maplab' || doc.version !== 1 || !P?.terrain) throw new Error('unexpected Veyra source');
  return { raw, doc, P, fingerprint: fp };
}

const G1 = path.join(LAB, 'geo01/output');
const G2 = path.join(LAB, 'geo02/output');
function rj(p) { const b = fs.readFileSync(p); return { doc: JSON.parse(b.toString('utf8')), bytes: b.length, sha256: sha256(b) }; }
function ru(p) { const b = fs.readFileSync(p); return { data: new Uint8Array(b.buffer, b.byteOffset, b.length), bytes: b.length, sha256: sha256(b) }; }

export function loadGeoInputs() {
  const geography = rj(path.join(G1, 'geography.v1.json'));
  const corridor = rj(path.join(G1, 'corridor.v1.json'));
  const rasterManifest = rj(path.join(G1, 'rasters/manifest.v1.json'));
  const encoding = rj(path.join(G2, 'maplab_encoding.v1.json'));
  const audit = rj(path.join(G2, 'corridor_audit.v1.json'));
  const proposed = rj(path.join(G2, 'poi_po_kilns.proposed.v1.json'));
  const maplabManifest = rj(path.join(G2, 'rasters/manifest.v1.json'));
  if (geography.sha256 !== '13ae97272edc47b063bb4a2ffde5dcf9f92f0f34dc3fd35b6ab3bee7f26c29dd') throw new Error('GEO-01 geography fingerprint changed');
  if (corridor.sha256 !== 'e9212633b277ec0cd7ee932a0d9b1266532e805a2816e23e092edce3582db63e') throw new Error('GEO-01 corridor fingerprint changed');
  const r1 = {};
  for (const l of rasterManifest.doc.layers) {
    r1[l.name] = ru(path.join(G1, l.file));
    if (r1[l.name].sha256 !== l.sha256) throw new Error(`GEO-01 raster ${l.name} SHA mismatch`);
  }
  const r2 = {};
  for (const [name, meta] of Object.entries(maplabManifest.doc.files)) {
    const key = name.replace('.u8', '');
    r2[key] = ru(path.join(G2, 'rasters', name));
    if (r2[key].sha256 !== meta.sha256) throw new Error(`GEO-02 raster ${name} SHA mismatch`);
  }
  return {
    geography: geography.doc, corridor: corridor.doc, encoding: encoding.doc,
    audit: audit.doc, proposed: proposed.doc, rasterManifest: rasterManifest.doc, maplabManifest: maplabManifest.doc,
    r1, r2,
    fingerprints: {
      geography: { bytes: geography.bytes, sha256: geography.sha256 },
      corridor: { bytes: corridor.bytes, sha256: corridor.sha256 },
      rasterManifest: { bytes: rasterManifest.bytes, sha256: rasterManifest.sha256 },
      encoding: { bytes: encoding.bytes, sha256: encoding.sha256 },
      audit: { bytes: audit.bytes, sha256: audit.sha256 },
      proposed: { bytes: proposed.bytes, sha256: proposed.sha256 },
      maplabRasterManifest: { bytes: maplabManifest.bytes, sha256: maplabManifest.sha256 },
    },
  };
}

// ---------------- geometry primitives (authoring units) ----------------
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

export function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
}
export function ringSignedArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
export function ringCentroid(ring) {
  let a2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], c = p[0] * q[1] - q[0] * p[1];
    a2 += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c;
  }
  if (Math.abs(a2) < 1e-9) return [ring[0][0], ring[0][1]];
  return [cx / (3 * a2), cy / (3 * a2)];
}
export function ringPerimeter(ring, closed = true) {
  let s = 0;
  for (let i = 1; i < ring.length; i++) s += dist(ring[i - 1], ring[i]);
  if (closed && ring.length > 1) s += dist(ring[ring.length - 1], ring[0]);
  return s;
}
export function ringEdges(ring) {
  const e = [];
  for (let i = 0; i < ring.length; i++) e.push(dist(ring[i], ring[(i + 1) % ring.length]));
  return e;
}
export function pip(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function pipRings(p, rings) {
  let inside = rings[0] ? pip(p, rings[0]) : false;
  for (let i = 1; i < rings.length; i++) if (pip(p, rings[i])) inside = !inside;
  return inside;
}
export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return [x0, y0, x1, y1];
}
/** Oriented bounding box of a canonical POI foot quad. Axes follow the first edge. */
export function quadOBB(foot) {
  if (!foot || foot.length < 3) return null;
  const c = ringCentroid(foot);
  const e0 = [foot[1][0] - foot[0][0], foot[1][1] - foot[0][1]];
  const L0 = Math.hypot(e0[0], e0[1]) || 1;
  const ux = [e0[0] / L0, e0[1] / L0], uy = [-ux[1], ux[0]];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of foot) {
    const dx = p[0] - c[0], dy = p[1] - c[1];
    const u = dx * ux[0] + dy * ux[1], v = dx * uy[0] + dy * uy[1];
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  const e1 = dist(foot[2], foot[1]);
  return {
    centre: [r4(c[0]), r4(c[1])], ux: [r4(ux[0]), r4(ux[1])], uy: [r4(uy[0]), r4(uy[1])],
    wAu: r4(u1 - u0), hAu: r4(v1 - v0), angleRad: r4(Math.atan2(ux[1], ux[0])),
    edgeLengthsAu: ringEdges(foot).map(r4), quadEdge2Au: r4(e1),
  };
}
export function segInt(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const qp = [c[0] - a[0], c[1] - a[1]];
  const t = (qp[0] * s[1] - qp[1] * s[0]) / den;
  const u = (qp[0] * r[1] - qp[1] * r[0]) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { p: [a[0] + t * r[0], a[1] + t * r[1]], t, u };
}
export function nearestOnLine(pts, p, closed = false) {
  let bd = Infinity, best = null;
  const n = pts.length;
  for (let i = 1; i < n; i++) {
    const a = pts[i - 1], b = pts[i], vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)) : 0;
    const q = [a[0] + t * vx, a[1] + t * vy], d = dist(q, p);
    if (d < bd) { bd = d; best = q; }
  }
  if (closed && n > 1) {
    const a = pts[n - 1], b = pts[0], vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)) : 0;
    const q = [a[0] + t * vx, a[1] + t * vy], d = dist(q, p);
    if (d < bd) { bd = d; best = q; }
  }
  return { pt: best, d: bd };
}

export function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
export function writeJson(p, obj) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); return fs.statSync(p).size; }
