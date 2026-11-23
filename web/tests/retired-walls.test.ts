// Creator ruling 2026-11-23: no Plank Wall, no Iron-braced (brick) Wall. A base is wood, raised at the Territory
// Cabinet (Wood Wall -> Stone Wall). This file replaces mec01-r8e-plank-upkeep, which protected the old rule that a
// saved Plank Wall stayed a Plank Wall and billed planks; under the ruling a saved one loads as the live wall.
// Real engine functions (dispatch, validate, planTerritory, structureRepairCost).
// FIXTURE: wood/stone/fiber are put into the pack; the retired wall is written into a saved copy, as an old build
// would have left it. Not claimed: a save file actually produced by an old build.
import {describe,it,expect} from 'vitest';
import {TILE,T,WW} from '../src/game/core';
import {STRUCTS,PA1_UPGRADE_ONLY_GEOMETRY,STRUCTURE_UPGRADES,RETIRED_STRUCTURES,BUILD_ORDER} from '../src/game/catalog';
import {UNOBTAINABLE_STRUCTURES} from '../src/game/item-ontology';
import {newGame,dispatch,addItem,countItem,markDirty,planTerritory,structureRepairCost,buildReason} from '../src/game/engine';
import {serializeSnapshot,validate} from '../src/game/persist';
import {getWorld} from '../src/game/world';

const T0=Date.UTC(2026,0,1);let serial=0;
function setup(){
  const gs=newGame();expect(dispatch(gs,{id:'rw-start'+ ++serial,type:'startRun',character:'female',seed:98},T0).ok).toBe(true);
  const r=gs.run!;r.creatures=[];const w=getWorld();let x=0,y=0;
  for(let yy=5;yy<190&&!x;yy++)for(let xx=5;xx<190;xx++){let ok=true;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const i=(yy+dy)*WW+xx+dx;if(w.economyMap.protected[i]||w.accessCorridors?.mask[i]||((w.packageContract||w.enforceMasks)&&!w.economyMap.buildable[i]))ok=false;}if(ok){x=xx;y=yy;break;}}
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const i=(y+dy)*WW+x+dx;r.terrain[i]={t:T.GRASS};if(w.sourceV3[i])r.sources[i]={stock:0,hp:0};}
  r.player.x=(x-1)*TILE+8;r.player.y=(y+1)*TILE+8;markDirty();
  return {gs,r,x,y};
}
function buildAt(o:ReturnType<typeof setup>,type:string,dx:number,dy:number){
  const px=o.r.player.x,py=o.r.player.y;o.r.player.x=(o.x+dx)*TILE+8;o.r.player.y=(o.y+dy+2)*TILE+8;markDirty();
  try{if(type==='claim')expect(dispatch(o.gs,{id:'rw-pack'+ ++serial,type:'craft',recipe:'deploy_claim'},o.r.clock.lastSimAt).ok).toBe(true);const res=dispatch(o.gs,{id:'rw'+ ++serial,type:'build',struct:type,tx:o.x+dx,ty:o.y+dy},o.r.clock.lastSimAt);if(!res.ok) throw new Error(`${type}: ${res.reason}`);return Object.values(o.r.entities).find(e=>e.kind==='struct'&&e.type===type&&e.tx===o.x+dx&&e.ty===o.y+dy)!;}
  finally{o.r.player.x=px;o.r.player.y=py;markDirty();}
}
function home(){
  const o=setup();for(const [k,q] of [['wood',200],['stone',80],['fiber',20]] as const) addItem(o.r,'inv',k,q);
  const floor=buildAt(o,'floor_wood',0,0);const wall=buildAt(o,'wall_wood',1,0);buildAt(o,'floor_wood',3,-2);const cab=buildAt(o,'claim',3,-2);
  return {...o,floor,wall,cab};
}
/** The saved state of a paid, placed home whose wall an older build recorded as `type` with `hp`. */
function savedWith(type:string,hp:number,maxHp:number|undefined){
  const o=home(),state=JSON.parse(JSON.parse(serializeSnapshot(o.gs)).payload);
  const e=state.run.entities[o.wall.id];e.type=type;e.hp=hp;if(maxHp===undefined)delete e.maxHp;else e.maxHp=maxHp;
  return {o,state};
}

