import {influenceBounds,influenceWorldRect,type InfluenceBounds} from './influenceBounds';
import {visualTick} from '../game/visualQuality';
import {combineCStage,hasCStage,compositeCStage} from './stage';import {CStageGpu} from './stageGpu';
/** Developer-only C7/C10/C17/C20 live-field diagnostic, not playtest/visual approval. */
import { bDiagnosticEnabled } from '../arcana_b/devLayer';
import { CSource,type CId } from './player';
import { compositeC } from './composite';
import { worldRect } from '../arcana_b/worldRect';
import { CGpuComposite,sharedCGpuComposite } from './gpu';
import { bayer } from './engine/math';
import {combineCPost,hasCPost,compositeCPost} from './post';import {CPostGpu,sharedCPostGpu} from './postGpu';
type Active={source:CSource;runId:string;startMs:number;tick:number;frame:ReturnType<CSource['renderAtSeconds']>;sourceMs:number;localBounds:InfluenceBounds|null};
const active:Active[]=[];
const gpuRequested=bDiagnosticEnabled && new URLSearchParams(location.search).get('arcanaGpu')==='1';const fullGpu=new URLSearchParams(location.search).get('arcanaCFull')==='1';let gpu:CGpuComposite|null=null;let gpuFailed=false;
export const cDiagnosticTimings:{id:CId;time:number;sourceMs:number;compositeMs:number;gpuProfile?:{sceneMs:number;packMs:number;fieldUploadMs:number;atlasPackMs:number;atlasUploadMs:number;submitMs:number;fieldsReused:boolean};liveOps:number;maxOverlap:number;gpuInitMs?:number;gpuCopyMs?:number}[]=[];
if(bDiagnosticEnabled)(window as any).__arcanaCDiagnosticTimings=cDiagnosticTimings;
export function startCDiagnostic(e:any){
 if(!bDiagnosticEnabled||![7,10,17,20].includes(e.id))return;
 const reach=Math.max(35,Math.min(130,Math.hypot(e.aimX-e.x,e.aimY-e.y)));
 active.push({source:new CSource(e.id as CId,{x:e.x,y:e.y},{x:e.x+Math.cos(e.a)*reach,y:e.y+Math.sin(e.a)*reach}),runId:e.runId,startMs:e.simMs,tick:-1,frame:null,sourceMs:0,localBounds:null});
}
// Advance once per game frame, before the stage and local world passes.
export function prepareCDiagnostic(runId:string,simMs:number){
 if(!bDiagnosticEnabled)return;
 for(let i=active.length-1;i>=0;i--){const a=active[i],seconds=(simMs-a.startMs)/1000;if(a.runId!==runId||seconds>=a.source.duration){active.splice(i,1);continue;}
  const tick=visualTick(a.source.id,seconds);a.sourceMs=0;if(tick!==a.tick){const start=performance.now();a.frame=a.source.renderAtSeconds(tick/60);a.localBounds=a.frame?influenceBounds(a.frame.frame.worldInfluence):null;a.sourceMs=performance.now()-start;a.tick=tick;}
 }
}
let stageGpu:CStageGpu|null=null,stageGpuFailed=false;
/** P0 C stage policy: viewport-aligned scanlines and shade below effects/actors. */
export function shadeCDiagnostic(g:CanvasRenderingContext2D,_cx:number,_cy:number){
 if(!bDiagnosticEnabled)return;if(!active.length){(window as any).__arcanaCStage={shade:1,activeLines:0,time:[]};return;}const stage=combineCStage(active.flatMap(a=>a.frame?[a.frame.frame]:[]));(window as any).__arcanaCStage={shade:stage.shade,activeLines:stage.scan.reduce((n,v,i)=>n+(i%2===0&&(v!==0||stage.scan[i+1]!==0)?1:0),0),time:active.map(a=>a.frame?.t??-1)};if(!hasCStage(stage))return;
 if(gpuRequested&&!stageGpuFailed){try{if(!stageGpu)stageGpu=new CStageGpu(g.canvas.width,g.canvas.height);stageGpu.render(g.canvas,stage);g.save();g.setTransform(1,0,0,1,0,0);g.drawImage(stageGpu.canvas,0,0);g.restore();return;}catch(e){stageGpuFailed=true;console.warn('Experimental C stage GPU failed; falling back to CPU',e);}}
 const image=g.getImageData(0,0,g.canvas.width,g.canvas.height);compositeCStage(image.data,image.width,image.height,stage);g.putImageData(image,0,0);
}
export function drawCDiagnostic(g:CanvasRenderingContext2D,cx:number,cy:number){
 if(!bDiagnosticEnabled||!active.length)return;
 for(let i=active.length-1;i>=0;i--){const a=active[i];
  if(!a.frame)continue;
  // A zero coverage mask makes both local C compositors an exact identity.
  // Stage, blackout and post continue to run independently as authored.
  if(!a.localBounds){if(cDiagnosticTimings.length<1200)cDiagnosticTimings.push({id:a.source.id,time:a.frame.t,sourceMs:a.sourceMs,compositeMs:0,liveOps:0,maxOverlap:0});continue;}
  const box=fullGpu?worldRect(a.frame.transform,cx,cy,g.canvas.width,g.canvas.height):influenceWorldRect(a.localBounds,a.frame.transform,cx,cy,g.canvas.width,g.canvas.height);if(!box.w||!box.h)continue;const start=performance.now();let gpuInitMs=0,gpuCopyMs=0;
  if(gpuRequested&&!gpuFailed){try{if(!gpu){const init=performance.now();gpu=sharedCGpuComposite(g.canvas.width,g.canvas.height);gpuInitMs=performance.now()-init;}gpu.render(g.canvas,a.frame.frame,a.frame.transform,cx,cy,a.tick,fullGpu?undefined:box);
    const copy=performance.now();g.save();try{g.setTransform(1,0,0,1,0,0);if(fullGpu)g.drawImage(gpu.canvas,0,0);else g.drawImage(gpu.canvas,box.x,box.y,box.w,box.h,box.x,box.y,box.w,box.h);}finally{g.restore();}gpuCopyMs=performance.now()-copy;
   }catch(e){gpuFailed=true;console.warn('Experimental GPU C pass failed; falling back to CPU',e);}}
  if(!gpuRequested||gpuFailed){ // CPU samples displaced pixels from the whole source window, not only the destination ROI.
   const cpuBox=worldRect(a.frame.transform,cx,cy,g.canvas.width,g.canvas.height);if(cpuBox.w&&cpuBox.h){const image=g.getImageData(cpuBox.x,cpuBox.y,cpuBox.w,cpuBox.h);compositeC(image.data,image.width,image.height,a.frame.frame,a.frame.transform,cx+cpuBox.x,cy+cpuBox.y);g.putImageData(image,cpuBox.x,cpuBox.y);}}
  if(cDiagnosticTimings.length<1200){let liveOps=0,maxOverlap=0;for(const ops of a.frame.frame.liveLight.values()){liveOps+=ops.length;maxOverlap=Math.max(maxOverlap,ops.length);}cDiagnosticTimings.push({id:a.source.id,time:a.frame.t,sourceMs:a.sourceMs,compositeMs:performance.now()-start,gpuProfile:gpuRequested&&!gpuFailed?gpu?.lastProfile:undefined,liveOps,maxOverlap,gpuInitMs,gpuCopyMs});}
 }
}

