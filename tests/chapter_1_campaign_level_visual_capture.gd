extends Node

const GAME_SCENE: PackedScene = preload("res://game/main.tscn")
const ARTIFACT_DIR := "res://.artifacts"
const LEVEL_PATHS := {
	1: "res://data/levels/crypt_entrance.json",
	2: "res://data/levels/chapter_1_level_2.json",
	3: "res://data/levels/chapter_1_level_3.json",
	4: "res://data/levels/chapter_1_level_4.json",
	5: "res://data/levels/chapter_1_level_5.json",
	6: "res://data/levels/chapter_1_level_6.json",
	7: "res://data/levels/chapter_1_level_7.json",
	8: "res://data/levels/chapter_1_level_8.json",
	9: "res://data/levels/chapter_1_level_9.json",
	10: "res://data/levels/chapter_1_level_10.json",
}

var _slot := 1
var _expected_size := Vector2i(1280, 720)
var _failures: Array[String] = []


func _ready() -> void:
	_parse_arguments()
	_run.call_deferred()


func _parse_arguments() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--level-slot="):
			_slot = clampi(int(argument.get_slice("=", 1)), 1, 10)
		elif argument.begins_with("--expected-width="):
			_expected_size.x = maxi(1, int(argument.get_slice("=", 1)))
		elif argument.begins_with("--expected-height="):
			_expected_size.y = maxi(1, int(argument.get_slice("=", 1)))


func _run() -> void:
	var map_path := String(LEVEL_PATHS.get(_slot, ""))
	_expect(not map_path.is_empty(), "campaign slot has an authored layout path")
	if map_path.is_empty():
		_finish()
		return
	var game := GAME_SCENE.instantiate() as Node2D
	_expect(game != null, "production Main scene instantiates")
	if game == null:
		_finish()
		return
	var dungeon := game.get_node_or_null("Level") as DungeonLevel
	_expect(dungeon != null, "capture uses the production DungeonLevel")
	if dungeon == null:
		game.free()
		_finish()
		return
	dungeon.level_data_path = map_path
	dungeon.watch_file_changes = false
	add_child(game)

	for _frame: int in 8:
		await get_tree().process_frame
	await get_tree().physics_frame

	var entity_root := game.get_node_or_null("Level/Entities") as Node2D
	var player := entity_root.get_node_or_null("Knight") as CharacterBody2D if entity_root != null else null
	_expect(entity_root != null and player != null, "campaign map spawns the real Knight into the live entity root")
	if entity_root == null or player == null:
		game.queue_free()
		_finish()
		return
	player.set_physics_process(false)
	var camera := player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
		camera.force_update_scroll()

	var enemy_count := 0
	for child: Node in entity_root.get_children():
		if child.is_in_group(&"enemies"):
			enemy_count += 1
	_expect(enemy_count > 0, "L%d contains live enemy actors in the production scene" % _slot)
	var document: Dictionary = dungeon.level_data
	_expect(
		dungeon.backdrop.get_used_cells().size() == _floor_cell_count(document),
		"L%d runtime applies its complete authored Backdrop" % _slot,
	)
	_expect(
		dungeon.geometry.get_used_cells().size() == _layer_cell_count(document, "Geometry"),
		"L%d runtime applies its complete collision Geometry" % _slot,
	)
	_expect(
		dungeon.decor.get_used_cells().size() == _layer_cell_count(document, "Decor"),
		"L%d runtime applies its complete visual Decor layer" % _slot,
	)

	for _frame: int in 10:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	_expect(
		Vector2i(image.get_width(), image.get_height()) == _expected_size,
		"capture uses the requested %dx%d viewport" % [_expected_size.x, _expected_size.y],
	)
	var sampled := 0
	var non_dark := 0
	for y: int in range(0, image.get_height(), 8):
		for x: int in range(0, image.get_width(), 8):
			sampled += 1
			if image.get_pixel(x, y).get_luminance() > 0.035:
				non_dark += 1
	_expect(
		float(non_dark) / float(maxi(1, sampled)) > 0.04,
		"capture contains rendered Chapter 1 gameplay rather than a blank/dark frame",
	)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(ARTIFACT_DIR))
	var output_path := "%s/chapter_1_level_%02d_runtime.png" % [ARTIFACT_DIR, _slot]
	_expect(
		image.save_png(ProjectSettings.globalize_path(output_path)) == OK,
		"capture saves %s" % output_path,
	)
	print(
		"CHAPTER 1 GAMEPLAY CAPTURE PASSED: slot=%d enemies=%d image=%s"
		% [_slot, enemy_count, output_path]
	)
	game.queue_free()
	await get_tree().process_frame
	_finish()


func _floor_cell_count(document: Dictionary) -> int:
	return _layer_cell_count(document, "Backdrop")


func _layer_cell_count(document: Dictionary, layer_name: String) -> int:
	var layers: Dictionary = document.get("layers", {})
	var layer: Variant = layers.get(layer_name, [])
	return (layer as Array).size() if layer is Array else 0


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("CHAPTER 1 GAMEPLAY CAPTURE FAIL: " + message)


func _finish() -> void:
	if _failures.is_empty():
		get_tree().quit(0)
	else:
		get_tree().quit(1)
