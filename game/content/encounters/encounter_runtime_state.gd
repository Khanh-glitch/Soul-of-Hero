class_name EncounterRuntimeState
extends RefCounted

## Runtime projection of the authored encounter objective contract.
##
## P0 intentionally leaves spawning with the existing layout JSON. Authored
## spawn_marker_ids are the stable bridge between those live actors and the
## EncounterDefinition groups/objectives that decide whether a gate may open.

signal state_changed(snapshot: Dictionary)

var _configured := false
var _level_id: StringName
var _encounters_by_id: Dictionary = {}
var _objectives_by_encounter: Dictionary = {}
var _required_objectives_by_encounter: Dictionary = {}
var _encounter_enemy_ids: Dictionary = {}
var _encounter_runtime_valid: Dictionary = {}
var _group_enemy_ids: Dictionary = {}
var _groups_by_encounter: Dictionary = {}
var _enemy_records: Dictionary = {}
var _gate_encounter_ids: Dictionary = {}
var _defeated_enemy_ids: Dictionary = {}
var _custom_event_counts: Dictionary = {}


func clear() -> void:
	_disconnect_gameplay_events()
	_configured = false
	_level_id = StringName()
	_encounters_by_id.clear()
	_objectives_by_encounter.clear()
	_required_objectives_by_encounter.clear()
	_encounter_enemy_ids.clear()
	_encounter_runtime_valid.clear()
	_group_enemy_ids.clear()
	_groups_by_encounter.clear()
	_enemy_records.clear()
	_gate_encounter_ids.clear()
	_defeated_enemy_ids.clear()
	_custom_event_counts.clear()


func configure(
	level_definition: LevelDefinition,
	registry: LevelRegistry,
	layout_entities: Array,
) -> PackedStringArray:
	clear()
	var errors := PackedStringArray()
	if level_definition == null:
		errors.append("Encounter runtime requires a level definition.")
		return errors
	if registry == null:
		errors.append("Encounter runtime requires the level's content registry.")
		return errors

	_configured = true
	_level_id = level_definition.level_id
	var layout_entity_ids := _index_layout_entities(layout_entities)
	for raw_encounter_id: String in level_definition.encounter_ids:
		var encounter_id := StringName(raw_encounter_id)
		var encounter := registry.find_encounter(encounter_id)
		if encounter == null:
			errors.append(
				"Level '%s' cannot run missing encounter '%s'." % [_level_id, encounter_id]
			)
			continue
		_register_encounter(encounter, layout_entity_ids, errors)
	_connect_gameplay_events()
	return errors


func is_configured() -> bool:
	return _configured


func is_tracked_enemy(entity_id: StringName) -> bool:
	return _enemy_records.has(entity_id)


func mark_enemy_defeated(entity_id: StringName) -> bool:
	if not is_tracked_enemy(entity_id) or _defeated_enemy_ids.has(entity_id):
		return false
	_defeated_enemy_ids[entity_id] = true
	var record: Dictionary = _enemy_records.get(entity_id, {})
	var defeat_event_id := StringName(record.get("defeat_event_id", ""))
	if not defeat_event_id.is_empty():
		_record_custom_event(defeat_event_id, 1, false)
	state_changed.emit(get_snapshot())
	return true


## Removes authored alternatives that a deterministic branch choice did not
## select. They are not counted as defeated and never contribute to the live
## encounter total, which keeps branch HUD/gate state truthful.
func deactivate_tracked_enemies(entity_ids: PackedStringArray) -> int:
	var removed := 0
	for raw_entity_id: String in entity_ids:
		var entity_id := StringName(raw_entity_id)
		if not _enemy_records.has(entity_id):
			continue
		var record: Dictionary = _enemy_records.get(entity_id, {})
		var encounter_id := StringName(record.get("encounter_id", ""))
		var group_id := StringName(record.get("group_id", ""))
		var encounter_enemy_ids: Dictionary = _encounter_enemy_ids.get(encounter_id, {})
		encounter_enemy_ids.erase(entity_id)
		_encounter_enemy_ids[encounter_id] = encounter_enemy_ids
		var group_key := _group_key(encounter_id, group_id)
		var group_enemy_ids: Dictionary = _group_enemy_ids.get(group_key, {})
		group_enemy_ids.erase(entity_id)
		_group_enemy_ids[group_key] = group_enemy_ids
		_enemy_records.erase(entity_id)
		_defeated_enemy_ids.erase(entity_id)
		removed += 1
	if removed > 0:
		state_changed.emit(get_snapshot())
	return removed


func record_custom_event(event_id: StringName, amount: int = 1) -> bool:
	return _record_custom_event(event_id, amount, true)


