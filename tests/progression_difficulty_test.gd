extends SceneTree

const RULES := preload("res://game/meta/progression/player_progression_rules.gd")
const DIFFICULTY := preload("res://game/meta/progression/difficulty_rules.gd")
const PACING := preload("res://game/meta/progression/progression_pacing_rules.gd")
const PACK_RULES := preload("res://game/content/encounters/encounter_pack_rules.gd")
const ENEMY_SCALER := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")
const TEST_SAVE_PATH := "user://tests/progression_difficulty_test.json"
const DENSITY_ELIGIBLE_TYPES := [
	"skeleton", "skeleton_reaper", "vampire",
]

var _checks := 0
var _failures: Array[String] = []
var _xp_events: Array[Dictionary] = []
var _hero_xp_events: Array[Dictionary] = []
var _level_events: Array[Dictionary] = []
var _completion_events := 0
var SaveService: Node
var AppFlow: Node
var GameEvents: Node


class FakeAppRoot extends Node:
	var route_id: StringName = &""
	var payload: Dictionary = {}

	func show_route(_scene_path: String, next_payload: Dictionary, next_route: StringName) -> void:
		route_id = next_route
		payload = next_payload.duplicate(true)


class FakeProfileEnemy extends Node:
	var max_health := 100
	var health := 100
	var score_reward := 100
	var _profile := {
		"max_health": 100,
		"damage": 10,
		"patrol_speed": 30.0,
		"chase_speed": 50.0,
	}

	func get_combat_profile() -> Dictionary:
		return _profile.duplicate(true)

	func set_combat_profile(next_profile: Dictionary) -> bool:
		_profile = next_profile.duplicate(true)
		max_health = int(_profile.get("max_health", max_health))
		return true


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	SaveService = root.get_node("/root/SaveService")
	AppFlow = root.get_node("/root/AppFlow")
	GameEvents = root.get_node("/root/GameEvents")
	_remove_generations(TEST_SAVE_PATH)
	_expect(SaveService.configure_storage(TEST_SAVE_PATH, true), "focused profile starts from safe defaults")
	GameEvents.player_experience_changed.connect(_on_xp_changed)
	GameEvents.hero_experience_changed.connect(_on_hero_xp_changed)
	GameEvents.player_level_changed.connect(_on_level_changed)
	GameEvents.run_completion_ready.connect(_on_completion_ready)

	_test_level_and_stat_curves()
	_test_difficulty_contract()
	_test_kill_experience_pacing()
	_test_deterministic_mutants()
	_test_realtime_experience_save()
	_test_enemy_scaling()
	_test_continuous_campaign_flow()
	await _test_live_density_spawns()
	_test_inventory_grant_contract()

	AppFlow.detach_app_root(_fake_root)
	_fake_root.queue_free()
	_remove_generations(TEST_SAVE_PATH)
	if _failures.is_empty():
		print("PROGRESSION DIFFICULTY TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("PROGRESSION DIFFICULTY TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)


func _test_level_and_stat_curves() -> void:
	var empty := {"hp": 0, "damage": 0, "mana": 0}
	var level_one := RULES.stat_snapshot(1, empty)
	var level_two := RULES.stat_snapshot(2, empty)
	_expect_close(float(level_two["hp"]) - float(level_one["hp"]), 200.0, "one Hero level immediately adds 200 HP")
	_expect_close(float(level_two["damage"]) - float(level_one["damage"]), 0.0, "one player level never adds automatic Power")
	_expect_close(float(level_two["mana"]) - float(level_one["mana"]), 10.0, "one player level immediately adds ten Mana")
	var level_five := RULES.stat_snapshot(5, empty)
	var level_six := RULES.stat_snapshot(6, empty)
	_expect_close(float(level_six["hp"]) - float(level_five["hp"]), 192.119202, "the fifth completed level grants 99 percent of the prior HP marginal")
	_expect_close(float(level_six["damage"]) - float(level_five["damage"]), 0.0, "later levels also grant no automatic Power")
	_expect_close(float(level_six["mana"]) - float(level_five["mana"]), 9.6059601, "the fifth completed level grants 99 percent of the prior Mana marginal")
	_expect_close(RULES.stat_point_return(&"hp", 1), 140.0, "an invested HP point creates a strong 140-HP spike")
	_expect_close(RULES.stat_point_return(&"damage", 1), 4.0, "an invested Power point creates a four-percent spike")
	_expect_close(RULES.stat_point_return(&"mana", 1), 7.0, "an invested Mana point creates a seven-Mana spike")
	_expect(RULES.xp_required_for_level(1) == 100, "level one uses the readable 100-XP bucket")
	var multi := RULES.resolve_experience_gain(1, 90, 160)
	_expect(int(multi["level"]) == 3 and int(multi["xp"]) == 22, "XP can cross multiple buckets without losing overflow")


