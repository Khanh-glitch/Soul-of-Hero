extends Node

## End-to-end campaign entry gate. This runs through the production AppRoot and
## AppFlow route, but uses a unique save path supplied by the PowerShell runner.
## Every CAMPAIGN_READY definition is discovered from the registry so promoting
## a new level automatically expands this test.

const CAMPAIGN_REGISTRY: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)
const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const PACK_RULES := preload("res://game/content/encounters/encounter_pack_rules.gd")
const ENEMY_SCALER := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")
const TEST_UNLOCK_TRANSACTION := "tests:campaign_entry_runtime:unlock_ready:v1"

var _app_root: Node
var _checks := 0
var _failures: Array[String] = []


func start(app_root: Node) -> void:
	_app_root = app_root
	_run.call_deferred()


func _run() -> void:
	var ready_levels := CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false)
	_expect(not ready_levels.is_empty(), "Registry exposes at least one CAMPAIGN_READY level")
	if ready_levels.is_empty():
		_finish()
		return

	var ready_level_ids: Array[String] = []
	for definition: LevelDefinition in ready_levels:
		ready_level_ids.append(String(definition.level_id))

	var save_service := get_node_or_null("/root/SaveService")
	_expect(save_service != null, "SaveService is available through the real AppRoot")
	if save_service == null:
		_finish()
		return
	var seeded := bool(save_service.call(
		&"transact_once",
		TEST_UNLOCK_TRANSACTION,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
			campaign["unlocked_levels"] = ready_level_ids.duplicate()
			# The production gate now treats every LevelUnlockRequirements field as
			# conjunctive. This QA fixture grants its prerequisites explicitly instead
			# of relying on a forged unlocked_levels cache.
			var completed: Dictionary = campaign.get("completed_levels", {}).duplicate(true)
			for definition: LevelDefinition in ready_levels:
				for prerequisite_id: String in definition.unlock_requirements.prerequisite_level_ids:
					completed[prerequisite_id] = true
			campaign["completed_levels"] = completed
			progression["campaign"] = campaign
			var unlocked_heroes: Dictionary = progression.get("unlocked_heroes", {}).duplicate(true)
			unlocked_heroes["axe_hero"] = true
			progression["unlocked_heroes"] = unlocked_heroes
			var features: Dictionary = progression.get("features", {}).duplicate(true)
			features["soul_hero"] = true
			features["soul_relay"] = true
			for definition: LevelDefinition in ready_levels:
				for feature_id: String in definition.unlock_requirements.required_feature_ids:
					features[feature_id] = true
			progression["features"] = features
			candidate["progression"] = progression
			var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
			var souls: Array = (inventory.get("hero_souls", []) as Array).duplicate(true)
			var axe_soul := HERO_SOUL_RULES.create_instance(
				&"axe_hero",
				HERO_SOUL_RULES.Rarity.MAGIC,
				5,
				&"campaign_entry_runtime_test",
				97531,
				HERO_SOUL_RULES.AFFINITY_WARRIOR
			)
			souls.append(axe_soul)
			inventory["hero_souls"] = souls
			candidate["inventory"] = inventory
			candidate["soul_team"] = {
				"active_hero": "sword_hero",
				"reserve_souls": ["axe_hero", ""],
				"capacity": 2,
			}
			return true,
		{
			"kind": "isolated_campaign_entry_runtime_test",
			"ready_level_count": ready_levels.size(),
			"live_team": "sword_hero+axe_hero",
		}
	))
	_expect(seeded, "Isolated save unlocks every CAMPAIGN_READY level and seeds a valid Sword/Axe live team")
	if not seeded:
		_finish()
		return

	var baseline_save: Dictionary = save_service.call(&"get_snapshot")
	var baseline_rewards := _reward_projection(baseline_save)
	for definition: LevelDefinition in ready_levels:
		await _verify_level_entry(definition, baseline_save, baseline_rewards)

	_expect(not AppFlow.has_active_run(), "No active run survives the campaign entry suite")
	_expect(
		_reward_projection(save_service.call(&"get_snapshot")) == baseline_rewards,
		"The complete suite exits without granting rewards or campaign completion",
	)
	_finish()


