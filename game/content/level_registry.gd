@tool
class_name LevelRegistry
extends Resource

const LevelRosterDefinition = preload("res://game/content/rosters/level_roster_definition.gd")
const LevelRosterEntry = preload("res://game/content/rosters/level_roster_entry.gd")

## Indexed catalog and cross-resource validator for the 100-level campaign model.
##
## The registry deliberately permits a partial catalog while content is being
## authored; it never fabricates missing campaign slots. Call rebuild_index()
## after mutating an exported array at runtime. Resource loads build lazily.

const CURRENT_SCHEMA_VERSION := 1
const CAMPAIGN_LEVEL_CAPACITY := LevelDefinition.CAMPAIGN_LEVEL_CAPACITY

@export var registry_id: StringName = &"living_arsenal_content"
@export var schema_version := CURRENT_SCHEMA_VERSION
@export var initial_feature_ids: PackedStringArray
@export var enemy_definitions: Array[EnemyDefinition] = []
@export var encounter_definitions: Array[EncounterDefinition] = []
@export var level_definitions: Array[LevelDefinition] = []
@export var roster_definitions: Array[LevelRosterDefinition] = []

var _enemy_by_id: Dictionary = {}
var _enemy_by_layout_type: Dictionary = {}
var _encounter_by_id: Dictionary = {}
var _level_by_id: Dictionary = {}
var _campaign_by_slot: Dictionary = {}
var _roster_by_id: Dictionary = {}
var _roster_by_slot: Dictionary = {}
var _indices_ready := false


func rebuild_index() -> void:
	_enemy_by_id.clear()
	_enemy_by_layout_type.clear()
	_encounter_by_id.clear()
	_level_by_id.clear()
	_campaign_by_slot.clear()
	_roster_by_id.clear()
	_roster_by_slot.clear()
	for definition: EnemyDefinition in enemy_definitions:
		if definition == null:
			continue
		if not _enemy_by_id.has(definition.enemy_id):
			_enemy_by_id[definition.enemy_id] = definition
		for raw_layout_type: String in definition.get_layout_type_ids():
			var layout_type := StringName(raw_layout_type)
			if not _enemy_by_layout_type.has(layout_type):
				_enemy_by_layout_type[layout_type] = definition
	for definition: EncounterDefinition in encounter_definitions:
		if definition != null and not _encounter_by_id.has(definition.encounter_id):
			_encounter_by_id[definition.encounter_id] = definition
	for definition: LevelDefinition in level_definitions:
		if definition == null:
			continue
		if not _level_by_id.has(definition.level_id):
			_level_by_id[definition.level_id] = definition
		if definition.is_campaign_level() and definition.campaign_slot > 0 and not _campaign_by_slot.has(definition.campaign_slot):
			_campaign_by_slot[definition.campaign_slot] = definition
	for definition: LevelRosterDefinition in roster_definitions:
		if definition == null:
			continue
		if not _roster_by_id.has(definition.roster_id):
			_roster_by_id[definition.roster_id] = definition
		if definition.campaign_slot > 0 and not _roster_by_slot.has(definition.campaign_slot):
			_roster_by_slot[definition.campaign_slot] = definition
	_indices_ready = true


func find_enemy(enemy_id: StringName) -> EnemyDefinition:
	_ensure_indices()
	return _enemy_by_id.get(enemy_id) as EnemyDefinition


func find_enemy_by_layout_type(layout_type_id: StringName) -> EnemyDefinition:
	_ensure_indices()
	return _enemy_by_layout_type.get(layout_type_id) as EnemyDefinition


func get_layout_enemy_types() -> PackedStringArray:
	return _collect_layout_enemy_types(-1)


func get_density_eligible_layout_types() -> PackedStringArray:
	return _collect_layout_enemy_types(1)


func get_density_excluded_layout_types() -> PackedStringArray:
	return _collect_layout_enemy_types(0)


func find_encounter(encounter_id: StringName) -> EncounterDefinition:
	_ensure_indices()
	return _encounter_by_id.get(encounter_id) as EncounterDefinition


func find_level(level_id: StringName) -> LevelDefinition:
	_ensure_indices()
	return _level_by_id.get(level_id) as LevelDefinition


func find_campaign_level(campaign_slot: int) -> LevelDefinition:
	_ensure_indices()
	return _campaign_by_slot.get(campaign_slot) as LevelDefinition


func find_roster(roster_id: StringName) -> LevelRosterDefinition:
	_ensure_indices()
	return _roster_by_id.get(roster_id) as LevelRosterDefinition


