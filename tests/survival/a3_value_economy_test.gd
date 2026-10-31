extends Node
## R13-A3-VALUE: A3 economy owner-consumable tests.
##
## Tests the vertically coherent economic chain:
##   roadside salvage → inventory → paid station → research → future choice
##
## All mutations go through SaveService.transact_once (A0 single authority).
## Source contracts are fail-closed: unauthenticated sources yield nothing.
## Research is atomic and durable: spend + learn commit in one transaction.
## Paid production defers output grant to claim time (no false grants at prepare).

const TEST_SAVE_PATH := "user://tests/a3_value_economy_test.json"
const SaveServiceClass = preload("res://game/autoload/save_service.gd")
const A3EconomyServiceClass = preload("res://game/survival/economy/a3_economy_service.gd")
const RoadsideSourceContract = preload("res://game/survival/economy/roadside_source.gd")
const QuarrySourceContract = preload("res://game/survival/economy/quarry_source.gd")
const STACK_ITEM_CATALOG: StackItemCatalog = preload("res://data/content/items/item_catalog.tres")

var _checks := 0
var _failures: Array[String] = []
var save: Node
var eco: A3EconomyService

func _ready() -> void:
	_run.call_deferred()

func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if condition:
		print("  ok    " + label)
	else:
		_failures.append(label)
		print("  FAIL  " + label)

func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak", ".pre_v3.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))

func _get_or_create_save() -> Node:
	var save_node := get_tree().root.get_node_or_null("SaveService")
	if save_node == null:
		save_node = SaveServiceClass.new()
		save_node.name = "SaveService"
		get_tree().root.add_child(save_node)
	return save_node

func _fresh_save() -> void:
	_remove_generations(TEST_SAVE_PATH)
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "isolated save profile loads")
	eco.clear_learned_recipes()
	eco.clear_discoveries()
	eco._clear_inventory_for_test("test:fresh:clear")
	## Re-initialize run-local state from SaveService after fresh save
	eco._ensure_run_id()

func _grant_tool(tool_id: String, condition: int) -> bool:
	var key := "test:grant:tool:%s:%d" % [tool_id, Time.get_ticks_usec()]
	return eco._grant_tool_with_condition_for_test(tool_id, condition, key)

func _run() -> void:
	_remove_generations(TEST_SAVE_PATH)

	var save_node := _get_or_create_save()
	save = save_node
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "isolated save profile loads")

	eco = A3EconomyServiceClass.new()
	_expect(eco.configure(save), "A3 economy service configured")

	## --- Group 1: Item catalog has all R13 items ---
	_test_item_catalog()

	## --- Group 2: Roadside source contract (A1) ---
	_test_roadside_source_contract()

	## --- Group 3: Quarry source contract (A8) ---
	_test_quarry_source_contract()

	## --- Group 4: Fail-closed for unauthenticated sources ---
	_test_fail_closed_sources()

	## --- Group 5: Roadside salvage harvest yields materials ---
	_test_roadside_salvage_harvest()

	## --- Group 6: Quarry harvest yields samples and core fragments ---
	_test_quarry_harvest()

	## --- Group 7: Tool wear and insufficient durability ---
	_test_tool_wear_and_durability()

	## --- Group 8: Full inventory rejection ---
	_test_full_inventory_rejection()

	## --- Group 9: Repeated harvest and source exhaustion ---
	_test_repeated_harvest_exhaustion()

	## --- Group 10: Duplicate receipt / idempotency ---
	_test_duplicate_receipt_idempotency()

	## --- Group 11: Tri-knowledge research ---
	_test_bounded_random_research()
	_test_directed_research()
	_test_destructive_specimen_reverse_engineering()
	_test_already_known_recipe()

	## --- Group 12: Paid station preparation (deferred outputs) ---
	_test_paid_station_preparation()
	_test_insufficient_fuel()
	_test_insufficient_materials_for_station()
	_test_cancel_station_job()

	## --- Group 13: Reverse-use lookup ---
	_test_reverse_use_lookup()

	## --- Group 14: Two legitimate strategies ---
	_test_home_first_strategy()
	_test_prepared_quarry_exploration_strategy()

	## --- Group 15: Run reset and persistence anti-duplication ---
	_test_run_reset()
	_test_persistence_anti_duplication()

	_finish()

## --- Item catalog ---

func _test_item_catalog() -> void:
	var expected_ids := [
		"roadside_oak_scrap", "roadside_stone_chip", "roadside_iron_scrap",
		"knowledge_spare", "quarry_sample", "quarry_core_fragment",
		"salvage_kit_blueprint",
	]
	for item_id: String in expected_ids:
		var def := STACK_ITEM_CATALOG.find(item_id)
		_expect(def != null, "catalog contains item %s" % item_id)
		if def != null:
			_expect(def.item_id == item_id, "item %s definition id matches" % item_id)
			_expect(not def.display_name.is_empty(), "item %s has display name" % item_id)
			_expect(def.icon != null, "item %s has icon" % item_id)

## --- Source contracts ---

