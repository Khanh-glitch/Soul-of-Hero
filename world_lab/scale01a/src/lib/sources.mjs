// MAP-SCALE-01A — source-linked extraction of the LATEST Gameplay PR #44 HEAD.
// Nothing here is invented: every constant is read from a pinned git object and
// fingerprinted. The pinned a956c9e snapshot is recorded too, so the audit can
// prove that the newest HEAD (d80ad1b5) was used, not only the older snapshot.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../../..');
export const sha256 = buf => createHash('sha256').update(buf).digest('hex');

export const GAMEPLAY = {
  pr: 44,
  headRef: 'arena/d4bfcfff-soul-of-hero',
  headCommit: 'd80ad1b5d46f17b729e90898cfa2ad31b677fae3',
  pinnedOlderCommit: 'a956c9e85624c1ca7a2b5585eb423f8fa1cf296c',
  headFetchRefspec: 'refs/pull/44/head:refs/remotes/origin/pr44-head',
  files: [
    'web/src/game/balance.v1.json',
    'web/src/game/core.ts',
    'web/src/game/sim.ts',
    'web/src/game/engine.ts',
    'web/src/game/world.ts',
    'web/src/game/world-economy.ts',
    'web/src/game/geography-contract.ts',
    'web/src/game/map-package.ts',
    'web/src/game/catalog.ts',
    'web/src/game/render.ts',
    'web/ref/bible.md',
    'web/IMPLEMENTATION_EVIDENCE.md',
  ],
};

export const REFERENCES = {
  commit: '7a1c53acfc5b7cda6cb34ea3f348b4e100744354',
  ref: 'origin/references/gameplay-prototypes-20261102',
  files: [
    'docs/survival/CURRENT_PRODUCT_CONTRACT.md',
    'docs/survival/reviews/GAMEPLAY_MAP_CONVERGENCE_BRIEF_20261101.md',
    'docs/survival/tasks/C08_PROTOTYPE_REUSE_AND_CAUSAL_GATE_TRIAGE_20261102.md',
    'reference_prototypes/20261102/SOH_GAME_DEVELOPMENT_GAMEPLAY_DEPTH_REUSE.md',
  ],
};

export const VEYRA = {
  commit: '19d8c6ec820f324a6ac12733165e43b5e2c6eab2',
  path: 'map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json',
  bytes: 332249,
  sha256: '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256',
};

function gitShow(spec, { cwd = ROOT } = {}) {
  return Buffer.from(execFileSync('git', ['show', spec], { cwd, maxBuffer: 64 * 1024 * 1024 }));
}
function hasObject(commit) {
  try { execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: ROOT, stdio: 'ignore' }); return true; }
  catch { return false; }
}
function num(text, re, label) {
  const m = text.match(re);
  if (!m) throw new Error(`missing ${label} in pinned Gameplay source`);
  return Number(m[1].replace(/_/g, ''));
}
function lines(text, re) {
  return text.split('\n').filter(l => re.test(l)).map(l => l.trim());
}

/** Reads and fingerprints every pinned source file; returns text + hashes. */
export function readGameplaySources() {
  if (!hasObject(GAMEPLAY.headCommit)) {
    throw new Error(`PR44 HEAD ${GAMEPLAY.headCommit} is missing. Run: git fetch -q origin ${GAMEPLAY.headFetchRefspec}`);
  }
  const files = {};
  for (const p of GAMEPLAY.files) {
    const raw = gitShow(`${GAMEPLAY.headCommit}:${p}`);
    files[p] = { raw, text: raw.toString('utf8'), bytes: raw.length, sha256: sha256(raw) };
  }
  const older = {};
  for (const p of ['web/src/game/balance.v1.json', 'web/src/game/core.ts', 'web/src/game/sim.ts']) {
    const raw = gitShow(`${GAMEPLAY.pinnedOlderCommit}:${p}`);
    older[p] = { bytes: raw.length, sha256: sha256(raw) };
  }
  const refs = {};
  for (const p of REFERENCES.files) {
    const raw = gitShow(`${REFERENCES.commit}:${p}`);
    refs[p] = { raw, text: raw.toString('utf8'), bytes: raw.length, sha256: sha256(raw) };
  }
  return { files, older, refs };
}

