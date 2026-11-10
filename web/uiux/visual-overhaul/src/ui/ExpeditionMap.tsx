import { useEffect, useRef, useState } from 'react';
import { TILE, WW, type RunState } from '../game/core';
import { getMapCanvas } from '../game/render';
import { getWorld, ZONES } from '../game/world';
import { C, runHours } from '../game/engine';
import { deathBagView } from '../game/death-view';
import { expeditionNotes } from '../game/expedition-intel';
import { addFieldMark, discoveredCell, readFieldMarks, storeFieldMarks, type FieldMark, type MarkKind } from '../game/map-notes';
import { Panel, Icon, type Api } from './common';

const MARKS: { kind: MarkKind; label: string; sign: string; color: string }[] = [
  { kind: 'return', label: 'Return', sign: '◆', color: '#f2cf82' },
  { kind: 'materials', label: 'Materials', sign: '▣', color: '#80c7c2' },
  { kind: 'danger', label: 'Danger', sign: '×', color: '#e88369' },
  { kind: 'shelter', label: 'Shelter', sign: '■', color: '#a6d080' },
];

function mapXY(e: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  return { tx: Math.max(0, Math.min(WW - 1, Math.floor((e.clientX - rect.left) * 200 / rect.width))), ty: Math.max(0, Math.min(WW - 1, Math.floor((e.clientY - rect.top) * 200 / rect.height))) };
}

