import {BAL,TILE,WW,WH,T,angDiff,dist,clamp,type RunState,type Haz} from './core';
import {getWorld} from './world';
import {blockGrid,clearPhysicalLine,effTile,entsAt} from './engine';
import {activeFloor} from '../veyra05/floors';
const tileOf=(v:number)=>Math.floor(v/TILE);
export function solidFor(r: RunState, x: number, y: number, who: 'player' | 'creature' | 'cart') {
  const tx = tileOf(x), ty = tileOf(y); if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) return true;
  const b = blockGrid(r)[ty * WW + tx];
  if((who==='cart'||(who==='player'&&!r.player.vehicle)) && Object.values(r.entities).some(e=>e.kind==='vehicle' && Math.hypot(e.x-x,e.y-y)<BAL.motorbike.radius))return true;
  // Authored cargo constraints are additional to live collision, not a
  // substitute for opening a physical door or clearing a physical object.
  const w = getWorld(); const i=ty*WW+tx;
  if (who === 'cart' && (w.packageContract || w.enforceMasks) && !w.economyMap.cargoPassable[i] && !w.statics.some(s=>s.kind==='door' && s.tx===tx && s.ty===ty)) return true;
  if (b === 4) return who === 'cart' || (who === 'creature' && false);
  if (b === 6) return who !== 'player' || !!r.player.vehicle;
  return b === 1 || b === 2 || b === 3 || b === 5;
}
export function inHaz(h: Haz, x: number, y: number) {
  if (h.kind === 'circle' || h.kind === 'pool') return dist(x, y, h.x, h.y) < h.r!;
  if (h.kind === 'ring') { const prog = (h.t - h.tell) / h.dur; const rr = h.r! * Math.min(1, prog); const d = dist(x, y, h.x, h.y); return Math.abs(d - rr) < 9; }
  let a = h.angle!; if (h.kind === 'sweep') a = h.a0! + (h.a1! - h.a0!) * clamp((h.t - h.tell) / h.dur, 0, 1);
  let ox = h.x, oy = h.y; let len = h.len!;
  if (h.kind === 'wave') { const prog = (h.t - h.tell) / 1000 * 130; ox = h.x + Math.cos(h.angle!) * prog; oy = h.y + Math.sin(h.angle!) * prog; const px = x - ox, py = y - oy; const along = px * Math.cos(a) + py * Math.sin(a); const perp = -px * Math.sin(a) + py * Math.cos(a); return Math.abs(along) < h.w! && Math.abs(perp) < len / 2; }
  const px = x - ox, py = y - oy; const along = px * Math.cos(a) + py * Math.sin(a); const perp = Math.abs(-px * Math.sin(a) + py * Math.cos(a)); return along > 0 && along < len && perp < h.w! / 2 + 3;
}
/** Select ten genuinely vacant nearby tiles without overwriting map sources,
 * structures, creatures or the player; failure spends no reserve. */
export function groveCells(r:RunState,x:number,y:number,caster=r.player as {x:number;y:number}) {
  const cx=tileOf(x),cy=tileOf(y),grid=blockGrid(r),cells:{tx:number;ty:number;d:number}[]=[];
  if(dist(caster.x,caster.y,x,y)<3*TILE)return []; // never cage the caster
  const o=r.sourceMap?.veyra?.originAu,ox=(o?.[0]??0)*2,oy=(o?.[1]??0)*2;
  const occupied=new Set(Object.values(r.humanWorld?.people??{}).filter(h=>h.floor===activeFloor(r)&&!h.transit&&h.state!=='DEAD'&&h.state!=='EVACUATED').flatMap(h=>[`${h.gx-ox},${h.gy-oy}`,...(h.motion?[`${h.motion.toGx-ox},${h.motion.toGy-oy}`]:[])]));
  for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++) {const tx=cx+dx,ty=cy+dy,d=Math.hypot(dx,dy);if(d<2||d>5||tx<1||ty<1||tx>=WW-1||ty>=WH-1)continue;const i=ty*WW+tx;if(occupied.has(`${tx},${ty}`)||grid[i]!==0||!clearPhysicalLine(r,{x,y},{x:tx*TILE+8,y:ty*TILE+8},true)||entsAt(r,tx,ty).length||r.natureTrees?.some(q=>q.tx===tx&&q.ty===ty)||r.creatures.some(m=>m.state!=='dead'&&tileOf(m.x)===tx&&tileOf(m.y)===ty)||(tileOf(r.player.x)===tx&&tileOf(r.player.y)===ty))continue;cells.push({tx,ty,d});}
  const selected:typeof cells=[];const count=BAL.creatorCoreEarthmother.treeCount;for(let k=0;k<count;k++){const angle=2*Math.PI*k/count;const candidates=cells.filter(q=>!selected.includes(q)&&Math.abs(angDiff(Math.atan2(q.ty*TILE+8-y,q.tx*TILE+8-x),angle))<=Math.PI/count).sort((a,b)=>Math.abs(a.d-3)-Math.abs(b.d-3)||a.ty-b.ty||a.tx-b.tx);if(!candidates.length)return [];selected.push(candidates[0]);}return selected;
}
/** Only an explored, reachable, clear safe cell may be selected. Flood-fill
 * checks the LIVE collision graph, including locked doors and player walls. */
