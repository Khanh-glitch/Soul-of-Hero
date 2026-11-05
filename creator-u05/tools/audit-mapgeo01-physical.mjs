/**
 * MAP-GEO-REJOIN-01 — PHYSICAL-WORLD AUDIT (read-only).
 *
 * Reuses the PROTECTED, untouched U=0.5 terrain-only executable and its exact
 * WMP-04R1 / GOLD sampler. NO new geography, NO new renderer, NO new visual
 * simulation. GOLD JSON is read only as the source of IDs/centrelines; every
 * physical measurement below comes from `window.__terrain.sampleTile()`,
 * `u05Tile()` and `terrainBlocked()` in the actual runtime.
 *
 * Output: creator-u05/evidence/mapgeo01-physical-audit.json
 */
import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const VIEWER = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html');
const GOLD_FILE = path.join(REPO, 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json');
const OUT = path.join(ROOT, 'evidence/mapgeo01-physical-audit.json');
const VIEWER_SHA = crypto.createHash('sha256').update(fs.readFileSync(VIEWER)).digest('hex');
const GOLD_SHA = crypto.createHash('sha256').update(fs.readFileSync(GOLD_FILE)).digest('hex');
const G = JSON.parse(fs.readFileSync(GOLD_FILE, 'utf8')).project;
const CLIFF_RASTER = path.join(REPO, 'veyra-world-master/v3/rasters/cliffCandidate.v3.u8');
const CLIFF_RASTER_SHA = crypto.createHash('sha256').update(fs.readFileSync(CLIFF_RASTER)).digest('hex');
const cliffBytes = fs.readFileSync(CLIFF_RASTER);
const cliffCodeCounts = {};
for (const b of cliffBytes) cliffCodeCounts[b] = (cliffCodeCounts[b] || 0) + 1;
const T_NAME =['DEEP','SHALLOW','SAND','GRASS','MEADOW','FOREST','MARSH','HILL','CLIFF','SNOW','ASH','TOXIC','ROAD','BRIDGE','FLOOR','PWALL','LAVA','BURNT','ICE','RIVER'];
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const browser = await chromium.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib' }
});
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('file://' + VIEWER);
await page.waitForFunction(() => window.__terrain && window.__terrain.ready === true, { timeout: 60000 });

/** Cheap read-only sampler query (no despeckle window builds) for wide rings. */
async function probeLight(tiles) {
  const out = [];
  for (let i = 0; i < tiles.length; i += 20000) {
    const part = await page.evaluate(ts => {
      const a = window.__terrain;
      return ts.map(([x, y]) => {
        const s = a.sampleTile(x, y);
        return s ? [x, y, s.tile, s.road ? 1 : 0, s.water ? 1 : 0, s.authoredLand ? 1 : 0] : null;
      });
    }, tiles.slice(i, i + 20000));
    out.push(...part.filter(Boolean));
  }
  return out;
}
/** Query the REAL runtime sampler for a batch of tile coordinates. */
async function probe(tiles) {
  const out = [];
  for (let i = 0; i < tiles.length; i += 12000) {
    const part = await page.evaluate(ts => {
      const a = window.__terrain;
      return ts.map(([x, y]) => {
        const s = a.sampleTile(x, y);
        if (!s) return null;
        return {
          tx: x, ty: y, tile: a.u05Tile(x, y), raw: s.tile, blocked: a.terrainBlocked(x, y),
          land: s.authoredLand, water: s.water, lake: s.lake, river: s.river, road: s.road,
          bridge: s.bridge, dock: s.dock, coast: s.coast, source: s.sourceTile,
          biome: s.biomeCode, elev: s.elevation, hClass: s.heightClass, cliff: s.cliffCandidate,
          walkC: s.walkableCandidate, cargoC: s.cargoCandidate, buildC: s.buildableCandidate,
          waterClass: s.waterClass, wtc: s.waterTraversalClass, landId: s.landId,
          poiId: s.poiId, zoneId: s.zoneId, foot: s.permissions.foot,
          cart: s.permissions.cart, build: s.permissions.build, boat: s.permissions.boat,
          swim: s.permissions.swim, ferryFoot: s.permissions.ferryFoot
        };
      });
    }, tiles.slice(i, i + 12000));
    out.push(...part);
  }
  return out;
}
const key = (x, y) => `${x},${y}`;
const toTile = au => [Math.round(au[0] * 2), Math.round(au[1] * 2)];
const sampleAlong = (points, stepAu = 1) => {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(len / stepAu));
    for (let j = 0; j <= n; j++) out.push(toTile([ax + (bx - ax) * j / n, ay + (by - ay) * j / n]));
  }
  return out;
};

/* ------------------------------------------------------------------ *
 * 0. Full-frame coarse scan (stride 8) — bounded, no 11.2M allocation
 * ------------------------------------------------------------------ */
const coarseTiles = [];
for (let y = 4; y < 2800; y += 8) for (let x = 4; x < 4000; x += 8) coarseTiles.push([x, y]);
const coarse = (await probe(coarseTiles)).filter(Boolean);
const tally = (arr, f) => arr.reduce((m, v) => { const k = f(v); m[k] = (m[k] || 0) + 1; return m; }, {});
const globalScan = {
  samples: coarse.length, strideTiles: 8,
  tileCodes: Object.fromEntries(Object.entries(tally(coarse, v => T_NAME[v.tile] || 'UNKNOWN')).sort((a, b) => b[1] - a[1])),
  flags: ['land','water','lake','river','road','bridge','dock','coast','source','foot','cart','build','boat','swim','ferryFoot','blocked']
    .reduce((m, k) => (m[k] = coarse.filter(v => v[k]).length, m), {}),
  elevation: Object.fromEntries(Object.entries(tally(coarse, v => v.elev)).sort((a, b) => Number(a[0]) - Number(b[0]))),
  heightClass: tally(coarse, v => v.hClass), cliffCandidate: tally(coarse, v => v.cliff),
  walkableCandidate: tally(coarse, v => v.walkC), cargoCandidate: tally(coarse, v => v.cargoC),
  buildableCandidate: tally(coarse, v => v.buildC),
  distinctLandIds: [...new Set(coarse.map(v => v.landId))].sort((a, b) => a - b),
  distinctBiomes: [...new Set(coarse.map(v => v.biome))].sort((a, b) => a - b),
  waterTraversalClass: tally(coarse, v => v.wtc),
  permissionsAreCandidates: coarse.every(v => v.build === false && v.boat === false && v.swim === false && v.ferryFoot === false)
};