func is_group_complete(encounter_id: StringName, group_id: StringName) -> bool:
	var group_key := _group_key(encounter_id, group_id)
	var enemy_ids: Dictionary = _group_enemy_ids.get(group_key, {})
	if enemy_ids.is_empty():
		return false
	for entity_id: StringName in enemy_ids:
		if not _defeated_enemy_ids.has(entity_id):
			return false
	return true


func is_objective_complete(encounter_id: StringName, objective_id: StringName) -> bool:
	var objectives: Dictionary = _objectives_by_encounter.get(encounter_id, {})
	var objective := objectives.get(objective_id) as EncounterObjectiveDefinition
	if objective == null:
		return false
	match objective.objective_type:
		EncounterObjectiveDefinition.ObjectiveType.DEFEAT_ALL:
			var enemy_ids: Dictionary = _encounter_enemy_ids.get(encounter_id, {})
			if enemy_ids.is_empty():
				return false
			for entity_id: StringName in enemy_ids:
				if not _defeated_enemy_ids.has(entity_id):
					return false
			return true
		EncounterObjectiveDefinition.ObjectiveType.DEFEAT_COUNT:
			return _defeated_count(encounter_id, objective.target_id) >= objective.target_count
		EncounterObjectiveDefinition.ObjectiveType.CUSTOM_EVENT:
			return int(_custom_event_counts.get(objective.target_id, 0)) >= maxi(1, objective.target_count)
		_:
			return false


func is_encounter_complete(encounter_id: StringName) -> bool:
	if not bool(_encounter_runtime_valid.get(encounter_id, false)):
		return false
	var required_ids: PackedStringArray = _required_objectives_by_encounter.get(
		encounter_id,
		PackedStringArray(),
	)
	if required_ids.is_empty():
		return false
	for raw_objective_id: String in required_ids:
		if not is_objective_complete(encounter_id, StringName(raw_objective_id)):
			return false
	return true


func is_complete() -> bool:
	if not _configured or _encounters_by_id.is_empty():
		return true
	for encounter_id: StringName in _encounters_by_id:
		if not is_encounter_complete(encounter_id):
			return false
	return true


func is_gate_controlled(gate_entity_id: StringName) -> bool:
	return _gate_encounter_ids.has(gate_entity_id)


func is_gate_unlocked(gate_entity_id: StringName) -> bool:
	var encounter_ids: Array = _gate_encounter_ids.get(gate_entity_id, [])
	if encounter_ids.is_empty():
		return true
	for encounter_id_value: Variant in encounter_ids:
		if not is_encounter_complete(StringName(encounter_id_value)):
			return false
	return true


func get_remaining_enemy_count() -> int:
	return maxi(0, _enemy_records.size() - _defeated_enemy_ids.size())


func get_snapshot() -> Dictionary:
	var encounters := {}
	var completed_groups := 0
	var total_groups := 0
	for encounter_id: StringName in _encounters_by_id:
		var groups := {}
		var group_keys: Array = _groups_by_encounter.get(encounter_id, [])
		for group_key_value: Variant in group_keys:
			var group_key := String(group_key_value)
			var group_id := StringName(group_key.get_slice("/", 1))
			var enemy_ids: Dictionary = _group_enemy_ids.get(group_key, {})
			var defeated := _count_defeated(enemy_ids)
			var complete := not enemy_ids.is_empty() and defeated == enemy_ids.size()
			groups[String(group_id)] = {
				"total": enemy_ids.size(),
				"defeated": defeated,
				"remaining": maxi(0, enemy_ids.size() - defeated),
				"complete": complete,
			}
			total_groups += 1
			if complete:
				completed_groups += 1

		var objectives := {}
		var objective_lookup: Dictionary = _objectives_by_encounter.get(encounter_id, {})
		for objective_id: StringName in objective_lookup:
			objectives[String(objective_id)] = is_objective_complete(encounter_id, objective_id)
		encounters[String(encounter_id)] = {
			"valid": bool(_encounter_runtime_valid.get(encounter_id, false)),
			"complete": is_encounter_complete(encounter_id),
			"groups": groups,
			"objectives": objectives,
		}

	var gates := {}
	for gate_id: StringName in _gate_encounter_ids:
		gates[String(gate_id)] = is_gate_unlocked(gate_id)
	return {
		"configured": _configured,
		"level_id": String(_level_id),
		"total_enemies": _enemy_records.size(),
		"defeated_enemies": _defeated_enemy_ids.size(),
		"remaining_enemies": get_remaining_enemy_count(),
		"completed_groups": completed_groups,
		"total_groups": total_groups,
		"complete": is_complete(),
		"encounters": encounters,
		"gates": gates,
		"custom_events": _string_keyed_event_counts(),
	}


