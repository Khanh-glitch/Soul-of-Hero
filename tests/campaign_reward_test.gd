extends SceneTree

const TEST_SAVE_PATH := "user://tests/campaign_reward_test.json"
const REPORT_PATH := "res://.artifacts/campaign_reward_report.json"
const CAMPAIGN_REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const REWARD_REGISTRY: RewardBundleRegistry = preload("res://data/content/rewards/campaign_reward_registry.tres")
const AUXILIARY_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const AUXILIARY_DEFINITIONS := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")

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
	var save_service := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	var app_flow := root.get_node_or_null("AppFlow")
	_expect(save_service != null, "SaveService autoload exists")
	_expect(app_flow != null, "AppFlow autoload exists")
	if save_service == null or app_flow == null:
		_finish(null, null)
		return

	_remove_generations(TEST_SAVE_PATH)
	_expect(save_service.configure_storage(TEST_SAVE_PATH, true), "isolated campaign reward profile loads")
	var fake_root := FakeAppRoot.new()
	root.add_child(fake_root)
	app_flow.call(&"attach_app_root", fake_root)

	_test_catalog_contract()
	_test_guaranteed_auxiliary_contracts()
	_test_first_clear_and_replay(save_service, app_flow, fake_root)
	_test_training_is_rewardless(save_service, app_flow)
	_finish(app_flow, fake_root)


func _test_catalog_contract() -> void:
	var errors := REWARD_REGISTRY.get_validation_errors()
	_expect(errors.is_empty(), "campaign reward registry validates: %s" % "; ".join(errors))
	var ready_levels := CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false)
	var chapter_one_levels: Array[LevelDefinition] = []
	for level: LevelDefinition in ready_levels:
		if level.chapter_number == 1:
			chapter_one_levels.append(level)
	_expect(chapter_one_levels.size() == 10, "all ten internally playable Chapter 1 campaign levels are available for reward coverage")
	for level: LevelDefinition in ready_levels:
		var bundle := REWARD_REGISTRY.find_bundle(level.completion_reward_bundle_id)
		_expect(bundle != null, "level '%s' resolves reward bundle '%s'" % [level.level_id, level.completion_reward_bundle_id])

	var empty_bundle := RewardBundleDefinition.new()
	empty_bundle.bundle_id = &"empty_test_reward"
	_expect(_has_error(empty_bundle.get_validation_errors(), "at least one"), "empty reward bundles are rejected")
	var duplicate_bundle := RewardBundleDefinition.new()
	duplicate_bundle.bundle_id = &"duplicate_test_reward"
	var item_one := RewardItemStack.new()
	item_one.item_id = &"test_shard"
	var item_two := RewardItemStack.new()
	item_two.item_id = &"test_shard"
	duplicate_bundle.item_stacks = [item_one, item_two]
	_expect(_has_error(duplicate_bundle.get_validation_errors(), "duplicate item"), "duplicate item stacks are rejected")


