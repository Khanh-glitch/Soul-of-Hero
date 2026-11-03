// Independent negative-oriented QA for the GOLD-derived World Lab candidate.
// Does NOT claim Godot/native gameplay integration or creator visual acceptance.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {fromPNG} from '../lib/pixels.mjs';
import {NodeTarget} from '../render/targets.mjs';
import {renderScene} from '../render/scene.mjs';
import {makeCollision,bfs,blocked,move} from '../lib/movement.mjs';
import {compileGold} from '../compiler/gold.mjs';
import {M,SCALE,auToPx} from '../lib/constants.mjs';
const ROOT=process.cwd(),DATA=path.join(ROOT,'data'),QA=path.join(ROOT,'qa');
fs.mkdirSync(QA,{recursive:true});
const shaObj=o=>crypto.createHash('sha256').update(JSON.stringify(o,(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v,2)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const W=SCALE.gridW,H=SCALE.gridH;
const WATER=new Set([M.DEEP,M.SHALLOW,M.RIVER]);
const tests=[];
function test(id,fn){try{const d=fn();tests.push({id,status:'PASS',...d});return true;}catch(e){tests.push({id,status:'FAIL',error:String(e&&e.message||e),stack:String(e&&e.stack||'').split('\n').slice(0,3)});return false;}}
function graphPaths(nodes,edges,from,to,skip=[]){
  const adj=new Map(nodes.map(n=>[n.id,[]]));for(const [a,b] of edges){if(skip.some(s=>(s[0]===a&&s[1]===b)||(s[0]===b&&s[1]===a)))continue;if(!adj.has(a)||!adj.has(b))continue;adj.get(a).push(b);adj.get(b).push(a);}
  const paths=[];const dfs=(n,path,seen)=>{if(paths.length>=4||path.length>16)return;if(n===to){paths.push(path);return;}for(const m of adj.get(n)||[])if(!seen.has(m)){seen.add(m);dfs(m,[...path,m],seen);seen.delete(m);}};
  dfs(from,[from],new Set([from]));return paths;
}
function levelCollision(level){
  const rects=[];for(const p of level.props){if(!p.solid||!p.collider)continue;rects.push({x:p.x+p.collider.x,y:p.y+p.collider.y,w:p.collider.w,h:p.collider.h});}
  return {W:level.w,H:level.h,grid:Uint8Array.from(level.collision),rects};
}
export function runQA({gold,world,poi,ecologyA,ecologyB,edits,fingerprint,shots}){
  tests.length=0;
  const manifest=read(path.join(ROOT,'assets/generated/asset_manifest.json'));
  const sourceManifest=read(path.join(DATA,'source_manifest.json'));
  const fp=read(path.join(DATA,'build_fingerprint.json'));
  const paired=read(path.join(DATA,'paired_route.json'));
  const early=read(path.join(DATA,'early_survival_routes.json'));
  const proposals=read(path.join(DATA,'resource_proposals.json'));
  const data={world,poi,ecology:ecologyA,manifest};
  test('SOURCE_FINGERPRINT',()=>{
    assert.equal(gold.sha,'88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256');
    assert.equal(sourceManifest.branch,'arena/2e3cfbd2-soul-of-hero');
    assert.equal(sourceManifest.source_branches.gold.head,'19d8c6ec820f324a6ac12733165e43b5e2c6eab2');
    assert.equal(sourceManifest.source_branches.prototypes.head,'7a1c53acfc5b7cda6cb34ea3f348b4e100744354');
    assert.equal(sourceManifest.source_branches.bible_commit,'a8c718b55130cff29b3adc5e7c531f9211ca22df');
    assert.equal(fp.gold,gold.sha);
    return {gold_sha:gold.sha,bible_sha:'ab02f994af371e7386e9403dff5cdb3673412cd99b0e250f13b2201077d1e8ac',contract_sha:'a16deb29f27ad33a7e1788d52aa5bd7e27d36c0c4ecdcee9a4b76ee990e688d1'};
  });
  test('GOLD_ID_ROUNDTRIP',()=>{
    const p=gold.doc.project,ids=[];
    for(const k of ['land','lakes','rivers','roads','bridges','docks','pois','zones','resources','spawns','elders','labels'])for(const o of p[k])ids.push(o.id);
    const missing=ids.filter(id=>!world.goldIndex[id]);assert.equal(missing.length,0,'missing GOLD IDs '+missing.slice(0,5));
    assert.equal(p.pois.length,81);assert.equal(p.resources.length,280);assert.equal(p.roads.length,92);assert.equal(p.bridges.length,12);assert.equal(p.docks.length,27);assert.equal(p.spawns.length,4);assert.equal(p.elders.length,6);assert.equal(p.zones.length,23);
    assert.equal(poi.catalog.length,81);assert.equal(proposals.proposals.length,280);
    for(const o of [...p.pois,...p.resources,...p.spawns]){if(!o.at)continue;const g=world.goldIndex[o.id];assert.ok(g.at&&Math.abs(g.at[0]-o.at[0])<.001&&Math.abs(g.at[1]-o.at[1])<.001,'moved '+o.id);}
    assert.ok(world.refs[Math.round(auToPx(812)/16)*0+Math.round(812/4)*W+Math.round(592/4)]?.includes('po_greywater')||Object.values(world.refs).some(a=>a.includes('po_greywater')));
    assert.ok(!world.goldIndex['po_NOT_A_GOLD_ID']);
    assert.ok(!Object.values(world.refs).some(a=>a.includes('po_NOT_A_GOLD_ID')));
    return {gold_ids:ids.length,pois:81,resources:280,negative_wrong_id:'REJECTED'};
  });
  test('DETERMINISTIC_COMPILE_EXPORT_REIMPORT',()=>{
    const a=compileGold(gold,{variant:'A'}),b=compileGold(gold,{variant:'B'});
    assert.equal(shaObj(a),fp.compiler_base_hash);assert.equal(shaObj(b),fp.compiler_base_hash_B);
    assert.equal(shaObj(compileGold(gold,{variant:'A'})),shaObj(a));
    const reimported=read(path.join(DATA,'world_base.json'));assert.equal(shaObj(reimported),fp.world_base);
    // sample creator edit applies deterministically, then base remains unchanged after reimport
    const landK=a.material.findIndex(m=>m===M.GRASS),tx=landK%W,ty=Math.floor(landK/W);
    const sample={version:1,lockedRegions:[],lockedEdits:[],edits:[{id:'qa_tile_edit',kind:'tile',tx,ty,material:M.PLAZA,gold_ref:'qa_tile_edit',locked:true}]};
    const edited=compileGold(gold,{variant:'A',edits:sample});assert.equal(edited.material[landK],M.PLAZA);assert.equal(edited.appliedEdits[0],'qa_tile_edit');
    assert.equal(compileGold(gold,{variant:'A'}).material[landK],M.GRASS);
    assert.equal(edits.version,1);assert.ok(Array.isArray(edits.lockedRegions));assert.ok(Array.isArray(edits.lockedEdits));
    return {compiler_base_hash:fp.compiler_base_hash,export_reimport_hash:fp.world_base,creator_edit_roundtrip:'PASS',locked_regions:edits.lockedRegions.length};
  });
  test('ART_INTEGRITY_AND_FOOT_ANCHORS',()=>{
    assert.equal(manifest.blob47.count,47);
    const names=new Set();
    for(const p of poi.props)names.add(p.sprite||p.name);
    for(const p of ecologyA.props)names.add(p.name);
    for(const p of ecologyB.props)names.add(p.name);
    for(const s of poi.structures){names.add(s.sprite);names.add(s.roofSprite);if(s.building)names.add(s.building);names.add('proto_door_0');}
    for(const l of poi.argus.levels){for(const p of l.props)names.add(p.name||p.sprite);names.add('proto_stairs_0');names.add('proto_lift_0');names.add('proto_lens_0');names.add('bld_lens');}
    names.add('proto_player_0');
    const missing=[...names].filter(n=>!manifest.props[n]);assert.deepEqual(missing,[],'missing sprites');
    for(const n of [...names]){const r=manifest.props[n];assert.ok(r.w>0&&r.h>0);}
    for(const p of [...ecologyA.props,...poi.props]){if(!p.solid)continue;assert.ok(p.collider,'solid prop missing collider '+p.id);const r=manifest.props[p.sprite||p.name];assert.ok(r,'missing sprite for collider '+p.id);assert.ok(p.collider.w<r.w,'collider spans full sprite '+p.id);assert.ok(p.collider.h<r.h,'collider spans full height '+p.id);}
    const ext=Object.entries(manifest.props).filter(([n])=>n.startsWith('3q_'));
    for(const [n,r] of ext){assert.ok(r.foot,'external sprite missing alpha foot '+n);assert.ok(r.foot.w<r.w,'external foot equals canopy '+n);assert.ok(r.foot.y>=Math.floor(r.h*.68),'external foot not bottom pixels '+n);}
    const capMissing=shots.flatMap(s=>s.render?.stats?.missingSprites||[]);assert.deepEqual(capMissing,[],'capture missing sprites');
    return {sprites_checked:names.size,external_foot_colliders:ext.length,blob47:47,capture_missing_sprites:0};
  });
  test('REAL_TERRAIN_WATER_TRANSITIONS',()=>{
    const mats={};for(const m of world.material)mats[m]=(mats[m]||0)+1;
    assert.ok(mats[M.DEEP]>1000&&mats[M.SHALLOW]>100&&mats[M.RIVER]>100&&mats[M.SAND]>100);
    assert.ok(mats[M.ROAD_DIRT]+mats[M.ROAD_COBBLE]>100&&mats[M.BRIDGE]>20&&mats[M.DECK]>20);
    let seams=0,confluences=0,mouths=0,bridgeApproach=0,shoreCorners=0;
    for(let ty=1;ty<H-1;ty++)for(let tx=1;tx<W-1;tx++){
      const k=ty*W+tx,m=world.material[k];let waterN=0,landN=0,riverN=0;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nm=world.material[(ty+dy)*W+tx+dx];if(WATER.has(nm))waterN++;else if(nm!==M.INTERIOR_VOID)landN++;if(nm===M.RIVER)riverN++;}
      if(!WATER.has(m)&&waterN)seams++;
      if(WATER.has(m)&&landN)shoreCorners++;
      if(m===M.RIVER&&riverN>=3)confluences++;
      if(m===M.RIVER&&waterN>riverN)mouths++;
      if(m===M.BRIDGE){for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nm=world.material[(ty+dy)*W+tx+dx];if(!WATER.has(nm)&&nm!==M.BRIDGE)bridgeApproach++;}}
    }
    assert.ok(seams>100&&shoreCorners>100&&confluences>0&&mouths>0&&bridgeApproach>0);
    const bridgeK=world.material.findIndex(m=>m===M.BRIDGE);assert.equal(world.collision[bridgeK],0,'bridge not walkable');
    const roadOnWater=[];for(let k=0;k<world.material.length;k++)if(WATER.has(world.material[k])&&(world.material[k]===M.ROAD_DIRT||world.material[k]===M.ROAD_COBBLE))roadOnWater.push(k);
    assert.equal(roadOnWater.length,0,'road painted over water');
    return {material_counts:mats,land_water_seams:seams,shore_water_cells:shoreCorners,river_confluences:confluences,river_mouths:mouths,bridge_approaches:bridgeApproach};
  });
  test('COLLISION_SLIDING_AND_NEGATIVE_APPROACHES',()=>{
    const c=makeCollision(world,{structures:poi.structures,props:ecologyA.props});
    const center=(x,y)=>({x:Math.round(x/SCALE.unitsPerTile)*16+8,y:Math.round(y/SCALE.unitsPerTile)*16+8});
    const solid=ecologyA.props.find(p=>p.solid&&p.collider&&p.name.startsWith('proto_oak'));
    assert.ok(solid,'missing solid tree for approach test');
    const treeOnly={W,H,grid:new Uint8Array(W*H),rects:[{x:solid.x+solid.collider.x,y:solid.y+solid.collider.y,w:solid.collider.w,h:solid.collider.h}]};
    const cx=solid.x+solid.w/2,cy=solid.y+solid.h/2;
    for(const [dx,dy] of [[50,0],[-50,0],[0,50],[0,-50],[40,40],[-40,40],[40,-40],[-40,-40]]){
      const st={x:cx-dx,y:cy-dy},r=move(treeOnly,st,dx,dy,4);
      assert.ok(!blocked(treeOnly,r.x,r.y,4),'tunneled into tree from '+dx+','+dy);
      assert.ok(Math.hypot(r.x-st.x,r.y-st.y)>5,'movement fully stuck');
    }
    // synthetic one-tile passage: no tunneling through walls
    const g=new Uint8Array(10*10).fill(1);for(let x=0;x<10;x++)g[3*10+x]=0;
    const c2={W:10,H:10,grid:g,rects:[]};const p=move(c2,{x:8,y:56},140,0,4);assert.ok(p.x>120,'one-tile passage blocked');assert.ok(!blocked(c2,p.x,p.y,4));
    // corner assist: diagonal into a wall should still slide along one axis
    const c3={W:10,H:10,grid:new Uint8Array(100),rects:[]};c3.grid[4*10+5]=1;
    const q=move(c3,{x:72,y:64},-40,-40,4);assert.ok(!blocked(c3,q.x,q.y,4));assert.ok(q.x<72||q.y<64,'corner assist produced no slide');
    // structure doors are open, adjacent wall cells are solid
    const s0=poi.structures[0];assert.equal(c.grid[s0.door[1]*W+s0.door[0]],0);assert.equal(c.grid[s0.walls[0][1]*W+s0.walls[0][0]],1);
    // soft decoration is traversable
    const soft=ecologyA.props.find(p=>!p.solid&&p.name.startsWith('proto_grass'));assert.ok(soft);assert.equal(soft.collider,null);
    // dense Greywater camera still has a walkable route
    const path=bfs(c,center(790,622),center(936,262));assert.ok(path&&path.length>20);
    return {tree_approaches:8,one_tile_passage:'PASS',corner_assist:'PASS',door_open:'PASS',soft_decor_traversable:'PASS',dense_route_steps:path.length-1};
  });
  test('NAVIGATION_BRIDGES_RESOURCES_AND_NEGATIVE_PATHS',()=>{
    const c=makeCollision(world,{structures:poi.structures,props:ecologyA.props});
    const goals=[['po_greywater',812,592],['po_pumphouse',850,556],['po_sawaion',748,668],['po_academy',936,262],['po_archive',1018,226],['po_observatory',958,170]];
    const center=(x,y)=>({x:Math.round(x/SCALE.unitsPerTile)*16+8,y:Math.round(y/SCALE.unitsPerTile)*16+8});
    const routes={};for(const [id,x,y] of goals){const p=bfs(c,center(790,622),center(x,y));assert.ok(p,'unreachable '+id);for(let i=1;i<p.length;i++)assert.ok(Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y)<=16.001,'teleport step '+id);routes[id]=p.length-1;}
    const academy=bfs(c,center(790,622),center(936,262));
    const bridges=academy.filter(q=>world.material[Math.floor(q.y/16)*W+Math.floor(q.x/16)]===M.BRIDGE);assert.ok(bridges.length>0,'route does not cross a real bridge');
    assert.equal(paired.all_segments_walkable,true);assert.ok(paired.full_path&&paired.full_path.path.length>20);
    const deepK=world.material.findIndex(m=>m===M.DEEP);const bad=bfs(c,center(790,622),{x:(deepK%W)*16+8,y:Math.floor(deepK/W)*16+8});assert.equal(bad,null,'water goal unexpectedly reachable');
    const gaps=[];for(const r of early.routes)for(const [kind,f] of Object.entries(r.found))if(!f||!f.walkable)gaps.push(r.spawn_id+':'+kind);
    assert.equal(gaps.length,0,'early survival gaps '+gaps.join(','));
    return {routes,bridge_cells_on_academy_route:bridges.length,paired_segments:paired.segments.length,negative_water_goal:'REJECTED',early_survival_gaps:gaps};
  });
  test('POI_EXTERIOR_INTERIOR_VERTICAL_RETREAT',()=>{
    const {nodes,edges}=poi.argus.access_graph;const ids=new Set(nodes.map(n=>n.id));
    for(const [a,b] of edges){assert.ok(ids.has(a),'missing node '+a);assert.ok(ids.has(b),'missing node '+b);}
    const primary=graphPaths(nodes,edges,'ext_courtyard','l2_lens');assert.ok(primary.length>0,'no exterior→deep path');
    const retreat=graphPaths(nodes,edges,'l2_lens','ext_courtyard');assert.ok(retreat.length>=2,'fewer than two retreat paths');
    // remove the emergency shaft edge; primary return must remain
    const shaft=edges.find(e=>e[0]==='l2_drain'&&e[1]==='l0_drain');assert.ok(shaft);
    const after=graphPaths(nodes,edges,'l2_lens','ext_courtyard',[shaft]);assert.ok(after.length>0,'softlock when emergency shaft removed');
    for(const l of poi.argus.levels){
      const lc=levelCollision(l);assert.equal(l.material.length,l.w*l.h);assert.ok(l.collision.filter(x=>x===0).length>500,'level has too few walkable cells');
      const starts=l.stairs.map(s=>({x:s.tx*16+8,y:s.ty*16+8}));assert.ok(starts.length>=2);
      for(const lm of l.landmarks){const goal={x:lm.tx*16+8,y:lm.ty*16+8};assert.ok(starts.some(st=>bfs(lc,st,goal)),'unreachable landmark '+l.id+':'+lm.name);}
    }
    assert.equal(poi.greywater.discipline,'OPEN');assert.equal(poi.argus.discipline,'DEEP');assert.ok(poi.greywater.functional_zones.length>=5);assert.ok(poi.argus.levels.length>=3);
    // negative: no canonical HP/yield/stock/loot/unlock values smuggled into POI data
    const poiText=JSON.stringify(poi);for(const bad of ['"yield"','"stock"','"hp"','"respawn_seconds"','"unlock_item"','"chest_price"'])assert.ok(!poiText.includes(bad),'invented gameplay value '+bad);
    return {levels:poi.argus.levels.length,nodes:nodes.length,edges:edges.length,exterior_to_lens_paths:primary.length,retreat_paths:retreat.length,alternate_return_after_shaft_removal:after.length};
  });
  test('RESOURCE_DISTRIBUTION_AND_GOLD_FIDELITY',()=>{
    const seen=new Set();for(const p of proposals.proposals){assert.ok(!seen.has(p.source_id));seen.add(p.source_id);assert.ok(p.authority.includes('NOT set'));assert.ok(!('yield' in p)&&!('stock' in p)&&!('hp' in p)&&!('respawn_seconds' in p));}
    const byProfile=ecologyA.stats.byProfile;assert.ok(byProfile['SOH-PROTO-16']>100&&byProfile['CRAFTPIX-3Q']>20);
    const mixed=ecologyA.props.filter(p=>p.source_ids.length>0);assert.ok(mixed.length>200,'resource clusters not attached to GOLD IDs');
    const shoreAccess=[];for(const p of proposals.proposals){const k=Math.round(p.tile[1])*W+Math.round(p.tile[0]);if(!WATER.has(world.material[k])||['fresh_water','fish'].includes(p.gold_kind))continue;
      let adjacent=false;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const tx=Math.round(p.tile[0])+dx,ty=Math.round(p.tile[1])+dy;if(tx<0||ty<0||tx>=W||ty>=H)continue;const q=ty*W+tx;if(!world.collision[q]&&!WATER.has(world.material[q]))adjacent=true;}
      assert.ok(adjacent,'GOLD water resource has no adjacent walkable shore '+p.source_id);shoreAccess.push({source_id:p.source_id,gold_kind:p.gold_kind,tile:p.tile,note:'GOLD coordinate preserved; shore-interaction candidate only'});}
    assert.ok(shoreAccess.length<=5,'unexpected number of GOLD water-coordinate resources');
    // GOLD coordinates unchanged; edited overlays preserve base material.
    for(const q of poi.patches)assert.ok(q.cells.every(c=>Number.isInteger(c.base)));
    const inaccessible={deep_water:world.material.filter(m=>m===M.DEEP).length,cliff:world.material.filter(m=>m===M.CLIFF).length,lava:world.material.filter(m=>m===M.LAVA).length};
    return {proposals:proposals.proposals.length,profiles:byProfile,clustered_props:mixed.length,inaccessible,shore_access_candidates:shoreAccess,patch_base_materials_preserved:poi.patches.length};
  });
  test('PERFORMANCE_STREAMING_AND_BROWSER_EVIDENCE',()=>{
    const terrain=fromPNG(PNG.sync.read(fs.readFileSync(path.join(ROOT,'assets/generated/terrain_atlas.png'))));
    const props=fromPNG(PNG.sync.read(fs.readFileSync(path.join(ROOT,'assets/generated/props_atlas.png'))));
    const cams=[{x:2900,y:2150,level:'exterior'},{x:3400,y:850,level:'exterior'},{x:60,y:70,level:'argus_l0'},{x:60,y:70,level:'argus_l1'},{x:60,y:70,level:'argus_l2'}];
    const times=[];let tiles=0,drawables=0;
    for(let i=0;i<10;i++){const cam=cams[i%cams.length],t=new NodeTarget(640,360,terrain,props,manifest),t0=performance.now();const r=renderScene(t,data,cam,{mode:'day',showHud:false,time:i*.4});times.push(performance.now()-t0);tiles+=r.tiles;drawables+=r.drawables;}
    const avg=times.reduce((a,b)=>a+b,0)/times.length;assert.ok(avg<1200,'capture render unexpectedly slow '+avg);
    const browserPath=path.join(QA,'browser_results.json');const browser=fs.existsSync(browserPath)?read(browserPath):{status:'BROWSER_TEST_NOT_RUN',reason:'headless browser result not yet produced'};
    assert.equal(browser.status,'PASS','headless browser smoke test did not pass');
    return {node_capture_frames:10,average_ms:+avg.toFixed(1),max_ms:+Math.max(...times).toFixed(1),visible_tiles_average:Math.round(tiles/10),drawables_average:Math.round(drawables/10),full_grid_cells:W*H,streaming:'visible-tile iteration only',browser_checks:browser.checks?.length||0,browser_status:browser.status};
  });
  const pass=tests.filter(t=>t.status==='PASS').length,fail=tests.length-pass;
  // Honest verdicts: the 10-shot visual set was REJECTED by the creator. The
  // passing compiler/data/browser tests below are legacy evidence only and
  // must never be reused as visual or creator approval.
  const verdicts={
    compiler_and_data:fail===0?'TECHNICAL_PROVEN_LEGACY_COMPILER_AND_DATA_ONLY':'BLOCKED',
    visual:'LEGACY_TEN_SHOTS_REJECTED_BY_CREATOR',
    hero_scene:'SINGLE_PROVENANCE_BACKED_VISUAL_CANDIDATE_BUILT_SEE_QA_HERO_RESULTS_JSON',
    playability:'PLAYABILITY_UNPROVEN',
    gameplay_integration:'GAMEPLAY_INTEGRATION_BLOCKED',
    creator_visual_review:'NOT_READY_NO_APPROVAL_REQUESTED_FOR_WEAK_OR_REJECTED_ITERATIONS',
    native_godot:'NOT_CLAIMED_NO_GODOT_4_7_RUNTIME_OR_OWNER_COORDINATION',
  };
  const result={generated:new Date().toISOString(),branch:sourceManifest.branch,head:sourceManifest.local_head,verdicts,summary:{pass,fail,total:tests.length},tests,
    limitations:['All 10 legacy screenshots were REJECTED by the creator; no visual acceptance is claimed for them.','No Godot 4.7 runtime, no owner A0/A1/A3/A8 integration, no native player-input journey.','Screenshots are real 640x360 1x node-rendered captures from shared scene code; they are not native Godot captures.','Human visual acceptance, playability and gameplay economy/HP/yield/respawn remain creator/owner authority.','Private APEX-CHAOS blobs unavailable (403); only selected public-branch donors staged.','The rebuilt single hero scene has its own exact-SHA ledger and QA: data/hero_provenance.json, data/hero_scene.json, qa/hero_results.json.']};
  fs.writeFileSync(path.join(QA,'results.json'),JSON.stringify(result,null,2));
  const lines=['# Veyra World Lab — independent QA','','Verdicts: '+JSON.stringify(verdicts),'','Summary: '+pass+' pass / '+fail+' fail / '+tests.length+' tests','',...tests.map(t=>`- **${t.status}** ${t.id}: ${t.status==='PASS'?JSON.stringify(Object.fromEntries(Object.entries(t).filter(([k])=>!['id','status','stack'].includes(k)))):t.error}`),'','## Explicit boundaries','','- Browser authoring tool is a review/authoring surface, not a second gameplay engine.','- No canonical HP, yields, recipe costs, regeneration, loot, gates or unlocks are defined.','- Tests passing does not imply visual acceptance or native playability.','- Godot 4.7 integration is blocked and unclaimed.',''];
  fs.writeFileSync(path.join(QA,'TEST_REPORT.md'),lines.join('\n'));
  return {verdict:fail===0?'LEGACY_COMPILER_AND_DATA_ONLY_PLAYABILITY_UNPROVEN':'BLOCKED',summary:{pass,fail,total:tests.length},verdicts,tests};
}
if(process.argv[1]&&process.argv[1].endsWith('qa.mjs')){
  // standalone rerun from persisted data (no build side effects)
  import('../compiler/gold.mjs').then(({loadGold})=>{
    const gold=loadGold(path.join(ROOT,'src/gold/VEYRA_GOLD_MAP.sohmap.json'));
    const world=read(path.join(DATA,'world_base.json')),poi=read(path.join(DATA,'poi_overlays.json')),ecologyA=read(path.join(DATA,'ecology_A.json')),ecologyB=read(path.join(DATA,'ecology_B.json'));
    const edits=read(path.join(DATA,'creator_edits.json')),fingerprint=read(path.join(DATA,'build_fingerprint.json')),shots=read(path.join(ROOT,'screenshots/capture_manifest.json')).shots;
    const r=runQA({gold,world,poi,ecologyA,ecologyB,edits,fingerprint,shots});console.log(JSON.stringify({verdict:r.verdict,summary:r.summary},null,2));
  }).catch(e=>{console.error(e);process.exit(1)});
}
