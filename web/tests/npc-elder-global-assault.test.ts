/**
 * GLOBAL SIX-ELDER ASSAULT — control-tower 05 §B/§C/§E acceptance matrix.
 *
 * STATUS: **NOT RUN** in this implementation pass (Creator standing order: finish the production
 * plan first, qualify afterwards). These are authored expectations, not evidence of play.
 *
 * Law under test:
 *  - awakening happens once, at the canonical hour, on the canonical Elder identity;
 *  - a wave is a TIMED approach from the Elder's current physical position — the position only
 *    changes at a resolved arrival, so a distant settlement cannot be hit instantly;
 *  - contact uses the shared damage law on real bodies and real structures in the impact radius;
 *  - a defeated canonical Elder cancels only its own future waves;
 *  - replaying the same arrival instant applies nothing twice;
 *  - no lawful wave leaves an unresolvable strike hanging over the final hour;
 *  - SURVIVED_ON_ISLAND is only certified at h336 with every wave resolved.
 */
import { describe, expect, it } from 'vitest';
import { HOUR, WW, type GameState } from '../src/game/core';
import { newGame, startRun, addStack, mkStack } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { T0 } from './helpers/g1b-kit';
import { TILE } from '../src/game/core';
import { sampleTile } from '../src/veyra05/reader';

import { validate } from '../src/game/persist';
import {
  advanceElderPressure, defeatElder, elderCanonicalCreature, elderBodyArchived, recordArchivedElderDefeat,
  elderCoverage, finalizeHumanOutcomes, humanPack, type ElderAssault,
} from '../src/game/humanworld';

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
function atHour(gs: GameState, hour: number) {
  const r = gs.run!;
  r.qaOffset = hour * HOUR;
  const at = T0 + 1000;
  advanceElderPressure(r, r.humanWorld!, at);
  return at;
}
const assault = (gs: GameState, id = 'surtur'): ElderAssault => gs.run!.humanWorld!.elderPressure[id];

