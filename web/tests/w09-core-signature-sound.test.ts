// W09: a committed Mjolnir Signature is one physical sound at the pull point at commit time (the pull field exists then;
// the delayed burst is NOT claimed to have happened at commit). Real engine paths: loadCore dispatch and the skill input.
// Fixture disclosure: fresh shipping run; a Mjolnir is inserted into an empty inventory slot (the crate reward is not
// walked to in this test). Energy and essence are added to inventory, and the reserve is then loaded via dispatch(loadCore).
import {afterAll,describe,it,expect} from 'vitest';
import {BAL,TILE,WW,WH,uid,type GameState,type RunState} from '../src/game/core';
import {addItem,blockGrid,clearPhysicalLine,countItem,dispatch,mkCreature,mkStack,newGame,markDirty} from '../src/game/engine';
import {tick,type Input} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
const START=Date.UTC(2026,10,5);
const idle:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};
let serial=0;
afterAll(()=>setActiveLayout('shipping'));

function run(){
  setActiveLayout('shipping_fresh');const g=newGame();
  expect(dispatch(g,{id:'w09-start-'+ ++serial,type:'startRun',character:'female',seed:61},START).ok).toBe(true);
  const r=g.run!;r.creatures=[];r.worldStimuli=[];
  const grid=blockGrid(r);let spot:{tx:number;ty:number}|undefined;
  search:for(let ty=6;ty<WH-6;ty++)for(let tx=6;tx<WW-20;tx++){let ok=true;for(let dy=-2;dy<=2&&ok;dy++)for(let dx=0;dx<=14&&ok;dx++)if(grid[(ty+dy)*WW+tx+dx]!==0)ok=false;if(ok){spot={tx,ty};break search;}}
  expect(spot).toBeTruthy();
  r.player.x=spot!.tx*TILE+8;r.player.y=spot!.ty*TILE+8;r.clock.lastSimAt=START;
  return {g,r};
}
function frame(g:GameState,at:number,ms=50,inp:Partial<Input>={}){tick(g,{...idle,...inp},ms,at);}
function copy(g:GameState){return selectSnapshots([serializeSnapshot(g),null]).gs!;}
function emits(r:RunState){return r.receipts.filter(x=>x.kind==='stimulus.emit');}
function wolfAt(r:RunState,x:number,y:number){const m=mkCreature(r,'wolf',x,y,30);r.creatures.push(m);return m;}
/** Loads a Mjolnir signature reserve through the real loadCore intent, consuming Refined Energy and Nature Essence. */
function mjolnirReady(r:RunState,g:GameState,charges=1){
  const slot=1;r.custody.inv.slots[slot]=mkStack(r,'core_mjolnir',1);markDirty();
  const uidv=r.custody.inv.slots[slot]!.uid!;
  addItem(r,'inv','energy_refined',charges);addItem(r,'inv','essence_nature',charges);
  const res=dispatch(g,{id:'w09-load-'+ ++serial,type:'loadCore',slot,uid:uidv,mode:'signature'} as any,START+10);
  expect(res.ok).toBe(true);
  expect(r.custody.inv.slots[slot]!.reserves!.signature).toBe(charges);
  return {slot,uid:uidv};
}
function commitSig(g:GameState,r:RunState,at:number,core:{slot:number;uid:string},target:{x:number;y:number}){
  r.player.active=core.slot;
  frame(g,at,50,{skill:'signature',skillAim:{uid:core.uid,slot:core.slot,mx:target.x,my:target.y,viewX:0,viewY:0}} as any);
  let t=at;while(emits(r).length===0&&t<at+2000){t+=50;frame(g,t);}
  return t;
}

