import {it,expect} from 'vitest';
import {newGame,startRun,beginReceiptSink,endReceiptSink,C,findRunEntity} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';
import {measureWorldWork} from '../src/game/world-work';
import {globalSourceCandidates} from '../src/veyra05/window';
import {RECIPES,SOURCES} from '../src/game/catalog';
import {T0} from './helpers/g1b-kit';
it('normal New Game exposes the canonical ingredient catchment blocker without inventing paid meals',()=>{
 setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 beginReceiptSink();const measured=measureWorldWork(()=>settle(gs,T0+180000,true));const receipts=endReceiptSink();
 const r=gs.run!,hw=r.humanWorld!;
 console.log(JSON.stringify({case:'natural-cook',counts:measured.counts,elapsedMs:measured.elapsedMs,events:receipts.filter(e=>/production|work\.(fetch|start|commit)|cargo.lineage|human.consume/.test(e.kind)),cooks:Object.values(hw.people).filter(h=>h.occupation==='cook').map(h=>({id:h.actorId,community:h.community,job:h.harvestJob,intent:h.intent,block:h.lastWorkBlock,pack:C(r,h.inv.packId).slots,stations:hw.communities[h.community!].workStations.map(id=>findRunEntity(r,id)?.type),store:hw.communities[h.community!].storeContainers.map(id=>C(r,id).slots)}))}));
 expect(Object.keys(hw.people)).toHaveLength(286);
 const audit=Object.values(hw.people).filter(h=>h.occupation==='cook'&&hw.communities[h.community!].workStations.some(id=>findRunEntity(r,id)?.type==='campfire')).map(h=>{
 const wanted=new Set((h.knownRecipes??[]).flatMap(k=>RECIPES[k]?.ins.length===1?RECIPES[k].ins.map(([key])=>key):[]));
 const allowed=new Set(Object.keys(SOURCES).filter(k=>SOURCES[k].yields.some(([key])=>wanted.has(key))));
 const o=r.sourceMap!.veyra!.originAu,local=h.gx>=o[0]*2&&h.gy>=o[1]*2&&h.gx<o[0]*2+200&&h.gy<o[1]*2+200;
 const comm=hw.communities[h.community!],stock=[...C(r,h.inv.packId).slots,...comm.storeContainers.flatMap(cid=>C(r,cid).slots)].filter(s=>s&&!s.production);
 const recipes=(h.knownRecipes??[]).map(recipe=>({recipe,missing:RECIPES[recipe].ins.flatMap(([key,qty])=>{const have=stock.reduce((n,s)=>n+(s?.key===key?s.qty:0),0);return have<qty?[{key,need:qty,have}]:[];})}));
 return {actor:h.actorId,wanted:[...wanted],recipes,candidateCount:globalSourceCandidates(h.gx,h.gy,h.floor,4,allowed,local?r.layoutId:undefined).length};});
 console.log(JSON.stringify({case:'cook-supply-blocker',audit}));
 expect(audit.length).toBeGreaterThan(0);expect(audit.every(a=>a.candidateCount===0)).toBe(true);expect(audit.every(a=>a.recipes.every(rc=>rc.missing.length>0))).toBe(true);
 expect(receipts.some(e=>e.kind==='human.production.pay')).toBe(false); // bounded negative proof, NOT natural Cook completion

},90000);