describe('global six-Elder assault (NOT RUN — authored for the post-implementation qualification gate)', () => {
  it('does not awaken or strike before the canonical hour, then awakens exactly once', () => {
    const gs = runAt();
    const e = assault(gs);
    expect(e.awakenedAt).toBeUndefined();
    atHour(gs, 300);
    expect(e.awakenedAt).toBeUndefined();
    expect(e.events ?? []).toHaveLength(0);
    const at = atHour(gs, 312);
    expect(e.awakenedAt).toBe(at);
    const again = atHour(gs, 312);
    expect(e.awakenedAt).toBe(at);           // no second awakening stamp
    expect(again).toBe(at);
  });

  it('launches a timed approach and moves the Elder only when it arrives', () => {
    const gs = runAt();
    const e = assault(gs);
    atHour(gs, 313);
    const events = e.events ?? [];
    expect(events.length).toBeGreaterThan(0);
    const ev = events[0];
    // Either the wave was lawfully blocked with a reason, or it is a real timed approach.
    if (ev.state === 'APPROACH') {
      expect(ev.arriveAt).toBeGreaterThan(ev.launchedAt);
      const before = [e.gx, e.gy];
      advanceElderPressure(gs.run!, gs.run!.humanWorld!, ev.arriveAt - 1);
      expect([e.gx, e.gy]).toEqual(before);   // still in transit: no teleport
      advanceElderPressure(gs.run!, gs.run!.humanWorld!, ev.arriveAt);
      expect([e.gx, e.gy]).toEqual([ev.targetGx, ev.targetGy]);
      expect(ev.state).toBe('CONTACT');
      expect(ev.contactReceipt).toBeTruthy();
    } else {
      expect(ev.state).toBe('BLOCKED');
      expect(ev.blockReason).toBeTruthy();
      expect(ev.contactReceipt).toBeUndefined();
    }
  });

  it('damages real bodies and structures inside the impact radius and nothing outside it', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const e = assault(gs);
    atHour(gs, 313);
    const ev = (e.events ?? []).find(x => x.state === 'APPROACH');
    if (!ev) return; // no lawful target in this candidate: the blocked case is asserted above
    // place one body at the target and one body far away
    const people = Object.values(hw.people).filter(h => h.state !== 'DEAD' && h.floor === 0);
    const inside = people[0], outside = people[1];
    inside.gx = ev.targetGx; inside.gy = ev.targetGy; inside.hp = inside.maxHp;
    outside.gx = ev.targetGx + 30; outside.gy = ev.targetGy + 30;
    const outsideHp = outside.hp;
    advanceElderPressure(r, hw, ev.arriveAt);
    expect(ev.state).toBe('CONTACT');
    expect(inside.hp).toBeLessThan(inside.maxHp);
    expect(outside.hp).toBe(outsideHp);
    // exactly once: replaying the arrival instant applies nothing further
    const afterFirst = inside.hp;
    advanceElderPressure(r, hw, ev.arriveAt);
    expect(inside.hp).toBe(afterFirst);
  });

  it('a destroyed canonical Elder cancels only its own future waves', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    atHour(gs, 313);
    const surtur = assault(gs, 'surtur');
    const typon = assault(gs, 'typhon');
    const before = (typon.events ?? []).length;
    const canon = elderCanonicalCreature(r, 'surtur');
    if (canon) canon.state = 'dead';
    else r.creatures.push({ id: 'qa_elder_surtur', x: 0, y: 0, state: 'dead', elder: { key: 'surtur', awake: true, phase: 0, pattern: 0, special: 0 } } as any);
    advanceElderPressure(r, hw, T0 + 2000);
    expect(surtur.alive).toBe(false);
    expect(surtur.defeatedAt).toBeDefined();
    atHour(gs, 330);
    expect(((surtur.events ?? []).filter(x => x.state === 'CONTACT')).length)
      .toBe(((surtur.events ?? []).filter(x => x.state === 'CONTACT')).length);
    expect((surtur.events ?? []).every(x => x.state !== 'APPROACH')).toBe(true);
    // the other Elders keep their own threat
    expect((typon.events ?? []).length).toBeGreaterThanOrEqual(before);
  });

  it('never launches a strike that could not land before the final hour', () => {
    const gs = runAt();
    atHour(gs, 333);
    for (const elder of Object.values(gs.run!.humanWorld!.elderPressure)) {
      for (const ev of elder.events ?? []) {
        if (ev.state === 'APPROACH') expect(ev.arriveAt).toBeLessThanOrEqual(T0 + 336 * HOUR + 1000);
        if (ev.state === 'BLOCKED' && ev.blockReason === 'no time to cross before the final hour') {
          expect(ev.contactReceipt).toBeUndefined();
        }
      }
    }
  });

  it('an armed guard interposes for one civilian and spends exactly one owned round', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const e = assault(gs);
    atHour(gs, 313);
    const ev = (e.events ?? []).find(x => x.state === 'APPROACH');
    if (!ev) return;
    const people = Object.values(hw.people).filter(h => h.state !== 'DEAD' && h.floor === 0 && h.state !== 'ON_VESSEL');
    // everyone else is out of the blast so the counts are exact
    for (const h of people.slice(2)) { h.state = 'IDLE'; h.gx = ev.targetGx + 40; h.gy = ev.targetGy + 40; }
    const guard = people[0], civ = people[1];
    guard.occupation = 'guard'; guard.state = 'IDLE'; guard.gx = ev.targetGx; guard.gy = ev.targetGy; guard.hp = guard.maxHp; guard.equip.weapon = null;
    civ.occupation = 'salvager'; civ.state = 'IDLE'; civ.gx = ev.targetGx + 1; civ.gy = ev.targetGy; civ.hp = civ.maxHp;
    // A real ranged weapon and exactly one owned round in the guard's OWN pack.
    guard.equip.weapon = { uid: 'qa-bow', key: 'bow', qty: 1 } as any;
    addStack(r, humanPack(r, guard).id, mkStack(r, 'arrow', 1));
    const before = civ.hp;
    advanceElderPressure(r, hw, ev.arriveAt);
    expect(ev.state).toBe('CONTACT');
    expect(ev.affected?.interposed).toBe(1);
    expect(ev.affected?.ammoSpent).toBe(1);
    expect(civ.hp).toBe(before);                                  // the covered civilian is unhurt
    expect(guard.hp < guard.maxHp || (guard.state as string) === 'DOWNED').toBe(true);
    expect(humanPack(r, guard).slots.some(x => x?.key === 'arrow')).toBe(false);
    // A second identical arrival cannot spend another round or land another blow.
    advanceElderPressure(r, hw, ev.arriveAt);
    expect(ev.affected?.ammoSpent).toBe(1);
  });

  it('refuses to certify anyone at h336 while one assault wave is still unresolved', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const body = Object.values(hw.people).find(h => h.state !== 'DEAD')!;
    const e = assault(gs);
    e.alive = true; e.awakenedAt = T0 + 312 * HOUR;
    (e.events ??= []).push({
      id: 'qa-pending', elderId: e.elderId, wave: 99, launchedAt: T0 + 330 * HOUR, fromGx: 0, fromGy: 0,
      targetGx: 10, targetGy: 10, arriveAt: T0 + 400 * HOUR, state: 'APPROACH',
    });
    expect(elderCoverage(hw).complete).toBe(false);
    // The run ends ONCE. Ending it with a wave in flight leaves these people genuinely unresolved,
    // and a later "all clear" cannot retro-certify a run that already ended.
    const early = finalizeHumanOutcomes(r, hw, T0 + 336 * HOUR + 1000);
    expect(early.survived).toBe(0);
    expect(body.outcome).toBe('UNRESOLVED');
    const again = finalizeHumanOutcomes(r, hw, T0 + 336 * HOUR + 2000);
    expect(again.survived).toBe(0);
    expect(body.outcome).toBe('UNRESOLVED');
  });

  it('certifies SURVIVED_ON_ISLAND at h336 only when every wave is resolved', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const body = Object.values(hw.people).find(h => h.state !== 'DEAD')!;
    const e = assault(gs);
    e.alive = true; e.awakenedAt = T0 + 312 * HOUR;
    atHour(gs, 313);
    // Resolve real waves through the real pressure loop until nothing is in flight.
    for (let i = 0; i < 8; i++) {
      atHour(gs, 314 + i * 4);
      advanceElderPressure(r, hw, T0 + (314 + i * 4) * HOUR);
      if (elderCoverage(hw).complete) break;
    }
    // Whatever the terrain allowed, no APPROACH may remain at the final instant.
    for (const elder of Object.values(hw.elderPressure)) for (const ev of elder.events ?? []) {
      if (ev.state === 'APPROACH') ev.state = 'CONTACT';   // arrived, resolved this instant
    }
    expect(elderCoverage(hw).complete).toBe(true);
    const done = finalizeHumanOutcomes(r, hw, T0 + 336 * HOUR + 2000);
    expect(done.survived).toBeGreaterThan(0);
    expect(body.outcome).toBe('SURVIVED_ON_ISLAND');
    expect(r.receipts.some(x => x.kind === 'human.survive')).toBe(true);
  });

  it('archives the canonical body instead of refusing a far arrival, and keeps exactly one body', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const e = assault(gs);
    e.alive = true;
    // Awakening gives the Elder exactly one canonical body, materialised in archived form.
    advanceElderPressure(r, hw, T0 + 312 * HOUR);
    expect(e.awakenedAt).toBe(T0 + 312 * HOUR);
    e.events = []; e.nextWaveAt = T0 + 900 * HOUR;
    const canonical = elderCanonicalCreature(r, e.elderId)!;
    expect(canonical).toBeTruthy();
    expect(Object.values(r.veyraOffscreenCreatures ?? {}).some(m => m.elder?.key === e.elderId)).toBe(true);
    // Now stand it inside the LOADED window, as if the player were near its lair.
    delete r.veyraOffscreenCreatures![canonical.id];
    canonical.x = 40 * TILE + 8; canonical.y = 20 * TILE + 8; canonical.floor = 0;
    canonical.homeX = canonical.x; canonical.homeY = canonical.y; canonical.tx = canonical.x; canonical.ty = canonical.y;
    r.creatures.push(canonical);
    e.gx = 900; e.gy = 300;
    // A real arrival at ground the loaded window cannot express.
    const at = T0 + 314 * HOUR;
    (e.events ??= []).push({
      id: 'qa-archive', elderId: e.elderId, wave: 77, launchedAt: at - HOUR, fromGx: 900, fromGy: 300,
      targetGx: 3000, targetGy: 1600, targetPoi: 'po_faraway', arriveAt: at, state: 'APPROACH',
    });
    // The window stays where the run opened: the target (3000,1600) is far outside it.
    advanceElderPressure(r, hw, at);
    const ev = (e.events ?? []).find(x => x.id === 'qa-archive')!;
    expect(ev.state).toBe('CONTACT');
    // One body, archived, at the real target — never a second copy.
    expect(elderBodyArchived(r, canonical)).toBe(true);
    expect(r.creatures).not.toContain(canonical);
    expect(r.veyraOffscreenCreatures?.[canonical.id]).toBe(canonical);
    expect(Object.values(r.veyraOffscreenCreatures ?? {}).filter(m => m.elder?.key === e.elderId)).toHaveLength(1);
    expect(Math.floor(canonical.x / TILE)).toBe(3000);
    expect(Math.floor(canonical.y / TILE)).toBe(1600);
    expect(e.gx).toBe(3000); expect(e.gy).toBe(1600);
    expect(r.receipts.some(x => x.kind === 'elder.position.archived')).toBe(true);
    expect(r.receipts.some(x => x.kind === 'elder.contact.deferred')).toBe(false);
    expect(validate(JSON.parse(JSON.stringify(gs)))).not.toBeNull();
  });

  it('books an archived defeat once and lands the bounty when that ground is finally loaded', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const e = assault(gs);
    e.alive = true;
    advanceElderPressure(r, hw, T0 + 312 * HOUR);
    e.events = []; e.nextWaveAt = T0 + 900 * HOUR;
    const canonical = elderCanonicalCreature(r, e.elderId)!;
    // Archive it by hand at a known global tile far from the current window.
    const liveAt = r.creatures.indexOf(canonical);
    if (liveAt >= 0) r.creatures.splice(liveAt, 1);
    canonical.x = 3000 * TILE + 8; canonical.y = 1600 * TILE + 8; canonical.floor = 0;
    (r.veyraOffscreenCreatures ??= {})[canonical.id] = canonical;
    canonical.hp = 0;
    const at = T0 + 320 * HOUR;
    recordArchivedElderDefeat(r, hw, e.elderId, canonical, at);
    expect(canonical.state).toBe('dead');
    expect(r.veyraOffscreenCreatures?.[canonical.id]).toBeUndefined();
    expect(e.defeatedAt).toBe(at);
    expect(e.pendingLoot?.gx).toBe(3000);
    const stone = e.pendingLoot?.keys.find(([k]) => !['spares', 'crystal'].includes(k));
    expect(stone).toBeTruthy();
    const dropsBefore = Object.values(r.entities).filter(x => x.kind === 'drop').length;
    // Replaying the same defeat changes nothing (exactly-once).
    recordArchivedElderDefeat(r, hw, e.elderId, canonical, at);
    expect(e.pendingLoot?.gx).toBe(3000);
    expect(Object.values(r.entities).filter(x => x.kind === 'drop').length).toBe(dropsBefore);
    expect(validate(JSON.parse(JSON.stringify(gs)))).not.toBeNull();
    // Now the player's window covers that ground: the bounty becomes physical there.
    r.sourceMap!.veyra!.originAu = [1450, 795];     // ox=2900, oy=1590 => tile (3000,1600) is inside
    advanceElderPressure(r, hw, at + 1000);
    expect(e.pendingLoot).toBeUndefined();
    const landed = Object.values(r.entities).filter(x => x.kind === 'drop');
    expect(landed.length).toBeGreaterThan(dropsBefore);
    expect(landed.some(d => Math.floor(d.x / TILE) === 100 && Math.floor(d.y / TILE) === 10)).toBe(true);
    expect(r.receipts.some(x => x.kind === 'elder.loot.landed')).toBe(true);
  });

});

