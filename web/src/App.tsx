import { useEffect, useRef, useState } from 'react';
import type { GameState } from './game/core';
import { dispatch, markDirty, mkStack, startRun } from './game/engine';
import { settleWithReturn, type OfflineReturnV1 } from './game/return-report';
import { load, save } from './game/persist';
import { getArt } from './game/art';
import { getWorld, setActiveLayout } from './game/world';
import { U05_WORLD_LAYOUT_ID, isVeyra05Layout } from './veyra05/scenes';
import { getWindowWorld } from './veyra05/window';
import { syncFloor } from './veyra05/floors';
import Inspector from './veyra05/inspector/Inspector';
import { resetRenderCaches, cam } from './game/render';
import { setVolume, initAudio } from './game/audio';
import { mkIntent } from './ui/common';
import Title from './ui/Title';
import Game from './ui/Game';

export default function App() {
  const gsRef = useRef<GameState | null>(null);
  const [screen, setScreen] = useState<'loading' | 'title' | 'game' | 'inspector'>('loading');
  const [inspectionGs, setInspectionGs] = useState<GameState | null>(null);
  const [note, setNote] = useState<string | undefined>(); const [loadError, setLoadError] = useState<string | null>(null); const [report, setReport] = useState<{ lines: string[]; report: OfflineReturnV1 | null } | null>(null);
  const [summary, setSummary] = useState<GameState['profile']['history'][number] | null>(null);
  useEffect(() => { let cancelled = false; (async () => { getArt(); const { gs, note } = await load(); if (cancelled) return; if (!gs) { setLoadError(note || 'Save recovery is required.'); return; } setActiveLayout(gs.run?.layoutId || U05_WORLD_LAYOUT_ID); getWorld(); gsRef.current = gs; setNote(note); setVolume(gs.profile.settings.volume, gs.profile.settings.muted); setScreen('title'); })(); return () => { cancelled = true; }; }, []);
  const savedGs = gsRef.current;
  const gs = inspectionGs ?? savedGs;
  if (loadError) return <div style={{ padding: 24, color: '#ffd98a', background: '#120c18', minHeight: '100vh' }}><h1>Save recovery required</h1><p>{loadError}</p><p>No new game was started and the original save copies were not overwritten.</p><button onClick={() => window.location.reload()}>Retry</button></div>;
  if (screen === 'loading' || !gs || !savedGs) return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', color: '#ffd98a', fontSize: 22 }} className="title-font">Raising the island…</div>;

  const enter = () => {
    if (gs.run?.layoutId) {
      setActiveLayout(gs.run.layoutId);
      if (isVeyra05Layout(gs.run.layoutId)) {
        const ww = getWindowWorld(gs.run.layoutId);
        syncFloor(gs, ww, ww.floors, markDirty);
      }
    }
    markDirty(); resetRenderCaches(); cam.init = false; setScreen('game');
  };
  const openInspector = () => {
    setScreen('inspector');
  };
  const closeInspector = () => {
    setInspectionGs(null);
    setActiveLayout(savedGs.run?.layoutId || U05_WORLD_LAYOUT_ID);
    if (savedGs.run && !savedGs.run.ended) {
      const ww = isVeyra05Layout(savedGs.run.layoutId || '') ? getWindowWorld(savedGs.run.layoutId!) : null;
      if (ww) syncFloor(savedGs, ww, ww.floors, markDirty);
      markDirty(); resetRenderCaches(); cam.init = false;
      setScreen('game');
    } else setScreen('title');
  };
  const launchInspection = (layoutId: string, tx: number, ty: number, label: string) => {
    if (!isVeyra05Layout(layoutId)) { setNote('Invalid creator location.'); return; }
    const qa = structuredClone(savedGs);
    qa.run = null;
    (qa as any).__ephemeralInspect = true;
    setActiveLayout(layoutId);
    const outcome = startRun(qa, 'female', Date.now(), null, 20261109, { tx, ty });
    if (!outcome.ok) {
      setNote('Inspection blocked at ' + label + ': ' + outcome.reason);
      setActiveLayout(savedGs.run?.layoutId || U05_WORLD_LAYOUT_ID);
      return;
    }
    qa.run!.qaUsed = true;
    setInspectionGs(qa);
    markDirty(); resetRenderCaches(); cam.init = false;
    setScreen('game');
  };
  if (screen === 'inspector') return <Inspector gs={savedGs} initialMode="creator"
    onClose={closeInspector} onLaunchCreatorInspect={launchInspection} />;
  return screen === 'title'
    ? <Title gs={savedGs} note={note} summary={summary} clearSummary={() => setSummary(null)}
        onInspect={openInspector}
        onContinue={() => { initAudio(); const rep = settleWithReturn(savedGs, Date.now()); save(savedGs); if (!savedGs.run) { setSummary(savedGs.profile.history[0]); return; } setReport(rep.lines.length || (rep.report && !rep.report.away.quiet) ? rep : null); enter(); }}
        onStart={(c, region) => {
          initAudio();
          setActiveLayout(U05_WORLD_LAYOUT_ID);
          const res = dispatch(savedGs, mkIntent('startRun', { character: c, region }), Date.now());
          if (res.ok) {
            if (import.meta.env.VITE_FX_TEST === '1' && savedGs.run) {
              const r = savedGs.run, inv = r.custody.inv;
              const keys = ['core_blast','core_meteor','core_dragon','core_elsa','core_earthmother','core_mjolnir','core_demon','core_fire','core_earth','core_storm','core_frost'];
              const initial = inv.slots.filter(Boolean);
              inv.slots = Array(128).fill(null);
              let i = 0;
              for (let n = 0; n < 10; n++) for (const key of keys) { const core = mkStack(r, key, 1); if (core.reserves) core.reserves = { basic: 40, refined: 12, signature: 4 }; inv.slots[i++] = core; }
              for (const item of initial) inv.slots[i++] = item;
              r.qaUsed = true;
            }
            save(savedGs); setReport(null); enter();
          } else setNote(res.reason);
        }} />
    : <Game gs={gs} report={inspectionGs ? null : report}
        onInspect={openInspector}
        onExit={() => {
          if (inspectionGs) {
            setInspectionGs(null);
            setActiveLayout(savedGs.run?.layoutId || U05_WORLD_LAYOUT_ID);
            setScreen('inspector');
          } else setScreen('title');
        }}
        onRunEnd={() => {
          if (inspectionGs) {
            setInspectionGs(null);
            setActiveLayout(savedGs.run?.layoutId || U05_WORLD_LAYOUT_ID);
            setScreen('inspector');
          } else {
            setSummary(savedGs.profile.history[0] || null);
            setScreen('title');
          }
        }} />;
}
