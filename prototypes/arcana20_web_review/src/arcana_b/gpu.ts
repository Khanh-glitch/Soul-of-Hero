/** Experimental WebGL2 B field compositor. Not a P0 parity claim. */
import { W,H,type Renderer } from './engine/renderer';
import type { BTransform } from './anchors';
const VS=`#version 300 es
in vec2 pos; void main(){gl_Position=vec4(pos,0.,1.);}`;
const FS=`#version 300 es
precision highp float; precision highp int;
uniform sampler2D scene; uniform sampler2D ink; uniform sampler2D ground; uniform sampler2D lightShade; uniform sampler2D warp;
uniform vec2 size; uniform vec2 camera; uniform vec4 basis; uniform vec2 origin; uniform vec3 ambientTint;
out vec4 outColor;
float bayer(ivec2 p) { int m[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(m[(p.y&3)*4+(p.x&3)])+.5)/16.; }
vec3 tone(vec3 c,ivec2 p) { float mx=max(c.r,max(c.g,c.b));float ex=mx>1.1?(mx-1.1)*.32:0.;vec3 v=1.-exp(-(c+ex)*1.05);return floor(clamp(v*20.+(bayer(p)-.5),0.,20.))/20.; }
vec3 sceneAt(vec2 p){return texture(scene,vec2(clamp(p.x/size.x,0.,1.),clamp(1.-p.y/size.y,0.,1.))).rgb;}
void main(){
 vec2 pixel=vec2(gl_FragCoord.x,size.y-gl_FragCoord.y);vec3 original=sceneAt(pixel);vec2 w=pixel+camera-origin;
 float det=basis.x*basis.w-basis.y*basis.z;
 vec2 src=vec2(basis.w*w.x-basis.z*w.y,-basis.y*w.x+basis.x*w.y)/det;
 ivec2 p=ivec2(floor(src));if(p.x<0||p.y<0||p.x>=384||p.y>=216){outColor=vec4(original,1);return;}
 vec4 wi=texelFetch(warp,p,0);if(wi.a<.5){outColor=vec4(original,1);return;}
 ivec2 sp=clamp(p+ivec2(wi.xy),ivec2(0),ivec2(383,215));vec2 d=vec2(sp-p);
 vec2 delta=vec2(basis.x*d.x+basis.z*d.y,basis.y*d.x+basis.w*d.y);
 vec3 warped=sceneAt(floor(pixel-vec2(.5)+delta)+vec2(.5));vec4 decal=texelFetch(ground,sp,0),lighting=texelFetch(lightShade,sp,0),i=texelFetch(ink,p,0);
 vec3 surface=warped*(1.-decal.a)+decal.rgb;
 vec3 authored=i.rgb+surface*lighting.a*(ambientTint+lighting.rgb)*(1.-i.a);
 outColor=vec4(clamp(original+tone(authored,p)-tone(original*ambientTint,p),0.,1.),1.);
}`;
export class BGpuComposite {
 readonly canvas:HTMLCanvasElement;private gl:WebGL2RenderingContext;private program:WebGLProgram;private textures:WebGLTexture[]=[];private packed:Float32Array[]=[];
 constructor(width:number,height:number){
  this.canvas=document.createElement('canvas');this.canvas.width=width;this.canvas.height=height;
  const gl=this.canvas.getContext('webgl2',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL2 unavailable');this.gl=gl;
  const compile=(kind:number,src:string)=>{const sh=gl.createShader(kind)!;gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||'shader');return sh;};
  const program=gl.createProgram()!;gl.attachShader(program,compile(gl.VERTEX_SHADER,VS));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'link');this.program=program;gl.useProgram(program);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'pos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  for(let n=0;n<5;n++){const tex=gl.createTexture()!;this.textures.push(tex);gl.activeTexture(gl.TEXTURE0+n);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(program,['scene','ink','ground','lightShade','warp'][n]),n);if(n) this.packed.push(new Float32Array(W*H*4));}
  gl.disable(gl.BLEND);gl.disable(gl.DITHER);gl.viewport(0,0,width,height);
 }
 render(scene:HTMLCanvasElement,r:Renderer,m:BTransform,cx:number,cy:number){
  const gl=this.gl;gl.useProgram(this.program);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[0]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,scene);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);
  const [ink,ground,light,warp]=this.packed;
  for(let p=0;p<W*H;p++){const i=p*4,j=p*3;ink[i]=r.main[j];ink[i+1]=r.main[j+1];ink[i+2]=r.main[j+2];ink[i+3]=r.inkCoverage[p];ground[i]=r.alb[j];ground[i+1]=r.alb[j+1];ground[i+2]=r.alb[j+2];ground[i+3]=r.decalCoverage[p];light[i]=r.lightBuf[j];light[i+1]=r.lightBuf[j+1];light[i+2]=r.lightBuf[j+2];light[i+3]=r.shade[p];warp[i]=r.worldWarp[p*2];warp[i+1]=r.worldWarp[p*2+1];warp[i+2]=0;warp[i+3]=r.worldInfluence[p];}
  for(let n=1;n<5;n++){gl.activeTexture(gl.TEXTURE0+n);gl.bindTexture(gl.TEXTURE_2D,this.textures[n]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,W,H,0,gl.RGBA,gl.FLOAT,this.packed[n-1]);}
  gl.uniform2f(gl.getUniformLocation(this.program,'size'),this.canvas.width,this.canvas.height);gl.uniform2f(gl.getUniformLocation(this.program,'camera'),cx,cy);gl.uniform4f(gl.getUniformLocation(this.program,'basis'),m.a,m.b,m.c,m.d);gl.uniform2f(gl.getUniformLocation(this.program,'origin'),m.x,m.y);gl.uniform3f(gl.getUniformLocation(this.program,'ambientTint'),r.ambient*r.tint[0],r.ambient*r.tint[1],r.ambient*r.tint[2]);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
}
