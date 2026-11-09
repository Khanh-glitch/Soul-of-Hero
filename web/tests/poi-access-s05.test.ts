import {afterEach,describe,expect,it} from 'vitest';
import {BAL,TILE,WW,type GameState} from '../src/game/core';
import {addItem,blockGrid,C,countItem,dispatch,markDirty,newGame,spawnDrop} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {poiDoorContract,poiPowered} from '../src/game/poi-access';
import {settle,syncWorld,tick,type Input} from '../src/game/sim';
import {serializeSnapshot,validate} from '../src/game/persist';
import legacy from './fixtures/7b9805b2-shipping-v3.json';

const T=Date.UTC(2026,10,5);let n=0;
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'start',type:'startRun',character:'female',seed:99},T).ok).toBe(true);g.run!.creatures=[];return g;}
function act(g:GameState,type:string,p:object={},at=T+1,id=`s05-${++n}`){return dispatch(g,{id,type,...p},at);}
function snap(g:GameState){return JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;}
function site(g:GameState,kind:'door'|'gen',poi:string){return Object.values(g.run!.entities).find(e=>e.kind===kind&&e.poi===poi)!;}
// WEC-01 P0-2: the first legal scan of the Foundry door draws the Vault's one-time B05 stock (2 refined ingots + 1 medkit) exactly once.
// Every authored stack keeps its physical UID; nothing else is added.
const vaultOneTime=(r:any,v:any,before:any[])=>{const now=C(r,v.c!).slots.filter(Boolean) as any[];return before.filter(Boolean).every((b:any)=>now.some(a=>a.uid===b.uid))&&now.filter(a=>a.key==='refined_iron_ingot').reduce((k,a)=>k+a.qty,0)===2&&now.filter(a=>a.key==='medkit').length===1;};
const move=(g:GameState,x:number,y:number)=>{g.run!.player.x=x;g.run!.player.y=y;}; // explicit proximity fixture
const input:Input={up:true,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};
afterEach(()=>setActiveLayout('shipping'));
describe('S05 local physical POI access',()=>{
 it('takes the real Watchtower card, spends exactly one charge and crosses the Foundry doorway, then uses the interior exit',()=>{
  const g=start(),r=g.run!,watch=Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='watch'&&C(r,e.c!).slots.some(s=>s?.key==='keycard'))!,loot=C(r,watch.c!);move(g,watch.x,watch.y+16);const slot=loot.slots.findIndex(s=>s?.key==='keycard'),uid=loot.slots[slot]!.uid;expect(act(g,'move',{from:loot.id,fs:slot,to:'inv'}).ok).toBe(true);
  const door=site(g,'door','factory'),vault=Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='factory_vault')!,before=structuredClone(C(r,vault.c!).slots);move(g,door.x,door.y+16);expect(blockGrid(r)[door.ty!*WW+door.tx!]).toBe(3);
  const id='card-scan';expect(act(g,'door',{eid:door.id},T+2,id).ok).toBe(true);expect(door.locked).toBe('keycard');expect(C(r,'inv').slots.find(s=>s?.uid===uid)?.charge).toBe(2);expect(act(g,'door',{eid:door.id},T+2,id)).toMatchObject({ok:false,dup:true});expect(blockGrid(r)[door.ty!*WW+door.tx!]).toBe(0);
  for(let i=1;i<=12;i++)tick(g,input,40,T+2+i*40);expect(r.player.y).toBeLessThan(door.y);expect(vaultOneTime(r,vault,before)).toBe(true);
  move(g,door.x,door.y-20);settle(g,T+16003,true);expect(door.open).toBe(false);expect(act(g,'door',{eid:door.id},T+16004).ok).toBe(true);expect(C(r,'inv').slots.find(s=>s?.uid===uid)?.charge).toBe(2);expect(door.poiDoor?.scans).toBe(1);expect(vaultOneTime(r,vault,before)).toBe(true);expect(validate(snap(g))).toBeTruthy();
 });
 it('keeps each newly spawned card in an independent physical UID with bounded charges',()=>{
  const g=start(),r=g.run!;spawnDrop(r,'keycard',2,r.player.x,r.player.y,T+1,undefined,false);const cards=Object.values(r.entities).filter(e=>e.kind==='drop').flatMap(e=>C(r,e.c!).slots).filter(s=>s?.key==='keycard');expect(cards).toHaveLength(2);expect(new Set(cards.map(s=>s!.uid)).size).toBe(2);expect(cards.every(s=>s!.qty===1&&s!.charge===3)).toBe(true);expect(validate(snap(g))).toBeTruthy();
 });
 it('denies absent, incompatible and exhausted cards; consumes only successful scans',()=>{
  const g=start(),r=g.run!,door=site(g,'door','factory');move(g,door.x,door.y+16);expect(act(g,'door',{eid:door.id}).ok).toBe(false);addItem(r,'inv','keycard',1);const card=C(r,'inv').slots.find(s=>s?.key==='keycard')!;card.meta='other';expect(act(g,'door',{eid:door.id}).ok).toBe(false);expect(card.charge).toBe(3);delete card.meta;
  for(let i=0;i<3;i++){move(g,door.x,door.y+16);expect(act(g,'door',{eid:door.id},T+10+i*2).ok).toBe(true);expect(door.open).toBe(true);move(g,door.x,door.y+20);expect(act(g,'door',{eid:door.id},T+11+i*2).ok).toBe(true);}
  expect(countItem(r,'inv','keycard')).toBe(0);expect(door.poiDoor?.scans).toBe(3);expect(act(g,'door',{eid:door.id},T+20).ok).toBe(false);expect(validate(snap(g))).toBeTruthy();
 });
 it('uses a bounded shared canister, pauses/resumes without extra fuel, and expires identically online and offline',()=>{
  const g=start(),r=g.run!,door=site(g,'door','light'),gen=site(g,'gen','light'),spec=poiDoorContract(r,door)!;move(g,door.x,door.y+16);expect(act(g,'door',{eid:door.id}).ok).toBe(false);move(g,gen.x,gen.y+16);expect(act(g,'generator',{eid:gen.id}).ok).toBe(false);addItem(r,'inv','fuel_can',1);const fuelId=C(r,'inv').slots.find(s=>s?.key==='fuel_can')!.uid;expect(act(g,'generator',{eid:gen.id},T+10,'fuel').ok).toBe(true);expect(r.receipts.at(-1)?.detail).toContain(fuelId);expect(countItem(r,'inv','fuel_can')).toBe(0);expect(act(g,'generator',{eid:gen.id},T+10,'fuel')).toMatchObject({ok:false,dup:true});expect(poiPowered(r,spec,T+11)).toBe(true);
  expect(act(g,'generator',{eid:gen.id},T+1010).ok).toBe(true);expect(gen.power).toBe(0);const left=gen.poiPower!.pausedMs!;expect(left).toBe(BAL.poiAccess.fuelRuntimeMs-1000);settle(g,T+5009,true);expect(gen.poiPower!.pausedMs).toBe(left);expect(validate(snap(g))).toBeTruthy();expect(act(g,'generator',{eid:gen.id},T+5010).ok).toBe(true);expect(gen.power).toBe(1);expect(countItem(r,'inv','fuel_can')).toBe(0);const until=gen.poiPower!.expiresAt;
  move(g,door.x,door.y+16);expect(act(g,'door',{eid:door.id},T+5011).ok).toBe(true);move(g,door.x,door.y-20);const online=snap(g),offline=snap(g);expect(validate(online)).toBeTruthy();const forged=snap(g);forged.run!.entities[gen.id].poiPower!.expiresAt+=1000;expect(validate(forged)).toBeNull();const unlocked=snap(g);delete unlocked.run!.entities[door.id].locked;expect(validate(unlocked)).toBeNull();const changed=snap(g);changed.run!.poiAccessDigest='00000000';expect(validate(changed)).toBeNull();const displaced=snap(g);displaced.run!.entities[gen.id].x+=TILE;expect(validate(displaced)).toBeNull();expect(syncWorld(online,until)).toBe(true);settle(offline,until,true);for(const copy of [online,offline]){const rr=copy.run!,dd=rr.entities[door.id],gg=rr.entities[gen.id];expect(gg.power).toBe(0);expect(dd.open).toBe(false);expect(dd.locked).toBe('power');expect(poiPowered(rr,spec,until)).toBe(false);expect(act(copy,'door',{eid:door.id},until+1).ok).toBe(true);expect(dd.open).toBe(true);expect(validate(snap(copy))).toBeTruthy();}
 });
 it('defers closing an occupied aperture and rejects outside reopening after power loss',()=>{
  const g=start(),r=g.run!,door=site(g,'door','light'),gen=site(g,'gen','light');move(g,gen.x,gen.y+16);addItem(r,'inv','fuel_can',1);expect(act(g,'generator',{eid:gen.id},T+1).ok).toBe(true);move(g,door.x,door.y+16);expect(act(g,'door',{eid:door.id},T+2).ok).toBe(true);move(g,door.x,door.y);settle(g,T+BAL.poiAccess.fuelRuntimeMs+2,true);expect(door.open).toBe(true);expect(gen.power).toBe(0);move(g,door.x,door.y+20);settle(g,T+BAL.poiAccess.fuelRuntimeMs+3,true);expect(door.open).toBe(false);expect(act(g,'door',{eid:door.id},T+BAL.poiAccess.fuelRuntimeMs+4).ok).toBe(false);
 });
 it('grandfathers a real old save and does not upgrade uncharged legacy cards',()=>{
  const g=structuredClone(legacy.save) as GameState;expect(validate(g)).toBeTruthy();setActiveLayout(g.run!.layoutId!);const r=g.run!,watch=Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='watch'&&C(r,e.c!).slots.some(s=>s?.key==='keycard'))!,c=C(r,watch.c!),slot=c.slots.findIndex(s=>s?.key==='keycard'),card=c.slots[slot]!;expect(card.charge).toBeUndefined();move(g,watch.x,watch.y+16);expect(act(g,'move',{from:c.id,fs:slot,to:'inv'},r.clock.lastSimAt+1).ok).toBe(true);const door=site(g,'door','factory');move(g,door.x,door.y+16);expect(act(g,'door',{eid:door.id},r.clock.lastSimAt+2).ok).toBe(true);expect(countItem(r,'inv','keycard')).toBe(0);expect(door.locked).toBe('keycard');expect(validate(snap(g))).toBeTruthy();
  const unlocked=structuredClone(legacy.save) as GameState,oldDoor=site(unlocked,'door','factory');delete oldDoor.locked;oldDoor.open=false;move(unlocked,oldDoor.x,oldDoor.y+16);expect(act(unlocked,'door',{eid:oldDoor.id},unlocked.run!.clock.lastSimAt+1).ok).toBe(true);expect(oldDoor.open).toBe(true);expect(validate(snap(unlocked))).toBeTruthy();
 });
 it('does not infer circuits for Veyra and does not debit fuel',()=>{
  setActiveLayout('veyra-greywater-lr02-u16');const g=newGame();expect(act(g,'startRun',{character:'female',seed:19},T).ok).toBe(true);expect(getWorld(g.run!.layoutId).poiAccess).toBeUndefined();const r=g.run!,p=r.player;const e={id:'fixture',kind:'gen' as const,x:p.x,y:p.y,tx:Math.floor(p.x/TILE),ty:Math.floor(p.y/TILE),poi:'light'};r.entities[e.id]=e;addItem(r,'inv','fuel_can',1);expect(act(g,'generator',{eid:e.id}).ok).toBe(false);expect(countItem(r,'inv','fuel_can')).toBe(1);
 });
});
