extends Node
## A0 production composition of the pinned A3 service in the mounted overworld.
## Clock is generated only by pausable physics callbacks; there is no API accepting
## ticks. As with all GDScript authority this is a trusted-code boundary, not a
## hostile same-process reflection sandbox. Uncommitted active work is discarded
## on reload/exit. A4 attestation is deliberately not configured.

const ADAPTER = preload("res://game/survival/economy/a0_economy_adapter.gd")
const WAYSTATION_HOST = preload("res://game/survival/waystation_host.gd")
const CONTRACT := "soh.economy.active_tick.v1"
const TICKS_PER_SECOND := 60
const MAX_UNCOMMITTED_TICKS := 600

var _save: Node
var _survival: Node
var _world: Node
var _build: Node
var _hero: Node2D
var _adapter: RefCounted
var _port: Node
var _session_id := ""
var _session_index := 0
var _sequence := 0
var _command_serial := 0
var _stations: Dictionary = {}
var _jobs: Dictionary = {}
var _jobs_dirty := true
var _focused := true
var _configured := false
# World sources share this pausable physical session, not wall-clock or UI time.
var _world_seconds := 0
var _world_last_usec := 0
var _world_remainder_usec := 0
var _world_sequence := 0
var _world_last_ack := 0
var _world_armed := false
var _world_baseline_pending := false
var _world_active_point: Node


func configure(save: Node, survival: Node, world: Node, build: Node, hero: Node2D) -> bool:
	if _configured or save == null or survival == null or world == null or build == null or hero == null:
		return false
	_save = save
	_survival = survival
	_world = world
	_build = build
	_hero = hero
	_adapter = ADAPTER.new()
	_port = _save.call(&"create_pinned_economy_port", _adapter)
	if _port == null or not bool(_adapter.call(&"configure", _port, Callable(self, "_resolve_station"))):
		return false
	_adapter.call(&"configure_time_host", Callable(self, "_snapshot"))
	_adapter.call(&"configure_world_host", Callable(self, "_world_snapshot"))
	_save.connect(&"save_loaded", _on_save_loaded)
	_save.connect(&"save_committed", _on_save_committed)
	_save.connect(&"save_reset", _on_save_reset)
	_configured = _new_session(_save.call(&"get_snapshot"))
	process_mode = Node.PROCESS_MODE_PAUSABLE
	set_physics_process(_configured)
	return _configured


func _exit_tree() -> void:
	# Persist an active partial interval on ordinary scene exit. Crash/focus or
	# paused exits can conservatively lose at most the unflushed interval.
	if _world_armed and _world_seconds > _world_last_ack:
		_flush_world_clock()
	if _save != null and is_instance_valid(_save):
		for pair in [[&"save_loaded", _on_save_loaded], [&"save_committed", _on_save_committed], [&"save_reset", _on_save_reset]]:
			if _save.is_connected(pair[0], pair[1]):
				_save.disconnect(pair[0], pair[1])


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		if _world_armed and _world_seconds > _world_last_ack:
			_flush_world_clock()
		_focused = false
		_discard_partial_steps()
	elif what == NOTIFICATION_APPLICATION_FOCUS_IN:
		_focused = true
	elif what == NOTIFICATION_PAUSED:
		# A pausable node receives no physics callbacks while the tree is paused.
		# Discard here, not only inside _physics_process, so a short pause cannot
		# retain a pre-pause fraction when processing resumes.
		_discard_partial_steps()


func _discard_partial_steps() -> void:
	_world_last_usec = 0
	_world_remainder_usec = 0
	for value: Variant in _stations.values():
		value["steps"] = 0


