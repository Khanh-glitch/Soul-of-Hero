// Lighting for the single hero scene: one cool ambient base plus small,
// discrete warm/cool local pools.  There are NO runtime RGB gradients here.
// Every emitted pixel is an exact colour from the authored 36-colour ladder.
// Light shape comes from the real prototype `light_radial.png` crop, whose
// alpha is quantized into four hard bands; intensity moves a pixel along a
// fixed hue-shifted value ladder instead of mixing arbitrary colours.
import {PALETTE, nearestIndex} from './palette.mjs';
import {nearestDownsample} from './palette.mjs';
import {rawLightStencil} from './kit.mjs';

export const LADDERS = {
  void:  [0,1,2,3,4],
  stone: [5,6,7,8,9],
  brass: [10,11,12,13,14,35],
  cyan:  [15,16,17,18,19],
  ember: [20,21,22,23,24],
  water: [25,26,27,28,29],
  green: [30,31,32,33,34],
};
const FAMILY = {};
for(const [fam,ids] of Object.entries(LADDERS)) ids.forEach((idx,pos)=>{FAMILY[idx]={fam,pos};});
const RGB_TO_INDEX = new Map(PALETTE.map((c,i)=>[((c[0]<<16)|(c[1]<<8)|c[2]),i]));
const key=(d,i)=>((d[i]<<16)|(d[i+1]<<8)|d[i+2]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/** Force every opaque pixel back to an exact authored palette entry. */
export function snapPalette(pix){
  const d=pix.data;
  for(let i=0;i<d.length;i+=4){
    const k=key(d,i);let idx=RGB_TO_INDEX.get(k);
    if(idx===undefined) idx=nearestIndex([d[i],d[i+1],d[i+2]],'all');
    const c=PALETTE[idx];d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255;
  }
  return pix;
}

function stencilFor(radius){
  const size=Math.max(2,Math.round(radius*2)), raw=rawLightStencil();
  const s=nearestDownsample(raw,256/size,size,size);
  const bands=new Uint8Array(size*size);
  for(let i=0;i<bands.length;i++){
    const a=s.data[i*4+3];
    // Thresholds taken from the donor's measured radial alpha profile:
    // centre 255, r=24 168, r=48 99, r=64 63, r=96 15, edge 0.
    bands[i]=a>=150?3:a>=60?2:a>=12?1:0;
  }
  return {size,bands};
}

/** Discrete, deterministic light field; returns per-pixel statistics. */
export function applyLighting(pix, scene){
  const emitters=scene.lighting.local.emitters.map(e=>({...e,stencil:stencilFor(e.radius)}));
  const d=pix.data, W=pix.width, H=pix.height;
  const stats={warm_pixels:0,cool_pixels:0,ambient_pixels:W*H,family_counts:{},max_levels:{warm:0,cool:0}};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4;
    let idx=RGB_TO_INDEX.get(key(d,i));
    if(idx===undefined) idx=nearestIndex([d[i],d[i+1],d[i+2]],'all');
    let {fam,pos}=FAMILY[idx];
    // Cool ambient: one step down the value ladder; stone/green shadows shift to blue-violet water ramp.
    pos=clamp(pos-1,0,LADDERS[fam].length-1);
    if(fam==='stone'||fam==='green') fam='water';
    let warm=0,cool=0;
    for(const e of emitters){
      const sx=x-e.x+e.radius, sy=y-e.y+e.radius;
      if(sx<0||sy<0||sx>=e.stencil.size||sy>=e.stencil.size)continue;
      const band=e.stencil.bands[Math.floor(sy)*e.stencil.size+Math.floor(sx)];
      const level=Math.max(0,Math.ceil(band*e.power/3));
      if(e.type==='warm')warm=Math.max(warm,level);else cool=Math.max(cool,level);
    }
    if(warm){
      // Three discrete, hard-edged bands: brighten first, warm the middle,
      // gild only the innermost band. No single flat disc of brass.
      pos=clamp(pos+Math.min(1,warm),0,LADDERS[fam].length-1);
      if(warm>=2&&(fam==='water'||fam==='green'||fam==='void')) fam='brass';
      if(warm>=3&&fam==='stone') fam='brass';
      stats.warm_pixels++;stats.max_levels.warm=Math.max(stats.max_levels.warm,warm);
    }
    if(cool){
      pos=clamp(pos+Math.min(2,cool),0,LADDERS[fam].length-1);
      if(fam==='ember') fam='brass';                      // cool spill desaturates ember red
      stats.cool_pixels++;stats.max_levels.cool=Math.max(stats.max_levels.cool,cool);
    }
    const target=LADDERS[fam], c=PALETTE[target[clamp(pos,0,target.length-1)]];
    d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255;
    stats.family_counts[fam]=(stats.family_counts[fam]||0)+1;
  }
  return stats;
}
