import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ITEMS, PRIMORDIAL_ELDERS, RECIPES } from '../src/game/catalog';
import {
  auditSummaryStats,
  generateItemFunctionAuditCsv,
  generateRecipeRouteAuditCsv,
} from '../src/game/economic-audits-m5';

const REPORTS_DIR = resolve(process.cwd(), 'reports', 'economic-network');
const ITEM_AUDIT_CSV = resolve(REPORTS_DIR, 'SOH_ITEM_FUNCTION_AUDIT.csv');
const ROUTE_AUDIT_CSV = resolve(REPORTS_DIR, 'SOH_RECIPE_ROUTE_AUDIT.csv');

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

describe('SOH M5 Complete Item Function & Recipe Route Audits', () => {
  it('Generates SOH_ITEM_FUNCTION_AUDIT.csv covering 100% of ITEMS with 17 fields, provenance tiers, and zero false MISSING_VEYRA_SOURCE defects', () => {
    const { csv, rowCount } = generateItemFunctionAuditCsv();
    mkdirSync(REPORTS_DIR, { recursive: true });
    writeFileSync(ITEM_AUDIT_CSV, csv, 'utf8');

    const stats = auditSummaryStats();
    expect(rowCount).toBe(stats.totalCatalogItems);
    expect(stats.creatorCoreCount).toBe(7);
    expect(stats.legacyCoreCount).toBe(4);

    const lines = csv.trim().split('\n');
    const header = parseCsvRow(lines[0]);
    expect(header.length).toBe(17);
    expect(header[16]).toBe('verification_tier');

    const rows = lines.slice(1).map(parseCsvRow);
    const byId = new Map(rows.map((r) => [r[0], r]));
    for (const key of Object.keys(ITEMS)) expect(byId.has(key)).toBe(true);

    // Every equipment, weapon, armor, core, food, med, and boss trophy is never labeled DEAD_END/worthless
    for (const r of rows) {
      expect(r.length).toBe(17);
      const id = r[0];
      const def = ITEMS[id];
      const shipAvail = r[11];
      const veyraAvail = r[12];
      const role = r[13];
      const tier = r[16];
      if (['food', 'tool', 'weapon', 'armor', 'core', 'stone', 'kit'].includes(def.cat)) {
        expect(role).not.toBe('DEAD_END_OR_LOW_LINK');
      }
      // Never emit unconditional bare AVAILABLE(...) claims or premature VISUALLY_PROVEN tags
      expect(shipAvail).not.toMatch(/(?:^|\+)AVAILABLE\(/);
      expect(veyraAvail).not.toMatch(/(?:^|\+)AVAILABLE\(/);
      expect(tier).not.toContain('VISUALLY_PROVEN');
    }

    // Regression checks for previously misclassified items
    expect(byId.get('knife')![11]).toContain('RUNTIME_GRANTED_AT_SPAWN');
    expect(byId.get('knife')![12]).toContain('RUNTIME_GRANTED_AT_SPAWN');

    expect(byId.get('crop')![12]).toContain('CONDITIONAL_GARDEN');
    expect(byId.get('crop')![12]).not.toContain('MISSING_VEYRA_SOURCE');

    expect(byId.get('salvaged_oil')![11]).toContain('PHYSICALLY_REACHABLE(src=');
    expect(byId.get('salvaged_oil')![12]).toContain('PHYSICALLY_REACHABLE(src=');
    expect(byId.get('salvaged_oil')![12]).toContain('vendor_spares');

    expect(byId.get('blueprint')![11]).toContain('PHYSICALLY_REACHABLE(static_blueprints=');
    expect(byId.get('blueprint')![12]).toContain('PHYSICALLY_REACHABLE(static_blueprints=');
    expect(byId.get('blueprint')![12]).toContain('Floor0_&_Floor-1');

    expect(byId.get('rcash')![11]).toContain('CONDITIONAL_PHASE_GATED(Ragnarok>=264h');
    expect(byId.get('rcash')![12]).toContain('CONDITIONAL_PHASE_GATED(Ragnarok>=264h');

    expect(byId.get('escrow_chest')![11]).toContain('CONDITIONAL_VENDOR_PURCHASE(30_Ragnarok_rcash');
    expect(byId.get('escrow_chest')![12]).toContain('CONDITIONAL_VENDOR_PURCHASE(30_Ragnarok_rcash');

    for (const p of Object.values(PRIMORDIAL_ELDERS)) {
      const row = byId.get(p.stone)!;
      expect(row[11]).toContain('VEYRA_EXCLUSIVE');
      expect(row[12]).toContain('CONDITIONAL_BOSS_DEFEAT(primordial:');
      expect(row[12]).not.toContain('MISSING_VEYRA_SOURCE');
    }

    expect(byId.get('gas_mask')![12]).toContain('CONDITIONAL_CRAFTABLE');
    expect(byId.get('fur_cloak')![12]).toContain('CONDITIONAL_CRAFTABLE');
    expect(byId.get('keycard')![12]).toContain('NOT_PLACED_ON_VEYRA');
    expect(byId.get('crude_petroleum')![11]).toContain('CONDITIONAL_TEST_FIXTURE_GATED');
    expect(byId.get('crude_petroleum')![12]).toContain('CONDITIONAL_TEST_FIXTURE_GATED');

    // Genuinely missing Shipping-only creature materials stay accurately flagged
    for (const missing of ['chitin', 'beetle_horn', 'crawler_optic', 'wolf_fang']) {
      expect(byId.get(missing)![12]).toContain('MISSING_VEYRA_SOURCE');
    }
    expect(byId.get('chitin_armor')![12]).toContain('BLOCKED_VEYRA');
    expect(byId.get('core_demon')![12]).toContain('BLOCKED_VEYRA');

    // Legacy cores vs Creator Core Gold SKUs strictly separated
    const coreFireRow = byId.get('core_fire')!;
    const coreDragonRow = byId.get('core_dragon')!;
    expect(coreFireRow[2]).toContain('LEGACY_CORE_CHARGE');
    expect(coreDragonRow[2]).toContain('CREATOR_CORE_GOLD_SKU');
  }, 60_000);

  it('Generates SOH_RECIPE_ROUTE_AUDIT.csv covering all RECIPES, Recycler, Husbandry, Research & Offscreen routes with 0 active OVER_RETURN and 0 stale PRE_D5', () => {
    const { csv, rowCount } = generateRecipeRouteAuditCsv();
    mkdirSync(REPORTS_DIR, { recursive: true });
    writeFileSync(ROUTE_AUDIT_CSV, csv, 'utf8');

    const lines = csv.trim().split('\n');
    const header = parseCsvRow(lines[0]);
    expect(header.length).toBe(17);
    expect(header[16]).toBe('verification_tier');
    const rows = lines.slice(1).map(parseCsvRow);
    expect(rowCount).toBe(rows.length);

    const byRoute = new Map(rows.map((r) => [r[0], r]));
    for (const rk of Object.keys(RECIPES)) expect(byRoute.has(rk)).toBe(true);
    for (const ck of [
      'X:gear-v1', 'X:pipe-v2', 'X:blade-v1', 'X:drive',
      'X:recover-v3:iron_sword', 'X:recover-v3:iron_pick', 'X:recover-v3:iron_axe',
      'X:recover-v3:industrial_axe', 'X:recover-v1:industrial_pick', 'X:recover-v1:reinforced_spear',
      'husbandry:grouse', 'butcher:boar', 'research:random_spares', 'research:directed_spares',
      'vendor_escrow:escrow_chest', 'industrial:offscreen_catchup',
    ]) {
      expect(byRoute.has(ck)).toBe(true);
    }

    // Zero stale PRE_D5 or pending_WP3 strings anywhere in active routes, and zero premature VISUALLY_PROVEN claims
    for (const r of rows) {
      expect(r.length).toBe(17);
      expect(r.join('|')).not.toContain('PRE_D5');
      expect(r[16]).not.toContain('pending_WP3');
      expect(r[16]).not.toContain('VISUALLY_PROVEN');
    }
    expect(byRoute.get('X:drive')![16]).toContain('wp3_veyra_natural_loop');
    expect(byRoute.get('vehicle_frame')![16]).toContain('wp3_veyra_natural_loop');

    // All active (non-superseded) recycler routes maintain net loss / zero active OVER_RETURN and reflect D5 Veyra Foundry live
    const activeRecycleRows = rows.filter(
      (r) =>
        (r[1] === 'RECYCLE_COMPONENT' || r[1] === 'RECYCLE_TOOL_WEAPON' || r[1] === 'RECYCLE_DRIVE') &&
        r[4] === 'LIVE_ACTIVE_PLAN',
    );
    expect(activeRecycleRows.length).toBe(10);
    for (const r of activeRecycleRows) {
      expect(r[10]).not.toMatch(/OVER_RETURN\(HISTORICAL|^\s*OVER_RETURN/);
      if (r[1] !== 'RECYCLE_DRIVE') expect(r[10]).toContain('NET_LOSS_VERIFIED');
      expect(r[12]).toBe('NONE');
      expect(r[13]).toContain('BOTH_LIVE');
    }

    // Focus chains cleanly tagged: Gear, Pipe, Blade, Plate, Refined Iron, Mechanical Parts, Spares, Fuel, Core Energy
    const focusGroups = new Set(rows.map((r) => r[2]));
    expect(focusGroups.has('FOCUS_GEAR_PIPE_BLADE_PLATE')).toBe(true);
    expect(focusGroups.has('FOCUS_IRON_PARTS_SPARES')).toBe(true);
    expect(focusGroups.has('FOCUS_FUEL_POWER_OIL')).toBe(true);
    expect(focusGroups.has('FOCUS_CORE_ENERGY')).toBe(true);
  });
});
