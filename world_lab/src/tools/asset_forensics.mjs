// Forensic donor-sheet analysis: connected-component extraction, provenance and contact sheet.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {PNG} from 'pngjs';import {Pix} from '../lib/pixels.mjs';import {bitmapText} from '../render/targets.mjs';
const ROOT=process.cwd(),SRC=path.join(ROOT,'assets/source'),OUT=path.join(ROOT,'_scratch/forensics');fs.mkdirSync(OUT,{recursive:true});
const sheets=[
 ['craftpix_200380_plants.png','CraftPix 200380 farm plants'],
 ['craftpix_200380_supplies.png','CraftPix 200380 supplies'],
 ['craftpix_668008_bridges.png','CraftPix 668008 bridges'],
 ['craftpix_668008_water.png','CraftPix 668008 water'],
 ['craftpix_574220_road_grass.png','CraftPix 574220 cobble road'],
 ['craftpix_665131_fields.png','CraftPix 665131 fields'],
 ['craftpix_351300_tileset.png','CraftPix 351300 island tileset'],
 ['craftpix_351300_tiled_map.png','CraftPix 351300 authored map reference'],
 ['cainos_tileset_grass.png','Cainos grass/stone 32px'],
 ['cainos_struct.png','Cainos walls/stairs 32px'],
 ['cainos_plant.png','Cainos trees/bushes 32px'],
 ['cainos_props.png','Cainos props / circular stone rings'],
 ['cainos_shadow.png','Cainos contact shadows'],
 ['cainos_shadow_plant.png','Cainos plant contact shadows'],
 ['cainos_tileset_stone_ground.png','Cainos stone ground tiles'],
 ['cainos_tileset_wall.png','Cainos stone wall tiles'],
 ['cainos_player.png','Cainos player sprites'],
 ['assets/source/prototype/assets_environment_chapter1_gatehouse_gatehouse_props.png','Prototype gatehouse props'],
 ['assets/source/prototype/assets_environment_chapter1_relay_relay_props.png','Prototype relay props'],
 ['assets/source/prototype/assets_environment_chapter1_vigil_vigil_props.png','Prototype vigil props'],
 ['assets/source/prototype/assets_environment_chapter1_crucible_crucible_props.png','Prototype crucible props'],
 ['assets/source/prototype/assets_environment_overworld_overworld_props.png','Prototype overworld props'],
 ['assets/source/prototype/assets_environment_overworld_overworld_tiles.png','Prototype overworld tiles'],
];
function sha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}
function components(png,minArea=24){
 const {width:W,height:H,data}=png,seen=new Uint8Array(W*H),out=[];
 const alpha=(i)=>data[i*4+3];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x;if(seen[i]||alpha(i)<40)continue;const q=[i];seen[i]=1;let minx=x,maxx=x,miny=y,maxy=y,n=0,opaque=0;
  while(q.length){const j=q.pop(),cx=j%W,cy=(j/W)|0;n++;if(alpha(j)>200)opaque++;if(cx<minx)minx=cx;if(cx>maxx)maxx=cx;if(cy<miny)miny=cy;if(cy>maxy)maxy=cy;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const k=ny*W+nx;if(!seen[k]&&alpha(k)>=40){seen[k]=1;q.push(k);}}
  }
  if(n>=minArea)out.push({x:minx,y:miny,w:maxx-minx+1,h:maxy-miny+1,area:n,opaque});
 }
 return out.sort((a,b)=>b.area-a.area);
}
const report=[];let contact=new Pix(1800,4400),cx=0,cy=0,rowH=0;
const t={fillRect:(x,y,w,h,c,a=1)=>{const n=parseInt(c.slice(1),16);contact.rect(Math.round(x),Math.round(y),Math.round(w),Math.round(h),[(n>>16)&255,(n>>8)&255,n&255,Math.round(255*a)]);}};
for(const [file,label] of sheets){
 const p=file.includes('/')?path.join(ROOT,file):path.join(SRC,file);if(!fs.existsSync(p))continue;const png=PNG.sync.read(fs.readFileSync(p)),comps=components(png,36);
 const rec={file,label,sha256:sha(p),width:png.width,height:png.height,components:comps.length,largest:comps.slice(0,60)};report.push(rec);
 for(const c of comps.slice(0,6)){
  const bw=Math.min(180,c.w),bh=Math.min(120,c.h);if(cx+bw+8>1800){cx=0;cy+=rowH+24;rowH=0;}
  for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const sx=c.x+Math.floor(x*c.w/bw),sy=c.y+Math.floor(y*c.h/bh),si=(sy*png.width+sx)*4,di=((cy+16+y)*1800+cx+x)*4;for(let k=0;k<4;k++)contact.data[di+k]=png.data[si+k];}
  t.fillRect(cx,cy,180,15,'#101820',.9);bitmapText(t,`${path.basename(file).slice(0,8)} ${c.w}x${c.h}`,cx+2,cy+2,'#f3e6b0',1);
  cx+=188;rowH=Math.max(rowH,bh+16);
 }
 cx=0;cy+=rowH+24;rowH=0;
}
const outPng=new PNG({width:1800,height:4400});outPng.data.set(contact.data);fs.writeFileSync(path.join(OUT,'asset_components.png'),PNG.sync.write(outPng));fs.writeFileSync(path.join(ROOT,'data/asset_components.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(ROOT,'data/hero_donor_components.json'),JSON.stringify(report,null,2));
console.log('sheets',report.length,'components',report.reduce((a,b)=>a+b.components,0));
