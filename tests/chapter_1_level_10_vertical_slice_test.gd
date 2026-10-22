extends SceneTree

const MAP_PATH := "res://data/levels/chapter_1_level_10.json"
const REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const REWARDS: RewardBundleRegistry = preload("res://data/content/rewards/campaign_reward_registry.tres")
const SCHEMA := preload("res://game/levels/level_schema.gd")
const RUNTIME_STATE := preload("res://game/content/encounters/encounter_runtime_state.gd")
const SOUL_COMBAT := preload("res://game/meta/hero_souls/hero_soul_combat_affixes.gd")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var document := _load_json(MAP_PATH)
	_expect(not document.is_empty(), "Dedicated Level 10 throne map loads")
	var validation: Dictionary = SCHEMA.validate_level(document)
	_expect(bool(validation.get("ok", false)), "Level 10 map satisfies the production schema: %s" % validation.get("error", ""))
	var metadata := document.get("metadata", {}) as Dictionary
	_expect(String(metadata.get("layout_profile", "")) == "castellan_throne_two_phase_boss", "Level 10 owns a dedicated two-phase throne layout")
	_expect(int(metadata.get("boss_phase_count", 0)) == 2 and is_equal_approx(float(metadata.get("phase_two_health_ratio", 0.0)), 0.55), "Map declares exactly two phases and the authored 55-percent threshold")

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
	_expect((by_type.get("player", []) as Array).size() == 1, "Throne map has one player spawn")
	_expect((by_type.get("vampire_castellan", []) as Array).size() == 1, "Throne map has one dedicated Castellan, never two ordinary Vampire proxies")
	_expect((by_type.get("vampire", []) as Array).size() == 1 and by_id.has("l10_approach_vampire"), "One explicit approach Vampire seeds packs but never substitutes for the dedicated boss")
	_expect((by_type.get("exit_gate", []) as Array).size() == 1 and by_id.has("l10_checkpoint"), "Throne map has one real exit and a stable checkpoint")
	_expect(bool((by_id.get("l10_vampire_castellan", {}) as Dictionary).get("grants_sigil_on_defeat", false)), "The boss death, not a loose pickup, owns the exit sigil")
	var reachable := _reachable_floor_cells(document, _entity_cell(by_id.get("l10_player_spawn", {})))
	for required_id: String in ["l10_checkpoint", "l10_vampire_castellan", "l10_exit"]:
		_expect(reachable.has(_entity_cell(by_id.get(required_id, {}))), "%s is physically reachable from the player spawn" % required_id)

	var level := REGISTRY.find_campaign_level(10)
	_expect(level != null and level.is_campaign_ready(), "Level 10 is CAMPAIGN_READY only behind its boss gates")
	if level == null:
		_finish()
		return
	_expect(level.layout_data_path == MAP_PATH and level.level_scene != null, "Campaign Level 10 routes to the dedicated throne map")
	_expect(level.encounter_ids == PackedStringArray(["chapter_1_level_10_castellan_phase_one"]), "One continuous encounter owns both boss phases")
	_expect(level.granted_feature_ids == PackedStringArray(["hero_soul_fusion", "chapter_2_access", "hunt_replay"]), "First clear atomically declares Fusion, Chapter 2 and Hunt Replay")
	_expect(level.unlock_requirements.prerequisite_level_ids == PackedStringArray(["chapter_1_level_9"]), "Level 10 directly requires the promoted Crimson Gate")

	var enemy := REGISTRY.find_enemy(&"vampire_castellan")
	_expect(enemy != null and enemy.base_scene != null and enemy.enemy_id == &"vampire_castellan", "Registry contains a real Vampire Castellan EnemyDefinition")
	_expect(enemy != null and int(enemy.max_health) == 720 and enemy.attack_behavior_id == &"castellan_two_phase_runtime", "Boss definition exposes its 720-HP two-phase runtime contract")
	var roster := REGISTRY.find_campaign_roster(10)
	_expect(roster != null and roster.get_total_count() == 1 and roster.get_count_for(&"vampire_castellan") == 1, "Level 10 roster contains exactly one dedicated Castellan")
	_expect(roster != null and roster.authoring_status == LevelRosterDefinition.AuthoringStatus.RUNTIME_READY, "Level 10 roster is runtime-ready rather than a proxy draft")

	var encounter := REGISTRY.find_encounter(level.entry_encounter_id)
	_expect(encounter != null and encounter.get_validation_errors().is_empty(), "Continuous Castellan encounter validates")
	if encounter != null:
		_expect(encounter.waves.size() == 1 and encounter.waves[0].groups.size() == 1, "Encounter authors one boss actor rather than respawning between phases")
		var entry: EncounterSpawnEntry = encounter.waves[0].groups[0].spawn_entries[0]
		_expect(entry.enemy_id == &"vampire_castellan" and entry.spawn_marker_ids == PackedStringArray(["l10_vampire_castellan"]), "Encounter points at the dedicated live boss marker")
		var objective_targets := {}
		for objective: EncounterObjectiveDefinition in encounter.objectives:
			objective_targets[objective.target_id] = true
		_expect(objective_targets.has(&"castellan_phase_two_started") and objective_targets.has(&"castellan_defeated"), "Phase transition and death are separate required events")
		_expect(encounter.completion.gate_entity_ids == PackedStringArray(["l10_exit"]), "Only the continuous boss encounter controls the north exit")

		var runtime := RUNTIME_STATE.new()
		var runtime_errors: PackedStringArray = runtime.configure(level, REGISTRY, entities)
		_expect(runtime_errors.is_empty(), "Canonical encounter runtime accepts the dedicated boss marker")
		_expect(runtime.get_remaining_enemy_count() == 1 and not runtime.is_gate_unlocked(&"l10_exit"), "Exit starts locked with exactly one live boss")
		_expect(runtime.record_custom_event(&"castellan_phase_two_started"), "55-percent transition event is accepted")
		_expect(not runtime.is_gate_unlocked(&"l10_exit"), "Reaching Phase 2 alone cannot open the exit")
		_expect(runtime.mark_enemy_defeated(&"l10_vampire_castellan"), "Dedicated boss death record is accepted once")
		_expect(runtime.record_custom_event(&"castellan_defeated"), "Final death event is accepted once")
		_expect(runtime.is_complete() and runtime.is_gate_unlocked(&"l10_exit"), "Both phases plus real death unlock the exit")

	var reward := REWARDS.find_bundle(level.completion_reward_bundle_id)
	_expect(reward != null and reward.player_level_grant == 1, "First clear atomically grants exactly one Player Level")
	var summary := reward.to_summary() if reward != null else {}
	var souls := summary.get("hero_souls", []) as Array
	_expect(souls.size() == 1, "First clear has one deterministic Hero Soul entitlement")
	if souls.size() == 1:
		var soul := souls[0] as Dictionary
		_expect(String(soul.get("rarity_name", "")) == "Epic" and String(soul.get("hero_id", "")) == "sword_hero" and int(soul.get("item_level", 0)) == 10, "Results payload names an Epic Sword Hero Soul Lv10")
		var affixes := soul.get("affixes", []) as Array
		_expect(affixes.size() == 3, "Epic Castellan Soul owns exactly three deterministic affixes")
		for raw_affix: Variant in affixes:
			var affix_id := String((raw_affix as Dictionary).get("affix_id", ""))
			_expect(SOUL_COMBAT.is_live_affix(affix_id), "Reward affix '%s' is LIVE gameplay, not display-only" % affix_id)
	_expect(int((summary.get("currencies", {}) as Dictionary).get("account", 0)) == 1200, "First-clear currency remains larger than the 120-Gold replay bounty")
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
	push_error("LEVEL 10 VERTICAL SLICE FAIL: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 10 VERTICAL SLICE PASSED - %d checks" % _checks)
		quit(0)
		return
	print("CHAPTER 1 LEVEL 10 VERTICAL SLICE FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
