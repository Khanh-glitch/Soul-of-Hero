extends Node

## A0 survival foundation service — the single seam every survival system uses.
##
## ## What this owns
##
## * The survival document inside the authoritative save (`save["survival"]`).
## * Resource node state, harvest accounting and depletion/respawn.
## * Placed structures and their contents.
## * Permanent recipe knowledge (learned *recipes* — not items, not blueprints).
##
## ## What this deliberately does NOT own
##
## * The inventory. [LivingArsenalSaveService] remains the one inventory authority;
##   this service mutates it only through `add_items_to_candidate` /
##   `remove_items_from_candidate` inside a transaction this service opened.
## * The world. Terrain, collision and route safety are queried from the overworld
##   through [method place_structure]'s `spatial_validator`, because the autoload
##   must keep working when no overworld is mounted (tests, home screen, dungeons).
##
## ## Contract
##
## Every mutating method here opens exactly one `SaveService.transact_once()`. The
## mutator validates *and* applies: resource hit, payment, inventory grant and
## entity creation all happen against one candidate document, which is committed
## once with a transaction receipt. A rejected mutator leaves the committed save
## byte-identical — no partial payment, no free structure, no lost material.
##
## See docs/survival/CONTRACTS.md CT-02, CT-03, CT-06, CT-07 for the contract ids.

signal harvested(node_id: String, item_id: String, quantity: int, hits_left: int)
signal resource_depleted(node_id: String)
signal structure_placed(entity_id: String, piece_id: String, cell: Vector2i)
signal structure_removed(entity_id: String)
signal transaction_rejected(reason: String)
signal survival_state_changed()

const CATALOG_PATH := "res://data/survival/survival_catalog.json"
const TX_BUILD_PREFIX := "survival.build."
const TX_HARVEST_PREFIX := "survival.harvest."
const TX_TRANSFER_PREFIX := "survival.transfer."
const TX_RESEARCH_PREFIX := "survival.research."
## Mirrors `SaveService.MAX_INVENTORY_STACK_QUANTITY`; a chest slot holds exactly
## one inventory stack, so storing more than this in one item would create a
## container the bag could never take back.
const MAX_STACK_PER_SLOT := 50

var catalog: Dictionary = {}
var _catalog_error := ""


func _ready() -> void:
	load_catalog()


func load_catalog() -> bool:
	_catalog_error = ""
	if not FileAccess.file_exists(CATALOG_PATH):
		_catalog_error = "Missing survival catalog at %s." % CATALOG_PATH
		push_error(_catalog_error)
		return false
	var file := FileAccess.open(CATALOG_PATH, FileAccess.READ)
	if file == null:
		_catalog_error = "Unreadable survival catalog at %s." % CATALOG_PATH
		push_error(_catalog_error)
		return false
	var text := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if not parsed is Dictionary:
		_catalog_error = "Survival catalog is not a JSON object."
		push_error(_catalog_error)
		return false
	catalog = parsed as Dictionary
	if not catalog.get("items") is Dictionary or not catalog.get("pieces") is Dictionary:
		_catalog_error = "Survival catalog is missing items or pieces."
		push_error(_catalog_error)
		return false
	return true


func catalog_error() -> String:
	return _catalog_error


func item_definition(item_id: String) -> Dictionary:
	var items: Dictionary = catalog.get("items", {})
	return items.get(item_id, {})


func resource_definition(kind: String) -> Dictionary:
	var resources: Dictionary = catalog.get("resources", {})
	return resources.get(kind, {})


func piece_definition(piece_id: String) -> Dictionary:
	var pieces: Dictionary = catalog.get("pieces", {})
	return pieces.get(piece_id, {})


func piece_ids() -> Array[String]:
	var pieces: Dictionary = catalog.get("pieces", {})
	var out: Array[String] = []
	for key: Variant in pieces.keys():
		out.append(String(key))
	out.sort()
	return out


func rule(key: String, fallback: Variant) -> Variant:
	var rules: Dictionary = catalog.get("rules", {})
	return rules.get(key, fallback)


# ---------------------------------------------------------------------------
# reads — always a copy, never the live document
# ---------------------------------------------------------------------------
func _save() -> Node:
	return get_node_or_null("/root/SaveService")


## The survival document as currently committed, sanitized for reading.
func document() -> Dictionary:
	var save := _save()
	if save == null:
		return SurvivalStateData.empty_document()
	var raw: Variant = save.call(&"get_value", SurvivalStateData.SAVE_PATH, {})
	return SurvivalStateData.sanitize(raw)


