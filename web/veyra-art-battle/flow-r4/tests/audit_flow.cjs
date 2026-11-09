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
const asCells=(rects)=>{const s=new Set();for(const [x,y,w,h]of rects)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)s.add(`${i},${j}`);return s};
function evaluate(p){const solids=p.rooms.filter(r=>r.level===0&&!r.open),opens=p.rooms.filter(r=>r.level===0&&r.open);const solidSet=new Set();for(const r of solids)for(const c of asCells(r.rects))solidSet.add(c);
 let conflicts=[];for(const r of opens){if(r.id.endsWith('_threshold'))continue;const inside=[...asCells(r.rects)].filter(k=>solidSet.has(k));if(inside.length)conflicts.push({room:r.id.split('.').pop(),cells:inside.length,samples:inside.slice(0,5)})}
 const cellByLevel={},floorSets={};for(const lv of p.levels){const all=asCells(p.rooms.filter(r=>r.level===lv).flatMap(r=>r.rects));floorSets[lv]=all;cellByLevel[lv]=all.size}
 const invalidStairs=p.stairs.filter(s=>!floorSets[s.from]?.has(`${s.x},${s.y}`)||!floorSets[s.to]?.has(`${s.tx},${s.ty}`)).map(s=>s.label);
 let disconnected={};for(const lv of p.levels){const all=floorSets[lv],seen=new Set(),components=[];for(const first of all){if(seen.has(first))continue;const stack=[first];seen.add(first);let n=0;while(stack.length){const k=stack.pop();n++;const [x,y]=k.split(',').map(Number);for(const q of [`${x+1},${y}`,`${x-1},${y}`,`${x},${y+1}`,`${x},${y-1}`])if(all.has(q)&&!seen.has(q)){seen.add(q);stack.push(q)}}components.push(n)}disconnected[lv]=components.sort((a,b)=>b-a)}
 return {poi:p.poi,levels:p.levels,rooms:p.rooms.length,props:p.props.length,notes:p.notes.length,stairs:p.stairs.length,solidOpenOverlapCells:conflicts.reduce((s,x)=>s+x.cells,0),conflicts,invalidStairs,cellByLevel,components:disconnected};}
const report={date:'2026-11-09',mode:'source structural QA; not visual acceptance',three:[],othersUnchanged:[]};let error=false;
for(const [id,fn] of Object.entries(ids)){const old=evaluate(before[fn]()),now=evaluate(after[fn]());report.three.push({id,before:old,after:now});if(now.invalidStairs.length||Object.values(now.components).some(a=>a.length>1)||now.solidOpenOverlapCells)error=true}
for(const [id,s]of Object.entries(after.f03Profiles())){if(ids[id])continue;const func=({po_falls:'fallsPowerhouse',po_sawaion:'aionEdgeSawmill',po_fracquarry:'fractureQuarry',po_pumphouse:'greywaterPumphouse',po_oldpump:'oldPumpingPlant',po_mill:'mossbrookMill',po_timberyard:'verdantTimberyard',po_greyquarry:'greybackQuarry',po_obsq:'obsidianQuarry',po_kilns:'charcoalKilns',po_slag:'slagworksFoundry',po_sulfur:'sulfurWorks',po_siloc:'grainSiloComplex',po_filter:'deltaFilterStation',po_geo:'geothermalStation'})[id];const n=evaluate(after[func]());const unmodified=JSON.stringify(before[func]())===JSON.stringify(after[func]());if(!unmodified)error=true;report.othersUnchanged.push({id,rooms:n.rooms,stairs:n.stairs,sourcePlanUnchanged:unmodified,openRoomBuildingOverlapCells:n.solidOpenOverlapCells,componentCounts:Object.fromEntries(Object.entries(n.components).map(([k,v])=>[k,v.length]))})}
fs.writeFileSync(path.join(root,'evidence/geometry_audit.json'),JSON.stringify(report,null,2));for(const r of report.three)console.log(r.id,'BEFORE overlaps',r.before.solidOpenOverlapCells,'AFTER',r.after.solidOpenOverlapCells,'rooms',r.after.rooms,'levels',r.after.levels,'components',r.after.components,'bad stairs',r.after.invalidStairs);console.log('other 12 left identical by routing, QA geometry only');if(error)process.exitCode=3;