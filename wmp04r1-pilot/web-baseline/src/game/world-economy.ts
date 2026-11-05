// Map -> Gameplay contract, placement rules v3. Arrays are row-major and immutable
// for a map revision. The map supplies semantics; this module never paints terrain,
// invents POIs or creates special/unique loot. All rates below are TUNABLE.
import { hash2 } from './core';
import { SOURCES } from './catalog';

export type Biome = 'water'|'sand'|'grass'|'meadow'|'forest'|'marsh'|'hill'|'snow'|'ash'|'toxic'|'road'|'floor'|'wall'|'lava';
export interface EconomyMap {
  id: string; revision: number; seed: number; width: number; height: number; tileSize: number;
  biome: readonly Biome[]; elevation: ArrayLike<number>; slope: ArrayLike<number>; moisture: ArrayLike<number>;
  temperature: ArrayLike<number>; freshwater: ArrayLike<number>; coast: ArrayLike<number>;
  walkable: ArrayLike<number>; buildable: ArrayLike<number>; cargoPassable: ArrayLike<number>;
  road: ArrayLike<number>; protected: ArrayLike<number>; industrial: ArrayLike<number>;
  starts: { id: string; x: number; y: number }[];
}
export interface EconomyPlacement { sources: (string|null)[]; errors: string[] }
const stableHash = (s:string) => { let h=2166136261; for (let i=0;i<s.length;i++) h=Math.imul(h^s.charCodeAt(i),16777619); return h>>>0; };
// Accidental-change guard, not anti-tamper authentication.
export const sourceDigest = (sources: (string|null)[]) => stableHash(sources.map(x=>x||'-').join('|')).toString(16).padStart(8,'0');
const OFFSETS = [[1,0],[-1,0],[0,1],[0,-1]] as const;

export function validateEconomyMap(m: EconomyMap): string[] {
  const e:string[]=[]; if (!/^[a-z][a-z0-9_-]*$/.test(m.id||'')) e.push('stable map id required');
  if (!Number.isSafeInteger(m.revision)||m.revision<1 || !Number.isSafeInteger(m.seed)||m.seed<0) e.push('positive revision and nonnegative integer world seed required');
  if (!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<3||m.height<3||!Number.isFinite(m.tileSize)||m.tileSize<=0) return [...e,'invalid bounds/tile scale'];
  const n=m.width*m.height; if (!Number.isSafeInteger(n) || n>1_000_000) return [...e,'map exceeds supported cell count'];
  for(const k of ['biome','elevation','slope','moisture','temperature','freshwater','coast','walkable','buildable','cargoPassable','road','protected','industrial'] as const) if(!m[k]||m[k].length!==n) e.push(`${k} must have ${n} cells`);
  if (!e.length) {
    const biomes=new Set(['water','sand','grass','meadow','forest','marsh','hill','snow','ash','toxic','road','floor','wall','lava']);
    const flags=['freshwater','coast','walkable','buildable','cargoPassable','road','protected','industrial'] as const;
    for (let i=0;i<n;i++) {
      if(!biomes.has(m.biome[i])) {e.push(`unknown biome at cell ${i}`);break;}
      if(!Number.isFinite(m.elevation[i])||!Number.isFinite(m.slope[i])||m.slope[i]<0||![m.moisture[i],m.temperature[i]].every(v=>Number.isFinite(v)&&v>=0&&v<=1)) {e.push(`invalid terrain or climate at cell ${i}`);break;}
      if(flags.some(k=>m[k][i]!==0&&m[k][i]!==1)) {e.push(`invalid geographic mask at cell ${i}`);break;}
    }
  }
  if(!Array.isArray(m.starts)||!m.starts.length) e.push('at least one authored start required');
  else {const ids=new Set<string>(); for(const s of m.starts) {if(!s||!s.id||ids.has(s.id)||!Number.isInteger(s.x)||!Number.isInteger(s.y)||s.x<1||s.y<1||s.x>=m.width-1||s.y>=m.height-1) e.push(`invalid or duplicate start ${s?.id}`);if(s?.id)ids.add(s.id);}}
  return e;
}

