// Open the ACTUAL generated self-contained compare page over file:// and prove
// both panes show cast #20 (reference C master left, game Restored A+C right).
import { chromium } from 'playwright';
const OUT = 'evidence/avfx-20';
const b = await chromium.launch({
  executablePath: process.env.QA_CHROME || undefined,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'],
});
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('file://' + process.cwd() + '/releases/soh-avfx20-compare.html');
await page.waitForTimeout(9000);
const st = await page.evaluate(() => document.getElementById('st')?.textContent || '');
const refName = await page.evaluate(() => {
  const r = document.getElementById('ref').contentWindow;
  return (r && r.META && r.META[19]) ? r.META[19].name + '/' + r.META[19].source : 'N/A';
});
await page.screenshot({ path: `${OUT}/compare-boot.png` });
// scrub to t=6.6 (collision) on both panes
await page.click('button[data-t="6.6"]');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/compare-t6.6.png` });
// switch game pane to Current Web and back
await page.click('#m-current'); await page.waitForTimeout(800);
await page.click('button[data-t="4.5"]'); await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/compare-current-t4.5.png` });
await page.click('#m-restored'); await page.waitForTimeout(800);
const st2 = await page.evaluate(() => document.getElementById('st')?.textContent || '');
console.log(JSON.stringify({ status: st, statusAfter: st2, refCast: refName, errors }));
await b.close();
if (errors.length) process.exit(1);
