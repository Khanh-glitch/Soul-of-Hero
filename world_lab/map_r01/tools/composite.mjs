import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const conds=['forest-day','forest-night','coast-night','coast-day'];
const html=`<!doctype html><body style="margin:0;background:#101018;color:#e8e0c0;font:12px monospace">
<div style="display:flex;padding:6px 0 2px 6px;gap:0"><div style="width:640px">A — untouched PR38 8421b9c3</div><div style="width:640px">B — rejected MapLab 438b813c</div><div style="width:640px">C — MAP-R01 asset-backed</div></div>
${conds.map(c=>`<div style="font-size:11px;padding:4px 6px;color:#ffd870">${c}</div><div style="display:flex">${['A','B','C'].map(t=>`<img src="file:///home/user/r01_scratch/shots/${t}/${c}.png" width="640" height="360" style="display:block">`).join('')}</div>`).join('')}
</body>`;
await fs.writeFile('/home/user/r01_scratch/composite.html',html);
const b=await chromium.launch({headless:true,executablePath:'/tmp/chromium',env:{...process.env,LD_LIBRARY_PATH:'/tmp/al2023/lib'},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--allow-file-access-from-files']});
const p=await b.newPage({viewport:{width:1920,height:1560}});
await p.goto('file:///home/user/r01_scratch/composite.html');await p.waitForTimeout(500);
await p.screenshot({path:'/home/user/r01_scratch/ABC-all.png',fullPage:true});
for(let i=0;i<conds.length;i++)await p.screenshot({path:'/home/user/r01_scratch/ABC-'+conds[i]+'.png',clip:{x:0,y:24+i*384,width:1920,height:384}});
await b.close();console.log('composites written');
