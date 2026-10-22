extends Node

const GAME_SCENE: PackedScene = preload("res://game/main.tscn")
const LEVEL_PATH := "res://data/levels/chapter_1_level_9.json"
const OUTPUT_PATH := "res://.artifacts/level9_crimson_reaper_847x437.png"

var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


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
	for _frame: int in 5:
		await get_tree().process_frame
	await get_tree().physics_frame

	var runtime := game.get_node_or_null("Level9CrimsonGateRuntime")
	var entity_root := game.get_node_or_null("Level/Entities") as Node2D
	var player := entity_root.get_node_or_null("Knight") as Node2D if entity_root != null else null
	_expect(runtime != null and entity_root != null and player != null, "Level 9 runtime, world and player are live")
	if runtime == null or entity_root == null or player == null:
		game.queue_free()
		_finish()
		return
	for seal_id: StringName in [&"l9_west_gate_seal", &"l9_east_gate_seal", &"l9_north_gate_seal"]:
		var seal := runtime.call(&"get_gate_seal", seal_id) as GateSeal
		_expect(seal != null, "%s is a physical Gate Seal" % seal_id)
		if seal == null:
			continue
		seal.call(&"_on_body_entered", player)
		_expect(seal.interact(player), "%s is physically activated" % seal_id)
		await get_tree().process_frame
	var boss := runtime.call(&"get_crimson_reaper") as Node2D
	_expect(boss is CrimsonReaperEnemy, "third seal spawns the dedicated Crimson Reaper")
	if boss == null:
		game.queue_free()
		_finish()
		return

	# Keep the already-settled entry camera and stage the named Elite below the
	# player. This avoids a one-frame Camera2D scroll race in unattended OpenGL
	# captures while still showing the real production boss actor and aura.
	boss.global_position = player.global_position + Vector2(0.0, 74.0)
	boss.process_mode = Node.PROCESS_MODE_DISABLED
	player.process_mode = Node.PROCESS_MODE_DISABLED
	var camera := player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
		camera.force_update_scroll()
	var nameplate := boss.find_child("BossNameplate", true, false) as Label
	var status := runtime.find_child("CrimsonGateStatusLabel", true, false) as Label
	var progress := runtime.find_child("SealProgressLabel", true, false) as Label
	var panel := runtime.find_child("CrimsonGateStatusPanel", true, false) as Control
	_expect(nameplate != null and nameplate.text == "CRIMSON REAPER", "world nameplate identifies the named Elite")
	_expect(status != null and status.text.contains("Crimson Reaper"), "objective HUD names the active Elite")
	_expect(progress != null and progress.text.contains("ALL 3 SEALS"), "objective HUD shows the completed seal gate")
	_expect(panel != null and _on_screen(panel), "objective HUD stays on-screen at 847x437")

	for _frame: int in 10:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	_expect(image.get_width() == 847 and image.get_height() == 437, "capture is exactly 847x437")
	var non_dark := 0
	var sampled := 0
	for y: int in range(0, image.get_height(), 8):
		for x: int in range(0, image.get_width(), 8):
			sampled += 1
			if image.get_pixel(x, y).get_luminance() > 0.035:
				non_dark += 1
	_expect(float(non_dark) / float(maxi(1, sampled)) > 0.08, "capture contains visible gameplay")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	_expect(image.save_png(ProjectSettings.globalize_path(OUTPUT_PATH)) == OK, "capture writes the Level 9 artifact")
	game.queue_free()
	await get_tree().process_frame
	_finish()


func _on_screen(control: Control) -> bool:
	if control == null or not control.is_visible_in_tree():
		return false
	var rect := control.get_global_rect()
	var viewport_rect := get_viewport().get_visible_rect()
	return rect.position.x >= -1.0 and rect.position.y >= -1.0 and rect.end.x <= viewport_rect.end.x + 1.0 and rect.end.y <= viewport_rect.end.y + 1.0


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("LEVEL 9 VISUAL CAPTURE FAIL: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 9 VISUAL CAPTURE PASSED - %s" % ProjectSettings.globalize_path(OUTPUT_PATH))
		get_tree().quit(0)
	else:
		get_tree().quit(1)
