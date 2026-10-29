extends RefCounted
## SURV-030A isolated adapter. NOT an autoload and NOT a second save authority.
## A0 mounts this with the real SaveService and a resolver for placed stations.
## Unique items use one SaveService key_item stack token per instance. Attributes
## and production escrow live in the SAME candidate document, never a side file.

const ROOT := "survival_economy"
const SCHEMA := 1
const CATALOG_ROOT := "res://data/survival/"
const MAX_EVENT_LENGTH := 96

var _save: Node
var _station_resolver: Callable
var catalog: Dictionary = {}
var last_error := ""

func configure(save_service: Node, station_resolver: Callable = Callable()) -> bool:
	if save_service == null or not save_service.has_method(&"transact_once") \
			or not save_service.has_method(&"add_items_to_candidate") \
			or not save_service.has_method(&"remove_items_from_candidate") \
			or not save_service.has_method(&"get_inventory_stacks"):
		last_error = "incompatible_save_service"
		return false
	_save = save_service
	_station_resolver = station_resolver
	return load_catalog()

func load_catalog() -> bool:
	catalog = {}
	for pair in [["items","items/items.json"],["recipes","recipes/recipes.json"],
			["stations","recipes/stations.json"],["technologies","recipes/research.json"],
			["sources","items/sources.json"]]:
		var file := FileAccess.open(CATALOG_ROOT + pair[1], FileAccess.READ)
		if file == null:
			last_error = "missing_catalog:" + pair[1]
			return false
		var parsed: Variant = JSON.parse_string(file.get_as_text())
		file.close()
		if not parsed is Dictionary or not parsed.get(pair[0]) is Dictionary:
			last_error = "invalid_catalog:" + pair[1]
			return false
		catalog[pair[0]] = parsed[pair[0]]
	last_error = ""
	return true

func document() -> Dictionary:
	if _save == null:
		return {}
	var raw: Variant = _save.call(&"get_snapshot")
	return _state(raw)

func _state(candidate: Dictionary) -> Dictionary:
	var raw: Variant = candidate.get(ROOT, {})
	var state: Dictionary = raw if raw is Dictionary else {}
	if int(state.get("schema", 0)) > SCHEMA:
		return {}
	return {
		"schema": SCHEMA,
		"instances": state.get("instances", {}) if state.get("instances", {}) is Dictionary else {},
		"jobs": state.get("jobs", {}) if state.get("jobs", {}) is Dictionary else {},
		"technologies": state.get("technologies", {}) if state.get("technologies", {}) is Dictionary else {},
		"commands": state.get("commands", {}) if state.get("commands", {}) is Dictionary else {},
		"counter": maxi(0, int(state.get("counter", 0))),
	}

func item(item_id: String) -> Dictionary:
	return catalog.get("items", {}).get(item_id, {})

func recipe(recipe_id: String) -> Dictionary:
	return catalog.get("recipes", {}).get(recipe_id, {})

func known(recipe_id: String) -> bool:
	var r := recipe(recipe_id)
	if r.is_empty():
		return false
	if String(r.get("knowledge", "")) == "starter":
		return true
	var snapshot: Dictionary = _save.call(&"get_snapshot")
	var survival: Dictionary = snapshot.get("survival", {})
	var knowledge: Dictionary = survival.get("knowledge", {})
	return (knowledge.get("recipes", {}) as Dictionary).has(recipe_id)

func knows_technology(technology_id: String) -> bool:
	return document().get("technologies", {}).has(technology_id)

func instance(instance_id: String) -> Dictionary:
	return document().get("instances", {}).get(instance_id, {}).duplicate(true)

func jobs() -> Dictionary:
	return document().get("jobs", {}).duplicate(true)

func inventory_totals() -> Dictionary:
	var totals: Dictionary = {}
	var instances: Dictionary = document().get("instances", {})
	var stacks: Dictionary = _save.call(&"get_inventory_stacks")
	for key: Variant in stacks.keys():
		var record: Dictionary = stacks[key]
		var id := String(record.get("item_id", String(key)))
		var quantity := int(record.get("quantity", 0))
		if instances.has(id):
			if quantity != 1:
				continue # Corrupt unique token is quarantined, never merged.
			id = String(instances[id].get("item_id", ""))
		totals[id] = int(totals.get(id, 0)) + quantity
	return totals

