import {afterEach,describe,expect,it} from 'vitest';
import {HOUR,WW,type GameState} from '../src/game/core';
import {C,dispatch,newGame} from '../src/game/engine';
import {isRecipeKnown} from '../src/game/catalog';
import {syncWorld} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,validate} from '../src/game/persist';
const T=Date.UTC(2026,10,4);let seq=0;
const act=(g:GameState,type:string,data:object={},now=T+10)=>dispatch(g,{id:`acq-${++seq}`,type,...data},now);
const snap=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
afterEach(()=>setActiveLayout('shipping'));
describe('versioned unique Creator Core acquisition',()=>{
 it('places one initially charged rare body into each existing site and does not grant their recipes',()=>{
  setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:31},T).ok).toBe(true);const r=g.run!;
  for(const [key,poi] of [['core_meteor','light_top'],['core_dragon','factory_vault'],['core_elsa','wreck']]){
   const found=Object.values(r.entities).filter(e=>e.kind==='loot'&&e.poi===poi&&C(r,e.c!).slots.some(s=>s?.key===key));expect(found).toHaveLength(1);
   const body=C(r,found[0].c!).slots.find(s=>s?.key===key)!;expect(body.reserves).toEqual({basic:0,refined:0,signature:3});expect(isRecipeKnown(r.knowledge.recipes,key)).toBe(false);
  }expect(validate(snap(g))).toBeTruthy();
 });
 it('withdraws the UID once, and ordinary replacement cannot respawn the unique body',()=>{
  setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:32},T).ok).toBe(true);const r=g.run!;r.creatures=[];
  const e=Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='wreck'&&C(r,e.c!).slots.some(s=>s?.key==='core_elsa'))!;const c=C(r,e.c!),body=c.slots.find(s=>s?.key==='core_elsa')!;r.player.x=e.x;r.player.y=e.y;
  for(let i=0;i<c.slots.length;i++)if(c.slots[i])expect(act(g,'move',{from:c.id,fs:i,to:'inv'}).ok).toBe(true);
  expect(C(r,'inv').slots.find(s=>s?.uid===body.uid)?.reserves?.signature).toBe(3);const due=r.lootRespawnAt![e.ty!*WW+e.tx!];expect(due).toBeGreaterThan(T);syncWorld(g,due+1);
  const replacement=Object.values(r.entities).find(v=>v.kind==='loot'&&v.tx===e.tx&&v.ty===e.ty)!;expect(replacement).toBeTruthy();expect(C(r,replacement.c!).slots.some(s=>s?.key==='core_elsa')).toBe(false);expect(r.renewedLootSites).toContain(e.ty!*WW+e.tx!);expect(validate(snap(g))).toBeTruthy();
  syncWorld(g,due+HOUR);expect(Object.values(r.entities).filter(v=>v.kind==='loot'&&v.tx===e.tx&&v.ty===e.ty)).toHaveLength(1);
 });
});
