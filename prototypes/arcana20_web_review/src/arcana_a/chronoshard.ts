/** Experimental translation of P0 ARedesignSpells2.ChronoshardR. The source
 * is a B-study adaptation, not the original B renderer or a parity claim.
 * Source seconds are unscaled: ASourcePlayer uses the catalog duration as an
 * owner lifetime, not as a time multiplier. P0 selects the 8.4s source lifetime. */
import {Framebuffer} from './engine/framebuffer';
import * as D from './engine/draw';
import {R,RNG,seg,easeIn,easeOut,clamp,lerp,hash2,TAU,type RGB} from './engine/math';
type V={x:number;y:number};
const C:V={x:232,y:124},CASTER:V={x:104,y:150},snapshots=[.15,.35,.60,.82,1.15];
const add=(a:V,b:V):V=>({x:a.x+b.x,y:a.y+b.y}),sub=(a:V,b:V):V=>({x:a.x-b.x,y:a.y-b.y}),mul=(a:V,k:number):V=>({x:a.x*k,y:a.y*k}),mix=(a:V,b:V,t:number):V=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});
const rot=(p:V,a:number):V=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});
const line=(f:Framebuffer,a:V,b:V,c:RGB,k:number)=>D.line(f,a.x,a.y,b.x,b.y,c,k);
const streak=(f:Framebuffer,a:V,b:V,w0:number,w1:number,c:RGB,k:number)=>D.streak(f,a.x,a.y,b.x,b.y,w0,w1,c,k);
const poly=(f:Framebuffer,pts:V[],c:RGB,blend=false,a=1)=>D.polyFill(f,pts,()=>c,blend,a);
const inside=(p:V,vs:V[])=>{let yes=false;for(let i=0,j=vs.length-1;i<vs.length;j=i++){const a=vs[i],b=vs[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
const trajectory=(u:number)=>add(mix(add(CASTER,{x:6,y:-14}),add(C,{x:0,y:-4}),u),{x:0,y:-Math.sin(u*Math.PI)*24});
export class Chronoshard {
 readonly crystals:{pos:V;size:number;seed:number;cap:number}[]=[];
 constructor(readonly art:'A'|'B'='A'){const rng=new RNG(18181);for(let i=0;i<5;i++){const a=-Math.PI*.5+i*TAU/5;this.crystals.push({pos:{x:C.x+Math.cos(a)*76,y:C.y-8+Math.sin(a)*55},size:rng.range(7,13),seed:rng.int(0,999),cap:2.2+i*.5});}}
 release(i:number,t:number){return seg(t,5+(this.crystals.length-1-i)*.2,6.2);}
 resolve(i:number,t:number){const begin=7.4+(this.crystals.length-1-i)*.16;return 1-seg(t,begin,begin+.36);}
 centralTau(t:number){if(t<2.6)return -1;const frozen=.45/1.1;if(t<3.05)return (t-2.6)/1.1;if(t<5.25)return frozen;if(t<6.2)return lerp(frozen,1,seg(t,5.25,6.2));return 1+(t-6.2);}
 private miniDisc(f:Framebuffer,p:V,r:number,hex:V[],c:RGB,k:number){const rr=Math.max(1.15,r);for(let y=Math.floor(p.y-rr);y<=Math.ceil(p.y+rr);y++)for(let x=Math.floor(p.x-rr);x<=Math.ceil(p.x+rr);x++){const s={x:x+.5,y:y+.5};if((s.x-p.x)**2+(s.y-p.y)**2<=rr*rr&&inside(s,hex))f.addPx(x,y,...c,k);}}
 private miniStar(f:Framebuffer,p:V,tau:number,scale:number,hex:V[],k:number){const pts:V[]=[];for(let q=0;q<4;q++){const a=tau*20+q*Math.PI*.5,r=(q%2?3:6)*scale;pts.push(add(p,{x:Math.cos(a)*r,y:Math.sin(a)*r}));}const reach=6*scale+1;for(let y=Math.floor(p.y-reach);y<=Math.ceil(p.y+reach);y++)for(let x=Math.floor(p.x-reach);x<=Math.ceil(p.x+reach);x++){const s={x:x+.5,y:y+.5};if(inside(s,hex)&&inside(s,pts))f.addPx(x,y,1.4,1.4,2,k);}}
 private miniAttack(f:Framebuffer,hex:V[],center:V,tau:number,color:RGB,k:number){if(tau<0||tau>2.2)return;const a=add(CASTER,{x:6,y:-14}),b=add(C,{x:0,y:-4}),middle=add(mul(add(a,b),.5),{x:0,y:-6}),scale=.42;
  for(let q=0;q<21;q++){const u=q/20,p=add(mix(a,b,u),{x:0,y:-Math.sin(u*Math.PI)*24}),guide=add(center,mul(sub(p,middle),scale));if(q%2===0)this.miniDisc(f,guide,.8,hex,color,k*.35);}
  if(tau<=1){for(let m=9;m>=0;m--){const u=Math.max(0,tau-m*.025),at=add(center,mul(sub(trajectory(u),middle),scale));this.miniDisc(f,at,(3-m*.25)*scale,hex,color,k*(1-m/10)*.7);}const head=add(center,mul(sub(trajectory(tau),middle),scale));this.miniDisc(f,head,3,hex,[2,1.6,.8],k);this.miniStar(f,head,tau,.68,hex,k);}
  else{const e=tau-1,target=add(center,mul(sub(b,middle),scale)),radius=easeOut(e/1.2)*34*scale;for(let q=0;q<36;q++){const a=q*TAU/36,p=add(target,{x:Math.cos(a)*radius,y:Math.sin(a)*.7*radius});this.miniDisc(f,p,.7,hex,color,k*Math.max(0,1-e/1.2));}for(let q=0;q<24;q++){const a=hash2(q,18)*TAU,v=30+hash2(q+1,18)*50,p=add(target,mul({x:Math.cos(a)*v*e,y:(Math.sin(a)*v*.7-20)*e+30*e*e},scale));this.miniDisc(f,p,.7,hex,color,k*clamp(1.4-e));}}
 }
 private worldAttack(f:Framebuffer,tau:number,tint:RGB,k:number){if(tau<0||tau>2.2||k<=0)return;const b=add(C,{x:0,y:-4});if(tau<=1){for(let m=1;m<10;m++){const u=Math.max(0,tau-m*.025),p=trajectory(u);D.disc(f,p.x,p.y,3-m*.25,tint,k*(1-m/10)*.7);}const head=trajectory(tau),pts:V[]=[];for(let q=0;q<4;q++){const a=tau*20+q*Math.PI*.5,r=q%2?3:6;pts.push(add(head,{x:Math.cos(a)*r,y:Math.sin(a)*r}));}poly(f,pts,[1.4,1.4,2],false,k);}else{const e=tau-1,r=easeOut(e/1.2)*34,fade=k*Math.max(0,1-e/1.2)*1.5;let prev=add(b,{x:r,y:0});for(let q=1;q<=36;q++){const a=q*TAU/36,next=add(b,{x:Math.cos(a)*r,y:Math.sin(a)*.7*r});line(f,prev,next,tint,fade);prev=next;}}}
 render(f:Framebuffer,t:number){
  if(t<2){const k=seg(t,.9,1.05)*(1-seg(t,1.4,2))*.7,u=seg(t,.9,1.45),from=add(CASTER,{x:6,y:-14}),ghost=add(mix(from,C,u),{x:0,y:-Math.sin(u*Math.PI)*24}),tu=Math.max(0,u-.18),tail=add(mix(from,C,tu),{x:0,y:-Math.sin(tu*Math.PI)*24});streak(f,tail,ghost,1.1,2,[.55,.9,1.8],k);D.disc(f,ghost.x,ghost.y,2,[1.4,1.3,2],k);D.ringShape(f,C.x,C.y,30,1.4,R('frost',.7),k*.5);}
  if(t>=2.6&&t<6.7)this.worldAttack(f,this.centralTau(t),[1.4,.8,1.8],.85);
  const forward=t-3.9;if(forward>=0&&forward<1.2)this.worldAttack(f,.3+forward*1.6,[1.8,1.3,.5],.65*(1-seg(forward,.9,1.2)));
  const reverse=t-4.3;if(reverse>=0&&reverse<1.05)this.worldAttack(f,1.45-reverse*1.5,[.5,.9,2],.65*(1-seg(reverse,.8,1.05)));
  for(let i=0;i<this.crystals.length;i++){const c=this.crystals[i],form=seg(t,.9+i*.24,1.7+i*.24);if(form<=0)continue;const captured=seg(t,c.cap,c.cap+.4),beat=seg(t,c.cap,c.cap+.08)*(1-seg(t,c.cap+.08,c.cap+.35)),rel=this.release(i,t),resolve=this.resolve(i,t),cur=mix(c.pos,C,easeIn(rel,2)),fold=1-.8*seg(t,6.2,6.8),sz=(26+c.size*.45)*form*(1-rel*.5)*resolve*fold;if(sz<=.5)continue;
   const tilt=-.3+i*.12+.08*Math.sin(t*.8+i),outline=[{x:-.10,y:-1.25},{x:.68,y:-.65},{x:.80,y:.48},{x:.08,y:1.16},{x:-.72,y:.62},{x:-.82,y:-.50}],hex=outline.map(p=>add(cur,mul(rot(p,tilt),sz)));
   poly(f,hex,[.045,.055,.14],true,.70*resolve);
   for(let q=0;q<6;q++){const a=hex[q],b=hex[(q+1)%6],ia=mix(a,cur,.2),ib=mix(b,cur,.2);poly(f,[a,b,ib,ia],q%2===0?[.28,.35,.65]:[.12,.18,.39],true,.65*resolve);}
   for(let q=0;q<6;q++){line(f,hex[q],hex[(q+1)%6],[1.2,1.4,2],resolve*(.75+beat*.8));if(q%2===0)line(f,cur,hex[q],[.6,.6,1.2],resolve*.35);}
   if(captured>0)this.miniAttack(f,hex,cur,snapshots[i],[2,1.2,.45],captured*resolve);
   D.glow(f,cur.x,cur.y,sz*1.4,R('frost',.75),captured*resolve*.35);
   if(captured>0&&rel<1)streak(f,cur,C,.7,.3,R('frost',.6),captured*.4*resolve);
   if(rel>0&&rel<1){const head=mix(cur,C,easeOut(rel,2)),pr=Math.max(0,rel-.16),pc=mix(c.pos,C,easeIn(pr,2)),tail=mix(pc,C,easeOut(pr,2)),k=captured*resolve*(1-seg(rel,.84,1));streak(f,tail,head,1.4,.7,[1.8,1.3,.5],k*.8);const star:V[]=[];for(let q=0;q<4;q++){const a=snapshots[i]*20+q*Math.PI*.5,r=q%2?3:6;star.push(add(head,{x:Math.cos(a)*r,y:Math.sin(a)*r}));}poly(f,star,[1.4,1.4,2],false,k);}
  }
  const it=t-6.2;if(it>=0&&it<.7){D.disc(f,C.x,C.y,5*(1-it/.7),R('frost',1),1-it/.7);D.pulseRing(f,C.x,C.y,6+it*150,3,R('frost',.8),.65*(1-it/.7),1.35);}
  if(it>=0&&it<1.25){const travel=easeOut(clamp(it/.8),2),life=1-seg(it,.55,1.25);for(let fragment=0;fragment<8;fragment++){const a=fragment*TAU/8-Math.PI*.5,axis={x:Math.cos(a),y:Math.sin(a)*.75},across={x:-Math.sin(a),y:Math.cos(a)*.75},center=add(C,mul(axis,15+72*travel)),long=(this.art==='A'?32:18)*(1-travel*.35),short=(this.art==='A'?12:19)*(1-travel*.25),front=add(center,mul(axis,long)),rear=sub(center,mul(axis,long*.55)),left=sub(center,mul(across,short)),right=add(center,mul(across,short));poly(f,[front,right,rear,left],[.10,.10,.28],true,life*.9);poly(f,[front,center,left],[.34,.46,.85],true,life*.9);streak(f,front,left,1.8,1,[1.4,1.6,2.4],life);streak(f,front,right,1.6,.9,[1,1.2,2],life*.85);line(f,left,rear,[.6,.7,1.5],life*.75);}
   if(this.art==='B'){const dial=30+travel*45;for(let arc=0;arc<4;arc++){const start=arc*Math.PI*.5+it*.4;D.arcPx(f,C.x,C.y,dial,start,start+1,[1.2,1.4,2.3],life,.75);}}
  }
  if(it>0&&it<1.4){const radius=easeOut(it/1.4,3)*260,vs:V[]=[];for(let q=0;q<14;q++){const a=q/14*TAU+it,rr=radius*(q%2===1?.94:1);vs.push(add(C,{x:Math.cos(a)*rr,y:Math.sin(a)*rr*.75}));}const strength=1.6*(1-clamp(it/1.4));for(let q=0;q<14;q++)line(f,vs[q],vs[(q+1)%14],[1.4,1.6,2.4],strength);}
 }
}
