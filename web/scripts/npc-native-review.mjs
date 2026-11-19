// Normal-input production-build smoke. No fixture, page-side state mutation or QA clock.
// DEVICE_SCALE=1, viewport=640x360. Start the built site and pass its URL.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
const out=process.argv[3]||'evidence/npc-integration/native-640-review';mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
const p=await b.newPage({viewport:{width:640,height:360},deviceScaleFactor:1});p.setDefaultTimeout(30000);
const notes={browser:b.version(),errors:[],views:{}};p.on('pageerror',e=>notes.errors.push(e.message));
async function capture(name){await p.waitForTimeout(350);await p.screenshot({path:`${out}/${name}.png`,timeout:20000});notes.views[name]=await p.evaluate(()=>({text:document.body.innerText.slice(0,2500),size:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],}));console.log(name,notes.views[name].text.slice(0,120));}
try{await p.goto(process.argv[2]||'http://127.0.0.1:4180');const start=p.getByRole('button',{name:'New run'});await start.waitFor();await capture('title');await start.click();await capture('choice');await p.getByRole('button',{name:'Begin the 14 days'}).click();await p.getByRole("button",{name:"Begin the 14 days"}).waitFor({state:"hidden"});await p.waitForTimeout(3000);await capture('landing');
 for(const [key,view] of [['i','inventory'],['c','recipes'],['b','build'],['m','map']]){await p.keyboard.press(key);await capture(view);await p.keyboard.press('Escape');}
 const chart=p.locator('.field-map');await chart.waitFor({state:'hidden'});
 notes.run=await p.evaluate(()=>{const key=Object.keys(localStorage).find(k=>/^soh\.state\.v\d+$/.test(k));if(!key)return null;const raw=JSON.parse(localStorage.getItem(key));const r=JSON.parse(raw.payload).run;return {seed:r.seed,layout:r.layoutId,spawn:r.spawnChoice,clock:r.clock.lastSimAt,people:Object.keys(r.humanWorld.people).length};});
 for(const v of Object.values(notes.views))assert.deepEqual(v.size,[640,360]);
 assert.match(notes.views.inventory.text,/BACKPACK/);assert.match(notes.views.map.text,/FIELD CHART/);assert.deepEqual(notes.errors,[]);
}finally{writeFileSync(`${out}/observations.json`,JSON.stringify(notes,null,2));await b.close();}
