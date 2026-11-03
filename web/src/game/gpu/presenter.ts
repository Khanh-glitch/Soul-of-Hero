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

export interface PresentedLayer {
  clientId: string;
  kind: 'd19';
  lightTex: WebGLTexture;          // 480x270 RGBA8 additive source field
  warp: Float32Array;              // 480*270*4 RGBA32F CPU warp field
  influence: Uint8Array;           // 480*270 coverage mask
  region: { x: number; y: number; w: number; h: number }; // screen-space rect of source window
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
  private progPass!: WebGLProgram; private progComp!: WebGLProgram;
  private buf!: WebGLBuffer;
  private warpTex!: WebGLTexture; private inflTex!: WebGLTexture;
  postCount = 0; uploadsPerFrame = 0; private lost = false;

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

    const compile = (fs: string) => {
      const sh = (t: number, src: string) => { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; };
      const p = gl.createProgram()!;
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
      return p;
    };
    this.progPass = compile(PASSTHROUGH_FS);
    this.progComp = compile(COMPOSITE_FS);
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
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);

    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.rebuild(); });
  }

  private rebuild() { /* programs/textures are re-created lazily by renderers on restore; stateless FS passes need no data */ }

  worldContext(): CanvasRenderingContext2D { return this.worldCtx; }
  /** The D19 source raster renders into the presenter-owned light FBO. */
  lightTarget(): { fbo: WebGLFramebuffer | null; w: number; h: number } { return { fbo: (this as any).lightFbo ?? null, w: 480, h: 270 }; }
  lightTexture(): WebGLTexture | null { return (this as any).lightTex ?? null; }

  /** One world upload + frame graph + exactly ONE post, per frame. */
  present(layers: PresentedLayer[]): void {
    if (!this.gl) { // 2D fallback: exact blit, still one owner / one "post" (identity)
      const b = this.blit!;
      b.imageSmoothingEnabled = false;
      b.drawImage(this.worldCanvas, 0, 0);
      this.postCount++;
      return;
    }
    const gl = this.gl;
    if (this.lost || gl.isContextLost()) return;
    this.uploadsPerFrame = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // ---- single world upload ----
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.worldTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, this.worldCanvas);
    this.uploadsPerFrame++;
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
      this.postCount++;
      return;
    }
    // ---- frame graph: world + each submitted layer, then ONE post ----
    gl.useProgram(this.progComp); setupPos(this.progComp);
    gl.uniform1i(gl.getUniformLocation(this.progComp, 'scene'), 0);
    gl.uniform1i(gl.getUniformLocation(this.progComp, 'light'), 1);
    gl.uniform1i(gl.getUniformLocation(this.progComp, 'warp'), 2);
    gl.uniform1i(gl.getUniformLocation(this.progComp, 'influence'), 3);
    gl.uniform2f(gl.getUniformLocation(this.progComp, 'size'), this.canvas.width, this.canvas.height);
    for (const L of layers) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, L.lightTex);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.warpTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 480, 270, 0, gl.RGBA, gl.FLOAT, L.warp);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.inflTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, 480, 270, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, L.influence);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.uniform4f(gl.getUniformLocation(this.progComp, 'region'), L.region.x, L.region.y, L.region.w, L.region.h);
      gl.uniform1f(gl.getUniformLocation(this.progComp, 'fade'), L.fade);
      gl.uniform1f(gl.getUniformLocation(this.progComp, 'bloomGain'), L.bloomGain);
      gl.uniform1f(gl.getUniformLocation(this.progComp, 'time'), L.time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // each layer is a bounded region pass of the ONE post
    }
    this.postCount++;
  }
}

let presenter: Presenter | null = null;
export function initPresenter(canvas: HTMLCanvasElement, w: number, h: number): Presenter {
  presenter = new Presenter(canvas, w, h);
  return presenter;
}
export function getPresenter(): Presenter | null { return presenter; }
