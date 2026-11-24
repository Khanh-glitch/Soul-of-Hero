import { useEffect, useState, useSyncExternalStore } from 'react';
import { ACHIEVEMENTS, ITEMS } from '../game/catalog';
import type { GameState } from '../game/core';
import { FIELD_NOTES, FIELD_NOTES_VI, FIELD_REFERENCE_GROUPS, FIELD_REFERENCE_VI } from '../game/field-notes';
import { TIER_LABEL, lessonText, stepText } from '../game/handbook';
import { getLang, setLang, subscribeLang, T, type Lang } from '../game/i18n';
import {
  ACH_META, DAILY_BY_ID, DAILY_MILESTONES, FIELDCRAFT, rankFor, lessonState, currentStep, lessonComplete, lessonClaimable, lessonClaimed,
  milestoneRewardLabel, isMilestoneRequisitioned, streakDays, jumpTargetFor, catLabel, dailyText,
  type JourneyStore, type TrackRef, type ChronicleEntry, type QuickJumpTarget,
} from '../game/journey';
import { Icon } from './common';
import { DayDial } from './Waymark';

export type Folio = 'fieldcraft' | 'daily' | 'chronicle' | 'reference';
const LEVEL_MARK: Record<number, string> = { 1: 'dot', 2: 'seal', 3: 'gear', 4: 'gem', 5: 'crown' };

/** Re-render when the player switches language (presentation only; nothing in the run depends on it). */
export function useLang(): Lang { return useSyncExternalStore(subscribeLang, getLang, getLang); }

export function LangSwitch() {
  const lang = useLang();
  return <span className="lang" role="group" aria-label="Language / Ngôn ngữ">
    <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} title="English">EN</button>
    <button className={lang === 'vi' ? 'on' : ''} onClick={() => setLang('vi')} title="Tiếng Việt">VI</button>
  </span>;
}

