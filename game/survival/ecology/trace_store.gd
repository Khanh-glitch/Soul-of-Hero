class_name SOHEcologyTraceStore
extends Node
## Run-local C08 evidence projection. It observes the live player body; it never
## receives a trail from a test fixture, menu, teleport, respawn or house lookup.
## Durable bytes live in the existing SaveService document at top-level
## `ecology` (the survival sanitizer rebuilds its own fixed-key namespace, so a
## top-level section is the same pattern A0 uses for `authored_world`). No second
## save file, clock, inventory or reward ledger is created here.

const POLICY := preload("res://game/survival/ecology/trace_policy.gd")
const SAVE_PATH := ["ecology"]
const SCHEMA := 1
const SOURCE_PLAYER := "player"

signal trace_emitted(record: Dictionary)
signal traces_changed()

var last_error := ""
var surface_status := POLICY.SURFACE_UNAVAILABLE
var weather_status := POLICY.WEATHER_UNAVAILABLE
var metrics := {
	"emitted": 0, "expired": 0, "evicted": 0, "rejected_teleport": 0,
	"rejected_stationary": 0, "rejected_context": 0, "queries": 0,
	"candidates_examined": 0, "persist_attempts": 0, "persist_ok": 0,
	"restore_dropped": 0, "clock_rollback_events": 0,
}

var _world: Node
var _hero: Node2D
var _nav: OverworldTraversability
var _build: Node
var _surface_provider: Node
var _save: Node
var _lifecycle: Node
var _configured := false
var _run_id := ""
var _seq := 0
var _records := {}
var _order: Array[String] = []
var _index := {}
var _next_by_prev := {}
var _anchor := Vector2.ZERO
var _prev_id := ""
var _has_anchor := false
var _dirty := false
var _persist_left := 0.0
var _last_now := -1
var _clock_suspended := false


func configure(world: Node, hero: Node2D, nav: OverworldTraversability, build: Node,
		surface_provider: Node, save: Node, lifecycle: Node) -> bool:
	if world == null or hero == null or nav == null or build == null or save == null or lifecycle == null:
		last_error = "ecology_seats_absent"
		return false
	if not save.has_method(&"get_value") or not save.has_method(&"patch_state_path"):
		last_error = "ecology_save_interface_absent"
		return false
	if not lifecycle.has_method(&"phase"):
		last_error = "ecology_run_interface_absent"
		return false
	_world = world
	_hero = hero
	_nav = nav
	_build = build
	_surface_provider = surface_provider
	_save = save
	_lifecycle = lifecycle
	_configured = true
	_reset_anchor(_hero.global_position)
	if _save.has_signal(&"save_loaded") and not _save.is_connected(&"save_loaded", _on_save_loaded):
		_save.connect(&"save_loaded", _on_save_loaded)
	if _save.has_signal(&"save_reset") and not _save.is_connected(&"save_reset", _on_save_reset):
		_save.connect(&"save_reset", _on_save_reset)
	if _lifecycle.has_signal(&"run_ended") and not _lifecycle.is_connected(&"run_ended", _on_run_ended):
		_lifecycle.connect(&"run_ended", _on_run_ended)
	if _lifecycle.has_signal(&"run_started") and not _lifecycle.is_connected(&"run_started", _on_run_started):
		_lifecycle.connect(&"run_started", _on_run_started)
	_restore()
	return true


func _exit_tree() -> void:
	if _save != null and is_instance_valid(_save):
		if _save.is_connected(&"save_loaded", _on_save_loaded):
			_save.disconnect(&"save_loaded", _on_save_loaded)
		if _save.is_connected(&"save_reset", _on_save_reset):
			_save.disconnect(&"save_reset", _on_save_reset)
	if _lifecycle != null and is_instance_valid(_lifecycle):
		if _lifecycle.is_connected(&"run_ended", _on_run_ended):
			_lifecycle.disconnect(&"run_ended", _on_run_ended)
		if _lifecycle.is_connected(&"run_started", _on_run_started):
			_lifecycle.disconnect(&"run_started", _on_run_started)


func _physics_process(delta: float) -> void:
	if not _configured:
		return
	var phase: Dictionary = _lifecycle.call(&"phase")
	var now := int(phase.get("now_unix", 0))
	if _run_id.is_empty() and String(phase.get("state", "")) == "active":
		_restore()
	if String(phase.get("state", "")) != "active" or String(phase.get("run_id", "")) != _run_id:
		if not _records.is_empty() or not _run_id.is_empty():
			clear("run_not_active")
		return
	if _last_now >= 0 and now < _last_now:
		if not _clock_suspended:
			metrics["clock_rollback_events"] = int(metrics.get("clock_rollback_events", 0)) + 1
		_clock_suspended = true
		last_error = "run_clock_rollback"
		return
	_clock_suspended = false
	_last_now = now
	_prune(now)
	_sample_movement(now, phase)
	_persist_left -= delta
	if _dirty and _persist_left <= 0.0:
		flush()
		_persist_left = POLICY.PERSIST_INTERVAL


