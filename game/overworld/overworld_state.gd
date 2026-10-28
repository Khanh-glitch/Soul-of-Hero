class_name OverworldState
extends Node
## Overworld-scoped persistent state.
## Tracks position, camps, discoveries, shortcuts, and the survival resource.
## Persists through SaveService.transact_once so existing campaign progression
## is not disturbed. Saves are throttled (≤1 per SAVE_THROTTLE_SEC) and
## content-addressed so position/provision ticking does not produce unbounded
## transaction growth.

const STATE_PATH := ["overworld", "hollow_marches"]
const STATE_SCHEMA_VERSION := 1
const PROVISIONS_RESOURCE_ID := "overworld_provisions"
const SAVE_THROTTLE_SEC := 5.0

signal provisions_changed(current: int, maximum: int)
signal discovery_found(discovery_id: StringName)
signal shortcut_opened(shortcut_id: StringName)
signal camp_activated(camp_id: StringName)

var _world_data: Dictionary = {}
var _provisions_accum := 0.0
var _save_accum := 0.0
var _dirty := false
var _last_saved_hash := ""

var provisions := 80
var max_provisions := 100
var last_camp_id: StringName = &"camp_refuge"
var last_world_position: Vector2 = Vector2.ZERO
var discoveries: Dictionary = {}
var shortcuts_opened: Dictionary = {}
var camps_visited: Dictionary = {}


func configure(world_data: Dictionary, initial_pos: Vector2, initial_camp: StringName) -> void:
	_world_data = world_data
	max_provisions = int(_world_data.get("survival", {}).get("max", 100))
	var survival_start := int(_world_data.get("survival", {}).get("start", 80))
	provisions = survival_start
	_provisions_accum = 0.0
	last_world_position = initial_pos
	last_camp_id = initial_camp
	camps_visited[String(initial_camp)] = true
	_load_from_save()
	_last_saved_hash = _hash_snapshot(_snapshot())
	set_process(true)


func _process(delta: float) -> void:
	if not _dirty:
		return
	_save_accum += delta
	if _save_accum < SAVE_THROTTLE_SEC:
		return
	_save_accum = 0.0
	_flush_save()


func get_spawn_position() -> Vector2:
	return last_world_position if last_world_position != Vector2.ZERO else _get_default_spawn()


func get_last_camp_id() -> StringName:
	return last_camp_id


func is_camp_visited(camp_id: StringName) -> bool:
	return bool(camps_visited.get(String(camp_id), false))


func activate_camp(camp_id: StringName, position: Vector2) -> void:
	var key := String(camp_id)
	var first_time := not camps_visited.has(key)
	camps_visited[key] = true
	last_camp_id = camp_id
	last_world_position = position
	var restore := int(_world_data.get("survival", {}).get("camp_restore", 60))
	provisions = mini(max_provisions, provisions + restore)
	if first_time:
		emit_signal("camp_activated", camp_id)
	emit_signal("provisions_changed", provisions, max_provisions)
	_mark_dirty()
	_flush_save()  # camps are important anchor points; save immediately


func is_discovery_found(discovery_id: StringName) -> bool:
	return bool(discoveries.get(String(discovery_id), false))


func collect_discovery(discovery_id: StringName) -> Dictionary:
	var key := String(discovery_id)
	if discoveries.has(key):
		return {}
	for entry: Dictionary in _world_data.get("discoveries", []):
		if String(entry.get("id", "")) == key:
			discoveries[key] = true
			var restore := int(_world_data.get("survival", {}).get("discovery_restore", 20))
			provisions = mini(max_provisions, provisions + restore)
			emit_signal("discovery_found", discovery_id)
			emit_signal("provisions_changed", provisions, max_provisions)
			_mark_dirty()
			_flush_save()
			return entry.get("reward", {}).duplicate(true)
	return {}


func is_shortcut_open(shortcut_id: StringName) -> bool:
	if shortcuts_opened.has(String(shortcut_id)):
		return bool(shortcuts_opened.get(String(shortcut_id), false))
	for entry: Dictionary in _world_data.get("shortcuts", []):
		if String(entry.get("id", "")) == String(shortcut_id):
			var granted_by := String(entry.get("granted_by", ""))
			if granted_by.is_empty():
				return false
			var app_flow := get_node_or_null("/root/AppFlow")
			if app_flow != null and app_flow.has_method("is_campaign_level_completed"):
				return bool(app_flow.call("is_campaign_level_completed", StringName(granted_by)))
			return false
	return false


func open_shortcut(shortcut_id: StringName) -> void:
	shortcuts_opened[String(shortcut_id)] = true
	emit_signal("shortcut_opened", shortcut_id)
	_mark_dirty()
	_flush_save()


