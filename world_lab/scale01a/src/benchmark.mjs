#!/usr/bin/env node
// MAP-SCALE-01A — reproducible decision-support benchmark.
// Reads: pinned PR44 HEAD, canonical Veyra blob, accepted GEO-01/02 outputs.
// Writes: source-linked machine-readable metrics. Does NOT modify any canon.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GAMEPLAY, REFERENCES, readGameplaySources, deriveConstants, bibleAcceptance, verifyVeyra, ROOT,
} from './lib/sources.mjs';
import {
  loadInputs, featureSizes, makeModel, cartNetwork, footNetwork, roadBends, buildJourneys,
  measureJourneys, resourceSuitability, BIOME_TO_SPEED_KEY, ROUGH_SPEED_KEYS,
} from './lib/geo.mjs';
import { CANDIDATES, buildCandidates } from './lib/scale.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.SCALE01A_OUT ? path.resolve(process.env.SCALE01A_OUT) : path.resolve(HERE, '../output');
fs.mkdirSync(OUT, { recursive: true });
const write = (name, obj) => {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  console.log(`  wrote ${name} (${fs.statSync(p).size} bytes)`);
};
const r4 = v => (v === null || v === undefined || !Number.isFinite(v)) ? null : +v.toFixed(4);

console.log('== MAP-SCALE-01A: source extraction ==');
const S = readGameplaySources();
const C = deriveConstants(S);
const B = bibleAcceptance(S);
const V = verifyVeyra();

const sourceEvidence = {
  authority: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
  status: 'DECISION_SUPPORT_BENCHMARK__NO_APPROVED_SCALE__NO_RUNTIME_MERGE',
  baseCommit: 'c6a900ae39fb05a83058606a80035a34021cd69d (MAP-GEO-02 accepted)',
  task: 'MAP-SCALE-01A — Veyra scale & gameplay-fit benchmark',
  gameplay: {
    pr: GAMEPLAY.pr, headRef: GAMEPLAY.headRef, headCommit: GAMEPLAY.headCommit,
    pinnedOlderCommit: GAMEPLAY.pinnedOlderCommit, headFetchRefspec: GAMEPLAY.headFetchRefspec,
    whyLatestHead: 'PR44 HEAD d80ad1b5 supersedes pinned a956c9e; balance.v1.json, core.ts and sim.ts all differ. All constants below come from HEAD.',
    files: Object.fromEntries(Object.entries(S.files).map(([k, v]) => [k, { bytes: v.bytes, sha256: v.sha256 }])),
    olderFiles: S.older,
    headDiffersFromPinned: Object.fromEntries(Object.entries(S.older).map(([k, v]) => [k, S.files[k].sha256 !== v.sha256])),
  },
  references: { commit: REFERENCES.commit, ref: REFERENCES.ref, files: Object.fromEntries(Object.entries(S.refs).map(([k, v]) => [k, { bytes: v.bytes, sha256: v.sha256 }])) },
  veyraGold: V,
  constants: C,
  bible: B,
};
write('gameplay_sources.v1.json', sourceEvidence);

console.log('== Veyra source measurements ==');
const I = loadInputs();
const F = featureSizes(I);
const M = makeModel(I, C);
const network = cartNetwork(M);
const footNet = footNetwork(M);
const bends = roadBends(I);
const journeys = buildJourneys(I);
const measured = measureJourneys(I, M, journeys, network, footNet);
const suitability = resourceSuitability(I, M);
console.log(`  journeys=${measured.length} routes=${measured.filter(j => j.routeStatus?.startsWith('GEOGRAPHIC')).length} cartNetworkComponents=${network.componentCount} footComponents=${footNet.componentCount} bends=${bends.length}`);

console.log('== scale candidates ==');
const candidates = buildCandidates(C, F, M, bends, network);

// ---- movement model, directly from PR44 balance.v1.json + sim.ts ----
const bal = C.balance;
const SPEED_AU = u => bal.player.speed * u / C.runtime.TILE;
const weightPenalty = cw => Math.max(0.25, 1 - cw / 100 * bal.cart.weightPenaltyPer100);
const LOADS = [
  { id: 'unloaded', cw: 0, limit: bal.cart.maxWeight, note: 'cart present, zero cargo weight' },
  { id: 'loadedMax', cw: bal.cart.maxWeight, limit: bal.cart.maxWeight, note: 'normal cart at maxWeight (legal)' },
  { id: 'freightLoaded', cw: bal.cart.freightMaxWeight, limit: bal.cart.freightMaxWeight, note: 'freight-upgraded cart at freightMaxWeight (legal)' },
];

