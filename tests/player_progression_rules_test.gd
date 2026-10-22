extends SceneTree

const RULES := preload("res://game/meta/progression/player_progression_rules.gd")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_point_economy_and_caps()
	_test_stat_curve_and_snapshots()
	_test_level_growth_curve()
	_test_milestone_tables()
	_test_skill_identity_allocations()
	_test_respec_rules()

	if _failures.is_empty():
		print("PLAYER PROGRESSION RULES TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("PLAYER PROGRESSION RULES TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)


func _test_point_economy_and_caps() -> void:
	_expect(RULES.STAT_POINTS_PER_LEVEL == 5, "Every player level grants five Stat Points")
	_expect(RULES.SKILL_POINTS_PER_LEVEL == 2, "Every player level grants two specialization Skill Points")
	_expect(RULES.earned_stat_points(0) == 0, "Level zero grants no Stat Points")
	_expect(RULES.earned_stat_points(1) == 5, "Level one grants its first five Stat Points")
	_expect(RULES.earned_stat_points(100) == 500, "Level 100 grants 500 total Stat Points")
	_expect(RULES.earned_stat_points(101) == 500, "Stat Point earnings stop at the level-100 cap")
	_expect(RULES.earned_skill_points(0) == 0, "Level zero grants no Skill Points")
	_expect(RULES.earned_skill_points(1) == 2, "Level one grants its first two Skill Points")
	_expect(RULES.earned_skill_points(100) == 200, "Level 100 grants 200 total Skill Points")
	_expect(RULES.earned_skill_points(101) == 200, "Skill Point earnings stop at the level-100 cap")
	_expect(RULES.STAT_POINT_CAP == 200, "Every investable stat has a 200-point cap")
	_expect(RULES.SKILL_RANK_CAP == 20, "Every skill track has a rank-20 cap")

	var caps: Dictionary = RULES.global_caps()
	_expect(int(caps.get("player_level", 0)) == 100, "Global progression caps expose the level-100 ceiling")
	_expect(int(caps.get("stat_points_per_stat", 0)) == 200, "Global progression caps expose the per-stat ceiling")
	_expect(int(caps.get("earned_stat_points", 0)) == 500, "Global progression caps expose the 500 Stat Point ceiling")
	_expect_close(float(caps.get("hp_stat_bonus", 0.0)), 19416.124420110527, "Global progression caps expose the large-number diminishing HP sum")
	_expect_close(float(caps.get("core_damage_bonus_percent", 0.0)), 554.746412003158, "Global progression caps expose the diminishing Power sum")
	_expect_close(float(caps.get("mana_stat_bonus", 0.0)), 970.8062210055264, "Global progression caps expose the diminishing Mana sum")
	_expect(int(caps.get("earned_skill_points", 0)) == 200, "Global progression caps expose the 200 Skill Point ceiling")
	_expect(int(caps.get("skill_tracks_per_identity", 0)) == 6, "Global progression caps expose six tracks per Hero Identity")
	_expect(int(caps.get("skill_rank_per_track", 0)) == 20, "Global progression caps expose rank 20 per track")
	_expect(int(caps.get("skill_points_per_identity", 0)) == 120, "A Hero Identity needs 120 Skill Points to max")
	_expect(int(caps.get("minimum_build_skill_capacity", 0)) == 240, "The minimum two-Hero build exposes 240 rank slots")
	_expect(int(caps.get("endgame_specialization_gap", 0)) == 40, "The endgame budget leaves forty deliberate build choices unfilled")
	_expect(int(caps.get("respec_cost", 0)) == 2500, "Global progression caps expose the 2,500 gold respec ceiling")

	var combat_caps: Dictionary = RULES.global_combat_caps()
	_expect_close(float(combat_caps.get("cooldown_reduction_percent", 0.0)), 35.0, "Global cooldown reduction caps at 35 percent")
	_expect_close(float(combat_caps.get("dodge_chance_percent", 0.0)), 20.0, "Visible dodge chance caps at 20 percent")
	_expect_close(float(combat_caps.get("barrier_capacity_percent", 0.0)), 40.0, "Visible Barrier capacity caps at 40 percent Max HP")
	_expect(not combat_caps.has("damage_reduction_percent"), "Global combat caps expose no hidden damage-reduction channel")
	_expect_close(float(combat_caps.get("bonus_attack_speed_percent", 0.0)), 60.0, "Global bonus attack speed caps at 60 percent")
	_expect_close(float(combat_caps.get("critical_chance_percent", 0.0)), 60.0, "Global critical chance caps at 60 percent")
	caps["player_level"] = 1
	_expect(int(RULES.global_caps().get("player_level", 0)) == 100, "Global cap snapshots cannot mutate the rules contract")


