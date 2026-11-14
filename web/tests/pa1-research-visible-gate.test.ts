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
    re(gate, 'count>=11');
  });
  it('keeps the other two research views reachable and refuses a purchase the ledger did not price', () => {
    re(gate, "tabText\\('Blueprints'\\)");
    re(gate, "tabText\\('Specimens & Cores'\\)");
    re(gate, 'Directed study');
    re(gate, 'Specimen \\\\/ Core study');
    re(gate, "getByTestId\\('family-row-ENERGY'\\)\\.getByRole\\('button'\\)");
    re(gate, 'energyRow,0');
    // raw source commentary inside JSX: counted on every tab, since that is where the leak actually was
    re(gate, 'const leakFree=');
    expect(gate).toContain('/\\/\\/|\\bTODO\\b|ContainerPanel|ResearchBody|StationConsole');
    expect(gate.match(/leakFree\(/g)?.length).toBe(3);   // three calls: the ledger plus both craft views
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
