class_name KnightAnimationLibrary
extends RefCounted

const FRAME_SIZE := Vector2i(120, 80)
const ROOT := "res://assets/characters/knight/"

# Every sheet from FreeKnight_v1 is registered here. Gameplay uses the
# no-root-motion variants for reliable collisions, while the other variants
# remain available to designers from the AnimatedSprite2D animation list.
const SPECS := {
	# Production Sword combo strips. Each action owns an explicit source sheet,
	# frame count and playback rate; it never falls back to locomotion frames.
	"sword_combo_1": ["_AttackNoMovement.png", 4, 12.0, false],
	"sword_combo_2": ["_Attack2NoMovement.png", 6, 15.0, false],
	"sword_combo_3": ["_AttackComboNoMovement.png", 10, 19.2, false],
	"sword_combo_4": ["_AttackCombo2hit.png", 10, 17.2, false],
	"attack_moving": ["_Attack.png", 4, 12.0, false],
	"attack2_moving": ["_Attack2.png", 6, 12.0, false],
	"heavy_attack": ["_Attack2NoMovement.png", 6, 12.0, false],
	"attack_combo_moving": ["_AttackCombo2hit.png", 10, 14.0, false],
	"attack_combo": ["_AttackComboNoMovement.png", 10, 14.0, false],
	"attack": ["_AttackNoMovement.png", 4, 12.0, false],
	"crouch": ["_Crouch.png", 1, 1.0, true],
	"crouch_attack": ["_CrouchAttack.png", 4, 12.0, false],
	"crouch_full": ["_CrouchFull.png", 3, 9.0, false],
	"crouch_transition": ["_CrouchTransition.png", 1, 1.0, false],
	"crouch_walk": ["_CrouchWalk.png", 8, 11.0, true],
	"dash": ["_Dash.png", 2, 12.0, true],
	"death_moving": ["_Death.png", 10, 12.0, false],
	"death": ["_DeathNoMovement.png", 10, 12.0, false],
	"fall": ["_Fall.png", 3, 9.0, true],
	"hit": ["_Hit.png", 1, 1.0, false],
	"idle": ["_Idle.png", 10, 9.0, true],
	"jump": ["_Jump.png", 3, 10.0, false],
	"jump_to_fall": ["_JumpFallInbetween.png", 2, 10.0, false],
	"roll": ["_Roll.png", 12, 20.0, false],
	"run": ["_Run.png", 10, 14.0, true],
	"slide": ["_Slide.png", 2, 10.0, true],
	"slide_full": ["_SlideFull.png", 4, 12.0, false],
	"slide_end": ["_SlideTransitionEnd.png", 1, 1.0, false],
	"slide_start": ["_SlideTransitionStart.png", 1, 1.0, false],
	"turn": ["_TurnAround.png", 3, 18.0, false],
	"wall_climb_moving": ["_WallClimb.png", 7, 12.0, true],
	"wall_climb": ["_WallClimbNoMovement.png", 7, 12.0, true],
	"wall_hang": ["_WallHang.png", 1, 1.0, true],
	"wall_slide": ["_WallSlide.png", 3, 10.0, true],
}


static func build() -> SpriteFrames:
	return build_from_root(ROOT)


static func build_from_root(root: String) -> SpriteFrames:
	var library := SpriteFrames.new()
	if library.has_animation("default"):
		library.remove_animation("default")
	var normalized_root := root if root.ends_with("/") else root + "/"

	for raw_name: String in SPECS:
		var animation_name := StringName(raw_name)
		var spec: Array = SPECS[raw_name]
		var texture: Texture2D = load(normalized_root + String(spec[0]))
		library.add_animation(animation_name)
		library.set_animation_speed(animation_name, float(spec[2]))
		library.set_animation_loop(animation_name, bool(spec[3]))
		for frame_index: int in range(int(spec[1])):
			var frame := AtlasTexture.new()
			frame.atlas = texture
			frame.region = Rect2(
				Vector2(frame_index * FRAME_SIZE.x, 0),
				Vector2(FRAME_SIZE)
			)
			library.add_frame(animation_name, frame)
	return library
