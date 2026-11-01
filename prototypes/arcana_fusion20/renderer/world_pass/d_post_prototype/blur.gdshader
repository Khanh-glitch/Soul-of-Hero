// D renderer BLUR_FS, normalized RGBA viewport at each stage.
shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D input_tex : filter_linear, repeat_disable;
uniform vec2 direction;
void fragment() {
    vec2 o1 = direction * 1.3846153846;
    vec2 o2 = direction * 3.2307692308;
    vec3 s = texture(input_tex, UV).rgb * 0.2270270270;
    s += (texture(input_tex, UV + o1).rgb + texture(input_tex, UV - o1).rgb) * 0.3162162162;
    s += (texture(input_tex, UV + o2).rgb + texture(input_tex, UV - o2).rgb) * 0.0702702703;
    COLOR = vec4(s, 1.0);
}
