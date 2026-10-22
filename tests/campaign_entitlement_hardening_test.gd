extends SceneTree

const TEST_SAVE_PATH := "user://tests/campaign_entitlement_hardening_test.json"
const REPORT_PATH := "res://.artifacts/campaign_entitlement_hardening_report.json"
const V2_RECEIPT := "campaign:unlock_reconciliation:v2"
const V4_RECEIPT := "campaign:visible_reward_reconciliation:v4"
const V5_RECEIPT := "campaign:content_entitlement_reconciliation:v5"
const V6_RECEIPT := "campaign:content_entitlement_reconciliation:v6"
const CAMPAIGN_REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const CAMPAIGN_REWARDS: RewardBundleRegistry = preload("res://data/content/rewards/campaign_reward_registry.tres")

var _save: LivingArsenalSaveService
var _app_flow: Node
var _fake_root: FakeAppRoot
var _checks := 0
var _failures: Array[String] = []


class FakeAppRoot extends Node:
	var route_id: StringName
	var payload: Dictionary = {}

	func show_route(_scene_path: String, next_payload: Dictionary, next_route_id: StringName) -> void:
		route_id = next_route_id
		payload = next_payload.duplicate(true)


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_save = root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_app_flow = root.get_node_or_null("AppFlow")
	_expect(_save != null and _app_flow != null, "Production SaveService and AppFlow autoloads exist")
	if _save == null or _app_flow == null:
		_finish()
		return
	_fake_root = FakeAppRoot.new()
	root.add_child(_fake_root)

	_test_forged_unlock_fails_closed()
	_test_level_nine_atomic_boss_gate()
	_test_old_v5_profile_receives_v6_taxonomy_repairs()
	_test_results_entitlement_copy()
	_finish()


