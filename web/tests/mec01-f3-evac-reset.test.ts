// MEC-01 F3 inspection: evacuate -> run 2 custody boundary.
// FIXTURE (labelled): secured cash 7 and a run-1 learned recipe are injected; the evacuation beacon is a fixture entity.
// REAL: evacuate intent (engine 'evacuate' case), endRun, startRun. Not NATURAL_INPUT. Deposit path is covered by escrow-route-physical.test.ts.
import {it,expect} from 'vitest';
import {addItem,countItem,dispatch,markDirty,newGame} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
const T=Date.UTC(2026,10,8);let n=0;
const act=(g:any,type:string,p:object={},at=T)=>dispatch(g,{id:'f3-'+(++n),type,...p} as any,at);
it('evacuate keeps profile securedCash, resets run-local physical cash and learned recipes', () => {
  setActiveLayout('shipping_fresh');const g:any=newGame();
  expect(act(g,'startRun',{character:'female',seed:404}).ok).toBe(true);
  const r=g.run!;r.creatures=[];markDirty();
  g.profile.securedCash=7;
  addItem(r,'inv','rcash',3);
  r.knowledge.recipes.push('motorbike_kit');
  const beacon={id:'fx-evac',kind:'evac',x:r.player.x,y:r.player.y,label:'Fixture evacuation beacon'} as any;
  r.entities[beacon.id]=beacon;markDirty();
  expect(act(g,'evacuate',{eid:beacon.id},T+10).ok).toBe(true);
  expect(g.run).toBeNull();
  expect(g.profile.securedCash).toBe(7);
  expect(act(g,'startRun',{character:'female',seed:405},T+20).ok).toBe(true);
  expect(g.profile.securedCash).toBe(7);
  expect(countItem(g.run,'inv','rcash')).toBe(0);
  expect(g.run.knowledge.recipes.includes('motorbike_kit')).toBe(false);
});
it('negative: evacuate away from the beacon is refused and the run and cash stay intact', () => {
  setActiveLayout('shipping_fresh');const g:any=newGame();
  act(g,'startRun',{character:'female',seed:406});
  const r=g.run!;r.creatures=[];markDirty();
  g.profile.securedCash=7;
  const beacon={id:'fx-evac-far',kind:'evac',x:r.player.x+50,y:r.player.y+50,label:'Fixture evacuation beacon'} as any;
  r.entities[beacon.id]=beacon;markDirty();
  expect(act(g,'evacuate',{eid:beacon.id},T+10).ok).toBe(false);
  expect(g.run).not.toBeNull();
  expect(g.profile.securedCash).toBe(7);
});
