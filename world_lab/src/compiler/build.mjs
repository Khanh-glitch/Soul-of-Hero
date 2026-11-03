// Reproducible build: GOLD -> compiled world -> POI overlays -> ecology variants -> data/QA/captures.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync,execSync} from 'node:child_process';
import {loadGold,compileGold,SCALE,auToPx,auToTile,M} from './gold.mjs';
import {buildFlagshipPOIs} from './poi.mjs';
import {buildEcology} from './ecology.mjs';
import {makeCollision,bfs} from '../lib/movement.mjs';
const ROOT=process.cwd(),REPO=path.resolve(ROOT,'..'),DATA=path.join(ROOT,'data');
fs.mkdirSync(DATA,{recursive:true});
const ser=(o)=>JSON.stringify(o,(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v,2);
const write=(p,o)=>fs.writeFileSync(path.join(ROOT,p),typeof o==='string'?o:ser(o));
const shaFile=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const shaObj=o=>crypto.createHash('sha256').update(typeof o==='string'?o:ser(o)).digest('hex');
function git(cmd){try{return execSync(`git -C "${REPO}" ${cmd}`,{encoding:'utf8'}).trim();}catch(e){return '';}}
function editsPath(){const a=process.argv.find(x=>x.startsWith('--edits='));return a?a.slice(8):path.join(DATA,'creator_edits.json');}
function loadEdits(){const p=editsPath();if(fs.existsSync(p))return JSON.parse(fs.readFileSync(p,'utf8'));return {version:1,lockedRegions:[],lockedEdits:[],edits:[]};}
function mergeLocked(A,B,edits){
  const propEdits=(edits.edits||[]).filter(e=>e.kind==='prop'&&e.prop).map(e=>e.prop);
  const lockedIds=new Set(edits.lockedEdits||[]),lockedRegions=new Set(edits.lockedRegions||[]);
  const apply=(base,other)=>{
    const map=new Map(base.props.map(p=>[p.id,p]));
    for(const p of propEdits)map.set(p.id,p);
    if(other){for(const p of other.props)if(lockedIds.has(p.id)||lockedRegions.has(p.region))map.set(p.id,p);}
    base.props=[...map.values()];
  };
  apply(A,null);apply(B,A);
  B.props=B.props.filter(p=>!(lockedIds.has(p.id)||lockedRegions.has(p.region))||A.props.some(q=>q.id===p.id));
  return {A,B};
}
function center(au){return {x:Math.round(auToTile(au[0]))*16+8,y:Math.round(auToTile(au[1]))*16+8};}
function nearestWalkable(c,au){const tx0=Math.round(auToTile(au[0])),ty0=Math.round(auToTile(au[1]));for(let r=0;r<=12;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const tx=tx0+dx,ty=ty0+dy;if(tx<0||ty<0||tx>=c.W||ty>=c.H)continue;if(c.grid[ty*c.W+tx]===0)return [tx*SCALE.unitsPerTile,ty*SCALE.unitsPerTile];}return au;}
function routeBetween(c,a,b){
  const p=bfs(c,center(a),center(b));
  if(!p)return null;
  let len=0;for(let i=1;i<p.length;i++)len+=Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y);
  const refs=new Set();for(const q of p){const k=Math.floor(q.y/16)*c.W+Math.floor(q.x/16);if(worldRefs[k])for(const r of worldRefs[k])refs.add(r);}
  return {path:p,length_px:Math.round(len),travel_time_proposal_seconds:+(len/SCALE.playerSpeedPxPerSec).toFixed(2),steps:p.length-1,refs:[...refs].slice(0,40)};
}
let worldRefs={};
function main(){
  console.log('[1/7] generating pixel atlases');
  execFileSync(process.execPath,['src/render/assets.mjs'],{cwd:ROOT,stdio:'inherit'});
  console.log('[2/7] loading authoritative GOLD + edits');
  const goldPath=path.join(ROOT,'src/gold/VEYRA_GOLD_MAP.sohmap.json');
  const gold=loadGold(goldPath),edits=loadEdits();
  const A=compileGold(gold,{variant:'A',edits}),B=compileGold(gold,{variant:'B',edits});
  const compilerBaseHashA=shaObj(A),compilerBaseHashB=shaObj(B);
  worldRefs=A.refs;
  console.log('[3/7] handcrafting paired flagship POIs');
  const poiA=buildFlagshipPOIs(A),poiB=buildFlagshipPOIs(B);
  console.log('[4/7] generating ecology variants');
  let ecologyA=buildEcology(A,poiA,{variant:'A'}),ecologyB=buildEcology(B,poiB,{variant:'B'});
  ({A:ecologyA,B:ecologyB}=mergeLocked(ecologyA,ecologyB,edits));
  const worldOut={meta:A.meta,grid:A.grid,material:A.material,collision:A.collision,flags:A.flags,refs:A.refs,terrain:A.terrain,objects:A.objects,goldIndex:A.goldIndex,appliedEdits:A.appliedEdits};
  const poiOut={greywater:poiA.greywater,argus:poiA.argus,structures:poiA.structures,props:poiA.props,patches:poiA.patches,catalog:poiA.catalog,anchors:poiA.anchors};
  console.log('[5/7] writing deterministic data');
  write('data/world_base.json',worldOut);
  write('data/poi_overlays.json',poiOut);
  write('data/poi_catalog.json',poiA.catalog);
  write('data/ecology_A.json',ecologyA);
  write('data/ecology_B.json',ecologyB);
  write('data/resource_proposals.json',{meta:{authority:'A3/Gameplay',status:'PROPOSED_PLACEMENT_ONLY',no_yields:true},proposals:ecologyA.resourceProposals});
  write('data/edits_template.json',{version:1,lockedRegions:[],lockedEdits:[],edits:[]});
  if(!fs.existsSync(path.join(DATA,'creator_edits.json')))write('data/creator_edits.json',{version:1,lockedRegions:[],lockedEdits:[],edits:[]});
  // Exact source manifest, branch and commit IDs, fingerprints.
  const sourceFiles=[];
  for(const dir of ['src/gold','assets/source','assets/generated']){
    for(const f of fs.readdirSync(path.join(ROOT,dir))){const p=path.join(ROOT,dir,f);if(fs.statSync(p).isFile())sourceFiles.push({path:path.relative(ROOT,p),bytes:fs.statSync(p).size,sha256:shaFile(p)});}
  }
  const rawPackSha={
    '200380-farm-plants.zip':'ed98e53cea1bb597cde92e68e3d8a4fe0cc41115d400bf642e0299a9e53284c4',
    '351300-island.zip':'0b436bf4193dd116bb1b16c084f4df5bcaa4d284d33655e49b98e8fffeb3d59b',
    '574220-roads-reference-only.zip':'302e8fa1da79163d2cd9da5ddfd7610bb0186b16de7f959b7d9a09ee4763e43c',
    '665131-fields.zip':'697a7addd4503a3d3d2feb5c23bba5b3d4b9dac66db3e709cb4217595d3c7242',
    '668008-bridges.zip':'ad6d46007fea5972794a26d190879d9049405fa3baf1c17874991a634d875e86',
  };
  const manifest={
    generated:new Date().toISOString(),branch:git('rev-parse --abbrev-ref HEAD'),local_head:git('rev-parse HEAD'),
    source_branches:{
      gold:{name:'map/veyra-gold-asset-canon-20261102',head:git('rev-parse origin/map/veyra-gold-asset-canon-20261102')||'19d8c6ec820f324a6ac12733165e43b5e2c6eab2'},
      prototypes:{name:'references/gameplay-prototypes-20261102',head:git('rev-parse origin/references/gameplay-prototypes-20261102')||'7a1c53acfc5b7cda6cb34ea3f348b4e100744354'},
      bible_commit:'a8c718b55130cff29b3adc5e7c531f9211ca22df',
    },
    gold_sha256:gold.sha,gold_bytes:gold.bytes,raw_pack_sha256:rawPackSha,
    private_APEX_CHAOS:'inaccessible with current auth (403); 42/43 inventory recorded in EXISTING_ASSET_GIT_SOURCES.json but blobs not available',
    sourceTrees:{gold:'data/source_tree_gold.txt',prototypes:'data/source_tree_prototype.txt'},
    files:sourceFiles,
    generated_outputs:['data/world_base.json','data/poi_overlays.json','data/poi_catalog.json','data/ecology_A.json','data/ecology_B.json','data/resource_proposals.json','assets/generated/terrain_atlas.png','assets/generated/props_atlas.png','assets/generated/asset_manifest.json'],
    notes:'P0-P5 ZIPs are experimental donors, not production authority. Creator confirmed relevant asset rights; selected public-branch donors and licenses are staged under assets/source.',
  };
  write('data/source_manifest.json',manifest);
  // Route candidates using actual compiled collision + structure/prop colliders.
  const c=makeCollision(A,{structures:poiA.structures,props:ecologyA.props});
  const anchors=Object.fromEntries(Object.entries(poiA.anchors).map(([k,v])=>[k,v.au]));
  const paired=[];let ok=true;
  for(const [a,b] of [['sp_lake','po_greywater'],['po_greywater','po_pumphouse'],['po_pumphouse','po_sawaion'],['po_sawaion','po_academy']]){
    const r=routeBetween(c,anchors[a],anchors[b]);if(!r){ok=false;paired.push({from:a,to:b,error:'NO_WALKABLE_PATH'});}else paired.push({from:a,to:b,...r});
  }
  const full=routeBetween(c,anchors.sp_lake,anchors.po_academy);
  write('data/paired_route.json',{id:'paired_greywater_argus',start:'sp_lake',waypoints:['po_greywater','po_pumphouse','po_sawaion','po_academy'],segments:paired,full_path:full,all_segments_walkable:ok,verdict:'SPATIAL_CANDIDATE_ONLY',travel_note:'Seconds are review-tool proposals at 88 px/s, NOT canon gameplay speed.'});
  // Early survival routes: GOLD IDs only; no invented source or yield.
  const early=[];for(const s of A.objects.spawns){
    const need=['wood','stone','food','fresh_water'],found={};
    for(const kind of need){let best=null;for(const r of A.objects.resources){if(r.raw.kind!==kind)continue;const d=Math.hypot(r.at[0]-s.at[0],r.at[1]-s.at[1]);if(!best||d<best.d)best={r,d};}
      if(best){const goalAu=nearestWalkable(c,best.r.at),route=routeBetween(c,s.at,goalAu);found[kind]={source_id:best.r.id,gold_kind:best.r.raw.kind,distance_au:+best.d.toFixed(1),walkable:!!route,travel_time_proposal_seconds:route?.travel_time_proposal_seconds??null,approach_au:goalAu,note:goalAu!==best.r.at?'GOLD source is in water; route targets adjacent walkable shore':null};}
    }
    early.push({spawn_id:s.id,spawn_at:s.at,found,verdict:'GOLD_SOURCE_REACHABILITY_CANDIDATE'});
  }
  write('data/early_survival_routes.json',{meta:{authority:'A1 geometry; A3/Gameplay owns yields and stock',no_invented_yields:true},routes:early});
  const fingerprint={
    world_base:shaObj(worldOut),poi_overlays:shaObj(poiOut),ecology_A:shaObj(ecologyA),ecology_B:shaObj(ecologyB),
    terrain_atlas:shaFile(path.join(ROOT,'assets/generated/terrain_atlas.png')),props_atlas:shaFile(path.join(ROOT,'assets/generated/props_atlas.png')),asset_manifest:shaFile(path.join(ROOT,'assets/generated/asset_manifest.json')),
    gold:gold.sha,branch:manifest.branch,head:manifest.local_head,compiler_base_hash:compilerBaseHashA,compiler_base_hash_B:compilerBaseHashB,
  };
  write('data/build_fingerprint.json',fingerprint);
  console.log('[6/7] capturing real 640x360 1x screenshots');
  return import('../render/capture.mjs').then(({captureAll})=>{
    const shots=captureAll();console.log('captured',shots.length,'screenshots');
    console.log('[7/7] running independent QA');
    return import('../tools/qa.mjs').then(({runQA})=>runQA({gold,world:A,poi:poiA,ecologyA,ecologyB,edits,fingerprint,shots}));
  }).then(q=>{
    console.log('BUILD COMPLETE',JSON.stringify({verdict:q.verdict,tests:q.summary},null,2));
  });
}
main().catch(e=>{console.error(e);process.exit(1)});
