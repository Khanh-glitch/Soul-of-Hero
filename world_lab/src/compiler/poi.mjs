// Handcrafted flagship POI geometry, anchored to immutable GOLD IDs.
// These are ART / LEVEL-DESIGN overlays, never relocated GOLD objects and never
// gameplay keys, yields, stock, recipes, HP or unlock rules.
import {M,SCALE,auToPx,auToTile,tileToPx} from './gold.mjs';
import {hash2} from '../lib/pixels.mjs';

const W=SCALE.gridW,H=SCALE.gridH;
const LAND=new Set([M.GRASS,M.MEADOW,M.FOREST,M.MARSH,M.SAND,M.ROCK,M.SNOW,M.DUNE,M.ASH,M.TOXIC,M.ROAD_DIRT,M.ROAD_COBBLE,M.PLAZA,M.FLOOR_STONE,M.DECK]);
function idx(x,y){return y*W+x;}
function tileAt(w,x,y){return w.material[idx(x,y)];}
function findAnchor(w,id){
  const o=w.goldIndex[id];if(!o)throw new Error('missing GOLD index '+id);
  let at=o.at;
  if(!at){
    const road=w.objects.roads.find(r=>r.id===id);
    if(road?.points)at=road.points[Math.floor(road.points.length/2)];
    else if(o.ring){let sx=0,sy=0;for(const p of o.ring){sx+=p[0];sy+=p[1];}at=[sx/o.ring.length,sy/o.ring.length];}
  }
  if(!at)throw new Error('missing GOLD anchor '+id);
  return {au:at,tx:Math.round(auToTile(at[0])),ty:Math.round(auToTile(at[1]))};
}
function fit(w,cx,cy,wid,hei,used,preferRoad=false){
  let best=null;
  for(let oy=-10;oy<=10;oy++)for(let ox=-10;ox<=10;ox++){
    const x=cx-Math.floor(wid/2)+ox,y=cy-Math.floor(hei/2)+oy;
    if(x<1||y<1||x+wid>=W-1||y+hei>=H-1)continue;
    let score=0,land=0;
    for(let j=0;j<hei;j++)for(let i=0;i<wid;i++){
      const m=tileAt(w,x+i,y+j);
      if(LAND.has(m)){land++;score+=preferRoad&&(m===M.ROAD_DIRT||m===M.ROAD_COBBLE)?3:1;}
      else score-=12;
    }
    if(land<wid*hei*.85)continue;
    score-=Math.hypot(ox,oy)*.6;
    for(const u of used)if(!(x+wid<=u[0]||u[0]+u[2]<=x||y+hei<=u[1]||u[1]+u[3]<=y))score-=100;
    if(!best||score>best.score)best={x,y,score};
  }
  if(!best)throw new Error('no land fit for '+cx+','+cy);
  used.push([best.x,best.y,wid,hei]);return [best.x,best.y,wid,hei];
}
function rectTiles(r){const [x,y,w,h]=r,out=[];for(let j=0;j<h;j++)for(let i=0;i<w;i++)out.push([x+i,y+j]);return out;}
function perimeter(r){const [x,y,w,h]=r,out=[];for(let i=0;i<w;i++){out.push([x+i,y]);out.push([x+i,y+h-1]);}for(let j=1;j<h-1;j++){out.push([x,y+j]);out.push([x+w-1,y+j]);}return out;}
function structure(id,name,rect,kind,opts={}){
  const [x,y,w,h]=rect,door=opts.building?[x+Math.floor(w/2),y+h-1]:(opts.door||[x+Math.floor(w/2),y+h-1]);
  const walls=perimeter(rect).filter(([tx,ty])=>!(tx===door[0]&&ty===door[1]));
  return {
    id,name,kind,rect,door,walls,roofTiles:rectTiles(rect),
    solidTiles:walls,openTiles:[door,...rectTiles([x+1,y+1,w-2,h-2])],
    building:opts.building||null,
    sprite:opts.sprite||(kind==='stone'?'proto_wall_stone_0':'proto_wall_wood_0'),
    roofSprite:opts.roofSprite||'proto_roof_0',profile:'INDUSTRIAL-TILE-16',
    y:(y+h)*16,z:opts.z||1,gold_refs:opts.gold_refs||[],story:opts.story||'',
    hideRoofIfInside:opts.hideRoofIfInside!==false,
  };
}
function groundPatch(w,id,rect,material,refs,reason,shape='organic'){
  const [x,y,ww,h]=rect;const cells=[];
  for(let j=0;j<h;j++)for(let i=0;i<ww;i++){
    const tx=x+i,ty=y+j;if(tx<0||ty<0||tx>=W||ty>=H)continue;
    const nx=(i+.5-ww/2)/(ww/2),ny=(j+.5-h/2)/(h/2),jitter=(hash2(tx,ty,id.length)-.5)*.20;
    const inside=shape==='strip'?Math.abs(ny)<.72+jitter:shape==='rounded'?Math.abs(nx)**4+Math.abs(ny)**4<.95+jitter:nx*nx+ny*ny<1+jitter;
    if(!inside)continue;
    const k=idx(tx,ty);cells.push({tx,ty,base:w.material[k]});w.material[k]=material;w.collision[k]=[M.DEEP,M.SHALLOW,M.RIVER,M.CLIFF,M.LAVA,M.WALL_WOOD,M.WALL_STONE,M.INTERIOR_VOID].includes(material)?1:0;
    if(!w.refs[k])w.refs[k]=[];for(const r of refs)if(!w.refs[k].includes(r))w.refs[k].push(r);
  }
  return {id,rect,material,refs,reason,shape,cells};
}
function prop(id,sprite,tx,ty,opts={}){
  return {id,sprite,x:tx*16+(opts.dx||0),y:ty*16+(opts.dy||0),profile:opts.profile||'SOH-PROTO-16',solid:!!opts.solid,
    collider:opts.collider||null,renderFootprint:opts.renderFootprint||null,source_ids:opts.source_ids||[],story:opts.story||'',layer:opts.layer||'prop'};
}
function spriteName(k,v=0){return `proto_${k}_${v}`;}
// ---------------- interior levels ----------------
function makeLevel(id,name,depth,w,h){
  const g={id,name,depth,w,h,material:new Uint8Array(w*h).fill(M.INTERIOR_VOID),collision:new Uint8Array(w*h).fill(1),props:[],zones:[],landmarks:[],stairs:[],hazard:[],story:[]};
  const K=(x,y)=>y*w+x;
  const carve=(x,y,ww,hh,m=M.FLOOR_STONE,solid=false)=>{for(let j=y;j<y+hh;j++)for(let i=x;i<x+ww;i++){if(i<0||j<0||i>=w||j>=h)continue;g.material[K(i,j)]=m;g.collision[K(i,j)]=solid?1:0;}};
  const wall=(x,y,ww,hh)=>{for(let j=y;j<y+hh;j++)for(let i=x;i<x+ww;i++){if(i<0||j<0||i>=w||j>=h)continue;g.material[K(i,j)]=M.WALL_STONE;g.collision[K(i,j)]=1;}};
  const hazard=(x,y,ww,hh)=>{for(let j=y;j<y+hh;j++)for(let i=x;i<x+ww;i++){if(i<0||j<0||i>=w||j>=h)continue;g.material[K(i,j)]=M.TOXIC;g.collision[K(i,j)]=0;g.hazard.push([i,j]);}};
  const water=(x,y,ww,hh)=>{for(let j=y;j<y+hh;j++)for(let i=x;i<x+ww;i++){if(i<0||j<0||i>=w||j>=h)continue;g.material[K(i,j)]=M.SHALLOW;g.collision[K(i,j)]=1;}};
  const bridge=(x,y,ww,hh)=>{for(let j=y;j<y+hh;j++)for(let i=x;i<x+ww;i++){if(i<0||j<0||i>=w||j>=h)continue;g.material[K(i,j)]=M.BRIDGE;g.collision[K(i,j)]=0;}};
  const zone=(name2,x,y,ww,hh,func)=>g.zones.push({id:`${id}_${g.zones.length}`,name:name2,rect:[x,y,ww,hh],function:func});
  const landmark=(name2,x,y,text)=>g.landmarks.push({id:`${id}_${g.landmarks.length}`,name:name2,tx:x,ty:y,story:text});
  const stair=(name2,x,y,to,toXY,kind='stairs')=>g.stairs.push({id:`${id}_${g.stairs.length}`,name:name2,tx:x,ty:y,to,to_tx:toXY[0],to_ty:toXY[1],kind});
  const addProp=(name2,sprite,x,y,extra={})=>g.props.push(prop(`${id}_${g.props.length}_${name2}`,sprite,x,y,{...extra,profile:'INDUSTRIAL-TILE-16'}));
  return {...g,carve,wall,hazard,water,bridge,zone,landmark,stair,addProp,K};
}
function buildVaultLevels(){
  // Level 0 — approachable service floor: exterior door, reception, generator, two independent descents.
  const L0=makeLevel('argus_l0','Argus Academy — Reception & Service Hall',0,48,32);
  L0.carve(0,0,48,32,M.INTERIOR_VOID,true);
  L0.carve(3,3,42,26,M.FLOOR_STONE);
  L0.zone('Reception hall',4,18,16,10,'legible first arrival, exterior retreat, orientation');
  L0.carve(4,18,16,10,M.FLOOR_WOOD);
  L0.zone('Generator room',27,18,17,10,'proposed power-node geometry; A0/A3/A8 own semantics');
  L0.carve(27,18,17,10,M.PLAZA);
  L0.zone('North service gallery',4,3,40,5,'connects main stair and service lift; pacing landmark');
  L0.carve(4,3,40,5,M.FLOOR_STONE);
  L0.zone('West stair hall',4,8,8,10,'alternate route back from deep levels');
  L0.carve(4,8,8,10,M.FLOOR_WOOD);
  L0.zone('East stair hall',36,8,8,10,'separate route to generator and drainage return');
  L0.carve(36,8,8,10,M.FLOOR_WOOD);
  L0.zone('South corridor',4,28,40,3,'retreat corridor and exterior door');
  L0.carve(4,28,40,3,M.FLOOR_STONE);
  L0.wall(0,0,48,1);L0.wall(0,31,48,1);L0.wall(0,0,1,32);L0.wall(47,0,1,32);
  L0.wall(20,17,1,1);L0.wall(22,17,1,1); // reception columns
  L0.wall(26,8,1,10);L0.wall(12,8,1,10);L0.wall(12,18,1,10);L0.wall(26,18,1,10);
  L0.carve(20,27,2,2,M.DOOR); // exterior threshold
  L0.carve(34,3,2,2,M.DOOR);L0.carve(5,3,2,2,M.DOOR);
  L0.carve(35,24,2,2,M.DOOR);
  L0.stair('Main stair down to cistern',34,3,'argus_l1',[34,4],'stairs');
  L0.stair('Service lift down to south corridor',5,3,'argus_l1',[5,28],'shortcut');
  L0.stair('Drainage shaft return from lens vault',35,24,'argus_l2',[35,28],'retreat_shortcut');
  L0.landmark('Threshold mosaic',20,27,'Worn academy seal facing the courtyard; the first readable interior landmark.');
  L0.landmark('Dead generator',32,22,'Silent flywheel and cold pipes; power state is a PROPOSED A0/A3/A8 condition, not implemented here.');
  L0.landmark('Evacuation board',7,20,'Scratched route diagram showing north stair, service lift and drainage shaft.');
  L0.addProp('furnace','proto_furnace_0',32,22,{solid:true,collider:{x:2,y:18,w:12,h:10}});
  L0.addProp('chimney','proto_chimney_0',38,20,{solid:true,collider:{x:4,y:24,w:8,h:8}});
  for(let i=0;i<5;i++)L0.addProp('crate',spriteName('crate'),6+i*2,20,{solid:true,collider:{x:2,y:4,w:12,h:10},source_ids:['po_academy']});
  L0.addProp('barrel',spriteName('barrel'),40,24,{solid:true,collider:{x:2,y:6,w:12,h:8}});
  for(const [x,y] of [[10,4],[30,4]])L0.addProp('shelf','proto_shelf_0',x,y,{solid:true,collider:{x:2,y:24,w:12,h:6}});
  L0.addProp('sign','proto_sign_0',18,20,{solid:false});
  L0.addProp('door','proto_door_0',20,27);
  L0.story.push('Three-layer history: lived-in academy, rushed evacuation, later flood damage used as physical navigation.');

  // Level -1 — archive stacks and flooded cistern; two loops and a pump-control overlook.
  const L1=makeLevel('argus_l1','Argus Archive — Stacks & Flooded Cistern',-1,48,32);
  L1.carve(0,0,48,32,M.INTERIOR_VOID,true);
  L1.carve(3,3,42,26,M.FLOOR_STONE);
  L1.zone('Archive stacks',4,4,18,10,'readable shelves, slow pacing, clue density');
  L1.carve(4,4,18,10,M.FLOOR_WOOD);
  L1.zone('Flooded cistern',24,4,20,10,'water barrier, bridge approach, vertical relationship to stair');
  L1.carve(24,4,20,10,M.FLOOR_STONE);
  L1.water(27,7,14,4);L1.bridge(27,7,14,2);
  L1.zone('Pump control',4,18,14,8,'overlook and proposed mitigation geometry; no canonical unlock');
  L1.carve(4,18,14,8,M.PLAZA);
  L1.zone('South return corridor',4,27,40,4,'retreat and service-lift landing');
  L1.carve(4,27,40,4,M.FLOOR_STONE);
  L1.zone('East stacks loop',36,14,8,13,'alternate route around flooded hall');
  L1.carve(36,14,8,13,M.FLOOR_WOOD);
  L1.wall(0,0,48,1);L1.wall(0,31,48,1);L1.wall(0,0,1,32);L1.wall(47,0,1,32);
  L1.wall(22,4,1,10);L1.wall(22,18,1,9);L1.wall(18,14,1,13);L1.wall(34,14,1,13);
  for(let i=0;i<6;i++)L1.wall(5+i*3,6,1,6); // shelf rows with 2-tile aisles
  L1.carve(34,3,2,2,M.DOOR);L1.carve(5,27,2,2,M.DOOR);L1.carve(5,28,2,2,M.DOOR);
  L1.stair('Main stair up to service hall',34,3,'argus_l0',[34,4],'stairs');
  L1.stair('Service lift up to service hall',5,28,'argus_l0',[5,4],'shortcut');
  L1.stair('Ladder down to lens vault',5,28,'argus_l2',[5,4],'stairs');
  L1.landmark('Collapsed index cabinet',8,8,'Shelves lean away from water damage; archive identity distinct from the laboratory vault below.');
  L1.landmark('Cistern bridge',32,8,'Narrow bridge over real water cells; render/occlusion footprint differs from collision footprint.');
  L1.landmark('Pump wheel',9,21,'Physical wheel overlooking the water; hazard mitigation is a PROPOSED Gameplay condition only.');
  for(let i=0;i<7;i++)L1.addProp('crate',spriteName('crate'),6+i*2,9,{solid:true,collider:{x:2,y:4,w:12,h:10},source_ids:['po_archive']});
  L1.addProp('waterwheel','proto_waterwheel_0',9,21,{solid:true,collider:{x:2,y:6,w:12,h:8}});
  L1.addProp('barrel',spriteName('barrel'),40,24,{solid:true,collider:{x:2,y:6,w:12,h:8}});
  for(const [x,y] of [[6,5],[10,5],[14,5],[38,16]])L1.addProp('shelf','proto_shelf_0',x,y,{solid:true,collider:{x:2,y:24,w:12,h:6}});
  L1.addProp('sign','proto_sign_0',20,20,{solid:false});
  L1.story.push('Water damage explains the alternate east loop and the shortcut back to the surface; no gate or loot is implied.');

  // Level -2 — lens vault: circular landmark, hazard ring, two exits and three lateral routes.
  const L2=makeLevel('argus_l2','Argus Deep Vault — Lens Chamber',-2,48,32);
  L2.carve(0,0,48,32,M.INTERIOR_VOID,true);
  L2.carve(3,3,42,26,M.FLOOR_STONE);
  L2.zone('Lens chamber',14,8,20,16,'central landmark, open sightlines, high tension');
  L2.carve(14,8,20,16,M.FLOOR_STONE);
  L2.carve(20,12,8,8,M.PLAZA);
  L2.zone('West approach loop',4,6,9,20,'retreat route via ladder');
  L2.carve(4,6,9,20,M.FLOOR_WOOD);
  L2.zone('East approach loop',35,6,9,20,'retreat route via drainage shaft');
  L2.carve(35,6,9,20,M.FLOOR_WOOD);
  L2.zone('South service passage',4,26,40,4,'connects both loops and the drainage return');
  L2.carve(4,26,40,4,M.FLOOR_STONE);
  L2.zone('North lens gallery',4,3,40,4,'high overlook and main ladder landing');
  L2.carve(4,3,40,4,M.FLOOR_STONE);
  L2.wall(0,0,48,1);L2.wall(0,31,48,1);L2.wall(0,0,1,32);L2.wall(47,0,1,32);
  L2.wall(13,6,1,20);L2.wall(34,6,1,20);L2.wall(14,7,20,1);L2.wall(14,24,20,1);
  L2.carve(22,7,4,2,M.DOOR);L2.carve(22,23,4,2,M.DOOR);L2.carve(13,14,2,4,M.DOOR);L2.carve(33,14,2,4,M.DOOR);
  L2.hazard(16,10,4,12);L2.hazard(28,10,4,12);L2.hazard(18,10,12,2);L2.hazard(18,20,12,2);
  L2.water(18,12,12,2);L2.bridge(18,12,12,2);
  L2.carve(5,3,2,2,M.DOOR);L2.carve(35,28,2,2,M.DOOR);
  L2.stair('Ladder up to archive',5,3,'argus_l1',[5,28],'stairs');
  L2.stair('Drainage shaft retreat to service hall',35,28,'argus_l0',[35,24],'retreat_shortcut');
  L2.landmark('Great lens',24,16,'Large glass-and-brass landmark visible from three approaches; its function is a PROPOSED A8/A3 capability, not implemented.');
  L2.landmark('Cracked lens housing',19,20,'Physical damage explains the hazard ring and the west/east loops.');
  L2.landmark('Drainage shaft',35,28,'Emergency retreat returns to the service floor without crossing the lens chamber.');
  for(let i=0;i<4;i++)L2.addProp('crate',spriteName('crate'),7+i*2,22,{solid:true,collider:{x:2,y:4,w:12,h:10}});
  L2.addProp('furnace','proto_furnace_0',24,16,{solid:true,collider:{x:2,y:18,w:12,h:10}});
  L2.addProp('barrel',spriteName('barrel'),39,10,{solid:true,collider:{x:2,y:6,w:12,h:8}});
  for(const [x,y] of [[7,8],[39,22]])L2.addProp('shelf','proto_shelf_0',x,y,{solid:true,collider:{x:2,y:24,w:12,h:6}});
  L2.addProp('sign','proto_sign_0',38,26,{solid:false});
  L2.story.push('Hazard ring is walkable candidate geometry with an explicit A1/Gameplay semantic reference; no damage, timer or loot is invented.');

  // Landmarks and vertical transitions are approachable cells, never blocked wall tiles.
  for(const l of [L0,L1,L2]){
    for(const lm of l.landmarks){const k=lm.ty*l.w+lm.tx;if(l.collision[k]){l.material[k]=M.FLOOR_STONE;l.collision[k]=0;}}
    for(const st of l.stairs){const k=st.ty*l.w+st.tx;if(l.collision[k]){l.material[k]=M.FLOOR_WOOD;l.collision[k]=0;}}
  }
  const levels=[L0,L1,L2].map(l=>{
    const {carve,wall,hazard,water,bridge,zone,landmark,stair,addProp,K,...rest}=l;return rest;
  });
  // Explicit multi-level access graph.  Edges are spatial candidates, not gameplay prerequisites.
  const nodes=[
    {id:'ext_courtyard',level:'exterior',tx:234,ty:66,name:'Argus courtyard',gold_ref:'po_academy'},
    {id:'l0_entry',level:'argus_l0',tx:20,ty:27,name:'Reception threshold'},
    {id:'l0_generator',level:'argus_l0',tx:32,ty:22,name:'Generator room'},
    {id:'l0_main_stair',level:'argus_l0',tx:34,ty:3,name:'Main stair'},
    {id:'l0_lift',level:'argus_l0',tx:5,ty:3,name:'Service lift'},
    {id:'l0_drain',level:'argus_l0',tx:35,ty:24,name:'Drainage return'},
    {id:'l1_main_stair',level:'argus_l1',tx:34,ty:3,name:'Cistern stair'},
    {id:'l1_archive',level:'argus_l1',tx:10,ty:8,name:'Archive stacks'},
    {id:'l1_cistern',level:'argus_l1',tx:32,ty:8,name:'Cistern bridge'},
    {id:'l1_pump',level:'argus_l1',tx:9,ty:21,name:'Pump control'},
    {id:'l1_lift',level:'argus_l1',tx:5,ty:28,name:'Service lift landing'},
    {id:'l1_ladder',level:'argus_l1',tx:5,ty:28,name:'Lens ladder'},
    {id:'l2_ladder',level:'argus_l2',tx:5,ty:3,name:'Lens ladder landing'},
    {id:'l2_west',level:'argus_l2',tx:8,ty:16,name:'West loop'},
    {id:'l2_lens',level:'argus_l2',tx:24,ty:16,name:'Great lens'},
    {id:'l2_east',level:'argus_l2',tx:39,ty:16,name:'East loop'},
    {id:'l2_drain',level:'argus_l2',tx:35,ty:28,name:'Drainage shaft'},
  ];
  const edges=[
    ['ext_courtyard','l0_entry','door','exterior→interior'],['l0_entry','l0_generator','hall','reception to generator'],
    ['l0_entry','l0_main_stair','west_stair','primary descent'],['l0_entry','l0_lift','gallery','shortcut descent'],
    ['l0_generator','l0_drain','short_corridor','retreat link'],['l0_main_stair','l1_main_stair','stairs','vertical'],
    ['l0_lift','l1_lift','lift','vertical shortcut'],['l1_main_stair','l1_cistern','bridge','flooded hall'],
    ['l1_cistern','l1_archive','west_loop','alternate route'],['l1_archive','l1_pump','south','pump overlook'],
    ['l1_pump','l1_lift','south_corridor','retreat'],['l1_lift','l1_ladder','same_landing','descent'],
    ['l1_ladder','l2_ladder','ladder','vertical'],['l2_ladder','l2_west','north_gallery','west approach'],
    ['l2_west','l2_lens','west_door','landmark approach'],['l2_lens','l2_east','east_door','alternate approach'],
    ['l2_east','l2_drain','south_passage','retreat'],['l2_drain','l0_drain','shaft','emergency shortcut'],
    ['l0_drain','ext_courtyard','door','retreat to surface'],
  ];
  return {levels,nodes,edges,capability_refs:['C11','A8:POI_INTERACTION_CONDITION','A3:KEY_STOCK_NOT_SET','A0:POWER_STATE_NOT_IMPLEMENTED','A1:HAZARD_EXPOSURE_CANDIDATE'],verdict:'SPATIAL_CANDIDATE_ONLY'};
}

