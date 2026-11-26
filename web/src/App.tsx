import { useEffect, useRef, useState } from 'react';
import type { GameState } from './game/core';
import { dispatch, markDirty, mkStack, startRun } from './game/engine';
import { settleWithReturn, type OfflineReturnV1 } from './game/return-report';
import type { ReturnMessage, ReturnRequest } from './game/offline-return-worker';
import { load, save, selectSnapshots, serializeSnapshot } from './game/persist';
import { getArt } from './game/art';
import { getActiveLayout, getWorld, setActiveLayout } from './game/world';
import { U05_WORLD_LAYOUT_ID, isVeyra05Layout } from './veyra05/scenes';
import { getWindowWorld } from './veyra05/window';
import { syncFloor } from './veyra05/floors';
import { holdRegionPrebuild, prebuildRegions, waitingRegionPacks, warmNewGameRegions } from './veyra05/region-prebuild';
import Inspector from './veyra05/inspector/Inspector';
import { resetRenderCaches, cam } from './game/render';
import { setVolume, initAudio } from './game/audio';
import { mkIntent } from './ui/common';
import { ITEMS } from './game/catalog';
import { QA_BUILD } from './game/build-flags';
import { buildQaSandbox, resetQaSandboxFlags, type QaPresetId } from './game/qa-sandbox';
import Title from './ui/Title';
import Game from './ui/Game';

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
      setNote(note);
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
  if (loadError) return <div style={{ padding: 24, color: '#ffd98a', background: '#120c18', minHeight: '100vh' }}><h1>Save recovery required</h1><p>{loadError}</p><p>No new game was started and the original save copies were not overwritten.</p><button onClick={() => window.location.reload()}>Retry</button></div>;
  if (screen === 'loading' || !gs || !savedGs) return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', color: '#ffd98a', fontSize: 22 }} className="title-font">Raising the island…</div>;

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

  if(progress!==null){
    const away=Math.max(0,Math.round(progress.awayMs/60000)),awayText=away>=2880?`${Math.floor(away/1440)} d ${Math.floor(away%1440/60)} h`:away>=60?`${Math.floor(away/60)} h ${away%60} min`:`${away} min`;
    const ran=Math.max(0,Math.floor((Date.now()-progress.startedAt)/1000)),ranText=`${Math.floor(ran/60)}:${String(ran%60).padStart(2,'0')}`;
    // Each line is one string, so the Vietnamese phrase book sees whole sentences.
    return <main className="panel" aria-label="Returning to the island" style={{maxWidth:430,margin:'12vh auto',padding:16}}>
      <h1 className="title-font">While you were away</h1>
      <p>{`You were away for ${awayText}. The island kept living: its food, work and travel for that time are being worked out now.`}</p>
      <p>A long absence can take a few minutes. Your saved game stays as it was until this finishes.</p>
      <progress aria-label="Island time resolved" value={progress.fraction} max={1} style={{width:'100%'}} />
      <p data-testid="return-status" style={{margin:'6px 0 12px'}}>{`${Math.floor(progress.fraction*100)}% of the time away worked out · ${progress.regions} regions of land made ready · running for ${ranText}`}</p>
      <button className="btn" onClick={stopCatchUp}>Back to title</button>
    </main>;
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
        onContinue={() => {
          initAudio();
          resetQaSandboxFlags();
          setQaMode(false);
          setInitialBanner(null);
          const now=Date.now();
          const finish=(next:GameState,rep:ReturnType<typeof settleWithReturn>)=>{
            gsRef.current=next;save(next);
            if(!next.run){setSummary(next.profile.history[0]);return;}
            setReport(rep.lines.length||(rep.report&&!rep.report.away.quiet)?rep:null);enter(next);
          };
          if(!savedGs.run || now-savedGs.run.clock.lastSimAt<120000 || typeof Worker==='undefined'){
            finish(savedGs,settleWithReturn(savedGs,now));return;
          }
          if(catchUp.current)return;
          const fail=(reason:string)=>{stopCatchUp();setNote(`Continue did not finish. Your previous save is unchanged. ${reason}`);};
          try {
            const w=new Worker(new URL('./game/offline-return-worker.ts',import.meta.url),{type:'module'});catchUp.current=w;
            setProgress({fraction:0,regions:0,startedAt:Date.now(),awayMs:now-savedGs.run.clock.lastSimAt});
            w.onerror=e=>{if(catchUp.current===w)fail(e.message);};
            w.onmessage=({data}:{data:ReturnMessage})=>{
              if(catchUp.current!==w)return;
              if(data.kind==='progress'){setProgress(p=>p&&{...p,fraction:data.fraction,regions:data.regions});return;}
              if(data.kind==='failed'){fail(data.reason);return;}
              try{const next=selectSnapshots([data.snapshot]).gs;if(!next)throw Error('Invalid return snapshot.');
                stopCatchUp();finish(next,data.result);
              }catch(e){fail(String(e));}
            };
            // Regions the title screen has compiled ahead of need go along. They are copied: the pool keeps its own
            // for the game that starts afterwards. On a two-core machine the prebuild worker stands down meanwhile.
            const request:ReturnRequest={snapshot:serializeSnapshot(savedGs),now,packs:waitingRegionPacks()};
            holdRegionPrebuild(true);
            w.postMessage(request);
          }catch(e){fail(String(e));}
        }}
        onStart={(c, region, layoutId) => {
          initAudio();
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
          } else setNote(res.reason);
        }}
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
