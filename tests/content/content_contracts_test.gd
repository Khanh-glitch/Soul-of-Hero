extends Node

const SANDBOX_REGISTRY_RESOURCE := preload("res://data/content/registries/sandbox_content_registry.tres")
const CAMPAIGN_REGISTRY_RESOURCE := preload("res://data/content/registries/campaign_content_registry.tres")
const CAMPAIGN_REWARD_REGISTRY: RewardBundleRegistry = preload("res://data/content/rewards/campaign_reward_registry.tres")
const SKELETON_SCENE := preload("res://game/characters/enemies/skeleton_enemy.tscn")
const CRYPT_SCENE := preload("res://game/levels/crypt_entrance.tscn")
const EncounterRuntimeStateScript := preload("res://game/content/encounters/encounter_runtime_state.gd")
const REPORT_PATH := "res://.artifacts/content_contracts_report.json"

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_content_ids()
	_test_campaign_capacity()
	_test_representative_sandbox_registry()
	_test_production_campaign_registry()
	_test_chapter_one_draft_rewards()
	_test_duplicate_detection_and_lookup()
	_test_level_dependencies_and_unlocks()
	_test_encounter_dependencies()
	_test_encounter_group_schema()
	_test_encounter_runtime_authority()
	_test_exit_gate_requires_both_objectives()
	_finish()


func _test_content_ids() -> void:
	_expect(ContentId.is_valid(&"skeleton_chaser"), "lower_snake_case content ID is valid")
	_expect(ContentId.is_valid(&"chapter_1_level_10"), "content ID accepts digits after its first letter")
	_expect(not ContentId.is_valid(&"SkeletonChaser"), "content ID rejects uppercase characters")
	_expect(not ContentId.is_valid(&"skeleton-chaser"), "content ID rejects punctuation")
	_expect(not ContentId.is_valid(&"1_skeleton"), "content ID rejects a leading digit")
	_expect(not ContentId.is_valid(&"skeleton__chaser"), "content ID rejects repeated underscores")
	_expect(not ContentId.is_valid(&"skeleton_chaser_"), "content ID rejects a trailing underscore")
	_expect(ContentId.is_valid_transaction_key(&"campaign:chapter_1_level_1:complete"), "transaction key accepts colon-separated content-ID namespaces")
	_expect(not ContentId.is_valid_transaction_key(&"campaign::complete"), "transaction key rejects empty namespace segments")
	_expect(not ContentId.is_valid_transaction_key(&"campaign:Level-1"), "transaction key applies strict content-ID rules to every segment")
	var namespaced_completion := EncounterCompletionContract.new()
	namespaced_completion.required_objective_ids = PackedStringArray(["test_objective"])
	namespaced_completion.reward_bundle_id = &"test_reward"
	namespaced_completion.reward_transaction_id = &"campaign:chapter_1_level_1:complete"
	_expect(namespaced_completion.get_validation_errors().is_empty(), "encounter reward contract accepts the SaveService transaction namespace convention")
	var helper_errors := PackedStringArray()
	ContentId.append_if_invalid(helper_errors, &"BadId", "Test ID")
	_expect(helper_errors.size() == 1, "content ID validation helper appends errors to the caller")
	ContentId.append_duplicate_or_invalid_ids(helper_errors, PackedStringArray(["valid_id", "valid_id"]), "Test IDs")
	_expect(_has_error(helper_errors, "duplicate ID 'valid_id'"), "content ID helper detects duplicate packed IDs")


func _test_campaign_capacity() -> void:
	_expect(LevelDefinition.LEVELS_PER_CHAPTER == 10, "campaign contract keeps ten levels per chapter")
	_expect(LevelDefinition.CAMPAIGN_CHAPTER_CAPACITY == 10, "campaign contract exposes ten chapters")
	_expect(LevelDefinition.CAMPAIGN_LEVEL_CAPACITY == 100, "campaign contract exposes one hundred level slots")
	_expect(LevelRegistry.CAMPAIGN_LEVEL_CAPACITY == 100, "level registry shares the canonical campaign capacity")
	_expect(LevelDefinition.get_chapter_for_campaign_slot(1) == 1, "campaign slot 1 belongs to Chapter 1")
	_expect(LevelDefinition.get_chapter_for_campaign_slot(10) == 1, "campaign slot 10 closes Chapter 1")
	_expect(LevelDefinition.get_chapter_for_campaign_slot(11) == 2, "campaign slot 11 opens Chapter 2")
	_expect(LevelDefinition.get_chapter_for_campaign_slot(100) == 10, "campaign slot 100 belongs to Chapter 10")
	_expect(LevelDefinition.get_chapter_level_for_campaign_slot(100) == 10, "campaign slot 100 is Chapter 10 Level 10")
	_expect(LevelDefinition.get_first_campaign_slot_for_chapter(10) == 91, "Chapter 10 starts at campaign slot 91")
	_expect(LevelDefinition.get_first_campaign_slot_for_chapter(11) == 0, "campaign helper rejects Chapter 11")
	var mapless_draft := _make_level(&"mapless_draft", 6, PackedStringArray(["test_encounter"]), PackedStringArray(), PackedStringArray(), PackedStringArray())
	mapless_draft.content_status = LevelDefinition.ContentStatus.CAMPAIGN_DRAFT
	mapless_draft.level_scene = null
	mapless_draft.layout_data_path = ""
	_expect(mapless_draft.get_validation_errors().is_empty(), "campaign drafts validate without falsely claiming a scene or map")

	var final_level := _make_level(
		&"chapter_10_level_100",
		100,
		PackedStringArray(["test_encounter"]),
		PackedStringArray(),
		PackedStringArray(),
		PackedStringArray()
	)
	_expect(final_level.get_validation_errors().is_empty(), "campaign level validator accepts slot 100 with Chapter 10 metadata")
	var overflow_level := _make_level(
		&"chapter_11_level_101",
		101,
		PackedStringArray(["test_encounter"]),
		PackedStringArray(),
		PackedStringArray(),
		PackedStringArray()
	)
	_expect(_has_error(overflow_level.get_validation_errors(), "from 1 to 100"), "campaign level validator rejects slot 101")


