extends SceneTree

const CAMPAIGN: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)
const SANDBOX: LevelRegistry = preload(
	"res://data/content/registries/sandbox_content_registry.tres"
)
const Configurator := preload(
	"res://game/characters/enemies/enemy_runtime_configurator.gd"
)
const DifficultyScaler := preload(
	"res://game/characters/enemies/enemy_difficulty_scaler.gd"
)

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var stage := Node2D.new()
	stage.process_mode = Node.PROCESS_MODE_DISABLED
	get_root().add_child(stage)
	_test_alias_index_and_density_policy()
	_test_snapshot_detaches_from_authoring_resource()
	for definition: EnemyDefinition in CAMPAIGN.enemy_definitions:
		_test_bound_actor(stage, definition)
	_test_definition_overrides_scene_defaults(stage)
	_test_named_boss_ratios()
	_test_alias_collision_validation()
	stage.free()
	_finish()


func _test_alias_index_and_density_policy() -> void:
	var expected_aliases := {
		&"skeleton": &"skeleton_swordsman",
		&"skeleton_reaper": &"bone_reaper",
		&"vampire": &"blood_vampire",
		&"bone_reaper_captain": &"bone_reaper_captain",
		&"hooded_archer_miniboss": &"hooded_archer_miniboss",
		&"crimson_reaper": &"crimson_reaper",
		&"vampire_castellan": &"vampire_castellan",
	}
	for layout_type: StringName in expected_aliases:
		var definition := CAMPAIGN.find_enemy_by_layout_type(layout_type)
		_expect(
			definition != null and definition.enemy_id == expected_aliases[layout_type],
			"Campaign layout alias '%s' resolves to its canonical definition" % layout_type,
		)
		_expect(
			CAMPAIGN.find_enemy(expected_aliases[layout_type]) == definition,
			"Canonical enemy lookup and layout lookup share one definition for '%s'" % layout_type,
		)

	var all_types := CAMPAIGN.get_layout_enemy_types()
	var density_types := CAMPAIGN.get_density_eligible_layout_types()
	var excluded_types := CAMPAIGN.get_density_excluded_layout_types()
	for definition: EnemyDefinition in CAMPAIGN.enemy_definitions:
		_expect(
			not definition.layout_type_ids.is_empty(),
			"Production enemy '%s' explicitly covers at least one live layout type" % definition.enemy_id,
		)
		for layout_type: String in definition.get_layout_type_ids():
			_expect(all_types.has(layout_type), "Registry publishes layout type '%s'" % layout_type)
			_expect(
				(density_types if definition.density_eligible else excluded_types).has(layout_type),
				"Layout type '%s' follows its authored density policy" % layout_type,
			)
			_expect(
				not (excluded_types if definition.density_eligible else density_types).has(layout_type),
				"Layout type '%s' appears in only one density partition" % layout_type,
			)

	var sandbox_skeleton := SANDBOX.find_enemy_by_layout_type(&"skeleton")
	_expect(
		sandbox_skeleton != null and sandbox_skeleton.enemy_id == &"skeleton_chaser_sandbox",
		"A separate registry may map the same layout alias to its sandbox identity",
	)


func _test_snapshot_detaches_from_authoring_resource() -> void:
	var source := CAMPAIGN.find_enemy(&"skeleton_swordsman").duplicate(true) as EnemyDefinition
	var snapshot := source.build_runtime_snapshot()
	var authored_health := snapshot.max_health
	var authored_aliases := snapshot.layout_type_ids.duplicate()
	source.max_health = 999.0
	source.layout_type_ids.append("mutated_after_snapshot")
	_expect(
		is_equal_approx(snapshot.max_health, authored_health),
		"Runtime snapshot does not retain mutable health authority from its Resource",
	)
	_expect(
		snapshot.layout_type_ids == authored_aliases,
		"Runtime snapshot copies alias arrays instead of sharing authoring storage",
	)


