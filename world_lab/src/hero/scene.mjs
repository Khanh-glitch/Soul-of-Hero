// Tracked scene graph for ONE rebuilt Argus / Great Lens hero scene.
//
// This is a 640x360 1x visual composition informed by the Argus L2 spatial
// thesis in data/poi_overlays.json. It is NOT a playable level export, NOT a
// collision map, NOT a Godot scene, and it does not invent gameplay semantics.
// The 40x23 explicit 16px tile map, the two real-crop mosaics, the y-sorted
// object list and the light emitters are all serialized to data/hero_scene.json.
import fs from 'node:fs';
import path from 'node:path';
import {hash2} from '../lib/pixels.mjs';
import {HERO_PROVENANCE_CLASS} from './kit.mjs';

const ROOT=process.cwd();
const COLS=40,ROWS=23;
export const LEGEND={
  '#':'bedrock_dark','B':'bedrock_light','T':'wall_cap','C':'wall_cornice',
  'W':'wall_field_a','w':'wall_field_b','L':'wall_lancet','R':'wall_relay',
  'D':'wall_dado','P':'wall_plinth','S':'shadow_edge',
  '.':'floor_a',',':'floor_b','~':'floor_worn','x':'floor_broken',
  'a':'aisle_v','h':'aisle_h','-':'conduit_h','+':'conduit_node',
  '>':'chevron_e','<':'chevron_w','q':'rail_w','e':'rail_e',
  't':'step_tread','n':'step_nosing','g':'terrace','H':'hearth',
  'o':'scorch_a','A':'ash_a','l':'lane_h','O':'overworld_ash0',
};

function tileMap(){
  const g=Array.from({length:ROWS},()=>Array(COLS).fill('.'));
  const set=(r,from,to,c)=>{for(let x=from;x<to;x++)g[r][x]=c;};
  // --- BACKGROUND: near-black rock mass, then a five-course wall stack ---
  set(0,0,COLS,'#');
  set(1,0,COLS,'T');          // lightest cap / top plane
  set(2,0,COLS,'C');          // cornice
  set(3,0,COLS,'W');          // wall field
  for(const x of [5,6,33,34])g[3][x]='L';
  for(const x of [18,19,20,21])g[3][x]='R';
  for(const x of [9,10,29,30])g[3][x]='w';
  set(4,0,COLS,'D');          // carved dado
  set(5,0,COLS,'P');          // dark plinth
  set(6,0,COLS,'S');          // real alpha contact-shadow strip at the wall foot
  // --- CENTER: cool slab floor, explicit tile variants (deterministic, no runtime noise) ---
  for(let r=7;r<=18;r++)for(let x=0;x<COLS;x++){
    const v=hash2(x,r,20261103);
    g[r][x]=v<.07?'~':v<.11?'x':v<.34?',':'.';
  }
  for(let r=7;r<=18;r++){
    g[r][0]=g[r][1]=g[r][38]=g[r][39]='#';   // dark side mass frames the room
    g[r][2]=g[r][37]='B';
    g[r][3]=g[r][36]='g';                     // terrace trim along both retreat loops
  }
  // rails frame the 9x9 lens chamber plinth
  for(let r=7;r<=16;r++){g[r][15]='q';g[r][25]='e';}
  // horizontal conduits + inward chevrons = leading lines into the focal landmark
  set(11,4,15,'-');set(11,26,36,'-');
  g[11][14]='+';g[11][25]='+';
  g[11][13]='>';g[11][26]='<';
  // keep the floor quiet around the two warm stations; the whole sprites carry the detail
  for(const [cx,cy] of [[11,8],[28,8]]){
    g[cy][cx]=',';g[cy][cx+1]='~';g[cy+1][cx]=',';
  }
  g[14][7]='l';g[14][32]='l';
  // --- FOREGROUND: processional aisle, step band, dark framing (lowest contrast) ---
  set(19,3,37,'h');
  for(let r=16;r<=19;r++){g[r][19]='a';g[r][20]='a';}
  g[19][19]=g[19][20]='a';
  set(20,0,COLS,'t');
  g[20][19]=g[20][20]='n';
  set(21,0,COLS,'#');set(22,0,COLS,'#');
  for(const x of [0,8,31,39]){g[21][x]='B';g[22][x]='B';}
  g[21][5]=g[21][34]='O';
  return g.map(row=>row.join(''));
}

