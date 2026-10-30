extends Node
## Read-only visual bridge from an A0 Hero to A6's source-backed sprite.
## It never owns movement, actions, physics, equipment, identity, persistence or VFX.

const PIPELINE := preload("res://game/survival/ui/avatar_sprite_pipeline.gd")
const DIRECTIONS := ["front", "side_left", "side_right", "back"]
# These A0 current_action values identify the sword repertoire represented by
# CraftPix's Sword sheets. Generic/other-weapon ATTACK and SKILL actions fail
# back to locomotion instead of drawing a false sword swing.
const SOURCE_SWORD_ACTIONS := [
	"sword_attack_1",
	"sword_attack_2",
	"sword_attack_3",
	"sword_attack_4",
	"sword_attack_5",
	"dash_slash",
]
const A0_HIT_STATE_SECONDS := 0.28

var owner_actor: CharacterBody2D
var sprite: AnimatedSprite2D
var source_manifest: Dictionary = {}
var resolved_appearance: Dictionary = {}
var owner_appearance_revision := -1
var owner_projection_revision := ""
var owner_gender := ""
var owner_armor_grade := -1
var last_error := ""
var _last_current_action := ""
var _last_action_elapsed := 0.0
var _last_presentation_action := ""
var _last_presentation_direction := ""


## The host supplies persisted A0 identity/equipment and a monotonic appearance
## revision. For respawn with a replacement Hero node, call bind_owner again.
func bind_owner(
	actor: CharacterBody2D,
	avatar_sprite: AnimatedSprite2D,
	owner_snapshot: Dictionary,
	manifest: Dictionary,
) -> bool:
	if not is_instance_valid(actor) or not is_instance_valid(avatar_sprite):
		last_error = "A0 owner actor or avatar sprite is unavailable."
		return false
	owner_actor = actor
	sprite = avatar_sprite
	source_manifest = manifest.duplicate(true)
	owner_appearance_revision = -1
	owner_projection_revision = ""
	owner_gender = ""
	owner_armor_grade = -1
	resolved_appearance.clear()
	_last_current_action = ""
	_last_action_elapsed = 0.0
	_last_presentation_action = ""
	_last_presentation_direction = ""
	sprite.visible = false
	sprite.centered = true
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	return update_owner_appearance(owner_snapshot)


