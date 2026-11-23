// Creator ruling 2026-11-23 (follow Last Island): a run starts with a Stone Axe; every wake-up after a death issues one.
// Production build (port 4174). New run, real walking and swinging. STAGED: only the death (health set to almost zero with
// hunger and thirst at zero, so the game's own tick kills the player).
import { boot } from './kit.mjs';
const k = await boot('/home/user/acc/shots/o1'); const { p, shot, note, step, st, keys, swing, newGame } = k;
await newGame(); let s = await st(); note('startKit', s.inv); await shot('00-start');
const title = s.inv.join(' '); const kitOk = /1:stone_axex1\/d180/.test(title) && !/wood_club/.test(title);
await p.keyboard.press('1'); await step(3);
const got = {}; const dirs = [['d', 1, 0], ['s', 0, 1], ['a', -1, 0], ['w', 0, -1]]; const count = key => s.inv.filter(x => x.includes(':' + key + 'x')).reduce((a, x) => a + Number(x.split('x').pop().split('/')[0]), 0);
const seenHarvest = new Set(); const WANT = (process.env.WANT ?? 'wood,stone').split(',');
for (let leg = 0; leg < Number(process.env.LEGS ?? 70) && !WANT.every(w => got[w]); leg++) { const [key, ux, uy] = dirs[(leg + (leg >> 2)) % 4]; await p.mouse.move(320 + ux * 24, 180 + uy * 24); await keys([key]); let prev = await st(), stalled = false;
  for (let i = 0; i < 36; i++) { await step(4); const c = await st(); const d = Math.hypot(c.x - prev.x, c.y - prev.y); prev = c; if (d < 0.5 && i > 1) { stalled = true; break; } }
  await keys([]); await step(2); if (!stalled) continue;
  await swing(2); s = await st(); const h = s.last.filter(x => x.startsWith('harvest ')).pop(); if (!h || seenHarvest.has(h + leg)) continue;
  const src = h.split(' ')[1].split('@')[0]; const item = /oak|pine|palm|willow/.test(src) ? 'wood' : src === 'rock' ? 'stone' : /iron|coalv|shale|crystal|sulfur/.test(src) ? 'ore' : null; if (!item || got[item]) continue;
  // keep swinging at this one, then walk into it to pick up what fell
  for (let n = 0; n < 14; n++) { await swing(2); await keys([key]); await step(6); await keys([]); s = await st(); if (count(item === 'ore' ? 'iron_ore' : item) > 0) break; }
  s = await st(); got[item] = { source: h, toolAfter: s.inv.find(x => x.includes('stone_axe')), wood: count('wood'), stone: count('stone'), iron_ore: count('iron_ore') }; await shot('01-' + item); }
note('harvested', got); s = await st(); note('invAfterHarvest', s.inv);
// death by the game's own tick, then Rise
await p.evaluate(() => { const P = window.readRun().run.player; P.hp = 0.01; P.hunger = 0; P.thirst = 0; }); for (let i = 0; i < 400; i++) { await step(20); if ((await st()).dead) break; }
s = await st(); note('dead', { dead: s.dead, inv: s.inv, last: s.last.slice(-2) }); await step(60); await shot('02-fallen');
const rise = p.getByRole('button', { name: /Rise/ }); let rose = false; for (let i = 0; i < 20 && !rose; i++) { await step(40); if (await rise.count() && await rise.isEnabled()) { await rise.click({ force: true }).catch(() => {}); await step(40); } rose = !(await st()).dead; }
s = await st(); note('afterRise', { dead: s.dead, hp: s.hp, inv: s.inv, last: s.last.slice(-3) }); await shot('03-risen');
const log = await p.evaluate(() => window.readRun().run.log.slice(-3).map(x => x.msg)); note('log', log);
const kitReceipts = await p.evaluate(() => window.readRun().run.receipts.filter(x => x.kind === 'respawn.kit').map(x => String(x.detail))); note('respawnKitReceipts', kitReceipts);
const riseOk = rose && s.inv.length === 1 && /stone_axex1\/d180/.test(s.inv[0]) && kitReceipts.length === 1 && kitReceipts[0].startsWith('stone_axe:');
// the new axe works: swing at whatever is near after walking
note('checks', { kitOk, wood: !!got.wood, stone: !!got.stone, riseOk });
await k.finish(kitOk && !!got.wood && riseOk && k.log.errors.length === 0);
