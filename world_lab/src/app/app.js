// Browser review/authoring surface. It uses the SAME scene renderer as Node captures.
import {renderScene} from '../render/scene.mjs';
import {BrowserTarget} from '../render/targets.mjs';
import {M,MATERIAL_NAME,SCALE,auToPx} from '../lib/constants.mjs';
import {makeCollision,move,blocked} from '../lib/movement.mjs';
import {drawOverview} from './overview.js';
const $=id=>document.getElementById(id);
const getJSON=async p=>{const r=await fetch(p);if(!r.ok)throw new Error(p+' '+r.status);return r.json();};
const image=async p=>{const i=new Image();i.src=p;await i.decode();return i;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const SOLID=new Set([M.DEEP,M.SHALLOW,M.RIVER,M.CLIFF,M.LAVA,M.WALL_WOOD,M.WALL_STONE,M.INTERIOR_VOID]);
const PRESETS=[
 {label:'Greywater Tideworks / open mill + harbor',level:'exterior',au:[812,592],player:[790,622]},
 {label:'Greywater market / working bridge',level:'exterior',au:[850,586],player:[812,592]},
 {label:'Aion Edge sawmill / timber yard',level:'exterior',au:[748,668],player:[782,705]},
 {label:'Argus Academy / exterior courtyard',level:'exterior',au:[936,262],player:[936,262]},
 {label:'Argus L0 / reception + generator',level:'argus_l0',tile:[20,22],playerTile:[20,27]},
 {label:'Argus L-1 / archive + cistern',level:'argus_l1',tile:[16,12],playerTile:[10,8]},
 {label:'Argus L-2 / Great Lens vault',level:'argus_l2',tile:[24,16],playerTile:[24,18]},
 {label:'Argus L-2 / west retreat loop',level:'argus_l2',tile:[10,16],playerTile:[8,16]},
];
let data={},target,terrainImg,propsImg,last=0;
const state={
 mode:'day',variant:'A',level:'exterior',camera:{x:0,y:0,level:'exterior'},player:{x:0,y:0,level:'exterior'},
 time:0,keys:new Set(),selected:null,editMode:null,lastEditId:null,edits:{version:1,lockedRegions:[],lockedEdits:[],edits:[]},
};
function level(){return data.poi.argus.levels.find(l=>l.id===state.level);}
function gridW(){return state.level==='exterior'?SCALE.gridW:level().w;}
function gridH(){return state.level==='exterior'?SCALE.gridH:level().h;}
function followCamera(){const maxX=gridW()*16-SCALE.cameraW,maxY=gridH()*16-SCALE.cameraH;state.camera.x=clamp(state.player.x-SCALE.cameraW/2,0,maxX);state.camera.y=clamp(state.player.y-SCALE.cameraH/2,0,maxY);state.camera.level=state.level;}
function collision(){
  if(state.level==='exterior')return makeCollision(data.world,{structures:data.poi.structures,props:data.ecology.props});
  const l=level(),rects=[];for(const p of l.props){if(p.solid&&p.collider)rects.push({x:p.x+p.collider.x,y:p.y+p.collider.y,w:p.collider.w,h:p.collider.h});}
  return {W:l.w,H:l.h,grid:Uint8Array.from(l.collision),rects};
}
function setLevel(id){
  state.level=id;state.player.level=id;state.camera.level=id;$('level').value=id;
  if(id==='exterior'){state.player.x=auToPx(790);state.player.y=auToPx(622);}
  else {const l=level(),s=l.stairs[0];state.player.x=s.tx*16+8;state.player.y=s.ty*16+8;}
  followCamera();$('viewLabel').textContent=id==='exterior'?'EXTERIOR / GOLD WORLD':level().name.toUpperCase();
}
function setPreset(i){
  const p=PRESETS[i];if(!p)return;state.level=p.level;state.player.level=p.level;state.camera.level=p.level;$('level').value=p.level;
  if(p.au){state.camera.x=Math.round(auToPx(p.au[0])-SCALE.cameraW/2);state.camera.y=Math.round(auToPx(p.au[1])-SCALE.cameraH/2);state.player.x=auToPx(p.player[0]);state.player.y=auToPx(p.player[1]);}
  else {state.camera.x=Math.round(p.tile[0]*16-SCALE.cameraW/2);state.camera.y=Math.round(p.tile[1]*16-SCALE.cameraH/2);state.player.x=p.playerTile[0]*16+8;state.player.y=p.playerTile[1]*16+8;}
  followCamera();$('viewLabel').textContent=p.level==='exterior'?'EXTERIOR / GOLD WORLD':level().name.toUpperCase();
}
function debug(){
  return {showCollision:$('showCollision').checked,showGrid:$('showGrid').checked,showIds:$('showIds').checked,showResources:$('showResources').checked,showPoiIds:$('showPoiIds').checked,showRoute:$('showRoute').checked};
}
function render(){
  const d=debug(),label=state.level==='exterior'?'VEYRA GOLD / WORLD LAB':level().name;
  const opts={mode:state.mode,player:state.player,label,showHud:true,time:state.time,route:d.showRoute&&data.paired?.full_path?.path?data.paired.full_path.path:null,showCollision:d.showCollision,showGrid:d.showGrid,showIds:d.showIds,showResources:d.showResources,showPoiIds:d.showPoiIds};
  const r=renderScene(target,data,state.camera,opts);
  if(state.selected&&state.selected.level===state.level){const ctx=$('viewport').getContext('2d'),x=state.selected.tx*16-state.camera.x,y=state.selected.ty*16-state.camera.y;ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(x,y,16,1);ctx.fillRect(x,y,1,16);ctx.fillRect(x+15,y,1,16);ctx.fillRect(x,y+15,16,1);}
  drawOverview($('overview'),data,state,(tx,ty)=>{if(state.level!=='exterior')setLevel('exterior');state.player.x=tx*16+8;state.player.y=ty*16+8;followCamera();inspect(tx,ty);});
  return r;
}
function inspect(tx,ty){
  const W=state.level==='exterior'?SCALE.gridW:level().w,k=ty*W+tx,mat=state.level==='exterior'?data.world.material[k]:level().material[k],col=state.level==='exterior'?data.world.collision[k]:level().collision[k];
  const refs=state.level==='exterior'?(data.world.refs[k]||[]):[],names=refs.map(id=>data.world.goldIndex[id]?.name||id);
  const auX=tx*SCALE.unitsPerTile+2,auY=ty*SCALE.unitsPerTile+2;
  const near=(arr,field='at')=>arr.map(o=>({id:o.id,name:o.name||o.text,d:Math.hypot((o[field]?.[0]||0)-auX,(o[field]?.[1]||0)-auY)})).sort((a,b)=>a.d-b.d).slice(0,3);
  const pois=state.level==='exterior'?near(data.world.objects.pois):[],resources=state.level==='exterior'?near(data.world.objects.resources):[];
  const sites=(data.poi.greywater.build_sites||[]).filter(q=>{const [x,y,w,h]=q.rect;return tx>=x&&tx<x+w&&ty>=y&&ty<y+h;}).map(q=>q.id);
  state.selected={tx,ty,k,level:state.level};
  $('inspector').textContent=[
    `tile [${tx},${ty}]  world_px [${tx*16},${ty*16}]  au≈[${auX},${auY}]`,
    `material ${mat} ${MATERIAL_NAME[mat]||'?'}   collision ${col?'BLOCKED':'WALKABLE'}`,
    `GOLD source IDs: ${refs.length?refs.join(', '):'(none on this tile)'}`,
    `GOLD names: ${names.length?names.join(' | '):'(none)'}`,
    `nearby POIs: ${pois.map(p=>p.id+' '+p.d.toFixed(1)).join(' | ')||'(none)'}`,
    `nearby resources: ${resources.map(p=>p.id+' '+p.d.toFixed(1)).join(' | ')||'(none)'}`,
    `build-site candidates: ${sites.join(', ')||'(none)'}`,
    `locked regions: ${state.edits.lockedRegions.join(', ')||'(none)'}`,
  ].join('\n');
}
function applyEdit(tx,ty,clientX,clientY){
  if(state.level!=='exterior'){editStatus('Switch to exterior before placing world edits.');return;}
  const k=ty*SCALE.gridW+tx;
  if(state.editMode==='tile'){
    const material=Number($('editMaterial').value),id='creator_tile_'+Date.now()+'_'+tx+'_'+ty;
    const e={id,kind:'tile',tx,ty,material,base:data.world.material[k],gold_ref:'creator_tile_edit',locked:false};
    state.edits.edits.push(e);state.lastEditId=id;data.world.material[k]=material;data.world.collision[k]=SOLID.has(material)?1:0;
    editStatus('Tile edit recorded: '+id+' (base preserved).');
  } else if(state.editMode==='prop'){
    const name=$('editProp').value,r=data.manifest.props[name],x=tx*16,y=ty*16-(r?.h||16)+16,id='creator_prop_'+Date.now()+'_'+tx+'_'+ty;
    const p={id,name,x,y,profile:name.startsWith('3q_')?'CRAFTPIX-3Q':name.startsWith('bld_')?'INDUSTRIAL-TILE-16':'SOH-PROTO-16',solid:false,collider:null,renderFootprint:r?{x:0,y:0,w:r.w,h:r.h}:null,source_ids:[],story:'Creator-placed review prop; no gameplay value.',layer:'prop',region:`${Math.floor(tx/12)}:${Math.floor(ty/12)}`};
    state.edits.edits.push({id,kind:'prop',prop:p,gold_ref:'creator_prop_edit',locked:false});state.lastEditId=id;data.ecology.props.push(p);
    editStatus('Prop edit recorded: '+id+' ('+name+').');
  }
  inspect(tx,ty);
}
function editStatus(s){$('editStatus').textContent=s;}
function lockRegion(){
  const tx=Math.floor((state.camera.x+SCALE.cameraW/2)/16),ty=Math.floor((state.camera.y+SCALE.cameraH/2)/16),key=`${Math.floor(tx/12)}:${Math.floor(ty/12)}`;
  if(!state.edits.lockedRegions.includes(key))state.edits.lockedRegions.push(key);
  for(const p of data.ecology.props)if(p.region===key&&!state.edits.lockedEdits.includes(p.id))state.edits.lockedEdits.push(p.id);
  editStatus('Locked region '+key+' and '+data.ecology.props.filter(p=>p.region===key).length+' visible-region props.');
}
function lockLast(){
  const e=state.edits.edits.find(x=>x.id===state.lastEditId);if(!e)return editStatus('No edit to lock.');
  e.locked=true;if(!state.edits.lockedEdits.includes(e.id))state.edits.lockedEdits.push(e.id);editStatus('Locked '+e.id+' for regeneration.');
}
async function saveEdits(){const r=await fetch('/api/edits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state.edits)});editStatus('Save: '+JSON.stringify(await r.json()));}
function exportEdits(){const b=new Blob([JSON.stringify(state.edits,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='soh_creator_edits.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);editStatus('Exported '+state.edits.edits.length+' edits.');}
async function importEdits(file){const e=JSON.parse(await file.text());if(!Array.isArray(e.edits))throw new Error('invalid edits');state.edits=e;await saveEdits();editStatus('Imported and saved '+e.edits.length+' edits.');}
async function rebuild(){editStatus('Rebuilding compiler, atlases, captures and QA…');const r=await fetch('/api/rebuild',{method:'POST'}),j=await r.json();editStatus(j.error?'Rebuild failed: '+j.error:'Rebuild complete. Reloading… '+j.log?.split('\n').slice(-1)[0]);if(!j.error)setTimeout(()=>location.reload(),900);}
function bind(){
  for(const id of ['mode','variant','level','preset'])($(id).addEventListener('change',()=>{
    state.mode=$('mode').value;state.variant=$('variant').value;data.ecology=state.variant==='A'?data.ecoA:data.ecoB;
    if(id==='level')setLevel($('level').value);if(id==='preset')setPreset(Number($('preset').value));
  }));
  for(const id of ['showCollision','showGrid','showIds','showResources','showPoiIds','showRoute'])$(id).addEventListener('change',render);
  const canvas=$('viewport');canvas.addEventListener('click',e=>{
    const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*SCALE.cameraW,y=(e.clientY-r.top)/r.height*SCALE.cameraH,tx=Math.floor((state.camera.x+x)/16),ty=Math.floor((state.camera.y+y)/16);
    if(state.editMode)applyEdit(tx,ty,e.clientX,e.clientY);else inspect(tx,ty);
  });
  window.addEventListener('keydown',e=>{state.keys.add(e.key.toLowerCase());if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase()))e.preventDefault();});
  window.addEventListener('keyup',e=>state.keys.delete(e.key.toLowerCase()));
  $('paintTile').onclick=()=>{state.editMode='tile';editStatus('Click a world tile to paint '+MATERIAL_NAME[Number($('editMaterial').value)]+'.');};
  $('addProp').onclick=()=>{state.editMode='prop';editStatus('Click a world tile to place '+$('editProp').value+'.');};
  $('lockRegion').onclick=lockRegion;$('lockLast').onclick=lockLast;$('saveEdits').onclick=saveEdits;$('exportEdits').onclick=exportEdits;$('rebuild').onclick=rebuild;
  $('importEdits').onchange=e=>e.target.files[0]&&importEdits(e.target.files[0]).catch(x=>editStatus('Import failed: '+x.message));
}
function loop(ts){
  const dt=Math.min(.05,(ts-last)/1000||0);last=ts;state.time+=dt;
  let dx=0,dy=0;for(const k of state.keys){if(k==='a'||k==='arrowleft')dx--;if(k==='d'||k==='arrowright')dx++;if(k==='w'||k==='arrowup')dy--;if(k==='s'||k==='arrowdown')dy++;}
  if(dx||dy){const n=Math.hypot(dx,dy),speed=SCALE.playerSpeedPxPerSec*dt,c=collision(),p=move(c,state.player,dx/n*speed,dy/n*speed,4);state.player.x=p.x;state.player.y=p.y;followCamera();}
  render();requestAnimationFrame(loop);
}
async function load(){
  const [world,poi,ecoA,ecoB,manifest,paired,qa,shots,edits,terrain,props]=await Promise.all([
    getJSON('/data/world_base.json'),getJSON('/data/poi_overlays.json'),getJSON('/data/ecology_A.json'),getJSON('/data/ecology_B.json'),
    getJSON('/assets/generated/asset_manifest.json'),getJSON('/data/paired_route.json'),getJSON('/qa/results.json').catch(()=>null),
    getJSON('/screenshots/capture_manifest.json').catch(()=>({shots:[]})),getJSON('/data/creator_edits.json').catch(()=>({version:1,lockedRegions:[],lockedEdits:[],edits:[]})),
    image('/assets/generated/terrain_atlas.png'),image('/assets/generated/props_atlas.png')]);
  data={world,poi,ecology:ecoA,ecoA,ecoB,manifest,paired,qa,shots};state.edits=edits;terrainImg=terrain;propsImg=props;
  target=new BrowserTarget($('viewport').getContext('2d',{alpha:false}),SCALE.cameraW,SCALE.cameraH,terrainImg,propsImg,manifest);
  for(const l of poi.argus.levels){const o=document.createElement('option');o.value=l.id;o.textContent=l.name;$('level').append(o);}
  PRESETS.forEach((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent=p.label;$('preset').append(o);});
  MATERIAL_NAME.forEach((n,i)=>{const o=document.createElement('option');o.value=i;o.textContent=i+' — '+n;$('editMaterial').append(o);});
  Object.keys(manifest.props).filter(n=>/^(proto_|3q_|bld_|bridge_)/.test(n)).forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=n;$('editProp').append(o);});
  for(const s of shots.shots.slice(0,8)){const f=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption');img.src='/'+s.file;img.alt=s.label;cap.textContent=s.id;f.append(img,cap);$('gallery').append(f);}
  $('qa').textContent=qa?`QA ${qa.summary.pass}/${qa.summary.total} pass · ${qa.verdicts.compiler_and_data} · ${qa.verdicts.creator_visual_review} · ${qa.verdicts.playability}`:'QA report not found';
  $('status').textContent=`GOLD ${world.meta.goldSha256.slice(0,12)}… · ${world.grid.w}×${world.grid.h} tiles · ${manifest.blob47.count} blob cases · ${ecoA.props.length}/${ecoB.props.length} ecology props`;
  bind();setPreset(0);window.__SOH_READY__=true;window.SOH_APP={state,data,setPreset,setLevel,render,inspect,renderScene};requestAnimationFrame(loop);
}
load().catch(e=>{console.error(e);$('status').textContent='LOAD ERROR: '+e.message;window.__SOH_ERROR__=String(e.message||e);});
