extends Node
## A0 production composition of the pinned A3 service in the mounted overworld.
## Clock is generated only by pausable physics callbacks; there is no API accepting
## ticks. As with all GDScript authority this is a trusted-code boundary, not a
## hostile same-process reflection sandbox. Uncommitted active work is discarded
## on reload/exit. A4 attestation is deliberately not configured.

const V5_PINS = preload("res://game/survival/economy/a0_v5_source_pins.gd")
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
	var pin_error: String = V5_PINS.verify()
	if not pin_error.is_empty():
		push_error("A3 economy composition refused: " + pin_error)
		return false
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
		value["last_usec"] = 0
		value["remainder_usec"] = 0


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


## A0 read of the pausable world clock, for binding an A3 receipt to the moment
## the player actually swung. It is an echo, never an authority: A3 records it as
## "A0_REQUEST_ECHO_NOT_VERIFIED_BY_A3" and never pays based on it.
func world_active_seconds() -> int:
	var world: Variant = _save.call(&"get_snapshot").get("world_slice", {})
	if not world is Dictionary or not (world as Dictionary).get("clock") is Dictionary:
		return 0
	return int(((world as Dictionary).get("clock", {}) as Dictionary).get("active_seconds", 0))


## A stable A0 world-revision string for the same receipt binding.
func world_revision() -> String:
	var world: Variant = _save.call(&"get_snapshot").get("world_slice", {})
	if not world is Dictionary or not (world as Dictionary).get("clock") is Dictionary:
		return "world:0:0"
	var clock: Dictionary = (world as Dictionary).get("clock", {})
	return "world:%d:%d" % [int(clock.get("active_seconds", 0)), int(clock.get("sequence", 0))]


## Which owned A3 tool, if any, may be used on this node right now. The decision
## is A3's: A0 only enumerates the tools the player physically owns and asks the
## pinned adapter's read-only planner. An empty string means bare hands, which is
## still the ordinary knife-first path and pays no tool wear.
## Read-only plan: which owned A3 tool (if any) may work this node right now, and
## the exact revision/world tick the decision was made with. Nothing is written.
## The caller commits with THIS revision, so a plan that went stale between the
## read and the swing is refused by A3 (`TOOL_REVISION_STALE`) instead of
## silently wearing a newer tool state.
func tool_plan_for_node(node_id: String, resource_kind: String) -> Dictionary:
	if _adapter == null or node_id.is_empty() or resource_kind.is_empty():
		return {}
	var candidate: Dictionary = _save.call(&"get_snapshot")
	var instances: Dictionary = (_adapter.call(&"document") as Dictionary).get("instances", {})
	var ids: Array = instances.keys()
	ids.sort()
	var revision := world_revision()
	var active := world_active_seconds()
	for raw_id: Variant in ids:
		var tool_id := String(raw_id)
		var tool_revision := int((instances[raw_id] as Dictionary).get("revision", -1))
		var request := {
			"contract": "soh.economy.tool_use.v1",
			"node_id": node_id,
			"resource_kind": resource_kind,
			"tool_instance_id": tool_id,
			"expected_tool_revision": tool_revision,
			"world_revision": revision,
			"active_seconds": active,
		}
		var plan: Dictionary = _adapter.call(&"plan_tool_use_candidate", candidate, request)
		if bool(plan.get("ok", false)) and bool(plan.get("allowed", false)):
			return {
				"tool_id": tool_id,
				"expected_tool_revision": tool_revision,
				"world_revision": revision,
				"active_seconds": active,
			}
	return {}