func _test_stat_curve_and_snapshots() -> void:
	_expect(RULES.CORE_STAT_IDS == [&"hp", &"mana", &"damage"], "allocation preserves the stable HP, Mana and Power storage keys")
	var core_definitions := RULES.core_stat_definitions()
	_expect(core_definitions.size() == 3, "the player-facing base-stat schema has no fourth stat")
	_expect(String((core_definitions["damage"] as Dictionary).get("display_name", "")) == "POWER", "the stable damage key is presented to players as Power")
	for stat_id: StringName in RULES.CORE_STAT_IDS:
		_expect(not bool((core_definitions[String(stat_id)] as Dictionary).get("has_secondary_effects", true)), "%s is a plain numeric stat without secondary effects" % stat_id)
	_expect_close(RULES.stat_point_return(&"hp", 1), 140.0, "HP point one grants 140 Max HP")
	_expect_close(RULES.stat_point_return(&"hp", 200), 70.0, "HP point 200 returns exactly half of point one")
	_expect_close(RULES.stat_point_return(&"hp", 201), 0.0, "HP point 201 is beyond the stat cap")
	_expect_close(RULES.stat_point_return(&"damage", 1), 4.0, "Power point one grants four percentage points")
	_expect_close(RULES.stat_point_return(&"damage", 200), 2.0, "Power point 200 returns exactly half of point one")
	_expect_close(RULES.stat_point_return(&"mana", 1), 7.0, "Mana point one grants seven Max Mana")
	_expect_close(RULES.stat_point_return(&"mana", 200), 3.5, "Mana point 200 returns exactly half of point one")
	_expect_close(RULES.stat_point_return(&"unknown", 1), 0.0, "Unknown stats grant no point return")

	_expect_close(RULES.stat_bonus(&"hp", 100), 11366.329566288975, "100 HP points sum every full-precision diminishing marginal")
	_expect_close(RULES.stat_bonus(&"hp", 150), 15680.956860807732, "150 HP points remain monotonic without a tier breakpoint")
	_expect_close(RULES.stat_bonus(&"hp", 200), 19416.124420110527, "200 HP points reach the derived diminishing cap")
	_expect_close(RULES.stat_bonus(&"damage", 100), 324.7522733225422, "100 Power points sum the shared curve")
	_expect_close(RULES.stat_bonus(&"damage", 150), 448.02733888022096, "150 Power points sum the shared curve")
	_expect_close(RULES.stat_bonus(&"damage", 200), 554.746412003158, "200 Power points reach the derived diminishing cap")
	_expect_close(RULES.stat_bonus(&"mana", 100), 568.3164783144488, "100 Mana points sum the shared curve")
	_expect_close(RULES.stat_bonus(&"mana", 150), 784.0478430403866, "150 Mana points sum the shared curve")
	_expect_close(RULES.stat_bonus(&"mana", 200), 970.8062210055264, "200 Mana points reach the derived diminishing cap")
	_expect_close(RULES.damage_from_core(20.0, 200), 130.9492824006316, "Power points multiply shared attack power instead of adding flat hit damage")
	_expect_close(RULES.damage_from_core(-20.0, 200), 0.0, "Core Damage cannot become negative")
	_expect_close(RULES.MAX_HP_STAT_BONUS, RULES.stat_bonus(&"hp", 200), "public HP cap matches the curve sum")
	_expect_close(RULES.MAX_CORE_DAMAGE_BONUS_PERCENT, RULES.stat_bonus(&"damage", 200), "public Power cap matches the curve sum")
	_expect_close(RULES.MAX_MANA_STAT_BONUS, RULES.stat_bonus(&"mana", 200), "public Mana cap matches the curve sum")

	for stat_id: StringName in RULES.CORE_STAT_IDS:
		var previous_return := INF
		var cumulative := 0.0
		var positive_and_strictly_decreasing := true
		var cumulative_matches := true
		for point_index: int in range(1, RULES.STAT_POINT_CAP + 1):
			var marginal := RULES.stat_point_return(stat_id, point_index)
			positive_and_strictly_decreasing = positive_and_strictly_decreasing \
				and marginal > 0.0 and marginal < previous_return
			cumulative += marginal
			cumulative_matches = cumulative_matches \
				and is_equal_approx(RULES.stat_bonus(stat_id, point_index), cumulative)
			previous_return = marginal
		_expect(positive_and_strictly_decreasing, "%s exhaustively has positive, strictly decreasing returns for points 1..200" % stat_id)
		_expect(cumulative_matches, "%s stat_bonus exhaustively preserves the full-precision marginal sum" % stat_id)

	var allocation := {"hp": 200, "damage": 150, "mana": 150}
	_expect(RULES.validate_stat_allocation(100, allocation), "A 200/150/150 level-100 allocation spends exactly 500 points")
	var snapshot: Dictionary = RULES.stat_snapshot(100, allocation)
	_expect(not snapshot.is_empty(), "A valid capped allocation produces a stat snapshot")
	_expect(int(snapshot.get("spent_points", -1)) == 500, "Stat snapshot records all 500 spent points")
	_expect(int(snapshot.get("unspent_points", -1)) == 0, "Stat snapshot records no unspent points at 500 spent")
	_expect_close(float(snapshot.get("hp", 0.0)), 33021.531667115986, "Stat snapshot combines smooth level growth and diminishing HP returns")
	_expect_close(float(snapshot.get("damage", 0.0)), 1096.054677760442, "Stat snapshot derives offense exclusively from diminishing Power returns")
	_expect_close(float(snapshot.get("mana", 0.0)), 1514.3182053906596, "Stat snapshot combines smooth level growth and diminishing Mana returns")
	var direct_milestones := snapshot.get("direct_milestone_bonus_percent", {}) as Dictionary
	_expect_close(float(direct_milestones.get("hp", -1.0)), 0.0, "HP allocation has no hidden milestone multiplier")
	_expect_close(float(direct_milestones.get("damage", -1.0)), 0.0, "Power allocation has no hidden milestone multiplier")
	_expect_close(float(direct_milestones.get("mana", -1.0)), 0.0, "Mana allocation has no hidden milestone multiplier")
	_expect((snapshot.get("secondary_effects", []) as Array).is_empty(), "core-stat allocation emits no secondary effects")
	var next_returns := snapshot.get("next_point_returns", {}) as Dictionary
	_expect_close(float(next_returns.get("hp", -1.0)), 0.0, "A capped stat has no next-point return")
	_expect_close(float(next_returns.get("damage", -1.0)), 2.28080229226361, "The next Power point after 150 follows the shared curve")
	_expect_close(float(next_returns.get("mana", -1.0)), 3.991404011461318, "The next Mana point after 150 follows the shared curve")

	_expect(not RULES.validate_stat_allocation(100, {"hp": 201, "damage": 0, "mana": 0}), "One stat cannot exceed 200 points")
	_expect(not RULES.validate_stat_allocation(100, {"hp": 200, "damage": 200, "mana": 101}), "Total stat spending cannot exceed earned points")
	_expect(not RULES.validate_stat_allocation(100, {"hp": 1, "damage": 1}), "All three stat IDs are required")
	_expect(not RULES.validate_stat_allocation(100, {"hp": 1, "damage": 1, "mana": 1, "luck": 1}), "Unknown stat IDs are rejected")
	_expect(not RULES.validate_stat_allocation(100, {"hp": 1.0, "damage": 1, "mana": 1}), "Stat allocations require integer points")
	_expect(not RULES.validate_stat_allocation(100, {"hp": -1, "damage": 1, "mana": 1}), "Negative stat allocations are rejected")
	_expect(not RULES.validate_stat_allocation(0, {"hp": 0, "damage": 0, "mana": 0}), "Player level must be at least one for stat allocation")


