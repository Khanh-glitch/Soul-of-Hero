import {searches,failedSearches,componentFailures,SEARCH_LIMIT_CELLS} from './navigation-save';
import {timedWorldWork} from './world-work';
import {countWorldWork} from './world-work';
/** Global physical navigation. Routes contain actual cardinal steps or authored stair edges.
 * No map-window mutation, source grants or assumed access to locked doors. */
import { G1B_GATES } from './g1b';
import { STRUCTS } from './catalog';
import { TILE, WW, WH, type RunState, type Entity } from './core';
import { withRunEntityRead, allRunEntities, globalCellTileAndClass, buildEntityBlockMap, receipt, markDirty } from './engine';
import { authoredPlan, authoredPoiIds } from '../veyra05/floors';
import { FRAME_W } from '../veyra05/frame';
import type { HumanRecord } from './humanworld';
export interface HumanWaypoint {tx:number;ty:number;floor:number}
const key=(p:HumanWaypoint)=>`${p.floor}:${p.tx},${p.ty}`;
const stairs=new Map<string,HumanWaypoint[]>(),doors=new Set<string>();
let indexed=false;
function indexArchitecture(){
 if(indexed)return;indexed=true;
 for(const id of authoredPoiIds())for(const [floor,layer] of authoredPlan(id)?.levels??[]){
  for(const d of layer.doors)doors.add(key({tx:d.x,ty:d.y,floor}));
  for(const s of layer.stairs){
   const from={tx:s.x,ty:s.y,floor:s.from},to={tx:s.tx,ty:s.ty,floor:s.to};
   for(const [a,b] of [[from,to],[to,from]]){const k=key(a),list=stairs.get(k)??[];if(!list.some(p=>key(p)===key(b)))list.push(b);stairs.set(k,list);}
  }
 }
}
type SearchNode={p:HumanWaypoint;g:number;score:number};
/** Planner memory law. Search continuations are saved with the run, so every bound here is also a
 * bound on the save: the 336 h campaign must stay inside the browser's local storage quota. Nothing
 * here declares a route impossible — a search is only ever made to WAIT or to start again.
 *  - a search nobody has asked about for STALE_SECONDS is abandoned work (the actor walked on, changed
 *    its mind or died) and is dropped the next time anyone starts a search;
 *  - small searches always run; past SMALL_SEARCH_CELLS only the GROWING_SEARCHES most advanced live
 *    searches grow — they finish first, the rest queue. ("Live" = asked about in the last LIVE_SECONDS;
 *    a search nobody asks about holds no place.) One search stops at SEARCH_LIMIT_CELLS examined, about
 *    104,000 held. The second of the two holds still once the pair passes TWO_LANE_CELLS (so it holds
 *    at most half of that), keeping what it has, and goes on when the first ends: the first can run to
 *    its limit and the pair stays under 150,000 cells, so the cap never has to take the second's work;
 *  - a queued resident's planner turn is not thrown away: it is spent on the most advanced growing
 *    search (`help` below). The planner gives one turn a second to residents away from the player, so
 *    the work done per hour is the same as if every search grew at once — only the memory is bounded;
 *  - if everything in flight still exceeds HARD_CELL_CAP, the cheapest work goes first: searches nobody
 *    asks about are dropped (oldest first); then queued searches are emptied, smallest first, down to
 *    a TICKET — the start cell and the old count — which keeps helping and starts again when a lane is
 *    free; then small searches are dropped (oldest first); a growing search only when nothing else is
 *    left.
 * Why this replaced the first queue: that one let a search grow while the larger ones held under
 * 100,000 cells and dropped the "least recently asked-about" one at the cap. Four or five searches of
 * similar size grew together past the cap, and because everybody in a queue asks every second the one
 * dropped was arbitrary — often one at 20,000-40,000 cells, about to finish. Replayed from h288 of the
 * 336 h campaign (23 residents asking for a route to a berth): 225,000-313,000 cells of work thrown
 * away per hour and one resident setting out in four hours.
 * Why SEARCH_LIMIT_CELLS went from 48,000 to 96,000 (2026-11-23): the evacuation berths are farther
 * than 48,000 cells of search from most of Greywater. Measured at h288 of two campaigns: routes of
 * 927-1,333 steps to the west berth needed 48,990, 60,591, 62,082 and 84,835 cells, so only the six or
 * so residents living nearest could ever set out, the vessel waits for six passengers, and one death
 * among those six meant nobody left the island. HARD_CELL_CAP is unchanged, so the save is no larger.
 *  - a SEARCH_LIMIT record keeps only the nearest part of its boundary (it is "unconfirmed", not a proof). */