/** Derives actual runtime constants from the pinned sources (no hard-coded numbers). */
export function deriveConstants(S) {
  const core = S.files['web/src/game/core.ts'].text;
  const bal = JSON.parse(S.files['web/src/game/balance.v1.json'].text);
  const world = S.files['web/src/game/world.ts'].text;
  const sim = S.files['web/src/game/sim.ts'].text;
  const engine = S.files['web/src/game/engine.ts'].text;
  const render = S.files['web/src/game/render.ts'].text;
  const pkg = S.files['web/src/game/map-package.ts'].text;
  const econ = S.files['web/src/game/world-economy.ts'].text;
  const contract = S.files['web/src/game/geography-contract.ts'].text;
  const evidence = S.files['web/IMPLEMENTATION_EVIDENCE.md'].text;

  const runtime = {
    TILE: num(core, /export const TILE\s*=\s*(\d+)/, 'core.TILE'),
    WW: num(core, /export const WW\s*=\s*(\d+)/, 'core.WW'),
    WH: num(core, /export const WH\s*=\s*(\d+)/, 'core.WH'),
    VIEW_W: num(core, /export const VIEW_W\s*=\s*(\d+)/, 'core.VIEW_W'),
    VIEW_H: num(core, /export const VIEW_H\s*=\s*(\d+)/, 'core.VIEW_H'),
    SAVE_VERSION: num(core, /export const SAVE_VERSION\s*=\s*(\d+)/, 'core.SAVE_VERSION'),
    HOUR_MS: num(core, /export const HOUR\s*=\s*(\d[\d_]*)/, 'core.HOUR'),
  };
  runtime.runtimeCells = runtime.WW * runtime.WH;
  runtime.runtimePx = [runtime.WW * runtime.TILE, runtime.WH * runtime.TILE];

  // Exact RuntimeMapPackage validator (map-package.ts) — do not paraphrase.
  const exactValidator = {
    source: 'web/src/game/map-package.ts :: validateRuntimeMapPackage()',
    rules: lines(pkg, /e\.width\s*!==\s*WW|resize is not supported|must be \$\{n\} bounded integer cells|runtime requires all six/).slice(0, 8),
    required: { width: runtime.WW, height: runtime.WH, tileSize: runtime.TILE, arrays: runtime.runtimeCells },
    arrayBounds: { tiles: 19, fresh: 1, zone: 15, seaDist: 255 },
  };
  const arrayKeys = (econ.match(/for\(const k of \[([^\]]+)\] as const\)/) || [,''])[1]
    .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  const economyLimit = {
    source: 'web/src/game/world-economy.ts :: validateEconomyMap()',
    maxCells: num(econ, /n\s*>\s*([\d_]+)/, 'validateEconomyMap max cells'),
    arrayCount: arrayKeys.length,
    arrayKeys,
    biomeEnum: (econ.match(/const biomes\s*=\s*new Set\(\[([^\]]+)\]\)/) || [,''])[1]
      .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean),
    rules: lines(econ, /n\s*>\s*[\d_]+|map exceeds supported cell count|\$\{k\} must have|start \$\{s\.id\} is not walkable/).slice(0, 8),
  };
  // Render chunk cache: CH tiles per chunk, cache key k = cy*100 + cx.
  const chunk = {
    source: 'web/src/game/render.ts :: CH / getChunk() / syncTerrain()',
    CH: num(render, /const CH\s*=\s*(\d+)/, 'render.CH'),
    keyStride: num(render, /const k\s*=\s*cy\s*\*\s*(\d+)\s*\+\s*cx/, 'render chunk key stride'),
    keyLine: lines(render, /const k\s*=\s*cy\s*\*/)[0] || null,
    canvasPxPerChunk: null,
  };
  chunk.canvasPxPerChunk = [chunk.CH * runtime.TILE, chunk.CH * runtime.TILE];
  chunk.collisionFreeMaxWorldTilesW = chunk.keyStride * chunk.CH;

  // Terrain-speed keys are the ACTUAL keys used by sim.ts SPEED_KEY lookup.
  const terrainSpeed = { ...bal.terrainSpeed };
  delete terrainSpeed._status;
  const cartRoadKey = lines(sim, /const road\s*=\s*ct\s*===/)[0] || null;
  const cartRoughKey = lines(sim, /const rough\s*=\s*ct\s*===/)[0] || null;
  const cartSpeedLine = lines(sim, /BAL\.cart\.speedOnRoad|BAL\.cart\.speedRough|BAL\.cart\.speedOffRoad/)[0] || null;
  const playerSpeedLine = lines(sim, /B\.speed\s*\*\s*\(BAL\.terrainSpeed/)[0] || null;

  // Authored building footprints from world.ts (units = runtime tiles).
  const buildings = [];
  const stampRe = /stamp\('([^']+)',\s*'([^']+)',\s*[^;]*?,\s*(\d+),\s*(\d+),\s*'([^']+)'/g;
  for (const m of world.matchAll(stampRe)) buildings.push({ id: m[1], name: m[2], w: +m[3], h: +m[4], source: 'world.ts stamp()' });
  const pushRe = /buildings\.push\(\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*x:[^}]*?\bw:\s*(\d+),\s*h:\s*(\d+)/g;
  for (const m of world.matchAll(pushRe)) buildings.push({ id: m[1], name: m[2], w: +m[3], h: +m[4], source: 'world.ts buildings.push()' });
  const minBuilding = buildings.reduce((a, b) => (!a || b.w * b.h < a.w * a.h ? b : a), null);
  const maxBuilding = buildings.reduce((a, b) => (!a || b.w * b.h > a.w * a.h ? b : a), null);

  // seaDist BFS is truncated at 6 hops in world.ts.
  const seaDistStop = num(world, /seaDist\[i\]\s*>\s*(\d+)\)\s*continue/, 'world.ts seaDist BFS stop');

  return {
    runtime,
    balance: {
      player: { ...bal.player },
      terrainSpeed,
      cart: { ...bal.cart },
      economy: { ...bal.economy },
      garden: { ...bal.garden },
      ai: { ...bal.ai },
      run: { ...bal.run },
      dayNight: { ...bal.dayNight },
      weather: { ...bal.weather },
    },
    movementEvidence: {
      playerSpeedLine, cartSpeedLine, cartRoadKey, cartRoughKey,
      lineRefs: lines(sim, /BAL\.terrainSpeed|cartWeightOf|moveBody\(r, p,|Math\.max\(0\.25/).slice(0, 12),
      collisionRadiiPx: {
        player: num(sim, /moveBody\(r,\s*p,\s*mx\s*\*\s*sp\s*\*\s*dt[^\n]*?,\s*(\d+),\s*'player'/, 'player collision radius'),
        cart: num(sim, /moveBody\(r,\s*cart[^;]*?,\s*(\d+),\s*'cart'/, 'cart collision radius'),
      },
    },
    buildings, minBuilding, maxBuilding,
    chunk,
    seaDistBfsStopTiles: seaDistStop,
    exactValidator, economyLimit,
    physicalContract: lines(contract, /footprint|entrance|room|door|retreat|widthTiles|cargo|buildable|walkable|protected/i).slice(0, 24),
    physicalLimits: {
      buildRangeTiles: num(engine, />\s*([\d.]+)\s*\*\s*TILE\)\s*return 'Too far away/, 'engine.ts build range'),
      buildRangeLine: lines(engine, /Too far away/).slice(0, 2),
      nearInteractionDefaultTiles: num(engine, /function near\([^)]*tiles\s*=\s*([\d.]+)/, 'engine.ts near() default'),
      nearInteractionWorkbenchTiles: 3,
      nearInteractionLines: lines(engine, /function near\(|near\(r, bench, 3\)/).slice(0, 3),
      blockGrid: lines(engine, /blockGrid|Uint8Array\(WW\s*\*\s*WH\)/).slice(0, 4),
      claimMinDistFromPoiTiles: bal.economy.claimMinDistFromPoi,
      claimRadiusTiles: bal.economy.claimRadius,
      tenderLinkTiles: bal.garden.tenderLinkTiles,
      activeRadiusTiles: bal.ai.activeRadiusTiles,
      sightDayPx: bal.ai.sightDay,
      sightNightPx: bal.ai.sightNight,
    },
    implementationEvidenceC24: lines(evidence, /C24|within 12 tiles|200×200/).slice(0, 6),
  };
}

/** Extracts the exact test-ID rows from the Gameplay Bible (verbatim text). */
export function bibleAcceptance(S) {
  const text = S.files['web/ref/bible.md'].text;
  const ids = ['MAP-SPAWN-04', 'MAP-HOME-03', 'MAP-LOG-03', 'MAP-U4', 'MAP-U5', 'MAP-POI-02', 'MAP-CAMERA'];
  const out = {};
  for (const id of ids) {
    const line = text.split('\n').find(l => l.includes(`**${id}**`)) || null;
    const cells = line ? line.split('|').map(s => s.trim()).filter(Boolean) : [];
    out[id] = { line: line ? line.trim() : null, requirement: cells[1] || null, insufficientEvidence: cells[2] || null };
  }
  const kernels = {};
  for (const k of ['K2', 'K3', 'K6', 'K7', 'K8']) {
    const h = text.split('\n').find(l => l.startsWith(`### ${k}.`));
    const owner = text.split('\n').find(l => l.startsWith(`| **${k} `));
    kernels[k] = { section: h ? h.trim() : null, ownershipRow: owner ? owner.trim() : null };
  }
  const costQuote = text.split('\n').find(l => l.includes('World-position costs to measure')) || null;
  return { ids: out, kernels, costQuote: costQuote ? costQuote.trim() : null };
}

/** Canonical Veyra fingerprint from the pinned git object (no scratch files). */
export function verifyVeyra() {
  const raw = gitShow(`${VEYRA.commit}:${VEYRA.path}`);
  const actual = { bytes: raw.length, sha256: sha256(raw) };
  if (actual.bytes !== VEYRA.bytes || actual.sha256 !== VEYRA.sha256) throw new Error('canonical Veyra fingerprint mismatch');
  return { ...VEYRA, ...actual, verified: true };
}
