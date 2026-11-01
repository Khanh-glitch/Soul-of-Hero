// Original C17 blackout: opaque black stage ink followed by source light.
// Actual world and actors are hidden, HUD is drawn on the later layer. This
// is not source bloom/post parity or an owner-approved blackout policy.
shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D source_light : repeat_disable, filter_nearest;
uniform vec2 inv_x = vec2(1.0, 0.0);
uniform vec2 inv_y = vec2(0.0, 1.0);
uniform vec2 inv_origin = vec2(0.0);
float bayer(ivec2 p) {
    int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
    return (float(m[(p.y & 3) * 4 + (p.x & 3)]) + 0.5) / 16.0;
}
void fragment() {
    vec2 screen_px = SCREEN_UV / SCREEN_PIXEL_SIZE;
    vec2 source = inv_x * screen_px.x + inv_y * screen_px.y + inv_origin;
    ivec2 q = ivec2(floor(source));
    vec3 c = vec3(0.0);
    if (q.x >= 0 && q.y >= 0 && q.x < 384 && q.y < 216) {
        vec3 l = texelFetch(source_light, q, 0).rgb;
        c = floor(l * 8.0 + bayer(q)) / 8.0;
        vec3 over = max(c - 1.0, 0.0);
        c += vec3(over.r + over.g + over.b) * 0.45;
    }
    COLOR = vec4(clamp(c, 0.0, 1.0), 1.0);
}
