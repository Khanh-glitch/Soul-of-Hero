shader_type canvas_item;
render_mode unshaded, blend_disabled;

// Direct translation of src/engine/shaders.ts FRAG.plate(): st=0, palette AIR.
// GOLD #01 only. Keeps gold Voronoi, jagged mask, Bayer dither and palette.
// Coordinate reference is a 480x270 nearest-sampled gold viewport.
uniform float u_time = 0.0;
uniform float u_prog = 0.0;
uniform float u_seed = 0.0;
uniform float u_wpx = 1.0;
uniform float u_hpx = 1.0;
uniform float u_crack = 0.1;
uniform float u_alpha = 0.9;
uniform int u_mask = 0;
uniform float u_scene_height = 270.0;
const vec3 AIR[6] = vec3[6](
 vec3(0.035,0.04,0.06), vec3(0.09,0.105,0.15),
 vec3(0.22,0.26,0.35), vec3(0.5,0.57,0.68),
 vec3(0.8,0.86,0.93), vec3(0.98,0.99,1.0));
const vec3 FIRE[7] = vec3[7](
 vec3(0.05,0.014,0.03), vec3(0.27,0.03,0.07),
 vec3(0.55,0.06,0.09), vec3(0.84,0.15,0.08),
 vec3(0.99,0.45,0.1), vec3(1.0,0.76,0.26),
 vec3(1.0,0.96,0.78));
float h21(vec2 p){
 p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y);
}
float vn(vec2 p){
 vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
 return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),
 mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);
}
float fbm(vec2 p){
 float a=0.5,s=0.0;
 for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(7.1,3.7);a*=0.5;}
 return s/0.9375;
}
float bayer(vec2 p){
 ivec2 q=ivec2(mod(p,4.0));int i=q.x+q.y*4;
 float b[16]=float[16](0.0,8.0,2.0,10.0,12.0,4.0,14.0,6.0,3.0,11.0,1.0,9.0,15.0,7.0,13.0,5.0);
 return (b[i]+0.5)/16.0;
}
float dh(float h,float n,vec2 fpos){return h+(bayer(fpos)-0.5)*(1.0/n)*0.95;}
vec3 pal_air(float h){return AIR[int(clamp(h,0.0,0.999)*6.0)];}
vec3 pal_fire(float h){return FIRE[int(clamp(h,0.0,0.999)*7.0)];}
vec3 vor(vec2 p){
 vec2 i=floor(p),f=fract(p);float d1=8.0,d2=8.0,id=0.0;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 g=vec2(float(x),float(y));
  vec2 of=vec2(h21(i+g),h21(i+g+17.3));
  vec2 r=g+of-f;float d=dot(r,r);
  if(d<d1){d2=d1;d1=d;id=h21(i+g+3.1);}else if(d<d2)d2=d;
 }
 return vec3(sqrt(d1),sqrt(d2)-sqrt(d1),id);
}
void fragment(){
 float u=UV.x,v=UV.y,wpx=u_wpx,hpx=u_hpx;
 vec2 fpos=vec2(FRAGCOORD.x,u_scene_height-FRAGCOORD.y);
 float bz=bayer(fpos),m;
 if(u_mask==0)m=min(min(u*wpx,(1.0-u)*wpx),min(v*hpx,(1.0-v)*hpx));
 else if(u_mask==1){
  float hw=1.0-pow(abs(2.0*u-1.0),1.4);
  m=(hw-abs(2.0*v-1.0))*hpx*0.5;
  m=min(m,min(u,1.0-u)*wpx*0.5);
 }else{
  float hw=pow(clamp(1.0-u,0.0,1.0),0.65);
  m=min((hw-abs(2.0*v-1.0))*hpx*0.5,u*wpx);
 }
 float jag=(fbm(vec2(u*wpx,v*hpx)*0.09+u_seed*13.0)-0.5)*5.0*(1.0+u_prog);
 m+=jag;
 if(m<0.0)discard;
 vec2 p=vec2(u*wpx,v*hpx)/13.0+u_seed*20.0;
 vec3 vv=vor(p+vec2(u_time*0.15,0.0));
 float cw=0.04+0.1*u_crack;
 float n=fbm(p*1.2-u_time*0.1);
 vec3 col;
 if(m<1.8)col=pal_air(dh(0.99,6.0,fpos));
 else if(m<4.0)col=pal_air(dh(0.55+0.2*n,6.0,fpos));
 else if(vv.y<cw)col=pal_air(dh(0.7+0.3*u_crack,6.0,fpos));
 else{
  col=pal_air(dh(0.1+0.26*vv.z+0.16*n+0.1*(1.0-v),6.0,fpos));
  if(vv.z>0.82&&u_crack>0.2)col=pal_fire(dh(0.3+0.16*n,7.0,fpos));
  if(bz>u_alpha*0.95)discard;
 }
 if(bz>u_alpha)discard;
 COLOR=vec4(col,1.0);
}
