extends SceneTree

const CAMPAIGN: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)
const Configurator := preload(
	"res://game/characters/enemies/enemy_runtime_configurator.gd"
)
const DifficultyScaler := preload(
	"res://game/characters/enemies/enemy_difficulty_scaler.gd"
)
const PackRules := preload(
	"res://game/content/encounters/encounter_pack_rules.gd"
)

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	root.size = Vector2i(640, 360)
	var game_scene := load("res://game/main.tscn") as PackedScene
	_expect(game_scene != null, "Production Main scene loads")
	if game_scene == null:
		_finish(null)
		return
	var game := game_scene.instantiate() as Node2D
	root.add_child(game)
	await process_frame
	await physics_frame

	_test_live_main_uses_bound_definitions(game)
	_test_data_only_enemy_extension(game)
	_test_explicit_definition_and_fail_closed_alias(game)
	_test_canonical_definition_hot_reload_replaces_actor(game)
	_test_synthetic_pack_identity_is_not_stale()
	_finish(game)


func _test_live_main_uses_bound_definitions(game: Node) -> void:
	var entity_root := game.get_node("Level/Entities")
	var bound_count := 0
	for child: Node in entity_root.get_children():
		var definition_id := StringName(child.get_meta(Configurator.DEFINITION_ID_META, ""))
		if definition_id.is_empty():
			continue
		bound_count += 1
		var definition := CAMPAIGN.find_enemy(definition_id)
		var snapshot := Configurator.get_bound_snapshot(child)
		_expect(definition != null, "Live Main enemy resolves to a campaign definition")
		_expect(snapshot != null and snapshot.enemy_id == definition_id, "Live Main enemy carries a typed bound snapshot")
		if definition == null or snapshot == null:
			continue
		_expect(
			child.scene_file_path == definition.base_scene.resource_path,
			"Main instantiates the scene owned by EnemyDefinition '%s'" % definition_id,
		)
		_expect_close(snapshot.max_health, definition.max_health, "Live authored HP snapshot")
		_expect_close(snapshot.attack_damage, definition.attack_damage, "Live authored damage snapshot")
	_expect(bound_count > 0, "Production Main materializes enemies through the definition configurator")

	var skeleton := _first_bound_enemy(entity_root, &"skeleton_swordsman")
	_expect(skeleton != null, "Production level includes a definition-bound Skeleton")
	if skeleton != null:
		var provenance := DifficultyScaler.get_authored_damage_provenance(skeleton)
		var entry: Dictionary = provenance.get(
			String(DifficultyScaler.PROPERTY_CONTACT_DAMAGE_CHANNEL),
			{},
		)
		_expect_close(
			float(entry.get("base", -1.0)),
			CAMPAIGN.find_enemy(&"skeleton_swordsman").attack_damage,
			"Main captures canonical Skeleton damage before difficulty",
		)


