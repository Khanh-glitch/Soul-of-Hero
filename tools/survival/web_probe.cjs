// Chromium input against an exported Godot Web build whose CI-only main scene
// boots the production overworld. Fixture smoke, not an end-to-end playtest.
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const errors = [];
  const browser = await chromium.launch({executablePath: process.env.CHROME_BIN, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle',
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport: {width: 1280, height: 720}});
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const out = process.env.WEB_SMOKE_OUTPUT || 'artifacts/web-survival';
  fs.mkdirSync(out, {recursive: true});
  try {
    await page.goto(process.env.WEB_SMOKE_URL, {waitUntil:'domcontentloaded', timeout:30000});
    try {
      await page.waitForFunction(() => window.__survivalWebProbe?.ready === true, null, {timeout:90000});
    } catch (e) {
      const diagnostics = await page.evaluate(() => ({probe: window.__survivalWebProbe,
        status: document.querySelector('#status')?.innerText?.slice(0, 1000),
        canvas: [document.querySelector('canvas')?.width, document.querySelector('canvas')?.height],
        title: document.title}));
      console.log('SURVIVAL WEB DIAGNOSTICS:', JSON.stringify({diagnostics, errors}));
      throw e;
    }
    const initial = await page.evaluate(() => window.__survivalWebProbe);
    console.log('SURVIVAL WEB READY:', JSON.stringify(initial));
    if (initial.node_count < 60) throw new Error('Production survival resources missing');
    await page.locator('canvas').focus();
    await page.keyboard.press('c');
    await page.waitForFunction(() => window.__survivalWebProbe?.economy_open === true, null, {timeout:10000});
    await page.keyboard.down('d');
    await page.waitForTimeout(300);
    const open = await page.evaluate(() => window.__survivalWebProbe);
    if (!open.modal || Math.abs(open.move[0]) > .01) throw new Error('Movement leaked under the actual economy panel: ' + JSON.stringify(open));
    await page.keyboard.press('c');
    await page.waitForFunction(() => window.__survivalWebProbe?.economy_open === false, null, {timeout:10000});
    await page.waitForTimeout(250);
    const held = await page.evaluate(() => window.__survivalWebProbe);
    if (Math.abs(held.move[0]) > .01) throw new Error('Held move leaked after panel close: ' + JSON.stringify(held));
    await page.keyboard.up('d');
    await page.waitForTimeout(200);
    await page.keyboard.down('d');
    await page.waitForFunction(() => window.__survivalWebProbe?.move?.[0] > .5, null, {timeout:10000});
    await page.keyboard.up('d');
    await page.screenshot({path:path.join(out, 'overworld.png')});
    const fatal = errors.filter(x => /SCRIPT ERROR|Parse Error|Failed loading|Error:/.test(x));
    if (fatal.length) throw new Error('Browser errors: ' + JSON.stringify(fatal));
    console.log('SURVIVAL WEB BROWSER FIXTURE PASSED - real overworld/resources, economy GUI, held input and rearm');
  } finally {
    console.log('SURVIVAL WEB CONSOLE:', JSON.stringify(errors.slice(-20)));
    try { await page.screenshot({path: path.join(out, 'last-state.png'), timeout:12000}); } catch (_) {}
    fs.writeFileSync(path.join(out, 'browser-errors.json'), JSON.stringify(errors, null, 2));
    await browser.close();
  }
})().catch(e => {console.error('SURVIVAL WEB BROWSER FIXTURE FAILED:', e.stack || e); process.exitCode = 1;});
