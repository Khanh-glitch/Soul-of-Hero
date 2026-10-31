import { W, H } from './renderer';

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; uv.y = 1.0-uv.y; gl_Position = vec4(p,0,1); }`;

const BRIGHT = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src;
void main(){ vec3 c = texture(src, uv).rgb; o = vec4(max(c-0.55,0.0)*1.6, 1.0); }`;

const BLUR = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D src; uniform vec2 dir;
void main(){ vec3 s = vec3(0); float n = 0.0;
  for (int k=-6;k<=6;k++){ float w = 1.0-abs(float(k))/7.0; s += texture(src, uv + dir*float(k)).rgb*w; n += w; }
  o = vec4(s/n,1.0); }`;

const COMP = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D base; uniform sampler2D bloom; uniform vec2 res;
void main(){
  vec3 c = texture(base, uv).rgb;
  // bloom sampled with nearest filtering at native res = blocky, pixel-honest glow
  vec3 b = texture(bloom, uv).rgb;
  c += b*0.9;
  vec2 q = uv-0.5; c *= 1.0 - dot(q,q)*0.55;
  o = vec4(c,1.0);
}`;

export class Presenter {
  gl: WebGL2RenderingContext;
  tex: WebGLTexture[] = [];
  fbs: WebGLFramebuffer[] = [];
  progs: Record<string, WebGLProgram> = {};
  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const mk = (fs: string) => {
      const p = gl.createProgram()!;
      for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]] as [number, string][]) {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      gl.bindAttribLocation(p, 0, 'p');
      gl.linkProgram(p);
      return p;
    };
    this.progs = { bright: mk(BRIGHT), blur: mk(BLUR), comp: mk(COMP) };
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (let i = 0; i < 3; i++) {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tex.push(t);
      if (i > 0) {
        const fb = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        this.fbs.push(fb);
      }
    }
  }
  pass(prog: string, src: WebGLTexture, fb: WebGLFramebuffer | null, w: number, h: number, set?: (p: WebGLProgram) => void) {
    const gl = this.gl, p = this.progs[prog];
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform1i(gl.getUniformLocation(p, 'src'), 0);
    gl.uniform1i(gl.getUniformLocation(p, 'base'), 0);
    set?.(p);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  present(rgba: Uint8ClampedArray) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex[0]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    this.pass('bright', this.tex[0], this.fbs[0], W, H);
    this.pass('blur', this.tex[1], this.fbs[1], W, H, (p) => gl.uniform2f(gl.getUniformLocation(p, 'dir'), 1 / W, 0));
    this.pass('blur', this.tex[2], this.fbs[0], W, H, (p) => gl.uniform2f(gl.getUniformLocation(p, 'dir'), 0, 1 / H));
    const cw = this.canvas.width, ch = this.canvas.height;
    this.pass('comp', this.tex[0], null, cw, ch, (p) => {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[1]);
      gl.uniform1i(gl.getUniformLocation(p, 'bloom'), 1);
      gl.uniform2f(gl.getUniformLocation(p, 'res'), cw, ch);
    });
  }
}