func _test_representative_sandbox_registry() -> void:
	var registry := SANDBOX_REGISTRY_RESOURCE as LevelRegistry
	_expect(registry != null, "representative sandbox registry loads as LevelRegistry")
	if registry == null:
		return
	var errors := registry.get_validation_errors()
	_expect(errors.is_empty(), "representative sandbox registry validates: %s" % "; ".join(errors))
	var enemy := registry.find_enemy(&"skeleton_chaser_sandbox")
	_expect(enemy != null and enemy.development_only, "registry resolves development-only Skeleton definition")
	var encounter := registry.find_encounter(&"crypt_skeleton_sandbox")
	_expect(encounter != null and encounter.get_group(&"crypt_patrol_group") != null, "registry resolves encounter and ordered group")
	var level := registry.find_level(&"crypt_entrance_sandbox")
	_expect(level != null and level.content_status == LevelDefinition.ContentStatus.SANDBOX, "representative crypt definition is explicitly SANDBOX")
	_expect(level != null and level.campaign_slot == 0, "sandbox crypt occupies no campaign slot")
	_expect(
		level != null and level.layout_data_path == "res://data/levels/crypt_training_sandbox.json",
		"Training owns a dedicated layout instead of reusing Campaign Level 01",
	)
	_expect(
		encounter != null
		and encounter.completion.reward_bundle_id.is_empty()
		and encounter.completion.reward_transaction_id.is_empty(),
		"Training encounter declares no reward transaction",
	)
	if encounter != null:
		var group := encounter.get_group(&"crypt_patrol_group")
		var markers := PackedStringArray()
		if group != null and not group.spawn_entries.is_empty() and group.spawn_entries[0] != null:
			markers = group.spawn_entries[0].spawn_marker_ids
		_expect(
			markers == PackedStringArray([
				"training_skeleton_01", "training_skeleton_02", "training_skeleton_03",
				"training_skeleton_04", "training_skeleton_05",
			]),
			"Training encounter binds all five live layout markers",
		)
	_expect(registry.get_ordered_campaign_levels().is_empty(), "sandbox registry makes no fake campaign-level claim")
	_expect(registry.find_campaign_level(1) == null, "un-authored campaign slot lookup returns null")


