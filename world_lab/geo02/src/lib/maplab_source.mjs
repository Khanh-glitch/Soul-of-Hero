// MAP-GEO-02: pinned, hash-verified reference source for Veyra's encoding.
//
// The Veyra GOLD .sohmap.json embeds two base64 Uint8Arrays but no legend, no
// unit declaration and no width semantics. The Map Lab Studio v3 source that
// WROTE those arrays is the input package on branch
// input/greywater-poi-pilot-20261102. Verbatim copies of the eight relevant
// files live in ../source_excerpt with SHA256SUMS. This module reads those
// files, verifies every hash, and PARSES the constants out of the source text
// (it never infers a biome meaning from a colour or from appearance).
//
// Nothing here generates Gameplay values, climate, loot, locks or power.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';

export const EXCERPT_DIR = path.resolve(new URL('../../source_excerpt', import.meta.url).pathname);
export const REPO_ROOT = path.resolve(new URL('../../../..', import.meta.url).pathname);

export const INPUT_BRANCH = {
  ref: 'origin/input/greywater-poi-pilot-20261102',
  commit: '0602b59af626d96fc2f76351cdf95ad66863f66e',
  outerZip: 'SOH_Greywater_POI_Agent_Input_v1.zip',
  outerZipSha256: '4fbf68d10d3627de15aada1bb324649a6232aea3eceb84cb1911728fbc606bb8',
  innerZip: '02_map_studio_v3.zip',
  innerZipSha256: '887a389cc4da3d50377ebc3ff5c6327651794d84acbcb8b14de0215329ab464e',
  html: 'public/downloads/SoulOfHero_MapLab.html',
  htmlSha256: '8f69d9fae7163dc9fb7c8c8eb62ac0eaf9e773012ad69650676e3deabcc9b990',
  defaultSeed: '04_map_studio_default_seed.sohmap.json',
  defaultSeedSha256: 'f39847a15d2a9bec9eddb4d027acabc92009025a19b6f26b5736b69f23fdaf4d',
};

export const sha256 = b => createHash('sha256').update(b).digest('hex');
const need = (v, what) => { if (!v) throw new Error(`MapLab reference source: cannot resolve ${what}`); return v; };
const num = (text, re, what) => need(text.match(re), what)[1] * 1;

/** Verify each pinned excerpt against SHA256SUMS, return the file texts. */
export function readExcerpts() {
  const sums = fs.readFileSync(path.join(EXCERPT_DIR, 'SHA256SUMS'), 'utf8').trim().split('\n').map(l => l.trim().split(/\s+/));
  const files = {};
  const verification = {};
  for (const [sha, name] of sums) {
    const p = path.join(EXCERPT_DIR, name);
    const buf = fs.readFileSync(p);
    const actual = sha256(buf);
    verification[name] = { expectedSha256: sha, actualSha256: actual, verified: actual === sha ? 'MATCH' : 'MISMATCH' };
    if (actual !== sha) throw new Error(`source_excerpt/${name} hash MISMATCH`);
    files[name] = buf.toString('utf8');
  }
  return { files, verification };
}