func _test_level_growth_curve() -> void:
	var level_one := RULES.level_growth_snapshot(1)
	_expect_close(float(level_one.get("hp_flat", -1.0)), 0.0, "level one starts with no completed-level HP growth")
	_expect(int(level_one.get("surge_count", -1)) == 0, "retired surge count remains a zero compatibility key")
	_expect(int(level_one.get("surge_interval", -1)) == 0, "retired surge interval remains a zero compatibility key")
	_expect(not bool(level_one.get("next_level_is_surge", true)), "retired next-surge flag remains false")

	var previous := level_one
	var hp_curve_valid := true
	var damage_curve_valid := true
	var mana_curve_valid := true
	for level: int in range(2, RULES.PLAYER_LEVEL_CAP + 1):
		var growth := RULES.level_growth_snapshot(level)
		var expected_factor := pow(RULES.LEVEL_GROWTH_DECAY, float(level - 2))
		hp_curve_valid = hp_curve_valid and is_equal_approx(
			float(growth["hp_flat"]) - float(previous["hp_flat"]),
			RULES.HP_PER_PLAYER_LEVEL * expected_factor,
		)
		damage_curve_valid = damage_curve_valid and is_equal_approx(
			float(growth["damage_percent"]) - float(previous["damage_percent"]),
			RULES.DAMAGE_PERCENT_PER_PLAYER_LEVEL * expected_factor,
		)
		mana_curve_valid = mana_curve_valid and is_equal_approx(
			float(growth["mana_flat"]) - float(previous["mana_flat"]),
			RULES.MANA_PER_PLAYER_LEVEL * expected_factor,
		)
		previous = growth
	_expect(hp_curve_valid, "HP growth exhaustively stays positive and decays one percent per level through level 100")
	_expect(damage_curve_valid, "Level damage exhaustively remains zero through level 100")
	_expect(mana_curve_valid, "Mana growth exhaustively stays positive and decays one percent per level through level 100")
	_expect_close(float(previous["hp_flat"]), 12605.40724700546, "level 100 HP growth matches the geometric sum")
	_expect_close(float(previous["damage_percent"]), 0.0, "level 100 grants no automatic offensive power")
	_expect_close(float(previous["mana_flat"]), 630.270362350273, "level 100 Mana growth matches the geometric sum")
	var fixed_power_is_level_invariant := true
	var expected_power := RULES.damage_from_core_with_level(20.0, 1, 37)
	for level: int in range(2, RULES.PLAYER_LEVEL_CAP + 1):
		fixed_power_is_level_invariant = fixed_power_is_level_invariant and is_equal_approx(
			RULES.damage_from_core_with_level(20.0, level, 37),
			expected_power,
		)
	_expect(fixed_power_is_level_invariant, "fixed Power allocation produces identical offense at every player level")


