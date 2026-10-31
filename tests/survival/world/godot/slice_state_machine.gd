extends RefCounted
## SURV-050A isolated vertical-slice contract reducer. NOT a production save,
## inventory, capability, Hero movement, combat or damage system. It executes the
## authored adversarial vectors against an in-memory journal that models the
## *contract* of SaveService.transact_once (atomic commit, replay rejection,
## pending-not-durable). A0 must implement the real persistence boundary.

var contracts: Dictionary = {}
var handoff: Dictionary = {}
var state: Dictionary = {}
var last_error := ""


func configure(poi_contracts: Dictionary, slice_handoff: Dictionary) -> void:
	contracts = poi_contracts
	handoff = slice_handoff
	reset()


func reset() -> void:
	state = {
		"inventory": {},
		"capabilities": [],
		"active_tick": 0,
		"session_id": "slice-session-1",
		"hero_cell": Vector2i(392, 200),
		"pois": {},
		"journal": {},
		"pending": null,
	}
	for poi_id: String in contracts:
		state["pois"][poi_id] = (contracts[poi_id]["initial_persistent_state"] as Dictionary).duplicate(true)


func _result(result: String, reason: String = "", extra: Dictionary = {}) -> Dictionary:
	var out := {"result": result, "reason": reason}
	out.merge(extra, true)
	return out


func _poi(poi_id: String) -> Dictionary:
	return state["pois"].get(poi_id, {}) as Dictionary


func _action(poi_id: String, action_id: String) -> Dictionary:
	for action: Variant in contracts[poi_id]["actions"]:
		if String(action["action_id"]) == action_id:
			return action as Dictionary
	return {}


func _has_cap(cap: String) -> bool:
	return (state["capabilities"] as Array).has(cap)


func _item_count(item_id: String) -> int:
	return int((state["inventory"] as Dictionary).get(item_id, 0))


func _transaction_key(action: Dictionary, poi_state: Dictionary) -> String:
	var key := String(action["transaction_key_template"])
	if key.contains("{claim_index}"):
		var field := String(action.get("claim_index_field", "claim_count"))
		key = key.replace("{claim_index}", str(int(poi_state.get(field, 0)) + 1))
	return key


func apply(event: Dictionary) -> Dictionary:
	last_error = ""
	var kind := String(event.get("event", ""))
	match kind:
		"discover":
			return _discover(String(event["poi_id"]))
		"request_action":
			return _request_action(event)
		"commit":
			return _commit()
		"interrupt":
			state["pending"] = null
			return _result("SUCCESS")
		"reload":
			state["pending"] = null
			return _result("SUCCESS")
		"retreat", "death", "return":
			var poi_id := String(event.get("poi_id", "poi_crown_waystation"))
			var geo: Dictionary = contracts[poi_id]["immutable_geography"]
			state["hero_cell"] = Vector2i(int(geo["hero_return_cell"][0]), int(geo["hero_return_cell"][1]))
			return _result("SUCCESS")
		"set_inventory":
			state["inventory"] = (event["inventory"] as Dictionary).duplicate(true)
			return _result("SUCCESS")
		"set_capabilities":
			state["capabilities"] = (event["capabilities"] as Array).duplicate(true)
			return _result("SUCCESS")
		"advance_tick":
			state["active_tick"] = int(event["active_tick"])
			return _result("SUCCESS")
		"assert_inventory":
			var expected: Dictionary = event["inventory"]
			for item_id: String in expected:
				if _item_count(item_id) != int(expected[item_id]):
					return _result("REJECTED", "inventory_mismatch:" + item_id)
			return _result("SUCCESS")
		"assert_flag":
			var poi_state := _poi(String(event["poi_id"]))
			if poi_state.get(String(event["flag"])) != event["value"]:
				return _result("REJECTED", "flag_mismatch")
			return _result("SUCCESS")
		"check_route":
			return _check_route(event)
		"validate_geometry":
			return _validate_geometry(String(event["poi_id"]))
		"validate_identity":
			return _validate_identity()
		"spawn_check":
			return _spawn_check(event)
		"project_a6":
			return _project_a6(String(event["poi_id"]))
		_:
			return _result("REJECTED", "unknown_event:" + kind)


func _discover(poi_id: String) -> Dictionary:
	if not contracts.has(poi_id):
		return _result("REJECTED", "unknown_poi")
	var poi_state := _poi(poi_id)
	poi_state["discovered"] = true
	state["pois"][poi_id] = poi_state
	return _result("SUCCESS")


