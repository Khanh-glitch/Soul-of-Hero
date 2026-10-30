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

## A3 catalogs use `knowledge: starter|recipe`; saved formula ownership is a
## separate host projection. Never treat a physical Core instance as knowledge.
static func recipe_status(knowledge: String, formula_learned: Variant) -> String:
	if knowledge == "starter": return "Starter catalog"
	if not formula_learned is bool: return "Knowledge state unavailable"
	if formula_learned: return "Formula learned"
	if knowledge == "recipe": return "Research required"
	return "Knowledge unavailable"

## Maps A3's dictionary-shaped recipe catalog into the A6-only view DTO. The
## caller must derive `formula_learned`, visible ingredient counts, station/queue
## state and capability decisions from their respective authorities.
static func recipe_presentation(recipe_id: String, source: Dictionary, ingredient_state: Dictionary, formula_learned: Variant, disclosed: bool, station_status: String = "Unknown", queue_status: String = "Unknown", blocked_reason: String = "") -> Dictionary:
	if not disclosed or recipe_id.is_empty() or String(source.get("id", "")) != recipe_id: return {}
	var inputs: Variant = source.get("inputs", {})
	if not inputs is Dictionary: return {}
	var ingredients: Array[Dictionary] = []
	var input_ids: Array = inputs.keys()
	input_ids.sort()
	for raw_id: Variant in input_ids:
		var item_id := String(raw_id)
		var supplied: Variant = ingredient_state.get(item_id, {})
		var view: Dictionary = supplied if supplied is Dictionary else {}
		ingredients.append({
			"id": item_id,
			"name": String(view.get("name", item_id.replace("_", " ").capitalize())),
			"have": maxi(0, int(view.get("have", 0))),
			"need": int(inputs[raw_id]),
			"source": String(view.get("source", "")),
		})
	var fuel: Variant = source.get("fuel", {})
	if fuel is Dictionary:
		var fuel_ids: Array = fuel.keys()
		fuel_ids.sort()
		for raw_fuel_id: Variant in fuel_ids:
			var fuel_id := String(raw_fuel_id)
			var supplied_fuel: Variant = ingredient_state.get(fuel_id, {})
			var fuel_view: Dictionary = supplied_fuel if supplied_fuel is Dictionary else {}
			ingredients.append({
				"id": fuel_id,
				"kind": "fuel",
				"name": String(fuel_view.get("name", fuel_id.replace("_", " ").capitalize())),
				"have": maxi(0, int(fuel_view.get("have", 0))),
				"need": int(fuel[raw_fuel_id]),
				"source": String(fuel_view.get("source", "")),
			})
	var result := {
		"id": recipe_id,
		"name": String(source.get("label", recipe_id.replace("_", " ").capitalize())),
		"revealed": true,
		"knowledge": String(source.get("knowledge", "Unknown")),
		"station": String(source.get("station", "Unknown")),
		"min_tier": int(source.get("min_tier", 0)),
		"duration_ticks": int(source.get("duration_ticks", 0)),
		"required_technologies": _string_array(source.get("required_technologies", [])),
		"outputs": _dict(source.get("outputs", {})).duplicate(true),
		"ingredients": ingredients,
		"station_status": station_status,
		"queue_status": queue_status,
		"can_craft": false,
		"can_research": false,
		"blocked_reason": blocked_reason,
		"balance_status": String(source.get("balance_status", "Unknown")),
	}
	if formula_learned is bool: result["formula_learned"] = formula_learned
	if source.has("consumes_specimen"):
		result["consumes_specimen"] = String(source.consumes_specimen)
		result["research_warning"] = "Consumes %s only if the A3 research owner validates the exact specimen instance and commits successfully." % String(source.consumes_specimen)
	return result

## A1 authors static POI/material/hazard/capability contracts only. These helpers
## require an explicit A0 discovery result and never reveal records on their own.
static func poi_presentation(record: Dictionary, discovered: bool, route_status: String = "Unknown") -> Dictionary:
	if not discovered: return {}
	var poi_id := String(record.get("poi_id", ""))
	var cell: Variant = record.get("cell", null)
	if poi_id.is_empty() or not cell is Array or cell.size() != 2: return {}
	var position := Vector2(float(cell[0]) / 1024.0, float(cell[1]) / 768.0)
	if position.x < 0.0 or position.x > 1.0 or position.y < 0.0 or position.y > 1.0: return {}
	return {
		"id": poi_id,
		"poi_id": poi_id,
		"name": String(record.get("name", poi_id)),
		"revealed": true,
		"position": position,
		"route": route_status,
		"hazard_id": String(record.get("hazard_id", "")),
		"activity": String(record.get("purpose", "Unknown")),
		"region_id": String(record.get("region_id", "Unknown")),
		"material_keys": _string_array(record.get("material_keys", [])),
		"required_capabilities": _string_array(record.get("required_capabilities", [])),
		"content_readiness": String(record.get("content_readiness", "Unknown")),
		"status": String(record.get("status", "Unknown")),
	}