export function JourneyLedger({ gs, store, now, initial = 'fieldcraft', onTrack, onLesson, onReroll, onSeen, onClose, onOpenNotes, onClaimRequisition, onClaimChapter, onJump }: {
  gs: GameState; store: JourneyStore; now: number; initial?: Folio;
  onTrack: (t: TrackRef) => void; onLesson: (id: string, status: 'seen' | 'dismissed') => void; onReroll: (id: string) => void;
  onSeen: () => void; onClose: () => void; onOpenNotes: () => void;
  onClaimRequisition?: (date: string, milestone: string) => void;
  /** Ask the engine to issue a handbook chapter's supply bundle (`handbookClaim`). */
  onClaimChapter?: (chapter: string) => void;
  onJump?: (target: QuickJumpTarget) => void;
}) {
  const lang = useLang();
  const [folio, setFolio] = useState<Folio>(initial);
  const [lessonSel, setLessonSel] = useState<string>(() => (store.tracked?.type === 'lesson' ? store.tracked.id : (FIELDCRAFT.find(l => lessonClaimable(store, l)) ?? FIELDCRAFT.find(l => !lessonComplete(store, l)))?.id) ?? FIELDCRAFT[0].id);
  const [refSel, setRefSel] = useState<number>(0);
  useEffect(() => { if (folio === 'chronicle') { const t = window.setTimeout(onSeen, 1600); return () => window.clearTimeout(t); } }, [folio]);
  const unseen = store.chronicle.filter(c => !c.seen).length;
  const rank = rankFor(store.marks);
  const d = store.daily;
  const doneDaily = d?.objectives.filter(o => o.done).length ?? 0;
  const mastered = FIELDCRAFT.filter(l => lessonComplete(store, l)).length;
  const waiting = FIELDCRAFT.filter(l => lessonClaimable(store, l)).length;
  const achCount = Object.keys(gs.profile.achievements).length;

  return <div className={`ledger fadein lang-${lang}`} onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Journey ledger">
    <div className="ledger__ribbons">
      {([
        ['fieldcraft', T('Fieldcraft', 'Sổ tay', lang), waiting ? T(`${waiting} to claim`, `${waiting} quà chờ`, lang) : `${mastered}/${FIELDCRAFT.length}`],
        ['daily', T('Waypoints', 'Mốc ngày', lang), `${doneDaily}/${d?.objectives.length ?? 0}`],
        ['chronicle', T('Chronicle', 'Biên niên', lang), unseen ? T(`${unseen} new`, `${unseen} mới`, lang) : `${achCount}/${Object.keys(ACHIEVEMENTS).length}`],
        ['reference', T('Field Reference', 'Tra cứu', lang), T(`${FIELD_REFERENCE_GROUPS.length} guides`, `${FIELD_REFERENCE_GROUPS.length} mục`, lang)],
      ] as [Folio, string, string][]).map(([k, label, sub]) =>
        <button key={k} className={`ribbon ribbon--${k} ${folio === k ? 'on' : ''} ${k === 'fieldcraft' && waiting ? 'ribbon--gift' : ''}`} onClick={() => setFolio(k)}><b>{label}</b><span>{sub}</span></button>)}
      <LangSwitch />
    </div>
    <div className="ledger__book">
      <i className="ledger__spine" />
      {/* LEFT PAGE */}
      <section className="page page--l">
        <header className="page__head"><span className="page__kicker">{T('EXPEDITION LEDGER', 'SỔ HÀNH TRÌNH', lang)}</span><span className="rank">{rank.name}</span></header>
        {folio === 'fieldcraft' && <Trail store={store} sel={lessonSel} onSel={setLessonSel} lang={lang} />}
        {folio === 'daily' && <DailyLeft gs={gs} store={store} onClaimRequisition={onClaimRequisition} lang={lang} />}
        {folio === 'chronicle' && <Constellation gs={gs} lang={lang} />}
        {folio === 'reference' && <ReferenceLeft sel={refSel} onSel={setRefSel} onOpenNotes={onOpenNotes} lang={lang} />}
        <footer className="page__foot">
          <span className="marks"><i className="marks__gem" />{store.marks} Wayfarer Marks{rank.next ? T(` · ${rank.next.at - store.marks} to ${rank.next.name}`, ` · còn ${rank.next.at - store.marks} tới ${rank.next.name}`, lang) : ''}</span>
        </footer>
      </section>
      {/* RIGHT PAGE */}
      <section className="page page--r">
        {folio === 'fieldcraft' && <LessonPage gs={gs} store={store} id={lessonSel} onTrack={onTrack} onLesson={onLesson} onOpenReference={() => setFolio('reference')} onJump={onJump} onClaimChapter={onClaimChapter} lang={lang} />}
        {folio === 'daily' && <DailyRight store={store} now={now} onTrack={onTrack} onReroll={onReroll} onJump={onJump} lang={lang} />}
        {folio === 'chronicle' && <Timeline entries={store.chronicle} runId={gs.run?.id} lang={lang} />}
        {folio === 'reference' && <ReferenceRight sel={refSel} onJump={onJump} lang={lang} />}
      </section>
    </div>
    <div className="ledger__foot"><span><kbd>J</kbd> {T('close', 'đóng', lang)} · <kbd>T</kbd> {T('peek tracker / tame', 'xem gợi ý / thuần hóa', lang)} · <kbd>N</kbd> {T('field notes', 'ghi chú', lang)}</span><button className="btn sm gold" onClick={onClose}>{T('Back to the island', 'Quay lại đảo', lang)}</button></div>
  </div>;
}

