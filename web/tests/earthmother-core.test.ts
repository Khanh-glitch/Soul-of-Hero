import {afterEach,describe,expect,it} from 'vitest';
import {TILE,WW,type GameState} from '../src/game/core';
import {addItem,blockGrid,C,dispatch,mkCreature,newGame} from '../src/game/engine';
import {tick,syncWorld,type Input} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,validate} from '../src/game/persist';
const T=Date.UTC(2026,10,4);let seq=0;
const act=(g:GameState,type:string,data:object={})=>dispatch(g,{id:`nature-${++seq}`,type,...data},T+1);
const snap=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
function setup(){setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:83}).ok).toBe(true);const r=g.run!;r.creatures=[];addItem(r,'inv','core_earthmother',1);addItem(r,'inv','energy_refined',3);addItem(r,'inv','essence_nature',1);const slot=C(r,'inv').slots.findIndex(s=>s?.key==='core_earthmother'),core=C(r,'inv').slots[slot]!;r.player.active=slot;act(g,'loadCore',{slot,uid:core.uid,mode:'signature'});act(g,'loadCore',{slot,uid:core.uid,mode:'refined'});return {g,r,slot,core};}
function cast(g:GameState,mode:'refined'|'signature',now=T+100){const r=g.run!,input:Input={up:false,down:false,left:false,right:false,mx:r.player.x+60,my:r.player.y,attack:false,attackPressed:false,roll:false,cancel:false,skill:mode};for(let i=0;i<6;i++){tick(g,input,50,now+i*50);input.skill=undefined;}}
afterEach(()=>setActiveLayout('shipping'));
describe('Earthmother physical grove',()=>{
 it('places ten physical blockers for exactly three seconds, then produces ten collectible wood once, including offline',()=>{
  const {g,r,core}=setup();cast(g,'refined');expect(r.natureTrees).toHaveLength(10);expect(core.reserves!.refined).toBe(1);const trees=[...r.natureTrees!];for(const q of trees)expect(blockGrid(r)[q.ty*WW+q.tx]).toBe(2);
  const saved=snap(g);expect(validate(saved)).toBeTruthy();const due=T+350+3000;syncWorld(saved,due-1);expect(saved.run!.natureTrees).toHaveLength(10);syncWorld(saved,due);expect(saved.run!.natureTrees).toHaveLength(0);
  expect(saved.run!.receipts.filter(x=>x.kind==='core.grove.wood')).toHaveLength(10);expect(Object.values(saved.run!.entities).filter(e=>e.kind==='drop'&&C(saved.run!,e.c!).slots[0]?.key==='wood')).toHaveLength(10);syncWorld(saved,due+100);expect(saved.run!.receipts.filter(x=>x.kind==='core.grove.wood')).toHaveLength(10);expect(validate(snap(saved))).toBeTruthy();
 });
 it('creates a temporary rooting field which attacks eligible enemies and does not debit twice',()=>{
  const {g,r,core}=setup();const enemy=mkCreature(r,'boar',r.player.x+40,r.player.y,80);r.creatures=[enemy];const hp=enemy.hp;cast(g,'signature');for(let i=0;i<8;i++)tick(g,{up:false,down:false,left:false,right:false,mx:r.player.x+60,my:r.player.y,attack:false,attackPressed:false,roll:false,cancel:false},50,T+400+i*50);
  expect(enemy.hp).toBeLessThan(hp);expect(enemy.rootedUntil).toBeGreaterThan(T+400);expect(core.reserves!.signature).toBe(0);expect(r.combat!.hazards.some(h=>h.effect==='natureRoot')).toBe(true);expect(validate(snap(g))).toBeTruthy();
 });
});
