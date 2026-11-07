// B05-R freight visual + one short UI interaction: walk up to Mirela, press E, buy a Parcel (real button), see it at the trader.
// CONTROLLED FIXTURE (disclosed in results.json): player relocated beside the trader; profile secured cash set to 20 for affordability.
// Everything after the click is the game's own state. Output: evidence/b05-vendor-freight/*.png and results.json.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = 'evidence/b05-vendor-freight'; await fs.mkdir(out, { recursive: true });
const snap = await fs.readFile('evidence/w08m3-industrial/save.json', 'utf8');
const browser = await chromium.launch({ headless: true, executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const results = { fixtures: [], steps: [], shots: [], errors: [] };
async function open(vp) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(v => localStorage.setItem('soh.state.v3', v), snap);
  const page = await ctx.newPage();
  page.on('pageerror', e => results.errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4410', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Continue/i }).first().click();
  const ov = page.getByRole('button', { name: 'Continue', exact: true });
  if (await ov.isVisible().catch(() => false)) await ov.click();
  await page.waitForFunction(() => window.__soh?.run, null, { timeout: 20000 });
  // "While you were away" overlay: close it (and any other overlay) before fixtures
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(500);
    const close = page.getByRole('button', { name: 'Close', exact: true }).first();
    if (!(await close.isVisible().catch(() => false))) break;
    await close.click(); await page.waitForTimeout(300);
  }
  return { ctx, page };
}
const shot = async (page, name, vn, target, state) => { const p = `${out}/${name}-${vn}.png`; await page.screenshot({ path: p }); results.shots.push({ path: p, viewport: vn, target, state }); };
try {
  for (const [vn, vp] of [['640x360', { width: 640, height: 360 }], ['1280x720', { width: 1280, height: 720 }]]) {
    const { ctx, page } = await open(vp);
    const f = await page.evaluate(() => {
      const r = window.__soh.run; const v = Object.values(r.entities).find(e => e.kind === 'vendor');
      r.player.x = v.x + 12; r.player.y = v.y + 26; r.player.aim = Math.atan2(v.y - r.player.y, v.x - r.player.x); window.__soh.profile.securedCash = 20;
      return { vendor: { id: v.id, x: v.x, y: v.y }, player: { x: r.player.x, y: r.player.y }, securedCash: 20, parcelsBefore: Object.values(r.entities).filter(e => e.parcel).length };
    });
    results.fixtures.push({ viewport: vn, kind: 'player relocated beside Mirela and aimed at her (interaction target uses aim); profile secured cash set to 20 (affordability only)', ...f });
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
    const panel = page.getByText('Mirela the Trader', { exact: false });
    results.steps.push({ viewport: vn, step: 'press E at trader', panelVisible: await panel.isVisible().catch(() => false) });
    await shot(page, 'vendor-panel', vn, 'vendor panel', 'before purchase');
    // VENDOR_SECURED order is iron_pick, iron_axe, medkit, …: the third Parcel button is Field Medkit
    await page.getByRole('button', { name: 'Parcel' }).nth(2).click(); await page.waitForTimeout(400);
    results.steps.push({ viewport: vn, step: 'click Parcel on Field Medkit', state: await page.evaluate(() => { const r = window.__soh.run; const p = Object.values(r.entities).filter(e => e.parcel); return { parcels: p.map(e => ({ id: e.id, label: e.label, purchaseId: e.parcel.purchaseId, item: e.parcel.item, x: e.x, y: e.y, uid: r.custody[e.c].slots.find(Boolean)?.uid })), securedCash: window.__soh.profile.securedCash, medkitStock: r.vendorStock.medkit, packMedkits: r.custody.inv.slots.filter(s => s?.key === 'medkit').length }; }) });
    await shot(page, 'vendor-panel-after-parcel', vn, 'vendor panel', 'after paid parcel: waiting count shown');
    await page.getByRole('button', { name: 'Close', exact: true }).first().click().catch(() => {}); await page.waitForTimeout(400);
    await shot(page, 'parcel-at-trader', vn, 'parcel beside Mirela', 'parcel ready to collect in the world');
    await ctx.close();
  }
  if (results.errors.length) throw Error(results.errors.join('; '));
  console.log('OK', JSON.stringify(results.steps, null, 1));
} finally {
  await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 1));
  await browser.close();
}