func _sample_movement(now: int, phase: Dictionary) -> void:
	if not is_instance_valid(_hero):
		return
	var position := _hero.global_position
	if not _movement_context_allowed():
		metrics["rejected_context"] = int(metrics.get("rejected_context", 0)) + 1
		_reset_anchor(position)
		return
	var move_input := Vector2.ZERO
	if _hero.get(&"move_input") is Vector2:
		move_input = _hero.get(&"move_input")
	if move_input.length_squared() <= 0.01:
		metrics["rejected_stationary"] = int(metrics.get("rejected_stationary", 0)) + 1
		_reset_anchor(position)
		return
	if not _has_anchor:
		_reset_anchor(position)
		return
	var step := position - _anchor
	var distance := step.length()
	if distance < POLICY.EMIT_DISTANCE:
		return
	if distance > POLICY.MAX_CONTIGUOUS_STEP:
		# A respawn, site transition, dash outlier or any other discontinuity is
		# not evidence. Break the chain instead of drawing a causal bridge.
		metrics["rejected_teleport"] = int(metrics.get("rejected_teleport", 0)) + 1
		_reset_anchor(position)
		return
	var cell := _nav.cell_of(position)
	if not _nav.in_bounds(cell) or not _nav.is_free(cell):
		_reset_anchor(position)
		return
	var surface := _surface_at(cell)
	var expires := mini(now + POLICY.BASE_LIFETIME_SECONDS, int(phase.get("run_expires_at_unix", now + POLICY.BASE_LIFETIME_SECONDS)))
	_seq += 1
	var record := {
		"id": "t%d" % _seq,
		"seq": _seq,
		"run_id": _run_id,
		"source": SOURCE_PLAYER,
		"position": [position.x, position.y],
		"cell": [cell.x, cell.y],
		"direction": [step.normalized().x, step.normalized().y],
		"surface": surface,
		"created_at": now,
		"expires_at": expires,
		"prev_id": _prev_id,
	}
	_add_record(record)
	_anchor = position
	_prev_id = String(record["id"])
	metrics["emitted"] = int(metrics.get("emitted", 0)) + 1
	_dirty = true
	trace_emitted.emit(record.duplicate(true))
	traces_changed.emit()


func _movement_context_allowed() -> bool:
	if not is_instance_valid(_hero) or not is_instance_valid(_world):
		return false
	if bool(_hero.get(&"dead")):
		return false
	if _hero.get_tree().paused:
		return false
	if int(_world.get(&"build_stage")) != 6:
		return false
	if _world.has_method(&"_has_gameplay_modal") and bool(_world.call(&"_has_gameplay_modal")):
		return false
	if _surface_provider != null and is_instance_valid(_surface_provider) \
			and _surface_provider.has_method(&"inside_site") \
			and not String(_surface_provider.call(&"inside_site")).is_empty():
		return false
	return true


func _surface_at(cell: Vector2i) -> String:
	if _surface_provider != null and is_instance_valid(_surface_provider) \
			and _surface_provider.has_method(&"cell_surface"):
		var value := String(_surface_provider.call(&"cell_surface", cell))
		if not value.is_empty():
			surface_status = "A1_CELL_SURFACE"
			return value
	surface_status = POLICY.SURFACE_UNAVAILABLE
	return POLICY.SURFACE_UNAVAILABLE


func _reset_anchor(position: Vector2) -> void:
	_anchor = position
	_prev_id = ""
	_has_anchor = true


func _add_record(record: Dictionary) -> void:
	var id := String(record["id"])
	_records[id] = record.duplicate(true)
	_order.append(id)
	var position := _position_of(record)
	var key := _bucket(position)
	if not _index.has(key):
		_index[key] = []
	(_index[key] as Array).append(id)
	var prev := String(record.get("prev_id", ""))
	if not prev.is_empty():
		if not _next_by_prev.has(prev):
			_next_by_prev[prev] = []
		(_next_by_prev[prev] as Array).append(id)
	while _order.size() > POLICY.MAX_TRACES:
		var old := _order.pop_front()
		_remove_record(old, "evicted")


