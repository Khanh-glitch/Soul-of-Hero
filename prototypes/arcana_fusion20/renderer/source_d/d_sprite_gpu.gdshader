// Direct original D SPRITE_FS with CanvasItem uniforms and UV pixel coordinates.
// Experimental primitive only: no world, original bloom/post or acceptance.
shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float source_time = 0.0;
uniform vec2 half_size = vec2(1.0);
uniform float rotation_angle = 0.0;
uniform int shape_id = 0;
uniform float sprite_seed = 1.7;
uniform float sprite_hard = 0.9;
uniform float glow = 0.3;
uniform float edge = 0.0;
uniform float flags = 0.0;
uniform bool coverage_only = false;
void vertex() {
  float c = cos(rotation_angle), s = sin(rotation_angle);
  vec2 q = VERTEX;
  VERTEX = vec2(q.x*c - q.y*s, q.x*s + q.y*c);
}
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
    float n = fbm(p*2.2 + vec2(seed*3.1, -source_time*0.7));
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

void fragment(){
  vec2 q = UV;                    // pixel space
  float local_flags = flags;
  int id = shape_id;
  // organic wobble / chunky pixel quantisation, authored in pixels
  if(local_flags >= 4.0){
    float s = sprite_seed;
    q += half_size*0.14*vec2(sin(q.y*0.9 + source_time*2.0 + s*9.0), cos(q.x*0.8 - source_time*1.7 + s*5.0));
    local_flags -= 4.0;
  }
  if(local_flags >= 2.0){ q = floor(q*0.5)/0.5; local_flags -= 2.0; }
  vec2 p = q / half_size;               // unit SDF domain
  float px = 1.0 / ((half_size.x + half_size.y) * 0.5);
  float rim;
  float a = shapeAlpha(id, p, sprite_seed, sprite_hard * px, rim);
  if(a <= 0.002) discard;
  float d = length(p);
  vec3 col = COLOR.rgb;
  col *= mix(1.0, 1.0 + glow*2.2*exp(-d*d*2.5), clamp(glow,0.0,1.0));
  col += col * edge * rim * 1.6;
  if (coverage_only) { COLOR = vec4(1.0); } else { COLOR = vec4(col, COLOR.a * a); }
}
