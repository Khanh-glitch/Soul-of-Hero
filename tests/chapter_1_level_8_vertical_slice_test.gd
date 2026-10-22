extends SceneTree

const MAP_PATH := "res://data/levels/chapter_1_level_8.json"
const REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const REWARDS: RewardBundleRegistry = preload("res://data/content/rewards/campaign_reward_registry.tres")
const RUNTIME_STATE := preload("res://game/content/encounters/encounter_runtime_state.gd")
const SCHEMA := preload("res://game/levels/level_schema.gd")
const ELITE_MODIFIER = preload("res://data/content/elite_modifiers/triple_stat_elite.tres")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var document := _load_json(MAP_PATH)
	_expect(not document.is_empty(), "Level 8 dedicated map loads")
	if document.is_empty():
		_finish()
		return
	var validation: Dictionary = SCHEMA.validate_level(document)
	_expect(bool(validation.get("ok", false)), "Level 8 map satisfies the common runtime schema: %s" % validation.get("error", ""))
	var metadata := document.get("metadata", {}) as Dictionary
	_expect(String(metadata.get("layout_profile", "")) == "divided_reliquary_exclusive_branch", "Level 8 uses its dedicated divided Reliquary layout")
	_expect(int(metadata.get("selected_branch_elite_count", 0)) == 1 and (metadata.get("elite_combat_axes", {}) as Dictionary) == ELITE_MODIFIER.get_combat_axes(), "Map declares one selected-branch Elite with the complete authored pressure axes")
	_expect((metadata.get("reaper_enemy_ids", []) as Array).size() == 6 and (metadata.get("vampire_enemy_ids", []) as Array).size() == 3, "Map declares exact 6-Reaper and 3-Vampire alternatives")
	_expect((metadata.get("branch_enemy_ids", []) as Array).size() == 9, "All nine branch markers are explicitly deferred")

	var entities := document.get("entities", []) as Array
	var by_id := {}
	var by_type := {}
	for value: Variant in entities:
		if not value is Dictionary:
			continue
		var entity := value as Dictionary
		by_id[String(entity.get("id", ""))] = entity
		var type := String(entity.get("type", ""))
		var typed: Array = by_type.get(type, [])
		typed.append(entity)
		by_type[type] = typed
	_expect((by_type.get("player", []) as Array).size() == 1, "Level 8 has one player spawn")
	_expect((by_type.get("reliquary_branch_seal", []) as Array).size() == 2, "Level 8 has two physical branch seals")
	_expect((by_type.get("skeleton_reaper", []) as Array).size() == 7, "Level 8 authors six Reaper alternatives plus one non-objective pack anchor")
	_expect((by_type.get("vampire", []) as Array).size() == 4, "Level 8 authors three Vampire alternatives plus one non-objective pack anchor")
	_expect((by_type.get("chest", []) as Array).size() == 1 and bool((by_id.get("l8_elite_chest", {}) as Dictionary).get("contains_sigil", false)), "One real Elite chest owns the exit sigil")
	_expect((by_type.get("exit_gate", []) as Array).size() == 1, "Level 8 has one encounter-controlled exit")
	for required_id: String in ["l8_reaper_seal", "l8_vampire_seal", "l8_elite_chest", "l8_exit", "l8_checkpoint"]:
		_expect(by_id.has(required_id), "%s has a stable authored marker" % required_id)

	var reachable := _reachable_floor_cells(document, _entity_cell(by_id.get("l8_player_spawn", {})))
	for required_id: String in ["l8_reaper_seal", "l8_vampire_seal", "l8_elite_chest", "l8_exit"]:
		_expect(reachable.has(_entity_cell(by_id.get(required_id, {}))), "%s is physically reachable from the south approach" % required_id)
	for enemy_id: String in metadata.get("branch_enemy_ids", []):
		_expect(reachable.has(_entity_cell(by_id.get(enemy_id, {}))), "%s stands on reachable combat floor" % enemy_id)

	var level := REGISTRY.find_campaign_level(8)
	_expect(level != null, "Campaign registry resolves Level 8")
	if level == null:
		_finish()
		return
	_expect(level.layout_data_path == MAP_PATH and level.level_scene != null, "Level 8 routes to the shared live scene with its authored map")
	_expect(level.is_campaign_ready(), "Level 8 is CAMPAIGN_READY only behind its vertical-slice gates")
	_expect(level.unlock_requirements.prerequisite_level_ids == PackedStringArray(["chapter_1_level_7"]), "Level 8 requires the promoted Level 7 first clear")
	_expect(level.granted_feature_ids == PackedStringArray(["hero_soul_inventory", "hero_soul_sell"]), "Level 8 atomically grants its declared Hero Soul inventory/sell features")

	var encounter := REGISTRY.find_encounter(level.entry_encounter_id)
	_expect(encounter != null, "Level 8 resolves its Reliquary encounter")
	if encounter == null:
		_finish()
		return
	var encounter_errors := encounter.get_validation_errors()
	_expect(encounter_errors.is_empty(), "Level 8 encounter validates: %s" % "; ".join(encounter_errors))
	_expect(encounter.waves.size() == 1 and encounter.waves[0].groups.size() == 2, "Encounter owns one exclusive choice wave with two authored alternatives")
	var entry_counts := {}
	var all_markers := {}
	for group: EncounterGroupDefinition in encounter.waves[0].groups:
		for entry: EncounterSpawnEntry in group.spawn_entries:
			entry_counts[String(entry.entry_id)] = entry.count
			for marker_id: String in entry.spawn_marker_ids:
				all_markers[marker_id] = true
	_expect(int(entry_counts.get("reaper_branch", 0)) == 6 and int(entry_counts.get("vampire_branch", 0)) == 3, "Encounter retains exact branch compositions")
	_expect(all_markers.size() == 9, "Encounter references nine unique deferred markers")
	_expect(encounter.objectives.size() == 1 and encounter.objectives[0].objective_type == EncounterObjectiveDefinition.ObjectiveType.CUSTOM_EVENT and encounter.objectives[0].target_id == &"elite_chest_claimed", "Only the physical chest opened event completes the encounter")
	_expect(encounter.completion.gate_entity_ids == PackedStringArray(["l8_exit"]), "Reliquary encounter alone controls the north exit")

	var roster: LevelRosterDefinition = REGISTRY.find_campaign_roster(8)
	_expect(roster != null and roster.get_total_count() == 9, "Level 8 roster stores both exact branch alternatives without adding units")
	_expect(roster != null and roster.elite_policy == null, "No random roster roll can add a second Elite")
	var reward: RewardBundleDefinition = REWARDS.find_bundle(level.completion_reward_bundle_id)
	_expect(reward != null and reward.player_level_grant == 1, "Level 8 keeps one atomic player-level first-clear grant")
	var reward_summary := reward.to_summary() if reward != null else {}
	var aux_rewards := reward_summary.get("auxiliary_equipment", []) as Array
	_expect(aux_rewards.size() == 1, "Level 8 has one deterministic unique equipment reward")
	if aux_rewards.size() == 1:
		var epic := aux_rewards[0] as Dictionary
		_expect(String(epic.get("rarity", "")) == "epic" and int(epic.get("item_level", 0)) == 8, "First clear visibly introduces one authored Epic Lv8 item")
		_expect(not bool(epic.get("equip_if_slot_empty", true)), "Epic item asks the player to compare/equip it rather than silently replacing gear")

	for selected_branch: String in ["reaper", "vampire"]:
		var runtime := RUNTIME_STATE.new()
		var runtime_errors: PackedStringArray = runtime.configure(level, REGISTRY, entities)
		_expect(runtime_errors.is_empty(), "%s route configures the canonical encounter runtime" % selected_branch.capitalize())
		_expect(runtime.get_remaining_enemy_count() == 9 and not runtime.is_gate_unlocked(&"l8_exit"), "Before choice all alternatives are authored and the exit is locked")
		var unselected: PackedStringArray = PackedStringArray(metadata.get("vampire_enemy_ids", []) if selected_branch == "reaper" else metadata.get("reaper_enemy_ids", []))
		var selected: Array = metadata.get("reaper_enemy_ids", []) if selected_branch == "reaper" else metadata.get("vampire_enemy_ids", [])
		_expect(runtime.deactivate_tracked_enemies(unselected) == unselected.size(), "%s choice retires every unselected marker without fake defeats" % selected_branch.capitalize())
		_expect(runtime.get_remaining_enemy_count() == selected.size(), "Live encounter total becomes exactly the selected %s count" % selected_branch)
		for marker_id: String in selected:
			runtime.mark_enemy_defeated(StringName(marker_id))
		_expect(not runtime.is_gate_unlocked(&"l8_exit"), "Selected branch clear cannot bypass the required chest interaction")
		_expect(runtime.record_custom_event(&"elite_chest_claimed"), "Physical chest event is accepted for the %s route" % selected_branch)
		_expect(runtime.is_complete() and runtime.is_gate_unlocked(&"l8_exit"), "Claiming the chest opens the exit after the %s branch" % selected_branch)

	_finish()