func _register_encounter(
	encounter: EncounterDefinition,
	layout_entity_ids: Dictionary,
	errors: PackedStringArray,
) -> void:
	var encounter_id := encounter.encounter_id
	_encounters_by_id[encounter_id] = encounter
	_encounter_runtime_valid[encounter_id] = true
	_encounter_enemy_ids[encounter_id] = {}
	_groups_by_encounter[encounter_id] = []

	var objectives := {}
	for objective: EncounterObjectiveDefinition in encounter.objectives:
		if objective != null:
			objectives[objective.objective_id] = objective
	_objectives_by_encounter[encounter_id] = objectives

	if encounter.completion == null:
		_invalidate_encounter(encounter_id)
		errors.append("Encounter '%s' has no runtime completion contract." % encounter_id)
		return
	_required_objectives_by_encounter[encounter_id] = encounter.completion.required_objective_ids
	for raw_objective_id: String in encounter.completion.required_objective_ids:
		var objective := objectives.get(StringName(raw_objective_id)) as EncounterObjectiveDefinition
		if objective == null:
			_invalidate_encounter(encounter_id)
			continue
		if objective.objective_type not in [
			EncounterObjectiveDefinition.ObjectiveType.DEFEAT_ALL,
			EncounterObjectiveDefinition.ObjectiveType.DEFEAT_COUNT,
			EncounterObjectiveDefinition.ObjectiveType.CUSTOM_EVENT,
		]:
			_invalidate_encounter(encounter_id)
			errors.append(
				"Encounter '%s' objective '%s' is not supported by the P0 runtime." % [
					encounter_id,
					objective.objective_id,
				]
			)

	for wave: EncounterWaveDefinition in encounter.waves:
		if wave == null:
			continue
		for group: EncounterGroupDefinition in wave.groups:
			if group == null:
				continue
			_register_group(encounter_id, group, layout_entity_ids, errors)

	for objective: EncounterObjectiveDefinition in encounter.objectives:
		if objective == null or objective.objective_type != EncounterObjectiveDefinition.ObjectiveType.DEFEAT_COUNT:
			continue
		var available := _authored_enemy_count(encounter_id, objective.target_id)
		if available < objective.target_count:
			_invalidate_encounter(encounter_id)
			errors.append(
				"Encounter '%s' objective '%s' needs %d '%s' markers but only %d are authored." % [
					encounter_id,
					objective.objective_id,
					objective.target_count,
					objective.target_id,
					available,
				]
			)

	if encounter.completion.gate_action != EncounterCompletionContract.GateAction.NONE:
		for raw_gate_id: String in encounter.completion.gate_entity_ids:
			var gate_id := StringName(raw_gate_id)
			if not layout_entity_ids.has(gate_id):
				_invalidate_encounter(encounter_id)
				errors.append(
					"Encounter '%s' gate marker '%s' is missing from the layout." % [
						encounter_id,
						gate_id,
					]
				)
			var controllers: Array = _gate_encounter_ids.get(gate_id, [])
			if not controllers.has(encounter_id):
				controllers.append(encounter_id)
			_gate_encounter_ids[gate_id] = controllers


func _register_group(
	encounter_id: StringName,
	group: EncounterGroupDefinition,
	layout_entity_ids: Dictionary,
	errors: PackedStringArray,
) -> void:
	var group_key := _group_key(encounter_id, group.group_id)
	var group_enemy_ids := {}
	_group_enemy_ids[group_key] = group_enemy_ids
	(_groups_by_encounter[encounter_id] as Array).append(group_key)
	for entry: EncounterSpawnEntry in group.spawn_entries:
		if entry == null:
			continue
		if entry.spawn_marker_ids.is_empty():
			_invalidate_encounter(encounter_id)
			errors.append(
				"Encounter '%s' group '%s' entry '%s' needs spawn_marker_ids for P0 runtime tracking." % [
					encounter_id,
					group.group_id,
					entry.entry_id,
				]
			)
			continue
		var marker_count := mini(entry.count, entry.spawn_marker_ids.size())
		for marker_index: int in marker_count:
			var entity_id := StringName(entry.spawn_marker_ids[marker_index])
			if not layout_entity_ids.has(entity_id):
				_invalidate_encounter(encounter_id)
				errors.append(
					"Encounter '%s' spawn marker '%s' is missing from the layout." % [
						encounter_id,
						entity_id,
					]
				)
				continue
			if _enemy_records.has(entity_id):
				_invalidate_encounter(encounter_id)
				errors.append(
					"Encounter runtime marker '%s' is assigned more than once." % entity_id
				)
				continue
			group_enemy_ids[entity_id] = true
			(_encounter_enemy_ids[encounter_id] as Dictionary)[entity_id] = true
			_enemy_records[entity_id] = {
				"encounter_id": encounter_id,
				"group_id": group.group_id,
				"enemy_id": entry.enemy_id,
				"defeat_event_id": entry.defeat_event_id,
			}
	_group_enemy_ids[group_key] = group_enemy_ids
	if group_enemy_ids.is_empty():
		_invalidate_encounter(encounter_id)


