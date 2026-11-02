import type {BTransform} from '../arcana_b/anchors';
/** P0 ASourcePlayer local caster (104,150), target (232,124). */
export function aTransform(caster:{x:number;y:number},target:{x:number;y:number}):BTransform{
 const dx=target.x-caster.x,dy=target.y-caster.y,len=Math.hypot(dx,dy),scale=len>1?Math.max(.6,Math.min(3.5,len/Math.hypot(128,-26))):1,theta=len>1?Math.atan2(dy,dx)-Math.atan2(-26,128):0;
 const a=scale*Math.cos(theta),b=scale*Math.sin(theta),c=-b,d=a;return {a,b,c,d,x:caster.x-a*104-c*150,y:caster.y-b*104-d*150};
}
