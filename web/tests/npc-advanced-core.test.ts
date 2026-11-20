import {groveCells,spiritDestination} from "../src/game/core-sites";
import {describe,it,expect} from 'vitest';
import {BAL,TILE,WW,type GameState} from '../src/game/core';
import {clearPhysicalLine,addItem,C,blockGrid,mkStack,newGame,startRun,mkCreature} from '../src/game/engine';
import {applyDamage,humanPack,stepHumanCombat,stepHumans} from '../src/game/humanworld';
import {bindCombat,damageCreature,HAZ,PROJ,releaseCoreEffect,settle,tick,tickHaz,tickProj} from '../src/game/sim';
import {validate} from '../src/game/persist';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';
function setup(){
  setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
  const r=gs.run!,hw=r.humanWorld!,[h,enemy,friend,...rest]=Object.values(hw.people),origin=r.sourceMap!.veyra!.originAu;
  const grid=blockGrid(r),i=grid.findIndex((v,i)=>!v&&i>WW*8&&i%WW>5&&i%WW<WW-12&&grid.slice(i,i+10).every(n=>!n));expect(i).toBeGreaterThan(0);
  const x=i%WW,y=Math.floor(i/WW);for(const p of [friend,...rest])p.floor=1;
  Object.assign(h,{state:'FIGHTING',gx:origin[0]*2+x,gy:origin[1]*2+y,floor:0,community:undefined,protectedPeople:[friend.actorId],stamina:100});h.equip.weapon=null;
  Object.assign(enemy,{state:'IDLE',gx:h.gx+6,gy:h.gy,floor:0,community:undefined});r.player.y=(y+9)*TILE;r.creatures=[];
  h.intent={actorId:h.actorId,intentId:'hold-the-line',kind:'fight',target:enemy.actorId,preconditions:[],reserved:[],startAt:T0,dueAt:T0};
  const slots=humanPack(r,h).slots;slots.fill(null);const core=mkStack(r,'core_mjolnir',1);core.lvl=3;core.dur=100;slots[0]=core;slots[1]=mkStack(r,'energy_refined',2);slots[2]=mkStack(r,'essence_nature',2);
  bindCombat(r);return {gs,r,h,enemy,friend,slots,core,x:(x+.5)*TILE,y:(y+.5)*TILE};
}
function combat(gs:GameState,t:number){const r=gs.run!;stepHumanCombat(r,r.humanWorld!,t,undefined,undefined,undefined,c=>releaseCoreEffect(gs,c,t));}
describe('owned advanced Mjolnir casts',()=>{
 it('keeps level, ammunition and friendly-fire checks live until contact',()=>{
  const {gs,h,enemy,friend,core,slots}=setup();core.lvl=1;combat(gs,T0+1);expect(h.intent!.coreCast).toBeUndefined();core.lvl=2;
  combat(gs,T0+2);expect(h.intent!.coreCast?.mode).toBe('refined');friend.floor=0;friend.gx=enemy.gx-1;friend.gy=enemy.gy;
  combat(gs,T0+302);expect(h.intent!.coreCast).toBeUndefined();expect(HAZ).toHaveLength(0);expect([core.dur,slots[1]?.qty,h.stamina]).toEqual([100,2,100]);
  friend.floor=1;combat(gs,T0+400);slots[1]=null;combat(gs,T0+700);expect(HAZ).toHaveLength(0);expect(core.cd?.refined).toBeUndefined();
 });
 it('resumes the original aimed spot after loading; a moved target is not tracked',()=>{
  const {gs,h,enemy,core,x,y}=setup();combat(gs,T0+1);const loaded=validate(JSON.parse(JSON.stringify(gs)))!;expect(loaded).not.toBeNull();bindCombat(loaded.run!);
  const world=loaded.run!.humanWorld!,caster=world.people[h.actorId],target=world.people[enemy.actorId],pack=humanPack(loaded.run!,caster);
  target.gx+=2;combat(loaded,T0+301);combat(loaded,T0+301);expect(HAZ).toHaveLength(BAL.creatorCoreMjolnir.strikeCount);
  for(const hazard of HAZ)expect(hazard).toMatchObject({owner:h.actorId,coreUid:core.uid,victim:enemy.actorId,x:x+6*TILE,y});
  expect([pack.slots[0]?.dur,pack.slots[1]?.qty,pack.slots[2]?.qty]).toEqual([95,1,2]);const hp=target.hp;
  tickHaz(loaded,250,T0+551);expect(target.hp).toBe(hp);target.gx-=2;tickHaz(loaded,300,T0+851);expect(target.hp).toBeLessThan(hp);
 });
 it('selects attraction against a visible group, pays its own essence and resolves pull before burst',()=>{
  const {gs,r,h,enemy,core,slots,x,y}=setup();enemy.floor=1;const a=mkCreature(r,'boar',x+6*TILE,y,500),b=mkCreature(r,'boar',x+8*TILE,y,500);
  a.state=b.state='chase';r.creatures=[a,b];h.intent!.target=a.id;
  combat(gs,T0+1);expect(h.intent!.coreCast?.mode).toBe('signature');combat(gs,T0+301);expect([core.dur,slots[1]?.qty,slots[2]?.qty]).toEqual([87,1,1]);expect(core.cd?.signature).toBeGreaterThan(T0+301);
  expect(HAZ.map(v=>v.effect)).toEqual(['mjolnirPull','mjolnirStrike']);const before=b.x,hp=b.hp;
  tickHaz(gs,100,T0+401);expect(b.x).toBeLessThan(before);expect(b.hp).toBe(hp);
  for(let t=200;t<=2200;t+=100)tickHaz(gs,100,T0+301+t);expect(b.hp).toBeLessThan(hp);expect(HAZ).toHaveLength(0);
 });
});
it('uses a paid refined Meteor on a cluster, preserves the caster on its burn pool, and never charges twice',()=>{
  const {gs,r,h,slots,x,y,enemy}=setup();enemy.floor=1;slots[0]=mkStack(r,'core_meteor',1);slots[0].lvl=2;slots[3]=mkStack(r,'energy_basic',1);
  const a=mkCreature(r,'boar',x+6*TILE,y,500),b=mkCreature(r,'boar',x+7*TILE,y,500);a.state=b.state='chase';r.creatures=[a,b];h.intent!.target=a.id;
  combat(gs,T0+1);expect(h.intent!.coreCast?.mode).toBe('refined');combat(gs,T0+301);expect(HAZ[0]).toMatchObject({effect:'meteorBurn',owner:h.actorId,victim:a.id});
  const hp=a.hp;tickHaz(gs,BAL.creatorCoreMeteor.tellMs-1,T0+1050);expect(a.hp).toBe(hp);tickHaz(gs,1,T0+1051);expect(a.hp).toBeLessThan(hp);
  const pool=HAZ.find(q=>q.effect==='meteorPool');expect(pool).toMatchObject({coreUid:slots[0].uid,owner:h.actorId,victim:a.id});
  const loaded=validate(JSON.parse(JSON.stringify(gs)))!;expect(loaded).not.toBeNull();bindCombat(loaded.run!);const after=loaded.run!.creatures.find(m=>m.id===a.id)!;
  const hit=after.hp;tickHaz(loaded,50,T0+1101);expect(after.hp).toBeLessThan(hit);
  expect([slots[1]?.qty,slots[2]?.qty,slots[3]?.qty]).toEqual([1,2,1]);expect(loaded.run!.receipts.filter(e=>e.kind==='human.core.commit')).toHaveLength(1);
});

