// Creator rulings on build 98ee24ac. Production build (port 4174). New run, real keys and mouse.
//  1. Handbook: every chapter shows what it opens and its bundle.  2. The Stone Axe takes wood AND rock (and ore if the walk meets a vein).
//  3. Menu > "Stuck? Give up & wake somewhere safe": "No" changes nothing; "Give up & wake" leaves a bag and wakes the player with one axe.
// STAGED: nothing. The walk is blind (walk until blocked, swing), so what it meets differs per run.
import { boot } from './kit.mjs';
const k = await boot('/home/user/acc/shots/p1'); const { p, shot, note, step, st, keys, swing, newGame } = k;
await newGame(); let s = await st(); note('startKit', s.inv); await shot('00-start');
const kitOk = /1:stone_axex1\/d180/.test(s.inv.join(' ')) && !/pick/.test(s.inv.join(' '));
// --- 1. handbook
await p.keyboard.press('j'); await step(8);
const rows = p.locator('.trail__row'); const n = await rows.count(); const chapters = [];
for (let i = 0; i < n; i++) { await rows.nth(i).scrollIntoViewIfNeeded(); await rows.nth(i).click({ force: true }); await step(3);
  const t = (await p.locator('.lesson').innerText()).replace(/\n+/g, ' | '); const opens = t.match(/Opens: [^|]*/)?.[0] ?? null;
  const items = await p.$$eval('.cache__item', a => a.map(x => x.textContent.trim())); chapters.push({ i: i + 1, head: t.slice(0, 40), items, opens });
  if (i === 0) await shot('01-handbook-landfall'); if (i === 1) await shot('01-handbook-shelter'); }
note('chapters', chapters);
const bookOk = n === 11 && chapters.every(c => c.opens && c.items.length > 0) && chapters[0].items.some(x => /Wood Club/.test(x)) && !chapters.some(c => c.items.some(x => /Pick/i.test(x)));
const firstStep = (await p.locator('.lesson').count()) ? (await rows.nth(0).click({ force: true }), await step(3), (await p.locator('.lesson ol li').first().innerText()).replace(/\n+/g, ' | ')) : null; note('landfallFirstStep', firstStep);
const menuOpen = async () => (await p.getByRole('button', { name: /Stuck\? Give up/ }).count()) > 0, bookOpen = async () => (await p.locator('.lesson').count()) > 0;
for (let i = 0; i < 4 && (await bookOpen() || await menuOpen()); i++) { await p.keyboard.press('Escape'); await step(6); }
note('panelsClosed', { book: await bookOpen(), menu: await menuOpen() });
// --- 2. the axe on trees, rock, ore
await p.keyboard.press('1'); await step(3);
const got = {}; const dirs = [['d', 1, 0], ['s', 0, 1], ['a', -1, 0], ['w', 0, -1]]; const count = key => s.inv.filter(x => x.includes(':' + key + 'x')).reduce((a, x) => a + Number(x.split('x').pop().split('/')[0]), 0);
const WANT = (process.env.WANT ?? 'wood,stone').split(','); const met = [];
for (let leg = 0; leg < Number(process.env.LEGS ?? 110) && !WANT.every(w => got[w]); leg++) { const [key, ux, uy] = dirs[(leg + (leg >> 2)) % 4]; await p.mouse.move(320 + ux * 24, 180 + uy * 24); await keys([key]); let prev = await st(), stalled = false;
  for (let i = 0; i < 36; i++) { await step(4); const c = await st(); const d = Math.hypot(c.x - prev.x, c.y - prev.y); prev = c; if (d < 0.5 && i > 1) { stalled = true; break; } }
  await keys([]); await step(2); if (!stalled) continue;
  const before = (await p.evaluate(() => window.readRun().run.receipts.length)); await swing(3);
  const fresh = await p.evaluate(b => window.readRun().run.receipts.slice(b).map(x => x.kind + ' ' + String(x.detail)), before); let h = fresh.filter(x => x.startsWith('harvest ')).pop();
  const txt = (await p.evaluate(() => window.toasts())).match(/[^|]*(Too hard|would break|would fell|Wrong tool)[^|]*/)?.[0]; if (txt) met.push(txt.trim().slice(0, 80));
  if (!h) { // the first swings may only chip it: keep at it a little
    for (let n = 0; n < 6 && !h; n++) { await swing(2); h = (await p.evaluate(b => window.readRun().run.receipts.slice(b).map(x => x.kind + ' ' + String(x.detail)), before)).filter(x => x.startsWith('harvest ')).pop(); }
    if (!h) continue; }
  const src = h.split(' ')[1].split('@')[0]; met.push(src); const item = /oak|pine|palm|willow|birch|tree/.test(src) ? 'wood' : /rock|shale|boulder/.test(src) ? 'stone' : /iron|coalv|crystal|sulfur|ore/.test(src) ? 'ore' : null; if (!item || got[item]) continue;
  for (let n = 0; n < 14; n++) { await swing(2); await keys([key]); await step(6); await keys([]); s = await st(); if (count(item === 'ore' ? 'iron_ore' : item) > 0) break; }
  s = await st(); got[item] = { source: h, tool: s.inv.find(x => x.includes('stone_axe')), wood: count('wood'), stone: count('stone'), iron_ore: count('iron_ore') }; await shot('02-' + item); }
