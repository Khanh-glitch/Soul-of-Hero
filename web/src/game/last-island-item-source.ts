/** Last Island source-of-truth COPY-FIRST snapshot, intentionally read-only.
 * This is research data, NOT an active ITEMS/RECIPES/LOOT mutation.
 * Do not give a source row an inventory sprite or a fake ability just to pass parity counts.
 */
import json from '../../ref/last-island-copy-first/LI_SOURCE_ITEMS_AND_RECIPES.json';

export const LI_ITEM_SOURCE = Object.freeze(json.items);
export type LIItemSource = (typeof LI_ITEM_SOURCE)[number];

const BY_ID: ReadonlyMap<string, LIItemSource> = new Map(LI_ITEM_SOURCE.map(item => [item.li_id, item]));

export function liSourceItem(liId: string): LIItemSource | null {
  return BY_ID.get(liId) ?? null;
}

export function liHistoricalFormula(liId: string): LIItemSource['historical_recipe'] | null {
  const item = liSourceItem(liId);
  if (!item || item.copy_policy === 'PRESERVE_UNVERIFIED_NO_INVENTION') return null;
  const ingredients = item.historical_recipe.ingredients;
  return ingredients && Object.keys(ingredients).length > 0 ? item.historical_recipe : null;
}

export function liSourceItemsByCategory(category: string): readonly LIItemSource[] {
  return LI_ITEM_SOURCE.filter(item => item.category === category);
}
