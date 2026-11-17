/** Global physical navigation. Routes contain actual cardinal steps or authored stair edges.
 * No map-window mutation, source grants or assumed access to locked doors. */
import { G1B_GATES } from './g1b';
import { STRUCTS } from './catalog';
import { TILE, type RunState, type Entity } from './core';
import { allRunEntities, globalCellTileAndClass, buildEntityBlockMap, receipt, markDirty } from './engine';
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
type SearchState={heap:SearchNode[];costs:Map<string,number>;parent:Map<string,string>;points:Map<string,HumanWaypoint>;expanded:number};
// Search progress is derived, not an economic authority. Reload reconstructs it from the
// same physical origin; persisted actors/routes/items never depend on a hidden completion.
const searches=new WeakMap<RunState,Map<string,SearchState>>();
export function humanNavigation(r:RunState,occupied=new Set<string>()){
 indexArchitecture();
 const all=allRunEntities(r),blockMap=buildEntityBlockMap(r,all),at=new Map<string,Entity[]>();
 const o=r.sourceMap?.veyra?.originAu,ox=o?Math.round(o[0]/.5):0,oy=o?Math.round(o[1]/.5):0;
 for(const e of all){const local=r.entities[e.id]===e;const p={tx:(e.tx??Math.floor(e.x/TILE))+(local?ox:0),ty:(e.ty??Math.floor(e.y/TILE))+(local?oy:0),floor:e.floor??0};const k=key(p);at.set(k,[...(at.get(k)??[]),e]);}
 const cells=new Map<string,ReturnType<typeof globalCellTileAndClass>>();
 const cell=(p:HumanWaypoint)=>{const k=key(p);let c=cells.get(k);if(!c){c=globalCellTileAndClass(r,p.tx,p.ty,p.floor,all,blockMap);cells.set(k,c);}return c;};
 const doorAllowed=(p:HumanWaypoint,h:HumanRecord)=>{
  if(p.floor===0&&G1B_GATES.some(g=>g.door[0]===p.tx&&g.door[1]===p.ty))return false;
  const list=at.get(key(p))??[],door=list.find(e=>e.kind==='door'||e.kind==='struct'&&e.type?.startsWith('door'));
  if(list.some(e=>e!==door&&e.kind==='struct'&&STRUCTS[e.type!]?.block))return false;
  if(door)return !door.locked&&!door.g1b&&!door.poiDoor&&!door.electricDoor&&(!door.owner||door.owner===h.community||door.owner==='player'&&h.following);
  return doors.has(key(p));
 };
 const free=(p:HumanWaypoint,h:HumanRecord)=>{
  if(occupied.has(`${p.floor}:${p.tx}:${p.ty}`))return false;
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
  const start={tx:h.gx,ty:h.gy,floor:h.floor},startKey=key(start);
  // Binary heap avoids repeated sorting of the search frontier. Every request has an explicit work bound.
  const searchKey=`${h.actorId}:${startKey}>${key(target)}`;
  let pending=searches.get(r);if(!pending){pending=new Map();searches.set(r,pending);}
  let state=pending.get(searchKey);
  if(!state){state={heap:[],costs:new Map([[startKey,0]]),parent:new Map(),points:new Map([[startKey,start]]),expanded:0};pending.set(searchKey,state);if(pending.size>512)pending.delete(pending.keys().next().value!);}
  const {heap,costs,parent,points}=state;
  const push=(n:SearchNode)=>{heap.push(n);let i=heap.length-1;while(i){const parent=(i-1)>>1;if(heap[parent].score<=n.score)break;heap[i]=heap[parent];i=parent;}heap[i]=n;};
  const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[c].score>=last.score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
  // Floor transitions may move between different x/y stair endpoints: zero heuristic is safe there.
  const estimate=(p:HumanWaypoint)=>p.floor===target.floor&&p.floor===0?Math.max(0,Math.abs(p.tx-target.tx)+Math.abs(p.ty-target.ty)-1):0;
  if(!heap.length&&state.expanded===0)push({p:start,g:0,score:estimate(start)});let visited=0;
  while(heap.length&&visited++<Math.min(maxVisited,256)){const n=pop(),k=key(n.p);state.expanded++;if(n.g!==costs.get(k))continue;
   if(n.p.floor===target.floor&&Math.abs(n.p.tx-target.tx)+Math.abs(n.p.ty-target.ty)<=1){const result:HumanWaypoint[]=[];for(let q=k;q!==startKey;q=parent.get(q)!)result.push(points.get(q)!);pending.delete(searchKey);const path=result.reverse();if(!path.every(p=>free(p,h))){h.lastWorkBlock='Route changed during planning; checking again.';return null;}return path;}
   const neighbors=[{...n.p,tx:n.p.tx+1},{...n.p,tx:n.p.tx-1},{...n.p,ty:n.p.ty+1},{...n.p,ty:n.p.ty-1},...(stairs.get(k)??[])];
   for(const p of neighbors){if(!free(p,h))continue;const nk=key(p),g=n.g+1;if(g>=(costs.get(nk)??Infinity))continue;costs.set(nk,g);parent.set(nk,k);points.set(nk,p);push({p,g,score:g+estimate(p)});}
  }
  if(!heap.length||state.expanded>=48000){pending.delete(searchKey);h.lastWorkBlock=!heap.length?'No legal path through the currently known geometry.':'Physical route search limit reached; destination remains unconfirmed.';}
  else h.lastWorkBlock=`Checking physical route (${state.expanded} cells examined; no travel claimed).`;
  return null;
 }};
}
