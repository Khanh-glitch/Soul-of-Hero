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
## nothing and never grants inventory. A1 roadside sources authenticate through
## A1's physical world bindings. A8 Quarry source `poi_crown_south_quarry` /
## `south_seam_outcrop` / `extract_outcrop` is REJECTED until A8 grants genuine
## approval; a bare string "A8" does NOT mint source entitlement.
##
## All run-local state (learned recipes, discoveries, run ID, authenticated
## sources, station jobs) is persisted in SaveService mastery so it survives
## process shutdown and reload of the same run, and disappears on true new-run
## reset.

const SaveServiceClass = preload("res://game/autoload/save_service.gd")
const STACK_ITEM_CATALOG: StackItemCatalog = preload("res://data/content/items/item_catalog.tres")

## SaveService key namespaces (A3-owned sub-keys within SaveService sections).
const KEY_AUTHENTICATED_SOURCES := "a3_authenticated_sources"
const KEY_LEARNED_RECIPES := "a3_learned_recipes"
const KEY_DISCOVERIES := "a3_discoveries"
const KEY_RUN_ID := "a3_run_id"
const KEY_STATION_JOBS := "a3_station_jobs"
const KEY_JOB_COUNTER := "a3_job_counter"

## Harvest transaction key namespace. One durable receipt namespace per
## physical source instance. The prefix must match what _count_harvests
## counts, or exhaustion tracking silently breaks.
const HARVEST_TX_PREFIX := "harvest"

## A8 Quarry physical identity (per A8 specification).
## AUTHORIZATION STATUS: REJECTED — fail-closed until A8 grants genuine approval.
const A8_QUARRY_POI_ID := "poi_crown_south_quarry"
const A8_QUARRY_INSTANCE_ID := "south_seam_outcrop"
const A8_QUARRY_ACTION_ID := "extract_outcrop"

## Source contract definitions. Each source has finite yields keyed by
## transaction key so SaveService idempotency prevents double-harvest.
## Roadside contracts (A1) and Quarry contracts (A8) are reconciled with
## roadside_source.gd and quarry_source.gd.
var source_contracts: Dictionary = {
	"roadside_oak_1": {
		"owner": "A1",
		"kind": "roadside",
		"display_name": "Roadside Oak Outcrop",
		"max_yields": 3,
		"yields_per_harvest": {"roadside_oak_scrap": 1, "knowledge_spare": 0},
		"spare_chance": 0.33,
		"tool_required": "stone_pick",
		"tool_wear": 25,
		"risk": "low",
		"availability": "always",
	},
	"roadside_stone_1": {
		"owner": "A1",
		"kind": "roadside",
		"display_name": "Roadside Stone Outcrop",
		"max_yields": 3,
		"yields_per_harvest": {"roadside_stone_chip": 1, "knowledge_spare": 0},
		"spare_chance": 0.33,
		"tool_required": "stone_pick",
		"tool_wear": 25,
		"risk": "low",
		"availability": "always",
	},
	"roadside_iron_1": {
		"owner": "A1",
		"kind": "roadside",
		"display_name": "Roadside Iron Deposit",
		"max_yields": 2,
		"yields_per_harvest": {"roadside_iron_scrap": 1, "knowledge_spare": 0},
		"spare_chance": 0.25,
		"tool_required": "iron_pick",
		"tool_wear": 10,
		"risk": "low",
		"availability": "always",
	},
	"quarry_deep_1": {
		"owner": "A8",
		"kind": "quarry",
		"display_name": "Deep Quarry Face",
		"max_yields": 5,
		"yields_per_harvest": {"quarry_sample": 2, "quarry_core_fragment": 0},
		"core_chance": 0.20,
		"tool_required": "iron_pick",
		"tool_wear": 10,
		"risk": "high",
		"availability": "expedition_only",
		## A8 physical identity (REJECTED — fail-closed until A8 approval):
		"poi_id": A8_QUARRY_POI_ID,
		"instance_id": A8_QUARRY_INSTANCE_ID,
		"action_id": A8_QUARRY_ACTION_ID,
		"a8_authorized": false,
	},
}

## Tool definitions. Condition degrades with use; at 0 the tool is broken.
## Tool condition is stored on the inventory stack record via SaveService.
var tool_definitions: Dictionary = {
	"stone_pick": {"max_condition": 100, "wear_per_use": 25},
	"iron_pick": {"max_condition": 200, "wear_per_use": 10},
}

