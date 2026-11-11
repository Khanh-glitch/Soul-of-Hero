import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ITEMS, RECIPES } from '../src/game/catalog';
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
  it('Generates SOH_ITEM_FUNCTION_AUDIT.csv covering 100% of ITEMS with 16 fields and zero anti-equipment bias', () => {
    const { csv, rowCount } = generateItemFunctionAuditCsv();
    mkdirSync(REPORTS_DIR, { recursive: true });
    writeFileSync(ITEM_AUDIT_CSV, csv, 'utf8');

    const stats = auditSummaryStats();
    expect(rowCount).toBe(stats.totalCatalogItems);
    expect(stats.creatorCoreCount).toBe(7);
    expect(stats.legacyCoreCount).toBe(4);

    const lines = csv.trim().split('\n');
    const header = parseCsvRow(lines[0]);
    expect(header.length).toBe(16);

    const rows = lines.slice(1).map(parseCsvRow);
    const seenIds = new Set(rows.map((r) => r[0]));
    for (const key of Object.keys(ITEMS)) expect(seenIds.has(key)).toBe(true);

    // Every equipment, weapon, armor, core, food, med, and boss trophy is never labeled DEAD_END/worthless
    for (const r of rows) {
      expect(r.length).toBe(16);
      const id = r[0];
      const def = ITEMS[id];
      const role = r[13];
      if (['food', 'tool', 'weapon', 'armor', 'core', 'stone', 'kit'].includes(def.cat)) {
        expect(role).not.toBe('DEAD_END_OR_LOW_LINK');
      }
    }

    // Legacy cores vs Creator Core Gold SKUs strictly separated
    const coreFireRow = rows.find((r) => r[0] === 'core_fire')!;
    const coreDragonRow = rows.find((r) => r[0] === 'core_dragon')!;
    expect(coreFireRow[2]).toContain('LEGACY_CORE_CHARGE');
    expect(coreDragonRow[2]).toContain('CREATOR_CORE_GOLD_SKU');
  }, 60_000);

  it('Generates SOH_RECIPE_ROUTE_AUDIT.csv covering all RECIPES, Recycler rules, Focus chains & Core Energy with 0 active OVER_RETURN', () => {
    const { csv, rowCount } = generateRecipeRouteAuditCsv();
    mkdirSync(REPORTS_DIR, { recursive: true });
    writeFileSync(ROUTE_AUDIT_CSV, csv, 'utf8');

    const lines = csv.trim().split('\n');
    const header = parseCsvRow(lines[0]);
    expect(header.length).toBe(16);
    const rows = lines.slice(1).map(parseCsvRow);
    expect(rowCount).toBe(rows.length);

    const routeIds = new Set(rows.map((r) => r[0]));
    for (const rk of Object.keys(RECIPES)) expect(routeIds.has(rk)).toBe(true);
    for (const ck of ['X:gear-v1', 'X:pipe-v2', 'X:blade-v1', 'X:drive']) expect(routeIds.has(ck)).toBe(true);

    // All active (non-superseded) recycler routes maintain net loss / zero active OVER_RETURN
    const activeRecycleRows = rows.filter(
      (r) =>
        (r[1] === 'RECYCLE_COMPONENT' || r[1] === 'RECYCLE_TOOL_WEAPON') &&
        r[4] === 'LIVE_ACTIVE_PLAN',
    );
    expect(activeRecycleRows.length).toBeGreaterThan(0);
    for (const r of activeRecycleRows) {
      expect(r[10]).not.toMatch(/OVER_RETURN\(HISTORICAL|^\s*OVER_RETURN/);
      expect(r[10]).toContain('NET_LOSS_VERIFIED');
    }

    // Focus chains cleanly tagged: Gear, Pipe, Blade, Plate, Refined Iron, Mechanical Parts, Spares, Fuel, Core Energy
    const focusGroups = new Set(rows.map((r) => r[2]));
    expect(focusGroups.has('FOCUS_GEAR_PIPE_BLADE_PLATE')).toBe(true);
    expect(focusGroups.has('FOCUS_IRON_PARTS_SPARES')).toBe(true);
    expect(focusGroups.has('FOCUS_FUEL_POWER_OIL')).toBe(true);
    expect(focusGroups.has('FOCUS_CORE_ENERGY')).toBe(true);
  });
});