func _test_roadside_source_contract() -> void:
	_expect(RoadsideSourceContract.is_roadside_source("roadside_oak_1"), "roadside_oak_1 is a roadside source")
	_expect(RoadsideSourceContract.is_roadside_source("roadside_stone_1"), "roadside_stone_1 is a roadside source")
	_expect(RoadsideSourceContract.is_roadside_source("roadside_iron_1"), "roadside_iron_1 is a roadside source")
	_expect(not RoadsideSourceContract.is_roadside_source("quarry_deep_1"), "quarry_deep_1 is not a roadside source")
	_expect(not RoadsideSourceContract.is_roadside_source("fake_source"), "fake_source is not a roadside source")

	var contract := RoadsideSourceContract.get_contract("roadside_oak_1")
	_expect(not contract.is_empty(), "roadside_oak_1 has a contract")
	_expect(int(contract.get("max_yields", 0)) == 3, "roadside_oak_1 max_yields is 3 (finite)")
	_expect(String(contract.get("owner", "")) == "A1", "roadside_oak_1 owner is A1")
	_expect(String(contract.get("risk", "")) == "low", "roadside_oak_1 risk is low")

	contract = RoadsideSourceContract.get_contract("roadside_iron_1")
	_expect(int(contract.get("max_yields", 0)) == 2, "roadside_iron_1 max_yields is 2 (finite)")
	_expect(String(contract.get("tool_required", "")) == "iron_pick", "roadside_iron_1 requires iron_pick")

## --- Quarry source contract ---

func _test_quarry_source_contract() -> void:
	_expect(QuarrySourceContract.is_quarry_source("quarry_deep_1"), "quarry_deep_1 is a Quarry source")
	_expect(not QuarrySourceContract.is_quarry_source("roadside_oak_1"), "roadside_oak_1 is not a Quarry source")
	_expect(not QuarrySourceContract.is_quarry_source("fake_source"), "fake_source is not a Quarry source")

	var contract := QuarrySourceContract.get_contract("quarry_deep_1")
	_expect(not contract.is_empty(), "quarry_deep_1 has a contract")
	_expect(int(contract.get("max_yields", 0)) == 5, "quarry_deep_1 max_yields is 5 (finite)")
	_expect(String(contract.get("owner", "")) == "A8", "quarry_deep_1 owner is A8")
	_expect(String(contract.get("risk", "")) == "high", "quarry_deep_1 risk is high")
	_expect(String(contract.get("tool_required", "")) == "iron_pick", "quarry_deep_1 requires iron_pick")

## --- Fail-closed ---

func _test_fail_closed_sources() -> void:
	_fresh_save()

	## Authenticate roadside sources (A1 mount) through SaveService
	_expect(eco.authenticate_source("roadside_oak_1", "A1"), "A1 authenticates roadside_oak_1")
	_expect(eco.authenticate_source("roadside_stone_1", "A1"), "A1 authenticates roadside_stone_1")
	_expect(eco.authenticate_source("roadside_iron_1", "A1"), "A1 authenticates roadside_iron_1")

	## Authenticate Quarry source (A8 mount) through SaveService
	_expect(eco.authenticate_source("quarry_deep_1", "A8"), "A8 authenticates quarry_deep_1")

	_expect(eco.is_source_authenticated("roadside_oak_1"), "roadside_oak_1 authenticated after A1 mount")
	_expect(eco.is_source_authenticated("quarry_deep_1"), "quarry_deep_1 authenticated after A8 mount")
	_expect(not eco.is_source_authenticated("fake_source"), "fake_source is not authenticated (fail-closed)")
	_expect(not eco.is_source_authenticated("roadside_unknown_1"), "unknown roadside source is not authenticated (fail-closed)")
	_expect(not eco.is_source_authenticated("quarry_unknown_1"), "unknown Quarry source is not authenticated (fail-closed)")

	## Wrong owner domain should not authenticate
	_expect(not eco.authenticate_source("roadside_oak_1", "A8"), "A8 cannot authenticate A1 roadside source")
	_expect(not eco.authenticate_source("quarry_deep_1", "A1"), "A1 cannot authenticate A8 Quarry source")

	## Harvest from unauthenticated source fails closed
	var result := eco.harvest("fake_source", "stone_pick")
	_expect(not bool(result.get("ok", false)), "harvest from unauthenticated source fails closed")
	_expect(str(result.get("reason", "")) == "SOURCE_NOT_AUTHENTICATED", "unauthenticated source returns SOURCE_NOT_AUTHENTICATED")

	## Harvest from unknown source fails closed
	result = eco.harvest("unknown_source", "stone_pick")
	_expect(not bool(result.get("ok", false)), "harvest from unknown source fails closed")

## --- Roadside salvage harvest ---

func _test_roadside_salvage_harvest() -> void:
	_fresh_save()
	eco.authenticate_source("roadside_oak_1", "A1")
	_expect(_grant_tool("stone_pick", 100), "stone pick granted with full condition")

	var result := eco.harvest("roadside_oak_1", "stone_pick")
	_expect(bool(result.get("ok", false)), "roadside oak harvest succeeds")
	_expect(str(result.get("reason", "")) == "", "roadside oak harvest has no failure reason")
	_expect(bool(result.has("yield")), "harvest result includes yield")
	_expect(int(result.get("tool_condition_remaining", -1)) == 75, "stone pick wears 25 condition per use (100-25=75)")
	_expect(int(result.get("source_yields_remaining", -1)) == 2, "roadside oak has 2 yields remaining after first harvest (max 3)")

	var yield_items = result.get("yield", {}).get("items", {}) as Dictionary
	_expect(bool(yield_items.has("roadside_oak_scrap")), "roadside oak harvest yields oak scrap")
	_expect(int(yield_items.get("roadside_oak_scrap", 0)) >= 1, "roadside oak harvest yields at least 1 oak scrap")

	## Verify inventory was updated
	var oak_qty := eco._get_inventory_quantity("roadside_oak_scrap")
	_expect(oak_qty >= 1, "inventory contains harvested oak scrap (%d)" % oak_qty)

