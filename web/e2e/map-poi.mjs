import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const out = path.resolve('evidence/map-poi');
await fs.mkdir(out, { recursive: true });
const vite = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true }, appType: 'custom' });
const browser = await chromium.launch({ headless: true });
const log = [`build_sha=${process.env.BUILD_SHA || 'local-uncommitted'}`, `workflow_run=${process.env.GITHUB_RUN_ID || 'local'}`, `run_attempt=${process.env.GITHUB_RUN_ATTEMPT || '1'}`, `browser=Chromium ${browser.version()}`, 'persistence_scope=same-browser-profile page reload + Continue; not OS-process-exit proof'];
let page;
const pause = ms => page.waitForTimeout(ms);
const snap = async (name, width, height) => { await page.setViewportSize({ width, height }); await pause(200); await page.screenshot({ path: path.join(out, name), animations: 'disabled' }); await page.setViewportSize({ width: 1280, height: 720 }); await pause(150); };
const state = () => page.evaluate(() => {
  const r = window.__soh?.run; if (!r) return null;
  const counts = {};
  for (const s of r.custody.inv.slots) if (s) counts[s.key] = (counts[s.key] || 0) + s.qty;
  return { id: r.id, seed: r.seed, layoutId: r.layoutId || 'shipping', player: { x:r.player.x,y:r.player.y,hp:r.player.hp,dead:r.player.dead,hunger:r.player.hunger,thirst:r.player.thirst }, counts,
    creatures:r.creatures.filter(m=>m.hp>0).map(m=>({id:m.id,x:m.x,y:m.y,hp:m.hp,state:m.state,type:m.type})),
    entities: Object.values(r.entities).map(e => ({ id:e.id,kind:e.kind,poi:e.poi,x:e.x,y:e.y,tx:e.tx,ty:e.ty,locked:e.locked,open:e.open,power:e.power,label:e.label,c:e.c })),
    sources:r.sources,containers: Object.fromEntries(Object.entries(r.custody).map(([id,c])=>[id,c.slots.map(s=>s&&({key:s.key,qty:s.qty}))])) };
});
const sleepUntil = async (fn, message, timeout = 8000) => page.waitForFunction(fn, null, { timeout }).catch(() => { throw new Error(message); });
const inputCount = async key => (await state())?.counts[key] || 0;

