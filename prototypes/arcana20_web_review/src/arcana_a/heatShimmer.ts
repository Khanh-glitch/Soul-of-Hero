/** Original A heat shimmer with P0's separate world-warp metadata. */
import {Framebuffer} from './engine/framebuffer';
import {clamp,vnoise} from './engine/math';
export function heatShimmer(fb:Framebuffer,cx:number,cy:number,r:number,t:number,amp:number){
 const x0=Math.max(1,Math.floor(cx-r)),x1=Math.min(fb.W-2,Math.ceil(cx+r)),y0=Math.max(1,Math.floor(cy-r)),y1=Math.min(fb.H-2,Math.ceil(cy+r));if(x1<=x0||y1<=y0)return;
 const w=x1-x0+1,h=y1-y0+1,tmp=new Float32Array(w*h*3),coverage=fb.coverage.slice(),multiplier=fb.multiplier.slice(),warp=fb.warp.slice();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=((y+y0)*fb.W+x+x0)*3,o=(y*w+x)*3;tmp[o]=fb.buf[i];tmp[o+1]=fb.buf[i+1];tmp[o+2]=fb.buf[i+2];}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const gx=x+x0,gy=y+y0,d=Math.hypot(gx-cx,gy-cy)/r;if(d>1)continue;const f=(1-d)*amp,dy=Math.round((vnoise((gx+.5)*.18,(gy+.5)*.1-t*6)-.5)*2*f),dx=Math.round((vnoise(gx*.12+40,gy*.14-t*4)-.5)*1.4*f),sx=clamp(x+dx,0,w-1)|0,sy=clamp(y+dy,0,h-1)|0,src=(sy+y0)*fb.W+sx+x0,dst=gy*fb.W+gx,si=(sy*w+sx)*3,i=dst*3;
  fb.buf[i]=tmp[si];fb.buf[i+1]=tmp[si+1];fb.buf[i+2]=tmp[si+2];fb.coverage[dst]=coverage[src];fb.multiplier[dst]=multiplier[src];fb.warp[dst*2]=warp[src*2]+sx-x;fb.warp[dst*2+1]=warp[src*2+1]+sy-y;fb.influence[dst]=1;
 }fb.hasWarp=true;fb.invalidateInfluence();
}
