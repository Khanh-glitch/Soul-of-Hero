extends Node
## THE HOLLOW MARCHES — native visual evidence.
##
## Boots the production `app_root.tscn`, enters the Marches through `AppFlow`
## exactly as the Home screen does, then photographs twelve stations derived
## from the authored world document. Nothing is hand-placed per station: if the
## crypt moves in `author.py`, this camera follows it, so the evidence cannot
## silently drift away from the geography it claims to show.
##
## Stations:
##   world_overview   whole 384x256 envelope, one pixel per tile (orthographic)
##   refuge_start     the refuge hollow the player wakes in
##   crypt_approach   the L01 approach road
##   ossuary_approach L02, for terrain/variance comparison
##   road_terrain     the military road crossing three terrain bands
##   camp_crossroads  a lit camp (NOT a decorative fire)
##   shortcut_before  the crucible bridge, closed
##   shortcut_after   the same frame, opened
##   crucible         L05 Blood Crucible basin
##   beacon           L07 The Failing Beacon
##   gate             L09 The Crimson Gate
##   throne           L10 Castellan Throne
##   region_north     the northern precinct / pass
##
## Usage (needs a real GPU or Xvfb + a GL driver — BLOCKED locally, run in CI):
##   xvfb-run -s "-screen 0 1280x720x24" godot --path . \
##     res://tools/captures/chapter1_overworld_native_capture.tscn -- \
##     --out-dir=res://.artifacts/overworld/native [--check]
##
## `--check` renders and validates but writes no PNG to the repo (CI artifact
## upload still happens outside the checkout). Exit code is 0 only if every
## station produced a non-blank image of the expected size.

const APP_ROOT_SCENE: PackedScene = preload("res://game/app/app_root.tscn")
const TILE := 16.0

var _out_dir := "res://.artifacts/overworld/native"
var _check_only := false
var _sim_frames := 12
var _app_root: Node
var _written := 0
var _failed: Array[String] = []


func _ready() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--out-dir="):
			_out_dir = argument.get_slice("=", 1).strip_edges()
		elif argument.begins_with("--sim-frames="):
			_sim_frames = maxi(6, int(argument.get_slice("=", 1)))
		elif argument == "--check":
			_check_only = true
	if DisplayServer.get_name() == "headless":
		# Never pretend: a headless run cannot photograph anything.
		push_warning("OVERWORLD CAPTURE BLOCKED: DisplayServer is headless")
		print("OVERWORLD CAPTURE BLOCKED - no display server")
		get_tree().quit(2)
		return
	# Do NOT touch the root window here. project.godot already declares the
	# presentation (640x360 base viewport, 1280x720 window override, canvas_items
	# stretch); re-setting size/content_scale from _ready() fights the stretch
	# calculation, and on a WM-less Xvfb that resize never settles - the capture
	# ran the full timeout without ever drawing a frame or printing a station.
	# The window geometry comes from the command line (--resolution 1280x720).
	print("OVERWORLD CAPTURE geometry window=%s viewport=%s" % [
		get_window().size, get_viewport().get_visible_rect().size])
	_run.call_deferred()


func _run() -> void:
	var save_path := OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if save_path.is_empty():
		save_path = "user://tests/overworld_capture_%d.json" % Time.get_ticks_usec()
	SaveService.call(&"configure_storage", save_path, true)
	_app_root = APP_ROOT_SCENE.instantiate()
	add_child(_app_root)
	await get_tree().process_frame

	# Straight to the Marches. Going via Home here fired the Home screen's own
	# "AppFlow did not open the startup profile choice" error, and the Home ->
	# Marches entry is the acceptance test's job, not the photographer's.
	AppFlow.call(&"open_overworld", {})
	var ow := await _await_world(40.0)
	if ow == null:
		push_error("OVERWORLD CAPTURE FAIL: world never reached READY")
		get_tree().quit(1)
		return
	print("OVERWORLD CAPTURE: world ready, %d props" % ow.world.prop_count())

	_stamp("world ready")
	await _overview(ow)
	# Nothing below is hand-placed. Each station is a landmark (or camp) id from
	# the authored world document, plus that landmark's own `capture_offset`,
	# which author.py derives from the height of the sprite standing there. If a
	# building moves or grows, the camera follows it.
	for entry: Dictionary in [
			{"station": "refuge_start", "anchor": "refuge"},
			{"station": "crypt_approach", "anchor": "lm_crypt"},
			{"station": "ossuary_approach", "anchor": "lm_ossuary"},
			{"station": "camp_crossroads", "anchor": "camp_crossroads"},
			{"station": "crucible", "anchor": "lm_crucible"},
			{"station": "beacon", "anchor": "lm_beacon"},
			{"station": "gate", "anchor": "lm_gate"},
			{"station": "throne", "anchor": "lm_throne"},
	]:
		await _station(ow, String(entry["station"]), _station_cell(ow, String(entry["anchor"])))
	await _station(ow, "road_terrain", Vector2i(150, 170))
	await _station(ow, "shortcut_before", _shortcut_cell(ow, &"short_crucible_bridge"))
	ow.state.open_shortcut(&"short_crucible_bridge")
	await get_tree().process_frame
	await _station(ow, "shortcut_after", _shortcut_cell(ow, &"short_crucible_bridge"))
	await _station(ow, "region_north", Vector2i(214, 60))

	if _written == 0:
		push_error("OVERWORLD CAPTURE FAIL: no station produced an image")
	if not _failed.is_empty():
		print("OVERWORLD CAPTURE FAILED: %s" % ", ".join(_failed))
		get_tree().quit(1)
		return
	print("OVERWORLD CAPTURE PASSED - %d images" % _written)
	get_tree().quit(0)


