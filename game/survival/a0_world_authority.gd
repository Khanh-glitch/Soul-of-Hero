class_name A0WorldAuthority
extends Node2D
## R13: the authored continent is the world the game actually plays on.
##
## One world, one authority, no sidecar. This node owns the join between A1's
## authored data and A0's gameplay systems:
##
##   * A1's own reader (`game/survival/world/a1_authored_world_reader.gd`) answers
##     what a cell is, where the safe spawns are, which POIs exist and where A8's
##     three physical sites sit. A0 does not re-implement any of that.
##   * A1's own streamer (`a1_authored_world_stream.gd`) mounts the chunk geometry
##     and the StaticBody2D collision the player really collides with.
##   * A8's physical site scenes are instantiated at A1's canonical coordinates,
##     and A0 is the only code that accepts their transition requests and moves
##     the body between exterior and interior.
##   * A0's SaveService is the only thing that stores the run's spawn, so a second
##     process resumes the same run, world, spawn and position.
##
## Everything A0 does NOT do here matters too: it does not author geography, does
## not move A8 sites, does not widen the legacy 384x256 bounds, does not mint a
## POI reward (A3 authorization is absent, so an A8 intent is refused with the
## owner named), and does not keep a second clock or a second save.

const READER_PATH := "res://game/survival/world/a1_authored_world_reader.gd"
const STREAM_PATH := "res://game/survival/world/a1_authored_world_stream.gd"
const VIEW_SCRIPT := preload("res://game/survival/a0_authored_world_view.gd")
const TRAVERSABILITY_SCRIPT := preload("res://game/survival/a0_authored_traversability.gd")
const SURVIVAL_NODE_SCRIPT := preload("res://game/survival/survival_resource_node.gd")

const WORLD_ROOT := "res://data/survival/world"
const TILE := 16
const CHUNK := 64
const PHASE_CONTRACT := "soh.a0.run_phase_projection.v1"
const SAVE_ROOT := "survival"
const SAVE_KEY := "authored_world"
## How many chunk walk tables A0 keeps decoded. A flood fill spends its time in a
## handful of chunks; keeping all 192 would be hundreds of megabytes for nothing.
const WALK_CACHE_CHUNKS := 24
## Interiors are mounted far from the continent so no coordinate can be confused
## with an exterior one, and so an interior never lands on authored geography.
const INTERIOR_ORIGIN := Vector2(40000, 40000)

## Why the authored world could not be used, if it could not. Named, never
## swallowed: the caller decides what to do, and the reason travels into evidence.
var last_error := ""
var reader: Variant = null
var stream: Node2D = null
var view: A0AuthoredWorldView = null
var sites_root: Node2D = null
var interior_root: Node2D = null

var sites: Dictionary = {}          # poi_id -> shell node
var site_records: Dictionary = {}   # poi_id -> A1 physical-site record
var interior_site: Node2D = null
var interior_record: Dictionary = {}
var interior_host_poi := ""

var _walk_cache: Dictionary = {}    # chunk_id -> {"walk": PackedByteArray, "water": PackedByteArray}
var _walk_order: Array[String] = []
var _host: Node = null
var _player: Node2D = null
var _camera: Camera2D = null
var _save: Node = null
var _lifecycle: Node = null
var _spawn: Dictionary = {}
var _phase_revision := 0
var _projection_cache: Dictionary = {}
var _time_of_day := 0.35
var _transitions: Array[Dictionary] = []


# ---------------------------------------------------------------------------
# configure
# ---------------------------------------------------------------------------
func configure(host: Node, player: Node2D, camera: Camera2D, player_scene_override := "") -> bool:
	_host = host
	_player = player
	_camera = camera
	# The overworld configures the authority twice on purpose: once before the body
	# exists (the reader is needed to choose the spawn) and once after the body and
	# camera exist. The second call must not build a second reader or streamer.
	if reader != null and stream != null:
		return true
	_save = host.get_node_or_null("/root/SaveService") if host != null else null
	_lifecycle = host.get_node_or_null("/root/RunLifecycle") if host != null else null
	last_error = ""
	if not FileAccess.file_exists(READER_PATH) or not FileAccess.file_exists(STREAM_PATH):
		last_error = "A1_AUTHORED_INTERFACE_ABSENT"
		return false
	var reader_script: Script = load(READER_PATH) as Script
	var stream_script: Script = load(STREAM_PATH) as Script
	if reader_script == null or stream_script == null:
		last_error = "A1_AUTHORED_INTERFACE_UNLOADABLE"
		return false
	reader = reader_script.new()
	if not bool(reader.configure(WORLD_ROOT, player_scene_override)):
		last_error = "A1_AUTHORED_READER_REFUSED:" + String(reader.last_error)
		return false
	stream = stream_script.new() as Node2D
	stream.name = "AuthoredStream"
	add_child(stream)
	if not bool(stream.call(&"configure", WORLD_ROOT, reader, false, player_scene_override)):
		last_error = "A1_AUTHORED_STREAM_REFUSED:" + String(stream.get(&"last_error"))
		stream.queue_free()
		stream = null
		return false
	sites_root = Node2D.new()
	sites_root.name = "PhysicalSites"
	add_child(sites_root)
	interior_root = Node2D.new()
	interior_root.name = "SiteInterior"
	interior_root.position = INTERIOR_ORIGIN
	interior_root.visible = false
	add_child(interior_root)
	_build_view()
	return true


