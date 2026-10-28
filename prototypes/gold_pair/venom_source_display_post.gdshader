shader_type canvas_item;
render_mode unshaded;

// Literal source port of Venomwright src/game/display.ts const FRAG:
// source before WebGL Pixi-8. All math, 4 shock rings, 2 glow halo offsets,
// Bayer4, stepped vignette, desat, flash and 31-step final quantization.
// Image staging/compositor and original Pixi WebGL output parity are separate.
uniform sampler2D u_scene : filter_nearest, repeat_disable;
uniform sampler2D u_glow : filter_nearest, repeat_disable;
uniform vec2 u_res = vec2(1200.0, 680.0);
uniform float u_time = 0.0;
uniform vec2 u_shake = vec2(0.0);
uniform vec4 u_shock[4];
uniform vec4 u_flash = vec4(0.0);
uniform vec4 u_grade = vec4(0.0, 1.0, 0.0, 1.0);

float bayer4(vec2 p) {
    float x = mod(p.x, 4.0), y = mod(p.y, 4.0);
    float a = mod(x, 2.0), b = mod(floor(x / 2.0), 2.0);
    float c = mod(y, 2.0), d = mod(floor(y / 2.0), 2.0);
    return (8.0 * abs(a - c) + 4.0 * c + 2.0 * abs(b - d) + d) / 16.0;
}

void fragment() {
    vec2 px = floor(UV * u_res);
    vec2 p = px + 0.5;
    vec2 off = vec2(0.0);
    for (int i = 0; i < 4; i++) {
        vec4 s = u_shock[i];
        if (s.w > 0.0) {
            vec2 d = p - s.xy;
            float r = length(d);
            float band = exp(-pow((r - s.z) / 9.0, 2.0));
            if (r > 0.5) {
                off += d / r * band * s.w;
            }
        }
    }
    p = floor(p + off + u_shake) + 0.5;
    p = clamp(p, vec2(0.5), u_res - 0.5);
    vec2 uv = p / u_res;
    vec3 sc = texture(u_scene, uv).rgb;
    vec3 g = texture(u_glow, uv).rgb;
    vec2 o2 = vec2(2.0) / u_res, o5 = vec2(5.0, -5.0) / u_res;
    vec3 h = (texture(u_glow, uv + vec2(o2.x, 0.0)).rgb +
              texture(u_glow, uv - vec2(o2.x, 0.0)).rgb +
              texture(u_glow, uv + vec2(0.0, o2.y)).rgb +
              texture(u_glow, uv - vec2(0.0, o2.y)).rgb) * 0.25;
    vec3 h2 = (texture(u_glow, uv + o5.xx).rgb +
               texture(u_glow, uv - o5.xx).rgb +
               texture(u_glow, uv + o5.xy).rgb +
               texture(u_glow, uv + o5.yx).rgb) * 0.25;
    vec3 col = sc + (g + h * 0.5 + h2 * 0.4) * u_grade.w;
    float l = dot(col, vec3(0.3, 0.55, 0.15));
    col = mix(col, vec3(l), u_grade.z);
    vec2 q = (px / u_res - 0.5) * vec2(1.0, 0.9);
    float vg = smoothstep(0.38, 0.78, length(q)) * u_grade.y;
    float bt = bayer4(px);
    col *= 1.0 - 0.55 * step(bt + 0.001, vg) -
                   0.2 * step(bt + 0.001, vg * 0.55);
    col *= 1.0 - u_grade.x;
    if (u_flash.a > 0.0) {
        col = mix(col, u_flash.rgb,
            step(bt, u_flash.a) * min(1.0, u_flash.a * 1.4));
    }
    col = floor(clamp(col, 0.0, 1.0) * 31.0 + 0.5) / 31.0;
    COLOR = vec4(col, 1.0);
}