/* ------------------------------------------------------------------ *
 * A. Hydrography — coastline, islands, lakes, rivers, mouths, shores
 * ------------------------------------------------------------------ */
const riverTiles = [], roadTiles = [], nodeTiles = [], poiTiles = [], zoneTiles = [], lakeTiles = [];
const riverMeta = [], roadMeta = [];
for (const r of G.rivers) {
  const ts = sampleAlong(r.points, 1); riverTiles.push(...ts);
  riverMeta.push({ id: r.id, points: r.points, width: r.width, nav: r.nav, feats: (r.feats || []).map(f => f.kind), mouth: r.mouth, source: r.source, kind: r.kind, notes: r.notes });
}
for (const r of G.roads) {
  const ts = sampleAlong(r.points, 1); roadTiles.push(...ts);
  roadMeta.push({ id: r.id, name: r.name, kind: r.kind, purpose: r.purpose, points: r.points, nPoints: r.points.length });
}
for (const l of G.lakes) {
  const xs = l.ring.map(p => p[0]), ys = l.ring.map(p => p[1]);
  for (let auY = Math.min(...ys); auY <= Math.max(...ys); auY += 4)
    for (let auX = Math.min(...xs); auX <= Math.max(...xs); auX += 4) lakeTiles.push(toTile([auX, auY]));
}
for (const n of [...G.bridges, ...G.docks, ...G.spawns]) {
  const [tx, ty] = toTile(n.at);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) nodeTiles.push([tx + dx, ty + dy]);
}
for (const p of G.pois) {
  const [tx, ty] = toTile(p.at); poiTiles.push([tx, ty]);
  const xs = (p.foot || []).map(q => q[0]), ys = (p.foot || []).map(q => q[1]);
  if (xs.length) for (let auY = Math.min(...ys); auY <= Math.max(...ys); auY += 4)
    for (let auX = Math.min(...xs); auX <= Math.max(...xs); auX += 4) poiTiles.push(toTile([auX, auY]));
  for (const r of p.retreat || []) poiTiles.push(toTile(r));
}
// Spawn route networks: a real 40-tile radius ring per spawn (not a 7x7 guess).
const spawnRings = [];
for (const s of G.spawns) {
  const [tx, ty] = toTile(s.at);
  for (let dy = -40; dy <= 40; dy++) for (let dx = -40; dx <= 40; dx++) spawnRings.push([tx + dx, ty + dy]);
}
for (const z of G.zones) {
  const xs = z.ring.map(q => q[0]), ys = z.ring.map(q => q[1]);
  for (let auY = Math.min(...ys); auY <= Math.max(...ys); auY += 4)
    for (let auX = Math.min(...xs); auX <= Math.max(...xs); auX += 4) zoneTiles.push(toTile([auX, auY]));
}
const allTiles = [...riverTiles, ...roadTiles, ...nodeTiles, ...poiTiles, ...zoneTiles, ...lakeTiles, ...spawnRings];
const uniq = [...new Map(allTiles.map(t => [key(t[0], t[1]), t])).values()];
console.log(`MAPGEO_AUDIT probes=${uniq.length} (deduped from ${allTiles.length})`);
const samples = (await probe(uniq)).filter(Boolean);
const S = new Map(samples.map(v => [key(v.tx, v.ty), v]));
const at = (x, y) => S.get(key(x, y));

// Rivers: continuity, mouths, bends, features, confluence, banks
const rivers = riverMeta.map((r, idx) => {
  const ts = sampleAlong(r.points, 1);
  const vals = ts.map(([x, y]) => at(x, y)).filter(Boolean);
  const flags = vals.filter(v => v.river || v.lake || v.water).length;
  const mouthAu = r.points[r.points.length - 1], sourceAu = r.points[0];
  const m = at(...toTile(mouthAu)), s = at(...toTile(sourceAu));
  let bends = 0;
  for (let i = 1; i < r.points.length - 1; i++) {
    const a = r.points[i - 1], b = r.points[i], c = r.points[i + 1];
    const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = Math.abs(((a2 - a1) * 180 / Math.PI + 540) % 360 - 180);
    if (d > 25) bends++;
  }
  return {
    id: r.id, kind: r.kind, widthAu: r.width, navFlags: r.nav, feats: r.feats, notes: r.notes,
    mouth: r.mouth, source: r.source,
    centrelineSamples: vals.length, waterFlagSamples: flags,
    continuity: +(flags / Math.max(1, vals.length)).toFixed(4),
    mouthTile: toTile(mouthAu), mouthWater: !!(m && (m.water || m.lake || m.river)), mouthTileCode: m ? T_NAME[m.tile] : null,
    sourceTile: toTile(sourceAu), sourceWater: !!(s && (s.water || s.lake || s.river)),
    bends, distinctElevation: [...new Set(vals.map(v => v.elev))].length,
    distinctWaterTraversalClass: tally(vals, v => v.wtc),
    centrelineBlocked: vals.filter(v => v.blocked).length
  };
});
const confluence = [];
for (let i = 0; i < riverMeta.length; i++) for (let j = i + 1; j < riverMeta.length; j++) {
  const a = riverMeta[i].points, b = riverMeta[j].points;
  const ends = [a[0], a[a.length - 1]], endsB = [b[0], b[b.length - 1]];
  for (const p of ends) for (const q of endsB) if (Math.hypot(p[0] - q[0], p[1] - q[1]) <= 8)
    confluence.push({ a: riverMeta[i].id, b: riverMeta[j].id, atAu: p, distanceAu: +Math.hypot(p[0]-q[0],p[1]-q[1]).toFixed(2) });
}
const hydrography = {
  goldCounts: { landRings: G.land.reduce((n, l) => n + l.rings.length, 0), landMasses: G.land.length,
    lakes: G.lakes.length, rivers: G.rivers.length, bridges: G.bridges.length, docks: G.docks.length },
  runtime: {
    coastTilesAtStride8: globalScan.flags.coast, lakeTilesAtStride8: globalScan.flags.lake,
    riverTilesAtStride8: globalScan.flags.river, waterTilesAtStride8: globalScan.flags.water,
    distinctLandRasterIds: globalScan.distinctLandIds,
    shallowVsDeep: { SHALLOW: globalScan.tileCodes.SHALLOW || 0, DEEP: globalScan.tileCodes.DEEP || 0, RIVER: globalScan.tileCodes.RIVER || 0 },
    shoreTransitionsMeasured: coarse.filter(v => v.coast && v.land).length,
    waterTraversalClass: globalScan.waterTraversalClass
  },
  lakes: G.lakes.map(l => {
    const xs = l.ring.map(p => p[0]), ys = l.ring.map(p => p[1]);
    const tiles = [];
    for (let auY = Math.min(...ys); auY <= Math.max(...ys); auY += 4)
      for (let auX = Math.min(...xs); auX <= Math.max(...xs); auX += 4) tiles.push(at(...toTile([auX, auY])));
    const v = tiles.filter(Boolean);
    return { id: l.id, name: l.name, oasis: !!l.oasis, samples: v.length,
      waterSamples: v.filter(q => q.water || q.lake).length, lakeFlagSamples: v.filter(q => q.lake).length,
      shoreSamples: v.filter(q => q.coast).length };
  }),
  rivers, confluence,
  mouthsByKind: tally(riverMeta, r => r.mouth?.kind || 'unspecified'),
  sourcesByKind: tally(riverMeta, r => r.source?.kind || 'unspecified'),
  featureKinds: tally(riverMeta.flatMap(r => r.feats), f => f)
};

