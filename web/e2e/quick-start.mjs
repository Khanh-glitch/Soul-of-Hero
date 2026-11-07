// Regression for obsolete async load effects replacing an active run on a fast start.
// Uses normal UI actions; requires the dev server and a Playwright Chromium install.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /New Run/i }).click();
    await page.getByText('Pinewatch', { exact: true }).click();
    await page.getByRole('button', { name: /Begin/i }).click();
    await page.waitForFunction(() => Boolean(window.__soh?.run));
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('canvas').count(), 1, 'active game canvas missing');
    assert.deepEqual(errors, [], `page errors on fast start ${i + 1}`);
    await context.close();
  }
  console.log('PASS: three fresh-profile quick starts retained a run and canvas with no page errors');
} finally { await browser.close(); }
