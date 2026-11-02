/** Conservative bounds of authored destination pixels. Source-side displaced
 * reads still use the complete original scene and field textures. */
import {W,H} from './engine/frame';import {worldRect} from '../arcana_b/worldRect';import type {BTransform} from '../arcana_b/anchors';
export type InfluenceBounds={x:number;y:number;w:number;h:number};
export function influenceBounds(mask:Uint8Array):InfluenceBounds|null{let x0=W,y0=H,x1=-1,y1=-1;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(mask[y*W+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};}
export function influenceWorldRect(bounds:InfluenceBounds,m:BTransform,cx:number,cy:number,width:number,height:number){const {x,y,w,h}=bounds;return worldRect({...m,x:m.x+m.a*x+m.c*y,y:m.y+m.b*x+m.d*y},cx,cy,width,height,w,h);}
