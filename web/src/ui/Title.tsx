import { useEffect, useRef, useState } from 'react';
import { VIEW_W, VIEW_H, type GameState } from '../game/core';
import { getArt } from '../game/art';
import { getMapCanvas, resetRenderCaches } from '../game/render';
import { setActiveLayout } from '../game/world';
import { U05_WORLD_LAYOUT_ID } from '../veyra05/scenes';
import { ACHIEVEMENTS } from '../game/catalog';
import { initAudio, sfx } from '../game/audio';
import { QA_PRESETS, type QaPresetId } from '../game/qa-sandbox';
import { computeStageFit } from '../visual/direction';
import { useVisualPrefs } from './hud';

const VEYRA_REGIONS = [
  { id: 0, label: 'Westmouth Shore' },
  { id: 1, label: 'Greywater South Shore' },
  { id: 2, label: 'Hook Meadow' },
  { id: 3, label: 'Gulf West Bank' },
] as const;

const CLASSIC_REGIONS = [
  { id: 0, label: 'South Cove' },
  { id: 1, label: 'East Meadow' },
  { id: 2, label: 'West Shore' },
  { id: 3, label: 'North Bay' },
] as const;

function useScale() {
  const vp = useVisualPrefs();
  const [s, setS] = useState({ k: 1, x: 0, y: 0 });
  useEffect(() => {
    const fit = () => setS(computeStageFit(window.innerWidth, window.innerHeight, VIEW_W, VIEW_H, vp.stageScale));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [vp.stageScale]);
  return s;
}
function Backdrop({ layout }: { layout: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current!; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; const map = getMapCanvas(); let raf = 0;
    const embers = Array.from({ length: 50 }, () => ({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, v: 6 + Math.random() * 14 }));
    const loop = (t: number) => { raf = requestAnimationFrame(loop); g.fillStyle = '#0a0f1e'; g.fillRect(0, 0, VIEW_W, VIEW_H);
      const z = 4; const ox = -(Math.sin(t / 14000) * 0.5 + 0.5) * (200 * z - VIEW_W), oy = -260 + Math.sin(t / 9000) * 60; g.globalAlpha = 0.55; g.drawImage(map, Math.round(ox), Math.round(oy), 200 * z, 200 * z); g.globalAlpha = 1;
      const gr = g.createLinearGradient(0, 0, 0, VIEW_H); gr.addColorStop(0, 'rgba(10,8,24,0.85)'); gr.addColorStop(0.5, 'rgba(20,10,30,0.35)'); gr.addColorStop(1, 'rgba(40,10,10,0.9)'); g.fillStyle = gr; g.fillRect(0, 0, VIEW_W, VIEW_H);
      for (const e of embers) { e.y -= e.v / 60; e.x += Math.sin(t / 900 + e.v) * 0.2; if (e.y < -2) { e.y = VIEW_H + 2; e.x = Math.random() * VIEW_W; } g.fillStyle = e.v > 14 ? '#ffd070' : '#ff6a2a'; g.fillRect(Math.round(e.x), Math.round(e.y), 1, 1); } };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, [layout]);
  return <canvas ref={ref} width={VIEW_W} height={VIEW_H} className="absolute inset-0" />;
}
function HeroPreview({ female, active }: { female: boolean; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current!; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; const set = getArt().hero[female ? 'female' : 'male']; let raf = 0;
    const loop = (t: number) => { raf = requestAnimationFrame(loop); g.clearRect(0, 0, 64, 96); const dir = Math.floor(t / 1600) % 4; const fr = active ? set['walk' + [0, 2, 3, 1][dir]][Math.floor(t / 140) % 4] : set['idle0'][Math.floor(t / 600) % 2];
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(14, 84, 36, 6); g.drawImage(fr, 0, 0, 16, 24, 0, 0, 64, 96); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, [female, active]);
  return <canvas ref={ref} width={64} height={96} style={{ width: 52, height: 78 }} />;
}

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
  summary: GameState['profile']['history'][number] | null;
  clearSummary: () => void;
}) {
  const s = useScale();
  const [mode, setMode] = useState<'menu' | 'select' | 'history' | 'qa'>('menu');
  const [hero, setHero] = useState<'male' | 'female'>('female');
  const [region, setRegion] = useState<number | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<string>(U05_WORLD_LAYOUT_ID);
  const [qaPreset, setQaPreset] = useState<QaPresetId>('full_gear');
  useEffect(() => { if (!gs.run) { setActiveLayout(selectedLayout); resetRenderCaches(); } }, [gs.run, selectedLayout]);
  const pf = gs.profile; const run = gs.run;
  const click = () => { initAudio(); sfx({ type: 'ui' }); };
  const activeRegions = selectedLayout === U05_WORLD_LAYOUT_ID ? VEYRA_REGIONS : CLASSIC_REGIONS;

  return <div style={{ position: 'fixed', inset: 0, background: '#05040a' }}>
    <div className="stage" style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${s.k})` }}>
      <Backdrop layout={selectedLayout} />
      {summary ? <div className="panel absolute fadein" style={{ left: 120, top: 44, width: 400, padding: 10 }}>
        <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: 1 }}>RUN CHRONICLE · 14-DAY CYCLE CONCLUDED</div>
        <div className="title-font" style={{ fontSize: 22, color: summary.ending === 'evacuated' ? 'var(--info)' : summary.ending === 'expired' ? 'var(--bad)' : 'var(--paper)' }}>
          {summary.ending === 'evacuated' ? 'Evacuated from the Island' : summary.ending === 'expired' ? 'Consumed by Ragnarok' : 'Run Abandoned'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <div className="console-col">
            <div className="console-h" style={{ color: 'var(--info)' }}>Preserved on Profile</div>
            <div className="lbl" style={{ fontSize: 10, color: 'var(--info)' }}>Secured Cash: <b>{pf.securedCash}</b> <span style={{ color: 'var(--muted)' }}>(+{summary.deposited} this run)</span></div>
            <div className="lbl" style={{ fontSize: 9, color: 'var(--brassLit)', marginTop: 2 }}>Elder Stones: <b>{summary.stones}/6</b>{summary.stones >= 6 ? ' ★ Crown of Six' : ''}</div>
            <div className="lbl" style={{ fontSize: 9, color: 'var(--paper)', marginTop: 2 }}>Run Score: <b>{summary.score}</b> {summary.qa && <span className="chip" style={{ color: 'var(--warn)' }}>QA</span>} <span className="chip" style={{ color: 'var(--muted)' }}>{summary.verified}</span></div>
          </div>
          <div className="console-col">
            <div className="console-h" style={{ color: 'var(--bad)' }}>Reset with the Island</div>
            <div className="lbl" style={{ fontSize: 9, color: 'var(--muted)', lineHeight: 1.25 }}>
              All run-local gear, Creator Cores, learned recipes, shelter, vehicles, cargo &amp; unsecured cash have been wiped.
            </div>
          </div>
        </div>
        {summary.achievements.length > 0 && <div style={{ fontSize: 11, marginTop: 5 }}>{summary.achievements.map(a => <span key={a} style={{ marginRight: 6, color: 'var(--brassLit)' }}>★ {ACHIEVEMENTS[a]?.name}</span>)}</div>}
        <button className="btn gold" style={{ marginTop: 8, width: '100%' }} onClick={() => { click(); clearSummary(); }}>Continue to Title</button>
      </div> : <>
        {mode !== 'select' && mode !== 'qa' && <div className="absolute" style={{ left: 0, right: 0, top: 18, textAlign: 'center' }}>
          {import.meta.env.VITE_FX_TEST === '1' && <div style={{ color: '#ffdf7b', fontSize: 12 }}>VFX TEST — 10 mỗi Core, đầy năng lượng · lưu riêng</div>}
          <div className="title-font" style={{ fontSize: 44, fontWeight: 700, color: '#ffe8b0', letterSpacing: 3, textShadow: '0 3px 0 #6a2a0a, 0 5px 0 #2a0a04, 0 0 18px #ff7a2a' }}>SOUL OF HERO</div>
          <div style={{ fontSize: 13, color: '#e0c8a8', marginTop: -2, textShadow: '1px 1px 0 #000' }}>fourteen days · one island · the end of the world</div>
        </div>}
        {mode === 'menu' && <div className="absolute flex flex-col gap-2 items-center fadein" style={{ left: 0, right: 0, top: 128 }}>
          {run && <button className="btn gold" style={{ fontSize: 15, width: 210 }} onClick={() => { click(); onContinue(); }}>Continue — {run.character === 'female' ? 'Adventurer ♀' : 'Adventurer ♂'}</button>}
          <button className="btn" style={{ fontSize: 15, width: 210 }} disabled={!!run} title={run ? 'Finish (evacuate/abandon) your current run first' : ''} onClick={() => { click(); setActiveLayout(selectedLayout); resetRenderCaches(); setMode('select'); }}>New run</button>
          {onStartQa && <button className="btn gold" style={{ fontSize: 13, width: 210 }} onClick={() => { click(); setMode('qa'); }}>Full-Gear QA Sandbox [F9]</button>}
          <button className="btn" style={{ fontSize: 13, width: 210 }} onClick={() => { click(); setMode('history'); }}>Profile &amp; history</button>
          {onInspect && <button className="btn ghost" style={{ fontSize: 11, width: 210, color: '#9ae0ff' }} onClick={() => { click(); onInspect(); }}>Creator Inspector · 81 POIs</button>}
          <div style={{ fontSize: 11, color: 'var(--paper)', marginTop: 2, textShadow: '1px 1px 0 #000' }}>Secured Ragnarok cash: <b style={{ color: 'var(--info)' }}>{pf.securedCash}</b> · Runs: {pf.history.length}</div>
          {note && <div style={{ fontSize: 10, color: 'var(--warn)', maxWidth: 380, textAlign: 'center' }}>{note}</div>}
          <div style={{ fontSize: 9, color: 'var(--muted)', position: 'absolute', top: 214 }}>Offline · single-player · saves locally in this browser (LOCAL/UNVERIFIED)</div>
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
            <button className="btn gold" style={{ fontSize: 13, padding: '4px 16px' }} onClick={() => { click(); onStartQa(qaPreset, hero); }}>Launch QA Sandbox</button>
          </div>
        </div>}
        {mode === 'select' && <div className="panel absolute fadein" style={{ left: 90, top: 26, width: 460, padding: 8 }}>
          <div className="panel-h" style={{ marginBottom: 4 }}>Choose your Adventurer</div>
          <div className="flex gap-2">{(['female', 'male'] as const).map(h => <button key={h} className={`btn ${hero === h ? 'gold' : 'ghost'}`} style={{ flex: 1, padding: 4, textAlign: 'left' }} onClick={() => { click(); setHero(h); }}>
            <div className="flex items-center gap-2"><HeroPreview female={h === 'female'} active={hero === h} /><div style={{ fontSize: 11, lineHeight: 1.15 }}><div className="title-font" style={{ fontSize: 13 }}>{h === 'female' ? 'Adventurer ♀' : 'Adventurer ♂'}</div><div>Survival knife, a half-full flask, a few berries. No Core, no map, no orders.</div></div></div></button>)}</div>
          <div style={{ fontSize: 11, marginTop: 6, color: '#ffd98a' }}>World</div>
          <div className="flex gap-1" style={{ marginTop: 2 }}>
            <button className={`btn ${selectedLayout === U05_WORLD_LAYOUT_ID ? 'gold' : 'ghost'}`} style={{ fontSize: 10 }} onClick={() => { click(); setSelectedLayout(U05_WORLD_LAYOUT_ID); setRegion(null); }}>VEYRA · Unified World</button>
            <button className={`btn ${selectedLayout === 'shipping' ? 'gold' : 'ghost'}`} style={{ fontSize: 10 }} onClick={() => { click(); setSelectedLayout('shipping'); setRegion(null); }}>Classic Island (R12)</button>
          </div>
          <div style={{ fontSize: 10, color: '#e8dcc8', marginTop: 2 }}>
            {selectedLayout === U05_WORLD_LAYOUT_ID
              ? <><b style={{ color: '#ffe27a' }}>VEYRA · Unified World</b> · 4000×2800 tiles (1 tile = 0.5 AU) · 81 POIs, livestock husbandry, 4 side bosses &amp; 6 Primordials.</>
              : <><b style={{ color: '#9ae0ff' }}>Classic Island (R12)</b> · 200×200 tiles · classic 6-Elder island &amp; R12 industrial baseline.</>}
          </div>
          <div style={{ fontSize: 11, marginTop: 5, color: '#ffd98a' }}>Landing region</div>
          <div className="flex flex-wrap gap-1" style={{ marginTop: 2 }}>
            <button className={`btn ${region === null ? 'gold' : 'ghost'}`} style={{ fontSize: 10 }} onClick={() => { click(); setRegion(null); }}>Random safe region</button>
            {activeRegions.map(rg => <button key={rg.id} className={`btn ${region === rg.id ? 'gold' : 'ghost'}`} style={{ fontSize: 10 }} onClick={() => { click(); setRegion(rg.id); }}>{rg.label}</button>)}
          </div>
          <div style={{ fontSize: 10, color: '#cfc2dc', minHeight: 20, marginTop: 3 }}>
            {region === null ? 'Seeded safe landing across the four coastal/lakeside regions. No starter shelter.' : `Seeded safe landing in ${activeRegions[region]?.label}. Reachable wood, stone, food and fresh water.`}
          </div>
          <div className="flex justify-between items-center" style={{ marginTop: 6 }}><button className="btn ghost" onClick={() => setMode('menu')}>Back</button><button className="btn gold" style={{ fontSize: 16, padding: '4px 16px' }} onClick={() => { click(); onStart(hero, region, selectedLayout); }}>Begin the 14 days</button></div>
        </div>}
        {mode === 'history' && <div className="panel absolute fadein" style={{ left: 100, top: 96, width: 440, padding: 8 }}>
          <div className="panel-h">Profile <span className="tag" style={{ color: '#ff9a7a', marginLeft: 4 }}>LOCAL/UNVERIFIED — browser-stored, not a global leaderboard</span></div>
          <div style={{ fontSize: 12, marginTop: 3 }}>Secured Ragnarok cash: <b style={{ color: '#9ae0ff' }}>{pf.securedCash}</b> — the only value that crosses runs.</div>
          <div style={{ fontSize: 11, color: '#ffd98a', marginTop: 4 }}>Achievements</div>
          <div className="flex flex-wrap gap-x-3" style={{ fontSize: 10 }}>{Object.entries(ACHIEVEMENTS).map(([k, a]) => <span key={k} style={{ color: pf.achievements[k] ? '#ffe27a' : '#5a4a6a' }}>{pf.achievements[k] ? '★' : '☆'} {a.name}</span>)}</div>
          <div style={{ fontSize: 11, color: '#ffd98a', marginTop: 4 }}>Run history</div>
          <div className="scroll" style={{ maxHeight: 110, overflowY: 'auto', fontSize: 10 }}>{pf.history.length === 0 && <div style={{ color: '#8a7a9a' }}>No finished runs yet.</div>}{pf.history.map(h => <div key={h.runId + h.endedAt} className="flex gap-2" style={{ borderBottom: '1px solid #2a2034' }}><span style={{ width: 70 }}>{new Date(h.endedAt).toLocaleDateString()}</span><span style={{ width: 70, color: h.ending === 'evacuated' ? '#9ae0ff' : '#cfc2dc' }}>{h.ending}</span><span style={{ width: 60 }}>score {h.score}</span><span style={{ width: 70 }}>deposit {h.deposited}</span><span>stones {h.stones}</span>{h.qa && <span style={{ color: '#ff9a7a' }}>QA</span>}</div>)}</div>
          <button className="btn ghost" style={{ marginTop: 6 }} onClick={() => setMode('menu')}>Back</button>
        </div>}
      </>}
    </div>
  </div>;
}
