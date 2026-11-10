import { describe, expect, it } from 'vitest';
import { listLayouts, getWorld, setActiveLayout } from '../game/world';
import { U05_WORLD_LAYOUT_ID, isVeyra05Layout, layoutIdAt } from './scenes';
import { getAllPoiLayouts } from './poi-kit';
import { authoredPoiIds, authoredPlan } from './floors';
import { REST48_SITES } from './arch/rest48';
import { windowAround } from './frame';
import { POIS } from './reader';

describe('single playable VEYRA game — latest canonical map source', () => {
  it('exposes exactly ONE new-run map and no retired shipping/LR02 choices', () => {
    expect(listLayouts().map(p => p.id)).toEqual([U05_WORLD_LAYOUT_ID]);
    expect(isVeyra05Layout(U05_WORLD_LAYOUT_ID)).toBe(true);
  });
  it('the SAME runtime source/overview contains all 81 canonical authored POIs', () => {
    const ids = authoredPoiIds();
    const authored = getAllPoiLayouts();
    expect(POIS).toHaveLength(81);
    expect(ids).toHaveLength(81);
    expect(new Set(ids).size).toBe(81);
    expect(authored).toHaveLength(81);
    expect( new Set(ids) ).toEqual(new Set(POIS.map(p => p.id)));
  }, 15000);
  it('starts the game on U=0.5 GOLD, not the legacy engine-generated island', () => {
    expect(setActiveLayout(U05_WORLD_LAYOUT_ID)).toBe(true);
    const w = getWorld();
    expect(w.veyra?.unitsPerTile).toBe(0.5);
    expect(w.veyra?.frameAu).toEqual([2000,1400]);
    expect(w.economyMap.id).toBe('veyra05');
    expect(w.elders).toHaveLength(0); // six symbol lairs, NOT legacy creature spawns
  });
  it('six lairs are discoverable through the SAME game world window loader', () => {
    const six = [
      ['po_elderwood',-1,'elder_aion_root'],
      ['po_necropolis',-1,'elder_anubis_sarc'],
      ['po_hall_eyes',-1,'elder_argus_eye'],
      ['po_gate',-1,'elder_atlas_gate'],
      ['po_surtur',-1,'elder_surtur_forge'],
      ['po_typhon',0,'elder_typhon_shard'],
    ] as const;
    for (const [id,floor,prop] of six) {
      const site = REST48_SITES[id];
      const win = windowAround(site.cx,site.cy);
      const layout = layoutIdAt(win.originTx,win.originTy);
      const w = getWorld(layout);
      expect(w.veyra?.unitsPerTile).toBe(0.5);
      expect(w.places.some(p=>p.id===id)).toBe(true);
      const plan = authoredPlan(id)!;
      expect(plan.plan.levels).toEqual([-1,0,1,2]);
      expect(plan.plan.props.find(p=>p.kind===prop)?.level).toBe(floor);
    }
  });
});
