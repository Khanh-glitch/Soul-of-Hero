extends RefCounted
class_name A3EconomyService

## A3-owned economy orchestration layer on top of A0's SaveService.
##
## A0 is the single SaveService mutator/composer. This service never creates
## a second wallet, clock, or SaveService. Every inventory/currency mutation
## goes through SaveService.transact_once so source→cost→item/research→future
## choice is atomic and idempotent.
##
## Source identities are fail-closed: an unauthenticated source ID yields
## nothing and never grants inventory. A1/A8 physically authenticate sources
## when they mount roadside/Quarry sites; this service only knows the source
## IDs that A1/A8 have promised to use.

const SaveServiceClass = preload("res://game/autoload/save_service.gd")
const STACK_ITEM_CATALOG: StackItemCatalog = preload("res://data/content/items/item_catalog.tres")

## Source IDs that A1 (roadside) and A8 (Quarry) have committed to physically
## authenticate. Empty by default = fail-closed. Populated by A1/A8 at mount
## time; this service never invents or mutates the list.
var authenticated_sources: Dictionary = {
	"roadside": {},
	"quarry": {},
}

## Source contract definitions. Each source has finite yields keyed by
## transaction key so SaveService idempotency prevents double-harvest.
var source_contracts: Dictionary = {
	"roadside_oak_1": {
		"owner": "A1",
		"kind": "roadside",
		"display_name": "Roadside Oak Outcrop",
		"max_yields": 3,
		"yields_per_harvest": {"roadside_oak_scrap": 1, "knowledge_spare": 0},
		"spare_chance": 0.33,
		"tool_cost": {"stone_pick": 1},
		"risk": "low",
	},
	"roadside_stone_1": {
		"owner": "A1",
		"kind": "roadside",
		"display_name": "Roadside Stone Outcrop",
		"max_yields": 3,
		"yields_per_harvest": {"roadside_stone_chip": 1, "knowledge_spare": 0},
		"spare_chance": 0.33,
		"tool_cost": {"stone_pick": 1},
		"risk": "low",
	},
	"roadside_iron_1": {
		"owner": "A1",
		"kind": "roadside",
		"display_name": "Roadside Iron Deposit",
		"max_yields": 2,
		"yields_per_harvest": {"roadside_iron_scrap": 1, "knowledge_spare": 0},
		"spare_chance": 0.25,
		"tool_cost": {"iron_pick": 1},
		"risk": "low",
	},
	"quarry_deep_1": {
		"owner": "A8",
		"kind": "quarry",
		"display_name": "Deep Quarry Face",
		"max_yields": 5,
		"yields_per_harvest": {"quarry_sample": 2, "quarry_core_fragment": 0},
		"core_chance": 0.20,
		"tool_cost": {"iron_pick": 2},
		"risk": "high",
	},
}

## Tool definitions. Condition degrades with use; at 0 the tool is broken.
## Tracked in-memory per run; reconstructed from SaveService transaction keys
## on reload so a tool cannot be worn twice for the same transaction.
var tool_definitions: Dictionary = {
	"stone_pick": {"max_condition": 100, "wear_per_use": 25, "repairable": false},
	"iron_pick": {"max_condition": 200, "wear_per_use": 10, "repairable": false},
}

## Run-local discoveries: material_id → {use_description, recipe_id, discovered_at_run}.
## Reset on run reset; persisted only through SaveService transaction receipts.
var run_discoveries: Dictionary = {}

## Recipe registry. Each recipe has inputs, outputs, and a knowledge mechanism.
## Recipes are learned through research; unknown recipes cannot be crafted.
var recipes: Dictionary = {
	"salvage_kit": {
		"recipe_id": "salvage_kit",
		"display_name": "Salvage Kit",
		"inputs": {"roadside_oak_scrap": 3, "roadside_stone_chip": 2, "knowledge_spare": 1},
		"outputs": {"salvage_kit_blueprint": 1},
		"station": "salvage_station",
		"fuel_cost": 5,
		"queue_seconds": 300,
		"knowledge_mechanism": "directed",
		"unlocks": ["process_roadside_materials"],
	},
	"process_roadside_materials": {
		"recipe_id": "process_roadside_materials",
		"display_name": "Process Roadside Materials",
		"inputs": {"roadside_oak_scrap": 5, "roadside_iron_scrap": 3},
		"outputs": {"hero_materials": 10},  # account currency via paid station
		"station": "salvage_station",
		"fuel_cost": 10,
		"queue_seconds": 600,
		"knowledge_mechanism": "directed",
		"unlocks": [],
	},
}

## Learned recipe IDs (run-local). Reset on run reset.
var learned_recipes: Dictionary = {}