describe('Dragon refined flight',()=>{
  function dragon(){
    const f=setup(), {slots}=f;
    slots[0]=mkStack(f.r,'core_dragon',1);slots[0].lvl=2;slots[0].dur=100;
    return {...f,dragon:slots[0]};
  }
  it('rechecks the whole corridor: a friend between the caster and a clear endpoint cancels for free',()=>{
    const {gs,h,friend,enemy,slots,dragon:core}=dragon();enemy.gx=h.gx+9;
    combat(gs,T0+1);expect(h.intent!.coreCast?.mode).toBe('refined');
    Object.assign(friend,{gx:h.gx+4,gy:h.gy,floor:0});combat(gs,T0+301);
    expect(PROJ).toHaveLength(0);expect(h.intent!.coreCast).toBeUndefined();
    expect([core.dur,slots[1]?.qty,h.stamina,core.cd?.refined]).toEqual([100,2,100,undefined]);
  });
  it('pays once for a travelling group attack and continues the same flight after reload',()=>{
    const {gs,r,h,x,y,enemy,slots,dragon:core}=dragon();enemy.floor=1;slots[3]=mkStack(r,'energy_basic',1);
    const a=mkCreature(r,'boar',x+6*TILE,y,500),b=mkCreature(r,'boar',x+7*TILE,y,500);a.state=b.state='chase';r.creatures=[a,b];h.intent!.target=a.id;
    combat(gs,T0+1);expect(h.intent!.coreCast?.mode).toBe('refined');combat(gs,T0+301);
    expect(PROJ[0]).toMatchObject({kind:'fire_tornado',from:'human',owner:h.actorId,coreUid:core.uid,victim:a.id,floor:0});
    expect([core.dur,slots[1]?.qty,slots[3]?.qty]).toEqual([94,1,1]);const hp=a.hp;
    for(let i=1;i<=12;i++)tickProj(gs,100,T0+301+i*100);
    expect(PROJ[0].x).toBeGreaterThan(x);expect(a.hp).toBe(hp);
    const saved=validate(JSON.parse(JSON.stringify(gs)))!;expect(saved).not.toBeNull();bindCombat(saved.run!);
    const reloaded=saved.run!.creatures.find(m=>m.id===a.id)!;
    for(let i=13;i<=23;i++)tickProj(saved,100,T0+301+i*100);
    expect(reloaded.hp).toBeLessThan(hp);expect(PROJ).toHaveLength(0);
    expect(saved.run!.receipts.filter(e=>e.kind==='human.core.commit')).toHaveLength(1);
  });
  it('finishes a committed island flight in Continue without damaging the absent player',()=>{
    const {gs,r,h,enemy,x,y}=dragon();combat(gs,T0+1);combat(gs,T0+301);
    // The player steps into the corridor after release and closes the game.
    r.player.x=x+4*TILE;r.player.y=y;const hp=r.player.hp,before=enemy.hp;
    const saved=validate(JSON.parse(JSON.stringify(gs)))!;settle(saved,T0+2500,true);
    expect(PROJ).toHaveLength(0);expect(saved.run!.player.hp).toBe(hp);
    expect(saved.run!.humanWorld!.people[enemy.actorId].hp).toBeLessThan(before);
    expect(saved.run!.receipts.filter(e=>e.kind==='human.core.commit' && e.detail.startsWith(h.actorId))).toHaveLength(1);
  });
  it('keeps a non-homing tornado loadable after its declared creature disappears',()=>{
    const {gs,r,h,enemy,x,y}=dragon();enemy.floor=1;const a=mkCreature(r,'boar',x+8*TILE,y,500);
    a.state='chase';r.creatures=[a];h.intent!.target=a.id;combat(gs,T0+1);combat(gs,T0+301);
    expect(PROJ[0].victim).toBe(a.id);r.creatures=[];const saved=validate(JSON.parse(JSON.stringify(gs)))!;
    expect(saved).not.toBeNull();bindCombat(saved.run!);tickProj(saved,50,T0+351);expect(PROJ[0].x).toBeGreaterThan(x);
  });
  it('preserves the player refined cast, including its muzzle offset, cost and projectile speed',()=>{
    const {gs,r,h,x,y}=dragon();h.intent=undefined;h.state='IDLE';r.player.x=x;r.player.y=y;
    addItem(r,'inv','core_dragon',1);addItem(r,'inv','energy_refined',1);
    const inv=C(r,'inv').slots;r.player.active=inv.findIndex(s=>s?.key==='core_dragon');const core=inv[r.player.active]!;core.lvl=2;core.dur=100;
    for(let i=0;i<7;i++)tick(gs,{up:false,down:false,left:false,right:false,mx:x+6*TILE,my:y,roll:false,cancel:false,attack:false,attackPressed:false,skill:i===0?'refined':undefined},50,T0+i*50);
    expect(PROJ[0]).toMatchObject({kind:'fire_tornado',from:'player',coreUid:core.uid,vx:BAL.creatorCoreDragon.tornadoSpeed});
    expect(PROJ[0].x).toBeGreaterThanOrEqual(r.player.x+10);expect(core.dur).toBe(94);expect(inv.some(s=>s?.key==='energy_refined')).toBe(false);
  });
  it('cannot apply damage on a different floor after release',()=>{
    const {gs,r,enemy}=dragon();combat(gs,T0+1);combat(gs,T0+301);expect(PROJ).toHaveLength(1);
    const before=enemy.hp;enemy.floor=1;r.veyraFloor=1;tickProj(gs,2000,T0+2301);
    expect(enemy.hp).toBe(before);expect(PROJ).toHaveLength(0);
  });
});