func _test_production_campaign_registry() -> void:
	var registry := CAMPAIGN_REGISTRY_RESOURCE as LevelRegistry
	_expect(registry != null, "production campaign registry loads as LevelRegistry")
	if registry == null:
		return
	var errors := registry.get_validation_errors()
	_expect(errors.is_empty(), "production campaign registry validates: %s" % "; ".join(errors))
	var level := registry.find_campaign_level(1)
	_expect(level != null and level.level_id == &"chapter_1_level_1", "campaign slot 1 resolves the playable Level 01 definition")
	_expect(level != null and level.is_campaign_ready(), "Level 01 is campaign-ready rather than sandbox content")
	_expect(level != null and level.layout_data_path == "res://data/levels/crypt_entrance.json", "Level 01 owns the generated three-floor layout")
	_expect(registry.find_campaign_level(2) != null and registry.find_campaign_level(2).layout_data_path == "res://data/levels/chapter_1_level_2.json", "campaign slot 2 resolves its authored map")
	_expect(registry.find_campaign_level(3) != null and registry.find_campaign_level(3).layout_data_path == "res://data/levels/chapter_1_level_3.json", "campaign slot 3 resolves its authored map")
	_expect(registry.find_campaign_level(4) != null and registry.find_campaign_level(4).layout_data_path == "res://data/levels/chapter_1_level_4.json", "campaign slot 4 resolves its authored map")
	_expect(registry.find_campaign_level(5) != null and registry.find_campaign_level(5).layout_data_path == "res://data/levels/chapter_1_level_5.json", "campaign slot 5 resolves its authored map")
	var level_6_ready := registry.find_campaign_level(6)
	_expect(level_6_ready != null and level_6_ready.layout_data_path == "res://data/levels/chapter_1_level_6.json", "campaign slot 6 resolves its authored vertical-slice map")
	_expect(level_6_ready != null and level_6_ready.is_campaign_ready(), "Level 6 is campaign-ready after its Captain/recruitment/route gates pass")
	var level_7_ready := registry.find_campaign_level(7)
	_expect(level_7_ready != null and level_7_ready.layout_data_path == "res://data/levels/chapter_1_level_7.json", "campaign slot 7 resolves its authored Beacon-defense map")
	_expect(level_7_ready != null and level_7_ready.is_campaign_ready(), "Level 7 is campaign-ready after focused and fresh-AppRoot gates pass")
	var level_8_ready := registry.find_campaign_level(8)
	_expect(level_8_ready != null and level_8_ready.layout_data_path == "res://data/levels/chapter_1_level_8.json", "campaign slot 8 resolves its authored divided-Reliquary map")
	_expect(level_8_ready != null and level_8_ready.is_campaign_ready(), "Level 8 is campaign-ready after both branch and fresh-AppRoot gates pass")
	var level_9_ready := registry.find_campaign_level(9)
	_expect(level_9_ready != null and level_9_ready.layout_data_path == "res://data/levels/chapter_1_level_9.json", "campaign slot 9 resolves its authored three-seal Crimson Gate map")
	_expect(level_9_ready != null and level_9_ready.is_campaign_ready(), "Level 9 is campaign-ready after physical-seal, named-Elite, reward, and fresh-AppRoot gates pass")
	var level_10_ready := registry.find_campaign_level(10)
	_expect(level_10_ready != null and level_10_ready.layout_data_path == "res://data/levels/chapter_1_level_10.json", "campaign slot 10 resolves its dedicated Vampire Castellan throne map")
	_expect(level_10_ready != null and level_10_ready.is_campaign_ready(), "Level 10 is campaign-ready after two-phase boss, retry, reward, replay, and fresh-AppRoot gates pass")
	_expect(registry.get_ordered_campaign_levels(false).size() == 20, "production registry exposes all twenty internally playable Chapter 1–2 maps")
	_expect(registry.get_ordered_campaign_levels(true).size() == 20, "campaign registry catalogs the twenty authored Chapter 1–2 slots")
	_expect(registry.find_enemy(&"skeleton_swordsman") != null, "Level 01 registry catalogs Skeleton Swordsman")
	_expect(registry.find_enemy(&"bone_reaper") != null, "Level 01 registry catalogs Bone Reaper")
	_expect(registry.find_enemy(&"blood_vampire") != null, "Level 01 registry catalogs Blood Vampire")
	_expect(registry.find_enemy(&"hooded_archer_miniboss") != null, "campaign registry catalogs the Level 5 Hooded Archer miniboss")
	_expect(registry.find_enemy(&"crimson_reaper") != null, "campaign registry catalogs the dedicated Level 9 Crimson Reaper identity")
	_expect(registry.find_enemy(&"vampire_castellan") != null, "campaign registry catalogs the dedicated Level 10 Vampire Castellan identity")
	var chapter_two_opening := registry.find_campaign_level(11)
	var chapter_two_finale := registry.find_campaign_level(20)
	_expect(chapter_two_opening != null and chapter_two_opening.is_campaign_ready() and chapter_two_opening.layout_data_path == "res://data/levels/chapter_2_level_11.json", "campaign slot 11 resolves the first runnable Coven Foundry map")
	_expect(chapter_two_finale != null and chapter_two_finale.is_campaign_ready() and chapter_two_finale.layout_data_path == "res://data/levels/chapter_2_level_20.json", "campaign slot 20 resolves the runnable Wizard finale map")
	for enemy_id: StringName in [&"coven_wraith", &"venom_bound_wraith", &"spirit_leech", &"hexwing_familiar", &"axe_soul_boss", &"wizard_hero_boss"]:
		_expect(registry.find_enemy(enemy_id) != null, "campaign registry catalogs Chapter 2 enemy '%s'" % enemy_id)


