extends SceneTree

const MAP_PATH := "res://data/levels/chapter_1_level_6.json"
const LEVEL_SCENE: PackedScene = preload("res://game/levels/crypt_entrance.tscn")
const LEVEL_SCHEMA := preload("res://game/levels/level_schema.gd")
const RUNTIME_STATE := preload("res://game/content/encounters/encounter_runtime_state.gd")
const REGISTRY: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)
const REWARDS: RewardBundleRegistry = preload(
	"res://data/content/rewards/campaign_reward_registry.tres"
)
const LEVEL_5_REWARD: RewardBundleDefinition = preload(
	"res://data/content/rewards/chapter_1_level_5_reward.tres"
)
const LEVEL_5_ARCHER_PICKUP: RewardBundleDefinition = preload(
	"res://data/content/rewards/chapter_1_level_5_archer_soul_pickup.tres"
)
const CAMPAIGN_PLAN: CampaignProgressionPlan = preload(
	"res://data/content/progression/soul_hero_campaign_plan.tres"
)
const ENEMY_TYPES := ["skeleton", "skeleton_reaper", "vampire"]

var _checks := 0
var _failures: Array[String] = []
var _document: Dictionary = {}
var _entities_by_id: Dictionary = {}


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_document = _load_json(MAP_PATH)
	_entities_by_id = _index_entities(_document.get("entities", []))
	_test_map_contract()
	_test_content_chain()
	_test_objective_runtime()
	_test_campaign_ready_gate()
	_finish()