describe('other combat modes share the owned Core release',()=>{
  it.each([['core_blast','fire'],['core_earthmother','nature'],['core_elsa','water'],['core_dragon','fire'],['core_meteor','fire']])('%s spends energy and matching essence once for a visible group', (key,element)=>{
    const {gs,r,h,enemy,slots,x,y}=setup();enemy.floor=1;r.player.x=16;r.player.y=16;
    const core=slots[0]=mkStack(r,key,1);core.lvl=3;core.dur=100;slots[2]=mkStack(r,'essence_'+element,2);
    const a=mkCreature(r,'boar',x+6*TILE,y,500),b=mkCreature(r,'boar',x+7*TILE,y,500);a.state=b.state='chase';r.creatures=[a,b];h.intent!.target=a.id;
    combat(gs,T0+1);expect(h.intent!.coreCast?.mode).toBe('signature');combat(gs,T0+301);combat(gs,T0+302);
    expect([slots[1]?.qty,slots[2]?.qty]).toEqual([1,1]);expect(core.cd?.signature).toBeGreaterThan(T0+302);
    if(key==='core_dragon'){expect(r.dragonDive).toMatchObject({owner:h.actorId,coreUid:core.uid,ids:[a.id,b.id]});expect(validate(JSON.parse(JSON.stringify(gs)))).not.toBeNull();}
    if(key==='core_earthmother'){expect(HAZ[0].effect).toBe('natureRoot');tickHaz(gs,100,T0+401);expect(a.hp).toBeLessThan(500);expect(a.rootedUntil).toBeGreaterThan(T0+401);}
    if(key==='core_elsa'){expect(a.frozenUntil).toBe(T0+301+BAL.creatorCoreElsa.enemyMs);expect(b.frozenUntil).toBe(a.frozenUntil);expect(r.player.iceUntil).toBeFalsy();}
    if(key==='core_meteor'){expect(HAZ).toHaveLength(BAL.creatorCoreMeteor.stormCount);expect(HAZ.every(q=>q.owner===h.actorId && q.floor===h.floor && q.coreUid===core.uid)).toBe(true);}
    if(key==='core_blast'){expect(PROJ[0].kind).toBe('blast_signature');for(let i=1;i<=15;i++)tickProj(gs,50,T0+301+i*50);expect(a.hp).toBeLessThan(500);expect(HAZ.some(q=>q.effect==='blastTrail'&&q.owner===h.actorId&&q.coreUid===core.uid)).toBe(true);}
  });
  it('retains ownership on every paid bomb fragment; a nearby friend cancels before the fuse starts',()=>{
    const {gs,r,h,friend,enemy,slots}=setup();const core=slots[0]=mkStack(r,'core_blast',1);core.lvl=2;core.dur=100;enemy.gx=h.gx+7;
    combat(gs,T0+1);expect(h.intent!.coreCast?.mode).toBe('refined');Object.assign(friend,{gx:enemy.gx+1,gy:h.gy,floor:0});combat(gs,T0+301);expect(core.dur).toBe(100);expect(PROJ).toHaveLength(0);
    friend.floor=1;combat(gs,T0+302);combat(gs,T0+602);for(let i=1;i<=24;i++)tickProj(gs,50,T0+602+i*50);
    expect(PROJ).toHaveLength(BAL.creatorCoreBlast.fragmentCount);expect(PROJ.every(q=>q.kind==='blast_round'&&q.owner===h.actorId&&q.from==='human'&&q.coreUid===core.uid)).toBe(true);
  });
  it.each(['core_elsa','core_demon'])('%s binds a defensive cast to the caster and observes interruption/expiry',key=>{
    const {gs,r,h,enemy,slots}=setup();const core=slots[0]=mkStack(r,key,1);core.lvl=2;core.dur=100;enemy.gx=h.gx+(key==='core_elsa'?1:6);
    combat(gs,T0+1);combat(gs,T0+301);expect(slots[1]?.qty).toBe(1);expect(core.cd?.refined).toBeGreaterThan(T0+301);
    const hp=h.hp;
    if(key==='core_elsa'){expect(h.iceUntil).toBe(T0+301+BAL.creatorCoreElsa.selfMs);expect(applyDamage(r,r.humanWorld!,h,3,0,T0+401,'enemy')).toBe(false);expect(h.hp).toBe(hp);expect(applyDamage(r,r.humanWorld!,h,3,0,h.iceUntil!,'enemy')).toBe(true);}
    else{expect(h.channelUntil).toBe(T0+301+BAL.creatorCoreDemon.beamMs);expect(HAZ[0].effect).toBe('spiritBeam');const before=enemy.hp;applyDamage(r,r.humanWorld!,h,3,0,T0+401,'enemy');tickHaz(gs,100,T0+401);expect(HAZ).toHaveLength(0);expect(enemy.hp).toBe(before);}
  });
});

