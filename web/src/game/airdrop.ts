/** Provisional Web adapter, not a certified Map landing contract. */
import {BAL,HOUR,TILE,WW,WH,T,hash2,type RunState} from './core';
import {getWorld,type World} from './world';

export function airdropArea(tx:number,ty:number):string {const x=Math.min(2,Math.floor(tx*3/WW)),y=Math.min(2,Math.floor(ty*3/WH));return [['northwest','north','northeast'],['west','central','east'],['southwest','south','southeast']][y][x]+' sector';}
export const supportsAirdrops=(layout:string)=>layout==='shipping_fresh'||layout==='dev_delta_fresh';
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;return h>>>0;}
// The roll keeps the legacy seed-derived id so reward rolls are unchanged; run ids are now unique per run (engine runIdFor).
const eventHash=(r:RunState,index:number)=>hash(`airdrop-v1|run_${r.seed.toString(36)}|${r.seed}|${r.startedAt}|${r.airdrops?.mapDigest}|${index}`);
export function airdropTimes(r:RunState,index:number){const b=BAL.airdropV1,signalAt=r.startedAt+(b.firstHours+index*b.cadenceHours)*HOUR+(eventHash(r,index)%(b.jitterMinutes*60000+1));const descentAt=signalAt+b.warningSeconds*1000,landAt=descentAt+b.descentSeconds*1000,unlockAt=landAt+b.lockSeconds*1000,expiresAt=landAt+b.lifetimeSeconds*1000;return {signalAt,descentAt,landAt,unlockAt,expiresAt};}
export function airdropRewards(r:RunState,index:number):[string,number][]{const b=BAL.airdropV1;let roll=eventHash(r,index)%b.weights.reduce((a:number,n:number)=>a+n,0),choice=0;while(roll>=b.weights[choice])roll-=b.weights[choice++];return [...b.fixed,b.options[choice]].map(([k,q])=>[k as string,q as number]);}
const caches=new WeakMap<World,Uint8Array>();
/** Exterior mask is derived from immutable built-in geometry and source layout. */
export function airdropStaticEligible(w:World,tx:number,ty:number):boolean {
  let mask=caches.get(w);if(!mask){mask=new Uint8Array(WW*WH);const m=w.economyMap,forbidden=new Uint8Array(WW*WH);
    for(const b of w.buildings)for(let y=Math.max(0,b.y-1);y<=Math.min(WH-1,b.y+b.h);y++)for(let x=Math.max(0,b.x-1);x<=Math.min(WW-1,b.x+b.w);x++)forbidden[y*WW+x]=1;
    for(const s of w.statics)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=s.tx+dx,y=s.ty+dy;if(x>=0&&y>=0&&x<WW&&y<WH)forbidden[y*WW+x]=1;}
    const radius=BAL.airdropV1.clearanceTiles;
    for(let y=2;y<WH-2;y++)for(let x=2;x<WW-2;x++){const i=y*WW+x,t=w.tiles[i];if(!m.walkable[i]||!m.buildable[i]||m.protected[i]||m.road[i]||m.slope[i]>BAL.airdropV1.maxSlope||forbidden[i]||![T.GRASS,T.MEADOW,T.FOREST,T.SAND,T.SNOW,T.HILL,T.MARSH,T.ASH].includes(t))continue;
      let ok=true;for(let dy=-radius;dy<=radius&&ok;dy++)for(let dx=-radius;dx<=radius;dx++){const j=(y+dy)*WW+x+dx;if(!m.walkable[j]||m.protected[j]||m.road[j]||w.accessCorridors?.mask[j]||w.sourceV3[j]||forbidden[j]){ok=false;break;}}
      if(ok)mask[i]=1;
    }caches.set(w,mask);
  }return Number.isInteger(tx)&&Number.isInteger(ty)&&tx>=0&&ty>=0&&tx<WW&&ty<WH&&!!mask[ty*WW+tx];
}
/** Connectivity to the actual saved spawn using the collision grid at signal time. */
export function chooseAirdropSite(r:RunState,index:number,grid:Uint8Array):{tx:number;ty:number}|null {
  const w=getWorld(r.layoutId||'shipping'),spawn=r.spawnChoice;if(!spawn)return null;const start=spawn.y*WW+spawn.x;
  const blocked=(i:number)=>[1,2,3,5].includes(grid[i]);if(blocked(start))return null;
  const seen=new Uint8Array(WW*WH),q=new Int32Array(WW*WH);let head=0,tail=0;q[tail++]=start;seen[start]=1;
  while(head<tail){const i=q[head++],x=i%WW,y=Math.floor(i/WW);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=WW-1||ny>=WH-1)continue;const j=ny*WW+nx;if(!seen[j]&&!blocked(j)){seen[j]=1;q[tail++]=j;}}}
  const occupied=new Set(Object.values(r.entities).map(e=>Math.floor(e.y/TILE)*WW+Math.floor(e.x/TILE)));const radius=BAL.airdropV1.clearanceTiles;let best=-1,score=Infinity;const salt=eventHash(r,index);
  for(let y=2;y<WH-2;y++)for(let x=2;x<WW-2;x++){const i=y*WW+x;if(!seen[i]||!airdropStaticEligible(w,x,y))continue;let ok=true;for(let dy=-radius;dy<=radius&&ok;dy++)for(let dx=-radius;dx<=radius;dx++){const j=(y+dy)*WW+x+dx;if(blocked(j)||occupied.has(j)){ok=false;break;}}if(!ok)continue;const h=hash2(x,y,salt);if(h<score){best=i;score=h;}}
  return best<0?null:{tx:best%WW,ty:Math.floor(best/WW)};
}

