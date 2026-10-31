extends Node

## Renders the A6-owned survival screens that are *repo-only* - no licensed art in
## the loop - so a human can look at the real production scenes instead of reading a
## report about them.
##
##   xvfb-run -s "-screen 0 1280x720x24" \
##     godot --path . --rendering-driver opengl3 -- \
##     --a6-ui-capture --capture-size=1280x720 \
##     --capture-dir="$PWD/.artifacts/captures-1280x720" --capture-tag=survival_ui
##
## Captured states, all instantiated from the scenes the game actually loads:
##   * `title`          - the real title screen
##   * `avatar_choice`  - New Game's identity step, male card focused
##   * `avatar_female`  - the same screen with the female card focused
##
## It refuses to run headless (`RENDERER REQUIRED`, exit 2) so a binless run can
## never be mistaken for produced pixels, and it fails when a frame is blank or when
## a screen's own minimum size no longer fits the window.

const TITLE_SCENE := "res://game/ui/screens/title/title_screen.tscn"
const RETURN_LAYER_SCENE := "res://game/survival/ui/return/a6_survival_return_layer.tscn"
## The return gate's own fixture builder, reused rather than reimplemented: the
## frames this driver publishes then show exactly the states that gate audits.
const RETURN_FIXTURES := preload("res://tests/survival/ui/a6_return_ui_capture.gd")
const AVATAR_SCENE := "res://game/ui/screens/avatar_choice/avatar_choice_screen.tscn"
## The production HUD class itself, fed through the same entry points the overworld
## uses, so the frame shows the component that ships rather than a mock of it.
const HUD_SCRIPT := preload("res://game/overworld/overworld_hud.gd")
const BACKDROP_SCENE := "res://game/ui/theme/dungeon_backdrop.tscn"
const WATCHDOG_SECONDS := 300.0
## The production overworld, mounted so the workshop frame shows a real A3 session with
## real jobs in it. A capture rendered from a stub host would show pixels that no player
## can ever reach, which is the thing R13's review said must stop.
const OW_SCENE_PATH := "res://game/overworld/chapter1_overworld.tscn"
const OW_BUILD_TIMEOUT_MS := 90_000

var _capture_dir := "user://a6_ui_captures"
var _requested_size := Vector2i.ZERO
var _tag := "survival_ui"
var _saved: Array[String] = []
var _entries: Array[Dictionary] = []
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_parse_arguments()
	if DisplayServer.get_name() == "headless":
		printerr("A6 SURVIVAL UI CAPTURE: RENDERER REQUIRED — headless binary, nothing rendered.")
		get_tree().quit(2)
		return
	_ensure_directory()
	_start_watchdog()
	_resize_window()
	await _settle(6)
	await _capture_screen("title", TITLE_SCENE, "")
	# Two deliberately different directions of the *same* screens: one build, one scene
	# graph, two surfaces, so the creator compares tone rather than content.
	#
	# The world-backed frames run last. The overworld's HUD is on a CanvasLayer, so a live
	# world paints over every screen captured after it; ordering the world last means the
	# scene screens are captured against their own backdrop and nothing has to be torn
	# down mid-run.
	# One direction per process, selected by A6_VISUAL_DIRECTION. The CI matrix runs this
	# driver twice per resolution rather than switching direction inside one run: a
	# direction is a property of the frame, and a fresh process cannot carry a stale one
	# into the next frame.
	var direction := A6UiKit.direction()
	var suffix := "_dir" + direction
	printerr("A6 SURVIVAL UI CAPTURE: direction ", direction)
	await _capture_screen("avatar_choice" + suffix, AVATAR_SCENE, "MaleButton")
	await _capture_screen("avatar_female" + suffix, AVATAR_SCENE, "FemaleButton")
	await _capture_hud("hud_field" + suffix)
	await _capture_return("return_digest", "digest")
	await _capture_return("return_guidance", "guidance")
	printerr("A6 SURVIVAL UI CAPTURE: workshop direction ", direction)
	await _capture_workshop("workshop_queued" + suffix)
	await _capture_workshop("workshop_refused" + suffix)
	_write_manifest()
	if not _failures.is_empty():
		for message: String in _failures:
			printerr("A6 SURVIVAL UI CAPTURE: FAILED — ", message)
		get_tree().quit(1)
		return
	print("A6 SURVIVAL UI CAPTURE OK (%d frames, %s)" % [_saved.size(), DisplayServer.get_name()])
	get_tree().quit(0)


