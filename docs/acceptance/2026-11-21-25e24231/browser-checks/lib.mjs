import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';
import fs from 'node:fs';
export async function open(out, {profile}={}) {
  fs.mkdirSync(out, { recursive: true });
  const exe = await chromium.executablePath();
  const args = ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--mute-audio','--disable-gpu-vsync','--autoplay-policy=no-user-gesture-required'];
  const log = { errors: [], console: [], failed: [], badStatus: [] };
  let ctx, browser;
  if (profile) { ctx = await pw.launchPersistentContext(profile, { executablePath: exe, args, headless: true, viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 }); browser = ctx.browser(); }
  else { browser = await pw.launch({ executablePath: exe, args, headless: true }); ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 }); }
  const p = ctx.pages()[0] ?? await ctx.newPage(); p.setDefaultTimeout(60000);
  p.on('pageerror', e => log.errors.push(String(e.message).slice(0, 400)));
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) log.console.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('requestfailed', r => log.failed.push(r.url() + ' ' + r.failure()?.errorText));
  p.on('response', r => { if (r.status() >= 400) log.badStatus.push(r.status() + ' ' + r.url()); });
  await p.addInitScript(() => {
    window.readRun = () => { const c = document.querySelector('canvas'); let n = c?.[Object.keys(c).find(k => k.startsWith('__reactFiber'))]; while (n && !n.memoizedProps?.gs?.run) n = n.return; return n?.memoizedProps.gs ?? null; };
  });
  const shot = async name => { await p.screenshot({ path: `${out}/${name}.png` }); };
  const btn = name => p.getByRole('button', { name, exact: typeof name === 'string' });
  const close = async () => { await ctx.close(); if (browser) await browser.close().catch(()=>{}); };
  return { p, log, shot, btn, close, ctx };
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
