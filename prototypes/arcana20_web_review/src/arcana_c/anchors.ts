import type { BTransform } from '../arcana_b/anchors';
export type CId=7|10|17|20;
export const C_ANCHOR:Record<CId,{x:number;y:number}>={7:{x:244,y:112},10:{x:262,y:106},17:{x:250,y:106},20:{x:210,y:116}};
/** Source-C caster=(112,126), source-specific target anchor (P0 CSourcePlayer). */
export function cTransform(id:CId,caster:{x:number;y:number},target:{x:number;y:number}):BTransform {
 const q=C_ANCHOR[id],sx=q.x-112,sy=q.y-126,dx=target.x-caster.x,dy=target.y-caster.y,length=Math.hypot(dx,dy);
 const scale=length>1?Math.max(.6,Math.min(3.5,length/Math.hypot(sx,sy))):1;
 const theta=length>1?Math.atan2(dy,dx)-Math.atan2(sy,sx):0;
 const a=scale*Math.cos(theta),b=scale*Math.sin(theta),c=-b,d=a;
 return {a,b,c,d,x:caster.x-a*112-c*126,y:caster.y-b*112-d*126};
}