func _parse_arguments() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--capture-dir="):
			_capture_dir = argument.trim_prefix("--capture-dir=")
		elif argument.begins_with("--capture-tag="):
			_tag = argument.trim_prefix("--capture-tag=")
		elif argument.begins_with("--capture-size="):
			var parts := argument.trim_prefix("--capture-size=").split("x")
			if parts.size() == 2:
				_requested_size = Vector2i(int(parts[0]), int(parts[1]))
	if _capture_dir.is_empty():
		_capture_dir = "user://a6_ui_captures"


func _ensure_directory() -> void:
	if _capture_dir.is_relative_path():
		_capture_dir = ProjectSettings.globalize_path(_capture_dir)
	DirAccess.make_dir_recursive_absolute(_capture_dir)


func _resize_window() -> void:
	if _requested_size == Vector2i.ZERO:
		return
	DisplayServer.window_set_position(Vector2i(0, 0))
	DisplayServer.window_set_size(_requested_size)
	printerr("A6 SURVIVAL UI CAPTURE: requested window ", _requested_size)


func _start_watchdog() -> void:
	var timer := get_tree().create_timer(WATCHDOG_SECONDS, true)
	timer.timeout.connect(func() -> void:
		printerr("A6 SURVIVAL UI CAPTURE: TIMEOUT after %d seconds" % int(WATCHDOG_SECONDS))
		get_tree().quit(3)
	)


func _settle(frames: int) -> void:
	for _index in range(maxi(1, frames)):
		await get_tree().process_frame


## Loads one production scene, optionally focuses a named button, and captures the
## framebuffer. The scene is the real one: no mock layout, no fixture data.
func _capture_screen(state: String, scene_path: String, focus_name: String) -> void:
	if not ResourceLoader.exists(scene_path):
		_failures.append("%s: scene %s is missing" % [state, scene_path])
		return
	var packed := load(scene_path) as PackedScene
	if packed == null:
		_failures.append("%s: scene %s did not load" % [state, scene_path])
		return
	var screen := packed.instantiate() as Control
	if screen == null:
		_failures.append("%s: %s is not a Control scene" % [state, scene_path])
		return
	add_child(screen)
	printerr("A6 SURVIVAL UI CAPTURE: rendering ", state, " (", _usage(), ")")
	await _settle(8)
	printerr("A6 SURVIVAL UI CAPTURE: settled ", state)
	if not focus_name.is_empty():
		var target := screen.find_child(focus_name, true, false) as Control
		if target == null:
			_failures.append("%s: no node named %s" % [state, focus_name])
		elif target is BaseButton:
			(target as BaseButton).grab_focus()
		await _settle(4)
	printerr("A6 SURVIVAL UI CAPTURE: drawing ", state)
	await RenderingServer.frame_post_draw
	var frame := get_viewport().get_texture().get_image()
	printerr("A6 SURVIVAL UI CAPTURE: grabbed ", state)
	if frame == null or frame.is_empty():
		_failures.append("%s: no frame was drawn" % state)
		screen.queue_free()
		return
	var pixels := Vector2i(frame.get_width(), frame.get_height())
	if not _is_non_blank(frame):
		_failures.append("%s: frame is a flat colour" % state)
	# A screen wider than the window means the layout stopped fitting this
	# resolution; the screenshot would look plausible and be unusable.
	var rect := screen.get_global_rect()
	if rect.size.x > float(pixels.x) + 1.0 or rect.size.y > float(pixels.y) + 1.0:
		_failures.append("%s: layout %s does not fit %dx%d" % [
			state, str(rect.size), pixels.x, pixels.y,
		])
	var file := "%s/%s_%s_%dx%d.png" % [_capture_dir, _tag, state, pixels.x, pixels.y]
	await _save(frame, file, state)
	_entries.append({
		"state": state,
		"file": file,
		"saved": FileAccess.file_exists(file),
		"width": pixels.x,
		"height": pixels.y,
		"direction": A6UiKit.direction(),
		"texts": _audit_texts(screen),
	})
	screen.queue_free()
	await _settle(2)


