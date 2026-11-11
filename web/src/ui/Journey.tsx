import { useEffect, useState } from 'react';
import { ACHIEVEMENTS } from '../game/catalog';
import type { GameState } from '../game/core';
import { FIELD_NOTES, FIELD_REFERENCE_GROUPS } from '../game/field-notes';
import {
  ACH_META, CAT_LABEL, DAILY_BY_ID, DAILY_MILESTONES, FIELDCRAFT, rankFor, lessonState, currentStep, lessonComplete,
  milestoneRewardLabel, isMilestoneRequisitioned, streakDays, jumpTargetFor,
  type JourneyStore, type TrackRef, type ChronicleEntry, type QuickJumpTarget,
} from '../game/journey';
import { Icon } from './common';
import { DayDial } from './Waymark';

export type Folio = 'fieldcraft' | 'daily' | 'chronicle' | 'reference';
const LEVEL_MARK: Record<number, string> = { 1: 'dot', 2: 'seal', 3: 'gear', 4: 'gem', 5: 'crown' };

export function JourneyLedger({ gs, store, now, initial = 'fieldcraft', onTrack, onLesson, onReroll, onSeen, onClose, onOpenNotes, onClaimRequisition, onJump }: {
  gs: GameState; store: JourneyStore; now: number; initial?: Folio;
  onTrack: (t: TrackRef) => void; onLesson: (id: string, status: 'seen' | 'dismissed') => void; onReroll: (id: string) => void;
  onSeen: () => void; onClose: () => void; onOpenNotes: () => void;
  onClaimRequisition?: (date: string, milestone: string, points: number) => void;
  onJump?: (target: QuickJumpTarget) => void;
}) {
  const [folio, setFolio] = useState<Folio>(initial);
  const [lessonSel, setLessonSel] = useState<string>(() => (store.tracked?.type === 'lesson' ? store.tracked.id : FIELDCRAFT.find(l => !lessonComplete(store, l))?.id) ?? FIELDCRAFT[0].id);
  const [refSel, setRefSel] = useState<number>(0);
  useEffect(() => { if (folio === 'chronicle') { const t = window.setTimeout(onSeen, 1600); return () => window.clearTimeout(t); } }, [folio]);
  const unseen = store.chronicle.filter(c => !c.seen).length;
  const rank = rankFor(store.marks);
  const d = store.daily;
  const doneDaily = d?.objectives.filter(o => o.done).length ?? 0;
  const mastered = FIELDCRAFT.filter(l => lessonComplete(store, l)).length;
  const achCount = Object.keys(gs.profile.achievements).length;

  return <div className="ledger fadein" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Journey ledger">
    <div className="ledger__ribbons">
      {([
        ['fieldcraft', 'Fieldcraft', `${mastered}/${FIELDCRAFT.length}`],
        ['daily', 'Waypoints', `${doneDaily}/${d?.objectives.length ?? 0}`],
        ['chronicle', 'Chronicle', unseen ? `${unseen} new` : `${achCount}/${Object.keys(ACHIEVEMENTS).length}`],
        ['reference', 'Field Reference', `${FIELD_REFERENCE_GROUPS.length} guides`],
      ] as [Folio, string, string][]).map(([k, label, sub]) =>
        <button key={k} className={`ribbon ribbon--${k} ${folio === k ? 'on' : ''}`} onClick={() => setFolio(k)}><b>{label}</b><span>{sub}</span></button>)}
    </div>
    <div className="ledger__book">
      <i className="ledger__spine" />
      {/* LEFT PAGE */}
      <section className="page page--l">
        <header className="page__head"><span className="page__kicker">EXPEDITION LEDGER</span><span className="rank">{rank.name}</span></header>
        {folio === 'fieldcraft' && <Trail store={store} sel={lessonSel} onSel={setLessonSel} />}
        {folio === 'daily' && <DailyLeft gs={gs} store={store} onClaimRequisition={onClaimRequisition} />}
        {folio === 'chronicle' && <Constellation gs={gs} />}
        {folio === 'reference' && <ReferenceLeft sel={refSel} onSel={setRefSel} onOpenNotes={onOpenNotes} />}
        <footer className="page__foot">
          <span className="marks"><i className="marks__gem" />{store.marks} Wayfarer Marks{rank.next ? ` · ${rank.next.at - store.marks} to ${rank.next.name}` : ''}</span>
        </footer>
      </section>
      {/* RIGHT PAGE */}
      <section className="page page--r">
        {folio === 'fieldcraft' && <LessonPage store={store} id={lessonSel} onTrack={onTrack} onLesson={onLesson} onOpenReference={() => setFolio('reference')} onJump={onJump} />}
        {folio === 'daily' && <DailyRight store={store} now={now} onTrack={onTrack} onReroll={onReroll} onJump={onJump} />}
        {folio === 'chronicle' && <Timeline entries={store.chronicle} runId={gs.run?.id} />}
        {folio === 'reference' && <ReferenceRight sel={refSel} onJump={onJump} />}
      </section>
    </div>
    <div className="ledger__foot"><span><kbd>J</kbd> close · <kbd>T</kbd> peek tracker / tame · <kbd>N</kbd> field notes</span><button className="btn sm gold" onClick={onClose}>Back to the island</button></div>
  </div>;
}

