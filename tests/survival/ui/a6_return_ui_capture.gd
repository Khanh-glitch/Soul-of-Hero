extends Node

## Renders the four survival return cards so a human can look at them.
##
## Run it on a machine that actually has a display server — the CI workflow uses
## `xvfb-run` with a software GL driver:
##
##   xvfb-run -s "-screen 0 1280x720x24" \
##     godot --path . --resolution 1280x720 --rendering-driver opengl3 -- \
##     --a6-ui-capture --capture-dir="$PWD/.artifacts/captures-1280x720" --capture-tag=return_preview
##
## Four states are required at every resolution: `digest`, `guidance`, `history`,
## `empty`. The driver writes a manifest next to the PNGs with each frame's
## dimensions, non-blank check and every visible string with its measured
## rectangle and overflow verdict. It **fails** (exit 1) if fewer than four frames
## were saved, if any text overflows its box, or if a state does not actually show
## the card it is named after — a screenshot of a refused projection (an unbound
## digest, a stale ledger) is a failed capture, not a preview.
##
## The projections below are **preview fixtures**. They exist so layout, clipping
## and Vietnamese wrapping can be inspected, and they must never be quoted as
## evidence that farming, forging or research actually settled offline. The native
## gate (`a6_survival_return_native_test.tscn`) is what proves behaviour.
##
## In a headless binary this script prints `RENDERER REQUIRED` and exits 2, so an
## automated run can never mistake "no pixels" for "captures produced".

const LAYER_SCENE: PackedScene = preload("res://game/survival/ui/return/a6_survival_return_layer.tscn")
const NOW := 1793318400
const REQUIRED_STATES := ["digest", "guidance", "history", "empty"]

var _capture_dir := "user://a6_ui_captures"
var _tag := "return_preview"
var _saved: Array[String] = []
var _entries: Array[Dictionary] = []
var _frame_pixels := Vector2i.ZERO
var _overflows: Array[String] = []
var _state_errors: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	if DisplayServer.get_name() == "headless":
		printerr("A6 UI CAPTURE: RENDERER REQUIRED — this binary has no display server, nothing was rendered.")
		get_tree().quit(2)
		return
	_parse_arguments()
	_ensure_directory()
	await _settle(4)
	await _capture("digest", {
		"season_clock": _clock(2),
		"return_digest": _digest(2),
		"current": _current(2, 1),
		"run_facts": _facts(2),
		"site_cues": _cues(),
	})
	await _capture("guidance", {
		"season_clock": _clock(1),
		"current": _current(7, 1),
		"run_facts": _facts(1),
	})
	await _capture("history", {
		"season_clock": _clock(2),
		"run_history": _history(),
		"current": _current(40, 3),
		"run_facts": _facts(2),
	}, true)
	await _capture("empty", {
		"season_clock": _clock(3),
		"run_facts": _complete_facts(3),
		"current": {"available": true, "materials": 40, "structures": 3, "bed": true, "storage": true, "recipes": 2},
	})
	_write_manifest()
	var size := get_viewport().get_visible_rect().size
	if _saved.size() < REQUIRED_STATES.size():
		printerr("A6 UI CAPTURE: FAILED — saved %d of %d required frames at %dx%d" % [
			_saved.size(), REQUIRED_STATES.size(), int(size.x), int(size.y),
		])
		get_tree().quit(1)
		return
	if not _overflows.is_empty():
		printerr("A6 UI CAPTURE: FAILED — text overflow: " + ", ".join(_overflows))
		get_tree().quit(1)
		return
	if not _state_errors.is_empty():
		printerr("A6 UI CAPTURE: FAILED — wrong card for the named state: " + ", ".join(_state_errors))
		get_tree().quit(1)
		return
	for path: String in _saved:
		print("A6 UI CAPTURE: ", path)
	print("A6 UI CAPTURE OK (%d frames, %s, %dx%d px, preview data)" % [
		_saved.size(), DisplayServer.get_name(), _frame_pixels.x, _frame_pixels.y,
	])
	get_tree().quit(0)


