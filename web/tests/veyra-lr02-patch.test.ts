import {afterAll,describe,expect,it} from 'vitest';
import raw from '../geography/veyra-lr02/greywater_spatial_patch.v1.json?raw';
import layouts from '../geography/veyra-lr01/world_lab/lr01/output/poi_layouts.v1.json';
import legacyVeyra from './fixtures/7b9805b2-veyra-v3.json';
import {greywaterPatch,validateGreywaterPatch,PATCH_BODY_SHA} from '../src/game/veyra/lr02';
import {globalFromTile,tileFromGlobal} from '../src/game/veyra/projection';
import {T,TILE,WW} from '../src/game/core';
import {getWorld,setActiveLayout} from '../src/game/world';
import {blockGrid,clearWallLine,dispatch,markDirty,newGame} from '../src/game/engine';
import {mapDigest} from '../src/game/map-package';
import {serializeSnapshot,validate} from '../src/game/persist';
import {tick,type Input} from '../src/game/sim';
const now=Date.UTC(2026,10,4);afterAll(()=>setActiveLayout('shipping'));
const idle:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};
function path(grid:Uint8Array,start:number,end:number){const prev=new Int32Array(grid.length).fill(-2),q=[start];prev[start]=-1;for(let h=0;h<q.length&&prev[end]===-2;h++){const i=q[h],x=i%WW,y=Math.floor(i/WW);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*WW+nx;if(nx<0||ny<0||nx>=WW||ny>=200||prev[j]!==-2||[1,2,3,5].includes(grid[j]))continue;prev[j]=i;q.push(j);}}if(prev[end]===-2)return null;const p=[];for(let i=end;i!==-1;i=prev[i])p.push(i);return p.reverse();}
describe('independently pinned Map LR02 geometry and seeded sampling',()=>{
 it('rejects unpinned patch bytes and retains the LR01 parent identity',()=>{expect(validateGreywaterPatch(raw).revisionDigest).toBe(PATCH_BODY_SHA);expect(()=>validateGreywaterPatch(raw.replace('po_greywater','po_other'))).toThrow();expect(greywaterPatch.parent.revisionDigest).toBe('e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63');});
 for(const layout of ['veyra-greywater-lr02-u16','veyra-greywater-lr02-u20'])it(`${layout}: authentic area membership, physical collision entry and save identity`,()=>{
  setActiveLayout(layout);const w=getWorld(),area=new Set(greywaterPatch.spawnEligibility.greywaterEligibleArea.cellIndices);expect(w.veyra?.patchDigest).toBe(PATCH_BODY_SHA);expect(w.tiles.filter(x=>x===T.PWALL).length).toBeGreaterThan(50);const distinct=new Set<string>();
  for(let seed=1;seed<=10;seed++){const g=newGame();expect(dispatch(g,{id:'start',type:'startRun',character:'female',seed},now).ok).toBe(true);const s=g.run!.spawnChoice!,[gx,gy]=globalFromTile(w.veyra!,s.x,s.y);expect(area.has(Math.floor(gy/8)*250+Math.floor(gx/8))).toBe(true);expect(w.spawnEligible![s.y*WW+s.x]).toBe(1);distinct.add(`${s.x},${s.y}`);const saved=JSON.parse(JSON.parse(serializeSnapshot(g)).payload);expect(validate(saved)).toBeTruthy();saved.run.sourceMap.veyra.patchDigest='bad';expect(validate(saved)).toBeNull();}expect(distinct.size).toBeGreaterThanOrEqual(8);
  // Controlled fixture: relocate player to source-authored exterior entry and
  // remove wildlife solely to test physical collision, not a natural journey.
  const g=newGame();expect(dispatch(g,{id:'walk-start',type:'startRun',character:'female',seed:9},now).ok).toBe(true);const r=g.run!;r.creatures=[];const o=greywaterPatch.staticArchitecture.staticOpenings.find(q=>q.id==='portal.po_greywater.entrance')!;const [sx,sy]=tileFromGlobal(w.veyra!,o.centreAu[0]-o.normalAu[0]*6,o.centreAu[1]-o.normalAu[1]*6);r.player.x=sx*TILE+8;r.player.y=sy*TILE+8;markDirty();let time=now;
  const source=layouts.layouts.find(q=>q.poiId==='po_greywater')!,rooms=source.rooms;
  // The outside-to-entry-room route must actually cross the Map exterior opening,
  // not merely reach the room by an accidental hole elsewhere.
  const target=rooms.find(q=>q.id==='room.po_greywater.1.2')!,[ex,ey]=tileFromGlobal(w.veyra!,target.centroidAu[0],target.centroidAu[1]);
  const routeToEntry=path(blockGrid(r),sy*WW+sx,ey*WW+ex)!;expect(routeToEntry).toBeTruthy();
  const inside=(x:number,y:number)=>{const poly=source.canonical.footPolygonAu;let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
  const first=routeToEntry.map(i=>globalFromTile(w.veyra!,i%WW,Math.floor(i/WW))).find(([x,y])=>inside(x,y));expect(first).toBeDefined();expect(Math.hypot(first![0]-o.centreAu[0],first![1]-o.centreAu[1])).toBeLessThan(4);
  // Negative wall/LOS: a genuine Map solid blocks a segment across it.
  let blocked=false;for(const s of greywaterPatch.staticArchitecture.staticSolids){const dx=s.bAu[0]-s.aAu[0],dy=s.bAu[1]-s.aAu[1],d=Math.hypot(dx,dy),cx=(s.aAu[0]+s.bAu[0])/2,cy=(s.aAu[1]+s.bAu[1])/2,nx=-dy/d,ny=dx/d,U=w.veyra!.unitsPerTile,orig=w.veyra!.originAu;const pt=(sign:number)=>({x:((cx+sign*nx*4-orig[0])/U)*TILE,y:((cy+sign*ny*4-orig[1])/U)*TILE});if(!clearWallLine(r,pt(-1),pt(1))){blocked=true;break;}}expect(blocked).toBe(true);
  for(const room of rooms){const [x,y]=tileFromGlobal(w.veyra!,room.centroidAu[0],room.centroidAu[1]),grid=blockGrid(r),start=Math.floor(r.player.y/TILE)*WW+Math.floor(r.player.x/TILE),route=path(grid,start,y*WW+x);expect(route,room.id).not.toBeNull();for(const i of route!.slice(1)){const tx=(i%WW)*TILE+8,ty=Math.floor(i/WW)*TILE+8;for(let k=0;k<30&&Math.hypot(r.player.x-tx,r.player.y-ty)>3.6;k++){const dx=tx-r.player.x,dy=ty-r.player.y;time+=40;tick(g,{...idle,left:dx< -2,right:dx>2,up:dy< -2,down:dy>2},40,time);}expect(Math.hypot(r.player.x-tx,r.player.y-ty),`${room.id} collision step`).toBeLessThanOrEqual(3.6);}}
 });
 it('routes newly started runs from historic active layouts into LR02 while retaining old snapshot validation',()=>{for(const scale of ['u16','u20']){setActiveLayout(`veyra-greywater-${scale}`);const g=newGame();expect(dispatch(g,{id:`new-${scale}`,type:'startRun',character:'female',seed:77},now).ok).toBe(true);expect(g.run!.layoutId).toBe(`veyra-greywater-lr02-${scale}`);}expect(validate(structuredClone(legacyVeyra.save))).toBeTruthy();});
 it('keeps both prior LR01 runtime fingerprints unchanged for saved runs',()=>{expect(validate(structuredClone(legacyVeyra.save))).toBeTruthy();expect(mapDigest(getWorld('veyra-greywater-u16'))).toBe('245a3f2e');expect(mapDigest(getWorld('veyra-greywater-u20'))).toBe('0885c186');});
});
