extends SceneTree

## Production balance gates for the Chapter 1 teaching slice. These are outcome
## bands, not corrective modifiers: the test observes the same Hero projection,
## resolver, enemy scaling and XP contracts used by runtime, then fails if their
## relationship drifts outside the authored learning cadence.

const MODEL := preload("res://game/combat/combat_balance_model.gd")
const HERO_COMBAT := preload("res://game/heroes/hero_soul_manager.gd")
const PROGRESSION := preload("res://game/meta/progression/player_progression_rules.gd")
const DIFFICULTY := preload("res://game/meta/progression/difficulty_rules.gd")
const PACING := preload("res://game/meta/progression/progression_pacing_rules.gd")
const PACK_RULES := preload("res://game/content/encounters/encounter_pack_rules.gd")
const ENEMY_SCALER := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")
const ELITE_APPLICATOR := preload("res://game/characters/enemies/elite_enemy_applicator.gd")
const COMPLEXITY := preload("res://game/meta/progression/complexity_progression_rules.gd")
const RARITY := preload("res://game/loot/loot_rarity_rules.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const REPORT_PATH := "res://.artifacts/chapter_1_balance_matrix_report.json"
const TRIPLE_ELITE = preload("res://data/content/elite_modifiers/triple_stat_elite.tres")
const LEVEL_PATHS := {
	1: "res://data/levels/crypt_entrance.json",
	2: "res://data/levels/chapter_1_level_2.json",
	3: "res://data/levels/chapter_1_level_3.json",
	4: "res://data/levels/chapter_1_level_4.json",
	5: "res://data/levels/chapter_1_level_5.json",
	6: "res://data/levels/chapter_1_level_6.json",
	7: "res://data/levels/chapter_1_level_7.json",
	8: "res://data/levels/chapter_1_level_8.json",
	9: "res://data/levels/chapter_1_level_9.json",
	10: "res://data/levels/chapter_1_level_10.json",
}
const ENEMY_ENTITY_TYPES := [
	"skeleton", "skeleton_reaper", "crimson_reaper", "bone_reaper_captain",
	"hooded_archer_miniboss", "vampire", "vampire_castellan",
]
const DENSITY_EXCLUDED_ENEMY_TYPES := [
	"crimson_reaper", "bone_reaper_captain", "hooded_archer_miniboss", "vampire_castellan",
]


class MatrixEnemy extends Node2D:
	var max_health := 100
	var health := 100
	var contact_damage := 10
	var patrol_speed := 34.0
	var chase_speed := 58.0
	var detection_range := 150.0
	var disengage_range := 220.0
	var attack_range := 38.0
	var separation_strength := 48.0
	var attack_cooldown := 0.85
	var score_reward := 100

const SCENARIOS := [
	{
		"id": "l1_floor_skeleton",
		"stage": 1,
		"difficulty": &"easy",
		"allocation": {"hp": 0, "damage": 0, "mana": 0},
		"enemy": {"id": "skeleton", "base_hp": 70.0, "base_damage": 14.0, "interval": 0.85},
		"hit_band": [4, 4],
		"ttk_band": [1.40, 1.55],
		"survival_hit_band": [7, 10],
	},
	{
		"id": "l2_floor_skeleton",
		"stage": 2,
		"difficulty": &"easy",
		"allocation": {"hp": 0, "damage": 0, "mana": 0},
		"enemy": {"id": "skeleton", "base_hp": 70.0, "base_damage": 14.0, "interval": 0.85},
		"hit_band": [4, 4],
		"ttk_band": [1.40, 1.55],
		"survival_hit_band": [7, 11],
	},
	{
		"id": "l3_floor_reaper",
		"stage": 3,
		"difficulty": &"easy",
		"allocation": {"hp": 0, "damage": 0, "mana": 0},
		"enemy": {"id": "bone_reaper", "base_hp": 86.0, "base_damage": 14.0, "interval": 2.10},
		"hit_band": [5, 5],
		"ttk_band": [1.85, 2.05],
		"survival_hit_band": [8, 12],
	},
	{
		"id": "l3_damage_lesson_reaper",
		"stage": 3,
		"difficulty": &"easy",
		"allocation": {"hp": 0, "damage": 5, "mana": 0},
		"enemy": {"id": "bone_reaper", "base_hp": 86.0, "base_damage": 14.0, "interval": 2.10},
		"hit_band": [4, 4],
		"ttk_band": [1.40, 1.55],
		"survival_hit_band": [8, 12],
	},
	{
		"id": "l3_hp_lesson_reaper",
		"stage": 3,
		"difficulty": &"easy",
		"allocation": {"hp": 5, "damage": 0, "mana": 0},
		"enemy": {"id": "bone_reaper", "base_hp": 86.0, "base_damage": 14.0, "interval": 2.10},
		"hit_band": [5, 5],
		"ttk_band": [1.85, 2.05],
		"survival_hit_band": [12, 16],
	},
	{
		"id": "l3_damage_focus_reaper",
		"stage": 3,
		"difficulty": &"easy",
		"allocation": {"hp": 0, "damage": 15, "mana": 0},
		"enemy": {"id": "bone_reaper", "base_hp": 86.0, "base_damage": 14.0, "interval": 2.10},
		"hit_band": [3, 4],
		"ttk_band": [0.90, 1.55],
		"survival_hit_band": [8, 12],
	},
	{
		"id": "l3_hard_replay_reaper",
		"stage": 3,
		"difficulty": &"hard",
		"allocation": {"hp": 0, "damage": 5, "mana": 0},
		"enemy": {"id": "bone_reaper", "base_hp": 86.0, "base_damage": 14.0, "interval": 2.10},
		"hit_band": [7, 9],
		"ttk_band": [2.70, 3.70],
		"survival_hit_band": [4, 8],
	},
]

var _checks := 0
var _failures: Array[String] = []
var _rows: Array[Dictionary] = []
var _xp_rows: Array[Dictionary] = []
var _resource_rows: Array[Dictionary] = []
var _loot_rows: Array[Dictionary] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	for scenario: Dictionary in SCENARIOS:
		_evaluate_scenario(scenario)
	_test_relationships()
	_test_xp_budget()
	_test_elite_xp_finalization()
	_test_mana_tempo()
	_test_loot_disclosure()
	_write_report()
	print("CHAPTER 1 BALANCE MATRIX TEST %s - %d checks" % [
		"PASSED" if _failures.is_empty() else "FAILED",
		_checks,
	])
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	quit(0 if _failures.is_empty() else 1)


func _evaluate_scenario(scenario: Dictionary) -> void:
	var scenario_id := String(scenario.get("id", "missing"))
	var stage := int(scenario.get("stage", 1))
	var difficulty := StringName(scenario.get("difficulty", &"easy"))
	var allocation := (scenario.get("allocation", {}) as Dictionary).duplicate(true)
	var save := _save_snapshot(stage, allocation)
	_expect(
		PROGRESSION.validate_stat_allocation(stage, allocation),
		"%s uses an earnable Stat Point allocation" % scenario_id,
	)
	var hero_snapshot := HERO_COMBAT.project_hero_combat(save, SWORD)
	_expect(not hero_snapshot.is_empty(), "%s resolves an effective Hero snapshot" % scenario_id)
	var actions := _sword_actions(save)
	_expect(actions.size() == SWORD.combo_step_count(), "%s projects every authored combo action" % scenario_id)
	for action: Dictionary in actions:
		var request: Dictionary = action.get("request", {})
		_expect(
			int(request.get("formula_version", 0)) == 1,
			"%s action %s uses canonical formula v1" % [scenario_id, action.get("id", "")],
		)

	var enemy := scenario.get("enemy", {}) as Dictionary
	var scaling := DIFFICULTY.stage_modifiers(stage, difficulty)
	var target_hp := float(roundi(
		float(enemy.get("base_hp", 1.0)) * float(scaling.get("health_multiplier", 1.0))
	))
	var ttk := MODEL.sequence_ttk(target_hp, actions)
	var incoming_request := {
		"base": float(enemy.get("base_damage", 0.0)),
		"unique_multipliers": {
			"stage_growth": float(scaling.get("stage_damage", 1.0)),
			"difficulty": float(scaling.get("enemy_damage", 1.0)),
		},
	}
	var survival := MODEL.survivability(
		float(hero_snapshot.get("hp", 0.0)),
		incoming_request,
		float(enemy.get("interval", 1.0)),
	)
	var hit_band := scenario.get("hit_band", [0, 0]) as Array
	var ttk_band := scenario.get("ttk_band", [0.0, 0.0]) as Array
	var survival_band := scenario.get("survival_hit_band", [0, 0]) as Array
	var hit_gate := MODEL.band_result(
		float(ttk.get("hits_to_kill", 0)), float(hit_band[0]), float(hit_band[1])
	)
	var ttk_gate := MODEL.band_result(
		float(ttk.get("ttk_seconds", 0.0)), float(ttk_band[0]), float(ttk_band[1])
	)
	var survival_gate := MODEL.band_result(
		float(survival.get("hits_to_die", 0)),
		float(survival_band[0]),
		float(survival_band[1]),
	)
	_expect(bool(ttk.get("valid", false)) and bool(ttk.get("killed", false)), "%s produces a finite kill" % scenario_id)
	_expect(bool(hit_gate.get("passed", false)), "%s stays inside its hit breakpoint band" % scenario_id)
	_expect(bool(ttk_gate.get("passed", false)), "%s stays inside its TTK band" % scenario_id)
	_expect(bool(survival_gate.get("passed", false)), "%s stays inside its survivability band" % scenario_id)
	_rows.append({
		"id": scenario_id,
		"stage": stage,
		"difficulty": String(difficulty),
		"allocation": allocation,
		"enemy_id": String(enemy.get("id", "")),
		"target_hp": target_hp,
		"player_hp": float(hero_snapshot.get("hp", 0.0)),
		"player_mana": float(hero_snapshot.get("mana", 0.0)),
		"combo_damage": int(ttk.get("cycle_damage", 0)),
		"hits_to_kill": int(ttk.get("hits_to_kill", 0)),
		"ttk_seconds": float(ttk.get("ttk_seconds", 0.0)),
		"incoming_damage": int(survival.get("incoming_damage", 0)),
		"hits_to_die": int(survival.get("hits_to_die", 0)),
		"hit_gate": hit_gate,
		"ttk_gate": ttk_gate,
		"survival_gate": survival_gate,
	})


func _test_relationships() -> void:
	var floor := _row(&"l3_floor_reaper")
	var damage_lesson := _row(&"l3_damage_lesson_reaper")
	var hp_lesson := _row(&"l3_hp_lesson_reaper")
	var damage_focus := _row(&"l3_damage_focus_reaper")
	var hard_replay := _row(&"l3_hard_replay_reaper")
	_expect(
		int(damage_lesson.get("hits_to_kill", 99)) < int(floor.get("hits_to_kill", 0)),
		"five learned Power points cross a visible Reaper combo breakpoint",
	)
	_expect(
		int(hp_lesson.get("hits_to_die", 0)) > int(floor.get("hits_to_die", 0)),
		"five learned HP points cross a visible survivability breakpoint",
	)
	_expect(
		int(damage_focus.get("hits_to_kill", 0)) >= 3
		and int(damage_focus.get("hits_to_kill", 99)) <= int(damage_lesson.get("hits_to_kill", 0)),
		"all-in early Power helps without deleting the elite lesson in one or two hits",
	)
	_expect(
		int(hard_replay.get("hits_to_kill", 0)) > int(damage_lesson.get("hits_to_kill", 0))
		and int(hard_replay.get("hits_to_die", 99)) < int(damage_lesson.get("hits_to_die", 0)),
		"Hard replay raises both outgoing and incoming pressure monotonically",
	)


func _test_xp_budget() -> void:
	for stage: int in range(1, 11):
		var easy_context := _chapter_population_context(stage, &"easy")
		var hard_context := _chapter_population_context(stage, &"hard")
		var easy_reference := PACING.project_population_budget(
			stage,
			&"easy",
			PACING.ORDINARY_REFERENCE_SCORE,
			easy_context,
		)
		var hard_reference := PACING.project_population_budget(
			stage,
			&"hard",
			PACING.ORDINARY_REFERENCE_SCORE,
			hard_context,
		)
		var easy_live := _live_population_projection(stage, &"easy", easy_context)
		var hard_live := _live_population_projection(stage, &"hard", hard_context)
		var easy_reference_ratio := float(easy_reference.get("xp_bucket_ratio", 0.0))
		var hard_reference_ratio := float(hard_reference.get("xp_bucket_ratio", 0.0))
		var easy_live_ratio := float(easy_live.get("xp_bucket_ratio", 0.0))
		var hard_live_ratio := float(hard_live.get("xp_bucket_ratio", 0.0))
		_expect(bool(easy_context.get("valid", false)) and bool(hard_context.get("valid", false)), "L%d Easy/Hard population projections realize their level-specific plans" % stage)
		_expect(is_equal_approx(easy_reference_ratio, PACING.ORDINARY_STAGE_BUDGET_RATIO), "L%d Easy reference-score kills spend exactly the authored XP share" % stage)
		_expect(hard_reference_ratio >= easy_reference_ratio and hard_reference_ratio <= easy_reference_ratio * 1.25 + 0.000001, "L%d Hard reference-score XP follows only its bounded realized density ratio" % stage)
		_expect(easy_live_ratio >= easy_reference_ratio, "L%d final scaled actor score never pays less than the unscaled reference projection" % stage)
		_expect(hard_live_ratio >= easy_live_ratio, "L%d Hard final actor projection never pays less total ordinary XP than Easy" % stage)
		_expect(hard_live_ratio <= PACING.ORDINARY_STAGE_BUDGET_RATIO * PACING.MAX_THREAT_WEIGHT * 1.25 + 0.000001, "L%d final Hard score and density stay inside the explicit threat/density caps" % stage)
		_expect(String(easy_live.get("population_plan_signature", "")) == String(easy_context.get("plan_signature", "")), "L%d matrix actor consumes the exact same signed Easy plan it realizes" % stage)
		_xp_rows.append({
			"stage": stage,
			"easy_context": easy_context,
			"hard_context": hard_context,
			"easy_reference": easy_reference,
			"hard_reference": hard_reference,
			"easy_live": easy_live,
			"hard_live": hard_live,
		})


func _test_elite_xp_finalization() -> void:
	var context := _chapter_population_context(8, &"easy")
	var enemy := MatrixEnemy.new()
	enemy.set_meta(ENEMY_SCALER.EXPERIENCE_POPULATION_CONTEXT_META, context)
	root.add_child(enemy)
	ENEMY_SCALER.apply_to(enemy, 8, &"easy")
	var before: Dictionary = enemy.get_meta(ENEMY_SCALER.EXPERIENCE_PROJECTION_META, {})
	var revision_before := int(before.get("combat_projection_revision", 0))
	_expect(ELITE_APPLICATOR.apply_to(enemy, TRIPLE_ELITE), "matrix applies the production Elite adapter")
	var after: Dictionary = enemy.get_meta(ENEMY_SCALER.EXPERIENCE_PROJECTION_META, {})
	_expect(ENEMY_SCALER.is_experience_reward_current(enemy), "Elite XP finalizes against the post-Elite combat revision")
	_expect(int(after.get("combat_projection_revision", 0)) == revision_before + 1, "Elite mutation advances combat and reward projection together")
	_expect(float(after.get("final_score", 0.0)) > float(before.get("final_score", 0.0)) and float(after.get("reward_units", 0.0)) > float(before.get("reward_units", 0.0)), "Elite final score and XP threat both exceed the same actor before promotion")
	_expect((after.get("elite_combat_axes", {}) as Dictionary) == TRIPLE_ELITE.get_combat_axes(), "Elite XP snapshot publishes all authored pressure axes")
	_expect(float((after.get("elite_combat_axes", {}) as Dictionary).get("sustained_dps", 99.0)) < 2.0, "Elite matrix forbids the former accidental 9x sustained DPS")
	enemy.free()


func _chapter_population_context(stage: int, difficulty: StringName) -> Dictionary:
	var document := _load_json(String(LEVEL_PATHS.get(stage, "")))
	var authored: Array = (
		document.get("entities", []).duplicate(true)
		if document.get("entities", []) is Array
		else []
	)
	var metadata: Dictionary = (
		(document.get("metadata", {}) as Dictionary).duplicate(true)
		if document.get("metadata", {}) is Dictionary
		else {}
	)
	var excluded_entity_ids: Array = []
	var branch_ids: Variant = metadata.get("branch_enemy_ids", [])
	if branch_ids is Array:
		excluded_entity_ids.append_array((branch_ids as Array).duplicate())
	var crimson_reaper_id := String(metadata.get("crimson_reaper_id", ""))
	if not crimson_reaper_id.is_empty():
		excluded_entity_ids.append(crimson_reaper_id)
	for raw_entity: Variant in authored:
		if raw_entity is Dictionary and bool((raw_entity as Dictionary).get("objective_bound", false)):
			excluded_entity_ids.append(String((raw_entity as Dictionary).get("id", "")))
	var walkable_cells: Array = []
	var layers_value: Variant = document.get("layers", {})
	if layers_value is Dictionary:
		var backdrop_value: Variant = (layers_value as Dictionary).get("Backdrop", [])
		if backdrop_value is Array:
			walkable_cells = backdrop_value
	var runtime_entities := PACK_RULES.project_runtime_entities(
		authored,
		metadata,
		stage,
		difficulty,
		"balance_matrix_l%d_%s" % [stage, difficulty],
		ENEMY_ENTITY_TYPES,
		DENSITY_EXCLUDED_ENEMY_TYPES,
		excluded_entity_ids,
		walkable_cells,
	)
	return PACK_RULES.build_population_context(
		metadata,
		stage,
		difficulty,
		runtime_entities,
		ENEMY_ENTITY_TYPES,
	)


func _live_population_projection(
	stage: int,
	difficulty: StringName,
	population_context: Dictionary,
) -> Dictionary:
	var enemy := MatrixEnemy.new()
	enemy.set_meta(
		ENEMY_SCALER.EXPERIENCE_POPULATION_CONTEXT_META,
		population_context,
	)
	root.add_child(enemy)
	ENEMY_SCALER.apply_to(enemy, stage, difficulty)
	var experience: Dictionary = enemy.get_meta(
		ENEMY_SCALER.EXPERIENCE_PROJECTION_META,
		{},
	)
	var realized_population := int(population_context.get("realized_population", 0))
	var xp_required := PROGRESSION.xp_required_for_level(stage)
	var expected_units := float(experience.get("reward_units", 0.0)) * float(realized_population)
	var result := {
		"valid": ENEMY_SCALER.is_experience_reward_current(enemy),
		"stage": stage,
		"difficulty": String(difficulty),
		"final_score": float(experience.get("final_score", 0.0)),
		"threat_weight": float(experience.get("threat_weight", 0.0)),
		"reward_units_per_kill": float(experience.get("reward_units", 0.0)),
		"realized_population": realized_population,
		"expected_ordinary_units": expected_units,
		"xp_required": xp_required,
		"xp_bucket_ratio": expected_units / float(xp_required) if xp_required > 0 else 0.0,
		"population_plan_signature": String(experience.get("population_plan_signature", "")),
		"combat_projection_revision": int(experience.get("combat_projection_revision", 0)),
	}
	enemy.free()
	return result


func _load_json(path: String) -> Dictionary:
	if path.is_empty() or not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	return parsed if parsed is Dictionary else {}


func _test_mana_tempo() -> void:
	var baseline := _mana_row("l3_mana_floor", {"hp": 0, "damage": 0, "mana": 0})
	var invested := _mana_row("l3_mana_lesson", {"hp": 0, "damage": 0, "mana": 5})
	_expect(int(baseline.get("casts", 0)) >= 12, "baseline Mana supports repeated Soul Echo use over a three-minute window")
	_expect(int(invested.get("casts", 0)) > int(baseline.get("casts", 0)), "five learned Mana points cross a real three-minute cast breakpoint")
	_expect(float(invested.get("max_resource", 0.0)) > float(baseline.get("max_resource", 0.0)), "Mana allocation changes the same effective resource pool used by tempo simulation")


func _test_loot_disclosure() -> void:
	_expect(COMPLEXITY.get_tier_profile_errors().is_empty(), "the 100-stage loot ladder is gap-free and only references LIVE effects")
	var expected_caps := {
		1: &"normal",
		2: &"magic",
		3: &"magic",
		4: &"rare",
		5: &"rare",
		6: &"epic",
		9: &"epic",
		10: &"legendary",
		20: &"legendary",
		21: &"crystal",
		40: &"crystal",
		41: &"mythic",
		70: &"mythic",
		71: &"eternal",
		100: &"eternal",
	}
	var previous_cap_index := -1
	for stage: int in range(1, 101):
		var locked := COMPLEXITY.policy_for_stage(stage, {})
		var unlocked := COMPLEXITY.policy_for_stage(stage, {"soul_hero": true})
		var cap_index := RARITY.rarity_index(locked.get("rarity_cap", &"normal"))
		_expect(bool(locked.get("valid", false)), "L%d produces a valid loot policy" % stage)
		_expect(cap_index >= previous_cap_index, "L%d rarity disclosure never moves backward" % stage)
		previous_cap_index = cap_index
		if expected_caps.has(stage):
			_expect(StringName(locked.get("rarity_cap", &"")) == expected_caps[stage], "L%d owns the authored rarity cap" % stage)
		_expect(
			not bool(locked.get("random_hero_soul_enabled", false)),
			"L%d cannot roll a random Hero Soul without its entitlement" % stage,
		)
		_expect(
			bool(unlocked.get("random_hero_soul_enabled", false)) == (stage >= 5),
			"L%d Hero Soul rolls require both the lesson stage and entitlement" % stage,
		)
		if stage in [1, 2, 3, 4, 5, 6, 10, 21, 41, 71, 100]:
			_loot_rows.append({
				"stage": stage,
				"locked": COMPLEXITY.metadata_for_payload(locked),
				"hero_soul_unlocked": COMPLEXITY.metadata_for_payload(unlocked),
			})
	var stage_one := COMPLEXITY.policy_for_stage(1, {"soul_hero": true})
	var stage_two := COMPLEXITY.policy_for_stage(2, {"soul_hero": true})
	var stage_four := COMPLEXITY.policy_for_stage(4, {"soul_hero": true})
	var stage_five := COMPLEXITY.policy_for_stage(5, {"soul_hero": true})
	var stage_six := COMPLEXITY.policy_for_stage(6, {"soul_hero": true})
	var stage_seven := COMPLEXITY.policy_for_stage(7, {"soul_hero": true})
	_expect(PackedStringArray(stage_one.get("allowed_random_families", [])).size() == 1 and not bool(stage_one.get("random_auxiliary_enabled", true)), "L1 keeps the reward lesson to one material family")
	_expect(PackedStringArray(stage_two.get("allowed_auxiliary_slots", [])).size() == 1, "L2 introduces exactly one auxiliary slot")
	_expect(PackedStringArray(stage_four.get("allowed_auxiliary_slots", [])) == PackedStringArray(["soul_vessel", "soul_boots"]), "L4 adds Boots without exposing Jewelry early")
	_expect(PackedStringArray(stage_five.get("allowed_hero_soul_affixes", [])).size() == 4, "L5 Hero Soul starts with four readable core affixes")
	_expect(PackedStringArray(stage_six.get("allowed_auxiliary_slots", [])) == PackedStringArray(["soul_vessel", "soul_boots"]), "L6 keeps Jewelry gated until its authored level-seven unlock")
	_expect(PackedStringArray(stage_seven.get("allowed_auxiliary_slots", [])) == PackedStringArray(["soul_vessel", "soul_boots", "soul_trace"]), "L7 opens the complete Armor, Boots, and Jewelry set")
	_expect(PackedStringArray(stage_six.get("allowed_hero_soul_affixes", [])).size() > PackedStringArray(stage_five.get("allowed_hero_soul_affixes", [])).size(), "L6 expands Hero Soul affixes only after the core lesson")


func _mana_row(row_id: String, allocation: Dictionary) -> Dictionary:
	var snapshot := HERO_COMBAT.project_hero_combat(_save_snapshot(3, allocation), SWORD)
	var tempo := MODEL.resource_tempo(
		float(snapshot.get("mana", 0.0)),
		HERO_COMBAT.BASE_MANA_REGEN_PER_SECOND,
		SWORD.active_skill_mana_cost,
		SWORD.active_skill_cooldown_seconds,
		180.0,
	)
	tempo["id"] = row_id
	tempo["allocation"] = allocation.duplicate(true)
	_resource_rows.append(tempo.duplicate(true))
	return tempo


func _sword_actions(save_snapshot: Dictionary) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for index: int in SWORD.combo_step_count():
		var projection := HERO_COMBAT.project_hero_action_damage(
			save_snapshot,
			SWORD,
			PROGRESSION.SKILL_TRACK_NORMAL_ATTACK,
			float(SWORD.combo_damage(index + 1)),
		)
		if projection.is_empty():
			continue
		result.append({
			"id": StringName("sword_%d" % (index + 1)),
			"request": (projection.get("request", {}) as Dictionary).duplicate(true),
			"duration_seconds": SWORD.combo_action_durations[index],
			"hit_time_seconds": SWORD.combo_hit_windows[index].x,
		})
	return result


func _save_snapshot(player_level: int, allocation: Dictionary) -> Dictionary:
	return {
		"progression": {
			"player": {
				"level": player_level,
				"xp": 0,
				"stat_allocation": allocation.duplicate(true),
				"skill_allocations": {},
			},
		},
		"inventory": {
			"auxiliary_equipment": [],
			"hero_soul_instances": [],
		},
		"auxiliary_loadout": {
			"soul_vessel": "",
			"soul_boots": "",
			"soul_trace": "",
		},
		"soul_team": {
			"selected_soul_instances": {},
		},
	}


func _row(row_id: StringName) -> Dictionary:
	for row: Dictionary in _rows:
		if StringName(row.get("id", "")) == row_id:
			return row
	return {}


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _write_report() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var report := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if report == null:
		_expect(false, "balance matrix report opens for writing")
		return
	report.store_string(JSON.stringify({
		"ok": _failures.is_empty(),
		"formula_version": 1,
		"checks": _checks,
		"failures": _failures,
		"combat_rows": _rows,
		"xp_rows": _xp_rows,
		"resource_rows": _resource_rows,
		"loot_rows": _loot_rows,
	}, "\t") + "\n")
	report.close()
