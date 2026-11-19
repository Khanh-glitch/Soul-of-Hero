import {describe,it,expect} from 'vitest';
import {newGame,startRun,roofRoom,markDirty} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {authoredPlan} from '../src/veyra05/floors';
import {FRAME_W} from '../src/veyra05/frame';
import {humanShelter} from '../src/game/human-shelter';
import {applyDamage,tickNeeds} from '../src/game/humanworld';
import {T0} from './helpers/g1b-kit';
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);return gs;}
describe('global physical shelter and single incident',()=>{
 it('translates global body coordinates to local roof authority on the actual floor',()=>{
  const r=scene().run!,o=r.sourceMap!.veyra!.originAu,ox=Math.round(o[0]/.5),oy=Math.round(o[1]/.5);
  const room=authoredPlan('po_greywater')!.levels.get(0)!.rooms.find(q=>q.roof&&!q.open)!;
  const cell=room.cells.find(k=>Math.floor(k/FRAME_W)-oy>=0&&Math.floor(k/FRAME_W)-oy<200)!;
  const gx=cell%FRAME_W,gy=Math.floor(cell/FRAME_W);
  expect(humanShelter(r,gx,gy,0)).toBe(roofRoom(r,(gx-ox+.5)*16,(gy-oy+.5)*16).enclosed);
  expect(humanShelter(r,gx,gy,2)).toBe(false);
 });
 it('archived real roof/floor/door state remains queryable across JSON reload and camera relocation',()=>{
  const r=scene().run!;
  const plan=authoredPlan('po_hook')!,room=plan.levels.get(0)!.rooms.find(q=>q.roof&&!q.open&&!q.hazard)!;
  const cell=room.cells.find(k=>plan.levels.get(0)!.tiles.get(k)!==15)!;
  const gx=cell%FRAME_W,gy=Math.floor(cell/FRAME_W);
  const expected=humanShelter(r,gx,gy,0);expect(expected).toBe(true);
  const loaded=JSON.parse(JSON.stringify(r));
  loaded.sourceMap.veyra.originAu=[0,0];loaded.entities={};markDirty();
  expect(humanShelter(loaded,gx,gy,0)).toBe(expected);
  expect(humanShelter(loaded,gx+200,gy+200,0)).toBe(false);
 });
 it('one landed damage event produces one incident and grievance references that same persistent ID',()=>{
  const r=scene().run!,hw=r.humanWorld!,h=Object.values(hw.people)[0];
  const n=Object.keys(hw.incidents).length;h.floor=0;
  expect(applyDamage(r,hw,h,4,0,T0+1000,'player','player',0)).toBe(true);
  expect(Object.keys(hw.incidents)).toHaveLength(n+1);
  const id=Object.keys(hw.incidents)[n];
  expect(h.disposition_known.incidents.filter(k=>k===id)).toHaveLength(1);
  const loaded=JSON.parse(JSON.stringify(r)),actor=loaded.humanWorld.people[h.actorId];
  applyDamage(loaded,loaded.humanWorld,actor,4,0,T0+2000,'player','player',0);
  expect(Object.keys(loaded.humanWorld.incidents)).toHaveLength(n+2);
  expect(loaded.humanWorld.incidents[id].victim).toBe(h.actorId);
  expect(new Set(actor.disposition_known.incidents).size).toBe(2);
 });
 it('offscreen warmth follows physical shelter rather than a remote active-window tile',()=>{
  const r=scene().run!,hw=r.humanWorld!,h=Object.values(hw.people)[0],p=authoredPlan('po_hook')!;
  const cell=p.levels.get(0)!.rooms.find(q=>q.roof&&!q.open&&!q.hazard)!.cells[0];h.gx=cell%FRAME_W;h.gy=Math.floor(cell/FRAME_W);h.floor=0;h.warmth=80;
  tickNeeds(r,hw,T0+60000);expect(h.warmth).toBe(80);
 });
});