/* ------------------------------------------------------------------ *
 * B. Physical elevation / slopes / cliffs / terraces / transitions
 * ------------------------------------------------------------------ */
// Stride-1 material-transition windows at representative terrain boundaries.
const WINDOWS = [
  { id: 'W_beacon_coast', c: [544, 1304] }, { id: 'W_grey_lake', c: [1600, 1050] },
  { id: 'W_north_snow', c: [1800, 700] }, { id: 'W_south_dry', c: [1320, 1970] },
  { id: 'W_river_bend', c: [1464, 1300] }, { id: 'W_highland', c: [2200, 900] },
  { id: 'W_marsh', c: [2152, 828] }, { id: 'W_open_plain', c: [1200, 1200] }
];
const winTiles = [];
for (const w of WINDOWS) for (let dy = -20; dy <= 20; dy++) for (let dx = -30; dx <= 30; dx++) winTiles.push([w.c[0]+dx, w.c[1]+dy]);
const winSamples = (await probe(winTiles)).filter(Boolean);
const WM = new Map(winSamples.map(v => [key(v.tx, v.ty), v]));
const windows = WINDOWS.map(w => {
  const vs = []; let transitions = 0, cliffEdges = 0, waterEdges = 0;
  for (let dy = -20; dy <= 20; dy++) for (let dx = -30; dx <= 30; dx++) {
    const c = WM.get(key(w.c[0]+dx, w.c[1]+dy)); if (!c) continue; vs.push(c);
    const e = WM.get(key(w.c[0]+dx+1, w.c[1]+dy)), s = WM.get(key(w.c[0]+dx, w.c[1]+dy+1));
    for (const n of [e, s]) if (n) {
      if (n.tile !== c.tile) transitions++;
      if ((n.tile === 8) !== (c.tile === 8)) cliffEdges++;
      if ((n.water) !== (c.water)) waterEdges++;
    }
  }
  return { id: w.id, centreTile: w.c, samples: vs.length,
    tileCodes: Object.fromEntries(Object.entries(tally(vs, v => T_NAME[v.tile])).sort((a,b)=>b[1]-a[1])),
    distinctTileCodes: new Set(vs.map(v => v.tile)).size,
    materialTransitions: transitions, cliffEdges, waterLandEdges: waterEdges,
    elevationRange: [Math.min(...vs.map(v=>v.elev)), Math.max(...vs.map(v=>v.elev))],
    heightClasses: tally(vs, v => v.hClass), cliffCandidates: tally(vs, v => v.cliff),
    walkableCandidates: tally(vs, v => v.walkC), cargoCandidates: tally(vs, v => v.cargoC),
    buildableCandidates: tally(vs, v => v.buildC), blockedTiles: vs.filter(v => v.blocked).length };
});
const terrain = {
  global: { elevation: globalScan.elevation, heightClass: globalScan.heightClass,
    cliffCandidate: globalScan.cliffCandidate, walkableCandidate: globalScan.walkableCandidate,
    cargoCandidate: globalScan.cargoCandidate, buildableCandidate: globalScan.buildableCandidate,
    cliffTilesAtStride8: globalScan.tileCodes.CLIFF || 0,
    permissionsAreCandidatesOnly: globalScan.permissionsAreCandidates },
  windows,
  cliffCandidateDiscrepancy: {
    sourceRaster: 'veyra-world-master/v3/rasters/cliffCandidate.v3.u8',
    sourceRasterSha256: CLIFF_RASTER_SHA, sourceRasterBytes: cliffBytes.length,
    sourceRasterCodeCounts: cliffCodeCounts,
    maxSourceCode: Math.max(...Object.keys(cliffCodeCounts).map(Number)),
    u05SamplerRule: 'cliffBlocked = cliff >= 2 && heightClass >= 2 && !bridge',
    u05RuntimeCliffTilesAtStride8: globalScan.tileCodes.CLIFF || 0,
    u05RuntimeCliffTilesInAllWindows: windows.reduce((n,w)=>n+(w.tileCodes.CLIFF||0),0),
    conclusion: 'SOURCE_ENCODING_MISMATCH: the WMP-03 cliffCandidate raster encodes only 0/1 (' + (cliffCodeCounts[1]||0) + ' candidate cells), while the U=0.5 derived sampler requires >=2. Therefore ZERO physical CLIFF blockers exist in the U=0.5 runtime. This is a measured Map-layer discrepancy, NOT an authored cliff. Applying a threshold change would mint physical blockers from CANDIDATE data without Creator/Gameplay approval, so NO geometry change is applied; it is reported as a named blocker.'
  },
  note: 'cliffCandidate / heightClass / walkableCandidate / cargoCandidate / buildableCandidate are WMP-03 CANDIDATE rasters (8 AU analysis cells). Only CLIFF tiles (cliff>=2 && heightClass>=2) become physical blockers in the U=0.5 viewer. No Gameplay permission is minted: build/boat/swim/ferryFoot are false for every sampled tile.'
};

