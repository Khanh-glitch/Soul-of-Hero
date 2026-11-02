// Experimental D real-world floor warp and additive g-layer. The WebGL bloom
// pyramid, persistent decals, viewport flash/vignette/scanlines and actor depth
// are NOT implemented here: this is not source parity or acceptance.
shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D live_world : hint_screen_texture, repeat_disable, filter_nearest;
uniform sampler2D light_tex : repeat_disable, filter_nearest;
uniform sampler2D star_tex : repeat_disable, filter_nearest;
uniform sampler2D star_pretransfer_tex : repeat_disable, filter_nearest;
uniform sampler2D center_tex : repeat_disable, filter_nearest;
uniform sampler2D body_tex : repeat_disable, filter_nearest;
uniform sampler2D halo_tex : repeat_disable, filter_nearest;
uniform sampler2D warp_tex : repeat_disable, filter_nearest;
uniform sampler2D influence_tex : repeat_disable, filter_nearest;
uniform vec2 screen_dx = vec2(1.0, 0.0);
uniform vec2 screen_dy = vec2(0.0, 1.0);
uniform float source_time = 0.0;
uniform float warp_amount = 1.0;
// Withdraw the accumulated field continuously only during authored D OUT;
// source warp history and its operation-based influence stay unchanged.
uniform float warp_fade = 1.0;
// R28 diagnostic LDR world adaptation: bound only the source-authored
// accumulated heat-shimmer response on the real LDR backdrop. Source fields,
// geometry, seeds and local light are unchanged; this is not HDR/D parity.
// 0 = legacy D formula; 1 = shimmer isolated off; 2 = bounded presentation.
uniform int shimmer_presentation = 2;
// 0: R28 LDR composition; 1: R29 layer-preserving local reconstruction.
// Other values are diagnostics only. This is not original HDR/bloom parity.
uniform int light_presentation = 0;
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
// A standard fixed Reinhard display transform, localized to the D field.
// No star-specific gain, geometry changes, screen-wide exposure, or HDR
// parity claim: this is an LDR presentation experiment over source sums.
vec3 reinhard_display(vec3 c, ivec2 p) {
    c = max(c, vec3(0.0));
    c = c / (vec3(1.0) + c);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = clamp(mix(vec3(l), c, 1.1), 0.0, 1.0);
    return floor(c * 26.0 + vec3(bayer(p))) / 26.0;
}
// Diagnostic: map the displayed LDR world through the analytic inverse of
// D's source ACES curve before source light is added, then use the original
// curve and 26-level Bayer quantization. This constructs a virtual compatible
// input, not recovered linear/HDR world values or production HDR parity.
float inverse_aces(float y) {
    y = clamp(y, 0.0, 1.0);
    float a = 2.43 * y - 2.51;
    float b = 0.59 * y - 0.03;
    float c = 0.14 * y;
    return max(0.0, (-b - sqrt(max(0.0, b * b - 4.0 * a * c))) / (2.0 * a));
}
vec3 virtual_source_input(vec3 display) {
    // Invert the source's 1.1 saturation around the same linear luma.
    float l = dot(display, vec3(0.2126, 0.7152, 0.0722));
    vec3 unsaturated = clamp(vec3(l) + (display - vec3(l)) / 1.1, 0.0, 1.0);
    return vec3(inverse_aces(unsaturated.r), inverse_aces(unsaturated.g), inverse_aces(unsaturated.b));
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
    float amplitude = w.w * 0.10;
    if (shimmer_presentation == 1) amplitude = 0.0;
    else if (shimmer_presentation == 2) amplitude = amplitude / (1.0 + abs(amplitude));
    warped *= 1.0 + amplitude * sin(floor_uv_y * 180.0 + source_time * 8.0);
    vec3 light = texelFetch(light_tex, p, 0).rgb;
    // Tone quantization has discontinuities even for an infinitesimal field.
    // Fade its full contribution as well as the geometric warp during the new
    // OUT, so deleting the viewer at the next tick cannot drop a bright step.
    vec3 base = tone(warped + light, p);
    vec3 reference = tone(original, p);
    if (light_presentation == 9) {
        base = reinhard_display(warped + light, p);
        reference = reinhard_display(original, p);
    } else if (light_presentation == 10) {
        // Baseline correction restores exact no-FX LDR pixels, despite the
        // source's ordered quantization. Applied only inside D influence.
        base = tone(virtual_source_input(warped) + light, p);
        reference = tone(virtual_source_input(original), p);
    } else if (light_presentation == 1 || light_presentation == 8) {
        // An independently accumulated star layer and body layer prevent
        // per-draw RGBA8 saturation from erasing their overlap. Local soft
        // luminance compression reserves headroom before the authored star
        // is layered; no screen-wide exposure or fabricated geometry.
        // Mode 8 is a separate experiment using the original shader's
        // pre-RGBA8 values; it is not output from the original HDR pipeline.
        vec3 star = light_presentation == 8 ? texelFetch(star_pretransfer_tex, p, 0).rgb : texelFetch(star_tex, p, 0).rgb;
        vec3 body = texelFetch(body_tex, p, 0).rgb + texelFetch(center_tex, p, 0).rgb;
        float star_amount = max(star.r, max(star.g, star.b));
        if (star_amount > 0.0) {
            vec3 body_soft = body / (vec3(1.0) + body);
            vec3 star_soft = star / (vec3(1.0) + star);
            vec3 layer_light = body_soft + (vec3(1.0) - body_soft) * star_soft;
            base = tone(warped + layer_light, p);
        }
    } else if (light_presentation == 2) {
        base = tone(warped, p); // warp/world only
    } else if (light_presentation == 3) {
        base = tone(light, p); // original normalized source-light only
    } else if (light_presentation == 4) {
        base = tone(texelFetch(star_tex, p, 0).rgb, p); // star only
    } else if (light_presentation == 5) {
        base = tone(texelFetch(body_tex, p, 0).rgb, p); // outer nodes/graph and other light
    } else if (light_presentation == 6) {
        base = tone(texelFetch(center_tex, p, 0).rgb, p); // central quads + radial lines
    } else if (light_presentation == 7) {
        base = tone(texelFetch(star_pretransfer_tex, p, 0).rgb, p); // pre-transfer source fragment expression
    }
    // NEW SOH material interpretation: actual source layers remain intact.
    // Local STAR coverage becomes a contrasting filled material with its
    // actual raster boundary, not an invented replacement silhouette.
    if (light_presentation == 11) {
        ivec2 px = clamp(p + ivec2(1, 0), ivec2(0), SIZE - ivec2(1));
        ivec2 py = clamp(p + ivec2(0, 1), ivec2(0), SIZE - ivec2(1));
        ivec2 mx = clamp(p - ivec2(1, 0), ivec2(0), SIZE - ivec2(1));
        ivec2 my = clamp(p - ivec2(0, 1), ivec2(0), SIZE - ivec2(1));
        vec3 body = texelFetch(body_tex, p, 0).rgb;
        vec3 center = texelFetch(center_tex, p, 0).rgb;
        vec3 halo = texelFetch(halo_tex, p, 0).rgb;
        vec3 star = texelFetch(star_tex, p, 0).rgb;
        float c = max(max(center.r, center.g), center.b);
        vec3 cn1 = texelFetch(center_tex, px, 0).rgb;
        vec3 cn2 = texelFetch(center_tex, py, 0).rgb;
        float c1 = max(max(cn1.r, cn1.g), cn1.b);
        float c2 = max(max(cn2.r, cn2.g), cn2.b);
        float etched = clamp((abs(c - c1) + abs(c - c2)) * 0.5, 0.0, 1.0);
        float sv = max(max(star.r, star.g), star.b);
        float sm = smoothstep(0.015, 0.16, sv);
        vec3 n1 = texelFetch(star_tex, px, 0).rgb;
        vec3 n2 = texelFetch(star_tex, mx, 0).rgb;
        vec3 n3 = texelFetch(star_tex, py, 0).rgb;
        vec3 n4 = texelFetch(star_tex, my, 0).rgb;
        float e1 = smoothstep(0.015, 0.16, max(max(n1.r, n1.g), n1.b));
        float e2 = smoothstep(0.015, 0.16, max(max(n2.r, n2.g), n2.b));
        float e3 = smoothstep(0.015, 0.16, max(max(n3.r, n3.g), n3.b));
        float e4 = smoothstep(0.015, 0.16, max(max(n4.r, n4.g), n4.b));
        float edge = sm * (1.0 - min(min(e1, e2), min(e3, e4)));
        vec3 graph = (vec3(1.0) - exp(-body * 0.8)) * vec3(0.70, 0.54, 0.83);
        vec3 ambient = (vec3(1.0) - exp(-halo * 0.35)) * vec3(0.16, 0.09, 0.23);
        float fade = clamp(warp_fade, 0.0, 1.0);
        vec3 result = original + fade * (warped - original);
        result += fade * (graph + ambient + (1.0 - exp(-0.7 * c)) * vec3(0.24, 0.10, 0.29) + etched * vec3(0.34, 0.18, 0.37));
        vec3 star_material = mix(vec3(0.16, 0.07, 0.24), vec3(0.52, 0.26, 0.52), clamp(sv * 0.8, 0.0, 1.0));
        star_material += edge * vec3(0.48, 0.45, 0.37);
        result = mix(result, star_material, clamp(sm * 0.88 * fade, 0.0, 1.0));
        COLOR = vec4(clamp(result, 0.0, 1.0), 1.0);
        return;
    }
    vec3 delta = base - reference;
    COLOR = vec4(clamp(original + delta * clamp(warp_fade, 0.0, 1.0), 0.0, 1.0), 1.0);
}