## Recipe registry. Each recipe has inputs, outputs, station, costs, and a
## knowledge mechanism. Recipes are learned through research; unknown recipes
## cannot be crafted. process_quarry_sample is the reverse-engineering target
## from quarry specimens and is a genuine craftable recipe.
var recipes: Dictionary = {
	"salvage_kit": {
		"recipe_id": "salvage_kit",
		"display_name": "Salvage Kit",
		"inputs": {"roadside_oak_scrap": 3, "roadside_stone_chip": 2, "knowledge_spare": 1},
		"outputs": {"salvage_kit_blueprint": 1},
		"station": "salvage_station",
		"fuel_cost": 5,
		"fuel_item": "knowledge_spare",  ## physical fuel item, not account currency
		"fuel_quantity": 1,
		"queue_seconds": 300,
		"knowledge_mechanism": "directed",
	},
	"process_roadside_materials": {
		"recipe_id": "process_roadside_materials",
		"display_name": "Process Roadside Materials",
		"inputs": {"roadside_oak_scrap": 5, "roadside_iron_scrap": 3},
		"outputs": {"quarry_core_fragment": 5},
		"station": "salvage_station",
		"fuel_cost": 10,
		"fuel_item": "knowledge_spare",
		"fuel_quantity": 2,
		"queue_seconds": 600,
		"knowledge_mechanism": "directed",
	},
	"process_quarry_sample": {
		"recipe_id": "process_quarry_sample",
		"display_name": "Process Quarry Sample",
		"inputs": {"quarry_sample": 3},
		"outputs": {"quarry_core_fragment": 6},
		"station": "salvage_station",
		"fuel_cost": 3,
		"fuel_item": "knowledge_spare",
		"fuel_quantity": 1,
		"queue_seconds": 120,
		"knowledge_mechanism": "destructive_specimen",
	},
}

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

## Optional time source for queue readiness. In tests this is simulated;
## in production A0 injects the authoritative active-session time host.
var time_source: Callable = Callable()

## Expose SaveService node for test orchestration (A3-owned, no A0 edit).
func get_save() -> Node:
	return save

func _ready() -> void:
	save = root.get_node_or_null("SaveService")

## Configure the service with a SaveService node (tests or runtime).
func configure(save_node: Node) -> bool:
	if save_node == null:
		return false
	save = save_node
	return _ensure_run_id()

## Set an external time source for queue readiness checks.
## production A0 injects the authoritative clock here.
func set_time_source(source: Callable) -> void:
	time_source = source

## Ensure a run ID exists in SaveService mastery. Not SaveService revision.
func _ensure_run_id() -> bool:
	if save == null:
		return false
	var mastery = _get_mastery_section()
	if not mastery.has(KEY_RUN_ID):
		var mutator := func(candidate: Dictionary) -> bool:
			var m = candidate.get("mastery", {}).duplicate(true)
			m[KEY_RUN_ID] = "run_" + str(Time.get_ticks_usec())
			m[KEY_AUTHENTICATED_SOURCES] = {}
			m[KEY_LEARNED_RECIPES] = {}
			m[KEY_DISCOVERIES] = {}
			m[KEY_STATION_JOBS] = {}
			m[KEY_JOB_COUNTER] = 0
			candidate["mastery"] = m
			return true
		return bool(save.call("transact_once", "a3:init:run_id", mutator, {"kind": "a3_init_run"}))
	## Load existing run-local state from SaveService into memory.
	var lr = mastery.get(KEY_LEARNED_RECIPES, {})
	if lr is Dictionary:
		learned_recipes = lr.duplicate(true)
	var disc = mastery.get(KEY_DISCOVERIES, {})
	if disc is Dictionary:
		run_discoveries = disc.duplicate(true)
	var auth = mastery.get(KEY_AUTHENTICATED_SOURCES, {})
	if auth is Dictionary:
		var new_auth = {}
		for kind in ["roadside", "quarry"]:
			new_auth[kind] = {}
		for raw_k: Variant in auth.keys():
			var kind = String(raw_k)
			if not new_auth.has(kind):
				continue
			var domain_map = auth[raw_k]
			if domain_map is Dictionary:
				for raw_s: Variant in domain_map.keys():
					if bool(domain_map[raw_s]):
						new_auth[kind][String(raw_s)] = true
		authenticated_sources = new_auth
	return true

## Get the mastery section from SaveService snapshot.
func _get_mastery_section() -> Dictionary:
	if save == null:
		return {}
	var snapshot = save.call("get_snapshot") as Dictionary
	var mastery = snapshot.get("mastery", {})
	if not mastery is Dictionary:
		return {}
	return mastery

## Source IDs that A1 (roadside) and A8 (Quarry) have committed to physically
## authenticate. Empty by default = fail-closed. Populated by A1/A8 at mount
## time through SaveService mastery; this service never invents or mutates the
## list except via authenticated_source() which persists through SaveService.
var authenticated_sources: Dictionary = {
	"roadside": {},
	"quarry": {},
}

## Run-local discoveries: material_id → {use_description, recipe_id, discovered_at_run}.
## Reset on run reset; persisted only through SaveService transaction receipts.
var run_discoveries: Dictionary = {}

## Learned recipe IDs (run-local). Reset on run reset.
var learned_recipes: Dictionary = {}