func _test_duplicate_detection_and_lookup() -> void:
	var enemy := _make_enemy(&"test_enemy")
	var encounter := _make_encounter(&"test_encounter", enemy.enemy_id)
	var level := _make_level(
		&"campaign_level_one",
		1,
		PackedStringArray([encounter.encounter_id]),
		PackedStringArray(),
		PackedStringArray(),
		PackedStringArray(["feature_bow"])
	)
	var registry := _make_registry(enemy, [encounter], [level])
	_expect(registry.get_validation_errors().is_empty(), "synthetic campaign level 1 registry validates")
	_expect(registry.find_enemy(enemy.enemy_id) == enemy, "enemy registry lookup returns the authored resource")
	_expect(registry.find_encounter(encounter.encounter_id) == encounter, "encounter registry lookup returns the authored resource")
	_expect(registry.find_level(level.level_id) == level, "level registry lookup returns the authored resource")
	_expect(registry.find_campaign_level(1) == level, "campaign slot lookup returns level 1")
	_expect(registry.get_ordered_campaign_levels(false).size() == 1, "ordered ready-campaign query returns authored ready levels")

	registry.enemy_definitions.append(_make_enemy(enemy.enemy_id))
	var errors := registry.get_validation_errors()
	_expect(_has_error(errors, "Duplicate enemy ID"), "registry detects duplicate enemy IDs")
	registry.enemy_definitions.resize(1)

	registry.encounter_definitions.append(_make_encounter(encounter.encounter_id, enemy.enemy_id))
	errors = registry.get_validation_errors()
	_expect(_has_error(errors, "Duplicate encounter ID"), "registry detects duplicate encounter IDs")
	registry.encounter_definitions.resize(1)

	var duplicate_slot := _make_level(
		&"alternate_level_one",
		1,
		PackedStringArray([encounter.encounter_id]),
		PackedStringArray(),
		PackedStringArray(),
		PackedStringArray()
	)
	registry.level_definitions.append(duplicate_slot)
	errors = registry.get_validation_errors()
	_expect(_has_error(errors, "Duplicate campaign slot 1"), "registry detects duplicate campaign slots")

	var malformed_sandbox := _make_level(
		&"malformed_sandbox",
		1,
		PackedStringArray([encounter.encounter_id]),
		PackedStringArray(),
		PackedStringArray(),
		PackedStringArray()
	)
	malformed_sandbox.content_status = LevelDefinition.ContentStatus.SANDBOX
	var malformed_registry := _make_registry(enemy, [encounter], [malformed_sandbox])
	_expect(malformed_registry.find_campaign_level(1) == null, "even malformed SANDBOX data cannot enter the campaign-slot index")
	malformed_sandbox.content_status = 99
	malformed_registry.rebuild_index()
	_expect(malformed_registry.find_campaign_level(1) == null, "unsupported content status cannot enter the campaign-slot index")


func _test_chapter_one_draft_rewards() -> void:
	var errors := CAMPAIGN_REWARD_REGISTRY.get_validation_errors()
	_expect(errors.is_empty(), "all ten Chapter 1 reward bundles validate: %s" % "; ".join(errors))
	var level_six := (CAMPAIGN_REGISTRY_RESOURCE as LevelRegistry).find_campaign_level(6)
	_expect(level_six != null and CAMPAIGN_REWARD_REGISTRY.find_bundle(level_six.completion_reward_bundle_id) != null, "campaign-ready slot 6 resolves its first-clear reward bundle")
	var level_seven := (CAMPAIGN_REGISTRY_RESOURCE as LevelRegistry).find_campaign_level(7)
	_expect(level_seven != null and CAMPAIGN_REWARD_REGISTRY.find_bundle(level_seven.completion_reward_bundle_id) != null, "campaign-ready slot 7 resolves its first-clear reward bundle")
	var level_eight := (CAMPAIGN_REGISTRY_RESOURCE as LevelRegistry).find_campaign_level(8)
	_expect(level_eight != null and CAMPAIGN_REWARD_REGISTRY.find_bundle(level_eight.completion_reward_bundle_id) != null, "campaign-ready slot 8 resolves its deterministic Epic first-clear reward bundle")
	var level_nine := (CAMPAIGN_REGISTRY_RESOURCE as LevelRegistry).find_campaign_level(9)
	_expect(level_nine != null and CAMPAIGN_REWARD_REGISTRY.find_bundle(level_nine.completion_reward_bundle_id) != null, "campaign-ready slot 9 resolves its deterministic Rare Hero Soul reward bundle")
	var level_ten := (CAMPAIGN_REGISTRY_RESOURCE as LevelRegistry).find_campaign_level(10)
	_expect(level_ten != null and CAMPAIGN_REWARD_REGISTRY.find_bundle(level_ten.completion_reward_bundle_id) != null, "campaign-ready slot 10 resolves its deterministic Epic boss first-clear reward bundle")


