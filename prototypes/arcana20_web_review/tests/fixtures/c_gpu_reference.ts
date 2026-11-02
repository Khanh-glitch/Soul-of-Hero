// Previous RGBA32F-influence compositor, preserved only for comparison.
/** Experimental WebGL2 C field compositor. Not a P0 parity claim. */
import { W,H,type Frame } from '../../src/arcana_c/engine/frame';
import type { BTransform } from '../../src/arcana_b/anchors';
const VS=`#version 300 es
in vec2 pos; void main(){gl_Position=vec4(pos,0.,1.);}`;
// Coordinate tie-break matches the diagnostic CPU compositor.
const FS=`#version 300 es
precision highp float; precision highp int;
uniform sampler2D scene; uniform sampler2D ink; uniform sampler2D ground; uniform sampler2D lights; uniform sampler2D disp; uniform sampler2D fragment; uniform sampler2D influence; uniform sampler2D liveIndex; uniform sampler2D liveOps;
uniform vec2 size; uniform vec2 camera; uniform vec4 basis; uniform vec2 origin;out vec4 outColor;
float bayer(ivec2 p){int m[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return(float(m[(p.y&3)*4+(p.x&3)])+.5)/16.;}
vec3 sceneAt(vec2 p){return texture(scene,vec2(clamp(p.x/size.x,0.,1.),clamp(1.-p.y/size.y,0.,1.))).rgb;}
vec3 worldAt(ivec2 point,ivec2 q,vec2 pixel){point=clamp(point,ivec2(0),ivec2(383,215));vec2 d=vec2(point-q);vec2 delta=vec2(basis.x*d.x+basis.z*d.y,basis.y*d.x+basis.w*d.y);return sceneAt(floor(pixel-vec2(.5)+delta+vec2(.0001))+vec2(.5));}
vec3 groundAt(ivec2 p,ivec2 q,vec2 pixel){p=clamp(p,ivec2(0),ivec2(383,215));vec4 mark=texelFetch(ground,p,0);return worldAt(p,q,pixel)*(1.-mark.a)+mark.rgb;}
vec3 lightAt(ivec2 p){return texelFetch(lights,clamp(p,ivec2(0),ivec2(383,215)),0).rgb;}
void main(){vec2 pixel=vec2(gl_FragCoord.x,size.y-gl_FragCoord.y),w=pixel-origin;vec3 original=sceneAt(pixel);float det=basis.x*basis.w-basis.y*basis.z;
 ivec2 q=ivec2(floor(vec2(basis.w*w.x-basis.z*w.y,-basis.y*w.x+basis.x*w.y)/det+vec2(.0001)));
 if(q.x<0||q.y<0||q.x>=384||q.y>=216||texelFetch(influence,q,0).r<.5){outColor=vec4(original,1);return;}
 vec4 d=texelFetch(disp,q,0);ivec2 sp=q+ivec2(floor(d.xy+.5));int shift=d.w>.2?int(ceil(d.w)):0;ivec2 o=ivec2(shift,0);
 vec3 g=vec3(groundAt(sp+o,q,pixel).r,groundAt(sp,q,pixel).g,groundAt(sp-o,q,pixel).b)*d.z;
 vec3 l=vec3(lightAt(q+o).r,lightAt(q).g,lightAt(q-o).b);
 vec2 liveRange=texelFetch(liveIndex,q,0).rg;int begin=int(liveRange.x),count=int(liveRange.y);
 for(int n=0;n<count;n++){int index=begin+n;vec3 op=texelFetch(liveOps,ivec2(index%384,index/384),0).rgb;l+=worldAt(ivec2(op.xy),q,pixel)*op.z;}
 vec4 i=texelFetch(ink,q,0),f=texelFetch(fragment,q,0);vec3 fr=worldAt(ivec2(f.xy),q,pixel);
 if(f.w>1.5)fr=vec3(1.)-fr*vec3(2.5,3.,2.);else if(f.w>.5)fr=clamp(vec3(1.)-fr*3.,0.,1.)*vec3(.45,.2,.5)+vec3(.2,0.,.15);
 vec3 col=g*max(0.,1.-i.a-f.z)+i.rgb+fr*f.z;float th=bayer(q)-.5;col+=floor(l*8.+th+.5)/8.;vec3 over=max(col-1.,0.);col+=vec3(over.r+over.g+over.b)*.45;
 outColor=vec4(clamp(col,0.,1.),1.);
}`;
export class CGpuComposite {
 readonly canvas:HTMLCanvasElement;lastProfile={sceneMs:0,packMs:0,fieldUploadMs:0,atlasPackMs:0,atlasUploadMs:0,submitMs:0,fieldsReused:false};private uploadedFrame:Frame|null=null;private uploadedRevision:number|undefined;private gl:WebGL2RenderingContext;private program:WebGLProgram;private textures:WebGLTexture[]=[];private packed:Float32Array[]=[];private liveIndex=new Float32Array(W*H*4);private liveOps=new Float32Array(W*4);private hadLive=false;private maxTextureSize:number;private atlasRows=1;
 constructor(width:number,height:number){
  this.canvas=document.createElement('canvas');this.canvas.width=width;this.canvas.height=height;
  const gl=this.canvas.getContext('webgl2',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL2 unavailable');this.gl=gl;
  const compile=(kind:number,src:string)=>{const sh=gl.createShader(kind)!;gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||'shader');return sh;};
  const program=gl.createProgram()!;gl.attachShader(program,compile(gl.VERTEX_SHADER,VS));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'link');this.program=program;gl.useProgram(program);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'pos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  for(let n=0;n<9;n++){const tex=gl.createTexture()!;this.textures.push(tex);gl.activeTexture(gl.TEXTURE0+n);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(program,['scene','ink','ground','lights','disp','fragment','influence','liveIndex','liveOps'][n]),n);if(n && n<7)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,W,H,0,gl.RGBA,gl.FLOAT,null);if(n===7)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,W,H,0,gl.RGBA,gl.FLOAT,null);if(n===8)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,W,1,0,gl.RGBA,gl.FLOAT,null);}
  this.packed=[new Float32Array(W*H*4),new Float32Array(W*H*4)];this.maxTextureSize=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  gl.disable(gl.BLEND);gl.disable(gl.DITHER);gl.viewport(0,0,width,height);
 }
 render(scene:HTMLCanvasElement,f:Frame,m:BTransform,cx:number,cy:number,revision?:number){
  const begin=performance.now();const gl=this.gl;gl.useProgram(this.program);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[0]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,scene);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);
  const sceneEnd=performance.now();const [ground,influence]=this.packed;
  // A caller supplying a revision guarantees the same Frame is immutable until
  // that revision changes. Do not cache across frames or unversioned callers.
  const fieldsReused=revision!==undefined&&this.uploadedFrame===f&&this.uploadedRevision===revision;
  let packEnd=sceneEnd,fieldEnd=sceneEnd,atlasPackEnd=sceneEnd,uploadEnd=sceneEnd;
  if(!fieldsReused){this.uploadedFrame=null;
  for(let p=0;p<W*H;p++){const i=p*4;ground[i]=f.ground[i]/255;ground[i+1]=f.ground[i+1]/255;ground[i+2]=f.ground[i+2]/255;ground[i+3]=f.groundCoverage[p];influence[i]=f.worldInfluence[p];}
  packEnd=performance.now();const fields=[f.ink,ground,f.light,f.disp,f.worldFragment,influence];
  for(let n=1;n<7;n++){gl.activeTexture(gl.TEXTURE0+n);gl.bindTexture(gl.TEXTURE_2D,this.textures[n]);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,W,H,gl.RGBA,gl.FLOAT,fields[n-1]);}
  fieldEnd=performance.now();
  // Compressed ordered atlas: no arbitrary overlap cap; fail to CPU if the
  // device cannot hold the complete operation list.
  const indices=this.liveIndex;if(this.hadLive)indices.fill(0);this.hadLive=f.liveLight.size>0;
  let count=0;for(const [p,ops] of f.liveLight){indices[p*4]=count;indices[p*4+1]=ops.length;count+=ops.length;}
  const rows=Math.max(1,Math.ceil(count/W));if(rows>this.maxTextureSize)throw new Error('Live-light atlas exceeds device limit');
  if(this.liveOps.length<W*rows*4)this.liveOps=new Float32Array(W*rows*4);const opsData=this.liveOps;
  let at=0;for(const ops of f.liveLight.values())for(const op of ops){opsData[at++]=op.sx;opsData[at++]=op.sy;opsData[at++]=op.gain;at++;}
  atlasPackEnd=performance.now();for(const [n,width,height,data] of [[7,W,H,indices],[8,W,rows,opsData]] as const){gl.activeTexture(gl.TEXTURE0+n);gl.bindTexture(gl.TEXTURE_2D,this.textures[n]);if(n===8&&rows>this.atlasRows){this.atlasRows=rows;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,W,rows,0,gl.RGBA,gl.FLOAT,null);}gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,height,gl.RGBA,gl.FLOAT,data);}
  uploadEnd=performance.now();this.uploadedFrame=revision===undefined?null:f;this.uploadedRevision=revision;}gl.uniform2f(gl.getUniformLocation(this.program,'size'),this.canvas.width,this.canvas.height);gl.uniform2f(gl.getUniformLocation(this.program,'camera'),cx,cy);gl.uniform4f(gl.getUniformLocation(this.program,'basis'),m.a,m.b,m.c,m.d);gl.uniform2f(gl.getUniformLocation(this.program,'origin'),m.x-cx,m.y-cy);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);const submitEnd=performance.now();this.lastProfile={sceneMs:sceneEnd-begin,packMs:packEnd-sceneEnd,fieldUploadMs:fieldEnd-packEnd,atlasPackMs:atlasPackEnd-fieldEnd,atlasUploadMs:uploadEnd-atlasPackEnd,submitMs:submitEnd-uploadEnd,fieldsReused};
 }
}
