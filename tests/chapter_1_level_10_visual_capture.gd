extends Node

const GAME_SCENE: PackedScene = preload("res://game/main.tscn")
const LEVEL_PATH := "res://data/levels/chapter_1_level_10.json"

var _failures: Array[String] = []
var _expected_size := Vector2i(847, 437)


func _ready() -> void:
	_parse_arguments()
	_run.call_deferred()


func _parse_arguments() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--expected-width="):
			_expected_size.x = maxi(1, int(argument.get_slice("=", 1)))
		elif argument.begins_with("--expected-height="):
			_expected_size.y = maxi(1, int(argument.get_slice("=", 1)))


func _run() -> void:
	var game := GAME_SCENE.instantiate() as Node2D
	_expect(game != null, "production gameplay scene instantiates")
	if game == null:
		_finish()
		return
	var dungeon := game.get_node("Level") as DungeonLevel
	dungeon.level_data_path = LEVEL_PATH
	dungeon.watch_file_changes = false
	add_child(game)
	for _frame: int in 6:
		await get_tree().process_frame
	await get_tree().physics_frame

	var runtime := game.get_node_or_null("Level10CastellanRuntime")
	var entity_root := game.get_node_or_null("Level/Entities") as Node2D
	var player := entity_root.get_node_or_null("Knight") as Node2D if entity_root != null else null
	var boss := runtime.call(&"get_boss") as Node2D if runtime != null else null
	_expect(runtime != null and entity_root != null and player != null and boss != null, "Level 10 runtime, player, and dedicated boss are live")
	if runtime == null or entity_root == null or player == null or boss == null:
		game.queue_free()
		_finish()
		return

	# Stage a real Phase-2 Blink Lanes telegraph in the authored throne arena.
	# The actor, signals, HUD and telegraph are production nodes; only their clock
	# is frozen so unattended screenshots remain deterministic.
	boss.set_physics_process(false)
	player.global_position = boss.global_position + Vector2(92.0, 104.0)
	boss.call(&"take_damage", int(boss.get("max_health")) - int(boss.call(&"get_phase_two_threshold_health")), player.global_position)
	boss.call(&"_update_phase_transition", 1.20)
	_expect(int(boss.get("phase")) == 2, "capture stages the same continuous actor in Phase 2")
	_expect(bool(boss.call(&"debug_begin_pattern", &"blink_lanes")), "capture stages the production Blink Lanes warning")
	boss.queue_redraw()
	player.process_mode = Node.PROCESS_MODE_DISABLED

	var camera := player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
		camera.force_update_scroll()
	var boss_name := runtime.find_child("BossName", true, false) as Label
	var boss_health := runtime.find_child("BossHealthBar", true, false) as ProgressBar
	var boss_phase := runtime.find_child("BossPhase", true, false) as Label
	var pattern_label := runtime.find_child("BossPattern", true, false) as Label
	var boss_panel := runtime.find_child("BossPanel", true, false) as Control
	var generic_focus := game.find_child("FocusPanel", true, false) as Control
	_expect(boss_name != null and boss_name.text == "Vampire Castellan (Cấp 10)", "boss HUD visibly names Vampire Castellan and its stage level in Vietnamese")
	_expect(boss_health != null and boss_health.value > 0.0 and boss_health.value <= boss_health.max_value, "boss HUD exposes live remaining HP")
	_expect(boss_phase != null and boss_phase.text.contains("GIAI ĐOẠN 2"), "boss HUD visibly identifies giai đoạn 2")
	_expect(pattern_label != null and pattern_label.text.contains("DỊCH CHUYỂN"), "boss HUD names the active teleport pattern")
	_expect(boss_panel != null and _on_screen(boss_panel), "boss HUD remains fully on-screen")
	_expect(generic_focus != null and not generic_focus.visible, "dedicated boss HUD suppresses the duplicate generic target strip")
	var tutorial_panel := game.find_child("TutorialPanel", true, false) as Control
	var toast_panel := game.find_child("ToastPanel", true, false) as Control
	_expect(tutorial_panel == null or not _controls_overlap(boss_panel, tutorial_panel), "boss HUD does not cover the persistent tutorial prompt")
	_expect(toast_panel == null or not _controls_overlap(boss_panel, toast_panel), "boss HUD does not cover the shared toast lane")

	for _frame: int in 10:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	_expect(Vector2i(image.get_width(), image.get_height()) == _expected_size, "capture has the requested %dx%d dimensions" % [_expected_size.x, _expected_size.y])
	var non_dark := 0
	var sampled := 0
	for y: int in range(0, image.get_height(), 8):
		for x: int in range(0, image.get_width(), 8):
			sampled += 1
			if image.get_pixel(x, y).get_luminance() > 0.035:
				non_dark += 1
	_expect(float(non_dark) / float(maxi(1, sampled)) > 0.08, "capture contains visible throne gameplay")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var output_path := "res://.artifacts/level10_vampire_castellan_%dx%d.png" % [_expected_size.x, _expected_size.y]
	_expect(image.save_png(ProjectSettings.globalize_path(output_path)) == OK, "capture writes its Level 10 artifact")
	game.queue_free()
	await get_tree().process_frame
	_finish()


func _on_screen(control: Control) -> bool:
	if control == null or not control.is_visible_in_tree():
		return false
	var rect := control.get_global_rect()
	var viewport_rect := get_viewport().get_visible_rect()
	return rect.position.x >= -1.0 and rect.position.y >= -1.0 and rect.end.x <= viewport_rect.end.x + 1.0 and rect.end.y <= viewport_rect.end.y + 1.0


func _controls_overlap(first: Control, second: Control) -> bool:
	if first == null or second == null or not second.is_visible_in_tree():
		return false
	return first.get_global_rect().intersects(second.get_global_rect())


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("LEVEL 10 VISUAL CAPTURE FAIL: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 10 VISUAL CAPTURE PASSED - %dx%d" % [_expected_size.x, _expected_size.y])
		get_tree().quit(0)
	else:
		get_tree().quit(1)
