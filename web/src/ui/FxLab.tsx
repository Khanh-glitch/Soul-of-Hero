// ============================================================================
// FX Test Lab (dev/QA only, F9). Browses the PixelFX catalog and triggers
// effects through the SAME universal adapter the gameplay uses (pixelfx.ts).
// Lab casts are VISUAL-ONLY: they never dispatch intents, never touch charges,
// damage, items, terrain, or saves.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import type { GameState } from '../game/core';
import * as pfx from '../game/pixelfx';

export default function FxLab({ gs, getMouseWorld, getTarget, nightOverride, setNightOverride, onClose }: {
  gs: GameState;
  getMouseWorld: () => { x: number; y: number };
  getTarget: () => { x: number; y: number } | null;
  nightOverride: boolean; setNightOverride: (v: boolean) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<pfx.PfxAnchor>('ground');
  const [full, setFull] = useState(false);
  const [tick, setTick] = useState(0);
  const [, setFps] = useState(0);

  useEffect(() => { pfx.fullMode().then(setFull); const iv = setInterval(() => setTick(t => t + 1), 500); return () => clearInterval(iv); }, []);
  useEffect(() => { const iv = setInterval(() => setFps(pfx.getStats().fps), 500); return () => clearInterval(iv); }, []);

  const cat = useMemo(() => pfx.catalog(), [tick, full, q]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return cat.filter(c => !s || c.id.includes(s) || c.name.toLowerCase().includes(s)).slice(0, 400);
  }, [cat, q]);
  const selEntry = useMemo(() => (sel ? pfx.catalog().find(c => c.id === sel) ?? null : null), [sel, tick]);

  const cast = (where: 'mouse' | 'player' | 'target') => {
    if (!sel) return;
    let x: number, y: number;
    if (where === 'mouse') { const m = getMouseWorld(); x = m.x; y = m.y; }
    else if (where === 'target') { const t = getTarget(); if (!t) return; x = t.x; y = t.y; }
    else { const p = gs.run!.player; x = p.x; y = p.y; }
    pfx.spawn(sel, { x, y, anchor });
  };

  const st = pfx.getStats();
  const r = gs.run!;

  return (
    <div className="panel absolute" style={{ left: 4, top: 96, width: 300, maxHeight: 250, overflow: 'auto', padding: '4px 6px', fontSize: 10, zIndex: 40 }} onMouseDown={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ffe27a' }}>
        <b>FX TEST LAB (F9)</b><span onClick={onClose} style={{ cursor: 'pointer', color: '#ff9a8a' }}>✕</span>
      </div>
      <div style={{ color: '#9a8ab0' }}>{full ? 'full pack: 244 effects lazy-loaded' : 'pilot pack embedded (10) — full pack at /pixelfx-assets'} · {st.instances} live · {st.fps.toFixed(0)} fps · {st.frameMs.toFixed(1)} ms</div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="search 244 effects…"
        style={{ width: '100%', background: '#120c18', color: '#e8dcc8', border: '1px solid #5a4a6a', fontSize: 10, margin: '2px 0' }} />
      <div style={{ maxHeight: 110, overflow: 'auto', border: '1px solid #3a2f4a' }}>
        {list.map(c => (
          <div key={c.id} onClick={() => setSel(c.id)} style={{ padding: '0 3px', cursor: 'pointer', background: sel === c.id ? '#3a2f5a' : undefined, color: c.loaded ? '#cfe8b0' : c.pilot ? '#9ac0ff' : '#8a7a9a' }}>
            {c.id} <span style={{ color: '#6a5a7a' }}>{c.loaded ? '●' : '○'}</span>
          </div>
        ))}
      </div>
      {selEntry && <div style={{ marginTop: 2, color: '#cfc2dc' }}>
        <b style={{ color: '#ffe0a0' }}>{selEntry.id}</b> — {selEntry.name} · {selEntry.state} · {selEntry.loaded ? 'loaded' : selEntry.pilot ? 'pilot (embeds on load)' : 'not loaded (needs full pack)'}
      </div>}
      <div style={{ marginTop: 2 }}>
        {(['ground', 'hover', 'body', 'screen'] as const).map(a => (
          <button key={a} className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2, borderColor: anchor === a ? '#ffd070' : undefined }} onClick={() => setAnchor(a)}>{a}</button>
        ))}
      </div>
      <div style={{ marginTop: 2 }}>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => cast('mouse')}>▶ at mouse</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => cast('player')}>▶ at player</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => cast('target')}>▶ at target</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2 }} onClick={() => sel && pfx.spawn(sel, { x: r.player.x, y: r.player.y, anchor })}>↻ replay</button>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px' }} onClick={() => pfx.clear()}>clear</button>
      </div>
      <div style={{ marginTop: 2 }}>
        <button className="btn" style={{ fontSize: 9, padding: '0 4px', marginRight: 2, borderColor: nightOverride ? '#8ab0ff' : undefined }} onClick={() => setNightOverride(!nightOverride)}>{nightOverride ? '☾ night (QA)' : '☼ day'}</button>
        <span style={{ color: '#8a7a9a' }}>lab casts are visual-only — no charges/damage/save changes</span>
      </div>
    </div>
  );
}