func _new_session(snapshot: Dictionary) -> bool:
	var data: Dictionary = snapshot.get("survival_economy", {})
	var saved_time: Dictionary = data.get("time", {})
	var saved_world: Dictionary = snapshot.get("world_slice", {}) if snapshot.get("world_slice", {}) is Dictionary else {}
	var saved_clock: Dictionary = saved_world.get("clock", {}) if saved_world.get("clock", {}) is Dictionary else {}
	# World-only play may have never written the station clock. Reusing its old
	# index with a new random session id would permanently conflict on restart.
	var prior := maxi(int(saved_time.get("latest_session_index", -1)), int(saved_clock.get("latest_session_index", -1)))
	if prior >= 1000000000:
		return false
	_session_index = prior + 1
	_session_id = Crypto.new().generate_random_bytes(16).hex_encode()
	_sequence = 0
	_command_serial = 0
	_world_seconds = 0
	_world_last_usec = 0
	_world_remainder_usec = 0
	_world_sequence = 0
	_world_last_ack = 0
	_world_armed = not saved_world.is_empty()
	_world_baseline_pending = _world_armed
	_world_active_point = null
	_stations.clear()
	_jobs.clear()
	_jobs_dirty = true
	return not _session_id.is_empty()


func _on_save_loaded(snapshot: Dictionary) -> void:
	_configured = _new_session(snapshot)
	set_physics_process(_configured)


func _on_save_reset() -> void:
	_on_save_loaded(_save.call(&"get_snapshot"))


func _on_save_committed(_snapshot_data: Dictionary) -> void:
	_jobs_dirty = true


func _resolve_station(id: String) -> Dictionary:
	if not is_instance_valid(_world) or not is_instance_valid(_build):
		return {}
	var data: Dictionary = _survival.call(&"resolve_station", id)
	if data.is_empty():
		return {}
	# The durable entry and physical world projection must agree.
	var node: Node = _build.call(&"structure_node", id)
	if node == null or not is_instance_valid(node) or node.is_queued_for_deletion():
		return {}
	return data


## Pure read, called synchronously by the A3 adapter when verifying an advance.
func _snapshot(id: String) -> Dictionary:
	if not _configured or id.is_empty() or id.length() > 64:
		return {}
	var record: Dictionary = _stations.get(id, {})
	var revision := "hand" if id == "hand" else String(_resolve_station(id).get("station_revision", record.get("revision", "removed:" + id)))
	return {"contract": CONTRACT, "station_id": id, "session_id": _session_id,
		"session_index": _session_index, "sequence": _sequence,
		"active_ticks": int(record.get("ticks", 0)), "station_revision": revision}


func _commands_available() -> bool:
	return _configured and _focused and is_instance_valid(_world) and is_instance_valid(_hero) \
		and not bool(_hero.get(&"dead")) and not get_tree().paused


func _gameplay_active() -> bool:
	return _commands_available() and not bool(_world.call(&"_has_gameplay_modal"))