## Specimen registry for destructive reverse engineering.
## specimen_id → {item_id, consumes_quantity, teaches_recipe_id, destroy_on_use}
var specimen_registry: Dictionary = {
	"quarry_sample_specimen": {
		"item_id": "quarry_sample",
		"consumes_quantity": 1,
		"teaches_recipe_id": "process_quarry_sample",
		"destroy_on_use": true,
	},
}

var save: Node

func _ready() -> void:
	save = root.get_node_or_null("SaveService")

## Configure the service with an isolated SaveService instance (tests only).
func configure(save_node: Node) -> bool:
	if save_node == null:
		return false
	save = save_node
	return true

## Authenticate a source ID for its owner domain (A1 roadside / A8 Quarry).
## Called by A1/A8 when they physically mount a site. Idempotent.
func authenticate_source(source_id: String, owner_domain: String) -> bool:
	var contract = source_contracts.get(source_id, {})
	if contract.is_empty():
		return false
	var expected_owner = String(contract.get("owner", ""))
	if expected_owner != owner_domain:
		return false
	if not authenticated_sources.has(contract.get("kind", "")):
		authenticated_sources[contract.get("kind", "")] = {}
	authenticated_sources[contract.get("kind", "")][source_id] = true
	return true

## Check whether a source is authenticated (fail-closed gate).
func is_source_authenticated(source_id: String) -> bool:
	var contract = source_contracts.get(source_id, {})
	if contract.is_empty():
		return false
	var kind = String(contract.get("kind", ""))
	var domain_map = authenticated_sources.get(kind, {})
	if not domain_map is Dictionary:
		return false
	return bool(domain_map.has(source_id))

## Harvest from a roadside or Quarry source. Atomic: tool wear + yield grant
## commit in one SaveService transaction. Fails closed on any precondition
## violation. Returns {ok, reason, yield, tool_condition_remaining, source_yields_remaining}.
func harvest(source_id: String, tool_id: String) -> Dictionary:
	var contract = source_contracts.get(source_id, {})
	if contract.is_empty():
		return {"ok": false, "reason": "UNKNOWN_SOURCE"}

	if not is_source_authenticated(source_id):
		return {"ok": false, "reason": "SOURCE_NOT_AUTHENTICATED"}

	## Tool precondition: tool must exist and have durability.
	var tool_def = tool_definitions.get(tool_id, {})
	if tool_def.is_empty():
		return {"ok": false, "reason": "UNKNOWN_TOOL"}

	var tool_condition = _get_tool_condition(tool_id)
	if tool_condition <= 0:
		return {"ok": false, "reason": "TOOL_BROKEN"}

	## Source finite-yield precondition: harvest count below max_yields.
	var harvest_key := "harvest:%s" % source_id
	var times_harvested := _get_times_harvested(source_id)
	var max_yields := int(contract.get("max_yields", 0))
	if times_harvested >= max_yields:
		return {"ok": false, "reason": "SOURCE_EXHAUSTED"}

	## Inventory capacity precondition: room for expected yields.
	var expected_stacks := _expected_new_stacks(contract)
	if not _has_inventory_room(expected_stacks):
		return {"ok": false, "reason": "INVENTORY_FULL"}

	## Compute yields (deterministic per source + harvest index for test stability).
	var harvest_index := times_harvested + 1
	var yield_result := _compute_yields(contract, harvest_index)

	## Build the atomic mutator: wear tool + grant yield in one transaction.
	var transaction_key := "a3_harvest:%s:%d" % [source_id, harvest_index]
	var mutator_result := _build_harvest_mutator(tool_id, tool_def, yield_result, transaction_key)

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", transaction_key, mutator_result, {"kind": "a3_harvest", "source": source_id}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	## Update in-memory model after successful commit.
	_record_harvest(source_id)
	_wear_tool(tool_id, int(tool_def.get("wear_per_use", 0)))

	var remaining_condition := _get_tool_condition(tool_id)
	var remaining_yields := max_yields - times_harvested - 1

	return {
		"ok": true,
		"reason": "",
		"yield": yield_result,
		"tool_condition_remaining": remaining_condition,
		"source_yields_remaining": remaining_yields,
		"transaction_key": transaction_key,
	}

## --- Tri-knowledge research model ---

