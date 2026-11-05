import { useEffect, useRef, useState } from 'react';
import type { GameState } from './game/core';
import { TILE, WW, WH, VIEW_W, VIEW_H } from './game/core';
import { dispatch, markDirty } from './game/engine';
import { settle } from './game/sim';
import { load, save } from './game/persist';
import { getArt } from './game/art';
import { getWorld, setActiveLayout } from './game/world';
import { resetRenderCaches, cam } from './game/render';
import { initAudio, setVolume } from './game/audio';
import { mkIntent } from './ui/common';
import { WMP04_PILOT_SCENES, WMP04R1_ALL } from './game/veyra/wmp04r1';
import Title from './ui/Title';
import Game from './ui/Game';

/** QA fast scene selection: ?pilot=<sceneId>&autostart=1 starts a real run
 *  through the SAME dispatch/save/renderer path as the normal UI.
 *  A `cam=` anchor is an explicit QA view alignment (fast scene selection):
 *  it is NEVER presented as a walked journey. Journey proof uses real WASD input.
 *  `hours=` advances the ORIGINAL SOH day/night clock via the real qaAdvance intent. */
function pilotTarget() {
  const q = new URLSearchParams(window.location.search);
  const id = q.get('pilot');
  if (!id) return null;
  // BEFORE QA layouts are also addressable by URL, but are NOT offered in the
  // five-button creator selector (they exist only for same-camera comparisons).
  const s = WMP04R1_ALL.find(x => x.id === id || x.layoutId === id) || WMP04_PILOT_SCENES.find(x => x.id === id || x.layoutId === id);
  if (!s) return null;
  const camRaw = q.get('cam');
  const anchor = camRaw && /^\d+,\d+$/.test(camRaw)
    ? camRaw.split(',').map(Number) as [number, number]
    : s.viewAnchorTile;
  const seedRaw = q.get('seed');
  const hoursRaw = q.get('hours');
  return {
    id: s.id, layoutId: s.layoutId ?? s.id, anchor,
    autostart: q.get('autostart') === '1',
    seed: seedRaw !== null && /^\d+$/.test(seedRaw) ? Number(seedRaw) : null,
    hours: hoursRaw !== null && Number.isFinite(Number(hoursRaw)) && Number(hoursRaw) >= 0 ? Number(hoursRaw) : null,
  };
}

/** Position the EXISTING player at a walkable dry-land tile inside the selected
 *  scene and align the EXISTING camera. No teleport between checkpoints, no
 *  intermediate path claim, no reward, no structure, no new object. */
function applyPilotView(gs: GameState, anchor: [number, number] | null | undefined, hours: number | null | undefined) {
  if (!gs.run) return { anchor: null, hours: null as number | null };
  let appliedAnchor: [number, number] | null = null, appliedHours: number | null = null;
  if (anchor) {
    const [tx, ty] = anchor, w = getWorld();
    const i = ty * WW + tx;
    if (tx > 2 && ty > 2 && tx < WW - 3 && ty < WH - 3 && w.economyMap.walkable[i]) {
      gs.run.player.x = tx * TILE + 8; gs.run.player.y = ty * TILE + 8;
      gs.run.player.vx = 0; gs.run.player.vy = 0;
      cam.x = Math.max(0, Math.min(WW * TILE - VIEW_W, gs.run.player.x - VIEW_W / 2));
      cam.y = Math.max(0, Math.min(WH * TILE - VIEW_H, gs.run.player.y - VIEW_H / 2 - 6));
      cam.init = true;
      // QA-only: pin the camera for a pixel-identical BEFORE/AFTER comparison.
      // The lock is released by the FIRST real movement keypress in Game.tsx,
      // after which the original player-following camera resumes unchanged.
      (window as any).__wmp04CamLock = { x: cam.x, y: cam.y, note: 'QA same-camera alignment; releases on first WASD input' };
      appliedAnchor = [tx, ty];
      (window as any).__wmp04ViewAnchor = { tx, ty, note: 'QA fast scene selection; NOT a walked journey' };
    }
  }
  if (hours !== null && hours !== undefined && hours > 0) {
    const res = dispatch(gs, mkIntent('qaAdvance', { hours }), Date.now());
    if (res.ok) appliedHours = hours;
  }
  return { anchor: appliedAnchor, hours: appliedHours };
}
export default function App() {
  const gsRef = useRef<GameState | null>(null);
  const [screen, setScreen] = useState<'loading' | 'title' | 'game'>('loading');
  const [note, setNote] = useState<string | undefined>(); const [loadError, setLoadError] = useState<string | null>(null); const [report, setReport] = useState<string[] | null>(null);
  const [summary, setSummary] = useState<GameState['profile']['history'][number] | null>(null);
  const target = pilotTarget();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      getArt();
      const { gs, note } = await load();
      if (cancelled) return;
      if (!gs) { setLoadError(note || 'Save recovery is required.'); return; }
      setActiveLayout(target ? target.layoutId : (gs.run?.layoutId || 'shipping_fresh'));
      if (target) getWorld(target.layoutId); else getWorld();
      gsRef.current = gs; setNote(note);
      setVolume(gs.profile.settings.volume, gs.profile.settings.muted);
      if (target && target.autostart && !gs.run) {
        const res = dispatch(gs, mkIntent('startRun', { character: 'female', region: null, ...(target.seed !== null ? { seed: target.seed } : {}) }), Date.now());
        if (res.ok) {
          applyPilotView(gs, target.anchor, target.hours);
          save(gs); setReport(null); markDirty(); resetRenderCaches(); setScreen('game'); return;
        }
        setNote('Pilot autostart: ' + (res.reason || 'startRun refused'));
      }
      setScreen('title');
    })();
    return () => { cancelled = true; };
  }, []);
  const gs = gsRef.current;
  if (loadError) return <div style={{ padding: 24, color: '#ffd98a', background: '#120c18', minHeight: '100vh' }}><h1>Save recovery required</h1><p>{loadError}</p><p>No new game was started and the original save copies were not overwritten.</p><button onClick={() => window.location.reload()}>Retry</button></div>;
  if (screen === 'loading' || !gs) return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', color: '#ffd98a', fontSize: 22 }} className="title-font">Raising the island…</div>;
  const enter = () => { markDirty(); resetRenderCaches(); cam.init = false; setScreen('game'); };
  return screen === 'title'
    ? <Title gs={gs} note={note} summary={summary} clearSummary={() => setSummary(null)}
        onContinue={() => { initAudio(); const rep = settle(gs, Date.now()); save(gs); if (!gs.run) { setSummary(gs.profile.history[0]); return; } setReport(rep.length ? rep : null); enter(); }}
        onStart={(c, region) => { initAudio(); const res = dispatch(gs, mkIntent('startRun', { character: c, region, ...(target?.seed != null ? { seed: target.seed } : {}) }), Date.now()); if (res.ok) { applyPilotView(gs, target?.anchor, target?.hours); save(gs); setReport(null); enter(); } else setNote(res.reason); }} />
    : <Game gs={gs} report={report} onExit={() => setScreen('title')} onRunEnd={() => { setSummary(gs.profile.history[0] || null); setScreen('title'); }} />;
}
