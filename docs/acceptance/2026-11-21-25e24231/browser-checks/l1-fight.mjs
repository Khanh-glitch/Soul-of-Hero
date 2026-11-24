// A fight with a creature that attacks back, production build (port 4174), real mouse swings with the starting club.
// STAGED: the player is put about four tiles from the nearest hostile creature of the new game (no walking there).
import { boot } from './kit.mjs';
const k = await boot('/home/user/acc/shots/l1'); const { p, shot, note, step, st, aimAt, keys } = k;
await p.addInitScript(() => { window.cr = id => { const r = window.readRun().run, P = r.player; const m = r.creatures.find(c => c.id === id); return { player: { hp: +P.hp.toFixed(1), x: Math.round(P.x), y: Math.round(P.y), dead: !!P.dead }, m: m ? { type: m.type, hp: +m.hp.toFixed(1), state: m.state, x: m.x, y: m.y, d: Math.round(Math.hypot(m.x - P.x, m.y - P.y)) } : null }; }; });
await k.newGame();
const pick = await p.evaluate(want => { const r = window.readRun().run, P = r.player; const all = r.creatures.filter(c => c.state !== 'dead' && c.hp > 0).map(c => ({ id: c.id, type: c.type, hp: c.hp, x: c.x, y: c.y, d: Math.round(Math.hypot(c.x - P.x, c.y - P.y)) })).sort((a, b) => a.d - b.d);
  const census = {}; for (const c of all) census[c.type] = (census[c.type] || 0) + 1; let target = null; for (const t of want) { target = all.find(c => c.type === t) ?? null; if (target) break; } return { census, target }; }, (process.env.TYPES ?? 'wolf,vampire_1,orc_1,vampire_2,orc_2,boar,crab,toad,beetle,crawler').split(','));
note('creaturesInWindow', pick.census); note('target', pick.target); if (!pick.target) await k.finish(false);
const id = pick.target.id; const s0 = await st(); const slot = s0.inv.find(x => x.includes('wood_club')).split(':')[0]; await p.keyboard.press(slot); await step(3);
await p.evaluate(([x, y]) => { const P = window.readRun().run.player; P.x = x; P.y = y; P.vx = 0; P.vy = 0; }, [pick.target.x - 64, pick.target.y]); await step(4); await shot('01-near');
const cr = () => p.evaluate(id => window.cr(id), id); const log = []; let c = await cr(); note('begin', c); let hits = 0, hurts = 0, lastP = c.player.hp, lastM = c.m?.hp, shotHit = false, shotHurt = false;
for (let i = 0; i < 260; i++) { c = await cr(); if (!c.m || c.m.hp <= 0 || c.m.state === 'dead' || c.player.dead || c.player.hp < 25) break;
  await aimAt({ x: c.m.x, y: c.m.y });
  if (c.m.d > 26) { const dx = c.m.x - c.player.x, dy = c.m.y - c.player.y; await keys([Math.abs(dx) > 8 ? (dx > 0 ? 'd' : 'a') : null, Math.abs(dy) > 8 ? (dy > 0 ? 's' : 'w') : null].filter(Boolean)); await step(3); await keys([]); }
  else { await p.mouse.down(); await step(2); await p.mouse.up(); await step(8); }
  const n = await cr(); if (n.m && n.m.hp < lastM) { hits++; if (!shotHit) { await shot('02-hit'); shotHit = true; } } if (n.player.hp < lastP - 0.5) { hurts++; if (!shotHurt) { await shot('03-hurt'); shotHurt = true; } }
  if ((n.m && n.m.hp !== lastM) || n.player.hp < lastP - 0.5) log.push([i, n.player.hp, n.m?.hp ?? 'gone', n.m?.state ?? '']); lastP = n.player.hp; lastM = n.m?.hp ?? lastM; }
await step(20); c = await cr(); const s = await st(); note('timeline', log.slice(0, 40)); note('end', { c, hits, hurts, clubAfter: s.inv.find(x => x.includes('wood_club')), receipts: s.last.filter(x => /creature|loot|drop|pickup|player\./.test(x)) }); await shot('04-end');
const all = await p.evaluate(() => window.readRun().run.receipts.filter(x => /^creature\.|^player\.(hurt|hit|damage)|^combat/.test(x.kind)).slice(-12).map(x => x.kind + ' ' + String(x.detail).slice(0, 80))); note('combatReceipts', all);
const killed = !c.m || c.m.hp <= 0 || c.m.state === 'dead'; await k.finish(killed && hurts > 0 && k.log.errors.length === 0);