## Current state of one resource node, with default `hits_left` for a node that
## has never been touched. Read-only: a node's respawn is applied inside
## [method harvest]'s transaction, not by mutating state from a getter.
func resource_state(node_id: String, kind: String) -> Dictionary:
	var document := document()
	var nodes: Dictionary = document.get("resource_nodes", {})
	var stored: Dictionary = nodes.get(node_id, {})
	var definition := resource_definition(kind)
	var full := maxi(1, int(definition.get("hits", 1)))
	if not stored.is_empty():
		return stored
	return {"hits_left": full, "depleted_at": 0, "harvests": 0}


func structures() -> Dictionary:
	return document().get("structures", {})


func container_contents(container_id: String) -> Dictionary:
	var containers: Dictionary = document().get("containers", {})
	var raw: Variant = containers.get(container_id, {})
	return (raw as Dictionary).duplicate(true) if raw is Dictionary else {}


func is_recipe_learned(recipe_id: String) -> bool:
	var knowledge: Dictionary = document().get("knowledge", {})
	var recipes: Dictionary = knowledge.get("recipes", {})
	return recipes.has(recipe_id)


func inventory_count(item_id: String) -> int:
	# Delegated on purpose. The bag belongs to SaveService, and "how many of this
	# item do I have" has one correct answer that already knows the stack-key
	# rule; a second implementation here was wrong for every first stack.
	var save := _save()
	if save == null:
		return 0
	return int(save.call(&"inventory_total", item_id))


func can_afford(cost: Dictionary) -> bool:
	for item_id: Variant in cost.keys():
		if inventory_count(String(item_id)) < int(cost[item_id]):
			return false
	return true


func missing_for(cost: Dictionary) -> Dictionary:
	var missing: Dictionary = {}
	for item_id: Variant in cost.keys():
		var shortfall := int(cost[item_id]) - inventory_count(String(item_id))
		if shortfall > 0:
			missing[String(item_id)] = shortfall
	return missing


func structure_count() -> int:
	return structures().size()


# ---------------------------------------------------------------------------
# harvest — CT-06
# ---------------------------------------------------------------------------
## Takes one hit on a resource node.
##
## The transaction key is derived from the node's own committed harvest counter,
## so the key for "the third swing at this tree" is the same string on every
## attempt and in every process. A replayed action (a retry after a crash, a
## double-clicked interact, a duplicated event) therefore finds its key already
## applied and is rejected without touching the save. That is stronger than a
## client-supplied key, because the client cannot invent a fresh one to farm the
## same node.
##
## Returns `{ok, reason, item_id, quantity, hits_left}`.
func harvest(node_id: String, kind: String, now_unix: int = -1) -> Dictionary:
	var definition := resource_definition(kind)
	if definition.is_empty():
		return {"ok": false, "reason": "unknown_resource_kind"}
	var save := _save()
	if save == null:
		return {"ok": false, "reason": "save_service_unavailable"}
	var item_id := String(definition.get("item", ""))
	var item_kind := String(definition.get("item_kind", "material"))
	var per_hit := maxi(1, int(definition.get("per_hit", 1)))
	var full_hits := maxi(1, int(definition.get("hits", 1)))
	var respawn := maxi(0, int(definition.get("respawn_seconds", 0)))
	var stamp := now_unix if now_unix >= 0 else int(Time.get_unix_time_from_system())

	var document := document()
	var stored: Dictionary = (document.get("resource_nodes", {}) as Dictionary).get(node_id, {})
	var next_harvest := int(stored.get("harvests", 0)) + 1
	var key := "%s%s.%d" % [TX_HARVEST_PREFIX, node_id, next_harvest]

	# GDScript closures capture a local *by value*: assigning `result = {...}`
	# inside the mutator would write to the lambda's own copy and the caller would
	# never see it. Every field is therefore written into the captured Dictionary,
	# whose contents are shared.
	var result := {"ok": false, "reason": "rejected"}
	var applied := bool(save.call(
		&"transact_once",
		key,
		func(candidate: Dictionary) -> bool:
			var document_candidate: Dictionary = SurvivalStateData.sanitize(candidate.get("survival", {}))
			var nodes: Dictionary = document_candidate.get("resource_nodes", {})
			var entry: Dictionary = nodes.get(node_id, {})
			var hits_left := int(entry.get("hits_left", full_hits))
			var depleted_at := int(entry.get("depleted_at", 0))
			# Respawn is evaluated inside the transaction, against the committed
			# document, so two harvests that both think the node is ripe cannot
			# both be paid.
			if hits_left <= 0 and respawn > 0 and depleted_at > 0 and stamp >= depleted_at + respawn:
				hits_left = full_hits
				depleted_at = 0
			if hits_left <= 0:
				result["ok"] = false
				result["reason"] = "depleted"
				result["hits_left"] = 0
				return false
			var remaining := hits_left - 1
			nodes[node_id] = {
				"hits_left": remaining,
				"depleted_at": stamp if remaining <= 0 else 0,
				"harvests": int(entry.get("harvests", 0)) + 1,
			}
			document_candidate["resource_nodes"] = nodes
			candidate["survival"] = document_candidate
			if not bool(save.call(
				&"add_items_to_candidate",
				candidate, item_id, item_kind, per_hit,
				{"source": "resource_node", "node_id": node_id, "kind": kind},
			)):
				# A full bag must not eat the swing: the node keeps its hit.
				result["ok"] = false
				result["reason"] = "inventory_full"
				return false
			result["ok"] = true
			result["reason"] = ""
			result["item_id"] = item_id
			result["quantity"] = per_hit
			result["hits_left"] = remaining
			return true,
		{"kind": "survival_harvest", "node_id": node_id, "resource_kind": kind},
	))
	if not applied:
		if bool(result.get("ok", false)):
			result["ok"] = false
			result["reason"] = "duplicate_or_failed"
		transaction_rejected.emit(String(result.get("reason", "rejected")))
		return result.duplicate(true)
	harvested.emit(node_id, item_id, per_hit, int(result["hits_left"]))
	if int(result["hits_left"]) <= 0:
		resource_depleted.emit(node_id)
	survival_state_changed.emit()
	return result.duplicate(true)


