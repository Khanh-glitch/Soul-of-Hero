// C's explicitly authored stage operations over the real terrain. This pass is
// viewport aligned, before local spell geometry and actors, and below the HUD.
// It is not bloom, original full post, foreground occlusion or approval.
shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D world_screen : hint_screen_texture, repeat_disable, filter_nearest;
uniform sampler2D scanlines : repeat_disable, filter_nearest;
uniform float stage_shade = 1.0;
uniform bool scanlines_active = false;
void fragment() {
    vec2 uv = SCREEN_UV;
    vec2 scan = scanlines_active ? texelFetch(scanlines, ivec2(clamp(int(floor(uv.y * 216.0)), 0, 215), 0), 0).rg : vec2(0.0);
    // Authored source pixels are normalized to viewport width, not rotated by
    // caster/target direction. Source C's ground sampler uses q + D.
    vec2 d = vec2(floor(scan.x + 0.5) / 384.0, 0.0);
    vec2 c = vec2(scan.y > 0.2 ? ceil(scan.y) / 384.0 : 0.0, 0.0);
    vec3 col;
    col.r = texture(world_screen, clamp(uv + d + c, vec2(0.0), vec2(1.0))).r;
    col.g = texture(world_screen, clamp(uv + d, vec2(0.0), vec2(1.0))).g;
    col.b = texture(world_screen, clamp(uv + d - c, vec2(0.0), vec2(1.0))).b;
    COLOR = vec4(col * stage_shade, 1.0);
}
