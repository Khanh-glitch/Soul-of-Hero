// The screens before the game: the words on the title menu and the "one moment" cover (ui/pregame.ts, ui/veil.tsx).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { awayLabel, clockLabel, continueLine, endingLabel } from '../src/ui/pregame';
import { afterPaint, behindVeil, gameDrew, hideVeil, settleVeil, showVeil, veilLine } from '../src/ui/veil';
import { translateVi, VI_BOOK_ERRORS } from '../src/game/i18n-vi';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('words before the game', () => {
  it('writes an absence in its two largest units', () => {
    expect(awayLabel(0)).toBe('0 min');
    expect(awayLabel(45 * 60000)).toBe('45 min');
    expect(awayLabel(59.6 * 60000)).toBe('1 h 0 min');
    expect(awayLabel(181 * 60000)).toBe('3 h 1 min');
    expect(awayLabel(47 * 3600000)).toBe('47 h 0 min');
    expect(awayLabel((3 * 24 + 4) * 3600000)).toBe('3 d 4 h');
    expect(awayLabel(-5)).toBe('0 min');
  });
  it('writes a running time as minutes and seconds', () => {
    expect(clockLabel(0)).toBe('0:00'); expect(clockLabel(16400)).toBe('0:16'); expect(clockLabel(125000)).toBe('2:05'); expect(clockLabel(-1)).toBe('0:00');
  });
  it('tells under Continue which day it is and how long the player was away', () => {
    expect(continueLine(0, 0)).toBe('Day 1 of 14');
    expect(continueLine(23.9, 60000)).toBe('Day 1 of 14');                      // under two minutes away: nothing to say
    expect(continueLine(24, 120000)).toBe('Day 2 of 14 · away 2 min');
    expect(continueLine(50.5, 96 * 60000)).toBe('Day 3 of 14 · away 1 h 36 min');
    expect(continueLine(400, 5 * 86400000)).toBe('Day 14 of 14 · away 5 d 0 h');  // the run clock is past its end: the last day, not "day 17"
    expect(continueLine(-3, 0)).toBe('Day 1 of 14');
  });
  it('names how a run ended', () => {
    expect(endingLabel('evacuated')).toBe('Evacuated'); expect(endingLabel('expired')).toBe('Lost to Ragnarok'); expect(endingLabel('abandoned')).toBe('Abandoned');
  });
  it('has every new line in Vietnamese', () => {
    expect(VI_BOOK_ERRORS).toEqual([]);
    expect(translateVi('Day 3 of 14 · away 1 h 36 min')).toBe('Ngày 3 / 14 · đã vắng 1 giờ 36 phút');
    expect(translateVi('Day 14 of 14 · away 3 d 4 h')).toBe('Ngày 14 / 14 · đã vắng 3 ngày 4 giờ');
    expect(translateVi('Day 1 of 14')).toBe('Ngày 1 / 14');
    expect(translateVi('Score 120 · Elder Stones 2/6 · cash secured +40')).toBe('Điểm 120 · Đá Elder 2/6 · tiền cất được +40');
    expect(translateVi('People of Veyra: 3 reached safe water · 20 survived · 36 died · 227 unknown')).toBe('Dân Veyra: 3 tới vùng nước an toàn · 20 sống sót · 36 chết · 227 không rõ');
    expect(translateVi('Reached safe water: 41 · Survived on the island: 0')).toBe('Tới vùng nước an toàn: 41 · Sống sót trên đảo: 0');
    expect(translateVi('Died: 38 · Fate unknown: 207')).toBe('Chết: 38 · Không rõ số phận: 207');
    expect(translateVi('(+180 this run)')).toBe('(+180 ở ván này)');
    expect(translateVi('RUN CHRONICLE · 04/11/2026')).toBe('NHẬT KÝ VÁN CHƠI · 04/11/2026');
    const title = read('../src/ui/Title.tsx'), app = read('../src/App.tsx');
    const fixed: [string, string][] = [
      // Since 2026-11-27 a run can be abandoned from the title itself, so the reason is short and the button sits beside it.
      [title, 'One run at a time.'], [title, 'Abandon this run…'], [title, 'The 14 days of this run are over. Continue to see how it ended.'],
      [title, 'Settings'], [title, 'Enter: play · Esc: back · arrow keys: move'], [title, 'Main menu'], [title, 'Run chronicle'],
      [title, 'Open the chronicle of this run'], [title, 'Evacuated from the Island'], [title, 'Consumed by Ragnarok'], [title, 'Run Abandoned'],
      [title, 'local score'], [title, 'Starter kit'], [title, 'Offline · single-player · saves in this browser only'],
      [app, 'Opening the island…'], [app, 'Raising the island…'], [app, 'Save recovery required'],
      [app, 'No new game was started and the original save copies were not overwritten.'], [app, 'Retry'],
    ];
    for (const [source, line] of fixed) { expect(source, line).toContain(line); expect(translateVi(line), line).toBeTruthy(); }
    for (const line of ['Evacuated', 'Lost to Ragnarok', 'Abandoned', 'Continue — Adventurer ♀', 'Continue — Adventurer ♂']) expect(translateVi(line), line).toBeTruthy();
    // What the save loader can say on the recovery screen and under the menu.
    const notes = [...read('../src/game/persist.ts').matchAll(/note: '([^']+)'/g)].map(m => m[1]);
    expect(notes.length).toBeGreaterThanOrEqual(5);
    for (const note of notes) expect(translateVi(note), note).toBeTruthy();
  });
  it('keeps the button names the browser test scripts press', () => {
    const title = read('../src/ui/Title.tsx'), app = read('../src/App.tsx');
    expect(title).toContain('{`Continue — ${heroName(run.character)}`}');
    for (const name of ['>New run</button>', '>Begin the 14 days</button>', '>Profile &amp; history</button>']) expect(title, name).toContain(name);
    expect(app).toContain('>Back to title</button>');
  });
  it('shows a splash from the page itself, before any script has loaded', () => {
    const html = read('../index.html');
    const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('<script>'));
    expect(root).toContain('class="boot"'); expect(root).toContain('SOUL OF HERO'); expect(root).toContain('Loading…');
    expect(html).toContain('Đang tải…');
    expect(html).toContain("localStorage.getItem('soh.lang.v1')");
    expect(html.indexOf('<style>')).toBeLessThan(html.indexOf('<div id="root">'));
    expect(html).toContain('steps(10)');                                           // not a smooth animation (see the comment in index.html)
  });
  it('keeps the small-window line on one row before the game, and leaves it as it was inside the game', () => {
    const css = read('../src/index.css'), title = read('../src/ui/Title.tsx');
    expect(title).toContain('<div data-pregame ');
    expect(css).toMatch(/body:has\(\[data-pregame\], \.boot\) \.fit-hint \{[^}]*margin: 0 auto;[^}]*width: fit-content;[^}]*transform: none;/);
    expect(css).toMatch(/\n\.fit-hint \{ position: fixed; left: 50%; bottom: 6px; transform: translateX\(-50%\);/);
    expect(css).toContain('body:has(.fit-hint) .title-foot { visibility: hidden; }');
  });
});

