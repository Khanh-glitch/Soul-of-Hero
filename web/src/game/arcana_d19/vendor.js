// Copied without algorithm changes from the creator's standalone D source
// Elemental_VFX_Lab_FIXED_Standalone.html. Internal unvalidated renderer.
const factories = {
'src/engine/batches.ts': function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Blitter = exports.WarpBatch = exports.PolyBatch = exports.RibbonBatch = exports.SpriteBatch = exports.BLIT_FS = exports.POLY_FS = exports.POLY_VS = exports.RIBBON_FS = exports.RIBBON_VS = exports.SPRITE_FS = exports.SPRITE_VS = exports.SHAPES = void 0;
exports.setBlend = setBlend;
const gl_1 = require("./gl");
exports.SHAPES = {
    DISC: 0,
    SOFT: 1,
    RING: 2,
    SPARK: 3,
    STAR: 4,
    SPOKE: 5,
    SHARD: 6,
    PETAL: 7,
    HEX: 8,
    TRI: 9,
    BOX: 10,
    DROP: 11,
    CRES: 12,
    FLARE: 13,
    ARC: 14,
    LEAF: 15,
    BLOB: 16,
    THORN: 17,
    FLAKE: 18,
    PLUS: 19,
    FRAME: 20,
    SMOK: 21,
    NEEDLE: 22,
    DAGGER: 23,
    MOTH: 24,
};
exports.SPRITE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aA; // cx,cy,sx,sy
layout(location=2) in vec4 aB; // rot, seed, shape, hard
layout(location=3) in vec4 aC; // rgba
layout(location=4) in vec4 aD; // glow, edge, wobble, flags
uniform vec2 uRes; uniform vec2 uCam; uniform float uTime;
out vec2 vP; out vec2 vSz; out vec4 vCol; out vec4 vB; out vec4 vD;
void main(){
  float c = cos(aB.x), s = sin(aB.x);
  vec2 q = aCorner * aA.zw;
  vec2 pos = aA.xy + vec2(q.x*c - q.y*s, q.x*s + q.y*c);
  vec2 clip = (pos - uCam) / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vP = aCorner * aA.zw; vSz = max(aA.zw, vec2(0.75)); vCol = aC; vB = aB; vD = aD;
}`;
exports.SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vP; in vec2 vSz; in vec4 vCol; in vec4 vB; in vec4 vD;
uniform float uTime; uniform vec2 uRes;
out vec4 frag;
#define PI 3.14159265
float h11(float n){ return fract(sin(n*127.1)*43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5;} return s; }
// polygon radius for a regular n-gon
float ngonR(float th, float n, float r){ return r*cos(PI/n)/cos(mod(th, 2.0*PI/n) - PI/n); }
// radial profile: base radius modulated by two harmonics + a sharp spike term
float radial(float th, float seed, float a1, float h1, float a2, float h2, float spike, float sharp){
  float p1 = h11(seed)*6.283, p2 = h11(seed+3.7)*6.283;
  float r = 1.0 + a1*cos(h1*th + p1) + a2*cos(h2*th + p2);
  r += spike*pow(max(0.0, cos(sharp*th + p1*2.0)), 6.0);
  return r;
}
float aa(float d, float hard){ return 1.0 - smoothstep(-hard*0.5, hard*0.9, d); }

float shapeAlpha(int id, vec2 p, float seed, float hard, out float rim){
  rim = 0.0;
  float r = length(p);
  float th = atan(p.y, p.x);
  float d = 0.0, a = 0.0;
  if(id == 0){ d = r - 1.0; a = aa(d, hard); }
  else if(id == 1){ a = exp(-r*r*3.2); }
  else if(id == 2){
    float w = 0.14 + 0.3*h11(seed);
    d = max(abs(r - (1.0 - w*0.5)) - w*0.5, 0.0);
    a = aa(d, hard);
  }
  else if(id == 3){ d = length(p*vec2(0.30, 1.15)) - 1.0; a = aa(d, hard*1.4); }
  else if(id == 4){
    float pr = radial(th, seed, 0.10, 2.0, 0.05, 4.0, 1.5, 4.0);
    d = r - pr; a = aa(d, hard);
  }
  else if(id == 5){
    float pr = radial(th, seed, 0.16, 3.0, 0.06, 6.0, 0.9, 6.0);
    d = r - pr; a = aa(d, hard);
  }
  else if(id == 6){
    float pr = ngonR(th, 5.0 + floor(h11(seed)*3.0), 0.72 + 0.2*h11(seed+9.0));
    float pr2 = radial(th, seed+11.0, 0.22, 2.0, 0.1, 5.0, 0.0, 3.0);
    d = r - min(pr, pr2); a = aa(d, hard*1.2);
  }
  else if(id == 7){
    float pr = (0.35 + 0.65*pow(max(0.0,cos(th*0.5)), 1.4)) * radial(th, seed, 0.14, 2.0, 0.0, 3.0, 0.0, 0.0);
    d = r - pr; a = aa(d, hard);
  }
  else if(id == 8){ d = r - ngonR(th, 6.0, 0.92); a = aa(d, hard*1.3); }
  else if(id == 9){ d = r - ngonR(th, 3.0, 1.0); a = aa(d, hard*1.3); }
  else if(id == 10){ d = max(abs(p.x), abs(p.y)) - 1.0; a = aa(d, hard*1.3); }
  else if(id == 11){
    vec2 q = p; q.y += 0.35;
    float body = length(q*vec2(1.0, 0.85)) - 0.72;
    float tip = length(p - vec2(0.0, -1.05)) - 0.5;
    d = min(body, tip); a = aa(d, hard);
  }
  else if(id == 12){
    float d1 = r - 1.0;
    float d2 = length(p - vec2(0.55, 0.0)) - 0.95;
    d = max(d1, -d2); a = aa(d, hard);
  }
  else if(id == 13){
    float a4 = abs(mod(th + PI, PI*0.5) - PI*0.25);
    float pr = 1.0 / (1.0 + 12.0*a4*a4);
    d = r - mix(pr, 1.0, 0.12); a = aa(d, hard*0.9);
  }
  else if(id == 14){
    float w = 0.5 + 0.5*h11(seed);
    float ang = mod(th, 2.0*PI);
    float win = smoothstep(0.0, 0.25, ang) * (1.0 - smoothstep(w*2.0*PI - 0.25, w*2.0*PI, ang));
    d = abs(r - 0.85) - 0.2; a = aa(d, hard) * step(0.15, win);
  }
  else if(id == 15){
    float pr = radial(th, seed, 0.2, 2.0, 0.0, 3.0, 0.0, 0.0) * (0.3 + 0.7*pow(max(0.0,cos(th)), 0.6));
    pr *= 1.0 - 0.35*abs(sin(th));
    d = r - pr; a = aa(d, hard);
  }
  else if(id == 16){
    float b = 0.0;
    for(int i=0;i<3;i++){
      float fi = float(i);
      vec2 o = vec2(cos(h11(seed+fi)*6.28), sin(h11(seed+fi*2.3)*6.28)) * (0.35+0.3*fi*0.4);
      b += 0.42/ (0.08 + dot(p-o,p-o)*2.2);
    }
    a = clamp(b*b*0.02, 0.0, 1.0); a = smoothstep(0.25, 0.75, a);
  }
  else if(id == 17){
    // long thorn: sharp tip at -y, widening base at +y
    float k = clamp((p.y + 1.0) * 0.5, 0.0, 1.0);
    d = max(abs(p.x) - (1.0 - k) * 0.55, p.y - 1.0);
    d = max(d, -1.0 - p.y);
    a = aa(d, hard);
  }
  else if(id == 18){
    float arms = 0.0;
    for(int i=0;i<3;i++){
      float an = PI*float(i)/3.0;
      vec2 q = mat2(cos(an), -sin(an), sin(an), cos(an)) * p;
      arms = max(arms, 1.0 - (length(vec2(q.x*6.0, q.y*0.9)) - 0.85));
    }
    a = clamp(arms, 0.0, 1.0); a = smoothstep(0.1, 0.7, a);
  }
  else if(id == 19){
    float c = 1.0 - (length(vec2(p.x*7.0, p.y*1.05)) - 0.85);
    float c2 = 1.0 - (length(vec2(p.y*7.0, p.x*1.05)) - 0.85);
    a = smoothstep(0.1, 0.6, max(c, c2));
  }
  else if(id == 20){
    float e = max(abs(p.x), abs(p.y));
    d = max(e - 1.0, 0.72 - e); a = aa(d, hard*1.2);
  }
  else if(id == 21){
    float n = fbm(p*2.2 + vec2(seed*3.1, -uTime*0.7));
    d = r - (0.72 + 0.55*(n - 0.5));
    a = aa(d, hard*2.5) * 0.85;
  }
  else if(id == 22){ d = length(p*vec2(0.12, 1.0)) - 1.0; a = aa(d, hard*1.6); }
  else if(id == 23){
    float bl = length(p*vec2(0.34, 1.0)) - 1.0;
    float tip = length(p - vec2(0.0, -1.25)) - 0.42;
    d = min(bl, tip); a = aa(d, hard);
  }
  else if(id == 24){
    float pr = ngonR(th, 4.0, 1.0);
    float notch = smoothstep(0.0, 0.5, abs(mod(th+PI, PI*0.5)-PI*0.25));
    d = r - mix(pr*0.85, pr, notch); a = aa(d, hard);
  }
  else { d = r - 1.0; a = aa(d, hard); }
  rim = exp(-abs(d)*3.4) * step(0.0, d);
  return a;
}

void main(){
  vec2 q = vP;                    // pixel space
  float flags = vD.w;
  int id = int(vB.z + 0.5);
  // organic wobble / chunky pixel quantisation, authored in pixels
  if(flags >= 4.0){
    float s = vB.y;
    q += vSz*0.14*vec2(sin(q.y*0.9 + uTime*2.0 + s*9.0), cos(q.x*0.8 - uTime*1.7 + s*5.0));
    flags -= 4.0;
  }
  if(flags >= 2.0){ q = floor(q*0.5)/0.5; flags -= 2.0; }
  vec2 p = q / vSz;               // unit SDF domain
  float px = 1.0 / ((vSz.x + vSz.y) * 0.5);
  float rim;
  float a = shapeAlpha(id, p, vB.y, vB.w * px, rim);
  if(a <= 0.002) discard;
  float d = length(p);
  vec3 col = vCol.rgb;
  col *= mix(1.0, 1.0 + vD.x*2.2*exp(-d*d*2.5), clamp(vD.x,0.0,1.0));
  col += col * vD.y * rim * 1.6;
  frag = vec4(col, vCol.a * a);
}`;
exports.RIBBON_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=1) in vec4 aC;  // rgba
layout(location=2) in vec4 aM;  // across, along, hard, glow
layout(location=3) in vec4 aS;  // flow, flags, seed, width
uniform vec2 uRes; uniform vec2 uCam; uniform float uTime;
out vec4 vCol; out vec4 vM; out vec4 vS;
void main(){
  vec2 clip = (aPos - uCam)/uRes*2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vCol = aC; vM = aM; vS = aS;
}`;
exports.RIBBON_FS = `#version 300 es
precision highp float;
in vec4 vCol; in vec4 vM; in vec4 vS;
uniform float uTime;
out vec4 frag;
float h11(float n){ return fract(sin(n*127.1)*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h11(i.x+i.y*57.0), h11(i.x+1.0+i.y*57.0), f.x),
             mix(h11(i.x+(i.y+1.0)*57.0), h11(i.x+1.0+(i.y+1.0)*57.0), f.x), f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.1; a*=0.5;} return s; }
