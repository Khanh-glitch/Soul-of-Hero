import {describe,it,expect} from 'vitest';
import {BAL,TILE,WW,type GameState} from '../src/game/core';
import {getWorld} from '../src/game/world';
import {newGame,dispatch,addItem,removeItem,countItem,C,blockGrid,stepTenders,stepStations,destroyStructure,markDirty,weatherAt,isWet,gardenEnvironment} from '../src/game/engine';
import {settle,syncWorld,tick} from '../src/game/sim';
import {serializeSnapshot,validate} from '../src/game/persist';
const T=Date.UTC(2026,0,1);let seq=0;
const act=(g:GameState,type:string,data:object={},now=T)=>dispatch(g,{id:`farmtest-${++seq}`,type,...data},now);
const copy=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
function setup(seed=313){const g=newGame();expect(act(g,'startRun',{character:'female',region:0,seed}).ok).toBe(true);const r=g.run!;r.creatures=[];const w=getWorld(),grid=blockGrid(r);let x=0,y=0;outer:for(let yy=20;yy<180;yy++)for(let xx=20;xx<180;xx++){const cells=[[-2,-2],[2,0],[0,1],[-1,1],[0,2],[1,1],[0,0],[0,-1]];if(cells.every(([dx,dy])=>{const i=(yy+dy)*WW+xx+dx;return grid[i]===0&&!w.sourceV3[i]&&w.economyMap.buildable[i]&&!w.economyMap.protected[i]&&!w.accessCorridors?.mask[i];})){x=xx;y=yy;break outer;}}expect(x).toBeGreaterThan(0);r.player.x=x*TILE+8;r.player.y=y*TILE+8;for(const [k,n] of [['wood',100],['stone',30],['fiber',20],['rope',3],['iron_ingot',5],['mechanical_parts',6],['fasteners',4],['spares',4]] as const)expect(addItem(r,'inv',k,n)).toBe(0);
 const build=(type:string,dx:number,dy:number)=>{const res=act(g,'build',{struct:type,tx:x+dx,ty:y+dy});expect(res).toMatchObject({ok:true});return Object.values(r.entities).find(e=>e.type===type&&e.tx===x+dx&&e.ty===y+dy)!;};
 build('floor_wood',-2,-2);const cabinet=build('claim',-2,-2);for(const [k,n] of [['wood',60],['stone',60],['fiber',30],['rope',10],['iron_ingot',20],['spares',20],['mechanical_parts',20],['fasteners',20]] as const)addItem(r,cabinet.c!,k,n);const bench=build('workbench',2,0);expect(act(g,'build',{struct:'farm_controller',tx:x,ty:y+1}).ok).toBe(false);expect(act(g,'upgradeStation',{eid:bench.id}).ok).toBe(true);const machine=build('farm_controller',0,1),garden=build('garden',-1,1),barrel=build('barrel',0,2),chest=build('chest_small',1,1);for(const [field,e] of [['gardenId',garden],['barrelId',barrel],['chestId',chest]] as const)expect(act(g,'farmConfigure',{eid:machine.id,field,value:e.id}).ok).toBe(true);return {g,r,machine,garden,barrel,chest};}
function fill(o:ReturnType<typeof setup>,crop:'crop'|'herb'='crop'){const {g,r,machine,chest,barrel}=o;addItem(r,chest.c!,'seed',1);if(crop==='herb')addItem(r,chest.c!,'herb',1);addItem(r,machine.c!,'wood',3);barrel.water=12;expect(act(g,'farmConfigure',{eid:machine.id,field:'crop',value:crop}).ok).toBe(true);expect(act(g,'farmConfigure',{eid:machine.id,field:'enabled',value:true}).ok).toBe(true);}

import {tenderState,tenderStatus,stepTenderStates} from '../src/game/engine';

const receiptsOf=(r:any,kind:string)=>r.receipts.filter((x:any)=>x.kind===kind);