func _test_guaranteed_auxiliary_contracts() -> void:
	var every_authored_affix_is_live := true
	var every_authored_contract_is_exact := true
	for bundle: RewardBundleDefinition in REWARD_REGISTRY.bundles:
		for grant: Resource in bundle.auxiliary_equipment_grants:
			var slot_id := String(grant.get("slot_id"))
			var rarity_id := String(grant.get("rarity_id"))
			var allowed: PackedStringArray = grant.get("allowed_affix_ids")
			var live := AUXILIARY_DEFINITIONS.live_affix_ids(slot_id)
			every_authored_contract_is_exact = every_authored_contract_is_exact \
				and allowed.size() == AUXILIARY_DEFINITIONS.affix_count(rarity_id) \
				and (grant.call(&"get_validation_errors") as PackedStringArray).is_empty()
			for affix_id: String in allowed:
				every_authored_affix_is_live = every_authored_affix_is_live \
					and affix_id in live
	_expect(every_authored_contract_is_exact, "every guaranteed auxiliary reward authors its exact rarity affix count")
	_expect(every_authored_affix_is_live, "every guaranteed auxiliary reward affix has a LIVE runtime consumer")

	var level_three := REWARD_REGISTRY.find_bundle(&"chapter_1_level_3_reward")
	var level_three_grant: Resource = level_three.auxiliary_equipment_grants[0]
	var level_three_item: Dictionary = level_three_grant.call(&"create_item_instance")
	_expect(
		String(level_three_item.get("uuid", "")) == "43986abd-1311-8633-c8ff-90139b2d74a2"
			and String(level_three_item.get("slot", "")) == "soul_boots"
			and String(level_three_item.get("rarity", "")) == "magic"
			and _sorted_auxiliary_affix_ids(level_three_item) == PackedStringArray(["movement_speed_percent"]),
		"Level 3 keeps its entitlement identity and grants Magic Boots with one LIVE movement affix",
	)
	var level_six := REWARD_REGISTRY.find_bundle(&"chapter_1_level_6_reward")
	var level_six_grant: Resource = level_six.auxiliary_equipment_grants[0]
	var level_six_item: Dictionary = level_six_grant.call(&"create_item_instance")
	_expect(
		String(level_six_item.get("uuid", "")) == "516d1291-7d9a-ab52-7784-10b69b55b2b0"
			and String(level_six_item.get("slot", "")) == "soul_trace"
			and String(level_six_item.get("rarity", "")) == "magic"
			and _sorted_auxiliary_affix_ids(level_six_item) == PackedStringArray(["cooldown_rate"]),
		"Level 6 keeps its entitlement identity and grants Magic Jewelry with one LIVE cooldown affix",
	)

	# Simulate the pre-taxonomy Level 3 entitlement under the same UUID. Content
	# v6 must replace its authored fields, move the equipped reference from the
	# old Jewelry slot to Boots, and preserve progression paid into that UUID.
	var legacy_level_three := level_three_item.duplicate(true)
	legacy_level_three["slot"] = "soul_trace"
	legacy_level_three["primary"] = {"stat_id": "damage_flat", "unit": "flat", "value": 2.0}
	legacy_level_three["affixes"] = [{"affix_id": "damage_percent", "unit": "percent", "value": 4.0}]
	legacy_level_three["upgrade_rank"] = 2
	var taxonomy_candidate := {
		"inventory": {"auxiliary_equipment": [legacy_level_three]},
		"auxiliary_loadout": {
			"soul_vessel": "",
			"soul_boots": "",
			"soul_trace": String(legacy_level_three.get("uuid", "")),
		},
		"progression": {"player": {"level": 4}},
	}
	_expect(level_three.reconcile_unique_grants_to_candidate(taxonomy_candidate), "v6 can reconcile the old Level 3 slot recipe by stable UUID")
	var taxonomy_items: Array = (taxonomy_candidate.get("inventory", {}) as Dictionary).get("auxiliary_equipment", [])
	var reconciled_boots: Dictionary = taxonomy_items[0] if taxonomy_items.size() == 1 else {}
	var taxonomy_loadout := taxonomy_candidate.get("auxiliary_loadout", {}) as Dictionary
	_expect(
		String(reconciled_boots.get("uuid", "")) == "43986abd-1311-8633-c8ff-90139b2d74a2"
			and String(reconciled_boots.get("slot", "")) == "soul_boots"
			and _sorted_auxiliary_affix_ids(reconciled_boots) == PackedStringArray(["movement_speed_percent"])
			and int(reconciled_boots.get("upgrade_rank", -1)) == 2
			and String(taxonomy_loadout.get("soul_trace", "")).is_empty()
			and String(taxonomy_loadout.get("soul_boots", "")) == String(reconciled_boots.get("uuid", "")),
		"v6 changes old Level 3 Jewelry into equipped Boots without duplicating or erasing upgrades",
	)

	var level_eight := REWARD_REGISTRY.find_bundle(&"chapter_1_level_8_reward")
	var level_eight_grant: Resource = level_eight.auxiliary_equipment_grants[0]
	var level_eight_item: Dictionary = level_eight_grant.call(&"create_item_instance")
	_expect(
		String(level_eight_item.get("uuid", "")) == "5444fa20-0680-b49a-dbb5-4a553e46a8b1"
			and String(level_eight_item.get("slot", "")) == "soul_vessel"
			and String(level_eight_item.get("rarity", "")) == "epic"
			and _sorted_auxiliary_affix_ids(level_eight_item) == PackedStringArray([
				"barrier_capacity_percent", "health_regen", "max_hp_percent",
			]),
		"Level 8 keeps its entitlement identity but now grants an Epic Vessel with three LIVE affixes",
	)
	_expect(
		level_eight_item == level_eight_grant.call(&"create_item_instance"),
		"guaranteed auxiliary generation remains deterministic",
	)

	var invalid_affix_grant := _reward_contract_fixture(
		"soul_trace",
		"magic",
		PackedStringArray(["critical_chance"]),
		"11111111-2222-3333-4444-555555555555",
	)
	_expect(
		_has_error(invalid_affix_grant.get_validation_errors(), "not valid")
			and invalid_affix_grant.create_item_instance().is_empty(),
		"a guaranteed reward cannot grant an affix outside its canonical slot pool",
	)
	var duplicate_affix_grant := _reward_contract_fixture(
		"soul_vessel",
		"rare",
		PackedStringArray(["max_hp_percent", "max_hp_percent"]),
		"22222222-3333-4444-5555-666666666666",
	)
	_expect(
		_has_error(duplicate_affix_grant.get_validation_errors(), "duplicate affix")
			and duplicate_affix_grant.create_item_instance().is_empty(),
		"a guaranteed reward affix contract rejects duplicates",
	)
	var incomplete_affix_grant := _reward_contract_fixture(
		"soul_vessel",
		"epic",
		PackedStringArray(["max_hp_percent"]),
		"33333333-4444-5555-6666-777777777777",
	)
	_expect(
		_has_error(incomplete_affix_grant.get_validation_errors(), "exactly 3")
			and incomplete_affix_grant.create_item_instance().is_empty(),
		"a guaranteed reward must author the exact affix count promised by rarity",
	)

	var identity_a := _reward_contract_fixture(
		"soul_vessel", "magic", PackedStringArray(["max_hp_percent"]),
		"44444444-5555-6666-7777-888888888888",
	)
	var identity_b := _reward_contract_fixture(
		"soul_vessel", "magic", PackedStringArray(["barrier_capacity_percent"]),
		"44444444-5555-6666-7777-888888888888",
	)
	identity_b.seed = identity_a.seed + 99
	_expect(
		String(identity_a.create_item_instance().get("uuid", "")) \
			== String(identity_b.create_item_instance().get("uuid", "")),
		"guaranteed entitlement UUID is independent from tuning seed and affix recipe",
	)

	# Reconcile a profile that already owns the old inert L8 Trace. The stable
	# entitlement is updated in place, keeps player protection, and moves its
	# equipped reference only when the destination slot is available.
	var legacy_level_eight := AUXILIARY_RULES.generate_item(
		&"soul_trace", &"epic", 8, 18008, &"chapter_1_level_8_first_clear",
	)
	legacy_level_eight["favorite"] = true
	legacy_level_eight["locked"] = true
	legacy_level_eight["upgrade_rank"] = 3
	var legacy_uuid := String(legacy_level_eight.get("uuid", ""))
	var candidate := {
		"inventory": {"auxiliary_equipment": [legacy_level_eight]},
		"auxiliary_loadout": {
			"soul_vessel": "",
			"soul_boots": "",
			"soul_trace": legacy_uuid,
		},
		"progression": {"player": {"level": 8}},
	}
	_expect(
		legacy_uuid == "5444fa20-0680-b49a-dbb5-4a553e46a8b1"
			and level_eight.reconcile_unique_grants_to_candidate(candidate),
		"reward reconciliation recognizes the old Level 8 entitlement UUID",
	)
	var reconciled_items: Array = (candidate.get("inventory", {}) as Dictionary).get(
		"auxiliary_equipment", [],
	)
	var reconciled: Dictionary = reconciled_items[0] if not reconciled_items.is_empty() else {}
	var reconciled_loadout := candidate.get("auxiliary_loadout", {}) as Dictionary
	_expect(
		String(reconciled.get("uuid", "")) == legacy_uuid
			and String(reconciled.get("slot", "")) == "soul_vessel"
			and bool(reconciled.get("favorite", false))
			and bool(reconciled.get("locked", false))
			and int(reconciled.get("upgrade_rank", -1)) == 3
			and String(reconciled_loadout.get("soul_trace", "")).is_empty()
			and String(reconciled_loadout.get("soul_vessel", "")) == legacy_uuid,
		"reconciliation updates the reward in place and preserves upgrade/protection/equip intent",
	)