func _remove_record(id: String, reason: String) -> void:
	if not _records.has(id):
		return
	var record: Dictionary = _records[id]
	var key := _bucket(_position_of(record))
	if _index.has(key):
		(_index[key] as Array).erase(id)
		if (_index[key] as Array).is_empty():
			_index.erase(key)
	var prev := String(record.get("prev_id", ""))
	if _next_by_prev.has(prev):
		(_next_by_prev[prev] as Array).erase(id)
		if (_next_by_prev[prev] as Array).is_empty():
			_next_by_prev.erase(prev)
	_records.erase(id)
	_order.erase(id)
	if reason == "expired":
		metrics["expired"] = int(metrics.get("expired", 0)) + 1
	elif reason == "evicted":
		metrics["evicted"] = int(metrics.get("evicted", 0)) + 1
	_dirty = true


func _prune(now: int) -> void:
	var changed := false
	while not _order.is_empty():
		var id := _order[0]
		var record: Dictionary = _records.get(id, {})
		if record.is_empty() or int(record.get("expires_at", 0)) > now:
			break
		_remove_record(id, "expired")
		changed = true
	if changed:
		traces_changed.emit()


func sense_near(position: Vector2, radius: float, limit: int = POLICY.SENSE_CANDIDATE_LIMIT) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	if not _configured or _clock_suspended or radius <= 0.0 or limit <= 0:
		return out
	var phase: Dictionary = _lifecycle.call(&"phase")
	if String(phase.get("state", "")) != "active" or String(phase.get("run_id", "")) != _run_id:
		return out
	var now := int(phase.get("now_unix", 0))
	metrics["queries"] = int(metrics.get("queries", 0)) + 1
	var min_cell := Vector2i(floori((position.x - radius) / POLICY.SPATIAL_CELL), floori((position.y - radius) / POLICY.SPATIAL_CELL))
	var max_cell := Vector2i(floori((position.x + radius) / POLICY.SPATIAL_CELL), floori((position.y + radius) / POLICY.SPATIAL_CELL))
	var candidates: Array[Dictionary] = []
	for y in range(min_cell.y, max_cell.y + 1):
		for x in range(min_cell.x, max_cell.x + 1):
			var key := Vector2i(x, y)
			if not _index.has(key):
				continue
			for id: Variant in (_index[key] as Array):
				var record: Dictionary = _records.get(String(id), {})
				if record.is_empty():
					continue
				metrics["candidates_examined"] = int(metrics.get("candidates_examined", 0)) + 1
				if int(record.get("expires_at", 0)) <= now:
					continue
				if position.distance_to(_position_of(record)) > radius:
					continue
				candidates.append(record.duplicate(true))
	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a["seq"]) < int(b["seq"]))
	for record: Dictionary in candidates:
		if out.size() >= limit:
			break
		out.append(record)
	return out


func successor(id: String) -> Dictionary:
	if _clock_suspended:
		return {"status": "clock_suspended"}
	if not _records.has(id):
		return {"status": "missing"}
	var phase: Dictionary = _lifecycle.call(&"phase")
	var now := int(phase.get("now_unix", 0))
	var current: Dictionary = _records[id]
	if int(current.get("expires_at", 0)) <= now:
		return {"status": "expired"}
	var children: Array = _next_by_prev.get(id, [])
	if children.is_empty():
		return {"status": "end_of_chain"}
	if children.size() > 1:
		# Ambiguous branching is not resolved by nearest/newest guesswork.
		return {"status": "ambiguous", "count": children.size()}
	var next_id := String(children[0])
	if not _records.has(next_id):
		return {"status": "missing"}
	var next: Dictionary = _records[next_id]
	if int(next.get("seq", 0)) <= int(current.get("seq", 0)):
		return {"status": "cycle"}
	if String(next.get("run_id", "")) != _run_id or String(next.get("source", "")) != SOURCE_PLAYER:
		return {"status": "foreign"}
	if int(next.get("created_at", 0)) < int(current.get("created_at", 0)) or int(next.get("expires_at", 0)) <= now:
		return {"status": "expired"}
	if _position_of(current).distance_to(_position_of(next)) > POLICY.MAX_LINK_DISTANCE:
		return {"status": "gap"}
	return {"status": "ok", "record": next.duplicate(true)}


func trace_record(id: String) -> Dictionary:
	return (_records.get(id, {}) as Dictionary).duplicate(true)


func clarity(id: String) -> float:
	var record: Dictionary = _records.get(id, {})
	if record.is_empty():
		return 0.0
	var phase: Dictionary = _lifecycle.call(&"phase")
	var now := int(phase.get("now_unix", 0))
	var created := int(record.get("created_at", now))
	var expires := int(record.get("expires_at", created))
	if expires <= created:
		return 0.0
	return clampf(float(expires - now) / float(expires - created), 0.0, 1.0)


func trace_count() -> int:
	return _records.size()


func all_traces() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for id: String in _order:
		out.append((_records[id] as Dictionary).duplicate(true))
	return out


