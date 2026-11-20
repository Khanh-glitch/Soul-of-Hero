/** Normal keyboard walk in production. Navigation aid reads a COPY of the game's
 * Save-now snapshot on the driver side; never installs state in the browser.
 * Not proof that an unaided player can find the same person. */
import {chromium} from 'playwright';import {createServer} from 'vite';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const [url,out]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const log={scope:'normal control, read-only saved-map pathfinding aid',steps:[],errors:[],httpErrors:[],talk:[]};
try{
 const engine=await vite.ssrLoadModule('/src/game/engine.ts'),world=await vite.ssrLoadModule('/src/game/world.ts');
 const p=await browser.newPage({viewport:{width:640,height:360},deviceScaleFactor:1});p.setDefaultTimeout(60000);p.on('pageerror',e=>log.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)log.httpErrors.push([r.status(),r.url()]);});
 const btn=name=>p.getByRole('button',{name,exact:true});await p.goto(url);await btn('New run').click();await btn('Begin the 14 days').click();await btn('Begin the 14 days').waitFor({state:'hidden'});
 async function snapshot(){await p.keyboard.press('Escape');await btn('Save now').click();await p.waitForTimeout(300);const r=await p.evaluate(()=>{const k=Object.keys(localStorage).find(k=>/^soh\.state\.v\d+$/.test(k));return JSON.parse(JSON.parse(localStorage.getItem(k)).payload).run;});await p.keyboard.press('Escape');return r;}
 const width=200;let target;const excluded=new Set();
 for(let i=0;i<45;i++){
   const r=await snapshot();log.seed=r.seed;log.run=r.id;world.setActiveLayout(r.layoutId);engine.markDirty();const grid=engine.blockGrid(r),o=r.sourceMap.veyra.originAu;
   const px=Math.floor(r.player.x/16),py=Math.floor(r.player.y/16),start=py*width+px,fl=r.veyraFloor??0;
   if(r.player.dead){log.block='player died during approach';break;}
   const people=Object.values(r.humanWorld.people).filter(h=>!excluded.has(h.actorId)&&h.floor===fl&&h.state!=='DEAD'&&h.state!=='DOWNED'&&h.state!=='EVACUATED'&&!h.transit).map(h=>({h,x:h.gx-o[0]*2,y:h.gy-o[1]*2})).filter(t=>t.x>=0&&t.y>=0&&t.x<width&&t.y<width);
   people.sort((a,b)=> (b.h.actorId===target)-(a.h.actorId===target)||Math.hypot(a.x-px,a.y-py)-Math.hypot(b.x-px,b.y-py));
   const queue=[start],prev=new Int32Array(width*width).fill(-1);prev[start]=start;
   for(let j=0;j<queue.length;j++){const v=queue[j],x=v%width,y=Math.floor(v/width);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,n=ny*width+nx;if(nx<=0||ny<=0||nx>=width-1||ny>=width-1||prev[n]!==-1||grid[n]!==0)continue;prev[n]=v;queue.push(n);}}
   let pathTo,person;
   for(const t of people){const cell=queue.findIndex(v=>Math.hypot(v%width-t.x,Math.floor(v/width)-t.y)<=1.5 && engine.clearPhysicalLine(r,{x:(v%width+.5)*16,y:(Math.floor(v/width)+.5)*16},{x:(t.x+.5)*16,y:(t.y+.5)*16},true));if(cell<0)continue;
     person=t;pathTo=[];for(let v=queue[cell];v!==start;v=prev[v])pathTo.unshift(v-prev[v]);break;}
   if(!person){log.block='no reachable living person in saved window';break;}target=person.h.actorId;
   const step={at:r.clock.lastSimAt,player:[px+o[0]*2,py+o[1]*2],actor:target,role:person.h.occupation,gx:person.h.gx,gy:person.h.gy,route:pathTo.length};log.steps.push(step);
   if(!pathTo.length){await p.keyboard.press('f');await p.waitForTimeout(450);
     if(await btn('Work?').isVisible()){
       for(const q of ['Work?','Need?','Place?','Join?']){await btn(q).click();log.talk.push([q,await p.getByRole('status').last().innerText()]);}await p.screenshot({path:path.join(out,'conversation.png')});
       await btn('Recruit').click();log.recruit=await p.getByRole('status').last().innerText();await btn('Barter').click();log.barter=await p.getByText('Barter · personal packs only').isVisible();await p.screenshot({path:path.join(out,'personal-packs.png')});break;
     }
     if(await btn('Save now').isVisible())await p.keyboard.press('Escape');else if(await p.locator('.panel').count())await p.keyboard.press('Escape');excluded.add(target);continue;
   }
   let n=1;while(n<pathTo.length&&n<6&&pathTo[n]===pathTo[0])n++;const key={1:'d','-1':'a',200:'s','-200':'w'}[pathTo[0]];
   await p.keyboard.down(key);await p.waitForTimeout(Math.min(2400,250*n));await p.keyboard.up(key);
 }
 assert.deepEqual(log.errors,[]);assert.deepEqual(log.httpErrors,[]);if(!log.talk.length)log.block??='step budget without conversation';console.log(JSON.stringify({seed:log.seed,steps:log.steps.length,talk:log.talk,block:log.block}));
} catch(e){log.failure=String(e);throw e;}finally{fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify(log,null,2));await browser.close();await vite.close();}
