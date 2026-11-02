extends RefCounted
## A0's commit-boundary policy. A3 owns the economy domain; this guard only
## checks physical-token conservation and prevents generic mutation of it.

const PREFIX := "soh_i_"
# Frozen from A3 catalog 86dc2195, instance-storage rows only. New catalog
# revisions require an A0/A3 review and a matching update to this guard.
const APPROVED_INSTANCE_ITEMS := [
	"core_venom", "core_frost", "core_ember", "toxin_mask", "frost_cloak",
	"stone_pick", "iron_pick", "salvage_hammer",
]

static func _is_token(value: Variant) -> bool:
	return (value is String or value is StringName) and String(value).strip_edges().to_lower().begins_with(PREFIX)


static func _is_uint(value: Variant, maximum: int) -> bool:
	if not (value is int or value is float):
		return false
	var number := float(value)
	return is_finite(number) and number >= 0.0 and number <= float(maximum) and number == floor(number)


static func _valid_id(id: String) -> bool:
	if id.length() != 27 or not id.begins_with(PREFIX) or id.substr(18, 1) != "_":
		return false
	for character: String in id.substr(6, 12):
		if character not in "0123456789":
			return false
	for character: String in id.substr(19, 8):
		if character not in "0123456789abcdef":
			return false
	return true


# Reject a token at any other physical path, including nested rewards, loadouts,
# equipment, containers and ground/death bags. Receipts and the A3 attribute
# namespace are excluded by the caller, because references are not possessions.
static func _contains_token(value: Variant) -> bool:
	if value is Dictionary:
		for key: Variant in (value as Dictionary).keys():
			if _is_token(key) or _contains_token(value[key]):
				return true
	elif value is Array:
		for entry: Variant in value:
			if _contains_token(entry):
				return true
	elif _is_token(value):
		return true
	return false


