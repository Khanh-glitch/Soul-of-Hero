// The view takes the window's shape (640x360 up to 768x400) so a browser window that is not exactly 16:9 has no
// black bars. These tests pin the three promises of that change:
//   1. a 16:9 window is exactly the old 640x360 stage;
//   2. between 16:10 and 19.2:9 the view fills the window (what is left over is under two stage pixels);
//   3. game rules never read the view: "in view" stays the 640x360 frame.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { VIEW_W, VIEW_H, WW, WH, TILE } from '../src/game/core';
import { fitStageView, setViewSize, viewInsetX, viewInsetY, MAX_VIEW_W, MAX_VIEW_H } from '../src/game/viewport';
import * as viewport from '../src/game/viewport';
import { computeStageFit, computeStageView } from '../src/visual/direction';
import { fogDots } from '../src/game/fog-layer';
import { fbm } from '../src/game/world';

afterEach(() => { setViewSize(VIEW_W, VIEW_H); });

describe('view size for a window', () => {
  it('a 16:9 window is the 640x360 stage, exactly as before', () => {
    for (const [W, H] of [[640, 360], [1280, 720], [1600, 900], [1920, 1080], [2560, 1440], [3840, 2160], [1366, 768.375]] as const) {
      const v = fitStageView(W, H, 'fit'), old = computeStageFit(W, H, VIEW_W, VIEW_H, 'fit');
      expect([v.w, v.h], `${W}x${H}`).toEqual([VIEW_W, VIEW_H]);
      expect(v.k).toBeCloseTo(old.k, 9); expect(v.x).toBe(old.x); expect(v.y).toBe(old.y);
    }
  });

  it('real browser windows: no side bars where there used to be 104 px and 112 px', () => {
    // [window, view] — the first two are the windows measured on the QA build before the change.
    const cases: [number, number, number, number][] = [
      [1366, 651, 754, 360],   // 1366x768 laptop, browser chrome on
      [1920, 953, 724, 360],   // 1080p monitor, browser chrome on
      [1536, 730, 756, 360],   // 1080p at 125 % Windows scaling
      [1440, 900, 640, 400],   // 16:10 laptop
      [1280, 800, 640, 400],
      [2560, 1600, 640, 400],
    ];
    for (const [W, H, w, h] of cases) {
      const v = fitStageView(W, H, 'fit');
      expect([v.w, v.h], `${W}x${H}`).toEqual([w, h]);
      expect(W - v.w * v.k, `${W}x${H} bars left+right`).toBeLessThan(2 * v.k + 1e-6);
      expect(H - v.h * v.k, `${W}x${H} bars top+bottom`).toBeLessThan(2 * v.k + 1e-6);
    }
  });

  it('beyond the limits the view stops growing and the rest is border', () => {
    const phone = fitStageView(844, 390, 'fit');            // 19.5:9 phone held sideways
    expect([phone.w, phone.h]).toEqual([MAX_VIEW_W, 360]); expect(phone.x).toBe(6); expect(phone.y).toBe(0);
    const ultra = fitStageView(2560, 1080, 'fit');          // 21:9 monitor
    expect([ultra.w, ultra.h, ultra.k]).toEqual([MAX_VIEW_W, 360, 3]); expect(ultra.x).toBe(128);
    const old43 = fitStageView(1024, 768, 'fit');           // 4:3
    expect([old43.w, old43.h]).toEqual([640, MAX_VIEW_H]); expect(old43.k).toBeCloseTo(1.6, 9); expect(old43.y).toBe(64);
  });

  it('never exceeds the window, never leaves the allowed sizes, for any window', () => {
    for (let W = 320; W <= 3840; W += 37) for (let H = 200; H <= 2160; H += 41) for (const mode of ['fit', 'integer'] as const) {
      const v = fitStageView(W, H, mode);
      if (v.w < VIEW_W || v.w > MAX_VIEW_W || v.h < VIEW_H || v.h > MAX_VIEW_H || v.w % 2 || v.h % 2) throw Error(`${mode} ${W}x${H}: view ${v.w}x${v.h}`);
      if (v.w * v.k > W + 1e-6 || v.h * v.k > H + 1e-6 || v.x < 0 || v.y < 0) throw Error(`${mode} ${W}x${H}: view ${v.w}x${v.h} at ${v.k} overflows`);
      const a = W / H;
      if (mode === 'fit' && a >= 1.6 && a <= MAX_VIEW_W / VIEW_H && (W - v.w * v.k > 2 * v.k + 1e-6 || H - v.h * v.k > 2 * v.k + 1e-6)) throw Error(`fit ${W}x${H}: bars inside the supported shapes`);
      // never smaller on screen than the old stage was
      if (v.k + 1e-9 < computeStageFit(W, H, VIEW_W, VIEW_H, mode).k) throw Error(`${mode} ${W}x${H}: scale dropped`);
    }
  });

  it('whole-pixel mode keeps its whole scale and shows as much as that scale has room for', () => {
    const v = fitStageView(1920, 953, 'integer');
    expect(v.k).toBe(2); expect([v.w, v.h]).toEqual([768, 400]); expect([v.x, v.y]).toEqual([192, 76]);
    expect(fitStageView(1280, 720, 'integer')).toMatchObject({ w: 640, h: 360, k: 2, x: 0, y: 0 });
    expect(fitStageView(500, 300, 'integer').k).toBeCloseTo(500 / 640, 9);   // below 1x it still shrinks to fit
  });

  it('"Classic 16:9" is the old behaviour at every size', () => {
    for (const [W, H] of [[1366, 651], [1920, 953], [1440, 900], [844, 390], [1024, 768]] as const) for (const mode of ['fit', 'integer'] as const) {
      const v = computeStageView(W, H, { stageScale: mode, stageView: 'classic' }), old = computeStageFit(W, H, VIEW_W, VIEW_H, mode);
      expect(v).toEqual({ w: VIEW_W, h: VIEW_H, k: old.k, x: old.x, y: old.y });
    }
    expect(computeStageView(1366, 651, { stageScale: 'fit', stageView: 'wide' }).w).toBe(754);
  });
});

