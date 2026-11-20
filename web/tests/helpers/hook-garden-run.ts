import assert from 'node:assert/strict';
import {newGame,startRun,findRunEntity,beginReceiptSink,endReceiptSink} from '../../src/game/engine';
import {setActiveLayout} from '../../src/game/world';
import {settle} from '../../src/game/sim';
import {validate} from '../../src/game/persist';

/** Only time and a validated JSON round-trip drive this normal geographic start. */
export function naturalHookGarden(observe?:(r:NonNullable<ReturnType<typeof newGame>['run']>,sec:number)=>void){
 const start=Date.UTC(2026,10,15,8);setActiveLayout('veyra05-world');let gs=newGame();assert(startRun(gs,'female',start,null,7606).ok);
 const community=()=>gs.run!.humanWorld!.communities['com:po_hook'];
 const plotId=community().workStations.find(id=>findRunEntity(gs.run!,id)?.type==='garden');assert(plotId);
 const plot=()=>findRunEntity(gs.run!,plotId)!;assert.deepEqual(plot().garden,{crop:null,growth:0,water:0});assert(!gs.run!.qaUsed);
 const rows=()=>Object.values(community().cargoLedger??{}).flat().filter(row=>row.stationId===plotId);
 const events:ReturnType<typeof endReceiptSink>=[];let growthAtReload=0;
 for(let sec=30;sec<=1200;sec+=30){
  beginReceiptSink();try{settle(gs,start+sec*1000,true);}finally{events.push(...endReceiptSink().filter(e=>e.kind.startsWith('human.garden.')&&JSON.parse(e.detail).plot===plotId));}
  if(!growthAtReload && plot().garden!.growth>0 && plot().garden!.growth<1){const before=JSON.stringify(plot().garden);growthAtReload=plot().garden!.growth;gs=validate(JSON.parse(JSON.stringify(gs)))!;assert(gs);assert.equal(JSON.stringify(plot().garden),before);}
  observe?.(gs.run!,sec);
  const firstHarvest=events.find(e=>e.kind==='human.garden.harvest');
  if(firstHarvest && events.filter(e=>e.kind==='human.garden.plant').length>=2 && rows().some(row=>row.jobId===JSON.parse(firstHarvest.detail).job && row.key==='crop'))break;
 }
 const planted=events.filter(e=>e.kind==='human.garden.plant').map(e=>JSON.parse(e.detail));
 assert(growthAtReload>0);assert(events.some(e=>e.kind==='human.garden.water'));assert(planted.length>=2,'plot not replanted');
 const [first,second]=planted,harvest=events.find(e=>e.kind==='human.garden.harvest');assert(harvest);
 for(const planting of [first,second])assert.deepEqual(planting.inputs.map((v:{key:string;qty:number})=>[v.key,v.qty]),[['seed_sunroot',1]]);
 const harvestId=JSON.parse(harvest.detail).job,output=rows().filter(row=>row.jobId===harvestId);
 assert.equal(harvestId,first.job);assert.notEqual(first.job,second.job);assert(output.every(row=>row.inputs?.[0].uid===first.inputs[0].uid));
 assert.deepEqual(output.map(row=>[row.key,row.qty]).sort(),[['crop',3],['seed_sunroot',1]]);
 return {seed:gs.run!.seed,start,plotId,growthAtReload,events,output};
}
