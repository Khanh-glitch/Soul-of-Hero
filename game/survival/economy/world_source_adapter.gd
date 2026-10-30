extends RefCounted
## A3-owned pure source-binding helpers. NO save authority, NO inventory, NO
## clock of its own. Every mutation is executed by EconomyService inside the
## single SaveService.transact_once candidate. The binding data is a pinned A3
## copy of A1 contracts; A1 world files are never edited here.
## Identity rule: source_class + region_id + poi_id + instance_id. A1 may also
## publish a world-instance id (si:*) and an interaction-node id (node_*). Those
## are explicit pinned aliases of ONE physical source, not interchangeable
## namespaces. Rewards are deterministic canonical quantities, not loot rolls.

const SCHEMA := "soh.economy.world_source_bindings.v3"
const WORLD_STATE_SCHEMA := "soh.world.slice_state.v1"
const HOST_CONTRACT := "soh.economy.world_host.v1"
const MAX_HOST_QUANTUM := 3600
const MAX_CLOCK_SECONDS := 1000000000000

## Fail-closed catalog validation. Returns a list of errors (empty == valid).
static func validate_catalog(bindings: Dictionary, items: Dictionary, sources: Dictionary) -> Array[String]:
	var errors: Array[String] = []
	if String(bindings.get("schema", "")) != SCHEMA:
		errors.append("invalid_binding_schema")
	var seen_bindings := {}
	var seen_actions := {}
	var alias_owner := {}
	for raw: Variant in bindings.get("bindings", []):
		if not raw is Dictionary:
			errors.append("invalid_binding_record"); continue
		var b: Dictionary = raw
		var id := String(b.get("binding_id", ""))
		if id.is_empty() or seen_bindings.has(id):
			errors.append("duplicate_or_empty_binding_id:" + id)
		seen_bindings[id] = true
		for field in ["source_class", "region_id", "poi_id", "instance_id", "action_id", "reward_right_id", "transaction_key_template", "claim_index_field", "next_ready_field"]:
			if String(b.get(field, "")).is_empty():
				errors.append("binding_missing_field:%s:%s" % [id, field])
		var cooldown := int(b.get("cooldown_active_seconds", -1))
		if cooldown < 0 or cooldown > 86400:
			errors.append("binding_invalid_cooldown:" + id)
		var max_claims := int(b.get("max_claims", 0))
		if max_claims < 0 or max_claims > 1000000:
			errors.append("binding_invalid_max_claims:" + id)
		if max_claims > 0 and cooldown != 0:
			errors.append("binding_one_time_must_not_replenish:" + id)
		var rewards: Variant = b.get("rewards", [])
		if not rewards is Array or (rewards as Array).is_empty():
			errors.append("binding_empty_rewards:" + id)
		else:
			for raw_reward: Variant in rewards:
				if not raw_reward is Dictionary:
					errors.append("binding_invalid_reward:" + id); continue
				var reward: Dictionary = raw_reward
				var source_id := String(reward.get("source_id", ""))
				var item_id := String(reward.get("item_id", ""))
				var quantity := int(reward.get("quantity", 0))
				if not sources.has(source_id):
					errors.append("binding_unknown_source:%s:%s" % [id, source_id])
				elif String(sources[source_id].get("item_id", "")) != item_id:
					errors.append("binding_source_item_mismatch:%s:%s" % [id, source_id])
				if not items.has(item_id):
					errors.append("binding_unknown_item:%s:%s" % [id, item_id])
				elif String(items[item_id].get("kind", "")) == "skill_core":
					errors.append("binding_core_reward_forbidden:%s:%s" % [id, item_id])
				if quantity <= 0 or quantity > 50:
					errors.append("binding_invalid_quantity:%s:%s" % [id, item_id])
		var identity := "%s|%s|%s|%s" % [String(b.get("source_class", "")), String(b.get("region_id", "")), String(b.get("poi_id", "")), String(b.get("instance_id", ""))]
		if String(b.get("identity", "")) != identity:
			errors.append("binding_identity_mismatch:" + id)
		# Explicit aliases must be unique. A node id cannot silently name two
		# physical sources, and a world instance cannot be rebound by UI text.
		for alias_field in ["instance_id", "interaction_node_id", "world_instance_id", "a1_source_instance_id"]:
			var alias := String(b.get(alias_field, ""))
			if alias.is_empty():
				continue
			if alias_owner.has(alias) and String(alias_owner[alias]) != id:
				errors.append("binding_alias_collision:%s:%s" % [alias, id])
			alias_owner[alias] = id
		if b.has("canonical_poi_id") and b.get("canonical_poi_id", null) != null:
			if String(b.get("canonical_poi_id", "")) != String(b.get("poi_id", "")):
				errors.append("binding_canonical_poi_mismatch:" + id)
		if b.has("context_poi_id") and String(b.get("context_poi_id", "")) != String(b.get("poi_id", "")):
			errors.append("binding_context_poi_mismatch:" + id)
	for raw: Variant in bindings.get("world_actions", []):
		if not raw is Dictionary:
			errors.append("invalid_world_action"); continue
		var a: Dictionary = raw
		var key := String(a.get("poi_id", "")) + ":" + String(a.get("action_id", ""))
		if seen_actions.has(key):
			errors.append("duplicate_world_action:" + key)
		seen_actions[key] = true
		for field in ["poi_id", "action_id", "transaction_key_template"]:
			if String(a.get(field, "")).is_empty():
				errors.append("world_action_missing_field:%s:%s" % [key, field])
		for raw_cost: Variant in a.get("consumes_items", []):
			if not raw_cost is Dictionary:
				errors.append("world_action_invalid_cost:" + key); continue
			var cost: Dictionary = raw_cost
			var item_id := String(cost.get("item_id", ""))
			if not items.has(item_id) or int(cost.get("quantity", 0)) <= 0:
				errors.append("world_action_bad_cost:%s:%s" % [key, item_id])
		for raw_reward: Variant in a.get("reward_items", []):
			if not raw_reward is Dictionary:
				errors.append("world_action_invalid_reward:" + key); continue
			var item_id := String((raw_reward as Dictionary).get("item_id", ""))
			if not items.has(item_id):
				errors.append("world_action_unknown_reward:" + key)
			elif String(items[item_id].get("kind", "")) == "skill_core":
				errors.append("world_action_core_reward_forbidden:" + key)
	return errors