func owned_instances(item_id := "") -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var stacks: Dictionary = _save.call(&"get_inventory_stacks")
	for id: Variant in document().get("instances", {}).keys():
		var record: Dictionary = document()["instances"][id]
		if String(record.get("location", "")) != "bag" or not stacks.has(id):
			continue
		if item_id.is_empty() or String(record.get("item_id", "")) == item_id:
			result.append(record.duplicate(true))
	result.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return String(a["instance_id"]) < String(b["instance_id"]))
	return result

func _ok(extra: Dictionary = {}) -> Dictionary:
	var result := {"ok": true, "reason": "", "duplicate": false}
	result.merge(extra, true)
	return result

func _fail(reason: String) -> Dictionary:
	last_error = reason
	return {"ok": false, "reason": reason, "duplicate": false}

func _event_key(operation: String, event_id: String) -> String:
	return "soh.a3.%s.%s" % [operation, event_id.sha256_text()]

## Payload binding prevents a reused event id from authorizing different args.
func _transact(operation: String, event_id: String, payload: Dictionary, mutator: Callable) -> Dictionary:
	last_error = ""
	if _save == null:
		return _fail("not_configured")
	if event_id.is_empty() or event_id.length() > MAX_EVENT_LENGTH:
		return _fail("invalid_event_id")
	var key := _event_key(operation, event_id)
	var signature := JSON.stringify(payload).sha256_text()
	var commands: Dictionary = document().get("commands", {})
	if bool(_save.call(&"is_transaction_applied", key)):
		if String(commands.get(key, "")) == signature:
			return _ok({"duplicate": true})
		return _fail("event_id_conflict")
	var result := {"ok": false, "reason": "rejected"}
	var applied := bool(_save.call(&"transact_once", key, func(candidate: Dictionary) -> bool:
		var state := _state(candidate)
		if not bool(mutator.call(candidate, state, result)):
			return false
		state["commands"][key] = signature
		candidate[ROOT] = state
		return true
	, {"kind": "survival_economy", "operation": operation, "event_id": event_id}))
	if not applied:
		return _fail(String(result.get("reason", "commit_failed")))
	result["ok"] = true
	result["duplicate"] = false
	return result

func _remove(candidate: Dictionary, item_id: String, quantity: int) -> bool:
	return bool(_save.call(&"remove_items_from_candidate", candidate, item_id, quantity))

func _add(candidate: Dictionary, item_id: String, quantity: int, kind := "material") -> bool:
	return bool(_save.call(&"add_items_to_candidate", candidate, item_id, kind, quantity,
		{"source": "survival_economy", "display_name": String(item(item_id).get("label", item_id))}))

func _add_outputs(candidate: Dictionary, outputs: Dictionary) -> bool:
	for id: Variant in outputs.keys():
		var definition := item(String(id))
		if definition.is_empty():
			return false
		if String(definition.get("storage", "")) == "instance":
			continue # Unique outputs are carried by output_instances tokens, not stacks.
		if String(definition.get("storage", "")) != "stack":
			return false
		var kind := String(definition.get("kind", "material"))
		if kind == "station_kit":
			kind = "material"
		if not _add(candidate, String(id), int(outputs[id]), kind):
			return false
	return true

func _take_inputs(candidate: Dictionary, state: Dictionary, inputs: Dictionary, reserved: Dictionary) -> bool:
	for id: Variant in inputs.keys():
		var amount := int(inputs[id])
		if amount <= 0 or item(String(id)).is_empty():
			return false
		if String(item(String(id)).get("storage", "")) == "instance":
			# Unique ingredients are explicit instance ids, never arbitrary stacks.
			return false
		if not _remove(candidate, String(id), amount):
			return false
		reserved[id] = amount
	return true

func _station(station_id: String, required_kind: String, tier: int) -> Dictionary:
	if required_kind == "hand":
		return {"ok": true, "kind": "hand", "tier": 0, "queue_capacity": 1, "operational": true}
	if not _station_resolver.is_valid():
		return {}
	var value: Variant = _station_resolver.call(station_id)
	if not value is Dictionary:
		return {}
	var station: Dictionary = value
	if not bool(station.get("ok", false)) or String(station.get("station_id", "")) != station_id:
		return {}
	if String(station.get("kind", "")) != required_kind or int(station.get("tier", 0)) < tier:
		return {}
	if not bool(station.get("operational", false)) or int(station.get("condition", 0)) <= 0:
		return {}
	return station

