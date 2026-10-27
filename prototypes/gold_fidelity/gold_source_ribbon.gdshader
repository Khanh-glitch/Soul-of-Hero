shader_type canvas_item;
render_mode unshaded, blend_mix;

// Source: src/engine/shaders.ts FRAG ribbon() (mode=3), all styles 0..5.
// WebGL logical size is 480x270 with nearest/ordered-dither raster.
uniform float u_time = 0.0;
uniform float u_seed = 0.5;
uniform int u_style = 4;
uniform float u_extra = 1.0;
uniform float u_heat = 1.0;
uniform float u_crust = 0.0;
uniform float u_tr = 0.7;
uniform vec2 u_resolution = vec2(480.0, 270.0);

float h21(vec2 p) {
    p = fract(p*vec2(123.34,456.21));
    p += dot(p,p+45.32);
    return fract(p.x*p.y);
}
float vn(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),
               mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);
}
float fbm(vec2 p) {
    float a=0.5;
    float s=0.0;
    for (int i=0; i<4; i++) {
        s += a*vn(p);
        p = p*2.03+vec2(7.1,3.7);
        a *= 0.5;
    }
    return s/0.9375;
}
float bayer(vec2 p) {
    ivec2 q = ivec2(mod(p,4.0));
    int i = q.x+q.y*4;
    float b[16] = float[16](0.0,8.0,2.0,10.0,12.0,4.0,14.0,6.0,
        3.0,11.0,1.0,9.0,15.0,7.0,13.0,5.0);
    return (b[i]+0.5)/16.0;
}
float dh(float h,float n,vec2 frag) {
    return h+(bayer(frag)-0.5)*(1.0/n)*0.95;
}
vec3 pal(int p,float h) {
    h=clamp(h,0.0,0.999);
    vec3 FIRE[7]=vec3[7](vec3(.05,.014,.03),vec3(.27,.03,.07),vec3(.55,.06,.09),
         vec3(.84,.15,.08),vec3(.99,.45,.1),vec3(1.,.76,.26),vec3(1.,.96,.78));
    vec3 AIR[6]=vec3[6](vec3(.035,.04,.06),vec3(.09,.105,.15),vec3(.22,.26,.35),
         vec3(.5,.57,.68),vec3(.8,.86,.93),vec3(.98,.99,1.));
    vec3 SOOT[5]=vec3[5](vec3(.02,.02,.03),vec3(.065,.06,.075),vec3(.13,.12,.15),
         vec3(.25,.24,.29),vec3(.44,.44,.51));
    vec3 DUST[5]=vec3[5](vec3(.09,.09,.11),vec3(.18,.18,.21),vec3(.31,.31,.36),
         vec3(.5,.5,.56),vec3(.72,.72,.79));
    if (p==0) {return FIRE[int(h*7.0)];}
    if (p==1) {return AIR[int(h*6.0)];}
    if (p==2) {return SOOT[int(h*5.0)];}
    return DUST[int(h*5.0)];
}
void fragment() {
    float u=UV.x, v=UV.y, e=abs(v);
    float alpha=COLOR.a, nrm=COLOR.r;
    float extra=u_extra, heat=u_heat, crust=u_crust, tr=u_tr;
    float t=u_time, seed=u_seed;
    // WebGL gl_FragCoord has bottom-left origin, Godot FRAGCOORD top-left.
    vec2 frag=vec2(floor(FRAGCOORD.x)+0.5,u_resolution.y-(floor(FRAGCOORD.y)+0.5));
    float bz=bayer(frag);
    vec3 c=vec3(0.0);
    float ia=1.0;
    if (u_style==0) {
        float n=fbm(vec2(u*.05-t*1.2,v*1.6+seed*17.0));
        float ee=e+(n-.5)*.5*smoothstep(.3,.9,e);
        if (ee>1.0) {discard;}
        float str=vn(vec2(u*.3-t*2.5+seed*5.0,v*6.0+seed));
        float hot=.78+.22*smoothstep(.4,1.0,nrm);
        if (ee>.86) {c=pal(1,dh(hot,6.0,frag));}
        else if (ee>.7) {c=pal(1,dh(.42+.22*n+.12*str,6.0,frag));}
        else {
            c=pal(1,dh(.08+.28*n+.3*str*n,6.0,frag));
            ia=tr;
            if (extra>0.0 && str>.6-extra*.1 && n>.45) {c=pal(0,dh(.2+.2*str,7.0,frag));}
        }
    } else if (u_style==1) {
        float n=fbm(vec2(u*.06-t*1.8,v*2.0+seed*11.0));
        float n2=fbm(vec2(u*.11-t*3.2,v*3.0+n*2.5+seed*3.0));
        float dens=(1.0-e)+(n2-.5)*.95-(1.0-heat)*.25;
        if (dens<.08) {discard;}
        float h=dens*heat*1.12+(n-.5)*.2;
        float edge_f=1.0-smoothstep(.08,.5,dens);
        float cm=crust*(edge_f*1.25+(n-.45)*.9);
        if (cm>.45) {c=pal(0,dh(.04+.12*n2,7.0,frag));}
        else {c=pal(0,dh(h,7.0,frag));}
        ia=1.0;
    } else if (u_style==2) {
        float n=fbm(vec2(u*.04-t*.8,v*1.5+seed*9.0));
        float n2=fbm(vec2(u*.1+n*3.0,v*3.0-t*.9));
        float dens=(1.0-e)+(n2-.5)*.95;
        if (dens<.1) {discard;}
        float fil=abs(fract(v*2.5+n*3.0+seed*7.0)-.5);
        c=pal(2,dh(.06+.5*dens*n2,5.0,frag));
        if (dens<.28) {c=pal(2,dh(.5+.2*n,5.0,frag));}
        if (fil<.045 && n2>.42) {c=pal(1,dh(.7+.3*nrm,6.0,frag));}
        ia=tr;
    } else if (u_style==3) {
        float n=vn(vec2(u*.2,v*3.0+seed*7.0));
        float ee=e+(n-.5)*.4;
        if (ee>1.0) {discard;}
        float pulse=.5+.5*sin(u*.12-t*5.0+seed*6.28);
        float h=(1.0-ee)*heat*(.5+.65*pulse);
        if (ee>.74) {c=pal(0,dh(.03+.08*n,7.0,frag));}
        else {c=pal(0,dh(h+.14,7.0,frag));}
    } else if (u_style==4) {
        float n=vn(vec2(u*.4-t*6.0,seed*9.0));
        float ee=e+(n-.5)*.25*e;
        if (ee>1.0) {discard;}
        if (ee<.2) {c=pal(1,.99);}
        else if (ee<.42) {c=pal(1,dh(.8,6.0,frag));}
        else if (ee<.72) {
            c=(extra>0.0 && n>.35)?pal(0,dh(.3+.12*n,7.0,frag)):pal(1,dh(.3+.2*n,6.0,frag));
        } else {
            c=(extra>0.0 && n>.5)?pal(0,dh(.2,7.0,frag)):pal(1,dh(.12,6.0,frag));
        }
    } else {
        if (e>.78) {c=vec3(.33,.03,.07);}
        else if (v<-.15) {c=vec3(.93,.19,.2);}
        else {c=vec3(.72,.08,.12);}
        if (abs(fract(u*.18)-.5)<.07 && e<.6) {c*=.82;}
    }
    if (bz>alpha*ia) {discard;}
    COLOR=vec4(c,1.0);
}