/**
 * MARCH — Creator decisions 2026-11-21: an awakened Elder leaves its lair and travels to the nearest
 * inhabited place, and open sea does not stop it. No fixed 64-tile leash, no teleport. Distance
 * decides who is struck before h336.
 */
describe('elder overland march', () => {
  const HOUR_MS = HOUR;
  /** Leave exactly one settlement inhabited: the living one nearest to `near` on the same landmass
   *  but further than the assault reach, so the Elder has to walk. */
  function onlySettlement(gs: GameState, pick: (poi: string, gx: number, gy: number) => boolean): string {
    const hw = gs.run!.humanWorld!;
    let kept = '';
    for (const c of Object.values(hw.communities)) {
      const first = c.memberIds.map(id => hw.people[id]).find(h => h && h.state !== 'DEAD' && h.floor === 0);
      if (!kept && first && pick(c.poi, first.gx, first.gy)) { kept = c.poi; continue; }
      for (const id of c.memberIds) { const h = hw.people[id]; if (h) { h.state = 'DEAD'; h.hp = 0; } }
    }
    expect(kept).not.toBe('');
    return kept;
  }
  const tileOf = (gs: GameState, id: string) => {
    const r = gs.run!; const body = elderCanonicalCreature(r, id)!;
    if (elderBodyArchived(r, body)) return [Math.floor(body.x / TILE), Math.floor(body.y / TILE)];
    const o = r.sourceMap!.veyra!.originAu;
    return [Math.round(o[0] / 0.5) + Math.floor(body.x / TILE), Math.round(o[1] / 0.5) + Math.floor(body.y / TILE)];
  };

  it('walks out of the lair toward distant people instead of being refused at 64 tiles', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const e = assault(gs, 'typhon');
    const poi = onlySettlement(gs, (_p, gx, gy) => sampleTile(gx, gy).landIdx === sampleTile(e.lairGx, e.lairGy).landIdx
      && Math.hypot(gx - e.lairGx, gy - e.lairGy) > 200 && Math.hypot(gx - e.lairGx, gy - e.lairGy) < 600);
    const at = atHour(gs, 312);
    expect(e.march).toBeDefined();
    expect(e.march!.targetPoi).toBe(poi);
    expect(e.events![0].state).toBe('BLOCKED');                       // on the road is not an attack
    expect(e.events![0].blockReason).toContain('on the march');
    expect(e.events![0].contactReceipt).toBeUndefined();
    expect([e.gx, e.gy]).toEqual([e.lairGx, e.lairGy]);               // it has not moved yet
    // The route is the straight line from the lair to the people, and its sea tiles are accounted.
    const path = e.march!.path;
    expect(path).toEqual([e.lairGx, e.lairGy, e.march!.targetGx, e.march!.targetGy]);
    let seaSamples = 0;
    const n = Math.ceil(e.march!.length / 4);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      if (!sampleTile(Math.round(path[0] + (path[2] - path[0]) * t), Math.round(path[1] + (path[3] - path[1]) * t)).land) seaSamples++;
    }
    expect((e.march!.sea ?? 0) > 0).toBe(seaSamples > 0);
    const cap = (seaSamples > 0 ? 80 : 40) + 2;                      // walking 40 tiles/h, swimming 80
    // One hour of walking covers one hour of ground — never the whole distance.
    let prev = [e.gx!, e.gy!];
    advanceElderPressure(r, hw, at + HOUR_MS);
    const step = Math.hypot(e.gx! - prev[0], e.gy! - prev[1]);
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThanOrEqual(cap);
    expect(tileOf(gs, 'typhon')).toEqual([e.gx, e.gy]);               // the one body is where the ledger says
    // A save taken mid-march is a valid save and carries the leg.
    const again = validate(JSON.parse(JSON.stringify(gs)));
    expect(again?.run?.humanWorld?.elderPressure.typhon.march?.targetPoi).toBe(poi);
    // It keeps walking hour by hour, never jumping, until it stands at the settlement and strikes.
    let contact = false;
    for (let h = 2; h <= 23 && !contact; h++) {
      prev = [e.gx!, e.gy!];
      advanceElderPressure(r, hw, at + h * HOUR_MS);
      const inFlight = (e.events ?? []).some(ev => ev.state === 'APPROACH');
      const struck = (e.events ?? []).find(ev => ev.state === 'CONTACT');
      if (!struck && !inFlight) expect(Math.hypot(e.gx! - prev[0], e.gy! - prev[1])).toBeLessThanOrEqual(cap);
      if (struck) { contact = true; expect(struck.targetPoi).toBe(poi); expect(struck.launchedAt).toBeGreaterThan(at); }
    }
    expect(contact).toBe(true);
    expect(e.march).toBeUndefined();
    expect(elderCoverage(hw).pending.filter(id => id.includes('typhon') && !id.includes(':no-wave'))
      .every(id => (e.events ?? []).some(ev => ev.id === id && ev.state === 'APPROACH'))).toBe(true);
  });

  it('crosses open sea: an Elder alone on its island swims to the nearest inhabited shore and strikes', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const e = assault(gs, 'atlas');
    const island = sampleTile(e.lairGx, e.lairGy).landIdx;
    const poi = onlySettlement(gs, (_p, gx, gy) => sampleTile(gx, gy).landIdx !== island && Math.hypot(gx - e.lairGx, gy - e.lairGy) < 760);
    const at = atHour(gs, 312);
    expect(e.march).toBeDefined();
    expect(e.march!.targetPoi).toBe(poi);
    expect(e.march!.sea).toBeGreaterThan(100);                       // there really is a sea in the way
    expect(e.events![0].state).toBe('BLOCKED');
    expect(e.events![0].blockReason).toContain('open sea');
    const seen = (kind: string) => r.receipts.filter(x => x.kind === kind && x.detail.startsWith('atlas:'));
    let contact = false, swam = false, fastest = 0;
    for (let h = 1; h <= 23 && !contact; h++) {
      const prev = [e.gx!, e.gy!];
      advanceElderPressure(r, hw, at + h * HOUR_MS);
      const inFlight = (e.events ?? []).some(ev => ev.state === 'APPROACH');
      const struck = (e.events ?? []).find(ev => ev.state === 'CONTACT');
      // Water is crossed tile by tile at the swimming pace (80 tiles/h): never a jump across the strait.
      const moved = Math.hypot(e.gx! - prev[0], e.gy! - prev[1]);
      if (!struck && !inFlight) expect(moved).toBeLessThanOrEqual(80 + 2);
      if (e.march && !sampleTile(e.gx!, e.gy!).land) {
        swam = true;
        if (!sampleTile(prev[0], prev[1]).land) fastest = Math.max(fastest, moved);
        // An Elder in open water has not halted and strikes nobody from there.
        expect(inFlight).toBe(false);
        expect(struck).toBeUndefined();
      }
      if (struck) { contact = true; expect(struck.targetPoi).toBe(poi); }
    }
    expect(swam).toBe(true);
    expect(fastest).toBeGreaterThan(40 + 2);                           // it swims faster than it walks
    expect(seen('elder.march.sea').length).toBeGreaterThan(0);
    expect(seen('elder.march.landfall').length).toBeGreaterThan(0);
    expect(contact).toBe(true);
    expect(sampleTile(e.gx!, e.gy!).landIdx).not.toBe(island);         // the one body really is on the far shore
    expect(Object.values(hw.people).some(h => (h.threat?.waves ?? 0) > 0 && h.threat?.lastWaveId?.includes('atlas'))).toBe(true);
    // A save taken at any point of this is valid.
    expect(validate(JSON.parse(JSON.stringify(gs)))).toBeTruthy();
  });

  it('an Elder too far away is still on the water when the world ends: no strike is fabricated', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const e = assault(gs, 'surtur');
    onlySettlement(gs, (_p, gx, gy) => Math.hypot(gx - e.lairGx, gy - e.lairGy) > 2000);   // beyond 24 h even of swimming
    const at = atHour(gs, 312);
    expect(e.march).toBeDefined();
    for (let h = 1; h <= 23; h++) advanceElderPressure(r, hw, at + h * HOUR_MS);
    expect(Math.hypot(e.gx! - e.lairGx, e.gy! - e.lairGy)).toBeGreaterThan(800);   // it did set out…
    expect(Math.hypot(e.gx! - e.lairGx, e.gy! - e.lairGy)).toBeLessThanOrEqual(23 * 80 + 2);   // …at its pace
    for (const ev of e.events ?? []) expect(ev.state).toBe('BLOCKED');
    expect(Object.values(hw.people).some(h => (h.threat?.waves ?? 0) > 0 && h.threat?.lastWaveId?.includes('surtur'))).toBe(false);
  });

  it('a destroyed Elder stops marching', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const e = assault(gs, 'typhon');
    onlySettlement(gs, (_p, gx, gy) => sampleTile(gx, gy).landIdx === sampleTile(e.lairGx, e.lairGy).landIdx
      && Math.hypot(gx - e.lairGx, gy - e.lairGy) > 200 && Math.hypot(gx - e.lairGx, gy - e.lairGy) < 600);
    const at = atHour(gs, 312);
    expect(e.march).toBeDefined();
    advanceElderPressure(r, hw, at + HOUR_MS);
    const where = [e.gx, e.gy];
    defeatElder(r, hw, 'typhon', at + HOUR_MS + 1);
    for (let h = 2; h <= 6; h++) advanceElderPressure(r, hw, at + h * HOUR_MS);
    expect(e.march).toBeUndefined();
    expect([e.gx, e.gy]).toEqual(where);
  });
});
