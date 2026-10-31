class_name A6AvatarPreview
extends TextureRect

## An animated preview of an authentic staged avatar sheet.
##
## The character-choice screen used to show a single still cell, which made the two
## starting survivors look like icons rather than people. This plays the real
## authored sheet - the front row of `idle` by default, or any action the caller
## names - at whole-pixel scale with nearest filtering, so what the player picks is
## exactly what they will walk around as.
##
## It reads the private staging manifest written by tools/stage_a6_avatar_art.py and
## owns no game state. When art is not staged it stays empty and reports why, rather
## than substituting a different character.

signal animation_ready(action: String)

const MANIFEST_PATH := "res://private_art/a6_avatar/avatar_art_private_runtime.json"
const FRAME_CELL := Vector2i(64, 64)
## Rows in every authored sheet, in the order the staging manifest names them.
const DIRECTION_ROWS := {"front": 0, "side_left": 1, "side_right": 2, "back": 3}

@export var gender := "male"
@export var action := "idle"
@export var direction := "front"
## Whole-pixel magnification. The sheets are 64px; 3x reads at 720p and 4K without
## filtering a single source pixel.
@export var pixel_scale := 3
## Used only when the manifest does not carry the authored rate.
@export var fallback_fps := 6.0
## When true the preview alternates idle and walk, so the player sees the cycle they
## are about to use instead of a frozen pose.
@export var show_walk_interlude := true

var _frames: Array[AtlasTexture] = []
var _frame_index := 0
var _action_frames: Dictionary = {}
var _action_fps: Dictionary = {}
var _timer: Timer
var _walk_timer: Timer
var _walking := false
var _missing_reason := ""


func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	# Timers are created before any sheet is read, so a later play() always has them
	# even when the first action happened to be unstaged.
	_timer = Timer.new()
	_timer.autostart = true
	_timer.timeout.connect(_advance)
	add_child(_timer)
	if show_walk_interlude:
		_walk_timer = Timer.new()
		_walk_timer.wait_time = 3.2
		_walk_timer.autostart = true
		_walk_timer.timeout.connect(_toggle_walk)
		add_child(_walk_timer)
	_load_sheets()
	if not _frames.is_empty():
		animation_ready.emit(action)


## Why no animation is playing, in English for the test report. Empty when fine.
func missing_reason() -> String:
	return _missing_reason


## Which actions this character actually has staged art for.
func available_actions() -> Array[String]:
	_load_sheets()
	var names: Array[String] = []
	for key: Variant in _action_frames.keys():
		if not (_action_frames[key] as Array).is_empty():
			names.append(String(key))
	names.sort()
	return names


## Forces a specific action/direction, for the capture harness and the tests.
func play(target_action: String, direction_name: String = "front") -> void:
	action = target_action
	direction = direction_name
	_frame_index = 0
	_missing_reason = ""
	_load_sheets()
	if _frames.is_empty():
		return
	_apply_frame()
	animation_ready.emit(action)


func _load_sheets() -> void:
	_frames = []
	_action_frames.clear()
	_action_fps.clear()
	if not FileAccess.file_exists(MANIFEST_PATH):
		_missing_reason = "private staging manifest missing"
		return
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST_PATH))
	if not parsed is Dictionary:
		_missing_reason = "private staging manifest unreadable"
		return
	var characters: Variant = (parsed as Dictionary).get("characters", {})
	if not characters is Dictionary:
		_missing_reason = "no characters in staging manifest"
		return
	var record: Variant = (characters as Dictionary).get(gender, {})
	if not record is Dictionary:
		_missing_reason = "no staged character for %s" % gender
		return
	var grades: Variant = (record as Dictionary).get("armor_grades", {})
	if not grades is Dictionary:
		_missing_reason = "no armour grades for %s" % gender
		return
	var grade_zero: Variant = (grades as Dictionary).get("0", {})
	if not grade_zero is Dictionary:
		_missing_reason = "grade 0 is not staged for %s" % gender
		return
	var sheets: Variant = (grade_zero as Dictionary).get("runtime_action_sheets", {})
	if not sheets is Dictionary:
		_missing_reason = "no runtime action sheets for %s" % gender
		return
	for action_name: Variant in (sheets as Dictionary).keys():
		var built := _build_frames(sheets as Dictionary, String(action_name))
		_action_frames[String(action_name)] = built[0]
		_action_fps[String(action_name)] = built[1]
	var wanted: Array = _action_frames.get(action, [])
	if wanted.is_empty():
		_missing_reason = "%s has no staged '%s' sheet" % [gender, action]
		return
	_frames = wanted
	var rate := float(_action_fps.get(action, fallback_fps))
	_timer.wait_time = 1.0 / maxf(rate, 1.0)
	_apply_frame()


## Returns [frames, fps] for one action.
func _build_frames(sheets: Dictionary, action_name: String) -> Array:
	var frames: Array[AtlasTexture] = []
	var record: Variant = sheets.get(action_name, {})
	if not record is Dictionary:
		return [frames, fallback_fps]
	var path := String((record as Dictionary).get("texture_path", ""))
	if path.is_empty() or not ResourceLoader.exists(path):
		return [frames, fallback_fps]
	var sheet := load(path) as Texture2D
	if sheet == null:
		return [frames, fallback_fps]
	var row := int(DIRECTION_ROWS.get(direction, 0))
	var directions: Variant = (record as Dictionary).get("directions", {})
	if directions is Dictionary and (directions as Dictionary).has(direction):
		var named: Variant = (directions as Dictionary)[direction]
		if named is Dictionary:
			row = int((named as Dictionary).get("row", row))
	# Frame count is the widest row, so a short last row cannot truncate the cycle.
	var count := 1
	if directions is Dictionary:
		for direction_value: Variant in (directions as Dictionary).values():
			if direction_value is Dictionary:
				count = maxi(count, int((direction_value as Dictionary).get("frames", 1)))
	for index in range(count):
		var frame := AtlasTexture.new()
		frame.atlas = sheet
		frame.region = Rect2(
			Vector2(index * FRAME_CELL.x, row * FRAME_CELL.y),
			Vector2(FRAME_CELL),
		)
		frames.append(frame)
	var fps := float((record as Dictionary).get("fps", fallback_fps))
	return [frames, fps]


func _advance() -> void:
	if _frames.is_empty():
		return
	_frame_index = (_frame_index + 1) % _frames.size()
	_apply_frame()


func _apply_frame() -> void:
	if _frames.is_empty():
		return
	texture = _frames[clampi(_frame_index, 0, _frames.size() - 1)]
	custom_minimum_size = Vector2(Vector2i(FRAME_CELL * pixel_scale))


func _toggle_walk() -> void:
	var next := "idle" if _walking else "walk"
	var candidate: Array = _action_frames.get(next, [])
	if candidate.is_empty():
		return
	_walking = not _walking
	_frames = candidate
	_frame_index = 0
	var rate := float(_action_fps.get(next, fallback_fps))
	_timer.wait_time = 1.0 / maxf(rate, 1.0)
	_apply_frame()
