import type { GameState } from '../src/game/core';
/** Explicit proximity fixture used by the C3 access tests (moves the player; does not change any gate). */
export function move_(g: GameState, x: number, y: number) { g.run!.player.x = x; g.run!.player.y = y; }
