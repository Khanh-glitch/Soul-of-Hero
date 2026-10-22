extends SceneTree

const TEST_SAVE_PATH := "user://tests/player_progression_save_test.json"
const PRE_CORE_BALANCE_FIXTURE_PATH := "res://tests/fixtures/pre_core_balance_player_save_v2.json"
const PRE_CORE_BALANCE_ROUNDTRIP_PATH := "user://tests/pre_core_balance_player_save_roundtrip.json"
const PRE_SPECIALIZATION_FIXTURE_PATH := "res://tests/fixtures/pre_specialization_skill_budget_save_v2.json"
const PRE_SPECIALIZATION_ROUNDTRIP_PATH := "user://tests/pre_specialization_skill_budget_roundtrip.json"
const REPORT_PATH := "res://.artifacts/player_progression_save_report.json"
const RULES := preload("res://game/meta/progression/player_progression_rules.gd")
const PRE_CORE_BALANCE_AUXILIARY_UUID := "11111111-2222-3333-4444-555555555555"
const PRE_CORE_BALANCE_SOUL_INSTANCE_ID := "pre_core_balance_sword_001"

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var save_service := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_expect(save_service != null, "SaveService autoload exists")
	if save_service == null:
		_finish()
		return
	_remove_generations(TEST_SAVE_PATH)
	_expect(save_service.configure_storage(TEST_SAVE_PATH, true), "isolated player-progression profile loads")

	var initial := save_service.get_player_progression_snapshot()
	_expect(int(initial.get("player_level", 0)) == 1, "new profile starts at player level one")
	_expect(int((initial.get("stats", {}) as Dictionary).get("unspent_points", -1)) == 5, "level one owns five unspent Stat Points")
	_expect(int((initial.get("stat_economy", {}) as Dictionary).get("version", 0)) == 2, "new profile starts on the Power Stat economy")
	_expect(int((initial.get("stat_economy", {}) as Dictionary).get("free_reallocation_credits", -1)) == 0, "new profile does not mint a legacy Stat reallocation credit")
	_expect(int((initial.get("skills", {}) as Dictionary).get("unspent_points", -1)) == 2, "level one owns two specialization Skill Points")
	_expect(
		not save_service.allocate_hero_skill(&"sword_hero", &"normal_attack", 1, "test:progression:locked_before_level6"),
		"Skill allocation API stays locked until the Level 6 feature reward"
	)
	_expect(save_service.transact_once(
		"test:progression:unlock_level6_skills",
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {})
			var features: Dictionary = progression.get("features", {})
			features["skill_allocation"] = true
			features["skill_respec"] = true
			progression["features"] = features
			candidate["progression"] = progression
			return true
	), "fixture applies the authored Level 6 Skill feature reward")

	_expect(save_service.allocate_player_stat(&"hp", 5, "test:progression:hp5"), "five earned HP points commit atomically")
	_expect(not save_service.allocate_player_stat(&"hp", 1, "test:progression:hp_over"), "stat allocation cannot spend an unearned sixth point")
	_expect(not save_service.allocate_player_stat(&"unknown", 1, "test:progression:unknown"), "unknown stat IDs fail closed")
	var after_hp := save_service.get_player_progression_snapshot()
	_expect(is_equal_approx(float((after_hp["stats"] as Dictionary).get("hp", 0.0)), 169.3069136563682), "saved HP allocation sums five full-precision diminishing returns")

	_expect(save_service.allocate_hero_skill(&"sword_hero", &"normal_attack", 1, "test:progression:normal1"), "owned Sword receives one Normal Attack rank")
	_expect(not save_service.allocate_hero_skill(&"sword_hero", &"normal_attack", 1, "test:progression:rank_gate"), "level-one rank gate rejects rank two")
	_expect(not save_service.allocate_hero_skill(&"missing_hero", &"dash", 1, "test:progression:missing_hero"), "an unowned Hero Identity cannot consume Skill Points")

	_expect(save_service.grant_player_levels(19, "test:progression:level20"), "authoritative reward advances level one to level twenty")
	_expect(not save_service.grant_player_levels(19, "test:progression:level20"), "level reward receipt cannot apply twice")
	var level_twenty := save_service.get_player_progression_snapshot()
	_expect(int(level_twenty.get("player_level", 0)) == 20, "player level grant persists")
	_expect(int((level_twenty["skills"] as Dictionary).get("rank_gate", 0)) == 4, "level twenty permits rank four")
	_expect(save_service.allocate_hero_skill(&"sword_hero", &"active_skill", 4, "test:progression:active4"), "bulk allocation consumes one point per Active Skill rank")
	_expect(save_service.respec_hero_skills(&"sword_hero", true, "test:progression:free_respec"), "Hero Identity respec is free through level twenty")
	_expect(int(save_service.get_value(["currencies", "account"], -1)) == 0, "free respec spends no account gold")
	var after_free_respec := save_service.get_player_progression_snapshot()
	_expect(int((after_free_respec["skills"] as Dictionary).get("unspent_points", -1)) == 40, "respec refunds every Sword skill point to the global specialization pool")

	_expect(save_service.grant_player_levels(1, "test:progression:level21"), "profile advances to paid-respec level")
	_expect(save_service.allocate_hero_skill(&"sword_hero", &"dash", 1, "test:progression:dash1"), "a post-respec Dash rank can be allocated")
	_expect(not save_service.respec_hero_skills(&"sword_hero", false, "test:progression:combat_respec"), "respec is unavailable during combat")
	_expect(not save_service.respec_hero_skills(&"sword_hero", true, "test:progression:no_gold_respec"), "paid respec rejects insufficient account gold")
	_expect(save_service.transact_once(
		"test:progression:fund_respec",
		func(candidate: Dictionary) -> bool:
			candidate["currencies"]["account"] = 1000
			return true
	), "test profile receives deterministic respec gold")
	var paid_cost := RULES.respec_cost(21)
	_expect(paid_cost == 625, "level-21 respec uses min(2500, 100 + level * 25)")
	_expect(save_service.respec_hero_skills(&"sword_hero", true, "test:progression:paid_respec"), "funded out-of-combat respec commits")
	_expect(int(save_service.get_value(["currencies", "account"], -1)) == 1000 - paid_cost, "paid respec debits exact account gold")

	_expect(save_service.reload_save(), "player progression survives disk reload")
	var reloaded := save_service.get_player_progression_snapshot()
	_expect(int(reloaded.get("player_level", 0)) == 21, "reloaded profile preserves player level")
	_expect(is_equal_approx(float((reloaded["stats"] as Dictionary).get("hp", 0.0)), 533.4930384619063), "reloaded profile preserves allocation plus smooth level HP growth")
	_expect(int((reloaded["skills"] as Dictionary).get("spent_points", -1)) == 0, "reloaded profile preserves the completed respec")

	_test_pre_core_balance_fixture_roundtrip(save_service)
	_test_over_budget_skill_migration(save_service)
	_finish()


