import { describe, expect, it } from 'vitest';
import { ARCANA_CORES, planArcana } from '../src/game/arcana20';
import { ITEMS } from '../src/game/catalog';
import { newGame, dispatch, C, addItem, mkCreature, markDirty } from '../src/game/engine';
import { tick, HAZ, PROJ, FX, type Input } from '../src/game/sim';

const T0=Date.UTC(2026,10,1,12);
const input=(x:number,y:number,attackPressed=false,cancel=false):Input=>({up:false,down:false,left:false,right:false,mx:x,my:y,attack:false,attackPressed,roll:false,cancel});
function fresh(){ const gs=newGame(); expect(dispatch(gs,{id:'start',type:'startRun',character:'female',region:0,seed:1234},T0).ok).toBe(true); HAZ.length=0; PROJ.length=0; FX.length=0; gs.run!.creatures=[];markDirty(); return gs; }
function equip(gs:ReturnType<typeof fresh>,id:number) {const r=gs.run!, key=ARCANA_CORES[id-1].itemKey;expect(addItem(r,'inv',key,1)).toBe(0); const idx=C(r,'inv').slots.findIndex(s=>s?.key===key);r.player.active=idx;return C(r,'inv').slots[idx]!;}
function cast(gs:ReturnType<typeof fresh>,t:number){const p=gs.run!.player; const x=p.x+100,y=p.y;tick(gs,input(x,y,true),50,t);for(let i=1;i<11;i++)tick(gs,input(x,y),50,t+i*50);}

describe('isolated ARCANA20 combat prototypes (not P0 visual validation)',()=>{
 it('registers twenty physical nonstackable finite-charge items with valid bounded plans',()=>{
  expect(ARCANA_CORES).toHaveLength(20);expect(new Set(ARCANA_CORES.map(c=>c.itemKey)).size).toBe(20);
  for(const c of ARCANA_CORES){const item=ITEMS[c.itemKey];expect(item.arcanaId).toBe(c.id);expect(item.charge).toBe(3);expect(item.max).toBe(1);expect(item.cat).toBe('core');
   for(const [x,y,aimX,aimY] of [[300,300,400,300],[200,200,200,200],[200,200,99999,99999]]){
    const plan=planArcana(c.id,x,y,Math.atan2(aimY-y,aimX-x),aimX,aimY);expect(plan.length).toBeGreaterThan(0);expect(plan.length).toBeLessThanOrEqual(8);
    for(const e of plan){for(const v of [e.x,e.y,e.delayMs,e.durationMs,e.damage])expect(Number.isFinite(v)).toBe(true);expect(e.delayMs).toBeGreaterThanOrEqual(0);expect(e.damage).toBeGreaterThan(0);// The #06 authored traveling wave extends beyond the aimed target.
     expect(Math.hypot(e.x-x,e.y-y)).toBeLessThan(c.id===6?350:250);}
   }
  }
  expect(planArcana(99,1,1,0,2,2)).toEqual([]);
 });
 it.each(ARCANA_CORES.map(c=>[c.id,c.name] as const))('Core %i (%s) casts through input, commits a charge and damages a real creature',id=>{
  const gs=fresh(),r=gs.run!,stack=equip(gs,id);cast(gs,T0+1);expect(stack.charge).toBe(2);
  const chosen=HAZ.find(h=>h.arcanaId===id)!;expect(chosen).toBeDefined();expect(chosen.owner).toBe('player');expect(chosen.runId).toBe(r.id);
  // A stationary real creature is positioned in the first impact's path. Let
  // the normal game clock advance naturally; neither HP nor hazard time is set.
  const mx=chosen.kind==='line'?chosen.x+Math.cos(chosen.angle!)*chosen.len!/2:chosen.x+(chosen.kind==='ring'?8:0);
  const my=chosen.kind==='line'?chosen.y+Math.sin(chosen.angle!)*chosen.len!/2:chosen.y;
  const m=mkCreature(r,'boar',mx,my,500);m.state='sleep';r.creatures=[m];
  const steps=Math.ceil((chosen.tell-chosen.t)/50)+1;
  for(let k=0;k<steps;k++) tick(gs,input(r.player.x+100,r.player.y),50,T0+600+k*50);
  expect(m.hp).toBeLessThan(500);
 });
 it('cancellation spends no charge; spent items cannot cast; hazards expire',()=>{
  const gs=fresh(),r=gs.run!,p=r.player,s=equip(gs,1); const i=input(p.x+100,p.y,true);
  tick(gs,i,50,T0+1);tick(gs,input(p.x+100,p.y,false,true),50,T0+51);expect(s.charge).toBe(3);expect(HAZ).toHaveLength(0);
  for(let n=0;n<3;n++){cast(gs,T0+1000+n*1000);expect(s.charge).toBe(2-n);}
  const n=HAZ.length;cast(gs,T0+5000);expect(s.charge).toBe(0);expect(HAZ.length).toBe(n);
  for(let k=0;k<160;k++)tick(gs,input(p.x+100,p.y),50,T0+6000+k*50);
  expect(HAZ.filter(h=>h.arcanaId!==undefined)).toHaveLength(0);
 });
 it('pending arcana hazards cannot leak into a different run',()=>{
  const gs=fresh();equip(gs,1);cast(gs,T0+1);expect(HAZ.length).toBeGreaterThan(0);
  const other=newGame();expect(dispatch(other,{id:'other',type:'startRun',character:'female',region:1,seed:77},T0).ok).toBe(true);
  other.run!.creatures=[];tick(other,input(other.run!.player.x+100,other.run!.player.y),50,T0+1000);
  expect(HAZ.filter(h=>h.arcanaId!==undefined)).toHaveLength(0);
 });
});