describe('the cover over work that holds the page still', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { hideVeil(); vi.runAllTimers(); vi.useRealTimers(); });

  it('goes up at once and comes down when told', () => {
    expect(veilLine()).toBeNull();
    showVeil('Raising the island…'); expect(veilLine()).toBe('Raising the island…');
    hideVeil(); expect(veilLine()).toBeNull();
    hideVeil(); expect(veilLine()).toBeNull();          // twice is harmless
  });
  it('runs the work only after the cover has had time to be painted, and keeps the cover up until the game has drawn', () => {
    const order: string[] = [];
    behindVeil('Opening the island…', () => { order.push(`work under "${veilLine()}"`); });
    expect(veilLine()).toBe('Opening the island…'); expect(order).toEqual([]);      // nothing has run yet
    vi.advanceTimersByTime(300);
    expect(order).toEqual(['work under "Opening the island…"']);
    expect(veilLine()).toBe('Opening the island…');                                 // still up: the game has not drawn
    vi.advanceTimersByTime(5000); expect(veilLine()).toBe('Opening the island…');
    gameDrew(); expect(veilLine()).toBeNull();
  });
  it('comes down by itself after 30 seconds if the game never reports', () => {
    behindVeil('Opening the island…', () => {});
    vi.advanceTimersByTime(300); expect(veilLine()).not.toBeNull();
    vi.advanceTimersByTime(29000); expect(veilLine()).not.toBeNull();
    vi.advanceTimersByTime(1100); expect(veilLine()).toBeNull();
  });
  it('comes down at once when the work fails, and lets the error through', () => {
    behindVeil('Raising the island…', () => { throw new Error('no land'); });
    expect(() => vi.advanceTimersByTime(300)).toThrow('no land');
    expect(veilLine()).toBeNull();
  });
  it('stays down when the work takes it down itself (a run that ended while away goes to the chronicle)', () => {
    behindVeil('Opening the island…', () => { hideVeil(); });
    vi.advanceTimersByTime(300); expect(veilLine()).toBeNull();
    showVeil('Raising the island…'); vi.advanceTimersByTime(31000);
    expect(veilLine()).toBe('Raising the island…');     // the give-up timer of the earlier cover does not take this one down
  });
  it('runs afterPaint once, even with no frames (a hidden tab)', () => {
    let n = 0; afterPaint(() => { n++; });
    vi.advanceTimersByTime(299); expect(n).toBe(0);
    vi.advanceTimersByTime(2000); expect(n).toBe(1);
  });
  it('settleVeil does nothing when no cover is up', () => { settleVeil(); vi.advanceTimersByTime(31000); expect(veilLine()).toBeNull(); });
});
