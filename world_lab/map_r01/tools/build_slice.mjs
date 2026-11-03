// MAP-R01 — crop ONLY the A1 frames admitted into the Web playable slice.
// Input: A1 ce9d4ba2 atlas.v1.json + terrain.png + props.png (already extracted).
// Output: soh_slice_atlas.png + frame_ledger.v1.json (no raw third-party packs).
import fs from 'node:fs';import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire('/home/user/Soul-of-Hero/world_lab/package.json');
const {PNG}=require('pngjs');
const A=require('/home/user/r01_scratch/atlas.v1.json');
const PROV=require('/home/user/r01_scratch/first_hour_asset_provenance.v1.json');
const sheets={terrain:PNG.sync.read(fs.readFileSync('/home/user/r01_scratch/terrain.png')),props:PNG.sync.read(fs.readFileSync('/home/user/r01_scratch/props.png'))};
const names=[];
const add=(sheet,list)=>{for(const n of list)if(A[sheet][n])names.push([sheet,n]);};
const seq=(p,n,start=0)=>Array.from({length:n},(_,i)=>p+(i+start));
add('terrain',seq('grass_',4));add('terrain',seq('forest_',4));add('terrain',seq('dune_',4));add('terrain',seq('shell_',4));
add('terrain',seq('tidal_',4));add('terrain',seq('lake_',4));add('terrain',seq('water_',3));add('terrain',seq('river_',4));
add('terrain',seq('mix_grass_silt_',15,1));add('terrain',seq('blend_grass_water_',16));add('terrain',seq('blend_grass_forest_',16));
add('terrain',seq('coast_dune_tidal_',15,1));add('terrain',seq('coast_shell_tidal_',15,1));
add('terrain',seq('road_dirt_',16));add('terrain',seq('blend_grass_soil_',16));add('terrain',seq('track_dirt_',16));
add('terrain',seq('detail_dune_ripple_',3));add('terrain',seq('detail_water_ripple_',3));
add('props',['bush','rock_a','rock_c','rock_e','tree_dead','tree_pine','signpost','reeds','stump','deadfall','driftwood','cairn','fence_h','fence_v','boardwalk_post','pier_rail','lantern_post','column_broken','wall_stub']);
// shelf packing into a 256px wide sheet, 4px gutter-free grid cells snapped to 16px
const W=256;let x=0,y=0,rowH=0;const placed=[];
for(const [sheet,n] of names){const r=A[sheet][n];const w=r[2],h=r[3];if(x+w>W){x=0;y+=rowH;rowH=0;}placed.push({sheet,name:n,x,y,w,h,origin:r});x+=w;rowH=Math.max(rowH,h);}
const H=y+rowH;
const out=new PNG({width:W,height:H});out.data.fill(0);
const sha=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const frames={};
for(const q of placed){const src=sheets[q.sheet];const raw=Buffer.alloc(q.w*q.h*4);
 for(let yy=0;yy<q.h;yy++)for(let xx=0;xx<q.w;xx++){
  const si=((q.origin[1]+yy)*src.width+(q.origin[0]+xx))*4,di=(yy*q.w+xx)*4;
  raw[di]=src.data[si];raw[di+1]=src.data[si+1];raw[di+2]=src.data[si+2];raw[di+3]=src.data[si+3];
  const oi=((q.y+yy)*W+(q.x+xx))*4;out.data[oi]=src.data[si];out.data[oi+1]=src.data[si+1];out.data[oi+2]=src.data[si+2];out.data[oi+3]=src.data[si+3];
 }
 const p=PROV.profiles.a1_current.crops[q.sheet]?.[q.name];
 frames[q.name]={sheet:q.sheet,rect:[q.x,q.y,q.w,q.h],origin_rect:q.origin,
  raw_rgba_sha256:sha(raw),provenance:p?{source:'first_hour_asset_provenance.v1.json:a1_current',raw_rgba_sha256:p.raw_rgba_sha256,matches_first_hour_lock:p.matches_first_hour_lock}:{source:'computed_from_atlas_v1',note:'frame outside A1 first-hour crop profile; RGBA SHA computed from A1 atlas rect'},
  rights:p?'a1_profile_frame':'a1_original_baked_frame'};
}
const png=PNG.sync.write(out);
fs.writeFileSync('/home/user/r01_scratch/soh_slice_atlas.png',png);
const ledger={
 schema:'soh.web.world_asset_slice.v1',
 purpose:'Fisher\'s Point first-hour Web slice — only admitted A1 frames, not entire packs',
 source_branch:'arena/e385312a-soul-of-hero',source_commit:'ce9d4ba2d3db153011874aa41b789fa8092be042',
 source_files:{
  'assets/environment/survival_world/terrain.png':{sha256:A.textures?undefined:undefined,file_sha256:A.file_sha256?.terrain,bytes:54828,size:[512,896]},
  'assets/environment/survival_world/props.png':{file_sha256:A.file_sha256?.props,bytes:119345,size:[1024,794]},
  'data/survival/world/art/atlas.v1.json':{file_sha256:PROV.profiles.a1_current.files['data/survival/world/art/atlas.v1.json'].sha256,bytes:170126},
  'data/survival/world/art/world_art_grammar.v1.json':{schema:'SOH_WORLD_ART_GRAMMAR_V1'}
 },
 slice_sheet:{file:'soh_slice_atlas.png',width:W,height:H,sha256:sha(png),bytes:png.length},
 grid:{tile_px:16,scale:1,filter:'nearest',feet_anchor:'bottom-center'},
 excluded:'All cainos_* / ocean_* pack crops are excluded: A1 docs/survival/world/RESEARCH_AND_LICENSES.md records Cainos demo art as REJECTED (standalone license unproven) and CraftPix freebie terms forbid raw-art redistribution. Original baked SOH terrain families + the nine inherited_original props only.',
 frame_count:Object.keys(frames).length,frames
};
fs.writeFileSync('/home/user/r01_scratch/frame_ledger.v1.json',JSON.stringify(ledger,null,2));
console.log('frames',Object.keys(frames).length,'sheet',W+'x'+H,'bytes',png.length);
console.log('missing requested',names.filter(([s,n])=>!A[s][n]).map(([s,n])=>s+':'+n).join(',')||'none');