describe('isolated Core fixture grants',()=>{
 it('uses normal custody, marks the run QA and does not replace full inventory',async()=>{
  const {grantReviewCore}=await import('../src/game/arcanaLab');const gs=fresh(),r=gs.run!;
  expect(grantReviewCore(gs,3).ok).toBe(true);expect(r.qaUsed).toBe(true);
  const item=C(r,'inv').slots.find(s=>s?.key==='core_arcana_03');expect(item?.charge).toBe(3);
  while(C(r,'inv').slots.includes(null))expect(addItem(r,'inv','core_fire',1)).toBe(0);
  const snapshot=JSON.stringify(C(r,'inv').slots);expect(grantReviewCore(gs,7).ok).toBe(false);expect(JSON.stringify(C(r,'inv').slots)).toBe(snapshot);
  expect(grantReviewCore(gs,0).ok).toBe(false);
 });
});

describe('new-run QA starter inventory',()=>{
 it('places all 20 real Cores after the original starting items, with 17–20 first, and is idempotent',async()=>{
  const {seedReviewInventory}=await import('../src/game/arcanaLab');const gs=fresh(),r=gs.run!;
  const original=C(r,'inv').slots.slice(0,3).map(s=>s?.key);const got=seedReviewInventory(gs);expect(got.missing).toEqual([]);expect(got.added).toHaveLength(20);
  expect(C(r,'inv').slots.slice(0,3).map(s=>s?.key)).toEqual(original);
  expect(C(r,'inv').slots.slice(3,7).map(s=>s?.key)).toEqual(['core_arcana_17','core_arcana_18','core_arcana_19','core_arcana_20']);
  for(const c of ARCANA_CORES){const stacks=C(r,'inv').slots.filter(s=>s?.key===c.itemKey);expect(stacks).toHaveLength(1);expect(stacks[0]?.charge).toBe(3);}
  expect(seedReviewInventory(gs)).toEqual({added:[],missing:[]});
 });
 it('never destroys existing inventory when the starter kit cannot fit',async()=>{
  const {seedReviewInventory}=await import('../src/game/arcanaLab');const gs=fresh(),r=gs.run!;
  while(C(r,'inv').slots.includes(null))addItem(r,'inv','core_fire',1);const before=JSON.stringify(C(r,'inv').slots);
  expect(seedReviewInventory(gs).missing).toHaveLength(20);expect(JSON.stringify(C(r,'inv').slots)).toBe(before);
 });
});

it('aligns proposed #19 and #20 damage to the source finale beats rather than catalog peaks',()=>{
 const star=planArcana(19,300,300,0,400,300);expect(star).toHaveLength(1);expect(star[0].delayMs).toBe(8150);expect(star[0].x).toBeCloseTo(400);expect(star[0].y).toBeCloseTo(300);
 const rift=planArcana(20,300,300,0,400,300);expect(rift).toHaveLength(8);expect(rift.every(h=>h.kind==='line'&&h.delayMs===6600)).toBe(true);expect(rift.reduce((s,h)=>s+h.len!,0)).toBeGreaterThan(200);
});

it('the segmented #20 collision damages an actual creature only once at a joint',()=>{const gs=fresh(),r=gs.run!,p=r.player;equip(gs,20);cast(gs,T0+1);const hs=HAZ.filter(h=>h.arcanaId===20);expect(hs).toHaveLength(8);expect(hs[0].hitGroup).toBe(hs[1].hitGroup);const first=hs[0],second=hs[1],x=second.x+Math.cos(second.angle!)*second.w!/2,y=second.y+Math.sin(second.angle!)*second.w!/2;const m=mkCreature(r,'boar',x,y,500);m.state='sleep';r.creatures=[m];const steps=Math.ceil((first.tell-first.t)/50)+1;for(let k=0;k<steps;k++)tick(gs,input(p.x+100,p.y),50,T0+600+k*50);expect(m.hp).toBe(464);});

import {setVisualQuality,type VisualQuality} from '../src/game/visualQuality';
it('visual cadence selection does not alter actual #20 charge or combat',()=>{const results=[];for(const q of ['high','balance','performance'] as VisualQuality[]){setVisualQuality(q);const gs=fresh(),r=gs.run!,p=r.player;const stack=equip(gs,20);cast(gs,T0+1);const h=HAZ.find(h=>h.arcanaId===20)!;const m=mkCreature(r,'boar',h.x+Math.cos(h.angle!)*h.len!/2,h.y+Math.sin(h.angle!)*h.len!/2,500);m.state='sleep';r.creatures=[m];const steps=Math.ceil((h.tell-h.t)/50)+1;for(let k=0;k<steps;k++)tick(gs,input(p.x+100,p.y),50,T0+600+k*50);results.push({charge:stack.charge,hp:m.hp});}setVisualQuality('high');expect(results).toEqual([{charge:2,hp:464},{charge:2,hp:464},{charge:2,hp:464}]);});
