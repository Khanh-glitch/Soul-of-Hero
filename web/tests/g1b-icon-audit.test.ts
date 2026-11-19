/**
 * G1B batch-3.2 P3B — item-icon live-runtime audit.
 *
 * Verifies the runtime icon resolution path (src/game/item-atlas.ts + src/ui/common.tsx iconUrl):
 *   - the 157-item approved atlas is decoded and maps exactly 156 carried-item ids (one atlas frame,
 *     `door_powered`, is a structure icon, not a carried item);
 *   - every catalog id WITHOUT an approved atlas cell resolves to the procedural drawn icon fallback
 *     (`atlasIconUrl(id) === ''` and the UI tags it `data-icon="drawn"`), and that set is exactly the
 *     25 recorded ids;
 *   - no catalog id is silently dropped: every ITEMS key resolves to either the atlas or the drawn icon.
 *
 * This is ENGINEERING VERIFIED — it checks the icon resolution wiring, not whether the art is accepted.
 * Art acceptability is the Creator's verdict (DESIGN / CREATOR PLAYTEST), recorded separately.
 */
import { describe, it, expect } from 'vitest';
import { ITEM_ATLAS, ITEMS_WITHOUT_APPROVED_ICON, hasApprovedIcon, atlasIconUrl } from '../src/game/item-atlas';
import { ITEMS } from '../src/game/catalog';

describe('G1B batch-3.2 P3B — item-icon live-runtime audit', () => {
  it('the atlas maps 156 carried items + 1 structure frame, and the 25 without approved art resolve to the drawn fallback', () => {
    expect(Object.keys(ITEM_ATLAS.frames)).toHaveLength(157);
    expect(ITEM_ATLAS.tileSize).toBe(32);
    // one atlas frame is a structure icon, not a carried item
    const structureFrames = Object.keys(ITEM_ATLAS.frames).filter(k => !ITEMS[k]);
    expect(structureFrames).toEqual(['door_powered']);
    const mapped = Object.keys(ITEMS).filter(hasApprovedIcon);
    expect(mapped).toHaveLength(156);

    // the 25 catalog ids without approved art — the drawn-icon set
    const without = [...ITEMS_WITHOUT_APPROVED_ICON];
    expect(without).toHaveLength(25);
    for (const id of without) {
      expect(ITEMS[id], id).toBeTruthy();                    // a real catalog id
      expect(hasApprovedIcon(id), id).toBe(false);           // no approved atlas cell
      expect(atlasIconUrl(id), id).toBe('');                 // resolves to '' → UI falls back to drawn
    }
    // no catalog id is unresolvable: every key is either atlas-mapped or in the drawn set
    const all = Object.keys(ITEMS);
    expect(all.length).toBe(181);                            // 156 atlas + 25 drawn
    expect(all.filter(k => !hasApprovedIcon(k)).sort()).toEqual(without);
    // the atlas and drawn sets partition the catalog exactly: no overlap, full coverage
    const drawnSet = new Set(without);
    expect(mapped.some(k => drawnSet.has(k))).toBe(false);
    expect(all.length).toBe(mapped.length + without.length);
  });
});