## Whether a node can be swung at right now (ignores whether the bag has room).
func is_node_harvestable(node_id: String, kind: String, now_unix: int = -1) -> bool:
	var definition := resource_definition(kind)
	var full := maxi(1, int(definition.get("hits", 1)))
	var respawn := maxi(0, int(definition.get("respawn_seconds", 0)))
	var stamp := now_unix if now_unix >= 0 else int(Time.get_unix_time_from_system())
	var state := resource_state(node_id, kind)
	var hits_left := int(state.get("hits_left", full))
	if hits_left > 0:
		return true
	var depleted_at := int(state.get("depleted_at", 0))
	return respawn > 0 and depleted_at > 0 and stamp >= depleted_at + respawn


# A surface can share a cell with one physical object; other objects may not
# overlap each other. This is derived from catalog data, so old saves need no rewrite.
func occupancy_layer(piece_id: String) -> String:
	return "floor" if String(piece_definition(piece_id).get("kind", "")) == "floor" else "object"


# ---------------------------------------------------------------------------
# construction — CT-07
# ---------------------------------------------------------------------------
## Pays for and creates one structure in a single commit.
##
## `spatial_validator` is called *before* the transaction (world queries are not
## part of the save document) and again inside it (occupancy and affordability,
## which are). It receives no arguments and must return "" when placement is
## legal or a short reason when it is not — so this service never has to know
## what a road, a landmark or a spawn lane is.
func place_structure(
		piece_id: String,
		cell: Vector2i,
		transaction_key: String,
		spatial_validator: Callable = Callable(),
) -> Dictionary:
	var definition := piece_definition(piece_id)
	if definition.is_empty():
		return {"ok": false, "reason": "unknown_piece"}
	if transaction_key.strip_edges().is_empty() or transaction_key.length() > 160:
		return {"ok": false, "reason": "invalid_transaction_key"}
	var save := _save()
	if save == null:
		return {"ok": false, "reason": "save_service_unavailable"}
	var cost: Dictionary = definition.get("cost", {})
	if not can_afford(cost):
		var shortfall := missing_for(cost)
		transaction_rejected.emit("cannot_afford")
		return {"ok": false, "reason": "cannot_afford", "missing": shortfall}
	if spatial_validator.is_valid():
		var spatial_reason := String(spatial_validator.call())
		if not spatial_reason.is_empty():
			transaction_rejected.emit(spatial_reason)
			return {"ok": false, "reason": spatial_reason}

	var result := {"ok": false, "reason": "rejected"}
	var applied := bool(save.call(
		&"transact_once",
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var document_candidate: Dictionary = SurvivalStateData.sanitize(candidate.get("survival", {}))
			var placed: Dictionary = document_candidate.get("structures", {})
			for existing_id: Variant in placed.keys():
				var existing: Dictionary = placed[existing_id]
				var existing_cell: Array = existing.get("cell", [])
				if existing_cell.size() >= 2 \
						and int(existing_cell[0]) == cell.x and int(existing_cell[1]) == cell.y \
						and occupancy_layer(String(existing.get("piece", ""))) == occupancy_layer(piece_id):
					result["ok"] = false
					result["reason"] = "cell_occupied"
					return false
			# Payment and creation are in this one mutator: if the removal fails
			# nothing is created, and if the commit fails neither happened.
			for item_id: Variant in cost.keys():
				if not bool(save.call(
					&"remove_items_from_candidate",
					candidate, String(item_id), int(cost[item_id]),
				)):
					result["ok"] = false
					result["reason"] = "cannot_afford"
					return false
			var entity_id := SurvivalStateData.next_structure_id(document_candidate)
			placed[entity_id] = {
				"piece": piece_id,
				"cell": [cell.x, cell.y],
				"orientation": 0,
				"origin_key": transaction_key,
				"created_at": int(Time.get_unix_time_from_system()),
			}
			document_candidate["structures"] = placed
			if String(definition.get("interaction", "")) == "container":
				var containers: Dictionary = document_candidate.get("containers", {})
				containers[entity_id] = {}
				document_candidate["containers"] = containers
			candidate["survival"] = document_candidate
			result["ok"] = true
			result["reason"] = ""
			result["entity_id"] = entity_id
			return true,
		{
			"kind": "survival_build",
			"piece": piece_id,
			"cell": [cell.x, cell.y],
		},
	))
	if not applied:
		if bool(result.get("ok", false)):
			# The mutator succeeded but the commit refused the key: a replay, or
			# an I/O failure. Either way nothing was written.
			result["ok"] = false
			result["reason"] = "duplicate_or_failed"
		transaction_rejected.emit(String(result.get("reason", "rejected")))
		return result.duplicate(true)
	structure_placed.emit(String(result["entity_id"]), piece_id, cell)
	survival_state_changed.emit()
	return result.duplicate(true)


