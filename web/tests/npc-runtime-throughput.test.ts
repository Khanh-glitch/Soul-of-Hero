import {describe,it,expect} from 'vitest';
import {newGame,startRun} from '../src/game/engine';
import {settle} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
import {HOUR} from '../src/game/core';
import {T0} from './helpers/g1b-kit';
// Real generated population + ordinary opening stock; no injected intent, item,
// Trust, removal or metabolic immunity. CPU timing is diagnostic, not matched FPS.
describe('bounded actual-world throughput',()=>{
 it('settles one real hour with every generated actor retained and no replay on repeated timestamp',()=>{
  setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
  const r=gs.run!,ids=Object.keys(r.humanWorld!.people),at=performance.now();
  settle(gs,T0+HOUR,true);
  console.log(JSON.stringify({case:'natural-population-h1',elapsedMs:performance.now()-at,actors:ids.length,needsAt:r.humanWorld!.lastNeedsAt,states:Object.values(r.humanWorld!.people).reduce((a,h)=>(a[h.state]=(a[h.state]??0)+1,a),{} as Record<string,number>)}));
  expect(Object.keys(r.humanWorld!.people)).toEqual(ids);
  expect(r.humanWorld!.lastNeedsAt).toBe(T0+HOUR);
  const snapshot=JSON.stringify(r.humanWorld);settle(gs,T0+HOUR,true);expect(JSON.stringify(r.humanWorld)).toBe(snapshot);
 },90000);
});
