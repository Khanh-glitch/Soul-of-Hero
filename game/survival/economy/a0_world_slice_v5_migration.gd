extends RefCounted
## A0-only, fail-closed migration from the pinned A3 c23292be world slice to
## 4bfba38d. No reward/receipt/clock is synthesized. This is not an A3 adapter.
const Pins = preload("res://game/survival/economy/a0_v5_source_pins.gd")
const Old = preload("res://game/survival/economy/vendor/a3_world_source_c23292be.gd")
const New = preload("res://game/survival/economy/world_source_adapter.gd")
const OLD_BINDINGS := "res://data/survival/connector/a0_legacy/world_source_bindings.c23292be.v3.json"
const NEW_BINDINGS := "res://data/survival/items/world_source_bindings.v3.json"
const NEW_FIELDS := ["roadside_notes_01_claim_count", "roadside_notes_01_next_ready_active_tick", "roadside_salvage_02_claim_count", "roadside_salvage_02_next_ready_active_tick", "roadside_timber_03_claim_count", "roadside_timber_03_next_ready_active_tick"]
const MAX_NUMBER := 1000000000000

static func _data(path: String) -> Variant:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null: return null
	return JSON.parse_string(f.get_as_text())

static func _whole(value: Variant, allow_initial := false) -> bool:
	if not (value is int or value is float): return false
	var n := float(value)
	return is_finite(n) and n == floor(n) and n >= (-1.0 if allow_initial else 0.0) and n <= float(MAX_NUMBER)

static func _legacy_error(world: Dictionary, transactions: Variant, bindings: Dictionary, economy: Variant) -> String:
	if not transactions is Dictionary: return "legacy_transactions_invalid"
	if not world.get("clock") is Dictionary or not world.get("pois") is Dictionary or not world.get("capabilities") is Array:
		return "legacy_fields_invalid"
	var template: Dictionary = Old.empty_state(bindings)
	if world.size() != template.size(): return "legacy_world_fields_invalid"
	var clock: Dictionary = world.clock
	if clock.size() != (template.clock as Dictionary).size(): return "legacy_clock_fields_invalid"
	for field: String in ["latest_session_index", "sequence", "active_seconds", "host_active_seconds"]:
		if not _whole(clock.get(field), field in ["latest_session_index", "sequence"]): return "legacy_clock_invalid:" + field
	if not clock.get("session_id") is String: return "legacy_clock_session_invalid"
	var pois: Dictionary = world.pois
	if pois.size() != 2 or not pois.get("poi_crown_waystation") is Dictionary or not pois.get("poi_crown_relay_shed") is Dictionary:
		return "legacy_poi_set_invalid"
	for poi_id: String in ["poi_crown_waystation", "poi_crown_relay_shed"]:
		if (pois[poi_id] as Dictionary).size() != ((template.pois as Dictionary)[poi_id] as Dictionary).size(): return "legacy_poi_fields_invalid"
	var structural := Old.state_error(world, bindings)
	if not structural.is_empty(): return structural
	var way: Dictionary = pois.poi_crown_waystation
	for field: String in ["cache_claim_count", "cache_next_ready_active_tick", "deadfall_claim_count", "deadfall_next_ready_active_tick"]:
		if not _whole(way.get(field)): return "legacy_counter_invalid:" + field
	var caps: Array = world.capabilities
	var allowed_caps := ["cap_salvage", "cap_seal_1", "cap_power_1"]
	var seen_caps := {}
	for cap: Variant in caps:
		if not cap is String or not allowed_caps.has(cap) or seen_caps.has(cap): return "legacy_capability_invalid"
		seen_caps[cap] = true
	for pair: Array in [[way.get("locker_opened"), "cap_salvage"], [way.get("ledger_sealed"), "cap_seal_1"], [(pois.poi_crown_relay_shed as Dictionary).get("bypass_installed"), "cap_power_1"]]:
		if bool(pair[0]) != caps.has(pair[1]): return "legacy_capability_mismatch"
	if int(way.cache_claim_count) > 0 and not bool(way.locker_opened): return "legacy_cache_without_locker"
	# Every one-time action and every sequential source generation must have a
	# matching canonical right and A3 durable transaction. No counter repair.
	var definitions := {}
	for raw: Variant in bindings.get("bindings", []):
		var b: Dictionary = raw
		var poi: Dictionary = pois.get(str(b.poi_id), {})
		var count := int(poi.get(str(b.claim_index_field), -1))
		var ready := int(poi.get(str(b.next_ready_field), -1))
		var cooldown := int(b.get("cooldown_active_seconds", 0))
		if (count == 0 and ready != 0) or (count > 0 and (ready < cooldown or ready > int(clock.active_seconds) + cooldown)): return "legacy_cooldown_invalid"
		var receipts: Dictionary = poi.get("reward_receipts", {})
		if count < 0 or count > receipts.size(): return "legacy_claim_count_invalid"
		for index in range(1, count + 1):
			var key := str(b.transaction_key_template).replace("{claim_index}", str(index))
			definitions[key] = {"right": str(b.reward_right_id), "poi": str(b.poi_id), "action": str(b.action_id), "instance": str(b.instance_id)}
	for raw: Variant in bindings.get("world_actions", []):
		var a: Dictionary = raw
		var poi: Dictionary = pois.get(str(a.poi_id), {})
		if bool(poi.get(str(a.one_time_flag), false)):
			for flag: Variant in (a.get("state_writes", {}) as Dictionary):
				if poi.get(flag) != a.state_writes[flag]: return "legacy_action_flags_invalid"
			definitions[str(a.transaction_key_template)] = {"right": str(a.reward_right_id), "poi": str(a.poi_id), "action": str(a.action_id), "instance": ""}
	var seen := {}
	for poi_id: Variant in pois:
		var poi: Dictionary = pois[poi_id]
		var receipts: Variant = poi.get("reward_receipts")
		if not receipts is Dictionary: return "legacy_receipts_invalid"
		if not receipts.is_empty() and not bool(poi.get("discovered", false)): return "legacy_undiscovered_receipt"
		for key: Variant in receipts:
			if not key is String or not definitions.has(key): return "legacy_foreign_claim"
			var expected: Dictionary = definitions[key]
			if expected.poi != poi_id or receipts[key] != expected.right or seen.has(key): return "legacy_receipt_identity_mismatch"
			seen[key] = 0
		var last: Variant = poi.get("last_transaction_key")
		if not last is String or (not last.is_empty() and not receipts.has(last)) or (not receipts.is_empty() and last.is_empty()): return "legacy_last_claim_invalid"
	if seen.size() != definitions.size(): return "legacy_receipt_missing"
	for tx_key: Variant in transactions:
		var tx: Variant = transactions[tx_key]
		var world_key := str(tx_key).begins_with("soh.a3.world_action.")
		if not tx is Dictionary or not tx.get("metadata") is Dictionary:
			if world_key: return "legacy_transaction_metadata_invalid"
			continue
		var meta: Dictionary = tx.metadata
		var world_metadata := str(meta.get("kind", "")) == "survival_economy" and str(meta.get("operation", "")) == "world_action"
		if world_key != world_metadata: return "legacy_transaction_kind_mismatch"
		if not world_metadata: continue
		var key := str(meta.get("a1_transaction_key", ""))
		if not definitions.has(key) or not seen.has(key): return "legacy_foreign_transaction"
		var expected: Dictionary = definitions[key]
		if str(meta.get("poi_id", "")) != expected.poi or str(meta.get("action_id", "")) != expected.action or str(meta.get("instance_id", "")) != expected.instance or str(meta.get("reward_right_id", "")) != expected.right:
			return "legacy_transaction_identity_mismatch"
		var event_id: Variant = meta.get("event_id")
		if not event_id is String or event_id.is_empty() or str(tx_key) != "soh.a3.world_action." + event_id.sha256_text(): return "legacy_transaction_key_mismatch"
		var request := {"poi_id": expected.poi, "action_id": expected.action}
		if not str(expected.instance).is_empty(): request["instance_id"] = expected.instance
		# V3 signed only the request plus poi/action/instance; the preflight key
		# shape is accepted too because some A3 revisions signed it eagerly.
		var legacy := {"request": request, "receipt_metadata": {"poi_id": expected.poi, "action_id": expected.action, "instance_id": expected.instance}}
		var shaped := {"request": request, "receipt_metadata": {"a1_transaction_key": key, "poi_id": expected.poi, "action_id": expected.action, "instance_id": expected.instance, "reward_right_id": expected.right}}
		var signature := str(meta.get("payload_sha256", ""))
		if signature != JSON.stringify(legacy).sha256_text() and signature != JSON.stringify(shaped).sha256_text():
			return "legacy_transaction_signature_mismatch"
		seen[key] += 1
	for key: Variant in seen:
		if int(seen[key]) != 1: return "legacy_transaction_missing_or_duplicate"
	if economy is Dictionary:
		var commands: Variant = economy.get("commands", {})
		if not commands is Dictionary: return "legacy_commands_invalid"
		for command_key: Variant in commands:
			if not str(command_key).begins_with("soh.a3.world_action."): continue
			if not transactions.has(command_key) or not transactions[command_key] is Dictionary: return "legacy_foreign_world_command"
			var metadata: Variant = transactions[command_key].get("metadata")
			if not metadata is Dictionary or not commands[command_key] is String or commands[command_key] != metadata.get("payload_sha256"):
				return "legacy_world_command_signature_mismatch"
	return ""