func find_campaign_roster(campaign_slot: int) -> LevelRosterDefinition:
	_ensure_indices()
	return _roster_by_slot.get(campaign_slot) as LevelRosterDefinition


func get_ordered_campaign_levels(include_drafts := true) -> Array[LevelDefinition]:
	var result: Array[LevelDefinition] = []
	for definition: LevelDefinition in level_definitions:
		if definition == null or not definition.is_campaign_level():
			continue
		if include_drafts or definition.is_campaign_ready():
			result.append(definition)
	result.sort_custom(func(left: LevelDefinition, right: LevelDefinition) -> bool:
		return left.campaign_slot < right.campaign_slot
	)
	return result


func get_ordered_campaign_rosters() -> Array[LevelRosterDefinition]:
	var result: Array[LevelRosterDefinition] = []
	for definition: LevelRosterDefinition in roster_definitions:
		if definition != null:
			result.append(definition)
	result.sort_custom(func(left: LevelRosterDefinition, right: LevelRosterDefinition) -> bool:
		return left.campaign_slot < right.campaign_slot
	)
	return result


func get_validation_errors() -> PackedStringArray:
	rebuild_index()
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, registry_id, "Content registry ID")
	if schema_version != CURRENT_SCHEMA_VERSION:
		errors.append("Content registry schema_version must be %d." % CURRENT_SCHEMA_VERSION)
	ContentId.append_duplicate_or_invalid_ids(errors, initial_feature_ids, "Initial feature IDs")
	_append_definition_errors(errors)
	_validate_duplicate_ids(errors)
	_validate_encounter_references(errors)
	_validate_level_references(errors)
	_validate_roster_references(errors)
	_validate_dependency_cycles(errors)
	_validate_transaction_ids(errors)
	_validate_feature_grants(errors)
	return errors


func is_valid_registry() -> bool:
	return get_validation_errors().is_empty()


func _ensure_indices() -> void:
	if not _indices_ready:
		rebuild_index()


func _collect_layout_enemy_types(density_filter: int) -> PackedStringArray:
	var result := PackedStringArray()
	var seen := {}
	for definition: EnemyDefinition in enemy_definitions:
		if definition == null:
			continue
		if density_filter >= 0 and definition.density_eligible != (density_filter == 1):
			continue
		for layout_type: String in definition.get_layout_type_ids():
			if seen.has(layout_type):
				continue
			seen[layout_type] = true
			result.append(layout_type)
	return result


func _append_definition_errors(errors: PackedStringArray) -> void:
	for index: int in enemy_definitions.size():
		var definition := enemy_definitions[index]
		if definition == null:
			errors.append("enemy_definitions[%d] cannot be null." % index)
			continue
		for child_error: String in definition.get_validation_errors():
			errors.append("enemy_definitions[%d]: %s" % [index, child_error])
	for index: int in encounter_definitions.size():
		var definition := encounter_definitions[index]
		if definition == null:
			errors.append("encounter_definitions[%d] cannot be null." % index)
			continue
		for child_error: String in definition.get_validation_errors():
			errors.append("encounter_definitions[%d]: %s" % [index, child_error])
	for index: int in level_definitions.size():
		var definition := level_definitions[index]
		if definition == null:
			errors.append("level_definitions[%d] cannot be null." % index)
			continue
		for child_error: String in definition.get_validation_errors():
			errors.append("level_definitions[%d]: %s" % [index, child_error])
	for index: int in roster_definitions.size():
		var definition := roster_definitions[index]
		if definition == null:
			errors.append("roster_definitions[%d] cannot be null." % index)
			continue
		for child_error: String in definition.get_validation_errors():
			errors.append("roster_definitions[%d]: %s" % [index, child_error])


