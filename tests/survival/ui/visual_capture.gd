extends Control
## Bounded native visual evidence: one composed Satchel frame at 720p plus the
## physical-Core detail frame at each requested integer viewport multiple.
const WORKSPACE := preload("res://game/survival/ui/expedition_workspace.tscn")
const FIXTURE := preload("res://tests/survival/ui/planner_fixture.gd")
var _workspace: Variant
var _failures := 0

func _ready() -> void:
	var output := ProjectSettings.globalize_path("res://.artifacts/a6-ui")
	DirAccess.make_dir_recursive_absolute(output)
	_workspace = WORKSPACE.instantiate()
	add_child(_workspace)
	if not _workspace.apply_snapshot(FIXTURE.snapshot()):
		_failures += 1
		push_error("A6 visual fixture snapshot failed to apply")
		get_tree().quit(1)
		return
	_workspace.open_workspace()
	await _settle()
	var args := OS.get_cmdline_user_args()
	var size_tag := String(args[0]) if not args.is_empty() else "native"
	var window_size := DisplayServer.window_get_size()
	if window_size == Vector2i.ZERO: window_size = Vector2i(get_viewport_rect().size)
	if size_tag == "1280":
		_capture(output.path_join("a6_workspace_satchel_1280.png"))
	_workspace.show_desk()
	_workspace.desk.select_tab(4)
	_workspace.desk._select("soh_i_000000000011_a1c0ffee")
	await _settle()
	_capture(output.path_join("a6_workspace_core_%s.png" % size_tag))
	print("A6 VISUAL CAPTURE: %s, %s, errors=%d" % [size_tag, window_size, _failures])
	get_tree().quit(1 if _failures else 0)

func _settle() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(0.12).timeout

func _capture(path: String) -> void:
	var image := get_viewport().get_texture().get_image()
	var result := image.save_png(path)
	if result != OK:
		_failures += 1
		push_error("Could not save bounded visual evidence: %s" % path)
	else:
		print("CAPTURE %s (%dx%d, %d bytes)" % [path, image.get_width(), image.get_height(), FileAccess.get_file_as_bytes(path).size()])
