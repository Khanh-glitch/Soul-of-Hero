// ============================================================================
// ScreenFit: what the page can do when the window is the wrong shape or size.
//
// The whole interface is drawn on a 640x360 stage that is scaled to the
// window. It cannot rearrange itself, so:
//   - a phone held upright gets a "turn it sideways" screen (upright, every
//     label is under half the size it has sideways);
//   - a small desktop window gets one dismissible line that says how to get
//     readable text;
//   - full screen is one button (and locks a phone to landscape where the
//     browser allows it).
// ============================================================================
import { useEffect, useState, useSyncExternalStore } from 'react';
import { isTouchDevice } from '../visual/direction';

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

export const fullscreenSupported = (): boolean => typeof document !== 'undefined'
  && !!((document.documentElement as FsEl).requestFullscreen || (document.documentElement as FsEl).webkitRequestFullscreen);
export const isFullscreen = (): boolean => typeof document !== 'undefined' && !!(document.fullscreenElement || (document as FsDoc).webkitFullscreenElement);
/** Enter or leave full screen. Resolves to the state reached; a refusal by the browser is not an error. */
export async function toggleFullscreen(): Promise<boolean> {
  try {
    if (isFullscreen()) { await (document.exitFullscreen?.() ?? (document as FsDoc).webkitExitFullscreen?.()); return false; }
    const el = document.documentElement as FsEl;
    await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.());
    try { await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape'); } catch { /* desktop browsers and iOS refuse; harmless */ }
    return isFullscreen();
  } catch { return isFullscreen(); }
}
const subFs = (f: () => void) => { document.addEventListener('fullscreenchange', f); document.addEventListener('webkitfullscreenchange', f); return () => { document.removeEventListener('fullscreenchange', f); document.removeEventListener('webkitfullscreenchange', f); }; };
export function useFullscreen(): boolean { return useSyncExternalStore(subFs, isFullscreen, () => false); }

function useWindowSize() {
  const [s, set] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => { const f = () => set({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', f); window.addEventListener('orientationchange', f); return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); }; }, []);
  return s;
}

/** Stage scale below which 8px labels are under 10 screen pixels tall. */
const SMALL = 1.25;

export function ScreenFit() {
  const { w, h } = useWindowSize();
  const [upright, setUpright] = useState(false);   // the player chose to stay upright
  const [hidden, setHidden] = useState(false);     // the small-window line was dismissed
  const fs = useFullscreen();
  const touch = isTouchDevice();
  const scale = Math.min(w / 640, h / 360);

  if (touch && h > w * 1.15 && !upright) {
    return <div className="fit-gate" role="dialog" aria-label="Turn your phone sideways">
      <div className="fit-gate__phone" aria-hidden="true"><i /></div>
      <b>Turn your phone sideways</b>
      <p>The game is drawn for a wide screen. Held upright, everything is less than half the size.</p>
      {fullscreenSupported() && <button className="fit-gate__btn fit-gate__btn--gold" onClick={() => { void toggleFullscreen(); }}>Full screen, sideways</button>}
      <button className="fit-gate__btn" onClick={() => setUpright(true)}>Play upright anyway</button>
    </div>;
  }
  if (!touch && scale < SMALL && !hidden && !fs) {
    return <div className="fit-hint" role="status">
      <span>{fullscreenSupported() ? 'Small window: the text is hard to read at this size. Enlarge the window or go full screen.' : 'Small window: the text is hard to read at this size. Enlarge the window.'}</span>
      {fullscreenSupported() && <button onClick={() => { void toggleFullscreen(); }}>Full screen</button>}
      <button onClick={() => setHidden(true)} aria-label="Hide this message">Hide</button>
    </div>;
  }
  return null;
}
