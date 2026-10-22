class_name EliteEnemyApplicator
extends RefCounted

## Applies the shared elite contract after an enemy scene has entered the tree.
## Supports both current SkeletonEnemy fields and AdvancedDungeonEnemy profiles
## without coupling the roster system to either controller implementation.

const EliteModifierDefinition = preload("res://game/content/rosters/elite_modifier_definition.gd")
const EnemyDifficultyScalerScript := preload(
	"res://game/characters/enemies/enemy_difficulty_scaler.gd"
)
const EnemyRarityPresentation := preload(
	"res://game/characters/enemies/enemy_rarity_presentation.gd"
)
const RARITY_PALETTE := preload("res://game/ui/rarity_palette.gd")

const DIRECT_HEALTH_PROPERTIES := ["max_health"]
const DIRECT_DAMAGE_PROPERTIES := ["contact_damage"]
const DIRECT_MOVEMENT_PROPERTIES := [
	"patrol_speed",
	"chase_speed",
	"separation_strength",
]
const DIRECT_RANGE_PROPERTIES := [
	"detection_range",
	"disengage_range",
	"attack_range",
]
const DIRECT_DIVIDED_PROPERTIES := ["attack_cooldown"]
const PROFILE_HEALTH_KEYS := ["max_health"]
const PROFILE_DAMAGE_KEYS := ["damage", "leech"]
const PROFILE_MOVEMENT_KEYS := [
	"patrol_speed",
	"chase_speed",
	"strike_speed",
]
const PROFILE_RANGE_KEYS := [
	"detection",
	"disengage",
	"preferred_min",
	"preferred_max",
	"ability_range",
]
const PROFILE_DIVIDED_KEYS := ["recovery", "cooldown"]


static func apply_to(enemy: Node2D, modifier: EliteModifierDefinition) -> bool:
	if enemy == null or modifier == null or not modifier.get_validation_errors().is_empty():
		return false
	if enemy.has_meta(&"elite_modifier_id"):
		return false
	EnemyDifficultyScalerScript.capture_authored_damage_provenance(enemy)
	var property_names := _property_names(enemy)
	var axes := modifier.get_combat_axes()
	_apply_direct_axis(enemy, property_names, DIRECT_HEALTH_PROPERTIES, float(axes.health))
	_apply_direct_axis(enemy, property_names, DIRECT_DAMAGE_PROPERTIES, float(axes.damage))
	_apply_direct_axis(enemy, property_names, DIRECT_MOVEMENT_PROPERTIES, float(axes.movement))
	_apply_direct_axis(enemy, property_names, DIRECT_RANGE_PROPERTIES, float(axes.range))
	for property_name: String in DIRECT_DIVIDED_PROPERTIES:
		if property_names.has(property_name):
			enemy.set(
				property_name,
				_scaled_number(enemy.get(property_name), 1.0 / float(axes.attack_rate)),
			)
	if property_names.has("score_reward"):
		enemy.set(
			"score_reward",
			_scaled_number(enemy.get("score_reward"), float(axes.reward_score)),
		)
	_apply_dictionary_profile(enemy, property_names, modifier)

	if property_names.has("health") and property_names.has("max_health"):
		enemy.set("health", enemy.get("max_health"))

	EnemyRarityPresentation.multiply_base_visual_scale(
		enemy,
		modifier.visual_scale_multiplier
	)
	enemy.set_meta(&"elite_modifier_id", modifier.modifier_id)
	enemy.set_meta(&"elite_combat_axes", axes.duplicate(true))
	enemy.set_meta(&"loot_role", &"elite")
	var current_rarity: Variant = enemy.get_meta(
		&"enemy_rarity",
		enemy.get_meta(&"loot_rarity", modifier.minimum_rarity)
	)
	var rarity := RARITY_PALETTE.normalize(current_rarity)
	if RARITY_PALETTE.index(rarity) < RARITY_PALETTE.index(modifier.minimum_rarity):
		rarity = RARITY_PALETTE.normalize(modifier.minimum_rarity)
	enemy.set_meta(&"enemy_rarity", rarity)
	enemy.add_to_group(&"elite_enemies")
	EnemyRarityPresentation.apply_to(enemy, rarity)
	EnemyDifficultyScalerScript.mark_combat_projection_changed(enemy, &"elite_modifier")
	EnemyDifficultyScalerScript.finalize_experience_reward(enemy)
	return true


static func _apply_dictionary_profile(
	enemy: Node2D,
	property_names: Dictionary,
	modifier: EliteModifierDefinition
) -> void:
	if not enemy.has_method(&"get_combat_profile") or not enemy.has_method(&"set_combat_profile"):
		return
	var raw_profile: Variant = enemy.call(&"get_combat_profile")
	if not raw_profile is Dictionary:
		return
	var profile: Dictionary = (raw_profile as Dictionary).duplicate(true)
	var axes := modifier.get_combat_axes()
	_apply_profile_axis(profile, PROFILE_HEALTH_KEYS, float(axes.health))
	_apply_profile_axis(profile, PROFILE_DAMAGE_KEYS, float(axes.damage))
	_apply_profile_axis(profile, PROFILE_MOVEMENT_KEYS, float(axes.movement))
	_apply_profile_axis(profile, PROFILE_RANGE_KEYS, float(axes.range))
	for key: String in PROFILE_DIVIDED_KEYS:
		if profile.has(key):
			profile[key] = _scaled_number(
				profile[key],
				1.0 / float(axes.attack_rate),
			)
	if profile.has("score"):
		profile["score"] = _scaled_number(profile["score"], float(axes.reward_score))
	if not bool(enemy.call(&"set_combat_profile", profile)):
		return
	if property_names.has("max_health") and profile.has("max_health"):
		enemy.set("max_health", int(profile["max_health"]))
	if property_names.has("score_reward") and profile.has("score"):
		enemy.set("score_reward", int(profile["score"]))


static func _apply_direct_axis(
	enemy: Node2D,
	property_names: Dictionary,
	axis_properties: Array,
	multiplier: float,
) -> void:
	for property_name: String in axis_properties:
		if property_names.has(property_name):
			enemy.set(
				property_name,
				_scaled_number(enemy.get(property_name), multiplier),
			)


static func _apply_profile_axis(
	profile: Dictionary,
	axis_keys: Array,
	multiplier: float,
) -> void:
	for key: String in axis_keys:
		if profile.has(key):
			profile[key] = _scaled_number(profile[key], multiplier)


static func _property_names(object: Object) -> Dictionary:
	var names := {}
	for property: Dictionary in object.get_property_list():
		names[String(property.get("name", ""))] = true
	return names


static func _scaled_number(value: Variant, multiplier: float) -> Variant:
	if value is int:
		return maxi(1, roundi(float(value) * multiplier))
	if value is float:
		return maxf(0.001, float(value) * multiplier)
	return value