func _parse_arguments() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--capture-dir="):
			_capture_dir = argument.trim_prefix("--capture-dir=")
		elif argument.begins_with("--capture-tag="):
			_tag = argument.trim_prefix("--capture-tag=")
	if _capture_dir.is_empty():
		_capture_dir = "user://a6_ui_captures"


func _ensure_directory() -> void:
	if _capture_dir.is_relative_path():
		_capture_dir = ProjectSettings.globalize_path(_capture_dir)
	DirAccess.make_dir_recursive_absolute(_capture_dir)


func _capture(state: String, overrides: Dictionary, open_record := false) -> void:
	var layer := LAYER_SCENE.instantiate()
	add_child(layer)
	layer.configure(get_tree(), overrides, func() -> int: return NOW)
	print("A6 UI CAPTURE: rendering ", state)
	await _settle(3)
	if open_record:
		layer.open_record()
	await _settle(6)
	# Reading the viewport texture before the renderer has finished a frame can
	# block forever on a software GL driver (the first hosted attempt sat on the
	# job timeout here). Wait for the draw, not just the process tick.
	await RenderingServer.frame_post_draw
	var viewport_size := get_viewport().get_visible_rect().size
	var frame := get_viewport().get_texture().get_image()
	# `canvas_items` stretch means the layout is authored in 640x360 units while the
	# framebuffer holds the window's real pixels. The file name, the manifest and the
	# verification gate all speak about pixels, so ask the image itself.
	var pixels := Vector2i(int(viewport_size.x), int(viewport_size.y))
	if frame != null and not frame.is_empty():
		pixels = Vector2i(frame.get_width(), frame.get_height())
	if _frame_pixels == Vector2i.ZERO:
		_frame_pixels = pixels
	var window := DisplayServer.window_get_size()
	var state_errors := _audit_state(layer, state)
	if pixels != window:
		var mismatch := "%s: frame is %dx%d but the window is %dx%d" % [state, pixels.x, pixels.y, window.x, window.y]
		state_errors.append(mismatch)
		_state_errors.append(mismatch)
	var file := "%s/%s_%s_%dx%d.png" % [_capture_dir, _tag, state, pixels.x, pixels.y]
	var saved := false
	if frame == null or frame.is_empty():
		printerr("A6 UI CAPTURE: %s produced no image" % state)
	else:
		var error := frame.save_png(file)
		if error != OK:
			printerr("A6 UI CAPTURE: failed to save %s (error %d)" % [file, error])
		else:
			saved = true
			_saved.append(file)
	_entries.append({
		"state": state,
		"file": file,
		"saved": saved,
		"width": pixels.x,
		"height": pixels.y,
		"layout_units": "%dx%d" % [int(viewport_size.x), int(viewport_size.y)],
		"non_blank": _is_non_blank(frame) if frame != null and not frame.is_empty() else false,
		"texts": _audit_texts(layer, state),
		"cards": _card_boxes(layer),
		"state_ok": state_errors.is_empty(),
	})
	layer.queue_free()
	await _settle(2)


## A frame that is one flat colour is a failed render, not a passed capture.
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


## Where each card actually sits. A card whose text falls outside its own rect is a
## layout bug the screenshot shows but a per-string check cannot name.
func _card_boxes(layer: Node) -> Dictionary:
	var boxes := {}
	for pair: Array in [
		["run_card", "run_card"], ["guidance", "guidance_panel"], ["digest", "return_digest"],
		["record", "record_panel"], ["site_cue", "site_cue_chip"],
	]:
		var control := layer.get(String(pair[1])) as Control
		if control == null:
			continue
		var rect := control.get_global_rect()
		var extra := control.get_combined_minimum_size()
		boxes[String(pair[0])] = {
			"visible": control.visible,
			"rect": [rect.position.x, rect.position.y, rect.size.x, rect.size.y],
			"min": [extra.x, extra.y],
		}
	return boxes


