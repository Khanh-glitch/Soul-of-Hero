// ============================================================================
// TitlePanels: the three panels the title screen gained with its "home"
// functions.
//   HelpPanel     how a run works, the controls, who made what, which build
//   SavePanel     the save as a file: download a backup, restore one
//   AbandonPanel  end the run in progress without opening the game
// They own no game rule. Backup reading and writing is game/backup.ts and
// game/persist.ts; abandoning is game/title-actions.ts, driven by App.
// ============================================================================
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BAL, type GameState } from '../game/core';
import { runHours } from '../game/engine';
import { serializeSnapshot } from '../game/persist';
import { BACKUP_MAX_CHARS, backupFileName, backupProblemLine, makeBackup, readBackup, type ReadBackup } from '../game/backup';
import { isTouchDevice } from '../visual/direction';
import { buildStamp } from './build-info';
import { CREDIT_LINES, HELP_KEYS, HELP_RULES, HELP_TOUCH, savedRunLine } from './pregame';

export type GoodBackup = Extract<ReadBackup, { ok: true }>;

const DAYS = Math.round(BAL.run.maxRunHours / 24);
const heroName = (h: string) => (h === 'female' ? 'Adventurer ♀' : 'Adventurer ♂');
const heading = (text: string) => <div className="lbl" style={{ fontSize: 11, color: 'var(--brassLit)', marginTop: 6 }}>{text}</div>;

function Shell({ title, onBack, children, style, label }: { title: string; onBack: () => void; children: ReactNode; style: React.CSSProperties; label?: string }) {
  return <div className="panel absolute fadein" role="region" aria-label={label ?? title} style={{ padding: 10, display: 'flex', flexDirection: 'column', ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flex: 'none', marginBottom: 2 }}>
      <div className="panel-h">{title}</div>
      <button data-primary className="btn" style={{ fontSize: 12, padding: '4px 12px 5px', flex: 'none' }} onClick={onBack}>Back</button>
    </div>
    {children}
  </div>;
}

/** Panels end above this line of the 640 × 360 stage: the strip under it belongs to the small-window notice. */
const PANEL_BOTTOM = 314;

/** The scrolling body of a panel. While something lies under its lower edge a "More below" bar sits on that edge
 *  (the same bar the station console uses), so a cut-off line is never the only sign that there is more. */
function ScrollBody({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null); const [more, setMore] = useState(false);
  const check = () => { const el = ref.current; if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 6); };
  useEffect(check);
  return <div ref={ref} className="scroll" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingRight: 3 }} onScroll={check}>
    {children}
    {more && <button type="button" className="scroll-more" onClick={() => ref.current?.scrollTo({ top: ref.current.scrollHeight })}>More below</button>}
  </div>;
}

/** Whether the saved run has used up its days (it can only be opened to see how it ended). */
export const runIsOver = (run: NonNullable<GameState['run']>, now: number) => runHours(run, now) >= BAL.run.maxRunHours;

/** One state in two short lines: the run (or that there is none), then what the profile holds. */
function SaveSummary({ gs, now }: { gs: GameState; now: number }) {
  const run = gs.run;
  return <div style={{ fontSize: 12, lineHeight: 1.25 }}>
    {run
      ? <div><span>{heroName(run.character)}</span><span data-notr> · </span><span>{savedRunLine(runHours(run, now), now - run.clock.lastSimAt, DAYS)}</span></div>
      : <div>No run in progress.</div>}
    <div style={{ color: 'var(--muted)', fontSize: 11 }}>{`Secured Ragnarok cash: ${gs.profile.securedCash} · finished runs: ${gs.profile.history.length}`}</div>
  </div>;
}

