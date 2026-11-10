import { useEffect } from 'react';
import type { ExperienceEvent } from '../game/experience';
import { Icon } from './common';

const EYEBROW: Record<ExperienceEvent['kind'], string> = {
  field: '', forge: 'WORKSHOP', research: 'KNOWLEDGE', relic: 'RARE FIND', boss: 'ELDER',
  world: '', warning: 'ATTENTION', ledger: 'CUSTODY', milestone: 'MILESTONE', ceremony: 'UPGRADE',
};

/** Centre theatre for STAGE and CEREMONY tiers only. One at a time, never blocks input or overlaps Boss HUD. */
export function ExperienceStage({
  events,
  onDismiss,
  combatFocus = false,
  inline = false,
}: {
  events: ExperienceEvent[];
  onDismiss: (id: string) => void;
  combatFocus?: boolean;
  inline?: boolean;
}) {
  const active = events[0];
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => onDismiss(active.id), active.duration);
    return () => window.clearTimeout(t);
  }, [active?.id, active?.duration, onDismiss]);
  if (!active) return null;
  const queued = events.length - 1;
  const style = { '--accent': active.accent || '#e6b45d', '--life': `${active.duration}ms` } as React.CSSProperties;

  if (active.kind === 'world' && combatFocus) return <div className="xp-combat-alert" key={active.id} style={style} role="status" aria-live="assertive">
    <b>{active.title}</b><span>{active.detail}</span>
  </div>;

  if (active.kind === 'world') return <div className={`xp-stage ${inline ? 'xp-stage--inline' : ''}`} key={active.id} style={style} role="status" aria-live="polite">
    <div className="xp-world"><i className="xp-world__rule" /><div className="xp-world__title">{active.title}</div>{active.detail && <div className="xp-world__detail">{active.detail}</div>}<i className="xp-world__rule xp-world__rule--b" /></div>
  </div>;

  if (active.tier === 'ceremony' && !combatFocus) return <>
    <div className="xp-dim" key={`dim-${active.id}`} style={style} />
    <div className={`xp-stage ${inline ? 'xp-stage--inline' : 'xp-stage--mid'}`} key={active.id} style={style} role="status" aria-live="polite">
      <div className="xp-ceremony">
        <svg className="xp-gear xp-gear--big" viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden><Gear /></svg>
        <svg className="xp-gear xp-gear--small" viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden><Gear /></svg>
        <div className="xp-ceremony__core">{active.icon && <Icon k={active.icon} size={22} />}</div>
        <div className="xp-ceremony__eyebrow">{active.source === 'staged' ? 'STAGED PREVIEW' : EYEBROW.ceremony}</div>
        <div className="xp-ceremony__title">{active.title}</div>
        {active.detail && <div className="xp-ceremony__detail">{active.detail}</div>}
      </div>
    </div>
  </>;

  const hero = active.kind === 'boss' || active.kind === 'relic' || active.kind === 'milestone';
  const chips = active.icons && active.icons.length > 1 ? active.icons : null;
  return <div className={`xp-stage ${inline ? 'xp-stage--inline' : ''}`} key={active.id} style={style} role="status" aria-live="polite">
    <div className={`xp-plaque xp-plaque--${active.kind} ${hero ? 'xp-plaque--hero' : ''}`}>
      <i className="xp-plaque__wing xp-plaque__wing--l" />
      {active.icon && <div className="xp-plaque__sigil"><i className="xp-plaque__ring" /><Icon k={active.icon} size={hero ? 28 : 20} /></div>}
      <div className="xp-plaque__copy">
        {(EYEBROW[active.kind] || active.source === 'staged') && (
          <div className="xp-plaque__eyebrow">
            {active.source === 'staged' ? 'STAGED PREVIEW' : EYEBROW[active.kind]}
            {queued > 0 && <span className="xp-plaque__queue">+{queued}</span>}
          </div>
        )}
        <div className="xp-plaque__title">{active.title}</div>
        {chips ? <div className="xp-plaque__chips">{chips.map(c => <span key={c.key} className="xp-chip"><Icon k={c.key} size={12} />{c.qty ? `×${c.qty}` : ''}</span>)}</div>
          : active.detail ? <div className="xp-plaque__detail">{active.detail}</div> : null}
      </div>
      <i className="xp-plaque__wing xp-plaque__wing--r" />
      <button className="xp-plaque__x" aria-label="Dismiss" onClick={() => onDismiss(active.id)}>×</button>
    </div>
  </div>;
}

/** 8-tooth pixel gear for the upgrade ceremony. */
function Gear() {
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45);
  return <g fill="currentColor">
    {teeth.map(a => <rect key={a} x="14" y="1" width="4" height="6" transform={`rotate(${a} 16 16)`} />)}
    <circle cx="16" cy="16" r="10" />
    <circle cx="16" cy="16" r="4" fill="#05070a" />
  </g>;
}

export interface FeedLine { id: string; icon?: string; title: string; detail: string; accent: string; warn: boolean; count: number; at: number }

/** FEED tier: small icon lines at the lower-left edge. Duplicates merge into ×N instead of stacking. */
export function EventFeed({ lines, bottom }: { lines: FeedLine[]; bottom: number }) {
  if (!lines.length) return null;
  return <div className="feed" style={{ bottom }} aria-live="polite">
    {lines.map(l => <div key={l.id} className={`feed__line ${l.warn ? 'warn' : ''}`} style={{ '--accent': l.accent } as React.CSSProperties}>
      {l.icon ? <Icon k={l.icon} size={11} /> : <i className="feed__dot" />}
      <b>{l.title}</b>{l.detail && <span>{l.detail}</span>}{l.count > 1 && <em>×{l.count}</em>}
    </div>)}
  </div>;
}

export interface FieldPickup { id: string; key: string; qty: number; x: number; y: number }
export function FieldPickupLayer({ items, camX, camY }: { items: FieldPickup[]; camX: number; camY: number }) {
  if (!items.length) return null;
  return <div className="pickup-layer" aria-hidden="true">
    {items.map(it => <div className="pickup" key={it.id} style={{ left: Math.round(it.x - camX), top: Math.round(it.y - camY) - 22 }}><Icon k={it.key} size={12} /><b>+{it.qty}</b></div>)}
  </div>;
}