func _test_milestone_tables() -> void:
	var expected_thresholds := [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200]
	_expect(RULES.MILESTONE_THRESHOLDS == expected_thresholds, "Milestone thresholds include 10-100 plus 125, 150, 175, and 200")
	_expect(
		RULES.HP_MILESTONES == [
			"max_hp_5_percent", "defense_5_percent", "healing_and_hp_pickup_effectiveness_10_percent",
			"stagger_resistance_10_percent", "max_hp_5_percent_2", "low_hp_damage_reduction_5_percent",
			"shield_effectiveness_10_percent", "defense_5_percent_2", "hero_skill_healing_received_10_percent",
			"last_soul", "max_hp_5_percent_3", "elite_boss_damage_reduction_5_percent",
			"stagger_resistance_15_percent", "relay_guard_8_percent_max_hp",
		],
		"HP milestones preserve every V0.4 effect in threshold order"
	)
	_expect(
		RULES.DAMAGE_MILESTONES == [
			"critical_chance_2_percent", "attack_speed_5_percent", "critical_damage_10_percent",
			"active_skill_damage_5_percent", "core_damage_5_percent", "summon_damage_6_percent",
			"departure_damage_6_percent", "armor_penetration_5_percent", "elite_boss_damage_8_percent",
			"relay_overdrive_12_percent", "attack_speed_5_percent_2", "critical_chance_4_percent",
			"critical_damage_15_percent", "execution_damage_15_percent",
		],
		"Power compatibility milestones preserve every V0.4 effect in threshold order"
	)
	_expect(
		RULES.MANA_MILESTONES == [
			"mana_regen_1_5_per_second", "active_skill_mana_cost_reduction_5_percent",
			"active_skill_cooldown_recovery_5_percent", "max_mana_5_percent", "mana_regen_1_5_per_second_2",
			"reserve_soul_support_cooldown_reduction_5_percent", "skill_area_and_duration_8_percent",
			"global_skill_cooldown_recovery_5_percent", "relay_restores_max_mana_8_percent",
			"flow_state_15_percent_remaining_cooldown", "max_mana_5_percent_2",
			"all_skill_mana_cost_reduction_8_percent", "global_skill_cooldown_recovery_5_percent_2",
			"soul_reservoir",
		],
		"Mana milestones preserve every V0.4 effect in threshold order"
	)

	_expect_milestone_table(RULES.HP_MILESTONES, RULES.HP_MILESTONE_TABLE, "HP")
	_expect_milestone_table(RULES.DAMAGE_MILESTONES, RULES.DAMAGE_MILESTONE_TABLE, "Damage")
	_expect_milestone_table(RULES.MANA_MILESTONES, RULES.MANA_MILESTONE_TABLE, "Mana")
	_expect(RULES.unlocked_milestones(9, RULES.HP_MILESTONES).is_empty(), "No milestone unlocks before 10 points")
	_expect(RULES.unlocked_milestones(10, RULES.HP_MILESTONES).size() == 1, "The first milestone unlocks at 10 points")
	_expect(RULES.unlocked_milestones(100, RULES.HP_MILESTONES).size() == 10, "The ten early milestones unlock through 100 points")
	_expect(RULES.unlocked_milestones(124, RULES.HP_MILESTONES).size() == 10, "The next milestone waits until 125 points")
	_expect(RULES.unlocked_milestones(125, RULES.HP_MILESTONES).size() == 11, "The eleventh milestone unlocks at 125 points")
	_expect(RULES.unlocked_milestones(150, RULES.DAMAGE_MILESTONES).size() == 12, "The twelfth milestone unlocks at 150 points")
	_expect(RULES.unlocked_milestones(175, RULES.MANA_MILESTONES).size() == 13, "The thirteenth milestone unlocks at 175 points")
	_expect(RULES.unlocked_milestones(199, RULES.HP_MILESTONES).size() == 13, "The final milestone waits until 200 points")
	_expect(RULES.unlocked_milestones(200, RULES.HP_MILESTONES).size() == 14, "All fourteen milestones unlock at 200 points")
	_expect(RULES.unlocked_milestones(999, RULES.HP_MILESTONES).size() == 14, "Milestone unlocks clamp to the 200-point cap")
	_expect_close(RULES.direct_core_milestone_bonus_percent(&"hp", 9), 0.0, "Direct HP milestone waits for point ten")
	_expect_close(RULES.direct_core_milestone_bonus_percent(&"hp", 10), 0.0, "legacy HP milestone IDs are inert")
	_expect_close(RULES.direct_core_milestone_bonus_percent(&"hp", 125), 0.0, "legacy HP milestones never modify the core stat")
	_expect_close(RULES.direct_core_milestone_bonus_percent(&"damage", 49), 0.0, "Direct Core-Damage milestone waits for point fifty")
	_expect_close(RULES.direct_core_milestone_bonus_percent(&"damage", 50), 0.0, "legacy DMG milestone IDs are inert")
	_expect_close(RULES.direct_core_milestone_bonus_percent(&"mana", 39), 0.0, "Direct Max-Mana milestone waits for point forty")
	_expect_close(RULES.direct_core_milestone_bonus_percent(&"mana", 125), 0.0, "legacy Mana milestones never modify the core stat")

	var hp_table: Array = RULES.milestone_table(&"hp")
	var last_hp_entry := hp_table[13] as Dictionary
	_expect(String(last_hp_entry.get("id", "")) == "relay_guard_8_percent_max_hp", "HP 200 exposes Relay Guard details")
	_expect(String(last_hp_entry.get("description", "")).contains("12-second"), "Relay Guard includes its 12-second internal cooldown")
	var flow_entries: Array[Dictionary] = RULES.unlocked_milestone_entries(100, RULES.MANA_MILESTONE_TABLE)
	_expect(String(flow_entries[9].get("id", "")) == "flow_state_15_percent_remaining_cooldown", "Mana 100 exposes Flow State details")
	hp_table[0]["threshold"] = 999
	_expect(int((RULES.milestone_table(&"hp")[0] as Dictionary).get("threshold", 0)) == 10, "Milestone table snapshots cannot mutate the rules contract")