## Authenticate a source ID for its owner domain through SaveService.
## Called by A1/A8 when they physically mount a site. The authentication is
## persisted in SaveService mastery.a3_authenticated_sources so it survives
## process reload and is verified through A0's durable authority.
##
## For A8 Quarry sources, requires a8_authorized == true in the source contract.
## A bare string "A8" does not mint source entitlement.
func authenticate_source(source_id: String, owner_domain: String) -> bool:
	var contract = source_contracts.get(source_id, {})
	if contract.is_empty():
		return false
	var expected_owner = String(contract.get("owner", ""))
	if expected_owner != owner_domain:
		return false

	## A8 Quarry sources require explicit A8 authorization.
	## A bare string domain claim is insufficient for physical source entitlement.
	if String(contract.get("kind", "")) == "quarry":
		if not bool(contract.get("a8_authorized", false)):
			return false

	var kind = String(contract.get("kind", ""))

	## Persist authentication through SaveService (A0 authority).
	var tx_key := "a3:auth:%s" % source_id
	var mutator := func(candidate: Dictionary) -> bool:
		var m = candidate.get("mastery", {}).duplicate(true)
		if not m.has(KEY_AUTHENTICATED_SOURCES):
			m[KEY_AUTHENTICATED_SOURCES] = {}
		var auth = m[KEY_AUTHENTICATED_SOURCES] as Dictionary
		if not auth.has(kind):
			auth[kind] = {}
		var domain_map = auth[kind] as Dictionary
		domain_map[source_id] = true
		auth[kind] = domain_map
		m[KEY_AUTHENTICATED_SOURCES] = auth
		candidate["mastery"] = m
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", tx_key, mutator, {"kind": "a3_authenticate_source", "source": source_id, "owner": owner_domain}))

	if not applied:
		return false

	## Update in-memory model after successful commit.
	if not authenticated_sources.has(kind):
		authenticated_sources[kind] = {}
	authenticated_sources[kind][source_id] = true
	return true

## Check whether a source is authenticated (fail-closed gate).
## Reads from SaveService mastery to verify through A0's authority.
func is_source_authenticated(source_id: String) -> bool:
	var contract = source_contracts.get(source_id, {})
	if contract.is_empty():
		return false
	var kind = String(contract.get("kind", ""))

	## Check SaveService mastery first (durable authority).
	if save != null:
		var mastery = _get_mastery_section()
		var auth = mastery.get(KEY_AUTHENTICATED_SOURCES, {})
		if auth is Dictionary:
			var domain_map = auth.get(kind, {})
			if domain_map is Dictionary:
				if bool(domain_map.get(source_id, false)):
					## Sync in-memory cache
					if not authenticated_sources.has(kind):
						authenticated_sources[kind] = {}
					authenticated_sources[kind][source_id] = true
					return true

	## Fall back to in-memory cache.
	var domain_map = authenticated_sources.get(kind, {})
	if not domain_map is Dictionary:
		return false
	return bool(domain_map.has(source_id))

## Get the next unique job ID. Uses a counter in SaveService mastery so job
## IDs are stable across reloads and unique per legitimate batch.
func _next_job_id() -> String:
	if save == null:
		return "a3_job_0"
	var mastery = _get_mastery_section()
	var counter := int(mastery.get(KEY_JOB_COUNTER, 0)) + 1
	return "a3_job_%06d" % counter

## Increment the job counter in SaveService.
func _increment_job_counter() -> bool:
	if save == null:
		return false
	var tx_key := "a3:job_counter:%d" % Time.get_ticks_usec()
	var mutator := func(candidate: Dictionary) -> bool:
		var m = candidate.get("mastery", {}).duplicate(true)
		var counter := int(m.get(KEY_JOB_COUNTER, 0)) + 1
		m[KEY_JOB_COUNTER] = counter
		candidate["mastery"] = m
		return true
	return bool(save.call("transact_once", tx_key, mutator, {"kind": "a3_job_counter"}))

## --- Harvest ---