// ---------------- FIELDCRAFT ----------------
function Trail({ store, sel, onSel }: { store: JourneyStore; sel: string; onSel: (id: string) => void }) {
  return <div className="trail">
    <p className="page__lede">Optional paths. Each stone is stamped only when you actually do it.</p>
    {FIELDCRAFT.map(l => {
      const ls = lessonState(store, l.id); const done = lessonComplete(store, l); const cur = currentStep(store, l);
      const st = done ? 'Mastered' : ls.status === 'dismissed' ? 'Set aside' : ls.done.length || Object.values(ls.steps).some(Boolean) ? 'In progress' : ls.status === 'seen' ? 'Seen' : 'Unread';
      const tracked = store.tracked?.type === 'lesson' && store.tracked.id === l.id;
      return <button key={l.id} className={`trail__row ${sel === l.id ? 'on' : ''} ${done ? 'done' : ''} ${ls.status === 'dismissed' ? 'aside' : ''}`} onClick={() => onSel(l.id)}>
        <span className="trail__sigil"><Icon k={l.icon} size={14} /></span>
        <span className="trail__name"><b>{l.title}</b><em className={`state state--${st.replace(' ', '').toLowerCase()}`}>{tracked ? '◆ Tracking' : st}</em></span>
        <span className="trail__stones">{l.steps.map((s, i) => <i key={s.id} className={`stone ${ls.done.includes(s.id) ? 'done' : cur?.id === s.id ? 'cur' : ''}`}>{i < l.steps.length - 1 && <u />}</i>)}</span>
      </button>;
    })}
  </div>;
}

