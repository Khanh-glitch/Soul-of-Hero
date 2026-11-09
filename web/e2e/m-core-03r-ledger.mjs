// Read-only receipt/custody capture after the successful normal-input save.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const ctx = await chromium.launchPersistentContext('/tmp/m-core-03r-blind', { headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'], viewport: {width: 640, height: 360} });
try {
  const page = ctx.pages()[0];
  await page.goto('http://127.0.0.1:4196', {waitUntil: 'networkidle'});
  await page.getByRole('button', {name: /Continue —/}).click();
  await page.waitForFunction(() => window.__soh?.run);
  const evidence = await page.evaluate(() => {const r=window.__soh.run; return {note:'Read-only snapshot; normal inputs generated all receipts. The earlier documented rollback and subsequent assisted routing still apply.', layoutId:r.layoutId, wreckEconomy:r.wreckEconomy, player:r.player, custody:r.custody, entities:Object.values(r.entities).filter(e=>e.kind==='bag'||e.kind==='recycler'||e.type==='workbench'||e.type==='research'), receipts:r.receipts};});
  await writeFile('evidence/m-core-03r/full-ledger.json', JSON.stringify(evidence,null,2));
} finally { await ctx.close(); }