function renderChart(ctx: CanvasRenderingContext2D, r: RunState, marks: FieldMark[], selected: string | null, teleportTarget?: { x: number; y: number } | null) {
  const w = getWorld(r.layoutId || 'shipping');
  ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, 200, 200);
  ctx.drawImage(getMapCanvas(r), 0, 0);
  // Solid fog: no terrain, POI, enemy, or stock silhouettes from unseen cells.
  ctx.fillStyle = '#111c23';
  for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) if (!r.discovered[y * 50 + x]) ctx.fillRect(x * 4, y * 4, 4, 4);
  ctx.fillStyle = 'rgba(240,222,183,.10)';
  for (let i = 25; i < 200; i += 25) { ctx.fillRect(i, 0, 1, 200); ctx.fillRect(0, i, 200, 1); }
  const p = (x: number, y: number, c: string, shape: 'dot' | 'diamond' | 'ring' | 'cross' = 'dot') => {
    const xx = Math.round(x), yy = Math.round(y); ctx.fillStyle = '#070b0f'; ctx.fillRect(xx - 2, yy - 2, 5, 5);
    ctx.fillStyle = c;
    if (shape === 'cross') { ctx.fillRect(xx - 1, yy - 1, 3, 1); ctx.fillRect(xx, yy - 2, 1, 4); }
    else if (shape === 'diamond') { ctx.fillRect(xx, yy - 2, 1, 5); ctx.fillRect(xx - 2, yy, 5, 1); ctx.fillRect(xx - 1, yy - 1, 3, 3); }
    else if (shape === 'ring') { ctx.fillRect(xx - 1, yy - 1, 3, 3); ctx.fillStyle = '#111c23'; ctx.fillRect(xx, yy, 1, 1); }
    else ctx.fillRect(xx - 1, yy - 1, 3, 3);
  };
  for (const site of w.places) if (r.poiSeen.includes(site.id) && discoveredCell(r, site.tx, site.ty)) p(site.tx, site.ty, site.kind === 'elder' ? '#ef836d' : site.kind === 'evac' ? '#8bcdd5' : '#e3c779', 'ring');
  for (const e of Object.values(r.entities)) {
    if (e.type === 'claim' && e.tx !== undefined && e.ty !== undefined) p(e.tx, e.ty, '#e4a46d');
    if (e.kind === 'cart' && discoveredCell(r, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) p(e.x / TILE, e.y / TILE, '#e8b36d');
    if (e.kind === 'vehicle' && discoveredCell(r, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) p(e.x / TILE, e.y / TILE, '#84c5c5');
  }
  const death = deathBagView(r);
  if (death.status === 'present') p(death.bag.x / TILE, death.bag.y / TILE, '#f3ede0', 'cross');
  for (const m of marks) { p(m.tx, m.ty, MARKS.find(k => k.kind === m.kind)!.color, 'diamond'); if (m.id === selected) { ctx.strokeStyle = '#f7e6b2'; ctx.strokeRect(m.tx - 4.5, m.ty - 4.5, 9, 9); } }
  if (teleportTarget) p(teleportTarget.x / TILE, teleportTarget.y / TILE, '#d9acff', 'cross');
  p(r.player.x / TILE, r.player.y / TILE, '#fff8e5', 'diamond');
}

export function ExpeditionMap({ api, onTeleportSelect, teleportTarget, qaSession = false }: {
  api: Api;
  onTeleportSelect?: (x: number, y: number) => void;
  teleportTarget?: { x: number; y: number } | null;
  qaSession?: boolean;
}) {
  const r = api.gs.run!; const w = getWorld(r.layoutId || 'shipping');
  const ref = useRef<HTMLCanvasElement>(null);
  const [marks, setMarks] = useState<FieldMark[]>(() => readFieldMarks(r, qaSession));
  const [kind, setKind] = useState<MarkKind>('return');
  const [mode, setMode] = useState<'inspect' | 'mark'>('inspect');
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ tx: number; ty: number } | null>(null);
  const [note, setNote] = useState<string>('Click an explored place to inspect it.');
  const intel = expeditionNotes(r);
  const [tab, setTab] = useState<'places' | 'marks' | 'intel'>('places');
  const death = deathBagView(r);
  const sites = w.places.filter(site => r.poiSeen.includes(site.id) && discoveredCell(r, site.tx, site.ty));
  const owned = Object.values(r.entities).filter(e => e.type === 'claim' && e.tx !== undefined && e.ty !== undefined);
  useEffect(() => { if (ref.current) renderChart(ref.current.getContext('2d')!, r, marks, selected, teleportTarget); });

  const save = (next: FieldMark[]) => {
    if (!storeFieldMarks(r, qaSession, next)) { setNote('Could not store notes in this browser. No game save was changed.'); return; }
    setMarks(next);
  };
  const add = (tx: number, ty: number) => {
    const outcome = addFieldMark(r, marks, tx, ty, kind, label);
    if (outcome.error) { setNote(outcome.error); return; }
    save(outcome.marks); setSelected(outcome.marks.at(-1)!.id); setTab('marks'); setMode('inspect'); setLabel(''); setNote('Field note saved for this run.');
  };
  const remove = (id: string) => { save(marks.filter(m => m.id !== id)); if (selected === id) setSelected(null); setNote('Field note removed.'); };
  const inspect = (tx: number, ty: number) => {
    if (!discoveredCell(r, tx, ty)) { setNote('Unexplored. This chart will not reveal terrain.'); setCursor(null); return; }
    setCursor({ tx, ty });
    const mark = marks.find(m => Math.hypot(m.tx - tx, m.ty - ty) <= 2);
    if (mark) { setSelected(mark.id); setTab('marks'); setNote(mark.label); }
    else { setSelected(null); setNote(`Explored tile ${tx}, ${ty}. You may leave a note here.`); }
  };
  const onChartClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { tx, ty } = mapXY(e, e.currentTarget);
    if (mode === 'mark') { add(tx, ty); return; }
    if (onTeleportSelect) { if (!discoveredCell(r, tx, ty)) { setNote('Choose explored, safe terrain.'); return; } onTeleportSelect(tx * TILE + 8, ty * TILE + 8); setNote('Core destination selected. Close map; hold and release E.'); return; }
    inspect(tx, ty);
  };
  const onChartKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Space', 'Delete'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); }
    const p = cursor || { tx: Math.floor(r.player.x / TILE), ty: Math.floor(r.player.y / TILE) };
    const delta: Record<string, [number, number]> = { ArrowUp: [0, -4], ArrowDown: [0, 4], ArrowLeft: [-4, 0], ArrowRight: [4, 0] };
    if (delta[e.code]) { const tx = Math.max(0, Math.min(199, p.tx + delta[e.code][0])); const ty = Math.max(0, Math.min(199, p.ty + delta[e.code][1])); setCursor({ tx, ty }); setNote(discoveredCell(r, tx, ty) ? `Explored tile ${tx}, ${ty}. Enter to ${mode === 'mark' ? 'mark' : 'inspect'}.` : 'Unexplored.'); }
    if (e.code === 'Enter' || e.code === 'Space') { if (mode === 'mark') add(p.tx, p.ty); else inspect(p.tx, p.ty); }
    if (e.code === 'Delete' && selected) remove(selected);
  };
  const zone = (w.zoneNames || ZONES)[w.zone[Math.floor(r.player.y / 16) * WW + Math.floor(r.player.x / 16)]];

  return <Panel title={<span className="map-heading">FIELD CHART <span>{zone} · run {runHours(r, api.now()).toFixed(1)}h</span></span>}
    className="field-map" style={{ left: 50, top: 13, width: 540, height: 334, boxSizing: 'border-box' }} onClose={() => api.open(null)}>
    <div className="field-map__body">
      <div className="chart-column">
        <div className="chart-frame">
          <canvas ref={ref} width={200} height={200} className="chart-canvas" tabIndex={0} role="img" aria-label="Explored island map. Arrows move the cursor; Enter inspects or marks."
            onClick={onChartClick} onKeyDown={onChartKey} onContextMenu={e => { e.preventDefault(); const { tx, ty } = mapXY(e, e.currentTarget); const m = marks.find(m => Math.hypot(m.tx - tx, m.ty - ty) <= 2); if (m) remove(m.id); }} />
          <div className="chart-compass">N<br />↑</div>
        </div>
        <div className="map-toolbar">
          <button className={`btn sm ${mode === 'mark' ? 'gold' : ''}`} onClick={() => setMode(m => m === 'mark' ? 'inspect' : 'mark')}>{mode === 'mark' ? 'Marking · click chart' : '+ Leave a mark'}</button>
          <button className="btn sm" title="Mark your observed current position; no navigation is created" onClick={() => add(Math.floor(r.player.x / TILE), Math.floor(r.player.y / TILE))}>Mark my position</button>
          <span className="map-key">{marks.length}/18</span>
        </div>
      </div>
      <div className="map-sidebar">
        <div className="map-tabs">
          {(['places', 'marks', 'intel'] as const).map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t === 'places' ? 'Seen' : t === 'marks' ? `Notes ${marks.length}` : `Intel ${intel.length}`}</button>)}
        </div>
        {mode === 'mark' && <div className="map-add">
          <div className="map-kinds">{MARKS.map(m => <button key={m.kind} className={kind === m.kind ? 'active' : ''} title={m.label} onClick={() => setKind(m.kind)} style={{ color: m.color }}>{m.sign}<span>{m.label}</span></button>)}</div>
          <input aria-label="Field note label" placeholder="optional name" maxLength={22} value={label} onChange={e => setLabel(e.target.value)} />
          <small>Click an explored tile, or use arrows + Enter on the chart.</small>
        </div>}
        <div className="map-list scroll">
          {tab === 'places' && <>
            {death.status === 'present' && <button className="map-row map-row--bag" onClick={() => inspect(Math.floor(death.bag.x / TILE), Math.floor(death.bag.y / TILE))}><b>✕ Your last death bag</b><span>{Math.floor(death.bag.x / TILE)}, {Math.floor(death.bag.y / TILE)} · {death.stacks.length} stacks now</span></button>}
            {death.status === 'missing' && <div className="map-note">Last recorded death bag is gone. No stock is promised.</div>}
            {owned.map(e => <button key={e.id} className="map-row" onClick={() => inspect(e.tx!, e.ty!)}><b>■ Your Cabinet</b><span>{e.tx}, {e.ty} · exists now</span></button>)}
            {sites.map(site => <button key={site.id} className="map-row" onClick={() => inspect(site.tx, site.ty)}><b>◇ {site.name}</b><span>Seen · {site.tx}, {site.ty}</span></button>)}
            {!sites.length && !owned.length && death.status !== 'present' && <div className="map-note">No discovered landmarks yet. The chart grows as you explore.</div>}
          </>}
          {tab === 'marks' && <>
            {marks.map(m => <div key={m.id} className={`map-row map-row--mark ${selected === m.id ? 'selected' : ''}`}><button onClick={() => { inspect(m.tx, m.ty); setTab('marks'); }}><b style={{ color: MARKS.find(k => k.kind === m.kind)!.color }}>{MARKS.find(k => k.kind === m.kind)!.sign} {m.label}</b><span>Last known · {m.tx}, {m.ty}</span></button><button className="map-remove" aria-label={`Remove ${m.label}`} onClick={() => remove(m.id)}>×</button></div>)}
            {!marks.length && <div className="map-note">Your marks live only in this run. Pick a symbol, then click explored ground.</div>}
          </>}
          {tab === 'intel' && <>
            {intel.map(n => <div className="map-intel" key={n.place}><b>{n.name} · observed</b>
              {n.gates.map((g, i) => <div className="map-gate" key={i}><Icon k={g.item} size={14} /><span>{g.requirement === 'power' ? 'Power access' : 'Keycard access'}<small>{g.have}/{g.need} carried · {g.carried ? 'in pack' : g.craft ? 'recipe known' : 'find it'}</small></span>
                {g.craft && !g.carried && <button className="btn sm" onClick={() => api.open({ kind: 'craft', recipe: g.craft!.recipe })}>Recipe</button>}</div>)}
              {n.blueprints.map(b => <div key={b.recipe} className="map-gate"><Icon k="blueprint" size={12} /><span>{b.name}<small>{b.state === 'seen' ? 'seen earlier · may be gone' : b.state === 'owned' ? 'in pack · not learned' : 'learned'}</small></span></div>)}
            </div>)}
            {!intel.length && <div className="map-note">Try a locked gate or inspect a cache to record its observed requirements. Unseen places stay unknown.</div>}
          </>}
        </div>
        <div className="map-selection" role="status"><span>{note}</span>{cursor && discoveredCell(r, cursor.tx, cursor.ty) && <button className="btn sm" onClick={() => add(cursor.tx, cursor.ty)}>Mark here</button>}</div>
      </div>
    </div>
  </Panel>;
}