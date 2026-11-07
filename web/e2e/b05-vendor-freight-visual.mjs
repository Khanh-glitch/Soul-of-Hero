// B05-R vendor freight — DURABLE restart proof with real input. One browser context is kept across every reload,
// so the next load must recover what was actually committed to browser storage.
// REAL input: mouse aim to the trader/parcel/cart on screen, real E, real Parcel / Load / Save / Continue clicks.
// DISCLOSED FIXTURES (state preparation only; mutations go through engine rules, see src/game/qa-fixtures.ts):
//   F1 stand tile beside Mirela: teleport, accepted only when the REAL "Trade with Mirela" prompt resolves;
//   F2 secured cash 20 (affordability only);
//   F3 legal full pack: cart_kit + Stone stacks at 60 max (preparePack);
//   F4 cart deployed by the real placeCart action; the freed slot refilled with a legal Stone stack (fillPack) so the pack is full again before loading.
// The seed save is written ONCE by the init script (guarded by a flag), so reloads never restore the seed.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = 'evidence/b05-vendor-freight'; await fs.mkdir(out, { recursive: true });
const seed = await fs.readFile('evidence/w08m3-industrial/save.json', 'utf8');
const BASE = process.env.GAME_URL || 'http://127.0.0.1:4430';
const browser = await chromium.launch({ headless: true, executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const results = { base: BASE, fixtures: [], milestones: [], shots: [], errors: [], failure: null };
const mark = (vn, name, data) => results.milestones.push({ viewport: vn, milestone: name, ...data });

async function storageRevision(page) {
  // read the committed copies directly (not from the game's memory)
  return page.evaluate(async () => {
    const out = {};
    try { const env = JSON.parse(localStorage.getItem('soh.state.v3') || 'null'); const st = env && JSON.parse(env.payload); out.localStorage = st ? { revision: st.revision, parcels: Object.values(st.run?.entities ?? {}).filter(e => e.parcel).length, securedCash: st.profile.securedCash } : null; } catch (e) { out.localStorage = 'unreadable'; }
    out.idb = await new Promise(res => { try { const q = indexedDB.open('soul-of-hero', 1); q.onsuccess = () => { try { const tx = q.result.transaction('kv', 'readonly'); const g = tx.objectStore('kv').get('state'); g.onsuccess = () => { try { const env = JSON.parse(g.result || 'null'); const st = env && JSON.parse(env.payload); res(st ? { revision: st.revision, parcels: Object.values(st.run?.entities ?? {}).filter(e => e.parcel).length, securedCash: st.profile.securedCash } : null); } catch { res('unreadable'); } }; g.onerror = () => res('read-error'); } catch { res('tx-error'); } }; q.onerror = () => res('open-error'); } catch { res('open-error'); } });
    return out;
  });
}
async function continueRun(page) {
  await page.waitForFunction(() => window.__soh?.run, null, { timeout: 25000 }).catch(() => {});
  if (!(await page.evaluate(() => !!window.__soh?.run))) { await page.getByRole('button', { name: /Continue/i }).first().click(); }
  await page.waitForFunction(() => window.__soh?.run, null, { timeout: 25000 });
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(500);
    const c = page.getByRole('button', { name: 'Close', exact: true }).first();
    if (!(await c.isVisible().catch(() => false))) break;
    await c.click(); await page.waitForTimeout(300);
  }
}
const stageOf = (page, wx, wy) => page.evaluate(([x, y]) => { const v = window.__sohView(); return { x: v.off.x + (x - v.cam.x) * v.scale, y: v.off.y + (y - v.cam.y) * v.scale }; }, [wx, wy]);
async function aimAt(page, wx, wy) { const s = await stageOf(page, wx, wy); await page.mouse.move(s.x, s.y); await page.waitForTimeout(350); return page.evaluate(() => window.__sohView().target); }
const shot = async (page, name, vn, what) => { const p = `${out}/${name}-${vn}.png`; await page.screenshot({ path: p }); results.shots.push({ path: p, viewport: vn, what }); };
const panelHas = (page, text) => page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
const closeTopPanel = (page) => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === '✕'); b?.click(); });
async function menuSave(page) {
  // open the real menu (Escape closes an overlay first, then opens the menu), then the real "Save now" button
  let opened = false;
  for (let i = 0; i < 3 && !opened; i++) {
    await page.keyboard.press('Escape'); await page.waitForTimeout(350);
    opened = await page.getByRole('button', { name: 'Save now' }).first().isVisible().catch(() => false);
  }
  if (!opened) throw Error('menu did not open');
  await page.getByRole('button', { name: 'Save now' }).first().click(); await page.waitForTimeout(900);
  const o = await page.evaluate(() => window.__sohView().lastSave);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  return o;
}
const liveState = (page) => page.evaluate(() => { const r = window.__soh.run; const ps = Object.values(r.entities).filter(e => e.parcel); const carts = Object.values(r.entities).filter(e => e.kind === 'cart'); return {
  securedCash: window.__soh.profile.securedCash, medkitStock: r.vendorStock.medkit,
  receipts: window.__soh.profile.profileReceipts.filter(x => x.startsWith('spend:')).length,
  parcels: ps.map(e => ({ purchaseId: e.parcel.purchaseId, item: e.parcel.item, uid: r.custody[e.c].slots.find(Boolean)?.uid ?? null })),
  packMedkit: r.custody.inv.slots.filter(s => s?.key === 'medkit').length, packFilled: r.custody.inv.slots.filter(Boolean).length,
  carts: carts.map(c => ({ id: c.id, cargo: r.custody[c.c].slots.filter(Boolean).map(s => ({ key: s.key, qty: s.qty, uid: s.uid })) })) }; });

