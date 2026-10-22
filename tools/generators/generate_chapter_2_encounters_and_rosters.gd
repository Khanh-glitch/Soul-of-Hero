extends SceneTree

## Generates the runtime-facing Chapter 2 encounter and roster resources from
## the authored map markers. Keeping these two data views generated from the
## same map source prevents a marker rename from silently making a route
## impossible to complete.

const EncounterDefinitionScript := preload("res://game/content/encounters/encounter_definition.gd")
const EncounterSpawnEntryScript := preload("res://game/content/encounters/encounter_spawn_entry.gd")
const EncounterGroupDefinitionScript := preload("res://game/content/encounters/encounter_group_definition.gd")
const EncounterWaveDefinitionScript := preload("res://game/content/encounters/encounter_wave_definition.gd")
const EncounterObjectiveDefinitionScript := preload("res://game/content/encounters/encounter_objective_definition.gd")
const EncounterCompletionContractScript := preload("res://game/content/encounters/encounter_completion_contract.gd")
const LevelRosterDefinitionScript := preload("res://game/content/rosters/level_roster_definition.gd")
const LevelRosterEntryScript := preload("res://game/content/rosters/level_roster_entry.gd")

const ORDERED_ENEMY_IDS := [
	&"coven_wraith",
	&"venom_bound_wraith",
	&"spirit_leech",
	&"hexwing_familiar",
	&"axe_soul_boss",
	&"wizard_hero_boss",
]

const LEVELS: Array[Dictionary] = [
	{"slot": 11, "encounter_id": &"chapter_2_level_11_gatefall", "name": "Gatefall Recovery"},
	{"slot": 12, "encounter_id": &"chapter_2_level_12_ash_venom", "name": "Ash Venom Purification"},
	{"slot": 13, "encounter_id": &"chapter_2_level_13_lanternwood", "name": "Lanternwood Escort"},
	{"slot": 14, "encounter_id": &"chapter_2_level_14_alchemist_village", "name": "Alchemist Village Overload"},
	{"slot": 15, "encounter_id": &"chapter_2_level_15_axe_pactbreaker", "name": "Axe Pactbreaker"},
	{"slot": 16, "encounter_id": &"chapter_2_level_16_cursed_gate_maze", "name": "Cursed Gate Maze"},
	{"slot": 17, "encounter_id": &"chapter_2_level_17_firekeeping_rite", "name": "Firekeeping Rite"},
	{"slot": 18, "encounter_id": &"chapter_2_level_18_breathing_relic", "name": "Breathing Relic"},
	{"slot": 19, "encounter_id": &"chapter_2_level_19_familiar_sabbath", "name": "Familiar Sabbath"},
	{"slot": 20, "encounter_id": &"chapter_2_level_20_wizard_foundry_heart", "name": "Wizard Foundry Heart"},
]


func _init() -> void:
	for config: Dictionary in LEVELS:
		var slot := int(config.get("slot", 0))
		var map_data := _load_map(slot)
		if map_data.is_empty():
			quit(1)
			return
		var markers_by_enemy := _collect_enemy_markers(map_data)
		if markers_by_enemy.is_empty():
			push_error("Chapter 2 level %d has no directed enemy markers." % slot)
			quit(1)
			return
		if not _save_encounter(config, markers_by_enemy):
			quit(1)
			return
		if not _save_roster(slot, markers_by_enemy):
			quit(1)
			return
		print("Generated Chapter 2 encounter and roster for level %d." % slot)
	quit(0)


func _load_map(slot: int) -> Dictionary:
	var path := "res://data/levels/chapter_2_level_%d.json" % slot
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("Cannot open %s" % path)
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not parsed is Dictionary:
		push_error("Map %s did not parse as an object." % path)
		return {}
	return parsed as Dictionary


func _collect_enemy_markers(map_data: Dictionary) -> Dictionary:
	var result := {}
	for value: Variant in map_data.get("entities", []):
		if not value is Dictionary:
			continue
		var entity: Dictionary = value
		if not bool(entity.get("chapter_2_directed", false)):
			continue
		var enemy_id := StringName(entity.get("type", ""))
		if not ORDERED_ENEMY_IDS.has(enemy_id):
			continue
		var marker_id := String(entity.get("id", "")).strip_edges()
		if marker_id.is_empty():
			continue
		var markers: PackedStringArray = result.get(enemy_id, PackedStringArray())
		markers.append(marker_id)
		result[enemy_id] = markers
	return result