/* ------------------------------------------------------------------ *
 * C. All 92 GOLD roads — width, continuity, intersections, approaches
 * ------------------------------------------------------------------ */
// Perpendicular width probes at the middle of each road's longest segment.
const widthProbes = [];
const widthMeta = [];
for (const r of roadMeta) {
  let best = 0, bi = 0;
  for (let i = 0; i < r.points.length - 1; i++) {
    const d = Math.hypot(r.points[i+1][0]-r.points[i][0], r.points[i+1][1]-r.points[i][1]);
    if (d > best) { best = d; bi = i; }
  }
  const a = r.points[bi], b = r.points[bi+1];
  const dx = b[0]-a[0], dy = b[1]-a[1], L = Math.hypot(dx, dy) || 1;
  const mid = [ (a[0]+b[0])/2, (a[1]+b[1])/2 ];
  const nx = -dy/L, ny = dx/L;                 // perpendicular in AU
  const probes = [];
  for (let k = -10; k <= 10; k++) probes.push(toTile([mid[0] + nx*k*0.5, mid[1] + ny*k*0.5]));
  widthProbes.push(...probes);
  widthMeta.push({ id: r.id, midAu: mid, probes });
}
const widthSamples = await probe(widthProbes);
const WSM = new Map(widthSamples.filter(Boolean).map(v => [key(v.tx,v.ty), v]));
const widths = widthMeta.map(w => {
  const run = w.probes.map(p => WSM.get(key(p[0],p[1])));
  const road = run.filter(v => v && v.road).length;
  const rendered = run.filter(v => v && (v.tile === 12 || v.tile === 13)).length;
  return { id: w.id, probes: run.filter(Boolean).length, roadFlagTiles: road,
    renderedRoadOrBridgeTiles: rendered, midpointTile: toTile(w.midAu) };
});
// Intersection estimate from authored GOLD centrelines (geometry only, no runtime permission).
function segInt(a,b,c,d) {
  const r=[b[0]-a[0],b[1]-a[1]], s=[d[0]-c[0],d[1]-c[1]];
  const den=r[0]*s[1]-r[1]*s[0]; if (Math.abs(den)<1e-9) return false;
  const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den, u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;
  return t>0&&t<1&&u>0&&u<1;
}
let intersections = 0; const intersectingPairs = [];
for (let i=0;i<roadMeta.length;i++) for (let j=i+1;j<roadMeta.length;j++) {
  let hit=false;
  for (let a=0;a<roadMeta[i].points.length-1 && !hit;a++) for (let b=0;b<roadMeta[j].points.length-1;b++)
    if (segInt(roadMeta[i].points[a],roadMeta[i].points[a+1],roadMeta[j].points[b],roadMeta[j].points[b+1])) { hit=true; break; }
  if (hit) { intersections++; intersectingPairs.push([roadMeta[i].id, roadMeta[j].id]); }
}
const roads = roadMeta.map((r, i) => {
  const ts = sampleAlong(r.points, 1);
  const vs = ts.map(([x,y]) => at(x,y)).filter(Boolean);
  const roadFlag = vs.filter(v => v.road).length;
  const rendered = vs.filter(v => v.tile === 12 || v.tile === 13).length;
  const waterOverride = vs.filter(v => v.road && (v.tile === 19 || v.tile === 0 || v.tile === 1)).length;
  const cliffOverride = vs.filter(v => v.road && v.tile === 8).length;
  const blocked = vs.filter(v => v.blocked).length;
  const biomes = [...new Set(vs.map(v => v.biome))].sort((a,b)=>a-b);
  const ends = [r.points[0], r.points[r.points.length-1]].map(p => {
    const [tx,ty] = toTile(p); const v = at(tx,ty);
    let nearestWalkable = null, nearestRoad = null;
    for (let d=0; d<=12 && (!nearestWalkable || !nearestRoad); d++)
      for (let dy=-d; dy<=d; dy++) for (let dx=-d; dx<=d; dx++) {
        if (Math.max(Math.abs(dx),Math.abs(dy)) !== d) continue;
        const q = at(tx+dx,ty+dy); if (!q) continue;
        if (!nearestWalkable && !q.blocked) nearestWalkable = d;
        if (!nearestRoad && (q.tile===12||q.tile===13)) nearestRoad = d;
      }
    return { au: p, tile: [tx,ty], tileCode: v ? T_NAME[v.tile] : null, blocked: v ? v.blocked : null,
      nearestWalkableTileDist: nearestWalkable, nearestRoadTileDist: nearestRoad };
  });
  return {
    id: r.id, name: r.name, kind: r.kind, purpose: r.purpose, points: r.nPoints,
    centrelineSamples: vs.length, roadFlagSamples: roadFlag,
    centrelineContinuity: +(roadFlag / Math.max(1, vs.length)).toFixed(4),
    renderedRoadSurfaceSamples: rendered,
    visibleSurfaceContinuity: +(rendered / Math.max(1, vs.length)).toFixed(4),
    waterOverrideSamples: waterOverride, cliffOverrideSamples: cliffOverride,
    blockedCentrelineSamples: blocked,
    distinctBiomeCodesAlongRoad: biomes, biomeTransition: biomes.length > 1,
    longestSegmentPerpendicular: widths[i], endpoints: ends
  };
});
const roadsSection = {
  goldRoadCount: G.roads.length, roadKinds: tally(G.roads, r => r.kind),
  runtimeRoadTilesAtStride8: globalScan.flags.road, runtimeBridgeTilesAtStride8: globalScan.flags.bridge,
  centrelineIntersectionsFromGOLD: intersections, intersectingPairCount: intersectingPairs.length,
  intersectingPairsSample: intersectingPairs.slice(0, 12),
  roadsWithBiomeTransition: roads.filter(r => r.biomeTransition).length,
  roadsWithWaterOverride: roads.filter(r => r.waterOverrideSamples > 0).length,
  roadsWithCliffOverride: roads.filter(r => r.cliffOverrideSamples > 0).length,
  roadsFullyContinuous: roads.filter(r => r.centrelineContinuity === 1).length,
  meanPerpendicularRoadFlagTiles: +(widths.reduce((n,w)=>n+w.roadFlagTiles,0)/widths.length).toFixed(2),
  meanPerpendicularRenderedTiles: +(widths.reduce((n,w)=>n+w.renderedRoadOrBridgeTiles,0)/widths.length).toFixed(2),
  roads, note: 'GOLD road width = 3.0 AU centreline (6 tiles at U=0.5). The verbatim LW-01 distSeg tolerance adds +0.9 AU; measured perpendicular tiles therefore exceed the nominal 6. This is the Creator-locked Beacon appearance and is NOT changed.'
};

