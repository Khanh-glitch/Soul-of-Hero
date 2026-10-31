// Original D BRIGHT_FS and BLUR_FS, applied to explicit input textures.
// Values intentionally remain linear/unkeyed; every stage writes RGBA8.
shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D input_nearest : filter_nearest, repeat_disable;
uniform sampler2D input_linear : filter_linear, repeat_disable;
uniform bool nearest_input = false;
uniform int stage_mode = 0; // 0 = bright extraction, 1 = separable blur
uniform float threshold = 0.42;
uniform float knee = 0.5;
uniform vec2 direction = vec2(0.0);

vec3 sample_input(vec2 uv) {
    // The original nearest-filtered 2:1 bright pass samples on texel
    // boundaries. Source readback analysis shows its dominant top-down
    // sample is (2*x, 2*y+1); choose that texel explicitly instead of
    // relying on Godot's backend-dependent nearest-filter tie breaking.
    if (nearest_input) {
        ivec2 source_size = textureSize(input_nearest, 0);
        ivec2 dst_pixel = ivec2(floor(uv * vec2(source_size) * 0.5));
        ivec2 source_pixel = clamp(dst_pixel * 2 + ivec2(0, 1), ivec2(0), source_size - ivec2(1));
        return texelFetch(input_nearest, source_pixel, 0).rgb;
    }
    return texture(input_linear, uv).rgb;
}

void fragment() {
    if (stage_mode == 0) {
        vec3 c = sample_input(UV);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        COLOR = vec4(c * smoothstep(threshold, threshold + knee, l), 1.0);
    } else {
        vec2 o1 = direction * 1.3846153846;
        vec2 o2 = direction * 3.2307692308;
        vec3 s = sample_input(UV) * 0.2270270270;
        s += (sample_input(UV + o1) + sample_input(UV - o1)) * 0.3162162162;
        s += (sample_input(UV + o2) + sample_input(UV - o2)) * 0.0702702703;
        COLOR = vec4(s, 1.0);
    }
}
