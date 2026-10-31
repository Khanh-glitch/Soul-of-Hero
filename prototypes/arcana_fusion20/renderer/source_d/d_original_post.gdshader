// Original D COMP_FS over explicit scene / two bloom inputs. This is a
// viewport post stage, not an effect coverage mask and not a battlefield.
shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D scene_tex : filter_nearest, repeat_disable;
uniform sampler2D bloom_tex : filter_linear, repeat_disable;
uniform sampler2D bloom2_tex : filter_linear, repeat_disable;
uniform vec2 low_size = vec2(480.0, 270.0);
uniform float bloom_amount = 0.68;
uniform float exposure = 1.0;
uniform float levels = 26.0;
uniform float flash_amount = 0.0;
uniform vec3 flash_color = vec3(0.0);
uniform float vignette = 0.55;
uniform float saturation = 1.1;
uniform float chromatic_aberration = 0.16;

vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float bayer(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int i = y * 4 + x;
    int m[16] = {0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5};
    return (float(m[i]) + 0.5) / 16.0;
}
void fragment() {
    vec2 uv = UV;
    vec2 d = uv - 0.5;
    float r2 = dot(d, d);
    float ca = chromatic_aberration * (0.0016 + r2 * 0.006);
    vec3 c;
    c.r = texture(scene_tex, uv - d * ca).r + texture(bloom_tex, uv - d * ca * 1.6).r * bloom_amount + texture(bloom2_tex, uv - d * ca * 2.4).r * bloom_amount * 0.7;
    c.g = texture(scene_tex, uv).g + texture(bloom_tex, uv).g * bloom_amount + texture(bloom2_tex, uv).g * bloom_amount * 0.7;
    c.b = texture(scene_tex, uv + d * ca).b + texture(bloom_tex, uv + d * ca * 1.6).b * bloom_amount + texture(bloom2_tex, uv + d * ca * 2.4).b * bloom_amount * 0.7;
    c = aces(c * exposure);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, saturation);
    // Original WebGL vUV is bottom-up; Godot texture UV is top-down.
    vec2 px = vec2(uv.x, 1.0 - uv.y) * low_size;
    float bt = bayer(floor(px)) - 0.5;
    c = floor(clamp(c, 0.0, 1.0) * levels + 0.5 + bt) / levels;
    c += flash_color * flash_amount;
    c *= 1.0 - vignette * r2 * 0.85;
    c *= 0.965 + 0.035 * step(0.5, fract(px.y * 0.5));
    COLOR = vec4(c, 1.0);
}
