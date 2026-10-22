extends SceneTree

const TEST_SAVE_PATH := "user://tests/inventory_drop_contract_test.json"
const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const AUXILIARY_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const LOOT_CATALOG := preload("res://game/loot/loot_catalog.gd")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var save := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_expect(save != null, "SaveService autoload is available")
	if save == null:
		_finish()
		return
	_remove_generations(TEST_SAVE_PATH)
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "isolated drop profile loads")

	_expect(save.grant_inventory_item(&"soul_ember", &"material", 49, "drop:embers:49"), "a 49-item material stack is valid")
	_expect(save.grant_inventory_item(&"soul_ember", &"material", 1, "drop:embers:50"), "the fiftieth item fills the stack")
	_expect(save.grant_inventory_item(&"soul_ember", &"material", 1, "drop:embers:overflow"), "the fifty-first item starts a second shared bag slot")
	var stack: Dictionary = save.get_value(["inventory", "item_stacks", "soul_ember"], {})
	_expect(int(stack.get("quantity", 0)) == 50, "the stored consumable stack is exactly fifty")
	var overflow_stack: Dictionary = save.get_value(["inventory", "item_stacks", "soul_ember_stack_2"], {})
	_expect(
		int(overflow_stack.get("quantity", 0)) == 1 and String(overflow_stack.get("item_id", "")) == "soul_ember",
		"overflow keeps the same item identity while occupying a second 50-cap slot",
	)
	var stack_payload := LOOT_CATALOG.build_inventory_drop_payload(&"stackable", stack, &"soul_ember")
	_expect(
		bool(stack_payload.get("requires_explicit_pickup", false))
			and bool(stack_payload.get("dropped_by_player", false))
			and int(stack_payload.get("quantity", 0)) == 50,
		"player-dropped stack uses the explicit-pickup physical-loot contract",
	)
	_expect(save.drop_inventory_item(&"soul_ember", 50, "drop:embers:remove"), "dropping a full stack removes exactly that stack")
	_expect(
		(save.get_value(["inventory", "item_stacks"], {}) as Dictionary).size() == 1,
		"dropping one stack frees only its own shared bag slot",
	)
	_expect(save.drop_inventory_item(&"soul_ember_stack_2", 1, "drop:embers:remove_overflow"), "the overflow stack can be dropped independently")
	_expect((save.get_value(["inventory", "item_stacks"], {}) as Dictionary).is_empty(), "all dropped stacks free their shared bag slots")

	var soul := HERO_SOUL_RULES.create_instance(&"wizard_hero", HERO_SOUL_RULES.Rarity.RARE, 20, &"drop_test", 73001)
	_expect(save.grant_hero_soul(soul, "drop:wizard:grant"), "an unequipped Wizard Soul can enter the bag")
	var soul_payload := LOOT_CATALOG.build_inventory_drop_payload(&"hero_soul", soul)
	_expect(
		StringName(soul_payload.get("kind", &"")) == &"hero_soul"
			and bool(soul_payload.get("requires_explicit_pickup", false)),
		"Wizard Soul rebuilds as manual-only ground loot",
	)
	_expect(save.drop_hero_soul(String(soul.get("instance_id", "")), "drop:wizard:remove"), "an unequipped Soul can be dropped")
	var starter: Dictionary = (save.get_value(["inventory", "hero_souls"], []) as Array)[0]
	_expect(not save.drop_hero_soul(String(starter.get("instance_id", "")), "drop:starter:blocked"), "equipped/locked starter Soul cannot be dropped")

	var auxiliary := AUXILIARY_RULES.generate_item(&"soul_vessel", &"normal", 2, 73002, &"drop_test")
	_expect(save.grant_auxiliary_equipment(auxiliary, "drop:aux:grant"), "unequipped auxiliary gear can enter the bag")
	var auxiliary_payload := LOOT_CATALOG.build_inventory_drop_payload(&"auxiliary_equipment", auxiliary)
	_expect(
		StringName(auxiliary_payload.get("kind", &"")) == &"auxiliary_equipment"
			and bool(auxiliary_payload.get("dropped_by_player", false)),
		"auxiliary gear rebuilds as manual-only ground loot",
	)
	_expect(save.drop_auxiliary_equipment(String(auxiliary.get("uuid", "")), "drop:aux:remove"), "unequipped auxiliary gear can be dropped")
	_expect((save.get_value(["inventory", "auxiliary_equipment"], []) as Array).is_empty(), "dropped auxiliary gear frees its bag slot")
	_finish()


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak", ".pre_v3.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _finish() -> void:
	_remove_generations(TEST_SAVE_PATH)
	if _failures.is_empty():
		print("INVENTORY DROP CONTRACT TEST PASSED (%d checks)" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	print("INVENTORY DROP CONTRACT TEST FAILED (%d/%d checks)" % [_failures.size(), _checks])
	quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
