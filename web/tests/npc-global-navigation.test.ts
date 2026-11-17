import {describe,it,expect} from 'vitest';
import {newGame,startRun,C,globalFreshWater,globalCellTileAndClass,allRunEntities} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {humanNavigation} from '../src/game/human-navigation';
import {stepHumans,PROFILES,humanEventBoundary,humanConsume} from '../src/game/humanworld';
import {authoredPlan,authoredPoiIds} from '../src/veyra05/floors';
import {TILE,T} from '../src/game/core';
import {getWindowWorldForGlobalTile,globalBaseWaterCell,setVeyraPlacementRules} from '../src/veyra05/window';
import {FRAME_W} from '../src/veyra05/frame';
import {SOURCES} from '../src/game/catalog';
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
 it('reports pending search separately from found geometry and admits no occupied physical edge',()=>{
  const r=scene().run!,h=Object.values(r.humanWorld!.people).find(h=>h.gx>300)!,nav=humanNavigation(r);
  const next=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({tx:h.gx+dx,ty:h.gy+dy,floor:h.floor})).find(p=>nav.free(p,h))!;
  expect(next).toBeTruthy();const occupied=new Set([`${next.floor}:${next.tx}:${next.ty}`]);
  const admission=humanNavigation(r,occupied);expect(admission.enter(h,next,T0)).toBe(false);
  expect(admission.route(h,{tx:next.tx+(next.tx-h.gx),ty:next.ty+(next.ty-h.gy),floor:h.floor},0)).toBeNull();
  expect(h.routeSearch?.status).toBe('PENDING_SEARCH');expect(h.routeSearch?.expanded).toBe(0);
  const path=admission.route(h,{tx:next.tx+(next.tx-h.gx),ty:next.ty+(next.ty-h.gy),floor:h.floor});
  expect(path).toEqual([next]);expect(h.routeSearch?.status).toBe('FOUND');
  expect(admission.enter(h,next,T0)).toBe(false);occupied.clear();expect(admission.enter(h,next,T0)).toBe(true);
 });
 it('does not restart a proven failed search until physical topology changes',()=>{
  const r=scene().run!,h=Object.values(r.humanWorld!.people)[0];
  // Unsupported floor fixture: no materialized layer, no legal exit and no floor hop.
  h.floor=3;const target={tx:h.gx+8,ty:h.gy,floor:3};
  expect(humanNavigation(r).route(h,target)).toBeNull();expect(h.routeSearch?.status).toBe('NO_PATH');
  expect(humanNavigation(r).route(h,target,0)).toBeNull();expect(h.routeSearch?.status).toBe('NO_PATH');
  const before=h.routeSearch?.expanded;r.clock.lastSimAt+=1000;
  humanNavigation(r).route(h,target,0);expect(h.routeSearch?.expanded).toBe(before);expect(h.routeSearch?.status).toBe('NO_PATH');
  // Equivalent access may reuse the exhausted component, not just an actor ID.
  const peer:typeof h={...h,actorId:`${h.actorId}:component-peer`,routeSearch:undefined};
  humanNavigation(r).route(peer,target,0);expect(peer.routeSearch?.status).toBe('NO_PATH');
  const outsider:typeof h={...peer,community:'different-access',actorId:`${peer.actorId}:other`,routeSearch:undefined};
  humanNavigation(r).route(outsider,target,0);expect(outsider.routeSearch?.status).toBe('PENDING_SEARCH');
  // Updated P0 law: an unrelated ground door does NOT invalidate a floor3 failure.
  (r.veyraGlobalDoors??={})[h.gy*FRAME_W+h.gx]=true;
  humanNavigation(r).route(h,target,0);expect(h.routeSearch?.status).toBe('NO_PATH');
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
 it('reads cached distant freshwater through live ice/expiry and pins map placement to the run',()=>{
  const r=scene().run!,gx=1000,gy=1000,w=getWindowWorldForGlobalTile(gx,gy,4);
  const i=w.world.fresh.findIndex(v=>v>0);expect(i).toBeGreaterThanOrEqual(0);
  const x=w.win.originTx+i%200,y=w.win.originTy+Math.floor(i/200),gi=y*FRAME_W+x;
  const base=globalBaseWaterCell(x,y,4);expect(base.fresh).toBe(true);expect(globalFreshWater(r,x,y,0)).toBe(true);
  (r.veyraGlobalTerrain??={})[gi]={t:T.ICE,until:r.clock.simMs+1000};
  expect(globalFreshWater(r,x,y,0)).toBe(false);r.clock.simMs+=1000;
  expect(globalFreshWater(r,x,y,0)).toBe(true);expect(globalFreshWater(r,x,y,1)).toBe(false);
  setVeyraPlacementRules(3);
  expect(getWindowWorldForGlobalTile(gx,gy,4)).toBe(w);
  expect(globalBaseWaterCell(x,y,4)).toEqual(base);setVeyraPlacementRules(4);
 });
 it('never caches mutable remote stock, terrain or entity obstruction as base geometry',()=>{
  const r=scene().run!,w=getWindowWorldForGlobalTile(1000,1000,r.sourceMap?.rules===4?4:3),layer=w.floors.ground;
  const i=layer.sources.findIndex((key,i)=>!!key&&key!=='wreck'&&!!SOURCES[key]?.block&&!!layer.walkable[i]&&!layer.solidProps[i]&&layer.tiles[i]!==T.PWALL);
  expect(i).toBeGreaterThanOrEqual(0);const x=w.win.originTx+i%200,y=w.win.originTy+Math.floor(i/200),gi=y*FRAME_W+x;
  const read=()=>globalCellTileAndClass(r,x,y,0,[],new Map());
  expect(read().cls).toBe(2);
  (r.veyraGlobalSources??={})[gi]={stock:0,hp:0};expect(read().cls).toBe(0);
  r.veyraGlobalSources[gi].stock=1;expect(read().cls).toBe(2);
  (r.veyraGlobalTerrain??={})[gi]={t:T.PWALL};expect(read().cls).toBe(1);
  delete r.veyraGlobalTerrain[gi];expect(read().cls).toBe(2);
  r.veyraGlobalSources[gi].stock=0;
  expect(globalCellTileAndClass(r,x,y,0,[],new Map([[`0:${x},${y}`,3]])).cls).toBe(3);
  expect(read().cls).toBe(0);
 });
 it('does not classify sea, ice, or an upstairs well icon as potable water',()=>{
  const r=scene().run!;expect(globalFreshWater(r,-1,-1,0)).toBe(false);expect(globalFreshWater(r,100,100,1)).toBe(false);
  const h=Object.values(r.humanWorld!.people).find(h=>h.floor===0)!;let p:{gx:number;gy:number}|undefined;
  for(let dy=-40;dy<=40&&!p;dy++)for(let dx=-40;dx<=40;dx++)if(globalFreshWater(r,h.gx+dx,h.gy+dy,0)){p={gx:h.gx+dx,gy:h.gy+dy};break;}
  expect(p).toBeTruthy();expect(globalCellTileAndClass(r,p!.gx,p!.gy,0).tile).toBeDefined();
 });
});
