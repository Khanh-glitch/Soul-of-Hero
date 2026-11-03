// Authoritative real-crop kit for the ONE Argus / Great Lens hero scene.
//
// Every entry below resolves to a byte-exact prototype sheet or derived prop,
// an exact frame name from the prototype's own frame manifest, and an exact
// [x,y,w,h] crop rect.  Nothing in the kit is an invented flat connected-
// component crop: the earlier `data/hero_donor_components.json` report is only
// forensics and is deliberately NOT used here.
//
// buildLedger() writes data/hero_provenance.json.  The renderer refuses to draw
// any crop whose source SHA, manifest SHA, frame name or rect no longer matches
// that ledger, so the PNG is tied to the exact donor bytes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {Pix} from '../lib/pixels.mjs';
import {paletteLock, selectiveOutline, chromaKey, nearestDownsample, PALETTE} from './palette.mjs';

export const ROOT = process.cwd();
const P = 'assets/source/prototype/';
export const DERIVED = 'assets/source/derived/great_lens_hero_v4_clean.png';
export const HERO_PROVENANCE_CLASS = 'AI_DERIVED_HERO_PROP_NOT_REAL_ASSET';

export const SHEETS = {
  gate_tiles:   {file:P+'assets_environment_chapter1_gatehouse_gatehouse_tiles.png', manifest:P+'assets_environment_chapter1_gatehouse_gatehouse_tiles.json', kind:'chapter1_tiles'},
  relay_tiles:  {file:P+'assets_environment_chapter1_relay_relay_tiles.png',        manifest:P+'assets_environment_chapter1_relay_relay_tiles.json',        kind:'chapter1_tiles'},
  vigil_tiles:  {file:P+'assets_environment_chapter1_vigil_vigil_tiles.png',        manifest:P+'assets_environment_chapter1_vigil_vigil_tiles.json',        kind:'chapter1_tiles'},
  gate_props:   {file:P+'assets_environment_chapter1_gatehouse_gatehouse_props.png',manifest:P+'assets_environment_chapter1_gatehouse_gatehouse_props.json',kind:'chapter1_props'},
  relay_props:  {file:P+'assets_environment_chapter1_relay_relay_props.png',        manifest:P+'assets_environment_chapter1_relay_relay_props.json',        kind:'chapter1_props'},
  vigil_props:  {file:P+'assets_environment_chapter1_vigil_vigil_props.png',        manifest:P+'assets_environment_chapter1_vigil_vigil_props.json',        kind:'chapter1_props'},
  overworld_tiles:{file:P+'assets_environment_overworld_overworld_tiles.png',        manifest:P+'data_overworld_art_manifest.json',                          kind:'overworld_index'},
  light_radial: {file:P+'assets_environment_overworld_light_radial.png',            manifest:null,                                                          kind:'standalone_crop'},
};