func _test_data_only_enemy_extension(game: Node) -> void:
	var definition := CAMPAIGN.find_enemy(&"skeleton_swordsman").duplicate(true) as EnemyDefinition
	definition.enemy_id = &"runtime_data_enemy"
	definition.layout_type_ids = PackedStringArray(["runtime_data_layout"])
	definition.display_name = "Runtime Data Enemy"
	definition.max_health = 123.0
	definition.movement_speed = 91.0
	definition.attack_range = 64.0
	definition.awareness_range = 250.0
	definition.attack_cooldown_seconds = 1.4
	definition.attack_damage = 27.0
	definition.score_reward = 777
	definition.density_eligible = true
	var registry := LevelRegistry.new()
	registry.registry_id = &"runtime_data_registry"
	var definitions: Array[EnemyDefinition] = [definition]
	registry.enemy_definitions = definitions
	registry.rebuild_index()
	game.set("_active_content_registry", registry)

	var published_types: Array = game.call(&"_enemy_entity_types")
	_expect("runtime_data_layout" in published_types, "Main derives a new layout alias from registry data")
	_expect("runtime_data_enemy" in published_types, "Main also accepts the new canonical enemy ID")
	_expect(game.call(&"_is_density_eligible_enemy_type", "runtime_data_layout"), "Main derives density eligibility from the new definition")

	var entity := {
		"id": "runtime_data_spawn",
		"type": "runtime_data_layout",
		"position": [144.0, 144.0],
		"patrol": 33.0,
		"objective_bound": true,
	}
	var instance := game.call(&"_instantiate_level_entity", entity) as Node2D
	_expect(instance != null, "Main spawns a newly registered enemy without a scene-map code edit")
	if instance == null:
		return
	var snapshot := Configurator.get_bound_snapshot(instance)
	_expect(snapshot != null and snapshot.enemy_id == definition.enemy_id, "New data-only enemy binds its runtime snapshot")
	_expect(instance.scene_file_path == definition.base_scene.resource_path, "New data-only enemy uses its definition scene")
	_expect_close(snapshot.max_health, 123.0, "New data-only enemy authored HP")
	_expect_close(snapshot.movement_speed, 91.0, "New data-only enemy authored speed")
	_expect_close(snapshot.attack_range, 64.0, "New data-only enemy authored range")
	_expect_close(snapshot.attack_damage, 27.0, "New data-only enemy authored damage")
	var provenance := DifficultyScaler.get_authored_damage_provenance(instance)
	var entry: Dictionary = provenance.get(
		String(DifficultyScaler.PROPERTY_CONTACT_DAMAGE_CHANNEL),
		{},
	)
	_expect_close(float(entry.get("base", -1.0)), 27.0, "New data-only enemy difficulty provenance starts from definition damage")
	instance.free()


func _test_explicit_definition_and_fail_closed_alias(game: Node) -> void:
	var explicit_entity := {
		"id": "explicit_definition_spawn",
		"type": "future_layout_without_alias",
		"enemy_definition_id": "runtime_data_enemy",
		"position": [160.0, 144.0],
		"objective_bound": true,
	}
	var explicit_instance := game.call(
		&"_instantiate_level_entity",
		explicit_entity,
	) as Node2D
	_expect(explicit_instance != null, "Explicit enemy_definition_id takes priority over layout alias lookup")
	if explicit_instance != null:
		_expect(
			explicit_instance.get_meta(Configurator.DEFINITION_ID_META, &"") == &"runtime_data_enemy",
			"Explicitly resolved actor keeps the requested canonical ID",
		)
		explicit_instance.free()

	var errors_before := (game.call(&"get_enemy_authority_errors") as PackedStringArray).size()
	var missing: Variant = game.call(&"_instantiate_level_entity", {
		"id": "missing_campaign_alias",
		"type": "unregistered_enemy_layout",
		"position": [176.0, 144.0],
	})
	_expect(missing == null, "Campaign enemy with no registry alias fails closed instead of using a fallback scene")
	var errors_after: PackedStringArray = game.call(&"get_enemy_authority_errors")
	_expect(errors_after.size() == errors_before + 1, "Campaign fail-closed path publishes one auditable authority error")
	_expect("unregistered_enemy_layout" in errors_after[-1], "Authority error identifies the missing layout alias")