## Atomically move carried stack records, not permanent knowledge or equipped
## Hero identities, into a distinct durable overworld death bag. The pending id
## also prevents a crash/reload from creating a second bag for the same death.
func begin_overworld_death(position: Vector2) -> Dictionary:
	var save := _save()
	if save == null or not is_finite(position.x) or not is_finite(position.y):
		return {"ok": false, "reason": "invalid_death"}
	var before := document()
	var pending := String(before.get("pending_death", ""))
	if not pending.is_empty():
		return {"ok": true, "entity_id": pending, "already_pending": true}
	var serial := int((before.get("counters", {}) as Dictionary).get("deaths", 0)) + 1
	var bag_id := "death_%d" % serial
	var applied := bool(save.call(&"transact_once", "survival.death.%d" % serial,
		func(candidate: Dictionary) -> bool:
			var doc := SurvivalStateData.sanitize(candidate.get("survival", {}))
			var counters: Dictionary = doc.get("counters", {})
			if int(counters.get("deaths", 0)) != serial - 1 or not String(doc.get("pending_death", "")).is_empty():
				return false
			var inventory: Dictionary = candidate.get("inventory", {})
			var stacks: Dictionary = inventory.get("item_stacks", {})
			var dropped: Dictionary = {}
			var retained: Dictionary = {}
			for raw_key: Variant in stacks.keys():
				if not stacks[raw_key] is Dictionary:
					return false
				var record: Dictionary = stacks[raw_key]
				var base_id := String(record.get("item_id", raw_key))
				# A3 instances have a coupled attribute record. Until death-bag
				# ownership is supported by its audit, keep the token in the bag;
				# moving it alone would create a broken/orphaned unique item.
				if base_id.begins_with("soh_i_"):
					retained[raw_key] = record.duplicate(true)
				else:
					dropped[raw_key] = record.duplicate(true)
			var bags: Dictionary = doc.get("death_bags", {})
			if bags.has(bag_id):
				return false
			bags[bag_id] = {"region": "hollow_marches", "position": [position.x, position.y], "stacks": dropped}
			inventory["item_stacks"] = retained
			candidate["inventory"] = inventory
			doc["death_bags"] = bags
			doc["pending_death"] = bag_id
			counters["deaths"] = serial
			doc["counters"] = counters
			candidate["survival"] = doc
			return true,
		{"kind": "survival_death", "entity_id": bag_id}))
	if applied:
		survival_state_changed.emit()
	return {"ok": applied, "entity_id": bag_id if applied else "", "reason": "" if applied else "commit_failed"}


