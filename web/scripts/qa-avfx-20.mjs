// AVFX #20 Reality Ripper visual QA — real primary game, WebGL2 presenter.
// Captures BEFORE/OPENING/CLIMAX/RESTITCH/AFTER in a bright clearing (day) and a
// dark structured area (night). GPU gate: exit 2 unless presenter.mode==='webgl2'
// (QA_ALLOW_FALLBACK=1 only for logic smoke).
import { chromium } from 'playwright';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const OUT = 'evidence/avfx-20';
mkdirSync(OUT, { recursive: true });
const ALLOW_FALLBACK = process.env.QA_ALLOW_FALLBACK === '1';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/favicon.ico') { s.writeHead(204); s.end(); return; }
  let f = p === '/' ? join('dist', 'index.html') : (existsSync(join('dist', p)) ? join('dist', p) : join('.', p));
  try { const d = readFileSync(f); s.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); s.end(d); }
  catch { s.writeHead(404); s.end(); }
}).listen(4331);

const b = await chromium.launch({
  executablePath: process.env.QA_CHROME || undefined,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await page.goto('http://localhost:4331/'); await page.waitForTimeout(2500);
await page.getByText('New run').click(); await page.waitForTimeout(400);
await page.getByText('Meadow Bay').click(); await page.getByText('Begin the 14 days').click(); await page.waitForTimeout(2000);

const report = { errors, softwareGL: true };
report.webgl2Probe = await page.evaluate(() => ({
  webgl2: !!document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: false }),
  presenterMode: window.__presenter?.mode ?? 'none',
}));
if (!ALLOW_FALLBACK && report.webgl2Probe.presenterMode !== 'webgl2') {
  console.log('GPU GATE FAILED:', JSON.stringify(report.webgl2Probe));
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  await b.close(); srv.close(); process.exit(2);
}

const PHASES = [['t0.6', 0.6], ['t1.3', 1.3], ['t2.7', 2.7], ['t4.5', 4.5], ['t6.6', 6.6], ['t7.8', 7.8], ['t9.5', 9.5], ['t9.85', 9.85], ['after', 10.8]];
const MODES = ['current', 'restored'];

// SEMANTIC bridge direct renders (CPU source frame, inspectable without WebGL)
for (const [name, t] of [['sem-1.3', 1.3], ['sem-4.5', 4.5], ['sem-6.6', 6.6], ['sem-7.8', 7.8], ['sem-9.85', 9.85]]) {
  await page.evaluate(tt => window.__d20qa.client.qaSemFrame(tt), t);
  await page.waitForTimeout(700);
  const el = page.locator('#d20sem');
  if (await el.count()) await el.screenshot({ path: `${OUT}/SEM-${name}.png` });
}
await page.evaluate(() => { const el = document.getElementById('d20sem'); if (el) el.remove(); }); // no overlay in gameplay captures
report.semanticBridge = 'source Frame + donor spell, CPU composite, real world base';

