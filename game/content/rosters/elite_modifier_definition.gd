@tool
class_name EliteModifierDefinition
extends Resource

const RARITY_PALETTE := preload("res://game/ui/rarity_palette.gd")

## Reusable gameplay and presentation contract for an elite promotion.
##
## The modifier is applied to an existing roster unit; an elite never adds an
## extra body to the authored level total.

@export_category("Identity")
@export var modifier_id: StringName
@export var display_name := "Elite"
@export_multiline var authoring_notes: String

@export_category("Gameplay")
## Elite pressure is authored by independent, inspectable axes. A single shared
## scalar used to multiply damage while also dividing cooldown, accidentally
## compounding two pressure channels into a much larger sustained-DPS spike.
@export_range(1.0, 20.0, 0.05) var health_multiplier := 2.25
@export_range(1.0, 20.0, 0.05) var damage_multiplier := 1.35
@export_range(1.0, 5.0, 0.01) var attack_rate_multiplier := 1.15
@export_range(1.0, 5.0, 0.01) var movement_multiplier := 1.08
@export_range(1.0, 5.0, 0.01) var range_multiplier := 1.05
@export_range(1.0, 20.0, 0.05) var reward_score_multiplier := 2.50

@export_category("Silhouette")
@export_range(1.0, 3.0, 0.01) var visual_scale_multiplier := 1.3
@export var minimum_rarity: StringName = &"magic"


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, modifier_id, "Elite modifier ID")
	if display_name.strip_edges().is_empty():
		errors.append("Elite modifier display name is required.")
	if health_multiplier < 1.0:
		errors.append("Elite health multiplier must be at least one.")
	if damage_multiplier < 1.0:
		errors.append("Elite damage multiplier must be at least one.")
	if attack_rate_multiplier < 1.0:
		errors.append("Elite attack-rate multiplier must be at least one.")
	if movement_multiplier < 1.0:
		errors.append("Elite movement multiplier must be at least one.")
	if range_multiplier < 1.0:
		errors.append("Elite range multiplier must be at least one.")
	if reward_score_multiplier < 1.0:
		errors.append("Elite reward-score multiplier must be at least one.")
	if visual_scale_multiplier <= 1.0:
		errors.append("Elite visual scale multiplier must be greater than one.")
	if RARITY_PALETTE.normalize(minimum_rarity) != minimum_rarity:
		errors.append("Elite minimum rarity must use one canonical rarity ID.")
	return errors


func get_combat_axes() -> Dictionary:
	return {
		"health": health_multiplier,
		"damage": damage_multiplier,
		"attack_rate": attack_rate_multiplier,
		"movement": movement_multiplier,
		"range": range_multiplier,
		"reward_score": reward_score_multiplier,
		"sustained_dps": damage_multiplier * attack_rate_multiplier,
	}