func _test_map_contract() -> void:
	_expect(not _document.is_empty(), "Level 6 map JSON loads")
	if _document.is_empty():
		return
	var validation: Dictionary = LEVEL_SCHEMA.validate_level(_document)
	_expect(
		bool(validation.get("ok", false)),
		"Level 6 map passes LevelSchema v2: %s" % validation.get("error", "")
	)
	_expect(
		String(_document.get("name", "")) == "Two Souls, One Path",
		"Level 6 map keeps its campaign title"
	)
	var metadata := _document.get("metadata", {}) as Dictionary
	_expect(
		String(metadata.get("tileset", "")).contains("CC0"),
		"Level 6 reuses the licensed existing dungeon tileset"
	)
	_expect(
		String(metadata.get("layout_profile", "")) == "three_floor_soul_anchor_relay_lesson",
		"Level 6 declares the dedicated Anchor/Relay layout profile"
	)
	_expect(
		int(metadata.get("required_sigils", 0)) == 3,
		"Three Anchor cores are required by the live exit gate"
	)

	var entities: Array = _document.get("entities", [])
	var by_type := _index_entity_types(entities)
	_expect(
		(by_type.get("player", []) as Array).size() == 1,
		"Level 6 has one deterministic player spawn"
	)
	_expect(
		(by_type.get("exit_gate", []) as Array).size() == 1, "Level 6 has one deterministic exit"
	)
	_expect(
		(by_type.get("skeleton", []) as Array).size() == 9,
		"Level 6 places all nine Skeleton guards"
	)
	_expect(
		(by_type.get("skeleton_reaper", []) as Array).size() == 3,
		"Level 6 places three Anchor manifestations"
	)
	_expect(
		(by_type.get("sigil", []) as Array).size() == 3,
		"Level 6 places three collectible Anchor cores"
	)
	_expect(
		(by_type.get("floor_door", []) as Array).size() == 4,
		"Two reciprocal door pairs join the three floors"
	)
	for index: int in range(1, 4):
		var suffix := "%02d" % index
		_expect(
			_entities_by_id.has("l6_soul_anchor_%s" % suffix),
			"Soul Anchor manifestation %s has a stable entity ID" % suffix
		)
		_expect(
			_entities_by_id.has("l6_anchor_core_%s" % suffix),
			"Soul Anchor core %s has a stable entity ID" % suffix
		)

	var floor := _layer_lookup(_document, "Backdrop")
	var geometry := _layer_lookup(_document, "Geometry")
	_expect(not floor.is_empty(), "Level 6 has a walkable floor footprint")
	_expect(_no_overlap(floor, geometry), "Level 6 walls never overwrite walkable floor")
	_expect(
		_all_entities_on_floor(entities, floor), "Every Level 6 entity is placed on walkable floor"
	)
	_expect(_count_components(floor) == 3, "Level 6 has exactly three door-linked floor footprints")
	var reachable := _reachable_floor(_document, floor)
	_expect(
		reachable.size() == floor.size(),
		"Player can reach every Level 6 floor cell through reciprocal doors"
	)
	for objective_id: String in [
		"l6_anchor_core_01", "l6_anchor_core_02", "l6_anchor_core_03", "l6_exit"
	]:
		_expect(
			reachable.has(_entity_cell(_entities_by_id.get(objective_id, {}))),
			"%s is reachable from the player spawn" % objective_id
		)

	var camps: Array = metadata.get("combat_camps", [])
	_expect(camps.size() == 3, "Level 6 has three authored Soul Anchor combat clusters")
	var assigned_enemies := {}
	for camp_value: Variant in camps:
		var camp := camp_value as Dictionary
		var enemy_ids: Array = camp.get("enemy_ids", [])
		_expect(
			enemy_ids.size() == 4,
			"%s contains exactly three guards and one Anchor" % camp.get("id", "camp")
		)
		for enemy_id_value: Variant in enemy_ids:
			var enemy_id := String(enemy_id_value)
			_expect(_entities_by_id.has(enemy_id), "Authored camp member exists: %s" % enemy_id)
			_expect(
				not assigned_enemies.has(enemy_id),
				"Enemy is assigned to exactly one camp: %s" % enemy_id
			)
			assigned_enemies[enemy_id] = true
	_expect(
		assigned_enemies.size() == 12, "All twelve runtime enemies belong to one Anchor cluster"
	)

	var special_zones: Array = metadata.get("special_zones", [])
	_expect(special_zones.size() == 3, "Map metadata describes all three Soul Anchor zones")
	for zone_value: Variant in special_zones:
		var zone := zone_value as Dictionary
		_expect(
			String(zone.get("defeat_event_id", "")) == "soul_anchor_destroyed",
			"%s uses the canonical counted event" % zone.get("id", "anchor")
		)
		_expect(
			_entities_by_id.has(String(zone.get("anchor_enemy_id", ""))),
			"%s references a live Anchor manifestation" % zone.get("id", "anchor")
		)
		_expect(
			_entities_by_id.has(String(zone.get("core_entity_id", ""))),
			"%s references a live collectible core" % zone.get("id", "anchor")
		)

	var instance := LEVEL_SCENE.instantiate() as DungeonLevel
	_expect(instance != null, "Shared DungeonLevel scene instantiates for Level 6")
	if instance != null:
		instance.level_data_path = MAP_PATH
		instance.watch_file_changes = false
		root.add_child(instance)
		_expect(not instance.level_data.is_empty(), "DungeonLevel runtime accepts Level 6 JSON")
		_expect(
			instance.backdrop.get_used_cells().size() == floor.size(),
			"DungeonLevel applies every Level 6 floor tile"
		)
		_expect(
			instance.geometry.get_used_cells().size() == geometry.size(),
			"DungeonLevel applies every Level 6 wall tile"
		)
		root.remove_child(instance)
		instance.free()


