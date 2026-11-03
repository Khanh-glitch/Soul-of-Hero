#!/usr/bin/env node
// MAP-GEO-01 milestone A: executable, deterministic Veyra source verification.
// It READS the pinned canonical .sohmap.json, decodes it, and reports measured
// facts. It does not create, move or reinterpret any authored object.
import fs from 'node:fs';
import path from 'node:path';
import { loadSource } from './lib/source.mjs';
import { buildLayers, decodeLayer } from './lib/raster.mjs';
import { buildRouteGraph } from './lib/routegraph.mjs';
import { landTopology, waterConnectivity, transportTopology, poiSpatial, elderTerritories, confidenceRegister } from './lib/topology.mjs';
import { parseArgs, ensureOut, writeJson, DEFAULT_OUT } from './lib/cli.mjs';
import { pointInClosedRing, ringArea } from './lib/geometry.mjs';

function main() {
  const args = parseArgs();
  const out = ensureOut(args.out ? path.resolve(args.out) : DEFAULT_OUT);
  const source = loadSource({ sourcePath: args.source || null });
  const P = source.project, fp = source.fingerprint;
  const { grid, layers } = buildLayers(P);
  const graph = buildRouteGraph(P, { joinToleranceAu: 8 });
  const land = landTopology(P, layers, grid);
  const water = waterConnectivity(P, layers, grid);
  const transport = transportTopology(P, graph);
  const pois = poiSpatial(P, layers, grid);
  const elders = elderTerritories(P);
  const conf = confidenceRegister(P);
  const checks = [];
  const add = (id, requirement, ok, measured, note = null) => checks.push({ id, requirement, status: ok ? 'PASS' : 'FAIL', measured, ...(note ? { note } : {}) });

  add('SRC-01', 'pinned canonical source fingerprint', fp.sha256.length === 64 && fp.bytes === 332249 && fp.commit === '19d8c6ec820f324a6ac12733165e43b5e2c6eab2',
    { ...fp, note: 'sha256/bytes/commit/branch/path all recorded' });
  add('SRC-02', 'source remains PAPER-only design, not native production', /PAPER ONLY/.test(fp.metaStatus || ''), { metaStatus: fp.metaStatus });

  // --- landmasses and coastline topology
  const landIds = P.land.map(l => l.id);
  add('GEO-01', '8 landmasses with preserved ids and coastline topology', P.land.length === 8 && new Set(landIds).size === 8 && P.land.every(l => l.rings?.length >= 1),
    { count: P.land.length, ids: landIds, kinds: P.land.map(l => l.kind), rings: P.land.map(l => l.rings.length), holeCount: land.landmasses.map(l => l.holeCount),
      outerVertexCount: land.landmasses.map(l => l.outerVertexCount), coastline: land.coastline,
      areasAu2: land.landmasses.map(l => l.areaAu2), perimetersAu: land.landmasses.map(l => l.perimeterAu),
      derivedCoastCells: land.landmasses.map(l => l.derivedCoastCells) });
  add('GEO-02', 'coastline is a measurable closed boundary, not a pasted bitmap', land.coastline.totalCoastCells > 0 && land.coastline.connectedComponents8 > 0,
    { totalCoastCells: land.coastline.totalCoastCells, connectedComponents8: land.coastline.connectedComponents8, componentSizes: land.coastline.componentSizes });

  // --- embedded raster
  const n = grid.cells;
  const eRaw = decodeLayer(P.terrain.elev, n), bRaw = decodeLayer(P.terrain.biome, n);
  let agree = 0;
  for (let i = 0; i < n; i++) if ((layers.landId[i] !== 0) === (eRaw[i] > 0)) agree++;
  const tOk = P.terrain.gw === 250 && P.terrain.gh === 175 && P.terrain.cell === 8 && eRaw.length === 43750 && bRaw.length === 43750
    && P.terrain.elev.length === 58336 && P.terrain.biome.length === 58336;
  add('RAS-01', 'embedded 250x175 terrain raster, base64 elevation+biome arrays of 43,750 cells each', tOk,
    { gw: P.terrain.gw, gh: P.terrain.gh, cell: P.terrain.cell, seed: P.terrain.seed, cells: n,
      elevBase64Length: P.terrain.elev.length, biomeBase64Length: P.terrain.biome.length,
      elevDecodedBytes: eRaw.length, biomeDecodedBytes: bRaw.length, encoding: 'base64 / uint8 / row-major / no compression',
      canonicalBase64Roundtrip: Buffer.from(eRaw).toString('base64') === P.terrain.elev && Buffer.from(bRaw).toString('base64') === P.terrain.biome });
  add('RAS-02', 'decoded elevation/biome value domains are reported, not reinterpreted', true,
    { elevationDistinct: new Set(eRaw).size, elevationMin: Math.min(...eRaw), elevationMax: Math.max(...eRaw), elevationZeroCells: eRaw.reduce((s, v) => s + (v === 0 ? 1 : 0), 0),
      biomeDistinct: new Set(bRaw).size, biomeMin: Math.min(...bRaw), biomeMax: Math.max(...bRaw),
      legendStatus: 'NOT_COMMITTED_IN_SOURCE',
      landmaskAgreementRatio: +(agree / n).toFixed(6),
      slopeStats: (() => { let mn = Infinity, mx = -Infinity, s = 0; for (const v of layers.slope) { mn = Math.min(mn, v); mx = Math.max(mx, v); s += v; } return { min: mn, max: mx, mean: +(s / n).toFixed(4), unit: 'RAW_BYTE_DELTA_PER_GRID_CELL' }; })() });

  // --- water
  const riverRefsOk = water.unresolvedRefs.length === 0;
  add('WAT-01', '17 rivers, 5 lakes, mouths, nav flags and slope profiles', P.rivers.length === 17 && P.lakes.length === 5 && riverRefsOk,
    { rivers: P.rivers.length, lakes: P.lakes.length, kinds: P.rivers.reduce((a, r) => (a[r.kind] = (a[r.kind] || 0) + 1, a), {}),
      mouthSummary: water.mouthSummary, unresolvedRefs: water.unresolvedRefs,
      navNavigableSegments: water.rivers.reduce((s, r) => s + r.navigableSegments, 0), navNonNavigable: water.rivers.reduce((s, r) => s + r.nonNavigableSegments, 0),
      features: water.rivers.flatMap(r => r.features.map(f => `${r.id}:${f.kind}`)),
      components: water.components.map(c => ({ id: c.id, members: c.members.length, reachesSea: c.reachesSea })),
      riverElevationProfiles: water.rivers.map(r => ({ id: r.id, min: r.derivedElevationProfile.min, max: r.derivedElevationProfile.max, descends: r.derivedDescendsSourceToMouth })) });
  add('WAT-02', 'water connectivity reaches the sea through authored mouths', water.components.some(c => c.reachesSea && c.members.length > 1),
    { seaConnectedLakes: water.seaConnectedLakes, seaComponentMembers: water.components.filter(c => c.reachesSea).map(c => c.members) });

  // --- transport
  const roadKinds = transport.roadKinds;
  const dockRefsOk = transport.docks.every(d => d.waterRefResolves);
  add('TRN-01', 'roads, trails, bridges, docks and ferry topology with preserved ids',
    P.roads.length === 92 && P.bridges.length === 12 && P.docks.length === 27 && dockRefsOk,
    { roads: P.roads.length, roadKinds, totalRoadLengthAu: Object.values(roadKinds).reduce((s, v) => s + v.lengthAu, 0),
      bridges: P.bridges.length, bridgeLoads: P.bridges.reduce((a, b) => (a[b.load] = (a[b.load] || 0) + 1, a), {}),
      docks: P.docks.length, dockKinds: P.docks.reduce((a, d) => (a[d.kind] = (a[d.kind] || 0) + 1, a), {}),
      dockWaterRefsResolved: dockRefsOk, ferryPaths: transport.ferryPaths.length,
      routeGraph: transport.routeGraph, widthStatus: 'NOT_IN_SOURCE',
      bridgeNearestRiver: transport.bridges.map(b => ({ id: b.id, load: b.load, river: b.nearestRiver?.id, distanceAu: b.nearestRiver?.distanceAu })) });

  // --- buildable / POI / spawn / elder
  add('BLD-01', 'candidate buildable regions and physical access are measurable', P.zones.length === 23 && P.zones.every(z => z.ring?.length >= 3),
    { zones: P.zones.length, zoneIds: P.zones.map(z => z.id), slopeLabels: P.zones.map(z => z.slope),
      tags: P.zones.map(z => z.tags), derivedBuildableCells: layers.buildableCandidate.reduce((s, v) => s + v, 0),
      derivedWalkableCells: layers.walkableCandidate.reduce((s, v) => s + v, 0),
      note: 'A0 protection / occupancy / collision legality NOT asserted' });
  const poiIds = P.pois.map(p => p.id);
  add('POI-01', '81 POI footprints, outer/deep regions, retreat and links',
    P.pois.length === 81 && new Set(poiIds).size === 81 && P.pois.every(p => p.foot?.length >= 3),
    { pois: P.pois.length, archetypeCount: new Set(P.pois.map(p => p.arche)).size, depth: P.pois.reduce((a, p) => (a[p.depth] = (a[p.depth] || 0) + 1, a), {}),
      withDeep: P.pois.filter(p => p.deep).length, withRetreat: P.pois.filter(p => p.retreat?.length).length,
      withLinks: P.pois.filter(p => p.links?.length).length,
      footAreaRangeAu2: [Math.min(...P.pois.filter(p => p.foot).map(p => ringArea(p.foot))), Math.max(...P.pois.filter(p => p.foot).map(p => ringArea(p.foot)))].map(v => +v.toFixed(2)),
      rooms: 'NOT_IN_SOURCE', entrances: 'NOT_IN_SOURCE', doorsPowerLoot: 'GAMEPLAY_OWNED' });
  add('SPW-01', '4 spawn regions preserved', P.spawns.length === 4 && new Set(P.spawns.map(s => s.id)).size === 4,
    { spawns: P.spawns.map(s => ({ id: s.id, at: s.at, region: s.region, conf: s.conf })) });
  add('ELD-01', '6 distinct Elder territories with outer/core/arena/approach',
    P.elders.length === 6 && new Set(P.elders.map(e => e.elder)).size === 6 && P.elders.every(e => e.outer?.length >= 3 && e.core?.length >= 3 && e.arenas?.length >= 1),
    { elders: P.elders.map(e => ({ id: e.id, elder: e.elder, outerPts: e.outer.length, corePts: e.core.length, arenas: e.arenas.length, approach: e.approach.length, pois: e.pois.length })),
      elderPoiRefsResolve: P.elders.every(e => e.pois.every(id => poiIds.includes(id))),
      mappingStatus: 'NO_GAMEPLAY_ELDER_MAPPING_CREATED' });

  // --- resources: annotations, never final source nodes
  add('RES-01', '280 resource objects are candidate geographic annotations, NOT 280 fixed source nodes',
    P.resources.length === 280 && new Set(P.resources.map(r => r.id)).size === 280 && P.resources.every(r => r.gate === 'none'),
    { count: P.resources.length, kinds: P.resources.reduce((a, r) => (a[r.kind] = (a[r.kind] || 0) + 1, a), {}),
      densityValues: [...new Set(P.resources.map(r => r.dens))].sort(),
      stockSupplied: false, yieldSupplied: false, finalInstancesSupplied: false, owner: 'Gameplay population algorithm' });

  // --- confidence / ids / coordinates
  const allIds = ['land', 'lakes', 'rivers', 'roads', 'bridges', 'docks', 'pois', 'zones', 'resources', 'spawns', 'elders', 'labels'].flatMap(k => P[k].map(o => o.id));
  add('CONF-01', 'source confidence flags preserved (proposal / assumption)', conf.totals.proposal > 0 && conf.totals.assumption > 0, { totals: conf.totals, byArray: conf.byArray, rule: conf.rule });
  add('ID-01', 'every authored source id is unique and preserved', allIds.length === new Set(allIds).size, { totalIds: allIds.length, uniqueIds: new Set(allIds).size });
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, coordCount = 0;
  const scan = a => {
    if (Array.isArray(a)) {
      if (a.length === 2 && typeof a[0] === 'number' && typeof a[1] === 'number') {
        coordCount++; minX = Math.min(minX, a[0]); maxX = Math.max(maxX, a[0]); minY = Math.min(minY, a[1]); maxY = Math.max(maxY, a[1]); return;
      }
      for (const v of a) scan(v);
    } else if (a && typeof a === 'object') { for (const v of Object.values(a)) scan(v); }
  };
  for (const k of ['land', 'lakes', 'rivers', 'roads', 'bridges', 'docks', 'pois', 'zones', 'resources', 'spawns', 'elders', 'labels']) scan(P[k]);
  add('COORD-01', 'all authored coordinates remain inside the 2000x1400 authoring canvas', minX >= 0 && maxX <= P.world.w && minY >= 0 && maxY <= P.world.h,
    { world: P.world, coordinateOccurrences: coordCount, minX, maxX, minY, maxY, note: 'No coordinate was rescaled, rounded or translated by this tool.' });
  add('SCALE-01', 'no silent rescale to the runtime 200x200 island', P.terrain.gw === 250 && P.terrain.gh === 175 && P.world.w === 2000 && P.world.h === 1400,
    { authoringCanvas: P.world, sourceGrid: { gw: P.terrain.gw, gh: P.terrain.gh, cell: P.terrain.cell }, runtimeReference: { WW: 200, WH: 200, TILE: 16 }, transformStatus: 'UNDECIDED', note: 'The transform is exposed as configurable and remains an open decision.' });

  const failed = checks.filter(c => c.status === 'FAIL');
  const doc = {
    schema: 'soh.map.source_verification.v1',
    generatedBy: 'world_lab/geo01/src/verify.mjs',
    canonicalSource: fp,
    verdict: failed.length ? 'FAIL' : 'PASS',
    checks,
    summary: { pass: checks.length - failed.length, fail: failed.length, total: checks.length },
    statement: 'Verification of the existing Veyra source. No gameplay population, no runtime intake, no coordinate transform, no invented climate/economy values.',
  };
  writeJson(path.join(out, 'source_verification.v1.json'), doc);
  for (const c of checks) console.log(`${c.status} ${c.id.padEnd(9)} ${c.requirement}`);
  console.log(`\nVERIFY_${doc.verdict} ${doc.summary.pass}/${doc.summary.total} checks`);
  if (failed.length) process.exitCode = 1;
}
main();
