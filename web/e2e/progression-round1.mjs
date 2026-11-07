import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const out = path.resolve('evidence/progression-round1');
await fs.mkdir(out, { recursive: true });
const vite = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const log = [];
let lastRouteTiles = 0;
page.on('pageerror', e => log.push(`PAGE ERROR: ${e.message}`));
const snap = async (name, width=1280, height=720) => { await page.setViewportSize({width,height}); await page.waitForTimeout(180); await page.screenshot({ path: path.join(out, name), animations: 'disabled' }); if(width!==1280||height!==720){await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(180);} };
const state = () => page.evaluate(() => {
  const g = window.__soh;
  if (!g?.run) return null;
  const r = g.run, inv = r.custody.inv.slots;
  const counts = {};
  for (const s of inv) if (s) counts[s.key] = (counts[s.key] || 0) + s.qty;
  return { player: { x: r.player.x, y: r.player.y, hp: r.player.hp, hunger: r.player.hunger, thirst: r.player.thirst, active: r.player.active },
    counts, entities: Object.values(r.entities).map(e => ({ id:e.id,kind:e.kind,type:e.type,poi:e.poi,x:e.x,y:e.y,c:e.c,station:e.station && { fuelC:e.station.fuelC,outC:e.station.outC,burn:e.station.burn,queue:e.station.queue.map(q=>({recipe:q.recipe,left:q.left,total:q.total}))} })),
    drops: Object.values(r.entities).filter(e => e.kind === 'drop').map(e=>({x:e.x,y:e.y,key:r.custody[e.c]?.slots?.[0]?.key,qty:r.custody[e.c]?.slots?.[0]?.qty})),
    sources: r.sources, simMs:r.clock.simMs, seed:r.seed, log:r.log.slice(-5).map(l=>l.msg) };
});
const count = async key => (await state())?.counts[key] || 0;
const sleep = ms => page.waitForTimeout(ms);