// ---------------------------------------------------------------------------------------------------------------------
export function HelpPanel({ onBack }: { onBack: () => void }) {
  const touch = isTouchDevice();
  const stamp = buildStamp();
  const keys = <div>
    {heading('Keyboard and mouse')}
    <div className="help-keys">{HELP_KEYS.map(([key, what]) => <div key={key} className="help-key"><kbd data-notr={/^[A-Z0-9 –]+$|^Esc$|^Tab$/.test(key) ? true : undefined}>{key}</kbd><span>{what}</span></div>)}</div>
  </div>;
  const fingers = <div>
    {heading('Touch screen')}
    <ul className="help-list">{HELP_TOUCH.map(line => <li key={line}>{line}</li>)}</ul>
  </div>;
  // A device with no touch screen is shown the keys only; one with a touch screen is shown its own controls first.
  return <Shell title="How to play" onBack={onBack} style={{ left: 30, top: 24, width: 580, maxHeight: PANEL_BOTTOM - 24 }}>
    <ScrollBody>
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 12 }}>
        <div>
          {heading('The 14 days')}
          <ol className="help-list help-list--num">{HELP_RULES.map(line => <li key={line}>{line}</li>)}</ol>
        </div>
        <div>{touch ? <>{fingers}{keys}</> : keys}</div>
      </div>
      <div className="rule" style={{ margin: '6px 0 2px' }} />
      {heading('About this game')}
      <div style={{ fontSize: 10, lineHeight: 1.25, color: 'var(--muted)' }}>
        {stamp && <div data-testid="build-stamp">{`Build ${stamp}`}</div>}
        {CREDIT_LINES.map(line => <div key={line}>{line}</div>)}
      </div>
    </ScrollBody>
  </Shell>;
}

// ---------------------------------------------------------------------------------------------------------------------
type Line = { tone: 'ok' | 'bad'; text: string };

export function SavePanel({ gs, lang, onBack, onAbandon, onRestore, click }: {
  gs: GameState; lang: 'en' | 'vi'; onBack: () => void; onAbandon: () => void;
  onRestore: (backup: GoodBackup) => Promise<string | null>; click: () => void;
}) {
  const [line, setLine] = useState<Line | null>(null);
  const [picked, setPicked] = useState<{ backup: GoodBackup; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const now = Date.now();
  // Day first, then the time on a 24-hour clock, in the language chosen in the game: "27/11/2026 05:03".
  const when = (at: number) => { const d = new Date(at), tag = lang === 'vi' ? 'vi-VN' : 'en-GB'; return `${d.toLocaleDateString(tag)} ${d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', hour12: false })}`; };

  const download = () => {
    click();
    try {
      const at = Date.now(), name = backupFileName(at);
      let store: Storage | null = null; try { store = window.localStorage; } catch { store = null; }
      const text = makeBackup(serializeSnapshot(gs), gs.run?.id ?? null, store, at, buildStamp());
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setLine({ tone: 'ok', text: `Backup file made: ${name}. Look in the downloads folder of this device.` });
    } catch { setLine({ tone: 'bad', text: 'The backup file could not be made.' }); }
  };

  const choose = async (f: File | undefined) => {
    if (!f) return;
    setLine(null); setPicked(null);
    if (f.size > BACKUP_MAX_CHARS) { setLine({ tone: 'bad', text: backupProblemLine('too-large') }); return; }
    let text: string;
    try { text = await f.text(); } catch { setLine({ tone: 'bad', text: backupProblemLine('unreadable') }); return; }
    const read = readBackup(text);
    if (!read.ok) { setLine({ tone: 'bad', text: backupProblemLine(read.problem) }); return; }
    setPicked({ backup: read, name: f.name });
  };

  const restore = async () => {
    if (!picked || busy) return;
    click(); setBusy(true);
    const problem = await onRestore(picked.backup);
    if (problem !== null) { setBusy(false); setLine({ tone: 'bad', text: problem }); }   // on success the page reloads
  };

  return <Shell title="Saved game" onBack={onBack} style={{ left: 100, top: 8, width: 430, maxHeight: PANEL_BOTTOM - 8 }}>
    <ScrollBody>
      {/* While a restore waits for its answer the general note steps aside, so the two buttons are on the screen without scrolling. */}
      {!picked && <div style={{ fontSize: 11, lineHeight: 1.25, color: 'var(--muted)' }}>The save is kept in this browser only. Clearing the data of this browser deletes it; a backup file does not depend on the browser.</div>}
      {heading('In this browser now')}
      <SaveSummary gs={gs} now={now} />

      {picked ? <div className="save-confirm" role="alertdialog" aria-label="Replace the save with this backup?">
        {heading('In the backup file')}
        <div data-notr style={{ fontSize: 10, color: 'var(--muted)', overflowWrap: 'anywhere' }}>{picked.name}</div>
        <SaveSummary gs={picked.backup.gs} now={now} />
        {picked.backup.madeAt !== null && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{`Backup made: ${when(picked.backup.madeAt)}`}</div>}
        <div style={{ fontSize: 11, lineHeight: 1.25, color: 'var(--warn)', marginTop: 5 }}>Restoring replaces the save in this browser with the backup. This cannot be undone: download a backup of the current save first if you may want it back.</div>
        {picked.backup.gs.run && <div style={{ fontSize: 11, lineHeight: 1.25, marginTop: 3 }}>The run clock is real time: the restored run continues from now, as if you had been away since the backup was made.</div>}
        <div className="flex gap-1" style={{ marginTop: 6 }}>
          <button className="btn danger" disabled={busy} style={{ fontSize: 12 }} onClick={() => { void restore(); }}>{busy ? 'Restoring…' : 'Replace my save with this backup'}</button>
          <button className="btn ghost" disabled={busy} style={{ fontSize: 12 }} onClick={() => { click(); setPicked(null); }}>Cancel</button>
        </div>
      </div> : <>
        {heading('Backup file')}
        <div className="flex flex-wrap gap-1" style={{ marginTop: 3 }}>
          <button className="btn" style={{ fontSize: 12 }} onClick={download}>Download a backup file</button>
          <button className="btn" style={{ fontSize: 12 }} onClick={() => { click(); file.current?.click(); }}>Restore from a backup file…</button>
          <input ref={file} type="file" accept=".json,application/json" data-testid="backup-file" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void choose(f); }} />
        </div>
        <div style={{ fontSize: 10, lineHeight: 1.25, color: 'var(--muted)', marginTop: 4 }}>A backup holds the run, the profile and your map notes. Sound, screen and language settings stay with each device.</div>
      </>}
      {line && <div role={line.tone === 'bad' ? 'alert' : 'status'} className="save-line" style={{ color: line.tone === 'bad' ? 'var(--warn)' : 'var(--good, #9ad98a)' }}>{line.text}</div>}

      {gs.run && !picked && <>
        {heading('Run in progress')}
        {runIsOver(gs.run, now)
          ? <div style={{ fontSize: 11, lineHeight: 1.25 }}>The 14 days of this run are over. Continue to see how it ended.</div>
          : <div className="flex items-center gap-2" style={{ marginTop: 3 }}>
              <button className="btn danger" style={{ fontSize: 12, flex: 'none' }} onClick={() => { click(); onAbandon(); }}>Abandon this run…</button>
              <span style={{ fontSize: 10, lineHeight: 1.2, color: 'var(--muted)' }}>Ends the run without opening the game. You are asked once more.</span>
            </div>}
      </>}
    </ScrollBody>
  </Shell>;
}

