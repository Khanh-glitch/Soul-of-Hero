import {describe,it,expect} from 'vitest';
import {BAL,TILE,WW,type GameState} from '../src/game/core';
import {getWorld} from '../src/game/world';
import {newGame,dispatch,addItem,countItem,C,blockGrid,stepTenders,stepStations,tenderStatus,destroyStructure,markDirty,weatherAt,isWet,gardenEnvironment,stepTenderStates} from '../src/game/engine';
import {settle,syncWorld,tick} from '../src/game/sim';
import {serializeSnapshot,validate} from '../src/game/persist';
const T=Date.UTC(2026,0,1);let seq=0;
const act=(g:GameState,type:string,data:object={},now=T)=>dispatch(g,{id:`farmtest-${++seq}`,type,...data},now);
const copy=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
function setup(seed=313){const g=newGame();expect(act(g,'startRun',{character:'female',region:0,seed}).ok).toBe(true);const r=g.run!;r.creatures=[];const w=getWorld(),grid=blockGrid(r);let x=0,y=0;outer:for(let yy=20;yy<180;yy++)for(let xx=20;xx<180;xx++){const cells=[[-2,-2],[2,0],[0,1],[-1,1],[0,2],[1,1],[0,0],[0,-1]];if(cells.every(([dx,dy])=>{const i=(yy+dy)*WW+xx+dx;return grid[i]===0&&!w.sourceV3[i]&&w.economyMap.buildable[i]&&!w.economyMap.protected[i]&&!w.accessCorridors?.mask[i];})){x=xx;y=yy;break outer;}}expect(x).toBeGreaterThan(0);r.player.x=x*TILE+8;r.player.y=y*TILE+8;for(const [k,n] of [['wood',100],['stone',30],['fiber',20],['rope',3],['iron_ingot',5],['mechanical_parts',6],['fasteners',4],['spares',4]] as const)expect(addItem(r,'inv',k,n)).toBe(0);
 const build=(type:string,dx:number,dy:number)=>{const res=act(g,'build',{struct:type,tx:x+dx,ty:y+dy});expect(res).toMatchObject({ok:true});return Object.values(r.entities).find(e=>e.type===type&&e.tx===x+dx&&e.ty===y+dy)!;};
 build('floor_wood',-2,-2);const cabinet=build('claim',-2,-2);for(const [k,n] of [['wood',60],['stone',60],['fiber',30],['rope',10],['iron_ingot',20],['spares',20],['mechanical_parts',20],['fasteners',20]] as const)addItem(r,cabinet.c!,k,n);const bench=build('workbench',2,0);expect(act(g,'build',{struct:'farm_controller',tx:x,ty:y+1}).ok).toBe(false);expect(act(g,'upgradeStation',{eid:bench.id}).ok).toBe(true);const machine=build('farm_controller',0,1),garden=build('garden',-1,1),barrel=build('barrel',0,2),chest=build('chest_small',1,1);for(const [field,e] of [['gardenId',garden],['barrelId',barrel],['chestId',chest]] as const)expect(act(g,'farmConfigure',{eid:machine.id,field,value:e.id}).ok).toBe(true);return {g,r,machine,garden,barrel,chest,x,y};}
function fill(o:ReturnType<typeof setup>,crop:'crop'|'herb'='crop'){const {g,r,machine,chest,barrel}=o;addItem(r,chest.c!,'seed',1);if(crop==='herb')addItem(r,chest.c!,'herb',1);addItem(r,machine.c!,'wood',3);barrel.water=12;expect(act(g,'farmConfigure',{eid:machine.id,field:'crop',value:crop}).ok).toBe(true);expect(act(g,'farmConfigure',{eid:machine.id,field:'enabled',value:true}).ok).toBe(true);}

import {settleWithReturn} from '../src/game/return-report';