func _build_view() -> void:
	view = VIEW_SCRIPT.new() as A0AuthoredWorldView
	view.name = "AuthoredWorldView"
	# The view is a query surface, not a painter: nothing is drawn and nothing is
	# added to the tree, because A1's streamer already painted the continent.
	view.configure_authored(self)


func collision_root() -> Node2D:
	return stream.get(&"collision_root") as Node2D if stream != null else null


func world_cells() -> Vector2i:
	if reader == null:
		return Vector2i.ZERO
	var frame: Dictionary = reader.plan.get("frame", {}) if reader.plan is Dictionary else {}
	return Vector2i(int(frame.get("w", 1024)), int(frame.get("h", 768)))


func world_pixels() -> Rect2:
	var cells := world_cells()
	return Rect2(Vector2.ZERO, Vector2(cells) * TILE)


## The document shape A0's other systems already read (state, build rules). It is
## derived from A1's frame and the current run, never from legacy Hollow Marches.
func world_document() -> Dictionary:
	var cells := world_cells()
	return {
		"world_id": String(reader.plan.get("world_id", "")) if reader != null else "",
		"world_bounds": {"x": 0, "y": 0, "w": cells.x, "h": cells.y},
		"survival": {"max": 100, "start": 80},
		"landmarks": [],
		"camps": [],
		"discoveries": [],
		"start_position": [_spawn_cell().x, _spawn_cell().y],
	}


# ---------------------------------------------------------------------------
# terrain queries (A1 is the source; this is the bounded cache)
# ---------------------------------------------------------------------------
func _chunk_layers(cell: Vector2i) -> Dictionary:
	var cid := String(reader.chunk_id_at(cell))
	if _walk_cache.has(cid):
		return _walk_cache[cid]
	var loaded: Dictionary = reader.load_chunk(cid)
	if not bool(loaded.get("ok", false)):
		last_error = "A1_CHUNK_UNREADABLE:" + String(loaded.get("error", ""))
		return {}
	var layers: Dictionary = loaded.get("layers", {})
	var walk_values: PackedInt32Array = layers.get("walk", PackedInt32Array())
	var surface_values: PackedInt32Array = layers.get("surface", PackedInt32Array())
	var walk := PackedByteArray()
	walk.resize(walk_values.size())
	var water := PackedByteArray()
	water.resize(walk_values.size())
	# A1 encodes each layer as an index into the chunk's own legend, so the water
	# test is "the legend says this cell's surface is water" — not an assumed 0.
	var legend: Array = ((loaded.get("chunk", {}) as Dictionary).get("legend", {}) as Dictionary).get("surface", [])
	var water_indices: Dictionary = {}
	for index: int in range(legend.size()):
		if String(legend[index]) == "water":
			water_indices[index + 1] = true
	for index: int in range(walk_values.size()):
		walk[index] = 1 if int(walk_values[index]) == 1 else 0
		water[index] = 1 if water_indices.has(int(surface_values[index])) else 0
	var entry := {"walk": walk, "water": water}
	_walk_cache[cid] = entry
	_walk_order.append(cid)
	while _walk_order.size() > WALK_CACHE_CHUNKS:
		var evicted: String = _walk_order.pop_front()
		_walk_cache.erase(evicted)
		# A1 caches whole chunks (all five layers). Dropping the evicted chunk from
		# that cache is what keeps a long walk through the continent bounded; the
		# data is immutable on disk and reloads byte-identically.
		if reader.cache is Dictionary:
			reader.cache.erase(evicted)
	return entry


func _local_index(cell: Vector2i) -> int:
	return (cell.y % CHUNK) * CHUNK + (cell.x % CHUNK)