func _test_skill_identity_allocations() -> void:
	_expect(
		_track_id_strings() == [
			"normal_attack", "active_skill", "dash", "soul_ready_condition", "summon_skill", "departure_skill",
		],
		"Every Hero Identity uses the six standard V0.4 skill tracks"
	)
	var empty_tracks: Dictionary = RULES.empty_skill_tracks()
	_expect(empty_tracks.size() == 6, "An empty Hero Identity allocation contains exactly six tracks")
	for track_id: StringName in RULES.SKILL_TRACK_IDS:
		_expect(int(empty_tracks.get(String(track_id), -1)) == 0, "Empty track '%s' starts at rank zero" % track_id)

	_expect(RULES.skill_rank_gate(0) == 1, "The clamped rank-gate formula has a minimum of one")
	_expect(RULES.skill_rank_gate(1) == 1, "Levels 1-5 cap tracks at rank one")
	_expect(RULES.skill_rank_gate(5) == 1, "Level five remains rank one")
	_expect(RULES.skill_rank_gate(6) == 2, "Level six opens rank two")
	_expect(RULES.skill_rank_gate(25) == 5, "Level 25 opens rank five")
	_expect(RULES.skill_rank_gate(50) == 10, "Level 50 opens rank ten")
	_expect(RULES.skill_rank_gate(75) == 15, "Level 75 opens rank fifteen")
	_expect(RULES.skill_rank_gate(96) == 20, "Level 96 opens rank twenty")
	_expect(RULES.skill_rank_gate(100) == 20, "Level 100 remains rank twenty")
	_expect(RULES.skill_rank_gate(101) == 20, "Rank gate stops at twenty beyond the player-level cap")

	var allocations := {
		"sword_hero": _full_tracks(5),
		"axe_hero": _full_tracks(2),
	}
	_expect(RULES.validate_skill_allocations(25, allocations), "Two Hero Identities can own independent legal rank allocations")
	_expect(RULES.validate_hero_skill_allocation(25, &"sword_hero", _full_tracks(5)), "A single complete Hero Identity allocation validates")
	var snapshot: Dictionary = RULES.skill_snapshot(25, allocations)
	_expect(int(snapshot.get("spent_points", -1)) == 42, "Skill snapshot sums allocations across Hero Identities")
	_expect(int(snapshot.get("unspent_points", -1)) == 8, "Skill snapshot subtracts spending from the global specialization pool")
	var normalized := snapshot.get("allocations", {}) as Dictionary
	_expect(int((normalized["sword_hero"] as Dictionary).get("dash", -1)) == 5, "Sword Dash rank stays on the Sword Hero Identity")
	_expect(int((normalized["axe_hero"] as Dictionary).get("dash", -1)) == 2, "Axe Dash rank stays independent from Sword")

	var missing_track: Dictionary = _full_tracks(1)
	missing_track.erase("dash")
	_expect(not RULES.validate_hero_skill_allocation(25, &"sword_hero", missing_track), "Every Hero Identity requires all six track IDs")
	var unknown_track: Dictionary = _full_tracks(1)
	unknown_track["ultimate"] = 1
	_expect(not RULES.validate_hero_skill_allocation(25, &"sword_hero", unknown_track), "Unknown skill track IDs are rejected")
	var non_integer_rank: Dictionary = _full_tracks(1)
	non_integer_rank["dash"] = 1.0
	_expect(not RULES.validate_hero_skill_allocation(25, &"sword_hero", non_integer_rank), "Skill ranks must be integers")
	var negative_rank: Dictionary = _full_tracks(1)
	negative_rank["dash"] = -1
	_expect(not RULES.validate_hero_skill_allocation(25, &"sword_hero", negative_rank), "Negative skill ranks are rejected")
	var over_track_cap: Dictionary = _full_tracks(1)
	over_track_cap["dash"] = 21
	_expect(not RULES.validate_hero_skill_allocation(100, &"sword_hero", over_track_cap), "A skill track cannot exceed rank twenty")
	var over_rank_gate: Dictionary = _full_tracks(1)
	over_rank_gate["dash"] = 2
	_expect(not RULES.validate_hero_skill_allocation(5, &"sword_hero", over_rank_gate), "A skill track cannot exceed its player-level rank gate")
	_expect(not RULES.validate_skill_allocations(25, {"Sword Hero": _full_tracks(1)}), "Hero Identity IDs must use lower_snake_case")
	_expect(not RULES.validate_skill_allocations(25, {"1_sword": _full_tracks(1)}), "Hero Identity IDs must begin with a letter")
	_expect(not RULES.validate_skill_allocations(25, {"sword_hero": 5}), "Hero Identity allocations must be dictionaries")
	_expect(not RULES.validate_skill_allocations(0, {}), "Player level must be at least one for skill allocation")
	_expect(not RULES.validate_skill_allocations(1, {"sword_hero": _full_tracks(1)}), "Six ranks cannot spend from a two-point level-one pool")

	var capped_allocations := {
		"sword_hero": _full_tracks(20),
		"axe_hero": _full_tracks(13),
	}
	(capped_allocations["axe_hero"] as Dictionary)["normal_attack"] = 15
	_expect(RULES.validate_skill_allocations(100, capped_allocations), "The global specialization pool accepts exactly 200 allocated Skill Points")
	_expect(int(RULES.skill_snapshot(100, capped_allocations).get("spent_points", -1)) == 200, "Skill snapshot records the exact 200-point global ceiling")
	(capped_allocations["axe_hero"] as Dictionary)["active_skill"] = 14
	_expect(not RULES.validate_skill_allocations(100, capped_allocations), "Allocations across Identities cannot exceed the global 200-point pool")
	_expect(RULES.maximum_skill_ranks(25, 1) == 30, "One level-25 Identity is gated to thirty total ranks")
	_expect(RULES.maximum_skill_ranks(100, 1) == 120, "One Identity is capped by its 120 authored ranks")
	_expect(RULES.maximum_skill_ranks(100, 2) == 200, "Two Identities are capped by the 200-point specialization pool")
	_expect(RULES.maximum_skill_ranks(100, 5) == 200, "Adding Identities expands choice without inflating the global pool")
	var level_six_budget := RULES.skill_budget_snapshot(6, 2)
	_expect(
		int(level_six_budget.get("earned_points", 0)) == 12 \
			and int(level_six_budget.get("available_rank_capacity", 0)) == 24 \
			and int(level_six_budget.get("specialization_gap", 0)) == 12,
		"Level 6 opens twenty-four two-Hero rank choices for twelve earned points",
	)
	var endgame_budget := RULES.skill_budget_snapshot(100, 2)
	_expect(
		int(endgame_budget.get("earned_points", 0)) == 200 \
			and int(endgame_budget.get("available_rank_capacity", 0)) == 240 \
			and int(endgame_budget.get("specialization_gap", 0)) == 40,
		"Level 100 preserves a forty-rank specialization gap for the minimum roster",
	)
	var expanded_roster_budget := RULES.skill_budget_snapshot(100, 3)
	_expect(
		int(expanded_roster_budget.get("earned_points", 0)) == 200 \
			and int(expanded_roster_budget.get("available_rank_capacity", 0)) == 360,
		"A third Hero adds rank capacity without inflating earned Skill Points",
	)
	_expect(not bool(RULES.skill_budget_snapshot(0, 2).get("valid", true)), "Invalid Skill budget inputs fail closed")

	_expect(RULES.can_upgrade_skill(0, 1, 1), "One available point can buy rank one at level one")
	_expect(not RULES.can_upgrade_skill(1, 1, 1), "Level one cannot buy rank two")
	_expect(RULES.can_upgrade_skill(1, 1, 6), "Level six can buy rank two")
	_expect(not RULES.can_upgrade_skill(2, 1, 6), "Level six cannot buy rank three")
	_expect(not RULES.can_upgrade_skill(0, 0, 100), "A skill cannot upgrade without an available point")
	_expect(not RULES.can_upgrade_skill(-1, 1, 100), "A negative current rank cannot upgrade")
	_expect(not RULES.can_upgrade_skill(20, 1, 100), "Rank twenty is a hard skill cap")

	var open_upgrade := {"sword_hero": _full_tracks(0)}
	_expect(RULES.can_upgrade_hero_skill(6, &"sword_hero", &"dash", open_upgrade), "A valid Identity track upgrades when gate and pool allow")
	(open_upgrade["sword_hero"] as Dictionary)["dash"] = 2
	_expect(not RULES.can_upgrade_hero_skill(6, &"sword_hero", &"dash", open_upgrade), "A track at its current rank gate cannot upgrade")
	var exhausted_pool := {"sword_hero": _full_tracks(0)}
	(exhausted_pool["sword_hero"] as Dictionary)["normal_attack"] = 1
	(exhausted_pool["sword_hero"] as Dictionary)["active_skill"] = 1
	_expect(not RULES.can_upgrade_hero_skill(1, &"sword_hero", &"departure_skill", exhausted_pool), "An Identity cannot upgrade when the global pool is exhausted")
	_expect(not RULES.can_upgrade_hero_skill(100, &"sword_hero", &"ultimate", open_upgrade), "Unknown Hero skill tracks cannot upgrade")


