/**
 * SURVIVOR PROJECTILE FLIGHT — the arrow leaves the body.
 *
 * Law under test: a bow-armed survivor's committed attack spends one OWNED arrow and creates a
 * projectile; the victim takes damage only when that arrow lands, exactly once — and a shot with no
 * arrow in the pack never happens at all. Nothing here teleports damage onto a body.
 */
import { describe, expect, it } from 'vitest';
import { HOUR, TILE, WW, type GameState } from '../src/game/core';
import { newGame, startRun, addStack, mkStack } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { T0 } from './helpers/g1b-kit';
import { stepHumanCombat, humanPack, type HumanRecord } from '../src/game/humanworld';
import { validate } from "../src/game/persist";
import { bindCombat, settle, HAZ, tickHaz, PROJ, releaseBasicCore, spawnHumanShot, tickProj } from '../src/game/sim';

function runAt(ax = 921, ay = 259, seed = 7606): GameState {
  const [gtx, gty] = auToTile(ax, ay);
  const win = windowAround(gtx, gty);
  setActiveLayout(layoutIdAt(win.originTx, win.originTy));
  const gs = newGame();
  const lx = Math.max(8, Math.min(WW - 9, gtx - win.originTx));
  const ly = Math.max(8, Math.min(WW - 9, gty - win.originTy));
  expect(startRun(gs, 'female', T0, null, seed, { tx: lx, ty: ly }).ok).toBe(true);
  return gs;
}

