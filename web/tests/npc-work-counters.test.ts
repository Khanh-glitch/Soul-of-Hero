import {it,expect} from 'vitest';
import {newGame,startRun} from '../src/game/engine';
import {settle} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
import {measureWorldWork} from '../src/game/world-work';
import {T0} from './helpers/g1b-kit';
it('counts bounded natural-population work without changing world authority',()=>{
 setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 const ids=Object.keys(gs.run!.humanWorld!.people);
 const sample=measureWorldWork(()=>settle(gs,T0+10000,true));
 console.log(JSON.stringify({case:'natural-10s',...sample,actors:ids.length}));
 expect(Object.keys(gs.run!.humanWorld!.people)).toEqual(ids);expect(ids).toHaveLength(286);
 expect(gs.run!.humanWorld!.lastNeedsAt).toBe(T0+10000);
},30000);