func _validate_duplicate_ids(errors: PackedStringArray) -> void:
	var seen_enemy_ids := {}
	var layout_type_owners := {}
	for definition: EnemyDefinition in enemy_definitions:
		if definition == null:
			continue
		if seen_enemy_ids.has(definition.enemy_id):
			errors.append("Duplicate enemy ID '%s'." % definition.enemy_id)
		else:
			seen_enemy_ids[definition.enemy_id] = true
		for raw_layout_type: String in definition.get_layout_type_ids():
			var layout_type := StringName(raw_layout_type)
			if not ContentId.is_valid(layout_type):
				continue
			if layout_type_owners.has(layout_type):
				var existing_owner: StringName = layout_type_owners[layout_type]
				if existing_owner != definition.enemy_id:
					errors.append(
						"Enemy layout type '%s' is shared by '%s' and '%s'." % [
							layout_type,
							existing_owner,
							definition.enemy_id,
						]
					)
			else:
				layout_type_owners[layout_type] = definition.enemy_id
	var seen_encounter_ids := {}
	for definition: EncounterDefinition in encounter_definitions:
		if definition == null:
			continue
		if seen_encounter_ids.has(definition.encounter_id):
			errors.append("Duplicate encounter ID '%s'." % definition.encounter_id)
		else:
			seen_encounter_ids[definition.encounter_id] = true
	var seen_level_ids := {}
	var seen_campaign_slots := {}
	for definition: LevelDefinition in level_definitions:
		if definition == null:
			continue
		if seen_level_ids.has(definition.level_id):
			errors.append("Duplicate level ID '%s'." % definition.level_id)
		else:
			seen_level_ids[definition.level_id] = true
		if definition.campaign_slot <= 0:
			continue
		if seen_campaign_slots.has(definition.campaign_slot):
			errors.append("Duplicate campaign slot %d." % definition.campaign_slot)
		else:
			seen_campaign_slots[definition.campaign_slot] = definition.level_id
	var seen_roster_ids := {}
	var seen_roster_slots := {}
	for definition: LevelRosterDefinition in roster_definitions:
		if definition == null:
			continue
		if seen_roster_ids.has(definition.roster_id):
			errors.append("Duplicate roster ID '%s'." % definition.roster_id)
		else:
			seen_roster_ids[definition.roster_id] = true
		if seen_roster_slots.has(definition.campaign_slot):
			errors.append("Duplicate roster campaign slot %d." % definition.campaign_slot)
		else:
			seen_roster_slots[definition.campaign_slot] = definition.roster_id


func _validate_encounter_references(errors: PackedStringArray) -> void:
	for encounter: EncounterDefinition in encounter_definitions:
		if encounter == null:
			continue
		for prerequisite_id: String in encounter.prerequisite_encounter_ids:
			if not _encounter_by_id.has(StringName(prerequisite_id)):
				errors.append("Encounter '%s' references unknown prerequisite '%s'." % [encounter.encounter_id, prerequisite_id])
		for wave: EncounterWaveDefinition in encounter.waves:
			if wave == null:
				continue
			for group: EncounterGroupDefinition in wave.groups:
				if group == null:
					continue
				for entry: EncounterSpawnEntry in group.spawn_entries:
					if entry != null and not _enemy_by_id.has(entry.enemy_id):
						errors.append(
							"Encounter '%s' group '%s' references unknown enemy '%s'." % [
								encounter.encounter_id,
								group.group_id,
								entry.enemy_id,
							]
						)
		for objective: EncounterObjectiveDefinition in encounter.objectives:
			if objective != null and objective.objective_type == EncounterObjectiveDefinition.ObjectiveType.DEFEAT_COUNT:
				if not _enemy_by_id.has(objective.target_id):
					errors.append("Encounter '%s' objective '%s' references unknown enemy '%s'." % [
					encounter.encounter_id,
					objective.objective_id,
					objective.target_id,
				])
		if encounter.completion != null and not encounter.completion.next_encounter_id.is_empty():
			if not _encounter_by_id.has(encounter.completion.next_encounter_id):
				errors.append("Encounter '%s' references unknown next encounter '%s'." % [
					encounter.encounter_id,
					encounter.completion.next_encounter_id,
				])
			elif encounter.completion.next_encounter_id == encounter.encounter_id:
				errors.append("Encounter '%s' cannot chain directly to itself." % encounter.encounter_id)
		if not encounter.development_only:
			for enemy_id: StringName in _enemy_ids_used_by(encounter):
				var enemy := find_enemy(enemy_id)
				if enemy != null and enemy.development_only:
					errors.append("Production encounter '%s' cannot use development-only enemy '%s'." % [encounter.encounter_id, enemy_id])