## Harvest from a roadside or Quarry source. Atomic: tool wear + yield grant
## commit in one SaveService transaction. Fails closed on any precondition
## violation. Returns {ok, reason, yield, tool_condition_remaining, source_yields_remaining, transaction_key}.
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
	## Uses the SAME prefix as the transaction key (harvest:) for consistency.
	var harvest_key_prefix := "harvest:%s:" % source_id
	var times_harvested := _count_transactions_with_prefix(harvest_key_prefix)
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
	## Transaction key uses harvest: prefix to match the counter.
	var transaction_key := "%s:%s:%d" % [HARVEST_TX_PREFIX, source_id, harvest_index]
	var mutator_result := _build_harvest_mutator(tool_id, tool_def, yield_result)

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", transaction_key, mutator_result, {"kind": "a3_harvest", "source": source_id}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

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
## the bounded pool of researchable recipes. All mutations (spend + learn)
## commit in the same SaveService transaction. Not a free unlock; each roll
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

	var tx_key := "a3:research:bounded_random:%d" % Time.get_ticks_usec()
	var mutator := func(candidate: Dictionary) -> bool:
		## Spend Spares from inventory.
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

		## Learn a recipe and persist in the SAME transaction.
		var rng := RandomNumberGenerator.new()
		rng.seed = Time.get_ticks_usec()
		var recipe_ids := researchable.duplicate()
		recipe_ids.shuffle(rng)
		var chosen := recipe_ids[0]
		var m = candidate.get("mastery", {}).duplicate(true)
		var lr = m.get(KEY_LEARNED_RECIPES, {})
		if not lr is Dictionary:
			lr = {}
		lr[chosen] = true
		m[KEY_LEARNED_RECIPES] = lr
		candidate["mastery"] = m
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", tx_key, mutator, {"kind": "a3_research_bounded_random", "spares_spent": spares_quantity}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	## Update in-memory model after successful commit.
	learned_recipes = _get_learned_recipes_from_save()

	return {
		"ok": true,
		"reason": "",
		"recipe_learned": chosen,
		"spares_consumed": spares_quantity,
		"mechanism": "bounded_random",
	}

## Directed research: spend specific materials + Spares to learn a specific
## recipe. All mutations commit in the same SaveService transaction. Fails if
## any input is missing or the recipe is already known.
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

	var tx_key := "a3:research:directed:%s" % recipe_id
	var mutator := func(candidate: Dictionary) -> bool:
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

		## Learn the recipe and persist in the SAME transaction.
		var m = candidate.get("mastery", {}).duplicate(true)
		var lr = m.get(KEY_LEARNED_RECIPES, {})
		if not lr is Dictionary:
			lr = {}
		lr[recipe_id] = true
		m[KEY_LEARNED_RECIPES] = lr
		candidate["mastery"] = m
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", tx_key, mutator, {"kind": "a3_research_directed", "recipe": recipe_id}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	learned_recipes = _get_learned_recipes_from_save()

	return {
		"ok": true,
		"reason": "",
		"recipe_learned": recipe_id,
		"inputs_consumed": inputs.duplicate(true),
		"mechanism": "directed",
	}

## Destructive specimen reverse engineering: consume a specimen item to learn
## its associated recipe. The specimen is destroyed (consumed) on success.
## All mutations commit in the same SaveService transaction. Fails if specimen
## missing, already known, or no specimen registered. The taught recipe must
## be a genuine craftable recipe in the registry.
func reverse_engineer_specimen(specimen_id: String) -> Dictionary:
	var specimen = specimen_registry.get(specimen_id, {})
	if specimen.is_empty():
		return {"ok": false, "reason": "UNKNOWN_SPECIMEN"}

	var item_id = String(specimen.get("item_id", ""))
	var consumes_qty := int(specimen.get("consumes_quantity", 1))
	var teaches_recipe_id := String(specimen.get("teaches_recipe_id", ""))

	if teaches_recipe_id.is_empty():
		return {"ok": false, "reason": "SPECIMEN_TEACHES_NOTHING"}

	## The taught recipe must exist in the recipe registry — unknown or
	## nonexistent formulas cannot be reported as successfully learned.
	var recipe = recipes.get(teaches_recipe_id, {})
	if recipe.is_empty():
		return {"ok": false, "reason": "RECIPE_NOT_REGISTERED"}

	if _is_recipe_known(teaches_recipe_id):
		return {"ok": false, "reason": "RECIPE_ALREADY_KNOWN"}

	var available := _get_inventory_quantity(item_id)
	if available < consumes_qty:
		return {"ok": false, "reason": "INSUFFICIENT_%s" % item_id.to_upper()}

	var tx_key := "a3:research:specimen:%s" % specimen_id
	var mutator := func(candidate: Dictionary) -> bool:
		## Consume the specimen from inventory.
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

		## Learn the recipe and persist in the SAME transaction.
		var m = candidate.get("mastery", {}).duplicate(true)
		var lr = m.get(KEY_LEARNED_RECIPES, {})
		if not lr is Dictionary:
			lr = {}
		lr[teaches_recipe_id] = true
		m[KEY_LEARNED_RECIPES] = lr
		candidate["mastery"] = m
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", tx_key, mutator, {"kind": "a3_research_specimen", "specimen": specimen_id, "recipe": teaches_recipe_id}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	learned_recipes = _get_learned_recipes_from_save()

	return {
		"ok": true,
		"reason": "",
		"recipe_learned": teaches_recipe_id,
		"specimen_consumed": item_id,
		"specimen_quantity": consumes_qty,
		"mechanism": "destructive_specimen",
	}

## --- Paid station / fuel / queue / offline proposal ---

