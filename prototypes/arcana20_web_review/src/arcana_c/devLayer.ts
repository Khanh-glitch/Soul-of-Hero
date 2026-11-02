/** Developer-only C7/C10/C17/C20 live-field diagnostic, not playtest/visual approval. */
import { bDiagnosticEnabled } from '../arcana_b/devLayer';
import { CSource,type CId } from './player';
import { compositeC } from './composite';
import { worldRect } from '../arcana_b/worldRect';
import { CGpuComposite } from './gpu';
import { bayer } from './engine/math';
type Active={source:CSource;runId:string;startMs:number;tick:number;frame:ReturnType<CSource['renderAtSeconds']>;sourceMs:number};
const active:Active[]=[];
const gpuRequested=bDiagnosticEnabled && new URLSearchParams(location.search).get('arcanaGpu')==='1';let gpu:CGpuComposite|null=null;let gpuFailed=false;
export const cDiagnosticTimings:{id:CId;time:number;sourceMs:number;compositeMs:number}[]=[];
if(bDiagnosticEnabled)(window as any).__arcanaCDiagnosticTimings=cDiagnosticTimings;
export function startCDiagnostic(e:any){
 if(!bDiagnosticEnabled||![7,10,17,20].includes(e.id))return;
 const reach=Math.max(35,Math.min(130,Math.hypot(e.aimX-e.x,e.aimY-e.y)));
 active.push({source:new CSource(e.id as CId,{x:e.x,y:e.y},{x:e.x+Math.cos(e.a)*reach,y:e.y+Math.sin(e.a)*reach}),runId:e.runId,startMs:e.simMs,tick:-1,frame:null,sourceMs:0});
}
// Advance once per game frame, before the stage and local world passes.
export function prepareCDiagnostic(runId:string,simMs:number){
 if(!bDiagnosticEnabled)return;
 for(let i=active.length-1;i>=0;i--){const a=active[i],seconds=(simMs-a.startMs)/1000;if(a.runId!==runId||seconds>=a.source.duration){active.splice(i,1);continue;}
  const tick=Math.floor(seconds*60+1e-8);a.sourceMs=0;if(tick!==a.tick){const start=performance.now();a.frame=a.source.renderAtSeconds(seconds);a.sourceMs=performance.now()-start;a.tick=tick;}
 }
}
/** P0 C stage shade belongs below local source effects and actors. */
export function shadeCDiagnostic(g:CanvasRenderingContext2D,cx:number,cy:number){
 if(!bDiagnosticEnabled)return;let shade=1;for(const a of active)if(a.frame)shade*=a.frame.post.stageShade;
 if(shade>=1)return;g.save();g.fillStyle=`rgba(0,0,0,${Math.max(0,Math.min(1,1-shade))})`;g.fillRect(cx,cy,g.canvas.width,g.canvas.height);g.restore();
}
export function drawCDiagnostic(g:CanvasRenderingContext2D,cx:number,cy:number){
 if(!bDiagnosticEnabled||!active.length)return;
 for(let i=active.length-1;i>=0;i--){const a=active[i];
  if(!a.frame)continue;const start=performance.now();
  if(gpuRequested&&!gpuFailed){try{if(!gpu)gpu=new CGpuComposite(g.canvas.width,g.canvas.height);gpu.render(g.canvas,a.frame.frame,a.frame.transform,cx,cy);
    g.save();g.setTransform(1,0,0,1,0,0);g.drawImage(gpu.canvas,0,0);g.restore();
   }catch(e){gpuFailed=true;console.warn('Experimental GPU C pass failed; falling back to CPU',e);}}
  if(!gpuRequested||gpuFailed){const box=worldRect(a.frame.transform,cx,cy,g.canvas.width,g.canvas.height);if(!box.w||!box.h)continue;
   const image=g.getImageData(box.x,box.y,box.w,box.h);compositeC(image.data,image.width,image.height,a.frame.frame,a.frame.transform,cx+box.x,cy+box.y);g.putImageData(image,box.x,box.y);}
  if(cDiagnosticTimings.length<1200)cDiagnosticTimings.push({id:a.source.id,time:a.frame.t,sourceMs:a.sourceMs,compositeMs:performance.now()-start});
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
