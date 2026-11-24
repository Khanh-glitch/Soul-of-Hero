// ============================================================================
// THE PROOF OF THE PROOF — `scripts/pa1-research-proof.mjs` is what turns a green Chromium job into
// evidence, so it gets the same treatment as the browser gate: a fixture per verdict, run for real.
//
// This exists because a previous revision of that check was embedded in the workflow YAML as an inline
// `node -e '...'` string, picked up `\"` escapes from the YAML, and reported SUCCESS while never parsing.
// A proof that cannot fail is not a proof. Here the script is executed with `node`, in a temp directory,
// against manifests whose legibility claims are known to be true or false, and the exit code is asserted.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('../scripts/pa1-research-proof.mjs', import.meta.url);
const FAMS = ['ENERGY', 'METALLURGY', 'MOBILITY', 'ELECTRICAL', 'AGRICULTURE', 'ARMORY',
  'EXPLORATION', 'ARCANA', 'STEEL', 'DEFENSE', 'CORE_SPECIFIC'];

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'pa1-proof-')); mkdirSync(join(dir, 'evidence/pa1-research-visible'), { recursive: true }); });
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

const frame = (label: string, over: Record<string, unknown> = {}) => ({
  label, box: { x: 682, y: 230, w: 564, h: 30 }, pane: { x: 660, y: 100, w: 576, h: 288 },
  visible: true, fits: true, inPane: true, inPanel: true, hitTest: 'hits-element', ...over,
});
const good = () => ({
  sha: 'abcdef0123456789abcdef0123456789abcdef01', status: 'PASS_BROWSER_UI',
  screenshots: ['02-technology-families-1280.png', '03-technology-families-640.png'],
  research: {
    open: true, tabClicked: true, families: FAMS,
    energyRow: 'ENERGY cost recorded (5 Parts + 2 Iron Ingot) · 9 formulas · nothing withheld in this build',
    text: 'TECHNOLOGY FAMILIES One paid study unlocks a family … ENERGY cost recorded (5 Parts + 2 Iron Ingot)',
    purchaseControls: { energyRow: 0, pane: 0 },
    leakCheck: [{ label: 'Technology' }, { label: 'Blueprints' }, { label: 'Specimens & Cores' }],
    frames1280: [frame('Technology families heading'), frame('ENERGY family row'), frame('last family row after scrolling the pane')],
    frames640: [frame('Technology families heading @640'), frame('ENERGY family row @640'), frame('last family row after scrolling the pane @640')],
  },
});
function run(manifest: unknown | null) {
  const p = join(dir, 'evidence/pa1-research-visible/manifest.json');
  if (manifest === null) { try { rmSync(p); } catch { /* absent is the point */ } } else writeFileSync(p, JSON.stringify(manifest));
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [decodeURIComponent(SCRIPT.pathname)], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } });
  } catch (e: any) { out = (e.stdout ?? '') + (e.stderr ?? ''); code = e.status ?? -1; }
  return { out, code, summary: out };
}

describe('PA1 research visibility proof — the CI check that refuses a hollow green run', () => {
  it('parses and runs standalone (no YAML, no shell quoting in the middle)', () => {
    const src = readFileSync(SCRIPT, 'utf8');
    expect(() => execFileSync(process.execPath, ['--check', decodeURIComponent(SCRIPT.pathname)], { encoding: 'utf8' })).not.toThrow();
    expect(src).not.toMatch(/\\"\w/);   // the exact defect that made a broken step look green
  });
  it('accepts a manifest whose frames are inside the viewport AND inside the pane', () => {
    const { out, code } = run(good());
    expect(code, out).toBe(0);
    expect(out).toContain('PA1_RESEARCH_PROOF {"status":"COMPLETE"');
    expect(out).toContain('readable |');
    expect(out).toContain('last family row after scrolling the pane');
    expect(out).toContain('no purchase control');
  });
  it('refuses a PASS manifest with a row the pane clipped, and names it', () => {
    const m = good();
    (m.research.frames640[2] as any).inPane = false;   // below the pane's client area at 640x360
    const { out, code } = run(m);
    expect(code).toBe(1);
    expect(out).toContain('PROOF INCOMPLETE');
    expect(out).toContain('frames640:last family row after scrolling the pane @640 not readable');
  });
  it('refuses a PASS manifest that never clicked the tab, or lost a family', () => {
    const m = good();
    (m.research as any).tabClicked = false;
    (m.research as any).families = FAMS.slice(0, 10);
    const { out, code } = run(m);
    expect(code).toBe(1);
    expect(out).toContain('the Technology tab was never clicked');
    expect(out).toContain('CORE_SPECIFIC never appeared on screen');
  });
  it('refuses a PASS manifest whose ENERGY row lost its authorised price wording', () => {
    const m = good();
    (m.research as any).energyRow = 'ENERGY · studied';
    const { out, code } = run(m);
    expect(code).toBe(1);
    expect(out).toContain('the ENERGY cost row is not in the captured text');
  });
  it('does not double-fail a run whose browser gate is already red, but still publishes why', () => {
    const m = good();
    m.status = 'FAIL';
    (m as any).failure = 'AssertionError [ERR_ASSERTION]: the Blueprints view lost its directed-study list';
    (m.research as any).frames640 = [];
    const { out, code } = run(m);
    expect(code, out).toBe(0);
    expect(out).toContain('**PROOF INCOMPLETE:** browser gate status=FAIL :: AssertionError');
    expect(out).toContain('"status":"INCOMPLETE"');
  });
  it('reports a missing manifest instead of throwing an opaque stack', () => {
    const { out, code } = run(null);
    expect(code).toBe(0);
    expect(out).toContain('NO EVIDENCE');
    expect(out).toContain('PA1_RESEARCH_PROOF {"status":"NO_MANIFEST"');
  });
});
