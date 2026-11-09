const fs=require('fs'), path=require('path');
let ts;try{ts=require('typescript')}catch(e){ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')}
const dirname=__dirname;
const inputPath=process.argv[2] || path.join(dirname,'BASELINE_78_POIS_NO_C03.html');
const src=fs.readFileSync(inputPath,'utf8');
const names=['pixel-craft','surface-art','c04-art','c01-art','c02-art','f03-art'];
const contents={};for(const n of names)contents[n]=ts.transpileModule(fs.readFileSync(path.join(dirname,'src',n+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
// A namespace-safe, deterministic CommonJS adapter only for the Arena art code.
const helper=`\nconst __arenaArt = (()=>{
const moduleTable={};
const hash2=(x,y,s=0)=>{let h=(x*374761393+y*668265263+s*2246822519)|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296};
const hex=(c)=>{const n=parseInt(c.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255]};
const outlineCanvas=(c,col)=>{const g=c.getContext('2d');const d=g.getImageData(0,0,c.width,c.height);const a=d.data,W=c.width,H=c.height,src=new Uint8Array(W*H);for(let i=0;i<W*H;i++)src[i]=a[i*4+3]>40?1:0;const [r,gg,b]=hex(col);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(src[i])continue;if((x>0&&src[i-1])||(x<W-1&&src[i+1])||(y>0&&src[i-W])||(y<H-1&&src[i+W])){a[i*4]=r;a[i*4+1]=gg;a[i*4+2]=b;a[i*4+3]=255}}g.putImageData(d,0,0)};
const gameCore={hash2};const gameArt={hex,outlineCanvas};
function load(key,src){const exports={};const require=(id)=>id==='../game/core'?gameCore:id==='../game/art'?gameArt:moduleTable[id.replace('./','')];(new Function('require','exports',src))(require,exports);moduleTable[key]=exports;return exports}
${names.map(n=>`load(${JSON.stringify(n)},${JSON.stringify(contents[n])});`).join('\n')}
const map={...moduleTable['c04-art'],...moduleTable['c01-art'],...moduleTable['c02-art'],...moduleTable['f03-art']};
const draws={...map};
const cache=new Map(),MAX=12000;
const deck=(fn)=>(g,x,y,id,edges)=>{
 const key=fn.name+'|'+x+'|'+y+'|'+id+'|'+edges;
 let tile=cache.get(key);
 if(!tile){tile=document.createElement('canvas');tile.width=16;tile.height=16;const ctx=tile.getContext('2d',{alpha:true});ctx.translate(-x*16,-y*16);fn(ctx,x,y,id,edges);if(cache.size>=MAX){const first=cache.keys().next().value;cache.delete(first)}cache.set(key,tile)}
 g.drawImage(tile,x*16,y*16);
};
const result={...draws};for(const k of ['drawWaterfrontDeckTile','drawUrbanHarborDeckTile','drawIndustrialHarborTile','drawF03DeckTile'])result[k]=deck(draws[k]);
result.stats=()=>({textureCache:cache.size,available:Object.keys(map)});
window.__arenaArtAudit=result;
return result;
})();\n`;
let out=src;const needle='var uo={exports:{}}';if(!out.includes(needle))throw Error('bundle bootstrap changed');out=out.replace(needle,helper+needle);
const replace={
  '...makeWaterfrontSprites(kA)':'...__arenaArt.makeWaterfrontSprites(kA)',
  '...makeUrbanHarborSprites(kA)':'...__arenaArt.makeUrbanHarborSprites(kA)',
  '...makeIndustrialHarborSprites(kA)':'...__arenaArt.makeIndustrialHarborSprites(kA)',
  '...makeF03Sprites(kA)':'...__arenaArt.makeF03Sprites(kA)',
  'drawWaterfrontDeckTile(A,tx,ty,pid,mask)':'__arenaArt.drawWaterfrontDeckTile(A,tx,ty,pid,mask)',
  'drawUrbanHarborDeckTile(A,tx,ty,pid,mask)':'__arenaArt.drawUrbanHarborDeckTile(A,tx,ty,pid,mask)',
  'drawIndustrialHarborTile(A,tx,ty,pid,mask)':'__arenaArt.drawIndustrialHarborTile(A,tx,ty,pid,mask)',
  'drawF03DeckTile(A,tx,ty,pid,mask)':'__arenaArt.drawF03DeckTile(A,tx,ty,pid,mask)',
};for(const [a,b] of Object.entries(replace)){const count=out.split(a).length-1;if(count!==1)throw Error('Needle expected one '+a+' has '+count);out=out.replace(a,b)}
const outPath=process.argv[3] || path.join(dirname,'VEYRA_ARENA_ART_LIVE_PILOT_78_POIS_NO_C03.html');fs.writeFileSync(outPath,out);fs.writeFileSync(path.join(dirname,'integration-manifest.json'),JSON.stringify({sourcePreview:'VEYRA_81_WORKING_PREVIEW_MISSING_C03.html',arenaZip:'redesign-veyra-pixel-assets.zip',artModules:names,patched:Object.keys(replace),restriction:'C03 source absent from preview; this is a 78 authored POI preview, not 81 verified',retainsWorld:true},null,2));console.log(JSON.stringify({out:outPath,mb:Math.round(out.length/1e6*10)/10,patched:Object.keys(replace)},null,2));