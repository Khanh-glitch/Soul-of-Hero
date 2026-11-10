import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const required=['src/ui/Waymark.tsx','src/ui/Journey.tsx','src/ui/journey.css','src/game/journey.ts','src/ui/SurvivorScreen.tsx'];
for(const p of required)if(!fs.existsSync(p))throw Error('Missing A source '+p);
const src=fs.readFileSync('src/ui/Game.tsx','utf8');
for(const x of ['<Waymark','quickGoals={quickGoals}','onQuickTrack={track}','<JourneyLedger'])if(!src.includes(x))throw Error('Missing integrated runtime '+x);
const assetRoot='src/game/pixelfx';const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(e.name.endsWith('.png'))files.push(file)}}walk(assetRoot);
if(files.length!==54)throw Error(`Expected 54 original PixelFX PNG, got ${files.length}`);
let count=0;
function inspect(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())inspect(f);else if(/\.tsx?$/.test(f)){
 const out=ts.transpileModule(fs.readFileSync(f,'utf8'),{fileName:f,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX, target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 if(out.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error))throw Error('Syntax invalid '+f); count++;}}}inspect('src');
console.log(`PASS: A Waymark/Ledger retained, B functionality wired, ${files.length} PixelFX PNG, ${count} TS/TSX sources parsed`);