func _verify_level_entry(
	definition: LevelDefinition,
	baseline_save: Dictionary,
	baseline_rewards: Dictionary,
) -> void:
	var label := "Level %d (%s)" % [definition.campaign_slot, definition.level_id]
	var document := _load_json(definition.layout_data_path)
	_expect(not document.is_empty(), "%s layout JSON loads" % label)

	AppFlow.open_home(&"campaign")
	await get_tree().process_frame
	_expect(_app_root.get_current_route() == &"home", "%s reaches Home/Campaign" % label)
	AppFlow.open_level_details(definition.level_id)
	await get_tree().process_frame
	_expect(_app_root.get_current_route() == &"level_details", "%s details route opens" % label)

	var started := AppFlow.start_campaign_level(definition.level_id)
	_expect(started, "%s starts through the production campaign gate" % label)
	if not started:
		return
	await get_tree().process_frame
	await get_tree().process_frame

	_expect(_app_root.get_current_route() == &"gameplay", "%s remains in gameplay after entry" % label)
	_expect(_app_root.get_route_child_count() == 1, "%s owns exactly one AppRoot route" % label)
	var game := _get_gameplay_route()
	_expect(game != null, "%s instantiates the real Main gameplay scene" % label)
	if game != null:
		_verify_active_run(definition, label)
		_verify_layout(game, definition, document, label)
		_verify_encounter(game, definition, label)
		_verify_live_soul_team(game, label)

	AppFlow.abort_to_home()
	await get_tree().process_frame
	await get_tree().process_frame
	_expect(_app_root.get_current_route() == &"home", "%s exits back to Home" % label)
	_expect(not AppFlow.has_active_run(), "%s clears its transient active run" % label)
	var save_after_exit: Dictionary = SaveService.get_snapshot()
	_expect(save_after_exit == baseline_save, "%s entry/exit leaves the isolated save byte-for-byte equivalent" % label)
	_expect(
		_reward_projection(save_after_exit) == baseline_rewards,
		"%s entry/exit grants no currency, item, Soul, receipt, or completion" % label,
	)


func _verify_active_run(definition: LevelDefinition, label: String) -> void:
	var run := AppFlow.get_active_run()
	_expect(StringName(run.get("level_id", "")) == definition.level_id, "%s active run keeps the requested level ID" % label)
	_expect(StringName(run.get("content_level_id", "")) == definition.level_id, "%s resolves the matching content definition" % label)
	_expect(String(run.get("layout_data_path", "")) == definition.layout_data_path, "%s active run selects the matching layout path" % label)
	_expect(int(run.get("campaign_slot", 0)) == definition.campaign_slot, "%s active run keeps the matching campaign slot" % label)
	var soul_team: Dictionary = run.get("soul_team", {})
	_expect(
		String(soul_team.get("active_hero", "")) == "sword_hero"
			and (soul_team.get("reserve_souls", []) as Array).has("axe_hero"),
		"%s active run carries the persisted Sword/Axe Soul Team" % label,
	)


func _verify_live_soul_team(game: Node, label: String) -> void:
	# Main reparents the authored Knight under the y-sorted entity root before
	# gameplay begins, so resolve the canonical runtime location.
	var live_player := game.get_node_or_null("Level/Entities/Knight")
	_expect(live_player != null, "%s exposes the live Knight controller" % label)
	if live_player == null:
		return
	var manager := live_player.call(&"get_hero_soul_manager") as HeroSoulManager
	_expect(manager != null, "%s exposes the live HeroSoulManager" % label)
	if manager == null:
		return
	var team_state := manager.get_state_snapshot()
	_expect(
		String(team_state.get("active_hero", "")) == "sword_hero"
			and String(team_state.get("reserve_soul", "")) == "axe_hero",
		"%s applies the run Soul Team to live combat instead of dropping Axe at scene entry" % label,
	)
	var reserve_stats := manager.get_reserve_combat_snapshot()
	_expect(
		String(reserve_stats.get("hero_id", "")) == "axe_hero",
		"%s derives a live reserve-Axe combat snapshot" % label,
	)
	var weapon_manager := live_player.call(&"get_weapon_manager") as WeaponManager
	var hand := weapon_manager.get_hand_weapon() if weapon_manager != null else null
	var reserve_weapon := weapon_manager.get_spirit_weapon(0) if weapon_manager != null else null
	_expect(
		hand != null and hand.weapon_id == &"sword"
			and reserve_weapon != null and reserve_weapon.weapon_id == &"axe",
		"%s synchronizes active Sword and reserve Axe to the actual combat loadout" % label,
	)