static func hazard_presentation(record: Dictionary, discovered: bool, exposure_status: String = "Unknown") -> Dictionary:
	if not discovered: return {}
	var hazard_id := String(record.get("hazard_id", ""))
	if hazard_id.is_empty(): return {}
	return {
		"id": hazard_id,
		"hazard_id": hazard_id,
		"name": String(record.get("clue", hazard_id)),
		"revealed": true,
		"kind": String(record.get("kind", "Unknown")),
		"severity": int(record.get("severity", 0)),
		"required_capability": String(record.get("requires", "")),
		"region_id": String(record.get("region_id", "Unknown")),
		"exposure_status": exposure_status,
		"status": "AUTHORED_CONTRACT_NOT_NATIVE_INTEGRATED",
	}

static func material_source_hint(record: Dictionary, discovered: bool) -> String:
	if not discovered: return ""
	var key := String(record.get("material_key", ""))
	var node_id := String(record.get("node_id", ""))
	if key.is_empty() or node_id.is_empty(): return ""
	var status := String(record.get("status", "Unknown"))
	return "%s · %s · %s" % [key.replace("_", " ").capitalize(), node_id, status]

static func capability_presentation(capability_id: String, record: Dictionary, owned: Variant = null, status_reason: String = "") -> Dictionary:
	if capability_id.is_empty() or not capability_id.begins_with("cap_"): return {}
	var result := {
		"id": capability_id,
		"kind": String(record.get("kind", "Unknown")),
		"source_poi": String(record.get("source", "Unknown")),
		"materials": _string_array(record.get("materials", [])),
		"prerequisites": _string_array(record.get("requires", [])),
		"status_reason": status_reason,
		"presentation_only": true,
	}
	if owned is bool: result["owned"] = owned
	return result

static func _string_array(value: Variant) -> Array[String]:
	var result: Array[String] = []
	if value is Array:
		for entry: Variant in value:
			if entry is String: result.append(entry)
	return result

static func core_status(uses: int, maximum: int) -> String:
	if maximum <= 0 or uses < 0 or uses > maximum:
		return "Uses unavailable"
	return "Exhausted · 0/%d uses" % maximum if uses == 0 else "%d/%d uses remaining" % [uses, maximum]

## A3's physical instance vocabulary is `instance_id`, `item_id`, `uses` /
## `max_uses`, integer condition / max_condition, location and revision. This
## display adapter keeps that identity intact. Equipment, formula knowledge and
## readiness must be supplied by their own owners; they are never inferred here.
static func core_instance(instance: Dictionary, item_label: String, equipped: Variant = null, formula_learned: Variant = null, can_equip: Variant = null, readiness: String = "Not verified") -> Dictionary:
	var instance_id := String(instance.get("instance_id", ""))
	var item_id := String(instance.get("item_id", ""))
	var uses := int(instance.get("uses", -1))
	var max_uses := int(instance.get("max_uses", -1))
	var condition := int(instance.get("condition", -1))
	var max_condition := int(instance.get("max_condition", -1))
	if not instance_id.begins_with("soh_i_") or item_id.is_empty(): return {}
	if uses < 0 or max_uses < 0 or uses > max_uses or condition < 0 or max_condition <= 0 or condition > max_condition: return {}
	var label := item_label.strip_edges()
	if label.is_empty(): label = item_id.replace("_", " ").capitalize()
	var result := {
		"id": instance_id,
		"instance_id": instance_id,
		"item_id": item_id,
		"name": label,
		"kind": "core",
		"uses": uses,
		"max_uses": max_uses,
		"condition": condition,
		"max_condition": max_condition,
		"location": String(instance.get("location", "Unknown")),
		"revision": int(instance.get("revision", 0)),
		"origin": String(instance.get("origin", "Unknown")),
		"ownership_state": core_ownership_state(instance, equipped),
		"readiness": readiness if not readiness.strip_edges().is_empty() else "Not verified",
		"presentation_only": true,
	}
	if equipped is bool: result["equipped"] = equipped
	if formula_learned is bool: result["formula_learned"] = formula_learned
	if can_equip is bool: result["can_equip"] = can_equip
	return result

