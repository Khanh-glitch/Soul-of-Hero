/** P0 RootwakeR candidate, experimental and not an art approval. Parent and
 * child roots share attachment coordinates, and retract from the same network. */
import {Framebuffer} from './engine/framebuffer';
import * as D from './engine/draw';
import {clamp,seg,hash2,R,type RGB} from './engine/math';
type V={x:number;y:number};type Branch={pts:V[];w:number;depth:number;seed:number;attach:number};
const v=(x:number,y:number):V=>({x,y});const add=(a:V,b:V)=>v(a.x+b.x,a.y+b.y);const sub=(a:V,b:V)=>v(a.x-b.x,a.y-b.y);const mul=(a:V,k:number)=>v(a.x*k,a.y*k);const mix=(a:V,b:V,k:number)=>add(a,mul(sub(b,a),k));const norm=(a:V)=>{const l=Math.hypot(a.x,a.y)||1;return mul(a,1/l)};
const round=(x:number)=>x<0?-Math.round(-x):Math.round(x);
export const ROOT_ORIGIN=v(114,146);
export const ROOT_TIPS=[v(220,131),v(232,134),v(244,131)];
export function rootCurve(origin:V,target:V,index:number,u:number):V{const delta=sub(target,origin),normal=norm(v(-delta.y,delta.x)),side=index-1;return add(mix(origin,target,u),mul(normal,Math.sin(Math.PI*u)*(side*18+Math.sin(u*Math.PI*2+index)*4)));}
export function buildRootNetwork():Branch[][]{return ROOT_TIPS.map((target,i)=>{const points=Array.from({length:25},(_,n)=>rootCurve(ROOT_ORIGIN,target,i,n/24)),branches:Branch[]=[{pts:points,w:3.2,depth:0,seed:13131+i,attach:0}];for(let j=0;j<4;j++){const index=round([.25,.4583333333,.625,.7916666667][j]*24),attach=index/24,base=points[index],tangent=norm(sub(points[Math.min(index+1,24)],points[Math.max(index-1,0)])),normal=mul(v(-tangent.y,tangent.x),(i+j)%2===0?-1:1),child=Array.from({length:13},(_,n)=>{const u=n/12;return add(base,add(mul(tangent,19*u),mul(normal,17*Math.sin(u*Math.PI*.5)+6*u*u)));});branches.push({pts:child,w:1.8-j*.15,depth:1,seed:13300+i*4+j,attach});}return branches;});}
export function rootGrowth(index:number,t:number){return clamp((t-.8-index*.4)/2.2);}
function lifted(b:Branch,lift:number){return b.pts.map((p,n)=>{const u=n/(b.pts.length-1),along=b.depth===0?u:b.attach+(1-b.attach)*u;return v(p.x,p.y-lift*Math.sin(Math.PI*along));});}
function branchDraw(f:Framebuffer,b:Branch,grow:number,thickening:number,blend:boolean){const pts=b.pts,n=pts.length,limit=grow*(n-1);if(limit<=0)return;for(let i=0;i<Math.min(n-1,Math.ceil(limit));i++){const p=pts[i],q=pts[i+1],factor=clamp(limit-i),u0=i/(n-1),ex=p.x+(q.x-p.x)*factor,ey=p.y+(q.y-p.y)*factor,dx=ex-p.x,dy=ey-p.y,len=Math.max(1,Math.hypot(dx,dy));for(let s=0;s<=len;s++){const u=u0+s/len/(n-1),cx=p.x+dx*s/len,cy=p.y+dy*s/len,w=blend?Math.max(.8,b.w*(.65+thickening*1.45)*(1-u*.65)):Math.max(.5,b.w*.35*(1-u*.6)),nx=-dy/len,ny=dx/len;for(let k=-Math.ceil(w);k<=Math.ceil(w);k++){const edge=Math.abs(k)/(w||1);if(edge>1)continue;let c:RGB;if(blend){if(edge>.95)c=[.09,.13,.06];else{const grain=.84+.16*hash2(Math.floor(u*35),b.seed),bark=.62+.38*(1-edge);c=[.32*bark*grain,.30*bark*grain,.13*bark*grain];}}else{if(edge>.8)continue;const k=1-edge*.4;c=[.37*k,.48*k,.18*k];}const x=cx+nx*k,y=cy+ny*k;if(blend)f.blend(round(x),round(y),...c,1);else f.add(x,y,...c,1);}}}}
export class Rootwake {
 readonly duration=8.4;readonly roots=buildRootNetwork();
 render(f:Framebuffer,t:number){const retract=1-seg(t,7.2,8.4),tension=seg(t,4,5.4)*retract,thickening=seg(t,1.6,3.6);
  for(let i=0;i<this.roots.length;i++){const branches=this.roots[i],growth=rootGrowth(i,t),visible=growth*retract;for(const b of branches){const g=b.depth===0?visible:clamp((growth-b.attach)/.22)*clamp((visible-b.attach)/(1-b.attach)),current={...b,pts:lifted(b,tension*15)};branchDraw(f,current,g,thickening,true);branchDraw(f,current,g,thickening,false);}}
  if(tension<=0)return;
  for(let i=0;i<this.roots.length;i++){const main=this.roots[i][0],visible=rootGrowth(i,t)*retract,attached=clamp((visible-.75)/.25);if(attached<=.001)continue;const tp=lifted(main,tension*15)[18],endpoint=mix(tp,ROOT_TIPS[i],tension*tension*attached),control=add(mix(tp,endpoint,.5),v((i-1)*4,-22*tension*attached));const bezier=(u:number)=>add(add(mul(tp,(1-u)*(1-u)),mul(control,2*(1-u)*u)),mul(endpoint,u*u)),points=Array.from({length:13},(_,n)=>bezier(n/12));
   D.ribbon(f,points,u=>(3.4-u*2.1)*tension*attached,(_u,_j,edge)=>edge>.65?[.16,.24,.07]:[.35,.42,.13],{blend:true,alpha:retract});
   for(const barb of [.36,.68]){const base=bezier(barb),tangent=norm(add(mul(sub(control,tp),1-barb),mul(sub(endpoint,control),barb))),side=mul(v(-tangent.y,tangent.x),i%2===0?-1:1),tip=add(base,mul(add(mul(tangent,8),mul(side,9)),tension*attached)),foot=mul(tangent,2.8*tension*attached);D.polyFill(f,[sub(base,foot),tip,add(base,foot)],()=>[.19,.31,.08],true,tension*retract*attached);D.streak(f,base.x,base.y,tip.x,tip.y,.8,.4,R('verdant',.7),tension*retract*attached*.5);}
  }
 }
}