const timesFor = (j, u) => {
  const sp = SPEED_AU(u);
  const straight = j.straightAu / sp;
  const route = j.effectiveFootAu === null ? null : j.effectiveFootAu / sp;
  const o = {
    u, baseSpeedAuPerSec: r4(sp),
    straightLineTheoreticalSeconds: r4(straight),
    straightLineTheoreticalGameHours: r4(straight / 3600),
    straightLineTheoreticalFractionOfFictionalDay: r4(straight / (bal.dayNight.dayLengthMinutes * 60)),
    geographicRouteSeconds: r4(route),
    geographicRouteGameHours: route === null ? null : r4(route / 3600),
    hungerDrainOnRoute: route === null ? null : r4(bal.player.hungerDrainPerMin * route / 60),
    thirstDrainOnRoute: route === null ? null : r4(bal.player.thirstDrainPerMin * route / 60),
    loadedCartCases: {},
  };
  for (const L of LOADS) {
    const overlimit = L.cw > L.limit ? 0.4 : 1;
    const eff = j.effectiveCartAu === null ? null : j.effectiveCartAu / (sp * weightPenalty(L.cw) * overlimit);
    o.loadedCartCases[L.id] = {
      cw: L.cw, weightPenalty: r4(weightPenalty(L.cw)), overlimitFactor: overlimit,
      seconds: r4(eff), gameHours: eff === null ? null : r4(eff / 3600),
      claim: 'MODELLED_SCENARIO_ON_THE_FOOT_ROUTE__NOT_A_CART_PASSABILITY_CLAIM',
    };
  }
  o.exposureTimeSeconds = null;
  o.exposureTimeStatus = 'NOT_MEASURABLE__REQUIRES_GAMEPLAY_CREATURE_SPAWN_HABITAT_TRACE_AND_HAZARD_SIMULATION';
  return o;
};

const byScaleTimes = {};
for (const u of CANDIDATES) {
  byScaleTimes[u] = measured.map(j => ({ journeyId: j.id, ...timesFor(j, u) }));
}
write('metrics.v1.json', {
  schema: 'soh.map.scale01a.metrics.v1',
  status: 'DIAGNOSTIC__MODELLED_TIMES__NO_APPROVED_SCALE',
  formula: {
    unit: 'real seconds; PR44 run clock is real elapsed ms (HOUR=3600_000), so 1 game hour = 3600 s',
    speedAuPerSec: 'balance.player.speed(72 px/s) * U(au/tile) / TILE(16 px/tile)',
    straightLineTheoreticalSeconds: 'straightAu / speedAuPerSec  [unobstructed neutral terrain, LOWER BOUND]',
    geographicRouteSeconds: 'SUM(stepAu / terrainSpeedMultiplier(cell)) / speedAuPerSec  [raster Dijkstra on accepted GEO-01/02 masks]',
    loadedCartSeconds: 'SUM(stepAu / cartMult(cell)) / (speedAuPerSec * max(0.25, 1 - cw/100*weightPenaltyPer100) * overlimitFactor)',
    cartMult: 'road/bridge/floor=1.36, rough forest/marsh/hill/snow=0.42, otherwise=0.72 (sim.ts); a TRAIL is NEVER a cart road',
    hungerThirst: 'balance.player.hungerDrainPerMin / thirstDrainPerMin * seconds/60  [modelled, no shelter/zone multiplier]',
  },
  terrainClassification: {
    status: 'DOCUMENTED_ASSUMPTION__NOT_APPROVED_GAMEPLAY_MAPPING',
    reason: 'GEO-02 maplab_encoding.v1.json explicitly leaves the 12-code -> 14-string biome mapping open; PR44 SPEED_KEY lookup uses the strings below.',
    biomeCodeToTerrainSpeedKey: BIOME_TO_SPEED_KEY,
    terrainSpeedValues: bal.terrainSpeed,
    cartRoughKeys: ROUGH_SPEED_KEYS,
    roadKeys: 'road/bridge/floor = BAL.terrainSpeed.road/bridge (1.28) for foot; BAL.cart.speedOnRoad (1.36) for cart',
    fordKeys: 'crossingCandidate=3 -> shallow (0.5) EDITOR heuristic; carts cannot ford water',
  },
  loads: LOADS,
  byScale: byScaleTimes,
});