func _test_content_chain() -> void:
	var registry_errors := REGISTRY.get_validation_errors()
	_expect(
		registry_errors.is_empty(),
		"Campaign registry validates with promoted Level 6: %s" % "; ".join(registry_errors)
	)
	var level := REGISTRY.find_campaign_level(6)
	_expect(level != null, "Campaign slot 6 resolves its LevelDefinition")
	if level == null:
		return
	_expect(
		level.content_status == LevelDefinition.ContentStatus.CAMPAIGN_READY,
		"Level 6 is CAMPAIGN_READY for the internal playable prototype"
	)
	_expect(level.is_campaign_ready(), "Level 6 is exposed through the internal campaign route")
	_expect(level.level_scene != null, "Level 6 has a runnable shared scene")
	_expect(level.layout_data_path == MAP_PATH, "Level 6 routes to the dedicated map JSON")
	_expect(
		(
			level.unlock_requirements.prerequisite_level_ids
			== PackedStringArray(["chapter_1_level_5"])
		),
		"Level 6 still follows Level 5 sequentially"
	)
	_expect(
		level.authoring_notes.contains("physical Level 5 Archer Soul"),
		"Level 6 records the current physical Archer recruitment gate"
	)
	_expect(
		(
			level.authoring_notes.contains("optional")
			and level.authoring_notes.contains("legacy profiles")
		),
		"Level 6 documents the non-blocking Relay lesson for existing profiles"
	)

	var encounter := REGISTRY.find_encounter(&"chapter_1_level_6_soul_anchors")
	_expect(encounter != null, "Level 6 resolves its Soul Anchor encounter")
	if encounter == null:
		return
	var encounter_errors := encounter.get_validation_errors()
	_expect(
		encounter_errors.is_empty(),
		"Level 6 encounter contract validates: %s" % "; ".join(encounter_errors)
	)
	_expect(
		encounter.waves.size() == 1 and encounter.waves[0].groups.size() == 3,
		"Encounter preserves three ordered Anchor clusters"
	)
	var encounter_markers := {}
	var defeat_event_markers := 0
	for wave: EncounterWaveDefinition in encounter.waves:
		for group: EncounterGroupDefinition in wave.groups:
			_expect(
				group.spawn_entries.size() == 2, "%s has guard and Anchor entries" % group.group_id
			)
			for entry: EncounterSpawnEntry in group.spawn_entries:
				for marker_id: String in entry.spawn_marker_ids:
					encounter_markers[marker_id] = true
				if entry.defeat_event_id == &"soul_anchor_destroyed":
					defeat_event_markers += entry.count
	_expect(
		defeat_event_markers == 3,
		"Exactly three authored enemies emit Soul Anchor destruction events"
	)
	_expect(
		_same_enemy_marker_set(encounter_markers),
		"Encounter spawn markers exactly match all twelve map enemies"
	)

	var anchor_objective := _find_objective(encounter, &"destroy_three_soul_anchors")
	_expect(
		(
			anchor_objective != null
			and (
				anchor_objective.objective_type
				== EncounterObjectiveDefinition.ObjectiveType.CUSTOM_EVENT
			)
		),
		"Anchor objective uses counted CUSTOM_EVENT runtime"
	)
	_expect(
		anchor_objective != null and anchor_objective.target_count == 3,
		"Anchor objective requires exactly three destruction events"
	)
	var forward_relay := _find_objective(encounter, &"practice_sword_to_archer_relay")
	var reverse_relay := _find_objective(encounter, &"practice_archer_to_sword_relay")
	_expect(
		forward_relay != null and not forward_relay.required,
		"Sword-to-Archer Relay lesson is tracked without becoming a hard lock"
	)
	_expect(
		reverse_relay != null and not reverse_relay.required,
		"Archer-to-Sword Relay lesson is tracked without becoming a hard lock"
	)
	_expect(
		(
			encounter.completion.required_objective_ids
			== PackedStringArray(["destroy_three_soul_anchors", "clear_anchor_guards"])
		),
		"Exit completion requires all Anchors and guards, not optional tutorial telemetry"
	)
	_expect(
		encounter.completion.gate_entity_ids == PackedStringArray(["l6_exit"]),
		"Encounter controls the actual Level 6 exit marker"
	)

	var roster := REGISTRY.find_campaign_roster(6)
	_expect(roster != null, "Campaign slot 6 resolves its roster")
	if roster != null:
		_expect(
			roster.authoring_status == LevelRosterDefinition.AuthoringStatus.RUNTIME_READY,
			"Level 6 roster is runtime-ready after map placement"
		)
		_expect(
			roster.get_count_for(&"skeleton_swordsman") == 9,
			"Level 6 roster owns nine Skeleton guards"
		)
		_expect(
			roster.get_count_for(&"bone_reaper") == 3,
			"Level 6 roster owns three Anchor manifestations"
		)
		_expect(
			roster.get_total_count() == encounter_markers.size(),
			"Roster total exactly matches encounter/map markers"
		)

	var reward := REWARDS.find_bundle(level.completion_reward_bundle_id)
	_expect(reward != null, "Level 6 resolves its authored first-clear reward")
	if reward != null:
		_expect(reward.get_validation_errors().is_empty(), "Level 6 reward validates")
		_expect(
			(
				reward.account_currency == 480
				and reward.hero_materials == 10
				and reward.monster_fragments == 4
			),
			"Level 6 reward keeps its approved 480/10/4 economy values"
		)


