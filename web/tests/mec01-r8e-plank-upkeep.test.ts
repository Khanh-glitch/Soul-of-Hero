// MEC-01 R8E: K6 upkeep for processed planks. Real engine functions (planTerritory, homeStatus, settle, structureRepairCost).
// FIXTURE: planks/wood/stone/fiber are injected into real containers (no natural harvest/craft in this test).
import {describe,it,expect} from 'vitest';
import {TILE,T,WW,HOUR,BAL} from '../src/game/core';
import {STRUCTS} from '../src/game/catalog';
import {newGame,dispatch,addItem,countItem,markDirty,homeStatus,planTerritory,structureRepairCost} from '../src/game/engine';
import {serializeSnapshot,validate} from '../src/game/persist';
import {getWorld} from '../src/game/world';
import {settle} from '../src/game/sim';

const T0=Date.UTC(2026,0,1);let serial=0;
function setup(){
  const gs=newGame();expect(dispatch(gs,{id:'hs-start'+ ++serial,type:'startRun',character:'female',seed:98},T0).ok).toBe(true);
  const r=gs.run!;r.creatures=[];const w=getWorld();let x=0,y=0;
  for(let yy=5;yy<190&&!x;yy++)for(let xx=5;xx<190;xx++){let ok=true;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const i=(yy+dy)*WW+xx+dx;if(w.economyMap.protected[i]||w.accessCorridors?.mask[i]||((w.packageContract||w.enforceMasks)&&!w.economyMap.buildable[i]))ok=false;}if(ok){x=xx;y=yy;break;}}
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const i=(y+dy)*WW+x+dx;r.terrain[i]={t:T.GRASS};if(w.sourceV3[i])r.sources[i]={stock:0,hp:0};}
  r.player.x=(x-1)*TILE+8;r.player.y=(y+1)*TILE+8;markDirty();
  return {gs,r,x,y};
}
function buildAt(o:ReturnType<typeof setup>,type:string,dx:number,dy:number){
  const px=o.r.player.x,py=o.r.player.y;o.r.player.x=(o.x+dx)*TILE+8;o.r.player.y=(o.y+dy+2)*TILE+8;markDirty();
  try{const res=dispatch(o.gs,{id:'hs'+ ++serial,type:'build',struct:type,tx:o.x+dx,ty:o.y+dy},o.r.clock.lastSimAt);if(!res.ok) throw new Error(`${type}: ${res.reason}`);return Object.values(o.r.entities).find(e=>e.kind==='struct'&&e.type===type&&e.tx===o.x+dx&&e.ty===o.y+dy)!;}
  finally{o.r.player.x=px;o.r.player.y=py;markDirty();}
}
function homeWithCabinet(){
  const o=setup();for(const [k,q] of [['wood',200],['stone',80],['fiber',20]] as const) addItem(o.r,'inv',k,q);
  const floor=buildAt(o,'floor_wood',0,0);const wall=buildAt(o,'wall_wood',1,0);buildAt(o,'floor_wood',3,-2);const cab=buildAt(o,'claim',3,-2);
  return {...o,floor,wall,cab};
}

function homeWithPlankWall(){
  const o=setup();
  for(const [k,q] of [['wood',200],['stone',80],['fiber',20],['plank',3]] as const) addItem(o.r,'inv',k,q);   // FIXTURE: 3 planks for one wall_plank
  buildAt(o,'floor_wood',0,0);const plank=buildAt(o,'wall_plank',1,0);buildAt(o,'floor_wood',3,-2);const cab=buildAt(o,'claim',3,-2);
  return {...o,plank,cab};
}
const cabOf=(o:ReturnType<typeof homeWithPlankWall>)=>o.r.entities[o.cab.id];