// ---------------- FIELDCRAFT · the Survivor Handbook ----------------
function Trail({ store, sel, onSel, lang }: { store: JourneyStore; sel: string; onSel: (id: string) => void; lang: Lang }) {
  return <div className="trail">
    <p className="page__lede">{T('Optional chapters, any order, done your own way.', 'Chương tùy chọn, thứ tự tùy bạn, làm theo cách của bạn.', lang)}</p>
    <div className="trail__list scroll">
      {FIELDCRAFT.map(l => {
        const ls = lessonState(store, l.id); const done = lessonComplete(store, l); const cur = currentStep(store, l);
        const gift = lessonClaimable(store, l); const got = lessonClaimed(store, l);
        const stKey = gift ? 'gift' : done ? 'mastered' : ls.status === 'dismissed' ? 'setaside' : ls.done.length || Object.values(ls.steps).some(Boolean) ? 'inprogress' : ls.status === 'seen' ? 'seen' : 'unread';
        const stLabel: Record<string, string> = {
          gift: T('★ Supplies waiting', '★ Có quà chờ nhận', lang), mastered: T('Mastered', 'Đã thành thạo', lang), setaside: T('Set aside', 'Tạm gác', lang),
          inprogress: T('In progress', 'Đang làm', lang), seen: T('Seen', 'Đã xem', lang), unread: T('Unread', 'Chưa đọc', lang),
        };
        const tracked = store.tracked?.type === 'lesson' && store.tracked.id === l.id;
        return <button key={l.id} className={`trail__row ${sel === l.id ? 'on' : ''} ${done ? 'done' : ''} ${gift ? 'gift' : ''} ${ls.status === 'dismissed' ? 'aside' : ''}`} onClick={() => onSel(l.id)}>
          <span className="trail__sigil"><Icon k={l.icon} size={14} /></span>
          <span className="trail__name"><b>{lessonText(l, lang).title}</b><em className={`state state--${stKey}`}>{tracked && !gift ? T('◆ Tracking', '◆ Đang theo dõi', lang) : stLabel[stKey]}{got ? ' · ✓' : ''}</em></span>
          <span className="trail__stones">{l.steps.map((s, i) => <i key={s.id} className={`stone ${ls.done.includes(s.id) ? 'done' : cur?.id === s.id ? 'cur' : ''}`}>{i < l.steps.length - 1 && <u />}</i>)}</span>
        </button>;
      })}
    </div>
  </div>;
}

