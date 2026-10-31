// Experimental A framebuffer source fields against the actual world; not a
// source-fidelity, source-geometry or actor-occlusion acceptance claim.
// Original screen impact frames/flash/chroma require the viewport owner.
shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D live_world : hint_screen_texture, repeat_disable, filter_nearest;
uniform sampler2D source_ink : repeat_disable, filter_nearest;
uniform sampler2D influence_multiplier : repeat_disable, filter_nearest;
uniform sampler2D bloom_tex : repeat_disable, filter_linear;
uniform float bloom_amount = 0.75;
uniform float exposure = 1.0;
uniform vec2 screen_dx = vec2(1.0, 0.0);
uniform vec2 screen_dy = vec2(0.0, 1.0);
const ivec2 SIZE = ivec2(416,234);

float tone(float x) {
    if (x <= 0.0) { return 0.0; }
    float v = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
    return min(1.0, pow(v, 1.0 / 1.42));
}
void fragment() {
    ivec2 p = clamp(ivec2(floor(UV * vec2(SIZE))), ivec2(0), SIZE - ivec2(1));
    vec4 mask = texelFetch(influence_multiplier, p, 0);
    // Mask derives from source raster operations, dilated only to bound the
    // original bloom kernel. It is not keyed from the color framebuffer.
    if (mask.a == 0.0) { discard; }
    vec4 ink = texelFetch(source_ink, p, 0);
    vec2 bloom_uv = (vec2(p) + vec2(0.5)) / (vec2(textureSize(bloom_tex, 0)) * 4.0);
    vec3 bloom = texture(bloom_tex, clamp(bloom_uv, vec2(0.0), vec2(1.0))).rgb;
    vec3 original = texture(live_world, SCREEN_UV).rgb;
    vec2 offset = (screen_dx * mask.g + screen_dy * mask.b) * SCREEN_PIXEL_SIZE;
    vec3 warped = texture(live_world, clamp(SCREEN_UV + offset, vec2(0.0), vec2(1.0))).rgb;
    vec3 src = (warped * mask.r * (1.0 - ink.a) + ink.rgb + bloom * bloom_amount) * exposure;
    vec3 neutral = original * exposure;
    vec3 mapped = vec3(tone(src.r), tone(src.g), tone(src.b));
    vec3 base = vec3(tone(neutral.r), tone(neutral.g), tone(neutral.b));
    COLOR = vec4(clamp(original + mapped - base, 0.0, 1.0), 1.0);
}