func _verify_layout(
	game: Node,
	definition: LevelDefinition,
	document: Dictionary,
	label: String,
) -> void:
	var dungeon := game.get_node_or_null("Level") as DungeonLevel
	_expect(dungeon != null, "%s has the production DungeonLevel" % label)
	if dungeon == null:
		return
	_expect(dungeon.level_data_path == definition.layout_data_path, "%s Main loads the definition's layout, not the sandbox fallback" % label)
	_expect(String(dungeon.level_data.get("name", "")) == String(document.get("name", "")), "%s live layout name matches its JSON" % label)
	var authored_entities: Array = document.get("entities", []) if document.get("entities", []) is Array else []
	var metadata: Dictionary = document.get("metadata", {}) if document.get("metadata", {}) is Dictionary else {}
	var chapter_two_directed := bool(metadata.get("chapter_2_director", false))
	var deferred_enemy_ids := _get_deferred_enemy_ids(metadata, authored_entities)
	var directed_enemy_ids := _get_chapter_two_directed_enemy_ids(authored_entities) if chapter_two_directed else []
	var snapshot: Dictionary = game.call(&"get_runtime_snapshot")
	var live_level: Dictionary = snapshot.get("level", {})
	var chapter_two_director: Dictionary = snapshot.get("chapter_2_spawn_director", {})
	var entity_root := game.get_node_or_null("Level/Entities")
	var pack_member_count := 0
	_expect(entity_root != null, "%s has a live entity root" % label)
	if entity_root != null:
		var density_bonus_count := 0
		var runtime_pack_member_count := 0
		var pack_family_presence := {}
		var objective_used_as_pack_source := false
		var excluded_pack_sources := _get_deferred_enemy_ids(metadata, authored_entities)
		for field: String in ["boss_entity_id", "crimson_reaper_id"]:
			var special_id := String(metadata.get(field, ""))
			if not special_id.is_empty() and not excluded_pack_sources.has(special_id):
				excluded_pack_sources.append(special_id)
		for child: Node in entity_root.get_children():
			if bool(child.get_meta(&"density_bonus", false)):
				density_bonus_count += 1
			if bool(child.get_meta(&"encounter_pack", false)):
				pack_member_count += 1
				pack_family_presence[String(child.get_meta(&"level_entity_type", ""))] = true
				if bool(child.get_meta(&"runtime_pack_member", false)):
					runtime_pack_member_count += 1
				var config_value: Variant = child.get_meta(&"level_entity_config", {})
				if config_value is Dictionary:
					var config: Dictionary = config_value
					var source_id := String(config.get("source_entity_id", config.get("id", "")))
					objective_used_as_pack_source = objective_used_as_pack_source \
						or excluded_pack_sources.has(source_id)
		var expected_authored_children := authored_entities.size() - deferred_enemy_ids.size()
		if chapter_two_directed:
			var directed_alive := int(chapter_two_director.get("alive", -1))
			var active_cap := int(chapter_two_director.get("active_cap", 0))
			expected_authored_children = authored_entities.size() - directed_enemy_ids.size() + directed_alive
			_expect(
				directed_alive >= 0 and active_cap > 0 and directed_alive <= active_cap,
				"%s Chapter 2 director keeps the simultaneous enemy count within its live cap" % label,
			)
				_expect(
					entity_root.get_child_count() - density_bonus_count \
						== expected_authored_children,
					"%s spawns every authored immediate entity exactly once beside its optional density projection or Chapter 2 queue" % label,
				)
		if PACK_RULES.uses_pack_model(metadata):
			var pack_plan := PACK_RULES.get_level_pack_plan(
				metadata,
				definition.campaign_slot,
				GameSession.active_difficulty,
			)
			_expect(pack_member_count == int(pack_plan.total_members), "%s live scene materializes every planned encounter-pack member" % label)
			_expect(runtime_pack_member_count > 0, "%s runtime pack population expands beyond its authored anchors" % label)
			_expect(not objective_used_as_pack_source, "%s never clones a deferred, branch, or boss objective as pack population" % label)
			if definition.campaign_slot >= 6:
				_expect(
					pack_family_presence.has("skeleton")
						and pack_family_presence.has("skeleton_reaper")
						and pack_family_presence.has("vampire"),
					"%s live late-stage packs include all three eligible enemy families" % label,
				)
	_expect(String(live_level.get("name", "")) == String(document.get("name", "")), "%s runtime snapshot reports the correct layout" % label)
	_expect(int(live_level.get("geometry_cells", 0)) > 0, "%s produces non-empty live geometry" % label)
	if PACK_RULES.uses_pack_model(metadata) and entity_root != null:
		var population: Dictionary = live_level.get("enemy_population", {})
		var signature := String(population.get("plan_signature", ""))
		_expect(
			bool(population.get("valid", false))
				and int(population.get("expected_population", -1)) == pack_member_count
				and int(population.get("realized_population", -1)) == pack_member_count
				and not signature.is_empty(),
			"%s publishes one signed population authority matching the realized live pack" % label,
		)
		var checked_enemy_count := 0
		var all_rewards_current := true
		var all_signatures_match := true
		for child: Node in entity_root.get_children():
			if not bool(child.get_meta(&"encounter_pack", false)):
				continue
			checked_enemy_count += 1
			all_rewards_current = all_rewards_current \
				and ENEMY_SCALER.is_experience_reward_current(child)
			var projection_value: Variant = child.get_meta(
				ENEMY_SCALER.EXPERIENCE_PROJECTION_META,
				{},
			)
			all_signatures_match = all_signatures_match \
				and projection_value is Dictionary \
				and String((projection_value as Dictionary).get(
					"population_plan_signature",
					"",
				)) == signature
		_expect(
			checked_enemy_count == pack_member_count and all_rewards_current,
			"%s finalizes every live pack enemy XP against its current combat revision" % label,
		)
		_expect(
			all_signatures_match,
			"%s gives every live pack enemy the exact signed population plan" % label,
		)


