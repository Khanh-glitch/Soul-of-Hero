/** The approved 157-item atlas is the icon source for every catalog id it covers; the ids it does not cover are a fixed, disclosed list. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ITEMS } from '../src/game/catalog';
import { ITEM_ATLAS, ITEMS_WITHOUT_APPROVED_ICON, hasApprovedIcon } from '../src/game/item-atlas';

describe('157-item icon atlas', () => {
  it('has 157 distinct 32×32 cells inside the real PNG', () => {
    const png = readFileSync(resolve(__dirname, '../public', ITEM_ATLAS.image.replace(/^\//, '')));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([ITEM_ATLAS.width, ITEM_ATLAS.height]);
    expect(readFileSync(resolve(__dirname, '../src/game/item-atlas-157.json'), 'utf8'), 'bundled index = approved index').toBe(readFileSync(resolve(__dirname, '../public/assets/atlas/soh_items_157_atlas.json'), 'utf8'));
    const frames = Object.entries(ITEM_ATLAS.frames); expect(frames).toHaveLength(157); expect(ITEM_ATLAS.tileSize).toBe(32);
    const cells = new Set<string>();
    for (const [id, f] of frames) { expect([f.w, f.h], id).toEqual([32, 32]); expect(f.x % 32 + f.y % 32, id).toBe(0); expect(f.x + 32 <= ITEM_ATLAS.width && f.y + 32 <= ITEM_ATLAS.height, id).toBe(true); cells.add(`${f.x},${f.y}`); }
    expect(cells.size).toBe(157);
  });
  it('maps 156 catalog ids by their own id; the rest of the catalog is the disclosed no-art list', () => {
    const mapped = Object.keys(ITEMS).filter(hasApprovedIcon); expect(mapped).toHaveLength(156);
    expect(Object.keys(ITEM_ATLAS.frames).filter(k => !ITEMS[k])).toEqual(['door_powered']);   // a structure icon, not a carried item
    expect([...ITEMS_WITHOUT_APPROVED_ICON]).toEqual(['brick', 'coal', 'damaged_drive', 'fasteners', 'field_repair_kit', 'fuel_briquette', 'herb_roast', 'iron_sword', 'keycard', 'lubricant', 'mechanical_parts', 'raw_salt', 'root_broth', 'salted_meat', 'salvaged_oil', 'scrap', 'seed', 'stone_bog', 'stone_frost', 'stone_grove', 'stone_magma', 'stone_rust', 'stone_tide', 'treated_canvas', 'vehicle_drive']);
    expect(mapped.length + ITEMS_WITHOUT_APPROVED_ICON.length).toBe(Object.keys(ITEMS).length);
  });
});
