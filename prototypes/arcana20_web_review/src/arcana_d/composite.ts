/** Scalar approximation of the D diagnostic world pass; synthetic tests only. */
import type {BTransform} from '../arcana_b/anchors';import type {DWarp} from './warp';import type {DCommand} from './commands';import {dInfluence} from './influence';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const tone=(v:number[],x:number,y:number)=>{const c=v.map(z=>clamp((z*(2.51*z+.03))/(z*(2.43*z+.59)+.14),0,1)),l=c[0]*.2126+c[1]*.7152+c[2]*.0722,b=(bayer[(y&3)*4+(x&3)]+.5)/16;return c.map(z=>Math.floor(clamp(l+(z-l)*1.1,0,1)*26+b)/26);};
export function compositeD(world:Uint8ClampedArray,width:number,height:number,light:Uint8ClampedArray,commands:DCommand[],warp:DWarp,m:BTransform,cx:number,cy:number,time:number,fade:number){const original=world.slice(),infl=dInfluence(commands,warp),det=m.a*m.d-m.b*m.c;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const wx=x+.5+cx-m.x,wy=y+.5+cy-m.y,px=Math.floor((m.d*wx-m.c*wy)/det),py=Math.floor((-m.b*wx+m.a*wy)/det);if(px<0||py<0||px>=480||py>=270||!infl[py*480+px])continue;const i=(py*480+px)*4,o=(y*width+x)*4,base=[original[o]/255,original[o+1]/255,original[o+2]/255],dx=-warp.data[i]*fade,dy=-warp.data[i+1]*fade;
  const sample=(k:number,mult:number)=>{const sx=clamp(Math.floor(x+.5+(m.a*dx+m.c*dy)*mult),0,width-1),sy=clamp(Math.floor(y+.5+(m.b*dx+m.d*dy)*mult),0,height-1);return original[(sy*width+sx)*4+k]/255;};
  const shade=(1-clamp(warp.data[i+2]*fade,0,.985))*(1+warp.data[i+3]*fade*.1*Math.sin((1-(py+.5)/270)*180+time*8)),auth=[sample(0,1.35)*shade+light[i]/255,sample(1,1)*shade+light[i+1]/255,sample(2,.65)*shade+light[i+2]/255],a=tone(auth,px,py),b=tone(base,px,py);for(let k=0;k<3;k++)world[o+k]=Math.round(clamp(base[k]+(a[k]-b[k])*fade,0,1)*255);
 }
}
