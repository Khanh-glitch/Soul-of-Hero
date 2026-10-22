extends SceneTree

const PACK_RULES := preload("res://game/content/encounters/encounter_pack_rules.gd")
const ENEMY_SCALER := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")
const SPIKES_SCENE: PackedScene = preload("res://game/world/hazards/spikes.tscn")
const SKELETON_SCENE: PackedScene = preload("res://game/characters/enemies/skeleton_enemy.tscn")
const DUNGEON_SCENE: PackedScene = preload("res://game/levels/crypt_entrance.tscn")

const LEVEL_ONE_PATH := "res://data/levels/crypt_entrance.json"
const FAMILY_TYPES := ["skeleton", "skeleton_reaper", "vampire"]
const EXCLUDED_TYPES := [
	"crimson_reaper", "bone_reaper_captain", "hooded_archer_miniboss", "vampire_castellan",
]

var _checks := 0
var _failures: Array[String] = []


class TrapPlayer extends CharacterBody2D:
	var health := 100

	func _init() -> void:
		add_to_group(&"player")

	func take_damage(amount: int, _source_position := Vector2.ZERO) -> bool:
		health = maxi(0, health - amount)
		return true


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_pack_rules()
	_test_extensible_family_catalog()
	_test_early_stage_disclosure()
	_test_authored_level_one_projection()
	_test_authored_override_authority()
	_test_late_level_pack_projection()
	await _test_live_neutral_trap_damage()
	await _test_pursuit_and_dungeon_palette()
	_finish()