describe('W09 Mjolnir Signature sound', () => {
  it('a committed signature commits once, costs one reserve charge, and emits at the pull point at commit time', () => {
    const {g,r}=run();const core=mjolnirReady(r,g);
    expect(countItem(r,'inv','energy_refined')).toBe(0);
    const tgt={x:r.player.x+100,y:r.player.y};
    const m=wolfAt(r,tgt.x+200,tgt.y);expect(clearPhysicalLine(r,m,tgt,false,true)).toBe(true);
    const commitAt=START+2000;
    const t=commitSig(g,r,commitAt,core,tgt);
    expect(emits(r)).toHaveLength(1);
    expect(r.custody.inv.slots[core.slot]!.reserves!.signature).toBe(0);
    expect(r.receipts.filter(x=>x.kind==='core.commit')).toHaveLength(1);
    const e=emits(r)[0];const s=r.worldStimuli!.find(w=>w.kind==='combat-sound')!;
    expect(e.detail).toBe(`signature:${s.x},${s.y}`);
    expect(s).toMatchObject({eligibility:'audible-signature-v1',range:BAL.worldStimulusV1.combatSoundRanges.signature,x:tgt.x,y:tgt.y});
    expect(s.at).toBe(t);
    expect(s.range).toBeLessThan(BAL.ai.activeRadiusTiles*TILE);
    // The pull field is created at commit; the later burst is intentionally not claimed to occur at commit.
    frame(g,t+60);
    expect(m.knows).toMatchObject({kind:'stimulus',x:tgt.x,y:tgt.y});
    expect(m.knows?.kind).not.toBe('sight');
  });

  it('empty reserve, wrong UID, and cancelled casts produce no sound and no free outcome', () => {
    // empty reserve
    const a=run();const ca=mjolnirReady(a.r,a.g,1);a.r.custody.inv.slots[ca.slot]!.reserves!.signature=0;markDirty();
    frame(a.g,START+3000,50,{skill:'signature',skillAim:{uid:ca.uid,slot:ca.slot,mx:a.r.player.x+100,my:a.r.player.y,viewX:0,viewY:0}} as any);
    for(let ms=100;ms<=800;ms+=50)frame(a.g,START+3000+ms);
    expect(emits(a.r)).toHaveLength(0);expect(a.r.receipts.filter(x=>x.kind==='core.commit')).toHaveLength(0);
    // wrong UID
    const b=run();const cb=mjolnirReady(b.r,b.g,1);b.r.player.active=cb.slot;
    frame(b.g,START+3000,50,{skill:'signature',skillAim:{uid:'not-this-core',slot:cb.slot,mx:b.r.player.x+100,my:b.r.player.y,viewX:0,viewY:0}} as any);
    for(let ms=100;ms<=800;ms+=50)frame(b.g,START+3000+ms);
    expect(emits(b.r)).toHaveLength(0);expect(b.r.custody.inv.slots[cb.slot]!.reserves!.signature).toBe(1);
    // cancelled during windup
    const c=run();const cc=mjolnirReady(c.r,c.g,1);c.r.player.active=cc.slot;
    frame(c.g,START+3000,50,{skill:'signature',skillAim:{uid:cc.uid,slot:cc.slot,mx:c.r.player.x+100,my:c.r.player.y,viewX:0,viewY:0}} as any);
    frame(c.g,START+3050,50,{cancel:true});
    for(let ms=100;ms<=800;ms+=50)frame(c.g,START+3050+ms);
    expect(emits(c.r)).toHaveLength(0);expect(c.r.custody.inv.slots[cc.slot]!.reserves!.signature).toBe(1);
  });

  it('save/reload neither duplicates nor relocates the sound; replayed ticks add nothing', () => {
    const {g,r}=run();const core=mjolnirReady(r,g);const tgt={x:r.player.x+100,y:r.player.y};
    const m=wolfAt(r,tgt.x+200,tgt.y);const t=commitSig(g,r,START+2000,core,tgt);frame(g,t+60);
    const before=emits(r).map(x=>x.detail);const stim=JSON.stringify(r.worldStimuli);
    const g2=copy(g);const r2=g2.run!;
    expect(emits(r2).map(x=>x.detail)).toEqual(before);
    expect(JSON.stringify(r2.worldStimuli)).toBe(stim);
    frame(g2,t+100);frame(g2,t+150);
    expect(emits(r2).map(x=>x.detail)).toEqual(before);
    expect(r2.receipts.filter(x=>x.kind==='core.commit')).toHaveLength(1);
    expect(m.knows?.kind).toBe('stimulus');
  });

  it('a signature sound stays in the bounded list and survives save/reload (bow/airdrop coexistence is in w08r)', () => {
    const {g,r}=run();const core=mjolnirReady(r,g);const tgt={x:r.player.x+100,y:r.player.y};
    wolfAt(r,tgt.x+200,tgt.y);commitSig(g,r,START+2000,core,tgt);
    const kinds=r.worldStimuli!.map(s=>s.eligibility);
    expect(kinds).toContain('audible-signature-v1');
    expect(copy(g).run!.worldStimuli!.map(s=>s.eligibility)).toEqual(kinds);
  });
});
describe('W09 physical obstruction near structures', () => {
  it('a closed door blocks the signature sound across the line; opening it restores hearing; the structure is not a home proof', () => {
    const {g,r}=run();const core=mjolnirReady(r,g);const tgt={x:r.player.x+100,y:r.player.y};
    const m=wolfAt(r,tgt.x+200,tgt.y);
    const dtx=Math.floor((tgt.x+100)/TILE),dty=Math.floor(tgt.y/TILE),id=uid(r,'e');
    const door={id,kind:'struct',owner:'player',type:'door_wood',tx:dtx,ty:dty,x:dtx*TILE+8,y:dty*TILE+8,hp:100,maxHp:100,open:false} as any;
    r.entities[id]=door;markDirty();
    expect(clearPhysicalLine(r,m,tgt,false,true)).toBe(false);
    const t=commitSig(g,r,START+2000,core,tgt);
    frame(g,t+60);
    expect(m.knows?.kind).not.toBe('stimulus');
    // control: the same creature hears once the door is open (open door does not obstruct)
    door.open=true;markDirty();
    frame(g,t+120);
    expect(m.knows).toMatchObject({kind:'stimulus',x:tgt.x,y:tgt.y});
    expect(door.hp).toBeGreaterThan(99);
  });
});
