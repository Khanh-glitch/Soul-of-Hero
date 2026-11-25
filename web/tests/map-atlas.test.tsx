// The field chart [M] names every place on Veyra from the first minute, and lets the player pick one as a destination.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildQaSandbox } from '../src/game/qa-sandbox';
import { TILE, type GameState, type RunState } from '../src/game/core';
import { setActiveLayout } from '../src/game/world';
import { POIS } from '../src/veyra05/reader';
import { windowOrigin } from '../src/veyra05/continuity';
import { translateVi } from '../src/game/i18n-vi';
import {
  atlasPlaces, atlasPlace, placesByDistance, placeNear, placeName, formatDistance, bearing, PLACE_KINDS,
  readDestination, storeDestination, destinationView, playerGlobalTile, ARRIVE_TILES, __resetDestinationMemory,
} from '../src/game/map-atlas';
import { ExpeditionMap, PlaceCard } from '../src/ui/ExpeditionMap';
import { DestinationBeacon } from '../src/ui/Waymark';
import { setViewSize } from '../src/game/viewport';
import type { Api } from '../src/ui/common';

const NOW = 1_800_000_000_000;
// The browser store, as far as the destination needs it.
const store = new Map<string, string>();
const realStorage = (globalThis as any).localStorage;
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
};
afterAll(() => { (globalThis as any).localStorage = realStorage; });

/** A new run on Veyra with nothing staged (the QA "fresh" scene is a plain New run). One build, read by every test. */
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
const rowsOf = (html: string) => [...html.matchAll(/data-testid="map-place-(po_[a-z0-9_]+)"/g)].map(m => m[1]);

beforeEach(() => { __resetDestinationMemory(); store.clear(); });

describe('atlas: what the chart shows on a fresh run', () => {
  it('the run under test is on Veyra', () => {
    const { r } = veyra();
    expect(r.layoutId).toMatch(/^veyra05/);
  });

  it('names 75 of the 81 places from the start; the six Ragnarok strongboxes stay off until found', () => {
    const { r } = veyra();
    const places = atlasPlaces(r);
    expect(POIS.length).toBe(81);
    expect(places.length).toBe(75);
    expect(places.some(p => p.arche === 'ragnarok_cache')).toBe(false);
    expect(places.every(p => !p.visited)).toBe(true);
    // a strongbox appears once the player has found it
    r.poiSeen.push('po_rc_kestrel');
    const after = atlasPlaces(r);
    expect(after.length).toBe(76);
    expect(after.find(p => p.id === 'po_rc_kestrel')!.visited).toBe(true);
    expect(atlasPlace(r, 'po_rc_dam')).toBeNull();
  });

  it('every archetype in the canon has a label and a line, and no place falls back to the generic one', () => {
    const arches = new Set(POIS.map(p => p.arche));
    for (const a of arches) {
      expect(PLACE_KINDS[a], a).toBeTruthy();
      expect(PLACE_KINDS[a].label.length).toBeGreaterThan(2);
      expect(PLACE_KINDS[a].blurb.length).toBeGreaterThan(10);
    }
  });

  it('shows clean names: design tags are cut, and the phrase book never rewrites a place name', () => {
    expect(placeName({ name: 'Gulfhead Trading House [ĐỀ XUẤT]' })).toBe('Gulfhead Trading House');
    for (const po of POIS) {
      const n = placeName(po);
      expect(n).not.toMatch(/[\[\]]/);
      expect(translateVi(n), n).toBeNull();
    }
  });

  it('every label and line has a Vietnamese entry', () => {
    for (const k of Object.values(PLACE_KINDS)) {
      expect(translateVi(k.label), k.label).toBeTruthy();
      expect(translateVi(k.blurb), k.blurb).toBeTruthy();
    }
    for (const s of ['Set destination', 'Clear destination', 'Not visited yet', 'Visited', 'Nearest places', 'Places 3/75', 'Arrived: Hook Village']) expect(translateVi(s), s).toBeTruthy();
    expect(translateVi('Arrived: Hook Village')).toBe('Đã tới: Hook Village');
  });

  it('positions are on the continent frame, and off Veyra the atlas is empty', () => {
    const { r } = veyra();
    for (const p of atlasPlaces(r)) {
      expect(p.gtx).toBeGreaterThanOrEqual(0); expect(p.gtx).toBeLessThan(4000);
      expect(p.gty).toBeGreaterThanOrEqual(0); expect(p.gty).toBeLessThan(2800);
    }
    const academy = atlasPlace(r, 'po_academy')!;
    expect([academy.gtx, academy.gty]).toEqual([1872, 524]);
    const other = { ...r, layoutId: 'shipping' } as RunState;
    expect(atlasPlaces(other)).toEqual([]);
    expect(atlasPlace(other, 'po_academy')).toBeNull();
  });
});