describe('MEC-01 R8E K6 upkeep for processed planks', () => {
  it('a wall_plank contributes 0.75 plank per day to its cabinet (3 x 25%), as wood walls contribute their wood', () => {
    const o=homeWithPlankWall();
    const f=planTerritory(o.r).forecast.get(o.cab.id)!;
    expect(f.rates.plank).toBeCloseTo(3*BAL.territory.upkeepFractionPerDay/(24*HOUR),15);   // rates are per millisecond
    expect(f.rates.plank*24*HOUR).toBeCloseTo(0.75,9);
  });

  it('negative: without planks in the cabinet the plank wall makes the cabinet unfunded; with 3 planks it is funded', () => {
    const o=homeWithPlankWall();
    expect(homeStatus(o.r).cabinets.find(c=>c.id===o.cab.id)!.state).toBe('unfunded');   // NEGATIVE: no plank stock
    addItem(o.r,o.cab.c!,'wood',60);addItem(o.r,o.cab.c!,'stone',20);addItem(o.r,o.cab.c!,'fiber',10);
    expect(homeStatus(o.r).cabinets.find(c=>c.id===o.cab.id)!.state).toBe('unfunded');   // still no plank
    addItem(o.r,o.cab.c!,'plank',6);
    const cab=homeStatus(o.r).cabinets.find(c=>c.id===o.cab.id)!;
    expect(['funded','low']).toContain(cab.state);
    expect(cab.stock.plank).toBe(6);
    expect(cab.per24h.plank).toBeCloseTo(0.75,9);
  });

  it('settled upkeep debits real planks, with fractional credit: removed - credit = 0.75 x days, never more', () => {
    const o=homeWithPlankWall();
    for(const [k,q] of [['wood',60],['stone',20],['fiber',10]] as const) addItem(o.r,o.cab.c!,k,q);
    addItem(o.r,o.cab.c!,'plank',6);
    const start=countItem(o.r,o.cab.c!,'plank');
    settle(o.gs,T0+3*24*HOUR,true);
    const now=countItem(o.r,o.cab.c!,'plank');
    const removed=start-now, credit=cabOf(o).cabinet!.credit.plank||0;
    expect(removed-credit).toBeCloseTo(0.75*3,6);
    expect(now).toBeGreaterThanOrEqual(0);
  });

  it('save/reload keeps the same plank forecast and does not re-bill: the validated copy plans identically', () => {
    const o=homeWithPlankWall();addItem(o.r,o.cab.c!,'plank',6);addItem(o.r,o.cab.c!,'wood',60);addItem(o.r,o.cab.c!,'stone',20);addItem(o.r,o.cab.c!,'fiber',10);
    const before=planTerritory(o.r).forecast.get(o.cab.id)!.rates.plank;
    const back=validate(JSON.parse(JSON.stringify(JSON.parse(JSON.parse(serializeSnapshot(o.gs)).payload))));
    expect(back).not.toBeNull();
    const rr=(back as any).run;const cab2=Object.values(rr.entities).find((e:any)=>e.id===o.cab.id) as any;
    expect(cab2).toBeTruthy();
    expect(countItem(rr,cab2.c,'plank')).toBe(6);
    expect(planTerritory(rr).forecast.get(o.cab.id)!.rates.plank).toBeCloseTo(before!,12);
  });

  it('repair of a plank wall takes one plank (ceil(3 x 25%)), and a raw-wood wall keeps its wood repair', () => {
    const o=homeWithPlankWall();
    expect(structureRepairCost(o.plank)).toEqual([['plank',1]]);
    expect(STRUCTS.wall_wood.cost).toEqual([['wood',5]]);
    const wood=buildAt(o,'wall_wood',-1,1);
    expect(structureRepairCost(wood)).toEqual([['wood',2]]);
  });

  it('a raw-wood shelter is unchanged: a wood-only cabinet bills wood and has no plank rate', () => {
    const o=setup();for(const [k,q] of [['wood',200],['stone',80],['fiber',20]] as const) addItem(o.r,'inv',k,q);
    buildAt(o,'floor_wood',0,0);buildAt(o,'wall_wood',1,0);buildAt(o,'floor_wood',3,-2);const cab=buildAt(o,'claim',3,-2);
    const f=planTerritory(o.r).forecast.get(cab.id)!;
    expect(f.rates.plank).toBeUndefined();
    expect(f.rates.wood).toBeGreaterThan(0);
  });
});