## Bounded random Spares research: spend Spares, receive a random recipe from
## the bounded pool of researchable recipes. Not a free unlock; each roll
## consumes Spares and may yield a duplicate (no refund).
func bounded_random_research(spares_quantity: int) -> Dictionary:
	if spares_quantity < 1:
		return {"ok": false, "reason": "INSUFFICIENT_SPARES"}

	var spares_available := _get_inventory_quantity("knowledge_spare")
	if spares_available < spares_quantity:
		return {"ok": false, "reason": "INSUFFICIENT_SPARES"}

	var researchable := _get_researchable_recipes()
	if researchable.is_empty():
		return {"ok": false, "reason": "NO_RESEARCHABLE_RECIPES"}

	var transaction_key := "a3_research:bounded_random:%d" % Time.get_ticks_usec()
	var mutator := func(candidate: Dictionary) -> bool:
		var inventory = candidate.get("inventory", {}).duplicate(true)
		var stacks = inventory.get("item_stacks", {}).duplicate(true)
		var spare_key := _find_stack_key(stacks, "knowledge_spare")
		if spare_key.is_empty():
			return false
		var spare_record = stacks[spare_key] as Dictionary
		if int(spare_record.get("quantity", 0)) < spares_quantity:
			return false
		spare_record["quantity"] = int(spare_record.get("quantity", 0)) - spares_quantity
		if int(spare_record.get("quantity", 0)) <= 0:
			stacks.erase(spare_key)
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", transaction_key, mutator, {"kind": "a3_research_bounded_random", "spares_spent": spares_quantity}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	## Select a random recipe from the bounded pool.
	var rng := RandomNumberGenerator.new()
	rng.seed = Time.get_ticks_usec()
	var recipe_ids := researchable.duplicate()
	recipe_ids.shuffle(rng)
	var chosen := recipe_ids[0]
	_learn_recipe(chosen)

	return {
		"ok": true,
		"reason": "",
		"recipe_learned": chosen,
		"spares_consumed": spares_quantity,
		"mechanism": "bounded_random",
	}

## Directed research: spend specific materials + Spares to learn a specific
## recipe. Fails if any input is missing or the recipe is already known.
func directed_research(recipe_id: String) -> Dictionary:
	var recipe = recipes.get(recipe_id, {})
	if recipe.is_empty():
		return {"ok": false, "reason": "UNKNOWN_RECIPE"}

	if _is_recipe_known(recipe_id):
		return {"ok": false, "reason": "RECIPE_ALREADY_KNOWN"}

	var inputs = recipe.get("inputs", {})
	if inputs.is_empty():
		return {"ok": false, "reason": "RECIPE_HAS_NO_INPUTS"}

	## Verify all inputs are available.
	for input_id: String in inputs.keys():
		var required_qty := int(inputs[input_id])
		var available := _get_inventory_quantity(input_id)
		if available < required_qty:
			return {"ok": false, "reason": "INSUFFICIENT_%s" % input_id.to_upper()}

	var transaction_key := "a3_research:directed:%s" % recipe_id
	var mutator := func(candidate: Dictionary) -> bool:
		var inventory = candidate.get("inventory", {}).duplicate(true)
		var stacks = inventory.get("item_stacks", {}).duplicate(true)
		for input_id: String in inputs.keys():
			var required_qty := int(inputs[input_id])
			var stack_key := _find_stack_key(stacks, input_id)
			if stack_key.is_empty():
				return false
			var record = stacks[stack_key] as Dictionary
			if int(record.get("quantity", 0)) < required_qty:
				return false
			record["quantity"] = int(record.get("quantity", 0)) - required_qty
			if int(record.get("quantity", 0)) <= 0:
				stacks.erase(stack_key)
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", transaction_key, mutator, {"kind": "a3_research_directed", "recipe": recipe_id}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	_learn_recipe(recipe_id)

	return {
		"ok": true,
		"reason": "",
		"recipe_learned": recipe_id,
		"inputs_consumed": inputs.duplicate(true),
		"mechanism": "directed",
	}

## Destructive specimen reverse engineering: consume a specimen item to learn
## its associated recipe. The specimen is destroyed (consumed) on success.
## Fails if specimen missing, already known, or no specimen registered.
func reverse_engineer_specimen(specimen_id: String) -> Dictionary:
	var specimen = specimen_registry.get(specimen_id, {})
	if specimen.is_empty():
		return {"ok": false, "reason": "UNKNOWN_SPECIMEN"}

	var item_id = String(specimen.get("item_id", ""))
	var consumes_qty := int(specimen.get("consumes_quantity", 1))
	var teaches_recipe_id := String(specimen.get("teaches_recipe_id", ""))

	if teaches_recipe_id.is_empty():
		return {"ok": false, "reason": "SPECIMEN_TEACHES_NOTHING"}

	if _is_recipe_known(teaches_recipe_id):
		return {"ok": false, "reason": "RECIPE_ALREADY_KNOWN"}

	var available := _get_inventory_quantity(item_id)
	if available < consumes_qty:
		return {"ok": false, "reason": "INSUFFICIENT_%s" % item_id.to_upper()}

	var transaction_key := "a3_research:specimen:%s" % specimen_id
	var mutator := func(candidate: Dictionary) -> bool:
		var inventory = candidate.get("inventory", {}).duplicate(true)
		var stacks = inventory.get("item_stacks", {}).duplicate(true)
		var stack_key := _find_stack_key(stacks, item_id)
		if stack_key.is_empty():
			return false
		var record = stacks[stack_key] as Dictionary
		if int(record.get("quantity", 0)) < consumes_qty:
			return false
		record["quantity"] = int(record.get("quantity", 0)) - consumes_qty
		if int(record.get("quantity", 0)) <= 0:
			stacks.erase(stack_key)
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", transaction_key, mutator, {"kind": "a3_research_specimen", "specimen": specimen_id, "recipe": teaches_recipe_id}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	_learn_recipe(teaches_recipe_id)

	return {
		"ok": true,
		"reason": "",
		"recipe_learned": teaches_recipe_id,
		"specimen_consumed": item_id,
		"specimen_quantity": consumes_qty,
		"mechanism": "destructive_specimen",
	}