func _test_respec_rules() -> void:
	_expect(RULES.respec_cost(-1) == 0, "Invalid pre-level values do not charge for respec")
	_expect(RULES.respec_cost(1) == 0, "Early-game respec is free")
	_expect(RULES.respec_cost(20) == 0, "Respec remains free through level 20")
	_expect(RULES.respec_cost(21) == 625, "Level-21 respec follows 100 + level times 25")
	_expect(RULES.respec_cost(95) == 2475, "Respec cost follows the formula before its cap")
	_expect(RULES.respec_cost(96) == 2500, "Respec cost reaches its 2,500 gold cap at level 96")
	_expect(RULES.respec_cost(100) == 2500, "Level-100 respec stays at the 2,500 gold cap")
	_expect(RULES.respec_cost(999) == 2500, "Respec cost never exceeds 2,500 gold")

	var allocations := {
		"sword_hero": _full_tracks(3),
		"axe_hero": _full_tracks(2),
	}
	var transaction: Dictionary = RULES.respec_hero_identity(25, &"sword_hero", allocations, true)
	_expect(not transaction.is_empty(), "A per-Identity respec is available outside combat")
	_expect(int(transaction.get("cost", -1)) == 725, "Per-Identity respec reports the shared level-based gold cost")
	_expect(int(transaction.get("refunded_points", -1)) == 18, "Per-Identity respec refunds all six Sword track ranks")
	var updated := transaction.get("allocations", {}) as Dictionary
	_expect(_rank_sum(updated.get("sword_hero", {}) as Dictionary) == 0, "Per-Identity respec resets only the selected Hero Identity")
	_expect(_rank_sum(updated.get("axe_hero", {}) as Dictionary) == 12, "Per-Identity respec preserves every other Hero Identity")
	_expect(RULES.respec_hero_identity(25, &"sword_hero", allocations, false).is_empty(), "Respec is unavailable during combat")
	_expect(RULES.respec_hero_identity(25, &"missing_hero", allocations, true).is_empty(), "Respec requires an allocated Hero Identity")