try {
  const { getWorld, SRC_KEYS } = await vite.ssrLoadModule('/src/game/world.ts');
  const { SOURCES } = await vite.ssrLoadModule('/src/game/catalog.ts');
  const { WW, WH } = await vite.ssrLoadModule('/src/game/core.ts');
  const world = getWorld(); world.width = WW; world.height = WH;
  const T_DEEP=0, T_CLIFF=8, T_PWALL=15, T_LAVA=16;
  const terrainPass = i => ![T_DEEP,T_CLIFF,T_PWALL,T_LAVA].includes(world.tiles[i]);
  const pass = (x,y,s) => {
    if (x<1||y<1||x>=world.width-1||y>=world.height-1) return false;
    const i=y*world.width+x;
    if (!terrainPass(i)) return false;
    const si=world.src[i];
    if (si>=0) { const key=SRC_KEYS[si], node=s && s.sources?.[i]; if (SOURCES[key]?.block && (!node || node.stock>0)) return false; }
    return true;
  };
  const bfs = (startX,startY, targetX,targetY, radiusPx,s) => {
    const w=world.width,h=world.height,N=w*h;
    const sx=Math.max(1,Math.min(w-2,Math.floor(startX/16))), sy=Math.max(1,Math.min(h-2,Math.floor(startY/16)));
    const q=new Int32Array(N), from=new Int32Array(N).fill(-2); let head=0,tail=0; const start=sy*w+sx; q[tail++]=start;from[start]=-1;
    let goal=-1;
    while(head<tail){const i=q[head++],x=i%w,y=(i/w)|0,px=x*16+8,py=y*16+8;
      if(Math.hypot(px-targetX,py-targetY)<=radiusPx){goal=i;break;}
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*w+nx;if(from[j]!==-2)continue;if(j!==start&&!pass(nx,ny,s))continue;from[j]=i;q[tail++]=j;}
    }
    assert.notEqual(goal,-1,`No walkable route to (${targetX.toFixed(0)},${targetY.toFixed(0)}) from (${startX.toFixed(0)},${startY.toFixed(0)})`);
    const route=[];for(let i=goal;i!==-1;i=from[i])route.push({x:(i%w)*16+8,y:((i/w)|0)*16+8});return route.reverse();
  };
  async function walkNear(tx,ty,radius=24){
    let s=await state();assert(s,'Run is not active');let route=bfs(s.player.x,s.player.y,tx,ty,radius,s);lastRouteTiles=route.length-1;
    // Every waypoint is a real, short WASD movement; no coordinates are written to game state.
    for(const wp of route.slice(1)){
      for(let tries=0;tries<40;tries++){
        s=await state();let dx=wp.x-s.player.x,dy=wp.y-s.player.y;if(Math.hypot(dx,dy)<3)break;
        const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');
        for(const k of keys)await page.keyboard.down(k);
        await sleep(Math.min(130,Math.max(45,Math.hypot(dx,dy)/68*1000)));
        for(const k of keys)await page.keyboard.up(k);
      }
    }
    s=await state();assert(Math.hypot(s.player.x-tx,s.player.y-ty)<=radius+25,`Walk stopped outside target radius: ${Math.hypot(s.player.x-tx,s.player.y-ty).toFixed(1)}px`);
    return s;
  }
  function camera(p){return {x:Math.max(0,Math.min(world.width*16-640,p.x-320)),y:Math.max(0,Math.min(world.height*16-360,p.y-186))};}
  async function aim(tx,ty){await sleep(350);const s=await state(),c=camera(s.player),x=Math.max(2,Math.min(638,tx-c.x)),y=Math.max(2,Math.min(358,ty-c.y));await page.mouse.move(Math.round(x*2),Math.round(y*2));await sleep(150);}
  async function interact(tx,ty){await walkNear(tx,ty,20);await aim(tx,ty);await page.keyboard.press('e');await sleep(250);}
  async function harvest(sourceKey,itemKey,needed){
    let guard=0; const attempted=new Set();
    while(await count(itemKey)<needed&&guard++<24){
      const s=await state(), p=s.player;
      const candidates=[];
      for(let i=0;i<world.src.length;i++)if(world.src[i]>=0&&SRC_KEYS[world.src[i]]===sourceKey){const x=i%world.width,y=(i/world.width)|0; if(!attempted.has(i)&&(!s.sources?.[i]||s.sources[i].stock>0))candidates.push({x,y,i,d:Math.hypot(x*16+8-p.x,y*16+8-p.y)});}
      candidates.sort((a,b)=>a.d-b.d);assert(candidates.length,`No remaining ${sourceKey} source`);
      const n=candidates[0], wx=n.x*16+8,wy=n.y*16+8;
      await walkNear(wx,wy,18);
      await aim(wx,wy);
      const before=await count(itemKey); await page.mouse.down();
      for(let k=0;k<10000&&await count(itemKey)<needed;k+=120)await sleep(120);
      await page.mouse.up(); await sleep(500);
      // Harvest drops are collected by the game's ordinary near-player pickup simulation.
      const after=await count(itemKey);if(after<=before) attempted.add(n.i);log.push(`harvest ${sourceKey} -> ${itemKey}: ${before} -> ${after} near source (${n.x},${n.y})`);
      const now=await state();for(const d of now.drops.filter(d=>d.key===itemKey))await walkNear(d.x,d.y,18);
    }
    assert((await count(itemKey))>=needed,`Could not harvest ${needed} ${itemKey} from ${sourceKey}; have ${await count(itemKey)}`);
  }
  async function openInventory(){await page.keyboard.press('i');await sleep(200);}
  async function closeInventory(){await page.keyboard.press('i');await sleep(150);}
  async function equip(key){
    let s=await state(), slots=s.counts;
    const inv=await page.evaluate(()=>window.__soh.run.custody.inv.slots.map((z,i)=>z?{i,key:z.key}:null).filter(Boolean));
    const item=inv.find(z=>z.key===key);assert(item,`Missing ${key} to equip`);
    let hot=item.i;
    if(hot>7){
      // The eight hotbar slots are full (including incidental tree seeds), so swap the pickaxe with carried berries through the inventory UI.
      const replace=inv.find(z=>z.i<8&&z.key==='berries')||inv.find(z=>z.i<8&&z.key==='water_flask');assert(replace,'No ordinary consumable in hotbar to swap with the tool');
      await openInventory();const panel=page.locator('.panel').filter({hasText:'Inventory'}).last(), cells=panel.locator('.slot');await cells.nth(3+item.i).click();await cells.nth(3+replace.i).click();await closeInventory();hot=replace.i;
      log.push(`Moved Stone Pickaxe into hotbar slot ${hot+1} by swapping with ${replace.key} through Inventory.`);
    }
    await page.keyboard.press(String(hot+1));await sleep(200);
    s=await state();log.push(`selected ${key} in hotbar ${hot+1}; active=${s.player.active}`);
  }
  async function craftByHand(name){
    await page.keyboard.press('c');await sleep(300);const row=page.getByText(name,{exact:true}).locator('xpath=..');await row.getByRole('button',{name:'Craft',exact:true}).click();await sleep(400);await page.keyboard.press('Escape');
  }
  async function screenshot(name){await sleep(250);const small=name.includes('640x360');await snap(name,small?640:1280,small?360:720);}

  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173', {waitUntil:'networkidle'});
  await page.getByRole('button',{name:/New Run|New Game/i}).click();await sleep(500);
  await page.getByText('Pinewatch',{exact:true}).click();await sleep(300);await page.getByRole('button',{name:/Begin|Start/i}).click();
  await page.waitForFunction(()=>Boolean(window.__soh?.run));await sleep(500);
  let s=await state();log.push(`New run Pinewatch seed=${s.seed}`);
  let crate=s.entities.find(e=>e.kind==='loot'&&e.poi==='s2');await interact(crate.x,crate.y);await page.getByRole('button',{name:'Take all'}).click();await sleep(300);await page.keyboard.press('Escape');
  assert(await count('stone')>=4,'Pinewatch crate supplies 4 stone');
  await harvest('grass','fiber',4);await harvest('pine','wood',3);
  await craftByHand('Rope');await craftByHand('Stone Pickaxe');await equip('stone_pick');await harvest('rock','stone',9);
  await equip('knife');await harvest('pine','wood',24);await harvest('scrap','scrap',1);if(await count('fiber')<1)await harvest('grass','fiber',1);
  log.push(`Paid starting inventory: wood=${await count('wood')}, stone=${await count('stone')}, scrap=${await count('scrap')}, fiber=${await count('fiber')}`);
  // Candidate tiles are filtered from map metadata; all traversal and placement is keyboard/mouse.
  const eligible = (x,y,run,claim=false) => {const i=y*world.width+x;if(x<1||y<1||x>=world.width-1||y>=world.height-1)return false;
    if([0,1,8,12,13,14,15,16,18,19].includes(world.tiles[i]))return false;
    if(world.src[i]>=0 && (!run.sources?.[i] || run.sources[i].stock>0))return false;
    if(run.entities.some(e=>Math.floor(e.x/16)===x&&Math.floor(e.y/16)===y))return false;
    if(claim&&world.places.some(p=>Math.hypot(p.tx-x,p.ty-y)<10))return false;return true;};
  let candidates=[];s=await state();for(let y=1;y<199;y++)for(let x=1;x<199;x++)if(eligible(x,y,s,true)&&Math.hypot(x*16+8-s.player.x,y*16+8-s.player.y)>22)candidates.push({x,y,d:Math.hypot(x*16+8-s.player.x,y*16+8-s.player.y)});candidates.sort((a,b)=>a.d-b.d);assert(candidates.length);
  const c=candidates[0];await walkNear(c.x*16+8,c.y*16+8,40);s=await state();
  await page.keyboard.press('b');await sleep(200);await page.getByRole('button',{name:/Claim Totem/}).first().click();await sleep(150);await aim(c.x*16+8,c.y*16+8);s=await state();await page.mouse.click(Math.round((c.x*16+8-camera(s.player).x)*2),Math.round((c.y*16+8-camera(s.player).y)*2));await sleep(400);await page.keyboard.press('Escape');
  s=await state();const claim=s.entities.find(e=>e.type==='claim');assert(claim,'Claim was not built');log.push(`Paid claim at ${c.x},${c.y}`);
  let site=null;for(let dy=-3;dy<=3&&!site;dy++)for(let dx=-3;dx<=3&&!site;dx++){const x=c.x+dx,y=c.y+dy;if(Math.hypot(dx,dy)>5||!eligible(x,y,s))continue;if(Math.hypot(x*16+8-s.player.x,y*16+8-s.player.y)<16||Math.hypot(x*16+8-s.player.x,y*16+8-s.player.y)>65)continue;site={x,y};}
  assert(site,'No workbench site within range');await page.keyboard.press('b');await sleep(200);await page.getByRole('button',{name:/Workbench/}).first().click();await sleep(150);await aim(site.x*16+8,site.y*16+8);s=await state();await page.mouse.click(Math.round((site.x*16+8-camera(s.player).x)*2),Math.round((site.y*16+8-camera(s.player).y)*2));await sleep(400);await page.keyboard.press('Escape');
  s=await state();let bench=s.entities.find(e=>e.type==='workbench');assert(bench,'Workbench placement failed');await interact(bench.x,bench.y);
  const panel=page.locator('.panel').filter({hasText:'Equipment maintenance'}).first();await panel.waitFor({timeout:5000});await panel.locator('summary').click();await page.waitForTimeout(200);
  await screenshot('01-workbench-640x360.png');await screenshot('02-workbench-1280x720.png');
  const before=await page.evaluate(()=>window.__soh.run.custody.inv.slots.find(s=>s?.key==='knife').dur);assert(before<300,`Knife not worn ${before}`);
  const knife=panel.getByText('Survival Knife',{exact:false}).locator('xpath=..');await knife.getByRole('button',{name:'Repair'}).click();await sleep(350);
  const after=await page.evaluate(()=>window.__soh.run.custody.inv.slots.find(s=>s?.key==='knife').dur);assert.equal(after,300);log.push(`Repaired real starter knife ${before}->${after} at paid workbench; consumed scrap and fiber.`);
  await screenshot('03-repaired-1280x720.png');
  await sleep(5500);await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/Continue/i}).click();await page.waitForFunction(()=>Boolean(window.__soh?.run));
  assert.equal(await page.evaluate(()=>window.__soh.run.custody.inv.slots.find(s=>s?.key==='knife').dur),300);log.push('Reload + Continue preserved the repaired physical knife.');
  assert(!log.some(x=>x.startsWith('PAGE ERROR:')),log.join('\n'));
  await fs.writeFile(path.join(out,'run-log.txt'),log.join('\n')+'\n');console.log(log.join('\n'));
} catch(e) { const failure=`FAIL: ${e.stack||e}`;await fs.writeFile(path.join(out,'run-log.txt'),[...log,failure].join('\n')+'\n').catch(()=>{});await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error(log.join('\n'));throw e; }
finally {await browser.close();await vite.close();}