function LessonPage({ gs, store, id, onTrack, onLesson, onOpenReference, onJump, onClaimChapter, lang }: {
  gs: GameState; store: JourneyStore; id: string; onTrack: (t: TrackRef) => void; onLesson: (id: string, s: 'seen' | 'dismissed') => void;
  onOpenReference: () => void; onJump?: (t: QuickJumpTarget) => void; onClaimChapter?: (chapter: string) => void; lang: Lang;
}) {
  const l = FIELDCRAFT.find(x => x.id === id)!; const ls = lessonState(store, id); const cur = currentStep(store, l);
  useEffect(() => { if (ls.status === 'unseen') onLesson(id, 'seen'); }, [id]);
  const tracked = store.tracked?.type === 'lesson' && store.tracked.id === id;
  const jump = cur ? jumpTargetFor(cur.focus) : null;
  const lt = lessonText(l, lang);
  const claimable = lessonClaimable(store, l); const claimed = lessonClaimed(store, l); const complete = lessonComplete(store, l);
  const qa = !!gs.run?.qaUsed;
  const needs = l.needs ?? l.steps.map(s => s.id);
  const left = needs.filter(sid => !ls.done.includes(sid)).length;
  return <div className="lesson scroll">
    <header className="lesson__head"><span className="lesson__sigil"><Icon k={l.icon} size={22} /></span><div><h3>{lt.title}</h3><em>“{lt.motto}”</em></div></header>
    <ol className="lesson__steps">{l.steps.map(s => {
      const done = ls.done.includes(s.id); const n = ls.steps[s.id] ?? 0; const isCur = cur?.id === s.id; const stx = stepText(s, lang);
      // Every open step shows its "how": the chapter is not a chain, any step can be done first.
      return <li key={s.id} className={done ? 'done' : isCur ? 'cur' : 'open'}>
        <span className="lesson__stamp">{done ? <i className="stamp-mark" /> : <Icon k={s.icon} size={10} />}</span>
        <div><b>{stx.title}{s.target > 1 && <small> {Math.min(n, s.target)}/{s.target}</small>}</b>
          <p>{done ? stx.why : stx.how}</p></div>
      </li>;
    })}</ol>
    <div className={`cache cache--t${l.tier} ${claimable ? 'cache--ready' : ''} ${claimed ? 'cache--got' : ''}`}>
      <div className="cache__head">
        <b>{TIER_LABEL[l.tier][lang]}</b>
        {claimed ? <span className="req-badge">✓ {T('Received', 'Đã nhận', lang)}</span>
          : claimable && onClaimChapter && !qa ? <button className="btn sm gold cache__btn" onClick={() => onClaimChapter(id)}>{T('Claim', 'Nhận', lang)}</button>
          : <span className="cache__lock">{qa ? T('not in QA runs', 'không có ở lượt QA', lang) : T(`${left} step${left === 1 ? '' : 's'} to go`, `còn ${left} bước`, lang)}</span>}
      </div>
      <div className="cache__items">{l.reward.map(([k, q]) => <span key={k} className="cache__item" title={ITEMS[k]?.desc}><Icon k={k} size={12} /><i>{q > 1 ? `${q}× ` : ''}{ITEMS[k]?.name ?? k}</i></span>)}</div>
      <p className="lesson__note">{T('Opens: ', 'Mở ra: ', lang)}{l.opens[lang]}</p>
      {l.needs && !claimed && <p className="lesson__note">{T('Opens as soon as Ragnarok begins — you do not have to finish the chapter first.', 'Mở ngay khi Ragnarok bắt đầu — không cần làm xong cả chương.', lang)}</p>}
    </div>
    <div className="lesson__acts">
      {!complete && (tracked ? <button className="btn sm" onClick={() => onTrack(null)}>{T('Stop tracking', 'Ngừng theo dõi', lang)}</button> : <button className="btn sm gold" onClick={() => onTrack({ type: 'lesson', id })}>{T('◆ Track this chapter', '◆ Theo dõi chương này', lang)}</button>)}
      {jump && onJump && <button className="btn sm" onClick={() => onJump(jump.target)}>{jump.label}</button>}
      {ls.status === 'dismissed' ? <button className="btn sm" onClick={() => onLesson(id, 'seen')}>{T('Restore', 'Khôi phục', lang)}</button> : !complete && <button className="btn sm" onClick={() => { onLesson(id, 'dismissed'); if (tracked) onTrack(null); }}>{T('Set aside', 'Tạm gác', lang)}</button>}
      <button className="btn sm" onClick={onOpenReference}>{T('Field reference', 'Tra cứu', lang)}</button>
    </div>
    {ls.status === 'dismissed' && <p className="lesson__note">{T('Set aside chapters still record what you do — quietly, with no prompts.', 'Chương tạm gác vẫn ghi nhận việc bạn làm — lặng lẽ, không nhắc nhở.', lang)}</p>}
  </div>;
}