func cell_is_walkable(cell: Vector2i) -> bool:
	if reader == null:
		return false
	var cells := world_cells()
	if cell.x < 0 or cell.y < 0 or cell.x >= cells.x or cell.y >= cells.y:
		return false
	var layers := _chunk_layers(cell)
	if layers.is_empty():
		return false
	return int((layers.walk as PackedByteArray)[_local_index(cell)]) == 1


func cell_surface(cell: Vector2i) -> String:
	if reader == null:
		return ""
	var cells := world_cells()
	if cell.x < 0 or cell.y < 0 or cell.x >= cells.x or cell.y >= cells.y:
		return ""
	var identity: Dictionary = reader.cell_identity(cell)
	return String(identity.get("surface_id", "")) if bool(identity.get("ok", false)) else ""


## A1 names its regions ("The Ashen Crown"); the HUD asks A0 for the label rather
## than showing the world id everywhere the legacy landmark table has no entry.
func region_label_at(world_position: Vector2) -> String:
	if reader == null:
		return ""
	var cell := Vector2i(floori(world_position.x / float(TILE)), floori(world_position.y / float(TILE)))
	var identity: Dictionary = reader.cell_identity(cell)
	if not bool(identity.get("ok", false)):
		return ""
	var region_id := String(identity.get("region_id", ""))
	if region_id.is_empty():
		return ""
	for raw: Variant in reader.plan.get("regions", []):
		var entry: Dictionary = raw
		if String(entry.get("region_id", "")) == region_id:
			var label := String(entry.get("name", ""))
			return label if not label.is_empty() else region_id.replace("_", " ")
	return region_id.replace("_", " ")


func cell_is_road(cell: Vector2i) -> bool:
	if reader == null:
		return false
	var base: Dictionary = reader.cell_layers(cell)
	if not bool(base.get("ok", false)):
		return false
	return int((base.values as Dictionary).get("road", 0)) == 1


func authored_blocked_cells() -> int:
	return -1


# ---------------------------------------------------------------------------
# spawn: broad, safe, per run, persisted by the one SaveService
# ---------------------------------------------------------------------------
func spawn_cell() -> Vector2i:
	if _spawn.is_empty():
		return Vector2i(-1, -1)
	var cell: Array = _spawn.get("cell", [])
	return Vector2i(int(cell[0]), int(cell[1])) if cell.size() == 2 else Vector2i(-1, -1)


func spawn_record() -> Dictionary:
	return _spawn.duplicate(true)


## A new run's spawn is A1's own hash-seeded choice over the whole spawn index —
## broadly distributed across the continent, safe by A1's nine-cell rule, and
## stored in A0's save so a reload (or a second process) resumes the same place in
## the same run instead of re-rolling the world.
func ensure_spawn(now_unix: int = -1) -> Dictionary:
	var run: Dictionary = _run_phase()
	var world_id := String(reader.plan.get("world_id", "")) if reader != null else ""
	var stored := _stored_spawn()
	var current_run := String(run.get("run_id", ""))
	var stored_run := String(stored.get("run_id", ""))
	# A spawn can be chosen before the run record exists (the world needs a body
	# before the economy composition opens the run). Such a spawn is unbound, not
	# foreign: it belongs to the world it was drawn from, and the run it is standing
	# in adopts it on the first frame the run identity is known. A spawn that names
	# a *different*, non-empty run is foreign and is never resumed.
	var run_matches := stored_run == current_run or stored_run.is_empty() or current_run.is_empty()
	var same_run := not stored.is_empty() \
		and String(stored.get("world_id", "")) == world_id \
		and run_matches
	if same_run:
		var cell: Array = stored.get("cell", [])
		if cell.size() == 2 and cell_is_walkable(Vector2i(int(cell[0]), int(cell[1]))):
			_spawn = stored.duplicate(true)
			_spawn["resumed"] = true
			if stored_run.is_empty() and not current_run.is_empty():
				_spawn["run_id"] = current_run
				_spawn["run_epoch"] = int(run.get("run_epoch", 0))
				_spawn["adopted_run"] = true
				if not _write_spawn(_spawn):
					last_error = "SPAWN_ADOPTION_NOT_PERSISTED"
			print("A0_SPAWN_RESUMED ", JSON.stringify(_spawn))
			return _spawn
		# A stored spawn that is no longer walkable is reported, not silently
		# replaced by a different one: that would hide a world/run mismatch.
		last_error = "STORED_SPAWN_NOT_WALKABLE"
		print("A0_SPAWN_REFUSED stale_cell=%s world=%s run=%s" % [str(cell), world_id, String(stored.get("run_id", ""))])
	var seed := _run_seed(run, now_unix)
	var choice: Dictionary = reader.choose_safe_spawn(seed)
	if not bool(choice.get("ok", false)):
		last_error = "SPAWN_UNSAFE:" + String(choice.get("error", ""))
		return {"ok": false, "reason": last_error}
	var chosen: Array = choice.get("cell_array", [])
	_spawn = {
		"schema": "soh.a0.authored_spawn.v1", "world_id": world_id,
		"run_id": String(run.get("run_id", "")), "run_epoch": int(run.get("run_epoch", 0)),
		"seed": seed, "cell": chosen.duplicate(), "chunk_id": String(choice.get("chunk_id", "")),
		"region_id": String(choice.get("region_id", "")),
		"candidates": int(choice.get("candidate_cells", 0)), "candidate_chunks": int(choice.get("candidate_chunks", 0)),
		"resumed": false,
	}
	# A0's single authority stores it. A failed write is a failed spawn commitment:
	# the run would not survive a process change, so it is reported as such.
	var saved := _write_spawn(_spawn)
	_spawn["saved"] = saved
	print("A0_SPAWN_CHOSEN ", JSON.stringify(_spawn))
	if not saved:
		last_error = "SPAWN_NOT_PERSISTED"
	return {"ok": saved, "reason": "" if saved else last_error, "spawn": _spawn.duplicate(true)}