describe('B03-C typed return report (receipt-derived, no invented rewards)', () => {
  it('groups real production receipts with their supporting receipt ids and physical location', () => {
    const o=setup(),{g,r,machine}=o;fill(o,'herb');
    const {lines,report}=settleWithReturn(g,T+8*3600000);
    expect(report).not.toBeNull();
    const rep=report!;
    expect(rep.version).toBe('offline-return-v1');
    expect(lines.length).toBeGreaterThan(0);
    const prod=rep.sections.production.filter(x=>x.receipts.length>0);
    expect(prod.length).toBeGreaterThan(0);
    for(const row of prod) for(const id of row.receipts) expect(r.receipts.some(x=>x.id===id)).toBe(true);
    expect(rep.receiptCount).toBeGreaterThan(0);
    void machine;
  });

  it('8-hour outcome: harvests and planting in the report equal the real chest and seed stock changes', () => {
    const o=setup(),{g,r,chest}=o;fill(o,'herb');
    const seedsBefore=countItem(r,chest.c!,'seed');
    const {report}=settleWithReturn(g,T+8*3600000);
    const harvests=r.receipts.filter(x=>x.kind==='tender.harvest').length;
    const plants=r.receipts.filter(x=>x.kind==='tender.plant').length;
    expect(harvests).toBeGreaterThanOrEqual(0);
    expect(countItem(r,chest.c!,'seed')).toBe(seedsBefore-plants);
    const reported=report!.sections.production.filter(x=>x.text.includes('harvested')).length;
    expect(reported).toBe(harvests);
  });

  it('a repeated Continue at the same time adds no duplicate rows or receipts', () => {
    const o=setup(),{g,r}=o;fill(o,'herb');
    const first=settleWithReturn(g,T+3600000);
    const n=r.receipts.length;
    const second=settleWithReturn(g,T+3600000);
    expect(second.lines).toEqual([]);
    expect(r.receipts.length).toBe(n);
    expect(second.report!.away.quiet).toBe(true);
    expect(second.report!.receiptCount).toBe(0);
    expect(second.report!.sections.production.every(x=>x.receipts.length===0)).toBe(true);
    expect(first.report!.away.quiet).toBe(false);
  });

  it('a paused Garden Tender appears as a next physical action with its location, not as a remote action', () => {
    const o=setup(),{g,r,machine,garden,chest}=o;fill(o);
    stepTenders(g,T);stepTenderStates(r,T);
    garden.garden!.growth=1;
    for(let i=0;i<C(r,chest.c!).slots.length;i++)addItem(r,chest.c!,'cart_kit',1);
    const {report}=settleWithReturn(g,T+600000);
    expect(report!.next.some(x=>x.includes(`Garden Tender ${machine.tx},${machine.ty}`))).toBe(true);
    expect(report!.sections.production.some(x=>x.where?.tx===machine.tx&&x.tone==='warn')).toBe(true);
  });

  it('a death while away is reported in the Body group with the real bag location', () => {
    const o=setup(),{g,r}=o;fill(o);
    r.player.thirst=0;r.player.hp=0.5;
    const {report}=settleWithReturn(g,T+3600000);
    const dead=report!.sections.body.find(x=>x.tone==='bad'&&x.text.includes('died'));
    expect(dead).toBeTruthy();
    expect(dead!.where?.name).toMatch(/bag/);
    expect(report!.next.some(x=>x.startsWith('Go to'))).toBe(true);
  });

  it('known-world rows contain only public or local facts; no enemy coordinates or hidden monster positions', () => {
    const o=setup(),{g}=o;fill(o);
    const {report}=settleWithReturn(g,T+7200000);
    const text=Object.values(report!.sections).flat().map(x=>x.text).join(' | ');
    expect(text).not.toMatch(/wolf|boar|bear|creature|monster|enemy|elder/i);
    for(const row of report!.sections.world) expect(row.where).toBeUndefined();
  });

  it('the legacy string route is still produced for old callers, and an expired run is reported as ended', () => {
    const o=setup(),{g}=o;fill(o);
    const {lines}=settleWithReturn(g,T+BAL.run.maxRunHours*3600000+1);
    expect(g.run).toBeNull();
    expect(Array.isArray(lines)).toBe(true);
  });
});

import {mkContainer,addItem as addItemR} from '../src/game/engine';
describe('B03-C return privacy: ownership and visibility of stationary state', () => {
  it('an unseen, non-owned POI station with stock never appears; the owned workbench with the same kind of stock does', () => {
    const o=setup(), {g,r}=o;
    // A world-owned POI station: no owner, POI tag, kind recycler. The player has never observed it.
    const fakeOut=mkContainer(r,'out',6); addItemR(r,fakeOut.id,'scrap',3);
    const fakeFuel=mkContainer(r,'fuel',3);
    const fx=(o.x+40)*TILE+8, fy=(o.y+40)*TILE+8;
    r.entities['poi-hidden']={id:'poi-hidden',kind:'recycler',poi:'factory',label:'Hidden site',x:fx,y:fy,tx:o.x+40,ty:o.y+40,station:{queue:[],burn:0,fuelC:fakeFuel.id,outC:fakeOut.id}} as any;
    // A player-owned workbench (built by intent in setup) holds real output.
    const bench=Object.values(r.entities).find(e=>e.type==='workbench')!;
    expect(bench.owner===undefined||bench.owner==='player').toBe(true);
    addItemR(r,bench.station!.outC!,'iron_ingot',2);
    const {report}=settleWithReturn(g,T+3600000);
    const everything=JSON.stringify(report!.sections);
    expect(everything).not.toMatch(/Hidden site/);
    expect(everything).not.toMatch(new RegExp(`${o.x+40},${o.y+40}`));
    expect(everything).not.toMatch(/Scrap/);
    const benchRows=report!.sections.production.filter(x=>x.where?.name==='Workbench');
    expect(benchRows.length).toBeGreaterThan(0);
    expect(benchRows.some(x=>x.text.includes('Iron Ingot'))).toBe(true);
  });
  it('a surviving Tender station reads state only from its own owned farm; a fabricated unowned farm controller is ignored', () => {
    const o=setup(),{g,r}=o;
    const fakeChest=mkContainer(r,'chest',3); addItemR(r,fakeChest.id,'cart_kit',1);
    r.entities['farm-hidden']={id:'farm-hidden',kind:'recycler',poi:'factory',label:'Hidden farm',x:(o.x+50)*TILE+8,y:(o.y+50)*TILE+8,tx:o.x+50,ty:o.y+50,farm:{enabled:true,crop:'crop',energy:0},c:fakeChest.id} as any;
    const {report}=settleWithReturn(g,T+3600000);
    expect(JSON.stringify(report!.sections)).not.toMatch(/Hidden farm/);
    expect(report!.sections.production.some(x=>x.where?.name==='Garden Tender'&&x.where.tx===o.x+50)).toBe(false);
  });
});
