// Experimental D COMP on an EXPLICIT pre-HUD texture. Original GLSL's
// uFlashCol is vec3 but is uploaded with uniform4f; original browser captures
// observe zero flash color. We retain that behavior instead of silently fixing it.
// World input color-space/scene construction and viewport ordering are unproven.
shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D world_scene : filter_nearest, repeat_disable;
uniform sampler2D bloom_small : filter_linear, repeat_disable;
uniform sampler2D bloom_wide : filter_linear, repeat_disable;
uniform float bloom_amt = 0.68;
uniform float exposure = 1.0;
uniform float levels = 26.0;
uniform float vignette = 0.55;
uniform float saturation = 1.1;
uniform float chromatic_aberration = 0.16;
uniform vec2 low_size = vec2(480.0, 270.0);
float bayer(ivec2 p) {
    int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
    return (float(m[(p.y & 3) * 4 + (p.x & 3)]) + 0.5) / 16.0;
}
vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void fragment() {
    vec2 d = UV - vec2(0.5);
    float r2 = dot(d, d);
    float ca = chromatic_aberration * (0.0016 + r2 * 0.006);
    vec3 c;
    c.r = texture(world_scene, UV - d * ca).r + texture(bloom_small, UV - d * ca * 1.6).r * bloom_amt + texture(bloom_wide, UV - d * ca * 2.4).r * bloom_amt * 0.7;
    c.g = texture(world_scene, UV).g + texture(bloom_small, UV).g * bloom_amt + texture(bloom_wide, UV).g * bloom_amt * 0.7;
    c.b = texture(world_scene, UV + d * ca).b + texture(bloom_small, UV + d * ca * 1.6).b * bloom_amt + texture(bloom_wide, UV + d * ca * 2.4).b * bloom_amt * 0.7;
    c = aces(c * exposure);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, saturation);
    vec2 px = UV * low_size;
    float bt = bayer(ivec2(floor(px))) - 0.5;
    c = floor(clamp(c, 0.0, 1.0) * levels + 0.5 + bt) / levels;
    c *= 1.0 - vignette * r2 * 0.85;
    c *= 0.965 + 0.035 * step(0.5, fract(px.y * 0.5));
    COLOR = vec4(c, 1.0);
}
