import { useEffect, useRef, useState } from 'react';
import { VIEW_W, VIEW_H, type RunState } from '../game/core';
import { SOURCES } from '../game/catalog';
import { sourceAt } from '../game/engine';
import { DAILY_MILESTONES, type AnchorHint, type JourneyEvent, type JourneyStore, type TrackRef, type TrackView } from '../game/journey';
import type { Cinematic, Flare, Issue } from '../game/attention';
import { Icon } from './common';

// ---------------------------------------------------------------------------
// WAYMARK — the smart journey tracker.
//  glyph   : combat / danger — a single socket with a progress ring, nothing else
//  compact : exploring — icon, short title, notched progress (one line)
//  open    : relevant context (crafting while tracking a craft step, at the
//            station, in build mode for a build step) or when the player peeks
//            [T]/click — adds "how" and "why"
// Every L2 completion (Fieldcraft step, daily waypoint) and the daily milestone
// play IN this element, so journey feedback lives in one predictable place.
// ---------------------------------------------------------------------------
export type WaymarkMode = 'glyph' | 'compact' | 'open';
export type QuickGoal = { ref: Exclude<TrackRef, null>; title: string; detail: string; icon: string; done?: boolean };

export function Waymark({ view, mode, store, stamp, onToggle, onUntrack, onOpenJournal, onQuickTrack, onAction, quickGoals = [], blocked }: {
  view: TrackView | null; mode: WaymarkMode; store: JourneyStore; stamp: JourneyEvent | null; blocked?: string | null;
  onToggle: () => void; onUntrack: () => void; onOpenJournal: () => void; onQuickTrack: (ref: TrackRef | 'auto') => void; onAction: () => void; quickGoals?: QuickGoal[];
}) {
  const [bump, setBump] = useState(0);
  const [switching, setSwitching] = useState(false);
  const lastProg = useRef<string>('');
  useEffect(() => { const k = view ? `${view.ref.type}:${view.ref.id}:${view.title}:${view.progress}` : ''; if (lastProg.current && k !== lastProg.current && view && view.progress > 0) setBump(b => b + 1); lastProg.current = k; }, [view?.progress, view?.title, view?.ref.id]);
  const d = store.daily; const pts = d?.points ?? 0;
  if (!view && !stamp) return d && pts > 0 ? <div className="wm wm--dialonly"><DayDial points={pts} reached={d.milestones} onClick={onOpenJournal} /></div> : null;

  if (stamp) {
    const ms = stamp.kind === 'milestone';
    return <div className={`wm wm--stamp ${ms ? 'wm--milestone' : ''}`} key={stamp.id} role="status" aria-live="polite">
      <div className="wm__socket wm__socket--stamp"><Icon k={stamp.icon || 'gear'} size={14} /><i className="wm__seal" /></div>
      <div className="wm__body">
        <div className="wm__eyebrow">{ms ? 'DAILY MILESTONE' : stamp.kind === 'daily' ? 'WAYPOINT COMPLETE' : 'FIELDCRAFT LEARNED'}{stamp.away && <em> · while away</em>}</div>
        <div className="wm__title">{stamp.title}</div>
        <div className="wm__how">{stamp.detail}</div>
      </div>
      {d && (pts > 0 || ms) && <DayDial points={pts} reached={d.milestones} flash={ms} />}
    </div>;
  }
  const v = view!;
  const frac = Math.min(1, v.progress / Math.max(1, v.target));
  if (mode === 'glyph') return <div className="wm wm--glyph" title={`${v.title} ${v.progress}/${v.target}`} onClick={onToggle}>
    <div className="wm__socket"><Ring frac={frac} /><Icon k={v.icon} size={12} /></div>
  </div>;
  return <div className={`wm wm--${mode} ${v.suggested ? 'wm--suggested' : ''} ${v.done ? 'wm--done' : ''}`} onMouseDown={e => e.stopPropagation()}>
    <button className="wm__socket" onClick={onToggle} title="Peek [T]" key={`b${bump}`} data-bump={bump > 0 || undefined}>
      <Ring frac={frac} /><Icon k={v.icon} size={14} />
    </button>
    <div className="wm__body" onClick={onToggle}>
      <div className="wm__eyebrow">{v.suggested ? 'SUGGESTED · ' : ''}{v.group}</div>
      <div className="wm__title">{v.title}{v.target > 1 && !v.done && <span className="wm__count">{v.progress}<i>/</i>{v.target}</span>}</div>
      {v.target > 1 && <div className="wm__notches">{Array.from({ length: Math.min(v.target, 14) }, (_, i) => <i key={i} className={i < Math.round(frac * Math.min(v.target, 14)) ? 'on' : ''} />)}</div>}
      {mode === 'open' && <>
        <div className="wm__how">{blocked ? <b className="wm__blocked">{blocked}</b> : v.how}</div>
        <div className="wm__why">{v.why}</div>
        {!v.done && <button className="wm__action" onClick={e => { e.stopPropagation(); onAction(); }}>↗ Open relevant action</button>}
      </>}
      <div className="wm__pips">{v.pips.map((p, i) => <i key={i} className={p.done ? 'done' : p.current ? 'cur' : ''} />)}</div>
    </div>
    <div className="wm__tools">
      <button onClick={() => setSwitching(s => !s)} title="Switch goal without leaving gameplay" aria-label="Switch tracked goal" aria-expanded={switching}>⌄</button>
      <button onClick={onOpenJournal} title="Journey ledger [J]" aria-label="Open journey">❖</button>
      <button onClick={onUntrack} title={v.suggested ? 'Not now' : 'Stop tracking'} aria-label="Stop tracking">×</button>
    </div>
    {switching && <div className="wm__switch" role="group" aria-label="Track a different objective" onMouseDown={e => e.stopPropagation()}>
      <div className="wm__switch-title">YOUR JOURNEY <button onClick={() => { onQuickTrack('auto'); setSwitching(false); }}>Auto</button></div>
      {quickGoals.map(o => <button key={`${o.ref.type}:${o.ref.id}`} className={`wm__switch-row ${o.ref.type === v.ref.type && o.ref.id === v.ref.id ? 'on' : ''}`} onClick={() => { onQuickTrack(o.ref); setSwitching(false); }}>
        <Icon k={o.icon} size={11}/><span><b>{o.title}</b><small>{o.detail}</small></span>{o.done && <i>✓</i>}
      </button>)}
      <button className="wm__switch-journal" onClick={onOpenJournal}>Open Expedition Ledger [J]</button>
    </div>}
    {d && mode === 'open' && <DayDial points={pts} reached={d.milestones} onClick={onOpenJournal} />}
  </div>;
}

