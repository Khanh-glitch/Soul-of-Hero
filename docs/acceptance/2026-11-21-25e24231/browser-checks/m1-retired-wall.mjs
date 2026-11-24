// A save that still holds a Plank Wall, opened by the production build (port 4174).
// STAGED: 10 wood is put in the pack; the wall is then built with the real build bar. After the game has saved, the
// saved text is edited outside the game: that wall's type becomes wall_plank with 240 health (what an older build
// would have written), the checksum is recomputed, and both stores get the edited text. Then reload -> Continue.
import { boot } from './kit.mjs';
const k = await boot('/home/user/acc/shots/m1'); const { p, shot, note, step, st, newGame, aimAt } = k;
await newGame();
await p.evaluate(() => { const r = window.readRun().run, sl = r.custody.inv.slots; const i = sl.findIndex(x => !x); sl[i] = { uid: 's' + (r.nextId++).toString(36), key: 'wood', qty: 10 }; });
const ents = () => p.evaluate(() => Object.values(window.readRun().run.entities).filter(e => e.kind === 'struct').map(e => ({ id: e.id, type: e.type, hp: e.hp, maxHp: e.maxHp, tx: e.tx, ty: e.ty })));
const before = await ents(); note('structsBefore', before.map(e => e.type));
await p.keyboard.press('b'); await step(8);
await p.locator('button[title*="Wood Wall —"]').first().click({ force: true }); await step(4);
let wall = null; const tries = [];
for (const [ox, oy] of [[-48, 0], [48, 0], [0, 48], [0, -48], [-64, -32], [64, 32], [-96, 0], [96, 0], [0, 96], [0, -96]]) { const c = await st(); await aimAt({ x: c.x + ox, y: c.y + oy }); await step(3); await p.mouse.down(); await step(2); await p.mouse.up(); await step(8);
  const now = await ents(); wall = now.find(e => e.type === 'wall_wood' && !before.some(b => b.id === e.id)); tries.push([ox, oy, !!wall]); if (wall) break; }
note('tries', tries); note('builtWall', wall); await p.keyboard.press('Escape'); await step(5); await shot('01-wood-wall');
if (!wall) await k.finish(false);
// let the game save (a panel forces a full save), then read what it wrote
const read = () => p.evaluate(async id => { const t = localStorage.getItem('soh.state.v3'); if (!t) return null; const o = JSON.parse(t), s = JSON.parse(o.payload); return { has: !!s.run?.entities?.[id], type: s.run?.entities?.[id]?.type, kb: Math.round(t.length / 1024), textHasId: t.includes(id), nEnt: Object.keys(s.run?.entities ?? {}).length, rev: s.revision, live: window.readRun().revision, lastSave: window.__sohView().lastSave }; }, wall.id);
await p.keyboard.press('i'); let saved = null; for (let i = 0; i < 60; i++) { await step(10, 100); await p.waitForTimeout(250); saved = await read(); if (saved?.has) break; } note('savedByGame', saved); await p.keyboard.press('Escape'); await step(4);
if (!saved?.has) await k.finish(false);
const edit = await p.evaluate(async id => {
  const fnv = t => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
  const o = JSON.parse(localStorage.getItem('soh.state.v3')); const checksumWasValid = o.checksum === fnv(o.payload); const s = JSON.parse(o.payload); const e = s.run.entities[id]; const was = { type: e.type, hp: e.hp, maxHp: e.maxHp };
  e.type = 'wall_plank'; e.hp = 240; if (e.maxHp !== undefined) e.maxHp = 240; o.payload = JSON.stringify(s); o.checksum = fnv(o.payload); const text = JSON.stringify(o);
  localStorage.setItem('soh.state.v3', text);
  const idb = await new Promise(res => { const rq = indexedDB.open('soul-of-hero', 1); rq.onsuccess = () => { const tx = rq.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(text, 'state'); tx.oncomplete = () => res('written'); tx.onerror = () => res('error'); }; rq.onerror = () => res('open error'); });
  return { checksumWasValid, was, now: { type: e.type, hp: e.hp, maxHp: e.maxHp }, idb }; }, wall.id);
note('editedSave', edit);
await p.reload(); await step(20); const cont = p.getByRole('button', { name: /Continue/ }).first(); note('continueOffered', await cont.count());
await cont.click(); await p.waitForFunction(() => !!window.readRun(), {}, { polling: 200, timeout: 120000 }); await step(30); for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await step(4); }
const after = (await ents()).find(e => e.id === wall.id); note('wallAfterLoad', after); await shot('02-after-load');
note('anyRetiredLeft', (await ents()).filter(e => /wall_plank|wall_brick/.test(e.type)).length);
const ok = after?.type === 'wall_wood' && after.hp <= wall.hp && k.log.errors.length === 0; await k.finish(ok);
