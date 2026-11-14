// ============================================================================
// THE BROWSER GATE IS A CONTRACT, NOT A SCRIPT — pinned here so it cannot be quietly downgraded.
//
// Why a source-level pin instead of another DOM test: the defect Control Tower held this branch for was
// not a missing feature but a missing PROOF — `pa1-research-visible.mjs` asserted `panel.count()>0` and
// `innerText()`, which are both true for markup that sits below a 142 px scroll strip and never reaches
// the screen. A unit test cannot re-run Chromium in this sandbox, so what it CAN do is refuse to let the
// gate regress into the shape that lied: no bounding-box measurement, no tab click, no 640x360 pass, or
// a ledger claimed from the default tab. If you edit the .mjs and this file goes red, the gate got
// weaker, and a weaker gate is not evidence.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
import { VIEW_W, VIEW_H } from '../src/game/core';
const read = (rel: string) => readFileSync(new URL(rel, here), 'utf8');
const gate = read('../e2e/pa1-research-visible.mjs');
const console_ = read('../src/ui/StationConsole.tsx');
const re = (src: string, tag: string) => {
  expect(src, 'gate is missing: ' + tag).toMatch(new RegExp(tag));
};

describe('PA1 research-visible browser gate — legibility, not DOM presence', () => {
  it('opens the ledger by clicking the real Technology tab, not by assuming it is on screen', () => {
    re(gate, `getByTestId\\('research-tab-families'\\)`);
    re(gate, `const famTab=page\\.getByTestId\\('research-tab-families'\\)`);
    re(gate, `await famTab\\.click\\(\\)`);
    // the console-opened signal must be something the default tab paints, or the gate would pass on a
    // closed panel that happens to contain the words.
    expect(gate).not.toMatch(/const panel=\(\)=>page\.getByText\('Technology families'/);
  });
  it('measures painted boxes against the viewport for the heading and the ENERGY row', () => {
    re(gate, 'async function inFrame\\(');
    re(gate, 'locator\\.boundingBox\\(\\)');
    re(gate, 'box\\.x\\+box\\.width<=vp\\.width');
    re(gate, 'box\\.y\\+box\\.height<=vp\\.height');
    re(gate, "document\\.elementFromPoint");           // covered-by-something else is a failure
    for (const target of ['Technology families heading', 'ENERGY family row']) {
      expect(gate, 'no in-viewport measurement for: ' + target).toContain(`'${target}`);
    }
    expect(gate).toMatch(/getByTestId\('family-row-ENERGY'\)/);
    expect(gate).toMatch(/rec\.research\.frames1280/);
    expect(gate).toMatch(/rec\.research\.frames640/);
  });
  it('proves legibility at BOTH shipped sizes and screenshots each one', () => {
    re(gate, "setViewportSize\\(\\{width:640,height:360\\}\\)");
    re(gate, "viewport:\\{width:1280,height:720\\}");
    re(gate, "shot\\('02-technology-families-1280'\\)");
    re(gate, "shot\\('03-technology-families-640'\\)");
    // all eleven families must be COUNTED in the pane at the small size, not just named in a comment
    expect(gate).toContain('getByTestId(/^family-row-/)');
    // clipped-by-the-pane must be a failure, and the last row must be proven reachable by scrolling
    expect(gate).toContain("const inPane=");
    expect(gate).toContain("is therefore clipped");
    expect(gate).toContain("getByTestId('family-row-CORE_SPECIFIC')");
    expect(gate).toContain('scrollIntoViewIfNeeded');
    // "inside the pane" is not enough: an ancestor that clips leaves geometry intact and paints
    // something else, so the hit must land on the element itself and the box must sit in the panel too.
    expect(gate).toContain("if(el===at||el.contains(at)) return 'hits-element'");
    expect(gate).toContain('const inPanel=');
    // scrolling the pane to reach row eleven leaves row ONE off screen; measuring afterwards without
    // resetting is how the 640x360 pass reported a heading at y:-1 that no fresh look would show.
    expect(gate).toContain('const resetPane=');
    expect(gate.match(/await resetPane\(\)/g)?.length).toBeGreaterThanOrEqual(3);

    expect(gate).toContain('clipped by it');
    // the stage is a fixed 640x360 design that the whole UI is scaled inside, so a console taller than
    // the stage is a console whose last rows are unseeable at every window size. This is the arithmetic
    // that broke `782cc25`: 34 + 330 = 364 > 360.
    const geo = /left: (\d+), top: (\d+), width: (\d+), maxHeight: (\d+)/.exec(console_);
    expect(geo, 'the console lost its explicit stage geometry').toBeTruthy();
    const [, l, t2, w, mh] = geo!.map(Number);
    expect(l + w).toBeLessThanOrEqual(VIEW_W);
    expect(t2 + mh).toBeLessThanOrEqual(VIEW_H);
    const paneStyle = /data-testid="research-family-pane"[^>]*style=\{\{([^}]*)\}\}/.exec(console_)![1];
    const paneH = Number((paneStyle.match(/maxHeight: *(\d+)/) ?? [0, '0'])[1]);
    expect(t2 + 78 + paneH).toBeLessThanOrEqual(VIEW_H);   // header + truth strip + tabs above the pane

    expect(gate.match(/frames1280\.push|frames640\.push/g)?.length).toBe(2);

    re(gate, 'count>=11');
  });
  it('keeps the other two research views reachable and refuses a purchase the ledger did not price', () => {
    re(gate, "tabText\\('Blueprints'\\)");
    re(gate, "tabText\\('Specimens & Cores'\\)");
    // `.console-h` is CSS-uppercased and innerText() returns the TRANSFORMED text, so a case-sensitive
    // heading match is a trap that already cost one CI run: the gate failed with "the Blueprints view lost
    // its directed-study list" against a screen that plainly said DIRECTED STUDY. Section titles /i.
    re(gate, '/Directed study/i');
    re(gate, '/Specimen \\\\/ Core study/i');
    re(gate, '/Tinker/i');
    expect(gate).toContain('rec.research.headingPainted');
    re(gate, "getByTestId\\('family-row-ENERGY'\\)\\.getByRole\\('button'\\)");
    re(gate, 'energyRow,0');
    // raw source commentary inside JSX: counted on every tab, since that is where the leak actually was
    re(gate, 'const leakFree=');
    expect(gate).toContain('/\\/\\/|\\bTODO\\b|ContainerPanel|ResearchBody|StationConsole');
    expect(gate.match(/leakFree\(/g)?.length).toBe(3);   // three calls: the ledger plus both craft views
  });
  it('wires the proof into CI as a real file, not as a YAML-embedded string', () => {
    // The proof step is the only thing standing between "the gate exited 0" and "the panel was readable".
    // It must therefore be checkable here: a script in the repo, invoked by path, with no quoting layer
    // between the YAML and the JavaScript that decides the verdict.
    const wf = read('../../.github/workflows/pa1-building-browser.yml');   // repo root, one level above web/
    const step = wf.slice(wf.indexOf('- name: Publish the visibility proof'));
    expect(step.slice(0, 900), 'the proof step no longer runs the checked-in script')
      .toMatch(/run: node scripts\/pa1-research-proof\.mjs/);
    expect(step.slice(0, 900), 'an inline node -e inside YAML is how a broken proof reported success')
      .not.toContain("node -e '");
    expect(step.slice(0, 900)).toContain('if: always()');   // a red gate is exactly when the table matters
    expect(wf).toContain("- 'web/scripts/pa1-research-proof.mjs'");
    const proof = read('../scripts/pa1-research-proof.mjs');
    expect(proof).toContain('inPane !== true');
    expect(proof).toContain('the Technology tab was never clicked');
    expect(proof).toContain('CORE_SPECIFIC');
    // The digest is what a reviewer without artifact access can read; if it disappears, the run's
    // evidence is only as good as GitHub's UI.
    expect(proof).toContain('::');
    expect(proof).toContain('title=PA1 research visibility proof');
    expect(proof).toContain(".replace(/%/g, '%25')");
  });
  it('rejects the two shapes this branch already shipped by mistake', () => {
    // (a) a gate satisfied by text anywhere in the panel; (b) a ledger buried at the end of the make column
    expect(gate).not.toMatch(/assert\.ok\(\(await panel\(\)\.count\(\)\)>0,'the family list is not on screen/);
    expect(console_).toMatch(/tab === 'families'/);
    expect(console_).toMatch(/data-testid="research-family-pane"/);
    // the pane must not be the 142 px strip the two-column body used, or "visible" is a lie again
    const pane = console_.match(/data-testid="research-family-pane"[^>]*style=\{\{([^}]*)\}\}/);
    expect(pane, 'the family pane lost its own sizing').toBeTruthy();
    expect(pane![1]).toMatch(/maxHeight: *246/);
    expect(pane![1]).toMatch(/overflowY: *'auto'/);
    expect(pane![1]).not.toMatch(/maxHeight: *142/);
    // the ledger is rendered exactly once by the console (its own tab), and the justification prose that
    // used to sit in the JSX children list — where it painted as text — must stay out of the component.
    expect(console_.match(/<ResearchFamilies/g)?.length).toBe(1);
    expect(console_).not.toMatch(/belongs in the console the router actually opens/);
    expect(console_).not.toMatch(/invisible in the shipped game/);
  });
  it('pins the Node-side companion check that covers all three tabs', () => {
    // A Chromium gate that measures only the tab it opened would miss a `//` line painted by the other
    // two, so the render test next door has to keep looping over make/study/families. If this goes red
    // the loop was narrowed, and a narrowed loop is how an invisible panel got shipped as visible.
    const unit = read('pa1-research-console.test.tsx');
    expect(unit).toMatch(/const TABS = \['make', 'study', 'families'\]/);
    expect(unit).toMatch(/renderStation\(gs, table\.id, tab\)/);
    expect(unit).toContain('not.toMatch(/\\/\\//)');
  });
});
