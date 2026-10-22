extends SceneTree

const DEFINITIONS := preload("res://game/meta/monster_souls/monster_soul_definitions.gd")
const RULES := preload("res://game/meta/monster_souls/monster_soul_rules.gd")
const REPORT_PATH := "res://.artifacts/monster_soul_rules_report.json"

var _checks := 0
var _failures: Array[String] = []
var _reaper_tags := PackedStringArray(["active", "summon", "departure", "relay"])


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_catalog_and_reaper_profile()
	_test_level_50_access_gate()
	_test_instance_contract()
	_test_rank_resolved_profile()
	_test_action_tag_compatibility()
	_test_duplicate_essence_and_deterministic_rank_up()
	_test_one_socket_bonding_and_auto_lock()
	_test_destructive_soul_severance()
	_finish()


func _test_catalog_and_reaper_profile() -> void:
	var errors := DEFINITIONS.get_catalog_errors()
	_expect(errors.is_empty(), "Monster Soul catalog validates: %s" % "; ".join(errors))
	_expect(DEFINITIONS.DEFINITIONS.size() == 1, "V0.4 authors exactly one Monster Soul family profile")
	_expect(DEFINITIONS.REAPER_DEFINITION_ID == "reaper_monster_soul", "Reaper owns the canonical first definition ID")
	_expect(DEFINITIONS.FIRST_GUARANTEED_DEFINITION_ID == DEFINITIONS.REAPER_DEFINITION_ID, "Reaper is the guaranteed first Monster Soul")
	_expect(DEFINITIONS.SYSTEM_UNLOCK_LEVEL == 50, "Monster Soul system unlock level is exactly 50")
	_expect(DEFINITIONS.MAX_SOCKETS_PER_HERO_SOUL == 1, "each Hero Soul owns exactly one Monster Soul socket")
	_expect(DEFINITIONS.MAX_RANK == 3 and DEFINITIONS.ESSENCE_PER_RANK == 3, "Monster Souls cap at Rank 3 and spend three Essence per rank")
	_expect(DEFINITIONS.SOUL_SEVERANCE_ITEM_ID == "soul_severance", "Soul Severance has a stable gameplay-item ID")

	var reaper := DEFINITIONS.get_definition(DEFINITIONS.REAPER_DEFINITION_ID)
	_expect(reaper.get("display_name") == "Reaper Monster Soul", "first authored profile is visibly named Reaper Monster Soul")
	_expect(reaper.get("family") == "reaper", "Reaper profile produces family-specific Reaper Essence")
	_expect(reaper.get("unlock_level") == 50, "Reaper cannot unlock before Level 50")
	_expect(reaper.get("source_enemy_ids") == ["reaper_sovereign"], "Reaper has a deterministic Chapter 5 boss source")
	_expect(bool(reaper.get("guaranteed_first_reward")), "Reaper profile marks the first reward as guaranteed")
	_expect(not bool(reaper.get("paid_only")), "Reaper has no paid-only acquisition requirement")
	_expect((reaper.get("stat_package") as Dictionary).size() == 3, "Reaper carries a three-stat numeric package")
	_expect(
		(reaper.get("required_action_tags") as Array) == (reaper.get("compatible_tags") as Array),
		"required action tags preserve the FULL-spec compatible_tags interface"
	)
	_expect(
		(reaper.get("forbidden_action_tags") as Array) == (reaper.get("forbidden_tags") as Array),
		"forbidden action tags preserve the FULL-spec forbidden_tags interface"
	)
	_expect(DEFINITIONS.mechanical_rewrite_count(reaper) == 3, "Reaper rewrites exactly three bounded kit modules")
	_expect(
		DEFINITIONS.mechanical_rewrite_count(reaper) <= DEFINITIONS.MAX_MECHANICAL_REWRITES,
		"Reaper stays within the global three-module mechanical rewrite cap"
	)
	var theme: Dictionary = reaper.get("vfx_audio_theme", {})
	_expect(theme.get("vfx_theme_id") == "reaper_spectral_vfx", "Reaper exposes a stable VFX theme ID")
	_expect(theme.get("audio_theme_id") == "reaper_spectral_audio", "Reaper exposes a stable audio theme ID")
	for index: int in DEFINITIONS.MODIFIER_FIELDS.size():
		var modifier: Dictionary = reaper[DEFINITIONS.MODIFIER_FIELDS[index]]
		_expect(modifier.get("module_id") == DEFINITIONS.MODULE_IDS[index], "Reaper modifier maps to canonical module %s" % DEFINITIONS.MODULE_IDS[index])
		_expect(modifier.get("change_kind") == "mechanical_rewrite", "Reaper module %s declares its authored rewrite cost" % DEFINITIONS.MODULE_IDS[index])


