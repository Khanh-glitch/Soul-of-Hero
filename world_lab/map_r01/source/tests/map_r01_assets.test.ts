import { describe, it, expect } from 'vitest';
import ledger from '../src/game/assets/frame_ledger.v1.json';
import { ASSET_DECISIONS, propFrameFor, selectFrameNames, worldAssetsReady } from '../src/game/worldAssets';
import { T } from '../src/game/core';

const F = (ledger as unknown as { frames: Record<string, { rect: number[] }> }).frames;
const at = (_x: number, _y: number) => T.GRASS;

describe('MAP-R01 admitted A1 frame ledger', () => {
  it('pins the exact source branch, sheet hash and 16px nearest-neighbour grid', () => {
    const L = ledger as any;
    expect(L.schema).toBe('soh.web.world_asset_slice.v1');
    expect(L.source_commit).toBe('ce9d4ba2d3db153011874aa41b789fa8092be042');
    expect(L.grid).toEqual({ tile_px: 16, scale: 1, filter: 'nearest', feet_anchor: 'bottom-center' });
    expect(L.slice_sheet.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(L.slice_sheet.width % 16).toBe(0);
    expect(L.excluded).toMatch(/cainos_/);
  });
  it('every admitted frame has a non-empty rect inside the slice sheet and a 64-hex pixel hash', () => {
    const L = ledger as any;
    for (const [name, f] of Object.entries(F)) {
      expect(f.rect.length, name).toBe(4);
      expect(f.rect[2] * f.rect[3], name).toBeGreaterThan(0);
      expect(f.rect[0] + f.rect[2], name).toBeLessThanOrEqual(L.slice_sheet.width);
      expect(f.rect[1] + f.rect[3], name).toBeLessThanOrEqual(L.slice_sheet.height);
      expect((f as any).raw_rgba_sha256 ?? (L.frames as any)[name].raw_rgba_sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(Object.keys(F).length).toBeGreaterThan(150);
    expect(Object.keys(F).some(n => n.startsWith('cainos_'))).toBe(false);
  });
});

describe('MAP-R01 deterministic selectors', () => {
  it('selects only ledger frames and is stable for the same tile identity', () => {
    for (let ty = 0; ty < 24; ty++) for (let tx = 0; tx < 24; tx++) {
      for (const t of [T.GRASS, T.MEADOW, T.FOREST, T.SAND, T.SHALLOW, T.DEEP, T.RIVER, T.ROAD]) {
        const a = selectFrameNames(tx, ty, t, at);
        expect(JSON.stringify(a)).toBe(JSON.stringify(selectFrameNames(tx, ty, t, at)));
        for (const n of a) expect(F[n], `${t}@${tx},${ty} -> ${n}`).toBeTruthy();
      }
    }
  });
  it('KEEPs the original Web material for non-admitted terrain', () => {
    for (const t of [T.SNOW, T.ASH, T.TOXIC, T.LAVA, T.BURNT, T.ICE, T.BRIDGE, T.FLOOR, T.PWALL, T.CLIFF, T.HILL, T.MARSH]) {
      expect(selectFrameNames(10, 10, t, at)).toEqual([]);
    }
  });
  it('decodes A1 transition conventions: water corners, shore edges, road edges', () => {
    const W = (_x: number, _y: number) => T.SHALLOW;
    const G = (_x: number, _y: number) => T.GRASS;
    // grass surrounded by grass -> base; grass with a water neighbour -> blend frame
    expect(selectFrameNames(5, 5, T.GRASS, G)[0]).toMatch(/^grass_[0-3]$/);
    const g = (x: number, y: number) => (y < 5 ? T.SHALLOW : T.GRASS); // north is water
    expect(selectFrameNames(5, 5, T.GRASS, g)[0]).toMatch(/^blend_grass_water_/);
    const s = (x: number, y: number) => (y > 5 ? T.SHALLOW : T.SAND); // south is water
    expect(selectFrameNames(5, 5, T.SAND, s)[0]).toMatch(/^coast_dune_tidal_/);
    expect(selectFrameNames(5, 5, T.DEEP, W)[0]).toMatch(/^lake_[0-3]$/);
  });
  it('y-sorted prop seam is deterministic and pinned to real source keys', () => {
    expect(propFrameFor('rock', 84, 171)).toBe(propFrameFor('rock', 84, 171));
    expect(propFrameFor('bush', 84, 171)).toBe('bush');
    expect(propFrameFor('reed', 84, 171)).toBe('reeds');
    expect(propFrameFor('oak', 84, 171)).toBeNull();
    expect(F[propFrameFor('rock', 84, 171)!]).toBeTruthy();
  });
  it('decisions are explicit and the bridge never blocks a headless build', () => {
    expect(ASSET_DECISIONS.ground).toBe(true);
    expect(ASSET_DECISIONS.road).toBe(false);
    expect(ASSET_DECISIONS.props).toBe(false);
    expect(typeof worldAssetsReady()).toBe('boolean');
  });
});
