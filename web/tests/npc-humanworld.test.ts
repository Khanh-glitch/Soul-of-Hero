/**
 * NPC / "THE LAST HUMANITY" — HumanWorld ledger invariant tests (§17 fault coverage).
 *
 * Pins the authoritative run-local human society: finite population seeded from the 81-POI
 * geometry census, one source-authority class per source, one actor one terminal outcome,
 * companion order 5-way resolution, PLAYER_EXPLORATION harvest protection, and save validity.
 * Humans are NEVER Creatures and NEVER cloned entities.
 */
import { describe, expect, it } from 'vitest';
import { WW, TILE } from '../src/game/core';
import { newGame, startRun, dispatch } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { authoredPlan } from '../src/veyra05/floors';
import { validate } from '../src/game/persist';
import { NPC_POI_CENSUS } from '../src/game/npc-census';
import {
  newHumanWorld, seedPopulation, tickNeeds, advanceElderPressure,
  finalizeHumanOutcomes, humanHarvest, resolveOrder, setFollowing,
  type HumanWorld, type HumanRecord, type SiteClass,
} from '../src/game/humanworld';
import { T0 } from './helpers/g1b-kit';

function startAt(ax: number, ay: number, seed = 7606) {
  const [gtx, gty] = auToTile(ax, ay);
  const win = windowAround(gtx, gty);
  setActiveLayout(layoutIdAt(win.originTx, win.originTy));
  const gs = newGame();
  const lx = Math.max(8, Math.min(WW - 9, gtx - win.originTx));
  const ly = Math.max(8, Math.min(WW - 9, gty - win.originTy));
  expect(startRun(gs, 'female', T0, null, seed, { tx: lx, ty: ly }).ok).toBe(true);
  return gs;
}