note('met', [...new Set(met)]); note('harvested', got); s = await st(); note('invAfterHarvest', s.inv);
// --- 3. give up
const at = { x: s.x, y: s.y }; const carried = s.inv.map(x => x.replace(/^\d+:/, '')).sort();
for (let i = 0; i < 3 && !(await menuOpen()); i++) { await p.keyboard.press('Escape'); await step(8); } const ask = p.getByRole('button', { name: /Stuck\? Give up/ }); note('giveUpButton', await ask.count());
await ask.scrollIntoViewIfNeeded(); await shot('03-menu'); await ask.click({ force: true }); await step(4); await shot('04-confirm');
note('confirmText', (await p.evaluate(() => window.toasts())).match(/You fall where you stand[^|]*/)?.[0] ?? null);
await p.getByRole('button', { name: 'No', exact: true }).click({ force: true }); await step(4); const afterNo = await st();
const noOk = !afterNo.dead && Math.hypot(afterNo.x - at.x, afterNo.y - at.y) < 1 && afterNo.inv.length === s.inv.length; note('afterNo', { noOk, inv: afterNo.inv.length });
await p.getByRole('button', { name: /Stuck\? Give up/ }).click({ force: true }); await step(4);
await p.getByRole('button', { name: /^Give up & wake$/ }).click({ force: true }); await step(40);
s = await st(); const facts = await p.evaluate(at => { const r = window.readRun().run; const bags = Object.values(r.entities).filter(e => e.kind === 'bag');
  const bag = bags.find(e => Math.hypot(e.x - at.x, e.y - at.y) < 40); return { giveup: r.receipts.filter(x => x.kind === 'giveup').map(x => String(x.detail)), kit: r.receipts.filter(x => x.kind === 'respawn.kit').length,
    bag: bag ? r.custody[bag.c].slots.filter(Boolean).map(x => `${x.key}x${x.qty}${x.dur !== undefined ? '/d' + x.dur : ''}`).sort() : null, log: r.log.slice(-2).map(x => x.msg), ended: r.ended ?? null }; }, at);
note('afterGiveUp', { dead: s.dead, hp: s.hp, moved: Math.round(Math.hypot(s.x - at.x, s.y - at.y)), inv: s.inv, ...facts }); await shot('05-woke');
const giveOk = !s.dead && s.hp > 0 && s.inv.length === 1 && /stone_axex1\/d180/.test(s.inv[0]) && facts.giveup.join() === 'woke' && facts.kit === 1 && JSON.stringify(facts.bag) === JSON.stringify(carried) && !facts.ended;
// the game goes on: walk a little, and a save succeeds
await keys(['d']); await step(30); await keys([]); await step(200); const view = (await st()).view; note('lastSave', view?.lastSave ?? null);
note('checks', { kitOk, bookOk, wood: !!got.wood, stone: !!got.stone, ore: !!got.ore, noOk, giveOk });
await k.finish(kitOk && bookOk && !!got.wood && noOk && giveOk && k.log.errors.length === 0);
