import { useEffect, useRef, useState } from 'react';
import type { GameState } from './game/core';
import { dispatch, markDirty, mkStack, startRun } from './game/engine';
import { settleWithReturn, type OfflineReturnV1 } from './game/return-report';
import type { ReturnMessage, ReturnRequest } from './game/offline-return-worker';
import { load, restoreSnapshot, save, selectSnapshots, serializeSnapshot } from './game/persist';
import { backupProblemLine, writeSide, type ReadBackup } from './game/backup';
import { abandonSavedRun } from './game/title-actions';
import { getArt } from './game/art';
import { getActiveLayout, getWorld, setActiveLayout } from './game/world';
import { U05_WORLD_LAYOUT_ID, isVeyra05Layout } from './veyra05/scenes';
import { getWindowWorld } from './veyra05/window';
import { syncFloor } from './veyra05/floors';
import { holdRegionPrebuild, keptRegionsWanted, prebuildRegions, waitingRegionPacks, warmNewGameRegions } from './veyra05/region-prebuild';
import Inspector from './veyra05/inspector/Inspector';
import { resetRenderCaches, cam } from './game/render';
import { setVolume, initAudio } from './game/audio';
import { mkIntent } from './ui/common';
import { ITEMS } from './game/catalog';
import { QA_BUILD } from './game/build-flags';
import { buildQaSandbox, resetQaSandboxFlags, type QaPresetId } from './game/qa-sandbox';
import Title, { TitleShell } from './ui/Title';
import { awayLabel, clockLabel } from './ui/pregame';
import { afterPaint, behindVeil, hideVeil, settleVeil, showVeil, veilLine } from './ui/veil';
import Game from './ui/Game';

/** One line carried across the reload that follows a restore, shown once on the title. */
const RESTORED_NOTE = 'soh.restored-note';

