// W08 absence benchmark. Controlled fixtures: stock is injected into the real
// build/cabinet containers and time is advanced through the real settle() path.
// Writes evidence/sys07-w08/absence-benchmark.json when SOH_WRITE_EVIDENCE=1.
import {describe,it,expect} from 'vitest';
import {TILE,T,WW,HOUR,BAL} from '../src/game/core';
import {newGame,dispatch,addItem,countItem,markDirty,claimAt,territoryForecast} from '../src/game/engine';
import {getWorld} from '../src/game/world';
import {settle} from '../src/game/sim';
import { mkdirSync } from 'node:fs';
import { writeFileSync } from './_evidenceFs';
import {resolve} from 'node:path';

const T0=Date.UTC(2026,0,1);let serial=0;
type Scenario='temporary'|'unfunded'|'compact'|'workshop';
const SCENARIOS:Scenario[]=['temporary','unfunded','compact','workshop'];
const SPANS=[8,24,48,72];

function setup(){
  const gs=newGame();expect(dispatch(gs,{id:'ab-start'+ ++serial,type:'startRun',character:'female',seed:98},T0).ok).toBe(true);
  const r=gs.run!;r.creatures=[];const w=getWorld();let x=0,y=0;
  for(let yy=5;yy<190&&!x;yy++)for(let xx=5;xx<190;xx++){let ok=true;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const i=(yy+dy)*WW+xx+dx;if(w.economyMap.protected[i]||w.accessCorridors?.mask[i]||((w.packageContract||w.enforceMasks)&&!w.economyMap.buildable[i]))ok=false;}if(ok){x=xx;y=yy;break;}}
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const i=(y+dy)*WW+x+dx;r.terrain[i]={t:T.GRASS};if(w.sourceV3[i])r.sources[i]={stock:0,hp:0};}
  r.player.x=(x-1)*TILE+8;r.player.y=(y+1)*TILE+8;markDirty();
  return {gs,r,x,y};
}
function build(o:ReturnType<typeof setup>,type:string,dx:number,dy:number){
  const res=dispatch(o.gs,{id:'ab'+ ++serial,type:'build',struct:type,tx:o.x+dx,ty:o.y+dy},o.r.clock.lastSimAt);
  if(!res.ok) throw new Error(`build ${type} ${dx},${dy}: ${res.reason}`);
  return Object.values(o.r.entities).find(e=>e.kind==='struct'&&e.type===type&&e.tx===o.x+dx&&e.ty===o.y+dy)!;
}
function stockFor(cost:[string,number][]) {return cost;}
/** Place a structure from a tile two steps away (controlled construction stand-point; the player is restored afterward). */
function buildAt(o:ReturnType<typeof setup>,type:string,dx:number,dy:number){
  const px=o.r.player.x,py=o.r.player.y;o.r.player.x=(o.x+dx)*TILE+8;o.r.player.y=(o.y+dy+2)*TILE+8;markDirty();
  try{const res=dispatch(o.gs,{id:'ab'+ ++serial,type:'build',struct:type,tx:o.x+dx,ty:o.y+dy},o.r.clock.lastSimAt);if(!res.ok) throw new Error(`build ${type} ${dx},${dy}: ${res.reason}`);return Object.values(o.r.entities).find(e=>e.kind==='struct'&&e.type===type&&e.tx===o.x+dx&&e.ty===o.y+dy)!;}
  finally{o.r.player.x=px;o.r.player.y=py;markDirty();}
}
/** Build one of the four scenarios. Materials are injected as controlled-fixture inventory. */
function scenario(kind:Scenario){
  const o=setup();
  for(const [k,q] of [['wood',400],['stone',200],['rope',20],['iron_ingot',40],['mechanical_parts',20],['fiber',40],['brick',40],['glass',20],['spares',20],['fasteners',20]] as const) addItem(o.r,'inv',k,q);
  // Enclosed one-tile roofed room: floor, four walls, thatch roof. Player stands inside it when away.
  buildAt(o,'floor_wood',0,0);
  buildAt(o,'roof_thatch',0,0);
  for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]] as const) buildAt(o,'wall_wood',dx,dy);
  if(kind==='workshop'){buildAt(o,'furnace',-3,0);buildAt(o,'workbench',-3,-2);buildAt(o,'floor_wood',-3,2);buildAt(o,'floor_wood',-2,-3);}
  let cabinet=null as any;
  if(kind!=='temporary'){buildAt(o,'floor_wood',3,-2);cabinet=buildAt(o,'claim',3,-2);}
  o.r.player.x=(o.x)*TILE+8;o.r.player.y=(o.y)*TILE+8;markDirty();
  return {o,cabinet};
}
/** Prepaid stock sufficient for the given hours at the current forecast rates (per-scenario funding). */
function fund(o:ReturnType<typeof setup>,c:any,hours:number){
  const f=territoryForecast(o.r,c);for(const [k,rate] of Object.entries(f.rates)) addItem(o.r,c.c!,k,Math.ceil(rate*hours*HOUR)+1);
}
function custodyTotals(r:any){const t:Record<string,number>={};for(const c of Object.values(r.custody) as any[]) for(const sl of c.slots) if(sl) t[sl.key]=(t[sl.key]||0)+(sl.qty||1);return t;}
function snapshot(gs:any,kind:Scenario){
  const r=gs.run!;
  const structs=Object.values(r.entities).filter((e:any)=>e.kind==='struct'&&e.hp!==undefined&&(e.owner===undefined||e.owner==='player')) as any[];
  const cabinets=Object.values(r.entities).filter((e:any)=>e.type==='claim') as any[];
  return {
    structures:structs.map(e=>({type:e.type,hp:+(e.hp).toFixed(2),maxHp:e.maxHp})),
    alive:structs.length,
    cabinets:cabinets.map(c=>({stock:Object.fromEntries(BAL.territory.materials.map((k:string)=>[k,countItem(r,c.c!,k)]).filter(([,q]:any)=>q>0)),prepaid:Object.fromEntries(Object.entries(c.cabinet?.credit||{}).map(([k,q]:any)=>[k,+(q as number).toFixed(3)]))})),
    custody:custodyTotals(r),player:{hp:+r.player.hp.toFixed(1),dead:!!r.player.dead,sheltered:!!r.player.sheltered},bags:Object.values(r.entities).filter((e:any)=>e.kind==='bag').length,
  };
}
function runOnce(kind:Scenario,h:number,fundHours:number){
  const {o,cabinet}=scenario(kind);
  if(cabinet&&fundHours>0) fund(o,cabinet,fundHours);
  const gs=structuredClone(o.gs);
  const before=snapshot(gs,kind);
  settle(gs,T0+h*HOUR,true);
  const after=snapshot(gs,kind);
  return {before,after,report:settle(structuredClone(o.gs),T0+h*HOUR,true)};
}
function withTuning<T>(t:{unprotectedCollapseHours?:number;unfundedCollapseHours?:number;upkeepFractionPerDay?:number}|null,fn:()=>T):T{
  const saved={...BAL.territory};
  if(t) Object.assign(BAL.territory,t);
  try{return fn();}finally{Object.assign(BAL.territory,saved);}
}
function table(tuning:any){
  return withTuning(tuning,()=>{
    const rows:any[]=[];
    for(const kind of SCENARIOS) for(const h of SPANS){
      const {o,cabinet}=scenario(kind);
      const funded=kind==='compact'||kind==='workshop';
      if(cabinet&&funded) fund(o,cabinet,72);
      const gs=structuredClone(o.gs);const start=snapshot(gs,kind);
      settle(gs,T0+h*HOUR,true);const end=snapshot(gs,kind);
      const lost=start.alive-end.alive;
      const spent:Record<string,number>={};
      for(const k of new Set([...Object.keys(start.custody),...Object.keys(end.custody)])){const d=(start.custody[k]||0)-(end.custody[k]||0);if(d!==0)spent[k]=d;}
      const upkeepReceipts=upkeepDebits(gs.run!);
      rows.push({scenario:kind,hours:h,structuresStart:start.alive,structuresEnd:end.alive,lost,
        meanHpEnd:end.structures.length?+(end.structures.reduce((a,b)=>a+b.hp,0)/end.structures.length).toFixed(1):null,
        stockSpent:spent,
        cabinetStockEnd:end.cabinets[0]?.stock||null,
        prepaidEnd:end.cabinets[0]?.prepaid||null,
        claimAlive: end.cabinets.length>0,player:end.player,bags:end.bags,upkeepDebits:upkeepReceipts});
    }
    return rows;
  });
}
/** Sum of physical upkeep debits recorded by the engine for the run (parsed from receipt details). */
function upkeepDebits(r:any){const t:Record<string,number>={};for(const q of r.receipts) if(q.kind==='territory.upkeep'){const m=/x(\d+)$/.exec(q.detail);const key=(q.detail.split(':')[1]||'').replace(/x\d+$/,'');if(m)t[key]=(t[key]||0)+Number(m[1]);}return t;}
describe('W08 absence benchmark (controlled fixtures)',()=>{
  it('current provisional tuning: 8/24/48/72h outcomes are measured and cabinet coverage is real',()=>{
    const o=scenario('compact').o;const cab=Object.values(o.r.entities).find((e:any)=>e.type==='claim')!;
    expect(claimAt(o.r,o.x,o.y)?.id).toBe(cab.id);
    const current=table(null);
    const unfundedRow=current.find(r=>r.scenario==='unfunded'&&r.hours===24)!;
    expect(unfundedRow.structuresEnd).toBe(0);
    const compactRow=current.find(r=>r.scenario==='compact'&&r.hours===72)!;
    expect(compactRow.structuresEnd).toBe(compactRow.structuresStart);
    // 12h provisional window: a full-HP uncovered shelter survives one 8h night, and collapses by 24h.
    const temp=current.find(r=>r.scenario==='temporary'&&r.hours===8)!;
    expect(temp.structuresEnd).toBe(temp.structuresStart);
    expect(current.find(r=>r.scenario==='temporary'&&r.hours===24)!.structuresEnd).toBe(0);
    const unf8=current.find(r=>r.scenario==='unfunded'&&r.hours===8)!;
    expect(unf8.structuresEnd).toBe(unf8.structuresStart);
    if(process.env.SOH_WRITE_EVIDENCE==='1'){
      const sweep=[2,4,8,12].map(h=>({unprotectedCollapseHours:h,unfundedCollapseHours:h}));
      const out={generatedAt:new Date().toISOString(),controlledFixture:true,
        note:'Controlled fixture: stock is injected into real containers and time advances through settle(). Natural acquisition time is NOT measured here. Player survival is reported separately (thirst/hunger are not topped up).',
        baseline:{upkeepFractionPerDay:BAL.territory.upkeepFractionPerDay,unprotectedCollapseHours:BAL.territory.unprotectedCollapseHours,unfundedCollapseHours:BAL.territory.unfundedCollapseHours,status:BAL.territory._status},
        rowsBaseline:current,
        collapseSweep:sweep.map(c=>({candidate:c,rows:table(c)})),
        upkeepSweep:[0.25,0.15,0.10].map(f=>({upkeepFractionPerDay:f,rows:table({upkeepFractionPerDay:f})}))};
      const dir=resolve(process.cwd(),'../evidence/sys07-w08');mkdirSync(dir,{recursive:true});
      writeFileSync(resolve(dir,'absence-benchmark.json'),JSON.stringify(out,null,1));
    }
  },120000);
});