## The production HUD, mounted on the authored backdrop and fed exactly what the
## overworld feeds it: region, provisions, pack, discovery counters and one prompt
## line the world really emits. Vitals arrive through the production `GameEvents`
## signal rather than a private setter, so this frame exercises the same path a hit
## in the world does. A close-up at each resolution is what makes Vietnamese text,
## bar contrast and icon legibility inspectable at 720p/1440p/2160p.
func _capture_hud(state: String) -> void:
	var backdrop := (load(BACKDROP_SCENE) as PackedScene).instantiate() as Control
	add_child(backdrop)
	await _settle(2)
	printerr("A6 SURVIVAL UI CAPTURE: hud backdrop ", state)
	var hud := HUD_SCRIPT.new() as CanvasLayer
	add_child(hud)
	await _settle(3)
	hud.call(&"set_region", "THE HOLLOW MARCHES  ·  WESTERN FOUNDRY QUARTER")
	hud.call(&"set_provisions", 80, 100)
	hud.call(&"set_carry", 7, 50)
	hud.call(&"set_counts", 1, 4, 2, 6, 0, 3)
	hud.call(&"show_prompt", "Stand near a chest to choose items.", 6.0)
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal("player_health_changed"):
		events.emit_signal("player_health_changed", 64, 100)
	await _settle(5)
	printerr("A6 SURVIVAL UI CAPTURE: drawing ", state)
	await RenderingServer.frame_post_draw
	var frame := get_viewport().get_texture().get_image()
	printerr("A6 SURVIVAL UI CAPTURE: grabbed ", state)
	if frame == null or frame.is_empty():
		_failures.append("%s: no frame was drawn" % state)
	elif not _is_non_blank(frame):
		_failures.append("%s: frame is a flat colour" % state)
	else:
		var pixels := frame.get_size()
		var hud_root := hud.get_node_or_null("Root") as Control
		if hud_root != null:
			var rect := hud_root.get_global_rect()
			if rect.size.x > float(pixels.x) + 1.0 or rect.size.y > float(pixels.y) + 1.0:
				_failures.append("%s: HUD %s does not fit %dx%d" % [
					state, str(rect.size), pixels.x, pixels.y,
				])
		var file := "%s/%s_%s_%dx%d.png" % [_capture_dir, _tag, state, pixels.x, pixels.y]
		await _save(frame, file, state)
		printerr("A6 SURVIVAL UI CAPTURE: saved ", state)
		_entries.append({
			"state": state,
			"file": file,
			"saved": FileAccess.file_exists(file),
			"width": pixels.x,
			"height": pixels.y,
			"direction": A6UiKit.direction(),
			"texts": _audit_texts(hud_root if hud_root != null else hud),
		})
	hud.queue_free()
	backdrop.queue_free()
	await _settle(2)


## The survival return layer, driven by the same preview fixtures the return gate
## audits. These are fixtures, not settled production: the frame proves layout and
## art, and the return gate proves behaviour.
func _capture_return(state: String, fixture_name: String) -> void:
	if not ResourceLoader.exists(RETURN_LAYER_SCENE):
		_failures.append("%s: return layer scene is missing" % state)
		return
	var builder := RETURN_FIXTURES.new()
	var overrides := {}
	var open_record := false
	for fixture: Array in builder.call(&"_fixtures"):
		if String(fixture[0]) == fixture_name:
			overrides = fixture[1]
			open_record = bool(fixture[2])
			break
	builder.free()
	if overrides.is_empty():
		_failures.append("%s: no such return fixture" % state)
		return
	# The fixtures are stamped against the return gate's fixed clock so a published
	# frame and the audited fixture describe the same moment.
	var now_unix := int(RETURN_FIXTURES.NOW)
	var layer := (load(RETURN_LAYER_SCENE) as PackedScene).instantiate()
	add_child(layer)
	layer.call(&"configure", get_tree(), overrides, func() -> int: return now_unix)
	await _settle(6)
	if open_record and layer.has_method(&"open_record"):
		layer.call(&"open_record")
		await _settle(4)
	printerr("A6 SURVIVAL UI CAPTURE: drawing ", state)
	await RenderingServer.frame_post_draw
	var frame := get_viewport().get_texture().get_image()
	printerr("A6 SURVIVAL UI CAPTURE: grabbed ", state)
	if frame == null or frame.is_empty():
		_failures.append("%s: no frame was drawn" % state)
	elif not _is_non_blank(frame):
		_failures.append("%s: frame is a flat colour" % state)
	else:
		var file := "%s/%s_%s_%dx%d.png" % [
			_capture_dir, _tag, state, frame.get_width(), frame.get_height(),
		]
		await _save(frame, file, state)
		print("A6 SURVIVAL UI CAPTURE: rendered ", state)
	layer.queue_free()
	await _settle(2)