func _physics_process(_delta: float) -> void:
	if not _gameplay_active():
		# Discard partial ticks when interrupted; never credit paused/modal time.
		_discard_partial_steps()
		return
	# Only a physically mounted, A0-owned host activates the world clock.
	# Legacy worlds incur no extra saves. No offline or modal time is credited.
	if _waystation_host() != null:
		if _world_baseline_pending:
			_flush_world_clock()
		# Monotonic wall time sampled only while gameplay is active. A large
		# scheduling gap may be suspension/focus loss; discard it rather than
		# invent offline progress. Short gaps and ordinary physics frame rates
		# accumulate correctly even if physics_ticks_per_second changes.
		var now := Time.get_ticks_usec()
		if _world_last_usec > 0:
			var elapsed := now - _world_last_usec
			if elapsed >= 0 and elapsed <= 250000:
				_world_remainder_usec += elapsed
		_world_last_usec = now
		if _world_remainder_usec >= 1000000:
			_world_remainder_usec -= 1000000
			if _world_seconds - _world_last_ack < 3000:
				_world_seconds += 1
				_world_sequence += 1
			if _world_armed and _world_seconds - _world_last_ack >= 30:
				_flush_world_clock()
	if _jobs_dirty:
		_jobs = _adapter.call(&"jobs")
		_jobs_dirty = false
	var active: Dictionary = {}
	for job: Variant in _jobs.values():
		if String(job.get("status", "")) in ["queued", "running", "paused"]:
			active[String(job.get("station_id", ""))] = true
	for raw_id: Variant in active.keys():
		var id := String(raw_id)
		if id.is_empty():
			continue
		var resolved := {"operational": true, "station_revision": "hand"} if id == "hand" else _resolve_station(id)
		var operational := bool(resolved.get("operational", false)) and int(resolved.get("condition", 100)) > 0
		var revision := String(resolved.get("station_revision", ""))
		var record: Dictionary = _stations.get(id, {"ticks": 0, "steps": 0, "ack": 0, "revision": revision, "was_operational": true})
		if revision.is_empty():
			revision = String(record.get("revision", "removed:" + id))
		if String(record.get("revision", "")) != revision:
			record["revision"] = revision
			record["steps"] = 0
		if not operational:
			record["steps"] = 0
			_stations[id] = record
			if bool(record.get("was_operational", true)):
				_sequence += 1
				_flush(id)
			record["was_operational"] = false
			continue
		record["was_operational"] = true
		if int(record.ticks) - int(record.ack) < MAX_UNCOMMITTED_TICKS:
			record["steps"] = int(record.steps) + 1
		if int(record.steps) >= TICKS_PER_SECOND:
			record["steps"] = 0
			record["ticks"] = int(record.ticks) + 1
			_sequence += 1
			_stations[id] = record
			_flush(id)
		else:
			_stations[id] = record


func _flush(id: String) -> void:
	var receipt := _snapshot(id)
	if receipt.is_empty():
		return
	var event := "a0tick.%s.%s.%d" % [_session_id, id, _sequence]
	var result: Dictionary = _adapter.call(&"advance", id, receipt, event)
	if bool(result.get("ok", false)):
		var record: Dictionary = _stations.get(id, {})
		record["ack"] = int(record.get("ticks", 0))
		_stations[id] = record


# The A0 world host creates this exact node as part of the physical world. A UI
# cannot choose rewards, clock values, discovery, actor or target cells.
func _waystation_host() -> Node:
	if not is_instance_valid(_world):
		return null
	var host := _world.get_node_or_null("WaystationRuntime")
	if host == null or host.get_script() != WAYSTATION_HOST:
		return null
	return host


func _world_snapshot(poi_id: String) -> Dictionary:
	if not _gameplay_active() or poi_id != "poi_crown_waystation" or _waystation_host() == null:
		return {}
	var nav := _world.get(&"traversability") as OverworldTraversability
	if nav == null:
		return {}
	var cell := nav.cell_of(_hero.global_position)
	var host := _waystation_host()
	var discovered := is_instance_valid(_world_active_point) and bool(host.call(&"matches_interaction", _world_active_point, _hero))
	return {"contract": "soh.economy.world_host.v1", "poi_id": poi_id,
		"discovered": discovered, "hero_cell": [cell.x, cell.y],
		"session_id": _session_id, "session_index": _session_index,
		"sequence": _world_sequence, "active_seconds": _world_seconds,
		"world_revision": "a1-waystation-2951bf85"}


func _flush_world_clock() -> void:
	if not _world_armed or not _gameplay_active() or _waystation_host() == null:
		return
	var result: Dictionary = _adapter.call(&"advance_world_time", "poi_crown_waystation", _event())
	if bool(result.get("ok", false)):
		_world_last_ack = _world_seconds
		_world_baseline_pending = false


## Called only by the mounted A0 host after an actual Knight interaction.
## The host resolves a fixed A1 action and checks point identity, range and stand.
func try_waystation_interaction(point: Node, actor: Node) -> Dictionary:
	var host := _waystation_host()
	if not _gameplay_active() or host == null or actor != _hero or not is_instance_valid(point) \
			or not bool(host.call(&"owns_point", point)) or not bool(host.call(&"matches_interaction", point, actor)):
		return {"ok": false, "reason": "OUT_OF_RANGE"}
	var request: Dictionary = host.call(&"request_for", point)
	if request.is_empty():
		return {"ok": false, "reason": "unknown_world_action"}
	_world_active_point = point
	var result: Dictionary = _adapter.call(&"world_action", request, _event())
	_world_active_point = null
	if bool(result.get("ok", false)):
		_world_armed = true
		_world_last_ack = _world_seconds
		_world_baseline_pending = false
	return result


