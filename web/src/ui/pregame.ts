// ============================================================================
// pregame: the words on the screens before the game (title menu, the wait after
// Continue). Pure functions, so tests can check every line without a browser.
//
// Every line is returned as one whole English string: the Vietnamese overlay
// (ui/i18n-dom.ts) translates what reaches the screen and needs whole sentences.
// ============================================================================

/** A length of absence in the largest two units: "45 min", "3 h 1 min", "3 d 4 h". */
export function awayLabel(ms: number): string {
  const away = Math.max(0, Math.round(ms / 60000));
  return away >= 2880 ? `${Math.floor(away / 1440)} d ${Math.floor(away % 1440 / 60)} h`
    : away >= 60 ? `${Math.floor(away / 60)} h ${away % 60} min` : `${away} min`;
}

/** A running time as m:ss. */
export function clockLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Under the Continue button: where the saved run stands now and how long the player has been gone.
 *  The run clock keeps going while the game is closed, so the day is today's day, capped at the last one. */
export function continueLine(runHoursNow: number, awayMs: number, totalDays = 14): string {
  const day = Math.min(totalDays, Math.max(1, Math.floor(Math.max(0, runHoursNow) / 24) + 1));
  const head = `Day ${day} of ${totalDays}`;
  return awayMs >= 120000 ? `${head} · away ${awayLabel(awayMs)}` : head;
}

/** How a finished run ended, as shown in the run history. */
export function endingLabel(ending: 'evacuated' | 'abandoned' | 'expired'): string {
  return ending === 'evacuated' ? 'Evacuated' : ending === 'expired' ? 'Lost to Ragnarok' : 'Abandoned';
}
