/** P0 D19 source-authored draw requests. Not a rasterizer, world pass or an
 * assertion of D19 A parity. Command order is retained for RGBA8 blending. */
import {lerp,clamp,TAU} from '../arcana_c/engine/math';
import {ConstellationState,CENTER,astralRamp,phase,cubic} from './constellationState';
type Col=[number,number,number,number];type Opt={rot?:number;hard?:number;glow?:number;flow?:number;flags?:number;edge?:number;seed?:number};
export type DCommand=
 |{kind:'sprite';x:number;y:number;size:number;shape:number;color:Col;opt:Opt;role:string}
 |{kind:'line';points:number[];width:number|number[];color:Col;opt:Opt;role:string}
 |{kind:'poly';points:number[];color:Col;opt:Opt;role:string}
 |{kind:'bend';x:number;y:number;size:number;ox:number;oy:number;absorb:number;chroma:number;role:string};
const col=(t:number,a:number):Col=>[...astralRamp(t),a];
const quad=(cx:number,cy:number,hw:number,hh:number,rot:number)=>{const c=Math.cos(rot),s=Math.sin(rot),out:number[]=[];for(const [x,y] of [[-1,-1],[1,-1],[-1,1],[1,1]])out.push(cx+x*hw*c-y*hh*s,cy+x*hw*s+y*hh*c);return out;};
export function constellationCommands(state:ConstellationState){
 const t=state.tick/60,finale=t>7.4,fade=1-phase(t,8.6,9.8),cmd:DCommand[]=[];
 if(state.tick===0)return {time:0,rendererTime:.0001,warpFade:1,bloomGain:1,flash:null,commands:cmd};
 const sprite=(x:number,y:number,size:number,shape:number,color:Col,opt:Opt,role:string)=>cmd.push({kind:'sprite',x,y,size,shape,color,opt,role});
 const line=(points:number[],width:number|number[],color:Col,opt:Opt,role:string)=>cmd.push({kind:'line',points,width,color,opt,role});
 for(const n of state.nodes){const beat=.55+.45*Math.sin(t*(1.4+n.sp)+n.ph);sprite(n.x,n.y,2.2+beat*1.4,4,col(.8+beat*.2,.95*fade),{rot:t*.6+n.ph,hard:1.1,glow:1},'node-star');sprite(n.x,n.y,7+beat*4,1,col(.7,.4*fade),{hard:1},'node-soft');sprite(n.x,n.y,5+beat*3,13,col(.8+beat*.2,.5*fade),{rot:n.ph+t*.3,hard:1.2},'node-flare');}
 if(!finale){for(const e of state.renderEdges){const A=state.nodes[e.a],B=state.nodes[e.b],grow=cubic(phase(t,e.born,e.born+.3)),die=1-phase(t,e.die-.25,e.die),flick=.5+.5*Math.sin(t*17+e.a*3),pts=[A.x,A.y,lerp(A.x,B.x,.5)+Math.sin(t*3+e.a)*3,lerp(A.y,B.y,.5),B.x,B.y];line(pts,.4*grow,col(.5,.35*grow*die),{hard:1.4,flags:4},'edge-base');line(pts,.22*grow,col(.9,(.35+.4*flick)*grow*die),{hard:1,glow:.8},'edge-glint');}}
 else{const k=cubic(phase(t,7.4,8.1))*fade;for(let i=0;i<state.nodes.length;i++){const A=state.nodes[i],B=state.nodes[(i+1)%state.nodes.length],C=state.nodes[(i+5)%state.nodes.length];line([A.x,A.y,B.x,B.y],.9*k,col(.9,.8*k),{hard:1,glow:1,flow:2.6},'finale-edge');if(i%2===0)line([A.x,A.y,C.x,C.y],.5*k,col(.7,.5*k),{hard:1.2,glow:.6},'finale-cross');}
  for(let i=0;i<state.nodes.length;i+=2){const A=state.nodes[i];line([A.x,A.y,lerp(A.x,CENTER.x,.5),lerp(A.y,CENTER.y,.5),CENTER.x,CENTER.y],[.7,1.4,.3],col(.95,.7*k),{hard:1,glow:1,flow:3.2},'center-filament');}
  const q=phase(t,7.55,8.1),su=(q>=1?1:1-2**(-10*q))*fade;for(let i=0;i<8;i++){const a=i/8*TAU+t*.4,rr=22*su*(i%2?.45:1);cmd.push({kind:'poly',points:quad(CENTER.x,CENTER.y,rr,rr*.4,a),color:col(.9,.7*su),opt:{glow:1,edge:.6},role:'star-prism'});line([CENTER.x,CENTER.y,CENTER.x+Math.cos(a)*rr*1.2,CENTER.y+Math.sin(a)*rr*.9],.6,col(1,.7*su),{hard:1,glow:1},'star-ray');}
  sprite(CENTER.x,CENTER.y,8+20*su,4,col(1,.95*su),{rot:t*1.2,hard:1.2,glow:1.4},'central-star');sprite(CENTER.x,CENTER.y,30+50*su,1,col(.8,.45*su),{hard:1},'central-soft');cmd.push({kind:'bend',x:CENTER.x,y:CENTER.y,size:70*su,ox:0,oy:0,absorb:0,chroma:1.4*su,role:'star-warp'});
  if(state.burst)for(let s=0;s<5;s++){const a=s/5*TAU,pts:number[]=[];for(let i=0;i<13;i++){const u=i/12,aa=a+u*1.2*(s%2?1:-1);pts.push(CENTER.x+Math.cos(aa)*u*130,CENTER.y+Math.sin(aa)*u*110);}line(pts,[3.4,1.2,.2],col(.95,.95),{hard:1,glow:1.2,flow:3},'burst-filament');}
 }
 for(const p of state.renderPulses){const A=state.nodes[p.a],B=state.nodes[p.b],x=lerp(A.x,B.x,p.u),y=lerp(A.y,B.y,p.u);sprite(x,y,2.2,4,col(1,.95*fade),{rot:p.u*9,hard:1.2,glow:1.3},'pulse-star');line([lerp(A.x,B.x,Math.max(0,p.u-.14)),lerp(A.y,B.y,Math.max(0,p.u-.14)),x,y],1.1,col(.95,.8*fade),{hard:1,glow:1},'pulse-trail');}
 for(const p of state.motes){const u=clamp(p.life/p.max),e=Math.min(1,u*5)*(1-u**3);if(e<=.01)continue;sprite(p.x,p.y,lerp(p.s0,p.s1,u),p.shape,[...p.color,p.alpha*e],{rot:p.rot,seed:p.seed,hard:1,glow:.3,edge:0,flags:0},'mote');}
 return {time:t,rendererTime:Math.max(.0001,t-1/60+.0001),warpFade:fade,bloomGain:1+(finale?.5:.1)+(state.star?.6*Math.exp(-(t-8.15)*2):0),flash:state.burst?{amount:.8,color:[.95,.9,1] as [number,number,number]}:null,commands:cmd};
}
