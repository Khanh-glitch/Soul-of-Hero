/**
 * Work-in-progress ARCANA20 gameplay prototypes for the isolated browser build.
 * Combat numbers and hit geometry here are PROPOSED, not P0 (which is visual
 * only), not product canon. These are real hitboxes, never visual hit receipts.
 * The P0 visuals and quality profiles have NOT been ported; do not publish as
 * a complete 20-Core build until they have been independently validated.
 */
import { sourceTransform } from './sourceTransform';
import { aTransform } from '../arcana_a/anchors';
import { riptideFront } from '../arcana_a/riptide';
import { RipperContour } from '../arcana_c/fusion20/contour';
import catalog from '../../integration/p0-catalog.json';
import { bTransform, transformPoint } from '../arcana_b/anchors';
import { cTransform, C_ANCHOR } from '../arcana_c/anchors';

export type ArcanaSchool = 'fire' | 'water' | 'ice' | 'volt' | 'verdant' | 'astral';
export type ArcanaCore = { id:number; key:string; name:string; school:ArcanaSchool; lead:string; catalog_duration_s:number; catalog_climax_s:number; itemKey:string; colors:[string,string] };
const colors:Record<ArcanaSchool,[string,string]> = {
  fire:['#a52f20','#ffd16c'], water:['#1b679a','#8be8ff'], ice:['#468caf','#dcfaff'],
  volt:['#5846b4','#d1d7ff'], verdant:['#3e7134','#c6ed85'], astral:['#583b8e','#efc8ff'],
};
export const ARCANA_CORES:ArcanaCore[] = catalog.skills.map(s => ({
  id:s.id, key:s.key, name:s.name, school:s.school as ArcanaSchool, lead:s.lead,
  catalog_duration_s:s.catalog_duration_s, catalog_climax_s:s.catalog_climax_s,
  itemKey:`core_arcana_${String(s.id).padStart(2,'0')}`, colors:colors[s.school as ArcanaSchool],
}));
export function arcanaCore(id:number):ArcanaCore | undefined {return ARCANA_CORES[id-1]?.id === id ? ARCANA_CORES[id-1] : undefined}
export type Impact = { kind:'circle'|'line'|'ring'; x:number;y:number; r?:number;angle?:number;len?:number;w?:number; delayMs:number;durationMs:number;damage:number;slow?:boolean };
/** Generate time-ordered gameplay geometry in actual world pixels. No visual
 * result is inferred from a hit; the game's existing hit system owns damage. */
