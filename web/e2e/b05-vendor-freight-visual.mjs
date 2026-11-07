// B05-R vendor freight — REAL browser input path.
// Real: mouse cursor moved to the trader's rendered stage position; the game's own target prompt; real E key;
//       real clicks on "Parcel" and "Load into this cart"; the game's own move/dispatch results.
// DISCLOSED FIXTURES (state preparation only, never used as a UI shortcut):
//   F1 player stood on a candidate tile beside Mirela (teleport; accepted only if the real prompt then resolves to Mirela);
//   F2 profile secured cash set to 20 (affordability);
//   F3 pack filled with stone and one cart_kit written into inventory (to prove loading without pack room);
//   F4 cart deployed by the real placeCart action (through the QA passthrough, same dispatch).
// Output: evidence/b05-vendor-freight/ (PNG + results.json). Node script; no survival bot.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = 'evidence/b05-vendor-freight'; await fs.mkdir(out, { recursive: true });
const snap = await fs.readFile('evidence/w08m3-industrial/save.json', 'utf8');
const browser = await chromium.launch({ headless: true, executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const results = { fixtures: [], steps: [], shots: [], errors: [] };
const log = (vn, step, data) => results.steps.push({ viewport: vn, step, ...data });

async function openGame(vp) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(v => localStorage.setItem('soh.state.v3', v), snap);
  const page = await ctx.newPage();
  page.on('pageerror', e => results.errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4410', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await page.waitForFunction(() => window.__soh?.run, null, { timeout: 20000 });
  for (let i = 0; i < 4; i++) {                      // "While you were away" and similar overlays
    await page.waitForTimeout(500);
    const c = page.getByRole('button', { name: 'Close', exact: true }).first();
    if (!(await c.isVisible().catch(() => false))) break;
    await c.click(); await page.waitForTimeout(300);
  }
  return { ctx, page };
}
// stage (mouse) coordinates of a world point, from the game's own camera + stage transform
const stageOf = (page, wx, wy) => page.evaluate(([x, y]) => { const v = window.__sohView(); return { x: v.off.x + (x - v.cam.x) * v.scale, y: v.off.y + (y - v.cam.y) * v.scale }; }, [wx, wy]);
async function aimAt(page, wx, wy) { const s = await stageOf(page, wx, wy); await page.mouse.move(s.x, s.y); await page.waitForTimeout(350); return page.evaluate(() => window.__sohView().target); }
const shot = async (page, name, vn, what) => { const p = `${out}/${name}-${vn}.png`; await page.screenshot({ path: p }); results.shots.push({ path: p, viewport: vn, what }); };
const panelHas = (page, text) => page.getByText(text, { exact: false }).first().isVisible().catch(() => false);

try {
  for (const [vn, vp] of [['1280x720', { width: 1280, height: 720 }], ['640x360', { width: 640, height: 360 }]]) {
    const { ctx, page } = await openGame(vp);
    const vend = await page.evaluate(() => { const r = window.__soh.run; const v = Object.values(r.entities).find(e => e.kind === 'vendor'); return { id: v.id, x: v.x, y: v.y }; });
    await page.evaluate(() => { window.__soh.profile.securedCash = 20; });
    results.fixtures.push({ viewport: vn, F2: 'profile secured cash set to 20 (affordability only)' });

    // F1 + real aim: try stand tiles beside Mirela until the REAL target prompt resolves to the trader
    let stand = null; const tried = [];
    for (const [dx, dy] of [[14, 30], [-14, 30], [30, 0], [-30, 0], [0, 36], [24, 24], [-24, 24], [0, -30], [40, 10]]) {
      await page.evaluate(([x, y]) => { const p = window.__soh.run.player; p.x = x; p.y = y; }, [vend.x + dx, vend.y + dy]);
      const t = await aimAt(page, vend.x, vend.y);
      const pos = await page.evaluate(() => ({ x: window.__soh.run.player.x, y: window.__soh.run.player.y }));
      tried.push({ dx, dy, target: t?.kind ?? null, label: t?.label ?? null, pos });
      if (t?.kind === 'vendor' && Math.abs(pos.x - (vend.x + dx)) < 1 && Math.abs(pos.y - (vend.y + dy)) < 1) { stand = { dx, dy }; break; }
    }
    results.fixtures.push({ viewport: vn, F1: 'stand tile beside Mirela; accepted only when the real prompt resolves to the trader', tried, stand });
    if (!stand) throw Error(`no stand tile resolved a real Trade prompt at ${vn}: ${JSON.stringify(tried)}`);
    await page.waitForTimeout(200);
    const prompt = await page.evaluate(() => { const v = window.__sohView(); return v.target; });
    log(vn, 'real prompt before E', { target: prompt, player: await page.evaluate(() => ({ x: window.__soh.run.player.x, y: window.__soh.run.player.y })), vendor: vend });
    await shot(page, 'trader-prompt', vn, 'Mirela prompt visible in world (real mouse aim)');

    await page.keyboard.press('KeyE'); await page.waitForTimeout(500);
    const vOpen = await panelHas(page, 'Mirela the Trader');
    log(vn, 'press E', { vendorPanelVisible: vOpen });
    if (!vOpen) throw Error('VendorPanel did not open from a real E press');
    await shot(page, 'vendor-panel', vn, 'VendorPanel opened by real E');

    const before = await page.evaluate(() => { const r = window.__soh.run; return { securedCash: window.__soh.profile.securedCash, medkitStock: r.vendorStock.medkit, parcels: Object.values(r.entities).filter(e => e.parcel).length, packMedkit: r.custody.inv.slots.filter(s => s?.key === 'medkit').length }; });
    await page.getByRole('button', { name: 'Parcel' }).nth(2).click(); await page.waitForTimeout(400); // third secured good = Field Medkit
    const afterBuy = await page.evaluate(() => { const r = window.__soh.run; const ps = Object.values(r.entities).filter(e => e.parcel); return { securedCash: window.__soh.profile.securedCash, medkitStock: r.vendorStock.medkit, parcels: ps.map(e => ({ id: e.id, label: e.label, purchaseId: e.parcel.purchaseId, x: e.x, y: e.y, uid: r.custody[e.c].slots.find(Boolean)?.uid, key: r.custody[e.c].slots.find(Boolean)?.key })), packMedkit: r.custody.inv.slots.filter(s => s?.key === 'medkit').length }; });
    log(vn, 'click Parcel (Field Medkit)', { before, afterBuy, debitedOnce: before.securedCash - afterBuy.securedCash === 4 && before.medkitStock - afterBuy.medkitStock === 1 && afterBuy.parcels.length === 1 && afterBuy.packMedkit === 0 });
    if (afterBuy.parcels.length !== 1) throw Error('expected exactly one parcel after one purchase');
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === '✕'); b?.click(); });
    await page.waitForTimeout(300);
    await shot(page, 'parcel-at-trader', vn, 'purchased parcel beside Mirela (world)');

    // F3: fill the pack and put a packed cart into it; F4: deploy the cart via the real placeCart action
    await page.evaluate(() => { const r = window.__soh.run; for (let i = 0; i < r.custody.inv.slots.length; i++) r.custody.inv.slots[i] = { uid: 'fixture-stone-' + i, key: 'stone', qty: 99 }; r.custody.inv.slots[0] = { uid: 'fixture-cart-kit', key: 'cart_kit', qty: 1 }; });
    const placed = await page.evaluate(() => {
      const r = window.__soh.run; const p = r.player; const tries = [[26, 0], [-26, 0], [0, 26], [0, -26], [30, 20], [-30, 20]];
      for (const [dx, dy] of tries) { const res = window.__sohAct('placeCart', { x: p.x + dx, y: p.y + dy }); if (res?.ok) return { ok: true, dx, dy }; }
      return { ok: false };
    });
    results.fixtures.push({ viewport: vn, F4: 'cart deployed by real placeCart dispatch', placed });
    if (!placed.ok) throw Error('placeCart failed');
    await page.waitForTimeout(300);
    // re-fill the slot that placeCart freed so the pack is genuinely FULL when the parcel is loaded (fixture F3b)
    const packBefore = await page.evaluate(() => { const r = window.__soh.run; for (let i = 0; i < r.custody.inv.slots.length; i++) if (!r.custody.inv.slots[i]) r.custody.inv.slots[i] = { uid: 'fixture-stone-refill-' + i, key: 'stone', qty: 99 }; return { filled: r.custody.inv.slots.filter(Boolean).length, total: r.custody.inv.slots.length }; });
    results.fixtures.push({ viewport: vn, F3: 'pack filled with stone (fixture); placeCart consumed the cart_kit; freed slot refilled so the pack is full before loading', packSlotsFilled: packBefore });
    if (packBefore.filled !== packBefore.total) throw Error('pack not full');

    // REAL: aim at the parcel, see its prompt, press E
    const parcelAt = afterBuy.parcels[0];
    const tp = await aimAt(page, parcelAt.x, parcelAt.y);
    log(vn, 'aim at parcel (real mouse)', { target: tp });
    if (!tp || !/Parcel/.test(tp.label || '')) throw Error('parcel prompt did not resolve: ' + JSON.stringify(tp));
    await page.keyboard.press('KeyE'); await page.waitForTimeout(500);
    const pOpen = await panelHas(page, 'Paid parcel');
    log(vn, 'press E on parcel', { parcelPanelVisible: pOpen });
    await shot(page, 'parcel-panel', vn, 'Paid parcel panel with Load into nearby cart');
    const loadBtn = page.getByRole('button', { name: 'Load into this cart' }).first();
    if (!(await loadBtn.isVisible().catch(() => false))) throw Error('Load into this cart not visible');
    await loadBtn.click(); await page.waitForTimeout(400);
    const after = await page.evaluate(() => { const r = window.__soh.run; const ps = Object.values(r.entities).filter(e => e.parcel); const cart = Object.values(r.entities).find(e => e.kind === 'cart'); const cc = cart ? r.custody[cart.c].slots.filter(Boolean) : []; return { parcelsLeft: ps.length, cartCargo: cc.map(s => ({ key: s.key, qty: s.qty, uid: s.uid })), packMedkit: r.custody.inv.slots.filter(s => s?.key === 'medkit').length, packSlotsFilled: r.custody.inv.slots.filter(Boolean).length, securedCash: window.__soh.profile.securedCash }; });
    log(vn, 'click Load into this cart', { after, uidPreserved: after.cartCargo.some(c => c.uid === parcelAt.uid), packUnchanged: after.packSlotsFilled === packBefore.filled, packWasFull: packBefore.filled === packBefore.total });
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === '✕'); b?.click(); });
    await page.waitForTimeout(300);
    await shot(page, 'cart-with-cargo', vn, 'cart after parcel load; pack still full');
    await ctx.close();
  }
  if (results.errors.length) throw Error(results.errors.join('; '));
  console.log('DONE');
} catch (e) {
  results.failure = String(e.message || e);
  console.log('FAILED:', results.failure);
  process.exitCode = 1;
} finally {
  await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 1));
  await browser.close();
}
