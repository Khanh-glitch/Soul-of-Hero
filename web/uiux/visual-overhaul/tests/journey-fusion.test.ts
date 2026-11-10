import { describe, expect, it } from 'vitest';
import { DAILY_BY_ID, DAILY_MILESTONES, generateDaily, freshStore, flushJourney, loadJourney, rerollDaily } from '../src/game/journey';
import { serializeSnapshot, selectSnapshots } from '../src/game/persist';
import type { GameState } from '../src/game/core';

const total = (ids: string[]) => ids.reduce((n,id) => n+(DAILY_BY_ID[id]?.points||0),0);

describe('A foundation x B practical fusion', () => {
  it('guarantees that the announced daily Beacon is reachable from the offered objectives', () => {
    for (let i=0;i<180;i++) {
      const ids=generateDaily('2026-11-10',`seed${i}`,null);
      expect(ids).toHaveLength(4);
      expect(new Set(ids.map(id=>DAILY_BY_ID[id].cat)).size).toBe(4);
      expect(total(ids)).toBeGreaterThanOrEqual(DAILY_MILESTONES.at(-1)!.at);
    }
  });
  it('a daily reroll cannot lower the offered points below the earned milestone ceiling', () => {
    const s=freshStore(); const ids=generateDaily('2026-11-10','reroll-seed',null);
    s.daily={date:'2026-11-10',objectives:ids.map(id=>({id,progress:0,done:false,seen:[]})),points:0,milestones:[],rerolled:false};
    const before=total(ids);
    const out=rerollDaily(s,ids[0],null);
    expect(total(out.daily!.objectives.map(x=>x.id))).toBeGreaterThanOrEqual(DAILY_MILESTONES.filter(m=>m.at<=before).at(-1)!.at);
  });
  it('Journey is checksummed together with canonical GameState, not a second save key', () => {
    const gs={version:3,revision:0,profile:{securedCash:0,achievements:{},history:[],settings:{volume:0.5,muted:false},profileReceipts:[]},run:null} as unknown as GameState;
    const j=freshStore(); j.marks=9; j.claimed=['milestone:2026-11-10:hearth'];
    flushJourney(gs,false,j);
    expect((gs.profile as any).journey.marks).toBe(9);
    // Decode through the exact game snapshot, as it happens on reload.
    const wrapped=serializeSnapshot(gs);
    const loaded=selectSnapshots([wrapped]).gs!;
    expect(loadJourney(loaded,false).marks).toBe(9);
    expect(loadJourney(loaded,false).claimed).toEqual(j.claimed);
  });
});
