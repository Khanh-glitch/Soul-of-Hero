/** Paid original objects, controlled floor projection to isolate legacy/multi-storey
 * custody. Not a natural upstairs building journey or permission to change Map. */
import {afterEach,describe,it,expect} from 'vitest';
import {type Entity} from '../src/game/core';
import {addItem,C,claimAt,markDirty,newGame,planTerritory,refreshTerritoryLinks} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {fundBuild} from './support/paid-build';
import {beside,buildCarried,command,reload} from './support/current-industry';
const NOW=Date.UTC(2026,10,17);
afterEach(()=>setActiveLayout('shipping'));
function setup(){
 setActiveLayout('shipping_fresh');const g=newGame();expect(command(g,'startRun',{character:'female',seed:881},NOW)).toMatchObject({ok:true});const r=g.run!;r.creatures=[];
 const group=()=>{
  fundBuild(g,'floor_wood',NOW);const floor=buildCarried(g,'floor_wood',NOW);
  fundBuild(g,'claim',NOW);beside(g,floor.tx!-1,floor.ty!);
  expect(command(g,'build',{struct:'claim',tx:floor.tx,ty:floor.ty},NOW)).toMatchObject({ok:true});
  const cabinet=Object.values(r.entities).find(e=>e.type==='claim'&&e.tx===floor.tx&&e.ty===floor.ty)!;
  fundBuild(g,'wall_wood',NOW);const wall=buildCarried(g,'wall_wood',NOW);
  return {floor,cabinet,wall};
 };
 const lower=group(),upper=group();
 // Paid objects retain exact IDs/UIDs/storage; only fixture floor projection changes.
 for(const e of Object.values(upper))(e as Entity & {floor:1}).floor=1;
 beside(g,lower.cabinet.tx!-1,lower.cabinet.ty!);markDirty();
 return {g,r,lower,upper};
}
describe('cabinet action and cached hints use the same entity-floor authority as upkeep',()=>{
 it('does not consume downstairs stock or heal an upstairs wall when only the upstairs wall is damaged',()=>{
  const {g,r,lower,upper}=setup();upper.wall.hp=80;addItem(r,lower.cabinet.c!,'wood',10);
  expect(planTerritory(r).assigned.get(upper.wall.id)?.id).toBe(upper.cabinet.id);
  expect(claimAt(r,upper.wall.tx!,upper.wall.ty!)?.id).toBe(lower.cabinet.id);
  const stock=JSON.stringify(C(r,lower.cabinet.c!));
  expect(command(g,'cabinetRepair',{eid:lower.cabinet.id},NOW+20)).toMatchObject({ok:false});
  expect(upper.wall.hp).toBe(80);expect(JSON.stringify(C(r,lower.cabinet.c!))).toBe(stock);
 });
 it('repairs only the requesting cabinet floor, preserving the other physical wall and stock through reload',()=>{
  const {g,r,lower,upper}=setup();lower.wall.hp=80;upper.wall.hp=80;
  for(const c of [lower.cabinet,upper.cabinet])addItem(r,c.c!,'wood',10);
  const upperStock=JSON.stringify(C(r,upper.cabinet.c!));
  expect(command(g,'cabinetRepair',{eid:lower.cabinet.id},NOW+20)).toMatchObject({ok:true});
  expect(lower.wall.hp).toBe(120);expect(upper.wall.hp).toBe(80);
  expect(C(r,lower.cabinet.c!).slots.find(s=>s?.key==='wood')!.qty).toBe(8);
  expect(JSON.stringify(C(r,upper.cabinet.c!))).toBe(upperStock);
  const loaded=reload(g);expect(loaded).toBeTruthy();expect(loaded.run!.entities[upper.wall.id].hp).toBe(80);
  const lr=loaded.run!,bottomStock=JSON.stringify(C(lr,lower.cabinet.c!));
  lr.veyraFloor=1;beside(loaded,upper.cabinet.tx!-1,upper.cabinet.ty!);
  expect(command(loaded,'cabinetRepair',{eid:lower.cabinet.id},NOW+21)).toMatchObject({ok:false});
  expect(command(loaded,'cabinetRepair',{eid:upper.cabinet.id},NOW+22)).toMatchObject({ok:true});
  expect(lr.entities[upper.wall.id].hp).toBe(120);expect(lr.entities[lower.wall.id].hp).toBe(120);
  expect(C(lr,upper.cabinet.c!).slots.find(s=>s?.key==='wood')!.qty).toBe(8);
  expect(JSON.stringify(C(lr,lower.cabinet.c!))).toBe(bottomStock);
 });
 it('refreshes link hints by each entity floor, independent of the player floor and stale saved hints',()=>{
  const {r,lower,upper}=setup();
  for(const playerFloor of [0,1] as const){
   r.veyraFloor=playerFloor;markDirty();
   for(const e of [lower.wall,upper.wall])e.claim='stale';
   refreshTerritoryLinks(r);const plan=planTerritory(r);
   for(const e of [lower.wall,upper.wall])expect(e.claim).toBe(plan.assigned.get(e.id)?.id);
   expect(lower.wall.claim).toBe(lower.cabinet.id);expect(upper.wall.claim).toBe(upper.cabinet.id);
  }
 });
});
