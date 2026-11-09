const fs=require('fs'),path=require('path');
let ts;
try { ts=require('typescript'); }
catch (_) { const cp=require('child_process'); try { ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript')); }catch(e) { throw Error('Install TypeScript first: npm install -g typescript'); }}
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(process.argv[2]||path.join(root,'BASE/R4_WORLD_ASSET_BASELINE.html'),'utf8');
function transpile(pathname){
 let src=fs.readFileSync(pathname,'utf8').replace(/^import\s+\{[^;]+from\s+['"]\.\/plan['"];?/m,'');
 src=src.replace(/\bexport\s+(?=(?:function|const)\b)/g,'');
 const r=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 if(/(^|\n)\s*(?:import\s|export\s)/.test(r))throw Error('Import syntax in '+pathname);
 return r;
}
const start='__REST48=(()=>{const Plan=Na;';const end='})(),Zo={';let i=html.indexOf(start),j=html.indexOf(end,i);if(i<0||j<0||html.indexOf(start,i+1)!==-1)throw Error('REST48 anchors incorrect');
const b48='__REST48=(()=>{const Plan=Na;\n'+transpile(path.join(root,'SOURCE/rest48_r5.ts'))+'\nreturn {makeRest48Plan,REST48_SITES};';
const b03='__C03REC=(()=>{const Plan=Na;\n'+transpile(path.join(root,'SOURCE/c03_recovery.ts'))+'\nreturn {straitLandingRecovery,hookMerePierRecovery,southfootLandingRecovery};})(),';
const prefix='Zo={po_strait:__C03REC.straitLandingRecovery,po_mere:__C03REC.hookMerePierRecovery,po_southfoot:__C03REC.southfootLandingRecovery,';
let out=html.slice(0,i)+b48+'})(),'+b03+prefix+html.slice(j+end.length);
const art=fs.readFileSync(path.join(root,'SOURCE/elder-art.js'),'utf8');
const spriteSlot='stair_down:bA,...__arenaArt.makeWaterfrontSprites(kA)';
if(!out.includes(spriteSlot)||out.indexOf(spriteSlot)!==out.lastIndexOf(spriteSlot))throw Error('Sprite registry marker ambiguous');
out=out.replace(spriteSlot,'stair_down:bA,...__elderArt.makeElderSprites(kA),...__arenaArt.makeWaterfrontSprites(kA)');
const afterArt='var uo={exports:{}}';if(!out.includes(afterArt))throw Error('Module art injection marker unavailable');
out=out.replace(afterArt,art+'\n'+afterArt);
if(out.includes('__C03=')||out.includes('!C03_AUTHENTIC'))throw Error('Misleading C03 claim');
const endTag='</script>';if(out.indexOf(endTag)!==out.lastIndexOf(endTag))throw Error('More scripts than expected');
const r5Audit=`;if(typeof window!=='undefined')window.__VEYRA_R5={ids:()=>Object.keys(Zo),plan:id=>Zo[id]?.(),audit:id=>{let p=Zo[id]?.();if(!p)return null;const c=Tw(p);return {id,levels:p.levels,rooms:p.rooms.length,stairs:p.stairs.length,props:p.props.length,notes:p.notes.length,issues:c.issues}},bosses:['po_elderwood','po_necropolis','po_hall_eyes','po_gate','po_surtur','po_typhon'],c03Recovery:['po_strait','po_mere','po_southfoot']};`;
out=out.replace(endTag,r5Audit+endTag);
const target=path.join(root,'PLAY_VEYRA_WORLD_R5_81_POI_SIX_ELDERS.html');fs.writeFileSync(target,out);
console.log(JSON.stringify({oldChars:html.length,newChars:out.length,bossModuleChars:b48.length,c03ModuleChars:b03.length,output:target},null,2));