## Exactly one commit clears pending death and records the safe overworld spawn.
## Crash before the commit leaves the Hero dead; after it the new position loads.
func finish_overworld_death(position: Vector2) -> bool:
	var save := _save()
	var pending := String(document().get("pending_death", ""))
	if save == null or pending.is_empty() or not is_finite(position.x) or not is_finite(position.y):
		return false
	var applied := bool(save.call(&"transact_once", "survival.respawn." + pending,
		func(candidate: Dictionary) -> bool:
			var doc := SurvivalStateData.sanitize(candidate.get("survival", {}))
			if String(doc.get("pending_death", "")) != pending:
				return false
			doc["pending_death"] = ""
			candidate["survival"] = doc
			var overworld: Dictionary = candidate.get("overworld", {})
			var state: Dictionary = overworld.get("hollow_marches", {})
			state["last_position"] = [position.x, position.y]
			overworld["hollow_marches"] = state
			candidate["overworld"] = overworld
			return true,
		{"kind": "survival_respawn", "entity_id": pending}))
	if applied:
		survival_state_changed.emit()
	return applied


## Recover the entire bag or none. Stack records stay distinct (no merge and no
## provenance replacement); a full inventory leaves the bag untouched.
func recover_death_bag(bag_id: String) -> bool:
	var save := _save()
	if save == null:
		return false
	var applied := bool(save.call(&"transact_once", "survival.death.recover." + bag_id,
		func(candidate: Dictionary) -> bool:
			var doc := SurvivalStateData.sanitize(candidate.get("survival", {}))
			var bags: Dictionary = doc.get("death_bags", {})
			if not bags.has(bag_id) or String(doc.get("pending_death", "")) == bag_id:
				return false
			var bag: Dictionary = bags[bag_id]
			var raw: Variant = bag.get("stacks", null)
			if not raw is Dictionary:
				return false
			var inventory: Dictionary = candidate.get("inventory", {})
			var stacks: Dictionary = inventory.get("item_stacks", {})
			var entries: Dictionary = raw
			var occupied: int = (inventory.get("hero_souls", []) as Array).size() + (inventory.get("auxiliary_equipment", []) as Array).size() + stacks.size()
			if occupied + entries.size() > 30:
				return false
			for raw_key: Variant in entries.keys():
				var key := String(raw_key)
				if not entries[raw_key] is Dictionary:
					return false
				var record: Dictionary = (entries[raw_key] as Dictionary).duplicate(true)
				var item_id := String(record.get("item_id", key))
				# No A3 instance location exists for death bags yet. Never recover
				# an injected/stale token as an uncoupled duplicate.
				if item_id.strip_edges().to_lower().begins_with("soh_i_") or key.strip_edges().to_lower().begins_with("soh_i_"):
					return false
				if stacks.has(key):
					key = String(save.call(&"_next_inventory_stack_key", stacks, item_id))
				if key == item_id:
					record.erase("item_id")
				else:
					record["item_id"] = item_id
				stacks[key] = record
			inventory["item_stacks"] = stacks
			candidate["inventory"] = inventory
			bags.erase(bag_id)
			doc["death_bags"] = bags
			candidate["survival"] = doc
			return true,
		{"kind": "survival_death_recovery", "entity_id": bag_id}))
	if applied:
		survival_state_changed.emit()
	return applied


## The scene supplies ownership, proximity, enclosure and safe-wake validation.
## The transaction rechecks structure identity and its expected activation serial.
func activate_bed(entity_id: String, validator: Callable) -> Dictionary:
	var save := _save()
	var doc := document()
	var record: Dictionary = (doc.get("structures", {}) as Dictionary).get(entity_id, {})
	if save == null or String(record.get("piece", "")) != "bed_wood":
		return {"ok": false, "reason": "not_a_bed"}
	if not validator.is_valid() or not bool(validator.call()):
		return {"ok": false, "reason": "bed_not_safe"}
	if String(doc.get("spawn_anchor", "")) == entity_id:
		return {"ok": true, "already_active": true}
	var counters: Dictionary = doc.get("counters", {})
	var revision := int(counters.get("bed_activations", 0))
	var applied := bool(save.call(&"transact_once", "survival.bed.activation.%d" % (revision + 1),
		func(candidate: Dictionary) -> bool:
			var current := SurvivalStateData.sanitize(candidate.get("survival", {}))
			var placed: Dictionary = current.get("structures", {})
			var bed: Dictionary = placed.get(entity_id, {})
			var next_counters: Dictionary = current.get("counters", {})
			if String(bed.get("piece", "")) != "bed_wood" or int(next_counters.get("bed_activations", 0)) != revision:
				return false
			if not bool(validator.call()):
				return false
			current["spawn_anchor"] = entity_id
			next_counters["bed_activations"] = revision + 1
			current["counters"] = next_counters
			candidate["survival"] = current
			return true,
		{"kind": "survival_bed_activation", "entity_id": entity_id}))
	if applied:
		survival_state_changed.emit()
	return {"ok": applied, "reason": "" if applied else "commit_failed"}