// role: tileable | trim | prop | hero | light_stencil
// group: one of the authored palette ramps in src/hero/palette.mjs
const KIT_SPEC = [
  // --- 16px tileable / trim majority kit (relay = cool slate, gatehouse = trim) ---
  ['bedrock_dark',      'relay_tiles', 'bedrock_a',        'tileable', 'void'],
  ['bedrock_light',     'relay_tiles', 'bedrock_b',        'tileable', 'void'],
  ['wall_cap',          'relay_tiles', 'wall_cap',         'trim',     'stone'],
  ['wall_cornice',      'relay_tiles', 'wall_cornice',     'trim',     'stone'],
  ['wall_field_a',      'relay_tiles', 'wall_field_a',     'tileable', 'stone'],
  ['wall_field_b',      'relay_tiles', 'wall_field_b',     'tileable', 'stone'],
  ['wall_lancet',       'relay_tiles', 'wall_lancet',      'trim',     'cyan'],
  ['wall_relay',        'relay_tiles', 'wall_relay',       'trim',     'cyan'],
  ['wall_dado',         'relay_tiles', 'wall_dado_a',      'trim',     'stone'],
  ['wall_plinth',       'relay_tiles', 'wall_plinth',      'trim',     'void'],
  ['shadow_edge',       'relay_tiles', 'shadow_edge',      'trim',     'shadow'],
  ['floor_a',           'relay_tiles', 'floor_a',          'tileable', 'stone'],
  ['floor_b',           'relay_tiles', 'floor_b',          'tileable', 'stone'],
  ['floor_c',           'relay_tiles', 'floor_c',          'tileable', 'stone'],
  ['floor_worn',        'relay_tiles', 'floor_worn',       'tileable', 'stone'],
  ['floor_broken',      'relay_tiles', 'floor_broken',     'tileable', 'stone'],
  ['aisle_v',           'relay_tiles', 'aisle_v',          'trim',     'cyan'],
  ['aisle_h',           'relay_tiles', 'aisle_h',          'trim',     'cyan'],
  ['conduit_h',         'relay_tiles', 'conduit_h',        'trim',     'cyan'],
  ['conduit_v',         'relay_tiles', 'conduit_v',        'trim',     'cyan'],
  ['conduit_node',      'relay_tiles', 'conduit_node',     'trim',     'cyan'],
  ['chevron_e',         'relay_tiles', 'chevron_e',        'trim',     'brass'],
  ['chevron_w',         'relay_tiles', 'chevron_w',        'trim',     'brass'],
  ['terrace',           'relay_tiles', 'terrace',          'trim',     'stone'],
  ['rail_w',            'gate_tiles',  'rail_w',           'trim',     'stone'],
  ['rail_e',            'gate_tiles',  'rail_e',           'trim',     'stone'],
  ['step_tread',        'gate_tiles',  'step_tread',       'trim',     'void'],
  ['step_nosing',       'gate_tiles',  'step_nosing',      'trim',     'brass'],
  ['hearth',            'vigil_tiles', 'hearth',           'tileable', 'ember'],
  ['scorch_a',          'vigil_tiles', 'scorch_a',         'tileable', 'ember'],
  ['ash_a',             'vigil_tiles', 'ash_a',            'tileable', 'stone'],
  ['lane_h',            'vigil_tiles', 'lane_h',           'trim',     'ember'],
  ['overworld_ash0',    'overworld_tiles', 'ash0',         'tileable', 'stone'],
  // --- real whole-sprite props, ranked subordinate to the one hero landmark ---
  ['gate_tower',        'gate_props',  'gate_tower',           'prop', 'stone'],
  ['gate_tower_l',      'gate_props',  'gate_tower_l',         'prop', 'stone'],
  ['banner',            'gate_props',  'banner',               'prop', 'ember'],
  ['chain_column',      'gate_props',  'chain_column',         'prop', 'stone'],
  ['arch_relay',        'relay_props', 'arch_relay',           'prop', 'cyan'],
  ['pylon_tall',        'relay_props', 'pylon_tall',           'prop', 'cyan'],
  ['crystal_anchor_small','relay_props','crystal_anchor_small','prop', 'cyan'],
  ['crystal_shard',     'relay_props', 'crystal_shard',        'prop', 'cyan'],
  ['pedestal',          'relay_props', 'pedestal',             'prop', 'stone'],
  ['signal_wheel',      'relay_props', 'signal_wheel',         'prop', 'brass'],
  ['plaque',            'relay_props', 'plaque',               'prop', 'brass'],
  ['brazier',           'vigil_props', 'brazier',              'prop', 'ember'],
  ['torch_bracket',     'vigil_props', 'torch_bracket',        'prop', 'brass'],
  ['watch_pillar',      'vigil_props', 'watch_pillar',         'prop', 'void'],
  ['crates',            'vigil_props', 'crates',               'prop', 'stone'],
];

export const MOSAICS = [
  {id:'lens_medallion', sheet:'relay_tiles', prefix:'medallion', radius:4, group:'all',  role:'tileable', note:'9x9 = 81 exact 16px real crops; the real-asset floor of the focal landmark'},
  {id:'observation_dial',sheet:'gate_tiles', prefix:'ring',      radius:2, group:'all',  role:'tileable', note:'5x5 = 25 exact 16px real crops; subordinate south observation space'},
];

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const shaFile = f => sha(fs.readFileSync(path.join(ROOT,f)));
const shaPix = p => sha(Buffer.from(p.data.buffer, p.data.byteOffset, p.data.byteLength));
const pngCache = new Map();
const manifestCache = new Map();