func _test_difficulty_contract() -> void:
	_expect(DIFFICULTY.normalize_id(&"HARD") == &"hard", "difficulty IDs normalize case")
	_expect(DIFFICULTY.normalize_id(&"unknown") == &"easy", "unknown difficulty fails safely to Easy")
	var easy := DIFFICULTY.get_modifiers(&"easy")
	var hard := DIFFICULTY.get_modifiers(&"hard")
	_expect(float(easy["spawn_quantity"]) > 1.0, "default Easy density is slightly above the authored baseline")
	_expect(float(hard["enemy_health"]) > float(easy["enemy_health"]), "Hard increases enemy HP")
	_expect(float(hard["mutant_chance"]) > float(easy["mutant_chance"]), "Hard increases mutation chance")
	_expect(float(hard["rare_drop_chance"]) > float(easy["rare_drop_chance"]), "Hard compensates with rarer loot")
	_expect(DIFFICULTY.density_bonus_count(3, &"easy") == 1, "a small safe Easy camp still receives one density enemy")
	_expect(DIFFICULTY.density_bonus_count(4, &"hard") == 2, "Hard adds fifty percent more safe camp enemies")
	var stage_one := DIFFICULTY.stage_modifiers(1, &"easy")
	var stage_ten := DIFFICULTY.stage_modifiers(10, &"easy")
	_expect(float(stage_ten["health_multiplier"]) > float(stage_one["health_multiplier"]), "enemy HP scales with campaign stage")
	_expect(float(stage_ten["damage_multiplier"]) > float(stage_one["damage_multiplier"]), "enemy damage scales with campaign stage")
	var player_growth_ten := RULES.level_growth_snapshot(10)
	_expect_close(float(stage_ten["stage_health"]), (RULES.BASE_HP + float(player_growth_ten["hp_flat"])) / RULES.BASE_HP, "enemy level HP mirrors character level HP growth")
	_expect_close(float(stage_ten["stage_damage"]), 1.0 + DIFFICULTY.enemy_stage_damage_growth_percent(10) / 100.0, "enemy stage damage owns an independent pressure curve")
	_expect_close(float(stage_ten["stage_damage"]), 1.432413624402, "enemy stage damage preserves its pre-Power level-ten value")
	_expect(int(stage_ten.get("stage_growth_surges", -1)) == 0, "enemy stage metadata retires numeric growth surges")
	_expect(String(stage_ten.get("stage_growth_curve", "")) == "geometric_decay", "enemy stage metadata identifies the mirrored growth curve")
	_expect_close(float(stage_ten.get("stage_growth_decay", 0.0)), 0.99, "enemy stage metadata exposes the one-percent marginal decay")
	_expect(String(stage_ten.get("stage_damage_growth_curve", "")) == "independent_geometric_decay", "enemy damage metadata proves it is decoupled from player level")