func _validate_level_references(errors: PackedStringArray) -> void:
	for level: LevelDefinition in level_definitions:
		if level == null:
			continue
		for encounter_id: String in level.encounter_ids:
			if not _encounter_by_id.has(StringName(encounter_id)):
				errors.append("Level '%s' references unknown encounter '%s'." % [level.level_id, encounter_id])
		if level.unlock_requirements == null:
			continue
		for prerequisite_id: String in level.unlock_requirements.prerequisite_level_ids:
			var prerequisite := find_level(StringName(prerequisite_id))
			if prerequisite == null:
				errors.append("Level '%s' references unknown prerequisite level '%s'." % [level.level_id, prerequisite_id])
			elif level.is_campaign_level() and not prerequisite.is_campaign_level():
				errors.append("Campaign level '%s' cannot depend on SANDBOX level '%s'." % [level.level_id, prerequisite_id])
			elif level.is_campaign_level() and prerequisite.is_campaign_level() and prerequisite.campaign_slot >= level.campaign_slot:
				errors.append("Campaign level '%s' prerequisite '%s' must use an earlier campaign slot." % [level.level_id, prerequisite_id])

		if level.is_campaign_ready() and level.campaign_slot > 1:
			var previous := find_campaign_level(level.campaign_slot - 1)
			if previous == null:
				errors.append("Campaign-ready level '%s' requires authored slot %d before it." % [level.level_id, level.campaign_slot - 1])
			elif not level.unlock_requirements.prerequisite_level_ids.has(String(previous.level_id)):
				errors.append("Campaign-ready level '%s' must directly require previous level '%s'." % [level.level_id, previous.level_id])

		var available_encounters := _encounters_from_prerequisite_levels(level)
		var available_features := _features_from_prerequisite_levels(level)
		for initial_feature: String in initial_feature_ids:
			available_features[StringName(initial_feature)] = true
		for required_feature: String in level.unlock_requirements.required_feature_ids:
			if not available_features.has(StringName(required_feature)):
				errors.append("Level '%s' requires unavailable feature '%s'; grant it from an initial feature or prerequisite level." % [level.level_id, required_feature])

		for encounter_id: String in level.encounter_ids:
			var encounter := find_encounter(StringName(encounter_id))
			if encounter == null:
				continue
			if level.is_campaign_ready() and encounter.development_only:
				errors.append("Campaign-ready level '%s' cannot use development-only encounter '%s'." % [level.level_id, encounter.encounter_id])
			for prerequisite_encounter: String in encounter.prerequisite_encounter_ids:
				if not available_encounters.has(StringName(prerequisite_encounter)):
					errors.append("Level '%s' schedules encounter '%s' before prerequisite encounter '%s'." % [level.level_id, encounter.encounter_id, prerequisite_encounter])
			for required_feature: String in encounter.required_feature_ids:
				if not available_features.has(StringName(required_feature)):
					errors.append("Level '%s' encounter '%s' requires unavailable feature '%s'." % [level.level_id, encounter.encounter_id, required_feature])
			available_encounters[encounter.encounter_id] = true
			if encounter.completion != null:
				for granted_feature: String in encounter.completion.granted_feature_ids:
					if not level.granted_feature_ids.has(granted_feature):
						errors.append("Level '%s' must declare encounter-granted feature '%s' in granted_feature_ids." % [level.level_id, granted_feature])
					available_features[StringName(granted_feature)] = true


func _validate_roster_references(errors: PackedStringArray) -> void:
	for roster: LevelRosterDefinition in roster_definitions:
		if roster == null:
			continue
		for entry: LevelRosterEntry in roster.entries:
			if entry == null or entry.combatant_kind != LevelRosterEntry.CombatantKind.ENEMY:
				continue
			if not _enemy_by_id.has(entry.combatant_id):
				errors.append("Roster '%s' references unknown enemy '%s'." % [roster.roster_id, entry.combatant_id])


func _validate_dependency_cycles(errors: PackedStringArray) -> void:
	var encounter_state := {}
	for encounter_id: StringName in _encounter_by_id:
		_visit_encounter_dependency(encounter_id, encounter_state, errors)
	var level_state := {}
	for level_id: StringName in _level_by_id:
		_visit_level_dependency(level_id, level_state, errors)


func _visit_encounter_dependency(
		encounter_id: StringName,
		state: Dictionary,
		errors: PackedStringArray
) -> void:
	var current_state := int(state.get(encounter_id, 0))
	if current_state == 2:
		return
	if current_state == 1:
		errors.append("Encounter dependency cycle includes '%s'." % encounter_id)
		return
	state[encounter_id] = 1
	var encounter := find_encounter(encounter_id)
	if encounter != null:
		for prerequisite_id: String in encounter.prerequisite_encounter_ids:
			if _encounter_by_id.has(StringName(prerequisite_id)):
				_visit_encounter_dependency(StringName(prerequisite_id), state, errors)
	state[encounter_id] = 2


