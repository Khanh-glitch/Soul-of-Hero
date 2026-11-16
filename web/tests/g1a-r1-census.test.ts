// G1A-R1 — whole-map placement census (rules 3 vs rules 4 on the same coordinates).
//
// ENGINE-LEVEL, placement data only (no play). Tiles the full 4000x2800 Veyra frame with 200x200 windows at a 192-tile
// stride, so every global cell is read once (cells are de-duplicated by global coordinate). A window's compile depends on
// that window's own start anchors, so a cell near a window edge can differ slightly from what another window origin
// would show; the census is exact for the windows listed, and a close estimate of "the world".
// Slow (about 300 windows x 2 rule sets): runs only with WRITE_G1A=1 and writes evidence/g1a/world-census.json.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { SOURCES, isIndustrialSalvage } from '../src/game/catalog';
import { WW, WH } from '../src/game/core';
import { G1A_YIELDING_TREES } from '../src/game/world-economy';
import { getWindowWorld, G1A_POI_WEIGHTS, type WindowWorld } from '../src/veyra05/window';
import { layoutIdAt } from '../src/veyra05/scenes';
import { FRAME_W, FRAME_H } from '../src/veyra05/frame';
import { POIS } from '../src/veyra05/reader';
import { setActiveLayout } from '../src/game/world';
import { U05_WORLD_LAYOUT_ID } from '../src/veyra05/scenes';

const SALV = (k: string | null) => k === 'scrap' || k === 'wreck' || isIndustrialSalvage(k);
/** Cells a player can walk to from the window's start anchors, with every solid (terrain, prop, blocking source) in place. */
function reach(ww: WindowWorld): Uint8Array {
  const g = ww.floors.ground, n = WW * WH, r = new Uint8Array(n), q = new Int32Array(n); let h = 0, t = 0;
  const solid = (i: number) => !g.walkable[i] || !!g.solidProps[i] || !!(g.sources[i] && SOURCES[g.sources[i]!]?.block);
  for (const a of ww.world.economyMap.starts) { const i = a.y * WW + a.x; if (!solid(i) && !r[i]) { r[i] = 1; q[t++] = i; } }
  while (h < t) { const i = q[h++], x = i % WW, y = (i / WW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue; const j = ny * WW + nx; if (!r[j] && !solid(j)) { r[j] = 1; q[t++] = j; } } }
  return r;
}

