// WebGL2 compositor: fuses the CPU pixel layers, applies displacement, dithered light quantisation,
// white-hot overflow, two-level HDR bloom, and global camera effects. Upscales with hard pixels.
import { W, H, type Frame } from './frame';

export type Post = {
  shake: [number, number];
  flash: [number, number, number];
  invert: number;
  chroma: number;
  desat: number;
  bloom: number;
};

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uGround, uInk, uLight, uDisp;
uniform vec2 uShake; uniform float uInvert, uChroma, uDesat; uniform vec3 uFlash;
out vec4 o;
const int W=${W}, H=${H};
float bayer(ivec2 p){
  int i = (p.y & 3) * 4 + (p.x & 3);
  int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
  return (float(m[i]) + 0.5) / 16.0;
}
vec3 G(ivec2 p){ p = clamp(p, ivec2(0), ivec2(W-1,H-1)); return texelFetch(uGround,p,0).rgb; }
vec3 Lt(ivec2 p){ p = clamp(p, ivec2(0), ivec2(W-1,H-1)); return texelFetch(uLight,p,0).rgb; }
void main(){
  ivec2 f = ivec2(gl_FragCoord.xy);
  ivec2 q = ivec2(f.x, H-1-f.y) - ivec2(uShake);
  q = clamp(q, ivec2(0), ivec2(W-1,H-1));
  vec4 d = texelFetch(uDisp, q, 0);
  ivec2 sp = q + ivec2(floor(d.xy + 0.5));
  float ch = d.w + uChroma;
  vec3 g; vec3 L;
  if (ch > 0.2) {
    ivec2 o2 = ivec2(int(ceil(ch)), 0);
    g = vec3(G(sp+o2).r, G(sp).g, G(sp-o2).b);
    L = vec3(Lt(q+o2).r, Lt(q).g, Lt(q-o2).b);
  } else { g = G(sp); L = Lt(q); }
  g *= d.z;
  float lum = dot(g, vec3(0.3,0.55,0.15));
  g = mix(g, vec3(lum)*vec3(0.85,0.95,1.15), uDesat);
  vec4 ink = texelFetch(uInk, q, 0);
  vec3 col = g * (1.0 - ink.a) + ink.rgb;
  float th = bayer(q) - 0.5;
  vec3 Lq = floor(L * 8.0 + th + 0.5) / 8.0;
  col += Lq;
  vec3 over = max(col - 1.0, 0.0);
  col += vec3(over.r + over.g + over.b) * 0.45;
  col = clamp(col, 0.0, 1.0);
  col = mix(col, vec3(1.0) - col.gbr, uInvert);
  col = clamp(col + uFlash, 0.0, 1.0);
  o = vec4(col, 1.0);
}`;

const DOWN_LIGHT = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform sampler2D uComp; out vec4 o;
const int H=${H};
void main(){
  ivec2 f = ivec2(gl_FragCoord.xy) * 4;
  vec3 s = vec3(0.);
  for (int y=0;y<4;y++) for (int x=0;x<4;x++){
    ivec2 p = f + ivec2(x,y);
    vec3 l = max(texelFetch(uSrc, ivec2(p.x, H-1-p.y), 0).rgb, 0.0);
    vec3 c = texelFetch(uComp, p, 0).rgb;
    s += l * 0.55 + max(c - 0.96, 0.0) * 0.4;
  }
  o = vec4(s / 16.0, 1.);
}`;

