extends SceneTree

const MAP_PATH := "res://data/levels/chapter_1_level_5.json"
const REPORT_PATH := "res://.artifacts/chapter_1_level_5_miniboss_report.json"
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
const EncounterRuntimeStateScript := preload("res://game/content/encounters/encounter_runtime_state.gd")
const REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const CAMPAIGN_PLAN: CampaignProgressionPlan = preload("res://data/content/progression/soul_hero_campaign_plan.tres")
const ARCHER_SCENE: PackedScene = preload("res://game/characters/enemies/hooded_archer_miniboss.tscn")
const ENEMY_SCALER := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")
const QUICK_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_quick_vfx.png")
const PIERCE_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_pierce_vfx.png")
const SOUL_MARK_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_soul_mark_vfx.png")
const PHASE_BURST_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_phase_burst_vfx.png")
const QUICK_TRAIL_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_quick_trail_vfx.png")
const PIERCE_TRAIL_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_pierce_trail_vfx.png")
const MARK_PROJECTILE_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_mark_projectile_vfx.png")
const DASH_TRAIL_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_dash_trail_vfx.png")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_map_registry_roster_and_milestone_contract()
	_test_guaranteed_loot_profile_schema_contract()
	_test_archer_runtime_identity_and_counterplay_profile()
	_test_boss_death_is_not_level_completion_until_soul_pickup()
	_test_levels_one_to_four_remain_unchanged()
	_test_level_six_dependency_remains_sequential()
	_finish()


func _test_map_registry_roster_and_milestone_contract() -> void:
	var document := _load_document(MAP_PATH)
	_expect(not document.is_empty(), "Level 5 JSON loads")
	var schema := LevelSchemaValidator.validate_level(document)
	_expect(bool(schema.get("ok", false)), "Level 5 JSON passes LevelSchema: %s" % schema.get("error", ""))
	var archer_entities: Array[Dictionary] = []
	for raw_entity: Variant in document.get("entities", []):
		if raw_entity is Dictionary and String(raw_entity.get("id", "")) == "l5_hooded_archer_miniboss":
			archer_entities.append(raw_entity)
	_expect(archer_entities.size() == 1, "Level 5 has exactly one Hooded Archer runtime entity")
	if archer_entities.size() == 1:
		_expect(String(archer_entities[0].get("type", "")) == "hooded_archer_miniboss", "Archer entity resolves the dedicated loader type")

	var definition := REGISTRY.find_enemy(&"hooded_archer_miniboss")
	_expect(definition != null and definition.is_valid_definition(), "Hooded Archer has a valid registered EnemyDefinition")
	_expect(definition != null and definition.display_name == "KingdomArcher", "The Level 5 boss presents the approved KingdomArcher name")
	_expect(definition != null and definition.base_scene == ARCHER_SCENE, "Archer EnemyDefinition uses the dedicated runtime scene")
	_expect(definition != null and int(definition.max_health) == 360 and int(definition.score_reward) == 650, "Archer authored health and score match the boss specification")

	var roster := REGISTRY.find_campaign_roster(5)
	var archer_entry := roster.get_entry(&"hooded_archer") if roster != null else null
	_expect(roster != null and roster.get_total_count() == 17, "Level 5 roster contains sixteen guardians and one Archer")
	_expect(archer_entry != null and archer_entry.combatant_id == &"hooded_archer_miniboss", "Level 5 roster names the Hooded Archer combatant")
	_expect(archer_entry != null and archer_entry.unique and archer_entry.miniboss and not archer_entry.elite_eligible, "Archer is unique, miniboss-tagged, and never elite-promoted")

	var milestone := CAMPAIGN_PLAN.find_milestone(&"chapter_1_level_5_archer_recruitment")
	_expect(milestone != null and milestone.boss_enemy_id == &"hooded_archer_miniboss", "Archer recruitment listens for the Hooded Archer boss identity")
	_expect(milestone != null and milestone.recruited_hero_id == &"archer_hero", "The physical pickup recruits Archer rather than Axe")
	_expect(milestone != null and not milestone.assign_recruited_hero_to_first_reserve, "Pickup ownership never silently edits the player's team")


