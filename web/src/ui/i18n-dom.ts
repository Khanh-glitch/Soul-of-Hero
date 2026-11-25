// ============================================================================
// i18n-dom: Vietnamese overlay for the whole DOM interface.
//
// The Journey ledger carries its own two-language texts. Every other screen was
// written in English only, in several hundred places across the UI and the
// engine's messages. Rather than thread a language argument through all of
// them, this module translates what reaches the screen: text nodes and the
// `title` / `placeholder` / `aria-label` attributes, looked up in the phrase
// book in game/i18n-vi.ts.
//
// Rules it keeps:
//   - Presentation only. React props, the save, the engine and every receipt
//     keep their English text; only the DOM copy changes, and switching back to
//     English restores the original string exactly.
//   - Item, structure and creature names are not in the phrase book, so they
//     stay in English in both languages (same rule as the handbook).
//   - Text the phrase book does not know stays in English; it is never guessed.
// ============================================================================
import { getLang, subscribeLang } from '../game/i18n';
import { translateVi } from '../game/i18n-vi';

const VI_LETTER = /[ăâđêôơưàáãèéìíòóõùúý\u1EA0-\u1EF9]/i;
const ATTRS = ['title', 'placeholder', 'aria-label'] as const;
interface Rec { src: string; out: string }
const textRec = new WeakMap<Text, Rec>();
const attrRec = new WeakMap<Element, Partial<Record<string, Rec>>>();
const cache = new Map<string, string | null>();
/** Strings seen on screen in Vietnamese mode that the phrase book could not translate (QA audit only). */
export const untranslated = new Map<string, number>();
let audit = false;
export function setI18nAudit(on: boolean) { audit = on; if (!on) untranslated.clear(); }

function lookup(s: string): string | null {
  if (s.length < 2) return null;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!; const core = m[2];
  if (core.length < 2 || !/[A-Za-z]{2}/.test(core)) return null;
  if (VI_LETTER.test(core)) return null;               // already Vietnamese (the Journey ledger writes its own)
  let hit = cache.get(core);
  if (hit === undefined) {
    hit = translateVi(core);
    if (cache.size > 8000) cache.clear();
    cache.set(core, hit);
  }
  if (hit == null) { if (audit) untranslated.set(core, (untranslated.get(core) ?? 0) + 1); return null; }
  return hit === core ? null : m[1] + hit + m[3];
}

const skipped = (el: Element | null) => !!el && (el.closest('[data-notr], script, style, textarea') !== null);

function doText(n: Text) {
  const cur = n.nodeValue ?? ''; const rec = textRec.get(n);
  if (rec && rec.out === cur) return;                 // our own write, or nothing changed
  if (skipped(n.parentElement)) return;
  const out = lookup(cur);
  if (out == null) { if (rec) textRec.delete(n); return; }
  textRec.set(n, { src: cur, out }); n.nodeValue = out;
}
function doAttrs(el: Element) {
  for (const a of ATTRS) {
    const cur = el.getAttribute(a); if (cur == null) continue;
    const recs = attrRec.get(el); const rec = recs?.[a];
    if (rec && rec.out === cur) continue;
    if (skipped(el)) return;
    const out = lookup(cur);
    if (out == null) { if (recs && rec) delete recs[a]; continue; }
    const store = recs ?? {}; store[a] = { src: cur, out }; if (!recs) attrRec.set(el, store);
    el.setAttribute(a, out);
  }
}
function walk(root: Node, fn: (n: Node) => void) {
  if (root.nodeType === Node.TEXT_NODE) { fn(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  fn(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) fn(n);
}
const apply = (n: Node) => { if (n.nodeType === Node.TEXT_NODE) doText(n as Text); else doAttrs(n as Element); };
const restore = (n: Node) => {
  if (n.nodeType === Node.TEXT_NODE) { const rec = textRec.get(n as Text); if (rec) { if (n.nodeValue === rec.out) n.nodeValue = rec.src; textRec.delete(n as Text); } return; }
  const el = n as Element; const recs = attrRec.get(el); if (!recs) return;
  for (const a of ATTRS) { const rec = recs[a]; if (rec && el.getAttribute(a) === rec.out) el.setAttribute(a, rec.src); }
  attrRec.delete(el);
};

let observer: MutationObserver | null = null;
function onMutations(list: MutationRecord[]) {
  for (const m of list) {
    if (m.type === 'characterData') doText(m.target as Text);
    else if (m.type === 'attributes') doAttrs(m.target as Element);
    else for (const n of m.addedNodes) walk(n, apply);
  }
}
function sync() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const lang = getLang();
  document.documentElement.lang = lang;
  if (lang === 'vi') {
    walk(document.body, apply);
    if (!observer) {
      observer = new MutationObserver(onMutations);
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    }
  } else {
    if (observer) { observer.disconnect(); observer = null; }
    walk(document.body, restore);
  }
}

let started = false;
/** Start following the language switch. Safe to call more than once. */
export function startDomI18n() {
  if (started || typeof document === 'undefined') return;
  started = true; subscribeLang(sync); sync();
}
