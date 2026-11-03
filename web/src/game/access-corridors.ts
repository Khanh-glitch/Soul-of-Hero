/** Conservative build exclusions derived from actual static access points and
 * existing roads. This never alters terrain, sources, doors, or loot. It is not
 * a substitute for authored cart widths or a continuous-body route proof. */
import { SOURCES } from './catalog';
import type { World } from './world';
export interface AccessCorridors { mask:Uint8Array; connected:number; unconnected:number }
export function deriveAccessCorridors(w:World):AccessCorridors {
 const m=w.economyMap,n=m.width*m.height,mask=new Uint8Array(n);let connected=0,unconnected=0;
 const open=(i:number)=>!!m.walkable[i]&&!(w.sourceV3[i]&&SOURCES[w.sourceV3[i]!]?.block);
 const neighbors=(i:number)=>{const x=i%m.width,y=Math.floor(i/m.width);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&b>=0&&a<m.width&&b<m.height).map(([a,b])=>b*m.width+a);};
 for(const site of w.statics.filter(s=>['door','loot','cash','vendor','gen','evac'].includes(s.kind))){
  const origin=site.ty*m.width+site.tx,prev=new Int32Array(n).fill(-2),q=new Int32Array(n);let h=0,t=0,end=-1;
  for(const i of neighbors(origin))if(open(i)&&prev[i]===-2){q[t++]=i;prev[i]=-1;}
  while(h<t){const i=q[h++];if(m.road[i]&&m.cargoPassable[i]){end=i;break;}for(const j of neighbors(i))if(prev[j]===-2&&open(j)){prev[j]=i;q[t++]=j;}}
  if(end<0){unconnected++;continue;}connected++;
  for(let i=end;i>=0;i=prev[i]){mask[i]=1;for(const j of neighbors(i))mask[j]=1;}
 }
 return {mask,connected,unconnected};
}
