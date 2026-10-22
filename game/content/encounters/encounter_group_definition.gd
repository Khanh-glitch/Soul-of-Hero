@tool
class_name EncounterGroupDefinition
extends Resource

## An ordered group within a wave. The array order of spawn_entries is the
## deterministic authoring order used by a future encounter runner.

enum CompletionRule {
	ALL_SPAWNED_ENEMIES_DEFEATED,
	DURATION_ELAPSED,
	EXTERNAL_SIGNAL,
}

@export var group_id: StringName
@export var spawn_entries: Array[EncounterSpawnEntry] = []
@export_range(0.0, 120.0, 0.05) var start_delay_seconds := 0.0
@export_range(0.0, 30.0, 0.05) var inter_entry_delay_seconds := 0.0
@export var completion_rule := CompletionRule.ALL_SPAWNED_ENEMIES_DEFEATED
@export_range(0.0, 3600.0, 0.1) var duration_seconds := 0.0
@export var completion_signal: StringName


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, group_id, "Encounter group ID")
	if spawn_entries.is_empty():
		errors.append("Encounter group must contain at least one spawn entry.")
	var seen_entry_ids := {}
	for index: int in spawn_entries.size():
		var entry := spawn_entries[index]
		if entry == null:
			errors.append("Encounter group spawn_entries[%d] cannot be null." % index)
			continue
		for child_error: String in entry.get_validation_errors():
			errors.append("spawn_entries[%d]: %s" % [index, child_error])
		if seen_entry_ids.has(entry.entry_id):
			errors.append("Encounter group contains duplicate spawn entry ID '%s'." % entry.entry_id)
		else:
			seen_entry_ids[entry.entry_id] = true
	if start_delay_seconds < 0.0 or inter_entry_delay_seconds < 0.0:
		errors.append("Encounter group delays cannot be negative.")
	match completion_rule:
		CompletionRule.ALL_SPAWNED_ENEMIES_DEFEATED:
			pass
		CompletionRule.DURATION_ELAPSED:
			if duration_seconds <= 0.0:
				errors.append("Duration-based encounter group requires duration_seconds greater than zero.")
		CompletionRule.EXTERNAL_SIGNAL:
			ContentId.append_if_invalid(errors, completion_signal, "Group completion signal")
		_:
			errors.append("Encounter group completion rule is not supported.")
	return errors
