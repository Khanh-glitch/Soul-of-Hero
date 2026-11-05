import { useEffect, useRef, useState } from 'react';
import type { GameState } from './game/core';
import { dispatch, markDirty } from './game/engine';
import { settle } from './game/sim';
import { load, save } from './game/persist';
import { getArt } from './game/art';
import { getWorld, setActiveLayout } from './game/world';
import { resetRenderCaches, cam } from './game/render';
import { setVolume, initAudio } from './game/audio';
import { mkIntent } from './ui/common';
import Title from './ui/Title';
import Game from './ui/Game';

export default function App() {
  const gsRef = useRef<GameState | null>(null);
  const [screen, setScreen] = useState<'loading' | 'title' | 'game'>('loading');
  const [note, setNote] = useState<string | undefined>(); const [loadError, setLoadError] = useState<string | null>(null); const [report, setReport] = useState<string[] | null>(null);
  const [summary, setSummary] = useState<GameState['profile']['history'][number] | null>(null);
  useEffect(() => { let cancelled = false; (async () => { getArt(); const { gs, note } = await load(); if (cancelled) return; if (!gs) { setLoadError(note || 'Save recovery is required.'); return; } setActiveLayout(gs.run?.layoutId || 'shipping_fresh'); getWorld(); gsRef.current = gs; setNote(note); setVolume(gs.profile.settings.volume, gs.profile.settings.muted); setScreen('title'); })(); return () => { cancelled = true; }; }, []);
  const gs = gsRef.current;
  if (loadError) return <div style={{ padding: 24, color: '#ffd98a', background: '#120c18', minHeight: '100vh' }}><h1>Save recovery required</h1><p>{loadError}</p><p>No new game was started and the original save copies were not overwritten.</p><button onClick={() => window.location.reload()}>Retry</button></div>;
  if (screen === 'loading' || !gs) return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', color: '#ffd98a', fontSize: 22 }} className="title-font">Raising the island…</div>;
  const enter = () => { markDirty(); resetRenderCaches(); cam.init = false; setScreen('game'); };
  return screen === 'title'
    ? <Title gs={gs} note={note} summary={summary} clearSummary={() => setSummary(null)}
        onContinue={() => { initAudio(); const rep = settle(gs, Date.now()); save(gs); if (!gs.run) { setSummary(gs.profile.history[0]); return; } setReport(rep.length ? rep : null); enter(); }}
        onStart={(c, region) => { initAudio(); const res = dispatch(gs, mkIntent('startRun', { character: c, region }), Date.now()); if (res.ok) { save(gs); setReport(null); enter(); } else setNote(res.reason); }} />
    : <Game gs={gs} report={report} onExit={() => setScreen('title')} onRunEnd={() => { setSummary(gs.profile.history[0] || null); setScreen('title'); }} />;
}
