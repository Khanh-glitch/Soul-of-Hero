import {it,expect} from 'vitest';
import {GOLD,coastDistanceAtAu,sampleTile} from '../src/veyra05/reader';
// Independent unchanged-reader reference: replicate the original9 bucket visits,
// including duplicate edges and its limited neighborhood (not a new coastline).
const buckets=new Map<string,[[number,number],[number,number]][]>();
for(const land of GOLD.project.land)for(const ring of land.rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const a=ring[j],b=ring[i];
 for(let x=Math.floor((Math.min(a[0],b[0])-8)/32);x<=Math.floor((Math.max(a[0],b[0])+8)/32);x++)for(let y=Math.floor((Math.min(a[1],b[1])-8)/32);y<=Math.floor((Math.max(a[1],b[1])+8)/32);y++){
  const k=`${x}:${y}`,list=buckets.get(k)??[];list.push([a,b]);buckets.set(k,list);
 }
}
function original(x:number,y:number){let best=Infinity;const bx=Math.floor(x/32),by=Math.floor(y/32);
 for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const [a,b]of buckets.get(`${bx+i}:${by+j}`)??[]){
  const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;let t=l2?((x-a[0])*dx+(y-a[1])*dy)/l2:0;t=t<0?0:t>1?1:t;
  const d=Math.hypot(x-(a[0]+t*dx),y-(a[1]+t*dy));if(d<best)best=d;
 }return best;
}
it('deduplicated coast candidates preserve exact distances at authored edges, bucket seams, inland and sea',()=>{
 const points:[number,number][]=[];
 for(let y=0;y<1400;y+=47)for(let x=0;x<2000;x+=53)points.push([x+.25,y+.25]);
 for(const land of GOLD.project.land)for(const ring of land.rings)for(const [x,y]of ring)points.push([x,y],[Math.floor(x/32)*32,y]);
 const start=performance.now(),expected=points.map(([x,y])=>original(x,y)),referenceMs=performance.now()-start;
 const at=performance.now(),actual=points.map(([x,y])=>coastDistanceAtAu(x,y)),optimizedMs=performance.now()-at;
 for(let i=0;i<points.length;i++)expect(actual[i]).toBe(expected[i]);
 console.log(JSON.stringify({case:'exact-coast-segment-union',samples:points.length,referenceMs,optimizedMs}));
 const s=sampleTile(100,100);expect(s.coastDist).toBe(original(50.25,50.25));
});