describe('survivor projectile flight', () => {
  it('a bow shot flies, spends one owned arrow, and hurts the victim only on impact', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const o = r.sourceMap!.veyra!.originAu;
    const ox = Math.round(o[0] / 0.5), oy = Math.round(o[1] / 0.5);
    const people = Object.values(hw.people);
    const shooter: HumanRecord = people[0], victim: HumanRecord = people[1];
    for (const h of people.slice(2)) { h.state = 'IDLE'; h.gx = ox + 150; h.gy = oy + 150; }
    shooter.state = 'FIGHTING'; shooter.floor = 0; shooter.gx = ox + 40; shooter.gy = oy + 20; shooter.stamina = 100;
    shooter.equip.weapon = { uid: 'qa-flight-bow', key: 'bow', qty: 1 } as any;
    victim.state = 'IDLE'; victim.floor = 0; victim.gx = ox + 41; victim.gy = oy + 20;
    victim.community = undefined;
    shooter.community = undefined; shooter.protectedPeople = [];
    shooter.intent = { intentId: 'qa-flight', actorId: shooter.actorId, kind: 'fight', target: victim.actorId, preconditions: [], reserved: [], startAt: T0, dueAt: T0 };
    shooter.dir = 2; shooter.lastAttackAt = 0;            // face east (+x), ready to loose
    addStack(r, humanPack(r, shooter).id, mkStack(r, 'arrow', 2));
    PROJ.length = 0;
    const hpBefore = victim.hp;
    const at = T0 + HOUR;
    const shoot = (t: number) => stepHumanCombat(r, hw, t, undefined, undefined, (s) => spawnHumanShot(gs, s));
    const ammo=()=>humanPack(r,shooter).slots.reduce((n,s)=>n+(s?.key==='arrow'?s.qty:0),0);
    const before=ammo();shooter.equip.weapon!.dur=3;
    stepHumanCombat(r,hw,at,undefined,undefined,()=>false);
    const release=shooter.intent!.swing!.contactAt;
    stepHumanCombat(r,hw,release,undefined,undefined,()=>false);
    expect(shooter.intent!.swing).toBeUndefined();
    expect([ammo(),victim.hp,shooter.stamina,shooter.equip.weapon!.dur,shooter.lastAttackAt]).toEqual([before,hpBefore,100,3,0]);
    shoot(release+1);expect(PROJ).toHaveLength(0);
    shoot(shooter.intent!.swing!.contactAt);
    expect(ammo()).toBe(before-1);expect(shooter.equip.weapon!.dur).toBe(2);
    const arrows = PROJ.filter(p => p.from === 'human');
    expect(arrows).toHaveLength(1);
    expect(arrows[0].owner).toBe(shooter.actorId);
    expect(arrows[0].victim).toBe(victim.actorId);
    expect(victim.hp).toBe(hpBefore);                   // nothing lands until it lands
    // Fly it.
    let steps = 0;
    while (PROJ.some(p => p.from === 'human') && steps < 60) tickProj(gs, 50, at + 50 * (++steps));
    expect(PROJ.filter(p => p.from === 'human')).toHaveLength(0);
    expect(victim.hp).toBeLessThan(hpBefore);
    const landed = victim.hp;
    tickProj(gs, 50, at + 50 * (steps + 1));            // re-stepping applies nothing twice
    expect(victim.hp).toBe(landed);
  });

  it('a bow with no arrow in the pack never fires and never hurts anyone', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const o = r.sourceMap!.veyra!.originAu;
    const ox = Math.round(o[0] / 0.5), oy = Math.round(o[1] / 0.5);
    const people = Object.values(hw.people);
    const shooter: HumanRecord = people[0], victim: HumanRecord = people[1];
    for (const h of people.slice(2)) { h.state = 'IDLE'; h.gx = ox + 150; h.gy = oy + 150; }
    shooter.state = 'FIGHTING'; shooter.floor = 0; shooter.gx = ox + 40; shooter.gy = oy + 20; shooter.stamina = 100;
    shooter.equip.weapon = { uid: 'qa-flight-bow2', key: 'bow', qty: 1 } as any;
    shooter.community = undefined; shooter.protectedPeople = [];
    victim.state = 'IDLE'; victim.floor = 0; victim.gx = ox + 41; victim.gy = oy + 20; victim.community = undefined;
    shooter.intent = { intentId: 'qa-flight2', actorId: shooter.actorId, kind: 'fight', target: victim.actorId, preconditions: [], reserved: [], startAt: T0, dueAt: T0 };
    shooter.dir = 2; shooter.lastAttackAt = 0;
    // No arrows anywhere in the shooter's pack.
    for (const s of humanPack(r, shooter).slots) if (s?.key === 'arrow') humanPack(r, shooter).slots[humanPack(r, shooter).slots.indexOf(s)] = null;
    PROJ.length = 0;
    const hpBefore = victim.hp;
    stepHumanCombat(r, hw, T0 + HOUR, undefined, undefined, (s) => spawnHumanShot(gs, s));
    expect(PROJ.filter(p => p.from === 'human')).toHaveLength(0);
    expect(victim.hp).toBe(hpBefore);
  });
});
it('a survivor winds up the actual Core, cannot borrow player energy, and commits only the same UID at contact',()=>{
 const gs=runAt(),r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people)[0],o=r.sourceMap!.veyra!.originAu;
 h.floor=0;h.gx=o[0]*2+40;h.gy=o[1]*2+20;h.state='FIGHTING';h.equip.weapon=null;h.stamina=100;
 r.player.x=41.5*TILE;r.player.y=20.5*TILE;r.creatures=[];
 h.intent={intentId:'watch',actorId:h.actorId,kind:'fight',target:'player',reserved:[],preconditions:[],startAt:T0,dueAt:T0};
 const pack=humanPack(r,h),core=mkStack(r,'core_elsa',1);pack.slots.fill(null);pack.slots[0]=core;core.dur=120;
 r.custody.inv.slots[0]=mkStack(r,'energy_basic',12);PROJ.length=0;
 const cast=(ms:number)=>stepHumanCombat(r,hw,T0+ms,undefined,undefined,undefined,c=>releaseBasicCore(gs,c,T0+ms));
 cast(1);expect(h.intent.coreCast).toBeUndefined();pack.slots[1]=mkStack(r,'energy_basic',2);cast(2);expect(h.intent.coreCast?.uid).toBe(core.uid);
 pack.slots[0]=null;cast(190);expect(PROJ).toHaveLength(0);expect(core.dur).toBe(120);pack.slots[0]=core;
 cast(200);cast(381);cast(382);expect(PROJ).toHaveLength(1);expect(PROJ[0]).toMatchObject({kind:'elsa_shard',from:'human',owner:h.actorId,victim:'player',coreUid:core.uid});
 expect(pack.slots[1]?.qty).toBe(1);expect(r.custody.inv.slots[0]?.qty).toBe(12);expect(core.dur).toBeLessThan(120);expect(core.cd?.basic).toBeGreaterThan(T0+381);
 const hp=r.player.hp;tickProj(gs,150,T0+531);expect(r.player.hp).toBeLessThan(hp);expect(PROJ).toHaveLength(0);
});