// ---------------- DAILY WAYPOINTS ----------------
function DailyLeft({ gs, store, onClaimRequisition, lang }: { gs: GameState; store: JourneyStore; onClaimRequisition?: (date: string, milestone: string) => void; lang: Lang }) {
  const d = store.daily; if (!d) return null;
  const streak = streakDays(store);
  return <div className="daily-l">
    <div className="daily-l__dial">
      <DayDial points={d.points} reached={d.milestones} size={60} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span>{T('today', 'hôm nay', lang)} · {d.date}</span>
        {streak > 0 && <span className="streak-pill" title="Active expedition days in a row">★ {T(`${streak} day${streak === 1 ? '' : 's'} active`, `${streak} ngày liên tiếp`, lang)}</span>}
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
            <b>{m.name} · {m.at} {T('pts', 'điểm', lang)}</b>
            {claimed ? <span className="req-badge">✓ {T('Requisitioned', 'Đã nhận', lang)}</span> : on && onClaimRequisition ? <button className="btn xs gold" onClick={() => onClaimRequisition(d.date, m.id)}>{T('Claim Supply', 'Nhận tiếp tế', lang)}</button> : null}
          </div>
          <span>+{m.marks} Mark{rewardLine ? ` · ${rewardLine}` : ''}</span>
        </div>
      </li>;
    })}</ul>
    <div className="week">{Array.from({ length: 7 }, (_, i) => {
      const h = i === 6 ? { date: d.date, points: d.points, milestones: d.milestones } : store.history[5 - i];
      return <span key={i} className={`week__day m${h?.milestones.length ?? 0}`} title={h ? `${h.date}: ${h.points} pts` : 'no record'}><i />{h ? h.date.slice(8) : '·'}</span>;
    })}</div>
    <p className="fine">{T('UTC midnight reset. Missed days cost nothing; supply requisitions issue run-local field supplies to your pack (Secured Cash comes only from Ragnarok Escrow).', 'Đặt lại lúc nửa đêm UTC. Bỏ lỡ ngày không mất gì; tiếp tế là đồ dùng trong lượt chơi, đưa thẳng vào balo (Secured Cash chỉ đến từ Ragnarok Escrow).', lang)}</p>
  </div>;
}

function DailyRight({ store, now, onTrack, onReroll, onJump, lang }: { store: JourneyStore; now: number; onTrack: (t: TrackRef) => void; onReroll: (id: string) => void; onJump?: (t: QuickJumpTarget) => void; lang: Lang }) {
  const d = store.daily; if (!d) return null;
  const end = new Date(now); end.setUTCHours(24, 0, 0, 0); const left = Math.max(0, end.getTime() - now);
  return <div className="daily-r">
    <header className="page__head"><span className="page__kicker">{T("TODAY'S WAYPOINTS", 'MỐC HÔM NAY', lang)}</span><span className="fine">{T(`${Math.floor(left / 3600000)}h ${Math.floor(left / 60000) % 60}m left`, `còn ${Math.floor(left / 3600000)}g ${Math.floor(left / 60000) % 60}p`, lang)}</span></header>
    {d.objectives.map(o => {
      const def = DAILY_BY_ID[o.id]; if (!def) return null;
      const tracked = store.tracked?.type === 'daily' && store.tracked.id === o.id;
      const frac = o.progress / def.target;
      const jump = !o.done ? jumpTargetFor(def.cat === 'craft' ? ['craft'] : def.cat === 'build' ? ['build'] : def.cat === 'explore' ? ['explore'] : undefined) : null;
      return <div key={o.id} className={`wp wp--t${def.tier} ${o.done ? 'done' : ''} ${tracked ? 'tracked' : ''}`}>
        <span className="wp__socket"><Icon k={def.icon} size={14} />{o.done && <i className="stamp-mark" />}</span>
        <div className="wp__body">
          <div className="wp__cat">{catLabel(def.cat, lang)} · {'◆'.repeat(def.tier)}{def.offlineOk ? T(' · counts while away', ' · tính cả khi vắng mặt', lang) : ''}</div>
          <b>{dailyText(def, lang).title}</b>
          <div className="wp__bar"><i style={{ width: `${Math.round(frac * 100)}%` }} /><span>{o.progress}/{def.target}</span></div>
          <p>{dailyText(def, lang).how}</p>
        </div>
        <div className="wp__side">
          <span className="coin">{def.points}</span>
          {!o.done && (tracked ? <button className="btn xs" onClick={() => onTrack(null)}>{T('untrack', 'bỏ theo dõi', lang)}</button> : <button className="btn xs gold" onClick={() => onTrack({ type: 'daily', id: o.id })}>{T('track', 'theo dõi', lang)}</button>)}
          {jump && onJump && <button className="btn xs" onClick={() => onJump(jump.target)}>{jump.label}</button>}
          {!o.done && !d.rerolled && o.progress === 0 && <button className="btn xs" title={T('Swap once per day', 'Đổi một lần mỗi ngày', lang)} onClick={() => onReroll(o.id)}>{T('swap', 'đổi', lang)}</button>}
        </div>
      </div>;
    })}
  </div>;
}

