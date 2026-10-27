shader_type canvas_item;
render_mode blend_disabled;

// Direct port of src/engine/shaders.ts POST_FRAG from the user's gold source.
// Godot's upper-left screen UV replaces the original bottom-left OpenGL texture fetch.
// MUST render at the gold's logical 480x270 resolution.
uniform sampler2D screen_tex : hint_screen_texture, filter_nearest, repeat_disable;
uniform vec2 u_res = vec2(480.0, 270.0);
uniform float u_time = 0.0;
uniform float u_amb = 0.95;
uniform float u_haze = 0.0;
uniform vec2 u_shake = vec2(0.0);
uniform vec4 u_flash = vec4(1.0, 1.0, 1.0, 0.0);
uniform vec4 u_light[12];
uniform vec3 u_light_c[12];
uniform int u_nl = 0;
uniform vec4 u_ring[12];
uniform float u_ring_s[12];
uniform int u_nr = 0;
uniform vec4 u_seg[8];
uniform vec2 u_seg_p[8];
uniform int u_ns = 0;

float h21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
        mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float bayer(vec2 p) {
    ivec2 q = ivec2(mod(p, 4.0));
    int i = q.x + q.y * 4;
    float b[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
        3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    return (b[i] + 0.5) / 16.0;
}
void fragment() {
    vec2 px = SCREEN_UV * u_res - u_shake;
    vec2 q = floor(px) + 0.5;
    vec2 d = vec2(0.0);
    for (int i = 0; i < 12; i++) {
        if (i >= u_nr) { break; }
        vec2 dv = q - u_ring[i].xy;
        dv.y /= 0.78;
        float r = length(dv) + 0.001;
        float k = 1.0 - abs(r - u_ring[i].z) / u_ring[i].w;
        if (k > 0.0) {
            vec2 dir = dv / r;
            d += vec2(dir.x, dir.y * 0.78) * k * k * u_ring_s[i];
        }
    }
    for (int i = 0; i < 8; i++) {
        if (i >= u_ns) { break; }
        vec2 a = u_seg[i].xy, b = u_seg[i].zw;
        vec2 ab = b - a;
        float l2 = max(dot(ab, ab), 0.001);
        float tt = clamp(dot(q - a, ab) / l2, 0.0, 1.0);
        vec2 cp = a + ab * tt;
        vec2 dv = q - cp;
        float dd = length(dv);
        float k = 1.0 - dd / u_seg_p[i].x;
        if (k > 0.0) {
            vec2 nn = normalize(vec2(-ab.y, ab.x));
            float sg = sign(dot(dv, nn) + 0.0001);
            float wob = 0.6 + 0.4 * sin(tt * 30.0 + u_time * 40.0);
            d += nn * sg * k * u_seg_p[i].y * wob;
        }
    }
    if (u_haze > 0.0) {
        d += u_haze * (vec2(
            vn(q * 0.11 + vec2(0.0, u_time * 2.5)),
            vn(q * 0.11 + 9.0 - vec2(u_time * 2.0, 0.0))) - 0.5) * 2.0;
    }
    vec2 s = floor(q - d);
    s = clamp(s, vec2(0.0), u_res - 1.0);
    vec3 col = texture(screen_tex, (s + vec2(0.5)) / u_res).rgb;
    float bz = bayer(q);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
        if (i >= u_nl) { break; }
        vec4 l = u_light[i];
        float dist_to_light = length((q - l.xy) * vec2(1.0, 1.25));
        float f = clamp(1.0 - dist_to_light / l.z, 0.0, 1.0);
        f = floor(f * 4.0 + bz * 0.999) / 4.0;
        acc += u_light_c[i] * f * l.w;
    }
    col = col * (u_amb + acc * 0.9) + acc * 0.07;
    vec2 c2 = (SCREEN_UV - 0.5) * vec2(1.25, 1.0);
    col *= 1.0 - smoothstep(0.45, 1.0, length(c2)) * 0.5;
    col = mix(col, u_flash.rgb, u_flash.a);
    COLOR = vec4(col, 1.0);
}