func _test_objective_runtime() -> void:
	var level := REGISTRY.find_campaign_level(6)
	var runtime = RUNTIME_STATE.new()
	var errors: PackedStringArray = runtime.configure(
		level, REGISTRY, _document.get("entities", [])
	)
	_expect(
		errors.is_empty(),
		"Level 6 encounter runtime configures from authored markers: %s" % "; ".join(errors)
	)
	var initial: Dictionary = runtime.get_snapshot()
	_expect(int(initial.get("total_enemies", 0)) == 12, "Runtime tracks all twelve Level 6 enemies")
	_expect(int(initial.get("total_groups", 0)) == 3, "Runtime tracks all three Anchor groups")
	_expect(runtime.is_gate_controlled(&"l6_exit"), "Runtime controls the authored exit gate")
	_expect(not runtime.is_gate_unlocked(&"l6_exit"), "Level 6 exit starts locked")
	_expect(
		not runtime.record_custom_event(&"unknown_event"),
		"Runtime rejects un-authored custom events"
	)

	var game_events := root.get_node_or_null("GameEvents")
	_expect(game_events != null, "GameEvents autoload exists for Relay objective tracking")
	if game_events != null:
		game_events.emit_signal(
			&"soul_relay_completed", &"archer_hero", &"sword_hero", Vector2.ZERO
		)
		game_events.emit_signal(
			&"soul_relay_completed", &"sword_hero", &"archer_hero", Vector2.ZERO
		)
	var relay_snapshot: Dictionary = runtime.get_snapshot()
	var relay_encounter := (
		(relay_snapshot.get("encounters", {}) as Dictionary).get(
			"chapter_1_level_6_soul_anchors", {}
		)
		as Dictionary
	)
	var relay_objectives := relay_encounter.get("objectives", {}) as Dictionary
	_expect(
		bool(relay_objectives.get("practice_sword_to_archer_relay", false)),
		"Runtime observes Sword-to-Archer Relay through the existing GameEvents seam"
	)
	_expect(
		bool(relay_objectives.get("practice_archer_to_sword_relay", false)),
		"Runtime observes Archer-to-Sword Relay through the existing GameEvents seam"
	)
	_expect(
		not runtime.is_gate_unlocked(&"l6_exit"),
		"Optional Relay practice alone cannot open the exit"
	)

	_expect(
		runtime.mark_enemy_defeated(&"l6_soul_anchor_01"),
		"First Anchor manifestation can be defeated once"
	)
	var first_anchor_snapshot: Dictionary = runtime.get_snapshot()
	var first_events := first_anchor_snapshot.get("custom_events", {}) as Dictionary
	_expect(
		int(first_events.get("soul_anchor_destroyed", 0)) == 1,
		"First Anchor defeat emits one counted event"
	)
	_expect(
		not runtime.mark_enemy_defeated(&"l6_soul_anchor_01"),
		"Duplicate Anchor death cannot increment objective progress"
	)
	_expect(
		(
			int(
				(runtime.get_snapshot().get("custom_events", {}) as Dictionary).get(
					"soul_anchor_destroyed", 0
				)
			)
			== 1
		),
		"Duplicate death leaves Anchor count unchanged"
	)

	for entity_id: String in _enemy_entity_ids():
		if entity_id != "l6_soul_anchor_01":
			runtime.mark_enemy_defeated(StringName(entity_id))
	var final_snapshot: Dictionary = runtime.get_snapshot()
	var final_events := final_snapshot.get("custom_events", {}) as Dictionary
	_expect(
		int(final_events.get("soul_anchor_destroyed", 0)) == 3,
		"All three Anchor manifestations emit exactly three events"
	)
	_expect(
		int(final_snapshot.get("defeated_enemies", 0)) == 12,
		"All twelve authored enemies can complete deterministically"
	)
	_expect(
		int(final_snapshot.get("completed_groups", 0)) == 3,
		"All three Anchor clusters report complete"
	)
	_expect(
		bool(final_snapshot.get("complete", false)),
		"Level 6 encounter completes after Anchors and guards fall"
	)
	_expect(
		runtime.is_gate_unlocked(&"l6_exit"), "Level 6 exit unlocks after the required objectives"
	)
	runtime.clear()


