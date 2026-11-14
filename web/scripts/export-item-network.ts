/**
 * READ-ONLY audited graph export from source-pinned SOH Web runtime catalogs.
 * No game state or production tables modified. Recipe keys, quantities, times,
 * stations, outputs and independent rules are copied verbatim from runtime data.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Evidence provenance is a fact, never a placeholder. CI supplies GITHUB_SHA; a local or test
 * run resolves the commit the working tree actually came from; only a checkout with no git
 * history at all is allowed to say 'unspecified' — and it must say WHY.
 */
function resolveSourceSHA(): { sourceSHA: string; sourceSHAProvenance: string } {
  const ci = (process.env.GITHUB_SHA ?? '').trim();
  if (/^[0-9a-f]{40}$/.test(ci)) return { sourceSHA: ci, sourceSHAProvenance: 'GITHUB_SHA (CI checkout)' };
  try {
    const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    if (/^[0-9a-f]{40}$/.test(head)) return { sourceSHA: head, sourceSHAProvenance: 'git rev-parse HEAD (working tree at export time)' };
  } catch { /* not a git checkout */ }
  return { sourceSHA: 'unspecified', sourceSHAProvenance: 'UNTRACED: neither GITHUB_SHA nor a git checkout was available, so this export cannot be attributed to a commit' };
}
const provenance = resolveSourceSHA();
import { ITEMS, RECIPES, STRUCTS, SOURCES, CREATURES, ELDERS, PRIMORDIAL_ELDERS,
  WORKBENCH_UPGRADE, WORKBENCH_UPGRADE_III,
  INDUSTRIAL_MODULE, FURNACE_LINING, GENERATOR_CAPACITY_UPGRADE,
  CART_FREIGHT_UPGRADE, GARDEN_FRAME_COST, GARDEN_CROPS,
  VENDOR_SPARES, VENDOR_SECURED, CORE_STUDY,
  RETIRED_RECIPES, RECIPE_REVISION
} from '../src/game/catalog';
import { BAL } from '../src/game/core';
import { componentRuleSnapshot } from '../src/game/recycler';

