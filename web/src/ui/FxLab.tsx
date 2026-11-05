// ============================================================================
// FX Test Lab (dev/QA only, F9) — a visual workbench over the SAME compositor
// the gameplay uses (pixelfx.ts). Lab casts are VISUAL-ONLY: they never
// dispatch intents and never touch charges, damage, items, terrain or saves.
// H collapses the panel for clean screenshots; Enter re-casts the last FX.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import type { GameState } from '../game/core';
import * as pfx from '../game/pixelfx';

export default function FxLab({ gs, hidden, onHide, onClose, nightOverride, setNightOverride, getMouseWorld, getTarget }: {
  gs: GameState; hidden: boolean;
  onHide: () => void; onClose: () => void;
  nightOverride: boolean; setNightOverride: (v: boolean) => void;
  getMouseWorld: () => { x: number; y: number };
  getTarget: () => { x: number; y: number } | null;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [family, setFamily] = useState<pfx.PfxFamily>('ground');
  const [scaleMul, setScaleMul] = useState(1);
  const [full, setFull] = useState(false);
  const [tick, setTick] = useState(0);
  const [st, setSt] = useState(pfx.getStats());
  const [paused, setPaused] = useState(false);
  const [layers, setLayers] = useState({ ...pfx.layers });

  useEffect(() => { pfx.fullMode().then(setFull); const a = setInterval(() => { setTick(t => t + 1); pfx.fullMode().then(setFull); }, 500); return () => clearInterval(a); }, []);
  useEffect(() => { const iv = setInterval(() => setSt(pfx.getStats()), 500); return () => clearInterval(iv); }, []);
  useEffect(() => { pfx.setPaused(paused); }, [paused]);
  useEffect(() => { Object.assign(pfx.layers, layers); }, [layers]);

  const cat = useMemo(() => pfx.catalog(), [tick, full]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return cat.filter(c => !s || c.id.includes(s) || c.name.toLowerCase().includes(s)).slice(0, 400);
  }, [cat, q]);
  const selEntry = sel ? cat.find(c => c.id === sel) ?? null : null;

  const cast = (id: string | null, where: 'mouse' | 'player' | 'target') => {
    if (!id) return;
    setLast(id);
    let x: number, y: number;
    if (where === 'mouse') { const m = getMouseWorld(); x = m.x; y = m.y; }
    else if (where === 'target') { const t = getTarget(); if (!t) return; x = t.x; y = t.y; }
    else { const p = gs.run!.player; x = p.x; y = p.y; }
    pfx.spawn(id, { x, y, family, scaleMul });
  };
  // Enter = replay last effect at player (quick recall)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'Enter' && last) { cast(last, 'player'); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [last, family, scaleMul]);

  const r = gs.run!;
  if (hidden) return (
    <div className="panel absolute" style={{ left: 4, top: 96, padding: '2px 6px', fontSize: 10, zIndex: 40, cursor: 'pointer' }}
      onMouseDown={e => { e.stopPropagation(); onHide(); }} onClick={() => onHide()}>
      <span style={{ color: '#ffe27a' }}>🧪 FX Lab hidden (F9 / H to show)</span>
    </div>
  );

  return (
    <div className="panel absolute" style={{ left: 4, top: 96, width: 308, maxHeight: 252, overflow: 'auto', padding: '4px 6px', fontSize: 10, zIndex: 40 }} onMouseDown={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ffe27a' }}>
        <b>FX LAB (F9)</b>
        <span>
          <span onClick={onHide} style={{ cursor: 'pointer', color: '#9ac0ff', marginRight: 6 }}>⇩ hide (H)</span>
          <span onClick={onClose} style={{ cursor: 'pointer', color: '#ff9a8a' }}>✕</span>
        </span>
      </div>
      <div style={{ color: '#9a8ab0' }}>{full ? 'full pack: 244 lazy' : 'pilot pack embedded (11)'} · {st.instances} live · {st.fps.toFixed(0)} fps · p50 {st.p50.toFixed(1)} / p95 {st.p95.toFixed(1)} ms · {pfx.getQuality()}</div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="search 244 effects… (Enter = replay last)"
        style={{ width: '100%', background: '#120c18', color: '#e8dcc8', border: '1px solid #5a4a6a', fontSize: 10, margin: '2px 0' }} />
      <div style={{ maxHeight: 96, overflow: 'auto', border: '1px solid #3a2f4a' }}>
        {list.map(c => (
          <div key={c.id} onClick={() => { setSel(c.id); setLast(c.id); }} style={{ padding: '0 3px', cursor: 'pointer', background: sel === c.id ? '#3a2f5a' : undefined, color: c.loaded ? '#cfe8b0' : c.pilot ? '#9ac0ff' : '#8a7a9a' }}>
            {c.id} <span style={{ color: '#6a5a7a' }}>{c.loaded ? '●' : '○'}</span>
          </div>
        ))}
      </div>
      {selEntry && <div style={{ marginTop: 2, color: '#cfc2dc' }}><b style={{ color: '#ffe0a0' }}>{selEntry.id}</b> — {selEntry.name} · {selEntry.state} · {selEntry.loaded ? 'loaded' : selEntry.pilot ? 'pilot' : 'needs full pack'}</div>}
      <div style={{ marginTop: 2 }}>
        {(['ground', 'hover', 'body', 'screen', 'proj'] as const).map(a => (
          <button key={a} className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2, borderColor: family === a ? '#ffd070' : undefined }} onClick={() => setFamily(a)}>{a}</button>
        ))}
        <span style={{ marginLeft: 4, color: '#9a8ab0' }}>scale <input type="range" min={0.2} max={2} step={0.05} value={scaleMul} onChange={e => setScaleMul(+e.target.value)} style={{ width: 70, verticalAlign: 'middle' }} /> {scaleMul.toFixed(2)}×</span>
      </div>
      <div style={{ marginTop: 2 }}>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => cast(sel, 'mouse')}>▶ mouse</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => cast(sel, 'player')}>▶ player</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => cast(sel, 'target')}>▶ target</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => cast(last, 'player')}>↻ last</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => pfx.clear()}>clear</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', borderColor: paused ? '#ffd070' : undefined }} onClick={() => setPaused(!paused)}>{paused ? '▶' : '⏸'}</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px' }} onClick={() => pfx.scrub(160)}>+frame</button>
      </div>
      <div style={{ marginTop: 2, color: '#9a8ab0' }}>
        layers:
        {(['art', 'emission', 'radiance', 'warp'] as const).map(k => (
          <label key={k} style={{ marginRight: 5, cursor: 'pointer' }}><input type="checkbox" checked={layers[k]} onChange={e => setLayers(l => ({ ...l, [k]: e.target.checked }))} /> {k}</label>
        ))}
        <select value={pfx.getQuality()} onChange={e => pfx.setQuality(e.target.value as any)} style={{ background: '#120c18', color: '#e8dcc8', fontSize: 9, marginLeft: 4 }}>
          <option value="high">high</option><option value="balanced">balanced</option><option value="performance">performance</option>
        </select>
      </div>
      <div style={{ marginTop: 2 }}>
        <button className="btn gold" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => (window as any).__d20qa.play()}>▶ #20 Reality Ripper (QA)</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => { const c = (window as any).__d20qa.client; c.mode = c.mode === 'restored' ? 'current' : 'restored'; }}>#20: {((window as any).__d20qa.client.mode === 'restored') ? 'Restored A+C' : 'Current Web'}</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} title="replay A→B→A: collision must regenerate identically" onClick={() => { const q = (window as any).__d20qa; q.seek(6.6); setTimeout(() => q.seek(0.5), 120); setTimeout(() => q.seek(6.6), 240); }}>#20 ↺A→B→A</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => (window as any).__d20qa.seek(6.3)}>#20 @climax 6.3s</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => (window as any).__d20qa.seek(8.2)}>#20 @restitch 8.2s</button>
        <select style={{ fontSize: 9, maxWidth: 150, background: '#101c29', color: '#cfe6f5', border: '1px solid #33506b' }}
          defaultValue="" onChange={(e) => { const i = parseInt(e.target.value); if (!isNaN(i)) { (window as any).__arcanaLab.cast(i, 'lead'); } e.target.value = ''; }}>
          <option value="">ARCANA20 lab: chọn chiêu…</option>
          {(window as any).__arcanaLab?.catalog.map((c: any) => <option key={c.index} value={c.index}>#{String(c.id).padStart(2,'0')} {c.name} — lead {c.approvedVisualLead} [{c.previewStatus}]</option>) ?? null}
        </select>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px' }} onClick={() => { const L = (window as any).__arcanaLab; const info = L.info(); if (info) L.seek(Math.min(info.climax, info.dur * 0.6), info.index, info.mode); }}>@climax</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px' }} title="approved visual lead (A/B/C/D/A+C per creator vote)" onClick={() => { const L = (window as any).__arcanaLab; const info = L.info(); if (info) L.seek(0.01, info.index, 'lead'); }}>▶lead</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px' }} title="C source study (comparison only)" onClick={() => { const L = (window as any).__arcanaLab; const info = L.info(); if (info) L.seek(0.01, info.index, 'study'); }}>C-study</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px' }} title="fusion recipe candidate (not creator-approved final)" onClick={() => { const L = (window as any).__arcanaLab; const info = L.info(); if (info) L.seek(0.01, info.index, 'fusion'); }}>fusion?</button>
        <input type="range" min={0} max={100} defaultValue={1} style={{ width: 90, height: 10, verticalAlign: 'middle' }}
          onChange={(e) => { const L = (window as any).__arcanaLab; const info = L.info(); if (info) L.seek((parseInt(e.target.value) / 100) * info.dur, info.index, info.mode); }}
          title="scrub timeline" />
        {['open', 'peak', 'out'].map((ph) => (
          <button key={ph} className="btn" style={{ fontSize: 9, padding: '0 4px' }} onClick={() => { const L = (window as any).__arcanaLab; const info = L.info(); if (!info) return; const t = ph === 'open' ? info.dur * 0.15 : ph === 'peak' ? Math.min(info.climax + 0.3, info.dur * 0.62) : info.dur * 0.92; L.seek(t, info.index, info.mode); }}>{ph}</button>
        ))}
      </div>
      <div style={{ marginTop: 2 }}>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2, borderColor: nightOverride ? '#8ab0ff' : undefined }} onClick={() => setNightOverride(!nightOverride)}>{nightOverride ? '☾ QA night' : '☼ day'}</button>
        <span style={{ color: '#8a7a9a' }}>lab casts are visual-only — no charges/damage/save changes</span>
      </div>
    </div>
  );
}
void 0;
