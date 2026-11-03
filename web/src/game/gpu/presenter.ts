// ============================================================================
// Single WebGL2 presenter — the ONE GPU owner of the final frame.
// (AVFX M1, 2026-11-03 — Control Tower work order, issue #37 comment 6595373012)
//
// Architecture: the game keeps its Canvas2D world/actor producer (offscreen
// 640x360 canvas, unchanged gameplay rendering incl. PixelFX Canvas2D passes).
// Each frame the presenter performs exactly ONE world texture upload, runs the
// frame graph (world + submitted VFX GPU layers), then ONE final post pass
// before presenting. React HUD is DOM and stays outside the GPU post.
// Zero VFX submissions => passthrough post => byte-identical frame.
// ============================================================================

export interface RiftParams { wt: Float32Array; pull: number; span: number; flash: number }
export interface PresentedLayer {
  clientId: string;
  kind: 'd19' | 'rift' | 'glow' | 'blit';
  rift?: RiftParams;
  lightTex: WebGLTexture;          // 480x270 RGBA8 additive source field
  warp: Float32Array;              // 480*270*4 RGBA32F CPU warp field
  influence: Uint8Array;           // 480*270 coverage mask
  region: { x: number; y: number; w: number; h: number }; // screen-space rect of source window
  blocksDst?: Float32Array;  // blit layer: 56*4 (px,py,sz,active) in region-local px
  blocksHome?: Float32Array; // blit layer: 56*2 (hx,hy) in region-local px
  fade: number; bloomGain: number; time: number; tick: number; seed: number;
}

const PASSTHROUGH_FS = `#version 300 es
precision highp float;
uniform sampler2D world; uniform vec2 size;
out vec4 color;
void main(){
  vec2 uv = vec2(gl_FragCoord.x / size.x, 1.0 - gl_FragCoord.y / size.y);
  color = vec4(texture(world, uv).rgb, 1.0);
}`;