func drain_provisions(delta: float, in_hazard: bool, in_safe_zone: bool) -> void:
	if max_provisions <= 0:
		return
	var surv := _world_data.get("survival", {})
	var rate := 0.0
	if in_safe_zone:
		rate = float(surv.get("drain_per_second_safe", 0.0))
	elif in_hazard:
		rate = float(surv.get("drain_per_second_hazard", 1.2))
	else:
		rate = float(surv.get("drain_per_second_wild", 0.4))
	_provisions_accum += rate * delta
	var consumed := int(floor(_provisions_accum))
	if consumed > 0:
		_provisions_accum -= float(consumed)
		provisions = maxi(0, provisions - consumed)
		emit_signal("provisions_changed", provisions, max_provisions)
		_mark_dirty()


func set_world_position(pos: Vector2) -> void:
	# Position is written constantly while walking — only mark dirty if we've
	# moved a meaningful distance to avoid churn.
	if last_world_position.distance_to(pos) > 48.0:
		last_world_position = pos
		_mark_dirty()


func record_level_entry(_level_id: StringName) -> void:
	_mark_dirty()
	_flush_save()


func record_level_return(_level_id: StringName, pos: Vector2) -> void:
	last_world_position = pos
	_mark_dirty()
	_flush_save()


func force_save() -> void:
	_mark_dirty()
	_flush_save()


func _mark_dirty() -> void:
	_dirty = true


func _flush_save() -> void:
	if not _dirty:
		return
	var snap := _snapshot()
	var h := _hash_snapshot(snap)
	if h == _last_saved_hash:
		_dirty = false
		_save_accum = 0.0
		return
	if _commit_snapshot(snap):
		_last_saved_hash = h
		_dirty = false
	else:
		# Leave _dirty=true so the next throttle tick retries.
		_dirty = true
	_save_accum = 0.0


func _commit_snapshot(snap: Dictionary) -> bool:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null:
		return false
	# Apply the one-time schema migration receipt idempotently.
	var migration_key := "overworld:hollow_marches:schema:v%d" % STATE_SCHEMA_VERSION
	if save_service.has_method("transact_once") and save_service.has_method("is_transaction_applied"):
		if not bool(save_service.call("is_transaction_applied", migration_key)):
			save_service.call("transact_once", migration_key, func(candidate: Dictionary) -> bool:
				var txs: Dictionary = candidate.get("applied_transactions", {}).duplicate(true)
				txs[migration_key] = {
					"applied_at_unix": int(Time.get_unix_time_from_system()),
					"metadata": {"kind": "overworld_schema", "version": STATE_SCHEMA_VERSION},
				}
				candidate["applied_transactions"] = txs
				return true
			, {"kind": "overworld_schema", "version": STATE_SCHEMA_VERSION})
	# Write snapshot via patch_state_path (bounded, overwrites in place).
	if save_service.has_method("patch_state_path"):
		var typed_path: Array[String] = []
		for seg in STATE_PATH:
			typed_path.append(String(seg))
		return bool(save_service.call("patch_state_path", typed_path, snap))
	return false


func _load_from_save() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method("get_value"):
		return
	var snapshot: Variant = save_service.call("get_value", STATE_PATH, {})
	if not snapshot is Dictionary:
		return
	var snap: Dictionary = snapshot
	provisions = int(snap.get("provisions", provisions))
	max_provisions = maxi(1, int(snap.get("max_provisions", max_provisions)))
	last_camp_id = StringName(snap.get("last_camp", String(last_camp_id)))
	var pos_val: Variant = snap.get("last_position", [])
	if pos_val is Array and (pos_val as Array).size() >= 2:
		last_world_position = Vector2(float(pos_val[0]), float(pos_val[1]))
	var disc_val: Variant = snap.get("discoveries", {})
	if disc_val is Dictionary:
		discoveries = disc_val.duplicate(true)
	var short_val: Variant = snap.get("shortcuts", {})
	if short_val is Dictionary:
		shortcuts_opened = short_val.duplicate(true)
	var camps_val: Variant = snap.get("camps", {})
	if camps_val is Dictionary:
		camps_visited = camps_val.duplicate(true)


func _snapshot() -> Dictionary:
	return {
		"schema": STATE_SCHEMA_VERSION,
		"provisions": provisions,
		"max_provisions": max_provisions,
		"last_camp": String(last_camp_id),
		"last_position": [last_world_position.x, last_world_position.y],
		"discoveries": discoveries.duplicate(true),
		"shortcuts": shortcuts_opened.duplicate(true),
		"camps": camps_visited.duplicate(true),
	}


func _hash_snapshot(snap: Dictionary) -> String:
	# Deterministic string-hash of the snapshot (JSON round-trip for stable
	# ordering) for content-addressed transaction keys.
	var text := JSON.stringify(snap, "\t")
	return text.md5_text()


func _exit_tree() -> void:
	# Flush any dirty state when leaving the overworld so returning from a
	# dungeon always lands on a saved snapshot.
	_flush_save()


func _get_default_spawn() -> Vector2:
	var ref := _world_data.get("refuge", {})
	var p: Array = ref.get("pos", [0, 0])
	if p.size() >= 2:
		return Vector2(float(p[0]) * 16.0, float(p[1]) * 16.0)
	return Vector2(56 * 16, 216 * 16)
