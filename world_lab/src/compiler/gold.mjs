// Deterministic compiler from the creator-selected VEYRA GOLD Map Studio design.
// IMPORTANT: authoring units are NOT tiles.  This file owns the only scale law.
import fs from 'node:fs';
import crypto from 'node:crypto';

export const SCALE = Object.freeze({
  authorW:2000, authorH:1400,
  pxPerUnit:4,               // 4 device px per authoring unit
  tile:16,                   // 16 px native tile
  unitsPerTile:4,            // 1 tile == 4 authoring units
  gridW:500, gridH:350,      // 2000/4 x 1400/4
  terrainCell:8, terrainGw:250, terrainGh:175,
  playerSpeedPxPerSec:88,    // QA proposal only; not a canon gameplay law
  cameraW:640, cameraH:360,
});
export const auToPx=v=>v*SCALE.pxPerUnit;
export const auToTile=v=>v/SCALE.unitsPerTile;
export const tileToAu=v=>v*SCALE.unitsPerTile;
export const tileToPx=v=>v*SCALE.tile;

// Biome codes are the *decoded* GOLD raster values.  Material assignment below is an
// explicit art-direction interpretation, documented in DESIGN_RATIONALE.md.  Source
// codes are preserved in the compiled layer; they are never replaced by a stretched image.
export const BIOME = Object.freeze({
  0:'lowland', 1:'grassland', 2:'forest', 3:'highland', 4:'marsh', 5:'dunes',
  6:'frost', 7:'cliff', 8:'peak', 9:'cinder', 10:'slag', 11:'coast',
});
export const M = Object.freeze({
  DEEP:0, SHALLOW:1, RIVER:2, SAND:3, GRASS:4, MEADOW:5, FOREST:6, MARSH:7,
  ROCK:8, CLIFF:9, SNOW:10, ASH:11, LAVA:12, DUNE:13, TOXIC:14,
  ROAD_DIRT:15, ROAD_COBBLE:16, BRIDGE:17, DECK:18, FLOOR_WOOD:19, FLOOR_STONE:20,
  WALL_WOOD:21, WALL_STONE:22, ROOF_TILE:23, DOOR:24, PLAZA:25, INTERIOR_VOID:26, WATER_FOAM:27,
});
export const MATERIAL_NAME = Object.freeze([
  'deep_water','shallow_water','river_water','sand','grass','meadow','forest_floor','marsh',
  'rock','cliff','snow','ash','lava','dune','toxic','road_dirt','road_cobble','bridge_deck','wood_deck',
  'floor_wood','floor_stone','wall_wood','wall_stone','roof_tile','door','plaza','interior_void','water_foam',
]);
const BIOME_MATERIAL = Object.freeze({
  0:M.GRASS, 1:M.MEADOW, 2:M.FOREST, 3:M.ROCK, 4:M.MARSH, 5:M.DUNE,
  6:M.SNOW, 7:M.CLIFF, 8:M.CLIFF, 9:M.ASH, 10:M.TOXIC, 11:M.SAND,
});
const SOLID_MATERIAL = new Set([M.DEEP,M.SHALLOW,M.RIVER,M.CLIFF,M.LAVA,M.WALL_WOOD,M.WALL_STONE,M.INTERIOR_VOID]);

