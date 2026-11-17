/** Controlled stocks/position, real paid packs and upgrade intents. Not natural acquisition. */
import {afterEach,describe,expect,it} from 'vitest';
import {T, WW, type GameState, type Entity} from '../src/game/core';
import {STRUCTS} from '../src/game/catalog';
import {dispatch,C,addItem,countItem,newGame,markDirty,buildReason} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {beside,buildCarried,command,reload} from './support/current-industry';
import {fundBuild} from './support/paid-build';
const NOW=Date.UTC(2026,10,17);
afterEach(()=>setActiveLayout('shipping'));
function start(){
  setActiveLayout('shipping_fresh');const g=newGame();
  expect(command(g,'startRun',{character:'female',seed:881},NOW)).toMatchObject({ok:true});g.run!.creatures=[];
  fundBuild(g,'floor_wood',NOW);const floor=buildCarried(g,'floor_wood',NOW);
  fundBuild(g,'claim',NOW);beside(g,floor.tx!-1,floor.ty!);
  expect(command(g,'build',{struct:'claim',tx:floor.tx,ty:floor.ty},NOW)).toMatchObject({ok:true});
  fundBuild(g,'wall_wood',NOW);const wall=buildCarried(g,'wall_wood',NOW);
  const cabinet=Object.values(g.run!.entities).find(e=>e.type==='claim')!;
  expect(wall.claim).toBe(cabinet.id);beside(g,wall.tx!-1,wall.ty!);
  return {g,wall,cabinet};
}
function upgrade(g:GameState,wall:Entity,target?:unknown){return command(g,'upgradeStructure',{eid:wall.id,...(target===undefined?{}:{target})},NOW+20);}
describe('processed plank has a legal optional building consumer',()=>{
  it('takes exactly three planks once on the same placed/damaged wall, then persists repair and upkeep material',()=>{
    const {g,wall,cabinet}=start(),r=g.run!;wall.hp=80;addItem(r,'inv','plank',2);
    const before=JSON.stringify(C(r,'inv'));
    expect(upgrade(g,wall,'wall_plank')).toMatchObject({ok:false});expect(JSON.stringify(C(r,'inv'))).toBe(before);
    expect(wall.type).toBe('wall_wood');addItem(r,'inv','plank',1);
    const id=wall.id,at=[wall.x,wall.y,wall.tx,wall.ty];
    expect(upgrade(g,wall,'wall_plank')).toMatchObject({ok:true});
    expect(wall).toMatchObject({id,type:'wall_plank',hp:120,maxHp:240,claim:cabinet.id});
    expect([wall.x,wall.y,wall.tx,wall.ty]).toEqual(at);expect(countItem(r,'inv','plank')).toBe(0);
    expect(upgrade(g,wall,'wall_plank')).toMatchObject({ok:false});
    expect(reload(g).run!.entities[id]).toMatchObject({type:'wall_plank',hp:120,maxHp:240});
    // Higher HP does not imply direct placement or a free shortcut around cabinet authority.
    expect(buildReason(g,'wall_plank',wall.tx!+1,wall.ty!)).toMatch(/upgrade/i);
  });
  it('keeps the original wood→stone default without requiring planks',()=>{
    const {g,wall}=start();addItem(g.run!,'inv','stone',8);addItem(g.run!,'inv','wood',1);
    expect(upgrade(g,wall)).toMatchObject({ok:true});expect(wall.type).toBe('wall_stone');
    expect(countItem(g.run!,'inv','plank')).toBe(0);
  });
  it('can later pay the unchanged stone bill from a plank wall without healing or refunding its earlier planks',()=>{
    const {g,wall}=start(),r=g.run!;addItem(r,'inv','plank',3);expect(upgrade(g,wall,'wall_plank')).toMatchObject({ok:true});
    wall.hp=120;addItem(r,'inv','stone',8);addItem(r,'inv','wood',1);
    expect(upgrade(g,wall)).toMatchObject({ok:true});expect(wall).toMatchObject({type:'wall_stone',hp:190,maxHp:380});
    expect(countItem(r,'inv','stone')).toBe(0);expect(countItem(r,'inv','plank')).toBe(0);
  });
  it('refuses target injection, wrong ownership/floor, unsupported/missing cabinet and walls through walls atomically',()=>{
    const {g,wall,cabinet}=start();addItem(g.run!,'inv','plank',12);
    const check=(state:GameState,target:unknown='wall_plank')=>{
      const entity=state.run!.entities[wall.id],before=JSON.stringify(C(state.run!,'inv')),shape=JSON.stringify(entity);
      markDirty();expect(upgrade(state,entity,target)).toMatchObject({ok:false});
      expect(JSON.stringify(C(state.run!,'inv'))).toBe(before);expect(JSON.stringify(entity)).toBe(shape);
    };
    for(const bad of ['wall_brick','floor_stone','workbench','__proto__',{},null])check(g,bad);
    const noCab=structuredClone(g);delete noCab.run!.entities[cabinet.id];check(noCab);
    const unsupported=structuredClone(g);for(const e of Object.values(unsupported.run!.entities))if(e.tx===cabinet.tx&&e.ty===cabinet.ty&&STRUCTS[e.type!]?.layer==='floor')delete unsupported.run!.entities[e.id];check(unsupported);
    const foreign=structuredClone(g);foreign.run!.entities[wall.id].owner='other';check(foreign);
    const floor=structuredClone(g);floor.run!.veyraFloor=1;check(floor);
    const far=structuredClone(g);far.run!.player.x+=160;check(far);
    const blocked=structuredClone(g),br=blocked.run!;
    br.player.x=wall.x-32;br.player.y=wall.y;br.terrain[wall.ty!*WW+wall.tx!-1]={t:T.PWALL};check(blocked);
  });
  it('takes one repair plank from the current wall bill, preserves its shape, and never replays a successful upgrade payment',()=>{
    const {g,wall}=start(),r=g.run!;addItem(r,'inv','plank',4);
    const intent={eid:wall.id,target:'wall_plank'};
    // Same physical wall/position and one successful command ID, not two independent payments.
    const first={id:'one-plank-upgrade',type:'upgradeStructure',...intent};
    expect(dispatch(g,first,NOW+20)).toMatchObject({ok:true});
    expect(dispatch(g,first,NOW+21)).toMatchObject({ok:false,dup:true});
    expect(countItem(r,'inv','plank')).toBe(1);wall.hp=120;
    expect(command(g,'repairStructure',{eid:wall.id},NOW+22)).toMatchObject({ok:true});
    expect(countItem(r,'inv','plank')).toBe(0);expect(wall.hp).toBe(180);
    expect(reload(g).run!.entities[wall.id]).toMatchObject({type:'wall_plank',hp:180,maxHp:240});
  });

});