const STALE_SECONDS=1800,LIVE_SECONDS=120,SMALL_SEARCH_CELLS=4096,GROWING_SEARCHES=2,TWO_LANE_CELLS=90_000,HARD_CELL_CAP=160_000,LIMIT_BOUNDARY_CELLS=256,FAILED_SEARCHES=256,COMPONENT_CELL_BUDGET=60_000;
const searchActor=(id:string)=>id.split(':')[3];
type Search=NonNullable<ReturnType<typeof searches.get>> extends Map<string,infer S>?S:never;
/** The long searches that hold a lane now: the GROWING_SEARCHES largest live ones, largest first; equal sizes keep the
 *  order they were started in. */
function growing(pending:Map<string,Search>,stamp:number):Search[]{
 const best:Search[]=[];
 for(const s of pending.values()){
  if(s.points.size<SMALL_SEARCH_CELLS||stamp-(s.touched??0)>LIVE_SECONDS)continue;
  let i=best.length;while(i>0&&best[i-1].points.size<s.points.size)i--;
  if(i<GROWING_SEARCHES){best.splice(i,0,s);if(best.length>GROWING_SEARCHES)best.pop();}
 }
 return best;
}
/** True while the second of the two must hold still (it keeps its lane and everything it has). */
const secondHolds=(lanes:Search[])=>lanes.length>1&&lanes[0].points.size+lanes[1].points.size>TWO_LANE_CELLS;
/** A queued search emptied at the cap: only its start cell, an empty frontier, and a count from before. No search
 *  that is still running looks like this — an empty frontier ends a search in the call that empties it. */
const isTicket=(s:Search)=>s.points.size===1&&!s.heap.length&&s.expanded>=SMALL_SEARCH_CELLS;
/** A new object every time (never a rewrite in place): the save reuses the bytes of a search object it has seen with the same counts. */
const emptySearch=(startKey:string,start:HumanWaypoint,from:{checked:string;resources?:string;touched?:number},expanded:number):Search=>
 ({heap:[],costs:new Map([[startKey,0]]),parent:new Map(),points:new Map([[startKey,start]]),expanded,checked:from.checked,resources:from.resources,blocked:new Map(),touched:from.touched});
