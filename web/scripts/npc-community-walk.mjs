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
 async function conversation(){
   if(!(await btn('Work?').isVisible()))return false;
   const panel=p.getByTestId('human-panel');log.contact=await panel.innerText();
   for(const q of ['Work?','Need?','Place?','Join?']){await btn(q).click();log.talk.push([q,await panel.getByRole('status').last().innerText()]);}
   await p.screenshot({path:path.join(out,'conversation.png')});await btn('Recruit').click();log.recruit=await panel.getByRole('status').last().innerText();
   await btn('Barter').click();log.barter=await p.getByText('Barter · personal packs only').isVisible();await p.screenshot({path:path.join(out,'personal-packs.png')});return true;
 }
 const width=200;let target;const excluded=new Set();
 for(let i=0;i<45;i++){
   const r=await snapshot();log.seed=r.seed;log.run=r.id;world.setActiveLayout(r.layoutId);engine.markDirty();const grid=engine.blockGrid(r),o=r.sourceMap.veyra.originAu;
   const px=Math.floor(r.player.x/16),py=Math.floor(r.player.y/16),start=py*width+px,fl=r.veyraFloor??0;
   if(r.player.dead){log.block='player died during approach';break;}
   const people=Object.values(r.humanWorld.people).filter(h=>!excluded.has(h.actorId)&&h.floor===fl&&h.state!=='DEAD'&&h.state!=='DOWNED'&&h.state!=='EVACUATED'&&!h.transit).map(h=>({h,x:h.gx-o[0]*2,y:h.gy-o[1]*2}));
   const cost=t=>Math.hypot(t.x-px,t.y-py)+(t.h.occupation==='guard'?12:0)+(t.h.state==='MOVING'?8:0)-(t.h.actorId===target?1:0);
   people.sort((a,b)=>cost(a)-cost(b));
   const queue=[start],prev=new Int32Array(width*width).fill(-1);prev[start]=start;
   for(let j=0;j<queue.length;j++){const v=queue[j],x=v%width,y=Math.floor(v/width);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,n=ny*width+nx;if(nx<=0||ny<=0||nx>=width-1||ny>=width-1||prev[n]!==-1||grid[n]!==0)continue;prev[n]=v;queue.push(n);}}
   let pathTo,person;
   for(const t of people){if(t.x<0||t.y<0||t.x>=width||t.y>=width)continue;const cell=queue.findIndex(v=>Math.hypot(v%width-t.x,Math.floor(v/width)-t.y)<=1.5 && engine.clearPhysicalLine(r,{x:(v%width+.5)*16,y:(Math.floor(v/width)+.5)*16},{x:(t.x+.5)*16,y:(t.y+.5)*16},true));if(cell<0)continue;
     person=t;pathTo=[];for(let v=queue[cell];v!==start;v=prev[v])pathTo.unshift(v-prev[v]);break;}
   if(!person){
     // A random shore may have no residents in the current window. Walk toward
     // the nearest living person's known global location via a reachable edge;
     // the game, not the driver, performs the window slide.
     const t=people[0];if(!t){log.block='no living surface resident';break;}
     const score=v=>Math.hypot(v%width-t.x,Math.floor(v/width)-t.y);
     const end=queue.reduce((best,v)=>score(v)<score(best)?v:best,start);
     if(end===start){log.block='no reachable tile closer to community';break;}
     person=t;pathTo=[];for(let v=end;v!==start;v=prev[v])pathTo.unshift(v-prev[v]);
   }
   target=person.h.actorId;
   const step={at:r.clock.lastSimAt,player:[px+o[0]*2,py+o[1]*2],actor:target,role:person.h.occupation,gx:person.h.gx,gy:person.h.gy,route:pathTo.length};log.steps.push(step);
   if(log.steps.length>=5 && log.steps.slice(-5).every(s=>s.player[0]===step.player[0] && s.player[1]===step.player[1])){
     log.block='walk stopped making tile progress; no interaction inferred';await p.screenshot({path:path.join(out,'blocked.png')});break;
   }
   if(!pathTo.length){await p.keyboard.press('f');await p.waitForTimeout(450);
     if(await conversation())break;
     if(await btn('Save now').isVisible())await p.keyboard.press('Escape');else if(await p.locator('.panel').count())await p.keyboard.press('Escape');excluded.add(target);continue;
   }
   const hint=p.getByText(/· F talk/).last();let met=false;
   // Execute a few contiguous route legs before taking another Save-now copy.
   // Stop immediately for a real nearby interaction, even with another resident.
   for(let offset=0;offset<Math.min(pathTo.length,12);){let n=1;while(offset+n<Math.min(pathTo.length,12)&&pathTo[offset+n]===pathTo[offset])n++;
     const key={1:'d','-1':'a',200:'s','-200':'w'}[pathTo[offset]];await p.keyboard.down(key);
     try{await hint.waitFor({state:'visible',timeout:Math.min(4200,320*n)});}catch{}finally{await p.keyboard.up(key);}
     if(await hint.isVisible()){await p.keyboard.press('f');await p.waitForTimeout(250);if(await conversation()){met=true;break;}}
     offset+=n;
   }
   fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify(log,null,2));if(met)break;
 }
 assert.deepEqual(log.errors,[]);assert.deepEqual(log.httpErrors,[]);if(!log.talk.length)log.block??='step budget without conversation';console.log(JSON.stringify({seed:log.seed,steps:log.steps.length,talk:log.talk,block:log.block}));
} catch(e){log.failure=String(e);throw e;}finally{fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify(log,null,2));await browser.close();await vite.close();}