## This fixture is a valid serialized profile from the save shape used by the
## pre-core-balance build. It covers preservation of valid player-owned data;
## it is not intended to claim support for every malformed legacy document.
func _test_pre_core_balance_fixture_roundtrip(save_service: LivingArsenalSaveService) -> void:
	_remove_generations(PRE_CORE_BALANCE_ROUNDTRIP_PATH)
	var copied := _copy_fixture_to_user(
		PRE_CORE_BALANCE_FIXTURE_PATH,
		PRE_CORE_BALANCE_ROUNDTRIP_PATH,
	)
	_expect(copied, "serialized pre-core-balance build fixture is available to SaveService")
	if not copied:
		return

	_expect(
		save_service.configure_storage(PRE_CORE_BALANCE_ROUNDTRIP_PATH, true),
		"SaveService loads and sanitizes the serialized pre-core-balance build fixture",
	)
	var legacy_allocation := {"hp": 200, "damage": 150, "mana": 150}
	var replacement_allocation := {"hp": 200, "damage": 200, "mana": 100}
	_expect_pre_core_balance_values(save_service.get_snapshot(), "sanitized fixture load", legacy_allocation, 1)
	_expect(
		not save_service.reallocate_player_stats(replacement_allocation, false, "test:power_respec:combat"),
		"free Stat reallocation is unavailable during combat",
	)
	_expect(
		not save_service.reallocate_player_stats({"hp": 201, "damage": 200, "mana": 99}, true, "test:power_respec:invalid"),
		"free Stat reallocation rejects an invalid replacement without consuming credit",
	)
	_expect(
		not save_service.reallocate_player_stats(legacy_allocation, true, "test:power_respec:noop"),
		"free Stat reallocation rejects a no-op without consuming credit",
	)
	_expect(
		save_service.reallocate_player_stats(replacement_allocation, true, "test:power_respec:commit"),
		"migrated profile atomically commits one free HP/Mana/Power reallocation",
	)
	_expect_pre_core_balance_values(save_service.get_snapshot(), "post-reallocation profile", replacement_allocation, 0)
	_expect(
		not save_service.reallocate_player_stats(legacy_allocation, true, "test:power_respec:second"),
		"the one-time Stat reallocation credit cannot be spent twice",
	)
	_expect(save_service.save_now(), "SaveService writes the sanitized pre-core-balance fixture")
	_expect(save_service.reload_save(), "serialized pre-core-balance fixture reloads after disk roundtrip")
	_expect_pre_core_balance_values(save_service.get_snapshot(), "SaveService JSON roundtrip", replacement_allocation, 0)
	_expect(
		not save_service.get_player_progression_snapshot().is_empty(),
		"roundtripped pre-core-balance allocation still produces a derived progression snapshot",
	)


