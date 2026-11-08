// MEC-01 R6.1 WEB BROWSER SMOKE ONLY, NEVER A PROOF OF AN OFFLINE TURRET KILL.
// Real current-build keyboard/DOM input, no state injection. Captures both viewports.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const url = process.env.GAME_URL || 'http://127.0.0.1:4173/';
const sha = process.env.BUILD_SHA || 'unknown';
const root = 'evidence/mec01-r61-browser';
await mkdir(root, { recursive: true });
const records = [];
const browser = await chromium.launch({ headless: true });
let failed = false;
for (const [w, h] of [[1280, 720], [640, 360]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push('pageerror: ' + err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  const rec = { sha, viewport: [w, h], shots: [], errors, steps: [], verdict: 'RUNNING', scope: 'BROWSER_SMOKE_ONLY; NO_OFFLINE_DEFENSE_PROOF' };
  const shot = async label => {
    const name = 'R61-' + w + 'x' + h + '-' + label + '.png';
    const bytes = await page.screenshot({ path: root + '/' + name, animations: 'disabled' });
    rec.shots.push({ name, sha256: createHash('sha256').update(bytes).digest('hex') });
  };
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!response || response.status() !== 200) throw new Error('HTTP response not 200');
    await page.getByRole('button', { name: 'New run', exact: true }).waitFor({ timeout: 45000 });
    await page.waitForTimeout(700);
    await shot('01-title');
    rec.steps.push('TITLE_VISIBLE');
    await page.getByRole('button', { name: 'New run', exact: true }).click();
    await page.getByRole('button', { name: 'Begin the 14 days', exact: true }).waitFor();
    await shot('02-character-select');
    rec.steps.push('CHARACTER_SELECT_VISIBLE');
    await page.getByRole('button', { name: 'Begin the 14 days', exact: true }).click();
    await page.waitForTimeout(1900);
    await shot('03-world-spawn');
    rec.steps.push('WORLD_ENTERED');
    await page.keyboard.down('KeyD'); await page.waitForTimeout(1200); await page.keyboard.up('KeyD');
    await page.keyboard.down('KeyW'); await page.waitForTimeout(450); await page.keyboard.up('KeyW');
    await page.waitForTimeout(300); await shot('04-world-after-input');
    rec.steps.push('REAL_KEYBOARD_INPUT_SENT; DISPLACEMENT_NOT_CLAIMED');
    await page.keyboard.press('Escape');
    const quit = page.getByRole('button', { name: 'Save & quit to title', exact: true });
    await quit.waitFor({ timeout: 8000 });
    await shot('05-esc-menu');
    rec.steps.push('MENU_VISIBLE');
    await quit.click();
    await page.getByRole('button', { name: /^Continue/ }).waitFor({ timeout: 15000 });
    await shot('06-save-quit-title');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    if (!keys.some(k => k.includes('soh.state'))) throw new Error('No localStorage SOH save key found');
    rec.steps.push('SAVE_KEY_PRESENT');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^Continue/ }).waitFor({ timeout: 20000 });
    await shot('07-reload-title');
    await page.getByRole('button', { name: /^Continue/ }).click();
    await page.waitForTimeout(1800);
    await shot('08-continue-return');
    rec.steps.push('CONTINUE_AFTER_BROWSER_RELOAD');
    rec.verdict = errors.length ? 'FAIL_CONSOLE' : 'PASS_BROWSER_SMOKE_ONLY';
  } catch (err) {
    failed = true; rec.verdict = 'FAIL'; rec.failure = String(err);
    try { await shot('failure'); } catch { /* preserve the actual error */ }
  } finally {
    records.push(rec); await context.close();
  }
}
await browser.close();
await writeFile(root + '/manifest.json', JSON.stringify({ sha, url, results: records, limitations: ['NO_TURRET_KILL_BROWSER_SCENARIO', 'NO_GROUND_DROP_PICKUP_BROWSER_PROOF', 'NO_HUMAN_VISUAL_ACCEPTANCE', 'FIXTURE_SIMULATION_R61_NOT_PART_OF_THIS_JOB'] }, null, 2));
console.log(JSON.stringify(records.map(r => ({ viewport: r.viewport, verdict: r.verdict, steps: r.steps, errors: r.errors, failure: r.failure })), null, 2));
if (failed || records.some(r => r.verdict !== 'PASS_BROWSER_SMOKE_ONLY')) process.exit(1);
