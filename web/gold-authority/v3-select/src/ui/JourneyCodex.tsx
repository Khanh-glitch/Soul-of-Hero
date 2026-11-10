import { useState } from 'react';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_META,
  ELDERS,
  ITEMS,
} from '../game/catalog';
import { type GameState } from '../game/core';
import {
  FIELD_NOTES,
  FIELD_REFERENCE_GROUPS,
  type FieldNoteDef,
  type FieldNoteStore,
} from '../game/field-notes';
import {
  DAILY_MILESTONES,
  DAILY_OBJECTIVES,
  FIELDCRAFT_PATHS,
  ensureDailySlate,
  fieldcraftStatusOf,
  getJourneyProfile,
  getJourneyRun,
  markFieldcraftSeen,
  setFieldcraftDismissed,
  type JourneyCategory,
} from '../game/journey';
import { C, isRagnarok, phaseOf, runHours } from '../game/engine';
import { Icon, Panel } from './common';
import { Glyph } from './hud';

export type CodexChapter = 'daily' | 'fieldcraft' | 'chronicle';

const CAT_COLOR: Record<JourneyCategory, string> = {
  survival: 'var(--food)',
  craft: 'var(--brassLit)',
  shelter: 'var(--good)',
  combat: 'var(--info)',
  expedition: '#d99bff',
};

const CREATOR_CORE_KEYS = [
  'core_blast',
  'core_earthmother',
  'core_meteor',
  'core_elsa',
  'core_mjolnir',
  'core_demon',
  'core_dragon',
] as const;

