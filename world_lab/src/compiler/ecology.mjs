// Deterministic biome/ecology generator.  Blue-noise spacing + low-frequency clearings
// + GOLD resource clusters.  Proposed placement/density only: no yields, stock, HP or respawn law.
import fs from 'node:fs';
import path from 'node:path';
import {M,SCALE,tileToAu,auToTile} from './gold.mjs';
import {hash2,mulberry} from '../lib/pixels.mjs';
const ROOT=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/generated/asset_manifest.json'),'utf8'));
const W=SCALE.gridW,H=SCALE.gridH;
const RESERVED=new Set([M.DEEP,M.SHALLOW,M.RIVER,M.CLIFF,M.LAVA,M.ROAD_DIRT,M.ROAD_COBBLE,M.BRIDGE,M.DECK,M.PLAZA,M.WALL_WOOD,M.WALL_STONE,M.INTERIOR_VOID,M.DOOR]);
const PROTO_COLLIDER={
  oak:{x:10,y:24,w:4,h:7},pine:{x:11,y:26,w:3,h:6},willow:{x:10,y:22,w:4,h:9},rock:{x:1,y:8,w:14,h:8},ore:{x:1,y:8,w:14,h:8},crate:{x:2,y:4,w:12,h:10},barrel:{x:2,y:6,w:12,h:8},cart:{x:3,y:14,w:22,h:6},
};
function biomeAt(w,tx,ty){
  const auX=tileToAu(tx)+2,auY=tileToAu(ty)+2,cx=Math.min(w.terrain.gw-1,Math.floor(auX/w.terrain.cell)),cy=Math.min(w.terrain.gh-1,Math.floor(auY/w.terrain.cell));
  return w.terrain.biome[cy*w.terrain.gw+cx];
}
function profileFor(w,tx,ty){
  const rx=Math.floor(tx/12),ry=Math.floor(ty/12);
  const b=biomeAt(w,rx*12+6,ry*12+6);
  const nearArgus=Math.hypot(tileToAu(tx)-936,tileToAu(ty)-262)<310;
  return (nearArgus||[3,5,8,9,10,11].includes(b))?'CRAFTPIX-3Q':'SOH-PROTO-16';
}
function noiseField(tx,ty,seed){ // coarse 8-tile blue-noise/clearing field
  const gx=tx/8,gy=ty/8,x0=Math.floor(gx),y0=Math.floor(gy),fx=gx-x0,fy=gy-y0;
  const a=hash2(x0,y0,seed),b=hash2(x0+1,y0,seed),c=hash2(x0,y0+1,seed),d=hash2(x0+1,y0+1,seed);
  const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
}
function spriteInfo(name){
  const r=manifest.props[name];if(!r)throw new Error('missing sprite '+name);
  return {w:r.w,h:r.h,foot:r.foot||null,profile:r.profile||'SOH-PROTO-16'};
}
function makeProp(id,name,tx,ty,o={}){
  const s=spriteInfo(name);const x=tx*16+Math.round((16-s.w)/2)+(o.jx||0),y=ty*16+16-s.h+(o.jy||0);
  const kind=o.kind||name.replace(/^proto_|^3q_/,'').replace(/_\d+$/,'');
  const solid=!!o.solid;
  const collider=solid?(o.collider||(s.foot?{x:s.foot.x,y:s.foot.y,w:s.foot.w,h:s.foot.h}:PROTO_COLLIDER[kind]||{x:4,y:s.h-8,w:Math.max(4,s.w-8),h:6})):null;
  return {id,name,x,y,w:s.w,h:s.h,footY:y+s.h,profile:o.profile||s.profile,solid,collider,
    renderFootprint:{x:0,y:0,w:s.w,h:s.h},source_ids:o.source_ids||[],proposed_kind:o.proposed_kind||null,
    habitat:o.habitat||null,story:o.story||null,layer:o.layer||'prop',gold_at:o.gold_at||null,region:`${Math.floor(tx/12)}:${Math.floor(ty/12)}`};
}
const HABITAT={
  [M.GRASS]:{trees:.06,bush:.10,herb:.14,grass:.34,rock:.04,ore:.01,log:.02,mushroom:.02},
  [M.MEADOW]:{trees:.04,bush:.12,herb:.18,grass:.30,rock:.03,ore:.01,log:.02,mushroom:.02},
  [M.FOREST]:{trees:.30,bush:.18,herb:.10,grass:.14,rock:.05,ore:.02,log:.06,mushroom:.05},
  [M.MARSH]:{willow:.16,reed:.30,herb:.08,mushroom:.06,rock:.02,log:.05},
  [M.SAND]:{grass:.06,rock:.06,log:.05,bush:.02},
  [M.ROCK]:{pine:.06,rock:.22,ore:.08,bush:.02,grass:.02},
  [M.CLIFF]:{rock:.10,ore:.04},
  [M.SNOW]:{pine:.10,rock:.12,grass:.02},
  [M.ASH]:{rock:.12,ore:.05,stump:.06},
  [M.LAVA]:{rock:.06,ore:.02},
  [M.DUNE]:{palm:.06,bush:.05,rock:.04,grass:.02},
  [M.TOXIC]:{mushroom:.12,stump:.08,rock:.06,grass:.02},
};
const RESOURCE_KIND={
  wood:['oak','pine','willow','log','stump'],stone:['rock','ore'],herbs:['herb','mushroom'],food:['bush','herb','grass','mushroom'],fresh_water:['reed','willow'],fish:['reed','barrel'],scrap:['crate','barrel'],metal:['ore','crate'],fiber:['reed','herb'],clay:['rock'],sulfur:['ore'],crystal:['ore'],
};
function chooseName(profile,kind,rand){
  const r=rand();
  if(profile==='CRAFTPIX-3Q'){
    if(kind==='trees'||kind==='pine'||kind==='oak'||kind==='willow')return ['3q_oak','3q_fruit','3q_round','3q_shrub'][Math.floor(r*4)];
    if(kind==='palm')return '3q_palm';
    if(kind==='bush')return r>.5?'3q_bush':'3q_shrub';
    if(kind==='rock'||kind==='ore')return r>.5?'proto_rock_1':'proto_ore_2';
    return ['proto_grass_0','proto_herb_0','proto_mushroom_0'][Math.floor(r*3)];
  }
  if(kind==='trees')return r<.42?'proto_oak_'+Math.floor(rand()*3):r<.76?'proto_pine_'+Math.floor(rand()*3):'proto_willow_0';
  if(kind==='pine')return 'proto_pine_'+Math.floor(rand()*3);
  if(kind==='willow')return 'proto_willow_0';
  if(kind==='rock')return 'proto_rock_'+Math.floor(rand()*3);
  if(kind==='ore')return 'proto_ore_'+Math.floor(rand()*3);
  if(kind==='bush')return 'proto_bush_0';
  if(kind==='herb')return 'proto_herb_0';
  if(kind==='grass')return 'proto_grass_0';
  if(kind==='reed')return 'proto_reed_0';
  if(kind==='log')return 'proto_log_0';
  if(kind==='stump')return 'proto_stump_0';
  if(kind==='mushroom')return 'proto_mushroom_0';
  if(kind==='palm')return '3q_palm';
  return 'proto_grass_0';
}
function solidKind(k){return ['trees','pine','willow','oak','rock','ore','palm','crate','barrel'].includes(k);}
export function buildEcology(world,poi,{variant='A'}={}){
  const seed=variant==='A'?20261102:20261103,rand=mulberry(seed),props=[],byTile=new Map();
  const occupied=new Uint8Array(W*H);
  const reserved=new Uint8Array(W*H);
  for(const s of poi.structures){for(const [tx,ty] of s.solidTiles)reserved[ty*W+tx]=1;for(const [tx,ty] of s.openTiles)reserved[ty*W+tx]=1;}
  for(const p of poi.props)reserved[Math.floor(p.y/16)*W+Math.floor(p.x/16)]=1;
  for(const q of poi.patches)for(const c of q.cells)reserved[c.ty*W+c.tx]=1;
  const spawnSafe=new Set();for(const s of world.objects.spawns){const tx=Math.round(auToTile(s.at[0])),ty=Math.round(auToTile(s.at[1]));for(let j=-3;j<=3;j++)for(let i=-3;i<=3;i++)spawnSafe.add((ty+j)*W+tx+i);}
  const add=(p)=>{props.push(p);const k=Math.floor((p.footY-1)/16)*W+Math.floor((p.x+p.w/2)/16);if(k>=0&&k<W*H)occupied[k]=1;};
  // 1. GOLD resource nodes: durable source IDs and mixed-species clusters.
  const resourceProposals=[];
  for(const r of world.objects.resources){
    const tx=Math.round(auToTile(r.at[0])),ty=Math.round(auToTile(r.at[1]));
    if(tx<0||ty<0||tx>=W||ty>=H)continue;
    const m=world.material[ty*W+tx],profile=profileFor(world,tx,ty);
    const names=RESOURCE_KIND[r.raw.kind]||['rock','bush'];
    const count=3+Math.floor(rand()*5);
    for(let n=0;n<count;n++){
      const ox=Math.round((rand()-.5)*8),oy=Math.round((rand()-.5)*8),nx=tx+ox,ny=ty+oy;
      if(nx<1||ny<1||nx>=W-1||ny>=H-1)continue;
      if(RESERVED.has(world.material[ny*W+nx])||reserved[ny*W+nx]||occupied[ny*W+nx])continue;
      const kind=names[Math.floor(rand()*names.length)],name=chooseName(profile,kind,rand);
      add(makeProp(`ec_${r.id}_${n}`,name,nx,ny,{profile,solid:solidKind(kind),source_ids:[r.id],proposed_kind:r.raw.kind,habitat:world.meta.materialNames[world.material[ny*W+nx]],gold_at:r.at,jx:Math.round((rand()-.5)*6),jy:Math.round((rand()-.5)*4)}));
    }
    resourceProposals.push({
      source_id:r.id,gold_name:r.name,gold_kind:r.raw.kind,gold_at:r.at,tile:[tx,ty],
      proposed_class:r.raw.kind==='fresh_water'||r.raw.kind==='fish'?'WATER':r.raw.kind==='scrap'?'ARTIFICIAL':'NATURAL',
      proposed_density:count,proposed_cluster_refs:props.filter(p=>p.source_ids.includes(r.id)).map(p=>p.id),
      capability_ref:r.raw.kind==='scrap'?'C02':'C01',authority:'A3/Gameplay owns stock, yield, tool affinity and respawn; values NOT set here.',
    });
  }
  // 2. Natural mixed-resource environment: variable-density blue-noise with clearings/clusters.
  let generated=0;
  for(let ty=1;ty<H-1;ty++)for(let tx=1;tx<W-1;tx++){
    const k=ty*W+tx,m=world.material[k];
    if(RESERVED.has(m)||reserved[k]||occupied[k]||spawnSafe.has(k))continue;
    const profile=profileFor(world,tx,ty),hab=HABITAT[m];if(!hab)continue;
    const clear=noiseField(tx,ty,seed),cluster=noiseField(tx+37,ty+19,seed+91);
    const spacing=profile==='CRAFTPIX-3Q'?5:3;
    if((tx%spacing)||(ty%spacing))continue; // blue-noise lattice, jittered below
    const jx=Math.round((rand()-.5)*(spacing-1)*8),jy=Math.round((rand()-.5)*(spacing-1)*8);
    const density=clear>.67?.18:cluster<.32?1.55:1;
    let pick=null,acc=0,total=Object.values(hab).reduce((a,b)=>a+b,0)*density,roll=rand()*total;
    for(const [kind,weight] of Object.entries(hab)){acc+=weight*density;if(roll<=acc){pick=kind;break;}}
    if(!pick)continue;
    const name=chooseName(profile,pick,rand),s=solidKind(pick);
    const nx=tx+Math.round(jx/16),ny=ty+Math.round(jy/16);
    if(nx<1||ny<1||nx>=W-1||ny>=H-1)continue;
    if(RESERVED.has(world.material[ny*W+nx])||reserved[ny*W+nx]||occupied[ny*W+nx])continue;
    add(makeProp(`ec_nat_${variant}_${generated++}`,name,nx,ny,{profile,solid:s,jx,jy,habitat:world.meta.materialNames[m],source_ids:world.refs[k]||[]}));
  }
  // 3. Soft traversable ground detail: deliberately not colliders.
  for(let ty=1;ty<H-1;ty++)for(let tx=1;tx<W-1;tx++){
    const k=ty*W+tx,m=world.material[k];
    if(RESERVED.has(m)||reserved[k]||occupied[k])continue;
    if(rand()>.085)continue;
    const name=rand()>.5?'proto_grass_0':'proto_mushroom_0';
    add(makeProp(`ec_soft_${variant}_${generated++}`,name,tx,ty,{solid:false,habitat:world.meta.materialNames[m],jx:Math.round((rand()-.5)*8)}));
  }
  const counts={};for(const p of props)counts[p.profile]=(counts[p.profile]||0)+1;
  return {variant,seed,props,resourceProposals,stats:{total:props.length,solid:props.filter(p=>p.solid).length,byProfile:counts,clearings:'low-frequency noise field > 0.67',clusters:'low-frequency noise field < 0.32',spacing:'3 tiles SOH-PROTO-16 / 5 tiles CRAFTPIX-3Q'},verdict:'PROPOSED_PLACEMENT_ONLY'};
}