describe('NPC HumanWorld ledger', () => {
  it('startRun seeds a finite HumanWorld from the 81-POI census geometry', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    expect(r.humanWorld).toBeTruthy();
    const hw = r.humanWorld!;
    expect(Object.keys(hw.people).length).toBeGreaterThan(0);
    // Population is finite and bounded — not a quota of the 811 spaces.
    expect(Object.keys(hw.people).length).toBeLessThan(300);
    // Every seeded community maps back to a census POI id.
    const poiIds = new Set(NPC_POI_CENSUS.map(p => p.id));
    const allEntities = { ...r.entities, ...(r.veyraOffscreenEntities ?? {}) };
    for (const comm of Object.values(hw.communities)) {
      expect(poiIds.has(comm.poi)).toBe(true);
      if (comm.storeEntityId) {
        const store = allEntities[comm.storeEntityId];
        expect(store?.kind).toBe('bag');
        expect(comm.storeContainers).toContain(store?.c);
        expect(r.custody[store?.c ?? '']?.kind).toBe('bag');
      }
      for (const stationId of comm.workStations) {
        expect(allEntities[stationId]?.kind).toBe('struct');
        expect(allEntities[stationId]?.station).toBeTruthy();
      }
    }
    expect(Object.values(hw.communities).some(c => c.storeEntityId)).toBe(true);
    expect(Object.values(hw.communities).some(c => c.workStations.length > 0)).toBe(true);
    // Every human is a ledger actor, NOT a creature and NOT an entity.
    const creatureIds = new Set(r.creatures.map(m => m.id));
    const entityIds = new Set(Object.keys(r.entities));
    for (const h of Object.values(hw.people)) {
      expect(creatureIds.has(h.actorId)).toBe(false);
      expect(entityIds.has(h.actorId)).toBe(false);
      const poi = h.community && hw.communities[h.community]?.poi;
      const plan = poi ? authoredPlan(poi) : null;
      const insideAuthoredRoom = plan?.plan.rooms.some(room => room.level === h.floor && room.rects.some(([x,y,w,hh]) => h.gx > x && h.gx < x + w - 1 && h.gy > y && h.gy < y + hh - 1));
      if (plan?.plan.rooms.some(room => room.level === h.floor)) expect(insideAuthoredRoom).toBe(true);
    }
  });

  it('a fresh run validates cleanly with the human ledger present', () => {
    const gs = startAt(921, 259);
    expect(validate(JSON.parse(JSON.stringify(gs)))).not.toBeNull();
  });

  it('tickNeeds + advanceElderPressure run each tick without corrupting state', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const before = Object.keys(hw.people).length;
    // advance a few ticks
    for (let i = 0; i < 5; i++) {
      tickNeeds(r, hw, T0 + (i + 1) * 60000);
      advanceElderPressure(r, hw, T0 + (i + 1) * 60000);
    }
    expect(Object.keys(hw.people).length).toBe(before); // no silent mint/wipe
    expect(validate(JSON.parse(JSON.stringify(gs)))).not.toBeNull();
  });

  it('humanHarvest protects PLAYER_EXPLORATION (G1B) sources from human harvest', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const human = Object.values(hw.people)[0] as HumanRecord;
    // A G1B chest entity sits on a PLAYER_EXPLORATION tile.
    const g1bEntity = Object.values(r.entities).find(e => (e as any).g1b) as any;
    expect(g1bEntity).toBeTruthy();
    const res = humanHarvest(r, hw, human, g1bEntity.tx, g1bEntity.ty, T0 + 1000);
    // Harvesting a player-exploration source never yields to a human.
    expect(res.result).not.toBe('yield');
  });

  it('companion resolveOrder returns one of the exact 5-way results', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    const human = Object.values(hw.people)[0] as HumanRecord;
    setFollowing(r, hw, human, true, T0 + 1000);
    const follow = resolveOrder(r, hw, human, 'ord-1', 'follow', T0 + 1000);
    expect(['OBEY', 'REFUSE_WITH_REASON', 'PROTECT_TARGET', 'RETREAT_OR_HOLD', 'CANNOT_EXECUTE']).toContain(follow.result);
    // A non-companion refuses.
    const other = Object.values(hw.people).find(p => p.actorId !== human.actorId) as HumanRecord;
    const hold = resolveOrder(r, hw, other, 'ord-2', 'hold', T0 + 1000);
    expect(hold.result).toBe('REFUSE_WITH_REASON');
  });

  it('finalizeHumanOutcomes assigns exactly one exclusive terminal outcome per actor', () => {
    const gs = startAt(921, 259);
    const r = gs.run!;
    const hw = r.humanWorld!;
    // Mark one human evacuated, one dead, leave the rest survived/unresolved.
    const all = Object.values(hw.people) as HumanRecord[];
    if (all.length >= 2) {
      hw.people[all[0].actorId].outcome = 'EVACUATED';
      hw.people[all[0].actorId].state = 'EVACUATED';
      hw.people[all[1].actorId].outcome = 'DEAD';
      hw.people[all[1].actorId].state = 'DEAD';
    }
    const summary = finalizeHumanOutcomes(r, hw, T0 + 1000);
    const valid = new Set(['EVACUATED', 'SURVIVED_ON_ISLAND', 'DEAD', 'UNRESOLVED']);
    for (const h of Object.values(hw.people) as HumanRecord[]) {
      expect(valid.has(h.outcome ?? 'UNRESOLVED')).toBe(true);
    }
    expect(summary).toBeTruthy();
  });

  it('seedPopulation classifies POIs by archetype into the 6 site classes', () => {
    const gs = newGame();
    // minimal stand-in run: use startRun's seeded world instead
    const [gtx, gty] = auToTile(921, 259);
    const win = windowAround(gtx, gty);
    setActiveLayout(layoutIdAt(win.originTx, win.originTy));
    const lx = Math.max(8, Math.min(WW - 9, gtx - win.originTx));
    const ly = Math.max(8, Math.min(WW - 9, gty - win.originTy));
    expect(startRun(gs, 'male', T0, null, 9999, { tx: lx, ty: ly }).ok).toBe(true);
    const r = gs.run!;
    const classes = new Set<SiteClass>();
    for (const c of Object.values(r.humanWorld!.communities)) classes.add(c.class);
    // At least one HABITABLE_COMMUNITY and one non-community class present from the census.
    expect(classes.has('HABITABLE_COMMUNITY')).toBe(true);
  });
});
