import {describe,it,expect} from 'vitest';
import '../../scripts/export-item-network';
import fs from 'node:fs';

describe('Source-exact formula atlas export',()=>{
 it('exports actual authoritative catalog values with complete record keys',()=>{
  const r=JSON.parse(fs.readFileSync('evidence/item-network/catalog-graph.json','utf8'));
  expect(r.meta.sourceSHA).toMatch(/^[0-9a-f]{40}$/);
  expect(r.counts.items).toBeGreaterThan(70);
  expect(r.counts.recipes).toBeGreaterThan(50);
  expect(r.counts.structures).toBeGreaterThan(10);
  for (const [id,formula] of Object.entries(r.recipes) as [string,any][]) {
    expect(formula.id).toBe(id);
    expect(r.items[formula.out]).toBeDefined();
    for(const [ingredient,qty] of formula.ins){expect(r.items[ingredient]).toBeDefined();expect(qty).toBeGreaterThan(0);}
  }
  console.log('VERIFIED_ITEM_ATLAS_SHA '+r.meta.sourceSHA);
 });
});