## --- Quarry harvest ---

func _test_quarry_harvest() -> void:
	_fresh_save()
	eco.authenticate_source("quarry_deep_1", "A8")
	_expect(_grant_tool("iron_pick", 200), "iron pick granted with full condition")

	var result := eco.harvest("quarry_deep_1", "iron_pick")
	_expect(bool(result.get("ok", false)), "Quarry deep harvest succeeds")
	_expect(bool(result.has("yield")), "Quarry harvest result includes yield")

	var yield_items = result.get("yield", {}).get("items", {}) as Dictionary
	_expect(bool(yield_items.has("quarry_sample")), "Quarry harvest yields quarry_sample")
	_expect(int(yield_items.get("quarry_sample", 0)) >= 2, "Quarry harvest yields at least 2 quarry_sample (base yield)")

	## Verify inventory
	var sample_qty := eco._get_inventory_quantity("quarry_sample")
	_expect(sample_qty >= 2, "inventory contains harvested quarry samples (%d)" % sample_qty)

	var remaining := int(result.get("source_yields_remaining", -1))
	_expect(remaining == 4, "Quarry has 4 yields remaining after first harvest (max 5)")

## --- Tool wear and durability ---

func _test_tool_wear_and_durability() -> void:
	_fresh_save()
	eco.authenticate_source("roadside_oak_1", "A1")
	_expect(_grant_tool("stone_pick", 25), "stone pick granted with 25 condition")

	## One harvest uses all remaining durability (25 wear per use)
	var result := eco.harvest("roadside_oak_1", "stone_pick")
	_expect(bool(result.get("ok", false)), "harvest with 25 condition succeeds (wear brings to 0)")
	_expect(int(result.get("tool_condition_remaining", -1)) == 0, "tool condition reaches 0 after harvest")

	## Tool is now broken; next harvest fails
	result = eco.harvest("roadside_oak_1", "stone_pick")
	_expect(not bool(result.get("ok", false)), "harvest with broken tool fails")
	_expect(str(result.get("reason", "")) == "TOOL_BROKEN", "broken tool returns TOOL_BROKEN")

	## Unknown tool fails
	result = eco.harvest("roadside_oak_1", "nonexistent_tool")
	_expect(not bool(result.get("ok", false)), "harvest with unknown tool fails")
	_expect(str(result.get("reason", "")) == "UNKNOWN_TOOL", "unknown tool returns UNKNOWN_TOOL")

## --- Full inventory ---