func _test_bound_actor(stage: Node2D, definition: EnemyDefinition) -> void:
	var enemy := Configurator.instantiate_bound(definition)
	_expect(enemy != null, "Definition '%s' instantiates through the authority seam" % definition.enemy_id)
	if enemy == null:
		return
	var snapshot := Configurator.get_bound_snapshot(enemy)
	_expect(snapshot != null and snapshot.enemy_id == definition.enemy_id, "Bound actor keeps its typed runtime snapshot")
	_expect(enemy.get_meta(Configurator.DEFINITION_ID_META, &"") == definition.enemy_id, "Bound actor publishes canonical definition metadata")
	_expect(enemy.get_meta(&"runtime_enemy_id", &"") == definition.enemy_id, "Bound actor runtime ID comes from the definition")
	_expect(bool(enemy.get_meta(&"enemy_density_eligible", not definition.density_eligible)) == definition.density_eligible, "Bound actor carries the definition density policy")
	stage.add_child(enemy)
	_expect(int(enemy.get("max_health")) == roundi(definition.max_health), "'%s' HP is definition-authored after _ready" % definition.enemy_id)
	_expect(int(enemy.get("health")) == roundi(definition.max_health), "'%s' enters play at canonical full HP" % definition.enemy_id)

	match definition.enemy_id:
		&"skeleton_swordsman":
			_expect(int(enemy.get("contact_damage")) == roundi(definition.attack_damage), "Skeleton damage is definition-authored")
			_expect_close(float(enemy.get("chase_speed")), definition.movement_speed, "Skeleton chase speed")
			_expect_close(float(enemy.get("detection_range")), definition.awareness_range, "Skeleton awareness")
			_expect_close(float(enemy.get("attack_range")), definition.attack_range, "Skeleton attack range")
			_expect_close(float(enemy.get("attack_cooldown")), definition.attack_cooldown_seconds, "Skeleton cooldown")
			_expect(int(enemy.get("score_reward")) == definition.score_reward, "Skeleton score is definition-authored")
		&"bone_reaper", &"blood_vampire", &"bone_reaper_captain", &"crimson_reaper":
			var profile: Dictionary = enemy.call(&"get_combat_profile")
			_assert_profile_matches_definition(profile, definition)
		&"hooded_archer_miniboss":
			var profile: Dictionary = enemy.call(&"get_combat_profile")
			_expect_close(float(profile.get("move_speed", -1.0)), definition.movement_speed, "Archer movement")
			_expect_close(float(profile.get("ability_range", -1.0)), definition.attack_range, "Archer attack range")
			_expect_close((float(profile.get("preferred_min", 0.0)) + float(profile.get("preferred_max", 0.0))) * 0.5, definition.preferred_range, "Archer preferred range center")
			_expect_close(float(profile.get("telegraph", -1.0)), definition.telegraph_seconds, "Archer base telegraph")
			_expect(int(profile.get("damage", -1)) == roundi(definition.attack_damage), "Archer quick shot starts from definition damage")
			_expect(int(enemy.get("score_reward")) == definition.score_reward, "Archer score is definition-authored")
		&"vampire_castellan":
			var runtime: Dictionary = enemy.call(&"get_runtime_snapshot")
			_expect_close(float(runtime.get("movement_speed", -1.0)), definition.movement_speed, "Castellan movement")
			_expect_close(float(runtime.get("preferred_range", -1.0)), definition.preferred_range, "Castellan preferred range")
			_expect_close(float(runtime.get("attack_range", -1.0)), definition.attack_range, "Castellan attack range")
			_expect_close(float(runtime.get("telegraph", -1.0)), definition.telegraph_seconds, "Castellan telegraph")
			_expect_close(float(runtime.get("recovery", -1.0)), definition.recovery_seconds, "Castellan recovery")
			_expect_close(float(runtime.get("attack_damage", -1.0)), definition.attack_damage, "Castellan base damage")
			_expect(int(runtime.get("score", -1)) == definition.score_reward, "Castellan score is definition-authored")
	enemy.free()


