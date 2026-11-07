// W08 PvE sensory ecology: a committed bow release is a finite world sound; creatures investigate the
// source point only. Real engine functions; fixtures are disclosed inline.
import {afterAll,describe,it,expect} from 'vitest';
import {BAL,TILE,WW,WH,uid,type GameState,type RunState} from '../src/game/core';
import {addItem,blockGrid,clearPhysicalLine,dispatch,mkCreature,mkStack,newGame,markDirty} from '../src/game/engine';
import {settle,tick,type Input} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
const START=Date.UTC(2026,10,5);
const idle:Input={up:false,down:false,left:false,right:false,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};
let serial=0;
afterAll(()=>setActiveLayout('shipping'));

/** Fixture: fresh shipping run, creature list cleared, player on a 14×5 open grass strip. Disclosed fixture, not a route. */
function run(){
  setActiveLayout('shipping_fresh');const g=newGame();
  expect(dispatch(g,{id:'w08-start-'+ ++serial,type:'startRun',character:'female',seed:58},START).ok).toBe(true);
  const r=g.run!;r.creatures=[];r.worldStimuli=[];
  const grid=blockGrid(r);let spot:{tx:number;ty:number}|undefined;
  search:for(let ty=6;ty<WH-6;ty++)for(let tx=6;tx<WW-20;tx++){let ok=true;for(let dy=-2;dy<=2&&ok;dy++)for(let dx=0;dx<=14&&ok;dx++)if(grid[(ty+dy)*WW+tx+dx]!==0)ok=false;if(ok){spot={tx,ty};break search;}}
  expect(spot).toBeTruthy();
  r.player.x=spot!.tx*TILE+8;r.player.y=spot!.ty*TILE+8;r.player.hp=r.player.maxHp??r.player.hp;
  r.clock.lastSimAt=START;
  return {g,r};
}
function frame(g:GameState,at:number,ms=50,inp:Partial<Input>={}){tick(g,{...idle,...inp},ms,at);}
function copy(g:GameState){return selectSnapshots([serializeSnapshot(g),null]).gs!;}
function bowIn(r:RunState,arrows:number){r.custody.inv.slots[0]=mkStack(r,'bow',1);r.player.active=0;addItem(r,'inv','arrow',arrows);markDirty();}
function wolfAt(r:RunState,x:number,y:number,type='wolf'){const m=mkCreature(r,type,x,y,30);r.creatures.push(m);return m;}
function emits(r:RunState){return r.receipts.filter(x=>x.kind==='stimulus.emit');}
/** Presses attack and advances until the bow's real release commits; returns the release time. */
function shoot(g:GameState,r:RunState,at:number){frame(g,at,50,{attackPressed:true,attack:true});let t=at;while(emits(r).length===0&&t<at+3000){t+=50;frame(g,t);}expect(emits(r)).toHaveLength(1);return t;}

