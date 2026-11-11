import { describe, expect, it } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CREATURES,
  ELDERS,
  ITEMS,
  PRIMORDIAL_ELDERS,
  RECIPES,
  SOURCES,
  STRUCTS,
  VENDOR_SECURED,
  VENDOR_SPARES,
} from '../src/game/catalog';
import { getWorld } from '../src/game/world';
import { POIS } from '../src/veyra05/reader';
import { buildWindowWorld, type WindowWorld } from '../src/veyra05/window';
import { layoutIdAt, VEYRA05_SCENES } from '../src/veyra05/scenes';
import { auToTile, FRAME_H, FRAME_W, WINDOW_H, WINDOW_W } from '../src/veyra05/frame';
import { authoredPlan } from '../src/veyra05/floors';
import {
  ORDINARY_CREATURE_HABITATS,
  VEYRA_PRIMORDIAL_SITES,
  VEYRA_SIDE_BOSS_SITES,
} from '../src/veyra05/ecosystem';
import {
  buildSohEconomicGraph,
  validateEconomicGraph,
  type EconomicExtractionInput,
  type VeyraPoiExtraction,
} from '../src/game/economic-graph';

const REPORTS_DIR = resolve(process.cwd(), 'reports', 'economic-network');
const ATLAS_PATH = resolve(process.cwd(), 'ref', 'atlas', 'extracted', 'ATLAS_v2.json');
const V11_DIR = resolve(process.cwd(), 'ref', 'atlas', 'extracted', 'v11');