function LessonPage({ store, id, onTrack, onLesson, onOpenReference, onJump }: { store: JourneyStore; id: string; onTrack: (t: TrackRef) => void; onLesson: (id: string, s: 'seen' | 'dismissed') => void; onOpenReference: () => void; onJump?: (t: QuickJumpTarget) => void }) {
  const l = FIELDCRAFT.find(x => x.id === id)!; const ls = lessonState(store, id); const cur = currentStep(store, l);
  useEffect(() => { if (ls.status === 'unseen') onLesson(id, 'seen'); }, [id]);
  const tracked = store.tracked?.type === 'lesson' && store.tracked.id === id;
  const jump = cur ? jumpTargetFor(cur.focus) : null;
  return <div className="lesson">
    <header className="lesson__head"><span className="lesson__sigil"><Icon k={l.icon} size={22} /></span><div><h3>{l.title}</h3><em>“{l.motto}”</em></div></header>
    <ol className="lesson__steps">{l.steps.map(s => {
      const done = ls.done.includes(s.id); const n = ls.steps[s.id] ?? 0; const isCur = cur?.id === s.id;
      return <li key={s.id} className={done ? 'done' : isCur ? 'cur' : 'later'}>
        <span className="lesson__stamp">{done ? <i className="stamp-mark" /> : <Icon k={s.icon} size={10} />}</span>
        <div><b>{s.title}{s.target > 1 && <small> {Math.min(n, s.target)}/{s.target}</small>}</b>
          {(isCur || done) && <p>{done ? s.why : s.how}</p>}</div>
      </li>;
    })}</ol>
    <div className="lesson__acts">
      {!lessonComplete(store, l) && (tracked ? <button className="btn sm" onClick={() => onTrack(null)}>Stop tracking</button> : <button className="btn sm gold" onClick={() => onTrack({ type: 'lesson', id })}>◆ Track this path</button>)}
      {jump && onJump && <button className="btn sm" onClick={() => onJump(jump.target)}>{jump.label}</button>}
      {ls.status === 'dismissed' ? <button className="btn sm" onClick={() => onLesson(id, 'seen')}>Restore</button> : !lessonComplete(store, l) && <button className="btn sm" onClick={() => { onLesson(id, 'dismissed'); if (tracked) onTrack(null); }}>Set aside</button>}
      <button className="btn sm" onClick={onOpenReference}>Field reference</button>
    </div>
    {ls.status === 'dismissed' && <p className="lesson__note">Set aside paths still record what you do — quietly, with no prompts.</p>}
  </div>;
}

// ---------------- DAILY WAYPOINTS ----------------
function DailyLeft({ gs, store, onClaimRequisition }: { gs: GameState; store: JourneyStore; onClaimRequisition?: (date: string, milestone: string, points: number) => void }) {
  const d = store.daily; if (!d) return null;
  const streak = streakDays(store);
  return <div className="daily-l">
    <div className="daily-l__dial">
      <DayDial points={d.points} reached={d.milestones} size={60} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span>today · {d.date}</span>
        {streak > 0 && <span className="streak-pill" title="Active expedition days in a row">★ {streak} day{streak === 1 ? '' : 's'} active</span>}
      </div>
    </div>
    <ul className="medals">{DAILY_MILESTONES.map(m => {
      const on = d.milestones.includes(m.id);
      const claimed = isMilestoneRequisitioned(gs, d.date, m.id);
      const rewardLine = milestoneRewardLabel(m.id);
      return <li key={m.id} className={on ? 'on' : ''}>
        <i className={`medal medal--${m.id}`} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
            <b>{m.name} · {m.at} pts</b>
            {claimed ? <span className="req-badge">✓ Requisitioned</span> : on && onClaimRequisition ? <button className="btn xs gold" onClick={() => onClaimRequisition(d.date, m.id, d.points)}>Claim Supply</button> : null}
          </div>
          <span>+{m.marks} Mark{rewardLine ? ` · ${rewardLine}` : ''}</span>
        </div>
      </li>;
    })}</ul>
    <div className="week">{Array.from({ length: 7 }, (_, i) => {
      const h = i === 6 ? { date: d.date, points: d.points, milestones: d.milestones } : store.history[5 - i];
      return <span key={i} className={`week__day m${h?.milestones.length ?? 0}`} title={h ? `${h.date}: ${h.points} pts` : 'no record'}><i />{h ? h.date.slice(8) : '·'}</span>;
    })}</div>
    <p className="fine">Local midnight reset. Missed days cost nothing; supply requisitions credit your profile &amp; pack.</p>
  </div>;
}