## --- Paid station / fuel / queue / offline proposal ---

## Prepare an expedition at a paid station. Pays fuel cost, queues production
## time, and grants the output when the queue completes. All through one
## SaveService transaction. Fails closed on insufficient resources or
## unknown recipe/station.
func prepare_at_station(recipe_id: String, station_id: String) -> Dictionary:
	var recipe = recipes.get(recipe_id, {})
	if recipe.is_empty():
		return {"ok": false, "reason": "UNKNOWN_RECIPE"}

	if not _is_recipe_known(recipe_id):
		return {"ok": false, "reason": "RECIPE_NOT_LEARNED"}

	var station = String(recipe.get("station", ""))
	if station != station_id:
		return {"ok": false, "reason": "RECIPE_NOT_FOR_STATION"}

	var fuel_cost := int(recipe.get("fuel_cost", 0))
	var account_balance := _get_currency("account")
	if account_balance < fuel_cost:
		return {"ok": false, "reason": "INSUFFICIENT_ACCOUNT_CURRENCY"}

	var inputs = recipe.get("inputs", {})
	for input_id: String in inputs.keys():
		var required_qty := int(inputs[input_id])
		var available := _get_inventory_quantity(input_id)
		if available < required_qty:
			return {"ok": false, "reason": "INSUFFICIENT_%s" % input_id.to_upper()}

	var transaction_key := "a3_station:prepare:%s:%s" % [station_id, recipe_id]
	var mutator := func(candidate: Dictionary) -> bool:
		## Pay fuel from account currency.
		var currencies = candidate.get("currencies", {}).duplicate(true)
		currencies["account"] = int(currencies.get("account", 0)) - fuel_cost
		candidate["currencies"] = currencies

		## Consume inputs from inventory.
		var inventory = candidate.get("inventory", {}).duplicate(true)
		var stacks = inventory.get("item_stacks", {}).duplicate(true)
		for input_id: String in inputs.keys():
			var required_qty := int(inputs[input_id])
			var stack_key := _find_stack_key(stacks, input_id)
			if stack_key.is_empty():
				return false
			var record = stacks[stack_key] as Dictionary
			if int(record.get("quantity", 0)) < required_qty:
				return false
			record["quantity"] = int(record.get("quantity", 0)) - required_qty
			if int(record.get("quantity", 0)) <= 0:
				stacks.erase(stack_key)
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory

		## Record the queued production (offline proposal).
		var queue_key := "queue:%s:%s" % [station_id, recipe_id]
		var queues = candidate.get("mastery", {}).duplicate(true)  ## reuse mastery as queue ledger
		if not queues.has("a3_station_queues"):
			queues["a3_station_queues"] = {}
		var queue_ledger = queues["a3_station_queues"] as Dictionary
		queue_ledger[queue_key] = {
			"recipe_id": recipe_id,
			"station_id": station_id,
			"fuel_paid": fuel_cost,
			"queued_at_unix": int(Time.get_unix_time_from_system()),
			"queue_seconds": int(recipe.get("queue_seconds", 0)),
			"outputs": recipe.get("outputs", {}).duplicate(true),
			"claimed": false,
		}
		queues["a3_station_queues"] = queue_ledger
		candidate["mastery"] = queues

		## Grant outputs immediately (production completes atomically with payment).
		var outputs = recipe.get("outputs", {}).duplicate(true)
		for output_id: String in outputs.keys():
			var qty := int(outputs[output_id])
			if qty <= 0:
				continue
			if not _grant_to_candidate(candidate, output_id, qty):
				return false
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", transaction_key, mutator, {"kind": "a3_station_prepare", "station": station_id, "recipe": recipe_id}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	return {
		"ok": true,
		"reason": "",
		"recipe": recipe_id,
		"station": station_id,
		"fuel_paid": fuel_cost,
		"queue_seconds": int(recipe.get("queue_seconds", 0)),
		"outputs": recipe.get("outputs", {}).duplicate(true),
		"transaction_key": transaction_key,
	}