func _test_kill_experience_pacing() -> void:
	var previous_ordinary_budget := 0.0
	for stage: int in range(1, 11):
		var population_context := _population_context(stage, &"easy")
		var breakdown := PACING.stage_budget_breakdown(stage, population_context)
		var easy_plan := PACK_RULES.get_pack_plan(stage, &"easy")
		var expected_budget := float(RULES.xp_required_for_level(stage)) * 0.15
		var projected_budget := (
			float(breakdown["ordinary_units_per_reference_kill"])
			* float(easy_plan["total_members"])
		)
		_expect(
			int(breakdown["canonical_easy_members"]) == int(easy_plan["total_members"]),
			"Level %d kill pacing consumes its realized level-specific Easy population" % stage,
		)
		_expect(bool(breakdown.get("valid", false)) and not String(breakdown.get("population_plan_signature", "")).is_empty(), "Level %d XP budget carries a valid signed population authority" % stage)
		_expect_close(projected_budget, expected_budget, "Level %d reference kills project to exactly fifteen percent of its XP bucket" % stage)
		_expect(projected_budget > previous_ordinary_budget, "Level %d ordinary XP budget grows monotonically with the stage bucket" % stage)
		previous_ordinary_budget = projected_budget

		var reference_units := float(breakdown["ordinary_units_per_reference_kill"])
		var reward_sequence: Array = []
		for _member_index: int in int(easy_plan["total_members"]):
			reward_sequence.append(reference_units)
		var carry_projection := PACING.project_fractional_sequence(reward_sequence)
		var repeated_projection := PACING.project_fractional_sequence(reward_sequence)
		_expect(
			JSON.stringify(carry_projection) == JSON.stringify(repeated_projection),
			"Level %d fractional XP carry is deterministic" % stage,
		)
		_expect_close(float(carry_projection["conserved_units"]), expected_budget, "Level %d carry preserves the full fractional budget" % stage)
		_expect(float(carry_projection["carry"]) >= 0.0 and float(carry_projection["carry"]) < 1.0, "Level %d can lose less than one XP when its scene exits" % stage)

	var easy_population := PACING.project_population_budget(
		1, &"easy", PACING.ORDINARY_REFERENCE_SCORE, _population_context(1, &"easy")
	)
	var hard_population := PACING.project_population_budget(
		1, &"hard", PACING.ORDINARY_REFERENCE_SCORE, _population_context(1, &"hard")
	)
	_expect_close(float(easy_population["xp_bucket_ratio"]), 0.15, "Level 1 Easy reference population pays fifteen percent supplementary XP")
	_expect(float(hard_population["expected_ordinary_units"]) > float(easy_population["expected_ordinary_units"]), "Hard density can earn proportionally more supplementary XP")
	_expect(float(hard_population["xp_bucket_ratio"]) <= 0.15 * 1.25, "early Hard density keeps supplementary XP within its encounter bound")

	var stage_three_context := _population_context(3, &"easy")
	var low_threat := PACING.project_enemy_reward(25.0, 3, false, stage_three_context)
	var reference_threat := PACING.project_enemy_reward(100.0, 3, false, stage_three_context)
	var extreme_threat := PACING.project_enemy_reward(1000000.0, 3, false, stage_three_context)
	var capped_elite_threat := PACING.project_enemy_reward(
		2500000.0,
		3,
		false,
		stage_three_context,
		2.5,
	)
	_expect(float(low_threat["reward_units"]) < float(reference_threat["reward_units"]), "ordinary XP grows smoothly with base threat score")
	_expect(float(extreme_threat["threat_weight"]) == PACING.MAX_THREAT_WEIGHT, "extreme threat scores stop at the canonical XP weight cap")
	_expect(float(extreme_threat["reward_units"]) <= float(extreme_threat["base_reward_units"]) * PACING.MAX_THREAT_WEIGHT, "bounded threat cannot consume an unbounded stage budget")
	_expect_close(
		float(capped_elite_threat["threat_weight"]),
		PACING.MAX_THREAT_WEIGHT * sqrt(2.5),
		"Elite reward-score axis expands bounded threat headroom by the same square-root response",
	)
	var boss_projection := PACING.project_enemy_reward(PACING.BOSS_REFERENCE_SCORE, 3, true, stage_three_context)
	_expect_close(float(boss_projection["reward_units"]), float(RULES.xp_required_for_level(3)) * 0.10, "a reference boss consumes its separate ten-percent XP bucket")
	var missing_context := PACING.project_enemy_reward(100.0, 3)
	_expect(not bool(missing_context.get("valid", true)) and is_zero_approx(float(missing_context.get("reward_units", -1.0))), "missing campaign population context fails XP closed")
	var malformed_context := stage_three_context.duplicate(true)
	malformed_context["plan_signature"] = ""
	var malformed_projection := PACING.project_enemy_reward(100.0, 3, false, malformed_context)
	_expect(not bool(malformed_projection.get("valid", true)) and is_zero_approx(float(malformed_projection.get("reward_units", -1.0))), "malformed campaign population signature fails XP closed")


