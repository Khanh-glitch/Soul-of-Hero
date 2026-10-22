@tool
class_name EncounterObjectiveDefinition
extends Resource

## A deterministic objective contract. target_id meaning is defined by type:
## enemy ID for DEFEAT_COUNT, entity ID for protect/reach/interact, and a
## gameplay event ID for CUSTOM_EVENT. DEFEAT_ALL intentionally has no target.

enum ObjectiveType {
	DEFEAT_ALL,
	DEFEAT_COUNT,
	SURVIVE_SECONDS,
	PROTECT_ENTITY,
	REACH_ENTITY,
	INTERACT_ENTITY,
	CUSTOM_EVENT,
}

@export var objective_id: StringName
@export var objective_type := ObjectiveType.DEFEAT_ALL
@export var description_key: String
@export var target_id: StringName
@export_range(0, 9999, 1) var target_count := 0
@export_range(0.0, 3600.0, 0.1) var duration_seconds := 0.0
@export var required := true
@export var failure_ends_encounter := false


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, objective_id, "Encounter objective ID")
	if description_key.strip_edges().is_empty():
		errors.append("Encounter objective description key is required.")
	match objective_type:
		ObjectiveType.DEFEAT_ALL:
			if not target_id.is_empty() or target_count != 0 or duration_seconds != 0.0:
				errors.append("DEFEAT_ALL objective does not accept target_id, target_count, or duration_seconds.")
		ObjectiveType.DEFEAT_COUNT:
			ContentId.append_if_invalid(errors, target_id, "Objective enemy ID")
			if target_count < 1:
				errors.append("DEFEAT_COUNT objective requires target_count of at least one.")
		ObjectiveType.SURVIVE_SECONDS:
			if duration_seconds <= 0.0:
				errors.append("SURVIVE_SECONDS objective requires duration_seconds greater than zero.")
			if not target_id.is_empty() or target_count != 0:
				errors.append("SURVIVE_SECONDS objective does not accept target_id or target_count.")
		ObjectiveType.PROTECT_ENTITY, ObjectiveType.REACH_ENTITY, ObjectiveType.INTERACT_ENTITY:
			ContentId.append_if_invalid(errors, target_id, "Objective target ID")
			if target_count > 1:
				errors.append("Entity objective target_count must be zero or one.")
		ObjectiveType.CUSTOM_EVENT:
			ContentId.append_if_invalid(errors, target_id, "Objective event ID")
			# Zero is the legacy shorthand for one occurrence. Positive values add
			# explicit counted-event objectives without invalidating older drafts.
		_:
			errors.append("Encounter objective type is not supported.")
	if duration_seconds < 0.0:
		errors.append("Encounter objective duration cannot be negative.")
	return errors
