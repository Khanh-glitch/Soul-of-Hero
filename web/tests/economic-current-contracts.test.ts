// Contract projection only: empty world census avoids pretending this is a source/access witness.
import { describe, it, expect } from 'vitest';
import { buildSohEconomicGraph, type EconomicExtractionInput } from '../src/game/economic-graph';
import { STRUCTS, MOTORBIKE_REPAIR_COST } from '../src/game/catalog';
import { buildRound2Findings } from '../src/game/item-ontology-findings';
import { projectItemOntology } from '../src/game/item-ontology';
import { isRetiredLive } from '../src/game/final-item-set';
const input:EconomicExtractionInput={shippingStatics:[],shippingPoiDoors:[],shippingSourceCounts:{},devDeltaExtraStatics:[],devDeltaPoiDoors:[],veyraPois:[],veyraOrdinaryHabitats:[],veyraWildSpecies:[],veyraSideBosses:[],veyraPrimordials:[],veyraSampledSourceCounts:{}};
const graph=buildSohEconomicGraph(input);
describe('current paid production graph contracts',()=>{
  it('device placement spends only its pack and returns that instance, while raw materials remain upkeep and craft costs',()=>{
    for(const [key,def] of Object.entries(STRUCTS)){
      if(!def.item)continue;
      const builds=graph.edges.filter(e=>e.kind==='BUILD_COST'&&e.to===`structure:${key}`);
      expect(builds.map(e=>[e.from,e.qtyIn]),key).toEqual([[`item:${def.item}`,1]]);
      const refunds=graph.edges.filter(e=>e.kind==='RECLAIM_REFUND'&&e.from===`structure:${key}`);
      expect(refunds.map(e=>[e.to,e.qtyOut]),key).toEqual([[`item:${def.item}`,1]]);
      expect(graph.edges.some(e=>e.kind==='CRAFT_OUTPUT'&&e.to===`item:${def.item}`)||['escrow_chest'].includes(def.item),key).toBe(true);
    }
  });
  it('motorbike repair has exactly the current paid bill and retired lubricant is not a live action',()=>{
    expect(graph.edges.filter(e=>e.kind==='VEHICLE_WEAR_REPAIR').map(e=>[e.from.slice(5),e.qtyIn])).toEqual(MOTORBIKE_REPAIR_COST);
    expect(graph.edges.filter(e=>e.kind==='VEHICLE_WEAR_REPAIR').every(e=>!isRetiredLive(e.from.slice(5)))).toBe(true);
    expect(graph.edges.filter(e=>e.kind==='VEHICLE_LUBRICATE').every(e=>e.runtimeStatus==='HISTORICAL_INFLIGHT_ONLY')).toBe(true);
  });
  it('historical merge findings explicitly yield to retirement, without reviving formulas or fabricated comparisons',()=>{
    const findings=buildRound2Findings(projectItemOntology(graph),{items:{},recipes:[],loot_edges:[]});
    expect(findings.P2.rows).toEqual([]);expect(findings.P2.unit.fasteners_recipe).toContain('RETIRED');
    expect(findings.P2.conclusion.join(' ')).toContain('No live');
  });
});
