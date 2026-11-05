#!/usr/bin/env node
/**
 * BUILD-TIME adapter. api/current.mjs imports node:fs and cannot be loaded in a
 * browser. This compiles the ACTIVE WMP-04R1 authority + WMP-03 physical overlays
 * + authored GOLD geometry into one browser-safe TypeScript module.
 *
 * Authority is asserted, never substituted:
 *   CURRENT_WORLD_MASTER.activeRevision === WMP-04R1
 *   activeManifest === v4/r1/manifest.r1.json
 *   biomeEffective.r1.u8 / coldTransition.r1.u8 / marineRegion.v4.u8 sha256 recorded
 *   all rasters are exactly 250*175 = 43,750 bytes (8 AU analytical cells)
 * GOLD polygons/centrelines are AUTHORING GEOMETRY in a 2,000x1,400 AU frame.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const PILOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MD = path.join(PILOT, 'map-data');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const b64 = b => b.toString('base64');

const master = JSON.parse(fs.readFileSync(path.join(MD, 'CURRENT_WORLD_MASTER.json'), 'utf8'));
if (master.activeRevision !== 'WMP-04R1') throw Error('LW01_NOT_ACTIVE_REVISION ' + master.activeRevision);
if (master.activeManifest !== 'v4/r1/manifest.r1.json') throw Error('LW01_WRONG_MANIFEST ' + master.activeManifest);
const r1 = JSON.parse(fs.readFileSync(path.join(MD, 'manifest.r1.json'), 'utf8'));
const v4 = JSON.parse(fs.readFileSync(path.join(MD, 'manifest.v4.json'), 'utf8'));
const v3 = JSON.parse(fs.readFileSync(path.join(MD, 'manifest.v3.json'), 'utf8'));

const W = 250, H = 175, CELL_AU = 8, FRAME_W = 2000, FRAME_H = 1400;
const RASTERS = {
  biomeEffective: 'biomeEffective.r1.u8',
  coldTransition: 'coldTransition.r1.u8',
  marineRegion: 'marineRegion.v4.u8',
  biomeCode: 'biomeCode.u8',
  landId: 'landId.u8',
  waterClass: 'waterClass.u8',
  elevation: 'elevation.u8',
  slope: 'slope.u8',
  cliffCandidate: 'cliffCandidate.v3.u8',
  heightClass: 'heightClass.v3.u8',
  coast: 'coast.u8',
  roadClass: 'roadClass.u8',
  freshwater: 'freshwater.u8',
  walkableCandidate: 'walkableCandidate.u8',
  cargoCandidate: 'cargoCandidate.u8',
  buildableCandidate: 'buildableCandidate.u8',
  clearanceCells: 'clearanceCells.u8',
  activeCollisionPermission: 'activeCollisionPermission.v3.u8',
  roadSurface: 'roadSurface.v3.u8',
  waterTraversalClass: 'waterTraversalClass.v3.u8',
  zoneId: 'zoneId.u8',
};
const digests = {}, payloads = {};
for (const [k, f] of Object.entries(RASTERS)) {
  const b = fs.readFileSync(path.join(MD, f));
  if (b.length !== W * H) throw Error(`LW01_BAD_RASTER ${f} ${b.length}`);
  digests[k] = sha(b); payloads[k] = b64(b);
}
// Exact manifest digests (git blob sha1) are preserved for independent custody.
const goldRaw = JSON.parse(fs.readFileSync(path.join(MD, 'VEYRA_GOLD_MAP.sohmap.json'), 'utf8'));
const P = goldRaw.project;
if (P.world.w !== FRAME_W || P.world.h !== FRAME_H) throw Error('LW01_GOLD_FRAME_MISMATCH');
const r2 = n => Math.round(n * 100) / 100;
const compactRing = ring => ring.map(([x, y]) => [r2(x), r2(y)]);
const gold = {
  frame: { wAu: P.world.w, hAu: P.world.h, source: 'VEYRA_GOLD_MAP.sohmap.json :: project', status: P.meta.status },
  land: P.land.map(l => ({ id: l.id, name: l.name, kind: l.kind, rings: (l.rings || []).map(compactRing) })),
  lakes: P.lakes.map(l => ({ id: l.id, name: l.name, ring: compactRing(l.ring) })),
  rivers: P.rivers.map(r => ({ id: r.id, name: r.name, points: r.points.map(([x, y]) => [r2(x), r2(y)]), width: r.width, nav: r.nav || [] })),
  roads: P.roads.map(r => ({ id: r.id, name: r.name, kind: r.kind, points: r.points.map(([x, y]) => [r2(x), r2(y)]) })),
  bridges: P.bridges.map(b => ({ id: b.id, name: b.name, at: [r2(b.at[0]), r2(b.at[1])], load: b.load })),
  docks: P.docks.map(d => ({ id: d.id, name: d.name, at: [r2(d.at[0]), r2(d.at[1])], kind: d.kind })),
  pois: P.pois.map(p => ({ id: p.id, name: p.name, at: [r2(p.at[0]), r2(p.at[1])], arche: p.arche, foot: (p.foot || []).map(([x, y]) => [r2(x), r2(y)]), depth: p.depth, role: p.role })),
  zones: P.zones.map(z => ({ id: z.id, name: z.name, ring: compactRing(z.ring), soil: z.soil })),
  resources: P.resources.map(r => ({ id: r.id, name: r.name, at: [r2(r.at[0]), r2(r.at[1])], kind: r.kind, r: r.r, dens: r.dens })),
  spawns: P.spawns.map(s => ({ id: s.id, name: s.name, at: s.at })),
  elders: P.elders.map(e => ({ id: e.id, name: e.name, outer: compactRing(e.outer) })),
  labels: P.labels.map(l => ({ id: l.id, text: l.text, at: l.at, size: l.size, style: l.style })),
};
const sites = JSON.parse(fs.readFileSync(path.join(MD, 'marine_sites.v4.json'), 'utf8'));
const nav = JSON.parse(fs.readFileSync(path.join(MD, 'marine_navigation.v4.json'), 'utf8'));
const design = JSON.parse(fs.readFileSync(path.join(MD, 'geography_design.r1.json'), 'utf8'));

const meta = {
  schema: 'soh.lw01.browser_sources.v1',
  activeRevision: master.activeRevision,
  activeManifest: master.activeManifest,
  basePhysicalRevision: master.basePhysicalRevision,
  mapHead: 'f0c2182bd2ec5e067f5c59cf3985dcf71856cdb1',
  gameplayHead: 'e11a9b4471a0832cd6d039b5510725b10ee0275c',
  goldFrameAu: [FRAME_W, FRAME_H],
  analysisGrid: { w: W, h: H, cellAu: CELL_AU, cells: W * H },
  runtimeTilesAu: CELL_AU + ' AU analysis cell !== U=1 1 AU runtime tile',
  rasters: Object.fromEntries(Object.entries(RASTERS).map(([k, f]) => [k, { file: f, bytes: W * H, sha256: digests[k], base64: payloads[k] }])),
  manifestDigests: {
    r1: sha(fs.readFileSync(path.join(MD, 'manifest.r1.json'))),
    v4: sha(fs.readFileSync(path.join(MD, 'manifest.v4.json'))),
    v3: sha(fs.readFileSync(path.join(MD, 'manifest.v3.json'))),
    master: sha(fs.readFileSync(path.join(MD, 'CURRENT_WORLD_MASTER.json'))),
    gold: sha(fs.readFileSync(path.join(MD, 'VEYRA_GOLD_MAP.sohmap.json'))),
  },
  r1Outputs: r1.outputs, r1Observed: r1.observed,
  v4Observed: v4.observed || null, v3Observed: v3.observed || null,
  goldCounts: { land: gold.land.length, lakes: gold.lakes.length, rivers: gold.rivers.length, roads: gold.roads.length, bridges: gold.bridges.length, docks: gold.docks.length, pois: gold.pois.length, zones: gold.zones.length, resources: gold.resources.length, spawns: gold.spawns.length, elders: gold.elders.length },
  gold,
  marineSites: sites, marineNavigation: nav, geographyDesign: design,
  policy: [
    'WMP-04R1 active biome; WMP-03 physical overlays; WMP-04 unchanged ocean semantics.',
    'GOLD polygons/centrelines are sampled at runtime tile centres, NOT nearest-neighbour 8 AU upscaling.',
    'walkable/cargo/buildable/road/water rasters are CANDIDATE layers only; Gameplay permission is NOT granted.',
    'footOnSea=FORBIDDEN; no boat/swim/ferry foot permission; no damage or temperature rate.',
    'No final U is approved. U=1 primary candidate, U=2 prior diagnostic, U=0.5 bounded Beacon-only.',
  ],
};

const ts = `// GENERATED by tools/build-sources.mjs — DO NOT EDIT.\n// Browser-safe: base64 + atob + @noble/hashes/sha256. No node:fs, no network.\n` +
  `export const LW_SOURCES = ${JSON.stringify(meta)} as const;\n` +
  `export type LwSources = typeof LW_SOURCES;\n` +
  `export const LW_RASTER_NAMES = ${JSON.stringify(Object.keys(RASTERS))} as const;\n`;
fs.writeFileSync(path.join(PILOT, 'web-large/src/game/large/sources.generated.ts'), ts);
fs.writeFileSync(path.join(PILOT, 'map-data/GENERATED_META.json'), JSON.stringify({ ...meta, rasters: Object.fromEntries(Object.entries(RASTERS).map(([k, f]) => [k, { file: f, bytes: W * H, sha256: digests[k] }])) }, null, 2) + '\n');
console.log(`LW01_BUILD_SOURCES_OK revision=${master.activeRevision} rasters=${Object.keys(RASTERS).length} digests=${Object.keys(digests).length} goldLand=${gold.land.length} goldPois=${gold.pois.length} goldRoads=${gold.roads.length} moduleBytes=${ts.length}`);
