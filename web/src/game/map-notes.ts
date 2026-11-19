import { WW, WH, type RunState } from './core';

// Field notes are presentation-only. Never stored in GameState or interpreted as
// engine authority. QA sessions use WeakMap memory so no production browser key is touched.
export type MarkKind = 'return' | 'materials' | 'danger' | 'shelter';
export interface FieldMark { id: string; tx: number; ty: number; kind: MarkKind; label: string }
export const MARK_LIMIT = 18;
const VALID_KINDS: MarkKind[] = ['return', 'materials', 'danger', 'shelter'];
const qaNotes = new WeakMap<RunState, FieldMark[]>();

export function discoveredCell(r: RunState, tx: number, ty: number): boolean {
  if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 0 || ty < 0 || tx >= WW || ty >= WH) return false;
  const mx = Math.floor(tx / 4), my = Math.floor(ty / 4);
  return !!r.discovered[my * Math.ceil(WW / 4) + mx];
}

function keyOf(r: RunState): string {
  return `soh.map-notes.v1:${r.id}:${r.sourceMap?.id ?? r.layoutId ?? 'shipping'}:${r.sourceMap?.revision ?? 0}`;
}

export function validMark(r: RunState, m: unknown): m is FieldMark {
  if (!m || typeof m !== 'object') return false;
  const v = m as Record<string, unknown>;
  return typeof v.id === 'string' && /^n[0-9a-z]{2,20}$/.test(v.id) &&
    typeof v.kind === 'string' && VALID_KINDS.includes(v.kind as MarkKind) &&
    typeof v.label === 'string' && v.label.length <= 22 &&
    discoveredCell(r, v.tx as number, v.ty as number);
}

export function readFieldMarks(r: RunState, qaSession: boolean): FieldMark[] {
  if (qaSession) return qaNotes.get(r) ?? [];
  try {
    const data: unknown = JSON.parse(localStorage.getItem(keyOf(r)) || '[]');
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    return data.filter((m): m is FieldMark => validMark(r, m))
      .filter(m => !seen.has(m.id) && (seen.add(m.id), true)).slice(0, MARK_LIMIT);
  } catch { return []; }
}

export function storeFieldMarks(r: RunState, qaSession: boolean, marks: FieldMark[]): boolean {
  const allowed = marks.slice(0, MARK_LIMIT).filter(m => validMark(r, m));
  if (qaSession) { qaNotes.set(r, allowed); return true; }
  try { localStorage.setItem(keyOf(r), JSON.stringify(allowed)); return true; }
  catch { return false; }
}

export function addFieldMark(r: RunState, marks: FieldMark[], tx: number, ty: number, kind: MarkKind, label: string): { marks: FieldMark[]; error?: string } {
  if (!discoveredCell(r, tx, ty)) return { marks, error: 'Only explored ground can be marked.' };
  if (!VALID_KINDS.includes(kind)) return { marks, error: 'Choose a known marker type.' };
  if (marks.length >= MARK_LIMIT) return { marks, error: '18 field notes maximum. Remove an old one first.' };
  if (marks.some(m => Math.hypot(m.tx - tx, m.ty - ty) < 2)) return { marks, error: 'There is already a note at this location.' };
  const id = `n${Math.random().toString(36).slice(2, 10)}`;
  const mark: FieldMark = { id, tx, ty, kind, label: label.trim().slice(0, 22) || ({ return: 'Return here', materials: 'Materials', danger: 'Avoid / prepare', shelter: 'Shelter' }[kind]) };
  return { marks: [...marks, mark] };
}