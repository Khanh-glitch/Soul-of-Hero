/**
 * G1B source resolver — slow (~2.5 min), opt-in:
 *   G1B_RESOLVE=1 npx vitest run tests/g1b-resolve.test.ts   re-measure the real world; must reproduce the frozen data exactly
 *   G1B_WRITE=1   npx vitest run tests/g1b-resolve.test.ts   rewrite src/game/g1b-sources.generated.ts from that measurement
 * It runs in its own file (own module cache) with the chest furniture reservation switched OFF: the resolver has to see
 * the world without the chests it is placing.
 */
import { describe, expect, it } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveG1b, type Resolution } from './helpers/g1b-resolve';
import { setG1bFurnitureReservation } from '../src/veyra05/floors';
import { G1B_SOURCE_SITES, G1B_GATES, G1B_FIXTURES, G1B_VARIANCES } from '../src/game/g1b-sources.generated';

const FILE = resolve(__dirname, '../src/game/g1b-sources.generated.ts');
const py = (v: unknown): string => Array.isArray(v) ? `[${v.map(py).join(', ')}]` : v && typeof v === 'object' ? `{${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${JSON.stringify(k)}: ${py(x)}`).join(', ')}}` : JSON.stringify(v);
function fileText(R: Resolution): string {
  const head = readFileSync(FILE, 'utf8').split('export const G1B_SOURCE_SITES')[0];
  const block = (name: string, type: string, rows: unknown[]) => `export const ${name}: readonly ${type}[] = [\n${rows.map(r => `  ${py(r)},\n`).join('')}];\n`;
  return head + block('G1B_SOURCE_SITES', 'G1bSourceSite', R.sources) + block('G1B_GATES', 'G1bGate', R.gates) + block('G1B_FIXTURES', 'G1bFixture', R.fixtures) + block('G1B_VARIANCES', 'string', R.variances);
}
describe.runIf(process.env.G1B_RESOLVE === '1' || process.env.G1B_WRITE === '1')('G1B resolver (slow, opt-in)', () => {
  it('re-measuring the real world reproduces the frozen data exactly', () => {
    setG1bFurnitureReservation(false); const R = resolveG1b();
    if (process.env.G1B_WRITE === '1') writeFileSync(FILE, fileText(R));
    expect(fileText(R)).toBe(readFileSync(FILE, 'utf8'));
    expect(R.sources).toEqual(G1B_SOURCE_SITES); expect(R.gates).toEqual(G1B_GATES); expect(R.fixtures).toEqual(G1B_FIXTURES); expect(R.variances).toEqual(G1B_VARIANCES);
  }, 900_000);
});