# -- stations ------------------------------------------------------------------
func _station(ow: Node, station: String, cell: Vector2i) -> void:
	_stamp("station %s begin" % station)
	var player: CharacterBody2D = ow.player
	if player == null:
		_failed.append(station)
		return
	var target := Vector2(cell * Vector2i(16, 16)) + Vector2(8, 8)
	ow.teleport_to(target)
	await _settle(_sim_frames)
	var camera := player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
		camera.force_update_scroll()
	await _settle(2)
	await _shoot(station)
	_stamp("station %s end" % station)


func _stamp(text: String) -> void:
	# Wall-clock progress markers: if a CI run is killed by `timeout`, the log
	# says which station it was on instead of leaving a silent gap.
	print("OVERWORLD CAPTURE [%6.1fs] %s" % [Time.get_ticks_msec() / 1000.0, text])


func _overview(ow: Node) -> void:
	# One pixel per tile: the whole Marches in a single honest frame. The camera
	# is temporarily removed from the player so no tween fights the sweep.
	_stamp("overview begin")
	var world: Node2D = ow.world
	if world == null:
		_failed.append("world_overview")
		return
	var player: CharacterBody2D = ow.player
	var camera: Camera2D = null
	if player != null:
		camera = player.get_node_or_null("Camera") as Camera2D
	_stamp("overview: player camera %s" % ("found" if camera != null else "absent"))
	var saved_limits := [0, 0, 0, 0]
	if camera != null:
		saved_limits = [camera.limit_left, camera.limit_top, camera.limit_right, camera.limit_bottom]
		# Godot 4 has no Camera2D.clear_current() (that was the 3.x API): making
		# the overview camera current is what unsets this one. Calling the 3.x
		# method threw "Nonexistent function 'clear_current'", which aborted this
		# whole function, skipped the overview shot and still let the capture
		# exit 0 - the reason the missing PNG had no failure attached to it.
	var overview := Camera2D.new()
	overview.name = "OverviewCamera"
	# 6144x4096 world into a 640x360 frame: zoom > 1 shrinks what is shown.
	overview.zoom = Vector2(6144.0 / 640.0, 4096.0 / 360.0)
	overview.position = Vector2(6144.0, 4096.0) * 0.5
	overview.limit_left = 0
	overview.limit_top = 0
	overview.limit_right = 6144
	overview.limit_bottom = 4096
	world.add_child(overview)
	overview.make_current()
	_stamp("overview: camera current, settling")
	await _settle(4)
	await _shoot("world_overview")
	overview.queue_free()
	_stamp("overview end")
	if camera != null:
		camera.limit_left = int(saved_limits[0])
		camera.limit_top = int(saved_limits[1])
		camera.limit_right = int(saved_limits[2])
		camera.limit_bottom = int(saved_limits[3])
		camera.make_current()


func _await_post_draw(timeout_msec: int = 10000) -> bool:
	# Bounded: if the driver never presents a frame, say so and fail that station
	# instead of blocking the whole job until `timeout` kills it.
	var drawn := [false]
	var on_draw := func() -> void: drawn[0] = true
	RenderingServer.frame_post_draw.connect(on_draw, CONNECT_ONE_SHOT)
	var deadline := Time.get_ticks_msec() + timeout_msec
	while not drawn[0] and Time.get_ticks_msec() < deadline:
		await get_tree().process_frame
	if RenderingServer.frame_post_draw.is_connected(on_draw):
		RenderingServer.frame_post_draw.disconnect(on_draw)
	return drawn[0]