function Ring({ frac }: { frac: number }) {
  const c = 2 * Math.PI * 9;
  return <svg className="wm__ring" viewBox="0 0 22 22" aria-hidden><circle cx="11" cy="11" r="9" className="bg" /><circle cx="11" cy="11" r="9" className="fg" strokeDasharray={`${c * frac} ${c}`} /></svg>;
}

/** Sun-dial of today's waypoint points; three notches are the milestones. */
export function DayDial({ points, reached, flash, onClick, size = 26 }: { points: number; reached: readonly string[]; flash?: boolean; onClick?: () => void; size?: number }) {
  const max = DAILY_MILESTONES.at(-1)!.at; const frac = Math.min(1, points / max);
  const c = 2 * Math.PI * 10;
  return <button className={`dial ${flash ? 'dial--flash' : ''}`} onClick={onClick} title={`Today: ${points} pts`} style={{ width: size, height: size }}>
    <svg viewBox="0 0 26 26" aria-hidden>
      <circle cx="13" cy="13" r="10" className="dial__bg" />
      <circle cx="13" cy="13" r="10" className="dial__fg" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 13 13)" />
      {DAILY_MILESTONES.map(m => { const a = (m.at / max) * Math.PI * 2 - Math.PI / 2; return <rect key={m.id} x={13 + Math.cos(a) * 10 - 1.5} y={13 + Math.sin(a) * 10 - 1.5} width="3" height="3" className={reached.includes(m.id) ? 'dial__n on' : 'dial__n'} />; })}
    </svg>
    <b>{points}</b>
  </button>;
}

// ---------------------------------------------------------------------------
// WORLD BEACON — only for targets the player legitimately knows: their own
// structures, or a harvestable source already in view. Never reveals the map.
// ---------------------------------------------------------------------------
export function findAnchor(r: RunState, a: AnchorHint | undefined, now: number): { x: number; y: number; label: string } | null {
  if (!a) return null;
  const P = r.player;
  if (a.kind === 'struct') {
    let best: { x: number; y: number; label: string } | null = null; let bd = 1e9;
    for (const e of Object.values(r.entities)) if (e.kind === 'struct' && a.types.includes(e.type || '') && (!e.owner || e.owner === 'player')) { const dd = Math.hypot(e.x - P.x, e.y - P.y); if (dd < bd) { bd = dd; best = { x: e.x, y: e.y, label: '' }; } }
    return best;
  }
  if (a.kind === 'source') {
    const ptx = Math.floor(P.x / 16), pty = Math.floor(P.y / 16); let best: { x: number; y: number; label: string } | null = null; let bd = 1e9;
    for (let dy = -10; dy <= 10; dy++) for (let dx = -18; dx <= 18; dx++) {
      const s: any = sourceAt(r, ptx + dx, pty + dy, now); if (!s || s.stock <= 0) continue;
      const mat = SOURCES[s.key]?.mat; if (mat !== a.mat && !(a.mat === 'stone' && mat === 'ore')) continue;
      const dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = { x: (ptx + dx) * 16 + 8, y: (pty + dy) * 16 + 8, label: SOURCES[s.key].name }; }
    }
    return best;
  }
  return null;
}

