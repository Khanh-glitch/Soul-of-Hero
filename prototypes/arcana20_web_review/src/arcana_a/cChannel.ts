/** P0 CChainChannel connector and CBoltARaster, feeding A framebuffer.
 * Preserves C's per-stroke visited-pixel rule; not full C spell parity. */
import {Framebuffer} from './engine/framebuffer';import {boltPts,boltTree} from '../arcana_c/engine/kit';import {hash,clamp} from '../arcana_c/engine/math';import type {RGB} from './engine/math';

type V={x:number;y:number};
export class CChannel {
 private mark=new Uint32Array(416*234);private gen=0;
 private raster(f:Framebuffer,pts:V[],k:number,core:RGB,halo:RGB,width:number){if(k<=.01||pts.length<2)return;if(this.mark.length!==f.W*f.H){this.mark=new Uint32Array(f.W*f.H);this.gen=0;}if(++this.gen===0xffffffff){this.mark.fill(0);this.gen=1;}const generation=this.gen;
  for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];if(width<=0)continue;const mw=width+1,x0=Math.max(0,Math.floor(Math.min(a.x,b.x)-mw)),x1=Math.min(f.W-1,Math.ceil(Math.max(a.x,b.x)+mw)),y0=Math.max(0,Math.floor(Math.min(a.y,b.y)-mw)),y1=Math.min(f.H-1,Math.ceil(Math.max(a.y,b.y)+mw)),dx=b.x-a.x,dy=b.y-a.y,ll=dx*dx+dy*dy||1e-6;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const idx=y*f.W+x;if(this.mark[idx]===generation)continue;const px=x+.5-a.x,py=y+.5-a.y,u=clamp((px*dx+py*dy)/ll),qx=px-dx*u,qy=py-dy*u,d=Math.hypot(qx,qy);if(d<=width+.001&&width>.25){this.mark[idx]=generation;const edge=d/Math.max(width,.5),c=edge<.45?core:halo,amount=edge<.45?k*1.3:k*(1.2-edge);f.addPx(x,y,c[0]*amount,c[1]*amount,c[2]*amount);}}}
 }
 draw(f:Framebuffer,a:V,b:V,t:number,seed:number,k:number,core:RGB,halo:RGB,width=1.6,rough=.32,branches=5){const pts=boltPts(seed,a.x,a.y,b.x,b.y,rough,3),variant=((Math.floor(t*30)%3)+3)%3,varied=pts.map((p,j)=>j===0||j===pts.length-1?p:{x:p.x+(hash(seed+variant*31+j)-.5)*3,y:p.y+(hash(seed+variant*17+j*3)-.5)*3});this.raster(f,varied,k,core,halo,width);for(let i=0;i<branches;i++){const index=Math.floor(hash(seed+variant*7+i*13)*(pts.length-2))+1,p=pts[Math.max(0,Math.min(pts.length-1,index))],ang=hash(seed+i*5+variant)*Math.PI*2,len=6+hash(seed+i)*18;for(const branch of boltTree(seed+variant*100+i,p.x,p.y,p.x+Math.cos(ang)*len,p.y+Math.sin(ang)*len,1,.35,1))this.raster(f,branch.pts,k*branch.w,core,halo,1);}}
}
