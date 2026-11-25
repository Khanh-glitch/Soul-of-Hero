// The Vietnamese phrase book (src/game/i18n-vi*.ts) and the rules it must keep.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CREATURES, ITEMS, STRUCTS } from '../src/game/catalog';
import { translateVi, viExactKeys, VI_BOOK_ERRORS } from '../src/game/i18n-vi';
import { VI_BOOK } from '../src/game/i18n-vi-book';

describe('Vietnamese phrase book', () => {
  it('every line of the book parses and no phrase is listed twice', () => {
    expect(VI_BOOK_ERRORS).toEqual([]);
    expect(viExactKeys().length).toBeGreaterThan(700);
  });

  it('the generated book matches the phrase lists it is built from', () => {
    // scripts/make-vi-book.py concatenates i18n/vi/*.txt; an edit to the lists without a rebuild must fail here.
    const dir = join(__dirname, '..', 'i18n', 'vi');
    const want = ['01-core', '02-panels', '03-stations', '04-more', '05-engine', '06-items'].flatMap(n => readFileSync(join(dir, n + '.txt'), 'utf8').split('\n').map(l => l.trim()).filter(Boolean));
    const have = new Set(VI_BOOK.split('\n').map(l => l.trim()).filter(Boolean));
    expect(want.filter(l => !have.has(l))).toEqual([]);
  });

  it('item, structure and creature names stay in English', () => {
    const names = new Set<string>();
    for (const table of [ITEMS, STRUCTS, CREATURES] as Record<string, { name?: string }>[]) for (const v of Object.values(table)) if (v.name) names.add(v.name);
    // Words that are both an ordinary interface word and a catalog name. Listed so the overlap is a decision, not an accident.
    const shared = new Set(['Water']);
    // the book also answers in any letter case, so the comparison ignores case too
    const lower = new Set([...names].map(n => n.toLowerCase()));
    const clash = viExactKeys().filter(k => lower.has(k.toLowerCase()) && !shared.has(k));
    expect(clash).toEqual([]);
    for (const n of ['Stone Axe', 'Workbench', 'Fuel Canister', 'Territory Cabinet']) expect(translateVi(n)).toBeNull();
  });

  it('translates exact phrases, case variants and trailing punctuation', () => {
    expect(translateVi('Close')).toBe('Đóng');
    expect(translateVi('Inventory full.')).toBe('Túi đồ đầy.');
    expect(translateVi('MUTE ALL')).toBe('TẮT HẾT TIẾNG');
    expect(translateVi('RESUME')).toBe('CHƠI TIẾP');
    expect(translateVi('Resume…')).toBe('Chơi tiếp…');
  });

  it('fills templates and keeps names inside them in English', () => {
    expect(translateVi('Health 22 / 100')).toBe('Máu 22 / 100');
    expect(translateVi('Pick up Stone Axe')).toBe('Nhặt Stone Axe');
    expect(translateVi('Open Escrow Chest')).toBe('Mở Escrow Chest');
    expect(translateVi('Get 4 Plant Fiber')).toBe('Kiếm 4 Plant Fiber');
    expect(translateVi('Requires workbench level 2.')).toBe('Cần bàn chế tạo cấp 2.');
    expect(translateVi('Slot 3: empty. Enter picks or places; Escape cancels.')).toBe('Ô 3: trống. Enter để nhấc hoặc đặt; Esc để hủy.');
  });

  it('translates the known parts of an "A · B" line and leaves the rest', () => {
    expect(translateVi('Bandage · Get 4 Plant Fiber')).toBe('Bandage · Kiếm 4 Plant Fiber');
    expect(translateVi('drag move · Tab next · Enter pick/place · Esc cancel · 1-8 hotbar')).toBe('kéo để chuyển · Tab ô tiếp · Enter nhấc/đặt · Esc hủy · 1-8 thanh nhanh');
  });

  it('never guesses: text the book does not know stays untouched', () => {
    expect(translateVi('Zzyzx quux')).toBeNull();
    expect(translateVi('Lighthouse Spit')).toBeNull();
    // a sentence that merely starts like a template must not be half-translated
    expect(translateVi('Open the door slowly, then run. Do not stop.')).toBeNull();
  });
});
