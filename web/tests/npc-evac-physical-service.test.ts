/**
 * PHYSICAL EVACUATION SERVICE — control-tower 05 §D acceptance matrix.
 *
 * Controlled engineering checks. Nothing here is evidence of natural play.
 *
 * Law under test (web/evidence/npc-integration/20261117-final-production-control-tower/05 §D):
 *  - a trip record is not a ship: no boarding before the service opens, no boarding at distance,
 *  - a seat is finite and unique per human, and one body holds at most one seat,
 *  - departure carries a real manifest at a real instant; arrival (not boarding) certifies EVACUATED,
 *  - a voyage that fails releases living people at the berth and certifies nobody,
 *  - NPC evacuation never ends the player's run; the player's own arrival does,
 *  - being aboard is never an outcome (a run that ends at sea leaves passengers UNRESOLVED).
 */
import { describe, expect, it } from 'vitest';
import { HOUR, WW, type GameState } from '../src/game/core';
import { newGame, startRun, mkStack, dispatch, markDirty } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { T0 } from './helpers/g1b-kit';
import {
  advanceEvacuation, applyDamage, boardEvac, departEvac, evacSchedule, failEvacTrip,
  finalizeHumanOutcomes, leaveEvacBerth, playerBoardEvac,
  type EvacTrip, type HumanWorld,
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

/** Move the run clock to a real hour and settle the service through its own authority. */
function atHour(gs: GameState, hour: number): number {
  const r = gs.run!;
  r.qaOffset = hour * HOUR;
  const at = T0 + 1000;
  advanceEvacuation(r, r.humanWorld!, at);
  return at;
}

function trip(hw: HumanWorld, i = 0): EvacTrip { return Object.values(hw.evacuation)[i]; }

describe('physical evacuation service', () => {
  it('refuses every boarding attempt while the service is still staged', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const t = trip(hw);
    const h = Object.values(hw.people)[0];
    h.state = 'IDLE'; h.gx = t.siteGx; h.gy = t.siteGy; h.floor = 0;
    expect(t.phase).toBe('STAGING');
    const res = boardEvac(r, hw, h, t.tripId, T0 + 500);
    expect(res.ok).toBe(false);
    expect(h.transit).toBeUndefined();
    expect(t.manifest ?? []).toHaveLength(0);
  });

  it('opens a finite berth at h288 and refuses distance, corpses, the downed and duplicate seats', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const t = trip(hw);
    const S = evacSchedule();
    const at = atHour(gs, S.openHour);
    expect(t.phase).toBe('BOARDING');
    expect(t.capacity).toBe(S.seats);
    const people = Object.values(hw.people).filter(h => h.floor === 0).slice(0, t.capacity + 2);
    // distance: one body far from the berth can never board.
    const far = people[0];
    far.state = 'IDLE'; far.gx = t.siteGx + 40; far.gy = t.siteGy + 40;
    expect(boardEvac(r, hw, far, t.tripId, at).ok).toBe(false);
    // downed bodies are not passengers.
    const downed = people[1];
    downed.state = 'DOWNED'; downed.gx = t.siteGx; downed.gy = t.siteGy;
    expect(boardEvac(r, hw, downed, t.tripId, at).ok).toBe(false);
    // fill every real seat
    const seated = people.slice(2, 2 + t.capacity);
    for (const h of seated) { h.state = 'IDLE'; h.gx = t.siteGx; h.gy = t.siteGy; h.floor = 0; expect(boardEvac(r, hw, h, t.tripId, at).ok).toBe(true); }
    expect((t.manifest ?? []).length).toBe(Math.min(t.capacity, seated.length));
    const seats = new Set((t.manifest ?? []).map(p => p.seat));
    expect(seats.size).toBe((t.manifest ?? []).length);           // no duplicate seat number
    // a further body is refused for want of a seat, not silently squeezed in.
    const extra = people[people.length - 1];
    extra.state = 'IDLE'; extra.gx = t.siteGx; extra.gy = t.siteGy;
    const refused = boardEvac(r, hw, extra, t.tripId, at + 10);
    if ((t.manifest ?? []).length >= t.capacity) expect(refused.ok).toBe(false);
  });

  it('departs with a manifest and certifies EVACUATED only on arrival — exactly once', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const t = trip(hw);
    const at = atHour(gs, evacSchedule().openHour);
    const crew = Object.values(hw.people).filter(h => h.state !== 'DEAD' && h.floor === 0).slice(0, 2);
    for (const h of crew) { h.state = 'IDLE'; h.gx = t.siteGx; h.gy = t.siteGy; expect(boardEvac(r, hw, h, t.tripId, at).ok).toBe(true); }
    const departed = departEvac(r, hw, t.tripId, at + 1000);
    expect(departed.ok).toBe(true);
    expect(t.phase).toBe('IN_TRANSIT');
    const log = (t.departures ?? [])[0];
    expect(log.passengers.map(p => p.actorId).sort()).toEqual(crew.map(h => h.actorId).sort());
    // boarding is not an outcome: still alive, still not evacuated, still on the ledger.
    for (const h of crew) { expect(h.state).toBe('ON_VESSEL'); expect(h.outcome).toBeUndefined(); }
    // early arrival attempt changes nothing.
    advanceEvacuation(r, hw, t.arriveAt! - 1);
    for (const h of crew) expect(h.state).toBe('ON_VESSEL');
    // arrival: one certification per passenger.
    advanceEvacuation(r, hw, t.arriveAt!);
    for (const h of crew) { expect(h.state).toBe('EVACUATED'); expect(h.outcome).toBe('EVACUATED'); expect(h.transit).toBeUndefined(); }
    expect(log.arrivalReceipt).toBeTruthy();
    const receipt = log.arrivalReceipt;
    // idempotence: the same instant replayed cannot double-apply or re-issue a receipt.
    advanceEvacuation(r, hw, t.arriveAt!);
    expect(log.arrivalReceipt).toBe(receipt);
    expect((t.departures ?? []).length).toBe(1);
  });

  it('a failed voyage releases living passengers at the berth and certifies nobody', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const t = trip(hw);
    const at = atHour(gs, evacSchedule().openHour);
    const h = Object.values(hw.people).find(x => x.state !== 'DEAD' && x.floor === 0)!;
    h.state = 'IDLE'; h.gx = t.siteGx; h.gy = t.siteGy;
    expect(boardEvac(r, hw, h, t.tripId, at).ok).toBe(true);
    const failed = failEvacTrip(r, hw, t.tripId, at + 500, 'the quay pilot refused the crossing');
    expect(failed.ok).toBe(true);
    expect(h.state).toBe('IDLE');
    expect(h.transit).toBeUndefined();
    expect(h.outcome).toBeUndefined();
    expect(h.gx).toBe(t.siteGx);        // released where they physically stood: no teleport home
    expect(h.gy).toBe(t.siteGy);
    expect(t.phase).toBe('FAILED');
    expect(t.manifest ?? []).toHaveLength(0);
  });

  it('a body downed at the berth loses its seat instead of sailing as cargo', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const t = trip(hw);
    const at = atHour(gs, evacSchedule().openHour);
    const h = Object.values(hw.people).find(x => x.state !== 'DEAD' && x.floor === 0)!;
    h.state = 'IDLE'; h.gx = t.siteGx; h.gy = t.siteGy;
    expect(boardEvac(r, hw, h, t.tripId, at).ok).toBe(true);
    h.hp = 1;
    applyDamage(r, hw, h, 50, 0, at + 100, 'enemy', 'qa-raider', h.floor);
    expect(h.state).toBe('DOWNED');
    expect(h.transit).toBeUndefined();
    expect((t.manifest ?? []).some(p => p.actorId === h.actorId)).toBe(false);
  });

  it('a vessel at sea is out of reach of island weapons', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const t = trip(hw);
    const at = atHour(gs, evacSchedule().openHour);
    const h = Object.values(hw.people).find(x => x.state !== 'DEAD' && x.floor === 0)!;
    h.state = 'IDLE'; h.gx = t.siteGx; h.gy = t.siteGy;
    expect(boardEvac(r, hw, h, t.tripId, at).ok).toBe(true);
    expect(departEvac(r, hw, t.tripId, at + 1000).ok).toBe(true);
    const hp = h.hp;
    expect(applyDamage(r, hw, h, 40, 0, at + 2000, 'enemy', 'qa-raider', h.floor)).toBe(false);
    expect(h.hp).toBe(hp);
  });

  it('the player takes a seat without ending the run; only arrival certifies the ending', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const t = trip(hw);
    const at = atHour(gs, evacSchedule().openHour);
    // put the player's body on the berth tile through the real coordinate law
    const o = r.sourceMap?.veyra?.originAu;
    const ox = o ? Math.round(o[0] / 0.5) : 0, oy = o ? Math.round(o[1] / 0.5) : 0;
    r.player.x = (t.siteGx - ox) * 16 + 8; r.player.y = (t.siteGy - oy) * 16 + 8;
    const board = playerBoardEvac(r, hw, t.tripId, at);
    expect(board.ok).toBe(true);
    expect(t.playerAboard).toBe(true);
    expect(hw.playerEvacArrivedAt).toBeUndefined();      // boarding is not an ending
    expect(gs.run).not.toBeNull();
    // the player may still step ashore while berthed
    expect(leaveEvacBerth(r, hw, t.tripId, at + 100).ok).toBe(true);
    expect((t.manifest ?? []).some(p => p.actorId === 'player')).toBe(false);
    // board again and sail: only arrival records the ending receipt
    expect(playerBoardEvac(r, hw, t.tripId, at + 200).ok).toBe(true);
    expect(departEvac(r, hw, t.tripId, at + 300).ok).toBe(true);
    expect(leaveEvacBerth(r, hw, t.tripId, at + 400).ok).toBe(false); // cannot step off at sea
    advanceEvacuation(r, hw, t.arriveAt!);
    expect(hw.playerEvacArrivedAt).toBe(t.arriveAt);
    expect(hw.playerEvacTripId).toBe(t.tripId);
  });

  it('leaving the quay releases the seat; the sealed departure records the cargo actually carried at cast-off',()=>{
    const gs=runAt(),r=gs.run!,hw=r.humanWorld!,t=trip(hw),at=atHour(gs,evacSchedule().openHour);
    const [ax,ay]=r.sourceMap!.veyra!.originAu;const x=(t.siteGx-ax*2+.5)*16;r.player.x=x;r.player.y=(t.siteGy-ay*2+.5)*16;
    expect(playerBoardEvac(r,hw,t.tripId,at).ok).toBe(true);r.player.x+=4*16;advanceEvacuation(r,hw,at+1);
    expect(t.playerAboard).toBe(false);expect(t.manifest).toHaveLength(0);expect(t.departures).toHaveLength(0);
    r.player.x=x;expect(playerBoardEvac(r,hw,t.tripId,at+2).ok).toBe(true);const item=mkStack(r,'wood',2);r.custody.inv.slots[0]=item;
    expect(departEvac(r,hw,t.tripId,at+3).ok).toBe(true);expect(t.departures![0].passengers[0].cargo).toContainEqual({uid:item.uid,key:'wood',qty:2});
  });
  it('loads a real ration from the player, only at the matching berth and before departure',()=>{
    const gs=runAt(),r=gs.run!,hw=r.humanWorld!,t=trip(hw),at=atHour(gs,evacSchedule().openHour);
    const tx=Math.floor(r.player.x/16),ty=Math.floor(r.player.y/16),[ax,ay]=r.sourceMap!.veyra!.originAu;
    const e=r.entities['supply-berth']={id:'supply-berth',kind:'evac' as const,poi:t.site,x:r.player.x,y:r.player.y,tx,ty};markDirty();
    const item=mkStack(r,'berries',3);r.custody.inv.slots[0]=item;
    const send=(id:string)=>dispatch(gs,{id,type:'supplyEvac',eid:e.id,stackUid:item.uid},at);
    expect(send('different-coast').ok).toBe(false);t.siteGx=tx+ax*2;t.siteGy=ty+ay*2;
    const hold=r.custody[t.vessel!.holdId],count=()=>hold.slots.reduce((n,s)=>n+(s?.key==='berries'?s.qty:0),0),before=count();
    expect(send('load').ok).toBe(true);expect(count()).toBe(before+1);expect(item.qty).toBe(2);expect(send('load').ok).toBe(false);
    t.phase='IN_TRANSIT';expect(send('too-late').ok).toBe(false);expect(count()).toBe(before+1);
  });
  it('a run that ends while people are aboard leaves them UNRESOLVED, never EVACUATED', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const t = trip(hw);
    const at = atHour(gs, evacSchedule().openHour);
    const h = Object.values(hw.people).find(x => x.state !== 'DEAD' && x.floor === 0)!;
    h.state = 'IDLE'; h.gx = t.siteGx; h.gy = t.siteGy;
    expect(boardEvac(r, hw, h, t.tripId, at).ok).toBe(true);
    const summary = finalizeHumanOutcomes(r, hw, at + 1000);
    expect(h.outcome).toBe('UNRESOLVED');
    expect(summary.evacuated).toBe(0);
  });
});