func _test_forged_unlock_fails_closed() -> void:
	_reset_fresh_profile()
	_app_flow.call(&"detach_app_root", _fake_root)
	var snapshot := _save.get_snapshot()
	var progression: Dictionary = snapshot.get("progression", {}).duplicate(true)
	var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
	var completed: Dictionary = campaign.get("completed_levels", {}).duplicate(true)
	completed["chapter_1_level_9"] = true
	campaign["completed_levels"] = completed
	var unlocked: Array = campaign.get("unlocked_levels", []).duplicate()
	if not unlocked.has("chapter_1_level_10"):
		unlocked.append("chapter_1_level_10")
	campaign["unlocked_levels"] = unlocked
	progression["campaign"] = campaign
	var features: Dictionary = progression.get("features", {}).duplicate(true)
	features["chapter_1_boss_gate"] = false
	progression["features"] = features
	snapshot["progression"] = progression
	_expect(_write_snapshot(snapshot), "Forged fixture writes a stale explicit Level 10 unlock")
	_expect(_save.reload_save(), "Forged fixture reloads through production validation")
	_app_flow.call(&"attach_app_root", _fake_root)
	_expect(_save.is_transaction_applied(V6_RECEIPT), "Fixture retains the consumed v6 receipt, so no migration masks the runtime gate")
	_expect(not bool(_app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_10")), "Explicit unlocked_levels cannot bypass the required chapter_1_boss_gate feature")
	_expect(not bool(_app_flow.call(&"start_campaign_level", &"chapter_1_level_10")), "Forged/stale Level 10 cannot start through AppFlow")
	var details: Dictionary = _app_flow.call(&"get_level_details", &"chapter_1_level_10")
	_expect(not bool(details.get("unlocked", true)), "Level details UI receives the same fail-closed entitlement state")


func _test_level_nine_atomic_boss_gate() -> void:
	_reset_fresh_profile()
	_app_flow.call(&"detach_app_root", _fake_root)
	var snapshot := _save.get_snapshot()
	var progression: Dictionary = snapshot.get("progression", {}).duplicate(true)
	var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
	var completed: Dictionary = campaign.get("completed_levels", {}).duplicate(true)
	completed["chapter_1_level_8"] = true
	campaign["completed_levels"] = completed
	var unlocked: Array = campaign.get("unlocked_levels", []).duplicate()
	if not unlocked.has("chapter_1_level_9"):
		unlocked.append("chapter_1_level_9")
	campaign["unlocked_levels"] = unlocked
	progression["campaign"] = campaign
	var features: Dictionary = progression.get("features", {}).duplicate(true)
	features["chapter_1_boss_gate"] = false
	progression["features"] = features
	snapshot["progression"] = progression
	_expect(_write_snapshot(snapshot), "Pre-Level-9 fixture writes")
	_expect(_save.reload_save(), "Pre-Level-9 fixture reloads")
	_app_flow.call(&"attach_app_root", _fake_root)
	_expect(bool(_app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_9")), "Completed Level 8 legitimately unlocks Level 9")
	_expect(not bool(_app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_10")), "Level 10 remains closed before the Level 9 boss-gate grant")
	var revision_before := int(_save.get_value(["revision"], -1))
	_expect(bool(_app_flow.call(&"start_campaign_level", &"chapter_1_level_9")), "Level 9 starts through the production AppFlow")
	_app_flow.call(&"complete_active_run", {"entitlement_gate_test": true}, true)
	var after := _save.get_snapshot()
	_expect(int(after.get("revision", -1)) == revision_before + 1, "Level 9 reward, completion, feature and next unlock commit in one revision")
	_expect(bool(_save.get_value(["progression", "campaign", "completed_levels", "chapter_1_level_9"], false)), "The atomic transaction records Level 9 completion")
	_expect(bool(_save.get_value(["progression", "features", "chapter_1_boss_gate"], false)), "The same transaction grants chapter_1_boss_gate")
	_expect((_save.get_value(["progression", "campaign", "unlocked_levels"], []) as Array).has("chapter_1_level_10"), "The same transaction persists the Level 10 unlock cache")
	_expect(bool(_app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_10")), "Level 10 becomes runnable only after both prerequisite and feature exist")
	var receipt: Dictionary = _save.get_value(["applied_transactions", "campaign:chapter_1_level_9:complete"], {})
	_expect(String((receipt.get("metadata", {}) as Dictionary).get("reward_bundle_id", "")) == "chapter_1_level_9_reward", "Level 9 receipt records the atomic reward provenance")
	_expect(_fake_root.route_id == &"gameplay", "Level 9 completion stays in gameplay after the durable commit")


func _test_old_v5_profile_receives_v6_taxonomy_repairs() -> void:
	_reset_fresh_profile()
	_app_flow.call(&"detach_app_root", _fake_root)
	var snapshot := _save.get_snapshot()
	var progression: Dictionary = snapshot.get("progression", {}).duplicate(true)
	var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
	var completed := {}
	var unlocked: Array = []
	for slot: int in range(1, 11):
		completed["chapter_1_level_%d" % slot] = true
		unlocked.append("chapter_1_level_%d" % slot)
	campaign["completed_levels"] = completed
	campaign["unlocked_levels"] = unlocked
	campaign["level"] = 10
	progression["campaign"] = campaign
	var player: Dictionary = progression.get("player", {}).duplicate(true)
	player["level"] = 1
	progression["player"] = player
	progression["unlocked_heroes"] = {"sword_hero": true}
	var repaired_features := [
		"skill_allocation", "skill_respec",
		"soul_jewelry", "hero_soul_inventory", "hero_soul_sell",
		"chapter_1_boss_gate", "hero_soul_fusion", "chapter_2_access", "hunt_replay",
	]
	var features: Dictionary = progression.get("features", {}).duplicate(true)
	features["soul_hero"] = false
	features["soul_relay"] = false
	features["soul_focus"] = true
	for feature_id: String in repaired_features:
		features[feature_id] = false
	progression["features"] = features
	snapshot["progression"] = progression

	var inventory: Dictionary = snapshot.get("inventory", {}).duplicate(true)
	var existing_souls: Array = inventory.get("hero_souls", [])
	inventory["hero_souls"] = [existing_souls[0]] if not existing_souls.is_empty() else []
	inventory["auxiliary_equipment"] = []
	inventory["item_stacks"] = {}
	snapshot["inventory"] = inventory
	snapshot["auxiliary_loadout"] = {"soul_vessel": "", "soul_boots": "", "soul_trace": ""}
	var soul_team: Dictionary = snapshot.get("soul_team", {}).duplicate(true)
	soul_team["active_hero"] = "sword_hero"
	soul_team["reserve_souls"] = ["", ""]
	snapshot["soul_team"] = soul_team
	snapshot["currencies"] = {"account": 777, "hero_materials": 33, "monster_fragments": 22}
	var transactions: Dictionary = snapshot.get("applied_transactions", {}).duplicate(true)
	_expect(transactions.has(V2_RECEIPT) and transactions.has(V4_RECEIPT), "Legacy fixture begins with already-consumed v2 and v4 receipts")
	transactions[V5_RECEIPT] = {
		"applied_at_unix": 1,
		"metadata": {"kind": "campaign_content_entitlement_reconciliation", "content_entitlement_version": 5},
	}
	transactions.erase(V6_RECEIPT)
	for slot: int in range(5, 11):
		transactions["campaign:chapter_1_level_%d:complete" % slot] = {
			"applied_at_unix": 1,
			"metadata": {"kind": "legacy_campaign_completion", "level": slot},
		}
	snapshot["applied_transactions"] = transactions
	_expect(_write_snapshot(snapshot), "Old v5 completed-Level-10 fixture writes")
	_expect(_save.reload_save(), "Old v5 fixture reloads through production validation")
	_app_flow.call(&"attach_app_root", _fake_root)

	_expect(_save.is_transaction_applied(V6_RECEIPT), "Attach records the independent v6 taxonomy-entitlement receipt")
	var v6: Dictionary = _save.get_value(["applied_transactions", V6_RECEIPT], {})
	_expect(int((v6.get("metadata", {}) as Dictionary).get("content_entitlement_version", 0)) == 6, "v6 receipt records its explicit entitlement version")
	_expect(
		_save.is_transaction_applied(V2_RECEIPT)
			and _save.is_transaction_applied(V4_RECEIPT)
			and _save.is_transaction_applied(V5_RECEIPT),
		"v6 preserves the historical v2/v4/v5 receipts",
	)
	_expect(int(_save.get_value(["progression", "player", "level"], 0)) == 11, "Ten completed first clears repair the deterministic minimum Player Level to 11")
	for feature_id: String in repaired_features:
		_expect(bool(_save.get_value(["progression", "features", feature_id], false)), "v6 repairs feature '%s'" % feature_id)
	_expect(not bool(_save.get_value(["progression", "features", "soul_focus"], false)), "v6 retires the stale Soul Focus feature")
	_expect(
		not bool(_save.get_value(["progression", "features", "soul_hero"], false))
			and not bool(_save.get_value(["progression", "features", "soul_relay"], false)),
		"v6 does not fabricate pickup-only Soul features from a Level 5 completion receipt",
	)
	_expect(
		not bool(_save.get_value(["progression", "unlocked_heroes", "axe_hero"], false))
			and not bool(_save.get_value(["progression", "unlocked_heroes", "archer_hero"], false)),
		"v6 restores neither the postponed Axe nor the independently collected Archer without its pickup receipt",
	)
	_expect(bool(_app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_10")), "Repaired Level 9 feature and completion legitimately reopen Level 10")
	_expect(_save.get_value(["currencies"], {}) == {"account": 777, "hero_materials": 33, "monster_fragments": 22}, "Reconciliation never duplicates old campaign currency")
	_expect(_save.get_value(["inventory", "item_stacks"], {}) == {}, "Reconciliation never duplicates old stackable loot")

	var expected_soul_ids: Array[String] = []
	var expected_auxiliary_ids: Array[String] = []
	for slot: int in range(1, 11):
		var level := CAMPAIGN_REGISTRY.find_campaign_level(slot)
		var bundle := CAMPAIGN_REWARDS.find_bundle(level.completion_reward_bundle_id) if level != null else null
		if bundle == null:
			continue
		var summary := bundle.to_summary()
		for raw_soul: Variant in summary.get("hero_souls", []):
			if raw_soul is Dictionary:
				expected_soul_ids.append(String((raw_soul as Dictionary).get("instance_id", "")))
		for raw_item: Variant in summary.get("auxiliary_equipment", []):
			if raw_item is Dictionary:
				expected_auxiliary_ids.append(String((raw_item as Dictionary).get("uuid", "")))
	_expect(expected_soul_ids.size() == 2 and expected_auxiliary_ids.size() == 4, "Chapter 1 completion bundles currently declare two deterministic Souls and four deterministic auxiliary items")
	for instance_id: String in expected_soul_ids:
		_expect(_count_inventory_id("hero_souls", "instance_id", instance_id) == 1, "v6 restores unique Soul %s exactly once" % instance_id)
	for uuid: String in expected_auxiliary_ids:
		_expect(_count_inventory_id("auxiliary_equipment", "uuid", uuid) == 1, "v6 restores unique auxiliary item %s exactly once" % uuid)

	var after_first_repair := _save.get_snapshot()
	_app_flow.call(&"detach_app_root", _fake_root)
	_app_flow.call(&"attach_app_root", _fake_root)
	_expect(_save.get_snapshot() == after_first_repair, "Repeated attach after v6 is a byte-equivalent entitlement no-op")


func _test_results_entitlement_copy() -> void:
	var results_script := load("res://game/ui/screens/results/training_results_screen.gd") as Script
	_expect(results_script != null, "Production Results script loads")
	if results_script == null:
		return
	var constants := results_script.get_script_constant_map()
	var feature_names: Dictionary = constants.get("FEATURE_NAMES", {})
	var stat_names: Dictionary = constants.get("STAT_NAMES", {})
	_expect(String(feature_names.get("soul_jewelry", "")) == "Ô Trang sức Linh Hồn", "Results localizes the live Level 7 Jewelry unlock")
	_expect(String(feature_names.get("chapter_2_access", "")) == "Mở Chương 2: Xưởng Hắc Phù", "Results names the playable Chapter 2 campaign unlock")
	_expect(String(feature_names.get("hunt_replay", "")) == "Thưởng săn lại boss Ải 10", "Results names the real Level 10 replay bounty without claiming a Hunt mode")
	_expect(
		String(stat_names.get("movement_speed_percent", "")) == "Tốc độ di chuyển"
			and String(stat_names.get("dash_cooldown_rate", "")) == "Hồi Lướt"
			and String(stat_names.get("guard_while_attacking", "")) == "Giảm sát thương khi tấn công",
		"Results localizes the live Boots and Armor affixes instead of exposing internal IDs",
	)


func _reset_fresh_profile() -> void:
	if _app_flow != null and _fake_root != null:
		if _app_flow.get("_app_root") == _fake_root:
			_app_flow.call(&"abort_to_home")
		_app_flow.call(&"detach_app_root", _fake_root)
	_remove_generations(TEST_SAVE_PATH)
	_expect(_save.configure_storage(TEST_SAVE_PATH, true), "Fresh isolated campaign-entitlement profile loads")
	_app_flow.call(&"attach_app_root", _fake_root)
	_expect(_save.is_transaction_applied(V2_RECEIPT), "Fresh attach records compatibility v2")
	_expect(_save.is_transaction_applied(V4_RECEIPT), "Fresh attach records compatibility v4")
	_expect(_save.is_transaction_applied(V6_RECEIPT), "Fresh attach records current v6")


func _count_inventory_id(section: String, key: String, expected: String) -> int:
	var count := 0
	for raw_entry: Variant in _save.get_value(["inventory", section], []):
		if raw_entry is Dictionary and String((raw_entry as Dictionary).get(key, "")) == expected:
			count += 1
	return count


func _write_snapshot(snapshot: Dictionary) -> bool:
	var file := FileAccess.open(TEST_SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(snapshot, "\t") + "\n")
	file.close()
	return true


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("CAMPAIGN ENTITLEMENT HARDENING FAIL: %s" % message)


func _finish() -> void:
	if _app_flow != null and _fake_root != null:
		_app_flow.call(&"detach_app_root", _fake_root)
	if _fake_root != null and is_instance_valid(_fake_root):
		_fake_root.queue_free()
	_remove_generations(TEST_SAVE_PATH)
	var report := {"ok": _failures.is_empty(), "checks": _checks, "failures": _failures}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	if _failures.is_empty():
		print("CAMPAIGN ENTITLEMENT HARDENING TEST PASSED - %d checks" % _checks)
	else:
		print("CAMPAIGN ENTITLEMENT HARDENING TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(0 if _failures.is_empty() else 1)
