// The chart is one sheet the hand moves: drag pans, the wheel zooms on the point under the cursor, and any spot can
// be marked as the destination. These tests pin the camera arithmetic and the hand-marked destination; the gestures
// themselves (pointer, pinch, flick) are checked in a browser.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildQaSandbox } from '../src/game/qa-sandbox';
import { TILE, type GameState, type RunState } from '../src/game/core';
import { setActiveLayout } from '../src/game/world';
import { windowOrigin } from '../src/veyra05/continuity';
import { FRAME_W, FRAME_H } from '../src/veyra05/frame';
import { translateVi } from '../src/game/i18n-vi';
import {
  atlasPlace, atlasPlaces, waypointId, isWaypointId, WAYPOINT_NAME, storeDestination, readDestination, destinationView,
  playerGlobalTile, ARRIVE_TILES, ARRIVE_TILES_MARK, __resetDestinationMemory,
} from '../src/game/map-atlas';
import {
  VIEW_W, VIEW_H, FIT_S, MAX_S, SECTOR_S, ZOOM_STEP, fitCam, clampCam, toGlobal, toScreen, zoomAt, panBy, isFit, wheelRatio,
  easeCam, reveal, scaleBar, rememberCam, recallCam, __forgetCams, type Cam,
} from '../src/ui/atlas-camera';
import { ExpeditionMap, PlaceCard } from '../src/ui/ExpeditionMap';
import { DestinationBeacon } from '../src/ui/Waymark';
import { setViewSize } from '../src/game/viewport';
import type { Api } from '../src/ui/common';

const NOW = 1_800_000_000_000;
const store = new Map<string, string>();
const realStorage = (globalThis as any).localStorage;
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
};
afterAll(() => { (globalThis as any).localStorage = realStorage; });

let built: GameState | null = null;
function veyra(): { gs: GameState; r: RunState } {
  if (!built) built = buildQaSandbox('fresh', 'female', NOW).gs;
  const r = built.run!;
  setActiveLayout(r.layoutId!);
  r.poiSeen = [];
  return { gs: built, r };
}
const apiFor = (gs: GameState): Api => ({
  gs, now: () => NOW + 200, act: () => ({ ok: true } as any), toast: () => {}, open: () => {}, panel: { kind: 'map' }, sel: null, setSel: () => {},
  setBuild: () => {}, buildType: null, reclaim: false, setReclaim: () => {}, repairMode: false, setRepairMode: () => {}, setUpgradeMode: () => {}, sfx: () => {}, rerender: () => {},
} as unknown as Api);
const chart = (gs: GameState) => renderToStaticMarkup(<ExpeditionMap api={apiFor(gs)} qaSession />);

beforeEach(() => { __resetDestinationMemory(); store.clear(); __forgetCams(); });

