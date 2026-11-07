// SYS07 PHASE 0 — browser fixture on a coherent clock.
// Root cause of the SYS10-R2 block: the fixture clock was fixed at 2026-11-06T00:00Z, later than the
// real browser clock, so syncWorld() correctly refused commands that predate lastSimAt.
// Fix: anchor the fixture to the real clock a few minutes in the past. The anti-backdating rule is unchanged.
// CONTROLLED FIXTURE: L2 workbench, refinery (by real build intent), 6 oil + 3 glass + 3 wood and a
// deployed motorbike are injected. Counts as controlled browser UI evidence below S3.
import {chromium} from 'playwright';import {createServer} from 'vite';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const dir='../evidence/sys07-p0';await mkdir(`${dir}/frames`,{recursive:true});
const T=Date.now()-10*60*1000;   // coherent: 10 minutes before real browser time
const vite=await createServer({configFile:'vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
const E=await vite.ssrLoadModule('/src/game/engine.ts');const P=await vite.ssrLoadModule('/src/game/persist.ts');const K=await vite.ssrLoadModule('/src/game/core.ts');const W=await vite.ssrLoadModule('/src/game/world.ts');
const {newGame,dispatch,addItem,mkContainer,markDirty}=E;const {serializeSnapshot,validate}=P;const {TILE}=K;
const log=[];
const g=newGame();assert(dispatch(g,{id:'p0-start',type:'startRun',character:'female',seed:77},T).ok,'startRun');
const r=g.run,p=r.player;
const f=mkContainer(r,'fuel',3),o=mkContainer(r,'out',6);
r.entities['fixture-bench']={id:'fixture-bench',kind:'struct',type:'workbench',x:p.x+TILE,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:160,maxHp:160,station:{fuelC:f.id,outC:o.id,burn:0,queue:[],level:2}};
for(const [k,q] of [['iron_ingot',4],['mechanical_parts',3],['spares',5],['brick',6],['glass',3],['salvaged_oil',6]])addItem(r,'inv',k,q);
const built=dispatch(g,{id:'p0-build',type:'build',struct:'refinery',tx:Math.floor(p.x/TILE)-1,ty:Math.floor(p.y/TILE)},T+100);log.push({intent:'build refinery',ok:built.ok,reason:built.reason??null});assert(built.ok,'build '+built.reason);
const ref=Object.values(r.entities).find(e=>e.type==='refinery');addItem(r,ref.station.fuelC,'wood',3);
const save=serializeSnapshot(g);assert(validate(JSON.parse(JSON.parse(save).payload)),'valid save');
await writeFile(`${dir}/controlled-fixture-save.json`,save);
await writeFile(`${dir}/fixture-log.json`,JSON.stringify({clockAnchorIso:new Date(T).toISOString(),disclosure:'controlled fixture: L2 workbench, refinery placed by real build intent (no cabinet), 6 oil + 3 glass + 3 wood injected; no craft pre-queued',intents:log},null,2));
await vite.close();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:640,height:360}});
 await ctx.addInitScript(({save})=>{if(!localStorage.getItem('soh.state.v3'))localStorage.setItem('soh.state.v3',save);},{save});
 const page=await ctx.newPage();
 await page.goto(process.env.SOH_URL||'http://localhost:8765/index.html',{waitUntil:'load'});
 await page.waitForTimeout(2000);
 await page.getByRole('button',{name:/Continue/}).first().click();          // real input
 await page.waitForTimeout(2500);
 await page.keyboard.press('f');                                            // real input: open refinery
 await page.waitForTimeout(1200);
 await page.screenshot({path:`${dir}/frames/01-refinery-open-640x360.png`});
 const row=page.locator('div').filter({hasText:'2 Fuel Canister + 1 Machine Lubricant'}).last();
 await row.getByRole('button',{name:'Queue'}).click();                      // real UI queue
 await page.waitForTimeout(800);
 await page.screenshot({path:`${dir}/frames/02-queued-640x360.png`});
 await page.waitForTimeout(32000);                                          // real time for 26 s batch
 await page.screenshot({path:`${dir}/frames/03-after-wait-640x360.png`});
 await writeFile(`${dir}/browser-log.json`,JSON.stringify({url:page.url(),clockIso:new Date().toISOString(),steps:['Continue click','F key','Queue click on 2 Fuel Canister + 1 Machine Lubricant row','wait 32s real time','screenshot']},null,2));
 console.log('DONE');
}finally{await browser.close();}