## Claim a completed offline production. Idempotent via transaction key.
func claim_offline_production(station_id: String, recipe_id: String) -> Dictionary:
	var queue_key := "queue:%s:%s" % [station_id, recipe_id]
	if not _is_transaction_applied(queue_key):
		return {"ok": false, "reason": "QUEUE_NOT_FOUND_OR_ALREADY_CLAIMED"}

	var queues = _get_value(["mastery", "a3_station_queues"], {})
	if not queues is Dictionary:
		return {"ok": false, "reason": "QUEUE_LEDGER_INVALID"}
	var queue_ledger = queues as Dictionary
	var entry = queue_ledger.get(queue_key, {})
	if entry.is_empty():
		return {"ok": false, "reason": "QUEUE_ENTRY_MISSING"}
	if bool(entry.get("claimed", false)):
		return {"ok": false, "reason": "ALREADY_CLAIMED"}

	## Verify queue time has elapsed (real-time gate).
	var queued_at := int(entry.get("queued_at_unix", 0))
	var queue_seconds := int(entry.get("queue_seconds", 0))
	var now := int(Time.get_unix_time_from_system())
	if now - queued_at < queue_seconds:
		return {"ok": false, "reason": "QUEUE_NOT_READY"}

	var transaction_key := "a3_station:claim:%s:%s" % [station_id, recipe_id]
	var mutator := func(candidate: Dictionary) -> bool:
		var queues = candidate.get("mastery", {}).duplicate(true)
		var ledger = queues.get("a3_station_queues", {}) as Dictionary
		if ledger.has(queue_key):
			var e = ledger[queue_key] as Dictionary
			e["claimed"] = true
			ledger[queue_key] = e
		queues["a3_station_queues"] = ledger
		candidate["mastery"] = queues
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", transaction_key, mutator, {"kind": "a3_station_claim", "station": station_id, "recipe": recipe_id}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	return {
		"ok": true,
		"reason": "",
		"recipe": recipe_id,
		"station": station_id,
		"outputs": entry.get("outputs", {}).duplicate(true),
		"transaction_key": transaction_key,
	}

## --- Reverse-use lookup ---

## Register a run-local discovery: a previously low-value material becomes
## useful after discovery. The player can look up why via lookup_use().
func register_discovery(material_id: String, use_description: String, recipe_id: String = "") -> bool:
	if material_id.is_empty() or use_description.is_empty():
		return false
	run_discoveries[material_id] = {
		"use_description": use_description,
		"recipe_id": recipe_id,
		"discovered_at_run": _get_run_id(),
	}
	return true

## Look up the discovered use for a material. Returns empty dict if unknown.
func lookup_use(material_id: String) -> Dictionary:
	var discovery = run_discoveries.get(material_id, {})
	if discovery.is_empty():
		return {}
	return discovery.duplicate(true)

## Check whether a material's use has been discovered this run.
func is_discovered(material_id: String) -> bool:
	return run_discoveries.has(material_id)

## --- Read-only projections for A6 consumers ---

## Return source/sink and technology projections (read-only, no state mutation).
func get_projections() -> Dictionary:
	var source_projections := {}
	for source_id: String in source_contracts.keys():
		var contract = source_contracts[source_id]
		source_projections[source_id] = {
			"owner": String(contract.get("owner", "")),
			"kind": String(contract.get("kind", "")),
			"display_name": String(contract.get("display_name", "")),
			"authenticated": is_source_authenticated(source_id),
			"max_yields": int(contract.get("max_yields", 0)),
			"yields_remaining": max(0, int(contract.get("max_yields", 0)) - _get_times_harvested(source_id)),
			"risk": String(contract.get("risk", "")),
		}

	var recipe_projections := {}
	for recipe_id: String in recipes.keys():
		var recipe = recipes[recipe_id]
		recipe_projections[recipe_id] = {
			"display_name": String(recipe.get("display_name", "")),
			"station": String(recipe.get("station", "")),
			"fuel_cost": int(recipe.get("fuel_cost", 0)),
			"queue_seconds": int(recipe.get("queue_seconds", 0)),
			"knowledge_mechanism": String(recipe.get("knowledge_mechanism", "")),
			"learned": _is_recipe_known(recipe_id),
			"inputs": recipe.get("inputs", {}).duplicate(true),
			"outputs": recipe.get("outputs", {}).duplicate(true),
		}

	return {
		"sources": source_projections,
		"recipes": recipe_projections,
		"discoveries": run_discoveries.duplicate(true),
		"learned_recipes": learned_recipes.duplicate(true),
	}

## --- Internal helpers ---

