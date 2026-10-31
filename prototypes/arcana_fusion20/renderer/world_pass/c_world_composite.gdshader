// AVFX experimental source-C live-world pass. Ground/decal/ink/signed light
// and displacement come from CFrame; SCREEN_TEXTURE is the actual current
// viewport behind this canvas item. HUD must be on a later CanvasLayer.
// Global flash/shake/chroma and bloom require the viewport owner and are NOT
// implemented by this diagnostic pass. Never use as an approval claim.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

uniform sampler2D live_world : hint_screen_texture, repeat_disable, filter_nearest;
uniform sampler2D ground_tex : repeat_disable, filter_nearest;
uniform sampler2D ink_tex : repeat_disable, filter_nearest;
uniform sampler2D light_tex : repeat_disable, filter_nearest;
uniform sampler2D disp_tex : repeat_disable, filter_nearest;
uniform sampler2D fragment_tex : repeat_disable, filter_nearest;
uniform sampler2D influence_tex : repeat_disable, filter_nearest;
uniform vec2 screen_dx = vec2(1.0, 0.0);
uniform vec2 screen_dy = vec2(0.0, 1.0);
const ivec2 SIZE = ivec2(384, 216);

float bayer(ivec2 p) {
    int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
    return (float(m[(p.y & 3) * 4 + (p.x & 3)]) + 0.5) / 16.0;
}
vec2 screen_delta(vec2 d, vec2 screen_pixel_size) {
    return (screen_dx * d.x + screen_dy * d.y) * screen_pixel_size;
}
vec3 world_at(vec2 offs, vec2 screen_uv, vec2 screen_pixel_size) {
    return texture(live_world, clamp(screen_uv + screen_delta(offs, screen_pixel_size), vec2(0.0), vec2(1.0))).rgb;
}
vec3 ground_at(ivec2 q, ivec2 sp, vec2 screen_uv, vec2 screen_pixel_size) {
    ivec2 p = clamp(sp, ivec2(0), SIZE - ivec2(1));
    vec4 mark = texelFetch(ground_tex, p, 0);
    vec3 actual_world = world_at(vec2(p - q), screen_uv, screen_pixel_size);
    return actual_world * (1.0 - mark.a) + mark.rgb;
}
vec3 light_at(ivec2 p) {
    return texelFetch(light_tex, clamp(p, ivec2(0), SIZE - ivec2(1)), 0).rgb;
}
void fragment() {
    ivec2 q = clamp(ivec2(floor(UV * vec2(SIZE))), ivec2(0), SIZE - ivec2(1));
    // Operation footprint is recorded by source raster methods, not extracted
    // by checking image brightness. No framebuffer rectangle is painted.
    if (texelFetch(influence_tex, q, 0).r == 0.0) { discard; }
    vec4 d = texelFetch(disp_tex, q, 0);
    ivec2 sp = q + ivec2(floor(d.xy + 0.5));
    float ch = d.w;
    vec3 g;
    vec3 l;
    if (ch > 0.2) {
        ivec2 o = ivec2(int(ceil(ch)), 0);
        g = vec3(ground_at(q, sp + o, SCREEN_UV, SCREEN_PIXEL_SIZE).r, ground_at(q, sp, SCREEN_UV, SCREEN_PIXEL_SIZE).g, ground_at(q, sp - o, SCREEN_UV, SCREEN_PIXEL_SIZE).b);
        l = vec3(light_at(q + o).r, light_at(q).g, light_at(q - o).b);
    } else {
        g = ground_at(q, sp, SCREEN_UV, SCREEN_PIXEL_SIZE);
        l = light_at(q);
    }
    g *= d.z;
    vec4 ink = texelFetch(ink_tex, q, 0);
    vec4 frag = texelFetch(fragment_tex, q, 0);
    vec3 fragment_world = world_at(frag.xy - vec2(q), SCREEN_UV, SCREEN_PIXEL_SIZE);
    // Authored C Reality Ripper inverted baseAt fragment; no RGB keying.
    if (frag.w > 0.5) {
        vec3 inv_world = clamp(vec3(1.0) - fragment_world * 3.0, 0.0, 1.0);
        fragment_world = inv_world * vec3(0.45, 0.2, 0.5) + vec3(0.2, 0.0, 0.15);
    }
    vec3 col = g * max(0.0, 1.0 - ink.a - frag.z) + ink.rgb + fragment_world * frag.z;
    float th = bayer(q) - 0.5;
    col += floor(l * 8.0 + th + 0.5) / 8.0;
    vec3 over = max(col - 1.0, 0.0);
    col += vec3(over.r + over.g + over.b) * 0.45;
    COLOR = vec4(clamp(col, 0.0, 1.0), 1.0);
}