## Resolve a physical source by canonical instance id OR an explicitly pinned
## interaction/world alias. Ambiguous aliases fail closed.
static func binding_for(bindings: Dictionary, poi_id: String, action_id: String, instance_id: String) -> Dictionary:
	if instance_id.is_empty():
		return {}
	var found: Dictionary = {}
	for raw: Variant in bindings.get("bindings", []):
		var b: Dictionary = raw
		if String(b.get("poi_id", "")) != poi_id or String(b.get("action_id", "")) != action_id:
			continue
		var matched := false
		for alias_field in ["instance_id", "interaction_node_id", "world_instance_id", "a1_source_instance_id"]:
			if String(b.get(alias_field, "")) == instance_id:
				matched = true
				break
		if matched:
			if not found.is_empty() and String(found.get("binding_id", "")) != String(b.get("binding_id", "")):
				return {}
			found = b
	return found

static func action_for(bindings: Dictionary, poi_id: String, action_id: String) -> Dictionary:
	for raw: Variant in bindings.get("world_actions", []):
		var a: Dictionary = raw
		if String(a.get("poi_id", "")) == poi_id and String(a.get("action_id", "")) == action_id:
			return a
	return {}

static func poi_ids(bindings: Dictionary) -> Array[String]:
	var ids := {}
	for raw: Variant in bindings.get("bindings", []):
		ids[String((raw as Dictionary).get("poi_id", ""))] = true
	for raw: Variant in bindings.get("world_actions", []):
		ids[String((raw as Dictionary).get("poi_id", ""))] = true
	var result: Array[String] = []
	for id: Variant in ids.keys():
		result.append(String(id))
	result.sort()
	return result

