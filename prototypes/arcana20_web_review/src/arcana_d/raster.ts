/** Experimental internal D source-primitive raster, NOT a complete D19 A
 * renderer. No world pass, live-world warp, bloom or actor depth yet. */
import {batches as B,glSource as G} from './vendor.js';import type {DCommand} from './commands';
export class DRaster {
 readonly canvas:HTMLCanvasElement;private gl:WebGL2RenderingContext;private sprites:any;private ribbons:any;private polys:any;
 constructor(){this.canvas=document.createElement('canvas');this.canvas.width=480;this.canvas.height=270;const gl=this.canvas.getContext('webgl2',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL2 unavailable');this.gl=gl;const sprite=new G.Program(gl,B.SPRITE_VS,B.SPRITE_FS),ribbon=new G.Program(gl,B.RIBBON_VS,B.RIBBON_FS),poly=new G.Program(gl,B.POLY_VS,B.POLY_FS);this.sprites=new B.SpriteBatch(gl,sprite);this.ribbons=new B.RibbonBatch(gl,ribbon);this.polys=new B.PolyBatch(gl,poly);}
 render(commands:DCommand[],rendererTime:number){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,480,270);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);B.setBlend(gl,'add');
  for(const c of commands){if(c.kind==='sprite'){const o=c.opt;this.sprites.reset();this.sprites.push(Math.round(c.x),Math.round(c.y),Math.round(c.size),Math.round(c.size),o.rot??0,o.seed??(c.x*.173+c.y*.31),c.shape,o.hard??.9,c.color[0],c.color[1],c.color[2],c.color[3],o.glow??.3,o.edge??0,0,o.flags??0);this.sprites.draw([480,270],[0,0],rendererTime);}
   else if(c.kind==='line'){this.ribbons.reset();this.ribbons.push(c.points,c.width,c.color,c.opt);this.ribbons.draw([480,270],[0,0],rendererTime);}
   else if(c.kind==='poly'){this.polys.reset();this.polys.pushQuad(c.points,c.color,c.opt);this.polys.draw([480,270],[0,0],rendererTime);}
   // Bends affect the live-world warp field, not the additive light raster.
  }
 }
}
