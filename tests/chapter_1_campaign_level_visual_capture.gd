extends Node

const APP_ROOT_SCENE: PackedScene = preload("res://game/app/app_root.tscn")
const CAMPAIGN_REGISTRY: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)
const ARTIFACT_DIR := "res://.artifacts"
const MID_ROOM_IDS := {
	1: "l1_f2_ring",
	2: "l2_f2_ring",
	3: "l3_f2_ring",
	4: "l4_f2_relay_ring",
	5: "l5_f2_blood_ring",
	6: "l6_f2_anchor",
	7: "l7_beacon_arena",
	8: "l8_reaper_hall",
	9: "l9_central_nave",
	10: "l10_processional_nave",
}
const END_ROOM_IDS := {
	1: "l1_f3_exit",
	2: "l2_f3_exit",
	3: "l3_f3_exit",
	4: "l4_f3_exit",
	5: "l5_f3_boss_crucible",
	6: "l6_f3_exit",
	7: "l7_beacon_arena",
	8: "l8_elite_vault",
	9: "l9_crimson_arena",
	10: "l10_castellan_throne",
}

var _slot := 1
var _capture_point := "spawn"
var _expected_size := Vector2i(1280, 720)
var _failures: Array[String] = []
var _save_path := ""
var _app_root: Node


func _ready() -> void:
	_parse_arguments()
	_run.call_deferred()


func _parse_arguments() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--level-slot="):
			_slot = clampi(int(argument.get_slice("=", 1)), 1, 10)
		elif argument.begins_with("--capture-point="):
			_capture_point = argument.get_slice("=", 1).strip_edges().to_lower()
		elif argument.begins_with("--expected-width="):
			_expected_size.x = maxi(1, int(argument.get_slice("=", 1)))
		elif argument.begins_with("--expected-height="):
			_expected_size.y = maxi(1, int(argument.get_slice("=", 1)))


func _run() -> void:
	if not _prepare_capture():
		_finish()
		return
	var game := await _start_campaign_route()
	if game == null:
		_cleanup_save()
		_finish()
		return
	await _capture_campaign_state(game)
	if AppFlow.has_active_run():
		AppFlow.abort_to_home()
		await get_tree().process_frame
	_cleanup_save()
	_finish()


func _prepare_capture() -> bool:
	_expect(_capture_point in ["spawn", "mid", "end"], "capture point is spawn, mid, or end")
	var level_id := StringName("chapter_1_level_%02d" % _slot)
	var definition := CAMPAIGN_REGISTRY.find_level(level_id)
	_expect(
		definition != null and definition.is_campaign_ready(),
		"slot resolves to a campaign-ready LevelDefinition"
	)
	_save_path = OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if _save_path.is_empty():
		_save_path = (
			"user://tests/chapter_1_visual_capture_%d_%d.json" % [_slot, Time.get_ticks_usec()]
		)
	_expect(
		bool(SaveService.call(&"configure_storage", _save_path, true)),
		"capture uses an isolated user save"
	)
	_expect(
		_seed_campaign_entry(),
		"capture fixture unlocks Chapter 1 through SaveService, not direct scene substitution"
	)
	return _failures.is_empty()


func _start_campaign_route() -> Node2D:
	var level_id := StringName("chapter_1_level_%02d" % _slot)
	_app_root = APP_ROOT_SCENE.instantiate()
	_expect(_app_root != null, "production AppRoot scene instantiates")
	if _app_root == null:
		return null
	add_child(_app_root)
	await get_tree().process_frame
	_expect(
		AppFlow.start_campaign_level(level_id), "production campaign gate starts Level %d" % _slot
	)
	if not AppFlow.has_active_run():
		return null
	for _frame: int in 8:
		await get_tree().process_frame
	await get_tree().physics_frame
	var route_host := _app_root.get_node_or_null("RouteHost")
	var game := (
		route_host.get_child(0) as Node2D
		if route_host != null and route_host.get_child_count() > 0
		else null
	)
	_expect(game != null, "production campaign route hosts the real Main scene")
	return game


