import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: 'shell', args: chromium.args, defaultViewport: { width: 640, height: 360 }, timeout: 120000 });
const page = await browser.newPage();
const errs=[];page.on('pageerror',e=>errs.push('pageerror:'+String(e)));
const clickText=async(t)=>{await page.evaluate((t)=>{const b=[...document.querySelectorAll('button,[role=button],div')].find(x=>x.innerText&&x.innerText.trim().startsWith(t)&&x.children.length<=3);b&&b.click();},t);await sleep(1200);};
await page.goto('http://127.0.0.1:8791/index.html',{waitUntil:'load',timeout:120000});await sleep(4000);
await clickText('New run');await clickText('Adventurer ♀');await clickText('Shipping Island');await clickText('Begin the 14 days');await sleep(2500);
const hud=async()=>(await page.evaluate(()=>document.body.innerText)).replace(/\n/g,' | ').slice(0,260);
console.log('START',await hud());
// real keyboard: walk toward the tree (east/north) for a short time
await page.keyboard.down('KeyW');await sleep(500);await page.keyboard.up('KeyW');
await page.keyboard.down('KeyD');await sleep(600);await page.keyboard.up('KeyD');
await sleep(300);
// real mouse: aim at the nearest tree and swing (LMB) several times
for(let i=0;i<8;i++){await page.mouse.move(340,150);await page.mouse.down();await sleep(160);await page.mouse.up();await sleep(550);}
await sleep(800);
await page.screenshot({path:'/home/user/tools-r5/r6-after-swing.png'});
console.log('AFTER_SWING',await hud());
// open inventory panel with the real I key
await page.keyboard.press('KeyI');await sleep(1000);
await page.screenshot({path:'/home/user/tools-r5/r6-inventory.png'});
console.log('INV',(await page.evaluate(()=>document.body.innerText)).replace(/\n/g,' | ').slice(0,500));
console.log('ERRS',JSON.stringify(errs.slice(0,5)));
await browser.close();
