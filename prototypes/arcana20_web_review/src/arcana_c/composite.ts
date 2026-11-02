/** Diagnostic C world-field equation on LDR Canvas pixels; no post/bloom/HDR. */
import { Frame,W,H } from './engine/frame';
import { bayer } from './engine/math';
import type { BTransform } from '../arcana_b/anchors';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function compositeC(world:Uint8ClampedArray,width:number,height:number,f:Frame,m:BTransform,camX:number,camY:number){
 if(world.length!==width*height*4)throw new Error('Invalid world buffer size');
 const orig=world.slice(),det=m.a*m.d-m.b*m.c;if(!Number.isFinite(det)||Math.abs(det)<1e-9)throw new Error('Singular transform');
 const corners=[[0,0],[W,0],[0,H],[W,H]].map(([x,y])=>({x:m.x+m.a*x+m.c*y-camX,y:m.y+m.b*x+m.d*y-camY}));
 const minX=clamp(Math.floor(Math.min(...corners.map(p=>p.x))),0,width),maxX=clamp(Math.ceil(Math.max(...corners.map(p=>p.x))),0,width);
 const minY=clamp(Math.floor(Math.min(...corners.map(p=>p.y))),0,height),maxY=clamp(Math.ceil(Math.max(...corners.map(p=>p.y))),0,height);
 for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
  const wx=x+.5+camX-m.x,wy=y+.5+camY-m.y,qx=Math.floor((m.d*wx-m.c*wy)/det),qy=Math.floor((-m.b*wx+m.a*wy)/det);
  if(qx<0||qy<0||qx>=W||qy>=H)continue;const p=qy*W+qx;if(!f.worldInfluence[p])continue;
  const qi=p*4, spx=qx+Math.floor(f.disp[qi]+.5),spy=qy+Math.floor(f.disp[qi+1]+.5),ch=f.disp[qi+3],o=ch>.2?Math.ceil(ch):0;
  const ground=(sx:number,sy:number,channel:number)=>{
   sx=clamp(sx,0,W-1);sy=clamp(sy,0,H-1);const i=(sy*W+sx)*4,alpha=f.groundCoverage[sy*W+sx];
   const ix=clamp(Math.floor(x+m.a*(sx-qx)+m.c*(sy-qy)),0,width-1),iy=clamp(Math.floor(y+m.b*(sx-qx)+m.d*(sy-qy)),0,height-1);
   return orig[(iy*width+ix)*4+channel]/255*(1-alpha)+f.ground[i+channel]/255;
  };
  const l=(sx:number,sy:number,channel:number)=>f.light[(clamp(sy,0,H-1)*W+clamp(sx,0,W-1))*4+channel];
  const sh=f.disp[qi+2],ink=f.ink[qi+3],fragment=f.worldFragment[qi+2],th=bayer(qx,qy)-.5;
  const fx=clamp(Math.floor(x+m.a*(f.worldFragment[qi]-qx)+m.c*(f.worldFragment[qi+1]-qy)),0,width-1);
  const fy=clamp(Math.floor(y+m.b*(f.worldFragment[qi]-qx)+m.d*(f.worldFragment[qi+1]-qy)),0,height-1),fi=(fy*width+fx)*4;
  const mode=f.worldFragment[qi+3],ops=f.liveLight.get(p);
  const v=[0,1,2].map(k=>{const offset=k===0?o:k===2?-o:0;const g=ground(spx+offset,spy,k)*sh;
   let frag=orig[fi+k]/255;if(mode>1.5)frag=1-frag*[2.5,3,2][k];else if(mode>.5)frag=clamp(1-frag*3,0,1)*[.45,.2,.5][k]+[.2,0,.15][k];
   let light=l(qx+offset,qy,k);if(ops)for(const op of ops){const ix=clamp(Math.floor(x+m.a*(op.sx-qx)+m.c*(op.sy-qy)),0,width-1),iy=clamp(Math.floor(y+m.b*(op.sx-qx)+m.d*(op.sy-qy)),0,height-1);light+=orig[(iy*width+ix)*4+k]/255*op.gain;}
   return g*Math.max(0,1-ink-fragment)+f.ink[qi+k]+frag*fragment+Math.floor(light*8+th+.5)/8;});
  const over=(Math.max(v[0]-1,0)+Math.max(v[1]-1,0)+Math.max(v[2]-1,0))*.45;
  const dest=(y*width+x)*4;for(let k=0;k<3;k++)world[dest+k]=Math.round(clamp(v[k]+over,0,1)*255);
 }
}