export default function App() {
  const gsRef = useRef<GameState | null>(null);
  const qaGsRef = useRef<GameState | null>(null);
  const qaReturnLayoutRef = useRef<string | null>(null);
  const [qaMode, setQaMode] = useState(false);
  const [qaPreset, setQaPreset] = useState<QaPresetId>('full_gear');
  const [qaHero, setQaHero] = useState<'male' | 'female'>('female');
  const [screen, setScreen] = useState<'loading' | 'title' | 'game' | 'inspector'>('loading');
  const [inspectionGs, setInspectionGs] = useState<GameState | null>(null);
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
      setActiveLayout(gs.run?.layoutId || U05_WORLD_LAYOUT_ID);
      getWorld();
      gsRef.current = gs;
      let restored: string | null = null;
      try { restored = sessionStorage.getItem(RESTORED_NOTE); sessionStorage.removeItem(RESTORED_NOTE); } catch { /* no session storage */ }
      setNote([restored, note].filter(Boolean).join(' ') || undefined);
      setVolume(gs.profile.settings.volume, gs.profile.settings.muted);
      setScreen('title');
    })();
    return () => { cancelled = true; };
  }, []);

  const catchUp=useRef<Worker|null>(null);
  /** The wait after Continue: share of the absence worked out, world regions made ready, when it began, how long the player was away. */
  const [progress,setProgress]=useState<{fraction:number;regions:number;startedAt:number;awayMs:number}|null>(null);
  const [,setBeat]=useState(0);
  const waiting=progress!==null;
  // The running clock on the waiting panel shows the work is alive while the bar stands still.
  useEffect(()=>{if(!waiting)return;const timer=setInterval(()=>setBeat(b=>b+1),1000);return()=>clearInterval(timer);},[waiting]);
  const stopCatchUp=()=>{catchUp.current?.terminate();catchUp.current=null;holdRegionPrebuild(false);setProgress(null);};
  useEffect(()=>()=>{catchUp.current?.terminate();catchUp.current=null;holdRegionPrebuild(false);},[]);
  const savedGs = gsRef.current;
  // While the title is up, start compiling the regions residents stand on (those of the run behind Continue, or of a
  // new game), so the first minute of play does not pay for them (region-prebuild.ts; changes no game state).
  useEffect(() => {
    if (screen !== 'title') return;
    const warm = () => { const r = gsRef.current?.run; if (r && !r.ended) prebuildRegions(r, Date.now()); else warmNewGameRegions(); };
    warm(); const timer = setInterval(warm, 1000);
    return () => clearInterval(timer);
  }, [screen]);
  const gs = qaMode ? qaGsRef.current : (inspectionGs ?? savedGs);
  // Same look as the splash index.html shows while the code loads, so the three steps read as one screen.
  if (loadError) return <div className="boot" role="alert">
    <div className="boot__name" data-notr>SOUL OF HERO</div>
    <div className="panel" style={{ maxWidth: 520, padding: 16, textAlign: 'left', fontSize: 18, lineHeight: 1.25 }}>
      <div className="panel-h" style={{ fontSize: 18, marginBottom: 6 }}>Save recovery required</div>
      <div style={{ color: 'var(--warn)', overflowWrap: 'anywhere' }}>{loadError}</div>
      <div style={{ marginTop: 6 }}>No new game was started and the original save copies were not overwritten.</div>
      <button className="btn gold" style={{ fontSize: 18, padding: '8px 18px 9px', marginTop: 12 }} onClick={() => window.location.reload()}>Retry</button>
    </div>
  </div>;
  if (screen === 'loading' || !gs || !savedGs) return <div className="boot" role="status">
    <div className="boot__name" data-notr>SOUL OF HERO</div>
    <div className="boot__bar"><i /></div>
    <div className="boot__line">Raising the island…</div>
  </div>;

  const enter = (targetGs: GameState, dirty = true) => {
    if (targetGs.run?.layoutId) {
      setActiveLayout(targetGs.run.layoutId);
      if (isVeyra05Layout(targetGs.run.layoutId)) {
        const ww = getWindowWorld(targetGs.run.layoutId);
        syncFloor(targetGs, ww, ww.floors, markDirty);
      }
    }
    if (dirty) markDirty();
    resetRenderCaches();
    cam.init = false;
    setScreen('game');
  };

  const leaveQa = () => {
    resetQaSandboxFlags();
    setQaMode(false);
    qaGsRef.current = null;
    setReport(null);
    setInitialBanner(null);
    const layout = qaReturnLayoutRef.current || gsRef.current?.run?.layoutId || U05_WORLD_LAYOUT_ID;
    setActiveLayout(layout);
    getWorld(layout);
    qaReturnLayoutRef.current = null;
    setScreen('title');
  };

  const launchQa = (preset: QaPresetId, c: 'male' | 'female') => {
    initAudio();
    if (!qaMode) qaReturnLayoutRef.current = getActiveLayout();
    setInspectionGs(null);
    const built = buildQaSandbox(preset, c, Date.now());
    qaGsRef.current = built.gs;
    setQaMode(true);
    setQaPreset(preset);
    setQaHero(c);
    setReport(built.report);
    setInitialBanner(built.banner || null);
    enter(built.gs, false);
  };

  const openInspector = () => {
    resetQaSandboxFlags();
    setQaMode(false);
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
    resetQaSandboxFlags();
    setQaMode(false);
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

  /** Continue, or end the run from the title. Both first work out the time the player was away (the same way, with the
   *  same wait screen); 'play' then opens the game, 'abandon' ends the run instead and shows its chronicle. */
  const resume = (purpose: 'play' | 'abandon') => {
    if (veilLine() !== null) return;   // a second press while the first is still opening the game
    initAudio();
    resetQaSandboxFlags();
    setQaMode(false);
    setInitialBanner(null);
    const now=Date.now();
    const finish=(next:GameState,rep:ReturnType<typeof settleWithReturn>)=>{
      gsRef.current=next;save(next);
      if(!next.run){hideVeil();setSummary(next.profile.history[0]);return;}
      if(purpose==='abandon'){
        // The run is up to date now; end it with the same command the Esc menu sends (game/title-actions.ts).
        const done=abandonSavedRun(next,Date.now());
        hideVeil();
        if(done.ok){save(next);setNote(undefined);setSummary(next.profile.history[0]||null);}
        else setNote(`The run was not abandoned. It is saved as it stands now. ${done.reason}`);
        return;
      }
      setReport(rep.lines.length||(rep.report&&!rep.report.away.quiet)?rep:null);enter(next);
    };
    if(!savedGs.run || now-savedGs.run.clock.lastSimAt<120000 || typeof Worker==='undefined'){
      behindVeil(purpose==='abandon'?'Ending the run…':'Opening the island…',()=>finish(savedGs,settleWithReturn(savedGs,now)));return;
    }
    if(catchUp.current)return;
    const fail=(reason:string)=>{stopCatchUp();setNote(purpose==='abandon'?`The run was not abandoned. Your previous save is unchanged. ${reason}`:`Continue did not finish. Your previous save is unchanged. ${reason}`);};
    try {
      const w=new Worker(new URL('./game/offline-return-worker.ts',import.meta.url),{type:'module'});catchUp.current=w;
      setProgress({fraction:0,regions:0,startedAt:Date.now(),awayMs:now-savedGs.run.clock.lastSimAt});
      w.onerror=e=>{if(catchUp.current===w)fail(e.message);};
      w.onmessage=({data}:{data:ReturnMessage})=>{
        if(catchUp.current!==w)return;
        if(data.kind==='progress'){setProgress(p=>p&&{...p,fraction:data.fraction,regions:data.regions});return;}
        if(data.kind==='failed'){fail(data.reason);return;}
        // The result is in. Opening it holds the page for a few seconds (the world is put together and its
        // first frame drawn), so the cover goes up and is painted before that starts.
        showVeil(purpose==='abandon'?'Ending the run…':'Opening the island…');
        afterPaint(()=>{
          if(catchUp.current!==w){hideVeil();return;}   // the player went back to the title meanwhile
          try{const next=selectSnapshots([data.snapshot]).gs;if(!next)throw Error('Invalid return snapshot.');
            stopCatchUp();finish(next,data.result);settleVeil();
          }catch(e){hideVeil();fail(String(e));}
        });
      };
      // Regions the title screen has compiled ahead of need go along. They are copied: the pool keeps its own
      // for the game that starts afterwards. On a two-core machine the prebuild worker stands down meanwhile.
      const packs=waitingRegionPacks();
      const request:ReturnRequest={snapshot:serializeSnapshot(savedGs),now,packs,kept:keptRegionsWanted(savedGs.run,packs)};
      holdRegionPrebuild(true);
      w.postMessage(request);
    }catch(e){fail(String(e));}
  };

  /** Put a checked backup in place of the save (Title → Saved game), then load the page again so it goes through
   *  the whole of load(). Resolves to null when the page is about to reload, or to the line to show when nothing was
   *  written. */
  const restore = async (backup: Extract<ReadBackup, { ok: true }>): Promise<string | null> => {
    if (veilLine() !== null || catchUp.current) return 'Wait for the current step to finish.';
    const outcome = await restoreSnapshot(backup.saveText, savedGs.revision);
    if (!outcome.ok) return outcome.category === 'invalid-state' ? backupProblemLine('not-a-save') : 'The backup could not be written to this browser. Your save is unchanged.';
    let lost = 0;
    try { lost = writeSide(backup.side, localStorage); } catch { lost = Object.keys(backup.side).length; }
    try { sessionStorage.setItem(RESTORED_NOTE, lost ? 'Backup restored. Some notes in it could not be stored: the storage of this browser is full.' : 'Backup restored.'); } catch { /* the note is a courtesy */ }
    window.location.reload();
    return null;
  };

  if(progress!==null){
    const awayText=awayLabel(progress.awayMs),ranText=clockLabel(Date.now()-progress.startedAt);
    // Each line is one string, so the Vietnamese phrase book sees whole sentences.
    // The backdrop stands still here: the processor belongs to the work the player is waiting for.
    return <TitleShell still layout={savedGs.run?.layoutId||''}>
      <main className="panel absolute fadein" aria-label="Returning to the island" style={{left:120,top:54,width:400,padding:14}}>
        <h1 className="panel-h" style={{fontSize:15,margin:0}}>While you were away</h1>
        <p style={{fontSize:13,lineHeight:1.2,margin:'6px 0 10px'}}>{`You were away for ${awayText}. The island kept living: its food, work and travel for that time are being worked out now.`}</p>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div className="wait-pct" data-notr aria-hidden="true">{`${Math.floor(progress.fraction*100)}%`}</div>
          <progress className="wait-bar" aria-label="Island time resolved" value={progress.fraction} max={1} />
        </div>
        {/* No "time left" line: the speed is not steady (land is still being built at the start), and a straight-line
            estimate said "about 5 minutes" when 25 seconds were left (measured, report round 12). */}
        <p data-testid="return-status" style={{fontSize:12,lineHeight:1.2,margin:'8px 0 0'}}>{`${Math.floor(progress.fraction*100)}% of the time away worked out · ${progress.regions} regions of land made ready · running for ${ranText}`}</p>
        <div className="rule" style={{margin:'10px 0 8px'}} />
        <p style={{fontSize:11,lineHeight:1.2,margin:'0 0 9px',color:'var(--muted)'}}>A long absence can take a few minutes. Your saved game stays as it was until this finishes.</p>
        <button className="btn" style={{fontSize:12,padding:'5px 12px 6px'}} onClick={stopCatchUp}>Back to title</button>
      </main>
    </TitleShell>;
  }
  if (QA_BUILD && screen === 'inspector') {
    return <Inspector gs={savedGs} initialMode="creator" onClose={closeInspector} onLaunchCreatorInspect={launchInspection} />;
  }

  return screen === 'title'
    ? <Title
        gs={savedGs}
        note={note}
        summary={summary}
        clearSummary={() => setSummary(null)}
        onInspect={QA_BUILD ? openInspector : undefined}
        onContinue={() => resume('play')}
        onAbandon={() => resume('abandon')}
        onRestore={restore}
        onStart={(c, region, layoutId) => { if (veilLine() !== null) return; initAudio(); behindVeil('Raising the island…', () => {
          resetQaSandboxFlags();
          setQaMode(false);
          setInitialBanner(null);
          setActiveLayout(layoutId || U05_WORLD_LAYOUT_ID);
          const res = dispatch(savedGs, mkIntent('startRun', { character: c, region }), Date.now());
          if (res.ok) {
            if (import.meta.env.VITE_FX_TEST === '1' && savedGs.run) {
              const r = savedGs.run, inv = r.custody.inv;
              const keys = ['core_blast', 'core_meteor', 'core_dragon', 'core_elsa', 'core_earthmother', 'core_mjolnir', 'core_demon', 'core_fire', 'core_earth', 'core_storm', 'core_frost'];
              const initial = inv.slots.filter(Boolean);
              inv.slots = Array(128).fill(null);
              let i = 0;
              for (const k of keys) for (let n = 0; n < 10; n++) { const s = mkStack(r, k, 1); if (ITEMS[k]?.creatorCore) s.lvl = 3; inv.slots[i++] = s; }
              for (const item of initial) inv.slots[i++] = item;
              r.qaUsed = true;
            }
            save(savedGs);
            setReport(null);
            enter(savedGs);
          } else { hideVeil(); setNote(res.reason); }
        }); }}
        onStartQa={QA_BUILD ? launchQa : undefined}
      />
    : <Game
        gs={gs}
        report={inspectionGs ? null : report}
        initialBanner={initialBanner}
        qaMode={qaMode || !!inspectionGs}
        qaPreset={qaPreset}
        onSwitchQaPreset={qaMode ? (p) => launchQa(p, qaHero) : undefined}
        onInspect={QA_BUILD ? openInspector : undefined}
        onExit={() => {
          if (qaMode) { leaveQa(); return; }
          if (inspectionGs) {
            setInspectionGs(null);
            setActiveLayout(savedGs.run?.layoutId || U05_WORLD_LAYOUT_ID);
            setScreen('inspector');
          } else setScreen('title');
        }}
        onRunEnd={() => {
          if (qaMode) { setSummary(gs.profile.history[0] || null); leaveQa(); return; }
          if (inspectionGs) {
            setInspectionGs(null);
            setActiveLayout(savedGs.run?.layoutId || U05_WORLD_LAYOUT_ID);
            setScreen('inspector');
          } else {
            setSummary(savedGs.profile.history[0] || null);
            setScreen('title');
          }
        }}
      />;
}