let blackoutCanvas:HTMLCanvasElement|null=null;
/** Authored #17 blackout covers the real world and actors, but not React HUD;
 * redraw source light on top. Bloom and complete multi-cast ordering remain open. */
export function blackoutCDiagnostic(g:CanvasRenderingContext2D,cx:number,cy:number){
 if(!bDiagnosticEnabled)return;const a=active.find(a=>a.frame?.post.stageBlackout);(window as any).__arcanaCBlackout=!!a;if(!a?.frame)return;
 const f=a.frame.frame,m=a.frame.transform;
 if(!blackoutCanvas){blackoutCanvas=document.createElement('canvas');blackoutCanvas.width=384;blackoutCanvas.height=216;}
 const bg=blackoutCanvas.getContext('2d')!,image=bg.createImageData(384,216);
 for(let p=0;p<384*216;p++){const i=p*4,th=bayer(p%384,Math.floor(p/384)),v=[0,1,2].map(k=>Math.floor(f.light[i+k]*8+th)/8);const over=(Math.max(v[0]-1,0)+Math.max(v[1]-1,0)+Math.max(v[2]-1,0))*.45;
  for(let k=0;k<3;k++)image.data[i+k]=Math.round(Math.max(0,Math.min(1,v[k]+over))*255);image.data[i+3]=255;
 }
 bg.putImageData(image,0,0);g.save();g.setTransform(1,0,0,1,0,0);g.fillStyle='#000';g.fillRect(0,0,g.canvas.width,g.canvas.height);
 g.setTransform(m.a,m.b,m.c,m.d,m.x-cx,m.y-cy);g.imageSmoothingEnabled=false;g.drawImage(blackoutCanvas,0,0);g.restore();
}

let postGpu:CPostGpu|null=null,postGpuFailed=false;
/** Diagnostic B/C-compatible pre-HUD policy for C source metadata only. */
export function postCDiagnostic(g:CanvasRenderingContext2D){if(!bDiagnosticEnabled)return;const inputs=active.flatMap(a=>a.frame?[{tick:a.source.tick,transform:a.frame.transform,...a.frame.post}]:[]),post=combineCPost(inputs);if(!hasCPost(post))return;if(gpuRequested&&!postGpuFailed){try{if(!postGpu)postGpu=sharedCPostGpu(g.canvas.width,g.canvas.height);postGpu.render(g.canvas,post);g.save();g.setTransform(1,0,0,1,0,0);g.drawImage(postGpu.canvas,0,0);g.restore();return;}catch(e){postGpuFailed=true;console.warn('Experimental C post GPU failed; falling back to CPU',e);}}const image=g.getImageData(0,0,g.canvas.width,g.canvas.height);compositeCPost(image.data,image.width,image.height,post);g.putImageData(image,0,0);}
