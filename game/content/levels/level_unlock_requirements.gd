@tool
class_name LevelUnlockRequirements
extends Resource

## All prerequisites are conjunctive. Feature requirements must be available in
## the transitive prerequisite-level closure (or registry initial features).

@export var prerequisite_level_ids: PackedStringArray
@export var required_feature_ids: PackedStringArray
@export_range(0, 9999, 1) var minimum_account_level := 0
@export_range(0, 999999, 1) var minimum_total_mastery := 0
@export var custom_condition_id: StringName


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_duplicate_or_invalid_ids(errors, prerequisite_level_ids, "Level prerequisite IDs")
	ContentId.append_duplicate_or_invalid_ids(errors, required_feature_ids, "Level required feature IDs")
	if minimum_account_level < 0 or minimum_total_mastery < 0:
		errors.append("Level unlock numeric requirements cannot be negative.")
	if not custom_condition_id.is_empty():
		ContentId.append_if_invalid(errors, custom_condition_id, "Level custom condition ID")
	return errors