// REFERENCE ground truth: creator-approved Visual Master, cast #20, matched timestamps
const refPage = await b.newPage({ viewport: { width: 1280, height: 720 } });
await refPage.goto('http://localhost:4331/releases/reference-arcana20-visual-master.html');
await refPage.waitForTimeout(4000);
await refPage.evaluate(() => { if (typeof select === 'function') select(19); });
await refPage.waitForTimeout(1200);
for (const [name, t] of PHASES) {
  await refPage.evaluate(tt => { if (typeof setPhase === 'function') setPhase(Math.min(1, tt / 10.4)); }, t);
  await refPage.waitForTimeout(1800); // iframe message round-trip + render
  const frame = refPage.locator('.render iframe').first();
  if (await frame.count()) await frame.screenshot({ path: `${OUT}/REF-${name}.png` });
  else await refPage.screenshot({ path: `${OUT}/REF-${name}.png` });
}
// ARCANA20 gallery: one capture per registered skill at its climax-ish time
report.gallery = [];
const cat = await page.evaluate(() => (window.__arcanaLab?.catalog ?? []).map(c => ({ index: c.index, id: c.id, name: c.name, status: c.previewStatus, lead: c.approvedVisualLead, src: c.currentlyRenderedSource, dur: c.dur, climax: c.climax })));
for (const c of cat) {
  await page.evaluate(cc => { window.__arcanaLab.cast(cc.index, 'lead'); window.__arcanaLab.seek(Math.min(cc.climax + 0.4, cc.dur * 0.62), cc.index, 'lead'); }, c);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}/gallery-${String(c.id).padStart(2, '0')}.png` });
  report.gallery.push({ id: c.id, name: c.name, status: c.status, lead: c.lead, rendered: c.src });
}
// phase-3 decisive trio: #11 lead (pure A) / study (C) / fusion (A#11 + C#09 recipe) + B#02 boundary check
report.phase3 = {};
for (const [tag, mode] of [['11-lead', 'lead'], ['11-study', 'study'], ['11-fusion', 'fusion']]) {
  await page.evaluate(m => { const c = window.__arcanaLab.catalog.find(x => x.id === 11); window.__arcanaLab.cast(c.index, m); window.__arcanaLab.seek(Math.min(c.climax + 0.4, c.dur * 0.62), c.index, m); }, mode);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}/gallery-${tag}.png` });
  report.phase3[tag] = await page.evaluate(() => window.__arcanaLab.info().currentlyRenderedSource);
}
// phase 4: three motion phases of #11 (opening / buildup / peak) in all modes
for (const [tag, t] of [['11-open', 1.0], ['11-build', 3.0], ['11-peak', 5.3]]) {
  for (const mode of ['lead', 'fusion']) {
    await page.evaluate(([tt, m]) => { const c = window.__arcanaLab.catalog.find(x => x.id === 11); window.__arcanaLab.cast(c.index, m); window.__arcanaLab.seek(tt, c.index, m); }, [t, mode]);
    await page.waitForTimeout(650);
    await page.screenshot({ path: `${OUT}/gallery-${tag}-${mode}.png` });
  }
}
report.phase3.phases = ['1.0 lead/fusion', '3.0 lead/fusion', '5.3 lead/fusion'];
{ const c = await page.evaluate(() => window.__arcanaLab.catalog.find(x => x.id === 2));
  await page.evaluate(cc => { window.__arcanaLab.cast(cc.index, 'lead'); window.__arcanaLab.seek(1.6, cc.index, 'lead'); }, c);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}/gallery-02-lead.png` });
  await page.evaluate(() => window.__qaNight(true)); // day->night with same cast: no stale world
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}/gallery-02-lead-night.png` });
  await page.evaluate(() => window.__qaNight(false));
  // lifecycle: recast + OUT on #09 fusion
  const c9 = await page.evaluate(() => window.__arcanaLab.catalog.find(x => x.id === 9));
  await page.evaluate(cc => { window.__arcanaLab.cast(cc.index, 'fusion'); window.__arcanaLab.seek(2.0, cc.index, 'fusion'); }, c9);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}/gallery-09-fusion.png` });
  await page.evaluate(cc => { window.__arcanaLab.cast(cc.index, 'fusion'); window.__arcanaLab.seek(cc.dur + 1.5, cc.index, 'fusion'); }, c9); // OUT
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}/gallery-09-out.png` });
  await page.evaluate(cc => { window.__arcanaLab.cast(cc.index, 'fusion'); window.__arcanaLab.seek(2.0, cc.index, 'fusion'); }, c9); // recast
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}/gallery-09-recast.png` });
}
for (const fid of [1, 5, 16]) {
  await page.evaluate(f => { const c = window.__arcanaLab.catalog.find(x => x.id === f); window.__arcanaLab.cast(c.index, 'fusion'); window.__arcanaLab.seek(Math.min(c.climax + 0.4, c.dur * 0.62), c.index, 'fusion'); }, fid);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}/gallery-${String(fid).padStart(2, "0")}-fusion.png` });
}
await page.evaluate(() => window.__arcanaLab.stop?.());
report.galleryCount = report.gallery.length;

