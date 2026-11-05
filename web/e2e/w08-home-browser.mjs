// W08 home maintenance browser capture. CONTROLLED FIXTURE, below S3:
// - the home (floor, roof, four walls, Cabinet on a separate foundation) is placed through real build intents;
// - Cabinet stock is injected into the real container (unfunded case: none; funded case: 60 wood, 20 stone, 10 fiber);
// - run start is shifted to reach night or day (dayTime is run-elapsed based). This is a fixture, not a natural clock.
// Interaction after load is real: Continue click, E to open the Cabinet, screenshots at 640x360.
import {chromium} from 'playwright';import {createServer} from 'vite';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';

const dir='../evidence/w08-home';await mkdir(`${dir}/frames`,{recursive:true});
const vite=await createServer({configFile:'vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
const E=await vite.ssrLoadModule('/src/game/engine.ts');const WL=await vite.ssrLoadModule('/src/game/world.ts');const P=await vite.ssrLoadModule('/src/game/persist.ts');const K=await vite.ssrLoadModule('/src/game/core.ts');
const {newGame,dispatch,addItem,markDirty,homeStatus}=E;const {serializeSnapshot,validate}=P;const {TILE,BAL,HOUR}=K;
const dayLen=BAL.dayNight.dayLengthMinutes*60000;

async function makeSave(kind){
  // Phase: dayTime = ((elapsed + 0.3*len) mod len)/len. Night at t≈0 => elapsed 0.7 len; day at t≈0.5 => elapsed 0.2 len.
  // The run is started at a legal past time so that the browser's load moment lands in the requested phase (no startedAt edits).
  const targetElapsed=kind.startsWith('night')?0.7*dayLen:0.2*dayLen;
  const T=Date.now()-targetElapsed;
  const g=newGame();assert(dispatch(g,{id:`w8-start-${kind}`,type:'startRun',character:'female',seed:77},T).ok,'startRun');
  const r=g.run,p=r.player;const worldData=WL.getWorld();
  r.creatures=[];
  // Clear terrain around a legal open spot (same method as the controlled tests).
  const x0=Math.floor(p.x/TILE),y0=Math.floor(p.y/TILE);
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const i=(y0+dy)*K.WW+x0+dx;r.terrain[i]={t:K.T.GRASS};if(worldData.sourceV3[i])r.sources[i]={stock:0,hp:0};}
  let step=0;const mk=(type,dx,dy)=>{
    const res=dispatch(g,{id:`w8-${kind}-${++step}`,type:'build',struct:type,tx:x0+dx,ty:y0+dy},T+step*10);
    assert(res.ok,`build ${type} ${dx},${dy}: ${res.reason}`);
    return Object.values(r.entities).find(e=>e.kind==='struct'&&e.type===type&&e.tx===x0+dx&&e.ty===y0+dy);
  };
  const stand=(dx,dy)=>{p.x=(x0+dx)*TILE+8;p.y=(y0+dy+2)*TILE+8;markDirty();};
  for(const [k,q] of [['wood',200],['stone',80],['fiber',30],['rope',10],['brick',30]]) addItem(r,'inv',k,q);
  stand(0,0);mk('floor_wood',0,0);mk('roof_thatch',0,0);
  for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]]){stand(dx,dy);mk('wall_wood',dx,dy);}
  stand(3,-2);mk('floor_wood',3,-2);const cab=mk('claim',3,-2);
  if(kind!=='night-unfunded'){for(const [k,q] of [['wood',60],['stone',20],['fiber',10]]) addItem(r,cab.c,k,q);}
  // Damaged funded wall for the funded day case.
  const wall=Object.values(r.entities).find(e=>e.type==='wall_wood'&&e.tx===x0+1&&e.ty===y0);
  if(kind==='day-funded'&&wall)wall.hp=60;
  // Player stands next to the Cabinet, inside view of the home.
  p.x=(x0+2)*TILE+8;p.y=(y0-1)*TILE+8;markDirty();
  const save=serializeSnapshot(g);assert(validate(JSON.parse(JSON.parse(save).payload)),'valid save');
  const status=homeStatus(r);
  return {save,T,status:JSON.parse(JSON.stringify(status,(k,v)=>Number.isFinite(v)?v:(v===Infinity?'Infinity':v)))};
}

const cases=[['night-unfunded','night'],['day-funded','day']];
const meta={};
for(const [kind] of cases){const m=await makeSave(kind);meta[kind]=m;await writeFile(`${dir}/${kind}-save.json`,m.save);}
await vite.close();

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']});
const log={note:'Return report dismissed with a real Continue click before HUD capture.',disclosure:'controlled fixture below S3: home placed by real build intents; cabinet stock injected for funded case; run start shifted for day/night; Continue and E are real input',cases:{}};
try{
  for(const [kind] of cases){
    const ctx=await browser.newContext({viewport:{width:640,height:360}});
    await ctx.addInitScript(({save})=>{localStorage.setItem('soh.state.v3',save);},{save:meta[kind].save});
    const page=await ctx.newPage();
    await page.goto(process.env.SOH_URL||'http://localhost:8765/index.html',{waitUntil:'load'});
    await page.waitForTimeout(2000);
    await page.getByRole('button',{name:/Continue/}).first().click();
    await page.waitForTimeout(2000);
    await page.getByRole('button',{name:'Continue'}).first().click({timeout:5000}).catch(()=>{}); // real input: dismiss return report
    await page.waitForTimeout(1200);
    await page.screenshot({path:`${dir}/frames/${kind}-01-hud-640x360.png`});
    await page.keyboard.press('e');                                  // real input: open Cabinet interaction
    await page.waitForTimeout(1200);
    await page.screenshot({path:`${dir}/frames/${kind}-02-cabinet-640x360.png`});
    const txt=await page.locator('[data-testid="cabinet-readout"]').first().innerText().catch(()=>'(readout not visible)');
    const hud=await page.locator('[data-testid="home-status"]').first().innerText().catch(()=>'(hud not visible)');
    log.cases[kind]={statusModel:meta[kind].status,hudText:hud,cabinetText:txt,url:page.url()};
    await ctx.close();
  }
  await writeFile(`${dir}/browser-log.json`,JSON.stringify(log,null,2));
  console.log('DONE');
}finally{await browser.close();}
