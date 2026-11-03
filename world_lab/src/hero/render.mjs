// Native 640x360 1x nearest-neighbour render of the ONE Argus / Great Lens
// hero scene.  It draws only real prototype crops verified against the exact
// SHA/rect/frame ledger, plus one explicitly-labelled AI-derived hero prop.
// No upscaling, no smoothing, no browser canvas, no pasted native capture.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {Pix} from '../lib/pixels.mjs';
import {PALETTE, contactShadow} from './palette.mjs';
import {frameRect, rawCrop, rawDerivedHero, normalizeCrop, toPix, HERO_PROVENANCE_CLASS} from './kit.mjs';
import {snapPalette, applyLighting} from './light.mjs';

const ROOT=process.cwd();
const OUT='screenshots/ARGUS_GREAT_LENS_HERO.png';
const STATS='qa/hero_render_stats.json';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const shaFile=f=>sha(fs.readFileSync(path.join(ROOT,f)));
const shaPix=p=>sha(Buffer.from(p.data.buffer,p.data.byteOffset,p.data.byteLength));
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));

function verify(ledger){
  const checked={sources:0,frames:0,crops:0,normalized:0};
  for(const s of ledger.sources){
    const actual=shaFile(s.file);
    if(actual!==s.sha256) throw new Error('source SHA mismatch '+s.file);
    if(s.manifest_file&&shaFile(s.manifest_file)!==s.manifest_sha256) throw new Error('manifest SHA mismatch '+s.manifest_file);
    checked.sources++;
  }
  const byId=new Map(ledger.kit.map(k=>[k.id,k]));
  for(const k of ledger.kit){
    if(k.provenance_class==='AI_DERIVED_HERO_PROP_NOT_REAL_ASSET'){
      const raw=rawDerivedHero(), norm=normalizeCrop(raw,{group:k.group,role:'hero'});
      if(shaPix(raw)!==k.crop_sha256||shaPix(norm)!==k.normalized_sha256)throw new Error('derived crop SHA mismatch');
      checked.crops++;checked.normalized++;continue;
    }
    if(k.role==='light_stencil'){
      const raw=rawCrop(k.sheet,k.frame);
      if(shaPix(raw)!==k.crop_sha256)throw new Error('light stencil SHA mismatch');
      checked.crops++;continue;
    }
    const r=frameRect(k.sheet,k.frame), want=k.rect;
    if(r.x!==want[0]||r.y!==want[1]||r.w!==want[2]||r.h!==want[3])throw new Error('rect mismatch '+k.id);
    const raw=rawCrop(k.sheet,k.frame), norm=normalizeCrop(raw,{group:k.group,role:k.role});
    if(shaPix(raw)!==k.crop_sha256)throw new Error('raw crop SHA mismatch '+k.id);
    if(shaPix(norm)!==k.normalized_sha256)throw new Error('normalized crop SHA mismatch '+k.id);
    checked.frames++;checked.crops++;checked.normalized++;
  }
  return {checked,byId};
}

function blend(dst,src,dx,dy){
  const sw=src.width,sh=src.height,sd=src.data,dd=dst.data,dw=dst.width,dh=dst.height;
  for(let y=0;y<sh;y++){
    const ty=dy+y;if(ty<0||ty>=dh)continue;
    for(let x=0;x<sw;x++){
      const tx=dx+x;if(tx<0||tx>=dw)continue;
      const si=(y*sw+x)*4,a=sd[si+3];if(!a)continue;
      const di=(ty*dw+tx)*4,t=a/255,u=1-t;
      dd[di]=Math.round(sd[si]*t+dd[di]*u);
      dd[di+1]=Math.round(sd[si+1]*t+dd[di+1]*u);
      dd[di+2]=Math.round(sd[si+2]*t+dd[di+2]*u);
      dd[di+3]=255;
    }
  }
}

