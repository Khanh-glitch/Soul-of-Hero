import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.QA_CHROME, args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox'], dumpio: true });
const p = await b.newPage();
const r = await p.evaluate(() => { const c=document.createElement('canvas'); const gl=c.getContext('webgl2'); if(!gl) return null; const ext=gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER); });
console.log('webgl2 renderer:', r);
await b.close();
