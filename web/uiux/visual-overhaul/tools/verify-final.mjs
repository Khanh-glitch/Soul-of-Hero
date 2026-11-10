import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let ts;
try {ts=require('typescript');}
catch {try {ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');}catch{console.log('SKIP: TypeScript parser not installed (npm ci required)'); process.exit(0);}}
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const parse=[];function visit(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){
 const p=path.join(d,f.name);if(f.isDirectory())visit(p);else if(/\.tsx?$/.test(f.name))parse.push(p);
}}visit(path.join(root,'src'));visit(path.join(root,'tests'));
let syntax=[];
for (const p of parse){const src=fs.readFileSync(p,'utf8');const a=ts.createSourceFile(p,src,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 if(a.parseDiagnostics.length) syntax.push(...a.parseDiagnostics.map(d=>`${path.relative(root,p)}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`));
}
if(syntax.length)throw Error(`Syntax errors:\n${syntax.join('\n')}`);
const p=path.join(root,'src/game/return-report.ts');const src=fs.readFileSync(p,'utf8');
const ast=ts.createSourceFile(p,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='classifyOfflineReturn');
if(!fn)throw Error('classifyOfflineReturn missing');
const functionOnly=src.slice(fn.getStart(ast),fn.end).replace(/^export /,'');
const js=ts.transpileModule(functionOnly,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
const classifyOfflineReturn=vm.runInNewContext(js+'\nclassifyOfflineReturn',{});
const mk=(o={})=>({away:{fromAt:0,toAt:17*60000,gapMs:17*60000,expired:false,quiet:false},sections:{body:[],production:[],home:[],loss:[],world:[]},receiptCount:0,...o});
const row=(tone,id,source='state')=>({id,tone,source,text:'Observed result',receipts:source==='event'?['r']:[]});
const cases=[
 ['17 min, no event',mk(), 'minimal'],
 ['17 min, 1 routine event',mk({receiptCount:1}),'minimal'],
 ['2 verified receipts',mk({receiptCount:2}),'notable'],
 ['existing unfunded cabinet (not an offline delta)',mk({sections:{...mk().sections,home:[row('warn','cab:one')]}}),'minimal'],
 ['actual body deterioration',mk({sections:{...mk().sections,body:[row('warn','shift:vitals')]}}),'notable'],
 ['verified severe loss',mk({sections:{...mk().sections,loss:[row('bad','lost:wall')]}}),'critical'],
 ['critical health NOW',mk({sections:{...mk().sections,body:[row('bad','vitals')]}}),'critical'],
 ['run expired',mk({away:{fromAt:0,toAt:5,gapMs:5,expired:true,quiet:false}}),'critical'],
];
for(const [name,report,expected] of cases){const actual=classifyOfflineReturn(report);if(actual!==expected)throw Error(`${name}: expected ${expected}, got ${actual}`);}
const map=fs.readFileSync(path.join(root,'src/ui/ExpeditionMap.tsx'),'utf8');
if(!map.includes('CANVAS_W / 2 - anchor.px')||!map.includes('No field intelligence recorded'))throw Error('Map patch missing');
const chron=fs.readFileSync(path.join(root,'src/ui/ReturnChronicle.tsx'),'utf8');
if(!chron.includes('!isDeltaStateRow(r)') || !chron.includes('CURRENT ALERT')) throw Error('Offline separation patch missing');
console.log(`PASS: ${parse.length} TS/TSX files parse clean; ${cases.length} offline importance scenarios; UI feature contracts`);
