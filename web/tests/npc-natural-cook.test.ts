import {it,expect} from 'vitest';
import {newGame,startRun,beginReceiptSink,endReceiptSink,C,findRunEntity} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';
import {measureWorldWork} from '../src/game/world-work';
import {globalSourceCandidates} from '../src/veyra05/window';
import {RECIPES,SOURCES} from '../src/game/catalog';
import {T0} from './helpers/g1b-kit';
it('normal New Game has no opening meal inputs; only a physical delivery can close the supply deficit',()=>{
 setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!;
 const auditStock=()=>Object.values(hw.people).filter(h=>h.occupation==='cook'&&hw.communities[h.community!].workStations.some(id=>findRunEntity(r,id)?.type==='campfire')).map(h=>{
 const wanted=new Set((h.knownRecipes??[]).flatMap(k=>RECIPES[k]?.ins.length===1?RECIPES[k].ins.map(([key])=>key):[]));
 const allowed=new Set(Object.keys(SOURCES).filter(k=>SOURCES[k].yields.some(([key])=>wanted.has(key))));
 const o=r.sourceMap!.veyra!.originAu,local=h.gx>=o[0]*2&&h.gy>=o[1]*2&&h.gx<o[0]*2+200&&h.gy<o[1]*2+200;
 const comm=hw.communities[h.community!],stock=[...C(r,h.inv.packId).slots,...comm.storeContainers.flatMap(cid=>C(r,cid).slots)].filter(s=>s&&!s.production);
 const recipes=(h.knownRecipes??[]).map(recipe=>({recipe,missing:RECIPES[recipe].ins.flatMap(([key,qty])=>{const have=stock.reduce((n,s)=>n+(s?.key===key?s.qty:0),0);return have<qty?[{key,need:qty,have}]:[];})}));
 return {actor:h.actorId,wanted:[...wanted],recipes,candidateCount:globalSourceCandidates(h.gx,h.gy,h.floor,4,allowed,local?r.layoutId:undefined).length};});
 // Keep the old negative on the actual opening state. Permanent absence AFTER
 // autonomous foraging contradicts T1. Reconcile any new payable bill with
 // cargo lineage instead of treating a delivered resource as a phantom grant.
 const opening=auditStock();expect(opening.length).toBeGreaterThan(0);
 expect(opening.every(a=>a.recipes.every(rc=>rc.missing.length>0))).toBe(true);
 beginReceiptSink();let receipts:ReturnType<typeof endReceiptSink>;
 try{measureWorldWork(()=>settle(gs,T0+180000,true));}finally{receipts=endReceiptSink();}
 expect(Object.keys(hw.people)).toHaveLength(286);
 const audit=auditStock();expect(audit.every(a=>a.candidateCount===0)).toBe(true);
 const supplied=audit.flatMap(a=>a.recipes.filter(rc=>!rc.missing.length).map(rc=>({actor:a.actor,recipe:rc.recipe})));
 expect(supplied).toEqual([{actor:'hm',recipe:'grilled_mushroom'}]);
 const c=hw.communities[hw.people.hm.community!];
 const drops=Object.values(c.cargoLedger??{}).flat().filter(row=>row.workerId==='hm'&&row.key==='mushroom');
 expect(drops).toHaveLength(1);const [drop]=drops;
 expect(drop).toMatchObject({sourceId:'0:2738558',qty:1});expect(drop.intoUid).toBe(drop.fromUid);
 // The warehouse ledger is history, not present custody. By 180s hm has
 // fetched the bill back out and is checking the route to the campfire.
 expect(receipts.some(e=>e.at>=drop.at&&e.kind==='human.work.fetch'&&e.detail.startsWith('hm:')&&e.detail.endsWith(':'+c.storeEntityId))).toBe(true);
 expect(C(r,hw.people.hm.inv.packId).slots.filter(s=>s?.uid===drop.intoUid)).toMatchObject([{key:'mushroom',qty:1}]);
 expect(c.storeContainers.flatMap(id=>C(r,id).slots).some(s=>s?.uid===drop.intoUid)).toBe(false);
 expect(hw.people.hm.intent?.work).toMatchObject({kind:'cook',recipe:'grilled_mushroom',phase:'travel'});
 expect(receipts.some(e=>e.kind==='human.production.pay')).toBe(false); // the ingredient is not a paid meal
 console.log(JSON.stringify({case:'natural-cook-supply',openingDeficits:opening.length,supplied,drop,paidMeals:0}));
},90000);