func _assert_profile_matches_definition(profile: Dictionary, definition: EnemyDefinition) -> void:
	_expect(int(profile.get("max_health", -1)) == roundi(definition.max_health), "'%s' profile HP matches definition" % definition.enemy_id)
	_expect(int(profile.get("damage", -1)) == roundi(definition.attack_damage), "'%s' profile damage matches definition" % definition.enemy_id)
	_expect(int(profile.get("score", -1)) == definition.score_reward, "'%s' profile score matches definition" % definition.enemy_id)
	_expect_close(float(profile.get("chase_speed", -1.0)), definition.movement_speed, "'%s' movement" % definition.enemy_id)
	_expect_close(float(profile.get("detection", -1.0)), definition.awareness_range, "'%s' awareness" % definition.enemy_id)
	_expect_close(float(profile.get("ability_range", -1.0)), definition.attack_range, "'%s' attack range" % definition.enemy_id)
	_expect_close((float(profile.get("preferred_min", 0.0)) + float(profile.get("preferred_max", 0.0))) * 0.5, definition.preferred_range, "'%s' preferred range center" % definition.enemy_id)
	_expect_close(float(profile.get("telegraph", -1.0)), definition.telegraph_seconds, "'%s' telegraph" % definition.enemy_id)
	_expect_close(float(profile.get("recovery", -1.0)), definition.recovery_seconds, "'%s' recovery" % definition.enemy_id)
	_expect_close(float(profile.get("cooldown", -1.0)), definition.attack_cooldown_seconds, "'%s' cooldown" % definition.enemy_id)


func _test_definition_overrides_scene_defaults(stage: Node2D) -> void:
	var custom := CAMPAIGN.find_enemy(&"skeleton_swordsman").duplicate(true) as EnemyDefinition
	custom.max_health = 123.0
	custom.movement_speed = 91.0
	custom.attack_range = 64.0
	custom.awareness_range = 250.0
	custom.attack_cooldown_seconds = 1.4
	custom.attack_damage = 27.0
	custom.score_reward = 777
	var skeleton := Configurator.instantiate_bound(custom) as SkeletonEnemy
	_expect(skeleton != null and skeleton.max_health == 123 and skeleton.contact_damage == 27, "Pre-tree binding replaces Skeleton scene defaults")
	var provenance := DifficultyScaler.get_authored_damage_provenance(skeleton)
	var property_entry: Dictionary = provenance.get(String(DifficultyScaler.PROPERTY_CONTACT_DAMAGE_CHANNEL), {})
	_expect_close(float(property_entry.get("base", -1.0)), 27.0, "Skeleton provenance captures canonical definition damage before _ready")
	stage.add_child(skeleton)
	_expect_close(float((DifficultyScaler.get_authored_damage_provenance(skeleton).get(String(DifficultyScaler.PROPERTY_CONTACT_DAMAGE_CHANNEL), {}) as Dictionary).get("base", -1.0)), 27.0, "Skeleton _ready cannot overwrite canonical provenance")
	skeleton.free()

	var reaper_definition := CAMPAIGN.find_enemy(&"bone_reaper").duplicate(true) as EnemyDefinition
	reaper_definition.attack_damage = 27.0
	var reaper := Configurator.instantiate_bound(reaper_definition) as AdvancedDungeonEnemy
	var reaper_provenance := DifficultyScaler.get_authored_damage_provenance(reaper)
	var profile_entry: Dictionary = reaper_provenance.get(String(DifficultyScaler.PROFILE_DAMAGE_CHANNEL), {})
	_expect_close(float(profile_entry.get("base", -1.0)), 27.0, "Advanced enemy provenance captures definition damage, not its hardcoded family default")
	reaper.free()

	# Fallback path: an actor already ran _ready(), but difficulty has not yet
	# projected. Configurator must discard stale scene provenance and recapture.
	var late_bound := custom.base_scene.instantiate() as SkeletonEnemy
	stage.add_child(late_bound)
	var stale := DifficultyScaler.get_authored_damage_provenance(late_bound)
	var stale_entry: Dictionary = stale.get(String(DifficultyScaler.PROPERTY_CONTACT_DAMAGE_CHANNEL), {})
	_expect_close(float(stale_entry.get("base", -1.0)), 14.0, "Raw scene demonstrates the stale authored default before late binding")
	_expect(Configurator.apply_definition(late_bound, custom), "Configurator supports safe post-ready/pre-difficulty binding")
	var repaired := DifficultyScaler.get_authored_damage_provenance(late_bound)
	var repaired_entry: Dictionary = repaired.get(String(DifficultyScaler.PROPERTY_CONTACT_DAMAGE_CHANNEL), {})
	_expect_close(float(repaired_entry.get("base", -1.0)), 27.0, "Late binding replaces stale provenance with canonical definition damage")
	late_bound.free()