func _test_deterministic_mutants() -> void:
	var run_id := "run:mutant:deterministic"
	var entity_id := &"skeleton_reaper_17"
	var first_roll := DIFFICULTY.deterministic_roll(run_id, entity_id)
	_expect_close(first_roll, DIFFICULTY.deterministic_roll(run_id, entity_id), "mutation roll is stable for one run/entity pair")
	_expect(first_roll >= 0.0 and first_roll < 1.0, "mutation roll stays in the normalized probability range")
	for stage: int in range(1, DIFFICULTY.MUTANT_UNLOCK_STAGE):
		for difficulty: String in ["easy", "medium", "hard"]:
			_expect_close(DIFFICULTY.effective_mutant_chance(stage, difficulty), 0.0, "Level %d %s mutant chance is locked before its lesson" % [stage, difficulty])
			var any_early_mutant := false
			for index: int in range(200):
				if DIFFICULTY.should_spawn_mutant(
					run_id,
					StringName("early_%s_%d_%d" % [difficulty, stage, index]),
					difficulty,
					stage,
				):
					any_early_mutant = true
			_expect(not any_early_mutant, "Level %d %s cannot roll a pre-lesson mutant" % [stage, difficulty])

	var easy_mutants := 0
	var hard_mutants := 0
	for index: int in range(2000):
		var sampled_id := StringName("sample_enemy_%d" % index)
		if DIFFICULTY.should_spawn_mutant(run_id, sampled_id, &"easy", 4):
			easy_mutants += 1
		if DIFFICULTY.should_spawn_mutant(run_id, sampled_id, &"hard", 4):
			hard_mutants += 1
	_expect(easy_mutants > 0, "Easy starts spawning occasional mutants at Level 4")
	_expect(hard_mutants > easy_mutants * 4, "Hard deterministically produces a much denser mutant population")

	var normal := FakeProfileEnemy.new()
	var mutant := FakeProfileEnemy.new()
	root.add_child(normal)
	root.add_child(mutant)
	var population_context := _population_context(5, &"medium")
	normal.set_meta(ENEMY_SCALER.EXPERIENCE_POPULATION_CONTEXT_META, population_context)
	mutant.set_meta(ENEMY_SCALER.EXPERIENCE_POPULATION_CONTEXT_META, population_context)
	mutant.set_meta(&"mutant", true)
	mutant.set_meta(&"loot_role", &"elite")
	mutant.set_meta(&"enemy_rarity", &"rare")
	var normal_modifiers := ENEMY_SCALER.apply_to(normal, 5, &"medium")
	var mutant_modifiers := ENEMY_SCALER.apply_to(mutant, 5, &"medium")
	_expect(mutant.max_health > normal.max_health, "mutant metadata applies its extra HP spike")
	_expect(int(mutant.get_combat_profile()["damage"]) > int(normal.get_combat_profile()["damage"]), "mutant metadata applies its extra damage spike")
	_expect(float(mutant.get_meta(&"experience_reward", 0.0)) > float(normal.get_meta(&"experience_reward", 0.0)), "mutants pay a larger realtime XP reward")
	_expect(bool(mutant_modifiers.get("mutant", false)) and not bool(normal_modifiers.get("mutant", false)), "scaler exposes mutation in the immutable runtime projection")
	_expect(mutant.is_in_group(&"mutant_enemies") and mutant.is_in_group(&"elite_enemies"), "mutants enter explicit targeting and elite groups")
	_expect(StringName(mutant.get_meta(&"loot_role")) == &"elite" and StringName(mutant.get_meta(&"enemy_rarity")) == &"rare", "mutants carry the elite rare-loot contract before entering the tree")
	normal.queue_free()
	mutant.queue_free()