function DailyRight({ store, now, onTrack, onReroll, onJump }: { store: JourneyStore; now: number; onTrack: (t: TrackRef) => void; onReroll: (id: string) => void; onJump?: (t: QuickJumpTarget) => void }) {
  const d = store.daily; if (!d) return null;
  const end = new Date(now); end.setHours(24, 0, 0, 0); const left = Math.max(0, end.getTime() - now);
  return <div className="daily-r">
    <header className="page__head"><span className="page__kicker">TODAY'S WAYPOINTS</span><span className="fine">{Math.floor(left / 3600000)}h {Math.floor(left / 60000) % 60}m left</span></header>
    {d.objectives.map(o => {
      const def = DAILY_BY_ID[o.id]; if (!def) return null;
      const tracked = store.tracked?.type === 'daily' && store.tracked.id === o.id;
      const frac = o.progress / def.target;
      const jump = !o.done ? jumpTargetFor(def.cat === 'craft' ? ['craft'] : def.cat === 'build' ? ['build'] : def.cat === 'explore' ? ['explore'] : undefined) : null;
      return <div key={o.id} className={`wp wp--t${def.tier} ${o.done ? 'done' : ''} ${tracked ? 'tracked' : ''}`}>
        <span className="wp__socket"><Icon k={def.icon} size={14} />{o.done && <i className="stamp-mark" />}</span>
        <div className="wp__body">
          <div className="wp__cat">{CAT_LABEL[def.cat]} · {'◆'.repeat(def.tier)}{def.offlineOk ? ' · counts while away' : ''}</div>
          <b>{def.title}</b>
          <div className="wp__bar"><i style={{ width: `${Math.round(frac * 100)}%` }} /><span>{o.progress}/{def.target}</span></div>
          <p>{def.how}</p>
        </div>
        <div className="wp__side">
          <span className="coin">{def.points}</span>
          {!o.done && (tracked ? <button className="btn xs" onClick={() => onTrack(null)}>untrack</button> : <button className="btn xs gold" onClick={() => onTrack({ type: 'daily', id: o.id })}>track</button>)}
          {jump && onJump && <button className="btn xs" onClick={() => onJump(jump.target)}>{jump.label}</button>}
          {!o.done && !d.rerolled && o.progress === 0 && <button className="btn xs" title="Swap once per day" onClick={() => onReroll(o.id)}>swap</button>}
        </div>
      </div>;
    })}
  </div>;
}

// ---------------- CHRONICLE ----------------
function Constellation({ gs }: { gs: GameState }) {
  const run = gs.run;
  return <div className="constel">
    <p className="page__lede">Achievements — kept across every run.</p>
    <div className="constel__grid">{Object.entries(ACHIEVEMENTS).map(([k, a]) => {
      const rec = gs.profile.achievements[k]; const meta = ACH_META[k]; const thisRun = run?.achievements.includes(k);
      return <div key={k} className={`sigil sigil--l${meta?.level ?? 3} ${rec ? 'on' : ''}`} title={rec ? `${a.name} — ${meta?.tale ?? ''}` : `Locked — ${meta?.hint ?? ''}`}>
        <span className="sigil__gem">{rec ? <Icon k={meta?.icon || 'gear'} size={14} /> : <i className="sigil__lock" />}</span>
        <b>{rec ? a.name : '— — —'}</b>
        <em>{rec ? `${new Date(rec.at).toLocaleDateString()}${thisRun ? ' · this run' : ''}` : meta?.hint}</em>
      </div>;
    })}</div>
    <p className="fine">Run score {run?.score ?? 0} · LOCAL/UNVERIFIED</p>
  </div>;
}

