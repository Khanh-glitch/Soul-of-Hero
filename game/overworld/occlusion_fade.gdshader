// Selective occlusion fade.
//
// A whole-sprite alpha is the wrong tool for a building. When the Knight walks in
// behind the Crimson Gate, fading the gate to 62 % also fades the two pixels of
// contact shadow that tell the eye where the gate stands, and the building starts
// to look like it is floating or, worse, like it has been removed. What has to
// fade is the *part that is in front of the player*: the wall, the canopy, the
// facade. The base stays.
//
// So this shader keeps the bottom `base_keep` fraction of the sprite fully opaque
// and fades everything above it to `fade_alpha`, with a short soft ramp at the
// boundary so the cut is not a visible line. The boundary moves with the player:
// `cut` is the fraction of the sprite's height that has to stay solid, measured
// from its feet (UV.y == 1 at the feet, because the sprite is feet-anchored and
// AtlasTexture UVs are normalised to the region).
shader_type canvas_item;

// 1.0 = untouched, 0.0 = invisible. The controller animates this.
uniform float fade_alpha : hint_range(0.0, 1.0) = 1.0;
// Bottom fraction of the sprite that never fades: contact shadow, plinth, base.
uniform float base_keep : hint_range(0.0, 1.0) = 0.0;
// Softness of the transition, as a fraction of the sprite height.
uniform float softness : hint_range(0.0, 0.5) = 0.06;

void fragment() {
	// UV.y: 0 at the top of the sprite, 1 at its feet.
	float from = 1.0 - clamp(base_keep, 0.0, 1.0);
	float t = smoothstep(from - softness, from + softness, 1.0 - UV.y);
	float a = mix(1.0, fade_alpha, t);
	// Below the cut (the base) stays fully opaque; above it fades.
	COLOR.a *= a;
}