const objects=[
  // ---- BACKGROUND (foot_y small, drawn behind the destination) ----
  {id:'north_arch',kit:'arch_relay',x:262,y:8,foot_y:156,layer:'background',role:'destination_frame',functional_space:'north_wall_service',shadow_drop:0,light:null},
  {id:'tower_west',kit:'gate_tower',x:16,y:-8,foot_y:144,layer:'background',role:'wall_mass',functional_space:'west_retreat',shadow_drop:0,light:null},
  {id:'tower_east',kit:'gate_tower_l',x:544,y:-8,foot_y:144,layer:'background',role:'wall_mass',functional_space:'east_retreat',shadow_drop:0,light:null},
  {id:'pylon_west',kit:'pylon_tall',x:96,y:16,foot_y:142,layer:'background',role:'cool_marker',functional_space:'west_retreat',shadow_drop:4,light:'cool_pylon_west'},
  {id:'pylon_east',kit:'pylon_tall',x:508,y:16,foot_y:142,layer:'background',role:'cool_marker',functional_space:'east_retreat',shadow_drop:4,light:'cool_pylon_east'},
  {id:'crystal_west',kit:'crystal_anchor_small',x:72,y:64,foot_y:144,layer:'background',role:'cool_marker',functional_space:'west_retreat',shadow_drop:4,light:null},
  {id:'crystal_east',kit:'crystal_anchor_small',x:517,y:64,foot_y:144,layer:'background',role:'cool_marker',functional_space:'east_retreat',shadow_drop:4,light:null},
  {id:'banner_west',kit:'banner',x:120,y:0,foot_y:116,layer:'background',role:'ranked_secondary',functional_space:'west_retreat',shadow_drop:0,light:null},
  {id:'banner_east',kit:'banner',x:482,y:0,foot_y:116,layer:'background',role:'ranked_secondary',functional_space:'east_retreat',shadow_drop:0,light:null},
  {id:'sconce_west',kit:'torch_bracket',x:208,y:64,foot_y:104,layer:'background',role:'warm_local_light',functional_space:'north_wall_service',shadow_drop:2,light:'warm_sconce_west'},
  {id:'sconce_east',kit:'torch_bracket',x:408,y:64,foot_y:104,layer:'background',role:'warm_local_light',functional_space:'north_wall_service',shadow_drop:2,light:'warm_sconce_east'},
  {id:'brazier_west',kit:'brazier',x:176,y:96,foot_y:148,layer:'background',role:'warm_local_light',functional_space:'lens_chamber',shadow_drop:6,light:'warm_brazier_west'},
  {id:'brazier_east',kit:'brazier',x:430,y:96,foot_y:148,layer:'background',role:'warm_local_light',functional_space:'lens_chamber',shadow_drop:6,light:'warm_brazier_east'},
  {id:'signal_wheel_west',kit:'signal_wheel',x:40,y:144,foot_y:210,layer:'midground',role:'ranked_secondary',functional_space:'west_retreat',shadow_drop:6,light:null},
  {id:'plaque_east',kit:'plaque',x:540,y:152,foot_y:180,layer:'midground',role:'ranked_secondary',functional_space:'east_retreat',shadow_drop:4,light:null},
  {id:'pedestal_west',kit:'pedestal',x:104,y:224,foot_y:272,layer:'midground',role:'ranked_secondary',functional_space:'south_observation',shadow_drop:6,light:null},
  {id:'crystal_shard_west',kit:'crystal_shard',x:110,y:190,foot_y:230,layer:'midground',role:'ranked_secondary',functional_space:'south_observation',shadow_drop:4,light:null},
  // ---- CENTRE: one and only one hero landmark ----
  {id:'great_lens',kit:'great_lens_hero',x:252,y:108,foot_y:260,layer:'center',role:'hero_landmark',functional_space:'lens_chamber',shadow_drop:12,light:'cool_lens_core',provenance_class:HERO_PROVENANCE_CLASS,explicit_label:HERO_PROVENANCE_CLASS},
  // ---- FOREGROUND (foot_y large, dark, sparse, never hides the destination) ----
  {id:'pillar_west_fg',kit:'watch_pillar',x:0,y:214,foot_y:360,layer:'foreground',role:'dark_frame',functional_space:'south_observation',shadow_drop:8,light:null},
  {id:'pillar_east_fg',kit:'watch_pillar',x:600,y:214,foot_y:360,layer:'foreground',role:'dark_frame',functional_space:'south_observation',shadow_drop:8,light:null},
  {id:'crates_fg',kit:'crates',x:64,y:308,foot_y:348,layer:'foreground',role:'staffage',functional_space:'south_observation',shadow_drop:4,light:null},
];

