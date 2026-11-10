import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, ELDERS, ITEMS } from '../game/catalog';
import type { GameState } from '../game/core';
import {
  ACH_META, CAT_LABEL, DAILY_BY_ID, DAILY_MILESTONES, FIELDCRAFT, rankFor, lessonState, currentStep, lessonComplete,
  type JourneyStore, type TrackRef, type ChronicleEntry,
} from '../game/journey';
import { Icon } from './common';
import { DayDial } from './Waymark';

type Folio = 'fieldcraft' | 'daily' | 'chronicle';
const LEVEL_MARK: Record<number, string> = { 1: 'dot', 2: 'seal', 3: 'gear', 4: 'gem', 5: 'crown' };

export function JourneyLedger({ gs, store, now, initial = 'fieldcraft', onTrack, onLesson, onReroll, onSeen, onClose, onOpenNotes }: {
  gs: GameState; store: JourneyStore; now: number; initial?: Folio;
  onTrack: (t: TrackRef) => void; onLesson: (id: string, status: 'seen' | 'dismissed') => void; onReroll: (id: string) => void;
  onSeen: () => void; onClose: () => void; onOpenNotes: () => void;
}) {
  const [folio, setFolio] = useState<Folio>(initial);
  const [lessonSel, setLessonSel] = useState<string>(() => (store.tracked?.type === 'lesson' ? store.tracked.id : FIELDCRAFT.find(l => !lessonComplete(store, l))?.id) ?? FIELDCRAFT[0].id);
  useEffect(() => { if (folio === 'chronicle') { const t = window.setTimeout(onSeen, 1600); return () => window.clearTimeout(t); } }, [folio]);
  const unseen = store.chronicle.filter(c => !c.seen).length;
  const rank = rankFor(store.marks);
  const d = store.daily;
  const doneDaily = d?.objectives.filter(o => o.done).length ?? 0;
  const mastered = FIELDCRAFT.filter(l => lessonComplete(store, l)).length;
  const achCount = Object.keys(gs.profile.achievements).length;

  return <div className="ledger fadein" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Journey ledger">
    <div className="ledger__ribbons">
      {([['fieldcraft', 'Fieldcraft', `${mastered}/${FIELDCRAFT.length}`], ['daily', 'Waypoints', `${doneDaily}/${d?.objectives.length ?? 0}`], ['chronicle', 'Chronicle', unseen ? `${unseen} new` : `${achCount}/${Object.keys(ACHIEVEMENTS).length}`]] as [Folio, string, string][]).map(([k, label, sub]) =>
        <button key={k} className={`ribbon ribbon--${k} ${folio === k ? 'on' : ''}`} onClick={() => setFolio(k)}><b>{label}</b><span>{sub}</span></button>)}
    </div>
    <div className="ledger__book">
      <i className="ledger__spine" />
      {/* LEFT PAGE */}
      <section className="page page--l">
        <header className="page__head"><span className="page__kicker">EXPEDITION LEDGER</span><span className="rank">{rank.name}</span></header>
        {folio === 'fieldcraft' && <Trail store={store} sel={lessonSel} onSel={setLessonSel} />}
        {folio === 'daily' && <DailyLeft store={store} />}
        {folio === 'chronicle' && <Constellation gs={gs} />}
        <footer className="page__foot">
          <span className="marks"><i className="marks__gem" />{store.marks} Wayfarer Marks{rank.next ? ` · ${rank.next.at - store.marks} to ${rank.next.name}` : ''}</span>
        </footer>
      </section>
      {/* RIGHT PAGE */}
      <section className="page page--r">
        {folio === 'fieldcraft' && <LessonPage store={store} id={lessonSel} onTrack={onTrack} onLesson={onLesson} onOpenNotes={onOpenNotes} />}
        {folio === 'daily' && <DailyRight store={store} now={now} onTrack={onTrack} onReroll={onReroll} />}
        {folio === 'chronicle' && <Timeline entries={store.chronicle} runId={gs.run?.id} />}
      </section>
    </div>
    <div className="ledger__foot"><span><kbd>J</kbd> close · <kbd>T</kbd> peek tracker · <kbd>N</kbd> field reference</span><button className="btn sm gold" onClick={onClose}>Back to the island</button></div>
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

function LessonPage({ store, id, onTrack, onLesson, onOpenNotes }: { store: JourneyStore; id: string; onTrack: (t: TrackRef) => void; onLesson: (id: string, s: 'seen' | 'dismissed') => void; onOpenNotes: () => void }) {
  const l = FIELDCRAFT.find(x => x.id === id)!; const ls = lessonState(store, id); const cur = currentStep(store, l);
  useEffect(() => { if (ls.status === 'unseen') onLesson(id, 'seen'); }, [id]);
  const tracked = store.tracked?.type === 'lesson' && store.tracked.id === id;
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
      {ls.status === 'dismissed' ? <button className="btn sm" onClick={() => onLesson(id, 'seen')}>Restore</button> : !lessonComplete(store, l) && <button className="btn sm" onClick={() => { onLesson(id, 'dismissed'); if (tracked) onTrack(null); }}>Set aside</button>}
      <button className="btn sm" onClick={onOpenNotes}>Field reference</button>
    </div>
    {ls.status === 'dismissed' && <p className="lesson__note">Set aside paths still record what you do — quietly, with no prompts.</p>}
  </div>;
}

// ---------------- DAILY WAYPOINTS ----------------
function DailyLeft({ store }: { store: JourneyStore }) {
  const d = store.daily; if (!d) return null;
  return <div className="daily-l">
    <div className="daily-l__dial"><DayDial points={d.points} reached={d.milestones} size={64} /><span>today · {d.date}</span></div>
    <ul className="medals">{DAILY_MILESTONES.map(m => {
      const on = d.milestones.includes(m.id);
      return <li key={m.id} className={on ? 'on' : ''}>
        <i className={`medal medal--${m.id}`} />
        <div><b>{m.name} · {m.at} pts</b><span>+{m.marks} Wayfarer Mark{m.pending ? ' · Supply Requisition (pending authority)' : ''}</span></div>
      </li>;
    })}</ul>
    <div className="week">{Array.from({ length: 7 }, (_, i) => {
      const h = i === 6 ? { date: d.date, points: d.points, milestones: d.milestones } : store.history[5 - i];
      return <span key={i} className={`week__day m${h?.milestones.length ?? 0}`} title={h ? `${h.date}: ${h.points} pts` : 'no record'}><i />{h ? h.date.slice(8) : '·'}</span>;
    })}</div>
    <p className="fine">Local midnight reset. Missed days cost nothing — there are no streaks to lose.</p>
  </div>;
}

function DailyRight({ store, now, onTrack, onReroll }: { store: JourneyStore; now: number; onTrack: (t: TrackRef) => void; onReroll: (id: string) => void }) {
  const d = store.daily; if (!d) return null;
  const end = new Date(now); end.setHours(24, 0, 0, 0); const left = Math.max(0, end.getTime() - now);
  return <div className="daily-r">
    <header className="page__head"><span className="page__kicker">TODAY'S WAYPOINTS</span><span className="fine">{Math.floor(left / 3600000)}h {Math.floor(left / 60000) % 60}m left</span></header>
    {d.objectives.map(o => {
      const def = DAILY_BY_ID[o.id]; if (!def) return null;
      const tracked = store.tracked?.type === 'daily' && store.tracked.id === o.id;
      const frac = o.progress / def.target;
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
          {!o.done && !d.rerolled && o.progress === 0 && <button className="btn xs" title="Swap once per day" onClick={() => onReroll(o.id)}>swap</button>}
        </div>
      </div>;
    })}
    {store.pendingRewards.length > 0 && <details className="pending"><summary>{store.pendingRewards.length} reward(s) awaiting engine authority</summary><p>{store.pendingRewards[0].requirement}</p></details>}
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
  const [f, setF] = useState<'moments' | 'all' | 'run' | 'relics'>('moments');
  const list = entries.filter(e => f === 'all' ? true : f === 'run' ? e.runId === runId : e.level >= 2).slice(0, 60);
  return <div className="tl">
    <header className="page__head"><span className="page__kicker">CHRONICLE</span>
      <span className="tl__filters">{(['moments', 'run', 'all', 'relics'] as const).map(k => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{k === 'moments' ? 'Moments' : k === 'run' ? 'This run' : k === 'relics' ? 'Relics' : 'Everything'}</button>)}</span>
    </header>
    {f === 'relics' && <RelicGallery entries={entries} /> }
    {f !== 'relics' && !list.length && <div className="tl__empty"><i />Nothing written yet. The first page fills itself as you live it.</div>}
    <ol className="tl__list scroll" style={f === 'relics' ? { display: 'none' } : undefined}>{list.map(e => <li key={e.id} className={`tl__e tl__e--l${e.level} ${e.seen ? '' : 'new'}`}>
      <i className={`tl__mark tl__mark--${LEVEL_MARK[e.level]}`} />
      <span className="tl__icon">{e.icon && <Icon k={e.icon} size={12} />}</span>
      <div><b>{e.title}{!e.seen && <sup>new</sup>}</b><span>{e.detail}</span></div>
      <time>{new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{e.away ? ' · away' : ''}</time>
    </li>)}</ol>
  </div>;
}

/** B's Core/Elder gallery adapted to A's parchment chronicle: only prior genuine
 * discoveries are named. Unseen Elders are intentionally anonymous silhouettes. */
function RelicGallery({ entries }: { entries: ChronicleEntry[] }) {
  const knownCores = new Map<string, ChronicleEntry>();
  for (const e of entries) if (e.kind === 'relic' && e.icon && ITEMS[e.icon]?.creatorCore) knownCores.set(e.icon, e);
  const defeated = entries.filter(e => e.kind === 'elder');
  return <div className="relic-gallery">
    <div className="relic-gallery__title">RECOVERED CREATOR CORES <small>{knownCores.size} known</small></div>
    <div className="relic-gallery__slots">{[...knownCores].map(([key, e]) => <div key={key} className="relic-gallery__slot known" title={e.title}>
      <Icon k={key} size={19}/><span>{ITEMS[key]?.name ?? e.title}</span>
    </div>)}{knownCores.size === 0 && <div className="relic-gallery__unknown">No Core has been recorded in your custody. Undiscovered relics remain hidden.</div>}</div>
    <div className="relic-gallery__title">ELDER LEGACY <small>{defeated.length} recorded</small></div>
    <div className="relic-gallery__slots relic-gallery__elders">{Array.from({ length: Math.max(6, Object.keys(ELDERS).length) }, (_, i) => {
      const e = defeated[i]; return <div key={i} className={`relic-gallery__slot ${e ? 'known' : 'locked'}`} title={e?.title ?? 'Unencountered Elder — identity hidden'}>
        {e?.icon ? <Icon k={e.icon} size={18}/> : <span className="relic-gallery__mystery">?</span>}
        <span>{e?.title ?? 'Unknown'}</span>
      </div>;
    })}</div>
  </div>;
}