func _test_guaranteed_loot_profile_schema_contract() -> void:
	var document := _load_document(MAP_PATH)
	var boss_index := -1
	for index: int in (document.get("entities", []) as Array).size():
		var raw_entity: Variant = (document.get("entities", []) as Array)[index]
		if raw_entity is Dictionary \
				and String((raw_entity as Dictionary).get("id", "")) == "l5_hooded_archer_miniboss":
			boss_index = index
			break
	_expect(boss_index >= 0, "Schema fixture resolves the authored Archer boss entity")
	if boss_index < 0:
		return

	var string_name_document := document.duplicate(true)
	(string_name_document.entities[boss_index] as Dictionary)["guaranteed_loot_profile"] = \
		&"level_5_archer_soul"
	_expect(
		bool(LevelSchemaValidator.validate_level(string_name_document).get("ok", false)),
		"Schema accepts a registered enemy loot-profile field represented as StringName",
	)

	var invalid_type_document := document.duplicate(true)
	(invalid_type_document.entities[boss_index] as Dictionary)["guaranteed_loot_profile"] = {
		"id": "level_5_archer_soul",
	}
	var invalid_type := LevelSchemaValidator.validate_level(invalid_type_document)
	_expect(
		not bool(invalid_type.get("ok", false)) \
				and String(invalid_type.get("error", "")).contains("must be a string or StringName"),
		"Schema rejects non-string guaranteed loot-profile values",
	)

	var invalid_id_document := document.duplicate(true)
	(invalid_id_document.entities[boss_index] as Dictionary)["guaranteed_loot_profile"] = \
		"Level-5 Archer Soul"
	var invalid_id := LevelSchemaValidator.validate_level(invalid_id_document)
	_expect(
		not bool(invalid_id.get("ok", false)) \
				and String(invalid_id.get("error", "")).contains("lower_snake_case content ID"),
		"Schema rejects malformed guaranteed loot-profile IDs",
	)

	var non_enemy_document := document.duplicate(true)
	for raw_entity: Variant in non_enemy_document.get("entities", []):
		if raw_entity is Dictionary and String((raw_entity as Dictionary).get("type", "")) == "player":
			(raw_entity as Dictionary)["guaranteed_loot_profile"] = "level_5_archer_soul"
			break
	var non_enemy := LevelSchemaValidator.validate_level(non_enemy_document)
	_expect(
		not bool(non_enemy.get("ok", false)) \
				and String(non_enemy.get("error", "")).contains("unsupported field"),
		"Schema keeps guaranteed loot profiles enemy-only instead of opening a wildcard field",
	)


