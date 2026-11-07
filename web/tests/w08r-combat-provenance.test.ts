// W08-R corrective acceptance: receipt identity, save provenance, home acoustics, timing and coexistence.
// Real engine functions only. Fixtures: fresh shipping run, player on a disclosed open grass strip.
import {afterAll,describe,it,expect} from 'vitest';
import {BAL,TILE,WW,WH,uid,type GameState,type RunState} from '../src/game/core';
import {addItem,blockGrid,clearPhysicalLine,dispatch,mkCreature,mkStack,newGame,markDirty} from '../src/game/engine';
import {settle,tick,type Input} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {landingStimulus,pushCombatStimulus,combatStimulus} from '../src/game/stimulus';
const START=Date.UTC(2026,10,5);
const idle:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};
let serial=0;
afterAll(()=>setActiveLayout('shipping'));

function run(){
  setActiveLayout('shipping_fresh');const g=newGame();
  expect(dispatch(g,{id:'w08r-start-'+ ++serial,type:'startRun',character:'female',seed:59},START).ok).toBe(true);
  const r=g.run!;r.creatures=[];r.worldStimuli=[];
  const grid=blockGrid(r);let spot:{tx:number;ty:number}|undefined;
  search:for(let ty=6;ty<WH-6;ty++)for(let tx=6;tx<WW-20;tx++){let ok=true;for(let dy=-2;dy<=2&&ok;dy++)for(let dx=0;dx<=14&&ok;dx++)if(grid[(ty+dy)*WW+tx+dx]!==0)ok=false;if(ok){spot={tx,ty};break search;}}
  expect(spot).toBeTruthy();
  r.player.x=spot!.tx*TILE+8;r.player.y=spot!.ty*TILE+8;r.clock.lastSimAt=START;
  return {g,r};
}
function frame(g:GameState,at:number,ms=50,inp:Partial<Input>={}){tick(g,{...idle,...inp},ms,at);}
function copy(g:GameState){return selectSnapshots([serializeSnapshot(g),null]).gs!;}
function bowIn(r:RunState,arrows:number){r.custody.inv.slots[0]=mkStack(r,'bow',1);r.player.active=0;addItem(r,'inv','arrow',arrows);markDirty();}
function wolfAt(r:RunState,x:number,y:number,type='wolf'){const m=mkCreature(r,type,x,y,30);r.creatures.push(m);return m;}
function emits(r:RunState){return r.receipts.filter(x=>x.kind==='stimulus.emit');}
function shoot(g:GameState,r:RunState,at:number){frame(g,at,50,{attackPressed:true,attack:true});let t=at;while(emits(r).length===0&&t<at+3000){t+=50;frame(g,t);}expect(emits(r)).toHaveLength(1);return t;}
function wall(r:RunState,tx:number,ty:number){const id=uid(r,'e');r.entities[id]={id,kind:'struct',owner:'not-player',type:'wall_wood',tx,ty,x:tx*TILE+8,y:ty*TILE+8,hp:100,maxHp:100} as any;markDirty();return id;}

describe('W08-R receipt-to-source identity (P0)', () => {
  it('receipt id, sequence, detail, stimulus sourceId and eventIndex agree exactly, across a snapshot', () => {
    const {g,r}=run();bowIn(r,1);const at=START+1000;
    const t=shoot(g,r,at);
    const e=emits(r)[0];const s=r.worldStimuli![0];
    expect(e.id).toBe(`r${e.seq}`);
    expect(e.seq).toBe(r.seq);
    expect(e.detail).toBe(`ranged:${s.x},${s.y}`);
    expect(s.sourceId).toBe(`combat:${e.seq}`);
    expect(s.eventIndex).toBe(e.seq);
    expect(e.at).toBe(s.at);
    expect(s.at).toBe(t);
    // negative: the previous sequence must not be the one recorded
    expect(e.detail).not.toContain(`combat:${e.seq-1}`);
    const g2=copy(g);
    const e2=g2.run!.receipts.find(x=>x.kind==='stimulus.emit')!;
    expect(e2).toMatchObject({id:e.id,seq:e.seq,detail:e.detail});
    expect(g2.run!.worldStimuli![0]).toMatchObject({sourceId:s.sourceId,eventIndex:s.eventIndex});
  });
});