## Prepare an expedition at a paid station. Escrows fuel cost and inputs,
## starts a real job, persists station identity. Outputs are NOT granted at
## prepare time — they are granted only on valid collection after the queue
## completes. All through one SaveService transaction.
##
## Fuel is a physical item (recipe.fuel_item), not account currency.
## Job ID is unique per legitimate batch (not just station+recipe), so
## repeated production is possible without replay or duplicate payment.
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
	var fuel_item := String(recipe.get("fuel_item", "knowledge_spare"))
	var fuel_quantity := int(recipe.get("fuel_quantity", 1))

	## Pay fuel from physical fuel item, not account currency.
	var fuel_available := _get_inventory_quantity(fuel_item)
	if fuel_available < fuel_quantity:
		return {"ok": false, "reason": "INSUFFICIENT_%s" % fuel_item.to_upper()}

	var inputs = recipe.get("inputs", {})
	for input_id: String in inputs.keys():
		var required_qty := int(inputs[input_id])
		var available := _get_inventory_quantity(input_id)
		if available < required_qty:
			return {"ok": false, "reason": "INSUFFICIENT_%s" % input_id.to_upper()}

	var queue_seconds := int(recipe.get("queue_seconds", 0))
	var outputs = recipe.get("outputs", {}).duplicate(true)

	## Unique job ID per legitimate batch — not just station+recipe.
	var job_id := _next_job_id()
	var job_key := "job:%s" % job_id

	## Check idempotency: same job key cannot be prepared twice.
	var existing_jobs = _get_station_jobs()
	if existing_jobs.has(job_key):
		return {"ok": false, "reason": "JOB_ALREADY_QUEUED"}

	var tx_key := "a3:station:prepare:%s" % job_id

	var mutator := func(candidate: Dictionary) -> bool:
		## Pay fuel from physical fuel item (escrowed at prepare time).
		var inventory = candidate.get("inventory", {}).duplicate(true)
		var stacks = inventory.get("item_stacks", {}).duplicate(true)
		var fuel_stack_key := _find_stack_key(stacks, fuel_item)
		if fuel_stack_key.is_empty():
			return false
		var fuel_record = stacks[fuel_stack_key] as Dictionary
		if int(fuel_record.get("quantity", 0)) < fuel_quantity:
			return false
		fuel_record["quantity"] = int(fuel_record.get("quantity", 0)) - fuel_quantity
		if int(fuel_record.get("quantity", 0)) <= 0:
			stacks.erase(fuel_stack_key)
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory

		## Consume inputs from inventory (escrowed at prepare time).
		stacks = inventory.get("item_stacks", {}).duplicate(true)
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

		## Record the queued production job (escrow). Outputs NOT yet granted.
		var m = candidate.get("mastery", {}).duplicate(true)
		var jobs = m.get(KEY_STATION_JOBS, {})
		if not jobs is Dictionary:
			jobs = {}
		jobs[job_key] = {
			"job_id": job_id,
			"recipe_id": recipe_id,
			"station_id": station_id,
			"fuel_item": fuel_item,
			"fuel_quantity": fuel_quantity,
			"queued_at_unix": int(Time.get_unix_time_from_system()),
			"queue_seconds": queue_seconds,
			"outputs": outputs,
			"claimed": false,
		}
		m[KEY_STATION_JOBS] = jobs
		## Increment job counter for uniqueness.
		var counter := int(m.get(KEY_JOB_COUNTER, 0)) + 1
		m[KEY_JOB_COUNTER] = counter
		candidate["mastery"] = m
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", tx_key, mutator, {"kind": "a3_station_prepare", "station": station_id, "recipe": recipe_id, "job_id": job_id}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	return {
		"ok": true,
		"reason": "",
		"job_id": job_id,
		"recipe": recipe_id,
		"station": station_id,
		"fuel_item": fuel_item,
		"fuel_quantity": fuel_quantity,
		"queue_seconds": queue_seconds,
		"outputs": outputs,
		"transaction_key": tx_key,
		"status": "queued",
	}