describe('W08 combat sound source', () => {
  it('a committed bow release emits exactly one ranged source at the release point', () => {
    const {g,r}=run();bowIn(r,3);const at=START+1000;
    frame(g,at,50,{attackPressed:true,attack:true});
    for(let ms=100;ms<=1600;ms+=50)frame(g,at+ms);
    expect(emits(r)).toHaveLength(1);
    expect(r.worldStimuli).toHaveLength(1);
    const s=r.worldStimuli![0];
    expect(s).toMatchObject({kind:'combat-sound',modality:'sound',eligibility:'audible-ranged-v1',range:BAL.worldStimulusV1.combatSoundRanges.ranged,strength:1});
    expect(s.sourceId).toBe(`combat:${emits(r)[0].seq}`);
    expect(s.eventIndex).toBe(emits(r)[0].seq);
    expect(s.expiresAt-s.at).toBe(BAL.worldStimulusV1.signalMs);
    expect(Number.isFinite(s.x)&&Number.isFinite(s.y)).toBe(true);
  });

  it('invalid release emits nothing; melee emits only the short-range source', () => {
    const a=run();a.r.custody.inv.slots[0]=mkStack(a.r,'bow',1);a.r.player.active=0;markDirty();
    frame(a.g,START+1000,50,{attackPressed:true,attack:true});for(let ms=100;ms<=1600;ms+=50)frame(a.g,START+1000+ms);
    expect(emits(a.r)).toHaveLength(0);
    expect(a.r.worldStimuli??[]).toHaveLength(0);
    const b=run();b.r.custody.inv.slots[0]=mkStack(b.r,'knife',1);b.r.player.active=0;markDirty();
    frame(b.g,START+1000,50,{attackPressed:true,attack:true});for(let ms=100;ms<=1600;ms+=50)frame(b.g,START+1000+ms);
    const melee=b.r.worldStimuli??[];
    expect(melee.length).toBeGreaterThan(0);
    expect(melee.every(s=>s.kind==='combat-sound'&&s.eligibility==='audible-melee-v1'&&s.range===BAL.worldStimulusV1.combatSoundRanges.melee)).toBe(true);
  });

  it('an eligible nearby wolf detects the source and investigates the sound point, not the player', () => {
    const {g,r}=run();bowIn(r,1);const at=START+1000;
    const m=wolfAt(r,r.player.x+140,r.player.y);expect(clearPhysicalLine(r,m,r.player,false,true)).toBe(true);
    const t=shoot(g,r,at);
    const src={x:r.player.x,y:r.player.y};
    frame(g,t+60);
    expect(m.knows?.kind).toBe('stimulus');
    expect(m.knows).toMatchObject({x:src.x,y:src.y,sourceId:`combat:${emits(r)[0].seq}`});
    expect(m.knows?.traceId).toBeUndefined();
    // player walks away; investigation must keep the sound point and never learn the new position
    r.player.x=src.x-200; r.player.y=src.y;markDirty();
    const d0=Math.hypot(m.x-src.x,m.y-src.y);
    for(let ms=120;ms<=1500;ms+=50)frame(g,t+ms);
    expect(m.knows?.x).toBe(src.x);expect(m.knows?.y).toBe(src.y);
    expect(Math.hypot(m.x-src.x,m.y-src.y)).toBeLessThan(d0);
  });

  it('a wall on the physical line blocks the sound', () => {
    const {g,r}=run();bowIn(r,1);const m=wolfAt(r,r.player.x+140,r.player.y);
    const tx=Math.floor((r.player.x+64)/TILE),ty=Math.floor(r.player.y/TILE);const id=uid(r,'e');
    r.entities[id]={id,kind:'struct',owner:'not-player',type:'wall_wood',tx,ty,x:tx*TILE+8,y:ty*TILE+8,hp:100,maxHp:100} as any;markDirty();
    frame(g,START+1000,50,{attackPressed:true,attack:true});for(let ms=100;ms<=800;ms+=50)frame(g,START+1000+ms);
    expect(m.knows?.kind).not.toBe('stimulus');
  });
  it('out-of-range, deaf, and walled creatures do not investigate', () => {
    const far=run();bowIn(far.r,1);const mf=wolfAt(far.r,far.r.player.x+200,far.r.player.y);
    frame(far.g,START+1000,50,{attackPressed:true,attack:true});for(let ms=100;ms<=800;ms+=50)frame(far.g,START+1000+ms);
    expect(mf.knows?.kind).not.toBe('stimulus');
    const deaf=run();bowIn(deaf.r,1);const md=wolfAt(deaf.r,deaf.r.player.x+140,deaf.r.player.y,'boar');
    frame(deaf.g,START+1000,50,{attackPressed:true,attack:true});for(let ms=100;ms<=800;ms+=50)frame(deaf.g,START+1000+ms);
    expect(md.knows?.kind).not.toBe('stimulus');
  });

  it('expired knowledge and invalid investigation routes clear through the legitimate mechanism', () => {
    const {g,r}=run();bowIn(r,1);const at=START+1000;const m=wolfAt(r,r.player.x+140,r.player.y);
    const t=shoot(g,r,at);frame(g,t+60);
    expect(m.knows?.kind).toBe('stimulus');
    const sr=r.worldStimuli;
    settle(g,t+BAL.worldStimulusV1.memoryMs+1000);
    expect(m.knows).toBeNull();expect(r.worldStimuli??[]).toHaveLength(0);
    expect(r.receipts.filter(x=>x.kind==='stimulus.lost').length).toBeGreaterThanOrEqual(1);
    expect(sr).toBeTruthy();
  });

  it('an invalid route to the sound point ends investigation as blocked, without damaging anything', () => {
    const {g,r}=run();bowIn(r,1);const at=START+1000;const m=wolfAt(r,r.player.x+140,r.player.y);
    const t=shoot(g,r,at);frame(g,t+60);
    expect(m.knows?.kind).toBe('stimulus');
    const stx=Math.floor(r.player.x/TILE),sty=Math.floor(r.player.y/TILE);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const tx=stx+dx,ty=sty+dy,id=uid(r,'e');r.entities[id]={id,kind:'struct',owner:'not-player',type:'wall_wood',tx,ty,x:tx*TILE+8,y:ty*TILE+8,hp:100,maxHp:100} as any;}
    markDirty();
    frame(g,t+120);
    expect(m.knows).toBeNull();
    expect(r.receipts.filter(x=>x.kind==='stimulus.lost').some(x=>x.detail.endsWith(':blocked')||x.detail.endsWith(':unreachable'))).toBe(true);
    expect(Object.values(r.entities).filter(e=>e.kind==='struct'&&e.owner==='not-player'&&e.hp<100)).toHaveLength(0);
  });

  it('save/reload neither duplicates emission nor resets knowledge; forged combat sources are rejected', () => {
    const {g,r}=run();bowIn(r,1);const at=START+1000;const m=wolfAt(r,r.player.x+140,r.player.y);
    const t=shoot(g,r,at);frame(g,t+60);
    const before=emits(r).length;const seq=emits(r)[0].seq;
    const g2=copy(g);const r2=g2.run!;
    expect(emits(r2)).toHaveLength(before);
    expect(r2.seq).toBe(r.seq);
    const m2=r2.creatures.find(c=>c.id===m.id)!;
    expect(m2.knows).toMatchObject({kind:'stimulus',sourceId:`combat:${seq}`});
    frame(g2,t+200);frame(g2,t+250);
    expect(emits(r2)).toHaveLength(before);
    expect(r2.receipts.filter(x=>x.kind==='stimulus.notice')).toHaveLength(r.receipts.filter(x=>x.kind==='stimulus.notice').length);
    for(const mutate of [
      (q:GameState)=>{q.run!.worldStimuli![0].sourceId='combat:999999';},
      (q:GameState)=>{q.run!.worldStimuli![0].range=999;},
      (q:GameState)=>{q.run!.worldStimuli![0].eligibility='audible-landing-v1' as any;},
      (q:GameState)=>{q.run!.worldStimuli![0].x=-5;},
      (q:GameState)=>{q.run!.creatures.find(c=>c.id===m.id)!.knows!.sourceId='combat:999999';},
    ]){
      const bad=structuredClone(g);mutate(bad);
      expect(()=>serializeSnapshot(bad)).toThrow('Refusing to save invalid game state');
    }
  });

  it('offline settlement invents no emission, movement, notice, or damage', () => {
    const {g,r}=run();bowIn(r,1);const at=START+1000;const m=wolfAt(r,r.player.x+140,r.player.y);
    const t=shoot(g,r,at);frame(g,t+60);
    const xy=[m.x,m.y],hp=r.player.hp,creature=m.hp;const n=emits(r).length,notices=r.receipts.filter(x=>x.kind==='stimulus.notice').length;
    settle(g,t+3_600_000);
    expect(emits(r)).toHaveLength(n);
    expect(r.receipts.filter(x=>x.kind==='stimulus.notice')).toHaveLength(notices);
    expect(r.player.hp).toBeLessThanOrEqual(hp);
    expect(m.hp).toBe(creature);
    expect([m.x,m.y]).toEqual(xy);
  });
});