// ---- authored corridor times using the verbatim GEO-01 segment lengths/kinds ----
const corridorTimes = {};
for (const u of CANDIDATES) {
  const sp = SPEED_AU(u);
  corridorTimes[u] = (I.corridor.routes.alternatives ? [I.corridor.routes.primary, ...I.corridor.routes.alternatives] : [I.corridor.routes.primary]).filter(Boolean).map(r => {
    let footEff = 0, cartEff = 0, trailAu = 0, cartRoadAu = 0;
    for (const seg of (r.segments || [])) {
      const isCart = seg.kind === 'cart';
      const footM = bal.terrainSpeed.road;   // all authored roads are road-like in the foot raster
      const cartM = isCart ? bal.cart.speedOnRoad : bal.cart.speedOffRoad; // trail/other = off-road, NOT cart road
      footEff += seg.lengthAu / footM;
      cartEff += seg.lengthAu / cartM;
      if (isCart) cartRoadAu += seg.lengthAu; else trailAu += seg.lengthAu;
    }
    for (const c of (r.connectors || [])) {
      footEff += c.distanceAu / 1; // derived off-road connector, neutral terrain
      cartEff += c.distanceAu / bal.cart.speedOffRoad;
    }
    return {
      routeId: r.id, authoredTotalAu: r.totalDistanceAu, authoredRoadLengthAu: r.authoredRoadLengthAu,
      derivedConnectorLengthAu: r.derivedConnectorLengthAu,
      cartRoadAu: r4(cartRoadAu), trailOrOtherAu: r4(trailAu),
      footSeconds: r4(footEff / sp),
      cartScenarioSeconds: r4(cartEff / sp),
      loadedMaxCartScenarioSeconds: r4(cartEff / (sp * weightPenalty(bal.cart.maxWeight))),
      cartPassable: false,
      note: 'Authored corridor includes trail segments (rd_13/rd_1w/rd_16 are kind=trail). NEVER labelled cart-passable. GEO-02 found one zero-clearance cell and a foot-only bridge on this corridor.',
    };
  });
}