func refresh_spawn_after_load() -> Dictionary:
	# A loader that already restored the save keeps the run; re-reading the stored
	# record is all that is needed, and it must not re-roll.
	return ensure_spawn()


func _stored_spawn() -> Dictionary:
	if _save == null:
		return {}
	var path: Array[String] = [SAVE_ROOT, SAVE_KEY]
	var raw: Variant = _save.call(&"get_value", path, {})
	if not raw is Dictionary:
		return {}
	var doc: Dictionary = raw
	var spawn: Variant = doc.get("spawn", {})
	return (spawn as Dictionary).duplicate(true) if spawn is Dictionary else {}


func _write_spawn(record: Dictionary) -> bool:
	if _save == null or not _save.has_method(&"patch_state_path"):
		return false
	var path: Array[String] = [SAVE_ROOT, SAVE_KEY]
	var payload := {"schema": "soh.a0.authored_world.v1", "spawn": record.duplicate(true),
		"world_id": String(record.get("world_id", ""))}
	return bool(_save.call(&"patch_state_path", path, payload))


func _run_seed(run: Dictionary, now_unix: int) -> int:
	# The seed is derived from the run identity so it is reproducible for evidence
	# and regenerated for every new run — a new run gets a new continent-wide
	# choice, a reload of the same run never does.
	var run_id := String(run.get("run_id", ""))
	if run_id.is_empty():
		run_id = "run-unbound-%d" % (now_unix if now_unix >= 0 else int(Time.get_unix_time_from_system()))
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update((run_id + "|" + str(int(run.get("run_epoch", 0)))).to_utf8_buffer())
	var digest := ctx.finish()
	return int(digest.decode_s32(0)) & 0x7fffffff


func _run_phase() -> Dictionary:
	if _lifecycle == null:
		return {"state": "absent", "phase": "absent", "run_id": "", "run_epoch": 0, "seconds_elapsed": 0}
	var phase: Dictionary = _lifecycle.call(&"phase")
	return phase


# ---------------------------------------------------------------------------
# streaming
# ---------------------------------------------------------------------------
func advance(center_px: Vector2, view_rect: Rect2, region_id := "") -> Dictionary:
	if stream == null:
		return {"ok": false, "error": "STREAM_ABSENT"}
	var result: Dictionary = stream.call(&"update_stream", center_px, view_rect)
	if not bool(result.get("ok", false)):
		last_error = "A1_STREAM_FAILED:" + String(result.get("error", ""))
		return result
	if not String(region_id).is_empty():
		stream.call(&"set_time_of_day", _time_of_day, region_id)
	return result


func bind_focus(player: Node2D) -> bool:
	return bool(stream.call(&"bind_focus", player)) if stream != null else false


func apply_time_of_day(t: float) -> void:
	_time_of_day = clampf(t, 0.0, 1.0)
	if stream != null:
		stream.call(&"set_time_of_day", _time_of_day)


