// Strict, negative-oriented QA for the ONE provenance-backed hero scene.
// It proves exact donor bytes/rects/frames, native 1x output, a tracked scene
// graph, palette discipline, y-sort, conservative shadows and honest verdicts.
// It does NOT prove playability, Godot import or creator acceptance.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {PALETTE, contactShadow} from './palette.mjs';
import {frameRect, rawCrop, rawDerivedHero, normalizeCrop, rawLightStencil, HERO_PROVENANCE_CLASS} from './kit.mjs';
import {renderHero} from './render.mjs';

const ROOT=process.cwd();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const shaFile=f=>sha(fs.readFileSync(path.join(ROOT,f)));
const shaPix=p=>sha(Buffer.from(p.data.buffer,p.data.byteOffset,p.data.byteLength));
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const tests=[];
const check=(id,fn)=>{try{const d=fn();tests.push({id,status:'PASS',...(d||{})});return true;}catch(e){tests.push({id,status:'FAIL',error:String(e&&e.message||e)});return false;}};
const ledger=read('data/hero_provenance.json'), scene=read('data/hero_scene.json');
const byId=new Map(ledger.kit.map(k=>[k.id,k]));

check('EXACT_SOURCE_SHA_RECT_FRAME_LEDGER',()=>{
  let sources=0,frames=0,crops=0,normalized=0;
  for(const s of ledger.sources){
    assert.equal(shaFile(s.file),s.sha256,'source SHA '+s.file);
    if(s.manifest_file)assert.equal(shaFile(s.manifest_file),s.manifest_sha256,'manifest SHA '+s.manifest_file);
    sources++;
  }
  for(const k of ledger.kit){
    if(k.provenance_class===HERO_PROVENANCE_CLASS)continue;
    if(k.role==='light_stencil'){assert.equal(shaPix(rawLightStencil()),k.crop_sha256);crops++;continue;}
    const r=frameRect(k.sheet,k.frame);
    assert.deepEqual([r.x,r.y,r.w,r.h],k.rect,'rect '+k.id);
    const raw=rawCrop(k.sheet,k.frame),norm=normalizeCrop(raw,{group:k.group,role:k.role});
    assert.equal(shaPix(raw),k.crop_sha256,'raw crop SHA '+k.id);
    assert.equal(shaPix(norm),k.normalized_sha256,'normalized crop SHA '+k.id);
    frames++;crops++;normalized++;
  }
  assert.equal(ledger.summary.duplicate_source_frame_keys.length,0);
  return {sources,frames,crops,normalized,duplicate_keys:0};
});
check('DERIVED_HERO_NEVER_REAL_ASSET_PROOF',()=>{
  const k=byId.get('great_lens_hero'),notice=read('data/hero_derived_notice.json');
  assert.ok(k);assert.equal(k.provenance_class,HERO_PROVENANCE_CLASS);
  assert.equal(k.explicit_label,HERO_PROVENANCE_CLASS);
  assert.equal(notice.provenance_class,HERO_PROVENANCE_CLASS);
  assert.equal(shaFile(k.source_file),k.source_sha256);
  const raw=rawDerivedHero(),norm=normalizeCrop(raw,{group:k.group,role:'hero'});
  assert.equal(shaPix(raw),k.crop_sha256);assert.equal(shaPix(norm),k.normalized_sha256);
  assert.deepEqual(k.normalization.output_dimensions,[152,152]);
  assert.equal(k.normalization.integer_downsample_factor,8);
  assert.equal(k.never_real_asset_proof,true);
  return {hero_entries:ledger.kit.filter(x=>x.role==='hero').length,downsample:8,notice:true};
});
check('TRACKED_SCENE_GRAPH_16PX_GRID',()=>{
  assert.equal(scene.schema,'soh.hero_scene/1');
  assert.equal(scene.id,ledger.scene_id);
  assert.deepEqual([scene.native.width,scene.native.height,scene.native.scale,scene.native.grid_px],[640,360,1,16]);
  assert.equal(scene.native.nearest_neighbor,true);
  assert.equal(scene.tile_map.rows.length,23);
  for(const r of scene.tile_map.rows){assert.equal(r.length,40);for(const c of r)assert.ok(scene.tile_map.legend[c],'unmapped '+c);}
  for(const m of scene.mosaics){assert.equal(m.px[0]%16,0);assert.equal(m.px[1]%16,0);assert.equal(m.cells[0],m.radius*2+1);}
  const ids=new Set();
  for(const r of scene.tile_map.rows)for(const c of r)ids.add(scene.tile_map.legend[c]);
  for(const m of scene.mosaics)for(let cy=-m.radius;cy<=m.radius;cy++)for(let cx=-m.radius;cx<=m.radius;cx++)ids.add(`${m.id}_${cx}_${cy}`);
  for(const o of scene.objects){ids.add(o.kit);assert.ok(byId.get(o.kit),'unknown kit '+o.kit);}
  for(const id of ids)assert.ok(byId.get(id),'unledgered kit '+id);
  return {rows:23,cols:40,tile_placements:920,mosaic_cells:106,objects:scene.objects.length,distinct_kit_ids:ids.size};
});
check('REAL_CROP_TILEABLE_TRIM_MAJORITY',()=>{
  const real=ledger.kit.filter(k=>k.provenance_class==='REAL_PROTOTYPE_CROP');
  const tt=real.filter(k=>k.role==='tileable'||k.role==='trim');
  assert.ok(real.length>=100);
  assert.ok(tt.length/real.length>0.5);
  assert.ok(scene.tile_map.rows.length*40>=900);
  assert.equal(ledger.summary.hero_entries,1);
  assert.equal(ledger.summary.tileable_or_trim_fraction,+(tt.length/real.length).toFixed(4));
  return {real_entries:real.length,tileable_trim:tt.length,fraction:ledger.summary.tileable_or_trim_fraction,tile_placements:920,mosaic_placements:106,prop_placements:scene.objects.length};
});
check('Y_DEPTH_SORTING_AND_FOCAL_HIERARCHY',()=>{
  let prev=-Infinity;for(const o of scene.objects){assert.ok(o.foot_y>=prev,'not sorted '+o.id);prev=o.foot_y;}
  const hero=scene.objects.find(o=>o.role==='hero_landmark');
  assert.ok(hero);assert.equal(hero.provenance_class,HERO_PROVENANCE_CLASS);
  assert.equal(hero.explicit_label,HERO_PROVENANCE_CLASS);
  assert.ok(scene.objects.filter(o=>o.layer==='foreground').every(o=>o.foot_y>hero.foot_y));
  assert.ok(scene.objects.filter(o=>o.layer==='background').every(o=>o.foot_y<hero.foot_y));
  assert.equal(scene.objects.filter(o=>o.role==='hero_landmark').length,1);
  assert.ok(scene.composition.focal_hierarchy.includes('great_lens'));
  return {objects:scene.objects.length,hero_foot_y:hero.foot_y,max_foot_y:prev};
});
check('CONSERVATIVE_CONTACT_SHADOWS',()=>{
  const drops=scene.objects.map(o=>o.shadow_drop||0);
  assert.ok(Math.max(...drops)<=16);
  const sample=rawCrop('relay_tiles','floor_a'),sp=normalizeCrop(sample,{group:'stone',role:'tileable'});
  const sh=contactShadow(sp,{drop:16});
  let maxA=0;for(let i=3;i<sh.data.length;i+=4)maxA=Math.max(maxA,sh.data[i]);
  assert.ok(maxA<=110);
  assert.equal(sh.width,sp.width+16);
  return {max_drop_px:Math.max(...drops),alpha_cap:110,shadow_objects:drops.filter(d=>d>0).length};
});
check('SHARED_LIMITED_HUE_SHIFTED_PALETTE',()=>{
  assert.equal(PALETTE.length,36);assert.equal(new Set(PALETTE.map(c=>c.join(','))).size,36);
  assert.equal(scene.palette.size,36);
  const p=PNG.sync.read(fs.readFileSync(path.join(ROOT,'screenshots/ARGUS_GREAT_LENS_HERO.png')));
  const allowed=new Set(PALETTE.map(c=>`${c[0]},${c[1]},${c[2]}`));
  const used=new Set();let off=0,transparent=0;
  for(let i=0;i<p.data.length;i+=4){
    const k=`${p.data[i]},${p.data[i+1]},${p.data[i+2]}`;
    used.add(k);if(!allowed.has(k))off++;if(p.data[i+3]!==255)transparent++;
  }
  assert.equal(off,0);assert.equal(transparent,0);assert.ok(used.size<=36);
  return {palette_size:36,used_colours:used.size,off_palette_pixels:off,transparent_pixels:transparent};
});
check('NATIVE_640X360_1X_DETERMINISTIC_RENDER',()=>{
  const before=shaFile('screenshots/ARGUS_GREAT_LENS_HERO.png');
  const stats=renderHero();
  const after=shaFile('screenshots/ARGUS_GREAT_LENS_HERO.png');
  assert.equal(before,after,'render not deterministic');
  assert.equal(stats.output_sha256,after);
  const p=PNG.sync.read(fs.readFileSync(path.join(ROOT,'screenshots/ARGUS_GREAT_LENS_HERO.png')));
  assert.deepEqual([p.width,p.height],[640,360]);
  assert.equal(stats.off_palette_pixels,0);
  assert.equal(stats.tile_placements,920);
  assert.equal(stats.mosaic_placements,106);
  assert.equal(stats.prop_placements,scene.objects.length);
  return {sha256:after,dimensions:[p.width,p.height],scale:1,deterministic:true};
});
check('COOL_AMBIENT_PLUS_WARM_LOCAL_LIGHT',()=>{
  const es=scene.lighting.local.emitters;
  assert.ok(es.filter(e=>e.type==='warm').length>=2);
  assert.ok(es.filter(e=>e.type==='cool').length>=1);
  assert.equal(scene.lighting.ambient.type,'cool');
  assert.ok(scene.lighting.local.stencil.includes('light_radial'));
  assert.ok(scene.lighting.shadow.max_drop_px<=16);
  const st=read('qa/hero_render_stats.json');
  assert.ok(st.lighting.warm_pixels>0&&st.lighting.cool_pixels>0);
  assert.ok(st.lighting.max_levels.warm>0&&st.lighting.max_levels.cool>0);
  const lr=byId.get('light_radial');assert.equal(lr.provenance_class,'REAL_PROTOTYPE_CROP');
  assert.equal(shaPix(rawLightStencil()),lr.crop_sha256);
  return {warm_emitters:es.filter(e=>e.type==='warm').length,cool_emitters:es.filter(e=>e.type==='cool').length,warm_pixels:st.lighting.warm_pixels,cool_pixels:st.lighting.cool_pixels};
});
check('LEADING_LINES_HARD_EDGES_FUNCTIONAL_SPACES',()=>{
  const row11=scene.tile_map.rows[11];
  assert.ok(row11.includes('>')&&row11.includes('<')&&row11.includes('+')&&row11.includes('-'));
  assert.ok(scene.tile_map.rows.slice(16,20).every(r=>r[19]==='a'&&r[20]==='a'));
  assert.ok(scene.composition.hard_edges.includes('no anti-aliasing'));
  for(const s of ['lens_chamber','west_retreat','east_retreat','south_observation','north_wall_service'])assert.ok(scene.composition.functional_spaces.includes(s));
  const tileFrames=ledger.kit.filter(k=>(k.role==='tileable'||k.role==='trim')&&k.provenance_class==='REAL_PROTOTYPE_CROP');
  assert.ok(tileFrames.every(k=>k.rect[2]===16&&k.rect[3]===16));
  return {leading_lines:true,tile_frames_16px:tileFrames.length,functional_spaces:scene.composition.functional_spaces.length};
});
check('HONEST_VERDICTS_AND_NO_STALE_APPROVAL',()=>{
  assert.equal(scene.verdict.playability,'PLAYABILITY_UNPROVEN');
  assert.equal(scene.verdict.gameplay_integration,'GAMEPLAY_INTEGRATION_BLOCKED');
  assert.equal(scene.verdict.native_godot,'NOT_CLAIMED_NO_GODOT_4_7_SCENE_OR_IMPORT');
  assert.equal(scene.verdict.creator_visual_review,'NOT_REQUESTED_NO_WEAK_ITERATION_APPROVAL');
  assert.ok(scene.authority.honest_note.includes('no collision'));
  const qa=read('qa/results.json');
  assert.notEqual(qa.verdicts.creator_visual_review,'READY_FOR_CREATOR_VISUAL_REVIEW');
  assert.notEqual(qa.verdicts.visual,'VISUAL_REVIEW_REQUIRED');
  assert.equal(qa.verdicts.playability,'PLAYABILITY_UNPROVEN');
  assert.equal(qa.verdicts.gameplay_integration,'GAMEPLAY_INTEGRATION_BLOCKED');
  return {...scene.verdict,legacy_qa_visual:qa.verdicts.visual};
});
check('LEGACY_TEN_SHOTS_STILL_REJECTED',()=>{
  const old=read('screenshots/capture_manifest.json');
  assert.equal(old.shots.length,10);
  const md=fs.readFileSync(path.join(ROOT,'screenshots/PAIRED_VISUAL_REVIEW.md'),'utf8');
  assert.match(md,/REJECTED/);
  assert.equal(scene.status,'SINGLE_VISUAL_CANDIDATE_NOT_CREATOR_ACCEPTED');
  return {old_shots:old.shots.length,new_scene:scene.id,old_shots_status:'REJECTED_BY_CREATOR'};
});