// ---- compact comparison ----
const pick = id => measured.find(j => j.id === id);
const representative = [
  { id: 'sp_lake.starterWater', label: 'Spawn→water (MAP-SPAWN-04)' },
  { id: 'sp_lake.starterToolMaterial', label: 'Spawn→tool material (MAP-SPAWN-04)' },
  { id: 'sp_lake.starterBuildZone', label: 'Spawn→build zone (MAP-SPAWN-04)' },
  { id: 'sp_lake.nearPOI', label: 'Spawn→nearest POI' },
  { id: 'sp_lake.farPOI', label: 'Spawn→farthest POI' },
  { id: 'sp_lake.elderApproach', label: 'Spawn→Elder approach (MAP-U5)' },
  { id: 'log.kilnsToFarWarehouse', label: 'Kilns→far warehouse (MAP-LOG-03)' },
  { id: 'corridor.RT-1', label: 'RT-1 authored corridor (MAP-LOG-03)' },
  { id: 'u4.cacheToHome', label: 'Cash cache→home (MAP-U4)' },
];
const comparisonRows = candidates.map(s => {
  const u = s.u;
  const T = byScaleTimes[u];
  const times = Object.fromEntries(representative.filter(r => pick(r.id)).map(r => {
    const j = pick(r.id), t = T.find(x => x.journeyId === j.id);
    return [r.id, { label: r.label, straightAu: j.straightAu, routeAu: j.routeAu, straightSeconds: t.straightLineTheoreticalSeconds, routeSeconds: t.geographicRouteSeconds, loadedCartMaxSeconds: t.loadedCartCases.loadedMax.seconds }];
  }));
  return {
    u, status: s.status,
    worldTiles: s.worldTiles, cells: s.cells,
    engine: {
      economyCellLimitFits: s.engineLimits.economyValidator.fits,
      exactPackageValidatorFits: s.engineLimits.exactPackageValidator.fits,
      coreFixedGridFits: s.engineLimits.coreFixedGrid.fits,
      renderChunkKeyCollisionFree: s.engineLimits.renderChunkCache.keyCollisionFree,
      seaDistSemanticCoveragePercent: r4(s.engineLimits.seaDistSemantic.fraction * 100),
    },
    memoryMBLowerBound: s.memory.totalMBLowerBound,
    renderChunkCacheUpperBoundMB: s.memory.renderChunkCacheUpperBoundMB,
    screensAcross: s.camera.screensAcross,
    crossWorldWidthSeconds: s.traversal.crossWorldWidthSeconds,
    crossWorldWidthGameHours: s.traversal.crossWorldWidthGameHours,
    crossWorldWidthFractionOfFictionalDay: s.traversal.crossWorldWidthFractionOfFictionalDay,
    crossWorldWidthFractionOf336hRun: r4(s.traversal.crossWorldWidthSeconds / (bal.run.maxRunHours * 3600)),
    crossWorldHungerDrain: r4(bal.player.hungerDrainPerMin * s.traversal.crossWorldWidthSeconds / 60),
    journeyTimes: times,
    spatial: {
      entranceTiles: s.spatial.featureTiles.proposedEntranceWestTiles,
      minPOIAreaTiles: s.spatial.featureTiles.minPOIAreaTiles,
      medianPOIAreaTiles: s.spatial.featureTiles.medianPOIAreaTiles,
      proposedWorkspaceTiles: s.spatial.featureTiles.proposedWorkspaceAreaTiles,
      roadStrokeTiles: s.spatial.featureTiles.roadAnalysisStrokeTiles,
      riverMaskTiles: s.spatial.featureTiles.riverMaskTiles,
      bridgeGlyphTiles: s.spatial.featureTiles.bridgeGlyphTiles,
      poiFeetUnableToHostSmallestRoom: s.spatial.poiFeetUnableToHostSmallestRoom,
      poiFeetUnableToHost5x5Square: s.spatial.poiFeetUnableToHost5x5Square,
      roadBendsUnderOneTile: s.spatial.roadBendsRadiusUnderOneTile,
      failedTests: s.feasibility.failed, hardRejections: s.feasibility.hardRejections,
    },
    veyraPreservation: {
      fullAuthoringGeometryUnchanged: true, authoringSpace: F.authoringSpace,
      canonicalObjects: F.counts, noCropNoWarpNoRescale: true,
      detail: s.authoredRaster.newAuthoredDetail, coast: s.spatial.coastDetailNote,
    },
  };
});
write('comparison.v1.json', {
  schema: 'soh.map.scale01a.comparison.v1',
  status: 'COMPACT_COMPARISON__DIAGNOSTIC_ONLY',
  representativeJourneys: representative,
  rows: comparisonRows,
  authoredCorridorTimesByScale: corridorTimes,
});

// ---- acceptance assessment ----
const allFourSpawns = I.geography.objects.spawns.map(s => s.id);
const spawnCoverage = Object.fromEntries(allFourSpawns.map(id => [id, {
  journeys: measured.filter(j => j.id.startsWith(id + '.')).length,
  withGeographicRoute: measured.filter(j => j.id.startsWith(id + '.') && j.routeStatus?.startsWith('GEOGRAPHIC')).length,
  waterAu: pick(`${id}.starterWater`)?.straightAu ?? null,
  foodAu: pick(`${id}.starterFood`)?.straightAu ?? null,
  toolAu: pick(`${id}.starterToolMaterial`)?.straightAu ?? null,
  buildZoneAu: pick(`${id}.starterBuildZone`)?.straightAu ?? null,
  nearPOIAu: pick(`${id}.nearPOI`)?.straightAu ?? null,
  farPOIAu: pick(`${id}.farPOI`)?.straightAu ?? null,
  elderApproachAu: pick(`${id}.elderApproach`)?.straightAu ?? null,
  cartCorridorAu: pick(`${id}.cartCorridor`)?.straightAu ?? null,
}]));

