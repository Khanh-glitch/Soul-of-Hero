import type { PersistentWarning } from '../game/gold-attention';
import { Glyph } from './hud';

/**
 * Persistent unresolved safety & production warnings.
 * Mounted in the Left Safety Rail below UrgentAlerts so problems stay visible
 * until resolved in the real world (never cleared by a fixed toast timer).
 */
export function PersistentProblems({
  warnings,
  compact = false,
  onInspectMap,
}: {
  warnings: PersistentWarning[];
  compact?: boolean;
  onInspectMap?: () => void;
}) {
  if (!warnings.length) return null;
  const shown = compact ? warnings.slice(0, 1) : warnings.slice(0, 3);
  return (
    <div className="persistent-rail" data-testid="persistent-problems" role="status" aria-live="polite">
      {shown.map(w => {
        const col = w.severity === 'bad' ? 'var(--bad)' : 'var(--warn)';
        return (
          <div
            key={w.id}
            className={`plate persistent-chip fadein ${w.severity}`}
            data-warning-kind={w.kind}
            style={{ borderColor: col }}
            onClick={w.kind === 'death_bag' ? onInspectMap : undefined}
            title={`${w.label}: ${w.detail} — ${w.fix}`}
          >
            <span className="lamp diamond" style={{ color: col }} />
            <Glyph k={w.glyph} c={col} s={7} />
            <div className="persistent-chip__copy">
              <b style={{ color: col }}>{w.label}</b>
              {!compact && <span>{w.detail}</span>}
              {!compact && <small>{w.fix}</small>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