func _test_level_dependencies_and_unlocks() -> void:
	var enemy := _make_enemy(&"dependency_enemy")
	var encounter_one := _make_encounter(&"dependency_encounter_one", enemy.enemy_id)
	var encounter_two := _make_encounter(&"dependency_encounter_two", enemy.enemy_id)
	var level_one := _make_level(
		&"dependency_level_one",
		1,
		PackedStringArray([encounter_one.encounter_id]),
		PackedStringArray(),
		PackedStringArray(),
		PackedStringArray(["feature_bow"])
	)
	var level_two := _make_level(
		&"dependency_level_two",
		2,
		PackedStringArray([encounter_two.encounter_id]),
		PackedStringArray([level_one.level_id]),
		PackedStringArray(["feature_bow"]),
		PackedStringArray(["feature_axe"])
	)
	var registry := _make_registry(enemy, [encounter_one, encounter_two], [level_one, level_two])
	_expect(registry.get_validation_errors().is_empty(), "feature granted by prerequisite level satisfies level 2 unlock")

	level_two.unlock_requirements.required_feature_ids = PackedStringArray(["feature_missing"])
	var errors := registry.get_validation_errors()
	_expect(_has_error(errors, "requires unavailable feature 'feature_missing'"), "registry rejects unavailable level feature requirement")
	level_two.unlock_requirements.required_feature_ids = PackedStringArray(["feature_bow"])

	level_two.unlock_requirements.prerequisite_level_ids = PackedStringArray(["missing_level"])
	errors = registry.get_validation_errors()
	_expect(_has_error(errors, "unknown prerequisite level 'missing_level'"), "registry rejects unknown level dependency")
	level_two.unlock_requirements.prerequisite_level_ids = PackedStringArray([level_one.level_id])

	level_one.unlock_requirements.prerequisite_level_ids = PackedStringArray([level_two.level_id])
	errors = registry.get_validation_errors()
	_expect(_has_error(errors, "Level dependency cycle"), "registry detects cyclic level dependencies")
	level_one.unlock_requirements.prerequisite_level_ids = PackedStringArray()

	level_two.unlock_requirements.prerequisite_level_ids = PackedStringArray()
	errors = registry.get_validation_errors()
	_expect(_has_error(errors, "must directly require previous level"), "campaign-ready level requires the previous authored slot")

	var sandbox_level := _make_level(
		&"sandbox_dependency_level",
		1,
		PackedStringArray([encounter_one.encounter_id]),
		PackedStringArray(),
		PackedStringArray(),
		PackedStringArray(["feature_sandbox_only"])
	)
	sandbox_level.content_status = LevelDefinition.ContentStatus.SANDBOX
	sandbox_level.campaign_slot = 0
	sandbox_level.chapter_number = 0
	sandbox_level.chapter_level_number = 0
	var production_level := _make_level(
		&"production_level_one",
		1,
		PackedStringArray([encounter_two.encounter_id]),
		PackedStringArray([sandbox_level.level_id]),
		PackedStringArray(["feature_sandbox_only"]),
		PackedStringArray()
	)
	var sandbox_dependency_registry := _make_registry(
		enemy,
		[encounter_one, encounter_two],
		[sandbox_level, production_level]
	)
	errors = sandbox_dependency_registry.get_validation_errors()
	_expect(_has_error(errors, "cannot depend on SANDBOX level"), "campaign level cannot consume sandbox prerequisites or feature grants")
	production_level.content_status = LevelDefinition.ContentStatus.CAMPAIGN_DRAFT
	errors = sandbox_dependency_registry.get_validation_errors()
	_expect(_has_error(errors, "cannot depend on SANDBOX level"), "campaign draft also remains isolated from sandbox progression")


func _test_encounter_dependencies() -> void:
	var enemy := _make_enemy(&"sequence_enemy")
	var setup_encounter := _make_encounter(&"setup_encounter", enemy.enemy_id)
	var payoff_encounter := _make_encounter(&"payoff_encounter", enemy.enemy_id)
	payoff_encounter.prerequisite_encounter_ids = PackedStringArray([setup_encounter.encounter_id])
	var level := _make_level(
		&"sequence_level",
		1,
		PackedStringArray([payoff_encounter.encounter_id, setup_encounter.encounter_id]),
		PackedStringArray(),
		PackedStringArray(),
		PackedStringArray()
	)
	var registry := _make_registry(enemy, [setup_encounter, payoff_encounter], [level])
	var errors := registry.get_validation_errors()
	_expect(_has_error(errors, "schedules encounter 'payoff_encounter' before prerequisite encounter 'setup_encounter'"), "registry rejects encounter sequence before its prerequisite")

	level.encounter_ids = PackedStringArray([setup_encounter.encounter_id, payoff_encounter.encounter_id])
	level.entry_encounter_id = setup_encounter.encounter_id
	_expect(registry.get_validation_errors().is_empty(), "ordered encounter prerequisites validate when scheduled correctly")

	setup_encounter.prerequisite_encounter_ids = PackedStringArray([payoff_encounter.encounter_id])
	errors = registry.get_validation_errors()
	_expect(_has_error(errors, "Encounter dependency cycle"), "registry detects cyclic encounter dependencies")


