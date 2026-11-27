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

/** Under Continue, and in the summary of a backup: like continueLine, but a run whose days are used up says so
 *  (opening it shows how it ended; it can no longer be played or abandoned). */
export function savedRunLine(runHoursNow: number, awayMs: number, totalDays = 14): string {
  if (runHoursNow >= totalDays * 24) return `The ${totalDays} days have run out · away ${awayLabel(awayMs)}`;
  return continueLine(runHoursNow, awayMs, totalDays);
}

// ---- "How to play" on the title screen ---------------------------------------------------------------------------
// Every line states something the game already does (the rule or the key is in the code and in the Esc menu); none of
// it is a new rule. Whole sentences, one per entry, for the Vietnamese overlay.

/** What a run is, in the order a newcomer needs it. */
export const HELP_RULES: readonly string[] = [
  'A run lasts 14 real days. The island keeps living while the game is closed.',
  'Gather wood and stone, build a shelter, craft better gear, explore. The handbook in the game (J) teaches each part, in any order.',
  'The last 72 hours are Ragnarok: sealed vaults open and the Elders stir.',
  'When the run ends, everything on the island is wiped: gear, home, recipes and the cash you carry.',
  'Only Ragnarok cash deposited in an Escrow Chest stays in your profile for later runs.',
  'If you fall, what you carry stays in a bag there. You wake at your bed or on a safe shore, and the run goes on.',
];

/** Keyboard and mouse: the key as printed on it, and what it does. */
export const HELP_KEYS: readonly (readonly [string, string])[] = [
  ['W A S D', 'walk'],
  ['Mouse', 'aim'],
  ['Left button', 'strike, or use what is in hand'],
  ['Space', 'dodge roll'],
  ['E', 'use what is in front of you'],
  ['1–8', 'pick a quick slot'],
  ['I', 'pack'],
  ['C', 'craft'],
  ['B', 'build'],
  ['M', 'map'],
  ['J', 'journey and handbook'],
  ['N', 'notes'],
  ['Tab', 'skills'],
  ['Esc', 'menu, save and quit'],
];

/** Touch screens: the same actions on the screen itself. */
export const HELP_TOUCH: readonly string[] = [
  'Drag on the left half of the screen to walk.',
  'Tap the world to aim and strike there.',
  'Bottom right: Hit, Use, Roll.',
  'Under the status plate: Pack, Map, Build.',
];

/** Whose work is in the game besides its own code (THIRD_PARTY.md). */
export const CREDIT_LINES: readonly string[] = [
  'Fonts: VT323 by Peter Hull, Pixelify Sans by Stefie Justprince, Noto Sans Symbols by the Noto Project Authors (SIL Open Font License 1.1).',
  'Every picture and every sound is made by the code of the game itself. No outside art or sound files are used.',
];