func _verify_encounter(game: Node, definition: LevelDefinition, label: String) -> void:
	var snapshot: Dictionary = game.call(&"get_runtime_snapshot")
	var session: Dictionary = snapshot.get("session", {})
	var encounter: Dictionary = session.get("encounter", {})
	var expected_markers := _get_expected_enemy_markers(definition)
	_expect(bool(encounter.get("configured", false)), "%s configures encounter runtime" % label)
	_expect(StringName(encounter.get("level_id", "")) == definition.level_id, "%s encounter snapshot belongs to the requested level" % label)
	_expect(int(encounter.get("total_enemies", -1)) == expected_markers.size(), "%s tracks the authored encounter enemy count" % label)
	_expect(int(encounter.get("defeated_enemies", -1)) == 0, "%s encounter starts with zero defeated enemies" % label)
	_expect(int(encounter.get("remaining_enemies", -1)) == expected_markers.size(), "%s encounter starts with every enemy remaining" % label)
	var encounter_snapshots: Dictionary = encounter.get("encounters", {})
	for raw_id: String in definition.encounter_ids:
		var encounter_id := StringName(raw_id)
		_expect(encounter_snapshots.has(String(encounter_id)), "%s snapshot includes encounter %s" % [label, encounter_id])
		var entry: Dictionary = encounter_snapshots.get(String(encounter_id), {})
		_expect(bool(entry.get("valid", false)), "%s encounter %s has a valid runtime contract" % [label, encounter_id])
	var live_ids := _get_live_entity_ids(game)
	var dungeon := game.get_node_or_null("Level") as DungeonLevel
	var metadata: Dictionary = dungeon.level_data.get("metadata", {}) if dungeon != null else {}
	var layout_entities: Array = dungeon.level_data.get("entities", []) if dungeon != null and dungeon.level_data.get("entities", []) is Array else []
	var deferred_enemy_ids := _get_deferred_enemy_ids(metadata, layout_entities)
	if bool(metadata.get("chapter_2_director", false)):
		var director: Dictionary = snapshot.get("chapter_2_spawn_director", {})
		var live_marker_count := 0
		for marker_id: StringName in expected_markers:
			if live_ids.has(String(marker_id)):
				live_marker_count += 1
			else:
				_expect(
					deferred_enemy_ids.has(String(marker_id)),
					"%s keeps only queue-deferred Chapter 2 marker %s out of the first active batch" % [label, marker_id],
				)
		_expect(
			live_marker_count == int(director.get("alive", -1))
				and live_marker_count > 0
				and live_marker_count <= int(director.get("active_cap", 0)),
			"%s encounter tracks exactly the Chapter 2 director's capped live batch" % label,
		)
	else:
		for marker_id: StringName in expected_markers:
			if deferred_enemy_ids.has(String(marker_id)):
				_expect(not live_ids.has(String(marker_id)), "%s keeps deferred branch marker %s absent until physical choice" % [label, marker_id])
			else:
				_expect(live_ids.has(String(marker_id)), "%s spawns tracked marker %s" % [label, marker_id])
	if metadata.has("branch_enemy_ids"):
		var special: Dictionary = snapshot.get("special_objective", {})
		_expect(bool(special.get("configured", false)) and String(special.get("selected_branch", "")).is_empty(), "%s installs its branch runtime without preselecting content" % label)
	elif not String(metadata.get("crimson_reaper_id", "")).is_empty():
		var special: Dictionary = snapshot.get("special_objective", {})
		_expect(bool(special.get("configured", false)) and not bool(special.get("boss_spawned", true)) and int(special.get("activated_seals", -1)) == 0, "%s installs its three-seal runtime without spawning the named Elite" % label)