func _save_encounter(config: Dictionary, markers_by_enemy: Dictionary) -> bool:
	var slot := int(config.get("slot", 0))
	var encounter_id := StringName(config.get("encounter_id", ""))
	var encounter := EncounterDefinitionScript.new()
	encounter.encounter_id = encounter_id
	encounter.display_name = "Chapter 2 — %s" % String(config.get("name", ""))
	encounter.encounter_tags = PackedStringArray(["campaign", "chapter_2", "coven_foundry"])
	encounter.authoring_notes = "Generated from the Chapter 2 map markers. Deferred marker IDs remain the stable encounter authority."

	var groups: Array[EncounterGroupDefinition] = []
	for enemy_id: StringName in ORDERED_ENEMY_IDS:
		var markers: PackedStringArray = markers_by_enemy.get(enemy_id, PackedStringArray())
		if markers.is_empty():
			continue
		var entry := EncounterSpawnEntryScript.new()
		entry.entry_id = enemy_id
		entry.enemy_id = enemy_id
		entry.count = markers.size()
		entry.spawn_marker_ids = markers
		entry.formation_id = &"chapter_2_directed"
		entry.maximum_alive = 0

		var group := EncounterGroupDefinitionScript.new()
		group.group_id = StringName("%s_group" % enemy_id)
		var spawn_entries: Array[EncounterSpawnEntry] = [entry]
		group.spawn_entries = spawn_entries
		groups.append(group)
	var wave := EncounterWaveDefinitionScript.new()
	wave.wave_id = &"directed_foundry_route"
	wave.groups = groups
	var waves: Array[EncounterWaveDefinition] = [wave]
	encounter.waves = waves

	var defeat_all := EncounterObjectiveDefinitionScript.new()
	defeat_all.objective_id = &"clear_foundry_route"
	defeat_all.objective_type = EncounterObjectiveDefinitionScript.ObjectiveType.DEFEAT_ALL
	defeat_all.description_key = "objective.chapter_2.clear_foundry_route"
	var objectives: Array[EncounterObjectiveDefinition] = [defeat_all]
	var required_objectives := PackedStringArray(["clear_foundry_route"])
	var event_id := _custom_event_for_slot(slot)
	if not event_id.is_empty():
		var branch_objective := EncounterObjectiveDefinitionScript.new()
		branch_objective.objective_id = event_id
		branch_objective.objective_type = EncounterObjectiveDefinitionScript.ObjectiveType.CUSTOM_EVENT
		branch_objective.description_key = "objective.chapter_2.%s" % event_id
		branch_objective.target_id = event_id
		branch_objective.target_count = 1
		objectives.append(branch_objective)
		required_objectives.append(String(event_id))
	encounter.objectives = objectives

	var completion := EncounterCompletionContractScript.new()
	completion.required_objective_ids = required_objectives
	completion.gate_action = EncounterCompletionContractScript.GateAction.OPEN
	completion.gate_entity_ids = PackedStringArray(["l%d_exit" % slot])
	encounter.completion = completion

	var errors: PackedStringArray = encounter.get_validation_errors()
	if not errors.is_empty():
		push_error("Invalid Chapter 2 encounter %s: %s" % [encounter_id, "; ".join(errors)])
		return false
	var path := "res://data/content/encounters/chapter_2_level_%d_%s.tres" % [slot, _encounter_file_suffix(encounter_id)]
	var save_error := ResourceSaver.save(encounter, path)
	if save_error != OK:
		push_error("Could not save %s (error %d)." % [path, save_error])
		return false
	return true


func _save_roster(slot: int, markers_by_enemy: Dictionary) -> bool:
	var roster := LevelRosterDefinitionScript.new()
	roster.roster_id = StringName("chapter_2_level_%d_roster" % slot)
	roster.campaign_slot = slot
	roster.authoring_status = LevelRosterDefinitionScript.AuthoringStatus.RUNTIME_READY
	roster.authoring_notes = "Runtime-ready Chapter 2 roster generated from deterministic directed markers."
	var entries: Array[LevelRosterEntry] = []
	for enemy_id: StringName in ORDERED_ENEMY_IDS:
		var markers: PackedStringArray = markers_by_enemy.get(enemy_id, PackedStringArray())
		if markers.is_empty():
			continue
		var entry := LevelRosterEntryScript.new()
		entry.entry_id = enemy_id
		entry.combatant_id = enemy_id
		entry.count = markers.size()
		entry.unique = enemy_id in [&"hexwing_familiar", &"axe_soul_boss", &"wizard_hero_boss"]
		entry.miniboss = entry.unique
		entry.elite_eligible = enemy_id == &"coven_wraith" and slot >= 18
		entry.authoring_notes = "%d authored marker(s) in chapter_2_level_%d." % [markers.size(), slot]
		entries.append(entry)
	roster.entries = entries
	var errors: PackedStringArray = roster.get_validation_errors()
	if not errors.is_empty():
		push_error("Invalid Chapter 2 roster %s: %s" % [roster.roster_id, "; ".join(errors)])
		return false
	var path := "res://data/content/rosters/chapter_2_level_%d_roster.tres" % slot
	var save_error := ResourceSaver.save(roster, path)
	if save_error != OK:
		push_error("Could not save %s (error %d)." % [path, save_error])
		return false
	return true


func _custom_event_for_slot(slot: int) -> StringName:
	return {
		15: &"axe_retreated",
		18: &"hexwing_retreated",
		20: &"wizard_hero_soul_collected",
	}.get(slot, StringName())


func _encounter_file_suffix(encounter_id: StringName) -> String:
	var parts := String(encounter_id).split("_", false)
	return "_".join(parts.slice(4))
