/**
 * The title screen's own functions (2026-11-27): how to play, backup and restore of the save, abandoning the saved
 * run without opening the game, the full-screen button, and the build line with credits.
 *
 * What these tests hold:
 *   1. a backup file is the stored save, byte for byte, plus only the entries that belong to that run;
 *   2. a file the game could not have loaded is refused before anything is written;
 *   3. a restore wins over whatever the browser holds (higher revision in both stores), and changes nothing else;
 *   4. abandoning from the title applies the engine's own `abandon`, and never re-labels a run that has already ended;
 *   5. every sentence a player reads on these panels has a Vietnamese line.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });   // each test builds and plays a real run
import { readFileSync } from 'node:fs';
import type { Input } from '../src/game/sim';
import { translateVi, VI_BOOK_ERRORS } from '../src/game/i18n-vi';
import { savedRunLine, continueLine, HELP_RULES, HELP_KEYS, HELP_TOUCH, CREDIT_LINES } from '../src/ui/pregame';
import { buildStamp } from '../src/ui/build-info';
import { BACKUP_FORMAT, BACKUP_MAX_CHARS, backupFileName, backupProblemLine, isSideKey, type BackupProblem } from '../src/game/backup';

const T0 = Date.UTC(2026, 10, 27, 9), PLAYED = 3000;
const NO_INPUT = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false } as unknown as Input;
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/** A new run played for a few seconds, as the title screen would find it. */
async function playedRun() {
  const { newGame, startRun } = await import('../src/game/engine');
  const { tick } = await import('../src/game/sim');
  const { setActiveLayout } = await import('../src/game/world');
  const { U05_WORLD_LAYOUT_ID } = await import('../src/veyra05/scenes');
  setActiveLayout(U05_WORLD_LAYOUT_ID);
  const gs = newGame(); startRun(gs, 'female', T0, null, 5);
  for (let ms = 0; ms < PLAYED; ms += 50) tick(gs, NO_INPUT, 50, T0 + ms + 50);
  return gs;
}
function fakeStorage(entries: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(entries));
  return { map, get length() { return map.size; }, key: (i: number) => [...map.keys()][i] ?? null, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
}
function fakeIDB() {
  const state: { value: string | null } = { value: null };
  const self = { failWrites: false };
  const database = { transaction: () => {
    const tx: any = { objectStore: () => ({
      get: () => { const rq: any = {}; queueMicrotask(() => { rq.result = state.value; rq.onsuccess?.(); }); return rq; },
      put: (v: string) => { queueMicrotask(() => { if (self.failWrites) { tx.onabort?.(); return; } state.value = v; tx.oncomplete?.(); }); },
      delete: () => { queueMicrotask(() => { state.value = null; tx.oncomplete?.(); }); },
    }) };
    return tx;
  } };
  return { state, get failWrites() { return self.failWrites; }, set failWrites(v: boolean) { self.failWrites = v; }, indexedDB: { open: () => { const rq: any = { result: database }; queueMicrotask(() => rq.onsuccess?.()); return rq; } } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('backup file', () => {
  it('holds the stored save byte for byte, and only the entries of that run', async () => {
    const { serializeSnapshot } = await import('../src/game/persist');
    const { makeBackup, readBackup } = await import('../src/game/backup');
    const gs = await playedRun(); const id = gs.run!.id, saveText = serializeSnapshot(gs);
    const store = fakeStorage({
      'soh.state.v3': saveText,
      'soh.journey.v1': '{"j":1}',
      [`soh.field-notes.v1:${id}`]: '["note"]',
      [`soh.return-history.v1:${id}`]: '[]',
      [`soh.map-dest.v1:${id}:veyra`]: '{"x":1}',
      [`soh.map-notes.v1:${id}:veyra:0`]: '[{"t":"camp"}]',
      'soh.field-notes.v1:run_someone_else': '["not mine"]',
      [`soh.field-notes.v1:${id}x`]: '["a longer id that only starts the same"]',
      'soh.lang.v1': 'vi', 'soh.visual.v1': '{}', 'unrelated': 'x',
    });
    const text = makeBackup(saveText, id, store, T0 + 9000, '2026-11-27 05:00 UTC');
    const file = JSON.parse(text);
    expect(file.format).toBe(BACKUP_FORMAT); expect(file.save).toBe(saveText); expect(file.madeAt).toBe(T0 + 9000);
    expect(Object.keys(file.side).sort()).toEqual(['soh.journey.v1', `soh.field-notes.v1:${id}`, `soh.map-dest.v1:${id}:veyra`, `soh.map-notes.v1:${id}:veyra:0`, `soh.return-history.v1:${id}`].sort());

    const back = readBackup(text);
    expect(back.ok).toBe(true); if (!back.ok) return;
    expect(back.saveText).toBe(saveText); expect(back.madeAt).toBe(T0 + 9000);
    expect(back.gs.run!.id).toBe(id); expect(back.gs.revision).toBe(gs.revision);
    expect(back.side).toEqual(file.side);
    // The text of the storage entry alone, with no wrapper, is a backup too.
    const bare = readBackup(saveText);
    expect(bare.ok && bare.saveText === saveText && bare.madeAt === null && Object.keys(bare.side).length === 0).toBe(true);
    // A file cannot plant entries the game does not keep beside this run.
    const planted = readBackup(JSON.stringify({ ...file, side: { ...file.side, 'soh.lang.v1': 'en', 'soh.state.v3': 'x', 'soh.field-notes.v1:run_someone_else': '[]', [`soh.field-notes.v1:${id}`]: 7 } }));
    expect(planted.ok && Object.keys(planted.side).sort()).toEqual(Object.keys(file.side).filter(k => k !== `soh.field-notes.v1:${id}`).sort());
  });

  it('refuses a file the game could not have loaded, and says why', async () => {
    const { serializeSnapshot } = await import('../src/game/persist');
    const { makeBackup, readBackup } = await import('../src/game/backup');
    const gs = await playedRun(); const saveText = serializeSnapshot(gs);
    const good = JSON.parse(makeBackup(saveText, gs.run!.id, null, T0, ''));
    const problem = (text: string) => { const r = readBackup(text); return r.ok ? 'accepted' : r.problem; };
    expect(problem('this is not json')).toBe('unreadable');
    expect(problem('[1,2,3]')).toBe('unreadable');
    expect(problem('null')).toBe('unreadable');
    expect(problem(JSON.stringify({ hello: 'world' }))).toBe('not-a-save');
    expect(problem(JSON.stringify({ format: BACKUP_FORMAT, side: {} }))).toBe('not-a-save');
    expect(problem(JSON.stringify({ ...good, save: saveText.slice(0, saveText.length >> 1) }))).toBe('not-a-save');
    // one figure changed by hand: the checksum no longer matches
    const envelope = JSON.parse(saveText); expect(envelope.payload).toContain('"securedCash":0');
    const edited = { ...envelope, payload: envelope.payload.replace('"securedCash":0', '"securedCash":999999') };
    expect(problem(JSON.stringify({ ...good, save: JSON.stringify(edited) }))).toBe('not-a-save');
    // made by a later version of the game
    expect(problem(JSON.stringify({ ...good, save: JSON.stringify({ version: 99, revision: 1 }) }))).toBe('newer');
    expect(problem('x'.repeat(BACKUP_MAX_CHARS + 1))).toBe('too-large');
    expect(problem(JSON.stringify(good))).toBe('accepted');
  });

  it('names the file by local date and time, and has a Vietnamese line for every refusal', () => {
    expect(backupFileName(new Date(2026, 10, 7, 9, 5).getTime())).toBe('soul-of-hero-save-2026-11-07-0905.json');
    const lines = (['too-large', 'unreadable', 'newer', 'not-a-save'] as BackupProblem[]).map(backupProblemLine);
    expect(new Set(lines).size).toBe(4);
    for (const line of lines) expect(translateVi(line), line).not.toBe(line);
  });

  it('counts an entry as belonging to a run only on the exact run id', () => {
    expect(isSideKey('soh.journey.v1', null)).toBe(true);
    expect(isSideKey('soh.field-notes.v1:run_a', null)).toBe(false);
    expect(isSideKey('soh.field-notes.v1:run_a', 'run_a')).toBe(true);
    expect(isSideKey('soh.map-notes.v1:run_a:veyra:0', 'run_a')).toBe(true);
    expect(isSideKey('soh.field-notes.v1:run_ab', 'run_a')).toBe(false);
    expect(isSideKey('soh.state.v3', 'run_a')).toBe(false);
    expect(isSideKey('soh.lang.v1', 'run_a')).toBe(false);
  });
});

describe('restore', () => {
  it('wins over a later save in the browser, in both stores, and the run comes back as it was backed up', async () => {
    const local = fakeStorage(), idb = fakeIDB(); vi.stubGlobal('localStorage', local); vi.stubGlobal('indexedDB', idb.indexedDB);
    const p = await import('../src/game/persist');
    const { makeBackup, readBackup } = await import('../src/game/backup');
    const { abandonSavedRun } = await import('../src/game/title-actions');
    const gs = await playedRun(); const id = gs.run!.id;
    expect(await p.save(gs)).toBe(true);
    const backup = makeBackup(p.serializeSnapshot(gs), id, local, T0 + PLAYED, '');
    const hungerThen = gs.run!.player.hunger, revisionThen = gs.revision;
    // afterwards the run is abandoned and saved: the browser now holds a later state with no run
    expect(abandonSavedRun(gs, T0 + PLAYED + 1000)).toEqual({ ok: true, ending: 'abandoned' });
    expect(await p.save(gs)).toBe(true);
    const later = (await p.load()).gs!; expect(later.run).toBeNull(); expect(later.revision).toBeGreaterThan(revisionThen);

    const file = readBackup(backup); expect(file.ok).toBe(true); if (!file.ok) return;
    const out = await p.restoreSnapshot(file.saveText, later.revision);
    expect(out.ok).toBe(true); expect(out.revision).toBe(later.revision + 1); expect(out.localStatus).toBe('ok'); expect(out.idbStatus).toBe('ok');
    expect(local.getItem('soh.state.v3')).toBe(idb.state.value);
    const restored = (await p.load()).gs!;
    expect(restored.run!.id).toBe(id); expect(restored.run!.player.hunger).toBe(hungerThen);
    expect(restored.profile.history.length).toBe(0); expect(restored.revision).toBe(later.revision + 1);
    // apart from the revision, the restored state is the backed-up state
    const strip = (text: string) => { const s = JSON.parse(JSON.parse(text).payload); delete s.revision; return JSON.stringify(s); };
    expect(strip(idb.state.value!)).toBe(strip(file.saveText));
  });

  it('writes nothing when the text is not a save', async () => {
    const local = fakeStorage({ 'soh.state.v3': 'what was there' }), idb = fakeIDB(); idb.state.value = 'what was there';
    vi.stubGlobal('localStorage', local); vi.stubGlobal('indexedDB', idb.indexedDB);
    const p = await import('../src/game/persist');
    for (const text of ['nonsense', '{}', JSON.stringify({ format: 'soh-snapshot-v1', payload: '{"revision":3}', checksum: '00000000' }), JSON.stringify({ revision: 4 })]) {
      const out = await p.restoreSnapshot(text, 10);
      expect(out.ok, text).toBe(false); expect(out.localStatus).toBe('skipped'); expect(out.idbStatus).toBe('skipped');
    }
    expect(local.getItem('soh.state.v3')).toBe('what was there'); expect(idb.state.value).toBe('what was there');
  });
});

describe('restore, the cases a browser walk had not covered (round 14)', () => {
  it('puts the backed-up run in place of a different, newer run, and brings back the notes of the backed-up run only', async () => {
    const local = fakeStorage(), idb = fakeIDB(); vi.stubGlobal('localStorage', local); vi.stubGlobal('indexedDB', idb.indexedDB);
    const p = await import('../src/game/persist');
    const { makeBackup, readBackup, writeSide } = await import('../src/game/backup');
    const { abandonSavedRun } = await import('../src/game/title-actions');
    const { startRun } = await import('../src/game/engine');
    const gs = await playedRun(); const first = gs.run!.id;
    local.setItem(`soh.field-notes.v1:${first}`, 'notes of the first run');
    expect(await p.save(gs)).toBe(true);
    const backup = makeBackup(p.serializeSnapshot(gs), first, local, T0 + PLAYED, '');
    // the first run is abandoned, a second run is started and saved, with notes of its own
    expect(abandonSavedRun(gs, T0 + PLAYED + 1000).ok).toBe(true);
    expect(startRun(gs, 'male', T0 + PLAYED + 2000, null, 6).ok).toBe(true);
    const second = gs.run!.id; expect(second).not.toBe(first);
    local.removeItem(`soh.field-notes.v1:${first}`); local.setItem(`soh.field-notes.v1:${second}`, 'notes of the second run');
    expect(await p.save(gs)).toBe(true);
    const held = (await p.load()).gs!; expect(held.run!.id).toBe(second);

    const file = readBackup(backup); expect(file.ok).toBe(true); if (!file.ok) return;
    const out = await p.restoreSnapshot(file.saveText, held.revision);
    expect(out.ok).toBe(true);
    expect(writeSide(file.side, local)).toBe(0);
    const restored = (await p.load()).gs!;
    expect(restored.run!.id).toBe(first); expect(restored.run!.character).toBe('female');
    // the profile is the one in the file too: the abandoned first run is not in its history
    expect(restored.profile.history.length).toBe(0);
    expect(local.getItem(`soh.field-notes.v1:${first}`)).toBe('notes of the first run');
    // the second run's notes are left alone (they belong to a run that no longer exists, and are never read again)
    expect(local.getItem(`soh.field-notes.v1:${second}`)).toBe('notes of the second run');
  });

  it('still restores when one of the two stores is full, and the restored state is the one that loads', async () => {
    const local = fakeStorage(), idb = fakeIDB(); vi.stubGlobal('localStorage', local); vi.stubGlobal('indexedDB', idb.indexedDB);
    const p = await import('../src/game/persist');
    const { makeBackup, readBackup, writeSide } = await import('../src/game/backup');
    const { abandonSavedRun } = await import('../src/game/title-actions');
    const gs = await playedRun(); const id = gs.run!.id;
    local.setItem(`soh.field-notes.v1:${id}`, 'notes');
    expect(await p.save(gs)).toBe(true);
    const backup = makeBackup(p.serializeSnapshot(gs), id, local, T0 + PLAYED, '');
    expect(abandonSavedRun(gs, T0 + PLAYED + 1000).ok).toBe(true); expect(await p.save(gs)).toBe(true);
    const held = (await p.load()).gs!; const before = local.getItem('soh.state.v3');
    // from here on the small store refuses every write, as a full localStorage does
    local.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    const file = readBackup(backup); expect(file.ok).toBe(true); if (!file.ok) return;
    const out = await p.restoreSnapshot(file.saveText, held.revision);
    expect(out.ok).toBe(true); expect(out.localStatus).toBe('local-write'); expect(out.idbStatus).toBe('ok');
    expect(local.getItem('soh.state.v3')).toBe(before);           // the small store still holds the older state …
    expect((await p.load()).gs!.run!.id).toBe(id);                // … and the restored one, being newer, is what loads
    expect(writeSide(file.side, local)).toBe(Object.keys(file.side).length);   // the notes could not be stored; the player is told
    expect(Object.keys(file.side).length).toBeGreaterThan(0);
  });

  it('changes nothing and says so when neither store can be written', async () => {
    const local = fakeStorage(), idb = fakeIDB(); vi.stubGlobal('localStorage', local); vi.stubGlobal('indexedDB', idb.indexedDB);
    const p = await import('../src/game/persist');
    const { makeBackup, readBackup } = await import('../src/game/backup');
    const { abandonSavedRun } = await import('../src/game/title-actions');
    const gs = await playedRun(); const id = gs.run!.id;
    expect(await p.save(gs)).toBe(true);
    const backup = makeBackup(p.serializeSnapshot(gs), id, local, T0 + PLAYED, '');
    expect(abandonSavedRun(gs, T0 + PLAYED + 1000).ok).toBe(true); expect(await p.save(gs)).toBe(true);
    const held = (await p.load()).gs!; const localBefore = local.getItem('soh.state.v3'), idbBefore = idb.state.value;
    local.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    idb.failWrites = true;
    const file = readBackup(backup); expect(file.ok).toBe(true); if (!file.ok) return;
    const out = await p.restoreSnapshot(file.saveText, held.revision);
    expect(out.ok).toBe(false); expect(out.revision).toBeNull();
    expect(local.getItem('soh.state.v3')).toBe(localBefore); expect(idb.state.value).toBe(idbBefore);
    expect((await p.load()).gs!.run).toBeNull();                  // the browser still holds what it held
    // App.tsx shows this line for that outcome
    expect(read('../src/App.tsx')).toContain("'The backup could not be written to this browser. Your save is unchanged.'");
    expect(translateVi('The backup could not be written to this browser. Your save is unchanged.')).toBeTruthy();
  });
});

describe('abandon from the title', () => {
  it('ends the run as "abandoned" by the engine\'s own command and keeps the profile', async () => {
    const { abandonSavedRun } = await import('../src/game/title-actions');
    const gs = await playedRun(); const id = gs.run!.id; gs.profile.securedCash = 0;
    const out = abandonSavedRun(gs, T0 + PLAYED + 2000);
    expect(out).toEqual({ ok: true, ending: 'abandoned' });
    expect(gs.run).toBeNull(); expect(gs.profile.history[0].ending).toBe('abandoned'); expect(gs.profile.history.length).toBe(1);
    expect(gs.profile.humanRunHistory?.[0]).toMatchObject({ runId: id, ending: 'abandoned' });
    // nothing left to abandon: a second call changes nothing
    const before = JSON.stringify(gs.profile.history);
    expect(abandonSavedRun(gs, T0 + PLAYED + 3000)).toEqual({ ok: false, reason: 'No active run.' });
    expect(JSON.stringify(gs.profile.history)).toBe(before);
  });

  it('gives the same ending as the Esc menu does at the same moment', async () => {
    const { abandonSavedRun } = await import('../src/game/title-actions');
    const { dispatch } = await import('../src/game/engine');
    const { settleWithReturn } = await import('../src/game/return-report');
    const now = T0 + PLAYED + 2000;
    const fromTitle = await playedRun(); abandonSavedRun(fromTitle, now);
    const fromMenu = await playedRun(); settleWithReturn(fromMenu, now); expect(dispatch(fromMenu, { id: 'abandon-menu', type: 'abandon' } as never, now).ok).toBe(true);
    const record = (g: typeof fromTitle) => { const { runId: _a, ...rest } = g.profile.history[0] as any; return JSON.stringify({ ...rest, id: undefined, startedAt: undefined }); };
    expect(fromTitle.profile.history[0].ending).toBe(fromMenu.profile.history[0].ending);
    expect(JSON.parse(record(fromTitle)).score).toEqual(JSON.parse(record(fromMenu)).score);
    expect(fromTitle.profile.securedCash).toBe(fromMenu.profile.securedCash);
  });

  it('after forty minutes away, works out the absence first and then ends the run at that moment (round 14)', async () => {
    const { abandonSavedRun } = await import('../src/game/title-actions');
    const { dispatch } = await import('../src/game/engine');
    const { settleWithReturn } = await import('../src/game/return-report');
    const now = T0 + PLAYED + 40 * 60_000;
    const fromTitle = await playedRun(); const id = fromTitle.run!.id;
    expect(abandonSavedRun(fromTitle, now)).toEqual({ ok: true, ending: 'abandoned' });
    expect(fromTitle.run).toBeNull();
    expect(fromTitle.profile.history[0]).toMatchObject({ runId: id, ending: 'abandoned', endedAt: now });
    // the same forty minutes, then the Esc menu's command: the same record of what became of the islanders
    const fromMenu = await playedRun(); settleWithReturn(fromMenu, now);
    expect(dispatch(fromMenu, { id: 'abandon-menu-40m', type: 'abandon' } as never, now).ok).toBe(true);
    expect(fromTitle.profile.humanRunHistory![0].outcomes).toEqual(fromMenu.profile.humanRunHistory![0].outcomes);
    expect(fromTitle.profile.history[0].score).toEqual(fromMenu.profile.history[0].score);
  }, 900_000);   // two absences are worked out here, with no regions compiled ahead

  it('is wired on the title screen behind a second, explicit confirmation', () => {
    const title = read('../src/ui/Title.tsx'), panels = read('../src/ui/TitlePanels.tsx'), app = read('../src/App.tsx');
    expect(title).toContain(">Abandon this run…</button>");
    expect(title).toContain("openAbandon('menu')");
    expect(panels).toContain('>Confirm abandon</button>');
    expect(panels).toContain('This cannot be undone.');
    // the confirm button is not the default action of the panel: Enter must not abandon a run
    expect(/<button[^>]*data-primary[^>]*>Confirm abandon/.test(panels)).toBe(false);
    expect(app).toContain("resume('abandon')");
    expect(app).toContain('abandonSavedRun(');
  });
});

describe('what the title screen says', () => {
  it('tells an expired run from a live one under Continue', () => {
    expect(savedRunLine(30, 96 * 60000)).toBe(continueLine(30, 96 * 60000));
    expect(savedRunLine(14 * 24, 3 * 3600000)).toContain('The 14 days have run out');
    expect(savedRunLine(14 * 24 - 0.01, 0)).not.toContain('run out');
    expect(translateVi(savedRunLine(14 * 24 + 5, 3 * 3600000))).not.toContain('have run out');
  });

  it('shows the build as date and commit, and nothing at all when the build carries no stamp', () => {
    expect(buildStamp({ at: '2026-11-27T05:00:41.000Z', commit: 'd78a36d' })).toBe('2026-11-27 05:00 UTC · d78a36d');
    expect(buildStamp({ at: '2026-11-27T05:00:41.000Z', commit: '' })).toBe('2026-11-27 05:00 UTC');
    expect(buildStamp({ at: '', commit: 'd78a36d' })).toBe('');
    expect(buildStamp()).toMatch(/^$|^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC( · [0-9a-f]{7,12})?$/);
    expect(translateVi('Build 2026-11-27 05:00 UTC · d78a36d')).toBe('Bản dựng 2026-11-27 05:00 UTC · d78a36d');
  });

  it('names keys the game really listens to', () => {
    const game = read('../src/ui/Game.tsx');
    for (const key of ["'Tab'", "'Escape'", "'KeyI'", "'KeyC'", "'KeyB'", "'KeyM'", "'KeyJ'", "'KeyN'", "'KeyE'", "'Space'"]) expect(game, key).toContain(key);
    expect(HELP_KEYS.map(([key]) => key)).toEqual(['W A S D', 'Mouse', 'Left button', 'Space', 'E', '1–8', 'I', 'C', 'B', 'M', 'J', 'N', 'Tab', 'Esc']);
  });

  it('has a Vietnamese line for every sentence on the new panels', () => {
    expect(VI_BOOK_ERRORS).toEqual([]);
    const fixed = [
      ...HELP_RULES, ...HELP_TOUCH, ...CREDIT_LINES, ...HELP_KEYS.map(([, what]) => what), 'Mouse', 'Left button',
      'How to play', 'Saved game', 'Full screen', 'Leave full screen', 'Abandon this run…', 'Abandon this run?', 'One run at a time.',
      'The 14 days', 'Keyboard and mouse', 'Touch screen', 'About this game',
      'Download a backup file', 'Restore from a backup file…', 'Replace my save with this backup', 'Backup restored.',
      'In this browser', 'In the backup file', 'No run in progress.', 'This cannot be undone.', 'Ending the run…',
      'RUN CHRONICLE · THE RUN HAS ENDED',
    ];
    for (const line of fixed) expect(translateVi(line), line).not.toBe(line);
    // and each of those is really on the screen (a phrase nobody shows proves nothing)
    const shown = read('../src/ui/Title.tsx') + read('../src/ui/TitlePanels.tsx') + read('../src/App.tsx') + read('../src/ui/pregame.ts');
    for (const line of fixed) expect(shown.includes(line), line).toBe(true);
  });

  it('keeps what earlier screens and scripts rely on', () => {
    const title = read('../src/ui/Title.tsx');
    for (const needle of ['{`Continue — ${heroName(run.character)}`}', '>New run</button>', '>Begin the 14 days</button>', '>Profile &amp; history</button>', 'Full-Gear QA Sandbox [F9]', 'Creator Inspector · world viewer']) expect(title, needle).toContain(needle);
  });
});