func _test_encounter_group_schema() -> void:
	var empty_group := EncounterGroupDefinition.new()
	empty_group.group_id = &"empty_group"
	var errors := empty_group.get_validation_errors()
	_expect(_has_error(errors, "at least one spawn entry"), "encounter group rejects an empty spawn schema")

	var invalid_spawn := EncounterSpawnEntry.new()
	invalid_spawn.entry_id = &"invalid_spawn"
	invalid_spawn.enemy_id = &"test_enemy"
	invalid_spawn.formation_id = &"scatter"
	errors = invalid_spawn.get_validation_errors()
	_expect(_has_error(errors, "exactly one placement source"), "spawn entry requires exactly one placement source")

	invalid_spawn.spawn_region_id = &"room_region"
	invalid_spawn.spawn_marker_ids = PackedStringArray(["marker_one"])
	errors = invalid_spawn.get_validation_errors()
	_expect(_has_error(errors, "exactly one placement source"), "spawn entry rejects simultaneous region and marker placement")

	var enemy := _make_enemy(&"known_enemy")
	var encounter := _make_encounter(&"unknown_enemy_encounter", &"unknown_enemy")
	var level := _make_level(
		&"unknown_enemy_level",
		1,
		PackedStringArray([encounter.encounter_id]),
		PackedStringArray(),
		PackedStringArray(),
		PackedStringArray()
	)
	var registry := _make_registry(enemy, [encounter], [level])
	errors = registry.get_validation_errors()
	_expect(_has_error(errors, "references unknown enemy 'unknown_enemy'"), "registry rejects encounter group with unknown enemy ID")

	var valid_encounter := _make_encounter(&"warning_encounter", enemy.enemy_id)
	var warning := EncounterWarningDefinition.new()
	warning.warning_id = &"bad_group_warning"
	warning.scope = EncounterWarningDefinition.Scope.GROUP
	warning.target_id = &"missing_group"
	warning.message_key = "warning.missing_group"
	valid_encounter.warnings.append(warning)
	errors = valid_encounter.get_validation_errors()
	_expect(_has_error(errors, "references unknown group 'missing_group'"), "warning contract rejects an unknown group target")

	var duplicate_group := valid_encounter.waves[0].groups[0].duplicate(true) as EncounterGroupDefinition
	var second_wave := EncounterWaveDefinition.new()
	second_wave.wave_id = &"second_wave"
	second_wave.groups.append(duplicate_group)
	valid_encounter.waves.append(second_wave)
	errors = valid_encounter.get_validation_errors()
	_expect(_has_error(errors, "must be unique across all waves"), "group IDs are unique across ordered encounter waves")


