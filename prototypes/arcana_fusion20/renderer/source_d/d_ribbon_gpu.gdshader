// Original D RIBBON_FS, using actual GPU interpolation and derivatives.
// The optional audit output is written only after the original discard.
shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float source_time = 0.0;
uniform float hard = 0.8;
uniform float glow = 0.0;
uniform float flow = 0.0;
uniform float flags = 0.0;
uniform float seed = 1.0;
uniform bool coverage_only = false;
float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h11(i.x + i.y * 57.0), h11(i.x + 1.0 + i.y * 57.0), f.x),
               mix(h11(i.x + (i.y + 1.0) * 57.0), h11(i.x + 1.0 + (i.y + 1.0) * 57.0), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p *= 2.1; a *= 0.5; } return s; }
void fragment() {
    float d = abs(UV.x);
    float fw = max(fwidth(d), 1e-4);
    float a = clamp(((1.0 - d) / fw) / max(0.8, hard), 0.0, 1.0);
    float fl = flags;
    float along = UV.y;
    if (fl >= 4.0) { fl -= 4.0; a *= 0.55 + 0.75 * fbm(vec2(along * 26.0, source_time * 2.4 - along * 9.0 + seed * 5.0)); }
    if (fl >= 2.0) { fl -= 2.0; d += (h11(floor(along * 46.0) + floor(source_time * 22.0) * 0.37) - 0.5) * 0.8; a = max(a * 0.35, clamp(((1.0 - d) / fw) / 1.6, 0.0, 1.0)); }
    if (a <= 0.003) { discard; }
    vec3 col = COLOR.rgb * (0.55 + 0.75 * (1.0 - d * d));
    col += COLOR.rgb * glow * exp(-d * d * 7.0) * 2.4;
    if (flow > 0.0) {
        float ph = fract(along * seed * 0.06 - source_time * flow);
        float bump = pow(ph, 6.0);
        col += vec3(1.0, 0.97, 0.9) * bump * (1.2 - d) * 1.5;
        a = max(a, bump * (1.0 - d * 0.6));
    }
    if (coverage_only) { COLOR = vec4(1.0); }
    else { COLOR = vec4(col, COLOR.a * a); }
}
