// Partial UI-only smoke, not the full natural journey. Fresh profile; no fixtures or grants.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']});
try {
 const context=await browser.newContext({viewport:{width:640,height:360}}), page=await context.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:4189/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'New run'}).click();
 await page.getByTestId('layout-shipping-fresh').click();
 await page.getByRole('button',{name:'Begin the 14 days'}).click();
 await page.waitForTimeout(1500);
 await page.keyboard.down('d'); await page.waitForTimeout(1000); await page.keyboard.up('d');
 await page.keyboard.press('Escape'); await page.waitForTimeout(250);
 const menu=await page.locator('body').innerText(); assert.match(menu,/estimated survival/i); assert.match(menu,/thirst empty/i);
 await page.screenshot({path:'evidence/territory/current-menu-640x360.png'});
 await page.getByRole('button',{name:'Save & quit to title'}).click(); await page.waitForTimeout(1200);
 console.log('TITLE:',(await page.locator('body').innerText()).slice(0,600));
 const continueButton=page.getByRole('button',{name:/continue/i}); await continueButton.first().click(); await page.waitForTimeout(1500);
 assert.equal(await page.locator('canvas').count(),1); assert.deepEqual(errors,[]);
 console.log('PASS: fresh New Run, movement, forecast menu, save and reopen via normal UI (partial journey only)');
 await context.close();
} finally { await browser.close(); }
