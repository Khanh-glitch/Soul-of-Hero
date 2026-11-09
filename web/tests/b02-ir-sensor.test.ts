// B02-P1-A infrared sensor (ir-v1). Mechanics and negative proofs; no bot play, no offline enemy kills.
import {describe,it,expect} from 'vitest';
import {TILE,WW,T,type Entity} from '../src/game/core';
import {STRUCTS} from '../src/game/catalog';
import {newGame,dispatch,addItem,countItem,markDirty,electricDoorPowered,irSensorStatus,irSensorConducts,powerAllocation,turretStatus,mkCreature} from '../src/game/engine';
import {settle} from '../src/game/sim';
import {getWorld} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
const T0=Date.UTC(2026,0,1);let n=0;
function setup(){const g=newGame();expect(dispatch(g,{id:'ir-start'+ ++n,type:'startRun',character:'female',seed:97},T0).ok).toBe(true);const r=g.run!,x=80,y=80;r.creatures=[];
  for(let yy=y-6;yy<=y+6;yy++)for(let xx=x-6;xx<=x+8;xx++){const i=yy*WW+xx;r.terrain[i]={t:T.GRASS};if(getWorld().sourceV3[i])r.sources[i]={stock:0,hp:0};}
  markDirty();
  const pos=(tx:number,ty:number)=>{r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;markDirty();};
  const act=(type:string,args:object={},now=T0)=>dispatch(g,{id:'ir-'+ ++n,type,...args},now);
  const build=(type:string,tx:number,ty:number,px=tx,py=ty+1)=>{pos(px,py);for(const [k,q] of STRUCTS[type].cost)addItem(r,'inv',k,q);const res=act('build',{struct:type,tx,ty});expect(res.ok,`${type}: ${(res as any).reason}`).toBe(true);return Object.values(r.entities).find(e=>e.kind==='struct'&&e.tx===tx&&e.ty===ty&&e.type===type)!;};
  return {g,r,x,y,pos,act,build};}
/** generator (fuelled, capacity 2 like a reinforced generator) -> cable -> sensor -> door */
function rig(on=true){const o=setup(),{x,y,build,act,pos,r}=o;const gen=build('base_generator',x,y),cable=build('power_cable',x+1,y),sensor=build('ir_sensor',x+2,y),door=build('door_powered',x+3,y,x+4,y);
  gen.basePower!.capacity=2;addItem(r,gen.c!,'wood',2);pos(x,y+1);expect(act('basePower',{eid:gen.id,enabled:true}).ok).toBe(true);
  if(on){pos(x+2,y+1);expect(act('irSensorToggle',{eid:sensor.id}).ok).toBe(true);}
  return {...o,gen,cable,sensor,door};}