func stream_status() -> Dictionary:
	if stream == null:
		return {"configured": false, "error": "STREAM_ABSENT"}
	var loaded: Dictionary = stream.get(&"loaded_chunks") as Dictionary
	return {
		"configured": true, "chunks_loaded": loaded.size(),
		"max_chunks": int(stream.get(&"max_loaded_chunks")), "events": (stream.get(&"stream_events") as Array).size(),
		"world_px": [world_pixels().size.x, world_pixels().size.y], "error": last_error,
	}


# ---------------------------------------------------------------------------
# physical A8 sites at A1's canonical coordinates
# ---------------------------------------------------------------------------
## Mounts A8's exterior shells for the sites A1 authored *and* A8 published. Each
## shell is a real scene with real collision at A1's canonical anchor; A0 never
## nudges one to make a route easier.
func mount_physical_sites(required: Array = []) -> Dictionary:
	var mounted: Array = []
	var refused: Array = []
	var keys: Array = _site_keys()
	for key: String in keys:
		var record: Dictionary = reader.physical_site(key)
		if not bool(record.get("ok", false)):
			refused.append({"site": key, "reason": String(record.get("error", ""))})
			continue
		var poi_id := String(record.get("poi_id", ""))
		var scene_path := String(record.get("shell_scene", ""))
		if scene_path.is_empty() or not FileAccess.file_exists(scene_path):
			refused.append({"site": key, "reason": "A8_SHELL_SCENE_ABSENT:" + scene_path})
			continue
		var packed: PackedScene = load(scene_path) as PackedScene
		if packed == null:
			refused.append({"site": key, "reason": "A8_SHELL_SCENE_UNLOADABLE:" + scene_path})
			continue
		var shell := packed.instantiate() as Node2D
		if shell == null:
			refused.append({"site": key, "reason": "A8_SHELL_SCENE_NOT_NODE2D:" + scene_path})
			continue
		shell.name = "Site_%s" % key
		var origin: Array = record.get("shell_origin_world_px", [])
		shell.position = Vector2(float(origin[0]), float(origin[1])) if origin.size() == 2 else Vector2.ZERO
		sites_root.add_child(shell)
		var projection := _projection_for(poi_id)
		var applied := bool(shell.call(&"apply_run_phase_projection", projection))
		if not bool(applied):
			refused.append({"site": key, "reason": "A8_PHASE_PROJECTION_REFUSED"})
			shell.queue_free()
			continue
		if shell.has_signal("transition_requested"):
			shell.connect("transition_requested", _on_transition_requested.bind(poi_id))
		if shell.has_signal("player_feedback"):
			shell.connect("player_feedback", _on_site_feedback)
		sites[poi_id] = shell
		site_records[poi_id] = record
		mounted.append({"poi_id": poi_id, "cell": record.get("canonical_cell", []),
			"world_px": [shell.position.x, shell.position.y], "scene": scene_path})
	var missing: Array = []
	for poi: Variant in required:
		if not sites.has(String(poi)):
			missing.append(String(poi))
	print("A0_SITES_MOUNTED ", JSON.stringify({"mounted": mounted, "refused": refused, "missing_required": missing}))
	return {"ok": missing.is_empty() and refused.is_empty(), "mounted": mounted,
		"refused": refused, "missing_required": missing}


func _site_keys() -> Array:
	# A1's runtime contract is the list of sites it recognizes; asking it keeps A0
	# from inventing a fourth site or dropping one A1 published.
	var contract: Dictionary = reader.runtime_contract
	var specs: Dictionary = contract.get("physical_sites", {})
	var keys: Array = specs.keys()
	keys.sort()
	return keys


func site(poi_id: String) -> Node2D:
	return sites.get(poi_id) as Node2D


func site_cell(poi_id: String) -> Vector2i:
	var record: Dictionary = site_records.get(poi_id, {})
	var cell: Array = record.get("canonical_cell", [])
	return Vector2i(int(cell[0]), int(cell[1])) if cell.size() == 2 else Vector2i(-1, -1)


## The exterior door position of a mounted site, in world pixels.
func site_door_world(poi_id: String) -> Vector2:
	var shell := site(poi_id)
	if shell == null:
		return Vector2(-1, -1)
	return shell.global_position + (shell.call(&"get_entry_position") as Vector2)


## The walkable stand in front of the door. A1 publishes an approach cell; A0
## walks the player there rather than teleporting it, so the gate measures a route.
func site_approach_world(poi_id: String) -> Vector2:
	var record: Dictionary = site_records.get(poi_id, {})
	var foot: Array = record.get("approach_foot_world_px", [])
	if foot.size() == 2:
		return Vector2(float(foot[0]), float(foot[1]))
	var door := site_door_world(poi_id)
	return door + Vector2(0, 16)


