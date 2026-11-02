import type {BTransform} from '../arcana_b/anchors';import type {Framebuffer} from './engine/framebuffer';
const tone=(x:number)=>x<=0?0:Math.min(1,Math.pow((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),1/1.42));
/** Scalar reference / WebGL fallback. Intentionally processes every mapped
 * source pixel: no brightness-keyed transparency or dropped dark pixels. */
export function compositeA(data:Uint8ClampedArray,w:number,h:number,f:Framebuffer,m:BTransform,cx:number,cy:number){const det=m.a*m.d-m.b*m.c, influence=f.expandedInfluence();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const wx=x+.5-(m.x-cx),wy=y+.5-(m.y-cy),sx=Math.floor((m.d*wx-m.c*wy)/det+.0001),sy=Math.floor((-m.b*wx+m.a*wy)/det+.0001);if(sx<0||sy<0||sx>=f.W||sy>=f.H)continue;const p=sy*f.W+sx;if(!influence[p])continue;const i=p*3,o=(y*w+x)*4,bx=Math.max(0,Math.min(f.bw-1,(sx+.5)*.25-.5)),by=Math.max(0,Math.min(f.bh-1,(sy+.5)*.25-.5)),x0=Math.floor(bx),y0=Math.floor(by),x1=Math.min(f.bw-1,x0+1),y1=Math.min(f.bh-1,y0+1),fx=bx-x0,fy=by-y0;
  for(let c=0;c<3;c++){const a=f.bloomA[(y0*f.bw+x0)*3+c],b=f.bloomA[(y0*f.bw+x1)*3+c],d=f.bloomA[(y1*f.bw+x0)*3+c],e=f.bloomA[(y1*f.bw+x1)*3+c],bloom=(a*(1-fx)+b*fx)*(1-fy)+(d*(1-fx)+e*fx)*fy,base=data[o+c]/255,auth=base*f.multiplier[p]*(1-f.coverage[p])+f.buf[i+c]+bloom*.75;data[o+c]=Math.round(Math.max(0,Math.min(1,base+tone(auth)-tone(base)))*255);}
 }
}