describe('atlas: distance and direction', () => {
  it('reads one tile as one metre and switches to kilometres at 1000', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(849.6)).toBe('850 m');
    expect(formatDistance(999.4)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(1249)).toBe('1.2 km');
    expect(formatDistance(3960)).toBe('4.0 km');
  });
  it('gives direction as a screen angle: east is 0, south a quarter turn, north the opposite', () => {
    expect(bearing(10, 0)).toBe(0);
    expect(bearing(0, 10)).toBeCloseTo(Math.PI / 2, 9);
    expect(bearing(0, -10)).toBeCloseTo(-Math.PI / 2, 9);
    expect(Math.abs(bearing(-10, 0))).toBeCloseTo(Math.PI, 9);
  });
  it('orders places by distance from where the player stands', () => {
    const { r } = veyra();
    const ranges = placesByDistance(r);
    expect(ranges.length).toBe(atlasPlaces(r).length);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i].dist).toBeGreaterThanOrEqual(ranges[i - 1].dist);
    const [px, py] = playerGlobalTile(r);
    const first = ranges[0];
    expect(first.dist).toBeCloseTo(Math.hypot(first.place.gtx - px, first.place.gty - py), 6);
    expect(first.bearing).toBeCloseTo(Math.atan2(first.place.gty - py, first.place.gtx - px), 9);
  });
  it('picks the nearest mark within reach of a click, and none beyond it', () => {
    const { r } = veyra();
    const places = atlasPlaces(r);
    const strait = places.find(p => p.id === 'po_strait')!;
    expect(placeNear(places, strait.gtx + 3, strait.gty - 2, 80)!.id).toBe('po_strait');
    // the trading counter 41 tiles away is its own mark
    const counter = places.find(p => p.id === 'po_vend_strait')!;
    expect(placeNear(places, counter.gtx, counter.gty, 80)!.id).toBe('po_vend_strait');
    expect(placeNear(places, 40, 40, 80)).toBeNull();
  });
});

