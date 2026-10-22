@tool
class_name EncounterSpawnEntry
extends Resource

## One typed enemy batch inside an encounter group.
##
## Exactly one placement source is required: a spawn region for procedural
## placement, or one or more authored marker IDs for deterministic placement.

@export var entry_id: StringName
@export var enemy_id: StringName
@export_range(1, 256, 1) var count := 1
@export var spawn_region_id: StringName
@export var spawn_marker_ids: PackedStringArray
@export var formation_id: StringName = &"scatter"
@export_range(0.0, 120.0, 0.05) var initial_delay_seconds := 0.0
@export_range(0.0, 30.0, 0.05) var interval_seconds := 0.0
@export_range(0, 256, 1) var maximum_alive := 0
## Optional deterministic event emitted by EncounterRuntimeState when one of
## this entry's authored enemies is defeated. This keeps encounter semantics in
## data while the existing enemy-death bridge remains unchanged.
@export var defeat_event_id: StringName


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, entry_id, "Spawn entry ID")
	ContentId.append_if_invalid(errors, enemy_id, "Spawn enemy ID")
	ContentId.append_if_invalid(errors, formation_id, "Spawn formation ID")
	if count < 1:
		errors.append("Spawn entry count must be at least one.")
	if initial_delay_seconds < 0.0 or interval_seconds < 0.0:
		errors.append("Spawn delays cannot be negative.")
	if maximum_alive < 0 or maximum_alive > count:
		errors.append("Spawn maximum_alive must be zero or no greater than count.")
	if not defeat_event_id.is_empty():
		ContentId.append_if_invalid(errors, defeat_event_id, "Spawn defeat event ID")
	var uses_region := not spawn_region_id.is_empty()
	var uses_markers := not spawn_marker_ids.is_empty()
	if uses_region == uses_markers:
		errors.append("Spawn entry must use exactly one placement source: spawn_region_id or spawn_marker_ids.")
	if uses_region:
		ContentId.append_if_invalid(errors, spawn_region_id, "Spawn region ID")
	if uses_markers:
		ContentId.append_duplicate_or_invalid_ids(errors, spawn_marker_ids, "Spawn marker IDs")
		if spawn_marker_ids.size() < count:
			errors.append("Authored spawn marker count must be at least the requested enemy count.")
	return errors