// ---------------- CHRONICLE ----------------
function Constellation({ gs, lang }: { gs: GameState; lang: Lang }) {
  const run = gs.run;
  return <div className="constel">
    <p className="page__lede">{T('Achievements — kept across every run.', 'Thành tựu — giữ qua mọi lượt chơi.', lang)}</p>
    <div className="constel__grid">{Object.entries(ACHIEVEMENTS).map(([k, a]) => {
      const rec = gs.profile.achievements[k]; const meta = ACH_META[k]; const thisRun = run?.achievements.includes(k);
      return <div key={k} className={`sigil sigil--l${meta?.level ?? 3} ${rec ? 'on' : ''}`} title={rec ? `${a.name} — ${meta?.tale ?? ''}` : `Locked — ${meta?.hint ?? ''}`}>
        <span className="sigil__gem">{rec ? <Icon k={meta?.icon || 'gear'} size={14} /> : <i className="sigil__lock" />}</span>
        <b>{rec ? a.name : '— — —'}</b>
        <em>{rec ? `${new Date(rec.at).toLocaleDateString()}${thisRun ? T(' · this run', ' · lượt này', lang) : ''}` : meta?.hint}</em>
      </div>;
    })}</div>
    <p className="fine">{T('Run score', 'Điểm lượt chơi', lang)} {run?.score ?? 0} · LOCAL/UNVERIFIED</p>
  </div>;
}