## A frame is only evidence of the state it names. A refused projection renders an
## empty card, so "the file exists and is not blank" would happily bless a broken
## preview. These checks make the render job assert the card, not just the pixels.
func _audit_state(layer: Node, state: String) -> Array[String]:
	var errors: Array[String] = []
	var guidance := layer.get("guidance_panel") as Control
	var digest_card := layer.get("return_digest") as Control
	var record := layer.get("record_panel") as Control
	match state:
		"digest":
			if digest_card == null or not digest_card.visible:
				errors.append("digest: the digest card is not visible")
			else:
				var view: Dictionary = layer.return_digest.view()
				var rows: Array = view.get("rows", [])
				if not bool(view.get("visible", false)) or rows.size() < 3:
					errors.append("digest: only %d rows, reason '%s'" % [rows.size(), String(view.get("reason", ""))])
		"guidance":
			if guidance == null or not guidance.visible:
				errors.append("guidance: the guidance card is not visible")
			else:
				var view: Dictionary = layer.guidance_panel.view()
				var rows: Array = view.get("rows", [])
				var any_done := false
				for row_value: Variant in rows:
					if bool((row_value as Dictionary).get("done", false)):
						any_done = true
						break
				if rows.is_empty():
					errors.append("guidance: no steps rendered")
				elif not any_done:
					errors.append("guidance: every step is unknown, so the preview shows no work at all")
		"history":
			if record == null or not record.visible:
				errors.append("history: the record card is not visible")
			else:
				if layer.record_panel.run_list.get_child_count() < 2:
					errors.append("history: fewer than two historic seasons")
				if layer.record_panel.achievement_list.get_child_count() < 1:
					errors.append("history: no achievements")
		"empty":
			for pair in [["guidance", guidance], ["digest", digest_card], ["record", record]]:
				var control := pair[1] as Control
				if control != null and control.visible:
					errors.append("empty: the %s card is visible" % String(pair[0]))
		_:
			errors.append("%s: unknown state" % state)
	_state_errors.append_array(errors)
	return errors


## Every visible string with the box it was drawn into. Clipping is a layout bug a
## headless geometry test cannot see, so the renderer run reports it explicitly.
func _audit_texts(layer: Node, state: String) -> Array[Dictionary]:
	var texts: Array[Dictionary] = []
	var screen := Rect2(Vector2.ZERO, get_viewport().get_visible_rect().size)
	for node: Node in layer.find_children("*", "Control", true, false):
		var control := node as Control
		if control == null or not control.is_visible_in_tree():
			continue
		var text := ""
		var autowrap := false
		if control is Label:
			text = (control as Label).text
			autowrap = (control as Label).autowrap_mode != TextServer.AUTOWRAP_OFF
		elif control is Button:
			text = (control as Button).text
		if text.strip_edges().is_empty():
			continue
		var rect := control.get_global_rect()
		var entry := {
			"state": state,
			"text": text,
			"rect": [rect.position.x, rect.position.y, rect.size.x, rect.size.y],
			"inside_screen": screen.encloses(rect),
			"overflow": false,
		}
		if not bool(entry["inside_screen"]):
			_overflows.append("%s: '%s' leaves the viewport" % [state, text])
		if not autowrap:
			var font := control.get_theme_font("font")
			var font_size := control.get_theme_font_size("font_size")
			if font != null:
				var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
				if width > rect.size.x + 1.0:
					entry["overflow"] = true
					_overflows.append("%s: '%s' needs %.0f px, has %.0f px" % [state, text, width, rect.size.x])
		texts.append(entry)
	return texts


func _write_manifest() -> void:
	var manifest := {
		"renderer": DisplayServer.get_name(),
		"resolution": "%dx%d" % [_frame_pixels.x, _frame_pixels.y],
		"window": "%dx%d" % [DisplayServer.window_get_size().x, DisplayServer.window_get_size().y],
		"data": "preview_fixture",
		"note": "Synthetic projections for layout review; not evidence of offline settlement.",
		"backdrop": "layer_only",
		"required_states": REQUIRED_STATES,
		"saved_count": _saved.size(),
		"overflows": _overflows,
		"state_errors": _state_errors,
		"frames": _entries,
	}
	var file := "%s/%s_manifest_%dx%d.json" % [_capture_dir, _tag, _frame_pixels.x, _frame_pixels.y]
	var handle := FileAccess.open(file, FileAccess.WRITE)
	if handle == null:
		printerr("A6 UI CAPTURE: cannot write %s" % file)
		return
	handle.store_string(JSON.stringify(manifest, "  "))
	handle.close()
	print("A6 UI CAPTURE manifest: ", file)


