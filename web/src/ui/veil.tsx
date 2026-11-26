// ============================================================================
// veil: a full-screen "one moment" cover for work that holds the page still.
//
// Starting a run and opening a saved one both do seconds of work in one go
// (building the world, then drawing its first frame). While that runs the page
// cannot repaint, so without a cover the player presses a button and nothing
// answers. The cover is put up first, the browser is given a frame to show it,
// and only then the work starts. It comes down when the game screen reports
// that its first frames are drawn.
//
// The moving bar is a CSS transform animation: the browser can keep it going
// without the page's own thread, so it does not freeze with everything else.
// ============================================================================
import { useSyncExternalStore } from 'react';

interface VeilState { line: string; leaving: boolean }
let state: VeilState | null = null;
let token = 0;
const subs = new Set<() => void>();
const emit = () => { for (const f of [...subs]) f(); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** The cover's text, or null when it is down (for tests and the browser harness). */
export const veilLine = (): string | null => (state && !state.leaving ? state.line : null);

export function showVeil(line: string): void { token++; state = { line, leaving: false }; emit(); }

/** Take the cover down (a short fade). Safe to call when it is not up. */
export function hideVeil(): void {
  if (!state || state.leaving) return;
  const mine = ++token; state = { ...state, leaving: true }; emit();
  setTimeout(() => { if (token === mine) { state = null; emit(); } }, 200);
}

/** Run `fn` once the browser has had the chance to paint what is on screen now. A hidden tab paints nothing,
 *  so a timer stands in for the frames there (otherwise Continue would wait for the player to look again). */
export function afterPaint(fn: () => void): void {
  let done = false; const go = () => { if (done) return; done = true; fn(); };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 300);
}

const GIVE_UP_MS = 30000;     // never leave the cover up for good

/** The work behind the cover is done; the game now has to draw. The cover stays until the game says it has
 *  (`gameDrew`), or GIVE_UP_MS as a last resort. Does nothing when the cover is not up.
 *  (Waiting for "frames arrive steadily" was tried first and dropped: on a slow machine the game's first minute is
 *  never steady, and the cover stayed up for the full 30 s over a game that could already be played.) */
export function settleVeil(): void {
  if (!state || state.leaving) return;
  const mine = token;
  setTimeout(() => { if (token === mine) hideVeil(); }, GIVE_UP_MS);
}

/** Called by the game screen once its first two frames have been drawn (Game.tsx): the world is on screen. */
export function gameDrew(): void { hideVeil(); }

/** Put the cover up with `line`, let it be painted, run `work`, and leave it up until the game has drawn.
 *  If `work` throws, the cover comes down at once and the error goes on. `work` may take the cover down itself. */
export function behindVeil(line: string, work: () => void): void {
  showVeil(line); const mine = token;
  afterPaint(() => {
    if (token !== mine) return;
    try { work(); } catch (e) { hideVeil(); throw e; }
    if (token === mine) settleVeil();
  });
}

/** Rendered once, beside the app (main.tsx). */
export function Veil() {
  const s = useSyncExternalStore(subscribe, () => state, () => null);
  if (!s) return null;
  return <div className={`boot boot--veil${s.leaving ? ' boot--leaving' : ''}`} role="status" aria-live="polite" data-testid="busy-veil">
    <div className="boot__name" data-notr>SOUL OF HERO</div>
    <div className="boot__bar"><i /></div>
    <div className="boot__line">{s.line}</div>
  </div>;
}