export function JourneyCodex({
  gs,
  now,
  qaMode,
  initialChapter = 'daily',
  matchingNotes,
  noteStore,
  onDismissNote,
  onRestoreNote,
  onToggleMuteNotes,
  onTrackTarget,
  onRerollDaily,
  onClose,
}: {
  gs: GameState;
  now: number;
  qaMode: boolean;
  initialChapter?: CodexChapter;
  matchingNotes: FieldNoteDef[];
  noteStore: FieldNoteStore;
  onDismissNote: (id: string) => void;
  onRestoreNote: (id: string) => void;
  onToggleMuteNotes: () => void;
  onTrackTarget: (id: string) => void;
  onRerollDaily: (slotIdx: number) => void;
  onClose: () => void;
}) {
  const r = gs.run!;
  const [chapter, setChapter] = useState<CodexChapter>(initialChapter);
  const [fcSub, setFcSub] = useState<'paths' | 'alerts' | 'keys'>('paths');
  const [chronSub, setChronSub] = useState<'honors' | 'relics' | 'timeline'>('honors');
  const [, setLocalTick] = useState(0);
  const bump = () => setLocalTick(v => v + 1);

  const pj = getJourneyProfile(gs, qaMode);
  const rj = getJourneyRun(r, qaMode);
  const daily = ensureDailySlate(pj, r, now);
  const hrs = runHours(r, now);
  const day = Math.floor(hrs / 24) + 1;
  const ph = phaseOf(r, now);
  const rag = isRagnarok(r, now);

  const dailyDoneCount = daily.slots.filter(s => s.completedAt !== undefined).length;
  const fcDoneCount = FIELDCRAFT_PATHS.filter(fp => fieldcraftStatusOf(fp, rj.fieldcraft[fp.id]) === 'completed').length;
  const achTotal = Object.keys(ACHIEVEMENTS).length;
  const achUnlockedCount = Object.keys(ACHIEVEMENTS).filter(k => r.achievements.includes(k) || !!gs.profile.achievements[k]).length;

  const matchingIds = new Set(matchingNotes.map(m => m.id));
  const triggeredAlerts = FIELD_NOTES.filter(
    n => matchingIds.has(n.id) || noteStore.triggered.includes(n.id) || noteStore.resolved.includes(n.id) || noteStore.dismissed.includes(n.id),
  );

  const trackedId = rj.trackedId || 'auto';

  return (
    <Panel
      title={
        <div className="codex-head">
          <div className="codex-head__brand">
            <Glyph k="eye" c="var(--brassLit)" s={9} />
            <span>EXPEDITION CODEX</span>
            <span className="chip" style={{ color: rag ? 'var(--bad)' : ph === 'danger' ? 'var(--warn)' : 'var(--good)' }}>
              DAY {day}/14 · {ph === 'calm' ? 'CALM' : ph === 'danger' ? 'WAKING' : 'RAGNAROK'}
            </span>
          </div>

          <div className="codex-head__telemetry">
            {/* Elder Stone Constellation */}
            <div className="codex-stones" title={`Elder Stones in run custody: ${r.elderStones.length}/6`}>
              {Object.values(ELDERS).map(el => {
                const has = r.elderStones.includes(el.stone);
                return (
                  <span
                    key={el.stone}
                    className={`codex-stone-pip ${has ? 'lit' : ''}`}
                    style={{ '--sc': el.color } as React.CSSProperties}
                    title={`${el.name} · ${ITEMS[el.stone]?.name || el.stone}${has ? ' (Held)' : ' (Unclaimed)'}`}
                  />
                );
              })}
              <small>{r.elderStones.length}/6</small>
            </div>

            {/* Daily Ember Meter */}
            <div className="codex-dp-pill" title={`Daily Pact Points today: ${daily.points}/100 DP`}>
              <Glyph k="spark" c="var(--brassLit)" s={7} />
              <span>{daily.points}/100 DP</span>
            </div>
          </div>
        </div>
      }
      className="field-notes-panel codex-panel"
      testId="expedition-codex"
      style={{
        left: 16,
        top: 14,
        width: 608,
        height: 332,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        zIndex: 48,
      }}
      onClose={onClose}
    >
      {/* Unified Chapter Spine */}
      <div className="codex-nav" role="tablist" aria-label="Expedition Codex Chapters">
        <button
          type="button"
          role="tab"
          aria-selected={chapter === 'daily'}
          className={`codex-tab ${chapter === 'daily' ? 'on' : ''}`}
          onClick={() => setChapter('daily')}
        >
          <Glyph k="spark" c={chapter === 'daily' ? 'var(--brassLit)' : 'var(--muted)'} s={7} />
          <span>Daily Pact</span>
          <em>{dailyDoneCount}/3</em>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={chapter === 'fieldcraft'}
          className={`codex-tab ${chapter === 'fieldcraft' ? 'on' : ''}`}
          onClick={() => setChapter('fieldcraft')}
        >
          <Glyph k="home" c={chapter === 'fieldcraft' ? 'var(--good)' : 'var(--muted)'} s={7} />
          <span>Fieldcraft</span>
          <em>{fcDoneCount}/{FIELDCRAFT_PATHS.length}</em>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={chapter === 'chronicle'}
          className={`codex-tab ${chapter === 'chronicle' ? 'on' : ''}`}
          onClick={() => setChapter('chronicle')}
        >
          <Glyph k="skull" c={chapter === 'chronicle' ? '#d99bff' : 'var(--muted)'} s={7} />
          <span>Chronicle</span>
          <em>{achUnlockedCount}/{achTotal}</em>
        </button>

        <div className="codex-focus-pill">
          <span>Wayfinder:</span>
          <b>{trackedId === 'none' ? 'Paused' : trackedId === 'auto' ? 'Smart Auto' : 'Pinned'}</b>
          {trackedId !== 'auto' && (
            <button type="button" className="btn sm ghost" onClick={() => { onTrackTarget('auto'); bump(); }}>
              Reset Auto
            </button>
          )}
        </div>
      </div>

      {/* ================= CHAPTER 1: DAILY PACT ================= */}
      {chapter === 'daily' && (
        <div className="codex-body codex-daily">
          {/* Left: Daily Milestone Seals & Economy Authority Ledger */}
          <div className="console-col codex-daily__spine">
            <div className="codex-section-h">
              <span>EMBER MILESTONES</span>
              <small>{daily.dayKey}</small>
            </div>

            <div className="codex-dp-bar">
              <div className="codex-dp-bar__fill" style={{ width: `${Math.min(100, daily.points)}%` }} />
              {DAILY_MILESTONES.map(m => (
                <span
                  key={m.id}
                  className={`codex-dp-bar__pip ${daily.points >= m.points ? 'reached' : ''}`}
                  style={{ left: `${m.points}%` }}
                  title={`${m.title} (${m.points} DP)`}
                />
              ))}
            </div>

            <div className="codex-milestones">
              {DAILY_MILESTONES.map(m => {
                const reached = daily.claimedMilestones.includes(m.id) || daily.points >= m.points;
                const preserved = daily.preservedRewards.find(pr => pr.id === `daily:${daily.dayKey}:${m.id}`);
                return (
                  <div key={m.id} className={`codex-seal ${reached ? 'reached' : ''}`}>
                    <div className="codex-seal__ico">
                      <Icon k={m.icon} size={15} />
                    </div>
                    <div className="codex-seal__copy">
                      <div className="codex-seal__head">
                        <b>{m.title}</b>
                        <span className="chip" style={{ color: reached ? 'var(--good)' : 'var(--muted)' }}>
                          {reached ? 'SEALED' : `${m.points} DP`}
                        </span>
                      </div>
                      <div className="codex-seal__desc">{m.authenticReward}</div>
                      {m.preservedAuthority && (
                        <div className="codex-seal__auth" title={m.preservedAuthority.authorityRequired}>
                          <span>{preserved ? '◈ Preserved Voucher: ' : '◈ Engine Hook: '}{m.preservedAuthority.label}</span>
                          <small>Requires `engine.ts` custody grant (never forged locally)</small>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="codex-streak">
              <span>Gentle Streak: <b>{pj.streak}d</b> (Best {pj.bestStreak}d)</span>
              <span>Lifetime: <b>{pj.totalDailyPoints} DP</b></span>
            </div>
          </div>

          {/* Right: Today's 3 Natural Daily Objectives */}
          <div className="scroll codex-daily__list">
            <div className="codex-note-line">
              Progress derives strictly from verified gameplay receipts (no drop/pickup exploits). Missed days reset softly with zero penalty.
            </div>
            {daily.slots.map((slot, idx) => {
              const def = DAILY_OBJECTIVES.find(d => d.id === slot.id);
              if (!def) return null;
              const done = slot.completedAt !== undefined || slot.progress >= slot.target;
              const pct = Math.min(100, Math.round((slot.progress / Math.max(1, slot.target)) * 100));
              const isPinned = trackedId === `daily:${idx}`;
              const blocker = !done && def.blockerHint ? def.blockerHint(r, now) : null;
              return (
                <div
                  key={`${slot.id}-${idx}`}
                  className={`codex-row ${done ? 'done' : ''}`}
                  style={{ '--rc': CAT_COLOR[def.category] } as React.CSSProperties}
                >
                  <div className="codex-row__ico">
                    <Icon k={def.icon} size={18} />
                  </div>
                  <div className="codex-row__main">
                    <div className="codex-row__head">
                      <b>{def.title}</b>
                      <span className="chip" style={{ color: done ? 'var(--good)' : 'var(--brassLit)' }}>
                        +{def.points} DP
                      </span>
                      <span className="codex-row__prog">
                        {done ? '✓ FULFILLED' : `${slot.progress}/${slot.target}`}
                      </span>
                    </div>
                    <div className="codex-row__desc">{def.desc}</div>
                    <div className="codex-row__bar">
                      <i style={{ width: `${pct}%`, background: done ? 'var(--good)' : CAT_COLOR[def.category] }} />
                    </div>
                    {blocker ? (
                      <div className="codex-row__blocker">Blocked: {blocker}</div>
                    ) : (
                      <div className="codex-row__hint">{def.actionHint}</div>
                    )}
                  </div>
                  <div className="codex-row__acts">
                    {!done && (
                      <button
                        type="button"
                        className={`btn sm ${isPinned ? 'gold' : ''}`}
                        onClick={() => { onTrackTarget(isPinned ? 'auto' : `daily:${idx}`); bump(); }}
                      >
                        {isPinned ? 'Tracked' : 'Track'}
                      </button>
                    )}
                    {!done && daily.rerollsUsed < 1 && (
                      <button
                        type="button"
                        className="btn sm ghost"
                        title="Swap this objective once today"
                        onClick={() => { onRerollDaily(idx); bump(); }}
                      >
                        Swap
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {pj.dailyHistory.length > 0 && (
              <div className="codex-history-strip">
                <span>Recent Days:</span>
                {pj.dailyHistory.slice(0, 5).map(h => (
                  <span key={h.dayKey} className="chip" style={{ color: h.points >= 100 ? 'var(--brassLit)' : 'var(--muted)' }}>
                    {h.dayKey.slice(5)} · {h.points} DP
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= CHAPTER 2: FIELDCRAFT ================= */}
      {chapter === 'fieldcraft' && (
        <div className="codex-body codex-fc">
          <div className="codex-subbar">
            <button type="button" className={`btn sm ${fcSub === 'paths' ? 'gold' : 'ghost'}`} onClick={() => setFcSub('paths')}>
              Survival Paths ({fcDoneCount}/{FIELDCRAFT_PATHS.length})
            </button>
            <button type="button" className={`btn sm ${fcSub === 'alerts' ? 'gold' : 'ghost'}`} onClick={() => setFcSub('alerts')}>
              Situational Notes ({triggeredAlerts.length})
            </button>
            <button type="button" className={`btn sm ${fcSub === 'keys' ? 'gold' : 'ghost'}`} onClick={() => setFcSub('keys')}>
              Controls &amp; Keys
            </button>
            <button
              type="button"
              className={`btn sm ${noteStore.muted ? 'gold' : 'ghost'}`}
              style={{ marginLeft: 'auto' }}
              onClick={onToggleMuteNotes}
            >
              {noteStore.muted ? 'Resume Live Alerts' : 'Mute Live Alerts'}
            </button>
          </div>

          <div className="scroll codex-scroll">
            {fcSub === 'paths' && (
              <div className="codex-paths">
                <div className="codex-note-line">
                  Hands-on survival lessons verified only by genuine gameplay receipts — opening or reading never fakes completion.
                </div>
                {FIELDCRAFT_PATHS.map(fp => {
                  const prog = rj.fieldcraft[fp.id];
                  const status = fieldcraftStatusOf(fp, prog);
                  const doneCount = prog?.stepsDone.length ?? 0;
                  const isPinned = trackedId === `field:${fp.id}`;
                  const statusLabel =
                    status === 'completed'
                      ? 'Completed'
                      : status === 'dismissed'
                        ? 'Dismissed'
                        : status === 'in_progress'
                          ? `In Progress (${doneCount}/${fp.steps.length})`
                          : status === 'seen'
                            ? 'Seen'
                            : 'Available';
                  const statusCol =
                    status === 'completed'
                      ? 'var(--good)'
                      : status === 'dismissed'
                        ? 'var(--muted)'
                        : status === 'in_progress'
                          ? 'var(--brassLit)'
                          : 'var(--info)';

                  return (
                    <div
                      key={fp.id}
                      className={`codex-path ${status}`}
                      style={{ '--rc': CAT_COLOR[fp.category] } as React.CSSProperties}
                      onMouseEnter={() => markFieldcraftSeen(gs, fp.id, now, qaMode)}
                    >
                      <div className="codex-path__top">
                        <Icon k={fp.icon} size={16} />
                        <div className="codex-path__title">
                          <b>{fp.title}</b>
                          <span>{fp.summary}</span>
                        </div>
                        <span className="chip" style={{ color: statusCol }}>{statusLabel}</span>
                        {status !== 'completed' && status !== 'dismissed' && (
                          <button
                            type="button"
                            className={`btn sm ${isPinned ? 'gold' : ''}`}
                            onClick={() => { onTrackTarget(isPinned ? 'auto' : `field:${fp.id}`); bump(); }}
                          >
                            {isPinned ? 'Tracked' : 'Track'}
                          </button>
                        )}
                        {status !== 'completed' && (
                          <button
                            type="button"
                            className="btn sm ghost"
                            onClick={() => {
                              setFieldcraftDismissed(gs, fp.id, status !== 'dismissed', qaMode);
                              bump();
                            }}
                          >
                            {status === 'dismissed' ? 'Restore' : 'Dismiss'}
                          </button>
                        )}
                      </div>

                      <div className="codex-steps">
                        {fp.steps.map(st => {
                          const ok = prog?.stepsDone.includes(st.id);
                          return (
                            <div key={st.id} className={`codex-step ${ok ? 'ok' : ''}`} title={st.hint}>
                              <i>{ok ? '✓' : '○'}</i>
                              <span>{st.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {fcSub === 'alerts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div className="codex-note-line">
                  Reactive survival alerts surface only when relevant (cold nights, worn tools, overloaded pack, Death Bag, Ragnarok).
                </div>
                {triggeredAlerts.map(n => {
                  const isDismissed = noteStore.dismissed.includes(n.id);
                  const isResolved = noteStore.resolved.includes(n.id);
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
                          ? <button type="button" className="btn sm ghost" onClick={() => onRestoreNote(n.id)}>Show again</button>
                          : <button type="button" className="btn sm ghost" onClick={() => onDismissNote(n.id)}>Dismiss</button>}
                      </div>
                      <div className="fn-row__body">{n.body}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {fcSub === 'keys' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {FIELD_REFERENCE_GROUPS.map(g => (
                  <div key={g.title} className="console-col" style={{ padding: '6px 8px' }}>
                    <div className="console-h" style={{ color: 'var(--brassLit)' }}>{g.title}</div>
                    {g.items.map(([k, v]) => (
                      <div key={k} className="lbl" style={{ fontSize: 9, display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 3 }}>
                        <span style={{ color: 'var(--brassLit)', whiteSpace: 'nowrap' }}>{k}</span>
                        <span style={{ color: 'var(--paper)', textAlign: 'right' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= CHAPTER 3: CHRONICLE ================= */}
      {chapter === 'chronicle' && (
        <div className="codex-body codex-chron">
          <div className="codex-subbar">
            <button type="button" className={`btn sm ${chronSub === 'honors' ? 'gold' : 'ghost'}`} onClick={() => setChronSub('honors')}>
              Milestones &amp; Achievements ({achUnlockedCount}/{achTotal})
            </button>
            <button type="button" className={`btn sm ${chronSub === 'relics' ? 'gold' : 'ghost'}`} onClick={() => setChronSub('relics')}>
              Cores &amp; Stones ({pj.discoveredCores.length}/{CREATOR_CORE_KEYS.length})
            </button>
            <button type="button" className={`btn sm ${chronSub === 'timeline' ? 'gold' : 'ghost'}`} onClick={() => setChronSub('timeline')}>
              Expedition Timeline ({rj.timeline.length || pj.chronicle.length})
            </button>
            <span className="chip" style={{ marginLeft: 'auto', color: 'var(--brassLit)' }}>
              Run Score {r.score} · Secured {gs.profile.securedCash}
            </span>
          </div>

          <div className="scroll codex-scroll">
            {chronSub === 'honors' && (
              <div className="codex-ach-grid">
                {Object.entries(ACHIEVEMENTS).map(([key, ach]) => {
                  const meta = ACHIEVEMENT_META[key];
                  const inRun = r.achievements.includes(key);
                  const onProfile = gs.profile.achievements[key];
                  const unlocked = inRun || !!onProfile;
                  const level = meta?.level ?? 3;
                  return (
                    <div key={key} className={`codex-ach ${unlocked ? 'unlocked' : 'locked'} lvl-${level}`}>
                      <div className="codex-ach__ico">
                        <Icon k={meta?.icon || 'spark'} size={18} />
                      </div>
                      <div className="codex-ach__copy">
                        <div className="codex-ach__head">
                          <b>{ach.name}</b>
                          <span className="chip" style={{ color: inRun ? 'var(--good)' : onProfile ? 'var(--brassLit)' : 'var(--muted)' }}>
                            {inRun ? 'THIS RUN' : onProfile ? 'PROFILE' : `+${ach.score}`}
                          </span>
                        </div>
                        <div className="codex-ach__desc">{meta?.desc || 'Island accomplishment'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {chronSub === 'relics' && (
              <div className="codex-relics">
                <div className="console-col">
                  <div className="console-h" style={{ color: 'var(--brassLit)' }}>Creator Cores Discovered Across Expeditions</div>
                  <div className="codex-core-gallery">
                    {CREATOR_CORE_KEYS.map(ck => {
                      const found = pj.discoveredCores.includes(ck) || C(r, 'inv').slots.some(s => s?.key === ck);
                      const d = ITEMS[ck];
                      return (
                        <div key={ck} className={`codex-core-tile ${found ? 'found' : 'unfound'}`} title={found ? `${d.name}: ${d.desc}` : 'Undiscovered Creator Core'}>
                          <Icon k={ck} size={22} />
                          <b>{found ? d.name : 'Uncharted Core'}</b>
                          <small>{found ? (d.essence || 'core').toUpperCase() : '???'}</small>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="console-col">
                  <div className="console-h" style={{ color: 'var(--info)' }}>Six Elder Guardians &amp; Crown Progress ({r.elderStones.length}/6)</div>
                  <div className="codex-elder-grid">
                    {Object.entries(ELDERS).map(([ek, el]) => {
                      const has = r.elderStones.includes(el.stone);
                      return (
                        <div key={ek} className={`codex-elder ${has ? 'lit' : ''}`} style={{ '--ec': el.color } as React.CSSProperties}>
                          <Icon k={el.stone} size={16} />
                          <div>
                            <b>{el.name}</b>
                            <small>{el.region} · {has ? ITEMS[el.stone]?.name : 'Unclaimed Stone'}</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {chronSub === 'timeline' && (
              <div className="codex-timeline">
                {(rj.timeline.length ? rj.timeline : pj.chronicle).length === 0 ? (
                  <div className="codex-note-line">
                    Significant discoveries, Fieldcraft mastery, recipes, Daily Pact completions, and achievements will appear here as your journey unfolds.
                  </div>
                ) : (
                  (rj.timeline.length ? rj.timeline : pj.chronicle).map(entry => (
                    <div key={entry.id} className={`codex-tline lvl-${entry.level}`}>
                      <span className="codex-tline__lvl">L{entry.level}</span>
                      <div className="codex-tline__ico">
                        {entry.icon ? <Icon k={entry.icon} size={14} /> : <Glyph k="spark" c="var(--brassLit)" s={8} />}
                      </div>
                      <div className="codex-tline__copy">
                        <b>{entry.title}</b>
                        <span>{entry.detail}</span>
                      </div>
                      <small className="codex-tline__time">{new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="codex-foot">
        <span>Press <span className="key">N</span> or <span className="key">J</span> anytime to open or close the Expedition Codex.</span>
        <button type="button" className="btn sm gold" onClick={onClose}>Back to Island</button>
      </div>
    </Panel>
  );
}