func _test_realtime_experience_save() -> void:
	var first: Dictionary = SaveService.call(&"grant_player_experience", 60, "test:xp:first", {"source": "enemy"})
	_expect(bool(first.get("applied", false)), "confirmed enemy XP commits immediately")
	_expect(int(SaveService.get_player_progression_snapshot()["xp"]) == 60, "current XP bucket persists without a result screen")
	_expect(_xp_events.size() == 1 and int(_xp_events[0]["gained"]) == 60, "durable XP emits the HUD gain signal")
	var duplicate: Dictionary = SaveService.call(&"grant_player_experience", 60, "test:xp:first", {"source": "enemy"})
	_expect(not bool(duplicate.get("applied", true)) and bool(duplicate.get("already_applied", false)), "duplicate enemy receipt cannot pay XP twice")
	var rollover: Dictionary = SaveService.call(&"grant_player_experience", 40, "test:xp:rollover")
	_expect(bool(rollover.get("applied", false)) and int(rollover.get("level", 0)) == 2, "XP rolls over and levels during combat")
	_expect(_level_events.size() == 1 and int(_level_events[0]["level"]) == 2, "level rollover emits the canonical level-up signal")
	_expect(SaveService.reload_save(), "realtime XP and level survive reload")
	var reloaded: Dictionary = SaveService.call(&"get_player_progression_snapshot")
	_expect(int(reloaded["player_level"]) == 2 and int(reloaded["xp"]) == 0, "reloaded progression matches the committed rollover")


func _test_enemy_scaling() -> void:
	var enemy := FakeProfileEnemy.new()
	root.add_child(enemy)
	enemy.set_meta(
		ENEMY_SCALER.EXPERIENCE_POPULATION_CONTEXT_META,
		_population_context(10, &"hard"),
	)
	enemy.set_meta(&"level_entity_type", "skeleton_reaper")
	var modifiers := ENEMY_SCALER.apply_to(enemy, 10, &"hard")
	var profile := enemy.get_combat_profile()
	_expect(int(profile["max_health"]) == roundi(100.0 * float(modifiers["runtime_health_multiplier"])), "profile enemy HP receives stage, difficulty and readable-number scaling once")
	_expect(int(profile["damage"]) == roundi(10.0 * float(modifiers["runtime_damage_multiplier"])), "profile enemy damage receives stage, difficulty and readable-number scaling")
	_expect(float(profile["chase_speed"]) > 50.0, "profile enemy movement scales by difficulty")
	var scaled_health := enemy.max_health
	ENEMY_SCALER.apply_to(enemy, 10, &"hard")
	_expect(enemy.max_health == scaled_health, "difficulty projection is idempotent per enemy instance")
	_expect(float(enemy.get_meta(&"experience_reward", 0.0)) > 0.0, "scaled enemy exposes a fractional realtime XP reward")
	enemy.queue_free()


var _fake_root := FakeAppRoot.new()


func _test_continuous_campaign_flow() -> void:
	root.add_child(_fake_root)
	AppFlow.attach_app_root(_fake_root)
	_expect(not AppFlow.start_campaign_level(&"chapter_1_level_1", &"medium"), "uncleared level starts on Easy only")
	_expect(AppFlow.start_campaign_level(&"chapter_1_level_1", &"easy"), "unlocked first level starts on Easy")
	_expect(_fake_root.route_id == &"gameplay", "campaign starts in gameplay")
	AppFlow.complete_active_run({"test_clear": true}, true)
	_expect(_fake_root.route_id == &"gameplay", "completion remains in gameplay instead of routing to Results")
	_expect(_completion_events == 1, "completion publishes the in-place continuation chooser event")
	_expect(AppFlow.is_campaign_level_completed(&"chapter_1_level_1"), "first clear commits before the chooser opens")
	var available: Array = AppFlow.call(&"get_available_campaign_difficulties", &"chapter_1_level_1")
	_expect(available == [&"easy", &"medium", &"hard"], "cleared level unlocks all three difficulties without extra conditions")
	_expect(AppFlow.select_campaign_level_difficulty(&"chapter_1_level_1", &"hard"), "cleared level persists Hard selection")
	_expect(AppFlow.replay_completed_level(&"chapter_1_level_1", &"hard"), "chooser can replay the cleared level on Hard immediately")
	var replay: Dictionary = AppFlow.call(&"get_active_run")
	_expect(StringName(replay["difficulty"]) == &"hard", "replay payload carries Hard difficulty in realtime")
	AppFlow.complete_active_run({"hard_replay": true}, true)
	var options: Dictionary = AppFlow.call(&"get_continuation_options")
	_expect(bool(options["can_continue"]) and StringName(options["next_level_id"]) == &"chapter_1_level_2", "chooser exposes the newly unlocked next level")
	_expect(AppFlow.continue_to_next_campaign_level(), "Next starts the following level without returning home")
	var next_run: Dictionary = AppFlow.call(&"get_active_run")
	_expect(StringName(next_run["level_id"]) == &"chapter_1_level_2" and StringName(next_run["difficulty"]) == &"easy", "new stage resets into its default Easy run")
	_expect(SaveService.reload_save(), "difficulty selection survives save reload")
	_expect(AppFlow.get_selected_campaign_difficulty(&"chapter_1_level_1") == &"hard", "reloaded cleared level remembers its chosen difficulty")