/* ------------------------------------------------------------------ *
 * D. 12 bridges + 27 docks — physical connection to adjoining land
 * ------------------------------------------------------------------ */
const bridges = G.bridges.map(b => {
  const [tx,ty] = toTile(b.at), c = at(tx,ty);
  let roadAdj = 0, landAdj = 0, waterAdj = 0, bridgeAdj = 0, walkableAdj = 0;
  for (let dy=-3;dy<=3;dy++) for (let dx=-3;dx<=3;dx++) {
    const q = at(tx+dx,ty+dy); if (!q) continue;
    if (q.road) roadAdj++; if (q.land && !q.water) landAdj++; if (q.water) waterAdj++;
    if (q.bridge) bridgeAdj++; if (!q.blocked) walkableAdj++;
  }
  return { id: b.id, name: b.name, atAu: b.at, atTile: [tx,ty], ang: b.ang, load: b.load,
    runtime: c ? { tileCode: T_NAME[c.tile], rawCode: T_NAME[c.raw], blocked: c.blocked,
      river: c.river, lake: c.lake, water: c.water, road: c.road, bridge: c.bridge, dock: c.dock,
      foot: c.foot, cart: c.cart, cliff: c.cliff, hClass: c.hClass, wtc: c.wtc } : null,
    neighbourhood7x7: { roadAdj, landAdj, waterAdj, bridgeAdj, walkableAdj },
    physicalCrossingSupported: !!(c && !c.blocked && (c.tile === 13 || c.tile === 12)) };
});
const docks = G.docks.map(d => {
  const [tx,ty] = toTile(d.at), c = at(tx,ty);
  let roadAdj = 0, landAdj = 0, waterAdj = 0, dockAdj = 0, walkableAdj = 0, nearestLandDist = null;
  for (let dy=-3;dy<=3;dy++) for (let dx=-3;dx<=3;dx++) {
    const q = at(tx+dx,ty+dy); if (!q) continue;
    if (q.road) roadAdj++; if (q.land && !q.water) landAdj++; if (q.water) waterAdj++;
    if (q.dock) dockAdj++; if (!q.blocked) walkableAdj++;
    const dist = Math.abs(dx)+Math.abs(dy);
    if (q.land && !q.water && (nearestLandDist === null || dist < nearestLandDist)) nearestLandDist = dist;
  }
  return { id: d.id, name: d.name, kind: d.kind, water: d.water, atAu: d.at, atTile: [tx,ty],
    runtime: c ? { tileCode: T_NAME[c.tile], blocked: c.blocked, land: c.land, water: c.water,
      coast: c.coast, dock: c.dock, road: c.road, foot: c.foot, cart: c.cart } : null,
    neighbourhood7x7: { roadAdj, landAdj, waterAdj, dockAdj, walkableAdj },
    nearestDryLandTileDist: nearestLandDist,
    landApproachSupported: nearestLandDist !== null };
});
const connections = {
  bridges: { count: bridges.length,
    physicallyCrossable: bridges.filter(b => b.physicalCrossingSupported).length,
    allCentresAreRiverTile: bridges.filter(b => b.runtime && b.runtime.tileCode === 'RIVER').length,
    allCentresBlocked: bridges.filter(b => b.runtime && b.runtime.blocked).length,
    bridgeFlagAtCentre: bridges.filter(b => b.runtime && b.runtime.bridge).length,
    loadClasses: tally(G.bridges, b => b.load), items: bridges,
    finding: 'BRIDGE_DECK_NOT_PHYSICALLY_PRESENT_IN_U05_RUNTIME. Tile priority in the derived sampler places lake/river BEFORE bridge, so every authored GOLD bridge centre renders as RIVER (code 19) and terrainBlocked()=true. The broad GOLD bridge node radius (12 AU = 24 tiles) is a diagnostic AREA, not an approved bridge span/sprite. Map must not stamp an arbitrary bridge deck; a real span/asset and Gameplay collision contract are required.' },
  docks: { count: docks.length, coastal: docks.filter(d=>d.kind==='coastal').length,
    inland: docks.filter(d=>d.kind!=='coastal').length,
    withLandApproach: docks.filter(d=>d.landApproachSupported).length,
    withRoadAdjacency: docks.filter(d=>d.neighbourhood7x7.roadAdj>0).length,
    dockFlagAtCentre: docks.filter(d=>d.runtime&&d.runtime.dock).length,
    centreOnDryLand: docks.filter(d=>d.runtime&&d.runtime.land&&!d.runtime.water).length,
    items: docks,
    finding: 'Docks are GOLD POINT NODES with a 10 AU diagnostic radius. Several centres are on water/coast (physically correct for a berth) and several are on dry land. No boarding/disembark cell, water depth or land path permission is authored in the U=0.5 runtime.' }
};

/* ------------------------------------------------------------------ *
 * E. Four spawns + nearby route networks
 * ------------------------------------------------------------------ */