## Toggle a door atomically. Closing requires a world-owned overlap validator;
## the autoload cannot determine whether a live Hero occupies the doorway.
## The per-door revision generates distinct action keys while an optional stable
## request key allows a caller to reject replay of the same logical command.
func toggle_door(entity_id: String, close_validator: Callable, request_key := "") -> Dictionary:
	var save := _save()
	var entry: Dictionary = structures().get(entity_id, {})
	if save == null or String(entry.get("piece", "")) != "door_wood":
		return {"ok": false, "reason": "not_a_door"}
	var revision := int(entry.get("door_revision", 0))
	var key := request_key if not request_key.is_empty() else "survival.door.%s.%d" % [entity_id, revision + 1]
	var result := {"ok": false, "reason": "rejected"}
	var applied := bool(save.call(
		&"transact_once", key,
		func(candidate: Dictionary) -> bool:
			var doc: Dictionary = SurvivalStateData.sanitize(candidate.get("survival", {}))
			var placed: Dictionary = doc.get("structures", {})
			var current: Dictionary = placed.get(entity_id, {})
			if String(current.get("piece", "")) != "door_wood" or int(current.get("door_revision", 0)) != revision:
				result["reason"] = "changed"
				return false
			var was_open := bool(current.get("door_open", false))
			if was_open and (not close_validator.is_valid() or not bool(close_validator.call())):
				result["reason"] = "doorway_occupied"
				return false
			current["door_open"] = not was_open
			current["door_revision"] = revision + 1
			placed[entity_id] = current
			doc["structures"] = placed
			candidate["survival"] = doc
			result["ok"] = true
			result["reason"] = ""
			result["open"] = not was_open
			return true,
		{"kind": "survival_door", "entity_id": entity_id},
	))
	if not applied:
		result["ok"] = false
		return result
	survival_state_changed.emit()
	return result


## Removes a structure without refunding. Demolition economics are A3's; this is
## the primitive they will call, and it exists now so that a misplaced structure
## is never a permanent save-file artefact during development.
func remove_structure(entity_id: String) -> bool:
	var save := _save()
	if save == null:
		return false
	var applied := bool(save.call(
		&"transact_once",
		"survival.demolish.%s.%d" % [entity_id, int(Time.get_unix_time_from_system())],
		func(candidate: Dictionary) -> bool:
			var document_candidate: Dictionary = SurvivalStateData.sanitize(candidate.get("survival", {}))
			var placed: Dictionary = document_candidate.get("structures", {})
			if not placed.has(entity_id):
				return false
			var containers: Dictionary = document_candidate.get("containers", {})
			# Never destroy a container and silently delete its contents. This
			# guard is inside the transaction so the check and removal are atomic.
			var contents: Dictionary = containers.get(entity_id, {})
			if not contents.is_empty():
				return false
			placed.erase(entity_id)
			if String(document_candidate.get("spawn_anchor", "")) == entity_id:
				document_candidate["spawn_anchor"] = ""
			document_candidate["structures"] = placed
			containers.erase(entity_id)
			document_candidate["containers"] = containers
			candidate["survival"] = document_candidate
			return true,
		{"kind": "survival_demolish", "entity_id": entity_id},
	))
	if applied:
		structure_removed.emit(entity_id)
		survival_state_changed.emit()
	return applied


# ---------------------------------------------------------------------------
# containers — CT-03 / CT-07
# ---------------------------------------------------------------------------
## Moves items from the bag into a placed container as one commit.
##
## Both halves live in the same candidate document, so there is no state in which
## the wood has left the bag but has not arrived — the failure this whole contract
## exists to prevent.
func transfer_to_container(
		container_id: String,
		item_id: String,
		quantity: int,
		transaction_key: String,
) -> bool:
	return _transfer(container_id, item_id, quantity, transaction_key, true)


func transfer_from_container(
		container_id: String,
		item_id: String,
		quantity: int,
		transaction_key: String,
) -> bool:
	return _transfer(container_id, item_id, quantity, transaction_key, false)


