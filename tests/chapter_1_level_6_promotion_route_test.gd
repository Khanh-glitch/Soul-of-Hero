extends SceneTree

## Release gate for the first real two-Hero campaign route.
##
## This intentionally uses the SaveService and AppFlow autoloads instead of a
## fake snapshot: Levels 1-5 must be cleared in order on a brand-new isolated
## profile, Level 5 completion must grant no Hero automatically, the separate
## physical-pickup transaction must grant one base Archer Soul, and Level 6
## must then start with Archer only after the player's explicit Equip action.

const TEST_SAVE_PATH := "user://tests/chapter_1_level_6_promotion_route_test.json"
const REPORT_PATH := "res://.artifacts/chapter_1_level_6_promotion_route_report.json"
const CAMPAIGN_REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const ARCHER_PICKUP_REWARD: RewardBundleDefinition = preload("res://data/content/rewards/chapter_1_level_5_archer_soul_pickup.tres")
const ARCHER_PICKUP_KEY := "campaign:chapter_1_level_5:archer_soul_pickup:v1"

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
	_expect(save_service.configure_storage(TEST_SAVE_PATH, true), "fresh isolated Level 1-6 route profile loads")
	var fake_root := FakeAppRoot.new()
	root.add_child(fake_root)
	app_flow.call(&"attach_app_root", fake_root)

	_test_sequential_first_clears(save_service, app_flow, fake_root)
	_finish(app_flow, fake_root)