func _test_pack_rules() -> void:
	var expected_easy_shapes := {
		1: {"packs": 1, "members": 5, "total": 15},
		2: {"packs": 1, "members": 6, "total": 18},
		3: {"packs": 1, "members": 7, "total": 21},
		4: {"packs": 2, "members": 4, "total": 24},
		5: {"packs": 2, "members": 5, "total": 30},
		6: {"packs": 2, "members": 6, "total": 36},
		7: {"packs": 2, "members": 7, "total": 42},
		8: {"packs": 2, "members": 8, "total": 48},
		9: {"packs": 3, "members": 6, "total": 54},
		10: {"packs": 3, "members": 7, "total": 63},
	}
	var expected_easy_weights := {
		1: {"skeleton": 1.00, "skeleton_reaper": 0.00, "vampire": 0.00},
		2: {"skeleton": 1.00, "skeleton_reaper": 0.00, "vampire": 0.00},
		3: {"skeleton": 0.90, "skeleton_reaper": 0.10, "vampire": 0.00},
		4: {"skeleton": 0.75, "skeleton_reaper": 0.25, "vampire": 0.00},
		5: {"skeleton": 0.68, "skeleton_reaper": 0.25, "vampire": 0.07},
		6: {"skeleton": 0.60, "skeleton_reaper": 0.27, "vampire": 0.13},
		7: {"skeleton": 0.53, "skeleton_reaper": 0.29, "vampire": 0.18},
		8: {"skeleton": 0.46, "skeleton_reaper": 0.31, "vampire": 0.23},
		9: {"skeleton": 0.39, "skeleton_reaper": 0.33, "vampire": 0.28},
		10: {"skeleton": 0.32, "skeleton_reaper": 0.34, "vampire": 0.34},
	}
	var previous_easy_total := 0
	var previous_weights := {
		"skeleton": 1.0, "skeleton_reaper": 0.0, "vampire": 0.0,
	}
	var family_introduced := {
		"skeleton": true, "skeleton_reaper": false, "vampire": false,
	}
	for stage: int in range(1, 11):
		var expected_shape: Dictionary = expected_easy_shapes[stage]
		var stage_easy := PACK_RULES.get_pack_plan(stage, &"easy", 3)
		_expect(int(stage_easy.packs_per_floor) == int(expected_shape.packs), "Level %d Easy uses its authored packs-per-floor rung" % stage)
		_expect(int(stage_easy.members_per_pack) == int(expected_shape.members), "Level %d Easy uses its authored members-per-pack rung" % stage)
		_expect(int(stage_easy.total_members) == int(expected_shape.total), "Level %d Easy resolves the canonical three-floor population" % stage)
		if previous_easy_total > 0:
			var adjacent_ratio := float(stage_easy.total_members) / float(previous_easy_total)
			_expect(adjacent_ratio <= 1.25001, "Level %d Easy population grows by no more than 1.25x its preceding lesson" % stage)
		previous_easy_total = int(stage_easy.total_members)

		var stage_weights := PACK_RULES.get_family_weights(stage, &"easy")
		var expected_weights: Dictionary = expected_easy_weights[stage]
		var weight_sum := 0.0
		for family: String in FAMILY_TYPES:
			var family_weight := float(stage_weights[family])
			weight_sum += family_weight
			_expect(is_equal_approx(family_weight, float(expected_weights[family])), "Level %d Easy keeps the authored %s disclosure weight" % [stage, family])
			if family_weight > 0.0:
				family_introduced[family] = true
			if bool(family_introduced[family]):
				_expect(family_weight > 0.0, "Level %d never removes the already-introduced %s family" % [stage, family])
		_expect(is_equal_approx(weight_sum, 1.0), "Level %d Easy family weights remain normalized" % stage)
		_expect(float(stage_weights.skeleton) <= float(previous_weights.skeleton), "Level %d Skeleton share never rises after a harder family is disclosed" % stage)
		_expect(float(stage_weights.skeleton_reaper) >= float(previous_weights.skeleton_reaper), "Level %d Bone Reaper share is monotonic" % stage)
		_expect(float(stage_weights.vampire) >= float(previous_weights.vampire), "Level %d Vampire share is monotonic" % stage)
		previous_weights = stage_weights

	var easy := PACK_RULES.get_pack_plan(1, &"easy", 3)
	_expect(int(easy.packs_per_floor) == 1, "Level 1 Easy owns one readable encounter pack per floor")
	_expect(int(easy.members_per_pack) == 5, "Level 1 Easy owns exactly five enemies per pack")
	_expect(int(easy.total_packs) == 3, "three authored floors resolve to three Level 1 packs")
	_expect(int(easy.total_members) == 15, "Level 1 runtime count derives to 15 from 3 floors x 1 pack x 5 enemies")

	var weights := PACK_RULES.get_family_weights(1, &"easy")
	var weight_sum := float(weights.skeleton) + float(weights.skeleton_reaper) + float(weights.vampire)
	_expect(is_equal_approx(weight_sum, 1.0), "Level 1 family weights are normalized")
	_expect(float(weights.skeleton) == 1.0, "Level 1 family pressure is entirely Skeleton")
	_expect(float(weights.skeleton_reaper) == 0.0 and float(weights.vampire) == 0.0, "Level 1 cannot roll a family before its authored lesson")
	var level_two_weights := PACK_RULES.get_family_weights(2, &"hard")
	_expect(float(level_two_weights.skeleton) == 1.0, "Level 2 Hard still reinforces the Skeleton lesson")
	_expect(float(level_two_weights.skeleton_reaper) == 0.0 and float(level_two_weights.vampire) == 0.0, "difficulty cannot leak locked families into Level 2")
	var level_three_weights := PACK_RULES.get_family_weights(3, &"hard")
	_expect(float(level_three_weights.skeleton_reaper) > 0.0, "Level 3 unlocks Bone Reaper runtime rolls after its authored introduction")
	_expect(float(level_three_weights.vampire) == 0.0, "Vampire runtime weight remains exactly zero through Level 3")
	for stage: int in range(1, 4):
		var rolls_respect_lessons := true
		for difficulty: String in ["easy", "medium", "hard"]:
			for slot_index: int in 64:
				var family := PACK_RULES.roll_family(
					stage, StringName(difficulty), "early_family_gate", "pack_%d" % stage, slot_index
				)
				if (stage < 3 and family != PACK_RULES.SWORDSMAN) or family == PACK_RULES.VAMPIRE:
					rolls_respect_lessons = false
		_expect(rolls_respect_lessons, "Level %d deterministic family rolls cannot bypass lesson gates" % stage)
	var late_weights := PACK_RULES.get_family_weights(10, &"easy")
	_expect(float(late_weights.skeleton_reaper) > float(weights.skeleton_reaper), "Bone Reaper share rises clearly across later levels")
	_expect(float(late_weights.vampire) > float(weights.vampire), "Vampire share rises clearly across later levels")

	var medium := PACK_RULES.get_pack_plan(1, &"medium", 3)
	var hard := PACK_RULES.get_pack_plan(1, &"hard", 3)
	_expect(int(medium.total_members) > int(easy.total_members), "Medium adds one enemy to every pack")
	_expect(int(hard.total_members) == int(medium.total_members), "early Hard uses combat scaling instead of multiplying pack count")
	for stage: int in range(1, 11):
		var stage_easy := PACK_RULES.get_pack_plan(stage, &"easy", 3)
		var stage_hard := PACK_RULES.get_pack_plan(stage, &"hard", 3)
		var repeated_hard := PACK_RULES.get_pack_plan(stage, &"hard", 3)
		_expect(int(stage_hard.total_packs) == int(stage_easy.total_packs), "Level %d Hard does not add early approach packs" % stage)
		_expect(float(stage_hard.total_members) <= float(stage_easy.total_members) * 1.25, "Level %d Hard population stays within 1.25x Easy" % stage)
		_expect(JSON.stringify(stage_hard) == JSON.stringify(repeated_hard), "Level %d Hard pack plan is deterministic" % stage)
	for stage: int in range(1, 101):
		var stage_easy := PACK_RULES.get_pack_plan(stage, &"easy", 3)
		var stage_medium := PACK_RULES.get_pack_plan(stage, &"medium", 3)
		var stage_hard := PACK_RULES.get_pack_plan(stage, &"hard", 3)
		_expect(int(stage_medium.packs_per_floor) == int(stage_easy.packs_per_floor), "Level %d Medium keeps the Easy pack cadence" % stage)
		_expect(int(stage_medium.members_per_pack) == int(stage_easy.members_per_pack) + 1, "Level %d Medium adds exactly one member per pack" % stage)
		_expect(int(stage_hard.members_per_pack) == int(stage_easy.members_per_pack) + 1, "Level %d Hard adds exactly one member per pack" % stage)
		_expect(float(stage_hard.total_members) <= float(stage_easy.total_members) * 1.50001, "Level %d Hard population never exceeds 1.5x Easy" % stage)
		_expect(int(stage_easy.total_members) <= 120, "Level %d canonical Easy population remains under the 120-enemy cap" % stage)
		if stage >= 11:
			_expect(int(stage_hard.packs_per_floor) == int(stage_easy.packs_per_floor) + 1, "Level %d Hard adds only one high-stage approach pack" % stage)
	var previous_chapter_two_total := int(PACK_RULES.get_pack_plan(10, &"easy", 3).total_members)
	for stage: int in range(11, 101):
		var stage_total := int(PACK_RULES.get_pack_plan(stage, &"easy", 3).total_members)
		_expect(float(stage_total) <= float(previous_chapter_two_total) * 1.15001, "Level %d Chapter 2+ population grows by no more than 1.15x" % stage)
		previous_chapter_two_total = stage_total
	var expected_band_totals := {
		11: 72, 20: 72,
		21: 81, 30: 81,
		31: 90, 50: 90,
		51: 96, 70: 96,
		71: 108, 85: 108,
		86: 120, 100: 120,
	}
	for stage: int in expected_band_totals:
		var band_plan := PACK_RULES.get_pack_plan(stage, &"easy", 3)
		_expect(int(band_plan.total_members) == int(expected_band_totals[stage]), "Level %d resolves its data-driven Chapter 2+ population band" % stage)
	var level_five := PACK_RULES.get_pack_plan(5, &"easy", 3)
	_expect(int(level_five.packs_per_floor) > int(easy.packs_per_floor), "later levels increase pack frequency before creating one giant mob")
	_expect(float(level_five.tactical_gap_seconds) < float(easy.tactical_gap_seconds), "later levels shorten traversal downtime between packs")
	_expect(int(level_five.traps_per_floor) > int(easy.traps_per_floor), "later levels grow the authored trap budget")

	var roll_a := PACK_RULES.roll_family(6, &"hard", "stable_run", "floor_01_pack_01", 3)
	var roll_b := PACK_RULES.roll_family(6, &"hard", "stable_run", "floor_01_pack_01", 3)
	_expect(roll_a == roll_b, "family rolls are deterministic for the same run, pack and slot")