// Material-aware D19 world response (replaces the Gold lab-floor tone-delta
// that produced hard bands on bright terrain): bounded refractive UV warp +
// chromatic split + source-local absorb, a BOUNDED material-relative shimmer
// (scaled by luminance headroom so bright terrain cannot clip into stripes),
// and linear additive emission from the source light field.
const COMPOSITE_FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D scene; uniform sampler2D light; uniform sampler2D warp;
uniform highp usampler2D influence;
uniform vec2 size;            // 640x360 screen
uniform vec4 region;          // screen-space source window (x,y,w,h)
uniform float fade, bloomGain, time;
out vec4 color;
vec3 sceneAt(vec2 px){ vec2 uv = vec2(px.x/size.x, 1.0 - px.y/size.y); return texture(scene, uv).rgb; }
void main(){
  vec2 pixel = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec3 base = sceneAt(pixel);
  vec2 sp = (pixel - region.xy) / region.zw * vec2(480.0, 270.0);
  if (sp.x < 0.0 || sp.y < 0.0 || sp.x >= 480.0 || sp.y >= 270.0) { color = vec4(base, 1.0); return; }
  ivec2 p = ivec2(sp);
  if (texelFetch(influence, p, 0).r == 0u) { color = vec4(base, 1.0); return; }
  vec4 v = texelFetch(warp, p, 0) * clamp(fade, 0.0, 1.0);
  vec2 off = -v.xy * 0.5;                                   // bounded refractive UV warp
  vec3 w = vec3(sceneAt(pixel + off * 1.35).r, sceneAt(pixel + off).g, sceneAt(pixel + off * 0.65).b); // chromatic
  w *= 1.0 - clamp(v.z, 0.0, 0.985);                        // source-local absorb field (kept from source)
  float lum = dot(w, vec3(0.2126, 0.7152, 0.0722));
  // bounded material-relative shimmer: oscillation applied with luminance headroom
  float osc = v.w * 0.06 * sin((1.0 - sp.y / 270.0) * 180.0 + time * 8.0);
  w += osc * w * (1.0 - lum) * lum * 4.0;                   // cannot clip bright terrain into bands
  w += texelFetch(light, p, 0).rgb * bloomGain * clamp(fade, 0.0, 1.0); // linear additive emission
  color = vec4(clamp(w, 0.0, 1.0), 1.0);
}`;

// ARCANA #20 rift: bounded A-style world pull toward a C contour tear, chromatic
// split, void interior with mirrored "other space" sample, astral rim, collision
// flash, and per-segment restitch (width profile closes over time -> terrain restores).
const RIFT_FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D scene; uniform sampler2D field; // RGBA32F: s, d(signed), nx, ny
uniform vec2 size; uniform vec4 region; uniform float t, pull, span, flash;
uniform float wt[257];
out vec4 color;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
void main(){
  vec2 pixel = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec3 base = texture(scene, vec2(pixel.x/size.x, 1.0 - pixel.y/size.y)).rgb;
  vec2 sp = (pixel - region.xy) / region.zw * vec2(480.0, 270.0);
  if (sp.x < 0.0 || sp.y < 0.0 || sp.x >= 480.0 || sp.y >= 270.0) { color = vec4(base, 1.0); return; }
  vec4 f = texelFetch(field, ivec2(sp), 0);
  float s = f.x;
  if (s < 0.0) { color = vec4(base, 1.0); return; }
  float d = f.y, ad = abs(d);
  vec2 n = vec2(f.z, f.w) * (d >= 0.0 ? 1.0 : -1.0);
  float w = wt[int(clamp(s, 0.0, 1.0) * 256.0)];
  float dist = ad - w;
  vec2 off = vec2(0.0);
  float bright = 1.0;
  if (w > 0.0 && ad < 44.0) {
    float pullAmt = pull * 46.0 * exp(-max(dist, 0.0) / 34.0);
    off = -n * pullAmt * (region.zw / vec2(480.0, 270.0));
    bright = 1.0 + 1.6 * exp(-max(dist, 0.0) / 3.0);
  }
  vec2 suv = (pixel + off) / size;
  suv = vec2(clamp(suv.x, 0.0, 1.0), clamp(1.0 - suv.y, 0.0, 1.0));
  vec3 col = vec3(texture(scene, suv + vec2(0.0025, 0.0)).r,
                  texture(scene, suv).g,
                  texture(scene, suv - vec2(0.0025, 0.0)).b) * bright;
  if (w > 0.0 && ad < w) {
    float nz = vnoise(sp * 0.05 + vec2(t * 0.25, 0.0));
    vec3 voidCol = mix(vec3(0.02, 0.01, 0.05), vec3(0.10, 0.03, 0.20), clamp(0.12 + (sp.y / 270.0) * 0.2, 0.0, 1.0));
    vec3 other = texture(scene, vec2(clamp(1.0 - suv.x, 0.0, 1.0), clamp(suv.y + d * 0.002, 0.0, 1.0))).rgb;
    col = mix(voidCol, other * 0.35, nz > 0.62 ? 0.5 : 0.0);
    col += vec3(1.0, 0.96, 1.0) * step(0.985, hash(vec2(floor(s * 120.0) + t * 10.0, sp.y))) * 0.7;
    col += vec3(0.45, 0.95, 1.0) * 0.35 * step(0.965, hash(vec2(floor((sp.x + t * 26.0) / 2.0), floor((sp.y + t * 6.0) / 2.0))));
  } else if (w > 0.5 && ad < w + 1.6) {
    col = mix(col, vec3(1.0, 0.35, 0.85), 0.9) + vec3(0.45, 0.95, 1.0) * 0.6;
  }
  if (t < 3.0 && ad < 1.2 && abs(s - 0.5) <= span * 0.5) col += vec3(1.6, 1.6, 1.8) * 0.8;
  col += vec3(1.0, 0.5, 1.0) * flash;
  color = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// world-sampled fragment layer: copies REAL world pixels (pre-warp world tex)
// to displaced positions (source f.blitBase) and punches void holes at homes
const BLIT_FS = `#version 300 es
precision highp float;
uniform sampler2D scene; uniform sampler2D world;
uniform vec2 size; uniform vec4 region;
uniform vec4 u_dst[56];  // px, py, sz, active
uniform vec2 u_home[56]; // hx, hy
uniform int u_nblocks;
out vec4 color;
void main(){
  vec2 pixel = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec3 col = texture(scene, vec2(pixel.x/size.x, 1.0 - pixel.y/size.y)).rgb;
  vec2 sp = (pixel - region.xy) / region.zw * vec2(480.0, 270.0);
  if (sp.x >= 0.0 && sp.y >= 0.0 && sp.x < 480.0 && sp.y < 270.0) {
    for (int i = 0; i < 56; i++) {
      if (i >= u_nblocks) break;
      vec4 d = u_dst[i]; vec2 h = u_home[i];
      if (d.w > 0.5 && sp.x >= h.x && sp.x < h.x + d.z && sp.y >= h.y && sp.y < h.y + d.z)
        col = vec3(0.02, 0.01, 0.05); // the hole left in the world
    }
    for (int i = 0; i < 56; i++) {
      if (i >= u_nblocks) break;
      vec4 d = u_dst[i]; vec2 h = u_home[i];
      if (d.w > 0.5 && sp.x >= d.x && sp.x < d.x + d.z && sp.y >= d.y && sp.y < d.y + d.z) {
        vec2 src = vec2(region.x + h.x + (sp.x - d.x), region.y + h.y + (sp.y - d.y));
        col = texture(world, vec2(src.x/size.x, 1.0 - src.y/size.y)).rgb; // torn-out piece of THIS world
      }
    }
  }
  color = vec4(col, 1.0);
}`;

// additive emission layer (source VFX companion content: geometry, debris, particles)
const ADD_FS = `#version 300 es
precision highp float;
uniform sampler2D scene; uniform sampler2D light;
uniform vec2 size; uniform vec4 region; uniform float gain;
out vec4 color;
void main(){
  vec2 pixel = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec3 base = texture(scene, vec2(pixel.x/size.x, 1.0 - pixel.y/size.y)).rgb;
  vec2 sp = (pixel - region.xy) / region.zw;
  vec3 l = vec3(0.0);
  if (sp.x >= 0.0 && sp.y >= 0.0 && sp.x <= 1.0 && sp.y <= 1.0)
    l = texture(light, vec2(sp.x, 1.0 - sp.y)).rgb * gain;
  color = vec4(clamp(base + l, 0.0, 1.0), 1.0);
}`;

const VS = `#version 300 es
in vec2 pos; void main(){ gl_Position = vec4(pos, 0.0, 1.0); }`;

export class Presenter {
  readonly canvas: HTMLCanvasElement;
  /** null when WebGL2 is unavailable (e.g. GPU-less sandbox): the presenter then
   *  falls back to an exact 2D blit of the producer — still ONE owner of output,
   *  still zero-cast pixel-identical; GPU frame graph activates where WebGL2 exists. */
  readonly gl: WebGL2RenderingContext | null;
  readonly mode: 'webgl2' | '2d-fallback';
  private blit: CanvasRenderingContext2D | null = null;
  /** offscreen Canvas2D world producer — gameplay renders here (unchanged) */
  readonly worldCanvas: HTMLCanvasElement;
  private worldCtx: CanvasRenderingContext2D;
  private worldTex!: WebGLTexture;
  private lightFbo!: WebGLFramebuffer; private lightTex!: WebGLTexture;
  private progPass!: WebGLProgram; private progComp!: WebGLProgram; private progRift!: WebGLProgram; private progAdd!: WebGLProgram; private progBlit!: WebGLProgram;
  private buf!: WebGLBuffer;
  private warpTex!: WebGLTexture; private inflTex!: WebGLTexture;
  private accumA!: WebGLFramebuffer; private accumATex!: WebGLTexture;
  private accumB!: WebGLFramebuffer; private accumBTex!: WebGLTexture;
  // real per-frame metrics (distinguished by kind)
  postCount = 0; worldUploads = 0; layerUploads = 0; gpuPasses = 0; postCalls = 0; sourceDraws = 0;
  lastGlError = 0; fboStatus = '';
  private lost = false;

  constructor(canvas: HTMLCanvasElement, w: number, h: number) {
    this.canvas = canvas;
    canvas.width = w; canvas.height = h;
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false,
    });
    if (!gl) {
      // bounded fallback probe: record and degrade to exact 2D blit (game stays playable)
      this.gl = null; this.mode = '2d-fallback';
      this.blit = canvas.getContext('2d');
      this.worldCanvas = document.createElement('canvas');
      this.worldCanvas.width = w; this.worldCanvas.height = h;
      const wc = this.worldCanvas.getContext('2d', { willReadFrequently: true })!;
      this.worldCtx = wc; this.worldCtx.imageSmoothingEnabled = false;
      (this as any).worldTex = null; (this as any).lightTex = null; (this as any).warpTex = null; (this as any).inflTex = null;
      (this as any).lightFbo = null; (this as any).progPass = null; (this as any).progComp = null; (this as any).buf = null;
      return;
    }
    this.mode = 'webgl2';
    this.gl = gl;
    this.worldCanvas = document.createElement('canvas');
    this.worldCanvas.width = w; this.worldCanvas.height = h;
    const wc = this.worldCanvas.getContext('2d', { willReadFrequently: true });
    if (!wc) throw new Error('2D producer unavailable');
    this.worldCtx = wc; this.worldCtx.imageSmoothingEnabled = false;

    this.progPass = this.compile(PASSTHROUGH_FS);
    this.progComp = this.compile(COMPOSITE_FS);
    this.progRift = this.compile(RIFT_FS);
    this.progAdd = this.compile(ADD_FS);
    this.progBlit = this.compile(BLIT_FS);
    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const mkTex = (filter: number) => { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    this.worldTex = mkTex(gl.NEAREST);
    this.lightTex = mkTex(gl.NEAREST);
    this.warpTex = mkTex(gl.NEAREST);
    this.inflTex = mkTex(gl.NEAREST);
    this.lightFbo = gl.createFramebuffer()!;
    gl.bindTexture(gl.TEXTURE_2D, this.lightTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 480, 270, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.lightTex, 0);
    this.fboStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE ? 'light:COMPLETE' : 'light:INCOMPLETE';
    // scene accumulator ping-pong (RGBA8, screen size) for genuine multi-layer compositing
    const mkAccum = () => {
      const tex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fbo, tex, ok };
    };
    const A = mkAccum(), B = mkAccum();
    this.accumA = A.fbo; this.accumATex = A.tex; this.accumB = B.fbo; this.accumBTex = B.tex;
    this.fboStatus += (A.ok && B.ok ? ' accum:COMPLETE' : ' accum:INCOMPLETE');
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);

    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.rebuild(); });
  }

  /** Full GPU resource rebuild after context restoration (programs, textures, FBOs). */
  private rebuild() {
    const gl = this.gl; if (!gl) return;
    const w = this.canvas.width, h = this.canvas.height;
    this.progPass = this.compile(PASSTHROUGH_FS);
    this.progComp = this.compile(COMPOSITE_FS);
    this.progRift = this.compile(RIFT_FS);
    this.progAdd = this.compile(ADD_FS);
    this.progBlit = this.compile(BLIT_FS);
    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const mkTex = (w2: number, h2: number, internal: number, format: number, type: number, data: any) => {
      const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w2, h2, 0, format, type, data);
      return t;
    };
    this.worldTex = mkTex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.lightTex = mkTex(480, 270, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.warpTex = mkTex(480, 270, gl.RGBA32F, gl.RGBA, gl.FLOAT, null);
    this.inflTex = mkTex(480, 270, gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE, null);
    const mkFbo = (tex: WebGLTexture) => { const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return { f, ok }; };
    const L = mkFbo(this.lightTex); this.lightFbo = L.f;
    this.accumATex = mkTex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null); const A = mkFbo(this.accumATex); this.accumA = A.f;
    this.accumBTex = mkTex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null); const B = mkFbo(this.accumBTex); this.accumB = B.f;
    this.fboStatus = `light:${L.ok ? 'COMPLETE' : 'INCOMPLETE'} accum:${A.ok && B.ok ? 'COMPLETE' : 'INCOMPLETE'}`;
    this.needsRasterRestore = true;
  }
  needsRasterRestore = false;
  private compile(fs: string): WebGLProgram {
    const gl = this.gl!;
    const sh = (t: number, src: string) => { const x = gl.createShader(t)!; gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x) || 'shader'); return x; };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    return p;
  }

  worldContext(): CanvasRenderingContext2D { return this.worldCtx; }
  /** The D19 source raster renders into the presenter-owned light FBO. */
  lightTarget(): { fbo: WebGLFramebuffer | null; w: number; h: number } { return { fbo: (this as any).lightFbo ?? null, w: 480, h: 270 }; }
  lightTexture(): WebGLTexture | null { return (this as any).lightTex ?? null; }

  /** One world upload + frame graph + exactly ONE final post, per frame.
   *  Layers composite into a ping-pong accumulator (layer N samples the result
   *  of layers 0..N-1, never the raw world), then a single post draws to screen. */
  present(layers: PresentedLayer[]): void {
    if (!this.gl) { // 2D fallback: exact blit, still one owner / one identity "post"
      const b = this.blit!;
      b.imageSmoothingEnabled = false;
      b.drawImage(this.worldCanvas, 0, 0);
      this.postCount++; this.postCalls++;
      return;
    }
    const gl = this.gl;
    if (this.lost || gl.isContextLost()) return;
    this.worldUploads = 0; this.layerUploads = 0; this.gpuPasses = 0; this.postCalls = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // ---- single WORLD upload ----
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.worldTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, this.worldCanvas);
    this.worldUploads++;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const setupPos = (p: WebGLProgram) => { const loc = gl.getAttribLocation(p, 'pos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); };

    if (layers.length === 0) {
      // zero-cast: the single post is an identity passthrough (pixel-exact)
      gl.useProgram(this.progPass); setupPos(this.progPass);
      gl.uniform1i(gl.getUniformLocation(this.progPass, 'world'), 0);
      gl.uniform2f(gl.getUniformLocation(this.progPass, 'size'), this.canvas.width, this.canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.postCount++; this.postCalls++;
      this.lastGlError = gl.getError();
      return;
    }
    // ---- frame graph: seed accumulator with the world, composite each layer ----
    gl.useProgram(this.progPass); setupPos(this.progPass);
    gl.uniform1i(gl.getUniformLocation(this.progPass, 'world'), 0);
    gl.uniform2f(gl.getUniformLocation(this.progPass, 'size'), this.canvas.width, this.canvas.height);
    let curFbo = this.accumA, curTex = this.accumATex;      // curFbo/curTex hold the scene so far
    const otherFbo = this.accumB, otherTex = this.accumBTex;
    gl.bindFramebuffer(gl.FRAMEBUFFER, curFbo);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // world -> accum

    for (const L of layers) {
      const prog = L.kind === 'rift' ? this.progRift : L.kind === 'glow' ? this.progAdd : L.kind === 'blit' ? this.progBlit : this.progComp;
      gl.useProgram(prog); setupPos(prog);
      gl.uniform1i(gl.getUniformLocation(prog, 'scene'), 0);
      if (L.kind === 'rift') gl.uniform1i(gl.getUniformLocation(prog, 'field'), 2);
      if (L.kind === 'glow') gl.uniform1i(gl.getUniformLocation(prog, 'light'), 1);
      if (L.kind === 'blit') gl.uniform1i(gl.getUniformLocation(prog, 'world'), 1);
      if (L.kind !== 'blit') {
        gl.uniform1i(gl.getUniformLocation(prog, 'light'), 1);
        gl.uniform1i(gl.getUniformLocation(prog, 'warp'), 2);
        gl.uniform1i(gl.getUniformLocation(prog, 'influence'), 3);
      }
      gl.uniform2f(gl.getUniformLocation(prog, 'size'), this.canvas.width, this.canvas.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, curTex);   // scene so far
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, L.lightTex);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.warpTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 480, 270, 0, gl.RGBA, gl.FLOAT, L.warp); // warp or rift field
      if (L.kind === 'blit') {
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.worldTex); // pre-warp world
        gl.uniform4f(gl.getUniformLocation(prog, 'region'), L.region.x, L.region.y, L.region.w, L.region.h);
        const n = Math.min(56, (L.blocksDst?.length ?? 0) / 4);
        gl.uniform4fv(gl.getUniformLocation(prog, 'u_dst'), L.blocksDst ?? new Float32Array(56 * 4));
        gl.uniform2fv(gl.getUniformLocation(prog, 'u_home'), L.blocksHome ?? new Float32Array(56 * 2));
        gl.uniform1i(gl.getUniformLocation(prog, 'u_nblocks'), n);
      } else if (L.kind === 'glow') {
        gl.uniform4f(gl.getUniformLocation(prog, 'region'), L.region.x, L.region.y, L.region.w, L.region.h);
        gl.uniform1f(gl.getUniformLocation(prog, 'gain'), L.bloomGain);
      } else if (L.kind === 'rift') {
        this.layerUploads += 1;
        const R = L.rift!;
        gl.uniform4f(gl.getUniformLocation(prog, 'region'), L.region.x, L.region.y, L.region.w, L.region.h);
        gl.uniform1f(gl.getUniformLocation(prog, 't'), L.time);
        gl.uniform1f(gl.getUniformLocation(prog, 'pull'), R.pull);
        gl.uniform1f(gl.getUniformLocation(prog, 'span'), R.span);
        gl.uniform1f(gl.getUniformLocation(prog, 'flash'), R.flash);
        gl.uniform1fv(gl.getUniformLocation(prog, 'wt'), R.wt);
      } else {
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.inflTex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, 480, 270, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, L.influence);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        this.layerUploads += 2;
        gl.uniform4f(gl.getUniformLocation(prog, 'region'), L.region.x, L.region.y, L.region.w, L.region.h);
        gl.uniform1f(gl.getUniformLocation(prog, 'fade'), L.fade);
        gl.uniform1f(gl.getUniformLocation(prog, 'bloomGain'), L.bloomGain);
        gl.uniform1f(gl.getUniformLocation(prog, 'time'), L.time);
      }
      const wFbo = curFbo === this.accumA ? otherFbo : this.accumA; // write into the other buffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, wFbo);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // one bounded region pass per layer
      this.gpuPasses++;
      curFbo = wFbo;
      curTex = wFbo === this.accumA ? this.accumATex : this.accumBTex;
    }
    // ---- ONE final scene post: accumulated scene -> screen ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.progPass); setupPos(this.progPass);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, curTex);
    gl.uniform1i(gl.getUniformLocation(this.progPass, 'world'), 0);
    gl.uniform2f(gl.getUniformLocation(this.progPass, 'size'), this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.postCount++; this.postCalls++;
    this.lastGlError = gl.getError();
  }
}

let presenter: Presenter | null = null;
export function initPresenter(canvas: HTMLCanvasElement, w: number, h: number): Presenter {
  presenter = new Presenter(canvas, w, h);
  return presenter;
}
export function getPresenter(): Presenter | null { return presenter; }