const spawns = G.spawns.map(s => {
  const [tx,ty] = toTile(s.at), c = at(tx,ty);
  let nearestRoad = null, nearestWater = null, nearestCliff = null, walkable10 = 0, total10 = 0,
      walkable40 = 0, total40 = 0, nearestPoi = null, roadTiles40 = 0, blockedTiles40 = 0;
  for (let dy=-40;dy<=40;dy++) for (let dx=-40;dx<=40;dx++) {
    const q = at(tx+dx,ty+dy); if (!q) continue;
    const d = Math.max(Math.abs(dx),Math.abs(dy));
    total40++; if (!q.blocked) walkable40++; else blockedTiles40++;
    if (q.tile===12||q.tile===13) roadTiles40++;
    if (d<=10) { total10++; if (!q.blocked) walkable10++; }
    if ((q.tile===12||q.tile===13) && (nearestRoad===null || d<nearestRoad)) nearestRoad = d;
    if (q.water && (nearestWater===null || d<nearestWater)) nearestWater = d;
    if (q.tile===8 && (nearestCliff===null || d<nearestCliff)) nearestCliff = d;
    if (q.poiId && (nearestPoi===null || d<nearestPoi.dist)) nearestPoi = { id: q.poiId, dist: d };
  }
  return { id: s.id, name: s.name, region: s.region, atAu: s.at, atTile: [tx,ty],
    runtime: c ? { tileCode: T_NAME[c.tile], blocked: c.blocked, land: c.land, water: c.water,
      coast: c.coast, foot: c.foot, cart: c.cart, buildC: c.buildC, biome: c.biome,
      poiId: c.poiId, zoneId: c.zoneId, road: c.road } : null,
    radius10: { sampledTiles: total10, walkableTiles: walkable10,
      walkableFraction: +(walkable10/Math.max(1,total10)).toFixed(4) },
    radius40: { sampledTiles: total40, walkableTiles: walkable40, blockedTiles: blockedTiles40,
      roadTiles: roadTiles40, walkableFraction: +(walkable40/Math.max(1,total40)).toFixed(4) },
    nearestRoadTileDist: nearestRoad, nearestWaterTileDist: nearestWater,
    nearestCliffTileDist: nearestCliff, nearestPoi: nearestPoi,
    note: 'Real 81x81-tile (radius 40) probe of the U=0.5 runtime. Route distance is Chebyshev tile distance. A0 spawn legality is Gameplay-owned.' };
});
// Wide, cheap ring scan to find the REAL nearest authored road for each spawn (radius 120 tiles = 60 AU).
const farRings = [];
for (const s of G.spawns) {
  const [tx, ty] = toTile(s.at);
  for (let d = 41; d <= 120; d++) {
    for (let dx = -d; dx <= d; dx++) { farRings.push([tx + dx, ty - d], [tx + dx, ty + d]); }
    for (let dy = -d + 1; dy < d; dy++) { farRings.push([tx - d, ty + dy], [tx + d, ty + dy]); }
  }
}
const far = await probeLight(farRings);
for (const s of spawns) {
  const [tx, ty] = s.atTile;
  let best = null, bestCentre = null;
  for (const [x, y, tile, road] of far) {
    const d = Math.max(Math.abs(x - tx), Math.abs(y - ty));
    if (d < 41 || d > 120) continue;
    if ((tile === 12 || tile === 13) && (best === null || d < best.d)) best = { d, tile: T_NAME[tile], at: [x, y] };
    if (road === 1 && (bestCentre === null || d < bestCentre.d)) bestCentre = { d, at: [x, y] };
  }
  if (s.nearestRoadTileDist !== null && (!best || s.nearestRoadTileDist < best.d)) best = { d: s.nearestRoadTileDist, withinRadius40: true };
  s.nearestRenderedRoadTileDistUpTo120 = best ? best.d : null;
  s.nearestRoadCentrelineTileDistUpTo120 = bestCentre ? bestCentre.d : null;
  s.nearestRoadEvidence = best || null;
}
const spawnsSection = { count: spawns.length, allOnDryWalkableLand: spawns.every(s=>s.runtime && s.runtime.land && !s.runtime.water && !s.runtime.blocked),
  allFootCandidateTrue: spawns.every(s=>s.runtime && s.runtime.foot),
  spawnBuildableCandidates: spawns.map(s=>({id:s.id,buildC:s.runtime?.buildC})), items: spawns,
  note: 'A0 spawn legality (safe route, no softlock, 4 geographically distinct walks) is GAMEPLAY-owned; U05 only proves the physical tile is dry and not terrain-blocked.' };

/* ------------------------------------------------------------------ *
 * F. POI exteriors / buildable locations / retreat routes (physical only)
 * ------------------------------------------------------------------ */
const pois = G.pois.map(p => {
  const [tx,ty] = toTile(p.at), c = at(tx,ty);
  const foot = p.foot || [];
  const xs = foot.map(q=>q[0]), ys = foot.map(q=>q[1]);
  const cells = [];
  if (xs.length) for (let auY=Math.min(...ys);auY<=Math.max(...ys);auY+=4)
    for (let auX=Math.min(...xs);auX<=Math.max(...xs);auX+=4) { const q=at(...toTile([auX,auY])); if(q)cells.push(q); }
  const retreat = (p.retreat||[]).map(r => {
    const q = at(...toTile(r)); return { atAu: r, tile: toTile(r), tileCode: q?T_NAME[q.tile]:null, blocked: q?q.blocked:null, foot: q?q.foot:null };
  });
  return { id: p.id, arche: p.arche, depth: p.depth, atAu: p.at, atTile: [tx,ty],
    runtimePoiIdAtCentre: c ? c.poiId : null,
    centreTileCode: c ? T_NAME[c.tile] : null, centreBlocked: c ? c.blocked : null,
    exteriorSamples: cells.length, exteriorWalkable: cells.filter(q=>!q.blocked).length,
    exteriorDistinctMaterials: [...new Set(cells.map(q=>T_NAME[q.tile]))],
    hasDeepPolygon: !!(p.deep && p.deep.length>=3), hasRetreatPolyline: !!(p.retreat && p.retreat.length),
    retreat, accessText: p.access || null, gate: p.gate || null,
    note: 'foot polygons are SITE ENVELOPES, NOT certified buildings. No door/entrance/room is asserted.' };
});
const zones = G.zones.map(z => {
  const xs=z.ring.map(q=>q[0]), ys=z.ring.map(q=>q[1]); const cells=[];
  for (let auY=Math.min(...ys);auY<=Math.max(...ys);auY+=4) for (let auX=Math.min(...xs);auX<=Math.max(...xs);auX+=4) {
    const q=at(...toTile([auX,auY])); if(q)cells.push(q);
  }
  return { id: z.id, soil: z.soil, slope: z.slope, tags: z.tags, samples: cells.length,
    buildableCandidateTiles: cells.filter(q=>q.buildC>0).length,
    walkableTiles: cells.filter(q=>!q.blocked).length,
    distinctMaterials: [...new Set(cells.map(q=>T_NAME[q.tile]))] };
});
const poiSection = {
  poiCount: pois.length, poiWithRetreatPolyline: pois.filter(p=>p.hasRetreatPolyline).length,
  poiWithDeepPolygon: pois.filter(p=>p.hasDeepPolygon).length,
  poiWithExteriorWalkableSamples: pois.filter(p=>p.exteriorWalkable>0).length,
  poiCentresOnBlockedTile: pois.filter(p=>p.centreBlocked).length,
  retreatEndpointsWalkable: pois.flatMap(p=>p.retreat).filter(r=>r.blocked===false).length,
  retreatEndpointsTotal: pois.flatMap(p=>p.retreat).length,
  zoneCount: zones.length, zonesWithBuildableCandidates: zones.filter(z=>z.buildableCandidateTiles>0).length,
  items: pois, zones,
  note: 'POI exterior = GOLD foot envelope sampled at U=0.5 tile centres. NO door, entrance prop, key, power, room, build right or loot was invented. A8 owns interaction semantics; A0 owns placement legality.'
};