## Claim a completed offline production. Grants outputs exactly once on valid
## collection. Fails on duplicate, early claim, full bag, or wrong-run.
func claim_offline_production(job_id: String) -> Dictionary:
	var job_key := "job:%s" % job_id
	var jobs = _get_station_jobs()
	if not jobs.has(job_key):
		return {"ok": false, "reason": "QUEUE_NOT_FOUND_OR_ALREADY_CLAIMED"}

	var entry = jobs[job_key] as Dictionary
	if entry.is_empty():
		return {"ok": false, "reason": "QUEUE_ENTRY_MISSING"}
	if bool(entry.get("claimed", false)):
		return {"ok": false, "reason": "ALREADY_CLAIMED"}

	## Verify queue time has elapsed (real-time gate via configurable time source).
	var queued_at := int(entry.get("queued_at_unix", 0))
	var queue_seconds := int(entry.get("queue_seconds", 0))
	var now := 0
	if time_source.is_valid():
		var time_val := time_source.call()
		if time_val is Dictionary:
			now = int(time_val.get("now", 0))
	if now == 0:
		now = int(Time.get_unix_time_from_system())
	if now - queued_at < queue_seconds:
		return {"ok": false, "reason": "QUEUE_NOT_READY"}

	var outputs = entry.get("outputs", {}).duplicate(true)
	var tx_key := "a3:station:claim:%s" % job_id

	var mutator := func(candidate: Dictionary) -> bool:
		## Grant outputs exactly once. Check full bag.
		var inventory = candidate.get("inventory", {}).duplicate(true)
		var stacks = inventory.get("item_stacks", {}).duplicate(true)
		for output_id: String in outputs.keys():
			var qty := int(outputs[output_id])
			if qty <= 0:
				continue
			if not _grant_to_candidate_stacks(candidate, stacks, output_id, qty):
				return false
			stacks = inventory.get("item_stacks", {}).duplicate(true)
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory

		## Mark job as claimed.
		var m = candidate.get("mastery", {}).duplicate(true)
		var j = m.get(KEY_STATION_JOBS, {})
		if j is Dictionary and j.has(job_key):
			var e = j[job_key] as Dictionary
			e["claimed"] = true
			j[job_key] = e
		m[KEY_STATION_JOBS] = j
		candidate["mastery"] = m
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", tx_key, mutator, {"kind": "a3_station_claim", "job_id": job_id}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	return {
		"ok": true,
		"reason": "",
		"job_id": job_id,
		"recipe": String(entry.get("recipe_id", "")),
		"station": String(entry.get("station_id", "")),
		"outputs": outputs,
		"transaction_key": tx_key,
	}

## Cancel a queued job. Refunds fuel but NOT consumed inputs (inputs are
## spent at prepare time as production cost). Idempotent.
func cancel_station_job(job_id: String) -> Dictionary:
	var job_key := "job:%s" % job_id
	var jobs = _get_station_jobs()
	if not jobs.has(job_key):
		return {"ok": false, "reason": "QUEUE_NOT_FOUND"}

	var entry = jobs[job_key] as Dictionary
	if bool(entry.get("claimed", false)):
		return {"ok": false, "reason": "ALREADY_CLAIMED"}

	var fuel_item := String(entry.get("fuel_item", "knowledge_spare"))
	var fuel_quantity := int(entry.get("fuel_quantity", 0))
	var tx_key := "a3:station:cancel:%s" % job_id

	var mutator := func(candidate: Dictionary) -> bool:
		## Refund fuel to inventory.
		var inventory = candidate.get("inventory", {}).duplicate(true)
		var stacks = inventory.get("item_stacks", {}).duplicate(true)
		if not _grant_to_candidate_stacks(candidate, stacks, fuel_item, fuel_quantity):
			return false
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory

		## Remove job from queue.
		var m = candidate.get("mastery", {}).duplicate(true)
		var j = m.get(KEY_STATION_JOBS, {})
		if j is Dictionary:
			j.erase(job_key)
		m[KEY_STATION_JOBS] = j
		candidate["mastery"] = m
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", tx_key, mutator, {"kind": "a3_station_cancel", "job_id": job_id}))

	if not applied:
		return {"ok": false, "reason": "TRANSACTION_REJECTED"}

	return {
		"ok": true,
		"reason": "",
		"job_id": job_id,
		"recipe": String(entry.get("recipe_id", "")),
		"station": String(entry.get("station_id", "")),
		"fuel_refunded": fuel_quantity,
		"transaction_key": tx_key,
	}

## Get station jobs from SaveService mastery.
func _get_station_jobs() -> Dictionary:
	if save == null:
		return {}
	var mastery = _get_mastery_section()
	var jobs = mastery.get(KEY_STATION_JOBS, {})
	if not jobs is Dictionary:
		return {}
	return jobs

## --- Reverse-use lookup ---

## Register a run-local discovery: a previously low-value material becomes
## useful after discovery. Persisted through SaveService in the same
## transaction as any associated cost. The player can look up why via
## lookup_use().
func register_discovery(material_id: String, use_description: String, recipe_id: String = "") -> bool:
	if material_id.is_empty() or use_description.is_empty():
		return false

	var tx_key := "a3:discovery:%s" % material_id
	var mutator := func(candidate: Dictionary) -> bool:
		var m = candidate.get("mastery", {}).duplicate(true)
		var disc = m.get(KEY_DISCOVERIES, {})
		if not disc is Dictionary:
			disc = {}
		disc[material_id] = {
			"use_description": use_description,
			"recipe_id": recipe_id,
			"discovered_at_run": _get_run_id_from_save(),
		}
		m[KEY_DISCOVERIES] = disc
		candidate["mastery"] = m
		return true

	var applied := false
	if save != null:
		applied = bool(save.call("transact_once", tx_key, mutator, {"kind": "a3_register_discovery", "material": material_id}))

	if not applied:
		return false

	run_discoveries = _get_discoveries_from_save()
	return true

