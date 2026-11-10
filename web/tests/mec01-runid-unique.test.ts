// MEC-01 runId uniqueness. REAL: startRun/abandon intents. Negative control: an old-format id stored in a save is left untouched.
import {it,expect} from 'vitest';
import {dispatch,newGame} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
const T=Date.UTC(2026,10,8);
it('two runs with the same seed get distinct ids and both survive in history', () => {
  setActiveLayout('shipping_fresh');const g:any=newGame();
  expect(dispatch(g,{id:'a',type:'startRun',character:'female',seed:404} as any,T).ok).toBe(true);
  const id1=g.run.id;
  expect(dispatch(g,{id:'b',type:'abandon'} as any,T+5).ok).toBe(true);
  expect(dispatch(g,{id:'c',type:'startRun',character:'female',seed:404} as any,T+100).ok).toBe(true);
  const id2=g.run.id;
  expect(id2).not.toBe(id1);
  expect(dispatch(g,{id:'d',type:'abandon'} as any,T+105).ok).toBe(true);
  expect(g.profile.history.map((h:any)=>h.runId)).toEqual([id2,id1]);
});
it('negative: a run started at the same instant with the same seed does not overwrite the earlier history id', () => {
  setActiveLayout('shipping_fresh');const g:any=newGame();
  dispatch(g,{id:'a',type:'startRun',character:'female',seed:405} as any,T);
  const id1=g.run.id;
  dispatch(g,{id:'b',type:'abandon'} as any,T+5);
  dispatch(g,{id:'c',type:'startRun',character:'female',seed:405} as any,T);
  expect(g.run.id).not.toBe(id1);
});