## Convenience read for callers that only need to know whether a tool applies.
func tool_for_node(node_id: String, resource_kind: String) -> String:
	return String(tool_plan_for_node(node_id, resource_kind).get("tool_id", ""))


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
			else:
				# A suspension-like gap cannot carry an earlier partial second
				# across the interruption into later active play.
				_world_remainder_usec = 0
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
		var record: Dictionary = _stations.get(id, {"ticks": 0, "steps": 0, "ack": 0, "revision": revision, "was_operational": true, "last_usec": 0, "remainder_usec": 0})
		if revision.is_empty():
			revision = String(record.get("revision", "removed:" + id))
		if String(record.get("revision", "")) != revision:
			record["revision"] = revision
			record["steps"] = 0
			record["last_usec"] = 0
			record["remainder_usec"] = 0
		if not operational:
			record["steps"] = 0
			record["last_usec"] = 0
			record["remainder_usec"] = 0
			_stations[id] = record
			if bool(record.get("was_operational", true)):
				_sequence += 1
				_flush(id)
			record["was_operational"] = false
			continue
		record["was_operational"] = true
		# Fixed callback count is not elapsed time when the physics rate changes
		# or a frame hitch reduces actual callbacks. Accumulate monotonic time
		# only while this authoritative station is active. As for world sources,
		# discard suspicious >250ms gaps rather than credit offline/focus time.
		var now := Time.get_ticks_usec()
		var last := int(record.get("last_usec", 0))
		if last > 0:
			var elapsed := now - last
			if elapsed >= 0 and elapsed <= 250000 and int(record.ticks) - int(record.ack) < MAX_UNCOMMITTED_TICKS:
				record["remainder_usec"] = int(record.get("remainder_usec", 0)) + elapsed
			elif elapsed < 0 or elapsed > 250000:
				record["remainder_usec"] = 0
		record["last_usec"] = now
		var remainder := int(record.get("remainder_usec", 0))
		if remainder >= 1000000 and int(record.ticks) - int(record.ack) < MAX_UNCOMMITTED_TICKS:
			remainder -= 1000000
			record["ticks"] = int(record.ticks) + 1
			_sequence += 1
			record["remainder_usec"] = remainder
			record["steps"] = mini(59, int(remainder * TICKS_PER_SECOND / 1000000))
			_stations[id] = record
			_flush(id)
		else:
			# This observable fractional-step value is diagnostic only; the host
			# receipt advances from monotonic microseconds, not callback count.
			record["steps"] = mini(59, int(remainder * TICKS_PER_SECOND / 1000000))
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
	if not _gameplay_active() or poi_id not in ["poi_crown_waystation", "poi_crown_relay_shed"] or _waystation_host() == null:
		return {}
	var nav := _world.get(&"traversability") as OverworldTraversability
	if nav == null:
		return {}
	var cell := nav.cell_of(_hero.global_position)
	var host := _waystation_host()
	var discovered := is_instance_valid(_world_active_point) and bool(host.call(&"matches_interaction", _world_active_point, _hero))
	if discovered:
		var current_request: Dictionary = host.call(&"request_for", _world_active_point)
		discovered = String(current_request.get("poi_id", "")) == poi_id
	var receipt := {"contract": "soh.economy.world_host.v1", "poi_id": poi_id,
		"discovered": discovered, "hero_cell": [cell.x, cell.y],
		"session_id": _session_id, "session_index": _session_index,
		"sequence": _world_sequence, "active_seconds": _world_seconds,
		"world_revision": "a1-waystation-2951bf85"}
	if discovered:
		var identity: Dictionary = host.call(&"identity_for", _world_active_point)
		receipt.merge(identity)
	return receipt


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


## Research remains owned by A3. The player supplies only the technology ID;
## A0 independently resolves the paid, reachable physical research station.
func queue_technology(technology_id: String, station_id: String) -> Dictionary:
	if not _commands_available():
		return {"ok": false, "reason": "session_inactive"}
	var station := _resolve_station(station_id)
	var node: Node2D = _build.call(&"structure_node", station_id)
	if station.is_empty() or node == null or _hero.global_position.distance_to(node.global_position + Vector2(16, 16)) > 64:
		return {"ok": false, "reason": "station_not_reachable"}
	if String(station.get("kind", "")) != "research":
		return {"ok": false, "reason": "station_research_mismatch"}
	return _adapter.call(&"research_technology", technology_id, station_id, _event())


func available_technologies(station_id: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if not _configured:
		return result
	var station := _resolve_station(station_id)
	if station.is_empty() or String(station.get("kind", "")) != "research":
		return result
	var catalog: Dictionary = _adapter.get(&"catalog")
	var technologies: Dictionary = catalog.get("technologies", {})
	var ids: Array = technologies.keys()
	ids.sort()
	for value: Variant in ids:
		var id := String(value)
		var tech: Dictionary = technologies[id]
		if int(tech.get("min_tier", 0)) > int(station.get("tier", 0)):
			continue
		result.append({"id": id, "label": String(tech.get("label", id)),
			"inputs": (tech.get("inputs", {}) as Dictionary).duplicate(true),
			"prerequisites": (tech.get("prerequisites", []) as Array).duplicate(true),
			"duration_ticks": int(tech.get("duration_ticks", 0)),
			"known": bool(_adapter.call(&"knows_technology", id))})
	return result


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
	var result: Array[Dictionary] = [{"station_id": "hand", "kind": "hand", "tier": 0, "queue_capacity": 1, "operational": true}]
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
