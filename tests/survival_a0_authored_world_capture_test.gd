extends SceneTree
## R13-A0-WORLD — native frames of the authored continent, at real resolutions.
##
## The route gate proves the world is playable; this proves the player would see
## something. It boots the same production scene, chooses the same Adventurer, walks
## with the ordinary directional keys, and saves the untouched framebuffer at the
## resolution the environment asks for (720p / 1440p / 2160p). Nothing is drawn as a
## fixture, no position is granted, and the frames are the engine's own output.
##
## A frame is only accepted if it is a *frame*: the same resolution it was asked for,
## more than one flat colour, real luminance variance, and a HUD that says something.
## A black or blank capture fails here rather than being handed to a reviewer.
##
##   A0_VISUAL_RESOLUTION=1280x720 godot --path . --script res://tests/survival_a0_authored_world_capture_test.gd

const OW_SCENE_PATH := "res://game/overworld/chapter1_overworld.tscn"
const SAVE := "user://tests/a0_authored_capture.json"
const BUILD_TIMEOUT_MS := 120_000
const ARTIFACT_DIR := "res://artifacts"

var failures: Array[String] = []
var checks := 0
var _host: Node = null
var _ow: Node = null
var _hero: CharacterBody2D = null
var _traversability: OverworldTraversability = null
var _frames: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(ARTIFACT_DIR))
	var save := root.get_node_or_null("SaveService")
	if save != null:
		save.call(&"configure_storage", SAVE, false)
		save.call(&"reset_to_defaults", "RESET_SOUL_OF_HERO_SAVE")
		save.call(&"set_player_avatar", "female", "r13_capture")
		save.call(&"save_now")
	await _boot()
	if _ow != null:
		await _play()
	_teardown()
	print("A0_AUTHORED_CAPTURE frames=%s" % str(_frames))
	_finish()


func _boot() -> void:
	if DisplayServer.get_name() == "headless":
		# A headless run has no framebuffer to capture. Say so instead of saving a
		# black rectangle that a reviewer would have to disprove.
		_expect(false, "a real display is present for capture (headless cannot capture)")
		return
	var scene: PackedScene = load(OW_SCENE_PATH) as PackedScene
	if scene == null:
		_expect(false, "the production overworld scene loads")
		return
	_host = Node2D.new()
	_host.name = "AuthoredCaptureHost"
	root.add_child(_host)
	_ow = scene.instantiate()
	_host.add_child(_ow)
	_ow.configure({"world_authority": "authored"})
	var deadline := Time.get_ticks_msec() + BUILD_TIMEOUT_MS
	while Time.get_ticks_msec() < deadline:
		await process_frame
		if _ow.has_method(&"is_world_ready") and bool(_ow.call(&"is_world_ready")):
			return
	_ow = null
	_expect(false, "the authored world built for capture")


func _play() -> void:
	_hero = _ow.get(&"player")
	_traversability = _ow.get(&"traversability")
	var authority: Node = _ow.get(&"world_authority")
	_expect(_hero != null and _traversability != null and authority != null,
		"the captured world exposes body, walkability and authority")
	if _hero == null or _traversability == null or authority == null:
		return
	var mode: String = String(_ow.call(&"world_authority_report").get("mode", ""))
	_expect(mode == "authored", "the captured world is the authored continent (%s)" % mode)
	var spawn: Dictionary = authority.call(&"spawn_record")
	print("A0_CAPTURE_SPAWN ", JSON.stringify(spawn))
	_expect(not (spawn.get("cell", []) as Array).is_empty(),
		"the captured run has a real spawn (%s)" % str(spawn.get("cell", [])))

	await _capture("spawn")
	# Ordinary directional input: the frame that follows is where the player walked.
	await _walk_input(Vector2.RIGHT, 90)
	await _capture("walk")
	await _walk_input(Vector2.DOWN, 90)
	await _capture("terrain")

	# The nearest authored source, approached on foot. If the walk cannot reach it,
	# the frame is still captured and the miss is named — never assumed.
	var source: Dictionary = await _walk_to_source(authority)
	if not source.is_empty():
		await _capture("source")
		await _press_key(KEY_G)
		await _capture("source_after_g")
	else:
		_note("no authored source was reached on foot in this capture run")

	# The HUD is part of what a player reads: prove it is painted and legible.
	var hud: CanvasLayer = _ow.get(&"hud") as CanvasLayer
	if hud != null:
		var label: String = _first_label_text(hud)
		_expect(not label.is_empty(), "the HUD paints readable text (%s)" % label)


