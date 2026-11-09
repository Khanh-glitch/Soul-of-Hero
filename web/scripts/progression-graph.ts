// Source-derived catalog graph; run: npx vite-node scripts/progression-graph.ts [path]
import { writeFileSync } from 'node:fs';
import { ITEMS, SOURCES, RECIPES, STRUCTS, CREATURES, ELDERS, VENDOR_SECURED, CORE_STUDY, WORKBENCH_UPGRADE, CART_FREIGHT_UPGRADE, GARDEN_CROPS, FURNACE_LINING } from '../src/game/catalog';
import { getWorld, SRC_KEYS } from '../src/game/world';
const layouts = (['shipping', 'dev_delta'] as const).map(id => ({ id, world: getWorld(id) }));
const uniq = (a: string[]) => [...new Set(a)];
const outputRecipes: Record<string,string[]> = {};
for (const [id, rec] of Object.entries(RECIPES)) (outputRecipes[rec.out] ??= []).push(id);
// Recipe-to-recipe edges include all producer alternatives, not an assertion of reachability.
const visit = (recipe: string, ancestors: string[]): number | null => {
  if (ancestors.includes(recipe)) return null;
  const ins = RECIPES[recipe].ins.flatMap(([id]) => outputRecipes[id] ?? []);
  if (!ins.length) return 1;
  const lengths = ins.map(id => visit(id, [...ancestors, recipe])).filter((n): n is number => n !== null);
  return lengths.length ? 1 + Math.max(...lengths) : null;
};
const specialAcquisition: Record<string,string[]> = { seed:['bush or oak bonus; Sunroot returns two seeds, Bitterleaf returns one'], crop:['watered Sunroot garden; rain or flask'], herb:['wild herb source or propagated Bitterleaf garden (seed + herb, water, time)'], rcash:['finite Ragnarok cash chest at/after final 72h'], mechanical_parts:['crafted workbench batch, finite wreck yield, or finite factory crate (new runs only)'] };
const specialUses: Record<string,string[]> = { seed:['plant Sunroot or Bitterleaf (physical water or rain and chronological growth)'], herb:['plant Bitterleaf (seed and water)','consume','known foods and medicine'], crop:['consume','campfire foods'], arrow:['bow ammunition'], blueprint:['learn metadata recipe'], keycard:['unlock keycard door'], fuel_can:['power POI generator'], rcash:['buy escrow chest','deposit into profile'], escrow_chest:['deploy escrow'], cart_kit:['deploy cart'], field_repair_kit:['consume to restore up to 100 durability on a carried repairable item'], water_flask:['drink and water plots; refill from fresh water or rain barrel'], trail_canteen:['crafted empty; drink and water plots; refill from fresh water or rain barrel'], trail_pack:['equip back slot for walking carry threshold'] };
const items = Object.fromEntries(Object.entries(ITEMS).map(([id, def]) => {
  const sources = Object.entries(SOURCES).filter(([,s]) => [...s.yields, ...(s.bonus ?? [])].some(x => x[0] === id)).map(([k]) => k);
  const poi = layouts.flatMap(({id: layout,world}) => world.statics.flatMap(s => (s.loot ?? []).filter(([k]) => k === id || (id === 'blueprint' && k.startsWith('blueprint:'))).map(([key,qty]) => ({layout,poi:s.poi,tx:s.tx,ty:s.ty,key,qty}))));
  const cashChests = id === 'rcash' ? layouts.flatMap(({id: layout,world}) => world.statics.filter(s=>s.kind==='cash').map(s=>`${layout}:${s.poi}@${s.tx},${s.ty} cash=${s.cash}`)) : [];
  const drops = Object.entries(CREATURES).filter(([,c])=>c.drops.some(([k])=>k===id)).map(([k])=>k);
  const recipes = outputRecipes[id] ?? [];
  const ingredients = Object.entries(RECIPES).filter(([,r])=>r.ins.some(([k])=>k===id)).map(([k])=>k);
  const structures = Object.entries(STRUCTS).filter(([,s])=>s.cost.some(([k])=>k===id)).map(([k])=>k);
  return [id,{definition:def,obtained:{sources,poi,cashChests,drops,recipes,special:specialAcquisition[id] ?? [],elder:Object.keys(ELDERS).filter(k=>ELDERS[k].stone===id),vendor: id in VENDOR_SECURED || id === 'escrow_chest',starter:['knife','berries','water_flask'].includes(id)},uses:{ingredients,structures,fuel:!!def.fuel,study:def.specimen ?? CORE_STUDY[id] ?? def.studyRecipe ?? null,repair:def.repair ?? null,salvage:def.salvage ?? null,repairCostFor:Object.entries(ITEMS).filter(([,d])=>d.repair?.cost.some(([key])=>key===id)).map(([k])=>k),salvageYieldOf:Object.entries(ITEMS).filter(([,d])=>d.salvage?.yields.some(([key])=>key===id)).map(([k])=>k),structureRepairCostFor:Object.entries(STRUCTS).filter(([,d])=>!d.item && d.cost.some(([key])=>key===id)).map(([k])=>k),upgrade:{workbench:WORKBENCH_UPGRADE.cost.filter(([k])=>k===id),freightCart:CART_FREIGHT_UPGRADE.cost.filter(([k])=>k===id),furnaceLining:FURNACE_LINING.cost.filter(([k])=>k===id)},special:specialUses[id] ?? (def.cat==='stone'?['six-stone ending/history']:[]),capabilities: ['dmg','power','food','slot','core','place','charge','carryBonus','waterContainer'].filter(k=>k in def)}}];
}));
const studyItems = (recipe: string) => Object.entries(ITEMS).filter(([k,v]) => (v.specimen ?? CORE_STUDY[k] ?? v.studyRecipe) === recipe).map(([k]) => k);
const blueprintSources = (recipe: string) => layouts.flatMap(({id,world}) => world.statics.filter(s => s.loot?.some(([k])=>k===`blueprint:${recipe}`)).map(s => `${id}:${s.poi}@${s.tx},${s.ty}`));
const graph={revision:'catalog snapshot (see git commit)',method:'Catalog, source placements, statics and selected action annotations: candidate edges, not proof of geometry, unlock reachability, completeness, renewable stock or player experience.',counts:{items:Object.keys(ITEMS).length,sources:Object.keys(SOURCES).length,recipes:Object.keys(RECIPES).length,distinctOutputs:Object.keys(outputRecipes).length,structures:Object.keys(STRUCTS).length,maxRecipeDepth:Math.max(...Object.keys(RECIPES).map(k=>visit(k,[]) ?? 0))},items,recipes:Object.fromEntries(Object.entries(RECIPES).map(([id,r])=>[id,{...r,depth:visit(id,[]),unlocks:{base:!!r.base,physicalBlueprint:blueprintSources(id),directedSpares:r.tier<3,randomSpares:true,randomNotes:id.startsWith('core_')?'only after unknown non-Core pool is empty':'when unknown and not already pending',studyInputs:studyItems(id)}}])),sources:Object.fromEntries(Object.entries(SOURCES).map(([id,def])=>[id,{definition:def,placementsV1:Object.fromEntries(layouts.map(({id:layout,world})=>[layout,[...world.src].filter(i=>i>=0&&SRC_KEYS[i]===id).length])),placementsV2Additional:Object.fromEntries(layouts.map(({id:layout,world})=>[layout,[...world.sourceOverlayV2].filter(i=>i>=0&&SRC_KEYS[i]===id).length]))}])),structures:STRUCTS,pois:layouts.map(({id,world})=>({layout:id,statics:world.statics})),creatures:CREATURES,elders:ELDERS,study:CORE_STUDY,workbenchUpgrade:WORKBENCH_UPGRADE,freightCartUpgrade:CART_FREIGHT_UPGRADE,furnaceLining:FURNACE_LINING,gardenChoices:GARDEN_CROPS};
writeFileSync(process.argv[2] || 'progression-graph.json', JSON.stringify(graph,null,2)+'\n');
console.log(JSON.stringify(graph.counts));
