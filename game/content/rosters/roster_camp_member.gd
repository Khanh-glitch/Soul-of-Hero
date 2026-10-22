@tool
class_name RosterCampMember
extends Resource

## Count allocation for one LevelRosterEntry inside an authored camp.

@export var entry_id: StringName
@export_range(1, 512, 1) var count := 1


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, entry_id, "Camp member entry ID")
	if count < 1:
		errors.append("Camp member count must be at least one.")
	return errors