function png(file){
  if(!pngCache.has(file)) pngCache.set(file, PNG.sync.read(fs.readFileSync(path.join(ROOT,file))));
  return pngCache.get(file);
}
function manifest(file){
  if(!manifestCache.has(file)) manifestCache.set(file, JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8')));
  return manifestCache.get(file);
}
/** Exact prototype frame rect. Throws rather than falling back to a guess. */
export function frameRect(sheetKey, frame){
  const s = SHEETS[sheetKey];
  if(!s) throw new Error('unknown sheet '+sheetKey);
  if(s.kind==='standalone_crop'){
    if(frame!=='radial_256') throw new Error('unknown standalone frame '+frame);
    return {x:0,y:0,w:256,h:256};
  }
  const m = manifest(s.manifest);
  let r;
  if(s.kind==='overworld_index'){
    const e=m.sheets.tiles.index[frame]; if(!e) throw new Error('missing overworld frame '+frame);
    r={x:e.rect[0],y:e.rect[1],w:e.rect[2],h:e.rect[3]};
  } else {
    r=m.frames[frame]; if(!r) throw new Error('missing frame '+sheetKey+':'+frame);
  }
  return {x:r.x,y:r.y,w:r.w,h:r.h};
}
/** Raw RGBA crop, byte-for-byte from the donor sheet. */
export function rawCrop(sheetKey, frame){
  const s=SHEETS[sheetKey], src=png(s.file), r=frameRect(sheetKey,frame);
  if(r.x<0||r.y<0||r.x+r.w>src.width||r.y+r.h>src.height) throw new Error('rect outside sheet '+sheetKey+':'+frame);
  const out={width:r.w,height:r.h,data:new Uint8Array(r.w*r.h*4)};
  for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
    const si=((r.y+y)*src.width+(r.x+x))*4, di=(y*r.w+x)*4;
    out.data[di]=src.data[si];out.data[di+1]=src.data[si+1];out.data[di+2]=src.data[si+2];out.data[di+3]=src.data[si+3];
  }
  return out;
}
export function rawDerivedHero(){
  const src=png(DERIVED);
  const raw={width:src.width,height:src.height,data:new Uint8Array(src.data.length)};
  raw.data.set(src.data);
  // Deterministic cleanup + integer nearest-neighbour /8 reduction. 1216/8 = 152.
  const keyed=chromaKey(raw,[255,0,255],70);
  return nearestDownsample(keyed,8,152,152);
}
/** One shared normalization path: 36-colour lock, hue-shifted value ladder, selective outline on props. */
export function normalizeCrop(raw, {group='stone',role='tileable',hueShift=true,ditherAmount=4}={}){
  let p=paletteLock(raw,group,{dither:true,ditherAmount,hueShift});
  if(role==='prop'||role==='hero') p=selectiveOutline(p);
  return p;
}
export function toPix(rgba){
  const p=new Pix(rgba.width,rgba.height);
  p.data.set(rgba.data);
  return p;
}
export function rawLightStencil(){ return rawCrop('light_radial','radial_256'); }

