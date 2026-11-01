// Opt-in B/C stage impulses applied to the actual world viewport before HUD.
// Source-authored screen flash/shake/chroma/invert only. B's source applies
// flash before exponential tone mapping; its LDR inverse-tone approximation
// below preserves more scene detail than directly adding/clipping RGB, but
// is not same-frame linear-HDR parity. C desaturation applies to the already
// composited world; bloom/vignette and overlap fidelity are NOT implemented.
shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D world_screen : hint_screen_texture, repeat_disable, filter_nearest;
uniform vec2 shake_pixels = vec2(0.0);
uniform float chroma_pixels = 0.0;
uniform vec3 flash = vec3(0.0);
uniform vec3 b_flash = vec3(0.0);
// Inverse of the actual B source-to-viewport basis, including camera/zoom.
// B's final quantization pattern is in source pixels, not display pixels.
uniform vec2 b_dither_x = vec2(1.0, 0.0);
uniform vec2 b_dither_y = vec2(0.0, 1.0);
uniform vec2 b_dither_origin = vec2(0.0);
float bayer_b(ivec2 p) {
    int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
    return (float(m[(p.y & 3) * 4 + (p.x & 3)]) + 0.5) / 16.0;
}
uniform float invert = 0.0;
uniform float desat = 0.0;
void fragment() {
    vec2 uv = clamp(SCREEN_UV - shake_pixels * SCREEN_PIXEL_SIZE, vec2(0.0), vec2(1.0));
    vec3 c = texture(world_screen, uv).rgb;
    if (chroma_pixels > 0.2) {
        vec2 d = vec2(ceil(chroma_pixels) * SCREEN_PIXEL_SIZE.x, 0.0);
        c.r = texture(world_screen, clamp(uv + d, vec2(0.0), vec2(1.0))).r;
        c.b = texture(world_screen, clamp(uv - d, vec2(0.0), vec2(1.0))).b;
    }
    float lum = dot(c, vec3(0.3, 0.55, 0.15));
    c = mix(c, vec3(lum) * vec3(0.85, 0.95, 1.15), clamp(desat, 0.0, 1.0));
    c = mix(c, vec3(1.0) - c.gbr, clamp(invert, 0.0, 1.0));
    // 1 - exp(-1.05 * (L + F)) expressed using c = 1 - exp(-1.05 * L).
    // This is an approximation because c is already the real LDR viewport,
    // and source B also uses HDR highlight spread and ordered dithering.
    if (any(greaterThan(b_flash, vec3(0.0)))) {
        vec3 source_flash = vec3(1.0) - (vec3(1.0) - c) * exp(-1.05 * max(b_flash, vec3(0.0)));
        // Apply the difference between B finalize()'s actual 20-level
        // quantized flashed and unflashed results. The live SOH world is not
        // itself a B framebuffer: preserving its original LDR base avoids a
        // whole-world posterization pop as the flash crosses zero. This still
        // cannot recover HDR highlights or make the approximation exact.
        vec2 src = b_dither_origin + b_dither_x * FRAGCOORD.x + b_dither_y * FRAGCOORD.y;
        float d = bayer_b(ivec2(floor(src))) - 0.5;
        vec3 quantized_flash = floor(clamp(source_flash * 20.0 + vec3(d), 0.0, 20.0)) / 20.0;
        vec3 quantized_base = floor(clamp(c * 20.0 + vec3(d), 0.0, 20.0)) / 20.0;
        c += quantized_flash - quantized_base;
    }
    COLOR = vec4(clamp(c + flash, 0.0, 1.0), 1.0);
}
