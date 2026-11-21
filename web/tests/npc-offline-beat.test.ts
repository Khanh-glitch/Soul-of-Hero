import {describe,it,expect,beforeAll} from 'vitest';
import {newGame,startRun} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {humanEventBoundary,stepHumans,OFFLINE_HUMAN_BEAT_MS,PROFILES} from '../src/game/humanworld';
import {humanNavigation} from '../src/game/human-navigation';
import {TILE,HOUR} from '../src/game/core';
import type {RunState} from '../src/game/core';
import {T0} from './helpers/g1b-kit';
// Offline settlement law (Creator decision 2026-11-21): plan reviews, medical reviews and tile arrivals are
// resolved on one shared one-second beat while the player is away; causal deadlines keep their instants.
// Real generated population on the real map; no item, need or route is granted — only the clock is driven.
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);return gs.run!;}
const clone=(r:RunState):RunState=>JSON.parse(JSON.stringify(r));
/** A real resident standing where the map offers a straight-enough legal walk of at least `tiles` steps. */
function walker(r:RunState,tiles:number){
 const hw=r.humanWorld!;
 for(const h of Object.values(hw.people)){
  if(h.state!=='IDLE'||h.occupation==='guard')continue;
  for(const [dx,dy] of [[tiles,0],[-tiles,0],[0,tiles],[0,-tiles]]){
   const route=humanNavigation(r).route(h,{tx:h.gx+dx,ty:h.gy+dy,floor:h.floor});
   if(route&&route.length>=tiles)return {id:h.actorId,route};
  }
 }
 throw Error('no resident has a legal walk of that length');
}
function sendWalking(r:RunState,id:string,route:{tx:number;ty:number;floor:number}[]){
 const hw=r.humanWorld!,h=hw.people[id];hw.people={[id]:h};hw.lastStepAt=T0;hw.plannerAt=T0+HOUR;
 h.hunger=h.thirst=100;h.wounds=[];h.following=false;h.motion=undefined;h.state='MOVING';
 h.intent={intentId:'walk',actorId:id,kind:'move',target:'offline-beat-walk',preconditions:[],reserved:[],startAt:T0,dueAt:T0,route:route.map(p=>({...p}))};
 return h;
}
describe('offline one-second beat for resident reviews and walking',()=>{
 beforeAll(()=>{scene();},120_000);
 it('ends an offline slice on the beat for reviews and steps, and at the exact instant when the player is present',()=>{
  const r=scene(),hw=r.humanWorld!,h=Object.values(hw.people)[0];hw.people={[h.actorId]:h};
  expect(r.startedAt).toBe(T0);expect(OFFLINE_HUMAN_BEAT_MS).toBe(1000);
  h.state='IDLE';h.intent=undefined;h.following=false;h.hunger=h.thirst=100;h.rest=0;h.wounds=[];
  // A committed board visit is due 350 ms from now.
  h.recipeBoardPending=true;h.nextThinkAt=T0+350;hw.plannerAt=T0+1000;
  expect(humanEventBoundary(r,hw,T0,60000)).toBe(350);
  expect(humanEventBoundary(r,hw,T0,60000,true)).toBe(1000);
  // Mid-beat, the offline slice still ends on the next shared beat, never 1 ms later.
  expect(humanEventBoundary(r,hw,T0+400,60000,true)).toBe(600);
  expect(humanEventBoundary(r,hw,T0+1000,60000,true)).toBe(1000);
  // A review that is not due for 2.5 s waits for the first beat at or after it.
  h.nextThinkAt=T0+2500;expect(humanEventBoundary(r,hw,T0,60000)).toBe(2500);
  expect(humanEventBoundary(r,hw,T0,60000,true)).toBe(3000);
  // A walker: the live slice ends at the tile arrival, the offline slice on the beat.
  h.recipeBoardPending=false;h.state='MOVING';h.intent={intentId:'w',actorId:h.actorId,kind:'move',preconditions:[],reserved:[],startAt:T0,dueAt:T0,route:[{tx:h.gx+1,ty:h.gy,floor:h.floor}]};
  expect(humanEventBoundary(r,hw,T0,60000)).toBeCloseTo(TILE/PROFILES[h.profile].speed*1000);
  expect(humanEventBoundary(r,hw,T0,60000,true)).toBe(1000);
  // Timed work is a causal deadline: identical in both modes, to the millisecond.
  h.state='WORKING';h.intent={intentId:'t',actorId:h.actorId,kind:'work',preconditions:[],reserved:[],startAt:T0,dueAt:T0+1500};
  expect(humanEventBoundary(r,hw,T0,HOUR)).toBe(1500);expect(humanEventBoundary(r,hw,T0,HOUR,true)).toBe(1500);
 });
 it('walks the same distance in the same time whether stepped tile by tile or one beat at a time',()=>{
  const base=scene(),{id,route}=walker(base,10);
  const live=clone(base),away=clone(base),a=sendWalking(live,id,route),b=sendWalking(away,id,route);
  const travelMs=TILE/PROFILES[a.profile].speed*1000,start=[a.gx,a.gy];
  for(let beat=1;beat<=2;beat++){
   const until=T0+beat*1000;
   for(let t=T0+(beat-1)*1000;t<until;){t=Math.min(until,t+humanEventBoundary(live,live.humanWorld!,t,HOUR));stepHumans(live,live.humanWorld!,t);}
   stepHumans(away,away.humanWorld!,until,true);
   // Whole tiles covered are exactly speed x time; the offline walker is on the same tile as the live one.
   const covered=Math.floor(beat*1000/travelMs);
   expect(route.length-(b.intent?.route?.length??0)).toBe(covered);
   expect([b.gx,b.gy,b.floor]).toEqual([a.gx,a.gy,a.floor]);
   expect([b.gx,b.gy]).toEqual(covered?[route[covered-1].tx,route[covered-1].ty]:start);
   // …and the same fraction of the way into the next tile (epoch-millisecond floats resolve ~0.0002 ms).
   expect(b.motion?.elapsedMs??0).toBeCloseTo(a.motion?.elapsedMs??0,2);
  }
  // Finish the walk: both arrive on the last tile and release the errand.
  const end=T0+Math.ceil(route.length*travelMs/1000)*1000;
  for(let t=T0+2000;t<end;){t=Math.min(end,t+humanEventBoundary(live,live.humanWorld!,t,HOUR));stepHumans(live,live.humanWorld!,t);}
  for(let t=T0+3000;t<=end;t+=1000)stepHumans(away,away.humanWorld!,t,true);
  const last=route[route.length-1];
  for(const h of [a,b]){expect([h.gx,h.gy,h.floor]).toEqual([last.tx,last.ty,last.floor]);expect(h.state).toBe('IDLE');expect(h.intent).toBeUndefined();expect(h.motion).toBeUndefined();}
 },60_000);
 it('does not carry spare time through a tile that cannot be entered',()=>{
  const base=scene(),{id,route}=walker(base,10),away=clone(base),h=sendWalking(away,id,route);
  // Make the third tile of the route physically impassable after the route was chosen.
  const block=route[2],o=away.sourceMap!.veyra!.originAu,ox=Math.round(o[0]/.5),oy=Math.round(o[1]/.5);
  away.entities['beat-wall']={id:'beat-wall',kind:'struct',type:'wall_wood',tx:block.tx-ox,ty:block.ty-oy,x:(block.tx-ox)*TILE+8,y:(block.ty-oy)*TILE+8,hp:100,floor:block.floor};
  stepHumans(away,away.humanWorld!,T0+1000,true);
  expect([h.gx,h.gy]).toEqual([route[1].tx,route[1].ty]);expect(h.motion).toBeUndefined();expect(h.state).toBe('IDLE');
 },60_000);
});
