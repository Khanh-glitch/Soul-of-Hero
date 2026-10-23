extends Node

const APP_ROOT_SCENE: PackedScene = preload("res://game/app/app_root.tscn")
const CAMPAIGN_REGISTRY: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)

var _slot := 3
var _point := "combat"
var _out_path := "res://.artifacts/pilot_capture.png"
var _sim_frames := 90
var _save_path := ""
var _app_root: Node


func _ready() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--level-slot="):
			_slot = clampi(int(argument.get_slice("=", 1)), 1, 10)
		elif argument.begins_with("--capture-point="):
			_point = argument.get_slice("=", 1).strip_edges().to_lower()
		elif argument.begins_with("--out="):
			_out_path = argument.get_slice("=", 1).strip_edges()
		elif argument.begins_with("--sim-frames="):
			_sim_frames = maxi(12, int(argument.get_slice("=", 1)))
	_run.call_deferred()


func _run() -> void:
	_save_path = OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if _save_path.is_empty():
		_save_path = "user://tests/pilot_visual_%d_%d.json" % [_slot, Time.get_ticks_usec()]
	SaveService.call(&"configure_storage", _save_path, true)
	_seed_campaign_entry()

	var level_id := StringName("chapter_1_level_%d" % _slot)
	_app_root = APP_ROOT_SCENE.instantiate()
	add_child(_app_root)
	await get_tree().process_frame
	AppFlow.start_campaign_level(level_id)
	for _frame: int in 8:
		await get_tree().process_frame
	await get_tree().physics_frame

	var exit_code := 0
	var route_host := _app_root.get_node_or_null("RouteHost")
	var game := (
		route_host.get_child(0) as Node2D
		if route_host != null and route_host.get_child_count() > 0
		else null
	)
	if game != null:
		var dungeon := game.get_node_or_null("Level") as DungeonLevel
		var entity_root := game.get_node_or_null("Level/Entities") as Node2D
		var player := (
			entity_root.get_node_or_null("Knight") as CharacterBody2D
			if entity_root != null
			else null
		)
		var body_collision := (
			player.get_node_or_null("BodyShape") as CollisionShape2D
			if player != null
			else null
		)
		if dungeon == null or player == null or body_collision == null or body_collision.shape == null:
			push_error("PILOT VISUAL CAPTURE FAIL: missing live DungeonLevel or Knight BodyShape")
			exit_code = 1
		else:
			var anchor := _anchor_for(_slot, _point)
			var anchor_cell := Vector2i(floori(anchor.x / 16.0), floori(anchor.y / 16.0))
			var check_error := _validate_anchor_cell(dungeon, player, body_collision, anchor_cell)
			if not check_error.is_empty():
				push_error(
					"PILOT VISUAL CAPTURE INVALID ANCHOR (slot=%d point=%s cell=%s): %s"
					% [_slot, _point, anchor_cell, check_error]
				)
				exit_code = 1
			else:
				player.global_position = anchor
				player.set_physics_process(false)
				var camera := player.get_node_or_null("Camera") as Camera2D
				if camera != null:
					camera.reset_smoothing()
					camera.force_update_scroll()
				for _f: int in _sim_frames:
					await get_tree().physics_frame
					await get_tree().process_frame
					if "current_health" in player and "max_health" in player:
						player.set("current_health", player.get("max_health"))
				await RenderingServer.frame_post_draw
				var image := get_viewport().get_texture().get_image()
				DirAccess.make_dir_recursive_absolute(
					ProjectSettings.globalize_path(_out_path).get_base_dir()
				)
				image.save_png(ProjectSettings.globalize_path(_out_path))
				print(
					"PILOT VISUAL CAPTURE SAVED: slot=%d point=%s cell=%s out=%s"
					% [_slot, _point, anchor_cell, _out_path]
				)
	else:
		push_error("PILOT VISUAL CAPTURE FAIL: RouteHost has no active game scene")
		exit_code = 1

	if AppFlow.has_active_run():
		AppFlow.abort_to_home()
		await get_tree().process_frame
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := _save_path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))
	get_tree().quit(exit_code)


func _validate_anchor_cell(
	dungeon: DungeonLevel,
	player: CharacterBody2D,
	body_collision: CollisionShape2D,
	cell: Vector2i,
) -> String:
	if dungeon.backdrop.get_cell_source_id(cell) == -1:
		return "cell %s has no walkable Backdrop tile" % cell
	if dungeon.geometry.get_cell_source_id(cell) != -1:
		return "cell %s is occupied by solid Geometry" % cell
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_collision.shape
	query.collision_mask = 1
	query.collide_with_areas = false
	var cell_world := dungeon.to_global(Vector2(cell * Vector2i(16, 16)) + Vector2(8.0, 8.0))
	query.transform = Transform2D(0.0, cell_world + body_collision.position)
	for hit: Dictionary in dungeon.get_world_2d().direct_space_state.intersect_shape(query, 16):
		var collider: Variant = hit.get("collider")
		if collider is Node and (collider == dungeon.geometry or dungeon.is_ancestor_of(collider)):
			return "Knight BodyShape collides with Geometry at cell %s (%s)" % [
				cell,
				String((collider as Node).get_path()),
			]
	for entity_raw: Variant in dungeon.level_data.get("entities", []):
		if not entity_raw is Dictionary or String(entity_raw.get("type", "")) != "spikes":
			continue
		var pos: Array = entity_raw.get("position", [])
		if pos.size() >= 2:
			var sc := Vector2i(floori(float(pos[0]) / 16.0), floori(float(pos[1]) / 16.0))
			if sc == cell:
				return "cell %s stands directly on an authored spikes hazard" % cell
	return ""


func _anchor_for(slot: int, point: String) -> Vector2:
	if slot == 3 and point == "combat":
		# Walkable cover lane west of the central stone archive bays in Camp 1:
		# both East SkeletonReapers (102,13) & (102,20) fire SpectralDiscs across the stacks!
		return Vector2(91.0 * 16.0 + 8.0, 16.0 * 16.0 + 8.0)
	if slot == 3 and point == "vault":
		# Walkable North Scriptorium Cloister cell framing the breached Forbidden Folio Vault
		# to the north AND the twin stone bridges spanning the chasm abyss to the south!
		return Vector2(49.0 * 16.0 + 8.0, 10.0 * 16.0 + 8.0)
	if slot == 4 and point == "combat":
		# Walkable lane beside the central ritual bastion + fore-telegraphed spike gates in Camp 2:
		# twin cross-firing SkeletonReapers (39,46) & (57,52) throw SpectralDiscs!
		return Vector2(50.0 * 16.0 + 8.0, 50.0 * 16.0 + 8.0)
	if slot == 4 and point == "spiral":
		# Walkable processional axis of the Central Spiral Shrine framing outer austere coil,
		# intermediate counter-coil, and burning molten inner sanctum core!
		return Vector2(46.0 * 16.0 + 8.0, 13.0 * 16.0 + 8.0)
	return Vector2(14.0 * 16.0 + 8.0, 14.0 * 16.0 + 8.0)


func _seed_campaign_entry() -> bool:
	var ready_levels := CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false)
	var ready_level_ids: Array[String] = []
	for level: LevelDefinition in ready_levels:
		ready_level_ids.append(String(level.level_id))
	return bool(
		SaveService.call(
			&"transact_once",
			"tests:pilot_combat_visual_capture:%d:%s" % [_slot, _point],
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
				"kind": "isolated_pilot_visual_capture",
				"campaign_slot": _slot,
			}
		)
	)