func site_summary() -> Array:
	var out: Array = []
	for poi_id: String in sites.keys():
		var shell := site(poi_id)
		var record: Dictionary = site_records.get(poi_id, {})
		out.append({
			"poi_id": poi_id, "canonical_cell": record.get("canonical_cell", []),
			"door_world": [site_door_world(poi_id).x, site_door_world(poi_id).y],
			"approach_world": [site_approach_world(poi_id).x, site_approach_world(poi_id).y],
			"visible": shell != null and shell.is_visible_in_tree(),
			"context": String(shell.call(&"get_context_hint", _player)) if shell != null else "",
		})
	return out


# ---------------------------------------------------------------------------
# transitions: the only code that moves the body between exterior and interior
# ---------------------------------------------------------------------------
func _on_transition_requested(request: Dictionary, poi_id: String) -> void:
	_transitions.append(request.duplicate(true))
	if String(request.get("direction", "")) == "enter":
		enter_site(String(request.get("poi_id", poi_id)))
	elif String(request.get("direction", "")) == "exit":
		exit_site()


func _on_site_feedback(message: String) -> void:
	if _host != null and _host.has_method(&"_say"):
		_host.call(&"_say", message)


## Enter the worksite behind a shell the player physically reached and faced.
func enter_site(poi_id: String) -> Dictionary:
	if interior_site != null:
		return {"ok": false, "reason": "ALREADY_INSIDE"}
	var record: Dictionary = site_records.get(poi_id, {})
	if record.is_empty():
		return {"ok": false, "reason": "SITE_NOT_MOUNTED"}
	var scene_path := String(record.get("interior_scene", ""))
	if scene_path.is_empty() or not FileAccess.file_exists(scene_path):
		return {"ok": false, "reason": "A8_INTERIOR_SCENE_ABSENT:" + scene_path}
	var packed: PackedScene = load(scene_path) as PackedScene
	if packed == null:
		return {"ok": false, "reason": "A8_INTERIOR_SCENE_UNLOADABLE:" + scene_path}
	var site_node := packed.instantiate() as Node2D
	if site_node == null:
		return {"ok": false, "reason": "A8_INTERIOR_SCENE_NOT_NODE2D:" + scene_path}
	site_node.name = "Worksite_%s" % poi_id
	interior_root.add_child(site_node)
	var projection := _projection_for(poi_id)
	if site_node.has_method(&"apply_run_phase_projection"):
		site_node.call(&"apply_run_phase_projection", projection)
	if site_node.has_method(&"set_phase_intents_enabled"):
		# Physical interaction is allowed; *rewards* are not. A8 emits an intent
		# and A0 answers with a refusal that names A3, so the player sees an honest
		# "not authorized yet" instead of a silent no-op or a free item.
		site_node.call(&"set_phase_intents_enabled", true)
	if site_node.has_signal("transition_requested"):
		site_node.connect("transition_requested", _on_transition_requested.bind(poi_id))
	if site_node.has_signal("intent_requested"):
		site_node.connect("intent_requested", _on_site_intent)
	if site_node.has_signal("player_feedback"):
		site_node.connect("player_feedback", _on_site_feedback)
	interior_site = site_node
	interior_record = record
	interior_host_poi = poi_id
	# The exterior is suspended, not unmounted: A1's stream keeps its chunks so the
	# return trip needs no reload, and nothing outside can collide with the body.
	sites_root.visible = false
	if stream != null:
		stream.visible = false
	interior_root.visible = true
	var spawn_local: Vector2 = site_node.call(&"get_spawn_position") if site_node.has_method(&"get_spawn_position") else Vector2(64, 548)
	_place_player(INTERIOR_ORIGIN + spawn_local)
	_apply_camera_limits(Rect2(INTERIOR_ORIGIN, _interior_bounds(record)))
	print("A0_SITE_ENTERED %s scene=%s spawn=%s" % [poi_id, scene_path, str(INTERIOR_ORIGIN + spawn_local)])
	return {"ok": true, "poi_id": poi_id, "scene": scene_path, "spawn": INTERIOR_ORIGIN + spawn_local}