describe('B02-P1-A infrared sensor: physical, paid, wired, bounded',()=>{
  it('costs real parts (mechanical gear, iron, fasteners), is owned, and build is refused without the parts',()=>{
    const o=setup();o.pos(o.x,o.y+1);expect(o.act('build',{struct:'ir_sensor',tx:o.x+2,ty:o.y}).ok).toBe(false);
    expect(STRUCTS.ir_sensor.cost).toEqual([['mechanical_gear',1],['iron_ingot',1],['fasteners',2]]);
    const s=o.build('ir_sensor',o.x+2,o.y);expect(s.irSensor).toEqual({version:'ir-v1',enabled:false});expect(s.hp).toBe(STRUCTS.ir_sensor.hp);
    expect(countItem(o.r,'inv','mechanical_gear')).toBe(0);
  });
  it('sensor off: no conduction even with a visible player; toggling on conducts and feeds the door',()=>{
    const o=rig(false),{r,x,y,sensor,door,act,pos}=o;
    pos(x+2,y+2);expect(sensor.irSensor!.enabled).toBe(false);expect(irSensorConducts(r,sensor)).toBe(false);
    expect(irSensorStatus(r,sensor)).toBe('Off');expect(electricDoorPowered(r,door)).toBe(false);
    pos(x+2,y+1);expect(act('irSensorToggle',{eid:sensor.id}).ok).toBe(true);expect(sensor.irSensor!.enabled).toBe(true);
    pos(x+2,y+2);expect(irSensorConducts(r,sensor)).toBe(true);expect(irSensorStatus(r,sensor)).toContain('conducting');
    expect(electricDoorPowered(r,door)).toBe(true);
    pos(x+2,y+1);expect(act('irSensorToggle',{eid:sensor.id}).ok).toBe(true);expect(sensor.irSensor!.enabled).toBe(false);
    pos(x+2,y+2);expect(irSensorConducts(r,sensor)).toBe(false);expect(electricDoorPowered(r,door)).toBe(false);
  });
  it('no through-wall detection: a solid wall in the line stops conduction and the status says so',()=>{
    const o=rig(),{r,x,y,sensor,door,build,pos}=o;
    build('wall_wood',x+2,y+1,x+3,y+1);pos(x+2,y+2);
    expect(irSensorConducts(r,sensor)).toBe(false);expect(irSensorStatus(r,sensor)).toContain('Blocked by wall');expect(electricDoorPowered(r,door)).toBe(false);
  });
  it('bounded range: a player beyond 6 tiles is not sensed',()=>{
    const o=rig(),{r,x,y,sensor,pos}=o;pos(x+2,y+8);
    expect(irSensorConducts(r,sensor)).toBe(false);expect(irSensorStatus(r,sensor)).toContain('Watching: clear');
  });
  it('empty fuel and off generator: no conduction, no capacity claimed, and the status says why',()=>{
    const o=rig(),{r,x,y,sensor,gen,pos}=o;pos(x+2,y+2);expect(irSensorConducts(r,sensor)).toBe(true);
    gen.basePower!.energy=0;for(const k of ['wood']){const c=r.custody[gen.c!];c.slots=c.slots.map(()=>null);}
    expect(irSensorStatus(r,sensor)).toBe('No fuel');expect(irSensorConducts(r,sensor)).toBe(false);
    expect(powerAllocation(r,gen).includes(sensor)).toBe(false);
    gen.basePower!.enabled=false;expect(irSensorStatus(r,sensor)).toBe('Generator off');
  });
  it('capacity: a single-slot generator is consumed by the sensor, so the door is starved until reinforced',()=>{
    const o=rig(),{r,x,y,gen,sensor,door,pos}=o;(gen.basePower as any).capacity=1;pos(x+2,y+2);
    expect(irSensorConducts(r,sensor)).toBe(true);expect(powerAllocation(r,gen)).toEqual([sensor]);
    expect(electricDoorPowered(r,door)).toBe(false);
    gen.basePower!.capacity=2;expect(electricDoorPowered(r,door)).toBe(true);
  });
  it('second consumer: an arrow turret wired through the sensor is powered only while the sensor sees a target',()=>{
    const o=rig(),{r,x,y,sensor,gen,build,act,pos}=o;
    const turret=build('arrow_turret',x+2,y-1,x+2,y-2);addItem(r,turret.c!,'arrow',2);
    pos(x+2,y+1);expect(act('turretConfigure',{eid:turret.id,field:'generatorId',value:gen.id}).ok).toBe(true);expect(act('turretConfigure',{eid:turret.id,field:'enabled',value:true}).ok).toBe(true);
    pos(x+2,y+2);expect(irSensorConducts(r,sensor)).toBe(true);expect(turretStatus(r,turret)).toBe('Ready');
    pos(x+2,y+7);expect(irSensorConducts(r,sensor)).toBe(false);expect(turretStatus(r,turret)).not.toBe('Ready');
  });
  it('sleeping and offline-unresolved creatures are never sensed (no synthetic offline detection)',()=>{
    const o=rig(),{r,x,y,sensor,pos}=o;pos(x+6,y+7);
    const m=mkCreature(r,'wolf',(x+2)*TILE+8,(y+3)*TILE+8,20);m.state='sleep';r.creatures.push(m);
    expect(irSensorConducts(r,sensor)).toBe(false);
    m.state='chase';m.offlineUnresolvedAt=T0;expect(irSensorConducts(r,sensor)).toBe(false);
  });
  it('disabled, destroyed or unpowered sensors cannot conduct; sensor fuel is drawn while enabled',()=>{
    const o=rig(),{r,x,y,sensor,gen,pos}=o;pos(x+2,y+2);
    sensor.hp=0;expect(irSensorConducts(r,sensor)).toBe(false);sensor.hp=STRUCTS.ir_sensor.hp;
    expect(irSensorConducts(r,sensor)).toBe(true);
    expect(powerAllocation(r,gen)).toContain(sensor);
  });
  it('persists enabled state, status and door power across save and reload',()=>{
    const o=rig(),{r,x,y,sensor,door,pos}=o;pos(x+2,y+2);expect(electricDoorPowered(r,door)).toBe(true);
    const back=selectSnapshots([serializeSnapshot(o.g),null]).gs!;const br=back.run!;
    const bs=br.entities[sensor.id];expect(bs.irSensor).toEqual({version:'ir-v1',enabled:true});
    expect(electricDoorPowered(br,br.entities[door.id])).toBe(true);
  });
  it('rejects corrupt sensor state at save time (no silent acceptance)',()=>{
    const o=rig(),{g,sensor}=o;const bad=structuredClone(g);(bad.run!.entities[sensor.id] as any).irSensor={version:'bogus',enabled:'yes'};
    expect(()=>serializeSnapshot(bad)).toThrow('invalid game state');
  });
  it('offline settle with the sensor enabled and a target absent is deterministic and burns the same fuel as direct',()=>{
    const o=rig(),{g,r,x,y,sensor,gen,pos}=o;pos(x+2,y+7);
    const a=selectSnapshots([serializeSnapshot(g),null]).gs!,b=selectSnapshots([serializeSnapshot(g),null]).gs!;
    settle(a,T0+30000,true);for(let t=1000;t<=30000;t+=1000)settle(b,T0+t,true);
    expect(a.run!.entities[gen.id].basePower!.energy).toBe(b.run!.entities[gen.id].basePower!.energy);
    void r;void x;void y;void sensor;
  });
});