describe('destination: one chosen place', () => {
  it('is stored per run, survives a reload of the store, and can be cleared', () => {
    const { r } = veyra();
    expect(readDestination(r, false)).toBeNull();
    expect(storeDestination(r, false, 'po_hook')).toBe('po_hook');
    expect(readDestination(r, false)).toBe('po_hook');
    __resetDestinationMemory();                       // as after closing the browser
    expect(readDestination(r, false)).toBe('po_hook');
    expect(storeDestination(r, false, null)).toBeNull();
    __resetDestinationMemory();
    expect(readDestination(r, false)).toBeNull();
  });
  it('a QA session writes nothing to the browser store', () => {
    const { r } = veyra();
    storeDestination(r, true, 'po_hook');
    expect(readDestination(r, true)).toBe('po_hook');
    expect(Object.keys(localStorage).filter(k => k.startsWith('soh.map-dest'))).toEqual([]);
  });
  it('refuses an unknown id and a strongbox the player has not found', () => {
    const { r } = veyra();
    expect(storeDestination(r, false, 'po_nowhere')).toBeNull();
    expect(storeDestination(r, false, 'po_rc_salt')).toBeNull();
    localStorage.setItem(`soh.map-dest.v1:${r.id}:${r.sourceMap?.id ?? r.layoutId}`, 'po_rc_salt');
    __resetDestinationMemory();
    expect(readDestination(r, false)).toBeNull();
    r.poiSeen.push('po_rc_salt');
    expect(readDestination(r, false)).toBe('po_rc_salt');
  });
  it('gives the place in the active window\'s pixel space, with distance, direction and arrival', () => {
    const { r } = veyra();
    const [ox, oy] = windowOrigin(r);
    const [px, py] = playerGlobalTile(r);
    const far = placesByDistance(r).at(-1)!;
    storeDestination(r, false, far.place.id);
    const v = destinationView(r, false)!;
    expect(v.place.id).toBe(far.place.id);
    expect(v.x).toBe((far.place.gtx - ox) * TILE + TILE / 2);
    expect(v.y).toBe((far.place.gty - oy) * TILE + TILE / 2);
    expect(v.dist).toBeCloseTo(Math.hypot(far.place.gtx - px, far.place.gty - py), 6);
    expect(v.arrived).toBe(false);
    // the same place seen from a shifted window keeps its true distance: the player moves with the window
    const o = r.sourceMap!.veyra!.originAu as [number, number];
    const before = v.dist;
    o[0] += 32; r.player.x -= 64 * TILE;
    expect(destinationView(r, false)!.dist).toBeCloseTo(before, 6);
    o[0] -= 32; r.player.x += 64 * TILE;
    // standing next to it counts as arrived
    r.player.x = (far.place.gtx - ox + ARRIVE_TILES - 2) * TILE; r.player.y = (far.place.gty - oy) * TILE;
    expect(destinationView(r, false)!.arrived).toBe(true);
  });
});

