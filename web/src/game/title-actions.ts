// ============================================================================
// title-actions: what the title screen can do to a saved run without opening
// the game.
//
// Abandon. The rule is the one the Esc menu already applies: the `abandon`
// command of the engine, on a run that is up to date. From the title the run
// is not up to date (the player has been away), so the caller first works out
// the time away exactly as Continue does, and this function then
//   - brings the run to `now` (the seconds that passed meanwhile),
//   - wakes a resting player (the engine refuses every command but "wake"
//     while resting; in the game the player would press Wake first), and
//   - sends `abandon`.
// A run whose 14 days ran out before `now` is not abandoned: it has already
// ended as "expired", and that is what the chronicle shows.
// ============================================================================
import type { GameState } from './core';
import { dispatch } from './engine';
import { settleWithReturn } from './return-report';

export type AbandonOutcome =
  | { ok: true; ending: 'abandoned' | 'expired' | 'evacuated' }
  | { ok: false; reason: string };

const intent = (type: string, now: number) => ({ id: `${type}-title-${Math.floor(now).toString(36)}-${Math.random().toString(36).slice(2, 8)}`, type });

export function abandonSavedRun(gs: GameState, now: number): AbandonOutcome {
  if (!gs.run) return { ok: false, reason: 'No active run.' };
  if (now > gs.run.clock.lastSimAt) settleWithReturn(gs, now);
  // The run ended by its own rules while the last seconds were worked out.
  if (!gs.run) return { ok: true, ending: gs.profile.history[0]?.ending ?? 'expired' };
  if (gs.run.rest) { const woke = dispatch(gs, intent('restCancel', now), now); if (!woke.ok) return { ok: false, reason: woke.reason }; }
  const res = dispatch(gs, intent('abandon', now), now);
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, ending: 'abandoned' };
}