try {
  for (const [vn, vp] of [['1280x720', { width: 1280, height: 720 }], ['640x360', { width: 640, height: 360 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addInitScript(v => { if (!localStorage.getItem('soh.driver.seeded')) { localStorage.setItem('soh.state.v3', v); localStorage.setItem('soh.driver.seeded', '1'); } }, seed);
    const page = await ctx.newPage();
    page.on('pageerror', e => results.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('[save]')) results.errors.push('console: ' + m.text()); });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Continue/i }).first().click();
    await continueRun(page);

    // ---- M1: legal full pack + affordable cash, then a REAL menu Save
    const pack = await page.evaluate(() => window.__sohQA.preparePack());
    await page.evaluate(() => window.__sohQA.setSecuredCash(20));
    results.fixtures.push({ viewport: vn, F2: 'secured cash set to 20', F3: 'legal full pack (cart_kit + stone at ITEMS.stone.max 60)', packFill: pack });
    const m1 = await menuSave(page);
    mark(vn, 'M1 full pack + cash, menu Save', { lastSave: m1, storage: await storageRevision(page), live: await liveState(page) });

    // ---- M2: stand beside Mirela (F1), real aim, real E, real Parcel click
    const vend = await page.evaluate(() => { const v = Object.values(window.__soh.run.entities).find(e => e.kind === 'vendor'); return { id: v.id, x: v.x, y: v.y }; });
    let stand = null; const tried = [];
    for (const [dx, dy] of [[24, 24], [14, 30], [-14, 30], [30, 0], [-30, 0], [0, 36], [-24, 24], [0, -30], [40, 10]]) {
      await page.evaluate(([x, y]) => { const p = window.__soh.run.player; p.x = x; p.y = y; }, [vend.x + dx, vend.y + dy]);
      const t = await aimAt(page, vend.x, vend.y);
      const pos = await page.evaluate(() => ({ x: window.__soh.run.player.x, y: window.__soh.run.player.y }));
      tried.push({ dx, dy, target: t?.kind ?? null, label: t?.label ?? null });
      if (t?.kind === 'vendor' && Math.abs(pos.x - (vend.x + dx)) < 1 && Math.abs(pos.y - (vend.y + dy)) < 1) { stand = { dx, dy }; break; }
    }
    results.fixtures.push({ viewport: vn, F1: 'stand tile beside Mirela; accepted only when the real Trade prompt resolved', tried, stand });
    if (!stand) throw Error('no stand tile resolved a real Trade prompt');
    await page.keyboard.press('KeyE'); await page.waitForTimeout(500);
    if (!(await panelHas(page, 'Mirela the Trader'))) throw Error('VendorPanel did not open from real E');
    await shot(page, 'vendor-panel', vn, 'VendorPanel opened by real E');
    const beforeBuy = await liveState(page);
    await page.getByRole('button', { name: 'Parcel' }).nth(2).click(); await page.waitForTimeout(450);
    const afterBuy = await liveState(page);
    mark(vn, 'M2 real Parcel purchase', { before: { securedCash: beforeBuy.securedCash, medkitStock: beforeBuy.medkitStock, receipts: beforeBuy.receipts }, after: afterBuy, debitedOnce: beforeBuy.securedCash - afterBuy.securedCash === 4 && beforeBuy.medkitStock - afterBuy.medkitStock === 1 && afterBuy.parcels.length === 1 && afterBuy.packMedkit === 0 && afterBuy.receipts === beforeBuy.receipts + 1 });
    if (afterBuy.parcels.length !== 1) throw Error('expected exactly one parcel');
    const uid0 = afterBuy.parcels[0].uid;
    await closeTopPanel(page); await page.waitForTimeout(250);
    await shot(page, 'parcel-at-trader', vn, 'purchased parcel beside Mirela');

    // ---- M3: menu Save, then RELOAD (same browser storage) and verify the committed parcel/balances/UID
    const m3 = await menuSave(page);
    mark(vn, 'M3 menu Save after purchase', { lastSave: m3, storage: await storageRevision(page) });
    await page.reload({ waitUntil: 'networkidle' }); await continueRun(page);
    const r1 = await liveState(page);
    mark(vn, 'M3 after reload #1', { live: r1, storage: await storageRevision(page), survived: r1.parcels.length === 1 && r1.parcels[0].uid === uid0 && r1.securedCash === 16 && r1.medkitStock === 3 && r1.receipts === 1 });
    if (!(r1.parcels.length === 1 && r1.parcels[0].uid === uid0 && r1.securedCash === 16 && r1.medkitStock === 3)) throw Error('purchase did not survive reload');

    // ---- M4: place a real cart (F4), refill the freed slot (F4b), then REAL E on the parcel and REAL Load click
    await page.evaluate(() => { const p = window.__soh.run.player; });
    const placed = await page.evaluate(() => { const r = window.__soh.run; const p = r.player; for (const [dx, dy] of [[26, 0], [-26, 0], [0, 26], [0, -26], [30, 20], [-30, 20]]) { const res = window.__sohQA.act('placeCart', { x: p.x + dx, y: p.y + dy }); if (res?.ok) return { ok: true, dx, dy }; } return { ok: false }; });
    results.fixtures.push({ viewport: vn, F4: 'cart deployed by real placeCart (QA passthrough to the same dispatch)', placed });
    if (!placed.ok) throw Error('placeCart failed');
    const refill = await page.evaluate(() => window.__sohQA.fillPack());
    results.fixtures.push({ viewport: vn, F4b: 'freed pack slot refilled with a legal Stone stack', refill });
    await page.waitForTimeout(300);
    const pt = await aimAt(page, afterBuy.parcels.length ? (await page.evaluate(() => { const p = Object.values(window.__soh.run.entities).find(e => e.parcel); return p.x; })) : 0, await page.evaluate(() => Object.values(window.__soh.run.entities).find(e => e.parcel).y));
    if (!pt || !/Parcel/.test(pt.label || '')) throw Error('parcel prompt did not resolve: ' + JSON.stringify(pt));
    await page.keyboard.press('KeyE'); await page.waitForTimeout(500);
    if (!(await panelHas(page, 'Paid parcel'))) throw Error('ParcelPanel did not open');
    await shot(page, 'parcel-panel', vn, 'Paid parcel panel (Load into this cart)');
    await page.getByRole('button', { name: 'Load into this cart' }).first().click(); await page.waitForTimeout(450);
    const loaded = await liveState(page);
    mark(vn, 'M4 real Load into this cart', { live: loaded, uidPreserved: loaded.carts.some(c => c.cargo.some(x => x.uid === uid0 && x.key === 'medkit')), parcelGone: loaded.parcels.length === 0, packFull: loaded.packFilled === 24 });
    await closeTopPanel(page); await page.waitForTimeout(250);
    await shot(page, 'cart-with-cargo', vn, 'cart with medkit; pack still full');

    // ---- M5: menu Save, reload, verify; reload again, verify (no duplicate grant)
    const m5 = await menuSave(page);
    mark(vn, 'M5 menu Save after cart load', { lastSave: m5, storage: await storageRevision(page) });
    for (const n of [2, 3]) {
      await page.reload({ waitUntil: 'networkidle' }); await continueRun(page);
      const s = await liveState(page);
      const ok = s.parcels.length === 0 && s.carts.some(c => c.cargo.some(x => x.uid === uid0 && x.key === 'medkit')) && s.securedCash === 16 && s.medkitStock === 3 && s.receipts === 1 && s.packMedkit === 0;
      mark(vn, `M5 after reload #${n}`, { live: s, storage: await storageRevision(page), survivedNoDuplicate: ok });
      if (!ok) throw Error(`state changed after reload #${n}`);
    }
    await shot(page, 'after-reload-cart', vn, 'cart after two reloads');
    await ctx.close();
  }
  if (results.errors.length) throw Error(results.errors.join('; '));
  console.log('DURABLE_PROOF_OK');
} catch (e) {
  results.failure = String(e.message || e);
  console.log('FAILED:', results.failure);
  process.exitCode = 1;
} finally {
  await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 1));
  await browser.close();
}