# --- workshop, on the production world ---------------------------------------

## The workshop is captured over the **real** overworld, with a real A3 session and a
## real queue, because a craft list rendered from a stub host proves layout and nothing
## else. One world is built per run and reused for both directions; only the surface is
## re-applied between them.
var _world: Node = null


func _ensure_world() -> bool:
	if _world != null and is_instance_valid(_world):
		return true
	if not ResourceLoader.exists(OW_SCENE_PATH):
		_failures.append("workshop: %s is missing" % OW_SCENE_PATH)
		return false
	var scene := load(OW_SCENE_PATH) as PackedScene
	if scene == null:
		_failures.append("workshop: %s did not load" % OW_SCENE_PATH)
		return false
	var host := Node2D.new()
	host.name = "WorkshopCaptureHost"
	add_child(host)
	var world := scene.instantiate()
	host.add_child(world)
	world.call(&"configure", {})
	var deadline := Time.get_ticks_msec() + OW_BUILD_TIMEOUT_MS
	while Time.get_ticks_msec() < deadline:
		await get_tree().process_frame
		if world.has_method(&"is_world_ready") and bool(world.call(&"is_world_ready")):
			_world = world
			return true
		if world.has_method(&"is_world_ready"):
			var reason := String(world.get(&"build_error"))
			if not reason.is_empty():
				_failures.append("workshop: the overworld did not build (%s)" % reason)
				return false
	_failures.append("workshop: the overworld did not build within %d ms" % OW_BUILD_TIMEOUT_MS)
	return false


## Layout numbers, printed rather than eyeballed: a row wider than its scroll viewport
## is clipped at the right edge, and right-aligned text is exactly what disappears first.
## This names the widest child so the fix is aimed, not guessed.
func _report_widths(panel: Node) -> void:
	var scroll := panel.find_child("Scroll", true, false) as ScrollContainer
	if scroll == null:
		printerr("A6 SURVIVAL UI CAPTURE: widths: no Scroll node")
		return
	var list := scroll.find_child("Jobs", false, false) as Control
	var widest := ""
	var widest_x := 0.0
	if list != null:
		for child: Node in list.get_children():
			var control := child as Control
			if control == null:
				continue
			var minimum := control.get_combined_minimum_size().x
			if minimum > widest_x:
				widest_x = minimum
				widest = String(control.name)
	printerr("A6 SURVIVAL UI CAPTURE: widths viewport=%d list_min=%d widest=%s(%d)" % [
		int(scroll.size.x),
		int(list.get_combined_minimum_size().x) if list != null else -1,
		widest,
		int(widest_x),
	])


## One refused queue through the panel's own command path, so the frame shows the
## sentence a player would get.
func _refuse_once(panel: Node, session: Node) -> void:
	for raw_station: Variant in (session.call(&"nearby_stations") as Array):
		var station: Dictionary = raw_station
		var station_id := String(station.get("station_id", ""))
		var recipes: Array = session.call(&"available_recipes", station_id)
		if recipes.is_empty():
			continue
		var recipe: Dictionary = recipes[0]
		printerr("A6 SURVIVAL UI CAPTURE: refusing ", String(recipe.get("id", "")), " at ", station_id)
		panel.call(&"_queue", String(recipe.get("id", "")), station_id)
		return


