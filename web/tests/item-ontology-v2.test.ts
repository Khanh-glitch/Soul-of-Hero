import { describe, expect, it } from 'vitest';
import { ITEMS, RECIPES } from '../src/game/catalog';
import { buildEconomicGraph, ITEM_ONTOLOGY_VERSION } from '../src/game/economic-graph';

describe('Item ontology V2 derived graph', () => {
  it('uses the production item registry and accounts for every recipe output/input', () => {
    const graph = buildEconomicGraph();
    expect(ITEM_ONTOLOGY_VERSION).toBe(2);
    expect(ITEMS.mechanical_parts.name).toBe('Parts');
    expect(ITEMS.refined_iron_ingot.name).toBe('Refined Iron');
    expect(graph.items.find(x => x.id === 'mechanical_parts')?.disposition).toBe('RENAME');
    expect(graph.items.find(x => x.id === 'spares')?.disposition).toBe('KEEP');
    expect(graph.items).toHaveLength(Object.keys(ITEMS).length);
    expect(graph.recipeCount).toBe(Object.keys(RECIPES).length);
    for (const id of Object.keys(RECIPES)) {
      const recipe = RECIPES[id];
      const outs = recipe.outs ?? [[recipe.out, recipe.qty] as [string, number]];
      expect(graph.items.find(x => x.id === outs[0][0])?.sources.some(source => source.startsWith(`Craft: ${id} ·`))).toBe(true);
      for (const [input] of recipe.ins) expect(graph.items.find(x => x.id === input)?.recipesIn).toContain(id);
    }
  });

  it('computes crafting depth separately from station and research tier', () => {
    const graph = buildEconomicGraph(); const byId = new Map(graph.items.map(x => [x.id, x]));
    expect(byId.get('wood')?.level).toBe(0);
    expect(byId.get('plank')?.level).toBe(1);
    expect(byId.get('mechanical_parts')?.level).toBe(1);
    expect(byId.get('plank')?.recipes[0]).toMatchObject({ id: 'plank', inputs: [['wood', 2]], outputs: [['plank', 1]], station: 'workbench', stationLevel: 1, researchTier: 1 });
    expect(graph.edges.find(x => x.from === 'wood' && x.to === 'plank' && x.recipe === 'plank')).toMatchObject({ inputQuantity: 2, outputQuantity: 1 });
    expect(byId.get('motorbike_kit')?.level).not.toBe(2); // derived from its ingredients, not recipe tier / bench level
    expect(graph.diagnostics.cycles).toEqual([]);
  });

  it('preserves non-crafting functions as valid sinks', () => {
    const byId = new Map(buildEconomicGraph().items.map(x => [x.id, x]));
    expect(byId.get('fuel_can')?.consumers).toContain('Fuel burn');
    expect(byId.get('core_blast')?.consumers).toContain('Equip / Core abilities');
    expect(byId.get('wolf_fang')?.consumers).toContain('Research study');
  });
});