const allRecipes=Object.fromEntries(Object.entries(RECIPES).map(([id,r])=>[id,{id,...r}]));
const itemDefs=Object.fromEntries(Object.entries(ITEMS).map(([id,d])=>[id,{
  id,name:d.name,cat:d.cat,desc:d.desc,w:d.w,max:d.max,
  ...(d.food?{food:d.food}:{}),
  ...(d.power?{power:d.power}:{}),
  ...(d.dmg!==undefined?{dmg:d.dmg}:{}),
  ...(d.dur!==undefined?{dur:d.dur}:{}),
  ...(d.fuel!==undefined?{fuel:d.fuel}:{}),
  ...(d.studyRecipe?{studyRecipe:d.studyRecipe}:{}),
  ...(d.specimen?{specimen:d.specimen}:{}),
  ...(d.repair?{repair:d.repair}:{}),
  ...(d.salvage?{salvage:d.salvage}:{}),
  ...(d.creatorCore?{creatorCore:d.creatorCore}:{}),
  ...(d.essence?{essence:d.essence}:{}),
  ...(d.slot?{slot:d.slot}:{}),
  ...(d.place?{place:d.place}:{}),
  ...(d.waterContainer?{waterContainer:d.waterContainer}:{}),
}]));
const graph={
  meta:{
    schema:'soh-runtime-item-formula-atlas-v1',
    sourceSHA:provenance.sourceSHA,
    sourceSHAProvenance:provenance.sourceSHAProvenance,
    // PA1: the live recipe table is 112, not the 113 recorded before the recovered-paper cutover.
    // The improvised bench Fuel Canister formula was retired by that correction; its rev-1
    // definition is NOT counted as a live route — it lives only in the frozen migration ledger
    // (web/src/game/recipe-migration.ts) so pre-cutover saves still settle.
    recipeCensusNote:'Counts the LIVE RECIPES table only. Retired formulas are excluded, and frozen revision definitions are never added back as active routes.',
    retiredRecipes:[...RETIRED_RECIPES],
    recipeRevision:RECIPE_REVISION,
    exportedAt:new Date().toISOString(),
    project:'Soul of Heroes — WEB Veyra runtime',
    authority:['web/src/game/catalog.ts','web/src/game/core.ts BAL','web/src/game/recycler.ts'],
    limits:[
      'Recipe records are present in runtime catalog, not a guarantee of unlock or source reachability',
      'Source yields/bonuses are per physical node or probabilistic rolls, NOT unlimited player inventory',
      'Creature drops are conditional on finding/killing creature; probability is per drop record',
      'Recycler versioned durability return depends on condition, station and material availability',
      'Fuel, repair, placement, study, research and transport are NOT automatically counted as normal consumed craft ingredients',
      'An island POI being listed in map geometry is not proof of access',
      'This export is Web gameplay, not a claim of parity with unmerged Godot A0/A3 native branches'
    ],
  },
  items:itemDefs,
  recipes:allRecipes,
  structures:Object.fromEntries(Object.entries(STRUCTS).map(([id,s])=>[id,{id,...s}])),
  sources:Object.fromEntries(Object.entries(SOURCES).map(([id,s])=>[id,{id,...s}])),
  creatures:Object.fromEntries(Object.entries(CREATURES).map(([id,s])=>[id,{id,...s}])),
  elders:ELDERS,
  primordialElders:PRIMORDIAL_ELDERS,
  upgrades:{
    workbench_ii:WORKBENCH_UPGRADE,
    workbench_iii:WORKBENCH_UPGRADE_III,
    furnace_lining:FURNACE_LINING,
    generator_capacity:GENERATOR_CAPACITY_UPGRADE,
    freight_cart:CART_FREIGHT_UPGRADE,
    industrial_module:INDUSTRIAL_MODULE,
    garden_frame:{cost:GARDEN_FRAME_COST},
  },
  gardens:GARDEN_CROPS,
  recycler:{
    currentComponentRules:componentRuleSnapshot(),
    versions:{
      v1:BAL.recyclerV1,
      v2:BAL.recyclerV2,
      v3:BAL.recyclerV3,
    },
    note:'v3 supersedes v2 for its listed keys; v2 supersedes v1 for its listed keys. Do NOT sum all version outputs as concurrent offers.'
  },
  vendors:{spares:VENDOR_SPARES,secured:VENDOR_SECURED},
  studies:CORE_STUDY,
};
const counts={
 items:Object.keys(graph.items).length,
 recipes:Object.keys(graph.recipes).length,
 structures:Object.keys(graph.structures).length,
 sourceTypes:Object.keys(graph.sources).length,
 creatures:Object.keys(graph.creatures).length,
 recipeInputs:Object.values(graph.recipes).reduce((n,r)=>n+r.ins.length,0),
 recipeOutputVariants:Object.values(graph.recipes).filter(r=>Array.isArray(r.outs)&&r.outs.length>0).length,
};
const dir='evidence/item-network';
mkdirSync(dir,{recursive:true});
writeFileSync(dir+'/catalog-graph.json',JSON.stringify({...graph,counts},null,2)+'\n');
writeFileSync(dir+'/manifest.json',JSON.stringify({schema:graph.meta.schema,sourceSHA:graph.meta.sourceSHA,sourceSHAProvenance:graph.meta.sourceSHAProvenance,recipeRevision:graph.meta.recipeRevision,retiredRecipes:graph.meta.retiredRecipes,counts,countsNote:graph.meta.recipeCensusNote,pass:true},null,2)+'\n');
console.log('ITEM_NETWORK_CATALOG '+JSON.stringify({sha:graph.meta.sourceSHA,counts}));
