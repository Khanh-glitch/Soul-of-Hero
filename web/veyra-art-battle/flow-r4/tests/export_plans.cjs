const fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root=path.resolve(__dirname,'..');
function planModule(file){
 class Plan {
  constructor(poi,title,subtitle,bounds){this.p={poi,title,subtitle,bounds,structures:[],rooms:[],partitions:[],doors:[],stairs:[],props:[],loot:[],notes:[],levels:[]}}
  structure(id,name,level,o={}){this.p.structures.push({id:`${this.p.poi}.${id}`,name,level,mat:o.mat??'wood',roof:o.roof===undefined?'wood':o.roof,open:o.open,barrier:o.barrier});if(!this.p.levels.includes(level))this.p.levels.push(level);return this}
  room(id,name,level,struct,rects,o={}){this.p.rooms.push({id:`${this.p.poi}.${id}`,name,level,struct:`${this.p.poi}.${struct}`,rects,storey:level===-1?'Cellar':level===0?'Ground':level===1?'Upper':'Roof',...o});return this}
  door(x,y,level,struct,label,kind='interior'){this.p.doors.push({x,y,level,struct:`${this.p.poi}.${struct}`,label,kind});return this}
  stair(x,y,from,to,tx,ty,label,kind='interior'){this.p.stairs.push({x,y,from,to,tx,ty,label,kind});return this}
  prop(x,y,level,kind){this.p.props.push({x,y,level,kind});return this}
  note(x,y,level,text){this.p.notes.push({x,y,level,text});return this}
  cache(x,y,level,label,items){this.p.loot.push({x,y,level,label,items});return this}
  build(){this.p.levels=[...new Set([...this.p.structures.map(s=>s.level),...this.p.stairs.flatMap(s=>[s.from,s.to])])].sort((a,b)=>a-b);return this.p}
 }
 const src=fs.readFileSync(file,'utf8');const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};new Function('require','module','exports',js)((id)=>{if(id==='./plan')return {Plan};throw Error(id)},module,module.exports);
 return module.exports;
}
const before=planModule(path.join(root,'source/f03_r3.ts'));const after=planModule(path.join(root,'source/f03.ts'));
const ids={po_mill:'mossbrookMill',po_timberyard:'verdantTimberyard',po_slag:'slagworksFoundry'};
const out={};for(const [id,fn] of Object.entries(ids))out[id]={before:before[fn](),after:after[fn]()};fs.writeFileSync(path.join(root,'evidence/source_plans.json'),JSON.stringify(out));console.log('Exported '+Object.keys(out).join(','));