func _test_extensible_family_catalog() -> void:
	var synthetic_catalog := [
		{"id": &"grunt", "difficulty_category": &"baseline", "fallback": true},
		{"id": &"caster", "difficulty_category": &"advanced"},
		{"id": &"brute", "difficulty_category": &"advanced"},
		{"id": &"astral_wisp", "difficulty_category": &"volatile"},
	]
	var synthetic_raw := {
		"grunt": 1.0,
		"caster": 1.0,
		"brute": 2.0,
		"astral_wisp": 1.0,
	}
	var category_multipliers := {
		"baseline": 1.0,
		"advanced": 2.0,
		"volatile": 3.0,
	}
	var normalized := PACK_RULES.normalize_family_weights(
		synthetic_raw,
		synthetic_catalog,
		category_multipliers,
	)
	_expect(normalized.size() == 4, "catalog normalization includes a fourth family without algorithm changes")
	_expect(is_equal_approx(float(normalized.grunt), 0.10), "baseline family receives its metadata category multiplier")
	_expect(is_equal_approx(float(normalized.caster), 0.20), "first advanced family receives the shared category multiplier")
	_expect(is_equal_approx(float(normalized.brute), 0.40), "second advanced family is normalized independently from its ID")
	_expect(is_equal_approx(float(normalized.astral_wisp), 0.30), "fourth family receives its own data-defined category multiplier")
	var normalized_sum := 0.0
	for family_id: StringName in PACK_RULES.get_family_types(synthetic_catalog):
		normalized_sum += float(normalized.get(String(family_id), 0.0))
	_expect(is_equal_approx(normalized_sum, 1.0), "synthetic four-family weights normalize to one")

	var roll_expectations := {
		0.05: &"grunt",
		0.15: &"caster",
		0.50: &"brute",
		0.85: &"astral_wisp",
		0.99: &"astral_wisp",
	}
	for raw_roll: Variant in roll_expectations:
		var roll := float(raw_roll)
		_expect(
			PACK_RULES.select_weighted_family(normalized, synthetic_catalog, roll) == roll_expectations[raw_roll],
			"ordered weighted selection maps synthetic roll %.2f through catalog data" % roll,
		)

	var fallback_weights := PACK_RULES.normalize_family_weights(
		{"grunt": 0.0, "caster": -4.0, "brute": 0.0, "astral_wisp": 0.0},
		synthetic_catalog,
		category_multipliers,
	)
	_expect(is_equal_approx(float(fallback_weights.grunt), 1.0), "all-zero catalog data uses the metadata fallback family")
	_expect(
		PACK_RULES.select_weighted_family(fallback_weights, synthetic_catalog, 0.99) == &"grunt",
		"weighted selection also uses catalog fallback metadata without an enemy-ID branch",
	)