describe('field chart panel on a fresh Veyra run', () => {
  it('opens on the whole continent and lists the five nearest places before anything has been explored', () => {
    const { gs, r } = veyra();
    const html = chart(gs);
    expect(html).toMatch(/data-testid="map-mode-continent" class="btn sm gold"/);
    expect(html).toContain('Nearest places');
    expect(html).toContain('Places 0/75');
    expect(html).not.toContain('Begin exploring');
    const nearest = placesByDistance(r).slice(0, 5);
    expect(rowsOf(html)).toEqual(nearest.map(g => g.place.id));
    expect(html).toContain(nearest[0].place.name);
    expect(html).toContain(nearest[0].place.kind.label);
    expect(html).toContain(formatDistance(nearest[0].dist));
    expect(html).not.toContain('data-testid="map-dest-pill"');
    expect(html).toContain('Every named place is on this chart from the start.');
  });

  it('never lists a strongbox the player has not found', () => {
    const { gs, r } = veyra();
    // stand on a strongbox: it is still not offered
    const box = POIS.find(p => p.id === 'po_rc_kestrel')!;
    const [ox, oy] = windowOrigin(r);
    const keep = [r.player.x, r.player.y];
    r.player.x = (box.at[0] * 2 - ox) * TILE; r.player.y = (box.at[1] * 2 - oy) * TILE;
    const html = chart(gs);
    expect(rowsOf(html)).not.toContain('po_rc_kestrel');
    expect(html).not.toContain('Kestrel Tower Safe');
    [r.player.x, r.player.y] = keep;
  });

  it('with a destination set, the chart opens on that place: pill on the sheet, row marked, card with the way to drop it', () => {
    const { gs, r } = veyra();
    const target = placesByDistance(r)[7];
    storeDestination(r, true, target.place.id);
    const html = chart(gs);
    expect(html).toContain('data-testid="map-dest-pill"');
    expect(rowsOf(html)[0]).toBe(target.place.id);                       // the destination leads the list
    expect(html).toMatch(new RegExp(`data-testid="map-place-${target.place.id}" class="[^"]*is-dest`));
    expect(html).toContain('data-testid="map-place-card"');
    expect(html).toContain('data-testid="map-dest-clear"');
    expect(html).not.toContain('data-testid="map-dest-set"');
    expect(html).toContain(target.place.kind.blurb.replace(/'/g, '&#x27;'));
    storeDestination(r, true, null);
    expect(chart(gs)).not.toContain('data-testid="map-dest-pill"');
  });

  it('a visited place is marked as such, and the count follows', () => {
    const { gs, r } = veyra();
    const near = placesByDistance(r)[0];
    r.poiSeen = [near.place.id];
    const html = chart(gs);
    expect(html).toContain('Places 1/75');
    expect(html).toMatch(new RegExp(`data-testid="map-place-${near.place.id}"[^>]*>.*?Visited`));
  });

  it('keeps the charted figure: it still counts only ground the player has walked', () => {
    const { gs, r } = veyra();
    const keep = r.discovered;
    r.discovered = Array(2500).fill(0);
    expect(chart(gs)).toContain('0% charted');
    r.discovered = keep;
  });
});

describe('place card', () => {
  it('says what the place is and offers it as a destination; an unvisited place says the inside is unknown', () => {
    const { r } = veyra();
    const g = placesByDistance(r).find(x => x.place.id === 'po_academy')!;
    const html = renderToStaticMarkup(<PlaceCard place={g.place} dist={g.dist} bearing={g.bearing} isDestination={false} onSet={() => {}} onClear={() => {}} />);
    expect(html).toContain('Argus Academy');
    expect(html).toContain('Research site');
    expect(html).toContain(formatDistance(g.dist));
    expect(html).toContain('Not visited yet');
    expect(html).toContain('What is inside is not on the chart.');
    expect(html).toContain('data-testid="map-dest-set"');
    // the card carries the kind of place only: nothing of the canon's access or design notes
    for (const leak of ['key', 'thẻ', 'Elder', 'boss', 'ĐỀ XUẤT', 'D068']) expect(html).not.toContain(leak);
  });
  it('a visited destination shows Visited and the button to clear it', () => {
    const { r } = veyra();
    r.poiSeen = ['po_hook'];
    const g = placesByDistance(r).find(x => x.place.id === 'po_hook')!;
    const html = renderToStaticMarkup(<PlaceCard place={g.place} dist={g.dist} bearing={g.bearing} isDestination onSet={() => {}} onClear={() => {}} />);
    expect(html).toContain('>Visited<');
    expect(html).not.toContain('What is inside');
    expect(html).toContain('data-testid="map-dest-clear"');
  });
});

describe('HUD arrow to the destination', () => {
  it('shows an edge arrow with name and distance when the place is out of view, and a pin with the name when it is in view', () => {
    const { r } = veyra();
    setViewSize(640, 360);
    const far = placesByDistance(r).at(-1)!;
    storeDestination(r, true, far.place.id);
    const v = destinationView(r, true)!;
    const edge = renderToStaticMarkup(<DestinationBeacon dest={v} camX={r.player.x - 320} camY={r.player.y - 180} />);
    expect(edge).toContain('beacon--edge');
    expect(edge).toContain(far.place.name);
    expect(edge).toContain(formatDistance(v.dist));
    const left = Number(/left:(-?[\d.]+)px/.exec(edge)![1]), top = Number(/top:(-?[\d.]+)px/.exec(edge)![1]);
    // inside the HUD's corners and above the hotbar, at 640x360
    expect(left).toBeGreaterThanOrEqual(150); expect(left).toBeLessThanOrEqual(490);
    expect(top).toBeGreaterThanOrEqual(84); expect(top).toBeLessThanOrEqual(292);
    const pin = renderToStaticMarkup(<DestinationBeacon dest={v} camX={v.x - 300} camY={v.y - 200} />);
    expect(pin).not.toContain('beacon--edge');
    expect(pin).toContain(far.place.name);
    expect(renderToStaticMarkup(<DestinationBeacon dest={null} camX={0} camY={0} />)).toBe('');
  });
});
