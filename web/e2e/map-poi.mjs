import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const out = path.resolve('evidence/map-poi');
await fs.mkdir(out, { recursive: true });
const vite = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true }, appType: 'custom' });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}) });
const routeDiagnostics = [];
let routeGridSerial=0;
const log = [`build_sha=${process.env.BUILD_SHA || 'local-uncommitted'}`, `workflow_run=${process.env.GITHUB_RUN_ID || 'local'}`, `run_attempt=${process.env.GITHUB_RUN_ATTEMPT || '1'}`, `browser=Chromium ${browser.version()}`, 'persistence_scope=same-browser-profile page reload + Continue; not OS-process-exit proof'];
let page;
const pause = ms => page.waitForTimeout(ms);
const snap = async (name, width, height) => { await page.setViewportSize({ width, height }); await pause(200); await page.screenshot({ path: path.join(out, name), animations: 'disabled' }); await page.setViewportSize({ width: 1280, height: 720 }); await pause(150); };
const state = () => page.evaluate(() => {
  const r = window.__soh?.run; if (!r) return null;
  const counts = {};
  for (const s of r.custody.inv.slots) if (s) counts[s.key] = (counts[s.key] || 0) + s.qty;
  return { id: r.id, seed: r.seed, layoutId: r.layoutId || 'shipping', player: { x:r.player.x,y:r.player.y,hp:r.player.hp,dead:r.player.dead,hunger:r.player.hunger,thirst:r.player.thirst,action:r.player.action&&{...r.player.action},vx:r.player.vx,vy:r.player.vy,invuln:r.player.invuln,stamina:r.player.stamina }, counts,
    creatures:r.creatures.filter(m=>m.hp>0).map(m=>({id:m.id,x:m.x,y:m.y,hp:m.hp,state:m.state,type:m.type})),
    entities: Object.values(r.entities).map(e => ({ id:e.id,kind:e.kind,poi:e.poi,x:e.x,y:e.y,tx:e.tx,ty:e.ty,locked:e.locked,open:e.open,power:e.power,label:e.label,c:e.c })),
    sources:r.sources,containers: Object.fromEntries(Object.entries(r.custody).map(([id,c])=>[id,c.slots.map(s=>s&&({key:s.key,qty:s.qty}))])) };
});
const sleepUntil = async (fn, message, timeout = 8000) => page.waitForFunction(fn, null, { timeout }).catch(() => { throw new Error(message); });
const inputCount = async key => (await state())?.counts[key] || 0;

