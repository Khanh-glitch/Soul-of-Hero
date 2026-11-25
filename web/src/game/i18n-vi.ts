// ============================================================================
// i18n-vi: the Vietnamese phrase book for interface text that was written in
// English only. ui/i18n-dom.ts looks every on-screen string up here.
//
//   exact phrases   i18n-vi-book.ts, one "English => Tiếng Việt" per line
//   templates       the same file; "{}" matches any text, "{n}" a number, "{N}" a
//                   name (starts with a capital, no sentence punctuation), and
//                   "{1}", "{2}" … place the captures in the Vietnamese line
//
// Item, structure and creature names are deliberately absent: they stay in
// English in both languages. tests/i18n-vi.test.ts keeps that rule.
// ============================================================================
import { VI_BOOK } from './i18n-vi-book';

const exact = new Map<string, string>();
const folded = new Map<string, string>();
interface Tpl { re: RegExp; out: string; head: string }
const templates: Tpl[] = [];
/** Lines of the book that could not be read (reported by the test, never thrown at run time). */
export const VI_BOOK_ERRORS: string[] = [];

const esc = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
for (const raw of VI_BOOK.split('\n')) {
  const line = raw.trim(); if (!line || line.startsWith('#')) continue;
  const at = line.indexOf(' => ');
  if (at < 1) { VI_BOOK_ERRORS.push(line); continue; }
  const en = line.slice(0, at).trim(), vi = line.slice(at + 4).trim();
  if (!en || !vi) { VI_BOOK_ERRORS.push(line); continue; }
  if (/\{[nN]?\}/.test(en)) {
    const src = esc(en).replace(/\{n\}/g, '([+\\-−]?\\d[\\d.,:]*)').replace(/\{N\}/g, '([A-Z0-9][^.!?;]{0,48}?)').replace(/\{\}/g, '(.+?)');
    templates.push({ re: new RegExp('^' + src + '$', 's'), out: vi, head: en.slice(0, en.search(/\{/)).toLowerCase() });
  } else {
    if (exact.has(en)) VI_BOOK_ERRORS.push('duplicate: ' + en);
    exact.set(en, vi);
    const f = en.toLowerCase(); if (!folded.has(f)) folded.set(f, vi);
  }
}

// the most specific template first: more literal text wins
const literal = (t: Tpl) => t.re.source.replace(/\([^)]*\)/g, '').length;
templates.sort((a, b) => literal(b) - literal(a));

const upperVi = (s: string) => s.toLocaleUpperCase('vi');
const capVi = (s: string) => s.charAt(0).toLocaleUpperCase('vi') + s.slice(1);
const isUpper = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase();
const SEPARATORS = [' · ', ' | ', ' — ', ' – ', ' • ', '\n'];

/** All English phrases the book knows exactly (for the test). */
export const viExactKeys = (): string[] => [...exact.keys()];

/**
 * Vietnamese for one on-screen string, or null when the book has no entry.
 * `core` must already be trimmed.
 */
export function translateVi(core: string, depth = 0): string | null {
  const hit = exact.get(core); if (hit !== undefined) return hit;
  const low = core.toLowerCase();
  const fold = folded.get(low);
  if (fold !== undefined) return isUpper(core) ? upperVi(fold) : /^[A-Z]/.test(core) ? capVi(fold) : fold;
  if (depth > 3) return null;
  for (const t of templates) {
    if (t.head && !low.startsWith(t.head)) continue;
    const m = t.re.exec(core); if (!m) continue;
    return t.out.replace(/\{(\d)\}/g, (_, i: string) => { const part = m[+i] ?? ''; return translateVi(part.trim(), depth + 1) ?? part; });
  }
  // "A · B · C": translate the parts that are known and keep the rest.
  for (const sep of SEPARATORS) {
    if (!core.includes(sep)) continue;
    const parts = core.split(sep); let any = false;
    const out = parts.map(p => { const lead = /^\s*/.exec(p)![0], tail = /\s*$/.exec(p)![0]; const t = translateVi(p.trim(), depth + 1); if (t != null) any = true; return t != null ? lead + t + tail : p; });
    if (any) return out.join(sep);
  }
  // a fragment cut by the layout: "· HP 130/130", "Parts ·", "■ Cabinet ·"
  const bm = /^([·•]\s+)?(.*?)(\s+[·•])?$/s.exec(core);
  if (bm && (bm[1] || bm[3]) && bm[2].length > 1) { const t = translateVi(bm[2].trim(), depth + 1); if (t != null) return (bm[1] ?? '') + t + (bm[3] ?? ''); }
  // trailing punctuation or a leading key cap: "Close." / "Close:" / "Close…"
  const pm = /^(.*?)([.:…!?]+)$/.exec(core);
  if (pm && pm[1].length > 1) { const t = translateVi(pm[1].trim(), depth + 1); if (t != null) return t + pm[2]; }
  return null;
}
