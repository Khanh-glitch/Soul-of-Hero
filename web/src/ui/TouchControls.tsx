// ============================================================================
// TouchControls: on-screen stick and buttons, so the game can be played with
// fingers. Before this, the world only listened to a mouse and a keyboard.
//
//   left side of the stage   floating stick: touch anywhere, drag to walk;
//                            the character also aims where it walks
//   bottom right             Hit (hold), Use (the interact key), Roll
//   under the vitals plate   Pack, Map, Build (TouchScreens, part of the HUD column)
//   tap the world            aims and swings there (the browser's own
//                            tap -> mouse events already did this)
//
// It owns no game rule: it only fills the same Input the keyboard fills and
// sends the same key codes.
// ============================================================================
import { useEffect, useRef, useState } from 'react';

export interface TouchApi {
  /** Stick direction as a unit vector, or null when the stick is released. */
  onStick: (dir: { x: number; y: number } | null) => void;
  onAttack: (down: boolean) => void;
  /** Press a key the game already handles (`code` as in KeyboardEvent.code). */
  onKey: (code: string) => void;
}

const DEAD = 7;          // stage pixels before the stick counts as pushed
const REACH = 26;        // stick travel in stage pixels

export function TouchControls({ api, panelOpen, building, useLabel }: { api: TouchApi; panelOpen: boolean; building: boolean; useLabel: string | null }) {
  const zone = useRef<HTMLDivElement>(null);
  const stick = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const [knob, setKnob] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null);
  const apiRef = useRef(api); apiRef.current = api;

  const release = () => { stick.current = null; setKnob(null); apiRef.current.onStick(null); };
  // a panel opening or the page losing focus must never leave the character walking
  useEffect(() => { if (panelOpen) release(); }, [panelOpen]);
  useEffect(() => { const off = () => { release(); apiRef.current.onAttack(false); }; window.addEventListener('blur', off); return () => { window.removeEventListener('blur', off); off(); }; }, []);

  /** Pointer position in stage pixels, whatever the stage is scaled to. */
  const local = (e: React.PointerEvent) => { const r = zone.current!.getBoundingClientRect(); const k = r.width / zone.current!.offsetWidth || 1; return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; };
  const down = (e: React.PointerEvent) => {
    if (stick.current) return;
    e.preventDefault(); e.stopPropagation();
    const p = local(e); stick.current = { id: e.pointerId, ox: p.x, oy: p.y };
    try { zone.current!.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
    setKnob({ ox: p.x, oy: p.y, dx: 0, dy: 0 });
  };
  const move = (e: React.PointerEvent) => {
    const s = stick.current; if (!s || s.id !== e.pointerId) return;
    e.preventDefault();
    const p = local(e); let dx = p.x - s.ox, dy = p.y - s.oy; const len = Math.hypot(dx, dy);
    if (len > REACH) { dx *= REACH / len; dy *= REACH / len; }
    setKnob({ ox: s.ox, oy: s.oy, dx, dy });
    const n = Math.max(Math.hypot(dx, dy), 1e-6);
    apiRef.current.onStick(len < DEAD ? null : { x: dx / n, y: dy / n });
  };
  const up = (e: React.PointerEvent) => { if (stick.current?.id === e.pointerId) release(); };

  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };
  const hold = (on: (down: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ } on(true); },
    onPointerUp: (e: React.PointerEvent) => { e.stopPropagation(); on(false); },
    onPointerCancel: () => on(false),
    onMouseDown: stop, onMouseUp: stop, onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const tap = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); apiRef.current.onKey(code); },
    onMouseDown: stop, onMouseUp: stop, onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  if (panelOpen) return null;
  return <>
    <div ref={zone} className="touch-zone" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onMouseDown={stop} onMouseUp={stop} onContextMenu={e => e.preventDefault()} aria-hidden="true">
      {knob ? <div className="touch-stick" style={{ left: knob.ox, top: knob.oy }}><i style={{ transform: `translate(${knob.dx}px, ${knob.dy}px)` }} /></div>
        : <div className="touch-stick touch-stick--rest"><i /></div>}
    </div>
    {!building && <div className="touch-pad" role="group" aria-label="Actions">
      <button className="touch-btn touch-btn--roll" {...tap('Space')}>Roll</button>
      <button className={`touch-btn touch-btn--use ${useLabel ? 'ready' : ''}`} title={useLabel ?? undefined} {...tap('KeyF')}>Use</button>
      <button className="touch-btn touch-btn--hit" {...hold(d => apiRef.current.onAttack(d))}>Hit</button>
    </div>}
  </>;
}

/** Pack / Map / Build for fingers. Lives in the left HUD column so the chips and alerts below it simply move down. */
export function TouchScreens({ api, building }: { api: TouchApi; building: boolean }) {
  const tap = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); api.onKey(code); },
    onMouseDown: (e: React.SyntheticEvent) => e.stopPropagation(), onMouseUp: (e: React.SyntheticEvent) => e.stopPropagation(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  return <div className="touch-side" role="group" aria-label="Screens">
    <button className="touch-btn touch-btn--sm" {...tap('KeyI')}>Pack</button>
    <button className="touch-btn touch-btn--sm" {...tap('KeyM')}>Map</button>
    <button className={`touch-btn touch-btn--sm ${building ? 'on' : ''}`} {...tap('KeyB')}>{building ? 'Done' : 'Build'}</button>
  </div>;
}
