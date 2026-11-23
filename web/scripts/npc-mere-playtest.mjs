// Production UI playthrough. Seed selected by the normal New Game clock. Read-only
// driver navigation uses a copy of the saved map. No writes to SOH saves or actors.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';import {createServer} from 'vite';
const [url='http://127.0.0.1:4180',out='/tmp/mere-review']=process.argv.slice(2);mkdirSync(out,{recursive:true});
const start=418*2**32+((7542^0x9e3779b9)>>>0),log={seed:7542,start,viewport:[640,360],errors:[],phases:[]};
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const p=await browser.newPage({viewport:{width:640,height:360},deviceScaleFactor:1});p.setDefaultTimeout(30000);p.on('pageerror',e=>log.errors.push(e.message));
try{
 await p.addInitScript(start=>{let at=Number(sessionStorage.getItem('review-clock')||start),anim=0,seq=0;const next=new Map();
   Date.now=()=>at;Object.defineProperty(performance,'now',{value:()=>anim});
   window.requestAnimationFrame=cb=>{next.set(++seq,cb);return seq;};window.cancelAnimationFrame=id=>next.delete(id);
   window.reviewFrame=ms=>{at+=ms;anim+=ms;const jobs=[...next];next.clear();for(const [,cb] of jobs)cb(anim);};
   // Observe only fields used for navigation/assertions. The live model is
   // reachable via React's Game props, not a shipped debug/command endpoint.
   window.readReview=()=>{const canv=document.querySelector('canvas');let node=canv?.[Object.keys(canv).find(k=>k.startsWith('__reactFiber'))];while(node&&!node.memoizedProps?.gs?.run)node=node.return;
     const r=node?.memoizedProps.gs.run;if(!r)return null;const c=r.humanWorld.communities['com:po_mere'],h=c.memberIds.map(id=>r.humanWorld.people[id]).find(h=>h.occupation==='guard'),o=r.sourceMap.veyra.originAu;
     const m=r.creatures.find(m=>m.id==='vy:roam:49:14');return {ms:at-start,p:[r.player.x/16+o[0]*2,r.player.y/16+o[1]*2],guard:[h.gx,h.gy],state:h.state,post:c.storeEntityId,watched:h.guardedEntityId,lastWatch:h.lastWatchAt,work:h.intent?.work?.entityId,kind:h.intent?.kind,alarm:h.intent?.watchResponse,job:h.intent?.intentId,weapon:h.equip.weapon?.uid,dur:h.equip.weapon?.dur,enemy:m&&{id:m.id,type:m.type,state:m.state,hp:m.hp},qa:r.qaUsed};};
 },start);
 const btn=name=>p.getByRole('button',{name,exact:true}),click=async b=>{await b.waitFor({state:'attached'});await b.click({force:true});};
 const frame=ms=>p.evaluate(ms=>{window.reviewFrame(ms);return window.readReview();},ms);
 const capture=async(label,s)=>{await p.screenshot({path:`${out}/${label}.png`,timeout:30000});log.phases.push({label,...s});};
 const readSave=()=>p.evaluate(()=>{const k=Object.keys(localStorage).find(k=>/^soh\.state\.v\d+$/.test(k));return JSON.parse(JSON.parse(localStorage.getItem(k)).payload).run;});
 await p.goto(url);await click(btn('New run'));await click(btn('Begin the 14 days'));await p.waitForFunction(()=>!!window.readReview(),{},{polling:100});
 const init=await readSave();assert.equal(init.seed,7542);assert.equal(init.custody.inv.slots[init.player.active]?.key,'stone_axe');const vite=await createServer({configFile:'vite.http.config.ts',server:{middlewareMode:true,hmr:false}});let path=[];
 try{const {blockGrid,markDirty}=await vite.ssrLoadModule('/src/game/engine.ts'),{syncVeyraPlacement}=await vite.ssrLoadModule('/src/veyra05/window.ts'),{setActiveLayout}=await vite.ssrLoadModule('/src/game/world.ts');syncVeyraPlacement(init);setActiveLayout(init.layoutId);markDirty();
   const grid=blockGrid(init),post=init.entities[init.humanWorld.communities['com:po_mere'].storeEntityId],goal=(post.ty+4)*200+post.tx+1,from=Math.floor(init.player.y/16)*200+Math.floor(init.player.x/16);const via=new Map([[from,-1]]),queue=[from];for(let i=0;i<queue.length&&!via.has(goal);i++)for(const d of [-200,-1,1,200]){const n=queue[i]+d;if(grid[n]!==0||via.has(n)||Math.abs(n%200-queue[i]%200)>1)continue;via.set(n,queue[i]);queue.push(n);}assert.ok(via.has(goal));const [ox,oy]=init.sourceMap.veyra.originAu;for(let n=goal;n!==from;n=via.get(n))path.unshift([n%200+ox*2+.5,Math.floor(n/200)+oy*2+.5]);
 }finally{await vite.close();}
 let s;for(let i=0;i<4;i++)s=await frame(2000);let index=0,held=new Set(),watch=false,fight=false,back=false;const keys=async want=>{for(const k of held)if(!want.has(k))await p.keyboard.up(k);for(const k of want)if(!held.has(k))await p.keyboard.down(k);held=want;};
 while(s.ms<65000){const [px,py]=s.p;if(index<path.length&&Math.abs(path[index][0]-px)<.15&&Math.abs(path[index][1]-py)<.15)index++;const [dx,dy]=index<path.length?[path[index][0]-px,path[index][1]-py]:[0,0];await keys(new Set([dy<-.14?'w':dy>.14?'s':null,dx<-.14?'a':dx>.14?'d':null].filter(Boolean)));s=await frame(50);
   if(s.ms%2000===0)console.log(s.ms,index,JSON.stringify(s));
   if(!watch&&s.ms>=16000&&(s.work===s.post||s.watched===s.post)&&!s.alarm){watch=true;await capture('01-watch',s);}
   if(!fight&&s.kind==='fight'&&s.alarm&&s.dur<100&&s.enemy?.hp>0){fight=true;await keys(new Set());await capture('02-intercept',s);await p.keyboard.press('Escape');await click(btn('Save & quit to title'));await p.getByRole('button',{name:/^Continue —/}).waitFor({state:'attached'});const stored=await readSave();assert.equal(stored.humanWorld.people.h1h.intent.intentId,s.job);
     await p.evaluate(()=>sessionStorage.setItem('review-clock',String(Date.now())));await p.reload();await click(p.getByRole('button',{name:/^Continue —/}));await p.waitForFunction(()=>!!window.readReview(),{},{polling:100});const resume=await p.evaluate(()=>window.readReview());assert.equal(resume.job,s.job);assert.equal(resume.enemy.hp,s.enemy.hp);log.resume=resume;
   }
   if(fight&&!back&&s.alarm&&s.kind==='work'&&s.state==='MOVING'){back=true;await capture('03-return',s);}
   if(fight&&s.lastWatch>start+log.resume.ms&&s.watched===s.post){await capture('04-on-post',s);break;}
 }
 assert.deepEqual(log.phases.map(x=>x.label),['01-watch','02-intercept','03-return','04-on-post']);assert.equal(s.qa,false);assert.deepEqual(log.errors,[]);log.browser=browser.version();
}finally{writeFileSync(out+'/observations.json',JSON.stringify(log,null,2)+'\n');await browser.close();}