func _build_harvest_mutator(tool_id: String, tool_def: Dictionary, yield_result: Dictionary, transaction_key: String) -> Callable:
	var tool_condition_before := _get_tool_condition(tool_id)
	return func(candidate: Dictionary) -> bool:
		## Wear the tool: reduce condition.
		var inventory = candidate.get("inventory", {}).duplicate(true)
		var stacks = inventory.get("item_stacks", {}).duplicate(true)
		var tool_stack_key := _find_stack_key(stacks, tool_id)
		if tool_stack_key.is_empty():
			## Tool not in inventory; check if it's a virtual tool (tracked only).
			## For now, require the tool to be present as an inventory item.
			return false
		var tool_record = stacks[tool_stack_key] as Dictionary
		var current_condition := int(tool_record.get("condition", int(tool_def.get("max_condition", 100))))
		var wear := int(tool_def.get("wear_per_use", 0))
		var new_condition := max(0, current_condition - wear)
		if new_condition <= 0:
			stacks.erase(tool_stack_key)  ## tool breaks
		else:
			tool_record["condition"] = new_condition
			stacks[tool_stack_key] = tool_record
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory

		## Grant yields.
		var yields = yield_result.get("items", {}) as Dictionary
		for item_id: String in yields.keys():
			var qty := int(yields[item_id])
			if qty <= 0:
				continue
			if not _grant_to_candidate(candidate, item_id, qty):
				return false
		return true

func _compute_yields(contract: Dictionary, harvest_index: int) -> Dictionary:
	var base_yields = contract.get("yields_per_harvest", {}) as Dictionary
	var result := {}
	for item_id: String in base_yields.keys():
		var base_qty := int(base_yields[item_id])
		if base_qty > 0:
			result[item_id] = base_qty

	## Chance-based bonus (Spares or Core fragment).
	var rng := RandomNumberGenerator.new()
	rng.seed = harvest_index * 1000 + Time.get_ticks_usec() % 100000

	var spare_chance := float(contract.get("spare_chance", 0.0))
	if spare_chance > 0 and rng.randf() < spare_chance:
		result["knowledge_spare"] = int(result.get("knowledge_spare", 0)) + 1

	var core_chance := float(contract.get("core_chance", 0.0))
	if core_chance > 0 and rng.randf() < core_chance:
		result["quarry_core_fragment"] = int(result.get("quarry_core_fragment", 0)) + 1

	return {"items": result}

func _expected_new_stacks(contract: Dictionary) -> int:
	var count := 0
	var yields = contract.get("yields_per_harvest", {}) as Dictionary
	for item_id: String in yields.keys():
		if int(yields[item_id]) > 0:
			if _get_inventory_quantity(item_id) == 0:
				count += 1
	var spare_chance := float(contract.get("spare_chance", 0.0))
	if spare_chance > 0 and _get_inventory_quantity("knowledge_spare") == 0:
		count += 1
	var core_chance := float(contract.get("core_chance", 0.0))
	if core_chance > 0 and _get_inventory_quantity("quarry_core_fragment") == 0:
		count += 1
	return count

func _has_inventory_room(additional_stacks: int) -> bool:
	if save == null:
		return true
	var snapshot = save.call("get_snapshot") as Dictionary
	var inventory = snapshot.get("inventory", {}) as Dictionary
	var stacks = inventory.get("item_stacks", {}) as Dictionary
	var souls = inventory.get("hero_souls", []) as Array
	var equipment = inventory.get("auxiliary_equipment", []) as Array
	var used := souls.size() + equipment.size() + stacks.size()
	var capacity := 30  ## INVENTORY_SLOT_CAPACITY from SaveService
	return (used + additional_stacks) <= capacity

func _find_stack_key(stacks: Dictionary, item_id: String) -> String:
	if not stacks is Dictionary:
		return ""
	for raw_key: Variant in stacks.keys():
		var key := String(raw_key)
		var record = stacks[raw_key]
		if record is Dictionary and String(record.get("item_id", key)).strip_edges().to_lower() == item_id.strip_edges().to_lower():
			return key
	if stacks.has(item_id):
		return item_id
	return ""

func _get_inventory_quantity(item_id: String) -> int:
	if save == null:
		return 0
	var snapshot = save.call("get_snapshot") as Dictionary
	var inventory = snapshot.get("inventory", {}) as Dictionary
	var stacks = inventory.get("item_stacks", {}) as Dictionary
	var total := 0
	for raw_key: Variant in stacks.keys():
		var key := String(raw_key)
		var record = stacks[raw_key]
		if record is Dictionary and String(record.get("item_id", key)).strip_edges().to_lower() == item_id.strip_edges().to_lower():
			total += int(record.get("quantity", 0))
	return total

func _get_currency(currency_id: String) -> int:
	if save == null:
		return 0
	var snapshot = save.call("get_snapshot") as Dictionary
	var currencies = snapshot.get("currencies", {}) as Dictionary
	return int(currencies.get(currency_id, 0))

