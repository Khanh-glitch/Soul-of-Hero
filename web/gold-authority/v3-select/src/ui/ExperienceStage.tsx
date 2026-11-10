import { useEffect } from 'react';
import { ELDERS } from '../game/catalog';
import { VIEW_H, VIEW_W } from '../game/core';
import type { ExperienceEvent } from '../game/experience';
import { Icon } from './common';
import { Glyph } from './hud';

const EYEBROW: Record<ExperienceEvent['kind'], string> = {
  field: '',
  forge: 'WORKSHOP',
  research: 'KNOWLEDGE',
  relic: 'RARE DISCOVERY',
  boss: 'ELDER',
  world: '',
  warning: 'ATTENTION',
  ledger: 'CUSTODY',
  milestone: 'MILESTONE',
  ceremony: 'CHRONICLE',
  guidance: 'FIELDCRAFT',
  daily: 'DAILY PACT',
};

const ESSENCE_SIGIL: Record<string, string> = {
  fire: 'EMBER CORE',
  water: 'FROST CORE',
  nature: 'VERDANT CORE',
  spirit: 'ASTRAL CORE',
};

/**
 * 5-Level Event Presentation Stage.
 * Never intercepts gameplay controls; Level 1 uses EventFeed/Pickups, Level 2 uses
 * non-blocking Stamp, Level 3 uses workstation/item Capability plaque (+ world ring),
 * Level 4 uses Rare Discovery reveal, Level 5 uses bespoke pixel-art Ceremony.
 */
