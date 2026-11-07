// Short, deliberately injected fixture. Screenshots and checks are not a human playtest or a route proof.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='evidence/integrated-smoke';await fs.mkdir(out,{recursive:true});
const vite=await createServer({configFile:'vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
const {newGame,dispatch,addItem,mkContainer}=await vite.ssrLoadModule('/src/game/engine.ts');
const {serializeSnapshot}=await vite.ssrLoadModule('/src/game/persist.ts');
const now=Date.now(),gs=newGame();dispatch(gs,{id:'ui-start',type:'startRun',region:0,character:'female',seed:901},now);const r=gs.run,p=r.player;r.creatures=[];
for(const [key,qty] of [['cart_kit',1],['mechanical_parts',4],['iron_ingot',2],['spares',3],['seed',2],['herb',2],['fiber',10],['wood',10]])addItem(r,'inv',key,qty);
r.knowledge.recipes.push('industrial_pick','industrial_axe','antirad');
const cartSlot=r.custody.inv.slots.findIndex(s=>s?.key==='cart_kit');p.active=cartSlot;
assert.equal(dispatch(gs,{id:'ui-cart',type:'placeCart',x:p.x-22,y:p.y},now+1).ok,true);p.active=0;
const fuel=mkContainer(r,'fuel',3),outc=mkContainer(r,'out',6),tx=Math.floor(p.x/16),ty=Math.floor(p.y/16);
r.entities['fixture-bench']={id:'fixture-bench',kind:'struct',type:'workbench',tx:tx+1,ty,x:p.x+23,y:p.y,hp:160,maxHp:160,station:{fuelC:fuel.id,outC:outc.id,burn:0,queue:[],level:2}};
r.entities['fixture-garden']={id:'fixture-garden',kind:'struct',type:'garden',tx,ty:ty+1,x:p.x,y:p.y+23,hp:60,maxHp:60,garden:{crop:null,growth:0,water:0}};
const snap=serializeSnapshot(gs),browser=await chromium.launch({headless:true,args:['--no-sandbox']}),ctx=await browser.newContext({viewport:{width:640,height:360}});
await ctx.addInitScript(value=>localStorage.setItem('soh.state.v3',value),snap);const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const shot=async name=>{await page.waitForTimeout(250);await page.screenshot({path:`${out}/${name}.png`});};
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Continue/i}).click();await page.waitForFunction(()=>window.__soh?.run);await page.waitForTimeout(500);const cont=page.getByRole('button',{name:'Continue',exact:true});if(await cont.isVisible().catch(()=>false))await cont.click();
 await page.keyboard.press('c');await page.getByRole('button',{name:'Workbench',exact:true}).click();await shot('craft-list-640');assert.equal(await page.getByText('Inventory',{exact:true}).count(),1);
 const find=page.getByLabel('Find known recipe');await find.fill('salvager');assert(await page.getByRole('button',{name:/Salvager Pick/}).isVisible());await page.getByRole('button',{name:/Salvager Pick/}).click();assert(await page.getByText('Ingredients per batch').isVisible());assert(await page.getByText('Mechanical Parts:',{exact:false}).isVisible());await shot('craft-detail-640');
 await page.getByText('Ingredients & known sub-recipes').click();assert(await page.getByText('Known ways to craft',{exact:false}).count()>0);await shot('craft-dependencies-640');
 await page.getByRole('button',{name:'Inventory',exact:true}).click();assert(await page.locator('.panel-h').getByText('Inventory',{exact:true}).isVisible());assert.equal(await page.getByText('Ingredients per batch').count(),0);await shot('craft-inventory-640');
 await page.locator('.panel').filter({has:page.locator('.panel-h').getByText('Inventory',{exact:true})}).getByRole('button',{name:'✕'}).click();assert(await page.getByText('Ingredients per batch').isVisible());
 await page.setViewportSize({width:1280,height:720});await shot('craft-detail-1280');await page.getByRole('button',{name:'Close details'}).click();await shot('craft-list-1280');
 await page.setViewportSize({width:640,height:360});await page.keyboard.press('Escape');await page.mouse.move(320,220);await page.waitForTimeout(300);await page.keyboard.press('e');const garden=page.locator('.panel').filter({hasText:'Empty plot'}).first();await garden.waitFor({timeout:5000});await shot('garden-choice-640');await garden.getByRole('button',{name:'Plant Bitterleaf'}).click();assert.equal(await page.evaluate(()=>window.__soh.run.entities['fixture-garden'].garden.crop),'herb');await shot('garden-growing-640');
 await page.keyboard.press('Escape');await page.mouse.move(280,180);await page.waitForTimeout(300);await page.keyboard.press('e');const freight=page.locator('.panel').filter({hasText:'Cart Cargo'}).first();await freight.waitFor({timeout:5000});await freight.getByText('Reinforce at level 2 workbench').click();await shot('freight-offer-640');await freight.getByRole('button',{name:'Pay & reinforce'}).click();assert(await freight.getByText('Reinforced freight cart').isVisible());assert.equal(await page.evaluate(()=>Object.values(window.__soh.run.entities).find(e=>e.kind==='cart').deployed.upgrade),'freight');await shot('freight-upgraded-640');
 assert.deepEqual(errors,[]);console.log('PASS injected fixture: focused craft categories/details/inventory, garden choice, paid freight upgrade; screenshots.');
}finally{await browser.close();await vite.close();}
