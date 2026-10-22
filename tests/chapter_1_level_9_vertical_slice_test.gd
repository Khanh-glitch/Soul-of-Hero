extends SceneTree

const MAP_PATH := "res://data/levels/chapter_1_level_9.json"
const REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const REWARDS: RewardBundleRegistry = preload("res://data/content/rewards/campaign_reward_registry.tres")
const RUNTIME_STATE := preload("res://game/content/encounters/encounter_runtime_state.gd")
const SCHEMA := preload("res://game/levels/level_schema.gd")
const SOUL_COMBAT := preload("res://game/meta/hero_souls/hero_soul_combat_affixes.gd")
const ELITE_MODIFIER = preload("res://data/content/elite_modifiers/crimson_reaper_elite.tres")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var document := _load_json(MAP_PATH)
	_expect(not document.is_empty(), "Level 9 dedicated map loads")
	if document.is_empty():
		_finish()
		return
	var validation: Dictionary = SCHEMA.validate_level(document)
	_expect(bool(validation.get("ok", false)), "Level 9 map satisfies common runtime schema: %s" % validation.get("error", ""))
	var metadata := document.get("metadata", {}) as Dictionary
	_expect(String(metadata.get("layout_profile", "")) == "crimson_gate_three_seal_hunt", "Level 9 owns its dedicated three-wing Crimson Gate layout")
	_expect((metadata.get("gate_seal_ids", []) as Array).size() == 3, "Map declares exactly three Gate Seal IDs")
	_expect(String(metadata.get("crimson_reaper_id", "")) == "l9_crimson_reaper", "Map declares one stable Crimson Reaper marker")
	_expect(int(metadata.get("named_elite_count", 0)) == 1 and (metadata.get("elite_combat_axes", {}) as Dictionary) == ELITE_MODIFIER.get_combat_axes(), "Map declares one named Elite with the complete authored pressure axes")
	_expect(int(metadata.get("required_sigils", 0)) == 3, "The three physical seals are the exact portal sigil requirement")

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
	_expect((by_type.get("player", []) as Array).size() == 1, "Level 9 has one player spawn")
	_expect((by_type.get("gate_seal", []) as Array).size() == 3, "Level 9 has exactly three physical GateSeal entities")
	_expect((by_type.get("crimson_reaper", []) as Array).size() == 1, "Level 9 has exactly one dedicated Crimson Reaper entity marker")
	_expect((by_type.get("skeleton_reaper", []) as Array).size() == 1 and by_id.has("l9_approach_reaper"), "Level 9 uses one explicit non-objective Bone Reaper pack anchor, never a proxy for the named boss")
	_expect((by_type.get("exit_gate", []) as Array).size() == 1, "Level 9 has one canonical encounter-controlled exit")
	for required_id: String in ["l9_west_gate_seal", "l9_east_gate_seal", "l9_north_gate_seal", "l9_crimson_reaper", "l9_exit", "l9_checkpoint"]:
		_expect(by_id.has(required_id), "%s has a stable authored marker" % required_id)

	var reachable := _reachable_floor_cells(document, _entity_cell(by_id.get("l9_player_spawn", {})))
	for required_id: String in ["l9_west_gate_seal", "l9_east_gate_seal", "l9_north_gate_seal", "l9_crimson_reaper", "l9_exit"]:
		_expect(reachable.has(_entity_cell(by_id.get(required_id, {}))), "%s is physically reachable from the entry checkpoint" % required_id)

	var level := REGISTRY.find_campaign_level(9)
	_expect(level != null, "Campaign registry resolves Level 9")
	if level == null:
		_finish()
		return
	_expect(level.layout_data_path == MAP_PATH and level.level_scene != null, "Level 9 routes to the live scene with its authored map")
	_expect(level.is_campaign_ready(), "Level 9 is CAMPAIGN_READY only behind its complete vertical-slice gates")
	_expect(level.unlock_requirements.prerequisite_level_ids == PackedStringArray(["chapter_1_level_8"]), "Level 9 requires the promoted Level 8 first clear")
	_expect(level.granted_feature_ids == PackedStringArray(["chapter_1_boss_gate"]), "Level 9 atomically grants the boss-gate feature")

	var enemy := REGISTRY.find_enemy(&"crimson_reaper")
	_expect(enemy != null and enemy.display_name == "Crimson Reaper" and not enemy.development_only, "Crimson Reaper is a production EnemyDefinition, not a proxy")
	_expect(enemy != null and enemy.base_scene != null and enemy.base_scene.resource_path.ends_with("crimson_reaper_enemy.tscn"), "Crimson Reaper owns a dedicated runtime scene")
	var roster := REGISTRY.find_campaign_roster(9)
	_expect(roster != null and roster.get_total_count() == 1 and roster.authoring_status == LevelRosterDefinition.AuthoringStatus.RUNTIME_READY, "Level 9 runtime-ready roster contains exactly one combatant")
	if roster != null and roster.entries.size() == 1:
		var roster_entry := roster.entries[0]
		_expect(roster_entry.combatant_id == &"crimson_reaper" and roster_entry.unique and roster_entry.miniboss, "Roster names one unique Crimson Reaper miniboss without random Elite eligibility")

	var encounter := REGISTRY.find_encounter(level.entry_encounter_id)
	_expect(encounter != null, "Level 9 resolves its Crimson Gate encounter")
	if encounter == null:
		_finish()
		return
	var encounter_errors := encounter.get_validation_errors()
	_expect(encounter_errors.is_empty(), "Level 9 encounter validates: %s" % "; ".join(encounter_errors))
	_expect(encounter.waves.size() == 1 and encounter.waves[0].groups.size() == 1, "Encounter owns exactly one named-Elite group")
	var boss_entry := encounter.waves[0].groups[0].spawn_entries[0]
	_expect(boss_entry.enemy_id == &"crimson_reaper" and boss_entry.spawn_marker_ids == PackedStringArray(["l9_crimson_reaper"]), "Encounter binds the dedicated identity to the exact deferred marker")
	_expect(encounter.objectives.size() == 2, "Encounter requires two independent objective authorities")
	var objectives := {}
	for objective: EncounterObjectiveDefinition in encounter.objectives:
		objectives[String(objective.objective_id)] = objective
	var seals := objectives.get("collect_three_gate_seals") as EncounterObjectiveDefinition
	var boss := objectives.get("defeat_crimson_reaper") as EncounterObjectiveDefinition
	_expect(seals != null and seals.objective_type == EncounterObjectiveDefinition.ObjectiveType.CUSTOM_EVENT and seals.target_id == &"gate_seal_collected" and seals.target_count == 3, "Exactly three physical seal events are mandatory")
	_expect(boss != null and boss.objective_type == EncounterObjectiveDefinition.ObjectiveType.DEFEAT_COUNT and boss.target_id == &"crimson_reaper" and boss.target_count == 1, "The dedicated Crimson Reaper death is mandatory")
	_expect(encounter.completion.required_objective_ids == PackedStringArray(["collect_three_gate_seals", "defeat_crimson_reaper"]), "Exit completion requires both seals and boss")
	_expect(encounter.completion.gate_entity_ids == PackedStringArray(["l9_exit"]), "The encounter alone controls the north exit")

	var runtime := RUNTIME_STATE.new()
	var runtime_errors: PackedStringArray = runtime.configure(level, REGISTRY, entities)
	_expect(runtime_errors.is_empty(), "Level 9 configures canonical encounter authority")
	_expect(runtime.get_remaining_enemy_count() == 1 and not runtime.is_gate_unlocked(&"l9_exit"), "Exit starts locked with one authoritative named enemy")
	for seal_index: int in 2:
		_expect(runtime.record_custom_event(&"gate_seal_collected"), "Physical seal event %d is accepted" % [seal_index + 1])
	_expect(not runtime.is_gate_unlocked(&"l9_exit"), "Two seals cannot awaken/complete the gate")
	_expect(runtime.record_custom_event(&"gate_seal_collected"), "Third physical seal event is accepted")
	_expect(not runtime.is_gate_unlocked(&"l9_exit"), "All seals without the Crimson Reaper death cannot open the exit")
	_expect(runtime.mark_enemy_defeated(&"l9_crimson_reaper"), "Exact named marker death is accepted")
	_expect(runtime.is_complete() and runtime.is_gate_unlocked(&"l9_exit"), "Three seals plus named-Elite death open the exit")
	_expect(not runtime.mark_enemy_defeated(&"l9_crimson_reaper"), "Repeated boss death cannot advance the objective twice")

	var reward := REWARDS.find_bundle(level.completion_reward_bundle_id)
	_expect(reward != null and reward.player_level_grant == 1, "Level 9 grants exactly one atomic Player Level")
	var summary := reward.to_summary() if reward != null else {}
	var soul_rewards := summary.get("hero_souls", []) as Array
	_expect(soul_rewards.size() == 1, "Level 9 first clear grants exactly one deterministic Hero Soul")
	if soul_rewards.size() == 1:
		var soul := soul_rewards[0] as Dictionary
		_expect(String(soul.get("hero_id", "")) == "sword_hero", "Reward is a useful duplicate of the starter Sword identity")
		_expect(String(soul.get("rarity_name", "")) == "Rare" and int(soul.get("item_level", 0)) == 9, "Reward is visibly Rare Lv9")
		_expect(not String(soul.get("instance_id", "")).is_empty(), "Reward has one deterministic persistence ID")
		var affixes := soul.get("affixes", []) as Array
		_expect(affixes.size() == 2, "Rare Sword reward rolls exactly two affixes")
		var all_affixes_live := true
		var affix_ids: Array[String] = []
		for raw_affix: Variant in affixes:
			var affix := raw_affix as Dictionary if raw_affix is Dictionary else {}
			var affix_id := String(affix.get("affix_id", ""))
			affix_ids.append(affix_id)
			all_affixes_live = all_affixes_live and SOUL_COMBAT.is_live_affix(affix_id) and float(affix.get("value", 0.0)) > 0.0
		_expect(all_affixes_live, "Both deterministic Rare affixes are positive LIVE combat effects: %s" % ", ".join(affix_ids))
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
	push_error("LEVEL 9 VERTICAL SLICE FAIL: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 9 VERTICAL SLICE PASSED - %d checks" % _checks)
		quit(0)
		return
	print("CHAPTER 1 LEVEL 9 VERTICAL SLICE FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
