import { LOOT_B05_TOOLBOX_GRADE } from '../src/game/loot-ecology';
// MEC-01 P4: reproducible five-chain industrial benchmark. Regenerate: npx vitest run tests/mec01-five-chain-benchmark.test.ts
// Every SOH number is computed from the live registry (RECIPES, ITEMS, SOURCES), the authored shipping caches, the pinned recovery
// plans (recycler v1/v2/v3 with cumulative tiers) and balance.v1.json. LI figures are CONTEXT ONLY, labelled by version/mode/confidence.
// B05 eligibility, stock classes, probabilities, stock clocks and integer batch routes are modelled explicitly (MEC-01 R2 D);
// player travel is not modelled in Web. Unknown values are written as ORIGINAL_UNKNOWN (never guessed). Writes web/reports/mec01-five-chain-benchmark.{json,md}.
import {describe,it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {RECIPES,ITEMS,SOURCES,STRUCTS} from '../src/game/catalog';
import {getWorld,setActiveLayout} from '../src/game/world';
import {expand,proveItem,routesFor,ieValue,integerBatch,integerTree,stockClassOf,B05_REPEATABLE_RULE,type Vec} from '../src/game/industrial-proof';
import {SHIPPING_LOOT_SOURCES,specForSite} from '../src/game/loot-source-spec';
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

// MEC-01 R2 D: every hit is tagged with stockClass (renewable | finite | world-node | unknown), B05 repeatable-loop eligibility,
// the authored stock clock and a per-roll probability, so renewable and finite sources are never conflated.
function sourcesFor(item:string){
  const hits:{kind:string;where:string;qty?:number;frequency?:string;stock?:string;cooldownHours?:number;stockClass?:string;eligibleForRepeatableLoop?:boolean|string;stockClock?:string;probabilityPerRoll?:number|string}[]=[];
  for(const s of getWorld('shipping_fresh').statics) if(s.kind==='loot'&&s.loot) for(const [k,q] of s.loot) if(k===item){
    const spec=specForSite(s);
    const sc=spec?stockClassOf(spec.stock):'unknown';
    hits.push({kind:'authored-cache',where:`${s.poi}:${s.tx},${s.ty}`,qty:q,
      stockClass:sc,eligibleForRepeatableLoop:sc==='unknown'?'ORIGINAL_UNKNOWN (static loot site matches no authored source spec)':sc==='renewable',
      stockClock:spec?.cooldownHours!=null?`${spec.cooldownHours}h cooldown (authored spec)`:'ORIGINAL_UNKNOWN',probabilityPerRoll:'1 (authored placement, deterministic)'});
  }
  // B05 toolbox grammar rolls (LOOT_B05_TOOLBOX_GRADE) for every shipping toolbox spec. Declared stock, cooldown and per-roll probability; not authored loot. Finite specs are tagged ineligible for repeatable loops.
  for(const spec of SHIPPING_LOOT_SOURCES) if(spec.role==='toolbox'){
    const tbl=LOOT_B05_TOOLBOX_GRADE[spec.grade];
    const sc=stockClassOf(spec.stock);
    const eligible=sc==='renewable';
    for(const [k,q] of tbl.fixed) if(k===item) hits.push({kind:'b05-grammar-fixed',where:spec.sourceId,qty:q,frequency:'every roll (fixed)',probabilityPerRoll:1,stock:spec.stock,stockClass:sc,eligibleForRepeatableLoop:eligible,cooldownHours:spec.cooldownHours,stockClock:`${spec.cooldownHours}h cooldown (authored spec)`});
    if(tbl.pool.some(([k])=>k===item)) hits.push({kind:'b05-grammar-pool',where:spec.sourceId,qty:1,frequency:`1 of ${tbl.pool.length} pool stacks (uniform), one pool stack per roll`,probabilityPerRoll:round(1/tbl.pool.length),stock:spec.stock,stockClass:sc,eligibleForRepeatableLoop:eligible,cooldownHours:spec.cooldownHours,stockClock:`${spec.cooldownHours}h cooldown (authored spec)`});
  }
  for(const [id,src] of Object.entries(SOURCES as Record<string,any>)){
    // World source nodes: stock exists but the respawn clock is not modelled in Web — ORIGINAL_UNKNOWN, never assumed infinite.
    for(const y of src.yields??[]) if(y[0]===item) hits.push({kind:'source-yield',where:id,qty:y[1],stockClass:'world-node',eligibleForRepeatableLoop:'ORIGINAL_UNKNOWN (node respawn clock not modelled in Web)',stockClock:'ORIGINAL_UNKNOWN (node respawn clock not modelled in Web)',probabilityPerRoll:'ORIGINAL_UNKNOWN'});
    for(const b of src.bonus??[]) if(b[0]===item) hits.push({kind:'source-bonus-chance',where:id,qty:b[1],stockClass:'world-node',eligibleForRepeatableLoop:'ORIGINAL_UNKNOWN (node respawn clock not modelled in Web)',stockClock:'ORIGINAL_UNKNOWN (node respawn clock not modelled in Web)',probabilityPerRoll:b[1]});
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
    const salvage=rt.ins.some(([k])=>k==='damaged_drive');
    const perRoute=salvage?null:(()=>{let secs=rt.secs/rt.qty;const v:Vec={};for(const [i,q] of rt.ins){const x=expand(i,q/rt.qty);if(!x)return null;for(const [k,n] of Object.entries(x.vec))v[k]=(v[k]??0)+n;secs+=x.secs;}return {v,secs};})();
    return {recipe:rt.recipe,alias:rt.alias??null,outQty:rt.qty,station:RECIPES[rt.recipe].station,stationLevel:(RECIPES[rt.recipe] as any).stationLevel??1,secs:rt.secs,
      ins:rt.ins,salvageDependent:salvage,
      rawPerOutputUnit: perRoute?{atoms:vecOut(perRoute.v),ingotEq:round(ieValue(perRoute.v)),treeSeconds:round(perRoute.secs),model:'amortized per output unit'}:'ORIGINAL_UNKNOWN (unpriced route)',
      integerBatch: salvage?'ORIGINAL_UNKNOWN (salvage-dependent route excluded from craft cost)':integerBatch(rt,1),
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
      repeatableLoop: net!=null&&net>0 ? {netIngotEqPerLoop:net,consumesRepeatableInputsOnly:'ORIGINAL_UNKNOWN (wood/leather source stock unverified — no renewable proof in this benchmark)',realizable:'ORIGINAL_UNKNOWN (no renewable-input proof for wood/leather)',note:'craft is at full durability, so high-tier recovery is always reachable for a fresh tool'} : 'none',
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
      const hits=sourcesFor(id);
      const intTree=integerTree(id,1);
      const lootCacheStock={finite:hits.filter(h=>h.stockClass==='finite').map(h=>h.where),renewable:hits.filter(h=>h.stockClass==='renewable').map(h=>h.where),worldNode:hits.filter(h=>h.stockClass==='world-node').length,unknown:hits.filter(h=>h.stockClass==='unknown').length};
      const finiteCacheCanSupply=hits.some(h=>h.stockClass==='finite');
      const kitRows = id==='vehicle_frame' ? (()=>{const k=expand('motorbike_kit',1);const ki=integerTree('motorbike_kit',1);return {motorbike_kit:{route:k?.route??null,atomsPerKit:k?vecOut(k.vec):'ORIGINAL_UNKNOWN',ingotEqPerKit:k?round(ieValue(k.vec)):'ORIGINAL_UNKNOWN',treeSeconds:k?round(k.secs):'ORIGINAL_UNKNOWN',integerTreePerKit:ki?{atoms:vecOut(ki.vec),ingotEq:round(ieValue(ki.vec)),treeSeconds:round(ki.secs),crafts:ki.crafts}:'ORIGINAL_UNKNOWN',stationLevel:(RECIPES.motorbike_kit as any).stationLevel,weightKg:round(ITEMS.motorbike_kit.w)}};})() : undefined;
      return {
        id,label:c.label,
        item:{weight:ITEMS[id]?.w??'ORIGINAL_UNKNOWN',max:ITEMS[id]?.max??'ORIGINAL_UNKNOWN',durability:ITEMS[id]?.dur??'ORIGINAL_UNKNOWN'},
        cheapestCraft:{route:top?.route??null,atomsPerUnit:top?vecOut(top.vec):'ORIGINAL_UNKNOWN',ingotEqPerUnit:top?round(ieValue(top.vec)):'ORIGINAL_UNKNOWN',treeSeconds:top?round(top.secs):'ORIGINAL_UNKNOWN',model:'amortized per output unit'},
        integerTreePerUnit:intTree?{atoms:vecOut(intTree.vec),ingotEq:round(ieValue(intTree.vec)),treeSeconds:round(intTree.secs),crafts:intTree.crafts,rule:'whole craft batches at every node; overshoot is surplus, never fractional crafts; alternative to the amortized cheapestCraft model'}:'ORIGINAL_UNKNOWN',
        routes:routeRows(id),
        researchCost: (RECIPES[id] as any)?.base ? 'base (known at start, no research)' : {directedSparesCost:(BAL as any).research?.directedSparesCost??'ORIGINAL_UNKNOWN'},
        sourceHits:hits,
        lootCacheStock,
        finiteCacheCanSupply,
        consumers:consumers(id),
        recycler:RECYCLE_SOURCE[id]?{source:RECYCLE_SOURCE[id]!.tool,note:RECYCLE_SOURCE[id]!.note,rows:recyclerRows(RECYCLE_SOURCE[id]!.tool)}:'no recovery table for this chain item (not recycled)',
        furnaceFuel:'ORIGINAL_UNKNOWN (per-second burn of furnace not quantified in this benchmark)',
        travel:'ORIGINAL_UNKNOWN (no travel-cost model in shipping Web)',
        ...(kitRows?{finalConsumer:kitRows}:{}),
        li:{...LI_V5,...(LI_REF[id]??{}),comparability:'context only; LI yield and SOH yield are not the same unit or scale; never a balance input'},
      };
    });
    // Fuel/time receipts for the ore-to-ingot leg, from the authored furnace recipes.
    const furnace={iron_ingot:{fromOre:{secs:RECIPES.iron_ingot.secs,ins:RECIPES.iron_ingot.ins,outQty:RECIPES.iron_ingot.qty}},scrap_ingot:{fromScrap:{secs:RECIPES.scrap_ingot.secs,ins:RECIPES.scrap_ingot.ins,outQty:RECIPES.scrap_ingot.qty}},refined_iron_ingot:{secs:RECIPES.refined_iron_ingot.secs,ins:RECIPES.refined_iron_ingot.ins,outQty:RECIPES.refined_iron_ingot.qty}};
    // MEC-01 R2 A1: Gear as a carried INPUT at the Foundry Recycler (X:gear-v1). Same ingot-equivalent basis as the chains above.
    const ieScrap=1/RECIPES.scrap_ingot.ins[0][1]*RECIPES.scrap_ingot.qty;   // ingot per scrap
    const ieMP=(RECIPES.mechanical_parts.ins as [string,number][]).reduce((a,[k,q])=>a+q*(k==='iron_ingot'?1:k==='scrap'?ieScrap:0),0)/RECIPES.mechanical_parts.qty;
    const ieFast=(RECIPES.fasteners.ins as [string,number][]).reduce((a,[k,q])=>a+q*(k==='iron_ingot'?1:k==='scrap'?ieScrap:0),0)/RECIPES.fasteners.qty;
    const ieGearCraft=(RECIPES.mechanical_gear.ins as [string,number][]).reduce((a,[k,q])=>a+q*(k==='iron_ingot'?1:k==='mechanical_parts'?ieMP:k==='fasteners'?ieFast:0),0);
    const gearOut=BAL.recyclerV4.components.mechanical_gear.outputs as [string,number][];
    const ieGearRet=gearOut.reduce((a,[k,q])=>a+q*(k==='iron_ingot'?1:k==='mechanical_parts'?ieMP:0),0);
    const gearRecycleV4={recipe:'X:gear-v1',seconds:BAL.recyclerV4.seconds,outputs:gearOut,craftIngotEq:round(ieGearCraft),returnIngotEq:round(ieGearRet),netLossIngotEq:round(ieGearCraft-ieGearRet),basis:'1 ingot = 1 ore; scrap = 1/3 ingot (scrap_ingot); MP and fastener from their authored recipes; no durability so no condition tiers',sourceStatus:'SOH_PROVISIONAL (recyclerV4); LI per-item yield ORIGINAL_UNKNOWN',consumersOfGear:['vehicle_drive_geared','industrial_pick_geared']};
    const report={version:'mec01-five-chain-benchmark-v2',numeraire:'1 iron_ingot = 1 iron_ore (furnace) = 3 scrap (scrap_ingot); other atoms compared per material',
      salvageOnly:['damaged_drive'],recyclerVersions:{v1:'immutable saved-job table',v2:'pinned saved-job table (four keys over-returned)',v3:'new jobs, corrected four keys'},
      structuresNote:`workbench ${STRUCTS.workbench.name} level 2 for the chain recipes; motorbike_kit needs level 3`,
      furnace,gearRecycleV4,chains,li_context_only:true,
      b05Eligibility:{rule:B05_REPEATABLE_RULE,
        renewable:SHIPPING_LOOT_SOURCES.filter(s=>s.stock==='renewable').map(s=>s.sourceId),
        finite:SHIPPING_LOOT_SOURCES.filter(s=>s.stock==='finite').map(s=>s.sourceId),
        salvageExcluded:['damaged_drive (non-repeatable wreck input; never a craft-cost input — SALVAGE_ONLY)'],
        note:'authored-cache hits are spec-matched via specForSite and tagged per hit; toolbox grammar hits carry the authored spec stock class; vault (finite) can never underwrite a repeatable route claim'},
      unpricedAtoms:{atoms:['coal','wood','stone','leather','spares','crystal'],mode:'per-material comparison only; no numeraire conversion is invented for these; only iron_ingot/iron_ore/scrap carry one'},
      separateChannels:{sourceProbability:'probabilityPerRoll per hit (grammar fixed = 1; grammar pool = 1/pool.length; bonus chance as authored)',stockClocks:'stockClass + stockClock + cooldownHours per hit (authored specs); world-node respawn clocks are ORIGINAL_UNKNOWN',playerTravel:'ORIGINAL_UNKNOWN (no travel-cost model in shipping Web)',liHistory:'context only; version/mode/confidence per LI row; never a balance input'},
      proofClasses: proofClasses(),
      unknowns:['ORIGINAL_UNKNOWN: ore-to-ingot fuel burn','ORIGINAL_UNKNOWN: travel/route cost','ORIGINAL_UNKNOWN: per-source drop rate for Metal Blade/Frame authored caches','ORIGINAL_UNKNOWN: LI per-item yields (ASSUMED only)'] };
    const dir=join(process.cwd(),'reports');
    writeFileSync(join(dir,'mec01-five-chain-benchmark.json'),JSON.stringify(report,null,2)+'\n');
    const md=[`# MEC-01 five-chain industrial benchmark (generated)`,'',`Numeraire: ${report.numeraire}. Salvage-only: damaged_drive. LI figures are context only (${LI_V5.version}; mode ${LI_V5.mode}; confidence ${LI_V5.confidence}; LI Parts are not SOH Mechanical Parts).`,`B05 eligibility: ${report.b05Eligibility.rule} Renewable: ${report.b05Eligibility.renewable.join(', ')}. Finite (never repeatable): ${report.b05Eligibility.finite.join(', ')}.`,'',`Models: amortized per-unit (cheapestCraft) AND integer craft batches (integerTreePerUnit / route integerBatch) are both reported. Player travel is not modelled. Unpriced atoms compared per material: ${report.unpricedAtoms.atoms.join(', ')}.`,'',
      '| Chain | Cheapest route | ingot-eq / unit | craft tree s | recycler v2 high (pinned) | recycler v3 high (new) | LI leaf BOM (context) |','|---|---|---|---|---|---|---|',
      ...chains.map(c=>{const rr=typeof c.recycler==='object'&&c.recycler&&'rows' in c.recycler?(c.recycler as any).rows:null;const v2=rr?.v2?.[2],v3=rr?.v3?.[2];const src=typeof c.recycler==='object'&&c.recycler?(c.recycler as any).source:'none';return `| ${c.label} | ${c.cheapestCraft.route} | ${c.cheapestCraft.ingotEqPerUnit} | ${c.cheapestCraft.treeSeconds} | ${src}: ${v2?`${v2.verdict} (${v2.ingotEqRecovered} vs ${v2.ingotEqCraft})`:'n/a'} | ${src}: ${v3?`${v3.verdict} (${v3.ingotEqRecovered} vs ${v3.ingotEqCraft})`:'n/a'} | ${c.li.leaf} |`;}),
      '','Unknowns: '+report.unknowns.join('; ')+'.'];
    writeFileSync(join(dir,'mec01-five-chain-benchmark.md'),md.join('\n')+'\n');
    // Assertions: LI carries version/mode/confidence; recycler v3 has no over-return; every chain resolved a route.
    for(const c of chains){expect(c.li.version).toBe(LI_V5.version);expect(c.li.mode).toBeDefined();expect(c.li.confidence).toBe('ASSUMED');expect(c.li.partsIsSohMechanicalParts).toBe(false);expect(c.cheapestCraft.route).toBeTruthy();}
    for(const c of chains) if(typeof c.recycler==='object'&&c.recycler&&'rows' in c.recycler&&(c.recycler as any).rows?.v3) expect((c.recycler as any).rows.v3.some((r:any)=>r.verdict==='OVER_RETURN'),c.id).toBe(false);
    // MEC-01 R2 D: B05 eligibility, finite-vs-renewable stock, integer batch routes, ORIGINAL_UNKNOWN discipline.
    expect(report.b05Eligibility.rule).toBe(B05_REPEATABLE_RULE);
    expect(report.b05Eligibility.renewable).toEqual(['shipping.factory.exterior.industrial-toolbox','shipping.tp.bow-cache.standard-toolbox']);
    expect(report.b05Eligibility.finite).toEqual(['shipping.factory.vault.advanced-keycard']);   // the only finite spec; never a repeatable loop input
    expect(report.unpricedAtoms.atoms).toEqual(expect.arrayContaining(['coal','wood','stone','leather','spares','crystal']));
    for(const u of report.unknowns) expect(u.startsWith('ORIGINAL_UNKNOWN')).toBe(true);
    for(const c of chains as any[]){
      for(const h of c.sourceHits){
        expect(['renewable','finite','world-node','unknown']).toContain(h.stockClass);
        if(h.stockClass==='finite') expect(h.eligibleForRepeatableLoop).toBe(false);
        if(h.stockClass==='renewable') expect(h.eligibleForRepeatableLoop).toBe(true);
      }
      expect(c.integerTreePerUnit).not.toBe('ORIGINAL_UNKNOWN');
      expect(c.integerTreePerUnit.crafts).toBeTruthy();
      expect(c.integerTreePerUnit.treeSeconds).toBeGreaterThan(0);
      for(const r of c.routes){
        if(typeof r.integerBatch==='string') expect(r.integerBatch).toContain('ORIGINAL_UNKNOWN');
        else { expect(r.integerBatch.crafts).toBeGreaterThanOrEqual(1); expect(r.integerBatch.outputs).toBe(r.integerBatch.crafts*r.outQty); expect(r.integerBatch.seconds).toBeGreaterThan(0); expect(r.integerBatch.surplusOutputs).toBe(r.integerBatch.outputs-1); }
      }
      expect(typeof c.finiteCacheCanSupply).toBe('boolean');
      expect(c.lootCacheStock.renewable.length+c.lootCacheStock.finite.length+c.lootCacheStock.unknown).toBeLessThanOrEqual(c.sourceHits.length);
    }
  });
});