function countSourceGrid(arr: (string | null)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of arr) {
    if (s) counts[s] = (counts[s] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function parseSheetCsv(path: string): Record<string, string>[] {
  const raw = readFileSync(path, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const startIdx = lines[0]?.startsWith('<PARSED TEXT') ? 1 : 0;
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[startIdx]);
  const rows: Record<string, string>[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = vals[idx] ?? '';
    });
    rows.push(rec);
  }
  return rows;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function collectExtractionInput(): EconomicExtractionInput {
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

interface CrosswalkRow {
  row_id: string;
  source_group: string;
  li_ref_id: string;
  li_domain: string;
  li_description: string;
  soh_status: string;
  shipping_status: string;
  veyra_status: string;
  soh_node_or_edge_refs: string;
  soh_code_refs: string;
  provenance_tag: string;
  parity_notes: string;
}

function mapCapabilityPrefixToSoh(prefix: string): { nodes: string; code: string; veyra: string } {
  if (prefix.startsWith('SYS01')) return { nodes: 'world_source:* -> item:stone_axe/iron_pick/industrial_pick', code: 'catalog.ts:SOURCES,engine.ts:harvestHit', veyra: 'LIVE_VEYRA' };
  if (prefix.startsWith('SYS02')) return { nodes: 'station:furnace -> item:iron_ingot/refined_iron_ingot/mechanical_parts', code: 'catalog.ts:RECIPES,engine.ts:stepStations', veyra: 'LIVE_VEYRA' };
  if (prefix.startsWith('SYS03')) return { nodes: 'station:recycler -> recipe:recycler:*', code: 'recycler.ts,wreck-economy.ts', veyra: 'ABSENT_ON_VEYRA (direct-v1 fallback)' };
  if (prefix.startsWith('SYS04')) return { nodes: 'station:workbench_1..3 -> station:workbench_industrial', code: 'catalog.ts:WORKBENCH_UPGRADE*', veyra: 'LIVE_VEYRA' };
  if (prefix.startsWith('SYS05')) return { nodes: 'poi_gate:keycard/*, poi_gate:power/*', code: 'engine.ts:poiAccess,content.ts', veyra: 'ABSENT_IN_VEYRA_POIS (0 keycard/power gates)' };
  if (prefix.startsWith('SYS06')) return { nodes: 'station:base_generator -> station:arrow_turret/ir_sensor/door_powered', code: 'engine.ts:stepBasePower,wireReachable', veyra: 'LIVE_VEYRA' };
  if (prefix.startsWith('SYS07')) return { nodes: 'station:claim -> sink:territory_upkeep_24h', code: 'engine.ts:stepTerritory,balance.v1.json:territory', veyra: 'LIVE_VEYRA' };
  if (prefix.startsWith('SYS08')) return { nodes: 'creature:* -> station:arrow_turret/bear_trap', code: 'sim.ts,engine.ts:killCreature', veyra: 'PARTIAL_ON_VEYRA (excludes wolf/toad/crawler/beetle/crab)' };
  if (prefix.startsWith('SYS09')) return { nodes: 'station:cart/cart_freight/motorbike', code: 'motorbike.ts,engine.ts:vehicle*', veyra: 'LIVE_VEYRA' };
  if (prefix.startsWith('SYS10')) return { nodes: 'station:refinery, station:oil_pump (fixture-only)', code: 'catalog.ts:oilRefineryV1,engine.ts:oilTestFixture', veyra: 'PARTIAL (salvaged_oil live; oil_pump test-fixture-only)' };
  if (prefix.startsWith('SYS11')) return { nodes: 'container:shipping:*, container:veyra:*', code: 'loot-ecology.ts,veyra05/floors.ts', veyra: 'DIFFERENT (no lootEcology/creatorLootV1; static/archetype only)' };
  if (prefix.startsWith('SYS12')) return { nodes: 'container:shipping:airdrop_v1', code: 'airdrop.ts:supportsAirdrops', veyra: 'ABSENT_ON_VEYRA' };
  if (prefix.startsWith('SYS13')) return { nodes: 'item:core_*, item:energy_basic/refined, item:essence_*', code: 'catalog.ts:CREATOR_CORES,sim.ts:coreCast', veyra: 'PARTIAL (core_demon & essence_spirit craft blocked by missing crawler_optic)' };
  if (prefix.startsWith('SYS14')) return { nodes: 'station:research, blueprint:*, currency:spares', code: 'engine.ts:research,catalog.ts:CORE_STUDY', veyra: 'PARTIAL (tier 3 cores have no creatorLoot/airdrop; random research only)' };
  if (prefix.startsWith('SYS15')) return { nodes: 'player:warmth/hunger/thirst, recipe:garden:*', code: 'thermal.ts,calendar.ts,engine.ts:stepGardensBarrels', veyra: 'LIVE_VEYRA' };
  if (prefix.startsWith('SYS16')) return { nodes: 'world_source:*, container:*', code: 'world.ts,world-economy.ts,veyra05/window.ts', veyra: 'LIVE_VEYRA (81 POIs via window streaming)' };
  if (prefix.startsWith('SYS17')) return { nodes: 'sink:run_wipe_336h, currency:rcash -> currency:secured_cash', code: 'engine.ts:settle,deposit', veyra: 'LIVE_VEYRA' };
  if (prefix.startsWith('SYS18')) return { nodes: 'currency:spares -> vendor_offer:spares:*', code: 'catalog.ts:VENDOR_SPARES,engine.ts:buySpares', veyra: 'LIVE_VEYRA (2 vendor POIs)' };
  return { nodes: 'shared', code: 'catalog.ts', veyra: 'LIVE_VEYRA' };
}

function buildCrosswalkRows(): CrosswalkRow[] {
  const atlas = JSON.parse(readFileSync(ATLAS_PATH, 'utf8')) as {
    systems: Array<{ id: string; title: string; domain: string; mechanism: string; refs: string[] }>;
    unresolved: Array<{ key: string; domain: string; question: string; consequence: string }>;
  };
  const xedges = parseSheetCsv(resolve(V11_DIR, '17_EXPLICIT_CROSS_SYSTEM_NETWORK.csv'));
  const gates32 = parseSheetCsv(resolve(V11_DIR, '13_CROSS_SYSTEM_GATES_32_FROM_v10.csv'));
  const decisions36 = parseSheetCsv(resolve(V11_DIR, '10_CONVERSATION_36_DECISIONS_FROM_v10.csv'));

  const rows: CrosswalkRow[] = [];
  let seq = 0;
  const push = (r: Omit<CrosswalkRow, 'row_id'>) => {
    seq++;
    rows.push({ row_id: `CW-${String(seq).padStart(3, '0')}`, ...r });
  };

  // 1) 17 LI Systems (S01..S17)
  const sysMap: Record<string, { soh: string; ship: string; veyra: string; nodes: string; code: string; notes: string }> = {
    S01: { soh: 'IMPLEMENTED_SOH_TUNED', ship: 'LIVE', veyra: 'LIVE', nodes: 'item:stone_axe/iron_pick/industrial_pick; world_source:*', code: 'catalog.ts:SOURCES.qualityBonus,ITEMS', notes: 'Adds rich_iron_ore quality tier via playerTool capability' },
    S02: { soh: 'IMPLEMENTED_SOH_TUNED', ship: 'LIVE', veyra: 'LIVE', nodes: 'station:furnace/furnace_lined; recipe:iron_ingot/refined_iron_ingot', code: 'catalog.ts:RECIPES,FURNACE_LINING', notes: 'Kiln lining yields 0.8x fuel multiplier; 1 ore -> 1 ingot' },
    S03: { soh: 'IMPLEMENTED_SHIPPING_ONLY', ship: 'LIVE', veyra: 'ABSENT_DIRECT_V1', nodes: 'station:recycler; recipe:recycler:*', code: 'recycler.ts,wreck-economy.ts,world.ts:webRecyclerSite', notes: 'Recycler absent on Veyra; wreck falls back to direct-v1 (+spares, 0 damaged_drive)' },
    S04: { soh: 'IMPLEMENTED_CANON_MODIFIED', ship: 'LIVE', veyra: 'LIVE_DEGRADED_T3', nodes: 'station:research; currency:spares; blueprint:*', code: 'engine.ts:research,catalog.ts:permitsDirectedResearch', notes: 'Directed research blocked for tier>=3; Veyra lacks creatorLoot/airdrop for tier 3 Cores' },
    S05: { soh: 'IMPLEMENTED_CANON_MODIFIED', ship: 'LIVE', veyra: 'LIVE', nodes: 'station:workbench_1..3; gate:wb_l1..3', code: 'catalog.ts:WORKBENCH_UPGRADE*,H08', notes: 'Knowledge tier decoupled from station level (D03/H08)' },
    S06: { soh: 'IMPLEMENTED_SHIPPING_ONLY', ship: 'LIVE', veyra: 'STATIC_ARCHETYPE_ONLY', nodes: 'container:shipping:ecology:*; container:veyra:*', code: 'loot-ecology.ts,veyra05/floors.ts:ARCHETYPE_LOOT', notes: 'Veyra uses 24 authored caches + 13 static ARCHETYPE_LOOT presets without respawn ecology' },
    S07: { soh: 'IMPLEMENTED_SHIPPING_ONLY', ship: 'LIVE', veyra: 'UNWIRED_ON_VEYRA', nodes: 'poi_gate:keycard/*; poi_gate:power/*', code: 'engine.ts:poiAccess,content.ts', notes: 'Shipping factory_vault + light + dev_delta relays; 0 keycard/power gates or keycards on Veyra' },
    S08: { soh: 'IMPLEMENTED_WIRE_V1', ship: 'LIVE', veyra: 'LIVE', nodes: 'station:base_generator; station:ir_sensor; station:door_powered', code: 'engine.ts:wireReachable,stepBasePower', notes: 'Shared wire-v1 orthogonal circuit model' },
    S09: { soh: 'IMPLEMENTED_PROVISIONAL', ship: 'LIVE', veyra: 'LIVE', nodes: 'structure:*; station:claim; sink:territory_upkeep_24h', code: 'engine.ts:stepTerritory,balance.v1.json:territory', notes: '25% per 24h upkeep; 12h unprotected/unfunded collapse timer' },
    S10: { soh: 'IMPLEMENTED_PROVISIONAL', ship: 'LIVE', veyra: 'LIVE', nodes: 'station:arrow_turret; station:bear_trap; structure:spikes', code: 'sim.ts:turretFire,balance.v1.json:bearTrapV1', notes: 'Turret requires wire-v1 + arrows; Bear Trap requires 1 iron_plate arm/re-arm' },
    S11: { soh: 'IMPLEMENTED_PROVISIONAL', ship: 'LIVE', veyra: 'LIVE', nodes: 'item:motorbike_kit; station:motorbike; item:lubricant', code: 'motorbike.ts,engine.ts:vehicle*', notes: 'Single motorbike model (no jeep/boat); tank 300, wear 0.008/px halved by lubricant' },
    S12: { soh: 'SPLIT_LIVE_AND_FIXTURE', ship: 'PARTIAL_FIXTURE_ONLY', veyra: 'PARTIAL_FIXTURE_ONLY', nodes: 'station:refinery; station:oil_pump; item:salvaged_oil/crude_petroleum', code: 'engine.ts:oilTestFixture,catalog.ts:oilRefineryV1', notes: 'salvaged_oil from wrecks works live; crude_petroleum + oil_pump strictly test-fixture-v1' },
    S13: { soh: 'IMPLEMENTED_SOH_ADAPTED', ship: 'LIVE', veyra: 'LIVE', nodes: 'item:bandage/medkit/antirad/stew/root_broth', code: 'catalog.ts:ITEMS,RECIPES', notes: 'No syringe item; uses herb + gland -> antirad, bandage -> medkit, garden + husbandry foods' },
    S14: { soh: 'IMPLEMENTED_MAP_OWNED', ship: 'LIVE', veyra: 'LIVE', nodes: 'world_source:*; gate:veyra_spawner; gate:shipping_spawner', code: 'world-economy.ts,veyra05/window.ts', notes: 'Biomes place distinct ores/flora; Shipping vs Veyra diverge on creature & oil availability' },
    S15: { soh: 'IMPLEMENTED_LOCKED_CANON', ship: 'LIVE', veyra: 'LIVE', nodes: 'sink:run_wipe_336h; profile:secured_cash', code: 'bible.md,engine.ts:settle', notes: '336h (14d) run wipe, final 72h Ragnarok; blueprint knowledge wipes per run (cash-only meta)' },
    S16: { soh: 'IMPLEMENTED_SHIPPING_ONLY', ship: 'LIVE', veyra: 'ABSENT_ON_VEYRA', nodes: 'container:shipping:airdrop_v1', code: 'airdrop.ts:supportsAirdrops', notes: 'First drop 8h, cadence 24h, max 14 events on Shipping/dev_delta; off on Veyra' },
    S17: { soh: 'REPLACED_BY_CORES_V1', ship: 'LIVE', veyra: 'PARTIAL_BLOCKED', nodes: 'item:energy_basic/energy_refined; item:essence_*; item:core_*', code: 'catalog.ts:ALWAYS_KNOWN_RECIPES,sim.ts:coreCast', notes: 'H06/H15: 2 shared energy SKUs + 4 essences + 7 Creator Cores + 4 legacy Cores; essence_spirit craft broken on Veyra' },
  };
  for (const s of atlas.systems) {
    const m = sysMap[s.id];
    push({
      source_group: 'LI_ATLAS_SYSTEM',
      li_ref_id: s.id,
      li_domain: s.domain,
      li_description: `${s.title}: ${s.mechanism}`,
      soh_status: m.soh,
      shipping_status: m.ship,
      veyra_status: m.veyra,
      soh_node_or_edge_refs: m.nodes,
      soh_code_refs: m.code,
      provenance_tag: 'LI_REPO_ARCHIVE_VERIFIED',
      parity_notes: m.notes,
    });
  }

  // 2) 12 Unresolved ATLAS items (U01..U12)
  for (const u of atlas.unresolved) {
    const notApplicable = u.key === 'U09' || u.key === 'U10';
    push({
      source_group: 'LI_UNRESOLVED_GAP',
      li_ref_id: u.key,
      li_domain: u.domain,
      li_description: u.question,
      soh_status: notApplicable ? 'NOT_APPLICABLE_BY_CANON_H06' : 'SOH_PROVISIONAL_TUNED',
      shipping_status: notApplicable ? 'N/A' : 'LIVE',
      veyra_status: notApplicable ? 'N/A' : u.key === 'U01' || u.key === 'U05' ? 'ABSENT_ON_VEYRA' : 'LIVE',
      soh_node_or_edge_refs: `domain:${u.domain}`,
      soh_code_refs: 'balance.v1.json',
      provenance_tag: 'ORIGINAL_UNKNOWN',
      parity_notes: `${u.consequence} | LI numeric reference remains ORIGINAL_UNKNOWN`,
    });
  }

  // 3) 104 Explicit Cross-System Edges (XEDGE-001..104)
  for (const xe of xedges) {
    const m = mapCapabilityPrefixToSoh(xe.from_capability);
    const isOilPumpEdge = xe.edge_id === 'XEDGE-055' || xe.edge_id === 'XEDGE-056';
    const isShippingOnly =
      xe.from_capability.startsWith('SYS03') ||
      xe.to_capability.startsWith('SYS03') ||
      xe.from_capability.startsWith('SYS05') ||
      xe.to_capability.startsWith('SYS05') ||
      xe.from_capability.startsWith('SYS12') ||
      xe.to_capability.startsWith('SYS12') ||
      xe.edge_id === 'XEDGE-063' ||
      xe.edge_id === 'XEDGE-065' ||
      xe.edge_id === 'XEDGE-066';
    push({
      source_group: 'CROSS_SYSTEM_XEDGE',
      li_ref_id: xe.edge_id,
      li_domain: `${xe.from_capability}->${xe.to_capability}`,
      li_description: `${xe.resource_or_event} (${xe.causal_condition})`,
      soh_status: isOilPumpEdge ? 'TEST_FIXTURE_ONLY' : isShippingOnly ? 'LIVE_SHIPPING_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
      shipping_status: isOilPumpEdge ? 'TEST_FIXTURE_ONLY' : 'LIVE',
      veyra_status: isOilPumpEdge ? 'TEST_FIXTURE_ONLY' : m.veyra,
      soh_node_or_edge_refs: m.nodes,
      soh_code_refs: m.code,
      provenance_tag: xe.authority === 'LI_REFERENCE_ADAPTED' ? 'LI_REPO_ARCHIVE_VERIFIED' : 'LIVE_VERIFIED_SOH',
      parity_notes: `Authority=${xe.authority} | Choice=${xe.player_choice}`,
    });
  }

  // 4) 32 Gates (A00..A31)
  for (const g of gates32) {
    const isF01 = ['A09', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19'].includes(g.id);
    push({
      source_group: 'CROSS_SYSTEM_GATE',
      li_ref_id: g.id,
      li_domain: g.system,
      li_description: g.acceptance,
      soh_status: g.id === 'A31' ? 'OUT_OF_WEB_SCOPE_NATIVE_GODOT' : isF01 ? 'IMPLEMENTED_CORE_ACTION' : 'IMPLEMENTED_OR_PARTIAL',
      shipping_status: g.id === 'A31' ? 'N/A' : 'LIVE',
      veyra_status: g.id === 'A20' || g.id === 'A22' ? 'PARTIAL_VEYRA_DIVERGENCE' : g.id === 'A31' ? 'N/A' : 'LIVE',
      soh_node_or_edge_refs: `gate_doc:${g.id}`,
      soh_code_refs: isF01 ? 'sim.ts:coreCast,balance.v1.json' : 'engine.ts,tests/',
      provenance_tag: 'LI_REPO_ARCHIVE_VERIFIED',
      parity_notes: `Owner=${g.owner} | Priority=${g.priority}`,
    });
  }

  // 5) 36 Decisions (H01..H36)
  for (const h of decisions36) {
    push({
      source_group: 'CREATOR_DECISION',
      li_ref_id: h.id,
      li_domain: h.scope,
      li_description: h.decision_or_fact,
      soh_status: h.id === 'H36' ? 'RESOLVED_IN_CURRENT_REPO_ATLAS' : h.status,
      shipping_status: 'APPLIED',
      veyra_status: h.id === 'H09' ? 'NOT_APPLIED_NO_LOOT_ECOLOGY' : h.id === 'H07' ? 'PARTIAL_OIL_TEST_FIXTURE' : 'APPLIED',
      soh_node_or_edge_refs: `decision:${h.id}`,
      soh_code_refs: 'web/ref/bible.md,web/src/game/',
      provenance_tag: 'LI_REPO_ARCHIVE_VERIFIED',
      parity_notes: `Constraint=${h.constraint}`,
    });
  }

  // 6) Live-Verified Official & Community LI Mechanics (hero.yingxiong.com / 4399 / TapTap)
  const liLiveRows: Array<[string, string, string, string, string, string, string, string]> = [
    ['LI_LIVE_01', 'poi_card_ladder', 'hero.yingxiong.com 6977/7028 & news.4399 895633: Green -> Blue -> Purple card progression with generator timer doors', 'IMPLEMENTED_SHIPPING_SINGLE_TIER', 'LIVE (keycard+power)', 'ABSENT (0 card doors)', 'poi_gate:keycard/*; poi_gate:power/*', 'LI_OFFICIAL_LIVE_VERIFIED'],
    ['LI_LIVE_02', 'recycler_spares', 'hero.yingxiong.com 10634 & TapTap 304314693734893241: Recycler decomposes components & weapons into Spares/Iron', 'IMPLEMENTED_SHIPPING_ONLY', 'LIVE (Foundry Recycler)', 'ABSENT (direct-v1)', 'station:recycler; recipe:recycler:*', 'LI_OFFICIAL_LIVE_VERIFIED'],
    ['LI_LIVE_03', 'research_spares_economy', 'TapTap 304314693734893241: Random research vs Workbench item study spend Spares & compete with gear crafting', 'IMPLEMENTED_SOH_TUNED', 'LIVE (4 random / 9 directed)', 'LIVE (specimen 0 Spares)', 'station:research; currency:spares', 'LI_COMMUNITY_LIVE_VERIFIED'],
    ['LI_LIVE_04', 'territory_cabinet_upkeep', 'hero.yingxiong.com 11237 & bbs.4399 40162443: Territory Cabinet prevents decay via 24h upkeep material reserve', 'IMPLEMENTED_PROVISIONAL', 'LIVE (25%/24h)', 'LIVE (25%/24h)', 'station:claim; sink:territory_upkeep_24h', 'LI_OFFICIAL_LIVE_VERIFIED'],
    ['LI_LIVE_05', 'electrical_circuits', 'hero.yingxiong.com 13285: Fuel generator powers branches, switches, pressure plates, IR sensors, powered doors, turrets', 'IMPLEMENTED_WIRE_V1', 'LIVE', 'LIVE', 'station:base_generator; station:ir_sensor; station:arrow_turret', 'LI_OFFICIAL_LIVE_VERIFIED'],
    ['LI_LIVE_06', 'vehicle_fuel_parts', 'hero.yingxiong.com 7249/13052: Vehicles consume fuel canisters, suffer chassis wear, require parts/maintenance', 'IMPLEMENTED_PROVISIONAL', 'LIVE (motorbike + lube)', 'LIVE (motorbike + lube)', 'station:motorbike; item:fuel_can; item:lubricant', 'LI_OFFICIAL_LIVE_VERIFIED'],
    ['LI_LIVE_07', 'trade_currency_isolation', 'hero.yingxiong.com 11237/14825: Trade/shop currencies vs cross-server action vault persistence', 'IMPLEMENTED_CASH_ONLY_ESCROW', 'LIVE (spares + rcash->securedCash)', 'LIVE (spares + rcash->securedCash)', 'currency:spares; currency:rcash; currency:secured_cash', 'LI_OFFICIAL_LIVE_VERIFIED'],
    ['LI_LIVE_08', 'oil_refinery_tiers', 'hero.yingxiong.com 13052: Oil drums/pumpjacks feed crude oil -> oil refinery -> low-grade fuel', 'SPLIT_LIVE_AND_FIXTURE', 'PARTIAL (salvaged_oil live; pump fixture)', 'PARTIAL (salvaged_oil live; pump fixture)', 'station:refinery; station:oil_pump', 'LI_OFFICIAL_LIVE_VERIFIED'],
    ['LI_LIVE_09', '9game_captcha_blocked', '9game.cn 3279007/3676549/3336352/3448709: Slider anti-bot verification blocked retrieval', 'BLOCKED_NOT_PARSED', 'UNVERIFIED_EXTERNAL', 'UNVERIFIED_EXTERNAL', 'N/A', 'CAPTCHA_BLOCKED_AT_CHECK'],
  ];
  for (const [id, dom, desc, soh, ship, veyra, refs, prov] of liLiveRows) {
    push({
      source_group: 'LI_LIVE_SOURCE',
      li_ref_id: id,
      li_domain: dom,
      li_description: desc,
      soh_status: soh,
      shipping_status: ship,
      veyra_status: veyra,
      soh_node_or_edge_refs: refs,
      soh_code_refs: 'LI_SOURCE_EVIDENCE.md',
      provenance_tag: prov,
      parity_notes: prov === 'CAPTCHA_BLOCKED_AT_CHECK' ? 'Explicitly marked blocked; zero claims inferred' : 'Cross-checked directly against live LI source',
    });
  }

  // 7) SOH-Exclusive Economic Systems Absent from LI
  const sohOnlyRows: Array<[string, string, string, string, string, string, string]> = [
    ['SOH_ONLY_01', 'elders_and_primordials', '6 Legacy Elders (Shipping) + 6 Primordial Elders (Veyra) awarding optional Elder Stones + 6 spares + 2 crystal', 'LIVE', 'LIVE (Primordials)', 'elder:legacy:*; elder:primordial:*', 'catalog.ts:ELDERS,PRIMORDIAL_ELDERS; veyra05/ecosystem.ts'],
    ['SOH_ONLY_02', 'side_bosses_veyra', '4 Optional Veyra Side Bosses dropping unique run-local weapons/armor once per run', 'ABSENT', 'LIVE', 'creature:boss_*; SIDE_BOSS_UNIQUE_DROP', 'catalog.ts:CREATURES.boss_*; veyra05/ecosystem.ts'],
    ['SOH_ONLY_03', 'livestock_husbandry', 'Tamable boar/deer/hare/grouse penning, feeding, sex-based breeding, egg/molt yields, butchery, fox raids', 'LIVE', 'LIVE', 'husbandry:*; station:feed_trough', 'husbandry.ts'],
    ['SOH_ONLY_04', 'journey_requisitions', 'Daily Journey Ledger milestones (ember/hearth/beacon) injecting off-map securedCash + items', 'LIVE', 'LIVE', 'requisition:*; JOURNEY_REQUISITION', 'balance.v1.json:journeyRequisitions; engine.ts'],
    ['SOH_ONLY_05', 'salt_and_canvas', 'Coastal Salt Shale -> raw_salt -> salted_meat & treated_canvas -> trail_pack/trail_canteen', 'LIVE', 'LIVE', 'world_source:salt_shale; item:raw_salt; item:treated_canvas', 'catalog.ts:SOURCES.salt_shale,RECIPES'],
    ['SOH_ONLY_06', 'quality_extraction_tiers', 'Tool power >=5 / >=8 unlocks rich_iron_ore quality tier from iron veins', 'LIVE', 'LIVE', 'HARVEST_QUALITY_TIER; item:rich_iron_ore', 'catalog.ts:qualityTierFor'],
    ['SOH_ONLY_07', 'garden_cold_frame_tender', 'Cold-frame garden upgrade + automated fuel-powered Garden Tender (farm_controller)', 'LIVE', 'LIVE', 'station:garden_cold_frame; station:farm_controller', 'catalog.ts:GARDEN_CROPS; engine.ts:stepTenders'],
    ['SOH_ONLY_08', 'bear_trap_and_ir_sensor', 'Mechanical Bear Trap (iron_plate arming, 3 triggers) & wire-v1 Infrared Sensor', 'LIVE', 'LIVE', 'station:bear_trap; station:ir_sensor; TRAP_ARM_SINK', 'balance.v1.json:bearTrapV1,irSensorV1'],
    ['SOH_ONLY_09', 'veyra_81_poi_stack', '81-POI continuous U=0.5 streaming frame with multi-storey floors (-1..2) & 13 ARCHETYPE_LOOT presets', 'ABSENT', 'LIVE', 'container:veyra:*', 'veyra05/{window,floors,reader,arch/sites}.ts'],
    ['SOH_ONLY_10', 'salvaged_oil_wreck_chance', 'Source v3 Car Wrecks drop salvaged_oil (0.35/unit) independently of Map-owned oil_pump fixture', 'LIVE', 'LIVE', 'HARVEST_BONUS -> item:salvaged_oil', 'engine.ts:harvestHit; catalog.ts:SALVAGED_OIL_WRECK_CHANCE'],
    ['SOH_ONLY_11', 'seasonal_wild_regrowth', '8-season 336h calendar scaling crop/herb garden & wild plant regrowth rates', 'LIVE', 'LIVE', 'gate:run_wipe_336h; world_source:bush/grass/reed/herb/mushroom', 'calendar.ts; balance.v1.json:wildRegrowth,seasonClimateV1'],
    ['SOH_ONLY_12', 'creator_core_21_actions', '7 Creator Cores sharing 2 energy SKUs + 4 elemental essences (with earthmother wood generation)', 'LIVE', 'PARTIAL (core_demon/essence_spirit craft blocked)', 'CORE_LOAD; CORE_CAST_SINK; CORE_CAST_OUTPUT', 'sim.ts:coreCast; catalog.ts:ALWAYS_KNOWN_RECIPES'],
  ];
  for (const [id, dom, desc, ship, veyra, refs, code] of sohOnlyRows) {
    push({
      source_group: 'SOH_EXCLUSIVE',
      li_ref_id: id,
      li_domain: dom,
      li_description: desc,
      soh_status: 'SOH_EXCLUSIVE_NOT_IN_LI',
      shipping_status: ship,
      veyra_status: veyra,
      soh_node_or_edge_refs: refs,
      soh_code_refs: code,
      provenance_tag: 'LIVE_VERIFIED_SOH',
      parity_notes: 'Invented/adapted specifically for Soul of Hero',
    });
  }

  return rows;
}

describe('WP1 / Milestone M1 — SOH Economic Multigraph & LI Crosswalk', () => {
  it('extracts a complete, valid, deterministic multigraph across Shipping, dev_delta, and all 81 Veyra POIs, and generates M1 deliverables', () => {
    const input = collectExtractionInput();
    const graph1 = buildSohEconomicGraph(input);
    const graph2 = buildSohEconomicGraph(input);

    // 1. Determinism & zero validation errors
    const errors = validateEconomicGraph(graph1);
    expect(errors).toEqual([]);
    expect(JSON.stringify(graph1)).toBe(JSON.stringify(graph2));

    // 2. Full catalog & Veyra 81-POI coverage
    // Real live codebase defect: po_greywater L0 'Tackle Box' (sites.ts:67) and 'Cottage Ladder' (sites.ts:110) share tile (1642, 1176),
    // so floors.ts occupiedStatic silently drops Tackle Box and materializes 23 of 24 authored caches.
    const greyL0 = authoredPlan('po_greywater')!.levels.get(0)!;
    const greyCache = greyL0.loot.find((l) => l.label === 'Tackle Box')!;
    const greyLadder = greyL0.stairs.find((s) => s.x === greyCache.x && s.y === greyCache.y && s.from === 0);
    expect(greyLadder?.label).toBe('Cottage Ladder');
    expect(graph1.summary.veyraPoiStats.totalPois).toBe(POIS.length);
    expect(graph1.summary.veyraPoiStats.totalPois).toBe(81);
    expect(graph1.summary.veyraPoiStats.authoredCachePois).toBe(6);
    expect(graph1.summary.veyraPoiStats.authoredCacheTotal).toBe(23);
    expect(graph1.summary.veyraPoiStats.rcashPois).toBe(6);
    expect(graph1.summary.veyraPoiStats.vendorPois).toBe(2);
    expect(graph1.summary.veyraPoiStats.evacPois).toBe(3);
    expect(graph1.summary.veyraPoiStats.elderPois).toBe(6);
    expect(graph1.summary.veyraPoiStats.keycardDoors).toBe(0);
    expect(graph1.summary.veyraPoiStats.powerDoors).toBe(0);

    // Every catalog key accounted for
    expect(graph1.summary.nodesByKind.item).toBe(Object.keys(ITEMS).length);
    expect(graph1.summary.nodesByKind.world_source).toBe(Object.keys(SOURCES).length + 1); // + oil_site_fixture
    expect(graph1.summary.nodesByKind.structure).toBe(Object.keys(STRUCTS).length);
    expect(graph1.summary.nodesByKind.creature).toBe(Object.keys(CREATURES).length);
    expect(graph1.summary.nodesByKind.elder).toBe(
      Object.keys(ELDERS).length + Object.keys(PRIMORDIAL_ELDERS).length,
    );
    expect(graph1.summary.nodesByKind.vendor_offer).toBe(
      Object.keys(VENDOR_SPARES).length + Object.keys(VENDOR_SECURED).length,
    );

    // Confirmed code-grounded Veyra gaps appear in diagnostics
    expect(graph1.diagnostics.veyraUnreachableItems).toContain('damaged_drive');
    expect(graph1.diagnostics.veyraUnreachableItems).toContain('crude_petroleum');
    expect(graph1.diagnostics.veyraUnreachableItems).toContain('chitin');
    expect(graph1.diagnostics.veyraUnreachableItems).toContain('crawler_optic');
    expect(graph1.diagnostics.veyraUnreachableItems).toContain('chitin_armor');
    expect(graph1.diagnostics.veyraUnreachableItems).toContain('core_demon');
    expect(graph1.diagnostics.veyraUnreachableItems).toContain('keycard');
    expect(graph1.diagnostics.veyraUnreachableItems).toContain('wolf_fang');
    expect(graph1.diagnostics.veyraUnreachableItems).toContain('beetle_horn');
    expect(graph1.diagnostics.veyraUncraftableRecipes).toContain('chitin_armor');
    expect(graph1.diagnostics.veyraUncraftableRecipes).toContain('core_demon');
    expect(graph1.diagnostics.veyraUncraftableRecipes).toContain('essence_spirit');
    expect(graph1.diagnostics.veyraUncraftableRecipes).toContain('recover_drive');
    expect(graph1.diagnostics.shippingUnreachableItems).toContain('crude_petroleum');
    expect(graph1.diagnostics.shippingUncraftableRecipes).toContain('pump_crude');
    expect(graph1.diagnostics.shippingUncraftableRecipes).toContain('refinery_crude');

    // 3. Build & assert exhaustive LI Crosswalk
    const cwRows = buildCrosswalkRows();
    expect(cwRows.length).toBeGreaterThanOrEqual(17 + 12 + 104 + 32 + 36 + 9 + 12);
    const idSet = new Set(cwRows.map((r) => r.li_ref_id));
    for (let i = 1; i <= 17; i++) expect(idSet.has(`S${String(i).padStart(2, '0')}`)).toBe(true);
    for (let i = 1; i <= 12; i++) expect(idSet.has(`U${String(i).padStart(2, '0')}`)).toBe(true);
    for (let i = 1; i <= 104; i++) expect(idSet.has(`XEDGE-${String(i).padStart(3, '0')}`)).toBe(true);
    for (let i = 0; i <= 31; i++) expect(idSet.has(`A${String(i).padStart(2, '0')}`)).toBe(true);
    for (let i = 1; i <= 36; i++) expect(idSet.has(`H${String(i).padStart(2, '0')}`)).toBe(true);

    // 4. Write deterministic deliverables into web/reports/economic-network/
    mkdirSync(REPORTS_DIR, { recursive: true });
    writeFileSync(
      resolve(REPORTS_DIR, 'SOH_ECONOMIC_GRAPH.json'),
      JSON.stringify(graph1, null, 2) + '\n',
      'utf8',
    );

    const headers: (keyof CrosswalkRow)[] = [
      'row_id',
      'source_group',
      'li_ref_id',
      'li_domain',
      'li_description',
      'soh_status',
      'shipping_status',
      'veyra_status',
      'soh_node_or_edge_refs',
      'soh_code_refs',
      'provenance_tag',
      'parity_notes',
    ];
    const csvOut =
      headers.join(',') +
      '\n' +
      cwRows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')).join('\n') +
      '\n';
    writeFileSync(resolve(REPORTS_DIR, 'SOH_LI_ECONOMIC_CROSSWALK.csv'), csvOut, 'utf8');

    // Quick sanity check that every RECIPES key has a recipe node
    for (const rk of Object.keys(RECIPES)) {
      expect(graph1.nodes.some((n) => n.id === `recipe:${rk}`)).toBe(true);
    }
  }, 120_000);
});
