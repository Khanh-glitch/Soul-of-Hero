// Build menu on the production build (port 4174): no Plank Wall, no Iron-braced Wall.
import fs from 'node:fs'; import { open } from './lib.mjs';
const out = '/home/user/acc/shots/h1'; const url = 'http://127.0.0.1:4174/';
const { p, log, shot, btn, close } = await open(out);
const R = {}; const note = (k, v) => { R[k] = v; console.log('## ' + k, JSON.stringify(v).slice(0, 3000)); };
await p.addInitScript(() => { let at = Date.now(), anim = 0, seq = 0; const next = new Map();
  Date.now = () => at; Object.defineProperty(performance, 'now', { value: () => anim });
  window.requestAnimationFrame = cb => { next.set(++seq, cb); return seq; }; window.cancelAnimationFrame = id => next.delete(id);
  window.stepFrames = (n, ms) => { for (let i = 0; i < n; i++) { at += ms; anim += ms; const jobs = [...next]; next.clear(); for (const [, cb] of jobs) cb(anim); } return at; }; });
const step = (n, ms = 50) => p.evaluate(([n, ms]) => window.stepFrames(n, ms), [n, ms]);
await p.goto(url); await step(20); await btn('New run').click(); await step(5); await btn('Begin the 14 days').click();
await p.waitForFunction(() => !!window.readRun(), {}, { polling: 200, timeout: 120000 }); await step(40);
for (let i = 0; i < 6; i++) { await p.keyboard.press('Escape'); await step(4); }
await p.keyboard.press('b'); await step(8); await shot('01-build');
const text = await p.evaluate(() => document.body.innerText);
const buttons = await p.$$eval('button', b => b.map(x => (x.title + ' ## ' + x.textContent.trim()).slice(0, 90)));
note('buttons', buttons);
// open every tab/category button inside the build UI, collect all text
const seen = new Set([text]);
const cats = await p.$$('button');
for (let i = 0; i < cats.length; i++) { const b = (await p.$$('button'))[i]; if (!b) break; const t = (await b.textContent()).trim(); if (!/^(Walls?|Defen[cs]e|Structures?|Stations?|Storage|Shelter|Farm|Light|Traps?|All|Base|Craft|Utility|Production|Comfort)/i.test(t)) continue; await b.click({ force: true }).catch(() => {}); await step(4); seen.add(await p.evaluate(() => document.body.innerText)); await shot('02-cat-' + i); }
const all = [...seen].join('\n');
note('walls', [...new Set(all.match(/[A-Za-z-]+(?: [A-Za-z-]+)? Wall/g) ?? [])]);
note('hasPlankWall', /Plank Wall/i.test(all)); note('hasIronBraced', /Iron-braced/i.test(all));
note('errors', { errors: log.errors, failed: log.failed, bad: log.badStatus });
fs.writeFileSync(out + '/result.json', JSON.stringify(R, null, 1)); await close();
