// Real 640x360 1x native pixel captures from the compiled GOLD world and handcrafted POIs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {fromPNG} from '../lib/pixels.mjs';
import {NodeTarget} from './targets.mjs';
import {renderScene} from './scene.mjs';
import {SCALE,auToPx} from '../lib/constants.mjs';
const ROOT=process.cwd(),DATA=path.join(ROOT,'data'),OUT=path.join(ROOT,'screenshots');
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const readPNG=p=>fromPNG(PNG.sync.read(fs.readFileSync(p)));
function writePNG(p,pix){const png=new PNG({width:pix.width,height:pix.height});png.data.set(pix.data);fs.writeFileSync(p,PNG.sync.write(png));}
function loadData(){
  const world=readJSON(path.join(DATA,'world_base.json'));
  const poi=readJSON(path.join(DATA,'poi_overlays.json'));
  const ecologyA=readJSON(path.join(DATA,'ecology_A.json'));
  const manifest=readJSON(path.join(ROOT,'assets/generated/asset_manifest.json'));
  return {world,poi,ecology:ecologyA,manifest};
}
function cam(auX,auY){return {x:Math.round(auToPx(auX)-SCALE.cameraW/2),y:Math.round(auToPx(auY)-SCALE.cameraH/2),level:'exterior'};}
function levelCam(id,tx,ty){return {x:Math.round(tx*16-SCALE.cameraW/2),y:Math.round(ty*16-SCALE.cameraH/2),level:id};}
export function captureAll(){
  fs.mkdirSync(OUT,{recursive:true});
  const data=loadData();
  const terrain=readPNG(path.join(ROOT,'assets/generated/terrain_atlas.png'));
  const props=readPNG(path.join(ROOT,'assets/generated/props_atlas.png'));
  const gw=data.poi.anchors,ac=gw.po_academy;
  const spawn=auToPx(790),spawnY=auToPx(622);
  const shots=[
    {id:'01_greywater_harbor_day',label:'GREYWATER TIDEWORKS / HARBOR',camera:cam(812,592),player:{x:spawn,y:spawnY,level:'exterior'},mode:'day',source_ids:['po_greywater','dk_grey_s','br_3','sp_lake']},
    {id:'02_greywater_market_night',label:'GREYWATER / MARKET + BRIDGE',camera:cam(850,586),player:{x:auToPx(812),y:auToPx(592),level:'exterior'},mode:'night',source_ids:['po_greywater','br_3','rd_9','po_pumphouse']},
    {id:'03_greywater_sawmill_day',label:'AION EDGE SAWMILL / TIMBER YARD',camera:cam(748,668),player:{x:auToPx(782),y:auToPx(705),level:'exterior'},mode:'day',source_ids:['po_sawaion','po_glade','rs_1w','rd_13']},
    {id:'04_greywater_bridge_collision',label:'GREYWATER BRIDGE / COLLISION QA',camera:cam(855,576),player:{x:auToPx(850),y:auToPx(580),level:'exterior'},mode:'day',source_ids:['br_3','rd_9'],showCollision:true,showIds:true},
    {id:'05_argus_courtyard_day',label:'ARGUS ACADEMY / COURTYARD',camera:cam(936,262),player:{x:auToPx(936),y:auToPx(262),level:'exterior'},mode:'day',source_ids:['po_academy','po_archive','po_hall_eyes','po_observatory']},
    {id:'06_argus_courtyard_night',label:'ARGUS ACADEMY / ROOF OCCLUSION',camera:cam(936,278),player:{x:(data.poi.argus.structures[0].rect[0]+3)*16,y:(data.poi.argus.structures[0].rect[1]+2)*16,level:'exterior'},mode:'night',source_ids:['po_academy']},
    {id:'07_argus_l0_service_day',label:'ARGUS L0 / RECEPTION + GENERATOR',camera:levelCam('argus_l0',24,16),player:{x:20*16+8,y:27*16+8,level:'argus_l0'},mode:'day',source_ids:['po_academy'],showIds:true},
    {id:'08_argus_l1_archive_day',label:'ARGUS L-1 / ARCHIVE + CISTERN',camera:levelCam('argus_l1',24,16),player:{x:10*16+8,y:8*16+8,level:'argus_l1'},mode:'day',source_ids:['po_archive'],showIds:true},
    {id:'09_argus_l2_lens_night',label:'ARGUS L-2 / GREAT LENS VAULT',camera:levelCam('argus_l2',24,16),player:{x:24*16+8,y:18*16+8,level:'argus_l2'},mode:'night',source_ids:['po_academy','po_lantern'],showIds:true},
    {id:'10_argus_l2_collision_day',label:'ARGUS L-2 / COLLISION + RETREAT',camera:levelCam('argus_l2',24,16),player:{x:35*16+8,y:28*16+8,level:'argus_l2'},mode:'day',source_ids:['po_academy'],showCollision:true,showIds:true},
  ];
  const out=[];
  for(const s of shots){
    const t=new NodeTarget(SCALE.cameraW,SCALE.cameraH,terrain,props,data.manifest);
    const r=renderScene(t,data,s.camera,{mode:s.mode,player:s.player,label:s.label,showHud:true,showCollision:!!s.showCollision,showIds:!!s.showIds,showResources:false,showPoiIds:false,showGrid:false,time:0});
    const file=path.join(OUT,s.id+'.png'),pix=t.pix;writePNG(file,pix);
    const bytes=fs.readFileSync(file),sha=crypto.createHash('sha256').update(bytes).digest('hex');
    out.push({...s,camera_px:[s.camera.x,s.camera.y],file:path.relative(ROOT,file),sha256:sha,bytes:bytes.length,render:r});
  }
  fs.writeFileSync(path.join(OUT,'capture_manifest.json'),JSON.stringify({viewport:[SCALE.cameraW,SCALE.cameraH],pixelScale:'1x',renderer:'NodeTarget + shared scene.mjs',shots:out},null,2));
  return out;
}
if(process.argv[1]&&process.argv[1].endsWith('capture.mjs'))Promise.resolve(captureAll()).then(x=>console.log('captured',x.length,'screenshots')).catch(e=>{console.error(e);process.exit(1)});
