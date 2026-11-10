import { useMemo, useState } from 'react';
import { HOUR } from '../game/core';
import {
  classifyOfflineReturn,
  type OfflineReturnV1,
  type ReturnRow,
  type ReturnTone,
  type StoredReturnEntry,
} from '../game/return-report';
import { Panel, type Api } from './common';

const TONE_COLOR: Record<ReturnTone, string> = {
  ok: 'var(--good)',
  gold: 'var(--brassLit)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  muted: 'var(--paper)',
};

const TONE_RANK: Record<ReturnTone, number> = { bad: 4, warn: 3, gold: 2, ok: 1, muted: 0 };

function formatDuration(gapMs: number): string {
  if (gapMs < 60_000) return `${Math.max(1, Math.round(gapMs / 1000))}s`;
  if (gapMs < HOUR) return `${Math.round(gapMs / 60_000)} min`;
  return `${(gapMs / HOUR).toFixed(1)} h`;
}

function isDeltaStateRow(row: ReturnRow): boolean {
  if (row.source === 'event') return true;
  if (row.id === 'food' || row.id.startsWith('shift:') || row.id.startsWith('hp:') || row.id.startsWith('lost:') || row.id.startsWith('gone:')) return true;
  if (row.id.startsWith('cab:') && !row.text.includes('stock unchanged')) return true;
  return false;
}

