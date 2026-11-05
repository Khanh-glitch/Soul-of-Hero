// Source-derived diagnostic, not a substitute for real routes or human play.
// cd web && node scripts/world-economy-report.mjs
import {createServer} from 'vite';
const v=await createServer({configFile:'vite.config.ts',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
try {
 const {getWorld,SRC_KEYS}=await v.ssrLoadModule('/src/game/world.ts');
 const {diagnoseStarts,sourceDigest}=await v.ssrLoadModule('/src/game/world-economy.ts');
 const {SOURCES}=await v.ssrLoadModule('/src/game/catalog.ts');
 const fixtureMode=process.argv.includes('--fixture');
 let w,m,before,after;
 if(fixtureMode){const {fixture}=await v.ssrLoadModule('/tests/fixtures/isthmus.ts');const {compileEconomy}=await v.ssrLoadModule('/src/game/world-economy.ts');m=fixture();for(const [x,y] of [[12,23],[62,23]]){const i=y*m.width+x;m.freshwater[i]=1;m.biome[i]='water';m.cargoPassable[i]=0;m.buildable[i]=0;}for(const i of [20*m.width+58,20*m.width+59])m.protected[i]=1;after=compileEconomy(m).sources;before=Array(m.width*m.height).fill(null);}
 else {w=getWorld('shipping');m=w.economyMap;before=Array.from(w.src,(k,i)=>k>=0?SRC_KEYS[k]:w.sourceOverlayV2[i]>=0?SRC_KEYS[w.sourceOverlayV2[i]]:null);after=w.sourceV3;}
 const N=m.width*m.height;
 const groups={forest:['oak','pine','bush','grass','herb','rock'],hill:['rock','iron','coalv','crystal'],sand:['palm','salt_shale','rock'],ash:['sulfur','rock','coalv'],marsh:['willow','reed','mushroom','herb']};
 const biome={};for(const [b,keys] of Object.entries(groups)){const cells=[];for(let i=0;i<N;i++)if(m.biome[i]===b&&m.walkable[i]&&!m.protected[i]&&m.slope[i]<=.6)cells.push(i);const counts=g=>Object.fromEntries(keys.map(k=>[k,cells.filter(i=>g[i]===k).length]));biome[b]={eligibleCells:cells.length,before:fixtureMode?null:counts(before),after:counts(after)};}
 let roadCells=0,edges=0;for(let i=0;i<N;i++)if(m.road[i]&&m.cargoPassable[i]){roadCells++;if(i%m.width<m.width-1&&m.road[i+1]&&m.cargoPassable[i+1])edges++;if(i+m.width<N&&m.road[i+m.width]&&m.cargoPassable[i+m.width])edges++;}
 const roadNearby=i=>{const x=i%m.width,y=Math.floor(i/m.width);for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const d=Math.abs(dx)+Math.abs(dy),nx=x+dx,ny=y+dy;if(d>=2&&d<=3&&nx>=0&&ny>=0&&nx<m.width&&ny<m.height&&m.road[ny*m.width+nx]&&m.cargoPassable[ny*m.width+nx])return true;}return false;};
 const roadCounts=grid=>Object.fromEntries(['scrap','wreck'].map(k=>[k,grid.filter((v,i)=>v===k&&roadNearby(i)).length]));
 function region(start,grid){const d=new Int32Array(N).fill(-1),q=new Int32Array(N);let h=0,t=0;const idx=start.y*m.width+start.x;d[idx]=0;q[t++]=idx;const found=new Set();let water=false,buildable=0;
  while(h<t){const i=q[h++],x=i%m.width,y=Math.floor(i/m.width);if(m.freshwater[i])water=true;if(m.buildable[i]&&!m.protected[i]&&!grid[i])buildable++;for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=m.width||ny>=m.height)continue;const j=ny*m.width+nx;if(m.freshwater[j])water=true;if(grid[j])found.add(j);if((dx||dy)&&d[i]<30&&d[j]<0&&m.walkable[j]&&!(grid[j]&&SOURCES[grid[j]].block)){d[j]=d[i]+1;q[t++]=j;}}}
  const counts={};for(const i of found)counts[grid[i]]=(counts[grid[i]]||0)+1;return {reachableCells:t,wood:(counts.oak||0)+(counts.pine||0)+(counts.snowpine||0)+(counts.palm||0)+(counts.willow||0),stone:counts.rock||0,food:(counts.bush||0)+(counts.mushroom||0),salvage:(counts.scrap||0)+(counts.wreck||0),water,buildableCells:buildable};}
 const starts=Object.fromEntries(m.starts.map(s=>[s.id,{before:fixtureMode?null:region(s,before),after:region(s,after)}]));
 console.log(JSON.stringify({map:m.id,revision:m.revision,digest:sourceDigest(after),biome,roads:{cargoPassableRoadCells:roadCells,orthogonalRoadEdges:edges,edgeLengthPixels:edges*m.tileSize,before:fixtureMode?null:roadCounts(before),after:roadCounts(after)},starts,startDiagnostics:diagnoseStarts(m,after),notes:(fixtureMode?'Synthetic descriptor has no legacy baseline and is not a playable map. ':'')+'30-tile shortest-path region over semantic foot mask with solid nodes blocked, neighboring sources counted once. Approximate: static locked doors excluded, unlocked doors treated open; creature/weather and circle collision not simulated. Road-edge length is a tile-graph proxy; junctions/multi-lane grids are not a surveyed centerline.'},null,2));
} finally { await v.close(); }
