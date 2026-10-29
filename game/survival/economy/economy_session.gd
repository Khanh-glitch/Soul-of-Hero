extends Node
## A0 production composition of the pinned A3 service in the mounted overworld.
## Clock is generated only by pausable physics callbacks; there is no API accepting
## ticks. As with all GDScript authority this is a trusted-code boundary, not a
## hostile same-process reflection sandbox. Uncommitted active work is discarded
## on reload/exit. A4 attestation is deliberately not configured.

const ADAPTER = preload("res://game/survival/economy/a0_economy_adapter.gd")
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
	_save.connect(&"save_loaded", _on_save_loaded)
	_save.connect(&"save_committed", _on_save_committed)
	_save.connect(&"save_reset", _on_save_reset)
	_configured = _new_session(_save.call(&"get_snapshot"))
	process_mode = Node.PROCESS_MODE_PAUSABLE
	set_physics_process(_configured)
	return _configured


func _exit_tree() -> void:
	if _save != null and is_instance_valid(_save):
		for pair in [[&"save_loaded", _on_save_loaded], [&"save_committed", _on_save_committed], [&"save_reset", _on_save_reset]]:
			if _save.is_connected(pair[0], pair[1]):
				_save.disconnect(pair[0], pair[1])


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
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
	for value: Variant in _stations.values():
		value["steps"] = 0


func _new_session(snapshot: Dictionary) -> bool:
	var data: Dictionary = snapshot.get("survival_economy", {})
	var saved_time: Dictionary = data.get("time", {})
	var prior := int(saved_time.get("latest_session_index", -1))
	if prior >= 1000000000:
		return false
	_session_index = prior + 1
	_session_id = Crypto.new().generate_random_bytes(16).hex_encode()
	_sequence = 0
	_command_serial = 0
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