/** Optional end-to-end custody check: git blob -> outer ZIP -> inner ZIP -> source files. */
export function verifyZipChain() {
  const res = { status: 'NOT_AVAILABLE_LOCALLY', checks: {} };
  let outer, inner;
  try {
    outer = Buffer.from(execFileSync('git', ['show', `${INPUT_BRANCH.commit}:${INPUT_BRANCH.outerZip}`],
      { cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 }));
  } catch { res.checks.gitBlob = 'NOT_AVAILABLE'; return res; }
  res.checks.gitBlob = 'READ';
  res.checks.outerZipSha256 = sha256(outer);
  res.checks.outerZipVerified = res.checks.outerZipSha256 === INPUT_BRANCH.outerZipSha256 ? 'MATCH' : 'MISMATCH';
  if (res.checks.outerZipVerified !== 'MATCH') { res.status = 'MISMATCH'; return res; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'soh-geo02-'));
  try {
    const op = path.join(tmp, 'outer.zip');
    fs.writeFileSync(op, outer);
    inner = Buffer.from(execFileSync('unzip', ['-p', op, INPUT_BRANCH.innerZip], { maxBuffer: 64 * 1024 * 1024 }));
    const sumsText = execFileSync('unzip', ['-p', op, 'INPUT_SHA256.txt'], { maxBuffer: 1024 * 1024 }).toString('utf8');
    let sumsOk = true, entries = 0;
    for (const line of sumsText.trim().split('\n')) {
      const m = line.trim().match(/^([0-9a-f]{64})\s+(.+)$/);
      if (!m) continue;
      entries++;
      const f = Buffer.from(execFileSync('unzip', ['-p', op, m[2]], { maxBuffer: 64 * 1024 * 1024 }));
      if (sha256(f) !== m[1]) sumsOk = false;
    }
    res.checks.inputSha256Entries = entries;
    res.checks.inputSha256EntriesVerified = entries === 4 && sumsOk ? 'MATCH' : 'MISMATCH';
    res.checks.innerZipSha256 = sha256(inner);
    res.checks.innerZipVerified = res.checks.innerZipSha256 === INPUT_BRANCH.innerZipSha256 ? 'MATCH' : 'MISMATCH';
    const ip = path.join(tmp, 'inner.zip');
    fs.writeFileSync(ip, inner);
    const html = Buffer.from(execFileSync('unzip', ['-p', ip, INPUT_BRANCH.html], { maxBuffer: 8 * 1024 * 1024 }));
    res.checks.htmlSha256 = sha256(html);
    res.checks.htmlVerified = res.checks.htmlSha256 === INPUT_BRANCH.htmlSha256 ? 'MATCH' : 'MISMATCH';
    const seed = Buffer.from(execFileSync('unzip', ['-p', op, INPUT_BRANCH.defaultSeed], { maxBuffer: 8 * 1024 * 1024 }));
    res.checks.defaultSeedSha256 = sha256(seed);
    res.checks.defaultSeedVerified = res.checks.defaultSeedSha256 === INPUT_BRANCH.defaultSeedSha256 ? 'MATCH' : 'MISMATCH';
    const canon = Buffer.from(execFileSync('git', ['show',
      '19d8c6ec820f324a6ac12733165e43b5e2c6eab2:map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json'],
      { cwd: REPO_ROOT, maxBuffer: 32 * 1024 * 1024 }));
    const a = JSON.parse(canon.toString('utf8')).project.terrain;
    const b = JSON.parse(seed.toString('utf8')).project.terrain;
    res.checks.defaultSeedTerrainEqualsVeyraTerrain =
      a.gw === b.gw && a.gh === b.gh && a.cell === b.cell && a.seed === b.seed &&
      a.elev === b.elev && a.biome === b.biome ? 'MATCH' : 'MISMATCH';
    const sums = fs.readFileSync(path.join(EXCERPT_DIR, 'SHA256SUMS'), 'utf8').trim().split('\n').map(l => l.trim().split(/\s+/));
    let all = true;
    for (const [sha, name] of sums) {
      const full = `src/maplab/${name}`;
      const buf = Buffer.from(execFileSync('unzip', ['-p', ip, full], { maxBuffer: 1024 * 1024 }));
      if (sha256(buf) !== sha) all = false;
    }
    res.checks.excerptsMatchInnerZip = all ? 'MATCH' : 'MISMATCH';
    const required = ['outerZipVerified', 'inputSha256EntriesVerified', 'innerZipVerified', 'htmlVerified',
      'defaultSeedVerified', 'defaultSeedTerrainEqualsVeyraTerrain', 'excerptsMatchInnerZip'];
    res.status = required.every(k => res.checks[k] === 'MATCH') ? 'VERIFIED' : 'MISMATCH';
  } catch (e) {
    res.status = 'ERROR'; res.error = String(e.message || e); return res;
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* no-op */ } }
  return res;
}

