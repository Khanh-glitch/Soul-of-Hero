/** #01 C outer-tongue role from P0 CCinderCrown.render_outer_flame.
 * No extra crown, particles, scar, contact, shock or post is drawn here. */
import {Frame} from './engine/frame';import {Rng,TAU,clamp,inv,easeOut,noise3,stepT,type V2} from './engine/math';import {P,ramp} from './engine/palette';
type Petal={a:number;L:number;w:number;dur:number;del:number;curl:number;seed:number;peel:number};
export class CinderOuter {
 readonly petals:Petal[]=[];
 constructor(){const rng=new Rng(1000);
  // Preserve P0's setup evaluation order, including unused source structures:
  // outer petals share the seeded stream with the full C crown.
  for(let i=0;i<10;i++){const fast=i===3||i===8;if(!fast){const n=rng.i(1,2);for(let k=0;k<n;k++){rng.r(.15,.85);rng.r(7,17);}}rng.r(-1,1.5);rng.r(0,TAU);rng.r(.7,1.7);rng.r(2.8,5.2);if(!fast)rng.r(.45,1.5);rng.sign();rng.r(-5,5);rng.r(0,.3);}
  for(let i=0;i<110;i++){rng.next();rng.r(0,TAU);rng.r(60,150);rng.r(.6,1.9);rng.r(1.5,3.5);rng.sign();}
  for(let i=0;i<7;i++)this.petals.push({a:i/7*TAU+rng.r(-.4,.4),L:rng.r(48,118),w:rng.r(9,20),dur:rng.r(.16,.5),del:rng.r(0,.12),curl:rng.r(-.9,.9),seed:i*13+5,peel:rng.r(60,140)});
 }
 private tongue(f:Frame,x:number,y:number,ang:number,len:number,wid:number,t:number,seed:number,heat:number,curl:number){if(len<1.5||heat<=.02)return;const n=Math.max(3,Math.ceil(len/3)),ts=stepT(t,15),pts:V2[]=[],ws:number[]=[];for(let i=0;i<=n;i++){const s=i/n,a=ang+curl*s*s,wob=(noise3(seed*.37,s*2.5-ts*5,ts*.7)-.5)*len*.42*s;pts.push({x:x+Math.cos(a)*len*s-Math.sin(a)*wob,y:y+Math.sin(a)*len*s+Math.cos(a)*wob});ws.push(wid*Math.pow(Math.sin(Math.PI*Math.min(1,s*1.5+.12)),.8)*(1-s*.55));}f.ribbon(pts,ws,(px,py,s,e)=>{const nz=noise3(px*.28,py*.28-ts*7,seed),h=clamp((1-Math.abs(e))*1.15-s*.7+(nz-.5)*.6)*heat;if(h<.1)return;f.Lc(px,py,ramp(P.fire,h),.4+h*.7);});}
 render(f:Frame,t:number){if(t<4.64)return;const tb=t-4.64;for(const p of this.petals){const q=easeOut((tb-p.del)/p.dur,4);if(q<=0)continue;const fade=1-inv(.25,1.5,tb);if(fade<=0)continue;const angle=Math.atan2(Math.sin(p.a)*.72,Math.cos(p.a)),x=244,y=88;this.tongue(f,x,y,angle,p.L*q,p.w,t,p.seed,.85*fade+.1,p.curl*q);this.tongue(f,x,y,angle+.05,p.L*q*.68,p.w*.42,t,p.seed+3,1.5*fade,p.curl*q*.6);const peel=tb*p.peel;this.tongue(f,x+Math.cos(angle)*peel,y+Math.sin(angle)*peel,angle,p.L*.4*q,p.w*.5,t,p.seed+7,.7*fade*(1-inv(.1,.8,tb)),-p.curl);}}
}
