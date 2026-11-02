/** #12 P0 SkybreakerScriptR source translation, developer diagnostic only.
 * A/C fusion remains unverified; no claim of full P0 or production parity. */
import {Framebuffer} from './engine/framebuffer';
import * as D from './engine/draw';
import {R,seg,clamp,catmull,type RGB} from './engine/math';
import {boltTree} from '../arcana_c/engine/kit';
type V={x:number;y:number};
const v=(x:number,y:number):V=>({x,y});
const mix=(a:V,b:V,t:number)=>v(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
const glyph:V[][]=[[[196,60],[232,48],[268,60]],[[232,48],[232,96]],[[200,96],[232,84],[264,96]],[[232,96],[214,132],[252,138]]].map(s=>s.map(([x,y])=>v(x,y)));
const inner=[v(232,48),v(264,96),v(252,138),v(200,96)];
export function skybreakerNode(i:number):V{if(i===14)return v(232,101);const outer=i<9,index=outer?i:i-9,count=outer?9:5,angle=index*Math.PI*2/count+(outer?0:.5),radius=outer?71:34;return v(232+Math.cos(angle)*radius,101+Math.sin(angle)*radius/1.35);}
export function skybreakerEdge(i:number):[V,V]{if(i<9)return [skybreakerNode(i),skybreakerNode((i+3)%9)];if(i<14){const n=i-9;return [skybreakerNode(9+n),skybreakerNode(9+(n+2)%5)];}return [skybreakerNode(9+i-14),skybreakerNode(14)];}
function framePoint(i:number):V{const a=-Math.PI*.5+i*Math.PI*2/8;return v(232+Math.cos(a)*82,101+Math.sin(a)*69);}
function voltStreak(f:Framebuffer,a:V,b:V,w0:number,w1:number,c:number,k:number){D.streak(f,a.x,a.y,b.x,b.y,w0,w1,R('volt',c),k);}
function bolt(f:Framebuffer,a:V,b:V,seed:number,strength:number,width:number){for(const branch of boltTree(seed,a.x,a.y,b.x,b.y,2,.24)){const {pts,w}=branch;for(let i=0;i<pts.length-1;i++)D.streak(f,pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y,width*w,width*w,R('volt',.6),strength*w*.9);for(let i=0;i<pts.length-1;i++)D.line(f,pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y,R('volt',1),strength*w);}}
export class SkybreakerScript {
 readonly duration=8.6;
 render(f:Framebuffer,t:number){const dis=1-seg(t,8.45,8.6);
  for(let i=0;i<8;i++){
   const begin=1.05+i*.22,written=seg(t,begin,begin+.42),out=7.65+(7-i)*.095,left=1-seg(t,out,out+.27);if(written<=0||left<=0)continue;
   const p0=framePoint(i),p1=framePoint((i+1)%8),failure=seg(t,6.05,6.8),trim=failure*.08,start=mix(p0,p1,trim),end=mix(p0,p1,Math.min(written,1-trim)),intensity=left*dis*(.45+.30*seg(t,3.4,4.3));
   D.ribbon(f,[start,end],()=>1.5,()=>[.17,.23,.42],{blend:true,alpha:intensity*.43});voltStreak(f,start,end,1.5,1.1,.72,intensity);
   if(written>.92){const mid=mix(p0,p1,.5),dx=mid.x-232,dy=mid.y-101,len=Math.hypot(dx,dy)||1,rad=v(dx/len,dy/len),tan=v(-rad.y,rad.x),tick0=v(mid.x-tan.x*4,mid.y-tan.y*4),tick1=v(mid.x+rad.x*7,mid.y+rad.y*7),tick2=v(mid.x+tan.x*4,mid.y+tan.y*4);voltStreak(f,tick0,tick1,.8,.8,.82,intensity);voltStreak(f,tick1,tick2,.8,.8,.82,intensity);
    if(t>=3.6&&t<6.8){const charge=mix(p0,p1,((t-3.6)*.65+i*.125)%1);D.disc(f,charge.x,charge.y,1.5,R('volt',1),intensity*.85);}
    if(i%2===0){const anchor=inner[i>>1],node=mix(p0,anchor,.64),wingA=v(node.x+tan.x*4,node.y+tan.y*4),wingB=v(node.x-tan.x*4,node.y-tan.y*4);voltStreak(f,p0,node,.9,.8,.62,intensity);voltStreak(f,node,anchor,.8,.7,.80,intensity);voltStreak(f,wingA,node,.65,.65,.78,intensity);voltStreak(f,wingB,node,.65,.65,.78,intensity);}
   }
  }
  for(let i=0;i<19;i++){
   const written=seg(t,.65+i*.14,1.05+i*.14),remaining=1-seg(t,7.12+(18-i)*.055,7.32+(18-i)*.055);if(written<=.001||remaining<=.001)continue;const [p0,p1]=skybreakerEdge(i),end=mix(p0,p1,written*remaining);
   D.ribbon(f,[p0,end],()=>1,()=>[.19,.22,.40],{blend:true,alpha:.35*remaining});voltStreak(f,p0,end,.85,.8,.65,.48*remaining);
   if(t>=3.6&&t<6.8&&i%4===0){const charge=mix(p0,p1,((t-3.6)*.9+i*.17)%1);D.disc(f,charge.x,charge.y,1.1,R('volt',1),.8*remaining);}
  }
  for(let i=0;i<glyph.length;i++){
   const begin=7.8+(glyph.length-1-i)*.15,u=clamp(seg(t,.8+i*.55,1.35+i*.55))*(1-seg(t,begin,begin+.25));if(u<=0)continue;
   const stroke=glyph[i],pts=Array.from({length:17},(_,k)=>{const su=u*k/16;return stroke.length>2?catmull(stroke,su):mix(stroke[0],stroke[stroke.length-1],su);});
   D.ribbon(f,pts,()=>1.8,(_s,_i,edge):RGB|null=>{const h=(1-edge)*dis;return h<.05?null:R('volt',.4+h*.55);});
   if(t>3.6){const pu=(t*.7+i*.23)%1,pp=pts[Math.min(pts.length-1,Math.floor(pu*pts.length))];D.glow(f,pp.x,pp.y,6,R('volt',.9),dis);}
  }
  for(let i=0;i<3;i++){const lt=t-(4.4+i*.7);if(lt<0||lt>.42)continue;const tx=200+i*34;bolt(f,v(tx,40),v(tx,118),i*571+Math.floor(lt/.05)*13,1-seg(lt,.42*.24,.42),2.1);}
  const ft=t-6.8;if(ft>=0&&ft<.6){bolt(f,v(232,26),v(232,150),991+Math.floor(ft/.05)*7,1-seg(ft,.6*.24,.6),3.8);D.pulseRing(f,232,150,6+ft*120,3,R('volt',.7),.6*(1-ft/.6),1.7);}
 }
}
