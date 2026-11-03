// Shared 640x360 1x renderer for Node captures and the browser authoring tool.
// Terrain is real pixel tiles/sprites; debug marks are explicit optional overlays.
import {M,MATERIAL_NAME,SCALE} from '../lib/constants.mjs';
import {BITS,foldMask} from '../lib/blob.mjs';
import {bitmapText} from './targets.mjs';
const TILE=SCALE.tile,W=SCALE.gridW,H=SCALE.gridH;
const WATER=new Set([M.DEEP,M.SHALLOW,M.RIVER]);
const KEY=['deep','shallow','river','sand','grass','meadow','forest','marsh','rock','cliff','snow','ash','lava','dune','toxic','dirt','cobble','wood','deck','wood','stone','wood','stone','roof','metal','cobble','stone','foam'];
const NB=[[0,-1,BITS.N],[1,0,BITS.E],[0,1,BITS.S],[-1,0,BITS.W],[1,-1,BITS.NE],[1,1,BITS.SE],[-1,1,BITS.SW],[-1,-1,BITS.NW]];
function rectOf(manifest,atlas,name){return manifest[atlas]?.[name]||null;}
function blit(t,manifest,atlas,name,x,y,alpha=1,stats=null){
  const r=rectOf(manifest,atlas,name);if(!r){if(stats)stats.missing.add(name);return false;}
  t.blit(atlas,r.x,r.y,r.w,r.h,Math.round(x),Math.round(y),r.w,r.h,alpha);return true;
}
function baseName(m,frame){const n=MATERIAL_NAME[m];return WATER.has(m)?`tile_${n}_f${frame%4}`:`tile_${n}`;}
function neighborMask(grid,tx,ty,pred,w,h){
  let mask=0;for(const [dx,dy,bit] of NB){const x=tx+dx,y=ty+dy;if(x<0||y<0||x>=w||y>=h)continue;if(pred(grid[y*w+x],x,y))mask|=bit;}return mask;
}
function chooseBlob(t,manifest,tx,ty,m,grid,w,h,dx,dy,stats){
  if(WATER.has(m)||m===M.BRIDGE||m===M.DECK||m===M.DOOR||m===M.PLAZA||m===M.FLOOR_STONE||m===M.WALL_STONE||m===M.WALL_WOOD)return;
  const counts=new Map();
  for(const [ox,oy] of NB){const x=tx+ox,y=ty+oy;if(x<0||y<0||x>=w||y>=h)continue;const nm=grid[y*w+x];if(nm===m||nm===M.INTERIOR_VOID)continue;if(WATER.has(nm)&&!WATER.has(m)){counts.set(nm,(counts.get(nm)||0)+4);}else counts.set(nm,(counts.get(nm)||0)+1);}
  if(!counts.size)return;
  let other=-1,best=0;for(const [nm,c] of counts)if(c>best){best=c;other=nm;}
  if(other<0)return;
  const mask=neighborMask(grid,tx,ty,(nm)=>nm===other,w,h);
  const folded=foldMask(mask),id=manifest.blob47?.foldedMaskMap?.[String(folded)]??0;
  const name=`blob_${KEY[m]}_${KEY[other]}_${id}`;
  if(rectOf(manifest,'terrain',name))blit(t,manifest,'terrain',name,dx,dy,1,stats);
  else {const alt=`blob_${KEY[other]}_${KEY[m]}_${id}`;if(rectOf(manifest,'terrain',alt))blit(t,manifest,'terrain',alt,dx,dy,1,stats);}
}
function shoreSprite(grid,flags,k,tx,ty,w,h){
  let landMask=0,landCount=0;
  for(const [dx,dy,bit] of NB){const x=tx+dx,y=ty+dy;if(x<0||y<0||x>=w||y>=h)continue;const nm=grid[y*w+x];if(!WATER.has(nm)&&nm!==M.INTERIOR_VOID){landMask|=bit;if(Math.abs(dx)+Math.abs(dy)===1)landCount++;}}
  if(!landMask)return null;
  const river=grid[k]===M.RIVER||((flags?.[k]||0)&2);
  if(river){
    let riverN=0,waterN=0;for(const [dx,dy] of NB){const x=tx+dx,y=ty+dy;if(x<0||y<0||x>=w||y>=h)continue;const nm=grid[y*w+x];if(nm===M.RIVER)riverN++;if(WATER.has(nm))waterN++;}
    if(riverN>=4)return 'shore_confluence_X';if(riverN>=3)return 'shore_confluence_T';
    for(const [dx,dy] of NB){const x=tx+dx,y=ty+dy;if(x<0||y<0||x>=w||y>=h)continue;const nm=grid[y*w+x];if(nm===M.DEEP||nm===M.SHALLOW)return 'shore_river_mouth';}
    if(waterN>=4)return 'shore_delta';
  }
  if(landCount>=3)return 'shore_confluence_X';
  if(landMask&BITS.N&&landMask&BITS.E)return 'shore_corner_NE';
  if(landMask&BITS.S&&landMask&BITS.E)return 'shore_corner_SE';
  if(landMask&BITS.S&&landMask&BITS.W)return 'shore_corner_SW';
  if(landMask&BITS.N&&landMask&BITS.W)return 'shore_corner_NW';
  if(landMask&BITS.N)return 'shore_edge_N';if(landMask&BITS.E)return 'shore_edge_E';if(landMask&BITS.S)return 'shore_edge_S';if(landMask&BITS.W)return 'shore_edge_W';
  return 'shore_edge_N';
}
function drawGround(t,manifest,grid,flags,tx,ty,k,dx,dy,frame,stats){
  const m=grid[k];blit(t,manifest,'terrain',baseName(m,frame),dx,dy,1,stats);
  chooseBlob(t,manifest,tx,ty,m,grid,W,H,dx,dy,stats);
  if(WATER.has(m)){const s=shoreSprite(grid,flags,k,tx,ty,W,H);if(s)blit(t,manifest,'terrain',s,dx,dy,.8,stats);}
}
function drawDebugTile(t,world,k,dx,dy,opts){
  if(opts.showCollision&&world.collision[k])t.fillRect(dx,dy,16,16,'#ff4040',.24);
  else if(opts.showCollision&&(world.material[k]===M.BRIDGE||world.material[k]===M.DECK||world.material[k]===M.DOOR))t.fillRect(dx,dy,16,16,'#40ff70',.28);
  if(opts.showGrid&&((dx/TILE)|0)%5===0)t.fillRect(dx,dy,1,16,'#ffffff',.10);
  if(opts.showGrid&&((dy/TILE)|0)%5===0)t.fillRect(dx,dy,16,1,'#ffffff',.10);
  if(opts.showIds&&world.refs?.[k]?.length)t.fillRect(dx+1,dy+1,3,3,'#ffd35a',.85);
}
function spriteName(p){return p.sprite||p.name;}
function propFoot(p,manifest){const r=rectOf(manifest,'props',spriteName(p));return p.y+(r?.h||16);}
function propShadow(t,manifest,name,x,y){const r=rectOf(manifest,'props',name);if(r&&r.w>8)t.fillRect(x+2,y+r.h-2,Math.max(2,r.w-4),2,'#0e1016',.38);}
function insideRect(rect,x,y){const [tx,ty,w,h]=rect;return x>=tx*16&&x<(tx+w)*16&&y>=ty*16&&y<(ty+h)*16;}
function drawStructure(t,manifest,s,player,stats,cam){
  const inside=player&&player.level==='exterior'&&insideRect(s.rect,player.x,player.y);
  const alpha=inside?.35:1,ox=cam.x,oy=cam.y;
  if(s.building){const [tx,ty]=s.rect;blit(t,manifest,'props',s.building,tx*16-ox,ty*16-oy,alpha,stats);return;}
  const wall=rectOf(manifest,'props',s.sprite)?s.sprite:'proto_wall_wood_0';
  for(const [tx,ty] of s.walls){blit(t,manifest,'props',wall,tx*16-ox,ty*16-16-oy,alpha,stats);}
  if(!inside||!s.hideRoofIfInside)for(const [tx,ty] of s.roofTiles)blit(t,manifest,'props',s.roofSprite,tx*16-ox,ty*16-5-oy,alpha*.82,stats);
  blit(t,manifest,'props','proto_door_0',s.door[0]*16-ox,s.door[1]*16-16-oy,1,stats);
}
function drawablesFor(data,camera,player,stats){
  const {poi,ecology,manifest}=data,out=[];
  for(const p of poi.props||[]){out.push({kind:'prop',p,foot:propFoot(p,manifest),bridge:p.layer==='bridge'});}
  for(const p of ecology.props||[]){if(p.x+16<camera.x||p.x>camera.x+SCALE.cameraW||p.y+32<camera.y||p.y>camera.y+SCALE.cameraH)continue;out.push({kind:'prop',p,foot:propFoot(p,manifest)});}
  for(const s of poi.structures||[]){const [tx,ty,w,h]=s.rect;if(tx*16+w*16<camera.x||tx*16>camera.x+SCALE.cameraW||ty*16+h*16<camera.y||ty*16>camera.y+SCALE.cameraH)continue;out.push({kind:'structure',s,foot:(ty+h)*16});}
  if(player&&player.level===camera.level){out.push({kind:'player',foot:player.y});}
  out.sort((a,b)=>(a.bridge?-10000:0)+a.foot-((b.bridge?-10000:0)+b.foot));
  return out;
}
function drawHud(t,label,mode,level){
  t.fillRect(0,0,Math.min(360,4+label.length*8+40),18,'#101820',.78);
  bitmapText(t,label,4,4,'#f3e6b0',2);
  const s=`1X ${mode.toUpperCase()} ${level==='exterior'?'EXT':level.replace('argus_','').toUpperCase()}`;
  bitmapText(t,s,4+label.length*8+8,4,'#a9d8e0',1);
}
function drawRoute(t,route,cam,color='#ff4fd8'){
  if(!route)return;for(const p of route){const x=p.x-cam.x,y=p.y-cam.y;if(x<-2||y<-2||x>SCALE.cameraW||y>SCALE.cameraH)continue;t.fillRect(x-1,y-1,3,3,color,.9);}
}
function drawResourceMarkers(t,world,cam,opts){
  if(!opts.showResources)return;
  for(const r of world.objects.resources||[]){const x=r.at?.[0]*4,y=r.at?.[1]*4;if(!x||!y)continue;const dx=x-cam.x,dy=y-cam.y;if(dx<-4||dy<-4||dx>SCALE.cameraW||dy>SCALE.cameraH)continue;t.fillRect(dx-2,dy-2,4,4,'#4ff0ff',.9);if(opts.showIds)bitmapText(t,r.id,dx+4,dy-3,'#bff8ff',1);}
}
function drawPoiMarkers(t,world,cam,opts){
  if(!opts.showPoiIds)return;
  for(const p of world.objects.pois||[]){const x=p.at?.[0]*4,y=p.at?.[1]*4;if(!x||!y)continue;const dx=x-cam.x,dy=y-cam.y;if(dx<-20||dy<-10||dx>SCALE.cameraW||dy>SCALE.cameraH)continue;t.fillRect(dx-2,dy-2,4,4,'#ffd35a',.9);bitmapText(t,p.id,dx+4,dy-3,'#ffe89a',1);}
}
export function renderWorld(t,data,camera,opts={}){
  t.clear();const {world,manifest}=data,stats={missing:new Set()};const cam={x:Math.round(camera.x),y:Math.round(camera.y)};
  const frame=Math.floor((opts.time||0)/.35)%4,mode=opts.mode||'day',level=camera.level||'exterior';
  const x0=Math.max(0,Math.floor(cam.x/TILE)-1),y0=Math.max(0,Math.floor(cam.y/TILE)-1),x1=Math.min(W-1,Math.ceil((cam.x+SCALE.cameraW)/TILE)+1),y1=Math.min(H-1,Math.ceil((cam.y+SCALE.cameraH)/TILE)+1);
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
    const k=ty*W+tx,dx=tx*TILE-cam.x,dy=ty*TILE-cam.y;
    drawGround(t,manifest,world.material,world.flags,tx,ty,k,dx,dy,frame,stats);
    drawDebugTile(t,world,k,dx,dy,opts);
  }
  const player=opts.player;
  const draws=drawablesFor(data,cam,player,stats);
  for(const d of draws){
    if(d.kind==='prop'){propShadow(t,manifest,spriteName(d.p),d.p.x-cam.x,d.p.y-cam.y);blit(t,manifest,'props',spriteName(d.p),d.p.x-cam.x,d.p.y-cam.y,1,stats);}
    else if(d.kind==='structure')drawStructure(t,manifest,d.s,player,stats,cam);
    else if(d.kind==='player')blit(t,manifest,'props','proto_player_0',player.x-cam.x-8,player.y-cam.y-24,1,stats);
  }
  drawRoute(t,opts.route,cam);
  drawResourceMarkers(t,world,cam,opts);drawPoiMarkers(t,world,cam,opts);
  if(opts.showHud!==false)drawHud(t,opts.label||'VEYRA GOLD / WORLD LAB',mode,level);
  t.finish(mode);
  return {stats:{missingSprites:[...stats.missing]},tiles:(x1-x0+1)*(y1-y0+1),drawables:draws.length};
}
function levelFlags(l){return new Uint16Array(l.w*l.h);}
export function renderInterior(t,data,camera,opts={}){
  t.clear();const {manifest}=data,stats={missing:new Set()},cam={x:Math.round(camera.x),y:Math.round(camera.y)};
  const level=data.poi.argus.levels.find(l=>l.id===camera.level);if(!level)throw new Error('unknown interior level '+camera.level);
  const w=level.w,h=level.h,frame=Math.floor((opts.time||0)/.35)%4,mode=opts.mode||'day';
  const x0=Math.max(0,Math.floor(cam.x/TILE)-1),y0=Math.max(0,Math.floor(cam.y/TILE)-1),x1=Math.min(w-1,Math.ceil((cam.x+SCALE.cameraW)/TILE)+1),y1=Math.min(h-1,Math.ceil((cam.y+SCALE.cameraH)/TILE)+1);
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
    const k=ty*w+tx,m=level.material[k],dx=tx*TILE-cam.x,dy=ty*TILE-cam.y;
    blit(t,manifest,'terrain',baseName(m,frame),dx,dy,1,stats);
    if(m===M.WALL_STONE||m===M.WALL_WOOD)t.fillRect(dx,dy-3,16,4,'#3a3a43',.9);
    if(m===M.TOXIC)t.fillRect(dx,dy,16,16,'#8ade6a',.14);
    if(opts.showCollision&&level.collision[k])t.fillRect(dx,dy,16,16,'#ff4040',.24);
    if(opts.showGrid&&tx%5===0)t.fillRect(dx,dy,1,16,'#ffffff',.10);
    if(opts.showGrid&&ty%5===0)t.fillRect(dx,dy,16,1,'#ffffff',.10);
    if(opts.showIds&&level.stairs.some(s=>Math.abs(s.tx-tx)<=1&&Math.abs(s.ty-ty)<=1))t.fillRect(dx+1,dy+1,3,3,'#ffd35a',.9);
  }
  const drawables=[];
  for(const p of level.props){if(p.x+24<cam.x||p.x>cam.x+SCALE.cameraW||p.y+32<cam.y||p.y>cam.y+SCALE.cameraH)continue;drawables.push({kind:'prop',p,foot:propFoot(p,manifest)});}
  for(const s of level.stairs){const nm=s.kind==='retreat_shortcut'?'proto_lift_0':'proto_stairs_0';const r=rectOf(manifest,'props',nm);drawables.push({kind:'sprite',name:nm,x:s.tx*16,y:s.ty*16-(r?.h||16)+16,foot:s.ty*16+16});}
  for(const z of level.landmarks){if(z.name==='Great lens'){const r=rectOf(manifest,'props','bld_lens');drawables.push({kind:'sprite',name:'bld_lens',x:z.tx*16-(r?.w||48)/2,y:z.ty*16-(r?.h||48)+16,foot:z.ty*16+16});}}
  const player=opts.player;if(player&&player.level===camera.level)drawables.push({kind:'player',foot:player.y});
  drawables.sort((a,b)=>a.foot-b.foot);
  for(const d of drawables){
    if(d.kind==='prop'){propShadow(t,manifest,spriteName(d.p),d.p.x-cam.x,d.p.y-cam.y);blit(t,manifest,'props',spriteName(d.p),d.p.x-cam.x,d.p.y-cam.y,1,stats);}
    else if(d.kind==='sprite')blit(t,manifest,'props',d.name,d.x-cam.x,d.y-cam.y,1,stats);
    else if(d.kind==='player')blit(t,manifest,'props','proto_player_0',player.x-cam.x-8,player.y-cam.y-24,1,stats);
  }
  if(opts.showIds){for(const z of level.zones){const dx=z.rect[0]*16-cam.x,dy=z.rect[1]*16-cam.y;if(dx>-60&&dy>-8&&dx<SCALE.cameraW&&dy<SCALE.cameraH)bitmapText(t,z.name,dx+2,dy+2,'#ffe89a',1);}}
  if(opts.showPoiIds){for(const n of data.poi.argus.access_graph.nodes.filter(n=>n.level===camera.level)){const dx=n.tx*16-cam.x,dy=n.ty*16-cam.y;if(dx<0||dy<0||dx>SCALE.cameraW||dy>SCALE.cameraH)continue;t.fillRect(dx-2,dy-2,4,4,'#ff4fd8',.9);bitmapText(t,n.id,dx+4,dy-3,'#ffb8ee',1);}}
  if(opts.showHud!==false)drawHud(t,opts.label||level.name,mode,camera.level);
  t.finish(mode);
  return {stats:{missingSprites:[...stats.missing]},tiles:(x1-x0+1)*(y1-y0+1),drawables:drawables.length};
}
export function renderScene(t,data,camera,opts){
  return camera.level==='exterior'?renderWorld(t,data,camera,opts):renderInterior(t,data,camera,opts);
}