const heapPush=(heap:SearchNode[],n:SearchNode)=>{heap.push(n);let i=heap.length-1;while(i){const parent=(i-1)>>1;if(heap[parent].score<=n.score)break;heap[i]=heap[parent];i=parent;}heap[i]=n;};
const heapPop=(heap:SearchNode[])=>{const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[c].score>=last.score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
// Floor transitions may move between different x/y stair endpoints: zero heuristic is safe there.
const estimate=(p:HumanWaypoint,target:HumanWaypoint)=>p.floor===target.floor&&p.floor===0?Math.max(0,Math.abs(p.tx-target.tx)+Math.abs(p.ty-target.ty)-1):0;
const atGoal=(p:HumanWaypoint,target:HumanWaypoint)=>p.floor===target.floor&&Math.abs(p.tx-target.tx)+Math.abs(p.ty-target.ty)<=1;
interface NavigationRead { all:Entity[]; blockMap:Map<string,number>; at:Map<string,Entity[]>;physical:()=>string }
const planningReads=new WeakMap<RunState,NavigationRead>();
/** Synchronous planning read only; never retained across work, save or external edits. */
export function withHumanNavigationRead<T>(r:RunState,read:()=>T):T {
 if(planningReads.has(r))return read();
 return withRunEntityRead(r,()=>{
  planningReads.set(r,navigationRead(r));
  try{return read();}finally{planningReads.delete(r);}
 });
}
function navigationRead(r:RunState):NavigationRead {return timedWorldWork('navigationRead',()=>{
 const all=allRunEntities(r),blockMap=buildEntityBlockMap(r,all),at=new Map<string,Entity[]>();
 const o=r.sourceMap?.veyra?.originAu,ox=o?Math.round(o[0]/.5):0,oy=o?Math.round(o[1]/.5):0;
 // Only door admission/entry consults this index; terrain and all other
 // blockers remain authoritative in blockMap. Keep co-located wall blockers.
 for(const e of all){
  if(e.kind!=='door' && !(e.kind==='struct' && (STRUCTS[e.type!]?.block || e.type?.startsWith('door'))))continue;
  const local=r.entities[e.id]===e;const p={tx:(e.tx??Math.floor(e.x/TILE))+(local?ox:0),ty:(e.ty??Math.floor(e.y/TILE))+(local?oy:0),floor:e.floor??0};const k=key(p);const list=at.get(k);if(list)list.push(e);else at.set(k,[e]);}
 const terrain=(states:RunState['terrain']|undefined)=>Object.entries(states??{}).map(([k,s])=>[k,s.t,!s.until||s.until>r.clock.simMs]);
 let fingerprint:string|undefined;
 const physical=()=>fingerprint??=JSON.stringify([r.layoutId,r.veyraFloor,r.sourceMap?.rules,o,[...blockMap],all.filter(e=>e.kind==='door'||e.type?.startsWith('door')).map(e=>[e.id,e.owner,e.locked,!!e.g1b,!!e.poiDoor,!!e.electricDoor]),terrain(r.terrain),terrain(r.veyraGlobalTerrain),r.veyraGlobalDoors,r.veyraGlobalDepletedLoot,r.natureTrees,Object.entries(r.veyraFloorState??{}).map(([f,s])=>[f,s.doors]),Object.entries(r.veyraGlobalFloorState??{}).map(([f,s])=>[f,s.doors])]);
 return {all,blockMap,at,physical};
});}
export function humanNavigation(r:RunState,occupied=new Set<string>(),avoidCrowding=false){
 indexArchitecture();
 const {all,blockMap,at,physical:readPhysical}=planningReads.get(r)??navigationRead(r);
 const o=r.sourceMap?.veyra?.originAu,ox=o?Math.round(o[0]/.5):0,oy=o?Math.round(o[1]/.5):0;
 // Resource eligibility is not a world-wide topology revision. A failed or
 // pending search watches only source cells on its own observed boundary.
 // Re-read scalar state each transaction; no markDirty convention is needed.
 const resourceReads=new Map<string,string>();
 const resources=(points:Iterable<HumanWaypoint>)=>{let signature='';for(const p of points){const k=key(p);let value=resourceReads.get(k);if(value===undefined){
   const lx=p.tx-ox,ly=p.ty-oy,inside=lx>=0&&ly>=0&&lx<WW&&ly<WH,li=ly*WW+lx,gi=p.ty*FRAME_W+p.tx;
   const s=inside&&p.floor===(r.veyraFloor??0)?r.sources[li]:(inside?r.veyraFloorState?.[p.floor]?.sources?.[li]:undefined)??(p.floor===0?r.veyraGlobalSources?.[gi]:r.veyraGlobalFloorState?.[p.floor]?.sources?.[gi]);
   value=s?`${+ (s.stock>0)}:${+!!s.burnt}:${+(s.regrowDoneAt!==undefined&&s.regrowDoneAt<=r.clock.lastSimAt)}`:'-';resourceReads.set(k,value);
 }signature+=`${k}=${value};`;}return signature;};
 const cells=new Map<string,ReturnType<typeof globalCellTileAndClass>>();
 const cell=(p:HumanWaypoint)=>{const k=key(p);let c=cells.get(k);if(!c){c=globalCellTileAndClass(r,p.tx,p.ty,p.floor,all,blockMap);cells.set(k,c);}return c;};
 const doorAllowed=(p:HumanWaypoint,h:HumanRecord)=>{
  if(p.floor===0&&G1B_GATES.some(g=>g.door[0]===p.tx&&g.door[1]===p.ty))return false;
  const list=at.get(key(p))??[],door=list.find(e=>e.kind==='door'||e.kind==='struct'&&e.type?.startsWith('door'));
  if(list.some(e=>e!==door&&e.kind==='struct'&&STRUCTS[e.type!]?.block))return false;
  if(door)return !door.locked&&!door.g1b&&!door.poiDoor&&!door.electricDoor&&(!door.owner||door.owner===h.community||door.owner==='player'&&h.following);
  return doors.has(key(p));
 };
 const free=(p:HumanWaypoint,h:HumanRecord,ignoreActors=false)=>{
  if(!ignoreActors&&occupied.has(`${p.floor}:${p.tx}:${p.ty}`))return false;
  const c=cell(p);return c.cls===0||c.cls===4||((c.cls===1||c.cls===3)&&doorAllowed(p,h));
 };
 const legalEdge=(h:HumanRecord,p:HumanWaypoint)=>{
  const from={tx:h.gx,ty:h.gy,floor:h.floor};
  return (from.floor===p.floor&&Math.abs(from.tx-p.tx)+Math.abs(from.ty-p.ty)===1||stairs.get(key(from))?.some(s=>key(s)===key(p)))&&free(p,h);
 };
 const enter=(h:HumanRecord,p:HumanWaypoint,now:number)=>{
  if(!legalEdge(h,p))return false;
  const c=cell(p);if(c.cls!==0&&c.cls!==4){
   const door=(at.get(key(p))??[]).find(e=>e.kind==='door'||e.kind==='struct'&&e.type?.startsWith('door'));
   if(door)door.open=true;
   const gi=p.ty*FRAME_W+p.tx;
   if(p.floor===0)(r.veyraGlobalDoors??={})[gi]=true;
   else {const fs=(r.veyraGlobalFloorState??={})[p.floor]??={sources:{},doors:{}};fs.doors[gi]=true;}
   if(p.floor===(r.veyraFloor??0)){const lx=p.tx-ox,ly=p.ty-oy;if(door&&r.entities[door.id]===door&&r.veyraFloorState?.[p.floor])r.veyraFloorState[p.floor].doors[`${lx},${ly}`]=true;}
   blockMap.delete(key(p));cells.delete(key(p));receipt(r,now,'human.door.open',`${h.actorId}:${key(p)}`);markDirty();
  }
  return true;
 };
 return {cell,free,legalEdge,enter,route(h:HumanRecord,target:HumanWaypoint,maxVisited=256):HumanWaypoint[]|null{
  const physical=readPhysical();
  const start={tx:h.gx,ty:h.gy,floor:h.floor},startKey=key(start);
  // Binary heap avoids repeated sorting of the search frontier. Every request has an explicit work bound.
  const searchKey=`${avoidCrowding}:${r.layoutId}:${r.sourceMap?.rules}:${h.actorId}:${h.community??''}:${!!h.following}:${startKey}>${key(target)}`;
  const status=(status:NonNullable<HumanRecord['routeSearch']>['status'],expanded:number)=>{h.routeSearch={status,target:key(target),expanded};};
  const access=`${r.layoutId}:${r.sourceMap?.rules}:${h.community??''}:${!!h.following}`;
  const components=componentFailures.get(r)??[];
  const targetNeighbors=[target,{...target,tx:target.tx+1},{...target,tx:target.tx-1},{...target,ty:target.ty+1},{...target,ty:target.ty-1}];
  for(const proof of components){
   if(proof.access!==access||!proof.points.has(startKey)||targetNeighbors.some(p=>proof.points.has(key(p))))continue;
   const revision=resources(proof.blocked);
   if(proof.checked!==physical||proof.resources!==revision){if(proof.blocked.some(p=>{countWorldWork('routeBoundaryChecks');return free(p,h,true);}))continue;proof.checked=physical;proof.resources=revision;}
   status('NO_PATH',proof.expanded);h.lastWorkBlock='No legal path out of this physically enclosed component.';return null;
  }
  let failed=failedSearches.get(r);if(!failed){failed=new Map();failedSearches.set(r,failed);}
  const known=failed.get(searchKey);
  const knownResources=known?resources(known.blocked):undefined;
  if(known&&((known.checked===physical&&known.resources===knownResources)||known.blocked.every(p=>{countWorldWork('routeBoundaryChecks');return !free(p,h,true);}))){known.checked=physical;known.resources=knownResources;status(known.status,known.expanded);h.lastWorkBlock=known.status==='NO_PATH'?'No legal path; waiting for a physical access change.':'Route remains unconfirmed at the search limit; waiting for a physical change.';return null;}

  let pending=searches.get(r);if(!pending){pending=new Map();searches.set(r,pending);}
  let state=pending.get(searchKey);
  // Reopen only when an actual boundary obstacle opens, not when a stock
  // quantity changes on the other side of the island. Never return stale paths.
  const pendingResources=state?resources(state.blocked.values()):undefined;
  if(state&&(state.checked!==physical||state.resources!==pendingResources)&&[...state.blocked.values()].some(p=>{countWorldWork('routeBoundaryChecks');return free(p,h,true);})){pending.delete(searchKey);state=undefined;}
  const stamp=Math.max(0,Math.floor((r.clock.lastSimAt-r.startedAt)/1000));
  if(!state){state={heap:[],costs:new Map([[startKey,0]]),parent:new Map(),points:new Map([[startKey,start]]),expanded:0,checked:physical,blocked:new Map(),touched:stamp};pending.set(searchKey,state);
   for(const [id,other] of pending){if(other===state)continue;const actor=r.humanWorld?.people[searchActor(id)];if(stamp-(other.touched??0)>STALE_SECONDS||actor&&(actor.state==='DEAD'||actor.state==='EVACUATED'))pending.delete(id);}
   if(pending.size>512)pending.delete(pending.keys().next().value!);}
  state.checked=physical;state.resources=resources(state.blocked.values());state.touched=stamp;
  // One node's neighbours, for whichever search is being advanced (`who` = that search's owner: doors answer to the owner).
  const spread=(s:Search,who:HumanRecord,to:HumanWaypoint,n:SearchNode,k:string)=>{
   const neighbors=[{...n.p,tx:n.p.tx+1},{...n.p,tx:n.p.tx-1},{...n.p,ty:n.p.ty+1},{...n.p,ty:n.p.ty-1},...(stairs.get(k)??[])];
   // Occupants are not permanent walls: retain a lawful static route and
   // reserve/revalidate its NEXT edge against actual bodies at execution time.
   for(const p of neighbors){if(!free(p,who,true)){s.blocked.set(key(p),p);continue;}const nk=key(p),g=n.g+1+(avoidCrowding&&occupied.has(`${p.floor}:${p.tx}:${p.ty}`)?4:0);if(g>=(s.costs.get(nk)??Infinity))continue;s.costs.set(nk,g);s.parent.set(nk,k);s.points.set(nk,p);heapPush(s.heap,{p,g,score:g+estimate(p,to)});}
  };
  // The cap of the memory law. `spare`: the search this call has just advanced.
  const enforceCap=(spare?:Search)=>{
   let total=0;for(const other of pending!.values())total+=other.points.size;
   while(total>HARD_CELL_CAP){
    const keep=growing(pending!,stamp);
    let oldId:string|undefined,oldRank=Infinity,oldOrder=Infinity;
    for(const [id,other] of pending!){
     if(other===spare)continue;
     const at=other.touched??0,size=other.points.size;
     const [rank,order]=stamp-at>LIVE_SECONDS?[0,at]:keep.includes(other)?[3,size]:size>=SMALL_SEARCH_CELLS?[1,size]:[2,at];
     if(rank<oldRank||rank===oldRank&&order<oldOrder){oldId=id;oldRank=rank;oldOrder=order;}
    }
    if(oldId===undefined)break;
    const old=pending!.get(oldId)!;
    if(oldRank===1){const [k0,p0]=old.points.entries().next().value!;total-=old.points.size-1;pending!.set(oldId,emptySearch(k0,p0,old,Math.max(old.expanded,SMALL_SEARCH_CELLS)));}
    else {total-=old.points.size;pending!.delete(oldId);}
   }
  };
  // A queued resident's turn advances the most advanced search that still needs work, under that search's owner's
  // access. It never ENDS a search: it stops before the goal, at the limit, or at an empty frontier, so the owner's
  // next call ends it and takes the result. The goal node is looked at, not popped — the frontier is not disturbed.
  const help=()=>{
   let budget=Math.min(maxVisited,256);
   const lanes=growing(pending!,stamp);
   for(const s of lanes){
    if(budget<=0||s===lanes[1]&&secondHolds(lanes))break;
    let id:string|undefined;for(const [k,v] of pending!)if(v===s){id=k;break;}
    if(!id||id.split(':')[0]!==String(avoidCrowding))continue;
    const who=r.humanWorld?.people[searchActor(id)];if(!who||who.state==='DEAD'||who.state==='EVACUATED')continue;
    const [floor,tx,ty]=id.slice(id.lastIndexOf('>')+1).split(/[:,]/).map(Number),to={tx,ty,floor},from=s.points.keys().next().value!;
    while(budget>0&&s.heap.length&&s.expanded<SEARCH_LIMIT_CELLS){
     const top=s.heap[0],tk=key(top.p);
     if(top.g===s.costs.get(tk)&&(tk===from||free(top.p,who,true))&&atGoal(top.p,to))break;
     const n=heapPop(s.heap),k=tk;budget--;s.expanded++;countWorldWork('routeExpansions');
     if(n.g!==s.costs.get(k))continue;
     if(k!==from&&!free(n.p,who,true)){s.blocked.set(k,n.p);continue;}
     spread(s,who,to,n,k);
    }
   }
   enforceCap();
  };
  const queued=(examined:number)=>{help();status('PENDING_SEARCH',examined);h.lastWorkBlock=`Checking physical route (${examined} cells examined; waiting for longer searches ahead).`;return null;};
  // Queue discipline for long searches (see the memory law above).
  if(isTicket(state)){
   if(growing(pending,stamp).length>=GROWING_SEARCHES)return queued(state.expanded);
   state=emptySearch(startKey,start,state,0);state.touched=stamp;pending.set(searchKey,state);   // a lane is free: start again
  }
  const {heap,costs,parent,points}=state;
  if(points.size>=SMALL_SEARCH_CELLS){const lanes=growing(pending,stamp);if(!lanes.includes(state)||state===lanes[1]&&secondHolds(lanes))return queued(state.expanded);}
  if(!heap.length&&state.expanded===0)heapPush(heap,{p:start,g:0,score:estimate(start,target)});let visited=0;
  while(heap.length&&visited++<Math.min(maxVisited,256)){const n=heapPop(heap),k=key(n.p);state.expanded++;countWorldWork('routeExpansions');if(n.g!==costs.get(k))continue;if(k!==startKey&&!free(n.p,h,true)){state.blocked.set(k,n.p);continue;}
   if(atGoal(n.p,target)){const result:HumanWaypoint[]=[];for(let q=k;q!==startKey;q=parent.get(q)!)result.push(points.get(q)!);pending.delete(searchKey);const path=result.reverse();if(!path.every(p=>free(p,h,true))){status('PENDING_SEARCH',state.expanded);h.lastWorkBlock='Route changed during planning; checking again.';return null;}status('FOUND',state.expanded);return path;}
   spread(state,h,target,n,k);
  }
  if(heap.length&&state.expanded<SEARCH_LIMIT_CELLS)enforceCap(state);
  if(!heap.length||state.expanded>=SEARCH_LIMIT_CELLS){
   if(!heap.length){components.push({access,checked:physical,resources:resources(state.blocked.values()),points:new Set(points.keys()),blocked:[...state.blocked.values()],expanded:state.expanded});if(components.length>64)components.shift();for(let cells=components.reduce((n,c)=>n+c.points.size,0);cells>COMPONENT_CELL_BUDGET&&components.length>1;)cells-=components.shift()!.points.size;componentFailures.set(r,components);}
   const outcome=!heap.length?'NO_PATH':'SEARCH_LIMIT';status(outcome,state.expanded);const boundary=outcome==='SEARCH_LIMIT'?[...state.blocked.values()].slice(0,LIMIT_BOUNDARY_CELLS):[...state.blocked.values()];failed.set(searchKey,{checked:physical,resources:resources(boundary),blocked:boundary,status:outcome,expanded:state.expanded});if(failed.size>FAILED_SEARCHES)failed.delete(failed.keys().next().value!);pending.delete(searchKey);h.lastWorkBlock=!heap.length?'No legal path through the currently known geometry.':'Physical route search limit reached; destination remains unconfirmed.';}
  else {status('PENDING_SEARCH',state.expanded);h.lastWorkBlock=`Checking physical route (${state.expanded} cells examined; no travel claimed).`;}
  return null;
 }};
}