func _test_named_boss_ratios() -> void:
	var archer_definition := CAMPAIGN.find_enemy(&"hooded_archer_miniboss").duplicate(true) as EnemyDefinition
	archer_definition.attack_damage = 24.0
	archer_definition.attack_range = 720.0
	archer_definition.awareness_range = 720.0
	var archer := Configurator.instantiate_bound(archer_definition)
	_expect(int(archer.call(&"get_authored_action_damage", &"quick")) == 24, "Archer quick ratio preserves the new base")
	_expect(int(archer.call(&"get_authored_action_damage", &"pierce")) == 36, "Archer pierce remains a named 1.5x action")
	_expect(int(archer.call(&"get_authored_action_damage", &"mark")) == 40, "Archer mark remains a named 5/3x action")
	_expect_close(float(archer.call(&"get_authored_action_range", &"quick")), 640.0, "Archer quick range derives from definition base range")
	_expect_close(float(archer.call(&"get_authored_action_range", &"pierce")), 720.0, "Archer pierce range derives from definition base range")
	archer.free()

	var castellan_definition := CAMPAIGN.find_enemy(&"vampire_castellan").duplicate(true) as EnemyDefinition
	castellan_definition.attack_damage = 28.0
	var castellan := Configurator.instantiate_bound(castellan_definition)
	_expect(int(castellan.call(&"get_authored_action_damage", &"blood_lunge", 1)) == 28, "Castellan phase-one lunge uses the new base")
	_expect(int(castellan.call(&"get_authored_action_damage", &"blood_lunge", 2)) == 32, "Castellan phase-two lunge keeps its named ratio")
	_expect(int(castellan.call(&"get_authored_action_damage", &"blink_lanes", 2)) == 36, "Castellan blink lanes keep their named ratio")
	_expect(int(castellan.call(&"get_authored_action_damage", &"disc_fan", 2)) == 20, "Castellan disc fan keeps its named ratio")
	castellan.free()


func _test_alias_collision_validation() -> void:
	var first := CAMPAIGN.find_enemy(&"skeleton_swordsman").duplicate(true) as EnemyDefinition
	var second := CAMPAIGN.find_enemy(&"bone_reaper").duplicate(true) as EnemyDefinition
	first.enemy_id = &"alias_owner_one"
	second.enemy_id = &"alias_owner_two"
	first.layout_type_ids = PackedStringArray(["shared_layout_type"])
	second.layout_type_ids = PackedStringArray(["shared_layout_type"])
	var registry := LevelRegistry.new()
	registry.registry_id = &"alias_collision_test"
	registry.enemy_definitions = [first, second]
	var found_collision := false
	for error: String in registry.get_validation_errors():
		if "shared_layout_type" in error and "shared by" in error:
			found_collision = true
	_expect(found_collision, "Registry validation rejects ambiguous layout aliases")


func _expect_close(actual: float, expected: float, label: String) -> void:
	_expect(is_equal_approx(actual, expected), "%s expected %.4f, got %.4f" % [label, expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("ENEMY DEFINITION RUNTIME AUTHORITY TEST PASSED - %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("ENEMY DEFINITION RUNTIME AUTHORITY TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)