void main(){
  float d = abs(vM.x);
  float hard = vM.z;
  // edge width in real pixels so wide ribbons stay crisp
  float fw = max(fwidth(d), 1e-4);
  float distPx = (1.0 - d) / fw;
  float a = clamp(distPx / max(0.8, hard), 0.0, 1.0);
  float flags = vS.y;
  float along = vM.y;
  if(flags >= 4.0){ flags -= 4.0; a *= 0.55 + 0.75*fbm(vec2(along*26.0, uTime*2.4 - along*9.0 + vS.z*5.0)); }
  if(flags >= 2.0){ flags -= 2.0; d += (h11(floor(along*46.0) + floor(uTime*22.0)*0.37) - 0.5)*0.8;
                     a = max(a * 0.35, clamp(((1.0 - d) / fw) / 1.6, 0.0, 1.0)); }
  if(flags >= 1.0){ flags -= 1.0; }
  if(a <= 0.003) discard;
  float core = 1.0 - d*d;
  vec3 col = vCol.rgb * (0.55 + 0.75*core);
  col += vCol.rgb * vM.w * exp(-d*d*7.0) * 2.4;
  if(vS.x > 0.0){
    float ph = fract(along*vS.z*0.06 - uTime*vS.x);
    float bump = pow(ph, 6.0);
    col += vec3(1.0, 0.97, 0.9) * bump * (1.2 - d) * 1.5;
    a = max(a, bump*(1.0-d*0.6));
  }
  frag = vec4(col, vCol.a * a);
}`;
exports.POLY_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=1) in vec4 aC;
layout(location=2) in vec4 aE; // local.x, local.y, glow, edge
uniform vec2 uRes; uniform vec2 uCam;
out vec4 vCol; out vec4 vE;
void main(){
  vec2 clip = (aPos - uCam)/uRes*2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vCol = aC; vE = aE;
}`;
exports.POLY_FS = `#version 300 es
precision highp float;
in vec4 vCol; in vec4 vE;
uniform float uTime;
out vec4 frag;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5;} return s; }
float h11(float n){ return fract(sin(n*127.1)*43758.5453); }
float ngon(vec2 p, float n, float r){
  float an = 3.14159265/n;
  float th = atan(p.y, p.x);
  return length(p) - r*cos(an)/cos(mod(th, 2.0*an) - an);
}
// ---- "unreality" interior: generated inside the polygon's own space -------
vec4 voidSpace(vec2 l, float seed, float t){
  float r = length(l) + 0.0001;
  float th = atan(l.y, l.x);
  vec3 col = vec3(0.008, 0.006, 0.03);
  // three independent parallax strata of drifting geometry
  for(int k=0;k<3;k++){
    float fk = float(k);
    float depth = 1.0 / (1.0 + fk*1.1);
    vec2 q = l * (1.6 + fk*1.9) + vec2(t*(0.06+fk*0.09)*(fk-1.0), -t*(0.05+fk*0.05));
    float ang = t*(0.15 - fk*0.11)*(fk-1.0);
    q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang))*q;
    float n = ngon(q, 3.0 + floor(h11(seed+fk*7.0)*4.0), 0.55 + 0.3*h11(seed+fk*3.0));
    float shell = smoothstep(0.05, 0.0, abs(n - 0.02));
    float fill = smoothstep(0.0, -0.06, n) * 0.35;
    vec3 tint = mix(vec3(0.45,0.16,0.7), vec3(0.7,0.85,1.0), fk*0.5);
    col += tint * (shell*0.9 + fill) * depth;
  }
  // impossible shadows: dark bars running the wrong way
  float bars = smoothstep(0.4, 0.5, abs(fract(l.x*2.0 - t*0.25 + seed*0.31) - 0.5));
  col *= 1.0 - 0.35*bars;
  // luminous debris + faint starfield with reversed depth cue
  float st = pow(h21(floor(l*22.0 + vec2(seed*5.0, -t*0.4))), 22.0);
  col += vec3(0.8,0.7,1.0)*st*2.2;
  col += vec3(0.5,0.2,0.8)*fbm(l*2.0 + vec2(seed, t*0.1))*0.22;
  float a = vE.w < 3.0 ? smoothstep(1.0, 0.68, abs(l.y)) : smoothstep(1.0, 0.72, max(abs(l.x), abs(l.y)));
  float rim = smoothstep(0.62, 1.0, max(abs(l.x), abs(l.y)));
  col += vec3(0.85,0.55,1.0)*rim*0.7;
  return vec4(col, a);
}
void main(){
  vec2 l = vE.xy;
  float r = max(abs(l.x), abs(l.y));
  if(vE.w > 1.5){
    vec4 v = voidSpace(l, vE.z, uTime);
    frag = vec4(v.rgb * vCol.rgb, v.a * vCol.a);
    return;
  }
  // resolution independent edge width: vE.w is authored in pixels
  float fw = max(fwidth(r), 1e-4);
  float distPx = (1.0 - r) / fw;
  float edge = clamp(distPx / max(0.6, vE.w), 0.0, 1.0);
  if(edge <= 0.004) discard;
  vec3 col = vCol.rgb * (1.0 + vE.z * (1.0 - r*r) * 2.0);
  col += vCol.rgb * exp(-max(0.0, -distPx) / 2.6) * clamp(vE.w, 0.0, 1.0) * 1.3;
  frag = vec4(col, vCol.a * edge);
}`;
const WARP_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aA; // cx,cy,sx,sy
layout(location=2) in vec4 aB; // ox,oy,absorb,chroma
uniform vec2 uRes; uniform vec2 uCam;
out vec2 vP; out vec4 vB;
void main(){
  vec2 pos = aA.xy + aCorner*aA.zw;
  vec2 clip = (pos - uCam)/uRes*2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vP = aCorner; vB = aB;
}`;
const WARP_FS = `#version 300 es
precision highp float;
in vec2 vP; in vec4 vB;
out vec4 frag;
void main(){
  float f = 1.0 - dot(vP, vP);
  if(f <= 0.0) discard;
  f = f*f;
  frag = vec4(vB.xy * f, vB.z * f, vB.w * f);
}`;
exports.BLIT_FS = `#version 300 es
precision highp float;
in vec2 vUV; uniform sampler2D uTex; uniform float uDecay; uniform vec4 uGain;
out vec4 frag;
void main(){ frag = texture(uTex, vUV) * uDecay * uGain; }`;
function setBlend(gl, mode) {
    switch (mode) {
        case "add":
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            break;
        case "alpha":
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            break;
        case "mult":
            gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
            break;
    }
}
class Batch {
    constructor(gl, prog, stride, cap) {
        this.gl = gl;
        this.prog = prog;
        this.n = 0;
        this.stride = stride;
        this.cap = cap;
        this.data = new Float32Array(cap * stride * 4);
        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
        gl.bindVertexArray(null);
    }
    upload() {
        const gl = this.gl;
        if (this.n === 0)
            return;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * this.stride);
    }
    reset() {
        this.n = 0;
    }
    get count() {
        return this.n;
    }
}
class SpriteBatch extends Batch {
    constructor(gl, prog, cap = 9000) {
        super(gl, prog, 16, cap);
        const q = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        this.quads = gl.createBuffer();
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quads);
        gl.bufferData(gl.ARRAY_BUFFER, q, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(0, 0);
        for (let i = 0; i < 4; i++) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
            gl.enableVertexAttribArray(i + 1);
            gl.vertexAttribPointer(i + 1, 4, gl.FLOAT, false, 64, i * 16);
            gl.vertexAttribDivisor(i + 1, 1);
        }
        gl.bindVertexArray(null);
    }
    push(x, y, sx, sy, rot, seed, shape, hard, r, g, b, a, glow, edge, wobble, flags) {
        if (this.n >= this.cap || !Number.isFinite(x + y + sx + sy) || sx <= 0 || sy <= 0)
            return;
        if (!Number.isFinite(rot))
            rot = 0;
        if (!Number.isFinite(seed))
            seed = 0;
        const d = this.data;
        let o = this.n * 16;
        {
            d[o] = x;
            d[o + 1] = y;
            d[o + 2] = sx;
            d[o + 3] = sy;
            d[o + 4] = rot;
            d[o + 5] = seed;
            d[o + 6] = shape;
            d[o + 7] = hard;
            d[o + 8] = r;
            d[o + 9] = g;
            d[o + 10] = b;
            d[o + 11] = a;
            d[o + 12] = glow;
            d[o + 13] = edge;
            d[o + 14] = wobble;
            d[o + 15] = flags;
            o += 16;
        }
        this.n++;
    }
    draw(res, cam, time) {
        if (!this.n)
            return;
        const gl = this.gl;
        this.upload();
        this.prog.use();
        gl.bindVertexArray(this.vao);
        this.prog.v2("uRes", res[0], res[1]);
        this.prog.v2("uCam", cam[0], cam[1]);
        this.prog.f("uTime", time);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
        gl.bindVertexArray(null);
    }
}
exports.SpriteBatch = SpriteBatch;
class RibbonBatch extends Batch {
    constructor(gl, prog, cap = 20000) {
        super(gl, prog, 16, cap);
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        const S = 64;
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, S, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, S, 8);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, S, 24);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 4, gl.FLOAT, false, S, 40);
        for (let i = 0; i < 4; i++)
            gl.vertexAttribDivisor(i, 0);
        gl.bindVertexArray(null);
    }
    push(pts, width, col, o = {}) {
        const n = pts.length / 2;
        if (n < 2 || pts.some(v => !Number.isFinite(v)))
            return;
        const hard = o.hard ?? 0.8;
        const glow = o.glow ?? 0;
        const flow = o.flow ?? 0;
        const flags = o.flags ?? 0;
        const seed = o.seed ?? 1;
        const alpha = o.alpha ?? 1;
        const along = new Array(n);
        let total = 0;
        along[0] = 0;
        for (let i = 1; i < n; i++) {
            total += Math.hypot(pts[i * 2] - pts[(i - 1) * 2], pts[i * 2 + 1] - pts[(i - 1) * 2 + 1]);
            along[i] = total;
        }
        let o2 = this.n * 16;
        const d = this.data;
        const bridge = this.n > 0 ? 3 : 0;
        if (o2 + (n * 2 + bridge) * 16 > d.length)
            return;
        const vert = (i, side) => {
            const rawW = Array.isArray(width) ? width[Math.min(width.length - 1, i)] : width;
            const w = Number.isFinite(rawW) ? Math.max(0.02, rawW) : 0.75;
            const c = Array.isArray(col[0]) ? col[Math.min(col.length - 1, i)] : col;
            const nx = i === 0 ? pts[2] - pts[0] : i === n - 1 ? pts[i * 2] - pts[(i - 1) * 2] : pts[(i + 1) * 2] - pts[(i - 1) * 2];
            const ny = i === 0
                ? pts[3] - pts[1]
                : i === n - 1
                    ? pts[i * 2 + 1] - pts[(i - 1) * 2 + 1]
                    : pts[(i + 1) * 2 + 1] - pts[(i - 1) * 2 + 1];
            const l = Math.hypot(nx, ny) || 1;
            const px = -ny / l, py = nx / l;
            d[o2] = pts[i * 2] + px * w * side;
            d[o2 + 1] = pts[i * 2 + 1] + py * w * side;
            d[o2 + 2] = c[0];
            d[o2 + 3] = c[1];
            d[o2 + 4] = c[2];
            d[o2 + 5] = c[3] * alpha;
            d[o2 + 6] = side;
            d[o2 + 7] = along[i];
            d[o2 + 8] = hard;
            d[o2 + 9] = glow;
            d[o2 + 10] = flow;
            d[o2 + 11] = flags;
            d[o2 + 12] = seed;
            d[o2 + 13] = w;
            o2 += 16;
        };
        if (bridge) {
            const src = o2 - 16;
            for (let k = 0; k < 16; k++)
                d[o2 + k] = d[src + k];
            o2 += 16;
            for (let k = 0; k < 16; k++)
                d[o2 + k] = d[src + k];
            o2 += 16;
            vert(0, -1);
            this.n += 3;
        }
        for (let i = 0; i < n; i++) {
            vert(i, -1);
            vert(i, 1);
        }
        this.n += n * 2;
    }
    draw(res, cam, time) {
        if (this.n < 4)
            return;
        const gl = this.gl;
        this.upload();
        this.prog.use();
        gl.bindVertexArray(this.vao);
        this.prog.v2("uRes", res[0], res[1]);
        this.prog.v2("uCam", cam[0], cam[1]);
        this.prog.f("uTime", time);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.n);
        gl.bindVertexArray(null);
    }
}
exports.RibbonBatch = RibbonBatch;
class PolyBatch extends Batch {
    constructor(gl, prog, cap = 16000) {
        super(gl, prog, 12, cap);
        this.idx = new Uint16Array(cap * 6);
        for (let q = 0; q < cap; q++) {
            const b = q * 4, i = q * 6;
            this.idx[i] = b;
            this.idx[i + 1] = b + 1;
            this.idx[i + 2] = b + 2;
            this.idx[i + 3] = b + 1;
            this.idx[i + 4] = b + 3;
            this.idx[i + 5] = b + 2;
        }
        this.ibo = gl.createBuffer();
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        const S = 48;
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, S, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, S, 8);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, S, 24);
        for (let i = 0; i < 3; i++)
            gl.vertexAttribDivisor(i, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.idx, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
    }
    pushQuad(p, col, o = {}) {
        if (p.length < 8 || p.some(v => !Number.isFinite(v)))
            return;
        const glow = o.glow ?? 0, edge = o.edge ?? 0.05, alpha = o.alpha ?? 1;
        const d = this.data;
        let o2 = this.n * 12;
        if (o2 + 48 > d.length)
            return;
        const loc = o.local ?? [-1, -1, 1, -1, -1, 1, 1, 1];
        for (let v = 0; v < 4; v++) {
            const c = Array.isArray(col[0]) ? col[v] : col;
            d[o2] = p[v * 2];
            d[o2 + 1] = p[v * 2 + 1];
            d[o2 + 2] = c[0];
            d[o2 + 3] = c[1];
            d[o2 + 4] = c[2];
            d[o2 + 5] = c[3] * alpha;
            d[o2 + 6] = loc[v * 2];
            d[o2 + 7] = loc[v * 2 + 1];
            d[o2 + 8] = glow;
            d[o2 + 9] = edge;
            o2 += 12;
        }
        this.n += 4;
    }
    draw(res, cam, time = 0) {
        if (this.n < 4)
            return;
        const gl = this.gl;
        this.upload();
        this.prog.use();
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
        this.prog.v2("uRes", res[0], res[1]);
        this.prog.v2("uCam", cam[0], cam[1]);
        this.prog.f("uTime", time);
        gl.drawElements(gl.TRIANGLES, (this.n / 4) * 6, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
    }
}
exports.PolyBatch = PolyBatch;
class WarpBatch extends Batch {
    constructor(gl, cap = 3000) {
        const wp = new gl_1.Program(gl, WARP_VS, WARP_FS);
        super(gl, wp, 8, cap);
        this.wprog = wp;
        this.corners = gl.createBuffer();
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.corners);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
        gl.vertexAttribDivisor(1, 1);
        gl.vertexAttribDivisor(2, 1);
        gl.bindVertexArray(null);
    }
    add(x, y, sx, sy, ox, oy, absorb, chroma) {
        if (this.n >= this.cap || ![x, y, sx, sy, ox, oy, absorb, chroma].every(Number.isFinite))
            return;
        const d = this.data;
        let o = this.n * 8;
        {
            d[o] = x;
            d[o + 1] = y;
            d[o + 2] = sx;
            d[o + 3] = sy;
            d[o + 4] = ox;
            d[o + 5] = oy;
            d[o + 6] = absorb;
            d[o + 7] = chroma;
            o += 8;
        }
        this.n++;
    }
    drawWarp(res, cam) {
        if (!this.n)
            return;
        const gl = this.gl;
        this.upload();
        this.wprog.use();
        gl.bindVertexArray(this.vao);
        this.wprog.v2("uRes", res[0], res[1]);
        this.wprog.v2("uCam", cam[0], cam[1]);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
        gl.bindVertexArray(null);
    }
}
exports.WarpBatch = WarpBatch;
class Blitter {
    constructor(gl) {
        this.gl = gl;
        this.prog = new gl_1.Program(gl, gl_1.FS_VERT, exports.BLIT_FS);
    }
    blit(dst, src, w, h, decay = 1, gain) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst);
        gl.viewport(0, 0, w, h);
        gl.disable(gl.BLEND);
        this.prog.use();
        this.prog.tex("uTex", 0, src);
        this.prog.f("uDecay", decay);
        const g = gain ?? [1, 1, 1, 1];
        this.prog.v4("uGain", g[0], g[1], g[2], g[3]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
}
exports.Blitter = Blitter;

},
'src/engine/gl.ts': function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FS_VERT = exports.FBO = exports.Program = void 0;
exports.getGL = getGL;
exports.setTexParams = setTexParams;
function getGL(canvas) {
    const gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
    });
    if (!gl)
        throw new Error("WebGL2 unavailable");
    return gl;
}
function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh) ?? "";
        const numbered = src
            .split("\n")
            .map((l, i) => `${(i + 1).toString().padStart(3, " ")}| ${l}`)
            .join("\n");
        throw new Error("shader compile failed:\n" + log + "\n" + numbered);
    }
    return sh;
}
class Program {
    constructor(gl, vs, fs) {
        this.gl = gl;
        this.locs = new Map();
        const p = gl.createProgram();
        const v = compile(gl, gl.VERTEX_SHADER, vs);
        const f = compile(gl, gl.FRAGMENT_SHADER, fs);
        gl.attachShader(p, v);
        gl.attachShader(p, f);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            throw new Error("link failed: " + gl.getProgramInfoLog(p));
        }
        gl.deleteShader(v);
        gl.deleteShader(f);
        this.prog = p;
    }
    use() {
        this.gl.useProgram(this.prog);
        return this;
    }
    u(name) {
        if (!this.locs.has(name)) {
            this.locs.set(name, this.gl.getUniformLocation(this.prog, name));
        }
        return this.locs.get(name);
    }
    f(name, v) {
        this.gl.uniform1f(this.u(name), v);
    }
    i(name, v) {
        this.gl.uniform1i(this.u(name), v);
    }
    v2(name, x, y) {
        this.gl.uniform2f(this.u(name), x, y);
    }
    v4(name, x, y, z, w) {
        this.gl.uniform4f(this.u(name), x, y, z, w);
    }
    tex(name, unit, texture) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(this.u(name), unit);
    }
}
exports.Program = Program;
class FBO {
    constructor(gl, w, h, opts = {}) {
        this.gl = gl;
        this.w = w;
        this.h = h;
        const filter = opts.filter ?? gl.LINEAR;
        const internal = opts.float ? gl.RGBA16F : gl.RGBA8;
        const type = opts.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
        this.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
        setTexParams(gl, filter, opts.wrap ?? gl.CLAMP_TO_EDGE);
        this.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    bind(clear = true) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.viewport(0, 0, this.w, this.h);
        if (clear) {
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
    }
    dispose() {
        this.gl.deleteTexture(this.tex);
        this.gl.deleteFramebuffer(this.fbo);
    }
}
exports.FBO = FBO;
function setTexParams(gl, filter, wrap) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
}
exports.FS_VERT = `#version 300 es
precision highp float;
out vec2 vUV;
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

},
};
const cache={};
function load(key){if(cache[key])return cache[key].exports;const mod={exports:{}};cache[key]=mod;const require=(name)=>load('src/engine/'+name.replace(/^\.\//,'')+'.ts');factories[key](mod,mod.exports,require);return mod.exports;}
export const batches=load('src/engine/batches.ts');
export const glSource=load('src/engine/gl.ts');
