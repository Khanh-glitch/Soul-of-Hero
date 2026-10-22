extends Node

const GAME_SCENE: PackedScene = preload("res://game/main.tscn")
const LEVEL_PATH := "res://data/levels/chapter_1_level_5.json"

var _failures: Array[String] = []
var _expected_size := Vector2i(640, 360)


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
	for _frame: int in 7:
		await get_tree().process_frame
	await get_tree().physics_frame

	var runtime := game.get_node_or_null("Level5ArcherRecruitmentRuntime")
	var entity_root := game.get_node_or_null("Level/Entities") as Node2D
	var player := entity_root.get_node_or_null("Knight") as KnightController if entity_root != null else null
	var boss := runtime.call(&"get_boss") as HoodedArcherMiniboss if runtime != null else null
	_expect(runtime != null and player != null and boss != null, "live Level 5 runtime resolves player and KingdomArcher")
	if runtime == null or player == null or boss == null:
		game.queue_free()
		_finish()
		return

	# Stage the real Phase-2 Soul Mark windup. Gameplay clocks are frozen only
	# after the production state, texture VFX and target-bound rune are active.
	player.global_position = boss.global_position + Vector2(165.0, 0.0)
	boss.set_priority_target(player)
	boss.set(&"_target", player)
	boss.call(&"_mark_engaged")
	boss.health = roundi(float(boss.max_health) * 0.64)
	boss.set(&"_phase", 2)
	boss.health_changed.emit(boss.health, boss.max_health)
	boss.phase_changed.emit(2)
	boss.call(&"_enter_state", HoodedArcherMiniboss.State.MARK_AIM)
	boss.call(&"_sync_boss_vfx")
	boss.set_physics_process(false)
	player.process_mode = Node.PROCESS_MODE_DISABLED

	var camera := player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
		camera.force_update_scroll()
	var boss_name := runtime.find_child("BossName", true, false) as Label
	var boss_health := runtime.find_child("BossHealthBar", true, false) as ProgressBar
	var boss_poise := runtime.find_child("BossPoiseBar", true, false) as ProgressBar
	var boss_phase := runtime.find_child("BossPhase", true, false) as Label
	var generic_focus := game.find_child("FocusPanel", true, false) as Control
	var charge := boss.get_node_or_null("AimChargeVfx") as Sprite2D
	var mark := boss.get_node_or_null("SoulMarkVfx") as Sprite2D
	var tutorial := game.get_node_or_null("LevelOneTutorial") as CanvasLayer
	if tutorial != null:
		tutorial.hide()
		tutorial.process_mode = Node.PROCESS_MODE_DISABLED
	_expect(boss_name != null and boss_name.text == "KingdomArcher (Lv 5)", "boss HUD visibly names KingdomArcher and its stage level")
	_expect(boss_health != null and boss_health.value > 0.0 and boss_poise != null and boss_poise.value > 0.0, "boss HUD exposes live HP and poise")
	_expect(boss_phase != null and boss_phase.text.contains("GIAI ĐOẠN 2"), "boss HUD identifies giai đoạn 2")
	_expect(generic_focus != null and not generic_focus.visible, "dedicated boss HUD suppresses the duplicate generic target strip")
	_expect(charge != null and charge.visible and mark != null and mark.visible, "Soul Mark uses bow-local charge plus a target rune")
	_expect(boss.get_node_or_null("TelegraphVfx") == null and boss.get_node_or_null("TelegraphDangerCore") == null, "capture contains no line telegraph nodes")

	for _frame: int in 10:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	_expect(Vector2i(image.get_width(), image.get_height()) == _expected_size, "capture has requested dimensions")
	var non_dark := 0
	var sampled := 0
	for y: int in range(0, image.get_height(), 8):
		for x: int in range(0, image.get_width(), 8):
			sampled += 1
			if image.get_pixel(x, y).get_luminance() > 0.035:
				non_dark += 1
	_expect(float(non_dark) / float(maxi(1, sampled)) > 0.08, "capture contains visible Level 5 gameplay")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var output_path := "res://.artifacts/level5_kingdom_archer_%dx%d.png" % [_expected_size.x, _expected_size.y]
	_expect(image.save_png(ProjectSettings.globalize_path(output_path)) == OK, "capture writes the KingdomArcher artifact")
	game.queue_free()
	await get_tree().process_frame
	_finish()


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("LEVEL 5 ARCHER VISUAL CAPTURE FAIL: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 5 KINGDOMARCHER VISUAL CAPTURE PASSED - %dx%d" % [_expected_size.x, _expected_size.y])
	else:
		print("CHAPTER 1 LEVEL 5 KINGDOMARCHER VISUAL CAPTURE FAILED - %s" % "; ".join(_failures))
	get_tree().quit(0 if _failures.is_empty() else 1)
