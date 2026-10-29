class_name SurvivalStateData
extends RefCounted

## The survival namespace of the authoritative save document.
##
## ## Where this state lives
##
## Everything survival owns is one Dictionary at `save["survival"]`, inside the
## *same* document that [LivingArsenalSaveService] writes. That placement is the
## whole design: `SaveService.transact_once()` deep-copies the entire document,
## runs a mutator against the copy and commits it as one durable snapshot with a
## transaction receipt. Because the inventory and the survival block live in that
## one copy, "pay four wood and place a wall" is a single atomic commit — there is
## no window in which the wood is gone and the wall is not there, and no window in
## which the wall exists and the wood was never taken.
##
## A separate survival save file, or a second inventory, would reopen exactly that
## window. See docs/survival/CONTRACTS.md (CT-02, CT-03, CT-07).
##
## ## Compatibility
##
## The outer schema version is **not** bumped. An extra namespace is invisible to
## older builds: `SaveService._merge_defaults()` starts from the loaded document
## and only fills in absent default keys, so old code round-trips `survival`
## untouched. New code reading an old save finds no block and treats it as empty.
## That is the documented fallback for pre-survival saves.

const SCHEMA := 1
const SAVE_PATH: Array[String] = ["survival"]
const SAVE_ROOT := "survival"

## Node ids are `<kind>@<x>,<y>`: derived from the world cell, so the same tree is
## the same tree across reloads, and a replayed harvest cannot address a different
## node than the one the player swung at.
const NODE_ID_SEPARATOR := "@"


## A fresh, empty survival block. Used for new saves and for old saves that
## predate the namespace.
static func empty_document() -> Dictionary:
	return {
		"schema": SCHEMA,
		"resource_nodes": {},
		"structures": {},
		"containers": {},
		"knowledge": {"recipes": {}},
		"counters": {"structure": 0, "container_sweeps": 0},
	}


static func resource_node_id(kind: String, cell: Vector2i) -> String:
	return "%s%s%d,%d" % [kind, NODE_ID_SEPARATOR, cell.x, cell.y]


## Reads a survival block out of a save snapshot without trusting its shape.
##
## A save file is external input: it can be truncated, hand-edited, or written by
## a newer build. Every field is therefore re-derived here and anything that does
## not type-check is dropped rather than propagated into gameplay.
static func sanitize(raw: Variant) -> Dictionary:
	var document := empty_document()
	if not raw is Dictionary:
		return document
	var source: Dictionary = raw
	var version := int(source.get("schema", SCHEMA))
	if version > SCHEMA:
		# A newer build's document is not silently reinterpreted. Keeping the
		# player's older objects visible is safer than deleting a base because
		# this build does not understand a field it added.
		return document

	var nodes: Dictionary = {}
	var raw_nodes: Variant = source.get("resource_nodes", {})
	if raw_nodes is Dictionary:
		for raw_key: Variant in (raw_nodes as Dictionary).keys():
			var key := String(raw_key)
			if key.is_empty() or key.length() > 96:
				continue
			var value: Variant = (raw_nodes as Dictionary)[raw_key]
			if not value is Dictionary:
				continue
			var entry: Dictionary = value
			nodes[key] = {
				"hits_left": maxi(0, int(entry.get("hits_left", 0))),
				"depleted_at": int(entry.get("depleted_at", 0)),
				"harvests": maxi(0, int(entry.get("harvests", 0))),
			}
	document["resource_nodes"] = nodes

	var structures: Dictionary = {}
	var raw_structures: Variant = source.get("structures", {})
	if raw_structures is Dictionary:
		for raw_key: Variant in (raw_structures as Dictionary).keys():
			var id := String(raw_key)
			var value: Variant = (raw_structures as Dictionary)[raw_key]
			if id.is_empty() or not value is Dictionary:
				continue
			var entry: Dictionary = value
			var piece := String(entry.get("piece", ""))
			var cell: Variant = entry.get("cell", [])
			if piece.is_empty() or not cell is Array or (cell as Array).size() < 2:
				continue
			structures[id] = {
				"piece": piece,
				"cell": [int((cell as Array)[0]), int((cell as Array)[1])],
				"orientation": int(entry.get("orientation", 0)),
				"origin_key": String(entry.get("origin_key", "")),
				"created_at": int(entry.get("created_at", 0)),
			}
	document["structures"] = structures

	var containers: Dictionary = {}
	var raw_containers: Variant = source.get("containers", {})
	if raw_containers is Dictionary:
		for raw_key: Variant in (raw_containers as Dictionary).keys():
			var id := String(raw_key)
			var value: Variant = (raw_containers as Dictionary)[raw_key]
			if id.is_empty() or not value is Dictionary:
				continue
			var contents: Dictionary = {}
			for raw_item: Variant in (value as Dictionary).keys():
				var item_id := String(raw_item)
				var quantity := int((value as Dictionary)[raw_item])
				if item_id.is_empty() or quantity <= 0:
					continue
				contents[item_id] = quantity
			containers[id] = contents
	document["containers"] = containers

	var knowledge: Dictionary = {"recipes": {}}
	var raw_knowledge: Variant = source.get("knowledge", {})
	if raw_knowledge is Dictionary:
		var raw_recipes: Variant = (raw_knowledge as Dictionary).get("recipes", {})
		if raw_recipes is Dictionary:
			for raw_key: Variant in (raw_recipes as Dictionary).keys():
				var recipe_id := String(raw_key)
				var value: Variant = (raw_recipes as Dictionary)[raw_key]
				if recipe_id.is_empty() or not value is Dictionary:
					continue
				(knowledge["recipes"] as Dictionary)[recipe_id] = {
					"source": String((value as Dictionary).get("source", "")),
					"learned_at": int((value as Dictionary).get("learned_at", 0)),
				}
	document["knowledge"] = knowledge

	var counters: Dictionary = {"structure": 0, "container_sweeps": 0}
	var raw_counters: Variant = source.get("counters", {})
	if raw_counters is Dictionary:
		counters["structure"] = maxi(0, int((raw_counters as Dictionary).get("structure", 0)))
		counters["container_sweeps"] = maxi(0, int((raw_counters as Dictionary).get("container_sweeps", 0)))
	document["counters"] = counters
	return document


## Deterministic, collision-free ids for placed structures.
##
## The counter lives in the same document, so the id and the entity are committed
## together. `origin_key` records which transaction created the entity: a test can
## assert that no two entities came from the same action, which is the visible
## symptom of an idempotency bug.
static func next_structure_id(document: Dictionary) -> String:
	var counters: Dictionary = document.get("counters", {})
	var index := int(counters.get("structure", 0)) + 1
	counters["structure"] = index
	document["counters"] = counters
	return "b%d" % index


## Total quantity of every item currently held in containers, keyed by item id.
## Used by conservation checks in tests; not a gameplay API.
static func container_totals(document: Dictionary) -> Dictionary:
	var totals: Dictionary = {}
	var containers: Dictionary = document.get("containers", {})
	for container_id: Variant in containers.keys():
		var contents: Dictionary = containers[container_id]
		for item_id: Variant in contents.keys():
			totals[String(item_id)] = int(totals.get(String(item_id), 0)) + int(contents[item_id])
	return totals