func _event() -> String:
	_command_serial += 1
	return "a0cmd.%s.%d" % [_session_id, _command_serial]


func queue_recipe(recipe_id: String, station_id: String) -> Dictionary:
	if not _commands_available():
		return {"ok": false, "reason": "session_inactive"}
	var station_kind := "hand"
	if station_id != "hand":
		var station := _resolve_station(station_id)
		var node: Node2D = _build.call(&"structure_node", station_id)
		if station.is_empty() or node == null or _hero.global_position.distance_to(node.global_position + Vector2(16, 16)) > 64:
			return {"ok": false, "reason": "station_not_reachable"}
		station_kind = String(station.get("kind", ""))
	# A3's hand resolver intentionally permits a caller-provided id. The player
	# intent surface must use the one canonical hand queue and cannot bind hand
	# recipes to a physical station's independent clock/capacity.
	var catalog: Dictionary = _adapter.get(&"catalog")
	var recipe: Dictionary = (catalog.get("recipes", {}) as Dictionary).get(recipe_id, {})
	if recipe.is_empty() or String(recipe.get("station", "")) != station_kind:
		return {"ok": false, "reason": "station_recipe_mismatch"}
	return _adapter.call(&"enqueue", recipe_id, station_id, _event())


func jobs() -> Dictionary:
	return _adapter.call(&"jobs") if _configured else {}


func collect(job_id: String) -> Dictionary:
	if not _commands_available():
		return {"ok": false, "reason": "session_inactive"}
	return _adapter.call(&"collect", job_id, _event())


func cancel(job_id: String) -> Dictionary:
	if not _commands_available():
		return {"ok": false, "reason": "session_inactive"}
	return _adapter.call(&"cancel", job_id, _event())


## Read-only player/A6 surfaces; never expose the adapter, facade or host receipt.
func nearby_stations() -> Array[Dictionary]:
	var result: Array[Dictionary] = [{"station_id": "hand", "kind": "hand", "tier": 0, "operational": true}]
	if not _configured or not is_instance_valid(_hero):
		return result
	var structures: Dictionary = _survival.call(&"structures")
	var ids: Array = structures.keys()
	ids.sort()
	for value: Variant in ids:
		var id := String(value)
		var station := _resolve_station(id)
		if station.is_empty():
			continue
		var node: Node2D = _build.call(&"structure_node", id)
		if node != null and _hero.global_position.distance_to(node.global_position + Vector2(16, 16)) <= 64:
			result.append(station.duplicate(true))
	return result


func available_recipes(station_id: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if not _configured:
		return result
	var station := {"kind": "hand", "tier": 0} if station_id == "hand" else _resolve_station(station_id)
	if station.is_empty():
		return result
	var catalog: Dictionary = _adapter.get(&"catalog")
	var recipes: Dictionary = catalog.get("recipes", {})
	var ids: Array = recipes.keys()
	ids.sort()
	for value: Variant in ids:
		var id := String(value)
		var recipe: Dictionary = recipes[id]
		if String(recipe.get("station", "")) != String(station.get("kind", "")) \
				or int(recipe.get("min_tier", 0)) > int(station.get("tier", 0)) \
				or not bool(_adapter.call(&"known", id)):
			continue
		result.append({"id": id, "inputs": (recipe.get("inputs", {}) as Dictionary).duplicate(true),
			"fuel": (recipe.get("fuel", {}) as Dictionary).duplicate(true),
			"outputs": (recipe.get("outputs", {}) as Dictionary).duplicate(true),
			"duration_ticks": int(recipe.get("duration_ticks", 0))})
	return result
