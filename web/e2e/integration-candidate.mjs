// Short production smoke; isolated contexts never touch the user's storage.
// Compatibility server initially serves a #38 build, then index is replaced.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { copyFile, mkdir } from 'node:fs/promises';
const base = process.env.GAME_URL || 'http://127.0.0.1:4173';
const compat = process.env.COMPAT_URL || 'http://127.0.0.1:4175';
const candidateFile = process.env.CANDIDATE_INDEX || 'dist/index.html';
const compatFile = process.env.COMPAT_INDEX || '/tmp/soh-compat-serve/index.html';
const out = 'evidence/integration-candidate'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const errors = [];
const setup = async () => { const c = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); return { c, p }; };
const run = p => p.evaluate(() => { const r = window.__soh.run; return { id:r.id, seed:r.seed, startedAt:r.startedAt, sourceLayoutVersion:r.sourceLayoutVersion ?? null, x:r.player.x, y:r.player.y, inv:r.custody.inv.slots, eq:r.custody.eq.slots, sources:r.sources, entities:r.entities, knowledge:r.knowledge }; });
const start = async (p,url) => { await p.goto(url,{waitUntil:'networkidle'}); await p.getByRole('button',{name:/New run/i}).click(); await p.getByText('Pinewatch',{exact:true}).click(); await p.getByRole('button',{name:/Begin the 14 days/i}).click(); await p.waitForFunction(()=>!!window.__soh?.run); await p.waitForTimeout(500); };
const move = async p => { const before=await run(p); for(const key of ['d','s','a','w']) { await p.keyboard.down(key); await p.waitForTimeout(450); await p.keyboard.up(key); const after=await run(p); if (Math.hypot(after.x-before.x,after.y-before.y)>5) return; } throw new Error('Player did not move'); };
const eatBerry = async p => { await p.keyboard.press('i'); const inv=p.locator('.panel').filter({has:p.locator('.panel-h').getByText('Inventory',{exact:true})}); await inv.waitFor(); await inv.locator('[title="Berries"]').click(); await inv.getByRole('button',{name:'Use',exact:true}).click(); assert.equal(await p.evaluate(()=>window.__soh.run.custody.inv.slots.find(s=>s?.key==='berries').qty),2); };
const saveQuit = async p => { await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.getByRole('button',{name:'Save & quit to title'}).click(); await p.getByRole('button',{name:/Continue —/}).waitFor(); const bytes=await p.evaluate(()=>localStorage.getItem('soh.state.v3')); assert(bytes,'local snapshot missing'); return JSON.parse(JSON.parse(bytes).payload); };
const resume = async p => { await p.reload({waitUntil:'networkidle'}); await p.getByRole('button',{name:/Continue —/}).click(); await p.waitForFunction(()=>!!window.__soh?.run); await p.waitForTimeout(500); const report=p.getByRole('button',{name:'Continue',exact:true}); if(await report.isVisible().catch(()=>false)) await report.click(); };
const physicalEqual = (oldState,newState) => { assert.equal(newState.id,oldState.id); assert.equal(newState.seed,oldState.seed); assert.equal(newState.startedAt,oldState.startedAt); assert.equal(newState.sourceLayoutVersion,oldState.sourceLayoutVersion ?? null); assert.deepEqual(newState.inv,oldState.inv); assert.deepEqual(newState.eq,oldState.eq); assert.deepEqual(newState.sources,oldState.sources); assert.deepEqual(newState.entities,oldState.entities); assert.deepEqual(newState.knowledge,oldState.knowledge); assert(Math.hypot(newState.x-oldState.x,newState.y-oldState.y)<1,'position changed'); };
const fromSaved = s => ({ ...s.run, inv:s.run.custody.inv.slots, eq:s.run.custody.eq.slots, x:s.run.player.x, y:s.run.player.y });
try {
  const {c,p}=await setup();
  await start(p,base); await move(p); await eatBerry(p);
  for(const [w,h] of [[640,360],[1280,720]]) { await p.setViewportSize({width:w,height:h}); await p.waitForTimeout(300); await p.screenshot({path:`${out}/natural-inventory-${w}x${h}.png`,animations:'disabled'}); }
  await p.keyboard.press('Escape'); await p.keyboard.press('c'); await p.getByLabel('Find known recipe').waitFor();
  for(const [w,h] of [[640,360],[1280,720]]) { await p.setViewportSize({width:w,height:h}); await p.waitForTimeout(300); await p.screenshot({path:`${out}/natural-crafting-${w}x${h}.png`,animations:'disabled'}); }
  const saved=await saveQuit(p); await resume(p); physicalEqual(fromSaved(saved),await run(p));
  await c.close(); console.log('PASS candidate: fresh New Run, movement, berry use, inventory/crafting, save/reload/Continue, physical snapshot.');
  const old=await setup(); await start(old.p,compat); await move(old.p); await eatBerry(old.p); const saved38=await saveQuit(old.p); assert.equal(saved38.run.sourceLayoutVersion,undefined,'expected a legacy #38 source layout');
  await copyFile(candidateFile,compatFile); await resume(old.p); physicalEqual(fromSaved(saved38),await run(old.p));
  await old.p.keyboard.press('Escape'); await old.p.getByRole('button',{name:'Save & quit to title'}).click(); await old.p.getByRole('button',{name:/Continue —/}).waitFor(); await resume(old.p); assert.equal((await run(old.p)).id,saved38.run.id);
  await old.c.close(); console.log('PASS compatibility: actual PR #38 production New Run + save, candidate at same origin Continue + save + reload; run identity, position, inventory UIDs/quantities, entities, source deltas and knowledge preserved.');
  assert.deepEqual(errors,[],'browser page errors');
} finally { await browser.close(); }