func exit_site() -> Dictionary:
	if interior_site == null:
		return {"ok": false, "reason": "NOT_INSIDE"}
	var poi_id := interior_host_poi
	var record := interior_record
	interior_site.queue_free()
	interior_site = null
	interior_record = {}
	interior_host_poi = ""
	interior_root.visible = false
	sites_root.visible = true
	if stream != null:
		stream.visible = true
	# The return anchor is A8's shell doorway at A1's canonical cell, so a return
	# is a physical place, not a spawn point of convenience.
	var door := site_door_world(poi_id)
	var back := door + Vector2(0, 18)
	_place_player(back)
	var cells := world_cells()
	_apply_camera_limits(Rect2(Vector2.ZERO, Vector2(cells) * TILE))
	print("A0_SITE_EXITED %s return=%s" % [poi_id, str(back)])
	return {"ok": true, "poi_id": poi_id, "return": back}


func inside_site() -> String:
	return interior_host_poi


func _interior_bounds(record: Dictionary) -> Vector2:
	var bounds: Array = record.get("interior_bounds_px", [])
	if bounds.size() == 2:
		return Vector2(float(bounds[0]), float(bounds[1]))
	return Vector2(960, 600)


func _place_player(position: Vector2) -> void:
	if _player == null or not is_instance_valid(_player):
		return
	_player.global_position = position
	if _player is CharacterBody2D:
		(_player as CharacterBody2D).velocity = Vector2.ZERO


func _apply_camera_limits(rect: Rect2) -> void:
	if _camera == null or not is_instance_valid(_camera):
		return
	_camera.limit_left = int(rect.position.x)
	_camera.limit_top = int(rect.position.y)
	_camera.limit_right = int(rect.end.x)
	_camera.limit_bottom = int(rect.end.y)


## A8's intent is answered, never ignored: an unauthorized reward is refused with
## the owner named, and the site is told the outcome so it can show the reason.
func _on_site_intent(intent: Dictionary) -> void:
	if interior_site == null:
		return
	var intent_id := String(intent.get("intent_id", ""))
	var refusal := {
		"intent_id": intent_id, "status": "rejected",
		"reason": "A3_SOURCE_AUTHORIZATION_ABSENT: R13-A3-VALUE has not authorized this source yet, so A0 will not mint a reward.",
	}
	interior_site.call(&"receive_authoritative_result", intent_id, refusal, {})
	print("A0_SITE_INTENT_REFUSED ", JSON.stringify({"poi_id": interior_host_poi, "intent": intent.get("action_id", intent.get("intent_id", ""))}))


## Everything the player can do at a site with the ordinary interact key.
func interact(player: Node2D) -> Dictionary:
	if interior_site != null:
		if bool(interior_site.call(&"is_at_exit", player)):
			if bool(interior_site.call(&"try_exit", player)):
				return {"ok": true, "action": "exit_requested", "poi": interior_host_poi}
		if bool(interior_site.call(&"try_interact", player)):
			return {"ok": true, "action": "intent_requested", "poi": interior_host_poi}
		return {"ok": false, "action": "nothing_in_reach"}
	for poi_id: String in sites.keys():
		var shell := site(poi_id)
		if shell == null or not is_instance_valid(shell):
			continue
		if not bool(shell.call(&"_is_at_door", player)):
			continue
		if bool(shell.call(&"try_enter", player)):
			return {"ok": true, "action": "enter_requested", "poi": poi_id}
		return {"ok": false, "action": "enter_refused", "poi": poi_id}
	return {"ok": false, "action": "no_site_in_reach"}


## The hint line the HUD shows when a site is in reach (A8's own words).
func context_hint(player: Node2D) -> String:
	if interior_site != null:
		return String(interior_site.call(&"get_context_hint", player))
	for poi_id: String in sites.keys():
		var shell := site(poi_id)
		if shell == null:
			continue
		var hint := String(shell.call(&"get_context_hint", player))
		if not hint.is_empty():
			return hint
	return ""


# ---------------------------------------------------------------------------
# A0's run phase projection (A8 validates it; A0 owns the run)
# ---------------------------------------------------------------------------
func _projection_for(poi_id: String) -> Dictionary:
	var world_id := String(reader.plan.get("world_id", "")) if reader != null else ""
	var phase := _run_phase()
	var elapsed_hours := float(phase.get("seconds_elapsed", 0)) / 3600.0
	var phase_id := "ordinary"
	if elapsed_hours >= 312.0:
		phase_id = "ragnarok_day14"
	elif elapsed_hours >= 288.0:
		phase_id = "ragnarok_day13"
	elif elapsed_hours >= 264.0:
		phase_id = "ragnarok_day12"
	_phase_revision += 1
	var effects: Array = []
	if phase_id != "ordinary":
		effects.append("a0.phase.%s" % phase_id.replace("ragnarok_", "ragnarok."))
	return {
		"contract_id": PHASE_CONTRACT,
		"projection_authority": "A0.RunLifecycle",
		"world_id": world_id,
		"poi_id": poi_id,
		"site_instance_id": "site:%s:%s" % [poi_id, String(phase.get("run_id", ""))],
		"run_id": String(phase.get("run_id", "")),
		"run_epoch": int(phase.get("run_epoch", 0)),
		"projection_revision": _phase_revision,
		"elapsed_real_hours": elapsed_hours,
		"phase_id": phase_id,
		"active_effect_ids": effects,
		"environment": {},
	}


