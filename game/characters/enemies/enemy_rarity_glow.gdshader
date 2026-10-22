shader_type canvas_item;

// Silhouette-bound rarity treatment. The glow is sampled from the enemy's
// own alpha instead of placing a circular effect behind the character.
uniform vec4 rarity_color : source_color = vec4(1.0);
uniform float outline_pixels : hint_range(0.0, 3.0, 0.05) = 1.0;
uniform float glow_strength : hint_range(0.0, 1.0, 0.01) = 0.35;
uniform float body_tint_strength : hint_range(0.0, 0.4, 0.01) = 0.08;

void fragment() {
	vec4 vertex_color = COLOR;
	vec4 texel = texture(TEXTURE, UV);
	vec4 body = texel * vertex_color;
	vec2 step_size = TEXTURE_PIXEL_SIZE * outline_pixels;
	float surrounding_alpha = 0.0;
	surrounding_alpha = max(surrounding_alpha, texture(TEXTURE, UV + vec2(step_size.x, 0.0)).a);
	surrounding_alpha = max(surrounding_alpha, texture(TEXTURE, UV - vec2(step_size.x, 0.0)).a);
	surrounding_alpha = max(surrounding_alpha, texture(TEXTURE, UV + vec2(0.0, step_size.y)).a);
	surrounding_alpha = max(surrounding_alpha, texture(TEXTURE, UV - vec2(0.0, step_size.y)).a);
	surrounding_alpha = max(surrounding_alpha, texture(TEXTURE, UV + step_size).a);
	surrounding_alpha = max(surrounding_alpha, texture(TEXTURE, UV - step_size).a);
	surrounding_alpha = max(surrounding_alpha, texture(TEXTURE, UV + vec2(step_size.x, -step_size.y)).a);
	surrounding_alpha = max(surrounding_alpha, texture(TEXTURE, UV + vec2(-step_size.x, step_size.y)).a);

	float outline_alpha = max(0.0, surrounding_alpha - texel.a) * glow_strength * vertex_color.a;
	vec3 tinted_body = mix(body.rgb, rarity_color.rgb * body.a, body_tint_strength);
	vec3 glow_rgb = rarity_color.rgb * outline_alpha * 0.72;
	COLOR = vec4(tinted_body + glow_rgb, max(body.a, outline_alpha));
}