func _get_deferred_enemy_ids(metadata: Dictionary, authored_entities: Array = []) -> Array:
	var result: Array = []
	if bool(metadata.get("chapter_2_director", false)):
		for raw_entity: Variant in authored_entities:
			if not raw_entity is Dictionary:
				continue
			var entity: Dictionary = raw_entity
			if bool(entity.get("chapter_2_directed", false)) and bool(entity.get("deferred_spawn", false)):
				var deferred_id := String(entity.get("id", ""))
				if not deferred_id.is_empty() and not result.has(deferred_id):
					result.append(deferred_id)
		return result
	var branch_value: Variant = metadata.get("branch_enemy_ids", [])
	if branch_value is Array:
		result.append_array(branch_value as Array)
	var crimson_reaper_id := String(metadata.get("crimson_reaper_id", ""))
	if not crimson_reaper_id.is_empty() and not result.has(crimson_reaper_id):
		result.append(crimson_reaper_id)
	return result


func _get_chapter_two_directed_enemy_ids(authored_entities: Array) -> Array:
	var result: Array = []
	for raw_entity: Variant in authored_entities:
		if not raw_entity is Dictionary:
			continue
		var entity: Dictionary = raw_entity
		if not bool(entity.get("chapter_2_directed", false)):
			continue
		var entity_id := String(entity.get("id", ""))
		if not entity_id.is_empty() and not result.has(entity_id):
			result.append(entity_id)
	return result


func _get_expected_enemy_markers(definition: LevelDefinition) -> Array[StringName]:
	var result: Array[StringName] = []
	var seen := {}
	for raw_encounter_id: String in definition.encounter_ids:
		var encounter := CAMPAIGN_REGISTRY.find_encounter(StringName(raw_encounter_id))
		if encounter == null:
			continue
		for wave: EncounterWaveDefinition in encounter.waves:
			if wave == null:
				continue
			for group: EncounterGroupDefinition in wave.groups:
				if group == null:
					continue
				for entry: EncounterSpawnEntry in group.spawn_entries:
					if entry == null:
						continue
					var marker_count := mini(entry.count, entry.spawn_marker_ids.size())
					for marker_index: int in marker_count:
						var marker_id := StringName(entry.spawn_marker_ids[marker_index])
						if not seen.has(marker_id):
							seen[marker_id] = true
							result.append(marker_id)
	return result


func _get_live_entity_ids(game: Node) -> Dictionary:
	var result := {}
	var entity_root := game.get_node_or_null("Level/Entities")
	if entity_root == null:
		return result
	for child: Node in entity_root.get_children():
		var entity_id := String(child.get_meta(&"level_entity_id", ""))
		if not entity_id.is_empty():
			result[entity_id] = true
	return result


func _get_gameplay_route() -> Node:
	var route_host := _app_root.get_node_or_null("RouteHost")
	if route_host == null or route_host.get_child_count() != 1:
		return null
	var route := route_host.get_child(0)
	return route if route.has_method(&"get_runtime_snapshot") else null


func _reward_projection(snapshot: Dictionary) -> Dictionary:
	var progression: Dictionary = snapshot.get("progression", {})
	var campaign: Dictionary = progression.get("campaign", {})
	return {
		"currencies": (snapshot.get("currencies", {}) as Dictionary).duplicate(true),
		"inventory": (snapshot.get("inventory", {}) as Dictionary).duplicate(true),
		"hero_souls": (snapshot.get("hero_souls", {}) as Dictionary).duplicate(true),
		"completed_levels": (campaign.get("completed_levels", {}) as Dictionary).duplicate(true),
		"applied_transactions": (snapshot.get("applied_transactions", {}) as Dictionary).duplicate(true),
	}


func _load_json(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	return parsed if parsed is Dictionary else {}


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error("CAMPAIGN ENTRY RUNTIME FAIL: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("CAMPAIGN ENTRY RUNTIME PASSED - %d checks across every CAMPAIGN_READY level" % _checks)
		get_tree().quit(0)
		return
	print("CAMPAIGN ENTRY RUNTIME FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(1)