func _test_level_50_access_gate() -> void:
	_expect(RULES.system_access_state(1, false) == RULES.ACCESS_HIDDEN, "Monster Soul is hidden at Level 1")
	_expect(RULES.system_access_state(49, true) == RULES.ACCESS_HIDDEN, "even a boss flag cannot reveal Monster Soul before Level 50")
	_expect(not RULES.is_system_visible(49), "no Monster Soul socket visibility leaks at Level 49")
	_expect(not RULES.is_system_available(49, true), "Monster Soul remains unavailable before Level 50")
	_expect(RULES.system_access_state(50, false) == RULES.ACCESS_LOCKED, "Level 50 reveals a locked state until Chapter 5 boss clear")
	_expect(RULES.is_system_visible(50), "Monster Soul interface may become visible at Level 50")
	_expect(not RULES.is_system_available(50, false), "Level 50 without the Chapter 5 boss clear is unavailable")
	_expect(RULES.system_access_state(50, true) == RULES.ACCESS_AVAILABLE, "Level 50 plus Chapter 5 boss clear makes the interface available")
	_expect(RULES.create_guaranteed_first_instance(49, true, 1001).is_empty(), "guaranteed Reaper cannot be created early")
	_expect(RULES.create_guaranteed_first_instance(50, false, 1001).is_empty(), "guaranteed Reaper waits for the Chapter 5 boss")
	var guaranteed := RULES.create_guaranteed_first_instance(50, true, 1001)
	_expect(not guaranteed.is_empty(), "Chapter 5 completion creates the guaranteed first Reaper instance")
	_expect(guaranteed.get("definition_id") == DEFINITIONS.REAPER_DEFINITION_ID, "guaranteed instance resolves to Reaper")


func _test_instance_contract() -> void:
	var first := RULES.create_instance(&"reaper_monster_soul", 2001, &"test_drop")
	var repeat := RULES.create_instance(&"reaper_monster_soul", 2001, &"test_drop")
	var different := RULES.create_instance(&"reaper_monster_soul", 2002, &"test_drop")
	_expect(first == repeat, "same Monster Soul generation inputs are deterministic")
	_expect(first.get("uuid") != different.get("uuid"), "different seeds produce distinct Monster Soul UUIDs")
	_expect(first.size() == 5, "Monster Soul instance uses the compact five-field FULL-spec shape")
	for field_name: String in RULES.REQUIRED_INSTANCE_FIELDS:
		_expect(first.has(field_name), "Monster Soul instance includes '%s'" % field_name)
	_expect(RULES.validate_instance(first).is_empty(), "generated Reaper instance validates")
	_expect(first.get("rank") == 1 and first.get("essence_count") == 0, "new Monster Souls start at Rank 1 with no banked Essence")
	_expect(first.get("bonded_hero_soul_uuid") == "", "new Monster Souls start unbonded")
	_expect(String(first.get("uuid", "")).length() == 36, "Monster Soul UUID uses the stable 8-4-4-4-12 form")
	_expect(RULES.create_instance(&"unknown_soul", 1).is_empty(), "unknown definitions fail closed")
	_expect(RULES.create_instance(&"reaper_monster_soul", 1, &"Bad Namespace").is_empty(), "invalid generation namespaces fail closed")

	var malformed := first.duplicate(true)
	malformed["uuid"] = "bad-uuid"
	_expect(_has_error(RULES.validate_instance(malformed), "uuid is invalid"), "malformed Monster Soul UUID is rejected")
	var float_rank := first.duplicate(true)
	float_rank["rank"] = 1.0
	_expect(_has_error(RULES.validate_instance(float_rank), "rank must be an integer"), "non-integer rank is rejected")
	var overflow_rank := first.duplicate(true)
	overflow_rank["rank"] = 4
	_expect(_has_error(RULES.validate_instance(overflow_rank), "rank must be an integer"), "rank above 3 is rejected")
	var float_essence := first.duplicate(true)
	float_essence["essence_count"] = 0.0
	_expect(_has_error(RULES.validate_instance(float_essence), "non-negative integer"), "non-integer Essence is rejected")
	var missing_bond := first.duplicate(true)
	missing_bond.erase("bonded_hero_soul_uuid")
	_expect(_has_error(RULES.validate_instance(missing_bond), "missing required field 'bonded_hero_soul_uuid'"), "missing bond reference is rejected")