describe('chart camera: one sheet from the whole continent down to a few tiles', () => {
  it('the opening view shows the whole continent, centred, with room around it', () => {
    const c = fitCam();
    expect(isFit(c)).toBe(true);
    expect(FRAME_W * c.s).toBeLessThanOrEqual(VIEW_W);
    expect(FRAME_H * c.s).toBeLessThanOrEqual(VIEW_H);
    const [x0, y0] = toScreen(c, 0, 0), [x1, y1] = toScreen(c, FRAME_W, FRAME_H);
    expect(x0).toBeCloseTo(VIEW_W - x1, 6);
    expect(y0).toBeCloseTo(VIEW_H - y1, 6);
  });

  it('zooming keeps the ground under the cursor under the cursor', () => {
    let c: Cam = clampCam({ gx: 1400, gy: 900, s: 0.4 });
    const ax = 201, ay = 75;
    const [gx, gy] = toGlobal(c, ax, ay);
    for (let i = 0; i < 6; i++) {
      c = zoomAt(c, c.s * ZOOM_STEP, ax, ay);
      const [hx, hy] = toGlobal(c, ax, ay);
      expect(hx).toBeCloseTo(gx, 6);
      expect(hy).toBeCloseTo(gy, 6);
    }
    expect(c.s).toBeGreaterThan(0.4 * 5);
  });

  it('the scale stops at the whole continent and at the closest view; it never runs past either', () => {
    expect(zoomAt(fitCam(), FIT_S / 50, 10, 10).s).toBe(FIT_S);
    expect(zoomAt(fitCam(), 999, 150, 120).s).toBe(MAX_S);
    expect(clampCam({ gx: NaN, gy: Infinity, s: NaN })).toEqual(fitCam());
  });

  it('a drag moves the sheet with the hand: the grabbed tile follows the pointer', () => {
    const c = clampCam({ gx: 2000, gy: 1400, s: 1 });
    const [gx, gy] = toGlobal(c, 100, 100);
    const d = panBy(c, 37, -22);
    const [sx, sy] = toScreen(d, gx, gy);
    expect(sx).toBeCloseTo(137, 6);
    expect(sy).toBeCloseTo(78, 6);
  });

  it('the sheet cannot be dragged off the continent: some land always stays in view', () => {
    let c = clampCam({ gx: 2000, gy: 1400, s: 2 });
    for (let i = 0; i < 400; i++) c = panBy(c, 300, 300);     // drag far towards the bottom right: view goes top left
    const [x0, y0] = toScreen(c, 0, 0);
    expect(x0).toBeLessThan(VIEW_W / 2);
    expect(y0).toBeLessThan(VIEW_H / 2);
    for (let i = 0; i < 400; i++) c = panBy(c, -300, -300);
    const [x1, y1] = toScreen(c, FRAME_W, FRAME_H);
    expect(x1).toBeGreaterThan(VIEW_W / 2);
    expect(y1).toBeGreaterThan(VIEW_H / 2);
  });

  it('one mouse notch is one zoom step; a trackpad sends small steps; one event never jumps more than three', () => {
    expect(wheelRatio(-100, 0, false)).toBeCloseTo(ZOOM_STEP, 6);
    expect(wheelRatio(100, 0, false)).toBeCloseTo(1 / ZOOM_STEP, 6);
    expect(wheelRatio(-3, 1, false)).toBeCloseTo(Math.pow(ZOOM_STEP, 0.99), 6);   // line mode: 3 lines is about a notch
    const small = wheelRatio(-4, 0, false);
    expect(small).toBeGreaterThan(1);
    expect(small).toBeLessThan(1.02);
    expect(wheelRatio(-15, 0, true)).toBeCloseTo(Math.pow(ZOOM_STEP, 0.5), 6);    // trackpad pinch
    expect(wheelRatio(-100000, 0, false)).toBeCloseTo(Math.pow(ZOOM_STEP, 3), 6);
  });

  it('a move between two views starts at the first, ends exactly on the second, and covers most of the way early', () => {
    const a = fitCam(), b: Cam = { gx: 1300, gy: 900, s: SECTOR_S };
    expect(easeCam(a, b, 0)).toEqual(a);
    const end = easeCam(a, b, 1);
    expect(end.gx).toBeCloseTo(b.gx, 9); expect(end.gy).toBeCloseTo(b.gy, 9); expect(end.s).toBeCloseTo(b.s, 9);
    const mid = easeCam(a, b, 0.5);
    expect((mid.gx - a.gx) / (b.gx - a.gx)).toBeGreaterThan(0.8);
    expect(mid.s).toBeGreaterThan(a.s);
    expect(mid.s).toBeLessThan(b.s);
    expect(easeCam(a, b, 7).s).toBeCloseTo(b.s, 9);
  });

  it('picking a place from the list only moves the sheet when the place is not on it', () => {
    const c = clampCam({ gx: 1300, gy: 900, s: 1 });
    expect(reveal(c, 1310, 896)).toBeNull();
    const moved = reveal(c, 3000, 2000)!;
    expect(moved.s).toBe(c.s);
    const [x, y] = toScreen(moved, 3000, 2000);
    expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(VIEW_W);
    expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(VIEW_H);
  });

  it('the scale bar is a round distance of a readable length at every scale', () => {
    for (let s = FIT_S; s <= MAX_S; s *= 1.2) {
      const bar = scaleBar(s);
      expect([5, 10, 20, 50, 100, 200, 500, 1000, 2000]).toContain(bar.tiles);
      expect(bar.px).toBeGreaterThanOrEqual(30);
      expect(bar.px).toBeLessThanOrEqual(160);
    }
  });

  it('the view is remembered per run for the session, and a remembered view is still inside the limits', () => {
    expect(recallCam('run-a')).toBeNull();
    rememberCam('run-a', { gx: 1300, gy: 900, s: 2 });
    rememberCam('run-b', { gx: -500, gy: 99999, s: 500 });
    expect(recallCam('run-a')).toEqual({ gx: 1300, gy: 900, s: 2 });
    const b = recallCam('run-b')!;
    expect(b.s).toBe(MAX_S);
    expect(b.gx).toBeGreaterThanOrEqual(0);
    expect(b.gy).toBeLessThanOrEqual(FRAME_H);
  });
});

