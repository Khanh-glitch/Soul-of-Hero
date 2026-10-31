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
const WATCHDOG_SECONDS := 120.0

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
	await _capture_screen("avatar_choice", AVATAR_SCENE, "MaleButton")
	await _capture_screen("avatar_female", AVATAR_SCENE, "FemaleButton")
	await _capture_return("return_digest", "digest")
	await _capture_return("return_guidance", "guidance")
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
	print("A6 SURVIVAL UI CAPTURE: requested window ", _requested_size)


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
	print("A6 SURVIVAL UI CAPTURE: rendering ", state)
	await _settle(8)
	if not focus_name.is_empty():
		var target := screen.find_child(focus_name, true, false) as Control
		if target == null:
			_failures.append("%s: no node named %s" % [state, focus_name])
		elif target is BaseButton:
			(target as BaseButton).grab_focus()
		await _settle(4)
	await RenderingServer.frame_post_draw
	var frame := get_viewport().get_texture().get_image()
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
		"texts": _audit_texts(screen),
	})
	screen.queue_free()
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
	await RenderingServer.frame_post_draw
	var frame := get_viewport().get_texture().get_image()
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
