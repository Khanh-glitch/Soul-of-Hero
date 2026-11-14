import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ITEMS, RECIPES, SOURCES, STRUCTS, VENDOR_SPARES, VENDOR_SECURED,
  DEPLOYABLE_TYPES, PA1_BASE_GEOMETRY, ALWAYS_KNOWN_RECIPES} from '../src/game/catalog';
import {BAL} from '../src/game/core';
import {getWorld} from '../src/game/world';

const PAPER={source:'SOH_PA1_FINAL_MASTER.json (paper v1.1)',sha256:'b45b157e27f39688d22cc1319de43fec663aecbed8b63bd5b2cb92a6831c5537',
  items:148,activeRecipes:128,architectureShapes:15,
  familyUnlocks:11,poiProposalClasses:7};
const IMPORTANT=['refined_iron_ingot','metal_pipe','iron_plate','mechanical_gear',
  'metal_blade','vehicle_frame','vehicle_drive','motorbike_kit','fasteners',
  'deploy_claim','deploy_furnace','deploy_workbench','deploy_research',
  'salvaged_oil','steel_ingot','keycard','escrow_chest','spares'];
const SPECIAL=['knife','blueprint','keycard','rcash','escrow_chest',
  'relic_shaleheart','ronin_nodachi','tidemarshal_trident','custodian_lantern'];
function recipeInfo(id:string) {
  const v=RECIPES[id];return v?{id,produces:v.out,qty:v.qty,
    materials:v.ins,station:v.station,level:v.stationLevel??null,base:v.base??false}:null;
}

describe('PA1/LI evidence gates: actual runtime vs draft v1.1 paper',()=>{
  it('writes auditable catalog/physical-authority deltas; never treats proposal as implemented',()=>{
    const keys=Object.keys(ITEMS), rk=Object.keys(RECIPES);
    const generated=DEPLOYABLE_TYPES.map(t=>'deploy_'+t);
    const neverFake=Object.fromEntries(IMPORTANT.map(id=>[id,
      {inventory:!!ITEMS[id],directRecipes:Object.values(RECIPES).filter(r=>r.out===id).length,
       runtimeExactIdRecipe:recipeInfo(id),sourceNodes:Object.entries(SOURCES)
         .filter(([k,v])=>JSON.stringify(v.yields??[]).includes('"'+id+'"')).map(([k])=>k)}]));
    const paperMissingRuntime={
      steelIngot:!ITEMS.steel_ingot,
      researchFamilyAtomicService:!Object.keys(RECIPES).some(k=>k.startsWith('research_family_')),
      poiProposalsNotMapAuthorized:true,
      sourceAccessibleIn336h:'NOT_PROVED_BY_THIS_INVENTORY_TEST',
      realPlayer14Day:'NOT_TESTED_BY_M2_SIMULATION'
    };
    const report={
      schema:'soh.pa1-li-reality-gates.v1',runtime:{
        items:keys.length,recipes:rk.length,sourceTypes:Object.keys(SOURCES).length,
        oldItems:keys.filter(k=>!k.startsWith('deploy_')).length,
        packedDeviceItems:generated.filter(k=>!!ITEMS[k]).length,
        buildGeometry:PA1_BASE_GEOMETRY.length,
        shopSparesOffers:Object.keys(VENDOR_SPARES).length,
        shopSecuredOffers:Object.keys(VENDOR_SECURED).length,
        guaranteedKeysFromCurrentPaper:Object.fromEntries(SPECIAL.map(k=>[k,!!ITEMS[k]])),
        exactRecipeSnapshots:neverFake,
        runtimeAlwaysKnownForPacks:generated.every(k=>ALWAYS_KNOWN_RECIPES.includes(k)),
        maxRunHours:BAL.run.maxRunHours
      },paper:PAPER,
      deltas:{items:PAPER.items-keys.length,recipes:PAPER.activeRecipes-rk.length,
        geometry:PAPER.architectureShapes-PA1_BASE_GEOMETRY.length},
      caveats:paperMissingRuntime,
      evidenceBoundary:'All actual values read live catalog.ts at CI SHA; paper proposal counts pinned by sha256 only; NOT a proof of source location, travel, loot success, economy balance or 336h play.'
    };
    const path=resolve(process.cwd(),'reports/pa1-li/PA1_LI_RUNTIME_GATES.json');
    mkdirSync(resolve(process.cwd(),'reports/pa1-li'),{recursive:true});
    writeFileSync(path,JSON.stringify(report,null,2)+'\n','utf8');
    expect(keys.length).toBe(147);
    expect(rk.length).toBe(113);
    expect(generated.every(k=>!!ITEMS[k])).toBe(true);
    expect(BAL.run.maxRunHours).toBe(336);
    expect(report.deltas).toEqual({items:1,recipes:15,geometry:0});
    expect(paperMissingRuntime.steelIngot).toBe(true);
    expect(paperMissingRuntime.researchFamilyAtomicService).toBe(true);
  });
});