function sourceRecord(file){
  const s=SHEETS[Object.keys(SHEETS).find(k=>SHEETS[k].file===file)];
  return s||null;
}
/** Build the exact SHA / rect / frame / normalization ledger. */
export function buildLedger(){
  const sourceMap=JSON.parse(fs.readFileSync(path.join(ROOT,P+'SOURCE_MAP.json'),'utf8'));
  const originByFlat=Object.fromEntries((sourceMap.files||[]).map(r=>[r.flat,r]));
  const sources=[];
  for(const [key,s] of Object.entries(SHEETS)){
    const abs=s.file, buf=fs.readFileSync(path.join(ROOT,abs));
    const rec={
      id:key,file:abs,bytes:buf.length,sha256:sha(buf),
      manifest_file:s.manifest,manifest_sha256:s.manifest?shaFile(s.manifest):null,
      frame_manifest_kind:s.kind,
      tile_size:s.kind==='chapter1_tiles'||s.kind==='chapter1_props'?manifest(s.manifest).tile_size:null,
      git_origin:originByFlat[path.basename(abs)]?.origin||null,
      git_blob_sha1:originByFlat[path.basename(abs)]?.git_blob_sha1||null,
      license_note:'Prototype-generated original, staged byte-for-byte; see ASSET_LICENSES.md / THIRD_PARTY.md. No rights claim.',
    };
    sources.push(rec);
  }
  const kit=[];
  const add=(id,sheet,frame,role,group,extra={})=>{
    const raw=rawCrop(sheet,frame), norm=normalizeCrop(raw,{group,role});
    kit.push({
      id,sheet,frame,role,group,
      rect:[frameRect(sheet,frame).x,frameRect(sheet,frame).y,frameRect(sheet,frame).w,frameRect(sheet,frame).h],
      grid_px:16,grid_aligned:frameRect(sheet,frame).w===16&&frameRect(sheet,frame).h===16,
      placement_note:'16px scene grid; whole-sprite props use pixel anchors with sorted foot_y',
      source_file:SHEETS[sheet].file,source_sha256:sources.find(s=>s.id===sheet).sha256,
      manifest_file:SHEETS[sheet].manifest,manifest_sha256:sources.find(s=>s.id===sheet).manifest_sha256,
      crop_bytes:raw.data.length,crop_sha256:shaPix(raw),
      normalized_bytes:norm.data.length,normalized_sha256:shaPix(norm),
      normalization:{palette:'src/hero/palette.mjs',palette_size:PALETTE.length,group,hue_shift:true,ordered_dither:true,dither_amount:4,outline:role==='prop'||role==='hero'?'selective_lower_right':null},
      provenance_class:'REAL_PROTOTYPE_CROP',...extra,
    });
  };
  for(const [id,sheet,frame,role,group] of KIT_SPEC) add(id,sheet,frame,role,group);
  for(const m of MOSAICS){
    const {x0,y0}={x0:-m.radius,y0:-m.radius};
    for(let gy=x0;gy<=-x0;gy++)for(let gx=y0;gx<=-y0;gx++){
      const frame=`${m.prefix}_${gx}_${gy}`;
      add(`${m.id}_${gx}_${gy}`,m.sheet,frame,'tileable',m.group,{mosaic:m.id,mosaic_cell:[gx,gy]});
    }
  }
  // light stencil: real donor crop, used only as a quantized alpha shape, never rendered as RGB
  {
    const raw=rawLightStencil(), frame='radial_256';
    kit.push({
      id:'light_radial',sheet:'light_radial',frame,role:'light_stencil',group:null,
      rect:[0,0,256,256],grid_px:16,grid_aligned:false,
      source_file:SHEETS.light_radial.file,source_sha256:sources.find(s=>s.id==='light_radial').sha256,
      manifest_file:null,manifest_sha256:null,
      crop_bytes:raw.data.length,crop_sha256:shaPix(raw),
      normalized_bytes:null,normalized_sha256:null,
      normalization:{usage:'quantized 4-band alpha stencil for light radii; no RGB emitted'},
      provenance_class:'REAL_PROTOTYPE_CROP',
    });
  }
  // one and only one AI-derived hero prop, explicitly labelled
  {
    const raw=rawDerivedHero(), norm=normalizeCrop(raw,{group:'all',role:'hero'}), buf=fs.readFileSync(path.join(ROOT,DERIVED));
    const notice=JSON.parse(fs.readFileSync(path.join(ROOT,'data/hero_derived_notice.json'),'utf8'));
    kit.push({
      id:'great_lens_hero',sheet:null,frame:null,role:'hero',group:'all',
      rect:[0,0,1216,1216],grid_px:16,grid_aligned:false,
      source_file:DERIVED,source_sha256:sha(buf),
      manifest_file:null,manifest_sha256:null,
      crop_bytes:raw.data.length,crop_sha256:shaPix(raw),
      normalized_bytes:norm.data.length,normalized_sha256:shaPix(norm),
      normalization:{palette:'src/hero/palette.mjs',palette_size:PALETTE.length,group:'all',hue_shift:true,ordered_dither:true,dither_amount:4,chroma_key:[255,0,255],integer_downsample_factor:8,output_dimensions:[152,152],outline:'selective_lower_right'},
      provenance_class:HERO_PROVENANCE_CLASS,
      explicit_label:HERO_PROVENANCE_CLASS,
      notice:notice.notice,
      notice_file:'data/hero_derived_notice.json',
      never_real_asset_proof:true,
    });
  }
  const real=kit.filter(k=>k.provenance_class==='REAL_PROTOTYPE_CROP');
  const tileOrTrim=real.filter(k=>k.role==='tileable'||k.role==='trim');
  const duplicatePaths=new Set();const seen=new Set();
  for(const k of kit){const key=`${k.source_file}|${k.frame}`;if(seen.has(key))duplicatePaths.add(key);seen.add(key);}
  const ledger={
    schema:'soh.hero_provenance/1',
    scene_id:'argus_great_lens_hero_v1',
    head:'DYNAMIC_SEE_GIT_REV_PARSE_HEAD',head_command:'git rev-parse HEAD',
    branch_guard:'arena/2e3cfbd2-soul-of-hero',
    source_branch:sourceMap.source_branch,source_commit:sourceMap.source_commit,
    authority_note:'Prototype-generated sheets and frame manifests are staged byte-for-byte. Every crop is resolved by exact source SHA + exact frame name + exact rect at render time.',
    license_note:'See ASSET_LICENSES.md and THIRD_PARTY.md. No full license coverage or owner rights confirmation is claimed.',
    summary:{
      kit_entries:kit.length,real_crop_entries:real.length,
      tileable_or_trim_entries:tileOrTrim.length,
      tileable_or_trim_fraction:+(tileOrTrim.length/real.length).toFixed(4),
      real_crop_placements:'see data/hero_scene.json tile_map (920 explicit 16px cells) + mosaics + props',
      hero_entries:kit.filter(k=>k.role==='hero').length,
      hero_provenance_class:HERO_PROVENANCE_CLASS,
      duplicate_source_frame_keys:[...duplicatePaths],
      unique_sheets:sources.length,
      palette_size:PALETTE.length,
      grid_px:16,
    },
    sources,kit,
  };
  fs.writeFileSync(path.join(ROOT,'data/hero_provenance.json'),JSON.stringify(ledger,null,2));
  return ledger;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const l=buildLedger();console.log('HERO_LEDGER',JSON.stringify(l.summary));
}