func _test_sequential_first_clears(
		save_service: LivingArsenalSaveService,
		app_flow: Node,
		fake_root: FakeAppRoot
) -> void:
	var level_six := CAMPAIGN_REGISTRY.find_campaign_level(6)
	_expect(level_six != null and level_six.is_campaign_ready(), "Level 6 is registered CAMPAIGN_READY")
	_expect(_archer_souls(save_service).is_empty(), "fresh profile owns no Archer Hero Soul")

	for campaign_slot: int in range(1, 6):
		var level := CAMPAIGN_REGISTRY.find_campaign_level(campaign_slot)
		_expect(level != null and level.is_campaign_ready(), "campaign slot %d is ready on the sequential route" % campaign_slot)
		if level == null:
			continue
		_expect(
			bool(app_flow.call(&"is_campaign_level_unlocked", level.level_id)),
			"campaign slot %d is unlocked only when reached in sequence" % campaign_slot
		)
		_expect(
			bool(app_flow.call(&"start_campaign_level", level.level_id)),
			"campaign slot %d starts through AppFlow" % campaign_slot
		)
		app_flow.call(&"complete_active_run", {"route_gate": true, "campaign_slot": campaign_slot}, true)
		var result: Dictionary = app_flow.call(&"get_last_result")
		var continuation := result.get("continuation", {}) as Dictionary
		_expect(
			fake_root.route_id == &"gameplay" and bool(continuation.get("can_continue", false)),
			"campaign slot %d commits in-place and exposes the next-level choice" % campaign_slot,
		)
		var reward: Dictionary = result.get("reward", {})
		_expect(bool(reward.get("granted", false)), "campaign slot %d grants its first-clear bundle" % campaign_slot)
		_expect(
			bool(app_flow.call(&"is_campaign_level_completed", level.level_id)),
			"campaign slot %d completion persists" % campaign_slot
		)

	_expect(_archer_souls(save_service).is_empty(), "Level 5 completion alone owns no Archer Hero Soul")
	_expect(
		not bool(save_service.get_value(["progression", "unlocked_heroes", "archer_hero"], false)),
		"Level 5 completion alone records no Archer ownership"
	)
	_expect(
		not bool(save_service.get_value(["progression", "features", "soul_hero"], false))
			and not bool(save_service.get_value(["progression", "features", "soul_relay"], false)),
		"Level 5 completion cannot stand in for physical Soul collection"
	)
	var reserves: Array = save_service.get_value(["soul_team", "reserve_souls"], [])
	_expect(reserves == ["", ""], "Level 5 completion leaves both Reserve Soul slots untouched")
	_expect(
		save_service.transact_once(
			ARCHER_PICKUP_KEY,
			func(candidate: Dictionary) -> bool:
				return ARCHER_PICKUP_REWARD.apply_to_candidate(candidate),
			{"kind": "physical_hero_soul_pickup", "hero_id": "archer_hero"}
		),
		"physical pickup transaction grants Archer after the boss encounter"
	)
	_assert_archer_entitlement(save_service, "Level 5 physical pickup")
	_expect(save_service.get_value(["soul_team", "reserve_souls"], []) == ["", ""], "Pickup ownership still does not auto-equip Archer")
	var archer_reserve: Array[StringName] = [&"archer_hero"]
	_expect(save_service.set_soul_team(&"sword_hero", archer_reserve, "test:level_6_route:explicit_inventory_equip"), "player explicitly Equips Archer; activation is not tied to a new run")
	_expect(
		bool(app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_6")),
		"Level 5 completion unlocks Level 6"
	)
	_expect(
		bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_6")),
		"fresh sequential profile can start Level 6"
	)
	var level_six_run: Dictionary = app_flow.call(&"get_active_run")
	_expect(
		level_six_run.get("level_id") == &"chapter_1_level_6"
			and level_six_run.get("campaign_slot") == 6,
		"Level 6 run payload resolves the promoted campaign content"
	)
	var run_team: Dictionary = level_six_run.get("soul_team", {})
	_expect(
		(run_team.get("reserve_souls", []) as Array).has("archer_hero"),
		"Level 6 starts with the explicitly selected Archer in its Soul Team snapshot"
	)

	var revision_before_replay := int(save_service.get_value(["revision"], -1))
	_expect(bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_5")), "completed Level 5 remains replayable")
	app_flow.call(&"complete_active_run", {"route_gate_replay": 1}, true)
	var replay_reward: Dictionary = (app_flow.call(&"get_last_result") as Dictionary).get("reward", {})
	_expect(
		not bool(replay_reward.get("granted", true)) and bool(replay_reward.get("already_claimed", false)),
		"Level 5 replay reports its durable first-clear receipt"
	)
	_expect(
		int(save_service.get_value(["revision"], -1)) == revision_before_replay,
		"Level 5 replay creates no save revision"
	)
	_assert_archer_entitlement(save_service, "Level 5 replay")

	_expect(save_service.reload_save(), "sequential Level 1-5 profile reloads from disk")
	_assert_archer_entitlement(save_service, "profile reload")
	_expect(
		bool(save_service.get_value(["progression", "unlocked_heroes", "archer_hero"], false))
			and (save_service.get_value(["soul_team", "reserve_souls"], []) as Array).has("archer_hero"),
		"reload preserves Archer ownership and explicit team assignment"
	)
	_expect(
		bool(app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_6"))
			and bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_6")),
		"reload preserves the ability to start Level 6"
	)

	var revision_after_reload := int(save_service.get_value(["revision"], -1))
	_expect(bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_5")), "Level 5 can replay after reload")
	app_flow.call(&"complete_active_run", {"route_gate_replay": 2}, true)
	_expect(
		int(save_service.get_value(["revision"], -1)) == revision_after_reload,
		"post-reload Level 5 replay creates no save revision"
	)
	_assert_archer_entitlement(save_service, "post-reload Level 5 replay")


func _assert_archer_entitlement(save_service: LivingArsenalSaveService, context: String) -> void:
	var archers := _archer_souls(save_service)
	_expect(archers.size() == 1, "%s retains exactly one Archer Hero Soul" % context)
	if archers.size() != 1:
		return
	var soul: Dictionary = archers[0]
	_expect(int(soul.get("rarity", -1)) == HERO_SOUL_RULES.Rarity.NORMAL, "%s Archer Soul is base Normal rarity" % context)
	_expect(int(soul.get("item_level", 0)) == 1, "%s Archer Soul is authored at base Level 1" % context)
	_expect(
		String(soul.get("source_id", "")) == "chapter_1_level_5_archer_drop",
		"%s Archer Soul retains physical-drop provenance" % context
	)
	_expect(HERO_SOUL_RULES.validate_instance(soul).is_empty(), "%s Archer Soul validates against canonical rules" % context)

	var expected_id := ""
	if ARCHER_PICKUP_REWARD.hero_soul_grants.size() == 1:
		var expected_soul: Dictionary = ARCHER_PICKUP_REWARD.hero_soul_grants[0].call(&"create_soul_instance")
		expected_id = String(expected_soul.get("instance_id", ""))
	_expect(not expected_id.is_empty() and String(soul.get("instance_id", "")) == expected_id, "%s Archer Soul keeps its deterministic instance ID" % context)


func _archer_souls(save_service: LivingArsenalSaveService) -> Array[Dictionary]:
	var found: Array[Dictionary] = []
	var raw_souls: Variant = save_service.get_value(["inventory", "hero_souls"], [])
	if not raw_souls is Array:
		return found
	for value: Variant in raw_souls:
		if value is Dictionary and String((value as Dictionary).get("hero_id", "")) == "archer_hero":
			found.append((value as Dictionary).duplicate(true))
	return found


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
		print("CHAPTER 1 LEVEL 6 PROMOTION ROUTE PASSED - %d checks" % _checks)
	else:
		print("CHAPTER 1 LEVEL 6 PROMOTION ROUTE FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	quit(exit_code)
