shader_type canvas_item;
render_mode unshaded;

uniform vec4 tint : source_color = vec4(1.0);

void fragment() {
	vec4 source = texture(TEXTURE, UV);
	float value = max(source.r, max(source.g, source.b));
	COLOR = vec4(tint.rgb * value, source.a * tint.a);
}
