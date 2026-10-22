class_name AxeWarriorAnimationLibrary
extends RefCounted

const ROOT := "res://assets/characters/axe_warrior/"
const SOURCE_MANIFEST_PATH := ROOT + "source_manifest.json"
const SOURCE_ACTION_BY_ANIMATION := {
	&"attack_moving": "Attack",
	&"attack2_moving": "Attack2",
	&"heavy_attack": "Attack2NoMovement",
	&"attack_combo_moving": "AttackCombo",
	&"attack_combo": "AttackComboNoMovement",
	&"attack": "AttackNoMovement",
	&"crouch": "Crouch",
	&"crouch_attack": "CrouchAttack",
	&"crouch_full": "CrouchAll",
	&"crouch_transition": "CrouchTransition",
	&"crouch_walk": "CrouchWalk",
	&"dash": "Dash",
	&"death_moving": "Death",
	&"death": "DeathNoMovement",
	&"fall": "Fall",
	&"hit": "Hit",
	&"idle": "Idle",
	&"jump": "Jump",
	&"jump_to_fall": "JumpFallInbetween",
	&"roll": "Roll",
	&"run": "Run",
	&"slide": "Slide",
	&"slide_full": "SlideAll",
	&"slide_end": "SlideTransitionEnd",
	&"slide_start": "SlideTransitionStart",
	&"turn": "TurnAround",
	&"wall_climb_moving": "WallClimb",
	&"wall_climb": "WallClimbNoMovement",
	&"wall_hang": "WallHang",
	&"wall_slide": "WallSlide",
}


static func build() -> SpriteFrames:
	var library := KnightAnimationLibrary.build_from_root(ROOT)
	_apply_source_timing(library)
	return library


static func _apply_source_timing(library: SpriteFrames) -> void:
	if not FileAccess.file_exists(SOURCE_MANIFEST_PATH):
		return
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(SOURCE_MANIFEST_PATH))
	if not (parsed is Dictionary):
		return
	var actions: Variant = (parsed as Dictionary).get("actions", {})
	if not (actions is Dictionary):
		return
	for animation_name: StringName in SOURCE_ACTION_BY_ANIMATION:
		var source_action := String(SOURCE_ACTION_BY_ANIMATION[animation_name])
		var metadata: Variant = (actions as Dictionary).get(source_action, {})
		if not (metadata is Dictionary) or not library.has_animation(animation_name):
			continue
		library.set_animation_speed(animation_name, float((metadata as Dictionary).get("fps", 12.0)))
		library.set_animation_loop(animation_name, bool((metadata as Dictionary).get("loop", false)))