func _shoot(station: String) -> void:
	if not await _await_post_draw():
		_failed.append(station)
		push_error("OVERWORLD CAPTURE: %s never got a presented frame" % station)
		return
	var image := get_viewport().get_texture().get_image()
	if image == null or image.get_width() < 2:
		_failed.append(station)
		push_error("OVERWORLD CAPTURE: %s produced no image" % station)
		return
	# A flat-colour frame is a failed camera, not a dark game: reject it.
	if _is_blank(image):
		_failed.append(station)
		push_error("OVERWORLD CAPTURE: %s rendered a blank frame" % station)
		return
	_written += 1
	print("OVERWORLD STATION %s size=%dx%d blank=false" % [station, image.get_width(), image.get_height()])
	if _check_only:
		return
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out_dir))
	var output := "%s/overworld_%s.png" % [_out_dir, station]
	var result := image.save_png(ProjectSettings.globalize_path(output))
	if result != OK:
		_failed.append(station)
		push_error("OVERWORLD CAPTURE: could not write %s (%d)" % [output, result])
		return
	var bytes := 0
	var written_file := FileAccess.open(output, FileAccess.READ)
	if written_file != null:
		bytes = written_file.get_length()
		written_file.close()
	print("OVERWORLD PNG %s (%d bytes)" % [output, bytes])
	# Fail closed on a write that reported OK but produced nothing: a missing
	# PNG must be a failed station, not a silent gap in the evidence set.
	if bytes <= 0:
		_failed.append(station)
		push_error("OVERWORLD CAPTURE: %s wrote zero bytes to %s" % [station, output])


func _is_blank(image: Image) -> bool:
	var step := maxi(1, image.get_width() / 32)
	var first := image.get_pixel(image.get_width() / 2, image.get_height() / 2)
	for y in range(0, image.get_height(), step):
		for x in range(0, image.get_width(), step):
			if not image.get_pixel(x, y).is_equal_approx(first):
				return false
	return true


# -- helpers -------------------------------------------------------------------
func _settle(frames: int) -> void:
	for _frame: int in frames:
		await get_tree().physics_frame
		await get_tree().process_frame


func _await_world(timeout: float) -> Node:
	var deadline := Time.get_ticks_msec() + int(timeout * 1000.0)
	while Time.get_ticks_msec() < deadline:
		var host := _app_root.get_node_or_null("RouteHost")
		if host != null and host.get_child_count() > 0:
			var child: Node = host.get_child(0)
			if child.has_method(&"is_world_ready") and bool(child.call(&"is_world_ready")):
				return child
		await get_tree().process_frame
	return null


func _world_doc(ow: Node) -> Dictionary:
	var data: Variant = ow.get(&"world_data")
	return data if data is Dictionary else {}


## A landmark's framing point: its authored position plus the offset that the
## world document derived from the height of its sprite.
func _station_cell(ow: Node, anchor: String) -> Vector2i:
	var doc := _world_doc(ow)
	for raw: Variant in doc.get("landmarks", []):
		if raw is Dictionary and String((raw as Dictionary).get("id", "")) == anchor:
			var entry: Dictionary = raw
			var pos: Array = entry.get("pos", [0, 0])
			var offset: Array = entry.get("capture_offset", [0, 0])
			return Vector2i(int(pos[0]) + int(offset[0]), int(pos[1]) + int(offset[1]))
	if anchor == "refuge":
		var refuge: Dictionary = doc.get("refuge", {})
		var rpos: Array = refuge.get("pos", doc.get("start_position", [56, 218]))
		return Vector2i(int(rpos[0]), int(rpos[1]))
	return _cell(anchor, Vector2i(56, 218))


func _shortcut_cell(ow: Node, shortcut_id: StringName) -> Vector2i:
	for raw: Variant in _world_doc(ow).get("shortcuts", []):
		if raw is Dictionary and StringName(String((raw as Dictionary).get("id", ""))) == shortcut_id:
			var pos: Array = (raw as Dictionary).get("pos", [0, 0])
			return Vector2i(int(pos[0]), int(pos[1]))
	return Vector2i(184, 210)


func _cell(prop: String, fallback: Vector2i) -> Vector2i:
	for node: Node in get_tree().get_nodes_in_group(&"player_interactable"):
		if not node is Node2D:
			continue
		var node_id := ""
		for property: String in ["landmark_id", "camp_id", "discovery_id"]:
			if property in node:
				node_id = String(node.get(property))
				if not node_id.is_empty():
					break
		if node_id != prop:
			continue
		var node_position: Vector2 = (node as Node2D).global_position
		return Vector2i(int(node_position.x / TILE), int(node_position.y / TILE))
	return fallback
