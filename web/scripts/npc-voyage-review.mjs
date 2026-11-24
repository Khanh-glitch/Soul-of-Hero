// Controlled production-browser check: generate a real sealed checkpoint, load it
// in a fresh browser, then use only the title, run menu and ordinary game keys.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const [url='http://127.0.0.1:4180',out='/tmp/soh-voyage-review']=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const server=await createServer({configFile:'vite.http.config.ts',server:{middlewareMode:true,hmr:false}});
let save,version,at;
try {
  const load=path=>server.ssrLoadModule('/src/'+path+'.ts');
  const {newGame,startRun}=await load('game/engine'),{serializeSnapshot}=await load('game/persist');
  const {evacSchedule,advanceEvacuation,playerBoardEvac,departEvac}=await load('game/humanworld');
  const {setActiveLayout}=await load('game/world'),{layoutIdAt}=await load('veyra05/scenes'),{auToTile,windowAround}=await load('veyra05/frame');
  const [gx,gy]=auToTile(921,259),w=windowAround(gx,gy);setActiveLayout(layoutIdAt(w.originTx,w.originTy));
  const gs=newGame();at=Date.now();assert.ok(startRun(gs,'female',at,null,7606,{tx:gx-w.originTx,ty:gy-w.originTy}).ok);
  const r=gs.run,hw=r.humanWorld,t=Object.values(hw.evacuation)[0];r.qaUsed=true;r.qaOffset=evacSchedule().openHour*3600000;
  advanceEvacuation(r,hw,at);r.player.x=(t.siteGx-w.originTx+.5)*16;r.player.y=(t.siteGy-w.originTy+.5)*16;
  assert.ok(playerBoardEvac(r,hw,t.tripId,at).ok);assert.ok(departEvac(r,hw,t.tripId,at).ok);
  save=serializeSnapshot(gs);version=gs.version;
} finally {await server.close();}
const b=await chromium.launch({executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const p=await b.newPage({viewport:{width:640,height:360},deviceScaleFactor:1});p.setDefaultTimeout(90000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date(at+50));
  await p.addInitScript(({save,version})=>localStorage.setItem('soh.state.v'+version,save),{save,version});
  await p.goto(url);await p.getByRole('button',{name:/^Continue —/}).click();const sea=p.getByRole('region',{name:'Sea passage'});
  await sea.waitFor();const report=p.getByTestId('return-chronicle');
  if(await report.isVisible())await report.getByRole('button',{name:/Return to vessel|Continue/}).click();
  await p.keyboard.press('i');await p.keyboard.press('f');assert.ok(await sea.isVisible());
  await p.screenshot({path:out+'/passage.png'});await sea.getByRole('button',{name:'Run menu'}).click();
  await p.getByText(/voyage clock and hull/).waitFor();await p.keyboard.press('Escape');
  assert.equal(await p.getByText(/voyage clock and hull/).count(),0);assert.deepEqual(errors,[]);
  writeFileSync(out+'/browser.json',JSON.stringify({mode:'controlled production save, fixed clock',viewport:[640,360],browser:b.version(),text:await sea.innerText(),errors},null,2));
} finally {await b.close();}