static func empty_state(bindings: Dictionary) -> Dictionary:
	var pois := {}
	for raw: Variant in bindings.get("initial_poi_states", []):
		var entry: Dictionary = raw
		pois[String(entry.get("poi_id", ""))] = (entry.get("state", {}) as Dictionary).duplicate(true)
	return {
		"schema": WORLD_STATE_SCHEMA,
		"capabilities": [],
		"clock": {"latest_session_index": -1, "session_id": "", "sequence": -1, "active_seconds": 0, "host_active_seconds": 0},
		"pois": pois,
	}

static func _is_uint(value: Variant, maximum: int) -> bool:
	if not (value is int) and not (value is float):
		return false
	var number := float(value)
	return number >= 0.0 and number <= float(maximum) and number == floor(number)

static func state_error(raw: Variant, bindings: Dictionary) -> String:
	if not raw is Dictionary:
		return "invalid_world_state"
	var state: Dictionary = raw
	if String(state.get("schema", "")) != WORLD_STATE_SCHEMA:
		return "unsupported_world_state_schema"
	if not state.get("capabilities", null) is Array or not state.get("pois", null) is Dictionary or not state.get("clock", null) is Dictionary:
		return "invalid_world_state_fields"
	for cap: Variant in state["capabilities"]:
		if not cap is String or String(cap).is_empty():
			return "invalid_world_capability"
	var clock: Dictionary = state["clock"]
	for field in ["latest_session_index", "sequence", "active_seconds", "host_active_seconds"]:
		if not clock.has(field):
			return "invalid_world_clock"
	var lsi: Variant = clock.latest_session_index
	var seq: Variant = clock.sequence
	var initial := ((lsi is int or lsi is float) and int(lsi) == -1) and ((seq is int or seq is float) and int(seq) == -1) \
		and String(clock.get("session_id", "x")).is_empty() and int(clock.get("active_seconds", -1)) == 0 and int(clock.get("host_active_seconds", -1)) == 0
	if not initial:
		if not _is_uint(lsi, 1000000000) or not _is_uint(seq, MAX_CLOCK_SECONDS):
			return "invalid_world_clock_session"
		if String(clock.get("session_id", "")).is_empty():
			return "invalid_world_clock_session_id"
		if not _is_uint(clock.get("active_seconds", null), MAX_CLOCK_SECONDS) or not _is_uint(clock.get("host_active_seconds", null), MAX_CLOCK_SECONDS):
			return "invalid_world_clock_seconds"
	var expected := empty_state(bindings)
	for poi_id: Variant in (expected["pois"] as Dictionary).keys():
		if not (state["pois"] as Dictionary).has(poi_id):
			return "missing_world_poi:" + String(poi_id)
		var poi: Variant = state["pois"][poi_id]
		if not poi is Dictionary:
			return "invalid_world_poi:" + String(poi_id)
		var template: Dictionary = expected["pois"][poi_id]
		for field: Variant in template.keys():
			if not (poi as Dictionary).has(field):
				return "missing_world_poi_field:%s:%s" % [String(poi_id), String(field)]
			var expected_value: Variant = template[field]
			var actual: Variant = poi[field]
			if expected_value is bool and not actual is bool:
				return "invalid_world_poi_bool:%s:%s" % [String(poi_id), String(field)]
			if expected_value is int and not _is_uint(actual, MAX_CLOCK_SECONDS):
				return "invalid_world_poi_number:%s:%s" % [String(poi_id), String(field)]
			if expected_value is String and not actual is String:
				return "invalid_world_poi_string:%s:%s" % [String(poi_id), String(field)]
			if expected_value is Dictionary and not actual is Dictionary:
				return "invalid_world_poi_dict:%s:%s" % [String(poi_id), String(field)]
	return ""

## Exact integer cell. Accepts the native Vector2i used by A0/physics and the
## JSON [x, y] array used by authored data. Floats/bools/strings are rejected so
## a caller cannot round a spoofed position into a valid stand.
static func is_cell(value: Variant) -> bool:
	if value is Vector2i:
		return true
	if value is Array and (value as Array).size() == 2:
		return (value as Array)[0] is int and (value as Array)[1] is int
	return false

static func cell_vector(value: Variant) -> Vector2i:
	if value is Vector2i:
		return value
	if value is Array and (value as Array).size() == 2:
		return Vector2i(int((value as Array)[0]), int((value as Array)[1]))
	return Vector2i(2147483647, 2147483647)