/** Graph reachability is based on the map's physical walkable mask, not distance in a picture. */
export function reachable(m: EconomyMap, x:number,y:number, maxSteps=Infinity): Int32Array {
  const n=m.width*m.height, dist=new Int32Array(n).fill(-1); if(x<0||y<0||x>=m.width||y>=m.height) return dist;
  const start=y*m.width+x; if(!m.walkable[start]) return dist; const q=new Int32Array(n);let h=0,t=0;q[t++]=start;dist[start]=0;
  while(h<t){const i=q[h++],px=i%m.width,py=Math.floor(i/m.width); if(dist[i]>=maxSteps)continue;for(const [dx,dy] of OFFSETS){const nx=px+dx,ny=py+dy;if(nx<0||ny<0||nx>=m.width||ny>=m.height)continue;const j=ny*m.width+nx;if(dist[j]<0&&m.walkable[j]){dist[j]=dist[i]+1;q[t++]=j;}}}return dist;
}

/** Stable independently keyed random streams, with explicit weighted competition per cell.
 * A source's presence does not depend on insertion order in the source catalog. */
export function compileEconomy(m: EconomyMap): EconomyPlacement {
  const errors=validateEconomyMap(m); const n=m.width*m.height; if(errors.length) return {sources:[],errors};
  const reached=new Uint8Array(n); for(const s of m.starts){const d=reachable(m,s.x,s.y);if(d[s.y*m.width+s.x]<0) errors.push(`start ${s.id} is not walkable`);for(let i=0;i<n;i++)if(d[i]>=0)reached[i]=1;}
  const out:(string|null)[]=Array(n).fill(null), salt=stableHash(`${m.id}/${m.revision}/v3`) ^ m.seed;
  const nearRoad=(x:number,y:number)=>{let best=99;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=m.width||ny>=m.height)continue;if(m.road[ny*m.width+nx] && reached[ny*m.width+nx] && m.cargoPassable[ny*m.width+nx])best=Math.min(best,Math.abs(dx)+Math.abs(dy));}return best;};
  for(let y=1;y<m.height-1;y++)for(let x=1;x<m.width-1;x++){
    const i=y*m.width+x, biome=m.biome[i]; if(!m.walkable[i]||!reached[i]||m.protected[i]||m.road[i]||['water','road','floor','wall','lava'].includes(biome)||m.slope[i]>.6)continue;
    const roadDist=nearRoad(x,y), cold=m.temperature[i]<.3, warm=m.temperature[i]>.55, moist=m.moisture[i];
    // All weights are per eligible tile; expected total is proportional to suitable area.
    const rates:Record<string,number>={};
    if(biome==='forest'){rates[cold?'pine':'oak']=.28; rates.bush=.035;rates.grass=.045;rates.herb=.015;rates.rock=.012;}
    if(biome==='grass'){rates.oak=.045;rates.bush=.04;rates.grass=.075;rates.herb=.01;rates.rock=.02;}
    if(biome==='meadow'){rates.oak=.018;rates.bush=.055;rates.grass=.115;rates.rock=.02;}
    if(biome==='snow'){rates.snowpine=.12;rates.rock=.035;rates.crystal=.018;}
    if(biome==='hill'){rates.rock=.10;rates.iron=.065;rates.coalv=.027;if(cold)rates.crystal=.014;}
    if(biome==='sand'){if(warm && m.coast[i])rates.palm=.06;rates.rock=.012;if(m.coast[i])rates.salt_shale=.16;}
    if(biome==='marsh'){rates.willow=.06;rates.reed=moist>.5?.14:.07;rates.mushroom=.035;rates.herb=.014;}
    if(biome==='ash'){rates.sulfur=.035;rates.rock=.04;rates.deadtree=.02;rates.coalv=.018;}
    if(biome==='toxic'){rates.deadtree=.02;rates.iron=.008;}
    if(roadDist>=2&&roadDist<=3){rates.scrap=.075;rates.wreck=.015;}
    if(m.industrial[i]){rates.scrap=(rates.scrap||0)+.035;rates.wreck=(rates.wreck||0)+.012;}
    let choice:string|null=null,best=Infinity;
    for(const [key,p] of Object.entries(rates)){ const u=Math.max(hash2(x,y,salt ^ stableHash(key)),1e-9);const score=-Math.log(u)/p;if(score<best){best=score;choice=key;} }
    if(best<1) out[i]=choice;
  }
  // Blockers compete using a separate spatial priority, not scan order. This
  // prevents touching solid nodes from forming artificial one-tile walls.
  const blockers:number[]=[];for(let i=0;i<n;i++)if(out[i]&&SOURCES[out[i]!]?.block)blockers.push(i);
  blockers.sort((a,b)=>hash2(a%m.width,Math.floor(a/m.width),salt ^ 0x275e)-hash2(b%m.width,Math.floor(b/m.width),salt ^ 0x275e)||a-b);
  const accepted=new Uint8Array(n);for(const i of blockers){const x=i%m.width,y=Math.floor(i/m.width);if(OFFSETS.some(([dx,dy])=>accepted[(y+dy)*m.width+x+dx]))out[i]=null;else accepted[i]=1;}
  // Remove candidates which became physically isolated by the combined source
  // layout. Never synthesize a fallback source or alter map geometry.
  const pass = new Uint8Array(n); for (let i=0;i<n;i++) pass[i] = +(!!m.walkable[i] && !(out[i] && SOURCES[out[i]!]?.block));
  const accessible = new Uint8Array(n); for (const start of m.starts) { const d=reachable({...m,walkable:pass},start.x,start.y); for(let i=0;i<n;i++) if(d[i]>=0) accessible[i]=1; }
  for(let i=0;i<n;i++) if(out[i] && !accessible[i]) { const x=i%m.width,y=Math.floor(i/m.width); if(!OFFSETS.some(([dx,dy])=>x+dx>=0&&y+dy>=0&&x+dx<m.width&&y+dy<m.height&&accessible[(y+dy)*m.width+x+dx])) out[i]=null; }
  return {sources:out,errors};
}