func _test_encounter_runtime_authority() -> void:
	var registry := CAMPAIGN_REGISTRY_RESOURCE as LevelRegistry
	var expected_enemy_totals := {
		&"chapter_1_level_1": 12,
		&"chapter_1_level_2": 15,
		&"chapter_1_level_3": 20,
		&"chapter_1_level_4": 15,
		&"chapter_1_level_5": 17,
		&"chapter_1_level_6": 12,
		&"chapter_1_level_7": 16,
		&"chapter_1_level_8": 9,
		&"chapter_1_level_9": 1,
		&"chapter_1_level_10": 1,
		&"chapter_2_level_11": 9,
		&"chapter_2_level_12": 10,
		&"chapter_2_level_13": 10,
		&"chapter_2_level_14": 10,
		&"chapter_2_level_15": 6,
		&"chapter_2_level_16": 9,
		&"chapter_2_level_17": 10,
		&"chapter_2_level_18": 7,
		&"chapter_2_level_19": 10,
		&"chapter_2_level_20": 7,
	}
	for level: LevelDefinition in registry.get_ordered_campaign_levels(false):
		var runtime = EncounterRuntimeStateScript.new()
		var entities := _load_layout_entities(level.layout_data_path)
		var errors := runtime.configure(level, registry, entities)
		_expect(
			errors.is_empty(),
			"%s encounter runtime binds cleanly to authored JSON markers: %s" % [
				level.level_id,
				"; ".join(errors),
			],
		)
		var snapshot := runtime.get_snapshot()
		_expect(
			int(snapshot.get("total_enemies", -1)) == int(expected_enemy_totals[level.level_id]),
			"%s runtime enemy total comes from EncounterDefinition markers" % level.level_id,
		)
		var expected_groups := 0
		for wave: EncounterWaveDefinition in registry.find_encounter(level.entry_encounter_id).waves:
			expected_groups += wave.groups.size()
		_expect(int(snapshot.get("total_groups", 0)) == expected_groups, "%s exposes every authored guardian/boss group" % level.level_id)

		var encounter := registry.find_encounter(level.entry_encounter_id)
		var gate_id := StringName(encounter.completion.gate_entity_ids[0])
		_expect(runtime.is_gate_controlled(gate_id), "%s completion contract controls its authored exit gate" % level.level_id)
		_expect(not runtime.is_gate_unlocked(gate_id), "%s exit gate starts locked by clear-enemy objective" % level.level_id)
		_expect(not runtime.mark_enemy_defeated(&"not_an_enemy_marker"), "%s ignores non-authoritative entity IDs" % level.level_id)

		var first_group := encounter.waves[0].groups[0]
		for entry: EncounterSpawnEntry in first_group.spawn_entries:
			for marker_index: int in mini(entry.count, entry.spawn_marker_ids.size()):
				runtime.mark_enemy_defeated(StringName(entry.spawn_marker_ids[marker_index]))
		_expect(
			runtime.is_group_complete(encounter.encounter_id, first_group.group_id),
			"%s marks an authored camp complete only after every group marker is defeated" % level.level_id,
		)
		if expected_groups > 1 or not _required_custom_events(encounter).is_empty():
			_expect(not runtime.is_gate_unlocked(gate_id), "%s clearing one camp cannot unlock the level exit" % level.level_id)
		else:
			_expect(runtime.is_gate_unlocked(gate_id), "%s single-group route unlocks after its only authored camp is cleared" % level.level_id)

		for wave: EncounterWaveDefinition in encounter.waves:
			for group: EncounterGroupDefinition in wave.groups:
				for entry: EncounterSpawnEntry in group.spawn_entries:
					for marker_index: int in mini(entry.count, entry.spawn_marker_ids.size()):
						var marker_id := StringName(entry.spawn_marker_ids[marker_index])
						if marker_id in [&"l15_axe", &"l18_hexwing"]:
							continue
						runtime.mark_enemy_defeated(marker_id)
		if level.level_id == &"chapter_1_level_5":
			_expect(
				not runtime.is_encounter_complete(encounter.encounter_id),
				"Level 5 boss defeat alone cannot bypass the required physical Archer Soul pickup",
			)
			_expect(
				runtime.record_custom_event(&"archer_hero_soul_collected"),
				"Level 5 runtime records the required physical Archer Hero Soul pickup",
			)
		elif level.level_id == &"chapter_1_level_7":
			_expect(runtime.record_custom_event(&"soul_beacon_survived"), "Level 7 runtime records the surviving Beacon after all authored waves")
		elif level.level_id == &"chapter_1_level_8":
			_expect(runtime.record_custom_event(&"elite_chest_claimed"), "Level 8 runtime records the required physical Elite chest claim")
		elif level.level_id == &"chapter_1_level_9":
			for _seal_index: int in 3:
				_expect(runtime.record_custom_event(&"gate_seal_collected"), "Level 9 runtime records one physical Gate Seal interaction")
		elif level.level_id == &"chapter_1_level_10":
			_expect(runtime.record_custom_event(&"castellan_phase_two_started"), "Level 10 runtime records the threshold transition on the continuous boss actor")
			_expect(runtime.record_custom_event(&"castellan_defeated"), "Level 10 runtime records the real Castellan death rather than a proxy phase kill")
		elif level.level_id == &"chapter_2_level_15":
			_expect(not runtime.is_encounter_complete(encounter.encounter_id), "Level 15 Axe must retreat rather than become a defeated marker")
			_expect(runtime.deactivate_tracked_enemies(PackedStringArray(["l15_axe"])) == 1, "Level 15 retreat removes only the Axe marker from defeat accounting")
			_expect(runtime.record_custom_event(&"axe_retreated"), "Level 15 runtime records the exact 50-percent Axe retreat")
		elif level.level_id == &"chapter_2_level_18":
			_expect(not runtime.is_encounter_complete(encounter.encounter_id), "Level 18 Hexwing retreat remains a distinct branch event")
			_expect(runtime.deactivate_tracked_enemies(PackedStringArray(["l18_hexwing"])) == 1, "Level 18 retreat removes only the Hexwing marker from defeat accounting")
			_expect(runtime.record_custom_event(&"hexwing_retreated"), "Level 18 runtime records the Hexwing retreat event")
		elif level.level_id == &"chapter_2_level_20":
			_expect(not runtime.is_encounter_complete(encounter.encounter_id), "Level 20 Wizard death cannot bypass the physical Wizard Soul pickup")
			_expect(runtime.record_custom_event(&"wizard_hero_soul_collected"), "Level 20 runtime records the physical Wizard Soul pickup")
		_expect(runtime.is_encounter_complete(encounter.encounter_id), "%s required authored objectives complete through encounter authority" % level.level_id)
		_expect(runtime.is_gate_unlocked(gate_id), "%s exit gate unlocks after every required encounter objective" % level.level_id)


func _test_exit_gate_requires_both_objectives() -> void:
	var gate := ExitGate.new()
	gate._current_sigils = 3
	gate._required_sigils = 3
	gate.configure_encounter_requirement(true, false, 1)
	_expect(gate.can_open(), "exit gate ignores remaining optional encounter enemies")
	gate.configure_encounter_requirement(true, true, 0)
	_expect(gate.can_open(), "exit gate remains open after optional encounter completion")
	gate._current_sigils = 2
	_expect(gate.can_open(), "missing optional sigils cannot block reaching the destination")
	gate._current_sigils = 3
	gate.configure_encounter_requirement(false, false, 99)
	_expect(gate.can_open(), "all exits use destination-only completion")
	gate.free()


func _load_layout_entities(path: String) -> Array:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary:
		var entities: Variant = parsed.get("entities", [])
		if entities is Array:
			return entities
	return []


func _required_custom_events(encounter: EncounterDefinition) -> PackedStringArray:
	var result := PackedStringArray()
	if encounter == null or encounter.completion == null:
		return result
	for required_id: String in encounter.completion.required_objective_ids:
		for objective: EncounterObjectiveDefinition in encounter.objectives:
			if objective != null \
					and objective.objective_id == StringName(required_id) \
					and objective.objective_type == EncounterObjectiveDefinition.ObjectiveType.CUSTOM_EVENT:
				result.append(String(objective.target_id))
	return result


