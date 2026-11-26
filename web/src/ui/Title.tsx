import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BAL, VIEW_W, VIEW_H, type GameState } from '../game/core';
import { getArt } from '../game/art';
import { getMapCanvas, resetRenderCaches } from '../game/render';
import { setActiveLayout } from '../game/world';
import { U05_WORLD_LAYOUT_ID } from '../veyra05/scenes';
import { ACHIEVEMENTS } from '../game/catalog';
import { initAudio, sfx } from '../game/audio';
import { QA_BUILD } from '../game/build-flags';
import { QA_PRESETS, type QaPresetId } from '../game/qa-sandbox';
import { computeStageView, isTouchDevice } from '../visual/direction';
import { runHours } from '../game/engine';
import { PresentationPanel, useVisualPrefs } from './hud';
import { continueLine, endingLabel } from './pregame';
import { getLang, setLang, subscribeLang } from '../game/i18n';

const CLASSIC_REGIONS = [
  { id: 0, label: 'South Cove' },
  { id: 1, label: 'East Meadow' },
  { id: 2, label: 'West Shore' },
  { id: 3, label: 'North Bay' },
] as const;

function useScale() {
  const vp = useVisualPrefs();
  const [s, setS] = useState({ w: VIEW_W, h: VIEW_H, k: 1, x: 0, y: 0 });
  useEffect(() => {
    // The backdrop takes the window's shape (no bars); the menu keeps its 640x360 layout in the middle of it.
    const fit = () => setS(computeStageView(window.innerWidth, window.innerHeight, { stageScale: vp.stageScale, stageView: vp.stageView }));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [vp.stageScale, vp.stageView]);
  return s;
}
/** The island drifting behind the menus. `still` draws it once and stops: the wait after Continue must not spend
 *  the processor on a backdrop while the time away is being worked out. */
function Backdrop({ layout, w: W, h: H, still = false }: { layout: string; w: number; h: number; still?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current!; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; const map = getMapCanvas(); let raf = 0;
    const embers = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 6 + Math.random() * 14 }));
    const paint = (t: number, dt: number) => { g.fillStyle = '#0a0f1e'; g.fillRect(0, 0, W, H);
      const z = 4; const ox = -(Math.sin(t / 14000) * 0.5 + 0.5) * (200 * z - W), oy = -260 + Math.sin(t / 9000) * 60; g.globalAlpha = 0.55; g.drawImage(map, Math.round(ox), Math.round(oy), 200 * z, 200 * z); g.globalAlpha = 1;
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(10,8,24,0.85)'); gr.addColorStop(0.5, 'rgba(20,10,30,0.35)'); gr.addColorStop(1, 'rgba(40,10,10,0.9)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // Embers move by elapsed time, so they drift at the same speed on a 60 Hz and a 144 Hz screen.
      for (const e of embers) { e.y -= e.v * dt / 1000; e.x += Math.sin(t / 900 + e.v) * 12 * dt / 1000; if (e.y < -2) { e.y = H + 2; e.x = Math.random() * W; } g.fillStyle = e.v > 14 ? '#ffd070' : '#ff6a2a'; g.fillRect(Math.round(e.x), Math.round(e.y), 1, 1); } };
    if (still || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) { paint(4000, 0); return; }
    // About 30 pictures a second is plenty for a slow drift, and leaves the processor to the land being prepared
    // in the background (region-prebuild.ts).
    let last = 0;
    const loop = (t: number) => { raf = requestAnimationFrame(loop); if (last && t - last < 30) return; const dt = last ? Math.min(100, t - last) : 0; last = t; paint(t, dt); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, [layout, W, H, still]);
  return <canvas ref={ref} width={W} height={H} className="absolute inset-0" />;
}
function HeroPreview({ female, active }: { female: boolean; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current!; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; const set = getArt().hero[female ? 'female' : 'male']; let raf = 0;
    const loop = (t: number) => { raf = requestAnimationFrame(loop); g.clearRect(0, 0, 64, 96); const dir = Math.floor(t / 1600) % 4; const fr = active ? set['walk' + [0, 2, 3, 1][dir]][Math.floor(t / 140) % 4] : set['idle0'][Math.floor(t / 600) % 2];
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(14, 84, 36, 6); g.drawImage(fr, 0, 0, 16, 24, 0, 0, 64, 96); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, [female, active]);
  return <canvas ref={ref} width={64} height={96} style={{ width: 44, height: 66 }} />;
}

function LanguageButtons() {
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);
  return <div className="absolute" data-notr style={{ right: 6, top: 6, display: 'flex', gap: 2, zIndex: 5 }} role="group" aria-label="Language / Ngôn ngữ">
    <button className={`btn sm ${lang === 'en' ? 'gold' : ''}`} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
    <button className={`btn sm ${lang === 'vi' ? 'gold' : ''}`} aria-pressed={lang === 'vi'} onClick={() => setLang('vi')}>Tiếng Việt</button>
  </div>;
}

