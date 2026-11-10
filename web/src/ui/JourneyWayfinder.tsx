import { useState } from 'react';
import { VIEW_H, VIEW_W } from '../game/core';
import type { WayfinderView } from '../game/gold-wayfinder-view';
import { Icon } from './common';
import { Glyph } from './hud';

const CAT_COLOR: Record<WayfinderView['category'], string> = {
  survival: 'var(--food)',
  craft: 'var(--brassLit)',
  shelter: 'var(--good)',
  combat: 'var(--info)',
  expedition: '#d99bff',
};

/**
 * Smart Context-Aware Objective Tracker docked in the right HUD rail.
 * Adapts automatically across 4 context modes:
 *   - Exploration (compact pill, unobstructed view)
 *   - Informative (auto-expanded near stations / build mode, or toggled open)
 *   - Combat stealth (collapses to minimal badge so combat & safety warnings rule)
 *   - Complete flash (in-place celebration morph before advancing)
 */
export function JourneyWayfinder({
  view,
  combatStealth,
  contextForceExpand,
  onSelectTarget,
  onOpenAction,
  onOpenCodex,
}: {
  view: WayfinderView | null;
  combatStealth: boolean;
  contextForceExpand: boolean;
  onSelectTarget: (id: string) => void;
  onOpenAction: (action: NonNullable<WayfinderView['action']>) => void;
  onOpenCodex: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (!view) return null;

  // Compact tucked state when player intentionally hides the tracker
  if (view.hidden) {
    return (
      <button
        type="button"
        className="plate wayfinder-tucked"
        data-testid="wayfinder-tucked"
        onClick={() => onSelectTarget('auto')}
        title="Resume Smart Wayfinder tracking"
      >
        <Glyph k="eye" c="var(--brassLit)" s={7} />
        <span>Track Goal</span>
      </button>
    );
  }

  const accent = CAT_COLOR[view.category] || 'var(--brassLit)';

  // Combat / Danger Stealth Mode — never obstructs combat or safety warnings
  if (combatStealth) {
    return (
      <div
        className="plate wayfinder wayfinder--stealth"
        data-testid="journey-wayfinder"
        data-mode="stealth"
        style={{ borderColor: accent }}
        title={`${view.title} (${view.progressText})`}
      >
        <Icon k={view.icon} size={11} />
        <span className="wayfinder__stealth-title">{view.title}</span>
        <b style={{ color: accent }}>{view.progressText}</b>
      </div>
    );
  }

  const isExpanded = expanded || contextForceExpand || !!view.blocker;

  return (
    <div
      className={`plate wayfinder fadein ${isExpanded ? 'wayfinder--expanded' : 'wayfinder--compact'} ${view.completedJustNow ? 'wayfinder--done' : ''}`}
      data-testid="journey-wayfinder"
      data-mode={isExpanded ? 'expanded' : 'compact'}
      data-target={view.trackedId}
      style={{ '--wf-accent': view.completedJustNow ? 'var(--good)' : accent } as React.CSSProperties}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Top interactive strip: category dot + label + fraction + expand/switch/hide */}
      <div className="wayfinder__head">
        <span className="lamp round" style={{ color: view.completedJustNow ? 'var(--good)' : accent }} />
        <span className="wayfinder__kind" style={{ color: view.completedJustNow ? 'var(--good)' : accent }}>
          {view.completedJustNow ? '✓ COMPLETE' : view.kindLabel}
        </span>
        <span className="wayfinder__frac">{view.progressText}</span>
        <button
          type="button"
          className="wayfinder__iconbtn"
          title={switching ? 'Close goal switcher' : 'Switch tracked goal'}
          aria-label="Switch tracked objective"
          onClick={() => setSwitching(s => !s)}
        >
          ▾
        </button>
        <button
          type="button"
          className="wayfinder__iconbtn"
          title={expanded ? 'Compact tracker' : 'Expand details'}
          aria-label={expanded ? 'Compact tracker' : 'Expand tracker details'}
          onClick={() => setExpanded(e => !e)}
        >
          {isExpanded ? '–' : '+'}
        </button>
        <button
          type="button"
          className="wayfinder__iconbtn"
          title="Hide tracker (reopen anytime)"
          aria-label="Dismiss tracker"
          onClick={() => { setSwitching(false); onSelectTarget('none'); }}
        >
          ×
        </button>
      </div>

      {/* Main title + icon + bearing */}
      <div className="wayfinder__main" onClick={() => setExpanded(e => !e)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(v => !v); }}>
        <div className="wayfinder__ico">
          <Icon k={view.icon} size={14} />
        </div>
        <div className="wayfinder__titles">
          <div className="wayfinder__title">{view.title}</div>
          {view.worldHint && (
            <div className="wayfinder__bearing">
              ◈ {view.worldHint.bearing} · {view.worldHint.label}
            </div>
          )}
          {!view.worldHint && !isExpanded && (
            <div className="wayfinder__sub">{view.summary}</div>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="wayfinder__track">
        <i style={{ width: `${view.completedJustNow ? 100 : view.pct}%`, background: view.completedJustNow ? 'var(--good)' : accent }} />
      </div>

      {/* Informative Disclosure: exact blocker + legitimate next step + 1-tap action */}
      {isExpanded && (
        <div className="wayfinder__detail">
          {view.blocker ? (
            <div className="wayfinder__blocker" role="status">
              <b>Blocked:</b> {view.blocker}
            </div>
          ) : (
            <div className="wayfinder__next">{view.nextStep}</div>
          )}
          <div className="wayfinder__actions">
            {view.action && (
              <button
                type="button"
                className="btn sm gold"
                onClick={() => onOpenAction(view.action!)}
              >
                {view.action.label}
              </button>
            )}
            <button type="button" className="btn sm ghost" onClick={onOpenCodex}>
              Skills [Tab]
            </button>
          </div>
        </div>
      )}

      {/* Inline Quick Goal Switcher — switch/pin/auto without leaving gameplay */}
      {switching && (
        <div className="wayfinder__switch" data-testid="wayfinder-switcher">
          <div className="wayfinder__switch-h">
            <span>Track Objective</span>
            <button type="button" className="btn sm ghost" onClick={() => { onSelectTarget('auto'); setSwitching(false); }}>
              Auto
            </button>
          </div>
          {view.options.slice(0, 6).map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`wayfinder__opt ${opt.id === view.trackedId ? 'on' : ''}`}
              onClick={() => { onSelectTarget(opt.id); setSwitching(false); }}
            >
              <Icon k={opt.icon} size={11} />
              <span className="wayfinder__opt-t">{opt.title}</span>
              <small style={{ color: CAT_COLOR[opt.category] }}>{opt.progressText}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Subtle world-anchored pixel reticle over a legitimately known, on-screen target
 * (player's own station, death bag, discovered POI, or explored visible resource).
 * Suppressed during combat and overlays.
 */
export function WorldWayfinderMarker({
  hint,
  camX,
  camY,
  hidden,
  promptX,
  promptY,
}: {
  hint: WayfinderView['worldHint'];
  camX: number;
  camY: number;
  hidden: boolean;
  promptX?: number;
  promptY?: number;
}) {
  if (hidden || !hint || !hint.onScreen) return null;
  if (promptX !== undefined && promptY !== undefined && Math.hypot(hint.x - promptX, hint.y - promptY) < 42) return null;
  const sx = Math.round(hint.x - camX);
  const sy = Math.round(hint.y - camY);
  if (sx < 14 || sx > VIEW_W - 14 || sy < 16 || sy > VIEW_H - 22) return null;
  return (
    <div
      className="world-wayfinder"
      style={{ left: sx, top: sy }}
      aria-hidden="true"
      data-testid="world-wayfinder-marker"
    >
      <i className="ww-c ww-c--tl" />
      <i className="ww-c ww-c--tr" />
      <i className="ww-c ww-c--bl" />
      <i className="ww-c ww-c--br" />
      <span className="world-wayfinder__tag">{hint.label}</span>
    </div>
  );
}
