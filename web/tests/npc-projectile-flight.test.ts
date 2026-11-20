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
import { PROJ, spawnHumanShot, tickProj } from '../src/game/sim';

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
    expect([ammo(),victim.hp,shooter.stamina,shooter.equip.weapon!.dur,shooter.lastAttackAt]).toEqual([before,hpBefore,100,3,0]);
    shoot(at);
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
 const cast=(ms:number)=>stepHumanCombat(r,hw,T0+ms,undefined,undefined,undefined,p=>PROJ.push(p));
 cast(1);expect(h.intent.coreCast).toBeUndefined();pack.slots[1]=mkStack(r,'energy_basic',2);cast(2);expect(h.intent.coreCast?.uid).toBe(core.uid);
 pack.slots[0]=null;cast(190);expect(PROJ).toHaveLength(0);expect(core.dur).toBe(120);pack.slots[0]=core;
 cast(200);cast(381);cast(382);expect(PROJ).toHaveLength(1);expect(PROJ[0]).toMatchObject({kind:'elsa_shard',from:'human',owner:h.actorId,victim:'player',coreUid:core.uid});
 expect(pack.slots[1]?.qty).toBe(1);expect(r.custody.inv.slots[0]?.qty).toBe(12);expect(core.dur).toBeLessThan(120);expect(core.cd?.basic).toBeGreaterThan(T0+381);
 const hp=r.player.hp;tickProj(gs,150,T0+531);expect(r.player.hp).toBeLessThan(hp);expect(PROJ).toHaveLength(0);
});
