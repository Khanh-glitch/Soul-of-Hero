/**
 * The wait after Continue (the "While you were away" panel).
 *
 * The time away is replayed on a worker that starts with no world regions compiled. Since 2026-11-27 the title
 * screen hands it the regions it had compiled ahead of need. These tests hold two promises:
 *   1. handing regions over changes NOTHING in the outcome: the save that comes back is byte for byte the same;
 *   2. the player sees movement from the start (regions counted while the percentage is still 0), in Vietnamese.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ReturnMessage } from '../src/game/offline-return-worker';
import type { Input } from '../src/game/sim';
import { translateVi } from '../src/game/i18n-vi';

const T0 = Date.UTC(2026, 10, 27, 9), PLAYED = 5000, AWAY = 4 * 60000;
const NO_INPUT = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false } as unknown as Input;

/** A new run played for a few seconds and saved, as the title screen would find it. */
async function savedRun(): Promise<string> {
  vi.resetModules();
  const { newGame, startRun } = await import('../src/game/engine');
  const { tick } = await import('../src/game/sim');
  const { setActiveLayout } = await import('../src/game/world');
  const { U05_WORLD_LAYOUT_ID } = await import('../src/veyra05/scenes');
  const { serializeSnapshot } = await import('../src/game/persist');
  setActiveLayout(U05_WORLD_LAYOUT_ID);
  const gs = newGame(); startRun(gs, 'female', T0, null, 5);
  for (let ms = 0; ms < PLAYED; ms += 50) tick(gs, NO_INPUT, 50, T0 + ms + 50);
  return serializeSnapshot(gs);
}
/** Continue on a thread that has compiled nothing, as the worker is. `packCount` regions are handed over ready. */
async function continueFrom(snapshot: string, packCount: number) {
  vi.resetModules();
  const { compileGeometryRegionPack } = await import('../src/veyra05/window');
  const { newGameRegions } = await import('../src/veyra05/region-warmup');
  const packs = packCount ? newGameRegions().slice(0, packCount).map(([layoutId, rules]) => compileGeometryRegionPack(layoutId, rules)) : [];
  // The copy the browser makes when the packs are posted to the worker.
  const posted = structuredClone(packs);
  vi.resetModules();
  const { runReturn } = await import('../src/game/offline-return-worker');
  const messages: ReturnMessage[] = [];
  runReturn({ snapshot, now: T0 + PLAYED + AWAY, packs: posted }, m => messages.push(m));
  return messages;
}

describe('Continue after time away', () => {
  it('gives the same world whether regions are handed over ready or compiled on the spot, and shows movement before 1%', async () => {
    const snapshot = await savedRun();
    const plain = await continueFrom(snapshot, 0), helped = await continueFrom(snapshot, 60);
    const endPlain = plain.at(-1)!, endHelped = helped.at(-1)!;
    if (endPlain.kind !== 'complete' || endHelped.kind !== 'complete') throw Error(`Continue failed: ${JSON.stringify([endPlain, endHelped]).slice(0, 300)}`);

    // 1. Same outcome, byte for byte.
    expect(endHelped.snapshot).toBe(endPlain.snapshot);
    expect(endHelped.result).toEqual(endPlain.result);
    expect(endHelped.regions).toBe(endPlain.regions);
    expect(endPlain.packsUsed).toBe(0);
    expect(endHelped.packsUsed).toBeGreaterThan(20);

    // 2. Before the first whole percent there are already many region reports, each one more than the last.
    for (const run of [plain, helped]) {
      const early = run.filter((m): m is Extract<ReturnMessage, { kind: 'progress' }> => m.kind === 'progress' && m.fraction === 0);
      expect(early.length).toBeGreaterThan(30);
      early.forEach((m, i) => expect(m.regions).toBe(i + 1));
      const fractions = run.filter(m => m.kind === 'progress').map(m => (m as { fraction: number }).fraction);
      expect([...fractions].sort((a, b) => a - b)).toEqual(fractions);
      expect(fractions.at(-1)).toBeLessThanOrEqual(1);
    }
  }, 900_000);

  it('refuses a broken checkpoint with a reason instead of hanging', async () => {
    vi.resetModules();
    const { runReturn } = await import('../src/game/offline-return-worker');
    const messages: ReturnMessage[] = [];
    runReturn({ snapshot: '{', now: T0 }, m => messages.push(m));
    expect(messages.at(-1)?.kind).toBe('failed');
  });

  it('has every line of the waiting panel in Vietnamese', () => {
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const fixed = ['While you were away', 'A long absence can take a few minutes. Your saved game stays as it was until this finishes.', 'Back to title', 'Returning to the island', 'Island time resolved'];
    for (const line of fixed) { expect(app, line).toContain(line); expect(translateVi(line), line).toBeTruthy(); }
    // Templates: the exact wording in App.tsx, then one filled-in instance of each.
    expect(app).toContain('You were away for ${awayText}. The island kept living: its food, work and travel for that time are being worked out now.');
    expect(app).toContain('% of the time away worked out · ${progress.regions} regions of land made ready · running for ${ranText}');
    expect(translateVi('You were away for 3 h 1 min. The island kept living: its food, work and travel for that time are being worked out now.')).toBe('Bạn đã vắng 3 giờ 1 phút. Hòn đảo vẫn sống trong lúc đó: game đang tính phần ăn uống, công việc và đi lại của quãng thời gian ấy.');
    expect(translateVi('You were away for 45 min. The island kept living: its food, work and travel for that time are being worked out now.')).toContain('45 phút');
    expect(translateVi('You were away for 3 d 4 h. The island kept living: its food, work and travel for that time are being worked out now.')).toContain('3 ngày 4 giờ');
    expect(translateVi('7% of the time away worked out · 188 regions of land made ready · running for 0:16')).toBe('Đã tính 7% thời gian vắng mặt · đã dựng 188 vùng đất · đã chạy 0:16');
    expect(translateVi('Continue did not finish. Your previous save is unchanged. Missing saved island.')).toBe('Chưa chơi tiếp được. Bản lưu trước của bạn vẫn nguyên. Không tìm thấy hòn đảo đã lưu.');
    for (const line of ['exposure while offline', 'your bag', 'Recovering breath…']) expect(translateVi(line), line).toBeTruthy();
  });
});
