// Third UI round: the panels a player rarely opens (bed rest, return chronicle, trader, evacuation, sea
// passage, residents), the prompts beside the player, and what a phone is told to press.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { translateVi } from '../src/game/i18n-vi';
import { touchWords } from '../src/ui/Waymark';
import { PanelGuard } from '../src/ui/common';

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('Vietnamese for the rarely opened panels', () => {
  const cases: [string, string][] = [
    ['RETURN CHRONICLE · 6.5 h AWAY', 'NHẬT KÝ TRỞ VỀ · VẮNG 6.5 giờ'],
    ['HP 100 · Hunger 57.8 · Thirst 44.2 · Warmth 100', 'Máu 100 · Đói 57.8 · Khát 44.2 · Thân nhiệt 100'],
    ['Stone Floor 18,161: 260 → 119 HP.', 'Stone Floor 18,161: độ bền 260 → 119.'],
    ['0 min in: a workshop job finished (Fuel Canister); output waits in its container.', 'Sau 0 phút: một việc ở trạm đã xong (Fuel Canister); thành phẩm đang nằm trong ô chứa của trạm.'],
    ['Lie down 8 h', 'Nằm nghỉ 8 giờ'],
    ['Seat 3 · 1/6 aboard · Vessel hull 100', 'Ghế 3 · 1/6 người trên tàu · Thân tàu 100'],
    ['Trust 50 · Health 110/110', 'Tin cậy 50 · Máu 110/110'],
    ['Trade with Mirela the Trader', 'Giao dịch với Mirela the Trader'],
    ['Bear trap ARMED · 3 hits left · live contact fires it', 'Bear Trap ĐÃ GÀI · còn 3 lần sập · chạm vào là sập'],
    ['Upkeep: 74 Stone a day', 'Bảo trì: 74 Stone mỗi ngày'],
    ['Day 12 / 14', 'Ngày 12 / 14'],
  ];
  for (const [en, vi] of cases) it(en, () => expect(translateVi(en)).toBe(vi));

  it('the player has "Máu", a structure has "độ bền"', () => {
    expect(translateVi('Injured (40/110 HP).')).toContain('máu');
    expect(translateVi('Stone Floor 18,161 needs repair (119/260 HP).')).toContain('độ bền');
  });
});

describe('one string per sentence, so a count never sits glued to its word', () => {
  it('the bed panel no longer asks an unknown container for its slots', () => {
    const rest = src('ui/RestPanel.tsx');
    expect(rest).not.toContain("chest?.c ?? 'none'");
  });
  it('the chronicle shows the NOW chip once, not chip plus the same word in the row', () => {
    expect(src('ui/ReturnChronicle.tsx')).toContain("row.text.replace(/^NOW · /, '')");
  });
  it('a finished job is named by its product, not by a recipe id', () => {
    const rr = src('game/return-report.ts');
    expect(rr).toContain('a workshop job finished (${jobName(recipe)})');
    expect(rr).not.toMatch(/job finished \(\$\{recipe\}\)/);
  });
});

describe('a panel that throws closes instead of blanking the game', () => {
  it('PanelGuard turns an error into the failed state and reports it', () => {
    expect(PanelGuard.getDerivedStateFromError()).toEqual({ failed: true });
    const seen: unknown[] = [];
    const guard = new PanelGuard({ resetKey: 'rest', onError: e => seen.push(e), children: null });
    const quiet = console.error; console.error = () => {};
    try { guard.componentDidCatch(new Error('boom')); } finally { console.error = quiet; }
    expect(seen).toHaveLength(1);
  });
  it('every panel is drawn inside the guard', () => {
    const game = src('ui/Game.tsx');
    expect(game).toContain('<PanelGuard');
    expect(game.indexOf('<PanelGuard')).toBeLessThan(game.indexOf('<RestPanel'));
    expect(game.indexOf('</PanelGuard>')).toBeGreaterThan(game.indexOf('<RestPanel'));
  });
});

describe('a touch screen is told about buttons, not about a mouse', () => {
  it('English', () => expect(touchWords('Swing LMB at a tree. Space rolls.', 'en')).toBe('Swing the Hit button at a tree. the Roll button rolls.'));
  it('Vietnamese', () => expect(touchWords('Vung chuột trái vào cây.', 'vi')).toBe('Vung nút Đánh vào cây.'));
  it('leaves other words alone', () => expect(touchWords('Open the pack.', 'en')).toBe('Open the pack.'));
});

describe('the pack beside a chest keeps its action row in view', () => {
  it('the action row is outside the scroll area and the clock plate steps aside', () => {
    const panels = src('ui/panels.tsx');
    const inv = panels.slice(panels.indexOf('export function InventoryPanel'), panels.indexOf('export function InventoryPanel') + 5200);
    const scrollEnd = inv.indexOf("{/* the action row stays on the panel's foot");
    expect(scrollEnd).toBeGreaterThan(0);
    expect(inv.indexOf('className="actions"')).toBeGreaterThan(scrollEnd);
    expect(src('ui/Game.tsx')).toContain("fullScreen || sidePack ? 'hidden'");
  });
});