/** B04-P3: one read-only phase projection for HUD, E prompt and the crate marker.
 * Derived only from the real event entity, the real clock and the real stock count.
 * Exact landing coordinates are never part of the broadcast: the sector label is the only location. */
export type AirdropPhaseKey = 'incoming' | 'descending' | 'locked' | 'accessible' | 'partial' | 'expiring' | 'emptied';
export interface AirdropView { key: AirdropPhaseKey; label: string; detail: string; takeable: boolean; stacks: number; lockedRemainS: number | null; expiresInS: number | null; zone: string }
const EXPIRING_WINDOW_MS = 15 * 60000;
export function airdropView(a: { phase: string; descentAt: number; landAt: number; unlockAt: number; expiresAt: number }, tx: number, ty: number, now: number, stacks: number): AirdropView {
  const zone = airdropArea(tx, ty), s = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
  // The clock decides the pre-touchdown and lock phases, so the projection never lags a tick behind.
  // Partial/open come from the stored custody phase; the engine remains the only writer.
  const phase = now < a.descentAt ? 'signal' : now < a.landAt ? 'descending' : now < a.unlockAt ? 'locked' : (a.phase === 'partial' ? 'partial' : 'open');
  a = { ...a, phase };
  const base = { stacks, zone, takeable: false, lockedRemainS: null as number | null, expiresInS: null as number | null };
  if (a.phase === 'signal') return { ...base, key: 'incoming', label: 'AIRDROP INCOMING', detail: `signal over ${zone} · exact landing unknown · touchdown in ${s(a.landAt - now)}s` };
  if (a.phase === 'descending') return { ...base, key: 'descending', label: 'AIRDROP DESCENDING', detail: `chute over ${zone} · lands in ${s(a.landAt - now)}s` };
  if (a.phase === 'locked') return { ...base, key: 'locked', label: 'LANDED · LOCKED', detail: `${zone} · open to all in ${s(a.unlockAt - now)}s`, lockedRemainS: s(a.unlockAt - now) };
  if (stacks <= 0) return { ...base, key: 'emptied', label: 'EMPTIED', detail: `${zone} · no stock left` };
  const left = a.expiresAt - now, expiring = left <= EXPIRING_WINDOW_MS;
  const key: AirdropPhaseKey = expiring ? 'expiring' : a.phase === 'partial' ? 'partial' : 'accessible';
  const label = key === 'expiring' ? 'EXPIRING · TAKE ONLY' : key === 'partial' ? 'PARTIALLY CLAIMED · TAKE ONLY' : 'ACCESSIBLE · TAKE ONLY';
  return { ...base, key, label, takeable: true, expiresInS: s(left), detail: `${zone} · ${stacks} stack${stacks === 1 ? '' : 's'} left · expires in ${s(left)}s` };
}
