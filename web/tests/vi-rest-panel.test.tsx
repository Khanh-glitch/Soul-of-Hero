// The rest panel in Vietnamese: every sentence it can show has a line in the phrase book.
// The panel is rendered from a real shelter (tests/helpers/shelter.ts) in each of its states, and each piece of
// text is looked up the way the page does it (src/ui/i18n-dom.ts): whole text nodes and the title, placeholder and
// aria-label attributes, skipping anything under data-notr.
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { GameState } from '../src/game/core';
import { C } from '../src/game/engine';
import { ITEMS, STRUCTS } from '../src/game/catalog';
import { translateVi } from '../src/game/i18n-vi';
import { RestPanel } from '../src/ui/RestPanel';
import { abandonSavedRun } from '../src/game/title-actions';
import { shelter, shelterAct, SHELTER_T as T } from './helpers/shelter';

vi.setConfig({ testTimeout: 180000 });

const VI_LETTER = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;
const unescape = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** The text pieces of a rendered panel that the page would try to translate. */
export function pieces(html: string): string[] {
  const out: string[] = [];
  const cut = html.replace(/<([a-z0-9]+)[^>]*\sdata-notr[^>]*>[\s\S]*?<\/\1>/g, '<!-- -->');
  for (const m of cut.matchAll(/\s(?:title|placeholder|aria-label)="([^"]*)"/g)) out.push(unescape(m[1]));
  for (const t of cut.split(/<[^>]*>/)) out.push(unescape(t));
  return out.map(s => s.trim()).filter(s => s.length >= 2 && /[A-Za-z]{2}/.test(s) && !VI_LETTER.test(s));
}
// Not sentences: an item uid (a tooltip for bug reports), and the names of items and structures, which stay in
// English in this game ("3 Roast Meat", "Wood Chest 144,43").
const NAMES = new Set([...Object.values(ITEMS), ...Object.values(STRUCTS)].map(d => d.name));
const isName = (s: string) => { const m = /^(?:\d+ )?(.+?)(?: \d+,\d+)?$/.exec(s); return !!m && NAMES.has(m[1]); };
const missing = (html: string, allow: RegExp[] = []) => [...new Set(pieces(html))].filter(s => translateVi(s) == null && !isName(s) && !allow.some(a => a.test(s)));

const api = (g: GameState, now = T) => ({ gs: g, act: () => ({ ok: true }), open: () => {}, now: () => now, sfx: () => {} } as any);
const UID = [/^[a-z0-9]+[-_:.][a-z0-9\-_:.]+$/i, /^\d+$/];

describe('rest panel in Vietnamese', () => {
  it('has a line for every sentence before lying down, with and without a chest', () => {
    const { g, r, bed, chest } = shelter(511);
    expect(missing(renderToString(<RestPanel api={api(g)} eid={bed.id} />), UID)).toEqual([]);
    // Empty chest.
    for (const s of C(r, chest.c!).slots) if (s) C(r, chest.c!).slots[C(r, chest.c!).slots.indexOf(s)] = null as any;
    expect(missing(renderToString(<RestPanel api={api(g)} eid={bed.id} />), UID)).toEqual([]);
    // No chest at all.
    delete r.entities[chest.id];
    const bare = renderToString(<RestPanel api={api(g)} eid={bed.id} />);
    expect(bare).toContain('Rest needs an owned');
    expect(missing(bare, UID)).toEqual([]);
  });

  it('has a line for the sentences that depend on what was chosen', () => {
    for (const s of ['You wake when the food runs out.', 'You wake when the water runs out.', 'Unreserve', 'Reserve', 'Not eligible',
      'Reserved: food 30 · water 100.', 'Forecast: about 3.5 h of 8 h.', 'Lie down 1 h', 'Lie down 8 h', 'Lie down 24 h', '1 h', '8 h', '24 h',
      'Water flasks in the chest: 2.', 'Water Flask · 4/5 drinks'])
      expect({ s, vi: translateVi(s) != null }).toEqual({ s, vi: true });
  });

  it('has a line for every sentence while resting', () => {
    const { g, r, bed, chest, flask } = shelter(512);
    r.player.hunger = 40; r.player.thirst = 60;
    const meat = C(r, chest.c!).slots.find(s => s?.key === 'cooked_meat')!.uid;
    expect(shelterAct(g, 'restStart', { eid: bed.id, chestId: chest.id, items: [meat, flask.uid], hours: 8 }, T).ok).toBe(true);
    const html = renderToString(<RestPanel api={api(g, T + 60000)} eid={bed.id} />);
    expect(html).toContain('Wake up now');
    expect(missing(html, UID)).toEqual([]);
  });
});

describe('abandon from the title while resting', () => {
  it('wakes the player, returns the reserve, and ends the run as abandoned', () => {
    const { g, r, bed, chest, flask } = shelter(513);
    r.player.hunger = 40; r.player.thirst = 60;
    const meat = C(r, chest.c!).slots.find(s => s?.key === 'cooked_meat')!.uid;
    expect(shelterAct(g, 'restStart', { eid: bed.id, chestId: chest.id, items: [meat, flask.uid], hours: 8 }, T).ok).toBe(true);
    expect(g.run!.rest).toBeTruthy();
    const before = g.profile.history.length;
    const out = abandonSavedRun(g, T + 5000);
    expect(out).toEqual({ ok: true, ending: 'abandoned' });
    expect(g.run).toBeNull();
    expect(g.profile.history.length).toBe(before + 1);
    expect(g.profile.history[0].ending).toBe('abandoned');
  });
});