function Timeline({ entries, runId, lang }: { entries: ChronicleEntry[]; runId?: string; lang: Lang }) {
  const [f, setF] = useState<'moments' | 'all' | 'run'>('moments');
  const list = entries.filter(e => f === 'all' ? true : f === 'run' ? e.runId === runId : e.level >= 2).slice(0, 60);
  return <div className="tl">
    <header className="page__head"><span className="page__kicker">{T('CHRONICLE', 'BIÊN NIÊN', lang)}</span>
      <span className="tl__filters">{(['moments', 'run', 'all'] as const).map(k => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{k === 'moments' ? T('Moments', 'Dấu mốc', lang) : k === 'run' ? T('This run', 'Lượt này', lang) : T('Everything', 'Tất cả', lang)}</button>)}</span>
    </header>
    {!list.length && <div className="tl__empty"><i />{T('Nothing written yet. The first page fills itself as you live it.', 'Chưa có gì được ghi. Trang đầu sẽ tự đầy khi bạn sống qua nó.', lang)}</div>}
    <ol className="tl__list scroll">{list.map(e => <li key={e.id} className={`tl__e tl__e--l${e.level} ${e.seen ? '' : 'new'}`}>
      <i className={`tl__mark tl__mark--${LEVEL_MARK[e.level]}`} />
      <span className="tl__icon">{e.icon && <Icon k={e.icon} size={12} />}</span>
      <div><b>{e.title}{!e.seen && <sup>{T('new', 'mới', lang)}</sup>}</b><span>{e.detail}</span></div>
      <time>{new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{e.away ? T(' · away', ' · lúc vắng', lang) : ''}</time>
    </li>)}</ol>
  </div>;
}

// ---------------- FIELD REFERENCE FOLIO (cherry-picked from Gold 3) ----------------
function ReferenceLeft({ sel, onSel, onOpenNotes, lang }: { sel: number; onSel: (i: number) => void; onOpenNotes: () => void; lang: Lang }) {
  const chapters = [...FIELD_REFERENCE_GROUPS.map((g, i) => ({ idx: i, title: lang === 'vi' ? FIELD_REFERENCE_VI[i]?.title ?? g.title : g.title, sub: T(`${g.items.length} controls`, `${g.items.length} phím`, lang), icon: i === 0 ? 'knife' : i === 1 ? 'rope' : i === 2 ? 'st:wall_wood' : i === 3 ? 'core_dragon' : 'berries' })),
    { idx: FIELD_REFERENCE_GROUPS.length, title: T('Survival Field Notes', 'Ghi chú sinh tồn', lang), sub: T(`${FIELD_NOTES.length} topics`, `${FIELD_NOTES.length} chủ đề`, lang), icon: 'blueprint' }];
  return <div className="trail">
    <p className="page__lede">{T('Controls, expedition rules, husbandry & survival field notes.', 'Phím điều khiển, luật thám hiểm, chăn nuôi và ghi chú sinh tồn.', lang)}</p>
    {chapters.map(ch => (
      <button key={ch.idx} className={`trail__row ${sel === ch.idx ? 'on' : ''}`} onClick={() => onSel(ch.idx)}>
        <span className="trail__sigil"><Icon k={ch.icon} size={14} /></span>
        <span className="trail__name"><b>{ch.title}</b><em className="state">{ch.sub}</em></span>
        <span />
      </button>
    ))}
    <div style={{ marginTop: 6 }}>
      <button className="btn sm" onClick={onOpenNotes}>{T('Open Live Notes & Mute Settings [N]', 'Mở ghi chú trực tiếp và cài đặt tắt nhắc [N]', lang)}</button>
    </div>
  </div>;
}

function ReferenceRight({ sel, onJump, lang }: { sel: number; onJump?: (t: QuickJumpTarget) => void; lang: Lang }) {
  if (sel < FIELD_REFERENCE_GROUPS.length) {
    const grp = FIELD_REFERENCE_GROUPS[sel];
    return <div className="tl" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="page__head"><span className="page__kicker">{T('CONTROLS & SYSTEMS', 'PHÍM VÀ HỆ THỐNG', lang)}</span><span className="rank">{lang === 'vi' ? FIELD_REFERENCE_VI[sel]?.title ?? grp.title : grp.title}</span></header>
      <div className="ref-list scroll">
        <div className="ref-card">
          <div className="ref-kv">
            {grp.items.map(([k, desc], i) => <div key={k} style={{ display: 'contents' }}><kbd>{k}</kbd><span>{lang === 'vi' ? FIELD_REFERENCE_VI[sel]?.items[i] ?? desc : desc}</span></div>)}
          </div>
        </div>
        {onJump && <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button className="btn sm" onClick={() => onJump('craft')}>{T('Survivor & Craft [C]', 'Balo và chế đồ [C]', lang)}</button>
          <button className="btn sm" onClick={() => onJump('build')}>{T('Build Bar [B]', 'Thanh xây [B]', lang)}</button>
          <button className="btn sm" onClick={() => onJump('map')}>{T('Field Chart [M]', 'Bản đồ [M]', lang)}</button>
        </div>}
      </div>
    </div>;
  }
  return <div className="tl" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <header className="page__head"><span className="page__kicker">{T('SURVIVAL HANDBOOK', 'SỔ TAY SINH TỒN', lang)}</span><span className="rank">{T('Field Notes', 'Ghi chú', lang)}</span></header>
    <div className="ref-list scroll">
      {FIELD_NOTES.map(n => (
        <div key={n.id} className="ref-card">
          <div className="ref-card__head"><b>{lang === 'vi' ? FIELD_NOTES_VI[n.id]?.title ?? n.title : n.title}</b><kbd>{n.keyHint}</kbd></div>
          <p>{lang === 'vi' ? FIELD_NOTES_VI[n.id]?.body ?? n.body : n.body}</p>
        </div>
      ))}
    </div>
  </div>;
}