it.each(['core_blast','core_earthmother','core_meteor','core_dragon','core_mjolnir','core_demon'])(
 '%s: a paid basic cast hits one human once, attributed to the caster and not the player',key=>{
  const gs=runAt(),r=gs.run!,hw=r.humanWorld!,[caster,victim,...others]=Object.values(hw.people),o=r.sourceMap!.veyra!.originAu;
  for(const h of others)h.state='DEAD';r.creatures=[];r.player.x=100*TILE;r.player.y=100*TILE;
  caster.state='FIGHTING';caster.floor=0;caster.gx=o[0]*2+40;caster.gy=o[1]*2+20;caster.stamina=100;caster.community=undefined;caster.protectedPeople=[];caster.equip.weapon=null;
  victim.gx=caster.gx+1;victim.gy=caster.gy;victim.floor=0;victim.state='IDLE';victim.equip.weapon=null;victim.hp=victim.maxHp=500;
  caster.intent={intentId:'core',kind:'fight',actorId:caster.actorId,target:victim.actorId,preconditions:[],reserved:[],startAt:T0,dueAt:T0};
  const slots=humanPack(r,caster).slots;slots.fill(null);const core=mkStack(r,key,1),energy=mkStack(r,'energy_basic',2);slots[0]=core;slots[1]=energy;PROJ.length=0;HAZ.length=0;
  const cast=(t:number)=>stepHumanCombat(r,hw,t,undefined,undefined,undefined,c=>releaseBasicCore(gs,c,t));
  cast(T0+1);const commit=caster.intent!.coreCast!.readyAt;cast(commit-1);expect([energy.qty,victim.hp]).toEqual([2,500]);cast(commit);
  expect(energy.qty).toBe(1);expect(core.cd!.basic).toBeGreaterThan(commit);
  if(key==='core_dragon')expect(HAZ[0]).toMatchObject({owner:caster.actorId,coreUid:core.uid});
  else if(key!=='core_mjolnir')expect(PROJ[0]).toMatchObject({owner:caster.actorId,coreUid:core.uid});
  for(let i=1;i<=8;i++){tickProj(gs,50,commit+i*50);tickHaz(gs,50,commit+i*50);}
  expect(victim.hp).toBeLessThan(500);expect(Object.values(hw.incidents).filter(e=>e.victim===victim.actorId&&e.aggressor===caster.actorId)).toHaveLength(1);
  expect(Object.values(hw.incidents).some(e=>e.aggressor==='player')).toBe(false);
 });

it('a saved melee windup keeps its weapon and direction: stepping behind dodges it; a replacement weapon cannot finish it',()=>{
 const gs=runAt(),r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people)[0],o=r.sourceMap!.veyra!.originAu;
 h.state='FIGHTING';h.floor=0;h.gx=o[0]*2+40;h.gy=o[1]*2+20;h.stamina=100;h.equip.weapon=mkStack(r,'knife',1);
 r.player.x=41.5*TILE;r.player.y=20.5*TILE;r.creatures=[];h.intent={intentId:'swing',actorId:h.actorId,kind:'fight',target:'player',preconditions:[],reserved:[],startAt:T0,dueAt:T0};
 let hits=0;stepHumanCombat(r,hw,T0+1,undefined,()=>hits++);const pending=h.intent.swing!;expect(hits).toBe(0);
 const loaded=validate(JSON.parse(JSON.stringify(gs)))!.run!,world=loaded.humanWorld!,attacker=world.people[h.actorId];expect(attacker.intent?.swing).toEqual(pending);
 const strike=(t:number)=>stepHumanCombat(loaded,world,t,undefined,()=>hits++);
 loaded.player.x=39.5*TILE;strike(pending.contactAt);expect(hits).toBe(0);expect(attacker.intent?.swing).toBeUndefined();
 loaded.player.x=41.5*TILE;strike(attacker.attackReadyAt!);const second=attacker.intent!.swing!;attacker.equip.weapon=mkStack(loaded,'wood_club',1);const dur=attacker.equip.weapon.dur;
 strike(second.contactAt);expect(hits).toBe(0);expect(attacker.equip.weapon.dur).toBe(dur);expect(attacker.intent!.swing).toBeUndefined();
 strike(second.contactAt+1);const third=attacker.intent!.swing!;strike(third.contactAt);strike(third.contactAt);expect(hits).toBe(1);expect(attacker.equip.weapon.dur).toBe(dur!-1);
});

it('Continue resolves a committed survivor shot against an island body, but drops a shot aimed at the absent player',()=>{
 const gs=runAt(),r=gs.run!,hw=r.humanWorld!,[caster,victim]=Object.values(hw.people),o=r.sourceMap!.veyra!.originAu;bindCombat(r);r.creatures=[];
 Object.assign(caster,{gx:o[0]*2+40,gy:o[1]*2+20,floor:0});Object.assign(victim,{gx:caster.gx+1,gy:caster.gy,floor:0});
 const shot={shooterId:caster.actorId,gx:caster.gx,gy:caster.gy,tx:41.5*TILE,ty:20.5*TILE,dmg:5};
 spawnHumanShot(gs,{...shot,victim:'player'});spawnHumanShot(gs,{...shot,victim:victim.actorId});const hp=r.player.hp,before=victim.hp;
 const loaded=validate(JSON.parse(JSON.stringify(gs)))!;settle(loaded,T0+200,true);const after=loaded.run!;
 expect(after.player.hp).toBe(hp);expect(after.humanWorld!.people[victim.actorId].hp).toBeLessThan(before);expect(PROJ).toHaveLength(0);
 expect(after.receipts.find(e=>e.kind==='offline.projectiles_cleared')?.detail).toBe('1');
});