export function renderHero(){
  const ledger=read('data/hero_provenance.json'), scene=read('data/hero_scene.json');
  if(ledger.scene_id!==scene.id)throw new Error('ledger/scene id mismatch');
  const {checked,byId}=verify(ledger);
  const cache=new Map();
  const sprite=id=>{
    if(cache.has(id))return cache.get(id);
    const k=byId.get(id);if(!k)throw new Error('unknown kit id '+id);
    let norm;
    if(k.provenance_class===HERO_PROVENANCE_CLASS) norm=normalizeCrop(rawDerivedHero(),{group:k.group,role:'hero'});
    else norm=normalizeCrop(rawCrop(k.sheet,k.frame),{group:k.group,role:k.role});
    const pix=toPix(norm);cache.set(id,pix);return pix;
  };
  const W=scene.native.width,H=scene.native.height,grid=scene.native.grid_px;
  if(W!==640||H!==360||grid!==16||scene.native.scale!==1)throw new Error('not native 640x360 1x/16px');
  const canvas=new Pix(W,H);
  canvas.rect(0,0,W,H,PALETTE[0]);
  // 1) explicit 40x23 tile map, 920 real 16px placements
  let tilePlacements=0;
  const rows=scene.tile_map.rows;
  for(let ty=0;ty<rows.length;ty++)for(let tx=0;tx<rows[ty].length;tx++){
    const ch=rows[ty][tx], id=scene.tile_map.legend[ch];
    if(!id)throw new Error('unmapped char '+ch);
    blend(canvas,sprite(id),tx*grid,ty*grid);tilePlacements++;
  }
  // 2) real-crop mosaics (81 + 25 exact frames)
  let mosaicPlacements=0;
  for(const m of scene.mosaics){
    for(let cy=-m.radius;cy<=m.radius;cy++)for(let cx=-m.radius;cx<=m.radius;cx++){
      const id=`${m.id}_${cx}_${cy}`;
      blend(canvas,sprite(id),m.px[0]+(cx+m.radius)*16,m.px[1]+(cy+m.radius)*16);
      mosaicPlacements++;
    }
  }
  // 3) y/depth sorted whole sprites + conservative contact shadows
  let lastFoot=-Infinity, propPlacements=0, shadows=0, maxShadow=0;
  for(const o of scene.objects){
    if(o.foot_y<lastFoot)throw new Error('objects not y-sorted at '+o.id);
    lastFoot=o.foot_y;
    const p=sprite(o.kit), drop=Math.min(16,Math.max(0,o.shadow_drop||0));
    if(drop>0){
      const sh=toPix(contactShadow(p,{drop}));
      blend(canvas,sh,o.x,o.y);shadows++;maxShadow=Math.max(maxShadow,drop);
    }
    blend(canvas,p,o.x,o.y);propPlacements++;
  }
  // 4) strict shared palette, then discrete cool ambient + warm/cool local pools
  snapPalette(canvas);
  const lightStats=applyLighting(canvas,scene);
  // 5) native PNG, no scaling anywhere in the pipeline
  const png=new PNG({width:W,height:H});png.data=Buffer.from(canvas.data);
  const buf=PNG.sync.write(png);
  fs.mkdirSync(path.join(ROOT,'screenshots'),{recursive:true});
  fs.mkdirSync(path.join(ROOT,'qa'),{recursive:true});
  fs.writeFileSync(path.join(ROOT,OUT),buf);
  // strict final-palette audit
  const allowed=new Set(PALETTE.map(c=>`${c[0]},${c[1]},${c[2]}`));
  let offPalette=0,transparent=0;
  for(let i=0;i<canvas.data.length;i+=4){
    const k=`${canvas.data[i]},${canvas.data[i+1]},${canvas.data[i+2]}`;
    if(!allowed.has(k))offPalette++;
    if(canvas.data[i+3]!==255)transparent++;
  }
  const usedIds=new Set();
  for(const row of rows)for(const ch of row)usedIds.add(scene.tile_map.legend[ch]);
  for(const m of scene.mosaics)for(let cy=-m.radius;cy<=m.radius;cy++)for(let cx=-m.radius;cx<=m.radius;cx++)usedIds.add(`${m.id}_${cx}_${cy}`);
  for(const o of scene.objects)usedIds.add(o.kit);
  const realUsed=[...usedIds].map(id=>byId.get(id)).filter(k=>k.provenance_class==='REAL_PROTOTYPE_CROP');
  const stats={
    schema:'soh.hero_render/1',scene_id:scene.id,output:OUT,output_sha256:sha(buf),output_bytes:buf.length,
    dimensions:[W,H],scale:1,grid_px:grid,
    head:'DYNAMIC_SEE_GIT_REV_PARSE_HEAD',head_command:'git rev-parse HEAD',
    verification:checked,
    ledger_sha256:shaFile('data/hero_provenance.json'),scene_graph_sha256:shaFile('data/hero_scene.json'),
    palette_size:PALETTE.length,off_palette_pixels:offPalette,transparent_pixels:transparent,
    tile_placements:tilePlacements,mosaic_placements:mosaicPlacements,prop_placements:propPlacements,
    real_crop_placements:tilePlacements+mosaicPlacements+propPlacements-1,
    derived_hero_placements:1,contact_shadows:shadows,max_contact_shadow_px:maxShadow,
    y_sorted_objects:scene.objects.length,lights:scene.lighting.local.emitters.length,
    lighting:lightStats,
    distinct_kit_ids_used:usedIds.size,
    real_kit_ids_used:realUsed.length,
    tileable_or_trim_kit_ids_used:realUsed.filter(k=>k.role==='tileable'||k.role==='trim').length,
    hero_label:HERO_PROVENANCE_CLASS,
    verdict:{
      render:'SINGLE_NATIVE_640X360_1X_PROVENANCE_BACKED_HERO_SCENE',
      playability:'PLAYABILITY_UNPROVEN',gameplay_integration:'GAMEPLAY_INTEGRATION_BLOCKED',
      creator_visual_review:'NOT_REQUESTED_NO_WEAK_ITERATION_APPROVAL',
    },
  };
  fs.writeFileSync(path.join(ROOT,STATS),JSON.stringify(stats,null,2));
  if(offPalette||transparent)throw new Error('final image escaped the strict palette: '+offPalette+' off, '+transparent+' transparent');
  return stats;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const s=renderHero();console.log('HERO_RENDER',JSON.stringify({output:s.output,sha:s.output_sha256,dimensions:s.dimensions,tile_placements:s.tile_placements,mosaic_placements:s.mosaic_placements,prop_placements:s.prop_placements,off_palette:s.off_palette_pixels,max_shadow:s.max_contact_shadow_px}));
}
