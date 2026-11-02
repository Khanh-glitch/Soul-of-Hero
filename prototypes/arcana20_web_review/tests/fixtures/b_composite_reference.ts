/** CPU prototype of the P0 B world-field equation. This is not a HDR scene or
 * a claim of visual equivalence: Canvas supplies 8-bit LDR world pixels. */
import { W,H,bayer,type Renderer } from '../../src/arcana_b/engine/renderer';
import type { BTransform } from '../../src/arcana_b/player';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function tone(r:number,g:number,b:number,x:number,y:number) {
  const mx=Math.max(r,g,b),ex=mx>1.1?(mx-1.1)*0.32:0,d=bayer(x,y)-0.5;
  return [r,g,b].map(v=>Math.floor(clamp((1-Math.exp(-(v+ex)*1.05))*20+d,0,20))/20);
}
/** In-place output; world is an RGBA byte snapshot. Camera is in world pixels.
 * Uses operation coverage, including SET-to-black, not colour-derived alpha. */
export function referenceCompositeB(world:Uint8ClampedArray,width:number,height:number,r:Renderer,m:BTransform,camX:number,camY:number) {
  if(world.length!==width*height*4)throw new Error('Invalid world buffer size');
  const source=world.slice();const det=m.a*m.d-m.b*m.c;if(!Number.isFinite(det)||Math.abs(det)<1e-9)throw new Error('Singular source transform');
  const corners=[[0,0],[W,0],[0,H],[W,H]].map(([x,y])=>({x:m.x+m.a*x+m.c*y-camX,y:m.y+m.b*x+m.d*y-camY}));
  const minX=clamp(Math.floor(Math.min(...corners.map(p=>p.x))),0,width), maxX=clamp(Math.ceil(Math.max(...corners.map(p=>p.x))),0,width);
  const minY=clamp(Math.floor(Math.min(...corners.map(p=>p.y))),0,height), maxY=clamp(Math.ceil(Math.max(...corners.map(p=>p.y))),0,height);
  const ar=r.ambient*r.tint[0],ag=r.ambient*r.tint[1],ab=r.ambient*r.tint[2];
  for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
    const wx=x+0.5+camX-m.x,wy=y+0.5+camY-m.y;
    const px=Math.floor((m.d*wx-m.c*wy)/det),py=Math.floor((-m.b*wx+m.a*wy)/det);
    if(px<0||py<0||px>=W||py>=H)continue;
    const p=py*W+px;if(!r.worldInfluence[p])continue;
    const spx=clamp(px+Math.trunc(r.worldWarp[p*2]),0,W-1),spy=clamp(py+Math.trunc(r.worldWarp[p*2+1]),0,H-1),sp=spy*W+spx;
    const screenX=clamp(Math.floor(x+m.a*(spx-px)+m.c*(spy-py)),0,width-1);
    const screenY=clamp(Math.floor(y+m.b*(spx-px)+m.d*(spy-py)),0,height-1);
    const i=(y*width+x)*4,j=(screenY*width+screenX)*4, ink=p*3, ground=sp*3, da=r.decalCoverage[sp], ia=r.inkCoverage[p], sh=r.shade[sp];
    const original=[source[i]/255,source[i+1]/255,source[i+2]/255], warped=[source[j]/255,source[j+1]/255,source[j+2]/255];
    const tint=[ar,ag,ab];const authored=[0,1,2].map(ch=>r.main[ink+ch]+(warped[ch]*(1-da)+r.alb[ground+ch])*sh*(tint[ch]+r.lightBuf[ground+ch])*(1-ia));
    const actual=tone(authored[0],authored[1],authored[2],px,py),neutral=tone(original[0]*ar,original[1]*ag,original[2]*ab,px,py);
    for(let ch=0;ch<3;ch++)world[i+ch]=Math.round(clamp(original[ch]+actual[ch]-neutral[ch],0,1)*255);
  }
}
