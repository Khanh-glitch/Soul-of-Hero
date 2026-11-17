import {describe,it,expect} from 'vitest';
import {newGame,startRun,findRunEntity} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {tickNeeds,humanEventBoundary,humanNeedsContext,usingHumanBed} from '../src/game/humanworld';
import {humanEntityTile} from '../src/game/human-jobs';
import {BAL,HOUR} from '../src/game/core';
import {T0} from './helpers/g1b-kit';
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);return gs.run!;}
describe('causal human biology and transaction-scoped housing (fixtures)',()=>{
 it('does not impose a minute tick when the next physical threshold is hours away',()=>{
  const r=scene(),hw=r.humanWorld!,h=Object.values(hw.people)[0];hw.people={[h.actorId]:h};
  h.state='IDLE';h.following=true;h.hunger=h.thirst=100;h.rest=0;h.wounds=[];
  const expected=Math.min(4*HOUR,60/BAL.player.offlineHungerPerHour*HOUR,60/BAL.player.offlineThirstPerHour*HOUR);
  expect(humanEventBoundary(r,hw,T0,8*HOUR)).toBeCloseTo(expected);expect(expected).toBeGreaterThan(60000);
 });
 it('charges starvation only after actual depletion, with fine/offline and subsecond parity',()=>{
  const r=scene(),hw=r.humanWorld!,h=Object.values(hw.people)[0];hw.people={[h.actorId]:h};
  h.state='IDLE';h.hunger=BAL.player.offlineHungerPerHour/120;h.thirst=100;h.hp=h.maxHp;h.wounds=[];
  hw.lastNeedsAt=T0;const copy=JSON.parse(JSON.stringify(r)),ch=copy.humanWorld.people[h.actorId];
  tickNeeds(r,hw,T0+60000);
  for(let at=T0+250;at<=T0+60000;at+=250)tickNeeds(copy,copy.humanWorld,at);
  expect(h.hp).toBeCloseTo(h.maxHp-BAL.player.starveDamagePerMin*.5,7);
  for(const key of ['hp','hunger','thirst','rest','warmth'] as const)expect(h[key]).toBeCloseTo(ch[key],7);
  const before=JSON.stringify(hw);tickNeeds(r,hw,T0+60000);expect(JSON.stringify(hw)).toBe(before);
 });
 it('rebuilds unique claims after duplicate assignment, departure and direct bed destruction',()=>{
  const r=scene(),hw=r.humanWorld!,h=Object.values(hw.people).find(h=>h.bedId&&r.veyraOffscreenEntities?.[h.bedId])!;
  const bed=findRunEntity(r,h.bedId)!,[gx,gy]=humanEntityTile(r,bed);h.state='IDLE';h.following=false;h.floor=bed.floor??0;
  expect([[gx-1,gy],[gx+1,gy],[gx,gy-1],[gx,gy+1]].some(([x,y])=>{h.gx=x;h.gy=y;return usingHumanBed(r,hw,h);})).toBe(true);
  let ctx=humanNeedsContext(r,hw);expect(usingHumanBed(r,hw,h,ctx.shelter,ctx.bedClaims)).toBe(true);
  const other=Object.values(hw.people).find(q=>q!==h)!;other.bedId=bed.id;ctx=humanNeedsContext(r,hw);
  expect(ctx.bedClaims.get(bed.id)).toBe(2);expect(usingHumanBed(r,hw,h,ctx.shelter,ctx.bedClaims)).toBe(false);
  other.state='EVACUATED';ctx=humanNeedsContext(r,hw);expect(usingHumanBed(r,hw,h,ctx.shelter,ctx.bedClaims)).toBe(true);
  bed.hp=0;ctx=humanNeedsContext(r,hw);expect(usingHumanBed(r,hw,h,ctx.shelter,ctx.bedClaims)).toBe(false);
 });
 it('retains the exact movement/work deadlines instead of coarsening contact',()=>{
  const r=scene(),hw=r.humanWorld!,h=Object.values(hw.people)[0];hw.people={[h.actorId]:h};
  h.state='WORKING';h.intent={intentId:'timed-contact',actorId:h.actorId,kind:'work',preconditions:[],reserved:[],startAt:T0,dueAt:T0+1500};
  expect(humanEventBoundary(r,hw,T0,HOUR)).toBe(1500);
  h.state='DOWNED';h.hunger=h.thirst=0;h.hp=1;h.wounds=[];
  expect(humanEventBoundary(r,hw,T0,HOUR)).toBeCloseTo(60000/(2*BAL.player.starveDamagePerMin));
 });
});