func _test_live_density_spawns() -> void:
	# The preceding flow leaves newly unlocked Level 2 active on Easy. Mounting
	# the real gameplay scene proves the runtime projection is consumed by Main,
	# not merely calculated by a pure helper that nothing ever spawns.
	var game_scene := load("res://game/main.tscn") as PackedScene
	_expect(game_scene != null, "production gameplay scene loads after autoload initialization")
	if game_scene == null:
		return
	var easy_game := game_scene.instantiate()
	root.add_child(easy_game)
	await process_frame
	await process_frame
	var easy_counts := _density_counts(easy_game)
	var easy_metadata: Dictionary = (easy_game.get_node("Level") as DungeonLevel).level_data.get("metadata", {})
	_expect(
		int(easy_counts["bonus"]) == PACK_RULES.expected_bonus_count(easy_metadata, 2, &"easy"),
		"real Easy gameplay materializes its deterministic per-floor encounter packs"
	)
	_expect(bool(easy_counts["all_optional"]), "density enemies never become required encounter objectives")
	_expect(int(easy_counts["scouts"]) == 1, "one optional density enemy becomes the Level 2 cadence scout")
	var easy_scout_position: Vector2 = easy_counts["scout_position"]
	_expect(
		easy_scout_position.is_equal_approx(Vector2(808.0, 216.0)),
		"the live Level 2 cadence scout uses the authored floor anchor"
	)
	_expect(bool(easy_counts["camp_offsets_valid"]), "all remaining Easy pack members use local, walkable, non-overlapping cells")
	_test_live_fractional_enemy_experience(easy_game)
	easy_game.free()
	await process_frame

	AppFlow.complete_active_run({"cadence_scout_test": true}, true)
	_expect(AppFlow.continue_to_next_campaign_level(), "the density contract can mount newly cleared Level 3")
	var level_three_game := game_scene.instantiate()
	root.add_child(level_three_game)
	await process_frame
	await process_frame
	var level_three_counts := _density_counts(level_three_game)
	_expect(int(level_three_counts["scouts"]) == 1, "one optional density enemy becomes the Level 3 cadence scout")
	var level_three_scout_position: Vector2 = level_three_counts["scout_position"]
	_expect(
		level_three_scout_position.is_equal_approx(Vector2(968.0, 168.0)),
		"the live Level 3 cadence scout uses the authored floor anchor"
	)
	_expect(bool(level_three_counts["all_optional"]), "the Level 3 cadence scout never joins its completion objective")
	_expect(bool(level_three_counts["camp_offsets_valid"]), "all remaining Level 3 pack members use local, walkable, non-overlapping cells")
	level_three_game.free()
	await process_frame

	_expect(AppFlow.replay_completed_level(&"chapter_1_level_2", &"hard"), "density integration can mount the anchored Level 2 on Hard")
	var hard_game := game_scene.instantiate()
	root.add_child(hard_game)
	await process_frame
	await process_frame
	var hard_counts := _density_counts(hard_game)
	var hard_metadata: Dictionary = (hard_game.get_node("Level") as DungeonLevel).level_data.get("metadata", {})
	_expect(
		int(hard_counts["bonus"]) == PACK_RULES.expected_bonus_count(hard_metadata, 2, &"hard"),
		"real Hard gameplay materializes the extra pack and member pressure"
	)
	_expect(
		float(hard_counts["bonus"]) / maxf(1.0, float(hard_counts["authored"]))
			> float(easy_counts["bonus"]) / maxf(1.0, float(easy_counts["authored"])),
		"Hard live enemy density is proportionally higher than Easy"
	)
	_expect(int(hard_counts["scouts"]) == 1, "Hard still creates exactly one cadence scout despite its larger bonus population")
	var hard_scout_position: Vector2 = hard_counts["scout_position"]
	_expect(
		hard_scout_position.is_equal_approx(Vector2(808.0, 216.0)),
		"the Hard cadence scout keeps the same safe Level 2 floor anchor"
	)
	_expect(bool(hard_counts["camp_offsets_valid"]), "every non-scout Hard pack member uses a local, walkable, non-overlapping cell")
	hard_game.free()
	await process_frame