try {
  const [{ getWorld, setActiveLayout, SRC_KEYS }, { WW, WH, T }, { MAP_CONTENT_PACKS, validateContentPack }, { SOURCES, CREATURES }] = await Promise.all([
    vite.ssrLoadModule('/src/game/world.ts'), vite.ssrLoadModule('/src/game/core.ts'), vite.ssrLoadModule('/src/game/content.ts'), vite.ssrLoadModule('/src/game/catalog.ts'), vite.ssrLoadModule('/src/game/engine.ts'),
  ]);
  const invalid = structuredClone(MAP_CONTENT_PACKS.dev_delta); invalid.pois[0].width = 0; invalid.pois[0].loot.outer[0].item = 'not_a_real_item';
  const rejected = validateContentPack(invalid); assert(rejected.some(e => e.includes('footprint')) && rejected.some(e => e.includes('unknown loot item')));
  log.push(`negative_validation=PASS (${rejected.join(' | ')})`);
  const [{ blockGrid }] = await Promise.all([vite.ssrLoadModule('/src/game/engine.ts')]);
  const blocks = new Set([T.DEEP, T.CLIFF, T.PWALL, T.LAVA]);

  async function runLayout(layoutId, landing, layoutLabel, suffix) {
    setActiveLayout(layoutId); const world = getWorld(layoutId); const W = WW, H = WH;
    const ctx = await browser.newContext({ viewport: { width:1280, height:720 }, deviceScaleFactor:1 }); page = await ctx.newPage();
    page.setDefaultTimeout(10000);
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
    let keydoor,entry=null,powerdoor=null,gen=null,outer,vaults=[],exitTarget,expectedSpareTotal=0;
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
    let initialApproachTiles = 0; let lastDodgeAt=0;
    const actualGrid = async () => {
      const raw = await page.evaluate(() => structuredClone(window.__soh.run));
      // The SSR engine has its own blockGrid cache. Distinct snapshot ids force a fresh rebuild from live doors, entities and sources.
      raw.id=`${raw.id}:e2e-grid-${++routeGridSerial}`;
      return { raw, grid: blockGrid(raw) };
    };
    const gridClass = b => b===0?'free':b===1?'terrain-wall':b===2?'blocking-source':b===3?'physical-entity':b===4?'wadeable':b===5?'lava':`unknown-${b}`;
    // One navigation owner: a threat response only performs bounded physical inputs,
    // then returns control here. It never invokes navigation itself.
    async function walkNear(wx, wy, radius=22) {
      const budgetMs = 180_000, maxReplans = 45, maxAttempts = 2400;
      const startedAt = Date.now(), deadline = startedAt + budgetMs;
      const cur0 = await state();
      const targetEntity = cur0.entities.find(e => Math.hypot(e.x-wx,e.y-wy)<1);
      const diag = {layout:layoutId, target:{x:wx,y:wy,radius,entity:targetEntity?.label || targetEntity?.id}, startedAt, replans:0, attempts:0, waypoints:[], threats:[]};
      routeDiagnostics.push(diag);
      let cur=cur0, grid, plan=[], blocked=new Set(), nextHeartbeat=0, nextScreenshot=0, reason='initial', waypoint=null;
      const elapsed = () => Date.now()-startedAt;
      const heartbeat = async (event, force=false) => {
        if (!force && Date.now()<nextHeartbeat) return;
        nextHeartbeat=Date.now()+5000;
        const near=cur.creatures.filter(m=>Math.hypot(m.x-cur.player.x,m.y-cur.player.y)<160);
        const info={event,layout:layoutId,target:diag.target,elapsedMs:elapsed(),replans:diag.replans,attempts:diag.attempts,player:cur.player,lastWaypoint:diag.lastWaypoint,waypoint,nearbyThreats:near};
        console.log('ROUTE_HEARTBEAT '+JSON.stringify(info));
        await fs.writeFile(path.join(out,`heartbeat-${layoutId}.json`),JSON.stringify(info,null,2));
        if(Date.now()>=nextScreenshot) { nextScreenshot=Date.now()+30000; await page.screenshot({path:path.join(out,`heartbeat-${layoutId}.png`),animations:'disabled'}).catch(()=>{}); }
        await fs.writeFile(path.join(out,'route-diagnostics.json'),JSON.stringify(routeDiagnostics,null,2));
      };
      const checkBudget = () => {
        if (Date.now()>=deadline) throw new Error(`route time budget ${budgetMs}ms exhausted`);
        if (diag.replans>=maxReplans && !plan.length) throw new Error(`route replan budget ${maxReplans} exhausted`);
        if (diag.attempts>=maxAttempts) throw new Error(`route movement budget ${maxAttempts} exhausted`);
        if (cur.player.dead) throw new Error('player died during route');
      };
      const findPath = (avoidThreats) => {
        const sx=Math.max(1,Math.min(W-2,Math.floor(cur.player.x/16))), sy=Math.max(1,Math.min(H-2,Math.floor(cur.player.y/16)));
        const start=sy*W+sx, q=new Int32Array(W*H), from=new Int32Array(W*H).fill(-2), danger=new Set();
        if (avoidThreats) for(const m of cur.creatures) {
          if(m.type.startsWith('elder_')||!['chase','track','tell','attack','recover'].includes(m.state)) continue;
          const mx=Math.floor(m.x/16),my=Math.floor(m.y/16),r=8;
          for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++) if(Math.hypot(dx,dy)<=r && mx+dx>=0 && mx+dx<W && my+dy>=0 && my+dy<H) danger.add((my+dy)*W+mx+dx);
        }
        let h=0,t=0,goal=-1; q[t++]=start;from[start]=-1;
        while(h<t) {
          const i=q[h++],x=i%W,y=(i/W)|0;
          if(Math.hypot(x*16+8-wx,y*16+8-wy)<=radius){goal=i;break;}
          for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=W-1||ny>=H-1)continue;
            const j=ny*W+nx;if(from[j]!==-2||blocked.has(j)||danger.has(j)||[1,2,3,5].includes(grid[j]))continue;
            from[j]=i;q[t++]=j;
          }
        }
        if(goal<0)return null;
        const result=[];for(let i=goal;i!==start;i=from[i])result.push(i);return result.reverse();
      };
      try {
        await heartbeat('start',true);
        while(true) {
          checkBudget();cur=await state();checkBudget();
          if(Math.hypot(cur.player.x-wx,cur.player.y-wy)<=radius){diag.completed={elapsedMs:elapsed(),player:cur.player};await heartbeat('complete',true);return cur;}
          if(!plan.length) {
            const snapshot=await actualGrid();grid=snapshot.grid;diag.replans++;
            plan=findPath(true) || findPath(false);
            if(!plan || !plan.length) throw new Error('runtime collision grid has no reachable interaction tile');
            if(!initialApproachTiles)initialApproachTiles=plan.length;
            diag.lastPlan={reason,pathTiles:plan.length,player:{x:cur.player.x,y:cur.player.y}};
            await heartbeat('replan',true);
          }
          const next=plan[0], nx=next%W,ny=(next/W)|0, wp={x:nx*16+8,y:ny*16+8};
          waypoint={tile:[nx,ny],center:wp,grid:gridClass(grid[next])};
          const wpDiag={...waypoint,start:{x:cur.player.x,y:cur.player.y},attempts:[]};
          let reached=false,stagnant=0,best=Infinity,evaded=false;
          for(let tries=0;tries<18;tries++) {
            checkBudget();cur=await state();checkBudget();await heartbeat('moving');
            const dx=wp.x-cur.player.x,dy=wp.y-cur.player.y,remaining=Math.hypot(dx,dy);
            if(remaining<3){reached=true;break;}
            const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');
            const before={x:cur.player.x,y:cur.player.y,hp:cur.player.hp};
            try {for(const k of keys)await page.keyboard.down(k);await pause(remaining<=12?24:115);}
            finally {for(const k of keys)await page.keyboard.up(k);}
            cur=await state();checkBudget();
            const moved=Math.hypot(cur.player.x-before.x,cur.player.y-before.y),left=Math.hypot(wp.x-cur.player.x,wp.y-cur.player.y);
            diag.attempts++;wpDiag.attempts.push({from:before,to:{x:cur.player.x,y:cur.player.y,hp:cur.player.hp},moved,left});
            await ensureVitals();
            if(await defendNearby()) {cur=await state();evaded=true;break;}
            // A hit/knockback or unusual displacement invalidates the remaining segment.
            if(moved>32 || Math.hypot(cur.player.x-before.x,cur.player.y-before.y)>32){evaded=true;reason='knockback';break;}
            if(left<3){reached=true;break;}
            if(moved<0.8)stagnant++;else stagnant=0;
            if(left<best-1){best=left;stagnant=0;}
            if(stagnant>=6)break;
          }
          wpDiag.end={x:cur.player.x,y:cur.player.y,hp:cur.player.hp,reached,evaded};diag.waypoints.push(wpDiag);
          if(evaded){plan=[];reason=reason==='knockback'?reason:'threat response';await heartbeat('threat-replan',true);continue;}
          if(!reached){blocked.add(next);plan=[];reason=`obstruction at ${nx},${ny}`;await heartbeat('obstruction',true);continue;}
          diag.lastWaypoint={tile:[nx,ny],x:cur.player.x,y:cur.player.y};plan.shift();
        }
      } catch(error) {
        cur=await state().catch(()=>cur);
        const sx=Math.floor(cur.player.x/16),sy=Math.floor(cur.player.y/16);
        diag.failed={reason:String(error),elapsedMs:elapsed(),player:cur.player,waypoint,blocked:[...blocked].map(i=>[i%W,(i/W)|0]),nearbyGrid:grid&&Array.from({length:5},(_,j)=>Array.from({length:5},(_,i)=>({tile:[sx+i-2,sy+j-2],class:gridClass(grid[(sy+j-2)*W+sx+i-2])}))),nearbyEntities:cur.entities.filter(e=>Math.hypot(e.x-cur.player.x,e.y-cur.player.y)<100),nearbyThreats:cur.creatures.filter(m=>Math.hypot(m.x-cur.player.x,m.y-cur.player.y)<260)};
        await heartbeat('failure',true).catch(()=>{});
        await page.screenshot({path:path.join(out,`route-failure-${layoutId}.png`),animations:'disabled'}).catch(()=>{});
        await fs.writeFile(path.join(out,`route-failure-${layoutId}.json`),JSON.stringify(diag,null,2)).catch(()=>{});
        throw new Error(`${error.message}; route failure ${JSON.stringify(diag.failed)}`,{cause:error});
      }
    }
    const camera=p=>({x:Math.max(0,Math.min(W*16-640,p.x-320)),y:Math.max(0,Math.min(H*16-360,p.y-180))});
    async function aim(wx,wy){await pause(100);const cur=await state(),c=camera(cur.player);const x=Math.max(2,Math.min(638,wx-c.x)),y=Math.max(2,Math.min(358,wy-c.y));await page.mouse.move(Math.round(x*2),Math.round(y*2));await pause(120);}
    async function useEntity(id){let cur=await state();let e=cur.entities.find(e=>e.id===id);assert(e,`entity ${id} missing`);await walkNear(e.x,e.y,20);cur=await state();const d=Math.hypot(cur.player.x-e.x,cur.player.y-e.y);assert(d<=32,`ordinary-input route did not reach engine interaction radius (32px): ${e.label||e.id}, distance=${d.toFixed(1)}`);if(e.label==='Lighthouse Door')log.push(`shipping Lighthouse reachability: runtime blockGrid BFS + actual WASD reached door interaction radius at ${d.toFixed(1)}px (engine limit 32px)`);await aim(e.x,e.y);await page.keyboard.press('e');await pause(220);return state();}
    async function takeAll(){await page.getByRole('button',{name:'Take all',exact:true}).click();await pause(350);await page.keyboard.press('Escape');await pause(120);}
    const itemNames={berries:'Berries',water_flask:'Water Flask',bandage:'Bandage'};
    async function useInventoryItem(key){
      if(!(await inputCount(key)))return false;
      await page.keyboard.press('i');await pause(120);const inv=page.locator('.panel').filter({hasText:'Inventory'}).last();
      await inv.locator(`.slot[title^="${itemNames[key]}"]`).first().click({button:'right'});await pause(180);await page.keyboard.press('Escape');await pause(100);return true;
    }
    async function ensureVitals(){const cur=await state();if(cur.player.dead)throw new Error(`player died during ordinary-input travel at (${cur.player.x.toFixed(0)},${cur.player.y.toFixed(0)}), hp=${cur.player.hp}, hunger=${cur.player.hunger.toFixed(1)}, thirst=${cur.player.thirst.toFixed(1)}, nearby=${JSON.stringify(cur.creatures.filter(m=>Math.hypot(m.x-cur.player.x,m.y-cur.player.y)<120))}`);if(cur.player.hp<92&&cur.counts.bandage)await useInventoryItem('bandage');if(cur.player.thirst<68&&cur.counts.water_flask)await useInventoryItem('water_flask');if(cur.player.hunger<68&&cur.counts.berries)await useInventoryItem('berries');}
    async function defendNearby(){
      {
        const cur=await state();const threat=cur.creatures.filter(m=>!m.type.startsWith('elder_')&&['chase','track','tell','attack','recover'].includes(m.state)&&(()=>{const d=Math.hypot(m.x-cur.player.x,m.y-cur.player.y);return d<55||(['attack','tell'].includes(m.state)&&d<100);})()).sort((a,b)=>Math.hypot(a.x-cur.player.x,a.y-cur.player.y)-Math.hypot(b.x-cur.player.x,b.y-cur.player.y))[0];
        if(!threat)return false;const td=Math.hypot(threat.x-cur.player.x,threat.y-cur.player.y),imminent=td<55||(['attack','tell'].includes(threat.state)&&td<100);
        // During recovery, fight a close pursuer with the ordinary starter knife instead
        // of endlessly dodging away from the same target. The attack itself is bounded.
        if(threat.state==='recover' && td<48 && cur.containers.inv[0]?.key==='knife') {
          await page.keyboard.press('1');
          await aim(threat.x,threat.y);
          if(td>24) {
            const a=Math.atan2(threat.y-cur.player.y,threat.x-cur.player.x), keys=[];
            if(Math.abs(Math.cos(a))>0.25)keys.push(Math.cos(a)>0?'d':'a');
            if(Math.abs(Math.sin(a))>0.25)keys.push(Math.sin(a)>0?'s':'w');
            try {for(const k of keys)await page.keyboard.down(k);await pause(120);} finally {for(const k of keys)await page.keyboard.up(k);}
          }
          const before=await state(), liveThreat=before.creatures.find(m=>m.id===threat.id);
          if(liveThreat && Math.hypot(liveThreat.x-before.player.x,liveThreat.y-before.player.y)<35) {
            await aim(liveThreat.x,liveThreat.y);
            try {await page.mouse.down();await pause(600);} finally {await page.mouse.up();}
            const after=await state();
            routeDiagnostics.push({kind:'wildlife-defense',threat:threat.id,before:before.player,after:after.player,remainingHp:after.creatures.find(m=>m.id===threat.id)?.hp ?? 0,method:'ordinary knife input'});
            return true;
          }
        }
        await ensureVitals();const live=await state(),angle=Math.atan2(live.player.y-threat.y,live.player.x-threat.x),keys=[];
        if(Math.abs(Math.cos(angle))>0.25)keys.push(Math.cos(angle)>0?'d':'a');if(Math.abs(Math.sin(angle))>0.25)keys.push(Math.sin(angle)>0?'s':'w');
        const emergency=['attack','tell'].includes(threat.state)&&td<100;const canRoll=imminent&&live.player.stamina>=22&&(emergency||Date.now()-lastDodgeAt>=900);if(canRoll)lastDodgeAt=Date.now();for(const k of keys)await page.keyboard.down(k);if(canRoll)await page.keyboard.press('Space');await pause(canRoll?280:220);for(const k of keys)await page.keyboard.up(k);
        let after=await state(),method=canRoll?'ordinary directional WASD + Space dodge-roll':'ordinary WASD retreat';
        if(Math.hypot(after.player.x-live.player.x,after.player.y-live.player.y)<8){
          for(const offset of [-0.8,0.8,-1.5,1.5]){const a=angle+offset,keys=[];if(Math.abs(Math.cos(a))>0.25)keys.push(Math.cos(a)>0?'d':'a');if(Math.abs(Math.sin(a))>0.25)keys.push(Math.sin(a)>0?'s':'w');for(const k of keys)await page.keyboard.down(k);await pause(220);for(const k of keys)await page.keyboard.up(k);const candidate=await state();if(candidate.player.dead)throw new Error(`player died while taking an ordinary alternate retreat from ${threat.type} ${threat.id}; state=${JSON.stringify(candidate.player)}`);if(Math.hypot(candidate.player.x-after.player.x,candidate.player.y-after.player.y)>=8){after=candidate;method+='; alternate ordinary WASD escape around physical obstruction';break;}after=candidate;}
        }
        routeDiagnostics.push({kind:'wildlife-evasion',threat:{id:threat.id,type:threat.type,state:threat.state,from:{x:threat.x,y:threat.y}},before:{x:live.player.x,y:live.player.y,hp:live.player.hp},after:{x:after.player.x,y:after.player.y,hp:after.player.hp},method:method+'; next route replanned from live position'});return true;
      }
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
      await useEntity(keydoor.id);s=await state();keydoor=s.entities.find(e=>e.id===keydoor.id);assert.equal(keydoor.locked,'keycard');assert.equal(keydoor.open,false);assert.equal(await inputCount('keycard'),0);
      log.push('dev_delta: unauthorized keycard gate attempt rejected before keycard acquisition');
      await useEntity(outer.id);await page.getByRole('button',{name:'Take all',exact:true}).waitFor({timeout:5000});
      await snap(`${suffix}-outer-cache-dual-panels-1280x720.png`,1280,720);await snap(`${suffix}-outer-cache-dual-panels-640x360.png`,640,360);await takeAll();
      assert.equal(await inputCount('keycard'),1);assert.equal(await inputCount('fuel_can'),1);
      log.push('dev_delta: ordinary walk/E + outer cache UI acquired keycard x1, fuel_can x1, bandage x1');
      await useEntity(keydoor.id);s=await state();keydoor=s.entities.find(e=>e.id===keydoor.id);assert.equal(keydoor.locked,undefined);assert.equal(keydoor.open,true);assert.equal(await inputCount('keycard'),0);
      await useEntity(powerdoor.id);s=await state();powerdoor=s.entities.find(e=>e.id===powerdoor.id);assert.equal(powerdoor.locked,'power');assert.equal(powerdoor.open,false);
      await useEntity(gen.id);s=await state();gen=s.entities.find(e=>e.id===gen.id);powerdoor=s.entities.find(e=>e.id===powerdoor.id);assert.equal(gen.power,1);assert.equal(powerdoor.locked,undefined);assert.equal(await inputCount('fuel_can'),0);
      await useEntity(powerdoor.id);s=await state();powerdoor=s.entities.find(e=>e.id===powerdoor.id);assert.equal(powerdoor.open,true);
      expectedSpareTotal=await inputCount('spares')+6;
      await useEntity(vault.id);await page.getByRole('button',{name:'Take all',exact:true}).waitFor({timeout:5000});
      await snap(`${suffix}-vault-loot-dual-panels-1280x720.png`,1280,720);await snap(`${suffix}-vault-loot-dual-panels-640x360.png`,640,360);await takeAll();
      assert.equal(await inputCount('iron_ingot'),4);assert.equal(await inputCount('medkit'),1);assert.equal(await inputCount('spares'),expectedSpareTotal);
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
    if(layoutId==='dev_delta'){assert.equal(s.entities.find(e=>e.id===powerdoor.id).open,true);assert.equal(s.counts.medkit,1);assert.equal(s.counts.iron_ingot,4);assert.equal(s.counts.spares,expectedSpareTotal);}
    else {assert.equal(s.counts.core_storm,1);assert((s.counts.blueprint||0)>=1);}
    for(const cache of vaults)assert(!s.containers[cache.c].some(Boolean),'vault loot respawned across reload');
    await snap(`${suffix}-reloaded-1280x720.png`,1280,720);await snap(`${suffix}-reloaded-640x360.png`,640,360);
    log.push(`${layoutId}: page-reload + Continue persisted same run/seed, lawful gate state, empty vault cache(s), and useful inventory`);
    assert.deepEqual(errors,[],`browser errors: ${errors.join(' | ')}`);
    await ctx.close();
  }

  const selected = process.env.MAP_LAYOUT || 'both';
  assert(['shipping','dev_delta','both'].includes(selected), `invalid MAP_LAYOUT: ${selected}`);
  if(selected==='shipping'||selected==='both') await runLayout('shipping',"Fisher's Point",'Shipping Island','shipping');
  if(selected==='dev_delta'||selected==='both') await runLayout('dev_delta','Eastcove','Delta Ridge','dev-delta');
  log.push(`route_choice=PASS: ${selected}; traversal used actual WASD input (test-side BFS selected waypoints, not blind-discovery proof)`);
  await fs.writeFile(path.join(out,'run-log.txt'),log.join('\n')+'\n');
  await fs.writeFile(path.join(out,'route-diagnostics.json'),JSON.stringify(routeDiagnostics,null,2));
  console.log(log.join('\n'));
} catch (error) {
  log.push(`FAIL: ${error?.stack || error}`);
  console.error(log.join('\n'));
  const trace=String(error?.stack || error?.message || error).replace(/[\r\n]/g,' ').slice(0,3000);
  console.log(`::error title=Map-POI browser journey::${trace}`);
  await fs.writeFile(path.join(out,'run-log.txt'),log.join('\n')+'\n').catch(()=>{});
  await page?.screenshot({path:path.join(out,'route-failure-final.png'),animations:'disabled'}).catch(()=>{});
  await fs.writeFile(path.join(out,'route-diagnostics.json'),JSON.stringify(routeDiagnostics,null,2)).catch(()=>{});
  throw error;
} finally {
  await browser.close().catch(()=>{}); await vite.close().catch(()=>{});
}
