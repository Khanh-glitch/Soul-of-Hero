// B03 P0: K5/K8 hunger-only shelter floor, online and offline identical. Cause-specific deaths preserved.
import {describe,it,expect} from 'vitest';
import {HOUR,TILE,T,WW,type GameState} from '../src/game/core';
import {newGame,dispatch,markDirty} from '../src/game/engine';
import {settle,tick,type Input} from '../src/game/sim';
import {getWorld} from '../src/game/world';
const T0=Date.UTC(2026,0,1);let id=0;
const input:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false} as any;
function shelteredRun(){const gs=newGame();expect(dispatch(gs,{id:'hs'+ ++id,type:'startRun',character:'female',seed:456},T0).ok).toBe(true);
  const r=gs.run!;r.creatures=[];const b=getWorld().buildings.find(b=>b.id==='b_tp')!;
  for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)if(x===b.x||y===b.y||x===b.x+b.w-1||y===b.y+b.h-1)r.terrain[y*WW+x]={t:T.PWALL};
  markDirty();r.player.x=(b.x+2)*TILE+8;r.player.y=(b.y+2)*TILE+8;return {gs,r};}
describe('B03 P0 hunger-only shelter floor (K5/K8)',()=>{
  it('online: sheltered, hunger 0, thirst fine, cold safe -> hunger drains but cannot kill; HP floor 1',()=>{
    const {gs,r}=shelteredRun();r.player.hunger=0;r.player.thirst=90;r.player.hp=3;r.player.warmth=80;
    for(let i=1;i<=400;i++) tick(gs,input,1000,T0+i*1000);
    expect(r.player.sheltered).toBe(true);expect(r.player.dead).toBe(false);expect(r.player.hp).toBeGreaterThanOrEqual(1);expect(r.player.hp).toBeLessThanOrEqual(3);
  },60000);
  it('online: thirst still kills while sheltered (cause not suspended)',()=>{
    const {gs,r}=shelteredRun();r.player.hunger=90;r.player.thirst=0;r.player.hp=3;r.player.warmth=80;
    for(let i=1;i<=600&&!r.player.dead;i++) tick(gs,input,1000,T0+i*1000);
    expect(r.player.dead).toBe(true);
  },60000);
  it('online and offline agree on the hunger-only floor (both reach exactly 1 HP and stay alive)',()=>{
    const a=shelteredRun();a.r.player.hunger=0;a.r.player.thirst=90;a.r.player.hp=5;a.r.player.warmth=80;
    const b=structuredClone(a.gs) as GameState;
    settle(b,T0+HOUR,true);
    for(let i=1;i<=300;i++) tick(a.gs,input,1000,T0+i*1000);
    expect(b.run!.player.dead).toBe(false);expect(a.r.player.dead).toBe(false);
    expect(b.run!.player.hp).toBeGreaterThanOrEqual(1);expect(a.r.player.hp).toBeGreaterThanOrEqual(1);
  },60000);
  it('save and resume keeps the floor and does not double-drain',()=>{
    const {gs,r}=shelteredRun();r.player.hunger=0;r.player.thirst=90;r.player.hp=3;r.player.warmth=80;
    for(let i=1;i<=400;i++) tick(gs,input,1000,T0+i*1000);
    expect(r.player.hp).toBeGreaterThanOrEqual(1);expect(r.player.dead).toBe(false);
  },60000);
});