const acceptance = {
  'K2': {
    status: 'MEASURED_GEOMETRY__GAMEPLAY_RULE_PARTIAL',
    measured: 'Veyra 8 landmasses, 5 lakes, 17 rivers, 12 bridges, 27 docks, 23 zones, 92 roads, 81 POIs, 280 resource annotations, 4 spawns, 6 Elders; 12-code biome raster + 9 au road/river strokes.',
    gameplayRule: 'PR44 terrainSpeed multipliers are pinned and used; the 12-code -> 14-string biome mapping is UNAPPROVED (GEO-02 blocker). Weather/trace/footprint state requires Gameplay simulation.',
    missing: 'approved biome mapping; slope threshold; cart swept-clearance dimension; actual weather/hazard/trace exposure.',
    sourceIds: ['world_lab/geo01/output/geography.v1.json', 'world_lab/geo02/output/maplab_encoding.v1.json', 'web/src/game/balance.v1.json', 'web/src/game/sim.ts'],
  },
  'K3': {
    status: 'SOURCE_ANNOTATIONS_MEASURED__STOCK_NOT_GAMEPLAY_APPROVED',
    measured: `${F.counts.resources} authored resource annotations; per-spawn nearest and within-100/200/300 au counts in output/benchmark.v1.json resourceSuitability.`,
    gameplayRule: 'PR44 SOURCES/catalog.ts define finite stock, HP, regrow and loot; all 280 Veyra annotations remain conf=proposal and have no Gameplay source ID, stock, respawn or legality.',
    missing: 'Gameplay source-ID mapping, stock/respawn policy, harvest legality for each annotated area.',
  },
  'K6': {
    status: 'SPATIAL_FEASIBILITY_MEASURED__NO_HOME_APPROVAL',
    measured: 'per-scale POI foot tiles, entrance tiles, workspace tiles, room capacity, claim radius/min-distance in au; 3 alternative home zones measured from chosen spawn.',
    gameplayRule: 'PR44 buildings 5x4..17x12 tiles, claimRadius=6 tiles, claimMinDistFromPoi=10 tiles, tenderLinkTiles=3, build range 4.6*TILE, near interaction 3 tiles; POI doors/power/loot/retreat are Gameplay-owned states.',
    missing: 'canonical Veyra POIs have NO authored doors/rooms/corridors/workspaces; GEO-02 PROPOSED shell is not canonical and has no validated door/swept clearance. Human 640x360 room test.',
  },
  'K7': {
    status: 'DISTANCES_AND_MODELLED_TIMES_MEASURED__PASSABILITY_NOT_PROVEN',
    measured: `${measured.length} source-linked journeys; ${measured.filter(j => j.routeStatus?.startsWith('GEOGRAPHIC')).length} have straight-line + terrain-weighted raster route + loaded-cart scenario times for U=1/2/4/8, ${measured.filter(j => !j.routeStatus?.startsWith('GEOGRAPHIC')).length} are explicitly UNRESOLVED with no fabricated time; authored RT-1/RT-2/RT-3 corridor times with trail/cart split.`,
    gameplayRule: 'PR44 cart speedOnRoad=1.36 / speedOffRoad=0.72 / speedRough=0.42, weight penalty 0.18 per 100, maxWeight=240 / freight=360, carts cannot ford water, moveBody radii 4/5 px.',
    blockers: [
      `authored cart-road raster has ${network.componentCount} disconnected 8-connected components; largest=${network.largest.cells} cells`,
      'RT-1 contains rd_13 / rd_1w / rd_16 which are kind=trail — NEVER cart-passable',
      'GEO-02 measured po_kilns nearest cart road rd_n at 56.8792 au > ACCESS_R=48, foot trail rd_16 at 0 au; br_a foot-only crossing 0.0342 au; one zero-clearance cell [732,652]',
      'no swept-clearance dimension exists in Veyra source; bridge-to-channel fit UNVERIFIED',
      `${measured.filter(j => !j.routeStatus?.startsWith('GEOGRAPHIC')).length} of ${measured.length} measured ODs have NO connected foot route on the accepted masks: separate landmasses / unbridged channels; Veyra has kind=ferry roads but PR44 HEAD has NO approved ferry or boat rule`,
    ],
    missing: 'Gameplay cart footprint/swept-clearance rule, slope/bridge/water thresholds, continuous cargo road authoring, approved ferry/boat/cargo rule for the 8 landmasses, exposure_time from creature simulation, freight repair/fuel cost.',
  },
  'K8': {
    status: 'RUNTIME_CLOCK_USED__NO_STREAMING_IMPLEMENTATION',
    measured: `run clock = ${bal.run.maxRunHours} h = ${bal.run.maxRunHours * 3600} s (real elapsed ms, HOUR=${C.runtime.HOUR_MS}); Ragnarok final ${bal.run.ragnarokFinalHours} h; fictional day ${bal.dayNight.dayLengthMinutes} min. All modelled times are real seconds and converted to game hours.`,
    gameplayRule: 'phaseOf/dayTime/endRun/weatherAt use runElapsedMs; offline causality is event-driven.',
    missing: 'world-size streaming/LOD and offline simulation for a >40,000-cell world; save size and mapDigest budget; no full-world integration claim.',
  },
  'MAP-SPAWN-04': {
    status: 'GEOMETRY_MEASURED__NO_HUMAN_SURVIVAL_PASS',
    measured: spawnCoverage,
    bibleRequirement: B.ids['MAP-SPAWN-04'].requirement,
    insufficientEvidence: B.ids['MAP-SPAWN-04'].insufficientEvidence,
    missing: '30–60 min blind-novice play without Core, real water/food/tool source IDs, collision and road/offroad choice; "safe dot on a map" is explicitly insufficient.',
  },
  'MAP-HOME-03': {
    status: '3_ALTERNATIVE_ZONES_MEASURED__NO_BUILT_HOUSES',
    measured: ['home.bz_silver', 'home.bz_hook', 'home.bz_ironholm'].map(id => ({ id, straightAu: pick(id)?.straightAu, routeAu: pick(id)?.routeAu })),
    bibleRequirement: B.ids['MAP-HOME-03'].requirement,
    missing: 'three houses actually built by testers, collision/roof/garden/furnace, freight and differing monster-route encounters; buildable % is explicitly insufficient.',
  },
  'MAP-LOG-03': {
    status: 'FOOT_VS_CART_GEOMETRY_MEASURED__CART_ROUTE_INCOMPLETE',
    measured: {
      kilnsToFootTrail: pick('log.kilnsToFootTrail') ? { straightAu: pick('log.kilnsToFootTrail').straightAu, routeAu: pick('log.kilnsToFootTrail').routeAu } : null,
      kilnsToCartRoad: pick('log.kilnsToCartRoad') ? { straightAu: pick('log.kilnsToCartRoad').straightAu, routeAu: pick('log.kilnsToCartRoad').routeAu } : null,
      farWarehouse: pick('log.kilnsToFarWarehouse') ? { straightAu: pick('log.kilnsToFarWarehouse').straightAu, routeAu: pick('log.kilnsToFarWarehouse').routeAu } : null,
      geo02KilnsCartGapAu: 56.8792, geo02FootGapAu: 0,
    },
    bibleRequirement: B.ids['MAP-LOG-03'].requirement,
    missing: 'real item/collision/cart instance, a continuous physically verified cargo route, weather/enemy-driven route change; no incomplete trail may be labelled cart-passable.',
  },
  'MAP-U4': {
    status: 'CASH_ROUTE_DISTANCES_MEASURED__SELLER_ROUTE_PROPOSED_ONLY',
    measured: ['u4.vendorToCache', 'u4.cacheToHome', 'u4.homeToEvac'].map(id => ({ id, straightAu: pick(id)?.straightAu, routeAu: pick(id)?.routeAu })),
    bibleRequirement: B.ids['MAP-U4'].requirement,
    missing: 'Bible §5.4 explicitly leaves price, stock, seller, distance, land rights, number of trips and route optimality unfixed; physical cash→purchase→claim→deposit run with real items.',
  },
  'MAP-U5': {
    status: '6_DISTINCT_ELDER_APPROACHES_MEASURED',
    measured: I.geography.objects.elders.map(e => ({ id: e.id, elder: e.elder, approachPoints: (e.approach || []).length, pois: e.pois, fromChosenSpawnAu: pick(`u5.${e.id}`)?.straightAu ?? null })),
    bibleRequirement: B.ids['MAP-U5'].requirement,
    missing: 'pre/post-awakening physical regions with distinct sources, one verified no-boss retreat, six Elder sprites/AI beyond the Web prototype; symmetric coloured zones are explicitly insufficient.',
  },
};

