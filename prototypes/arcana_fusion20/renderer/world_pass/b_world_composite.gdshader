// Experimental B native-world source pass, not acceptance. The tone-map delta
// is relative to B's neutral source lighting so an unaffected SOH pixel stays
// unchanged. World displacement samples the actual screen behind this item.
// Global screen flash/shake, post bloom and actor depth are external.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

uniform sampler2D live_world : hint_screen_texture, repeat_disable, filter_nearest;
uniform sampler2D ink_tex : repeat_disable, filter_nearest;
uniform sampler2D ground_tex : repeat_disable, filter_nearest;
uniform sampler2D light_shade_tex : repeat_disable, filter_nearest;
uniform sampler2D warp_influence_tex : repeat_disable, filter_nearest;
uniform vec2 screen_dx = vec2(1.0, 0.0);
uniform vec2 screen_dy = vec2(0.0, 1.0);
uniform vec3 ambient_tint = vec3(0.527, 0.558, 0.713);
const ivec2 SIZE = ivec2(384, 216);

float bayer(ivec2 p) {
    int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
    return (float(m[(p.y & 3) * 4 + (p.x & 3)]) + 0.5) / 16.0;
}
vec3 tone(vec3 c, ivec2 p) {
    float mx = max(c.r, max(c.g, c.b));
    float ex = mx > 1.1 ? (mx - 1.1) * 0.32 : 0.0;
    vec3 v = vec3(1.0) - exp(-(c + vec3(ex)) * 1.05);
    float d = bayer(p) - 0.5;
    return floor(clamp(v * 20.0 + vec3(d), 0.0, 20.0)) / 20.0;
}
vec3 world_at(vec2 delta, vec2 screen_uv, vec2 pixel_size) {
    vec2 offset = (screen_dx * delta.x + screen_dy * delta.y) * pixel_size;
    return texture(live_world, clamp(screen_uv + offset, vec2(0.0), vec2(1.0))).rgb;
}
void fragment() {
    ivec2 p = clamp(ivec2(floor(UV * vec2(SIZE))), ivec2(0), SIZE - ivec2(1));
    vec4 wi = texelFetch(warp_influence_tex, p, 0);
    // The mask records authored operations, not RGB-derived transparency.
    if (wi.a == 0.0) { discard; }
    ivec2 sp = clamp(p + ivec2(wi.xy), ivec2(0), SIZE - ivec2(1));
    vec3 original = world_at(vec2(0.0), SCREEN_UV, SCREEN_PIXEL_SIZE);
    vec3 warped = world_at(vec2(sp - p), SCREEN_UV, SCREEN_PIXEL_SIZE);
    vec4 decal = texelFetch(ground_tex, sp, 0);
    vec4 lighting = texelFetch(light_shade_tex, sp, 0);
    vec4 ink = texelFetch(ink_tex, p, 0);
    vec3 surface = warped * (1.0 - decal.a) + decal.rgb;
    vec3 authored = ink.rgb + surface * lighting.a * (ambient_tint + lighting.rgb) * (1.0 - ink.a);
    vec3 neutral = original * ambient_tint;
    vec3 col = original + tone(authored, p) - tone(neutral, p);
    COLOR = vec4(clamp(col, 0.0, 1.0), 1.0);
}
