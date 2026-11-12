/**
 * Global Veyra first-window discovery: deterministic geographic coverage.
 *
 * Research-only generator. Coordinates are window ORIGINS, not spawn points.
 * This intentionally has no fixed starting regions, POI/GOLD spawn markers,
 * or salvage reward bias. A caller must still verify true engine collision,
 * source stock, nine build sites, hazards, and offshore traversal before using
 * an origin for gameplay. Never accept an origin from this iterator alone.
 */
import { FRAME_W, FRAME_H, WINDOW_W, WINDOW_H, U } from './frame';
import { GOLD } from './reader';

export interface GlobalWindowCandidate { originTx:number; originTy:number; ordinal:number; }
const SPACING = 64;
const maxX = FRAME_W - WINDOW_W;
const maxY = FRAME_H - WINDOW_H;
export const WINDOW_GRID_COLS = Math.floor(maxX / SPACING) + 1;
export const WINDOW_GRID_ROWS = Math.floor(maxY / SPACING) + 1;
export const WINDOW_GRID_COUNT = WINDOW_GRID_COLS * WINDOW_GRID_ROWS;
function gcd(a:number,b:number):number { while(b){const t=a%b;a=b;b=t;}return a; }
function hash32(seed:number):number {
  let x = (seed ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16),0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13),0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
/**
 * Complete non-repeating traversal of the 64-tile origin grid across the full
 * authored frame. A bounded call may stop early; doing so NEVER proves global
 * coverage, valid starts, or that any particular landmass is accessible.
 *
 * Distinct seeds get deterministic orders without consuming gameplay RNG.
 */
export function* globalWindowOrigins(seed:number):Generator<GlobalWindowCandidate> {
  const count=WINDOW_GRID_COUNT;
  const start=hash32(seed)%count;
  let stride=1+(hash32(seed ^ 0x6ac690c5)%(count-1));
  while(gcd(stride,count)!==1)stride=stride===count-1?1:stride+1;
  for(let ordinal=0;ordinal<count;ordinal++){
    const index=(start+ordinal*stride)%count;
    const col=index%WINDOW_GRID_COLS,row=Math.floor(index/WINDOW_GRID_COLS);
    yield {
      originTx:Math.min(maxX,col*SPACING),
      originTy:Math.min(maxY,row*SPACING),
      ordinal,
    };
  }
}

/** The mainland is the only currently travel-connected starting landmass whose
 *  outbound route does NOT presuppose unimplemented ferry/boat mechanics.
 *  This is a temporary safety exclusion, NOT an approved forever no-island rule.
 *  The GOLD polygons are used solely for the offshore-exclusion gate; runtime
 *  terrain/collision/resources remain the final spawn authority.
 */
function withinRing(px:number,py:number,pts:number[][]):boolean {
  let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const a=pts[i],b=pts[j];
    if((a[1]>py)!==(b[1]>py) && px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
const mainland=(()=>{const found=GOLD.project.land.find(x=>x.id==='ld_veyra');
  if(!found)throw Error('VEYRA_MAINLAND_POLYGON_MISSING');return found;})();
export function unverifiedOffshoreExcluded(globalTx:number,globalTy:number):boolean {
  const ax=(globalTx+0.5)*U,ay=(globalTy+0.5)*U;
  if(!withinRing(ax,ay,mainland.rings[0] as number[][]))return false;
  for(const hole of mainland.rings.slice(1))if(withinRing(ax,ay,hole as number[][]))return false;
  return true;
}
