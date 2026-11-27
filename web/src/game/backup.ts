// ============================================================================
// backup: the save as a file the player can keep outside the browser, and the
// way back in (title screen → Saved game).
//
// The save itself lives in the browser's storage only. A backup file holds
//   - the snapshot exactly as stored (same envelope, same checksum), and
//   - the few things that belong to the run but are kept beside the save in
//     localStorage: map notes, the chosen destination, field notes, the list
//     of earlier returns, and the journey ledger.
// Language, screen and sound settings are not included: they belong to the
// device, not to the run.
//
// Reading a backup uses the same reader as a page load (selectSnapshots), so a
// file is accepted exactly when the game could have loaded it. A bare snapshot
// (the text of the storage entry, with no wrapper) is accepted as well.
//
// Nothing here changes a game rule. In particular the run clock is real time:
// a restored run continues from now, as if the player had been away since the
// backup was made.
// ============================================================================
import type { GameState } from './core';
import { selectSnapshots } from './persist';

export const BACKUP_FORMAT = 'soh-backup-v1';
/** Files larger than this are not read at all (a save is at most a few megabytes). */
export const BACKUP_MAX_CHARS = 32_000_000;
const SIDE_VALUE_MAX = 2_000_000;

const PER_RUN = ['soh.field-notes.v1:', 'soh.map-dest.v1:', 'soh.map-notes.v1:', 'soh.return-history.v1:'] as const;
const WHOLE = ['soh.journey.v1'] as const;

/** Is `key` one of the storage entries kept beside the save for the run `runId` (or for no run at all)? */
export function isSideKey(key: string, runId: string | null): boolean {
  if ((WHOLE as readonly string[]).includes(key)) return true;
  if (!runId) return false;
  return PER_RUN.some(prefix => key === prefix + runId || key.startsWith(prefix + runId + ':'));
}

type ReadableStore = Pick<Storage, 'length' | 'key' | 'getItem'>;

/** The text of a backup file for the snapshot `saveText` (as returned by serializeSnapshot). */
export function makeBackup(saveText: string, runId: string | null, store: ReadableStore | null, madeAt: number, build: string): string {
  const side: Record<string, string> = {};
  if (store) {
    try {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i); if (!key || !isSideKey(key, runId)) continue;
        const value = store.getItem(key); if (typeof value === 'string' && value.length <= SIDE_VALUE_MAX) side[key] = value;
      }
    } catch { /* storage refused: the backup still holds the save */ }
  }
  return JSON.stringify({ format: BACKUP_FORMAT, madeAt, build, save: saveText, side });
}

export type BackupProblem = 'too-large' | 'unreadable' | 'newer' | 'not-a-save';
export type ReadBackup =
  | { ok: true; saveText: string; side: Record<string, string>; madeAt: number | null; gs: GameState }
  | { ok: false; problem: BackupProblem };

/** Check a file's text. On success `gs` is the state it holds (for the summary shown before the player confirms). */
export function readBackup(text: string): ReadBackup {
  if (typeof text !== 'string' || text.length > BACKUP_MAX_CHARS) return { ok: false, problem: 'too-large' };
  let outer: any;
  try { outer = JSON.parse(text); } catch { return { ok: false, problem: 'unreadable' }; }
  if (outer === null || typeof outer !== 'object' || Array.isArray(outer)) return { ok: false, problem: 'unreadable' };
  const wrapped = outer.format === BACKUP_FORMAT;
  if (wrapped && typeof outer.save !== 'string') return { ok: false, problem: 'not-a-save' };
  const saveText: string = wrapped ? outer.save : text;
  const picked = selectSnapshots([saveText]);
  if (picked.unsupported) return { ok: false, problem: 'newer' };
  if (!picked.gs) return { ok: false, problem: 'not-a-save' };
  const runId = picked.gs.run?.id ?? null;
  const side: Record<string, string> = {};
  if (wrapped && outer.side !== null && typeof outer.side === 'object' && !Array.isArray(outer.side)) {
    for (const [key, value] of Object.entries(outer.side)) if (isSideKey(key, runId) && typeof value === 'string' && value.length <= SIDE_VALUE_MAX) side[key] = value;
  }
  const madeAt = wrapped && typeof outer.madeAt === 'number' && Number.isFinite(outer.madeAt) && outer.madeAt > 0 ? outer.madeAt : null;
  return { ok: true, saveText, side, madeAt, gs: picked.gs };
}

/** Write the side entries of a restored backup. Returns how many could not be written (a full storage). */
export function writeSide(side: Record<string, string>, store: Pick<Storage, 'setItem'>): number {
  let failed = 0;
  for (const [key, value] of Object.entries(side)) { try { store.setItem(key, value); } catch { failed++; } }
  return failed;
}

/** "soul-of-hero-save-2026-11-26-1934.json", in the player's local time. */
export function backupFileName(at: number): string {
  const d = new Date(at), two = (n: number) => String(n).padStart(2, '0');
  return `soul-of-hero-save-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.json`;
}

/** The line shown for a file the game cannot take. One whole sentence each (the Vietnamese overlay needs that). */
export function backupProblemLine(problem: BackupProblem): string {
  return problem === 'too-large' ? 'This file is too large to be a Soul of Hero save.'
    : problem === 'newer' ? 'This backup was made by a newer version of the game. Update the game, then restore it.'
    : problem === 'unreadable' ? 'This file could not be read as a save: it is not a Soul of Hero backup, or it is damaged.'
    : 'This file is not a save this version of the game can open. Nothing was changed.';
}
