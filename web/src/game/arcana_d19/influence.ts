/** Conservative *operation geometry* bounds; never derives presence from RGB.
 * Source-D shader coverage and warp support are enclosed by these rectangles. */
import type {DCommand} from './commands';import type {DWarp} from './warp';
export function dInfluence(commands:DCommand[],warp:DWarp){const W=480,H=270,out=warp.influence.slice();
 const box=(x0:number,y0:number,x1:number,y1:number)=>{x0=Math.max(0,Math.floor(x0)-2);y0=Math.max(0,Math.floor(y0)-2);x1=Math.min(W-1,Math.ceil(x1)+2);y1=Math.min(H-1,Math.ceil(y1)+2);for(let y=y0;y<=y1;y++)out.fill(1,y*W+x0,y*W+x1+1);};
 for(const c of commands){if(c.kind==='bend')continue;if(c.kind==='sprite'){const r=Math.SQRT2*Math.round(c.size)+1;box(c.x-r,c.y-r,c.x+r,c.y+r);}else{let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(let i=0;i<c.points.length;i+=2){minX=Math.min(minX,c.points[i]);maxX=Math.max(maxX,c.points[i]);minY=Math.min(minY,c.points[i+1]);maxY=Math.max(maxY,c.points[i+1]);}const r=c.kind==='line'?Math.max(.02,...(Array.isArray(c.width)?c.width:[c.width])):0;box(minX-r,minY-r,maxX+r,maxY+r);}}
 return out;
}