func _test_rank_resolved_profile() -> void:
	var rank_1 := RULES.resolved_profile(DEFINITIONS.REAPER_DEFINITION_ID, 1)
	var rank_2 := RULES.resolved_profile(DEFINITIONS.REAPER_DEFINITION_ID, 2)
	var rank_3 := RULES.resolved_profile(DEFINITIONS.REAPER_DEFINITION_ID, 3)
	_expect(not rank_1.is_empty() and not rank_2.is_empty() and not rank_3.is_empty(), "all three Reaper ranks resolve")
	_expect((rank_1["stat_package"] as Dictionary).get("damage_percent") == 6.0, "Rank 1 resolves first stat-package values")
	_expect((rank_3["stat_package"] as Dictionary).get("damage_percent") == 12.0, "Rank 3 resolves final stat-package values")
	_expect((rank_3["stat_package"] as Dictionary).get("max_mana_percent") > (rank_1["stat_package"] as Dictionary).get("max_mana_percent"), "ranks improve numeric stats")
	for field_name: String in DEFINITIONS.MODIFIER_FIELDS:
		var modifier_1: Dictionary = rank_1[field_name]
		var modifier_2: Dictionary = rank_2[field_name]
		var modifier_3: Dictionary = rank_3[field_name]
		_expect(modifier_1.get("mechanic_id") == modifier_2.get("mechanic_id") and modifier_2.get("mechanic_id") == modifier_3.get("mechanic_id"), "rank never adds or swaps the %s mechanic" % field_name)
		_expect(not modifier_1.has("numeric_by_rank") and modifier_1.has("numeric_values"), "resolved %s exposes one rank's numeric values only" % field_name)
	_expect(DEFINITIONS.mechanical_rewrite_count(rank_1) == DEFINITIONS.mechanical_rewrite_count(rank_3), "rank progression never adds another mechanical rewrite")
	_expect(RULES.resolved_profile(DEFINITIONS.REAPER_DEFINITION_ID, 0).is_empty(), "Rank 0 profile resolution fails closed")
	_expect(RULES.resolved_profile(DEFINITIONS.REAPER_DEFINITION_ID, 4).is_empty(), "Rank 4 profile resolution fails closed")


func _test_action_tag_compatibility() -> void:
	_expect(RULES.compatibility_errors(DEFINITIONS.REAPER_DEFINITION_ID, _reaper_tags).is_empty(), "Reaper accepts a Hero Soul with every required action tag")
	var missing_relay := PackedStringArray(["active", "summon", "departure"])
	_expect(_has_error(RULES.compatibility_errors(DEFINITIONS.REAPER_DEFINITION_ID, missing_relay), "required action tag 'relay'"), "missing required action tags fail closed")
	var forbidden := _reaper_tags.duplicate()
	forbidden.append("no_projectile_mutation")
	_expect(_has_error(RULES.compatibility_errors(DEFINITIONS.REAPER_DEFINITION_ID, forbidden), "forbidden action tag"), "forbidden action tags block an unsupported mutation")
	var malformed := _reaper_tags.duplicate()
	malformed.append("Bad Tag")
	_expect(_has_error(RULES.compatibility_errors(DEFINITIONS.REAPER_DEFINITION_ID, malformed), "is invalid"), "malformed action tags fail closed")
	_expect(_has_error(RULES.compatibility_errors("unknown", _reaper_tags), "Unknown Monster Soul"), "unknown profiles cannot pass compatibility")