// ---- verdict ----
const eligible = candidates.filter(s => s.feasibility.hardRejections.length === 0);
const shortlist = eligible.map(s => s.u);
const rejected = candidates.filter(s => !shortlist.includes(s.u)).map(s => ({ u: s.u, reasons: [...new Set([...s.feasibility.hardRejections, ...s.feasibility.failed])] }));

const recommendation = {
  status: 'BOUNDED_SHORTLIST__NO_APPROVED_FINAL_SCALE',
  creatorRule: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
  shortlist,
  rejected,
  allCandidatesFailExactRuntimeValidator: candidates.every(s => !s.engineLimits.exactPackageValidator.fits),
  decision: shortlist.length === 1
    ? `U=${shortlist[0]} authoring units per runtime tile is the only diagnostic candidate that keeps entrances, rooms, workspaces, roads, rivers and bridges physically representable while staying inside the 1,000,000-cell economy validator. It is NOT approved: PR44 core.ts (WW=WH=200), validateRuntimeMapPackage() (exact 200x200 @16), render.ts chunk key stride, seaDist BFS stop and the absent streaming implementation must all be changed and re-tested before any full-world intake.`
    : 'No single candidate is defensible without further Gameplay parameters; see shortlist and missingRules.',
  notChosenBecause: 'No scale was chosen for convenient integer dimensions, for matching the 40,000-cell runtime, or for attractive traversal times alone. U=8 exactly reproduces the 250x175 source raster / ~43,750 cells but destroys entrances, interiors and bridge detail.',
  missingForApprovedFinalScale: [
    { id: 'GAMEPLAY_BIOME_MAPPING', what: 'approved 12 Veyra/MapLab biome codes -> 14-string PR44 Biome enum mapping (GEO-02 remaining blocker) + verified grid transform.', why: 'terrain-weighted times and compileEconomy() legality depend on it.' },
    { id: 'SWEPT_CLEARANCE', what: 'Gameplay player/cart collision envelope and swept-clearance test for every authored road, door opening, bridge deck, shoreline and road bend.', why: 'GEO-02 found a zero-clearance cell, a foot-only bridge and no swept-clearance dimension in source.' },
    { id: 'CART_PASSABILITY_RULES', what: 'slope threshold, bridge load/width rule, water/ford/ice rule, repair/fuel/opportunity cost and continuous cargo-road graph.', why: 'RT-1 has trail segments; cart-road raster is fragmented; no trail may be labelled cart-passable.' },
    { id: 'EXPOSURE_SIMULATION', what: 'creature spawn/habitat/trace/hazard simulation to measure exposure_time, footprint_monster_intersections and retreat_success.', why: 'Bible §C13/K7 require route risk, not only route distance.' },
    { id: 'FERRY_RULE', what: 'Gameplay-approved ferry/boat/cargo traversal rule for the 8 Veyra landmasses and the authored kind=ferry roads.', why: 'several far POI / Elder / build-zone journeys have no connected foot route on the accepted land/water/bridge masks; no fabricated crossing time may be supplied.' },
    { id: 'RUNTIME_WORLD_SIZE', what: 'engine change for WW/WH, exact validator, render chunk key, seaDist BFS, streaming/LOD, save/mapDigest memory budget for the chosen U.', why: 'all four candidates fail validateRuntimeMapPackage() and core.ts fixed 40,000-cell grid.' },
    { id: 'ECONOMY_ROUTE_APPROVAL', what: 'MAP-U4 seller, chest price/stock, land-rights and number of trips; MAP-LOG-03 far-warehouse value increase; MAP-HOME-03 three built houses.', why: 'Bible explicitly leaves these unfixed; "map dots" are insufficient evidence.' },
    { id: 'HUMAN_640x360', what: 'pixel inspection at 640x360 1x of road, wall, footprint, door, hazard, character and workspace at the chosen U.', why: 'MAP-CAMERA and MAP-HOME-03 are human acceptance tests.' },
  ],
};

