import {describe,it,expect} from 'vitest';
import {newGame,startRun,C,globalFreshWater,globalCellTileAndClass,allRunEntities} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {humanNavigation} from '../src/game/human-navigation';
import {stepHumans,PROFILES,humanEventBoundary,humanConsume} from '../src/game/humanworld';
import {authoredPlan,authoredPoiIds} from '../src/veyra05/floors';
import {TILE} from '../src/game/core';
import {validate} from '../src/game/persist';
import {T0} from './helpers/g1b-kit';
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);return gs;}
describe('global human route and source execution (engineering fixtures, not browser acceptance)',()=>{
 it('derived sorted entity views observe direct add/delete/replacement/archive changes immediately',()=>{
  const r=scene().run!;const original=allRunEntities(r),e=original.find(e=>r.veyraOffscreenEntities?.[e.id]===e)!;
  expect(e).toBeTruthy();const first=allRunEntities(r);first.length=0;expect(allRunEntities(r)).toHaveLength(original.length);
  const replacement={...e,hp:7};r.veyraOffscreenEntities![e.id]=replacement;expect(allRunEntities(r).find(q=>q.id===e.id)).toBe(replacement);
  delete r.veyraOffscreenEntities![e.id];expect(allRunEntities(r).some(q=>q.id===e.id)).toBe(false);
  r.entities[e.id]=replacement;expect(allRunEntities(r).filter(q=>q.id===e.id)).toHaveLength(1);
 });
 it('walks a real offscreen cardinal route with saved partial tile time and no repeated settlement',()=>{
  const gs=scene(),r=gs.run!,hw=r.humanWorld!;const nav=humanNavigation(r);
  const h=Object.values(hw.people).find(h=>h.floor===0&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>nav.free({tx:h.gx+dx,ty:h.gy+dy,floor:0},h))&&h.gx>300)!;
  expect(h).toBeTruthy();for(const other of Object.values(hw.people))other.nextThinkAt=T0+100000;h.following=false;h.hunger=h.thirst=100;h.nextThinkAt=T0+100000;
  const p=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({tx:h.gx+dx,ty:h.gy+dy,floor:h.floor})).find(p=>nav.free(p,h))!;
  const from={gx:h.gx,gy:h.gy};h.state='MOVING';h.intent={intentId:'real-remote-step',actorId:h.actorId,kind:'move',preconditions:['fixture on actual map'],reserved:[],startAt:T0,dueAt:T0,route:[p]};
  const travel=TILE/PROFILES[h.profile].speed*1000;
  expect(humanEventBoundary(r,hw,T0,60000)).toBeCloseTo(travel);
  stepHumans(r,hw,T0+travel/2);expect(h.gx).toBe(from.gx);expect(h.gy).toBe(from.gy);
  r.clock.lastSimAt=T0+travel/2;const loaded=validate(JSON.parse(JSON.stringify(gs)))!;expect(loaded).toBeTruthy();
  const lr=loaded.run!,lh=lr.humanWorld!.people[h.actorId];stepHumans(lr,lr.humanWorld!,T0+travel);
  expect([lh.gx,lh.gy,lh.floor]).toEqual([p.tx,p.ty,p.floor]);const before=JSON.stringify(lh);stepHumans(lr,lr.humanWorld!,T0+travel);expect(JSON.stringify(lh)).toBe(before);
  stepHumans(r,hw,T0+travel);expect([h.gx,h.gy,h.floor,h.state]).toEqual([lh.gx,lh.gy,lh.floor,lh.state]);
 });
 it('crosses only a real authored stair edge; a forged floor hop fails',()=>{
  const r=scene().run!,hw=r.humanWorld!,h=Object.values(hw.people)[0],nav=humanNavigation(r);
  let edge:{x:number;y:number;from:number;tx:number;ty:number;to:number}|undefined;
  search:for(const id of authoredPoiIds())for(const layer of authoredPlan(id)?.levels.values()??[])for(const s of layer.stairs){if(nav.free({tx:s.x,ty:s.y,floor:s.from},h)&&nav.free({tx:s.tx,ty:s.ty,floor:s.to},h)){edge=s;break search;}}
  expect(edge).toBeTruthy();const e=edge!;h.gx=e.x;h.gy=e.y;h.floor=e.from;h.state='MOVING';h.nextThinkAt=T0+100000;hw.people={[h.actorId]:h};
  expect(nav.legalEdge(h,{tx:e.x+8,ty:e.y+8,floor:e.to})).toBe(false);
  h.intent={intentId:'authored-stair',actorId:h.actorId,kind:'move',preconditions:['authored stair'],reserved:[],startAt:T0,dueAt:T0,route:[{tx:e.tx,ty:e.ty,floor:e.to}]};
  stepHumans(r,hw,T0+TILE/PROFILES[h.profile].speed*1000);expect([h.gx,h.gy,h.floor]).toEqual([e.tx,e.ty,e.to]);
 });
 it('allows community food only at physical cardinal contact, including outside the camera',()=>{
  const r=scene().run!,hw=r.humanWorld!,h=Object.values(hw.people).find(h=>h.gx>300&&hw.communities[h.community!]?.storeTile)!;
  const c=hw.communities[h.community!],p=c.storeTile!;C(r,h.inv.packId).slots.fill(null);const store=C(r,c.foodStores[0]);const food=store.slots.find(s=>s?.key==='berries');
  if(!food){ // Explicit finite fixture stock, not a source-viability claim.
   store.slots[0]={uid:'fixture-finite-serving',key:'berries',qty:1};
  }
  h.gx=p[0]+20;h.gy=p[1];h.floor=0;h.hunger=10;expect(humanConsume(r,hw,h,'food',T0)).toBe(false);
  h.gx=p[0]+1;expect(humanConsume(r,hw,h,'food',T0)).toBe(true);expect(h.hunger).toBeGreaterThan(10);
 });
 it('a thirsty actor independently chooses a real bank and drinks only after timed contact',()=>{
  const r=scene().run!,hw=r.humanWorld!,h=Object.values(hw.people).find(h=>h.floor===0)!,nav=humanNavigation(r);
  let bank:{tx:number;ty:number;floor:number}|undefined,water:{gx:number;gy:number}|undefined;
  search:for(let dy=-40;dy<=40;dy++)for(let dx=-40;dx<=40;dx++){
   const gx=h.gx+dx,gy=h.gy+dy;if(!globalFreshWater(r,gx,gy,0))continue;
   for(const [ax,ay]of [[1,0],[-1,0],[0,1],[0,-1]]){const p={tx:gx+ax,ty:gy+ay,floor:0};if(nav.free(p,h)){bank=p;water={gx,gy};break search;}}
  }
  expect(bank).toBeTruthy();h.gx=bank!.tx;h.gy=bank!.ty;h.thirst=30;h.hunger=100;h.state='IDLE';h.intent=undefined;h.nextThinkAt=0;h.following=false;
  // Isolated resource-access fixture: no gifted supplies, no forced work intent.
  hw.people={[h.actorId]:h};hw.communities[h.community!].foodStores=[];C(r,h.inv.packId).slots.fill(null);
  stepHumans(r,hw,T0+1);expect(hw.people[h.actorId].intent?.target).toMatch(/^water:/);expect(h.state).toBe('WORKING');expect(h.thirst).toBe(30);
  stepHumans(r,hw,T0+2000);expect(h.thirst).toBe(30);
  stepHumans(r,hw,T0+2001);expect(h.thirst).toBe(55);expect(r.receipts.filter(e=>e.kind==='human.water')).toHaveLength(1);
  stepHumans(r,hw,T0+2001);expect(h.thirst).toBe(55);expect(water).toBeTruthy();
 });
 it('does not classify sea, ice, or an upstairs well icon as potable water',()=>{
  const r=scene().run!;expect(globalFreshWater(r,-1,-1,0)).toBe(false);expect(globalFreshWater(r,100,100,1)).toBe(false);
  const h=Object.values(r.humanWorld!.people).find(h=>h.floor===0)!;let p:{gx:number;gy:number}|undefined;
  for(let dy=-40;dy<=40&&!p;dy++)for(let dx=-40;dx<=40;dx++)if(globalFreshWater(r,h.gx+dx,h.gy+dy,0)){p={gx:h.gx+dx,gy:h.gy+dy};break;}
  expect(p).toBeTruthy();expect(globalCellTileAndClass(r,p!.gx,p!.gy,0).tile).toBeDefined();
 });
});