func _test_campaign_ready_gate() -> void:
	var archer_milestone := CAMPAIGN_PLAN.find_milestone(&"chapter_1_level_5_archer_recruitment")
	_expect(
		archer_milestone != null, "Campaign plan contains the approved Level 5 Archer recruitment"
	)
	_expect(
		(
			archer_milestone != null
			and (
				archer_milestone.implementation_status
				== CampaignMilestoneDefinition.ImplementationStatus.CONTENT_READY
			)
			and not archer_milestone.is_playable_now()
		),
		(
			"legacy CampaignProgressionService milestone stays CONTENT_READY instead of becoming a "
			+ "second reward authority"
		)
	)
	_expect(
		archer_milestone != null and archer_milestone.status_note.contains("physical pickup"),
		"campaign plan names the physical pickup as the Archer reward authority"
	)

	var candidate := {
		"currencies": {"account": 0, "hero_materials": 0, "monster_fragments": 0},
		"inventory": {"item_stacks": {}, "hero_souls": []},
		"progression":
		{
			"unlocked_heroes": {"sword_hero": true},
			"features": {"soul_hero": false, "soul_relay": false},
		},
		"soul_team":
		{
			"active_hero": "sword_hero",
			"reserve_souls": ["", ""],
			"capacity": 2,
		},
	}
	_expect(
		LEVEL_5_REWARD.apply_to_candidate(candidate),
		"Level 5 first-clear economy bundle applies independently"
	)
	var souls := (candidate.get("inventory", {}) as Dictionary).get("hero_souls", []) as Array
	var heroes := (
		(candidate.get("progression", {}) as Dictionary).get("unlocked_heroes", {}) as Dictionary
	)
	var features := (
		(candidate.get("progression", {}) as Dictionary).get("features", {}) as Dictionary
	)
	_expect(
		souls.is_empty() and not bool(heroes.get("archer_hero", false)),
		"Level completion alone grants no Archer ownership"
	)
	_expect(
		not bool(features.get("soul_hero", false)) and not bool(features.get("soul_relay", false)),
		"Level completion cannot stand in for Hero Soul collection"
	)
	_expect(
		LEVEL_5_ARCHER_PICKUP.apply_to_candidate(candidate),
		"Separate physical-pickup bundle applies the Archer entitlement"
	)
	souls = (candidate.get("inventory", {}) as Dictionary).get("hero_souls", []) as Array
	heroes = (
		(candidate.get("progression", {}) as Dictionary).get("unlocked_heroes", {}) as Dictionary
	)
	features = (candidate.get("progression", {}) as Dictionary).get("features", {}) as Dictionary
	_expect(
		(
			souls.size() == 1
			and String((souls[0] as Dictionary).get("hero_id", "")) == "archer_hero"
			and int((souls[0] as Dictionary).get("rarity", -1)) == 0
			and int((souls[0] as Dictionary).get("item_level", 0)) == 1
		),
		"Physical pickup grants one base Normal level-1 Archer Soul"
	)
	_expect(
		(
			bool(heroes.get("archer_hero", false))
			and bool(features.get("soul_hero", false))
			and bool(features.get("soul_relay", false))
		),
		"Physical pickup grants Archer ownership and the Hero Soul core"
	)
	_expect(
		(candidate.get("soul_team", {}) as Dictionary).get("reserve_souls", []) == ["", ""],
		"Archer pickup leaves team placement unchanged until the player explicitly presses Equip"
	)
	var chapter_one_levels: Array[LevelDefinition] = []
	for level: LevelDefinition in REGISTRY.get_ordered_campaign_levels(false):
		if level.chapter_number == 1:
			chapter_one_levels.append(level)
	_expect(
		chapter_one_levels.size() == 10,
		"Playable campaign catalog exposes all ten playable Chapter 1 levels"
	)
	_expect(
		REGISTRY.find_campaign_level(6).is_campaign_ready(),
		"Level 6 is promoted after the gameplay and fresh-save gates clear"
	)


func _find_objective(
	encounter: EncounterDefinition, objective_id: StringName
) -> EncounterObjectiveDefinition:
	for objective: EncounterObjectiveDefinition in encounter.objectives:
		if objective != null and objective.objective_id == objective_id:
			return objective
	return null


