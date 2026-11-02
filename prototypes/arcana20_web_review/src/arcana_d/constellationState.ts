/** P0 D19 fixed-step choreography. This is not a finished rasterizer or an
 * approved replacement for D19 A; its draw command path remains internal. */
import {Rng,lerp,TAU,clamp} from '../arcana_c/engine/math';
export type DNode={x:number;y:number;tx:number;ty:number;ph:number;sp:number;home:{x:number;y:number}};
export type DEdge={a:number;b:number;born:number;die:number};export type DPulse={a:number;b:number;u:number;sp:number;life:number};
export type DMote={x:number;y:number;vx:number;vy:number;life:number;max:number;s0:number;s1:number;color:[number,number,number];alpha:number;outAlpha?:number;shape:number;rot:number;spin:number;seed:number};
export const CENTER={x:244,y:132},phase=(t:number,a:number,b:number)=>clamp((t-a)/(b-a)),cubic=(t:number)=>1-(1-t)**3;
const PALETTE=[[.02,.01,.05],[.1,.03,.2],[.3,.08,.44],[.62,.22,.78],[.95,.62,.98],[1,.96,1]];
export function astralRamp(t:number):[number,number,number]{const x=clamp(t)*(PALETTE.length-1),i=Math.min(PALETTE.length-2,Math.floor(x)),f=x-i;return [lerp(PALETTE[i][0],PALETTE[i+1][0],f),lerp(PALETTE[i][1],PALETTE[i+1][1],f),lerp(PALETTE[i][2],PALETTE[i+1][2],f)];}
function rawRng(seed:number){const r=new Rng(1);r.s=seed>>>0;return r;}
export class ConstellationState{
 nodes:DNode[]=[];edges:DEdge[]=[];pulses:DPulse[]=[];motes:DMote[]=[];star=false;burst=false;tick=0;
 // P0 draws these before trimming old edges / appending a pulse's successors.
 renderEdges:DEdge[]=[];renderPulses:DPulse[]=[];
 constructor(){const rng=rawRng(97);for(let i=0;i<14;i++){const a=rng.r(0,TAU),rr=rng.r(20,105),home={x:CENTER.x+Math.cos(a)*rr,y:CENTER.y+Math.sin(a)*rr*.86};this.nodes.push({x:home.x,y:home.y,tx:home.x,ty:home.y,ph:rng.r(0,6),sp:rng.r(.6,1.6),home});}}
 advanceTo(seconds:number){const target=Math.floor(seconds*60+1e-8);if(target<this.tick)throw new Error('Reset constellation before seeking backwards');while(this.tick<target){this.tick++;this.update(this.tick/60,this.tick===1?.0001:1/60);}}
 private update(t:number,dt:number){const rendererTime=Math.max(.0001,t-1/60+.0001),fxRng=rawRng(Math.trunc(rendererTime*977)),rng=rawRng(600+Math.floor(t*30)),finale=t>7.4,out=cubic(phase(t,8.6,9.8)),fade=1-phase(t,8.6,9.8);this.burst=false;this.renderEdges=[];this.renderPulses=[];
  for(let i=0;i<this.nodes.length;i++){const n=this.nodes[i];if(t>3.2&&!finale){const c=this.nodes[(i*5+3)%this.nodes.length],a=t*n.sp*(i%2?1:-1)+n.ph,rr=22+(i%4)*12;n.tx=lerp(n.tx,(n.x+c.x)/2+Math.cos(a)*rr,dt*2);n.ty=lerp(n.ty,(n.y+c.y)/2+Math.sin(a)*rr*.86,dt*2);}else if(finale){const k=cubic(phase(t,7.4,8.2)),a=i/this.nodes.length*TAU*2+.4;let rr=lerp(Math.hypot(n.home.x-CENTER.x,n.home.y-CENTER.y),i%2?96:54,k);rr=lerp(rr,6,out);n.tx=lerp(n.tx,CENTER.x+Math.cos(a)*rr,dt*6);n.ty=lerp(n.ty,CENTER.y+Math.sin(a)*rr*.86,dt*6);}n.x=lerp(n.x,n.tx,dt*3.2);n.y=lerp(n.y,n.ty,dt*3.2);}
  if(!finale){if(fxRng.r(0,1)<.24){const i=Math.floor(rng.r(0,this.nodes.length)),dist=this.nodes.map((n,j)=>({j,d:Math.hypot(n.x-this.nodes[i].x,n.y-this.nodes[i].y)})).filter(o=>o.j!==i).sort((a,b)=>a.d-b.d);for(let k=0;k<Math.min(2,dist.length);k++)this.edges.push({a:i,b:dist[k].j,born:t,die:t+rng.r(.4,1.5)});}this.edges=this.edges.filter(e=>t<=e.die);this.renderEdges=this.edges.slice().reverse();if(this.edges.length>40)this.edges=this.edges.slice(12);}
  else if(t>8.15&&!this.star){this.star=true;this.burst=true;for(let i=0;i<130;i++){const a=rng.r(0,TAU),vx=Math.cos(a)*rng.r(30,230),vy=Math.sin(a)*rng.r(24,190),life=rng.r(.6,2.4),s0=rng.r(1,3),color=astralRamp(rng.r(.7,1)),shape=rng.r(0,1)<.4?18:0,rot=rng.r(0,TAU),spin=rng.r(-6,6);this.motes.push({x:CENTER.x,y:CENTER.y,vx,vy,life:0,max:life,s0,s1:.3,color,alpha:.95,shape,rot,spin,seed:1.7});}}
  if(t>5.2&&fxRng.r(0,1)<.3&&this.edges.length){const e=this.edges[Math.floor(rng.r(0,this.edges.length))];this.pulses.push({a:e.a,b:e.b,u:0,sp:rng.r(.8,2),life:0});}
  for(let i=this.pulses.length-1;i>=0;i--){const p=this.pulses[i];p.u+=dt*p.sp;if(p.u>=1){const nb=this.edges.filter(e=>e.a===p.b);if(nb.length&&rng.r(0,1)<.5)this.pulses.push({a:nb[0].a,b:nb[0].b,u:0,sp:p.sp*.9,life:0});this.pulses.splice(i,1);}else this.renderPulses.push({...p});}
  for(let i=this.motes.length-1;i>=0;i--){const p=this.motes[i];p.life+=dt;if(p.life>=p.max){this.motes.splice(i,1);continue;}const dr=Math.exp(-1.2*dt);p.vx*=dr;p.vy=p.vy*dr-6*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.spin*dt;}
  if(out>0){const retain=Math.exp(-12*out*dt);for(const p of this.motes){if(p.outAlpha===undefined)p.outAlpha=p.alpha;p.x=lerp(CENTER.x,p.x,retain);p.y=lerp(CENTER.y,p.y,retain);p.vx*=retain;p.vy*=retain;p.alpha=p.outAlpha*fade;}}
 }
}