func _request_action(event: Dictionary) -> Dictionary:
	var poi_id := String(event["poi_id"])
	var action_id := String(event["action_id"])
	if not contracts.has(poi_id):
		return _result("REJECTED", "unknown_poi")
	var poi_state := _poi(poi_id)
	if not bool(poi_state.get("discovered", false)):
		return _result("REJECTED", "NOT_DISCOVERED")
	var action := _action(poi_id, action_id)
	if action.is_empty():
		return _result("REJECTED", "unknown_action")
	if not bool(action.get("enabled", true)):
		return _result("REJECTED", "DEFERRED:" + String(action.get("deferred_reason", "UNKNOWN")))
	var hero_cell := Vector2i(int(event["hero_cell"][0]), int(event["hero_cell"][1]))
	var in_range := false
	for stand: Variant in action["stand_cells"]:
		if hero_cell == Vector2i(int(stand[0]), int(stand[1])):
			in_range = true
	if not in_range:
		return _result("REJECTED", "OUT_OF_RANGE")
	for cap: Variant in action["requires_capabilities"]:
		if not _has_cap(String(cap)):
			return _result("REJECTED", "MISSING_CAPABILITY:" + String(cap))
	for item: Variant in action["consumes_items"]:
		if _item_count(String(item["item_id"])) < int(item["quantity"]):
			return _result("REJECTED", "MISSING_ITEM:" + String(item["item_id"]))
	var key := _transaction_key(action, poi_state)
	if bool(action.get("one_time", false)):
		if (state["journal"] as Dictionary).has(key) or (poi_state["reward_receipts"] as Dictionary).has(key):
			return _result("ALREADY_APPLIED", "", {"transaction_key": key})
	else:
		var next_field := String(action.get("next_ready_field", ""))
		if not next_field.is_empty() and int(state["active_tick"]) < int(poi_state.get(next_field, 0)):
			return _result("COOLDOWN", "", {"transaction_key": key})
	state["pending"] = {"poi_id": poi_id, "action_id": action_id, "transaction_key": key}
	return _result("SUCCESS", "", {"transaction_key": key})


func _commit() -> Dictionary:
	var pending: Variant = state["pending"]
	if pending == null:
		return _result("REJECTED", "NO_PENDING")
	var p: Dictionary = pending as Dictionary
	var poi_id := String(p["poi_id"])
	var action := _action(poi_id, String(p["action_id"]))
	var key := String(p["transaction_key"])
	var poi_state := _poi(poi_id)
	if (state["journal"] as Dictionary).has(key):
		state["pending"] = null
		return _result("ALREADY_APPLIED", "", {"transaction_key": key})
	for item: Variant in action["consumes_items"]:
		if _item_count(String(item["item_id"])) < int(item["quantity"]):
			state["pending"] = null
			return _result("REJECTED", "MISSING_ITEM:" + String(item["item_id"]))
	var inventory: Dictionary = state["inventory"]
	for item: Variant in action["consumes_items"]:
		var item_id := String(item["item_id"])
		inventory[item_id] = _item_count(item_id) - int(item["quantity"])
	for item: Variant in action["reward_items"]:
		var item_id := String(item["item_id"])
		inventory[item_id] = _item_count(item_id) + int(item["quantity"])
	state["inventory"] = inventory
	var capabilities: Array = state["capabilities"]
	for cap: Variant in action["grants_capabilities"]:
		if not capabilities.has(String(cap)):
			capabilities.append(String(cap))
	state["capabilities"] = capabilities
	for field: Variant in action["state_writes"]:
		var name := String(field)
		var value: Variant = action["state_writes"][field]
		if name.ends_with("_next_ready_active_tick_delta"):
			poi_state[name.trim_suffix("_delta")] = int(state["active_tick"]) + int(value)
		elif name.ends_with("_delta"):
			var base := name.trim_suffix("_delta")
			poi_state[base] = int(poi_state.get(base, 0)) + int(value)
		else:
			poi_state[name] = value
	var right := String(action.get("reward_right_id", ""))
	if not right.is_empty():
		(state["journal"] as Dictionary)[key] = right
		(poi_state["reward_receipts"] as Dictionary)[key] = right
	elif not key.is_empty():
		(state["journal"] as Dictionary)[key] = String(action["action_id"])
	if not key.is_empty():
		poi_state["last_transaction_key"] = key
	state["pois"][poi_id] = poi_state
	state["pending"] = null
	return _result("SUCCESS", "", {"transaction_key": key})


