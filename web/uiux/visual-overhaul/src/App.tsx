import { useEffect, useRef, useState } from 'react';
import type { GameState } from './game/core';
import { dispatch, markDirty, mkStack } from './game/engine';
import { settleWithReturn, type OfflineReturnV1 } from './game/return-report';
import { load, save } from './game/persist';
import { getArt } from './game/art';
import { getActiveLayout, getWorld, setActiveLayout } from './game/world';
import { resetRenderCaches, cam } from './game/render';
import { setVolume, initAudio } from './game/audio';
import { mkIntent } from './ui/common';
import { buildQaSandbox, type QaPresetId } from './game/qa-sandbox';
import Title from './ui/Title';
import Game from './ui/Game';

export default function App() {
  const gsRef = useRef<GameState | null>(null);
  const qaGsRef = useRef<GameState | null>(null);
  const qaReturnLayoutRef = useRef<string | null>(null);
  const [qaMode, setQaMode] = useState(false);
  const [qaPreset, setQaPreset] = useState<QaPresetId>('full_gear');
  const [qaHero, setQaHero] = useState<'male' | 'female'>('female');
  const [screen, setScreen] = useState<'loading' | 'title' | 'game'>('loading');
  const [note, setNote] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [report, setReport] = useState<{ lines: string[]; report: OfflineReturnV1 | null } | null>(null);
  const [initialBanner, setInitialBanner] = useState<{ text: string; sub: string } | null>(null);
  const [summary, setSummary] = useState<GameState['profile']['history'][number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      getArt();
      const { gs, note } = await load();
      if (cancelled) return;
      if (!gs) { setLoadError(note || 'Save recovery is required.'); return; }
      setActiveLayout(gs.run?.layoutId || 'shipping_fresh');
      getWorld();
      gsRef.current = gs;
      setNote(note);
      setVolume(gs.profile.settings.volume, gs.profile.settings.muted);
      setScreen('title');
    })();
    return () => { cancelled = true; };
  }, []);

  const gs = qaMode ? qaGsRef.current : gsRef.current;
  if (loadError) return <div style={{ padding: 24, color: '#ffd98a', background: '#120c18', minHeight: '100vh' }}><h1>Save recovery required</h1><p>{loadError}</p><p>No new game was started and the original save copies were not overwritten.</p><button onClick={() => window.location.reload()}>Retry</button></div>;
  if (screen === 'loading' || !gs) return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', color: '#ffd98a', fontSize: 22 }} className="title-font">Raising the island…</div>;

  const enter = (dirty = true) => { if (dirty) markDirty(); resetRenderCaches(); cam.init = false; setScreen('game'); };

  const leaveQa = () => {
    setQaMode(false);
    qaGsRef.current = null;
    setReport(null);
    setInitialBanner(null);
    const layout = qaReturnLayoutRef.current || gsRef.current?.run?.layoutId || 'shipping_fresh';
    setActiveLayout(layout);
    getWorld(layout);
    qaReturnLayoutRef.current = null;
    setScreen('title');
  };

  const launchQa = (preset: QaPresetId, c: 'male' | 'female') => {
    initAudio();
    if (!qaMode) qaReturnLayoutRef.current = getActiveLayout();
    const built = buildQaSandbox(preset, c, Date.now());
    qaGsRef.current = built.gs;
    setQaMode(true);
    setQaPreset(preset);
    setQaHero(c);
    setReport(built.report);
    setInitialBanner(built.banner || null);
    enter(false);
  };

  return screen === 'title'
    ? <Title
        gs={gsRef.current!}
        note={note}
        summary={summary}
        clearSummary={() => setSummary(null)}
        onContinue={() => {
          initAudio();
          setQaMode(false);
          setInitialBanner(null);
          const prod = gsRef.current!;
          const rep = settleWithReturn(prod, Date.now());
          save(prod);
          if (!prod.run) { setSummary(prod.profile.history[0]); return; }
          setReport(rep.lines.length || (rep.report && !rep.report.away.quiet) ? rep : null);
          enter();
        }}
        onStart={(c, region) => {
          initAudio();
          setQaMode(false);
          setInitialBanner(null);
          const prod = gsRef.current!;
          const res = dispatch(prod, mkIntent('startRun', { character: c, region }), Date.now());
          if (res.ok) {
            if (import.meta.env.VITE_FX_TEST === '1' && prod.run) {
              const r = prod.run, inv = r.custody.inv;
              const keys = ['core_blast', 'core_meteor', 'core_dragon', 'core_elsa', 'core_earthmother', 'core_mjolnir', 'core_demon', 'core_fire', 'core_earth', 'core_storm', 'core_frost'];
              const initial = inv.slots.filter(Boolean);
              inv.slots = Array(128).fill(null);
              let i = 0;
              for (let n = 0; n < 10; n++) for (const key of keys) { const core = mkStack(r, key, 1); if (core.reserves) core.reserves = { basic: 40, refined: 12, signature: 4 }; inv.slots[i++] = core; }
              for (const item of initial) inv.slots[i++] = item;
              r.qaUsed = true;
            }
            save(prod);
            setReport(null);
            enter();
          } else setNote(res.reason);
        }}
        onStartQa={launchQa}
      />
    : <Game
        gs={gs}
        report={report}
        initialBanner={initialBanner}
        qaMode={qaMode}
        qaPreset={qaPreset}
        onSwitchQaPreset={(p) => launchQa(p, qaHero)}
        onExit={() => { if (qaMode) leaveQa(); else setScreen('title'); }}
        onRunEnd={() => {
          if (qaMode) { setSummary(gs.profile.history[0] || null); leaveQa(); return; }
          setSummary(gs.profile.history[0] || null);
          setScreen('title');
        }}
      />;
}