func _index_layout_entities(layout_entities: Array) -> Dictionary:
	var result := {}
	for value: Variant in layout_entities:
		if not value is Dictionary:
			continue
		var entity_id := StringName(String(value.get("id", "")).strip_edges())
		if not entity_id.is_empty():
			result[entity_id] = StringName(value.get("type", ""))
	return result


func _authored_enemy_count(encounter_id: StringName, enemy_id: StringName) -> int:
	var result := 0
	var encounter_ids: Dictionary = _encounter_enemy_ids.get(encounter_id, {})
	for entity_id: StringName in encounter_ids:
		var record: Dictionary = _enemy_records.get(entity_id, {})
		if StringName(record.get("enemy_id", "")) == enemy_id:
			result += 1
	return result


func _defeated_count(encounter_id: StringName, enemy_id: StringName) -> int:
	var result := 0
	var encounter_ids: Dictionary = _encounter_enemy_ids.get(encounter_id, {})
	for entity_id: StringName in encounter_ids:
		if not _defeated_enemy_ids.has(entity_id):
			continue
		var record: Dictionary = _enemy_records.get(entity_id, {})
		if StringName(record.get("enemy_id", "")) == enemy_id:
			result += 1
	return result


func _count_defeated(enemy_ids: Dictionary) -> int:
	var result := 0
	for entity_id: StringName in enemy_ids:
		if _defeated_enemy_ids.has(entity_id):
			result += 1
	return result


func _invalidate_encounter(encounter_id: StringName) -> void:
	_encounter_runtime_valid[encounter_id] = false


func _group_key(encounter_id: StringName, group_id: StringName) -> String:
	return "%s/%s" % [encounter_id, group_id]


func _record_custom_event(event_id: StringName, amount: int, emit_change: bool) -> bool:
	if not _configured or event_id.is_empty() or amount < 1 or not _tracks_custom_event(event_id):
		return false
	_custom_event_counts[event_id] = int(_custom_event_counts.get(event_id, 0)) + amount
	if emit_change:
		state_changed.emit(get_snapshot())
	return true


func _tracks_custom_event(event_id: StringName) -> bool:
	for encounter_id: StringName in _objectives_by_encounter:
		var objectives: Dictionary = _objectives_by_encounter.get(encounter_id, {})
		for objective_id: StringName in objectives:
			var objective := objectives.get(objective_id) as EncounterObjectiveDefinition
			if (
				objective != null
				and objective.objective_type == EncounterObjectiveDefinition.ObjectiveType.CUSTOM_EVENT
				and objective.target_id == event_id
			):
				return true
	return false


func _string_keyed_event_counts() -> Dictionary:
	var result := {}
	for event_id: StringName in _custom_event_counts:
		result[String(event_id)] = int(_custom_event_counts[event_id])
	return result


func _connect_gameplay_events() -> void:
	var events := _get_game_events()
	if events == null or not events.has_signal(&"soul_relay_completed"):
		return
	var callback := Callable(self, &"_on_soul_relay_completed")
	if not events.is_connected(&"soul_relay_completed", callback):
		events.connect(&"soul_relay_completed", callback)


func _disconnect_gameplay_events() -> void:
	var events := _get_game_events()
	if events == null or not events.has_signal(&"soul_relay_completed"):
		return
	var callback := Callable(self, &"_on_soul_relay_completed")
	if events.is_connected(&"soul_relay_completed", callback):
		events.disconnect(&"soul_relay_completed", callback)


func _get_game_events() -> Node:
	var tree := Engine.get_main_loop() as SceneTree
	return tree.root.get_node_or_null("GameEvents") if tree != null else null


func _on_soul_relay_completed(
	incoming_hero_id: StringName,
	outgoing_hero_id: StringName,
	_destination: Vector2,
) -> void:
	var event_id := StringName("relay_%s_to_%s" % [outgoing_hero_id, incoming_hero_id])
	record_custom_event(event_id)