## A0 must call this whenever its saved selected gender or equipped appearance
## revision changes. Older revisions are ignored; same-revision conflicts blank
## the A6 visual; missing grades fail closed instead of retaining stale armor.
func update_owner_appearance(owner_snapshot: Dictionary) -> bool:
	if not is_instance_valid(owner_actor) or not is_instance_valid(sprite):
		last_error = "A0 owner actor or avatar sprite is unavailable."
		return false
	var appearance_revision_value: Variant = owner_snapshot.get("appearance_revision", null)
	if (
		appearance_revision_value is int
		and int(appearance_revision_value) >= 0
		and int(appearance_revision_value) < owner_appearance_revision
	):
		last_error = "Ignored stale A0 appearance revision."
		return false
	var owner_revision_value: Variant = owner_snapshot.get("revision", null)
	var gender_value: Variant = owner_snapshot.get("gender", null)
	var grade_value: Variant = owner_snapshot.get("armor_grade", null)
	if (
		owner_snapshot.get("schema", "") != "soh.ui.avatar_appearance.v1"
		or owner_snapshot.get("provenance", "") != "A0_OWNER_PROJECTION"
		or not appearance_revision_value is int
		or int(appearance_revision_value) < 0
		or not owner_revision_value is String
		or String(owner_revision_value).strip_edges().is_empty()
		or not gender_value is String
		or String(gender_value) not in ["male", "female"]
		or not grade_value is int
		or int(grade_value) not in [0, 1, 2]
	):
		if (
			appearance_revision_value is int
			and int(appearance_revision_value) > owner_appearance_revision
		):
			# Preserve a valid monotonic revision watermark even when the rest of
			# this projection is malformed; delayed older data must not reappear.
			owner_appearance_revision = int(appearance_revision_value)
			owner_projection_revision = ""
			owner_gender = ""
			owner_armor_grade = -1
		_fail_closed("A0 appearance projection is invalid or incomplete.")
		return false
	var incoming_appearance_revision := int(appearance_revision_value)
	var incoming_owner_revision := String(owner_revision_value).strip_edges()
	var incoming_gender := String(gender_value)
	var incoming_grade := int(grade_value)
	if incoming_appearance_revision < owner_appearance_revision:
		last_error = "Ignored stale A0 appearance revision."
		return false
	if (
		incoming_appearance_revision == owner_appearance_revision
		and not owner_projection_revision.is_empty()
	):
		if (
			incoming_owner_revision != owner_projection_revision
			or incoming_gender != owner_gender
			or incoming_grade != owner_armor_grade
		):
			_fail_closed("A0 reused an appearance revision for different identity/equipment state.")
			return false
		if resolved_appearance.get("status", "") == "READY":
			return true
		# An equal, unchanged revision may retry after a private resource import.
	else:
		# Record the newer owner truth before resolving. This prevents an older
		# queued update from restoring the prior identity/armor if the new grade
		# is unavailable. Never leave a stale visual visible across equipment.
		owner_appearance_revision = incoming_appearance_revision
		owner_projection_revision = incoming_owner_revision
		owner_gender = incoming_gender
		owner_armor_grade = incoming_grade
		resolved_appearance.clear()
		sprite.sprite_frames = null
		sprite.visible = false
		_last_current_action = ""
		_last_action_elapsed = 0.0
		_last_presentation_action = ""
		_last_presentation_direction = ""
	var resolved := PIPELINE.resolve_owner_appearance(owner_snapshot, source_manifest)
	if resolved.get("status", "") != "READY":
		_fail_closed(
			String(resolved.get("reason", "Matching A0 avatar appearance is unavailable.")), false
		)
		return false
	if (
		resolved.get("owner_revision", "") != incoming_owner_revision
		or resolved.get("gender", "") != incoming_gender
		or resolved.get("armor_grade", -1) != incoming_grade
	):
		_fail_closed("Resolved art differs from the current A0 appearance projection.")
		return false
	resolved_appearance = resolved
	last_error = ""
	sprite.visible = true
	return update_from_owner()


func _process(_delta: float) -> void:
	update_from_owner()


func update_from_owner() -> bool:
	if (
		not is_instance_valid(owner_actor)
		or not is_instance_valid(sprite)
		or resolved_appearance.get("status", "") != "READY"
	):
		return false
	var direction_value: Variant = owner_actor.get("facing_direction")
	var direction_vector := (
		direction_value as Vector2 if direction_value is Vector2 else Vector2.RIGHT
	)
	var velocity_value: Vector2 = owner_actor.velocity
	var current_action_value: Variant = owner_actor.get("current_action")
	var current_action := String(current_action_value)
	var state_name := state_name_from_owner(owner_actor)
	var action := action_for_owner_state(state_name, current_action, velocity_value.length())
	var direction := direction_for_vector(direction_vector)
	if (
		action in ["idle", "walk", "run"]
		and String(sprite.animation).begins_with("hurt/")
		and sprite.is_playing()
	):
		# A0 exits hit after 280 ms; finish a source clip whose last frame has not
		# yet rendered, unless a new player action or death supersedes it.
		action = "hurt"
		direction = String(sprite.animation).get_slice("/", 1)
	var action_elapsed_value: Variant = owner_actor.get("action_elapsed")
	var action_elapsed := (
		float(action_elapsed_value)
		if action_elapsed_value is int or action_elapsed_value is float
		else 0.0
	)
	var action_started := (
		not current_action.is_empty()
		and (
			current_action != _last_current_action or action_elapsed + 0.0001 < _last_action_elapsed
		)
	)
	if (
		not action_started
		and current_action in SOURCE_SWORD_ACTIONS
		and _last_presentation_action in ["attack", "walk_attack", "run_attack"]
	):
		# Do not restart/swap a one-shot because velocity crossed a walk/run
		# threshold or facing changed while A0 is still in the same sword action.
		action = _last_presentation_action
		direction = _last_presentation_direction
	elif action == "hurt" and _last_presentation_action == "hurt":
		direction = _last_presentation_direction
	elif action == "death" and _last_presentation_action == "death":
		direction = _last_presentation_direction
	var animation_name := StringName(action + "/" + direction)
	var restart := (
		action_started and action in ["attack", "walk_attack", "run_attack", "hurt", "death"]
	)
	var speed_scale := _owner_action_speed_scale(action, current_action, animation_name)
	_last_current_action = current_action
	_last_action_elapsed = action_elapsed
	var presented := PIPELINE.present(
		sprite, resolved_appearance, action, direction, speed_scale, restart
	)
	if presented:
		_last_presentation_action = action
		_last_presentation_direction = direction
	return presented


