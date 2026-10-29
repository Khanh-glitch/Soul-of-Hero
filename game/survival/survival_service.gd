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
	var save := _save()
	if save == null:
		return 0
	var stacks: Variant = save.call(&"get_inventory_stacks")
	if not stacks is Dictionary:
		return 0
	var total := 0
	for key: Variant in (stacks as Dictionary).keys():
		var record: Variant = (stacks as Dictionary)[key]
		if not record is Dictionary:
			continue
		if String((record as Dictionary).get("item_id", "")) == item_id:
			total += int((record as Dictionary).get("quantity", 0))
	return total


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
						and int(existing_cell[0]) == cell.x and int(existing_cell[1]) == cell.y:
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
			placed.erase(entity_id)
			document_candidate["structures"] = placed
			var containers: Dictionary = document_candidate.get("containers", {})
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
	if normalized.is_empty() or quantity < 1 or transaction_key.strip_edges().is_empty():
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
	var stacks: Variant = save.call(&"get_inventory_stacks")
	if not stacks is Dictionary:
		return {}
	var totals: Dictionary = {}
	for key: Variant in (stacks as Dictionary).keys():
		var record: Variant = (stacks as Dictionary)[key]
		if not record is Dictionary:
			continue
		var item_id := String((record as Dictionary).get("item_id", ""))
		var quantity := int((record as Dictionary).get("quantity", 0))
		if item_id.is_empty() or quantity <= 0:
			continue
		totals[item_id] = int(totals.get(item_id, 0)) + quantity
	return totals


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
		var quantity := int(source[item_id])
		if quantity <= 0:
			continue
		if into_container and not stored.has(item_id):
			if projected_slots + planned.size() >= capacity:
				continue
		planned[String(item_id)] = quantity
	if planned.is_empty():
		return {"ok": false, "reason": "container_full", "moved": {}}
	var moved: Dictionary = {}
	# One commit for the whole sweep. The key includes the planned quantities so
	# that the identical sweep replayed in the same second is refused, while a
	# genuinely different sweep gets its own receipt.
	var signature := ""
	for item_id: Variant in planned.keys():
		signature += "%s=%d;" % [String(item_id), int(planned[item_id])]
	var applied := bool(save.call(
		&"transact_once",
		"%sall.%s.%s.%s" % [
			TX_TRANSFER_PREFIX, container_id, "in" if into_container else "out", signature.md5_text()],
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
