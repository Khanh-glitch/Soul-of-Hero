import chromium from '@sparticuz/chromium'; import { chromium as pw } from 'playwright-core';
export async function open(scale = 1) {
  const exe = await chromium.executablePath();
  const b = await pw.launch({ executablePath: exe, args: chromium.args, headless: true });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: scale });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://localhost:5200/', { waitUntil: 'load' }); await p.waitForTimeout(2500);
  return { b, p, errs };
}