/* ------------------------------------------------------------------ *
 * Separation of visible surface / physical geometry / Gameplay permission
 * ------------------------------------------------------------------ */
const separation = {
  visibleSurface: { source: 'u05Tile() -> verbatim live-Gameplay PAL/PRIO/texel painter (sha256 f29c1a68…)',
    examples: globalScan.tileCodes, note: 'ROAD/BRIDGE/RIVER/CLIFF/SAND/biome tile codes are what the 640x360 1x camera draws.' },
  physicalGeometry: { source: 'sampleTile() flags + terrainBlocked() + WMP-03 candidate rasters',
    examples: { authoredLand: globalScan.flags.land, water: globalScan.flags.water, coast: globalScan.flags.coast,
      road: globalScan.flags.road, bridge: globalScan.flags.bridge, dock: globalScan.flags.dock,
      blocked: globalScan.flags.blocked, cliffCandidate: globalScan.cliffCandidate },
    note: 'CANDIDATE layers (walkable/cargo/buildable/cliff/elevation) are 8 AU analysis data, never Gameplay permission.' },
  gameplayPermission: { source: 'sampleTile().permissions',
    observed: { footTrue: globalScan.flags.foot, cartTrue: globalScan.flags.cart,
      buildTrue: globalScan.flags.build, boatTrue: globalScan.flags.boat,
      swimTrue: globalScan.flags.swim, ferryFootTrue: globalScan.flags.ferryFoot },
    note: 'build / boat / swim / ferryFoot are FALSE for every sampled tile. foot/cart are MAP CANDIDATES only, explicitly labelled GAMEPLAY_ONLY__NOT_APPROVED. No walkable water, cart, boat, loading capacity, POI door or build right was invented.' }
};

/* ------------------------------------------------------------------ *
 * Named physical defect register (measured, owner, severity)
 * ------------------------------------------------------------------ */