func _test_canonical_definition_hot_reload_replaces_actor(game: Node) -> void:
	var registry := game.get("_active_content_registry") as LevelRegistry
	var first_definition := registry.find_enemy(&"runtime_data_enemy")
	var second_definition := first_definition.duplicate(true) as EnemyDefinition
	second_definition.enemy_id = &"runtime_data_enemy_v2"
	second_definition.layout_type_ids = PackedStringArray(["runtime_data_layout_v2"])
	second_definition.display_name = "Runtime Data Enemy V2"
	second_definition.attack_damage = 31.0
	registry.enemy_definitions.append(second_definition)
	registry.rebuild_index()

	var first_entity := {
		"id": "hot_reload_enemy",
		"type": "stable_hot_reload_layout",
		"enemy_definition_id": "runtime_data_enemy",
		"position": [192.0, 144.0],
		"objective_bound": true,
	}
	game.set("_runtime_entities_cache", [first_entity])
	game.set("_runtime_plan_ready", true)
	game.call(&"_spawn_level_entities")
	var entity_root := game.get_node("Level/Entities")
	var first_actor := _managed_entity(entity_root, "hot_reload_enemy")
	_expect(first_actor != null, "Hot-reload fixture spawns its first canonical actor")
	if first_actor == null:
		return
	var first_instance_id := first_actor.get_instance_id()
	_expect(
		first_actor.get_meta(Configurator.DEFINITION_ID_META, &"") == &"runtime_data_enemy",
		"Hot-reload fixture starts from canonical definition A",
	)

	var second_entity := first_entity.duplicate(true)
	second_entity["enemy_definition_id"] = "runtime_data_enemy_v2"
	game.set("_runtime_entities_cache", [second_entity])
	game.set("_runtime_plan_ready", true)
	game.call(&"_spawn_level_entities")
	var second_actor := _managed_entity(entity_root, "hot_reload_enemy")
	_expect(second_actor != null, "Changing only enemy_definition_id respawns the managed actor")
	if second_actor == null:
		return
	_expect(second_actor.get_instance_id() != first_instance_id, "Canonical definition mismatch replaces instead of rebinding a scaled actor")
	_expect(
		second_actor.get_meta(Configurator.DEFINITION_ID_META, &"") == &"runtime_data_enemy_v2",
		"Replacement actor binds canonical definition B",
	)
	var snapshot := Configurator.get_bound_snapshot(second_actor)
	_expect(snapshot != null and is_equal_approx(snapshot.attack_damage, 31.0), "Replacement actor receives definition B stats")
	var provenance := DifficultyScaler.get_authored_damage_provenance(second_actor)
	var entry: Dictionary = provenance.get(
		String(DifficultyScaler.PROPERTY_CONTACT_DAMAGE_CHANNEL),
		{},
	)
	_expect_close(float(entry.get("base", -1.0)), 31.0, "Replacement actor recaptures definition B provenance before difficulty")


func _test_synthetic_pack_identity_is_not_stale() -> void:
	var authored := [{
		"id": "source_enemy",
		"type": "skeleton",
		"enemy_definition_id": "skeleton_swordsman",
		"position": [80.0, 80.0],
	}]
	var metadata := {
		"encounter_pack_model": {
			"enabled": true,
			"floor_count": 1,
			"packs_per_floor_override": 1,
			"members_per_pack_override": 2,
			"allow_difficulty_extra_packs": false,
			"anchor_camp_ids": ["floor_one"],
		},
		"combat_camps": [{
			"id": "floor_one",
			"floor": 1,
			"enemy_ids": ["source_enemy"],
		}],
	}
	var projected := PackRules.project_runtime_entities(
		authored,
		metadata,
		1,
		&"easy",
		"enemy_authority_test_run",
		["skeleton", "skeleton_reaper", "vampire"],
		[],
	)
	var synthetic_count := 0
	for raw_entity: Variant in projected:
		if not raw_entity is Dictionary:
			continue
		var entity: Dictionary = raw_entity
		if not bool(entity.get("runtime_pack_member", false)):
			continue
		synthetic_count += 1
		_expect(
			not entity.has("enemy_definition_id"),
			"Synthetic family roll never inherits a stale canonical definition ID",
		)
	_expect(synthetic_count == 1, "Synthetic identity fixture creates exactly one runtime pack member")


func _first_bound_enemy(entity_root: Node, definition_id: StringName) -> Node:
	for child: Node in entity_root.get_children():
		if child.get_meta(Configurator.DEFINITION_ID_META, &"") == definition_id:
			return child
	return null


func _managed_entity(entity_root: Node, entity_id: String) -> Node:
	for child: Node in entity_root.get_children():
		if String(child.get_meta(&"level_entity_id", "")) == entity_id:
			return child
	return null


func _expect_close(actual: float, expected: float, label: String) -> void:
	_expect(is_equal_approx(actual, expected), "%s expected %.4f, got %.4f" % [label, expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish(game: Node) -> void:
	if game != null:
		game.free()
	if _failures.is_empty():
		print("MAIN ENEMY AUTHORITY INTEGRATION TEST PASSED - %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("MAIN ENEMY AUTHORITY INTEGRATION TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)