func _test_archer_runtime_identity_and_counterplay_profile() -> void:
	var stage := Node2D.new()
	root.add_child(stage)
	var archer := ARCHER_SCENE.instantiate() as HoodedArcherMiniboss
	stage.add_child(archer)
	_expect(archer != null and archer.get_archetype_id() == &"hooded_archer_miniboss", "Archer publishes a distinct stable runtime identity")
	_expect(archer != null and archer.get_display_name() == "KingdomArcher", "Runtime display name is KingdomArcher while the stable save/map ID remains compatible")
	_expect(archer != null and archer.is_in_group(&"minibosses") and archer.has_meta(&"miniboss_id"), "Archer is queryable as a live miniboss")
	var profile := archer.get_combat_profile() if archer != null else {}
	_expect(int(profile.get("max_health", 0)) == 360 and int(archer.health) == 360, "Archer receives its authored 360-health profile")
	_expect(int(profile.get("damage", 0)) == 12 and is_equal_approx(float(profile.get("telegraph", 0.0)), 0.44), "Quick Shot uses readable 12-damage and 0.44-second telegraph values")
	_expect(is_equal_approx(float(profile.get("preferred_min", 0.0)), 144.0) and is_equal_approx(float(profile.get("preferred_max", 0.0)), 220.0), "Archer publishes the intended punishable spacing band")
	_expect(is_equal_approx(float(profile.get("poise", 0.0)), 50.0), "Archer exposes the 50-point poise counterplay budget")
	var sprite := archer.get_node_or_null("AnimatedSprite2D") as AnimatedSprite2D
	_expect(sprite != null and sprite.sprite_frames != null and sprite.sprite_frames.has_animation(&"archer_quick_shot"), "Archer scene builds its dedicated Quick Shot animation")
	_expect(sprite != null and sprite.sprite_frames.has_animation(&"archer_armor_piercer") and sprite.sprite_frames.has_animation(&"archer_soul_mark"), "Archer scene builds Piercer and Soul Mark animations")
	archer.call(&"_set_facing", Vector2.RIGHT)
	_expect(sprite != null and not sprite.flip_h, "The right-facing source sprite stays unflipped when Archer aims right")
	archer.call(&"_set_facing", Vector2.LEFT)
	_expect(sprite != null and sprite.flip_h, "Archer flips only when aiming left")

	var aim_charge := archer.get_node_or_null("AimChargeVfx") as Sprite2D
	var soul_mark := archer.get_node_or_null("SoulMarkVfx") as Sprite2D
	archer.call(&"_enter_state", HoodedArcherMiniboss.State.QUICK_AIM)
	archer.call(&"_sync_boss_vfx")
	_expect(
		aim_charge != null and aim_charge.visible and aim_charge.texture == QUICK_VFX
			and aim_charge.position.length() < 40.0,
		"Quick Shot presents its generated charge locally at the bow without a screen-wide aim line"
	)
	_expect(archer.get_node_or_null("TelegraphVfx") == null and archer.get_node_or_null("TelegraphDangerCore") == null, "KingdomArcher intentionally has no line telegraph UI")
	archer.call(&"_enter_state", HoodedArcherMiniboss.State.PIERCE_AIM)
	archer.call(&"_sync_boss_vfx")
	_expect(aim_charge != null and aim_charge.texture == PIERCE_VFX, "Piercer swaps the bow-local charge to the generated heavy-arrow presentation")
	archer.call(&"_enter_state", HoodedArcherMiniboss.State.MARK_AIM)
	archer.call(&"_sync_boss_vfx")
	_expect(soul_mark != null and soul_mark.visible and soul_mark.texture == SOUL_MARK_VFX, "Soul Mark uses the generated world-space target sigil instead of a line or code-drawn icon")
	archer.call(&"_enter_state", HoodedArcherMiniboss.State.ESCAPE)
	archer.call(&"_sync_boss_vfx")
	var dash_trail := archer.get_node_or_null("DashTrailVfx") as Sprite2D
	_expect(dash_trail != null and dash_trail.visible and dash_trail.texture == DASH_TRAIL_VFX, "Escape uses the generated foot-skid trail rather than a fake shot line")
	archer.call(&"_spawn_radial_burst", Color.WHITE, 0.5, 0.5)
	var found_phase_burst := false
	for child: Node in stage.get_children():
		if child is Sprite2D and (child as Sprite2D).texture == PHASE_BURST_VFX:
			found_phase_burst = true
			break
	_expect(found_phase_burst, "Phase, poise-break and death feedback instantiate the generated radial burst asset")
	var hard_modifiers := ENEMY_SCALER.apply_to(archer, 5, &"hard")
	var hard_profile := archer.get_combat_profile()
	_expect(
		int(hard_profile.get("max_health", 0)) == roundi(360.0 * float(hard_modifiers.get("runtime_health_multiplier", 1.0))),
		"Hard stage projection scales the live Archer health"
	)
	_expect(
		int(hard_profile.get("damage", 0)) == roundi(12.0 * float(hard_modifiers.get("runtime_damage_multiplier", 1.0))),
		"Hard stage projection scales the Archer projectile damage"
	)
	_expect(
		is_equal_approx(float(hard_profile.get("move_speed", 0.0)), 72.0 * float(hard_modifiers.get("speed_multiplier", 1.0))),
		"Hard stage projection scales the Archer movement speed"
	)
	archer.call(&"_spawn_arrow", 12, 390.0, 320.0, 6.0)
	var spawned_arrow: ArcherEnemyArrow
	for child: Node in stage.get_children():
		if child is ArcherEnemyArrow:
			spawned_arrow = child as ArcherEnemyArrow
			break
	_expect(
		spawned_arrow != null
			and spawned_arrow.damage == 12
			and spawned_arrow.get_damage_input_kind() == ENEMY_SCALER.INPUT_KIND_AUTHORED,
		"the real Quick Shot carries authored damage so difficulty and target context resolve together at impact"
	)
	_expect(
		spawned_arrow != null
			and is_equal_approx(
				spawned_arrow.travel_speed,
				390.0 * float(hard_modifiers.get("speed_multiplier", 1.0)),
			),
		"the real Quick Shot projectile consumes the stage/difficulty speed projection",
	)
	var arrow_trail := spawned_arrow.get_node_or_null("TrailVisual") as Sprite2D if spawned_arrow != null else null
	var arrow_collision := spawned_arrow.get_node_or_null("ArrowCollision") as CollisionShape2D if spawned_arrow != null else null
	var arrow_shape := arrow_collision.shape as RectangleShape2D if arrow_collision != null else null
	_expect(arrow_trail != null and arrow_trail.texture == QUICK_TRAIL_VFX, "The live Quick Shot arrow carries the generated motion-only trail without a duplicate arrowhead")
	_expect(arrow_shape != null and is_equal_approx(arrow_shape.size.y, 6.0), "Projectile collision keeps the authored six-pixel Quick Shot width")
	archer.call(&"_spawn_arrow", 18, 520.0, 360.0, 10.0, &"pierce")
	archer.call(&"_spawn_arrow", 20, 600.0, 380.0, 16.0, &"mark")
	var pierce_trail_valid := false
	var mark_trail_valid := false
	for child: Node in stage.get_children():
		if not child is ArcherEnemyArrow:
			continue
		var typed_arrow := child as ArcherEnemyArrow
		var trail := typed_arrow.get_node_or_null("TrailVisual") as Sprite2D
		if typed_arrow.get_visual_kind() == &"pierce":
			pierce_trail_valid = trail != null and trail.texture == PIERCE_TRAIL_VFX
		elif typed_arrow.get_visual_kind() == &"mark":
			mark_trail_valid = trail != null and trail.texture == MARK_PROJECTILE_VFX
	_expect(pierce_trail_valid, "Piercer uses its heavy motion-only wake")
	_expect(mark_trail_valid, "Soul Mark release uses its distinct rune projectile aura")
	stage.queue_free()