func _settle(frames: int) -> void:
	for _i in range(frames):
		await get_tree().process_frame


# --- preview fixtures -------------------------------------------------------
#
# Player-facing Vietnamese only. No internal identifiers, exactly like production.


func _clock(run_number: int) -> Dictionary:
	return {
		"contract": "soh.a6.season_clock.v1",
		"run_id": "preview-%d" % run_number,
		"run_number": run_number,
		"started_at_unix": NOW - 2 * 3600,
		"ends_at_unix": NOW - 2 * 3600 + 14 * 24 * 3600,
		"ended": false,
		"ended_reason": "",
	}


func _digest(run_number: int) -> Dictionary:
	return {
		"contract": "soh.a6.return_digest.v1",
		"digest_id": "preview-digest",
		"run_id": "preview-%d" % run_number,
		"away_seconds": 18 * 3600,
		"production": [
			{"kind": "forge", "completed_units": 6, "unit_label": "thỏi sắt", "stop_reason": "fuel_empty"},
			{"kind": "crop", "completed_units": 4, "unit_label": "củ cải", "stop_reason": "output_full"},
		],
		"provisions": {"consumed": 3, "shelter": "home", "shelter_validated": true, "hp_floor": true},
		"world_changes": ["Cây cầu gần nhà đã sập"],
	}


func _current(materials: int, structures: int) -> Dictionary:
	return {
		"available": true,
		"materials": materials,
		"structures": structures,
		"bed": structures >= 2,
		"storage": structures >= 3,
		"recipes": 0 if structures < 3 else 1,
	}


func _facts(run_number: int) -> Dictionary:
	return {
		"contract": "soh.a6.run_facts.v1",
		"run_number": run_number,
		"performed": {"gather_materials": true},
		"holds": {"materials": 2},
		"shelter": {"validated": true},
	}


## Every starter step performed, so the guide retires itself and the frame shows
## what a settled player actually sees: the season card and nothing to nag about.
func _complete_facts(run_number: int) -> Dictionary:
	return {
		"contract": "soh.a6.run_facts.v1",
		"run_number": run_number,
		"performed": {
			"gather_materials": true,
			"valid_shelter": true,
			"place_bed": true,
			"place_storage": true,
			"learn_recipe": true,
		},
		"holds": {"materials": 40},
		"shelter": {"validated": true},
	}


func _cues() -> Dictionary:
	return {
		"contract": "soh.a6.site_cues.v2",
		"observed_at_unix": NOW,
		"cues": [
			{"channel": "trace", "age_seconds": 5400, "ttl_seconds": 10800},
			{"channel": "sound", "direction": "left", "age_seconds": 120, "ttl_seconds": 900},
		],
	}


func _history() -> Dictionary:
	return {
		"contract": "soh.a6.run_history.v1",
		"runs": [
			{
				"started_at_unix": NOW - 45 * 86400,
				"ended_at_unix": NOW - 31 * 86400,
				"end_reason": "deadline",
				"milestones": ["Giường đầu tiên", "Rương đầu tiên"],
			},
			{
				"started_at_unix": NOW - 30 * 86400,
				"ended_at_unix": NOW - 16 * 86400,
				"end_reason": "abandoned",
				"milestones": ["Mở lò rèn"],
			},
		],
		"achievements": [
			{"title": "Qua mùa đầu", "detail": "Sống trọn 14 ngày", "earned_at_unix": NOW - 31 * 86400},
			{"title": "Thợ rèn tập sự", "detail": "Hoàn thành 20 mẻ rèn", "earned_at_unix": NOW - 16 * 86400},
		],
	}