describe('retired walls: Plank Wall and Iron-braced Wall', () => {
  it('neither wall is in the catalog, the build list, the upgrade map or the upgrade-only list, and nothing is left unobtainable', () => {
    expect(Object.keys(RETIRED_STRUCTURES).sort()).toEqual(['wall_brick','wall_plank']);
    for(const id of Object.keys(RETIRED_STRUCTURES)){
      expect(id in STRUCTS,id).toBe(false);
      expect((BUILD_ORDER as readonly string[]).includes(id),id).toBe(false);
      expect((PA1_UPGRADE_ONLY_GEOMETRY as readonly string[]).includes(id),id).toBe(false);
      expect(Object.keys(STRUCTURE_UPGRADES).includes(id)||Object.values(STRUCTURE_UPGRADES).includes(id),id).toBe(false);
    }
    // Every replacement is a live structure, and no structure costs a material only a retired wall used.
    for(const to of Object.values(RETIRED_STRUCTURES))expect(to in STRUCTS,to).toBe(true);
    expect(Object.entries(STRUCTS).filter(([,s])=>(s.cost as readonly (readonly [string,number])[]).some(([k])=>k==='plank')).map(([k])=>k)).toEqual([]);
    expect(STRUCTURE_UPGRADES.wall_wood).toBe('wall_stone');
    expect([...UNOBTAINABLE_STRUCTURES]).toEqual([]);
  });

  it('asking to build one is refused as an unknown structure and spends nothing', () => {
    const o=home();addItem(o.r,'inv','plank',3);addItem(o.r,'inv','iron_ingot',1);
    const before=JSON.stringify(o.r.custody.inv.slots),count=Object.keys(o.r.entities).length;
    for(const id of Object.keys(RETIRED_STRUCTURES)){
      expect(buildReason(o.gs,id,o.x-1,o.y+1)).toBe('Unknown structure.');
      const res=dispatch(o.gs,{id:'rw-old'+ ++serial,type:'build',struct:id,tx:o.x-1,ty:o.y+1} as any,o.r.clock.lastSimAt);
      expect(res.ok).toBe(false);
    }
    expect(JSON.stringify(o.r.custody.inv.slots)).toBe(before);
    expect(Object.keys(o.r.entities).length).toBe(count);
    expect(countItem(o.r,'inv','plank')).toBe(3);
  });

  it('a save holding a Plank Wall loads; the wall is a Wood Wall at wood health, billed and repaired in wood', () => {
    const {o,state}=savedWith('wall_plank',240,240);
    const gs=validate(state)!;expect(gs,'the save must not be thrown away').toBeTruthy();
    const wall=gs.run!.entities[o.wall.id];
    expect(wall).toMatchObject({type:'wall_wood',hp:STRUCTS.wall_wood.hp,maxHp:STRUCTS.wall_wood.hp,tx:o.wall.tx,ty:o.wall.ty});
    const f=planTerritory(gs.run!).forecast.get(o.cab.id)!;
    expect(f.rates.plank).toBeUndefined();
    expect(f.rates.wood).toBeGreaterThan(0);
    expect(structureRepairCost(wall)).toEqual([['wood',2]]);
    // Everything else in the save is as it was: same entities, same pack.
    expect(Object.keys(gs.run!.entities).sort()).toEqual(Object.keys(o.r.entities).sort());
    expect(JSON.stringify(gs.run!.custody.inv.slots)).toBe(JSON.stringify(o.r.custody.inv.slots));
    // Saving and loading again changes nothing further.
    const again=validate(JSON.parse(JSON.parse(serializeSnapshot(gs)).payload))!;
    expect(again.run!.entities[o.wall.id]).toEqual(JSON.parse(JSON.stringify(wall)));
  });

  it('a save holding an Iron-braced Wall loads it as a Stone Wall; a damaged one keeps its damage', () => {
    const full=savedWith('wall_brick',600,undefined);
    const a=validate(full.state)!;expect(a).toBeTruthy();
    const wa=a.run!.entities[full.o.wall.id];
    expect(wa.type).toBe('wall_stone');expect(wa.hp).toBe(STRUCTS.wall_stone.hp);expect(wa.maxHp).toBeUndefined();
    const hurt=savedWith('wall_brick',100,undefined);
    const b=validate(hurt.state)!;expect(b).toBeTruthy();
    expect(b.run!.entities[hurt.o.wall.id]).toMatchObject({type:'wall_stone',hp:100});
  });

  it('negative: a structure name that was never in the game still makes the save invalid', () => {
    const {state}=savedWith('wall_paper',50,undefined);
    expect(validate(state)).toBeNull();
  });
});