func _capture_campaign_state(game: Node2D) -> void:
	var level_id := StringName("chapter_1_level_%02d" % _slot)
	var definition := CAMPAIGN_REGISTRY.find_level(level_id)
	var dungeon := game.get_node_or_null("Level") as DungeonLevel
	var entity_root := game.get_node_or_null("Level/Entities") as Node2D
	var player := (
		entity_root.get_node_or_null("Knight") as CharacterBody2D if entity_root != null else null
	)
	_expect(
		dungeon != null and player != null, "campaign route contains the live dungeon and Knight"
	)
	if dungeon == null or entity_root == null or player == null or definition == null:
		return
	_expect(
		dungeon.level_data_path == definition.layout_data_path,
		"campaign entry loads the registered layout path"
	)
	_expect(
		StringName(AppFlow.get_active_run().get("content_level_id", "")) == level_id,
		"tutorial and objective state observe the actual campaign slot",
	)

	var enemy_count := 0
	for child: Node in entity_root.get_children():
		if child.is_in_group(&"enemies"):
			enemy_count += 1
	_expect(
		enemy_count > 0, "L%d contains live enemy actors in the production campaign route" % _slot
	)
	var document: Dictionary = dungeon.level_data
	_expect(
		dungeon.backdrop.get_used_cells().size() == _layer_cell_count(document, "Backdrop"),
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

	if _capture_point != "spawn":
		var target_position := _room_capture_position(document, _capture_point)
		_expect(
			target_position != Vector2.INF,
			"L%d has an authored %s room anchor" % [_slot, _capture_point]
		)
		if target_position != Vector2.INF:
			player.global_position = target_position
	player.set_physics_process(false)
	var tutorial := game.get_node_or_null("LevelOneTutorial") as CanvasLayer
	_expect(
		(
			(_slot == 1 and tutorial != null and tutorial.visible)
			or (_slot > 1 and (tutorial == null or not tutorial.visible))
		),
		"tutorial is present only on the actual Level 1 campaign route",
	)
	var camera := player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
		camera.force_update_scroll()
	for _frame: int in 12:
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
		"capture contains rendered campaign gameplay rather than a blank/dark frame",
	)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(ARTIFACT_DIR))
	var output_path := (
		"%s/chapter_1_level_%02d_%s_runtime.png" % [ARTIFACT_DIR, _slot, _capture_point]
	)
	_expect(
		image.save_png(ProjectSettings.globalize_path(output_path)) == OK,
		"capture saves %s" % output_path,
	)
	print(
		(
			"CHAPTER 1 CAMPAIGN CAPTURE PASSED: slot=%d point=%s enemies=%d image=%s"
			% [_slot, _capture_point, enemy_count, output_path]
		)
	)


func _seed_campaign_entry() -> bool:
	var ready_levels := CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false)
	var ready_level_ids: Array[String] = []
	for level: LevelDefinition in ready_levels:
		ready_level_ids.append(String(level.level_id))
	return bool(
		SaveService.call(
			&"transact_once",
			"tests:chapter_1_visual_capture:%d" % _slot,
			func(candidate: Dictionary) -> bool:
				var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
				var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
				campaign["unlocked_levels"] = ready_level_ids.duplicate()
				var completed: Dictionary = campaign.get("completed_levels", {}).duplicate(true)
				for level: LevelDefinition in ready_levels:
					for prerequisite_id: String in level.unlock_requirements.prerequisite_level_ids:
						completed[prerequisite_id] = true
				campaign["completed_levels"] = completed
				progression["campaign"] = campaign
				var features: Dictionary = progression.get("features", {}).duplicate(true)
				for level: LevelDefinition in ready_levels:
					for feature_id: String in level.unlock_requirements.required_feature_ids:
						features[feature_id] = true
				progression["features"] = features
				candidate["progression"] = progression
				return true,
			{
				"kind": "isolated_chapter_1_visual_capture",
				"campaign_slot": _slot,
			}
		)
	)


func _room_capture_position(document: Dictionary, point: String) -> Vector2:
	var room_id := String((MID_ROOM_IDS if point == "mid" else END_ROOM_IDS).get(_slot, ""))
	var metadata: Dictionary = document.get("metadata", {})
	var rooms: Array = metadata.get("rooms", [])
	var room_rect := Rect2i()
	for room_value: Variant in rooms:
		if room_value is Dictionary and String(room_value.get("id", "")) == room_id:
			var rect: Array = room_value.get("rect", [])
			if rect.size() >= 4:
				room_rect = Rect2i(int(rect[0]), int(rect[1]), int(rect[2]), int(rect[3]))
			break
	if room_rect.size == Vector2i.ZERO:
		return Vector2.INF
	var layers: Dictionary = document.get("layers", {})
	var backdrop: Array = layers.get("Backdrop", [])
	var center := Vector2(room_rect.position) + Vector2(room_rect.size) * 0.5
	var nearest := Vector2.INF
	var nearest_distance := INF
	for raw_cell: Variant in backdrop:
		if not raw_cell is Dictionary:
			continue
		var cell: Dictionary = raw_cell
		var cell_position := Vector2i(int(cell.get("x", -1)), int(cell.get("y", -1)))
		if not room_rect.has_point(cell_position):
			continue
		var distance := Vector2(cell_position).distance_squared_to(center)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest = Vector2(cell_position * Vector2i(16, 16)) + Vector2(8.0, 8.0)
	return nearest


func _layer_cell_count(document: Dictionary, layer_name: String) -> int:
	var layers: Dictionary = document.get("layers", {})
	var layer: Variant = layers.get(layer_name, [])
	return (layer as Array).size() if layer is Array else 0


func _cleanup_save() -> void:
	if _save_path.is_empty():
		return
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := _save_path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("CHAPTER 1 CAMPAIGN CAPTURE FAIL: " + message)


func _finish() -> void:
	_cleanup_save()
	if _failures.is_empty():
		get_tree().quit(0)
	else:
		get_tree().quit(1)