func _expect_milestone_table(ids: Array, table: Array, label: String) -> void:
	_expect(table.size() == 14, "%s milestone table has all fourteen records" % label)
	if table.size() != 14:
		return
	for index: int in table.size():
		var entry := table[index] as Dictionary
		_expect(int(entry.get("threshold", -1)) == int(RULES.MILESTONE_THRESHOLDS[index]), "%s milestone %d uses the canonical threshold" % [label, index + 1])
		_expect(String(entry.get("id", "")) == String(ids[index]), "%s milestone %d ID matches its stable effect ID" % [label, index + 1])
		_expect(not String(entry.get("description", "")).is_empty(), "%s milestone %d includes runtime/UI effect details" % [label, index + 1])


func _full_tracks(rank: int) -> Dictionary:
	var tracks := {}
	for track_id: StringName in RULES.SKILL_TRACK_IDS:
		tracks[String(track_id)] = rank
	return tracks


func _track_id_strings() -> Array[String]:
	var result: Array[String] = []
	for track_id: StringName in RULES.SKILL_TRACK_IDS:
		result.append(String(track_id))
	return result


func _rank_sum(tracks: Dictionary) -> int:
	var total := 0
	for track_id: StringName in RULES.SKILL_TRACK_IDS:
		total += int(tracks.get(String(track_id), 0))
	return total


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(is_equal_approx(actual, expected), message + " (expected %.4f, got %.4f)" % [expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
	else:
		_failures.append(message)
