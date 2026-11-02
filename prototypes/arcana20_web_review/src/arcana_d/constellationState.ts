/** P0 D19 state choreography scaffolding only. This does not draw D's star,
 * ribbons, sprites, shader, motes or world warp and is not an A replacement. */
import {Rng,lerp,TAU,clamp} from '../arcana_c/engine/math';
type Node={x:number;y:number;tx:number;ty:number;ph:number;sp:number;home:{x:number;y:number}};
type Edge={a:number;b:number;born:number;die:number};type Pulse={a:number;b:number;u:number;sp:number;life:number};
const CENTER={x:244,y:132},phase=(t:number,a:number,b:number)=>clamp((t-a)/(b-a)),cubic=(t:number)=>1-(1-t)**3;
function rawRng(seed:number){const r=new Rng(1);r.s=seed>>>0;return r;}
export class ConstellationState{
 nodes:Node[]=[];edges:Edge[]=[];pulses:Pulse[]=[];star=false;tick=0;
 constructor(){const rng=rawRng(97);for(let i=0;i<14;i++){const a=rng.r(0,TAU),rr=rng.r(20,105),home={x:CENTER.x+Math.cos(a)*rr,y:CENTER.y+Math.sin(a)*rr*.86};this.nodes.push({x:home.x,y:home.y,tx:home.x,ty:home.y,ph:rng.r(0,6),sp:rng.r(.6,1.6),home});}}
 advanceTo(seconds:number){const target=Math.floor(seconds*60+1e-8);if(target<this.tick)throw new Error('Reset constellation before seeking backwards');while(this.tick<target){this.tick++;this.update(this.tick/60,1/60);}}
 private update(t:number,dt:number){const rendererTime=Math.max(.0001,t-1/60+.0001),fxRng=rawRng(Math.trunc(rendererTime*977)),rng=rawRng(600+Math.floor(t*30)),finale=t>7.4,out=cubic(phase(t,8.6,9.8));
  for(let i=0;i<this.nodes.length;i++){const n=this.nodes[i];if(t>3.2&&!finale){const c=this.nodes[(i*5+3)%this.nodes.length],a=t*n.sp*(i%2?1:-1)+n.ph,rr=22+(i%4)*12;n.tx=lerp(n.tx,(n.x+c.x)/2+Math.cos(a)*rr,dt*2);n.ty=lerp(n.ty,(n.y+c.y)/2+Math.sin(a)*rr*.86,dt*2);}else if(finale){const k=cubic(phase(t,7.4,8.2)),a=i/this.nodes.length*TAU*2+.4;let rr=lerp(Math.hypot(n.home.x-CENTER.x,n.home.y-CENTER.y),i%2?96:54,k);rr=lerp(rr,6,out);n.tx=lerp(n.tx,CENTER.x+Math.cos(a)*rr,dt*6);n.ty=lerp(n.ty,CENTER.y+Math.sin(a)*rr*.86,dt*6);}n.x=lerp(n.x,n.tx,dt*3.2);n.y=lerp(n.y,n.ty,dt*3.2);}
  if(!finale){if(fxRng.r(0,1)<.24){const i=Math.floor(rng.r(0,this.nodes.length)),dist=this.nodes.map((n,j)=>({j,d:Math.hypot(n.x-this.nodes[i].x,n.y-this.nodes[i].y)})).filter(o=>o.j!==i).sort((a,b)=>a.d-b.d);for(let k=0;k<Math.min(2,dist.length);k++)this.edges.push({a:i,b:dist[k].j,born:t,die:t+rng.r(.4,1.5)});}this.edges=this.edges.filter(e=>t<=e.die);if(this.edges.length>40)this.edges=this.edges.slice(12);}
  else if(t>8.15&&!this.star){this.star=true;/* The authored burst consumes nine RNG values per mote. */for(let i=0;i<130*9;i++)rng.next();}
  if(t>5.2&&fxRng.r(0,1)<.3&&this.edges.length){const e=this.edges[Math.floor(rng.r(0,this.edges.length))];this.pulses.push({a:e.a,b:e.b,u:0,sp:rng.r(.8,2),life:0});}
  for(let i=this.pulses.length-1;i>=0;i--){const p=this.pulses[i];p.u+=dt*p.sp;if(p.u>=1){const nb=this.edges.filter(e=>e.a===p.b);if(nb.length&&rng.r(0,1)<.5)this.pulses.push({a:nb[0].a,b:nb[0].b,u:0,sp:p.sp*.9,life:0});this.pulses.splice(i,1);}}
 }
}
