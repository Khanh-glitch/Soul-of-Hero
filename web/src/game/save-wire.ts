/**
 * The on-disk envelope of one snapshot: `{ format, payload, checksum }`, where `payload` is the JSON text of the game
 * state. Kept free of game imports so the background save writer (save-writer.worker.ts) can share the exact same
 * bytes without loading the game into a second thread.
 */
export const SNAPSHOT_FORMAT = 'soh-snapshot-v1';
/** FNV-1a over UTF-16 code units, eight lowercase hex digits. */
export function snapshotChecksum(text: string): string { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); }
/** The stored text of a snapshot whose state already serialized to `payload`. */
export function wrapSnapshot(payload: string): string { return JSON.stringify({ format: SNAPSHOT_FORMAT, payload, checksum: snapshotChecksum(payload) }); }

export type SaveWriteRequest = { id: number; db: string; store: string; key: string } & ({ payload: string; text?: undefined } | { text: string; payload?: undefined });
export type SaveWriteReply = { id: number; status: 'ok' | 'idb-init' | 'idb-transaction' };
