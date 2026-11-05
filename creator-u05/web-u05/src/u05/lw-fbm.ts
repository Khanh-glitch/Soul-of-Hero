/** LW-01 compat.ts fbm (verbatim body) — reproduces the locked U=0.5 Beacon benchmark.
 *  Source: large-world-01/web-large/src/game/large/compat.ts @ 38d13514d20b089b6fcbf0fa78d605086c50385c
 *  Live Gameplay world.ts fbm differs; it is recorded but NOT used here because the
 *  Creator-approved visual reference was produced with this compat implementation. */
import { hash2 } from '../game/core';

export function fbm(x: number, y: number, s: number, _oct = 4) {
  const n = (a: number, b: number, c: number) => hash2(Math.floor(a * 64), Math.floor(b * 64), c + s);
  return (n(x, y, 1) + n(x * 2, y * 2, 2) * 0.5 + n(x * 4, y * 4, 3) * 0.25) / 1.75;
}