func _get_tool_condition(tool_id: String) -> int:
	if save == null:
		return int(tool_definitions.get(tool_id, {}).get("max_condition", 100))
	var snapshot = save.call("get_snapshot") as Dictionary
	var inventory = snapshot.get("inventory", {}) as Dictionary
	var stacks = inventory.get("item_stacks", {}) as Dictionary
	var stack_key := _find_stack_key(stacks, tool_id)
	if stack_key.is_empty():
		return 0  ## tool not owned
	var record = stacks[stack_key]
	if record is Dictionary:
		return int(record.get("condition", int(tool_definitions.get(tool_id, {}).get("max_condition", 100))))
	return 0

func _get_times_harvested(source_id: String) -> int:
	if save == null:
		return 0
	var snapshot = save.call("get_snapshot") as Dictionary
	var transactions = snapshot.get("applied_transactions", {}) as Dictionary
	var count := 0
	for raw_key: Variant in transactions.keys():
		var key := String(raw_key)
		if key.begins_with("harvest:%s:" % source_id):
			count += 1
	return count

func _record_harvest(source_id: String) -> void:
	## Harvest count is derived from SaveService transaction keys; nothing
	## to store in-memory. Kept for API symmetry.
	pass

func _wear_tool(tool_id: String, wear_amount: int) -> void:
	## Tool condition is stored on the inventory stack record via the
	## harvest mutator. In-memory tracking is not needed since SaveService
	## is the authority. Kept for API symmetry.
	pass

func _get_value(path: Array[String], fallback: Variant) -> Variant:
	if save == null:
		return fallback
	var cursor = save.call("get_snapshot") as Dictionary
	for segment: String in path:
		if not cursor is Dictionary or not cursor.has(segment):
			return fallback
		cursor = cursor[segment]
	return cursor

func _is_transaction_applied(transaction_key: String) -> bool:
	if save == null:
		return false
	return bool(save.call("is_transaction_applied", transaction_key))

func _grant_to_candidate(candidate: Dictionary, item_id: String, quantity: int) -> bool:
	var inventory = candidate.get("inventory", {}).duplicate(true)
	var stacks = inventory.get("item_stacks", {}).duplicate(true)
	var remaining := quantity
	var matching_keys := _find_matching_stack_keys(stacks, item_id)
	for stack_key: String in matching_keys:
		if remaining <= 0:
			break
		var record = stacks[stack_key] as Dictionary
		var current_qty := int(record.get("quantity", 0))
		var capacity := 50  ## MAX_INVENTORY_STACK_QUANTITY
		var space := capacity - current_qty
		if space <= 0:
			continue
		var added := min(remaining, space)
		record["quantity"] = current_qty + added
		stacks[stack_key] = record
		remaining -= added
	while remaining > 0:
		var stack_count := stacks.size()
		var souls = inventory.get("hero_souls", []) as Array
		var equipment = inventory.get("auxiliary_equipment", []) as Array
		var used := souls.size() + equipment.size() + stack_count
		if used >= 30:
			return false
		var stack_key := item_id
		var suffix := 2
		while stacks.has("%s_stack_%d" % [item_id, suffix]):
			suffix += 1
		stack_key = "%s_stack_%d" % [item_id, suffix]
		var added := min(remaining, 50)
		stacks[stack_key] = {"item_id": item_id, "kind": "material", "quantity": added}
		remaining -= added
	inventory["item_stacks"] = stacks
	candidate["inventory"] = inventory
	return true

func _find_matching_stack_keys(stacks: Dictionary, item_id: String) -> Array[String]:
	var matches := []
	if not stacks is Dictionary:
		return matches
	for raw_key: Variant in stacks.keys():
		var key := String(raw_key)
		var record = stacks[raw_key]
		if record is Dictionary and String(record.get("item_id", key)).strip_edges().to_lower() == item_id.strip_edges().to_lower():
			matches.append(key)
	matches.sort_custom(func(left: String, right: String) -> bool:
		if left == item_id:
			return true
		if right == item_id:
			return false
		return left.naturalnocasecmp_to(right) < 0
	)
	return matches

func _learn_recipe(recipe_id: String) -> void:
	learned_recipes[recipe_id] = true

func _is_recipe_known(recipe_id: String) -> bool:
	return bool(learned_recipes.get(recipe_id, false))

func _get_researchable_recipes() -> Array[String]:
	var result := []
	for recipe_id: String in recipes.keys():
		if not _is_recipe_known(recipe_id):
			result.append(recipe_id)
	return result

func _get_run_id() -> String:
	if save == null:
		return "default_run"
	var snapshot = save.call("get_snapshot") as Dictionary
	var revision := int(snapshot.get("revision", 0))
	return "run_%d" % revision