report.referenceMaster = 'reference-arcana20-visual-master.html cast 20 (creator_approved)';
await refPage.close();

// Replay consistency (A→B→A): collision impact must regenerate identically after seek-back
const replay = {};
await page.evaluate(() => window.__qaNight(false));
await page.evaluate(() => { window.__d20qa.client.mode = 'restored'; window.__d20qa.seek(6.65); });
await page.waitForTimeout(450);
await page.screenshot({ path: `${OUT}/replay-collide-1.png` });
await page.evaluate(() => window.__d20qa.seek(0.5));
await page.waitForTimeout(200);
await page.evaluate(() => window.__d20qa.seek(6.65));
await page.waitForTimeout(450);
await page.screenshot({ path: `${OUT}/replay-collide-2.png` });
replay.done = true;
report.replay = replay;

// Scene A: bright open clearing, DAY — both modes
await page.evaluate(() => window.__qaNight(false));
for (const mode of MODES) {
  await page.evaluate(m => { window.__d20qa.client.mode = m; }, mode);
  for (const [name, t] of PHASES) {
    await page.evaluate(tt => { if (tt >= 0) window.__d20qa.seek(tt); else window.__d20qa.client.cast = null; }, t);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/A-day-${mode}-${name}.png` });
  }
}
// Scene B: night, near structure/trees
await page.evaluate(() => window.__qaNight(true));
await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
for (const mode of MODES) {
  await page.evaluate(m => { window.__d20qa.client.mode = m; }, mode);
  for (const [name, t] of PHASES) {
    await page.evaluate(tt => { if (tt >= 0) window.__d20qa.seek(tt); else window.__d20qa.client.cast = null; }, t);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/B-night-${mode}-${name}.png` });
  }
}
// normal playback smoke: play from 0 for 2.5s, confirm passes flowing then OUT
report.playback = await page.evaluate(async () => {
  window.__d20qa.play();
  const seen = [];
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 500));
    seen.push(window.__comp.collectGpuPasses({ g: null, cam: { x: 0, y: 0 }, now: Date.now(), dark: 0 }).map(l => l.kind + '@t' + l.time.toFixed(1)));
  }
  return { frames: seen, mode: window.__presenter.mode };
});
report.metrics = await page.evaluate(() => {
  const pr = window.__presenter;
  return { mode: pr.mode, worldUploads: pr.worldUploads, layerUploads: pr.layerUploads, gpuPasses: pr.gpuPasses, postCalls: pr.postCalls, glError: pr.lastGlError, firstGlError: pr.firstGlError ?? null, errHistory: (pr.glErrHistory ?? []).slice(0, 32), fbo: pr.fboStatus };
});
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await b.close(); srv.close();
// GL ERROR GATE (CT 6624135398): a real WebGL2 active-frame run must record zero
// GL errors — green tests alone do not prove an error-free GPU frame graph.
// The exit code encodes the FIRST error stage so it is readable from the
// check-run annotation even though logs are not downloadable from the sandbox.
const stageExit = (s) =>
  !s ? 99 : s === 'upload-frame' ? 101 : s === 'upload-frame-delta' ? 102 : s === 'world-upload' ? 103 :
  s === 'accum-seed' ? 104 : s === 'zero-cast-post' ? 105 : s.startsWith('layer-warp-upload') ? 111 : s.startsWith('layer:frame') ? (s.includes(':signed') ? 107 : 106) :
  s.startsWith('layer:') ? 108 : s === 'final-post' ? 109 : 110;
if (report.metrics.glError !== 0 || (report.metrics.firstGlError && report.metrics.firstGlError.code !== 0)) {
  const fg = report.metrics.firstGlError;
  console.log('GL ERROR GATE FAILED:', JSON.stringify({ glError: report.metrics.glError, firstGlError: fg, errHistory: report.metrics.errHistory }));
  process.exit(fg ? stageExit(fg.stage) : (report.metrics.glError !== 0 ? 99 : 3));
}
process.exit(errors.length ? 1 : 0);