func _transfer(
		container_id: String,
		item_id: String,
		quantity: int,
		transaction_key: String,
		into_container: bool,
) -> bool:
	var normalized := item_id.strip_edges().to_lower()
	if normalized.is_empty() or normalized.begins_with("soh_i_") or quantity < 1 or transaction_key.strip_edges().is_empty():
		return false
	var save := _save()
	if save == null:
		return false
	var kind := String(item_definition(normalized).get("kind", "material"))
	var applied := bool(save.call(
		&"transact_once",
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var document_candidate: Dictionary = SurvivalStateData.sanitize(candidate.get("survival", {}))
			var structures: Dictionary = document_candidate.get("structures", {})
			if not structures.has(container_id):
				return false
			if String((structures[container_id] as Dictionary).get("piece", "")) != "chest_wood":
				return false
			var containers: Dictionary = document_candidate.get("containers", {})
			var contents: Dictionary = (containers.get(container_id, {}) as Dictionary).duplicate(true)
			if into_container:
				if not bool(save.call(
					&"remove_items_from_candidate", candidate, normalized, quantity,
				)):
					return false
				var capacity := int(piece_definition("chest_wood").get("slots", 12))
				var would_be := contents.duplicate(true)
				would_be[normalized] = int(would_be.get(normalized, 0)) + quantity
				if would_be.size() > capacity:
					return false
				contents = would_be
			else:
				var held := int(contents.get(normalized, 0))
				if held < quantity:
					return false
				if held == quantity:
					contents.erase(normalized)
				else:
					contents[normalized] = held - quantity
				if not bool(save.call(
					&"add_items_to_candidate",
					candidate, normalized, kind, quantity,
					{"source": "container", "container_id": container_id},
				)):
					return false
			containers[container_id] = contents
			document_candidate["containers"] = containers
			candidate["survival"] = document_candidate
			return true,
		{
			"kind": "survival_container_transfer",
			"container_id": container_id,
			"item_id": normalized,
			"quantity": quantity,
			"direction": "in" if into_container else "out",
		},
	))
	if applied:
		survival_state_changed.emit()
	return applied


# ---------------------------------------------------------------------------
# research — CT-04 seam (A3 owns the recipe graph; A0 owns the persistence)
# ---------------------------------------------------------------------------
## The bag as `{item_id: quantity}`, merged across stacks.
##
## Stacks are a storage detail; players and UI reason in items. Reading the total
## here keeps every caller from re-implementing the merge rule (and getting the
## "two half stacks of wood" case wrong).
func inventory_totals() -> Dictionary:
	var save := _save()
	if save == null:
		return {}
	return (save.call(&"inventory_totals") as Dictionary).duplicate(true)


## Moves *everything* that fits from the bag into a container, as one commit.
##
## This is the one-press stash verb. It is deliberately all-or-nothing per item:
## a stack that does not fit entirely stays in the bag, because a half-deposit
## that the player did not ask for is worse than a refusal they can see. Returns
## `{ok, reason, moved}` where `moved` is `{item_id: quantity}`.
func deposit_all(container_id: String) -> Dictionary:
	return _transfer_all(container_id, true)


## The mirror of [method deposit_all]: takes the container's whole contents back.
func withdraw_all(container_id: String) -> Dictionary:
	return _transfer_all(container_id, false)


