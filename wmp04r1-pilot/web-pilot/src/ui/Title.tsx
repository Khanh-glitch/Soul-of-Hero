import { useEffect, useRef, useState } from 'react';
import { VIEW_W, VIEW_H, type GameState } from '../game/core';
import { getArt } from '../game/art';
import { getMapCanvas, resetRenderCaches } from '../game/render';
import { WMP04_PILOT_SCENES } from '../game/veyra/wmp04r1';
import { getWorld, getActiveLayout, setActiveLayout, listLayouts, mapPackageErrors } from '../game/world';
import { ACHIEVEMENTS } from '../game/catalog';
import { initAudio, sfx } from '../game/audio';

function useScale() {
  const [s, setS] = useState({ k: 1, x: 0, y: 0 });
  useEffect(() => { const fit = () => { const W = window.innerWidth, H = window.innerHeight; let k = Math.floor(Math.min(W / VIEW_W, H / VIEW_H)); if (k < 1) k = Math.min(W / VIEW_W, H / VIEW_H); setS({ k, x: Math.floor((W - VIEW_W * k) / 2), y: Math.floor((H - VIEW_H * k) / 2) }); }; fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, []);
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

export default function Title({ gs, onContinue, onStart, note, summary, clearSummary }: { gs: GameState; onContinue: () => void; onStart: (c: 'male' | 'female', region: number | null) => void; note?: string; summary: GameState['profile']['history'][number] | null; clearSummary: () => void }) {
  const s = useScale(); const [mode, setMode] = useState<'menu' | 'select' | 'history'>('menu'); const [hero, setHero] = useState<'male' | 'female'>('female'); const [region, setRegion] = useState<number | null>(null); const [layout, setLayout] = useState(getActiveLayout());
  const chooseLayout = (id: string) => { if (setActiveLayout(id)) { resetRenderCaches(); setLayout(id); } };
  const pilotStart = (sc: { id: string; layoutId: string; viewAnchorTile: [number, number] | null }) => {
    const q = new URLSearchParams({ pilot: sc.id, autostart: '1', seed: '20261104' });
    if (sc.viewAnchorTile) q.set('cam', sc.viewAnchorTile.join(','));
    window.location.href = `${window.location.pathname}?${q.toString()}`;
  };
  const pf = gs.profile; const run = gs.run;
  const isVeyra = !!getWorld().veyra;
  const click = () => { initAudio(); sfx({ type: 'ui' }); };
  return <div style={{ position: 'fixed', inset: 0, background: '#05040a' }}>
    <div className="stage" style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${s.k})` }}>
      <Backdrop layout={layout} />
      {summary ? <div className="panel absolute fadein" style={{ left: 150, top: 60, width: 340, padding: 10 }}>
        <div className="title-font" style={{ fontSize: 20, color: summary.ending === 'evacuated' ? '#9ae0ff' : summary.ending === 'expired' ? '#ff9a5a' : '#cfc2dc' }}>{summary.ending === 'evacuated' ? 'Evacuated' : summary.ending === 'expired' ? 'Consumed by Ragnarok' : 'Run abandoned'}</div>
        <div style={{ fontSize: 12, lineHeight: 1.2, marginTop: 4 }}>Score {summary.score} · Deposited {summary.deposited} · Elder stones {summary.stones}/6 {summary.qa && <span className="tag" style={{ color: '#ff9a7a' }}>QA</span>} <span className="tag" style={{ color: '#ff9a7a' }}>{summary.verified}</span></div>
        <div style={{ fontSize: 11, color: '#cfc2dc', marginTop: 4 }}>All run-local items, Cores, recipes, buildings, cargo, bags, discoveries and unsecured cash are gone. Kept on your profile: <b style={{ color: '#9ae0ff' }}>{pf.securedCash} secured cash</b>, achievements and this record.</div>
        <div style={{ fontSize: 11, marginTop: 3 }}>{summary.achievements.map(a => <span key={a} style={{ marginRight: 6, color: '#ffe27a' }}>★ {ACHIEVEMENTS[a]?.name}</span>)}</div>
        <button className="btn gold" style={{ marginTop: 8 }} onClick={() => { click(); clearSummary(); }}>Return</button>
      </div> : <>
        <div className="absolute" style={{ left: 0, right: 0, top: 18, textAlign: 'center' }}>
          <div className="title-font" style={{ fontSize: 44, fontWeight: 700, color: '#ffe8b0', letterSpacing: 3, textShadow: '0 3px 0 #6a2a0a, 0 5px 0 #2a0a04, 0 0 18px #ff7a2a' }}>SOUL OF HERO</div>
          <div style={{ fontSize: 13, color: '#e0c8a8', marginTop: -2, textShadow: '1px 1px 0 #000' }}>fourteen days · one island · the end of the world</div>
        </div>
        {mode === 'menu' && <div className="absolute flex flex-col gap-2 items-center fadein" style={{ left: 0, right: 0, top: 150 }}>
          {run && <button className="btn gold" style={{ fontSize: 16, width: 180 }} onClick={() => { click(); onContinue(); }}>Continue — {run.character === 'female' ? 'Adventurer ♀' : 'Adventurer ♂'}</button>}
          <button className="btn" style={{ fontSize: 16, width: 180 }} disabled={!!run} title={run ? 'Finish (evacuate/abandon) your current run first' : ''} onClick={() => { click(); if (layout === 'shipping' || layout === 'dev_delta') chooseLayout(layout + '_fresh'); else if (layout === 'veyra-greywater-u16' || layout === 'veyra-greywater-u20') chooseLayout(layout.replace('greywater-', 'greywater-lr02-')); else if (layout === 'veyra-oasis-u20') chooseLayout('veyra-oasis-lr02-u20'); setMode('select'); }}>New run</button>
          <button className="btn" style={{ fontSize: 16, width: 180 }} onClick={() => { click(); setMode('history'); }}>Profile & history</button>
          <div style={{ fontSize: 11, color: '#cfc2dc', marginTop: 6, textShadow: '1px 1px 0 #000' }}>Secured Ragnarok cash: <b style={{ color: '#9ae0ff' }}>{pf.securedCash}</b> · Runs: {pf.history.length}</div>
          {note && <div style={{ fontSize: 10, color: '#ffb08a', maxWidth: 380, textAlign: 'center' }}>{note}</div>}
          <div style={{ fontSize: 9, color: '#7a6a8a', position: 'absolute', top: 186 }}>Offline · single-player · saves locally in this browser (LOCAL/UNVERIFIED)</div>
        </div>}
        {mode === 'menu' && <div className="panel absolute fadein" data-testid="wmp04r1-pilot-selector" style={{ left: 8, top: 232, width: 220, padding: 6 }}>
          <div className="panel-h">WMP-04R1 visual pilot · quick scene</div>
          <div style={{ fontSize: 9, color: '#cfc2dc', lineHeight: 1.1, margin: '2px 0 4px' }}>Real SOH renderer · 5 scenes · WASD to move in each. P opens the in-game selector.</div>
          <div className="flex flex-col gap-1">{WMP04_PILOT_SCENES.map((sc, k) => <button key={sc.id} data-testid={`pilot-scene-${k + 1}`} disabled={!!run} className={`btn ${layout === sc.layoutId ? 'gold' : 'ghost'}`} style={{ textAlign: 'left', fontSize: 10 }} onClick={() => pilotStart(sc)}>{k + 1}. {sc.title}</button>)}</div>
          <div style={{ fontSize: 9, color: '#8a7a9a', marginTop: 3 }}>8 AU cells ≠ tiles · U=2 diagnostic · no new tileset</div>
        </div>}
        {mode === 'select' && <div className="panel absolute fadein" style={{ left: 90, top: 48, width: 460, padding: 8 }}>
          <div className="panel-h" style={{ marginBottom: 4 }}>Choose your Adventurer</div>
          <div className="flex gap-2">{(['female', 'male'] as const).map(h => <button key={h} className={`btn ${hero === h ? 'gold' : 'ghost'}`} style={{ flex: 1, padding: 4, textAlign: 'left' }} onClick={() => { click(); setHero(h); }}>
            <div className="flex items-center gap-2"><HeroPreview female={h === 'female'} active={hero === h} /><div style={{ fontSize: 11, lineHeight: 1.15 }}><div className="title-font" style={{ fontSize: 13 }}>{h === 'female' ? 'Adventurer ♀' : 'Adventurer ♂'}</div><div>Survival knife, a half-full flask, a few berries. No Core, no map, no orders.</div></div></div></button>)}</div>
          <div style={{ fontSize: 11, marginTop: 5, color: '#ffd98a' }}>Map layout</div>
          <div className="flex flex-wrap gap-1" style={{ marginTop: 2 }}>
            {listLayouts().map(m => <button key={m.id} data-testid={`layout-${m.id.replace('_','-')}`} className={`btn ${layout === m.id ? 'gold' : 'ghost'}`} onClick={() => { chooseLayout(m.id); setRegion(null); }}>{m.title}</button>)}
          </div>
          <div style={{ fontSize: 9, color: '#cfc2dc', marginTop: 1 }}>{listLayouts().find(m => m.id === layout)?.description}{mapPackageErrors().length > 0 && ` · ${mapPackageErrors().length} invalid map package(s): ${mapPackageErrors().join('; ')}`}</div>
          <div style={{ fontSize: 11, marginTop: 4, color: '#ffd98a' }}>Landing</div>
          <div className="flex flex-wrap gap-1" style={{ marginTop: 2 }}><button className="btn gold" onClick={() => setRegion(null)}>Seeded safe region</button></div>
          <div style={{ fontSize: 10, color: '#cfc2dc', minHeight: 24, marginTop: 2 }}>{isVeyra ? 'Seeded legal location in this bounded Veyra region. No starter shelter.' : 'Seeded safe location; no starter compound or crate.'}</div>
          <div className="flex justify-between items-center" style={{ marginTop: 4 }}><button className="btn ghost" onClick={() => setMode('menu')}>Back</button><button className="btn gold" style={{ fontSize: 16, padding: '4px 16px' }} onClick={() => { click(); onStart(hero, region); }}>Begin the 14 days</button></div>
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
