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
        c = vec3(1.0) - (vec3(1.0) - c) * exp(-1.05 * max(b_flash, vec3(0.0)));
    }
    COLOR = vec4(clamp(c + flash, 0.0, 1.0), 1.0);
}
