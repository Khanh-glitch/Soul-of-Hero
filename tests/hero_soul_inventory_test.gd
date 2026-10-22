extends SceneTree

const TEST_SAVE_PATH := "user://tests/hero_soul_inventory_test.json"
const SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")

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
	_expect(save_service.configure_storage(TEST_SAVE_PATH, true), "isolated Hero Soul inventory loads")
	var starter_souls: Array = save_service.get_value(["inventory", "hero_souls"], [])
	_expect(starter_souls.size() == 1, "new profile owns exactly one starter Hero Soul")
	var starter: Dictionary = starter_souls[0]
	_expect(starter["hero_id"] == "sword_hero" and int(starter["rarity"]) == SOUL_RULES.Rarity.COMMON, "starter item is a Common Sword Hero Soul")
	_expect(bool(starter["equipped"]) and bool(starter["locked"]), "starter Soul is protected from accidental sale or fusion")

	var free_inputs: Array[Dictionary] = []
	for seed: int in [61001, 61002, 61003]:
		var soul: Dictionary = SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.COMMON, 5, &"test_drop", seed)
		free_inputs.append(soul)
		_expect(save_service.grant_hero_soul(soul, "test:soul_grant:%d" % seed), "a dropped Hero Soul commits once")
		_expect(not save_service.grant_hero_soul(soul, "test:soul_grant:%d" % seed), "a dropped Hero Soul receipt cannot pay twice")
	_expect((save_service.get_value(["inventory", "hero_souls"], []) as Array).size() == 4, "three duplicates coexist with the starter")
	_expect(save_service.transact_once(
		"test:fusion_gold",
		func(candidate: Dictionary) -> bool:
			candidate["currencies"]["account"] = 1000
			candidate["progression"]["features"]["hero_soul_sell"] = true
			candidate["progression"]["features"]["hero_soul_fusion"] = true
			return true
	), "test profile explicitly receives fusion/sell features and fusion Gold")
	var input_ids: Array[String] = []
	for soul: Dictionary in free_inputs:
		input_ids.append(String(soul["instance_id"]))
	var expected_cost := SOUL_RULES.fusion_cost(SOUL_RULES.Rarity.COMMON, 5)
	_expect(save_service.fuse_hero_souls(input_ids, 62001, "test:fusion"), "three matching Souls fuse atomically")
	_expect(not save_service.fuse_hero_souls(input_ids, 62001, "test:fusion"), "fusion receipt is idempotent")
	var after_fusion: Array = save_service.get_value(["inventory", "hero_souls"], [])
	_expect(after_fusion.size() == 2, "fusion consumes three items and creates one")
	_expect(save_service.get_value(["currencies", "account"], 0) == 1000 - expected_cost, "fusion debits the shared account-gold formula")
	var fused: Dictionary = {}
	for soul_value: Variant in after_fusion:
		if soul_value is Dictionary and not bool((soul_value as Dictionary).get("equipped", false)):
			fused = soul_value
	_expect(int(fused.get("rarity", -1)) == SOUL_RULES.Rarity.MAGIC, "fusion output is guaranteed Magic")
	var sale_value := SOUL_RULES.sell_value(fused)
	_expect(save_service.sell_hero_soul(String(fused["instance_id"]), "test:sale"), "unprotected duplicate can be sold")
	_expect((save_service.get_value(["inventory", "hero_souls"], []) as Array).size() == 1, "sale removes only the selected duplicate")
	_expect(save_service.get_value(["currencies", "account"], 0) == 1000 - expected_cost + sale_value, "sale credits deterministic account gold")
	_expect(not save_service.sell_hero_soul(String(starter["instance_id"]), "test:sell_starter"), "protected starter cannot be sold")
	_expect(save_service.reload_save(), "Hero Soul inventory survives disk reload")
	_expect((save_service.get_value(["inventory", "hero_souls"], []) as Array).size() == 1, "reloaded profile preserves the starter and prior transactions")
	_finish()


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _finish() -> void:
	_remove_generations(TEST_SAVE_PATH)
	if _failures.is_empty():
		print("HERO SOUL INVENTORY TEST PASSED - %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("HERO SOUL INVENTORY TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
	else:
		_failures.append(message)
