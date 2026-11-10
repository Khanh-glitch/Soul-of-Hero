// Build a 4x nearest-neighbour contact sheet of the actor window from the captured frames (no PIL needed).
import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright';
const files = [...fs.readdirSync('evidence/wave3').filter(f => /^640-08-bike-seq-\d\.png$/.test(f)).sort().map(f => 'evidence/wave3/' + f), 'evidence/wave3/640-07-bike-parked-on-foot.png', 'evidence/wave3/640-09-bike-dismounted.png'];
const srcs = files.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
const html = `<canvas id=c width=${96*4*4} height=${64*4*2}></canvas><script>
const srcs=${JSON.stringify(srcs)}; const c=document.getElementById('c'), g=c.getContext('2d'); g.imageSmoothingEnabled=false; g.fillStyle='#05070a'; g.fillRect(0,0,c.width,c.height);
let n=0; srcs.forEach((s,i)=>{ const im=new Image(); im.onload=()=>{ g.drawImage(im, 320-48, 186-36, 96, 64, (i%4)*384, Math.floor(i/4)*256, 384, 256); if(++n===srcs.length) document.title='done'; }; im.src=s; });
</script>`;
const b = await chromium.launch({ args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 96*4*4, height: 64*4*2 } });
await p.setContent(html); await p.waitForFunction(() => document.title === 'done');
fs.mkdirSync('evidence/wave3/crops', { recursive: true });
await p.locator('#c').screenshot({ path: 'evidence/wave3/crops/bike-sequence-4x.png' }); await b.close(); console.log('sheet ok', files.length);
