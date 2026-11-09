// SYS10-R1 capture. CONTROLLED FIXTURE: the save is produced by the real engine (startRun, real
// refinery build check, real craft/queue/stepStations), but the L2 Workbench, the oil/glass stock,
// and the wood fuel are injected by this script. Not natural-player acceptance.
import {chromium} from 'playwright';import {createServer} from 'vite';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const dir='../evidence/sys10-r1';await mkdir(dir,{recursive:true});
const vite=await createServer({configFile:'vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
const {newGame,dispatch,addItem,C,countItem,mkContainer,stepStations,markDirty}=await vite.ssrLoadModule('/src/game/engine.ts');
const {serializeSnapshot,validate}=await vite.ssrLoadModule('/src/game/persist.ts');
const {TILE}=await vite.ssrLoadModule('/src/game/core.ts');
const T=Date.UTC(2026,10,6);const log=[];
const g=newGame();assert(dispatch(g,{id:'cap-start',type:'startRun',character:'female',seed:77},T).ok,'startRun');
const r=g.run,p=r.player;
const act=(type,payload,id)=>{const res=dispatch(g,{id,type,...payload},T+100);log.push({intent:type,id,ok:res.ok,reason:res.reason??null,receipt:res.receipt??null});return res;};
// Controlled fixtures: L2 workbench and refinery beside the player (no cabinet: K6).
const f=mkContainer(r,'fuel',3),o=mkContainer(r,'out',6);
r.entities['fixture-bench']={id:'fixture-bench',kind:'struct',type:'workbench',x:p.x+TILE,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:160,maxHp:160,station:{fuelC:f.id,outC:o.id,burn:0,queue:[],level:2}};
for(const [k,q] of [['iron_ingot',4],['mechanical_parts',3],['spares',5],['brick',6],['glass',3],['salvaged_oil',6]])addItem(r,'inv',k,q);
const bench=r.entities['fixture-bench'];
const built=act('build',{struct:'refinery',tx:Math.floor(p.x/TILE)-1,ty:Math.floor(p.y/TILE)},'cap-build');
assert(built.ok,'refinery build: '+built.reason);
const ref=Object.values(r.entities).find(e=>e.type==='refinery');
addItem(r,ref.station.fuelC,'wood',3);
{const cr=act('craft',{recipe:'refinery_industrial',eid:ref.id},'cap-craft');assert(cr.ok,'queue industrial: '+cr.reason);}
const jobTotal=ref.station.queue[0].total;
stepStations(g,jobTotal+1000,T+100+jobTotal+1000);
const out=C(r,ref.station.outC);
const fuel=out.slots.filter(s=>s?.key==='fuel_can').reduce((a,s)=>a+s.qty,0),lube=out.slots.filter(s=>s?.key==='lubricant').reduce((a,s)=>a+s.qty,0);
assert.equal(fuel,2);assert.equal(lube,1);
// Fuel the motorbike from the refinery output (real intent path) to show consumption.
const q={x:p.x,y:p.y};
markDirty();
const snapshot=serializeSnapshot(g);assert(validate(JSON.parse(JSON.parse(snapshot).payload)),'snapshot valid');
await writeFile(`${dir}/receipts.json`,JSON.stringify({seed:77,fixtures:['L2 workbench','refinery placed via real build intent (no cabinet)','6 salvaged oil, 3 glass, 3 wood injected'],intents:log,output:{fuel_can:fuel,lubricant:lube},refineryId:ref.id,jobTotalMs:jobTotal},null,2));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:640,height:360}});
 await ctx.addInitScript(({snapshot})=>{localStorage.setItem('soh.state.v3',snapshot);},{snapshot});
 const page=await ctx.newPage();
 await page.goto('file:///home/user/Soul-of-Hero/web/dist/index.html',{waitUntil:'load'});
 await page.waitForTimeout(2500);
 await page.screenshot({path:`${dir}/refinery-640x360.png`});
 console.log('CAPTURED');
}finally{await browser.close();await vite.close();}