func _test_full_inventory_rejection() -> void:
	_fresh_save()
	eco.authenticate_source("roadside_oak_1", "A1")

	## Build 28 material stacks + 1 stone_pick tool = 29 stacks.
	## With 1 starter soul in hero_souls, total = 30 slots (full bag).
	var stacks := {}
	var catalog_items := [
		"crypt_bone_shard", "reaper_essence", "blood_crucible_blueprint",
		"venom_spine", "fractured_axe_insignia", "predator_jaw",
		"soul_ember", "hero_xp_stone_small", "hero_xp_stone_medium",
		"hero_xp_stone_large", "roadside_oak_scrap", "roadside_stone_chip",
		"roadside_iron_scrap", "knowledge_spare", "quarry_sample",
		"quarry_core_fragment", "salvage_kit_blueprint",
	]
	var i := 0
	while i < 28:
		var item_id := catalog_items[i % catalog_items.size()]
		var stack_key := item_id
		if i >= catalog_items.size():
			var suffix := (i // catalog_items.size()) + 1
			stack_key = "%s_stack_%d" % [item_id, suffix]
		stacks[stack_key] = {
			"item_id": item_id,
			"kind": "material",
			"quantity": 1,
		}
		i += 1
	## The 29th stack is the stone_pick tool with condition
	stacks["stone_pick"] = {
		"item_id": "stone_pick",
		"kind": "material",
		"quantity": 1,
		"condition": 100,
	}

	_expect(stacks.size() == 29, "29 stack entries prepared (28 materials + 1 tool)")
	_expect(_set_inventory_stacks_for_test(stacks, "test:fill:bag"), "29 stack entries set in inventory")

	## Verify bag is full (29 stacks + 1 starter soul = 30 slots)
	var snapshot := save.call("get_snapshot") as Dictionary
	var inventory = snapshot.get("inventory", {}) as Dictionary
	var item_stacks = inventory.get("item_stacks", {}) as Dictionary
	_expect(item_stacks.size() == 29, "bag has exactly 29 stacks (%d)" % item_stacks.size())

	## Try to harvest (should fail: inventory full - oak_scrap needs a new stack)
	result := eco.harvest("roadside_oak_1", "stone_pick")
	_expect(not bool(result.get("ok", false)), "harvest fails when inventory is full")
	_expect(str(result.get("reason", "")) == "INVENTORY_FULL", "full inventory returns INVENTORY_FULL")

	## Tool should NOT be worn when harvest is rejected for full inventory
	var condition_after := eco._get_tool_condition("stone_pick")
	_expect(condition_after == 100, "tool not worn when harvest is rejected (condition still 100)")

	## Verify no save change
	var snapshot2 := save.call("get_snapshot") as Dictionary
	var inventory2 = snapshot2.get("inventory", {}) as Dictionary
	var stacks2 = inventory2.get("item_stacks", {}) as Dictionary
	_expect(stacks2.has("stone_pick"), "stone pick still in inventory after rejected harvest")

## --- Repeated harvest and exhaustion ---

func _test_repeated_harvest_exhaustion() -> void:
	_fresh_save()
	eco.authenticate_source("roadside_oak_1", "A1")
	_expect(_grant_tool("stone_pick", 100), "stone pick granted for exhaustion test")

	## Harvest up to max_yields (3)
	var successes := 0
	for attempt in range(5):
		result := eco.harvest("roadside_oak_1", "stone_pick")
		if bool(result.get("ok", false)):
			successes += 1
		else:
			break

	_expect(successes == 3, "roadside oak allows exactly 3 successful harvests (max_yields=3), got %d" % successes)

	## 4th harvest fails: source exhausted
	result = eco.harvest("roadside_oak_1", "stone_pick")
	_expect(not bool(result.get("ok", false)), "harvest after exhaustion fails")
	_expect(str(result.get("reason", "")) == "SOURCE_EXHAUSTED", "exhausted source returns SOURCE_EXHAUSTED")

## --- Duplicate receipt / idempotency ---

func _test_duplicate_receipt_idempotency() -> void:
	_fresh_save()

	## Same transaction key cannot be applied twice
	var key := "test:idempotency:unique_key"
	var applied_first := save.call("transact_once", key, func(candidate: Dictionary) -> bool:
		var currencies = candidate.get("currencies", {}).duplicate(true)
		currencies["account"] = int(currencies.get("account", 0)) + 100
		candidate["currencies"] = currencies
		return true
	, {"kind": "test_idempotency"})

	var applied_second := save.call("transact_once", key, func(candidate: Dictionary) -> bool:
		var currencies = candidate.get("currencies", {}).duplicate(true)
		currencies["account"] = int(currencies.get("account", 0)) + 100
		candidate["currencies"] = currencies
		return true
	, {"kind": "test_idempotency_second"})

	_expect(bool(applied_first), "first transaction with unique key applies")
	_expect(not bool(applied_second), "duplicate transaction key is rejected (idempotency)")
	_expect(save.call("is_transaction_applied", key), "transaction key is recorded as applied")

	## Same harvest transaction key cannot be worn twice
	eco.authenticate_source("roadside_oak_1", "A1")
	_expect(_grant_tool("stone_pick", 100), "stone pick granted for idempotency test")

	## First harvest uses a real harvest transaction key
	var result := eco.harvest("roadside_oak_1", "stone_pick")
	_expect(bool(result.get("ok", false)), "first harvest succeeds")
	var tx_key := String(result.get("transaction_key", ""))
	_expect(not tx_key.is_empty(), "harvest returns a transaction key")

	## The same harvest transaction key cannot be applied again (idempotency)
	var mutator := func(candidate: Dictionary) -> bool:
		var currencies = candidate.get("currencies", {}).duplicate(true)
		currencies["account"] = int(currencies.get("account", 0)) + 1
		candidate["currencies"] = currencies
		return true
	var applied_again := save.call("transact_once", tx_key, mutator, {"kind": "test_dup"})
	_expect(not bool(applied_again), "same harvest transaction key cannot be applied twice")

## --- Tri-knowledge research ---

func _test_bounded_random_research() -> void:
	_fresh_save()
	eco.grant_material_for_test("knowledge_spare", 5, "test:grant:spares")

	var spares_before := eco._get_inventory_quantity("knowledge_spare")
	_expect(spares_before == 5, "player has 5 knowledge Spares (%d)" % spares_before)

	## Bounded random research: spend Spares, learn a random recipe
	var result := eco.bounded_random_research(2)
	_expect(bool(result.get("ok", false)), "bounded random research succeeds")
	_expect(str(result.get("mechanism", "")) == "bounded_random", "mechanism is bounded_random")
	_expect(int(result.get("spares_consumed", -1)) == 2, "2 Spares consumed")
	_expect(bool(result.has("recipe_learned")), "a recipe was learned")

	var spares_after := eco._get_inventory_quantity("knowledge_spare")
	_expect(spares_after == 3, "Spares reduced from 5 to 3 (%d)" % spares_after)

	## Recipe should be known after research (persisted through SaveService)
	var recipe_learned := String(result.get("recipe_learned", ""))
	_expect(eco._is_recipe_known(recipe_learned), "learned recipe is known after bounded random research")

	## Researching with insufficient Spares fails
	result = eco.bounded_random_research(100)
	_expect(not bool(result.get("ok", false)), "bounded random research with insufficient Spares fails")
	_expect(str(result.get("reason", "")) == "INSUFFICIENT_SPARES", "insufficient Spares returns INSUFFICIENT_SPARES")

	## Researching with zero Spares fails
	result = eco.bounded_random_research(0)
	_expect(not bool(result.get("ok", false)), "bounded random research with 0 Spares fails")

func _test_directed_research() -> void:
	_fresh_save()
	eco.grant_material_for_test("roadside_oak_scrap", 5, "test:grant:oak:directed")
	eco.grant_material_for_test("roadside_stone_chip", 2, "test:grant:stone:directed")
	eco.grant_material_for_test("knowledge_spare", 1, "test:grant:spare:directed")

	## Directed research: learn salvage_kit recipe
	var result := eco.directed_research("salvage_kit")
	_expect(bool(result.get("ok", false)), "directed research succeeds")
	_expect(str(result.get("mechanism", "")) == "directed", "mechanism is directed")
	_expect(str(result.get("recipe_learned", "")) == "salvage_kit", "salvage_kit recipe learned")

	## Recipe should be known (persisted through SaveService)
	_expect(eco._is_recipe_known("salvage_kit"), "salvage_kit recipe is known after directed research")

	## Verify inputs were consumed
	var oak_after := eco._get_inventory_quantity("roadside_oak_scrap")
	_expect(oak_after == 2, "oak scrap consumed (5-3=2), got %d" % oak_after)
	var stone_after := eco._get_inventory_quantity("roadside_stone_chip")
	_expect(stone_after == 0, "stone chip fully consumed (2-2=0), got %d" % stone_after)
	var spare_after := eco._get_inventory_quantity("knowledge_spare")
	_expect(spare_after == 0, "Spare fully consumed (1-1=0), got %d" % spare_after)

	## Directed research for already-known recipe fails
	result = eco.directed_research("salvage_kit")
	_expect(not bool(result.get("ok", false)), "directed research for already-known recipe fails")
	_expect(str(result.get("reason", "")) == "RECIPE_ALREADY_KNOWN", "already-known recipe returns RECIPE_ALREADY_KNOWN")

	## Unknown recipe fails
	result = eco.directed_research("nonexistent_recipe")
	_expect(not bool(result.get("ok", false)), "directed research for unknown recipe fails")
	_expect(str(result.get("reason", "")) == "UNKNOWN_RECIPE", "unknown recipe returns UNKNOWN_RECIPE")

func _test_destructive_specimen_reverse_engineering() -> void:
	_fresh_save()

	## Reverse engineering with no specimen fails (insufficient, recipe not yet known)
	var result := eco.reverse_engineer_specimen("quarry_sample_specimen")
	_expect(not bool(result.get("ok", false)), "reverse engineering with no specimen fails")
	_expect(str(result.get("reason", "")) == "INSUFFICIENT_QUARRY_SAMPLE", "insufficient specimen returns INSUFFICIENT_QUARRY_SAMPLE")

	## Grant specimen and reverse engineer
	eco.grant_material_for_test("quarry_sample", 3, "test:grant:sample:specimen")
	result = eco.reverse_engineer_specimen("quarry_sample_specimen")
	_expect(bool(result.get("ok", false)), "destructive specimen reverse engineering succeeds")
	_expect(str(result.get("mechanism", "")) == "destructive_specimen", "mechanism is destructive_specimen")
	_expect(str(result.get("specimen_consumed", "")) == "quarry_sample", "quarry_sample specimen consumed")
	_expect(int(result.get("specimen_quantity", -1)) == 1, "1 specimen consumed")
	_expect(str(result.get("recipe_learned", "")) == "process_quarry_sample", "process_quarry_sample recipe learned")

	## Recipe should be known (persisted through SaveService)
	_expect(eco._is_recipe_known("process_quarry_sample"), "process_quarry_sample recipe is known after reverse engineering")

	## Verify specimen was consumed (destroyed)
	var sample_after := eco._get_inventory_quantity("quarry_sample")
	_expect(sample_after == 2, "quarry_sample reduced from 3 to 2 (%d)" % sample_after)

	## Reverse engineering again fails: recipe already known (check order: known before insufficient)
	result = eco.reverse_engineer_specimen("quarry_sample_specimen")
	_expect(not bool(result.get("ok", false)), "reverse engineering already-known recipe fails")
	_expect(str(result.get("reason", "")) == "RECIPE_ALREADY_KNOWN", "already-known recipe returns RECIPE_ALREADY_KNOWN")

	## Unknown specimen fails
	result = eco.reverse_engineer_specimen("unknown_specimen")
	_expect(not bool(result.get("ok", false)), "reverse engineering unknown specimen fails")
	_expect(str(result.get("reason", "")) == "UNKNOWN_SPECIMEN", "unknown specimen returns UNKNOWN_SPECIMEN")

func _test_already_known_recipe() -> void:
	_fresh_save()

	## Learn a recipe via directed research
	eco.grant_material_for_test("roadside_oak_scrap", 3, "test:grant:oak:known")
	eco.grant_material_for_test("roadside_stone_chip", 2, "test:grant:stone:known")
	eco.grant_material_for_test("knowledge_spare", 1, "test:grant:spare:known")
	var result := eco.directed_research("salvage_kit")
	_expect(bool(result.get("ok", false)), "first directed research succeeds")

	## Trying to learn the same recipe again fails
	result = eco.directed_research("salvage_kit")
	_expect(not bool(result.get("ok", false)), "re-learning same recipe fails")
	_expect(str(result.get("reason", "")) == "RECIPE_ALREADY_KNOWN", "re-learning returns RECIPE_ALREADY_KNOWN")

## --- Paid station (deferred outputs) ---

func _test_paid_station_preparation() -> void:
	_fresh_save()

	## Learn salvage_kit recipe first
	eco.grant_material_for_test("roadside_oak_scrap", 3, "test:grant:oak:station")
	eco.grant_material_for_test("roadside_stone_chip", 2, "test:grant:stone:station")
	eco.grant_material_for_test("knowledge_spare", 1, "test:grant:spare:station")
	eco.directed_research("salvage_kit")
	_expect(eco._is_recipe_known("salvage_kit"), "salvage_kit recipe learned")

	## Fund account currency
	eco.grant_currency_for_test("account", 100, "test:grant:account:station")

	## Prepare at salvage station — outputs NOT granted yet (deferred to claim)
	var result := eco.prepare_at_station("salvage_kit", "salvage_station")
	_expect(bool(result.get("ok", false)), "paid station preparation succeeds")
	_expect(int(result.get("fuel_paid", -1)) == 5, "fuel cost is 5 account currency")
	_expect(int(result.get("queue_seconds", -1)) == 300, "queue time is 300 seconds")
	_expect(str(result.get("status", "")) == "queued", "status is queued (not completed)")

	## Outputs must NOT be in inventory yet (deferred to claim)
	var blueprint_before := eco._get_inventory_quantity("salvage_kit_blueprint")
	_expect(blueprint_before == 0, "no blueprint granted at prepare time (%d)" % blueprint_before)

	## Verify fuel was paid
	var account_after := eco._get_currency("account")
	_expect(account_after == 95, "account currency reduced by fuel cost (100-5=95), got %d" % account_after)

	## Verify inputs were consumed (escrowed at prepare time)
	var oak_after := eco._get_inventory_quantity("roadside_oak_scrap")
	_expect(oak_after == 0, "oak scrap consumed for station preparation (3-3=0), got %d" % oak_after)
	var stone_after := eco._get_inventory_quantity("roadside_stone_chip")
	_expect(stone_after == 0, "stone chip consumed for station preparation (2-2=0), got %d" % stone_after)

	## Claim before queue time elapses should fail (early claim)
	var claim_result := eco.claim_offline_production("salvage_station", "salvage_kit")
	_expect(not bool(claim_result.get("ok", false)), "early claim fails (queue not ready)")
	_expect(str(claim_result.get("reason", "")) == "QUEUE_NOT_READY", "early claim returns QUEUE_NOT_READY")

	## Simulate elapsed time by directly manipulating the job entry to be ready
	## (In production, this happens via real offline time)
	## We test the claim logic by checking that the job exists and is unclaimed
	var jobs = eco._get_station_jobs()
	var job_key := "job:salvage_station:salvage_kit"
	_expect(jobs.has(job_key), "station job is recorded in queue")
	var entry = jobs[job_key] as Dictionary
	_expect(not bool(entry.get("claimed", false)), "job is not yet claimed")

	## Manually set queued_at to the past to test claim success
	var mutator := func(candidate: Dictionary) -> bool:
		var m = candidate.get("mastery", {}).duplicate(true)
		var j = m.get("a3_station_jobs", {})
		if j is Dictionary and j.has(job_key):
			var e = j[job_key] as Dictionary
			e["queued_at_unix"] = int(Time.get_unix_time_from_system()) - 400  ## 400 seconds ago
			j[job_key] = e
		m["a3_station_jobs"] = j
		candidate["mastery"] = m
		return true
	save.call("transact_once", "test:set_job_ready", mutator, {"kind": "test_setup"})

	## Now claim should succeed
	claim_result = eco.claim_offline_production("salvage_station", "salvage_kit")
	_expect(bool(claim_result.get("ok", false)), "claim succeeds after queue time elapsed")
	_expect(str(claim_result.get("reason", "")) == "", "claim has no failure reason")

	## Verify blueprint was granted exactly once
	var blueprint_after := eco._get_inventory_quantity("salvage_kit_blueprint")
	_expect(blueprint_after == 1, "blueprint granted on claim (%d)" % blueprint_after)

	## Duplicate claim should fail
	claim_result = eco.claim_offline_production("salvage_station", "salvage_kit")
	_expect(not bool(claim_result.get("ok", false)), "duplicate claim fails")
	_expect(str(claim_result.get("reason", "")) == "ALREADY_CLAIMED", "duplicate claim returns ALREADY_CLAIMED")

func _test_insufficient_fuel() -> void:
	_fresh_save()

	## Learn salvage_kit recipe
	eco.grant_material_for_test("roadside_oak_scrap", 3, "test:grant:oak:fuel")
	eco.grant_material_for_test("roadside_stone_chip", 2, "test:grant:stone:fuel")
	eco.grant_material_for_test("knowledge_spare", 1, "test:grant:spare:fuel")
	eco.directed_research("salvage_kit")

	## Only 3 account currency (fuel cost is 5)
	eco.grant_currency_for_test("account", 3, "test:grant:account:fuel")

	var result := eco.prepare_at_station("salvage_kit", "salvage_station")
	_expect(not bool(result.get("ok", false)), "station preparation fails with insufficient fuel")
	_expect(str(result.get("reason", "")) == "INSUFFICIENT_ACCOUNT_CURRENCY", "insufficient fuel returns INSUFFICIENT_ACCOUNT_CURRENCY")

	## Verify no fuel was paid (atomic)
	var account_after := eco._get_currency("account")
	_expect(account_after == 3, "account currency unchanged on failed preparation (%d)" % account_after)

	## Verify no job was created
	var jobs = eco._get_station_jobs()
	_expect(not jobs.has("job:salvage_station:salvage_kit"), "no job created on failed preparation")

func _test_insufficient_materials_for_station() -> void:
	_fresh_save()

	## Learn salvage_kit recipe but don't provide all inputs
	eco.grant_material_for_test("roadside_oak_scrap", 1, "test:grant:oak:insufficient")  ## need 3
	eco.grant_material_for_test("roadside_stone_chip", 2, "test:grant:stone:insufficient")
	eco.grant_material_for_test("knowledge_spare", 1, "test:grant:spare:insufficient")
	eco.directed_research("salvage_kit")

	eco.grant_currency_for_test("account", 100, "test:grant:account:insufficient")

	var result := eco.prepare_at_station("salvage_kit", "salvage_station")
	_expect(not bool(result.get("ok", false)), "station preparation fails with insufficient materials")
	_expect(str(result.get("reason", "")) == "INSUFFICIENT_ROADSIDE_OAK_SCRAP", "insufficient material returns INSUFFICIENT_<ITEM>")

	## Verify no job was created
	var jobs = eco._get_station_jobs()
	_expect(not jobs.has("job:salvage_station:salvage_kit"), "no job created on failed preparation")

func _test_cancel_station_job() -> void:
	_fresh_save()

	## Learn and prepare
	eco.grant_material_for_test("roadside_oak_scrap", 3, "test:grant:oak:cancel")
	eco.grant_material_for_test("roadside_stone_chip", 2, "test:grant:stone:cancel")
	eco.grant_material_for_test("knowledge_spare", 1, "test:grant:spare:cancel")
	eco.directed_research("salvage_kit")
	eco.grant_currency_for_test("account", 100, "test:grant:account:cancel")

	var prepare_result := eco.prepare_at_station("salvage_kit", "salvage_station")
	_expect(bool(prepare_result.get("ok", false)), "preparation succeeds for cancel test")

	## Cancel the job
	var cancel_result := eco.cancel_station_job("salvage_station", "salvage_kit")
	_expect(bool(cancel_result.get("ok", false)), "cancel succeeds")
	_expect(int(cancel_result.get("fuel_refunded", -1)) == 5, "fuel refunded on cancel")

	## Verify fuel was refunded
	var account_after := eco._get_currency("account")
	_expect(account_after == 100, "account currency refunded after cancel (100), got %d" % account_after)

	## Verify job was removed
	var jobs = eco._get_station_jobs()
	_expect(not jobs.has("job:salvage_station:salvage_kit"), "job removed after cancel")

	## Claim after cancel should fail
	var claim_result := eco.claim_offline_production("salvage_station", "salvage_kit")
	_expect(not bool(claim_result.get("ok", false)), "claim after cancel fails")
	_expect(str(claim_result.get("reason", "")) == "QUEUE_NOT_FOUND_OR_ALREADY_CLAIMED", "claim after cancel returns QUEUE_NOT_FOUND")

## --- Reverse-use lookup ---

func _test_reverse_use_lookup() -> void:
	_fresh_save()

	## Initially, quarry_sample has no known use
	var lookup := eco.lookup_use("quarry_sample")
	_expect(lookup.is_empty(), "quarry_sample has no known use before discovery")
	_expect(not eco.is_discovered("quarry_sample"), "quarry_sample is not discovered before run-local discovery")

	## Register a run-local discovery: quarry_sample becomes useful
	var disc_result := eco.register_discovery("quarry_sample", "Unlocks process_quarry_sample recipe at salvage station", "process_quarry_sample")
	_expect(disc_result, "register_discovery succeeds")
	_expect(eco.is_discovered("quarry_sample"), "quarry_sample is marked as discovered")

	lookup = eco.lookup_use("quarry_sample")
	_expect(not lookup.is_empty(), "quarry_sample has a known use after discovery")
	_expect(String(lookup.get("use_description", "")) == "Unlocks process_quarry_sample recipe at salvage station", "reverse-use lookup returns description")
	_expect(String(lookup.get("recipe_id", "")) == "process_quarry_sample", "reverse-use lookup returns recipe ID")

	## Unknown material has no lookup
	lookup = eco.lookup_use("unknown_material")
	_expect(lookup.is_empty(), "unknown material has no reverse-use lookup")

## --- Two strategies ---

func _test_home_first_strategy() -> void:
	_fresh_save()

	eco.authenticate_source("roadside_oak_1", "A1")
	eco.authenticate_source("roadside_stone_1", "A1")

	## Home-first: gather roadside materials, process at home station, build
	## capability before any expedition.
	_expect(_grant_tool("stone_pick", 100), "stone pick granted for home-first strategy")

	## Harvest roadside oak (3 yields max)
	var total_oak := 0
	for attempt in range(3):
		result := eco.harvest("roadside_oak_1", "stone_pick")
		if bool(result.get("ok", false)):
			var items = result.get("yield", {}).get("items", {}) as Dictionary
			total_oak += int(items.get("roadside_oak_scrap", 0))

	_expect(total_oak >= 3, "home-first gathers at least 3 oak scrap (%d)" % total_oak)

	## Learn and use directed research to unlock salvage kit
	eco.grant_material_for_test("roadside_stone_chip", 2, "test:grant:stone:home")
	eco.grant_material_for_test("knowledge_spare", 1, "test:grant:spare:home")
	var result := eco.directed_research("salvage_kit")
	_expect(bool(result.get("ok", false)), "home-first: directed research learns salvage_kit")

	## Prepare at home station (fuel + inputs, deferred output)
	eco.grant_currency_for_test("account", 10, "test:grant:account:home")
	result = eco.prepare_at_station("salvage_kit", "salvage_station")
	_expect(bool(result.get("ok", false)), "home-first: station preparation succeeds")

	## Result: player has future capability (salvage kit blueprint queued) before expedition
	## The blueprint is not yet in inventory — it will be granted on claim
	var blueprint_qty := eco._get_inventory_quantity("salvage_kit_blueprint")
	_expect(blueprint_qty == 0, "home-first: blueprint not yet granted (deferred to claim), got %d" % blueprint_qty)

	## But the job is queued and will yield the blueprint
	var jobs = eco._get_station_jobs()
	_expect(jobs.has("job:salvage_station:salvage_kit"), "home-first: salvage kit job is queued")

func _test_prepared_quarry_exploration_strategy() -> void:
	_fresh_save()

	eco.authenticate_source("quarry_deep_1", "A8")

	## Prepared Quarry exploration: fund account, bring iron pick, expedition
	eco.grant_currency_for_test("account", 50, "test:grant:account:quarry")
	_expect(_grant_tool("iron_pick", 200), "iron pick granted for Quarry strategy")

	## Harvest Quarry (5 yields max, high risk, high reward)
	var total_samples := 0
	var total_cores := 0
	for attempt in range(5):
		result := eco.harvest("quarry_deep_1", "iron_pick")
		if not bool(result.get("ok", false)):
			break
		var items = result.get("yield", {}).get("items", {}) as Dictionary
		total_samples += int(items.get("quarry_sample", 0))
		total_cores += int(items.get("quarry_core_fragment", 0))

	_expect(total_samples >= 10, "Quarry exploration gathers at least 10 samples (5 harvests × 2 base), got %d" % total_samples)
	_expect(eco._get_inventory_quantity("quarry_sample") >= 10, "inventory has at least 10 quarry samples")

	## Quarry sample is low-value until discovery
	_expect(not eco.is_discovered("quarry_sample"), "quarry_sample has no known use before discovery")

	## After run-local discovery, quarry_sample becomes useful
	eco.register_discovery("quarry_sample", "Process at salvage station for account currency", "process_quarry_sample")
	_expect(eco.is_discovered("quarry_sample"), "quarry_sample discovered after run-local event")

	var lookup := eco.lookup_use("quarry_sample")
	_expect(not lookup.is_empty(), "quarry_sample has reverse-use lookup after discovery")

	## process_quarry_sample is a genuine craftable recipe (learned via reverse engineering)
	## First, make sure we have enough quarry_sample for reverse engineering
	eco.grant_material_for_test("quarry_sample", 3, "test:grant:sample:quarry_strategy")
	var re_result := eco.reverse_engineer_specimen("quarry_sample_specimen")
	_expect(bool(re_result.get("ok", false)), "reverse engineering quarry specimen teaches process_quarry_sample")
	_expect(eco._is_recipe_known("process_quarry_sample"), "process_quarry_sample recipe is known and craftable")

## --- Run reset ---

func _test_run_reset() -> void:
	_fresh_save()

	## Learn a recipe and register a discovery
	eco.grant_material_for_test("roadside_oak_scrap", 3, "test:grant:oak:reset")
	eco.grant_material_for_test("roadside_stone_chip", 2, "test:grant:stone:reset")
	eco.grant_material_for_test("knowledge_spare", 1, "test:grant:spare:reset")
	eco.directed_research("salvage_kit")
	_expect(eco._is_recipe_known("salvage_kit"), "salvage_kit is learned before reset")

	eco.register_discovery("roadside_oak_scrap", "Oak scrap is useful for salvage kit", "salvage_kit")
	_expect(eco.is_discovered("roadside_oak_scrap"), "oak scrap discovery registered before reset")

	## Simulate run reset: SaveService reset clears mastery (learned_recipes, discoveries, run_id)
	_expect(save.call("reset_to_defaults", "RESET_SOUL_OF_HERO_SAVE"), "SaveService reset to defaults")

	## Re-configure after reset
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "save reconfigured after reset")
	eco.configure(save)

	## Run-local state should be gone (cleared by SaveService reset)
	_expect(not eco._is_recipe_known("salvage_kit"), "salvage_kit recipe forgotten after run reset")
	_expect(not eco.is_discovered("roadside_oak_scrap"), "oak scrap discovery forgotten after run reset")

	## Inventory and currencies also reset (reset_to_defaults clears everything)
	var oak_qty := eco._get_inventory_quantity("roadside_oak_scrap")
	_expect(oak_qty == 0, "oak scrap reset to 0 after run reset, got %d" % oak_qty)

