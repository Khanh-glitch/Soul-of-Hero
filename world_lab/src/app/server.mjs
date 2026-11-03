// Browser-accessible World Lab review/authoring server. Same-origin data + shared ES modules.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
const ROOT=process.cwd(),PORT=Number(process.env.PORT||3000);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.md':'text/markdown; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const send=(res,code,body,type='text/plain; charset=utf-8')=>{res.writeHead(code,{'Content-Type':type,'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'});res.end(body);};
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject);});}
const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});res.end();return;}
  const u=new URL(req.url,'http://localhost'),p=u.pathname;
  try{
    if(req.method==='POST'&&p==='/api/edits'){
      const e=await body(req);if(!e||typeof e!=='object'||!Array.isArray(e.edits))throw new Error('invalid edits payload');
      e.version=1;e.lockedRegions=Array.isArray(e.lockedRegions)?e.lockedRegions:[];e.lockedEdits=Array.isArray(e.lockedEdits)?e.lockedEdits:[];
      fs.writeFileSync(path.join(ROOT,'data/creator_edits.json'),JSON.stringify(e,null,2));return send(res,200,JSON.stringify({saved:true,path:'data/creator_edits.json',edits:e.edits.length,lockedRegions:e.lockedRegions.length}),'application/json');
    }
    if(req.method==='POST'&&p==='/api/rebuild'){
      const out=await new Promise((resolve,reject)=>execFile(process.execPath,['src/compiler/build.mjs','--edits=data/creator_edits.json'],{cwd:ROOT,maxBuffer:20*1024*1024},(err,stdout,stderr)=>err?reject(new Error(stderr||String(err))):resolve(stdout)));
      return send(res,200,JSON.stringify({rebuilt:true,log:out.slice(-2000)}),'application/json');
    }
    let rel=p==='/'?'src/app/index.html':decodeURIComponent(p).replace(/^\/+/,'');
    const abs=path.resolve(ROOT,rel);if(!abs.startsWith(ROOT))throw new Error('forbidden');
    if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())return send(res,404,'Not found: '+p);
    return send(res,200,fs.readFileSync(abs),MIME[path.extname(abs)]||'application/octet-stream');
  }catch(e){return send(res,400,JSON.stringify({error:String(e.message||e)}),'application/json');}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`World Lab review tool listening on 0.0.0.0:${PORT}`));