/** The frame every screen before the game shares: the island behind, the 640x360 layout scaled to the window in
 *  front, the language choice in the corner. */
export function TitleShell({ layout = '', still = false, children }: { layout?: string; still?: boolean; children: ReactNode }) {
  const s = useScale();
  return <div data-pregame style={{ position: 'fixed', inset: 0, background: '#05040a' }}>
    <div className="stage" data-view={`${s.w}x${s.h}`} style={{ width: s.w, height: s.h, transform: `translate(${s.x}px, ${s.y}px) scale(${s.k})` }}>
      <Backdrop layout={layout} w={s.w} h={s.h} still={still} />
      <div className="stage-frame">
        <LanguageButtons />
        {children}
      </div>
    </div>
  </div>;
}

type Mode = 'menu' | 'select' | 'history' | 'settings' | 'qa';
type RunRecord = GameState['profile']['history'][number];

export default function Title({
  gs,
  onContinue,
  onStart,
  onStartQa,
  onInspect,
  note,
  summary,
  clearSummary,
}: {
  gs: GameState;
  onContinue: () => void;
  onStart: (c: 'male' | 'female', region: number | null, layoutId?: string) => void;
  onStartQa?: (preset: QaPresetId, c: 'male' | 'female') => void;
  onInspect?: () => void;
  note?: string;
  summary: RunRecord | null;
  clearSummary: () => void;
}) {
  const [mode, setMode] = useState<Mode>('menu');
  const [hero, setHero] = useState<'male' | 'female'>('female');
  const [region, setRegion] = useState<number | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<string>(U05_WORLD_LAYOUT_ID);
  const [qaPreset, setQaPreset] = useState<QaPresetId>('full_gear');
  /** A finished run opened from the history list, shown with the same chronicle as the one right after a run. */
  const [viewed, setViewed] = useState<RunRecord | null>(null);
  const [, setMinute] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!gs.run) { setActiveLayout(selectedLayout); resetRenderCaches(); } }, [gs.run, selectedLayout]);
  // The Continue button says which day it is and how long the player has been away; both move with the clock.
  useEffect(() => { const timer = setInterval(() => setMinute(m => m + 1), 30000); return () => clearInterval(timer); }, []);
  const pf = gs.profile; const run = gs.run;
  const census = (id: string) => pf.humanRunHistory?.find(row => row.runId === id)?.outcomes;
  const shown = summary ?? viewed;
  const outcomes = shown && census(shown.runId);
  const click = () => { initAudio(); sfx({ type: 'ui' }); };
  const activeRegions = selectedLayout === U05_WORLD_LAYOUT_ID ? [] : CLASSIC_REGIONS;
  const heroName = (h: string) => (h === 'female' ? 'Adventurer ♀' : 'Adventurer ♂');
  const now = Date.now();
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);
  // Dates follow the language chosen in the game, not the browser's (a Vietnamese player reads day/month/year).
  const dateText = (at: number) => new Date(at).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB');
  const openSelect = () => { click(); setActiveLayout(selectedLayout); resetRenderCaches(); setMode('select'); };
  const begin = () => { click(); onStart(hero, region, selectedLayout); };
  const closeChronicle = () => { click(); if (summary) clearSummary(); else setViewed(null); };
  const achievementKeys = Object.keys(ACHIEVEMENTS);
  const achieved = achievementKeys.filter(k => pf.achievements[k]).length;

  // Keyboard: the menus can be used without a mouse. The button that carries the screen forward takes the focus
  // when a screen opens, so Enter or Space plays; Esc steps back; the arrow keys move between buttons.
  const screenKey = shown ? 'chronicle' : mode;
  useEffect(() => { frame.current?.querySelector<HTMLElement>('[data-primary]')?.focus({ preventScroll: true }); }, [screenKey]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const at = document.activeElement as HTMLElement | null;
      const inField = !!at && (at.tagName === 'INPUT' || at.tagName === 'SELECT' || at.tagName === 'TEXTAREA');
      if (e.key === 'Escape') {
        if (shown) { e.preventDefault(); closeChronicle(); }
        else if (mode !== 'menu') { e.preventDefault(); setMode('menu'); }
        return;
      }
      if (inField) return;
      if (e.key === 'Enter' && (!at || at === document.body)) {     // nothing has the focus (a click on the backdrop took it away)
        frame.current?.querySelector<HTMLElement>('[data-primary]')?.click(); e.preventDefault(); return;
      }
      if (mode === 'select' && !shown && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); click(); setHero(e.key === 'ArrowLeft' ? 'female' : 'male'); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const all = [...(frame.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [role="button"]') ?? [])].filter(b => !b.closest('[data-notr]'));
        if (!all.length) return;
        const i = at ? all.indexOf(at) : -1, step = e.key === 'ArrowDown' ? 1 : -1;
        all[i < 0 ? 0 : (i + step + all.length) % all.length].focus({ preventScroll: true }); e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const heading = (text: string, extra?: ReactNode) => <div className="lbl" style={{ fontSize: 11, color: 'var(--brassLit)', marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 6 }}><span>{text}</span>{extra}</div>;

  return <TitleShell layout={selectedLayout}>
    <div ref={frame} className="absolute inset-0">
      {shown ? <div className="panel absolute fadein scroll" role="dialog" aria-label="Run chronicle" style={{ left: 120, top: 24, width: 400, maxHeight: 312, overflowY: 'auto', padding: 10 }}>
        <div className="lbl" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1 }}>{summary ? 'RUN CHRONICLE · 14-DAY CYCLE CONCLUDED' : `RUN CHRONICLE · ${dateText(shown.endedAt)}`}</div>
        <div className="title-font" style={{ fontSize: 22, color: shown.ending === 'evacuated' ? 'var(--info)' : shown.ending === 'expired' ? 'var(--bad)' : 'var(--paper)' }}>
          {shown.ending === 'evacuated' ? 'Evacuated from the Island' : shown.ending === 'expired' ? 'Consumed by Ragnarok' : 'Run Abandoned'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <div className="console-col">
            <div className="console-h" style={{ color: 'var(--info)', fontSize: 9 }}>Preserved on Profile</div>
            <div className="lbl" style={{ fontSize: 10, color: 'var(--info)' }}>Secured Cash: <b>{pf.securedCash}</b> <span style={{ color: 'var(--muted)' }}>{`(+${shown.deposited} this run)`}</span></div>
            <div className="lbl" style={{ fontSize: 10, color: 'var(--brassLit)', marginTop: 2 }}>Elder Stones: <b>{shown.stones}/6</b>{shown.stones >= 6 ? ' ★ Crown of Six' : ''}</div>
            <div className="lbl" style={{ fontSize: 10, color: 'var(--paper)', marginTop: 2 }}>Run Score: <b>{shown.score}</b> {shown.qa && <span className="chip" style={{ color: 'var(--warn)' }}>QA</span>} <span className="chip" style={{ color: 'var(--muted)' }} title="LOCAL/UNVERIFIED — browser-stored, not a global leaderboard">local score</span></div>
          </div>
          <div className="console-col">
            <div className="console-h" style={{ color: 'var(--bad)', fontSize: 9 }}>Reset with the Island</div>
            <div className="lbl" style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.25 }}>
              All gear from this run, Creator Cores, learned recipes, shelter, vehicles, cargo &amp; unsecured cash have been wiped.
            </div>
          </div>
        </div>
        {outcomes && <section aria-label="Island survivors" style={{marginTop:6}}>
          <div className="console-h" style={{ fontSize: 9 }}>People of Veyra · {outcomes.total}</div>
          <div style={{fontSize:12}}>{`Reached safe water: ${outcomes.evacuated} · Survived on the island: ${outcomes.survived}`}</div>
          <div style={{fontSize:11,color:'var(--muted)'}}>{`Died: ${outcomes.dead} · Fate unknown: ${outcomes.unresolved}`}</div>
        </section>}
        {shown.achievements.length > 0 && <div style={{ fontSize: 11, marginTop: 5 }}>{shown.achievements.map(a => <span key={a} style={{ marginRight: 6, color: 'var(--brassLit)' }}>★ {ACHIEVEMENTS[a]?.name}</span>)}</div>}
        <button data-primary className="btn gold" style={{ marginTop: 8, width: '100%', fontSize: 12 }} onClick={closeChronicle}>{summary ? 'Continue to Title' : 'Back'}</button>
      </div> : <>
        {mode === 'menu' && <div className="absolute" style={{ left: 0, right: 0, top: 18, textAlign: 'center' }}>
          {import.meta.env.VITE_FX_TEST === '1' && <div style={{ color: '#ffdf7b', fontSize: 12 }}>VFX TEST — 10 mỗi Core, đầy năng lượng · lưu riêng</div>}
          <div className="title-font" data-notr style={{ fontSize: 44, fontWeight: 700, color: '#ffe8b0', letterSpacing: 3, textShadow: '0 3px 0 #6a2a0a, 0 5px 0 #2a0a04, 0 0 18px #ff7a2a' }}>SOUL OF HERO</div>
          <div style={{ fontSize: 13, color: '#e0c8a8', marginTop: -2, textShadow: '1px 1px 0 #000' }}>fourteen days · one island · the end of the world</div>
        </div>}
        {mode === 'menu' && <nav aria-label="Main menu" className="absolute flex flex-col items-center fadein" style={{ left: 0, right: 0, top: 112, gap: 5 }}>
          {run && <button data-primary className="btn gold title-play" onClick={() => { click(); onContinue(); }}>
            <span className="title-play__main">{`Continue — ${heroName(run.character)}`}</span>
            <span className="title-play__sub">{continueLine(runHours(run, now), now - run.clock.lastSimAt, Math.round(BAL.run.maxRunHours / 24))}</span>
          </button>}
          <button data-primary={run ? undefined : true} className={run ? 'btn' : 'btn gold'} style={{ fontSize: 15, width: 264, padding: run ? undefined : '7px 8px 8px' }} disabled={!!run} title={run ? 'Finish (evacuate/abandon) your current run first' : ''} onClick={openSelect}>New run</button>
          {run && <div className="title-hint" style={{ maxWidth: 330 }}>One run at a time. To start over, continue this run and end it from the Esc menu: Abandon run…</div>}
          <div style={{ display: 'flex', gap: 5, width: 264 }}>
            <button className="btn" style={{ fontSize: 12, flex: 1, padding: '5px 4px 6px' }} onClick={() => { click(); setMode('history'); }}>Profile &amp; history</button>
            <button className="btn" style={{ fontSize: 12, flex: 1, padding: '5px 4px 6px' }} onClick={() => { click(); setMode('settings'); }}>Settings</button>
          </div>
          {onStartQa && <button className="btn gold" style={{ fontSize: 12, width: 264 }} onClick={() => { click(); setMode('qa'); }}>Full-Gear QA Sandbox [F9]</button>}
          {onInspect && <button className="btn ghost" style={{ fontSize: 11, width: 264, color: '#9ae0ff' }} onClick={() => { click(); onInspect(); }}>Creator Inspector · world viewer</button>}
          <div style={{ fontSize: 11, color: 'var(--paper)', marginTop: 2, textShadow: '1px 1px 0 #000' }}>Secured Ragnarok cash: <b style={{ color: 'var(--info)' }}>{pf.securedCash}</b> · Runs: {pf.history.length}</div>
          {note && <div role="alert" className="title-note">{note}</div>}
        </nav>}
        {mode === 'menu' && <div className="title-foot">
          <span>Offline · single-player · saves in this browser only</span>
          {!isTouchDevice() && <span>Enter: play · Esc: back · arrow keys: move</span>}
        </div>}
        {mode === 'qa' && onStartQa && <div className="panel absolute fadein" style={{ left: 70, top: 24, width: 500, padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div className="panel-h">Visual Experience QA · Full-Gear Sandbox</div>
            <span className="chip" style={{ color: 'var(--warn)' }}>ISOLATED · PRODUCTION SAVES SAFE</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
            {(['female', 'male'] as const).map(h => <button key={h} className={`btn sm ${hero === h ? 'gold' : 'ghost'}`} onClick={() => { click(); setHero(h); }}>{h === 'female' ? 'Adventurer ♀' : 'Adventurer ♂'}</button>)}
            <span className="lbl" style={{ fontSize: 8, color: 'var(--muted)', alignSelf: 'center', marginLeft: 'auto' }}>Press F9 in-game anytime to switch presets, summon Elders or inspect 1× art</span>
          </div>
          <div className="scroll" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, maxHeight: 190, overflowY: 'auto' }}>
            {QA_PRESETS.map(p => (
              <div key={p.id} data-testid={`qa-preset-${p.id}`} className={`dirbtn ${qaPreset === p.id ? 'on' : ''}`} onClick={() => { click(); setQaPreset(p.id); }} role="button" tabIndex={0}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="lbl" style={{ fontSize: 9, color: qaPreset === p.id ? 'var(--brassLit)' : 'var(--paper)', fontWeight: 700 }}>{p.title}</span>
                  <span className="chip" style={{ marginLeft: 'auto', color: 'var(--info)' }}>{p.tag}</span>
                </div>
                <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 1 }}>{p.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center" style={{ marginTop: 6 }}>
            <button className="btn ghost" onClick={() => setMode('menu')}>Back</button>
            <button data-primary className="btn gold" style={{ fontSize: 13, padding: '4px 16px' }} onClick={() => { click(); onStartQa(qaPreset, hero); }}>Launch QA Sandbox</button>
          </div>
        </div>}
        {/* Kept clear of the bottom 50px: in a small window the "enlarge the window" line sits there, and it must not
            cover the button that starts the game. */}
        {mode === 'select' && <div className="panel absolute fadein" style={{ left: 90, top: 12, width: 460, padding: 10 }}>
          <div className="panel-h" style={{ marginBottom: 5 }}>Choose your Adventurer</div>
          <div className="flex gap-2">{(['female', 'male'] as const).map(h => <button key={h} className={`btn ${hero === h ? 'gold' : 'ghost'}`} aria-pressed={hero === h} style={{ flex: 1, padding: '4px 8px', textAlign: 'left' }} onClick={() => { click(); setHero(h); }}>
            <div className="flex items-center gap-2"><HeroPreview female={h === 'female'} active={hero === h} /><div className="title-font" style={{ fontSize: 14 }}>{heroName(h)}</div></div></button>)}</div>
          {heading('Starter kit')}
          <div style={{ fontSize: 11, color: '#e8dcc8', lineHeight: 1.2 }}>Stone axe, half a flask and a few berries. Strike a tree for wood or a boulder for stone.</div>
          {heading('World')}
          {/* The Classic Island (R12) baseline stays in the code for tests and old saves, but only
              the engineering build can start a new run on it. */}
          {QA_BUILD && <div className="flex gap-1" style={{ marginTop: 2 }}>
            <button className={`btn ${selectedLayout === U05_WORLD_LAYOUT_ID ? 'gold' : 'ghost'}`} style={{ fontSize: 10 }} onClick={() => { click(); setSelectedLayout(U05_WORLD_LAYOUT_ID); setRegion(null); }}>VEYRA · Unified World</button>
            <button className={`btn ${selectedLayout === 'shipping' ? 'gold' : 'ghost'}`} style={{ fontSize: 10 }} onClick={() => { click(); setSelectedLayout('shipping'); setRegion(null); }}>Classic Island (R12)</button>
          </div>}
          <div style={{ fontSize: 11, color: '#e8dcc8', marginTop: 2, lineHeight: 1.2 }}>
            {selectedLayout === U05_WORLD_LAYOUT_ID
              ? <><b style={{ color: '#ffe27a' }}>VEYRA</b> · one open world: 81 places to find, animals to raise, 4 side bosses and 6 Primordials.</>
              : <><b style={{ color: '#9ae0ff' }}>Classic Island (R12)</b> · 200×200 tiles · classic 6-Elder island &amp; R12 industrial baseline.</>}
          </div>
          {heading(selectedLayout === U05_WORLD_LAYOUT_ID ? 'Starting location' : 'Landing region')}
          <div className="flex flex-wrap gap-1" style={{ marginTop: 3 }}>
            <button className={`btn ${region === null ? 'gold' : 'ghost'}`} aria-pressed={region === null} style={{ fontSize: 11 }} onClick={() => { click(); setRegion(null); }}>Random safe region</button>
            {activeRegions.map(rg => <button key={rg.id} className={`btn ${region === rg.id ? 'gold' : 'ghost'}`} aria-pressed={region === rg.id} style={{ fontSize: 11 }} onClick={() => { click(); setRegion(rg.id); }}>{rg.label}</button>)}
          </div>
          <div style={{ fontSize: 11, color: '#cfc2dc', minHeight: 14, marginTop: 4, lineHeight: 1.2 }}>
            {region === null ? 'You land at a random safe spot on the mainland. There is no starter shelter.' : `Seeded safe landing in ${activeRegions[region]?.label}. Reachable wood, stone, food and fresh water.`}
          </div>
          <div className="rule" style={{ margin: '6px 0 6px' }} />
          <div className="flex justify-between items-center"><button className="btn ghost" style={{ fontSize: 12, padding: '5px 12px 6px' }} onClick={() => { click(); setMode('menu'); }}>Back</button><button data-primary className="btn gold" style={{ fontSize: 16, padding: '6px 18px 7px' }} onClick={begin}>Begin the 14 days</button></div>
        </div>}
        {mode === 'history' && <div className="panel absolute fadein" style={{ left: 100, top: 22, width: 440, maxHeight: 316, padding: 10, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
            <div className="panel-h" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}><span>Profile</span><span className="tag" style={{ color: '#ff9a7a', textTransform: 'none' }}>Saved in this browser · not a global leaderboard</span></div>
            <button data-primary className="btn" style={{ fontSize: 12, padding: '4px 12px 5px', flex: 'none' }} onClick={() => { click(); setMode('menu'); }}>Back</button>
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Secured Ragnarok cash: <b style={{ color: 'var(--info)' }}>{pf.securedCash}</b> — the only value that crosses runs.</div>
          {heading('Achievements', <span style={{ color: 'var(--muted)', fontSize: 10 }}>{`${achieved} / ${achievementKeys.length}`}</span>)}
          <div className="flex flex-wrap gap-x-3" style={{ fontSize: 11, lineHeight: 1.25, marginTop: 1 }}>{Object.entries(ACHIEVEMENTS).map(([k, a]) => <span key={k} style={{ color: pf.achievements[k] ? '#ffe27a' : '#9a8cab' }}>{pf.achievements[k] ? '★' : '☆'} {a.name}</span>)}</div>
          {heading('Run history', <span style={{ color: 'var(--muted)', fontSize: 10 }}>{`${pf.history.length}`}</span>)}
          <div className="scroll" style={{ flex: '1 1 auto', minHeight: 24, overflowY: 'auto', marginTop: 2 }}>
            {pf.history.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 11 }}>No finished runs yet.</div>}
            {pf.history.map(h => { const o = census(h.runId); return <div key={h.runId + h.endedAt} className="hist-row" role="button" tabIndex={0} title="Open the chronicle of this run"
              onClick={() => { click(); setViewed(h); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(); setViewed(h); } }}>
              <div className="flex gap-2 items-baseline">
                <span data-notr style={{ width: 62, flex: 'none', color: 'var(--muted)' }}>{dateText(h.endedAt)}</span>
                <span style={{ width: 96, flex: 'none', color: h.ending === 'evacuated' ? 'var(--info)' : h.ending === 'expired' ? 'var(--bad)' : 'var(--paper)' }}>{endingLabel(h.ending)}</span>
                <span style={{ flex: 1 }}>{`Score ${h.score} · Elder Stones ${h.stones}/6 · cash secured +${h.deposited}`}</span>
                {h.qa && <span className="chip" style={{ color: 'var(--warn)' }}>QA</span>}
              </div>
              {o && <div style={{ color: 'var(--muted)', fontSize: 10 }}>{`People of Veyra: ${o.evacuated} reached safe water · ${o.survived} survived · ${o.dead} died · ${o.unresolved} unknown`}</div>}
            </div>; })}
          </div>
        </div>}
        {mode === 'settings' && <div className="panel absolute fadein" style={{ left: 160, top: 20, width: 320, maxHeight: 322, padding: 10, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flex: 'none' }}>
            <div className="panel-h">Settings</div>
            <button data-primary className="btn" style={{ fontSize: 12, padding: '4px 12px 5px' }} onClick={() => { click(); setMode('menu'); }}>Back</button>
          </div>
          {/* The same panel as Esc → Presentation in the game: sound, screen and controls can be set before playing. */}
          <div className="scroll" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingRight: 2 }}><PresentationPanel /></div>
        </div>}
      </>}
    </div>
  </TitleShell>;
}
