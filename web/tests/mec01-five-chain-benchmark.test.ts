// MEC-01 P4: reproducible five-chain industrial benchmark. Regenerate: npx vitest run tests/mec01-five-chain-benchmark.test.ts
// Every SOH number is computed from the live registry (RECIPES, ITEMS, SOURCES), the authored shipping caches, the pinned recovery
// plans (recycler v1/v2/v3 with cumulative tiers) and balance.v1.json. LI figures are CONTEXT ONLY, labelled by version/mode/confidence.
// Unknown values are written as UNKNOWN (never guessed). Writes web/reports/mec01-five-chain-benchmark.{json,md}.
import {describe,it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {RECIPES,ITEMS,SOURCES,STRUCTS} from '../src/game/catalog';
import {getWorld,setActiveLayout} from '../src/game/world';
import {expand,proveItem,routesFor,ieValue,type Vec} from '../src/game/industrial-proof';
import BAL from '../src/game/balance.v1.json';

const CHAINS=[
  {id:'metal_blade',label:'Metal Blade'},
  {id:'metal_pipe',label:'Metal Pipe'},
  {id:'mechanical_gear',label:'Mechanical Gear'},
  {id:'iron_plate',label:'Iron Plate'},
  {id:'vehicle_frame',label:'Utility Frame → Motorbike Kit'},
] as const;
// LI reference (context only). Source: LI_MASTER_RESEARCH_REPORT_v5.md §5 at pinned Atlas SHA 5f4e6c443f723318ed32376acc558d031d333e76.
// Mode: leaf BOM assuming one-product output. Confidence: ASSUMED (per-item yield not verified). LI "Parts" is NOT SOH Mechanical Parts.
const LI_V5={version:'LI master v5 §5',mode:'leaf-BOM, one-product output assumed',confidence:'ASSUMED',partsIsSohMechanicalParts:false};
const LI_REF:Record<string,{station:string;leaf:string;unit:string}>={
  metal_blade:{station:'L2',leaf:'30×iron_ingot, 15×LI Parts',unit:'LI'},
  metal_pipe:{station:'L2',leaf:'30×LI Parts, 5×refined_iron_ingot',unit:'LI'},
  mechanical_gear:{station:'L2',leaf:'50×iron_ingot, 65×LI Parts',unit:'LI'},
  iron_plate:{station:'L2',leaf:'30×LI Parts, 5×refined_iron_ingot',unit:'LI'},
  vehicle_frame:{station:'L3',leaf:'100×iron_ingot, 50×LI Parts, 30×refined_iron_ingot',unit:'LI'},
};
const round=(n:number)=>Math.round(n*1000)/1000;
/** The recycled tool whose recovery table yields each chain item (the item itself is not recycled from the chain). */
const RECYCLE_SOURCE:Record<string,{tool:string;note:string}|null>={
  metal_blade:{tool:'iron_sword',note:'blade is a high-tier output of recycling an Iron Sword'},
  metal_pipe:{tool:'iron_pick',note:'pipe is a high-tier output of recycling an Iron Pickaxe (v2 only; pinned)'},
  mechanical_gear:{tool:'industrial_axe',note:'gear is a high-tier output of recycling a Salvager Axe'},
  iron_plate:{tool:'iron_axe',note:'plate is a high-tier output of recycling an Iron Axe (v2 only; pinned)'},
  vehicle_frame:null,
};
const vecOut=(v:Vec)=>Object.fromEntries(Object.entries(v).map(([k,q])=>[k,round(q)]));

function sourcesFor(item:string){
  const hits:{kind:string;where:string;qty?:number}[]=[];
  for(const s of getWorld('shipping_fresh').statics) if(s.kind==='loot'&&s.loot) for(const [k,q] of s.loot) if(k===item) hits.push({kind:'authored-cache',where:`${s.poi}:${s.tx},${s.ty}`,qty:q});
  for(const [id,src] of Object.entries(SOURCES as Record<string,any>)){
    for(const y of src.yields??[]) if(y[0]===item) hits.push({kind:'source-yield',where:id,qty:y[1]});
    for(const b of src.bonus??[]) if(b[0]===item) hits.push({kind:'source-bonus-chance',where:id,qty:b[1]});
  }
  return hits;
}
function consumers(item:string){
  const out:string[]=[];
  for(const [id,rc] of Object.entries(RECIPES) as [string,any][]) if((rc.ins as [string,number][]).some(([k])=>k===item)) out.push(`${id}${rc.alias?` (${rc.alias})`:''}`);
  return out.sort();
}
function routeRows(item:string){
  return routesFor(item).map(rt=>{
    const e=expand(item,1);
    const perRoute=rt.ins.some(([k])=>k==='damaged_drive')?null:(()=>{let secs=rt.secs/rt.qty;const v:Vec={};for(const [i,q] of rt.ins){const x=expand(i,q/rt.qty);if(!x)return null;for(const [k,n] of Object.entries(x.vec))v[k]=(v[k]??0)+n;secs+=x.secs;}return {v,secs};})();
    return {recipe:rt.recipe,alias:rt.alias??null,outQty:rt.qty,station:RECIPES[rt.recipe].station,stationLevel:(RECIPES[rt.recipe] as any).stationLevel??1,secs:rt.secs,
      ins:rt.ins,salvageDependent:rt.ins.some(([k])=>k==='damaged_drive'),
      rawPerOutputUnit: perRoute?{atoms:vecOut(perRoute.v),ingotEq:round(ieValue(perRoute.v)),treeSeconds:round(perRoute.secs)}:'UNKNOWN',
      chosenByCheapestRule:rt.recipe===(e?.route??'')};
  });
}
function recyclerRows(item:string){
  const out:any={};
  for(const [ver,rec] of [['v1','X:recover-v1'],['v2','X:recover-v2'],['v3','X:recover-v3']] as const){
    const p=proveItem(item,rec as any);
    if(p.rows.every((r:any)=>r.verdict==='UNKNOWN'))continue;
    out[ver]=p.rows.map((r:any)=>({tier:r.tier,outputs:r.cumulativeOutputs??null,ingotEqRecovered:r.ieRecovered??null,ingotEqCraft:r.ieCraft??null,minted:r.mintedNonNumeraire??[],verdict:r.verdict}));
  }
  return Object.keys(out).length?out:null;
}

/** Three separate claims (never merged): (1) resource over-return, (2) realizable repeatable loop, (3) non-repeatable salvage.
 * A loop is 'realizable' only if every consumed input is repeatable; wood/leather sources are not verified here, so that is UNKNOWN. */
function proofClasses(){
  const out:any[]=[];
  for (const tool of ['iron_sword','iron_pick','iron_axe','industrial_axe'] as const) {
    const v2=proveItem(tool,'X:recover-v2' as any).rows.find((r:any)=>r.tier==='high') as any;
    const v3=proveItem(tool,'X:recover-v3' as any).rows.find((r:any)=>r.tier==='high') as any;
    const craft=expand(tool,1);
    const net=v2?.ieRecovered!=null&&craft?round(v2.ieRecovered-ieValue(craft.vec)):null;
    out.push({tool,
      v2_pinned:{resourceOverReturn:v2?.verdict==='OVER_RETURN',netIngotEqPerLoop:net,mintedNonNumeraire:v2?.mintedNonNumeraire??[]},
      repeatableLoop: net!=null&&net>0 ? {netIngotEqPerLoop:net,consumesRepeatableInputsOnly:'UNKNOWN (wood/leather sources not verified in this benchmark)',realizable:'UNKNOWN',note:'craft is at full durability, so high-tier recovery is always reachable for a fresh tool'} : 'none',
      salvageWindfall: tool==='industrial_axe'?'none in table (damaged_drive is a wreck-only input, not consumed by these tools)':'none',
      v3_new:{resourceOverReturn:v3?.verdict==='OVER_RETURN'}});
  }
  out.push({tool:'mechanical_parts (recover_drive route)',salvageWindfall:'damaged_drive is wreck-only (non-repeatable); excluded from craft cost; its recovery is a salvage windfall, not a loop',resourceOverReturn:'not evaluated: no recycler table row'});
  return out;
}
describe('MEC-01 P4: five-chain industrial benchmark (reproducible)', () => {
  it('builds the benchmark, writes JSON and Markdown, and every LI figure carries version/mode/confidence', () => {
    setActiveLayout('shipping');
    const chains=CHAINS.map(c=>{
      const id=c.id;
      const top=expand(id,1);
      const kitRows = id==='vehicle_frame' ? (()=>{const k=expand('motorbike_kit',1);return {motorbike_kit:{route:k?.route??null,atomsPerKit:k?vecOut(k.vec):'UNKNOWN',ingotEqPerKit:k?round(ieValue(k.vec)):'UNKNOWN',treeSeconds:k?round(k.secs):'UNKNOWN',stationLevel:(RECIPES.motorbike_kit as any).stationLevel,weightKg:round(ITEMS.motorbike_kit.w)}};})() : undefined;
      return {
        id,label:c.label,
        item:{weight:ITEMS[id]?.w??'UNKNOWN',max:ITEMS[id]?.max??null,durability:ITEMS[id]?.dur??null},
        cheapestCraft:{route:top?.route??null,atomsPerUnit:top?vecOut(top.vec):'UNKNOWN',ingotEqPerUnit:top?round(ieValue(top.vec)):'UNKNOWN',treeSeconds:top?round(top.secs):'UNKNOWN'},
        routes:routeRows(id),
        researchCost: (RECIPES[id] as any)?.base ? 'base (known at start, no research)' : {directedSparesCost:(BAL as any).research?.directedSparesCost??'UNKNOWN'},
        sourceHits:sourcesFor(id),
        consumers:consumers(id),
        recycler:RECYCLE_SOURCE[id]?{source:RECYCLE_SOURCE[id]!.tool,note:RECYCLE_SOURCE[id]!.note,rows:recyclerRows(RECYCLE_SOURCE[id]!.tool)}:'no recovery table for this chain item (not recycled)',
        furnaceFuel:'UNKNOWN (per-second burn of furnace not quantified in this benchmark)',
        travel:'UNKNOWN (no travel-cost model in shipping Web)',
        ...(kitRows?{finalConsumer:kitRows}:{}),
        li:{...LI_V5,...(LI_REF[id]??{}),comparability:'context only; LI yield and SOH yield are not the same unit or scale; never a balance input'},
      };
    });
    // Fuel/time receipts for the ore-to-ingot leg, from the authored furnace recipes.
    const furnace={iron_ingot:{fromOre:{secs:RECIPES.iron_ingot.secs,ins:RECIPES.iron_ingot.ins,outQty:RECIPES.iron_ingot.qty}},scrap_ingot:{fromScrap:{secs:RECIPES.scrap_ingot.secs,ins:RECIPES.scrap_ingot.ins,outQty:RECIPES.scrap_ingot.qty}},refined_iron_ingot:{secs:RECIPES.refined_iron_ingot.secs,ins:RECIPES.refined_iron_ingot.ins,outQty:RECIPES.refined_iron_ingot.qty}};
    const report={version:'mec01-five-chain-benchmark-v1',numeraire:'1 iron_ingot = 1 iron_ore (furnace) = 3 scrap (scrap_ingot); other atoms compared per material',
      salvageOnly:['damaged_drive'],recyclerVersions:{v1:'immutable saved-job table',v2:'pinned saved-job table (four keys over-returned)',v3:'new jobs, corrected four keys'},
      structuresNote:`workbench ${STRUCTS.workbench.name} level 2 for the chain recipes; motorbike_kit needs level 3`,
      furnace,chains,li_context_only:true,
      proofClasses: proofClasses(),
      unknowns:['ore-to-ingot fuel burn','travel/route cost','per-source drop rate for Metal Blade/Frame','LI per-item yields (ASSUMED only)'] };
    const dir=join(process.cwd(),'reports');
    writeFileSync(join(dir,'mec01-five-chain-benchmark.json'),JSON.stringify(report,null,2)+'\n');
    const md=[`# MEC-01 five-chain industrial benchmark (generated)`,'',`Numeraire: ${report.numeraire}. Salvage-only: damaged_drive. LI figures are context only (${LI_V5.version}; mode ${LI_V5.mode}; confidence ${LI_V5.confidence}; LI Parts are not SOH Mechanical Parts).`,'',
      '| Chain | Cheapest route | ingot-eq / unit | craft tree s | recycler v2 high (pinned) | recycler v3 high (new) | LI leaf BOM (context) |','|---|---|---|---|---|---|---|',
      ...chains.map(c=>{const rr=typeof c.recycler==='object'&&c.recycler&&'rows' in c.recycler?(c.recycler as any).rows:null;const v2=rr?.v2?.[2],v3=rr?.v3?.[2];const src=typeof c.recycler==='object'&&c.recycler?(c.recycler as any).source:'none';return `| ${c.label} | ${c.cheapestCraft.route} | ${c.cheapestCraft.ingotEqPerUnit} | ${c.cheapestCraft.treeSeconds} | ${src}: ${v2?`${v2.verdict} (${v2.ingotEqRecovered} vs ${v2.ingotEqCraft})`:'n/a'} | ${src}: ${v3?`${v3.verdict} (${v3.ingotEqRecovered} vs ${v3.ingotEqCraft})`:'n/a'} | ${c.li.leaf} |`;}),
      '','Unknowns: '+report.unknowns.join('; ')+'.'];
    writeFileSync(join(dir,'mec01-five-chain-benchmark.md'),md.join('\n')+'\n');
    // Assertions: LI carries version/mode/confidence; recycler v3 has no over-return; every chain resolved a route.
    for(const c of chains){expect(c.li.version).toBe(LI_V5.version);expect(c.li.mode).toBeDefined();expect(c.li.confidence).toBe('ASSUMED');expect(c.li.partsIsSohMechanicalParts).toBe(false);expect(c.cheapestCraft.route).toBeTruthy();}
    for(const c of chains) if(typeof c.recycler==='object'&&c.recycler&&'rows' in c.recycler&&(c.recycler as any).rows?.v3) expect((c.recycler as any).rows.v3.some((r:any)=>r.verdict==='OVER_RETURN'),c.id).toBe(false);
  });
});