func _expect_pre_core_balance_values(
		snapshot: Dictionary,
		phase: String,
		expected_allocation: Dictionary,
		expected_free_reallocations: int,
) -> void:
	var player := (snapshot.get("progression", {}) as Dictionary).get("player", {}) as Dictionary
	_expect(int(player.get("level", 0)) == 100, "%s preserves player level 100" % phase)
	_expect(int(player.get("xp", -1)) == 0, "%s preserves valid level-cap XP 0" % phase)
	_expect(
		player.get("stat_allocation", {}) == expected_allocation,
		"%s preserves the expected atomic Stat allocation" % phase,
	)
	_expect(int(player.get("stat_economy_version", 0)) == 2, "%s records Power Stat economy version two" % phase)
	_expect(int(player.get("free_stat_reallocation_credits", -1)) == expected_free_reallocations, "%s preserves the exact free Stat reallocation credit count" % phase)
	var audit := snapshot.get("legacy_audit", {}) as Dictionary
	_expect(
		audit.get("stat_allocation_pre_power", {}) == {"hp": 200, "damage": 150, "mana": 150},
		"%s keeps the exact pre-Power allocation in the migration audit" % phase,
	)
	var skill_allocations := player.get("skill_allocations", {}) as Dictionary
	_expect(int(player.get("skill_economy_version", 0)) == 2, "%s upgrades the Skill economy marker" % phase)
	var sword_tracks := skill_allocations.get("sword_hero", {}) as Dictionary
	var all_tracks_are_rank_twenty := true
	for track_id: StringName in RULES.SKILL_TRACK_IDS:
		all_tracks_are_rank_twenty = all_tracks_are_rank_twenty \
			and int(sword_tracks.get(String(track_id), -1)) == 20
	_expect(all_tracks_are_rank_twenty, "%s preserves every Sword track at rank 20" % phase)

	var inventory := snapshot.get("inventory", {}) as Dictionary
	_expect(
		_find_auxiliary_item(inventory, PRE_CORE_BALANCE_AUXILIARY_UUID).get("uuid", "") \
			== PRE_CORE_BALANCE_AUXILIARY_UUID,
		"%s preserves the owned auxiliary equipment UUID" % phase,
	)
	_expect(
		String((snapshot.get("auxiliary_loadout", {}) as Dictionary).get("soul_vessel", "")) \
			== PRE_CORE_BALANCE_AUXILIARY_UUID,
		"%s preserves the equipped auxiliary UUID selection" % phase,
	)
	var selected_instances := (snapshot.get("soul_team", {}) as Dictionary).get(
		"selected_soul_instances", {},
	) as Dictionary
	_expect(
		String(selected_instances.get("sword_hero", "")) == PRE_CORE_BALANCE_SOUL_INSTANCE_ID,
		"%s preserves the selected Sword Hero Soul instance" % phase,
	)
	var selected_soul := _find_hero_soul(inventory, PRE_CORE_BALANCE_SOUL_INSTANCE_ID)
	_expect(
		String(selected_soul.get("instance_id", "")) == PRE_CORE_BALANCE_SOUL_INSTANCE_ID \
			and bool(selected_soul.get("equipped", false)),
		"%s keeps the selected Hero Soul owned and equipped" % phase,
	)