func _test_live_fractional_enemy_experience(game: Node) -> void:
	var fake_enemy := Node.new()
	fake_enemy.set_meta(&"experience_reward", 0.40)
	fake_enemy.set_meta(ENEMY_SCALER.COMBAT_PROJECTION_REVISION_META, 1)
	fake_enemy.set_meta(ENEMY_SCALER.EXPERIENCE_FINALIZED_REVISION_META, 1)
	fake_enemy.set_meta(ENEMY_SCALER.EXPERIENCE_PROJECTION_META, {
		"revision": PACING.EXPERIENCE_PROJECTION_REVISION,
		"valid": true,
		"finalized": true,
		"reward_units": 0.40,
		"combat_projection_revision": 1,
		"population_plan_signature": "fractional_carry_fixture",
	})
	var event_count_before := _hero_xp_events.size()
	game.call(&"_grant_enemy_experience", fake_enemy, &"fractional_test_1")
	game.call(&"_grant_enemy_experience", fake_enemy, &"fractional_test_2")
	_expect(_hero_xp_events.size() == event_count_before, "Main does not round sub-one kill rewards into durable Hero XP")
	game.call(&"_grant_enemy_experience", fake_enemy, &"fractional_test_3")
	_expect(_hero_xp_events.size() == event_count_before + 1, "Main commits Hero XP only when run-local fractions cross a whole unit")
	_expect(int(_hero_xp_events.back().get("gained", 0)) == 1, "fractional carry commits exactly one whole Hero XP")
	_expect_close(float(game.get("_enemy_xp_fractional_carry")), 0.20, "Main retains the deterministic fractional remainder for this run")
	game.call(&"_grant_enemy_experience", fake_enemy, &"fractional_test_3")
	_expect(_hero_xp_events.size() == event_count_before + 1, "an enemy receipt cannot add its fractional units twice")
	_expect_close(float(game.get("_enemy_xp_fractional_carry")), 0.20, "duplicate receipts cannot perturb fractional carry")
	fake_enemy.free()