/** Lightweight card for minimal or quiet absences — avoids hijacking the full screen. */
export function ReturnDigest({
  report,
  onExpand,
  onDismiss,
}: {
  report: OfflineReturnV1;
  onExpand: () => void;
  onDismiss: () => void;
}) {
  const dur = formatDuration(report.away.gapMs);
  const vitals = report.sections.body.find(r => r.id === 'vitals')?.text ?? '';
  const rows = Object.values(report.sections).flat();
  const hasBad = rows.some(r => r.tone === 'bad');
  const hasWarn = rows.some(r => r.tone === 'warn');
  const receipts = rows.filter(r => r.source === 'event');
  const changes = rows.filter(r => r.source === 'state' && isDeltaStateRow(r));
  const headline = receipts.length
    ? receipts[0].text
    : changes.length ? changes[0].text : 'No confirmed production, loss, or stock changes.';
  const alert = rows.find(r => r.source === 'state' && (r.tone === 'bad' || r.tone === 'warn'));

  return (
    <div
      className="plate return-digest fadein"
      data-testid="return-digest"
      style={{ right: 4, top: 78 }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="return-digest__head">
        <span className="lamp round" style={{ color: hasBad ? 'var(--bad)' : hasWarn ? 'var(--warn)' : 'var(--good)' }} />
        <b>RETURNED · {dur} AWAY</b>
        <button className="btn sm ghost" style={{ marginLeft: 'auto', padding: '1px 4px' }} aria-label="Dismiss return summary" onClick={onDismiss}>×</button>
      </div>
      <div className="return-digest__body">
        <div className="return-digest__outcome"><b>{receipts.length ? `${receipts.length} verified event${receipts.length === 1 ? '' : 's'}` : changes.length ? 'Observed changes' : 'Quiet interval'}</b><span>{headline}</span></div>
        {alert && <div className={`return-digest__alert ${alert.tone}`} role="status">CURRENT ALERT · {alert.text}</div>}
        {vitals && <div className="return-digest__vitals">{vitals}</div>}
      </div>
      <div className="return-digest__actions">
        <button className="btn sm" onClick={onExpand}>Inspect Chronicle</button>
        <button className="btn sm gold" onClick={onDismiss}>Got it</button>
      </div>
    </div>
  );
}

/** Priority-driven Return Chronicle separating offline changes from current status, with past history access. */
export function ReturnChronicle({
  api,
  lines,
  report,
  history = [],
}: {
  api: Api;
  lines: string[];
  report?: OfflineReturnV1 | null;
  history?: StoredReturnEntry[];
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showAllDecay, setShowAllDecay] = useState(false);
  const [showAllWear, setShowAllWear] = useState(false);

  const activeReport = history.length > 0 && selectedIdx > 0 && history[selectedIdx]
    ? history[selectedIdx].report
    : report ?? history[0]?.report ?? null;

  const grouped = useMemo(() => {
    if (!activeReport) return null;
    const all = [
      ...activeReport.sections.body.map(r => ({ ...r, sec: 'Body' })),
      ...activeReport.sections.loss.map(r => ({ ...r, sec: 'Loss' })),
      ...activeReport.sections.production.map(r => ({ ...r, sec: 'Work' })),
      ...activeReport.sections.home.map(r => ({ ...r, sec: 'Home' })),
      ...activeReport.sections.world.map(r => ({ ...r, sec: 'World' })),
    ];

    const eventChanges = all
      .filter(r => r.source === 'event')
      .sort((a, b) => TONE_RANK[b.tone] - TONE_RANK[a.tone]);

    const decayRows = all.filter(r => r.source === 'state' && r.id.startsWith('hp:'));
    const otherDeltaRows = all
      .filter(r => r.source === 'state' && isDeltaStateRow(r) && !r.id.startsWith('hp:'))
      .sort((a, b) => TONE_RANK[b.tone] - TONE_RANK[a.tone]);

    const wearRows = all.filter(r => r.id.startsWith('rep:'));
    const statusRows = all
      .filter(r => r.source === 'state' && !isDeltaStateRow(r) && !r.id.startsWith('rep:'))
      .sort((a, b) => TONE_RANK[b.tone] - TONE_RANK[a.tone]);

    const criticalCount =
      all.filter(r => r.tone === 'bad' && !r.id.startsWith('hp:') && !r.id.startsWith('rep:')).length +
      (decayRows.length > 0 ? 1 : 0);
    const warnCount =
      all.filter(r => !r.id.startsWith('rep:') && !r.id.startsWith('hp:') && r.tone === 'warn').length +
      (wearRows.length > 0 ? 1 : 0);
    const positiveCount = all.filter(r => r.source === 'event' && (r.tone === 'ok' || r.tone === 'gold')).length;

    return {
      eventChanges,
      decayRows,
      otherDeltaRows,
      wearRows,
      statusRows,
      criticalCount,
      warnCount,
      positiveCount,
      severity: classifyOfflineReturn(activeReport),
    };
  }, [activeReport]);

  if (!activeReport || !grouped) {
    return (
      <Panel title="Expedition Return Chronicle" testId="return-chronicle" style={{ left: 100, top: 36, width: 440, boxSizing: 'border-box' }} onClose={() => api.open(null)}>
        <div className="scroll" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {lines.length ? lines.map((l, i) => <div key={i} style={{ fontSize: 12, lineHeight: 1.3, color: i ? '#d8cce4' : '#ffd98a', marginBottom: 4 }}>• {l}</div>)
            : <div style={{ fontSize: 11, color: 'var(--muted)' }}>No offline return events recorded yet in this session.</div>}
        </div>
        <button className="btn gold" style={{ marginTop: 6, fontSize: 12 }} onClick={() => api.open(null)}>Continue</button>
      </Panel>
    );
  }

  const sevColor = grouped.severity === 'critical' ? 'var(--bad)' : grouped.severity === 'notable' ? 'var(--brassLit)' : 'var(--good)';

  return (
    <Panel
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        RETURN CHRONICLE · {formatDuration(activeReport.away.gapMs)} AWAY
        <span className="chip" style={{ color: sevColor }}>{grouped.severity.toUpperCase()}</span>
        {grouped.criticalCount > 0 && <span className="chip" style={{ color: 'var(--bad)' }}>{grouped.criticalCount} CRITICAL</span>}
        {grouped.positiveCount > 0 && <span className="chip" style={{ color: 'var(--good)' }}>+{grouped.positiveCount} EVENTS</span>}
        {grouped.warnCount > 0 && <span className="chip" style={{ color: 'var(--warn)' }}>{grouped.warnCount} ALERTS</span>}
      </span>}
      className="return-report"
      testId="return-chronicle"
      style={{ left: 8, top: 8, width: 624, height: 344, boxSizing: 'border-box', padding: '7px 9px', display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}
      onClose={() => api.open(null)}
    >
      {/* Summary & Past Returns Selector */}
      <div className="return-top">
        <div className="return-summary">{activeReport.summary}</div>
        {history.length > 1 && (
          <div className="return-history-bar" role="group" aria-label="Past offline returns">
            <span>History:</span>
            {history.slice(0, 4).map((h, idx) => (
              <button
                key={h.id}
                className={`btn sm ${selectedIdx === idx ? 'gold' : 'ghost'}`}
                onClick={() => { setSelectedIdx(idx); setShowAllWear(false); setShowAllDecay(false); }}
                title={`Recorded ${new Date(h.recordedAt).toLocaleTimeString()}`}
              >
                {idx === 0 ? 'Latest' : `-${idx}`} ({formatDuration(h.report.away.gapMs)})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Strict Separation: Left = What Changed Offline | Right = Current Status Now */}
      <div className="return-cols">
        <section className="return-col console-col">
          <div className="return-col__head">
            <span style={{ color: 'var(--brassLit)' }}>WHILE YOU WERE AWAY</span>
            <small>{activeReport.receiptCount} event{activeReport.receiptCount === 1 ? '' : 's'}</small>
          </div>
          <div className="scroll return-col__list">
            {grouped.eventChanges.length === 0 && grouped.otherDeltaRows.length === 0 && grouped.decayRows.length === 0 ? (
              <div className="return-empty">No timed events or stock deltas occurred during your absence.</div>
            ) : (
              <>
                {grouped.eventChanges.map(row => (
                  <div key={`${row.sec}-${row.id}`} className="return-row" style={{ color: TONE_COLOR[row.tone] }}>
                    <span className="chip" style={{ color: 'var(--brassLit)' }}>EVENT</span>
                    <div className="return-row__copy">
                      <span>{row.text}</span>
                      {row.where && !row.text.includes(`${row.where.tx},${row.where.ty}`) && (
                        <small> · {row.where.name} ({row.where.tx},{row.where.ty})</small>
                      )}
                    </div>
                  </div>
                ))}
                {grouped.otherDeltaRows.map(row => (
                  <div key={`${row.sec}-${row.id}`} className="return-row" style={{ color: TONE_COLOR[row.tone] }}>
                    <span className="chip" style={{ color: 'var(--info)' }}>DELTA</span>
                    <div className="return-row__copy">
                      <span>{row.text}</span>
                      {row.where && !row.text.includes(`${row.where.tx},${row.where.ty}`) && (
                        <small> · {row.where.name} ({row.where.tx},{row.where.ty})</small>
                      )}
                    </div>
                  </div>
                ))}
                {grouped.decayRows.length > 0 && (
                  <div className="return-wear">
                    <div className="return-row" style={{ color: 'var(--bad)', marginBottom: 2 }}>
                      <span className="chip" style={{ color: 'var(--bad)' }}>DECAY</span>
                      <div className="return-row__copy" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flex: 1 }}>
                        <span>{grouped.decayRows.length} base structure{grouped.decayRows.length === 1 ? '' : 's'} lost HP while away</span>
                        <button className="btn sm ghost" onClick={() => setShowAllDecay(v => !v)}>
                          {showAllDecay ? 'Collapse' : 'Inspect'}
                        </button>
                      </div>
                    </div>
                    {showAllDecay && grouped.decayRows.map(d => (
                      <div key={d.id} className="return-wear__item" style={{ color: 'var(--bad)' }}>{d.text}</div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="return-col console-col">
          <div className="return-col__head">
            <span style={{ color: 'var(--info)' }}>CURRENT STATUS AT RETURN</span>
            <small>live reading</small>
          </div>
          <div className="scroll return-col__list">
            {grouped.statusRows.map(row => (
              <div key={`${row.sec}-${row.id}`} className="return-row" style={{ color: TONE_COLOR[row.tone] }}>
                <span className="chip" style={{ color: 'var(--info)' }}>NOW</span>
                <div className="return-row__copy">
                  <span>{row.text}</span>
                </div>
              </div>
            ))}
            {grouped.wearRows.length > 0 && (
              <div className="return-wear">
                <div className="return-row" style={{ color: 'var(--warn)', marginBottom: 2 }}>
                  <span className="chip" style={{ color: 'var(--warn)' }}>HOME</span>
                  <div className="return-row__copy" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flex: 1 }}>
                    <span>{grouped.wearRows.length} base structure{grouped.wearRows.length === 1 ? '' : 's'} below 50% HP</span>
                    <button className="btn sm ghost" onClick={() => setShowAllWear(v => !v)}>
                      {showAllWear ? 'Collapse' : 'Inspect'}
                    </button>
                  </div>
                </div>
                {showAllWear && grouped.wearRows.map(w => (
                  <div key={w.id} className="return-wear__item">{w.text}</div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Prioritized Next Physical Steps + Exit */}
      <div className="return-footer">
        <div className="return-next">
          <b>NEXT: </b>
          {activeReport.next.length ? activeReport.next.slice(0, 2).join(' ') : grouped.criticalCount || grouped.warnCount ? 'Review the current alerts before heading out.' : 'No urgent physical follow-up recorded. Choose your next step.'}
        </div>
        <button className="btn gold" style={{ fontSize: 11, flex: '0 0 auto' }} onClick={() => api.open(null)}>
          Enter the Island
        </button>
      </div>
    </Panel>
  );
}