## --- Persistence anti-duplication ---

func _test_persistence_anti_duplication() -> void:
	_fresh_save()
	eco.authenticate_source("roadside_oak_1", "A1")
	_expect(_grant_tool("stone_pick", 100), "stone pick granted for anti-duplication test")

	## First harvest
	var result1 := eco.harvest("roadside_oak_1", "stone_pick")
	_expect(bool(result1.get("ok", false)), "first harvest succeeds")

	var tx_key := String(result1.get("transaction_key", ""))
	_expect(not tx_key.is_empty(), "harvest returns a transaction key")

	## Verify the transaction is applied
	_expect(save.call("is_transaction_applied", tx_key), "harvest transaction key is recorded as applied")

	## Attempting to apply the same transaction key directly is rejected
	var mutator := func(candidate: Dictionary) -> bool:
		var currencies = candidate.get("currencies", {}).duplicate(true)
		currencies["account"] = int(currencies.get("account", 0)) + 1
		candidate["currencies"] = currencies
		return true
	var applied_again := save.call("transact_once", tx_key, mutator, {"kind": "test_dup"})
	_expect(not bool(applied_again), "same transaction key cannot be applied twice (anti-duplication)")

	## Second harvest uses a different transaction key (different harvest index)
	var result2 := eco.harvest("roadside_oak_1", "stone_pick")
	_expect(bool(result2.get("ok", false)), "second harvest succeeds with new transaction key")
	var tx_key2 := String(result2.get("transaction_key", ""))
	_expect(tx_key2 != tx_key, "second harvest has a different transaction key")

## --- Finish ---

func _finish() -> void:
	_remove_generations(TEST_SAVE_PATH)
	if _failures.is_empty():
		print("A3 VALUE ECONOMY TEST PASSED (%d checks)" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			print("  - " + failure)
		print("A3 VALUE ECONOMY TEST FAILED (%d/%d checks)" % [_failures.size(), _checks])
		quit(1)