func _check_route(event: Dictionary) -> Dictionary:
	var route_id := String(event["route_id"])
	var caps: Array = event.get("capabilities", state["capabilities"]) as Array
	if route_id == "rt_east_seam":
		if not caps.has("cap_filter"):
			return _result("BLOCKED", "MISSING_CAPABILITY:cap_filter")
		return _result("SUCCESS")
	if route_id == "rt_crown_safe_approach" or route_id.begins_with("retreat_") or route_id.begins_with("sp_poi_crown_"):
		return _result("SUCCESS")
	return _result("REJECTED", "unknown_route")


func _validate_geometry(poi_id: String) -> Dictionary:
	if not contracts.has(poi_id):
		return _result("REJECTED", "unknown_poi")
	var geo: Dictionary = contracts[poi_id]["immutable_geography"]
	var nav: Dictionary = {}
	for cell: Variant in geo["required_nav_cells"]:
		nav[Vector2i(int(cell[0]), int(cell[1]))] = true
	for ob: Variant in geo["static_obstacles"]:
		for cell: Variant in ob["cells"]:
			if nav.has(Vector2i(int(cell[0]), int(cell[1]))):
				return _result("REJECTED", "obstacle_blocks_required_nav")
	if not (geo["dynamic_spawns"] as Array).is_empty():
		return _result("REJECTED", "dynamic_spawns_forbidden")
	for ent: Variant in geo["entrances"]:
		for cell: Variant in ent["clearance_cells"]:
			if not nav.has(Vector2i(int(cell[0]), int(cell[1]))):
				return _result("REJECTED", "entrance_clearance_missing")
	return _result("SUCCESS")


func _validate_identity() -> Dictionary:
	var expected := ["poi_crown_waystation", "poi_crown_relay_shed"]
	for poi_id: String in expected:
		if not contracts.has(poi_id):
			return _result("REJECTED", "missing_poi:" + poi_id)
		for action: Variant in contracts[poi_id]["actions"]:
			var key := String(action["transaction_key_template"])
			if not key.is_empty() and not key.begins_with("a1slice:" + poi_id + ":"):
				return _result("REJECTED", "unstable_transaction_key")
	return _result("SUCCESS")


func _spawn_check(event: Dictionary) -> Dictionary:
	var poi_id := String(event["poi_id"])
	var cell := Vector2i(int(event["cell"][0]), int(event["cell"][1]))
	var hero_cell := Vector2i(int(event["hero_cell"][0]), int(event["hero_cell"][1]))
	if cell == hero_cell:
		return _result("REJECTED", "SPAWN_ON_HERO")
	var geo: Dictionary = contracts[poi_id]["immutable_geography"]
	for ent: Variant in geo["entrances"]:
		for clear: Variant in ent["clearance_cells"]:
			if cell == Vector2i(int(clear[0]), int(clear[1])):
				return _result("REJECTED", "SPAWN_BLOCKED_REQUIRED_DOORWAY")
	for nav: Variant in geo["required_nav_cells"]:
		if cell == Vector2i(int(nav[0]), int(nav[1])):
			return _result("REJECTED", "SPAWN_BLOCKED_REQUIRED_NAV")
	return _result("REJECTED", "NO_DYNAMIC_SPAWNS_IN_SLICE_V1")


func _project_a6(poi_id: String) -> Dictionary:
	var poi_state := _poi(poi_id)
	var projection: Dictionary = contracts[poi_id]["a6_projection"]
	if not bool(poi_state.get("discovered", false)):
		return {"visibility": "HIDDEN", "map_status": "HIDDEN", "clues": [], "hazard_telegraphs": [], "missing_prerequisite_reasons": []}
	var map_status := "DISCOVERED"
	if poi_id == "poi_crown_relay_shed":
		if bool(poi_state.get("bus_powered", false)):
			map_status = "POWERED"
		elif not _has_cap("cap_salvage") or _item_count("iron_scrap") < 2 or _item_count("oak_wood") < 1:
			map_status = "MISSING_PREREQUISITE"
	return {
		"visibility": "DISCOVERED",
		"map_status": map_status,
		"clues": projection["discovered_clues"],
		"hazard_telegraphs": projection["hazard_telegraphs"],
		"missing_prerequisite_reasons": projection["missing_prerequisite_reasons"],
	}