try {
  const [{ getWorld, SRC_KEYS }, { WW, WH, T }, { MAP_CONTENT_PACKS, validateContentPack }, { SOURCES }] = await Promise.all([
    vite.ssrLoadModule('/src/game/world.ts'), vite.ssrLoadModule('/src/game/core.ts'), vite.ssrLoadModule('/src/game/content.ts'), vite.ssrLoadModule('/src/game/catalog.ts'),
  ]);
  const invalid = structuredClone(MAP_CONTENT_PACKS.dev_delta); invalid.pois[0].width = 0; invalid.pois[0].loot.outer[0].item = 'not_a_real_item';
  const rejected = validateContentPack(invalid); assert(rejected.some(e => e.includes('footprint')) && rejected.some(e => e.includes('unknown loot item')));
  log.push(`negative_validation=PASS (${rejected.join(' | ')})`);
  const blocks = new Set([T.DEEP, T.CLIFF, T.PWALL, T.LAVA]);

  async function runLayout(layoutId, landing, layoutLabel, suffix) {
    const world = getWorld(layoutId); const W = WW, H = WH;
    const ctx = await browser.newContext({ viewport: { width:1280, height:720 }, deviceScaleFactor:1 }); page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173', { waitUntil:'networkidle' });
    await page.getByRole('button',{name:/New run/i}).waitFor({ timeout:30000 });
    await page.getByRole('button',{name:/New run/i}).click();
    await page.getByTestId(layoutId === 'shipping' ? 'layout-shipping' : 'layout-dev-delta').click();
    await snap(`${suffix}-layout-picker-1280x720.png`,1280,720);
    await snap(`${suffix}-layout-picker-640x360.png`,640,360);
    await page.getByRole('button',{name:landing,exact:true}).click();
    await page.getByRole('button',{name:/Begin the 14 days/i}).click();
    await sleepUntil(()=>Boolean(window.__soh?.run),'run did not start'); await pause(400);
    let s = await state(); assert.equal(s.layoutId,layoutId); const seed = s.seed, runId=s.id;
    log.push(`${layoutId}: run=${runId} seed=${seed} landing=${landing}`);
    await snap(`${suffix}-hud-1280x720.png`,1280,720);
    await snap(`${suffix}-hud-640x360.png`,640,360);

    const doorOf = label => { const e=s.entities.find(e=>e.kind==='door'&&e.label===label); assert(e,`missing ${label}`); return e; };
    let keydoor,entry=null,powerdoor=null,gen=null,outer,vaults=[],exitTarget;
    if(layoutId==='shipping'){
      keydoor=doorOf('Lighthouse Door'); outer=s.entities.find(e=>e.kind==='loot'&&e.poi==='light');
      vaults=s.entities.filter(e=>e.kind==='loot'&&e.poi==='light_top');gen=s.entities.find(e=>e.kind==='gen'&&e.poi==='light');
      assert(outer&&vaults.length===1&&gen,'shipping Lighthouse POI content missing');
      exitTarget={x:keydoor.x,y:keydoor.y+40};
    }else{
      entry=doorOf('Delta Relay Station Entry');keydoor=doorOf('Keycard Reader');powerdoor=doorOf('Power Gate');
      outer=s.entities.find(e=>e.kind==='loot'&&e.poi==='delta_relay'&&e.label==='Maintenance Cache');
      vaults=s.entities.filter(e=>e.kind==='loot'&&e.poi==='delta_relay'&&e.label==='Relay Vault Cache');
      gen=s.entities.find(e=>e.kind==='gen'&&e.poi==='delta_relay');assert(outer&&vaults.length===1&&gen);
      exitTarget={x:entry.x,y:entry.y+40};
    }
    const vault=vaults[0]; assert(outer&&vault);
    let entityBlocked = new Set(); let initialApproachTiles = 0; let defending = false;
    const pass = (x,y,current) => {
      if(x<1||y<1||x>=W-1||y>=H-1)return false;
      const i=y*W+x; if(blocks.has(world.tiles[i])||entityBlocked.has(i))return false;
      const si=world.src[i]; if(si>=0){const key=SRC_KEYS[si],node=current.sources?.[i];if(SOURCES[key]?.block&&(!node||node.stock>0))return false;}
      return true;
    };
    async function walkNear(wx,wy,radius=22){
      let cur=await state();entityBlocked=new Set(cur.entities.filter(e=>e.tx!==undefined&&((e.kind==='door'&&!e.open)||['loot','cash','vendor','gen','evac'].includes(e.kind))).map(e=>e.ty*W+e.tx));
      const vx=wx-cur.player.x,vy=wy-cur.player.y,vlen=vx*vx+vy*vy;
      for(const m of cur.creatures){const t=vlen?Math.max(0,Math.min(1,((m.x-cur.player.x)*vx+(m.y-cur.player.y)*vy)/vlen)):0;const d=Math.hypot(m.x-(cur.player.x+t*vx),m.y-(cur.player.y+t*vy));if(d<48){const mx=Math.floor(m.x/16),my=Math.floor(m.y/16);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)entityBlocked.add((my+dy)*W+mx+dx);}}
      const sx=Math.max(1,Math.min(W-2,Math.floor(cur.player.x/16))),sy=Math.max(1,Math.min(H-2,Math.floor(cur.player.y/16)));
      const q=new Int32Array(W*H),from=new Int32Array(W*H).fill(-2);let h=0,t=0,start=sy*W+sx,goal=-1;q[t++]=start;from[start]=-1;
      while(h<t){const i=q[h++],x=i%W,y=(i/W)|0;if(Math.hypot(x*16+8-wx,y*16+8-wy)<=radius){goal=i;break;}
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*W+nx;if(from[j]!==-2||j!==start&&!pass(nx,ny,cur))continue;from[j]=i;q[t++]=j;}}
      assert.notEqual(goal,-1,`no walkable route near (${wx},${wy}) from (${cur.player.x.toFixed(0)},${cur.player.y.toFixed(0)})`);
      const route=[];for(let i=goal;i!==-1;i=from[i])route.push({x:(i%W)*16+8,y:((i/W)|0)*16+8});route.reverse();if(!initialApproachTiles)initialApproachTiles=route.length-1;
      for(let step=0;step<route.length-1;step++){
        const wp=route[step+1];for(let tries=0;tries<40;tries++){
          cur=await state();const dx=wp.x-cur.player.x,dy=wp.y-cur.player.y;if(Math.hypot(dx,dy)<3)break;
          const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');
          for(const k of keys)await page.keyboard.down(k);await pause(115);for(const k of keys)await page.keyboard.up(k);
        }
        if(step%4===3){await ensureVitals();if(!defending)await defendNearby();}
      }
      cur=await state();assert(Math.hypot(cur.player.x-wx,cur.player.y-wy)<=radius+22,`walk ended ${Math.hypot(cur.player.x-wx,cur.player.y-wy).toFixed(1)}px from target (${wx},${wy}); player=(${cur.player.x.toFixed(1)},${cur.player.y.toFixed(1)}) hp=${cur.player.hp} dead=${cur.player.dead}, routeTiles=${route.length-1}`);return cur;
    }
    const camera=p=>({x:Math.max(0,Math.min(W*16-640,p.x-320)),y:Math.max(0,Math.min(H*16-360,p.y-180))});
    async function aim(wx,wy){await pause(100);const cur=await state(),c=camera(cur.player);const x=Math.max(2,Math.min(638,wx-c.x)),y=Math.max(2,Math.min(358,wy-c.y));await page.mouse.move(Math.round(x*2),Math.round(y*2));await pause(120);}
    async function useEntity(id){let cur=await state();let e=cur.entities.find(e=>e.id===id);assert(e,`entity ${id} missing`);await walkNear(e.x,e.y,20);await aim(e.x,e.y);await page.keyboard.press('e');await pause(220);return state();}
    async function takeAll(){await page.getByRole('button',{name:'Take all',exact:true}).click();await pause(350);await page.keyboard.press('Escape');await pause(120);}
    const itemNames={berries:'Berries',water_flask:'Water Flask',bandage:'Bandage'};
    async function useInventoryItem(key){
      if(!(await inputCount(key)))return false;
      await page.keyboard.press('i');await pause(120);const inv=page.locator('.panel').filter({hasText:'Inventory'}).last();
      await inv.locator(`.slot[title^="${itemNames[key]}"]`).first().click({button:'right'});await pause(180);await page.keyboard.press('Escape');await pause(100);return true;
    }
    async function ensureVitals(){const cur=await state();if(cur.player.dead)throw new Error(`player died during ordinary-input travel at (${cur.player.x.toFixed(0)},${cur.player.y.toFixed(0)}), hp=${cur.player.hp}, hunger=${cur.player.hunger.toFixed(1)}, thirst=${cur.player.thirst.toFixed(1)}, nearby=${JSON.stringify(cur.creatures.filter(m=>Math.hypot(m.x-cur.player.x,m.y-cur.player.y)<120))}`);if(cur.player.hp<92&&cur.counts.bandage)await useInventoryItem('bandage');if(cur.player.thirst<68&&cur.counts.water_flask)await useInventoryItem('water_flask');if(cur.player.hunger<68&&cur.counts.berries)await useInventoryItem('berries');}
    async function defendNearby(){
      if(defending)return;defending=true;
      try{for(let round=0;round<2;round++){
        let cur=await state();const threat=cur.creatures.filter(m=>['chase','tell','attack'].includes(m.state)&&Math.hypot(m.x-cur.player.x,m.y-cur.player.y)<96).sort((a,b)=>Math.hypot(a.x-cur.player.x,a.y-cur.player.y)-Math.hypot(b.x-cur.player.x,b.y-cur.player.y))[0];
        if(!threat)return;
        if(Math.hypot(threat.x-cur.player.x,threat.y-cur.player.y)>26){try{await walkNear(threat.x,threat.y,22);}catch{return;}}
        await aim(threat.x,threat.y);
        for(let hit=0;hit<7;hit++){
          cur=await state();const target=cur.creatures.find(m=>m.id===threat.id);if(!target||target.hp<=0||Math.hypot(target.x-cur.player.x,target.y-cur.player.y)>36)break;
          await page.mouse.down();await pause(80);await page.mouse.up();await pause(340);
        }
      }}finally{defending=false;}
    }

    const startCrate=s.entities.find(e=>e.kind==='loot'&&e.poi===(landing==="Fisher's Point"?'s1':'s3'));assert(startCrate,'selected start crate missing');
    await useEntity(startCrate.id);await page.getByRole('button',{name:'Take all',exact:true}).waitFor({timeout:5000});await takeAll();
    log.push(`${layoutId}: selected-start finite supply crate searched through normal input/UI`);
    await useInventoryItem('berries');await useInventoryItem('water_flask');initialApproachTiles=0;

    // Two end-to-end scenarios use existing production Lighthouse content and the authored development Relay.
    if(layoutId==='shipping'){
      await useEntity(keydoor.id);s=await state();keydoor=s.entities.find(e=>e.id===keydoor.id);assert.equal(keydoor.locked,'power');assert.equal(keydoor.open,false);
      log.push('shipping: unauthorized Lighthouse Door attempt rejected while its generator was dry');
      await useEntity(outer.id);await page.getByRole('button',{name:'Take all',exact:true}).waitFor({timeout:5000});
      await snap(`${suffix}-lighthouse-cache-dual-panels-1280x720.png`,1280,720);await snap(`${suffix}-lighthouse-cache-dual-panels-640x360.png`,640,360);await takeAll();
      assert.equal(await inputCount('fuel_can'),1);log.push('shipping: Lighthouse-side fuel can acquired from its real finite crate through UI');
      await useEntity(gen.id);s=await state();gen=s.entities.find(e=>e.id===gen.id);keydoor=s.entities.find(e=>e.id===keydoor.id);assert.equal(gen.power,1);assert.equal(keydoor.locked,undefined);assert.equal(await inputCount('fuel_can'),0);
      await useEntity(keydoor.id);s=await state();keydoor=s.entities.find(e=>e.id===keydoor.id);assert.equal(keydoor.open,true);
      for(const e of vaults){await useEntity(e.id);await page.getByRole('button',{name:'Take all',exact:true}).waitFor({timeout:5000});if(e.id===vault.id){await snap(`${suffix}-lighthouse-loot-dual-panels-1280x720.png`,1280,720);await snap(`${suffix}-lighthouse-loot-dual-panels-640x360.png`,640,360);}await takeAll();}
      assert.equal(await inputCount('core_storm'),1);assert((await inputCount('blueprint'))>=1);
      log.push('shipping: Lighthouse power gate opened lawfully; core_storm and blueprint loot transferred through container UI');
    }else{
      await useEntity(entry.id);s=await state();entry=s.entities.find(e=>e.id===entry.id);assert.equal(entry.open,true,'entry door did not open from normal E input');
      await useEntity(outer.id);await page.getByRole('button',{name:'Take all',exact:true}).waitFor({timeout:5000});
      await snap(`${suffix}-outer-cache-dual-panels-1280x720.png`,1280,720);await snap(`${suffix}-outer-cache-dual-panels-640x360.png`,640,360);await takeAll();
      assert.equal(await inputCount('keycard'),1);assert.equal(await inputCount('fuel_can'),1);
      log.push('dev_delta: ordinary walk/E + outer cache UI acquired keycard x1, fuel_can x1, bandage x1');
      await useEntity(keydoor.id);s=await state();keydoor=s.entities.find(e=>e.id===keydoor.id);assert.equal(keydoor.locked,'keycard');assert.equal(keydoor.open,false);
      log.push('dev_delta: unauthorized keycard attempt rejected without unlocking or consuming anything');
      await useEntity(keydoor.id);s=await state();keydoor=s.entities.find(e=>e.id===keydoor.id);assert.equal(keydoor.locked,undefined);assert.equal(keydoor.open,true);assert.equal(await inputCount('keycard'),0);
      await useEntity(powerdoor.id);s=await state();powerdoor=s.entities.find(e=>e.id===powerdoor.id);assert.equal(powerdoor.locked,'power');assert.equal(powerdoor.open,false);
      await useEntity(gen.id);s=await state();gen=s.entities.find(e=>e.id===gen.id);powerdoor=s.entities.find(e=>e.id===powerdoor.id);assert.equal(gen.power,1);assert.equal(powerdoor.locked,undefined);assert.equal(await inputCount('fuel_can'),0);
      await useEntity(powerdoor.id);s=await state();powerdoor=s.entities.find(e=>e.id===powerdoor.id);assert.equal(powerdoor.open,true);
      await useEntity(vault.id);await page.getByRole('button',{name:'Take all',exact:true}).waitFor({timeout:5000});
      await snap(`${suffix}-vault-loot-dual-panels-1280x720.png`,1280,720);await snap(`${suffix}-vault-loot-dual-panels-640x360.png`,640,360);await takeAll();
      assert.equal(await inputCount('iron_ingot'),4);assert.equal(await inputCount('medkit'),1);assert.equal(await inputCount('spares'),6);
      log.push('dev_delta: generator consumed one fuel can; vault loot transferred (iron_ingot 4, medkit 1, spares 6)');
    }

    log.push(`${layoutId}: test-side BFS selected an ${landing} approach of ${initialApproachTiles} map tiles; actual traversal remained ordinary WASD`);
    // Walk outside, then walk back to the same finite vault caches; no teleport/state injection.
    await walkNear(exitTarget.x,exitTarget.y,20);let outside=await state();assert(Math.hypot(outside.player.x-exitTarget.x,outside.player.y-exitTarget.y)<45,'player did not reach the outdoor exit route');
    await walkNear(vault.x,vault.y,22);let back=await state();assert(Math.hypot(back.player.x-vault.x,back.player.y-vault.y)<45,'player did not re-enter the vault wing');
    log.push(`${layoutId}: ordinary-input exit and re-entry completed; collected inventory retained`);

    // Save evidence, reload the page, Continue, and verify the persistent run state (same profile/page reload, not process-exit proof).
    await pause(1000);await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/Continue/i}).waitFor({timeout:15000});await page.getByRole('button',{name:/Continue/i}).click();await sleepUntil(()=>Boolean(window.__soh?.run),'Continue did not restore run');await pause(400);
    s=await state();assert.equal(s.id,runId);assert.equal(s.seed,seed);assert.equal(s.layoutId,layoutId);
    assert.equal(s.entities.find(e=>e.id===keydoor.id).open,true);
    assert.equal(s.entities.find(e=>e.id===gen.id).power,1);
    if(layoutId==='dev_delta'){assert.equal(s.entities.find(e=>e.id===powerdoor.id).open,true);assert.equal(s.counts.medkit,1);assert.equal(s.counts.iron_ingot,4);assert.equal(s.counts.spares,6);}
    else {assert.equal(s.counts.core_storm,1);assert((s.counts.blueprint||0)>=1);}
    for(const cache of vaults)assert(!s.containers[cache.c].some(Boolean),'vault loot respawned across reload');
    await snap(`${suffix}-reloaded-1280x720.png`,1280,720);await snap(`${suffix}-reloaded-640x360.png`,640,360);
    log.push(`${layoutId}: page-reload + Continue persisted same run/seed, lawful gate state, empty vault cache(s), and useful inventory`);
    assert.deepEqual(errors,[],`browser errors: ${errors.join(' | ')}`);
    await ctx.close();
  }

  await runLayout('shipping',"Fisher's Point",'Shipping Island','shipping');
  await runLayout('dev_delta','Eastcove','Delta Ridge','dev-delta');
  log.push('route_choice=PASS: production used Fisher’s Point → existing Lighthouse; development used Eastcove → authored Delta Relay across the two-pass ridge; all traversal used actual WASD input (test-side BFS selected waypoints, not blind-discovery proof)');
  await fs.writeFile(path.join(out,'run-log.txt'),log.join('\n')+'\n');
  console.log(log.join('\n'));
} catch (error) {
  log.push(`FAIL: ${error?.stack || error}`);
  console.error(log.join('\n'));
  const trace=String(error?.stack || error?.message || error).replace(/[\r\n]/g,' ').slice(0,3000);
  console.log(`::error title=Map-POI browser journey::${trace}`);
  await fs.writeFile(path.join(out,'run-log.txt'),log.join('\n')+'\n').catch(()=>{});
  throw error;
} finally {
  await browser.close().catch(()=>{}); await vite.close().catch(()=>{});
}