describe('the live view size', () => {
  it('starts at 640x360, clamps, stays even, and reports changes', () => {
    expect([viewport.viewW, viewport.viewH]).toEqual([640, 360]);
    expect(setViewSize(640, 360)).toBe(false);
    expect(setViewSize(755, 361)).toBe(true); expect([viewport.viewW, viewport.viewH]).toEqual([754, 360]);
    expect(setViewSize(5000, 5000)).toBe(true); expect([viewport.viewW, viewport.viewH]).toEqual([MAX_VIEW_W, MAX_VIEW_H]);
    expect(setViewSize(10, NaN)).toBe(true); expect([viewport.viewW, viewport.viewH]).toEqual([640, 360]);
  });

  it('the 640x360 rule frame is centred in it', () => {
    setViewSize(768, 400); expect([viewInsetX(), viewInsetY()]).toEqual([64, 20]);
    setViewSize(724, 360); expect([viewInsetX(), viewInsetY()]).toEqual([42, 0]);
    setViewSize(640, 360); expect([viewInsetX(), viewInsetY()]).toEqual([0, 0]);
  });

  it('the widest view never reaches the edge of the loaded VEYRA window before it slides', () => {
    // continuity.ts slides the window when the player is within EDGE_MARGIN tiles of its edge.
    const src = readFileSync(new URL('../src/veyra05/continuity.ts', import.meta.url), 'utf8');
    const margin = Number(/const EDGE_MARGIN = (\d+);/.exec(src)?.[1]);
    expect(margin).toBeGreaterThan(0);
    expect(MAX_VIEW_W / 2).toBeLessThanOrEqual(margin * TILE);
    expect(MAX_VIEW_H / 2 + 6).toBeLessThanOrEqual(margin * TILE);       // the camera sits 6 px above the player
    expect(MAX_VIEW_W).toBeLessThan(WW * TILE); expect(MAX_VIEW_H).toBeLessThan(WH * TILE);
  });
});

describe('game rules do not depend on the window', () => {
  it('no simulation module reads the live view size', () => {
    // Anything that decides an outcome must use VIEW_W / VIEW_H (640x360), never the drawn size.
    for (const f of ['game/sim.ts', 'game/human-core-tactics.ts', 'game/engine.ts', 'game/humanworld.ts', 'game/core.ts', 'veyra05/continuity.ts']) {
      const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
      expect(/from '[./]+(game\/)?viewport'/.test(src), f).toBe(false);
    }
    const sim = readFileSync(new URL('../src/game/sim.ts', import.meta.url), 'utf8');
    expect(sim).toContain('x-VIEW_W/2,0,WW*TILE-VIEW_W');                // the "whole screen" skills still measure 640x360
  });

  it('the game hands the rules the 640x360 frame, not the camera corner', () => {
    const src = readFileSync(new URL('../src/ui/Game.tsx', import.meta.url), 'utf8');
    expect(src).toContain('i.viewX=Math.round(cam.x)+viewInsetX(); i.viewY=Math.round(cam.y)+viewInsetY();');
    expect(src).toContain('viewX:vx+viewInsetX(),viewY:vy+viewInsetY()');   // the aim locked when a skill key is pressed
    expect(src).not.toMatch(/viewX: ?vx,/);
  });
});

describe('fog dots at a larger view', () => {
  const plain = (ox: number, oy: number, w: number, h: number) => {
    const dots: number[] = [];
    for (let y = 0; y < h; y += 2) for (let x = (y >> 1) % 2 * 2; x < w; x += 4) if (fbm((x + ox) / 90, (y + oy) / 60, 41, 2) > 0.55) dots.push(x, y);
    return dots;
  };
  it('cover the whole view, match the plain formula, and follow a resize at once', () => {
    let ox = 14_285_700, oy = 1060;
    const check = (w: number, h: number) => {
      const got = fogDots(ox, oy), want = plain(ox, oy, w, h);
      expect(got.count * 2, `${w}x${h} at ${ox},${oy}`).toBe(want.length);
      for (let i = 0; i < want.length; i++) if (got.xy[i] !== want[i]) throw Error(`fog differs at ${w}x${h}, dot ${i >> 1}`);
      return got.count;
    };
    const small = check(640, 360);
    setViewSize(768, 400);
    const big = check(768, 400);                              // same offset, new size: the remembered list is not reused
    expect(big).toBeGreaterThan(small);
    for (let i = 0; i < 20; i++) { ox += 9; oy += 7; check(768, 400); }
    for (let i = 0; i < 20; i++) { ox -= 23; oy -= 11; check(768, 400); }
    setViewSize(724, 360); check(724, 360);
    setViewSize(640, 360); expect(check(640, 360)).toBeLessThan(big);
  }, 120000);
});
