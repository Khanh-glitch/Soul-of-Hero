import type { BTransform } from './anchors';
/** Screen-space source bounds with pixel margin; all clamped source warp
 * samples remain within this rectangle. No effect pixels are discarded. */
export function worldRect(m:BTransform,cx:number,cy:number,width:number,height:number){
 const points=[[0,0],[384,0],[0,216],[384,216]].map(([x,y])=>({x:m.x+m.a*x+m.c*y-cx,y:m.y+m.b*x+m.d*y-cy}));
 const loX=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x)))-2),loY=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y)))-2);
 const hiX=Math.min(width,Math.ceil(Math.max(...points.map(p=>p.x)))+2),hiY=Math.min(height,Math.ceil(Math.max(...points.map(p=>p.y)))+2);
 return {x:loX,y:loY,w:Math.max(0,hiX-loX),h:Math.max(0,hiY-loY)};
}
