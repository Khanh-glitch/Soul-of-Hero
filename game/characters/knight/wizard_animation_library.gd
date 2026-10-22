class_name WizardAnimationLibrary
extends RefCounted

## The imported Wizard Pack uses 231 x 190 canvas frames. The padded canvas is
## intentional: it preserves the staff and spell silhouettes during Attack1/2.

const FRAME_SIZE := Vector2i(231, 190)
const ROOT := "res://assets/library/downloaded/wizard_pack/"

const SPECS := {
	&"idle": ["Idle.png", 6, 8.0, true],
	&"run": ["Run.png", 8, 12.0, true],
	&"wizard_attack": ["Attack2.png", 8, 18.0, false],
	&"wizard_passage": ["Attack1.png", 8, 18.0, false],
	&"attack": ["Attack2.png", 8, 18.0, false],
	&"attack_moving": ["Attack2.png", 8, 18.0, false],
	&"heavy_attack": ["Attack1.png", 8, 18.0, false],
	&"attack_combo": ["Attack2.png", 8, 18.0, false],
	&"hit": ["Hit.png", 4, 14.0, false],
	&"death": ["Death.png", 7, 11.0, false],
	&"death_moving": ["Death.png", 7, 11.0, false],
	&"dash": ["Run.png", 8, 18.0, false],
	&"roll": ["Run.png", 8, 18.0, false],
	&"jump": ["Jump.png", 2, 12.0, false],
	&"fall": ["Fall.png", 2, 10.0, true],
}


static func build() -> SpriteFrames:
	var frames := SpriteFrames.new()
	if frames.has_animation(&"default"):
		frames.remove_animation(&"default")
	for animation_name: StringName in SPECS:
		var spec: Array = SPECS[animation_name]
		frames.add_animation(animation_name)
		frames.set_animation_speed(animation_name, float(spec[2]))
		frames.set_animation_loop(animation_name, bool(spec[3]))
		var texture := load(ROOT + String(spec[0])) as Texture2D
		if texture == null:
			continue
		for frame_index: int in range(int(spec[1])):
			var atlas := AtlasTexture.new()
			atlas.atlas = texture
			atlas.region = Rect2(Vector2(frame_index * FRAME_SIZE.x, 0), Vector2(FRAME_SIZE))
			frames.add_frame(animation_name, atlas)
	return frames