func _reachable_floor_cells(document: Dictionary, start: Vector2i) -> Dictionary:
	var floor_cells := {}
	for raw_cell: Variant in (document.get("layers", {}) as Dictionary).get("Backdrop", []):
		if raw_cell is Dictionary:
			floor_cells[Vector2i(int(raw_cell.get("x", -1)), int(raw_cell.get("y", -1)))] = true
	var reachable := {}
	if not floor_cells.has(start):
		return reachable
	var queue: Array[Vector2i] = [start]
	reachable[start] = true
	var index := 0
	while index < queue.size():
		var current := queue[index]
		index += 1
		for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var next := current + direction
			if floor_cells.has(next) and not reachable.has(next):
				reachable[next] = true
				queue.append(next)
	return reachable


func _entity_cell(value: Variant) -> Vector2i:
	if not value is Dictionary:
		return Vector2i(-1, -1)
	var position: Array = value.get("position", [])
	return Vector2i(floori(float(position[0]) / 16.0), floori(float(position[1]) / 16.0)) if position.size() >= 2 else Vector2i(-1, -1)


func _load_json(path: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed if parsed is Dictionary else {}


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("LEVEL 8 VERTICAL SLICE FAIL: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 8 VERTICAL SLICE PASSED - %d checks" % _checks)
		quit(0)
		return
	print("CHAPTER 1 LEVEL 8 VERTICAL SLICE FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
