export function buildWorldV4({biomeCode,landId,waterClass,elevation}){
 const W=250,H=175,N=W*H,old=biomeCode,next=old.slice(),valid=i=>landId[i]!==0&&waterClass[i]===0;
 if([old,landId,waterClass,elevation].some(a=>a.length!==N))throw Error("WMP04_RASTER_SHAPE");
 class Heap{constructor(){this.v=[]}push(p,i){const a=this.v;let k=a.length;a.push([p,i]);while(k){const j=(k-1)>>1;if(a[j][0]<=p)break;a[k]=a[j];k=j}a[k]=[p,i]}pop(){const a=this.v,r=a[0],t=a.pop();if(a.length){let k=0;while(2*k+1<a.length){let j=2*k+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(t[0]<=a[j][0])break;a[k]=a[j];k=j}a[k]=t}return r}get length(){return this.v.length}}
 const neighbors=i=>{const x=i%W,y=(i/W)|0;return [x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1].filter(x=>x>=0)};
 let landCells=0,sourceSnow=0,sourceDry=0;
 for(let i=0;i<N;i++)if(valid(i)){landCells++;if(old[i]===8)sourceSnow++;if(old[i]===5||old[i]===6)sourceDry++}
 const snowTarget=Math.round(landCells*.24),dryTarget=Math.round(sourceDry*1.30);
 const allowSnow=i=>valid(i)&&landId[i]===1&&next[i]!==8&&![4,5,6,9,10,11].includes(next[i]);
 const snowPriority=i=>{const x=(i%W)*8+4,y=((i/W)|0)*8+4,b=next[i];return (y*21+Math.abs(x-810)*5-elevation[i]*56+(b===3?-2800:b===7?-3600:b===2?1800:0))*100000+i};
 const hs=new Heap(),seen=new Uint8Array(N);let snowCount=0;
 for(let i=0;i<N;i++)if(valid(i)&&old[i]===8){snowCount++;for(const j of neighbors(i))if(!seen[j]&&allowSnow(j)){seen[j]=1;hs.push(snowPriority(j),j)}}
 while(snowCount<snowTarget&&hs.length){const i=hs.pop()[1];if(!allowSnow(i))continue;next[i]=8;snowCount++;for(const j of neighbors(i))if(!seen[j]&&allowSnow(j)){seen[j]=1;hs.push(snowPriority(j),j)}}
 if(snowCount!==snowTarget)throw Error("WMP04_SNOW_AREA_UNREACHABLE");
 const allowDry=i=>valid(i)&&landId[i]===1&&next[i]===0;
 const dryPriority=i=>{const x=(i%W)*8+4,y=((i/W)|0)*8+4;return (-Math.max(0,x-820)*7-Math.max(0,y-710)*7+elevation[i]*21+(x<400?8000:0))*100000+i};
 const hd=new Heap(),seenD=new Uint8Array(N);let dryCount=0;
 for(let i=0;i<N;i++)if(valid(i)&&(next[i]===5||next[i]===6)){dryCount++;for(const j of neighbors(i))if(!seenD[j]&&allowDry(j)){seenD[j]=1;hd.push(dryPriority(j),j)}}
 while(dryCount<dryTarget&&hd.length){const i=hd.pop()[1];if(!allowDry(i))continue;next[i]=6;dryCount++;for(const j of neighbors(i))if(!seenD[j]&&allowDry(j)){seenD[j]=1;hd.push(dryPriority(j),j)}}
 if(dryCount!==dryTarget)throw Error("WMP04_DRY_AREA_UNREACHABLE");
 const coldTransition=new Uint8Array(N);
 for(let i=0;i<N;i++)if(valid(i)&&next[i]===8){coldTransition[i]=3;for(const j of neighbors(i))if(valid(j)&&next[j]!==8&&!coldTransition[j])coldTransition[j]=2}
 for(let i=0;i<N;i++)if(coldTransition[i]===2)for(const j of neighbors(i))if(valid(j)&&!coldTransition[j])coldTransition[j]=1;
 const west=[[75,490],[155,412],[245,425],[321,541],[345,678],[315,852],[245,932],[103,930],[70,800]];
 const hot=[[1335,610],[1550,630],[1600,715],[1600,855],[1535,995],[1370,1005],[1320,920],[1295,780]];
 function inPoly(x,y,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
 const marineRegion=new Uint8Array(N);let deadly=0,hotCells=0;
 for(let i=0;i<N;i++)if(waterClass[i]===1){const x=(i%W)*8+4,y=((i/W)|0)*8+4;if(inPoly(x,y,west)){marineRegion[i]=1;deadly++}else if(inPoly(x,y,hot)){marineRegion[i]=2;hotCells++}}
 let changed=0,snowAdded=0,dryAdded=0,waterChanged=0,beachChanged=0;
 for(let i=0;i<N;i++)if(next[i]!==old[i]){changed++;if(!valid(i))waterChanged++;if(old[i]===11)beachChanged++;if(next[i]===8)snowAdded++;if(next[i]===6)dryAdded++}
 const at=(x,y)=>(Math.floor(y/8)*W+Math.floor(x/8));
 const anchorsAu={monster:[223,714],helicopter:[272,652],hotSea:[1470,795]};
 if(marineRegion[at(...anchorsAu.monster)]!==1||marineRegion[at(...anchorsAu.hotSea)]!==2||!valid(at(...anchorsAu.helicopter)))throw Error("WMP04_EVENT_SITE_GEOMETRY_INVALID");
 if(waterChanged||beachChanged||snowAdded!==snowTarget-sourceSnow||Math.abs(dryCount/sourceDry-1.30)>.001)throw Error("WMP04_INVARIANT_FAIL");
 return {biomeEffective:next,marineRegion,coldTransition,marinePolygonsAu:{deadlyWest:west,hotCinder:hot},anchorsAu,stats:{landCells,sourceSnow,snowCount,snowPercent:+(100*snowCount/landCells).toFixed(4),snowAdded,sourceDry,dryCount,dryGrowthPercent:+(100*(dryCount/sourceDry-1)).toFixed(4),dryAdded,changed,waterChanged,beachChanged,deadlyWestSeaCells:deadly,hotCinderSeaCells:hotCells}};
}