describe.runIf(process.env.WRITE_G1A === '1')('G1A-R1 whole-map census', () => {
  it('writes evidence/g1a/world-census.json', () => {
    expect(setActiveLayout(U05_WORLD_LAYOUT_ID)).toBe(true);
    const seen = new Uint8Array(FRAME_W * FRAME_H);
    const nat3: Record<string, number> = {}, nat4: Record<string, number> = {}, change: Record<string, number> = {};
    const legacy: Record<string, number> = { scrap: 0, wreck: 0 }, road: Record<string, number> = {}, poi: Record<string, number> = {}, site: Record<string, Record<string, number>> = {};
    const lostNat = { besideSalvage: 0, notBesideSalvage: 0, byKey: {} as Record<string, number> }, gainedNat: Record<string, number> = {};
    const reachStat = { walkableReached3: 0, walkableReached4: 0, lostCells: 0, lostCellsOnlyUnderNewSalvage: 0, gainedCells: 0, lostPocketCells: 0, windowsWithLostPocket: [] as string[] };
    let windows = 0, empty = 0, noSalvageWindows = 0, salvageUnreachable = 0; const skipped: string[] = [];
    const xs: number[] = [], ys: number[] = [];
    for (let x = 0; x < FRAME_W - WW; x += 192) xs.push(x); xs.push(FRAME_W - WW - ((FRAME_W - WW) % 64));
    for (let y = 0; y < FRAME_H - WH; y += 192) ys.push(y); ys.push(FRAME_H - WH - ((FRAME_H - WH) % 64));
    for (const oy of ys) for (const ox of xs) {
      let w3: WindowWorld, w4: WindowWorld;
      try { w3 = getWindowWorld(layoutIdAt(ox, oy), 3); w4 = getWindowWorld(layoutIdAt(ox, oy), 4); } catch (e) { skipped.push(`${ox},${oy}`); empty++; continue; }
      windows++; const a = w3.floors.ground, b = w4.floors.ground, r3 = reach(w3), r4 = reach(w4); let salv = 0, lostPocket = 0;
      for (let i = 0; i < WW * WH; i++) {
        const lx = i % WW, ly = (i / WW) | 0, gid = (oy + ly) * FRAME_W + ox + lx; if (seen[gid]) continue; seen[gid] = 1;
        const k3 = a.sources[i], k4 = b.sources[i];
        if (k3 && !SALV(k3)) nat3[k3] = (nat3[k3] ?? 0) + 1; if (k4 && !SALV(k4)) nat4[k4] = (nat4[k4] ?? 0) + 1;
        if (k3 === 'scrap' || k3 === 'wreck') legacy[k3]++;
        if (isIndustrialSalvage(k4)) {
          salv++; const pi = w4.poiAt![i];
          if (pi >= 0 && b.protectedCells[i]) { poi[k4!] = (poi[k4!] ?? 0) + 1; const s = (site[POIS[pi].id] ??= {}); s[k4!] = (s[k4!] ?? 0) + 1; } else road[k4!] = (road[k4!] ?? 0) + 1;
          // "reachable" for a solid node = a walkable neighbour is reached
          if (![1, -1, WW, -WW].some(d => r4[i + d])) salvageUnreachable++;
        }
        if (k3 !== k4) {
          const cls = `${k3 ? (SALV(k3) ? 'legacy-salvage' : k3) : 'empty'} -> ${k4 ? (SALV(k4) ? 'g1a-salvage' : k4) : 'empty'}`; change[cls] = (change[cls] ?? 0) + 1;
          if (k3 && !SALV(k3) && !k4) { const beside = [1, -1, WW, -WW].some(d => isIndustrialSalvage(b.sources[i + d])); if (beside) lostNat.besideSalvage++; else lostNat.notBesideSalvage++; lostNat.byKey[k3] = (lostNat.byKey[k3] ?? 0) + 1; }
          if (!k3 && k4 && !SALV(k4)) gainedNat[k4] = (gainedNat[k4] ?? 0) + 1;
        }
        if (a.walkable[i]) { if (r3[i]) reachStat.walkableReached3++; if (r4[i]) reachStat.walkableReached4++; }
        if (r3[i] && !r4[i]) { reachStat.lostCells++; if (isIndustrialSalvage(k4) || (k4 && SOURCES[k4]?.block)) reachStat.lostCellsOnlyUnderNewSalvage++; else { reachStat.lostPocketCells++; lostPocket++; } }
        if (!r3[i] && r4[i]) reachStat.gainedCells++;
      }
      if (lostPocket) reachStat.windowsWithLostPocket.push(`${ox},${oy}:${lostPocket}`);
      if (!salv) noSalvageWindows++;
    }
    const natKeys = [...new Set([...Object.keys(nat3), ...Object.keys(nat4)])].sort();
    const natural = Object.fromEntries(natKeys.map(k => [k, { rules3: nat3[k] ?? 0, rules4: nat4[k] ?? 0, delta: (nat4[k] ?? 0) - (nat3[k] ?? 0), pct: +(((nat4[k] ?? 0) - (nat3[k] ?? 0)) / Math.max(1, nat3[k] ?? 0) * 100).toFixed(2), solid: !!SOURCES[k]?.block, mayYieldToSalvage: G1A_YIELDING_TREES.has(k) }]));
    const sum = (o: Record<string, number>) => Object.values(o).reduce((s, n) => s + n, 0);
    const bySite = POIS.map(p => ({ poi: p.id, arche: p.arche, listed: !!G1A_POI_WEIGHTS[p.arche], ...(site[p.id] ?? {}), total: sum(site[p.id] ?? {}) }));
    const out = {
      note: 'ENGINE-LEVEL placement census, whole 4000x2800 frame, 200x200 windows at stride 192, cells de-duplicated by global coordinate. rules3 = legacy placement (old saves), rules4 = G1A (new runs). SOH_PROVISIONAL.',
      windowsBuilt: windows, windowsWithNoLand: empty, windowsWithNoSalvageUnderG1A: noSalvageWindows,
      legacy: { ...legacy, total: legacy.scrap + legacy.wreck },
      g1a: { roadside: { ...road, total: sum(road) }, poi: { ...poi, total: sum(poi) }, total: sum(road) + sum(poi), roadsideRatioToLegacy: +(sum(road) / (legacy.scrap + legacy.wreck)).toFixed(3), salvageWithNoReachedNeighbour: salvageUnreachable },
      poiSites: { sites: bySite.length, listedSites: bySite.filter(s => s.listed).length, withAny: bySite.filter(s => s.total).length, listedWithNone: bySite.filter(s => s.listed && !s.total).map(s => `${s.poi}:${s.arche}`), over10: bySite.filter(s => s.total > 10).map(s => `${s.poi}:${s.arche}:${s.total}`), bySite },
      natural: { total: { rules3: sum(nat3), rules4: sum(nat4), delta: sum(nat4) - sum(nat3), pct: +((sum(nat4) - sum(nat3)) / sum(nat3) * 100).toFixed(3) }, byKey: natural, lost: lostNat, gainedByKey: gainedNat, changeMatrix: change },
      reachability: reachStat,
    };
    mkdirSync(new URL('../evidence/g1a/', import.meta.url), { recursive: true });
    writeFileSync(new URL('../evidence/g1a/world-census.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    // Finite mineral nodes must not be traded away for salvage.
    for (const k of natKeys) if (SOURCES[k]?.block && !G1A_YIELDING_TREES.has(k)) expect(nat4[k] ?? 0, `${k} must not shrink under G1A`).toBeGreaterThanOrEqual(nat3[k] ?? 0);
    // No POI salvage outside the listed site kinds.
    for (const s of bySite) if (!s.listed) expect(s.total, s.poi).toBe(0);
    expect(salvageUnreachable).toBe(0);
  }, 3600000);
});
