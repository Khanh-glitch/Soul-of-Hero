// WMP-04 geographic path suggestion across all connected sea water, NOT a forced ferry rail or Gameplay movement permission.
// No craft, swimming, collision or physical-water-depth claims.
const W=250,H=175,CELL=8;
class Heap{constructor(){this.a=[]}push(score,i){let a=this.a,k=a.length;a.push([score,i]);while(k){let p=(k-1)>>1;if(a[p][0]<=score)break;a[k]=a[p];k=p}a[k]=[score,i]}pop(){const a=this.a,r=a[0],t=a.pop();if(a.length){let k=0;while(k*2+1<a.length){let j=k*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(t[0]<=a[j][0])break;a[k]=a[j];k=j}a[k]=t}return r}get size(){return this.a.length}}
export function planOpenWaterRoute({waterClass,marineRegion,fromAu,toAu,riskPolicy='min_distance'}){
 if(!['min_distance','avoid_hazards'].includes(riskPolicy))return {status:'BAD_RISK_POLICY'};
 function toCell(p){if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[1]<0||p[0]>=2000||p[1]>=1400)return-1;return Math.floor(p[1]/CELL)*W+Math.floor(p[0]/CELL)}
 const start=toCell(fromAu),goal=toCell(toAu);
 if(start<0||goal<0||waterClass[start]!==1||waterClass[goal]!==1)return {status:'START_OR_DESTINATION_NOT_OPEN_OCEAN',fromAu,toAu};
 const dist=new Float64Array(W*H);dist.fill(Infinity);const prev=new Int32Array(W*H);prev.fill(-1);const open=new Heap();const settled=new Uint8Array(W*H);
 const heuristic=i=>Math.hypot((i%W)-(goal%W),((i/W)|0)-((goal/W)|0))*CELL;
 dist[start]=0;open.push(heuristic(start),start);
 const directions=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
 let explored=0;
 while(open.size){let [,i]=open.pop();if(settled[i])continue;settled[i]=1;explored++;if(i===goal)break;
 const x=i%W,y=(i/W)|0;
 for(const [dx,dy] of directions){const nx=x+dx,ny=y+dy;if(nx<0||nx>=W||ny<0||ny>=H)continue;const j=ny*W+nx;if(waterClass[j]!==1)continue;
 // No diagonal 'corner cutting' through opposing shore/collision candidates.
 if(dx&&dy&&(waterClass[y*W+(x+dx)]!==1||waterClass[(y+dy)*W+x]!==1))continue;
 const hazard=marineRegion[j];const cost=(dx&&dy?Math.SQRT2:1)*CELL*(riskPolicy==='avoid_hazards'?(hazard===1?7:hazard===2?3:1):1);
 const nd=dist[i]+cost;if(nd<dist[j]){dist[j]=nd;prev[j]=i;open.push(nd+heuristic(j),j)}
 }
 }
 if(!settled[goal])return {status:'NO_SEA_ROUTE__PHYSICAL_OBSTRUCTION',fromAu,toAu,explored};
 const cells=[];for(let c=goal;c!==-1;c=prev[c])cells.push(c);cells.reverse();
 const regions={ordinary:0,deadlyWest:0,hotCinder:0};let lengthAu=0;
 for(let k=0;k<cells.length;k++){const v=marineRegion[cells[k]];if(v===1)regions.deadlyWest++;else if(v===2)regions.hotCinder++;else regions.ordinary++;if(k){const a=cells[k],b=cells[k-1];lengthAu+=((a%W)!==(b%W)&&((a/W)|0)!==((b/W)|0))?CELL*Math.SQRT2:CELL}}
 return {schema:'soh.wmp.v4.open_sea_route',status:'MAP_ROUTE_CANDIDATE__NOT_GAMEPLAY_MOVEMENT_PERMISSION',fromAu,toAu,riskPolicy,arbitraryOpenWater:true,requiresNoFerryPolyline:true,waypointsAu:cells.map(i=>[(i%W)*CELL+CELL/2,((i/W)|0)*CELL+CELL/2]),analysisCells:cells,estimatedPolylineAu:+lengthAu.toFixed(3),hazardCellCounts:regions,exploredCells:explored,requiresGameplay:['vessel_or_swimming_capability','depth_and_draft_validation','water_collision','wind_and_wave_simulation','risk_and_encounter_rules']};
}
