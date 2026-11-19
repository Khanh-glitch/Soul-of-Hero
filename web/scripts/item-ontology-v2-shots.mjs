// Item Ontology V2 round 3: Survivor item-info layout sweep + screenshots at the 640x360 stage.
// Sandbox tool, not CI: needs `npm i @sparticuz/chromium@131 playwright-core@1.55.1` in the directory it is run from, a QA dev
// server on :5199 (VITE_SOH_QA=1 npx vite --port 5199), and env PLAN={"<preset>":["<item>"|"*"|"ALL"]}, SAVE=1, OUT, REPORT.
// A row passes when fail=[] (name visible, nothing clipped, action buttons inside the panel, panel does not scroll).
import chromium from '@sparticuz/chromium'; import { chromium as pw } from 'playwright-core'; import fs from 'fs';
const OUT = process.env.OUT || '/home/user/Soul-of-Hero/web/evidence/item-ontology-v2/screens';
const SAVE = process.env.SAVE === '1';
const exe = await chromium.executablePath(); let b;
const report = [];
async function open(preset) {
  b = await pw.launch({ executablePath: exe, args: chromium.args, headless: true });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(1500);
  await p.getByText('Full-Gear QA Sandbox').first().click(); await p.waitForTimeout(400);
  await p.locator(`[data-testid="qa-preset-${preset}"]`).click(); await p.getByText('Launch QA Sandbox').click();
  await p.waitForFunction(() => window.__soh?.run, null, { timeout: 20000 }); await p.waitForTimeout(1500);
  return { p, errs, ctx };
}
const measure = () => {
  const vw = innerWidth, vh = innerHeight; const R = e => { const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  const left = document.querySelector('.sv-left'); const lr = left.getBoundingClientRect();
  const inside = (r, o) => r.x >= o.x - .5 && r.y >= o.y - .5 && r.x + r.w <= o.x + o.w + .5 && r.y + r.h <= o.y + o.h + .5;
  const vp = { x: 0, y: 0, w: vw, h: vh }; const lbox = { x: lr.x, y: lr.y, w: lr.width, h: lr.height };
  const out = { viewport: { w: vw, h: vh }, svLeft: R(left), svLeftScroll: { scrollH: left.scrollHeight, clientH: left.clientHeight, scrollTop: left.scrollTop }, parts: {}, controls: [], fail: [] };
  const info = document.querySelector('.sv-left [data-testid="iteminfo"]'); const ir = R(info);
  out.parts.iteminfo = { ...ir, scrollH: info.scrollHeight, clientH: info.clientHeight };
  for (const id of ['iteminfo-name', 'iteminfo-vi', 'iteminfo-class', 'iteminfo-coreline', 'iteminfo-desc', 'iteminfo-uses']) {
    const e = info.querySelector(`[data-testid="${id}"]`); if (!e) { out.parts[id] = null; continue; }
    const r = R(e); const cs = getComputedStyle(e);
    const o = { ...r, text: (e.textContent || '').slice(0, 70), scrollW: e.scrollWidth, clientW: e.clientWidth, scrollH: e.scrollHeight, clientH: e.clientHeight, inViewport: inside(r, vp), inPanel: inside(r, lbox), inInfo: inside(r, ir), fontPx: cs.fontSize };
    o.clipped = (e.scrollWidth > e.clientWidth + 1 && cs.display !== 'inline') || e.scrollHeight > e.clientHeight + 1 && cs.display !== 'inline' || r.h < 6;
    out.parts[id] = o; if (!o.inViewport || !o.inPanel || !o.inInfo || o.clipped) out.fail.push(id);
  }
  for (const e of [...document.querySelectorAll('.sv-left .sv-itemacts button'), document.querySelector('.sv-left .sv-packlabel button')]) {
    const r = R(e); const cx = r.x + r.w / 2, cy = r.y + r.h / 2; const hit = document.elementFromPoint(cx, cy);
    const o = { label: e.textContent.trim(), ...r, center: [+cx.toFixed(1), +cy.toFixed(1)], inViewport: inside(r, vp), inPanel: inside(r, lbox), hitOk: !!hit && (hit === e || e.contains(hit)), hit: hit ? hit.tagName + '.' + hit.className : null, disabled: e.disabled };
    out.controls.push(o); if (!o.inViewport || !o.inPanel || !o.hitOk) out.fail.push('control:' + o.label);
  }
  // right-hand work panel must survive the narrower column: no horizontal overflow, every visible control hittable
  const right = document.querySelector('.sv-right'); const rr = right.getBoundingClientRect(); const rbox = { x: rr.x, y: rr.y, w: rr.width, h: rr.height };
  out.svRight = { ...R(right), scrollW: right.scrollWidth, clientW: right.clientWidth, scrollH: right.scrollHeight, clientH: right.clientHeight };
  if (right.scrollWidth > right.clientWidth + 1 || right.scrollHeight > right.clientHeight + 1) out.fail.push('right-overflow');
  out.rightControls = [];
  for (const e of right.querySelectorAll('.sv-cat, .sv-filter .btn, .sv-filter input, .sv-detail button')) {
    const r = R(e); const hit = document.elementFromPoint(r.x + r.w / 2, r.y + r.h / 2);
    const o = { label: (e.textContent || e.placeholder || '').trim().slice(0, 24), ...r, inPanel: inside(r, rbox), hitOk: !!hit && (hit === e || e.contains(hit)), textFits: e.scrollWidth <= e.clientWidth + 1 };
    out.rightControls.push(o); if (!o.inPanel || !o.hitOk || !o.textFits) out.fail.push('right:' + o.label);
  }
  const grid = document.querySelector('.sv-left .dgrid'); const gr = R(grid); out.parts.dgrid = gr; if (!inside(gr, lbox)) out.fail.push('grid-outside-panel');
  for (const e of document.querySelectorAll('.sv-left .dgrid-row > *')) { if (!inside(R(e), lbox)) { out.fail.push('slot-outside-panel'); break; } }
  for (const e of document.querySelectorAll('.sv-char .stat, .sv-char .sv-load, .sv-char .sv-eqcell, .sv-char .sv-portrait')) { if (!inside(R(e), lbox)) { out.fail.push('char-outside-panel'); break; } }
  if (info.scrollHeight > info.clientHeight + 1) out.fail.push('iteminfo-overflow');
  if (left.scrollHeight > left.clientHeight + 1) out.fail.push('panel-scrolls');
  return out;
};
async function sel(p, key) {
  const idx = await p.evaluate(k => window.__soh.run.custody.inv.slots.findIndex(s => s && s.key === k), key);
  if (idx < 0) return null; await p.locator('.sv-left .dgrid-row > *').nth(idx).click(); await p.waitForTimeout(250); return idx;
}
const plan = JSON.parse(process.env.PLAN || '{"cores":["core_blast","core_dragon","core_mjolnir","core_fire","core_earth","core_storm","core_frost"],"industry":["spares","mechanical_parts","industrial_axe","iron_ingot","fasteners"]}');
for (const [preset, keys] of Object.entries(plan)) {
  const { p, errs, ctx } = await open(preset);
  const invKeys = await p.evaluate(() => window.__soh.run.custody.inv.slots.map(s => s && s.key));
  if (process.env.LIST) console.log(preset, JSON.stringify(invKeys));
  if (SAVE) await p.screenshot({ path: `${OUT}/01-hud-hotbar-${preset}.png` });
  await p.keyboard.press('KeyI'); await p.waitForSelector('.sv-left'); await p.waitForTimeout(400);
  if (SAVE) await p.screenshot({ path: `${OUT}/02-pack-${preset}.png` });
  if (keys[0] === 'ALL') {
    // every catalog item, shown through the real ItemInfo by swapping the key of one pack stack (display probe only)
    const all = await p.evaluate(() => window.__soh.allItemKeys ? window.__soh.allItemKeys() : null);
    const cat = all || JSON.parse(fs.readFileSync('/tmp/br/keys.json', 'utf8'));
    for (const k of cat) {
      await p.evaluate(k => { const s = window.__soh.run.custody.inv.slots; s[23] = { uid: 'probe-' + k, key: k, qty: 1 }; }, k);
      await p.locator('.sv-left .dgrid-row > *').nth(22).click(); await p.locator('.sv-left .dgrid-row > *').nth(23).click(); await p.waitForTimeout(60);
      const shown = await p.evaluate(() => document.querySelector('.sv-left [data-testid="iteminfo-name"]')?.textContent);
      const m = await p.evaluate(measure); report.push({ preset, key: k, shown, ...m });
    }
    await b.close().catch(() => {}); continue;
  }
  const list = keys[0] === '*' ? [...new Set(invKeys.filter(Boolean))] : keys;
  for (const k of list) {
    const i = await sel(p, k); if (i === null) { report.push({ preset, key: k, missing: true }); continue; }
    const m = await p.evaluate(measure); report.push({ preset, key: k, slot: i, ...m });
    if (SAVE && keys[0] !== '*') await p.screenshot({ path: `${OUT}/03-iteminfo-${k}.png` });
  }
  if (errs.length) report.push({ preset, pageErrors: errs }); await b.close().catch(() => {});
}
fs.writeFileSync(process.env.REPORT || '/tmp/br/layout.json', JSON.stringify(report, null, 1));
for (const r of report) console.log(r.preset, r.key, r.missing ? 'MISSING' : r.pageErrors ? 'ERR ' + r.pageErrors : `info ${r.parts.iteminfo.h}px bottom ${(r.parts.iteminfo.y + r.parts.iteminfo.h).toFixed(0)} panel ${r.svLeftScroll.scrollH}/${r.svLeftScroll.clientH} fail=[${r.fail}]`);
