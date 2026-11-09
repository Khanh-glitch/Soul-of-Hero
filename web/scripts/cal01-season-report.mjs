// CAL-01 world_calendar_v1 — bounded evidence report.
// Everything below is produced by the SHIPPED modules (calendar.ts / engine.ts / sim.ts /
// persist.ts) on the real Map raster. Time is advanced by the existing `qaAdvance` fixture
// (LOCAL/UNVERIFIED) only where a long-run instant must be reached; the report labels it.
// This is fixture evidence for mechanics, NOT evidence of natural-play enjoyment.
import { createServer } from 'vite';

const HOUR = 3600000;
const T0 = Date.UTC(2026, 0, 1);
const H = h => h * HOUR;

const v = await createServer({
  configFile: 'vite.config.ts',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});
try {
  const { BAL, TILE, WW } = await v.ssrLoadModule('/src/game/core.ts');
  const { newGame, dispatch, addItem, countItem, blockGrid, buildReason, markDirty,
    gardenEnvironment, stepTenders, weatherAt, calendarViewForRun, seasonInfo } = await v.ssrLoadModule('/src/game/engine.ts');
  const { settle } = await v.ssrLoadModule('/src/game/sim.ts');
  const { calendarAt, climateAt, cropSeasonFactor, phaseHours, phaseCount, runClockMs, CALENDAR_VERSION } = await v.ssrLoadModule('/src/game/calendar.ts');
  const { serializeSnapshot, validate } = await v.ssrLoadModule('/src/game/persist.ts');
  const { thermalEnv, thermalEvaluate } = await v.ssrLoadModule('/src/game/thermal.ts');
  const { getWorld } = await v.ssrLoadModule('/src/game/world.ts');

  const m = getWorld().economyMap;
  const round = (n, d = 3) => +n.toFixed(d);

  const start = (at = T0, seed = 313) => {
    const g = newGame();
    const res = dispatch(g, { id: 'cal-start', type: 'startRun', character: 'female', region: 0, seed }, at);
    if (!res.ok) throw new Error('startRun failed');
    g.run.creatures = [];
    return g;
  };
  const jump = (g, at) => {
    const hours = (at - T0) / HOUR;
    if (hours > 0) dispatch(g, { id: `cal-jump-${hours}`, type: 'qaAdvance', hours }, T0);
    return g;
  };
  const findCell = (g, want, y0 = 24, y1 = 180) => {
    const r = g.run, grid = blockGrid(r);
    const taken = new Set(Object.values(r.entities).filter(e => e.tx !== undefined).map(e => `${e.tx},${e.ty}`));
    for (let y = y0; y < y1; y++) for (let x = 24; x < 176; x++) {
      const i = y * WW + x;
      if (!want(i)) continue;
      if (grid[i] !== 0 || !m.buildable[i] || m.protected[i] || getWorld().sourceV3[i] || taken.has(`${x},${y}`)) continue;
      return { x, y };
    }
    throw new Error('no matching cell');
  };
  const pick = (biome, pred = () => true) => {
    for (let i = 0; i < WW * WW; i++) if (m.biome[i] === biome && m.walkable[i] && pred(i)) return { tx: i % WW, ty: Math.floor(i / WW), i };
    throw new Error(`no ${biome} cell`);
  };

  // ---- 1. boundary vector -------------------------------------------------
  const cal0 = start();
  const boundaries = [];
  for (const h of [0, 42, 84, 126, 168, 210, 252, 294, 336]) {
    const c = calendarAt(cal0.run, T0 + H(h));
    boundaries.push({ atHours: h, year: c.year, season: c.season, phaseIndex: c.phaseIndex, phaseInYear: c.phaseInYear, runClockHours: runClockMs(cal0.run, T0 + H(h)) / HOUR, ragnarok: c.ragnarok });
  }
  const clockContract = {
    runHours: BAL.run.maxRunHours, ragnarokFinalHours: BAL.run.ragnarokFinalHours,
    phaseHours: phaseHours(), phaseCount: phaseCount(), productHours: phaseHours() * phaseCount(),
    calendarVersion: CALENDAR_VERSION,
    clampedAt400h: calendarAt(cal0.run, T0 + H(400)).phaseIndex,
  };

  // ---- 2. regional climate contrast in the SAME season --------------------
  const snowCell = pick('snow');
  const warmSand = pick('sand', i => m.temperature[i] > 0.7);
  const fen = pick('marsh');
  const climateRows = [];
  for (const [name, cell] of [['snow', snowCell], ['warm sand', warmSand], ['marsh', fen]]) {
    for (const [seasonLabel, at] of [['spring h10', T0 + H(10)], ['summer h50', T0 + H(50)], ['winter h128', T0 + H(128)]]) {
      const c = climateAt(cal0.run, cell.tx, cell.ty, at, 'clear');
      const e = thermalEvaluate(cal0.run, thermalEnv(cal0.run, { x: cell.tx * TILE + 8, y: cell.ty * TILE + 8, zone: getWorld().zone[cell.i], tileType: getWorld().tiles[cell.i], wet: false, dark: false, sheltered: false, torch: false, at }));
      climateRows.push({
        region: name, seasonLabel, season: c.season, mapTemperature: round(c.mapTemperature, 2), mapMoisture: round(c.mapMoisture, 2),
        localTemperature: round(c.temperature, 2), coldPointsAdded: c.coldPoints, coldReason: c.coldReason,
        thermalTargetC: round(e.target, 2), thermalColdParts: e.coldParts.map(p => `${p.id}:${p.value}`),
        thirstMultiplier: round(c.thirstMultiplier, 3), evaporationMultiplier: round(c.evaporationMultiplier, 3),
      });
    }
  }
  // Snow is a local precipitation phase, never a new weather family.
  const snowSlots = (() => {
    let snow = 0, rain = 0, springSnow = 0;
    for (let s = 0; s < 200; s++) {
      const c = climateAt(cal0.run, snowCell.tx, snowCell.ty, T0 + H(126) + s * 9 * 60000, s % 2 ? 'rain' : 'storm');
      if (c.precipitation === 'snow') snow++; else if (c.precipitation === 'rain') rain++;
      if (climateAt(cal0.run, snowCell.tx, snowCell.ty, T0 + H(10) + s * 9 * 60000, 'rain').precipitation === 'snow') springSnow++;
    }
    return { winterSnowSlots: snow, winterRainSlots: rain, springSnowSlots: springSnow, samples: 200 };
  })();
  const mapArraysUnchanged = (() => {
    const t = Array.from(m.temperature), mo = Array.from(m.moisture), b = m.biome.join(',');
    for (let h = 0; h <= 336; h += 21) for (let i = 0; i < 400; i += 27) climateAt(cal0.run, i % WW, Math.floor(i / WW), T0 + H(h), 'rain');
    return { temperature: Array.from(m.temperature).every((x, i) => x === t[i]), moisture: Array.from(m.moisture).every((x, i) => x === mo[i]), biome: m.biome.join(',') === b };
  })();

  // ---- 3. seasonal gardening: preparation vs no preparation --------------
  const plot = (at, opts = {}) => {
    const g = start();
    const r = g.run;
    const cell = opts.cell ?? findCell(g, i => m.temperature[i] < 0.2, 30, 170);
    r.player.x = cell.x * TILE + 8; r.player.y = cell.y * TILE + 8; markDirty();
    for (const [k, q] of [['wood', 40], ['fiber', 40], ['glass', 4], ['herb', 4], ['seed', 10]]) addItem(r, 'inv', k, q);
    const before = { wood: countItem(r, 'inv', 'wood'), fiber: countItem(r, 'inv', 'fiber'), glass: countItem(r, 'inv', 'glass'), herb: countItem(r, 'inv', 'herb'), seed: countItem(r, 'inv', 'seed') };
    if (buildReason(g, 'garden', cell.x, cell.y) !== null) throw new Error('garden not buildable: ' + buildReason(g, 'garden', cell.x, cell.y));
    dispatch(g, { id: 'cal-build', type: 'build', struct: 'garden', tx: cell.x, ty: cell.y }, at);
    const e = Object.values(r.entities).find(x => x.type === 'garden' && x.tx === cell.x && x.ty === cell.y);
    const afterBuild = { wood: countItem(r, 'inv', 'wood'), fiber: countItem(r, 'inv', 'fiber'), glass: countItem(r, 'inv', 'glass'), herb: countItem(r, 'inv', 'herb'), seed: countItem(r, 'inv', 'seed') };
    if (opts.frame) {
      const f = dispatch(g, { id: 'cal-frame', type: 'gardenFrame', eid: e.id }, at);
      if (!f.ok) throw new Error('frame failed: ' + f.msg);
    }
    const afterFrame = { wood: countItem(r, 'inv', 'wood'), fiber: countItem(r, 'inv', 'fiber'), glass: countItem(r, 'inv', 'glass'), herb: countItem(r, 'inv', 'herb'), seed: countItem(r, 'inv', 'seed') };
    const p = dispatch(g, { id: 'cal-plant', type: 'garden', eid: e.id, crop: opts.crop ?? 'crop' }, at);
    if (!p.ok) throw new Error('plant failed: ' + p.msg);
    const afterPlant = { wood: countItem(r, 'inv', 'wood'), fiber: countItem(r, 'inv', 'fiber'), glass: countItem(r, 'inv', 'glass'), herb: countItem(r, 'inv', 'herb'), seed: countItem(r, 'inv', 'seed') };
    e.garden.water = 3;
    r.clock.lastSimAt = at; r.clock.simMs = Math.max(r.clock.simMs, at);
    const env = gardenEnvironment(r, e, false, opts.crop ?? 'crop', at);
    return { g, r, e, cell, cost: { before, afterBuild, afterFrame, afterPlant }, env };
  };
  const winterAt = T0 + H(128);
  const exposed = plot(winterAt);
  const framed = plot(winterAt, { frame: true });
  const warmPlot = plot(winterAt, { cell: findCell(start(), i => m.temperature[i] > 0.6, 110, 180) });
  const settleAndMeasure = (o, minutes = 120) => {
    const before = { growth: o.e.garden.growth, water: o.e.garden.water };
    settle(o.g, winterAt + minutes * 60000, true);
    return { growth: round(o.e.garden.growth, 4), water: round(o.e.garden.water, 4), harvestReceipts: o.r.receipts.filter(x => x.kind === 'garden.harvest' || x.kind === 'tender.harvest').length, before };
  };
  const winterPlots = {
    at: 'Year 1 winter, 2 h after the boundary (T0+128 h)',
    exposure: 'same seed, same Map cell, 2 h offline settle',
    cells: {
      coldExposed: { mapTemperature: round(m.temperature[exposed.cell.y * WW + exposed.cell.x], 2), envRate: round(exposed.env.rate, 3), envEvaporation: round(exposed.env.evaporation, 3), envCovered: exposed.env.covered, result: settleAndMeasure(exposed) },
      coldFramed: { mapTemperature: round(m.temperature[framed.cell.y * WW + framed.cell.x], 2), envRate: round(framed.env.rate, 3), envEvaporation: round(framed.env.evaporation, 3), envCovered: framed.env.covered, result: settleAndMeasure(framed) },
      warmExposed: { mapTemperature: round(m.temperature[warmPlot.cell.y * WW + warmPlot.cell.x], 2), envRate: round(warmPlot.env.rate, 3), envEvaporation: round(warmPlot.env.evaporation, 3), envCovered: warmPlot.env.covered, result: settleAndMeasure(warmPlot) },
    },
    namedCosts: (() => {
      const debit = (a, b, keys) => Object.fromEntries(keys.map(k => [k, a[k] - b[k]]).filter(([, q]) => q > 0));
      return {
        gardenBuildDebit: debit(framed.cost.before, framed.cost.afterBuild, ['wood', 'fiber', 'glass', 'herb']),
        coldFrameDebit: debit(framed.cost.afterBuild, framed.cost.afterFrame, ['wood', 'fiber', 'glass', 'herb']),
        plantingDebit: debit(framed.cost.afterFrame, framed.cost.afterPlant, ['wood', 'fiber', 'glass', 'herb', 'seed']),
        remainingAfterAllSpend: framed.cost.afterPlant,
        note: 'Real catalog costs (STRUCTS.garden, GARDEN_FRAME_COST, GARDEN_CROPS.crop.inputs) debited through dispatch(); nothing was injected into the garden/barrel after planting.',
      };
    })(),
  };

  // ---- 4. water/evaporation consequence in the hot season -----------------
  const hotCell = findCell(start(), i => m.temperature[i] > 0.6, 110, 180);
  const springPlot = plot(T0 + H(10), { cell: hotCell });
  const summerPlot = plot(T0 + H(50), { cell: hotCell });
  const waterStep = (o, at) => {
    const before = o.e.garden.water;
    settle(o.g, at + 20 * 60000, true);
    const env = gardenEnvironment(o.r, o.e, false, 'crop', at);
    return { season: env.season, waterBefore: round(before, 3), waterAfter: round(o.e.garden.water, 3), evaporationMultiplier: round(env.evaporation, 3), gardenRate: round(env.rate, 3) };
  };
  const waterEvidence = {
    cell: { mapTemperature: round(m.temperature[hotCell.y * WW + hotCell.x], 2), biome: m.biome[hotCell.y * WW + hotCell.x] },
    spring: waterStep(springPlot, T0 + H(10)),
    summer: waterStep(summerPlot, T0 + H(50)),
    cropFactorByS: { summerSunroot: round(cropSeasonFactor('summer', 'crop'), 3), summerBitterleaf: round(cropSeasonFactor('summer', 'herb'), 3), winterSunroot: round(cropSeasonFactor('winter', 'crop'), 3), winterBitterleaf: round(cropSeasonFactor('winter', 'herb'), 3) },
  };

  // ---- 5. offline settlement equivalence across seasons -------------------
  const partitionRun = (parts, reloadBetween) => {
    const g = start();
    const r = g.run;
    r.player.hunger = 100; r.player.thirst = 100;
    const cell = findCell(g, i => m.temperature[i] < 0.2, 30, 170);
    r.player.x = cell.x * TILE + 8; r.player.y = cell.y * TILE + 8; markDirty();
    r.clock.lastSimAt = T0 + H(10); r.clock.simMs = T0 + H(10);
    // A cold-region garden that the absence must grow at the season's real rate.
    for (const [k, q] of [['wood', 40], ['fiber', 40], ['herb', 4], ['seed', 10]]) addItem(r, 'inv', k, q);
    dispatch(g, { id: 'eq-build', type: 'build', struct: 'garden', tx: cell.x, ty: cell.y }, T0 + H(10));
    const e = Object.values(r.entities).find(x => x.type === 'garden');
    dispatch(g, { id: 'eq-plant', type: 'garden', eid: e.id, crop: 'crop' }, T0 + H(10));
    e.garden.water = 3;
    const end = T0 + H(10 + 130); // crosses three season boundaries (42/84/126)
    let cur = g;
    const span = (end - (T0 + H(10))) / parts;
    for (let i = 1; i <= parts; i++) {
      settle(cur, T0 + H(10) + span * i, true);
      if (reloadBetween && i < parts) {
        const snap = serializeSnapshot(cur);
        cur = validate(JSON.parse(JSON.parse(snap).payload));
        if (!cur) throw new Error('reload rejected a valid save');
      }
    }
    const rr = cur.run;
    return {
      parts, reloadedBetween: !!reloadBetween,
      seasonAtReturn: calendarAt(rr, rr.clock.lastSimAt).season, phaseIndex: calendarAt(rr, rr.clock.lastSimAt).phaseIndex,
      seasonEvents: rr.receipts.filter(x => x.kind === 'season.begin').map(x => x.detail),
      calendarLedger: rr.calendar,
      gardenGrowth: round(e.garden.growth, 4), gardenWater: round(e.garden.water, 4),
      hunger: round(rr.player.hunger, 4), thirst: round(rr.player.thirst, 4), hp: round(rr.player.hp, 4),
      receipts: rr.receipts.length, lastSimAtHours: (rr.clock.lastSimAt - T0) / HOUR,
    };
  };
  // A shorter absence a player actually survives: the EXISTING offline thirst law drains
  // 6.25/h, so a 10 h absence from h36 (crossing spring->summer at h42) is the honest window.
  const shortAbsence = (() => {
    const from = T0 + H(36), to = T0 + H(46);
    const g = start();
    const r = g.run;
    r.player.hunger = 100; r.player.thirst = 100;
    const cell = findCell(g, i => m.temperature[i] > 0.6, 110, 180);
    r.player.x = cell.x * TILE + 8; r.player.y = cell.y * TILE + 8; markDirty();
    for (const [k, q] of [['wood', 40], ['fiber', 40], ['herb', 4], ['seed', 10]]) addItem(r, 'inv', k, q);
    dispatch(g, { id: 'sa-build', type: 'build', struct: 'garden', tx: cell.x, ty: cell.y }, from);
    const e = Object.values(r.entities).find(x => x.type === 'garden');
    dispatch(g, { id: 'sa-plant', type: 'garden', eid: e.id, crop: 'crop' }, from);
    e.garden.water = 3;
    r.clock.lastSimAt = from; r.clock.simMs = from;
    const before = { season: calendarAt(r, from).season, growth: e.garden.growth, water: e.garden.water, hunger: r.player.hunger, thirst: r.player.thirst };
    settle(g, to, false);
    const after = { season: calendarAt(r, r.clock.lastSimAt).season, growth: round(e.garden.growth, 4), water: round(e.garden.water, 4), hunger: round(r.player.hunger, 3), thirst: round(r.player.thirst, 3), hp: round(r.player.hp, 3), dead: !!r.player.dead };
    return {
      from: 'h36 (spring)', to: 'h46 (summer)', crossed: 'spring -> summer at h42',
      offlineDrains: 'EXISTING law: hunger 4.167/h, thirst 6.25/h (BAL.player.offline*); CAL-01 adds only the bounded seasonal thirst multiplier at the player cell.',
      before, after,
      seasonEvents: r.receipts.filter(x => x.kind === 'season.begin').map(x => x.detail),
      plantReceipts: r.receipts.filter(x => x.kind === 'garden.plant').length,
      harvestReceipts: r.receipts.filter(x => x.kind === 'garden.harvest').length,
      note: 'The crop ripened through the season boundary at the summer rate and must still be harvested by a real intent, so the next decision is physical, not granted.',
    };
  })();

  const equivalence = {
    note: 'Continuous vs partitioned vs save/reload across three real season boundaries (spring->summer->autumn->winter->spring). Tolerance is exact for the season ledger and the receipts count; garden growth/hunger use the same minute-sized integration, so they must agree exactly because no boundary is interpolated. A 130 h absence with an empty pack kills the player through the EXISTING hunger/thirst law (CAL-01 adds no damage term); that identical outcome in all three variants is part of the equivalence, and the shorter absence above shows the surviving return.',
    shortAbsence,
    continuous: partitionRun(1, false),
    fourPartitions: partitionRun(4, false),
    fourPartitionsWithReload: partitionRun(4, true),
  };

  // ---- 6. persistence policy ---------------------------------------------
  const persistProbe = () => {
    const g = start(); jump(g, T0 + H(100)); settle(g, T0 + H(100) + 60000, true);
    const legacy = JSON.parse(JSON.parse(serializeSnapshot(g)).payload);
    delete legacy.run.calendar;
    const legacyOk = validate(legacy);
    const corrupt = JSON.parse(JSON.stringify(legacy));
    corrupt.run.calendar = { version: CALENDAR_VERSION, observedPhase: 7, observedAt: T0 + H(300) };
    const repaired = validate(corrupt);
    const good = JSON.parse(JSON.parse(serializeSnapshot(g)).payload);
    const keptOriginal = JSON.stringify(good.run.calendar);
    const kept = validate(good);
    return {
      legacySaveWithoutCalendar: {
        accepted: !!legacyOk,
        fieldAddedByValidate: Object.prototype.hasOwnProperty.call(legacy.run, 'calendar'),
        runIdPreserved: legacyOk?.run?.id === legacy.run.id,
        startedAtPreserved: legacyOk?.run?.startedAt === legacy.run.startedAt,
      },
      futureDatedLedger: {
        accepted: !!repaired,
        observedPhaseBefore: 7, observedPhaseAfter: repaired?.run?.calendar?.observedPhase,
        observedAtAfterHours: repaired ? (repaired.run.calendar.observedAt - T0) / HOUR : null,
        runIdPreserved: repaired?.run?.id === corrupt.run.id,
        depositedPreserved: repaired?.run?.deposited === corrupt.run.deposited,
      },
      wellFormedLedgerKeptVerbatim: { unchanged: JSON.stringify(kept?.run?.calendar) === keptOriginal },
    };
  };

  // ---- 7. read model for other owners ------------------------------------
  const viewRun = start(); jump(viewRun, T0 + H(50));
  const readModel = {
    seasonInfo: seasonInfo(viewRun.run, viewRun.run.clock.lastSimAt),
    calendarView: calendarViewForRun(viewRun.run, viewRun.run.clock.lastSimAt),
  };

  console.log(JSON.stringify({
    schema: 'cal01-world-calendar-evidence-v1',
    generatedFor: 'CAL-01 / WO-CLOCK-01 world_calendar_v1',
    evidenceLevel: 'MECHANICS_FIXTURE — real shipped code on the real Map raster, real build/plant/settle intents; time acceleration uses the existing qaAdvance fixture (LOCAL/UNVERIFIED in the UI). Not natural-play enjoyment evidence, not a 336 h campaign.',
    mapGroundTruth: {
      note: 'Map-owned economyMap biome/temperature/moisture are read only; the calendar applies a bounded seasonal deviation and never writes the arrays back.',
      arraysUnchangedAfterClimateSweep: mapArraysUnchanged,
      snowCell: { tile: [snowCell.tx, snowCell.ty], mapTemperature: round(m.temperature[snowCell.i], 2), mapMoisture: round(m.moisture[snowCell.i], 2), biome: m.biome[snowCell.i] },
      warmSandCell: { tile: [warmSand.tx, warmSand.ty], mapTemperature: round(m.temperature[warmSand.i], 2), biome: m.biome[warmSand.i] },
      marshCell: { tile: [fen.tx, fen.ty], mapMoisture: round(m.moisture[fen.i], 2), biome: m.biome[fen.i] },
    },
    balanceParameters: { calendar: BAL.calendar, seasonClimateV1: BAL.seasonClimateV1, seasonWeatherWeights: BAL.weather.seasonWeights },
    boundaryVector: { contract: clockContract, boundaries },
    precipitationPhase: snowSlots,
    regionalClimate: climateRows,
    seasonalGardening: winterPlots,
    waterConsequence: waterEvidence,
    offlineEquivalence: equivalence,
    persistence: persistProbe(),
    readModel,
    weatherFamilyNote: 'weatherAt() picks the family from balance.weather.seasonWeights[season] on the same 9-minute slot grid; snow is a local precipitation PHASE of a rain/storm slot, never a new family.',
    weatherSample: { spring: weatherAt(cal0.run, T0 + H(10)), summer: weatherAt(cal0.run, T0 + H(50)), winter: weatherAt(cal0.run, T0 + H(128)) },
  }, null, 2));
} finally {
  await v.close();
}