func _make_enemy(enemy_id: StringName) -> EnemyDefinition:
	var enemy := EnemyDefinition.new()
	enemy.enemy_id = enemy_id
	enemy.display_name = String(enemy_id).capitalize()
	enemy.role_tags = PackedStringArray(["test"])
	enemy.development_only = false
	enemy.base_scene = SKELETON_SCENE
	enemy.attack_behavior_id = &"test_attack"
	enemy.target_logic_id = &"nearest_player"
	enemy.max_health = 10.0
	enemy.movement_speed = 10.0
	enemy.preferred_range = 8.0
	enemy.attack_range = 12.0
	enemy.awareness_range = 40.0
	enemy.telegraph_seconds = 0.2
	enemy.recovery_seconds = 0.4
	enemy.attack_damage = 1.0
	return enemy


func _make_encounter(encounter_id: StringName, enemy_id: StringName) -> EncounterDefinition:
	var entry := EncounterSpawnEntry.new()
	entry.entry_id = StringName("%s_spawn" % encounter_id)
	entry.enemy_id = enemy_id
	entry.count = 1
	entry.spawn_region_id = &"test_region"
	entry.formation_id = &"scatter"

	var group := EncounterGroupDefinition.new()
	group.group_id = StringName("%s_group" % encounter_id)
	group.spawn_entries.append(entry)

	var wave := EncounterWaveDefinition.new()
	wave.wave_id = StringName("%s_wave" % encounter_id)
	wave.groups.append(group)

	var objective := EncounterObjectiveDefinition.new()
	objective.objective_id = StringName("%s_objective" % encounter_id)
	objective.objective_type = EncounterObjectiveDefinition.ObjectiveType.DEFEAT_COUNT
	objective.description_key = "objective.%s" % encounter_id
	objective.target_id = enemy_id
	objective.target_count = 1

	var completion := EncounterCompletionContract.new()
	completion.required_objective_ids = PackedStringArray([objective.objective_id])
	completion.completion_signal = &"encounter_completed"

	var encounter := EncounterDefinition.new()
	encounter.encounter_id = encounter_id
	encounter.display_name = String(encounter_id).capitalize()
	encounter.encounter_tags = PackedStringArray(["test"])
	encounter.development_only = false
	encounter.waves.append(wave)
	encounter.objectives.append(objective)
	encounter.completion = completion
	return encounter


func _make_level(
		level_id: StringName,
		campaign_slot: int,
		encounter_ids: PackedStringArray,
		prerequisite_level_ids: PackedStringArray,
		required_feature_ids: PackedStringArray,
		granted_feature_ids: PackedStringArray
) -> LevelDefinition:
	var requirements := LevelUnlockRequirements.new()
	requirements.prerequisite_level_ids = prerequisite_level_ids
	requirements.required_feature_ids = required_feature_ids

	var level := LevelDefinition.new()
	level.level_id = level_id
	level.display_name = String(level_id).capitalize()
	level.content_status = LevelDefinition.ContentStatus.CAMPAIGN_READY
	level.level_tags = PackedStringArray(["test"])
	level.campaign_slot = campaign_slot
	level.chapter_number = LevelDefinition.get_chapter_for_campaign_slot(campaign_slot)
	level.chapter_level_number = LevelDefinition.get_chapter_level_for_campaign_slot(campaign_slot)
	level.level_scene = CRYPT_SCENE
	level.layout_data_path = "res://data/levels/crypt_entrance.json"
	level.runtime_driver_id = &"dungeon_level"
	level.encounter_ids = encounter_ids
	level.entry_encounter_id = StringName(encounter_ids[0]) if not encounter_ids.is_empty() else StringName()
	level.unlock_requirements = requirements
	level.granted_feature_ids = granted_feature_ids
	return level


func _make_registry(
		enemy: EnemyDefinition,
		encounters: Array,
		levels: Array
) -> LevelRegistry:
	var registry := LevelRegistry.new()
	registry.registry_id = &"test_registry"
	registry.initial_feature_ids = PackedStringArray(["starter_sword"])
	registry.enemy_definitions.append(enemy)
	for encounter: EncounterDefinition in encounters:
		registry.encounter_definitions.append(encounter)
	for level: LevelDefinition in levels:
		registry.level_definitions.append(level)
	return registry


func _has_error(errors: PackedStringArray, needle: String) -> bool:
	for message: String in errors:
		if message.contains(needle):
			return true
	return false


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)
		push_error("CONTENT CONTRACT FAIL: %s" % label)


func _finish() -> void:
	var report := {
		"checks": _checks,
		"failures": _failures,
		"passed": _checks - _failures.size(),
	}
	var report_file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if report_file != null:
		report_file.store_string(JSON.stringify(report, "\t") + "\n")
		report_file.close()
	print("CONTENT_CONTRACTS %d/%d" % [_checks - _failures.size(), _checks])
	get_tree().quit(0 if _failures.is_empty() else 1)