export function planArcana(id:number,x:number,y:number,angle:number,aimX:number,aimY:number):Impact[] {
  const c=arcanaCore(id); if(!c || ![x,y,angle,aimX,aimY].every(Number.isFinite))return [];
  const dx=aimX-x,dy=aimY-y, dist=Math.hypot(dx,dy), reach=Math.max(35,Math.min(130,dist));
  const a=angle, ux=Math.cos(a),uy=Math.sin(a), vx=-uy,vy=ux, tx=x+ux*reach,ty=y+uy*reach;
  // P0 catalog peaks are design reference only: the fusion source clocks can differ.
  const peak=Math.round(c.catalog_climax_s*1000);
  const out:Impact[]=[];
  const circle=(px:number,py:number,r:number,dmg:number,t=peak,slow=false)=>out.push({kind:'circle',x:px,y:py,r,delayMs:Math.max(0,t),durationMs:120,damage:dmg,slow});
  const line=(sx:number,sy:number,ang:number,len:number,w:number,dmg:number,t=peak)=>out.push({kind:'line',x:sx,y:sy,angle:ang,len,w,delayMs:Math.max(0,t),durationMs:150,damage:dmg});
  const ring=(px:number,py:number,r:number,dmg:number,t=peak,slow=false)=>out.push({kind:'ring',x:px,y:py,r,delayMs:Math.max(0,t),durationMs:400,damage:dmg,slow});
  const cAt=(along:number,side:number,r:number,dmg:number,t=peak,slow=false)=>circle(x+ux*along+vx*side,y+uy*along+vy*side,r,dmg,t,slow);
  switch(id) {
    case 1: circle(tx,ty,40,35); ring(tx,ty,55,18,peak+180); break; // crown + shock
    case 2: circle(tx,ty,22,45,4980); ring(tx,ty,45,16,5100); break; // P0 source bite and impact
    case 3: { // P0 B meteor impact positions and times, authored seed/geometry.
      const m=bTransform(3,{x,y},{x:tx,y:ty});
      const events:[[number,number,number,number], ...[number,number,number,number][]] = [[0,1700,7,18],[3,2350,5,15],[6,3200,4,14],[2,3350,4,14],[5,3500,4,14],[1,4300,5,15],[4,4950,6,16],[-1,5900,9,25]];
      for(const [vertex,time,size,dmg] of events){const an=-Math.PI/2+vertex/7*Math.PI*2;const q=transformPoint(m,vertex<0?{x:208,y:112}:{x:208+Math.cos(an)*92,y:112+Math.sin(an)*66});circle(q.x,q.y,Math.max(9,size*2*m.a),dmg,time);}
      break;
    }
    case 4: line(x,y,a,reach+8,14,42); for(let i=1;i<=3;i++) cAt(reach*i/3,0,11,12,peak+120*i); break;
    case 5: circle(tx,ty,32,30); ring(tx,ty,54,15,peak+250); break;
    case 6: { // Provisional collision follows four sampled P0 wavefront slices.
      const m=aTransform({x,y},{x:tx,y:ty}),scale=Math.hypot(m.a,m.b);
      for(const t of [4.75,5.1,5.45,5.8]){const f=riptideFront(t),from=transformPoint(m,{x:f.x,y:f.y-f.height}),to=transformPoint(m,{x:f.x,y:f.y+f.height});line(from.x,from.y,Math.atan2(to.y-from.y,to.x-from.x),Math.hypot(to.x-from.x,to.y-from.y),Math.max(4,8*scale),16,t*1000);}
      break;
    }
    case 7: { // Cathedral pulse and fracture, actual target anchor (bounds provisional).
      const q=transformPoint(cTransform(7,{x,y},{x:tx,y:ty}),C_ANCHOR[7]);
      ring(q.x,q.y,44,12,4400,true);ring(q.x,q.y,44,12,4950,true);ring(q.x,q.y,44,12,5500,true);circle(q.x,q.y,40,30,6400,true);break;
    }
    case 8: circle(tx,ty,38,34,5050); ring(tx,ty,62,14,5050); break; // surge
    case 9: for(let i=1;i<=4;i++)cAt(reach*i/4,(i%2?1:-1)*7,17,16,peak-240+i*100); break;
    case 10: { // Source-C spear and delayed re-ignition around its actual anchor.
      const q=transformPoint(cTransform(10,{x,y},{x:tx,y:ty}),C_ANCHOR[10]);
      circle(q.x,q.y,20,42,4800);for(const delay of [5350,5650,6000])ring(q.x,q.y,35,9,delay);break;
    }
    case 11: for(let i=0;i<3;i++)ring(tx,ty,20+i*17,13,peak+i*160);break;
    case 12: circle(tx,ty,26,40); for(let i=0;i<4;i++)circle(tx+Math.cos(i*Math.PI/2)*35,ty+Math.sin(i*Math.PI/2)*35,12,13,peak-300+i*80);break;
    case 13: line(x,y,a,reach+10,15,32,peak-120);circle(tx,ty,14,26,peak+60);break;
    case 14: for(let i=0;i<5;i++)cAt(reach*(i+1)/5,Math.sin(i*2.3)*20,18,14,peak-400+i*130);break;
    case 15: for(let i=-2;i<=2;i++)line(x,y,a+i*.13,reach+10,7,14,peak+i*55);break;
    case 16: circle(tx,ty,35,38);for(let i=0;i<4;i++)circle(tx+Math.cos(i*Math.PI/2)*42,ty+Math.sin(i*Math.PI/2)*42,14,14,peak+230+i*80);break;
    case 17: { // Rebound impact; stage blackout and post still require an owner.
      const q=transformPoint(cTransform(17,{x,y},{x:tx,y:ty}),C_ANCHOR[17]);circle(q.x,q.y,45,40,6250);ring(q.x,q.y,65,16,6250);break;
    }
    case 18: { // One invented damage event at P0's synchronized impact, not five fake contacts.
      const q=transformPoint(aTransform({x,y},{x:tx,y:ty}),{x:232,y:124});circle(q.x,q.y,24,40,6200);break;
    }
    case 19: { // Provisional damage at the real D source's star impact, not catalog peak.
      const m=sourceTransform({x,y},{x:tx,y:ty},{x:148,y:172},{x:244,y:132}),q=transformPoint(m,{x:244,y:132});circle(q.x,q.y,38,40,8150);break;
    }
    case 20: { // Provisional collision along the actual C rift polyline; width/damage are invented.
      const m=sourceTransform({x,y},{x:tx,y:ty},{x:112,y:126},{x:210,y:116}),pts=new RipperContour().way.map(p=>transformPoint(m,p)),w=15*Math.hypot(m.a,m.b),cap=w*.5;
      for(let i=0;i<pts.length-1;i++){const u=pts[i],v=pts[i+1],a=Math.atan2(v.y-u.y,v.x-u.x);line(u.x-Math.cos(a)*cap,u.y-Math.sin(a)*cap,a,Math.hypot(v.x-u.x,v.y-u.y)+2*cap,w,36,6600);}break;
    }
  }
  return out.sort((a,b)=>a.delayMs-b.delayMs);
}
