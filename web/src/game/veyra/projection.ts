/** Bounded, immutable diagnostic view of the pinned full authoring frame. */
import raw from '../../../geography/veyra-lr01/world_lab/lr01/output/geography_package.v1.json?raw';
import canonRaw from '../../../geography/veyra-lr01/map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json?raw';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { BODY_SHA, CANON_SHA, PACKAGE_CANONICAL_SHA, MAP_SOURCE_SHA, expandRle, type GeographyStage1 } from './intake';
import { T, TILE, WW, WH } from '../core';
import { compileEconomy, type Biome, type EconomyMap } from '../world-economy';
import type { World, Place } from '../world';

export interface VeyraViewIdentity {sourceCommit:string;sourceDigest:string;originAu:[number,number];unitsPerTile:1.6|2;frameAu:[number,number];projection:'cell-centre-v1'}
export const VEYRA_LAYOUTS = ['veyra-greywater-u16','veyra-greywater-u20'] as const;
const p=JSON.parse(raw) as GeographyStage1;
const canon=JSON.parse(canonRaw) as {project:{pois:{id:string;name:string;at:number[];foot:number[][]}[];land:{rings:number[][][]}[];lakes:{ring:number[][]}[];rivers:{points:number[][]}[];roads:{points:number[][];kind:string}[]}};
const hash=(s:string)=>bytesToHex(sha256(s));
function verifyEmbedded(){if(p.schema!=='soh.map.lr01.geography_package.v1'||p.revision!==1||p.revisionDigest!==BODY_SHA||hash(JSON.stringify(p.body))!==BODY_SHA||hash(JSON.stringify(p))!==PACKAGE_CANONICAL_SHA||hash(canonRaw)!==CANON_SHA)throw Error('Veyra geography source failed integrity checks');}
const contains=(x:number,y:number,poly:number[][])=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
// The LR01 raster is 8-au analysis data. For water/road edges, evaluate the
// source polygons/centrelines at tile centres. 9 au is the MapLab analytical
// stroke, not an approved physical road/channel width or bridge clearance.
function lines(points:number[][],radius:number){return points.slice(1).map((b,i)=>{const a=points[i];return {a,b,radius,minx:Math.min(a[0],b[0])-radius,maxx:Math.max(a[0],b[0])+radius,miny:Math.min(a[1],b[1])-radius,maxy:Math.max(a[1],b[1])+radius};});}
function onLine(x:number,y:number,s:{a:number[];b:number[];radius:number;minx:number;maxx:number;miny:number;maxy:number}){if(x<s.minx||x>s.maxx||y<s.miny||y>s.maxy)return false;const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((x-s.a[0])*dx+(y-s.a[1])*dy)/d)):0;return Math.hypot(x-s.a[0]-t*dx,y-s.a[1]-t*dy)<=s.radius;}
export function globalFromTile(identity:VeyraViewIdentity,x:number,y:number):[number,number]{return[identity.originAu[0]+(x+.5)*identity.unitsPerTile,identity.originAu[1]+(y+.5)*identity.unitsPerTile];}
export function tileFromGlobal(identity:VeyraViewIdentity,x:number,y:number):[number,number]{return[Math.floor((x-identity.originAu[0])/identity.unitsPerTile),Math.floor((y-identity.originAu[1])/identity.unitsPerTile)];}
export function projectVeyra(layout:string):World {
  verifyEmbedded();const unitsPerTile=layout==='veyra-greywater-u16'?1.6:layout==='veyra-greywater-u20'?2:null;if(!unitsPerTile)throw Error(`Unknown Veyra view ${layout}`);
  const identity:VeyraViewIdentity={sourceCommit:MAP_SOURCE_SHA,sourceDigest:BODY_SHA,originAu:[640,440],unitsPerTile,frameAu:[2000,1400],projection:'cell-centre-v1'};
  const n=WW*WH,mask=p.body.compactMasks,water=expandRle(mask.landWaterRle,2),codes=expandRle(mask.biomeRle,11),roads=expandRle(mask.roadClassRle,5),rawElevation=expandRle(mask.elevationRle,255);
  // Candidate render/economy mappings, NOT authored climate or approved physical height.
  const codeTile=[T.MEADOW,T.FOREST,T.FOREST,T.FOREST,T.MARSH,T.SAND,T.MEADOW,T.HILL,T.SNOW,T.ASH,T.TOXIC,T.SAND];
  const codeBiome:Biome[]=['meadow','forest','forest','forest','marsh','sand','meadow','hill','snow','ash','toxic','sand'];
  const tiles=new Uint8Array(n),fresh=new Uint8Array(n),zone=new Uint8Array(n),seaDist=new Uint8Array(n).fill(255),biome:Biome[]=Array(n),elevation=new Float32Array(n),slope=new Float32Array(n),moisture=new Float32Array(n),temperature=new Float32Array(n),walkable=new Uint8Array(n),buildable=new Uint8Array(n),cargoPassable=new Uint8Array(n),road=new Uint8Array(n),protectedCells=new Uint8Array(n),industrial=new Uint8Array(n),coast=new Uint8Array(n);
  const zones=(p.body.construction as {zones:{id:string;geometry:{ringAu:number[][]}}[]}).zones;
  const riverLines=canon.project.rivers.flatMap(r=>lines(r.points,4.5)),roadLines=canon.project.roads.filter(r=>r.kind!=='ferry').flatMap(r=>lines(r.points,4.5));
  const bounds=canon.project.pois.filter(a=>a.foot&&a.foot.length>=3&&a.foot.some(([x,y])=>x>=640&&x<640+WW*unitsPerTile&&y>=440&&y<440+WH*unitsPerTile));
  for(let y=0;y<WH;y++)for(let x=0;x<WW;x++){
    const i=y*WW+x,[gx,gy]=globalFromTile(identity,x,y),ri=Math.floor(gy/8)*250+Math.floor(gx/8),code=codes[ri];
    const land=canon.project.land.some(a=>a.rings.length>0&&contains(gx,gy,a.rings[0])&&!a.rings.slice(1).some(h=>contains(gx,gy,h)));
    const freshWater=land&&(canon.project.lakes.some(a=>contains(gx,gy,a.ring))||riverLines.some(a=>onLine(gx,gy,a)));const w=land?(freshWater?2:0):1;
    const boundary=x===0||y===0||x===WW-1||y===WH-1;
    if(boundary){tiles[i]=T.CLIFF;biome[i]='wall';protectedCells[i]=1;continue;}
    // Water classification precedes biome: source code 0 over sea is a sentinel, not meadow.
    let t=w===1?T.DEEP:w===2?T.SHALLOW:codeTile[code];const isRoad=w===0&&roadLines.some(a=>onLine(gx,gy,a));if(isRoad)t=T.ROAD;
    tiles[i]=t;fresh[i]=+(w===2);biome[i]=w?'water':isRoad?'road':codeBiome[code];elevation[i]=rawElevation[ri]/255;
    moisture[i]=code===4?.8:code===1||code===2?.65:code===5?.2:.45;temperature[i]=code===8?.15:code===9?.8:.55;
    walkable[i]=+(w===0);road[i]=+isRoad;const poi=bounds.some(q=>contains(gx,gy,q.foot));const candidate=zones.some(z=>contains(gx,gy,z.geometry.ringAu));
    protectedCells[i]=+(poi||isRoad);buildable[i]=+(w===0&&!isRoad&&!poi&&candidate); // Map zones are candidates, not forced structures.
    cargoPassable[i]=+(w===0); // ordinary dry ground only; no water crossing or swept-clearance claim
  }
  // Coast distance for the existing Web shore renderer, in projected gameplay tiles.
  const queue=new Int32Array(n);let head=0,tail=0;for(let i=0;i<n;i++)if(tiles[i]===T.DEEP){seaDist[i]=0;queue[tail++]=i;}
  while(head<tail){const i=queue[head++],x=i%WW,y=Math.floor(i/WW);if(seaDist[i]>=8)continue;for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=WW||ny>=WH)continue;const j=ny*WW+nx;if(seaDist[j]>seaDist[i]+1){seaDist[j]=seaDist[i]+1;queue[tail++]=j;}}}
  for(let i=0;i<n;i++)coast[i]=+(seaDist[i]<=4&&!fresh[i]&&tiles[i]!==T.DEEP);
  // Reachability anchors for population only; these are NOT spawn coordinates, landmarks or grants.
  const anchors:{id:string;x:number;y:number}[]=[];for(let y=20;y<WH-2;y+=40)for(let x=20;x<WW-2;x+=40)if(walkable[y*WW+x])anchors.push({id:`compiler_${x}_${y}`,x,y});
  if(!anchors.length)throw Error('No walkable terrain in Veyra diagnostic view');
  const economyMap:EconomyMap={id:layout,revision:1,seed:2026,width:WW,height:WH,tileSize:TILE,biome,elevation,slope,moisture,temperature,freshwater:fresh,coast,walkable,buildable,cargoPassable,road,protected:protectedCells,industrial,starts:anchors};
  const generated=compileEconomy(economyMap);if(generated.errors.length)throw Error(`Veyra source compiler: ${generated.errors.join('; ')}`);
  const places:Place[]=bounds.map(q=>{const [tx,ty]=tileFromGlobal(identity,q.at[0],q.at[1]);return{id:q.id,name:q.name,tx,ty,kind:'poi' as const};}).filter(q=>q.tx>0&&q.ty>0&&q.tx<WW-1&&q.ty<WH-1);
  return {tiles,fresh,zone,seaDist,src:new Int8Array(n).fill(-1),sourceOverlayV2:new Int8Array(n).fill(-1),buildings:[],statics:[],places,starts:[],elders:[],economyMap,sourceV3:generated.sources,veyra:identity,enforceMasks:true,zoneNames:['Veyra · Greywater region']};
}
