// Experimental D real-world floor warp and additive g-layer. The WebGL bloom
// pyramid, persistent decals, viewport flash/vignette/scanlines and actor depth
// are NOT implemented here: this is not source parity or acceptance.
shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D live_world : hint_screen_texture, repeat_disable, filter_nearest;
uniform sampler2D light_tex : repeat_disable, filter_nearest;
uniform sampler2D warp_tex : repeat_disable, filter_nearest;
uniform sampler2D influence_tex : repeat_disable, filter_nearest;
uniform vec2 screen_dx = vec2(1.0, 0.0);
uniform vec2 screen_dy = vec2(0.0, 1.0);
uniform float source_time = 0.0;
uniform float warp_amount = 1.0;
// Withdraw the accumulated field continuously only during authored D OUT;
// source warp history and its operation-based influence stay unchanged.
uniform float warp_fade = 1.0;
const ivec2 SIZE = ivec2(480,270);
float bayer(ivec2 p) {
    int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
    return (float(m[(p.y & 3) * 4 + (p.x & 3)]) + 0.5) / 16.0;
}
vec3 tone(vec3 c, ivec2 p) {
    c = clamp((c * (2.51 * c + vec3(0.03))) / (c * (2.43 * c + vec3(0.59)) + vec3(0.14)), 0.0, 1.0);
    float l = dot(c, vec3(0.2126,0.7152,0.0722));
    c = mix(vec3(l), c, 1.1);
    c = clamp(c, 0.0, 1.0);
    return floor(c * 26.0 + vec3(bayer(p))) / 26.0;
}
vec3 sample_world(vec2 delta, vec2 screen_uv, vec2 pixel_size) {
    vec2 offset = (screen_dx * delta.x + screen_dy * delta.y) * pixel_size;
    return texture(live_world, clamp(screen_uv + offset, vec2(0.0), vec2(1.0))).rgb;
}
void fragment() {
    ivec2 p = clamp(ivec2(floor(UV * vec2(SIZE))), ivec2(0), SIZE - ivec2(1));
    if (texelFetch(influence_tex, p, 0).a == 0.0) { discard; }
    vec4 w = texelFetch(warp_tex, p, 0) * clamp(warp_fade, 0.0, 1.0);
    vec2 off = -w.xy * warp_amount;
    vec3 original = texture(live_world, SCREEN_UV).rgb;
    // Original FLOOR_FS samples three chromatic offsets and applies absorb
    // and the authored w.w shimmer to the actual world, not a fake floor.
    vec3 warped;
    warped.r = sample_world(off * 1.35, SCREEN_UV, SCREEN_PIXEL_SIZE).r;
    warped.g = sample_world(off, SCREEN_UV, SCREEN_PIXEL_SIZE).g;
    warped.b = sample_world(off * 0.65, SCREEN_UV, SCREEN_PIXEL_SIZE).b;
    warped *= 1.0 - clamp(w.z, 0.0, 0.985);
    float floor_uv_y = 1.0 - (float(p.y) + 0.5) / float(SIZE.y);
    warped *= 1.0 + w.w * 0.10 * sin(floor_uv_y * 180.0 + source_time * 8.0);
    vec3 light = texelFetch(light_tex, p, 0).rgb;
    // Tone quantization has discontinuities even for an infinitesimal field.
    // Fade its full contribution as well as the geometric warp during the new
    // OUT, so deleting the viewer at the next tick cannot drop a bright step.
    vec3 delta = tone(warped + light, p) - tone(original, p);
    COLOR = vec4(clamp(original + delta * clamp(warp_fade, 0.0, 1.0), 0.0, 1.0), 1.0);
}
