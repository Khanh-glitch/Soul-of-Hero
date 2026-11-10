import { describe, expect, it } from 'vitest';
import { WW, TILE, HOUR, BAL } from '../game/core';
import { newGame, startRun, dispatch, blockedAt, entsAt, markDirty, C, VEYRA_SPAWN_LAYOUTS } from '../game/engine';
import { findInteract } from '../game/sim';
import { setActiveLayout, getWorld } from '../game/world';
import { validate, serializeSnapshot } from '../game/persist';
import { U05_WORLD_LAYOUT_ID, layoutIdAt } from './scenes';
import { getWindowWorld, resetWindowToGround } from './window';
import { applyFloor, activeFloor, onActiveFloor } from './floors';
import { shiftVeyraWindowBy } from './continuity';
import { POIS } from './reader';
import { auToTile } from './frame';

describe('VEYRA Phase B — multi-region spawn, economy statics, floor isolation & cold-reload custody', () => {
  it('spawns legally across all 4 canonical Veyra regions and validates snapshots', () => {
    for (let reg = 0; reg < VEYRA_SPAWN_LAYOUTS.length; reg++) {
      const gs = newGame();
      setActiveLayout(U05_WORLD_LAYOUT_ID);
      const res = startRun(gs, reg % 2 === 0 ? 'female' : 'male', 1_700_000_000_000 + reg * 1000, reg, 20261109 + reg);
      expect(res.ok).toBe(true);
      expect(gs.run?.layoutId).toBe(VEYRA_SPAWN_LAYOUTS[reg]);
      expect(gs.run?.spawnRegion).toBe(reg);
      expect(validate(structuredClone(gs))).not.toBeNull();
    }
  });

  it('keeps cold reload on floor -1 valid even when world cache starts on ground floor 0', () => {
    const p = POIS.find(x => x.id === 'po_greywater')!;
    const [gx, gy] = auToTile(p.at[0], p.at[1]);
    const lid = layoutIdAt(gx - 100, gy - 100);
    setActiveLayout(lid);
    const gs = newGame();
    const res = startRun(gs, 'female', 1_700_000_000_000, null, 20261109);
    expect(res.ok).toBe(true);

    const ww = getWindowWorld(lid);
    const stair = ww.floors.ground.stairs.find(s => s.to === -1)!;
    expect(stair).toBeTruthy();
    const [lx, ly] = [stair.tx - ww.win.originTx, stair.ty - ww.win.originTy];
    expect(applyFloor(gs, ww, ww.floors, -1, [lx, ly], markDirty)).toBe(true);
    expect(activeFloor(gs.run!)).toBe(-1);

    // Serialize while on floor -1, then reset cached WindowWorld to ground floor 0 to simulate cold browser reload
    const snap = JSON.parse(JSON.parse(serializeSnapshot(gs)).payload);
    resetWindowToGround(ww);
    expect(getWorld(lid).statics).toEqual(ww.floors.ground.statics);

    const reloaded = validate(snap);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.run!.veyraFloor).toBe(-1);

    // Ground-floor doors must never block or appear in entsAt/findInteract while on floor -1
    const groundDoor = Object.values(gs.run!.entities).find(e => e.kind === 'door' && !onActiveFloor(gs.run!, e));
    if (groundDoor && ww.floors.layers.get(-1)!.walkable[groundDoor.ty! * WW + groundDoor.tx!]) {
      expect(blockedAt(gs.run!, groundDoor.tx!, groundDoor.ty!)).toBe(false);
    }
    if (groundDoor) {
      expect(entsAt(gs.run!, groundDoor.tx!, groundDoor.ty!).some(e => e.id === groundDoor.id)).toBe(false);
      gs.run!.player.x = groundDoor.x;
      gs.run!.player.y = groundDoor.y;
      expect(findInteract(gs, 1_700_000_000_000)?.eid).not.toBe(groundDoor.id);
    }
  });

  it('preserves offscreen container custody and depleted POI loot across window slides without duplication', () => {
    const p = POIS.find(x => x.id === 'po_greywater')!;
    const [gx, gy] = auToTile(p.at[0], p.at[1]);
    const lid = layoutIdAt(gx - 100, gy - 100);
    setActiveLayout(lid);
    const gs = newGame();
    expect(startRun(gs, 'female', 1_700_000_000_000, null, 20261109).ok).toBe(true);
    const r = gs.run!;

    // Find a ground-level POI loot crate, move player next to it, and withdraw all items to deplete it
    const crate = Object.values(r.entities).find(e => e.kind === 'loot' && onActiveFloor(r, e))!;
    expect(crate).toBeTruthy();
    const crateGlobalTx = getWindowWorld(r.layoutId!).win.originTx + crate.tx!;
    const crateGlobalTy = getWindowWorld(r.layoutId!).win.originTy + crate.ty!;

    // Empty crate via legal move intents
    r.player.x = crate.x;
    r.player.y = crate.y;
    const slots = C(r, crate.c!).slots;
    for (let i = 0; i < slots.length; i++) {
      if (!slots[i]) continue;
      const freeInv = C(r, 'inv').slots.findIndex(x => !x);
      const mv = dispatch(gs, { id: `take_${i}`, type: 'move', from: crate.c, fs: i, to: 'inv', ts: freeInv }, 1_700_000_000_100 + i);
      expect(mv.ok).toBe(true);
    }
    expect(r.entities[crate.id]).toBeUndefined();
    expect(validate(structuredClone(gs))).not.toBeNull();

    // Drop one item on ground to create a container-bearing entity that will go offscreen
    const dropRes = dispatch(gs, { id: 'drop_0', type: 'drop', c: 'inv', slot: 0 }, 1_700_000_000_500);
    expect(dropRes.ok).toBe(true);

    // Slide window far away (+192 tiles = 3 slides) so both crate site and dropped item leave the window
    expect(shiftVeyraWindowBy(gs, 192, 0, markDirty)).toBe(true);
    expect(r.veyraOffscreenEntities && Object.keys(r.veyraOffscreenEntities).length).toBeGreaterThan(0);
    expect(validate(structuredClone(gs))).not.toBeNull();

    // Slide window back (-192 tiles): depleted crate must NOT respawn/duplicate, and offscreen drop returns intact
    expect(shiftVeyraWindowBy(gs, -192, 0, markDirty)).toBe(true);
    const curWin = getWindowWorld(r.layoutId!).win;
    const localTx = crateGlobalTx - curWin.originTx;
    const localTy = crateGlobalTy - curWin.originTy;
    const dupCrate = Object.values(r.entities).find(e => e.kind === 'loot' && onActiveFloor(r, e) && e.tx === localTx && e.ty === localTy);
    expect(dupCrate).toBeUndefined();
    expect(validate(structuredClone(gs))).not.toBeNull();
  });

  it('exposes canonical Ragnarok caches, Chest Vendors, and Evacuation Beacons on walkable floor tiles', () => {
    const checkSite = (poiId: string, expectedKind: 'cash' | 'vendor' | 'evac') => {
      const p = POIS.find(x => x.id === poiId)!;
      const [gx, gy] = auToTile(p.at[0], p.at[1]);
      const lid = layoutIdAt(gx - 100, gy - 100);
      setActiveLayout(lid);
      const gs = newGame();
      const t0 = 1_700_000_000_000;
      expect(startRun(gs, 'female', t0, null, 20261109, { tx: gx - getWindowWorld(lid).win.originTx, ty: gy - getWindowWorld(lid).win.originTy }).ok).toBe(true);
      const r = gs.run!;
      const ent = Object.values(r.entities).find(e => e.kind === expectedKind && e.poi === poiId)!;
      expect(ent, `${poiId} should instantiate ${expectedKind}`).toBeTruthy();
      expect(validate(structuredClone(gs))).not.toBeNull();

      if (expectedKind === 'cash') {
        r.player.x = ent.x; r.player.y = ent.y;
        const early = dispatch(gs, { id: 'early_cash', type: 'openCash', eid: ent.id }, t0 + 1000);
        expect(early.ok).toBe(false);
        const ragTime = t0 + (BAL.run.maxRunHours - BAL.run.ragnarokFinalHours + 1) * HOUR;
        const ragOpen = dispatch(gs, { id: 'rag_cash', type: 'openCash', eid: ent.id }, ragTime);
        expect(ragOpen.ok).toBe(true);
        expect(ent.minted).toBe(true);
        expect(validate(structuredClone(gs))).not.toBeNull();
      }
    };

    checkSite('po_rc_meridian', 'cash');
    checkSite('po_rc_dam', 'cash');
    checkSite('po_vend_gulf', 'vendor');
    checkSite('po_vend_strait', 'vendor');
    checkSite('po_evac_west', 'evac');
    checkSite('po_evac_hook', 'evac');
  });
});
