// ============================================================================
// PA1 RESEARCH VISIBILITY PROOF — read the Chromium manifest and refuse to call it evidence unless the
// panel was actually painted on screen.
//
// Why this is a file and not an inline `node -e '...'` inside the workflow YAML: an earlier revision of
// this step carried `\"` escapes into the script, and `\"` is a JavaScript syntax error inside a shell
// single-quoted string. The step still reported success. That is the worst possible failure mode for a
// proof — a green check that never evaluated anything — and it is the same mistake this branch has now
// been held for three times (a route the router skips, a panel below a clipped scroll area, and here an
// assertion that never ran). A real file parses, survives `node --check`, and can be pointed at a fixture
// inside this sandbox, so the proof of the proof is testable without a browser.
//
// Exit discipline: 1 only when the gate CLAIMED success (`PASS_BROWSER_UI`) but the claim is not backed by
// legibility frames; 0 when the gate itself already failed, because that step is the red one and this one
// exists to publish whatever was captured before the throw.
// ============================================================================
import { readFileSync, existsSync, readdirSync, appendFileSync } from 'node:fs';

const FAMS = ['ENERGY', 'METALLURGY', 'MOBILITY', 'ELECTRICAL', 'AGRICULTURE', 'ARMORY',
  'EXPLORATION', 'ARCANA', 'STEEL', 'DEFENSE', 'CORE_SPECIFIC'];
const mf = process.env.MANIFEST || 'evidence/pa1-research-visible/manifest.json';
const dir = mf.replace(/\/[^/]*\.json$/, '');   // the evidence folder, whatever the manifest is named

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
const flush = () => {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n\n');
};

say('## PA1 research panel — what the browser actually painted');
say('');
if (!existsSync(mf)) {
  say(`**NO EVIDENCE:** the gate wrote no manifest at \`${mf}\` — it died before recording anything.`);
  flush();
  console.log('PA1_RESEARCH_PROOF ' + JSON.stringify({ status: 'NO_MANIFEST', manifest: mf }));
  process.exit(0);
}

const m = JSON.parse(readFileSync(mf, 'utf8'));
const r = m.research || {};
const bad = [];
const gateFailed = m.status !== 'PASS_BROWSER_UI';
if (gateFailed) bad.push(`browser gate status=${m.status}${m.failure ? ' :: ' + m.failure : ''}`);
if (r.open !== true) bad.push('panel never opened');
if (r.tabClicked !== true) bad.push('the Technology tab was never clicked');
for (const k of ['frames1280', 'frames640']) {
  const f = r[k] || [];
  if (f.length < 3) bad.push(`${k} is missing per-element frames for the heading, the ENERGY row and the last row`);
  for (const e of f) {
    if (!e.visible || !e.fits || e.inPane !== true || e.inPanel !== true || e.hitTest !== 'hits-element') {
      bad.push(`${k}:${e.label} not readable ${JSON.stringify(e)}`);
    }
  }
}
const seen = r.families || [];
if (seen.length < FAMS.length) bad.push(`only ${seen.length} of ${FAMS.length} families read from the screen`);
for (const fam of FAMS) if (!seen.includes(fam)) bad.push(`${fam} never appeared on screen`);
if (!/cost recorded \(5 Spares \+ 2 Iron Ingot\)/.test(r.energyRow || '')) bad.push('the ENERGY cost row is not in the captured text');
if (!/nothing withheld in this build/.test(r.energyRow || '')) bad.push('the unapproved ENERGY family does not state that nothing is withheld');
if ((r.leakCheck || []).length !== 3) bad.push('the leak check did not cover all three tabs');
if (r.purchaseControls && (r.purchaseControls.pane || r.purchaseControls.energyRow)) bad.push('an unapproved family presented a purchase control');
if (!/TECHNOLOGY FAMILIES/i.test(r.text || '')) bad.push('the captured pane text has no heading');

const ok = (e) => !!e && e.visible === true && e.fits === true && e.inPane === true && e.inPanel === true && e.hitTest === 'hits-element';
const frame = (e) => `| ${e.label} | ${e.box.x},${e.box.y} | ${e.box.w}x${e.box.h} | ` +
  `${e.pane ? e.pane.w + 'x' + e.pane.h : '-'} | ${ok(e) ? 'yes' : 'NO'} |`;
const all = (r.frames1280 || []).concat(r.frames640 || []);
say('| element | top-left | size | pane size | readable |');
say('|---|---|---|---|---|');
say(all.length ? all.map(frame).join('\n') : '| (nothing measured) | - | - | - | NO |');
say('');
say(`families read from the screen: ${seen.join(', ') || 'none'}`);
say('');
say(`ENERGY row: \`${String(r.energyRow || '').slice(0, 220)}\``);
say('');
let pngs = [];
try { pngs = readdirSync(dir).filter(f => f.endsWith('.png')).sort(); } catch { pngs = []; }
say(`screenshots (artifact \`pa1-build-palette-<sha>-<attempt>\`, path \`${dir}/\`):`);
say(pngs.length ? pngs.map(f => `- \`${dir}/${f}\``).join('\n') : '- (none on disk at proof time)');
say('');
say(bad.length
  ? `**PROOF INCOMPLETE:** ${bad.join(' · ')}`
  : 'heading, ENERGY row and the last family row sit inside the viewport AND inside the pane box at 1280x720 and 640x360; no purchase control; no source text painted');
flush();
console.log('PA1_RESEARCH_PROOF ' + JSON.stringify({
  status: bad.length ? 'INCOMPLETE' : 'COMPLETE', sha: m.sha, gate: m.status,
  problems: bad.length, frames: all.length, readable: all.filter(e => ok(e)).length,
}));


// Where a reviewer can read it without a browser or artifact access. Job logs and artifact zips redirect
// to Actions blob storage, which is unreachable from an offline sandbox, and step summaries are not in the
// REST API — but annotations ARE (`GET /repos/{o}/{r}/check-runs/{id}/annotations`). So the verdict, the
// failure string and the per-element geometry travel as one annotation, kept under the length a workflow
// command survives. `%` and CR are escaped because that is how the runner reads them.
const short = (m.failure || '').slice(0, 420);
const digest = JSON.stringify({
  status: bad.length ? 'INCOMPLETE' : 'COMPLETE', gate: m.status, failure: short,
  open: r.open === true, tabClicked: r.tabClicked === true, familiesSeen: seen.length,
  problems: bad.slice(0, 4).map(x => x.slice(0, 200)),
  frames: all.map(e => ({
    l: e.label, x: e.box.x, y: e.box.y, w: e.box.w, h: e.box.h,
    visible: e.visible === true, fits: e.fits === true, inPane: e.inPane === true, hit: e.hitTest,
  })),
  purchaseControls: r.purchaseControls || null, leakTabs: (r.leakCheck || []).map(x => x.label),
  energyRow: String(r.energyRow || '').slice(0, 200),
}).slice(0, 4000).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, ' ');   // slice first, so an escape sequence is never cut in half
// capped, because the annotation channel is the only one an offline reviewer can read: the verdict and
// the first problems come first, so a cut tail costs frames, never the diagnosis.

console.log(`::${bad.length ? 'warning' : 'notice'} file=web/evidence/pa1-research-visible/manifest.json,title=PA1 research visibility proof @ ${m.sha}::${digest}`);
if (bad.length && !gateFailed) process.exit(1);
