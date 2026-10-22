shader_type canvas_item;
render_mode unshaded;

// Soul Echo is gameplay information, not a second normally-colored Hero.
// Preserve the authored animation's alpha silhouette while replacing every
// opaque pixel with the data-driven ivory-white Echo color.
uniform vec4 echo_color : source_color = vec4(1.0, 0.99, 0.93, 0.72);

void fragment() {
	vec4 source = texture(TEXTURE, UV);
	float outline_alpha = 0.0;
	outline_alpha = max(outline_alpha, texture(TEXTURE, UV + vec2(TEXTURE_PIXEL_SIZE.x, 0.0)).a);
	outline_alpha = max(outline_alpha, texture(TEXTURE, UV - vec2(TEXTURE_PIXEL_SIZE.x, 0.0)).a);
	outline_alpha = max(outline_alpha, texture(TEXTURE, UV + vec2(0.0, TEXTURE_PIXEL_SIZE.y)).a);
	outline_alpha = max(outline_alpha, texture(TEXTURE, UV - vec2(0.0, TEXTURE_PIXEL_SIZE.y)).a);
	float body_alpha = source.a * echo_color.a;
	float rim_alpha = max(0.0, outline_alpha - source.a) * 0.62;
	COLOR = vec4(echo_color.rgb, max(body_alpha, rim_alpha));
}
