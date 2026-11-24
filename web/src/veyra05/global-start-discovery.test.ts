import { describe, it, expect } from 'vitest';
import { globalWindowOrigins, WINDOW_GRID_COUNT } from './global-start-discovery';
import { FRAME_W, FRAME_H, WINDOW_W, WINDOW_H } from './frame';
import { getWindowWorld } from './window';
import { layoutIdAt, U05_WORLD_LAYOUT_ID } from './scenes';
import { newGame, startRun } from '../game/engine';
import { getActiveLayout, setActiveLayout } from '../game/world';

/**
 * Regression and discovery ORACLES.
 * The first three tests prove grid coverage only, not survival eligibility.
 * The final test uses normal engine startRun; no QA landing or gifted resources.
 * Do not treat the 3 windows as full-frame player certification.
 */
describe('global Veyra first-window safety foundation', () => {
  it('enumerates a unique full geographic grid with bounded valid origins', () => {
    for(const seed of [0,1,0x5f00f56,0xffffffff]){
      const values=[...globalWindowOrigins(seed)];
      expect(values).toHaveLength(WINDOW_GRID_COUNT);
      const seen=new Set<string>();
      for(const w of values){
        expect(w.originTx).toBeGreaterThanOrEqual(0);
        expect(w.originTy).toBeGreaterThanOrEqual(0);
        expect(w.originTx+WINDOW_W).toBeLessThanOrEqual(FRAME_W);
        expect(w.originTy+WINDOW_H).toBeLessThanOrEqual(FRAME_H);
        seen.add(w.originTx+','+w.originTy);
      }
      expect(seen.size).toBe(WINDOW_GRID_COUNT);
    }
  });

  it('gives stable traversal for the same seed and different order for others', () => {
    const pick=(seed:number)=>[...globalWindowOrigins(seed)].slice(0,25).map(x=>x.originTx+','+x.originTy);
    expect(pick(8192)).toEqual(pick(8192));
    expect(pick(8192)).not.toEqual(pick(8193));
  });

  it('does not confuse the whole-frame origin grid with accepted spawn cells', () => {
    expect(WINDOW_GRID_COUNT).toBeGreaterThan(100);
    const origins=[...globalWindowOrigins(24)];
    expect(origins.some(v=>v.originTx>FRAME_W/2)).toBe(true);
    expect(origins.some(v=>v.originTy>FRAME_H/2)).toBe(true);
  });

  it('rejects Westmouth centroid while retaining legal Greywater control', () => {
    const old=getActiveLayout();
    try {
      const west=layoutIdAt(673,1096);
      expect(setActiveLayout(west)).toBe(true);
      const w=getWindowWorld(west);
      expect(w.world.spawnEligible!.reduce((a,v)=>a+(v?1:0),0)).toBeLessThan(40000);
      const failed=newGame();
      const no=startRun(failed,'male',Date.UTC(2026,10,12,5),null,0x5f00f56);
      expect(no.ok).toBe(false);
      expect(failed.run).toBeFalsy();

      const grey=layoutIdAt(1482,1122);
      expect(setActiveLayout(grey)).toBe(true);
      const yesGame=newGame();
      const yes=startRun(yesGame,'male',Date.UTC(2026,10,12,5),null,0x5eeda00);
      expect(yes.ok).toBe(true);
      expect(yesGame.run?.qaUsed).toBe(false);
      expect(yesGame.run?.spawnChoice).toBeTruthy();

      expect(setActiveLayout(U05_WORLD_LAYOUT_ID)).toBe(true);
    } finally {setActiveLayout(old);}
  },120000);
});
