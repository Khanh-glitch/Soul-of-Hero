/** Experimental internal D source-primitive raster, NOT a complete D19 A
 * renderer. No world pass, live-world warp, bloom or actor depth yet. */
import {batches as B,glSource as G} from './vendor.js';import type {DCommand} from './commands';
export class DRaster {
 readonly canvas:HTMLCanvasElement;private gl:WebGL2RenderingContext;private sprites:any;private ribbons:any;private polys:any;
 constructor(){this.canvas=document.createElement('canvas');this.canvas.width=480;this.canvas.height=270;const gl=this.canvas.getContext('webgl2',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL2 unavailable');this.gl=gl;const sprite=new G.Program(gl,B.SPRITE_VS,B.SPRITE_FS),ribbon=new G.Program(gl,B.RIBBON_VS,B.RIBBON_FS),poly=new G.Program(gl,B.POLY_VS,B.POLY_FS);this.sprites=new B.SpriteBatch(gl,sprite);this.ribbons=new B.RibbonBatch(gl,ribbon);this.polys=new B.PolyBatch(gl,poly);}
 /** Adjacent-only batches retain command ordering. Select batch=none to compare
  * the prior one-draw-per-command raster on identical fields. */
 render(commands:DCommand[],rendererTime:number,batch:'none'|'sprites'|'all'='none'){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,480,270);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);B.setBlend(gl,'add');
  let current:'sprite'|'line'|'poly'|null=null,draws=0;
  const selected=()=>current==='sprite'?this.sprites:current==='line'?this.ribbons:this.polys;
  const flush=()=>{if(current){const x=selected();x.draw([480,270],[0,0],rendererTime);x.reset();draws++;current=null;}};
  for(const c of commands){if(c.kind==='bend')continue;
   if(current!==c.kind)flush();
   if(current){const x=selected(),need=c.kind==='sprite'?1:c.kind==='line'?c.points.length+3:4,limit=c.kind==='sprite'?x.cap:c.kind==='line'?x.data.length/x.stride:x.cap*4;if(x.count+need>limit)flush();}
   if(!current)current=c.kind;
   if(c.kind==='sprite'){const o=c.opt;this.sprites.push(Math.round(c.x),Math.round(c.y),Math.round(c.size),Math.round(c.size),o.rot??0,o.seed??(c.x*.173+c.y*.31),c.shape,o.hard??.9,c.color[0],c.color[1],c.color[2],c.color[3],o.glow??.3,o.edge??0,0,o.flags??0);}
   else if(c.kind==='line')this.ribbons.push(c.points,c.width,c.color,c.opt);
   else this.polys.pushQuad(c.points,c.color,c.opt);
   if(batch==='none'||(batch==='sprites'&&c.kind!=='sprite'))flush();
  }
  flush();return {draws};
 }
}
