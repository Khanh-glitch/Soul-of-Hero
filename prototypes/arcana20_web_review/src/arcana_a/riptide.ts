/** #06 P0 ARedesignSpells.RiptideCalligraphyR translation, diagnostic only.
 * It is the P0 candidate, not a full original A/C fusion, parity or approval. */
import {Framebuffer} from './engine/framebuffer';import * as D from './engine/draw';import {R,seg,easeOut,clamp,fbm,catmull,type RGB} from './engine/math';
type V={x:number;y:number};
const strokes:V[][]=[[[168,78],[196,66],[222,84],[216,118],[188,128]],[[238,70],[268,92],[292,128],[322,142]],[[196,158],[240,148],[286,162],[318,152]]].map(s=>s.map(([x,y])=>({x,y})));
export const riptidePoint=(i:number,u:number,t:number)=>{const p=catmull(strokes[i],u);return {x:p.x,y:p.y+Math.sin(u*9-t*5+i)*1.6*(1-u)};};
export const riptideFront=(t:number)=>{const p=catmull(strokes[0],.5),u=seg(t,4.6,6.4);return {x:p.x+8+150*u,y:p.y,height:12+48*easeOut(u,2)};};
export class RiptideCalligraphy {
 readonly duration=8.4;
 render(f:Framebuffer,t:number){const diss=(1-.45*seg(t,4.6,6.4))*(1-seg(t,6.8,8.4));
  for(let i=0;i<strokes.length;i++){const u=clamp(seg(t,1+i*1.1,2+i*1.1));if(u<=0)continue;const pts=Array.from({length:25},(_,k)=>riptidePoint(i,u*k/24,t)),charge=seg(t,4.2,4.6);
   D.ribbon(f,pts,s=>7.2*(.35+Math.sin(s**.8*Math.PI)*.95)*(1+charge*.25),(s,_i,edge)=>{const flow=fbm(s*14-t*2.4+i*9,edge*3,3),foam=edge**3;return [.04+flow*.07+foam*.32,.20+flow*.12+foam*.38,.28+flow*.18+foam*.42];},{blend:true,alpha:diss*.64});
   D.ribbon(f,pts,s=>4.5*(.35+Math.sin(s**.8*Math.PI)*.95)*(1+charge*.4),(s,_i,edge)=>{const flow=fbm(s*14-t*2.4+i*9,edge*3,3),h=(.24+flow*.3+edge**2.6*.65+Math.max(0,Math.sin(s*18-t*26+i*2))*charge*.7)*diss;if(h<.05)return null;const c=R('water',Math.floor(clamp(h)*8)/8);return [c[0]*.55,c[1]*.55,c[2]*.6];});
   if(u<1){const tip=riptidePoint(i,u,t);D.discBlend(f,tip.x,tip.y,2.8,[.16,.49,.58],diss*.65);D.disc(f,tip.x,tip.y,2.2,R('water',.95),diss);}
  }
  if(t>4.6&&t<6.4){const u=seg(t,4.6,6.4),front=riptideFront(t),pts:V[]=[];for(let k=0;k<33;k++){const v=k/32,side=v*2-1,curl=side*side*(5+19*u);pts.push({x:front.x-curl+Math.sin(v*Math.PI*4-t*4)*1.5,y:front.y+side*front.height});}const fade=(1-seg(t,6.1,6.4))*diss;
   D.ribbon(f,pts,v=>(3.5+6.5*Math.sin(v*Math.PI))*(.55+.45*u),(v,_i,edge)=>{const foam=edge**2.4,flow=.5+.5*Math.sin(v*19-t*12);return [.05+.30*foam,.24+.28*foam+.06*flow,.34+.30*foam+.08*flow] as RGB;},{blend:true,alpha:fade*.68});
   D.ribbon(f,pts,v=>1.3+Math.sin(v*Math.PI),(v)=>R('water',.58+.20*Math.sin(v*20-t*12)),{alpha:fade*.55});
  }
 }
}
