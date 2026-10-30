extends Node
## Read-only visual bridge from the pinned A0 Hero to A6's source-backed sprite.
## It never owns movement, attacks, physics, equipment, identity, persistence or VFX.

const PIPELINE := preload("res://game/survival/ui/avatar_sprite_pipeline.gd")
const DIRECTIONS := ["front", "side_left", "side_right", "back"]
const SWORD_ATTACK_ACTIONS := [
	"light_attack",
	"combo_attack",
	"heavy_attack",
	"crouch_attack",
	"sword_attack_1",
	"sword_attack_2",
	"sword_attack_3",
	"sword_attack_4",
	"sword_attack_5",
	"dash_slash",
]

var owner_actor: CharacterBody2D
var sprite: AnimatedSprite2D
var resolved_appearance: Dictionary = {}
var last_error := ""


## The host supplies the A0-owned appearance projection and licensed manifest.
## In production A0 must provide the saved identity/grade; local fixture snapshots
## are only for the explicitly marked source-composition preview.
func _process(_delta: float) -> void:
	update_from_owner()


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
	resolved_appearance = PIPELINE.resolve_owner_appearance(owner_snapshot, manifest)
	if resolved_appearance.get("status", "") != "READY":
		last_error = String(
			resolved_appearance.get("reason", "Canonical avatar source is unavailable.")
		)
		return false
	if (
		resolved_appearance.get("gender", "") != owner_snapshot.get("gender", "")
		or resolved_appearance.get("armor_grade", -1) != owner_snapshot.get("armor_grade", -2)
	):
		last_error = "Resolved avatar differs from the A0 identity/equipment projection."
		resolved_appearance.clear()
		return false
	sprite.centered = true
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	return update_from_owner()


func update_from_owner() -> bool:
	if (
		not is_instance_valid(owner_actor)
		or not is_instance_valid(sprite)
		or resolved_appearance.get("status", "") != "READY"
	):
		return false
	var direction_vector: Variant = owner_actor.get("facing_direction")
	var velocity_value: Vector2 = owner_actor.velocity
	var state_value: Variant = owner_actor.get("player_state")
	var current_action_value: Variant = owner_actor.get("current_action")
	var state_name := _enum_name(owner_actor, "PlayerState", state_value)
	var action := action_for_owner_state(
		state_name, String(current_action_value), velocity_value.length()
	)
	var direction := direction_for_vector(direction_vector as Vector2)
	return PIPELINE.present(sprite, resolved_appearance, action, direction)


static func action_for_owner_state(
	state_name: String, current_action: String, speed: float
) -> String:
	var state := state_name.to_upper()
	if state == "DEAD" or current_action == "death":
		return "death"
	if state == "HURT" or current_action == "hit":
		return "hurt"
	if state == "ATTACK" or current_action in SWORD_ATTACK_ACTIONS:
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