static func migrate(document: Dictionary) -> Dictionary:
	if not document.has("world_slice"): return {"ok": true, "changed": false}
	var pin_error: String = Pins.verify()
	if not pin_error.is_empty(): return {"ok": false, "error": pin_error}
	var raw: Variant = document.world_slice
	if not raw is Dictionary: return {"ok": false, "error": "world_slice_invalid"}
	var world: Dictionary = raw
	var pois: Variant = world.get("pois")
	if not pois is Dictionary or not pois.get("poi_crown_waystation") is Dictionary:
		return {"ok": false, "error": "world_poi_invalid"}
	var way: Dictionary = pois.poi_crown_waystation
	var present := 0
	for field: String in NEW_FIELDS:
		if way.has(field): present += 1
	var current: Variant = _data(NEW_BINDINGS)
	if not current is Dictionary: return {"ok": false, "error": "new_bindings_missing"}
	if present == NEW_FIELDS.size():
		var error := New.state_error(world, current)
		return {"ok": error.is_empty(), "changed": false, "error": error}
	if present != 0: return {"ok": false, "error": "partial_world_v5_fields"}
	var legacy: Variant = _data(OLD_BINDINGS)
	if not legacy is Dictionary: return {"ok": false, "error": "legacy_bindings_missing"}
	var old_error := _legacy_error(world, document.get("applied_transactions"), legacy, document.get("survival_economy", {}))
	if not old_error.is_empty(): return {"ok": false, "error": old_error}
	for field: String in NEW_FIELDS:
		way[field] = 0
	var new_error := New.state_error(world, current)
	if not new_error.is_empty(): return {"ok": false, "error": new_error}
	return {"ok": true, "changed": true}
