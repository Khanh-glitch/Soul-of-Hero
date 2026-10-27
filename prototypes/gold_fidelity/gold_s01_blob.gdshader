shader_type canvas_item;
render_mode unshaded, blend_disabled;

// Literal mathematical translation of src/engine/shaders.ts FRAG.blob()
// shapes 1 shock-ring, 2 smoke, 5 starburst; NO hand-drawn replacement art.
// Requires 480x270 logical pixels, nearest-filtered 2D mesh UV in [-1,1].
uniform float u_time = 0.0;
uniform float u_progress = 0.0;
uniform float u_seed = 0.0;
uniform float u_alpha = 1.0;
uniform float u_heat = 1.0;
uniform float u_k1 = 0.2;
uniform float u_k2 = 0.0;
uniform int u_shape = 2;
uniform int u_palette = 2;
uniform float u_scene_height = 270.0;

const vec3 FIRE[7]=vec3[7](vec3(.05,.014,.03),vec3(.27,.03,.07),vec3(.55,.06,.09),vec3(.84,.15,.08),vec3(.99,.45,.1),vec3(1.,.76,.26),vec3(1.,.96,.78));
const vec3 AIR[6]=vec3[6](vec3(.035,.04,.06),vec3(.09,.105,.15),vec3(.22,.26,.35),vec3(.5,.57,.68),vec3(.8,.86,.93),vec3(.98,.99,1.));
const vec3 SOOT[5]=vec3[5](vec3(.02,.02,.03),vec3(.065,.06,.075),vec3(.13,.12,.15),vec3(.25,.24,.29),vec3(.44,.44,.51));
const vec3 DUST[5]=vec3[5](vec3(.09,.09,.11),vec3(.18,.18,.21),vec3(.31,.31,.36),vec3(.5,.5,.56),vec3(.72,.72,.79));

float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s/.9375;}
float bayer(vec2 p){ivec2 q=ivec2(mod(p,4.));int i=q.x+q.y*4;float b[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);return (b[i]+.5)/16.;}
float dh(float h,float n,vec2 pix){return h+(bayer(pix)-.5)*(1./n)*.95;}
vec3 pal(int p,float h){h=clamp(h,0.,.999);if(p==0)return FIRE[int(h*7.)];if(p==1)return AIR[int(h*6.)];if(p==2)return SOOT[int(h*5.)];return DUST[int(h*5.)];}
void fragment(){
    int sh=u_shape;float prog=u_progress,seed=u_seed,t=u_time;
    int pl=u_palette;float heat=u_heat,k1=u_k1,alpha=u_alpha;
    vec2 q=UV;float r=length(q);float ang=atan(q.y,q.x);
    vec2 fpos=vec2(FRAGCOORD.x,u_scene_height-FRAGCOORD.y);
    float bz=bayer(fpos);
    vec3 c=vec3(0.);
    if(sh==1){
        // ORIGINAL shock ring: noisy ring threshold with Bayer-quantized AIR.
        float th=k1;
        float rr=(r-(1.-th))/th;
        float n=fbm(vec2(ang*3.+seed*7.,t*.7+seed));
        rr+=(n-.5)*.7;
        if(r>1.||rr<0.||rr>1.) discard;
        if(pl==0)c=pal(0,dh(.25+.75*rr*heat+(rr>.82?.3:0.),7.,fpos));
        else c=pal(pl,dh(rr>.8?.99:.18+.55*rr*n+.1,6.,fpos));
        if(rr<.25&&pl==1)c=pal(1,dh(.1+.15*n,6.,fpos));
    }else if(sh==2){
        // ORIGINAL smoke: animated FBM density, cold-to-hot palette quantization.
        float n=fbm(q*2.6+seed*9.+vec2(0.,-t*.35));
        float d=r*1.3+(n-.5)*.7-prog*.5;
        if(d>1.) discard;
        float lit=clamp(.55-q.y*.35-q.x*.2+(n-.5)*.7,0.,1.);
        float k=lit*(1.-prog*.5);
        c=pal(pl,dh(k*.9+.05,5.,fpos));
        if(d>.82)c=pal(pl,dh(k*.55,5.,fpos));
    }else if(sh==5){
        // ORIGINAL starburst: six spikes in Hairline S01, seeded asymmetry.
        float spikes=k1;
        float sp=pow(abs(cos(ang*spikes*.5+seed*3.)),6.)*(.6+.4*h21(vec2(floor(ang*spikes*.5/3.14159*2.),seed)));
        float len=.22+.78*sp;
        float fade=1.-prog;
        if(r>len*(.4+.6*fade)) discard;
        float k=1.-r/len;
        c=pal(pl,dh(.35+k*.65,6.,fpos));
        if(r<.22*fade+.05)c=vec3(1.);
    }else{discard;}
    if(bz>alpha)discard;
    COLOR=vec4(c,1.);
}
