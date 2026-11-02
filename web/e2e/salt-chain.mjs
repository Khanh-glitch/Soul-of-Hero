import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const out = path.resolve('evidence/salt-chain');
await fs.mkdir(out, { recursive: true });
const vite = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true }, appType: 'custom' });
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
    sources: r.sources, elapsed:r.elapsed, seed:r.seed };
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
    let guard=0;
    while(await count(itemKey)<needed&&guard++<6){
      const s=await state(), p=s.player;
      const candidates=[];
      for(let i=0;i<world.src.length;i++)if(world.src[i]>=0&&SRC_KEYS[world.src[i]]===sourceKey){const x=i%world.width,y=(i/world.width)|0; if(!s.sources?.[i]||s.sources[i].stock>0)candidates.push({x,y,d:Math.hypot(x*16+8-p.x,y*16+8-p.y)});}
      candidates.sort((a,b)=>a.d-b.d);assert(candidates.length,`No remaining ${sourceKey} source`);
      const n=candidates[0], wx=n.x*16+8,wy=n.y*16+8;
      await walkNear(wx,wy,18);
      await aim(wx,wy);
      const before=await count(itemKey); await page.mouse.down();
      for(let k=0;k<10000&&await count(itemKey)<needed;k+=120)await sleep(120);
      await page.mouse.up(); await sleep(500);
      // Harvest drops are collected by the game's ordinary near-player pickup simulation.
      const after=await count(itemKey);log.push(`harvest ${sourceKey} -> ${itemKey}: ${before} -> ${after} near source (${n.x},${n.y})`);
      const now=await state();for(const d of now.drops.filter(d=>d.key===itemKey))await walkNear(d.x,d.y,6);
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

  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173', {waitUntil:'networkidle'});
  await page.getByRole('button',{name:/New Run|New Game/i}).waitFor({timeout:30000});
  await screenshot('01-title-1280x720.png');
  await page.getByRole('button',{name:/New Run|New Game/i}).click();await sleep(250);
  await page.getByText("Fisher's Point",{exact:true}).click();await sleep(100);
  await page.getByRole('button',{name:/Begin|Start/i}).click();
  await page.waitForFunction(()=>Boolean(window.__soh?.run),null,{timeout:15000});await sleep(500);
  let s=await state();assert(s,'No run started');log.push(`new run seed=${s.seed}; player=${JSON.stringify(s.player)}`);
  await screenshot('02-new-run-640x360.png');
  const wstart=world.starts.find(p=>p.id==='s1');assert(wstart,'Missing Fisher start');
  let crate=(await state()).entities.find(e=>e.kind==='loot'&&e.poi==='s1');assert(crate,'Fisher start crate missing');
  await interact(crate.x,crate.y);await page.getByRole('button',{name:'Take all'}).click();await sleep(300);await page.keyboard.press('Escape');
  assert((await count('meat'))>=1,'Starting crate supplied no meat');assert((await count('rope'))>=1,'Starting crate supplied no rope');
  log.push(`Fisher starter crate acquired ordinary loot: ${JSON.stringify({meat:await count('meat'),rope:await count('rope')})}`);
  await harvest('oak','wood',9);assert((await count('wood'))>=9,'Insufficient wood for pickaxe, campfire and fuel');
  await screenshot('03-wood-harvested-640x360.png');
  const pine=world.starts.find(p=>p.id==='s2');let pcrate=(await state()).entities.find(e=>e.kind==='loot'&&e.poi==='s2');assert(pcrate,'Pinewatch supply crate missing');
  await walkNear(pcrate.x,pcrate.y,20);const fisherToPinewatchTiles=lastRouteTiles;await aim(pcrate.x,pcrate.y);await page.keyboard.press('e');await sleep(250);await page.getByRole('button',{name:'Take all'}).click();await sleep(300);await page.keyboard.press('Escape');
  assert((await count('stone'))>=4,'Pinewatch supply crate did not provide the four pickaxe stones');
  log.push(`Walked from Fisher's Point to Pinewatch (${fisherToPinewatchTiles} map tiles) and searched its ordinary Ranger Cabin supply crate; stone=${await count('stone')}.`);
  // Return to Fisher's Point using the same terrain/source-aware BFS and real keyboard movement.
  await walkNear(wstart.tx*16+8,wstart.ty*16+8,30);log.push(`Returned on foot to Fisher's Point (${lastRouteTiles} map tiles) at ${JSON.stringify((await state()).player)}`);
  assert((await count('wood'))>=9&&await count('stone')>=4&&await count('rope')>=1,'Craft preconditions incomplete');
  log.push(`Stone Pickaxe exact recipe cost: wood 3, stone 4, rope 1; pre-craft held wood=${await count('wood')}, stone=${await count('stone')}, rope=${await count('rope')}.`);
  await craftByHand('Stone Pickaxe');assert((await count('stone_pick'))>=1,'Hand-crafting the pickaxe failed');
  log.push(`After honest hand craft: wood=${await count('wood')}, stone=${await count('stone')}, rope=${await count('rope')}, pickaxes=${await count('stone_pick')}.`);
  await equip('stone_pick');await screenshot('04-stone-pickaxe-crafted-1280x720.png');
  const saltList=[];for(let i=0;i<world.src.length;i++)if(world.src[i]>=0&&SRC_KEYS[world.src[i]]==='salt_shale'){const x=i%world.width,y=(i/world.width)|0;saltList.push({x,y,d:Math.hypot(x*16+8-(await state()).player.x,y*16+8-(await state()).player.y)});}
  saltList.sort((a,b)=>a.d-b.d);assert(saltList.length,'Salt Shale source absent');let salt=saltList[0];
  await walkNear(salt.x*16+8,salt.y*16+8,18);await aim(salt.x*16+8,salt.y*16+8);
  const saltBefore=await count('raw_salt'),atSalt=await state(),saltIndex=salt.y*world.width+salt.x,activeTool=await page.evaluate(()=>{const r=window.__soh.run;return r.custody.inv.slots[r.player.active]?.key||'fists'});log.push(`At Salt Shale (${salt.x},${salt.y}) from ${lastRouteTiles} tiles; player=${JSON.stringify(atSalt.player)}, distance=${Math.hypot(atSalt.player.x-(salt.x*16+8),atSalt.player.y-(salt.y*16+8)).toFixed(1)}px, active=${activeTool}, source=${JSON.stringify(atSalt.sources[saltIndex]||null)}.`);
  await page.mouse.down();for(let k=0;k<4000&&await count('raw_salt')<=saltBefore;k+=120)await sleep(120);await page.mouse.up();await sleep(700);
  if(await count('raw_salt')<=saltBefore){const now=await state();for(const d of now.drops.filter(d=>d.key==='raw_salt'))await walkNear(d.x,d.y,6);}
  const saltAfter=await state();log.push(`Salt Shale result: raw_salt ${saltBefore}->${await count('raw_salt')}; source=${JSON.stringify(saltAfter.sources[saltIndex]||null)}, drops=${JSON.stringify(saltAfter.drops)}.`);
  assert(await count('raw_salt')>saltBefore,`Pickaxe did not mine Raw Salt from Salt Shale at (${salt.x},${salt.y})`);
  log.push(`Mined Salt Shale at (${salt.x},${salt.y}); Raw Salt=${await count('raw_salt')}.`);
  await harvest('rock','stone',3);assert((await count('stone'))>=3,'Could not mine three campfire stones');
  await screenshot('05-mined-salt-and-stone-640x360.png');
  assert(await count('wood')>=6,'Need five Campfire wood plus one fuel');
  log.push(`Campfire exact build cost: wood 5, stone 3; pre-build wood=${await count('wood')}, stone=${await count('stone')}. One additional wood must remain for fuel.`);
  await page.keyboard.press('b');await sleep(250);await page.getByRole('button',{name:/Campfire/}).first().click();await sleep(150);
  // Select a real open tile for the placement click; it must be in ordinary placement range.
  s=await state();let site=null;
  for(let rad=1;rad<=4&&!site;rad++)for(let dy=-rad;dy<=rad&&!site;dy++)for(let dx=-rad;dx<=rad&&!site;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==rad)continue;const x=Math.floor(s.player.x/16)+dx,y=Math.floor(s.player.y/16)+dy,i=y*world.width+x;
    if(x>1&&y>1&&x<world.width-1&&y<world.height-1&&terrainPass(i)&&world.src[i]<0&&![T_DEEP,T_CLIFF,T_PWALL,T_LAVA].includes(world.tiles[i]))site={x,y};
  }
  assert(site,'No nearby open tile for campfire');await aim(site.x*16+8,site.y*16+8);await page.mouse.click(Math.round((site.x*16+8-camera(s.player).x)*2),Math.round((site.y*16+8-camera(s.player).y)*2));await sleep(500);await page.keyboard.press('Escape');
  s=await state();let fire=s.entities.find(e=>e.kind==='struct'&&e.type==='campfire');assert(fire,'Campfire placement failed; check placement constraints');
  log.push(`Paid and placed campfire at (${site.x},${site.y}); remaining wood=${await count('wood')}, stone=${await count('stone')}.`);
  await interact(fire.x,fire.y);await page.getByText('Fuel',{exact:false}).waitFor({timeout:5000});
  // Select the carried wood in Inventory, then place it into the campfire's first (fuel) slot through ordinary UI clicks.
  const inventory=page.locator('.panel').filter({hasText:'Inventory'}).last(),firePanel=page.locator('.panel').filter({hasText:'Campfire'}).first(),woodSlot=inventory.locator('.slot[title^="Wood"]');
  const fuelQty=async id=>page.evaluate(eid=>{const e=window.__soh.run.entities[eid];return window.__soh.run.custody[e.station.fuelC].slots.reduce((n,z)=>n+(z?.key==='wood'?z.qty:0),0)},id);
  // First use the panel's shift-click quick-transfer, then fall back to select-and-place in the actual fuel grid.
  await woodSlot.click({modifiers:['Shift']});await sleep(300);let fuel=await fuelQty(fire.id);
  if(fuel<1){await woodSlot.click();const selectedClass=await woodSlot.getAttribute('class');await firePanel.locator('.slot').first().click();await sleep(300);fuel=await fuelQty(fire.id);log.push(`Fuel transfer fallback UI selection class=${selectedClass}; station fuel=${fuel}.`);}
  assert(fuel>=1,'Campfire did not accept wood fuel');log.push(`Fueling cost: transferred wood x${fuel} from player inventory into the campfire fuel slot.`);
  const meatBefore=await count('meat'),saltBeforeQueue=await count('raw_salt');const queueBefore=Date.now();await page.getByRole('button',{name:'Queue',exact:true}).last().click();await sleep(400);s=await state();fire=s.entities.find(e=>e.id===fire.id);assert(fire.station.queue.some(q=>q.recipe==='salted_meat'),'Salted Roast was not queued');assert(await count('meat')===meatBefore-1,'Cooking did not consume exactly one meat');assert(await count('raw_salt')===saltBeforeQueue-1,'Cooking did not consume exactly one Raw Salt');
  log.push(`Queued Salted Roast through campfire UI; input cost meat 1 + Raw Salt 1 (before=${meatBefore}/${saltBeforeQueue}, after=${await count('meat')}/${await count('raw_salt')}), actual wall-clock start=${new Date(queueBefore).toISOString()}, fuel wood=${fuel}, queue=${JSON.stringify(fire.station.queue)}.`);
  await screenshot('06-campfire-queued-1280x720.png');
  // Production advances only on the live RAF simulation and normal wall-clock time; no test hook or station-step call.
  await page.waitForFunction(id=>{const e=window.__soh.run.entities[id];return e&&Object.values(window.__soh.run.custody).some(c=>c.slots.some(z=>z?.key==='salted_meat'))},fire.id,{timeout:30000});
  const producedAt=Date.now();log.push(`Salted Roast appeared after ${((producedAt-queueBefore)/1000).toFixed(1)} seconds of live browser time.`);
  // Recipe completion goes to the campfire output container. Right-click transfers the actual output to inventory.
  s=await state();fire=s.entities.find(e=>e.id===fire.id);const outSlots=await page.evaluate(id=>{const e=window.__soh.run.entities[id];return window.__soh.run.custody[e.station.outC].slots.map((z,i)=>z?{i,key:z.key}:null).filter(Boolean)},fire.id);
  if(outSlots.some(z=>z.key==='salted_meat')){const panel=page.locator('.panel').filter({hasText:'Campfire'}).first();await panel.locator('.slot[title^="Salted Roast"]').click({button:'right'});await sleep(300);}
  assert(await count('salted_meat')>=1,'Cooked Salted Roast not collected to player inventory');
  log.push(`Collected cooked Salted Roast; inventory=${await count('salted_meat')}; player state=${JSON.stringify((await state()).player)}.`);
  await screenshot('07-salted-roast-collected-640x360.png');
  await sleep(5500);await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/Continue/i}).waitFor({timeout:15000});await page.getByRole('button',{name:/Continue/i}).click();await page.waitForFunction(()=>Boolean(window.__soh?.run));await sleep(500);
  assert(await count('salted_meat')>=1,'Save/relaunch did not preserve collected Salted Roast');
  log.push(`Save/relaunch preserved Salted Roast; item=${await count('salted_meat')}, seed=${(await state()).seed}, elapsed=${(await state()).elapsed}.`);
  await screenshot('08-after-relaunch-1280x720.png');
  await openInventory();await page.locator('.panel').filter({hasText:'Inventory'}).last().locator('.slot[title^="Salted Roast"]').click({button:'right'});await sleep(300);
  s=await state();assert((s.counts.salted_meat||0)===0,'Eating Salted Roast did not consume it');log.push(`Ate Salted Roast through inventory use action; hunger=${s.player.hunger}, hp=${s.player.hp}.`);
  await closeInventory();await screenshot('09-salted-roast-eaten-640x360.png');
  assert(!log.some(x=>x.startsWith('PAGE ERROR:')),log.join('\n'));
  await fs.writeFile(path.join(out,'run-log.txt'),log.join('\n')+'\n');
  console.log(log.join('\n'));
} catch(e) {
  const failure=`FAIL: ${e.stack||e}`;
  await fs.writeFile(path.join(out,'run-log.txt'),[...log,failure].join('\n')+'\n').catch(()=>{});
  await page.screenshot({path:path.join(out,'failure.png'),animations:'disabled'}).catch(()=>{});
  // GitHub check annotations are readable through the API even when Actions log/artifact hosts are not reachable.
  const diagnostic=[...log.slice(-10),failure].join(' | ').replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
  console.log(`::error title=Salt chain E2E diagnostic::${diagnostic}`);
  console.error(log.join('\n'));throw e;
} finally {await browser.close();await vite.close();}