# ---------------------------------------------------------------------------
# physical sources: A1's authored harvest nodes become real interactables
# ---------------------------------------------------------------------------
## A1's authored resource nodes become real interactables.
##
## Nothing is scattered and nothing is invented: the nodes come from A1's plan, in
## A1's cells, filtered to the material keys A3's catalog can actually harvest and to
## cells the player can stand next to. They are mounted nearest-first so the first
## harvested source is the closest authored one, whatever region the run spawned in —
## a radius cap that found nothing near a random spawn would be a silent empty world.
func mount_authored_sources(parent: Node, kinds: Dictionary, radius_cells := 160, limit := 12) -> Array:
	var origin := spawn_cell()
	if origin.x < 0 or reader == null:
		return []
	var near: Array = reader.resource_nodes_near(origin, radius_cells)
	var reachable: Array = []
	var unharvestable := 0
	var out_of_reach := 0
	for raw: Variant in near:
		var entry: Dictionary = raw
		var kind := String(entry.get("material_key", ""))
		if not kinds.has(kind):
			unharvestable += 1
			continue
		var cell: Array = (entry.get("node", {}) as Dictionary).get("cell", [])
		if cell.size() != 2:
			unharvestable += 1
			continue
		var cell_value := Vector2i(int(cell[0]), int(cell[1]))
		if not _has_standable_neighbour(cell_value):
			out_of_reach += 1
			continue
		reachable.append(entry)
	reachable.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.get("distance_cells", 0)) < int(b.get("distance_cells", 0)))
	var out: Array = []
	for raw: Variant in reachable:
		if out.size() >= limit:
			break
		var entry: Dictionary = raw
		var node_data: Dictionary = entry.get("node", {})
		var cell: Array = node_data.get("cell", [])
		var cell_value := Vector2i(int(cell[0]), int(cell[1]))
		var kind := String(entry.get("material_key", ""))
		var resource_kind := String(kinds[kind])
		var node_id := String(entry.get("node_id", ""))
		var node := SURVIVAL_NODE_SCRIPT.new() as SurvivalResourceNode
		node.name = "Authored_%s" % node_id.replace(":", "_").replace(",", "_")
		node.node_id = node_id
		node.resource_kind = resource_kind
		node.display_name = String(node_data.get("kind_label", resource_kind)).capitalize()
		node.position = Vector2(cell_value.x * TILE + 8, cell_value.y * TILE + 8)
		parent.add_child(node)
		out.append({"node_id": node_id, "kind": resource_kind, "material_key": kind,
			"cell": [cell_value.x, cell_value.y], "distance_cells": int(entry.get("distance_cells", 0)),
			"display_name": node.display_name})
	if not out.is_empty():
		print("A0_AUTHORED_SOURCES ", JSON.stringify({"mounted": out, "unharvestable": unharvestable,
			"no_standable_neighbour": out_of_reach, "radius_cells": radius_cells}))
	else:
		print("A0_AUTHORED_SOURCES_NONE ", JSON.stringify({"unharvestable": unharvestable,
			"no_standable_neighbour": out_of_reach, "radius_cells": radius_cells,
			"considered": near.size()}))
	return out


## Harvesting needs the player within 44 px of the node origin, so a node whose cell
## and its four neighbours are all unwalkable is not a source a player can use; A0
## reports it instead of mounting an unreachable interactable.
func _has_standable_neighbour(cell: Vector2i) -> bool:
	if cell_is_walkable(cell):
		return true
	for step: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
		if cell_is_walkable(cell + step):
			return true
	return false


func source_report() -> Dictionary:
	return {
		"reader": String(reader.plan.get("world_id", "")) if reader != null else "",
		"reader_source": "a1_production",
		"frame": [world_cells().x, world_cells().y],
		"spawn": _spawn.duplicate(true),
		"sites": site_summary(),
		"stream": stream_status(),
		"error": last_error,
	}