static func inspect(document: Dictionary) -> String:
	var inventory: Variant = document.get("inventory", {})
	if not inventory is Dictionary or not inventory.get("item_stacks", {}) is Dictionary:
		return "invalid_inventory"
	var stacks: Dictionary = inventory.get("item_stacks", {})
	var tokens := {}
	for key_value: Variant in stacks.keys():
		var key := String(key_value)
		var value: Variant = stacks[key_value]
		if not value is Dictionary:
			if _is_token(key):
				return "invalid_token_stack"
			continue
		var id := String(value.get("item_id", key))
		if _is_token(key) or _is_token(id):
			if not _valid_id(id) or key != id or String(value.get("kind", "")) != "key_item":
				return "invalid_token_identity_or_kind"
			var quantity: Variant = value.get("quantity", null)
			if not (quantity is int or quantity is float) or float(quantity) != 1.0:
				return "invalid_token_quantity"
			if tokens.has(id):
				return "duplicate_token"
			tokens[id] = true
	# Remove only validated canonical bag records before scanning all remaining
	# save namespaces. This catches token references even in future containers.
	var rest := document.duplicate(true)
	rest.erase("survival_economy")
	rest.erase("applied_transactions")
	var remaining_inventory: Dictionary = rest.get("inventory", {})
	var remaining_stacks: Dictionary = remaining_inventory.get("item_stacks", {})
	for id: Variant in tokens:
		remaining_stacks.erase(id)
	if _contains_token(rest):
		return "token_outside_bag"
	if not document.has("survival_economy"):
		return "orphan_token" if not tokens.is_empty() else ""
	var state: Variant = document["survival_economy"]
	if not state is Dictionary:
		return "invalid_economy_namespace"
	var schema: Variant = state.get("schema", null)
	if not (schema is int or schema is float) or float(schema) != floor(float(schema)) or int(schema) not in [1, 2]:
		return "invalid_economy_schema"
	for field: String in ["instances", "jobs", "technologies", "commands"]:
		if not state.get(field, null) is Dictionary:
			return "invalid_economy_" + field
	if not _is_uint(state.get("counter", null), 1000000):
		return "invalid_economy_counter"
	if int(schema) == 2:
		var time: Variant = state.get("time", null)
		if not time is Dictionary or not time.get("session_id", null) is String or not time.get("stations", null) is Dictionary:
			return "invalid_economy_time"
		var session_index: Variant = time.get("latest_session_index", null)
		var sequence: Variant = time.get("sequence", null)
		var initial := (session_index is int or session_index is float) and (sequence is int or sequence is float) and float(session_index) == -1.0 and float(sequence) == -1.0 and String(time.session_id).is_empty() and (time.stations as Dictionary).is_empty()
		if not initial and (not _is_uint(session_index, 1000000000000) or not _is_uint(sequence, 1000000000000) or String(time.session_id).is_empty()):
			return "invalid_economy_time_session"
		if (time.stations as Dictionary).size() > 256:
			return "invalid_economy_time_stations"
		for station: Variant in (time.stations as Dictionary).values():
			if not station is Dictionary or not _is_uint(station.get("active_ticks", null), 1000000000000) or not station.get("station_revision", null) is String:
				return "invalid_economy_time_station"
	var instances: Dictionary = state["instances"]
	for id_value: Variant in instances:
		var id := String(id_value)
		var record: Variant = instances[id_value]
		if not _valid_id(id) or not record is Dictionary or String(record.get("instance_id", "")) != id:
			return "invalid_instance_identity"
		for field: String in ["item_id", "location", "origin"]:
			if not record.get(field, null) is String or String(record[field]).is_empty():
				return "invalid_instance_field:" + field
		if String(record["item_id"]) not in APPROVED_INSTANCE_ITEMS:
			return "unknown_instance_item"
		for field: String in ["condition", "max_condition", "uses", "max_uses"]:
			if not _is_uint(record.get(field, null), 100):
				return "invalid_instance_field:" + field
		if not _is_uint(record.get("revision", null), 1000000):
			return "invalid_instance_revision"
		if int(record["max_condition"]) <= 0 or int(record["condition"]) > int(record["max_condition"]) or int(record["uses"]) > int(record["max_uses"]):
			return "invalid_instance_limits"
		var location := String(record.get("location", ""))
		if location == "bag":
			if not tokens.has(id):
				return "orphan_instance"
		elif location == "job_output" or location == "consumed_by_research" or location == "reconstructed" or location == "dismantled" or location.begins_with("research:") or location.begins_with("reconstruction:"):
			if tokens.has(id):
				return "escrow_has_token"
		else:
			return "invalid_instance_location"
	for id: Variant in tokens:
		if not instances.has(id):
			return "orphan_token"
	var referenced := {}
	for job_id: Variant in (state["jobs"] as Dictionary).keys():
		var job: Variant = state["jobs"][job_id]
		if not job is Dictionary or String(job.get("job_id", "")) != String(job_id):
			return "invalid_job"
		for field: String in ["kind", "target", "station_id", "station_kind", "status"]:
			if not job.get(field, null) is String:
				return "invalid_job_field:" + field
		if String(job["status"]) not in ["queued", "running", "paused", "ready", "collected", "cancelled"]:
			return "invalid_job_status"
		for field: String in ["elapsed", "duration", "tier"]:
			if not _is_uint(job.get(field, null), 1000000):
				return "invalid_job_field:" + field
		for field: String in ["reserved", "reserved_fuel", "outputs"]:
			var amounts: Variant = job.get(field, null)
			if not amounts is Dictionary:
				return "invalid_job_field:" + field
			for item_id: Variant in amounts:
				if _is_token(item_id) or not _is_uint(amounts[item_id], 1000000) or int(amounts[item_id]) <= 0:
					return "invalid_job_quantity:" + field
		for field: String in ["reserved_instances", "output_instances"]:
			var entries: Variant = job.get(field, {})
			if not entries is Dictionary:
				return "invalid_escrow"
			for id_value: Variant in entries:
				var id := String(id_value)
				if referenced.has(id) or not instances.has(id) or tokens.has(id) or not entries[id_value] is Dictionary:
					return "invalid_escrow_reference"
				if entries[id_value] != instances[id]:
					return "escrow_attribute_mismatch"
				referenced[id] = true
	for id_value: Variant in instances:
		var location := String(instances[id_value].get("location", ""))
		if (location == "job_output" or location.begins_with("research:") or location.begins_with("reconstruction:")) and not referenced.has(String(id_value)):
			return "orphan_escrow"
	return ""


static func changed_by_generic(before: Dictionary, after: Dictionary) -> bool:
	# A1 rights, claim generations and cooldowns are coupled to A3 rewards.
	# Generic transactions cannot erase or manufacture them.
	if before.has("world_slice") != after.has("world_slice"):
		return true
	if before.get("world_slice", {}) != after.get("world_slice", {}):
		return true
	if before.has("survival_economy") != after.has("survival_economy"):
		return true
	if before.get("survival_economy", {}) != after.get("survival_economy", {}):
		return true
	var old_stacks: Dictionary = (before.get("inventory", {}) as Dictionary).get("item_stacks", {})
	var new_stacks: Dictionary = (after.get("inventory", {}) as Dictionary).get("item_stacks", {})
	var old_tokens := {}
	var new_tokens := {}
	for key: Variant in old_stacks:
		if _is_token(key) or (old_stacks[key] is Dictionary and _is_token(old_stacks[key].get("item_id", ""))):
			old_tokens[key] = old_stacks[key]
	for key: Variant in new_stacks:
		if _is_token(key) or (new_stacks[key] is Dictionary and _is_token(new_stacks[key].get("item_id", ""))):
			new_tokens[key] = new_stacks[key]
	return old_tokens != new_tokens
