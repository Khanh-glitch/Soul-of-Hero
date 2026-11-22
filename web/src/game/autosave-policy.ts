/**
 * When the timed autosave runs, and how heavy it is.
 *
 *  - full  : state text + both stores (browser storage and the database). Costs the game thread the most, so the timer
 *            only takes it while a panel covers the play field or the survivor is dead or resting.
 *  - light : state text handed to the background writer (database only). Taken when the survivor has stood still with
 *            no threat near for a moment, or, while they keep moving or fighting, once `AUTOSAVE_MAX_MS` have passed.
 *
 * Saves outside the timer keep their moment: after each player action (light), on death, from the menu, and on tab
 * hide / close (full, immediate).
 */
export const AUTOSAVE_MIN_MS = 5000;
export const AUTOSAVE_MAX_MS = 20000;
/** How long the survivor must have been still before standing counts as a quiet moment. */
export const AUTOSAVE_STILL_MS = 600;
export interface AutosaveMoment { sinceLastMs: number; panelOpen: boolean; deadOrResting: boolean; stillMs: number; threatNear: boolean }
export function autosaveDecision(m: AutosaveMoment): 'wait' | 'full' | 'light' {
  if (m.sinceLastMs <= AUTOSAVE_MIN_MS) return 'wait';
  if (m.panelOpen || m.deadOrResting) return 'full';
  if (m.stillMs >= AUTOSAVE_STILL_MS && !m.threatNear) return 'light';
  return m.sinceLastMs > AUTOSAVE_MAX_MS ? 'light' : 'wait';
}