export function spiritDestination(r:RunState,x:number,y:number,from?:{x:number;y:number;owner:string}):string|null {
  if(!Number.isFinite(x)||!Number.isFinite(y))return 'Choose a map destination.';const tx=tileOf(x),ty=tileOf(y),sx=tileOf(from?.x??r.player.x),sy=tileOf(from?.y??r.player.y);if(tx<1||ty<1||tx>=WW-1||ty>=WH-1)return 'Outside the map.';
  if(sx<1||sy<1||sx>=WW-1||sy>=WH-1)return 'Departure is outside the map.';
  const i=ty*WW+tx,w=getWorld(),grid=blockGrid(r),terrain=effTile(r,tx,ty);if(from?!clearPhysicalLine(r,from,{x,y},true):!r.discovered[(ty>>2)*50+(tx>>2)])return 'Explore this area first.';if(w.economyMap.protected[i])return 'Protected POI or road: choose open ground.';if(grid[i]!==0||[T.LAVA,T.TOXIC,T.SHALLOW,T.RIVER,T.DEEP].includes(terrain)||(r.sources[i]?.fire||0)>r.clock.simMs)return 'Destination is obstructed or hazardous.';
  if((r.combat?.hazards||[]).some(h=>h.owner!==(from?.owner??'player') && h.t<h.tell+h.dur && (h.kind==='ring'?dist(h.x,h.y,x,y)<(h.r||0)+10:inHaz(h,x,y))))return 'Destination threatened by an active hazard.';
  // Match the survival system's actual adjacent lava and burning-source radii.
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=tx+dx,ny=ty+dy;if(nx<0||ny<0||nx>=WW||ny>=WH)continue;if(effTile(r,nx,ny)===T.LAVA)return 'Destination threatened by nearby lava.';const fire=r.sources[ny*WW+nx]?.fire;if(fire && fire>r.clock.simMs && dist(x,y,nx*TILE+8,ny*TILE+8)<18)return 'Destination threatened by nearby fire.';}
  if(r.creatures.some(m=>m.state!=='dead'&&((m as any).floor??0)===activeFloor(r)&&dist(m.x,m.y,x,y)<16))return 'Destination occupied.';
  if(from){
    const o=r.sourceMap?.veyra?.originAu,gx=tx+(o?.[0]??0)*2,gy=ty+(o?.[1]??0)*2;
    if(!r.player.dead && dist(x,y,r.player.x,r.player.y)<TILE || Object.values(r.humanWorld?.people??{}).some(h=>h.actorId!==from.owner && h.floor===activeFloor(r) && h.state!=='DEAD' && h.state!=='EVACUATED' && !h.transit && (h.gx===gx&&h.gy===gy||h.motion?.toGx===gx && h.motion.toGy===gy)))return 'Landing cell occupied.';
  }
  for(const [dx,dy] of [[-4,-4],[4,-4],[-4,4],[4,4]])if(solidFor(r,x+dx,y+dy,'player'))return 'Not enough landing clearance.';
  const start=sy*WW+sx,seen=new Uint8Array(WW*WH),q=new Int32Array(WW*WH);let head=0,tail=0;q[tail++]=start;seen[start]=1;while(head<tail){const p=q[head++];if(p===i)return null;const px=p%WW,py=Math.floor(p/WW);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=px+dx,ny=py+dy;if(nx<1||ny<1||nx>=WW-1||ny>=WH-1)continue;const v=ny*WW+nx;if(!seen[v]&&(grid[v]===0||grid[v]===4)){seen[v]=1;q[tail++]=v;}}}return 'No legal physical route; sealed areas cannot be bypassed.';
}