export function ExperienceStage({
  events,
  onDismiss,
  combatFocus = false,
  inline = false,
  camX = 0,
  camY = 0,
}: {
  events: ExperienceEvent[];
  onDismiss: (id: string) => void;
  combatFocus?: boolean;
  inline?: boolean;
  camX?: number;
  camY?: number;
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
  const eyebrow = active.eyebrow || EYEBROW[active.kind];

  // Combat crisis fallback for world-scale phase cuts (Ragnarok / Awakening)
  if (active.kind === 'world' && combatFocus) {
    return (
      <div className="xp-combat-alert" data-level={active.level} key={active.id} style={style} role="status" aria-live="assertive">
        <b>{active.title}</b>
        <span>{active.detail}</span>
      </div>
    );
  }

  // LEVEL 5 (World-scale phase events: Ragnarok, Day 14 Awakening)
  if (active.level === 5 && (active.kind === 'world' || (active.kind === 'boss' && !active.elderKey))) {
    return (
      <>
        {!combatFocus && <div className="xp-dim xp-dim--world" key={`dim-${active.id}`} style={style} />}
        <div className={`xp-stage ${inline ? 'xp-stage--inline' : ''}`} data-level="5" key={active.id} style={style} role="status" aria-live="polite">
          <div className="xp-world">
            <i className="xp-world__rule" />
            {eyebrow && <div className="xp-world__eyebrow">{eyebrow}</div>}
            <div className="xp-world__title">{active.title}</div>
            {active.detail && <div className="xp-world__detail">{active.detail}</div>}
            <i className="xp-world__rule xp-world__rule--b" />
          </div>
        </div>
      </>
    );
  }

  // LEVEL 5 (Journey-Defining Moments: Elder Vanquished, Six Stones, Evacuation)
  if (active.level === 5) {
    const elder = active.elderKey ? ELDERS[active.elderKey] : null;
    return (
      <>
        {!combatFocus && <div className="xp-dim" key={`dim-${active.id}`} style={style} />}
        <div className={`xp-stage ${inline ? 'xp-stage--inline' : 'xp-stage--mid'}`} data-level="5" key={active.id} style={style} role="status" aria-live="polite">
          <div className="xp-ceremony xp-ceremony--epic">
            <i className="xp-ceremony__ray xp-ceremony__ray--l" />
            <i className="xp-ceremony__ray xp-ceremony__ray--r" />
            <PixelCrownRing color={elder?.color || active.accent || '#f4d089'} />
            <div className="xp-ceremony__core xp-ceremony__core--epic">
              {active.icon ? <Icon k={active.icon} size={26} /> : <Glyph k="spark" c={active.accent || '#f4d089'} s={14} />}
            </div>
            <div className="xp-ceremony__eyebrow">
              {active.source === 'staged' ? 'STAGED PREVIEW · ' : ''}
              {eyebrow || 'JOURNEY LEGEND'}
            </div>
            <div className="xp-ceremony__title">{active.title}</div>
            {active.detail && <div className="xp-ceremony__detail">{active.detail}</div>}
            {active.meaning && <div className="xp-ceremony__meaning">{active.meaning}</div>}
            <button className="xp-plaque__x" aria-label="Dismiss" onClick={() => onDismiss(active.id)}>×</button>
          </div>
        </div>
      </>
    );
  }

  // LEVEL 2 (Guidance / Fieldcraft completion / Daily Objective completion — slim, non-blocking stamp)
  if (active.level === 2) {
    return (
      <div className={`xp-stage ${inline ? 'xp-stage--inline' : ''}`} data-level="2" key={active.id} style={style} role="status" aria-live="polite">
        <div className="xp-stamp" data-testid="xp-stamp">
          <div className="xp-stamp__badge">
            {active.icon ? <Icon k={active.icon} size={15} /> : <Glyph k="spark" c={active.accent || '#93d8b4'} s={9} />}
          </div>
          <div className="xp-stamp__copy">
            <div className="xp-stamp__eyebrow">
              {eyebrow}
              {queued > 0 && <span className="xp-plaque__queue">+{queued}</span>}
            </div>
            <div className="xp-stamp__title">{active.title}</div>
            {active.detail && <div className="xp-stamp__detail">{active.detail}</div>}
          </div>
          <span className="xp-stamp__check" aria-hidden="true">✓</span>
          <button className="xp-plaque__x" aria-label="Dismiss" onClick={() => onDismiss(active.id)}>×</button>
        </div>
      </div>
    );
  }

  // LEVEL 3 (Capability / Upgrade / Recipe Learned / Daily Milestone — workstation/item-connected, NO dim)
  // LEVEL 4 (Rare Discovery — Creator Core / Vault / Landmark — elemental sigil aura)
  const isDiscovery = active.level === 4;
  const chips = active.icons && active.icons.length > 1 ? active.icons : null;
  const worldPulseVisible =
    active.level === 3 &&
    active.worldX !== undefined &&
    active.worldY !== undefined &&
    active.worldX - camX >= 12 &&
    active.worldX - camX <= VIEW_W - 12 &&
    active.worldY - camY >= 12 &&
    active.worldY - camY <= VIEW_H - 12;

  return (
    <>
      {worldPulseVisible && (
        <div
          className="xp-world-ring"
          style={{
            left: Math.round(active.worldX! - camX),
            top: Math.round(active.worldY! - camY),
            '--accent': active.accent || '#e6b45d',
          } as React.CSSProperties}
          aria-hidden="true"
        />
      )}
      <div className={`xp-stage ${inline ? 'xp-stage--inline' : ''}`} data-level={active.level} key={active.id} style={style} role="status" aria-live="polite">
        <div className={`xp-plaque xp-plaque--${active.kind} ${isDiscovery ? 'xp-plaque--discovery' : 'xp-plaque--capability'}`}>
          <i className="xp-plaque__wing xp-plaque__wing--l" />
          {active.icon && (
            <div className={`xp-plaque__sigil ${isDiscovery ? 'xp-plaque__sigil--oct' : ''}`}>
              <i className="xp-plaque__ring" />
              <Icon k={active.icon} size={isDiscovery ? 26 : 20} />
            </div>
          )}
          <div className="xp-plaque__copy">
            {(eyebrow || active.source === 'staged') && (
              <div className="xp-plaque__eyebrow">
                {active.source === 'staged' ? 'STAGED PREVIEW · ' : ''}
                {active.essence ? `${ESSENCE_SIGIL[active.essence] || eyebrow}` : eyebrow}
                {queued > 0 && <span className="xp-plaque__queue">+{queued}</span>}
              </div>
            )}
            <div className="xp-plaque__title">{active.title}</div>
            {chips ? (
              <div className="xp-plaque__chips">
                {chips.map(c => (
                  <span key={c.key} className="xp-chip">
                    <Icon k={c.key} size={12} />
                    {c.qty ? `×${c.qty}` : ''}
                  </span>
                ))}
              </div>
            ) : active.detail ? (
              <div className="xp-plaque__detail">{active.detail}</div>
            ) : null}
            {active.meaning && !chips && <div className="xp-plaque__meaning">{active.meaning}</div>}
            {active.attached && active.attached.length > 0 && (
              <div className="xp-plaque__attached">
                {active.attached.map((a, idx) => (
                  <span key={idx} className={`xp-attach xp-attach--${a.tone}`}>
                    + {a.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <i className="xp-plaque__wing xp-plaque__wing--r" />
          <button className="xp-plaque__x" aria-label="Dismiss" onClick={() => onDismiss(active.id)}>×</button>
        </div>
      </div>
    </>
  );
}

/** Pixel-art geometric constellation crest for Level 5 ceremonies. */
function PixelCrownRing({ color }: { color: string }) {
  const pts = [0, 60, 120, 180, 240, 300];
  return (
    <svg className="xp-crown-ring" viewBox="0 0 64 64" shapeRendering="crispEdges" aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.65" />
      <rect x="10" y="31" width="44" height="2" fill={color} opacity="0.25" />
      <rect x="31" y="10" width="2" height="44" fill={color} opacity="0.25" />
      {pts.map(a => {
        const rad = (a * Math.PI) / 180;
        const x = Math.round(32 + Math.cos(rad) * 26) - 2;
        const y = Math.round(32 + Math.sin(rad) * 26) - 2;
        return <rect key={a} x={x} y={y} width="4" height="4" fill={color} />;
      })}
    </svg>
  );
}

export interface FeedLine {
  id: string;
  icon?: string;
  title: string;
  detail: string;
  accent: string;
  warn: boolean;
  count: number;
  at: number;
}

/** LEVEL 1 FEED tier: small icon lines at the lower-left edge. Duplicates merge into ×N instead of stacking. */
export function EventFeed({ lines, bottom }: { lines: FeedLine[]; bottom: number }) {
  if (!lines.length) return null;
  return (
    <div className="feed" style={{ bottom }} aria-live="polite" data-testid="event-feed">
      {lines.map(l => (
        <div key={l.id} className={`feed__line ${l.warn ? 'warn' : ''}`} style={{ '--accent': l.accent } as React.CSSProperties}>
          {l.icon ? <Icon k={l.icon} size={11} /> : <i className="feed__dot" />}
          <b>{l.title}</b>
          {l.detail && <span>{l.detail}</span>}
          {l.count > 1 && <em>×{l.count}</em>}
        </div>
      ))}
    </div>
  );
}

export interface FieldPickup {
  id: string;
  key: string;
  qty: number;
  x: number;
  y: number;
}

export function FieldPickupLayer({ items, camX, camY }: { items: FieldPickup[]; camX: number; camY: number }) {
  if (!items.length) return null;
  return (
    <div className="pickup-layer" aria-hidden="true">
      {items.map(it => (
        <div className="pickup" key={it.id} style={{ left: Math.round(it.x - camX), top: Math.round(it.y - camY) - 22 }}>
          <Icon k={it.key} size={12} />
          <b>+{it.qty}</b>
        </div>
      ))}
    </div>
  );
}