const pass=tests.filter(t=>t.status==='PASS').length,fail=tests.length-pass;
const result={
  schema:'soh.hero_qa/1',generated:new Date().toISOString(),
  scene_id:scene.id,branch:'arena/2e3cfbd2-soul-of-hero',
  head:'DYNAMIC_SEE_GIT_REV_PARSE_HEAD',head_command:'git rev-parse HEAD',
  summary:{pass,fail,total:tests.length},tests,
  verdicts:{
    hero_scene:'SINGLE_PROVENANCE_BACKED_VISUAL_CANDIDATE_BUILT',
    donor_proof:fail===0?'EXACT_SHA_RECT_FRAME_VERIFIED':'BLOCKED',
    creator_visual_review:'NOT_REQUESTED_NO_WEAK_ITERATION_APPROVAL',
    playability:'PLAYABILITY_UNPROVEN',
    gameplay_integration:'GAMEPLAY_INTEGRATION_BLOCKED',
    native_godot:'NOT_CLAIMED_NO_GODOT_4_7_SCENE_OR_IMPORT',
  },
  limitations:[
    'The PNG is a Node/PNG native 640x360 1x presentation render, not a Godot 4.7 capture.',
    'No owner A0/A1/A3/A8/Gameplay semantics, no collision export, no player input, no POI interaction.',
    'No C01-C24 same-SHA proof, no 336h E2, no independent playability test, no creator acceptance.',
    'The hero prop is AI-derived and explicitly labelled AI_DERIVED_HERO_PROP_NOT_REAL_ASSET; it is never real-asset proof.',
    'License coverage is partial; see ASSET_LICENSES.md / THIRD_PARTY.md.',
  ],
};
fs.mkdirSync(path.join(ROOT,'qa'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'qa/hero_results.json'),JSON.stringify(result,null,2));
const lines=['# Argus Great Lens — single hero scene QA','','Verdicts: '+JSON.stringify(result.verdicts),'','Summary: '+pass+' pass / '+fail+' fail / '+tests.length+' tests','',
  ...tests.map(t=>`- **${t.status}** ${t.id}: ${t.status==='PASS'?JSON.stringify(Object.fromEntries(Object.entries(t).filter(([k])=>k!=='id'&&k!=='status'))):t.error}`),
  '','## Boundaries','',...result.limitations.map(s=>'- '+s),'',
  '- Old 10-shot set remains REJECTED; `paired` Greywater→Argus is a traversal-route thesis only.','',
];
fs.writeFileSync(path.join(ROOT,'qa/HERO_TEST_REPORT.md'),lines.join('\n'));
console.log('HERO_QA',JSON.stringify({pass,fail,total:tests.length,verdicts:result.verdicts}));
if(fail)process.exitCode=1;