func _prerequisites(candidate: Dictionary, state: Dictionary, required: Array) -> bool:
	for id: Variant in required:
		if not (state.get("technologies", {}) as Dictionary).has(String(id)):
			return false
	return true

func _learn(candidate: Dictionary, recipe_id: String, source: String) -> void:
	# Preserve every A0 survival field; do NOT round-trip through its v1 sanitizer.
	var survival: Dictionary = candidate.get("survival", {})
	if survival.is_empty():
		survival = {"schema": 1, "knowledge": {"recipes": {}}}
	var knowledge: Dictionary = survival.get("knowledge", {"recipes": {}})
	var recipes: Dictionary = knowledge.get("recipes", {})
	recipes[recipe_id] = {"source": source, "learned_at": 0}
	knowledge["recipes"] = recipes
	survival["knowledge"] = knowledge
	candidate["survival"] = survival

func enqueue(recipe_id: String, station_id: String, event_id: String) -> Dictionary:
	var r := recipe(recipe_id)
	if r.is_empty():
		return _fail("unknown_recipe")
	return _transact("enqueue", event_id, {"recipe": recipe_id, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			if not known(recipe_id):
				result["reason"] = "recipe_not_learned"; return false
			if not _prerequisites(candidate, state, r.get("required_technologies", [])):
				result["reason"] = "technology_missing"; return false
			var station := _station(station_id, String(r["station"]), int(r["min_tier"]))
			if station.is_empty():
				result["reason"] = "station_unavailable"; return false
			var count := 0
			for job: Variant in state["jobs"].values():
				if String(job["station_id"]) == station_id and String(job["status"]) in ["queued", "running", "paused", "ready", "cancelled"]:
					count += 1
			if count >= int(station.get("queue_capacity", 1)):
				result["reason"] = "queue_full"; return false
			var reserved := {}
			var fuel_reserved := {}
			if not _take_inputs(candidate, state, r["inputs"], reserved) \
					or not _take_inputs(candidate, state, r.get("fuel", {}), fuel_reserved):
				result["reason"] = "insufficient_or_invalid_inputs"; return false
			state["counter"] = int(state["counter"]) + 1
			var id := "job_%06d" % int(state["counter"])
			state["jobs"][id] = {"job_id": id, "kind": "craft", "target": recipe_id,
				"station_id": station_id, "station_kind": String(r["station"]), "tier": int(r["min_tier"]),
				"status": "queued", "elapsed": 0, "duration": maxi(1, int(r["duration_ticks"])),
				"reserved": reserved, "reserved_instances": {}, "outputs": {}, "output_instances": {}}
			result["job_id"] = id
			return true)

## Explicit active-session ticks only. No wall-clock/offline catch-up.
## A0 owns station removal and must refuse removal with unresolved jobs.
func advance(station_id: String, ticks: int, event_id: String) -> Dictionary:
	if ticks < 0 or ticks > 3600:
		return _fail("invalid_ticks")
	return _transact("advance", event_id, {"station": station_id, "ticks": ticks},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var ids: Array = state["jobs"].keys()
			ids.sort()
			var station: Dictionary = {}
			var remaining := ticks
			var completed: Array[String] = []
			for id: Variant in ids:
				var job: Dictionary = state["jobs"][id]
				if String(job["station_id"]) != station_id or String(job["status"]) not in ["queued","running","paused"]:
					continue
				if station.is_empty():
					station = _station(station_id, String(job["station_kind"]), int(job["tier"]))
				if station.is_empty():
					job["status"] = "paused"
					continue
				job["status"] = "running"
				var used := mini(remaining, int(job["duration"]) - int(job["elapsed"]))
				job["elapsed"] = int(job["elapsed"]) + used
				remaining -= used
				if int(job["elapsed"]) >= int(job["duration"]):
					_finish_job(candidate, state, job)
					completed.append(String(id))
				if remaining <= 0:
					break
			result["completed"] = completed
			return true)

func _finish_job(candidate: Dictionary, state: Dictionary, job: Dictionary) -> void:
	job["reserved_fuel"] = {}
	if String(job["kind"]) == "technology":
		state["technologies"][String(job["target"])] = {"source": "research"}
	elif String(job["kind"]) == "research":
		_learn(candidate, String(job["target"]), "research:" + String(job["job_id"]))
		for old_id: Variant in (job.get("reserved_instances", {}) as Dictionary).keys():
			state["instances"][old_id]["location"] = "consumed_by_research"
			state["instances"][old_id]["revision"] = int(state["instances"][old_id]["revision"]) + 1
	else:
		var r := recipe(String(job["target"]))
		if r.has("consumes_specimen"):
			for old_id: Variant in (job.get("reserved_instances", {}) as Dictionary).keys():
				state["instances"][old_id]["location"] = "reconstructed"
				state["instances"][old_id]["revision"] = int(state["instances"][old_id]["revision"]) + 1
		job["outputs"] = (r["outputs"] as Dictionary).duplicate(true)
		for id: Variant in (job.get("outputs", {}) as Dictionary).keys():
			if String(item(String(id)).get("storage", "")) == "instance":
				var record := _new_instance(state, String(id), "job_output", int(job["outputs"][id]))
				job["output_instances"][String(record["instance_id"])] = record
	job["status"] = "ready"
	job["reserved"] = {}
	job["reserved_instances"] = {}

func _new_instance(state: Dictionary, item_id: String, location: String, quantity := 1) -> Dictionary:
	var definition := item(item_id)
	state["counter"] = int(state["counter"]) + 1
	var id := "soh_i_%012d_%s" % [int(state["counter"]), String(definition.get("kind", "item")).md5_text().left(8)]
	var record := {"instance_id": id, "item_id": item_id, "location": location,
		"condition": int(definition.get("max_condition", 100)),
		"max_condition": int(definition.get("max_condition", 100)),
		"uses": int(definition.get("max_uses", 0)), "max_uses": int(definition.get("max_uses", 0)),
		"revision": 0, "origin": "economy"}
	state["instances"][id] = record
	return record

## Spawn/loot adapters call this only after their own durable source claim.
func grant_instance(item_id: String, source_event: String, uses := -1, condition := -1) -> Dictionary:
	var definition := item(item_id)
	if definition.is_empty() or String(definition.get("storage", "")) != "instance":
		return _fail("not_an_instance_item")
	return _transact("grant", source_event, {"item": item_id, "uses": uses, "condition": condition},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var record := _new_instance(state, item_id, "bag")
			if uses >= 0:
				record["uses"] = mini(uses, int(record["max_uses"]))
			if condition >= 0:
				record["condition"] = mini(condition, int(record["max_condition"]))
			if not _add(candidate, String(record["instance_id"]), 1, "key_item"):
				state["instances"].erase(record["instance_id"])
				result["reason"] = "inventory_full"; return false
			result["instance_id"] = record["instance_id"]
			return true)

func collect(job_id: String, event_id: String) -> Dictionary:
	return _transact("collect", event_id, {"job": job_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var job: Dictionary = state["jobs"].get(job_id, {})
			if job.is_empty() or String(job["status"]) != "ready":
				result["reason"] = "nothing_to_collect"; return false
			var trial: Dictionary = candidate.duplicate(true)
			if not _add_outputs(trial, job.get("outputs", {})):
				result["reason"] = "inventory_full"; return false
			for id: Variant in (job.get("output_instances", {}) as Dictionary).keys():
				if not _add(trial, String(id), 1, "key_item"):
					result["reason"] = "inventory_full"; return false
			# Capacity is all-or-nothing; only now apply to the real candidate.
			if not _add_outputs(candidate, job.get("outputs", {})):
				result["reason"] = "inventory_full"; return false
			for id: Variant in (job.get("output_instances", {}) as Dictionary).keys():
				if not _add(candidate, String(id), 1, "key_item"):
					result["reason"] = "inventory_full"; return false
				state["instances"][id]["location"] = "bag"
			job["status"] = "collected"
			job["outputs"] = {}
			job["output_instances"] = {}
			result["job_id"] = job_id
			return true)

func cancel(job_id: String, event_id: String) -> Dictionary:
	return _transact("cancel", event_id, {"job": job_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var job: Dictionary = state["jobs"].get(job_id, {})
			if job.is_empty() or String(job["status"]) not in ["queued","running","paused"]:
				result["reason"] = "cannot_cancel"; return false
			# Ingredients/specimens return to escrow; fuel already committed is burned.
			job["outputs"] = (job.get("reserved", {}) as Dictionary).duplicate(true)
			job["output_instances"] = (job.get("reserved_instances", {}) as Dictionary).duplicate(true)
			job["reserved"] = {}
			job["reserved_fuel"] = {}
			job["reserved_instances"] = {}
			job["status"] = "ready"
			result["job_id"] = job_id
			return true)

func research_technology(technology_id: String, station_id: String, event_id: String) -> Dictionary:
	var t: Dictionary = catalog.get("technologies", {}).get(technology_id, {})
	if t.is_empty():
		return _fail("unknown_technology")
	return _transact("tech", event_id, {"technology": technology_id, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			if knows_technology(technology_id):
				result["reason"] = "already_known"; return false
			if not _prerequisites(candidate, state, t["prerequisites"]):
				result["reason"] = "technology_missing"; return false
			for job: Variant in state["jobs"].values():
				if String(job["target"]) == technology_id and String(job["status"]) in ["queued","running","paused","ready"]:
					result["reason"] = "research_pending"; return false
			var station := _station(station_id, "research", int(t["min_tier"]))
			if station.is_empty():
				result["reason"] = "station_unavailable"; return false
			var reserved := {}
			if not _take_inputs(candidate, state, t["inputs"], reserved):
				result["reason"] = "insufficient_inputs"; return false
			state["counter"] = int(state["counter"]) + 1
			var id := "job_%06d" % int(state["counter"])
			state["jobs"][id] = {"job_id": id, "kind": "technology", "target": technology_id,
				"station_id": station_id, "station_kind": "research", "tier": 1, "status": "queued",
				"elapsed": 0, "duration": int(t["duration_ticks"]), "reserved": reserved,
				"reserved_instances": {}, "outputs": {}, "output_instances": {}}
			result["job_id"] = id
			return true)

## method: blueprint (physical plan), specimen (sacrifice a Core), or targeted.
func research_recipe(recipe_id: String, station_id: String, method: String, event_id: String, specimen_id := "") -> Dictionary:
	var r := recipe(recipe_id)
	if r.is_empty():
		return _fail("unknown_recipe")
	return _transact("research", event_id, {"recipe": recipe_id, "station": station_id, "method": method, "specimen": specimen_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			if known(recipe_id):
				result["reason"] = "already_known"; return false
			for job: Variant in state["jobs"].values():
				if String(job["target"]) == recipe_id and String(job["kind"]) == "research" and String(job["status"]) in ["queued","running","paused","ready"]:
					result["reason"] = "research_pending"; return false
			var station := _station(station_id, "research", 1)
			if station.is_empty():
				result["reason"] = "station_unavailable"; return false
			var costs := {"knowledge_spares": 3}
			var reserved := {}
			var reserved_instances := {}
			var specimen: Dictionary = state["instances"].get(specimen_id, {})
			if method == "blueprint":
				var plan_id := ""
				for id: Variant in catalog["items"].keys():
					if String(catalog["items"][id].get("unlocks_recipe", "")) == recipe_id:
						plan_id = String(id)
				if plan_id.is_empty():
					result["reason"] = "no_blueprint_for_recipe"; return false
				costs[plan_id] = 1
			elif method == "specimen":
				var outputs: Dictionary = r.get("outputs", {})
				if outputs.size() != 1:
					result["reason"] = "invalid_research_output"; return false
				var expected := String(outputs.keys()[0])
				if specimen.is_empty() or String(specimen.get("item_id", "")) != expected \
						or String(specimen.get("location", "")) != "bag":
					result["reason"] = "specimen_not_owned"; return false
				if not _remove(candidate, specimen_id, 1):
					result["reason"] = "specimen_not_owned"; return false
				specimen["location"] = "research:" + String(event_id)
				reserved_instances[specimen_id] = specimen
				costs["knowledge_spares"] = 5
			elif method == "targeted":
				costs = {"knowledge_spares": 6, "research_notes": 2}
			else:
				result["reason"] = "unknown_research_method"; return false
			if not _prerequisites(candidate, state, r.get("required_technologies", [])):
				result["reason"] = "technology_missing"; return false
			if not _take_inputs(candidate, state, costs, reserved):
				result["reason"] = "insufficient_inputs"; return false
			state["counter"] = int(state["counter"]) + 1
			var id := "job_%06d" % int(state["counter"])
			state["jobs"][id] = {"job_id": id, "kind": "research", "target": recipe_id,
				"station_id": station_id, "station_kind": "research", "tier": 1, "status": "queued",
				"elapsed": 0, "duration": 40, "reserved": reserved, "reserved_instances": reserved_instances,
				"outputs": {}, "output_instances": {}}
			result["job_id"] = id
			return true)

func dismantle_stack(item_id: String, amount: int, station_id: String, event_id: String) -> Dictionary:
	
	var definition := item(item_id)
	var salvage: Dictionary = definition.get("salvage", {})
	if amount <= 0 or salvage.is_empty():
		return _fail("not_dismantlable")
	return _transact("dismantle", event_id, {"item": item_id, "quantity": amount, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			if _station(station_id, String(salvage["station"]), int(salvage["min_tier"])).is_empty():
				result["reason"] = "station_unavailable"; return false
			var outputs := {}
			for id: Variant in (salvage["outputs"] as Dictionary).keys():
				outputs[id] = int(salvage["outputs"][id]) * amount
			var trial: Dictionary = candidate.duplicate(true)
			if not _remove(trial, item_id, amount) or not _add_outputs(trial, outputs):
				result["reason"] = "insufficient_inputs_or_inventory_full"; return false
			if not _remove(candidate, item_id, amount) or not _add_outputs(candidate, outputs):
				result["reason"] = "insufficient_inputs_or_inventory_full"; return false
			return true)

func dismantle_instance(instance_id: String, station_id: String, event_id: String) -> Dictionary:
	return _transact("dismantle_instance", event_id, {"instance": instance_id, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var record: Dictionary = state["instances"].get(instance_id, {})
			if record.is_empty() or String(record["location"]) != "bag":
				result["reason"] = "instance_not_owned"; return false
			var salvage: Dictionary = item(String(record["item_id"])).get("salvage", {})
			if salvage.is_empty():
				result["reason"] = "not_dismantlable"; return false
			if _station(station_id, String(salvage["station"]), int(salvage["min_tier"])).is_empty():
				result["reason"] = "station_unavailable"; return false
			var trial: Dictionary = candidate.duplicate(true)
			if not _remove(trial, instance_id, 1) or not _add_outputs(trial, salvage["outputs"]):
				result["reason"] = "inventory_full"; return false
			if not _remove(candidate, instance_id, 1) or not _add_outputs(candidate, salvage["outputs"]):
				result["reason"] = "inventory_full"; return false
			record["location"] = "dismantled"
			record["revision"] = int(record["revision"]) + 1
			return true)

func repair(instance_id: String, station_id: String, event_id: String) -> Dictionary:
	return _transact("repair", event_id, {"instance": instance_id, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var record: Dictionary = state["instances"].get(instance_id, {})
			if record.is_empty() or String(record["location"]) != "bag":
				result["reason"] = "instance_not_owned"; return false
			var definition := item(String(record["item_id"]))
			if String(definition.get("repair_policy", "")) != "material_repair":
				result["reason"] = "core_requires_reconstruction"; return false
			var missing := int(record["max_condition"]) - int(record["condition"])
			if missing <= 0:
				result["reason"] = "already_full_condition"; return false
			if _station(station_id, "workbench", 1).is_empty():
				result["reason"] = "station_unavailable"; return false
			var costs := {"iron_parts": maxi(1, int(ceil(float(missing) / 25.0))), "binding_cloth": 1}
			var reserved := {}
			if not _take_inputs(candidate, state, costs, reserved):
				result["reason"] = "insufficient_inputs"; return false
			record["condition"] = record["max_condition"]
			record["revision"] = int(record["revision"]) + 1
			return true)

func reconstruct_core(recipe_id: String, specimen_id: String, station_id: String, event_id: String) -> Dictionary:
	var r := recipe(recipe_id)
	if r.is_empty() or String(r.get("category", "")) != "reconstruction":
		return _fail("not_a_reconstruction")
	return _transact("reconstruct", event_id, {"recipe": recipe_id, "specimen": specimen_id, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			if not known(recipe_id) or not _prerequisites(candidate, state, r["required_technologies"]):
				result["reason"] = "knowledge_missing"; return false
			var record: Dictionary = state["instances"].get(specimen_id, {})
			if record.is_empty() or String(record["location"]) != "bag" \
					or String(record["item_id"]) != String(r["consumes_specimen"]):
				result["reason"] = "specimen_not_owned"; return false
			var station := _station(station_id, String(r["station"]), int(r["min_tier"]))
			if station.is_empty():
				result["reason"] = "station_unavailable"; return false
			var count := 0
			for job: Variant in state["jobs"].values():
				if String(job["station_id"]) == station_id and String(job["status"]) in ["queued","running","paused","ready","cancelled"]:
					count += 1
			if count >= int(station.get("queue_capacity", 1)):
				result["reason"] = "queue_full"; return false
			var reserved := {}
			var fuel_reserved := {}
			if not _remove(candidate, specimen_id, 1) or not _take_inputs(candidate, state, r["inputs"], reserved) \
					or not _take_inputs(candidate, state, r.get("fuel", {}), fuel_reserved):
				result["reason"] = "insufficient_inputs"; return false
			record["location"] = "reconstruction:" + specimen_id
			state["counter"] = int(state["counter"]) + 1
			var id := "job_%06d" % int(state["counter"])
			state["jobs"][id] = {"job_id": id, "kind": "craft", "target": recipe_id,
				"station_id": station_id, "station_kind": String(r["station"]), "tier": int(r["min_tier"]),
				"status": "queued", "elapsed": 0, "duration": int(r["duration_ticks"]),
				"reserved": reserved, "reserved_fuel": fuel_reserved, "reserved_instances": {specimen_id: record}, "outputs": {}, "output_instances": {}}
			result["job_id"] = id
			return true)

## A4 calls this at the authoritative gameplay commit boundary, not at VFX start.
## The gate must attest the exact abstract skill and verified native readiness.
func commit_cast(instance_id: String, cast_id: String, expected_revision: int, skill_gate: Callable) -> Dictionary:
	return _transact("cast", cast_id, {"instance": instance_id, "revision": expected_revision},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var record: Dictionary = state["instances"].get(instance_id, {})
			if record.is_empty() or String(record["location"]) != "bag" or not (candidate["inventory"]["item_stacks"] as Dictionary).has(instance_id):
				result["reason"] = "core_not_owned"; return false
			if int(record["revision"]) != expected_revision:
				result["reason"] = "stale_revision"; return false
			if int(record["uses"]) <= 0 or int(record["condition"]) <= 0:
				result["reason"] = "core_depleted"; return false
			var definition := item(String(record["item_id"]))
			if String(definition.get("kind", "")) != "skill_core" or not skill_gate.is_valid():
				result["reason"] = "skill_gate_unavailable"; return false
			var attestation: Variant = skill_gate.call(String(definition.get("abstract_skill_id", "")))
			if not attestation is Dictionary or not bool(attestation.get("ready", false)) \
					or String(attestation.get("abstract_skill_id", "")) != String(definition.get("abstract_skill_id", "")):
				result["reason"] = "skill_not_verified"; return false
			record["uses"] = int(record["uses"]) - 1
			record["revision"] = int(record["revision"]) + 1
			result["remaining_uses"] = record["uses"]
			return true)

func wear(instance_id: String, amount: int, event_id: String) -> Dictionary:
	if amount <= 0:
		return _fail("invalid_wear")
	return _transact("wear", event_id, {"instance": instance_id, "amount": amount},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var record: Dictionary = state["instances"].get(instance_id, {})
			if record.is_empty() or String(record["location"]) != "bag":
				result["reason"] = "instance_not_owned"; return false
			record["condition"] = maxi(0, int(record["condition"]) - amount)
			record["revision"] = int(record["revision"]) + 1
			return true)
