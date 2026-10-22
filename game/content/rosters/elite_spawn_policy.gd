@tool
class_name EliteSpawnPolicy
extends Resource

const EliteModifierDefinition = preload("res://game/content/rosters/elite_modifier_definition.gd")

## Stage-wide elite rules. The random roll runs once per authored camp and can
## promote at most one eligible regular unit in that camp. A second guarantee
## pass promotes one unit of every still-missing eligible archetype.

@export_range(0.0, 1.0, 0.01) var chance_per_camp := 0.0
@export var guarantee_one_per_eligible_archetype := false
@export var prefer_empty_camp_for_guarantee := true
@export var modifier: EliteModifierDefinition


func is_enabled() -> bool:
	return chance_per_camp > 0.0 or guarantee_one_per_eligible_archetype


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if chance_per_camp < 0.0 or chance_per_camp > 1.0:
		errors.append("Elite chance per camp must stay between zero and one.")
	if is_enabled() and modifier == null:
		errors.append("Enabled elite policy requires a modifier.")
	elif modifier != null:
		for child_error: String in modifier.get_validation_errors():
			errors.append("modifier: %s" % child_error)
	return errors