const doc = {
  schema: 'soh.map.scale01a.benchmark.v1',
  generatedBy: 'world_lab/scale01a/src/benchmark.mjs',
  status: 'DECISION_SUPPORT_BENCHMARK__NOT_A_PLAYABLE_FULL_WORLD_INTEGRATION',
  authority: sourceEvidence.authority,
  noClaims: [
    'NO approved world scale', 'NO canonical Veyra edit', 'NO runtime merge or Gameplay population',
    'NO new POIs', 'NO environment-art experiment', 'NO fabricated travel time', 'NO invented collision/passability rule',
    'NO incomplete trail labelled cart-passable', 'NO survivability or human acceptance claim',
  ],
  sourceEvidence: {
    gameplayHead: sourceEvidence.gameplay, veyraGold: V,
    geo01: I.fingerprints.geography, geo01Corridor: I.fingerprints.corridor,
    geo02Encoding: I.fingerprints.encoding, geo02Audit: I.fingerprints.audit, geo02Proposed: I.fingerprints.proposed,
    geo01RasterManifest: I.fingerprints.rasterManifest, geo02RasterManifest: I.fingerprints.maplabRasterManifest,
  },
  frame: {
    authoringSpaceAu: F.authoringSpace, sourceGrid: F.sourceGrid, transform: F.transform,
    rule: 'Full 2000x1400 authoring geometry is UNCHANGED for every candidate. No rescale, crop, pad or warp of the canonical source.',
  },
  measured: {
    sourceCounts: F.counts, featureSizes: F,
    biomeAssumption: { biomeCodeToTerrainSpeedKey: BIOME_TO_SPEED_KEY, status: 'DOCUMENTED_ASSUMPTION__NOT_APPROVED_GAMEPLAY_MAPPING' },
    cartNetwork: { componentCount: network.componentCount, largest: network.largest, top: network.top },
    footConnectivity: {
      passableCellComponents: footNet.componentCount, largest: footNet.largest, top: footNet.top,
      journeysWithoutGeographicRoute: measured.filter(j => !j.routeStatus?.startsWith('GEOGRAPHIC')).map(j => ({ id: j.id, straightAu: j.straightAu, status: j.routeStatus, fromFootComponent: j.fromFootComponent, toFootComponent: j.toFootComponent })),
      note: 'GEO-01 records 8 landmasses, 12 bridges and kind=ferry roads. Where the accepted land/water/bridge masks do not connect two endpoints, this benchmark reports UNRESOLVED and supplies NO travel time. No Gameplay ferry/boat/cargo rule is approved in PR44 HEAD.',
    },
    roadBends: { measured: bends.length, minRadiusAu: bends.reduce((a, b) => b.radiusAu !== null ? Math.min(a, b.radiusAu) : a, Infinity), source: 'GEO-02 verbatim catmull()+resample() at 8 au' },
    resourceSuitability: suitability,
    spawnCoverage,
  },
  journeys: measured,
  authoredCorridors: (I.corridor.routes.alternatives ? [I.corridor.routes.primary, ...I.corridor.routes.alternatives] : [I.corridor.routes.primary]).filter(Boolean).map(r => ({ id: r.id, totalDistanceAu: r.totalDistanceAu, authoredRoadLengthAu: r.authoredRoadLengthAu, derivedConnectorLengthAu: r.derivedConnectorLengthAu, sourceIds: r.sourceIds, segmentKinds: (r.segments || []).map(s => ({ roadId: s.roadId, kind: s.kind, lengthAu: s.lengthAu })) })),
  candidates,
  acceptance,
  assumptions: [
    'U is defined as authoring units per ONE runtime tile of TILE=16 px; 1 au = 16/U px and base speed = 72*U/16 au/s.',
    'PR44 run clock is real elapsed milliseconds (HOUR=3600_000); modelled seconds are real seconds and 1 game hour = 3600 s. The 24-minute day/night clock is separate and fictional.',
    '12 MapLab biome codes are mapped to PR44 terrainSpeed keys by documented assumption; GEO-02 explicitly says this mapping is NOT approved.',
    'Raster Dijkstra uses the accepted GEO-01/02 8-au land/water/road/bridge masks. It is a geographic route estimate, NOT a Gameplay collision or swept-clearance verdict.',
    'Road/bridge/river widths used as scale probes are EDITOR analysis strokes / display glyphs, NOT authored physical dimensions.',
    'Memory figures are lower-bound byte models from PR44 array declarations; no streaming/LOD loader exists in PR44 HEAD.',
    'The 3.696 au west entrance and 57.4232 au² workspace come from the GEO-02 PROPOSED po_kilns shell and are NOT canonical Veyra geometry.',
    'Loaded-cart cases are modelled on the SAME geographic foot route with the PR44 cart speed/weight profile; they are not cart-passability claims.',
  ],
  missingRules: recommendation.missingForApprovedFinalScale,
  recommendation,
};
write('benchmark.v1.json', doc);

console.log(`SCALE01A_OK candidates=${candidates.length} journeys=${measured.length} shortlist=[${shortlist.join(',')}] eligible=${eligible.length}`);
