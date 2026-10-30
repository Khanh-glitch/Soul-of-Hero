extends SceneTree

## Native renderer capture helper for the CI/reviewer evidence bundle.
## Run under Xvfb/display-backed Godot, not a browser or HTML renderer.


func _initialize() -> void:
	call_deferred("_capture")


func _capture() -> void:
	var options := _parse_options(OS.get_cmdline_user_args())
	var width := int(options.get("width", 1280))
	var height := int(options.get("height", 720))
	var output := str(options.get("output", "user://a8-native-pilot.png"))
	get_root().size = Vector2i(width, height)
	var scene := load("res://game/survival/world_content/scenes/poi_pilot.tscn") as PackedScene
	if scene == null:
		push_error("Pilot scene could not be loaded for native capture")
		quit(2)
		return
	get_root().add_child(scene.instantiate())
	for frame: int in range(8):
		await process_frame
	var timer := create_timer(1.0)
	await timer.timeout
	var image := get_root().get_texture().get_image()
	if image.is_empty():
		push_error("Godot produced an empty native viewport capture")
		quit(3)
		return
	var error := image.save_png(output)
	if error != OK:
		push_error("Could not write native capture %s (error %d)" % [output, error])
		quit(4)
		return
	print("A8_NATIVE_CAPTURE path=%s size=%dx%d" % [output, image.get_width(), image.get_height()])
	quit(0)


func _parse_options(arguments: PackedStringArray) -> Dictionary:
	var result := {}
	for argument: String in arguments:
		var pair := argument.trim_prefix("--").split("=", false, 1)
		if pair.size() == 2:
			result[pair[0]] = pair[1]
	return result