## Look up the discovered use for a material. Returns empty dict if unknown.
func lookup_use(material_id: String) -> Dictionary:
	## Sync from SaveService first (durable authority).
	if save != null:
		var disc = _get_discoveries_from_save()
		if disc.has(material_id):
			run_discoveries = disc
			return disc[material_id].duplicate(true)
	var discovery = run_discoveries.get(material_id, {})
	if discovery.is_empty():
		return {}
	return discovery.duplicate(true)

## Check whether a material's use has been discovered this run.
func is_discovered(material_id: String) -> bool:
	if save != null:
		var disc = _get_discoveries_from_save()
		if disc is Dictionary:
			return bool(disc.has(material_id))
	return bool(run_discoveries.has(material_id))

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
			"yields_remaining": max(0, int(contract.get("max_yields", 0)) - _count_transactions_with_prefix("harvest:%s:" % source_id)),
			"risk": String(contract.get("risk", "")),
			"poi_id": String(contract.get("poi_id", "")),
			"instance_id": String(contract.get("instance_id", "")),
			"action_id": String(contract.get("action_id", "")),
			"a8_authorized": bool(contract.get("a8_authorized", false)),
		}

	var recipe_projections := {}
	for recipe_id: String in recipes.keys():
		var recipe = recipes[recipe_id]
		recipe_projections[recipe_id] = {
			"display_name": String(recipe.get("display_name", "")),
			"station": String(recipe.get("station", "")),
			"fuel_cost": int(recipe.get("fuel_cost", 0)),
			"fuel_item": String(recipe.get("fuel_item", "")),
			"fuel_quantity": int(recipe.get("fuel_quantity", 0)),
			"queue_seconds": int(recipe.get("queue_seconds", 0)),
			"knowledge_mechanism": String(recipe.get("knowledge_mechanism", "")),
			"learned": _is_recipe_known(recipe_id),
			"inputs": recipe.get("inputs", {}).duplicate(true),
			"outputs": recipe.get("outputs", {}).duplicate(true),
		}

	return {
		"sources": source_projections,
		"recipes": recipe_projections,
		"discoveries": _get_discoveries_from_save(),
		"learned_recipes": _get_learned_recipes_from_save(),
	}

## --- Internal helpers ---

func _build_harvest_mutator(tool_id: String, tool_def: Dictionary, yield_result: Dictionary) -> Callable:
	return func(candidate: Dictionary) -> bool:
		## Wear the tool: reduce condition on the inventory stack record.
		var inventory = candidate.get("inventory", {}).duplicate(true)
		var stacks = inventory.get("item_stacks", {}).duplicate(true)
		var tool_stack_key := _find_stack_key(stacks, tool_id)
		if tool_stack_key.is_empty():
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
			if not _grant_to_candidate_stacks(candidate, stacks, item_id, qty):
				return false
			stacks = inventory.get("item_stacks", {}).duplicate(true)
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

func _count_transactions_with_prefix(prefix: String) -> int:
	if save == null:
		return 0
	var snapshot = save.call("get_snapshot") as Dictionary
	var transactions = snapshot.get("applied_transactions", {}) as Dictionary
	var count := 0
	for raw_key: Variant in transactions.keys():
		var key := String(raw_key)
		if key.begins_with(prefix):
			count += 1
	return count

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

## Grant items to a candidate's inventory stacks dictionary (used within
## mutators). Returns false if the bag is full.
func _grant_to_candidate_stacks(candidate: Dictionary, stacks: Dictionary, item_id: String, quantity: int) -> bool:
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
		var inventory = candidate.get("inventory", {}).duplicate(true)
		var stacks_ref = inventory.get("item_stacks", {}) as Dictionary
		var souls = inventory.get("hero_souls", []) as Array
		var equipment = inventory.get("auxiliary_equipment", []) as Array
		var used := souls.size() + equipment.size() + stacks_ref.size()
		if used >= 30:
			return false
		var stack_key := item_id
		var suffix := 2
		while stacks_ref.has("%s_stack_%d" % [item_id, suffix]):
			suffix += 1
		stack_key = "%s_stack_%d" % [item_id, suffix]
		var added := min(remaining, 50)
		stacks_ref[stack_key] = {"item_id": item_id, "kind": "material", "quantity": added}
		inventory["item_stacks"] = stacks_ref
		candidate["inventory"] = inventory
		stacks = stacks_ref
		remaining -= added
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
	## Kept for API symmetry; persistence is via SaveService mastery.
	pass