func _density_counts(game: Node) -> Dictionary:
	var runtime_level := game.get_node("Level") as DungeonLevel
	var authored := 0
	var authored_positions: Dictionary = {}
	for raw: Variant in runtime_level.get_entities():
		if not raw is Dictionary:
			continue
		var entity := raw as Dictionary
		if String(entity.get("type", "")) in DENSITY_ELIGIBLE_TYPES \
				and not bool(entity.get("objective_bound", false)):
			authored += 1
			var position_value: Variant = entity.get("position", [])
			if position_value is Array and (position_value as Array).size() >= 2:
				var position_array := position_value as Array
				authored_positions[String(entity.get("id", ""))] = Vector2(
					float(position_array[0]),
					float(position_array[1]),
				)
	var bonus := 0
	var all_optional := true
	var scouts := 0
	var scout_position := Vector2.ZERO
	var camp_offsets_valid := true
	var walkable_lookup := {}
	var layers_value: Variant = runtime_level.level_data.get("layers", {})
	if layers_value is Dictionary:
		var backdrop_value: Variant = (layers_value as Dictionary).get("Backdrop", [])
		if backdrop_value is Array:
			for raw_cell: Variant in backdrop_value:
				if raw_cell is Dictionary:
					walkable_lookup["%d,%d" % [
						int((raw_cell as Dictionary).get("x", -1)),
						int((raw_cell as Dictionary).get("y", -1)),
					]] = true
	var occupied_bonus_cells := {}
	for child: Node in game.get_node("Level/Entities").get_children():
		if not bool(child.get_meta(&"density_bonus", false)):
			continue
		bonus += 1
		var config: Dictionary = child.get_meta(&"level_entity_config", {})
		all_optional = all_optional and not bool(config.get("required_for_completion", true))
		var position_value: Variant = config.get("position", [])
		var bonus_position := Vector2.ZERO
		if position_value is Array and (position_value as Array).size() >= 2:
			var position_array := position_value as Array
			bonus_position = Vector2(float(position_array[0]), float(position_array[1]))
		var bonus_cell := Vector2i(
			floori(bonus_position.x / 16.0),
			floori(bonus_position.y / 16.0),
		)
		var bonus_cell_key := "%d,%d" % [bonus_cell.x, bonus_cell.y]
		camp_offsets_valid = (
			camp_offsets_valid
			and walkable_lookup.has(bonus_cell_key)
			and not occupied_bonus_cells.has(bonus_cell_key)
		)
		occupied_bonus_cells[bonus_cell_key] = true
		if bool(config.get("density_cadence_scout", false)):
			scouts += 1
			scout_position = bonus_position
			continue
		var source_position_value: Variant = authored_positions.get(
			String(config.get("source_entity_id", "")),
			null,
		)
		if not source_position_value is Vector2:
			camp_offsets_valid = false
			continue
		var source_position: Vector2 = source_position_value
		var offset_distance := bonus_position.distance_to(source_position)
		var source_cell := Vector2i(
			floori(source_position.x / 16.0),
			floori(source_position.y / 16.0),
		)
		camp_offsets_valid = (
			camp_offsets_valid
			and bonus_cell != source_cell
			and offset_distance <= 112.1
		)
	return {
		"authored": authored,
		"bonus": bonus,
		"all_optional": all_optional,
		"scouts": scouts,
		"scout_position": scout_position,
		"camp_offsets_valid": camp_offsets_valid,
	}


func _population_context(stage_level: int, difficulty_id: StringName) -> Dictionary:
	var metadata := {
		"encounter_pack_model": {
			"enabled": true,
			"profile_stage": stage_level,
			"floor_count": 3,
		}
	}
	var plan := PACK_RULES.get_level_pack_plan(metadata, stage_level, difficulty_id)
	var runtime_entities: Array = []
	for index: int in int(plan.get("total_members", 0)):
		runtime_entities.append({
			"id": "xp_fixture_%03d" % index,
			"type": "skeleton",
			"encounter_pack": true,
		})
	return PACK_RULES.build_population_context(
		metadata,
		stage_level,
		difficulty_id,
		runtime_entities,
		["skeleton"],
	)


func _test_inventory_grant_contract() -> void:
	_expect(SaveService.grant_inventory_item(&"test_ground_shard", &"material", 2, "test:item:first"), "ground material grant commits through the shared SaveService API")
	var quantity_path: Array[String] = ["inventory", "item_stacks", "test_ground_shard", "quantity"]
	_expect(int(SaveService.get_value(quantity_path, 0)) == 2, "ground material enters the live inventory stack")
	_expect(SaveService.grant_inventory_item(&"test_ground_shard", &"material", 3, "test:item:second"), "matching material pickups merge")
	_expect(int(SaveService.get_value(quantity_path, 0)) == 5, "merged ground stack has the exact quantity")
	_expect(not SaveService.grant_inventory_item(&"test_ground_shard", &"consumable", 1, "test:item:wrong_kind"), "one item ID cannot silently change kind")


func _on_xp_changed(current: int, required: int, gained: int) -> void:
	_xp_events.append({"current": current, "required": required, "gained": gained})


func _on_hero_xp_changed(
		hero_id: StringName,
		current: int,
		required: int,
		gained: int,
) -> void:
	_hero_xp_events.append({
		"hero_id": String(hero_id),
		"current": current,
		"required": required,
		"gained": gained,
	})


func _on_level_changed(level: int, levels_gained: int) -> void:
	_level_events.append({"level": level, "levels_gained": levels_gained})


func _on_completion_ready(_result: Dictionary, _options: Dictionary) -> void:
	_completion_events += 1


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(is_equal_approx(actual, expected), "%s (expected %.3f, got %.3f)" % [message, expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))
