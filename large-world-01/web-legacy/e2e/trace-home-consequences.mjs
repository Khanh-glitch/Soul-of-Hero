// Paid, owned house fixture; actual player movement creates marks, then controlled creature placement.
import { createServer } from 'vite'; import { chromium } from 'playwright'; import { mkdir, writeFile } from 'node:fs/promises'; import assert from 'node:assert/strict';
const out='evidence/trace-consequences'; await mkdir(out,{recursive:true});
const vite=await createServer({configFile:'vite.config.ts',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
const {newGame,dispatch,addItem,blockGrid,sourceAt,mkCreature,markDirty}=await vite.ssrLoadModule('/src/game/engine.ts');
const {serializeSnapshot,validate}=await vite.ssrLoadModule('/src/game/persist.ts'); const {getWorld}=await vite.ssrLoadModule('/src/game/world.ts');
const now=Date.now(),g=newGame();let serial=0;function act(type,p={}){const v=dispatch(g,{id:'tc'+(++serial),type,...p},now);assert(v.ok,`${type}: ${v.reason}`)} act('startRun',{character:'female',region:0,seed:214});const r=g.run,w=getWorld(),grid=blockGrid(r);r.creatures=[];
let site;outer:for(let y=15;y<185;y++)for(let x=20;x<175;x++){let ok=true;for(let dx=-7;dx<=2;dx++){const i=y*200+x+dx;if(grid[i]||![3,4,5,6,7,9,10,11].includes(w.tiles[i])){ok=false;break;}}if(!ok)continue;for(let dy=-1;dy<=2;dy++)for(let dx=0;dx<=3;dx++){const i=(y+dy)*200+x+dx;if(grid[i]||sourceAt(r,x+dx,y+dy)||w.economyMap.protected[i]||w.accessCorridors?.mask[i]||[0,1,8,12,13,14,15,16,18,19].includes(w.tiles[i]))ok=false;}if(ok){site={x,y};break outer;}}assert(site);
const X=site.x*16+8,Y=site.y*16+8;r.player.x=X-20;r.player.y=Y;for(const [k,n] of [['wood',57],['stone',5],['rope',1],['fiber',5]])assert.equal(addItem(r,'inv',k,n),0);
function build(type,dx,dy){act('build',{struct:type,tx:site.x+dx,ty:site.y+dy});return Object.values(r.entities).find(e=>e.type===type&&e.tx===site.x+dx&&e.ty===site.y+dy);}
build('claim',1,2);build('floor_wood',1,0);build('roof_thatch',1,0);for(const [dx,dy] of [[0,-1],[1,-1],[2,-1],[0,1],[1,1],[2,1],[2,0]])build('wall_wood',dx,dy);const door=build('door_wood',0,0);act('door',{eid:door.id});assert(door.open&&door.claim);r.player.x=X-96;r.player.y=Y;r.traces=[];delete r.traceWalk;markDirty();assert(validate(g));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});const url=process.env.GAME_URL||'http://127.0.0.1:4191', results=[];
async function enter(snapshot,width,height,offset=0){const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(({s,offset})=>{localStorage.setItem('soh.state.v3',s);if(offset){const now=Date.now;Date.now=()=>now()+offset;}},{s:snapshot,offset});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url,{waitUntil:'networkidle'});await page.getByRole('button',{name:/Continue —/}).click();await page.waitForFunction(()=>window.__soh?.run);return{context,page,errors};}
try{
  const seed=await enter(serializeSnapshot(g),640,360);const prior=seed.page.getByRole('button',{name:'Continue',exact:true});if(await prior.isVisible().catch(()=>false))await prior.click();
  await seed.page.keyboard.down('d');await seed.page.waitForFunction(x=>window.__soh.run.player.x>x+13,X,{timeout:6000});await seed.page.keyboard.up('d');await seed.page.keyboard.press('e');await seed.page.waitForFunction(id=>!window.__soh.run.entities[id].open,door.id,{timeout:2000});
  const moved=await seed.page.evaluate(()=>JSON.parse(JSON.stringify(window.__soh)));const marks=moved.run.traces;assert(marks.length>=5);assert.equal(marks[1].prevId,marks[0].id);assert(marks.some(t=>t.x<X-8&&t.x>X-28),'actual marks reach door');await seed.context.close();
  for(const scenario of ['valid','broken','safe','offline'])for(const [width,height] of [[640,360],[1280,720]]){
    const fixture=structuredClone(moved),q=fixture.run;q.creatures=[];q.player.action=null;q.clock.lastSimAt=Date.now();
    if(scenario==='broken')q.traces=q.traces.filter(t=>t.id!==marks[1].id);if(scenario==='safe')q.traces=[];
    const wx=scenario==='safe'?X-24:marks[0].x-8;const m=mkCreature(q,'boar',wx,Y,40);m.prov=true;m.t=480;m.tx=wx+40;m.ty=Y;q.creatures.push(m);markDirty();assert(validate(fixture));
    const loaded=await enter(serializeSnapshot(fixture),width,height,scenario==='offline'?6000:0),page=loaded.page;
    const report=page.getByRole('button',{name:'Continue',exact:true});
    if(scenario==='offline'){
      await page.getByText(/Wood Door: 140 →/).waitFor({timeout:5000});await page.waitForTimeout(400);
      const hp=await page.evaluate(id=>window.__soh.run.entities[id]?.hp,door.id);assert(hp<140);await page.screenshot({path:`${out}/offline-impact-${width}x${height}.png`});results.push({scenario,width,height,hp,generatedMarks:marks.length});await report.click();
    }else{
      if(await report.isVisible().catch(()=>false))await report.click();
      if(scenario==='valid') await page.waitForFunction(id=>window.__soh.run.entities[id]?.hp<140,door.id,{timeout:7000});else await page.waitForTimeout(3500);
      const state=await page.evaluate(({id,mid})=>{const r=window.__soh.run,m=r.creatures.find(m=>m.id===mid);return{hp:r.entities[id]?.hp,creatureX:m.x,knows:m.knows,ignore:m.traceIgnore,receipts:r.receipts.filter(z=>z.kind==='struct.hit').map(z=>z.detail)}} ,{id:door.id,mid:m.id});
      if(scenario==='valid'){assert(state.hp<140);assert(state.creatureX>wx);assert(state.receipts.some(d=>d.startsWith(door.id)));await page.getByText(/HP [0-9]+\/140/).waitFor({timeout:2000});}else assert.equal(state.hp,140);
      await page.screenshot({path:`${out}/${scenario}-${width}x${height}.png`});results.push({scenario,width,height,startX:wx,...state});
    }
    assert.deepEqual(loaded.errors,[]);await loaded.context.close();console.log('PASS',scenario,width,height,JSON.stringify(results.at(-1)));
  }
  await writeFile(`${out}/observations.json`,JSON.stringify({site,generatedMarks:marks.length,paidBuildReceipts:moved.run.receipts.filter(q=>q.kind==='build').map(q=>q.detail),results},null,2));
}finally{await browser.close();await vite.close();}