describe('W08-R save provenance (P0)', () => {
  function shotWithWolf(){const q=run();bowIn(q.r,1);const m=wolfAt(q.r,q.r.player.x+140,q.r.player.y);const t=shoot(q.g,q.r,START+1000);frame(q.g,t+60);expect(m.knows?.kind).toBe('stimulus');return {...q,m,t};}
  const reject=(g:GameState)=>expect(()=>serializeSnapshot(g)).toThrow('Refusing to save invalid game state');
  it('rejects a combat source whose sequence belongs to an unrelated receipt', () => {
    const q=shotWithWolf();const bad=structuredClone(q.g);const br=bad.run!;
    const other=br.receipts.find(x=>x.kind!=='stimulus.emit')!;expect(other).toBeTruthy();
    br.worldStimuli=[];const k=br.creatures.find(c=>c.id===q.m.id)!.knows!;
    k.sourceId=`combat:${other.seq}`;k.eventIndex=other.seq;br.creatures.find(c=>c.id===q.m.id)!.stimulusIgnore=k.sourceId;
    reject(bad);
  });
  it('rejects receipt-backed knowledge whose coordinates differ from the committed emission', () => {
    const q=shotWithWolf();const bad=structuredClone(q.g);bad.run!.creatures.find(c=>c.id===q.m.id)!.knows!.x+=TILE;reject(bad);
  });
  it('rejects a fabricated live signal whose coordinates disagree with its receipt', () => {
    const q=shotWithWolf();const bad=structuredClone(q.g);bad.run!.worldStimuli![0].x+=TILE;reject(bad);
  });
  it('rejects a fake goal that is not an adjacent walkable approach tile of the source', () => {
    const q=shotWithWolf();const bad=structuredClone(q.g);const k=bad.run!.creatures.find(c=>c.id===q.m.id)!.knows!;k.goalX=k.x+5*TILE;k.goalY=k.y;reject(bad);
  });
  it('rejects sequence numbers beyond the committed sequence', () => {
    const q=shotWithWolf();const bad=structuredClone(q.g);bad.run!.worldStimuli![0].sourceId=`combat:${bad.run!.seq+5}`;bad.run!.worldStimuli![0].eventIndex=bad.run!.seq+5;reject(bad);
  });
  it('rejects a receipt with the right sequence but a different eligibility', () => {
    const q=shotWithWolf();const bad=structuredClone(q.g);bad.run!.worldStimuli![0].eligibility='audible-melee-v1';bad.run!.worldStimuli![0].range=BAL.worldStimulusV1.combatSoundRanges.melee;reject(bad);
  });
  it('accepts legitimate knowledge after its receipts were evicted from the bounded log', () => {
    const q=shotWithWolf();const g=structuredClone(q.g);g.run!.receipts=[];expect(()=>serializeSnapshot(g)).not.toThrow();
    const ok=copy(g);expect(ok.run!.creatures.find(c=>c.id===q.m.id)!.knows?.kind).toBe('stimulus');
  });
});