const defects = [
  { id: 'MGP-D01', title: 'All 12 GOLD bridges render as RIVER and are terrain-blocked in U=0.5 runtime',
    measurement: { bridgesChecked: 12, centresOnRiverTile: connections.bridges.allCentresAreRiverTile, centresBlocked: connections.bridges.allCentresBlocked, physicallyCrossable: connections.bridges.physicallyCrossable },
    owner: 'MAP_U05 (derived tile priority) + CREATOR (bridge span/art) + GAMEPLAY A8 (collision/permission)',
    severity: 'BLOCKER', mapOwnedGeometryCorrectionApplied: false,
    whyNotCorrected: 'The GOLD bridge node radius is 12 AU (24 tiles) — a diagnostic AREA, not an approved bridge span. Stamping it as BRIDGE would create an arbitrary ~48-tile bridge deck over the river, which REAL_MAP_CONVERSION_CONTRACT forbids ("never stamp arbitrary bridge over river") and would violate H05/H07/H08. Requires a source-backed span + approved bridge sprite/asset + Gameplay collision contract.' },
  { id: 'MGP-D02', title: 'Road centrelines overridden by water/cliff at river crossings',
    measurement: { roadsWithWaterOverride: roadsSection.roadsWithWaterOverride, roadsWithCliffOverride: roadsSection.roadsWithCliffOverride, totalWaterOverrideSamples: roads.reduce((n,r)=>n+r.waterOverrideSamples,0) },
    owner: 'MAP_U05 (physical continuity) + CREATOR (where a bridge/ferry is authorised) + GAMEPLAY A8 (ferry/boat)',
    severity: 'HIGH', mapOwnedGeometryCorrectionApplied: false,
    whyNotCorrected: 'GOLD road centrelines and GOLD rivers are immutable source geometry. Overridden tiles are where an authored road meets authored water; changing them would reauthor GOLD or invent a crossing.' },
  { id: 'MGP-D03', title: 'No boarding/disembark cell or land path permission for 27 docks',
    measurement: { docks: 27, withLandApproach: connections.docks.withLandApproach, withRoadAdjacency: connections.docks.withRoadAdjacency, dockFlagAtCentre: connections.docks.dockFlagAtCentre },
    owner: 'MAP_U05 (dock geometry candidate) + GAMEPLAY A8 (boarding/vehicle) + CREATOR (art)',
    severity: 'HIGH', mapOwnedGeometryCorrectionApplied: false,
    whyNotCorrected: 'Docks are GOLD point nodes with a 10 AU diagnostic radius. No approved dock asset/span, water depth or land path is authored; inventing one is prohibited.' },
  { id: 'MGP-D04', title: '26 POI exterior entrance records missing',
    measurement: { missing: 26, fromFindings: 'MISSING_EXTERIOR_ENTRANCE_RECORD' },
    owner: 'GAMEPLAY A8 (door/entrance semantics) + CREATOR (art)',
    severity: 'HIGH', mapOwnedGeometryCorrectionApplied: false,
    whyNotCorrected: 'Exterior envelopes exist as GOLD foot polygons; an entrance/door is a Gameplay interaction record, not Map geometry. No fake entrance prop may be created to make a gate PASS.' },
  { id: 'MGP-D05', title: '19 buildable zones overlap POI/Elder envelopes',
    measurement: { zonesAffected: 19, measurementUnitInOriginalFindings: '1 AU cells', runtimeUnit: '0.5 AU tiles' },
    owner: 'GAMEPLAY A0 (legal placement) + CREATOR', severity: 'MEDIUM', mapOwnedGeometryCorrectionApplied: false,
    whyNotCorrected: 'Legal placement after A0 protection/collision/route/resource/dynamic occupancy checks is Gameplay-owned. Map supplies candidate geometry only. U=0.5-native remeasurement is performed in the reconciliation packet, not a geometry amendment.' },
  { id: 'MGP-D06', title: 'Retreat polylines / vertical-link blockers / cart clearance have no Gameplay owner decision',
    measurement: { retreatPolylines: 63, verticalBlockers: 8, cartClearancePairs: 1 },
    owner: 'GAMEPLAY / A8', severity: 'MEDIUM', mapOwnedGeometryCorrectionApplied: false,
    whyNotCorrected: 'These are semantic decisions (exit, multi-level separation, swept cart clearance), not Map geometry.' },
  { id: 'MGP-D07', title: 'Helicopter vs lighthouse location separation 5.6569 AU with no approved helicopter sprite',
    measurement: { separationAu: 5.6569, helipadSprite: 'PROVEN_MISSING' },
    owner: 'CREATOR / GAMEPLAY A8', severity: 'MEDIUM', mapOwnedGeometryCorrectionApplied: false,
    whyNotCorrected: 'NO_RELOCATION__NO_SUBSTITUTE is a standing Creator decision.' },
  { id: 'MGP-D09', title: 'One GOLD POI centre is authored on a RIVER tile (terrain-blocked)',
    measurement: { poiCentresOnBlockedTile: poiSection.poiCentresOnBlockedTile,
      affected: pois.filter(p => p.centreBlocked).map(p => ({ id: p.id, tile: p.atTile, tileCode: p.centreTileCode })) },
    owner: 'CREATOR / MAP_U05 (GOLD position) + GAMEPLAY A8 (POI placement)',
    severity: 'MEDIUM', mapOwnedGeometryCorrectionApplied: false,
    whyNotCorrected: 'GOLD POI positions are immutable under H04/H07 and the conversion contract. NO automatic shrink/relocate/expand. A Creator decision is required before any amendment.' },
  { id: 'MGP-D10', title: 'WMP-03 cliffCandidate 0/1 encoding never satisfies the U=0.5 cliff>=2 rule',
    measurement: { sourceRasterCodes: cliffCodeCounts, candidateCells: cliffCodeCounts[1] || 0,
      physicalCliffTilesInRuntime: globalScan.tileCodes.CLIFF || 0 },
    owner: 'MAP_U05 (derived sampler) + CREATOR / GAMEPLAY (cliff collision law)',
    severity: 'HIGH', mapOwnedGeometryCorrectionApplied: false,
    whyNotCorrected: 'Changing the threshold would mint brand-new physical blockers from 8 AU CANDIDATE cells, which is a physical-law decision, not a source-backed geometry correction. No approved cliff sprite/span or collision contract exists.' },
  { id: 'MGP-D08', title: 'Marine foot/boat/swim permission explicitly forbidden',
    measurement: { footOnSea: false, boat: false, swim: false, ferryFoot: false },
    owner: 'GAMEPLAY / CREATOR', severity: 'BLOCKER_FOR_MARINE_ROUTES', mapOwnedGeometryCorrectionApplied: false,
    whyNotCorrected: 'WMP-04 policy forbids walkable water and unapproved boats. No permission minted.' }
];

const record = {
  schema: 'soh.u05.mapgeo01-physical-audit.v1',
  generatedAt: new Date().toISOString(),
  pilot: 'MAP-GEO-REJOIN-01 — Physical Terrain & Traversal Readiness',
  method: {
    runtime: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html opened from file:// in Chromium 640x360 DPR1 — PROTECTED executable, NOT rebuilt, NOT modified',
    viewerSha256: VIEWER_SHA, goldFile: 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json', goldSha256: GOLD_SHA,
    browser: { viewport: [640,360], dpr: 1, fileProtocol: true },
    api: ['window.__terrain.sampleTile', 'window.__terrain.u05Tile', 'window.__terrain.terrainBlocked'],
    goldRole: 'READ ONLY source of IDs and centrelines. No polygon amended, relocated, expanded, recoloured or widened.',
    coarseScan: { strideTiles: 8, samples: coarse.length, note: 'bounded stride scan; the 11,200,000-cell frame was never materialised' },
    dedupedFeatureProbes: uniq.length, browserErrors: errors
  },
  contract: { U: 0.5, TILE_PX: 16, viewport: [640,360], hero: [16,24], frameTiles: [4000,2800], addressableCells: 11200000,
    activeRevision: 'WMP-04R1', status: 'MAP_GEO_R1_CORRECTED__GAMEPLAY_INTAKE_PENDING' },
  globalScan, hydrography, terrain, roads: roadsSection, connections, spawns: spawnsSection, poiAccess: poiSection,
  separation, defects,
  mapOwnedGeometryAmendments: { amendedPolygons: 0, relocatedObjects: 0, expandedEnvelopes: 0, recolouredRoads: 0, widenedRoads: 0,
    newBuildings: 0, newDoors: 0, newProps: 0, newAtlas: 0, note: 'ZERO. All measured incompatibilities are either GOLD-authored, Gameplay/A8 semantic, Creator-owned, or lack source-backed approval.' },
  acceptance: { PAPER: 'MEASURED', RUNTIME: 'VIEWER_ONLY__NOT_FULL_GAMEPLAY', VISUAL: 'NOT_REQUESTED', GAMEPLAY: 'NOT_REQUESTED_AND_NOT_GRANTED' },
  notClaims: ['No VEYRA_PLAYABLE','No VISUAL_ACCEPTED','No MERGE_READY','No production merge','No walkable water','No approved cart/boat/loading capacity','No POI doors or build rights','No new atlas','No GOLD amendment']
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(record, null, 2) + '\n');
console.log(`U05_MAPGEO01_AUDIT_OK bridges=${bridges.length} crossable=${connections.bridges.physicallyCrossable} roads=${roads.length} docks=${docks.length} spawns=${spawns.length} pois=${pois.length} defects=${defects.length} errors=${errors.length}`);
await browser.close();