func _test_early_stage_disclosure() -> void:
	var expectations := {
		1: {"authored": 12, "runtime_total": 15, "runtime_bonus": 3},
		2: {"authored": 15, "runtime_total": 18, "runtime_bonus": 3},
		3: {"authored": 20, "runtime_total": 21, "runtime_bonus": 1},
	}
	for stage: int in range(1, 4):
		var stage_path := LEVEL_ONE_PATH if stage == 1 else "res://data/levels/chapter_1_level_%d.json" % stage
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(stage_path))
		_expect(parsed is Dictionary, "Level %d early-disclosure authoring parses" % stage)
		if not parsed is Dictionary:
			continue
		var stage_data: Dictionary = parsed
		var metadata: Dictionary = stage_data.get("metadata", {})
		var model: Dictionary = metadata.get("encounter_pack_model", {})
		var anchor_camp_ids: Array = model.get("anchor_camp_ids", [])
		var authored_count := 0
		for raw_camp: Variant in metadata.get("combat_camps", []):
			if not raw_camp is Dictionary:
				continue
			var camp: Dictionary = raw_camp
			if not anchor_camp_ids.is_empty() and not anchor_camp_ids.has(String(camp.get("id", ""))):
				continue
			authored_count += (camp.get("enemy_ids", []) as Array).size()
		var expected: Dictionary = expectations[stage]
		var plan := PACK_RULES.get_level_pack_plan(metadata, stage, &"easy")
		var bonus_count := PACK_RULES.expected_bonus_count(metadata, stage, &"easy")
		_expect(authored_count == int(expected.authored), "Level %d preserves its %d authored enemies" % [stage, int(expected.authored)])
		_expect(int(plan.total_members) == int(expected.runtime_total), "Level %d Easy runtime is bounded at %d enemies" % [stage, int(expected.runtime_total)])
		_expect(bonus_count == int(expected.runtime_bonus), "Level %d only adds %d optional runtime enemies" % [stage, int(expected.runtime_bonus)])
		_expect(bonus_count * 4 <= authored_count, "Level %d Easy runtime bonus never exceeds 25 percent of authoring" % stage)

		var projection := PACK_RULES.project_runtime_entities(
			stage_data.get("entities", []),
			metadata,
			stage,
			&"easy",
			"early_disclosure_%d" % stage,
			FAMILY_TYPES,
			EXCLUDED_TYPES,
		)
		var projected_pack_members := 0
		var projected_optional_members := 0
		for raw_entity: Variant in projection:
			if not raw_entity is Dictionary or not bool((raw_entity as Dictionary).get("encounter_pack", false)):
				continue
			projected_pack_members += 1
			if bool((raw_entity as Dictionary).get("density_bonus", false)):
				projected_optional_members += 1
		_expect(projected_pack_members == int(expected.runtime_total), "Level %d materializes its bounded Easy population" % stage)
		_expect(projected_optional_members == bonus_count, "Level %d materializes no hidden bonus beyond the declared budget" % stage)