func _test_duplicate_essence_and_deterministic_rank_up() -> void:
	var target := RULES.create_instance(&"reaper_monster_soul", 3001, &"rank_target")
	var duplicate := RULES.create_instance(&"reaper_monster_soul", 3002, &"duplicate")
	var conversion := RULES.convert_duplicate_to_essence(duplicate)
	_expect(conversion.get("family") == "reaper", "duplicates convert into family-specific Reaper Essence")
	_expect(conversion.get("essence_amount") == 1, "one duplicate converts into one family Essence")
	_expect(conversion.get("destroyed_monster_soul_uuid") == duplicate.get("uuid"), "duplicate conversion identifies the consumed Monster Soul")
	var bonded_duplicate := duplicate.duplicate(true)
	bonded_duplicate["bonded_hero_soul_uuid"] = "owned-hero"
	_expect(RULES.convert_duplicate_to_essence(bonded_duplicate).is_empty(), "bonded Monster Souls cannot be consumed as duplicates")
	_expect(RULES.add_family_essence(target, &"wrong_family", 1).is_empty(), "Essence from another family cannot upgrade Reaper")
	_expect(RULES.add_family_essence(target, &"reaper", 0).is_empty(), "non-positive Essence grants fail closed")

	var with_two := RULES.add_family_essence(target, &"reaper", 2)
	_expect(with_two.get("essence_count") == 2, "family Essence accumulates on the target instance")
	_expect(_has_error(RULES.rank_up_errors(with_two), "requires 3 family Essence"), "two Essence cannot raise a rank")
	var with_three := RULES.add_family_essence(with_two, &"reaper", 1)
	var first_result := RULES.rank_up(with_three)
	var repeated_result := RULES.rank_up(with_three)
	_expect(bool(first_result.get("ok")), "exactly three family Essence raises Rank 1 to Rank 2")
	_expect(first_result == repeated_result, "rank-up is deterministic and has no random roll")
	_expect(first_result.get("failure_chance") == 0.0, "rank-up explicitly has zero failure chance")
	var rank_2: Dictionary = first_result.get("monster_soul", {})
	_expect(rank_2.get("rank") == 2 and rank_2.get("essence_count") == 0, "Rank 2 consumes exactly three Essence")
	var rank_2_ready := RULES.add_family_essence(rank_2, &"reaper", 3)
	var second_result := RULES.rank_up(rank_2_ready)
	var rank_3: Dictionary = second_result.get("monster_soul", {})
	_expect(rank_3.get("rank") == 3 and rank_3.get("essence_count") == 0, "three more Essence deterministically raises Rank 2 to Rank 3")
	_expect(_has_error(RULES.rank_up_errors(rank_3), "maximum Rank 3"), "Rank 3 is the hard cap")
	_expect(RULES.add_family_essence(rank_3, &"reaper", 1).is_empty(), "a capped instance cannot absorb unusable Essence")


func _test_one_socket_bonding_and_auto_lock() -> void:
	var hero := _hero_fixture("hero-sword-001")
	var monster := RULES.create_instance(&"reaper_monster_soul", 4001, &"bond")
	_expect(_has_error(RULES.bonding_errors(hero, monster, 49, true, _reaper_tags, false), "hidden before player Level 50"), "bonding cannot leak before Level 50")
	_expect(_has_error(RULES.bonding_errors(hero, monster, 50, false, _reaper_tags, false), "Chapter 5 boss"), "bonding requires the Chapter 5 boss clear")
	_expect(_has_error(RULES.bonding_errors(hero, monster, 50, true, _reaper_tags, true), "during combat"), "bonding is unavailable during combat")
	var missing_tags := PackedStringArray(["active", "summon"])
	_expect(not RULES.bonding_errors(hero, monster, 50, true, missing_tags, false).is_empty(), "bonding applies action-tag compatibility")

	var result := RULES.bond(hero, monster, 50, true, _reaper_tags)
	_expect(bool(result.get("ok")), "compatible Reaper bonds after the Level 50 gate")
	var bonded_hero: Dictionary = result.get("hero_soul", {})
	var bonded_monster: Dictionary = result.get("monster_soul", {})
	_expect(bool(bonded_hero.get("locked")), "bonding automatically locks the Hero Soul")
	_expect(bonded_hero.get("monster_soul_id") == monster.get("uuid"), "current prototype Hero Soul field stores the bonded Monster Soul UUID")
	_expect(bonded_hero.get("monster_soul_instance_id") == monster.get("uuid"), "FULL-schema Hero Soul field stores the same bonded UUID")
	_expect(bonded_monster.get("bonded_hero_soul_uuid") == hero.get("instance_id"), "Monster Soul points back to the selected Hero Soul")
	_expect(bool(result.get("auto_locked_hero_soul")), "bond result explicitly reports the automatic safety lock")
	_expect(not bool(hero.get("locked")) and hero.get("monster_soul_id") == "", "pure bonding leaves the input Hero Soul unchanged")
	_expect(monster.get("bonded_hero_soul_uuid") == "", "pure bonding leaves the input Monster Soul unchanged")

	var second_monster := RULES.create_instance(&"reaper_monster_soul", 4002, &"bond")
	_expect(_has_error(RULES.bonding_errors(bonded_hero, second_monster, 50, true, _reaper_tags, false), "one Monster Soul socket occupied"), "one Hero Soul cannot bond a second Monster Soul")
	var corrupt_aliases := bonded_hero.duplicate(true)
	corrupt_aliases["monster_soul_id"] = "another-monster"
	_expect(_has_error(RULES.bonding_errors(corrupt_aliases, second_monster, 50, true, _reaper_tags, false), "socket aliases disagree"), "conflicting current/FULL socket aliases fail closed")
	_expect(_has_error(RULES.bonding_errors(_hero_fixture("other-hero"), bonded_monster, 50, true, _reaper_tags, false), "already bonded"), "one Monster Soul cannot occupy a second Hero Soul")
	var full_schema_hero := _hero_fixture("")
	full_schema_hero.erase("instance_id")
	full_schema_hero["uuid"] = "full-schema-hero-uuid"
	_expect(bool(RULES.bond(full_schema_hero, second_monster, 50, true, _reaper_tags).get("ok")), "bonding accepts the FULL-schema Hero Soul uuid field")


