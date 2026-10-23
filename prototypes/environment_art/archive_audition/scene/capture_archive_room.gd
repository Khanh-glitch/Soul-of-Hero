extends Node

## Render the Monastic Archive prototype at native gameplay resolution and save
## the frames used in the report:
##
##   .artifacts/archive_room_entry.png      first impression at the door
##   .artifacts/archive_room_mid.png        the study hall between the piers
##   .artifacts/archive_room_end.png        the armarium wall (the destination)
##   .artifacts/archive_room_walk.png       after walking a real collision path
##   .artifacts/archive_room_overview.png   whole room, top-down
##
## Run:
##   godot --path . --rendering-method gl_compatibility --audio-driver Dummy \
##         --resolution 1280x720 \
##         res://prototypes/environment_art/archive_audition/scene/capture_archive_room.tscn

const ROOM_SCENE := "res://prototypes/environment_art/archive_audition/scene/archive_room.tscn"
const OUT := "res://.artifacts"
const EXPECTED := Vector2i(1280, 720)

var _room: Node2D
var _knight: Node2D
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	_room = (load(ROOM_SCENE) as PackedScene).instantiate()
	add_child(_room)
	await _settle(4)
	_knight = _room.get("knight") as Node2D
	if _knight == null:
		_failures.append("the Knight was not spawned from the shipping scene")

	await _shot_at_spawn("arrival")
	await _shot_at("entry")
	await _shot_at("mid")
	await _shot_at("end")
	await _walk_from_spawn(150)
	await _frame("walk")
	await _overview()
	_report()


## First impression: the Knight standing on the threshold, camera clamped to the
## room, exactly what the player sees on the frame they enter.
func _shot_at_spawn(name: String) -> void:
	if _knight != null:
		var room: Dictionary = _room.get("room")
		var spawn: Array = room["spawn"]
		_knight.global_position = Vector2(float(spawn[0]), float(spawn[1]))
	await _settle()
	await _frame(name)


func _shot_at(point: String) -> void:
	var target: Vector2 = _room.call("camera_point", point)
	if _knight != null:
		_knight.global_position = target
	await _settle()
	await _frame(point)


## Walk the Knight north up the aisle from the spawn for real, with the room's
## own collision active, and record where he actually ends up.
func _walk_from_spawn(frames: int) -> void:
	if _knight == null:
		_failures.append("cannot walk: no Knight")
		return
	var room: Dictionary = _room.get("room")
	var spawn: Array = room["spawn"]
	_knight.global_position = Vector2(float(spawn[0]), float(spawn[1]))
	await _settle(4)
	var start: Vector2 = _knight.global_position
	Input.action_press("move_up", 1.0)
	for i: int in frames:
		await get_tree().physics_frame
	Input.action_release("move_up")
	await _settle(6)
	var finish: Vector2 = _knight.global_position
	print("ARCHIVE WALK: from %s to %s (%.1f px north)"
		% [str(start), str(finish), start.y - finish.y])
	if start.y - finish.y < 32.0:
		_failures.append("the Knight barely moved in the walk test")


func _settle(frames: int = 8) -> void:
	for i: int in frames:
		await get_tree().process_frame
		await get_tree().physics_frame


func _frame(name: String) -> void:
	await get_tree().process_frame
	await get_tree().physics_frame
	await get_tree().process_frame
	var image := get_viewport().get_texture().get_image()
	if image == null:
		_failures.append("viewport returned no image for %s" % name)
		return
	var path := "%s/archive_room_%s.png" % [OUT, name]
	if image.save_png(ProjectSettings.globalize_path(path)) != OK:
		_failures.append("could not write %s" % path)
		return
	if Vector2i(image.get_width(), image.get_height()) != EXPECTED:
		_failures.append(
			"%s is %dx%d, expected %dx%d"
			% [name, image.get_width(), image.get_height(), EXPECTED.x, EXPECTED.y]
		)
	print("ARCHIVE CAPTURE SAVED: %s (%dx%d)"
		% [path, image.get_width(), image.get_height()])


func _overview() -> void:
	var cam := Camera2D.new()
	cam.name = "OverviewCamera"
	cam.zoom = Vector2(0.75, 0.75)
	var size: Dictionary = _room.get("room")
	cam.position = Vector2(float(size["width"]) * 8.0, float(size["height"]) * 8.0)
	_room.add_child(cam)
	cam.make_current()
	await _settle()
	await _frame("overview")
	cam.queue_free()
	await _settle(2)
	# hand the camera back to the Knight for any later run
	if _knight != null:
		var kc := _knight.get_node_or_null("Camera") as Camera2D
		if kc != null:
			kc.make_current()


func _report() -> void:
	if _failures.is_empty():
		print("ARCHIVE ROOM CAPTURE TEST PASSED: 5 frames at 1280x720")
		get_tree().quit(0)
		return
	for failure: String in _failures:
		printerr("CAPTURE FAILURE: " + failure)
	printerr("ARCHIVE ROOM CAPTURE TEST FAILED")
	get_tree().quit(1)
