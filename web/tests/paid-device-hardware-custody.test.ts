import {afterEach,describe,expect,it} from 'vitest';
import {type GameState} from '../src/game/core';
import {FURNACE_LINING,GENERATOR_CAPACITY_UPGRADE,GARDEN_FRAME_COST,INDUSTRIAL_MODULE,WORKBENCH_UPGRADE,WORKBENCH_UPGRADE_III} from '../src/game/catalog';
import {addItem,C,countItem,newGame,markDirty} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {beside,command,reload} from './support/current-industry';
import {validate} from '../src/game/persist';
import {fundBuild} from './support/paid-build';
const NOW=Date.UTC(2026,10,17);
afterEach(()=>setActiveLayout('shipping'));
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(command(g,'startRun',{character:'female',seed:881},NOW)).toMatchObject({ok:true});g.run!.creatures=[];return g;}
function pay(g:GameState,bill:readonly (readonly [string,number])[]){for(const [k,q]of bill)expect(addItem(g.run!,'inv',k,q)).toBe(0);}
function station(g:GameState,type:string){fundBuild(g,type,NOW+1);return buildCarriedFromPack(g,type);}
// buildCarried intentionally crafts; this local builder instead places the already funded paid pack.
function buildCarriedFromPack(g:GameState,type:string){
  // Use the legal-site scan without granting a second pack or paying a second recipe.
  const r=g.run!,cx=r.player.x/16|0,cy=r.player.y/16|0;
  for(let k=1;k<20;k++)for(let dy=-k;dy<=k;dy++)for(let dx=-k;dx<=k;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==k)continue;
    beside(g,cx+dx-1,cy+dy);
    const result=command(g,'build',{struct:type,tx:cx+dx,ty:cy+dy},NOW+10);
    if(result.ok)return Object.values(r.entities).find(e=>e.kind==='struct'&&e.type===type&&e.tx===cx+dx&&e.ty===cy+dy)!;
  }throw Error('no legal site');
}
function paidL2(g:GameState){const b=station(g,'workbench');pay(g,WORKBENCH_UPGRADE.cost);expect(command(g,'upgradeStation',{eid:b.id},NOW+20)).toMatchObject({ok:true});return b;}
describe('paid device hardware follows its one physical packed UID',()=>{
  it('does not erase the paid L3 workbench or installed industrial module when reclaimed/redeployed/reloaded',()=>{
    const g=start(),r=g.run!,b=paidL2(g),uid=b.deployed!.uid;
    pay(g,WORKBENCH_UPGRADE_III.cost);expect(command(g,'upgradeStation',{eid:b.id},NOW+21)).toMatchObject({ok:true});
    pay(g,INDUSTRIAL_MODULE.cost);expect(command(g,'installIndustrial',{eid:b.id},NOW+22)).toMatchObject({ok:true});
    b.hp=83; // controlled incoming damage, never a free heal
    beside(g,b.tx!-1,b.ty!);
    expect(command(g,'reclaim',{eid:b.id},NOW+23)).toMatchObject({ok:true});
    expect(C(r,'inv').slots.find(s=>s?.uid===uid)?.dur).toBe(83);
    const saved=reload(g),before=JSON.stringify(C(saved.run!,'inv'));
    const moved=buildCarriedFromPack(saved,'workbench');
    expect(moved.deployed!.uid).toBe(uid);expect(moved.hp).toBe(83);
    expect(moved.station!.level).toBe(3);
    expect(moved.industrial).toEqual({enabled:false}); // installed hardware, not stale remote links or free power
    expect(countItem(saved.run!,'inv','deploy_workbench')).toBe(0);
    const back=reload(saved).run!;expect(back.entities[moved.id].station!.level).toBe(3);
    expect(Object.values(back.custody).flatMap(c=>c.slots).some(s=>s?.uid===uid)).toBe(false);
    expect(before).toContain(uid);
  });
  it('a paid kiln lining survives packing; an ordinary new furnace does not acquire it',()=>{
    const g=start(),r=g.run!,bench=paidL2(g),f=station(g,'furnace');
    r.player.x=(bench.x+f.x)/2;r.player.y=(bench.y+f.y)/2;markDirty();pay(g,FURNACE_LINING.cost);
    expect(command(g,'upgradeFurnace',{eid:f.id,benchId:bench.id},NOW+21)).toMatchObject({ok:true});
    const uid=f.deployed!.uid;
    expect(command(g,'reclaim',{eid:f.id},NOW+22)).toMatchObject({ok:true});
    const saved=reload(g),rebuilt=buildCarriedFromPack(saved,'furnace');
    expect(rebuilt.deployed!.uid).toBe(uid);expect(rebuilt.station!.upgrade).toBe('kiln_lining');
    const ordinary=station(saved,'furnace');expect(ordinary.station!.upgrade).toBeUndefined();
    expect(reload(saved).run!.entities[rebuilt.id].station!.upgrade).toBe('kiln_lining');
  });
  it('fails closed on cross-type, forged levels and runtime settings in packed hardware (live and save)',()=>{
    const g=start(),r=g.run!,b=paidL2(g);beside(g,b.tx!-1,b.ty!);
    expect(command(g,'reclaim',{eid:b.id},NOW+21)).toMatchObject({ok:true});
    const pack=C(r,'inv').slots.find(s=>s?.uid===b.deployed!.uid)!;
    const pristine=structuredClone(g);
    for(const bad of [
      {version:'station-hardware-v1',level:4},
      {version:'station-hardware-v1',level:1,industrial:true},
      {version:'station-hardware-v1',lining:true},
      {version:'station-hardware-v1',level:2,energy:999},
      {version:'station-hardware-v1',level:2,generatorId:'remote'},
      {version:'unknown',level:3},
    ]) {
      (pack as any).stationHardware=bad;
      const before=JSON.stringify(C(r,'inv'));
      expect(command(g,'build',{struct:'workbench',tx:b.tx,ty:b.ty},NOW+22)).toMatchObject({ok:false});
      expect(JSON.stringify(C(r,'inv'))).toBe(before);
      expect(validate(structuredClone(g))).toBeNull();
    }
    expect(validate(pristine)).not.toBeNull(); // old/plain packs remain legal too
    delete pack.stationHardware;
    expect(validate(structuredClone(g))).not.toBeNull();
    const plain=buildCarriedFromPack(g,'workbench');expect(plain.station!.level??1).toBe(1);
    expect(plain.industrial).toBeUndefined();
  });
  it('recovers a historical raw-paid L2 station into one explicit migration UID with its purchased level',()=>{
    const g=start(),r=g.run!,b=paidL2(g);delete b.deployed; // historical raw-built station shape
    expect(validate(structuredClone(g))).not.toBeNull();beside(g,b.tx!-1,b.ty!);
    expect(command(g,'reclaim',{eid:b.id},NOW+21)).toMatchObject({ok:true});
    const pack=C(r,'inv').slots.find(s=>s?.key==='deploy_workbench')!;
    expect(pack.stationHardware).toMatchObject({level:2});
    expect(r.receipts.filter(rc=>rc.kind==='pa1.legacy.unpack')).toHaveLength(1);
    expect(command(g,'reclaim',{eid:b.id},NOW+22)).toMatchObject({ok:false});
    expect(countItem(r,'inv','deploy_workbench')).toBe(1);
    const saved=reload(g),moved=buildCarriedFromPack(saved,'workbench');
    expect(moved.deployed!.uid).toBe(pack.uid);expect(moved.station!.level).toBe(2);
  });

  it('keeps a paid generator capacity upgrade, but not fuel, energy, enabled state or old wiring',()=>{
    const g=start(),r=g.run!,bench=paidL2(g),gen=station(g,'base_generator'),id=gen.deployed!.uid;
    r.player.x=(bench.x+gen.x)/2;r.player.y=(bench.y+gen.y)/2;markDirty();
    pay(g,GENERATOR_CAPACITY_UPGRADE.cost);
    expect(command(g,'upgradeGenerator',{eid:gen.id,benchId:bench.id},NOW+21)).toMatchObject({ok:true});
    gen.hp=93;gen.basePower!.energy=1500;gen.basePower!.enabled=true;gen.basePower!.priority='production';
    addItem(r,gen.c!,'wood',3);const fuelUid=C(r,gen.c!).slots.find(Boolean)!.uid;
    beside(g,gen.tx!-1,gen.ty!);
    expect(command(g,'reclaim',{eid:gen.id},NOW+22)).toMatchObject({ok:true});
    const saved=reload(g),rebuilt=buildCarriedFromPack(saved,'base_generator');
    expect(rebuilt.deployed!.uid).toBe(id);expect(rebuilt.hp).toBe(93);
    expect(rebuilt.basePower).toEqual({enabled:false,energy:0,network:'wire-v1',capacity:2});
    expect(C(saved.run!,rebuilt.c!).slots.every(s=>s===null)).toBe(true);
    expect(Object.values(saved.run!.custody).flatMap(c=>c.slots).filter(s=>s?.uid===fuelUid)).toHaveLength(1);
    const copy=reload(saved);expect(copy.run!.entities[rebuilt.id].basePower!.capacity).toBe(2);
    const ordinary=station(copy,'base_generator');expect(ordinary.basePower!.capacity).toBeUndefined();
  });
  it('keeps the paid cold frame without smuggling crops/water; dismantling it then packing cannot restore it',()=>{
    const g=start(),r=g.run!,plot=station(g,'garden'),id=plot.deployed!.uid;
    pay(g,GARDEN_FRAME_COST);beside(g,plot.tx!-1,plot.ty!);
    expect(command(g,'gardenFrame',{eid:plot.id},NOW+21)).toMatchObject({ok:true});
    plot.garden!.water=3;plot.garden!.crop='crop';plot.garden!.growth=.6;plot.hp=34;
    expect(command(g,'reclaim',{eid:plot.id},NOW+22)).toMatchObject({ok:true});
    const saved=reload(g),rebuilt=buildCarriedFromPack(saved,'garden');
    expect(rebuilt.deployed!.uid).toBe(id);expect(rebuilt.hp).toBe(34);
    expect(rebuilt.garden).toEqual({crop:null,growth:0,water:0,coldFrame:true});
    expect(reload(saved).run!.entities[rebuilt.id].garden!.coldFrame).toBe(true);
    beside(saved,rebuilt.tx!-1,rebuilt.ty!);
    expect(command(saved,'gardenFrame',{eid:rebuilt.id,remove:true},NOW+23)).toMatchObject({ok:true});
    expect(command(saved,'reclaim',{eid:rebuilt.id},NOW+24)).toMatchObject({ok:true});
    const again=buildCarriedFromPack(reload(saved),'garden');
    expect(again.deployed!.uid).toBe(id);expect(again.garden!.coldFrame).toBeUndefined();
  });

  it.each([
    ['base_generator',{version:'station-hardware-v1',generatorCapacity:3}],
    ['base_generator',{version:'station-hardware-v1',generatorCapacity:2,energy:999}],
    ['base_generator',{version:'station-hardware-v1',generatorCapacity:2,enabled:true}],
    ['base_generator',{version:'station-hardware-v1',coldFrame:true}],
    ['garden',{version:'station-hardware-v1',generatorCapacity:2}],
    ['garden',{version:'station-hardware-v1',coldFrame:true,water:99}],
    ['garden',{version:'station-hardware-v1',coldFrame:false}],
  ])('refuses malformed %s hardware before moving a pack or accepting a save', (type,bad)=>{
    const g=start(),r=g.run!,e=station(g,type as string);beside(g,e.tx!-1,e.ty!);
    expect(command(g,'reclaim',{eid:e.id},NOW+30)).toMatchObject({ok:true});
    const pack=C(r,'inv').slots.find(s=>s?.uid===e.deployed!.uid)!;
    (pack as any).stationHardware=bad;
    const inv=JSON.stringify(C(r,'inv')),entities=JSON.stringify(r.entities);
    expect(command(g,'build',{struct:type,tx:e.tx,ty:e.ty},NOW+31)).toMatchObject({ok:false});
    expect(JSON.stringify(C(r,'inv'))).toBe(inv);expect(JSON.stringify(r.entities)).toBe(entities);
    expect(validate(structuredClone(g))).toBeNull();
  });
  it('migrates a historical raw-paid reinforced generator once, not on every reload',()=>{
    const g=start(),r=g.run!,e=station(g,'base_generator');
    delete e.deployed;e.basePower!.capacity=2; // historical shape, already purchased hardware
    expect(validate(structuredClone(g))).not.toBeNull();beside(g,e.tx!-1,e.ty!);
    expect(command(g,'reclaim',{eid:e.id},NOW+30)).toMatchObject({ok:true});
    const saved=reload(g),pack=C(saved.run!,'inv').slots.find(s=>s?.key==='deploy_base_generator')!;
    expect(pack.stationHardware).toEqual({version:'station-hardware-v1',generatorCapacity:2});
    const rebuilt=buildCarriedFromPack(saved,'base_generator');
    expect(rebuilt.deployed!.uid).toBe(pack.uid);expect(rebuilt.basePower!.capacity).toBe(2);
    expect(command(saved,'reclaim',{eid:e.id},NOW+31)).toMatchObject({ok:false});
    expect(reload(saved).run!.receipts.filter(x=>x.kind==='pa1.legacy.unpack')).toHaveLength(1);
  });

});