func _teardown() -> void:
	_release()
	if _host != null and is_instance_valid(_host):
		_host.queue_free()
	_host = null


func _finish() -> void:
	for action: StringName in [&"move_left", &"move_right", &"move_up", &"move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(SAVE):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE))
	if failures.is_empty():
		print("A0 AUTHORED CAPTURE PASSED - %d checks" % checks)
		quit(0)
		return
	print("A0 AUTHORED CAPTURE FAILED - %d/%d" % [failures.size(), checks])
	for failure: String in failures:
		print("  - %s" % failure)
	quit(1)


# ---------------------------------------------------------------------------
# capture
# ---------------------------------------------------------------------------
func _capture(name: String) -> void:
	await process_frame
	await RenderingServer.frame_post_draw
	var image: Image = root.get_texture().get_image()
	_expect(image != null and not image.is_empty(), "a native frame exists for %s" % name)
	if image == null or image.is_empty():
		return
	var expected: PackedStringArray = OS.get_environment("A0_VISUAL_RESOLUTION").split("x")
	if expected.size() == 2:
		_expect(image.get_width() == int(expected[0]) and image.get_height() == int(expected[1]),
			"the %s frame is the full %s resolution (%dx%d)"
				% [name, OS.get_environment("A0_VISUAL_RESOLUTION"), image.get_width(), image.get_height()])
	var stats: Dictionary = _frame_stats(image)
	print("A0_AUTHORED_FRAME name=%s width=%d height=%d distinct=%d luma_sd=%.2f"
		% [name, image.get_width(), image.get_height(), int(stats.get("distinct", 0)),
			float(stats.get("luma_sd", 0.0))])
	_expect(int(stats.get("distinct", 0)) >= 24, "the %s frame is not a flat colour (%d distinct)"
		% [name, int(stats.get("distinct", 0))])
	_expect(float(stats.get("luma_sd", 0.0)) >= 2.0, "the %s frame has real contrast (sd %.2f)"
		% [name, float(stats.get("luma_sd", 0.0))])
	# The resolution is part of the file name: three runs write into one artifact
	# directory, and "which frame is which" must not depend on upload order.
	var suffix: String = OS.get_environment("A0_VISUAL_RESOLUTION")
	var path := "%s/visual_authored_%s.png" % [ARTIFACT_DIR, name if suffix.is_empty() else "%s_%s" % [name, suffix]]
	_expect(image.save_png(path) == OK, "the %s frame saved" % name)
	_frames.append(path)


## Distinct colours and luminance deviation over a sampled grid. Sampling, not a full
## scan: 4K frames are 8.3 M pixels and the question is "is anything painted here",
## which a 64x64 lattice answers without making the gate about image encoding.
func _frame_stats(image: Image) -> Dictionary:
	var seen := {}
	var total := 0.0
	var total_sq := 0.0
	var samples := 0
	var step_x := maxi(1, image.get_width() / 64)
	var step_y := maxi(1, image.get_height() / 64)
	for y: int in range(0, image.get_height(), step_y):
		for x: int in range(0, image.get_width(), step_x):
			var colour := image.get_pixel(x, y)
			seen["%d_%d_%d" % [int(colour.r * 255.0), int(colour.g * 255.0), int(colour.b * 255.0)]] = true
			var luma := 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b
			total += luma
			total_sq += luma * luma
			samples += 1
	var mean := total / float(maxi(1, samples))
	var variance := maxf(0.0, total_sq / float(maxi(1, samples)) - mean * mean)
	return {"distinct": seen.size(), "luma_sd": sqrt(variance) * 255.0}


func _first_label_text(node: Node) -> String:
	if node is Label and not (node as Label).text.strip_edges().is_empty():
		return (node as Label).text.strip_edges()
	for child: Node in node.get_children():
		var found: String = _first_label_text(child)
		if not found.is_empty():
			return found
	return ""


# ---------------------------------------------------------------------------
# ordinary input
# ---------------------------------------------------------------------------
func _walk_input(direction: Vector2, frames: int) -> void:
	for index: int in range(frames):
		var ahead := _hero.global_position + direction * 14.0
		if _traversability != null and not _traversability.call(&"is_free", _traversability.call(&"cell_of", ahead)):
			break
		Input.action_press(&"move_right" if direction.x > 0.0 else &"move_left" if direction.x < 0.0 else &"move_down" if direction.y > 0.0 else &"move_up")
		await physics_frame
	_release()


func _release() -> void:
	for action: StringName in [&"move_left", &"move_right", &"move_up", &"move_down"]:
		if Input.is_action_pressed(action):
			Input.action_release(action)


func _press_key(keycode: Key) -> void:
	var down := InputEventKey.new()
	down.physical_keycode = keycode
	down.keycode = keycode
	down.pressed = true
	Input.parse_input_event(down)
	await process_frame
	await process_frame
	var up := InputEventKey.new()
	up.physical_keycode = keycode
	up.keycode = keycode
	up.pressed = false
	Input.parse_input_event(up)
	await process_frame
	await process_frame


## Steers toward the nearest authored source with rays, pressing the same keys a
## player presses. No plan, no teleport: if a ridge is in the way the capture says so.
func _walk_to_source(authority: Node) -> Dictionary:
	var sources: Array = (_ow.get(&"authored_sources") as Array).duplicate()
	if sources.is_empty():
		return {}
	sources.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.get("distance_cells", 0)) < int(b.get("distance_cells", 0)))
	var resources: Node = _ow.get_node_or_null("Resources")
	if resources == null:
		return {}
	for raw: Variant in sources.slice(0, 4):
		var entry: Dictionary = raw
		var node := resources.get_node_or_null("Authored_%s"
			% String(entry.get("node_id", "")).replace(":", "_").replace(",", "_")) as Node2D
		if node == null:
			continue
		for _frame: int in range(900):
			var to_target := node.global_position - _hero.global_position
			if to_target.length() <= 26.0:
				return entry
			var bearing := to_target.normalized()
			var chosen := Vector2.ZERO
			for offset: float in [0.0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.0, -2.0, 2.4, -2.4, PI]:
				var candidate := bearing.rotated(offset)
				var probe := _hero.global_position + candidate * 14.0
				if _traversability.call(&"is_free", _traversability.call(&"cell_of", probe)):
					chosen = candidate
					break
			if chosen == Vector2.ZERO:
				break
			Input.action_press(&"move_left" if chosen.x < -0.35 else &"move_right" if chosen.x > 0.35 else &"move_up" if chosen.y < -0.35 else &"move_down")
			if _hero.global_position.distance_to(node.global_position) <= 26.0:
				_release()
				return entry
			await physics_frame
		_release()
		_note("source %s was not reached on foot" % String(entry.get("node_id", "")))
	return {}


# ---------------------------------------------------------------------------
# harness
# ---------------------------------------------------------------------------
func _expect(condition: bool, label: String) -> void:
	checks += 1
	if condition:
		print("  ok    %s" % label)
	else:
		failures.append(label)
		print("  FAIL  %s" % label)


func _note(text: String) -> void:
	print("  note  %s" % text)
