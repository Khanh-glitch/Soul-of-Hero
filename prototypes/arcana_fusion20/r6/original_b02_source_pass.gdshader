shader_type canvas_item;
render_mode unshaded;

// Source-generated 30 Hz atlas buffers. No per-spell art is reconstructed here.
// THIS IS NOT exact C WebGL2 post: multi-scale HDR bloom/chroma/vignette are partial.
uniform sampler2D screen_tex: hint_screen_texture, repeat_disable, filter_nearest;
uniform sampler2D c_ink: repeat_disable, filter_nearest;
uniform sampler2D c_light: repeat_disable, filter_nearest;
uniform sampler2D c_disp_xy: repeat_disable, filter_nearest;
uniform sampler2D c_disp_params: repeat_disable, filter_nearest;
uniform sampler2D b_fx: repeat_disable, filter_nearest;
uniform sampler2D b_disp_x: repeat_disable, filter_nearest;
uniform sampler2D b_disp_y: repeat_disable, filter_nearest;
uniform sampler2D b_mask: repeat_disable, filter_nearest;
uniform sampler2D b_light: repeat_disable, filter_nearest;
uniform sampler2D b_ground: repeat_disable, filter_nearest;
uniform int spell = 2;
uniform int frame_index = 0;
uniform vec2 viewport_pixels = vec2(640.0,360.0);
uniform vec2 anchor_screen = vec2(320.0,180.0);
uniform vec2 caster_screen = vec2(162.0,208.0);
uniform float b_direction = 0.0;
uniform float b_distance_scale = 1.0;
uniform float pixel_scale = 1.0;
uniform float c_desat = 0.0;
uniform float c_invert = 0.0;
uniform float c_chroma = 0.0;
uniform vec3 global_flash = vec3(0.0);
uniform float b_ambient = 0.62;
const vec2 SOURCE_SIZE=vec2(384.0,216.0);
const float BAYER[16] = float[16](0.0,8.0,2.0,10.0,12.0,4.0,14.0,6.0,3.0,11.0,1.0,9.0,15.0,7.0,13.0,5.0);

vec4 source_read(sampler2D atlas, ivec2 p){
  ivec2 xy=clamp(p,ivec2(0),ivec2(383,215));
  ivec2 cell=ivec2(frame_index%8,frame_index/8);
  ivec2 full=cell*ivec2(384,216)+xy;
  return texelFetch(atlas,full,0);
}
float bayer(ivec2 p){return (BAYER[(p.y&3)*4+(p.x&3)]+0.5)/16.0;}
float decode16(float hi,float lo){return (floor(hi*255.0+0.5)*256.0 + floor(lo*255.0+0.5))/65535.0;}

vec2 rotate_source(vec2 v,float a){
  float c=cos(a),s=sin(a);
  return vec2(c*v.x-s*v.y,s*v.x+c*v.y);
}
void fragment(){
  vec2 pixel=SCREEN_UV*viewport_pixels;
  vec2 source_pixel;
  if(spell==17){source_pixel=(pixel-anchor_screen)/pixel_scale+vec2(250.0,106.0);}
  else{
    // A pure inverse spatial transform; original B source pixels stay authored.
    source_pixel=rotate_source((pixel-caster_screen)/(pixel_scale*b_distance_scale),-b_direction)+vec2(104.0,132.0);
  }
  vec3 world=texture(screen_tex,SCREEN_UV).rgb;
  if (source_pixel.x<0.0 || source_pixel.y<0.0 || source_pixel.x>=384.0 || source_pixel.y>=216.0){COLOR=vec4(world,1.0);return;}
  ivec2 p=ivec2(floor(source_pixel));
  float th=bayer(p)-0.5;
  if(spell==17){
    vec4 xy=source_read(c_disp_xy,p);
    vec2 delta=(vec2(decode16(xy.r,xy.g),decode16(xy.b,xy.a))*192.0 - 96.0);
    vec4 params=source_read(c_disp_params,p);
    // Identical integer displacement rounding as source C main COMPOSITE pass.
    vec2 displacement=floor(delta+vec2(0.5))*pixel_scale/viewport_pixels;
    vec3 g=texture(screen_tex,clamp(SCREEN_UV+displacement,vec2(0.0),vec2(1.0))).rgb;
    g *= params.r;
    float lum=dot(g,vec3(0.3,0.55,0.15));
    g=mix(g,lum*vec3(0.85,0.95,1.15),c_desat);
    vec4 ink=source_read(c_ink,p);
    vec3 light=(source_read(c_light,p).rgb*255.0-vec3(128.0))/15.0;
    // C's authored HDR light includes negative values; do not brightness-key it.
    vec3 lq=floor(light*8.0+th+0.5)/8.0;
    vec3 col=g*(1.0-ink.a)+ink.rgb+lq;
    vec3 over=max(col-vec3(1.0),vec3(0.0));
    col+=vec3(over.r+over.g+over.b)*0.45;
    col=clamp(col,vec3(0.0),vec3(1.0));
    col=mix(col,vec3(1.0)-col.gbr,c_invert);
    COLOR=vec4(clamp(col+global_flash,vec3(0.0),vec3(1.0)),1.0);
  }else{
    vec4 m=source_read(b_ground,p);
    vec3 l=source_read(b_light,p).rgb*6.0;
    // B original HDR ground shade+light inputs are separate from effect foreground.
    vec4 bdispx=source_read(b_disp_x,p);
    vec4 bdispy=source_read(b_disp_y,p);
    vec2 bdelta=vec2(decode16(bdispx.r,bdispx.g),decode16(bdispy.r,bdispy.g))*192.0-96.0;
    vec2 corrected_delta=rotate_source(floor(bdelta+vec2(0.5))*pixel_scale*b_distance_scale,b_direction);
    vec3 warped_world=texture(screen_tex,clamp(SCREEN_UV+corrected_delta/viewport_pixels,vec2(0.0),vec2(1.0))).rgb;
    vec3 bg=warped_world*m.a*clamp(b_ambient/0.62,0.07,1.8);
    bg += world*l*0.24;
    // Source B main float target is finalized on zero albedo in the bake.
    // SET-mode mask from original renderer: not a threshold of rendered brightness.
    vec4 fx=source_read(b_fx,p);
    float author_mask=source_read(b_mask,p).r;
    vec3 col=mix(bg,fx.rgb,author_mask);
    // ADD-mode energy is blended as emission; no full-spell doubled overlay.
    col+=fx.rgb*(1.0-author_mask);
    // Authored ground decal albedo is retained, but not claimed Gold-level exact.
    col+=m.rgb*0.45;
    COLOR=vec4(clamp(col+global_flash,vec3(0.0),vec3(1.0)),1.0);
  }
}
