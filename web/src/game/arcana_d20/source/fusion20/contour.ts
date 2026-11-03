/** P0 CRealityRipperFusion contour/timeline scaffold only. This is NOT a
 * complete effect and must not be shown as the #20 renderer. */
import {Rng,lerp,inv,easeIn,easeOut,noise3} from '../engine/math';
const PERM=[10,7,11,5,0,6,3,1,8,4,2,9];
export class RipperContour {
 readonly way:{x:number;y:number}[]=[];readonly cum:number[]=[0];readonly pathLength:number;
 constructor(){const rng=new Rng(151461);for(let i=0;i<9;i++){const u=i/8;let y=lerp(62,172,u);if(i!==0&&i!==8)y+=rng.r(-11,11);this.way.push({x:lerp(86,334,u),y});}for(let i=1;i<this.way.length;i++)this.cum.push(this.cum[i-1]+Math.hypot(this.way[i].x-this.way[i-1].x,this.way[i].y-this.way[i-1].y));this.pathLength=this.cum[this.cum.length-1];}
 at(s:number){const len=s*this.pathLength;let i=0;while(i<this.cum.length-2&&this.cum[i+1]<len)i++;const u=(len-this.cum[i])/(this.cum[i+1]-this.cum[i]),a=this.way[i],b=this.way[i+1],d=this.cum[i+1]-this.cum[i];return {x:lerp(a.x,b.x,u),y:lerp(a.y,b.y,u),nx:-(b.y-a.y)/d,ny:(b.x-a.x)/d};}
 width(s:number,t:number){if(t<3)return 0;let w=22*easeOut(inv(3,6,t),2)*Math.pow(Math.sin(Math.PI*s),.7)*(1+.35*(noise3(s*8,t*.6,1)-.5));if(t>6.35&&t<6.6)w*=1+.6*inv(6.35,6.6,t);const k=Math.min(11,Math.floor(s*12)),close=7.15+PERM.indexOf(k)*.16;return w*(1-easeIn(inv(close,close+.22,t),2));}
 /** Source-A warp/debris clock mapped to C open/collision/stitch beats. */
 aTime(t:number){if(t<3)return .35+inv(1.6,3,t)*.65;if(t<6.6)return 1+(t-3)*4.3/3.6;return 5.3+(t-6.6)*.8/.55;}
}