func _visit_level_dependency(
		level_id: StringName,
		state: Dictionary,
		errors: PackedStringArray
) -> void:
	var current_state := int(state.get(level_id, 0))
	if current_state == 2:
		return
	if current_state == 1:
		errors.append("Level dependency cycle includes '%s'." % level_id)
		return
	state[level_id] = 1
	var level := find_level(level_id)
	if level != null and level.unlock_requirements != null:
		for prerequisite_id: String in level.unlock_requirements.prerequisite_level_ids:
			if _level_by_id.has(StringName(prerequisite_id)):
				_visit_level_dependency(StringName(prerequisite_id), state, errors)
	state[level_id] = 2


func _validate_transaction_ids(errors: PackedStringArray) -> void:
	var owners := {}
	for encounter: EncounterDefinition in encounter_definitions:
		if encounter == null or encounter.completion == null or encounter.completion.reward_transaction_id.is_empty():
			continue
		_register_transaction(errors, owners, encounter.completion.reward_transaction_id, "encounter '%s'" % encounter.encounter_id)
	for level: LevelDefinition in level_definitions:
		if level == null or level.completion_transaction_id.is_empty():
			continue
		_register_transaction(errors, owners, level.completion_transaction_id, "level '%s'" % level.level_id)


func _register_transaction(
		errors: PackedStringArray,
		owners: Dictionary,
		transaction_id: StringName,
		owner: String
) -> void:
	if owners.has(transaction_id):
		errors.append("Reward transaction ID '%s' is shared by %s and %s." % [transaction_id, owners[transaction_id], owner])
	else:
		owners[transaction_id] = owner


func _validate_feature_grants(errors: PackedStringArray) -> void:
	var grant_owners := {}
	for feature_id: String in initial_feature_ids:
		grant_owners[StringName(feature_id)] = "initial features"
	for level: LevelDefinition in level_definitions:
		if level == null:
			continue
		for feature_id: String in level.granted_feature_ids:
			var key := StringName(feature_id)
			if grant_owners.has(key) and grant_owners[key] != "level '%s'" % level.level_id:
				errors.append("Feature '%s' has multiple grant owners: %s and level '%s'." % [key, grant_owners[key], level.level_id])
			else:
				grant_owners[key] = "level '%s'" % level.level_id
	for encounter: EncounterDefinition in encounter_definitions:
		if encounter == null:
			continue
		for feature_id: String in encounter.required_feature_ids:
			if not grant_owners.has(StringName(feature_id)):
				errors.append("Encounter '%s' requires feature '%s' that has no initial or level grant owner." % [encounter.encounter_id, feature_id])


func _features_from_prerequisite_levels(level: LevelDefinition) -> Dictionary:
	var prerequisite_ids := {}
	_collect_prerequisite_level_ids(level, prerequisite_ids)
	var result := {}
	for prerequisite_id: StringName in prerequisite_ids:
		var prerequisite := find_level(prerequisite_id)
		if prerequisite == null:
			continue
		for feature_id: String in prerequisite.granted_feature_ids:
			result[StringName(feature_id)] = true
	return result


func _encounters_from_prerequisite_levels(level: LevelDefinition) -> Dictionary:
	var prerequisite_ids := {}
	_collect_prerequisite_level_ids(level, prerequisite_ids)
	var result := {}
	for prerequisite_id: StringName in prerequisite_ids:
		var prerequisite := find_level(prerequisite_id)
		if prerequisite == null:
			continue
		for encounter_id: String in prerequisite.encounter_ids:
			result[StringName(encounter_id)] = true
	return result


func _collect_prerequisite_level_ids(level: LevelDefinition, result: Dictionary) -> void:
	if level == null or level.unlock_requirements == null:
		return
	for prerequisite_id: String in level.unlock_requirements.prerequisite_level_ids:
		var key := StringName(prerequisite_id)
		if result.has(key):
			continue
		result[key] = true
		_collect_prerequisite_level_ids(find_level(key), result)


func _enemy_ids_used_by(encounter: EncounterDefinition) -> Array[StringName]:
	var seen := {}
	var result: Array[StringName] = []
	for wave: EncounterWaveDefinition in encounter.waves:
		if wave == null:
			continue
		for group: EncounterGroupDefinition in wave.groups:
			if group == null:
				continue
			for entry: EncounterSpawnEntry in group.spawn_entries:
				if entry != null and not seen.has(entry.enemy_id):
					seen[entry.enemy_id] = true
					result.append(entry.enemy_id)
	return result
