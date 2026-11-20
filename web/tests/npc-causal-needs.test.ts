import {humanShelter,humanShelterContext} from '../src/game/human-shelter';
import {roofRoom} from '../src/game/engine';
import {describe,it,expect} from 'vitest';
import {newGame,startRun,findRunEntity} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {tickNeeds,humanEventBoundary,humanNeedsContext,usingHumanBed,finishHumanPlanReview,stepHumans} from '../src/game/humanworld';
import {humanEntityTile} from '../src/game/human-jobs';
import {T,WW,TILE,BAL,HOUR} from '../src/game/core';
import {T0} from './helpers/g1b-kit';
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);return gs.run!;}
describe('causal human biology and transaction-scoped housing (fixtures)',()=>{
 it('reuses exact local enclosure reads but detects direct door, roof and expiring terrain edits',()=>{
  const r=scene(),o=r.sourceMap!.veyra!.originAu,x=60,y=60;
  // Explicit 1-cell room fixture. No production source/item is granted.
  for(const [dx,dy]of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0]])r.terrain[(y+dy)*WW+x+dx]={t:T.MEADOW};
  r.entities['fixture-roof']={id:'fixture-roof',kind:'struct',type:'roof_thatch',tx:x,ty:y,x:x*TILE+8,y:y*TILE+8};
  for(const [dx,dy]of [[-1,0],[0,1],[0,-1]]){const id=`wall:${dx}:${dy}`;r.entities[id]={id,kind:'struct',type:'wall_wood',tx:x+dx,ty:y+dy,x:(x+dx)*TILE+8,y:(y+dy)*TILE+8};}
  const door=r.entities['fixture-door']={id:'fixture-door',kind:'struct' as const,type:'door_wood',tx:x+1,ty:y,x:(x+1)*TILE+8,y:y*TILE+8,open:false as boolean};
  const read=()=>humanShelter(r,o[0]*2+x,o[1]*2+y,0,humanShelterContext(r));
  expect(read()).toBe(true);const first=humanShelterContext(r);expect(humanShelterContext(r).results).toBe(first.results);
  door.open=true;expect(read()).toBe(false);expect(read()).toBe(roofRoom(r,(x+.5)*TILE,(y+.5)*TILE,true).enclosed);
  door.open=false;expect(read()).toBe(true);delete r.entities['fixture-roof'];expect(read()).toBe(false);
  r.entities['fixture-roof']={id:'fixture-roof',kind:'struct',type:'roof_thatch',tx:x,ty:y,x:x*TILE+8,y:y*TILE+8};door.open=true;
  r.terrain[y*WW+x+1]={t:T.PWALL,until:r.clock.simMs+1000};expect(read()).toBe(true);r.clock.simMs+=1000;expect(read()).toBe(false);
 });
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
 it('does not postpone a committed board visit behind the discretionary planner',()=>{
  const r=scene(),hw=r.humanWorld!,h=Object.values(hw.people)[0];hw.people={[h.actorId]:h};
  h.state='IDLE';h.intent=undefined;h.following=false;h.hunger=h.thirst=100;h.rest=0;h.nextThinkAt=T0+350;hw.plannerAt=T0+1000;
  expect(humanEventBoundary(r,hw,T0,60000)).toBe(1000);h.recipeBoardPending=true;
  expect(humanEventBoundary(r,hw,T0,60000)).toBe(350);
 });
 it('full-store cargo sleeps, but a separate interrupted medical fetch owns its retry',()=>{
  const r=scene(),hw=r.humanWorld!,h=Object.values(hw.people).find(p=>p.occupation==='medic')!;
  const store=r.custody[hw.communities[h.community!].storeContainers[0]];
  hw.people={[h.actorId]:h};h.state='IDLE';h.following=false;h.intent=undefined;h.gx=hw.communities[h.community!].storeTile![0]+1;h.gy=hw.communities[h.community!].storeTile![1];h.floor=0;
  h.hunger=h.thirst=100;h.rest=0;hw.plannerAt=T0+10000;h.nextThinkAt=T0+250;
  const wait={containerId:store.id,signature:JSON.stringify(store.slots)};h.deliveryWait=wait;
  expect(humanEventBoundary(r,hw,T0,60000)).toBe(10000);
  h.intent={intentId:'interrupted-fetch',actorId:h.actorId,kind:'work',target:'occupation:medical',reserved:[],preconditions:[],startAt:T0,dueAt:T0,work:{kind:'medical',phase:'fetch',inputs:[['bandage',1]],duration:6000,patientId:'departed-patient'}};
  const pack=JSON.stringify(r.custody[h.inv.packId]);expect(humanEventBoundary(r,hw,T0,60000)).toBe(250);
  stepHumans(r,hw,T0+250);expect(h.state).toBe('WORKING');expect(h.intent?.work?.phase).toBe('fetch');
  expect(humanEventBoundary(r,hw,T0+250,60000)).toBe(800);
  stepHumans(r,hw,T0+1050);expect(h.intent).toBeUndefined();expect(h.lastWorkBlock).toBe('patient no longer needs this dose');
  expect(h.deliveryWait).toEqual(wait);expect(JSON.stringify(store.slots)).toBe(wait.signature);expect(JSON.stringify(r.custody[h.inv.packId])).toBe(pack);
 });
 it('retains the exact movement/work deadlines instead of coarsening contact',()=>{
  const r=scene(),hw=r.humanWorld!,h=Object.values(hw.people)[0];hw.people={[h.actorId]:h};
  h.state='WORKING';h.intent={intentId:'timed-contact',actorId:h.actorId,kind:'work',preconditions:[],reserved:[],startAt:T0,dueAt:T0+1500};
  expect(humanEventBoundary(r,hw,T0,HOUR)).toBe(1500);
  h.state='DOWNED';h.hunger=h.thirst=0;h.hp=1;h.wounds=[];
  expect(humanEventBoundary(r,hw,T0,HOUR)).toBeCloseTo(60000/(2*BAL.player.starveDamagePerMin));
 });
 it('backs off unavailable livelihood reviews but not pending routes; biological urgency wakes the actor',()=>{
  const r=scene(),hw=r.humanWorld!,h=Object.values(hw.people)[0];
  h.state='IDLE';h.intent=undefined;h.following=false;h.nextThinkAt=T0;
  for(let n=0;n<9;n++)finishHumanPlanReview(h,T0+n*300000);
  expect(h.nextThinkAt).toBe(T0+9*300000);expect(h.blockedPlanCount).toBe(7);
  const at=T0+8*300000;hw.lastNeedsAt=at;h.hunger=40.001;h.thirst=100;
  tickNeeds(r,hw,at+60000);expect(h.nextThinkAt).toBe(at+60000);expect(h.blockedPlanCount).toBe(0);
  h.routeSearch={status:'PENDING_SEARCH',target:'0:1,1',expanded:256};h.nextThinkAt=at+66000;
  finishHumanPlanReview(h,at+60000);expect(h.nextThinkAt).toBe(at+66000);
 });
 it('keeps bounded fair reviews for every actor with no eligible action, without removing anyone',()=>{
  const r=scene(),hw=r.humanWorld!,actors=Object.values(hw.people);expect(actors.length).toBeGreaterThan(200);
  // Explicit exhausted-actor fixture: no harvesting/jobs can start, no actor is deleted/frozen.
  for(const h of actors){h.state='IDLE';h.intent=undefined;h.following=false;h.hunger=h.thirst=100;h.stamina=0;h.nextThinkAt=T0;h.nextPerceptionAt=T0+HOUR;}
  for(let n=1;n<=actors.length+1;n++)stepHumans(r,hw,T0+n*1000);
  expect(Object.values(hw.people)).toHaveLength(actors.length);
  expect(actors.filter(h=>!(h.blockedPlanCount??0)).map(h=>({id:h.actorId,state:h.state,next:h.nextThinkAt,stamina:h.stamina}))).toEqual([]);
  expect(actors.every(h=>(h.nextThinkAt??0)<=T0+(actors.length+1)*1000+300000)).toBe(true);
 });

});