func _test_authored_level_one_projection() -> void:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(LEVEL_ONE_PATH))
	_expect(parsed is Dictionary, "authored Level 1 JSON parses")
	if not parsed is Dictionary:
		return
	var level: Dictionary = parsed
	var metadata: Dictionary = level.get("metadata", {})
	_expect(PACK_RULES.uses_pack_model(metadata), "Level 1 opts into the encounter-pack runtime contract")
	_expect(int((metadata.encounter_pack_model as Dictionary).floor_count) == 3, "Level 1 authoring declares three floors without storing a total enemy count")
	_expect(PACK_RULES.expected_bonus_count(metadata, 1, &"easy") == 3, "twelve stable anchors expand by only three optional runtime members")

	var projection := PACK_RULES.project_runtime_entities(
		level.get("entities", []), metadata, 1, &"easy", "pack_test_run", FAMILY_TYPES, EXCLUDED_TYPES
	)
	var repeated := PACK_RULES.project_runtime_entities(
		level.get("entities", []), metadata, 1, &"easy", "pack_test_run", FAMILY_TYPES, EXCLUDED_TYPES
	)
	_expect(JSON.stringify(projection) == JSON.stringify(repeated), "the same authored map and run create the same pack projection")

	var pack_counts := {}
	var runtime_enemy_count := 0
	var optional_count := 0
	for raw_entity: Variant in projection:
		if not raw_entity is Dictionary:
			continue
		var entity: Dictionary = raw_entity
		if not bool(entity.get("encounter_pack", false)):
			continue
		runtime_enemy_count += 1
		var key := "%d:%d" % [int(entity.encounter_floor), int(entity.encounter_pack_index)]
		pack_counts[key] = int(pack_counts.get(key, 0)) + 1
		if bool(entity.get("density_bonus", false)) and not bool(entity.get("required_for_completion", true)):
			optional_count += 1
	_expect(runtime_enemy_count == 15, "real Level 1 authoring projects exactly 15 encounter enemies")
	_expect(pack_counts.size() == 3, "real Level 1 authoring projects one pack on each of three floors")
	var every_pack_has_five := true
	for key: Variant in pack_counts:
		every_pack_has_five = every_pack_has_five and int(pack_counts[key]) == 5
	_expect(every_pack_has_five, "every projected Level 1 pack contains exactly five enemies")
	_expect(optional_count == 3, "the three generated pack members stay optional to legacy sigil/exit objectives")

	for stage: int in range(1, 6):
		var stage_path := LEVEL_ONE_PATH if stage == 1 else "res://data/levels/chapter_1_level_%d.json" % stage
		var stage_data: Variant = JSON.parse_string(FileAccess.get_file_as_string(stage_path))
		if not stage_data is Dictionary:
			_expect(false, "Chapter 1 Level %d authoring parses" % stage)
			continue
		var stage_entities: Array = (stage_data as Dictionary).get("entities", [])
		var trap_count := 0
		for raw_stage_entity: Variant in stage_entities:
			if raw_stage_entity is Dictionary and String((raw_stage_entity as Dictionary).get("type", "")) == "spikes":
				trap_count += 1
		var expected_traps := int(PACK_RULES.get_pack_plan(stage, &"easy", 3).traps_per_floor) * 3
		_expect(trap_count == expected_traps, "Level %d authors its full %d-trap pressure budget" % [stage, expected_traps])


