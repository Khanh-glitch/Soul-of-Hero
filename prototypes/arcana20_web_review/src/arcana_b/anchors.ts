/** P0 source-B authored coordinates and similarity mount; no rendering or combat. */
export type BId = 2 | 3 | 8;
export type BTransform = { a:number;b:number;c:number;d:number; x:number;y:number };
export const B_CASTER={x:104,y:132}, B_TARGET={x:262,y:104};
export function bTransform(id:BId,caster:{x:number;y:number},target:{x:number;y:number}):BTransform {
  const dx=target.x-caster.x,dy=target.y-caster.y;
  const scale=Math.max(0.6,Math.min(3.5,Math.hypot(dx,dy)/Math.hypot(158,-28)));
  const theta=id===2 ? Math.atan2(dy,dx)-Math.atan2(-28,158) : 0;
  const a=scale*Math.cos(theta),b=scale*Math.sin(theta),c=-b,d=a;
  const pin=id===2 ? B_TARGET : {x:192+(id===3?16:26),y:112};
  return {a,b,c,d,x:target.x-a*pin.x-c*pin.y,y:target.y-b*pin.x-d*pin.y};
}
export function transformPoint(m:BTransform,p:{x:number;y:number}) {return {x:m.x+m.a*p.x+m.c*p.y,y:m.y+m.b*p.x+m.d*p.y};}
