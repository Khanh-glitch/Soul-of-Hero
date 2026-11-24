// Fog weather draws the same dots as before; this pins the remembered noise field against the plain formula while
// the field drifts, follows the camera in every direction, jumps, and crosses zero.
import { describe, expect, it } from 'vitest';
import { VIEW_H, VIEW_W } from '../src/game/core';
import { fbm } from '../src/game/world';
import { fogDots } from '../src/game/fog-layer';

function plain(ox: number, oy: number) {
  const dots: number[] = [];
  for (let y = 0; y < VIEW_H; y += 2) for (let x = (y >> 1) % 2 * 2; x < VIEW_W; x += 4) if (fbm((x + ox) / 90, (y + oy) / 60, 41, 2) > 0.55) dots.push(x, y);
  return dots;
}
describe('fog dots', () => {
  it('are the dots of the plain formula, in the same order, at every offset the view can take', () => {
    let dots = 0, frames = 0;
    const check = (ox: number, oy: number) => {
      const got = fogDots(ox, oy), want = plain(ox, oy);
      if (got.count * 2 !== want.length) throw Error(`fog differs at offset ${ox},${oy}: ${got.count} dots, expected ${want.length / 2}`);
      for (let i = 0; i < want.length; i++) if (got.xy[i] !== want[i]) throw Error(`fog differs at offset ${ox},${oy}, dot ${i >> 1}`);
      frames++; dots += got.count;
    };
    let ox = 14_285_700, oy = 1060;                           // a real offset: time / 70 + camera / 2
    for (let i = 0; i < 12; i++) check(ox += 1, oy);           // standing: drift only
    check(ox, oy);                                             // same offset again
    for (let i = 0; i < 40; i++) check(ox += 9, oy += 7);      // walking right and down, across several window slides
    for (let i = 0; i < 40; i++) check(ox -= 23, oy -= 11);    // back left and up, faster than the drift
    for (let i = 0; i < 6; i++) check(ox += 1, oy += i % 2);   // row parity flips
    check(ox + 100_000, oy - 50_000); check(ox, oy);           // jumps (window change, floor change) and back
    for (let i = -6; i <= 6; i += 3) check(i, -i);             // around zero and negative offsets
    check(-900, -700); check(-1500, -1300);
    expect(frames).toBe(108); expect(dots).toBeGreaterThan(frames * 500);
  }, 120000);
});