const emitters=[
  {id:'cool_lens_core',type:'cool',x:328,y:184,radius:96,power:3,source:'light_radial',note:'cyan pool from the Great Lens; brightest local value'},
  {id:'warm_brazier_west',type:'warm',x:193,y:124,radius:52,power:3,source:'light_radial',note:'small hot local pool, left wall foot; 3 discrete bands'},
  {id:'warm_brazier_east',type:'warm',x:447,y:124,radius:52,power:3,source:'light_radial',note:'small hot local pool, right wall foot; 3 discrete bands'},
  {id:'warm_sconce_west',type:'warm',x:220,y:80,radius:32,power:2,source:'light_radial',note:'ranked warm accent'},
  {id:'warm_sconce_east',type:'warm',x:420,y:80,radius:32,power:2,source:'light_radial',note:'ranked warm accent'},
  {id:'cool_pylon_west',type:'cool',x:114,y:80,radius:44,power:2,source:'light_radial',note:'cool crystal spill'},
  {id:'cool_pylon_east',type:'cool',x:526,y:80,radius:44,power:2,source:'light_radial',note:'cool crystal spill'},
];

export function buildSceneGraph(){
  const rows=tileMap();
  if(rows.length!==ROWS||rows.some(r=>r.length!==COLS)) throw new Error('tile_map must be 40x23');
  for(const r of rows)for(const c of r)if(!LEGEND[c])throw new Error('unmapped tile char '+c);
  objects.sort((a,b)=>a.foot_y-b.foot_y||a.id.localeCompare(b.id));
  const scene={
    schema:'soh.hero_scene/1',
    id:'argus_great_lens_hero_v1',
    title:'Argus L2 — Great Lens vault, one provenance-backed hero scene',
    status:'SINGLE_VISUAL_CANDIDATE_NOT_CREATOR_ACCEPTED',
    native:{width:640,height:360,scale:1,nearest_neighbor:true,grid_px:16,cols:COLS,rows:ROWS,rows_note:'row 22 is clipped to 8 device pixels; 23*16=368 > 360'},
    provenance_ledger:'data/hero_provenance.json',
    derived_notice:'data/hero_derived_notice.json',
    palette:{module:'src/hero/palette.mjs',size:36,rule:'every opaque device pixel is exactly one of the 36 authored colours; dark values hue-shift to blue/violet, highlights to brass/warm ivory'},
    authority:{
      gold_poi:'po_academy',gold_anchor_au:[936,262],level:'argus_l2',level_size_tiles:[48,32],
      zones:{lens_chamber:[14,8,20,16],west:[4,6,9,20],east:[35,6,9,20],south:[4,26,40,4],north:[4,3,40,4]},
      stairs:[{from:[5,3],to:'argus_l1',at:[5,28]},{from:[35,28],to:'argus_l0',at:[35,24]}],
      landmarks:['Great lens [24,16]','cracked housing [19,20]','drainage [35,28]'],
      capability_refs:['C11','A8:POI_INTERACTION_CONDITION','A3:KEY_STOCK_NOT_SET','A0:POWER_STATE_NOT_IMPLEMENTED','A1:HAZARD_EXPOSURE_CANDIDATE'],
      honest_note:'The composition is INFORMED by this spatial thesis only. It is a presentation render: it exports no collision, no stairs/teleports, no POI interaction, no hazard semantics and no gameplay state.',
    },
    tile_map:{legend:LEGEND,rows},
    mosaics:[
      {id:'lens_medallion',tile:[16,7],px:[256,112],size_px:[144,144],cells:[9,9],frame_prefix:'medallion',radius:4,sheet:'relay_tiles',z:-8,role:'focal_floor',functional_space:'lens_chamber',note:'81 exact 16px real crops; cyan core + brass ring'},
      {id:'observation_dial',tile:[3,17],px:[48,272],size_px:[80,80],cells:[5,5],frame_prefix:'ring',radius:2,sheet:'gate_tiles',z:-8,role:'subordinate_observation_space',functional_space:'south_observation',note:'25 exact 16px real crops'},
    ],
    objects,
    y_sort:{key:'foot_y',order:'ascending',rule:'objects with a smaller foot anchor are drawn first; foreground pillars have foot_y 360 and are drawn last',assert_sorted:true},
    lighting:{
      ambient:{type:'cool',value_shift:-1,family_shift:'stone/water toward blue-violet',note:'global cool base, applied as one discrete palette-ladder step'},
      local:{type:'warm_and_cool_pools',emitters,stencil:'light_radial real crop, alpha quantized to 4 hard bands; no runtime gradients'},
      shadow:{max_drop_px:16,alpha_cap:110,source:'src/hero/palette.mjs contactShadow()',note:'conservative ≤1-tile contact shadows only; no cast-shadow system'},
    },
    composition:{
      hierarchy:{
        background:'near-black rock, five-course wall, two towers, two pylons, one arch; lowest clarity',
        center:'brightest 9x9 real-crop medallion + one derived hero landmark + cyan/warm local pools; reads first',
        foreground:'dark framing pillars, crates, step band; sparse, low contrast, never hides the destination',
      },
      leading_lines:'two horizontal conduit runs with inward chevrons at row 11, rails at columns 15/25, and the vertical aisle at columns 19/20 converge on the lens',
      focal_hierarchy:'one destination (great_lens) > wall arch/towers > braziers/pylons > banners/wheel/plaque > foreground staffage',
      hard_edges:'all geometry is 16px hard-edge tile/trim crops or whole sprites; no anti-aliasing, no bilinear scaling, no soft geometry edges',
      functional_spaces:['lens_chamber','west_retreat','east_retreat','south_observation','north_wall_service'],
      value_ladder:'void < plinth < wall field < floor < dado < cornice < wall cap; warm brass/ember and cool cyan ramps sit on that same ladder',
    },
    verdict:{
      visual_candidate:'SINGLE_PROVENANCE_BACKED_SCENE_BUILT',
      creator_visual_review:'NOT_REQUESTED_NO_WEAK_ITERATION_APPROVAL',
      playability:'PLAYABILITY_UNPROVEN',
      gameplay_integration:'GAMEPLAY_INTEGRATION_BLOCKED',
      native_godot:'NOT_CLAIMED_NO_GODOT_4_7_SCENE_OR_IMPORT',
    },
  };
  fs.writeFileSync(path.join(ROOT,'data/hero_scene.json'),JSON.stringify(scene,null,2));
  return scene;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const s=buildSceneGraph();console.log('HERO_SCENE',s.id,s.tile_map.rows.length+'x'+s.tile_map.rows[0].length,'objects',s.objects.length,'emitters',s.lighting.local.emitters.length);
}