func snapshot() -> Dictionary:
	var records: Array = []
	for id: String in _order:
		records.append((_records[id] as Dictionary).duplicate(true))
	return {
		"schema": SCHEMA,
		"run_id": _run_id,
		"seq": _seq,
		"records": records,
		"surface_status": surface_status,
		"weather_status": weather_status,
		"tuning": POLICY.tuning_report(),
	}


func flush() -> bool:
	if not _configured or _save == null:
		return false
	if not _dirty:
		return true
	metrics["persist_attempts"] = int(metrics.get("persist_attempts", 0)) + 1
	var ok := bool(_save.call(&"patch_state_path", SAVE_PATH, snapshot()))
	if ok:
		_dirty = false
		metrics["persist_ok"] = int(metrics.get("persist_ok", 0)) + 1
		last_error = ""
	else:
		last_error = "ecology_persist_refused"
	return ok


func clear(reason: String = "") -> void:
	_records.clear()
	_order.clear()
	_index.clear()
	_next_by_prev.clear()
	_prev_id = ""
	_has_anchor = false
	_seq = 0
	_run_id = ""
	_dirty = true
	last_error = reason
	if _configured and _save != null and is_instance_valid(_save):
		_save.call(&"patch_state_path", SAVE_PATH, {})
	traces_changed.emit()


func _restore() -> void:
	_records.clear()
	_order.clear()
	_index.clear()
	_next_by_prev.clear()
	_seq = 0
	_run_id = ""
	var phase: Dictionary = _lifecycle.call(&"phase")
	if String(phase.get("state", "")) != "active":
		_dirty = true
		return
	_run_id = String(phase.get("run_id", ""))
	var raw: Variant = _save.call(&"get_value", SAVE_PATH, {})
	if not raw is Dictionary or (raw as Dictionary).is_empty():
		_dirty = false
		return
	var document: Dictionary = raw
	if int(document.get("schema", 0)) != SCHEMA or String(document.get("run_id", "")) != _run_id:
		metrics["restore_dropped"] = int(metrics.get("restore_dropped", 0)) + 1
		_dirty = true
		return
	var now := int(phase.get("now_unix", 0))
	var started := int(phase.get("run_started_at_unix", 0))
	var expires_run := int(phase.get("run_expires_at_unix", now))
	var saved_seq := int(document.get("seq", 0))
	var valid: Array[Dictionary] = []
	var seen := {}
	for raw_record: Variant in (document.get("records", []) as Array):
		if not raw_record is Dictionary:
			metrics["restore_dropped"] = int(metrics.get("restore_dropped", 0)) + 1
			continue
		var record: Dictionary = raw_record
		var id := String(record.get("id", ""))
		var seq := int(record.get("seq", -1))
		var position := _position_of(record)
		var created := int(record.get("created_at", -1))
		var expires := int(record.get("expires_at", -1))
		if id.is_empty() or seen.has(id) or seq <= 0 or seq > saved_seq \
				or String(record.get("run_id", "")) != _run_id \
				or String(record.get("source", "")) != SOURCE_PLAYER \
				or not is_finite(position.x) or not is_finite(position.y) \
				or created < started or created > now or expires <= now \
				or expires <= created:
			metrics["restore_dropped"] = int(metrics.get("restore_dropped", 0)) + 1
			continue
		record["expires_at"] = mini(expires, expires_run)
		record["surface"] = String(record.get("surface", POLICY.SURFACE_UNAVAILABLE))
		record["prev_id"] = String(record.get("prev_id", ""))
		seen[id] = true
		valid.append(record)
	valid.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a["seq"]) < int(b["seq"]))
	var start := maxi(0, valid.size() - POLICY.MAX_TRACES)
	for i in range(start, valid.size()):
		_add_record(valid[i])
	_seq = saved_seq
	_last_now = now
	_dirty = false
	_reset_anchor(_hero.global_position if is_instance_valid(_hero) else Vector2.ZERO)


func _on_save_loaded(_snapshot: Dictionary) -> void:
	_restore()


func _on_save_reset() -> void:
	clear("save_reset")


func _on_run_ended(_run: Dictionary, _reason: String) -> void:
	clear("run_ended")


func _on_run_started(_run: Dictionary) -> void:
	_restore()


func _position_of(record: Dictionary) -> Vector2:
	var value: Variant = record.get("position", [0.0, 0.0])
	if value is Array and (value as Array).size() >= 2:
		return Vector2(float((value as Array)[0]), float((value as Array)[1]))
	return Vector2.ZERO


func _bucket(position: Vector2) -> Vector2i:
	return Vector2i(floori(position.x / POLICY.SPATIAL_CELL), floori(position.y / POLICY.SPATIAL_CELL))