describe('utility casts are physical commitments, not instant attacks',()=>{
  it('plants all ten trees or none, and cannot debit when the grove capacity changes during windup',()=>{
    const {gs,r,h,enemy,slots}=setup(),o=r.sourceMap!.veyra!.originAu;
    const grid=blockGrid(r);let found=false;
    for(let y=20;y<150&&!found;y+=3)for(let x=25;x<150&&!found;x+=3){
      if(!grid.slice(y*WW+x,y*WW+x+8).every(v=>!v))continue;
      const body={x:(x+.5)*TILE,y:(y+.5)*TILE},ax=body.x+7*TILE;
      if(groveCells(r,ax,body.y,body).length!==10 || !clearPhysicalLine(r,body,{x:ax,y:body.y},true))continue;
      Object.assign(h,{gx:o[0]*2+x,gy:o[1]*2+y});Object.assign(enemy,{gx:h.gx+7,gy:h.gy});found=true;
    }
    expect(found).toBe(true);const core=slots[0]=mkStack(r,'core_earthmother',1);core.lvl=2;core.dur=100;
    combat(gs,T0+1);expect(h.intent!.coreCast?.mode).toBe('refined');r.natureTrees=Array.from({length:95},()=>({tx:1,ty:1,until:90000}));combat(gs,T0+301);
    expect(slots[1]?.qty).toBe(2);expect(core.dur).toBe(100);r.natureTrees=[];combat(gs,T0+401);combat(gs,T0+701);
    expect(r.natureTrees).toHaveLength(10);expect(new Set(r.natureTrees.map(t=>t.tx+','+t.ty)).size).toBe(10);expect(slots[1]?.qty).toBe(1);
  });
  it.each([false,true])('a wounded Demon caster pays to retreat to observed land; occupied at arrival: %s',blocked=>{
    const {gs,r,h,enemy,slots,friend}=setup(),o=r.sourceMap!.veyra!.originAu;h.hp=h.maxHp*.3;
    const grid=blockGrid(r);let found=false;
    for(let y=20;y<155&&!found;y+=2)for(let x=12;x<150&&!found;x+=2){
      if(!grid.slice(y*WW+x-5,y*WW+x+7).every(v=>!v))continue;
      const body={x:(x+.5)*TILE,y:(y+.5)*TILE,owner:h.actorId};
      if(spiritDestination(r,body.x-4*TILE,body.y,body)||!clearPhysicalLine(r,body,{x:body.x+5*TILE,y:body.y},true))continue;
      Object.assign(h,{gx:o[0]*2+x,gy:o[1]*2+y});Object.assign(enemy,{gx:h.gx+5,gy:h.gy});found=true;
    }
    expect(found).toBe(true);const core=slots[0]=mkStack(r,'core_demon',1);core.lvl=3;core.dur=100;slots[2]=mkStack(r,'essence_spirit',2);const from=h.gx;
    combat(gs,T0+1);expect(h.intent!.coreCast?.mode).toBe('signature');combat(gs,T0+301);expect(h.gx).toBe(from);const trip=h.spiritStep!;expect(trip.gx).toBeLessThan(from);
    if(blocked)Object.assign(friend,{gx:trip.gx,gy:trip.gy,floor:0});const loaded=validate(JSON.parse(JSON.stringify(gs)))!;expect(loaded).not.toBeNull();const hw=loaded.run!.humanWorld!,body=hw.people[h.actorId];
    stepHumans(loaded.run!,hw,trip.arriveAt);expect(body.gx).toBe(blocked?from:trip.gx);expect(body.spiritStep).toBeUndefined();
    expect(loaded.run!.receipts.filter(e=>e.kind===(blocked?'core.spirit.abort':'core.spirit.arrive')&&e.detail===core.uid)).toHaveLength(1);expect([slots[1]?.qty,slots[2]?.qty]).toEqual([1,1]);
  });
});

it('attributes witnessed defense to the actual player contact, not a nearby guard or remote player',()=>{
  const {gs,r,h,x,y}=setup();r.player.x=x+3*TILE;r.player.y=y;h.trust=50;
  const attack=(byPlayer:boolean)=>{const m=mkCreature(r,'boar',x+TILE,y,5);r.creatures=[m];applyDamage(r,r.humanWorld!,h,3,0,T0+1,'enemy',m.id,0);damageCreature(gs,m,10,0,T0+5,0,byPlayer?undefined:'other-guard',byPlayer);};
  attack(false);expect(h.trust).toBe(50);r.player.x+=10*TILE;attack(true);expect(h.trust).toBe(50);
  r.player.x=x+3*TILE;attack(true);expect(h.trust).toBe(53);attack(true);expect(h.trust).toBe(53);expect(r.receipts.filter(e=>e.kind==='human.defense.seen')).toHaveLength(1);
});
