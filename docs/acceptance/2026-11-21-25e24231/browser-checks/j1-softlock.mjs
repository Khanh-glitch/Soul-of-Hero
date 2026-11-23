// Can the player get stuck with a broken Wood Club and no wood? Production build (port 4174).
// STAGED: the starting club is worn down to its last use and any wood is removed. The club is then broken by a real swing.
import { boot } from './kit.mjs';
const k = await boot('/home/user/acc/shots/j1'); const { p, shot, note, step, st, keys, swing, newGame } = k;
await newGame(); let s = await st(); note('start', s.inv);
const slot = (await st()).inv.find(x => x.includes('wood_club'))?.split(':')[0]; await p.keyboard.press(slot); await step(3);
// walk until blocked; stop when the thing under the aim is a tree
const dirs = [['d', 1, 0], ['s', 0, 1], ['a', -1, 0], ['w', 0, -1]]; let tree = null; const seen = [];
for (let leg = 0; leg < 60 && !tree; leg++) { const [key, ux, uy] = dirs[leg % 4]; await p.mouse.move(320 + ux * 24, 180 + uy * 24); await keys([key]); let prev = await st(), stalled = false;
  for (let i = 0; i < 40; i++) { await step(4); const c = await st(); const d = Math.hypot(c.x - prev.x, c.y - prev.y); prev = c; if (d < 0.5 && i > 1) { stalled = true; break; } }
  await keys([]); await step(3); const t = (await st()).view?.target; seen.push([leg, stalled, t?.label ?? null]); if (stalled && /Oak|Pine|Palm|Willow/.test(t?.label ?? '')) tree = t; }
note('walk', seen.slice(-6)); note('tree', tree); await shot('00-at-tree');
// one real swing with the healthy club: wood comes out
await swing(4); s = await st(); note('clubOnTree', { inv: s.inv, last: s.last.filter(x => x.startsWith('harvest')) });
// STAGED from here: last use left, wood removed (dropped wood on the ground is left alone)
await p.evaluate(() => { const r = window.readRun().run; for (const [i, x] of r.custody.inv.slots.entries()) { if (!x) continue; if (x.key === 'wood_club') x.dur = 1; if (x.key === 'wood') r.custody.inv.slots[i] = null; } });
let broke = false; for (let n = 0; n < 8 && !broke; n++) { await swing(1); s = await st(); broke = s.last.some(x => x.startsWith('tool.break')); }
await p.evaluate(() => { const r = window.readRun().run; for (const [i, x] of r.custody.inv.slots.entries()) if (x?.key === 'wood') r.custody.inv.slots[i] = null; });
note('broke', broke); s = await st(); note('afterBreak', { inv: s.inv, last: s.last.slice(-3) }); await shot('01-broken');
// 1. swing again with the broken club in hand
await p.mouse.down(); await step(2); await p.mouse.up(); await step(4); await shot('02a-swing-broken-now'); note('swingBrokenClub', (await p.evaluate(() => window.toasts())).match(/[^|]*broken[^|]*/i)?.[0] ?? 'no message found'); await shot('02-swing-broken'); await step(60);
// 2. bare hands on the same thing: pick an empty quickbar slot
const used = new Set(s.inv.map(x => +x.split(':')[0])); const empty = [1, 2, 3, 4, 5, 6, 7, 8].find(i => !used.has(i)); await p.keyboard.press(String(empty)); await step(4);
const woodBefore = (await st()).inv.filter(x => x.includes(':woodx')); const r0 = (await st()).last.length;
for (let n = 0; n < 12; n++) { await swing(1); if (n === 0) await shot('03a-fists-first-swing'); } note('targetWithFists', (await st()).view?.target); const txt = await p.evaluate(() => window.toasts()); s = await st();
note('fists', { slot: empty, message: txt.match(/[^|]*(axe would fell|pickaxe|Wrong tool)[^|]*/)?.[0] ?? 'no message found', woodBefore, woodAfter: s.inv.filter(x => x.includes(':woodx')), last: s.last.slice(-3) }); await shot('03-fists');
// 3. what can be crafted now
await p.keyboard.press('c'); await step(10); await shot('04-craft'); const craft = await p.evaluate(() => window.toasts());
note('craftPanel', craft.slice(0, 1500));
note('craftButtons', await p.$$eval('button', b => b.filter(x => /craft/i.test(x.textContent)).map(x => x.textContent.trim().slice(0, 40) + (x.disabled ? ' (disabled)' : ''))));
await k.finish();