func _transfer_all(container_id: String, into_container: bool) -> Dictionary:
	var save := _save()
	if save == null:
		return {"ok": false, "reason": "no_save", "moved": {}}
	var structures := structures()
	if not structures.has(container_id):
		return {"ok": false, "reason": "no_container", "moved": {}}
	if String((structures[container_id] as Dictionary).get("piece", "")) != "chest_wood":
		return {"ok": false, "reason": "not_a_container", "moved": {}}
	var capacity := int(piece_definition("chest_wood").get("slots", 12))
	var stored := container_contents(container_id)
	var source: Dictionary = inventory_totals() if into_container else stored
	if source.is_empty():
		return {"ok": true, "reason": "empty", "moved": {}}
	var planned: Dictionary = {}
	var projected_slots := stored.size()
	for item_id: Variant in source.keys():
		# Leave coupled unique instances where the A3 ownership audit supports
		# them; ordinary materials can still be deposited in the same sweep.
		if String(item_id).begins_with("soh_i_"):
			continue
		var quantity := int(source[item_id])
		if quantity <= 0:
			continue
		if into_container and not stored.has(item_id):
			if projected_slots >= capacity:
				continue
			projected_slots += 1
		planned[String(item_id)] = quantity
	if planned.is_empty():
		return {"ok": false, "reason": "container_full", "moved": {}}
	var moved: Dictionary = {}
	# A committed sequence distinguishes two legitimate identical sweeps. The
	# old quantity signature permanently rejected the second identical deposit.
	# A failed candidate does not advance this counter or leave a receipt.
	var sequence := int((document().get("counters", {}) as Dictionary).get("container_sweeps", 0)) + 1
	# An older build may drop this new counter while retaining transaction receipts.
	# Skip those receipts rather than making the next sweep permanently unusable.
	while bool(save.call(&"is_transaction_applied", "%sall.v2.%d" % [TX_TRANSFER_PREFIX, sequence])):
		sequence += 1
	var applied := bool(save.call(
		&"transact_once",
		"%sall.v2.%d" % [TX_TRANSFER_PREFIX, sequence],
		func(candidate: Dictionary) -> bool:
			var document_candidate: Dictionary = SurvivalStateData.sanitize(candidate.get("survival", {}))
			var containers: Dictionary = document_candidate.get("containers", {})
			var contents: Dictionary = (containers.get(container_id, {}) as Dictionary).duplicate(true)
			for item_id: Variant in planned.keys():
				var normalized := String(item_id)
				var quantity := int(planned[item_id])
				if into_container:
					if contents.has(normalized):
						if int(contents[normalized]) + quantity > MAX_STACK_PER_SLOT:
							continue
					elif contents.size() >= capacity:
						continue
					if not bool(save.call(
						&"remove_items_from_candidate", candidate, normalized, quantity,
					)):
						return false
					contents[normalized] = int(contents.get(normalized, 0)) + quantity
				else:
					if int(contents.get(normalized, 0)) < quantity:
						return false
					if not bool(save.call(
						&"add_items_to_candidate",
						candidate, normalized, String(item_definition(normalized).get("kind", "material")),
						quantity, {"source": "container", "container_id": container_id},
					)):
						# A full bag stops the sweep where it is, with everything
						# already moved in this same transaction still applied.
						continue
					contents.erase(normalized)
				moved[normalized] = quantity
			if moved.is_empty():
				return false
			containers[container_id] = contents
			document_candidate["containers"] = containers
			var counters: Dictionary = document_candidate.get("counters", {})
			counters["container_sweeps"] = sequence
			document_candidate["counters"] = counters
			candidate["survival"] = document_candidate
			return true,
		{
			"kind": "survival_container_sweep",
			"container_id": container_id,
			"direction": "in" if into_container else "out",
			"planned": planned.duplicate(true),
		},
	))
	if not applied:
		moved.clear()
		return {"ok": false, "reason": "rejected", "moved": {}}
	survival_state_changed.emit()
	return {"ok": true, "reason": "", "moved": moved.duplicate(true)}


func learn_recipe(recipe_id: String, source: String, transaction_key: String) -> bool:
	var normalized := recipe_id.strip_edges().to_lower()
	if normalized.is_empty() or transaction_key.strip_edges().is_empty():
		return false
	var save := _save()
	if save == null:
		return false
	var applied := bool(save.call(
		&"transact_once",
		transaction_key,
		func(candidate: Dictionary) -> bool:
			var document_candidate: Dictionary = SurvivalStateData.sanitize(candidate.get("survival", {}))
			var knowledge: Dictionary = document_candidate.get("knowledge", {"recipes": {}})
			var recipes: Dictionary = knowledge.get("recipes", {})
			if recipes.has(normalized):
				# Already known is not an error the player should pay for twice.
				return false
			recipes[normalized] = {
				"source": source,
				"learned_at": int(Time.get_unix_time_from_system()),
			}
			knowledge["recipes"] = recipes
			document_candidate["knowledge"] = knowledge
			candidate["survival"] = document_candidate
			return true,
		{"kind": "survival_research", "recipe_id": normalized},
	))
	if applied:
		survival_state_changed.emit()
	return applied


# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------
## Called by the overworld after it mounts. Persisting lazily (on the first
## transaction) rather than on boot keeps a player who never harvests from
## writing a new namespace into an old save for no reason.
func sync_from_save() -> void:
	survival_state_changed.emit()


## Transaction key for a build attempt. Derived from the committed structure
## counter so that a retry of a *failed* attempt reuses its key (failed attempts
## leave no receipt) while every successful build gets a fresh, auditable one.
func build_transaction_key() -> String:
	var counters: Dictionary = document().get("counters", {})
	return "%s%d" % [TX_BUILD_PREFIX, int(counters.get("structure", 0)) + 1]
