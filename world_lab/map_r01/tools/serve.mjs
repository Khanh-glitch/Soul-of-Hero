import http from 'node:http';import fs from 'node:fs';
const roots={a:'/home/user/r01a/web/dist',b:'/home/user/r01b/web/dist',c:'/home/user/r01c/web/dist'};
const port=Number(process.env.PORT||4199);
http.createServer((req,res)=>{
 const m=(req.url||'').match(/^\/(a|b|c)\/(.*)$/);
 if(!m){res.writeHead(404);res.end('not found');return;}
 const f=(m[2]&&m[2]!=='/'&&!m[2].startsWith('?'))?m[2].split('?')[0]:'index.html';
 const p=roots[m[1]]+'/'+f;
 try{const b=fs.readFileSync(p);res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store'});res.end(b);}
 catch(e){try{const b=fs.readFileSync(roots[m[1]]+'/index.html');res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(b);}catch(e2){res.writeHead(404);res.end('no build');}}
}).listen(port,'0.0.0.0',()=>console.log('MAP-R01 static server on 0.0.0.0:'+port));