func _reward_contract_fixture(
		slot_id: String,
		rarity_id: String,
		affix_ids: PackedStringArray,
		stable_instance_id: String,
) -> RewardAuxiliaryEquipmentGrant:
	var grant := RewardAuxiliaryEquipmentGrant.new()
	grant.grant_id = &"test_guaranteed_auxiliary"
	grant.source_id = &"test_guaranteed_auxiliary_source"
	grant.stable_instance_id = stable_instance_id
	grant.slot_id = slot_id
	grant.rarity_id = rarity_id
	grant.item_level = 8
	grant.seed = 78008
	grant.allowed_affix_ids = affix_ids
	return grant


func _sorted_auxiliary_affix_ids(item: Dictionary) -> PackedStringArray:
	var result := PackedStringArray()
	for raw_affix: Variant in item.get("affixes", []):
		if raw_affix is Dictionary:
			result.append(String((raw_affix as Dictionary).get("affix_id", "")))
	result.sort()
	return result


func _test_first_clear_and_replay(
		save_service: LivingArsenalSaveService,
		app_flow: Node,
		fake_root: FakeAppRoot
) -> void:
	var default_stacks: Variant = save_service.get_value(["inventory", "item_stacks"], null)
	_expect(default_stacks is Dictionary and (default_stacks as Dictionary).is_empty(), "new profiles expose an empty stackable inventory")
	var revision_before := int(save_service.get_value(["revision"], -1))
	_expect(bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_1")), "Level 1 starts on a fresh profile")
	app_flow.call(&"complete_active_run", {"score": 100, "sigils": 3}, true)
	_expect(fake_root.route_id == &"gameplay", "first clear stays in gameplay for the continuation chooser")
	var first_result: Dictionary = app_flow.call(&"get_last_result")
	var first_reward: Dictionary = first_result.get("reward", {})
	_expect(bool(first_reward.get("granted", false)), "first clear grants its reward bundle")
	_expect(not bool(first_reward.get("already_claimed", true)), "first clear is not marked as already claimed")
	_expect(first_reward.get("grant_rule") == "first_clear", "result publishes the first-clear grant rule")
	_expect(first_reward.get("bundle_id") == "chapter_1_level_1_reward", "result publishes the authored reward bundle ID")
	_expect(first_reward.get("transaction_id") == "campaign:chapter_1_level_1:complete", "result publishes the durable completion receipt")
	_expect(save_service.get_value(["currencies", "account"], 0) == 120, "Level 1 grants account currency")
	_expect(save_service.get_value(["currencies", "hero_materials"], 0) == 2, "Level 1 grants Hero materials")
	var bone_stack: Dictionary = save_service.get_value(["inventory", "item_stacks", "crypt_bone_shard"], {})
	_expect(bone_stack == {"kind": "material", "quantity": 2}, "Level 1 grants a typed inventory item stack")
	_expect(bool(app_flow.call(&"is_campaign_level_completed", &"chapter_1_level_1")), "completion persists with the reward")
	_expect(bool(app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_2")), "the same transaction unlocks Level 2")
	_expect(int(save_service.get_value(["revision"], -1)) == revision_before + 1, "completion, unlock and reward use one save revision")
	var receipt: Dictionary = save_service.get_value(["applied_transactions", "campaign:chapter_1_level_1:complete"], {})
	var metadata: Dictionary = receipt.get("metadata", {})
	_expect(metadata.get("reward_bundle_id") == "chapter_1_level_1_reward", "receipt records its reward bundle provenance")

	var account_before_replay := int(save_service.get_value(["currencies", "account"], 0))
	var revision_before_replay := int(save_service.get_value(["revision"], -1))
	_expect(bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_1")), "completed Level 1 remains replayable")
	app_flow.call(&"complete_active_run", {"score": 999}, true)
	var replay_result: Dictionary = app_flow.call(&"get_last_result")
	var replay_reward: Dictionary = replay_result.get("reward", {})
	_expect(not bool(replay_reward.get("granted", true)), "replay does not grant the first-clear bundle again")
	_expect(bool(replay_reward.get("already_claimed", false)), "replay explains that the reward receipt already exists")
	_expect(save_service.get_value(["currencies", "account"], 0) == account_before_replay, "replay cannot duplicate currency")
	_expect(save_service.get_value(["inventory", "item_stacks", "crypt_bone_shard", "quantity"], 0) == 2, "replay cannot duplicate inventory")
	_expect(int(save_service.get_value(["revision"], -1)) == revision_before_replay, "duplicate reward creates no save revision")

	_expect(bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_2")), "first clear unlock makes Level 2 playable")
	app_flow.call(&"complete_active_run", {"score": 200}, true)
	var level_two_reward: Dictionary = (app_flow.call(&"get_last_result") as Dictionary).get("reward", {})
	_expect(bool(level_two_reward.get("granted", false)), "Level 2 grants its own first-clear bundle")
	_expect(save_service.get_value(["currencies", "account"], 0) == 280, "currency rewards accumulate across distinct clears")
	_expect(save_service.get_value(["currencies", "hero_materials"], 0) == 5, "material currency accumulates across distinct clears")
	_expect(save_service.get_value(["inventory", "item_stacks", "crypt_bone_shard", "quantity"], 0) == 5, "same-kind item stacks accumulate across bundles")
	_expect(save_service.reload_save(), "rewarded profile reloads from disk")
	_expect(save_service.get_value(["inventory", "item_stacks", "crypt_bone_shard", "quantity"], 0) == 5, "item stack remains durable after reload")


func _test_training_is_rewardless(save_service: LivingArsenalSaveService, app_flow: Node) -> void:
	var account_before := int(save_service.get_value(["currencies", "account"], 0))
	var revision_before := int(save_service.get_value(["revision"], -1))
	app_flow.call(&"start_training")
	app_flow.call(&"complete_active_run", {"score": 500}, true)
	var training_result: Dictionary = app_flow.call(&"get_last_result")
	_expect(not training_result.has("reward"), "Training publishes no campaign reward")
	_expect(save_service.get_value(["currencies", "account"], 0) == account_before, "Training cannot change campaign currency")
	_expect(int(save_service.get_value(["revision"], -1)) == revision_before, "Training completion creates no progression revision")


func _has_error(errors: PackedStringArray, fragment: String) -> bool:
	for error: String in errors:
		if fragment.to_lower() in error.to_lower():
			return true
	return false


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
	push_error(message)


func _finish(app_flow: Node, fake_root: FakeAppRoot) -> void:
	if app_flow != null and fake_root != null:
		app_flow.call(&"detach_app_root", fake_root)
		fake_root.queue_free()
	_remove_generations(TEST_SAVE_PATH)
	var report := {"ok": _failures.is_empty(), "checks": _checks, "failures": _failures}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	if _failures.is_empty():
		print("CAMPAIGN REWARD TEST PASSED - %d checks" % _checks)
	else:
		print("CAMPAIGN REWARD TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	quit(exit_code)
