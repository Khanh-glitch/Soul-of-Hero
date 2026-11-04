// Authoritative creator correction: rock is not snow; trim southward incursion, retain northern snow. No GOLD edits.
export function rebalanceSnowBiome({sourceBiome,activeV4,landId,waterClass,elevation}){
 const W=250,H=175,N=W*H,src=sourceBiome,prev=activeV4,now=activeV4.slice();
 if([src,prev,landId,waterClass,elevation].some(a=>!a||a.length!==N))throw Error("WMP04R1_SOURCE_SHAPE");
 const valid=i=>landId[i]!==0&&waterClass[i]===0;
 const neighbors=i=>{const x=i%W,y=i/W|0;return[x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1].filter(j=>j>=0)};
 class Heap{constructor(){this.a=[]}push(p,i){const a=this.a;let k=a.length;a.push([p,i]);while(k){let j=(k-1)>>1;if(a[j][0]<=p)break;a[k]=a[j];k=j}a[k]=[p,i]}pop(){const a=this.a,r=a[0],t=a.pop();if(a.length){let k=0;while(k*2+1<a.length){let j=k*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(t[0]<=a[j][0])break;a[k]=a[j];k=j}a[k]=t}return r}get length(){return this.a.length}}
 const frontier=i=>{const x=(i%W)*8+4;return 530+35*Math.sin((x-600)/175)+56*Math.exp(-Math.pow((x-970)/240,2))+8*Math.sin(x/47)+6*(elevation[i]-100)/100};
 let dry=0,srcRock=0,srcSnow=0,prevSnow=0,rockReturned=0,trimmed=0;
 for(let i=0;i<N;i++)if(valid(i)){
  dry++;if(src[i]===7)srcRock++;if(src[i]===8)srcSnow++;if(prev[i]===8)prevSnow++;
  if(prev[i]===8&&src[i]===7){now[i]=7;rockReturned++;}
  else if(prev[i]===8&&src[i]!==8&&((i/W|0)*8+4)>frontier(i)){now[i]=src[i];trimmed++}
 }
 const eligible=i=>valid(i)&&now[i]!==8&&[0,1,2,3].includes(src[i])&&((i/W|0)*8+4)<=frontier(i)-16;
 const order=i=>{const x=i%W*8+4,y=(i/W|0)*8+4;return(y*.44+Math.abs(x-900)*.065-elevation[i]*.37+(src[i]===1?-5:src[i]===3?-15:src[i]===2?6:20))*100000+i};
 let snow=0;for(let i=0;i<N;i++)if(valid(i)&&now[i]===8)snow++;
 const target=Math.ceil(dry*.23),q=new Heap(),seen=new Uint8Array(N);
 for(let i=0;i<N;i++)if(valid(i)&&now[i]===8)for(const j of neighbors(i))if(!seen[j]&&eligible(j)){seen[j]=1;q.push(order(j),j)}
 let added=0;while(snow+added<target&&q.length){const i=q.pop()[1];if(!eligible(i))continue;now[i]=8;added++;for(const j of neighbors(i))if(!seen[j]&&eligible(j)){seen[j]=1;q.push(order(j),j)}}
 const cold=new Uint8Array(N),rim=[];
 for(let i=0;i<N;i++)if(valid(i)&&now[i]===8)cold[i]=3;
 for(let i=0;i<N;i++)if(cold[i]===3)for(const j of neighbors(i))if(valid(j)&&cold[j]===0){cold[j]=2;rim.push(j)}
 for(const i of rim)for(const j of neighbors(i))if(valid(j)&&cold[j]===0)cold[j]=1;
 let rock=0,snowFinal=0,farSouth=0,changedOther=0,damagedOldSnow=0,changedWater=0;
 const bands=Array(8).fill(0);
 for(let i=0;i<N;i++){
  if(!valid(i)){if(now[i]!==src[i])changedWater++;continue}
  if(src[i]===7&&now[i]!==7)throw Error("WMP04R1_ROCK_LOSS:"+i);
  if(src[i]===8&&now[i]!==8)damagedOldSnow++;
  if(now[i]===7)rock++;
  if(now[i]===8){snowFinal++;let y=(i/W|0)*8;if(y>=610)farSouth++;if(y<800)bands[Math.floor(y/100)]++}
  if(src[i]!==8&&src[i]!==7&&now[i]!==8&&now[i]!==prev[i]&&prev[i]!==8)changedOther++;
 }
 if(srcRock!==510||rock!==510||prevSnow!==3454||srcSnow!==217||rockReturned!==483)throw Error("WMP04R1_SOURCE_PARITY");
 if(snowFinal!==target||snowFinal/dry<.23||snowFinal/dry>.25||farSouth||changedOther||damagedOldSnow||changedWater)throw Error("WMP04R1_GEO_POLICY");
 return{biomeEffective:now,coldTransition:cold,stats:{dryLand:dry,previousSnow:prevSnow,snow:snowFinal,snowPercent:+(100*snowFinal/dry).toFixed(4),rockOriginal:srcRock,rockBefore:srcRock-rockReturned,rockRestored:rockReturned,rockAfter:rock,trimmedInlandSnow:trimmed,redistributedToNorthernFringe:added,snowCellsAtY610Plus:farSouth,sourceSnowRetained:srcSnow,snowBy100AuBands:bands,unchangedWater:changedWater===0,otherBiomeMutations:changedOther}};
}