describe('W08-R home acoustics (P1)', () => {
  function playerStruct(r:RunState,tx:number,ty:number){const id=uid(r,'e');r.entities[id]={id,kind:'struct',owner:'player',type:'wall_wood',tx,ty,x:tx*TILE+8,y:ty*TILE+8,hp:100,maxHp:100} as any;markDirty();return r.entities[id];}
  it('a shot within eight tiles of a player structure is ignored by creatures, even with a clear line', () => {
    const {g,r}=run();bowIn(r,1);const sx=Math.floor(r.player.x/TILE),sy=Math.floor(r.player.y/TILE);
    const s=playerStruct(r,sx,sy+3);const hp=s.hp;const m=wolfAt(r,r.player.x+140,r.player.y);
    expect(clearPhysicalLine(r,m,r.player,false,true)).toBe(true);
    const t=shoot(g,r,START+1000);frame(g,t+60);
    expect(m.knows?.kind).not.toBe('stimulus');expect(s.hp).toBeGreaterThan(hp-1);
  });
  it('a shot in open terrain beyond eight tiles from any player structure is heard by the same creature', () => {
    const {g,r}=run();bowIn(r,1);const sx=Math.floor(r.player.x/TILE),sy=Math.floor(r.player.y/TILE);
    const s=playerStruct(r,sx+12>=WW-2?sx-12:sx+12,sy);const hp=s.hp;const m=wolfAt(r,r.player.x+140,r.player.y);
    const t=shoot(g,r,START+1000);frame(g,t+60);
    expect(m.knows).toMatchObject({kind:'stimulus',sourceId:`combat:${emits(r)[0].seq}`});
    // investigation moves toward the sound origin; the structure is never attacked by sound alone
    for(let ms=120;ms<=1500;ms+=50)frame(g,t+ms);
    expect(s.hp).toBeGreaterThan(hp-1);
  });
  it('a player structure does not disclose the player location: the creature knows only the emission point', () => {
    const {g,r}=run();bowIn(r,1);const m=wolfAt(r,r.player.x+140,r.player.y);const t=shoot(g,r,START+1000);
    const shot={x:r.player.x,y:r.player.y};frame(g,t+60);r.player.x-=300;markDirty();
    expect(m.knows?.x).toBe(shot.x);expect(m.knows?.y).toBe(shot.y);
  });
});

describe('W08-R timing and coexistence (P1)', () => {
  it('the 4 s signal window bounds detection; no notice can be made after the signal expires', () => {
    const {g,r}=run();bowIn(r,1);wolfAt(r,r.player.x+140,r.player.y);
    const id=wall(r,Math.floor((r.player.x+64)/TILE),Math.floor(r.player.y/TILE));
    const t=shoot(g,r,START+1000);
    for(let ms=60;ms<=3900;ms+=50)frame(g,t+ms);
    delete r.entities[id];markDirty();
    for(let ms=4000;ms<=4800;ms+=50)frame(g,t+ms);
    expect(r.worldStimuli??[]).toHaveLength(0);
    const notices=r.receipts.filter(x=>x.kind==='stimulus.notice'&&x.detail.endsWith(`:combat:${emits(r)[0].seq}`));
    expect(notices.every(x=>x.at<t+BAL.worldStimulusV1.signalMs)).toBe(true);
  });
  it('a notice in the window keeps investigation memory for 24 s from the emission time', () => {
    const {g,r}=run();bowIn(r,1);const m=wolfAt(r,r.player.x+140,r.player.y);const t=shoot(g,r,START+1000);frame(g,t+60);
    expect(m.knows?.expiresAt).toBe(t+BAL.worldStimulusV1.memoryMs);
    settle(g,t+BAL.worldStimulusV1.signalMs+5000);
    expect(m.knows?.kind).toBe('stimulus');
  });
  it('airdrop and combat signals coexist; combat overflow never evicts a still-valid airdrop', () => {
    const {r}=run();
    const air=landingStimulus(r,{id:'e7',x:200,y:200,airdrop:{index:0}} as any,START+500);
    r.worldStimuli=[air];
    const cap=BAL.worldStimulusV1.combatSignalCap;
    for(let i=1;i<=cap+8;i++)pushCombatStimulus(r,combatStimulus(i,'ranged',200+i,200,START+500+i));
    expect(r.worldStimuli!.some(s=>s.kind==='airdrop-landing'&&s.sourceId===air.sourceId)).toBe(true);
    expect(r.worldStimuli!.filter(s=>s.kind==='combat-sound')).toHaveLength(cap);
    expect(r.worldStimuli!.length).toBe(cap+1);
  });
});
