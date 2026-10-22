extends SceneTree

const MAP_PATH := "res://data/levels/chapter_1_level_7.json"
const REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const REWARDS: RewardBundleRegistry = preload("res://data/content/rewards/campaign_reward_registry.tres")
const RUNTIME_STATE := preload("res://game/content/encounters/encounter_runtime_state.gd")
const SCHEMA := preload("res://game/levels/level_schema.gd")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var document := _load_json(MAP_PATH)
	_expect(not document.is_empty(), "Level 7 dedicated map loads")
	if document.is_empty():
		_finish()
		return
	var validation: Dictionary = SCHEMA.validate_level(document)
	_expect(bool(validation.get("ok", false)), "Level 7 map satisfies the common runtime schema: %s" % validation.get("error", ""))
	var metadata := document.get("metadata", {}) as Dictionary
	_expect(String(metadata.get("layout_profile", "")) == "open_four_lane_soul_beacon_defense", "Level 7 uses its dedicated four-lane defense layout")
	_expect(int(metadata.get("wave_count", 0)) == 3, "Level 7 map declares three waves")
	_expect(int(metadata.get("authored_swords", 0)) == 12 and int(metadata.get("authored_reapers", 0)) == 4, "Level 7 map declares the 12 Sword + 4 Reaper roster")

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
	_expect((by_type.get("player", []) as Array).size() == 1, "Level 7 has one player spawn")
	_expect((by_type.get("soul_beacon", []) as Array).size() == 1, "Level 7 has one real Soul Beacon entity")
	_expect((by_type.get("skeleton", []) as Array).size() == 12, "Level 7 authors twelve Skeleton Swordsmen")
	_expect((by_type.get("skeleton_reaper", []) as Array).size() == 4, "Level 7 authors four Bone Reapers")
	_expect((by_type.get("checkpoint", []) as Array).size() == 1, "Level 7 has a stable defense checkpoint")
	_expect((by_type.get("exit_gate", []) as Array).size() == 1, "Level 7 has one encounter-controlled exit")
	for required_id: String in ["l7_soul_beacon", "l7_beacon_core", "l7_checkpoint", "l7_exit"]:
		_expect(by_id.has(required_id), "%s has a stable authored marker" % required_id)

	var reachable := _reachable_floor_cells(document, _entity_cell(by_id.get("l7_player_spawn", {})))
	_expect(reachable.has(_entity_cell(by_id.get("l7_soul_beacon", {}))), "Soul Beacon is reachable from the player spawn")
	_expect(reachable.has(_entity_cell(by_id.get("l7_exit", {}))), "North exit is reachable from the player spawn")
	for entity_id: String in by_id:
		var entity: Dictionary = by_id[entity_id]
		if String(entity.get("type", "")) in ["skeleton", "skeleton_reaper"]:
			_expect(reachable.has(_entity_cell(entity)), "%s has an unobstructed floor route into the Beacon arena" % entity_id)

	var level := REGISTRY.find_campaign_level(7)
	_expect(level != null, "Campaign registry resolves Level 7")
	if level == null:
		_finish()
		return
	_expect(level.layout_data_path == MAP_PATH, "Level 7 routes to the dedicated Beacon map")
	_expect(level.is_campaign_ready(), "Level 7 is CAMPAIGN_READY after its focused and fresh-route promotion gates")
	_expect(level.level_scene != null, "Level 7 uses the shared playable top-down scene")
	_expect(level.entry_encounter_id == &"chapter_1_level_7_beacon_defense", "Level 7 routes to the authored Beacon encounter")
	_expect(level.granted_feature_ids.has("soul_jewelry"), "Level 7 declares the Jewelry progression unlock")

	var encounter := REGISTRY.find_encounter(level.entry_encounter_id)
	_expect(encounter != null, "Level 7 resolves its Beacon encounter")
	if encounter == null:
		_finish()
		return
	var encounter_errors := encounter.get_validation_errors()
	_expect(encounter_errors.is_empty(), "Level 7 encounter validates: %s" % "; ".join(encounter_errors))
	_expect(encounter.waves.size() == 3, "Encounter owns exactly three ordered waves")
	var marker_ids := {}
	var sword_count := 0
	var reaper_count := 0
	for wave_index: int in encounter.waves.size():
		var wave: EncounterWaveDefinition = encounter.waves[wave_index]
		_expect(wave.start_delay_seconds > 0.0, "Wave %d has a visible timed warning window" % (wave_index + 1))
		var wave_swords := 0
		var wave_reapers := 0
		for group: EncounterGroupDefinition in wave.groups:
			for entry: EncounterSpawnEntry in group.spawn_entries:
				for marker_id: String in entry.spawn_marker_ids:
					marker_ids[marker_id] = true
				if entry.enemy_id == &"skeleton_swordsman":
					wave_swords += entry.count
					sword_count += entry.count
				elif entry.enemy_id == &"bone_reaper":
					wave_reapers += entry.count
					reaper_count += entry.count
		_expect(wave_swords == 4 and wave_reapers >= 1, "Wave %d is a genuinely mixed Sword/Reaper attack" % (wave_index + 1))
	_expect(sword_count == 12 and reaper_count == 4 and marker_ids.size() == 16, "Encounter totals exactly 12 Swords + 4 Reapers across sixteen unique markers")
	for marker_id: String in marker_ids:
		_expect(by_id.has(marker_id), "Encounter marker %s exists in the live map" % marker_id)
	_expect(encounter.completion.required_objective_ids == PackedStringArray(["clear_all_beacon_waves", "protect_soul_beacon"]), "Completion requires both every enemy death and a surviving Beacon")
	_expect(encounter.completion.gate_entity_ids == PackedStringArray(["l7_exit"]), "Encounter controls the real north exit")

	var roster: LevelRosterDefinition = REGISTRY.find_campaign_roster(7)
	_expect(roster != null and roster.get_total_count() == 16, "Level 7 roster total matches the sixteen encounter markers")
	var reward: RewardBundleDefinition = REWARDS.find_bundle(level.completion_reward_bundle_id)
	_expect(reward != null and reward.player_level_grant == 1, "Level 7 keeps one atomic first-clear player level grant")

	var runtime := RUNTIME_STATE.new()
	var runtime_errors: PackedStringArray = runtime.configure(level, REGISTRY, entities)
	_expect(runtime_errors.is_empty(), "Encounter runtime configures all authored Level 7 markers: %s" % "; ".join(runtime_errors))
	_expect(runtime.get_remaining_enemy_count() == 16 and not runtime.is_gate_unlocked(&"l7_exit"), "Runtime starts with sixteen enemies and a locked exit")
	for marker_id: String in marker_ids:
		runtime.mark_enemy_defeated(StringName(marker_id))
	_expect(not runtime.is_gate_unlocked(&"l7_exit"), "Killing all waves cannot open the exit if the Beacon survival event is absent")
	_expect(runtime.record_custom_event(&"soul_beacon_survived"), "Beacon controller can report survival through the canonical custom-event seam")
	_expect(runtime.is_gate_unlocked(&"l7_exit") and runtime.is_complete(), "All enemies plus Beacon survival unlock the encounter gate")
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
	push_error("LEVEL 7 VERTICAL SLICE FAIL: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 7 VERTICAL SLICE PASSED - %d checks" % _checks)
		quit(0)
		return
	print("CHAPTER 1 LEVEL 7 VERTICAL SLICE FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
