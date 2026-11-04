// MAP-LR02 shared loader / constants. LR01 is NEVER overwritten: it is pinned
// by its exact revisionDigest and consumed as the parent revision.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadVeyra, loadGeoInputs, readJson as rj, writeJson as wj, sha256 as sh, r4 as rr } from '../../../lr01/src/lib/veyra.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../../..');
export const LR01 = path.resolve(HERE, '../../../lr01');
export const LR02 = path.resolve(HERE, '../..');
export const OUT = process.env.LR02_OUT ? path.resolve(process.env.LR02_OUT) : path.join(LR02, 'output');
export const sha256 = b => createHash('sha256').update(b).digest('hex');
export const r4 = rr;
export const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export function writeJson(p, obj) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); return fs.statSync(p).size; }
export const digestBody = body => sha256(Buffer.from(JSON.stringify(body)));

export const CONST = Object.freeze({
  mapBranch: 'arena/2e3cfbd2-soul-of-hero',
  initialHead: '74062a5baf2731451fad9638c4243c7459ce8e24',
  lr01Package: 'world_lab/lr01/output/geography_package.v1.json',
  lr01Digest: 'e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63',
  gp44Branch: 'arena/d4bfcfff-soul-of-hero',
  gp44Head: 'f8010ec973095c88f3c462a68116c169b61237a3',
  jointReviewComment: 6619478477,
  mapAckComment: 6619637224,
  canonCommit: '19d8c6ec820f324a6ac12733165e43b5e2c6eab2',
  frame: { w: 2000, h: 1400, unit: 'authoring_unit' },
  sourceGrid: { gw: 250, gh: 175, cell: 8, cells: 43750 },
  diagnosticU: [1.6, 2],
  tilePx: 16,
  playerProxyPx: [8, 10], // PR44 collision proxies -> 0.5 / 0.625 runtime tiles
});

export function loadLr01() {
  const pkg = readJson(path.join(LR01, 'output/geography_package.v1.json'));
  const recomputed = digestBody(pkg.body);
  if (recomputed !== CONST.lr01Digest || pkg.revisionDigest !== CONST.lr01Digest) throw new Error('LR01 parent digest mismatch');
  const layouts = readJson(path.join(LR01, 'output/poi_layouts.v1.json'));
  const geography = readJson(path.join(LR01, 'output/geography.v1.json'));
  const transport = readJson(path.join(LR01, 'output/transport.v1.json'));
  return { pkg, layouts, geography, transport, digest: recomputed };
}

export function loadSources() {
  const V = loadVeyra();
  const GEO = loadGeoInputs();
  const I = {};
  for (const [k, v] of Object.entries(GEO.r1)) I[k] = v.data;
  return { V, GEO, I, P: V.P };
}

export function sourceHeader(extra = {}) {
  return {
    parent: {
      schema: 'soh.map.lr01.geography_package.v1', revision: 1,
      file: CONST.lr01Package, revisionDigest: CONST.lr01Digest,
      mapBranchHeadAtParent: CONST.initialHead,
    },
    canon: { commit: CONST.canonCommit, file: 'map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json', sha256: '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256' },
    frame: { authoring: CONST.frame, sourceGrid: CONST.sourceGrid, transform: { status: 'UNDECIDED', mode: 'NONE_APPLIED', fullFrameRetained: true, note: 'No rescale/crop/warp; runtime U=1.6 and U=2 are DIAGNOSTIC PROJECTIONS only.' } },
    gp44: { branch: CONST.gp44Branch, head: CONST.gp44Head, jointReview: CONST.jointReviewComment, mapAck: CONST.mapAckComment, state: 'OPEN / DRAFT / HOLD' },
    ...extra,
  };
}

// --- small geometry helpers ---
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const norm = v => { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; };
export const perp = v => [-v[1], v[0]];
export const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export function distPointSegment(p, a, b) {
  const v = sub(b, a), L2 = dot(v, v);
  const t = L2 ? Math.max(0, Math.min(1, dot(sub(p, a), v) / L2)) : 0;
  return { d: dist(p, lerp2(a, b, t)), t: t * Math.sqrt(L2) };
}
export function projectOnWall(p, a, b) {
  const v = sub(b, a), L = Math.hypot(v[0], v[1]) || 1, u = [v[0] / L, v[1] / L];
  const raw = dot(sub(p, a), u), t = Math.max(0, Math.min(L, raw));
  return { t, L, u, pt: [a[0] + u[0] * t, a[1] + u[1] * t], off: dist(p, [a[0] + u[0] * raw, a[1] + u[1] * raw]) };
}