static func host_receipt_error(raw: Variant, poi_id: String) -> String:
	if not raw is Dictionary:
		return "invalid_world_host_receipt"
	var r: Dictionary = raw
	if String(r.get("contract", "")) != HOST_CONTRACT:
		return "world_host_contract_mismatch"
	if String(r.get("poi_id", "")) != poi_id:
		return "world_host_poi_mismatch"
	if not r.get("discovered", null) is bool:
		return "world_host_missing_discovered"
	if not is_cell(r.get("hero_cell", null)):
		return "world_host_missing_hero_cell"
	for field in ["active_seconds", "session_index", "sequence"]:
		if not r.has(field) or not r[field] is int or int(r[field]) < 0:
			return "world_host_invalid_number:" + field
	if int(r.get("session_index", -1)) > 1000000000 or int(r.get("sequence", -1)) > MAX_CLOCK_SECONDS or int(r.get("active_seconds", -1)) > MAX_CLOCK_SECONDS:
		return "world_host_number_out_of_range"
	if String(r.get("session_id", "")).is_empty() or String(r.get("session_id", "")).length() > 96:
		return "world_host_invalid_session_id"
	if String(r.get("world_revision", "")).is_empty() or String(r.get("world_revision", "")).length() > 128:
		return "world_host_invalid_revision"
	for field in ["world_instance_id", "interaction_node_id", "source_class_id", "region_id", "canonical_poi_id", "context_poi_id"]:
		if r.has(field) and r[field] != null and not r[field] is String:
			return "world_host_invalid_identity:" + field
	return ""

## If the host attests a physical identity, it must match the pinned binding.
## Missing optional identity fields remain compatible with the v1 A0 host, but
## the request instance id still has to resolve through binding_for().
static func host_identity_error(host: Dictionary, definition: Dictionary) -> String:
	var pairs := [["world_instance_id", "world_instance_id"], ["interaction_node_id", "interaction_node_id"],
		["source_class_id", "a1_source_class_id"], ["region_id", "region_id"], ["canonical_poi_id", "canonical_poi_id"]]
	for pair: Variant in pairs:
		var host_field := String((pair as Array)[0])
		var binding_field := String((pair as Array)[1])
		if not host.has(host_field) or host[host_field] == null:
			continue
		if not definition.has(binding_field) or definition[binding_field] == null:
			return "world_host_identity_unpinned:" + host_field
		if String(host[host_field]) != String(definition[binding_field]):
			return "world_host_identity_mismatch:" + host_field
	return ""

static func cell_matches(cell: Variant, stand_cells: Array) -> bool:
	if not is_cell(cell):
		return false
	var actual := cell_vector(cell)
	for stand: Variant in stand_cells:
		if is_cell(stand) and cell_vector(stand) == actual:
			return true
	return false

static func transaction_key(template: String, generation: int) -> String:
	return template.replace("{claim_index}", str(generation))

static func reward_totals(rewards: Array) -> Dictionary:
	var totals := {}
	for raw: Variant in rewards:
		var reward: Dictionary = raw
		var id := String(reward.get("item_id", ""))
		totals[id] = int(totals.get(id, 0)) + int(reward.get("quantity", 0))
	return totals

static func cost_totals(costs: Array) -> Dictionary:
	var totals := {}
	for raw: Variant in costs:
		var cost: Dictionary = raw
		var id := String(cost.get("item_id", ""))
		totals[id] = int(totals.get(id, 0)) + int(cost.get("quantity", 0))
	return totals

static func source_identity(binding: Dictionary) -> Dictionary:
	return {
		"source_class": String(binding.get("source_class", "")),
		"region_id": String(binding.get("region_id", "")),
		"poi_id": String(binding.get("poi_id", "")),
		"instance_id": String(binding.get("instance_id", "")),
		"world_instance_id": binding.get("world_instance_id", null),
		"interaction_node_id": binding.get("interaction_node_id", null),
		"a1_source_class_id": binding.get("a1_source_class_id", null),
		"canonical_poi_id": binding.get("canonical_poi_id", null),
		"context_poi_id": binding.get("context_poi_id", null),
	}