## Physical custody, loadout, finite charges and A4 readiness are separate facts.
## An equipped Core is never inferred to be cast-ready.
static func core_ownership_state(instance: Dictionary, equipped: Variant = null) -> String:
	var location := String(instance.get("location", "")).to_lower()
	var uses := int(instance.get("uses", -1))
	var maximum := int(instance.get("max_uses", -1))
	if equipped is bool and equipped:
		if uses == 0 and maximum >= 0: return "Equipped · exhausted"
		if uses >= 0 and uses == maximum: return "Equipped · unused so far"
		if uses > 0: return "Equipped · charges remain"
		return "Equipped · charge state unknown"
	if location in ["bag", "satchel"]:
		return "In satchel · unequipped" if equipped is bool else "In satchel · equipment state unknown"
	if location in ["storage", "container", "chest"]: return "Stored · not equipped"
	if location in ["death_bag", "recovery_bag", "ground"]: return "In recovery custody · owner state required"
	return "Custody / equipment status unknown"

## A0's current transfer API takes an item ID, not a SaveService stack key.
## Totals are authoritative read accessors; this view neither authorizes nor
## performs transfers, checks capacity, nor asserts a chest is interactable.
## Read-only A0 projection. `a3_instances` is keyed by exact A3 instance_id;
## `a3_items` is the A3 catalog's items dictionary. Unique identity stays protected.
static func storage(save: Object, survival: Object, container_id: String, a3_instances: Dictionary = {}, a3_items: Dictionary = {}) -> Dictionary:
	var result := {"container_id": container_id, "transfer_enabled": false, "context_validation": "A0 host required", "bag": [], "chest": []}
	if save == null or survival == null or container_id.is_empty():
		return result
	if not save.has_method(&"inventory_totals") or not survival.has_method(&"container_contents"):
		return result
	var bag_totals: Dictionary = _dict(save.call(&"inventory_totals"))
	var chest_totals: Dictionary = _dict(survival.call(&"container_contents", container_id))
	var bag_stacks: Dictionary = _dict(save.call(&"get_inventory_stacks")) if save.has_method(&"get_inventory_stacks") else {}
	result.bag = _totals_as_rows(bag_totals, survival, "satchel", a3_instances, a3_items, bag_stacks)
	result.chest = _totals_as_rows(chest_totals, survival, "chest", a3_instances, a3_items, {})
	return result

static func _totals_as_rows(totals: Dictionary, survival: Object, location: String, a3_instances: Dictionary, a3_items: Dictionary, bag_stacks: Dictionary) -> Array[Dictionary]:
	var rows: Array[Dictionary] = []
	var keys := totals.keys()
	keys.sort()
	for raw_key: Variant in keys:
		var id := String(raw_key)
		var count := int(totals[raw_key])
		if id.is_empty() or count <= 0: continue
		var is_instance := id.begins_with("soh_i_")
		var instance: Dictionary = _dict(a3_instances.get(id, {})) if is_instance else {}
		var physical_item_id := String(instance.get("item_id", ""))
		var catalog_item_id := physical_item_id if not physical_item_id.is_empty() else id
		var catalog: Dictionary = _dict(a3_items.get(catalog_item_id, {}))
		var definition: Dictionary = _dict(survival.call(&"item_definition", catalog_item_id)) if survival.has_method(&"item_definition") else {}
		var stack_keys: Array[String] = []
		if location == "satchel":
			for raw_stack_key: Variant in bag_stacks.keys():
				var stack_key := String(raw_stack_key)
				var stack_record := _dict(bag_stacks[raw_stack_key])
				var stack_item_id := String(stack_record.get("item_id", stack_key)).strip_edges().to_lower()
				if stack_item_id == id: stack_keys.append(stack_key)
			stack_keys.sort()
		var protected := is_instance or String(catalog.get("storage", "")) == "instance" or String(catalog.get("kind", "")) == "skill_core"
		var transferable := false
		if not protected and survival.has_method(&"is_sweepable_item"):
			transferable = bool(survival.call(&"is_sweepable_item", id))
		var label := String(catalog.get("label", definition.get("label", "")))
		if protected and label.is_empty(): label = "Unique physical item · details unavailable"
		if label.is_empty(): label = id.replace("_", " ").capitalize()
		rows.append({
			"id": id,
			"name": label,
			"count": count,
			"location": location,
			"kind": String(catalog.get("kind", definition.get("kind", "unique" if protected else "item"))),
			"instance_id": id if is_instance else "",
			"physical_item_id": physical_item_id,
			"protected": protected,
			"transferable": transferable,
			"storage_status": "protected_unique_instance" if protected else "A0_sweepable" if transferable else "transfer_not_confirmed",
			"a3_revision": int(instance.get("revision", -1)),
			"stack_keys": stack_keys,
			"stack_record_present": not stack_keys.is_empty() if location == "satchel" else true,
		})
	return rows

static func _dict(value: Variant) -> Dictionary:
	return value if value is Dictionary else {}
