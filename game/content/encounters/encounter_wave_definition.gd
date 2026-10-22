@tool
class_name EncounterWaveDefinition
extends Resource

## One ordered wave in an encounter. Groups execute in array order; the delay
## between groups is authored here so timing does not leak into gameplay code.

@export var wave_id: StringName
@export var groups: Array[EncounterGroupDefinition] = []
@export_range(0.0, 120.0, 0.05) var start_delay_seconds := 0.0
@export_range(0.0, 120.0, 0.05) var inter_group_delay_seconds := 0.0


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, wave_id, "Encounter wave ID")
	if groups.is_empty():
		errors.append("Encounter wave must contain at least one group.")
	var seen_group_ids := {}
	for index: int in groups.size():
		var group := groups[index]
		if group == null:
			errors.append("Encounter wave groups[%d] cannot be null." % index)
			continue
		for child_error: String in group.get_validation_errors():
			errors.append("groups[%d]: %s" % [index, child_error])
		if seen_group_ids.has(group.group_id):
			errors.append("Encounter wave contains duplicate group ID '%s'." % group.group_id)
		else:
			seen_group_ids[group.group_id] = true
	if start_delay_seconds < 0.0 or inter_group_delay_seconds < 0.0:
		errors.append("Encounter wave delays cannot be negative.")
	return errors