describe('B03-B living production: explicit state, pauses and physical custody', () => {
  it('an unattended ripe plot is never auto-harvested offline or online', () => {
    const o=setup(),{g,r,garden}=o;
    garden.garden!.crop='crop';garden.garden!.growth=1;garden.garden!.water=3;
    settle(g,T+3600000,true);
    expect(garden.garden).toMatchObject({crop:'crop',growth:1});
    expect(countItem(r,'inv','crop')).toBe(0);
    expect(receiptsOf(r,'tender.harvest').length).toBe(0);
  });

  it('a full output chest pauses the ripe crop (no loss, no minting) and resumes once space exists', () => {
    const o=setup(),{g,r,machine,garden,chest}=o;fill(o);stepTenders(g,T);
    garden.garden!.growth=1;
    for(let i=0;i<C(r,chest.c!).slots.length;i++)addItem(r,chest.c!,'cart_kit',1);
    const chestBefore=JSON.stringify(C(r,chest.c!));
    stepTenders(g,T+1);stepTenderStates(r,T+1);
    expect(tenderState(r,machine)).toMatchObject({code:'storage_full',paused:true});
    expect(garden.garden).toMatchObject({crop:'crop',growth:1});
    expect(JSON.stringify(C(r,chest.c!))).toBe(chestBefore);
    const before=receiptsOf(r,'tender.state').length;
    stepTenderStates(r,T+2);stepTenderStates(r,T+3);
    expect(receiptsOf(r,'tender.state').length).toBe(before);
    // Make one physical slot available; the next boundary harvests exactly once.
    removeItem(r,chest.c!,'cart_kit',countItem(r,chest.c!,'cart_kit'));
    stepTenders(g,T+4);stepTenderStates(r,T+4);
    // Harvest and the same-instant replant (paid seed + water) both happen once; the plot is growing again.
    expect(garden.garden!.growth).toBeLessThan(1);expect(garden.garden!.crop).toBe('crop');
    expect(countItem(r,chest.c!,'crop')).toBeGreaterThan(0);
    expect(receiptsOf(r,'tender.harvest').length).toBe(1);
  });

  it('exhausted seeds and a dry barrel pause planting with a distinct reason and no fabricated output', () => {
    const o=setup(),{g,r,machine,garden,barrel,chest}=o;fill(o);
    stepTenderStates(r,T-1); // baseline: the state observed before the change is silent
    removeItem(r,chest.c!,'seed',countItem(r,chest.c!,'seed'));
    stepTenders(g,T);stepTenderStates(r,T);
    expect(tenderState(r,machine).code).toBe('seed_missing');
    expect(garden.garden!.crop).toBeNull();
    expect(countItem(r,chest.c!,'crop')).toBe(0);
    addItem(r,chest.c!,'seed',1);barrel.water=0;garden.garden!.water=0;
    stepTenders(g,T+1);stepTenderStates(r,T+1);
    expect(tenderState(r,machine).code).toBe('barrel_dry');
    expect(tenderStatus(r,machine)).toMatch(/Barrel needs water/);
    expect(receiptsOf(r,'tender.state').some((x:any)=>/>seed_missing:paused$/.test(x.detail))).toBe(true);
    expect(receiptsOf(r,'tender.state').some((x:any)=>/>barrel_dry:paused$/.test(x.detail))).toBe(true);
    expect(barrel.water).toBe(0);
  });

  it('a depleted fuel store pauses planting; no seed or water is spent while paused', () => {
    const o=setup(),{g,r,machine,garden,barrel,chest}=o;fill(o);
    removeItem(r,machine.c!,'wood',countItem(r,machine.c!,'wood'));machine.farm!.energy=0;
    const seeds=countItem(r,chest.c!,'seed'),water=barrel.water;
    stepTenders(g,T);stepTenderStates(r,T);
    expect(tenderState(r,machine).code).toBe('fuel_plant');
    expect(countItem(r,chest.c!,'seed')).toBe(seeds);expect(barrel.water).toBe(water);expect(garden.garden!.crop).toBeNull();
  });

  it('transition receipts are written only on real changes and do not repeat after reload', () => {
    const o=setup(),{g,r,machine,chest}=o;fill(o);
    stepTenderStates(r,T);
    const n=receiptsOf(r,'tender.state').length;
    for(let i=1;i<=5;i++)stepTenderStates(r,T+i);
    expect(receiptsOf(r,'tender.state').length).toBe(n);
    const reloaded=copy(g);
    expect(validate(reloaded)).toBeTruthy();
    stepTenderStates(reloaded.run!,T+10);
    expect(receiptsOf(reloaded.run!,'tender.state').length).toBe(n);
    void machine;void chest;
  });

  it('one 30-minute settle and thirty 1-minute settles produce the same tender state, stock and receipts', () => {
    const o=setup(),{g}=o;fill(o,'herb');
    const a=copy(g),b=copy(g);
    settle(a,T+30*60000,true);
    for(let i=1;i<=30;i++)settle(b,T+i*60000,true);
    const proj=(gs:any)=>{const r=gs.run!;const m=r.entities[o.machine.id],gd=r.entities[o.garden.id],bb=r.entities[o.barrel.id],ch=r.entities[o.chest.id];
      return {garden:gd.garden,barrel:bb.water,chest:C(r,ch.c!).slots.map((s:any)=>s?`${s.key}x${s.qty}`:'-'),machine:C(r,m.c!).slots.map((s:any)=>s?`${s.key}x${s.qty}`:'-'),energy:m.farm!.energy,
        states:r.receipts.filter((x:any)=>x.kind==='tender.state'||x.kind==='tender.harvest'||x.kind==='tender.plant'||x.kind==='tender.water').map((x:any)=>`${x.at}|${x.kind}|${x.detail}`)};};
    const pa=proj(a),pb=proj(b);
    expect(pa.garden!.crop).toBe(pb.garden!.crop);expect(pa.garden!.growth).toBeCloseTo(pb.garden!.growth,9);expect(pa.garden!.water).toBeCloseTo(pb.garden!.water,9);expect(pa.barrel).toBeCloseTo(pb.barrel,6);expect(pa.chest).toEqual(pb.chest);expect(pa.machine).toEqual(pb.machine);
    expect(pa.energy).toBeCloseTo(pb.energy,6);expect(pa.states).toEqual(pb.states);
  });

  it('water is one physical custody: a barrel the player drinks from cannot also irrigate the plot', () => {
    const o=setup(),{g,r,machine,garden,barrel}=o;
    garden.garden!.crop='crop';garden.garden!.growth=0.2;garden.garden!.water=0;barrel.water=1;
    expect(act(g,'farmConfigure',{eid:machine.id,field:'enabled',value:true}).ok).toBe(true);
    addItem(r,machine.c!,'wood',2);
    // The player stands at the barrel and drinks its single unit.
    r.player.x=barrel.x+4;r.player.y=barrel.y;r.player.thirst=10;
    const drink=act(g,'barrel',{eid:barrel.id});
    expect(drink.ok).toBe(true);
    expect(barrel.water).toBe(0);
    stepTenders(g,T+1);
    expect(receiptsOf(r,'tender.water').length).toBe(0);
    expect(garden.garden!.water).toBe(0);
    expect(tenderState(r,machine).code).toBe('dry');
  });
});
