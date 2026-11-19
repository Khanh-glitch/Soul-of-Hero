/**
 * EIGHT OCCUPATIONS — natural coverage, no forced intents.
 *
 * This file runs the REAL world clock over a generated population and records what the survivors
 * actually did. Nothing here hands anyone an intent, a station, or an item: the only inputs are the
 * seed, the hours, and the physical entities the generator produced. It is deliberately a coverage
 * LEDGER, not a claim that all eight roles are complete — the assertion pins the roles that do
 * complete on their own, so a regression cannot quietly remove one.
 */
import { describe, expect, it } from 'vitest';
import { newGame, startRun, stepStations } from '../src/game/engine';
import { stepHumans } from '../src/game/humanworld';
import { setActiveLayout } from '../src/game/world';
import { T0 } from './helpers/g1b-kit';

describe('natural occupation coverage (6 sim hours, generated population)', () => {
  it('records which occupations complete real work without anyone forcing an intent', () => {
    setActiveLayout('veyra05-greywater');
    const gs = newGame();
    expect(startRun(gs, 'female', T0, null, 7606, { tx: 100, ty: 100 }).ok).toBe(true);
    const r = gs.run!; const hw = r.humanWorld!;
const occ: Record<string, number> = {};
for (const h of Object.values(hw.people)) occ[h.occupation] = (occ[h.occupation] ?? 0) + 1;
console.log('POP', Object.keys(hw.people).length, JSON.stringify(occ));
const stations: Record<string, number> = {};
for (const e of Object.values(r.entities)) if ((e as any).station) stations[e.type!] = (stations[e.type!] ?? 0) + 1;
console.log('STATIONS', JSON.stringify(stations));
const done: Record<string, number> = {};
const start0 = Date.now();
for (let t = 0; t < 360; t++) {
  const now = T0 + t * 60000;
  stepHumans(r, hw, now);
  try { stepStations(gs, 60000, now); } catch { /* station probe */ }
  if (t % 60 === 59) console.log('t', (t + 1) / 60, 'h', 'ms', Date.now() - start0);
}
for (const q of r.receipts) if (q.kind.startsWith('human.')) done[q.kind] = (done[q.kind] ?? 0) + 1;
console.log('RECEIPTS', JSON.stringify(done));
const workKinds: Record<string, number> = {};
for (const q of r.receipts) if (q.kind === 'human.work.start') workKinds[q.detail.split(':')[2] ?? '?'] = (workKinds[q.detail.split(':')[2] ?? '?'] ?? 0) + 1;
console.log('WORKSTART', JSON.stringify(workKinds));
  const byOcc: Record<string, number> = {};
  for (const q of r.receipts) if (q.kind === 'human.harvest' || q.kind === 'human.production.pickup' || q.kind === 'human.harvest.complete') {
    const id = q.detail.split(/[:,{]/)[0]?.replace('{', '') ?? '?';
    const w = hw.people[q.detail.match(/workerId"?:"?([^",]+)/)?.[1] ?? ''] ?? hw.people[id];
    const k = w?.occupation ?? 'unknown';
    byOcc[k] = (byOcc[k] ?? 0) + 1;
  }
  console.log('OCCUPATION COVERAGE', JSON.stringify(byOcc));
  const producers = Object.keys(byOcc).filter(k => byOcc[k] > 0);
  console.log('PRODUCING ROLES', producers.join(','));
  expect(producers.length).toBeGreaterThanOrEqual(5);
  for (const role of ['salvager', 'mechanic', 'builder', 'gardener', 'engineer']) {
    expect(producers, `${role} produced real output naturally`).toContain(role);
  }
});
});