func _test_boss_death_is_not_level_completion_until_soul_pickup() -> void:
	var level := REGISTRY.find_campaign_level(5)
	var encounter := REGISTRY.find_encounter(level.entry_encounter_id) if level != null else null
	_expect(encounter != null and encounter.waves.size() == 2, "Level 5 encounter authors guardian and Archer waves")
	var archer_group := encounter.get_group(&"level_5_hooded_archer_miniboss") if encounter != null else null
	_expect(archer_group != null and archer_group.spawn_entries.size() == 1, "Archer owns a dedicated final encounter group")
	if archer_group != null and archer_group.spawn_entries.size() == 1:
		var entry := archer_group.spawn_entries[0]
		_expect(entry.enemy_id == &"hooded_archer_miniboss" and entry.spawn_marker_ids == PackedStringArray(["l5_hooded_archer_miniboss"]), "Archer group binds the exact JSON entity")
	_expect(encounter != null and encounter.completion.required_objective_ids.has("defeat_hooded_archer_miniboss"), "Completion explicitly requires the Archer defeat objective")
	_expect(encounter != null and encounter.completion.required_objective_ids.has("collect_archer_hero_soul"), "Completion independently requires the physical Soul pickup objective")

	var runtime = EncounterRuntimeStateScript.new()
	var errors: PackedStringArray = runtime.configure(level, REGISTRY, _load_document(MAP_PATH).get("entities", []))
	_expect(errors.is_empty(), "Level 5 runtime binds every authored marker: %s" % "; ".join(errors))
	var initial: Dictionary = runtime.get_snapshot()
	_expect(int(initial.get("total_enemies", 0)) == 17 and int(initial.get("total_groups", 0)) == 4, "Runtime tracks sixteen guardians plus the Archer in four groups")
	_expect(not runtime.is_gate_unlocked(&"l5_exit"), "Level 5 exit starts locked")

	for wave: EncounterWaveDefinition in encounter.waves:
		for group: EncounterGroupDefinition in wave.groups:
			for entry: EncounterSpawnEntry in group.spawn_entries:
				for marker_id: String in entry.spawn_marker_ids:
					if marker_id != "l5_hooded_archer_miniboss":
						runtime.mark_enemy_defeated(StringName(marker_id))
	_expect(int(runtime.get_snapshot().get("defeated_enemies", 0)) == 16, "All sixteen guardians can fall while the Archer remains")
	_expect(not runtime.is_encounter_complete(encounter.encounter_id), "Guardians alone cannot complete Level 5")

	_expect(runtime.mark_enemy_defeated(&"l5_hooded_archer_miniboss"), "Archer death is accepted by the authoritative encounter runtime")
	_expect(runtime.is_group_complete(encounter.encounter_id, &"level_5_hooded_archer_miniboss"), "Archer final group completes on boss death")
	_expect(runtime.is_objective_complete(encounter.encounter_id, &"defeat_hooded_archer_miniboss"), "Archer defeat objective completes on boss death")
	_expect(not runtime.is_objective_complete(encounter.encounter_id, &"collect_archer_hero_soul"), "Boss death alone does not impersonate physical Soul collection")
	_expect(not runtime.is_encounter_complete(encounter.encounter_id) and not runtime.is_gate_unlocked(&"l5_exit"), "Exit remains locked between boss death and pickup")

	_expect(runtime.record_custom_event(&"archer_hero_soul_collected", 1), "Physical pickup event is accepted by the encounter runtime")
	_expect(runtime.is_objective_complete(encounter.encounter_id, &"collect_archer_hero_soul"), "Pickup event completes only the collection objective")
	_expect(runtime.is_encounter_complete(encounter.encounter_id) and runtime.is_gate_unlocked(&"l5_exit"), "Level 5 completes only after both combat and pickup")
	runtime.clear()


