extends RefCounted
## Read-only projection. SaveService/SurvivalService remain the authorities.
## Pass objects explicitly; no autoload calls, writes, gameplay or cached state.

const PLACEMENT_REASONS := {
	"no_world": "World is not ready.",
	"outside_world": "Outside the buildable world.",
	"solid_terrain": "Solid terrain blocks this space.",
	"water": "You cannot build in water.",
	"protected_place": "This important place needs clearance.",
	"on_route": "Keep the route clear.",
	"near_shortcut": "Keep the shortcut clear.",
	"out_of_range": "Move closer to the build site.",
	"cell_occupied": "Another structure occupies this space.",
	"no_target": "Point at a build site.",
	"not_configured": "Construction is not ready.",
	"no_service": "Construction service is unavailable.",
}

static func bag(save: Object, survival: Object) -> Array[Dictionary]:
	var entries: Array[Dictionary] = []
	if save == null or survival == null:
		return entries
	var stacks: Dictionary = _dict(save.call(&"get_inventory_stacks"))
	var keys := stacks.keys()
	keys.sort()
	for key: Variant in keys:
		var value: Variant = stacks[key]
		if not value is Dictionary:
			continue
		var record: Dictionary = value
		var id := String(record.get("item_id", key))
		var count := int(record.get("quantity", 0))
		if id.is_empty() or count <= 0:
			continue
		var def: Dictionary = _dict(survival.call(&"item_definition", id))
		entries.append({"id": id, "stack_key": String(key), "name": String(def.get("label", id.replace("_", " ").capitalize())), "count": count, "kind": String(def.get("kind", record.get("kind", "item")))})
	return entries

static func placement(survival: Object, piece_id: String, reason: String, known_sources: Array = []) -> Dictionary:
	if survival == null:
		return {"name": piece_id, "status": "Construction service is unavailable.", "costs": []}
	var piece: Dictionary = _dict(survival.call(&"piece_definition", piece_id))
	if piece.is_empty():
		return {"name": piece_id, "status": "Construction definition unavailable.", "costs": []}
	var cost: Dictionary = _dict(piece.get("cost", {}))
	var rows: Array[Dictionary] = []
	var keys := cost.keys()
	keys.sort()
	for key: Variant in keys:
		var id := String(key)
		var def: Dictionary = _dict(survival.call(&"item_definition", id))
		var have := int(survival.call(&"inventory_count", id))
		var required := int(cost[key])
		var hints: Array[String] = []
		for source_id: Variant in known_sources:
			var resource: Dictionary = _dict(survival.call(&"resource_definition", String(source_id)))
			if String(resource.get("item", "")) == id:
				hints.append(String(resource.get("label", source_id)))
		rows.append({"id": id, "name": String(def.get("label", id)), "have": have, "required": required, "missing": maxi(0, required - have), "sources": hints})
	var message := "Location clear."
	if not reason.is_empty():
		message = String(PLACEMENT_REASONS.get(reason, "Placement unavailable (%s)." % reason))
	return {"name": String(piece.get("label", piece_id)), "status": message, "costs": rows}

## This is intentionally a projection of caller-supplied knowledge, not recipe ownership.
static func recipe_status(found: bool, learned: bool) -> String:
	if learned:
		return "Formula learned"
	if found:
		return "Found; research required"
	return "Undiscovered"

static func core_status(charges: int, maximum: int) -> String:
	if maximum <= 0 or charges < 0 or charges > maximum:
		return "Charges unavailable"
	return "Depleted · 0/%d uses" % maximum if charges == 0 else "%d/%d uses remaining" % [charges, maximum]

## A0's current transfer API takes an item ID, not a SaveService stack key.
## Totals are authoritative read accessors; this view neither authorizes nor
## performs transfers, checks capacity, nor asserts a chest is interactable.
static func storage(save: Object, survival: Object, container_id: String) -> Dictionary:
	var result := {"container_id": container_id, "transfer_enabled": false, "bag": [], "chest": []}
	if save == null or survival == null or container_id.is_empty():
		return result
	var bag_totals: Dictionary = _dict(save.call(&"inventory_totals"))
	var chest_totals: Dictionary = _dict(survival.call(&"container_contents", container_id))
	result.bag = _totals_as_rows(bag_totals, survival)
	result.chest = _totals_as_rows(chest_totals, survival)
	return result

static func _totals_as_rows(totals: Dictionary, survival: Object) -> Array[Dictionary]:
	var rows: Array[Dictionary] = []
	var keys := totals.keys()
	keys.sort()
	for raw_key: Variant in keys:
		var id := String(raw_key)
		var count := int(totals[raw_key])
		if id.is_empty() or count <= 0: continue
		var definition: Dictionary = _dict(survival.call(&"item_definition", id))
		rows.append({"id": id, "name": String(definition.get("label", id)), "count": count})
	return rows

static func _dict(value: Variant) -> Dictionary:
	return value if value is Dictionary else {}
