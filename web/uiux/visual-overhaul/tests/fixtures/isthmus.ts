import type {Biome, EconomyMap} from '../../src/game/world-economy';
export function fixture():EconomyMap {
 const width=72,height=48,n=width*height,biome:Biome[]=Array(n).fill('grass');const walkable=new Uint8Array(n).fill(1),road=new Uint8Array(n),protectedCells=new Uint8Array(n),industrial=new Uint8Array(n),coast=new Uint8Array(n),freshwater=new Uint8Array(n),moisture=new Float32Array(n).fill(.5),temp=new Float32Array(n).fill(.7),elevation=new Float32Array(n),slope=new Float32Array(n);
 // A narrow cross-island sea channel and bridge, east-side forest, west marsh.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;if(x===0||y===0||x===width-1||y===height-1||(x>=33&&x<=35&&y!==24)){biome[i]='water';walkable[i]=0;}else if(x<20&&y>24){biome[i]='marsh';moisture[i]=.8;}else if(x>48){biome[i]='forest';}if(y===24&&walkable[i]){biome[i]='road';road[i]=1;protectedCells[i]=1;}if(x>55&&x<64&&y>18&&y<23)industrial[i]=1;}
 return {id:'isthmus-fixture',revision:1,seed:42,width,height,tileSize:16,biome,walkable,buildable:walkable.slice(),cargoPassable:walkable.slice(),road,protected:protectedCells,industrial,coast,freshwater,moisture,temperature:temp,elevation,slope,starts:[{id:'west',x:10,y:24},{id:'east',x:60,y:24}]};
}
