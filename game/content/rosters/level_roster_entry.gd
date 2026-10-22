@tool
class_name LevelRosterEntry
extends Resource

## One combatant archetype and its exact stage-wide quantity.

enum CombatantKind {
	ENEMY,
	SPECIAL_BOSS,
}

@export var entry_id: StringName
@export var combatant_kind := CombatantKind.ENEMY
@export var combatant_id: StringName
@export var source_id: StringName
@export_range(1, 512, 1) var count := 1
@export var elite_eligible := false
@export var unique := false
@export var miniboss := false
@export_multiline var authoring_notes: String


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, entry_id, "Roster entry ID")
	ContentId.append_if_invalid(errors, combatant_id, "Roster combatant ID")
	if count < 1:
		errors.append("Roster entry count must be at least one.")
	if unique and count != 1:
		errors.append("Unique roster entry must have a count of exactly one.")
	if unique and elite_eligible:
		errors.append("Unique roster entry cannot be elite-eligible.")
	match combatant_kind:
		CombatantKind.ENEMY:
			if not source_id.is_empty():
				errors.append("Enemy roster entry resolves directly by combatant_id and must not set source_id.")
		CombatantKind.SPECIAL_BOSS:
			ContentId.append_if_invalid(errors, source_id, "Special boss source ID")
			if not unique or not miniboss or count != 1:
				errors.append("Special boss roster entry must be one unique miniboss.")
			if elite_eligible:
				errors.append("Special boss roster entry cannot be elite-eligible.")
		_:
			errors.append("Roster combatant kind is not supported.")
	return errors