func _test_authored_override_authority() -> void:
	var default_shapes := {
		4: {"packs": 6, "members": 24},
		5: {"packs": 6, "members": 30},
		6: {"packs": 6, "members": 36},
	}
	for stage: int in range(4, 7):
		var stage_path := "res://data/levels/chapter_1_level_%d.json" % stage
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(stage_path))
		_expect(parsed is Dictionary, "Level %d default-pack authoring parses" % stage)
		if not parsed is Dictionary:
			continue
		var metadata: Dictionary = (parsed as Dictionary).get("metadata", {})
		var model: Dictionary = metadata.get("encounter_pack_model", {})
		_expect(not model.has("packs_per_floor_override") and not model.has("members_per_pack_override"), "Level %d intentionally follows the canonical pressure profile" % stage)
		var plan := PACK_RULES.get_level_pack_plan(metadata, stage, &"easy")
		var expected: Dictionary = default_shapes[stage]
		_expect(int(plan.total_packs) == int(expected.packs), "Level %d canonical profile supplies its runtime pack count" % stage)
		_expect(int(plan.total_members) == int(expected.members), "Level %d canonical profile supplies its runtime population" % stage)

	var override_shapes := {
		7: {"packs_per_floor": 3, "members_per_pack": 7, "total": 21},
		8: {"packs_per_floor": 3, "members_per_pack": 7, "total": 21},
		9: {"packs_per_floor": 3, "members_per_pack": 8, "total": 24},
		10: {"packs_per_floor": 2, "members_per_pack": 8, "total": 16},
	}
	for stage: int in range(7, 11):
		var stage_path := "res://data/levels/chapter_1_level_%d.json" % stage
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(stage_path))
		_expect(parsed is Dictionary, "Level %d override-pack authoring parses" % stage)
		if not parsed is Dictionary:
			continue
		var metadata: Dictionary = (parsed as Dictionary).get("metadata", {})
		var model: Dictionary = metadata.get("encounter_pack_model", {})
		_expect(model.has("packs_per_floor_override") and model.has("members_per_pack_override"), "Level %d retains explicit authored pack overrides" % stage)
		var plan := PACK_RULES.get_level_pack_plan(metadata, stage, &"easy")
		var expected: Dictionary = override_shapes[stage]
		_expect(int(plan.packs_per_floor) == int(expected.packs_per_floor), "Level %d authored pack-count override remains authoritative" % stage)
		_expect(int(plan.members_per_pack) == int(expected.members_per_pack), "Level %d authored pack-size override remains authoritative" % stage)
		_expect(int(plan.total_members) == int(expected.total), "Level %d authored override determines its runtime population" % stage)
		var hard_plan := PACK_RULES.get_level_pack_plan(metadata, stage, &"hard")
		_expect(int(hard_plan.packs_per_floor) == int(plan.packs_per_floor), "Level %d Hard does not multiply an authored Chapter 1 override" % stage)
		_expect(float(hard_plan.total_members) <= float(plan.total_members) * 1.50001, "Level %d authored Hard population remains within 1.5x Easy" % stage)