## Take in anything the session has already finished, through the session's own command.
## A job that is not ready refuses and stays; nothing is claimed on the player's behalf.
func _collect_finished(session: Node) -> void:
	var jobs: Dictionary = session.call(&"jobs")
	for raw_id: Variant in jobs.keys():
		session.call(&"collect", String(raw_id))


## Queue real work through the session, paying for it out of a granted bag. The grant is
## the established fixture pattern (`grant_inventory_item` with a transaction key); the
## queue itself is the production command, and the row that appears is the session's own
## job, not a fabricated one.
func _queue_real_work(session: Node) -> int:
	var save := get_node_or_null("/root/SaveService")
	var queued := 0
	for raw_station: Variant in (session.call(&"nearby_stations") as Array):
		var station: Dictionary = raw_station
		var station_id := String(station.get("station_id", ""))
		for raw_recipe: Variant in (session.call(&"available_recipes", station_id) as Array):
			if queued >= 3:
				break
			var recipe: Dictionary = raw_recipe
			var inputs: Dictionary = recipe.get("inputs", {})
			for item_id: Variant in inputs.keys():
				if save != null and save.has_method(&"grant_inventory_item"):
					save.call(
						&"grant_inventory_item", String(item_id), "material",
						int(inputs[item_id]) + 4,
						"capture.grant.%s.%s.%d" % [station_id, String(item_id), Time.get_ticks_usec()],
						{"source": "capture"},
					)
			var result: Dictionary = session.call(&"queue_recipe", String(recipe.get("id", "")), station_id)
			if bool(result.get("ok", false)):
				queued += 1
	if queued == 0:
		_failures.append("workshop: the session refused every queue, so the frame would show an empty list")
	return queued


## `workshop_queued` is the list the moment work is handed over; `workshop_refused` is the
## same surface after the session refused a second queue because its queue is full. Both
## frames read owner state: nothing in either is a number the panel invented.
func _capture_workshop(state: String) -> void:
	var world_ready: bool = await _ensure_world()
	if not world_ready:
		return
	var panel := _world.get(&"economy_panel") as Node
	var session := _world.get(&"economy_session") as Node
	if panel == null or session == null:
		_failures.append("%s: the overworld has no economy panel/session" % state)
		return
	if state.contains("refused"):
		# Drive the panel's own queue command once more, with the queue full: the refusal
		# notice in this frame is produced by the production refusal mapping, from the
		# session's own answer. Pointer clicks are not claimed here - the 19-check GUI
		# suite owns those.
		_refuse_once(panel, session)
	elif state.contains("queued"):
		# Start each direction's "just handed over" frame from an empty queue, so the two
		# directions show the same moment instead of one showing what the other finished.
		_collect_finished(session)
		var queued := _queue_real_work(session)
		if queued > 0:
			printerr("A6 SURVIVAL UI CAPTURE: queued %d real jobs" % queued)
	else:
		# Frames, not a SceneTree timer: a timer created with process_always=false stops
		# advancing the moment anything pauses the tree, and the capture would then hang
		# until the watchdog rather than settle. 90 frames is the same 1.5s at 60 Hz and
		# cannot deadlock.
		for _frame in range(40):
			await get_tree().process_frame
			if _frame % 10 == 9:
				printerr("A6 SURVIVAL UI CAPTURE: settling ", state, " frame ", _frame + 1)
	printerr("A6 SURVIVAL UI CAPTURE: workshop chrome ", state)
	panel.call(&"restyle")
	if not bool(panel.call(&"is_open")):
		panel.call(&"toggle")
	panel.call(&"refresh")
	await _settle(6)
	printerr("A6 SURVIVAL UI CAPTURE: workshop list rebuilt ", state)
	_report_widths(panel)
	if not bool(panel.call(&"is_open")):
		_failures.append("%s: the workshop did not open" % state)
		return
	printerr("A6 SURVIVAL UI CAPTURE: drawing ", state)
	await RenderingServer.frame_post_draw
	var frame := get_viewport().get_texture().get_image()
	printerr("A6 SURVIVAL UI CAPTURE: grabbed ", state)
	if frame == null or frame.is_empty():
		_failures.append("%s: no frame was drawn" % state)
		return
	if not _is_non_blank(frame):
		_failures.append("%s: frame is a flat colour" % state)
		return
	var root := panel.get_node_or_null("EconomyOverlay") as Control
	if root != null:
		var rect := root.get_global_rect()
		var pixels := frame.get_size()
		if rect.size.x > float(pixels.x) + 1.0 or rect.size.y > float(pixels.y) + 1.0:
			_failures.append("%s: the workshop %s does not fit %dx%d" % [
				state, str(rect.size), pixels.x, pixels.y,
			])
	var file := "%s/%s_%s_%dx%d.png" % [_capture_dir, _tag, state, frame.get_width(), frame.get_height()]
	await _save(frame, file, state)
	_entries.append({
		"state": state,
		"file": file,
		"saved": FileAccess.file_exists(file),
		"width": frame.get_width(),
		"height": frame.get_height(),
		"direction": A6UiKit.direction(),
		"texts": _audit_texts(root if root != null else panel),
	})
	printerr("A6 SURVIVAL UI CAPTURE: rendered ", state, " (direction ", A6UiKit.direction(), ")")
	if state.contains("settled"):
		# Leave the panel closed: the next frame is a different screen, and an open modal
		# on layer 21 would cover it.
		panel.call(&"close_panel")