func _test_levels_one_to_four_remain_unchanged() -> void:
	var expected_totals := {1: 12, 2: 15, 3: 20, 4: 15}
	for slot: int in expected_totals:
		var level := REGISTRY.find_campaign_level(slot)
		var runtime = EncounterRuntimeStateScript.new()
		var document := _load_document(level.layout_data_path)
		var errors: PackedStringArray = runtime.configure(level, REGISTRY, document.get("entities", []))
		var snapshot: Dictionary = runtime.get_snapshot()
		_expect(errors.is_empty(), "Level %d runtime still binds with no errors" % slot)
		_expect(int(snapshot.get("total_enemies", 0)) == int(expected_totals[slot]), "Level %d keeps its exact enemy total" % slot)
		_expect(int(snapshot.get("total_groups", 0)) == 3, "Level %d keeps its three-camp completion contract" % slot)
		runtime.clear()


func _test_level_six_dependency_remains_sequential() -> void:
	var level_6 := REGISTRY.find_campaign_level(6)
	_expect(level_6 != null and level_6.is_campaign_ready(), "Level 6 remains ready after the Archer Level 5 conversion")
	_expect(level_6 != null and level_6.unlock_requirements.prerequisite_level_ids == PackedStringArray(["chapter_1_level_5"]), "Level 6 still follows Level 5 sequentially")


func _load_document(path: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed if parsed is Dictionary else {}


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error(message)


func _finish() -> void:
	var report := {
		"ok": _failures.is_empty(),
		"checks": _checks,
		"failures": _failures,
		"scope": "Level 5 KingdomArcher presentation/map/runtime and defeat-then-pickup completion contract",
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t"))
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 5 ARCHER MINIBOSS TEST PASSED - %d checks" % _checks)
	else:
		print("CHAPTER 1 LEVEL 5 ARCHER MINIBOSS TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(0 if _failures.is_empty() else 1)