describe('a spot marked by hand can be the destination', () => {
  it('any tile on the continent gets an id; off the frame gets none', () => {
    expect(waypointId(1310, 896)).toBe('at_1310_896');
    expect(isWaypointId('at_1310_896')).toBe(true);
    expect(isWaypointId('po_greywater')).toBe(false);
    expect(waypointId(-1, 5)).toBeNull();
    expect(waypointId(FRAME_W, 5)).toBeNull();
    expect(waypointId(5, FRAME_H)).toBeNull();
  });

  it('the spot reads as a place of its own and is never listed among the named places', () => {
    const { r } = veyra();
    const pl = atlasPlace(r, 'at_1310_896')!;
    expect(pl).toMatchObject({ id: 'at_1310_896', name: WAYPOINT_NAME, gtx: 1310, gty: 896, custom: true, visited: false });
    expect(pl.kind.label).toBe('Your mark');
    expect(atlasPlaces(r).some(p => p.custom)).toBe(false);
    expect(atlasPlace(r, 'at_999999_1')).toBeNull();
    expect(atlasPlace(r, 'at_x_y')).toBeNull();
  });

  it('is stored and read back like any destination, one at a time', () => {
    const { r } = veyra();
    expect(storeDestination(r, false, 'at_1300_890')).toBe('at_1300_890');
    expect(readDestination(r, false)).toBe('at_1300_890');
    const named = atlasPlaces(r)[0].id;
    expect(storeDestination(r, false, named)).toBe(named);
    expect(readDestination(r, false)).toBe(named);
    expect(storeDestination(r, false, 'at_-4_890')).toBeNull();
  });

  it('counts as reached only when the player stands close to it: closer than for a named place', () => {
    const { r } = veyra();
    const [px, py] = playerGlobalTile(r);
    expect(ARRIVE_TILES_MARK).toBeLessThan(ARRIVE_TILES);
    storeDestination(r, true, waypointId(px + ARRIVE_TILES_MARK + 3, py)!);
    const far = destinationView(r, true)!;
    expect(far.place.custom).toBe(true);
    expect(far.arrived).toBe(false);
    // measured from where the player stands to the middle of the marked tile, so within a tile of the tile count
    expect(Math.abs(far.dist - (ARRIVE_TILES_MARK + 3))).toBeLessThan(1);
    storeDestination(r, true, waypointId(px + 2, py + 1)!);
    expect(destinationView(r, true)!.arrived).toBe(true);
  });

  it('the chart shows it: pill on the sheet, first row of the list, card with the way to drop it', () => {
    const { gs, r } = veyra();
    const [px, py] = playerGlobalTile(r);
    const id = waypointId(px + 60, py - 20)!;
    storeDestination(r, true, id);
    const html = chart(gs);
    expect(html).toContain('data-testid="map-dest-pill"');
    expect(html).toContain(`data-testid="map-place-${id}"`);
    expect(html).toContain('data-testid="map-dest-clear"');
    expect(html).not.toContain('data-testid="map-dest-set"');
    expect(html).toContain('Marked spot');
    expect(html).toContain('A spot you marked on the chart. The arrow on screen leads to it.');
    // a hand-made mark is not a place with an inside: neither line belongs on its card
    expect(html).not.toContain('What is inside is not on the chart.');
    expect(html).toContain('Places 0/75');
  });

  it('its name is translated, unlike the names of places', () => {
    const { r } = veyra();
    const custom = atlasPlace(r, 'at_1310_896')!;
    const named = atlasPlaces(r)[0];
    const card = (place: typeof custom) => renderToStaticMarkup(<PlaceCard place={place} dist={50} bearing={0} isDestination={false} onSet={() => {}} onClear={() => {}} />);
    expect(card(custom)).not.toMatch(/data-notr="true"[^>]*>Marked spot/);
    expect(card(named)).toContain('data-notr="true"');
    expect(card(custom)).not.toContain('Not visited yet');
  });

  it('the arrow on screen leads to it like to any place', () => {
    const { r } = veyra();
    setViewSize(640, 360);
    const [px, py] = playerGlobalTile(r);
    storeDestination(r, true, waypointId(px + 300, py)!);
    const dest = destinationView(r, true)!;
    const [ox, oy] = windowOrigin(r);
    const camX = (px - ox) * TILE - 320, camY = (py - oy) * TILE - 180;
    const html = renderToStaticMarkup(<DestinationBeacon dest={dest} camX={camX} camY={camY} />);
    expect(html).toContain('data-testid="dest-beacon"');
    expect(html).toContain('Marked spot');
    expect(html).toMatch(/<em>(299|300|301) m<\/em>/);
  });
});