func _same_enemy_marker_set(markers: Dictionary) -> bool:
	var enemy_ids := _enemy_entity_ids()
	if markers.size() != enemy_ids.size():
		return false
	for enemy_id: String in enemy_ids:
		if not markers.has(enemy_id):
			return false
	return true


func _enemy_entity_ids() -> Array[String]:
	var result: Array[String] = []
	for entity_id: String in _entities_by_id:
		var entity := _entities_by_id[entity_id] as Dictionary
		if String(entity.get("type", "")) in ENEMY_TYPES:
			result.append(entity_id)
	result.sort()
	return result


func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	return parsed if parsed is Dictionary else {}


func _index_entities(entities: Array) -> Dictionary:
	var result := {}
	for entity_value: Variant in entities:
		if entity_value is Dictionary:
			result[String(entity_value.get("id", ""))] = entity_value
	return result


func _index_entity_types(entities: Array) -> Dictionary:
	var result := {}
	for entity_value: Variant in entities:
		if not entity_value is Dictionary:
			continue
		var entity := entity_value as Dictionary
		var type := String(entity.get("type", ""))
		var bucket: Array = result.get(type, [])
		bucket.append(entity)
		result[type] = bucket
	return result


func _layer_lookup(document: Dictionary, layer_name: String) -> Dictionary:
	var result := {}
	var layers := document.get("layers", {}) as Dictionary
	for cell_value: Variant in layers.get(layer_name, []) as Array:
		var cell := cell_value as Dictionary
		result[Vector2i(int(cell.get("x", -1)), int(cell.get("y", -1)))] = true
	return result


func _all_entities_on_floor(entities: Array, floor: Dictionary) -> bool:
	for entity_value: Variant in entities:
		if (
			not entity_value is Dictionary
			or not floor.has(_entity_cell(entity_value as Dictionary))
		):
			return false
	return true


func _no_overlap(left: Dictionary, right: Dictionary) -> bool:
	for coordinate: Variant in left:
		if right.has(coordinate):
			return false
	return true


func _count_components(floor: Dictionary) -> int:
	var unseen := floor.duplicate()
	var components := 0
	while not unseen.is_empty():
		components += 1
		var start: Vector2i = unseen.keys()[0]
		var queue: Array[Vector2i] = [start]
		unseen.erase(start)
		var cursor := 0
		while cursor < queue.size():
			var current := queue[cursor]
			cursor += 1
			for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
				var neighbor := current + direction
				if unseen.has(neighbor):
					unseen.erase(neighbor)
					queue.append(neighbor)
	return components


func _reachable_floor(document: Dictionary, floor: Dictionary) -> Dictionary:
	var start := Vector2i.ZERO
	var door_edges := {}
	for entity_value: Variant in document.get("entities", []) as Array:
		var entity := entity_value as Dictionary
		var type := String(entity.get("type", ""))
		if type == "player":
			start = _entity_cell(entity)
		elif type == "floor_door":
			var target: Array = entity.get("target_position", [])
			var target_cell := Vector2i(
				floori(float(target[0]) / 16.0), floori(float(target[1]) / 16.0)
			)
			var source := _entity_cell(entity)
			var targets: Array = door_edges.get(source, [])
			targets.append(target_cell)
			door_edges[source] = targets
	var visited := {start: true}
	var queue: Array[Vector2i] = [start]
	var cursor := 0
	while cursor < queue.size():
		var current := queue[cursor]
		cursor += 1
		for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var neighbor := current + direction
			if floor.has(neighbor) and not visited.has(neighbor):
				visited[neighbor] = true
				queue.append(neighbor)
		for target_value: Variant in door_edges.get(current, []) as Array:
			var target: Vector2i = target_value
			if floor.has(target) and not visited.has(target):
				visited[target] = true
				queue.append(target)
	return visited


func _entity_cell(entity: Dictionary) -> Vector2i:
	var position: Array = entity.get("position", [])
	return Vector2i(floori(float(position[0]) / 16.0), floori(float(position[1]) / 16.0))


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error("LEVEL 6 VERTICAL SLICE FAIL: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 6 VERTICAL SLICE PASSED - %d checks" % _checks)
		quit(0)
		return
	print(
		(
			"CHAPTER 1 LEVEL 6 VERTICAL SLICE FAILED - %d/%d checks failed"
			% [_failures.size(), _checks]
		)
	)
	quit(1)
