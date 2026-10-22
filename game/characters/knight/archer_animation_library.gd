class_name ArcherAnimationLibrary
extends RefCounted

const FRAME_SIZE := Vector2i(64, 64)
const PLAYER_SHEET := "res://assets/characters/archer/archer_player_sheet.png"
const BOSS_SHEET := "res://assets/characters/archer/archer_boss_sheet.png"

# GandalfHardcore Archer is an 11 x 5 atlas. Some rows intentionally contain
# fewer authored frames; keeping the row metadata here gives both the playable
# Hero and the hostile Level 5 version identical foot pivots and release timing.
const SPECS := {
	&"idle": [0, 5, 7.0, true],
	&"run": [2, 8, 11.0, true],
	&"bow_fire": [1, 11, 18.0, false],
	&"bow_volley": [1, 11, 18.0, false],
	&"archer_quick_shot": [1, 11, 18.0, false],
	&"archer_split_step": [1, 11, 18.0, false],
	&"archer_armor_piercer": [1, 11, 15.7, false],
	&"archer_soul_mark": [1, 11, 20.0, false],
	&"archer_summon": [1, 11, 18.0, false],
	&"archer_departure": [1, 11, 18.0, false],
	&"attack": [1, 11, 18.0, false],
	&"attack_moving": [1, 11, 18.0, false],
	&"heavy_attack": [1, 11, 15.7, false],
	&"attack_combo": [1, 11, 15.7, false],
	&"attack_combo_moving": [1, 11, 15.7, false],
	&"hit": [3, 5, 14.0, false],
	&"death": [4, 6, 11.0, false],
	&"death_moving": [4, 6, 11.0, false],
	# This sheet has no authored dodge row. Reusing the locomotion row keeps the
	# Archer upright during a dash; row 4 is the death row and must never be used
	# for a live reposition.
	&"dash": [2, 8, 16.0, false],
	&"roll": [2, 8, 16.0, false],
}


static func build_player() -> SpriteFrames:
	return build_from_sheet(PLAYER_SHEET)


static func build_boss() -> SpriteFrames:
	return build_from_sheet(BOSS_SHEET)


static func build_from_sheet(sheet_path: String) -> SpriteFrames:
	var texture := load(sheet_path) as Texture2D
	var library := SpriteFrames.new()
	if library.has_animation(&"default"):
		library.remove_animation(&"default")
	for animation_name: StringName in SPECS:
		var spec: Array = SPECS[animation_name]
		library.add_animation(animation_name)
		library.set_animation_speed(animation_name, float(spec[2]))
		library.set_animation_loop(animation_name, bool(spec[3]))
		if texture == null:
			continue
		for frame_index: int in range(int(spec[1])):
			var frame := AtlasTexture.new()
			frame.atlas = texture
			frame.region = Rect2(
				Vector2(frame_index * FRAME_SIZE.x, int(spec[0]) * FRAME_SIZE.y),
				Vector2(FRAME_SIZE)
			)
			library.add_frame(animation_name, frame)
	return library