/** Diagnostics are not a guarantee of balance or a permission to fill missing stock. */
export function diagnoseStarts(m: EconomyMap, sources:(string|null)[], steps=30): string[] {
  const errors=validateEconomyMap(m); if(errors.length||sources.length!==m.width*m.height) return [...errors,'source grid missing'];
  const pass=new Uint8Array(sources.length);for(let i=0;i<pass.length;i++)pass[i]=+(!!m.walkable[i]&&!(sources[i]&&SOURCES[sources[i]!]?.block));
  for(const start of m.starts){const d=reachable({...m,walkable:pass},start.x,start.y,steps), types=new Set<string>();let water=false,buildable=0;
    for(let i=0;i<d.length;i++) if(d[i]>=0){if(m.freshwater[i]) water=true;if(m.buildable[i]&&!m.protected[i]&&!sources[i])buildable++;
      const x=i%m.width,y=Math.floor(i/m.width); for(const [dx,dy] of [[0,0],...OFFSETS]){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<m.width&&ny<m.height){const j=ny*m.width+nx;if(sources[j])types.add(sources[j]!);if(m.freshwater[j])water=true;}}
    }
    if(![...types].some(k=>['oak','pine','snowpine','palm','willow'].includes(k)))errors.push(`${start.id}: no accessible wood within ${steps} steps`);
    if(!types.has('rock'))errors.push(`${start.id}: no accessible stone within ${steps} steps`);
    if(!types.has('bush')&&!types.has('mushroom'))errors.push(`${start.id}: no accessible plant food within ${steps} steps`);
    if(!types.has('scrap')&&!types.has('wreck'))errors.push(`${start.id}: no accessible salvage within ${steps} steps`);
    if(!water)errors.push(`${start.id}: no accessible fresh water within ${steps} steps`);
    if(buildable<9)errors.push(`${start.id}: fewer than 9 accessible buildable cells within ${steps} steps`);
  }return errors;
}
