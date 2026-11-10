// MEC-01 R8B: wood -> plank -> plank wall (K4 "gỗ→ván→nhà"). SOH_PROVISIONAL numbers, no LI plank figure exists.
// CRAFTED = real craft/build/move intents with real stepStations timing. FIXTURE = granted wood/stone for the bench and walls.
// Not claimed: natural harvest of this wood, natural play, human play, or native Godot behaviour.
import {describe,it,expect,afterEach} from 'vitest';
import {type GameState,type RunState,type Entity,TILE} from '../src/game/core';
import {RECIPES,STRUCTS} from '../src/game/catalog';
import {addItem,countItem,dispatch,markDirty,newGame,stepStations,buildReason} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,validate} from '../src/game/persist';

const START=Date.UTC(2026,10,12);let n=0;
afterEach(()=>setActiveLayout('shipping'));
const act=(g:GameState,type:string,p:object={},at=START+10)=>dispatch(g,{id:'r8b-'+(++n),type,...p} as any,at);
const place=(r:RunState,tx:number,ty:number)=>{r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;markDirty();};
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:808},START).ok).toBe(true);g.run!.creatures=[];markDirty();return g;}
function legalTileNear(g:GameState,cx:number,cy:number,struct:string):[number,number]{
  const r=g.run!;for(let k=1;k<=10;k++)for(let dy=-k;dy<=k;dy++)for(let dx=-k;dx<=k;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==k)continue;const tx=cx+dx,ty=cy+dy;place(r,tx-1,ty);const why=buildReason(g,struct,tx,ty);if(!why||why.startsWith('Missing materials'))return [tx,ty];}  // site only: the real build intent still checks materials}
  throw new Error('no legal tile for '+struct);
}
/** One real craft at the bench, then the finished output moved into the pack. */
function craftPlank(g:GameState,bench:Entity,at:number){
  const r=g.run!;place(r,bench.tx!-1,bench.ty!);
  const pre=act(g,'craft',{eid:bench.id,recipe:'plank'},at);expect(pre.ok,(pre as any).reason).toBe(true);
  const secs=RECIPES.plank.secs*1000;const out=bench.station!.outC!;
  stepStations(g,secs-1000,at+secs-1000);
  expect(r.custody[out].slots.some(s=>s?.key==='plank'),'plank before its real time').toBe(false);   // NEGATIVE: 1 s early
  stepStations(g,1500,at+secs+500);
  const i=r.custody[out].slots.findIndex(s=>s?.key==='plank');expect(i).toBeGreaterThanOrEqual(0);
  expect(act(g,'move',{from:out,fs:i,to:'inv'},at+secs+600).ok).toBe(true);
}

describe('MEC-01 R8B plank chain', () => {
  it('two wood make one plank at the bench, after 6 real seconds; too little wood is refused with no change', () => {
    const g=start();const r=g.run!;
    addItem(r,'inv','wood',14);addItem(r,'inv','stone',4);
    const sp=legalTileNear(g,r.player.x/TILE|0,r.player.y/TILE|0,'workbench');
    expect(act(g,'build',{struct:'workbench',tx:sp[0],ty:sp[1]},START+20).ok).toBe(true);
    const bench=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='workbench')!;
    // NEGATIVE: 1 wood is not enough for a plank; nothing is consumed and no job starts
    addItem(r,'inv','wood',1);                          // 1 wood in the pack (bench consumed the 14)
    place(r,bench.tx!-1,bench.ty!);
    const refused=act(g,'craft',{eid:bench.id,recipe:'plank'},START+30);
    expect(refused.ok).toBe(false);
    expect(countItem(r,'inv','wood')).toBe(1);
    expect(bench.station!.queue.length).toBe(0);
    // CRAFTED: 2 wood -> 1 plank
    addItem(r,'inv','wood',1);                          // 2 wood now
    craftPlank(g,bench,START+40);
    expect(countItem(r,'inv','wood')).toBe(0);
    expect(countItem(r,'inv','plank')).toBe(1);
    expect(RECIPES.plank.ins).toEqual([['wood',2]]);
    // Save/reload: the plank stack keeps its real quantity through the snapshot validator.
    const back=validate(JSON.parse(JSON.stringify(JSON.parse(JSON.parse(serializeSnapshot(g)).payload))));
    expect(back).not.toBeNull();
    expect(JSON.stringify(back)).toContain('"plank"');
  });

  it('a plank wall needs three real planks: with two it is refused and nothing is spent; with three it builds at 240 HP', () => {
    const g=start();const r=g.run!;
    addItem(r,'inv','wood',14);addItem(r,'inv','stone',4);
    const sp=legalTileNear(g,r.player.x/TILE|0,r.player.y/TILE|0,'workbench');
    act(g,'build',{struct:'workbench',tx:sp[0],ty:sp[1]},START+20);
    const bench=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='workbench')!;
    addItem(r,'inv','wood',6);
    craftPlank(g,bench,START+40);craftPlank(g,bench,START+60);
    expect(countItem(r,'inv','plank')).toBe(2);
    // Per wood: plank wall 240/6 = 40 HP per wood; log wall 160/5 = 32 HP per wood
    expect(STRUCTS.wall_plank.hp/(STRUCTS.wall_plank.cost[0][1]*2)).toBeGreaterThan(STRUCTS.wall_wood.hp/STRUCTS.wall_wood.cost[0][1]);
    const wp=legalTileNear(g,r.player.x/TILE|0,r.player.y/TILE|0,'wall_plank');
    // NEGATIVE: two planks are not enough; refused, no plank spent, no wall entity
    const before=countItem(r,'inv','plank');
    const refused=act(g,'build',{struct:'wall_plank',tx:wp[0],ty:wp[1]},START+100);
    expect(refused.ok).toBe(false);
    expect(countItem(r,'inv','plank')).toBe(before);
    expect(Object.values(r.entities).some(e=>e.type==='wall_plank')).toBe(false);
    // CRAFTED third plank, then the build spends exactly three
    craftPlank(g,bench,START+200);
    expect(act(g,'build',{struct:'wall_plank',tx:wp[0],ty:wp[1]},START+300).ok).toBe(true);
    const wall=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='wall_plank')!;
    expect(wall.maxHp).toBe(240);
    expect(countItem(r,'inv','plank')).toBe(0);
  });

  it('shelter stays buildable from raw wood alone: a log wall needs no plank', () => {
    const g=start();const r=g.run!;
    addItem(r,'inv','wood',5);
    const wp=legalTileNear(g,r.player.x/TILE|0,r.player.y/TILE|0,'wall_wood');
    expect(act(g,'build',{struct:'wall_wood',tx:wp[0],ty:wp[1]},START+20).ok).toBe(true);
    expect(countItem(r,'inv','wood')).toBe(0);
    expect(countItem(r,'inv','plank')).toBe(0);
  });
});