function b64(s){return Uint8Array.from(Buffer.from(s,'base64'));}
function ringInside(x,y,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if(((yi>y)!==(yj>y)) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function polyInside(x,y,poly){return ringInside(x,y,poly);}
function landPoly(land,x,y){
  const rings=land.rings||[];
  if(!rings.length)return false;
  if(!ringInside(x,y,rings[0]))return false;
  for(let i=1;i<rings.length;i++)if(ringInside(x,y,rings[i]))return false;
  return true;
}
function distanceToPolyline(x,y,points){
  let best=Infinity,bestSeg=-1;
  for(let i=0;i<points.length-1;i++){
    const [ax,ay]=points[i],[bx,by]=points[i+1];
    const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
    let t=l2?((x-ax)*dx+(y-ay)*dy)/l2:0;t=Math.max(0,Math.min(1,t));
    const d=Math.hypot(x-(ax+t*dx),y-(ay+t*dy));
    if(d<best){best=d;bestSeg=i;}
  }
  return {distance:best,segment:bestSeg};
}
function stampPolyline(pts,halfWidth,fn){
  // deterministic 2-authoring-unit sampling; fills real tile cells, never a canvas line
  for(let i=0;i<pts.length-1;i++){
    const [ax,ay]=pts[i],[bx,by]=pts[i+1];
    const len=Math.hypot(bx-ax,by-ay),steps=Math.max(1,Math.ceil(len/2));
    for(let s=0;s<=steps;s++){
      const t=s/steps,x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
      const r=Math.ceil(halfWidth/SCALE.unitsPerTile);
      const cx=Math.floor(auToTile(x)),cy=Math.floor(auToTile(y));
      for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
        const tx=cx+dx,ty=cy+dy;
        if(tx<0||ty<0||tx>=SCALE.gridW||ty>=SCALE.gridH)continue;
        const wx=tileToAu(tx)+2,wy=tileToAu(ty)+2;
        if(Math.hypot(wx-x,wy-y)<=halfWidth)fn(tx,ty,i,wx,wy);
      }
    }
  }
}
function addRef(refs,idx,id){if(!refs[idx])refs[idx]=[];if(!refs[idx].includes(id))refs[idx].push(id);}

export function loadGold(path){
  const raw=fs.readFileSync(path);
  const sha=crypto.createHash('sha256').update(raw).digest('hex');
  const doc=JSON.parse(raw.toString('utf8'));
  return {doc,sha,bytes:raw.length,raw};
}
export function decodeTerrain(project){
  const t=project.terrain;
  if(t.gw!==SCALE.terrainGw||t.gh!==SCALE.terrainGh||t.cell!==SCALE.terrainCell)throw new Error('GOLD terrain raster dimensions changed');
  const elev=b64(t.elev),biome=b64(t.biome);
  if(elev.length!==t.gw*t.gh||biome.length!==t.gw*t.gh)throw new Error('GOLD terrain raster decode length mismatch');
  return {elev,biome,gw:t.gw,gh:t.gh,cell:t.cell,seed:t.seed};
}

export function compileGold(gold,{variant='A',edits=null}={}){
  const pr=gold.doc.project;
  const layers=decodeTerrain(pr);
  const W=SCALE.gridW,H=SCALE.gridH,N=W*H;
  const material=new Uint8Array(N), collision=new Uint8Array(N), flags=new Uint8Array(N);
  const refs=Object.create(null); // sparse tile -> source IDs
  const xOf=i=>i%W,yOf=i=>(i/W)|0;
  const idx=(x,y)=>y*W+x;
  const sampleTerrain=(tx,ty)=>{
    const auX=tileToAu(tx)+2,auY=tileToAu(ty)+2;
    const cx=Math.min(layers.gw-1,Math.floor(auX/layers.cell)),cy=Math.min(layers.gh-1,Math.floor(auY/layers.cell));
    const k=cy*layers.gw+cx;return {elev:layers.elev[k],biome:layers.biome[k],cx,cy};
  };
  // 1. land mask from GOLD polygon rings/holes
  const landId=new Array(N).fill(null);
  const landHits=new Array(N).fill(0);
  for(const land of pr.land){
    // bounding box in tiles to avoid 8*175k polygon tests
    const xs=land.rings[0].map(p=>p[0]),ys=land.rings[0].map(p=>p[1]);
    const x0=Math.max(0,Math.floor(auToTile(Math.min(...xs)))-1),x1=Math.min(W-1,Math.ceil(auToTile(Math.max(...xs)))+1);
    const y0=Math.max(0,Math.floor(auToTile(Math.min(...ys)))-1),y1=Math.min(H-1,Math.ceil(auToTile(Math.max(...ys)))+1);
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
      const auX=tileToAu(tx)+2,auY=tileToAu(ty)+2;
      if(landPoly(land,auX,auY)){const i=idx(tx,ty);landId[i]=land.id;landHits[i]++;addRef(refs,i,land.id);}
    }
  }
  // 2. base materials from decoded GOLD elevation/biome raster
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){
    const i=idx(tx,ty),s=sampleTerrain(tx,ty);
    if(!landId[i]){material[i]=M.DEEP;continue;}
    let m=BIOME_MATERIAL[s.biome]??M.GRASS;
    if(s.biome===9&&s.elev>180)m=M.LAVA;
    if(s.biome===8&&s.elev>200)m=M.SNOW;
    if(s.biome===3&&s.elev>150)m=M.CLIFF;
    if(s.biome===11&&s.elev>60)m=M.ROCK;
    material[i]=m;
  }
  // 3. shore band: real shallow/sand/foam cells derived from the land mask
  const isLand=i=>!!landId[i];
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){
    const i=idx(tx,ty);if(isLand(i))continue;
    let nearLand=false;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
      const nx=tx+dx,ny=ty+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;
      if(isLand(idx(nx,ny))){nearLand=true;break;}
    }
    if(nearLand)material[i]=M.SHALLOW;
  }
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){
    const i=idx(tx,ty);if(!isLand(i)||material[i]===M.CLIFF||material[i]===M.ROCK)continue;
    let nearWater=false;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=tx+dx,ny=ty+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;
      const mm=material[idx(nx,ny)];if(mm===M.DEEP||mm===M.SHALLOW||mm===M.RIVER){nearWater=true;break;}
    }
    if(nearWater)material[i]=M.SAND;
  }
  // 4. lakes: GOLD polygons, real water volume and shore cells
  for(const lake of pr.lakes){
    const xs=lake.ring.map(p=>p[0]),ys=lake.ring.map(p=>p[1]);
    const x0=Math.max(0,Math.floor(auToTile(Math.min(...xs)))),x1=Math.min(W-1,Math.ceil(auToTile(Math.max(...xs))));
    const y0=Math.max(0,Math.floor(auToTile(Math.min(...ys)))),y1=Math.min(H-1,Math.ceil(auToTile(Math.max(...ys))));
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
      const auX=tileToAu(tx)+2,auY=tileToAu(ty)+2;
      if(polyInside(auX,auY,lake.ring)){const i=idx(tx,ty);material[i]=M.SHALLOW;flags[i]|=1;addRef(refs,i,lake.id);}
    }
  }
  // 5. rivers: GOLD polylines + widths + confluence / mouth records
  const riverInfo=[];
  for(const river of pr.rivers){
    const half=Math.max(2,river.width/2);
    let cells=0;
    stampPolyline(river.points,half,(tx,ty,seg)=>{
      const i=idx(tx,ty);material[i]=M.RIVER;flags[i]|=2;addRef(refs,i,river.id);cells++;
    });
    riverInfo.push({id:river.id,name:river.name,kind:river.kind,width:river.width,points:river.points,nav:river.nav,feats:river.feats,cells});
  }
  // river banks: adjacent land cells become sand/meadow with the river ID as source
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){
    const i=idx(tx,ty);if(material[i]!==M.RIVER)continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=tx+dx,ny=ty+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=idx(nx,ny);
      if(material[j]!==M.RIVER&&material[j]!==M.DEEP&&material[j]!==M.SHALLOW&&landId[j]){material[j]=M.SAND;addRef(refs,j,riverInfo.find(r=>refs[i]?.includes(r.id))?.id||'river_bank');}
    }
  }
  // 6. roads: GOLD polylines rasterized as material cells; ferry never becomes land
  const roadInfo=[];
  for(const road of pr.roads){
    if(road.kind==='ferry'){roadInfo.push({id:road.id,name:road.name,kind:road.kind,points:road.points,cells:0,water_route:true});continue;}
    const width={cart:6,trail:3,foot:3,riverside:3}[road.kind]||3;
    let cells=0;
    stampPolyline(road.points,width/2,(tx,ty)=>{
      const i=idx(tx,ty);
      if(!landId[i])return;                 // roads do not paint over water; bridges do
      if(material[i]===M.CLIFF||material[i]===M.LAVA)return;
      let m=road.kind==='cart'?M.ROAD_DIRT:M.ROAD_DIRT;
      if(flags[i]&64){m=M.ROAD_COBBLE;flags[i]|=128;} // junction uses cobble material
      material[i]=m;flags[i]|=64;addRef(refs,i,road.id);cells++;
    });
    // shoulders: real adjacent cells, not a stroked outline
    stampPolyline(road.points,width/2+2,(tx,ty)=>{
      const i=idx(tx,ty);if(!landId[i]||material[i]===M.ROAD_DIRT||material[i]===M.ROAD_COBBLE)return;
      if(material[i]===M.SAND||material[i]===M.GRASS||material[i]===M.MEADOW||material[i]===M.FOREST){material[i]=M.GRASS;flags[i]|=256;addRef(refs,i,road.id+':shoulder');}
    });
    roadInfo.push({id:road.id,name:road.name,kind:road.kind,points:road.points,cells,water_route:false});
  }
  // 7. bridges: actual sprite spans over water, with explicit source IDs
  const bridgeInfo=[];
  for(const bridge of pr.bridges){
    const [ax,ay]=bridge.at;
    const horizontal=Math.abs(Math.cos(bridge.ang))>=Math.abs(Math.sin(bridge.ang));
    const span=bridge.load==='cart'?20:14; // authoring units
    const halfWidth=bridge.load==='cart'?7:5;
    let cells=0;
    const dx=horizontal?1:0,dy=horizontal?0:1;
    const px=horizontal?0:1,py=horizontal?1:0;
    for(let a=-span/2;a<=span/2;a+=2)for(let b=-halfWidth;b<=halfWidth;b+=2){
      const x=ax+dx*a+px*b,y=ay+dy*a+py*b;
      const tx=Math.floor(auToTile(x)),ty=Math.floor(auToTile(y));
      if(tx<0||ty<0||tx>=W||ty>=H)continue;const i=idx(tx,ty);
      material[i]=M.BRIDGE;flags[i]|=4;addRef(refs,i,bridge.id);cells++;
    }
    bridgeInfo.push({id:bridge.id,name:bridge.name,at:bridge.at,ang:bridge.ang,load:bridge.load,horizontal,span,halfWidth,cells});
  }
  // 8. docks: reachable shore + deck cells, explicit IDs
  const dockInfo=[];
  for(const dock of pr.docks){
    const [x,y]=dock.at;let cells=0;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      const tx=Math.floor(auToTile(x))+dx,ty=Math.floor(auToTile(y))+dy;
      if(tx<0||ty<0||tx>=W||ty>=H)continue;const i=idx(tx,ty);
      if(Math.abs(dx)<=2&&Math.abs(dy)<=2&&(material[i]===M.SHALLOW||material[i]===M.DEEP||material[i]===M.RIVER)){material[i]=M.DECK;flags[i]|=8;addRef(refs,i,dock.id);cells++;}
    }
    dockInfo.push({...dock,cells});
  }
  // 9. POI / zone / resource / spawn / elder footprints: IDs and geometry preserved
  const obj=(list,type)=>list.map(o=>({type,id:o.id,name:o.name,at:o.at||null,ring:o.ring||o.rings?.[0]||o.foot||null,deep:o.deep||null,raw:o}));
  const pois=obj(pr.pois,'poi'),zones=obj(pr.zones,'zone'),resources=obj(pr.resources,'resource'),spawns=obj(pr.spawns,'spawn'),elders=obj(pr.elders,'elder'),labels=obj(pr.labels,'label');
  for(const p of pois){
    if(!p.ring)continue;
    const xs=p.ring.map(q=>q[0]),ys=p.ring.map(q=>q[1]);
    const x0=Math.max(0,Math.floor(auToTile(Math.min(...xs)))),x1=Math.min(W-1,Math.ceil(auToTile(Math.max(...xs))));
    const y0=Math.max(0,Math.floor(auToTile(Math.min(...ys)))),y1=Math.min(H-1,Math.ceil(auToTile(Math.max(...ys))));
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){const auX=tileToAu(tx)+2,auY=tileToAu(ty)+2;if(polyInside(auX,auY,p.ring)){flags[idx(tx,ty)]|=16;addRef(refs,idx(tx,ty),p.id);}}
  }
  for(const z of zones){
    if(!z.ring)continue;const xs=z.ring.map(q=>q[0]),ys=z.ring.map(q=>q[1]);
    const x0=Math.max(0,Math.floor(auToTile(Math.min(...xs)))),x1=Math.min(W-1,Math.ceil(auToTile(Math.max(...xs))));
    const y0=Math.max(0,Math.floor(auToTile(Math.min(...ys)))),y1=Math.min(H-1,Math.ceil(auToTile(Math.max(...ys))));
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){const auX=tileToAu(tx)+2,auY=tileToAu(ty)+2;if(polyInside(auX,auY,z.ring)){flags[idx(tx,ty)]|=32;addRef(refs,idx(tx,ty),z.id);}}
  }
  for(const r of resources){const tx=Math.floor(auToTile(r.at[0])),ty=Math.floor(auToTile(r.at[1]));if(tx>=0&&ty>=0&&tx<W&&ty<H)addRef(refs,idx(tx,ty),r.id);}
  for(const s of spawns){const tx=Math.floor(auToTile(s.at[0])),ty=Math.floor(auToTile(s.at[1]));if(tx>=0&&ty>=0&&tx<W&&ty<H)addRef(refs,idx(tx,ty),s.id);}
  // 10. collision: only substantial physical geometry blocks.  Water/cliff/walls are solid.
  for(let i=0;i<N;i++)collision[i]=SOLID_MATERIAL.has(material[i])?1:0;
  // 11. creator edit overlay. Locked edits survive regeneration; exported data is reproducible.
  const appliedEdits=[];
  if(edits&&Array.isArray(edits.edits)){
    for(const e of edits.edits){
      if(e.kind==='tile'&&Number.isInteger(e.tx)&&Number.isInteger(e.ty)&&e.tx>=0&&e.ty>=0&&e.tx<W&&e.ty<H){
        const i=idx(e.tx,e.ty);material[i]=e.material;collision[i]=SOLID_MATERIAL.has(e.material)?1:0;addRef(refs,i,e.gold_ref||e.id);appliedEdits.push(e.id);
      }
    }
  }
  const goldIndex={};
  const addIndex=(type,o)=>{goldIndex[o.id]={type,name:o.name,at:o.at||null,raw:o.raw||o,variant:null};};
  [...pr.land.map(o=>({...o,at:null})),...pr.lakes.map(o=>({...o,at:null})),...pr.rivers,...pr.roads,...pr.bridges,...pr.docks,...pr.pois,...pr.zones,...pr.resources,...pr.spawns,...pr.elders,...pr.labels].forEach(o=>{goldIndex[o.id]={type:o.arche||o.kind||'object',name:o.name||o.text||'',at:o.at||null,ring:o.ring||o.rings?.[0]||o.foot||null};});
  const compactRefs={};for(const k of Object.keys(refs))compactRefs[k]=refs[k];
  return {
    meta:{
      generator:'SOH Veyra World Lab GOLD compiler v1',variant,
      goldSha256:gold.sha,goldBytes:gold.bytes,goldName:pr.name,goldWorld:pr.world,
      scale:SCALE,transform:'world_px = authoring_unit * 4; tile = 16px; tile = 4 authoring units',
      biomeCodes:BIOME,biomeMaterialInterpretation:BIOME_MATERIAL,
      materialNames:MATERIAL_NAME,created:'deterministic GOLD-derived build (wall clock omitted)',
      note:'GOLD geography and IDs preserved. Material assignment is an art-direction interpretation, not a relocated object.',
    },
    grid:{w:W,h:H},material:Array.from(material),collision:Array.from(collision),flags:Array.from(flags),
    refs:compactRefs,terrain:{elev:Array.from(layers.elev),biome:Array.from(layers.biome),gw:layers.gw,gh:layers.gh,cell:layers.cell,seed:layers.seed},
    landId,objects:{pois,zones,resources,spawns,elders,labels,land:pr.land,lakes:pr.lakes,rivers:riverInfo,roads:roadInfo,bridges:bridgeInfo,docks:dockInfo},
    goldIndex,appliedEdits,
  };
}