func _test_destructive_soul_severance() -> void:
	var hero := _hero_fixture("hero-axe-001")
	var monster := RULES.create_instance(&"reaper_monster_soul", 5001, &"sever")
	var bonded := RULES.bond(hero, monster, 50, true, _reaper_tags)
	var bonded_hero: Dictionary = bonded.get("hero_soul", {})
	var bonded_monster: Dictionary = bonded.get("monster_soul", {})
	_expect(_has_error(RULES.severance_errors(bonded_hero, bonded_monster, 0), "Soul Severance item is required"), "bonding is permanent without Soul Severance")
	var mismatch := bonded_monster.duplicate(true)
	mismatch["bonded_hero_soul_uuid"] = "different-hero"
	_expect(_has_error(RULES.severance_errors(bonded_hero, mismatch, 1), "bond does not match"), "severance validates both sides of the bond")

	var severed := RULES.sever(bonded_hero, bonded_monster, 2)
	_expect(bool(severed.get("ok")), "Soul Severance returns the Hero Soul")
	var returned_hero: Dictionary = severed.get("hero_soul", {})
	_expect(returned_hero.get("monster_soul_id") == "" and returned_hero.get("monster_soul_instance_id") == "", "severance clears both Hero Soul socket field names")
	_expect(bool(returned_hero.get("locked")), "returned Hero Soul remains safely locked until an explicit later unlock")
	_expect(bool(severed.get("monster_soul_destroyed")), "severance explicitly destroys the installed Monster Soul")
	_expect(severed.get("destroyed_monster_soul_uuid") == bonded_monster.get("uuid"), "severance identifies the destroyed instance")
	_expect(not severed.has("monster_soul"), "destroyed Monster Soul is never returned as an owned instance")
	_expect(severed.get("remaining_soul_severance") == 1, "severance consumes exactly one gameplay-earned item")
	_expect(bonded_hero.get("monster_soul_id") == bonded_monster.get("uuid"), "pure severance leaves its bonded input unchanged")


func _hero_fixture(instance_id: String) -> Dictionary:
	return {
		"instance_id": instance_id,
		"hero_id": "sword",
		"monster_soul_id": "",
		"locked": false,
		"favorite": false,
		"equipped": false,
	}


func _has_error(errors: PackedStringArray, fragment: String) -> bool:
	for error: String in errors:
		if error.to_lower().contains(fragment.to_lower()):
			return true
	return false


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error(message)


func _finish() -> void:
	var report := {
		"ok": _failures.is_empty(),
		"checks": _checks,
		"failures": _failures,
		"scope": "Monster Soul schema/foundation only; no Level 50 UI, save, loot, or combat runtime",
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	if _failures.is_empty():
		print("MONSTER SOUL RULES TEST PASSED - %d checks" % _checks)
	else:
		print("MONSTER SOUL RULES TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(0 if _failures.is_empty() else 1)
