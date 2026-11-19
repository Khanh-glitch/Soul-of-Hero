import { useState } from 'react';
import { FIELD_NOTES, FIELD_REFERENCE_GROUPS, type FieldNoteDef, type FieldNoteStore } from '../game/field-notes';
import { Panel } from './common';
import { Glyph } from './hud';

const CAT_COLOR: Record<FieldNoteDef['category'], string> = {
  survival: 'var(--food)',
  craft: 'var(--brassLit)',
  shelter: 'var(--good)',
  combat: 'var(--info)',
  expedition: '#d99bff',
};

/** Compact interactive contextual guidance card docked cleanly on the right HUD rail. */
export function FieldNoteCard({
  note,
  top = 78,
  onDismiss,
  onOpenJournal,
  onMute,
  onAction,
}: {
  note: FieldNoteDef;
  top?: number;
  onDismiss: (id: string) => void;
  onOpenJournal: () => void;
  onMute: () => void;
  onAction?: () => void;
}) {
  return (
    <div
      className="plate field-note-card fadein"
      data-testid="field-note-card"
      data-note-id={note.id}
      style={{ right: 4, top }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="field-note-card__head">
        <Glyph k="eye" c={CAT_COLOR[note.category]} s={7} />
        <b style={{ color: CAT_COLOR[note.category] }}>{note.title}</b>
        <span className="key" style={{ marginLeft: 'auto', marginRight: 0 }}>{note.keyHint}</span>
      </div>
      <div className="field-note-card__body">{note.body}</div>
      <div className="field-note-card__actions">
        {onAction && <button className="btn sm gold" onClick={onAction} aria-label={`Open relevant action for ${note.title}`}>{note.keyHint.includes('M') ? 'Open Map' : 'Open Pack'}</button>}
        <button className="btn sm" onClick={() => onDismiss(note.id)}>Got it</button>
        <button className="btn sm ghost" onClick={onOpenJournal} title="Open Field Notes Journal [N]">Notes [N]</button>
        <button className="btn sm ghost" onClick={onMute} title="Pause live contextual notes (always accessible in N)">Mute</button>
      </div>
    </div>
  );
}

/** Reviewable Field Notes & Controls journal accessible anytime via [N] or HUD button. */
export function FieldNotesPanel({
  matching,
  store,
  onDismiss,
  onRestore,
  onToggleMute,
  onClose,
}: {
  matching: FieldNoteDef[];
  store: FieldNoteStore;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
  onToggleMute: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'situational' | 'reference'>('situational');
  const matchingIds = new Set(matching.map(m => m.id));
  const triggeredList = FIELD_NOTES.filter(n => matchingIds.has(n.id) || store.triggered.includes(n.id) || store.resolved.includes(n.id) || store.dismissed.includes(n.id));
  const unseenList = FIELD_NOTES.filter(n => !triggeredList.some(t => t.id === n.id));

  return (
    <Panel
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Glyph k="eye" c="var(--brassLit)" s={8} />FIELD NOTES
        <span className="chip" style={{ color: store.muted ? 'var(--warn)' : 'var(--good)' }}>
          {store.muted ? 'HINTS MUTED' : 'LIVE HINTS ON'}
        </span>
      </span>}
      className="field-notes-panel"
      style={{ left: 90, top: 24, width: 460, height: 312, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
      onClose={onClose}
    >
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 5 }}>
        <button className={`btn sm ${tab === 'situational' ? 'gold' : 'ghost'}`} onClick={() => setTab('situational')}>
          Active &amp; Seen ({triggeredList.length})
        </button>
        <button className={`btn sm ${tab === 'reference' ? 'gold' : 'ghost'}`} onClick={() => setTab('reference')}>
          Field Reference
        </button>
        <button className={`btn sm ${store.muted ? 'gold' : 'ghost'}`} style={{ marginLeft: 'auto' }} onClick={onToggleMute}>
          {store.muted ? 'Resume live notes' : 'Mute live notes'}
        </button>
      </div>

      <div className="scroll console-col" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '5px 7px' }}>
        {tab === 'situational' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>
              Reactive survival notes — no quests or orders. Dismiss notes you know or restore them anytime.
            </div>
            {triggeredList.map(n => {
              const isDismissed = store.dismissed.includes(n.id);
              const isResolved = store.resolved.includes(n.id);
              const isNow = matchingIds.has(n.id);
              const status = isDismissed ? 'Dismissed' : isResolved ? 'Handled' : isNow ? 'Relevant now' : 'Seen earlier';
              const statusCol = isDismissed ? 'var(--muted)' : isResolved ? 'var(--good)' : isNow ? 'var(--brassLit)' : 'var(--info)';
              return (
                <div key={n.id} className="fn-row" style={{ borderLeftColor: CAT_COLOR[n.category], opacity: isDismissed ? 0.72 : 1 }}>
                  <div className="fn-row__head">
                    <b style={{ color: CAT_COLOR[n.category] }}>{n.title}</b>
                    <span className="key">{n.keyHint}</span>
                    <span className="chip" style={{ color: statusCol, marginLeft: 'auto' }}>{status}</span>
                    {isDismissed
                      ? <button className="btn sm ghost" onClick={() => onRestore(n.id)}>Show again</button>
                      : <button className="btn sm ghost" onClick={() => onDismiss(n.id)}>Dismiss</button>}
                  </div>
                  <div className="fn-row__body">{n.body}</div>
                </div>
              );
            })}
            {unseenList.length > 0 && (
              <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>
                {unseenList.length} situational note{unseenList.length === 1 ? '' : 's'} appear naturally when relevant (night cold, worn gear, Cores, Ragnarok, etc.).
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {FIELD_REFERENCE_GROUPS.map(g => (
              <div key={g.title} className="console-col" style={{ padding: '5px 6px' }}>
                <div className="console-h" style={{ color: 'var(--brassLit)' }}>{g.title}</div>
                {g.items.map(([k, v]) => (
                  <div key={k} className="lbl" style={{ fontSize: 8, display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
                    <span style={{ color: 'var(--brassLit)', whiteSpace: 'nowrap' }}>{k}</span>
                    <span style={{ color: 'var(--paper)', textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
        <span className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>Press <span className="key">N</span> anytime to open or close Field Notes.</span>
        <button className="btn sm gold" onClick={onClose}>Back to Island</button>
      </div>
    </Panel>
  );
}