const DOWN2 = `#version 300 es
precision highp float;
uniform sampler2D uSrc; out vec4 o;
void main(){
  ivec2 f = ivec2(gl_FragCoord.xy) * 2;
  vec3 s = texelFetch(uSrc,f,0).rgb + texelFetch(uSrc,f+ivec2(1,0),0).rgb + texelFetch(uSrc,f+ivec2(0,1),0).rgb + texelFetch(uSrc,f+ivec2(1,1),0).rgb;
  o = vec4(s*0.25,1.);
}`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uDir; out vec4 o;
void main(){
  ivec2 f = ivec2(gl_FragCoord.xy);
  ivec2 sz = textureSize(uSrc,0);
  float w[5] = float[5](0.227, 0.194, 0.121, 0.054, 0.016);
  vec3 s = texelFetch(uSrc,f,0).rgb * w[0];
  for (int i=1;i<5;i++){
    ivec2 d = ivec2(uDir) * i;
    s += texelFetch(uSrc, clamp(f+d, ivec2(0), sz-1), 0).rgb * w[i];
    s += texelFetch(uSrc, clamp(f-d, ivec2(0), sz-1), 0).rgb * w[i];
  }
  o = vec4(s,1.);
}`;

const FINAL = `#version 300 es
precision highp float;
uniform sampler2D uComp, uB1, uB2; uniform vec4 uRect; uniform float uBloom; out vec4 o;
const float W=${W}.0, H=${H}.0;
void main(){
  vec2 uv = (gl_FragCoord.xy - uRect.xy) / uRect.zw;
  if (uv.x < 0. || uv.y < 0. || uv.x >= 1. || uv.y >= 1.) { o = vec4(0.012,0.010,0.02,1.); return; }
  ivec2 p = ivec2(floor(uv * vec2(W,H)));
  vec3 c = texelFetch(uComp, p, 0).rgb;
  vec2 buv = (vec2(p) + 0.5) / vec2(W,H);
  vec3 b = texture(uB1, buv).rgb * 0.5 + texture(uB2, buv).rgb * 0.42;
  c += b * uBloom;
  vec2 v = uv - 0.5; v.x *= W/H;
  c *= 1.0 - 0.38 * pow(clamp(length(v) * 0.95, 0., 1.), 2.6);
  o = vec4(clamp(c,0.,1.), 1.);
}`;

function compile(gl: WebGL2RenderingContext, fs: string) {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
  return p;
}

export class Compositor {
  gl: WebGL2RenderingContext;
  progs: Record<string, WebGLProgram> = {};
  tex: Record<string, WebGLTexture> = {};
  fbo: Record<string, { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }> = {};
  hdr = false;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.hdr = !!gl.getExtension('EXT_color_buffer_float');
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.progs = { comp: compile(gl, COMPOSITE), down: compile(gl, DOWN_LIGHT), down2: compile(gl, DOWN2), blur: compile(gl, BLUR), final: compile(gl, FINAL) };
    for (const k of ['ground', 'ink', 'light', 'disp']) this.tex[k] = this.mkTex();
    this.fbo.comp = this.mkFbo(W, H, false, false);
    this.fbo.b1a = this.mkFbo(W / 4, H / 4, this.hdr, true);
    this.fbo.b1b = this.mkFbo(W / 4, H / 4, this.hdr, true);
    this.fbo.b2a = this.mkFbo(W / 8, H / 8, this.hdr, true);
    this.fbo.b2b = this.mkFbo(W / 8, H / 8, this.hdr, true);
  }
  private mkTex() {
    const gl = this.gl, t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  private mkFbo(w: number, h: number, hdr: boolean, linear: boolean) {
    const gl = this.gl, tex = this.mkTex();
    w = Math.floor(w); h = Math.floor(h);
    if (linear) { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); }
    if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex, w, h };
  }
  private bindTex(unit: number, t: WebGLTexture, prog: WebGLProgram, name: string) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }
  private target(name: string | null) {
    const gl = this.gl;
    if (name) { const f = this.fbo[name]; gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb); gl.viewport(0, 0, f.w, f.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height); }
  }

  render(f: Frame, post: Post) {
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.ground);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, f.ground);
    for (const k of ['ink', 'light', 'disp'] as const) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex[k]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, f[k]);
    }
    // composite
    let p = this.progs.comp; gl.useProgram(p); this.target('comp');
    this.bindTex(0, this.tex.ground, p, 'uGround'); this.bindTex(1, this.tex.ink, p, 'uInk');
    this.bindTex(2, this.tex.light, p, 'uLight'); this.bindTex(3, this.tex.disp, p, 'uDisp');
    gl.uniform2f(gl.getUniformLocation(p, 'uShake'), Math.round(post.shake[0]), Math.round(post.shake[1]));
    gl.uniform1f(gl.getUniformLocation(p, 'uInvert'), post.invert);
    gl.uniform1f(gl.getUniformLocation(p, 'uChroma'), post.chroma);
    gl.uniform1f(gl.getUniformLocation(p, 'uDesat'), post.desat);
    gl.uniform3f(gl.getUniformLocation(p, 'uFlash'), ...post.flash);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // bloom level 1
    p = this.progs.down; gl.useProgram(p); this.target('b1a');
    this.bindTex(0, this.tex.light, p, 'uSrc'); this.bindTex(1, this.fbo.comp.tex, p, 'uComp');
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.blur('b1a', 'b1b');
    // bloom level 2
    p = this.progs.down2; gl.useProgram(p); this.target('b2a');
    this.bindTex(0, this.fbo.b1a.tex, p, 'uSrc');
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.blur('b2a', 'b2b');
    // final
    p = this.progs.final; gl.useProgram(p); this.target(null);
    const cw = this.canvas.width, ch = this.canvas.height;
    const fit = Math.min(cw / W, ch / H);
    const s = Math.floor(fit) >= 2 && Math.floor(fit) / fit > 0.86 ? Math.floor(fit) : fit;
    const rw = W * s, rh = H * s;
    gl.uniform4f(gl.getUniformLocation(p, 'uRect'), Math.floor((cw - rw) / 2), Math.floor((ch - rh) / 2), rw, rh);
    gl.uniform1f(gl.getUniformLocation(p, 'uBloom'), post.bloom);
    this.bindTex(0, this.fbo.comp.tex, p, 'uComp'); this.bindTex(1, this.fbo.b1a.tex, p, 'uB1'); this.bindTex(2, this.fbo.b2a.tex, p, 'uB2');
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  private blur(a: string, b: string) {
    const gl = this.gl, p = this.progs.blur;
    gl.useProgram(p);
    this.target(b); this.bindTex(0, this.fbo[a].tex, p, 'uSrc');
    gl.uniform2f(gl.getUniformLocation(p, 'uDir'), 1, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.target(a); this.bindTex(0, this.fbo[b].tex, p, 'uSrc');
    gl.uniform2f(gl.getUniformLocation(p, 'uDir'), 0, 1); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