export function WorldBeacon({ target, camX, camY, icon }: { target: { x: number; y: number; label: string } | null; camX: number; camY: number; icon: string }) {
  if (!target) return null;
  const sx = target.x - camX, sy = target.y - camY;
  const on = sx > 8 && sx < VIEW_W - 8 && sy > 20 && sy < VIEW_H - 40;
  if (on) return <div className="beacon" style={{ left: Math.round(sx), top: Math.round(sy) - 20 }} aria-hidden><i className="beacon__pin"><Icon k={icon} size={8} /></i>{target.label && <span>{target.label}</span>}</div>;
  const cx = VIEW_W / 2, cy = VIEW_H / 2; const ang = Math.atan2(sy - cy, sx - cx);
  const ex = Math.max(14, Math.min(VIEW_W - 14, cx + Math.cos(ang) * 400)), ey = Math.max(30, Math.min(VIEW_H - 46, cy + Math.sin(ang) * 400));
  const dist = Math.round(Math.hypot(sx - cx, sy - cy) / 16);
  return <div className="beacon beacon--edge" style={{ left: Math.round(ex), top: Math.round(ey) }} aria-hidden>
    <i className="beacon__chev" style={{ transform: `rotate(${ang}rad)` }} /><span>{dist}m</span>
  </div>;
}

// ---------------------------------------------------------------------------
// L3 — capability flares: rise from the real station / spot that changed.
// ---------------------------------------------------------------------------
export function FlareLayer({ flares, camX, camY }: { flares: Flare[]; camX: number; camY: number }) {
  if (!flares.length) return null;
  return <div className="flare-layer" aria-live="polite">{flares.map((f, i) => {
    const x = Math.max(70, Math.min(VIEW_W - 70, Math.round(f.x - camX))), y = Math.max(54, Math.min(VIEW_H - 60, Math.round(f.y - camY)));
    return <div key={f.id} className="flare" style={{ left: x, top: y - i * 30, '--accent': f.accent } as React.CSSProperties}>
      <i className="flare__burst" /><i className="flare__beam" />
      <div className="flare__plate"><span className="flare__icon"><Icon k={f.icon || 'gear'} size={14} /></span><span><b>{f.title}</b>{f.detail && <em>{f.detail}</em>}</span></div>
    </div>;
  })}</div>;
}

// ---------------------------------------------------------------------------
// L5 — journey-defining cinematic: letterbox, world hush, staged title.
// In combat it collapses to a strip (never hidden, never blocking).
// ---------------------------------------------------------------------------
export function CinematicLayer({ c, compact, onDone, reduceMotion }: { c: Cinematic | null; compact: boolean; onDone: () => void; reduceMotion: boolean }) {
  useEffect(() => { if (!c) return; const t = window.setTimeout(onDone, compact ? 3600 : 6400); return () => window.clearTimeout(t); }, [c?.id, compact]);
  if (!c) return null;
  const style = { '--accent': c.accent } as React.CSSProperties;
  if (compact) return <div className="cine-strip" style={style} role="status" aria-live="assertive"><b>{c.title}</b><span>{c.eyebrow}</span></div>;
  return <div className={`cine cine--${c.tone} ${reduceMotion ? 'cine--calm' : ''}`} style={style} role="status" aria-live="assertive" onClick={onDone}>
    <i className="cine__bar cine__bar--t" /><i className="cine__bar cine__bar--b" />
    <i className="cine__hush" />
    {!reduceMotion && <div className="cine__motes">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.31}s` }} />)}</div>}
    <div className="cine__stage">
      {c.icon && <div className="cine__relic"><i className="cine__rays" /><Icon k={c.icon} size={28} /></div>}
      <div className="cine__eyebrow">{c.eyebrow}</div>
      <div className="cine__title">{c.title.split('').map((ch, i) => <span key={i} style={{ animationDelay: `${0.9 + i * 0.045}s` }}>{ch === ' ' ? '\u00a0' : ch}</span>)}</div>
      <div className="cine__rule" />
      {c.detail && <div className="cine__detail">{c.detail}</div>}
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
// STANDING ISSUES — persist until resolved; compass + distance; snoozable.
// ---------------------------------------------------------------------------
export function IssueRail({ issues, px, py, compact, onSnooze }: { issues: Issue[]; px: number; py: number; compact: boolean; onSnooze: (i: Issue) => void }) {
  if (!issues.length) return null;
  const shown = issues.slice(0, compact ? 3 : 2);
  return <div className="issues" role="status" aria-live="polite">
    {shown.map(i => {
      const ang = Math.atan2(i.y - py, i.x - px); const dist = Math.round(Math.hypot(i.x - px, i.y - py) / 16);
      return <div key={i.id} className={`issue issue--s${i.severity} ${compact ? 'issue--compact' : ''}`} title={`${i.label} · ${i.fix}`}>
        <Icon k={i.icon} size={10} />
        {!compact && <><b>{i.label}</b><span>{i.fix}</span></>}
        <i className="issue__dir" style={{ transform: `rotate(${ang}rad)` }} /><em>{dist}m</em>
        {!compact && <button onClick={() => onSnooze(i)} aria-label="Snooze until it changes" title="Hide until it changes">–</button>}
      </div>;
    })}
    {issues.length > shown.length && <div className="issue issue--more">+{issues.length - shown.length}</div>}
  </div>;
}