func _owner_action_speed_scale(
	action: String, current_action: String, animation_name: StringName
) -> float:
	if action == "death":
		return 1.0  # Keep source death frames at their authored 150 ms / 300 ms hold.
	var host_duration := 0.0
	if action == "hurt":
		# Current pinned KnightController::_handle_hit_state exits after 280 ms.
		host_duration = A0_HIT_STATE_SECONDS
	elif current_action in SOURCE_SWORD_ACTIONS and owner_actor.has_method("_get_action_duration"):
		host_duration = float(owner_actor.call("_get_action_duration", current_action))
	if host_duration <= 0.0:
		return 1.0
	var frames: Variant = resolved_appearance.get("sprite_frames", null)
	if not frames is SpriteFrames or not frames.has_animation(animation_name):
		return 1.0
	var frame_count := frames.get_frame_count(animation_name)
	var fps := frames.get_animation_speed(animation_name)
	var source_duration := float(frame_count) / maxf(fps, 0.01)
	return source_duration / maxf(host_duration, 0.01)


static func action_for_owner_state(
	state_name: String, current_action: String, speed: float
) -> String:
	var state := state_name.to_upper()
	if state == "DEAD" or current_action == "death":
		return "death"
	if state == "HURT" or current_action == "hit":
		return "hurt"
	if current_action in SOURCE_SWORD_ACTIONS:
		if speed >= 70.0:
			return "run_attack"
		if speed > 7.0:
			return "walk_attack"
		return "attack"
	if speed >= 70.0:
		return "run"
	if speed > 7.0:
		return "walk"
	return "idle"


static func direction_for_vector(direction: Vector2) -> String:
	if direction.length_squared() < 0.01:
		return "side_right"
	if absf(direction.x) > absf(direction.y):
		return "side_right" if direction.x > 0.0 else "side_left"
	return "front" if direction.y > 0.0 else "back"


static func state_name_from_owner(actor: Object) -> String:
	if not is_instance_valid(actor):
		return ""
	if bool(actor.get("dead")):
		return "DEAD"
	return _enum_name(actor, "PlayerState", actor.get("player_state"))


static func _enum_name(actor: Object, enum_name: String, value: Variant) -> String:
	if not value is int:
		return String(value).to_upper()
	var script_value: Variant = actor.get_script()
	if not script_value is Script:
		return ""
	var constants: Dictionary = script_value.get_script_constant_map()
	var enum_value: Variant = constants.get(enum_name, {})
	if not enum_value is Dictionary:
		return ""
	for key: Variant in enum_value:
		if int(enum_value[key]) == int(value):
			return String(key)
	return ""


func _fail_closed(reason: String) -> void:
	last_error = reason
	resolved_appearance.clear()
	_last_current_action = ""
	_last_action_elapsed = 0.0
	_last_presentation_action = ""
	_last_presentation_direction = ""
	if is_instance_valid(sprite):
		sprite.sprite_frames = null
		sprite.visible = false