func _test_late_level_pack_projection() -> void:
	var expected_shapes := {
		6: {"floors": 3, "packs": 6, "members": 36},
		7: {"floors": 1, "packs": 3, "members": 21},
		8: {"floors": 1, "packs": 3, "members": 21},
		9: {"floors": 1, "packs": 3, "members": 24},
		10: {"floors": 1, "packs": 2, "members": 16},
	}
	for stage: int in range(6, 11):
		var stage_path := "res://data/levels/chapter_1_level_%d.json" % stage
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(stage_path))
		_expect(parsed is Dictionary, "Level %d late-pack authoring parses" % stage)
		if not parsed is Dictionary:
			continue
		var stage_data: Dictionary = parsed
		var metadata: Dictionary = stage_data.get("metadata", {})
		var model: Dictionary = metadata.get("encounter_pack_model", {})
		_expect(PACK_RULES.uses_pack_model(metadata), "Level %d opts into encounter-pack runtime" % stage)
		_expect(int(model.get("floor_count", 0)) == int(expected_shapes[stage].floors), "Level %d declares its real floor count" % stage)

		var excluded_ids: Array = []
		for raw_branch_id: Variant in metadata.get("branch_enemy_ids", []):
			excluded_ids.append(String(raw_branch_id))
		for field: String in ["crimson_reaper_id", "boss_entity_id"]:
			var special_id := String(metadata.get(field, ""))
			if not special_id.is_empty():
				excluded_ids.append(special_id)
		var walkable_cells: Array = (stage_data.get("layers", {}) as Dictionary).get("Backdrop", [])
		var projection := PACK_RULES.project_runtime_entities(
			stage_data.get("entities", []),
			metadata,
			stage,
			&"easy",
			"late_pack_0",
			FAMILY_TYPES,
			EXCLUDED_TYPES,
			excluded_ids,
			walkable_cells,
		)
		var plan := PACK_RULES.get_level_pack_plan(metadata, stage, &"easy")
		_expect(int(plan.total_packs) == int(expected_shapes[stage].packs), "Level %d resolves the authored late-stage pack cadence" % stage)
		_expect(int(plan.total_members) == int(expected_shapes[stage].members), "Level %d derives runtime population from packs x members" % stage)

		var walkable_lookup := {}
		for raw_cell: Variant in walkable_cells:
			if raw_cell is Dictionary:
				walkable_lookup["%d,%d" % [int(raw_cell.x), int(raw_cell.y)]] = true
		var pack_counts := {}
		var family_presence := {}
		var generated_on_walkable := true
		var objective_used_as_source := false
		var pack_members := 0
		for raw_entity: Variant in projection:
			if not raw_entity is Dictionary:
				continue
			var entity: Dictionary = raw_entity
			if not bool(entity.get("encounter_pack", false)):
				continue
			pack_members += 1
			family_presence[String(entity.get("type", ""))] = true
			var pack_key := "%d:%d" % [int(entity.encounter_floor), int(entity.encounter_pack_index)]
			pack_counts[pack_key] = int(pack_counts.get(pack_key, 0)) + 1
			if excluded_ids.has(String(entity.get("source_entity_id", entity.get("id", "")))):
				objective_used_as_source = true
			var position: Array = entity.get("position", [])
			var cell_key := "%d,%d" % [floori(float(position[0]) / 16.0), floori(float(position[1]) / 16.0)]
			generated_on_walkable = generated_on_walkable and walkable_lookup.has(cell_key)
		_expect(pack_members == int(plan.total_members), "Level %d materializes the full runtime pack population" % stage)
		_expect(pack_counts.size() == int(plan.total_packs), "Level %d materializes every planned pack" % stage)
		var every_pack_matches := true
		for pack_key: Variant in pack_counts:
			every_pack_matches = every_pack_matches and int(pack_counts[pack_key]) == int(plan.members_per_pack)
		_expect(every_pack_matches, "Level %d keeps a consistent per-pack population" % stage)
		_expect(FAMILY_TYPES.all(func(family: String) -> bool: return family_presence.has(family)), "Level %d runtime includes all three eligible enemy families" % stage)
		_expect(not objective_used_as_source, "Level %d never clones a boss, branch marker, or deferred objective" % stage)
		_expect(generated_on_walkable, "Level %d places every pack member on authored walkable floor" % stage)

		var anchor_member_count := 0
		var anchor_camp_ids: Array = model.get("anchor_camp_ids", [])
		for raw_camp: Variant in metadata.get("combat_camps", []):
			if raw_camp is Dictionary and anchor_camp_ids.has(String(raw_camp.get("id", ""))):
				anchor_member_count += (raw_camp.get("enemy_ids", []) as Array).size()
		_expect(pack_members > anchor_member_count, "Level %d runtime population is larger than its safe authored anchors" % stage)

		var trap_count := 0
		for raw_entity: Variant in stage_data.get("entities", []):
			if raw_entity is Dictionary and String(raw_entity.get("type", "")) == "spikes":
				trap_count += 1
		var expected_traps := int(plan.traps_per_floor) * int(plan.floor_count)
		_expect(trap_count == expected_traps, "Level %d authors its stage/floor-specific %d-trap budget" % [stage, expected_traps])


