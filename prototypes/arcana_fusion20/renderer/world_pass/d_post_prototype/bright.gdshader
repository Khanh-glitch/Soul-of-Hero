// D renderer BRIGHT_FS. This threshold extracts bloom energy; it is NOT an
// alpha/coverage key and the full scene remains present in the final composite.
shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D scene_nearest : filter_nearest, repeat_disable;
uniform sampler2D scene_linear : filter_linear, repeat_disable;
uniform bool linear_input = false;
uniform float threshold = 0.42;
uniform float knee = 0.5;
void fragment() {
    vec3 c = linear_input ? texture(scene_linear, UV).rgb : texture(scene_nearest, UV).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    COLOR = vec4(c * smoothstep(threshold, threshold + knee, l), 1.0);
}