func _test_over_budget_skill_migration(save_service: LivingArsenalSaveService) -> void:
	_remove_generations(PRE_SPECIALIZATION_ROUNDTRIP_PATH)
	_expect(
		_copy_fixture_to_user(PRE_SPECIALIZATION_FIXTURE_PATH, PRE_SPECIALIZATION_ROUNDTRIP_PATH),
		"pre-specialization over-budget fixture is available",
	)
	_expect(
		save_service.configure_storage(PRE_SPECIALIZATION_ROUNDTRIP_PATH, true),
		"over-budget v2 Skill allocation migrates without making the profile unloadable",
	)
	var snapshot := save_service.get_snapshot()
	var player := (snapshot.get("progression", {}) as Dictionary).get("player", {}) as Dictionary
	var skill_snapshot := save_service.get_player_progression_snapshot().get("skills", {}) as Dictionary
	_expect(int(player.get("skill_economy_version", 0)) == 2, "migrated profile records Skill economy version two")
	_expect(int(skill_snapshot.get("spent_points", -1)) == 0, "over-budget legacy ranks receive a free full respec")
	_expect(int(skill_snapshot.get("unspent_points", -1)) == 200, "free migration respec restores the full derived level-100 budget")
	var audit := snapshot.get("legacy_audit", {}) as Dictionary
	var archived := audit.get("skill_allocations_pre_specialization", {}) as Dictionary
	_expect(archived.has("sword_hero") and archived.has("archer_hero"), "migration audit archives both original Hero allocations")
	_expect(save_service.reload_save(), "migrated specialization profile survives reload")
	_expect(
		int((save_service.get_player_progression_snapshot().get("skills", {}) as Dictionary).get("unspent_points", -1)) == 200,
		"specialization migration is idempotent after persistence",
	)


func _find_auxiliary_item(inventory: Dictionary, uuid: String) -> Dictionary:
	for raw_item: Variant in inventory.get("auxiliary_equipment", []):
		if raw_item is Dictionary and String((raw_item as Dictionary).get("uuid", "")) == uuid:
			return (raw_item as Dictionary).duplicate(true)
	return {}


func _find_hero_soul(inventory: Dictionary, instance_id: String) -> Dictionary:
	for raw_soul: Variant in inventory.get("hero_souls", []):
		if raw_soul is Dictionary \
				and String((raw_soul as Dictionary).get("instance_id", "")) == instance_id:
			return (raw_soul as Dictionary).duplicate(true)
	return {}


func _copy_fixture_to_user(source_path: String, destination_path: String) -> bool:
	var source := FileAccess.open(source_path, FileAccess.READ)
	if source == null:
		return false
	var directory_error := DirAccess.make_dir_recursive_absolute(
		ProjectSettings.globalize_path(destination_path.get_base_dir())
	)
	if directory_error != OK and directory_error != ERR_ALREADY_EXISTS:
		source.close()
		return false
	var destination := FileAccess.open(destination_path, FileAccess.WRITE)
	if destination == null:
		source.close()
		return false
	destination.store_buffer(source.get_buffer(source.get_length()))
	source.close()
	destination.close()
	return true


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _finish() -> void:
	_remove_generations(TEST_SAVE_PATH)
	_remove_generations(PRE_CORE_BALANCE_ROUNDTRIP_PATH)
	_remove_generations(PRE_SPECIALIZATION_ROUNDTRIP_PATH)
	var report := {
		"checks": _checks,
		"failures": _failures.duplicate(),
		"passed": _checks - _failures.size(),
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
	if _failures.is_empty():
		print("PLAYER PROGRESSION SAVE TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("PLAYER PROGRESSION SAVE TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
	else:
		_failures.append(message)
