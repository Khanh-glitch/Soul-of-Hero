// Deterministic cleanup of ONE AI-derived hero prop. This file never turns the
// AI image into a donor crop: the ledger keeps provenance_class AI_DERIVED.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {Pix} from '../lib/pixels.mjs';
const ROOT=process.cwd();
export const HERO_PROMPT = `Pure magenta #FF00FF studio background; one single crisp pixel-art brass octagonal ring or lens housing with four cyan crystalline prongs pointing inward, a luminous cyan circular core, rivets and stone feet; centered with clean >=12% magenta margins on every side; no letters, numbers, words, glyphs, labels, cardinal marks, border, frame, text of any kind; no blue square corner brackets or UI; no debris, no speckles, no sparkles, no stars, no isolated objects; one complete prop with nothing cropped; flat pure magenta in all empty space, including gaps; top-down game sprite, consistent pixel density, clear silhouette, no background scene or collage.`;
const SOURCE='assets/source/derived/great_lens_ai_hero_v3.png',OUT='assets/source/derived/great_lens_hero_v4_clean.png';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function magenta(p,i,tol=70){return Math.abs(p[i]-255)+Math.abs(p[i+1]-0)+Math.abs(p[i+2]-255)<=tol;}
function components(w,h,data){
  const keep=new Uint8Array(w*h),seen=new Uint8Array(w*h),out=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const k=y*w+x,i=k*4;if(seen[k]||data[i+3]<40||magenta(data,i))continue;
    const stack=[k],cells=[];seen[k]=1;
    while(stack.length){const q=stack.pop(),qx=q%w,qy=(q-qx)/w,qi=q*4;cells.push(q);
      const ns=[];if(qx>0)ns.push(q-1);if(qx<w-1)ns.push(q+1);if(qy>0)ns.push(q-w);if(qy<h-1)ns.push(q+w);
      for(const n of ns){const ni=n*4;if(seen[n]||data[ni+3]<40||magenta(data,ni))continue;seen[n]=1;stack.push(n);}
    }
    let x0=w,y0=h,x1=0,y1=0;for(const c of cells){const cx=c%w,cy=(c-cx)/w;if(cx<x0)x0=cx;if(cy<y0)y0=cy;if(cx>x1)x1=cx;if(cy>y1)y1=cy;}
    out.push({area:cells.length,bounds:[x0,y0,x1-x0+1,y1-y0+1],cells});
  }
  return out.sort((a,b)=>b.area-a.area);
}
export function cleanDerivedHero(){
  const srcBuf=fs.readFileSync(path.join(ROOT,SOURCE)),src=PNG.sync.read(srcBuf),w=src.width,h=src.height;
  const srcData=src.data,comps=components(w,h,srcData),kept=comps.filter(c=>c.area>=350);
  const keep=new Uint8Array(w*h);for(const c of kept)for(const q of c.cells)keep[q]=1;
  let x0=w,y0=h,x1=0,y1=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(keep[y*w+x]){if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;}
  const cw=x1-x0+1,ch=y1-y0+1,margin=Math.max(160,Math.ceil(Math.max(cw,ch)*.19)),S=Math.ceil((Math.max(cw,ch)+2*margin)/8)*8;
  // 1216x1216 was chosen to preserve integer /8 nearest-neighbour density.
  const size=1216,m=Math.floor((size-Math.max(cw,ch))/2),ox=Math.floor((size-cw)/2),oy=Math.floor((size-ch)/2);
  const out=new Pix(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sx=x-ox+x0,sy=y-oy+y0,i=(y*size+x)*4;
    out.data[i]=255;out.data[i+1]=0;out.data[i+2]=255;out.data[i+3]=255;
    if(sx>=x0&&sx<=x1&&sy>=y0&&sy<=y1&&keep[sy*w+sx]){
      const si=(sy*w+sx)*4;out.data[i]=srcData[si];out.data[i+1]=srcData[si+1];out.data[i+2]=srcData[si+2];out.data[i+3]=srcData[si+3];
    }
  }
  const png=new PNG({width:size,height:size});png.data=Buffer.from(out.data);const buf=PNG.sync.write(png);
  fs.writeFileSync(path.join(ROOT,OUT),buf);
  const donorNames=['assets/source/prototype/assets_environment_chapter1_gatehouse_gatehouse_tiles.png','assets/source/prototype/assets_environment_chapter1_gatehouse_gatehouse_props.png','assets/source/prototype/assets_environment_chapter1_relay_relay_props.png','assets/source/prototype/assets_environment_chapter1_vigil_vigil_props.png','_scratch/proto_art/ward_medallions.png'];
  const donor_sources=donorNames.map(file=>({file,exists:fs.existsSync(path.join(ROOT,file)),sha256:fs.existsSync(path.join(ROOT,file))?sha(fs.readFileSync(path.join(ROOT,file))):null}));
  const notice={
    provenance_class:'AI_DERIVED_HERO_PROP_NOT_REAL_ASSET',
    notice:'The image tool always emits AI-generated imagery, even with real donor images attached. This prop is art-directed from donor sheets, NOT a donor crop and NOT real-asset proof. Real-crop evidence is in the separate asset ledger.',
    source:SOURCE,source_sha256:sha(srcBuf),output:OUT,output_sha256:sha(buf),output_dimensions:[size,size],
    prompt:HERO_PROMPT,prompt_sha256:sha(HERO_PROMPT),donor_sources,
    cleanup:{method:'magenta flood-fill exterior; connected-component debris removal; centered deterministic pad; no AI regeneration',non_magenta_bounds:[x0,y0,cw,ch],padding_px:ox+oy,margin_fraction:+(((size-Math.max(cw,ch))/2)/size).toFixed(4),kept_components:kept.map(c=>({area:c.area,bounds:c.bounds})),rejected_components:comps.length-kept.length},
    intended_use:'One derived hero prop within ONE Argus L2 visual candidate; never cited as real-asset provenance.',
  };
  fs.writeFileSync(path.join(ROOT,'data/hero_derived_notice.json'),JSON.stringify(notice,null,2));
  return notice;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const n=cleanDerivedHero();console.log('derived hero',n.output,n.output_sha256,n.cleanup.margin_fraction,n.cleanup.kept_components.length);
}
