import {afterEach,describe,expect,it} from 'vitest';
import {TILE,WW,type GameState} from '../src/game/core';
import {addItem,blockGrid,C,dispatch,mkCreature,newGame} from '../src/game/engine';
import {tick,type Input} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,validate} from '../src/game/persist';
const T=Date.UTC(2026,10,4);let n=0;const act=(g:GameState,type:string,data:object={})=>dispatch(g,{id:`mj-${++n}`,type,...data},T+1);
const snap=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
function setup(){setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:17}).ok).toBe(true);const r=g.run!;r.creatures=[];addItem(r,'inv','core_mjolnir',1);addItem(r,'inv','energy_refined',3);addItem(r,'inv','essence_nature',1);const slot=C(r,'inv').slots.findIndex(s=>s?.key==='core_mjolnir'),core=C(r,'inv').slots[slot]!;r.player.active=slot;act(g,'loadCore',{slot,uid:core.uid,mode:'signature'});act(g,'loadCore',{slot,uid:core.uid,mode:'refined'});const grid=blockGrid(r);let p=0;outer:for(let y=20;y<180;y++)for(let x=20;x<170;x++)if([0,1,2,3,4,5,6].every(dx=>grid[y*WW+x+dx]===0)){p=y*WW+x;break outer;}r.player.x=p%WW*TILE+8;r.player.y=Math.floor(p/WW)*TILE+8;return {g,r,core};}
const inp=(g:GameState):Input=>({up:false,down:false,left:false,right:false,mx:g.run!.player.x+60,my:g.run!.player.y,attack:false,attackPressed:false,roll:false,cancel:false});
function frames(g:GameState,start:number,count:number,mode?:'signature'|'refined'){for(let i=0;i<count;i++){const v=inp(g);if(i===0)v.skill=mode;tick(g,v,50,start+50*i);}}
afterEach(()=>setActiveLayout('shipping'));
describe('Mjolnir actions',()=>{
 it('commits exactly five successive physical strikes with separate timed damage',()=>{const {g,r,core}=setup(),m=mkCreature(r,'boar',r.player.x+60,r.player.y,500);m.frozenUntil=T+20000;r.creatures=[m];frames(g,T+100,50,'refined');expect(r.receipts.filter(x=>x.kind==='core.mjolnir.strike')).toHaveLength(5);expect(m.hp).toBeLessThan(500);expect(core.reserves!.refined).toBe(1);expect(validate(snap(g))).toBeTruthy();});
 it('pulls physically before its final burst and retains its pending state through save',()=>{const {g,r,core}=setup(),m=mkCreature(r,'boar',r.player.x+95,r.player.y,200);m.frozenUntil=T+20000;r.creatures=[m];const before=m.x;frames(g,T+100,12,'signature');expect(m.x).toBeLessThan(before);expect(r.combat!.hazards.some(h=>h.effect==='mjolnirPull')).toBe(true);const saved=snap(g);expect(validate(saved)).toBeTruthy();frames(saved,T+700,50);expect(saved.run!.receipts.filter(x=>x.kind==='core.mjolnir.strike')).toHaveLength(1);expect(saved.run!.creatures.find(x=>x.id===m.id)!.hp).toBeLessThan(200);expect(core.reserves!.signature).toBe(0);});
});