describe('the chart says how it is handled', () => {
  it('one sheet with World, Sector, minus, plus and You; World is lit on a first opening', () => {
    const { gs } = veyra();
    const html = chart(gs);
    expect(html).toMatch(/data-testid="map-mode-continent" class="btn sm gold"/);
    expect(html).toMatch(/data-testid="map-mode-local" class="btn sm ghost"/);
    expect(html).toContain('data-testid="map-zoom-in"');
    expect(html).toContain('data-testid="map-zoom-out"');
    expect(html).toContain('data-testid="map-center-you"');
    expect(html).toContain('chart-canvas--sheet');
  });

  it('reopens at the scale it was left at', () => {
    const { gs, r } = veyra();
    rememberCam(r.id, { gx: 1300, gy: 900, s: 2 });
    const html = chart(gs);
    expect(html).toMatch(/data-testid="map-mode-continent" class="btn sm ghost"/);
    expect(html).toMatch(/data-testid="map-mode-local" class="btn sm gold"/);
    // close on ground far from the player: neither button claims the view
    rememberCam(r.id, { gx: 3000, gy: 2000, s: 2 });
    const away = chart(gs);
    expect(away).toMatch(/data-testid="map-mode-continent" class="btn sm ghost"/);
    expect(away).toMatch(/data-testid="map-mode-local" class="btn sm ghost"/);
  });

  it('picking ground for the core blink opens close on the sector and keeps its own instruction', () => {
    const { gs } = veyra();
    const html = renderToStaticMarkup(<ExpeditionMap api={apiFor(gs)} qaSession onTeleportSelect={() => {}} />);
    expect(html).toContain('CORE BLINK');
    expect(html).toMatch(/data-testid="map-mode-local" class="btn sm gold"/);
    expect(html).not.toContain('data-testid="map-hint"');
    expect(html).not.toContain('data-testid="map-dest-pill"');
  });

  it('tells the player how to set a destination on any spot', () => {
    const { gs } = veyra();
    const html = chart(gs);
    expect(html).toContain('Double-click or right-click a place, or any spot, to set it as your destination.');
    expect(html).toContain('Drag to move · scroll to zoom · double-click to set a destination');
  });

  it('every new line on the chart has its Vietnamese', () => {
    for (const s of [
      'Your mark', 'Marked spot', 'A spot you marked on the chart. The arrow on screen leads to it.', 'You reached the spot you marked.',
      'Sector', 'Zoom in', 'Zoom out', 'Zoom in [+]', 'Zoom out [-]', 'Center on yourself [Home]',
      'Drag to move · scroll to zoom · double-click to set a destination', 'Drag to move · pinch to zoom · double-tap to set a destination',
      'Every named place is on this chart from the start. Click one to see what it is. Double-click or right-click a place, or any spot, to set it as your destination.',
      'Every named place is on this chart from the start. Tap one to see what it is. Double-tap or hold a place, or any spot, to set it as your destination.',
      'A note can only be left on ground you have walked.', 'Out of reach of the core. Pick ground in the sector around you.',
      'Bring this place up close on the chart',
    ]) {
      const vi = translateVi(s);
      expect(vi, s).toBeTruthy();
      expect(vi, s).not.toBe(s);
    }
  });
});
