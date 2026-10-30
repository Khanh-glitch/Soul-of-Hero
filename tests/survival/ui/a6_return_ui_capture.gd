extends Node

## Renders the survival return cards so a human can look at them.
##
## Run it on a machine that actually has a display server — the CI workflow uses
## `xvfb-run` with a software GL driver:
##
##   xvfb-run -s "-screen 0 1280x720x24" \
##     godot --path . --resolution 1280x720 --rendering-driver opengl3 -- \
##     --a6-ui-capture --capture-dir="$PWD/.artifacts/captures-1280x720" --capture-tag=return_720p
##
## The projections below are **preview fixtures**: they exist so the layout can be
## inspected, and they must never be quoted as evidence that farming, forging or
## research actually settled offline. The native gate
## (`a6_survival_return_native_test.tscn`) is what proves behaviour.
##
## In a headless binary this script prints `RENDERER REQUIRED` and exits 2, so an
## automated run can never mistake "no pixels" for "captures produced".

const LAYER_SCENE: PackedScene = preload("res://game/survival/ui/return/a6_survival_return_layer.tscn")
const NOW := 1793318400

var _capture_dir := "user://a6_ui_captures"
var _tag := "return"
var _saved: Array[String] = []


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
		"return_digest": _digest(),
		"guidance_facts": _facts(2, 0),
		"site_cues": _cues(),
	})
	await _capture("guidance", {
		"season_clock": _clock(1),
		"guidance_facts": _facts(7, 1),
	})
	await _capture("record", {
		"season_clock": _clock(2),
		"run_history": _history(),
		"guidance_facts": _facts(40, 3),
	}, true)
	await _capture("empty", {})
	for path: String in _saved:
		print("A6 UI CAPTURE: ", path)
	print("A6 UI CAPTURE OK (%d files, %s)" % [_saved.size(), DisplayServer.get_name()])
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
	await _settle(3)
	if open_record:
		layer.open_record()
	await _settle(6)
	var viewport_size := get_viewport().get_visible_rect().size
	var image := get_viewport().get_texture().get_image()
	var file := "%s/%s_%s_%dx%d.png" % [_capture_dir, _tag, state, int(viewport_size.x), int(viewport_size.y)]
	var error := image.save_png(file)
	if error != OK:
		printerr("A6 UI CAPTURE: failed to save %s (error %d)" % [file, error])
	else:
		_saved.append(file)
	layer.queue_free()
	await _settle(2)


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


func _digest() -> Dictionary:
	return {
		"contract": "soh.a6.return_digest.v1",
		"digest_id": "preview-digest",
		"away_seconds": 18 * 3600,
		"production": [
			{"kind": "forge", "completed_units": 6, "unit_label": "thỏi sắt", "stop_reason": "fuel_empty"},
			{"kind": "crop", "completed_units": 4, "unit_label": "củ cải", "stop_reason": "output_full"},
		],
		"provisions": {"consumed": 3, "shelter": "home", "hp_floor": true},
		"world_changes": ["Cây cầu gần nhà đã sập"],
	}


func _facts(materials: int, structures: int) -> Dictionary:
	return {
		"available": true,
		"materials": materials,
		"structures": structures,
		"bed": structures >= 1,
		"storage": structures >= 2,
		"recipes": 0 if structures < 2 else 1,
	}


func _cues() -> Dictionary:
	return {
		"contract": "soh.a6.site_cues.v1",
		"observed_at_unix": NOW,
		"trail": {"present": true, "age_seconds": 5400},
		"threats": [{"distance_m": 42.0, "label": "Tiếng bước chân"}],
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