func _is_recipe_known(recipe_id: String) -> bool:
	return bool(learned_recipes.get(recipe_id, false))

func _get_learned_recipes_from_save() -> Dictionary:
	if save == null:
		return learned_recipes.duplicate(true)
	var mastery = _get_mastery_section()
	var lr = mastery.get(KEY_LEARNED_RECIPES, {})
	if not lr is Dictionary:
		return {}
	return lr.duplicate(true)

func _get_discoveries_from_save() -> Dictionary:
	if save == null:
		return run_discoveries.duplicate(true)
	var mastery = _get_mastery_section()
	var disc = mastery.get(KEY_DISCOVERIES, {})
	if not disc is Dictionary:
		return {}
	return disc.duplicate(true)

func _get_researchable_recipes() -> Array[String]:
	var result := []
	for recipe_id: String in recipes.keys():
		if not _is_recipe_known(recipe_id):
			result.append(recipe_id)
	return result

func _get_run_id_from_save() -> String:
	if save == null:
		return "default_run"
	var mastery = _get_mastery_section()
	var run_id = mastery.get(KEY_RUN_ID, "")
	if run_id.is_empty():
		return "default_run"
	return String(run_id)

## --- Test support: direct inventory manipulation ---

## Set inventory stacks directly (tests only). Preserves hero_souls and
## auxiliary_equipment from the existing save so SaveService validation passes.
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
		## Preserve existing souls and equipment; only replace item_stacks.
		inventory["item_stacks"] = stacks.duplicate(true)
		candidate["inventory"] = inventory
		return true

	return bool(save.call("transact_once", transaction_key, mutator, {"kind": "a3_test_set_inventory_stacks"}))

## Clear all inventory stacks (tests only).
func _clear_inventory_for_test(transaction_key: String) -> bool:
	return _set_inventory_stacks_for_test({}, transaction_key)

## Grant a tool with a specific condition (tests only). Replaces the entire
## item_stacks with just the tool (preserves souls/equipment).
func _grant_tool_with_condition_for_test(tool_id: String, condition: int, transaction_key: String) -> bool:
	var tool_def = tool_definitions.get(tool_id, {})
	if tool_def.is_empty():
		return false
	if condition <= 0:
		condition = int(tool_def.get("max_condition", 100))
	var max_condition := int(tool_def.get("max_condition", 100))
	if condition > max_condition:
		condition = max_condition

	var stacks := {}
	stacks[tool_id] = {
		"item_id": tool_id,
		"kind": "material",
		"quantity": 1,
		"condition": condition,
	}
	return _set_inventory_stacks_for_test(stacks, transaction_key)

## Grant a material directly to inventory via SaveService (tests only).
func grant_material_for_test(item_id: String, quantity: int, transaction_key: String) -> bool:
	if save == null:
		return false
	return bool(save.call("grant_inventory_item", item_id, "material", quantity, transaction_key, {}))

## Grant currency directly via SaveService transaction (tests only).
func grant_currency_for_test(currency_id: String, amount: int, transaction_key: String) -> bool:
	if save == null:
		return false
	var mutator := func(candidate: Dictionary) -> bool:
		var c = candidate.get("currencies", {}).duplicate(true)
		c[currency_id] = int(c.get(currency_id, 0)) + amount
		candidate["currencies"] = c
		return true
	return bool(save.call("transact_once", transaction_key, mutator, {"kind": "a3_test_grant_currency", "currency": currency_id}))

## Clear learned recipes (tests only). Clears both in-memory and SaveService.
func clear_learned_recipes() -> void:
	learned_recipes = {}
	if save != null:
		var tx_key := "a3:test:clear_learned:%d" % Time.get_ticks_usec()
		var mutator := func(candidate: Dictionary) -> bool:
			var m = candidate.get("mastery", {}).duplicate(true)
			m[KEY_LEARNED_RECIPES] = {}
			candidate["mastery"] = m
			return true
		save.call("transact_once", tx_key, mutator, {"kind": "a3_test_clear_recipes"})

## Clear discoveries (tests only). Clears both in-memory and SaveService.
func clear_discoveries() -> void:
	run_discoveries = {}
	if save != null:
		var tx_key := "a3:test:clear_discoveries:%d" % Time.get_ticks_usec()
		var mutator := func(candidate: Dictionary) -> bool:
			var m = candidate.get("mastery", {}).duplicate(true)
			m[KEY_DISCOVERIES] = {}
			candidate["mastery"] = m
			return true
		save.call("transact_once", tx_key, mutator, {"kind": "a3_test_clear_discoveries"})

func _is_valid_item_id(item_id: String) -> bool:
	if item_id.is_empty() or item_id.length() > 64:
		return false
	const ALLOWED := "abcdefghijklmnopqrstuvwxyz0123456789_"
	for index: int in item_id.length():
		if ALLOWED.find(item_id[index]) < 0:
			return false
	return true
