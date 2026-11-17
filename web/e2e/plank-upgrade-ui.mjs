/** Controlled stock/position fixture for actual UI selection→click→save/reload.
 * Not a natural acquisition route, performance benchmark, or human acceptance. */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5173';
const out='evidence/solo-final-fallback/20261117/plank-ui';mkdirSync(out,{recursive:true});
const launchOptions={executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
let browser=await chromium.launch(launchOptions);
try{
  let page=await browser.newPage({viewport:{width:640,height:360},deviceScaleFactor:1});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__plank_fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body>Controlled mechanical UI fixture</body>'}));
  await page.goto(base+'/__plank_fixture');
  const fixture=await page.evaluate(async()=>{
    const e=await import('/src/game/engine.ts'),w=await import('/src/game/world.ts'),c=await import('/src/game/catalog.ts'),p=await import('/src/game/persist.ts'),core=await import('/src/game/core.ts');
    w.setActiveLayout('shipping_fresh');const at=Date.now(),g=e.newGame();let seq=0;
    const act=(type,data={})=>{const result=e.dispatch(g,{id:'ui-fixture-'+ ++seq,type,...data},at);if(!result.ok)throw Error(type+':'+result.reason);};
    act('startRun',{character:'female',seed:881});const r=g.run;r.creatures=[];
    const fund=type=>{const d=c.STRUCTS[type],rc=d.item&&c.RECIPES[d.item];for(const [k,q]of rc?.ins??d.cost)if(e.addItem(r,'inv',k,q))throw Error('fixture capacity');if(rc)act('craft',{recipe:d.item});};
    const place=type=>{fund(type);const cx=r.player.x/16|0,cy=r.player.y/16|0;for(let k=1;k<20;k++)for(let dy=-k;dy<=k;dy++)for(let dx=-k;dx<=k;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==k)continue;const tx=cx+dx,ty=cy+dy;r.player.x=(tx-1)*16+8;r.player.y=ty*16+8;e.markDirty();
      if(e.buildReason(g,type,tx,ty))continue;act('build',{struct:type,tx,ty});return Object.values(r.entities).find(v=>v.type===type&&v.tx===tx&&v.ty===ty);
    }throw Error('no legal '+type);};
    const floor=place('floor_wood');fund('claim');r.player.x=(floor.tx-1)*16+8;r.player.y=floor.ty*16+8;e.markDirty();act('build',{struct:'claim',tx:floor.tx,ty:floor.ty});
    const wall=place('wall_wood');wall.hp=80;e.addItem(r,'inv','plank',3);
    const cabinet=Object.values(r.entities).find(e=>e.type==='claim');
    for(const [k,q]of [['wood',40],['stone',20],['fiber',20],['plank',3]])if(e.addItem(r,cabinet.c,k,q))throw Error('cabinet fixture capacity');
    const key=`soh.state.v${core.SAVE_VERSION}`;localStorage.setItem(key,p.serializeSnapshot(g));
    return {key,wall:{id:wall.id,x:wall.x,y:wall.y},at};
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/^Continue/}).click({timeout:120000});
  await page.waitForTimeout(2000);await page.keyboard.press('KeyU');
  const choice=page.getByRole('group',{name:'Wall upgrade choice'});await choice.waitFor();
  await choice.getByRole('button',{name:/Plank Wall/}).click();
  if(await choice.getByRole('button',{name:/Plank Wall/}).getAttribute('aria-pressed')!=='true')throw Error('Plank preference not selected');
  // Screen scaling is 1 at the logical 640x360 viewport; use the actual render camera.
  const point=await page.evaluate(wall=>{const v=window.__sohView();return {x:v.off.x+(wall.x-Math.round(v.cam.x))*v.scale,y:v.off.y+(wall.y-Math.round(v.cam.y))*v.scale};},fixture.wall);
  if(point.x<0||point.x>=640||point.y<0||point.y>=360)throw Error('Wall outside actual view '+JSON.stringify(point));
  await page.mouse.move(point.x,point.y);await page.waitForTimeout(200);
  await page.screenshot({path:out+'/selected-640x360.png'});
  await page.mouse.click(point.x,point.y);await page.waitForTimeout(300);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Save & quit to title',exact:true}).click();await page.getByRole('button',{name:/^Continue/}).waitFor();
  // Preserve actual browser-written local storage, then start a separate browser process.
  const storageState=await page.context().storageState();
  await browser.close();browser=await chromium.launch(launchOptions);
  const context=await browser.newContext({viewport:{width:640,height:360},storageState});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/^Continue/}).waitFor({timeout:120000});
  const result=await page.evaluate(async({key,wall})=>{const p=await import('/src/game/persist.ts'),g=p.selectSnapshots([localStorage.getItem(key)]).gs;if(!g?.run)throw Error('saved game not valid');return {wall:g.run.entities[wall.id],planks:g.run.custody.inv.slots.reduce((n,s)=>n+(s?.key==='plank'?s.qty:0),0)};},fixture);
  if(result.wall.type!=='wall_plank'||result.wall.maxHp!==240||result.wall.hp>120||result.wall.hp<119||result.planks!==0)throw Error(JSON.stringify(result));
  if(errors.length)throw Error(errors.join('\n'));
  writeFileSync(out+'/result.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fixture:'controlled stock, paid packs, position; actual normal UI input',viewport:[640,360],result,errors,limitations:['Vite dev/SwiftShader, not production/native/human review','No natural-source journey or FPS claim']},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',type:result.wall.type,hp:result.wall.hp,planks:result.planks,errors}));
}finally{await browser.close();}
