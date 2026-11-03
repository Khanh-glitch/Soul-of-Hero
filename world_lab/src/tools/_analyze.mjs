import {PNG} from 'pngjs'; import fs from 'node:fs';
function components(path, minArea=20){
 const p=PNG.sync.read(fs.readFileSync(path)); const W=p.width,H=p.height; const seen=new Uint8Array(W*H); const out=[];
 const idx=(x,y)=>y*W+x; const alpha=(x,y)=>p.data[idx(x,y)*4+3];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if(seen[idx(x,y)]||alpha(x,y)<20)continue;
  const q=[[x,y]];seen[idx(x,y)]=1;let minx=x,maxx=x,miny=y,maxy=y,n=0;
  while(q.length){const [a,b]=q.pop();n++;minx=Math.min(minx,a);maxx=Math.max(maxx,a);miny=Math.min(miny,b);maxy=Math.max(maxy,b);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=a+dx,ny=b+dy;if(nx<0||ny<0||nx>=W||ny>=H||seen[idx(nx,ny)]||alpha(nx,ny)<20)continue;seen[idx(nx,ny)]=1;q.push([nx,ny]);}}
  if(n>=minArea)out.push({x:minx,y:miny,w:maxx-minx+1,h:maxy-miny+1,area:n});
 }
 out.sort((a,b)=>b.area-a.area); return out.slice(0,30);
}
for(const [label,path] of [['plants','/tmp/soh_audit/packs_extracted/200380-farm-plants/PNG/Plants.png'],['bridges','/tmp/soh_audit/packs_extracted/668008-bridges/PNG_n_Tiled/Bridges.png']]){
 console.log('\n',label,path); console.log(components(path,30).map(c=>`${c.x},${c.y} ${c.w}x${c.h} a${c.area}`).join('\n'));
}