export function buildFlagshipPOIs(world){
  const used=[];const patches=[],structures=[],props=[],landmarks=[];
  const anchors={};for(const id of ['sp_lake','po_greywater','po_pumphouse','po_sawaion','po_glade','po_confluence','br_3','br_4','dk_grey_s','dk_grey_n','po_academy','po_archive','po_hall_eyes','po_observatory','po_lantern','rd_9','rd_13','rd_20','rd_29','bz_greywater','bz_argus'])anchors[id]=findAnchor(world,id);
  // ---------- Greywater Tideworks: an open mill / harbor / freight landscape ----------
  const gw=anchors.po_greywater;
  const quay=fit(world,gw.tx-2,gw.ty-6,10,3,used,false);
  patches.push(groundPatch(world,'gw_quay_deck',quay,M.DECK,['po_greywater','dk_grey_s','po_pumphouse'],'Working quay: irregular timber deck at the GOLD dock, not a decorative marker.','strip'));
  const plaza=fit(world,gw.tx,gw.ty+1,8,6,used,true);
  patches.push(groundPatch(world,'gw_market_plaza',plaza,M.PLAZA,['po_greywater','rd_9','rd_a'],'Rounded cobble market/loading plaza where cart and foot routes meet.','rounded'));
  const mill=fit(world,gw.tx-6,gw.ty-2,5,3,used,false);
  structures.push(structure('gw_mill','Greywater Tide Mill',mill,'wood',{building:'bld_mill',gold_refs:['po_greywater','dk_grey_s'],story:'Water-driven mill with a real door, wall/roof footprints and a working yard.'}));
  const pumphouse=fit(world,anchors.po_pumphouse.tx,anchors.po_pumphouse.ty,3,3,used,false);
  structures.push(structure('gw_filter_house','Greywater Filter House',pumphouse,'stone',{building:'bld_filter_house',gold_refs:['po_pumphouse'],story:'Filter building explains clean-water logistics; gameplay condition is NOT invented.'}));
  const warehouse=fit(world,gw.tx+8,gw.ty-1,4,3,used,false);
  structures.push(structure('gw_warehouse','Harbor Freight Warehouse',warehouse,'wood',{building:'bld_warehouse',gold_refs:['po_greywater','rd_9'],story:'Crate staging and cart turnaround, not a house prefab.'}));
  const houseA=fit(world,gw.tx-9,gw.ty+6,3,2,used,false);
  structures.push(structure('gw_cottage_n','Net-mender cottage',houseA,'wood',{building:'bld_cottage',gold_refs:['po_greywater'],story:'Small residence tucked behind the working yard.'}));
  const houseB=fit(world,gw.tx+9,gw.ty+7,3,2,used,false);
  structures.push(structure('gw_cottage_s','Millwright cottage',houseB,'wood',{building:'bld_cottage',gold_refs:['po_greywater'],story:'Second residence provides scale and a sheltered lane.'}));
  const saw=anchors.po_sawaion;
  const timberYard=fit(world,saw.tx,saw.ty,10,6,used,false);
  patches.push(groundPatch(world,'gw_timber_yard',timberYard,M.ROAD_DIRT,['po_sawaion','rs_1w','rd_13'],'Irregular timber sorting yard with log piles and cart approach.','organic'));
  const sawShed=fit(world,saw.tx+2,saw.ty-3,4,2,used,false);
  structures.push(structure('gw_saw_shed','Aion Edge Sawmill Shed',sawShed,'wood',{building:'bld_saw_shed',gold_refs:['po_sawaion'],story:'Open industrial shed adjacent to the timber yard.'}));
  // Working objects: real sprites with explicit foot/root colliders.  Soft clutter stays traversable.
  const add=(id,sprite,tx,ty,o={})=>props.push(prop(id,sprite,tx,ty,o));
  for(let i=0;i<5;i++)add('gw_quay_crate_'+i,spriteName('crate'),quay[0]+1+i*2,quay[1]+2,{solid:true,collider:{x:2,y:4,w:12,h:10},source_ids:['dk_grey_s','po_greywater']});
  for(let i=0;i<3;i++)add('gw_barrel_'+i,spriteName('barrel'),quay[0]+2+i*3,quay[1]+4,{solid:true,collider:{x:2,y:6,w:12,h:8},source_ids:['dk_grey_s']});
  add('gw_cart','proto_cart_0',plaza[0]+2,plaza[1]+5,{solid:true,collider:{x:3,y:14,w:22,h:6},source_ids:['rd_9']});
  add('gw_waterwheel','proto_waterwheel_0',mill[0]-1,mill[1]+4,{solid:true,collider:{x:2,y:6,w:12,h:8},source_ids:['po_greywater']});
  add('gw_chimney','proto_chimney_0',pumphouse[0]+6,pumphouse[1]+1,{solid:true,collider:{x:4,y:24,w:8,h:8},source_ids:['po_pumphouse']});
  for(let i=0;i<9;i++)add('gw_log_'+i,spriteName('log'),timberYard[0]+1+(i%3)*4,timberYard[1]+1+Math.floor(i/3)*2,{solid:false,source_ids:['po_sawaion','rs_1w']});
  for(let i=0;i<4;i++)add('gw_market_crate_'+i,spriteName('crate'),plaza[0]+2+i*2,plaza[1]+2,{solid:true,collider:{x:2,y:4,w:12,h:10},source_ids:['po_greywater']});
  add('gw_bridge_sprite','bridge_stone_h',anchors.br_3.tx,anchors.br_3.ty,{dx:-32,dy:-16,profile:'INDUSTRIAL-TILE-16',source_ids:['br_3'],layer:'bridge'});
  landmarks.push(
    {id:'gw_quay',name:'Greywater North Quay',at:[...anchors.dk_grey_s.au],gold_refs:['dk_grey_s','po_greywater'],story:'Working harbor edge with crates, barrels and a cart route.'},
    {id:'gw_mill',name:'Tide Mill',at:[...gw.au],gold_refs:['po_greywater'],story:'Waterwheel and mill building make the hamlet a functional industrial space.'},
    {id:'gw_filter',name:'Filter House',at:[...anchors.po_pumphouse.au],gold_refs:['po_pumphouse'],story:'Water-treatment landmark; no gameplay gate invented.'},
    {id:'gw_saw',name:'Aion Edge Sawmill',at:[...saw.au],gold_refs:['po_sawaion','rs_1w'],story:'Timber yard supplies the spatial reason for nearby wood resource nodes.'},
  );
  const greywater={
    id:'flagship_greywater_tideworks',gold_poi:'po_greywater',name:'Greywater Tideworks',
    discipline:'OPEN',anchor:gw.au,anchors:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,v.au])),
    patches:patches.filter(p=>p.id.startsWith('gw_')),structures:structures.filter(s=>s.id.startsWith('gw_')),props:props.filter(p=>p.id.startsWith('gw_')),landmarks,
    functional_zones:[
      {name:'Working quay',ref:'dk_grey_s',function:'dock, crates, barrels, freight staging'},
      {name:'Tide mill',ref:'po_greywater',function:'water-driven production exterior and interior'},
      {name:'Filter house',ref:'po_pumphouse',function:'water-treatment landmark and service lane'},
      {name:'Market / loading plaza',ref:'rd_9',function:'cart turnaround, junction, player orientation'},
      {name:'Timber yard',ref:'po_sawaion',function:'log sorting, cart loading, wood-resource context'},
      {name:'Residential lane',ref:'po_greywater',function:'scale, shelter, secondary paths'},
    ],
    routes:[
      {id:'north_landing',mode:'foot',gold_refs:['rd_29','dk_grey_n'],purpose:'retreat / approach via GOLD north landing'},
      {id:'cart_freight',mode:'cart_candidate',gold_refs:['rd_9','rd_a','br_3'],purpose:'cart-width road and bridge approach'},
      {id:'forest_trail',mode:'foot',gold_refs:['rd_13','po_glade','po_sawaion'],purpose:'off-road exploration and retreat'},
      {id:'river_detour',mode:'foot',gold_refs:['rd_20','rd_1w','rd_1x'],purpose:'riverside alternate route'},
    ],
    build_sites:[
      {id:'bs_gw_roadside',kind:'road-adjacent',rect:fit(world,gw.tx+14,gw.ty+4,8,6,used,false),gold_refs:['rd_9','bz_greywater'],reason:'Fast freight, more passing footprints; candidate geometry only.'},
      {id:'bs_gw_secluded',kind:'secluded_forest',rect:fit(world,saw.tx-10,saw.ty+8,9,7,used,false),gold_refs:['rd_13','po_glade'],reason:'Longer haul, fewer intersections; candidate geometry only.'},
      {id:'bs_gw_defensible',kind:'shore_choke',rect:fit(world,gw.tx-12,gw.ty-10,8,6,used,false),gold_refs:['dk_grey_n','bz_greywater'],reason:'Water and road choke give defensible edges but a longer return; candidate geometry only.'},
    ],
    capability_refs:['C01','C02','C07','C11','C13','C24'],verdict:'SPATIAL_CANDIDATE_ONLY',
  };
  // ---------- Argus Academy: sophisticated exterior + genuine deep multi-level vault ----------
  const ac=anchors.po_academy;const argUsed=[];
  const courtyard=fit(world,ac.tx,ac.ty,10,8,argUsed,true);
  patches.push(groundPatch(world,'argus_courtyard',courtyard,M.PLAZA,['po_academy','rd_19','rd_1a'],'Rounded stone courtyard and exterior approach; GOLD POI anchor stays fixed.','rounded'));
  const academy=fit(world,ac.tx,ac.ty-2,6,4,argUsed,false);
  structures.push(structure('argus_academy','Argus Academy Main Hall',academy,'stone',{building:'bld_academy',gold_refs:['po_academy'],story:'Exterior→interior threshold; vault entrance is a visible door, not a map pin.'}));
  const archive=fit(world,anchors.po_archive.tx,anchors.po_archive.ty,4,3,argUsed,false);
  structures.push(structure('argus_archive_annex','Argus Archive Annex',archive,'stone',{building:'bld_archive',gold_refs:['po_archive'],story:'Above-ground counterpart of the archive stacks below.'}));
  const hall=fit(world,anchors.po_hall_eyes.tx,anchors.po_hall_eyes.ty,3,3,argUsed,false);
  structures.push(structure('argus_hall_eyes','Hall of Eyes',hall,'stone',{building:'bld_hall_eyes',gold_refs:['po_hall_eyes'],story:'Distinct Elder-site exterior landmark retained at GOLD coordinate.'}));
  const observatory=fit(world,anchors.po_observatory.tx,anchors.po_observatory.ty,3,4,argUsed,false);
  structures.push(structure('argus_observatory','Argus Observatory',observatory,'stone',{building:'bld_observatory',gold_refs:['po_observatory'],story:'Highland observatory silhouette visible from the courtyard.'}));
  const lantern=fit(world,anchors.po_lantern.tx,anchors.po_lantern.ty,2,3,argUsed,false);
  structures.push(structure('argus_lantern','Lantern Light',lantern,'stone',{building:'bld_lantern',gold_refs:['po_lantern'],story:'Distant navigation landmark; no quest or unlock is implied.'}));
  const vault=buildVaultLevels();
  const argus={
    id:'flagship_argus_deep_vault',gold_poi:'po_academy',name:'Argus Academy Deep Vault',
    discipline:'DEEP',anchor:ac.au,anchors:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,v.au])),
    patches:patches.filter(p=>p.id.startsWith('argus_')),structures:structures.filter(s=>s.id.startsWith('argus_')),landmarks:vault.levels.flatMap(l=>l.landmarks.map(m=>({...m,level:l.id}))),
    levels:vault.levels,access_graph:{nodes:vault.nodes,edges:vault.edges},
    exterior_zones:[
      {name:'Academy courtyard',ref:'po_academy',function:'orientation, entrance, retreat'},
      {name:'Archive annex',ref:'po_archive',function:'above-ground counterpart to archive level'},
      {name:'Hall of Eyes',ref:'po_hall_eyes',function:'Elder-site landmark'},
      {name:'Observatory',ref:'po_observatory',function:'distant vertical landmark'},
      {name:'Lantern Light',ref:'po_lantern',function:'long-range navigation landmark'},
    ],
    retreat_routes:[
      {id:'primary_return',path:['l2_lens','l2_west','l2_ladder','l1_ladder','l1_lift','l0_lift','ext_courtyard']},
      {id:'emergency_shaft',path:['l2_lens','l2_east','l2_drain','l0_drain','ext_courtyard']},
    ],
    alternate_routes:[
      {id:'main_stair',path:['l0_entry','l0_main_stair','l1_main_stair','l1_cistern']},
      {id:'service_lift',path:['l0_entry','l0_lift','l1_lift','l1_pump']},
    ],
    capability_refs:vault.capability_refs,verdict:'SPATIAL_CANDIDATE_ONLY',
  };
  const allStructures=[...greywater.structures,...argus.structures];
  const allProps=[...greywater.props];
  const allPatches=[...greywater.patches,...argus.patches];
  // POI catalog keeps every GOLD ID; only two have handcrafted flagship overlays.
  const catalog=world.objects.pois.map(p=>({id:p.id,name:p.name,gold_at:p.at,arche:p.raw.arche,flagship:p.id===gw?'greywater':p.id===ac?'argus':null,overlay:p.id===gw?greywater.id:p.id===ac?argus.id:null,status:p.id===gw||p.id===ac?'HANDCRAFTED_CANDIDATE':'GOLD_ANCHOR_PRESERVED'}));
  return {greywater,argus,structures:allStructures,props:allProps,patches:allPatches,catalog,anchors:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,{au:v.au,tile:[v.tx,v.ty]}])),vault_meta:vault};
}
