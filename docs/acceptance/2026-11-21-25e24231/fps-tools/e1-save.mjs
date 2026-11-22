// Production build: does the paced autosave write a loadable snapshot through the background writer, and does Continue load it?
import fs from 'node:fs'; import { open, sleep } from './lib.mjs';
const out = '/home/user/acc/shots/e1'; const url = 'http://127.0.0.1:4174/';
const { p, log, close } = await open(out);
const R = {};
await p.goto(url, { waitUntil: 'load' }); await sleep(6000);
await p.getByRole('button', { name: 'New run', exact: true }).click(); await sleep(800);
await p.getByRole('button', { name: 'Begin the 14 days', exact: true }).click();
await p.waitForFunction(() => !!window.readRun(), {}, { polling: 200, timeout: 120000 });
await sleep(1500);
const view = () => p.evaluate(() => { const v = window.__sohView(); return { lastSave: v.lastSave, regions: v.regions, rev: window.readRun().revision }; });
const stores = () => p.evaluate(async () => {
  const fnv = t => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
  const read = t => { if (!t) return null; const o = JSON.parse(t); return { format: o.format, checksumOk: o.checksum === fnv(o.payload), revision: JSON.parse(o.payload).revision, kb: Math.round(t.length / 1024), hasNav: 'navigation' in JSON.parse(o.payload) }; };
  const idb = await new Promise(res => { const rq = indexedDB.open('soul-of-hero', 1); rq.onsuccess = () => { const g = rq.result.transaction('kv', 'readonly').objectStore('kv').get('state'); g.onsuccess = () => res(g.result ?? null); g.onerror = () => res(null); }; rq.onerror = () => res(null); });
  return { local: read(localStorage.getItem('soh.state.v3')), idb: read(idb), same: idb === localStorage.getItem('soh.state.v3') };
});
R.start = await view(); R.startStores = await stores();
// keep walking: saves must wait, then one light save lands within ~20 s
await p.keyboard.down('d'); const seen = [];
for (let i = 0; i < 26; i++) { await sleep(1000); const v = await view(); seen.push([i + 1, v.lastSave?.revision, v.lastSave?.localStatus, v.lastSave?.idbStatus]); if (i % 4 === 3) { await p.keyboard.up('d'); await p.keyboard.down(i % 8 === 3 ? 'a' : 'd'); } }
await p.keyboard.up('d'); await p.keyboard.up('a');
R.whileWalking = seen; R.afterWalkStores = await stores();
// stand still: a save follows shortly
await sleep(7000); R.afterStanding = await view(); R.afterStandingStores = await stores();
// open a panel: a full save (both stores)
await p.keyboard.press('i'); await sleep(7000); R.panelText = (await p.evaluate(() => document.body.innerText)).slice(0, 80).replace(/\n/g, ' | ');
R.afterPanel = await view(); R.afterPanelStores = await stores();
await p.keyboard.press('Escape'); await sleep(500);
// reload: the title offers Continue and the newest snapshot loads
await p.reload({ waitUntil: 'load' }); await sleep(5000);
R.titleButtons = await p.$$eval('button', b => b.map(x => x.textContent.trim().slice(0, 30)));
const cont = p.getByRole('button', { name: /Continue/ }).first(); if (await cont.count()) { await cont.click(); await p.waitForFunction(() => !!window.readRun(), {}, { polling: 200, timeout: 120000 }); await sleep(1500); R.afterContinue = await view(); R.afterContinuePeople = await p.evaluate(() => Object.keys(window.readRun().run.humanWorld.people).length); }
R.log = { errors: log.errors.slice(0, 5), console: log.console.slice(0, 8), failed: log.failed.slice(0, 5), badStatus: log.badStatus.slice(0, 5) };
fs.writeFileSync(out + '/result.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R));
await close();
