/**
 * Live extraction input for the SOH economic multigraph (`buildSohEconomicGraph`).
 *
 * Moved VERBATIM out of `economic-network-m1.test.ts` so that every consumer of the multigraph
 * (the M1 exporter and the Item Ontology V2 projection) reads the SAME live worlds instead of a
 * second hand-written collector or a stale committed JSON. Lives under tests/ because it pulls
 * Vite-only world builders the browser bundle must not import from `economic-graph.ts`.
 */
import { getWorld } from '../../src/game/world';
import { POIS } from '../../src/veyra05/reader';
import { buildWindowWorld, type WindowWorld } from '../../src/veyra05/window';
import { layoutIdAt, VEYRA05_SCENES } from '../../src/veyra05/scenes';
import { auToTile, FRAME_H, FRAME_W, WINDOW_H, WINDOW_W } from '../../src/veyra05/frame';
import { authoredPlan } from '../../src/veyra05/floors';
import {
  ORDINARY_CREATURE_HABITATS,
  VEYRA_PRIMORDIAL_SITES,
  VEYRA_SIDE_BOSS_SITES,
} from '../../src/veyra05/ecosystem';
import type { EconomicExtractionInput, VeyraPoiExtraction } from '../../src/game/economic-graph';

function countSourceGrid(arr: (string | null)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of arr) {
    if (s) counts[s] = (counts[s] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function collectExtractionInput(): EconomicExtractionInput {
  const wShip = getWorld('shipping_fresh');
  const wDelta = getWorld('dev_delta_fresh');

  const shipStaticKey = (s: { kind: string; tx: number; ty: number; poi?: string }) =>
    `${s.kind}:${s.tx}:${s.ty}:${s.poi ?? ''}`;
  const shipStaticSet = new Set(wShip.statics.map(shipStaticKey));
  const devDeltaExtraStatics = wDelta.statics.filter((s) => !shipStaticSet.has(shipStaticKey(s)));

  const shipDoorSet = new Set((wShip.poiAccess?.doors ?? []).map((d) => `${d.requirement}:${d.tx}:${d.ty}`));
  const devDeltaPoiDoors = (wDelta.poiAccess?.doors ?? []).filter(
    (d) => !shipDoorSet.has(`${d.requirement}:${d.tx}:${d.ty}`),
  );

  // Sample all 12 canonical Veyra scenes for terrain/source coverage
  const veyraSampledSourceCounts: Record<string, number> = {};
  const builtWindows = new Map<string, WindowWorld>();
  const getWin = (ox: number, oy: number): WindowWorld => {
    const id = layoutIdAt(ox, oy);
    let ww = builtWindows.get(id);
    if (!ww) {
      ww = buildWindowWorld(id);
      builtWindows.set(id, ww);
    }
    return ww;
  };

  for (const sc of VEYRA05_SCENES) {
    const ww = buildWindowWorld(sc.id);
    builtWindows.set(sc.id, ww);
    for (let i = 0; i < ww.world.sourceV3.length; i++) {
      const sk = ww.world.sourceV3[i];
      if (sk) veyraSampledSourceCounts[sk] = (veyraSampledSourceCounts[sk] ?? 0) + 1;
    }
  }

  // Extract every single one of the 81 canonical Veyra POIs using greedy interior window cover
  const veyraPois: VeyraPoiExtraction[] = [];
  const sortedPois = [...POIS].sort((a, b) => a.id.localeCompare(b.id));
  const poiTiles = new Map(sortedPois.map((p) => [p.id, auToTile(p.at[0], p.at[1])]));
  const MARGIN = 36;
  const findInteriorWindow = (pid: string, tx: number, ty: number): WindowWorld | undefined => {
    for (const ww of builtWindows.values()) {
      const lx = tx - ww.win.originTx;
      const ly = ty - ww.win.originTy;
      if (lx >= MARGIN && ly >= MARGIN && lx <= WINDOW_W - MARGIN && ly <= WINDOW_H - MARGIN && ww.poiIds.includes(pid)) {
        return ww;
      }
    }
    return undefined;
  };

  for (const poi of sortedPois) {
    const [tx, ty] = poiTiles.get(poi.id)!;
    let chosen = findInteriorWindow(poi.id, tx, ty);
    if (!chosen) {
      // Cluster uncovered POIs within 115x115 tiles to minimize full-window builds
      const cluster = sortedPois.filter((other) => {
        const [ox0, oy0] = poiTiles.get(other.id)!;
        return !findInteriorWindow(other.id, ox0, oy0) && Math.abs(ox0 - tx) <= 115 && Math.abs(oy0 - ty) <= 115;
      });
      const minX = Math.min(...cluster.map((c) => poiTiles.get(c.id)![0]));
      const maxX = Math.max(...cluster.map((c) => poiTiles.get(c.id)![0]));
      const minY = Math.min(...cluster.map((c) => poiTiles.get(c.id)![1]));
      const maxY = Math.max(...cluster.map((c) => poiTiles.get(c.id)![1]));
      const cx = maxX - minX <= WINDOW_W - MARGIN * 2 ? Math.round((minX + maxX) / 2) : tx;
      const cy = maxY - minY <= WINDOW_H - MARGIN * 2 ? Math.round((minY + maxY) / 2) : ty;
      const ox = Math.max(0, Math.min(FRAME_W - WINDOW_W, cx - Math.floor(WINDOW_W / 2)));
      const oy = Math.max(0, Math.min(FRAME_H - WINDOW_H, cy - Math.floor(WINDOW_H / 2)));
      chosen = getWin(ox, oy);
    }
    const plan = authoredPlan(poi.id);
    const authoredLootCoordsByLevel = new Map<number, Set<string>>();
    let authoredCacheCount = 0;
    if (plan) {
      for (const [lv, lvl] of plan.levels.entries()) {
        const coords = new Set<string>();
        for (const l of lvl.loot) {
          coords.add(`${l.x - chosen.win.originTx},${l.y - chosen.win.originTy}`);
          authoredCacheCount++;
        }
        authoredLootCoordsByLevel.set(lv, coords);
      }
    }

    const statics: VeyraPoiExtraction['statics'] = [];
    for (const lv of chosen.floors.levels) {
      const layer = chosen.floors.layers.get(lv);
      if (!layer) continue;
      const authoredCoords = authoredLootCoordsByLevel.get(lv);
      for (const st of layer.statics) {
        if (st.poi !== poi.id) continue;
        const isAuthoredLoot = st.kind === 'loot' && !!authoredCoords?.has(`${st.tx},${st.ty}`);
        statics.push({
          level: lv,
          kind: st.kind,
          tx: st.tx,
          ty: st.ty,
          ...(st.label ? { label: st.label } : {}),
          ...(st.cash !== undefined ? { cash: st.cash } : {}),
          ...(st.locked ? { locked: st.locked } : {}),
          ...(st.loot ? { loot: st.loot } : {}),
          ...(st.kind === 'loot' && !isAuthoredLoot ? { fromArchetypePreset: true } : {}),
        });
      }
    }

    veyraPois.push({
      id: poi.id,
      name: poi.name,
      arche: poi.arche,
      levels: chosen.floors.levels.filter((lv) => plan?.levels.has(lv)),
      authoredCacheCount,
      statics,
    });
  }

  return {
    shippingStatics: wShip.statics,
    shippingPoiDoors: wShip.poiAccess?.doors ?? [],
    shippingSourceCounts: countSourceGrid(wShip.sourceV3),
    devDeltaExtraStatics,
    devDeltaPoiDoors,
    veyraPois,
    veyraOrdinaryHabitats: ORDINARY_CREATURE_HABITATS.map((h) => ({
      species: h.species,
      poiId: h.poiId,
      count: h.count,
      leashTiles: h.leashTiles,
    })),
    veyraWildSpecies: ['boar', 'deer', 'hare', 'grouse', 'fox'],
    veyraSideBosses: VEYRA_SIDE_BOSS_SITES.map((s) => ({
      species: s.species,
      poiId: s.poiId,
      name: s.name,
      floor: s.floor,
    })),
    veyraPrimordials: VEYRA_PRIMORDIAL_SITES.map((p) => ({
      key: p.key,
      poiId: p.poiId,
      floor: p.floor,
    })),
    veyraSampledSourceCounts: Object.fromEntries(
      Object.entries(veyraSampledSourceCounts).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}