func _save(frame: Image, file: String, state: String) -> void:
	var error := frame.save_png(file)
	if error != OK:
		_failures.append("%s: save_png failed (%d)" % [state, error])
		return
	_saved.append(file)
	await get_tree().process_frame


func _is_non_blank(frame: Image) -> bool:
	if frame.get_width() < 8 or frame.get_height() < 8:
		return false
	var seen := {}
	for y in range(0, frame.get_height(), maxi(1, frame.get_height() / 24)):
		for x in range(0, frame.get_width(), maxi(1, frame.get_width() / 24)):
			seen[frame.get_pixel(x, y).to_rgba32()] = true
			if seen.size() > 8:
				return true
	return seen.size() > 3


## Every visible string a player would read, with the box it is laid out in. The
## manifest lets a reviewer check the words without squinting at pixels - and makes
## "the screen is blank but the file exists" impossible to miss.
func _audit_texts(root: Control) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for node: Node in root.find_children("*", "Label", true, false):
		var label := node as Label
		if label == null or not label.is_visible_in_tree() or label.text.strip_edges().is_empty():
			continue
		out.append({
			"text": label.text,
			"rect": _rect_list(label.get_global_rect()),
		})
	for node: Node in root.find_children("*", "Button", true, false):
		var button := node as Button
		if button == null or not button.is_visible_in_tree() or button.text.strip_edges().is_empty():
			continue
		out.append({
			"text": button.text,
			"rect": _rect_list(button.get_global_rect()),
			"disabled": button.disabled,
		})
	return out


## Static memory in MiB, attached to every milestone. A capture that stops without an
## error message is either a crash or an out-of-memory kill; this tells the two apart.
func _usage() -> String:
	return "%.0f MiB" % (float(OS.get_static_memory_usage()) / 1048576.0)


func _rect_list(rect: Rect2) -> Array:
	return [rect.position.x, rect.position.y, rect.size.x, rect.size.y]


func _write_manifest() -> void:
	var manifest := {
		"schema": "soh.a6.survival_ui_capture.v1",
		"renderer": DisplayServer.get_name(),
		"window": [DisplayServer.window_get_size().x, DisplayServer.window_get_size().y],
		"saved_count": _saved.size(),
		"failures": _failures,
		"frames": _entries,
	}
	var path := "%s/%s_manifest_%dx%d.json" % [
		_capture_dir, _tag,
		DisplayServer.window_get_size().x, DisplayServer.window_get_size().y,
	]
	var handle := FileAccess.open(path, FileAccess.WRITE)
	if handle == null:
		_failures.append("manifest: could not write " + path)
		return
	handle.store_string(JSON.stringify(manifest, "  "))
	handle.close()