/** Parse the semantics strictly out of the verified source text. */
export function parseSemantics(files) {
  const T = files['types.ts'], A = files['analysis.ts'], G = files['graph.ts'];
  const R = files['terrain.ts'], S = files['store.ts'], E = files['exporter.ts'];

  const biomeBlock = need(T.match(/export const BIOMES: BiomeDef\[\] = \[([\s\S]*?)\n\];/), 'BIOMES block')[1];
  const BIOMES = [...biomeBlock.matchAll(/\{\s*id:\s*(\d+),\s*key:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*color:\s*\[([^\]]+)\]\s*\}/g)]
    .map(m => ({ id: +m[1], key: m[2], name: m[3], color: m[4].split(',').map(x => +x.trim()) }));
  if (BIOMES.length !== 12 || BIOMES.some((b, i) => b.id !== i)) throw new Error('BIOMES parse failed: expected ids 0..11');

  const rulesBlock = need(A.match(/export const RULES = \{([\s\S]*?)\};/), 'RULES block')[1];
  const RULES = {};
  for (const m of rulesBlock.matchAll(/(\w+):\s*([0-9.]+)/g)) RULES[m[1]] = +m[2];
  for (const k of ['buildSlopeMax', 'cartSlopeMax', 'footSlopeMax', 'spawnReach', 'interiorDist', 'coastRim'])
    if (!(k in RULES)) throw new Error(`RULES parse failed: missing ${k}`);

  const arr = (text, name) => need(text.match(new RegExp(`const ${name} = \\[([^\\]]+)\\]`)), `${name} array`)[1].split(',').map(x => +x.trim());
  const FOOT_B = arr(A, 'FOOT_B'), CART_B = arr(A, 'CART_B');
  const BAD_BUILD = need(A.match(/const BAD_BUILD = new Set\(\[([^\]]+)\]\)/), 'BAD_BUILD')[1].split(',').map(x => +x.trim());

  const GRAPH = {
    SNAP_TOL: num(G, /export const SNAP_TOL = (\d+)/, 'SNAP_TOL'),
    ACCESS_R: num(G, /export const ACCESS_R = (\d+)/, 'ACCESS_R'),
    DOCK_R: num(G, /export const DOCK_R = (\d+)/, 'DOCK_R'),
    BRIDGE_R: num(G, /export const BRIDGE_R = (\d+)/, 'BRIDGE_R'),
    resampleStepAu: num(G, /resample\(c\.pts, (\d+), c\.idx\)/, 'river resample step'),
    roadResampleStepAu: num(G, /resample\(c\.pts, (\d+)\)/, 'road resample step'),
    bridgeValidRadiusAu: num(files['validate.ts'], /nearestOnLine\(catmull\(r\.points\)\.pts, b\.at\)\.d < (\d+)/, 'BRIDGE-VALID radius'),
    roadWaterSampleStepAu: num(files['validate.ts'], /for \(const r of p\.roads\) \{\s*const S = resample\(catmull\(r\.points\)\.pts, (\d+)\)\.pts;/, 'ROAD-WATER sample step'),
    cartSlopeSampleStepAu: num(files['validate.ts'], /r\.kind === "cart"\) \{ const S = resample\(catmull\(r\.points\)\.pts, (\d+)\)\.pts/, 'ROAD-SLOPE cart sample step'),
  };

  const ROAD_RASTER = {
    lineWidthAu: num(A, /rasterRoads[\s\S]*?c\.lineWidth = (\d+)/, 'road raster lineWidth'),
    note: 'analysis.ts rasterRoads(): all non-ferry roads use the SAME 9u canvas stroke; cart roads are rasterised a second time with the same 9u stroke. This is an EDITOR ANALYSIS stroke, not an authored road width.',
  };
  const RIVER = {
    maskLineWidth: 'max(r.width, 9) authoring units (terrain.ts riverMask)',
    maskMinAu: num(R, /g\.lineWidth = Math\.max\(r\.width, (\d+)\)/, 'river mask minimum'),
    carveRadius: 'canal ? 16 : max(20, r.width * 4) authoring units (terrain.ts carve)',
    carveCanalAu: num(R, /const R = rv\.kind === "canal" \? (\d+)/, 'canal carve radius'),
    carveMinAu: num(R, /Math\.max\((\d+), rv\.width \* 4\)/, 'river carve minimum'),
    carveWidthFactor: num(R, /rv\.width \* (\d+)/, 'river carve width factor'),
    fordWidthThresholdAu: num(G, /riv\.width <= (\d+)/, 'ford width threshold'),
    fordNote: 'graph.ts: an unbridged river crossing is foot-fordable only if rd.ford || riv.fordable || (riv.kind !== "canal" && riv.width <= 3); always blocks cart. This is an EDITOR heuristic, not a Gameplay law.',
  };

  const ELEV = {
    byteToScalar: 'elev[i] / 255 (analysis.ts computeFields, terrain.ts elevAt)',
    scale: 1 / 255,
    seaByte: 0,
    landBytes: '1..255 (generateTerrain: Math.max(1, Math.round(clamp(e,0,1)*255)))',
    unit: 'abstract normalized height scalar; NO approved real-world unit (types.ts line 2: "World units are abstract u. Real-world scale is NOT approved by Gameplay Tower (Bible §11.5: no invented km/minutes).")',
  };
  const SLOPE = {
    definition: 'hypot(d(elev/255)/dx, d(elev/255)/dy) * 100, x/y in authoring units (terrain.ts slopeAt + analysis.ts computeFields)',
    unit: 'relative steepness index (elevation units per world unit x 100); heuristic scale, NOT a Bible value',
    scale: 100,
  };
  const SERIALIZATION = {
    format: need(S.match(/format: "([^"]+)"/), 'serialization format')[1],
    version: num(S, /version: (\d+)/, 'serialization version'),
    encode: 'btoa(String.fromCharCode(...Uint8Array)) in chunks of 0x8000',
    decode: "Uint8Array.from(atob(s), c => c.charCodeAt(0))",
    arrays: ['elev', 'biome'],
  };
  const roadSvg = need(E.match(/stroke-width="\$\{r\.kind === "cart" \? ([\d.]+) : ([\d.]+)\}/), 'road SVG stroke widths');
  const DISPLAY_ONLY = {
    bridgeGlyphAu: { w: num(E, /(?<!stroke-)width="([\d.]+)"/, 'bridge glyph width'), h: num(E, /(?<!stroke-)height="([\d.]+)"/, 'bridge glyph height') },
    bridgeGlyphNote: 'exporter.ts renderSVG(): 13 x 7.2u rectangle is a DISPLAY GLYPH. It is not a physical deck span, load rating or swept-clearance dimension.',
    roadSvgStrokeAu: { cart: +roadSvg[1], other: +roadSvg[2] },
    roadSvgNote: 'exporter.ts renderSVG() strokes are display-only; they are NOT authored road widths.',
  };
  const ARCHETYPE = (() => {
    const line = need(T.match(/\{ id: "smelter"[^\n]*/), 'ARCHES smelter entry')[0];
    return {
      source: 'types.ts ARCHES[id="smelter"] (editor library default, NOT the po_kilns instance values)',
      r: num(line, /\br: (\d+)/, 'archetype radius'),
      depth: need(line.match(/depth: "([^"]+)"/), 'archetype depth')[1],
      gate: need(line.match(/gate: "([^"]+)"/), 'archetype gate')[1],
    };
  })();

  return { BIOMES, RULES, FOOT_B, CART_B, BAD_BUILD, GRAPH, ROAD_RASTER, RIVER, ELEV, SLOPE, SERIALIZATION, DISPLAY_ONLY, ARCHETYPE };
}

export function loadMapLabSource() {
  const { files, verification } = readExcerpts();
  return { files, verification, semantics: parseSemantics(files), provenance: INPUT_BRANCH, zipChain: verifyZipChain() };
}
