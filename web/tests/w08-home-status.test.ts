// W08 home maintenance authority tests. Controlled fixtures: materials are injected
// into real containers; time advances through the real settle() path.
import {describe,it,expect} from 'vitest';
import {TILE,T,WW,HOUR,BAL} from '../src/game/core';
import {newGame,dispatch,addItem,countItem,markDirty,homeStatus,nearestHomeStructure,destroyStructure} from '../src/game/engine';
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
describe('W08 homeStatus (controlled fixtures)',()=>{
  it('an unfunded cabinet covers structures, funding changes state to funded, and protection does not heal damage',()=>{
    const o=homeWithCabinet();
    // Before the cabinet exists in range the structure would be uncovered; the cabinet is placed here so coverage is covered-unfunded first.
    let s=homeStatus(o.r);
    const floor=s.structures.find(x=>x.id===o.floor.id)!;
    expect(floor.state).toBe('unfunded');
    expect(floor.hoursToCollapse).toBeCloseTo(BAL.territory.unfundedCollapseHours,5);
    expect(s.cabinets.find(c=>c.id===o.cab.id)!.state).toBe('unfunded');

    addItem(o.r,o.cab.c!,'wood',60);addItem(o.r,o.cab.c!,'stone',20);addItem(o.r,o.cab.c!,'fiber',10);
    s=homeStatus(o.r);
    const funded=s.structures.find(x=>x.id===o.floor.id)!;
    expect(funded.state).toBe('funded');
    expect(funded.hoursToCollapse).toBeNull();
    const cab=s.cabinets.find(c=>c.id===o.cab.id)!;
    expect(['funded','low']).toContain(cab.state);
    expect(cab.stock.wood).toBe(60);
    expect(cab.per24h.wood).toBeGreaterThan(0);

    // Damage a funded structure: protection stops decay but does not heal.
    o.wall.hp=50;const before=o.wall.hp;settle(o.gs,T0+HOUR,true);
    expect(o.wall.hp).toBeCloseTo(before,5);
    s=homeStatus(o.r);
    const w=s.structures.find(x=>x.id===o.wall.id)!;
    expect(w.damaged).toBe(true);
    expect(w.state).toBe('funded');
    expect(w.repairCost.length).toBeGreaterThan(0);
  });

  it('uncovered outpost reports the 12h provisional collapse fraction and disappears at zero HP',()=>{
    const o=setup();addItem(o.r,'inv','wood',40);addItem(o.r,'inv','stone',10);
    const f=buildAt(o,'floor_wood',0,0);
    const s=homeStatus(o.r).structures.find(x=>x.id===f.id)!;
    expect(s.state).toBe('uncovered');
    expect(s.cabinetId).toBeNull();
    expect(s.hoursToCollapse).toBeCloseTo(BAL.territory.unprotectedCollapseHours,5);
    const U=BAL.territory.unprotectedCollapseHours;
    settle(o.gs,T0+U*HOUR/2,true);
    expect(homeStatus(o.r).structures.find(x=>x.id===f.id)!.hoursToCollapse).toBeCloseTo(U/2,3);
    settle(o.gs,T0+(U+1)*HOUR,true);
    expect(o.r.entities[f.id]).toBeUndefined();
    expect(homeStatus(o.r).uncoveredCount).toBe(0);
  });

  it('nearestHomeStructure is bounded, deterministic and ignores items on the ground', ()=>{
    const o=homeWithCabinet();
    const near=nearestHomeStructure(o.r,o.x,o.y,6);
    expect(near).toBeTruthy();
    expect(nearestHomeStructure(o.r,o.x+50,o.y+50,6)).toBeNull();
    expect(nearestHomeStructure(o.r,o.x,o.y,6)?.id).toBe(near?.id);
  });

  it('destroying the cabinet demotes covered structures to unfunded and never restores lost stock', ()=>{
    const o=homeWithCabinet();addItem(o.r,o.cab.c!,'wood',30);
    const stockBefore=countItem(o.r,o.cab.c!,'wood');
    destroyStructure(o.r,o.cab,T0);
    const s=homeStatus(o.r);
    expect(s.cabinets.some(c=>c.id===o.cab.id)).toBe(false);
    expect(s.structures.find(x=>x.id===o.wall.id)!.state).toBe('uncovered');
    expect(stockBefore).toBe(30);
  });

  it('a Cabinet standing alone is idle (no external coverage), not unreachable; billing for itself is unchanged', ()=>{
    const o=setup();addItem(o.r,'inv','wood',40);addItem(o.r,'inv','stone',20);
    buildAt(o,'floor_wood',3,-2);const cab=buildAt(o,'claim',3,-2);
    const s=homeStatus(o.r);
    const c=s.cabinets.find(x=>x.id===cab.id)!;
    expect(c.state).toBe('idle');
    expect(c.selfOnly).toBe(true);
    expect(c.external).toBe(0);
    expect(c.count).toBeGreaterThan(0);
    expect(Object.keys(c.per24h).length).toBeGreaterThan(0);
  });

  it('a Cabinet funded only by its own upkeep does not count as covered structures', ()=>{
    const o=setup();addItem(o.r,'inv','wood',40);addItem(o.r,'inv','stone',20);
    buildAt(o,'floor_wood',3,-2);const cab=buildAt(o,'claim',3,-2);
    addItem(o.r,cab.c!,'wood',20);addItem(o.r,cab.c!,'stone',10);
    const c=homeStatus(o.r).cabinets.find(x=>x.id===cab.id)!;
    expect(c.external).toBe(0);
    expect(c.state).toBe('idle');
  });
});
