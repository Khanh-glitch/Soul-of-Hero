shader_type canvas_item;
// A1-owned isolated presentation ambient. Production Gold / A0 lighting is untouched.
uniform vec4 ambient_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
void fragment() {
	COLOR *= ambient_color;
}
