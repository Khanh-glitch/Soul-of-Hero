/** Human shelter queries use the same physical rooms in local and archived Veyra views.
 * No camera-relative coordinate is ever persisted as an actor location. */
import { T, TILE, WW, WH, type RunState } from './core';
import { roofRoom } from './engine';
import { authoredPlan, authoredPoiIds } from '../veyra05/floors';
import { FRAME_W } from '../veyra05/frame';
import type { Level, CompiledPlan, CompiledLevel } from '../veyra05/arch/plan';

const layerRoofs = new WeakMap<CompiledLevel, Set<number>>();
const plansByCell = new Map<string, CompiledPlan>();
let indexed = false;
function indexPlans() {
  if (indexed) return;
  indexed = true;
  for (const poi of authoredPoiIds()) {
    const p = authoredPlan(poi); if (!p) continue;
    for (const [floor, layer] of p.levels) for (const k of layer.tiles.keys()) plansByCell.set(`${floor}:${k}`, p);
  }
}
/** Short-lived read context; create once per needs transaction, never across world mutation. */
export interface HumanShelterContext { results:Map<string,boolean>;remoteResults?:Map<string,boolean>;liveDoors:Map<string,boolean> }
// Archived enclosure queries depend on authored roofs and physical door/terrain
// deltas, NOT actor needs, stock quantities or planner timestamps. Local rooms
// deliberately retain their transaction lifetime (player construction is live).
const archivedEnclosures=new WeakMap<RunState,{physical:string;results:Map<string,boolean>}>();
const layerDoors=new WeakMap<CompiledLevel,Map<number,CompiledLevel['doors'][number]>>();
export function humanShelterContext(r:RunState):HumanShelterContext {
  const liveDoors=new Map<string,boolean>();
  for(const e of Object.values(r.entities))if(e.kind==='door')liveDoors.set(`${e.floor??0}:${e.tx},${e.ty}`,!!e.open);
  const physical=JSON.stringify([r.layoutId,r.veyraFloor,r.sourceMap?.veyra?.originAu,[...liveDoors],r.veyraGlobalDoors,
    Object.entries(r.veyraGlobalFloorState??{}).map(([floor,state])=>[floor,state.doors]),
    Object.entries(r.veyraFloorState??{}).map(([floor,state])=>[floor,state.doors]),r.veyraGlobalTerrain]);
  let memo=archivedEnclosures.get(r);if(memo?.physical!==physical){memo={physical,results:new Map()};archivedEnclosures.set(r,memo);}
  return {results:new Map(),remoteResults:memo.results,liveDoors};
}
export function humanShelter(r: RunState, gx: number, gy: number, floor: number, context?:HumanShelterContext): boolean {
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / .5) : 0, oy = o ? Math.round(o[1] / .5) : 0;
  const lx = gx - ox, ly = gy - oy;
  if (floor === (r.veyraFloor ?? 0) && lx >= 0 && ly >= 0 && lx < WW && ly < WH) {
    const cacheKey=`local:${floor}:${ly*WW+lx}`,cached=context?.results.get(cacheKey);
    if(cached!==undefined)return cached;
    const room=roofRoom(r,(lx+.5)*TILE,(ly+.5)*TILE);
    // A whole connected component has one enclosure result, including an open
    // component. The read context never survives a door/roof/world transaction.
    if(context){context.results.set(cacheKey,room.enclosed);for(const cell of room.cells)context.results.set(`local:${floor}:${cell}`,room.enclosed);}
    return room.enclosed;
  }
  if (!o) return false;
  indexPlans();
  const start = gy * FRAME_W + gx, cacheKey=`${floor}:${start}`;
  const results=context?.remoteResults??context?.results;
  const cached=results?.get(cacheKey);if(cached!==undefined)return cached;
  const p = plansByCell.get(cacheKey);
  const layer = p?.levels.get(floor as Level); if (!layer) return false;
  let roof = layerRoofs.get(layer);
  if (!roof) {
    roof = new Set<number>();
    for (const room of layer.rooms) if (room.roof && !room.open) for (const cell of room.cells) roof.add(cell);
    for (const d of layer.doors) if (p!.plan.structures.some(s=>s.id===d.struct && !!s.roof && !s.open)) roof.add(d.y*FRAME_W+d.x);
    layerRoofs.set(layer,roof);
  }
  if (!roof.has(start)) return false;
  // Archived floor/door deltas take precedence over authored default-closed doors.
  let doors=layerDoors.get(layer);if(!doors){doors=new Map(layer.doors.map(d=>[d.y*FRAME_W+d.x,d]));layerDoors.set(layer,doors);}
  const liveDoors = context?.liveDoors ?? humanShelterContext(r).liveDoors;
  const doorOpen = (k: number): boolean => {
    const x = k % FRAME_W, y = Math.floor(k / FRAME_W), tx = x - ox, ty = y - oy;
    const live = liveDoors.get(`${floor}:${tx},${ty}`);
    if (live!==undefined) return live;
    const local = r.veyraFloorState?.[floor]?.doors[`${tx},${ty}`];
    if (local !== undefined) return local;
    const global = floor === 0 ? r.veyraGlobalDoors?.[k] : r.veyraGlobalFloorState?.[floor]?.doors[k];
    return global ?? false;
  };
  const seen = new Set([start]), queue = [start];
  const result=(enclosed:boolean)=>{if(results)for(const cell of seen)results.set(`${floor}:${cell}`,enclosed);return enclosed;};
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i];
    for (const next of [k - 1, k + 1, k - FRAME_W, k + FRAME_W]) {
      if (seen.has(next)) continue;
      if (doors.has(next) && !doorOpen(next)) continue;
      const delta = floor === 0 ? r.veyraGlobalTerrain?.[next] : undefined;
      const tile = delta?.t ?? layer.tiles.get(next);
      if (tile === T.PWALL || tile === T.CLIFF) continue;
      if (!roof.has(next)) return result(false);
      seen.add(next); queue.push(next);
    }
  }
  return result(true);
}