func _is_valid_item_id(item_id: String) -> bool:
	if item_id.is_empty() or item_id.length() > 64:
		return false
	const ALLOWED := "abcdefghijklmnopqrstuvwxyz0123456789_"
	for index: int in item_id.length():
		if ALLOWED.find(item_id[index]) < 0:
			return false
	return true

## --- Test support: seed a tool into inventory (tests only) ---

func grant_tool_for_test(tool_id: String, condition: int, transaction_key: String) -> bool:
	var tool_def = tool_definitions.get(tool_id, {})
	if tool_def.is_empty():
		return false
	if condition <= 0:
		condition = int(tool_def.get("max_condition", 100))
	var max_condition := int(tool_def.get("max_condition", 100))
	if condition > max_condition:
		condition = max_condition
	return _grant_to_candidate({ "inventory": { "item_stacks": {} } }, tool_id, 1) and _apply_tool_condition(tool_id, condition, transaction_key)

func _apply_tool_condition(tool_id: String, condition: int, transaction_key: String) -> bool:
	if save == null:
		return false
	var mutator := func(candidate: Dictionary) -> bool:
		var inventory = candidate.get("inventory", {}).duplicate(true)
		var stacks = inventory.get("item_stacks", {}).duplicate(true)
		var stack_key := _find_stack_key(stacks, tool_id)
		if stack_key.is_empty():
			return false
		var record = stacks[stack_key] as Dictionary
		record["condition"] = condition
		stacks[stack_key] = record
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory
		return true
	return bool(save.call("transact_once", transaction_key, mutator, {"kind": "a3_test_set_condition", "tool": tool_id}))

func grant_material_for_test(item_id: String, quantity: int, transaction_key: String) -> bool:
	if save == null:
		return false
	return bool(save.call("grant_inventory_item", item_id, "material", quantity, transaction_key, {}))

func grant_currency_for_test(currency_id: String, amount: int, transaction_key: String) -> bool:
	if save == null:
		return false
	var snapshot = save.call("get_snapshot") as Dictionary
	var currencies = snapshot.get("currencies", {}) as Dictionary
	var current := int(currencies.get(currency_id, 0))
	var mutator := func(candidate: Dictionary) -> bool:
		var c = candidate.get("currencies", {}).duplicate(true)
		c[currency_id] = int(c.get(currency_id, 0)) + amount
		candidate["currencies"] = c
		return true
	return bool(save.call("transact_once", transaction_key, mutator, {"kind": "a3_test_grant_currency", "currency": currency_id}))

func clear_learned_recipes() -> void:
	learned_recipes = {}

func clear_discoveries() -> void:
	run_discoveries = {}

## --- Test support: direct inventory manipulation ---

## Set inventory stacks directly (tests only). Validates each stack record.
func _set_inventory_stacks_for_test(stacks: Dictionary, transaction_key: String) -> bool:
	if save == null:
		return false
	## Validate stacks before committing
	for raw_key: Variant in stacks.keys():
		var key := String(raw_key)
		if not _is_valid_item_id(key):
			return false
		var record = stacks[raw_key]
		if not record is Dictionary:
			return false
		var kind := String(record.get("kind", ""))
		if kind not in ["material", "consumable", "blueprint", "key_item"]:
			return false
		var qty := int(record.get("quantity", 0))
		if qty < 1 or qty > 50:
			return false

	var mutator := func(candidate: Dictionary) -> bool:
		var inventory = candidate.get("inventory", {}).duplicate(true)
		inventory["item_stacks"] = stacks.duplicate(true)
		inventory["hero_souls"] = []
		inventory["auxiliary_equipment"] = []
		inventory["hero_soul_rules_version"] = 4
		inventory["auxiliary_equipment_version"] = 4
		candidate["inventory"] = inventory
		return true

	return bool(save.call("transact_once", transaction_key, mutator, {"kind": "a3_test_set_inventory_stacks"}))

## Clear all inventory stacks (tests only).
func _clear_inventory_for_test(transaction_key: String) -> bool:
	return _set_inventory_stacks_for_test({}, transaction_key)

## Grant a tool with a specific condition (tests only).
func _grant_tool_with_condition_for_test(tool_id: String, condition: int, transaction_key: String) -> bool:
	var tool_def = tool_definitions.get(tool_id, {})
	if tool_def.is_empty():
		return false
	if condition <= 0:
		condition = int(tool_def.get("max_condition", 100))
	var max_condition := int(tool_def.get("max_condition", 100))
	if condition > max_condition:
		condition = max_condition

	## First grant the item as a stack
	var stacks := {}
	stacks[tool_id] = {
		"item_id": tool_id,
		"kind": "material",
		"quantity": 1,
		"condition": condition,
	}
	return _set_inventory_stacks_for_test(stacks, transaction_key)
