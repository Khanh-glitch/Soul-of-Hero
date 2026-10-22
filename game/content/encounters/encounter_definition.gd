@tool
class_name EncounterDefinition
extends Resource

## Complete encounter authoring contract.
##
## waves and each wave's groups are ordered arrays. Warnings and objectives use
## stable IDs, while completion describes gates, rewards, unlocks, and chaining.

@export_category("Identity")
@export var encounter_id: StringName
@export var display_name: String
@export var encounter_tags: PackedStringArray
@export var development_only := false
@export_multiline var authoring_notes: String

@export_category("Dependencies")
@export var prerequisite_encounter_ids: PackedStringArray
@export var required_feature_ids: PackedStringArray

@export_category("Ordered content")
@export var waves: Array[EncounterWaveDefinition] = []
@export var warnings: Array[EncounterWarningDefinition] = []
@export var objectives: Array[EncounterObjectiveDefinition] = []
@export var completion: EncounterCompletionContract


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, encounter_id, "Encounter ID")
	if display_name.strip_edges().is_empty():
		errors.append("Encounter display name is required.")
	ContentId.append_duplicate_or_invalid_ids(errors, encounter_tags, "Encounter tags")
	ContentId.append_duplicate_or_invalid_ids(errors, prerequisite_encounter_ids, "Encounter prerequisite IDs")
	ContentId.append_duplicate_or_invalid_ids(errors, required_feature_ids, "Encounter required feature IDs")
	if prerequisite_encounter_ids.has(String(encounter_id)):
		errors.append("Encounter cannot depend on itself.")
	if waves.is_empty():
		errors.append("Encounter must contain at least one ordered wave.")
	if objectives.is_empty():
		errors.append("Encounter must contain at least one objective.")

	var wave_ids := {}
	var group_ids := {}
	for wave_index: int in waves.size():
		var wave := waves[wave_index]
		if wave == null:
			errors.append("Encounter waves[%d] cannot be null." % wave_index)
			continue
		for child_error: String in wave.get_validation_errors():
			errors.append("waves[%d]: %s" % [wave_index, child_error])
		if wave_ids.has(wave.wave_id):
			errors.append("Encounter contains duplicate wave ID '%s'." % wave.wave_id)
		else:
			wave_ids[wave.wave_id] = true
		for group: EncounterGroupDefinition in wave.groups:
			if group == null:
				continue
			if group_ids.has(group.group_id):
				errors.append("Encounter group ID '%s' must be unique across all waves." % group.group_id)
			else:
				group_ids[group.group_id] = true

	var objective_ids := {}
	for objective_index: int in objectives.size():
		var objective := objectives[objective_index]
		if objective == null:
			errors.append("Encounter objectives[%d] cannot be null." % objective_index)
			continue
		for child_error: String in objective.get_validation_errors():
			errors.append("objectives[%d]: %s" % [objective_index, child_error])
		if objective_ids.has(objective.objective_id):
			errors.append("Encounter contains duplicate objective ID '%s'." % objective.objective_id)
		else:
			objective_ids[objective.objective_id] = true

	var warning_ids := {}
	for warning_index: int in warnings.size():
		var warning := warnings[warning_index]
		if warning == null:
			errors.append("Encounter warnings[%d] cannot be null." % warning_index)
			continue
		for child_error: String in warning.get_validation_errors():
			errors.append("warnings[%d]: %s" % [warning_index, child_error])
		if warning_ids.has(warning.warning_id):
			errors.append("Encounter contains duplicate warning ID '%s'." % warning.warning_id)
		else:
			warning_ids[warning.warning_id] = true
		match warning.scope:
			EncounterWarningDefinition.Scope.WAVE:
				if not wave_ids.has(warning.target_id):
					errors.append("Warning '%s' references unknown wave '%s'." % [warning.warning_id, warning.target_id])
			EncounterWarningDefinition.Scope.GROUP:
				if not group_ids.has(warning.target_id):
					errors.append("Warning '%s' references unknown group '%s'." % [warning.warning_id, warning.target_id])
			EncounterWarningDefinition.Scope.OBJECTIVE:
				if not objective_ids.has(warning.target_id):
					errors.append("Warning '%s' references unknown objective '%s'." % [warning.warning_id, warning.target_id])

	if completion == null:
		errors.append("Encounter completion contract is required.")
	else:
		for child_error: String in completion.get_validation_errors():
			errors.append("completion: %s" % child_error)
		for objective_id: String in completion.required_objective_ids:
			if not objective_ids.has(StringName(objective_id)):
				errors.append("Completion references unknown objective '%s'." % objective_id)
	return errors


func get_wave(wave_id: StringName) -> EncounterWaveDefinition:
	for wave: EncounterWaveDefinition in waves:
		if wave != null and wave.wave_id == wave_id:
			return wave
	return null


func get_group(group_id: StringName) -> EncounterGroupDefinition:
	for wave: EncounterWaveDefinition in waves:
		if wave == null:
			continue
		for group: EncounterGroupDefinition in wave.groups:
			if group != null and group.group_id == group_id:
				return group
	return null
