/** P0 ARealityRipperDebris fixed-step simulation, not a renderer. Live-world
 * sampling/lighting is a separate unfinished owner pass; no sampled floor or
 * fake background is embedded here. */
import {RNG} from '../../arcana_a/engine/math';import type {RipperContour} from './contour';
type Particle={x:number;y:number;px:number;py:number;vx:number;vy:number;life:number;max:number;size:number;seed:number;k:number};
export class RipperDebris {
 private rng=new RNG(0x7ea4);tick=0;particles:Particle[]=[];
 constructor(){for(let i=0;i<27;i++){this.rng.range(-5,5);this.rng.range(-7,7);}for(let i=0;i<64;i++){this.rng.range(0,1);this.rng.range(-1,1);this.rng.int(0,9999);}}
 advanceTo(sourceTime:number,contour:RipperContour){const target=Math.floor(sourceTime*60+.000001);if(target<this.tick)throw new Error('Ripper debris requires monotonic source time; reset the instance to seek backwards');while(this.tick<target){this.tick++;const dt=1/60,t=this.tick*dt;if(t>5.3&&t<5.7&&this.particles.length<320){for(let i=0;i<24;i++){const u=this.rng.next(),anchor=contour.at(Math.floor(u*26)/26),angle=this.rng.angle(),speed=this.rng.range(60,340),life=this.rng.range(.5,1.8),size=this.rng.int(1,4),seed=this.rng.int(0,9999),k=this.rng.next();this.particles.push({x:anchor.x,y:anchor.y,px:anchor.x,py:anchor.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed/1.4,life,max:life,size,seed,k});}}const decay=Math.exp(-1.8*dt);for(const p of this.particles){p.px=p.x;p.py=p.y;p.vx*=decay;p.vy*=decay;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}this.particles=this.particles.filter(p=>p.life>0);}}
}