// ---------------------------------------------------------------------------------------------------------------------
export function AbandonPanel({ gs, onBack, onConfirm }: { gs: GameState; onBack: () => void; onConfirm: () => void }) {
  const run = gs.run; const now = Date.now();
  if (!run) return null;
  const away = now - run.clock.lastSimAt;
  return <Shell title="Abandon this run?" onBack={onBack} style={{ left: 140, top: 60, width: 360 }}>
    <div style={{ marginTop: 4 }}><SaveSummary gs={gs} now={now} /></div>
    <div style={{ fontSize: 12, lineHeight: 1.25, color: 'var(--warn)', marginTop: 6 }}>Abandon wipes all run items, home and unsecured cash.</div>
    <div style={{ fontSize: 11, lineHeight: 1.25, marginTop: 3 }}>Secured cash, achievements and the run history stay in your profile. The run is listed there as abandoned.</div>
    {away >= 120000 && <div style={{ fontSize: 11, lineHeight: 1.25, marginTop: 3, color: 'var(--muted)' }}>The time you were away is worked out first, as for Continue; then the run ends.</div>}
    <div className="rule" style={{ margin: '8px 0 6px' }} />
    <div className="flex justify-between items-center">
      <span style={{ fontSize: 10, color: 'var(--muted)' }}>This cannot be undone.</span>
      <button className="btn danger" style={{ fontSize: 12 }} onClick={onConfirm}>Confirm abandon</button>
    </div>
  </Shell>;
}