func _test_live_neutral_trap_damage() -> void:
	var stage := Node2D.new()
	root.add_child(stage)
	var spikes := SPIKES_SCENE.instantiate() as DamageSpikes
	var knight := TrapPlayer.new()
	var skeleton := SKELETON_SCENE.instantiate() as SkeletonEnemy
	spikes.position = Vector2.ZERO
	knight.position = Vector2(500.0, 0.0)
	skeleton.position = Vector2(700.0, 0.0)
	stage.add_child(spikes)
	stage.add_child(knight)
	stage.add_child(skeleton)
	await process_frame

	_expect(spikes.collision_mask & 2 != 0 and spikes.collision_mask & 4 != 0, "live spike Area2D monitors both player and enemy physics layers")
	var contract := spikes.get_damage_contract()
	_expect(StringName(contract.owner) == &"dungeon" and StringName(contract.faction) == &"neutral_hazard", "trap publishes explicit dungeon ownership and neutral faction")
	_expect(bool(contract.affects_player) and bool(contract.affects_enemies), "neutral trap contract targets both sides")

	var player_before := knight.health
	var enemy_before := skeleton.health
	spikes.call(&"_on_body_entered", knight)
	spikes.call(&"_on_body_entered", skeleton)
	_expect(knight.health == player_before - spikes.damage, "live authored spikes damage the real player controller")
	_expect(skeleton.health == enemy_before - spikes.damage, "live authored spikes damage the real Skeleton enemy")

	spikes.call(&"_on_body_entered", skeleton)
	_expect(skeleton.health == enemy_before - spikes.damage, "re-enter sampling cannot bypass the target's own trap cooldown")
	var deadlines: Dictionary = spikes.get("_next_damage_at_msec")
	deadlines[skeleton.get_instance_id()] = 0
	spikes.set("_next_damage_at_msec", deadlines)
	spikes.call(&"_on_damage_timer_timeout")
	_expect(skeleton.health == enemy_before - spikes.damage * 2, "an enemy can take the next trap tick after its personal cooldown")

	stage.queue_free()
	await process_frame


func _test_pursuit_and_dungeon_palette() -> void:
	var stage := Node2D.new()
	root.add_child(stage)
	var skeleton := SKELETON_SCENE.instantiate() as SkeletonEnemy
	stage.add_child(skeleton)
	await process_frame
	var base_detection := skeleton.detection_range
	var base_disengage := skeleton.disengage_range
	var modifiers := ENEMY_SCALER.apply_to(skeleton, 1, &"easy")
	_expect(skeleton.detection_range > base_detection, "Level 1 scaling increases the real enemy's player detection radius")
	_expect(skeleton.disengage_range > base_disengage, "Level 1 scaling gives the real enemy a longer pursuit leash")
	_expect(is_equal_approx(float(modifiers.pursuit_multiplier), 1.30), "Level 1 pursuit multiplier comes from the pack-pressure profile")

	var dungeon := DUNGEON_SCENE.instantiate() as DungeonLevel
	stage.add_child(dungeon)
	await process_frame
	_expect(dungeon.backdrop.modulate != Color.WHITE, "dungeon floor receives a cool authored palette instead of a screen-darkening overlay")
	_expect(dungeon.geometry.modulate.a == 1.0 and dungeon.decor.modulate.a == 1.0, "dungeon palette keeps every map layer fully opaque")
	var main_scene_text := FileAccess.get_file_as_string("res://game/main.tscn")
	_expect("color = Color(1, 1, 1, 1)" in main_scene_text, "global WorldTint remains white, so no dark cover is placed over gameplay")
	var home_script_text := FileAccess.get_file_as_string("res://game/ui/screens/home/home_map_screen.gd")
	_expect("const HOME_WORLD_SCALE := 1.25" in home_script_text, "Home retains the approved close 1.25 gameplay framing")

	stage.queue_free()
	await process_frame


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("ENCOUNTER PACK + TRAP TEST PASSED — %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("ENCOUNTER PACK + TRAP TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