function Timeline({ entries, runId }: { entries: ChronicleEntry[]; runId?: string }) {
  const [f, setF] = useState<'moments' | 'all' | 'run'>('moments');
  const list = entries.filter(e => f === 'all' ? true : f === 'run' ? e.runId === runId : e.level >= 2).slice(0, 60);
  return <div className="tl">
    <header className="page__head"><span className="page__kicker">CHRONICLE</span>
      <span className="tl__filters">{(['moments', 'run', 'all'] as const).map(k => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{k === 'moments' ? 'Moments' : k === 'run' ? 'This run' : 'Everything'}</button>)}</span>
    </header>
    {!list.length && <div className="tl__empty"><i />Nothing written yet. The first page fills itself as you live it.</div>}
    <ol className="tl__list scroll">{list.map(e => <li key={e.id} className={`tl__e tl__e--l${e.level} ${e.seen ? '' : 'new'}`}>
      <i className={`tl__mark tl__mark--${LEVEL_MARK[e.level]}`} />
      <span className="tl__icon">{e.icon && <Icon k={e.icon} size={12} />}</span>
      <div><b>{e.title}{!e.seen && <sup>new</sup>}</b><span>{e.detail}</span></div>
      <time>{new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{e.away ? ' · away' : ''}</time>
    </li>)}</ol>
  </div>;
}

// ---------------- FIELD REFERENCE FOLIO (cherry-picked from Gold 3) ----------------
function ReferenceLeft({ sel, onSel, onOpenNotes }: { sel: number; onSel: (i: number) => void; onOpenNotes: () => void }) {
  const chapters = [...FIELD_REFERENCE_GROUPS.map((g, i) => ({ idx: i, title: g.title, sub: `${g.items.length} controls`, icon: i === 0 ? 'knife' : i === 1 ? 'rope' : i === 2 ? 'st:wall_wood' : i === 3 ? 'core_dragon' : 'berries' })),
    { idx: FIELD_REFERENCE_GROUPS.length, title: 'Survival Field Notes', sub: `${FIELD_NOTES.length} topics`, icon: 'blueprint' }];
  return <div className="trail">
    <p className="page__lede">Controls, expedition rules, husbandry &amp; survival field notes.</p>
    {chapters.map(ch => (
      <button key={ch.idx} className={`trail__row ${sel === ch.idx ? 'on' : ''}`} onClick={() => onSel(ch.idx)}>
        <span className="trail__sigil"><Icon k={ch.icon} size={14} /></span>
        <span className="trail__name"><b>{ch.title}</b><em className="state">{ch.sub}</em></span>
        <span />
      </button>
    ))}
    <div style={{ marginTop: 6 }}>
      <button className="btn sm" onClick={onOpenNotes}>Open Live Notes &amp; Mute Settings [N]</button>
    </div>
  </div>;
}

function ReferenceRight({ sel, onJump }: { sel: number; onJump?: (t: QuickJumpTarget) => void }) {
  if (sel < FIELD_REFERENCE_GROUPS.length) {
    const grp = FIELD_REFERENCE_GROUPS[sel];
    return <div className="tl" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="page__head"><span className="page__kicker">CONTROLS &amp; SYSTEMS</span><span className="rank">{grp.title}</span></header>
      <div className="ref-list scroll">
        <div className="ref-card">
          <div className="ref-kv">
            {grp.items.map(([k, desc]) => <div key={k} style={{ display: 'contents' }}><kbd>{k}</kbd><span>{desc}</span></div>)}
          </div>
        </div>
        {onJump && <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button className="btn sm" onClick={() => onJump('craft')}>Survivor &amp; Craft [C]</button>
          <button className="btn sm" onClick={() => onJump('build')}>Build Bar [B]</button>
          <button className="btn sm" onClick={() => onJump('map')}>Field Chart [M]</button>
        </div>}
      </div>
    </div>;
  }
  return <div className="tl" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <header className="page__head"><span className="page__kicker">SURVIVAL HANDBOOK</span><span className="rank">Field Notes</span></header>
    <div className="ref-list scroll">
      {FIELD_NOTES.map(n => (
        <div key={n.id} className="ref-card">
          <div className="ref-card__head"><b>{n.title}</b><kbd>{n.keyHint}</kbd></div>
          <p>{n.body}</p>
        </div>
      ))}
    </div>
  </div>;
}
